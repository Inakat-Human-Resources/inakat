// RUTA: __tests__/api/perf-profile-put.test.ts

/**
 * Auditoría 2026-09 · módulo perfil — GET/PUT /api/profile
 *
 * PERF-002: cvUrl sólo pasaba por normalizeUrl y fotoUrl no se validaba: se
 *           podían guardar enlaces de phishing que el staff abre desde la ficha.
 * PERF-003: al reemplazar foto o CV el archivo anterior seguía público.
 * PERF-005: user.update se confirmaba antes que candidate.update; si la segunda
 *           fallaba, la contraseña YA había cambiado y la respuesta era 500.
 * PERF-006: `educacion` se guardaba sin validar y un null dentro del array
 *           tiraba la ficha del reclutador/especialista/empresa.
 * PERF-007: al borrar la última entrada de educación reaparecía, porque no se
 *           limpiaban los campos legacy y el GET los usaba como fallback.
 * PERF-008: vaciar «Años de Experiencia» mandaba null a una columna Int NOT NULL
 *           y tiraba TODO el guardado con un 500 genérico.
 * PERF-022: el GET inventaba 'Licenciatura'/'Completa' para educación legacy y
 *           el siguiente guardado los persistía como reales.
 * PERF-023: la verificación de currentPassword no tenía rate limit.
 * PERF-024: el cambio de contraseña no aplicaba la política de registro.
 * PERF-025: candidateData no se validaba: nombres vacíos, carta sin límite,
 *           enums y coordenadas arbitrarias, tipos erróneos -> 500.
 */

jest.mock('next/server', () => ({
  NextResponse: {
    json: (data: any, options?: any) => ({
      status: options?.status || 200,
      json: async () => data,
    }),
  },
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn(), update: jest.fn() },
    candidate: { update: jest.fn() },
    $transaction: jest.fn(),
  },
}));

jest.mock('@/lib/auth', () => ({ requireAuth: jest.fn() }));
jest.mock('@/lib/rate-limit', () => ({ applyRateLimit: jest.fn(() => null) }));
jest.mock('@vercel/blob', () => ({ del: jest.fn(async () => undefined) }));

jest.mock('bcryptjs', () => ({
  __esModule: true,
  default: {
    compare: jest.fn(async () => true),
    hash: jest.fn(async () => 'hash-nuevo'),
  },
}));

import bcrypt from 'bcryptjs';
import { requireAuth } from '@/lib/auth';
import { applyRateLimit } from '@/lib/rate-limit';
import { prisma } from '@/lib/prisma';
import { del } from '@vercel/blob';
import { GET, PUT } from '@/app/api/profile/route';

const mockRequireAuth = requireAuth as jest.Mock;
const mockApplyRateLimit = applyRateLimit as jest.Mock;
const mockUser = (prisma as any).user;
const mockCandidate = (prisma as any).candidate;
const mockTransaction = (prisma as any).$transaction as jest.Mock;
const mockDel = del as jest.Mock;
const mockBcrypt = bcrypt as unknown as { compare: jest.Mock; hash: jest.Mock };

const URL_PROPIA = 'https://abc123store.public.blob.vercel-storage.com/9f2-cv.pdf';
const URL_PROPIA_2 = 'https://abc123store.public.blob.vercel-storage.com/aa1-cv.pdf';

function usuarioConCandidato(overrides: any = {}) {
  return {
    id: 1,
    email: 'cand@test.com',
    nombre: 'Juan',
    role: 'candidate',
    password: 'hash-viejo',
    credits: 0,
    createdAt: new Date('2025-01-01'),
    companyRequest: null,
    candidate: {
      id: 10,
      nombre: 'Juan',
      apellidoPaterno: 'Pérez',
      apellidoMaterno: null,
      telefono: '5512345678',
      fechaNacimiento: null,
      sexo: null,
      ciudad: null,
      estado: null,
      ubicacionCercana: null,
      latitude: null,
      longitude: null,
      universidad: null,
      carrera: null,
      nivelEstudios: null,
      educacion: null,
      añosExperiencia: 3,
      profile: null,
      seniority: null,
      linkedinUrl: null,
      portafolioUrl: null,
      cvUrl: null,
      fotoUrl: null,
      cartaPresentacion: null,
      experiences: [],
      ...overrides,
    },
  };
}

