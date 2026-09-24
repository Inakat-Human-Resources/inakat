// RUTA: src/app/admin/_components/Paginacion.tsx

'use client';

/**
 * ADM-001/004/016/025: las APIs del panel devuelven tandas (20 o 30 filas) con
 * un bloque `pagination`, pero las pantallas pintaban `data.data` y se quedaban
 * ahí: el registro 31 era inalcanzable y los contadores ("Total 30") mentían.
 *
 * El control vive ahora en el sistema de diseño (src/components/ui/Pagination,
 * que también usa DataTable). Este archivo se queda como puente con la misma
 * firma de siempre para las pantallas que aún lo importan; al rehacer una
 * pantalla, importa directamente '@/components/ui/Pagination'.
 *
 * `_components` es carpeta privada de Next: no genera ninguna ruta.
 */

import Pagination, { PAGINACION_VACIA, type PaginacionApi } from '@/components/ui/Pagination';

export { PAGINACION_VACIA, type PaginacionApi };

export default function Paginacion({
  pagination,
  onChange,
  etiqueta
}: {
  pagination: PaginacionApi;
  onChange: (nuevaPagina: number) => void;
  etiqueta: string;
}) {
  return <Pagination pagination={pagination} alCambiar={onChange} etiqueta={etiqueta} />;
}
