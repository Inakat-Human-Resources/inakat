'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface DashboardStats {
  totalJobs: number;
  activeJobs: number;
  totalApplications: number;
  pendingApplications: number;
}

export default function CompanyDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalJobs: 0,
    activeJobs: 0,
    totalApplications: 0,
    pendingApplications: 0
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const response = await fetch('/api/company/dashboard');

      if (!response.ok) {
        throw new Error('Error al cargar datos');
      }

      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Dashboard de Empresa
          </h1>
          <p className="mt-2 text-gray-600">
            Gestiona tus vacantes y aplicaciones
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <StatCard
            title="Total de Vacantes"
            value={stats.totalJobs}
            icon="📋"
            color="blue"
          />
          <StatCard
            title="Vacantes Activas"
            value={stats.activeJobs}
            icon="✅"
            color="green"
          />
          <StatCard
            title="Aplicaciones Totales"
            value={stats.totalApplications}
            icon="📨"
            color="purple"
          />
          <StatCard
            title="Aplicaciones Pendientes"
            value={stats.pendingApplications}
            icon="⏳"
            color="orange"
          />
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-8">
          <ActionCard
            title="Ver Mis Vacantes"
            description="Gestiona tus ofertas de trabajo"
            icon="💼"
            onClick={() => router.push('/company/jobs')}
          />
          <ActionCard
            title="Crear Nueva Vacante"
            description="Publica una nueva oferta"
            icon="➕"
            onClick={() => router.push('/company/jobs/create')}
          />
          <ActionCard
            title="Ver Aplicaciones"
            description="Revisa candidatos interesados"
            icon="👥"
            onClick={() => router.push('/company/applications')}
          />
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Actividad Reciente
          </h2>
          <p className="text-gray-600">
            Próximamente: Lista de actividad reciente
          </p>
        </div>
      </div>
    </div>
  );
}

// Componente de Tarjeta de Estadística
function StatCard({
  title,
  value,
  icon,
  color
}: {
  title: string;
  value: number;
  icon: string;
  color: 'blue' | 'green' | 'purple' | 'orange';
}) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-green-50 text-green-700',
    purple: 'bg-purple-50 text-purple-700',
    orange: 'bg-orange-50 text-orange-700'
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
        </div>
        <div className={`text-4xl ${colorClasses[color]} rounded-full p-3`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

// Componente de Tarjeta de Acción
function ActionCard({
  title,
  description,
  icon,
  onClick
}: {
  title: string;
  description: string;
  icon: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="bg-white rounded-lg shadow p-6 text-left hover:shadow-lg transition-shadow duration-200"
    >
      <div className="flex items-start space-x-4">
        <div className="text-4xl">{icon}</div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <p className="mt-1 text-sm text-gray-600">{description}</p>
        </div>
      </div>
    </button>
  );
}

6789;
