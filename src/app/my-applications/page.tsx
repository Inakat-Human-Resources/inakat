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
import { getCandidateStatusView } from '@/lib/application-status';

/** Clases del badge según el color que devuelve el mapa de estados. */
const CLASES_COLOR_ESTADO: Record<string, string> = {
  yellow: 'bg-yellow-100 text-yellow-800',
  blue: 'bg-blue-100 text-blue-800',
  purple: 'bg-purple-100 text-purple-800',
  indigo: 'bg-indigo-100 text-indigo-800',
  green: 'bg-green-100 text-green-800',
  gray: 'bg-gray-100 text-gray-800'
};

/**
 * Filtros de la página agrupados como los ve el candidato. Cada filtro cubre
 * todos los estados internos que comparten etiqueta: antes 'Pendientes' sólo
 * miraba `pending` y 'Rechazados' sólo `rejected`, así que una postulación
 * `discarded`, `evaluating` o `company_interested` no aparecía en ningún filtro
 * y las tarjetas no sumaban el total.
 */
const GRUPOS_FILTRO: Record<string, string[]> = {
  pending: ['pending', 'injected_by_admin'],
  reviewing: [
    'reviewing',
    'evaluating',
    'sent_to_specialist',
    'sent_to_company',
    'company_interested'
  ],
  interviewed: ['interviewed'],
  accepted: ['accepted'],
  rejected: ['rejected', 'discarded', 'archived']
};

/** Nombre de cada filtro, alineado con las etiquetas del mapa de estados. */
const NOMBRES_FILTRO: Record<string, string> = {
  pending: 'En revisión',
  reviewing: 'En proceso',
  interviewed: 'Entrevistados',
  accepted: 'Aceptados',
  rejected: 'No seleccionados'
};

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

  /**
   * La etiqueta sale del mapa ÚNICO de src/lib/application-status.ts, el mismo
   * que usan /api/candidate/applications, /api/my-applications y el modal de
   * postulación. Esta página tenía su propio mapa, así que el mismo registro se
   * leía 'Pendiente' aquí, 'En revisión' en /candidate/applications y 'En
   * proceso' en el modal.
   */
  const getStatusBadge = (status: string) => {
    const vista = getCandidateStatusView(status);
    const clases = CLASES_COLOR_ESTADO[vista.color] || CLASES_COLOR_ESTADO.yellow;

    return (
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${clases}`}>
        {vista.label}
      </span>
    );
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
      case 'injected_by_admin':
        return <Clock className="w-5 h-5 text-yellow-600" />;
      case 'reviewing':
      case 'evaluating':
      case 'sent_to_specialist':
      case 'sent_to_company':
      case 'company_interested':
        return <Eye className="w-5 h-5 text-blue-600" />;
      case 'interviewed':
        return <FileText className="w-5 h-5 text-purple-600" />;
      case 'accepted':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'rejected':
      case 'discarded':
      case 'archived':
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

  const todasLasAplicaciones = data?.applications || [];

  const filteredApplications =
    filterStatus === 'all'
      ? todasLasAplicaciones
      : todasLasAplicaciones.filter((app) =>
          (GRUPOS_FILTRO[filterStatus] || []).includes(app.status)
        );

  // Conteos por grupo calculados aquí, con los mismos grupos que el filtro:
  // los de la API cuentan estados sueltos y dejaban fuera `discarded`,
  // `evaluating`, `company_interested`, etc., así que las tarjetas no sumaban
  // el total y el número del botón no coincidía con lo que mostraba el filtro.
  const conteos: Stats = {
    total: todasLasAplicaciones.length,
    pending: 0,
    reviewing: 0,
    interviewed: 0,
    accepted: 0,
    rejected: 0
  };
  for (const app of todasLasAplicaciones) {
    for (const [grupo, estados] of Object.entries(GRUPOS_FILTRO)) {
      if (estados.includes(app.status)) {
        conteos[grupo as Exclude<keyof Stats, 'total'>]++;
        break;
      }
    }
  }

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
                {conteos.total}
              </span>
            </div>
            <p className="text-sm text-gray-600">Total</p>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between mb-2">
              <Clock className="w-5 h-5 text-yellow-500" />
              <span className="text-2xl font-bold text-yellow-600">
                {conteos.pending}
              </span>
            </div>
            <p className="text-sm text-gray-600">{NOMBRES_FILTRO.pending}</p>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between mb-2">
              <Eye className="w-5 h-5 text-blue-500" />
              <span className="text-2xl font-bold text-blue-600">
                {conteos.reviewing}
              </span>
            </div>
            <p className="text-sm text-gray-600">{NOMBRES_FILTRO.reviewing}</p>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between mb-2">
              <FileText className="w-5 h-5 text-purple-500" />
              <span className="text-2xl font-bold text-purple-600">
                {conteos.interviewed}
              </span>
            </div>
            <p className="text-sm text-gray-600">Entrevistados</p>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between mb-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span className="text-2xl font-bold text-green-600">
                {conteos.accepted}
              </span>
            </div>
            <p className="text-sm text-gray-600">Aceptados</p>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between mb-2">
              <XCircle className="w-5 h-5 text-red-500" />
              <span className="text-2xl font-bold text-red-600">
                {conteos.rejected}
              </span>
            </div>
            <p className="text-sm text-gray-600">{NOMBRES_FILTRO.rejected}</p>
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
              Todas ({conteos.total})
            </button>
            <button
              onClick={() => setFilterStatus('pending')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filterStatus === 'pending'
                  ? 'bg-yellow-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {NOMBRES_FILTRO.pending} ({conteos.pending})
            </button>
            <button
              onClick={() => setFilterStatus('reviewing')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filterStatus === 'reviewing'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {NOMBRES_FILTRO.reviewing} ({conteos.reviewing})
            </button>
            <button
              onClick={() => setFilterStatus('interviewed')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filterStatus === 'interviewed'
                  ? 'bg-purple-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Entrevistados ({conteos.interviewed})
            </button>
            <button
              onClick={() => setFilterStatus('accepted')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filterStatus === 'accepted'
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Aceptados ({conteos.accepted})
            </button>
            <button
              onClick={() => setFilterStatus('rejected')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filterStatus === 'rejected'
                  ? 'bg-red-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {NOMBRES_FILTRO.rejected} ({conteos.rejected})
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
                : `No tienes aplicaciones con estado "${NOMBRES_FILTRO[filterStatus] || filterStatus}"`}
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

                    {/* Application.notes NO se pinta aquí: es la nota INTERNA
                        que escriben admin, empresa y el inyector de candidatos
                        ("Candidato inyectado por Admin. Fuente original: occ…",
                        motivos de descarte). Se mostraba al candidato como
                        "Nota de la empresa". Cuando exista un campo público
                        (publicNote) se repone con ese. */}
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
