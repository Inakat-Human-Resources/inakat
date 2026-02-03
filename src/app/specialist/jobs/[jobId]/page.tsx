// RUTA: src/app/specialist/jobs/[jobId]/page.tsx

'use client';

// FIX-02: Helper para asegurar que URLs externos tengan protocolo https://
const ensureUrl = (url: string) => url.startsWith('http') ? url : `https://${url}`;

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft,
  Users,
  Clock,
  Send,
  Archive,
  Eye,
  PlayCircle,
  Trash2,
  RotateCcw,
  CheckCircle,
  Loader2,
  AlertCircle,
  Building2,
  MapPin,
  Mail,
  Phone,
  Inbox,
  FileText,
  ExternalLink,
  Star,
  GraduationCap,
  Briefcase
} from 'lucide-react';
import CandidateProfileModal from '@/components/shared/CandidateProfileModal';
import CompanyLogo from '@/components/shared/CompanyLogo';
import CandidatePhoto from '@/components/shared/CandidatePhoto'; // FEAT-2: Foto de perfil

// Key para localStorage de candidatos vistos
const VIEWED_CANDIDATES_KEY = 'inakat_viewed_candidates_specialist';

type TabType = 'pending' | 'evaluating' | 'sent' | 'discarded';

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
  fotoUrl?: string; // FEAT-2: Foto de perfil
  experiences?: any[];
  educacion?: string;
  subcategory?: string;
  documents?: any[];
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

interface JobData {
  id: number;
  title: string;
  company: string;
  location: string;
  workMode: string;
  profile: string;
  seniority: string;
  description: string;
  requirements: string;
  user: {
    nombre: string;
    companyRequest?: {
      nombreEmpresa: string;
      logoUrl?: string | null; // FEAT-1b: Logo de empresa
    };
  };
}

interface AssignmentData {
  id: number;
  jobId: number;
  recruiterNotes: string | null;
  applications: Application[];
  job: JobData;
  recruiter?: {
    id: number;
    nombre: string;
    apellidoPaterno: string;
    email: string;
  };
}

