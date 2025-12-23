'use client';

import { useState } from 'react';
import { Edit2, Eye, XCircle, Pause, Play, Users, Clock, AlertTriangle } from 'lucide-react';

interface Job {
  id: number;
  title: string;
  location: string;
  salary: string;
  status: string;
  jobType: string;
  workMode: string;
  createdAt: string;
  expiresAt?: string;
  applicationCount?: number;
  _count?: {
    applications: number;
  };
}

interface CompanyJobsTableProps {
  jobs: Job[];
  onEdit?: (jobId: number) => void;
  onView?: (jobId: number) => void;
  onClose?: (jobId: number) => void;
  onPause?: (jobId: number) => void;
  onResume?: (jobId: number) => void;
}

type JobTab = 'active' | 'paused' | 'expired' | 'draft' | 'closed';

export default function CompanyJobsTable({
  jobs,
  onEdit,
  onView,
  onClose,
  onPause,
  onResume
}: CompanyJobsTableProps) {
  const [activeTab, setActiveTab] = useState<JobTab>('active');

  // Determinar si un job está expirado
  const isExpired = (job: Job) => {
    if (!job.expiresAt) return false;
    return new Date(job.expiresAt) <= new Date() && job.status === 'active';
  };

  // Categorizar jobs
  const categorizedJobs = {
    active: jobs.filter(job => job.status === 'active' && !isExpired(job)),
    paused: jobs.filter(job => job.status === 'paused'),
    expired: jobs.filter(job => isExpired(job)),
    draft: jobs.filter(job => job.status === 'draft'),
    closed: jobs.filter(job => job.status === 'closed')
  };

  const filteredJobs = categorizedJobs[activeTab];

  const tabs: { key: JobTab; label: string; count: number; color: string }[] = [
    { key: 'active', label: 'Activas', count: categorizedJobs.active.length, color: 'green' },
    { key: 'paused', label: 'En pausa', count: categorizedJobs.paused.length, color: 'yellow' },
    { key: 'expired', label: 'Expiradas', count: categorizedJobs.expired.length, color: 'orange' },
    { key: 'draft', label: 'Borradores', count: categorizedJobs.draft.length, color: 'gray' },
    { key: 'closed', label: 'Cerradas', count: categorizedJobs.closed.length, color: 'red' }
  ];

  const getStatusBadge = (job: Job) => {
    if (isExpired(job)) {
      return (
        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-800 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          Expirada
        </span>
      );
    }

    const badges: Record<string, { bg: string; text: string; label: string }> = {
      active: { bg: 'bg-green-100', text: 'text-green-800', label: 'Activa' },
      paused: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'En pausa' },
      closed: { bg: 'bg-red-100', text: 'text-red-800', label: 'Cerrada' },
      draft: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Borrador' }
    };

    const badge = badges[job.status] || badges.draft;

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

  const getApplicationCount = (job: Job) => {
    return job.applicationCount ?? job._count?.applications ?? 0;
  };

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200">
      {/* Header con tabs */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">Mis Vacantes</h2>
          <span className="text-sm text-gray-500">{jobs.length} total</span>
        </div>

        {/* Tabs estilo OCC */}
        <div className="flex flex-wrap gap-2">
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
      </div>

      {/* Lista de vacantes en formato cards */}
      <div className="p-4 space-y-4">
        {filteredJobs.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium">No hay vacantes en esta categoría</p>
            <p className="text-sm">Las vacantes que crees aparecerán aquí</p>
          </div>
        ) : (
          filteredJobs.map((job) => (
            <div
              key={job.id}
              className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow bg-white"
            >
              <div className="flex items-start justify-between">
                {/* Info principal */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">{job.title}</h3>
                    {getStatusBadge(job)}
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                    <span>{job.location}</span>
                    <span className="text-gray-300">|</span>
                    <span>{job.salary}</span>
                    <span className="text-gray-300">|</span>
                    <span>{job.jobType}</span>
                    <span className="text-gray-300">|</span>
                    <span>{job.workMode === 'remote' ? 'Remoto' : job.workMode === 'hybrid' ? 'Híbrido' : 'Presencial'}</span>
                  </div>
                </div>

                {/* Métricas */}
                <div className="flex items-center gap-6 ml-6">
                  {/* Candidatos */}
                  <div className="text-center">
                    <div className="flex items-center justify-center w-12 h-12 bg-blue-100 text-blue-700 rounded-full font-bold text-lg">
                      {getApplicationCount(job)}
                    </div>
                    <span className="text-xs text-gray-500 mt-1 block">Candidatos</span>
                  </div>

                  {/* Fecha de publicación */}
                  <div className="text-center">
                    <div className="flex items-center justify-center w-12 h-12 bg-gray-100 text-gray-600 rounded-full">
                      <Clock className="w-5 h-5" />
                    </div>
                    <span className="text-xs text-gray-500 mt-1 block">{formatDate(job.createdAt)}</span>
                  </div>
                </div>
              </div>

              {/* Acciones */}
              <div className="flex items-center justify-end gap-2 mt-4 pt-4 border-t border-gray-100">
                {onView && (
                  <button
                    onClick={() => onView(job.id)}
                    className="px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-1"
                  >
                    <Eye className="w-4 h-4" />
                    Ver
                  </button>
                )}

                {onEdit && job.status !== 'closed' && (
                  <button
                    onClick={() => onEdit(job.id)}
                    className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-1"
                  >
                    <Edit2 className="w-4 h-4" />
                    Editar
                  </button>
                )}

                {/* Pausar/Reanudar */}
                {onPause && job.status === 'active' && !isExpired(job) && (
                  <button
                    onClick={() => onPause(job.id)}
                    className="px-3 py-1.5 text-sm text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors flex items-center gap-1"
                  >
                    <Pause className="w-4 h-4" />
                    Pausar
                  </button>
                )}

                {onResume && job.status === 'paused' && (
                  <button
                    onClick={() => onResume(job.id)}
                    className="px-3 py-1.5 text-sm text-green-600 hover:bg-green-50 rounded-lg transition-colors flex items-center gap-1"
                  >
                    <Play className="w-4 h-4" />
                    Reanudar
                  </button>
                )}

                {/* Cerrar */}
                {onClose && (job.status === 'active' || job.status === 'paused') && (
                  <button
                    onClick={() => onClose(job.id)}
                    className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-1"
                  >
                    <XCircle className="w-4 h-4" />
                    Cerrar
                  </button>
                )}

                {job.status === 'closed' && (
                  <span className="text-xs text-gray-400 italic px-3 py-1.5">
                    Vacante cerrada
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
