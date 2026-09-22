/**
 * Cifras del panel de administración y listas topadas.
 *
 * El dashboard calculaba sus totales con `.length` sobre respuestas paginadas:
 * se topaban en el tamaño de página (20/30) y, como `/api/jobs` devuelve sólo
 * vacantes activas por defecto, «borradores», «pausadas» y «cerradas» salían
 * SIEMPRE en 0. Números falsos con aspecto de ciertos, que es lo peligroso.
 *
 * Y varias pantallas consumían APIs paginadas sin paginar, así que los registros
 * a partir del 21 eran inalcanzables desde la interfaz.
 */
import fs from 'fs';
import path from 'path';

const readFile = (filePath: string): string =>
  fs.readFileSync(path.join(process.cwd(), filePath), 'utf-8');

describe('Las cifras del panel se cuentan en la base de datos', () => {
  const api = readFile('src/app/api/admin/stats/route.ts');

  it('usa count(), no el largo de una página', () => {
    expect(api).toContain('prisma.job.count()');
    expect(api).toContain("prisma.job.count({ where: { status: 'draft' } })");
    expect(api).toContain("prisma.job.count({ where: { status: 'paused' } })");
    expect(api).toContain("prisma.job.count({ where: { status: 'closed' } })");
    expect(api).toContain('prisma.candidate.count()');
    expect(api).toContain('prisma.application.count()');
  });

  it('cuenta las solicitudes pendientes y las empresas distintas', () => {
    expect(api).toContain("prisma.companyRequest.count({ where: { status: 'pending' } })");
    expect(api).toContain("prisma.job.groupBy({ by: ['company'] })");
  });

  it('exige rol admin', () => {
    expect(api).toContain("requireRole('admin')");
  });
});

describe('El dashboard consume esas cifras', () => {
  const page = readFile('src/app/admin/page.tsx');

  it('pide /api/admin/stats y las aplica tal cual', () => {
    expect(page).toContain("fetch('/api/admin/stats')");
    expect(page).toContain('setStats(prev => ({ ...prev, ...statsData.data }))');
  });

  it('ya no calcula totales con .length sobre respuestas paginadas', () => {
    expect(page).not.toMatch(/totalJobs: allJobs\.length/);
    expect(page).not.toMatch(/draftJobs: allJobs\.filter/);
    expect(page).not.toMatch(/totalCandidates: candidatesData\.data\?\.length/);
    expect(page).not.toMatch(/totalApplications: applicationsData\.data\?\.length/);
  });

  it('la tabla pide también borradores, no sólo activas', () => {
    expect(page).toContain("fetch('/api/jobs?includeDrafts=true&limit=100')");
  });
});

describe('Pantallas que consumían APIs paginadas sin paginar', () => {
  it.each([
    ['src/app/admin/assign-candidates/page.tsx', "fetch('/api/jobs?status=active&limit=100')"],
    ['src/components/sections/talents/SearchPositionsSection.tsx', "fetch('/api/jobs?status=active&limit=100')"],
    ['src/app/admin/interviews/page.tsx', "fetch('/api/admin/interviews?limit=100')"]
  ])('%s pide el máximo por página', (archivo, esperado) => {
    expect(readFile(archivo)).toContain(esperado);
  });

  it('100 es el tope que aceptan los helpers, no un número al azar', () => {
    const pag = readFile('src/lib/pagination.ts');
    expect(pag).toContain('maxLimit = 100');
    const interviews = readFile('src/app/api/admin/interviews/route.ts');
    expect(interviews).toMatch(/Math\.min\(100,/);
  });
});
