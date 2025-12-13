'use client';

import { useState } from 'react';
import { Eye, Download, Mail, Phone } from 'lucide-react';

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
    // Status visibles para empresa con labels amigables
    const badges: Record<string, string> = {
      sent_to_company: 'bg-blue-100 text-blue-800',
      interviewed: 'bg-purple-100 text-purple-800',
      accepted: 'bg-green-100 text-green-800',
      rejected: 'bg-gray-100 text-gray-800'
    };

    // Labels amigables para la empresa
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

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200">
      {/* Header con filtros */}
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          Mis Aplicaciones
        </h2>

        {/* Filtros de estado (solo status visibles para empresa) */}
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

      {/* Tabla */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Candidato
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Vacante
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Fecha
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Estado
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredApplications.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                  No hay aplicaciones con los filtros seleccionados
                </td>
              </tr>
            ) : (
              filteredApplications.map((application) => (
                <tr
                  key={application.id}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {application.candidateName}
                      </p>
                      <div className="flex items-center gap-3 mt-1">
                        <a
                          href={`mailto:${application.candidateEmail}`}
                          className="flex items-center gap-1 text-xs text-gray-500 hover:text-button-orange"
                        >
                          <Mail className="w-3 h-3" />
                          {application.candidateEmail}
                        </a>
                        {application.candidatePhone && (
                          <span className="flex items-center gap-1 text-xs text-gray-500">
                            <Phone className="w-3 h-3" />
                            {application.candidatePhone}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {application.job.title}
                      </p>
                      <p className="text-xs text-gray-500">
                        {application.job.location}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {formatDate(application.createdAt)}
                  </td>
                  <td className="px-6 py-4">
                    {onStatusChange ? (
                      <select
                        value={application.status}
                        onChange={(e) =>
                          onStatusChange(application.id, e.target.value)
                        }
                        className="text-xs font-semibold rounded-full px-2 py-1 border border-gray-300 focus:ring-2 focus:ring-button-orange focus:border-button-orange"
                      >
                        <option value="sent_to_company">Nuevo Candidato</option>
                        <option value="interviewed">Entrevistado</option>
                        <option value="accepted">Aceptado</option>
                        <option value="rejected">Rechazado</option>
                      </select>
                    ) : (
                      getStatusBadge(application.status)
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {onView && (
                        <button
                          onClick={() => onView(application.id)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Ver detalles"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      )}
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
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
