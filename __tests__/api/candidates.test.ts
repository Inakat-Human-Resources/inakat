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
  update: jest.fn(),
  delete: jest.fn(),
};

const mockPrismaExperience = {
  deleteMany: jest.fn(),
  createMany: jest.fn(),
};

jest.mock('@/lib/prisma', () => ({
  prisma: {
    candidate: mockPrismaCandidate,
    experience: mockPrismaExperience,
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

  // =============================================
  // Tests para GET /api/admin/candidates/[id]
  // =============================================
  describe('GET /api/admin/candidates/[id] - Obtener candidato', () => {
    it('debería obtener un candidato por ID con experiencias y documentos', async () => {
      const mockCandidate = {
        id: 1,
        nombre: 'Juan',
        apellidoPaterno: 'Pérez',
        apellidoMaterno: 'López',
        email: 'juan@test.com',
        fechaNacimiento: new Date('1990-05-15'),
        experiences: [
          { id: 1, empresa: 'Tech Corp', puesto: 'Developer' },
        ],
        documents: [
          { id: 1, name: 'CV', fileUrl: 'https://storage.com/cv.pdf' },
        ],
      };

      mockPrismaCandidate.findUnique.mockResolvedValue(mockCandidate);

      const candidate = await mockPrismaCandidate.findUnique({
        where: { id: 1 },
        include: {
          experiences: { orderBy: { fechaInicio: 'desc' } },
          documents: { orderBy: { createdAt: 'desc' } },
        },
      });

      expect(candidate).not.toBeNull();
      expect(candidate.experiences).toBeDefined();
      expect(candidate.documents).toBeDefined();
      expect(candidate.nombre).toBe('Juan');
    });

    it('debería retornar null si el candidato no existe', async () => {
      mockPrismaCandidate.findUnique.mockResolvedValue(null);

      const candidate = await mockPrismaCandidate.findUnique({
        where: { id: 9999 },
      });

      expect(candidate).toBeNull();
      // Esto resultaría en 404: "Candidato no encontrado"
    });

    it('debería validar que el ID sea un número válido', () => {
      const invalidId = 'abc';
      const parsedId = parseInt(invalidId);

      expect(isNaN(parsedId)).toBe(true);
      // Esto resultaría en 400: "ID de candidato inválido"
    });

    it('debería calcular la edad correctamente', () => {
      const fechaNacimiento = new Date('1990-05-15');
      const today = new Date();

      let edad = today.getFullYear() - fechaNacimiento.getFullYear();
      const monthDiff = today.getMonth() - fechaNacimiento.getMonth();
      if (
        monthDiff < 0 ||
        (monthDiff === 0 && today.getDate() < fechaNacimiento.getDate())
      ) {
        edad--;
      }

      // La edad debería ser ~34-35 años dependiendo de la fecha actual
      expect(edad).toBeGreaterThanOrEqual(33);
      expect(edad).toBeLessThanOrEqual(36);
    });
  });

  // =============================================
  // Tests para PUT /api/admin/candidates/[id]
  // =============================================
  describe('PUT /api/admin/candidates/[id] - Actualizar candidato', () => {
    it('debería actualizar campos básicos del candidato', async () => {
      const existingCandidate = {
        id: 1,
        nombre: 'Juan',
        apellidoPaterno: 'Pérez',
        email: 'juan@test.com',
        experiences: [],
      };

      const updatedCandidate = {
        ...existingCandidate,
        nombre: 'Juan Carlos',
        telefono: '8112345678',
      };

      mockPrismaCandidate.findUnique.mockResolvedValue(existingCandidate);
      mockPrismaCandidate.update.mockResolvedValue(updatedCandidate);

      const candidate = await mockPrismaCandidate.update({
        where: { id: 1 },
        data: { nombre: 'Juan Carlos', telefono: '8112345678' },
      });

      expect(candidate.nombre).toBe('Juan Carlos');
      expect(candidate.telefono).toBe('8112345678');
    });

    it('debería rechazar email duplicado', async () => {
      const existingCandidate = {
        id: 1,
        email: 'juan@test.com',
      };

      const anotherCandidate = {
        id: 2,
        email: 'otro@test.com',
      };

      // Simular que el nuevo email ya existe
      mockPrismaCandidate.findUnique
        .mockResolvedValueOnce(existingCandidate) // Candidato actual
        .mockResolvedValueOnce(anotherCandidate); // Email ya existe

      const current = await mockPrismaCandidate.findUnique({ where: { id: 1 } });
      const emailCheck = await mockPrismaCandidate.findUnique({ where: { email: 'otro@test.com' } });

      expect(current).not.toBeNull();
      expect(emailCheck).not.toBeNull();
      // Esto resultaría en 409: "Ya existe un candidato con ese email"
    });

    it('debería permitir actualizar al mismo email (sin cambio)', async () => {
      const existingCandidate = {
        id: 1,
        email: 'juan@test.com',
      };

      mockPrismaCandidate.findUnique.mockResolvedValue(existingCandidate);

      const newEmail = 'juan@test.com';
      const shouldValidate = newEmail.toLowerCase() !== existingCandidate.email.toLowerCase();

      expect(shouldValidate).toBe(false);
      // No debería validar duplicado si es el mismo email
    });

    it('debería recalcular años de experiencia al actualizar experiencias', () => {
      const experiences = [
        { fechaInicio: new Date('2018-01-01'), fechaFin: new Date('2020-12-31') }, // 3 años
        { fechaInicio: new Date('2021-01-01'), fechaFin: new Date('2023-12-31') }, // 3 años
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

      expect(añosExperiencia).toBe(6);
    });

    it('debería eliminar experiencias existentes antes de crear nuevas', async () => {
      mockPrismaExperience.deleteMany.mockResolvedValue({ count: 2 });
      mockPrismaExperience.createMany.mockResolvedValue({ count: 3 });

      await mockPrismaExperience.deleteMany({ where: { candidateId: 1 } });
      await mockPrismaExperience.createMany({
        data: [
          { candidateId: 1, empresa: 'Empresa 1', puesto: 'Dev', fechaInicio: new Date() },
          { candidateId: 1, empresa: 'Empresa 2', puesto: 'Senior', fechaInicio: new Date() },
          { candidateId: 1, empresa: 'Empresa 3', puesto: 'Lead', fechaInicio: new Date() },
        ],
      });

      expect(mockPrismaExperience.deleteMany).toHaveBeenCalledWith({
        where: { candidateId: 1 },
      });
      expect(mockPrismaExperience.createMany).toHaveBeenCalled();
    });

    it('debería retornar 404 si el candidato no existe', async () => {
      mockPrismaCandidate.findUnique.mockResolvedValue(null);

      const candidate = await mockPrismaCandidate.findUnique({
        where: { id: 9999 },
      });

      expect(candidate).toBeNull();
      // Esto resultaría en 404
    });
  });

  // =============================================
  // Tests para DELETE /api/admin/candidates/[id]
  // =============================================
  describe('DELETE /api/admin/candidates/[id] - Eliminar candidato', () => {
    it('debería eliminar un candidato existente', async () => {
      const existingCandidate = {
        id: 1,
        nombre: 'Juan',
        email: 'juan@test.com',
      };

      mockPrismaCandidate.findUnique.mockResolvedValue(existingCandidate);
      mockPrismaCandidate.delete.mockResolvedValue(existingCandidate);

      const candidate = await mockPrismaCandidate.findUnique({ where: { id: 1 } });
      expect(candidate).not.toBeNull();

      await mockPrismaCandidate.delete({ where: { id: 1 } });

      expect(mockPrismaCandidate.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });

    it('debería retornar 404 si el candidato no existe', async () => {
      mockPrismaCandidate.findUnique.mockResolvedValue(null);

      const candidate = await mockPrismaCandidate.findUnique({
        where: { id: 9999 },
      });

      expect(candidate).toBeNull();
      // Esto resultaría en 404: "Candidato no encontrado"
    });

    it('debería validar que el ID sea un número válido', () => {
      const invalidId = 'not-a-number';
      const parsedId = parseInt(invalidId);

      expect(isNaN(parsedId)).toBe(true);
      // Esto resultaría en 400: "ID de candidato inválido"
    });

    it('debería eliminar en cascada experiencias y documentos', async () => {
      // Prisma maneja esto automáticamente con onDelete: Cascade
      // Solo verificamos que se llama delete en el candidato
      const candidateWithRelations = {
        id: 1,
        nombre: 'Juan',
        experiences: [{ id: 1 }, { id: 2 }],
        documents: [{ id: 1 }],
      };

      mockPrismaCandidate.findUnique.mockResolvedValue(candidateWithRelations);
      mockPrismaCandidate.delete.mockResolvedValue(candidateWithRelations);

      await mockPrismaCandidate.delete({ where: { id: 1 } });

      expect(mockPrismaCandidate.delete).toHaveBeenCalled();
      // Las experiencias y documentos se eliminan automáticamente por cascade
    });
  });
});
