// RUTA: src/app/admin/error.tsx
// PERF-006: error boundary del panel.
// Se pinta DENTRO del AppShell (lo pone admin/layout.tsx): nada de pantalla
// completa ni fondos propios. Mismos dos caminos de siempre: reintentar
// (reset) o recargar la página. La presentación es la del sistema (ErrorDePanel).
'use client';

import { useEffect } from 'react';
import ErrorDePanel from '@/components/ui/ErrorDePanel';

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Admin error:', error);
  }, [error]);

  return <ErrorDePanel titulo="Error en el panel de administración" alReintentar={reset} />;
}
