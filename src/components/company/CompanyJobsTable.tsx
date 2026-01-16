'use client';

import { useState } from 'react';
import { Edit2, Eye, XCircle, Pause, Play, Users, Clock, AlertTriangle, Send, CheckCircle, Ban } from 'lucide-react';

interface Job {
  id: number;
  title: string;
  location: string;
  salary: string;
  status: string;
  closedReason?: string; // 'success' | 'cancelled'
  jobType: string;
  workMode: string;
  createdAt: string;
  expiresAt?: string;
  editableUntil?: string; // Límite de 4 horas para editar
  applicationCount?: number;
  _count?: {
    applications: number;
  };
}

interface CompanyJobsTableProps {
  jobs: Job[];
  onEdit?: (jobId: number) => void;
  onView?: (jobId: number) => void;
  onClose?: (jobId: number, reason: 'success' | 'cancelled') => void;
  onPause?: (jobId: number) => void;
  onResume?: (jobId: number) => void;
  onViewCandidates?: (jobId: number, jobTitle: string) => void;
  onPublish?: (jobId: number) => void;
}

type JobTab = 'active' | 'paused' | 'expired' | 'draft' | 'closed';

export default function CompanyJobsTable({
  jobs,
  onEdit,
  onView,
  onClose,
  onPause,
  onResume,
  onViewCandidates,
  onPublish
}: CompanyJobsTableProps) {
  const [activeTab, setActiveTab] = useState<JobTab>('active');

  // Determinar si un job está expirado
  const isExpired = (job: Job) => {
    if (!job.expiresAt) return false;
    return new Date(job.expiresAt) <= new Date() && job.status === 'active';
  };

  // Determinar si aún se puede editar (dentro de 4 horas)
  const canEdit = (job: Job) => {
    // Borradores siempre son editables
    if (job.status === 'draft') return true;
    // Vacantes activas: verificar tiempo límite
    if (!job.editableUntil) return true;
    return new Date(job.editableUntil) > new Date();
  };

  // Obtener tiempo restante para editar
  const getEditTimeRemaining = (job: Job) => {
    // No mostrar contador para borradores
    if (job.status === 'draft') return null;
    if (!job.editableUntil) return null;
    const now = new Date();
    const editableUntil = new Date(job.editableUntil);
    const diff = editableUntil.getTime() - now.getTime();
    if (diff <= 0) return null;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) return `${hours}h ${minutes}m para editar`;
    return `${minutes}m para editar`;
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

    // Si está cerrada, mostrar el motivo
    if (job.status === 'closed') {
      if (job.closedReason === 'success') {
        return (
          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 flex items-center gap-1">
            <CheckCircle className="w-3 h-3" />
            Contratación exitosa
          </span>
        );
      } else {
        return (
          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-600 flex items-center gap-1">
            <Ban className="w-3 h-3" />
            Cancelada
          </span>
        );
      }
    }

    const badges: Record<string, { bg: string; text: string; label: string }> = {
      active: { bg: 'bg-green-100', text: 'text-green-800', label: 'Activa' },
      paused: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'En pausa' },
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
      <div className="p-4 md:p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg md:text-xl font-bold text-gray-900">Mis Vacantes</h2>
          <span className="text-xs md:text-sm text-gray-500">{jobs.length} total</span>
        </div>

        {/* Tabs - scrollable en móvil */}
        <div className="overflow-x-auto -mx-4 md:mx-0 px-4 md:px-0">
          <div className="flex gap-2 min-w-max md:flex-wrap">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-3 md:px-4 py-2 text-xs md:text-sm font-medium rounded-lg transition-all duration-200 flex items-center gap-1.5 md:gap-2 whitespace-nowrap ${
                  activeTab === tab.key
                    ? 'bg-button-orange text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {tab.label}
                <span className={`px-1.5 md:px-2 py-0.5 text-xs rounded-full ${
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
              {/* Layout responsive: stack en móvil, row en desktop */}
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                {/* Info principal */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <h3 className="text-base md:text-lg font-semibold text-gray-900 break-words">{job.title}</h3>
                    {getStatusBadge(job)}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 md:gap-4 text-sm text-gray-600">
                    <span>{job.location}</span>
                    <span className="hidden md:inline text-gray-300">|</span>
                    <span>{job.salary}</span>
                    <span className="hidden md:inline text-gray-300">|</span>
                    <span className="hidden sm:inline">{job.jobType}</span>
                    <span className="hidden md:inline text-gray-300">|</span>
                    <span>{job.workMode === 'remote' ? 'Remoto' : job.workMode === 'hybrid' ? 'Híbrido' : 'Presencial'}</span>
                  </div>
                </div>

                {/* Métricas - horizontal en móvil, vertical en desktop */}
                <div className="flex items-center justify-start md:justify-end gap-4 md:gap-6">
                  {/* Candidatos - Clickeable */}
                  <button
                    onClick={() => onViewCandidates?.(job.id, job.title)}
                    className="text-center group cursor-pointer"
                    title="Ver candidatos de esta vacante"
                  >
                    <div className="flex items-center justify-center w-10 h-10 md:w-12 md:h-12 bg-blue-100 text-blue-700 rounded-full font-bold text-base md:text-lg group-hover:bg-blue-200 group-hover:scale-110 transition-all duration-200">
                      {getApplicationCount(job)}
                    </div>
                    <span className="text-xs text-gray-500 mt-1 block group-hover:text-blue-600 transition-colors">
                      Candidatos
                    </span>
                  </button>

                  {/* Fecha de publicación */}
                  <div className="text-center">
                    <div className="flex items-center justify-center w-10 h-10 md:w-12 md:h-12 bg-gray-100 text-gray-600 rounded-full">
                      <Clock className="w-4 h-4 md:w-5 md:h-5" />
                    </div>
                    <span className="text-xs text-gray-500 mt-1 block">{formatDate(job.createdAt)}</span>
                  </div>
                </div>
              </div>

              {/* Acciones - wrap en móvil */}
              <div className="flex flex-wrap items-center justify-center md:justify-end gap-2 mt-4 pt-4 border-t border-gray-100">
                {onView && (
                  <button
                    onClick={() => onView(job.id)}
                    className="px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-1"
                  >
                    <Eye className="w-4 h-4" />
                    Ver
                  </button>
                )}

                {onEdit && job.status !== 'closed' && canEdit(job) && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onEdit(job.id)}
                      className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-1"
                    >
                      <Edit2 className="w-4 h-4" />
                      Editar
                    </button>
                    {getEditTimeRemaining(job) && (
                      <span className="text-xs text-orange-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {getEditTimeRemaining(job)}
                      </span>
                    )}
                  </div>
                )}

                {/* Publicar borrador */}
                {onPublish && job.status === 'draft' && (
                  <button
                    onClick={() => onPublish(job.id)}
                    className="px-3 py-1.5 text-sm text-white bg-button-green hover:bg-green-700 rounded-lg transition-colors flex items-center gap-1 font-medium"
                  >
                    <Send className="w-4 h-4" />
                    Publicar
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

                {/* Cerrar - Dos opciones */}
                {onClose && (job.status === 'active' || job.status === 'paused') && (
                  <>
                    <button
                      onClick={() => onClose(job.id, 'success')}
                      className="px-3 py-1.5 text-sm text-green-600 hover:bg-green-50 rounded-lg transition-colors flex items-center gap-1"
                      title="Cerrar vacante por contratación exitosa"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Exitosa
                    </button>
                    <button
                      onClick={() => onClose(job.id, 'cancelled')}
                      className="px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-1"
                      title="Cancelar vacante sin contratar"
                    >
                      <Ban className="w-4 h-4" />
                      Cancelar
                    </button>
                  </>
                )}

                {job.status === 'closed' && (
                  <span className={`text-xs italic px-3 py-1.5 ${
                    job.closedReason === 'success' ? 'text-green-600' : 'text-gray-400'
                  }`}>
                    {job.closedReason === 'success' ? '✓ Contratación exitosa' : 'Vacante cancelada'}
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
