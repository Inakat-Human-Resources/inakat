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

'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Mail, Phone, RefreshCw } from 'lucide-react';
import Paginacion, { PAGINACION_VACIA, type PaginacionApi } from '../_components/Paginacion';

interface ContactMessage {
  id: number;
  nombre: string;
  email: string;
  telefono: string | null;
  mensaje: string;
  createdAt: string;
}

export default function AdminContactMessagesPage() {
  const [mensajes, setMensajes] = useState<ContactMessage[]>([]);
  const [pagination, setPagination] = useState<PaginacionApi>(PAGINACION_VACIA);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const formatearFecha = (iso: string) =>
    new Date(iso).toLocaleString('es-MX', {
      dateStyle: 'medium',
      timeStyle: 'short'
    });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto py-8 px-4">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-6 md:mb-8">
          <div>
            <h1 className="text-2xl md:text-4xl font-bold text-gray-800 mb-1 md:mb-2">
              Mensajes de contacto
            </h1>
            <p className="text-gray-600 text-sm md:text-base">
              Lo que llega desde el formulario público de /contact, del más reciente al más antiguo
            </p>
          </div>
          <button
            type="button"
            onClick={() => fetchMensajes(page)}
            className="w-full sm:w-auto px-4 py-2 border border-gray-300 bg-white rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2 text-sm text-gray-700"
          >
            <RefreshCw size={16} />
            Actualizar
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm" role="alert">
            {error}
          </div>
        )}

        <div className="bg-white rounded-lg shadow">
          {isLoading ? (
            <div className="py-12 text-center text-gray-500">Cargando mensajes...</div>
          ) : mensajes.length === 0 ? (
            <div className="py-12 text-center text-gray-500">
              {error ? 'No se pudieron cargar los mensajes.' : 'Todavía no hay mensajes de contacto.'}
            </div>
          ) : (
            <ul className="divide-y">
              {mensajes.map((m) => (
                <li key={m.id} className="px-4 sm:px-6 py-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-2">
                    <p className="font-semibold text-gray-900 break-words">{m.nombre}</p>
                    <p className="text-xs text-gray-500">{formatearFecha(m.createdAt)}</p>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600 mb-2">
                    <a
                      href={`mailto:${m.email}`}
                      className="inline-flex items-center gap-1 text-button-green hover:underline break-all"
                    >
                      <Mail size={14} />
                      {m.email}
                    </a>
                    {m.telefono && (
                      <a
                        href={`tel:${m.telefono}`}
                        className="inline-flex items-center gap-1 hover:underline"
                      >
                        <Phone size={14} />
                        {m.telefono}
                      </a>
                    )}
                  </div>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">{m.mensaje}</p>
                </li>
              ))}
            </ul>
          )}

          <Paginacion pagination={pagination} onChange={setPage} etiqueta="mensajes" />
        </div>
      </div>
    </div>
  );
}
