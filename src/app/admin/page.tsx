// RUTA: src/app/admin/page.tsx

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Briefcase,
  Users,
  Building2,
  FileText,
  TrendingUp,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Eye,
  ArrowRight,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  ArrowUpDown,
  DollarSign,
  Settings,
  Layers
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
  userId: number | null;
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
  draftJobs: number;
  closedJobs: number;
  totalApplications: number;
  pendingRequests: number;
  totalCandidates: number;
  totalCompanies: number;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalJobs: 0,
    activeJobs: 0,
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
  const [selectedCompany, setSelectedCompany] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Estado para ordenamiento de tabla
  const [sortField, setSortField] = useState<string>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    // Filtrar vacantes cuando cambia la empresa seleccionada
    if (selectedCompany) {
      setFilteredJobs(jobs.filter(j => j.company === selectedCompany));
    } else {
      setFilteredJobs(jobs);
    }
  }, [selectedCompany, jobs]);

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

        // Calcular stats de vacantes
        setStats(prev => ({
          ...prev,
          totalJobs: allJobs.length,
          activeJobs: allJobs.filter((j: Job) => j.status === 'active').length,
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
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-800 mb-2">
              Dashboard Administrativo
            </h1>
            <p className="text-gray-600">
              Vista general de INAKAT
            </p>
          </div>
          <button
            onClick={fetchDashboardData}
            className="px-4 py-2 bg-white border rounded-lg hover:bg-gray-50 flex items-center gap-2"
          >
            <RefreshCw size={20} />
            Actualizar
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

        {/* Accesos rápidos - Grid responsive 2 columnas en móvil, 4 en desktop */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-8">
          <Link
            href="/admin/requests"
            className="bg-white rounded-lg shadow p-3 md:p-4 hover:shadow-md transition-shadow flex items-center gap-2 md:gap-3"
          >
            <div className="p-2 md:p-3 bg-orange-100 rounded-lg flex-shrink-0">
              <Building2 className="text-orange-600" size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm md:text-base truncate">Solicitudes</p>
              <p className="text-xs md:text-sm text-gray-500 truncate">Empresas</p>
            </div>
            <ArrowRight className="hidden sm:block ml-auto text-gray-400 flex-shrink-0" size={18} />
          </Link>

          <Link
            href="/admin/candidates"
            className="bg-white rounded-lg shadow p-3 md:p-4 hover:shadow-md transition-shadow flex items-center gap-2 md:gap-3"
          >
            <div className="p-2 md:p-3 bg-green-100 rounded-lg flex-shrink-0">
              <Users className="text-green-600" size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm md:text-base truncate">Candidatos</p>
              <p className="text-xs md:text-sm text-gray-500 truncate">Banco talentos</p>
            </div>
            <ArrowRight className="hidden sm:block ml-auto text-gray-400 flex-shrink-0" size={18} />
          </Link>

          <Link
            href="/admin/assign-candidates"
            className="bg-white rounded-lg shadow p-3 md:p-4 hover:shadow-md transition-shadow flex items-center gap-2 md:gap-3"
          >
            <div className="p-2 md:p-3 bg-blue-100 rounded-lg flex-shrink-0">
              <TrendingUp className="text-blue-600" size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm md:text-base truncate">Asignar</p>
              <p className="text-xs md:text-sm text-gray-500 truncate">Candidatos</p>
            </div>
            <ArrowRight className="hidden sm:block ml-auto text-gray-400 flex-shrink-0" size={18} />
          </Link>

          <Link
            href="/admin/users"
            className="bg-white rounded-lg shadow p-3 md:p-4 hover:shadow-md transition-shadow flex items-center gap-2 md:gap-3"
          >
            <div className="p-2 md:p-3 bg-purple-100 rounded-lg flex-shrink-0">
              <Users className="text-purple-600" size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm md:text-base truncate">Usuarios</p>
              <p className="text-xs md:text-sm text-gray-500 truncate">Internos</p>
            </div>
            <ArrowRight className="hidden sm:block ml-auto text-gray-400 flex-shrink-0" size={18} />
          </Link>

          <Link
            href="/admin/pricing"
            className="bg-white rounded-lg shadow p-3 md:p-4 hover:shadow-md transition-shadow flex items-center gap-2 md:gap-3"
          >
            <div className="p-2 md:p-3 bg-emerald-100 rounded-lg flex-shrink-0">
              <DollarSign className="text-emerald-600" size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm md:text-base truncate">Precios</p>
              <p className="text-xs md:text-sm text-gray-500 truncate">Matriz créditos</p>
            </div>
            <ArrowRight className="hidden sm:block ml-auto text-gray-400 flex-shrink-0" size={18} />
          </Link>

          <Link
            href="/admin/credit-packages"
            className="bg-white rounded-lg shadow p-3 md:p-4 hover:shadow-md transition-shadow flex items-center gap-2 md:gap-3"
          >
            <div className="p-2 md:p-3 bg-cyan-100 rounded-lg flex-shrink-0">
              <Layers className="text-cyan-600" size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm md:text-base truncate">Paquetes</p>
              <p className="text-xs md:text-sm text-gray-500 truncate">Créditos</p>
            </div>
            <ArrowRight className="hidden sm:block ml-auto text-gray-400 flex-shrink-0" size={18} />
          </Link>

          <Link
            href="/admin/specialties"
            className="bg-white rounded-lg shadow p-3 md:p-4 hover:shadow-md transition-shadow flex items-center gap-2 md:gap-3"
          >
            <div className="p-2 md:p-3 bg-indigo-100 rounded-lg flex-shrink-0">
              <Settings className="text-indigo-600" size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm md:text-base truncate">Perfiles</p>
              <p className="text-xs md:text-sm text-gray-500 truncate">Especialidades</p>
            </div>
            <ArrowRight className="hidden sm:block ml-auto text-gray-400 flex-shrink-0" size={18} />
          </Link>

          <Link
            href="/admin/assignments"
            className="bg-white rounded-lg shadow p-3 md:p-4 hover:shadow-md transition-shadow flex items-center gap-2 md:gap-3"
          >
            <div className="p-2 md:p-3 bg-pink-100 rounded-lg flex-shrink-0">
              <Briefcase className="text-pink-600" size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm md:text-base truncate">Asignaciones</p>
              <p className="text-xs md:text-sm text-gray-500 truncate">Vacantes</p>
            </div>
            <ArrowRight className="hidden sm:block ml-auto text-gray-400 flex-shrink-0" size={18} />
          </Link>
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

              <div className="flex items-center gap-3">
                <label className="text-sm text-gray-600">Filtrar por empresa:</label>
                <div className="relative">
                  <select
                    value={selectedCompany}
                    onChange={(e) => setSelectedCompany(e.target.value)}
                    className="appearance-none px-4 py-2 pr-10 border rounded-lg bg-white focus:ring-2 focus:ring-blue-500 min-w-[200px]"
                  >
                    <option value="">Todas las empresas</option>
                    {companies.map(company => (
                      <option key={company} value={company}>{company}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" size={20} />
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
                  <SortableHeader field="location" className="text-left">Ubicación</SortableHeader>
                  <SortableHeader field="applications">Candidatos</SortableHeader>
                  <SortableHeader field="status">Estado</SortableHeader>
                  <SortableHeader field="createdAt">Fecha</SortableHeader>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sortedJobs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                      <Briefcase className="mx-auto mb-2 text-gray-400" size={40} />
                      {selectedCompany
                        ? `No hay vacantes para ${selectedCompany}`
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
                          <div className="flex gap-2 mt-1">
                            {job.profile && (
                              <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                                {job.profile}
                              </span>
                            )}
                            {job.seniority && (
                              <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                                {job.seniority}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-gray-900 font-medium">{job.company}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-gray-600">{job.location}</p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-800 rounded-full font-semibold text-sm">
                          {job._count?.applications || 0}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {getStatusBadge(job.status)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <p className="text-sm text-gray-500">
                          {new Date(job.createdAt).toLocaleDateString('es-MX', {
                            day: '2-digit',
                            month: 'short'
                          })}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Link
                          href={`/admin/assign-candidates?jobId=${job.id}`}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 text-sm"
                        >
                          <Eye size={14} />
                          Ver
                        </Link>
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
    </div>
  );
}
