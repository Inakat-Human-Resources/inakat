// RUTA: __tests__/lib/auth-timing-safe.test.ts

/**
 * Tests para la defensa contra timing attacks en authenticateUser.
 *
 * Antes de este fix, cuando el usuario no existía la función retornaba de
 * inmediato sin hacer bcrypt. Cuando sí existía pero el password fallaba,
 * se ejecutaba bcrypt (~100ms). Esa diferencia permitía a un atacante
 * enumerar emails registrados midiendo latencias.
 *
 * Ahora se ejecuta bcrypt contra un hash dummy si el usuario no existe.
 */

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

// IMPORTANTE: usamos la implementación real de bcryptjs para que el cómputo
// sea suficientemente lento para ser detectable. Si lo mockeamos a cero el
// test mide ruido.
jest.unmock('bcryptjs');

import bcrypt from 'bcryptjs';
import { authenticateUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const mockPrismaUser = prisma.user as unknown as {
  findUnique: jest.Mock;
  update: jest.Mock;
};

describe('authenticateUser - timing-safe', () => {
  let validUserHash: string;

  beforeAll(async () => {
    validUserHash = await bcrypt.hash('correct-password', 10);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('debe llamar bcrypt.compare aún si el usuario no existe', async () => {
    const compareSpy = jest.spyOn(bcrypt, 'compare');
    mockPrismaUser.findUnique.mockResolvedValue(null);

    const result = await authenticateUser('noexiste@test.com', 'cualquier-password');

    expect(result.success).toBe(false);
    expect(compareSpy).toHaveBeenCalledTimes(1);
    // El argumento debería ser el password recibido y un hash dummy
    expect(compareSpy.mock.calls[0][0]).toBe('cualquier-password');
    expect(compareSpy.mock.calls[0][1]).toMatch(/^\$2[ab]\$/); // formato bcrypt
  });

  it('debe tomar tiempo similar para email existente (password incorrecto) vs no existente', async () => {
    // Caso 1: usuario no existe
    mockPrismaUser.findUnique.mockResolvedValueOnce(null);
    const start1 = Date.now();
    const r1 = await authenticateUser('noexiste@test.com', 'cualquier-password');
    const time1 = Date.now() - start1;
    expect(r1.success).toBe(false);

    // Caso 2: usuario existe pero password incorrecto
    mockPrismaUser.findUnique.mockResolvedValueOnce({
      id: 1,
      email: 'existe@test.com',
      password: validUserHash,
      nombre: 'Existe',
      apellidoPaterno: null,
      apellidoMaterno: null,
      role: 'user',
      isActive: true,
    });
    const start2 = Date.now();
    const r2 = await authenticateUser('existe@test.com', 'wrong-password');
    const time2 = Date.now() - start2;
    expect(r2.success).toBe(false);

    // Diferencia debe ser pequeña — ambos hicieron 1 bcrypt.compare.
    // Tolerancia generosa para evitar flakes en CI.
    const diff = Math.abs(time1 - time2);
    expect(diff).toBeLessThan(80);
  });

  it('debe retornar "Credenciales inválidas" tanto si user no existe como si password falla', async () => {
    mockPrismaUser.findUnique.mockResolvedValueOnce(null);
    const r1 = await authenticateUser('noexiste@test.com', 'x');

    mockPrismaUser.findUnique.mockResolvedValueOnce({
      id: 1,
      email: 'existe@test.com',
      password: validUserHash,
      nombre: 'Existe',
      apellidoPaterno: null,
      apellidoMaterno: null,
      role: 'user',
      isActive: true,
    });
    const r2 = await authenticateUser('existe@test.com', 'wrong-password');

    expect(r1.success).toBe(false);
    expect(r2.success).toBe(false);
    if (!r1.success && !r2.success) {
      expect(r1.error).toBe('Credenciales inválidas');
      expect(r2.error).toBe('Credenciales inválidas');
    }
  });
});
