// RUTA: src/app/specialist/dashboard/page.tsx

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Briefcase,
  Users,
  Clock,
  Send,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Mail,
  Phone,
  Building2,
  FileText,
  Loader2,
  AlertCircle,
  Trash2,
  Eye,
  PlayCircle,
  RotateCcw,
  Inbox,
  Archive,
  Star,
  ExternalLink
} from 'lucide-react';
import CandidateProfileModal from '@/components/shared/CandidateProfileModal';

interface CandidateProfile {
  id?: number;
  universidad?: string;
  carrera?: string;
  nivelEstudios?: string;
  añosExperiencia?: number;
  profile?: string;
  seniority?: string;
  linkedinUrl?: string;
  portafolioUrl?: string;
  cvUrl?: string;
  telefono?: string;
  sexo?: string;
  fechaNacimiento?: string;
  source?: string;
  notas?: string;
  experiences?: any[];
}

interface Application {
  id: number;
  candidateName: string;
  candidateEmail: string;
  candidatePhone: string | null;
  status: string;
  createdAt: string;
  cvUrl: string | null;
  coverLetter?: string;
  notes?: string;
  candidateProfile?: CandidateProfile | null;
}

interface Assignment {
  id: number;
  jobId: number;
  specialistStatus: string;
  specialistNotes: string | null;
  recruiterNotes: string | null;
  candidatesSentToSpecialist: string | null;
  candidatesSentToCompany: string | null;
  applications: Application[];
  job: {
    id: number;
    title: string;
    company: string;
    location: string;
    profile: string;
    seniority: string;
    description: string;
    requirements: string;
    user: {
      nombre: string;
      companyRequest?: {
        nombreEmpresa: string;
        correoEmpresa: string;
      };
    };
  };
  recruiter?: {
    id: number;
    nombre: string;
    apellidoPaterno: string;
    email: string;
  };
}

interface Stats {
  total: number;
  pending: number;
  evaluating: number;
  sentToCompany: number;
  discarded: number;
}

type TabType = 'pending' | 'evaluating' | 'sent' | 'discarded';

