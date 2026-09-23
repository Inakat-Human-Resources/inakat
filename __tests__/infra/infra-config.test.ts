/**
 * @jest-environment node
 */

// RUTA: __tests__/infra/infra-config.test.ts
//
// Configuración del repositorio que no es código de la app pero que protege
// datos o evita que main se rompa sin avisar:
//  - INFRA-011: public/uploads (fallback local de /api/upload con CV, INE y
//    actas reales) debe estar ignorado por git.
//  - INFRA-010 / INFRA-026: el CI valida el schema, construye la app y usa la
//    misma versión de Node que declara el proyecto.
//  - INFRA-015 / INFRA-033: la suite e2e carga .env.e2e, usa cuentas que el seed
//    crea de verdad, no publica contraseñas y no levanta un servidor local
//    cuando apunta a staging.

import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '..', '..');
const leer = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/**
 * ¿Alguna regla de .gitignore ignora `ruta`? Implementa lo justo del formato:
 * reglas ancladas ("/x/"), de directorio ("x/") y negaciones ("!x").
 */
function ignoradoPorGit(ruta: string): boolean {
  const reglas = leer('.gitignore')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));

  let ignorado = false;
  for (const regla of reglas) {
    const negada = regla.startsWith('!');
    const patron = (negada ? regla.slice(1) : regla).replace(/^\//, '').replace(/\/$/, '');
    const coincide = ruta === patron || ruta.startsWith(`${patron}/`);
    if (coincide) ignorado = !negada;
  }
  return ignorado;
}

describe('INFRA-011: las subidas locales no se pueden commitear', () => {
  it('/api/upload guarda el fallback local en public/uploads', () => {
    // Si la ruta cambia de carpeta, este test obliga a revisar el .gitignore.
    const upload = leer('src/app/api/upload/route.ts');
    expect(upload).toMatch(/path\.join\(\s*process\.cwd\(\),\s*'public',\s*'uploads'\s*\)/);
  });

  it('public/uploads está ignorado por git (CV, INE, actas de prueba)', () => {
    expect(ignoradoPorGit('public/uploads/cv-de-alguien.pdf')).toBe(true);
    expect(ignoradoPorGit('public/uploads/sub/ine.png')).toBe(true);
  });

  it('el resto de public/ sigue versionado', () => {
    expect(ignoradoPorGit('public/favicon.ico')).toBe(false);
    expect(ignoradoPorGit('public/logo512.png')).toBe(false);
  });
});

