/**
 * @jest-environment node
 */

// RUTA: __tests__/infra/infra-tests-reales.test.ts
//
// INFRA-003 / INFRA-004 / INFRA-005 / INFRA-018 / INFRA-019 / INFRA-022:
// 35 suites de jest no importaban ni leían código de la app. Llamaban a sus
// propios jest.fn() de prisma y afirmaban que se habían llamado, o copiaban una
// función/whitelist dentro del test y la comparaban consigo misma. Sumaban
// cientos de "tests en verde" sin ejecutar una línea de producción, y algunas
// afirmaban lo CONTRARIO del código (evaluation-notes decía que 'company' no
// puede ver notas; credits-hardening validaba un chequeo que no existe;
// confidential-sanitization probaba la lógica de ubicación anterior a VAC-022).
//
// Se borraron. Su cobertura real vive hoy en las suites por módulo que ejecutan
// los handlers (adm-*, auth-*, emp-*, eval-*, pago-*, perf-*, vac-*, jobs-*,
// middleware-exceptions, smoke/api-endpoints...).
//
// Este test impide que vuelvan: toda suite de __tests__ tiene que tocar código
// de la app — importarlo/requerirlo (mockear '@/lib/prisma' no cuenta) o leer
// un archivo del repo.

import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '..', '..');
const TESTS = path.join(ROOT, '__tests__');

function suites(): string[] {
  const encontradas: string[] = [];
  const pila = [TESTS];
  while (pila.length > 0) {
    const dir = pila.pop() as string;
    for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
      const completa = path.join(dir, entrada.name);
      if (entrada.isDirectory()) {
        // Playwright tiene su propia suite (specs contra el navegador).
        if (entrada.name === 'e2e') continue;
        pila.push(completa);
      } else if (/\.test\.tsx?$/.test(entrada.name)) {
        encontradas.push(completa);
      }
    }
  }
  return encontradas;
}

function relativo(archivo: string): string {
  return path.relative(ROOT, archivo).replace(/\\/g, '/');
}

/** Especificadores de módulo que la suite importa o requiere. */
function modulosImportados(fuente: string): string[] {
  const especificadores: string[] = [];
  const patrones = [
    /\bimport\s+(?:type\s+)?[^'"`;]*?from\s+['"]([^'"]+)['"]/g,
    /\bimport\s+['"]([^'"]+)['"]/g,
    /\b(?:require|import)\(\s*['"]([^'"]+)['"]\s*\)/g
  ];
  for (const patron of patrones) {
    let m: RegExpExecArray | null;
    while ((m = patron.exec(fuente)) !== null) especificadores.push(m[1]);
  }
  return especificadores;
}

/**
 * ¿La suite ejecuta o inspecciona código de la app?
 *  - importa/requiere algo de '@/...' que no sea el cliente de prisma (que en
 *    estas suites siempre es un mock), o un archivo relativo del repo; o
 *  - usa un PrismaClient real contra una base de pruebas; o
 *  - lee archivos del repo con fs.
 */
function tocaCodigoDeLaApp(fuente: string): boolean {
  const sinComentarios = fuente
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

  const importaApp = modulosImportados(sinComentarios).some((m) => {
    if (m === '@/lib/prisma') return false;
    return m.startsWith('@/') || m.startsWith('./') || m.startsWith('../');
  });
  if (importaApp) return true;

  // Test de integración contra una base real (no un mock del cliente).
  if (/\bnew PrismaClient\(/.test(sinComentarios) && !/jest\.mock\(\s*['"]@prisma\/client['"]/.test(sinComentarios)) {
    return true;
  }

  return /\b(?:readFileSync|readdirSync|existsSync)\s*\(/.test(sinComentarios);
}

describe('INFRA-003: toda suite de jest ejercita código de la app', () => {
  it('el detector distingue una suite tautológica de una real', () => {
    const tautologica = `
      import { describe, it, expect } from '@jest/globals';
      import { prisma } from '@/lib/prisma';
      jest.mock('@/lib/prisma', () => ({ prisma: { user: { findUnique: jest.fn() } } }));
      // import { GET } from '@/app/api/users/route';
      it('x', async () => {
        await prisma.user.findUnique({ where: { id: 1 } });
        expect(prisma.user.findUnique).toHaveBeenCalled();
      });
    `;
    const conHandler = `
      jest.mock('@/lib/prisma', () => ({ prisma: {} }));
      import { GET } from '@/app/api/users/route';
    `;
    const conImportDinamico = `const { POST } = await import('@/app/api/company-requests/route');`;
    const conFuente = `const c = fs.readFileSync(path.join(ROOT, 'src/middleware.ts'), 'utf8');`;
    const conConfig = `import nextConfig from '../../next.config';`;

    expect(tocaCodigoDeLaApp(tautologica)).toBe(false);
    expect(tocaCodigoDeLaApp(conHandler)).toBe(true);
    expect(tocaCodigoDeLaApp(conImportDinamico)).toBe(true);
    expect(tocaCodigoDeLaApp(conFuente)).toBe(true);
    expect(tocaCodigoDeLaApp(conConfig)).toBe(true);
  });

  it('encuentra las suites que tiene que revisar', () => {
    const rel = suites().map(relativo);
    expect(rel.length).toBeGreaterThan(50);
    expect(rel).toContain('__tests__/infra/infra-tests-reales.test.ts');
    expect(rel.some((r) => r.startsWith('__tests__/e2e/'))).toBe(false);
  });

  it('ninguna suite se limita a probar sus propios mocks o constantes', () => {
    const tautologicas = suites()
      .filter((archivo) => !tocaCodigoDeLaApp(fs.readFileSync(archivo, 'utf8')))
      .map(relativo);

    expect(tautologicas).toEqual([]);
  });
});
