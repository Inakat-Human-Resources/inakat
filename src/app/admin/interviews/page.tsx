// RUTA: src/app/admin/interviews/page.tsx

'use client';

/**
 * Entrevistas: el admin agenda (y reprograma o cancela) las entrevistas que
 * piden las empresas (GET /api/admin/interviews, PATCH /api/admin/interviews/[id]).
 *
 * Registro de APLICACIÓN (docs/DISENO.md): PageHeader → tarjeta con pestañas
 * (Pendientes, Agendadas, Pasadas, Canceladas) y sus cifras → DataTable → Modal
 * de agenda. La lógica —todas las tandas antes de pintar (ADM-002/043), qué
 * viaja al cancelar (ADM-007), cómo se decide el éxito (ADM-008), horarios
 * vencidos (ADM-064), ligas sólo http(s) (ADM-065), cancelar una ya agendada
 * con confirmación (ADM-066)— es la de siempre; sólo cambió la presentación.
 */

import { useState, useEffect, useRef } from 'react';
import {
  AlertCircle,
  Briefcase,
  Building,
  Calendar,
  CalendarDays,
  CheckCircle,
  Eye,
  MapPin,
  MessageSquare,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Video,
  X
} from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import DataTable, { type Columna } from '@/components/ui/DataTable';
import StatusBadge, { Badge } from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import Button from '@/components/ui/Button';
import IconButton from '@/components/ui/IconButton';
import Modal from '@/components/ui/Modal';
import Tabs, { PanelPestana } from '@/components/ui/Tabs';
import FormField, { Input, Textarea } from '@/components/ui/FormField';
import { SkeletonPagina } from '@/components/ui/Skeleton';
import { cn } from '@/lib/utils';
import { fechaCorta, fechaHora } from '@/lib/fechas';

// Tope de tandas que se piden al servidor (100 filas cada una). Es una red de
// seguridad: sin él una base con muchas solicitudes dispararía peticiones sin
// fin desde el navegador.
const MAX_TANDAS = 20;

type TabType = 'pending' | 'confirmed' | 'expired' | 'cancelled';

interface InterviewRequest {
  id: number;
  applicationId: number;
  type: string;
  duration: number;
  participants: string | null;
  availableSlots: string;
  message: string | null;
  status: string;
  confirmedSlot: string | null;
  topic: string | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  location: string | null;
  meetingUrl: string | null;
  adminNotes: string | null;
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
  requestedBy: {
    nombre: string;
    apellidoPaterno: string | null;
    email: string;
    companyRequest?: {
      nombreEmpresa: string;
    } | null;
  };
}

/** Pestañas (mismas cuatro de siempre, con el vocabulario de la pantalla). */
const PESTANAS: Array<{ key: TabType; label: string; frase: string }> = [
  { key: 'pending', label: 'Pendientes', frase: 'Nada esperando fecha.' },
  { key: 'confirmed', label: 'Agendadas', frase: 'La agenda está libre.' },
  { key: 'expired', label: 'Pasadas', frase: 'Todavía no hay historia.' },
  { key: 'cancelled', label: 'Canceladas', frase: 'Ninguna se cayó.' }
];

/** Cuántos horarios propuso la empresa (sólo para pintarlo; si el JSON no se lee, 0). */
const horariosPropuestos = (json: string | null): number => {
  if (!json) return 0;
  try {
    const lista = JSON.parse(json);
    return Array.isArray(lista) ? lista.length : 0;
  } catch {
    return 0;
  }
};

