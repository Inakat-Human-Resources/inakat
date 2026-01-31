// RUTA: src/app/company/jobs/[jobId]/candidates/page.tsx

'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronRight,
  Users,
  Clock,
  UserCheck,
  XCircle,
  Briefcase,
  Heart,
  Trash2,
  AlertCircle,
  ArrowLeft,
  MapPin,
  Building,
  Calendar,
  MessageSquare
} from 'lucide-react';
import CandidateProfileModal from '@/components/shared/CandidateProfileModal';

// Tipos
interface Job {
  id: number;
  title: string;
  company: string;
  location: string;
  salary: string;
  status: string;
  profile?: string;
  seniority?: string;
  createdAt: string;
}

interface Application {
  id: number;
  candidateName: string;
  candidateEmail: string;
  candidatePhone?: string;
  status: string;
  createdAt: string;
  cvUrl?: string;
  candidateProfile?: {
    id?: number;
    profile?: string;
    seniority?: string;
    universidad?: string;
    carrera?: string;
    nivelEstudios?: string;
    telefono?: string;
    linkedinUrl?: string;
    portafolioUrl?: string;
    cvUrl?: string;
    experiences?: any[];
    documents?: any[];
  };
}

type TabKey = 'new' | 'in_process' | 'rejected' | 'hiring';

interface TabConfig {
  key: TabKey;
  label: string;
  statuses: string[];
  icon: React.ElementType;
  color: string;
  bgColor: string;
}

const TABS: TabConfig[] = [
  {
    key: 'new',
    label: 'Candidatos',
    statuses: ['sent_to_company'],
    icon: Users,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100'
  },
  {
    key: 'in_process',
    label: 'En Proceso',
    statuses: ['company_interested', 'interviewed'],
    icon: Clock,
    color: 'text-purple-600',
    bgColor: 'bg-purple-100'
  },
  {
    key: 'rejected',
    label: 'Rechazados',
    statuses: ['rejected'],
    icon: XCircle,
    color: 'text-red-600',
    bgColor: 'bg-red-100'
  },
  {
    key: 'hiring',
    label: 'En Contratación',
    statuses: ['accepted'],
    icon: UserCheck,
    color: 'text-green-600',
    bgColor: 'bg-green-100'
  }
];

