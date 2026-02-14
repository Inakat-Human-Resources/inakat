// RUTA: src/components/company/CompanyApplicationsTable.tsx

'use client';

import { useState } from 'react';
import {
  Eye,
  Download,
  Mail,
  Phone,
  Briefcase,
  GraduationCap,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  MessageSquare,
  User,
  Globe,
  Heart,
  XCircle,
  CheckCircle,
  Users,
  ThumbsUp,
  ThumbsDown
} from 'lucide-react';

const ensureUrl = (url: string) => url.startsWith('http') ? url : `https://${url}`;

interface Experience {
  id: number;
  puesto: string;
  empresa: string;
  fechaInicio: string;
  fechaFin: string | null;
}

// FEATURE: Educación múltiple
interface Education {
  id: number;
  nivel: string;
  institucion: string;
  carrera: string;
  añoInicio?: number | null;
  añoFin?: number | null;
  estatus: string;
}

interface CandidateProfile {
  id: number;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string | null;
  email: string;
  telefono: string | null;
  sexo: string | null;
  fechaNacimiento: string | null;
  universidad: string | null;
  carrera: string | null;
  nivelEstudios: string | null;
  educacion: string | null; // FEATURE: Educación múltiple (JSON string)
  añosExperiencia: number;
  profile: string | null;
  seniority: string | null;
  experienciasRecientes: Experience[];
  cvUrl: string | null;
  linkedinUrl: string | null;
  portafolioUrl: string | null;
  notas: string | null;
}

interface Application {
  id: number;
  candidateName: string;
  candidateEmail: string;
  candidatePhone?: string;
  status: string;
  createdAt: string;
  cvUrl?: string;
  coverLetter?: string;
  job: {
    id: number;
    title: string;
    location: string;
  };
  candidateProfile?: CandidateProfile | null;
  recruiterNotes?: string | null;
  specialistNotes?: string | null;
}

interface CompanyApplicationsTableProps {
  applications: Application[];
  onView?: (applicationId: number) => void;
  onStatusChange?: (applicationId: number, newStatus: string) => void;
}

type CandidateTab = 'pending' | 'interested' | 'rejected' | 'all';

