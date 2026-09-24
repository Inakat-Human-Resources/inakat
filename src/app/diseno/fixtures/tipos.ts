// RUTA: src/app/diseno/fixtures/tipos.ts
import type { RolApp } from '@/lib/nav-app';

/** Lo que recibe una respuesta calculada. */
export interface ContextoFixture {
  url: URL;
  metodo: string;
  /** Cuerpo de la petición ya parseado (JSON o FormData → objeto). */
  cuerpo: unknown;
  /** Rol del banco (?rol= o el de la ruta). */
  rol: RolApp;
  /** Segmentos con nombre del patrón: '/api/jobs/:id' → { id: '7' }. */
  params: Record<string, string>;
}

/**
 * Una respuesta simulada.
 *
 *   { metodo: 'GET', patron: '/api/company/dashboard', respuesta: { success: true, data: … } }
 *   { metodo: 'GET', patron: '/api/jobs/:id', respuesta: ({ params }) => ({ success: true, data: vacante(+params.id) }) }
 *   { metodo: 'POST', patron: '/api/jobs', estado: 400, respuesta: { success: false, error: 'Faltan campos' } }
 *
 * - patron (texto): se compara con el pathname SIN query; ':nombre' captura un
 *   tramo y '*' cualquier cosa. patron (RegExp): se compara con pathname+query.
 * - Gana la PRIMERA que coincide: las de los bloques van antes que las base.
 */
export type RespuestaFixture =
  | ((ctx: ContextoFixture) => unknown)
  | Record<string, unknown>
  | unknown[]
  | string
  | number
  | boolean
  | null;

export interface Fixture {
  metodo: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | '*';
  patron: string | RegExp;
  /** El cuerpo JSON, o una función que lo calcula (puede devolver un Response). */
  respuesta: RespuestaFixture;
  /** Código HTTP (por defecto 200). */
  estado?: number;
  /** Milisegundos de espera, para ver los estados de carga. */
  retraso?: number;
}
