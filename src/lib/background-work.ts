// RUTA: src/lib/background-work.ts

import { after } from 'next/server';

/**
 * Ejecuta trabajo pendiente DESPUÉS de enviar la respuesta, pero con la función
 * todavía viva.
 *
 * El patrón `algo().catch(() => {})` sin await (fire-and-forget) no sirve en
 * serverless: en Vercel la lambda puede congelarse en cuanto sale la respuesta,
 * así que la notificación a los admins o el webhook firmado hacia Worky2 —que
 * hace varias consultas y un fetch de hasta 5 s— se perdían a mitad, sin rastro
 * y sin reintento. `after()` de next/server (estable desde Next 15.1) mantiene
 * la ejecución hasta que el trabajo termina.
 *
 * `after()` sólo existe dentro del ámbito de una petición: fuera de él lanza.
 * En ese caso (tests, scripts) se degrada al fire-and-forget de siempre, que es
 * exactamente el comportamiento anterior.
 */
export function runAfterResponse(tarea: () => Promise<unknown>): void {
  // EMP-009/EMP-013: `ejecutar` DEVUELVE la promesa. Si el callback de after()
  // no la devuelve, after() no tiene nada que esperar y la lambda puede
  // congelarse igual que con el fire-and-forget original.
  const ejecutar = (): Promise<void> =>
    tarea().then(
      () => undefined,
      (e) => {
        console.error('[background] Tarea posterior a la respuesta falló:', e);
      }
    );

  try {
    after(ejecutar);
  } catch {
    void ejecutar();
  }
}
