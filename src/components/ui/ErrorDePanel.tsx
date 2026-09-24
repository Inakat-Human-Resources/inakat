// RUTA: src/components/ui/ErrorDePanel.tsx
'use client';

import { AlertTriangle, RefreshCw, RotateCw } from 'lucide-react';
import Button from './Button';

export interface ErrorDePanelProps {
  /** El h1: «Error en el panel de reclutador». */
  titulo: string;
  /** Una línea en serif itálica bajo el título (opcional). */
  frase?: string;
  /** Qué pasó y qué hacer. */
  descripcion?: string;
  /** El `reset` que Next pasa al error.tsx: vuelve a intentar pintar la sección. */
  alReintentar: () => void;
}

/**
 * Lo que pinta el error.tsx de una sección de la aplicación (admin, company,
 * recruiter, specialist…). Va DENTRO del AppShell (lo pone el layout.tsx de la
 * sección): nada de pantalla completa ni fondos propios, sólo el aviso y las
 * dos salidas de siempre (recargar la página o reintentar con `reset`).
 *
 *   export default function RecruiterError({ error, reset }) {
 *     useEffect(() => { console.error('Recruiter error:', error); }, [error]);
 *     return <ErrorDePanel titulo="Error en el panel de reclutador" alReintentar={reset} />;
 *   }
 *
 * El título y el texto van en role="alert": se anuncian al aparecer.
 */
export default function ErrorDePanel({
  titulo,
  frase,
  descripcion = 'Ocurrió un error al cargar los datos. Intenta de nuevo o recarga la página.',
  alReintentar,
}: ErrorDePanelProps) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center">
      <span
        className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-danger-tint text-danger"
        aria-hidden="true"
      >
        <AlertTriangle className="h-6 w-6" />
      </span>
      <div role="alert">
        <h1 className="font-display text-xl font-semibold text-ink">{titulo}</h1>
        {frase && <p className="mt-1.5 font-serif text-lg italic text-teal">{frase}</p>}
        <p className="mt-2 text-sm text-ink-muted">{descripcion}</p>
      </div>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button variante="contorno" icono={RotateCw} onClick={() => window.location.reload()}>
          Recargar página
        </Button>
        <Button icono={RefreshCw} onClick={alReintentar}>
          Reintentar
        </Button>
      </div>
    </div>
  );
}
