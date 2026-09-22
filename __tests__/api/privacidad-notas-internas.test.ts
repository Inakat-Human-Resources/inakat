/**
 * Privacidad: qué NO puede salir de INAKAT hacia la empresa ni hacia el integrador.
 *
 * El arreglo de junio (#50/#51) quitó las notas internas del dashboard de empresa,
 * pero se quedó a medias: seguían saliendo por la ficha de la postulación, por el
 * listado de candidatos de una vacante, por las entrevistas, por las applications
 * colgadas de `allJobs` en el propio dashboard, y por el puente Worky2.
 *
 * Campos que son material interno:
 *  - `Application.notes` — notas de INAKAT sobre la postulación
 *  - `Candidate.notas` — notas del admin sobre la persona
 *  - `JobAssignment.recruiterNotes` / `specialistNotes` — evaluación interna
 *  - `InterviewRequest.adminNotes` — «Notas internas del admin» (así en el esquema)
 *  - `Job.notasInternas` — notas internas de la vacante
 */
import fs from 'fs';
import path from 'path';

const readFile = (filePath: string): string =>
  fs.readFileSync(path.join(process.cwd(), filePath), 'utf-8');

describe('Ficha de postulación de la empresa', () => {
  const c = readFile('src/app/api/company/applications/[id]/route.ts');

  it('no devuelve las notas internas de la postulación', () => {
    expect(c).toContain('const { notes: _internalNotes, ...applicationPublic } = application');
    expect(c).toContain('...applicationPublic');
  });

  it('no devuelve las notas del admin sobre el candidato', () => {
    expect(c).not.toMatch(/notas: candidate\.notas/);
  });

  it('no devuelve las notas de reclutador ni de especialista', () => {
    expect(c).not.toMatch(/recruiterNotes: jobAssignment/);
    expect(c).not.toMatch(/specialistNotes: jobAssignment/);
  });
});

describe('Listado de candidatos de una vacante', () => {
  const c = readFile('src/app/api/company/jobs/[jobId]/candidates/route.ts');

  it('no devuelve Application.notes ni Candidate.notas', () => {
    expect(c).not.toMatch(/notes: app\.notes/);
    expect(c).not.toMatch(/notas: candidate\.notas/);
  });

  it('sigue devolviendo las notas de evaluación marcadas como públicas', () => {
    // Lo que la empresa sí debe ver no se toca.
    expect(c).toContain('publicEvaluationNotes');
  });
});

describe('Dashboard de empresa', () => {
  const c = readFile('src/app/api/company/dashboard/route.ts');

  it('limpia también las applications que cuelgan de allJobs', () => {
    // El filtro anterior sólo cubría `enrichedApplications`; éstas venían del
    // include completo y conservaban `notes`.
    expect(c).toContain('applications.map(({ notes: _n, ...app }) => app)');
  });
});

describe('Entrevistas de la empresa', () => {
  const c = readFile('src/app/api/company/interviews/route.ts');

  it('no entrega adminNotes en el spread', () => {
    expect(c).toContain('({ adminNotes: _adminNotes, ...ir })');
  });
});

describe('Puente Worky2', () => {
  const c = readFile('src/lib/integration-candidate.ts');

  it('no exporta las notas internas al integrador', () => {
    expect(c).not.toMatch(/notasAdicionales: application\.notes/);
    expect(c).toContain('notasAdicionales: null');
  });
});

describe('Vacantes confidenciales', () => {
  it('las tres rutas ocultan userId y coordenadas, no sólo el nombre', () => {
    // `userId` identifica a la empresa dueña y las coordenadas apuntan a su
    // domicilio: sin ocultarlos, la confidencialidad era aparente.
    for (const ruta of [
      'src/app/api/jobs/route.ts',
      'src/app/api/jobs/publish/route.ts',
      'src/app/api/jobs/[id]/route.ts'
    ]) {
      const c = readFile(ruta);
      const sanit = c.slice(c.indexOf('function sanitizeConfidentialJob'));
      expect(sanit).toContain('userId: null');
      expect(sanit).toContain('latitude: null');
      expect(sanit).toContain('longitude: null');
      expect(sanit).toContain("company: 'Empresa Confidencial'");
    }
  });
});

describe('Oráculo de postulaciones', () => {
  it('/api/applications/check ya no es público', () => {
    const m = readFile('src/middleware.ts');
    expect(m).not.toMatch(/pathname === '\/api\/applications\/check' && request\.method === 'GET'/);
  });

  it('el handler exige sesión y usa el email de la sesión', () => {
    const c = readFile('src/app/api/applications/check/route.ts');
    expect(c).toContain('requireAuth');
    expect(c).toContain('candidateEmail: auth.user.email.toLowerCase()');
  });

  it('el modal ya no manda el email por la URL', () => {
    const c = readFile('src/components/sections/talents/ApplyJobModal.tsx');
    expect(c).toContain('/api/applications/check?jobId=${jobId}');
    expect(c).not.toMatch(/applications\/check\?jobId=\$\{jobId\}&email=/);
  });
});
