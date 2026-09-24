// RUTA: src/app/admin/assign-candidates/page.tsx

'use client';

/**
 * Asignar candidatos: el admin elige una vacante activa, ve en qué etapa va
 * cada persona de su proceso y suma candidatos del banco de talentos
 * (POST /api/admin/assign-candidates).
 *
 * Registro de APLICACIÓN (docs/DISENO.md): a la izquierda la lista de vacantes
 * (fija desde xl), a la derecha la vacante elegida con dos pestañas, Pipeline y
 * Asignar nuevos. Bajo xl (una columna) la lista fluye con la página y la
 * vacante elegida se abre en el Drawer del sistema. La lógica —qué se pide, cuándo y con qué parámetros, qué se
 * descarta al cambiar de vacante o de filtro (ADM-001/010/011/012/013/053/054)—
 * es la de siempre; sólo cambió la presentación.
 */

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowRight,
  Briefcase,
  CheckCircle2,
  ChevronRight,
  FileText,
  Search,
  UserCheck,
  UserCog,
  UserPlus,
  Users
} from 'lucide-react';
import { isSafeHttpUrl } from '@/lib/sanitize';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import DataTable, { type Columna } from '@/components/ui/DataTable';
import FilterToolbar, { FiltroSelect } from '@/components/ui/FilterToolbar';
import StatusBadge, { Badge } from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import Button, { clasesBoton } from '@/components/ui/Button';
import Tabs, { PanelPestana } from '@/components/ui/Tabs';
import Drawer from '@/components/ui/Drawer';
import FormField, { Input } from '@/components/ui/FormField';
import Skeleton, { SkeletonPagina } from '@/components/ui/Skeleton';
import { PAGINACION_VACIA, type PaginacionApi } from '@/components/ui/Pagination';
import { useAvisos } from '@/components/ui/Toast';
import { cn } from '@/lib/utils';
import EtapasPipeline, { type EtapaPipeline } from '@/components/ui/EtapasPipeline';
import { fechaCorta } from '@/lib/fechas';

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

/**
 * Vocabulario de esta pantalla para los estados de una postulación (el tono
 * sale del mapa común de Badge). 'hired' y 'company_rejected' no son estados
 * del schema, pero la pantalla ya los contemplaba: se conservan.
 */
const ETIQUETAS_PIPELINE: Record<string, string> = {
  pending: 'Pendiente',
  injected_by_admin: 'Asignado por admin',
  reviewing: 'En revisión',
  sent_to_specialist: 'Con especialista',
  evaluating: 'En evaluación',
  sent_to_company: 'Enviado a empresa',
  // ADM-053: estados que el schema sí usa y el mapa ignoraba. El módulo de
  // entrevistas pone la Application en 'interviewed' al confirmar.
  company_interested: 'Le interesa a la empresa',
  interviewed: 'Entrevistado',
  archived: 'Archivado',
  hired: 'Contratado',
  accepted: 'Contratado',
  rejected: 'Rechazado',
  discarded: 'Descartado',
  company_rejected: 'Rechazado por empresa'
};

const estadoPipeline = (status: string) => (
  <StatusBadge
    estado={status}
    etiqueta={ETIQUETAS_PIPELINE[status]}
    tono={status === 'company_rejected' ? 'peligro' : undefined}
  />
);

/** Fecha corta del panel (src/lib/fechas): «23 sep 2026», no «23/9/2026». */
const fecha = (iso: string) => fechaCorta(iso);

/** Cifra con separador de miles. */
const cifra = (n: number) => n.toLocaleString('es-MX');

