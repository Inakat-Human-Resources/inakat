// RUTA: __tests__/components/eval-paginas-detalle.test.ts
//
// Auditoría 2026-09 — EVAL-012/013/014/015/016 y la pestaña "Enviadas" del
// reclutador. Las páginas de detalle de vacante (/recruiter/jobs/[jobId] y
// /specialist/jobs/[jobId]) no pueden exportar sus tablas (Next sólo admite el
// default export en page.tsx), así que se analiza el CÓDIGO sin comentarios:
// las aserciones miran las llamadas y las tablas, nunca texto libre.

import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '../..');

function readFile(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf-8');
}

/** Quita comentarios de bloque y de línea para que no cuenten como código. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

/** Evalúa el literal de objeto/array asignado a `const <name>`. */
function readLiteral<T>(src: string, name: string): T {
  const re = new RegExp(`const ${name}[^=]*=\\s*([\\[{][\\s\\S]*?[\\]}]);`);
  const match = src.match(re);
  if (!match) throw new Error(`No se encontró la constante ${name}`);
  return new Function(`return (${match[1]});`)() as T;
}

/** Cuerpo de una función flecha `const <name> = ...` hasta la siguiente `const` de primer nivel del componente. */
function functionBody(src: string, name: string, next: string): string {
  const start = src.indexOf(`const ${name}`);
  const end = src.indexOf(`const ${next}`, start + 1);
  if (start < 0 || end < 0) throw new Error(`No se encontró ${name}`);
  return src.slice(start, end);
}

/** Destinos de handleMoveApplication que pinta cada pestaña. */
function buttonsByTab(src: string, tabs: string[]): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const tab of tabs) {
    const start = src.indexOf(`{activeTab === '${tab}' && (`);
    if (start < 0) {
      result[tab] = [];
      continue;
    }
    const rest = src.slice(start + 1);
    const nextTab = rest.search(/\{activeTab === '/);
    const block = nextTab >= 0 ? rest.slice(0, nextTab) : rest;
    result[tab] = [...block.matchAll(/handleMoveApplication\(app\.id,\s*'([a-z_]+)'\)/g)].map((m) => m[1]);
  }
  return result;
}

const PAGES = {
  recruiter: {
    page: 'src/app/recruiter/jobs/[jobId]/page.tsx',
    api: 'src/app/api/recruiter/dashboard/route.ts',
    table: 'RECRUITER_TRANSITIONS',
    // Estados que lista cada pestaña con botones de acción.
    tabs: {
      pending: ['pending', 'injected_by_admin'],
      reviewing: ['reviewing'],
      sent: [] as string[],
      discarded: ['discarded'],
    } as Record<string, string[]>,
  },
  specialist: {
    page: 'src/app/specialist/jobs/[jobId]/page.tsx',
    api: 'src/app/api/specialist/dashboard/route.ts',
    table: 'SPECIALIST_TRANSITIONS',
    tabs: {
      pending: ['sent_to_specialist'],
      evaluating: ['evaluating'],
      sent: [] as string[],
      discarded: ['discarded'],
    } as Record<string, string[]>,
  },
};

describe.each(Object.entries(PAGES))('Página de detalle de vacante (%s)', (_role, cfg) => {
  const page = stripComments(readFile(cfg.page));
  const api = stripComments(readFile(cfg.api));

  it('EVAL-014/016: la tabla de transiciones de la página es la misma que aplica la API', () => {
    const fromPage = readLiteral<Record<string, string[]>>(page, cfg.table);
    const fromApi = readLiteral<Record<string, string[]>>(api, 'allowedTransitions');

    expect(fromPage).toEqual(fromApi);
  });

  it('EVAL-014/016: ningún botón pide una transición que la API rechaza', () => {
    const transitions = readLiteral<Record<string, string[]>>(api, 'allowedTransitions');
    const buttons = buttonsByTab(page, Object.keys(cfg.tabs));

    for (const [tab, targets] of Object.entries(buttons)) {
      for (const target of targets) {
        for (const from of cfg.tabs[tab]) {
          expect({ tab, from, target, ok: (transitions[from] || []).includes(target) }).toEqual({
            tab,
            from,
            target,
            ok: true,
          });
        }
      }
    }
    // Sanidad: el parser sí encontró botones.
    expect(Object.values(buttons).flat().length).toBeGreaterThan(3);
  });

  it('EVAL-013: el error de una acción no sustituye la página (estado propio)', () => {
    const move = functionBody(page, 'handleMoveApplication', 'openApplicationProfile');

    expect(move).toMatch(/setActionError\(/);
    expect(move).not.toMatch(/setLoadError\(/);
    expect(page).not.toMatch(/\bsetError\(/);
    // El early return de pantalla completa sólo mira el error de CARGA.
    expect(page).toMatch(/if \(loadError \|\| !assignment\)/);
    // La alerta inline descartable se pinta con el error de la acción.
    expect(page).toMatch(/\{actionError && \(/);
  });

  it('EVAL-012: carga sólo la vacante (?jobId=) y no re-descarga tras cada acción', () => {
    const fetchData = functionBody(page, 'fetchJobData', 'filterApplicationsByTab');
    const move = functionBody(page, 'handleMoveApplication', 'openApplicationProfile');

    expect(fetchData).toMatch(/fetch\(`\/api\/\w+\/dashboard\?jobId=\$\{encodeURIComponent\(jobId\)\}`\)/);
    expect(move).not.toMatch(/fetchJobData\(\)/);
    expect(move).toMatch(/setAssignment\(/);
  });

  it('EVAL-015 / PERF-016: "Agregar documento" sólo se ofrece porque el modal ya no usa la ruta /api/admin', () => {
    // El modal sube contra /api/evaluations/candidates/[id]/documents, que
    // comprueba la asignación; la ruta de /api/admin la niega el middleware.
    const modal = readFile('src/components/shared/CandidateProfileModal.tsx');
    expect(modal).toMatch(/\/api\/evaluations\/candidates\/\$\{candidateId\}\/documents/);
    expect(modal).not.toMatch(/fetch\(`\/api\/admin\/candidates\/\$\{candidateId\}\/documents/);
    expect(page).toMatch(/canAddDocuments=\{true\}/);
  });
});

describe('Pestaña "Enviadas" del detalle del reclutador', () => {
  const page = stripComments(readFile('src/app/recruiter/jobs/[jobId]/page.tsx'));

  it('lista todo lo que ya salió de sus manos, no sólo sent_to_specialist', () => {
    const sent = readLiteral<string[]>(page, 'SENT_STATUSES');

    for (const s of ['sent_to_specialist', 'evaluating', 'sent_to_company', 'company_interested', 'interviewed', 'accepted', 'rejected']) {
      expect(sent).toContain(s);
    }
    // Filtro y contador usan la misma lista.
    expect(page.match(/SENT_STATUSES\.includes\(app\.status\)/g)?.length).toBeGreaterThanOrEqual(2);
  });
});
