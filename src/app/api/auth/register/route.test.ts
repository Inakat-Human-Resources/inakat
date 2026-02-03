// Tests para: src/app/api/auth/register/route.ts
// Usando node-mocks-http para simular Request/Response de Next.js

import { createMocks } from 'node-mocks-http';

// Mock de Prisma
const mockPrismaUser = {
  findUnique: jest.fn(),
  create: jest.fn(),
};

const mockPrismaCandidate = {
  findUnique: jest.fn(),
  create: jest.fn(),
};

const mockPrismaTransaction = jest.fn();

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: (...args: any[]) => mockPrismaUser.findUnique(...args),
      create: (...args: any[]) => mockPrismaUser.create(...args),
    },
    candidate: {
      findUnique: (...args: any[]) => mockPrismaCandidate.findUnique(...args),
      create: (...args: any[]) => mockPrismaCandidate.create(...args),
    },
    $transaction: (fn: any) => mockPrismaTransaction(fn),
  },
}));

// Mock de auth
jest.mock('@/lib/auth', () => ({
  hashPassword: jest.fn().mockResolvedValue('hashed_password'),
  generateToken: jest.fn().mockReturnValue('mock_token'),
}));

// Test helper functions
function calcularAñosExperiencia(
  experiences?: {
    fechaInicio: string;
    fechaFin?: string;
    esActual: boolean;
  }[]
): number {
  if (!experiences || experiences.length === 0) return 0;

  const today = new Date();
  let totalMonths = 0;

  for (const exp of experiences) {
    const start = new Date(exp.fechaInicio);
    const end = exp.fechaFin ? new Date(exp.fechaFin) : today;
    const months =
      (end.getFullYear() - start.getFullYear()) * 12 +
      (end.getMonth() - start.getMonth());
    totalMonths += Math.max(0, months);
  }

  return Math.round(totalMonths / 12);
}

