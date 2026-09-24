// RUTA: src/app/admin/requests/_components/DetalleSolicitud.tsx
'use client';

/**
 * Detalle de una solicitud de alta de empresa, con edición en línea de sus
 * datos (sólo mientras está pendiente).
 *
 * Es la presentación nueva («Arco», registro de aplicación) de
 * src/components/sections/admin/RequestDetailModal.tsx (ya borrado), con su MISMA lógica:
 * el mismo PUT /api/company-requests/[id] con el mismo cuerpo, la misma
 * restauración al cancelar, la misma comprobación de URL antes de abrir un
 * documento (esUrlSegura) y las mismas acciones de aprobar/rechazar que pasa la
 * página. Cambia el envoltorio: Modal del sistema (role="dialog", foco
 * atrapado, Escape), etiquetas visibles en cada campo y estados con texto.
 */

import React, { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Info,
  Pencil,
  Save,
  X,
  XCircle
} from 'lucide-react';
import CompanyLogo from '@/components/shared/CompanyLogo';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import StatusBadge from '@/components/ui/Badge';
import FormField, { Input } from '@/components/ui/FormField';
import { cn } from '@/lib/utils';
import { type CompanyRequest, nombreRepresentante } from './tipos';
import { fechaHora } from '@/lib/fechas';

interface DetalleSolicitudProps {
  request: CompanyRequest;
  onClose: () => void;
  onApprove?: (id: number) => void;
  onReject?: (id: number) => void;
  onUpdate?: () => void;
}

/** Rótulo de cada bloque del detalle. */
const CLASE_BLOQUE =
  'mb-3 font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted';

/** Un dato de sólo lectura (término + valor). */
function Dato({ termino, children, className }: { termino: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('min-w-0', className)}>
      <dt className="text-xs text-ink-muted">{termino}</dt>
      <dd className="mt-0.5 break-words text-sm font-medium text-ink">{children}</dd>
    </div>
  );
}

/** Botón que abre un documento en otra pestaña (tras comprobar su URL). */
function BotonDocumento({ url, etiqueta, alAbrir }: { url: string; etiqueta: string; alAbrir: (url: string) => void }) {
  const esPdf = url.endsWith('.pdf');
  const Icono = esPdf ? FileText : ImageIcon;
  return (
    <button
      type="button"
      onClick={() => alAbrir(url)}
      className="group flex w-full items-center gap-3 rounded-lg border border-line-strong bg-white px-3 py-2.5 text-left transition-colors duration-150 hover:border-ink hover:bg-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
    >
      <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-teal-tint text-teal" aria-hidden="true">
        <Icono className="h-[18px] w-[18px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-ink">{etiqueta}</span>
        <span className="block text-xs text-ink-muted">{esPdf ? 'PDF' : 'Imagen'} · se abre en una pestaña nueva</span>
      </span>
      <ExternalLink className="h-4 w-4 flex-none text-ink-muted transition-colors duration-150 group-hover:text-ink" aria-hidden="true" />
    </button>
  );
}

