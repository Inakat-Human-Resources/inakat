// RUTA: src/components/ui/useConfirmacion.tsx
'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import Modal from './Modal';
import Button, { type VarianteBoton } from './Button';

export interface OpcionesConfirmacion {
  /** La pregunta: «¿Pausar «Analista contable»?», «¿Desactivar el paquete "Pack 10"?». */
  titulo: string;
  /** Qué pasa si se confirma (se anuncia al abrir: aria-describedby). */
  descripcion?: ReactNode;
  /** Detalle extra en el cuerpo (una lista, un resumen). Sin él, el cuerpo no se pinta. */
  contenido?: ReactNode;
  /** Texto del botón que confirma (por defecto, «Confirmar»). */
  textoConfirmar?: string;
  /** Texto del botón que cancela (por defecto, «Cancelar»). */
  textoCancelar?: string;
  /** primario para lo positivo; peligro para lo que corta, descarta o no se deshace. */
  variante?: Extract<VarianteBoton, 'primario' | 'secundario' | 'peligro'>;
  /** Icono del botón que confirma. */
  icono?: LucideIcon;
}

/**
 * Sustituto de `window.confirm()` con el Modal del sistema y la MISMA forma:
 * `confirmar()` devuelve una promesa que resuelve true (confirmar) o false
 * (Cancelar, Escape, la X o clic en el fondo). Así un manejador que decía
 *
 *   if (!confirm('¿Pausar la vacante?')) return;
 *
 * pasa a decir
 *
 *   if (!(await confirmar({ titulo: '¿Pausar la vacante?', textoConfirmar: 'Pausar' }))) return;
 *
 * y el flujo que sigue (la llamada, su cuerpo, lo que se hace con la
 * respuesta) es exactamente el mismo: es la forma segura de aplicar la regla
 * de docs/DISENO.md («un confirm() sólo se sustituye si la acción posterior es
 * idéntica»). Pinta `dialogo` una vez en la página:
 *
 *   const { confirmar, dialogo } = useConfirmacion();
 *   …
 *   return (<>…{dialogo}</>);
 *
 * - Al abrir, el foco va al propio diálogo (no hay campos): el lector lee la
 *   pregunta y nunca abre con el foco en «Eliminar». Atrapa el foco, cierra con
 *   Escape y devuelve el foco al botón que lo abrió (todo eso lo hace Modal).
 * - Una confirmación nueva da por cancelada la que estuviera abierta.
 * - Si la página se desmonta con una pregunta abierta, cuenta como «no».
 */
export function useConfirmacion() {
  const [pregunta, setPregunta] = useState<OpcionesConfirmacion | null>(null);
  const resolverRef = useRef<((ok: boolean) => void) | null>(null);

  const confirmar = useCallback(
    (opciones: OpcionesConfirmacion) =>
      new Promise<boolean>((resolve) => {
        resolverRef.current?.(false);
        resolverRef.current = resolve;
        setPregunta(opciones);
      }),
    []
  );

  const responder = useCallback((ok: boolean) => {
    const resolver = resolverRef.current;
    resolverRef.current = null;
    setPregunta(null);
    resolver?.(ok);
  }, []);

  useEffect(() => () => resolverRef.current?.(false), []);

  const dialogo = (
    <Modal
      abierto={pregunta !== null}
      alCerrar={() => responder(false)}
      tamano="sm"
      titulo={pregunta?.titulo}
      descripcion={pregunta?.descripcion}
      // Sin detalle, el cuerpo sobra: la pregunta y su consecuencia van en la cabecera.
      claseCuerpo={pregunta?.contenido ? undefined : 'hidden'}
      pie={
        pregunta && (
          <>
            <Button variante="contorno" onClick={() => responder(false)}>
              {pregunta.textoCancelar ?? 'Cancelar'}
            </Button>
            <Button variante={pregunta.variante ?? 'primario'} icono={pregunta.icono} onClick={() => responder(true)}>
              {pregunta.textoConfirmar ?? 'Confirmar'}
            </Button>
          </>
        )
      }
    >
      {pregunta?.contenido}
    </Modal>
  );

  return { confirmar, dialogo };
}

export default useConfirmacion;
