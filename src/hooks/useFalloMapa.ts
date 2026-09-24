// RUTA: src/hooks/useFalloMapa.ts

'use client';

import { useEffect, useState, type RefObject } from 'react';

/**
 * ¿Google Maps rechazó la clave de esta página?
 *
 * Con la clave sin facturación (BillingNotEnabledMapError), inválida o sin
 * permiso para el dominio, el script SÍ carga (`useLoadScript` no da
 * `loadError`), pero Google pinta encima del mapa su diálogo en inglés («This
 * page can't load Google Maps correctly») y apaga el autocompletado. Este
 * gancho detecta ese rechazo para que el formulario caiga a su respaldo: el
 * campo de dirección escrito a mano, sin mapa. No cambia datos ni llamadas.
 *
 * Dos vías, porque ninguna basta sola:
 * - `window.gm_authFailure`: Google la llama cuando falla la autenticación de
 *   la clave. Se encadena con la que ya hubiera.
 * - El DOM del mapa: si el script ya había fallado antes (otra página de la
 *   misma sesión), la función no se vuelve a llamar, pero cada mapa nuevo trae
 *   el diálogo (`.dismissButton`) o la caja de error (`.gm-err-container`).
 *
 * El rechazo vale para toda la sesión (es la misma clave), así que se recuerda
 * a nivel de módulo.
 */

const SELECTOR_ERROR_GOOGLE = '.gm-err-container, .dismissButton';

let rechazada = false;
let vigiaInstalado = false;
const oyentes = new Set<() => void>();

function marcarRechazo() {
  if (rechazada) return;
  rechazada = true;
  oyentes.forEach((avisar) => avisar());
}

function instalarVigia() {
  if (vigiaInstalado || typeof window === 'undefined') return;
  vigiaInstalado = true;
  const ventana = window as Window & { gm_authFailure?: () => void };
  const previa = ventana.gm_authFailure;
  ventana.gm_authFailure = () => {
    marcarRechazo();
    previa?.();
  };
}

/**
 * @param contenedor Envoltorio del `<GoogleMap>` (donde Google mete su aviso).
 * @param mapaVisible Si el mapa está pintado ahora mismo.
 * @returns `true` en cuanto Google rechaza la clave.
 */
export function useFalloMapa(
  contenedor: RefObject<HTMLElement | null>,
  mapaVisible: boolean
): boolean {
  const [fallo, setFallo] = useState(rechazada);

  useEffect(() => {
    instalarVigia();
    if (rechazada) {
      setFallo(true);
      return;
    }
    const avisar = () => setFallo(true);
    oyentes.add(avisar);
    return () => {
      oyentes.delete(avisar);
    };
  }, []);

  useEffect(() => {
    const raiz = contenedor.current;
    if (!mapaVisible || rechazada || !raiz || typeof MutationObserver === 'undefined') return;
    const revisar = () => {
      if (raiz.querySelector(SELECTOR_ERROR_GOOGLE)) marcarRechazo();
    };
    revisar();
    const observador = new MutationObserver(revisar);
    observador.observe(raiz, { childList: true, subtree: true });
    return () => observador.disconnect();
  }, [contenedor, mapaVisible]);

  return fallo;
}
