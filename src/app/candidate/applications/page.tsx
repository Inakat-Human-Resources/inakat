// RUTA: src/app/candidate/applications/page.tsx

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Briefcase,
  MapPin,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  Calendar,
  DollarSign,
  ExternalLink
} from 'lucide-react';
import CompanyLogo from '@/components/shared/CompanyLogo';

interface Application {
  id: number;
  jobId: number;
  candidateName: string;
  candidateEmail: string;
  status: string;
  statusLabel: string;
  statusColor: string;
  createdAt: string;
  updatedAt: string;
  job: {
    id: number;
    title: string;
    company: string;
    location: string;
    salary: string;
    jobType: string;
    workMode: string;
    status: string;
    profile: string | null;
    seniority: string | null;
    logoUrl?: string | null; // FEAT-1: Logo de empresa
  };
}

interface CandidateInfo {
  id: number;
  nombre: string;
  email: string;
}

export default function CandidateApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [candidate, setCandidate] = useState<CandidateInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchApplications();
  }, []);

  const fetchApplications = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/candidate/applications', {
        credentials: 'include'
      });
      const data = await response.json();

      if (data.success) {
        setApplications(data.data);
        setCandidate(data.candidate);
      } else {
        setError(data.error || 'Error al cargar postulaciones');
      }
    } catch (err) {
      setError('Error de conexión');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'accepted':
        return <CheckCircle className="text-green-500" size={20} />;
      case 'rejected':
        return <XCircle className="text-gray-500" size={20} />;
      case 'interviewed':
        return <CheckCircle className="text-indigo-500" size={20} />;
      default:
        return <Clock className="text-yellow-500" size={20} />;
    }
  };

  const getStatusBadgeClass = (color: string) => {
    const colors: Record<string, string> = {
      yellow: 'bg-yellow-100 text-yellow-800',
      blue: 'bg-blue-100 text-blue-800',
      purple: 'bg-purple-100 text-purple-800',
      indigo: 'bg-indigo-100 text-indigo-800',
      green: 'bg-green-100 text-green-800',
      gray: 'bg-gray-100 text-gray-800'
    };
    return colors[color] || colors.yellow;
  };

  const getWorkModeLabel = (workMode: string) => {
    const modes: Record<string, string> = {
      remote: 'Remoto',
      hybrid: 'Híbrido',
      presential: 'Presencial'
    };
    return modes[workMode] || workMode;
  };

  // Estadísticas
  const stats = {
    total: applications.length,
    inProcess: applications.filter(a =>
      ['pending', 'injected_by_admin', 'reviewing', 'sent_to_specialist', 'sent_to_company'].includes(a.status)
    ).length,
    interviewed: applications.filter(a => a.status === 'interviewed').length,
    accepted: applications.filter(a => a.status === 'accepted').length
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="animate-spin mx-auto mb-4 text-blue-600" size={40} />
          <p className="text-gray-600">Cargando tus postulaciones...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto py-8 px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            Mis Postulaciones
          </h1>
          {candidate && (
            <p className="text-gray-600">
              Hola, {candidate.nombre}. Aquí puedes ver el estado de tus postulaciones.
            </p>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg flex items-center gap-2">
            <AlertCircle size={20} />
            {error}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
            <div className="flex items-center gap-3">
              <Briefcase className="text-blue-500" size={24} />
              <div>
                <p className="text-sm text-gray-600">Total</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-yellow-500">
            <div className="flex items-center gap-3">
              <Clock className="text-yellow-500" size={24} />
              <div>
                <p className="text-sm text-gray-600">En Proceso</p>
                <p className="text-2xl font-bold">{stats.inProcess}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-indigo-500">
            <div className="flex items-center gap-3">
              <CheckCircle className="text-indigo-500" size={24} />
              <div>
                <p className="text-sm text-gray-600">Entrevistado</p>
                <p className="text-2xl font-bold">{stats.interviewed}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
            <div className="flex items-center gap-3">
              <CheckCircle className="text-green-500" size={24} />
              <div>
                <p className="text-sm text-gray-600">Aceptado</p>
                <p className="text-2xl font-bold">{stats.accepted}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Lista de postulaciones */}
        {applications.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <Briefcase className="mx-auto mb-4 text-gray-400" size={48} />
            <h2 className="text-xl font-semibold text-gray-700 mb-2">
              No tienes postulaciones aún
            </h2>
            <p className="text-gray-500 mb-6">
              Cuando apliques a vacantes, aparecerán aquí para que puedas darles seguimiento.
            </p>
            <Link
              href="/talents"
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Briefcase size={20} />
              Ver Vacantes Disponibles
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {applications.map(app => (
              <div
                key={app.id}
                className="bg-white rounded-lg shadow hover:shadow-md transition-shadow"
              >
                <div className="p-6">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    {/* Info de la vacante */}
                    <div className="flex-1">
                      <div className="flex items-start gap-3">
                        <CompanyLogo
                          logoUrl={app.job.logoUrl}
                          companyName={app.job.company}
                          size="md"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-semibold text-gray-900">
                              {app.job.title}
                            </h3>
                            {getStatusIcon(app.status)}
                          </div>
                          <p className="text-gray-600 mt-1">{app.job.company}</p>
                        </div>
                      </div>

                      {/* Detalles */}
                      <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <MapPin size={14} />
                          {app.job.location}
                        </div>
                        <div className="flex items-center gap-1">
                          <DollarSign size={14} />
                          {app.job.salary}
                        </div>
                        <div className="flex items-center gap-1">
                          <Briefcase size={14} />
                          {app.job.jobType}
                        </div>
                        <span className="px-2 py-0.5 bg-gray-100 rounded text-xs">
                          {getWorkModeLabel(app.job.workMode)}
                        </span>
                      </div>

                      {/* Tags */}
                      {(app.job.profile || app.job.seniority) && (
                        <div className="mt-3 flex gap-2">
                          {app.job.profile && (
                            <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs">
                              {app.job.profile}
                            </span>
                          )}
                          {app.job.seniority && (
                            <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                              {app.job.seniority}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Status y fecha */}
                    <div className="flex flex-col items-end gap-2">
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusBadgeClass(
                          app.statusColor
                        )}`}
                      >
                        {app.statusLabel}
                      </span>
                      <div className="flex items-center gap-1 text-sm text-gray-500">
                        <Calendar size={14} />
                        Aplicado: {new Date(app.createdAt).toLocaleDateString('es-MX', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Mensaje según status */}
                  {app.status === 'accepted' && (
                    <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-green-800 text-sm">
                        ¡Felicidades! Has sido seleccionado para este puesto. La empresa se pondrá en contacto contigo pronto.
                      </p>
                    </div>
                  )}

                  {app.status === 'interviewed' && (
                    <div className="mt-4 p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
                      <p className="text-indigo-800 text-sm">
                        Tu entrevista ha sido registrada. El equipo está evaluando tu perfil.
                      </p>
                    </div>
                  )}

                  {app.status === 'sent_to_company' && (
                    <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                      <p className="text-purple-800 text-sm">
                        ¡Buenas noticias! Tu perfil ha sido enviado a la empresa. Pronto podrías recibir noticias.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Refresh button */}
        <div className="mt-8 text-center">
          <button
            onClick={fetchApplications}
            className="inline-flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900"
          >
            <RefreshCw size={16} />
            Actualizar
          </button>
        </div>
      </div>
    </div>
  );
}
