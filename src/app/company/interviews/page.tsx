// RUTA: src/app/company/interviews/page.tsx

'use client';

/**
 * Entrevistas de la empresa: las solicitudes que INAKAT coordina con cada
 * candidato, en tres pestañas (pendientes, agendadas, pasadas).
 *
 * Registro de aplicación (docs/DISENO.md). Misma carga y mismos filtros de
 * siempre; cambió la presentación: una agenda (fecha a la izquierda, qué y con
 * quién en medio, estado a la derecha), la próxima entrevista destacada arriba
 * y los horarios que propusiste visibles mientras INAKAT coordina.
 */

import { useState, useEffect } from 'react';
import {
  AlertCircle,
  Briefcase,
  Calendar,
  CalendarX,
  Clock,
  ExternalLink,
  Hourglass,
  MapPin,
  MessageSquare,
  RefreshCw,
  Users,
  Video,
} from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import Tabs, { PanelPestana } from '@/components/ui/Tabs';
import { Badge, type TonoBadge } from '@/components/ui/Badge';
import Button, { clasesBoton } from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import { SkeletonPagina } from '@/components/ui/Skeleton';
import { cn } from '@/lib/utils';

type TabType = 'pending' | 'scheduled' | 'past';

interface InterviewRequest {
  id: number;
  applicationId: number;
  type: string;
  duration: number;
  participants: Array<{ nombre: string; email: string }> | null;
  availableSlots: Array<{ date: string; time: string }>;
  message: string | null;
  status: string;
  confirmedSlot: { date: string; time: string } | null;
  topic: string | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  location: string | null;
  meetingUrl: string | null;
  // PRIVACIDAD (#50/#51): las notas internas del admin ya no se envían a la
  // empresa; declararlas aquí sólo invitaba a volver a pintarlas.
  createdAt: string;
  application: {
    id: number;
    candidateName: string;
    candidateEmail: string;
    candidatePhone: string | null;
    status: string;
    job: {
      id: number;
      title: string;
      company: string;
    };
  };
}