describe('INFRA-010 / INFRA-026: el CI', () => {
  const ci = leer('.github/workflows/ci.yml');
  const pasos = ci
    .split(/\r?\n/)
    .filter((l) => /^\s+run:\s/.test(l))
    .map((l) => l.replace(/^\s+run:\s*/, '').trim());

  it('restringe el GITHUB_TOKEN a lectura', () => {
    expect(ci).toMatch(/^permissions:\s*\r?\n\s+contents:\s*read\s*$/m);
  });

  it('valida el schema de Prisma, compila, pasa lint y tests y construye la app', () => {
    expect(pasos).toEqual(
      expect.arrayContaining([
        'npx prisma validate',
        'npx tsc --noEmit',
        'npm run lint',
        'npm test',
        'npm run build'
      ])
    );
  });

  it('el build no está marcado como opcional', () => {
    // Se miran sólo las líneas YAML del paso (sin comentarios): el comentario
    // del paso siguiente puede nombrar continue-on-error sin que aplique aquí.
    const lineas = ci.split(/\r?\n/);
    const inicio = lineas.findIndex((l) => /^\s+run:\s*npm run build\s*$/.test(l));
    expect(inicio).toBeGreaterThan(-1);

    const inicioPaso = lineas
      .slice(0, inicio)
      .map((l, i) => ({ l, i }))
      .filter(({ l }) => /^\s+- name:/.test(l))
      .pop()?.i ?? inicio;
    const finRelativo = lineas.slice(inicio + 1).findIndex((l) => /^\s+- name:/.test(l));
    const fin = finRelativo === -1 ? lineas.length : inicio + 1 + finRelativo;

    const paso = lineas
      .slice(inicioPaso, fin)
      .filter((l) => !/^\s*#/.test(l));
    expect(paso.some((l) => /^\s+continue-on-error:/.test(l))).toBe(false);
  });

  it('usa la versión de Node de .nvmrc, y ésta cumple package.json#engines', () => {
    expect(ci).not.toMatch(/node-version:\s*\d/);
    expect(ci).toMatch(/node-version-file:\s*\.nvmrc/);

    const major = parseInt(leer('.nvmrc').trim(), 10);
    const pkg = JSON.parse(leer('package.json')) as { engines?: { node?: string } };
    const minimo = parseInt((pkg.engines?.node ?? '').replace(/[^\d]/g, ''), 10);

    expect(major).toBeGreaterThanOrEqual(22);
    expect(major).toBeGreaterThanOrEqual(minimo);
  });
});

// @playwright/test se niega a cargarse dos veces en el mismo proceso (guarda un
// global, así que jest.isolateModules no basta). Para leer la configuración no
// hace falta el runner real: defineConfig es la identidad.
jest.mock('@playwright/test', () => ({
  defineConfig: <T,>(config: T): T => config,
  devices: new Proxy({}, { get: () => ({}) })
}));

describe('INFRA-015 / INFRA-033: suite e2e', () => {
  const ENTORNO_ORIGINAL = { ...process.env };

  afterEach(() => {
    process.env = { ...ENTORNO_ORIGINAL };
    jest.resetModules();
  });

  function cargarConfig(baseUrl?: string) {
    if (baseUrl === undefined) delete process.env.E2E_BASE_URL;
    else process.env.E2E_BASE_URL = baseUrl;
    let config: { use?: { baseURL?: string }; webServer?: unknown } = {};
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      config = require('../../playwright.config').default;
    });
    return config;
  }

  it('playwright.config carga .env.e2e (Playwright no lee ningún .env solo)', () => {
    const fuente = leer('playwright.config.ts');
    expect(fuente).toMatch(/dotenv\.config\(\s*\{\s*path:\s*'\.env\.e2e'/);
  });

  it('contra localhost levanta el servidor local', () => {
    const config = cargarConfig('http://localhost:3000');
    expect(config.use?.baseURL).toBe('http://localhost:3000');
    expect(config.webServer).toBeDefined();
  });

  it('contra staging NO levanta un servidor local', () => {
    const config = cargarConfig('https://staging.inakat.example');
    expect(config.use?.baseURL).toBe('https://staging.inakat.example');
    expect(config.webServer).toBeUndefined();
  });

  function cargarCuentas() {
    let cuentas: Record<string, { email: string; password: string }> = {};
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      cuentas = require('../e2e/helpers/auth').TEST_ACCOUNTS;
    });
    return cuentas;
  }

  it('sin E2E_*_PASSWORD no hay contraseña por defecto: falla con un mensaje claro', () => {
    for (const rol of ['ADMIN', 'COMPANY', 'RECRUITER', 'SPECIALIST', 'CANDIDATE']) {
      delete process.env[`E2E_${rol}_PASSWORD`];
    }
    const cuentas = cargarCuentas();
    for (const rol of Object.keys(cuentas)) {
      expect(() => cuentas[rol].password).toThrow(/E2E_[A-Z]+_PASSWORD/);
    }
  });

  it('la contraseña sale de la variable de entorno del rol', () => {
    process.env.E2E_COMPANY_PASSWORD = 'valor-de-prueba-empresa';
    expect(cargarCuentas().company.password).toBe('valor-de-prueba-empresa');
  });

  it('por defecto usa cuentas que el seed crea de verdad', () => {
    for (const rol of ['ADMIN', 'COMPANY', 'RECRUITER', 'SPECIALIST', 'CANDIDATE']) {
      delete process.env[`E2E_${rol}_EMAIL`];
    }
    const seed = leer('prisma/seed.ts');
    const cuentas = cargarCuentas();

    expect(Object.keys(cuentas).sort()).toEqual(
      ['admin', 'candidate', 'company', 'recruiter', 'specialist']
    );
    for (const rol of Object.keys(cuentas)) {
      expect({ rol, enSeed: seed.includes(`'${cuentas[rol].email}'`) }).toEqual({
        rol,
        enSeed: true
      });
    }
  });

  it('el email se puede cambiar por entorno (staging)', () => {
    process.env.E2E_RECRUITER_EMAIL = 'reclu@staging.test';
    expect(cargarCuentas().recruiter.email).toBe('reclu@staging.test');
  });
});
