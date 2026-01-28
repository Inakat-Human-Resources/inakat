// RUTA: src/app/recruiter/dashboard/page.tsx

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Briefcase,
  Users,
  ChevronRight,
  Loader2,
  AlertCircle,
  Building2,
  MapPin,
  CheckCircle
} from 'lucide-react';

// Key para localStorage de candidatos vistos
const VIEWED_CANDIDATES_KEY = 'inakat_viewed_candidates_recruiter';

interface Application {
  id: number;
  status: string;
}

interface Assignment {
  id: number;
  jobId: number;
  job: {
    id: number;
    title: string;
    company: string;
    location: string;
    workMode: string;
    profile: string;
    applications: Application[];
    user: {
      nombre: string;
      companyRequest?: {
        nombreEmpresa: string;
      };
    };
  };
  specialist?: {
    id: number;
    nombre: string;
    apellidoPaterno: string;
  };
}

interface JobSummary {
  id: number;
  jobId: number;
  title: string;
  company: string;
  location: string;
  workMode: string;
  profile: string;
  totalCandidates: number;
  pendingCandidates: number;
  unseenCandidates: number;
  hasSpecialist: boolean;
  specialistName: string | null;
}

export default function RecruiterDashboard() {
  const router = useRouter();
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/recruiter/dashboard');

      if (response.status === 401) {
        router.push('/login?redirect=/recruiter/dashboard');
        return;
      }

      if (response.status === 403) {
        setError('No tienes permisos de reclutador');
        return;
      }

      const data = await response.json();

      if (data.success) {
        // Transformar assignments a JobSummary
        const viewedIds = getViewedCandidates();
        const jobSummaries: JobSummary[] = data.data.assignments.map((a: Assignment) => {
          const applications = a.job.applications || [];
          const pendingApps = applications.filter(
            (app: Application) => app.status === 'pending' || app.status === 'injected_by_admin'
          );
          const unseenApps = applications.filter(
            (app: Application) => !viewedIds.includes(app.id)
          );

          return {
            id: a.id,
            jobId: a.jobId,
            title: a.job.title,
            company: a.job.user?.companyRequest?.nombreEmpresa || a.job.company,
            location: a.job.location,
            workMode: a.job.workMode,
            profile: a.job.profile,
            totalCandidates: applications.length,
            pendingCandidates: pendingApps.length,
            unseenCandidates: unseenApps.length,
            hasSpecialist: !!a.specialist,
            specialistName: a.specialist
              ? `${a.specialist.nombre} ${a.specialist.apellidoPaterno}`
              : null
          };
        });

        setJobs(jobSummaries);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Error de conexión');
    } finally {
      setIsLoading(false);
    }
  };

  const getViewedCandidates = (): number[] => {
    if (typeof window === 'undefined') return [];
    try {
      return JSON.parse(localStorage.getItem(VIEWED_CANDIDATES_KEY) || '[]');
    } catch {
      return [];
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
        <Loader2 className="animate-spin text-button-green" size={40} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="mx-auto text-red-500 mb-4" size={48} />
          <p className="text-gray-600">{error}</p>
          <button
            onClick={fetchDashboard}
            className="mt-4 px-4 py-2 bg-button-green text-white rounded-lg hover:bg-green-700"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
            Dashboard Reclutador
          </h1>
          <p className="text-gray-600 mt-1">
            Selecciona una vacante para gestionar sus candidatos
          </p>
        </div>

        {/* Lista de vacantes */}
        {jobs.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border p-12 text-center">
            <Briefcase className="mx-auto text-gray-300 mb-4" size={48} />
            <p className="text-gray-500">No tienes vacantes asignadas</p>
          </div>
        ) : (
          <div className="space-y-4">
            {jobs.map((job) => (
              <div
                key={job.id}
                onClick={() => router.push(`/recruiter/jobs/${job.jobId}`)}
                className="bg-white rounded-lg shadow-sm border p-4 hover:shadow-md hover:border-green-300 transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    {/* Título y badges */}
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <h3 className="font-semibold text-lg text-gray-900 group-hover:text-green-700 transition-colors">
                        {job.title}
                      </h3>
                      {job.profile && (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                          {job.profile}
                        </span>
                      )}
                      {!job.hasSpecialist && (
                        <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded-full flex items-center gap-1">
                          <AlertCircle size={12} />
                          Sin especialista
                        </span>
                      )}
                    </div>

                    {/* Info de la empresa y ubicación */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Building2 size={14} />
                        {job.company}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin size={14} />
                        {job.location}
                      </span>
                      <span className="px-2 py-0.5 bg-gray-100 rounded text-xs">
                        {getWorkModeLabel(job.workMode)}
                      </span>
                    </div>

                    {/* Estadísticas de candidatos */}
                    <div className="flex flex-wrap items-center gap-4 mt-3">
                      <span className="flex items-center gap-1.5 text-sm text-gray-600">
                        <Users size={16} className="text-gray-400" />
                        <span className="font-medium">{job.totalCandidates}</span> candidatos
                      </span>

                      {job.pendingCandidates > 0 && (
                        <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full font-medium">
                          {job.pendingCandidates} por revisar
                        </span>
                      )}

                      {job.unseenCandidates > 0 && (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-medium animate-pulse">
                          {job.unseenCandidates} sin ver
                        </span>
                      )}

                      {job.hasSpecialist && (
                        <span className="hidden sm:flex items-center gap-1 text-xs text-purple-600">
                          <CheckCircle size={12} />
                          {job.specialistName}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Flecha */}
                  <div className="flex-shrink-0 ml-4">
                    <ChevronRight
                      size={24}
                      className="text-gray-300 group-hover:text-green-500 transition-colors"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