export default function DetalleSolicitud({
  request,
  onClose,
  onApprove,
  onReject,
  onUpdate
}: DetalleSolicitudProps) {
  // Estados para modo edición
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editedData, setEditedData] = useState({
    nombre: request.nombre,
    apellidoPaterno: request.apellidoPaterno,
    apellidoMaterno: request.apellidoMaterno,
    nombreEmpresa: request.nombreEmpresa,
    correoEmpresa: request.correoEmpresa,
    sitioWeb: request.sitioWeb || '',
    razonSocial: request.razonSocial,
    rfc: request.rfc,
    direccionEmpresa: request.direccionEmpresa,
  });
  const [saveError, setSaveError] = useState<string | null>(null);

  // Función para guardar cambios
  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);
    try {
      const response = await fetch(`/api/company-requests/${request.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editedData),
      });

      if (response.ok) {
        setIsEditing(false);
        if (onUpdate) onUpdate();
        onClose();
      } else {
        const data = await response.json();
        setSaveError(data.error || 'Error al guardar cambios');
      }
    } catch (error) {
      console.error('Error al guardar:', error);
      setSaveError('Error de conexión al guardar');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setSaveError(null);
    // Restaurar datos originales
    setEditedData({
      nombre: request.nombre,
      apellidoPaterno: request.apellidoPaterno,
      apellidoMaterno: request.apellidoMaterno,
      nombreEmpresa: request.nombreEmpresa,
      correoEmpresa: request.correoEmpresa,
      sitioWeb: request.sitioWeb || '',
      razonSocial: request.razonSocial,
      rfc: request.rfc,
      direccionEmpresa: request.direccionEmpresa,
    });
  };

  // Cuándo pasó, con hora (src/lib/fechas): «23 sep 2026, 18:22».
  const formatDate = (dateString: string | null | undefined) => fechaHora(dateString);

  /**
   * ¿Es una URL http(s) absoluta (o una ruta local de desarrollo)?
   *
   * `window.open` NO está protegido por React —React 19 sólo bloquea
   * `javascript:` en atributos `href`—, así que una solicitud guardada con
   * `identificacionUrl: "javascript:fetch('/api/admin/users',…)"` ejecutaba ese
   * script con el origen de INAKAT y la cookie del admin en cuanto éste pulsaba
   * "Ver identificación" durante el flujo normal de aprobación. El schema ya
   * exige http(s) al guardar, pero las filas creadas antes de ese arreglo
   * siguen en la base: aquí se comprueba también al abrir.
   */
  const esUrlSegura = (url: string): boolean => {
    // Ruta servida por la propia app. '//host' y '/\host' NO lo son: el
    // navegador los resuelve como URL de otro dominio.
    if (url.startsWith('/')) return !url.startsWith('//') && !url.startsWith('/\\');
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const [urlError, setUrlError] = useState<string | null>(null);

  const openFile = (url: string) => {
    if (!esUrlSegura(url)) {
      setUrlError('El enlace del documento no es válido y no se abrió por seguridad.');
      return;
    }
    setUrlError(null);
    // noopener/noreferrer: la pestaña abierta no debe poder tocar window.opener.
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // --- Sólo presentación: el foco sigue al modo --------------------------------
  // Al entrar a editar, el foco va al primer campo; al cancelar, vuelve a
  // «Editar datos» (si no, se quedaba en un botón que ya no existe).
  const primerCampoRef = useRef<HTMLInputElement>(null);
  const botonEditarRef = useRef<HTMLButtonElement>(null);
  const editandoAntes = useRef(false);
  useEffect(() => {
    if (isEditing) primerCampoRef.current?.focus();
    else if (editandoAntes.current) botonEditarRef.current?.focus();
    editandoAntes.current = isEditing;
  }, [isEditing]);

  /** value + onChange de un campo del formulario de edición. */
  const campo = (clave: keyof typeof editedData) => ({
    value: editedData[clave],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setEditedData(prev => ({ ...prev, [clave]: e.target.value }))
  });

  const pendiente = request.status === 'pending';

  // Pie: pendiente → editar / rechazar / aprobar (o cancelar / guardar mientras
  // se edita); resuelta → cerrar.
  const pie = pendiente ? (
    isEditing ? (
      <>
        {saveError && (
          <p role="alert" className="flex items-start gap-1.5 text-sm font-medium text-danger sm:mr-auto">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
            {saveError}
          </p>
        )}
        <Button variante="contorno" icono={X} onClick={handleCancelEdit} disabled={isSaving}>
          Cancelar
        </Button>
        <Button icono={Save} onClick={handleSave} cargando={isSaving} textoCargando="Guardando…">
          Guardar cambios
        </Button>
      </>
    ) : (
      <>
        <Button
          ref={botonEditarRef}
          variante="fantasma"
          icono={Pencil}
          onClick={() => setIsEditing(true)}
          className="sm:mr-auto"
        >
          Editar datos
        </Button>
        {onApprove && onReject && (
          <>
            <Button variante="contorno" icono={XCircle} onClick={() => onReject(request.id)}>
              Rechazar
            </Button>
            <Button icono={Check} onClick={() => onApprove(request.id)}>
              Aprobar
            </Button>
          </>
        )}
      </>
    )
  ) : (
    <Button variante="contorno" onClick={onClose}>
      Cerrar
    </Button>
  );

  return (
    <Modal
      abierto
      alCerrar={onClose}
      tamano="lg"
      titulo={request.nombreEmpresa}
      subtitulo={
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <StatusBadge estado={request.status} contexto="solicitud" tamano="sm" />
          <span>
            Solicitud #{request.id} · recibida el {formatDate(request.createdAt)}
          </span>
        </span>
      }
      // Con cambios a medias, un clic fuera no los tira.
      cerrarAlPulsarFondo={!isEditing}
      pie={pie}
    >
      <div className="space-y-6">
        {isEditing && (
          <p className="flex items-start gap-2 rounded-lg bg-teal-tint px-3 py-2.5 text-[13px] text-teal-dark">
            <Info className="mt-px h-4 w-4 flex-none" aria-hidden="true" />
            <span>
              Estás editando los datos de la solicitud. Si cambias el correo, también cambia el correo con el que la
              empresa inicia sesión.
            </span>
          </p>
        )}

        {/* EMPRESA */}
        <section className="[overflow:visible]" aria-labelledby={`solicitud-${request.id}-empresa`}>
          <h3 id={`solicitud-${request.id}-empresa`} className={CLASE_BLOQUE}>
            Empresa
          </h3>
          {isEditing ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField etiqueta="Nombre comercial">
                <Input ref={primerCampoRef} type="text" {...campo('nombreEmpresa')} autoComplete="off" />
              </FormField>
              <FormField etiqueta="Razón social">
                <Input type="text" {...campo('razonSocial')} autoComplete="off" />
              </FormField>
              <FormField etiqueta="RFC" ayuda="12 o 13 caracteres.">
                <Input
                  type="text"
                  value={editedData.rfc}
                  onChange={(e) => setEditedData(prev => ({ ...prev, rfc: e.target.value.toUpperCase() }))}
                  className="font-mono uppercase"
                  maxLength={13}
                  autoComplete="off"
                />
              </FormField>
              <FormField etiqueta="Correo electrónico">
                <Input type="email" {...campo('correoEmpresa')} autoComplete="off" />
              </FormField>
              <FormField etiqueta="Sitio web" opcional>
                <Input type="text" {...campo('sitioWeb')} placeholder="https://www.ejemplo.com" autoComplete="off" />
              </FormField>
              <FormField etiqueta="Dirección" className="sm:col-span-2">
                <Input type="text" {...campo('direccionEmpresa')} autoComplete="off" />
              </FormField>
            </div>
          ) : (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <CompanyLogo logoUrl={request.logoUrl} companyName={request.nombreEmpresa} size="lg" />
              <dl className="grid flex-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                <Dato termino="Nombre comercial">{request.nombreEmpresa}</Dato>
                <Dato termino="Razón social">{request.razonSocial}</Dato>
                <Dato termino="RFC">
                  <span className="font-mono tracking-wide">{request.rfc}</span>
                </Dato>
                <Dato termino="Correo electrónico">
                  <a href={`mailto:${request.correoEmpresa}`} className="break-all text-teal hover:text-teal-dark hover:underline">
                    {request.correoEmpresa}
                  </a>
                </Dato>
                <Dato termino="Sitio web">
                  {request.sitioWeb && esUrlSegura(request.sitioWeb) ? (
                    <a
                      href={request.sitioWeb}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 break-all text-teal hover:text-teal-dark hover:underline"
                    >
                      {request.sitioWeb}
                      <ExternalLink className="h-3.5 w-3.5 flex-none" aria-hidden="true" />
                      <span className="sr-only">(se abre en una pestaña nueva)</span>
                    </a>
                  ) : request.sitioWeb ? (
                    // Fila antigua con un esquema que no es http(s): se muestra el
                    // texto, nunca como enlace pinchable.
                    <span className="break-all text-ink-muted">{request.sitioWeb}</span>
                  ) : (
                    <span className="font-normal text-ink-muted">No especificado</span>
                  )}
                </Dato>
                <Dato termino="Dirección" className="sm:col-span-2">
                  {request.direccionEmpresa}
                </Dato>
              </dl>
            </div>
          )}
        </section>

        {/* REPRESENTANTE */}
        <section className="border-t border-line pt-5 [overflow:visible]" aria-labelledby={`solicitud-${request.id}-representante`}>
          <h3 id={`solicitud-${request.id}-representante`} className={CLASE_BLOQUE}>
            Representante
          </h3>
          {isEditing ? (
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField etiqueta="Nombre">
                <Input type="text" {...campo('nombre')} autoComplete="off" />
              </FormField>
              <FormField etiqueta="Apellido paterno">
                <Input type="text" {...campo('apellidoPaterno')} autoComplete="off" />
              </FormField>
              <FormField etiqueta="Apellido materno">
                <Input type="text" {...campo('apellidoMaterno')} autoComplete="off" />
              </FormField>
            </div>
          ) : (
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              <Dato termino="Nombre completo">{nombreRepresentante(request)}</Dato>
            </dl>
          )}
        </section>

        {/* DOCUMENTOS */}
        <section className="border-t border-line pt-5 [overflow:visible]" aria-labelledby={`solicitud-${request.id}-documentos`}>
          <h3 id={`solicitud-${request.id}-documentos`} className={CLASE_BLOQUE}>
            Documentos
          </h3>
          {urlError && (
            <div
              role="alert"
              className="mb-3 flex items-start gap-2 rounded-lg border border-danger/30 bg-danger-tint px-3 py-2 text-sm font-medium text-danger-dark"
            >
              <AlertCircle className="mt-px h-4 w-4 flex-none" aria-hidden="true" />
              {urlError}
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {request.identificacionUrl ? (
              <BotonDocumento url={request.identificacionUrl} etiqueta="Ver identificación" alAbrir={openFile} />
            ) : (
              <p className="rounded-lg border border-dashed border-line-strong px-3 py-3 text-sm text-ink-muted">
                Identificación: no disponible
              </p>
            )}
            {request.documentosConstitucionUrl ? (
              <BotonDocumento
                url={request.documentosConstitucionUrl}
                etiqueta="Ver documentos de constitución"
                alAbrir={openFile}
              />
            ) : (
              <p className="rounded-lg border border-dashed border-line-strong px-3 py-3 text-sm text-ink-muted">
                Documentos de constitución: no disponibles
              </p>
            )}
          </div>
        </section>

        {/* INFORMACIÓN DE ESTADO */}
        {request.status === 'rejected' && request.rejectionReason && (
          <div className="rounded-xl border border-danger/30 bg-danger-tint px-4 py-3">
            <p className="flex items-center gap-2 font-display text-sm font-semibold text-danger-dark">
              <XCircle className="h-4 w-4 flex-none" aria-hidden="true" />
              Motivo del rechazo
            </p>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm text-ink">{request.rejectionReason}</p>
          </div>
        )}

        {request.status === 'approved' && request.approvedAt && (
          <div className="rounded-xl border border-lime/40 bg-lime-tint px-4 py-3">
            <p className="flex items-center gap-2 font-display text-sm font-semibold text-lime-dark">
              <CheckCircle2 className="h-4 w-4 flex-none" aria-hidden="true" />
              Aprobada el {formatDate(request.approvedAt)}
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}
