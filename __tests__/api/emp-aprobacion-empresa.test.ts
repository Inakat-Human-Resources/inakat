// RUTA: __tests__/api/emp-aprobacion-empresa.test.ts

/**
 * EMP-002 — `requireApprovedCompany`: la aprobación del admin deja de ser
 * decorativa.
 *
 * El alta de empresa es pública y crea en el acto un User 'company' activo;
 * hasta ahora ninguna ruta consultaba `companyRequest.status`, así que una
 * empresa inventada —o ya rechazada— seguía operando igual.
 */

process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'secreto-de-pruebas-con-mas-de-32-caracteres-xxx';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn(), update: jest.fn() },
  },
}));

import { prisma } from '@/lib/prisma';
import { requireApprovedCompany } from '@/lib/auth';

const mockPrisma = prisma as unknown as {
  user: { findUnique: jest.Mock; update: jest.Mock };
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('requireApprovedCompany — interruptor apagado (por defecto)', () => {
  it('no bloquea a nadie mientras ENFORCE_COMPANY_APPROVAL no sea "true"', async () => {
    const antes = process.env.ENFORCE_COMPANY_APPROVAL;
    delete process.env.ENFORCE_COMPANY_APPROVAL;
    mockPrisma.user.findUnique.mockResolvedValue({
      isActive: true,
      role: 'company',
      companyRequest: { status: 'pending' },
    });
    await expect(requireApprovedCompany(1, 'company')).resolves.toBeNull();
    if (antes !== undefined) process.env.ENFORCE_COMPANY_APPROVAL = antes;
  });
});

describe('requireApprovedCompany', () => {
  // Estos casos prueban el comportamiento con el interruptor ENCENDIDO.
  const antes = process.env.ENFORCE_COMPANY_APPROVAL;
  beforeAll(() => { process.env.ENFORCE_COMPANY_APPROVAL = 'true'; });
  afterAll(() => {
    if (antes === undefined) delete process.env.ENFORCE_COMPANY_APPROVAL;
    else process.env.ENFORCE_COMPANY_APPROVAL = antes;
  });

  it('deja pasar a una empresa aprobada', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      isActive: true,
      role: 'company',
      companyRequest: { status: 'approved' },
    });

    await expect(requireApprovedCompany(42, 'company')).resolves.toBeNull();
  });

  it('bloquea con COMPANY_NOT_APPROVED a una empresa pendiente', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      isActive: true,
      role: 'company',
      companyRequest: { status: 'pending' },
    });

    const resultado = await requireApprovedCompany(42, 'company');
    expect(resultado).toEqual(
      expect.objectContaining({ code: 'COMPANY_NOT_APPROVED', status: 403 })
    );
  });

  it('bloquea a una empresa rechazada', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      isActive: true,
      role: 'company',
      companyRequest: { status: 'rejected' },
    });

    const resultado = await requireApprovedCompany(42, 'company');
    expect(resultado?.code).toBe('COMPANY_NOT_APPROVED');
  });

  it('bloquea a una cuenta desactivada aunque la solicitud esté aprobada', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      isActive: false,
      role: 'company',
      companyRequest: { status: 'approved' },
    });

    const resultado = await requireApprovedCompany(42, 'company');
    expect(resultado?.code).toBe('COMPANY_NOT_FOUND');
  });

  it('bloquea a un usuario sin solicitud asociada (solicitud borrada)', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      isActive: true,
      role: 'company',
      companyRequest: null,
    });

    const resultado = await requireApprovedCompany(42, 'company');
    expect(resultado?.code).toBe('COMPANY_NOT_FOUND');
  });

  it('exime al admin sin consultar la base', async () => {
    await expect(requireApprovedCompany(1, 'admin')).resolves.toBeNull();
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });
});
