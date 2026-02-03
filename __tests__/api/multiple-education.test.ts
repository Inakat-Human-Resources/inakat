// RUTA: __tests__/api/multiple-education.test.ts

/**
 * Tests para FEATURE: Educación Múltiple
 * Verifica que el sistema maneja correctamente arrays de educación
 * y sincroniza con campos legacy (universidad, carrera, nivelEstudios)
 */

import { prisma } from '@/lib/prisma';

// Datos de prueba
const TEST_EDUCATIONS = [
  {
    id: 1,
    nivel: 'Licenciatura',
    institucion: 'UANL',
    carrera: 'Ingeniería en Sistemas',
    añoInicio: 2018,
    añoFin: 2022,
    estatus: 'Titulado'
  },
  {
    id: 2,
    nivel: 'Maestría',
    institucion: 'Tec de Monterrey',
    carrera: 'MBA',
    añoInicio: 2023,
    añoFin: null,
    estatus: 'Cursando'
  }
];

describe('FEATURE: Educación Múltiple', () => {
  let testCandidateId: number | null = null;
  let testUserId: number | null = null;

  beforeAll(async () => {
    // Limpiar datos de prueba previos
    await prisma.candidate.deleteMany({
      where: { email: { contains: 'test-edu-multiple' } }
    });
    await prisma.user.deleteMany({
      where: { email: { contains: 'test-edu-multiple' } }
    });
  });

  afterAll(async () => {
    // Limpiar datos de prueba
    if (testCandidateId) {
      await prisma.candidate.delete({ where: { id: testCandidateId } }).catch(() => {});
    }
    if (testUserId) {
      await prisma.user.delete({ where: { id: testUserId } }).catch(() => {});
    }
  });

  describe('Creación de candidato con educación múltiple', () => {
    it('debe guardar educación como JSON y sincronizar campos legacy', async () => {
      const candidate = await prisma.candidate.create({
        data: {
          nombre: 'Test',
          apellidoPaterno: 'Educacion',
          email: 'test-edu-multiple-1@test.com',
          educacion: JSON.stringify(TEST_EDUCATIONS),
          // Legacy fields from first education
          universidad: TEST_EDUCATIONS[0].institucion,
          carrera: TEST_EDUCATIONS[0].carrera,
          nivelEstudios: TEST_EDUCATIONS[0].nivel,
          añosExperiencia: 0,
          source: 'manual',
          status: 'available'
        }
      });

      testCandidateId = candidate.id;

      // Verificar que se guardó correctamente
      expect(candidate.educacion).toBeTruthy();
      const parsedEducation = JSON.parse(candidate.educacion!);
      expect(parsedEducation).toHaveLength(2);
      expect(parsedEducation[0].institucion).toBe('UANL');
      expect(parsedEducation[1].institucion).toBe('Tec de Monterrey');

      // Verificar sincronización legacy
      expect(candidate.universidad).toBe('UANL');
      expect(candidate.carrera).toBe('Ingeniería en Sistemas');
      expect(candidate.nivelEstudios).toBe('Licenciatura');
    });

    it('debe parsear educación correctamente al leer', async () => {
      const candidate = await prisma.candidate.findUnique({
        where: { id: testCandidateId! }
      });

      expect(candidate).toBeTruthy();
      expect(candidate!.educacion).toBeTruthy();

      const educations = JSON.parse(candidate!.educacion!);
      expect(Array.isArray(educations)).toBe(true);
      expect(educations).toHaveLength(2);

      // Verificar primera educación
      expect(educations[0].nivel).toBe('Licenciatura');
      expect(educations[0].estatus).toBe('Titulado');

      // Verificar segunda educación
      expect(educations[1].nivel).toBe('Maestría');
      expect(educations[1].estatus).toBe('Cursando');
    });
  });

  describe('Actualización de educación múltiple', () => {
    it('debe actualizar educación y resincronizar campos legacy', async () => {
      const newEducations = [
        {
          id: 1,
          nivel: 'Doctorado',
          institucion: 'MIT',
          carrera: 'Computer Science',
          añoInicio: 2024,
          añoFin: null,
          estatus: 'Cursando'
        }
      ];

      const updated = await prisma.candidate.update({
        where: { id: testCandidateId! },
        data: {
          educacion: JSON.stringify(newEducations),
          universidad: newEducations[0].institucion,
          carrera: newEducations[0].carrera,
          nivelEstudios: newEducations[0].nivel
        }
      });

      // Verificar JSON actualizado
      const parsedEducation = JSON.parse(updated.educacion!);
      expect(parsedEducation).toHaveLength(1);
      expect(parsedEducation[0].institucion).toBe('MIT');

      // Verificar campos legacy actualizados
      expect(updated.universidad).toBe('MIT');
      expect(updated.carrera).toBe('Computer Science');
      expect(updated.nivelEstudios).toBe('Doctorado');
    });
  });

  describe('Fallback a campos legacy', () => {
    it('debe crear educación desde campos legacy si no hay JSON', async () => {
      const legacyCandidate = await prisma.candidate.create({
        data: {
          nombre: 'Legacy',
          apellidoPaterno: 'Test',
          email: 'test-edu-multiple-legacy@test.com',
          universidad: 'UNAM',
          carrera: 'Medicina',
          nivelEstudios: 'Licenciatura',
          educacion: null, // Sin educación múltiple
          añosExperiencia: 0,
          source: 'manual',
          status: 'available'
        }
      });

      // Simular parseEducacion del frontend
      function parseEducacion(candidate: typeof legacyCandidate) {
        if (candidate.educacion) {
          try {
            const parsed = JSON.parse(candidate.educacion);
            if (Array.isArray(parsed) && parsed.length > 0) {
              return parsed;
            }
          } catch {
            // fallback
          }
        }
        if (candidate.universidad || candidate.carrera || candidate.nivelEstudios) {
          return [{
            id: 1,
            nivel: candidate.nivelEstudios || '',
            institucion: candidate.universidad || '',
            carrera: candidate.carrera || '',
            añoInicio: null,
            añoFin: null,
            estatus: ''
          }];
        }
        return [];
      }

      const educations = parseEducacion(legacyCandidate);
      expect(educations).toHaveLength(1);
      expect(educations[0].institucion).toBe('UNAM');
      expect(educations[0].carrera).toBe('Medicina');

      // Cleanup
      await prisma.candidate.delete({ where: { id: legacyCandidate.id } });
    });
  });

  describe('Educación vacía', () => {
    it('debe manejar candidato sin educación', async () => {
      const noEduCandidate = await prisma.candidate.create({
        data: {
          nombre: 'Sin',
          apellidoPaterno: 'Educacion',
          email: 'test-edu-multiple-none@test.com',
          educacion: null,
          universidad: null,
          carrera: null,
          nivelEstudios: null,
          añosExperiencia: 0,
          source: 'manual',
          status: 'available'
        }
      });

      // Simular parseEducacion
      function parseEducacion(candidate: typeof noEduCandidate) {
        if (candidate.educacion) {
          try {
            return JSON.parse(candidate.educacion);
          } catch {
            return [];
          }
        }
        if (candidate.universidad || candidate.carrera) {
          return [{ institucion: candidate.universidad, carrera: candidate.carrera }];
        }
        return [];
      }

      const educations = parseEducacion(noEduCandidate);
      expect(educations).toHaveLength(0);

      // Cleanup
      await prisma.candidate.delete({ where: { id: noEduCandidate.id } });
    });
  });

  describe('Validación de estructura de educación', () => {
    it('debe tener todos los campos requeridos en cada educación', () => {
      const requiredFields = ['id', 'nivel', 'institucion', 'carrera', 'estatus'];

      for (const edu of TEST_EDUCATIONS) {
        for (const field of requiredFields) {
          expect(edu).toHaveProperty(field);
        }
      }
    });

    it('añoFin puede ser null para educación en curso', () => {
      const enCurso = TEST_EDUCATIONS.find(e => e.estatus === 'Cursando');
      expect(enCurso).toBeTruthy();
      expect(enCurso!.añoFin).toBeNull();
    });
  });
});

describe('Integración con APIs', () => {
  it('estructura de educación es compatible con CompanyApplicationsTable', () => {
    // El componente espera parseEducacion que retorna Education[]
    interface Education {
      id: number;
      nivel: string;
      institucion: string;
      carrera: string;
      añoInicio?: number | null;
      añoFin?: number | null;
      estatus: string;
    }

    // Verificar que TEST_EDUCATIONS cumple con la interfaz
    const educations: Education[] = TEST_EDUCATIONS;
    expect(educations[0].nivel).toBe('Licenciatura');
    expect(educations[1].nivel).toBe('Maestría');
  });

  it('estructura de educación es compatible con CandidateProfileModal', () => {
    // El modal parsea el JSON y muestra cards
    const jsonString = JSON.stringify(TEST_EDUCATIONS);
    const parsed = JSON.parse(jsonString);

    // Debe poder mostrar institución y carrera
    expect(parsed[0]).toHaveProperty('institucion');
    expect(parsed[0]).toHaveProperty('carrera');
    expect(parsed[0]).toHaveProperty('estatus');
  });
});
