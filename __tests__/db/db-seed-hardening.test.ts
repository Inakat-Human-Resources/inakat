// RUTA: __tests__/db/db-seed-hardening.test.ts
//
// Hallazgos DB-002, DB-010, DB-011, DB-013, DB-014 y DB-015 de
// docs/auditoria-2026-09/db.md. prisma/seed.ts ejecuta main() al importarse
// (y ese main se conecta a la base), así que estos tests leen el CÓDIGO del
// seed. Todas las aserciones miran llamadas y estructura, nunca comentarios:
// el contenido se analiza con los comentarios ya eliminados.

import fs from 'fs';
import path from 'path';

const SEED_PATH = path.join(process.cwd(), 'prisma', 'seed.ts');
const seedRaw = fs.readFileSync(SEED_PATH, 'utf8');

// Quitar comentarios para que ninguna aserción pueda pasar por un comentario
const seed = seedRaw
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n')
  .map(l => l.replace(/\/\/.*$/, ''))
  .join('\n');

describe('DB-010 · el seed llama a las validaciones antes de escribir', () => {
  it('main() valida entorno y variables como primeras instrucciones', () => {
    const cuerpoMain = seed.slice(seed.indexOf('async function main()'));
    const posEntorno = cuerpoMain.indexOf('validateEntorno()');
    const posEnv = cuerpoMain.indexOf('validateEnvVars()');
    const posPrimeraEscritura = Math.min(
      ...['prisma.user.create', 'prisma.user.upsert', 'prisma.job.create']
        .map(p => cuerpoMain.indexOf(p))
        .filter(i => i >= 0)
    );

    expect(posEntorno).toBeGreaterThan(-1);
    expect(posEnv).toBeGreaterThan(-1);
    expect(posEntorno).toBeLessThan(posPrimeraEscritura);
    expect(posEnv).toBeLessThan(posPrimeraEscritura);
  });

  it('validateEntorno aborta el proceso cuando la base no es apta', () => {
    const fn = seed.slice(
      seed.indexOf('function validateEntorno'),
      seed.indexOf('async function main()')
    );
    expect(fn).toContain('motivoParaBloquearSeed');
    expect((fn.match(/process\.exit\(1\)/g) || []).length).toBeGreaterThanOrEqual(2);
  });

  it('no queda ningún correo personal hardcodeado como admin', () => {
    expect(seed).not.toMatch(/guillermo\.sanchezy@gmail\.com/i);
    // El segundo admin sale de una variable de entorno
    expect(seed).toContain('process.env.ADMIN2_EMAIL');
  });

  it('los usuarios demo usan el dominio reservado example.com, no buzones reales de terceros', () => {
    const correos = [...seed.matchAll(/'([\w.+-]+@[\w.-]+)'/g)].map(m => m[1]);
    expect(correos.filter(c => /@gmail\.com$/i.test(c))).toEqual([]);
    expect(seed).toContain("'candidato.test@example.com'");
  });

  it('el catálogo se puede sembrar sin datos demo', () => {
    expect(seed).toContain("process.env.SEED_ONLY_CATALOGS === '1'");
    expect(seed).toMatch(/if\s*\(soloCatalogos\)[\s\S]{0,300}return;/);
  });
});

