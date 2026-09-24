// RUTA: __tests__/api/emp-empresa-fuente.test.ts

/**
 * Módulo EMPRESA — comprobaciones sobre el código fuente para arreglos que no
 * son ejercitables con mocks (componentes de página, forma del `select` de
 * Prisma, código muerto borrado).
 *
 * Las aserciones miran SIEMPRE la llamada o la expresión, nunca texto que un
 * comentario pudiera contener por casualidad.
 */
import fs from 'fs';
import path from 'path';

const leer = (rutaRelativa: string): string =>
  fs.readFileSync(path.join(process.cwd(), rutaRelativa), 'utf-8');

const existe = (rutaRelativa: string): boolean =>
  fs.existsSync(path.join(process.cwd(), rutaRelativa));

/** Quita los comentarios (// y /* *​/) para que las aserciones no los lean. */
const sinComentarios = (codigo: string): string =>
  codigo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('EMP-006 — las notas internas del admin no salen en las entrevistas', () => {
  it('GET /api/company/interview-requests usa select y no incluye adminNotes', () => {
    const c = sinComentarios(
      leer('src/app/api/company/interview-requests/route.ts')
    );

    expect(c).not.toMatch(/adminNotes/);
    expect(c).not.toMatch(/confirmedById/);
    // La ruta ya no devuelve el findMany entero: hay un select explícito.
    expect(c).toMatch(/meetingUrl:\s*true/);
  });

  it('la página de entrevistas de la empresa ya no declara adminNotes', () => {
    const c = sinComentarios(leer('src/app/company/interviews/page.tsx'));
    expect(c).not.toMatch(/adminNotes/);
  });
});