export default function CompanyApplicationsTable({
  applications,
  onView,
  onStatusChange
}: CompanyApplicationsTableProps) {
  const [activeTab, setActiveTab] = useState<CandidateTab>('pending');
  const [selectedJobFilter, setSelectedJobFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Obtener lista única de vacantes
  const uniqueJobs = Array.from(
    new Set(applications.map((app) => app.job.title))
  );

  // Categorizar aplicaciones
  const categorizedApps = {
    pending: applications.filter(app => app.status === 'sent_to_company'),
    interested: applications.filter(app => app.status === 'company_interested'),
    rejected: applications.filter(app => app.status === 'rejected'),
    interviewed: applications.filter(app => app.status === 'interviewed'),
    accepted: applications.filter(app => app.status === 'accepted'),
    all: applications
  };

  // Filtrar por tab y por vacante
  let filteredApplications = categorizedApps[activeTab];

  if (selectedJobFilter !== 'all') {
    filteredApplications = filteredApplications.filter(
      (app) => app.job.title === selectedJobFilter
    );
  }

  const tabs: { key: CandidateTab; label: string; count: number; icon: React.ReactNode }[] = [
    { key: 'pending', label: 'Por revisar', count: categorizedApps.pending.length, icon: <Users className="w-4 h-4" /> },
    { key: 'interested', label: 'Me interesan', count: categorizedApps.interested.length, icon: <Heart className="w-4 h-4" /> },
    { key: 'rejected', label: 'Descartados', count: categorizedApps.rejected.length, icon: <XCircle className="w-4 h-4" /> },
    { key: 'all', label: 'Todos', count: applications.length, icon: null }
  ];

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { bg: string; text: string; label: string }> = {
      sent_to_company: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Por revisar' },
      company_interested: { bg: 'bg-pink-100', text: 'text-pink-800', label: 'Me interesa' },
      interviewed: { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Entrevistado' },
      accepted: { bg: 'bg-green-100', text: 'text-green-800', label: 'Aceptado' },
      rejected: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Descartado' }
    };

    const badge = badges[status] || { bg: 'bg-gray-100', text: 'text-gray-800', label: status };

    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // FEATURE: Parsear educación múltiple
  const parseEducacion = (profile: CandidateProfile | null | undefined): Education[] => {
    if (!profile) return [];
    if (profile.educacion) {
      try {
        const parsed = JSON.parse(profile.educacion);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch {
        // Si falla el parse, continuamos con fallback
      }
    }
    // Fallback: crear array con datos legacy si existen
    if (profile.universidad || profile.carrera || profile.nivelEstudios) {
      return [{
        id: 1,
        nivel: profile.nivelEstudios || '',
        institucion: profile.universidad || '',
        carrera: profile.carrera || '',
        añoInicio: null,
        añoFin: null,
        estatus: ''
      }];
    }
    return [];
  };

  const toggleExpand = (id: number) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200">
      {/* Header con tabs */}
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          Candidatos
        </h2>

        {/* Tabs principales estilo OCC */}
        <div className="flex flex-wrap gap-2 mb-4">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 flex items-center gap-2 ${
                activeTab === tab.key
                  ? 'bg-button-orange text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {tab.icon}
              {tab.label}
              <span className={`px-2 py-0.5 text-xs rounded-full ${
                activeTab === tab.key
                  ? 'bg-white/20 text-white'
                  : 'bg-gray-200 text-gray-600'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Estadísticas rápidas */}
        <div className="flex flex-wrap gap-4 mb-4 text-sm text-gray-600">
          <span className="flex items-center gap-1">
            <CheckCircle className="w-4 h-4 text-green-600" />
            {categorizedApps.accepted.length} aceptados
          </span>
          <span className="flex items-center gap-1">
            <MessageSquare className="w-4 h-4 text-purple-600" />
            {categorizedApps.interviewed.length} entrevistados
          </span>
        </div>

        {/* Filtro por vacante */}
        {uniqueJobs.length > 1 && (
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">
              Filtrar por vacante:
            </label>
            <select
              value={selectedJobFilter}
              onChange={(e) => setSelectedJobFilter(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-button-orange focus:border-button-orange"
            >
              <option value="all">Todas las vacantes</option>
              {uniqueJobs.map((jobTitle) => (
                <option key={jobTitle} value={jobTitle}>
                  {jobTitle}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Lista de candidatos */}
      <div className="divide-y divide-gray-200">
        {filteredApplications.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-500">
            <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium">No hay candidatos en esta categoría</p>
            <p className="text-sm">Los candidatos aparecerán aquí cuando sean asignados a tus vacantes</p>
          </div>
        ) : (
          filteredApplications.map((application) => (
            <div key={application.id} className="hover:bg-gray-50">
              {/* Fila principal - Card estilo */}
              <div className="px-6 py-4">
                <div className="flex items-start justify-between">
                  {/* Info del candidato */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {application.candidateName}
                      </h3>
                      {getStatusBadge(application.status)}
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mb-2">
                      <a
                        href={`mailto:${application.candidateEmail}`}
                        className="flex items-center gap-1 hover:text-button-orange"
                      >
                        <Mail className="w-4 h-4" />
                        {application.candidateEmail}
                      </a>
                      {application.candidatePhone && (
                        <a
                          href={`tel:${application.candidatePhone}`}
                          className="flex items-center gap-1 hover:text-button-orange"
                        >
                          <Phone className="w-4 h-4" />
                          {application.candidatePhone}
                        </a>
                      )}
                    </div>

                    <div className="text-sm text-gray-500">
                      <span className="font-medium text-gray-700">{application.job.title}</span>
                      <span className="mx-2">•</span>
                      <span>{application.job.location}</span>
                      <span className="mx-2">•</span>
                      <span>Aplicó el {formatDate(application.createdAt)}</span>
                    </div>

                    {/* Tags de perfil si existen */}
                    {application.candidateProfile && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {application.candidateProfile.profile && (
                          <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full">
                            {application.candidateProfile.profile}
                          </span>
                        )}
                        {application.candidateProfile.seniority && (
                          <span className="px-2 py-1 bg-purple-50 text-purple-700 text-xs rounded-full">
                            {application.candidateProfile.seniority}
                          </span>
                        )}
                        {application.candidateProfile.añosExperiencia > 0 && (
                          <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                            {application.candidateProfile.añosExperiencia} años exp.
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Acciones rápidas */}
                  <div className="flex flex-col items-end gap-2 ml-6">
                    {/* Estados finales - no hay acciones */}
                    {(application.status === 'accepted' || application.status === 'rejected') && (
                      <span className={`px-3 py-1.5 text-sm font-medium rounded-lg ${
                        application.status === 'accepted'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {application.status === 'accepted' ? 'Candidato aceptado' : 'Candidato descartado'}
                      </span>
                    )}

                    {/* Candidatos por revisar (sent_to_company) */}
                    {onStatusChange && application.status === 'sent_to_company' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => onStatusChange(application.id, 'company_interested')}
                          className="px-3 py-1.5 text-sm bg-pink-100 text-pink-700 hover:bg-pink-200 rounded-lg transition-colors flex items-center gap-1"
                          title="Marcar como interesante"
                        >
                          <Heart className="w-4 h-4" />
                          Me interesa
                        </button>
                        <button
                          onClick={() => onStatusChange(application.id, 'rejected')}
                          className="px-3 py-1.5 text-sm bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors flex items-center gap-1"
                          title="Descartar candidato"
                        >
                          <ThumbsDown className="w-4 h-4" />
                          Descartar
                        </button>
                      </div>
                    )}

                    {/* Candidatos que me interesan (company_interested) */}
                    {onStatusChange && application.status === 'company_interested' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => onStatusChange(application.id, 'interviewed')}
                          className="px-3 py-1.5 text-sm bg-purple-100 text-purple-700 hover:bg-purple-200 rounded-lg transition-colors flex items-center gap-1"
                        >
                          <MessageSquare className="w-4 h-4" />
                          Entrevistado
                        </button>
                        <button
                          onClick={() => onStatusChange(application.id, 'accepted')}
                          className="px-3 py-1.5 text-sm bg-green-100 text-green-700 hover:bg-green-200 rounded-lg transition-colors flex items-center gap-1"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Aceptar
                        </button>
                        <button
                          onClick={() => onStatusChange(application.id, 'rejected')}
                          className="px-3 py-1.5 text-sm bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors flex items-center gap-1"
                        >
                          <ThumbsDown className="w-4 h-4" />
                          Descartar
                        </button>
                      </div>
                    )}

                    {/* Candidatos entrevistados (interviewed) */}
                    {onStatusChange && application.status === 'interviewed' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => onStatusChange(application.id, 'accepted')}
                          className="px-3 py-1.5 text-sm bg-green-100 text-green-700 hover:bg-green-200 rounded-lg transition-colors flex items-center gap-1"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Aceptar
                        </button>
                        <button
                          onClick={() => onStatusChange(application.id, 'rejected')}
                          className="px-3 py-1.5 text-sm bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors flex items-center gap-1"
                        >
                          <ThumbsDown className="w-4 h-4" />
                          Descartar
                        </button>
                      </div>
                    )}

                    {/* Iconos secundarios */}
                    <div className="flex items-center gap-2 mt-2">
                      {application.cvUrl && (
                        <a
                          href={ensureUrl(application.cvUrl)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="Descargar CV"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                      )}
                      {application.candidateProfile?.linkedinUrl && (
                        <a
                          href={ensureUrl(application.candidateProfile.linkedinUrl)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Ver LinkedIn"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                      <button
                        onClick={() => toggleExpand(application.id)}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        title={expandedId === application.id ? 'Ocultar detalles' : 'Ver perfil completo'}
                      >
                        {expandedId === application.id ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Panel expandible con información detallada */}
              {expandedId === application.id && (
                <div className="px-6 pb-6 bg-gray-50 border-t border-gray-200">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
                    {/* Perfil del candidato */}
                    <div className="bg-white rounded-lg p-4 border border-gray-200">
                      <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <User className="w-4 h-4 text-button-orange" />
                        Perfil del Candidato
                      </h4>

                      {application.candidateProfile ? (
                        <div className="space-y-3">
                          {/* Info básica */}
                          <div className="flex flex-wrap gap-4 text-sm">
                            {application.candidateProfile.telefono && (
                              <span className="flex items-center gap-1 text-gray-600">
                                <Phone className="w-4 h-4" />
                                {application.candidateProfile.telefono}
                              </span>
                            )}
                            {application.candidateProfile.añosExperiencia > 0 && (
                              <span className="flex items-center gap-1 text-gray-600">
                                <Briefcase className="w-4 h-4" />
                                {application.candidateProfile.añosExperiencia} años de experiencia
                              </span>
                            )}
                          </div>

                          {/* FEATURE: Educación múltiple */}
                          {parseEducacion(application.candidateProfile).length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-gray-500 mb-2">
                                Educación:
                              </p>
                              <div className="space-y-2">
                                {parseEducacion(application.candidateProfile).map((edu) => (
                                  <div key={edu.id} className="flex items-start gap-2 text-sm">
                                    <GraduationCap className="w-4 h-4 text-gray-400 mt-0.5" />
                                    <div>
                                      <p className="font-medium text-gray-900">
                                        {edu.carrera || 'Sin carrera'}
                                        {edu.estatus && (
                                          <span className={`ml-2 px-1.5 py-0.5 text-xs rounded ${
                                            edu.estatus === 'Titulado' ? 'bg-green-100 text-green-700' :
                                            edu.estatus === 'Terminado' ? 'bg-blue-100 text-blue-700' :
                                            edu.estatus === 'Cursando' ? 'bg-yellow-100 text-yellow-700' :
                                            'bg-gray-100 text-gray-700'
                                          }`}>
                                            {edu.estatus}
                                          </span>
                                        )}
                                      </p>
                                      <p className="text-gray-600">
                                        {edu.institucion || 'Sin institución'}
                                        {edu.nivel && ` • ${edu.nivel}`}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Notas del admin sobre el candidato */}
                          {application.candidateProfile.notas && (
                            <div>
                              <p className="text-xs font-medium text-gray-500 mb-1">
                                Notas del perfil:
                              </p>
                              <p className="text-sm text-gray-700 bg-yellow-50 p-2 rounded">
                                {application.candidateProfile.notas}
                              </p>
                            </div>
                          )}

                          {/* Experiencias recientes */}
                          {application.candidateProfile.experienciasRecientes?.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-gray-500 mb-2">
                                Experiencia Reciente:
                              </p>
                              <div className="space-y-2">
                                {application.candidateProfile.experienciasRecientes.map((exp) => (
                                  <div key={exp.id} className="flex items-start gap-2 text-sm">
                                    <Briefcase className="w-4 h-4 text-gray-400 mt-0.5" />
                                    <div>
                                      <p className="font-medium text-gray-900">{exp.puesto}</p>
                                      <p className="text-gray-600">{exp.empresa}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Links */}
                          <div className="flex flex-wrap gap-3 pt-2">
                            {application.candidateProfile.cvUrl && (
                              <a
                                href={ensureUrl(application.candidateProfile.cvUrl)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
                              >
                                <Download className="w-4 h-4" />
                                CV Completo
                              </a>
                            )}
                            {application.candidateProfile.linkedinUrl && (
                              <a
                                href={ensureUrl(application.candidateProfile.linkedinUrl)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
                              >
                                <ExternalLink className="w-4 h-4" />
                                LinkedIn
                              </a>
                            )}
                            {application.candidateProfile.portafolioUrl && (
                              <a
                                href={ensureUrl(application.candidateProfile.portafolioUrl)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
                              >
                                <Globe className="w-4 h-4" />
                                Portafolio
                              </a>
                            )}
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 italic">
                          Este candidato aplicó directamente. No hay perfil completo en el sistema.
                        </p>
                      )}
                    </div>

                    {/* Notas del equipo */}
                    <div className="bg-white rounded-lg p-4 border border-gray-200">
                      <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-button-orange" />
                        Notas del Equipo de Selección
                      </h4>

                      <div className="space-y-4">
                        {/* Notas del Reclutador */}
                        <div>
                          <p className="text-xs font-medium text-gray-500 mb-1">
                            Notas del Reclutador:
                          </p>
                          {application.recruiterNotes ? (
                            <p className="text-sm text-gray-700 bg-blue-50 p-3 rounded-lg">
                              {application.recruiterNotes}
                            </p>
                          ) : (
                            <p className="text-sm text-gray-400 italic">
                              Sin notas del reclutador
                            </p>
                          )}
                        </div>

                        {/* Notas del Especialista */}
                        <div>
                          <p className="text-xs font-medium text-gray-500 mb-1">
                            Notas del Especialista:
                          </p>
                          {application.specialistNotes ? (
                            <p className="text-sm text-gray-700 bg-purple-50 p-3 rounded-lg">
                              {application.specialistNotes}
                            </p>
                          ) : (
                            <p className="text-sm text-gray-400 italic">
                              Sin notas del especialista
                            </p>
                          )}
                        </div>

                        {/* Carta de presentación */}
                        {application.coverLetter && (
                          <div>
                            <p className="text-xs font-medium text-gray-500 mb-1">
                              Carta de Presentación:
                            </p>
                            <p className="text-sm text-gray-700 bg-gray-100 p-3 rounded-lg">
                              {application.coverLetter}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
