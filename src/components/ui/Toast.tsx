// RUTA: src/components/ui/Toast.tsx
'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type TonoAviso = 'error' | 'exito' | 'info' | 'aviso';

const TONOS: Record<TonoAviso, { icono: LucideIcon; color: string; barra: string }> = {
  // Icono sobre blanco: peligro 6.57 · lima oscuro 8.92 · teal 7.38 · naranja oscuro 7.10.
  error: { icono: AlertCircle, color: 'text-danger', barra: 'bg-danger' },
  exito: { icono: CheckCircle2, color: 'text-lime-dark', barra: 'bg-lime' },
  info: { icono: Info, color: 'text-teal', barra: 'bg-teal' },
  aviso: { icono: AlertTriangle, color: 'text-orange-dark', barra: 'bg-orange' },
};

interface CajaAvisoProps {
  tono: TonoAviso;
  mensaje: ReactNode;
  titulo?: ReactNode;
  alCerrar: () => void;
  visible?: boolean;
}

/** La caja de un aviso (sin posición): la comparten Toast y AvisosProvider. */
function CajaAviso({ tono, mensaje, titulo, alCerrar, visible = true }: CajaAvisoProps) {
  const t = TONOS[tono];
  const Icono = t.icono;
  const esError = tono === 'error';
  return (
    <div
      // Un error se anuncia al momento (alert, assertive); lo demás, con cortesía.
      role={esError ? 'alert' : 'status'}
      aria-live={esError ? 'assertive' : 'polite'}
      aria-atomic="true"
      className={cn(
        'ap-aviso pointer-events-auto relative flex w-full items-start gap-3 overflow-hidden rounded-xl border border-line bg-white py-3.5 pl-5 pr-3 shadow-ap-3 transition-[opacity,transform] duration-200',
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-2 opacity-0'
      )}
    >
      <span className={cn('absolute inset-y-0 left-0 w-1', t.barra)} aria-hidden="true" />
      <Icono className={cn('mt-0.5 h-5 w-5 flex-none', t.color)} aria-hidden="true" />
      <div className="min-w-0 flex-1 text-sm text-ink">
        {titulo && <p className="font-display font-semibold">{titulo}</p>}
        <p className={cn(titulo ? 'text-ink-muted' : 'font-medium')}>{mensaje}</p>
      </div>
      <button
        type="button"
        onClick={alCerrar}
        aria-label="Cerrar aviso"
        className="flex h-8 w-8 flex-none items-center justify-center rounded-lg text-ink-muted transition-colors duration-150 hover:bg-ink/[0.06] hover:text-ink"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Toast controlado (un solo mensaje)
// ---------------------------------------------------------------------------
export interface ToastProps {
  mensaje: string | null;
  alCerrar: () => void;
  tono?: TonoAviso;
  titulo?: ReactNode;
  /** ms antes de cerrarse solo; 0 = no se cierra solo. */
  duracion?: number;
}

/**
 * Aviso flotante controlado por la página (arriba, centrado).
 *
 *   const [error, setError] = useState<string | null>(null);
 *   <Toast tono="error" mensaje={error} alCerrar={() => setError(null)} />
 *
 * Para avisos sueltos dentro del AppShell es más cómodo useAvisos().
 */
export default function Toast({ mensaje, alCerrar, tono = 'error', titulo, duracion = 8000 }: ToastProps) {
  const [visible, setVisible] = useState(false);
  const alCerrarRef = useRef(alCerrar);
  alCerrarRef.current = alCerrar;
  // Temporizador de la salida. Se guarda para cancelarlo: si llegaba un
  // mensaje NUEVO durante los 300 ms del desvanecido, el temporizador huérfano
  // llamaba a alCerrar y borraba el mensaje recién mostrado.
  const cierreRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelarCierre = () => {
    if (cierreRef.current) {
      clearTimeout(cierreRef.current);
      cierreRef.current = null;
    }
  };

  useEffect(() => {
    cancelarCierre();
    if (mensaje) {
      setVisible(true);
      if (duracion > 0) {
        const t = setTimeout(() => {
          setVisible(false);
          cierreRef.current = setTimeout(() => alCerrarRef.current(), 300);
        }, duracion);
        return () => {
          clearTimeout(t);
          cancelarCierre();
        };
      }
    } else {
      setVisible(false);
    }
    return cancelarCierre;
  }, [mensaje, duracion]);

  if (!mensaje) return null;

  const cerrar = () => {
    setVisible(false);
    cancelarCierre();
    cierreRef.current = setTimeout(() => alCerrarRef.current(), 300);
  };

  return (
    <div className="pointer-events-none fixed left-1/2 top-4 z-[9999] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2">
      <CajaAviso tono={tono} mensaje={mensaje} titulo={titulo} alCerrar={cerrar} visible={visible} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pila de avisos (AvisosProvider + useAvisos)
// ---------------------------------------------------------------------------
interface Aviso {
  id: number;
  tono: TonoAviso;
  mensaje: ReactNode;
  titulo?: ReactNode;
}

interface ContextoAvisos {
  avisar: (aviso: { tono?: TonoAviso; mensaje: ReactNode; titulo?: ReactNode; duracion?: number }) => void;
}

const AvisosContext = createContext<ContextoAvisos | null>(null);

/**
 * Avisos sueltos desde cualquier pantalla del AppShell (que ya monta el
 * proveedor):
 *
 *   const { avisar } = useAvisos();
 *   avisar({ tono: 'exito', mensaje: 'Vacante publicada' });
 *
 * Fuera de un proveedor no rompe: cae a console.warn.
 */
export function useAvisos(): ContextoAvisos {
  return (
    useContext(AvisosContext) ?? {
      avisar: ({ mensaje }) => console.warn('[useAvisos] sin AvisosProvider:', mensaje),
    }
  );
}

export function AvisosProvider({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const siguiente = useRef(1);

  const quitar = useCallback((id: number) => setAvisos((lista) => lista.filter((a) => a.id !== id)), []);

  const avisar = useCallback<ContextoAvisos['avisar']>(
    ({ tono = 'exito', mensaje, titulo, duracion = tono === 'error' ? 8000 : 5000 }) => {
      const id = siguiente.current++;
      setAvisos((lista) => [...lista.slice(-3), { id, tono, mensaje, titulo }]);
      if (duracion > 0) setTimeout(() => quitar(id), duracion);
    },
    [quitar]
  );

  const valor = useMemo(() => ({ avisar }), [avisar]);

  return (
    <AvisosContext.Provider value={valor}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[9999] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2">
        {avisos.map((a) => (
          <CajaAviso key={a.id} tono={a.tono} mensaje={a.mensaje} titulo={a.titulo} alCerrar={() => quitar(a.id)} />
        ))}
      </div>
    </AvisosContext.Provider>
  );
}
