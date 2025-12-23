// RUTA: src/app/company/dashboard/page.tsx

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Briefcase,
  Users,
  Clock,
  CheckCircle,
  XCircle,
  Heart,
  AlertCircle,
  Coins,
  Pause,
  AlertTriangle
} from 'lucide-react';
import StatCard from '@/components/company/StatCard';
import CompanyJobsTable from '@/components/company/CompanyJobsTable';
import CompanyApplicationsTable from '@/components/company/CompanyApplicationsTable';
import JobDetailModal from '@/components/company/JobDetailModal';

interface Job {
  id: number;
  title: string;
  company: string;
  location: string;
  salary: string;
  jobType: string;
  workMode: string;
  description: string;
  requirements?: string;
  status: string;
  profile?: string;
  seniority?: string;
  createdAt: string;
  expiresAt?: string;
  applicationCount?: number;
  _count?: {
    applications: number;
  };
}

interface DashboardData {
  company: {
    userId: number;
    userName: string;
    email: string;
    credits: number;
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
      paused: number;
      expired: number;
      closed: number;
      draft: number;
    };
    applications: {
      total: number;
      pendingReview: number; // Candidatos por revisar (sent_to_company)
      interested: number; // Candidatos marcados "Me interesa"
      interviewed: number;
      accepted: number;
      rejected: number;
    };
  };
  recentApplications: any[];
  allApplications: any[];
  jobStats: any[];
  allJobs: Job[];
}

export default function CompanyDashboard() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [showJobModal, setShowJobModal] = useState(false);

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
    if (!data) return;
    const job = data.allJobs.find((j) => j.id === jobId);
    if (job) {
      setSelectedJob(job);
      setShowJobModal(true);
    }
  };

  const handleEditJob = (jobId: number) => {
    router.push(`/create-job?edit=${jobId}`);
  };

  const handlePauseJob = async (jobId: number) => {
    if (!confirm('¿Estás seguro de pausar esta vacante? Los candidatos no podrán aplicar mientras esté pausada.')) {
      return;
    }

    try {
      const response = await fetch(`/api/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'paused' })
      });

      if (response.ok) {
        fetchDashboardData();
      } else {
        const result = await response.json();
        alert(result.error || 'Error al pausar la vacante');
      }
    } catch (error) {
      console.error('Error pausing job:', error);
      alert('Error al pausar la vacante');
    }
  };

  const handleResumeJob = async (jobId: number) => {
    try {
      const response = await fetch(`/api/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'active' })
      });

      if (response.ok) {
        fetchDashboardData();
      } else {
        const result = await response.json();
        alert(result.error || 'Error al reanudar la vacante');
      }
    } catch (error) {
      console.error('Error resuming job:', error);
      alert('Error al reanudar la vacante');
    }
  };

  const handleCloseJob = async (jobId: number) => {
    if (!confirm('¿Estás seguro de cerrar esta vacante? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      const response = await fetch(`/api/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'closed' })
      });

      if (response.ok) {
        fetchDashboardData();
      } else {
        const result = await response.json();
        alert(result.error || 'Error al cerrar la vacante');
      }
    } catch (error) {
      console.error('Error closing job:', error);
      alert('Error al cerrar la vacante');
    }
  };

  const handleApplicationStatusChange = async (
    applicationId: number,
    newStatus: string
  ) => {
    try {
      // Usar la API específica de empresa para actualizar status
      const response = await fetch(`/api/company/applications/${applicationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });

      const result = await response.json();

      if (response.ok) {
        // Actualizar datos localmente para respuesta inmediata
        setData((prevData) => {
          if (!prevData) return prevData;

          return {
            ...prevData,
            allApplications: prevData.allApplications.map((app) =>
              app.id === applicationId ? { ...app, status: newStatus } : app
            ),
            recentApplications: prevData.recentApplications.map((app) =>
              app.id === applicationId ? { ...app, status: newStatus } : app
            )
          };
        });

        // Recargar para actualizar estadísticas completas
        fetchDashboardData();
      } else {
        alert(result.error || 'Error al actualizar el estado');
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
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-title-dark mb-2">
              Dashboard de {data.company.companyInfo.nombreEmpresa}
            </h1>
            <p className="text-gray-600">Bienvenido, {data.company.userName}</p>
          </div>
          <div className="flex items-center gap-4">
            {/* Saldo de créditos */}
            <div className="bg-white px-4 py-2 rounded-lg shadow-sm border border-gray-200 flex items-center gap-2">
              <Coins className="text-yellow-500" size={20} />
              <span className="font-semibold text-gray-700">
                {data.company.credits} créditos
              </span>
            </div>
            <button
              onClick={() => router.push('/create-job')}
              className="px-6 py-3 bg-button-green text-white font-bold rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
            >
              <Briefcase size={20} />
              CREAR VACANTE
            </button>
          </div>
        </div>

        {/* Estadísticas Principales - Vacantes */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <StatCard
            title="Vacantes Activas"
            value={data.stats.jobs.active}
            icon={Briefcase}
            color="green"
          />
          <StatCard
            title="En Pausa"
            value={data.stats.jobs.paused}
            icon={Pause}
            color="yellow"
          />
          <StatCard
            title="Expiradas"
            value={data.stats.jobs.expired}
            icon={AlertTriangle}
            color="orange"
          />
          <StatCard
            title="Borradores"
            value={data.stats.jobs.draft}
            icon={Clock}
            color="gray"
          />
          <StatCard
            title="Cerradas"
            value={data.stats.jobs.closed}
            icon={XCircle}
            color="red"
          />
        </div>

        {/* Estadísticas de Candidatos */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <StatCard
            title="Por Revisar"
            value={data.stats.applications.pendingReview}
            icon={Users}
            color="blue"
            subtitle="Nuevos candidatos"
          />
          <StatCard
            title="Me Interesan"
            value={data.stats.applications.interested}
            icon={Heart}
            color="pink"
          />
          <StatCard
            title="Entrevistados"
            value={data.stats.applications.interviewed}
            icon={Users}
            color="purple"
          />
          <StatCard
            title="Aceptados"
            value={data.stats.applications.accepted}
            icon={CheckCircle}
            color="green"
          />
          <StatCard
            title="Descartados"
            value={data.stats.applications.rejected}
            icon={XCircle}
            color="gray"
          />
        </div>

        {/* Tabla de Vacantes */}
        <div className="mb-8">
          <CompanyJobsTable
            jobs={data.allJobs}
            onView={handleViewJob}
            onEdit={handleEditJob}
            onClose={handleCloseJob}
            onPause={handlePauseJob}
            onResume={handleResumeJob}
          />
        </div>

        {/* Tabla de Candidatos */}
        <div>
          <CompanyApplicationsTable
            applications={data.allApplications}
            onStatusChange={handleApplicationStatusChange}
          />
        </div>
      </div>

      {/* Job Detail Modal */}
      <JobDetailModal
        job={selectedJob}
        isOpen={showJobModal}
        onClose={() => setShowJobModal(false)}
      />
    </div>
  );
}
