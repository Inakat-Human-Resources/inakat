// RUTA: src/components/ui/ConfirmarModal.tsx
'use client';

import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import Modal from './Modal';
import Button from './Button';

export interface ConfirmarModalProps {
  abierto: boolean;
  /** Cancelar, Escape, la X o el fondo (bloqueado mientras `cargando`). */
  alCancelar: () => void;
  /** La acción de siempre (el DELETE, el PUT…): la página la lanza y lleva `cargando`. */
  alConfirmar: () => void;
  /** La pregunta o la acción: «Eliminar candidato». */
  titulo: string;
  /** Qué pasa si se confirma (se anuncia al abrir). */
  descripcion?: ReactNode;
  /** Detalle en el cuerpo (opcional). Sin él, el cuerpo no se pinta. */
  children?: ReactNode;
  textoConfirmar?: string;
  textoCancelar?: string;
  /** Texto del botón mientras corre la acción: «Eliminando…». */
  textoCargando?: string;
  icono?: LucideIcon;
  /** peligro (por defecto) para lo que no se deshace; primario para lo demás. */
  variante?: 'peligro' | 'primario' | 'secundario';
  /** La acción está en curso: botón con giro, Cancelar deshabilitado y el diálogo no se cierra. */
  cargando?: boolean;
}

/**
 * Confirmación que ESPERA a la acción: el diálogo se queda abierto con
 * «Eliminando…» hasta que la página termina (y lo cierra ella). Para sustituir
 * un `confirm()` sin cambiar el flujo del manejador, usa useConfirmacion.
 *
 *   <ConfirmarModal abierto={!!aBorrar} alCancelar={() => setABorrar(null)}
 *     alConfirmar={borrar} cargando={borrando} titulo="Eliminar documento"
 *     descripcion="Esta acción no se puede deshacer." textoConfirmar="Eliminar"
 *     textoCargando="Eliminando…" icono={Trash2} />
 *
 * Al abrir, el foco va al propio diálogo (nunca a «Eliminar»).
 */
export default function ConfirmarModal({
  abierto,
  alCancelar,
  alConfirmar,
  titulo,
  descripcion,
  children,
  textoConfirmar = 'Confirmar',
  textoCancelar = 'Cancelar',
  textoCargando,
  icono,
  variante = 'peligro',
  cargando = false,
}: ConfirmarModalProps) {
  return (
    <Modal
      abierto={abierto}
      alCerrar={() => {
        if (!cargando) alCancelar();
      }}
      tamano="sm"
      titulo={titulo}
      descripcion={descripcion}
      claseCuerpo={children ? undefined : 'hidden'}
      pie={
        <>
          <Button variante="contorno" onClick={alCancelar} disabled={cargando}>
            {textoCancelar}
          </Button>
          <Button variante={variante} icono={icono} onClick={alConfirmar} cargando={cargando} textoCargando={textoCargando}>
            {textoConfirmar}
          </Button>
        </>
      }
    >
      {children}
    </Modal>
  );
}
