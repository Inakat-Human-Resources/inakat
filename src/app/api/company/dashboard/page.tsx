'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Briefcase,
  Users,
  Clock,
  CheckCircle,
  XCircle,
  FileText,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import StatCard from '@/components/company/StatCard';
import CompanyJobsTable from '@/components/company/CompanyJobsTable';
import CompanyApplicationsTable from '@/components/company/CompanyApplicationsTable';

interface DashboardData {
  company: {
    userId: number;
    userName: string;
    email: string;
    companyInfo: {
      nombreEmpresa: string;
      correoEmpresa: string;
      sitioWeb?: string;
      rfc: string;
      direccionEmpresa: string;
    };
  };
  stats: {
    jobs: {
      total: number;
      active: number;
      closed: number;
      draft: number;
    };
    applications: {
      total: number;
      pending: number;
      reviewing: number;
      interviewed: number;
      accepted: number;
      rejected: number;
    };
  };
  recentApplications: any[];
  topJobs: any[];
  jobStats: any[];
  allJobs: any[];
}

export default function CompanyDashboard() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const response = await fetch('/api/company/dashboard');

      if (response.status === 401) {
        router.push('/login?redirect=/company/dashboard');
        return;
      }

      if (response.status === 403) {
        setError('No tienes permisos para acceder a este dashboard');
        return;
      }

      if (!response.ok) {
        throw new Error('Error al cargar el dashboard');
      }

      const result = await response.json();

      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error || 'Error desconocido');
      }
    } catch (err) {
      console.error('Error fetching dashboard:', err);
      setError('Error al cargar el dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleViewJob = (jobId: number) => {
    router.push(`/talents?jobId=${jobId}`);
  };

  const handleEditJob = (jobId: number) => {
    router.push(`/create-job?edit=${jobId}`);
  };

  const handleCloseJob = async (jobId: number) => {
    if (!confirm('¿Estás seguro de cerrar esta vacante?')) {
      return;
    }

    try {
      const response = await fetch(`/api/jobs/${jobId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'closed' })
      });

      if (response.ok) {
        alert('Vacante cerrada exitosamente');
        fetchDashboardData(); // Recargar datos
      } else {
        alert('Error al cerrar la vacante');
      }
    } catch (error) {
      console.error('Error closing job:', error);
      alert('Error al cerrar la vacante');
    }
  };

  const handleViewApplication = (applicationId: number) => {
    router.push(`/applications?id=${applicationId}`);
  };

  const handleApplicationStatusChange = async (
    applicationId: number,
    newStatus: string
  ) => {
    try {
      const response = await fetch(`/api/applications/${applicationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });

      if (response.ok) {
        // Actualizar localmente
        setData((prevData) => {
          if (!prevData) return prevData;

          return {
            ...prevData,
            recentApplications: prevData.recentApplications.map((app) =>
              app.id === applicationId ? { ...app, status: newStatus } : app
            )
          };
        });

        alert('Estado actualizado correctamente');
        fetchDashboardData(); // Recargar para actualizar estadísticas
      } else {
        alert('Error al actualizar el estado');
      }
    } catch (error) {
      console.error('Error updating application status:', error);
      alert('Error al actualizar el estado');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-custom-beige">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-button-orange mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando dashboard...</p>
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
            {error || 'No se pudo cargar el dashboard'}
          </p>
          <button
            onClick={() => router.push('/login')}
            className="px-6 py-2 bg-button-orange text-white rounded-lg hover:bg-opacity-90 transition-colors"
          >
            Ir al Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-custom-beige py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-title-dark mb-2">
            Dashboard de {data.company.companyInfo.nombreEmpresa}
          </h1>
          <p className="text-gray-600">Bienvenido, {data.company.userName}</p>
        </div>

        {/* Estadísticas Principales */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Vacantes Activas"
            value={data.stats.jobs.active}
            icon={Briefcase}
            color="green"
            subtitle={`${data.stats.jobs.total} total`}
          />
          <StatCard
            title="Aplicaciones Totales"
            value={data.stats.applications.total}
            icon={Users}
            color="blue"
          />
          <StatCard
            title="Pendientes de Revisar"
            value={data.stats.applications.pending}
            icon={Clock}
            color="orange"
          />
          <StatCard
            title="Candidatos Aceptados"
            value={data.stats.applications.accepted}
            icon={CheckCircle}
            color="purple"
          />
        </div>

        {/* Estadísticas Secundarias */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatCard
            title="En Revisión"
            value={data.stats.applications.reviewing}
            icon={FileText}
            color="blue"
          />
          <StatCard
            title="Entrevistados"
            value={data.stats.applications.interviewed}
            icon={TrendingUp}
            color="purple"
          />
          <StatCard
            title="Rechazados"
            value={data.stats.applications.rejected}
            icon={XCircle}
            color="red"
          />
        </div>

        {/* Vacantes con más aplicaciones */}
        {data.topJobs.length > 0 && (
          <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Vacantes con más aplicaciones
            </h2>
            <div className="space-y-3">
              {data.topJobs.map((job) => (
                <div
                  key={job.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {job.title}
                    </p>
                    <p className="text-xs text-gray-500">{job.location}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center justify-center w-10 h-10 bg-blue-100 text-blue-800 text-sm font-bold rounded-full">
                      {job.applicationCount}
                    </span>
                    <button
                      onClick={() => handleViewJob(job.id)}
                      className="text-sm text-button-orange hover:text-button-dark-green font-medium"
                    >
                      Ver →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tabla de Vacantes */}
        <div className="mb-8">
          <CompanyJobsTable
            jobs={data.allJobs}
            onView={handleViewJob}
            onEdit={handleEditJob}
            onClose={handleCloseJob}
          />
        </div>

        {/* Tabla de Aplicaciones Recientes */}
        <div>
          <CompanyApplicationsTable
            applications={data.recentApplications}
            onView={handleViewApplication}
            onStatusChange={handleApplicationStatusChange}
          />
        </div>
      </div>
    </div>
  );
}
