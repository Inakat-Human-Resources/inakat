// RUTA: src/app/company/dashboard/page.tsx

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Briefcase,
  AlertCircle,
  Coins,
  Plus
} from 'lucide-react';
import CompanyJobsTable from '@/components/company/CompanyJobsTable';
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
    } catch {
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

  // Navegar a la página de candidatos de una vacante
  const handleViewCandidates = (jobId: number, jobTitle: string) => {
    router.push(`/company/jobs/${jobId}/candidates`);
  };


  const handleEditJob = (jobId: number) => {
    router.push(`/create-job?edit=${jobId}`);
  };

  // Publicar borrador
  const handlePublishJob = async (jobId: number) => {
    if (!data) return;

    const job = data.allJobs.find((j) => j.id === jobId);
    if (!job) return;

    if (!confirm(`¿Publicar la vacante "${job.title}"? Se descontarán los créditos correspondientes.`)) {
      return;
    }

    try {
      const response = await fetch('/api/jobs/publish', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId })
      });

      const result = await response.json();

      if (response.status === 402) {
        // Créditos insuficientes
        alert(`Créditos insuficientes. Necesitas ${result.required} créditos, tienes ${result.available}.`);
        router.push('/credits/purchase');
        return;
      }

      if (response.ok && result.success) {
        alert(`¡Vacante publicada! Se descontaron ${result.creditCost} créditos.`);
        fetchDashboardData();
      } else {
        alert(result.error || 'Error al publicar la vacante');
      }
    } catch {
      alert('Error al publicar la vacante');
    }
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
    } catch {
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
    } catch {
      alert('Error al reanudar la vacante');
    }
  };

  // Cerrar vacante con motivo específico
  const handleCloseJob = async (jobId: number, reason: 'success' | 'cancelled') => {
    const messages = {
      success: '¿Cerrar esta vacante como CONTRATACIÓN EXITOSA? Esto indica que encontraste al candidato ideal.',
      cancelled: '¿Cancelar esta vacante? Esto indica que la vacante se cierra sin haber contratado a nadie.'
    };

    if (!confirm(messages[reason])) {
      return;
    }

    try {
      const response = await fetch(`/api/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'closed', closedReason: reason })
      });

      if (response.ok) {
        const successMessages = {
          success: '¡Felicidades! La vacante ha sido cerrada exitosamente.',
          cancelled: 'La vacante ha sido cancelada.'
        };
        alert(successMessages[reason]);
        fetchDashboardData();
      } else {
        const result = await response.json();
        alert(result.error || 'Error al cerrar la vacante');
      }
    } catch {
      alert('Error al cerrar la vacante');
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
        {/* Header - Responsive */}
        <div className="mb-8">
          {/* Título y bienvenida */}
          <div className="mb-4">
            <h1 className="text-2xl md:text-3xl font-bold text-title-dark mb-2">
              Dashboard de {data.company.companyInfo.nombreEmpresa}
            </h1>
            <p className="text-gray-600">Bienvenido, {data.company.userName}</p>
          </div>
          {/* Acciones - Stack en móvil, flex en desktop */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Saldo de créditos */}
            <div className="bg-white px-4 py-2 rounded-lg shadow-sm border border-gray-200 flex items-center justify-center sm:justify-start gap-2">
              <Coins className="text-yellow-500" size={20} />
              <span className="font-semibold text-gray-700">
                {data.company.credits} créditos
              </span>
            </div>
            <button
              onClick={() => router.push('/create-job')}
              className="px-6 py-3 bg-button-green text-white font-bold rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
            >
              <Briefcase size={20} />
              CREAR VACANTE
            </button>
          </div>
        </div>

        {/* Tabla de Vacantes */}
        <div>
          <CompanyJobsTable
            jobs={data.allJobs}
            onView={handleViewJob}
            onEdit={handleEditJob}
            onClose={handleCloseJob}
            onPause={handlePauseJob}
            onResume={handleResumeJob}
            onViewCandidates={handleViewCandidates}
            onPublish={handlePublishJob}
          />
        </div>
      </div>

      {/* Botón flotante para crear vacante (UX-01) */}
      <button
        onClick={() => router.push('/create-job')}
        className="fixed bottom-6 right-6 z-40 px-4 py-4 bg-button-green text-white font-bold rounded-full shadow-lg hover:bg-green-700 hover:shadow-xl transition-all flex items-center gap-2 group"
        title="Crear nueva vacante"
      >
        <Plus size={24} />
        <span className="hidden group-hover:inline whitespace-nowrap pr-2">
          Crear vacante
        </span>
      </button>

      {/* Job Detail Modal */}
      <JobDetailModal
        job={selectedJob}
        isOpen={showJobModal}
        onClose={() => setShowJobModal(false)}
      />
    </div>
  );
}
