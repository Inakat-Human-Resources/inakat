// RUTA: src/app/admin/page.tsx

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Briefcase,
  Users,
  Building2,
  FileText,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Eye,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  ArrowUpDown,
  X,
  MapPin,
  Calendar,
  Banknote,
  Monitor,
  GraduationCap,
  BarChart3,
  Loader2,
  ChevronRight
} from 'lucide-react';

interface Job {
  id: number;
  title: string;
  company: string;
  location: string;
  status: string;
  profile: string | null;
  seniority: string | null;
  createdAt: string;
  editableUntil?: string | null; // Límite de 4 horas para editar
  userId: number | null;
  salary?: string;
  jobType?: string;
  workMode?: string;
  description?: string;
  requirements?: string | null;
  habilidades?: string | null;
  responsabilidades?: string | null;
  resultadosEsperados?: string | null;
  valoresActitudes?: string | null;
  informacionAdicional?: string | null;
  expiresAt?: string | null;
  creditCost?: number;
  user?: {
    id: number;
    nombre: string;
    email: string;
  } | null;
  _count?: {
    applications: number;
  };
}

interface DashboardStats {
  totalJobs: number;
  activeJobs: number;
  pausedJobs: number;
  draftJobs: number;
  closedJobs: number;
  totalApplications: number;
  pendingRequests: number;
  totalCandidates: number;
  totalCompanies: number;
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats>({
    totalJobs: 0,
    activeJobs: 0,
    pausedJobs: 0,
    draftJobs: 0,
    closedJobs: 0,
    totalApplications: 0,
    pendingRequests: 0,
    totalCandidates: 0,
    totalCompanies: 0
  });
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filteredJobs, setFilteredJobs] = useState<Job[]>([]);
  const [companies, setCompanies] = useState<string[]>([]);
  const [profiles, setProfiles] = useState<string[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<string>('');
  const [selectedProfile, setSelectedProfile] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Pipeline modal
  const [pipelineJobId, setPipelineJobId] = useState<number | null>(null);
  const [pipelineData, setPipelineData] = useState<any>(null);
  const [loadingPipeline, setLoadingPipeline] = useState(false);
  const [expandedStage, setExpandedStage] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);

  // Estado para ordenamiento de tabla
  const [sortField, setSortField] = useState<string>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    // Filtrar vacantes cuando cambia la empresa, especialidad o status seleccionado
    let filtered = jobs;
    if (selectedCompany) {
      filtered = filtered.filter(j => j.company === selectedCompany);
    }
    if (selectedProfile) {
      filtered = filtered.filter(j => j.profile === selectedProfile);
    }
    if (selectedStatus) {
      filtered = filtered.filter(j => j.status === selectedStatus);
    }
    setFilteredJobs(filtered);
  }, [selectedCompany, selectedProfile, selectedStatus, jobs]);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch múltiples endpoints en paralelo
      const [jobsRes, requestsRes, candidatesRes, applicationsRes] = await Promise.all([
        fetch('/api/jobs'),
        fetch('/api/company-requests'),
        fetch('/api/admin/candidates'),
        fetch('/api/applications')
      ]);

      const [jobsData, requestsData, candidatesData, applicationsData] = await Promise.all([
        jobsRes.json(),
        requestsRes.json(),
        candidatesRes.json(),
        applicationsRes.json()
      ]);

      // Procesar vacantes
      if (jobsData.success) {
        const allJobs = jobsData.data || [];
        setJobs(allJobs);
        setFilteredJobs(allJobs);

        // Extraer empresas únicas
        const uniqueCompanies = [...new Set(allJobs.map((j: Job) => j.company))].sort() as string[];
        setCompanies(uniqueCompanies);

        // Extraer especialidades únicas (excluyendo null/undefined)
        const uniqueProfiles = [...new Set(allJobs.map((j: Job) => j.profile).filter(Boolean))].sort() as string[];
        setProfiles(uniqueProfiles);

        // Calcular stats de vacantes
        setStats(prev => ({
          ...prev,
          totalJobs: allJobs.length,
          activeJobs: allJobs.filter((j: Job) => j.status === 'active').length,
          pausedJobs: allJobs.filter((j: Job) => j.status === 'paused').length,
          draftJobs: allJobs.filter((j: Job) => j.status === 'draft').length,
          closedJobs: allJobs.filter((j: Job) => j.status === 'closed').length,
          totalCompanies: uniqueCompanies.length
        }));
      }

      // Solicitudes pendientes
      if (requestsData.success) {
        const pendingCount = (requestsData.data || []).filter(
          (r: any) => r.status === 'pending'
        ).length;
        setStats(prev => ({ ...prev, pendingRequests: pendingCount }));
      }

      // Total candidatos
      if (candidatesData.success) {
        setStats(prev => ({ ...prev, totalCandidates: candidatesData.data?.length || 0 }));
      }

      // Total aplicaciones
      if (applicationsData.success) {
        setStats(prev => ({ ...prev, totalApplications: applicationsData.data?.length || 0 }));
      }

    } catch (err) {
      console.error('Error fetching dashboard:', err);
      setError('Error al cargar datos del dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch pipeline de una vacante
  const fetchPipeline = async (jobId: number) => {
    setPipelineJobId(jobId);
    setLoadingPipeline(true);
    setPipelineData(null);
    setExpandedStage(null);
    setFilterStatus(null);

    try {
      const res = await fetch(`/api/admin/jobs/${jobId}/pipeline`);
      const data = await res.json();
      if (data.success) {
        setPipelineData(data.data);
      }
    } catch (err) {
      console.error('Error fetching pipeline:', err);
    } finally {
      setLoadingPipeline(false);
    }
  };

  // Helper: obtener aplicaciones filtradas por status
  const getFilteredApplications = (status: string): any[] => {
    if (!pipelineData?.applications) return [];
    if (status === 'pending') {
      return pipelineData.applications.filter((a: any) =>
        a.status === 'pending' || a.status === 'injected_by_admin'
      );
    }
    return pipelineData.applications.filter((a: any) => a.status === status);
  };

  // Helper: label legible de status
  const getStatusLabel = (status: string): string => {
    const labels: Record<string, string> = {
      pending: 'Por revisar',
      reviewing: 'En revisión',
      sent_to_specialist: 'Enviados a especialista',
      discarded: 'Descartados',
      evaluating: 'Evaluando',
      sent_to_company: 'Enviados a empresa',
      company_interested: 'Le interesan',
      interested: 'Le interesan',
      interviewed: 'Entrevistados',
      rejected: 'Rechazados',
      accepted: 'Contratados'
    };
    return labels[status] || status;
  };

  // Función para manejar ordenamiento
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Ordenar jobs filtrados
  const sortedJobs = [...filteredJobs].sort((a, b) => {
    let aVal: any;
    let bVal: any;

    switch (sortField) {
      case 'title':
        aVal = a.title?.toLowerCase() || '';
        bVal = b.title?.toLowerCase() || '';
        break;
      case 'company':
        aVal = a.company?.toLowerCase() || '';
        bVal = b.company?.toLowerCase() || '';
        break;
      case 'location':
        aVal = a.location?.toLowerCase() || '';
        bVal = b.location?.toLowerCase() || '';
        break;
      case 'createdAt':
        aVal = new Date(a.createdAt).getTime();
        bVal = new Date(b.createdAt).getTime();
        break;
      case 'applications':
        aVal = a._count?.applications || 0;
        bVal = b._count?.applications || 0;
        break;
      case 'status':
        aVal = a.status || '';
        bVal = b.status || '';
        break;
      case 'profile':
        aVal = a.profile?.toLowerCase() || '';
        bVal = b.profile?.toLowerCase() || '';
        break;
      default:
        aVal = '';
        bVal = '';
    }

    let comparison = 0;
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      comparison = aVal.localeCompare(bVal);
    } else {
      comparison = aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
    }

    return sortDirection === 'asc' ? comparison : -comparison;
  });

  // Componente para header ordenable
  const SortableHeader = ({
    field,
    children,
    className = ''
  }: {
    field: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <th
      onClick={() => handleSort(field)}
      className={`px-4 py-3 text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 select-none transition-colors ${className}`}
    >
      <div className="flex items-center gap-1 justify-start">
        {children}
        {sortField === field ? (
          sortDirection === 'asc' ? (
            <ChevronUp size={14} className="text-blue-600" />
          ) : (
            <ChevronDown size={14} className="text-blue-600" />
          )
        ) : (
          <ArrowUpDown size={14} className="text-gray-400" />
        )}
      </div>
    </th>
  );

  const getStatusBadge = (status: string) => {
    const configs: Record<string, { bg: string; text: string; icon: React.ReactNode; label: string }> = {
      active: { bg: 'bg-green-100', text: 'text-green-800', icon: <CheckCircle size={14} />, label: 'Activa' },
      paused: { bg: 'bg-orange-100', text: 'text-orange-800', icon: <AlertCircle size={14} />, label: 'Pausada' },
      draft: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: <Clock size={14} />, label: 'Borrador' },
      closed: { bg: 'bg-gray-100', text: 'text-gray-800', icon: <XCircle size={14} />, label: 'Cerrada' }
    };
    const config = configs[status] || configs.draft;

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
        {config.icon}
        {config.label}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="animate-spin mx-auto mb-4 text-blue-600" size={40} />
          <p className="text-gray-600">Cargando dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto py-8 px-4">
        {/* Header - Responsive */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-6 md:mb-8">
          <div>
            <h1 className="text-2xl md:text-4xl font-bold text-gray-800 mb-1 md:mb-2">
              Dashboard Admin
            </h1>
            <p className="text-gray-600 text-sm md:text-base">
              Vista general de INAKAT
            </p>
          </div>
          <button
            onClick={fetchDashboardData}
            className="px-3 py-2 bg-white border rounded-lg hover:bg-gray-50 flex items-center gap-2 text-sm"
          >
            <RefreshCw size={18} />
            <span className="hidden sm:inline">Actualizar</span>
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg flex items-center gap-2">
            <AlertCircle size={20} />
            {error}
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Vacantes Totales</p>
                <p className="text-3xl font-bold text-gray-900">{stats.totalJobs}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {stats.activeJobs} activas, {stats.draftJobs} borradores
                </p>
                {stats.pausedJobs > 0 && (
                  <p className="text-xs text-orange-600 font-medium mt-1 flex items-center gap-1">
                    <AlertCircle size={12} />
                    {stats.pausedJobs} pausada{stats.pausedJobs !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
              <Briefcase className="text-blue-500" size={40} />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Candidatos</p>
                <p className="text-3xl font-bold text-gray-900">{stats.totalCandidates}</p>
                <p className="text-xs text-gray-500 mt-1">En banco de talentos</p>
              </div>
              <Users className="text-green-500" size={40} />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-purple-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Aplicaciones</p>
                <p className="text-3xl font-bold text-gray-900">{stats.totalApplications}</p>
                <p className="text-xs text-gray-500 mt-1">Total recibidas</p>
              </div>
              <FileText className="text-purple-500" size={40} />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-orange-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Solicitudes Pendientes</p>
                <p className="text-3xl font-bold text-gray-900">{stats.pendingRequests}</p>
                <p className="text-xs text-gray-500 mt-1">
                  <Link href="/admin/requests" className="text-orange-600 hover:underline">
                    Ver solicitudes
                  </Link>
                </p>
              </div>
              <Building2 className="text-orange-500" size={40} />
            </div>
          </div>
        </div>

        {/* Sección de vacantes */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-gray-800">
                  Vacantes de Todas las Empresas
                </h2>
                <p className="text-gray-600 text-sm">
                  {stats.totalCompanies} empresas con vacantes publicadas
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600">Estado:</label>
                  <div className="relative">
                    <select
                      value={selectedStatus}
                      onChange={(e) => setSelectedStatus(e.target.value)}
                      className={`appearance-none px-4 py-2 pr-10 border rounded-lg bg-white focus:ring-2 focus:ring-blue-500 min-w-[140px] ${
                        selectedStatus === 'paused' ? 'border-orange-400 bg-orange-50' : ''
                      }`}
                    >
                      <option value="">Todos</option>
                      <option value="active">Activas</option>
                      <option value="paused">Pausadas</option>
                      <option value="draft">Borradores</option>
                      <option value="closed">Cerradas</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" size={20} />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600">Empresa:</label>
                  <div className="relative">
                    <select
                      value={selectedCompany}
                      onChange={(e) => setSelectedCompany(e.target.value)}
                      className="appearance-none px-4 py-2 pr-10 border rounded-lg bg-white focus:ring-2 focus:ring-blue-500 min-w-[180px]"
                    >
                      <option value="">Todas</option>
                      {companies.map(company => (
                        <option key={company} value={company}>{company}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" size={20} />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600">Especialidad:</label>
                  <div className="relative">
                    <select
                      value={selectedProfile}
                      onChange={(e) => setSelectedProfile(e.target.value)}
                      className="appearance-none px-4 py-2 pr-10 border rounded-lg bg-white focus:ring-2 focus:ring-blue-500 min-w-[180px]"
                    >
                      <option value="">Todas</option>
                      {profiles.map(profile => (
                        <option key={profile} value={profile}>{profile}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" size={20} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tabla de vacantes */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <SortableHeader field="title" className="text-left">Vacante</SortableHeader>
                  <SortableHeader field="company" className="text-left">Empresa</SortableHeader>
                  <SortableHeader field="profile" className="text-left">Especialidad</SortableHeader>
                  <SortableHeader field="location" className="text-left">Ubicación</SortableHeader>
                  <SortableHeader field="applications">Candidatos</SortableHeader>
                  <SortableHeader field="status">Estado</SortableHeader>
                  <SortableHeader field="createdAt">Fecha</SortableHeader>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Pipeline</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sortedJobs.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-gray-500">
                      <Briefcase className="mx-auto mb-2 text-gray-400" size={40} />
                      {selectedCompany || selectedProfile
                        ? 'No hay vacantes con los filtros seleccionados'
                        : 'No hay vacantes registradas'
                      }
                    </td>
                  </tr>
                ) : (
                  sortedJobs.slice(0, 20).map(job => (
                    <tr key={job.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-gray-900">{job.title}</p>
                          {job.seniority && (
                            <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                              {job.seniority}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-gray-900 font-medium">{job.company}</p>
                      </td>
                      <td className="px-4 py-3">
                        {job.profile ? (
                          <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded font-medium">
                            {job.profile}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-gray-600">{job.location}</p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => router.push(`/admin/assign-candidates?jobId=${job.id}`)}
                          className="inline-flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-800 rounded-full font-semibold text-sm hover:bg-blue-200 hover:scale-110 transition-all cursor-pointer"
                          title="Ver candidatos asignados"
                        >
                          {job._count?.applications || 0}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {getStatusBadge(job.status)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="text-sm">
                          <p className="text-gray-700 font-medium">
                            {new Date(job.createdAt).toLocaleDateString('es-MX', {
                              day: '2-digit',
                              month: 'short'
                            })}, {new Date(job.createdAt).toLocaleTimeString('es-MX', {
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: false
                            })}
                          </p>
                          {job.editableUntil && (
                            new Date(job.editableUntil) > new Date() ? (
                              <span className="text-xs text-orange-600 flex items-center justify-center gap-1 mt-1">
                                <Clock size={12} />
                                Editable hasta {new Date(job.editableUntil).toLocaleTimeString('es-MX', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  hour12: false
                                })}
                              </span>
                            ) : (
                              <span className="text-xs text-green-600 flex items-center justify-center gap-1 mt-1">
                                <CheckCircle size={12} />
                                Listo para procesar
                              </span>
                            )
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => fetchPipeline(job.id)}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 text-sm"
                          title="Ver pipeline"
                        >
                          <BarChart3 size={14} />
                          Pipeline
                        </button>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => {
                            setSelectedJob(job);
                            setIsModalOpen(true);
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 text-sm"
                        >
                          <Eye size={14} />
                          Ver
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          {sortedJobs.length > 20 && (
            <div className="p-4 border-t text-center">
              <p className="text-sm text-gray-500">
                Mostrando 20 de {sortedJobs.length} vacantes
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modal de detalles de vacante */}
      {isModalOpen && selectedJob && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header del modal */}
            <div className="flex justify-between items-start p-6 border-b bg-gray-50">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{selectedJob.title}</h2>
                <p className="text-gray-600 flex items-center gap-2 mt-1">
                  <Building2 size={16} />
                  {selectedJob.company}
                </p>
              </div>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setSelectedJob(null);
                }}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X size={24} />
              </button>
            </div>

            {/* Contenido del modal con scroll */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Info básica en grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                <div className="flex items-center gap-2 text-sm">
                  <MapPin size={16} className="text-gray-400" />
                  <span>{selectedJob.location}</span>
                </div>
                {selectedJob.salary && (
                  <div className="flex items-center gap-2 text-sm">
                    <Banknote size={16} className="text-gray-400" />
                    <span>{selectedJob.salary}</span>
                  </div>
                )}
                {selectedJob.jobType && (
                  <div className="flex items-center gap-2 text-sm">
                    <Clock size={16} className="text-gray-400" />
                    <span>{selectedJob.jobType}</span>
                  </div>
                )}
                {selectedJob.workMode && (
                  <div className="flex items-center gap-2 text-sm">
                    <Monitor size={16} className="text-gray-400" />
                    <span>
                      {selectedJob.workMode === 'remote' ? 'Remoto' :
                       selectedJob.workMode === 'hybrid' ? 'Híbrido' : 'Presencial'}
                    </span>
                  </div>
                )}
                {selectedJob.profile && (
                  <div className="flex items-center gap-2 text-sm">
                    <Briefcase size={16} className="text-gray-400" />
                    <span>{selectedJob.profile}</span>
                  </div>
                )}
                {selectedJob.seniority && (
                  <div className="flex items-center gap-2 text-sm">
                    <GraduationCap size={16} className="text-gray-400" />
                    <span>{selectedJob.seniority}</span>
                  </div>
                )}
              </div>

              {/* Badges de estado */}
              <div className="flex flex-wrap gap-2 mb-6">
                {getStatusBadge(selectedJob.status)}
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  <Users size={14} />
                  {selectedJob._count?.applications || 0} candidatos
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                  <Calendar size={14} />
                  {new Date(selectedJob.createdAt).toLocaleDateString('es-MX', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric'
                  })}, {new Date(selectedJob.createdAt).toLocaleTimeString('es-MX', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false
                  })}
                </span>
                {selectedJob.editableUntil && (
                  new Date(selectedJob.editableUntil) > new Date() ? (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                      <Clock size={14} />
                      Editable hasta {new Date(selectedJob.editableUntil).toLocaleTimeString('es-MX', {
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false
                      })}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                      <CheckCircle size={14} />
                      Listo para procesar
                    </span>
                  )
                )}
              </div>

              {/* Descripción */}
              {selectedJob.description && (
                <div className="mb-6">
                  <h3 className="font-semibold text-gray-900 mb-2">Descripción</h3>
                  <p className="text-gray-700 whitespace-pre-wrap text-sm">{selectedJob.description}</p>
                </div>
              )}

              {/* Requisitos */}
              {selectedJob.requirements && (
                <div className="mb-6">
                  <h3 className="font-semibold text-gray-900 mb-2">Requisitos</h3>
                  <p className="text-gray-700 whitespace-pre-wrap text-sm">{selectedJob.requirements}</p>
                </div>
              )}

              {/* Responsabilidades */}
              {selectedJob.responsabilidades && (
                <div className="mb-6">
                  <h3 className="font-semibold text-gray-900 mb-2">Responsabilidades</h3>
                  <p className="text-gray-700 whitespace-pre-wrap text-sm">{selectedJob.responsabilidades}</p>
                </div>
              )}

              {/* Habilidades */}
              {selectedJob.habilidades && (
                <div className="mb-6">
                  <h3 className="font-semibold text-gray-900 mb-2">Habilidades</h3>
                  <p className="text-gray-700 whitespace-pre-wrap text-sm">{selectedJob.habilidades}</p>
                </div>
              )}

              {/* Resultados Esperados */}
              {selectedJob.resultadosEsperados && (
                <div className="mb-6">
                  <h3 className="font-semibold text-gray-900 mb-2">Resultados Esperados</h3>
                  <p className="text-gray-700 whitespace-pre-wrap text-sm">{selectedJob.resultadosEsperados}</p>
                </div>
              )}

              {/* Valores y Actitudes */}
              {selectedJob.valoresActitudes && (
                <div className="mb-6">
                  <h3 className="font-semibold text-gray-900 mb-2">Valores y Actitudes</h3>
                  <p className="text-gray-700 whitespace-pre-wrap text-sm">{selectedJob.valoresActitudes}</p>
                </div>
              )}

              {/* Información Adicional */}
              {selectedJob.informacionAdicional && (
                <div className="mb-6">
                  <h3 className="font-semibold text-gray-900 mb-2">Información Adicional</h3>
                  <p className="text-gray-700 whitespace-pre-wrap text-sm">{selectedJob.informacionAdicional}</p>
                </div>
              )}
            </div>

            {/* Footer del modal */}
            <div className="flex justify-between items-center p-4 border-t bg-gray-50">
              <Link
                href={`/admin/assign-candidates?jobId=${selectedJob.id}`}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <Users size={16} />
                Ver/Asignar Candidatos
              </Link>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setSelectedJob(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Pipeline */}
      {pipelineJobId !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex justify-between items-start p-6 border-b bg-gray-50">
              <div>
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <BarChart3 size={20} className="text-purple-600" />
                  Pipeline de Candidatos
                </h2>
                {pipelineData?.job && (
                  <div className="mt-1">
                    <p className="text-sm font-medium text-gray-700">{pipelineData.job.title}</p>
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <Building2 size={12} />
                      {pipelineData.job.company}
                    </p>
                  </div>
                )}
              </div>
              <button
                onClick={() => { setPipelineJobId(null); setPipelineData(null); setFilterStatus(null); }}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X size={24} />
              </button>
            </div>

            {/* Contenido */}
            <div className="flex-1 overflow-y-auto p-6">
              {loadingPipeline ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
                </div>
              ) : pipelineData ? (
                <div className="space-y-6">
                  {/* Barra visual del pipeline */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                      <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Reclutador</p>
                      <p className="text-2xl font-bold text-blue-800 mt-1">{pipelineData.stageTotals.recruiter}</p>
                    </div>
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-center">
                      <p className="text-xs font-semibold text-purple-600 uppercase tracking-wider">Especialista</p>
                      <p className="text-2xl font-bold text-purple-800 mt-1">{pipelineData.stageTotals.specialist}</p>
                    </div>
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                      <p className="text-xs font-semibold text-green-600 uppercase tracking-wider">Empresa</p>
                      <p className="text-2xl font-bold text-green-800 mt-1">{pipelineData.stageTotals.company}</p>
                    </div>
                  </div>

                  {/* Total */}
                  <p className="text-sm text-gray-500 text-center">
                    {pipelineData.total} candidato{pipelineData.total !== 1 ? 's' : ''} en total
                  </p>

                  {/* Secciones colapsables */}
                  {/* Reclutador */}
                  <div className="border border-blue-200 rounded-lg overflow-hidden">
                    <button
                      onClick={() => { setExpandedStage(expandedStage === 'recruiter' ? null : 'recruiter'); setFilterStatus(null); }}
                      className="w-full flex items-center justify-between p-3 bg-blue-50 hover:bg-blue-100 transition-colors"
                    >
                      <span className="font-semibold text-blue-800 text-sm flex items-center gap-2">
                        <FileText size={16} />
                        Reclutador
                      </span>
                      <ChevronRight size={16} className={`text-blue-600 transition-transform ${expandedStage === 'recruiter' ? 'rotate-90' : ''}`} />
                    </button>
                    {expandedStage === 'recruiter' && (
                      <div className="p-3 space-y-1">
                        {[
                          { key: 'pending', label: 'Por revisar', count: pipelineData.stages.recruiter.pending },
                          { key: 'reviewing', label: 'En revisión', count: pipelineData.stages.recruiter.reviewing },
                          { key: 'sent_to_specialist', label: 'Enviados a especialista', count: pipelineData.stages.recruiter.sent_to_specialist },
                          { key: 'discarded', label: 'Descartados', count: pipelineData.stages.recruiter.discarded }
                        ].map(item => (
                          <button
                            key={item.key}
                            onClick={() => setFilterStatus(filterStatus === item.key ? null : item.key)}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                              filterStatus === item.key
                                ? 'bg-blue-100 text-blue-800'
                                : 'hover:bg-gray-50 text-gray-700'
                            }`}
                          >
                            <span>{item.label}</span>
                            <span className={`font-bold ${item.count > 0 ? 'text-blue-700' : 'text-gray-400'}`}>{item.count}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Especialista */}
                  <div className="border border-purple-200 rounded-lg overflow-hidden">
                    <button
                      onClick={() => { setExpandedStage(expandedStage === 'specialist' ? null : 'specialist'); setFilterStatus(null); }}
                      className="w-full flex items-center justify-between p-3 bg-purple-50 hover:bg-purple-100 transition-colors"
                    >
                      <span className="font-semibold text-purple-800 text-sm flex items-center gap-2">
                        <GraduationCap size={16} />
                        Especialista
                      </span>
                      <ChevronRight size={16} className={`text-purple-600 transition-transform ${expandedStage === 'specialist' ? 'rotate-90' : ''}`} />
                    </button>
                    {expandedStage === 'specialist' && (
                      <div className="p-3 space-y-1">
                        {[
                          { key: 'evaluating', label: 'Evaluando', count: pipelineData.stages.specialist.evaluating },
                          { key: 'sent_to_company', label: 'Enviados a empresa', count: pipelineData.stages.specialist.sent_to_company }
                        ].map(item => (
                          <button
                            key={item.key}
                            onClick={() => setFilterStatus(filterStatus === item.key ? null : item.key)}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                              filterStatus === item.key
                                ? 'bg-purple-100 text-purple-800'
                                : 'hover:bg-gray-50 text-gray-700'
                            }`}
                          >
                            <span>{item.label}</span>
                            <span className={`font-bold ${item.count > 0 ? 'text-purple-700' : 'text-gray-400'}`}>{item.count}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Empresa */}
                  <div className="border border-green-200 rounded-lg overflow-hidden">
                    <button
                      onClick={() => { setExpandedStage(expandedStage === 'company' ? null : 'company'); setFilterStatus(null); }}
                      className="w-full flex items-center justify-between p-3 bg-green-50 hover:bg-green-100 transition-colors"
                    >
                      <span className="font-semibold text-green-800 text-sm flex items-center gap-2">
                        <Building2 size={16} />
                        Empresa
                      </span>
                      <ChevronRight size={16} className={`text-green-600 transition-transform ${expandedStage === 'company' ? 'rotate-90' : ''}`} />
                    </button>
                    {expandedStage === 'company' && (
                      <div className="p-3 space-y-1">
                        {[
                          { key: 'company_interested', label: 'Le interesan', count: pipelineData.stages.company.interested },
                          { key: 'interviewed', label: 'Entrevistados', count: pipelineData.stages.company.interviewed },
                          { key: 'rejected', label: 'Rechazados', count: pipelineData.stages.company.rejected },
                          { key: 'accepted', label: 'Contratados', count: pipelineData.stages.company.accepted }
                        ].map(item => (
                          <button
                            key={item.key}
                            onClick={() => setFilterStatus(filterStatus === item.key ? null : item.key)}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                              filterStatus === item.key
                                ? 'bg-green-100 text-green-800'
                                : 'hover:bg-gray-50 text-gray-700'
                            }`}
                          >
                            <span>{item.label}</span>
                            <span className={`font-bold ${item.count > 0 ? 'text-green-700' : 'text-gray-400'}`}>{item.count}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Lista de candidatos filtrados */}
                  {filterStatus && (
                    <div className="border rounded-lg">
                      <div className="p-3 bg-gray-50 border-b flex items-center justify-between">
                        <h4 className="font-semibold text-sm text-gray-700">
                          {getStatusLabel(filterStatus)} ({getFilteredApplications(filterStatus).length})
                        </h4>
                        <button
                          onClick={() => setFilterStatus(null)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <X size={16} />
                        </button>
                      </div>
                      <div className="divide-y max-h-60 overflow-y-auto">
                        {getFilteredApplications(filterStatus).length === 0 ? (
                          <p className="p-4 text-sm text-gray-500 text-center">No hay candidatos en esta etapa</p>
                        ) : (
                          getFilteredApplications(filterStatus).map((app: any) => (
                            <div key={app.id} className="p-3 flex items-center justify-between hover:bg-gray-50">
                              <div>
                                <p className="text-sm font-medium text-gray-900">{app.candidateName}</p>
                                <p className="text-xs text-gray-500">{app.candidateEmail}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-gray-400">
                                  {new Date(app.updatedAt).toLocaleDateString('es-MX', {
                                    day: '2-digit',
                                    month: 'short'
                                  })}
                                </p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-8">Error al cargar pipeline</p>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-between items-center p-4 border-t bg-gray-50">
              {pipelineData?.job && (
                <Link
                  href={`/admin/assign-candidates?jobId=${pipelineData.job.id}`}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm"
                >
                  <Users size={16} />
                  Ver/Asignar Candidatos
                </Link>
              )}
              <button
                onClick={() => { setPipelineJobId(null); setPipelineData(null); setFilterStatus(null); }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 text-sm"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
