// RUTA: src/app/company/integrations/page.tsx
//
// Pantalla de Integraciones de la empresa (puente con Worky2).
//
// El backend (/api/integration/keys y /api/integration/webhooks) estaba
// completo pero no había NINGUNA pantalla que lo consumiera: la documentación
// pedía un `Authorization: Bearer <jwt>` que la empresa no puede obtener
// (la cookie es httpOnly y el login no devuelve el token en el cuerpo), así que
// la única vía era pedirle a soporte que creara la key con DevTools.
//
// Las llamadas van con `credentials: 'include'`: requireCompanyUser acepta la
// cookie auth-token además del Bearer.

'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { KeyRound, Webhook, Copy, Check, Trash2, Plus } from 'lucide-react';

interface ApiKey {
  id: number;
  name: string;
  isActive: boolean;
  lastUsedAt: string | null;
  createdAt: string;
  maskedKey: string;
}

interface WebhookItem {
  id: number;
  url: string;
  maskedSecret: string;
  isActive: boolean;
  createdAt: string;
}

const formatearFecha = (valor: string | null) =>
  valor
    ? new Date(valor).toLocaleDateString('es-MX', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      })
    : '—';

export default function CompanyIntegrationsPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookItem[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  // Formulario de API key
  const [nombreKey, setNombreKey] = useState('');
  const [creandoKey, setCreandoKey] = useState(false);
  // La key en claro sólo viaja en la respuesta de creación: se muestra una vez.
  const [keyEnClaro, setKeyEnClaro] = useState<string | null>(null);
  const [copiada, setCopiada] = useState(false);

  // Formulario de webhook
  const [urlWebhook, setUrlWebhook] = useState('');
  const [secretoWebhook, setSecretoWebhook] = useState('');
  const [creandoWebhook, setCreandoWebhook] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const [resKeys, resHooks] = await Promise.all([
        fetch('/api/integration/keys', { credentials: 'include' }),
        fetch('/api/integration/webhooks', { credentials: 'include' })
      ]);

      if (!resKeys.ok || !resHooks.ok) {
        const fallo = !resKeys.ok ? await resKeys.json().catch(() => null) : await resHooks.json().catch(() => null);
        throw new Error(fallo?.error || 'No pudimos cargar tus integraciones.');
      }

      const datosKeys = await resKeys.json();
      const datosHooks = await resHooks.json();
      setKeys(datosKeys.data ?? []);
      setWebhooks(datosHooks.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos cargar tus integraciones.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const crearKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreandoKey(true);
    setError(null);
    setAviso(null);
    try {
      const res = await fetch('/api/integration/keys', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nombreKey })
      });
      const datos = await res.json().catch(() => null);
      if (!res.ok) throw new Error(datos?.error || 'No pudimos crear la API key.');

      setKeyEnClaro(datos.data.key);
      setCopiada(false);
      setNombreKey('');
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos crear la API key.');
    } finally {
      setCreandoKey(false);
    }
  };

  const revocarKey = async (id: number) => {
    setError(null);
    try {
      const res = await fetch(`/api/integration/keys?id=${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      const datos = await res.json().catch(() => null);
      if (!res.ok) throw new Error(datos?.error || 'No pudimos revocar la API key.');
      setAviso('API key revocada.');
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos revocar la API key.');
    }
  };

  const crearWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreandoWebhook(true);
    setError(null);
    setAviso(null);
    try {
      const res = await fetch('/api/integration/webhooks', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlWebhook, secret: secretoWebhook })
      });
      const datos = await res.json().catch(() => null);
      if (!res.ok) throw new Error(datos?.error || 'No pudimos registrar el webhook.');

      setAviso('Webhook registrado. Recibirá el evento candidate.accepted.');
      setUrlWebhook('');
      setSecretoWebhook('');
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos registrar el webhook.');
    } finally {
      setCreandoWebhook(false);
    }
  };

  const desactivarWebhook = async (id: number) => {
    setError(null);
    try {
      const res = await fetch(`/api/integration/webhooks?id=${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      const datos = await res.json().catch(() => null);
      if (!res.ok) throw new Error(datos?.error || 'No pudimos desactivar el webhook.');
      setAviso('Webhook desactivado.');
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos desactivar el webhook.');
    }
  };

  const copiarKey = async () => {
    if (!keyEnClaro) return;
    try {
      await navigator.clipboard.writeText(keyEnClaro);
      setCopiada(true);
    } catch {
      setError('No pudimos copiar la key. Selecciónala y cópiala a mano.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-24 pb-12">
      <div className="container mx-auto max-w-3xl px-4">
        <h1 className="text-2xl font-bold text-title-dark mb-1">Integraciones</h1>
        <p className="text-sm text-gray-500 mb-6">
          Conecta tu sistema de nómina con INAKAT: las API keys sirven para consultar
          tus candidatos aceptados y los webhooks para recibir el aviso en cuanto
          aceptas a uno.
        </p>

        {error && (
          <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}
        {aviso && (
          <div role="status" className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            {aviso}
          </div>
        )}

        {/* ============ API KEYS ============ */}
        <section className="mb-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-title-dark">
            <KeyRound className="h-5 w-5" /> API keys
          </h2>

          {keyEnClaro && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-900">
                Guarda esta key ahora: no volverá a mostrarse.
              </p>
              <div className="mt-2 flex items-center gap-2">
                <code className="flex-1 break-all rounded bg-white px-3 py-2 font-mono text-sm">
                  {keyEnClaro}
                </code>
                <button
                  type="button"
                  onClick={copiarKey}
                  className="flex items-center gap-1 rounded-lg bg-title-dark px-3 py-2 text-sm text-white"
                >
                  {copiada ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copiada ? 'Copiada' : 'Copiar'}
                </button>
              </div>
              <button
                type="button"
                onClick={() => setKeyEnClaro(null)}
                className="mt-2 text-xs text-amber-900 underline"
              >
                Ya la guardé, ocultar
              </button>
            </div>
          )}

          <form onSubmit={crearKey} className="mb-5 flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={nombreKey}
              onChange={(e) => setNombreKey(e.target.value)}
              placeholder="Nombre (ej. Worky2 producción)"
              required
              minLength={2}
              maxLength={80}
              className="flex-1 rounded-lg border border-gray-200 p-3 text-sm outline-none focus:border-button-green"
            />
            <button
              type="submit"
              disabled={creandoKey}
              className="flex items-center justify-center gap-1 rounded-lg bg-button-green px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              {creandoKey ? 'Creando…' : 'Crear API key'}
            </button>
          </form>

          {cargando ? (
            <p className="text-sm text-gray-400">Cargando…</p>
          ) : keys.length === 0 ? (
            <p className="text-sm text-gray-400">Todavía no has creado ninguna API key.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {keys.map((key) => (
                <li key={key.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900">{key.name}</p>
                    <p className="font-mono text-xs text-gray-400">{key.maskedKey}</p>
                    <p className="text-xs text-gray-400">
                      Creada {formatearFecha(key.createdAt)} · Último uso {formatearFecha(key.lastUsedAt)}
                    </p>
                  </div>
                  {key.isActive ? (
                    <button
                      type="button"
                      onClick={() => revocarKey(key.id)}
                      className="flex items-center gap-1 whitespace-nowrap text-sm text-red-600 hover:underline"
                    >
                      <Trash2 className="h-4 w-4" /> Revocar
                    </button>
                  ) : (
                    <span className="whitespace-nowrap text-xs text-gray-400">Revocada</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ============ WEBHOOKS ============ */}
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-title-dark">
            <Webhook className="h-5 w-5" /> Webhooks
          </h2>
          <p className="mb-4 text-sm text-gray-500">
            Cada vez que aceptes a un candidato, INAKAT enviará un POST firmado a esta
            URL. Debe ser https y pública: no se admiten direcciones internas.
          </p>

          <form onSubmit={crearWebhook} className="mb-5 space-y-2">
            <input
              type="url"
              value={urlWebhook}
              onChange={(e) => setUrlWebhook(e.target.value)}
              placeholder="https://tu-sistema.com/inakat/webhook"
              required
              maxLength={2048}
              className="w-full rounded-lg border border-gray-200 p-3 text-sm outline-none focus:border-button-green"
            />
            <input
              type="text"
              value={secretoWebhook}
              onChange={(e) => setSecretoWebhook(e.target.value)}
              placeholder="Secreto compartido (mínimo 16 caracteres)"
              required
              minLength={16}
              maxLength={200}
              className="w-full rounded-lg border border-gray-200 p-3 text-sm outline-none focus:border-button-green"
            />
            <button
              type="submit"
              disabled={creandoWebhook}
              className="flex items-center justify-center gap-1 rounded-lg bg-button-green px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              {creandoWebhook ? 'Registrando…' : 'Registrar webhook'}
            </button>
          </form>

          {cargando ? (
            <p className="text-sm text-gray-400">Cargando…</p>
          ) : webhooks.length === 0 ? (
            <p className="text-sm text-gray-400">Todavía no has registrado ningún webhook.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {webhooks.map((hook) => (
                <li key={hook.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900">{hook.url}</p>
                    <p className="font-mono text-xs text-gray-400">
                      Secreto {hook.maskedSecret} · {formatearFecha(hook.createdAt)}
                    </p>
                  </div>
                  {hook.isActive ? (
                    <button
                      type="button"
                      onClick={() => desactivarWebhook(hook.id)}
                      className="flex items-center gap-1 whitespace-nowrap text-sm text-red-600 hover:underline"
                    >
                      <Trash2 className="h-4 w-4" /> Desactivar
                    </button>
                  ) : (
                    <span className="whitespace-nowrap text-xs text-gray-400">Inactivo</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
