'use client';

import { useState } from 'react';
import {
  Eye,
  Download,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  GraduationCap,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  MessageSquare,
  User,
  Globe
} from 'lucide-react';

interface Experience {
  id: number;
  puesto: string;
  empresa: string;
  fechaInicio: string;
  fechaFin: string | null;
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

export default function CompanyApplicationsTable({
  applications,
  onView,
  onStatusChange
}: CompanyApplicationsTableProps) {
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedJobFilter, setSelectedJobFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Obtener lista única de vacantes
  const uniqueJobs = Array.from(
    new Set(applications.map((app) => app.job.title))
  );

  // Filtrar aplicaciones
  let filteredApplications = applications;

  if (filterStatus !== 'all') {
    filteredApplications = filteredApplications.filter(
      (app) => app.status === filterStatus
    );
  }

  if (selectedJobFilter !== 'all') {
    filteredApplications = filteredApplications.filter(
      (app) => app.job.title === selectedJobFilter
    );
  }

  const getStatusBadge = (status: string) => {
    const badges: Record<string, string> = {
      sent_to_company: 'bg-blue-100 text-blue-800',
      interviewed: 'bg-purple-100 text-purple-800',
      accepted: 'bg-green-100 text-green-800',
      rejected: 'bg-gray-100 text-gray-800'
    };

    const labels: Record<string, string> = {
      sent_to_company: 'Nuevo Candidato',
      interviewed: 'Entrevistado',
      accepted: 'Aceptado',
      rejected: 'Rechazado'
    };

    return (
      <span
        className={`px-2 py-1 text-xs font-semibold rounded-full ${
          badges[status] || 'bg-gray-100 text-gray-800'
        }`}
      >
        {labels[status] || status}
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

  const toggleExpand = (id: number) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200">
      {/* Header con filtros */}
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          Mis Aplicaciones
        </h2>

        {/* Filtros de estado */}
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              filterStatus === 'all'
                ? 'bg-button-orange text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Todos ({applications.length})
          </button>
          <button
            onClick={() => setFilterStatus('sent_to_company')}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              filterStatus === 'sent_to_company'
                ? 'bg-button-orange text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Nuevos (
            {applications.filter((a) => a.status === 'sent_to_company').length})
          </button>
          <button
            onClick={() => setFilterStatus('interviewed')}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              filterStatus === 'interviewed'
                ? 'bg-button-orange text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Entrevistados (
            {applications.filter((a) => a.status === 'interviewed').length})
          </button>
          <button
            onClick={() => setFilterStatus('accepted')}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              filterStatus === 'accepted'
                ? 'bg-button-orange text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Aceptados (
            {applications.filter((a) => a.status === 'accepted').length})
          </button>
          <button
            onClick={() => setFilterStatus('rejected')}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              filterStatus === 'rejected'
                ? 'bg-button-orange text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Rechazados (
            {applications.filter((a) => a.status === 'rejected').length})
          </button>
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

      {/* Lista de aplicaciones */}
      <div className="divide-y divide-gray-200">
        {filteredApplications.length === 0 ? (
          <div className="px-6 py-8 text-center text-gray-500">
            No hay aplicaciones con los filtros seleccionados
          </div>
        ) : (
          filteredApplications.map((application) => (
            <div key={application.id} className="hover:bg-gray-50">
              {/* Fila principal */}
              <div className="px-6 py-4 flex items-center justify-between">
                <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                  {/* Candidato */}
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {application.candidateName}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <a
                        href={`mailto:${application.candidateEmail}`}
                        className="flex items-center gap-1 text-xs text-gray-500 hover:text-button-orange"
                      >
                        <Mail className="w-3 h-3" />
                        {application.candidateEmail}
                      </a>
                    </div>
                  </div>

                  {/* Vacante */}
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {application.job.title}
                    </p>
                    <p className="text-xs text-gray-500">
                      {application.job.location}
                    </p>
                  </div>

                  {/* Fecha y Estado */}
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-500">
                      {formatDate(application.createdAt)}
                    </span>
                    {onStatusChange ? (
                      <select
                        value={application.status}
                        onChange={(e) =>
                          onStatusChange(application.id, e.target.value)
                        }
                        className="text-xs font-semibold rounded-full px-2 py-1 border border-gray-300 focus:ring-2 focus:ring-button-orange"
                      >
                        <option value="sent_to_company">Nuevo Candidato</option>
                        <option value="interviewed">Entrevistado</option>
                        <option value="accepted">Aceptado</option>
                        <option value="rejected">Rechazado</option>
                      </select>
                    ) : (
                      getStatusBadge(application.status)
                    )}
                  </div>

                  {/* Acciones */}
                  <div className="flex items-center gap-2 justify-end">
                    {application.cvUrl && (
                      <a
                        href={application.cvUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title="Descargar CV"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    )}
                    {onView && (
                      <button
                        onClick={() => onView(application.id)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Ver detalles"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => toggleExpand(application.id)}
                      className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                      title={
                        expandedId === application.id
                          ? 'Ocultar detalles'
                          : 'Ver perfil completo'
                      }
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
                            {application.candidateProfile.universidad && (
                              <span className="flex items-center gap-1 text-gray-600">
                                <GraduationCap className="w-4 h-4" />
                                {application.candidateProfile.universidad}
                                {application.candidateProfile.carrera &&
                                  ` - ${application.candidateProfile.carrera}`}
                              </span>
                            )}
                            {application.candidateProfile.añosExperiencia > 0 && (
                              <span className="flex items-center gap-1 text-gray-600">
                                <Briefcase className="w-4 h-4" />
                                {application.candidateProfile.añosExperiencia} años de experiencia
                              </span>
                            )}
                          </div>

                          {/* Perfil y Seniority */}
                          <div className="flex flex-wrap gap-2">
                            {application.candidateProfile.profile && (
                              <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                                {application.candidateProfile.profile}
                              </span>
                            )}
                            {application.candidateProfile.seniority && (
                              <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full">
                                {application.candidateProfile.seniority}
                              </span>
                            )}
                            {application.candidateProfile.nivelEstudios && (
                              <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                                {application.candidateProfile.nivelEstudios}
                              </span>
                            )}
                          </div>

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
                          {application.candidateProfile.experienciasRecientes
                            ?.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-gray-500 mb-2">
                                Experiencia Reciente:
                              </p>
                              <div className="space-y-2">
                                {application.candidateProfile.experienciasRecientes.map(
                                  (exp) => (
                                    <div
                                      key={exp.id}
                                      className="flex items-start gap-2 text-sm"
                                    >
                                      <Briefcase className="w-4 h-4 text-gray-400 mt-0.5" />
                                      <div>
                                        <p className="font-medium text-gray-900">
                                          {exp.puesto}
                                        </p>
                                        <p className="text-gray-600">
                                          {exp.empresa}
                                        </p>
                                      </div>
                                    </div>
                                  )
                                )}
                              </div>
                            </div>
                          )}

                          {/* Links */}
                          <div className="flex flex-wrap gap-3 pt-2">
                            {application.candidateProfile.cvUrl && (
                              <a
                                href={application.candidateProfile.cvUrl}
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
                                href={application.candidateProfile.linkedinUrl}
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
                                href={application.candidateProfile.portafolioUrl}
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
                          Este candidato aplicó directamente. No hay perfil
                          completo en el sistema.
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
