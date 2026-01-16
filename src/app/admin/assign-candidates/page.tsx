// RUTA: src/app/admin/assign-candidates/page.tsx

'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Search,
  Filter,
  RefreshCw,
  Users,
  Briefcase,
  CheckSquare,
  Square,
  ChevronDown,
  ArrowRight,
  AlertCircle,
  CheckCircle
} from 'lucide-react';

interface Job {
  id: number;
  title: string;
  company: string;
  location: string;
  status: string;
  profile: string | null;
  seniority: string | null;
  _count?: {
    applications: number;
  };
}

interface Candidate {
  id: number;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string | null;
  email: string;
  telefono: string | null;
  profile: string | null;
  seniority: string | null;
  añosExperiencia: number;
  universidad: string | null;
  status: string;
  source: string;
}

function AssignCandidatesContent() {
  // URL params para persistir vacante seleccionada
  const searchParams = useSearchParams();
  const jobIdFromUrl = searchParams.get('jobId');

  // Estado
  const [jobs, setJobs] = useState<Job[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [selectedCandidates, setSelectedCandidates] = useState<Set<number>>(new Set());
  const [alreadyAssigned, setAlreadyAssigned] = useState<Set<string>>(new Set());
  const [candidateAssignments, setCandidateAssignments] = useState<Record<string, number>>({});
  const [specialties, setSpecialties] = useState<{
    id: number;
    name: string;
    subcategories: string[];
  }[]>([]);

  // Loading states
  const [isLoadingJobs, setIsLoadingJobs] = useState(true);
  const [isLoadingCandidates, setIsLoadingCandidates] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);

  // Feedback
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Filtros de candidatos
  const [searchTerm, setSearchTerm] = useState('');
  const [profileFilter, setProfileFilter] = useState('');
  const [seniorityFilter, setSeniorityFilter] = useState('');
  const [subcategoryFilter, setSubcategoryFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const seniorities = ['Practicante', 'Jr', 'Middle', 'Sr', 'Director'];

  // Cargar especialidades desde el catálogo
  const fetchSpecialties = async () => {
    try {
      const response = await fetch('/api/specialties?subcategories=true');
      const data = await response.json();
      if (data.success) {
        // El API ya filtra por isActive, no necesitamos filtrar de nuevo
        setSpecialties(data.data);
      }
    } catch (err) {
      console.error('Error fetching specialties:', err);
    }
  };

  // Obtener subcategorías de la especialidad seleccionada
  const getSubcategoriesForProfile = () => {
    if (!profileFilter) return [];
    const specialty = specialties.find(s => s.name === profileFilter);
    return specialty?.subcategories || [];
  };

  // Cargar vacantes activas y especialidades
  useEffect(() => {
    fetchJobs();
    fetchSpecialties();
  }, []);

  // Cargar candidatos cuando cambia la vacante seleccionada
  useEffect(() => {
    if (selectedJob) {
      fetchCandidates();
      fetchAlreadyAssigned(selectedJob.id);
    } else {
      setCandidates([]);
      setSelectedCandidates(new Set());
      setAlreadyAssigned(new Set());
    }
  }, [selectedJob]);

  // Seleccionar vacante desde URL al cargar
  useEffect(() => {
    if (jobIdFromUrl && jobs.length > 0 && !selectedJob) {
      const jobToSelect = jobs.find(j => j.id === parseInt(jobIdFromUrl));
      if (jobToSelect) {
        setSelectedJob(jobToSelect);
      }
    }
  }, [jobIdFromUrl, jobs]);

  // Handler para seleccionar vacante y actualizar URL
  const handleSelectJob = (job: Job) => {
    setSelectedJob(job);
    // Actualizar URL sin recargar página
    window.history.replaceState(null, '', `/admin/assign-candidates?jobId=${job.id}`);
  };

  const fetchJobs = async () => {
    try {
      setIsLoadingJobs(true);
      const response = await fetch('/api/jobs?status=active');
      const data = await response.json();

      if (data.success) {
        setJobs(data.data);
      } else {
        setError('Error al cargar vacantes');
      }
    } catch (err) {
      setError('Error de conexión');
    } finally {
      setIsLoadingJobs(false);
    }
  };

  const fetchCandidates = async () => {
    try {
      setIsLoadingCandidates(true);
      setError(null);

      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (profileFilter) params.append('profile', profileFilter);
      if (seniorityFilter) params.append('seniority', seniorityFilter);
      if (subcategoryFilter) params.append('subcategory', subcategoryFilter);
      // NO filtrar por status para permitir asignar candidatos a múltiples vacantes
      // Los candidatos "available" e "in_process" pueden ser asignados

      const response = await fetch(`/api/admin/candidates?${params}`);
      const data = await response.json();

      if (data.success) {
        // Filtrar solo available e in_process (excluir hired e inactive)
        const filteredCandidates = data.data.filter(
          (c: Candidate) => c.status === 'available' || c.status === 'in_process'
        );
        setCandidates(filteredCandidates);

        // Obtener conteo de asignaciones por candidato
        await fetchCandidateAssignments(filteredCandidates);
      } else {
        setError('Error al cargar candidatos');
      }
    } catch (err) {
      setError('Error de conexión');
    } finally {
      setIsLoadingCandidates(false);
    }
  };

  // Obtener cuántas vacantes tiene asignadas cada candidato
  const fetchCandidateAssignments = async (candidateList: Candidate[]) => {
    try {
      const emails = candidateList.map(c => c.email.toLowerCase());
      const response = await fetch('/api/applications');
      const data = await response.json();

      if (data.success) {
        const counts: Record<string, number> = {};
        for (const app of data.data) {
          const email = app.candidateEmail?.toLowerCase();
          if (email && emails.includes(email)) {
            counts[email] = (counts[email] || 0) + 1;
          }
        }
        setCandidateAssignments(counts);
      }
    } catch (err) {
      console.error('Error fetching assignments:', err);
    }
  };

  const fetchAlreadyAssigned = async (jobId: number) => {
    try {
      const response = await fetch(`/api/applications?jobId=${jobId}`);
      const data = await response.json();

      if (data.success) {
        const emails = new Set<string>(
          data.data.map((app: { candidateEmail: string }) => app.candidateEmail.toLowerCase())
        );
        setAlreadyAssigned(emails);
      }
    } catch (err) {
      console.error('Error fetching assigned:', err);
    }
  };

  const handleSelectCandidate = (candidateId: number) => {
    const newSelected = new Set(selectedCandidates);
    if (newSelected.has(candidateId)) {
      newSelected.delete(candidateId);
    } else {
      newSelected.add(candidateId);
    }
    setSelectedCandidates(newSelected);
  };

  const handleSelectAll = () => {
    const availableCandidates = candidates.filter(
      c => !alreadyAssigned.has(c.email.toLowerCase())
    );

    if (selectedCandidates.size === availableCandidates.length) {
      setSelectedCandidates(new Set());
    } else {
      setSelectedCandidates(new Set(availableCandidates.map(c => c.id)));
    }
  };

  const handleAssign = async () => {
    if (!selectedJob || selectedCandidates.size === 0) return;

    setIsAssigning(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/admin/assign-candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: selectedJob.id,
          candidateIds: Array.from(selectedCandidates)
        })
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(data.message);
        setSelectedCandidates(new Set());
        // Recargar candidatos y asignados
        fetchCandidates();
        fetchAlreadyAssigned(selectedJob.id);
      } else {
        setError(data.error || 'Error al asignar candidatos');
      }
    } catch (err) {
      setError('Error de conexión');
    } finally {
      setIsAssigning(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      available: 'bg-green-100 text-green-800',
      in_process: 'bg-yellow-100 text-yellow-800',
      hired: 'bg-blue-100 text-blue-800',
      inactive: 'bg-gray-100 text-gray-800'
    };
    const labels: Record<string, string> = {
      available: 'Disponible',
      in_process: 'En Proceso',
      hired: 'Contratado',
      inactive: 'Inactivo'
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || styles.inactive}`}>
        {labels[status] || status}
      </span>
    );
  };

  const availableCandidatesCount = candidates.filter(
    c => !alreadyAssigned.has(c.email.toLowerCase())
  ).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto py-8 px-4">
        {/* Header */}
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl md:text-4xl font-bold text-gray-800 mb-1 md:mb-2">
            Asignar Candidatos
          </h1>
          <p className="text-gray-600 text-sm md:text-base">
            Selecciona una vacante y asigna candidatos del banco de talentos
          </p>
        </div>

        {/* Mensajes de feedback */}
        {error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg flex items-center gap-2">
            <AlertCircle size={20} />
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-100 border border-green-400 text-green-700 rounded-lg flex items-center gap-2">
            <CheckCircle size={20} />
            {success}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Panel izquierdo: Selección de vacante */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-4 md:p-6">
              <div className="flex items-center gap-2 mb-4">
                <Briefcase className="text-blue-600" size={20} />
                <h2 className="text-lg md:text-xl font-bold">Seleccionar Vacante</h2>
              </div>

              {isLoadingJobs ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="animate-spin text-gray-400" size={24} />
                </div>
              ) : jobs.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  No hay vacantes activas
                </p>
              ) : (
                <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                  {jobs.map(job => (
                    <button
                      key={job.id}
                      onClick={() => handleSelectJob(job)}
                      className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                        selectedJob?.id === job.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <p className="font-semibold text-gray-900">{job.title}</p>
                      <p className="text-sm text-gray-600">{job.company}</p>
                      <div className="flex items-center gap-2 mt-2">
                        {job.profile && (
                          <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                            {job.profile}
                          </span>
                        )}
                        {job.seniority && (
                          <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                            {job.seniority}
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Panel derecho: Lista de candidatos */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow">
              {/* Header del panel */}
              <div className="p-4 md:p-6 border-b">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Users className="text-green-600" size={20} />
                    <h2 className="text-lg md:text-xl font-bold">Candidatos Disponibles</h2>
                  </div>

                  {selectedJob && (
                    <div className="text-sm text-gray-600">
                      <span className="font-semibold">{selectedCandidates.size}</span> seleccionados
                    </div>
                  )}
                </div>

                {selectedJob ? (
                  <>
                    {/* Barra de búsqueda y filtros */}
                    <div className="flex flex-col md:flex-row gap-3">
                      <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                        <input
                          type="text"
                          placeholder="Buscar candidatos..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && fetchCandidates()}
                          className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`px-4 py-2 border rounded-lg flex items-center gap-2 ${
                          showFilters ? 'bg-blue-50 border-blue-300' : ''
                        }`}
                      >
                        <Filter size={20} />
                        Filtros
                        <ChevronDown className={`transform transition-transform ${showFilters ? 'rotate-180' : ''}`} size={16} />
                      </button>

                      <button
                        onClick={fetchCandidates}
                        className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
                      >
                        <RefreshCw size={20} />
                      </button>
                    </div>

                    {/* Filtros expandidos */}
                    {showFilters && (
                      <div className="mt-4 pt-4 border-t grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium mb-1">Perfil</label>
                          <select
                            value={profileFilter}
                            onChange={(e) => {
                              setProfileFilter(e.target.value);
                              setSubcategoryFilter(''); // Limpiar subcategoría al cambiar perfil
                            }}
                            className="w-full p-2 border rounded-lg"
                          >
                            <option value="">Todos</option>
                            {specialties.map(s => (
                              <option key={s.id} value={s.name}>{s.name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Nivel</label>
                          <select
                            value={seniorityFilter}
                            onChange={(e) => setSeniorityFilter(e.target.value)}
                            className="w-full p-2 border rounded-lg"
                          >
                            <option value="">Todos</option>
                            {seniorities.map(s => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </div>
                        {profileFilter && getSubcategoriesForProfile().length > 0 && (
                          <div className="col-span-2">
                            <label className="block text-sm font-medium mb-1">Subcategoría</label>
                            <select
                              value={subcategoryFilter}
                              onChange={(e) => setSubcategoryFilter(e.target.value)}
                              className="w-full p-2 border rounded-lg"
                            >
                              <option value="">Todas</option>
                              {getSubcategoriesForProfile().map((sub, idx) => (
                                <option key={idx} value={sub}>{sub}</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-gray-500">
                    Selecciona una vacante para ver los candidatos disponibles
                  </p>
                )}
              </div>

              {/* Lista de candidatos */}
              {selectedJob && (
                <div className="p-4 md:p-6">
                  {isLoadingCandidates ? (
                    <div className="flex items-center justify-center py-12">
                      <RefreshCw className="animate-spin text-gray-400" size={32} />
                    </div>
                  ) : candidates.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <Users className="mx-auto mb-2 text-gray-400" size={40} />
                      No hay candidatos disponibles
                    </div>
                  ) : (
                    <>
                      {/* Seleccionar todos */}
                      <div className="flex items-center justify-between mb-4 pb-4 border-b">
                        <button
                          onClick={handleSelectAll}
                          className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800"
                        >
                          {selectedCandidates.size === availableCandidatesCount ? (
                            <CheckSquare size={20} />
                          ) : (
                            <Square size={20} />
                          )}
                          Seleccionar todos ({availableCandidatesCount})
                        </button>

                        <span className="text-sm text-gray-500">
                          {candidates.length - availableCandidatesCount} ya asignados
                        </span>
                      </div>

                      {/* Lista */}
                      <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                        {candidates.map(candidate => {
                          const isAlreadyAssigned = alreadyAssigned.has(candidate.email.toLowerCase());
                          const isSelected = selectedCandidates.has(candidate.id);
                          const assignmentCount = candidateAssignments[candidate.email.toLowerCase()] || 0;

                          return (
                            <div
                              key={candidate.id}
                              onClick={() => !isAlreadyAssigned && handleSelectCandidate(candidate.id)}
                              className={`p-4 rounded-lg border-2 transition-all ${
                                isAlreadyAssigned
                                  ? 'bg-gray-100 border-gray-200 opacity-60 cursor-not-allowed'
                                  : isSelected
                                  ? 'border-green-500 bg-green-50 cursor-pointer'
                                  : 'border-gray-200 hover:border-gray-300 cursor-pointer'
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <div className="pt-1">
                                  {isAlreadyAssigned ? (
                                    <CheckCircle className="text-gray-400" size={20} />
                                  ) : isSelected ? (
                                    <CheckSquare className="text-green-600" size={20} />
                                  ) : (
                                    <Square className="text-gray-400" size={20} />
                                  )}
                                </div>

                                <div className="flex-1">
                                  <div className="flex items-center justify-between flex-wrap gap-2">
                                    <div className="flex items-center gap-2">
                                      <p className="font-semibold text-gray-900">
                                        {candidate.nombre} {candidate.apellidoPaterno}
                                      </p>
                                      {assignmentCount > 0 && (
                                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
                                          {assignmentCount} vacante{assignmentCount > 1 ? 's' : ''}
                                        </span>
                                      )}
                                    </div>
                                    {isAlreadyAssigned && (
                                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                                        Ya en esta vacante
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-sm text-gray-600">{candidate.email}</p>

                                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                                    {candidate.profile && (
                                      <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                                        {candidate.profile}
                                      </span>
                                    )}
                                    {candidate.seniority && (
                                      <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                                        {candidate.seniority}
                                      </span>
                                    )}
                                    <span className="text-xs text-gray-500">
                                      {candidate.añosExperiencia} años exp.
                                    </span>
                                    {candidate.universidad && (
                                      <span className="text-xs text-gray-500">
                                        {candidate.universidad}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Footer con botón de asignar */}
              {selectedJob && selectedCandidates.size > 0 && (
                <div className="p-4 md:p-6 border-t bg-gray-50">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-gray-900 text-sm md:text-base">
                        {selectedCandidates.size} candidato(s) seleccionado(s)
                      </p>
                      <p className="text-xs md:text-sm text-gray-600 truncate max-w-[250px] sm:max-w-none">
                        Para: {selectedJob.title} - {selectedJob.company}
                      </p>
                    </div>

                    <button
                      onClick={handleAssign}
                      disabled={isAssigning}
                      className="w-full sm:w-auto px-4 md:px-6 py-2.5 md:py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-semibold text-sm md:text-base"
                    >
                      {isAssigning ? (
                        <>
                          <RefreshCw className="animate-spin" size={18} />
                          Asignando...
                        </>
                      ) : (
                        <>
                          Asignar
                          <ArrowRight size={18} />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Wrapper con Suspense para useSearchParams
export default function AssignCandidatesPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <RefreshCw className="animate-spin text-gray-400" size={32} />
      </div>
    }>
      <AssignCandidatesContent />
    </Suspense>
  );
}
