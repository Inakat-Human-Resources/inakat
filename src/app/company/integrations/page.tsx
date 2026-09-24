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
//
// Registro de aplicación (docs/DISENO.md): mismas llamadas, mismos cuerpos y
// mismas validaciones de los campos; cambió la presentación (FormField,
// DataTable, avisos del sistema).

'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { KeyRound, Webhook, Copy, Check, Trash2, Plus, ShieldAlert, EyeOff } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import FormField, { Input } from '@/components/ui/FormField';
import Button from '@/components/ui/Button';
import DataTable, { type Columna } from '@/components/ui/DataTable';
import StatusBadge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import Toast from '@/components/ui/Toast';
import { fechaCorta } from '@/lib/fechas';

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

/** Botón «Revocar»/«Desactivar» de una fila: terciario, en rojo (6.57 sobre blanco). */
const CLASE_QUITAR = 'text-danger hover:bg-danger-tint';

/*
 * En móvil las dos tablas pasan a tarjetas (docs/DISENO.md §7). La URL del
 * webhook y la key enmascarada son cadenas largas sin espacios; a 390 px el
 * botón rojo, arriba a la derecha, caía encima de la URL. Ahora:
 * - «Revocar»/«Desactivar» son botones CON TEXTO en la columna de acciones:
 *   la vista en tarjetas de DataTable los baja a su propia fila, al pie
 *   (arreglo de sistema, app.css), y el título se queda con toda la línea;
 * - la URL y la key cortan en cualquier carácter (break-all), así nunca
 *   empujan ni se recortan.
 */

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

  // ---------------------------------------------------------------------------
  // Columnas
  // ---------------------------------------------------------------------------
  const columnasKeys: Columna<ApiKey>[] = [
    {
      id: 'name',
      encabezado: 'Nombre',
      enTarjeta: 'titulo',
      className: 'min-w-[12rem]',
      celda: (key) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-ink">{key.name}</p>
          <p className="break-all font-mono text-xs text-ink-muted">{key.maskedKey}</p>
        </div>
      ),
    },
    {
      id: 'createdAt',
      encabezado: 'Creada',
      ocultarBajo: 'md',
      className: 'whitespace-nowrap',
      celda: (key) => <span className="tabular-nums">{fechaCorta(key.createdAt)}</span>,
    },
    {
      id: 'lastUsedAt',
      encabezado: 'Último uso',
      className: 'whitespace-nowrap',
      celda: (key) => <span className="tabular-nums text-ink-muted">{fechaCorta(key.lastUsedAt)}</span>,
    },
    {
      id: 'estado',
      encabezado: 'Estado',
      className: 'whitespace-nowrap',
      celda: (key) =>
        key.isActive ? (
          <StatusBadge estado="active" etiqueta="Activa" />
        ) : (
          <StatusBadge estado="inactive" etiqueta="Revocada" />
        ),
    },
    {
      id: 'acciones',
      encabezado: 'Acciones',
      encabezadoOculto: true,
      alinear: 'fin',
      enTarjeta: 'acciones',
      className: 'w-px whitespace-nowrap',
      celda: (key) =>
        key.isActive ? (
          <Button
            variante="fantasma"
            tamano="sm"
            icono={Trash2}
            onClick={() => revocarKey(key.id)}
            className={CLASE_QUITAR}
            aria-label={`Revocar la API key ${key.name}`}
          >
            Revocar
          </Button>
        ) : null,
    },
  ];

  const columnasWebhooks: Columna<WebhookItem>[] = [
    {
      id: 'url',
      encabezado: 'URL',
      enTarjeta: 'titulo',
      className: 'min-w-[14rem]',
      celda: (hook) => (
        <div className="min-w-0">
          <p className="break-all font-mono text-[13px] font-medium text-ink">{hook.url}</p>
          <p className="font-mono text-xs text-ink-muted">Secreto {hook.maskedSecret}</p>
        </div>
      ),
    },
    {
      id: 'createdAt',
      encabezado: 'Registrado',
      ocultarBajo: 'md',
      className: 'whitespace-nowrap',
      celda: (hook) => <span className="tabular-nums">{fechaCorta(hook.createdAt)}</span>,
    },
    {
      id: 'estado',
      encabezado: 'Estado',
      className: 'whitespace-nowrap',
      celda: (hook) =>
        hook.isActive ? (
          <StatusBadge estado="active" etiqueta="Activo" />
        ) : (
          <StatusBadge estado="inactive" etiqueta="Inactivo" />
        ),
    },
    {
      id: 'acciones',
      encabezado: 'Acciones',
      encabezadoOculto: true,
      alinear: 'fin',
      enTarjeta: 'acciones',
      className: 'w-px whitespace-nowrap',
      celda: (hook) =>
        hook.isActive ? (
          <Button
            variante="fantasma"
            tamano="sm"
            icono={Trash2}
            onClick={() => desactivarWebhook(hook.id)}
            className={CLASE_QUITAR}
            aria-label={`Desactivar el webhook ${hook.url}`}
          >
            Desactivar
          </Button>
        ) : null,
    },
  ];

  return (
    <>
      {/* La cabecera va a todo el ancho, como en el resto de páginas (el borde
          derecho no salta al navegar); sólo se estrechan las tarjetas. */}
      <PageHeader
        antetitulo="Empresa"
        titulo="Integraciones"
        remate="con tu nómina"
        descripcion="Conecta tu sistema de nómina con INAKAT: las API keys sirven para consultar tus candidatos aceptados y los webhooks para recibir el aviso en cuanto aceptas a uno."
      />

      <div className="max-w-5xl space-y-6">
        {/* ============ API KEYS ============ */}
        <Card
          titulo={
            <span className="flex items-center gap-2">
              <KeyRound className="h-[18px] w-[18px] text-teal" aria-hidden="true" /> API keys
            </span>
          }
          descripcion="Tu sistema las usa para consultar a los candidatos que aceptaste."
          sinRelleno
        >
          <div className="space-y-4 border-b border-line px-5 py-4">
            {keyEnClaro && (
              <div className="rounded-xl border border-orange/40 bg-orange-tint p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <ShieldAlert className="h-4 w-4 flex-none text-orange-dark" aria-hidden="true" />
                  Guarda esta key ahora: no volverá a mostrarse.
                </p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <code className="min-w-0 flex-1 select-all break-all rounded-lg border border-line bg-white px-3 py-2 font-mono text-sm text-ink">
                    {keyEnClaro}
                  </code>
                  <Button variante="secundario" icono={copiada ? Check : Copy} onClick={copiarKey}>
                    {copiada ? 'Copiada' : 'Copiar'}
                  </Button>
                </div>
                <span className="sr-only" role="status">
                  {copiada ? 'Key copiada al portapapeles' : ''}
                </span>
                <Button
                  variante="fantasma"
                  tamano="sm"
                  icono={EyeOff}
                  onClick={() => setKeyEnClaro(null)}
                  className="-ml-2 mt-2"
                >
                  Ya la guardé, ocultar
                </Button>
              </div>
            )}

            <form onSubmit={crearKey} className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <FormField etiqueta="Nombre de la API key" requerido className="flex-1">
                <Input
                  type="text"
                  value={nombreKey}
                  onChange={(e) => setNombreKey(e.target.value)}
                  placeholder="Nombre (ej. Worky2 producción)"
                  minLength={2}
                  maxLength={80}
                />
              </FormField>
              <Button type="submit" variante="secundario" icono={Plus} cargando={creandoKey} textoCargando="Creando…">
                Crear API key
              </Button>
            </form>
          </div>

          <DataTable
            etiqueta="API keys"
            columnas={columnasKeys}
            filas={keys}
            claveFila={(key) => key.id}
            cargando={cargando}
            filasEsqueleto={2}
            cabeceraFija={false}
            vacio={
              <EmptyState
                compacto
                icono={KeyRound}
                titulo="Todavía no has creado ninguna API key."
                descripcion="Crea una arriba y pégala en la configuración de tu sistema de nómina."
              />
            }
          />
        </Card>

        {/* ============ WEBHOOKS ============ */}
        <Card
          titulo={
            <span className="flex items-center gap-2">
              <Webhook className="h-[18px] w-[18px] text-teal" aria-hidden="true" /> Webhooks
            </span>
          }
          descripcion="Cada vez que aceptes a un candidato, INAKAT enviará un POST firmado a esta URL. Debe ser https y pública: no se admiten direcciones internas."
          sinRelleno
        >
          <form onSubmit={crearWebhook} className="grid gap-4 border-b border-line px-5 py-4 md:grid-cols-2">
            <FormField etiqueta="URL del webhook" requerido ayuda="https y accesible desde internet.">
              <Input
                type="url"
                value={urlWebhook}
                onChange={(e) => setUrlWebhook(e.target.value)}
                placeholder="https://tu-sistema.com/inakat/webhook"
                maxLength={2048}
              />
            </FormField>
            <FormField etiqueta="Secreto compartido" requerido ayuda="Mínimo 16 caracteres. Con él verificas la firma de cada aviso.">
              <Input
                type="text"
                value={secretoWebhook}
                onChange={(e) => setSecretoWebhook(e.target.value)}
                placeholder="Secreto compartido (mínimo 16 caracteres)"
                minLength={16}
                maxLength={200}
                autoComplete="off"
              />
            </FormField>
            <div className="md:col-span-2">
              <Button type="submit" variante="secundario" icono={Plus} cargando={creandoWebhook} textoCargando="Registrando…">
                Registrar webhook
              </Button>
            </div>
          </form>

          <DataTable
            etiqueta="Webhooks"
            columnas={columnasWebhooks}
            filas={webhooks}
            claveFila={(hook) => hook.id}
            cargando={cargando}
            filasEsqueleto={2}
            cabeceraFija={false}
            vacio={
              <EmptyState
                compacto
                icono={Webhook}
                titulo="Todavía no has registrado ningún webhook."
                descripcion="Regístralo arriba para enterarte al momento de cada contratación."
              />
            }
          />
        </Card>
      </div>

      {/* Avisos: a la vista estés donde estés de la página. Los errores se
          quedan hasta cerrarlos; los avisos se van solos. */}
      <Toast tono="error" mensaje={error} alCerrar={() => setError(null)} duracion={0} />
      <Toast tono="exito" mensaje={aviso} alCerrar={() => setAviso(null)} />
    </>
  );
}
