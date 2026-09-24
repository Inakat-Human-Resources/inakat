// RUTA: src/app/admin/contact-messages/page.tsx
//
// Bandeja de los mensajes del formulario público de contacto (/contact).
//
// POST /api/contact guardaba cada lead en ContactMessage y nadie podía leerlo
// sin entrar a la base. Ahora el admin recibe una notificación in-app que
// enlaza AQUÍ (link '/admin/contact-messages') y un correo al buzón interno.
//
// El modelo no tiene campo de "leído": esta pantalla sólo lista, del más
// reciente al más antiguo. La protección de /admin/* la hace el middleware y la
// API vuelve a exigir requireRole('admin').
//
// Registro de APLICACIÓN (docs/DISENO.md): PageHeader → aviso de error con
// «Reintentar» → tarjeta con la bandeja paginada en el servidor. Es una lista y
// no una tabla porque lo que importa es leer el mensaje entero, no comparar
// columnas. La llamada es la de siempre (misma URL, misma cookie).

'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ChevronDown, Mail, Phone, RefreshCw } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import { AvisoError } from '@/components/ui/Aviso';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Avatar from '@/components/ui/Avatar';
import EmptyState from '@/components/ui/EmptyState';
import Skeleton, { SkeletonPagina, SkeletonTexto } from '@/components/ui/Skeleton';
import Pagination, { PAGINACION_VACIA, type PaginacionApi } from '@/components/ui/Pagination';
import { cn } from '@/lib/utils';
import { fechaHora } from '@/lib/fechas';

interface ContactMessage {
  id: number;
  nombre: string;
  email: string;
  telefono: string | null;
  mensaje: string;
  createdAt: string;
}

/** Un mensaje más largo que esto (o con muchos renglones) se muestra recortado, con «Leer completo». */
const LARGO_RECORTE = 320;
const RENGLONES_RECORTE = 4;

const esLargo = (texto: string) =>
  texto.length > LARGO_RECORTE || texto.split('\n').length > RENGLONES_RECORTE;

/** Un mensaje de la bandeja. */
function Mensaje({ m, fecha }: { m: ContactMessage; fecha: string }) {
  const [abierto, setAbierto] = useState(false);
  const largo = esLargo(m.mensaje);
  const idTexto = `mensaje-${m.id}-texto`;
  const idNombre = `mensaje-${m.id}-nombre`;

  return (
    <article aria-labelledby={idNombre} className="flex gap-3 px-5 py-4 sm:gap-4">
      <Avatar nombre={m.nombre} email={m.email} className="mt-0.5 hidden sm:inline-flex" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
          <h3 id={idNombre} className="break-words font-display text-[15px] font-semibold leading-snug text-ink">
            {m.nombre}
          </h3>
          <time dateTime={m.createdAt} className="flex-none text-xs tabular-nums text-ink-muted">
            {fecha}
          </time>
        </div>

        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
          <a
            href={`mailto:${m.email}`}
            className="inline-flex items-center gap-1.5 break-all rounded font-medium text-teal hover:text-teal-dark hover:underline"
          >
            <Mail size={14} className="flex-none" aria-hidden="true" />
            {m.email}
          </a>
          {m.telefono && (
            <a
              href={`tel:${m.telefono}`}
              className="inline-flex items-center gap-1.5 rounded text-ink hover:text-teal-dark hover:underline"
            >
              <Phone size={14} className="flex-none text-ink-muted" aria-hidden="true" />
              <span className="tabular-nums">{m.telefono}</span>
            </a>
          )}
        </div>

        {/* Medida de lectura: a 1440 px el renglón llegaba a ~1000 px (más de
            100 caracteres); 72ch lo deja en la franja cómoda de 60–75. */}
        <p
          id={idTexto}
          className={cn(
            'mt-2.5 max-w-[72ch] whitespace-pre-wrap break-words text-sm leading-relaxed text-ink',
            largo && !abierto && 'line-clamp-4'
          )}
        >
          {m.mensaje}
        </p>
        {largo && (
          <button
            type="button"
            onClick={() => setAbierto((a) => !a)}
            aria-expanded={abierto}
            aria-controls={idTexto}
            className="mt-1.5 inline-flex items-center gap-1 rounded text-[13px] font-semibold text-teal transition-colors duration-150 hover:text-teal-dark"
          >
            {abierto ? 'Mostrar menos' : 'Leer completo'}
            <ChevronDown
              className={cn('h-4 w-4 transition-transform duration-150', abierto && 'rotate-180')}
              aria-hidden="true"
            />
          </button>
        )}
      </div>
    </article>
  );
}