describe('EMP-017 — el listado de candidatos ya no hace N+1', () => {
  const c = sinComentarios(
    leer('src/app/api/company/jobs/[jobId]/candidates/route.ts')
  );

  it('no lanza una consulta por aplicación dentro de un map', () => {
    expect(c).not.toMatch(/applications\.map\(async/);
    expect(c).not.toMatch(/prisma\.candidate\.findFirst/);
  });

  it('carga candidatos y notas en lote con `in`', () => {
    expect(c).toMatch(/prisma\.candidate\.findMany/);
    expect(c).toMatch(/email:\s*\{\s*in:\s*uniqueEmails/);
    expect(c).toMatch(/applicationId:\s*\{\s*in:\s*applicationIds/);
  });

  it('sigue sin devolver notas internas y sí las públicas', () => {
    expect(c).not.toMatch(/notes:\s*app\.notes/);
    expect(c).not.toMatch(/notas:\s*candidate\.notas/);
    expect(c).toMatch(/publicEvaluationNotes/);
  });
});

describe('EMP-007 — el modal no pinta notas internas a la empresa', () => {
  const c = sinComentarios(leer('src/components/shared/CandidateProfileModal.tsx'));

  it('define el permiso sin incluir a company ni al candidato', () => {
    expect(c).toMatch(
      /const puedeVerNotasInternas\s*=\s*\['admin',\s*'recruiter',\s*'specialist'\]/
    );
  });

  it('los dos bloques de notas están detrás de ese permiso', () => {
    expect(c).toMatch(/puedeVerNotasInternas && data\.adminNotas/);
    expect(c).toMatch(/puedeVerNotasInternas && data\.notes/);
  });
});

describe('EMP-012 — la empresa no escribe Application.notes', () => {
  const c = sinComentarios(
    leer('src/app/api/company/applications/[id]/route.ts')
  );

  it('no lee `notes` del body ni lo mete en updateData', () => {
    expect(c).not.toMatch(/const \{[^}]*\bnotes\b[^}]*\} = body/);
    expect(c).not.toMatch(/updateData\.notes/);
  });
});

describe('EMP-021 — los horarios propuestos usan la fecha LOCAL', () => {
  const c = sinComentarios(leer('src/components/company/InterviewRequestModal.tsx'));

  it('no construye la fecha con toISOString (UTC)', () => {
    expect(c).not.toMatch(/toISOString\(\)\.split/);
  });

  it('la compone con getFullYear/getMonth/getDate', () => {
    expect(c).toMatch(/current\.getFullYear\(\)/);
    expect(c).toMatch(/current\.getMonth\(\) \+ 1/);
    expect(c).toMatch(/current\.getDate\(\)/);
  });
});

describe('EMP-019 — la barra sticky no queda debajo del Navbar fijo', () => {
  it('«Publicar vacante» no queda tapada ni desaparece al bajar por el panel', () => {
    // Con el rediseño (docs/DISENO.md) ya no hay barra sticky propia: la
    // acción vive en la cabecera de la página, en la barra lateral del
    // AppShell y, en móvil (sin barra lateral), en un botón flotante fijo
    // abajo. La intención de EMP-019 se conserva: nada de la página se fija en
    // top-0 (debajo de la cabecera del AppShell) y la acción de crear vacante
    // sigue a la vista al hacer scroll.
    const c = sinComentarios(leer('src/app/company/dashboard/page.tsx'));
    expect(c).not.toMatch(/sticky top-0/);
    expect(c).toMatch(/className="fixed bottom-\d+[^"]*lg:hidden"/);
    expect(c).toMatch(/const publicar = \(\) => router\.push\('\/create-job'\)/);
    expect(c).toMatch(/<Button icono=\{Plus\} onClick=\{publicar\}/);
  });

  it('la cabecera fija del AppShell mide esa misma altura (h-14)', () => {
    // La empresa ya no vive bajo el Navbar público: la envuelve el AppShell,
    // cuya cabecera es sticky top-0 y h-14. `sticky top-14` deja la barra de
    // la página justo debajo de ella.
    expect(leer('src/app/company/layout.tsx')).toContain('<AppShell>');
    const shell = sinComentarios(leer('src/components/ui/AppShell.tsx'));
    expect(shell).toMatch(/<header className="sticky top-0 z-30 flex h-14/);
  });
});

describe('EMP-010 — el dashboard soporta companyInfo null', () => {
  const c = sinComentarios(leer('src/app/company/dashboard/page.tsx'));

  it('no accede a companyInfo sin comprobarlo', () => {
    expect(c).not.toMatch(/data\.company\.companyInfo\.[a-zA-Z]/);
  });

  it('muestra un aviso cuando no hay solicitud asociada', () => {
    expect(c).toMatch(/\{!companyInfo && \(/);
  });
});

describe('EMP-002 — la UI avisa del estado de la solicitud', () => {
  const c = sinComentarios(leer('src/app/company/dashboard/page.tsx'));

  it('pinta banner de pendiente y de rechazada', () => {
    expect(c).toMatch(/estadoSolicitud === 'pending'/);
    expect(c).toMatch(/estadoSolicitud === 'rejected'/);
  });

  it('la API entrega status y rejectionReason', () => {
    const api = sinComentarios(leer('src/app/api/company/dashboard/route.ts'));
    expect(api).toMatch(/status:\s*true/);
    expect(api).toMatch(/rejectionReason:\s*true/);
  });
});

describe('EMP-032 — las vacantes expiradas siguen visibles', () => {
  const c = sinComentarios(leer('src/components/company/CompanyJobsTable.tsx'));

  it('la pestaña Activas ya no excluye las expiradas', () => {
    expect(c).not.toMatch(/active:\s*jobs\.filter\(job => job\.status === 'active' && !isExpired/);
    expect(c).toMatch(/active:\s*jobs\.filter\(job => job\.status === 'active'\)/);
  });

  it('el badge «Expirada» sigue existiendo para distinguirlas', () => {
    expect(c).toMatch(/isExpired\(job\)/);
  });
});

describe('EMP-034 — JobDetailModal traduce paused y recibe el logo', () => {
  it('los mapas de badge y etiqueta contemplan paused', () => {
    const c = sinComentarios(leer('src/components/company/JobDetailModal.tsx'));
    expect(c).toMatch(/paused:\s*'En pausa'/);
    // El color ya no es una clase suelta: la insignia es la del sistema
    // (StatusBadge), cuyo mapa de estados da tono propio a 'paused' (aviso).
    expect(c).toMatch(/<StatusBadge estado=\{estado\} etiqueta=\{ETIQUETAS_ESTADO\[estado\]\}/);
    const badge = leer('src/components/ui/Badge.tsx');
    expect(badge).toMatch(/paused:\s*\{\s*tono:\s*'aviso'/);
  });

  it('el dashboard le inyecta logoUrl a la vacante seleccionada', () => {
    const c = sinComentarios(leer('src/app/company/dashboard/page.tsx'));
    expect(c).toMatch(/\.\.\.selectedJob,\s*logoUrl:\s*companyInfo\?\.logoUrl/);
  });
});

describe('EMP-022 — el formulario no sube documentos antes de validar', () => {
  const c = sinComentarios(
    leer('src/components/sections/companies/FormRegisterForQuotationSection.tsx')
  );

  it('llama a la pre-validación con dryRun', () => {
    expect(c).toMatch(/dryRun:\s*true/);
    // La pre-validación ocurre antes del primer POST a /api/upload.
    expect(c.indexOf('dryRun: true')).toBeLessThan(c.indexOf("fetch('/api/upload'"));
  });

  it('cachea las URLs ya subidas para no re-subirlas en un reintento', () => {
    expect(c).toMatch(/urlsSubidasRef/);
    expect(c).toMatch(/if \(!urlsSubidasRef\.current\.identificacion\)/);
    expect(c).toMatch(/if \(!urlsSubidasRef\.current\.documentosConstitucion\)/);
  });
});

describe('EMP-038 — el formulario manda las coordenadas del mapa', () => {
  const c = sinComentarios(
    leer('src/components/sections/companies/FormRegisterForQuotationSection.tsx')
  );

  it('sólo las envía si el usuario eligió ubicación', () => {
    expect(c).toMatch(/latitud:\s*ubicacionElegida \? markerPosition\.lat : null/);
    expect(c).toMatch(/longitud:\s*ubicacionElegida \? markerPosition\.lng : null/);
  });
});

describe('EMP-031 — código muerto eliminado', () => {
  it('los componentes sin consumidor ya no existen', () => {
    expect(existe('src/components/company/CompanyApplicationsTable.tsx')).toBe(false);
    expect(existe('src/components/company/StatCard.tsx')).toBe(false);
    expect(existe('src/components/sections/companies/CompanyTestimonialsSection.tsx')).toBe(
      false
    );
  });

  it('nadie los importaba', () => {
    const buscarEn = (dir: string): string[] => {
      const salida: string[] = [];
      for (const entrada of fs.readdirSync(path.join(process.cwd(), dir), {
        withFileTypes: true,
      })) {
        const rel = `${dir}/${entrada.name}`;
        if (entrada.isDirectory()) salida.push(...buscarEn(rel));
        else if (/\.tsx?$/.test(entrada.name)) salida.push(rel);
      }
      return salida;
    };

    const referencias = buscarEn('src').filter((f) =>
      // Sin comentarios: en /companies queda una nota de por qué se retiraron.
      /CompanyApplicationsTable|company\/StatCard|CompanyTestimonialsSection/.test(
        sinComentarios(leer(f)).replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
      )
    );
    expect(referencias).toEqual([]);
  });

  it('InterviewRequestModal ya no declara props que nadie pasa', () => {
    const c = sinComentarios(leer('src/components/company/InterviewRequestModal.tsx'));
    expect(c).not.toMatch(/companyName/);
    expect(c).not.toMatch(/companyEmail/);
  });
});

describe('EMP-009/EMP-013 — el trabajo posterior a la respuesta no se pierde', () => {
  it('runAfterResponse usa after() de next/server y registra los errores', () => {
    const c = leer('src/lib/notifications.ts');
    expect(c).toMatch(/import \{ after \} from 'next\/server'/);
    expect(c).toMatch(/export async function runAfterResponse/);
    expect(c).toMatch(/console\.error\(/);
  });

  it('las rutas de empresa ya no sueltan notificaciones con .catch(() => {})', () => {
    for (const ruta of [
      'src/app/api/company-requests/route.ts',
      'src/app/api/company-requests/[id]/route.ts',
      'src/app/api/company/applications/[id]/route.ts',
      'src/app/api/company/interview-requests/route.ts',
    ]) {
      const c = sinComentarios(leer(ruta));
      expect(c).not.toMatch(/\.catch\(\(\)\s*=>\s*\{\s*\}\)/);
    }
  });

  it('el correo a los admins de la entrevista ya no es fire-and-forget', () => {
    const c = sinComentarios(
      leer('src/app/api/company/interview-requests/route.ts')
    );
    expect(c).not.toMatch(/for \(const admin of adminUsers\)/);
    expect(c).toMatch(/runAfterResponse\(/);
    expect(c).toMatch(/Promise\.allSettled/);
  });
});

describe('EMP-014 — el dashboard no recorre todas las aplicaciones por vacante', () => {
  const c = sinComentarios(leer('src/app/api/company/dashboard/route.ts'));

  it('agrupa los conteos en un solo recorrido, no con un filter por vacante', () => {
    expect(c).not.toMatch(/allApplications\.filter\(\s*\(app\) => app\.jobId === job\.id/);
    expect(c).toMatch(/conteosPorJob/);
  });
});