export default function SpecialistJobCandidates() {
  const router = useRouter();
  const params = useParams();
  const jobId = params.jobId as string;

  const [assignment, setAssignment] = useState<AssignmentData | null>(null);
  const [specialist, setSpecialist] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Pestaña activa
  const [activeTab, setActiveTab] = useState<TabType>('pending');

  // Estados de carga para acciones
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  // Modal de perfil de candidato
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);

  // Navegación entre candidatos
  const [currentCandidatesList, setCurrentCandidatesList] = useState<Application[]>([]);
  const [currentCandidateIndex, setCurrentCandidateIndex] = useState<number>(0);

  // IDs de candidatos vistos (localStorage)
  const [viewedIds, setViewedIds] = useState<number[]>([]);

  // Hover tooltip para candidatos
  const [hoveredAppId, setHoveredAppId] = useState<number | null>(null);

  // Pestañas configuración - "Sin Revisar" → "Por revisar"
  const tabs: { id: TabType; label: string; icon: React.ReactNode; color: string }[] = [
    { id: 'pending', label: 'Por revisar', icon: <Inbox size={18} />, color: 'yellow' },
    { id: 'evaluating', label: 'En proceso', icon: <Clock size={18} />, color: 'purple' },
    { id: 'sent', label: 'Enviadas', icon: <Send size={18} />, color: 'green' },
    { id: 'discarded', label: 'Descartados', icon: <Archive size={18} />, color: 'gray' }
  ];

  useEffect(() => {
    // Cargar IDs vistos de localStorage
    const stored = getViewedCandidates();
    setViewedIds(stored);
    fetchJobData();
  }, [jobId]);

  const getViewedCandidates = (): number[] => {
    if (typeof window === 'undefined') return [];
    try {
      return JSON.parse(localStorage.getItem(VIEWED_CANDIDATES_KEY) || '[]');
    } catch {
      return [];
    }
  };

  const markAsViewed = (applicationId: number) => {
    if (typeof window === 'undefined') return;
    const viewed = getViewedCandidates();
    if (!viewed.includes(applicationId)) {
      viewed.push(applicationId);
      localStorage.setItem(VIEWED_CANDIDATES_KEY, JSON.stringify(viewed));
      setViewedIds(viewed);
    }
  };

  const fetchJobData = async () => {
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
        setSpecialist(data.data.specialist);

        // Buscar el assignment que corresponde a este jobId
        const foundAssignment = data.data.assignments.find(
          (a: AssignmentData) => a.jobId === parseInt(jobId)
        );

        if (foundAssignment) {
          setAssignment(foundAssignment);
        } else {
          setError('No tienes acceso a esta vacante o no existe');
        }
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

  // Contar applications por tab
  const getTabCount = (tab: TabType): number => {
    if (!assignment) return 0;
    const apps = assignment.applications;
    switch (tab) {
      case 'pending':
        return apps.filter(app => app.status === 'sent_to_specialist').length;
      case 'evaluating':
        return apps.filter(app => app.status === 'evaluating').length;
      case 'sent':
        return apps.filter(app => app.status === 'sent_to_company').length;
      case 'discarded':
        return apps.filter(app => app.status === 'discarded').length;
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
        fetchJobData();
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

  const openApplicationProfile = (application: Application, candidatesList: Application[] = []) => {
    const index = candidatesList.findIndex(app => app.id === application.id);
    setSelectedApplication(application);
    setCurrentCandidatesList(candidatesList);
    setCurrentCandidateIndex(index >= 0 ? index : 0);
    setProfileModalOpen(true);

    // Marcar como visto
    markAsViewed(application.id);
  };

  const closeProfileModal = () => {
    setProfileModalOpen(false);
    setSelectedApplication(null);
    setCurrentCandidatesList([]);
    setCurrentCandidateIndex(0);
  };

  const goToNextCandidate = () => {
    if (currentCandidateIndex < currentCandidatesList.length - 1) {
      const nextIndex = currentCandidateIndex + 1;
      setCurrentCandidateIndex(nextIndex);
      setSelectedApplication(currentCandidatesList[nextIndex]);
      markAsViewed(currentCandidatesList[nextIndex].id);
    }
  };

  const goToPrevCandidate = () => {
    if (currentCandidateIndex > 0) {
      const prevIndex = currentCandidateIndex - 1;
      setCurrentCandidateIndex(prevIndex);
      setSelectedApplication(currentCandidatesList[prevIndex]);
      markAsViewed(currentCandidatesList[prevIndex].id);
    }
  };

  const getWorkModeLabel = (mode: string) => {
    const labels: Record<string, string> = {
      remote: 'Remoto',
      hybrid: 'Híbrido',
      presential: 'Presencial'
    };
    return labels[mode] || mode;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="animate-spin text-purple-600" size={40} />
      </div>
    );
  }

  if (error || !assignment) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="mx-auto text-red-500 mb-4" size={48} />
          <p className="text-gray-600">{error || 'Vacante no encontrada'}</p>
          <button
            onClick={() => router.push('/specialist/dashboard')}
            className="mt-4 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            Volver al dashboard
          </button>
        </div>
      </div>
    );
  }

  const job = assignment.job;
  const filteredApps = filterApplicationsByTab(assignment.applications);

  return (
    <div className="min-h-screen bg-gray-50 py-6">
      <div className="max-w-5xl mx-auto px-4">
        {/* Header con botón volver */}
        <div className="mb-6">
          <button
            onClick={() => router.push('/specialist/dashboard')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors"
          >
            <ArrowLeft size={20} />
            <span>Volver al dashboard</span>
          </button>

          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <CompanyLogo
                  logoUrl={job.user?.companyRequest?.logoUrl}
                  companyName={job.user?.companyRequest?.nombreEmpresa || job.company}
                  size="md"
                />
                <div>
                  <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">
                    {job.title}
                  </h1>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <Building2 size={16} />
                      {job.user?.companyRequest?.nombreEmpresa || job.company}
                    </span>
                  <span className="flex items-center gap-1">
                    <MapPin size={16} />
                    {job.location}
                  </span>
                  <span className="px-2 py-0.5 bg-gray-100 rounded text-xs">
                    {getWorkModeLabel(job.workMode)}
                  </span>
                  {job.profile && (
                    <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">
                      {job.profile}
                    </span>
                  )}
                  {job.seniority && (
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">
                      {job.seniority}
                    </span>
                  )}
                </div>
                </div>
              </div>

              {specialist?.specialty && (
                <span className="hidden sm:flex items-center gap-1 text-sm text-yellow-600">
                  <Star size={16} />
                  {specialist.specialty}
                </span>
              )}
            </div>

            {/* Info del reclutador */}
            {assignment.recruiter && (
              <div className="mt-3 p-2 bg-gray-50 rounded text-sm text-gray-600">
                Reclutador: {assignment.recruiter.nombre} {assignment.recruiter.apellidoPaterno} ({assignment.recruiter.email})
              </div>
            )}

            {/* Notas del reclutador */}
            {assignment.recruiterNotes && (
              <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm font-medium text-blue-800 mb-1 flex items-center gap-1">
                  <FileText size={14} />
                  Notas del Reclutador:
                </p>
                <p className="text-sm text-blue-700 whitespace-pre-wrap">
                  {assignment.recruiterNotes}
                </p>
              </div>
            )}
          </div>
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
          <div className="flex border-b overflow-x-auto">
            {tabs.map((tab) => {
              const count = getTabCount(tab.id);
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 min-w-[100px] px-4 py-3 flex items-center justify-center gap-2 font-medium transition-colors relative ${
                    isActive
                      ? 'border-b-2'
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
                    isActive ? 'bg-white shadow-sm' : 'bg-gray-100'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Lista de candidatos */}
        <div className="bg-white rounded-lg shadow-sm border">
          {filteredApps.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="mx-auto text-gray-300 mb-4" size={48} />
              <p className="text-gray-500">
                No hay candidatos en "{tabs.find(t => t.id === activeTab)?.label}"
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredApps.map((app) => {
                const isUnseen = !viewedIds.includes(app.id);

                return (
                  <div
                    key={app.id}
                    className={`p-4 hover:bg-gray-50 transition-colors relative ${isUnseen ? 'bg-purple-50/30' : ''}`}
                    onMouseEnter={() => setHoveredAppId(app.id)}
                    onMouseLeave={() => setHoveredAppId(null)}
                  >
                    {/* Tooltip de información rápida */}
                    {hoveredAppId === app.id && app.candidateProfile && (
                      <div className="absolute left-4 top-0 -translate-y-full z-20 pointer-events-none mb-2">
                        <div className="bg-gray-900 text-white text-xs rounded-lg p-3 shadow-lg max-w-xs">
                          <p className="font-semibold mb-2 text-sm">{app.candidateName}</p>
                          <div className="space-y-1">
                            {app.candidateProfile.universidad && (
                              <p><span className="text-gray-400">Universidad:</span> {app.candidateProfile.universidad}</p>
                            )}
                            {app.candidateProfile.carrera && (
                              <p><span className="text-gray-400">Carrera:</span> {app.candidateProfile.carrera}</p>
                            )}
                            {app.candidateProfile.nivelEstudios && (
                              <p><span className="text-gray-400">Nivel:</span> {app.candidateProfile.nivelEstudios}</p>
                            )}
                            {app.candidateProfile.añosExperiencia !== undefined && app.candidateProfile.añosExperiencia > 0 && (
                              <p><span className="text-gray-400">Experiencia:</span> {app.candidateProfile.añosExperiencia} {app.candidateProfile.añosExperiencia === 1 ? 'año' : 'años'}</p>
                            )}
                            {app.candidateProfile.profile && (
                              <p><span className="text-gray-400">Área:</span> {app.candidateProfile.profile}</p>
                            )}
                            {app.candidateProfile.seniority && (
                              <p><span className="text-gray-400">Seniority:</span> {app.candidateProfile.seniority}</p>
                            )}
                            {app.candidateProfile.source && (
                              <p><span className="text-gray-400">Fuente:</span> {app.candidateProfile.source}</p>
                            )}
                          </div>
                          <div className="absolute left-4 bottom-0 translate-y-full">
                            <div className="border-8 border-transparent border-t-gray-900"></div>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        {/* FEAT-2: Foto de perfil del candidato */}
                        <CandidatePhoto
                          fotoUrl={app.candidateProfile?.fotoUrl}
                          candidateName={app.candidateName}
                          size="sm"
                        />
                        <div className="flex-1 min-w-0">
                        {/* Nombre y badges */}
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-gray-900">
                            {app.candidateName}
                          </p>
                          {isUnseen && (
                            <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full font-medium">
                              Sin ver
                            </span>
                          )}
                        </div>

                        {/* Contacto */}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <Mail size={14} />
                            <span className="truncate">{app.candidateEmail}</span>
                          </span>
                          {app.candidatePhone && (
                            <span className="flex items-center gap-1">
                              <Phone size={14} />
                              {app.candidatePhone}
                            </span>
                          )}
                        </div>

                        {/* Info del perfil */}
                        {app.candidateProfile && (
                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            {app.candidateProfile.universidad && (
                              <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full flex items-center gap-1">
                                <GraduationCap size={12} />
                                {app.candidateProfile.universidad}
                              </span>
                            )}
                            {app.candidateProfile.carrera && (
                              <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full">
                                {app.candidateProfile.carrera}
                              </span>
                            )}
                            {app.candidateProfile.añosExperiencia !== undefined && app.candidateProfile.añosExperiencia > 0 && (
                              <span className="text-xs px-2 py-0.5 bg-green-50 text-green-700 rounded-full flex items-center gap-1">
                                <Briefcase size={12} />
                                {app.candidateProfile.añosExperiencia} {app.candidateProfile.añosExperiencia === 1 ? 'año' : 'años'} exp.
                              </span>
                            )}
                            {app.candidateProfile.profile && (
                              <span className="text-xs px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full">
                                {app.candidateProfile.profile}
                              </span>
                            )}
                            {app.candidateProfile.seniority && (
                              <span className="text-xs px-2 py-0.5 bg-orange-50 text-orange-700 rounded-full">
                                {app.candidateProfile.seniority}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Links rápidos */}
                        <div className="flex items-center gap-3 mt-2">
                          {(app.cvUrl || app.candidateProfile?.cvUrl) && (
                            <a
                              href={ensureUrl(app.cvUrl || app.candidateProfile?.cvUrl || '#')}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <FileText size={12} />
                              CV
                            </a>
                          )}
                          {app.candidateProfile?.linkedinUrl && (
                            <a
                              href={ensureUrl(app.candidateProfile.linkedinUrl)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ExternalLink size={12} />
                              LinkedIn
                            </a>
                          )}
                        </div>
                        </div>
                      </div>

                      {/* Acciones */}
                      <div className="flex items-center justify-end gap-2 flex-shrink-0">
                        {/* Ver perfil - siempre disponible */}
                        <button
                          onClick={() => openApplicationProfile(app, filteredApps)}
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
                              <span className="hidden sm:inline">Evaluar</span>
                            </button>
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
                              <span className="hidden sm:inline">Enviar</span>
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
                              onClick={() => handleMoveApplication(app.id, 'sent_to_specialist')}
                              disabled={actionLoading === app.id}
                              className="px-3 py-1.5 bg-gray-500 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50 flex items-center gap-1 text-sm"
                              title="Regresar a por revisar"
                            >
                              {actionLoading === app.id ? (
                                <Loader2 size={14} className="animate-spin" />
                              ) : (
                                <ArrowLeft size={14} />
                              )}
                              <span className="hidden sm:inline">Regresar</span>
                            </button>
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
                              <span className="hidden sm:inline">Enviar</span>
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
                          <>
                            <button
                              onClick={() => handleMoveApplication(app.id, 'sent_to_specialist')}
                              disabled={actionLoading === app.id}
                              className="px-3 py-1.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 flex items-center gap-1 text-sm"
                              title="Reactivar candidato"
                            >
                              {actionLoading === app.id ? (
                                <Loader2 size={14} className="animate-spin" />
                              ) : (
                                <RotateCcw size={14} />
                              )}
                              <span className="hidden sm:inline">Reactivar</span>
                            </button>
                            <button
                              onClick={() => handleMoveApplication(app.id, 'evaluating')}
                              disabled={actionLoading === app.id}
                              className="px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-1 text-sm"
                              title="Mover a en proceso"
                            >
                              {actionLoading === app.id ? (
                                <Loader2 size={14} className="animate-spin" />
                              ) : (
                                <PlayCircle size={14} />
                              )}
                              <span className="hidden sm:inline">En proceso</span>
                            </button>
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
                              <span className="hidden sm:inline">Enviar</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
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
        recruiterNotes={assignment.recruiterNotes || ''}
        showRecruiterNotes={true}
        onNext={currentCandidatesList.length > 1 ? goToNextCandidate : undefined}
        onPrev={currentCandidatesList.length > 1 ? goToPrevCandidate : undefined}
        currentIndex={currentCandidateIndex}
        totalCount={currentCandidatesList.length}
        canAddDocuments={true}
        onDocumentsUpdated={fetchJobData}
        userRole="specialist"
      />
    </div>
  );
}