const nombreDe = (p: { nombre: string; apellidoPaterno?: string | null }) =>
  `${p.nombre} ${p.apellidoPaterno || ''}`.trim();

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

  const seniorities = ['Practicante', 'Jr', 'Middle', 'Sr', 'Director'];

  // Paginación de candidatos (ADM-010: la API devuelve 30 por tanda)
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<PaginacionApi>(PAGINACION_VACIA);

  // ADM-054: id de la vacante cuya carga está en curso. Las respuestas que no
  // correspondan a ella se tiran en vez de pintarse.
  const vacanteVigente = useRef<number | null>(null);

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


  // ---------------------------------------------------------------------------
  // Presentación (nada de lo que sigue pide datos ni cambia qué se envía)
  // ---------------------------------------------------------------------------
  const { avisar } = useAvisos();

  // El resultado de «Asignar» sale como aviso flotante: el botón vive abajo,
  // lejos de la cabecera, y el mensaje dice cuántos se omitieron y por qué.
  useEffect(() => {
    if (success) avisar({ tono: 'exito', mensaje: success, duracion: 9000 });
  }, [success, avisar]);

  // Filtro local de la lista de vacantes (sólo esconde filas ya descargadas).
  const [filtroVacantes, setFiltroVacantes] = useState('');
  const textoVacantes = filtroVacantes.trim().toLowerCase();
  const vacantesVisibles = textoVacantes
    ? jobs.filter((j) =>
        `${j.title} ${j.company} ${j.location} ${j.profile ?? ''}`.toLowerCase().includes(textoVacantes)
      )
    : jobs;

  // Maestro-detalle. Desde xl, lista y detalle lado a lado. Por debajo (una
  // sola columna) el detalle iba DEBAJO de la lista, y la lista vivía en una
  // caja con scroll propio de unas tres vacantes (scroll dentro de scroll): al
  // elegir no pasaba nada visible. Ahora, bajo xl, la lista fluye con la página
  // y el detalle se abre en el Drawer del sistema (role="dialog", foco dentro,
  // Escape, el foco vuelve a la vacante al cerrar). Cerrarlo no deselecciona:
  // la vacante sigue elegida (barra lima) y pulsarla lo reabre sin volver a
  // pedir nada. Sólo presentación: las llamadas son las mismas.
  const [estrecho, setEstrecho] = useState(false);
  const [detalleAbierto, setDetalleAbierto] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const consulta = window.matchMedia('(max-width: 1279.98px)');
    setEstrecho(consulta.matches);
    const alCambiar = () => {
      setEstrecho(consulta.matches);
      // Al cruzar el corte no se abre (ni se queda abierto) un cajón por sorpresa.
      setDetalleAbierto(false);
    };
    consulta.addEventListener?.('change', alCambiar);
    return () => consulta.removeEventListener?.('change', alCambiar);
  }, []);
  // Toda vacante que se elige (también la del enlace ?jobId=) abre el detalle.
  useEffect(() => {
    if (selectedJob) setDetalleAbierto(true);
  }, [selectedJob]);
  const enCajon = estrecho && !!selectedJob && detalleAbierto;


  const subcategorias = getSubcategoriesForProfile();
  const filtrosActivos = [profileFilter, seniorityFilter, subcategoryFilter].filter(Boolean).length;
  const limpiarFiltros = () => {
    setProfileFilter('');
    setSeniorityFilter('');
    setSubcategoryFilter('');
  };
  const seleccionados = selectedCandidates.size;

  const etapas: EtapaPipeline[] = pipelineStats
    ? [
        { id: 'pendientes', etiqueta: 'Pendientes', valor: pipelineStats.pending + pipelineStats.injected, punto: 'bg-orange' },
        { id: 'revision', etiqueta: 'En revisión', valor: pipelineStats.reviewing, punto: 'bg-teal' },
        { id: 'evaluacion', etiqueta: 'Evaluación', valor: pipelineStats.sentToSpecialist + pipelineStats.evaluating, punto: 'bg-teal' },
        // 'Enviados' incluye a los que ya le interesan a la empresa (ADM-053).
        { id: 'enviados', etiqueta: 'Enviados', valor: pipelineStats.sentToCompany + (pipelineStats.companyInterested ?? 0), punto: 'bg-orange' },
        { id: 'entrevista', etiqueta: 'Entrevista', valor: pipelineStats.interviewed ?? 0, punto: 'bg-teal' },
        { id: 'contratados', etiqueta: 'Contratados', valor: pipelineStats.hired, punto: 'bg-lime' },
        { id: 'descartados', etiqueta: 'Descartados', valor: pipelineStats.rejected + (pipelineStats.archived ?? 0), punto: 'bg-line-strong' }
      ]
    : [];

  // Columnas del pipeline (quién está ya en el proceso de la vacante)
  const columnasPipeline: Columna<PipelineCandidate>[] = [
    {
      id: 'candidato',
      encabezado: 'Candidato',
      enTarjeta: 'titulo',
      className: 'min-w-[14rem]',
      celda: (c) => (
        <div className="min-w-0">
          <p className="font-semibold text-ink">{c.candidateName}</p>
          <p className="truncate text-[13px] text-ink-muted">{c.candidateEmail}</p>
          {/* Si la tabla es estrecha, la columna Perfil se esconde y su dato sube aquí. */}
          {c.candidateProfile && (c.candidateProfile.profile || c.candidateProfile.seniority) && (
            <span data-solo-bajo="md" className="mt-1 flex flex-wrap gap-1">
              {c.candidateProfile.profile && (
                <Badge tono="info" sinPunto tamano="sm">{c.candidateProfile.profile}</Badge>
              )}
              {c.candidateProfile.seniority && (
                <Badge tono="neutro" sinPunto tamano="sm">{c.candidateProfile.seniority}</Badge>
              )}
            </span>
          )}
          {c.notes && (
            <p className="mt-1 line-clamp-2 text-xs text-ink-muted">
              <span className="font-medium text-ink">Notas:</span> {c.notes}
            </p>
          )}
        </div>
      )
    },
    {
      id: 'perfil',
      encabezado: 'Perfil',
      ocultarBajo: 'md',
      celda: (c) =>
        c.candidateProfile ? (
          <div className="flex flex-wrap items-center gap-1">
            {c.candidateProfile.profile && (
              <Badge tono="info" sinPunto tamano="sm">{c.candidateProfile.profile}</Badge>
            )}
            {c.candidateProfile.seniority && (
              <Badge tono="neutro" sinPunto tamano="sm">{c.candidateProfile.seniority}</Badge>
            )}
            {c.candidateProfile.añosExperiencia > 0 && (
              <span className="text-xs tabular-nums text-ink-muted">{c.candidateProfile.añosExperiencia} años exp.</span>
            )}
          </div>
        ) : (
          <span className="text-[13px] text-ink-muted">Sin expediente</span>
        )
    },
    {
      id: 'estado',
      encabezado: 'Estado',
      celda: (c) => estadoPipeline(c.status)
    },
    {
      id: 'actualizado',
      encabezado: 'Actualizado',
      ocultarBajo: 'lg',
      className: 'whitespace-nowrap',
      celda: (c) => (
        <div className="text-[13px] tabular-nums">
          <p className="text-ink">{fecha(c.updatedAt)}</p>
          <p className="text-xs text-ink-muted">Ingreso {fecha(c.createdAt)}</p>
        </div>
      )
    },
    {
      id: 'cv',
      encabezado: 'CV',
      encabezadoOculto: true,
      alinear: 'fin',
      enTarjeta: 'acciones',
      className: 'w-px whitespace-nowrap',
      celda: (c) => {
        const url = c.cvUrl ? ensureUrl(c.cvUrl) : undefined;
        return url ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={clasesBoton({ variante: 'fantasma', tamano: 'sm' })}
          >
            <FileText aria-hidden="true" />
            Ver CV
            <span className="sr-only"> de {c.candidateName} (se abre en otra pestaña)</span>
          </a>
        ) : null;
      }
    }
  ];

  // Columnas del banco (a quién se puede sumar a la vacante)
  const columnasBanco: Columna<Candidate>[] = [
    {
      id: 'candidato',
      encabezado: 'Candidato',
      enTarjeta: 'titulo',
      className: 'min-w-[15rem]',
      celda: (c) => {
        const email = c.email.toLowerCase();
        const yaAsignado = alreadyAssigned.has(email);
        const conteo = candidateAssignments[email] || 0;
        return (
          // La casilla la pinta DataTable (seleccion); pulsar la fila marca.
          <div className="min-w-0">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className={cn('font-semibold', yaAsignado ? 'text-ink-muted' : 'text-ink')}>
                {c.nombre} {c.apellidoPaterno}
              </span>
              {conteo > 0 && (
                <Badge tono="info" sinPunto tamano="sm" title="Procesos vivos en otras vacantes">
                  {conteo} vacante{conteo > 1 ? 's' : ''}
                </Badge>
              )}
              {yaAsignado && (
                <Badge tono="neutro" icono={CheckCircle2} tamano="sm">Ya en esta vacante</Badge>
              )}
            </span>
            <span className="block truncate text-[13px] text-ink-muted">{c.email}</span>
            {/* Experiencia y universidad suben aquí cuando sus columnas se esconden. */}
            <span data-solo-bajo="md" className="mt-0.5 block text-xs tabular-nums text-ink-muted">
              {c.añosExperiencia} años exp.{c.universidad ? ` · ${c.universidad}` : ''}
            </span>
          </div>
        );
      }
    },
    {
      id: 'especialidad',
      encabezado: 'Especialidad',
      celda: (c) =>
        c.profile || c.seniority ? (
          <div className="flex flex-wrap items-center gap-1">
            {c.profile && <Badge tono="info" sinPunto tamano="sm">{c.profile}</Badge>}
            {c.seniority && <Badge tono="neutro" sinPunto tamano="sm">{c.seniority}</Badge>}
          </div>
        ) : (
          <span className="text-ink-muted" aria-label="Sin especialidad">—</span>
        )
    },
    {
      id: 'experiencia',
      encabezado: 'Experiencia',
      numerica: true,
      ocultarBajo: 'md',
      className: 'whitespace-nowrap',
      celda: (c) => `${c.añosExperiencia} años`
    },
    {
      id: 'universidad',
      encabezado: 'Universidad',
      ocultarBajo: 'lg',
      celda: (c) =>
        c.universidad ? (
          <span className="text-[13px] text-ink-muted">{c.universidad}</span>
        ) : (
          <span className="text-ink-muted" aria-label="Sin universidad">—</span>
        )
    }
  ];

  const equipoCargado = pipelineStats !== null;
  const hayEquipo = !!(jobAssignment && (jobAssignment.recruiter || jobAssignment.specialist));

  // El aviso de error va donde se ve: sobre la página o, con el detalle en el
  // cajón (que tapa la página), dentro del cajón.
  const avisoError = (clase: string) =>
    error ? (
      <div
        role="alert"
        className={cn(
          'flex items-start gap-2 rounded-xl border border-danger/30 bg-danger-tint px-4 py-3 text-sm font-medium text-danger-dark',
          clase
        )}
      >
        <AlertCircle size={18} className="mt-px flex-none" aria-hidden="true" />
        <p className="min-w-0 flex-1">{error}</p>
      </div>
    ) : null;

  // Lo que dice la barra de «Asignar» (fija abajo en la tarjeta, o en el pie
  // del cajón). ADM-012: sólo en «Asignar nuevos» y con alguien marcado.
  const contenidoBarraAsignar = (job: Job) => (
    <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="font-display text-sm font-semibold text-ink">
          {seleccionados} {seleccionados === 1 ? 'candidato seleccionado' : 'candidatos seleccionados'}
        </p>
        <p className="truncate text-[13px] text-ink-muted">
          Para: {job.title} — {job.company}
        </p>
        {/* El error de «Asignar» también aquí, junto al botón (arriba ya
            lo anuncia el aviso con role="alert"). */}
        {error && <p className="mt-1 text-[13px] font-medium text-danger">{error}</p>}
      </div>
      <Button
        onClick={handleAssign}
        cargando={isAssigning}
        textoCargando="Asignando…"
        iconoFinal={ArrowRight}
        className="w-full sm:w-auto"
      >
        Asignar a la vacante
      </Button>
    </div>
  );

  const insigniasVacante = (job: Job) =>
    (job.profile || job.seniority) && (
      <>
        {job.profile && <Badge tono="info" sinPunto>{job.profile}</Badge>}
        {job.seniority && <Badge tono="neutro" sinPunto>{job.seniority}</Badge>}
      </>
    );

  /**
   * El detalle de la vacante elegida, en su sitio: desde xl, una tarjeta a la
   * derecha de la lista; por debajo, el Drawer del sistema (a pantalla
   * completa en el móvil). El contenido es el mismo en los dos.
   */
  const envolverDetalle = (job: Job, contenido: React.ReactNode) =>
    estrecho ? (
      <Drawer
        abierto={detalleAbierto}
        alCerrar={() => setDetalleAbierto(false)}
        titulo={job.title}
        descripcion={
          <>
            <span className="block">
              {job.company} · {job.location}
            </span>
            {insigniasVacante(job) && <span className="mt-2 flex flex-wrap gap-1">{insigniasVacante(job)}</span>}
          </>
        }
        ancho="w-[min(44rem,100vw)]"
        pie={activeTab === 'assign' && seleccionados > 0 ? contenidoBarraAsignar(job) : undefined}
      >
        {/* El cuerpo del cajón ya trae relleno: el detalle va a sangre, como
            en la tarjeta. */}
        <div className="-mx-5 -my-5">
          {avisoError('mx-5 mt-4')}
          {contenido}
        </div>
      </Drawer>
    ) : (
      <Card
        titulo={job.title}
        descripcion={`${job.company} · ${job.location}`}
        acciones={insigniasVacante(job)}
        sinRelleno
      >
        {contenido}
      </Card>
    );

  return (
    <>
      <PageHeader
        antetitulo="Reclutamiento"
        titulo="Asignar candidatos"
        remate="del banco de talentos"
        descripcion="Elige una vacante activa, revisa en qué va su proceso y suma candidatos del banco."
      />

      {!enCajon && avisoError('mb-6')}

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[17rem_minmax(0,1fr)]">
        {/* ------------------------------------------------------------------
            Vacantes activas
           ------------------------------------------------------------------ */}
        <Card
          titulo="Vacantes activas"
          descripcion={
            isLoadingJobs
              ? 'Cargando…'
              : `${cifra(jobs.length)} ${jobs.length === 1 ? 'vacante' : 'vacantes'}${estrecho ? ' · pulsa una para ver su pipeline' : ''}`
          }
          sinRelleno
          className="xl:sticky xl:top-[4.5rem]"
        >
          {jobs.length > 6 && (
            <div className="border-b border-line px-4 py-3">
              <FormField etiqueta="Filtrar vacantes" etiquetaOculta>
                <Input
                  type="search"
                  value={filtroVacantes}
                  onChange={(e) => setFiltroVacantes(e.target.value)}
                  placeholder="Puesto, empresa o ciudad"
                  prefijo={<Search />}
                  className="h-9"
                />
              </FormField>
            </div>
          )}

          {/* Scroll propio sólo desde xl, donde la tarjeta va fija junto al
              detalle. Por debajo la lista fluye con la página: nada de
              scroll dentro de scroll. */}
          <div className="xl:max-h-[calc(100vh-14rem)] xl:overflow-y-auto xl:overscroll-contain">
            {isLoadingJobs ? (
              <div className="space-y-4 px-4 py-4" role="status">
                <span className="sr-only">Cargando vacantes…</span>
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                ))}
              </div>
            ) : jobs.length === 0 ? (
              <EmptyState compacto icono={Briefcase} titulo="No hay vacantes activas" />
            ) : vacantesVisibles.length === 0 ? (
              <EmptyState
                compacto
                icono={Search}
                titulo="Ninguna vacante coincide"
                accion={
                  <Button variante="contorno" tamano="sm" onClick={() => setFiltroVacantes('')}>
                    Quitar filtro
                  </Button>
                }
              />
            ) : (
              <ul className="divide-y divide-line">
                {vacantesVisibles.map((job) => {
                  const activa = selectedJob?.id === job.id;
                  return (
                    <li key={job.id}>
                      <button
                        type="button"
                        onClick={() => {
                          handleSelectJob(job);
                          // Bajo xl: abre el cajón (también si ya era la elegida).
                          setDetalleAbierto(true);
                        }}
                        aria-pressed={activa}
                        className={cn(
                          'relative block w-full px-4 py-3 pr-10 text-left transition-colors duration-150 focus-visible:outline-offset-[-2px] xl:pr-4',
                          activa ? 'bg-teal-tint/60' : 'hover:bg-paper'
                        )}
                      >
                        {/* El ítem activo, como en la barra lateral: una barra lima. */}
                        {activa && (
                          <span aria-hidden="true" className="absolute inset-y-2 left-0 w-[3px] rounded-r bg-lime" />
                        )}
                        {/* Bajo xl el detalle se abre aparte: el chevrón lo anuncia. */}
                        <ChevronRight
                          aria-hidden="true"
                          className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted xl:hidden"
                        />
                        <span className="block font-semibold leading-snug text-ink">{job.title}</span>
                        <span className="mt-0.5 block text-[13px] text-ink-muted">
                          {job.company}
                          {typeof job._count?.applications === 'number' && (
                            <span className="tabular-nums">
                              {' '}· {job._count.applications} {job._count.applications === 1 ? 'candidato' : 'candidatos'}
                            </span>
                          )}
                        </span>
                        {(job.profile || job.seniority) && (
                          <span className="mt-1.5 flex flex-wrap gap-1">
                            {job.profile && <Badge tono="info" sinPunto tamano="sm">{job.profile}</Badge>}
                            {job.seniority && <Badge tono="neutro" sinPunto tamano="sm">{job.seniority}</Badge>}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Card>

        {/* ------------------------------------------------------------------
            Vacante elegida: pipeline y asignación
           ------------------------------------------------------------------ */}
        {/* La columna del detalle sólo existe desde xl; por debajo, el
            detalle es el cajón (un portal: su sitio en el árbol da igual). */}
        <div className="hidden min-w-0 xl:block">
          {!selectedJob ? (
            <Card sinRelleno>
              <EmptyState
                frase="Todo empieza por una vacante."
                titulo="Elige una vacante"
                descripcion="Selecciona una vacante activa para ver su pipeline y los candidatos disponibles del banco."
              />
            </Card>
          ) : (
            envolverDetalle(selectedJob, <>
              {/* Equipo de la vacante (viene con el pipeline) */}
              {(isLoadingPipeline || equipoCargado) && (
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-line bg-paper/60 px-5 py-3 text-sm">
                  {isLoadingPipeline && !equipoCargado ? (
                    <Skeleton className="h-4 w-72 max-w-full" />
                  ) : hayEquipo ? (
                    <>
                      {jobAssignment?.recruiter && (
                        <span className="inline-flex items-center gap-2">
                          <UserCheck size={16} className="flex-none text-teal" aria-hidden="true" />
                          <span className="text-ink-muted">Reclutador</span>
                          <span className="font-medium text-ink">{nombreDe(jobAssignment.recruiter)}</span>
                        </span>
                      )}
                      {jobAssignment?.specialist && (
                        <span className="inline-flex flex-wrap items-center gap-x-2">
                          <UserCog size={16} className="flex-none text-teal" aria-hidden="true" />
                          <span className="text-ink-muted">Especialista</span>
                          <span className="font-medium text-ink">{nombreDe(jobAssignment.specialist)}</span>
                          {jobAssignment.specialist.specialty && (
                            <span className="text-xs text-ink-muted">({jobAssignment.specialist.specialty})</span>
                          )}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-ink-muted">
                      <Users size={16} className="flex-none" aria-hidden="true" />
                      Sin equipo asignado
                      <Link
                        href="/admin/assignments"
                        className="inline-flex items-center gap-1 rounded font-semibold text-teal hover:text-teal-dark hover:underline"
                      >
                        Asignar equipo
                        <ArrowRight size={14} aria-hidden="true" />
                      </Link>
                    </span>
                  )}
                </div>
              )}

              <Tabs
                idBase="asignar"
                etiqueta="Vistas de la vacante"
                activa={activeTab}
                alCambiar={(id) => setActiveTab(id as 'assign' | 'pipeline')}
                pestanas={[
                  { id: 'pipeline', etiqueta: 'Pipeline', contador: pipelineStats ? pipelineStats.total : undefined },
                  { id: 'assign', etiqueta: 'Asignar nuevos', contador: availableCandidatesCount }
                ]}
                className="px-3"
              />

              {/* ---------------- Pipeline ---------------- */}
              <PanelPestana idBase="asignar" id="pipeline" activa={activeTab} className="pt-0">
                {pipelineStats && (
                  <div className="border-b border-line px-5 py-5">
                    <EtapasPipeline etapas={etapas} />
                  </div>
                )}

                {/* Notas del equipo: son de la vacante, no de cada candidato. */}
                {(jobAssignment?.recruiterNotes || jobAssignment?.specialistNotes) && (
                  <div className="grid gap-4 border-b border-line px-5 py-4 md:grid-cols-2">
                    {jobAssignment?.recruiterNotes && (
                      <div className="min-w-0">
                        <h3 className="text-xs font-medium text-ink-muted">Notas del reclutador</h3>
                        <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink">{jobAssignment.recruiterNotes}</p>
                      </div>
                    )}
                    {jobAssignment?.specialistNotes && (
                      <div className="min-w-0">
                        <h3 className="text-xs font-medium text-ink-muted">Notas del especialista</h3>
                        <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink">{jobAssignment.specialistNotes}</p>
                      </div>
                    )}
                  </div>
                )}

                <DataTable
                  etiqueta={`Pipeline de ${selectedJob.title}`}
                  columnas={columnasPipeline}
                  filas={pipelineCandidates}
                  claveFila={(c) => c.id}
                  cargando={isLoadingPipeline}
                  filasEsqueleto={4}
                  // En el cajón la cabecera no se fija (se pegaría bajo la barra
                  // del AppShell, que el cajón tapa).
                  cabeceraFija={!estrecho}
                  vacio={
                    pipelineStats ? (
                      <EmptyState
                        frase="Nadie en camino, todavía."
                        titulo="No hay candidatos en el pipeline"
                        accion={
                          <Button variante="contorno" tamano="sm" icono={UserPlus} onClick={() => setActiveTab('assign')}>
                            Asignar candidatos
                          </Button>
                        }
                      />
                    ) : (
                      <p className="px-5 py-10 text-center text-sm text-ink-muted">
                        No se pudo cargar el pipeline de esta vacante.
                      </p>
                    )
                  }
                />
              </PanelPestana>

              {/* ---------------- Asignar nuevos ---------------- */}
              <PanelPestana idBase="asignar" id="assign" activa={activeTab} className="pt-0">
                {/* Intro en el buscador (o en un filtro) lanza la búsqueda, como
                    siempre; «Buscar» hace lo mismo que el antiguo «Actualizar».
                    En móvil los filtros se pliegan tras «Filtros»; desde sm,
                    siempre a la vista. */}
                <FilterToolbar
                  className="border-b border-line px-5 py-4"
                  alAplicar={buscarCandidatos}
                  plegableEnMovil
                  busqueda={{
                    valor: searchTerm,
                    alCambiar: setSearchTerm,
                    etiqueta: 'Buscar en el banco',
                    placeholder: 'Nombre, correo o carrera'
                  }}
                  activos={filtrosActivos}
                  alLimpiar={limpiarFiltros}
                  resumen={
                    isLoadingCandidates
                      ? 'Buscando…'
                      : `${cifra(pagination.total)} ${pagination.total === 1 ? 'candidato' : 'candidatos'} en el banco`
                  }
                >
                  <FiltroSelect
                    etiqueta="Especialidad"
                    value={profileFilter}
                    onChange={(e) => {
                      setProfileFilter(e.target.value);
                      setSubcategoryFilter(''); // Limpiar subcategoría al cambiar perfil
                    }}
                  >
                    <option value="">Todas</option>
                    {specialties.map((s) => (
                      <option key={s.id} value={s.name}>{s.name}</option>
                    ))}
                  </FiltroSelect>
                  <FiltroSelect
                    etiqueta="Nivel"
                    value={seniorityFilter}
                    onChange={(e) => setSeniorityFilter(e.target.value)}
                  >
                    <option value="">Todos</option>
                    {seniorities.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </FiltroSelect>
                  {profileFilter && subcategorias.length > 0 && (
                    <FiltroSelect
                      etiqueta="Subcategoría"
                      value={subcategoryFilter}
                      onChange={(e) => setSubcategoryFilter(e.target.value)}
                    >
                      <option value="">Todas</option>
                      {subcategorias.map((sub, idx) => (
                        <option key={idx} value={sub}>{sub}</option>
                      ))}
                    </FiltroSelect>
                  )}
                </FilterToolbar>

                <DataTable
                  etiqueta={`Candidatos del banco para ${selectedJob.title}`}
                  columnas={columnasBanco}
                  filas={candidates}
                  claveFila={(c) => c.id}
                  cargando={isLoadingCandidates}
                  cabeceraFija={!estrecho}
                  // Casillas: marcada = fondo verde azulado; ya asignada = apagada
                  // y sin casilla activa. «Seleccionar todos» es handleSelectAll
                  // de siempre (ADM-012: por pertenencia, no por tamaño).
                  seleccion={{
                    marcada: (c) => selectedCandidates.has(c.id),
                    alAlternar: (c) => handleSelectCandidate(c.id),
                    deshabilitada: (c) => alreadyAssigned.has(c.email.toLowerCase()),
                    etiquetaFila: (c) => `Seleccionar a ${c.nombre} ${c.apellidoPaterno}`,
                    todas: {
                      etiqueta: `Seleccionar todos (${availableCandidatesCount} en esta página)`,
                      alAlternar: handleSelectAll,
                      extra: `${candidates.length - availableCandidatesCount} ya asignados`
                    }
                  }}
                  paginacion={pagination}
                  alCambiarPagina={irAPagina}
                  etiquetaTotal="candidatos disponibles"
                  vacio={
                    <EmptyState
                      frase="Nadie con ese perfil, por ahora."
                      titulo="No hay candidatos disponibles"
                      descripcion={
                        filtrosActivos > 0 || searchTerm
                          ? 'Prueba con otra especialidad, otro nivel u otra búsqueda.'
                          : undefined
                      }
                      accion={
                        filtrosActivos > 0 ? (
                          <Button variante="contorno" tamano="sm" onClick={limpiarFiltros}>
                            Limpiar filtros
                          </Button>
                        ) : undefined
                      }
                    />
                  }
                />

                {/* Barra de la acción: fija abajo mientras se recorre la lista.
                    ADM-012: sólo en «Asignar nuevos» (en el pipeline no hay nada
                    que asignar). En el cajón va en su pie (siempre a la vista). */}
                {!estrecho && seleccionados > 0 && (
                  <div className="sticky bottom-0 z-20 border-t border-line bg-white px-5 py-3.5 shadow-ap-2">
                    {contenidoBarraAsignar(selectedJob)}
                  </div>
                )}
              </PanelPestana>
            </>)
          )}
        </div>
      </div>
    </>
  );
}

// Wrapper con Suspense para useSearchParams
export default function AssignCandidatesPage() {
  return (
    <Suspense fallback={<SkeletonPagina conCifras={false} />}>
      <AssignCandidatesContent />
    </Suspense>
  );
}
