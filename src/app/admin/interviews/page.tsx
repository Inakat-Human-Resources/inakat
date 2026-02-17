// RUTA: src/app/admin/interviews/page.tsx

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Calendar,
  Clock,
  Video,
  MapPin,
  Users,
  ChevronLeft,
  Loader2,
  X,
  Save,
  AlertCircle,
  CheckCircle,
  XCircle,
  Building,
  Briefcase,
  MessageSquare,
  Link as LinkIcon,
  ExternalLink
} from 'lucide-react';

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

export default function AdminInterviewsPage() {
  const router = useRouter();
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

  const fetchInterviews = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/interviews');
      const data = await res.json();
      if (data.success) {
        setInterviews(data.data);
      } else {
        setError(data.error || 'Error al cargar entrevistas');
      }
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

    setSaving(true);
    setModalError('');

    try {
      const body: Record<string, unknown> = {
        topic: formTopic || null,
        scheduledStart: formScheduledStart ? new Date(formScheduledStart).toISOString() : null,
        scheduledEnd: formScheduledEnd ? new Date(formScheduledEnd).toISOString() : null,
        location: formLocation || null,
        meetingUrl: formMeetingUrl || null,
        adminNotes: formAdminNotes || null,
        participants: JSON.stringify(formParticipants),
      };

      if (newStatus) {
        body.status = newStatus;
      }

      const res = await fetch(`/api/admin/interviews/${selectedInterview.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await res.json();
      if (data.success) {
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

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });

  const formatDateTime = (iso: string) =>
    new Date(iso).toLocaleString('es-MX', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });

  const getCompanyName = (interview: InterviewRequest) =>
    interview.requestedBy?.companyRequest?.nombreEmpresa ||
    interview.application.job.company;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pt-24 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-24 pb-12">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Link href="/admin" className="text-gray-400 hover:text-gray-600">
            <ChevronLeft className="w-6 h-6" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Gestión de Entrevistas</h1>
            <p className="text-gray-500 text-sm">Coordina y agenda entrevistas entre empresas y candidatos</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b bg-white rounded-t-lg overflow-x-auto">
          {([
            { key: 'pending' as TabType, label: 'Pendientes', icon: Clock, color: 'text-amber-600' },
            { key: 'confirmed' as TabType, label: 'Agendadas', icon: CheckCircle, color: 'text-green-600' },
            { key: 'expired' as TabType, label: 'Pasadas', icon: Calendar, color: 'text-gray-500' },
            { key: 'cancelled' as TabType, label: 'Canceladas', icon: XCircle, color: 'text-red-500' },
          ]).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? `${tab.color} border-current bg-gray-50`
                  : 'text-gray-500 border-transparent hover:text-gray-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tabCounts[tab.key] > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                  activeTab === tab.key ? 'bg-current/10' : 'bg-gray-100'
                }`}>
                  {tabCounts[tab.key]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        {filteredInterviews.length === 0 ? (
          <div className="bg-white rounded-lg p-12 text-center">
            <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No hay entrevistas en esta categoría.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredInterviews.map(interview => (
              <div key={interview.id} className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-sm transition-shadow">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  {/* Left: Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-gray-900">{interview.application.candidateName}</span>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                        interview.type === 'videocall'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-orange-100 text-orange-700'
                      }`}>
                        {interview.type === 'videocall' ? 'Videollamada' : 'Presencial'}
                      </span>
                      <span className="text-xs text-gray-400">{interview.duration} min</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
                      <span className="flex items-center gap-1">
                        <Building className="w-3.5 h-3.5" />
                        {getCompanyName(interview)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Briefcase className="w-3.5 h-3.5" />
                        {interview.application.job.title}
                      </span>
                    </div>

                    {/* Scheduled time */}
                    {interview.scheduledStart && (
                      <div className="flex items-center gap-1 mt-1 text-sm font-medium text-green-700">
                        <Calendar className="w-3.5 h-3.5" />
                        {formatDateTime(interview.scheduledStart)}
                        {interview.location && (
                          <span className="ml-2 flex items-center gap-1 text-gray-500 font-normal">
                            <MapPin className="w-3.5 h-3.5" /> {interview.location}
                          </span>
                        )}
                        {interview.meetingUrl && (
                          <a
                            href={interview.meetingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-2 flex items-center gap-1 text-blue-600 font-normal hover:underline"
                          >
                            <Video className="w-3.5 h-3.5" /> Liga VC
                          </a>
                        )}
                      </div>
                    )}

                    {interview.topic && (
                      <p className="text-xs text-gray-500 mt-1">Tema: {interview.topic}</p>
                    )}

                    <p className="text-xs text-gray-400 mt-1">Solicitado: {formatDate(interview.createdAt)}</p>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex gap-2 flex-shrink-0">
                    {activeTab === 'pending' && (
                      <button
                        onClick={() => openScheduleModal(interview)}
                        className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors flex items-center gap-1"
                      >
                        <Calendar className="w-4 h-4" />
                        Agendar
                      </button>
                    )}
                    {activeTab === 'confirmed' && (
                      <button
                        onClick={() => openScheduleModal(interview)}
                        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1"
                      >
                        Editar
                      </button>
                    )}
                    {(activeTab === 'expired' || activeTab === 'cancelled') && (
                      <button
                        onClick={() => openScheduleModal(interview)}
                        className="px-3 py-2 border border-gray-300 text-gray-600 text-sm rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        Ver detalle
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Schedule / Edit Modal */}
      {modalOpen && selectedInterview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b p-4 flex justify-between items-start rounded-t-xl">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  {selectedInterview.status === 'pending' ? 'Agendar Entrevista' : 'Detalle de Entrevista'}
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {selectedInterview.application.candidateName} — {getCompanyName(selectedInterview)}
                </p>
                <p className="text-xs text-gray-400">
                  Vacante: {selectedInterview.application.job.title}
                </p>
              </div>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1">
                <X size={20} />
              </button>
            </div>

            <div className="p-4 space-y-5">
              {modalError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {modalError}
                </div>
              )}

              {/* Proposed slots */}
              {selectedInterview.availableSlots && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Horarios propuestos por la empresa
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {(() => {
                      try {
                        const slots = JSON.parse(selectedInterview.availableSlots);
                        return slots.map((slot: { date: string; time: string }, i: number) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => selectSlot(slot)}
                            className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-green-50 hover:border-green-400 transition-colors"
                          >
                            {new Date(slot.date + 'T00:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })} — {slot.time}
                          </button>
                        ));
                      } catch {
                        return <span className="text-xs text-gray-400">Sin horarios</span>;
                      }
                    })()}
                  </div>
                </div>
              )}

              {/* Topic */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Tema de la entrevista</label>
                <input
                  type="text"
                  value={formTopic}
                  onChange={(e) => setFormTopic(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  placeholder="Ej: Entrevista técnica para..."
                />
              </div>

              {/* Date/time */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Fecha y hora inicio *</label>
                  <input
                    type="datetime-local"
                    value={formScheduledStart}
                    onChange={(e) => handleStartChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Fecha y hora fin *</label>
                  <input
                    type="datetime-local"
                    value={formScheduledEnd}
                    onChange={(e) => setFormScheduledEnd(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                </div>
              </div>

              {/* Location or Meeting URL */}
              {selectedInterview.type === 'presential' ? (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    <MapPin className="w-4 h-4 inline mr-1" />Lugar
                  </label>
                  <input
                    type="text"
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    placeholder="Dirección del lugar de entrevista"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    <Video className="w-4 h-4 inline mr-1" />Liga de videoconferencia
                  </label>
                  <input
                    type="url"
                    value={formMeetingUrl}
                    onChange={(e) => setFormMeetingUrl(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    placeholder="https://meet.google.com/... o https://zoom.us/..."
                  />
                </div>
              )}

              {/* Participants */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <Users className="w-4 h-4 inline mr-1" />Participantes
                </label>
                {formParticipants.length > 0 && (
                  <div className="space-y-1 mb-2">
                    {formParticipants.map((p, i) => (
                      <div key={i} className="flex items-center justify-between bg-gray-50 px-3 py-1.5 rounded text-sm">
                        <span>{p.nombre} ({p.email})</span>
                        <button type="button" onClick={() => removeParticipant(i)} className="text-red-400 hover:text-red-600">
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newParticipantName}
                    onChange={(e) => setNewParticipantName(e.target.value)}
                    placeholder="Nombre"
                    className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                  />
                  <input
                    type="email"
                    value={newParticipantEmail}
                    onChange={(e) => setNewParticipantEmail(e.target.value)}
                    placeholder="Email"
                    className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                  />
                  <button
                    type="button"
                    onClick={addParticipant}
                    disabled={!newParticipantName.trim() || !newParticipantEmail.trim()}
                    className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-300 disabled:opacity-50"
                  >
                    Añadir
                  </button>
                </div>
              </div>

              {/* Company message */}
              {selectedInterview.message && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    <MessageSquare className="w-4 h-4 inline mr-1" />Mensaje de la empresa
                  </label>
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-gray-700">
                    {selectedInterview.message}
                  </div>
                </div>
              )}

              {/* Admin notes */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Notas internas (solo admin)</label>
                <textarea
                  value={formAdminNotes}
                  onChange={(e) => setFormAdminNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  placeholder="Notas de seguimiento..."
                />
              </div>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-gray-50 border-t p-4 flex flex-col sm:flex-row justify-between items-center gap-3 rounded-b-xl">
              {selectedInterview.status === 'pending' && (
                <button
                  type="button"
                  onClick={() => handleSave('cancelled')}
                  disabled={saving}
                  className="px-4 py-2 border border-red-300 text-red-600 rounded-lg text-sm hover:bg-red-50 disabled:opacity-50"
                >
                  Cancelar solicitud
                </button>
              )}
              {selectedInterview.status !== 'pending' && <div />}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50"
                >
                  Cerrar
                </button>

                {(selectedInterview.status === 'pending' || selectedInterview.status === 'confirmed') && (
                  <>
                    {selectedInterview.status === 'confirmed' && (
                      <button
                        type="button"
                        onClick={() => handleSave(null)}
                        disabled={saving}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
                      >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Guardar Cambios
                      </button>
                    )}
                    {selectedInterview.status === 'pending' && (
                      <button
                        type="button"
                        onClick={() => handleSave('confirmed')}
                        disabled={saving}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 flex items-center gap-1"
                      >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                        Confirmar Entrevista
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
