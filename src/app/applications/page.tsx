// RUTA: src/app/applications/page.tsx

'use client';

/**
 * Aplicaciones de todas las vacantes (sólo admin: el middleware bloquea
 * /applications y /api/applications a cualquier otro rol). Registro de
 * aplicación (docs/DISENO.md): PageHeader con migas → tarjeta con pestañas de
 * estado (cada una con su conteo) y DataTable → detalle en Modal.
 *
 * Las seis tarjetas de cifras que había encima repetían, una por una, las seis
 * pestañas, y en móvil empujaban la lista unos 430 px hacia abajo: el conteo
 * vive ahora en cada pestaña, al lado del filtro que cuenta.
 *
 * La lógica es la de ApplicationsManagementPanel, sin cambios: GET
 * /api/applications, los mismos filtros y cifras calculados aquí, y PATCH
 * /api/applications/:id con { status, notes } que recarga la lista y cierra el
 * detalle. `cvUrl` llega de un POST público: sólo se enlaza si es http(s)
 * (VAC-014, ver ensureUrl). La tabla pagina en el cliente (20 por página).
 */

import React, { useState, useEffect } from 'react';
import {
  Calendar,
  CheckCircle2,
  Eye,
  FileText,
  Mail,
  Phone,
  RefreshCw,
  XCircle,
  Clock,
  CalendarCheck
} from 'lucide-react';
import { isSafeHttpUrl } from '@/lib/sanitize';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import Tabs from '@/components/ui/Tabs';
import DataTable, { type Columna } from '@/components/ui/DataTable';
import StatusBadge, { etiquetaEstado } from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { paginacionLocal } from '@/components/ui/Pagination';
import { fechaCorta, fechaLarga } from '@/lib/fechas';

/** Filas por página de la tabla. */
const APLICACIONES_POR_PAGINA = 20;

/**
 * `cvUrl` llega de POST /api/applications, que es público: no puede ir crudo a
 * un href. El helper anterior sólo miraba si empezaba por 'http', así que
 * 'httpx:…' o cualquier esquema raro pasaba tal cual. Sólo se deja pasar
 * http(s) absoluto; lo que parece un dominio suelto se fuerza a https y lo que
 * no es URL se anula (el enlace no se pinta). Mismo criterio que
 * /admin/direct-applications y /admin/assign-candidates.
 */
const ensureUrl = (url: string): string | undefined => {
  const candidata = /^[a-z][a-z0-9+.-]*:/i.test(url) ? url : `https://${url}`;
  return isSafeHttpUrl(candidata) ? candidata : undefined;
};

interface Application {
  id: number;
  jobId: number;
  candidateName: string;
  candidateEmail: string;
  candidatePhone: string | null;
  cvUrl: string | null;
  coverLetter: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
  job: {
    id: number;
    title: string;
    company: string;
    location: string;
    salary: string;
  };
}

/** Filtros de estado (los mismos seis de antes). */
const FILTROS = [
  { id: 'all', etiqueta: 'Todas' },
  { id: 'pending', etiqueta: 'Pendientes' },
  { id: 'reviewing', etiqueta: 'En revisión' },
  { id: 'interviewed', etiqueta: 'Entrevistados' },
  { id: 'accepted', etiqueta: 'Aceptados' },
  { id: 'rejected', etiqueta: 'Rechazados' }
];