function pedirPut(body: any) {
  return new Request('http://localhost/api/profile', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** Datos con los que se llamó a candidate.update dentro de la transacción. */
function datosDeCandidato() {
  expect(mockCandidate.update).toHaveBeenCalled();
  return mockCandidate.update.mock.calls[0][0].data;
}

describe('PERF · PUT /api/profile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApplyRateLimit.mockReturnValue(null);
    mockRequireAuth.mockResolvedValue({ user: { id: 1, email: 'cand@test.com', role: 'candidate' } });
    mockUser.findUnique.mockResolvedValue(usuarioConCandidato());
    mockUser.update.mockImplementation(async () => ({
      id: 1,
      email: 'cand@test.com',
      nombre: 'Juan',
      role: 'candidate',
      credits: 0,
      companyRequest: null,
    }));
    mockCandidate.update.mockImplementation(async ({ data }: any) => ({ id: 10, ...data }));
    mockBcrypt.compare.mockResolvedValue(true);
    mockBcrypt.hash.mockResolvedValue('hash-nuevo');
    // Ejecuta las escrituras que le pasan, como haría Prisma.
    mockTransaction.mockImplementation(async (ops: any[]) => Promise.all(ops));
  });

  describe('PERF-005 · atomicidad', () => {
    it('escribe usuario y candidato en UNA sola transacción', async () => {
      const res = await PUT(pedirPut({
        nombre: 'Juan Nuevo',
        candidateData: { telefono: '5512345678' },
      }));

      expect(res.status).toBe(200);
      expect(mockTransaction).toHaveBeenCalledTimes(1);
      expect(mockTransaction.mock.calls[0][0]).toHaveLength(2);
    });

    it('si candidateData es inválido NO escribe nada (ni la contraseña)', async () => {
      const res = await PUT(pedirPut({
        currentPassword: 'Vieja2026',
        newPassword: 'Nueva2026',
        candidateData: { nombre: '' },
      }));

      expect(res.status).toBe(400);
      expect(mockTransaction).not.toHaveBeenCalled();
      expect(mockUser.update).not.toHaveBeenCalled();
      expect(mockCandidate.update).not.toHaveBeenCalled();
    });
  });

  describe('PERF-024 / PERF-023 · contraseña', () => {
    it('rechaza una contraseña sin mayúscula', async () => {
      const res = await PUT(pedirPut({ currentPassword: 'Vieja2026', newPassword: 'aaaaaaaa1' }));

      expect(res.status).toBe(400);
      expect(mockBcrypt.hash).not.toHaveBeenCalled();
      expect(mockTransaction).not.toHaveBeenCalled();
    });

    it('rechaza una contraseña sin número', async () => {
      const res = await PUT(pedirPut({ currentPassword: 'Vieja2026', newPassword: 'Aaaaaaaaa' }));

      expect(res.status).toBe(400);
      expect(mockBcrypt.hash).not.toHaveBeenCalled();
    });

    it('rechaza una newPassword que no es texto sin reventar', async () => {
      const res = await PUT(pedirPut({ currentPassword: 'Vieja2026', newPassword: 12345678 }));

      expect(res.status).toBe(400);
      expect(mockBcrypt.hash).not.toHaveBeenCalled();
    });

    it('acepta una contraseña que cumple la política', async () => {
      const res = await PUT(pedirPut({ currentPassword: 'Vieja2026', newPassword: 'Segura2026' }));

      expect(res.status).toBe(200);
      expect(mockBcrypt.hash).toHaveBeenCalledWith('Segura2026', 10);
    });

    it('aplica rate limit SÓLO cuando se intenta cambiar la contraseña', async () => {
      await PUT(pedirPut({ candidateData: { telefono: '5512345678' } }));
      expect(mockApplyRateLimit).not.toHaveBeenCalled();

      await PUT(pedirPut({ currentPassword: 'Vieja2026', newPassword: 'Segura2026' }));
      expect(mockApplyRateLimit).toHaveBeenCalledTimes(1);
      expect(mockApplyRateLimit.mock.calls[0][1]).toBe('profile-password');
    });

    it('si el rate limit corta, no se comprueba la contraseña ni se escribe', async () => {
      mockApplyRateLimit.mockReturnValue({ status: 429, json: async () => ({ success: false }) });

      const res = await PUT(pedirPut({ currentPassword: 'x', newPassword: 'Segura2026' }));

      expect(res.status).toBe(429);
      expect(mockBcrypt.compare).not.toHaveBeenCalled();
      expect(mockTransaction).not.toHaveBeenCalled();
    });
  });

  describe('PERF-008 · años de experiencia', () => {
    it('ignora añosExperiencia null en vez de responder 500', async () => {
      const res = await PUT(pedirPut({
        candidateData: { telefono: '5598765432', añosExperiencia: null },
      }));

      expect(res.status).toBe(200);
      const data = datosDeCandidato();
      expect(data).not.toHaveProperty('añosExperiencia');
      expect(data.telefono).toBe('5598765432');
    });

    it('rechaza un valor fuera de rango', async () => {
      const res = await PUT(pedirPut({ candidateData: { añosExperiencia: 500 } }));
      expect(res.status).toBe(400);
    });

    it('guarda un valor válido', async () => {
      const res = await PUT(pedirPut({ candidateData: { añosExperiencia: 7 } }));
      expect(res.status).toBe(200);
      expect(datosDeCandidato().añosExperiencia).toBe(7);
    });
  });

  describe('PERF-006 · educación validada', () => {
    it('rechaza un array con un elemento null', async () => {
      const res = await PUT(pedirPut({
        candidateData: {
          educacion: [
            { id: 1, nivel: 'Licenciatura', institucion: 'X', carrera: 'Y', estatus: 'Titulado' },
            null,
          ],
        },
      }));

      expect(res.status).toBe(400);
      expect(mockTransaction).not.toHaveBeenCalled();
    });

    it('rechaza campos que no son texto', async () => {
      const res = await PUT(pedirPut({
        candidateData: { educacion: [{ id: 1, carrera: { $ne: null } }] },
      }));

      expect(res.status).toBe(400);
    });

    it('rechaza más de 15 entradas', async () => {
      const educacion = Array.from({ length: 16 }, (_, i) => ({
        id: i, nivel: 'Licenciatura', institucion: 'X', carrera: 'Y', estatus: 'Titulado',
      }));

      const res = await PUT(pedirPut({ candidateData: { educacion } }));
      expect(res.status).toBe(400);
    });

    it('guarda una educación válida y sincroniza los campos legacy', async () => {
      const res = await PUT(pedirPut({
        candidateData: {
          educacion: [{ id: 1, nivel: 'Licenciatura', institucion: 'UANL', carrera: 'Sistemas', estatus: 'Titulado' }],
        },
      }));

      expect(res.status).toBe(200);
      const data = datosDeCandidato();
      expect(JSON.parse(data.educacion)).toHaveLength(1);
      expect(data.universidad).toBe('UANL');
      expect(data.carrera).toBe('Sistemas');
      expect(data.nivelEstudios).toBe('Licenciatura');
    });
  });

  describe('PERF-007 · borrar la última entrada de educación', () => {
    it('un array vacío limpia también universidad/carrera/nivelEstudios', async () => {
      mockUser.findUnique.mockResolvedValue(
        usuarioConCandidato({ universidad: 'UANL', carrera: 'Sistemas', nivelEstudios: 'Licenciatura' })
      );

      const res = await PUT(pedirPut({ candidateData: { educacion: [] } }));

      expect(res.status).toBe(200);
      const data = datosDeCandidato();
      expect(data.educacion).toBe('[]');
      expect(data.universidad).toBeNull();
      expect(data.carrera).toBeNull();
      expect(data.nivelEstudios).toBeNull();
    });
  });

  describe('PERF-002 · URLs de archivo sólo de nuestro almacenamiento', () => {
    it('rechaza un cvUrl externo', async () => {
      const res = await PUT(pedirPut({
        candidateData: { cvUrl: 'https://login-inakat.example/cv' },
      }));

      expect(res.status).toBe(400);
      expect(mockTransaction).not.toHaveBeenCalled();
    });

    it('rechaza un fotoUrl externo', async () => {
      const res = await PUT(pedirPut({
        candidateData: { fotoUrl: 'https://evil.example/foto.png' },
      }));

      expect(res.status).toBe(400);
    });

    it('acepta un cvUrl del blob propio', async () => {
      const res = await PUT(pedirPut({ candidateData: { cvUrl: URL_PROPIA } }));

      expect(res.status).toBe(200);
      expect(datosDeCandidato().cvUrl).toBe(URL_PROPIA);
    });

    it('acepta cvUrl null para eliminar el CV', async () => {
      const res = await PUT(pedirPut({ candidateData: { cvUrl: null } }));

      expect(res.status).toBe(200);
      expect(datosDeCandidato().cvUrl).toBeNull();
    });
  });

  describe('PERF-003 · el archivo reemplazado se borra', () => {
    it('borra el CV anterior al guardar uno nuevo', async () => {
      mockUser.findUnique.mockResolvedValue(usuarioConCandidato({ cvUrl: URL_PROPIA }));

      const res = await PUT(pedirPut({ candidateData: { cvUrl: URL_PROPIA_2 } }));

      expect(res.status).toBe(200);
      expect(mockDel).toHaveBeenCalledWith(URL_PROPIA);
    });

    it('borra la foto anterior al reemplazarla', async () => {
      mockUser.findUnique.mockResolvedValue(usuarioConCandidato({ fotoUrl: URL_PROPIA }));

      const res = await PUT(pedirPut({ candidateData: { fotoUrl: URL_PROPIA_2 } }));

      expect(res.status).toBe(200);
      expect(mockDel).toHaveBeenCalledWith(URL_PROPIA);
    });

    it('no borra nada si la URL no cambió', async () => {
      mockUser.findUnique.mockResolvedValue(usuarioConCandidato({ cvUrl: URL_PROPIA }));

      await PUT(pedirPut({ candidateData: { cvUrl: URL_PROPIA } }));

      expect(mockDel).not.toHaveBeenCalled();
    });
  });

  describe('PERF-025 · validación de candidateData', () => {
    it('rechaza nombre vacío', async () => {
      const res = await PUT(pedirPut({ candidateData: { nombre: '' } }));
      expect(res.status).toBe(400);
    });

    it('rechaza apellido paterno vacío', async () => {
      const res = await PUT(pedirPut({ candidateData: { apellidoPaterno: '   ' } }));
      expect(res.status).toBe(400);
    });

    it('rechaza una carta de presentación de más de 1000 caracteres', async () => {
      const res = await PUT(pedirPut({ candidateData: { cartaPresentacion: 'a'.repeat(1001) } }));
      expect(res.status).toBe(400);
      expect(mockTransaction).not.toHaveBeenCalled();
    });

    it('rechaza un sexo fuera del enum', async () => {
      const res = await PUT(pedirPut({ candidateData: { sexo: 'Helicóptero' } }));
      expect(res.status).toBe(400);
    });

    it('rechaza un seniority fuera del enum', async () => {
      const res = await PUT(pedirPut({ candidateData: { seniority: 'Emperador' } }));
      expect(res.status).toBe(400);
    });

    it('rechaza coordenadas fuera de rango', async () => {
      expect((await PUT(pedirPut({ candidateData: { latitude: 200 } }))).status).toBe(400);
      expect((await PUT(pedirPut({ candidateData: { longitude: -500 } }))).status).toBe(400);
    });

    it('rechaza una fecha de nacimiento futura', async () => {
      const res = await PUT(pedirPut({ candidateData: { fechaNacimiento: '2999-01-01' } }));
      expect(res.status).toBe(400);
    });

    it('rechaza un tipo erróneo con 400, no con 500', async () => {
      const res = await PUT(pedirPut({ candidateData: { ciudad: { $ne: null } } }));
      expect(res.status).toBe(400);
    });

    it('rechaza un linkedinUrl que no es http(s)', async () => {
      const res = await PUT(pedirPut({ candidateData: { linkedinUrl: 'javascript:alert(1)' } }));
      expect(res.status).toBe(400);
    });

    it('completa https:// en un linkedinUrl sin esquema', async () => {
      const res = await PUT(pedirPut({ candidateData: { linkedinUrl: 'linkedin.com/in/juan' } }));

      expect(res.status).toBe(200);
      expect(datosDeCandidato().linkedinUrl).toBe('https://linkedin.com/in/juan');
    });
  });
});

