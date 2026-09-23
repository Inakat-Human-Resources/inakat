// RUTA: src/components/shared/NotificationBell.tsx

'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Bell } from 'lucide-react';
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
  // La campanita vive en el Navbar del layout raíz, es decir, en TODAS las
  // páginas de todo usuario autenticado. Sin frenos, cada pestaña abierta
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

  // Icono por tipo de notificación
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'new_request':
        return '🏢';
      case 'request_approved':
        return '✅';
      case 'request_rejected':
        return '❌';
      case 'assignment':
        return '📋';
      case 'new_application':
        return '📩';
      case 'credits_purchased':
        return '💰';
      case 'sent_to_specialist':
        return '🔬';
      case 'sent_to_company':
        return '📤';
      case 'application_status':
        return '📊';
      case 'interview_requested':
      case 'interview_confirmed':
        return '📅';
      case 'interview_rescheduled':
        return '🔁';
      case 'interview_cancelled':
        return '🚫';
      case 'contact_message':
        return '✉️';
      default:
        return '🔔';
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        ref={botonRef}
        type="button"
        onClick={handleToggle}
        className="relative p-2 text-title-dark hover:bg-white/50 rounded-full transition-colors"
        // El aria-label sustituye al contenido como nombre accesible: sin el
        // número dentro, el lector anunciaba "Notificaciones" aunque hubiera 5.
        aria-label={unreadCount > 0 ? `Notificaciones, ${unreadCount} sin leer` : 'Notificaciones'}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <Bell className="w-5 h-5" aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">Notificaciones</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-button-green hover:underline"
              >
                Marcar todas leídas
              </button>
            )}
          </div>

          {/* Lista */}
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="py-8 text-center text-sm text-gray-400">Cargando...</div>
            ) : notifications.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-400">
                No tienes notificaciones
              </div>
            ) : (
              notifications.map((notif) => {
                const content = (
                  <div
                    className={`flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer ${
                      !notif.read ? 'bg-blue-50/50' : ''
                    }`}
                  >
                    <span className="text-lg flex-shrink-0 mt-0.5">{getTypeIcon(notif.type)}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${!notif.read ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                        {notif.title}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{notif.message}</p>
                      <p className="text-[10px] text-gray-400 mt-1">{timeAgo(notif.createdAt)}</p>
                    </div>
                    {!notif.read && (
                      <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-2"></span>
                    )}
                  </div>
                );

                return notif.link ? (
                  <Link
                    key={notif.id}
                    href={notif.link}
                    onClick={() => handleNotificationClick(notif)}
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

          {/* Footer */}
          <Link
            href="/notifications"
            onClick={() => setIsOpen(false)}
            className="block text-center px-4 py-3 text-sm text-button-green font-medium hover:bg-gray-50 border-t border-gray-100 transition-colors"
          >
            Ver todas las notificaciones
          </Link>
        </div>
      )}
    </div>
  );
}
