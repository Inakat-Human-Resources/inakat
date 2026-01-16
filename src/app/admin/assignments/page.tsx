// RUTA: src/app/admin/assignments/page.tsx

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users,
  Briefcase,
  UserCheck,
  UserCog,
  ChevronDown,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle,
  Clock,
  Send,
  Building2
} from 'lucide-react';

interface Job {
  id: number;
  title: string;
  company: string;
  location: string;
  profile: string;
  seniority: string;
  status: string;
  user: {
    nombre: string;
    companyRequest?: {
      nombreEmpresa: string;
    };
  };
  assignment?: Assignment;
}

interface Assignment {
  id: number;
  jobId: number;
  recruiterId: number | null;
  specialistId: number | null;
  recruiterStatus: string;
  specialistStatus: string;
  recruiter?: {
    id: number;
    nombre: string;
    apellidoPaterno: string;
    email: string;
  };
  specialist?: {
    id: number;
    nombre: string;
    apellidoPaterno: string;
    email: string;
    specialty: string;
  };
}

interface Person {
  id: number;
  nombre: string;
  apellidoPaterno?: string;
  email: string;
  specialty?: string;
}

interface Stats {
  total: number;
  unassigned: number;
  assigned: number;
  inProgress: number;
  completed: number;
}

export default function AssignmentsPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [recruiters, setRecruiters] = useState<Person[]>([]);
  const [specialists, setSpecialists] = useState<Person[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  // Filtro
  const [statusFilter, setStatusFilter] = useState('all');

  // Selecciones temporales para asignar
  const [selections, setSelections] = useState<{
    [jobId: number]: { recruiterId?: number; specialistId?: number };
  }>({});
  const [savingJobId, setSavingJobId] = useState<number | null>(null);

  useEffect(() => {
    fetchAssignments();
  }, [statusFilter]);

  const fetchAssignments = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      const response = await fetch(`/api/admin/assignments?${params}`);
      const data = await response.json();

      if (data.success) {
        setJobs(data.data);
        setRecruiters(data.recruiters);
        setSpecialists(data.specialists);
        setStats(data.stats);

        // Inicializar selecciones con valores actuales
        const initialSelections: any = {};
        data.data.forEach((job: Job) => {
          if (job.assignment) {
            initialSelections[job.id] = {
              recruiterId: job.assignment.recruiterId || undefined,
              specialistId: job.assignment.specialistId || undefined
            };
          }
        });
        setSelections(initialSelections);
      } else {
        setError(data.error || 'Error al cargar');
      }
    } catch (err) {
      setError('Error de conexión');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveAssignment = async (jobId: number) => {
    const selection = selections[jobId];
    if (!selection?.recruiterId && !selection?.specialistId) {
      setError('Selecciona al menos un reclutador o especialista');
      return;
    }

    try {
      setSavingJobId(jobId);
      setError(null);
      setWarning(null);

      const response = await fetch('/api/admin/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId,
          recruiterId: selection.recruiterId || null,
          specialistId: selection.specialistId || null
        })
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('Asignación guardada');
        fetchAssignments();
        setTimeout(() => setSuccess(null), 3000);

        // Mostrar warning si existe (especialidad no coincide)
        if (data.warning) {
          setWarning(data.warning);
          setTimeout(() => setWarning(null), 8000);
        }
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Error al guardar');
    } finally {
      setSavingJobId(null);
    }
  };

  const getStatusBadge = (job: Job) => {
    if (!job.assignment) {
      return (
        <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
          Sin asignar
        </span>
      );
    }

    const { recruiterStatus, specialistStatus } = job.assignment;

    if (specialistStatus === 'sent_to_company') {
      return (
        <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full flex items-center gap-1">
          <CheckCircle size={12} />
          Completado
        </span>
      );
    }

    if (
      recruiterStatus === 'sent_to_specialist' ||
      specialistStatus === 'evaluating'
    ) {
      return (
        <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full flex items-center gap-1">
          <UserCog size={12} />
          Con Especialista
        </span>
      );
    }

    if (recruiterStatus === 'reviewing') {
      return (
        <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full flex items-center gap-1">
          <UserCheck size={12} />
          Con Reclutador
        </span>
      );
    }

    return (
      <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded-full flex items-center gap-1">
        <Clock size={12} />
        Asignado
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="animate-spin text-button-green" size={40} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header - Responsive */}
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Asignaciones</h1>
          <p className="text-gray-600 mt-1 text-sm md:text-base">
            Asigna reclutadores y especialistas a vacantes
          </p>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
            <AlertCircle size={20} />
            {error}
            <button
              onClick={() => setError(null)}
              className="ml-auto text-red-400 hover:text-red-600"
            >
              ×
            </button>
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700">
            <CheckCircle size={20} />
            {success}
          </div>
        )}

        {warning && (
          <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-2 text-yellow-700">
            <AlertCircle size={20} />
            <span className="flex-1">{warning}</span>
            <button
              onClick={() => setWarning(null)}
              className="text-yellow-400 hover:text-yellow-600"
            >
              ×
            </button>
          </div>
        )}

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <p className="text-sm text-gray-500">Total Vacantes</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <p className="text-sm text-gray-500">Sin Asignar</p>
              <p className="text-2xl font-bold text-red-600">
                {stats.unassigned}
              </p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <p className="text-sm text-gray-500">Asignadas</p>
              <p className="text-2xl font-bold text-yellow-600">
                {stats.assigned}
              </p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <p className="text-sm text-gray-500">En Proceso</p>
              <p className="text-2xl font-bold text-blue-600">
                {stats.inProgress}
              </p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <p className="text-sm text-gray-500">Completadas</p>
              <p className="text-2xl font-bold text-green-600">
                {stats.completed}
              </p>
            </div>
          </div>
        )}

        {/* Info de personal */}
        <div className="grid md:grid-cols-2 gap-4 mb-8">
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <div className="flex items-center gap-2 mb-2">
              <UserCheck className="text-blue-600" size={20} />
              <h3 className="font-semibold text-blue-800">
                Reclutadores Disponibles
              </h3>
            </div>
            {recruiters.length === 0 ? (
              <p className="text-sm text-blue-600">
                No hay reclutadores registrados
              </p>
            ) : (
              <p className="text-sm text-blue-600">
                {recruiters.length} reclutador(es)
              </p>
            )}
          </div>
          <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
            <div className="flex items-center gap-2 mb-2">
              <UserCog className="text-purple-600" size={20} />
              <h3 className="font-semibold text-purple-800">
                Especialistas Disponibles
              </h3>
            </div>
            {specialists.length === 0 ? (
              <p className="text-sm text-purple-600">
                No hay especialistas registrados
              </p>
            ) : (
              <p className="text-sm text-purple-600">
                {specialists.length} especialista(s)
              </p>
            )}
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white p-4 rounded-lg shadow-sm border mb-6">
          <div className="flex flex-wrap gap-2">
            {[
              { value: 'all', label: 'Todas' },
              { value: 'unassigned', label: 'Sin Asignar' },
              { value: 'assigned', label: 'Asignadas' },
              { value: 'in_progress', label: 'En Proceso' },
              { value: 'completed', label: 'Completadas' }
            ].map((filter) => (
              <button
                key={filter.value}
                onClick={() => setStatusFilter(filter.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  statusFilter === filter.value
                    ? 'bg-button-green text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {/* Lista de vacantes - Desktop: Tabla, Mobile: Cards */}
        {jobs.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border p-12 text-center text-gray-500">
            <Briefcase className="mx-auto mb-2 text-gray-400" size={40} />
            No hay vacantes para mostrar
          </div>
        ) : (
          <>
            {/* Mobile: Cards */}
            <div className="md:hidden space-y-4">
              {jobs.map((job) => (
                <div key={job.id} className="bg-white rounded-lg shadow-sm border p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-900">{job.title}</h3>
                      <p className="text-sm text-gray-500 flex items-center gap-1">
                        <Building2 size={14} />
                        {job.user?.companyRequest?.nombreEmpresa || job.company}
                      </p>
                      <p className="text-xs text-gray-400">{job.location}</p>
                    </div>
                    {getStatusBadge(job)}
                  </div>

                  {job.profile && (
                    <span className="inline-block text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded mb-3">
                      {job.profile}
                    </span>
                  )}

                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-gray-500 flex items-center gap-1 mb-1">
                        <UserCheck size={12} /> Reclutador
                      </label>
                      <select
                        value={selections[job.id]?.recruiterId || ''}
                        onChange={(e) =>
                          setSelections({
                            ...selections,
                            [job.id]: {
                              ...selections[job.id],
                              recruiterId: e.target.value ? parseInt(e.target.value) : undefined
                            }
                          })
                        }
                        className="w-full p-2 border rounded-lg text-sm"
                      >
                        <option value="">Sin asignar</option>
                        {recruiters.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.nombre} {r.apellidoPaterno || ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs text-gray-500 flex items-center gap-1 mb-1">
                        <UserCog size={12} /> Especialista
                      </label>
                      <select
                        value={selections[job.id]?.specialistId || ''}
                        onChange={(e) =>
                          setSelections({
                            ...selections,
                            [job.id]: {
                              ...selections[job.id],
                              specialistId: e.target.value ? parseInt(e.target.value) : undefined
                            }
                          })
                        }
                        className="w-full p-2 border rounded-lg text-sm"
                      >
                        <option value="">Sin asignar</option>
                        {specialists.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.nombre} {s.apellidoPaterno || ''} {s.specialty ? `(${s.specialty})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <button
                      onClick={() => handleSaveAssignment(job.id)}
                      disabled={savingJobId === job.id}
                      className="w-full py-2 bg-button-green text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {savingJobId === job.id ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        <>
                          <Save size={18} />
                          Guardar
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop: Tabla */}
            <div className="hidden md:block bg-white rounded-lg shadow-sm border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">
                        Vacante
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">
                        Empresa
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">
                        Reclutador
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">
                        Especialista
                      </th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-gray-600">
                        Estado
                      </th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-gray-600">
                        Acción
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.map((job) => (
                      <tr key={job.id} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-gray-900">{job.title}</p>
                            <p className="text-sm text-gray-500">{job.location}</p>
                            {job.profile && (
                              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                                {job.profile}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Building2 size={16} className="text-gray-400" />
                            <span className="text-sm text-gray-700">
                              {job.user?.companyRequest?.nombreEmpresa || job.company}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={selections[job.id]?.recruiterId || ''}
                            onChange={(e) =>
                              setSelections({
                                ...selections,
                                [job.id]: {
                                  ...selections[job.id],
                                  recruiterId: e.target.value ? parseInt(e.target.value) : undefined
                                }
                              })
                            }
                            className="w-full p-2 border rounded-lg text-sm"
                          >
                            <option value="">Sin asignar</option>
                            {recruiters.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.nombre} {r.apellidoPaterno || ''}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={selections[job.id]?.specialistId || ''}
                            onChange={(e) =>
                              setSelections({
                                ...selections,
                                [job.id]: {
                                  ...selections[job.id],
                                  specialistId: e.target.value ? parseInt(e.target.value) : undefined
                                }
                              })
                            }
                            className="w-full p-2 border rounded-lg text-sm"
                          >
                            <option value="">Sin asignar</option>
                            {specialists.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.nombre} {s.apellidoPaterno || ''} {s.specialty ? `(${s.specialty})` : ''}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {getStatusBadge(job)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => handleSaveAssignment(job.id)}
                            disabled={savingJobId === job.id}
                            className="p-2 bg-button-green text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                            title="Guardar asignación"
                          >
                            {savingJobId === job.id ? (
                              <Loader2 size={18} className="animate-spin" />
                            ) : (
                              <Save size={18} />
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
