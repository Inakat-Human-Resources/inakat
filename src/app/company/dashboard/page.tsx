// RUTA: src/app/company/dashboard/page.tsx

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Briefcase,
  Users,
  XCircle,
  AlertCircle,
  Coins,
  Heart,
  Trash2,
  UserCheck
} from 'lucide-react';
import CompanyJobsTable from '@/components/company/CompanyJobsTable';
import JobDetailModal from '@/components/company/JobDetailModal';
import CandidateProfileModal from '@/components/shared/CandidateProfileModal';

interface Job {
  id: number;
  title: string;
  company: string;
  location: string;
  salary: string;
  jobType: string;
  workMode: string;
  description: string;
  requirements?: string;
  status: string;
  profile?: string;
  seniority?: string;
  createdAt: string;
  expiresAt?: string;
  applicationCount?: number;
  _count?: {
    applications: number;
  };
}

interface DashboardData {
  company: {
    userId: number;
    userName: string;
    email: string;
    credits: number;
    companyInfo: {
      nombreEmpresa: string;
      correoEmpresa: string;
      sitioWeb?: string;
      rfc: string;
      direccionEmpresa: string;
    };
  };
  stats: {
    jobs: {
      total: number;
      active: number;
      paused: number;
      expired: number;
      closed: number;
      draft: number;
    };
    applications: {
      total: number;
      pendingReview: number; // Candidatos por revisar (sent_to_company)
      interested: number; // Candidatos marcados "Me interesa"
      interviewed: number;
      accepted: number;
      rejected: number;
    };
  };
  recentApplications: any[];
  allApplications: any[];
  jobStats: any[];
  allJobs: Job[];
}