export default function AdminInterviewsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('pending');
  const [interviews, setInterviews] = useState<InterviewRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedInterview, setSelectedInterview] = useState<InterviewRequest | null>(null);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState('');

  // Form fields
  const [formTopic, setFormTopic] = useState('');
  const [formScheduledStart, setFormScheduledStart] = useState('');
  const [formScheduledEnd, setFormScheduledEnd] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formMeetingUrl, setFormMeetingUrl] = useState('');
  const [formAdminNotes, setFormAdminNotes] = useState('');
  const [formParticipants, setFormParticipants] = useState<Array<{ nombre: string; email: string }>>([]);
  const [newParticipantName, setNewParticipantName] = useState('');
  const [newParticipantEmail, setNewParticipantEmail] = useState('');

  useEffect(() => {
    fetchInterviews();
  }, []);

  /**
   * ADM-002/043: la API devuelve tandas (100 como máximo) y esta pantalla
   * reparte las solicitudes en cuatro pestañas y calcula los contadores en el
   * cliente. Pidiendo sólo la primera tanda, con 120 solicitudes las más
   * antiguas —justo las que llevan más tiempo pendientes— no aparecían en
   * ninguna pestaña y el contador "Pendientes" mentía. Se piden todas las
   * tandas antes de pintar: la primera dice cuántas hay y el resto va en
   * paralelo.
   */
  const fetchInterviews = async () => {
    setLoading(true);
    try {
      const primera = await fetch('/api/admin/interviews?limit=100').then(r => r.json());
      if (!primera.success) {
        setError(primera.error || 'Error al cargar entrevistas');
        return;
      }

      const totalPaginas: number = primera.pagination?.totalPages ?? 1;
      const paginasRestantes: number[] = [];
      for (let p = 2; p <= Math.min(totalPaginas, MAX_TANDAS); p++) {
        paginasRestantes.push(p);
      }

      const resto = await Promise.all(
        paginasRestantes.map(p =>
          fetch(`/api/admin/interviews?limit=100&page=${p}`).then(r => r.json())
        )
      );

      const fallida = resto.find(tanda => !tanda.success);
      if (fallida) {
        setError(fallida.error || 'Error al cargar entrevistas');
        return;
      }

      const acumuladas: InterviewRequest[] = [
        ...(primera.data || []),
        ...resto.flatMap(tanda => tanda.data || [])
      ];

      setError('');
      if (totalPaginas > MAX_TANDAS) {
        setError(
          `Hay más solicitudes de las que caben en pantalla; se muestran las ${acumuladas.length} más recientes.`
        );
      }
      setInterviews(acumuladas);
    } catch {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const now = new Date();

  const getFilteredInterviews = () => {
    switch (activeTab) {
      case 'pending':
        return interviews.filter(i => i.status === 'pending');
      case 'confirmed':
        return interviews.filter(i =>
          i.status === 'confirmed' && i.scheduledStart && new Date(i.scheduledStart) >= now
        );
      case 'expired':
        return interviews.filter(i =>
          (i.status === 'confirmed' && i.scheduledStart && new Date(i.scheduledStart) < now)
        );
      case 'cancelled':
        return interviews.filter(i => i.status === 'cancelled' || i.status === 'rejected');
      default:
        return [];
    }
  };

  const filteredInterviews = getFilteredInterviews();

  const tabCounts = {
    pending: interviews.filter(i => i.status === 'pending').length,
    confirmed: interviews.filter(i => i.status === 'confirmed' && i.scheduledStart && new Date(i.scheduledStart) >= now).length,
    expired: interviews.filter(i => i.status === 'confirmed' && i.scheduledStart && new Date(i.scheduledStart) < now).length,
    cancelled: interviews.filter(i => i.status === 'cancelled' || i.status === 'rejected').length,
  };

  // Open modal
  const openScheduleModal = (interview: InterviewRequest) => {
    setSelectedInterview(interview);
    setFormTopic(interview.topic || interview.application.job.title);
    setFormScheduledStart(interview.scheduledStart ? toLocalDatetime(interview.scheduledStart) : '');
    setFormScheduledEnd(interview.scheduledEnd ? toLocalDatetime(interview.scheduledEnd) : '');
    setFormLocation(interview.location || '');
    setFormMeetingUrl(interview.meetingUrl || '');
    setFormAdminNotes(interview.adminNotes || '');
    // Parse participants
    try {
      const parsed = interview.participants ? JSON.parse(interview.participants) : [];
      setFormParticipants(Array.isArray(parsed) ? parsed : []);
    } catch {
      setFormParticipants([]);
    }
    setNewParticipantName('');
    setNewParticipantEmail('');
    setModalError('');
    setModalOpen(true);
  };

  /**
   * ¿Es una URL http(s) absoluta? Misma regla que isSafeHttpUrl de
   * src/lib/sanitize.ts, que no se puede importar aquí sin arrastrar código de
   * servidor al bundle del cliente.
   */
  const esEnlaceHttp = (valor: string): boolean => {
    try {
      const url = new URL(valor);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  };

  /** Fecha/hora local de un horario propuesto por la empresa (ADM-064). */
  const fechaDeSlot = (slot: { date: string; time: string }) =>
    new Date(`${slot.date}T${slot.time}`);

  const toLocalDatetime = (iso: string) => {
    const d = new Date(iso);
    const offset = d.getTimezoneOffset();
    const local = new Date(d.getTime() - offset * 60000);
    return local.toISOString().slice(0, 16);
  };

  const addParticipant = () => {
    if (!newParticipantName.trim() || !newParticipantEmail.trim()) return;
    setFormParticipants(prev => [...prev, { nombre: newParticipantName.trim(), email: newParticipantEmail.trim() }]);
    setNewParticipantName('');
    setNewParticipantEmail('');
  };

  const removeParticipant = (index: number) => {
    setFormParticipants(prev => prev.filter((_, i) => i !== index));
  };

  // Auto-calculate end time when start changes
  const handleStartChange = (val: string) => {
    setFormScheduledStart(val);
    if (val && selectedInterview) {
      const start = new Date(val);
      start.setMinutes(start.getMinutes() + selectedInterview.duration);
      const offset = start.getTimezoneOffset();
      const local = new Date(start.getTime() - offset * 60000);
      setFormScheduledEnd(local.toISOString().slice(0, 16));
    }
  };

  // Select a proposed slot
  const selectSlot = (slot: { date: string; time: string }) => {
    const dateStr = `${slot.date}T${slot.time}`;
    handleStartChange(dateStr);
  };

  // Save (confirm or update)
  const handleSave = async (newStatus: 'confirmed' | 'cancelled' | null) => {
    if (!selectedInterview) return;

    const statusToSet = newStatus || selectedInterview.status;

    if (statusToSet === 'confirmed' && (!formScheduledStart || !formScheduledEnd)) {
      setModalError('Debes seleccionar fecha/hora de inicio y fin para confirmar.');
      return;
    }

    /**
     * ADM-065: el input es `type="url"` pero no vive dentro de un <form> que se
     * envíe, así que el navegador nunca lo valida. "meet.google.com/abc" se
     * guardaba tal cual y en /company/interviews el botón de unirse resolvía la
     * ruta como relativa (/company/meet.google.com/abc → 404) a la hora de la
     * entrevista. Sólo http(s), como en el resto de enlaces de la app.
     */
    if (newStatus !== 'cancelled' && formMeetingUrl.trim() && !esEnlaceHttp(formMeetingUrl.trim())) {
      setModalError('La liga de videoconferencia debe empezar por https:// (o http://).');
      return;
    }

    if (statusToSet === 'confirmed') {
      if (selectedInterview.type === 'videocall' && !formMeetingUrl.trim()) {
        setModalError('Para confirmar una videollamada hace falta la liga de videoconferencia.');
        return;
      }
      if (selectedInterview.type === 'presential' && !formLocation.trim()) {
        setModalError('Para confirmar una entrevista presencial hace falta el lugar.');
        return;
      }
      // ADM-064: los horarios propuestos caducan. Confirmar uno ya pasado deja
      // la entrevista directamente en "Pasadas" y la empresa la ve como
      // realizada aunque nunca ocurrió.
      if (new Date(formScheduledStart) < new Date()) {
        setModalError('La fecha de inicio ya pasó: elige un horario futuro.');
        return;
      }
    }

    setSaving(true);
    setModalError('');

    try {
      // ADM-007: cancelar no reprograma nada. Antes se mandaba también
      // scheduledStart/End en null; la API los parseaba como 1970-01-01 y la
      // solicitud pendiente (sin fechas, el caso normal) no se podía cancelar
      // o quedaba con fechas de epoch. Al cancelar sólo viajan el estado y las
      // notas.
      const body: Record<string, unknown> =
        newStatus === 'cancelled'
          ? { status: 'cancelled', adminNotes: formAdminNotes || null }
          : {
              topic: formTopic || null,
              scheduledStart: formScheduledStart ? new Date(formScheduledStart).toISOString() : null,
              scheduledEnd: formScheduledEnd ? new Date(formScheduledEnd).toISOString() : null,
              location: formLocation || null,
              meetingUrl: formMeetingUrl.trim() || null,
              adminNotes: formAdminNotes || null,
              participants: JSON.stringify(formParticipants),
              ...(newStatus ? { status: newStatus } : {})
            };

      const res = await fetch(`/api/admin/interviews/${selectedInterview.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await res.json();
      // ADM-008: el éxito lo decide el código HTTP y `success`, no la mera
      // presencia de un campo. Antes la ruta [id] respondía `{ interview }` sin
      // `success` y cada guardado correcto se pintaba como "Error al guardar".
      if (res.ok && data.success) {
        setModalOpen(false);
        setSelectedInterview(null);
        fetchInterviews();
      } else {
        setModalError(data.error || 'Error al guardar');
      }
    } catch {
      setModalError('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  // Formateador único (src/lib/fechas): «23 sep 2026» y «23 sep 2026, 18:22».
  const formatDate = (iso: string) => fechaCorta(iso);
  const formatDateTime = (iso: string) => fechaHora(iso);

  const getCompanyName = (interview: InterviewRequest) =>
    interview.requestedBy?.companyRequest?.nombreEmpresa ||
    interview.application.job.company;

  // ---------------------------------------------------------------------------
  // Presentación (nada de lo que sigue pide datos ni cambia qué se envía)
  // ---------------------------------------------------------------------------

  // Un error del modal se lleva a la vista: el botón está en el pie y el aviso
  // arriba del cuerpo, que puede estar desplazado.
  const errorModalRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (modalError) errorModalRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [modalError]);

  // Esqueleto de página sólo en la primera carga; al recargar tras guardar,
  // la tabla muestra sus filas esqueleto y la cabecera se queda.
  if (loading && interviews.length === 0) {
    return <SkeletonPagina conCifras={false} />;
  }

  const pestanaActual = PESTANAS.find((p) => p.key === activeTab) ?? PESTANAS[0];
  const editable =
    selectedInterview?.status === 'pending' || selectedInterview?.status === 'confirmed';

  /** Acción de la fila según la pestaña (misma que antes: abre el modal). */
  const accionFila = (interview: InterviewRequest) => {
    const quien = <span className="sr-only"> la entrevista de {interview.application.candidateName}</span>;
    if (activeTab === 'pending') {
      return (
        <Button variante="secundario" tamano="sm" icono={Calendar} onClick={() => openScheduleModal(interview)}>
          Agendar{quien}
        </Button>
      );
    }
    if (activeTab === 'confirmed') {
      return (
        <Button variante="contorno" tamano="sm" icono={Pencil} onClick={() => openScheduleModal(interview)}>
          Editar{quien}
        </Button>
      );
    }
    return (
      <Button variante="fantasma" tamano="sm" icono={Eye} onClick={() => openScheduleModal(interview)}>
        Ver detalle{quien}
      </Button>
    );
  };

  const modalidad = (interview: InterviewRequest) => (
    <Badge
      tono={interview.type === 'videocall' ? 'info' : 'marca'}
      icono={interview.type === 'videocall' ? Video : MapPin}
      tamano="sm"
    >
      {interview.type === 'videocall' ? 'Videollamada' : 'Presencial'}
    </Badge>
  );

  // Anchos medidos: con la barra lateral la tabla tiene ~1126 px a 1440,
  // ~966 a 1280 y ~710 a 1024. Empresa se esconde bajo 1100 y Modalidad bajo
  // 800; su dato sube a la celda del candidato (data-solo-bajo).
  const columnas: Columna<InterviewRequest>[] = [
    {
      id: 'candidato',
      encabezado: 'Candidato',
      enTarjeta: 'titulo',
      className: 'min-w-[12rem]',
      celda: (interview) => (
        <div className="min-w-0">
          <p className="font-semibold text-ink">{interview.application.candidateName}</p>
          <p className="mt-0.5 flex items-start gap-1 text-[13px] text-ink-muted">
            <Briefcase size={13} className="mt-[3px] flex-none" aria-hidden="true" />
            <span>{interview.application.job.title}</span>
          </p>
          <p data-solo-bajo="xl" className="flex items-start gap-1 text-[13px] text-ink-muted">
            <Building size={13} className="mt-[3px] flex-none" aria-hidden="true" />
            <span>{getCompanyName(interview)}</span>
          </p>
          <span data-solo-bajo="md" className="mt-1 flex flex-wrap items-center gap-1.5">
            {modalidad(interview)}
            <span className="text-xs tabular-nums text-ink-muted">{interview.duration} min</span>
          </span>
          {interview.topic && (
            <p className="mt-1 line-clamp-1 text-xs text-ink-muted">Tema: {interview.topic}</p>
          )}
        </div>
      )
    },
    {
      id: 'empresa',
      encabezado: 'Empresa',
      ocultarBajo: 'xl',
      celda: (interview) => <span className="font-medium text-ink">{getCompanyName(interview)}</span>
    },
    {
      id: 'modalidad',
      encabezado: 'Modalidad',
      ocultarBajo: 'md',
      className: 'whitespace-nowrap',
      celda: (interview) => (
        <div className="flex flex-col items-start gap-1">
          {modalidad(interview)}
          <span className="text-xs tabular-nums text-ink-muted">{interview.duration} min</span>
        </div>
      )
    },
    {
      id: 'fecha',
      encabezado: 'Fecha',
      className: 'min-w-[10.5rem]',
      celda: (interview) => {
        const propuestos = horariosPropuestos(interview.availableSlots);
        return (
          <div className="min-w-0 text-sm">
            {interview.scheduledStart ? (
              <>
                <p className="flex items-center gap-1 whitespace-nowrap font-medium tabular-nums text-ink">
                  <CalendarDays size={14} className="flex-none text-teal" aria-hidden="true" />
                  {formatDateTime(interview.scheduledStart)}
                </p>
                {interview.location && (
                  <p className="mt-0.5 flex items-start gap-1 text-[13px] text-ink-muted">
                    <MapPin size={13} className="mt-[3px] flex-none" aria-hidden="true" />
                    <span>{interview.location}</span>
                  </p>
                )}
                {/* ADM-065: las filas guardadas antes de validar la liga
                    pueden traer cualquier cosa; si no es http(s) se
                    enseña como texto, nunca como enlace. */}
                {interview.meetingUrl && esEnlaceHttp(interview.meetingUrl) && (
                  <a
                    href={interview.meetingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-0.5 inline-flex items-center gap-1 rounded text-[13px] font-medium text-teal hover:text-teal-dark hover:underline"
                  >
                    <Video size={13} aria-hidden="true" /> Liga VC
                    <span className="sr-only"> de la entrevista de {interview.application.candidateName} (se abre en otra pestaña)</span>
                  </a>
                )}
                {interview.meetingUrl && !esEnlaceHttp(interview.meetingUrl) && (
                  <p className="mt-0.5 break-all text-[13px] text-ink-muted">{interview.meetingUrl}</p>
                )}
              </>
            ) : (
              <>
                <p className="text-[13px] text-ink-muted">Sin agendar</p>
                {propuestos > 0 && (
                  <p className="text-xs tabular-nums text-ink-muted">
                    {propuestos} {propuestos === 1 ? 'horario propuesto' : 'horarios propuestos'}
                  </p>
                )}
              </>
            )}
            {activeTab === 'cancelled' && (
              <span className="mt-1 inline-flex">
                <StatusBadge estado={interview.status} contexto="entrevista" tamano="sm" />
              </span>
            )}
          </div>
        );
      }
    },
    {
      id: 'solicitada',
      encabezado: 'Solicitada',
      ocultarBajo: 'md',
      className: 'whitespace-nowrap',
      celda: (interview) => (
        <span className="text-[13px] tabular-nums text-ink-muted">{formatDate(interview.createdAt)}</span>
      )
    },
    {
      id: 'acciones',
      encabezado: 'Acciones',
      encabezadoOculto: true,
      alinear: 'fin',
      enTarjeta: 'acciones',
      className: 'w-px whitespace-nowrap',
      celda: (interview) => accionFila(interview)
    }
  ];

  // Horarios propuestos del modal (un JSON que puede venir roto).
  const slotsDelModal = (() => {
    if (!selectedInterview?.availableSlots) return null;
    try {
      const slots = JSON.parse(selectedInterview.availableSlots);
      return Array.isArray(slots) ? (slots as Array<{ date: string; time: string }>) : [];
    } catch {
      return 'roto' as const;
    }
  })();

  return (
    <>
      <PageHeader
        antetitulo="Reclutamiento"
        titulo="Entrevistas"
        remate="entre empresas y candidatos"
        descripcion="Coordina y agenda las entrevistas que piden las empresas."
      />

      {error && (
        <div
          role="alert"
          className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-danger/30 bg-danger-tint px-4 py-3 text-sm font-medium text-danger-dark"
        >
          <AlertCircle size={18} className="flex-none" aria-hidden="true" />
          <p className="min-w-0 flex-1">{error}</p>
          {interviews.length === 0 && (
            <Button variante="contorno" tamano="sm" icono={RefreshCw} onClick={fetchInterviews}>
              Reintentar
            </Button>
          )}
        </div>
      )}

      <Card
        titulo="Solicitudes de entrevista"
        descripcion="Las empresas proponen horarios; aquí se confirma la fecha y el lugar o la liga."
        sinRelleno
      >
        <Tabs
          idBase="entrevistas"
          etiqueta="Estado de las entrevistas"
          activa={activeTab}
          alCambiar={(id) => setActiveTab(id as TabType)}
          pestanas={PESTANAS.map((tab) => ({ id: tab.key, etiqueta: tab.label, contador: tabCounts[tab.key] }))}
          className="px-3"
        />
        <PanelPestana idBase="entrevistas" id={activeTab} activa={activeTab} className="pt-0">
          <DataTable
            etiqueta={`Entrevistas: ${pestanaActual.label}`}
            columnas={columnas}
            filas={filteredInterviews}
            claveFila={(interview) => interview.id}
            cargando={loading}
            alActivarFila={openScheduleModal}
            vacio={
              <EmptyState
                frase={pestanaActual.frase}
                titulo="No hay entrevistas en esta categoría."
              />
            }
          />
        </PanelPestana>
      </Card>

      {/* Agendar / editar / ver una entrevista */}
      <Modal
        abierto={modalOpen && selectedInterview !== null}
        alCerrar={() => setModalOpen(false)}
        tamano="lg"
        // Formulario a medias: pulsar fuera no lo cierra (Escape y «Cerrar» sí).
        cerrarAlPulsarFondo={false}
        iconoTitulo={<CalendarDays size={20} className="flex-none text-teal" aria-hidden="true" />}
        titulo={selectedInterview?.status === 'pending' ? 'Agendar entrevista' : 'Detalle de entrevista'}
        subtitulo={
          selectedInterview && (
            <>
              <span className="font-medium text-ink">{selectedInterview.application.candidateName}</span>
              <span aria-hidden="true"> — </span>
              <span className="sr-only">, </span>
              {getCompanyName(selectedInterview)}
              <span className="mt-0.5 block text-xs">Vacante: {selectedInterview.application.job.title}</span>
            </>
          )
        }
        pie={
          selectedInterview && (
            <>
              {/* ADM-066: una entrevista ya confirmada no se podía cancelar desde
                  la interfaz (la API sí lo admite) y acababa en "Pasadas" como
                  si se hubiera realizado. Cancelar pide confirmación: es un
                  clic que no se puede deshacer desde aquí. */}
              {editable && (
                <Button
                  variante="fantasma"
                  onClick={() => {
                    const pregunta = selectedInterview.status === 'pending'
                      ? '¿Cancelar esta solicitud de entrevista?'
                      : '¿Cancelar esta entrevista ya agendada?';
                    if (confirm(pregunta)) handleSave('cancelled');
                  }}
                  disabled={saving}
                  className="text-danger hover:bg-danger-tint sm:mr-auto"
                >
                  {selectedInterview.status === 'pending' ? 'Cancelar solicitud' : 'Cancelar entrevista'}
                </Button>
              )}
              <Button variante="contorno" onClick={() => setModalOpen(false)}>
                Cerrar
              </Button>
              {selectedInterview.status === 'confirmed' && (
                <Button icono={Save} onClick={() => handleSave(null)} cargando={saving}>
                  Guardar cambios
                </Button>
              )}
              {selectedInterview.status === 'pending' && (
                <Button icono={CheckCircle} onClick={() => handleSave('confirmed')} cargando={saving}>
                  Confirmar entrevista
                </Button>
              )}
            </>
          )
        }
      >
        {selectedInterview && (
          <div className="space-y-6">
            {modalError && (
              <div
                ref={errorModalRef}
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger-tint px-3.5 py-3 text-sm font-medium text-danger-dark"
              >
                <AlertCircle size={16} className="mt-0.5 flex-none" aria-hidden="true" />
                <p className="min-w-0">{modalError}</p>
              </div>
            )}

            {!editable && (
              <p className="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
                <StatusBadge estado={selectedInterview.status} contexto="entrevista" />
                Sólo lectura: esta solicitud ya no se puede modificar.
              </p>
            )}

            {/* Lo que pidió la empresa, antes de agendar */}
            {selectedInterview.message && (
              <section className="[overflow:visible]">
                <h3 className="flex items-center gap-1.5 text-sm font-medium text-ink">
                  <MessageSquare size={15} className="text-teal" aria-hidden="true" />
                  Mensaje de la empresa
                </h3>
                <blockquote className="mt-1.5 whitespace-pre-wrap rounded-lg border-l-2 border-teal bg-teal-tint/40 px-3.5 py-3 text-sm leading-relaxed text-ink">
                  {selectedInterview.message}
                </blockquote>
              </section>
            )}

            {/* Horarios propuestos: elegir uno rellena inicio y fin */}
            {slotsDelModal !== null && (
              <section className="[overflow:visible]" aria-labelledby="horarios-propuestos">
                <h3 id="horarios-propuestos" className="text-sm font-medium text-ink">
                  Horarios propuestos por la empresa
                </h3>
                {slotsDelModal === 'roto' ? (
                  <p className="mt-1 text-[13px] text-ink-muted">Sin horarios</p>
                ) : slotsDelModal.length === 0 ? (
                  <p className="mt-1 text-[13px] text-ink-muted">La empresa no propuso horarios.</p>
                ) : (
                  <>
                    <p className="mt-0.5 text-[13px] text-ink-muted">Elige uno para rellenar el inicio y el fin.</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {slotsDelModal.map((slot, i) => {
                        // ADM-064: un horario vencido no se puede elegir.
                        const vencido = fechaDeSlot(slot) < new Date();
                        const elegido = !vencido && formScheduledStart === `${slot.date}T${slot.time}`;
                        return (
                          <button
                            key={i}
                            type="button"
                            disabled={vencido || !editable}
                            aria-pressed={elegido}
                            title={vencido ? 'Este horario ya pasó' : undefined}
                            onClick={() => selectSlot(slot)}
                            className={cn(
                              'inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[13px] tabular-nums transition-colors duration-150',
                              vencido
                                ? 'cursor-not-allowed border-line text-ink-muted line-through'
                                : elegido
                                  ? 'border-teal bg-teal-tint font-semibold text-teal-dark'
                                  : 'border-line-strong bg-white text-ink hover:border-ink hover:bg-paper disabled:cursor-not-allowed disabled:opacity-60'
                            )}
                          >
                            {elegido && <CheckCircle size={14} aria-hidden="true" />}
                            {new Date(slot.date + 'T00:00:00').toLocaleDateString('es-MX', { weekday: 'short', day: '2-digit', month: 'short' })} — {slot.time}
                            {vencido && ' (vencido)'}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </section>
            )}

            <FormField etiqueta="Tema de la entrevista">
              <Input
                type="text"
                value={formTopic}
                onChange={(e) => setFormTopic(e.target.value)}
                placeholder="Ej.: Entrevista técnica para…"
                disabled={!editable}
              />
            </FormField>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                etiqueta="Fecha y hora de inicio"
                requerido={editable}
                ayuda={`Dura ${selectedInterview.duration} min: el fin se calcula solo.`}
              >
                <Input
                  type="datetime-local"
                  value={formScheduledStart}
                  onChange={(e) => handleStartChange(e.target.value)}
                  disabled={!editable}
                />
              </FormField>
              <FormField etiqueta="Fecha y hora de fin" requerido={editable}>
                <Input
                  type="datetime-local"
                  value={formScheduledEnd}
                  onChange={(e) => setFormScheduledEnd(e.target.value)}
                  disabled={!editable}
                />
              </FormField>
            </div>

            {selectedInterview.type === 'presential' ? (
              <FormField
                etiqueta="Lugar"
                requerido={editable}
                ayuda="Dirección completa donde será la entrevista."
              >
                <Input
                  type="text"
                  value={formLocation}
                  onChange={(e) => setFormLocation(e.target.value)}
                  placeholder="Calle, número, colonia, ciudad"
                  prefijo={<MapPin />}
                  disabled={!editable}
                />
              </FormField>
            ) : (
              <FormField
                etiqueta="Liga de videoconferencia"
                requerido={editable}
                ayuda="Pega la liga completa, con https:// al principio (Meet, Zoom, Teams…)."
              >
                <Input
                  type="url"
                  value={formMeetingUrl}
                  onChange={(e) => setFormMeetingUrl(e.target.value)}
                  placeholder="https://meet.google.com/…"
                  prefijo={<Video />}
                  disabled={!editable}
                />
              </FormField>
            )}

            {/* Participantes */}
            <fieldset className="min-w-0">
              <legend className="text-sm font-medium text-ink">Participantes</legend>
              {formParticipants.length > 0 ? (
                <ul className="mt-2 divide-y divide-line rounded-lg border border-line">
                  {formParticipants.map((p, i) => (
                    <li key={i} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                      <span className="min-w-0">
                        <span className="font-medium text-ink">{p.nombre}</span>{' '}
                        <span className="break-all text-ink-muted">{p.email}</span>
                      </span>
                      {editable && (
                        <IconButton
                          etiqueta={`Quitar a ${p.nombre}`}
                          icono={X}
                          variante="peligro"
                          tamano="sm"
                          onClick={() => removeParticipant(i)}
                        />
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-[13px] text-ink-muted">Nadie más, por ahora.</p>
              )}
              {editable && (
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
                  <FormField etiqueta="Nombre">
                    <Input
                      type="text"
                      value={newParticipantName}
                      onChange={(e) => setNewParticipantName(e.target.value)}
                      placeholder="Nombre"
                    />
                  </FormField>
                  <FormField etiqueta="Correo">
                    <Input
                      type="email"
                      value={newParticipantEmail}
                      onChange={(e) => setNewParticipantEmail(e.target.value)}
                      placeholder="nombre@empresa.com"
                    />
                  </FormField>
                  <Button
                    variante="contorno"
                    icono={Plus}
                    onClick={addParticipant}
                    disabled={!newParticipantName.trim() || !newParticipantEmail.trim()}
                  >
                    Añadir
                  </Button>
                </div>
              )}
            </fieldset>

            <FormField etiqueta="Notas internas" ayuda="Sólo las ven los administradores.">
              <Textarea
                value={formAdminNotes}
                onChange={(e) => setFormAdminNotes(e.target.value)}
                rows={3}
                className="resize-none"
                placeholder="Notas de seguimiento…"
                disabled={!editable}
              />
            </FormField>
          </div>
        )}
      </Modal>
    </>
  );
}