describe('DB-011 · las postulaciones demo se cuelgan de las vacantes del seed', () => {
  it('createSampleApplications recibe los ids del seed y ya no consulta las 18 primeras', () => {
    expect(seed).not.toMatch(/job\.findMany\(\s*\{\s*take:\s*18\s*\}\s*\)/);
    expect(seed).toMatch(/async function createSampleApplications\(\s*idsVacantesDelSeed:\s*number\[\]/);
    expect(seed).toContain('createSampleApplications(idsVacantesDelSeed)');
  });

  it('los ids salen del create/find de cada vacante de sampleJobs', () => {
    expect(seed).toContain('idsVacantesDelSeed.push(created.id)');
    expect(seed).toContain('idsVacantesDelSeed.push(existing.id)');
  });

  it('la búsqueda de vacante existente se acota a la empresa demo', () => {
    const bloque = seed.slice(seed.indexOf('for (const job of sampleJobs)'));
    const findFirst = bloque.slice(0, bloque.indexOf('if (!existing)'));
    expect(findFirst).toContain('userId: job.userId');
  });
});

describe('DB-013 · la matriz de precios usa los nombres del catálogo', () => {
  const perfilesMatriz = new Set<string>();
  const nombresCatalogo = new Set<string>();

  beforeAll(() => {
    const inicioMatriz = seed.indexOf('const baseMatrix = [');
    const finMatriz = seed.indexOf('const specialtiesData = [');
    const matriz = seed.slice(inicioMatriz, finMatriz);
    const catalogo = seed.slice(finMatriz);

    for (const m of matriz.matchAll(/profile: '([^']+)'/g)) perfilesMatriz.add(m[1]);
    for (const m of catalogo.matchAll(/name: '([^']+)'/g)) nombresCatalogo.add(m[1]);
  });

  it('todo perfil de la matriz existe como especialidad (si no, se cobra el default de 5 créditos)', () => {
    const huerfanos = [...perfilesMatriz].filter(p => !nombresCatalogo.has(p));
    expect(huerfanos).toEqual([]);
  });

  it('ya no se siembran los nombres cortados que no existían en el catálogo', () => {
    expect(perfilesMatriz.has('Prod Audiovisual')).toBe(false);
    expect(perfilesMatriz.has('Admin de Oficina')).toBe(false);
    expect(perfilesMatriz.has('Producción Audiovisual')).toBe(true);
    expect(perfilesMatriz.has('Administración de Oficina')).toBe(true);
  });

  it('las vacantes de ejemplo usan perfiles del catálogo', () => {
    const sampleJobs = seed.slice(
      seed.indexOf('const sampleJobs = ['),
      seed.indexOf('let jobsCreated = 0')
    );
    const perfilesDemo = [...sampleJobs.matchAll(/profile: '([^']+)'/g)].map(m => m[1]);
    expect(perfilesDemo.length).toBeGreaterThan(0);
    perfilesDemo.forEach(p => expect(nombresCatalogo.has(p)).toBe(true));
  });

  it('la especialidad del staff existe en el catálogo', () => {
    const staff = seed.slice(seed.indexOf('async function seedStaff'));
    const especialidades = [...staff.matchAll(/specialty: '([^']+)'/g)].map(m => m[1]);
    expect(especialidades.length).toBeGreaterThan(0);
    especialidades.forEach(e => expect(nombresCatalogo.has(e)).toBe(true));
    expect(especialidades).not.toContain('Project Management');
  });

  it('avisa de las especialidades que se quedaron sin precio', () => {
    const fn = seed.slice(
      seed.indexOf('async function seedPricingMatrix'),
      seed.indexOf('const specialtiesData = [')
    );
    expect(fn).toContain('especialidadesSinPrecio');
    expect(fn).toMatch(/console\.warn/);
  });
});

describe('DB-009 · la matriz ya no se siembra con un try/catch ciego', () => {
  it('comprueba explícitamente si la combinación existe', () => {
    const fn = seed.slice(
      seed.indexOf('let created = 0;', seed.indexOf('async function seedPricingMatrix')),
      seed.indexOf('const specialtiesData = [')
    );
    expect(fn).toContain('prisma.pricingMatrix.findFirst');
    expect(fn).not.toMatch(/catch\s*\([\s\S]{0,40}\)\s*\{\s*skipped\+\+/);
  });
});

describe('DB-014 · el seed no degrada usuarios existentes', () => {
  const seedStaff = () =>
    seed.slice(seed.indexOf('async function seedStaff'), seed.indexOf('async function seedCreditPackages'));

  it('no hace ningún user.update dentro de seedStaff', () => {
    expect(seedStaff()).not.toContain('prisma.user.update');
  });

  it('no reescribe el rol de quien ya existe', () => {
    const fn = seedStaff();
    expect(fn).not.toMatch(/data:\s*\{\s*role:/);
    expect(fn).toContain('prisma.user.create');
  });

  it('las cuentas del staff real están detrás de un flag explícito', () => {
    expect(seed).toContain("process.env.SEED_STAFF_ACCOUNTS === '1'");
    expect(seedStaff()).toMatch(/if\s*\(!sembrarStaff\)[\s\S]{0,400}return;/);
  });

  it('seedStaff ya no duplica los reclutadores de la sección 2.5', () => {
    const fn = seedStaff();
    expect(fn).not.toContain("role: 'recruiter'");
    expect(fn).not.toContain('reclutador1@inakat.com');
  });
});

describe('DB-015 · el seed no pisa lo que administra el admin', () => {
  it('los paquetes de crédito solo se sobrescriben con SEED_FORCE_RESET', () => {
    const fn = seed.slice(seed.indexOf('async function seedCreditPackages'));
    const update = fn.indexOf('prisma.creditPackage.update');
    const guarda = fn.indexOf('if (forzarReset)');
    expect(guarda).toBeGreaterThan(-1);
    expect(guarda).toBeLessThan(update);
  });

  it('las especialidades solo se sobrescriben con SEED_FORCE_RESET', () => {
    const fn = seed.slice(
      seed.indexOf('async function seedSpecialties'),
      seed.indexOf('async function seedStaff')
    );
    const update = fn.indexOf('prisma.specialty.update');
    const guarda = fn.indexOf('if (forzarReset)');
    expect(guarda).toBeGreaterThan(-1);
    expect(guarda).toBeLessThan(update);
  });

  it('el flag es explícito y no está activo por defecto', () => {
    expect(seed).toContain("process.env.SEED_FORCE_RESET === '1'");
  });
});

describe('DB-003 · el seed no inventa calificaciones de empresa', () => {
  it('ninguna vacante de ejemplo trae companyRating', () => {
    expect(seed).not.toContain('companyRating');
  });
});
