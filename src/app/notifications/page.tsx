// RUTA: src/app/notifications/page.tsx

'use client';

/**
 * Notificaciones (todos los roles). Registro de aplicación (docs/DISENO.md):
 * PageHeader → aviso de error con «Reintentar» → tarjeta con pestañas de
 * filtro, la bandeja y la paginación.
 *
 * La lógica es la de siempre: GET /api/notifications?page&limit=20[&filter],
 * PATCH con { all: true } o { ids: [id] }, el total real de no leídas que da
 * el servidor y el aviso a la campanita. Las pestañas son los tres filtros de
 * antes (mismo estado `filter`, vuelven a la página 1).
 */

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  BarChart3,
  Bell,
  Building2,
  CalendarCheck,
  CalendarClock,
  CalendarPlus,
  CalendarX,
  CheckCheck,
  CheckCircle2,
  ClipboardList,
  Coins,
  Inbox,
  Mail,
  Microscope,
  RefreshCw,
  Send,
  XCircle,
  type LucideIcon
} from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import Tabs, { PanelPestana } from '@/components/ui/Tabs';
import EmptyState from '@/components/ui/EmptyState';
import Button from '@/components/ui/Button';
import Pagination from '@/components/ui/Pagination';
import Skeleton from '@/components/ui/Skeleton';
import { cn } from '@/lib/utils';
import { fechaCorta, fechaHora } from '@/lib/fechas';

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

interface PaginacionNotificaciones {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

type Filtro = 'all' | 'unread' | 'read';

/**
 * Icono y tono de cada tipo de notificación (antes, emojis). Icono sobre su
 * tinte: teal 6.18 · lima oscuro 7.84 · naranja oscuro 6.14 · peligro 6.30 ·
 * tinta sobre niebla 10.35.
 */
const TONOS_TIPO = {
  info: 'bg-teal-tint text-teal',
  exito: 'bg-lime-tint text-lime-dark',
  aviso: 'bg-orange-tint text-orange-dark',
  peligro: 'bg-danger-tint text-danger-dark',
  neutro: 'bg-mist text-ink',
} as const;

const TIPOS: Record<string, { icono: LucideIcon; tono: keyof typeof TONOS_TIPO }> = {
  new_request: { icono: Building2, tono: 'info' },
  request_approved: { icono: CheckCircle2, tono: 'exito' },
  request_rejected: { icono: XCircle, tono: 'peligro' },
  assignment: { icono: ClipboardList, tono: 'info' },
  new_application: { icono: Inbox, tono: 'info' },
  credits_purchased: { icono: Coins, tono: 'aviso' },
  sent_to_specialist: { icono: Microscope, tono: 'info' },
  sent_to_company: { icono: Send, tono: 'info' },
  application_status: { icono: BarChart3, tono: 'neutro' },
  interview_requested: { icono: CalendarPlus, tono: 'aviso' },
  interview_confirmed: { icono: CalendarCheck, tono: 'exito' },
  interview_rescheduled: { icono: CalendarClock, tono: 'aviso' },
  interview_cancelled: { icono: CalendarX, tono: 'peligro' },
  contact_message: { icono: Mail, tono: 'info' },
};
const TIPO_POR_DEFECTO = { icono: Bell, tono: 'neutro' as const };

const FILTROS: Array<{ id: Filtro; etiqueta: string }> = [
  { id: 'all', etiqueta: 'Todas' },
  { id: 'unread', etiqueta: 'No leídas' },
  { id: 'read', etiqueta: 'Leídas' },
];

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [pagination, setPagination] = useState<PaginacionNotificaciones | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [page, setPage] = useState(1);
  // Un fallo de carga dejaba `notifications` en [] y se pintaba «No hay
  // notificaciones», indistinguible de no tener ninguna: el reclutador creía
  // que no le habían asignado candidatos.
  const [error, setError] = useState<string | null>(null);
  // Total real de no leídas (lo devuelve el servidor): contarlas sobre los 20
  // elementos de la página visible escondía el botón "Marcar todas leídas"
  // cuando las no leídas estaban en las páginas 2 y 3.
  const [unreadTotal, setUnreadTotal] = useState(0);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (filter !== 'all') params.set('filter', filter);

