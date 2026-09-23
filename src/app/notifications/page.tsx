// RUTA: src/app/notifications/page.tsx

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Bell, CheckCheck, Filter } from 'lucide-react';
import Link from 'next/link';

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const TYPE_ICONS: Record<string, string> = {
  new_request: '🏢',
  request_approved: '✅',
  request_rejected: '❌',
  assignment: '📋',
  new_application: '📩',
  credits_purchased: '💰',
  sent_to_specialist: '🔬',
  sent_to_company: '📤',
  application_status: '📊',
  interview_requested: '📅',
  interview_confirmed: '📅',
  interview_rescheduled: '🔁',
  interview_cancelled: '🚫',
  contact_message: '✉️',
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
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

    return date.toLocaleDateString('es-MX', {
      day: 'numeric',
      month: 'short',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-24 pb-12">
      <div className="container mx-auto max-w-2xl px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Bell className="w-6 h-6 text-title-dark" />
            <h1 className="text-2xl font-bold text-title-dark">Notificaciones</h1>
          </div>
          {unreadTotal > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-1.5 text-sm text-button-green hover:underline"
            >
              <CheckCheck className="w-4 h-4" />
              Marcar todas leídas
            </button>
          )}
        </div>

        {error && (
          <div
            role="alert"
            className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            <span>{error}</span>
            <button
              onClick={fetchNotifications}
              className="font-semibold underline whitespace-nowrap"
            >
              Reintentar
            </button>
          </div>
        )}

        {/* Filtros */}
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-4 h-4 text-gray-400" />
          {(['all', 'unread', 'read'] as const).map((f) => (
            <button
              key={f}
              onClick={() => { setFilter(f); setPage(1); }}
              className={`px-3 py-1 text-sm rounded-full transition-colors ${
                filter === f
                  ? 'bg-button-green text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              {f === 'all' ? 'Todas' : f === 'unread' ? 'No leídas' : 'Leídas'}
            </button>
          ))}
        </div>

        {/* Lista */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="py-16 text-center text-gray-400">
              <div className="animate-spin w-8 h-8 border-2 border-button-green border-t-transparent rounded-full mx-auto mb-3"></div>
              Cargando notificaciones...
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-16 text-center text-gray-400">
              <Bell className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-lg">
                {error ? 'No pudimos cargar tus notificaciones' : 'No hay notificaciones'}
              </p>
              <p className="text-sm mt-1">
                {error
                  ? 'Vuelve a intentarlo en unos segundos.'
                  : filter === 'unread'
                  ? 'No tienes notificaciones sin leer'
                  : filter === 'read'
                  ? 'No tienes notificaciones leídas'
                  : 'Aquí aparecerán tus notificaciones'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {notifications.map((notif) => {
                const inner = (
                  <div
                    className={`flex items-start gap-4 px-5 py-4 hover:bg-gray-50 transition-colors ${
                      !notif.read ? 'bg-blue-50/40' : ''
                    }`}
                  >
                    <span className="text-2xl flex-shrink-0 mt-0.5">
                      {TYPE_ICONS[notif.type] || '🔔'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className={`text-sm ${
                            !notif.read ? 'font-semibold text-gray-900' : 'text-gray-700'
                          }`}
                        >
                          {notif.title}
                        </p>
                        <span className="text-[11px] text-gray-400 whitespace-nowrap flex-shrink-0">
                          {formatDate(notif.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">{notif.message}</p>
                    </div>
                    {!notif.read && (
                      <span className="w-2.5 h-2.5 bg-blue-500 rounded-full flex-shrink-0 mt-2"></span>
                    )}
                  </div>
                );

                return notif.link ? (
                  <Link
                    key={notif.id}
                    href={notif.link}
                    onClick={() => !notif.read && markOneRead(notif.id)}
                  >
                    {inner}
                  </Link>
                ) : (
                  <div
                    key={notif.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => !notif.read && markOneRead(notif.id)}
                    onKeyDown={(e) => {
                      if ((e.key === 'Enter' || e.key === ' ') && !notif.read) {
                        e.preventDefault();
                        markOneRead(notif.id);
                      }
                    }}
                    className="cursor-pointer"
                  >
                    {inner}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Paginación */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Anterior
            </button>
            <span className="text-sm text-gray-500">
              Página {page} de {pagination.totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={page === pagination.totalPages}
              className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Siguiente
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
