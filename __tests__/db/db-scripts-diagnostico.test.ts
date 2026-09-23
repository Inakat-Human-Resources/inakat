// RUTA: __tests__/db/db-scripts-diagnostico.test.ts
//
// Hallazgos DB-023 y DB-024:
//   • scripts/fix-assignment-status.ts MUTABA el JobAssignment del jobId 19
//     hardcodeado, y scripts/verify-ludim.ts consultaba el specialistId 11 de
//     una persona concreta: parches de una incidencia pasada que seguían
//     versionados y dentro del type-check.
//   • scripts/debug-assignments.ts volcaba a consola nombres y correos del staff
//     y de todos los candidatos, sin try/finally y con el catch tragándose el
//     fallo (salía con código 0).

import fs from 'fs';
import path from 'path';

const SCRIPTS_DIR = path.join(process.cwd(), 'scripts');

const archivos = fs.existsSync(SCRIPTS_DIR)
  ? fs.readdirSync(SCRIPTS_DIR).filter(f => f.endsWith('.ts'))
  : [];

function leer(archivo: string): string {
  return fs
    .readFileSync(path.join(SCRIPTS_DIR, archivo), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map(l => l.replace(/\/\/.*$/, ''))
    .join('\n');
}

describe('DB-023 · los scripts de parche puntual ya no están versionados', () => {
  it('no existe fix-assignment-status.ts (mutaba el jobId 19 de otra base)', () => {
    expect(archivos).not.toContain('fix-assignment-status.ts');
  });

  it('no existe verify-ludim.ts (consultaba el specialistId 11 fijo)', () => {
    expect(archivos).not.toContain('verify-ludim.ts');
  });

  it('ningún script escribe en la base', () => {
    const escrituras = /prisma\.\w+\.(update|updateMany|create|createMany|delete|deleteMany|upsert)\(/;
    archivos.forEach(a => {
      expect({ archivo: a, escribe: escrituras.test(leer(a)) }).toEqual({
        archivo: a,
        escribe: false
      });
    });
  });

  it('ningún script trae ids de producción hardcodeados', () => {
    archivos.forEach(a => {
      const src = leer(a);
      expect(src).not.toMatch(/jobId:\s*\d+/);
      expect(src).not.toMatch(/specialistId:\s*\d+/);
      expect(src).not.toMatch(/recruiterId:\s*\d+/);
    });
  });
});

describe('DB-024 · debug-assignments.ts es una herramienta parametrizada y sin PII', () => {
  const src = () => leer('debug-assignments.ts');

  it('sigue existiendo como utilidad de diagnóstico', () => {
    expect(archivos).toContain('debug-assignments.ts');
  });

  it('acepta filtros por especialista y por vacante', () => {
    expect(src()).toContain("leerArgumento('specialist-email')");
    expect(src()).toContain("leerArgumento('job-id')");
  });

  it('valida el argumento numérico en vez de confiar en él', () => {
    expect(src()).toMatch(/Number\.isInteger\(jobId\)/);
  });

  it('enmascara nombres y correos salvo que se pida --show-pii explícitamente', () => {
    const contenido = src();
    expect(contenido).toContain("process.argv.includes('--show-pii')");
    expect(contenido).toMatch(/function enmascarar/);
    // Todo lo que se imprime de una persona pasa por enmascarar()
    expect(contenido).not.toMatch(/\$\{(s|a|app)\.(email|candidateName)\}/);
    expect(contenido).not.toMatch(/\$\{a\.(recruiter|specialist)\?\.nombre/);
  });

  it('no lista candidato por candidato: agrupa por estado', () => {
    expect(src()).toContain('prisma.application.groupBy');
  });

  it('imprime el host de la base contra la que corre', () => {
    expect(src()).toContain('hostDeBaseDeDatos');
    expect(src()).toContain("console.log('   Base de datos:'");
  });

  it('marca el proceso como fallido si el diagnóstico revienta', () => {
    const contenido = src();
    expect(contenido).toContain('process.exitCode = 1');
    expect(contenido).toMatch(/\.finally\(/);
    expect(contenido).toContain('prisma.$disconnect()');
  });
});
