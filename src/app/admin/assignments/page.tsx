// RUTA: src/app/admin/assignments/page.tsx

'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Users,
  Briefcase,
  UserCheck,
  UserCog,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle,
  Clock,
  Building2
} from 'lucide-react';
import Link from 'next/link';

interface Job {
  id: number;
  title: string;
  company: string;
  location: string;
  profile: string;
  seniority: string;
  status: string;
  createdAt: string;
  user: {
    nombre: string;
    companyRequest?: {
      nombreEmpresa: string;
    };
  };
  assignment?: Assignment;
  _count?: {
    applications: number;
  };
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
  // ADM-029: vacantes con sólo reclutador o sólo especialista. No caían ni en
  // "Sin Asignar" ni en "Asignadas".
  partial?: number;
  assigned: number;
  inProgress: number;
  completed: number;
}

type Seleccion = { recruiterId?: number; specialistId?: number };
type Selecciones = { [jobId: number]: Seleccion };

/** Lo que el servidor tiene guardado para cada vacante. */
const seleccionesDelServidor = (lista: Job[]): Selecciones => {
  const resultado: Selecciones = {};
  lista.forEach((job) => {
    if (job.assignment) {
      resultado[job.id] = {
        recruiterId: job.assignment.recruiterId || undefined,
        specialistId: job.assignment.specialistId || undefined
      };
    }
  });
  return resultado;
};

