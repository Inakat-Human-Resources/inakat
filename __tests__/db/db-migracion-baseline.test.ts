// RUTA: __tests__/db/db-migracion-baseline.test.ts
//
// Hallazgo DB-001: las 7 migraciones anteriores solo creaban 7 de las 22 tablas
// del schema (el resto se aplicó con 'prisma db push'), así que un entorno nuevo
// levantado con 'prisma migrate deploy' quedaba sin 15 tablas y sin 24 columnas,
// y el primer findUnique del seed o del login reventaba con P2022.
//
// Este test comprueba que el historial de migraciones ya representa el schema y
// que la migración añadida es aditiva e idempotente (segura sobre la base de
// producción, que ya tiene todo aplicado por db push).

import fs from 'fs';
import path from 'path';

const RAIZ = process.cwd();
const SCHEMA_PATH = path.join(RAIZ, 'prisma', 'schema.prisma');
const MIGRATIONS_DIR = path.join(RAIZ, 'prisma', 'migrations');
const BASELINE = '20260922000000_baseline_drift_e_indices';

const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');

const carpetas = fs
  .readdirSync(MIGRATIONS_DIR)
  .filter(d => fs.existsSync(path.join(MIGRATIONS_DIR, d, 'migration.sql')))
  .sort();

const sqlPorMigracion = new Map<string, string>(
  carpetas.map(d => [d, fs.readFileSync(path.join(MIGRATIONS_DIR, d, 'migration.sql'), 'utf8')])
);
const sqlCompleto = [...sqlPorMigracion.values()].join('\n');
const sqlBaseline = sqlPorMigracion.get(BASELINE) || '';

// --- Utilidades de lectura del schema ---------------------------------------
const TIPOS_ESCALARES = ['String', 'Int', 'Float', 'Boolean', 'DateTime', 'Json', 'Decimal', 'BigInt', 'Bytes'];

function modelos(): Map<string, string> {
  const resultado = new Map<string, string>();
  for (const m of schema.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)) {
    resultado.set(m[1], m[2]);
  }
  return resultado;
}

function camposEscalares(cuerpo: string): string[] {
  return cuerpo
    .split('\n')
    .map(l => l.replace(/\/\/.*$/, '').trim())
    .filter(Boolean)
    .filter(l => !l.startsWith('@@'))
    .map(l => l.match(/^(\w+)\s+(\w+)(\[\])?\??/))
    .filter((m): m is RegExpMatchArray => !!m)
    .filter(m => TIPOS_ESCALARES.includes(m[2]))
    .map(m => m[1]);
}

describe('DB-001 · el historial de migraciones representa el schema', () => {
  it('la migración baseline existe', () => {
    expect(carpetas).toContain(BASELINE);
    expect(sqlBaseline.length).toBeGreaterThan(0);
  });

  it('la baseline es la última del historial (se aplica después de las 7 previas)', () => {
    expect(carpetas[carpetas.length - 1]).toBe(BASELINE);
  });

  it('todos los modelos del schema tienen su CREATE TABLE en alguna migración', () => {
    const sinTabla = [...modelos().keys()].filter(
      nombre => !new RegExp(`CREATE TABLE (IF NOT EXISTS )?"${nombre}"`).test(sqlCompleto)
    );
    expect(sinTabla).toEqual([]);
  });

  it('las tablas que ya existían reciben por ALTER las columnas que les faltaban', () => {
    const tablasPrevias = ['User', 'CompanyRequest', 'ContactMessage', 'Job', 'Application'];
    const faltantes: string[] = [];

    for (const tabla of tablasPrevias) {
      const cuerpo = modelos().get(tabla);
      expect(cuerpo).toBeDefined();
      for (const campo of camposEscalares(cuerpo!)) {
        if (!new RegExp(`"${campo}"`).test(sqlCompleto)) faltantes.push(`${tabla}.${campo}`);
      }
    }

    expect(faltantes).toEqual([]);
  });

  it('cubre en concreto las columnas que rompían un entorno nuevo', () => {
    const columnas = [
      ['User', 'credits'],
      ['User', 'specialty'],
      ['User', 'resetToken'],
      ['CompanyRequest', 'logoUrl'],
      ['Job', 'creditCost'],
      ['Job', 'profile'],
      ['Job', 'seniority'],
      ['Job', 'isConfidential'],
      ['Job', 'editableUntil']
    ];

    columnas.forEach(([tabla, columna]) => {
      expect(sqlBaseline).toMatch(
        new RegExp(`ALTER TABLE "${tabla}" ADD COLUMN IF NOT EXISTS "${columna}"`)
      );
    });
  });
});

