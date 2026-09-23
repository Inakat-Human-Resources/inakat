/**
 * @jest-environment node
 */

// RUTA: __tests__/infra/infra-docs-sin-credenciales.test.ts
//
// INFRA-001: el README y otros seis documentos versionados publicaban en claro
// el email y la contraseña de todas las cuentas del seed (admin incluido).
// Cualquiera con lectura del repo podía probarlas en /login de producción.
//
// Este test es la barrera para que no vuelvan: recorre la documentación
// versionada y falla si encuentra (a) una de las contraseñas comprometidas o
// (b) una línea que asigna un valor real a una variable de contraseña.
//
// Si un día hace falta documentar una credencial, la respuesta correcta NO es
// relajar este test: es no documentarla.

import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '..', '..');

/**
 * Contraseñas que estuvieron publicadas en el repositorio. No deben volver a
 * aparecer en ningún documento. Se construyen por partes para que el propio
 * test no sea un sitio donde estén escritas de corrido.
 */
const COMPROMETIDAS: string[] = [
  ['Admin', 'Inakat', '2024!'].join(''),
  ['Company', '123!'].join(''),
  ['Recruiter', '2024!'].join(''),
  ['Specialist', '2024!'].join(''),
  ['Staff', '2024!'].join(''),
  ['Candidate', '2024!'].join(''),
  ['Guillermo', '2024!'].join(''),
  ['TestAdmin', '123!'].join(''),
  ['TestCompany', '123!'].join('')
];

