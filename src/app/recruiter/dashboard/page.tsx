// RUTA: src/app/recruiter/dashboard/page.tsx

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Briefcase,
  Users,
  Clock,
  Send,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  User,
  Mail,
  Phone,
  GraduationCap,
  Calendar,
  Building2,
  FileText,
  Loader2,
  AlertCircle,
  Save,
  XCircle,
  Trash2
} from 'lucide-react';

interface Application {
  id: number;
  candidateName: string;
  candidateEmail: string;
  candidatePhone: string | null;
  status: string;
  createdAt: string;
  cvUrl: string | null;
}

interface Assignment {
  id: number;
  jobId: number;
  recruiterStatus: string;
  recruiterNotes: string | null;
  candidatesSentToSpecialist: string | null;
  job: {
    id: number;
    title: string;
    company: string;
    location: string;
    profile: string;
    seniority: string;
    description: string;
    applications?: Application[];
    user: {
      nombre: string;
      companyRequest?: {
        nombreEmpresa: string;
        correoEmpresa: string;
      };
    };
  };
  specialist?: {
    id: number;
    nombre: string;
    apellidoPaterno: string;
    email: string;
    specialty: string;
  };
}

interface Candidate {
  id: number;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string | null;
  email: string;
  telefono: string | null;
  sexo: string | null;
  fechaNacimiento: string | null;
  universidad: string | null;
  carrera: string | null;
  añosExperiencia: number;
  profile: string | null;
  seniority: string | null;
  cvUrl: string | null;
  linkedinUrl: string | null;
  experiences: any[];
}

interface Stats {
  total: number;
  pending: number;
  reviewing: number;
  sentToSpecialist: number;
}

