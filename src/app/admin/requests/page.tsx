// RUTA: src/app/admin/requests/page.tsx

'use client';

/**
 * Solicitudes de alta de empresas: la cola que revisa el administrador.
 *
 * Registro de APLICACIÓN (docs/DISENO.md): PageHeader → pestañas por estado
 * con su cuenta → buscador → tabla → modales (detalle con edición, rechazo y
 * confirmación de aprobar). La lógica es la de siempre: mismas llamadas
 * (GET /api/company-requests, PATCH y PUT /api/company-requests/[id]), mismos
 * cuerpos, mismos filtros en el cliente.
 *
 * Cambios de forma, no de fondo:
 * - Las pestañas son el mismo filtro de estado de antes (statusFilter) con la
 *   cuenta de cada estado, que antes salía en cuatro tarjetas.
 * - El confirm() del navegador de «aprobar» pasó a un Modal; al aceptar se
 *   hace exactamente el mismo PATCH.
 * - El detalle y el rechazo son los mismos modales rehechos con el sistema
 *   (./_components), con la misma lógica que los de
 *   src/components/sections/admin/.
 * - La lista, que ya se descargaba entera, se pagina en el cliente (20 por
 *   página).
 */

import React, { useState, useEffect } from 'react';
import { Check, CheckCircle2, Eye, RefreshCw, XCircle } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import { AvisoError } from '@/components/ui/Aviso';
import Card from '@/components/ui/Card';
import DataTable, { type Columna } from '@/components/ui/DataTable';
import FilterToolbar from '@/components/ui/FilterToolbar';
import StatusBadge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import Button from '@/components/ui/Button';
import IconButton from '@/components/ui/IconButton';
import Modal from '@/components/ui/Modal';
import Toast from '@/components/ui/Toast';
import Tabs, { PanelPestana } from '@/components/ui/Tabs';
import { SkeletonPagina } from '@/components/ui/Skeleton';
import { paginacionLocal } from '@/components/ui/Pagination';
import DetalleSolicitud from './_components/DetalleSolicitud';
import RechazarSolicitud from './_components/RechazarSolicitud';
import { type CompanyRequest, nombreRepresentante } from './_components/tipos';
import { fechaCorta } from '@/lib/fechas';

/** Filas por página de la tabla (la lista llega entera: se pagina aquí). */
const SOLICITUDES_POR_PAGINA = 20;

