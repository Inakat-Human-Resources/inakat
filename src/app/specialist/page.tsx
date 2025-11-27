// RUTA: src/app/specialist/dashboard/page.tsx

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
  Star,
  ExternalLink
} from 'lucide-react';

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
  notas: string | null;
  experiences: any[];
}

interface Assignment {
  id: number;
  jobId: number;
  specialistStatus: string;
  specialistNotes: string | null;
  recruiterNotes: string | null;
  candidatesSentToSpecialist: string | null;
  candidatesSentToCompany: string | null;
  candidates: Candidate[];
  job: {
    id: number;
    title: string;
    company: string;
    location: string;
    profile: string;
    seniority: string;
    description: string;
    requirements: string;
    user: {
      nombre: string;
      companyRequest?: {
        nombreEmpresa: string;
        correoEmpresa: string;
      };
    };
  };
  recruiter?: {
    id: number;
    nombre: string;
    apellidoPaterno: string;
    email: string;
  };
}

interface Stats {
  total: number;
  pending: number;
  evaluating: number;
  sentToCompany: number;
}

export default function SpecialistDashboard() {
  const router = useRouter();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [specialist, setSpecialist] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Filtro de estado
  const [statusFilter, setStatusFilter] = useState('all');

  // Asignación expandida
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Candidatos seleccionados para enviar a empresa
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

      const response = await fetch(`/api/specialist/dashboard?${params}`);

      if (response.status === 401) {
        router.push('/login?redirect=/specialist/dashboard');
        return;
      }

      if (response.status === 403) {
        setError('No tienes permisos de especialista');
        return;
      }

      const data = await response.json();

      if (data.success) {
        setAssignments(data.data.assignments);
        setStats(data.data.stats);
        setSpecialist(data.data.specialist);

        // Inicializar notas
        const initialNotes: any = {};
        data.data.assignments.forEach((a: Assignment) => {
          initialNotes[a.id] = a.specialistNotes || '';
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

      const response = await fetch('/api/specialist/dashboard', {
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
      case 'evaluating':
        return (
          <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full">
            Evaluando
          </span>
        );
      case 'sent_to_company':
        return (
          <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
            Enviado a Empresa
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

  const calculateAge = (birthDate: string | null) => {
    if (!birthDate) return null;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
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
            Dashboard Especialista
          </h1>
          <p className="text-gray-600 mt-1">
            {specialist?.specialty && (
              <span className="inline-flex items-center gap-1">
                <Star size={16} className="text-yellow-500" />
                Especialidad: {specialist.specialty}
              </span>
            )}
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
            <div className="bg-purple-50 p-4 rounded-lg shadow-sm border border-purple-200">
              <div className="flex items-center gap-2 text-purple-600 mb-1">
                <Users size={16} />
                <span className="text-sm">Evaluando</span>
              </div>
              <p className="text-2xl font-bold text-purple-700">
                {stats.evaluating}
              </p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg shadow-sm border border-green-200">
              <div className="flex items-center gap-2 text-green-600 mb-1">
                <Send size={16} />
                <span className="text-sm">Enviadas</span>
              </div>
              <p className="text-2xl font-bold text-green-700">
                {stats.sentToCompany}
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
              { value: 'evaluating', label: 'Evaluando' },
              { value: 'sent_to_company', label: 'Enviadas' }
            ].map((filter) => (
              <button
                key={filter.value}
                onClick={() => setStatusFilter(filter.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  statusFilter === filter.value
                    ? 'bg-purple-600 text-white'
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
              <p className="text-gray-500">
                No tienes vacantes asignadas con candidatos
              </p>
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
                        {getStatusBadge(assignment.specialistStatus)}
                        <span className="text-sm text-gray-500">
                          ({assignment.candidates.length} candidatos)
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Building2 size={14} />
                          {assignment.job.user?.companyRequest?.nombreEmpresa ||
                            assignment.job.company}
                        </span>
                        <span>{assignment.job.location}</span>
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
                    {/* Notas del reclutador */}
                    {assignment.recruiterNotes && (
                      <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                        <p className="text-sm font-medium text-blue-800 mb-1">
                          Notas del Reclutador:
                        </p>
                        <p className="text-sm text-blue-700">
                          {assignment.recruiterNotes}
                        </p>
                      </div>
                    )}

                    {/* Mis notas */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Notas de evaluación técnica
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
                        placeholder="Escribe tus notas de evaluación técnica..."
                      />
                    </div>

                    {/* Lista de candidatos */}
                    <div className="mb-4">
                      <h4 className="font-medium text-gray-700 mb-2">
                        Candidatos a evaluar:
                      </h4>
                      <div className="space-y-3">
                        {assignment.candidates.map((candidate) => (
                          <div
                            key={candidate.id}
                            className="border rounded-lg p-4 hover:bg-gray-50"
                          >
                            <div className="flex items-start gap-3">
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
                                className="w-5 h-5 mt-1 text-purple-600 rounded"
                              />
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <h5 className="font-semibold text-gray-900">
                                    {candidate.nombre}{' '}
                                    {candidate.apellidoPaterno}{' '}
                                    {candidate.apellidoMaterno || ''}
                                  </h5>
                                  {candidate.seniority && (
                                    <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded">
                                      {candidate.seniority}
                                    </span>
                                  )}
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-gray-600">
                                  {candidate.email && (
                                    <span className="flex items-center gap-1">
                                      <Mail size={14} />
                                      {candidate.email}
                                    </span>
                                  )}
                                  {candidate.telefono && (
                                    <span className="flex items-center gap-1">
                                      <Phone size={14} />
                                      {candidate.telefono}
                                    </span>
                                  )}
                                  {candidate.universidad && (
                                    <span className="flex items-center gap-1">
                                      <GraduationCap size={14} />
                                      {candidate.universidad}
                                    </span>
                                  )}
                                  {candidate.fechaNacimiento && (
                                    <span className="flex items-center gap-1">
                                      <Calendar size={14} />
                                      {calculateAge(
                                        candidate.fechaNacimiento
                                      )}{' '}
                                      años
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-4 mt-2">
                                  {candidate.añosExperiencia > 0 && (
                                    <span className="text-sm text-gray-500">
                                      {candidate.añosExperiencia} años de
                                      experiencia
                                    </span>
                                  )}
                                  {candidate.cvUrl && (
                                    <a
                                      href={candidate.cvUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                                    >
                                      <FileText size={14} />
                                      Ver CV
                                    </a>
                                  )}
                                  {candidate.linkedinUrl && (
                                    <a
                                      href={candidate.linkedinUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                                    >
                                      <ExternalLink size={14} />
                                      LinkedIn
                                    </a>
                                  )}
                                </div>

                                {/* Experiencias */}
                                {candidate.experiences &&
                                  candidate.experiences.length > 0 && (
                                    <div className="mt-2 pt-2 border-t">
                                      <p className="text-xs font-medium text-gray-500 mb-1">
                                        Experiencia reciente:
                                      </p>
                                      {candidate.experiences
                                        .slice(0, 2)
                                        .map((exp: any, idx: number) => (
                                          <p
                                            key={idx}
                                            className="text-xs text-gray-600"
                                          >
                                            • {exp.puesto} en {exp.empresa}
                                          </p>
                                        ))}
                                    </div>
                                  )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Acciones */}
                    <div className="flex flex-wrap gap-2">
                      {assignment.specialistStatus === 'pending' && (
                        <button
                          onClick={() =>
                            handleUpdateStatus(assignment.id, 'evaluating')
                          }
                          disabled={savingId === assignment.id}
                          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
                        >
                          {savingId === assignment.id ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <Users size={16} />
                          )}
                          Iniciar Evaluación
                        </button>
                      )}

                      {assignment.specialistStatus === 'evaluating' && (
                        <>
                          <button
                            onClick={() =>
                              handleUpdateStatus(assignment.id, 'evaluating')
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
                                'sent_to_company'
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
                            Enviar a Empresa (
                            {selectedCandidates[assignment.id]?.length || 0})
                          </button>
                        </>
                      )}

                      {assignment.specialistStatus === 'sent_to_company' && (
                        <div className="px-4 py-2 bg-green-100 text-green-700 rounded-lg flex items-center gap-2">
                          <CheckCircle size={16} />
                          Candidatos enviados a la empresa
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
