/**
 * @jest-environment node
 */

/*
 * El banco de pruebas de diseño (/diseno) no puede existir en producción.
 *
 * Su layout ya llama a notFound(), pero el loading.tsx raíz abre el streaming
 * antes y la respuesta salía con estado 200. El middleware lo corta antes: 404
 * duro en producción y paso libre (sin pedir sesión) en desarrollo.
 *
 * `process.env.NODE_ENV` se fija al compilar (aquí vale 'test'), así que la
 * rama de producción no se puede simular en tiempo de ejecución: se comprueba
 * en el código, y de verdad con `next build && next start` + curl.
 */
import fs from 'fs';
import path from 'path';
import { NextRequest } from 'next/server';

jest.mock('@/lib/prisma', () => ({ prisma: { user: { findUnique: jest.fn() } } }));

async function pedir(ruta: string) {
  const { middleware } = await import('@/middleware');
  return middleware(new NextRequest(`http://localhost:3000${ruta}`));
}

describe('/diseno en el middleware', () => {
  it('fuera de producción pasa sin sesión (no redirige al login)', async () => {
    for (const ruta of ['/diseno', '/diseno/vista/admin', '/diseno/vista/company/jobs/101/candidates']) {
      const res = await pedir(ruta);
      expect(res.status).toBe(200);
      expect(res.headers.get('location')).toBeNull();
    }
  });

  it('en producción responde 404 antes de renderizar nada', () => {
    const codigo = fs.readFileSync(path.join(process.cwd(), 'src/middleware.ts'), 'utf-8');
    expect(codigo).toMatch(
      /pathname === '\/diseno' \|\| pathname\.startsWith\('\/diseno\/'\)[\s\S]{0,300}NODE_ENV === 'production'[\s\S]{0,80}status: 404/
    );
  });

  it('el matcher incluye /diseno (si no, el middleware ni se ejecuta)', async () => {
    const { config } = await import('@/middleware');
    expect(config.matcher).toEqual(expect.arrayContaining(['/diseno', '/diseno/:path*']));
  });
});
