'use client';

import React, { useState, useEffect } from 'react';
import { Eye, Mail, Phone, FileText, Calendar } from 'lucide-react';

interface Application {
  id: number;
  jobId: number;
  candidateName: string;
  candidateEmail: string;
  candidatePhone: string | null;
  cvUrl: string | null;
  coverLetter: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
  job: {
    id: number;
    title: string;
    company: string;
    location: string;
    salary: string;
  };
}

const ApplicationsManagementPanel = () => {
  const [applications, setApplications] = useState<Application[]>([]);
  const [filteredApplications, setFilteredApplications] = useState<
    Application[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedApplication, setSelectedApplication] =
    useState<Application | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Estadísticas
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    reviewing: 0,
    interviewed: 0,
    accepted: 0,
    rejected: 0
  });

  useEffect(() => {
    fetchApplications();
  }, []);

  useEffect(() => {
    filterApplications();
    calculateStats();
  }, [applications, selectedStatus]);

  const fetchApplications = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/applications');
      const data = await response.json();

      if (data.success) {
        setApplications(data.data);
      }
    } catch (error) {
      console.error('Error fetching applications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filterApplications = () => {
    if (selectedStatus === 'all') {
      setFilteredApplications(applications);
    } else {
      setFilteredApplications(
        applications.filter((app) => app.status === selectedStatus)
      );
    }
  };

  const calculateStats = () => {
    const newStats = {
      total: applications.length,
      pending: applications.filter((a) => a.status === 'pending').length,
      reviewing: applications.filter((a) => a.status === 'reviewing').length,
      interviewed: applications.filter((a) => a.status === 'interviewed')
        .length,
      accepted: applications.filter((a) => a.status === 'accepted').length,
      rejected: applications.filter((a) => a.status === 'rejected').length
    };
    setStats(newStats);
  };

  const updateApplicationStatus = async (
    applicationId: number,
    newStatus: string,
    notes?: string
  ) => {
    try {
      const response = await fetch(`/api/applications/${applicationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, notes })
      });

      const data = await response.json();

      if (data.success) {
        // Actualizar la lista
        fetchApplications();
        setIsDetailModalOpen(false);
      }
    } catch (error) {
      console.error('Error updating application:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: { [key: string]: string } = {
      pending: 'bg-yellow-100 text-yellow-800',
      reviewing: 'bg-blue-100 text-blue-800',
      interviewed: 'bg-purple-100 text-purple-800',
      accepted: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800'
    };
    return badges[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusLabel = (status: string) => {
    const labels: { [key: string]: string } = {
      pending: 'Pendiente',
      reviewing: 'En Revisión',
      interviewed: 'Entrevistado',
      accepted: 'Aceptado',
      rejected: 'Rechazado'
    };
    return labels[status] || status;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Gestión de Aplicaciones</h1>

        {/* Estadísticas */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-8">
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-gray-600 text-sm">Total</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg shadow">
            <p className="text-gray-600 text-sm">Pendientes</p>
            <p className="text-2xl font-bold text-yellow-800">
              {stats.pending}
            </p>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg shadow">
            <p className="text-gray-600 text-sm">En Revisión</p>
            <p className="text-2xl font-bold text-blue-800">
              {stats.reviewing}
            </p>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg shadow">
            <p className="text-gray-600 text-sm">Entrevistados</p>
            <p className="text-2xl font-bold text-purple-800">
              {stats.interviewed}
            </p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg shadow">
            <p className="text-gray-600 text-sm">Aceptados</p>
            <p className="text-2xl font-bold text-green-800">
              {stats.accepted}
            </p>
          </div>
          <div className="bg-red-50 p-4 rounded-lg shadow">
            <p className="text-gray-600 text-sm">Rechazados</p>
            <p className="text-2xl font-bold text-red-800">{stats.rejected}</p>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white p-4 rounded-lg shadow mb-6">
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setSelectedStatus('all')}
              className={`px-4 py-2 rounded-lg font-semibold ${
                selectedStatus === 'all'
                  ? 'bg-button-green text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Todas
            </button>
            <button
              onClick={() => setSelectedStatus('pending')}
              className={`px-4 py-2 rounded-lg font-semibold ${
                selectedStatus === 'pending'
                  ? 'bg-yellow-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Pendientes
            </button>
            <button
              onClick={() => setSelectedStatus('reviewing')}
              className={`px-4 py-2 rounded-lg font-semibold ${
                selectedStatus === 'reviewing'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              En Revisión
            </button>
            <button
              onClick={() => setSelectedStatus('interviewed')}
              className={`px-4 py-2 rounded-lg font-semibold ${
                selectedStatus === 'interviewed'
                  ? 'bg-purple-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Entrevistados
            </button>
            <button
              onClick={() => setSelectedStatus('accepted')}
              className={`px-4 py-2 rounded-lg font-semibold ${
                selectedStatus === 'accepted'
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Aceptados
            </button>
            <button
              onClick={() => setSelectedStatus('rejected')}
              className={`px-4 py-2 rounded-lg font-semibold ${
                selectedStatus === 'rejected'
                  ? 'bg-red-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Rechazados
            </button>
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="text-center py-20">
            <p className="text-gray-600">Cargando aplicaciones...</p>
          </div>
        )}

        {/* Lista de aplicaciones */}
        {!isLoading && filteredApplications.length === 0 && (
          <div className="text-center py-20 bg-white rounded-lg shadow">
            <p className="text-gray-600">
              No hay aplicaciones en esta categoría.
            </p>
          </div>
        )}

        {!isLoading && filteredApplications.length > 0 && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Candidato
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Vacante
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Fecha
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredApplications.map((app) => (
                  <tr key={app.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-semibold text-gray-900">
                          {app.candidateName}
                        </p>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <Mail size={14} />
                          {app.candidateEmail}
                        </div>
                        {app.candidatePhone && (
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            <Phone size={14} />
                            {app.candidatePhone}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-semibold text-gray-900">
                        {app.job.title}
                      </p>
                      <p className="text-sm text-gray-500">{app.job.company}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      <div className="flex items-center gap-2">
                        <Calendar size={14} />
                        {formatDate(app.createdAt)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadge(
                          app.status
                        )}`}
                      >
                        {getStatusLabel(app.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => {
                          setSelectedApplication(app);
                          setIsDetailModalOpen(true);
                        }}
                        className="flex items-center gap-2 text-button-green hover:text-green-700 font-semibold"
                      >
                        <Eye size={16} />
                        Ver Detalles
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Modal de detalles */}
        {isDetailModalOpen && selectedApplication && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b">
                <h2 className="text-2xl font-bold">Detalles de Aplicación</h2>
              </div>

              <div className="p-6 space-y-6">
                {/* Información del candidato */}
                <div>
                  <h3 className="font-bold text-lg mb-3">
                    Información del Candidato
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Nombre</p>
                      <p className="font-semibold">
                        {selectedApplication.candidateName}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Email</p>
                      <p className="font-semibold">
                        {selectedApplication.candidateEmail}
                      </p>
                    </div>
                    {selectedApplication.candidatePhone && (
                      <div>
                        <p className="text-sm text-gray-500">Teléfono</p>
                        <p className="font-semibold">
                          {selectedApplication.candidatePhone}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Información de la vacante */}
                <div>
                  <h3 className="font-bold text-lg mb-3">Vacante</h3>
                  <p className="font-semibold text-lg">
                    {selectedApplication.job.title}
                  </p>
                  <p className="text-gray-600">
                    {selectedApplication.job.company}
                  </p>
                  <p className="text-gray-600">
                    {selectedApplication.job.location}
                  </p>
                  <p className="text-gray-600">
                    {selectedApplication.job.salary}
                  </p>
                </div>

                {/* CV */}
                {selectedApplication.cvUrl && (
                  <div>
                    <h3 className="font-bold text-lg mb-3">Curriculum Vitae</h3>
                    <a
                      href={selectedApplication.cvUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-button-green hover:text-green-700 font-semibold"
                    >
                      <FileText size={16} />
                      Descargar CV
                    </a>
                  </div>
                )}

                {/* Carta de presentación */}
                {selectedApplication.coverLetter && (
                  <div>
                    <h3 className="font-bold text-lg mb-3">
                      Carta de Presentación
                    </h3>
                    <p className="text-gray-700 whitespace-pre-line bg-gray-50 p-4 rounded">
                      {selectedApplication.coverLetter}
                    </p>
                  </div>
                )}

                {/* Cambiar estado */}
                <div>
                  <h3 className="font-bold text-lg mb-3">Actualizar Estado</h3>
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() =>
                        updateApplicationStatus(
                          selectedApplication.id,
                          'pending'
                        )
                      }
                      className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
                    >
                      Pendiente
                    </button>
                    <button
                      onClick={() =>
                        updateApplicationStatus(
                          selectedApplication.id,
                          'reviewing'
                        )
                      }
                      className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                      En Revisión
                    </button>
                    <button
                      onClick={() =>
                        updateApplicationStatus(
                          selectedApplication.id,
                          'interviewed'
                        )
                      }
                      className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
                    >
                      Entrevistado
                    </button>
                    <button
                      onClick={() =>
                        updateApplicationStatus(
                          selectedApplication.id,
                          'accepted'
                        )
                      }
                      className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                    >
                      Aceptar
                    </button>
                    <button
                      onClick={() =>
                        updateApplicationStatus(
                          selectedApplication.id,
                          'rejected'
                        )
                      }
                      className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                    >
                      Rechazar
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-6 border-t flex justify-end">
                <button
                  onClick={() => setIsDetailModalOpen(false)}
                  className="px-6 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ApplicationsManagementPanel;
