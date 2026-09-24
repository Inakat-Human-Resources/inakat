// RUTA: src/app/diseno/_banco/simulador.ts
//
// window.fetch simulado para el banco de pruebas (/diseno/vista/…): responde
// a /api/* con las fixtures de src/app/diseno/fixtures y deja pasar todo lo
// demás (los chunks y los datos RSC de Next siguen yendo a la red).
//
// Sólo existe en desarrollo: /diseno responde 404 en producción.

import type { RolApp } from '@/lib/nav-app';
import { FIXTURES, type ContextoFixture, type Fixture } from '../fixtures';

declare global {
  interface Window {
    __inakatFetchOriginal?: typeof fetch;
  }
}

let rolActual: RolApp = 'admin';
const sinFixture = new Set<string>();
const oyentes = new Set<(lista: string[]) => void>();

/** El rol con el que responde /api/auth/me (y cualquier fixture que lo consulte). */
export function fijarRolSimulado(rol: RolApp) {
  rolActual = rol;
}

/** Peticiones /api que no encontraron fixture (el banco las lista en pantalla). */
export function suscribirSinFixture(fn: (lista: string[]) => void): () => void {
  oyentes.add(fn);
  fn([...sinFixture]);
  return () => {
    oyentes.delete(fn);
  };
}

function avisarSinFixture(clave: string) {
  if (sinFixture.has(clave)) return;
  sinFixture.add(clave);
  const lista = [...sinFixture];
  oyentes.forEach((fn) => fn(lista));
}

/** '/api/admin/jobs/:id/pipeline' → RegExp con grupos con nombre. '*' = cualquier tramo. */
export function patronARegExp(patron: string): RegExp {
  const cuerpo = patron
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/:([A-Za-z_]\w*)/g, '(?<$1>[^/]+)');
  return new RegExp(`^${cuerpo}$`);
}

function coincide(f: Fixture, metodo: string, url: URL): Record<string, string> | null {
  if (f.metodo !== '*' && f.metodo !== metodo) return null;
  if (f.patron instanceof RegExp) {
    const m = f.patron.exec(url.pathname + url.search);
    return m ? { ...(m.groups ?? {}) } : null;
  }
  const m = patronARegExp(f.patron).exec(url.pathname);
  return m ? { ...(m.groups ?? {}) } : null;
}

async function leerCuerpo(init?: RequestInit): Promise<unknown> {
  const b = init?.body;
  if (b == null) return undefined;
  if (typeof b === 'string') {
    try {
      return JSON.parse(b);
    } catch {
      return b;
    }
  }
  if (b instanceof FormData) return Object.fromEntries(b.entries());
  return b;
}

const json = (datos: unknown, estado = 200) =>
  new Response(JSON.stringify(datos), {
    status: estado,
    headers: { 'Content-Type': 'application/json' },
  });

/** Devuelve el fetch real (al salir del banco). */
export function desinstalarSimulador(): void {
  if (typeof window === 'undefined' || !window.__inakatFetchOriginal) return;
  window.fetch = window.__inakatFetchOriginal;
  delete window.__inakatFetchOriginal;
}

/** Instala el simulador (idempotente: si ya está, no hace nada). */
export function instalarSimulador(): void {
  if (typeof window === 'undefined' || window.__inakatFetchOriginal) return;
  const original = window.fetch.bind(window);
  window.__inakatFetchOriginal = original;

  window.fetch = async (entrada: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const texto = typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
    const url = new URL(texto, window.location.origin);
    if (url.origin !== window.location.origin || !url.pathname.startsWith('/api/')) {
      return original(entrada as RequestInfo, init);
    }

    const metodo = (init?.method || (entrada instanceof Request ? entrada.method : 'GET')).toUpperCase();
    const cuerpo = await leerCuerpo(init);

    for (const f of FIXTURES) {
      const params = coincide(f, metodo, url);
      if (!params) continue;
      const ctx: ContextoFixture = { url, metodo, cuerpo, rol: rolActual, params };
      if (f.retraso) await new Promise((r) => setTimeout(r, f.retraso));
      const datos = typeof f.respuesta === 'function' ? (f.respuesta as (c: ContextoFixture) => unknown)(ctx) : f.respuesta;
      if (datos instanceof Response) return datos;
      return json(datos, f.estado ?? 200);
    }

    const clave = `${metodo} ${url.pathname}`;
    console.warn(`[banco] Sin fixture: ${clave}${url.search}`);
    avisarSinFixture(clave);
    return json({ success: false, error: `Sin fixture en el banco de pruebas: ${clave}` }, 404);
  };
}
