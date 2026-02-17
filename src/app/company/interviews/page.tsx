// RUTA: src/app/company/interviews/page.tsx

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Calendar,
  Clock,
  Video,
  MapPin,
  ChevronLeft,
  Loader2,
  AlertCircle,
  CheckCircle,
  Briefcase,
  User,
  ExternalLink,
  MessageSquare
} from 'lucide-react';

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
}

export default function CompanyInterviewsPage() {
  const router = useRouter();
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

  const tabData: Record<TabType, { label: string; interviews: InterviewRequest[]; color: string }> = {
    pending: { label: 'Pendientes', interviews: pendingInterviews, color: 'yellow' },
    scheduled: { label: 'Agendadas', interviews: scheduledInterviews, color: 'green' },
    past: { label: 'Pasadas', interviews: pastInterviews, color: 'gray' },
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

  const getStatusBadge = (interview: InterviewRequest) => {
    if (interview.status === 'pending') {
      return <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">En coordinación</span>;
    }
    if (interview.status === 'confirmed') {
      if (interview.scheduledStart && new Date(interview.scheduledStart) < now) {
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700">Realizada</span>;
      }
      return <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">Confirmada</span>;
    }
    if (interview.status === 'cancelled') {
      return <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">Cancelada</span>;
    }
    if (interview.status === 'rejected') {
      return <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700">Rechazada</span>;
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-3 mb-2">
            <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-700">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <Calendar className="w-6 h-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">Mis Entrevistas</h1>
          </div>
          <p className="text-gray-500 ml-8">Seguimiento de tus solicitudes de entrevista</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b">
          {(Object.keys(tabData) as TabType[]).map(tab => {
            const count = tabData[tab].interviews.length;
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  isActive
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tabData[tab].label}
                {count > 0 && (
                  <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${
                    isActive ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            <span className="ml-2 text-gray-500">Cargando entrevistas...</span>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <p className="text-red-700">{error}</p>
          </div>
        ) : currentInterviews.length === 0 ? (
          <div className="text-center py-20">
            <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">No hay entrevistas {tabData[activeTab].label.toLowerCase()}</p>
            <p className="text-gray-400 text-sm mt-1">
              {activeTab === 'pending'
                ? 'Cuando solicites una entrevista desde el pipeline de candidatos, aparecerá aquí.'
                : activeTab === 'scheduled'
                ? 'Las entrevistas confirmadas por INAKAT aparecerán aquí.'
                : 'Las entrevistas pasadas y canceladas aparecerán aquí.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {currentInterviews.map(interview => (
              <div key={interview.id} className="bg-white rounded-lg shadow-sm border p-5 hover:shadow-md transition-shadow">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  {/* Left: Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <User className="w-4 h-4 text-gray-400" />
                      <span className="font-semibold text-gray-900">{interview.application.candidateName}</span>
                      {getStatusBadge(interview)}
                    </div>

                    <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                      <Briefcase className="w-3.5 h-3.5" />
                      <span>{interview.application.job.title}</span>
                    </div>

                    {interview.topic && (
                      <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>{interview.topic}</span>
                      </div>
                    )}

                    {/* Pending: show coordination message */}
                    {interview.status === 'pending' && (
                      <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                        <p className="text-sm text-yellow-800">
                          Tu solicitud está siendo coordinada por <strong>INAKAT</strong>. Te notificaremos cuando se confirme la fecha y hora.
                        </p>
                        <p className="text-xs text-yellow-600 mt-1">
                          Solicitada el {formatDate(interview.createdAt)}
                        </p>
                      </div>
                    )}

                    {/* Confirmed/Past: show schedule details */}
                    {interview.status === 'confirmed' && interview.scheduledStart && (
                      <div className="mt-3 space-y-2">
                        <div className="flex items-center gap-4 flex-wrap">
                          <div className="flex items-center gap-1.5 text-sm">
                            <Calendar className="w-4 h-4 text-blue-500" />
                            <span className="font-medium text-gray-800">{formatDate(interview.scheduledStart)}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-sm">
                            <Clock className="w-4 h-4 text-blue-500" />
                            <span className="text-gray-700">
                              {formatTime(interview.scheduledStart)}
                              {interview.scheduledEnd && ` - ${formatTime(interview.scheduledEnd)}`}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-sm">
                            {interview.type === 'videocall' ? (
                              <Video className="w-4 h-4 text-purple-500" />
                            ) : (
                              <MapPin className="w-4 h-4 text-green-500" />
                            )}
                            <span className="text-gray-600">
                              {interview.type === 'videocall' ? 'Videoconferencia' : 'Presencial'}
                            </span>
                          </div>
                        </div>

                        {/* Meeting URL */}
                        {interview.type === 'videocall' && interview.meetingUrl && (
                          <a
                            href={interview.meetingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            Unirse a la videoconferencia
                          </a>
                        )}

                        {/* Location */}
                        {interview.type === 'presential' && interview.location && (
                          <div className="flex items-center gap-1.5 text-sm text-gray-600">
                            <MapPin className="w-3.5 h-3.5" />
                            <span>{interview.location}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Cancelled */}
                    {interview.status === 'cancelled' && (
                      <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3">
                        <p className="text-sm text-red-700">Esta entrevista fue cancelada.</p>
                      </div>
                    )}
                  </div>

                  {/* Right: Date badge for scheduled interviews */}
                  {interview.status === 'confirmed' && interview.scheduledStart && new Date(interview.scheduledStart) >= now && (
                    <div className="flex-shrink-0 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-center min-w-[100px]">
                      <div className="text-2xl font-bold text-blue-700">
                        {new Date(interview.scheduledStart).getDate()}
                      </div>
                      <div className="text-xs font-medium text-blue-600 uppercase">
                        {new Date(interview.scheduledStart).toLocaleDateString('es-MX', { month: 'short' })}
                      </div>
                      <div className="text-xs text-blue-500 mt-0.5">
                        {formatTime(interview.scheduledStart)}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