describe('PERF · GET /api/profile — educación legacy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ user: { id: 1, email: 'cand@test.com', role: 'candidate' } });
  });

  it('PERF-007: con educacion="[]" NO resucita la entrada legacy', async () => {
    mockUser.findUnique.mockResolvedValue(
      usuarioConCandidato({ educacion: '[]', universidad: 'UANL', carrera: 'Sistemas' })
    );

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.candidate.educacion).toEqual([]);
  });

  it('PERF-006: descarta entradas que no son objetos y coacciona los campos', async () => {
    mockUser.findUnique.mockResolvedValue(
      usuarioConCandidato({
        educacion: JSON.stringify([
          { id: 1, nivel: 'Licenciatura', institucion: 'UANL', carrera: null, añoInicio: '2015', estatus: 'Titulado' },
          null,
          'basura',
          { institucion: { raro: true }, añoFin: 1800 },
        ]),
      })
    );

    const res = await GET();
    const json = await res.json();
    const educacion = json.data.candidate.educacion;

    expect(educacion).toHaveLength(2);
    expect(educacion[0]).toMatchObject({ id: 1, carrera: '', añoInicio: 2015, estatus: 'Titulado' });
    expect(educacion[1]).toMatchObject({ institucion: '', añoFin: null });
  });

  it('PERF-006: lo que devuelve el GET se puede volver a guardar tal cual', async () => {
    mockUser.findUnique.mockResolvedValue(
      usuarioConCandidato({
        educacion: JSON.stringify([
          { id: 1700000000000.5, nivel: 'Licenciatura', institucion: 'UANL', carrera: null, añoInicio: '2015', estatus: 'Titulado' },
          null,
        ]),
      })
    );
    const json = await (await GET()).json();

    mockTransaction.mockImplementation(async (ops: any[]) => Promise.all(ops));
    mockUser.update.mockResolvedValue({ id: 1, email: 'c', nombre: 'Juan', role: 'candidate', credits: 0, companyRequest: null });
    mockCandidate.update.mockImplementation(async ({ data }: any) => ({ id: 10, ...data }));

    const res = await PUT(pedirPut({ candidateData: { educacion: json.data.candidate.educacion } }));
    expect(res.status).toBe(200);
  });

  it('PERF-006: el PUT acepta formatos antiguos (null en texto, año como cadena)', async () => {
    mockUser.findUnique.mockResolvedValue(usuarioConCandidato());
    mockTransaction.mockImplementation(async (ops: any[]) => Promise.all(ops));
    mockUser.update.mockResolvedValue({ id: 1, email: 'c', nombre: 'Juan', role: 'candidate', credits: 0, companyRequest: null });
    mockCandidate.update.mockImplementation(async ({ data }: any) => ({ id: 10, ...data }));

    const res = await PUT(pedirPut({
      candidateData: {
        educacion: [{ id: 1, nivel: 'Licenciatura', institucion: 'UANL', carrera: null, añoInicio: '2015', añoFin: '', estatus: 'Titulado' }],
      },
    }));

    expect(res.status).toBe(200);
    const guardada = JSON.parse(mockCandidate.update.mock.calls[0][0].data.educacion);
    expect(guardada[0]).toMatchObject({ carrera: '', añoInicio: 2015, añoFin: null });
  });

  it('PERF-022: con educacion=null no inventa nivel ni estatus', async () => {
    mockUser.findUnique.mockResolvedValue(
      usuarioConCandidato({ educacion: null, universidad: 'CONALEP', carrera: 'Mecatrónica', nivelEstudios: null })
    );

    const res = await GET();
    const json = await res.json();

    const entrada = json.data.candidate.educacion[0];
    expect(entrada.institucion).toBe('CONALEP');
    expect(entrada.nivel).toBe('');
    expect(entrada.estatus).toBe('');
  });
});
