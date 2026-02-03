'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Briefcase,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  FileText,
  AlertCircle
} from 'lucide-react';
import CompanyLogo from '@/components/shared/CompanyLogo';

interface Job {
  id: number;
  title: string;
  company: string;
  location: string;
  salary: string;
  jobType: string;
  workMode: string;
  status: string;
  logoUrl?: string | null; // FEAT-1b: Logo de empresa
}

interface Application {
  id: number;
  candidateName: string;
  candidateEmail: string;
  candidatePhone: string | null;
  coverLetter: string | null;
  cvUrl: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  reviewedAt: string | null;
  job: Job;
}

interface Stats {
  total: number;
  pending: number;
  reviewing: number;
  interviewed: number;
  accepted: number;
  rejected: number;
}

interface ApplicationsData {
  applications: Application[];
  stats: Stats;
}

export default function MyApplicationsPage() {
  const router = useRouter();
  const [data, setData] = useState<ApplicationsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    fetchApplications();
  }, []);

  const fetchApplications = async () => {
    try {
      const response = await fetch('/api/my-applications');

      if (response.status === 401) {
        router.push('/login?redirect=/my-applications');
        return;
      }

      if (!response.ok) {
        throw new Error('Error al cargar aplicaciones');
      }

      const result = await response.json();

      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error || 'Error desconocido');
      }
    } catch (err) {
      console.error('Error fetching applications:', err);
      setError('Error al cargar las aplicaciones');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: {
      [key: string]: { bg: string; text: string; label: string };
    } = {
      pending: {
        bg: 'bg-yellow-100',
        text: 'text-yellow-800',
        label: 'Pendiente'
      },
      reviewing: {
        bg: 'bg-blue-100',
        text: 'text-blue-800',
        label: 'En Revisión'
      },
      interviewed: {
        bg: 'bg-purple-100',
        text: 'text-purple-800',
        label: 'Entrevistado'
      },
      accepted: {
        bg: 'bg-green-100',
        text: 'text-green-800',
        label: 'Aceptado'
      },
      rejected: { bg: 'bg-red-100', text: 'text-red-800', label: 'Rechazado' }
    };

    const badge = badges[status] || badges.pending;

    return (
      <span
        className={`px-3 py-1 rounded-full text-sm font-medium ${badge.bg} ${badge.text}`}
      >
        {badge.label}
      </span>
    );
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-5 h-5 text-yellow-600" />;
      case 'reviewing':
        return <Eye className="w-5 h-5 text-blue-600" />;
      case 'interviewed':
        return <FileText className="w-5 h-5 text-purple-600" />;
      case 'accepted':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'rejected':
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return <Clock className="w-5 h-5 text-gray-600" />;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const filteredApplications =
    filterStatus === 'all'
      ? data?.applications || []
      : data?.applications.filter((app) => app.status === filterStatus) || [];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-custom-beige">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-button-orange mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando aplicaciones...</p>
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
            {error || 'No se pudieron cargar las aplicaciones'}
          </p>
          <button
            onClick={() => router.push('/talents')}
            className="px-6 py-2 bg-button-orange text-white rounded-lg hover:bg-opacity-90 transition-colors"
          >
            Ver Vacantes
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-custom-beige py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-title-dark mb-1 md:mb-2">
            Mis Aplicaciones
          </h1>
          <p className="text-gray-600 text-sm md:text-base">Seguimiento de tus postulaciones</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between mb-2">
              <Briefcase className="w-5 h-5 text-gray-500" />
              <span className="text-2xl font-bold text-gray-900">
                {data.stats.total}
              </span>
            </div>
            <p className="text-sm text-gray-600">Total</p>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between mb-2">
              <Clock className="w-5 h-5 text-yellow-500" />
              <span className="text-2xl font-bold text-yellow-600">
                {data.stats.pending}
              </span>
            </div>
            <p className="text-sm text-gray-600">Pendientes</p>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between mb-2">
              <Eye className="w-5 h-5 text-blue-500" />
              <span className="text-2xl font-bold text-blue-600">
                {data.stats.reviewing}
              </span>
            </div>
            <p className="text-sm text-gray-600">En Revisión</p>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between mb-2">
              <FileText className="w-5 h-5 text-purple-500" />
              <span className="text-2xl font-bold text-purple-600">
                {data.stats.interviewed}
              </span>
            </div>
            <p className="text-sm text-gray-600">Entrevistados</p>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between mb-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span className="text-2xl font-bold text-green-600">
                {data.stats.accepted}
              </span>
            </div>
            <p className="text-sm text-gray-600">Aceptados</p>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between mb-2">
              <XCircle className="w-5 h-5 text-red-500" />
              <span className="text-2xl font-bold text-red-600">
                {data.stats.rejected}
              </span>
            </div>
            <p className="text-sm text-gray-600">Rechazados</p>
          </div>
        </div>

        {/* Filters - Scrollable on mobile */}
        <div className="bg-white rounded-lg shadow p-3 md:p-4 mb-6 overflow-x-auto">
          <div className="flex gap-2 min-w-max md:flex-wrap">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filterStatus === 'all'
                  ? 'bg-button-orange text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Todas ({data.stats.total})
            </button>
            <button
              onClick={() => setFilterStatus('pending')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filterStatus === 'pending'
                  ? 'bg-yellow-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Pendientes ({data.stats.pending})
            </button>
            <button
              onClick={() => setFilterStatus('reviewing')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filterStatus === 'reviewing'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              En Revisión ({data.stats.reviewing})
            </button>
            <button
              onClick={() => setFilterStatus('interviewed')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filterStatus === 'interviewed'
                  ? 'bg-purple-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Entrevistados ({data.stats.interviewed})
            </button>
            <button
              onClick={() => setFilterStatus('accepted')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filterStatus === 'accepted'
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Aceptados ({data.stats.accepted})
            </button>
            <button
              onClick={() => setFilterStatus('rejected')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filterStatus === 'rejected'
                  ? 'bg-red-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Rechazados ({data.stats.rejected})
            </button>
          </div>
        </div>

        {/* Applications List */}
        {filteredApplications.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <Briefcase className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              No hay aplicaciones
            </h3>
            <p className="text-gray-600 mb-4">
              {filterStatus === 'all'
                ? 'Aún no has aplicado a ninguna vacante'
                : `No tienes aplicaciones con estado "${filterStatus}"`}
            </p>
            <button
              onClick={() => router.push('/talents')}
              className="px-6 py-2 bg-button-orange text-white rounded-lg hover:bg-opacity-90 transition-colors"
            >
              Explorar Vacantes
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredApplications.map((application) => (
              <div
                key={application.id}
                className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6"
              >
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  {/* Left Side - Job Info */}
                  <div className="flex-1">
                    <div className="flex items-start gap-3 mb-3">
                      <CompanyLogo
                        logoUrl={application.job.logoUrl}
                        companyName={application.job.company}
                        size="md"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {application.job.title}
                          </h3>
                          {getStatusIcon(application.status)}
                        </div>
                        <p className="text-gray-600 mb-2">
                          {application.job.company} • {application.job.location}
                        </p>
                        <div className="flex flex-wrap gap-2 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <Briefcase className="w-4 h-4" />
                            {application.job.jobType}
                          </span>
                          <span>•</span>
                          <span>{application.job.salary}</span>
                        </div>
                      </div>
                    </div>

                    {application.notes && (
                      <div className="mt-3 p-3 bg-gray-50 rounded border-l-4 border-button-orange">
                        <p className="text-sm text-gray-700">
                          <strong>Nota de la empresa:</strong>{' '}
                          {application.notes}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Right Side - Status & Date */}
                  <div className="flex flex-col items-end gap-3">
                    {getStatusBadge(application.status)}
                    <div className="text-sm text-gray-500">
                      Aplicado: {formatDate(application.createdAt)}
                    </div>
                    {application.reviewedAt && (
                      <div className="text-sm text-gray-500">
                        Revisado: {formatDate(application.reviewedAt)}
                      </div>
                    )}
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