/** Filas esqueleto de la bandeja (al cambiar de página). */
function MensajesEsqueleto() {
  return (
    <ul aria-hidden="true" className="divide-y divide-line">
      {[0, 1, 2, 3].map((i) => (
        <li key={i} className="flex gap-4 px-5 py-4">
          <Skeleton className="hidden h-9 w-9 flex-none rounded-full sm:block" />
          <div className="min-w-0 flex-1 space-y-2.5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-56 max-w-full" />
            <SkeletonTexto lineas={2} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function AdminContactMessagesPage() {
  const [mensajes, setMensajes] = useState<ContactMessage[]>([]);
  const [pagination, setPagination] = useState<PaginacionApi>(PAGINACION_VACIA);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Sólo presentación: esqueleto de página en la primera carga; al paginar se
  // queda la página y sólo la lista muestra huecos.
  const [cargaInicial, setCargaInicial] = useState(true);
  useEffect(() => {
    if (!isLoading) setCargaInicial(false);
  }, [isLoading]);

  const fetchMensajes = useCallback(async (pagina: number) => {
    try {
      setIsLoading(true);
      setError(null);

      const res = await fetch(`/api/admin/contact-messages?page=${pagina}&limit=20`, {
        credentials: 'include'
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'No pudimos cargar los mensajes');
      }

      setMensajes(data.data);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos cargar los mensajes');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMensajes(page);
  }, [page, fetchMensajes]);

  // Fecha con hora del panel (src/lib/fechas): «23 sep 2026, 18:22».
  const formatearFecha = (iso: string) => fechaHora(iso);

  if (isLoading && cargaInicial) {
    return <SkeletonPagina conCifras={false} />;
  }

  const total = pagination.total;

  return (
    <>
      <PageHeader
        antetitulo="Sistema"
        titulo="Mensajes"
        remate="de contacto"
        descripcion="Lo que llega desde el formulario público de /contact, del más reciente al más antiguo."
        acciones={
          <Button variante="contorno" icono={RefreshCw} onClick={() => fetchMensajes(page)} cargando={isLoading}>
            Actualizar
          </Button>
        }
      />

      {error && <AvisoError mensaje={error} alReintentar={() => fetchMensajes(page)} />}

      {/* Un error sin mensajes que enseñar no es una bandeja vacía: sólo el aviso. */}
      {!(error && mensajes.length === 0) && (
        <Card
          titulo="Bandeja"
          descripcion={
            total > 0 ? `${total.toLocaleString('es-MX')} mensaje${total !== 1 ? 's' : ''} en total` : undefined
          }
          sinRelleno
        >
          <div aria-busy={isLoading || undefined}>
            {isLoading ? (
              <>
                <span className="sr-only" role="status">
                  Cargando mensajes…
                </span>
                <MensajesEsqueleto />
              </>
            ) : mensajes.length === 0 ? (
              <EmptyState
                frase="Bandeja en calma."
                titulo="Todavía no hay mensajes de contacto."
                descripcion="Cuando alguien escriba desde el formulario de contacto del sitio, su mensaje aparecerá aquí y recibirás una notificación."
              />
            ) : (
              <ul className="divide-y divide-line">
                {mensajes.map((m) => (
                  <li key={m.id} className="transition-colors duration-150 hover:bg-paper/60">
                    <Mensaje m={m} fecha={formatearFecha(m.createdAt)} />
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Pagination pagination={pagination} alCambiar={setPage} etiqueta="mensajes" />
        </Card>
      )}
    </>
  );
}