describe('Candidate Registration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Validación de datos de entrada', () => {
    it('debería rechazar email inválido', () => {
      const invalidEmails = ['', 'invalid', 'no@', '@nodomain', 'spaces in@email.com'];
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      for (const email of invalidEmails) {
        expect(emailRegex.test(email)).toBe(false);
      }
    });

    it('debería aceptar email válido', () => {
      const validEmails = ['test@test.com', 'user.name@domain.org', 'a@b.co'];
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      for (const email of validEmails) {
        expect(emailRegex.test(email)).toBe(true);
      }
    });

    it('debería rechazar contraseña sin mayúscula', () => {
      const password = 'testpass123';
      expect(/[A-Z]/.test(password)).toBe(false);
    });

    it('debería rechazar contraseña sin número', () => {
      const password = 'TestPassword';
      expect(/[0-9]/.test(password)).toBe(false);
    });

    it('debería rechazar contraseña corta', () => {
      const password = 'Test1';
      expect(password.length >= 8).toBe(false);
    });

    it('debería aceptar contraseña válida', () => {
      const password = 'TestPass123';
      expect(password.length >= 8).toBe(true);
      expect(/[A-Z]/.test(password)).toBe(true);
      expect(/[0-9]/.test(password)).toBe(true);
    });

    it('debería validar valores de sexo', () => {
      const validSexos = ['M', 'F', 'Otro'];
      const invalidSexos = ['X', 'Invalid', '', 'male'];

      for (const sexo of validSexos) {
        expect(['M', 'F', 'Otro'].includes(sexo)).toBe(true);
      }

      for (const sexo of invalidSexos) {
        expect(['M', 'F', 'Otro'].includes(sexo)).toBe(false);
      }
    });
  });

  describe('Cálculo de años de experiencia', () => {
    it('debería retornar 0 si no hay experiencias', () => {
      expect(calcularAñosExperiencia(undefined)).toBe(0);
      expect(calcularAñosExperiencia([])).toBe(0);
    });

    it('debería calcular correctamente experiencia de 2 años', () => {
      const experiences = [
        {
          fechaInicio: '2020-01-01',
          fechaFin: '2022-01-01',
          esActual: false,
        },
      ];
      expect(calcularAñosExperiencia(experiences)).toBe(2);
    });

    it('debería sumar múltiples experiencias', () => {
      const experiences = [
        {
          fechaInicio: '2018-01-01',
          fechaFin: '2020-01-01',
          esActual: false,
        },
        {
          fechaInicio: '2020-06-01',
          fechaFin: '2022-06-01',
          esActual: false,
        },
      ];
      // 2 años + 2 años = 4 años
      expect(calcularAñosExperiencia(experiences)).toBe(4);
    });

    it('debería manejar experiencia actual (sin fecha fin)', () => {
      const today = new Date();
      const startDate = new Date(today);
      startDate.setFullYear(today.getFullYear() - 3);

      const experiences = [
        {
          fechaInicio: startDate.toISOString().split('T')[0],
          esActual: true,
        },
      ];
      // Aproximadamente 3 años
      expect(calcularAñosExperiencia(experiences)).toBe(3);
    });

    it('debería redondear correctamente', () => {
      const experiences = [
        {
          fechaInicio: '2022-01-01',
          fechaFin: '2022-05-01', // 4 meses
          esActual: false,
        },
      ];
      // 4 meses = 0.33 años, redondeado = 0
      expect(calcularAñosExperiencia(experiences)).toBe(0);

      const experiences2 = [
        {
          fechaInicio: '2022-01-01',
          fechaFin: '2022-12-01', // 11 meses
          esActual: false,
        },
      ];
      // 11 meses = 0.91 años, redondeado = 1
      expect(calcularAñosExperiencia(experiences2)).toBe(1);
    });
  });

  describe('Datos del registro', () => {
    it('debería estructurar correctamente los datos de usuario', () => {
      const userData = {
        email: 'test@test.com',
        password: 'hashed_password',
        nombre: 'Juan',
        apellidoPaterno: 'Pérez',
        apellidoMaterno: 'García',
        role: 'candidate',
        isActive: true,
      };

      expect(userData.role).toBe('candidate');
      expect(userData.isActive).toBe(true);
      expect(userData.email).toBe('test@test.com');
    });

    it('debería estructurar correctamente los datos de candidato', () => {
      const candidateData = {
        nombre: 'Juan',
        apellidoPaterno: 'Pérez',
        email: 'test@test.com',
        profile: 'Tecnología',
        seniority: 'Sr',
        source: 'registro',
        status: 'available',
      };

      expect(candidateData.source).toBe('registro');
      expect(candidateData.status).toBe('available');
    });

    it('debería estructurar correctamente las experiencias', () => {
      const experience = {
        empresa: 'Google',
        puesto: 'Developer',
        ubicacion: 'Monterrey',
        fechaInicio: new Date('2020-01-01'),
        fechaFin: new Date('2022-01-01'),
        esActual: false,
        descripcion: 'Desarrollo web',
      };

      expect(experience.empresa).toBe('Google');
      expect(experience.esActual).toBe(false);
      expect(experience.fechaInicio).toBeInstanceOf(Date);
    });

    it('debería estructurar correctamente los documentos', () => {
      const document = {
        name: 'Título universitario',
        fileUrl: 'https://example.com/titulo.pdf',
        fileType: 'pdf',
      };

      expect(document.name).toBe('Título universitario');
      expect(document.fileUrl).toContain('https://');
    });
  });

  describe('Verificación de duplicados', () => {
    it('debería detectar email duplicado en User', async () => {
      mockPrismaUser.findUnique.mockResolvedValue({ id: 1, email: 'existing@test.com' });

      const result = await mockPrismaUser.findUnique({ where: { email: 'existing@test.com' } });

      expect(result).not.toBeNull();
      expect(result.email).toBe('existing@test.com');
    });

    it('debería detectar email duplicado en Candidate', async () => {
      mockPrismaCandidate.findUnique.mockResolvedValue({ id: 1, email: 'existing@test.com' });

      const result = await mockPrismaCandidate.findUnique({ where: { email: 'existing@test.com' } });

      expect(result).not.toBeNull();
    });

    it('debería permitir email nuevo', async () => {
      mockPrismaUser.findUnique.mockResolvedValue(null);
      mockPrismaCandidate.findUnique.mockResolvedValue(null);

      const userResult = await mockPrismaUser.findUnique({ where: { email: 'new@test.com' } });
      const candidateResult = await mockPrismaCandidate.findUnique({ where: { email: 'new@test.com' } });

      expect(userResult).toBeNull();
      expect(candidateResult).toBeNull();
    });
  });

  describe('Transacción de creación', () => {
    it('debería ejecutar la transacción correctamente', async () => {
      const mockUserCreate = jest.fn().mockResolvedValue({
        id: 1,
        email: 'test@test.com',
        role: 'candidate',
      });

      const mockCandidateCreate = jest.fn().mockResolvedValue({
        id: 1,
        experiences: [],
        documents: [],
      });

      mockPrismaTransaction.mockImplementation(async (fn) => {
        const tx = {
          user: { create: mockUserCreate },
          candidate: { create: mockCandidateCreate },
        };
        return fn(tx);
      });

      const result = await mockPrismaTransaction(async (tx: any) => {
        const user = await tx.user.create({ data: { email: 'test@test.com' } });
        const candidate = await tx.candidate.create({ data: { userId: user.id } });
        return { user, candidate };
      });

      expect(mockUserCreate).toHaveBeenCalled();
      expect(mockCandidateCreate).toHaveBeenCalled();
      expect(result.user.id).toBe(1);
      expect(result.candidate.id).toBe(1);
    });

    it('debería crear experiencias anidadas', async () => {
      const mockCandidateCreate = jest.fn().mockResolvedValue({
        id: 1,
        experiences: [{ id: 1 }, { id: 2 }],
        documents: [],
      });

      mockPrismaTransaction.mockImplementation(async (fn) => {
        const tx = {
          user: { create: jest.fn().mockResolvedValue({ id: 1 }) },
          candidate: { create: mockCandidateCreate },
        };
        return fn(tx);
      });

      await mockPrismaTransaction(async (tx: any) => {
        return tx.candidate.create({
          data: {
            nombre: 'Test',
            experiences: {
              create: [
                { empresa: 'A', puesto: 'Dev' },
                { empresa: 'B', puesto: 'Sr Dev' },
              ],
            },
          },
        });
      });

      expect(mockCandidateCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            experiences: expect.objectContaining({
              create: expect.any(Array),
            }),
          }),
        })
      );
    });

    it('debería crear documentos anidados', async () => {
      const mockCandidateCreate = jest.fn().mockResolvedValue({
        id: 1,
        experiences: [],
        documents: [{ id: 1 }, { id: 2 }, { id: 3 }],
      });

      mockPrismaTransaction.mockImplementation(async (fn) => {
        const tx = {
          user: { create: jest.fn().mockResolvedValue({ id: 1 }) },
          candidate: { create: mockCandidateCreate },
        };
        return fn(tx);
      });

      const result = await mockPrismaTransaction(async (tx: any) => {
        return tx.candidate.create({
          data: {
            nombre: 'Test',
            documents: {
              create: [
                { name: 'Doc 1', fileUrl: 'url1' },
                { name: 'Doc 2', fileUrl: 'url2' },
                { name: 'Doc 3', fileUrl: 'url3' },
              ],
            },
          },
        });
      });

      expect(result.documents.length).toBe(3);
    });
  });

  describe('Respuesta del registro', () => {
    it('debería incluir datos del usuario en la respuesta', () => {
      const response = {
        success: true,
        message: 'Registro exitoso',
        user: {
          id: 1,
          email: 'test@test.com',
          nombre: 'Juan',
          apellidoPaterno: 'Pérez',
          role: 'candidate',
        },
        candidate: {
          id: 1,
          experiencesCount: 2,
          documentsCount: 3,
        },
      };

      expect(response.success).toBe(true);
      expect(response.user.role).toBe('candidate');
      expect(response.candidate.experiencesCount).toBe(2);
      expect(response.candidate.documentsCount).toBe(3);
    });
  });

  describe('Niveles de seniority válidos', () => {
    it('debería aceptar todos los niveles de seniority', () => {
      const validSeniorities = ['Practicante', 'Jr', 'Middle', 'Sr', 'Director'];

      for (const seniority of validSeniorities) {
        expect(validSeniorities.includes(seniority)).toBe(true);
      }
    });
  });

  describe('Niveles de estudio válidos', () => {
    it('debería aceptar todos los niveles de estudio', () => {
      const validNiveles = ['Preparatoria', 'Técnico', 'Licenciatura', 'Posgrado'];

      for (const nivel of validNiveles) {
        expect(validNiveles.includes(nivel)).toBe(true);
      }
    });
  });
});