export default function CompanyDashboard() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [showJobModal, setShowJobModal] = useState(false);

  // Modal de candidatos por vacante
  const [showCandidatesModal, setShowCandidatesModal] = useState(false);
  const [selectedJobForCandidates, setSelectedJobForCandidates] = useState<{ id: number; title: string } | null>(null);

  // Modal de ficha de candidato individual
  const [selectedApplication, setSelectedApplication] = useState<any | null>(null);
  const [showCandidateProfile, setShowCandidateProfile] = useState(false);
  const [candidateIndex, setCandidateIndex] = useState(0);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const response = await fetch('/api/company/dashboard');

      if (response.status === 401) {
        router.push('/login?redirect=/company/dashboard');
        return;
      }

      if (response.status === 403) {
        setError('No tienes permisos para acceder a este dashboard');
        return;
      }

      if (!response.ok) {
        throw new Error('Error al cargar el dashboard');
      }

      const result = await response.json();

      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error || 'Error desconocido');
      }
    } catch (err) {
      console.error('Error fetching dashboard:', err);
      setError('Error al cargar el dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleViewJob = (jobId: number) => {
    if (!data) return;
    const job = data.allJobs.find((j) => j.id === jobId);
    if (job) {
      setSelectedJob(job);
      setShowJobModal(true);
    }
  };

  // Abrir modal de candidatos para una vacante específica
  const handleViewCandidates = (jobId: number, jobTitle: string) => {
    setSelectedJobForCandidates({ id: jobId, title: jobTitle });
    setShowCandidatesModal(true);
  };

  // Obtener candidatos filtrados por vacante
  const getCandidatesForJob = (jobId: number) => {
    if (!data) return [];
    return data.allApplications.filter((app) => app.jobId === jobId);
  };

  // Abrir ficha de candidato individual
  const handleViewCandidateProfile = (application: any, index: number) => {
    setSelectedApplication(application);
    setCandidateIndex(index);
    setShowCandidateProfile(true);
  };

  // Navegación entre candidatos
  const handleNextCandidate = () => {
    if (!selectedJobForCandidates || !data) return;
    const candidates = getCandidatesForJob(selectedJobForCandidates.id);
    if (candidateIndex < candidates.length - 1) {
      const newIndex = candidateIndex + 1;
      setCandidateIndex(newIndex);
      setSelectedApplication(candidates[newIndex]);
    }
  };

  const handlePrevCandidate = () => {
    if (!selectedJobForCandidates || !data) return;
    const candidates = getCandidatesForJob(selectedJobForCandidates.id);
    if (candidateIndex > 0) {
      const newIndex = candidateIndex - 1;
      setCandidateIndex(newIndex);
      setSelectedApplication(candidates[newIndex]);
    }
  };

  // Acciones de empresa sobre candidatos
  const handleCandidateAction = async (
    applicationId: number,
    action: 'company_interested' | 'accepted' | 'rejected',
    candidateName: string
  ) => {
    // Mensajes de confirmación según la acción
    const confirmMessages: Record<string, string> = {
      company_interested: `¿Marcar a ${candidateName} como "Me interesa"?`,
      rejected: `¿Descartar a ${candidateName}? Esta acción no se puede deshacer.`,
      accepted: `¿Iniciar proceso de contratación con ${candidateName}?`
    };

    if (!confirm(confirmMessages[action])) return;

    // Si es 'accepted', preguntar si quiere cerrar la vacante
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
        alert(result.message);
        // Refrescar datos
        fetchDashboardData();
        // Si se cerró la vacante, cerrar el modal
        if (result.jobClosed) {
          setShowCandidatesModal(false);
        }
      } else {
        alert(result.error || 'Error al actualizar candidato');
      }
    } catch (error) {
      console.error('Error updating candidate:', error);
      alert('Error al actualizar candidato');
    }
  };

  const handleEditJob = (jobId: number) => {
    router.push(`/create-job?edit=${jobId}`);
  };

  // Publicar borrador
  const handlePublishJob = async (jobId: number) => {
    if (!data) return;

    const job = data.allJobs.find((j) => j.id === jobId);
    if (!job) return;

    if (!confirm(`¿Publicar la vacante "${job.title}"? Se descontarán los créditos correspondientes.`)) {
      return;
    }

    try {
      const response = await fetch('/api/jobs/publish', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId })
      });

      const result = await response.json();

      if (response.status === 402) {
        // Créditos insuficientes
        alert(`Créditos insuficientes. Necesitas ${result.required} créditos, tienes ${result.available}.`);
        router.push('/credits/purchase');
        return;
      }

      if (response.ok && result.success) {
        alert(`¡Vacante publicada! Se descontaron ${result.creditCost} créditos.`);
        fetchDashboardData();
      } else {
        alert(result.error || 'Error al publicar la vacante');
      }
    } catch (error) {
      console.error('Error publishing job:', error);
      alert('Error al publicar la vacante');
    }
  };

  const handlePauseJob = async (jobId: number) => {
    if (!confirm('¿Estás seguro de pausar esta vacante? Los candidatos no podrán aplicar mientras esté pausada.')) {
      return;
    }

    try {
      const response = await fetch(`/api/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'paused' })
      });

      if (response.ok) {
        fetchDashboardData();
      } else {
        const result = await response.json();
        alert(result.error || 'Error al pausar la vacante');
      }
    } catch (error) {
      console.error('Error pausing job:', error);
      alert('Error al pausar la vacante');
    }
  };

  const handleResumeJob = async (jobId: number) => {
    try {
      const response = await fetch(`/api/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'active' })
      });

      if (response.ok) {
        fetchDashboardData();
      } else {
        const result = await response.json();
        alert(result.error || 'Error al reanudar la vacante');
      }
    } catch (error) {
      console.error('Error resuming job:', error);
      alert('Error al reanudar la vacante');
    }
  };

  // Cerrar vacante con motivo específico
  const handleCloseJob = async (jobId: number, reason: 'success' | 'cancelled') => {
    const messages = {
      success: '¿Cerrar esta vacante como CONTRATACIÓN EXITOSA? Esto indica que encontraste al candidato ideal.',
      cancelled: '¿Cancelar esta vacante? Esto indica que la vacante se cierra sin haber contratado a nadie.'
    };

    if (!confirm(messages[reason])) {
      return;
    }

    try {
      const response = await fetch(`/api/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'closed', closedReason: reason })
      });

      if (response.ok) {
        const successMessages = {
          success: '¡Felicidades! La vacante ha sido cerrada exitosamente.',
          cancelled: 'La vacante ha sido cancelada.'
        };
        alert(successMessages[reason]);
        fetchDashboardData();
      } else {
        const result = await response.json();
        alert(result.error || 'Error al cerrar la vacante');
      }
    } catch (error) {
      console.error('Error closing job:', error);
      alert('Error al cerrar la vacante');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-custom-beige">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-button-orange mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando dashboard...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-custom-beige">
        <div className="text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Error al cargar
          </h2>
          <p className="text-gray-600 mb-4">
            {error || 'No se pudo cargar el dashboard'}
          </p>
          <button
            onClick={() => router.push('/login')}
            className="px-6 py-2 bg-button-orange text-white rounded-lg hover:bg-opacity-90 transition-colors"
          >
            Ir al Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-custom-beige py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-title-dark mb-2">
              Dashboard de {data.company.companyInfo.nombreEmpresa}
            </h1>
            <p className="text-gray-600">Bienvenido, {data.company.userName}</p>
          </div>
          <div className="flex items-center gap-4">
            {/* Saldo de créditos */}
            <div className="bg-white px-4 py-2 rounded-lg shadow-sm border border-gray-200 flex items-center gap-2">
              <Coins className="text-yellow-500" size={20} />
              <span className="font-semibold text-gray-700">
                {data.company.credits} créditos
              </span>
            </div>
            <button
              onClick={() => router.push('/create-job')}
              className="px-6 py-3 bg-button-green text-white font-bold rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
            >
              <Briefcase size={20} />
              CREAR VACANTE
            </button>
          </div>
        </div>

        {/* Tabla de Vacantes */}
        <div>
          <CompanyJobsTable
            jobs={data.allJobs}
            onView={handleViewJob}
            onEdit={handleEditJob}
            onClose={handleCloseJob}
            onPause={handlePauseJob}
            onResume={handleResumeJob}
            onViewCandidates={handleViewCandidates}
            onPublish={handlePublishJob}
          />
        </div>
      </div>

      {/* Job Detail Modal */}
      <JobDetailModal
        job={selectedJob}
        isOpen={showJobModal}
        onClose={() => setShowJobModal(false)}
      />

      {/* Modal de Candidatos por Vacante */}
      {showCandidatesModal && selectedJobForCandidates && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  Candidatos para: {selectedJobForCandidates.title}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  {getCandidatesForJob(selectedJobForCandidates.id).length} candidato(s) enviado(s) por el especialista
                </p>
              </div>
              <button
                onClick={() => setShowCandidatesModal(false)}
                className="text-gray-400 hover:text-gray-600 p-2"
              >
                <XCircle size={24} />
              </button>
            </div>

            {/* Lista de candidatos */}
            <div className="flex-1 overflow-y-auto p-6">
              {getCandidatesForJob(selectedJobForCandidates.id).length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 text-lg">No hay candidatos para esta vacante</p>
                  <p className="text-gray-400 text-sm mt-2">
                    Los candidatos aparecerán aquí cuando el especialista los envíe
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {getCandidatesForJob(selectedJobForCandidates.id).map((app, index) => (
                    <div
                      key={app.id}
                      className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-md transition-all bg-white"
                    >
                      <div className="flex items-center justify-between">
                        <div
                          className="flex items-center gap-4 flex-1 cursor-pointer"
                          onClick={() => handleViewCandidateProfile(app, index)}
                        >
                          <div className="w-12 h-12 bg-[#2b5d62] text-white rounded-full flex items-center justify-center text-lg font-bold">
                            {app.candidateName?.charAt(0)?.toUpperCase() || '?'}
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900">{app.candidateName}</h3>
                            <p className="text-sm text-gray-500">{app.candidateEmail}</p>
                            {app.candidateProfile?.profile && (
                              <span className="inline-block mt-1 px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">
                                {app.candidateProfile.profile}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                            app.status === 'sent_to_company' ? 'bg-blue-100 text-blue-700' :
                            app.status === 'company_interested' ? 'bg-pink-100 text-pink-700' :
                            app.status === 'interviewed' ? 'bg-purple-100 text-purple-700' :
                            app.status === 'accepted' ? 'bg-green-100 text-green-700' :
                            app.status === 'rejected' ? 'bg-red-100 text-red-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {app.status === 'sent_to_company' ? 'Por revisar' :
                             app.status === 'company_interested' ? 'Me interesa' :
                             app.status === 'interviewed' ? 'Entrevistado' :
                             app.status === 'accepted' ? 'En contratación' :
                             app.status === 'rejected' ? 'Descartado' : app.status}
                          </span>
                          <button
                            onClick={() => handleViewCandidateProfile(app, index)}
                            className="text-blue-600 text-sm font-medium hover:underline"
                          >
                            Ver ficha →
                          </button>
                        </div>
                      </div>

                      {/* Botones de acción - Solo si no está en estado final */}
                      {app.status !== 'accepted' && app.status !== 'rejected' && (
                        <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-gray-100">
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

            {/* Footer */}
            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => setShowCandidatesModal(false)}
                className="w-full px-4 py-2 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Ficha de Candidato Individual */}
      <CandidateProfileModal
        application={selectedApplication}
        isOpen={showCandidateProfile}
        onClose={() => setShowCandidateProfile(false)}
        onNext={handleNextCandidate}
        onPrev={handlePrevCandidate}
        currentIndex={candidateIndex}
        totalCount={selectedJobForCandidates ? getCandidatesForJob(selectedJobForCandidates.id).length : 0}
      />
    </div>
  );
}
