// RUTA: src/components/shared/NotificationBell.tsx

'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Bell,
  BarChart3,
  Building2,
  CalendarCheck,
  CalendarClock,
  CalendarX,
  CheckCircle2,
  ClipboardList,
  Coins,
  Inbox,
  Mail,
  Microscope,
  Send,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
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

const POLL_INTERVAL = 60000; // 60 segundos

export default function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  // La campanita vive en la cabecera del AppShell, es decir, en TODAS las
  // páginas de la aplicación de todo usuario autenticado. Sin frenos, cada pestaña abierta
  // generaba una invocación serverless y dos consultas cada 30 s durante horas,
  // y una vez caducado el JWT seguía pidiendo 401 indefinidamente.
  const pollDetenido = useRef(false);

  // Polling para conteo de no leídas
  const fetchCount = useCallback(async () => {
    if (pollDetenido.current) return;
    try {
      const res = await fetch('/api/notifications/count', { credentials: 'include' });
      if (res.status === 401 || res.status === 403) {
        // Sesión caducada: insistir cada minuto no la va a resucitar.
        pollDetenido.current = true;
        return;
      }
      if (res.ok) {
        const data = await res.json();
        if (data.success) setUnreadCount(data.count);
      }
    } catch {
      // silencioso
    }
  }, []);

  useEffect(() => {
    fetchCount();

    const interval = setInterval(() => {
      // Nadie está mirando una pestaña en segundo plano.
      if (document.hidden) return;
      fetchCount();
    }, POLL_INTERVAL);

    const alVolver = () => {
      if (!document.hidden) fetchCount();
    };
    document.addEventListener('visibilitychange', alVolver);

    // La página /notifications avisa al marcar como leídas para que el badge no
    // se quede desfasado hasta el siguiente poll.
    const alCambiar = () => fetchCount();
    window.addEventListener('notifications:changed', alCambiar);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', alVolver);
      window.removeEventListener('notifications:changed', alCambiar);
    };
  }, [fetchCount]);

  // Cargar notificaciones recientes cuando se abre el dropdown
  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/notifications?limit=7', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (data.success) setNotifications(data.data);
      }
    } catch {
      // silencioso
    } finally {
      setLoading(false);
    }
  }, []);

  const handleToggle = () => {
    if (!isOpen) {
      fetchNotifications();
    }
    setIsOpen(!isOpen);
  };

  // Cerrar al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cerrar con Escape y devolver el foco al botón (como en los modales).
  const botonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        botonRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  /**
   * `fetch` no lanza con 4xx/5xx: sin comprobar el status, un PATCH fallido
   * dejaba la UI diciendo "leído" y al siguiente poll reaparecía el contador.
   */
  const marcarLeidas = async (cuerpo: { all: true } | { ids: number[] }) => {
    const res = await fetch('/api/notifications', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
    });
    if (!res.ok) throw new Error('no se pudo marcar como leída');
  };

  // Marcar todas como leídas
  const markAllRead = async () => {
    try {
      await marcarLeidas({ all: true });
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {
      // El servidor no las marcó: se recarga el contador real en vez de mentir.
      fetchCount();
    }
  };

  // Marcar una como leída al hacer click
  const handleNotificationClick = async (notif: Notification) => {
    if (!notif.read) {
      try {
        await marcarLeidas({ ids: [notif.id] });
        setUnreadCount((prev) => Math.max(0, prev - 1));
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n))
        );
      } catch {
        fetchCount();
      }
    }
    setIsOpen(false);
  };

  // Formato de tiempo relativo
  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'ahora';
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d`;
    return `${Math.floor(days / 7)}sem`;
  };

  // Icono por tipo de notificación (decorativo: el título dice qué pasó).
  const getTypeIcon = (type: string): LucideIcon => {
    switch (type) {
      case 'new_request':
        return Building2;
      case 'request_approved':
        return CheckCircle2;
      case 'request_rejected':
        return XCircle;
      case 'assignment':
        return ClipboardList;
      case 'new_application':
        return Inbox;
      case 'credits_purchased':
        return Coins;
      case 'sent_to_specialist':
        return Microscope;
      case 'sent_to_company':
        return Send;
      case 'application_status':
        return BarChart3;
      case 'interview_requested':
      case 'interview_confirmed':
        return CalendarCheck;
      case 'interview_rescheduled':
        return CalendarClock;
      case 'interview_cancelled':
        return CalendarX;
      case 'contact_message':
        return Mail;
      default:
        return Bell;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        ref={botonRef}
        type="button"
        onClick={handleToggle}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-lg text-ink transition-colors duration-150 hover:bg-ink/[0.06] aria-expanded:bg-ink/[0.06]"
        // El aria-label sustituye al contenido como nombre accesible: sin el
        // número dentro, el lector anunciaba "Notificaciones" aunque hubiera 5.
        aria-label={unreadCount > 0 ? `Notificaciones, ${unreadCount} sin leer` : 'Notificaciones'}
        aria-expanded={isOpen}
        aria-haspopup="true"
        title="Notificaciones"
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        {unreadCount > 0 && (
          // Tinta sobre naranja: 4.87:1 (blanco sobre naranja no pasa AA).
          <span
            aria-hidden="true"
            className="absolute right-0.5 top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-orange px-1 font-display text-[10px] font-bold tabular-nums text-ink ring-2 ring-paper"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-line bg-white shadow-ap-3">
          {/* Cabecera */}
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
            <h3 className="font-display text-sm font-semibold text-ink">Notificaciones</h3>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="rounded-md px-1.5 py-0.5 text-xs font-medium text-teal hover:bg-teal-tint"
              >
                Marcar todas leídas
              </button>
            )}
          </div>

          {/* Lista */}
          <div className="max-h-80 overflow-y-auto overscroll-contain">
            {loading ? (
              <div className="space-y-3 px-4 py-4" aria-label="Cargando notificaciones">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex gap-3">
                    <div className="skeleton h-8 w-8 rounded-full" />
                    <div className="flex-1 space-y-1.5">
                      <div className="skeleton h-3 w-3/4" />
                      <div className="skeleton h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="font-serif text-lg italic text-ink">Todo en calma.</p>
                <p className="mt-1 text-sm text-ink-muted">No tienes notificaciones</p>
              </div>
            ) : (
              notifications.map((notif) => {
                const Icono = getTypeIcon(notif.type);
                const content = (
                  <div
                    className={`flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors duration-150 hover:bg-paper ${
                      !notif.read ? 'bg-teal-tint/40' : ''
                    }`}
                  >
                    <span
                      className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-mist text-teal"
                      aria-hidden="true"
                    >
                      <Icono className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm ${!notif.read ? 'font-semibold text-ink' : 'text-ink'}`}>
                        {notif.title}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-ink-muted">{notif.message}</p>
                      <p className="mt-1 text-[11px] text-ink-muted">
                        {timeAgo(notif.createdAt)}
                        {!notif.read && <span className="sr-only"> · sin leer</span>}
                      </p>
                    </div>
                    {!notif.read && (
                      <span className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-orange" aria-hidden="true"></span>
                    )}
                  </div>
                );

                return notif.link ? (
                  <Link
                    key={notif.id}
                    href={notif.link}
                    onClick={() => handleNotificationClick(notif)}
                    className="block focus-visible:outline-offset-[-2px]"
                  >
                    {content}
                  </Link>
                ) : (
                  // Sin enlace no hay elemento enfocable: se hace operable por
                  // teclado sin cambiar su aspecto.
                  <div
                    key={notif.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleNotificationClick(notif)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleNotificationClick(notif);
                      }
                    }}
                  >
                    {content}
                  </div>
                );
              })
            )}
          </div>

          {/* Pie */}
          <Link
            href="/notifications"
            onClick={() => setIsOpen(false)}
            className="block border-t border-line px-4 py-3 text-center text-sm font-medium text-teal transition-colors duration-150 hover:bg-paper"
          >
            Ver todas las notificaciones
          </Link>
        </div>
      )}
    </div>
  );
}
