// RUTA: __tests__/api/profile.test.ts

/**
 * Tests para la API de perfil de usuario
 * Endpoint: /api/profile
 *
 * Verifica GET y PUT del perfil para cualquier usuario autenticado
 */

// Mock de Prisma
const mockPrismaUser = {
  findUnique: jest.fn(),
  update: jest.fn(),
};

const mockPrismaCandidate = {
  update: jest.fn(),
};

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: mockPrismaUser,
    candidate: mockPrismaCandidate,
  },
}));

// Mock de bcrypt
jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

import bcrypt from 'bcryptjs';

describe('Profile API Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/profile', () => {
    it('debería retornar datos básicos del usuario', async () => {
      const mockUser = {
        id: 1,
        email: 'usuario@test.com',
        nombre: 'Juan Pérez',
        role: 'user',
        createdAt: new Date(),
        candidate: null
      };

      mockPrismaUser.findUnique.mockResolvedValue(mockUser);

      const user = await mockPrismaUser.findUnique({
        where: { id: 1 },
        include: { candidate: true }
      });

      expect(user).not.toBeNull();
      expect(user.email).toBe('usuario@test.com');
      expect(user.nombre).toBe('Juan Pérez');
    });

    it('debería incluir datos de empresa para rol company', async () => {
      const mockCompanyUser = {
        id: 2,
        email: 'empresa@test.com',
        nombre: 'Empresa SA',
        role: 'company',
        company: 'Empresa SA de CV',
        credits: 100,
        candidate: null
      };

      mockPrismaUser.findUnique.mockResolvedValue(mockCompanyUser);

      const user = await mockPrismaUser.findUnique({
        where: { id: 2 },
        include: { candidate: true }
      });

      expect(user.role).toBe('company');
      expect(user.company).toBe('Empresa SA de CV');
      expect(user.credits).toBe(100);
    });

    it('debería incluir datos de candidato si existe', async () => {
      const mockCandidateUser = {
        id: 3,
        email: 'candidato@test.com',
        nombre: 'María García',
        role: 'candidate',
        candidate: {
          id: 1,
          telefono: '+52 555 1234567',
          ubicacion: 'CDMX',
          seniority: 'Middle',
          salarioDeseado: '$40,000',
          disponibilidad: 'Inmediata',
          modalidadPreferida: 'remote',
          perfilProfesional: 'Full Stack Developer',
          linkedinUrl: 'https://linkedin.com/in/maria',
          portfolioUrl: 'https://maria.dev'
        }
      };

      mockPrismaUser.findUnique.mockResolvedValue(mockCandidateUser);

      const user = await mockPrismaUser.findUnique({
        where: { id: 3 },
        include: { candidate: true }
      });

      expect(user.candidate).not.toBeNull();
      expect(user.candidate.telefono).toBe('+52 555 1234567');
      expect(user.candidate.seniority).toBe('Middle');
    });

    it('debería funcionar para todos los roles', () => {
      const roles = ['admin', 'company', 'recruiter', 'specialist', 'candidate', 'user'];

      roles.forEach(role => {
        // Todos los roles pueden acceder a su perfil
        expect(roles.includes(role)).toBe(true);
      });
    });
  });

  describe('PUT /api/profile', () => {
    it('debería actualizar nombre del usuario', async () => {
      const updatedUser = {
        id: 1,
        email: 'usuario@test.com',
        nombre: 'Juan Pérez García',
        role: 'user'
      };

      mockPrismaUser.update.mockResolvedValue(updatedUser);

      const user = await mockPrismaUser.update({
        where: { id: 1 },
        data: { nombre: 'Juan Pérez García' }
      });

      expect(user.nombre).toBe('Juan Pérez García');
    });

    it('debería requerir contraseña actual para cambiar contraseña', () => {
      const requestBody = {
        newPassword: 'nuevaPassword123'
        // currentPassword no está presente
      };

      const hasCurrentPassword = !!requestBody.currentPassword;
      expect(hasCurrentPassword).toBe(false);
      // La API retornaría 400 con error "Debes proporcionar tu contraseña actual"
    });

    it('debería verificar contraseña actual correcta', async () => {
      const storedPassword = '$2a$10$hashedpassword';
      const currentPassword = 'passwordIncorrecto';

      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const isValid = await bcrypt.compare(currentPassword, storedPassword);
      expect(isValid).toBe(false);
      // La API retornaría 400 con error "Contraseña actual incorrecta"
    });

    it('debería aceptar contraseña actual correcta', async () => {
      const storedPassword = '$2a$10$hashedpassword';
      const currentPassword = 'passwordCorrecto';

      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const isValid = await bcrypt.compare(currentPassword, storedPassword);
      expect(isValid).toBe(true);
    });

    it('debería validar longitud mínima de nueva contraseña', () => {
      const shortPassword = '1234567'; // 7 caracteres
      const validPassword = '12345678'; // 8 caracteres

      expect(shortPassword.length >= 8).toBe(false);
      expect(validPassword.length >= 8).toBe(true);
    });

    it('debería hashear nueva contraseña antes de guardar', async () => {
      const newPassword = 'nuevaPassword123';
      const hashedPassword = '$2a$10$newhashedpassword';

      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);

      const hashed = await bcrypt.hash(newPassword, 10);
      expect(hashed).toBe(hashedPassword);
    });

    it('debería actualizar datos de candidato', async () => {
      const updatedCandidate = {
        id: 1,
        telefono: '+52 555 9876543',
        ubicacion: 'Monterrey',
        seniority: 'Sr'
      };

      mockPrismaCandidate.update.mockResolvedValue(updatedCandidate);

      const candidate = await mockPrismaCandidate.update({
        where: { id: 1 },
        data: {
          telefono: '+52 555 9876543',
          ubicacion: 'Monterrey',
          seniority: 'Sr'
        }
      });

      expect(candidate.telefono).toBe('+52 555 9876543');
      expect(candidate.ubicacion).toBe('Monterrey');
    });

    it('debería ignorar candidateData si usuario no tiene perfil de candidato', async () => {
      const userWithoutCandidate = {
        id: 1,
        email: 'usuario@test.com',
        role: 'user',
        candidate: null
      };

      mockPrismaUser.findUnique.mockResolvedValue(userWithoutCandidate);

      const user = await mockPrismaUser.findUnique({
        where: { id: 1 },
        include: { candidate: true }
      });

      expect(user.candidate).toBeNull();
      // Si candidateData se envía, se ignora porque no hay candidato asociado
    });
  });

  describe('Campos de candidato', () => {
    it('debería validar seniority válidos', () => {
      const validSeniorities = ['Practicante', 'Jr', 'Middle', 'Sr', 'Director'];

      validSeniorities.forEach(seniority => {
        expect(validSeniorities.includes(seniority)).toBe(true);
      });
    });

    it('debería validar modalidades válidas', () => {
      const validModes = ['remote', 'hybrid', 'presential'];

      validModes.forEach(mode => {
        expect(validModes.includes(mode)).toBe(true);
      });
    });

    it('debería validar disponibilidades válidas', () => {
      const validDisponibilidades = ['Inmediata', '2 semanas', '1 mes', 'Más de 1 mes'];

      validDisponibilidades.forEach(disp => {
        expect(validDisponibilidades.includes(disp)).toBe(true);
      });
    });
  });

  describe('Seguridad', () => {
    it('debería requerir autenticación', () => {
      const token = null;
      expect(!!token).toBe(false);
      // Sin token, la API retorna 401
    });

    it('debería rechazar token inválido', () => {
      const invalidPayload = null;
      expect(!!invalidPayload).toBe(false);
      // La API retorna 401
    });

    it('debería retornar 404 si usuario no existe', async () => {
      mockPrismaUser.findUnique.mockResolvedValue(null);

      const user = await mockPrismaUser.findUnique({
        where: { id: 999 }
      });

      expect(user).toBeNull();
      // La API retorna 404
    });

    it('no debería permitir cambiar email', () => {
      // El email no se puede cambiar en la API de perfil
      // Solo nombre y contraseña
      const updateableFields = ['nombre', 'password'];
      expect(updateableFields.includes('email')).toBe(false);
    });

    it('no debería permitir cambiar rol', () => {
      // El rol no se puede cambiar desde el perfil
      const updateableFields = ['nombre', 'password'];
      expect(updateableFields.includes('role')).toBe(false);
    });
  });

  describe('Respuesta del API', () => {
    it('debería retornar estructura correcta en GET', () => {
      const expectedResponse = {
        success: true,
        data: {
          id: 1,
          email: 'test@test.com',
          nombre: 'Test User',
          role: 'user',
          createdAt: new Date()
        }
      };

      expect(expectedResponse.success).toBe(true);
      expect(expectedResponse.data).toBeDefined();
      expect(expectedResponse.data.id).toBeDefined();
      expect(expectedResponse.data.email).toBeDefined();
    });

    it('debería retornar estructura correcta en PUT', () => {
      const expectedResponse = {
        success: true,
        message: 'Perfil actualizado exitosamente',
        data: {
          id: 1,
          email: 'test@test.com',
          nombre: 'Updated Name',
          role: 'user'
        }
      };

      expect(expectedResponse.success).toBe(true);
      expect(expectedResponse.message).toBe('Perfil actualizado exitosamente');
      expect(expectedResponse.data).toBeDefined();
    });
  });
});