export default function CompanyInterviewsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('pending');
  const [interviews, setInterviews] = useState<InterviewRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchInterviews();
  }, []);

  const fetchInterviews = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/company/interviews');
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Error al cargar entrevistas');
      setInterviews(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  const now = new Date();

  const pendingInterviews = interviews.filter(i => i.status === 'pending');
  const scheduledInterviews = interviews.filter(
    i => i.status === 'confirmed' && i.scheduledStart && new Date(i.scheduledStart) >= now
  );
  const pastInterviews = interviews.filter(
    i =>
      i.status === 'cancelled' ||
      i.status === 'rejected' ||
      (i.status === 'confirmed' && i.scheduledStart && new Date(i.scheduledStart) < now)
  );

  const tabData: Record<TabType, { label: string; interviews: InterviewRequest[] }> = {
    pending: { label: 'Pendientes', interviews: pendingInterviews },
    scheduled: { label: 'Agendadas', interviews: scheduledInterviews },
    past: { label: 'Pasadas', interviews: pastInterviews },
  };

  const currentInterviews = tabData[activeTab].interviews;

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  };

  // Un horario propuesto ('2026-09-24' + '10:00'), leído como fecha LOCAL.
  const formatSlot = (slot: { date: string; time: string }) => {
    const [y, m, d] = slot.date.split('-').map(Number);
    const fecha = y && m && d ? new Date(y, m - 1, d) : null;
    const dia = fecha
      ? fecha.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })
      : slot.date;
    return `${dia}, ${slot.time}`;
  };

  // Estado con color Y texto (el vocabulario de siempre).
  const getStatusBadge = (interview: InterviewRequest) => {
    let estado: { etiqueta: string; tono: TonoBadge } | null = null;
    if (interview.status === 'pending') estado = { etiqueta: 'En coordinación', tono: 'aviso' };
    else if (interview.status === 'confirmed') {
      estado =
        interview.scheduledStart && new Date(interview.scheduledStart) < now
          ? { etiqueta: 'Realizada', tono: 'neutro' }
          : { etiqueta: 'Confirmada', tono: 'exito' };
    } else if (interview.status === 'cancelled') estado = { etiqueta: 'Cancelada', tono: 'peligro' };
    else if (interview.status === 'rejected') estado = { etiqueta: 'Rechazada', tono: 'peligro' };
    if (!estado) return null;
    return <Badge tono={estado.tono}>{estado.etiqueta}</Badge>;
  };

  // La casilla de la izquierda de cada fila: el día (confirmadas) o el estado.
  const casilla = (interview: InterviewRequest) => {
    if (interview.status === 'confirmed' && interview.scheduledStart) {
      const inicio = new Date(interview.scheduledStart);
      const futura = inicio >= now;
      return (
        <div
          className={cn(
            'flex h-12 w-12 flex-none flex-col items-center justify-center rounded-xl text-center sm:h-16 sm:w-16',
            // teal-dark sobre teal-tint 8.18 · tinta sobre niebla 10.35
            futura ? 'bg-teal-tint text-teal-dark' : 'bg-mist text-ink'
          )}
          aria-hidden="true"
        >
          <span className="font-display text-xl font-bold leading-none tabular-nums sm:text-2xl">{inicio.getDate()}</span>
          <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide sm:mt-1 sm:text-[11px]">
            {inicio.toLocaleDateString('es-MX', { month: 'short' })}
          </span>
        </div>
      );
    }
    const Icono = interview.status === 'pending' ? Hourglass : CalendarX;
    return (
      <div
        className={cn(
          'flex h-12 w-12 flex-none items-center justify-center rounded-xl sm:h-16 sm:w-16',
          interview.status === 'pending' ? 'bg-orange-tint text-orange-dark' : 'bg-mist text-ink-muted'
        )}
        aria-hidden="true"
      >
        <Icono className="h-5 w-5 sm:h-6 sm:w-6" />
      </div>
    );
  };

  // Enlace de la videollamada con aspecto de botón (abre en otra pestaña).
  const enlaceReunion = (interview: InterviewRequest, tamano: 'sm' | 'md' = 'sm') =>
    interview.type === 'videocall' && interview.meetingUrl ? (
      <a
        href={interview.meetingUrl}
        target="_blank"
        rel="noopener noreferrer"
        // En móvil el texto puede partirse: con nowrap se salía de la columna a 360 px.
        className={cn(clasesBoton({ variante: 'secundario', tamano }), 'h-auto whitespace-normal py-1.5 text-left', tamano === 'md' ? 'min-h-10' : 'min-h-8')}
      >
        <ExternalLink aria-hidden="true" />
        Unirse a la videoconferencia
        <span className="sr-only"> (se abre en otra pestaña)</span>
      </a>
    ) : null;

  // La próxima entrevista agendada (la más cercana en el tiempo).
  const proxima = [...scheduledInterviews].sort(
    (a, b) => new Date(a.scheduledStart as string).getTime() - new Date(b.scheduledStart as string).getTime()
  )[0];

  if (loading) {
    return <SkeletonPagina conCifras={false} />;
  }

  return (
    <>
      {/* Antetítulo del panel de empresa (el de perfil e integraciones):
          «Reclutamiento» es el grupo del menú de admin, no de este. */}
      <PageHeader
        antetitulo="Empresa"
        titulo="Entrevistas"
        remate="con tus candidatos"
        descripcion="Seguimiento de tus solicitudes de entrevista. INAKAT coordina la fecha y la hora con cada candidato y te avisa cuando quedan confirmadas."
      />

      {error && (
        <div
          role="alert"
          className="mb-6 flex flex-col gap-3 rounded-xl border border-danger/30 bg-danger-tint px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="flex items-center gap-2 text-sm font-medium text-danger-dark">
            <AlertCircle className="h-[18px] w-[18px] flex-none" aria-hidden="true" />
            {error}
          </p>
          <Button
            variante="contorno"
            tamano="sm"
            icono={RefreshCw}
            onClick={() => {
              setError('');
              fetchInterviews();
            }}
          >
            Reintentar
          </Button>
        </div>
      )}

      {/* La próxima entrevista, a la vista sin buscarla */}
      {!error && proxima && proxima.scheduledStart && (
        <Card className="mb-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            {casilla(proxima)}
            <div className="min-w-0 flex-1">
              <h2 className="inline-flex items-center gap-2 font-display text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
                <span className="h-1.5 w-1.5 rounded-full bg-orange" aria-hidden="true" />
                Próxima entrevista
              </h2>
              <p className="mt-1 font-display text-lg font-semibold leading-snug text-ink">
                {proxima.application.candidateName}
                <span className="font-body text-sm font-normal text-ink-muted"> · {proxima.application.job.title}</span>
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink">
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-teal" aria-hidden="true" />
                  {formatDate(proxima.scheduledStart)}
                </span>
                <span className="inline-flex items-center gap-1.5 tabular-nums">
                  <Clock className="h-4 w-4 text-teal" aria-hidden="true" />
                  {formatTime(proxima.scheduledStart)}
                  {proxima.scheduledEnd && ` - ${formatTime(proxima.scheduledEnd)}`}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  {proxima.type === 'videocall' ? (
                    <Video className="h-4 w-4 text-teal" aria-hidden="true" />
                  ) : (
                    <MapPin className="h-4 w-4 text-teal" aria-hidden="true" />
                  )}
                  {proxima.type === 'videocall' ? 'Videoconferencia' : 'Presencial'}
                </span>
              </p>
              {proxima.type === 'presential' && proxima.location && (
                <p className="mt-1 text-sm text-ink-muted">{proxima.location}</p>
              )}
            </div>
            {enlaceReunion(proxima, 'md')}
          </div>
        </Card>
      )}

      {/* Con error no hay lista: «no se pudo cargar» no es «no hay entrevistas». */}
      {!error && (
        <Card sinRelleno>
          <h2 className="sr-only">Solicitudes de entrevista</h2>
          <Tabs
            idBase="entrevistas"
            etiqueta="Entrevistas por estado"
            activa={activeTab}
            alCambiar={(id) => setActiveTab(id as TabType)}
            pestanas={(Object.keys(tabData) as TabType[]).map((tab) => ({
              id: tab,
              etiqueta: tabData[tab].label,
              contador: tabData[tab].interviews.length,
            }))}
            className="px-3"
          />

          <PanelPestana idBase="entrevistas" id={activeTab} activa={activeTab} className="pt-0">
            {currentInterviews.length === 0 ? (
              <EmptyState
                frase="Todavía nada por aquí."
                titulo={`No hay entrevistas ${tabData[activeTab].label.toLowerCase()}`}
                descripcion={
                  activeTab === 'pending'
                    ? 'Cuando solicites una entrevista desde el pipeline de candidatos, aparecerá aquí.'
                    : activeTab === 'scheduled'
                    ? 'Las entrevistas confirmadas por INAKAT aparecerán aquí.'
                    : 'Las entrevistas pasadas y canceladas aparecerán aquí.'
                }
              />
            ) : (
              <ul className="divide-y divide-line">
                {currentInterviews.map(interview => (
                  <li key={interview.id} className="flex gap-3 px-4 py-4 transition-colors duration-150 hover:bg-paper/60 sm:gap-4 sm:px-5">
                    {casilla(interview)}

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <h3 className="font-display font-semibold text-ink">{interview.application.candidateName}</h3>
                        {getStatusBadge(interview)}
                      </div>

                      <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-muted">
                        <Briefcase className="h-3.5 w-3.5 flex-none" aria-hidden="true" />
                        <span className="truncate">{interview.application.job.title}</span>
                      </p>

                      {interview.topic && (
                        <p className="mt-0.5 flex items-center gap-1.5 text-sm text-ink-muted">
                          <MessageSquare className="h-3.5 w-3.5 flex-none" aria-hidden="true" />
                          <span>{interview.topic}</span>
                        </p>
                      )}

                      {/* Pending: show coordination message */}
                      {interview.status === 'pending' && (
                        <div className="mt-3 rounded-lg border border-orange/30 bg-orange-tint/60 px-3 py-2.5">
                          <p className="text-sm text-ink">
                            Tu solicitud está siendo coordinada por <strong>INAKAT</strong>. Te notificaremos cuando se confirme la fecha y hora.
                          </p>
                          {interview.availableSlots?.length > 0 && (
                            <div className="mt-2">
                              <p className="text-xs font-medium text-ink-muted">
                                Horarios que propusiste · {interview.duration} min
                                {interview.type === 'videocall' ? ' · videollamada' : ' · presencial'}
                              </p>
                              <ul className="mt-1.5 flex flex-wrap gap-1.5">
                                {interview.availableSlots.map((slot) => (
                                  <li key={`${slot.date}-${slot.time}`}>
                                    <Badge tono="neutro" sinPunto tamano="sm" className="bg-white tabular-nums">
                                      {formatSlot(slot)}
                                    </Badge>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          <p className="mt-2 text-xs text-ink-muted">
                            Solicitada el {formatDate(interview.createdAt)}
                          </p>
                        </div>
                      )}

                      {/* Confirmed/Past: show schedule details */}
                      {interview.status === 'confirmed' && interview.scheduledStart && (
                        <div className="mt-3 space-y-2">
                          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                            <span className="inline-flex items-center gap-1.5 font-medium text-ink">
                              <Calendar className="h-4 w-4 text-teal" aria-hidden="true" />
                              {formatDate(interview.scheduledStart)}
                            </span>
                            <span className="inline-flex items-center gap-1.5 tabular-nums text-ink">
                              <Clock className="h-4 w-4 text-teal" aria-hidden="true" />
                              {formatTime(interview.scheduledStart)}
                              {interview.scheduledEnd && ` - ${formatTime(interview.scheduledEnd)}`}
                            </span>
                            <span className="inline-flex items-center gap-1.5 text-ink-muted">
                              {interview.type === 'videocall' ? (
                                <Video className="h-4 w-4" aria-hidden="true" />
                              ) : (
                                <MapPin className="h-4 w-4" aria-hidden="true" />
                              )}
                              {interview.type === 'videocall' ? 'Videoconferencia' : 'Presencial'}
                            </span>
                            {interview.participants && interview.participants.length > 0 && (
                              <span className="inline-flex items-center gap-1.5 text-ink-muted">
                                <Users className="h-4 w-4" aria-hidden="true" />
                                {interview.participants.map((p) => p.nombre).join(', ')}
                              </span>
                            )}
                          </p>

                          {/* Location */}
                          {interview.type === 'presential' && interview.location && (
                            <p className="flex items-start gap-1.5 text-sm text-ink-muted">
                              <MapPin className="mt-0.5 h-3.5 w-3.5 flex-none" aria-hidden="true" />
                              <span>{interview.location}</span>
                            </p>
                          )}

                          {/* Meeting URL */}
                          {enlaceReunion(interview)}
                        </div>
                      )}

                      {/* Cancelled */}
                      {interview.status === 'cancelled' && (
                        <p className="mt-3 rounded-lg border border-danger/20 bg-danger-tint/60 px-3 py-2 text-sm text-danger-dark">
                          Esta entrevista fue cancelada.
                        </p>
                      )}

                      {/* Rejected: sólo 'cancelled' tenía bloque, así que una
                          solicitud rechazada se quedaba sin ninguna explicación
                          en la tarjeta. */}
                      {interview.status === 'rejected' && (
                        <p className="mt-3 rounded-lg border border-danger/20 bg-danger-tint/60 px-3 py-2 text-sm text-danger-dark">
                          INAKAT no pudo agendar esta entrevista con los horarios
                          propuestos. Puedes enviar una nueva solicitud con otras
                          opciones.
                        </p>
                      )}
                    </div>

                  </li>
                ))}
              </ul>
            )}
          </PanelPestana>
        </Card>
      )}
    </>
  );
}