export default function SpecialistDashboard() {
  const router = useRouter();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [specialist, setSpecialist] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Pestaña activa
  const [activeTab, setActiveTab] = useState<TabType>('pending');

  // Asignación expandida
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Estados de carga para acciones
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  // Modal de perfil de candidato
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);
  const [currentRecruiterNotes, setCurrentRecruiterNotes] = useState<string>('');

  // Navegación entre candidatos
  const [currentCandidatesList, setCurrentCandidatesList] = useState<Application[]>([]);
  const [currentCandidateIndex, setCurrentCandidateIndex] = useState<number>(0);

  // Pestañas configuración
  const tabs: { id: TabType; label: string; icon: React.ReactNode; color: string }[] = [
    { id: 'pending', label: 'Sin Revisar', icon: <Inbox size={18} />, color: 'yellow' },
    { id: 'evaluating', label: 'En Proceso', icon: <Clock size={18} />, color: 'purple' },
    { id: 'sent', label: 'Enviadas', icon: <Send size={18} />, color: 'green' },
    { id: 'discarded', label: 'Descartados', icon: <Archive size={18} />, color: 'gray' }
  ];

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/specialist/dashboard');

      if (response.status === 401) {
        router.push('/login?redirect=/specialist/dashboard');
        return;
      }

      if (response.status === 403) {
        setError('No tienes permisos de especialista');
        return;
      }

      const data = await response.json();

      if (data.success) {
        setAssignments(data.data.assignments);
        setStats(data.data.stats);
        setSpecialist(data.data.specialist);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Error de conexión');
    } finally {
      setIsLoading(false);
    }
  };

  // Filtrar applications por pestaña activa
  const filterApplicationsByTab = (applications: Application[]): Application[] => {
    switch (activeTab) {
      case 'pending':
        return applications.filter(app => app.status === 'sent_to_specialist');
      case 'evaluating':
        return applications.filter(app => app.status === 'evaluating');
      case 'sent':
        return applications.filter(app => app.status === 'sent_to_company');
      case 'discarded':
        return applications.filter(app => app.status === 'discarded');
      default:
        return applications;
    }
  };

  // Contar applications por tab para una vacante
  const getTabCountForJob = (applications: Application[], tab: TabType): number => {
    switch (tab) {
      case 'pending':
        return applications.filter(app => app.status === 'sent_to_specialist').length;
      case 'evaluating':
        return applications.filter(app => app.status === 'evaluating').length;
      case 'sent':
        return applications.filter(app => app.status === 'sent_to_company').length;
      case 'discarded':
        return applications.filter(app => app.status === 'discarded').length;
      default:
        return 0;
    }
  };

  // Mover candidato a otro estado
  const handleMoveApplication = async (applicationId: number, newStatus: string) => {
    try {
      setActionLoading(applicationId);
      setError(null);

      const response = await fetch('/api/specialist/dashboard', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updateApplicationId: applicationId,
          newApplicationStatus: newStatus
        })
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(data.message);
        fetchDashboard();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Error al actualizar');
    } finally {
      setActionLoading(null);
    }
  };

  const openApplicationProfile = (application: Application, recruiterNotes: string, list: Application[]) => {
    const index = list.findIndex(app => app.id === application.id);
    setSelectedApplication(application);
    setCurrentRecruiterNotes(recruiterNotes);
    setCurrentCandidatesList(list);
    setCurrentCandidateIndex(index >= 0 ? index : 0);
    setProfileModalOpen(true);
  };

  const closeProfileModal = () => {
    setProfileModalOpen(false);
    setSelectedApplication(null);
    setCurrentRecruiterNotes('');
    setCurrentCandidatesList([]);
    setCurrentCandidateIndex(0);
  };

  const goToNextCandidate = () => {
    if (currentCandidateIndex < currentCandidatesList.length - 1) {
      const nextIndex = currentCandidateIndex + 1;
      setCurrentCandidateIndex(nextIndex);
      setSelectedApplication(currentCandidatesList[nextIndex]);
    }
  };

  const goToPrevCandidate = () => {
    if (currentCandidateIndex > 0) {
      const prevIndex = currentCandidateIndex - 1;
      setCurrentCandidateIndex(prevIndex);
      setSelectedApplication(currentCandidatesList[prevIndex]);
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      sent_to_specialist: 'Por Evaluar',
      evaluating: 'En Evaluación',
      sent_to_company: 'Enviado a Empresa',
      discarded: 'Descartado'
    };
    return labels[status] || status;
  };

  // Obtener el contador correcto de la pestaña
  const getTabCount = (tab: TabType): number => {
    if (!stats) return 0;
    switch (tab) {
      case 'pending': return stats.pending;
      case 'evaluating': return stats.evaluating;
      case 'sent': return stats.sentToCompany;
      case 'discarded': return stats.discarded;
      default: return 0;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="animate-spin text-purple-600" size={40} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Dashboard Especialista
          </h1>
          <p className="text-gray-600 mt-1">
            {specialist?.specialty && (
              <span className="inline-flex items-center gap-1">
                <Star size={16} className="text-yellow-500" />
                Especialidad: {specialist.specialty}
              </span>
            )}
          </p>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
            <AlertCircle size={20} />
            {error}
            <button onClick={() => setError(null)} className="ml-auto text-xl">×</button>
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700">
            <CheckCircle size={20} />
            {success}
          </div>
        )}

        {/* Pestañas */}
        <div className="bg-white rounded-lg shadow-sm border mb-6">
          <div className="flex border-b">
            {tabs.map((tab) => {
              const count = getTabCount(tab.id);
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 px-4 py-4 flex items-center justify-center gap-2 font-medium transition-colors relative ${
                    isActive
                      ? `border-b-2`
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                  style={isActive ? {
                    color: tab.color === 'yellow' ? '#b45309' : tab.color === 'purple' ? '#7c3aed' : tab.color === 'green' ? '#15803d' : '#374151',
                    backgroundColor: tab.color === 'yellow' ? '#fef9c3' : tab.color === 'purple' ? '#f3e8ff' : tab.color === 'green' ? '#dcfce7' : '#f3f4f6',
                    borderBottomColor: tab.color === 'yellow' ? '#eab308' : tab.color === 'purple' ? '#8b5cf6' : tab.color === 'green' ? '#22c55e' : '#6b7280'
                  } : {}}
                >
                  {tab.icon}
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                    isActive
                      ? 'bg-white shadow-sm'
                      : 'bg-gray-100'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Stats resumen */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <div className="flex items-center gap-2 text-gray-500 mb-1">
                <Briefcase size={16} />
                <span className="text-sm">Vacantes</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg shadow-sm border border-yellow-200">
              <div className="flex items-center gap-2 text-yellow-600 mb-1">
                <Inbox size={16} />
                <span className="text-sm">Sin Revisar</span>
              </div>
              <p className="text-2xl font-bold text-yellow-700">{stats.pending}</p>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg shadow-sm border border-purple-200">
              <div className="flex items-center gap-2 text-purple-600 mb-1">
                <Clock size={16} />
                <span className="text-sm">Evaluando</span>
              </div>
              <p className="text-2xl font-bold text-purple-700">{stats.evaluating}</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg shadow-sm border border-green-200">
              <div className="flex items-center gap-2 text-green-600 mb-1">
                <Send size={16} />
                <span className="text-sm">Enviadas</span>
              </div>
              <p className="text-2xl font-bold text-green-700">{stats.sentToCompany}</p>
            </div>
          </div>
        )}

        {/* Lista de vacantes */}
        <div className="space-y-4">
          {assignments.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border p-12 text-center">
              <Briefcase className="mx-auto text-gray-300 mb-4" size={48} />
              <p className="text-gray-500">No tienes vacantes asignadas con candidatos</p>
            </div>
          ) : (
            assignments.map((assignment) => {
              const filteredApps = filterApplicationsByTab(assignment.applications);
              const tabCount = getTabCountForJob(assignment.applications, activeTab);

              // Solo mostrar vacantes que tienen candidatos en la pestaña activa
              if (tabCount === 0) return null;

              return (
                <div
                  key={assignment.id}
                  className="bg-white rounded-lg shadow-sm border overflow-hidden"
                >
                  {/* Header de la vacante */}
                  <div
                    className="p-4 cursor-pointer hover:bg-gray-50"
                    onClick={() => setExpandedId(expandedId === assignment.id ? null : assignment.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="font-semibold text-gray-900">
                            {assignment.job.title}
                          </h3>
                          <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                            {tabCount} candidato{tabCount !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <Building2 size={14} />
                            {assignment.job.user?.companyRequest?.nombreEmpresa || assignment.job.company}
                          </span>
                          <span>{assignment.job.location}</span>
                          {assignment.job.profile && (
                            <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">
                              {assignment.job.profile}
                            </span>
                          )}
                        </div>
                      </div>
                      {expandedId === assignment.id ? <ChevronUp /> : <ChevronDown />}
                    </div>
                  </div>

                  {/* Contenido expandido */}
                  {expandedId === assignment.id && (
                    <div className="border-t p-4">
                      {/* Notas del reclutador */}
                      {assignment.recruiterNotes && (
                        <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                          <p className="text-sm font-medium text-blue-800 mb-1 flex items-center gap-1">
                            <FileText size={14} />
                            Notas del Reclutador (solo lectura):
                          </p>
                          <p className="text-sm text-blue-700 whitespace-pre-wrap">
                            {assignment.recruiterNotes}
                          </p>
                        </div>
                      )}

                      {/* Info del reclutador */}
                      {assignment.recruiter && (
                        <div className="mb-4 p-2 bg-gray-50 rounded text-sm text-gray-600">
                          Reclutador: {assignment.recruiter.nombre} {assignment.recruiter.apellidoPaterno} ({assignment.recruiter.email})
                        </div>
                      )}

                      {/* Lista de candidatos filtrados por pestaña */}
                      <div className="border rounded-lg divide-y">
                        {filteredApps.length === 0 ? (
                          <div className="p-8 text-center text-gray-500">
                            <Users className="mx-auto mb-2 text-gray-300" size={32} />
                            No hay candidatos en esta pestaña
                          </div>
                        ) : (
                          filteredApps.map((app) => (
                            <div
                              key={app.id}
                              className="p-4 hover:bg-gray-50"
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <p className="font-medium text-gray-900">
                                      {app.candidateName}
                                    </p>
                                    <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                                      {getStatusLabel(app.status)}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                                    <span className="flex items-center gap-1">
                                      <Mail size={14} />
                                      {app.candidateEmail}
                                    </span>
                                    {app.candidatePhone && (
                                      <span className="flex items-center gap-1">
                                        <Phone size={14} />
                                        {app.candidatePhone}
                                      </span>
                                    )}
                                  </div>
                                  {app.candidateProfile && (
                                    <div className="flex items-center gap-2 mt-2">
                                      {app.candidateProfile.profile && (
                                        <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded">
                                          {app.candidateProfile.profile}
                                        </span>
                                      )}
                                      {app.candidateProfile.seniority && (
                                        <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-700 rounded">
                                          {app.candidateProfile.seniority}
                                        </span>
                                      )}
                                      {app.candidateProfile.añosExperiencia !== undefined && (
                                        <span className="text-xs text-gray-500">
                                          {app.candidateProfile.añosExperiencia} años exp.
                                        </span>
                                      )}
                                      {app.candidateProfile.universidad && (
                                        <span className="text-xs text-gray-500">
                                          {app.candidateProfile.universidad}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                  {/* Links rápidos */}
                                  <div className="flex items-center gap-3 mt-2">
                                    {(app.cvUrl || app.candidateProfile?.cvUrl) && (
                                      <a
                                        href={app.cvUrl || app.candidateProfile?.cvUrl || '#'}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                                      >
                                        <FileText size={12} />
                                        Ver CV
                                      </a>
                                    )}
                                    {app.candidateProfile?.linkedinUrl && (
                                      <a
                                        href={app.candidateProfile.linkedinUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                                      >
                                        <ExternalLink size={12} />
                                        LinkedIn
                                      </a>
                                    )}
                                  </div>
                                </div>

                                {/* Acciones */}
                                <div className="flex items-center gap-2">
                                  {/* Ver perfil */}
                                  <button
                                    onClick={() => openApplicationProfile(app, assignment.recruiterNotes || '', filteredApps)}
                                    className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                                    title="Ver perfil completo"
                                  >
                                    <Eye size={18} />
                                  </button>

                                  {/* Acciones según pestaña */}
                                  {activeTab === 'pending' && (
                                    <>
                                      <button
                                        onClick={() => handleMoveApplication(app.id, 'evaluating')}
                                        disabled={actionLoading === app.id}
                                        className="px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-1 text-sm"
                                        title="Iniciar evaluación"
                                      >
                                        {actionLoading === app.id ? (
                                          <Loader2 size={14} className="animate-spin" />
                                        ) : (
                                          <PlayCircle size={14} />
                                        )}
                                        Evaluar
                                      </button>
                                      <button
                                        onClick={() => handleMoveApplication(app.id, 'discarded')}
                                        disabled={actionLoading === app.id}
                                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                        title="Descartar"
                                      >
                                        <Trash2 size={18} />
                                      </button>
                                    </>
                                  )}

                                  {activeTab === 'evaluating' && (
                                    <>
                                      <button
                                        onClick={() => handleMoveApplication(app.id, 'sent_to_company')}
                                        disabled={actionLoading === app.id}
                                        className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-1 text-sm"
                                        title="Enviar a empresa"
                                      >
                                        {actionLoading === app.id ? (
                                          <Loader2 size={14} className="animate-spin" />
                                        ) : (
                                          <Send size={14} />
                                        )}
                                        Enviar
                                      </button>
                                      <button
                                        onClick={() => handleMoveApplication(app.id, 'discarded')}
                                        disabled={actionLoading === app.id}
                                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                        title="Descartar"
                                      >
                                        <Trash2 size={18} />
                                      </button>
                                    </>
                                  )}

                                  {activeTab === 'sent' && (
                                    <span className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-sm flex items-center gap-1">
                                      <CheckCircle size={14} />
                                      Enviado
                                    </span>
                                  )}

                                  {activeTab === 'discarded' && (
                                    <button
                                      onClick={() => handleMoveApplication(app.id, 'evaluating')}
                                      disabled={actionLoading === app.id}
                                      className="px-3 py-1.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 flex items-center gap-1 text-sm"
                                      title="Reactivar candidato"
                                    >
                                      {actionLoading === app.id ? (
                                        <Loader2 size={14} className="animate-spin" />
                                      ) : (
                                        <RotateCcw size={14} />
                                      )}
                                      Reactivar
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}

          {/* Mensaje si no hay vacantes con candidatos en esta pestaña */}
          {assignments.length > 0 &&
           assignments.every(a => getTabCountForJob(a.applications, activeTab) === 0) && (
            <div className="bg-white rounded-lg shadow-sm border p-12 text-center">
              <Users className="mx-auto text-gray-300 mb-4" size={48} />
              <p className="text-gray-500">
                No hay candidatos en la pestaña "{tabs.find(t => t.id === activeTab)?.label}"
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modal de perfil de candidato */}
      <CandidateProfileModal
        application={selectedApplication}
        candidate={null}
        isOpen={profileModalOpen}
        onClose={closeProfileModal}
        recruiterNotes={currentRecruiterNotes}
        showRecruiterNotes={true}
        onNext={currentCandidatesList.length > 1 ? goToNextCandidate : undefined}
        onPrev={currentCandidatesList.length > 1 ? goToPrevCandidate : undefined}
        currentIndex={currentCandidateIndex}
        totalCount={currentCandidatesList.length}
      />
    </div>
  );
}