/** Nombres de variable cuyo valor es una contraseña. */
const VARIABLES_DE_PASSWORD =
  /\b(ADMIN_PASSWORD|SEED_[A-Z0-9_]*PASSWORD|E2E_[A-Z0-9_]*PASSWORD|SMTP_PASS|DB_PASSWORD|POSTGRES_PASSWORD)\s*[:=]\s*["']?([^"'\s]+)/g;

/** Filas de tabla / líneas tipo "Password: xxx" o "Contraseña: xxx". */
const ETIQUETA_DE_PASSWORD =
  /\b(?:password|contrase[ñn]a|pass|pwd)\s*[:=|]\s*([^\s|]+)/gi;

/**
 * Sólo nos interesan los valores que PARECEN una credencial literal: mezcla de
 * letras y dígitos, sin puntuación de código. Así no se marca `password:
 * hashedPassword` ni `password: z.string().min(8)` de un ejemplo de código.
 */
function pareceCredencial(valor: string): boolean {
  const v = valor.trim().replace(/^[`"'*]+|[`"'*,.)]+$/g, '');
  if (v.length < 6) return false;
  if (/[()[\]{}<>$;,]/.test(v)) return false;
  if (/process\.env|\.\w/.test(v)) return false;
  if (/^[A-Z0-9_]+$/.test(v)) return false; // nombre de variable de entorno
  return /\d/.test(v) && /[a-zA-Z]/.test(v);
}

/**
 * Un valor es placeholder (y por tanto aceptable) si es evidente que no es una
 * credencial real: nombre de variable, marcador, redacción, comillas vacías...
 */
function esPlaceholder(valor: string): boolean {
  const v = valor.trim().replace(/^[`"'*]+|[`"'*,.)]+$/g, '');
  if (v.length < 6) return true;
  const patrones = [
    /^-+$/,
    /change_me/i,
    /redactado/i,
    /^\$\{/,
    /^<.*>?$/,
    /^\.\.\./,
    /x{3,}/i,
    /^\*+$/,
    /placeholder/i,
    /your[-_]/i,
    /^tu[-_]/i,
    /^TU_/,
    /reemplazar/i,
    /example/i,
    /minimum/i,
    /caracteres/i,
    /app-specific/i,
    /^_?SEED_/i,
    /^_?E2E_/i,
    /^ADMIN_PASSWORD$/,
    /^\(/,
    /definida|definidas|obsoleta|variable/i
  ];
  return patrones.some((p) => p.test(v));
}

/** Documentación versionada que se revisa. */
function documentos(): string[] {
  const encontrados: string[] = [];

  const raiz = fs
    .readdirSync(ROOT)
    .filter((f) => f.endsWith('.md'))
    .map((f) => path.join(ROOT, f));
  encontrados.push(...raiz);

  const docsDir = path.join(ROOT, 'docs');
  const pila = [docsDir];
  while (pila.length > 0) {
    const dir = pila.pop() as string;
    for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
      const completa = path.join(dir, entrada.name);
      if (entrada.isDirectory()) {
        pila.push(completa);
      } else if (entrada.name.endsWith('.md') || entrada.name.endsWith('.example')) {
        encontrados.push(completa);
      }
    }
  }

  encontrados.push(path.join(ROOT, '.env.example'));
  encontrados.push(path.join(ROOT, '.env.e2e.example'));

  return encontrados.filter((f) => fs.existsSync(f));
}

function relativo(archivo: string): string {
  return path.relative(ROOT, archivo).replace(/\\/g, '/');
}

describe('INFRA-001: la documentación no publica credenciales', () => {
  const archivos = documentos();

  it('encuentra la documentación que debe revisar', () => {
    expect(archivos.length).toBeGreaterThan(10);
    expect(archivos.map(relativo)).toContain('README.md');
    expect(archivos.map(relativo)).toContain('docs/INSTALLATION.md');
  });

  it('ninguna contraseña comprometida sigue en la documentación', () => {
    const hallazgos: string[] = [];

    for (const archivo of archivos) {
      const contenido = fs.readFileSync(archivo, 'utf8');
      contenido.split(/\r?\n/).forEach((linea, i) => {
        for (const secreto of COMPROMETIDAS) {
          if (linea.includes(secreto)) {
            hallazgos.push(`${relativo(archivo)}:${i + 1}`);
          }
        }
      });
    }

    expect(hallazgos).toEqual([]);
  });

  it('ninguna variable de contraseña tiene un valor real asignado', () => {
    const hallazgos: string[] = [];

    for (const archivo of archivos) {
      const contenido = fs.readFileSync(archivo, 'utf8');
      contenido.split(/\r?\n/).forEach((linea, i) => {
        VARIABLES_DE_PASSWORD.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = VARIABLES_DE_PASSWORD.exec(linea)) !== null) {
          if (!esPlaceholder(m[2])) {
            hallazgos.push(`${relativo(archivo)}:${i + 1} -> ${m[1]}`);
          }
        }
      });
    }

    expect(hallazgos).toEqual([]);
  });

  it('ninguna línea documenta una contraseña con la etiqueta "Password:"', () => {
    const hallazgos: string[] = [];

    for (const archivo of archivos) {
      const contenido = fs.readFileSync(archivo, 'utf8');
      contenido.split(/\r?\n/).forEach((linea, i) => {
        ETIQUETA_DE_PASSWORD.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = ETIQUETA_DE_PASSWORD.exec(linea)) !== null) {
          if (pareceCredencial(m[1]) && !esPlaceholder(m[1])) {
            hallazgos.push(`${relativo(archivo)}:${i + 1} -> ${linea.trim().slice(0, 80)}`);
          }
        }
      });
    }

    expect(hallazgos).toEqual([]);
  });
});

describe('INFRA-016/017: la documentación no contradice al código', () => {
  const leer = (rel: string): string =>
    fs.readFileSync(path.join(ROOT, rel), 'utf8');

  it('el README manda copiar .env.example a .env (Prisma no lee .env.local)', () => {
    const readme = leer('README.md');
    expect(readme).toMatch(/cp \.env\.example \.env\b/);
    expect(readme).not.toMatch(/cp \.env\.example \.env\.local/);
  });

  it('ningún documento de instalación usa la variable obsoleta ADMIN_PASSWORD como si funcionara', () => {
    // El seed sólo lee SEED_*_PASSWORD; ADMIN_PASSWORD no tiene efecto.
    const seed = leer('prisma/seed.ts');
    expect(seed).toContain('SEED_ADMIN_PASSWORD');
    expect(seed).not.toMatch(/process\.env\.ADMIN_PASSWORD/);

    for (const rel of ['README.md', 'docs/INSTALLATION.md', 'docs/env.example']) {
      const contenido = leer(rel);
      const lineas = contenido
        .split(/\r?\n/)
        // ADMIN_PASSWORD a secas, no SEED_ADMIN_PASSWORD ni E2E_ADMIN_PASSWORD.
        .filter((l) => /(^|[^A-Z_])ADMIN_PASSWORD/.test(l))
        // Se permite nombrarla para decir que está obsoleta.
        .filter((l) => !/obsolet|ya no|no se usa|no existe|NO se|tampoco/i.test(l));
      expect({ rel, lineas }).toEqual({ rel, lineas: [] });
    }
  });

  it('el README documenta NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY, que es la que lee el código', () => {
    const readme = leer('README.md');
    expect(readme).toContain('NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY');

    const purchase = leer('src/app/credits/purchase/page.tsx');
    expect(purchase).toContain('process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY');
  });

  it('INFRA-013: ninguna guía vigente ordena `prisma migrate dev/reset` (sin baseline borran datos)', () => {
    // El historial de prisma/migrations no representa el esquema: `migrate dev`
    // detecta drift y ofrece resetear, y `migrate reset` borra todo. Sólo se
    // toleran en documentos marcados como históricos en su cabecera.
    const hallazgos: string[] = [];
    for (const archivo of documentos()) {
      if (/auditoria/i.test(relativo(archivo))) continue;
      const contenido = fs.readFileSync(archivo, 'utf8');
      const cabecera = contenido.split(/\r?\n/).slice(0, 15).join('\n');
      if (/Documento hist[oó]rico|OBSOLETO/i.test(cabecera)) continue;

      contenido.split(/\r?\n/).forEach((linea, i) => {
        if (/^\s*(?:\$\s*)?npx prisma migrate (?:dev|reset)\b/.test(linea)) {
          hallazgos.push(`${relativo(archivo)}:${i + 1}`);
        }
      });
    }
    expect(hallazgos).toEqual([]);
  });

  it('ningún documento ordena `npm run seed` (ese script no existe)', () => {
    const pkg = JSON.parse(leer('package.json')) as {
      scripts: Record<string, string>;
    };
    if (pkg.scripts.seed) return; // si alguien lo añade, el doc deja de mentir

    const hallazgos: string[] = [];
    for (const archivo of documentos()) {
      // Los informes de auditoría citan el comando como parte del hallazgo.
      if (/auditoria/i.test(relativo(archivo))) continue;
      const contenido = fs.readFileSync(archivo, 'utf8');
      if (/npm run seed\b/.test(contenido)) hallazgos.push(relativo(archivo));
    }
    expect(hallazgos).toEqual([]);
  });
});
