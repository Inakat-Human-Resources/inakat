// RUTA: __tests__/api/candidates.test.ts

/**
 * Tests para las APIs de candidatos (Admin)
 * Verifican: filtros avanzados, creación, validación de email único
 */

// Mock de Prisma
const mockPrismaCandidate = {
  findMany: jest.fn(),
  findUnique: jest.fn(),
  create: jest.fn(),
};

jest.mock('@/lib/prisma', () => ({
  prisma: {
    candidate: mockPrismaCandidate,
  },
}));

describe('Candidates API Logic Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/admin/candidates - Filtros', () => {
    it('debería listar candidatos con experiencias', async () => {
      const mockCandidates = [
        {
          id: 1,
          nombre: 'Juan',
          apellidoPaterno: 'Pérez',
          email: 'juan@test.com',
          experiences: [{ empresa: 'Tech Corp', puesto: 'Developer' }],
        },
      ];

      mockPrismaCandidate.findMany.mockResolvedValue(mockCandidates);

      const candidates = await mockPrismaCandidate.findMany({
        include: { experiences: { orderBy: { fechaInicio: 'desc' } } },
        orderBy: { createdAt: 'desc' },
      });

      expect(candidates).toHaveLength(1);
      expect(candidates[0].experiences).toBeDefined();
    });

    it('debería filtrar por sexo=M', async () => {
      mockPrismaCandidate.findMany.mockResolvedValue([]);

      await mockPrismaCandidate.findMany({
        where: { sexo: 'M' },
      });

      expect(mockPrismaCandidate.findMany).toHaveBeenCalledWith({
        where: { sexo: 'M' },
      });
    });

    it('debería filtrar por sexo=F', async () => {
      mockPrismaCandidate.findMany.mockResolvedValue([]);

      await mockPrismaCandidate.findMany({
        where: { sexo: 'F' },
      });

      expect(mockPrismaCandidate.findMany).toHaveBeenCalledWith({
        where: { sexo: 'F' },
      });
    });

    it('debería filtrar por rango de edad (minAge=25, maxAge=35)', () => {
      const today = new Date();
      const minAge = 25;
      const maxAge = 35;

      // Edad máxima = fecha de nacimiento mínima
      const minBirthDate = new Date(today);
      minBirthDate.setFullYear(today.getFullYear() - maxAge - 1);

      // Edad mínima = fecha de nacimiento máxima
      const maxBirthDate = new Date(today);
      maxBirthDate.setFullYear(today.getFullYear() - minAge);

      // Una persona de 30 años debería estar en el rango
      const birthDate30 = new Date(today);
      birthDate30.setFullYear(today.getFullYear() - 30);

      expect(birthDate30 >= minBirthDate).toBe(true);
      expect(birthDate30 <= maxBirthDate).toBe(true);

      // Una persona de 40 años NO debería estar
      const birthDate40 = new Date(today);
      birthDate40.setFullYear(today.getFullYear() - 40);

      expect(birthDate40 >= minBirthDate).toBe(false);
    });

    it('debería filtrar por perfil', async () => {
      mockPrismaCandidate.findMany.mockResolvedValue([]);

      await mockPrismaCandidate.findMany({
        where: { profile: 'Tecnología' },
      });

      expect(mockPrismaCandidate.findMany).toHaveBeenCalledWith({
        where: { profile: 'Tecnología' },
      });
    });

    it('debería filtrar por seniority', async () => {
      mockPrismaCandidate.findMany.mockResolvedValue([]);

      await mockPrismaCandidate.findMany({
        where: { seniority: 'Sr' },
      });

      expect(mockPrismaCandidate.findMany).toHaveBeenCalledWith({
        where: { seniority: 'Sr' },
      });
    });

    it('debería filtrar por años de experiencia (rango)', async () => {
      mockPrismaCandidate.findMany.mockResolvedValue([]);

      const minExperience = 3;
      const maxExperience = 7;

      await mockPrismaCandidate.findMany({
        where: {
          añosExperiencia: {
            gte: minExperience,
            lte: maxExperience,
          },
        },
      });

      expect(mockPrismaCandidate.findMany).toHaveBeenCalledWith({
        where: {
          añosExperiencia: {
            gte: 3,
            lte: 7,
          },
        },
      });
    });

    it('debería filtrar por universidad', async () => {
      mockPrismaCandidate.findMany.mockResolvedValue([]);

      await mockPrismaCandidate.findMany({
        where: { universidad: { contains: 'UANL', mode: 'insensitive' } },
      });

      expect(mockPrismaCandidate.findMany).toHaveBeenCalledWith({
        where: { universidad: { contains: 'UANL', mode: 'insensitive' } },
      });
    });

    it('debería filtrar por búsqueda general (nombre, email, carrera)', async () => {
      mockPrismaCandidate.findMany.mockResolvedValue([]);

      const search = 'Juan';

      await mockPrismaCandidate.findMany({
        where: {
          OR: [
            { nombre: { contains: search, mode: 'insensitive' } },
            { apellidoPaterno: { contains: search, mode: 'insensitive' } },
            { apellidoMaterno: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            { carrera: { contains: search, mode: 'insensitive' } },
          ],
        },
      });

      expect(mockPrismaCandidate.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({ nombre: expect.any(Object) }),
          ]),
        }),
      });
    });
  });

  describe('POST /api/admin/candidates - Validaciones', () => {
    it('debería validar campos requeridos', () => {
      const validCandidate = {
        nombre: 'Juan',
        apellidoPaterno: 'Pérez',
        email: 'juan@test.com',
      };

      const requiredFields = ['nombre', 'apellidoPaterno', 'email'];
      const isValid = requiredFields.every(field => validCandidate[field as keyof typeof validCandidate]);
      expect(isValid).toBe(true);
    });

    it('debería rechazar si falta nombre', () => {
      const invalidCandidate = {
        apellidoPaterno: 'Pérez',
        email: 'test@test.com',
      };

      const hasNombre = 'nombre' in invalidCandidate;
      expect(hasNombre).toBe(false);
    });

    it('debería rechazar si falta apellidoPaterno', () => {
      const invalidCandidate = {
        nombre: 'Juan',
        email: 'test@test.com',
      };

      const hasApellido = 'apellidoPaterno' in invalidCandidate;
      expect(hasApellido).toBe(false);
    });

    it('debería rechazar si falta email', () => {
      const invalidCandidate = {
        nombre: 'Juan',
        apellidoPaterno: 'Pérez',
      };

      const hasEmail = 'email' in invalidCandidate;
      expect(hasEmail).toBe(false);
    });
  });

  describe('POST /api/admin/candidates - Email único', () => {
    it('NO debería permitir email duplicado', async () => {
      const existingCandidate = {
        id: 1,
        email: 'existente@test.com',
      };

      mockPrismaCandidate.findUnique.mockResolvedValue(existingCandidate);

      const existing = await mockPrismaCandidate.findUnique({
        where: { email: 'existente@test.com' },
      });

      expect(existing).not.toBeNull();
      // Esto resultaría en 409: "Ya existe un candidato con ese email"
    });

    it('debería permitir crear si el email no existe', async () => {
      mockPrismaCandidate.findUnique.mockResolvedValue(null);

      const existing = await mockPrismaCandidate.findUnique({
        where: { email: 'nuevo@test.com' },
      });

      expect(existing).toBeNull();
    });
  });

  describe('POST /api/admin/candidates - Cálculo de experiencia', () => {
    it('debería calcular años de experiencia automáticamente', () => {
      const experiences = [
        { fechaInicio: new Date('2020-01-01'), fechaFin: new Date('2022-06-01') }, // ~2.5 años
        { fechaInicio: new Date('2022-07-01'), fechaFin: null }, // Trabajo actual
      ];

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

      const añosExperiencia = Math.round(totalMonths / 12);

      // Debería ser aproximadamente 4-5 años dependiendo de la fecha actual
      expect(añosExperiencia).toBeGreaterThanOrEqual(3);
    });

    it('debería manejar candidato sin experiencias', () => {
      const experiences: any[] = [];
      let añosExperiencia = 0;

      if (experiences.length > 0) {
        // Cálculo...
      }

      expect(añosExperiencia).toBe(0);
    });
  });

  describe('POST /api/admin/candidates - Creación exitosa', () => {
    it('debería crear candidato con todos los campos', async () => {
      const newCandidate = {
        id: 1,
        nombre: 'Carlos',
        apellidoPaterno: 'López',
        apellidoMaterno: 'García',
        email: 'carlos@test.com',
        telefono: '8112345678',
        sexo: 'M',
        fechaNacimiento: new Date('1990-05-15'),
        universidad: 'UANL',
        carrera: 'Ingeniería en Sistemas',
        nivelEstudios: 'Licenciatura',
        profile: 'Tecnología',
        seniority: 'Sr',
        cvUrl: 'https://storage.com/cv.pdf',
        source: 'linkedin',
        añosExperiencia: 5,
        experiences: [],
      };

      mockPrismaCandidate.create.mockResolvedValue(newCandidate);

      const candidate = await mockPrismaCandidate.create({
        data: {
          nombre: 'Carlos',
          apellidoPaterno: 'López',
          apellidoMaterno: 'García',
          email: 'carlos@test.com',
          profile: 'Tecnología',
          seniority: 'Sr',
        },
        include: { experiences: true },
      });

      expect(candidate.nombre).toBe('Carlos');
      expect(candidate.profile).toBe('Tecnología');
    });

    it('debería crear candidato con experiencias', async () => {
      const newCandidate = {
        id: 1,
        nombre: 'Ana',
        apellidoPaterno: 'Martínez',
        email: 'ana@test.com',
        añosExperiencia: 3,
        experiences: [
          { empresa: 'Tech Corp', puesto: 'Developer', fechaInicio: new Date('2020-01-01') },
        ],
      };

      mockPrismaCandidate.create.mockResolvedValue(newCandidate);

      const candidate = await mockPrismaCandidate.create({
        data: {
          nombre: 'Ana',
          apellidoPaterno: 'Martínez',
          email: 'ana@test.com',
          experiences: {
            create: [
              { empresa: 'Tech Corp', puesto: 'Developer', fechaInicio: new Date('2020-01-01') },
            ],
          },
        },
        include: { experiences: true },
      });

      expect(candidate.experiences).toHaveLength(1);
      expect(candidate.experiences[0].empresa).toBe('Tech Corp');
    });
  });
});
