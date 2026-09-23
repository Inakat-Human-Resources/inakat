// RUTA: src/app/admin/assign-candidates/page.tsx

'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
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
  CheckCircle,
  Clock,
  UserCheck,
  UserCog,
  MessageSquare,
  Calendar
} from 'lucide-react';
import Paginacion, { PAGINACION_VACIA, type PaginacionApi } from '../_components/Paginacion';
import { isSafeHttpUrl } from '@/lib/sanitize';

/**
 * `cvUrl` llega de POST /api/applications, que es público y no valida el
 * esquema, así que no puede ir crudo a un href: `javascript:` o `data:` se
 * convierten en un enlace ejecutable al pulsar "Ver CV". Sólo se deja pasar
 * http(s) absoluto; lo que parece un dominio suelto se fuerza a https y lo que
 * no es URL se anula.
 */
const ensureUrl = (url: string): string | undefined => {
  const candidata = /^[a-z][a-z0-9+.-]*:/i.test(url) ? url : `https://${url}`;
  return isSafeHttpUrl(candidata) ? candidata : undefined;
};

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
  // ADM-011: conteo de postulaciones calculado en el servidor (si lo manda).
  applicationsCount?: number;
  /** Postulaciones vivas del candidato; lo calcula GET /api/admin/candidates (groupBy). */
  activeApplications?: number;
}

interface PipelineCandidate {
  id: number;
  candidateName: string;
  candidateEmail: string;
  candidatePhone: string | null;
  cvUrl: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  assignedRecruiter: { id: number; name: string } | null;
  assignedSpecialist: { id: number; name: string; specialty: string | null } | null;
  recruiterNotes: string | null;
  specialistNotes: string | null;
  candidateProfile: {
    profile: string | null;
    seniority: string | null;
    universidad: string | null;
    añosExperiencia: number;
  } | null;
}

interface PipelineStats {
  total: number;
  pending: number;
  injected: number;
  reviewing: number;
  sentToSpecialist: number;
  evaluating: number;
  sentToCompany: number;
  // ADM-053: opcionales para no romper si la API aún no los devuelve.
  companyInterested?: number;
  interviewed?: number;
  archived?: number;
  hired: number;
  rejected: number;
}

interface JobAssignmentInfo {
  recruiter: { id: number; nombre: string; apellidoPaterno: string } | null;
  specialist: { id: number; nombre: string; apellidoPaterno: string; specialty: string | null } | null;
  recruiterNotes: string | null;
  specialistNotes: string | null;
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

  // Estado del pipeline
  const [activeTab, setActiveTab] = useState<'assign' | 'pipeline'>('pipeline');
  const [pipelineCandidates, setPipelineCandidates] = useState<PipelineCandidate[]>([]);
  const [pipelineStats, setPipelineStats] = useState<PipelineStats | null>(null);
  const [jobAssignment, setJobAssignment] = useState<JobAssignmentInfo | null>(null);
  const [isLoadingPipeline, setIsLoadingPipeline] = useState(false);

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

  // Paginación de candidatos (ADM-010: la API devuelve 30 por tanda)
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<PaginacionApi>(PAGINACION_VACIA);

  // ADM-054: id de la vacante cuya carga está en curso. Las respuestas que no
  // correspondan a ella se tiran en vez de pintarse.
  const vacanteVigente = useRef<number | null>(null);

