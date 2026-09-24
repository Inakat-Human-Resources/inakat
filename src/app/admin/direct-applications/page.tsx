// RUTA: src/app/admin/direct-applications/page.tsx

'use client';

/**
 * Candidatos interesados: postulaciones que llegaron directamente desde la
 * bolsa de trabajo (/talents) y siguen pendientes. El admin decide con cada
 * una: meterla al proceso, descartarla o archivarla (PUT
 * /api/admin/direct-applications).
 *
 * Registro de APLICACIÓN (docs/DISENO.md) con forma de BANDEJA: cada
 * postulación es una ficha legible (quién, a qué vacante, con qué carta) y sus
 * tres decisiones a mano (en el móvil, «Meter al proceso» a la vista y
 * Descartar/Archivar en el «…» de la ficha). Es de las pocas listas que no son
 * tabla: la carta de presentación no cabe en una celda y es lo que se lee para
 * decidir.
 *
 * La lógica —la URL del CV que sólo se enlaza si es http(s) (ADM-017), la
 * vacante sin dueño (ADM-018), la postulación que otra persona ya movió (409,
 * ADM-039)— es la de siempre; sólo cambió la presentación.
 *
 * Paginación: la API devuelve de 200 en 200 con `pagination.total`. La
 * primera página se pide igual que siempre (sin parámetros); el contador dice
 * el total del servidor y, si hay más de una página, se ofrecen las demás
 * (?page=N).
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  AlertCircle,
  AlertTriangle,
  Archive,
  ArrowRight,
  Briefcase,
  Calendar,
  CheckCircle,
  ExternalLink,
  FileText,
  Mail,
  Phone,
  UserCheck,
  XCircle
} from 'lucide-react';
import { isSafeHttpUrl } from '@/lib/sanitize';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import Button, { clasesBoton } from '@/components/ui/Button';
import Avatar from '@/components/ui/Avatar';
import MenuAcciones from '@/components/ui/MenuAcciones';
import Toast from '@/components/ui/Toast';
import Pagination, { type PaginacionApi } from '@/components/ui/Pagination';
import { SkeletonPagina } from '@/components/ui/Skeleton';
import { cn } from '@/lib/utils';
import { fechaHora } from '@/lib/fechas';

/**
 * `cvUrl` llega de POST /api/applications, que es público y no valida el
 * esquema, así que no puede ir crudo a un href: `javascript:` o `data:` se
 * convierten en un enlace ejecutable al pulsar "Ver CV". Sólo se deja pasar
 * http(s) absoluto; lo que parece un dominio suelto se fuerza a https y lo que
 * no es URL se anula.
 */
const ensureUrl = (url: string): string | undefined => {
  const candidata = /^[a-z][a-z0-9+.-]*:/i.test(url) ? url : `https://${url}`;
  return isSafeHttpUrl(candidata) ? candidata : undefined;
};

interface Application {
  id: number;
  candidateName: string;
  candidateEmail: string;
  candidatePhone: string | null;
  cvUrl: string | null;
  coverLetter: string | null;
  status: string;
  createdAt: string;
  job: {
    id: number;
    title: string;
    company: string;
    location: string;
    status: string;
    assignment: {
      id: number;
      recruiter: { id: number; nombre: string; apellidoPaterno: string } | null;
    } | null;
    // Job.userId es opcional (onDelete: SetNull) y hay vacantes heredadas sin
    // dueño: la API devuelve `user: null` y hay que tipárselo así.
    user: {
      nombre: string;
      email: string;
      companyRequest: {
        nombreEmpresa: string;
      } | null;
    } | null;
  };
}

/**
 * ADM-018: se leía `app.job.user.companyRequest` sin comprobar `user`. Bastaba
 * UNA postulación pendiente sobre una vacante sin dueño para que el render
 * lanzara y la página entera cayera, sin poder procesar ninguna otra.
 */
const nombreEmpresa =(app: Pick<Application, 'job'>): string =>
  app.job.user?.companyRequest?.nombreEmpresa || app.job.company;