export default function JobCandidatesPage() {
  const router = useRouter();
  const params = useParams();
  const jobId = params.jobId as string;

  const [job, setJob] = useState<Job | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('new');

  // Modal de ficha de candidato
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);
  const [showCandidateProfile, setShowCandidateProfile] = useState(false);
  const [candidateIndex, setCandidateIndex] = useState(0);

  // Notificación
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });

  useEffect(() => {
    if (jobId) {
      fetchData();
    }
  }, [jobId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/company/jobs/${jobId}/candidates`);

      if (response.status === 401) {
        router.push('/login?redirect=/company/dashboard');
        return;
      }

      if (response.status === 403) {
        setError('No tienes permisos para ver esta vacante');
        return;
      }

      if (response.status === 404) {
        setError('Vacante no encontrada');
        return;
      }

      if (!response.ok) {
        throw new Error('Error al cargar datos');
      }

      const result = await response.json();

      if (result.success) {
        setJob(result.data.job);
        setApplications(result.data.applications);
      } else {
        setError(result.error || 'Error desconocido');
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  // Filtrar candidatos por tab activa
  const getFilteredCandidates = (tabKey: TabKey) => {
    const tab = TABS.find(t => t.key === tabKey);
    if (!tab) return [];
    return applications.filter(app => tab.statuses.includes(app.status));
  };

  const filteredCandidates = getFilteredCandidates(activeTab);

  // Contar candidatos por tab
  const getCandidateCount = (tabKey: TabKey) => {
    return getFilteredCandidates(tabKey).length;
  };

  // Abrir ficha de candidato
  const handleViewCandidateProfile = (application: Application, index: number) => {
    setSelectedApplication(application);
    setCandidateIndex(index);
    setShowCandidateProfile(true);
  };

  // Navegación entre candidatos
  const handleNextCandidate = () => {
    if (candidateIndex < filteredCandidates.length - 1) {
      const newIndex = candidateIndex + 1;
      setCandidateIndex(newIndex);
      setSelectedApplication(filteredCandidates[newIndex]);
    }
  };

  const handlePrevCandidate = () => {
    if (candidateIndex > 0) {
      const newIndex = candidateIndex - 1;
      setCandidateIndex(newIndex);
      setSelectedApplication(filteredCandidates[newIndex]);
    }
  };

  // Acciones sobre candidatos
  const handleCandidateAction = async (
    applicationId: number,
    action: 'company_interested' | 'interviewed' | 'accepted' | 'rejected',
    candidateName: string
  ) => {
    const confirmMessages: Record<string, string> = {
      company_interested: `¿Marcar a ${candidateName} como "Me interesa"?`,
      interviewed: `¿Marcar a ${candidateName} como "Entrevistado"?`,
      rejected: `¿Descartar a ${candidateName}? Esta acción no se puede deshacer.`,
      accepted: `¿Iniciar proceso de contratación con ${candidateName}?`
    };

    if (!confirm(confirmMessages[action])) return;

    let closeJob = false;
    if (action === 'accepted') {
      closeJob = confirm('¿Deseas cerrar la vacante? Esto significa que ya no recibirás más candidatos.');
    }

    try {
      const response = await fetch(`/api/company/applications/${applicationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: action, closeJob })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setNotification({ type: 'success', message: result.message });
        fetchData();
        if (result.jobClosed) {
          router.push('/company/dashboard');
        }
      } else {
        setNotification({ type: 'error', message: result.error || 'Error al actualizar candidato' });
      }
    } catch (error) {
      console.error('Error updating candidate:', error);
      setNotification({ type: 'error', message: 'Error al actualizar candidato' });
    }
  };

  // Obtener badge de estado
  const getStatusBadge = (status: string) => {
    const badges: Record<string, { bg: string; text: string; label: string }> = {
      sent_to_company: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Por revisar' },
      company_interested: { bg: 'bg-pink-100', text: 'text-pink-700', label: 'Me interesa' },
      interviewed: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Entrevistado' },
      accepted: { bg: 'bg-green-100', text: 'text-green-700', label: 'En contratación' },
      rejected: { bg: 'bg-red-100', text: 'text-red-700', label: 'Descartado' }
    };

    const badge = badges[status] || { bg: 'bg-gray-100', text: 'text-gray-700', label: status };

    return (
      <span className={`px-3 py-1 text-xs font-medium rounded-full ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-custom-beige">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-button-orange mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando candidatos...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-custom-beige">
        <div className="text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => router.push('/company/dashboard')}
            className="px-6 py-2 bg-button-orange text-white rounded-lg hover:bg-opacity-90 transition-colors"
          >
            Volver al Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-custom-beige py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-gray-600 mb-6">
          <Link href="/company/dashboard" className="hover:text-button-orange transition-colors">
            Dashboard
          </Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-gray-900 font-medium">{job?.title}</span>
          <ChevronRight className="w-4 h-4" />
          <span className="text-gray-900 font-medium">Candidatos</span>
        </nav>

        {/* Notificación */}
        {notification.type && (
          <div
            className={`mb-6 p-4 rounded-lg flex items-center justify-between ${
              notification.type === 'success'
                ? 'bg-green-100 text-green-800 border border-green-300'
                : 'bg-red-100 text-red-800 border border-red-300'
            }`}
          >
            <span>{notification.message}</span>
            <button
              onClick={() => setNotification({ type: null, message: '' })}
              className="ml-4 hover:opacity-70 text-xl"
            >
              ×
            </button>
          </div>
        )}

        {/* Header con info de la vacante - Responsive */}
        <div className="bg-white rounded-lg shadow-md p-4 md:p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="flex items-start gap-3 md:gap-4">
              <button
                onClick={() => router.push('/company/dashboard')}
                className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors flex-shrink-0"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div className="min-w-0">
                <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">{job?.title}</h1>
                <div className="flex flex-wrap items-center gap-2 md:gap-4 text-sm text-gray-600">
                  <span className="flex items-center gap-1">
                    <Building className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{job?.company}</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{job?.location}</span>
                  </span>
                  <span className="hidden sm:flex items-center gap-1">
                    <Briefcase className="w-4 h-4 flex-shrink-0" />
                    {job?.salary}
                  </span>
                  {job?.profile && (
                    <span className="px-2 py-1 bg-[#e8f4f4] text-[#2b5d62] rounded text-xs font-medium">
                      {job.profile}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between md:justify-end md:text-right bg-orange-50 md:bg-transparent rounded-lg p-3 md:p-0">
              <p className="text-sm text-gray-500 md:mb-0">Total de candidatos</p>
              <p className="text-2xl md:text-3xl font-bold text-button-orange ml-3 md:ml-0">{applications.length}</p>
            </div>
          </div>
        </div>

        {/* Tabs - Responsive */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="border-b border-gray-200 overflow-x-auto">
            <div className="flex min-w-max md:min-w-0">
              {TABS.map((tab) => {
                const count = getCandidateCount(tab.key);
                const Icon = tab.icon;
                const isActive = activeTab === tab.key;

                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex items-center gap-1.5 md:gap-2 px-3 md:px-6 py-3 md:py-4 text-xs md:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                      isActive
                        ? 'border-button-orange text-button-orange bg-orange-50'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="w-4 h-4 md:w-5 md:h-5" />
                    <span className="hidden sm:inline">{tab.label}</span>
                    <span className={`px-1.5 md:px-2 py-0.5 text-xs rounded-full ${
                      isActive ? 'bg-button-orange text-white' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Lista de candidatos */}
          <div className="p-4 md:p-6">
            {filteredCandidates.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-12 h-12 md:w-16 md:h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 text-base md:text-lg font-medium">
                  No hay candidatos en esta categoría
                </p>
                <p className="text-gray-400 text-sm mt-2 px-4">
                  {activeTab === 'new' && 'Los candidatos aparecerán aquí cuando el especialista los envíe'}
                  {activeTab === 'in_process' && 'Marca candidatos como "Me interesa" para verlos aquí'}
                  {activeTab === 'rejected' && 'Los candidatos descartados aparecerán aquí'}
                  {activeTab === 'hiring' && 'Los candidatos en proceso de contratación aparecerán aquí'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredCandidates.map((app, index) => (
                  <div
                    key={app.id}
                    className="border border-gray-200 rounded-lg p-3 md:p-4 hover:border-blue-300 hover:shadow-md transition-all bg-white"
                  >
                    {/* Layout responsive del candidato */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      {/* Info del candidato */}
                      <div
                        className="flex items-center gap-3 md:gap-4 flex-1 cursor-pointer min-w-0"
                        onClick={() => handleViewCandidateProfile(app, index)}
                      >
                        <div className="w-10 h-10 md:w-12 md:h-12 bg-[#2b5d62] text-white rounded-full flex items-center justify-center text-base md:text-lg font-bold flex-shrink-0">
                          {app.candidateName?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-gray-900 truncate text-sm md:text-base">{app.candidateName}</h3>
                          <p className="text-xs md:text-sm text-gray-500 truncate">{app.candidateEmail}</p>
                          <div className="flex items-center gap-1.5 md:gap-2 mt-1 flex-wrap">
                            {app.candidateProfile?.profile && (
                              <span className="inline-block px-1.5 md:px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">
                                {app.candidateProfile.profile}
                              </span>
                            )}
                            {app.candidateProfile?.seniority && (
                              <span className="inline-block px-1.5 md:px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                                {app.candidateProfile.seniority}
                              </span>
                            )}
                            {app.candidateProfile?.universidad && (
                              <span className="hidden md:inline-block px-2 py-0.5 text-xs bg-purple-100 text-purple-600 rounded">
                                {app.candidateProfile.universidad}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Estado y acciones - responsive */}
                      <div className="flex items-center justify-between sm:justify-end gap-3 md:gap-4 pl-13 sm:pl-0">
                        <div className="text-left sm:text-right">
                          <p className="text-xs text-gray-400 flex items-center gap-1 sm:justify-end">
                            <Calendar className="w-3 h-3" />
                            {formatDate(app.createdAt)}
                          </p>
                          <div className="mt-1">{getStatusBadge(app.status)}</div>
                        </div>
                        <button
                          onClick={() => handleViewCandidateProfile(app, index)}
                          className="text-blue-600 text-sm font-medium hover:underline whitespace-nowrap"
                        >
                          Ver ficha →
                        </button>
                      </div>
                    </div>

                    {/* Botones de acción - responsive wrap */}
                    {app.status !== 'accepted' && app.status !== 'rejected' && (
                      <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2 mt-4 pt-3 border-t border-gray-100">
                        {/* Descartar */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCandidateAction(app.id, 'rejected', app.candidateName);
                          }}
                          className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-1"
                          title="Descartar candidato"
                        >
                          <Trash2 className="w-4 h-4" />
                          Descartar
                        </button>

                        {/* Me interesa - Solo si está en sent_to_company */}
                        {app.status === 'sent_to_company' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCandidateAction(app.id, 'company_interested', app.candidateName);
                            }}
                            className="px-3 py-1.5 text-sm text-pink-600 hover:bg-pink-50 rounded-lg transition-colors flex items-center gap-1"
                            title="Marcar como Me interesa"
                          >
                            <Heart className="w-4 h-4" />
                            Me interesa
                          </button>
                        )}

                        {/* Entrevistado - Solo si está en company_interested */}
                        {app.status === 'company_interested' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCandidateAction(app.id, 'interviewed', app.candidateName);
                            }}
                            className="px-3 py-1.5 text-sm text-purple-600 hover:bg-purple-50 rounded-lg transition-colors flex items-center gap-1"
                            title="Marcar como Entrevistado"
                          >
                            <MessageSquare className="w-4 h-4" />
                            Entrevistado
                          </button>
                        )}

                        {/* Contratar */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCandidateAction(app.id, 'accepted', app.candidateName);
                          }}
                          className="px-3 py-1.5 text-sm text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors flex items-center gap-1 font-medium"
                          title="Iniciar proceso de contratación"
                        >
                          <UserCheck className="w-4 h-4" />
                          Contratar
                        </button>
                      </div>
                    )}

                    {/* Mensaje para estados finales */}
                    {app.status === 'accepted' && (
                      <div className="mt-3 pt-3 border-t border-gray-100 text-center">
                        <span className="text-sm text-green-600 font-medium">
                          ✓ En proceso de contratación
                        </span>
                      </div>
                    )}
                    {app.status === 'rejected' && (
                      <div className="mt-3 pt-3 border-t border-gray-100 text-center">
                        <span className="text-sm text-gray-400 italic">
                          Candidato descartado
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Ficha de Candidato */}
      <CandidateProfileModal
        application={selectedApplication}
        isOpen={showCandidateProfile}
        onClose={() => setShowCandidateProfile(false)}
        onNext={handleNextCandidate}
        onPrev={handlePrevCandidate}
        currentIndex={candidateIndex}
        totalCount={filteredCandidates.length}
      />
    </div>
  );
}
