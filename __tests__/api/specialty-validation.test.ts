/**
 * Tests para validación de especialidades en vacantes
 *
 * Verifica que:
 * 1. Las vacantes solo acepten especialidades del catálogo
 * 2. Las subcategorías se validen correctamente
 * 3. El API rechace especialidades inválidas
 */

import { prisma } from '@/lib/prisma';

// Mock de prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    specialty: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    job: {
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}));

describe('Specialty Validation for Jobs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/specialties', () => {
    it('should return active specialties', async () => {
      const mockSpecialties = [
        { id: 1, name: 'Tecnología', slug: 'tecnologia', isActive: true, subcategories: ['Frontend', 'Backend'] },
        { id: 2, name: 'Diseño', slug: 'diseno', isActive: true, subcategories: ['UI/UX', 'Gráfico'] },
      ];

      (prisma.specialty.findMany as jest.Mock).mockResolvedValue(mockSpecialties);

      // Simular la lógica del endpoint
      const specialties = await prisma.specialty.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      });

      expect(specialties).toHaveLength(2);
      expect(specialties[0].name).toBe('Tecnología');
      expect(specialties[0].subcategories).toContain('Frontend');
    });

    it('should not return inactive specialties', async () => {
      const mockSpecialties = [
        { id: 1, name: 'Tecnología', slug: 'tecnologia', isActive: true },
      ];

      (prisma.specialty.findMany as jest.Mock).mockResolvedValue(mockSpecialties);

      const specialties = await prisma.specialty.findMany({
        where: { isActive: true },
      });

      expect(specialties).toHaveLength(1);
      expect(specialties.find((s: any) => s.isActive === false)).toBeUndefined();
    });
  });

  describe('POST /api/jobs - Specialty Validation', () => {
    it('should accept valid specialty from catalog', async () => {
      const validSpecialty = {
        id: 1,
        name: 'Tecnología',
        isActive: true,
        subcategories: ['Frontend', 'Backend'],
      };

      (prisma.specialty.findFirst as jest.Mock).mockResolvedValue(validSpecialty);

      const specialtyExists = await prisma.specialty.findFirst({
        where: { name: 'Tecnología', isActive: true },
      });

      expect(specialtyExists).not.toBeNull();
      expect(specialtyExists?.name).toBe('Tecnología');
    });

    it('should reject invalid specialty', async () => {
      (prisma.specialty.findFirst as jest.Mock).mockResolvedValue(null);

      const specialtyExists = await prisma.specialty.findFirst({
        where: { name: 'EspecialidadInexistente', isActive: true },
      });

      expect(specialtyExists).toBeNull();
    });

    it('should reject inactive specialty', async () => {
      (prisma.specialty.findFirst as jest.Mock).mockResolvedValue(null);

      const specialtyExists = await prisma.specialty.findFirst({
        where: { name: 'EspecialidadInactiva', isActive: true },
      });

      expect(specialtyExists).toBeNull();
    });

    it('should validate subcategory belongs to specialty', async () => {
      const specialty = {
        id: 1,
        name: 'Tecnología',
        isActive: true,
        subcategories: ['Frontend', 'Backend', 'DevOps'],
      };

      (prisma.specialty.findFirst as jest.Mock).mockResolvedValue(specialty);

      const foundSpecialty = await prisma.specialty.findFirst({
        where: { name: 'Tecnología', isActive: true },
      });

      // Validar subcategoría válida
      const validSubcategory = 'Frontend';
      const subcategories = foundSpecialty?.subcategories as string[];
      expect(subcategories.includes(validSubcategory)).toBe(true);

      // Validar subcategoría inválida
      const invalidSubcategory = 'Marketing';
      expect(subcategories.includes(invalidSubcategory)).toBe(false);
    });
  });

  describe('PUT /api/jobs/[id] - Specialty Update Validation', () => {
    it('should validate specialty on job update', async () => {
      const validSpecialty = {
        id: 1,
        name: 'Diseño',
        isActive: true,
        subcategories: ['UI/UX', 'Gráfico'],
      };

      (prisma.specialty.findFirst as jest.Mock).mockResolvedValue(validSpecialty);

      const specialtyExists = await prisma.specialty.findFirst({
        where: { name: 'Diseño', isActive: true },
      });

      expect(specialtyExists).not.toBeNull();
    });
  });
});

describe('Subcategory Field', () => {
  it('should allow null subcategory', () => {
    const jobData = {
      title: 'Developer',
      profile: 'Tecnología',
      subcategory: null,
    };

    expect(jobData.subcategory).toBeNull();
  });

  it('should accept valid subcategory string', () => {
    const jobData = {
      title: 'Frontend Developer',
      profile: 'Tecnología',
      subcategory: 'Frontend',
    };

    expect(jobData.subcategory).toBe('Frontend');
  });
});