      const res = await fetch(`/api/notifications?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error('respuesta no ok');

      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'respuesta no ok');

      setNotifications(data.data);
      setPagination(data.pagination);
      setUnreadTotal(typeof data.unreadTotal === 'number' ? data.unreadTotal : 0);
    } catch {
      setError('No pudimos cargar tus notificaciones.');
    } finally {
      setLoading(false);
    }
  }, [page, filter]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  /** Avisa a la campanita del Navbar para que refresque su contador ya. */
  const avisarCambio = () => {
    window.dispatchEvent(new Event('notifications:changed'));
  };

  const marcarLeidas = async (cuerpo: { all: true } | { ids: number[] }) => {
    // `fetch` no lanza con 4xx/5xx: sin mirar el status, la UI se pintaba como
    // "leído" y 30 s después el badge volvía a aparecer.
    const res = await fetch('/api/notifications', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
    });
    if (!res.ok) throw new Error('no se pudo marcar como leída');
  };

  const markAllRead = async () => {
    try {
      await marcarLeidas({ all: true });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadTotal(0);
      avisarCambio();
      // Con un filtro distinto de "todas" la lista y la paginación quedan
      // desfasadas (las que ya no cumplen el filtro siguen listadas).
      if (filter !== 'all') fetchNotifications();
    } catch {
      setError('No pudimos marcar las notificaciones como leídas.');
    }
  };

  const markOneRead = async (id: number) => {
    try {
      await marcarLeidas({ ids: [id] });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      setUnreadTotal((prev) => Math.max(0, prev - 1));
      avisarCambio();
    } catch {
      setError('No pudimos marcar la notificación como leída.');
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / 60000);

    if (mins < 1) return 'Justo ahora';
    if (mins < 60) return `Hace ${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `Hace ${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `Hace ${days} día${days > 1 ? 's' : ''}`;

    return fechaCorta(date);
  };

  // Fila de la bandeja: con enlace navega (y marca leída); sin enlace, sólo
  // marca leída. Mismo comportamiento de antes, con foco visible.
  const claseFila =
    'block transition-colors duration-150 hover:bg-paper focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-teal';

  const contenidoFila = (notif: Notification) => {
    const tipo = TIPOS[notif.type] ?? TIPO_POR_DEFECTO;
    const Icono = tipo.icono;
    return (
      <div className={cn('flex items-start gap-3 px-4 py-3.5 sm:gap-4 sm:px-5', !notif.read && 'bg-teal-tint/40')}>
        <span
          className={cn('flex h-9 w-9 flex-none items-center justify-center rounded-lg', TONOS_TIPO[tipo.tono])}
          aria-hidden="true"
        >
          <Icono className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <p className={cn('text-sm text-ink', !notif.read ? 'font-semibold' : 'font-medium')}>
              {!notif.read && <span className="sr-only">Sin leer: </span>}
              {notif.title}
            </p>
            <time
              dateTime={notif.createdAt}
              title={fechaHora(notif.createdAt)}
              className="mt-px flex-none whitespace-nowrap text-xs tabular-nums text-ink-muted"
            >
              {formatDate(notif.createdAt)}
            </time>
          </div>
          <p className="mt-0.5 text-sm text-ink-muted">{notif.message}</p>
        </div>
        {/* El punto de «sin leer» acompaña a la negrita y al texto oculto:
            nunca es la única señal. Verde azulado sobre blanco: 7.38. */}
        <span
          className={cn('mt-2 h-2 w-2 flex-none rounded-full', notif.read ? 'bg-transparent' : 'bg-teal')}
          aria-hidden="true"
        />
      </div>
    );
  };

  return (
    <>
      {/* La cabecera va a todo el ancho, como en el resto de páginas (el borde
          derecho no salta al navegar); sólo la bandeja se estrecha para leerse. */}
      <PageHeader
        antetitulo="Cuenta"
        titulo="Notificaciones"
        descripcion="Lo que ha pasado en tu cuenta, de lo más reciente a lo más antiguo."
        acciones={
          unreadTotal > 0 && (
            <Button variante="contorno" icono={CheckCheck} onClick={markAllRead}>
              Marcar todas leídas
            </Button>
          )
        }
      />

      {error && (
        <div
          role="alert"
          className="mb-6 flex max-w-lectura flex-col gap-3 rounded-xl border border-danger/30 bg-danger-tint px-4 py-3 text-sm font-medium text-danger-dark sm:flex-row sm:items-center sm:justify-between"
        >
          <span className="flex items-center gap-2">
            <AlertCircle size={18} className="flex-none" aria-hidden="true" />
            {error}
          </span>
          <Button variante="contorno" tamano="sm" icono={RefreshCw} onClick={fetchNotifications}>
            Reintentar
          </Button>
        </div>
      )}

      <Card sinRelleno className="max-w-lectura">
        <Tabs
          idBase="notificaciones"
          etiqueta="Filtrar notificaciones"
          activa={filter}
          alCambiar={(f) => {
            setFilter(f as Filtro);
            setPage(1);
          }}
          pestanas={FILTROS.map((f) =>
            f.id === 'unread' ? { ...f, contador: unreadTotal } : f
          )}
          className="px-2 sm:px-3"
        />

        <PanelPestana
          idBase="notificaciones"
          id={filter}
          activa={filter}
          className="pt-0 focus-visible:outline-offset-[-2px]"
        >
          {loading ? (
            <div role="status" aria-live="polite">
              <span className="sr-only">Cargando notificaciones…</span>
              <ul aria-hidden="true" className="divide-y divide-line">
                {[0, 1, 2, 3, 4].map((i) => (
                  <li key={i} className="flex items-start gap-4 px-5 py-4">
                    <Skeleton className="h-9 w-9 flex-none rounded-lg" />
                    <span className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="h-3.5 w-3/4" />
                    </span>
                    <Skeleton className="h-3 w-14 flex-none" />
                  </li>
                ))}
              </ul>
            </div>
          ) : notifications.length === 0 ? (
            error ? (
              <EmptyState
                compacto
                icono={AlertCircle}
                titulo="No pudimos cargar tus notificaciones"
                descripcion="Vuelve a intentarlo en unos segundos."
              />
            ) : (
              <EmptyState
                frase="Todo en calma por aquí."
                titulo="No hay notificaciones"
                descripcion={
                  filter === 'unread'
                    ? 'No tienes notificaciones sin leer'
                    : filter === 'read'
                    ? 'No tienes notificaciones leídas'
                    : 'Aquí aparecerán tus notificaciones'
                }
              />
            )
          ) : (
            <ul className="divide-y divide-line">
              {notifications.map((notif) => (
                <li key={notif.id}>
                  {notif.link ? (
                    <Link
                      href={notif.link}
                      onClick={() => !notif.read && markOneRead(notif.id)}
                      className={claseFila}
                    >
                      {contenidoFila(notif)}
                    </Link>
                  ) : (
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => !notif.read && markOneRead(notif.id)}
                      onKeyDown={(e) => {
                        if ((e.key === 'Enter' || e.key === ' ') && !notif.read) {
                          e.preventDefault();
                          markOneRead(notif.id);
                        }
                      }}
                      className={cn(claseFila, 'cursor-pointer')}
                    >
                      {contenidoFila(notif)}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </PanelPestana>

        {/* Paginación: la de la API; el número de página lo lleva la página. */}
        {pagination && (
          <Pagination
            pagination={{
              ...pagination,
              page,
              hasPrev: page > 1,
              hasNext: page < pagination.totalPages,
            }}
            alCambiar={setPage}
            etiqueta="notificaciones"
          />
        )}
      </Card>
    </>
  );
}