export default function RecruiterDashboard() {
  const router = useRouter();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Filtro de estado
  const [statusFilter, setStatusFilter] = useState('all');

  // Asignación expandida
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Candidatos seleccionados para enviar
  const [selectedCandidates, setSelectedCandidates] = useState<{
    [assignmentId: number]: number[];
  }>({});
  const [notes, setNotes] = useState<{ [assignmentId: number]: string }>({});
  const [savingId, setSavingId] = useState<number | null>(null);

  useEffect(() => {
    fetchDashboard();
  }, [statusFilter]);

  const fetchDashboard = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      const response = await fetch(`/api/recruiter/dashboard?${params}`);

      if (response.status === 401) {
        router.push('/login?redirect=/recruiter/dashboard');
        return;
      }

      if (response.status === 403) {
        setError('No tienes permisos de reclutador');
        return;
      }

      const data = await response.json();

      if (data.success) {
        setAssignments(data.data.assignments);
        setCandidates(data.data.candidates);
        setStats(data.data.stats);

        // Inicializar notas
        const initialNotes: any = {};
        data.data.assignments.forEach((a: Assignment) => {
          initialNotes[a.id] = a.recruiterNotes || '';
        });
        setNotes(initialNotes);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Error de conexión');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateStatus = async (
    assignmentId: number,
    newStatus: string
  ) => {
    try {
      setSavingId(assignmentId);
      setError(null);

      const response = await fetch('/api/recruiter/dashboard', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignmentId,
          status: newStatus,
          notes: notes[assignmentId] || '',
          candidateIds: selectedCandidates[assignmentId] || []
        })
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('Actualizado correctamente');
        fetchDashboard();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Error al actualizar');
    } finally {
      setSavingId(null);
    }
  };

  const handleDiscardApplication = async (applicationId: number) => {
    const reason = prompt('¿Motivo del descarte? (opcional)');
    if (reason === null) return; // Usuario canceló

    try {
      setError(null);
      const response = await fetch('/api/recruiter/dashboard', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          discardApplicationId: applicationId,
          discardReason: reason || 'Sin motivo especificado'
        })
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('Candidato descartado');
        fetchDashboard();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Error al descartar candidato');
    }
  };

  const toggleCandidateSelection = (
    assignmentId: number,
    candidateId: number
  ) => {
    const current = selectedCandidates[assignmentId] || [];
    const newSelection = current.includes(candidateId)
      ? current.filter((id) => id !== candidateId)
      : [...current, candidateId];

    setSelectedCandidates({
      ...selectedCandidates,
      [assignmentId]: newSelection
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded-full">
            Pendiente
          </span>
        );
      case 'reviewing':
        return (
          <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
            En Revisión
          </span>
        );
      case 'sent_to_specialist':
        return (
          <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
            Enviado
          </span>
        );
      default:
        return (
          <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
            {status}
          </span>
        );
    }
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
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Dashboard Reclutador
          </h1>
          <p className="text-gray-600 mt-1">
            Gestiona las vacantes asignadas y los candidatos
          </p>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
            <AlertCircle size={20} />
            {error}
            <button onClick={() => setError(null)} className="ml-auto">
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

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <div className="flex items-center gap-2 text-gray-500 mb-1">
                <Briefcase size={16} />
                <span className="text-sm">Total Asignadas</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg shadow-sm border border-yellow-200">
              <div className="flex items-center gap-2 text-yellow-600 mb-1">
                <Clock size={16} />
                <span className="text-sm">Pendientes</span>
              </div>
              <p className="text-2xl font-bold text-yellow-700">
                {stats.pending}
              </p>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg shadow-sm border border-blue-200">
              <div className="flex items-center gap-2 text-blue-600 mb-1">
                <Users size={16} />
                <span className="text-sm">En Revisión</span>
              </div>
              <p className="text-2xl font-bold text-blue-700">
                {stats.reviewing}
              </p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg shadow-sm border border-green-200">
              <div className="flex items-center gap-2 text-green-600 mb-1">
                <Send size={16} />
                <span className="text-sm">Enviadas</span>
              </div>
              <p className="text-2xl font-bold text-green-700">
                {stats.sentToSpecialist}
              </p>
            </div>
          </div>
        )}

        {/* Filtros */}
        <div className="bg-white p-4 rounded-lg shadow-sm border mb-6">
          <div className="flex flex-wrap gap-2">
            {[
              { value: 'all', label: 'Todas' },
              { value: 'pending', label: 'Pendientes' },
              { value: 'reviewing', label: 'En Revisión' },
              { value: 'sent_to_specialist', label: 'Enviadas' }
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

        {/* Lista de asignaciones */}
        <div className="space-y-4">
          {assignments.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border p-12 text-center">
              <Briefcase className="mx-auto text-gray-300 mb-4" size={48} />
              <p className="text-gray-500">No tienes vacantes asignadas</p>
            </div>
          ) : (
            assignments.map((assignment) => (
              <div
                key={assignment.id}
                className="bg-white rounded-lg shadow-sm border overflow-hidden"
              >
                {/* Header de la asignación */}
                <div
                  className="p-4 cursor-pointer hover:bg-gray-50"
                  onClick={() =>
                    setExpandedId(
                      expandedId === assignment.id ? null : assignment.id
                    )
                  }
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold text-gray-900">
                          {assignment.job.title}
                        </h3>
                        {getStatusBadge(assignment.recruiterStatus)}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Building2 size={14} />
                          {assignment.job.user?.companyRequest?.nombreEmpresa ||
                            assignment.job.company}
                        </span>
                        <span>{assignment.job.location}</span>
                        {assignment.job.profile && (
                          <span className="px-2 py-0.5 bg-gray-100 rounded text-xs">
                            {assignment.job.profile}
                          </span>
                        )}
                      </div>
                    </div>
                    {expandedId === assignment.id ? (
                      <ChevronUp />
                    ) : (
                      <ChevronDown />
                    )}
                  </div>
                </div>

                {/* Contenido expandido */}
                {expandedId === assignment.id && (
                  <div className="border-t p-4">
                    {/* Descripción de la vacante */}
                    {assignment.job.description && (
                      <div className="mb-4 p-4 bg-gray-50 rounded-lg border">
                        <h4 className="font-medium text-gray-700 mb-2 flex items-center gap-2">
                          <FileText size={16} />
                          Descripción de la Vacante
                        </h4>
                        <div className="text-sm text-gray-600 whitespace-pre-wrap">
                          {assignment.job.description}
                        </div>
                      </div>
                    )}

                    {/* Info del especialista asignado */}
                    {assignment.specialist && (
                      <div className="mb-4 p-3 bg-purple-50 rounded-lg">
                        <p className="text-sm font-medium text-purple-800">
                          Especialista asignado: {assignment.specialist.nombre}{' '}
                          {assignment.specialist.apellidoPaterno}
                          {assignment.specialist.specialty &&
                            ` (${assignment.specialist.specialty})`}
                        </p>
                      </div>
                    )}

                    {/* Notas */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Notas de pre-entrevista
                      </label>
                      <textarea
                        value={notes[assignment.id] || ''}
                        onChange={(e) =>
                          setNotes({
                            ...notes,
                            [assignment.id]: e.target.value
                          })
                        }
                        className="w-full p-3 border rounded-lg"
                        rows={3}
                        placeholder="Escribe tus notas aquí..."
                      />
                    </div>

                    {/* Selección de candidatos */}
                    <div className="mb-4">
                      <h4 className="font-medium text-gray-700 mb-2">
                        Seleccionar candidatos para enviar al especialista:
                      </h4>
                      <div className="max-h-64 overflow-y-auto border rounded-lg">
                        {candidates.length === 0 ? (
                          <p className="p-4 text-gray-500 text-center">
                            No hay candidatos en la base de datos
                          </p>
                        ) : (
                          candidates.map((candidate) => (
                            <label
                              key={candidate.id}
                              className="flex items-center gap-3 p-3 hover:bg-gray-50 border-b last:border-b-0 cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={(
                                  selectedCandidates[assignment.id] || []
                                ).includes(candidate.id)}
                                onChange={() =>
                                  toggleCandidateSelection(
                                    assignment.id,
                                    candidate.id
                                  )
                                }
                                className="w-4 h-4 text-button-green rounded"
                              />
                              <div className="flex-1">
                                <p className="font-medium text-gray-900">
                                  {candidate.nombre} {candidate.apellidoPaterno}
                                </p>
                                <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                                  {candidate.email && (
                                    <span>{candidate.email}</span>
                                  )}
                                  {candidate.profile && (
                                    <span className="px-1.5 py-0.5 bg-gray-100 rounded">
                                      {candidate.profile}
                                    </span>
                                  )}
                                  {candidate.añosExperiencia > 0 && (
                                    <span>
                                      {candidate.añosExperiencia} años exp.
                                    </span>
                                  )}
                                </div>
                              </div>
                            </label>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Candidatos en proceso (Applications existentes) */}
                    {assignment.job.applications &&
                      assignment.job.applications.length > 0 && (
                        <div className="mb-4">
                          <h4 className="font-medium text-gray-700 mb-2 flex items-center gap-2">
                            <Users size={16} />
                            Candidatos en proceso ({assignment.job.applications.length})
                          </h4>
                          <div className="border rounded-lg divide-y">
                            {assignment.job.applications.map((app) => (
                              <div
                                key={app.id}
                                className="p-3 flex items-center justify-between hover:bg-gray-50"
                              >
                                <div>
                                  <p className="font-medium text-gray-900">
                                    {app.candidateName}
                                  </p>
                                  <p className="text-sm text-gray-500">
                                    {app.candidateEmail}
                                  </p>
                                  <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                                    {app.status === 'pending'
                                      ? 'Pendiente'
                                      : app.status === 'reviewing'
                                        ? 'En revisión'
                                        : app.status === 'sent_to_specialist'
                                          ? 'Enviado a especialista'
                                          : app.status}
                                  </span>
                                </div>
                                <button
                                  onClick={() => handleDiscardApplication(app.id)}
                                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Descartar candidato"
                                >
                                  <Trash2 size={18} />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                    {/* Acciones */}
                    <div className="flex flex-wrap gap-2">
                      {assignment.recruiterStatus === 'pending' && (
                        <button
                          onClick={() =>
                            handleUpdateStatus(assignment.id, 'reviewing')
                          }
                          disabled={savingId === assignment.id}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                        >
                          {savingId === assignment.id ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <Users size={16} />
                          )}
                          Iniciar Revisión
                        </button>
                      )}

                      {assignment.recruiterStatus === 'reviewing' && (
                        <>
                          <button
                            onClick={() =>
                              handleUpdateStatus(assignment.id, 'reviewing')
                            }
                            disabled={savingId === assignment.id}
                            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 flex items-center gap-2"
                          >
                            <Save size={16} />
                            Guardar Notas
                          </button>
                          <button
                            onClick={() =>
                              handleUpdateStatus(
                                assignment.id,
                                'sent_to_specialist'
                              )
                            }
                            disabled={
                              savingId === assignment.id ||
                              !(selectedCandidates[assignment.id]?.length > 0)
                            }
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                          >
                            {savingId === assignment.id ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              <Send size={16} />
                            )}
                            Enviar al Especialista (
                            {selectedCandidates[assignment.id]?.length || 0})
                          </button>
                        </>
                      )}

                      {assignment.recruiterStatus === 'sent_to_specialist' && (
                        <div className="px-4 py-2 bg-green-100 text-green-700 rounded-lg flex items-center gap-2">
                          <CheckCircle size={16} />
                          Candidatos enviados al especialista
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