export default function DirectApplicationsPage() {
  const router = useRouter();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });
  // Paginación del servidor (buildPaginatedResponse): página pedida y bloque `pagination`.
  const [pagina, setPagina] = useState(1);
  const [paginacion, setPaginacion] = useState<PaginacionApi | null>(null);

  useEffect(() => {
    fetchApplications();
  }, []);

  const fetchApplications = async (paginaPedida: number = pagina) => {
    try {
      setLoading(true);
      // La primera página, con la llamada de siempre; las demás, con ?page=N.
      const response = await fetch(
        paginaPedida > 1 ? `/api/admin/direct-applications?page=${paginaPedida}` : '/api/admin/direct-applications'
      );

      if (response.status === 401) {
        router.push('/login?redirect=/admin/direct-applications');
        return;
      }

      if (response.status === 403) {
        setError('No tienes permisos para acceder a esta página');
        return;
      }

      const result = await response.json();

      if (result.success) {
        setApplications(result.data);
        setPaginacion(result.pagination ?? null);
      } else {
        setError(result.error || 'Error al cargar aplicaciones');
      }
    } catch (err) {
      console.error('Error:', err);
      setError('Error al cargar aplicaciones');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (
    applicationId: number,
    newStatus: string
  ) => {
    const confirmMessages: Record<string, string> = {
      reviewing: '¿Meter esta aplicación al proceso de revisión?',
      discarded: '¿Descartar esta aplicación?',
      archived: '¿Archivar esta aplicación?'
    };

    if (!confirm(confirmMessages[newStatus])) {
      return;
    }

    setProcessingId(applicationId);

    try {
      const response = await fetch('/api/admin/direct-applications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId, newStatus })
      });

      const result = await response.json();

      if (result.success) {
        // Remover la aplicación de la lista (y del total del servidor)
        setApplications((prev) => prev.filter((app) => app.id !== applicationId));
        setPaginacion((prev) => (prev ? { ...prev, total: Math.max(0, prev.total - 1) } : prev));
        // Mostrar warning si la vacante no tiene reclutador asignado
        setNotification({
          type: result.needsAssignment ? 'error' : 'success',
          message: result.message
        });
      } else if (response.status === 409) {
        // ADM-039: otra persona (el reclutador desde su dashboard) ya movió esta
        // postulación; la API no la pisa. La fila está desactualizada: se quita
        // y se recarga la bandeja para no seguir ofreciendo acciones sobre ella.
        setApplications((prev) => prev.filter((app) => app.id !== applicationId));
        setNotification({ type: 'error', message: result.error || 'Esta postulación ya fue procesada por otra persona.' });
        fetchApplications();
      } else {
        setNotification({ type: 'error', message: result.error || 'Error al actualizar' });
      }
    } catch (err) {
      console.error('Error:', err);
      setNotification({ type: 'error', message: 'Error al procesar la solicitud' });
    } finally {
      setProcessingId(null);
    }
  };

  // Fecha con hora del panel (src/lib/fechas): «23 sep 2026, 18:22».
  const formatDate = (dateString: string) => fechaHora(dateString);

  // ---------------------------------------------------------------------------
  // Presentación
  // ---------------------------------------------------------------------------
  const cabecera = (
    <PageHeader
      antetitulo="Reclutamiento"
      titulo="Candidatos interesados"
      remate="por revisar"
      descripcion="Personas que se postularon directamente desde la bolsa de trabajo y esperan a que alguien las revise."
    />
  );

  // Esqueleto sólo en la primera carga: al recargar tras un 409 la bandeja
  // sigue a la vista (y el aviso con ella).
  if (loading && applications.length === 0) {
    return <SkeletonPagina conCifras={false} />;
  }

  if (error) {
    return (
      <>
        {cabecera}
        <div role="alert" className="rounded-xl border border-danger/30 bg-danger-tint px-5 py-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-none text-danger" aria-hidden="true" />
            <div className="min-w-0">
              <h2 className="font-display text-base font-semibold text-danger-dark">No se pudo abrir la bandeja</h2>
              <p className="mt-1 text-sm text-danger-dark">{error}</p>
              <Button variante="contorno" tamano="sm" className="mt-4" onClick={() => router.push('/admin')}>
                Volver al panel
              </Button>
            </div>
          </div>
        </div>
      </>
    );
  }

  // El total del servidor (todas las pendientes); sin él, las que hay a la vista.
  const total = Math.max(paginacion?.total ?? 0, applications.length);
  const irAPagina = (nueva: number) => {
    setPagina(nueva);
    fetchApplications(nueva);
  };

  return (
    <>
      {cabecera}

      {/* Resultado de cada decisión: aviso flotante arriba. Un error (o una
          vacante sin reclutador) se queda hasta cerrarlo; un acierto se va solo. */}
      <Toast
        tono={notification.type === 'success' ? 'exito' : 'error'}
        mensaje={notification.type ? notification.message : null}
        alCerrar={() => setNotification({ type: null, message: '' })}
        duracion={notification.type === 'success' ? 6000 : 0}
      />

      <Card
        titulo={
          <span className="inline-flex items-center gap-2">
            Pendientes de revisar
            <span className="rounded-full bg-orange-tint px-2 py-0.5 font-display text-xs font-semibold tabular-nums text-orange-dark">
              {total}
            </span>
          </span>
        }
        descripcion={
          total === 0
            ? 'Nada en la bandeja.'
            : `${total} ${total === 1 ? 'aplicación pendiente' : 'aplicaciones pendientes'} de revisar. Mete al proceso, descarta o archiva cada una.`
        }
        sinRelleno
      >
        {applications.length === 0 ? (
          <EmptyState
            frase="Bandeja limpia."
            titulo="No hay aplicaciones pendientes"
            descripcion="Todas las aplicaciones directas han sido procesadas."
          />
        ) : (
          <ul className="divide-y divide-line">
            {applications.map((app) => {
              const cv = app.cvUrl ? ensureUrl(app.cvUrl) : undefined;
              const ocupada = processingId === app.id;
              const idTitulo = `postulacion-${app.id}`;
              return (
                <li key={app.id}>
                  <article
                    aria-labelledby={idTitulo}
                    aria-busy={ocupada || undefined}
                    className={cn('px-5 py-5 transition-opacity duration-150', ocupada && 'opacity-60')}
                  >
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
                      {/* Quién, a qué y con qué carta */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-3">
                          <Avatar nombre={app.candidateName} email={app.candidateEmail} />
                          <div className="min-w-0 flex-1">
                            <h3 id={idTitulo} className="font-display text-base font-semibold leading-snug text-ink">
                              {app.candidateName}
                            </h3>
                            <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-ink-muted">
                              <a
                                href={`mailto:${app.candidateEmail}`}
                                className="inline-flex min-w-0 items-center gap-1 rounded text-teal hover:text-teal-dark hover:underline"
                              >
                                <Mail size={14} className="flex-none" aria-hidden="true" />
                                <span className="truncate">{app.candidateEmail}</span>
                              </a>
                              {app.candidatePhone && (
                                <a
                                  href={`tel:${app.candidatePhone}`}
                                  className="inline-flex items-center gap-1 rounded text-teal hover:text-teal-dark hover:underline"
                                >
                                  <Phone size={14} aria-hidden="true" />
                                  {app.candidatePhone}
                                </a>
                              )}
                              <span className="inline-flex items-center gap-1 tabular-nums">
                                <Calendar size={14} aria-hidden="true" />
                                <span className="sr-only">Recibida el </span>
                                {formatDate(app.createdAt)}
                              </span>
                            </p>
                          </div>
                          {/* Bajo lg, las dos decisiones que no avanzan van en el
                              «…» de la ficha: así «Ver CV» y «Meter al proceso»
                              caben en una fila y la ficha no ocupa una pantalla.
                              Desde lg están a la vista en la columna de la derecha. */}
                          <MenuAcciones
                            etiqueta={`Más decisiones sobre ${app.candidateName}`}
                            className="-mr-1.5 -mt-1 flex-none lg:hidden"
                            opciones={[
                              {
                                id: 'descartar',
                                etiqueta: 'Descartar',
                                icono: XCircle,
                                peligro: true,
                                // Lo mismo que el botón deshabilitado mientras se procesa.
                                alElegir: () => {
                                  if (!ocupada) handleStatusChange(app.id, 'discarded');
                                }
                              },
                              {
                                id: 'archivar',
                                etiqueta: 'Archivar',
                                icono: Archive,
                                alElegir: () => {
                                  if (!ocupada) handleStatusChange(app.id, 'archived');
                                }
                              }
                            ]}
                          />
                        </div>

                        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                          <div className="rounded-lg border border-line bg-paper/60 px-3.5 py-3">
                            <dt className="flex items-center gap-1.5 text-xs font-medium text-ink-muted">
                              <Briefcase size={13} aria-hidden="true" />
                              Se postuló a
                            </dt>
                            <dd className="mt-1 min-w-0">
                              <p className="font-semibold leading-snug text-ink">{app.job.title}</p>
                              <p className="text-[13px] text-ink-muted">
                                {nombreEmpresa(app)} · {app.job.location}
                              </p>
                            </dd>
                          </div>

                          {/* Indicador de asignación de reclutador */}
                          <div
                            className={cn(
                              'rounded-lg border px-3.5 py-3',
                              !app.job.assignment ? 'border-orange/40 bg-orange-tint/60' : 'border-line bg-paper/60'
                            )}
                          >
                            <dt className="flex items-center gap-1.5 text-xs font-medium text-ink-muted">
                              <UserCheck size={13} aria-hidden="true" />
                              Reclutador
                            </dt>
                            <dd className="mt-1 text-sm">
                              {!app.job.assignment ? (
                                <span className="flex flex-col items-start gap-1">
                                  <span className="inline-flex items-start gap-1.5 font-medium text-orange-dark">
                                    <AlertTriangle size={15} className="mt-0.5 flex-none" aria-hidden="true" />
                                    Esta vacante no tiene reclutador asignado.
                                  </span>
                                  <Link
                                    href="/admin/assign-candidates"
                                    className="inline-flex items-center gap-1 rounded font-semibold text-teal hover:text-teal-dark hover:underline"
                                  >
                                    Asignar ahora
                                    <ArrowRight size={14} aria-hidden="true" />
                                  </Link>
                                </span>
                              ) : app.job.assignment.recruiter ? (
                                <span className="font-medium text-ink">
                                  {app.job.assignment.recruiter.nombre} {app.job.assignment.recruiter.apellidoPaterno}
                                </span>
                              ) : (
                                <span className="text-ink-muted">Sin reclutador en el equipo</span>
                              )}
                            </dd>
                          </div>
                        </dl>

                        {/* Carta de presentación: la voz del candidato */}
                        {app.coverLetter && (
                          <figure className="mt-4">
                            <figcaption className="text-xs font-medium text-ink-muted">Carta de presentación</figcaption>
                            <blockquote className="mt-1.5 border-l-2 border-teal/40 pl-3.5 text-sm leading-relaxed text-ink">
                              {app.coverLetter.length > 300
                                ? `${app.coverLetter.substring(0, 300)}...`
                                : app.coverLetter}
                            </blockquote>
                          </figure>
                        )}
                      </div>

                      {/* Decisiones: la de avanzar primero, la que no se deshace al
                          final. Bajo lg: «Ver CV» y «Meter al proceso» en una
                          fila (Descartar y Archivar, en el «…» de arriba); «Ver
                          CV» a su ancho y el primario con el resto, para que a
                          360 px quepa sin cortarse. Desde lg, las cuatro en columna. */}
                      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2 sm:max-w-md lg:flex lg:w-52 lg:max-w-none lg:flex-none lg:flex-col">
                        {cv && (
                          <a
                            href={cv}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={cn(clasesBoton({ variante: 'contorno', tamano: 'sm' }), 'lg:justify-start')}
                          >
                            <FileText aria-hidden="true" />
                            Ver CV
                            <span className="sr-only"> de {app.candidateName} (se abre en otra pestaña)</span>
                            <ExternalLink className="ml-auto text-ink-muted" aria-hidden="true" />
                          </a>
                        )}
                        <Button
                          variante="secundario"
                          tamano="sm"
                          icono={CheckCircle}
                          onClick={() => handleStatusChange(app.id, 'reviewing')}
                          disabled={ocupada}
                          // Sin CV, el primario ocupa la fila entera.
                          className={cn('min-w-0 lg:justify-start', !cv && 'col-span-2')}
                        >
                          Meter al proceso
                          <span className="sr-only"> a {app.candidateName}</span>
                        </Button>
                        <Button
                          variante="contorno"
                          tamano="sm"
                          icono={XCircle}
                          onClick={() => handleStatusChange(app.id, 'discarded')}
                          disabled={ocupada}
                          className="hidden text-danger hover:border-danger hover:bg-danger-tint lg:inline-flex lg:justify-start"
                        >
                          Descartar
                          <span className="sr-only"> a {app.candidateName}</span>
                        </Button>
                        <Button
                          variante="fantasma"
                          tamano="sm"
                          icono={Archive}
                          onClick={() => handleStatusChange(app.id, 'archived')}
                          disabled={ocupada}
                          className="hidden lg:inline-flex lg:justify-start"
                        >
                          Archivar
                          <span className="sr-only"> a {app.candidateName}</span>
                        </Button>
                      </div>
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        )}
        {/* Con una sola página no se pinta. */}
        {paginacion && (
          <Pagination pagination={paginacion} alCambiar={irAPagina} etiqueta="aplicaciones pendientes" />
        )}
      </Card>
    </>
  );
}