describe('DB-001 · la migración baseline es aditiva e idempotente', () => {
  it('no contiene ninguna sentencia destructiva', () => {
    expect(sqlBaseline).not.toMatch(/DROP TABLE/i);
    expect(sqlBaseline).not.toMatch(/DROP COLUMN/i);
    expect(sqlBaseline).not.toMatch(/TRUNCATE/i);
    expect(sqlBaseline).not.toMatch(/DELETE FROM/i);
    expect(sqlBaseline).not.toMatch(/DROP INDEX/i);
  });

  it('todo CREATE TABLE lleva IF NOT EXISTS', () => {
    const creates = sqlBaseline.match(/CREATE TABLE[^(]*/g) || [];
    expect(creates.length).toBeGreaterThan(0);
    creates.forEach(c => expect(c).toContain('IF NOT EXISTS'));
  });

  it('todo CREATE INDEX lleva IF NOT EXISTS', () => {
    const indices = sqlBaseline.match(/CREATE (UNIQUE )?INDEX[^(]*/g) || [];
    expect(indices.length).toBeGreaterThan(0);
    indices.forEach(i => expect(i).toContain('IF NOT EXISTS'));
  });

  it('toda ADD CONSTRAINT va protegida por una consulta a pg_constraint', () => {
    const lineas = sqlBaseline
      .split(/\r?\n/)
      .map((l, i) => ({ l, i }))
      .filter(({ l }) => /ADD CONSTRAINT/.test(l));

    expect(lineas.length).toBeGreaterThan(0);

    const todas = sqlBaseline.split(/\r?\n/);
    lineas.forEach(({ i }) => {
      const contexto = todas.slice(Math.max(0, i - 3), i).join('\n');
      expect(contexto).toContain('pg_constraint');
    });
  });

  it('el único DEFAULT que toca es el de companyRating (DB-003)', () => {
    const alteraciones = sqlBaseline.match(/ALTER COLUMN[^;]*/g) || [];
    expect(alteraciones).toEqual(['ALTER COLUMN "companyRating" DROP DEFAULT']);
  });
});

describe('DB-008/DB-009/DB-022 · unicidades nuevas sin borrar datos', () => {
  it('el índice único de Application solo se crea si no hay duplicados', () => {
    const bloque = sqlBaseline.slice(
      sqlBaseline.indexOf('Application_jobId_candidateEmail_key'),
      sqlBaseline.indexOf('Application_jobId_candidateEmail_key') + 900
    );
    expect(bloque).toContain('HAVING COUNT(*) > 1');
    expect(bloque).toContain('IF dups = 0 THEN');
    expect(bloque).toContain('RAISE WARNING');
  });

  it('PricingMatrix recibe el índice único parcial para location NULL', () => {
    expect(sqlBaseline).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS "PricingMatrix_profile_seniority_workMode_null_location_key"[\s\S]{0,200}WHERE "location" IS NULL/
    );
  });

  it('DiscountCode recibe la unicidad por vendor', () => {
    expect(sqlBaseline).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS "DiscountCode_userId_key" ON "DiscountCode" \("userId"\)/
    );
  });

  it('IntegrationWebhook recibe la unicidad de URL activa por empresa', () => {
    expect(sqlBaseline).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS "IntegrationWebhook_userId_url_active_key"[\s\S]{0,200}WHERE "isActive"/
    );
  });
});

describe('DB-003/DB-006/DB-008/DB-016/DB-020 · el schema declara lo acordado', () => {
  const job = () => modelos().get('Job')!;
  const application = () => modelos().get('Application')!;
  const creditTransaction = () => modelos().get('CreditTransaction')!;

  it('companyRating ya no nace en 5.0', () => {
    expect(job()).toMatch(/companyRating\s+Float\?/);
    expect(job()).not.toMatch(/companyRating[^\n]*@default/);
  });

  it('Application tiene unicidad (jobId, candidateEmail)', () => {
    expect(application()).toContain('@@unique([jobId, candidateEmail])');
  });

  // El build corre 'prisma generate' pero no aplica migraciones: una columna
  // nueva en el schema haría que el cliente la pidiera en cada SELECT y
  // reventara con P2022 en producción hasta que alguien sincronizara la base.
  // Por eso la baseline solo puede añadir columnas que el schema YA declaraba.
  it('la baseline no añade columnas que el schema no declare', () => {
    const agregadas = [
      ...sqlBaseline.matchAll(/ALTER TABLE "(\w+)" ADD COLUMN IF NOT EXISTS "(\w+)"/g)
    ].map(m => ({ tabla: m[1], columna: m[2] }));

    expect(agregadas.length).toBeGreaterThan(0);

    const huerfanas = agregadas.filter(({ tabla, columna }) => {
      const cuerpo = modelos().get(tabla);
      return !cuerpo || !camposEscalares(cuerpo).includes(columna);
    });
    expect(huerfanas).toEqual([]);
  });

  it('Application no gana una columna candidateId que ningún código usa (DB-006 va por la ruta)', () => {
    expect(camposEscalares(application())).not.toContain('candidateId');
    expect(sqlBaseline).not.toMatch(/ALTER TABLE "Application" ADD COLUMN[^;]*"candidateId"/);
    expect(sqlBaseline).not.toContain('Application_candidateId_fkey');
  });

  it('existen los índices compuestos que sí usan las consultas', () => {
    expect(application()).toContain('@@index([jobId, status])');
    expect(creditTransaction()).toContain('@@index([userId, createdAt])');
    expect(creditTransaction()).toContain('@@index([purchaseId])');
  });
});

describe('DB-019 · los comentarios del schema ya no contradicen al código', () => {
  it('no queda ninguna referencia a Conekta', () => {
    expect(schema).not.toMatch(/Conekta/i);
  });

  it('packageType documenta el valor que escribe el código', () => {
    expect(schema).toMatch(/packageType[^\n]*pack_1"/);
    expect(schema).not.toMatch(/packageType[^\n]*"single"/);
  });

  it('la nota de roles incluye vendor', () => {
    const nota = schema.slice(schema.indexOf('NOTA: Roles válidos en User'));
    expect(nota.slice(0, 300)).toContain('"vendor"');
  });

  it('se eliminó el bloque de instrucciones ya aplicadas', () => {
    expect(schema).not.toContain('AGREGAR AL MODELO User');
    expect(schema).not.toContain('AGREGAR AL MODELO Job');
  });
});