/** Estados a los que el admin puede mover una aplicación (los de siempre). */
const CAMBIOS_DE_ESTADO = [
  { estado: 'pending', etiqueta: 'Pendiente', icono: Clock },
  { estado: 'reviewing', etiqueta: 'En revisión', icono: Eye },
  { estado: 'interviewed', etiqueta: 'Entrevistado', icono: CalendarCheck },
  { estado: 'accepted', etiqueta: 'Aceptar', icono: CheckCircle2 },
  { estado: 'discarded', etiqueta: 'Descartar', icono: XCircle }
];

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [filteredApplications, setFilteredApplications] = useState<
    Application[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedApplication, setSelectedApplication] =
    useState<Application | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  // Página de la tabla (presentación: la lista ya viene entera).
  const [pagina, setPagina] = useState(1);

  // Estadísticas
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    reviewing: 0,
    interviewed: 0,
    accepted: 0,
    rejected: 0
  });

  useEffect(() => {
    fetchApplications();
  }, []);

  useEffect(() => {
    filterApplications();
    calculateStats();
  }, [applications, selectedStatus]);

  const fetchApplications = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/applications');
      const data = await response.json();

      if (data.success) {
        setApplications(data.data);
      }
    } catch (error) {
      console.error('Error fetching applications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filterApplications = () => {
    if (selectedStatus === 'all') {
      setFilteredApplications(applications);
    } else {
      setFilteredApplications(
        applications.filter((app) => app.status === selectedStatus)
      );
    }
  };

  const calculateStats = () => {
    const newStats = {
      total: applications.length,
      pending: applications.filter((a) => a.status === 'pending').length,
      reviewing: applications.filter((a) => a.status === 'reviewing').length,
      interviewed: applications.filter((a) => a.status === 'interviewed')
        .length,
      accepted: applications.filter((a) => a.status === 'accepted').length,
      rejected: applications.filter((a) => a.status === 'rejected' || a.status === 'discarded').length
    };
    setStats(newStats);
  };

  const updateApplicationStatus = async (
    applicationId: number,
    newStatus: string,
    notes?: string
  ) => {
    try {
      const response = await fetch(`/api/applications/${applicationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, notes })
      });

      const data = await response.json();

      if (data.success) {
        // Actualizar la lista
        fetchApplications();
        setIsDetailModalOpen(false);
      }
    } catch (error) {
      console.error('Error updating application:', error);
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: { [key: string]: string } = {
      pending: 'Pendiente',
      reviewing: 'En revisión',
      interviewed: 'Entrevistado',
      accepted: 'Aceptado',
      rejected: 'Rechazado',
      discarded: 'Descartado'
    };
    // Un estado sin etiqueta propia (p. ej. sent_to_specialist) se leía crudo:
    // ahora sale con la etiqueta del mapa de estados de la app.
    return labels[status] || etiquetaEstado(status, 'postulacion');
  };

  // Fecha corta, la del resto del panel (src/lib/fechas): «23 sep 2026».
  // Una fecha inválida sale «—», no «Invalid Date».
  const formatDate = (dateString: string) => fechaCorta(dateString);

  const abrirDetalle = (app: Application) => {
    setSelectedApplication(app);
    setIsDetailModalOpen(true);
  };

  // ---------------------------------------------------------------------------
  // Columnas de la tabla
  // ---------------------------------------------------------------------------
  const columnas: Columna<Application>[] = [
    {
      id: 'candidato',
      encabezado: 'Candidato',
      enTarjeta: 'titulo',
      className: 'min-w-[14rem]',
      celda: (app) => (
        <div className="min-w-0">
          <p className="font-semibold text-ink">{app.candidateName}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-ink-muted">
            <Mail size={13} className="flex-none" aria-hidden="true" />
            <span className="truncate">{app.candidateEmail}</span>
          </p>
          {app.candidatePhone && (
            <p className="flex items-center gap-1.5 text-[13px] tabular-nums text-ink-muted">
              <Phone size={13} className="flex-none" aria-hidden="true" />
              {app.candidatePhone}
            </p>
          )}
        </div>
      )
    },
    {
      id: 'vacante',
      encabezado: 'Vacante',
      celda: (app) => (
        <div className="min-w-0">
          <p className="font-medium text-ink">{app.job.title}</p>
          <p className="text-[13px] text-ink-muted">{app.job.company}</p>
        </div>
      )
    },
    {
      id: 'fecha',
      encabezado: 'Fecha',
      ocultarBajo: 'md',
      celda: (app) => (
        <span className="whitespace-nowrap tabular-nums text-ink-muted" title={fechaLarga(app.createdAt)}>
          {formatDate(app.createdAt)}
        </span>
      )
    },
    {
      id: 'estado',
      encabezado: 'Estado',
      celda: (app) => <StatusBadge estado={app.status} etiqueta={getStatusLabel(app.status)} />
    },
    {
      id: 'acciones',
      encabezado: 'Acciones',
      encabezadoOculto: true,
      alinear: 'fin',
      enTarjeta: 'acciones',
      className: 'w-px whitespace-nowrap',
      celda: (app) => (
        <Button
          variante="contorno"
          tamano="sm"
          icono={Eye}
          onClick={() => abrirDetalle(app)}
          aria-label={`Ver detalles de ${app.candidateName}`}
        >
          Ver detalles
        </Button>
      )
    }
  ];

  const totalPaginas = Math.max(1, Math.ceil(filteredApplications.length / APLICACIONES_POR_PAGINA));
  const paginaActual = Math.min(pagina, totalPaginas);
  const cvSeguro = selectedApplication?.cvUrl ? ensureUrl(selectedApplication.cvUrl) : undefined;

  /**
   * Conteo de cada pestaña (antes, seis tarjetas de cifras). Sale de las mismas
   * cifras de siempre, salvo «Rechazados»: stats.rejected suma también
   * `discarded`, pero la pestaña sólo enseña `rejected` (filterApplications), y
   * el número al lado de un filtro tiene que ser el de las filas que enseña.
   * Mientras carga, sin número (no un 0 falso).
   */
  const conteoPestana: Record<string, number> = {
    all: stats.total,
    pending: stats.pending,
    reviewing: stats.reviewing,
    interviewed: stats.interviewed,
    accepted: stats.accepted,
    rejected: applications.filter((a) => a.status === 'rejected').length
  };
  const pestanas = FILTROS.map((f) => ({ ...f, contador: isLoading ? undefined : conteoPestana[f.id] }));

  return (
    <>
      <PageHeader
        migas={[{ etiqueta: 'Vista general', href: '/admin' }, { etiqueta: 'Aplicaciones' }]}
        antetitulo="Reclutamiento"
        titulo="Aplicaciones"
        remate="de todas las vacantes"
        descripcion="Revisa cada postulación y cambia su estado."
        acciones={
          <Button variante="contorno" icono={RefreshCw} onClick={fetchApplications}>
            Actualizar
          </Button>
        }
      />

      <Card sinRelleno>
        {/* Filtros de estado: las mismas seis opciones de antes, con su conteo. */}
        <Tabs
          idBase="aplicaciones"
          etiqueta="Filtrar por estado"
          pestanas={pestanas}
          activa={selectedStatus}
          alCambiar={(id) => {
            setSelectedStatus(id);
            setPagina(1);
          }}
          className="px-2 sm:px-3"
        />

        <div role="tabpanel" id={`aplicaciones-panel-${selectedStatus}`} aria-labelledby={`aplicaciones-tab-${selectedStatus}`}>
          <DataTable
            etiqueta="Aplicaciones"
            columnas={columnas}
            filas={filteredApplications.slice(
              (paginaActual - 1) * APLICACIONES_POR_PAGINA,
              paginaActual * APLICACIONES_POR_PAGINA
            )}
            claveFila={(app) => app.id}
            cargando={isLoading}
            alActivarFila={abrirDetalle}
            paginacion={paginacionLocal(filteredApplications.length, paginaActual, APLICACIONES_POR_PAGINA)}
            alCambiarPagina={setPagina}
            etiquetaTotal="aplicaciones"
            vacio={
              applications.length === 0 ? (
                <EmptyState
                  frase="Todavía nada por aquí."
                  titulo="No hay aplicaciones todavía"
                  descripcion="Las aplicaciones de candidatos aparecerán aquí"
                />
              ) : (
                <EmptyState
                  compacto
                  icono={FileText}
                  titulo="No hay aplicaciones en esta categoría"
                  accion={
                    <Button
                      variante="contorno"
                      tamano="sm"
                      onClick={() => {
                        setSelectedStatus('all');
                        setPagina(1);
                      }}
                    >
                      Ver todas
                    </Button>
                  }
                />
              )
            }
          />
        </div>
      </Card>

      {/* Detalle de la aplicación */}
      <Modal
        abierto={isDetailModalOpen && selectedApplication !== null}
        alCerrar={() => setIsDetailModalOpen(false)}
        tamano="lg"
        titulo="Detalles de la aplicación"
        subtitulo={
          selectedApplication && (
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-ink">{selectedApplication.candidateName}</span>
              <StatusBadge
                estado={selectedApplication.status}
                etiqueta={getStatusLabel(selectedApplication.status)}
                tamano="sm"
              />
            </span>
          )
        }
        pie={
          <Button variante="contorno" onClick={() => setIsDetailModalOpen(false)}>
            Cerrar
          </Button>
        }
      >
        {selectedApplication && (
          <div className="space-y-6">
            {/* Información del candidato */}
            <section className="[overflow:visible]">
              <h3 className="mb-3 font-display text-sm font-semibold text-ink">Información del candidato</h3>
              <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-ink-muted">Nombre</dt>
                  <dd className="text-sm font-medium text-ink">{selectedApplication.candidateName}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-xs text-ink-muted">Email</dt>
                  <dd className="break-words text-sm font-medium text-ink">{selectedApplication.candidateEmail}</dd>
                </div>
                {selectedApplication.candidatePhone && (
                  <div>
                    <dt className="text-xs text-ink-muted">Teléfono</dt>
                    <dd className="text-sm font-medium tabular-nums text-ink">{selectedApplication.candidatePhone}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-xs text-ink-muted">Fecha</dt>
                  <dd className="flex items-center gap-1.5 text-sm font-medium text-ink">
                    <Calendar size={14} className="text-ink-muted" aria-hidden="true" />
                    {formatDate(selectedApplication.createdAt)}
                  </dd>
                </div>
              </dl>
            </section>

            {/* Información de la vacante */}
            <section className="[overflow:visible]">
              <h3 className="mb-2 font-display text-sm font-semibold text-ink">Vacante</h3>
              <div className="rounded-xl border border-line bg-paper/60 px-4 py-3">
                <p className="font-display font-semibold text-ink">{selectedApplication.job.title}</p>
                <p className="text-sm text-ink-muted">{selectedApplication.job.company}</p>
                <p className="text-sm text-ink-muted">{selectedApplication.job.location}</p>
                <p className="text-sm text-ink-muted">{selectedApplication.job.salary}</p>
              </div>
            </section>

            {/* CV */}
            {selectedApplication.cvUrl && cvSeguro && (
              <section className="[overflow:visible]">
                <h3 className="mb-2 font-display text-sm font-semibold text-ink">Curriculum Vitae</h3>
                <a
                  href={cvSeguro}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded text-sm font-semibold text-teal hover:text-teal-dark hover:underline"
                >
                  <FileText size={16} aria-hidden="true" />
                  Descargar CV
                  <span className="sr-only"> (se abre en otra pestaña)</span>
                </a>
              </section>
            )}

            {/* Carta de presentación */}
            {selectedApplication.coverLetter && (
              <section className="[overflow:visible]">
                <h3 className="mb-2 font-display text-sm font-semibold text-ink">Carta de presentación</h3>
                <p className="whitespace-pre-line rounded-xl bg-paper px-4 py-3 text-sm leading-relaxed text-ink">
                  {selectedApplication.coverLetter}
                </p>
              </section>
            )}

            {/* Cambiar estado */}
            <section className="[overflow:visible]">
              <h3 id="titulo-cambiar-estado" className="mb-1 font-display text-sm font-semibold text-ink">
                Actualizar estado
              </h3>
              <p className="mb-3 text-[13px] text-ink-muted">El cambio se guarda al pulsar y cierra este detalle.</p>
              <div role="group" aria-labelledby="titulo-cambiar-estado" className="flex flex-wrap gap-2">
                {CAMBIOS_DE_ESTADO.map(({ estado, etiqueta, icono }) => {
                  const actual = selectedApplication.status === estado;
                  return (
                    <Button
                      key={estado}
                      variante={actual ? 'secundario' : estado === 'discarded' ? 'peligro' : 'contorno'}
                      tamano="sm"
                      icono={icono}
                      aria-pressed={actual}
                      onClick={() => updateApplicationStatus(selectedApplication.id, estado)}
                    >
                      {etiqueta}
                    </Button>
                  );
                })}
              </div>
            </section>
          </div>
        )}
      </Modal>
    </>
  );
}
