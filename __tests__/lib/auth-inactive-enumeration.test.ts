/**
 * @jest-environment node
 */

/**
 * Tests para el fix de enumeración de cuentas (#24) en authenticateUser.
 *
 * Antes del fix, un usuario inactivo recibía "Usuario desactivado" ANTES de
 * verificar la contraseña, lo que permitía a un atacante enumerar qué emails
 * estaban registrados (aunque desactivados) sin conocer la contraseña.
 *
 * Tras el fix:
 *  - password incorrecto -> "Credenciales inválidas" (genérico), sea la cuenta
 *    activa o inactiva.
 *  - SOLO si la contraseña es correcta y la cuenta está inactiva se revela
 *    "Usuario desactivado".
 *
 * Se ejercita la función real authenticateUser (no se reimplementa la lógica).
 */

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

// Usamos bcrypt real para que verifyPassword evalúe de verdad el hash.
jest.unmock('bcryptjs');

import bcrypt from 'bcryptjs';
import { authenticateUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const mockPrismaUser = prisma.user as unknown as {
  findUnique: jest.Mock;
  update: jest.Mock;
};

const baseUser = (overrides: Record<string, unknown>) => ({
  id: 1,
  email: 'cuenta@test.com',
  password: '',
  nombre: 'Cuenta',
  apellidoPaterno: null,
  apellidoMaterno: null,
  role: 'user',
  isActive: true,
  ...overrides,
});

describe('authenticateUser - anti-enumeración de cuentas inactivas (#24)', () => {
  let validHash: string;

  beforeAll(async () => {
    validHash = await bcrypt.hash('Correct123', 10);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('cuenta INACTIVA + password INCORRECTO -> "Credenciales inválidas" (no revela el estado)', async () => {
    mockPrismaUser.findUnique.mockResolvedValue(
      baseUser({ password: validHash, isActive: false })
    );

    const result = await authenticateUser('cuenta@test.com', 'WrongPass1');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('Credenciales inválidas');
    }
    // No debió actualizar lastLogin
    expect(mockPrismaUser.update).not.toHaveBeenCalled();
  });

  it('cuenta INACTIVA + password CORRECTO -> "Usuario desactivado"', async () => {
    mockPrismaUser.findUnique.mockResolvedValue(
      baseUser({ password: validHash, isActive: false })
    );

    const result = await authenticateUser('cuenta@test.com', 'Correct123');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('desactivado');
    }
    expect(mockPrismaUser.update).not.toHaveBeenCalled();
  });

  it('cuenta ACTIVA + password CORRECTO -> success y actualiza lastLogin', async () => {
    mockPrismaUser.findUnique.mockResolvedValue(
      baseUser({ id: 2, password: validHash, isActive: true })
    );
    mockPrismaUser.update.mockResolvedValue({});

    const result = await authenticateUser('cuenta@test.com', 'Correct123');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.user.id).toBe(2);
      expect(result.token).toBeTruthy();
    }
    expect(mockPrismaUser.update).toHaveBeenCalledWith({
      where: { id: 2 },
      data: { lastLogin: expect.any(Date) },
    });
  });
});
