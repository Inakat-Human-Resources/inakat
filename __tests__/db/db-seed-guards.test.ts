// RUTA: __tests__/db/db-seed-guards.test.ts
//
// Hallazgos DB-002 y DB-010 (docs/auditoria-2026-09/db.md):
//   • validateEnvVars solo comprobaba presencia: los placeholders 'CHANGE_ME_*'
//     de .env.example pasaban la validación y quedaban como contraseña real.
//   • main() no comprobaba NODE_ENV ni el host de DATABASE_URL: el seed podía
//     correr contra producción y sembrar empresas demo, vacantes falsas y un
//     admin extra.
//   • ADMIN_EMAIL no se normalizaba a minúsculas aunque el login busca
//     email.toLowerCase().

import {
  HOSTS_LOCALES,
  LONGITUD_MINIMA_PASSWORD,
  esBaseLocal,
  esPasswordInvalida,
  hostDeBaseDeDatos,
  motivoParaBloquearSeed,
  normalizarEmail
} from '../../prisma/seed-guards';

describe('DB-002 · contraseñas del seed', () => {
  it('rechaza los placeholders publicados en .env.example', () => {
    expect(esPasswordInvalida('CHANGE_ME_ADMIN_PASSWORD')).toBe(true);
    expect(esPasswordInvalida('changeme_super_secreto')).toBe(true);
    expect(esPasswordInvalida('CAMBIAME_POR_FAVOR_YA')).toBe(true);
    expect(esPasswordInvalida('TU_PASSWORD_AQUI_LARGO')).toBe(true);
    expect(esPasswordInvalida('XXXXXXXXXXXXXXXXXXX')).toBe(true);
  });

  it('rechaza contraseñas ausentes o más cortas que el mínimo', () => {
    expect(esPasswordInvalida(undefined)).toBe(true);
    expect(esPasswordInvalida('')).toBe(true);
    expect(esPasswordInvalida('a'.repeat(LONGITUD_MINIMA_PASSWORD - 1))).toBe(true);
  });

  it('acepta una contraseña propia de longitud suficiente', () => {
    expect(esPasswordInvalida('a'.repeat(LONGITUD_MINIMA_PASSWORD))).toBe(false);
    expect(esPasswordInvalida('un-secreto-de-verdad-2026')).toBe(false);
  });

  it('exige al menos 12 caracteres', () => {
    expect(LONGITUD_MINIMA_PASSWORD).toBeGreaterThanOrEqual(12);
  });
});

describe('DB-010 · el seed no debe correr contra producción', () => {
  const urlLocal = 'postgresql://user:pass@localhost:5432/inakat';
  const urlRemota = 'postgresql://user:pass@db.abcdefgh.supabase.co:5432/postgres';

  it('bloquea cuando NODE_ENV es production', () => {
    expect(
      motivoParaBloquearSeed({ NODE_ENV: 'production', DATABASE_URL: urlLocal })
    ).toBe('produccion');
  });

  it('bloquea cuando DATABASE_URL no apunta a una base local', () => {
    expect(
      motivoParaBloquearSeed({ NODE_ENV: 'development', DATABASE_URL: urlRemota })
    ).toBe('host-remoto');
  });

  it('bloquea cuando no hay DATABASE_URL (host desconocido)', () => {
    expect(motivoParaBloquearSeed({ NODE_ENV: 'development' })).toBe('host-remoto');
  });

  it('deja pasar una base local en desarrollo', () => {
    expect(
      motivoParaBloquearSeed({ NODE_ENV: 'development', DATABASE_URL: urlLocal })
    ).toBeNull();
  });

  it('solo SEED_ALLOW_REMOTE=1 autoriza una base remota o producción', () => {
    expect(
      motivoParaBloquearSeed({
        NODE_ENV: 'production',
        DATABASE_URL: urlRemota,
        SEED_ALLOW_REMOTE: '1'
      })
    ).toBeNull();

    // Cualquier otro valor NO autoriza
    expect(
      motivoParaBloquearSeed({
        NODE_ENV: 'production',
        DATABASE_URL: urlRemota,
        SEED_ALLOW_REMOTE: 'true'
      })
    ).toBe('produccion');
  });

  it('extrae el host sin exponer usuario ni contraseña', () => {
    expect(hostDeBaseDeDatos(urlRemota)).toBe('db.abcdefgh.supabase.co');
    expect(hostDeBaseDeDatos(urlRemota)).not.toContain('pass');
    expect(hostDeBaseDeDatos('no-es-una-url')).toBe('');
    expect(hostDeBaseDeDatos(undefined)).toBe('');
  });

  it('solo considera locales los hosts de desarrollo', () => {
    HOSTS_LOCALES.forEach(h => expect(esBaseLocal(h)).toBe(true));
    expect(esBaseLocal('db.abcdefgh.supabase.co')).toBe(false);
    expect(esBaseLocal('')).toBe(false);
  });
});

describe('DB-010 · ADMIN_EMAIL se normaliza como en el login', () => {
  it('pasa a minúsculas y recorta espacios', () => {
    expect(normalizarEmail('  Admin@INAKAT.com ')).toBe('admin@inakat.com');
  });

  it('coincide con lo que busca el login (email.toLowerCase())', () => {
    const capturado = ' ADMIN@Inakat.com ';
    expect(normalizarEmail(capturado)).toBe(capturado.trim().toLowerCase());
  });
});