export default function AssignmentsPage() {
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
  const [selections, setSelections] = useState<Selecciones>({});
  const [savingJobId, setSavingJobId] = useState<number | null>(null);

  // Última foto de lo que hay guardado, para saber qué filas tienen cambios
  // sin guardar.
  const guardadoEnServidor = useRef<Selecciones>({});

  useEffect(() => {
    fetchAssignments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  /**
   * ADM-014: cada fila tiene su propio botón Guardar, pero tras guardar se
   * recargaba todo con el spinner de página completa y las selecciones se
   * reconstruían desde el servidor: los cambios pendientes de las OTRAS filas
   * se perdían y el admin tenía que rehacerlos. Ahora la recarga posterior a
   * guardar no bloquea la pantalla y las filas con cambios sin guardar
   * conservan lo que el admin eligió.
   */
  const fetchAssignments = async (
    opciones: { silencioso?: boolean; recienGuardada?: number } = {}
  ) => {
    try {
      if (!opciones.silencioso) setIsLoading(true);
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

        const anterior = guardadoEnServidor.current;
        const nuevas = seleccionesDelServidor(data.data);
        guardadoEnServidor.current = nuevas;

        setSelections((previas) => {
          const resultado: Selecciones = { ...nuevas };
          for (const [clave, seleccion] of Object.entries(previas)) {
            const jobId = Number(clave);
            if (jobId === opciones.recienGuardada) continue;
            const base = anterior[jobId] || {};
            const tieneCambios =
              seleccion.recruiterId !== base.recruiterId ||
              seleccion.specialistId !== base.specialistId;
            if (tieneCambios) resultado[jobId] = seleccion;
          }
          return resultado;
        });
      } else {
        setError(data.error || 'Error al cargar');
      }
    } catch (err) {
      setError('Error de conexión');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * ADM-015: si el reclutador/especialista guardado ya no está entre los
   * activos, el select mostraba "Sin asignar" pero el estado conservaba su id y
   * se reenviaba al guardar. Se pinta como opción propia, marcada, para que el
   * admin vea que hay que sustituirlo.
   */
  const opcionFuera = (
    persona: { id: number; nombre: string; apellidoPaterno?: string } | undefined,
    idSeleccionado: number | undefined,
    lista: Person[]
  ) => {
    if (!idSeleccionado || lista.some((p) => p.id === idSeleccionado)) return null;
    const nombre = persona && persona.id === idSeleccionado
      ? `${persona.nombre} ${persona.apellidoPaterno || ''}`.trim()
      : `Usuario #${idSeleccionado}`;
    return (
      <option value={idSeleccionado}>
        {nombre} (desactivado: reasignar)
      </option>
    );
  };

  const handleSaveAssignment = async (jobId: number) => {
    const selection = selections[jobId] || {};
    if (!selection.recruiterId && !selection.specialistId) {
      // ADM-058: con ambos en "Sin asignar" no se podía guardar nunca, así que
      // una asignación hecha por error sólo podía sustituirse, no retirarse. Si
      // la vacante ya tiene equipo guardado, se permite quitarlo (la API acepta
      // ambos en null), previa confirmación.
      const guardado = guardadoEnServidor.current[jobId];
      if (!guardado?.recruiterId && !guardado?.specialistId) {
        setError('Selecciona al menos un reclutador o especialista');
        return;
      }
      if (!window.confirm('¿Quitar el reclutador y el especialista asignados a esta vacante?')) {
        return;
      }
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

      if (response.ok && data.success) {
        setSuccess('Asignación guardada');
        fetchAssignments({ silencioso: true, recienGuardada: jobId });
        setTimeout(() => setSuccess(null), 3000);

        // Mostrar warning si existe (especialidad no coincide)
        if (data.warning) {
          setWarning(data.warning);
          setTimeout(() => setWarning(null), 8000);
        }
      } else {
        setError(data.error || 'Error al guardar la asignación');
      }
    } catch (err) {
      setError('Error al guardar');
    } finally {
      setSavingJobId(null);
    }
  };

  const getJobStatusBadge = (status: string) => {
    const configs: Record<string, { bg: string; text: string; label: string }> = {
      active: { bg: 'bg-green-100', text: 'text-green-700', label: 'Activa' },
      paused: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Pausada' },
      draft: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Borrador' },
      closed: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Cerrada' }
    };
    const config = configs[status] || { bg: 'bg-gray-100', text: 'text-gray-600', label: status };
    return (
      <span className={`px-2 py-0.5 ${config.bg} ${config.text} text-xs rounded-full`}>
        {config.label}
      </span>
    );
  };

  const getAssignmentStatusBadge = (job: Job) => {
    // ADM-029: mismo criterio que el filtro y las tarjetas de la API. Una fila
    // de asignación con ambos ids en null es "Sin asignar", no "Asignado".
    if (!job.assignment || (!job.assignment.recruiterId && !job.assignment.specialistId)) {
      return (
        <span className="px-2 py-1 bg-red-100 text-red-600 text-xs rounded-full font-medium">
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

    if (!job.assignment.recruiterId || !job.assignment.specialistId) {
      return (
        <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded-full flex items-center gap-1">
          <Clock size={12} />
          Incompleta
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
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Gestión de Vacantes</h1>
          <p className="text-gray-600 mt-1 text-sm md:text-base">
            Asigna equipo y gestiona candidatos desde una sola vista
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
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
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
              <p className="text-sm text-gray-500">Incompletas</p>
              <p className="text-2xl font-bold text-orange-600">
                {stats.partial ?? 0}
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
              { value: 'partial', label: 'Incompletas' },
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
                    <div className="flex flex-col gap-1 items-end">
                      {getJobStatusBadge(job.status)}
                      {getAssignmentStatusBadge(job)}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    {job.profile && (
                      <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded">
                        {job.profile}
                      </span>
                    )}
                    {job._count && (
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded flex items-center gap-1">
                        <Users size={12} />
                        {job._count.applications} candidatos
                      </span>
                    )}
                  </div>

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
                        {opcionFuera(job.assignment?.recruiter, selections[job.id]?.recruiterId, recruiters)}
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
                        {opcionFuera(job.assignment?.specialist, selections[job.id]?.specialistId, specialists)}
                        {specialists.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.nombre} {s.apellidoPaterno || ''} {s.specialty ? `(${s.specialty})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSaveAssignment(job.id)}
                        disabled={savingJobId === job.id}
                        className="flex-1 py-2 bg-button-green text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
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
                      <Link
                        href={`/admin/assign-candidates?jobId=${job.id}`}
                        className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 flex items-center gap-1"
                      >
                        <Users size={18} />
                      </Link>
                    </div>
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
                      <th className="px-4 py-3 text-center text-sm font-semibold text-gray-600">
                        Candidatos
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
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.map((job) => (
                      <tr key={job.id} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-medium text-gray-900">{job.title}</p>
                              {getJobStatusBadge(job.status)}
                            </div>
                            <p className="text-sm text-gray-500">{job.location}</p>
                            {job.profile && (
                              <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded">
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
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-800 rounded-full font-semibold text-sm">
                            {job._count?.applications || 0}
                          </span>
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
                            {opcionFuera(job.assignment?.recruiter, selections[job.id]?.recruiterId, recruiters)}
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
                            {opcionFuera(job.assignment?.specialist, selections[job.id]?.specialistId, specialists)}
                            {specialists.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.nombre} {s.apellidoPaterno || ''} {s.specialty ? `(${s.specialty})` : ''}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {getAssignmentStatusBadge(job)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
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
                            <Link
                              href={`/admin/assign-candidates?jobId=${job.id}`}
                              className="p-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
                              title="Gestionar candidatos"
                            >
                              <Users size={18} />
                            </Link>
                          </div>
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