  // Función para obtener badge de status del pipeline
  const getPipelineStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-gray-100 text-gray-700',
      injected_by_admin: 'bg-gray-200 text-gray-800',
      reviewing: 'bg-yellow-100 text-yellow-800',
      sent_to_specialist: 'bg-sky-100 text-sky-700',
      evaluating: 'bg-blue-100 text-blue-800',
      sent_to_company: 'bg-purple-100 text-purple-800',
      // ADM-053: estados que el schema sí usa y este mapa ignoraba. El propio
      // módulo de entrevistas pone la Application en 'interviewed' al
      // confirmar, y el badge salía en gris con el texto crudo en inglés.
      company_interested: 'bg-indigo-100 text-indigo-800',
      interviewed: 'bg-teal-100 text-teal-800',
      archived: 'bg-gray-100 text-gray-600',
      hired: 'bg-green-100 text-green-800',
      accepted: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      discarded: 'bg-red-100 text-red-700',
      company_rejected: 'bg-red-100 text-red-700'
    };
    const labels: Record<string, string> = {
      pending: 'Pendiente',
      injected_by_admin: 'Inyectado',
      reviewing: 'En Revisión',
      sent_to_specialist: 'Con Especialista',
      evaluating: 'En Evaluación',
      sent_to_company: 'Enviado a Empresa',
      company_interested: 'Interesa a la Empresa',
      interviewed: 'Entrevistado',
      archived: 'Archivado',
      hired: 'Contratado',
      accepted: 'Contratado',
      rejected: 'Rechazado',
      discarded: 'Descartado',
      company_rejected: 'Rechazado por Empresa'
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-700'}`}>
        {labels[status] || status}
      </span>
    );
  };

  // Cargar candidatos del pipeline para la vacante seleccionada
  const fetchPipelineCandidates = async (jobId: number) => {
    setIsLoadingPipeline(true);
    try {
      const response = await fetch(`/api/admin/assign-candidates?jobId=${jobId}`);
      const data = await response.json();

      // ADM-054: si mientras tanto el admin pulsó otra vacante, esta respuesta
      // es de la anterior y pintarla mezcla el pipeline de A bajo el encabezado
      // de B. Se descarta.
      if (vacanteVigente.current !== jobId) return;

      if (data.success) {
        setPipelineCandidates(data.data || []);
        setPipelineStats(data.pipelineStats || null);
        setJobAssignment(data.jobAssignment || null);
      } else {
        console.error('Error fetching pipeline:', data.error);
        setError('Error al cargar el pipeline de candidatos.');
        setPipelineCandidates([]);
        setPipelineStats(null);
        setJobAssignment(null);
      }
    } catch (err) {
      console.error('Error fetching pipeline:', err);
      if (vacanteVigente.current !== jobId) return;
      setError('Error de conexión al cargar el pipeline.');
      setPipelineCandidates([]);
      setPipelineStats(null);
      setJobAssignment(null);
    } finally {
      if (vacanteVigente.current === jobId) setIsLoadingPipeline(false);
    }
  };

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
      setError('Error al cargar las especialidades.');
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

  // Cargar candidatos cuando cambia la vacante seleccionada.
  // ADM-012: la selección se vacía SIEMPRE al cambiar de vacante. Antes sólo se
  // limpiaba al deseleccionar, así que los 3 candidatos marcados para la
  // vacante A se acababan inyectando en la B con un clic en "Asignar".
  // ADM-054: se reinicia también el pipeline y los "ya asignados" para no
  // enseñar los de la vacante anterior mientras carga la nueva.
  useEffect(() => {
    setSelectedCandidates(new Set());
    setAlreadyAssigned(new Set());
    setSuccess(null);

    if (selectedJob) {
      vacanteVigente.current = selectedJob.id;
      setPipelineCandidates([]);
      setPipelineStats(null);
      setJobAssignment(null);
      setPage(1);
      fetchCandidates(1);
      fetchAlreadyAssigned(selectedJob.id);
      fetchPipelineCandidates(selectedJob.id);
    } else {
      vacanteVigente.current = null;
      setCandidates([]);
      setPipelineCandidates([]);
      setPipelineStats(null);
      setJobAssignment(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedJob]);

  // ADM-013: los selects de Perfil / Nivel / Subcategoría sólo hacían setState.
  // La lista no cambiaba y el admin concluía que el filtro no servía (o que
  // todos los candidatos cumplían) y asignaba a quien no correspondía.
  // ADM-012: al cambiar el filtro, los marcados que dejan de verse se quitan de
  // la selección; si no, "Asignar" inyectaba candidatos que el admin ya no veía.
  useEffect(() => {
    if (!selectedJob) return;
    setSelectedCandidates(new Set());
    setPage(1);
    fetchCandidates(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileFilter, seniorityFilter, subcategoryFilter]);

  // Búsqueda por texto (Enter o botón de refrescar): mismo criterio que los
  // filtros, la selección oculta se descarta (ADM-012).
  const buscarCandidatos = () => {
    setSelectedCandidates(new Set());
    setPage(1);
    fetchCandidates(1);
  };

  // Cambio de página del banco de candidatos (ADM-010)
  const irAPagina = (nuevaPagina: number) => {
    setPage(nuevaPagina);
    fetchCandidates(nuevaPagina);
  };

  // Seleccionar vacante desde URL al cargar.
  // ADM-001: el listado trae como mucho 100 vacantes activas. Si la del enlace
  // (?jobId= desde el dashboard) no está en esa tanda, antes la página abría
  // sin vacante seleccionada y sin decir nada. Ahora se pide por id y, si no
  // está activa o no existe, se avisa.
  const deepLinkResuelto = useRef(false);
  useEffect(() => {
    if (!jobIdFromUrl || isLoadingJobs || selectedJob || deepLinkResuelto.current) return;
    deepLinkResuelto.current = true;

    const idPedido = Number(jobIdFromUrl);
    if (!Number.isInteger(idPedido) || idPedido <= 0) {
      setError('El enlace apunta a una vacante no válida.');
      return;
    }

    const enLista = jobs.find(j => j.id === idPedido);
    if (enLista) {
      setSelectedJob(enLista);
      return;
    }

    void (async () => {
      try {
        const res = await fetch(`/api/jobs/${idPedido}`);
        const data = await res.json();
        if (res.ok && data.success && data.data?.status === 'active') {
          const vacante: Job = data.data;
          setJobs(prev => (prev.some(j => j.id === vacante.id) ? prev : [vacante, ...prev]));
          setSelectedJob(vacante);
        } else {
          setError('La vacante del enlace no existe o ya no está activa.');
        }
      } catch {
        setError('Error de conexión al cargar la vacante del enlace.');
      }
    })();
  }, [jobIdFromUrl, jobs, isLoadingJobs, selectedJob]);

  // Handler para seleccionar vacante y actualizar URL
  const handleSelectJob = (job: Job) => {
    setSelectedJob(job);
    // Actualizar URL sin recargar página
    window.history.replaceState(null, '', `/admin/assign-candidates?jobId=${job.id}`);
  };

  const fetchJobs = async () => {
    try {
      setIsLoadingJobs(true);
      const response = await fetch('/api/jobs?status=active&limit=100');
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

  const fetchCandidates = async (paginaPedida = page) => {
    try {
      setIsLoadingCandidates(true);
      setError(null);

      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (profileFilter) params.append('profile', profileFilter);
      if (seniorityFilter) params.append('seniority', seniorityFilter);
      if (subcategoryFilter) params.append('subcategory', subcategoryFilter);
      // ADM-010: el descarte de hired/inactive se hace en el WHERE del servidor.
      // Filtrándolo en el navegador DESPUÉS de paginar, una tanda de 30 podía
      // quedarse en 12 visibles y el contador de la pestaña mentía.
      params.append('status', 'available,in_process');
      params.append('page', String(paginaPedida));

      const response = await fetch(`/api/admin/candidates?${params}`);
      const data = await response.json();

      if (data.success) {
        const lista: Candidate[] = data.data || [];
        setCandidates(lista);
        setPagination(data.pagination || PAGINACION_VACIA);

        // ADM-011: el contador de "N vacantes" no bloquea el listado. Antes se
        // esperaba (await) a una descarga de TODAS las applications antes de
        // quitar el spinner. GET /api/admin/candidates ya trae el conteo por
        // candidato (`activeApplications`, groupBy que excluye procesos
        // cerrados); si faltara, se pide sólo el conteo a /api/applications/counts.
        const conteoDe = (c: Candidate) =>
          typeof c.activeApplications === 'number' ? c.activeApplications : c.applicationsCount;
        if (lista.length > 0 && lista.every(c => typeof conteoDe(c) === 'number')) {
          const counts: Record<string, number> = {};
          for (const c of lista) counts[c.email.toLowerCase()] = conteoDe(c) as number;
          setCandidateAssignments(counts);
        } else {
          void fetchCandidateAssignments(lista);
        }
      } else {
        setError('Error al cargar candidatos');
      }
    } catch (err) {
      setError('Error de conexión');
    } finally {
      setIsLoadingCandidates(false);
    }
  };

  /**
   * Cuántas vacantes tiene asignadas cada candidato visible (respaldo cuando
   * el listado no trae el conteo).
   *
   * ADM-011 / VAC-011: antes pedía GET /api/applications SIN filtros (toda la
   * tabla con PII, coverLetter y notas) sólo para pintar un número. Ahora se
   * pide el conteo por correo a /api/applications/counts (groupBy en la base);
   * los correos sin postulaciones no aparecen en la respuesta.
   */
  const fetchCandidateAssignments = async (candidateList: Candidate[]) => {
    if (candidateList.length === 0) return;
    try {
      const response = await fetch('/api/applications/counts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails: candidateList.map(c => c.email.toLowerCase()) })
      });
      const data = await response.json();

      if (data.success) {
        setCandidateAssignments(data.data || {});
      }
    } catch (err) {
      console.error('Error fetching assignments:', err);
    }
  };

  const fetchAlreadyAssigned = async (jobId: number) => {
    try {
      const response = await fetch(`/api/applications?jobId=${jobId}`);
      const data = await response.json();

      // ADM-054: respuesta de una vacante que ya no es la seleccionada.
      if (vacanteVigente.current !== jobId) return;

      if (data.success) {
        const emails = new Set<string>(
          data.data.map((app: { candidateEmail: string }) => app.candidateEmail.toLowerCase())
        );
        setAlreadyAssigned(emails);
      }
    } catch (err) {
      console.error('Error fetching assigned:', err);
      if (vacanteVigente.current !== jobId) return;
      setError('Error al cargar los candidatos asignados.');
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

  /**
   * ADM-012: comparar tamaños daba falsos positivos —una selección de 3 hecha
   * en otra vacante "coincidía" con 3 visibles y el botón desmarcaba en vez de
   * marcar; con 0 disponibles el icono salía siempre marcado—. Ahora se mira
   * pertenencia real.
   */
  const handleSelectAll = () => {
    const availableCandidates = candidates.filter(
      c => !alreadyAssigned.has(c.email.toLowerCase())
    );

    const todosMarcados =
      availableCandidates.length > 0 &&
      availableCandidates.every(c => selectedCandidates.has(c.id));

    if (todosMarcados) {
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
        // Recargar candidatos, asignados y pipeline
        fetchCandidates();
        fetchAlreadyAssigned(selectedJob.id);
        fetchPipelineCandidates(selectedJob.id);
        // Cambiar al tab del pipeline para mostrar los nuevos candidatos
        setActiveTab('pipeline');
      } else {
        setError(data.error || 'Error al asignar candidatos');
      }
    } catch (err) {
      setError('Error de conexión');
    } finally {
      setIsAssigning(false);
    }
  };

  const availableCandidatesCount = candidates.filter(
    c => !alreadyAssigned.has(c.email.toLowerCase())
  ).length;

  const candidatosVisibles = candidates.filter(
    c => !alreadyAssigned.has(c.email.toLowerCase())
  );
  const todosVisiblesMarcados =
    candidatosVisibles.length > 0 &&
    candidatosVisibles.every(c => selectedCandidates.has(c.id));

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
              {/* Tabs de navegación */}
              {selectedJob && (
                <div className="border-b">
                  <nav className="flex">
                    <button
                      onClick={() => setActiveTab('pipeline')}
                      className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === 'pipeline'
                          ? 'border-blue-500 text-blue-600 bg-blue-50'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-center gap-2">
                        <Clock size={18} />
                        Pipeline de Candidatos
                        {pipelineStats && (
                          <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs">
                            {pipelineStats.total}
                          </span>
                        )}
                      </div>
                    </button>
                    <button
                      onClick={() => setActiveTab('assign')}
                      className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === 'assign'
                          ? 'border-green-500 text-green-600 bg-green-50'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-center gap-2">
                        <Users size={18} />
                        Asignar Nuevos
                        <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs">
                          {availableCandidatesCount}
                        </span>
                      </div>
                    </button>
                  </nav>
                </div>
              )}

              {/* Header del panel */}
              <div className="p-4 md:p-6 border-b">
                {activeTab === 'assign' && (
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
                )}

                {activeTab === 'pipeline' && selectedJob && (
                  <>
                    {/* Stats del pipeline. ADM-053: las cajas no cuadraban con el
                        total: 'company_interested' e 'interviewed' no caían en
                        ninguna y los rechazados no se pintaban. */}
                    {pipelineStats && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 mb-4">
                        <div className="bg-gray-50 p-2 rounded text-center">
                          <p className="text-lg font-bold text-gray-700">{pipelineStats.pending + pipelineStats.injected}</p>
                          <p className="text-xs text-gray-500">Pendientes</p>
                        </div>
                        <div className="bg-yellow-50 p-2 rounded text-center">
                          <p className="text-lg font-bold text-yellow-700">{pipelineStats.reviewing}</p>
                          <p className="text-xs text-yellow-600">En Revisión</p>
                        </div>
                        <div className="bg-blue-50 p-2 rounded text-center">
                          <p className="text-lg font-bold text-blue-700">{pipelineStats.sentToSpecialist + pipelineStats.evaluating}</p>
                          <p className="text-xs text-blue-600">Evaluación</p>
                        </div>
                        <div className="bg-purple-50 p-2 rounded text-center">
                          <p className="text-lg font-bold text-purple-700">
                            {pipelineStats.sentToCompany + (pipelineStats.companyInterested ?? 0)}
                          </p>
                          <p className="text-xs text-purple-600">Enviados</p>
                        </div>
                        <div className="bg-teal-50 p-2 rounded text-center">
                          <p className="text-lg font-bold text-teal-700">{pipelineStats.interviewed ?? 0}</p>
                          <p className="text-xs text-teal-600">Entrevista</p>
                        </div>
                        <div className="bg-green-50 p-2 rounded text-center">
                          <p className="text-lg font-bold text-green-700">{pipelineStats.hired}</p>
                          <p className="text-xs text-green-600">Contratados</p>
                        </div>
                        <div className="bg-red-50 p-2 rounded text-center">
                          <p className="text-lg font-bold text-red-700">
                            {pipelineStats.rejected + (pipelineStats.archived ?? 0)}
                          </p>
                          <p className="text-xs text-red-600">Descartados</p>
                        </div>
                      </div>
                    )}

                    {/* Info del equipo asignado */}
                    {jobAssignment && (
                      <div className="flex flex-wrap gap-4 p-3 bg-gray-50 rounded-lg">
                        {jobAssignment.recruiter && (
                          <div className="flex items-center gap-2">
                            <UserCheck className="text-blue-600" size={16} />
                            <span className="text-sm">
                              <span className="text-gray-500">Reclutador:</span>{' '}
                              <span className="font-medium">
                                {jobAssignment.recruiter.nombre} {jobAssignment.recruiter.apellidoPaterno}
                              </span>
                            </span>
                          </div>
                        )}
                        {jobAssignment.specialist && (
                          <div className="flex items-center gap-2">
                            <UserCog className="text-purple-600" size={16} />
                            <span className="text-sm">
                              <span className="text-gray-500">Especialista:</span>{' '}
                              <span className="font-medium">
                                {jobAssignment.specialist.nombre} {jobAssignment.specialist.apellidoPaterno}
                              </span>
                              {jobAssignment.specialist.specialty && (
                                <span className="text-gray-400 text-xs ml-1">({jobAssignment.specialist.specialty})</span>
                              )}
                            </span>
                          </div>
                        )}
                        {!jobAssignment.recruiter && !jobAssignment.specialist && (
                          <span className="text-sm text-gray-500">Sin equipo asignado</span>
                        )}
                      </div>
                    )}
                  </>
                )}

                {activeTab === 'assign' && selectedJob ? (
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
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') buscarCandidatos();
                          }}
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
                        onClick={buscarCandidatos}
                        title="Actualizar lista"
                        aria-label="Actualizar lista de candidatos"
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
                ) : !selectedJob && (
                  <p className="text-gray-500">
                    Selecciona una vacante para ver los candidatos disponibles
                  </p>
                )}
              </div>

              {/* Lista de candidatos del pipeline */}
              {selectedJob && activeTab === 'pipeline' && (
                <div className="p-4 md:p-6">
                  {isLoadingPipeline ? (
                    <div className="flex items-center justify-center py-12">
                      <RefreshCw className="animate-spin text-gray-400" size={32} />
                    </div>
                  ) : pipelineCandidates.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <Users className="mx-auto mb-2 text-gray-400" size={40} />
                      <p>No hay candidatos en el pipeline</p>
                      <button
                        onClick={() => setActiveTab('assign')}
                        className="mt-4 text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        Asignar candidatos →
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                      {pipelineCandidates.map(candidate => (
                        <div
                          key={candidate.id}
                          className="p-4 rounded-lg border border-gray-200 hover:border-gray-300 bg-white"
                        >
                          {/* Header del candidato */}
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-semibold text-gray-900">
                                  {candidate.candidateName}
                                </p>
                                {getPipelineStatusBadge(candidate.status)}
                              </div>
                              <p className="text-sm text-gray-600">{candidate.candidateEmail}</p>
                            </div>
                            {candidate.cvUrl && ensureUrl(candidate.cvUrl) && (
                              <a
                                href={ensureUrl(candidate.cvUrl)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 text-xs font-medium shrink-0"
                              >
                                Ver CV
                              </a>
                            )}
                          </div>

                          {/* Info del candidato */}
                          {candidate.candidateProfile && (
                            <div className="flex items-center gap-2 mb-3 flex-wrap">
                              {candidate.candidateProfile.profile && (
                                <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                                  {candidate.candidateProfile.profile}
                                </span>
                              )}
                              {candidate.candidateProfile.seniority && (
                                <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                                  {candidate.candidateProfile.seniority}
                                </span>
                              )}
                              {candidate.candidateProfile.añosExperiencia > 0 && (
                                <span className="text-xs text-gray-500">
                                  {candidate.candidateProfile.añosExperiencia} años exp.
                                </span>
                              )}
                            </div>
                          )}

                          {/* Equipo y notas */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                            {/* Columna izquierda: Reclutador */}
                            <div className="space-y-2">
                              {candidate.assignedRecruiter && (
                                <div className="flex items-center gap-2">
                                  <UserCheck className="text-blue-500 shrink-0" size={14} />
                                  <span className="text-gray-600">
                                    <span className="font-medium">{candidate.assignedRecruiter.name}</span>
                                  </span>
                                </div>
                              )}
                              {candidate.recruiterNotes && (
                                <div className="flex items-start gap-2 pl-5">
                                  <MessageSquare className="text-gray-400 shrink-0 mt-0.5" size={12} />
                                  <p className="text-xs text-gray-500 italic line-clamp-2">
                                    {candidate.recruiterNotes}
                                  </p>
                                </div>
                              )}
                            </div>

                            {/* Columna derecha: Especialista */}
                            <div className="space-y-2">
                              {candidate.assignedSpecialist && (
                                <div className="flex items-center gap-2">
                                  <UserCog className="text-purple-500 shrink-0" size={14} />
                                  <span className="text-gray-600">
                                    <span className="font-medium">{candidate.assignedSpecialist.name}</span>
                                    {candidate.assignedSpecialist.specialty && (
                                      <span className="text-gray-400 text-xs ml-1">
                                        ({candidate.assignedSpecialist.specialty})
                                      </span>
                                    )}
                                  </span>
                                </div>
                              )}
                              {candidate.specialistNotes && (
                                <div className="flex items-start gap-2 pl-5">
                                  <MessageSquare className="text-gray-400 shrink-0 mt-0.5" size={12} />
                                  <p className="text-xs text-gray-500 italic line-clamp-2">
                                    {candidate.specialistNotes}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Notas del candidato */}
                          {candidate.notes && (
                            <div className="mt-3 pt-3 border-t">
                              <p className="text-xs text-gray-500">
                                <span className="font-medium">Notas:</span> {candidate.notes}
                              </p>
                            </div>
                          )}

                          {/* Fechas */}
                          <div className="flex items-center gap-4 mt-3 pt-3 border-t text-xs text-gray-400">
                            <div className="flex items-center gap-1">
                              <Calendar size={12} />
                              <span>Ingreso: {new Date(candidate.createdAt).toLocaleDateString('es-MX')}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock size={12} />
                              <span>Actualizado: {new Date(candidate.updatedAt).toLocaleDateString('es-MX')}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Lista de candidatos para asignar */}
              {selectedJob && activeTab === 'assign' && (
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
                          {todosVisiblesMarcados ? (
                            <CheckSquare size={20} />
                          ) : (
                            <Square size={20} />
                          )}
                          Seleccionar todos ({availableCandidatesCount} en esta página)
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
                              // ADM-056: operable también con teclado (Espacio/Enter).
                              role="checkbox"
                              aria-checked={isSelected}
                              aria-disabled={isAlreadyAssigned}
                              tabIndex={isAlreadyAssigned ? -1 : 0}
                              onKeyDown={(e) => {
                                if (isAlreadyAssigned) return;
                                if (e.key === ' ' || e.key === 'Enter') {
                                  e.preventDefault();
                                  handleSelectCandidate(candidate.id);
                                }
                              }}
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

                      {/* Paginación del banco (ADM-010) */}
                      <Paginacion
                        pagination={pagination}
                        onChange={irAPagina}
                        etiqueta="candidatos disponibles"
                      />
                    </>
                  )}
                </div>
              )}

              {/* Footer con botón de asignar.
                  ADM-012: sólo en la pestaña "Asignar Nuevos"; antes aparecía
                  también sobre el Pipeline, donde no hay nada que asignar. */}
              {selectedJob && activeTab === 'assign' && selectedCandidates.size > 0 && (
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