export default function AdminRequestsPage() {
  const [requests, setRequests] = useState<CompanyRequest[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<CompanyRequest[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });

  // Modales
  const [selectedRequest, setSelectedRequest] = useState<CompanyRequest | null>(
    null
  );
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [requestToReject, setRequestToReject] = useState<CompanyRequest | null>(
    null
  );

  // Filtros
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // --- Estado sólo de presentación ------------------------------------------
  // Confirmación de aprobar (antes, confirm() del navegador).
  const [idPorAprobar, setIdPorAprobar] = useState<number | null>(null);
  const [aprobando, setAprobando] = useState(false);
  // Página de la tabla; vuelve a la 1 al cambiar de filtro.
  const [pagina, setPagina] = useState(1);
  useEffect(() => {
    setPagina(1);
  }, [statusFilter, searchQuery]);
  // Esqueleto de página sólo en la primera carga: al refrescar (también tras
  // aprobar o rechazar) se quedan la página y los modales abiertos, y sólo la
  // tabla muestra filas esqueleto.
  const [cargaInicial, setCargaInicial] = useState(true);
  useEffect(() => {
    if (!isLoading) setCargaInicial(false);
  }, [isLoading]);

  // Fetch requests from API
  useEffect(() => {
    fetchRequests();
  }, []);

  // Aplicar filtros cuando cambian
  useEffect(() => {
    applyFilters();
  }, [requests, statusFilter, searchQuery]);

  const fetchRequests = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/company-requests');
      const data = await response.json();

      if (response.ok) {
        setRequests(data.data);
      } else {
        setError(data.error || 'Error al cargar solicitudes');
      }
    } catch (error) {
      setError('Error al conectar con el servidor');
      console.error('Error fetching requests:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...requests];

    // Filtrar por estado
    if (statusFilter !== 'all') {
      filtered = filtered.filter((req) => req.status === statusFilter);
    }

    // Filtrar por búsqueda
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (req) =>
          req.nombreEmpresa.toLowerCase().includes(query) ||
          req.rfc.toLowerCase().includes(query) ||
          req.correoEmpresa.toLowerCase().includes(query) ||
          req.nombre.toLowerCase().includes(query)
      );
    }

    setFilteredRequests(filtered);
  };

  const handleViewDetails = (id: number) => {
    const request = requests.find((req) => req.id === id);
    if (request) {
      setSelectedRequest(request);
    }
  };

  const handleApprove = (id: number) => {
    // Antes: if (!confirm('¿Estás seguro que deseas aprobar esta solicitud?')) return;
    // Ahora la confirmación es un Modal y, al aceptar, aprobarSolicitud(id)
    // hace la MISMA llamada.
    setIdPorAprobar(id);
  };

  const aprobarSolicitud = async (id: number) => {
    try {
      const response = await fetch(`/api/company-requests/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: 'approved' })
      });

      if (response.ok) {
        await fetchRequests();
        setSelectedRequest(null);
        setNotification({ type: 'success', message: 'Solicitud aprobada exitosamente' });
      } else {
        const data = await response.json();
        setNotification({ type: 'error', message: data.error || 'Error al aprobar solicitud' });
      }
    } catch (error) {
      console.error('Error approving request:', error);
      setNotification({ type: 'error', message: 'Error al aprobar solicitud' });
    }
  };

  /** El admin aceptó el Modal: el PATCH de siempre, con el botón en «Aprobando…». */
  const confirmarAprobacion = async () => {
    if (idPorAprobar === null) return;
    setAprobando(true);
    try {
      await aprobarSolicitud(idPorAprobar);
    } finally {
      setAprobando(false);
      setIdPorAprobar(null);
    }
  };

  const handleRejectClick = (id: number) => {
    const request = requests.find((req) => req.id === id);
    if (request) {
      setRequestToReject(request);
      setRejectModalOpen(true);
      setSelectedRequest(null); // Cerrar modal de detalles si está abierto
    }
  };

  const handleRejectConfirm = async (id: number, reason?: string) => {
    try {
      const response = await fetch(`/api/company-requests/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: 'rejected',
          rejectionReason: reason || null
        })
      });

      if (response.ok) {
        await fetchRequests();
        setRejectModalOpen(false);
        setRequestToReject(null);
        setNotification({ type: 'success', message: 'Solicitud rechazada' });
      } else {
        const data = await response.json();
        setNotification({ type: 'error', message: data.error || 'Error al rechazar solicitud' });
      }
    } catch (error) {
      console.error('Error rejecting request:', error);
      setNotification({ type: 'error', message: 'Error al rechazar solicitud' });
    }
  };

  // Estadísticas
  const stats = {
    total: requests.length,
    pending: requests.filter((r) => r.status === 'pending').length,
    approved: requests.filter((r) => r.status === 'approved').length,
    rejected: requests.filter((r) => r.status === 'rejected').length
  };

  // ---------------------------------------------------------------------------
  // Columnas de la tabla
  // ---------------------------------------------------------------------------
  const columnas: Columna<CompanyRequest>[] = [
    {
      id: 'empresa',
      encabezado: 'Empresa',
      enTarjeta: 'titulo',
      className: 'min-w-[12rem]',
      celda: (req) => (
        <div className="min-w-0">
          <p className="font-semibold leading-snug text-ink">{req.nombreEmpresa}</p>
          <p className="text-[13px] leading-snug text-ink-muted">
            {req.razonSocial}
            <span aria-hidden="true"> · </span>
            <span className="sr-only">, RFC </span>
            <span className="font-mono tracking-wide">{req.rfc}</span>
          </p>
        </div>
      )
    },
    {
      id: 'contacto',
      encabezado: 'Contacto',
      ocultarBajo: 'md',
      className: 'min-w-[11rem]',
      celda: (req) => (
        <div className="min-w-0">
          <p className="leading-snug text-ink">{nombreRepresentante(req)}</p>
          <p className="break-all text-[13px] leading-snug text-ink-muted">{req.correoEmpresa}</p>
        </div>
      )
    },
    {
      id: 'recibida',
      encabezado: 'Recibida',
      ocultarBajo: 'xl',
      celda: (req) => (
        <span className="whitespace-nowrap tabular-nums text-ink-muted">{fechaCorta(req.createdAt)}</span>
      )
    },
    {
      id: 'estado',
      encabezado: 'Estado',
      className: 'whitespace-nowrap',
      celda: (req) => <StatusBadge estado={req.status} contexto="solicitud" />
    },
    {
      id: 'acciones',
      encabezado: 'Acciones',
      encabezadoOculto: true,
      alinear: 'fin',
      // En tarjeta, las acciones van en su propia fila, al final y a lo ancho.
      // Arriba a la derecha ('acciones') la celda mide 1 px (w-px) y el ojo, la
      // X y «Aprobar» se desbordaban hacia la izquierda, encima del nombre y la
      // razón social. Con justify-start arrancan en el borde de la celda y
      // crecen hacia la derecha; en la tabla da igual (la columna mide lo que
      // sus acciones), y el ojo queda en la misma vertical en todas las filas.
      enTarjeta: 'completa',
      className: 'w-px whitespace-nowrap',
      celda: (req) => (
        <div className="flex items-center justify-start gap-1">
          <IconButton
            etiqueta={`Ver solicitud de ${req.nombreEmpresa}`}
            title={req.status === 'pending' ? 'Ver y editar' : 'Ver'}
            icono={Eye}
            tamano="sm"
            onClick={() => handleViewDetails(req.id)}
          />
          {req.status === 'pending' && (
            <>
              <IconButton
                etiqueta={`Rechazar solicitud de ${req.nombreEmpresa}`}
                title="Rechazar"
                icono={XCircle}
                variante="peligro"
                tamano="sm"
                onClick={() => handleRejectClick(req.id)}
              />
              <Button
                variante="secundario"
                tamano="sm"
                icono={Check}
                onClick={() => handleApprove(req.id)}
                aria-label={`Aprobar solicitud de ${req.nombreEmpresa}`}
              >
                Aprobar
              </Button>
            </>
          )}
        </div>
      )
    }
  ];

  if (isLoading && cargaInicial) {
    return <SkeletonPagina conCifras={false} />;
  }

  const filtrosActivos = (searchQuery.trim() ? 1 : 0) + (statusFilter !== 'all' ? 1 : 0);
  const limpiarFiltros = () => {
    setSearchQuery('');
    setStatusFilter('all');
  };

  // Página actual acotada: tras aprobar o rechazar la lista puede encoger.
  const totalPaginas = Math.max(1, Math.ceil(filteredRequests.length / SOLICITUDES_POR_PAGINA));
  const paginacion = paginacionLocal(filteredRequests.length, Math.min(pagina, totalPaginas), SOLICITUDES_POR_PAGINA);
  const filasPagina = filteredRequests.slice(
    (paginacion.page - 1) * SOLICITUDES_POR_PAGINA,
    paginacion.page * SOLICITUDES_POR_PAGINA
  );

  const solicitudPorAprobar = idPorAprobar !== null ? requests.find((r) => r.id === idPorAprobar) ?? null : null;

  // Vacío: la pestaña de pendientes sin búsqueda tiene su propio mensaje.
  const vacioPendientes = statusFilter === 'pending' && !searchQuery.trim();

  return (
    <>
      <PageHeader
        antetitulo="Empresas y comercial"
        titulo="Solicitudes"
        remate="de empresas"
        descripcion={
          stats.pending > 0
            ? `${stats.pending} ${stats.pending === 1 ? 'solicitud espera' : 'solicitudes esperan'} tu revisión.`
            : 'Registros de empresas que piden entrar a INAKAT.'
        }
        acciones={
          <Button variante="contorno" icono={RefreshCw} onClick={fetchRequests} cargando={isLoading}>
            Actualizar
          </Button>
        }
      />

      {error && <AvisoError mensaje={error} alReintentar={fetchRequests} />}

      {/* Sin datos por un error, no hay lista que enseñar: el aviso de arriba
          lo explica (un error no es una bandeja vacía). */}
      {!(error && requests.length === 0) && (
        <Card sinRelleno>
          <Tabs
            idBase="solicitudes"
            etiqueta="Solicitudes por estado"
            activa={statusFilter}
            alCambiar={setStatusFilter}
            className="px-3 sm:px-4"
            pestanas={[
              { id: 'all', etiqueta: 'Todas', contador: stats.total },
              { id: 'pending', etiqueta: 'Pendientes', contador: stats.pending },
              { id: 'approved', etiqueta: 'Aprobadas', contador: stats.approved },
              { id: 'rejected', etiqueta: 'Rechazadas', contador: stats.rejected }
            ]}
          />
          <PanelPestana
            idBase="solicitudes"
            id={statusFilter}
            activa={statusFilter}
            className="pt-0 focus-visible:outline-offset-[-2px]"
          >
            <div className="border-b border-line px-5 py-4">
              <FilterToolbar
                busqueda={{
                  valor: searchQuery,
                  alCambiar: setSearchQuery,
                  etiqueta: 'Buscar solicitudes',
                  placeholder: 'Empresa, RFC, correo o nombre'
                }}
                activos={filtrosActivos}
                alLimpiar={limpiarFiltros}
                resumen={`${filteredRequests.length} de ${requests.length} solicitudes`}
              />
            </div>

            <DataTable
              etiqueta="Solicitudes de alta de empresas"
              columnas={columnas}
              filas={filasPagina}
              claveFila={(req) => req.id}
              cargando={isLoading}
              alActivarFila={(req) => handleViewDetails(req.id)}
              paginacion={paginacion}
              alCambiarPagina={setPagina}
              etiquetaTotal="solicitudes"
              vacio={
                vacioPendientes ? (
                  <EmptyState
                    frase="Todo al día."
                    titulo="No hay solicitudes pendientes"
                    descripcion="Cuando una empresa se registre, su solicitud aparecerá aquí para que la revises."
                  />
                ) : (
                  <EmptyState
                    frase="Nada por aquí, todavía."
                    titulo={
                      searchQuery || statusFilter !== 'all'
                        ? 'No se encontraron solicitudes que coincidan con los filtros'
                        : 'No hay solicitudes registradas'
                    }
                    accion={
                      filtrosActivos > 0 ? (
                        <Button variante="contorno" tamano="sm" onClick={limpiarFiltros}>
                          Limpiar filtros
                        </Button>
                      ) : undefined
                    }
                  />
                )
              }
            />
          </PanelPestana>
        </Card>
      )}

      {/* MODAL DE DETALLES */}
      {selectedRequest && (
        <DetalleSolicitud
          key={selectedRequest.id}
          request={selectedRequest}
          onClose={() => setSelectedRequest(null)}
          onApprove={handleApprove}
          onReject={handleRejectClick}
          // ADM-023: tras editar en el modal, la tabla seguía con los datos
          // viejos (RFC, correo…) y el admin creía que no se había guardado.
          onUpdate={fetchRequests}
        />
      )}

      {/* MODAL DE RECHAZO */}
      {rejectModalOpen && requestToReject && (
        <RechazarSolicitud
          requestId={requestToReject.id}
          companyName={requestToReject.nombreEmpresa}
          onConfirm={handleRejectConfirm}
          onCancel={() => {
            setRejectModalOpen(false);
            setRequestToReject(null);
          }}
        />
      )}

      {/* CONFIRMACIÓN DE APROBAR (antes, confirm() del navegador). Se abre
          también encima del detalle: va después en el documento y queda arriba. */}
      <Modal
        abierto={idPorAprobar !== null}
        alCerrar={() => {
          if (!aprobando) setIdPorAprobar(null);
        }}
        tamano="sm"
        iconoTitulo={<CheckCircle2 size={20} className="text-lime-dark" aria-hidden="true" />}
        titulo="Aprobar solicitud"
        descripcion="La empresa podrá publicar vacantes; se le avisa por correo y con una notificación."
        pie={
          <>
            <Button variante="contorno" onClick={() => setIdPorAprobar(null)} disabled={aprobando}>
              Cancelar
            </Button>
            <Button icono={Check} onClick={confirmarAprobacion} cargando={aprobando} textoCargando="Aprobando…">
              Aprobar solicitud
            </Button>
          </>
        }
      >
        {solicitudPorAprobar && (
          <div className="rounded-xl border border-line bg-paper px-4 py-3">
            <p className="font-semibold text-ink">{solicitudPorAprobar.nombreEmpresa}</p>
            <p className="text-[13px] text-ink-muted">
              {solicitudPorAprobar.razonSocial} · <span className="font-mono">{solicitudPorAprobar.rfc}</span>
            </p>
            <p className="break-all text-[13px] text-ink-muted">{solicitudPorAprobar.correoEmpresa}</p>
          </div>
        )}
      </Modal>

      {/* Resultado de aprobar / rechazar */}
      <Toast
        tono={notification.type === 'error' ? 'error' : 'exito'}
        mensaje={notification.type ? notification.message : null}
        alCerrar={() => setNotification({ type: null, message: '' })}
        duracion={notification.type === 'error' ? 0 : 6000}
      />
    </>
  );
}
