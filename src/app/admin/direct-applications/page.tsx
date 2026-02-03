// RUTA: src/app/admin/direct-applications/page.tsx

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Inbox,
  User,
  Mail,
  Phone,
  Briefcase,
  Calendar,
  FileText,
  CheckCircle,
  XCircle,
  Archive,
  AlertCircle,
  ExternalLink
} from 'lucide-react';

interface Application {
  id: number;
  candidateName: string;
  candidateEmail: string;
  candidatePhone: string | null;
  cvUrl: string | null;
  coverLetter: string | null;
  status: string;
  createdAt: string;
  job: {
    id: number;
    title: string;
    company: string;
    location: string;
    status: string;
    assignment: {
      id: number;
      recruiter: { id: number; nombre: string; apellidoPaterno: string } | null;
    } | null;
    user: {
      nombre: string;
      email: string;
      companyRequest: {
        nombreEmpresa: string;
      } | null;
    };
  };
}

export default function DirectApplicationsPage() {
  const router = useRouter();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });

  useEffect(() => {
    fetchApplications();
  }, []);

  const fetchApplications = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/direct-applications');

      if (response.status === 401) {
        router.push('/login?redirect=/admin/direct-applications');
        return;
      }

      if (response.status === 403) {
        setError('No tienes permisos para acceder a esta página');
        return;
      }

      const result = await response.json();

      if (result.success) {
        setApplications(result.data);
      } else {
        setError(result.error || 'Error al cargar aplicaciones');
      }
    } catch (err) {
      console.error('Error:', err);
      setError('Error al cargar aplicaciones');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (
    applicationId: number,
    newStatus: string
  ) => {
    const confirmMessages: Record<string, string> = {
      reviewing: '¿Meter esta aplicación al proceso de revisión?',
      discarded: '¿Descartar esta aplicación?',
      archived: '¿Archivar esta aplicación?'
    };

    if (!confirm(confirmMessages[newStatus])) {
      return;
    }

    setProcessingId(applicationId);

    try {
      const response = await fetch('/api/admin/direct-applications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId, newStatus })
      });

      const result = await response.json();

      if (result.success) {
        // Remover la aplicación de la lista
        setApplications((prev) => prev.filter((app) => app.id !== applicationId));
        // Mostrar warning si la vacante no tiene reclutador asignado
        setNotification({
          type: result.needsAssignment ? 'error' : 'success',
          message: result.message
        });
      } else {
        setNotification({ type: 'error', message: result.error || 'Error al actualizar' });
      }
    } catch (err) {
      console.error('Error:', err);
      setNotification({ type: 'error', message: 'Error al procesar la solicitud' });
    } finally {
      setProcessingId(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

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

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-custom-beige">
        <div className="text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => router.push('/admin')}
            className="px-6 py-2 bg-button-orange text-white rounded-lg hover:bg-opacity-90"
          >
            Volver al Panel
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
          <div className="flex items-center gap-2 md:gap-3 mb-2">
            <Inbox className="w-6 h-6 md:w-8 md:h-8 text-button-orange" />
            <h1 className="text-2xl md:text-3xl font-bold text-title-dark">
              Aplicaciones Directas
            </h1>
          </div>
          <p className="text-gray-600 text-sm md:text-base">
            Candidatos que aplicaron directamente desde /talents y están
            pendientes de revisión
          </p>
        </div>

        {/* Notificación */}
        {notification.type && (
          <div
            className={`mb-6 p-4 rounded-lg flex items-center justify-between ${
              notification.type === 'success'
                ? 'bg-green-100 text-green-800 border border-green-300'
                : 'bg-red-100 text-red-800 border border-red-300'
            }`}
          >
            <span>{notification.message}</span>
            <button
              onClick={() => setNotification({ type: null, message: '' })}
              className="ml-4 hover:opacity-70 text-xl"
            >
              ×
            </button>
          </div>
        )}

        {/* Contador */}
        <div className="mb-6 bg-white rounded-lg shadow-sm p-4 inline-block">
          <span className="text-2xl font-bold text-button-orange">
            {applications.length}
          </span>
          <span className="text-gray-600 ml-2">
            aplicaciones pendientes de revisar
          </span>
        </div>

        {/* Lista de Aplicaciones */}
        {applications.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <Inbox className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">
              No hay aplicaciones pendientes
            </h3>
            <p className="text-gray-500">
              Todas las aplicaciones directas han sido procesadas
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {applications.map((app) => (
              <div
                key={app.id}
                className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
              >
                <div className="p-4 md:p-6">
                  {/* Encabezado de la aplicación */}
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-4">
                    <div>
                      {/* Info del candidato */}
                      <div className="flex items-center gap-2 mb-2">
                        <User className="w-5 h-5 text-gray-400" />
                        <h3 className="text-lg font-semibold text-gray-900">
                          {app.candidateName}
                        </h3>
                      </div>
                      <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <Mail className="w-4 h-4" />
                          <a
                            href={`mailto:${app.candidateEmail}`}
                            className="text-blue-600 hover:underline"
                          >
                            {app.candidateEmail}
                          </a>
                        </span>
                        {app.candidatePhone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-4 h-4" />
                            <a
                              href={`tel:${app.candidatePhone}`}
                              className="text-blue-600 hover:underline"
                            >
                              {app.candidatePhone}
                            </a>
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {formatDate(app.createdAt)}
                        </span>
                      </div>
                    </div>

                    {/* CV Link */}
                    {app.cvUrl && (
                      <a
                        href={app.cvUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
                      >
                        <FileText className="w-4 h-4" />
                        Ver CV
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>

                  {/* Info de la vacante */}
                  <div className="bg-gray-50 rounded-lg p-4 mb-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Briefcase className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-500">Aplicó a:</span>
                    </div>
                    <p className="font-semibold text-gray-900">
                      {app.job.title}
                    </p>
                    <p className="text-sm text-gray-600">
                      {app.job.user.companyRequest?.nombreEmpresa ||
                        app.job.company}{' '}
                      • {app.job.location}
                    </p>
                  </div>

                  {/* Indicador de asignación de reclutador */}
                  {!app.job.assignment ? (
                    <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-3 mb-4 flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
                      <span className="text-sm text-yellow-800">
                        ⚠️ Esta vacante no tiene reclutador asignado.{' '}
                        <a href="/admin/assign-candidates" className="underline font-semibold hover:text-yellow-900">
                          Asignar ahora →
                        </a>
                      </span>
                    </div>
                  ) : app.job.assignment.recruiter ? (
                    <div className="text-sm text-gray-500 mb-4 flex items-center gap-2">
                      <User className="w-4 h-4" />
                      <span>Reclutador asignado: <span className="font-medium text-gray-700">{app.job.assignment.recruiter.nombre} {app.job.assignment.recruiter.apellidoPaterno}</span></span>
                    </div>
                  ) : null}

                  {/* Carta de presentación */}
                  {app.coverLetter && (
                    <div className="mb-4">
                      <p className="text-sm font-medium text-gray-700 mb-1">
                        Carta de presentación:
                      </p>
                      <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                        {app.coverLetter.length > 300
                          ? `${app.coverLetter.substring(0, 300)}...`
                          : app.coverLetter}
                      </p>
                    </div>
                  )}

                  {/* Botones de acción */}
                  <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-3 pt-4 border-t border-gray-200">
                    <button
                      onClick={() => handleStatusChange(app.id, 'reviewing')}
                      disabled={processingId === app.id}
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Meter al proceso
                    </button>
                    <button
                      onClick={() => handleStatusChange(app.id, 'discarded')}
                      disabled={processingId === app.id}
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
                    >
                      <XCircle className="w-4 h-4" />
                      Descartar
                    </button>
                    <button
                      onClick={() => handleStatusChange(app.id, 'archived')}
                      disabled={processingId === app.id}
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
                    >
                      <Archive className="w-4 h-4" />
                      Archivar
                    </button>
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
