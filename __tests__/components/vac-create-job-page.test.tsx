// RUTA: __tests__/components/vac-create-job-page.test.tsx
//
// VAC-043: /create-job no estaba protegida. Un anónimo o un candidato rellenaba
// el formulario completo y sólo al guardar recibía 'No autenticado'. La página
// resuelve la sesión (con requireRole, que consulta la base) antes de pintarlo.

const mockRequireRole = jest.fn();
jest.mock('@/lib/auth', () => ({
  requireRole: (...args: unknown[]) => mockRequireRole(...args)
}));

class RedireccionSimulada extends Error {
  constructor(public destino: string) {
    super(`REDIRECT ${destino}`);
  }
}
const mockRedirect = jest.fn((destino: string) => {
  throw new RedireccionSimulada(destino);
});
jest.mock('next/navigation', () => ({
  redirect: (destino: string) => mockRedirect(destino)
}));

jest.mock('@/components/sections/jobs/CreateJobForm', () => ({
  __esModule: true,
  default: () => null
}));

import CreateJobPage from '@/app/create-job/page';

describe('/create-job — guardia de sesión (VAC-043)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sin sesión manda al login con vuelta a /create-job', async () => {
    mockRequireRole.mockResolvedValue({ error: 'No autenticado', status: 401 });

    await expect(CreateJobPage()).rejects.toBeInstanceOf(RedireccionSimulada);
    expect(mockRedirect).toHaveBeenCalledWith('/login?redirect=/create-job');
  });

  it('un candidato (o un usuario desactivado) va a /unauthorized', async () => {
    mockRequireRole.mockResolvedValue({ error: 'Acceso denegado', status: 403 });

    await expect(CreateJobPage()).rejects.toBeInstanceOf(RedireccionSimulada);
    expect(mockRedirect).toHaveBeenCalledWith('/unauthorized');
  });

  it('sólo empresa y admin pasan', async () => {
    mockRequireRole.mockResolvedValue({ user: { id: 1, role: 'company' } });

    const resultado = await CreateJobPage();
    expect(resultado).toBeTruthy();
    expect(mockRedirect).not.toHaveBeenCalled();
    expect(mockRequireRole).toHaveBeenCalledWith(['company', 'admin']);
  });
});
