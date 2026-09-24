// RUTA: src/app/admin/page.tsx

'use client';

/**
 * Panel del administrador: cifras de /api/admin/stats + tabla de vacantes de
 * todas las empresas + pipeline de cada vacante.
 *
 * ES LA PÁGINA DE REFERENCIA del registro de aplicación (docs/DISENO.md):
 * PageHeader → fila de StatCard → Card con FilterToolbar + DataTable paginada →
 * Modal. La lógica (llamadas, estados, filtros, orden) es la de siempre; sólo
 * cambió la presentación. Si copias este patrón, copia también eso: el
 * rediseño no toca qué se pide ni cómo se decide.
 */

import React, { useState, useEffect, type ComponentProps } from 'react';
import { useRouter } from 'next/navigation';
import {
  Briefcase,
  Users,
  Building2,
  FileText,
  RefreshCw,
  Eye,
  Clock,
  CheckCircle,
  AlertCircle,
  MapPin,
  Calendar,
  Banknote,
  Monitor,
  GraduationCap,
  BarChart3,
  Loader2,
  ChevronRight,
  X,
  ArrowRight,
} from 'lucide-react';
import CandidateProfileModal from '@/components/shared/CandidateProfileModal';
import PageHeader from '@/components/ui/PageHeader';
import { AvisoError } from '@/components/ui/Aviso';
import StatCard from '@/components/ui/StatCard';
import Card from '@/components/ui/Card';
import DataTable, { type Columna } from '@/components/ui/DataTable';
import FilterToolbar, { FiltroSelect } from '@/components/ui/FilterToolbar';
import StatusBadge, { Badge } from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import Button, { ButtonLink } from '@/components/ui/Button';
import IconButton from '@/components/ui/IconButton';
import Modal from '@/components/ui/Modal';
import { SkeletonPagina } from '@/components/ui/Skeleton';
import { paginacionLocal } from '@/components/ui/Pagination';
import { cn } from '@/lib/utils';
import { fechaCorta, fechaHora, fechaLarga, hora } from '@/lib/fechas';

/** Filas por página de la tabla de vacantes. */
const VACANTES_POR_PAGINA = 20;

/** Estados de vacante que tienen etiqueta propia; cualquier otro se pinta como borrador (como siempre). */
const ESTADOS_VACANTE = ['active', 'paused', 'draft', 'closed'];

interface Job {
  id: number;
  title: string;
  company: string;
  location: string;
  status: string;
  profile: string | null;
  seniority: string | null;
  createdAt: string;
  editableUntil?: string | null; // Límite de 4 horas para editar
  userId: number | null;
  salary?: string;
  jobType?: string;
  workMode?: string;
  description?: string;
  requirements?: string | null;
  habilidades?: string | null;
  responsabilidades?: string | null;
  resultadosEsperados?: string | null;
  valoresActitudes?: string | null;
  informacionAdicional?: string | null;
  expiresAt?: string | null;
  creditCost?: number;
  user?: {
    id: number;
    nombre: string;
    email: string;
  } | null;
  _count?: {
    applications: number;
  };
}

/** Una postulación tal como la devuelve GET /api/admin/jobs/[id]/pipeline. */
interface PostulacionPipeline {
  id: number;
  candidateName: string;
  candidateEmail: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  /** Perfil del banco de candidatos (por correo); null si no hay expediente. */
  candidateProfile?: unknown;
}

/** Respuesta de GET /api/admin/jobs/[id]/pipeline (data). */
interface Pipeline {
  job: { id: number; title: string; company: string; status: string; habilidades?: string | null };
  total: number;
  archived?: number;
  stageTotals: { recruiter: number; specialist: number; company: number; archived?: number };
  stages: {
    recruiter: { pending: number; reviewing: number; sent_to_specialist: number; discarded: number };
    specialist: { evaluating: number; sent_to_company: number };
    company: { interested: number; interviewed: number; rejected: number; accepted: number };
  };
  applications: PostulacionPipeline[];
  jobAssignment: { recruiterNotes: string | null; specialistNotes: string | null } | null;
}

type PropsFicha = ComponentProps<typeof CandidateProfileModal>;

interface DashboardStats {
  totalJobs: number;
  activeJobs: number;
  pausedJobs: number;
  draftJobs: number;
  closedJobs: number;
  totalApplications: number;
  pendingRequests: number;
  totalCandidates: number;
  totalCompanies: number;
}

/** Cifra con separador de miles (1,284). */
const cifra = (n: number) => n.toLocaleString('es-MX');

// Las fechas salen del formateador único (src/lib/fechas.ts): «23 sep 2026,
// 18:22» en la tabla, la larga sólo en el detalle.

export default function AdminDashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats>({
    totalJobs: 0,
    activeJobs: 0,
    pausedJobs: 0,
    draftJobs: 0,
    closedJobs: 0,
    totalApplications: 0,
    pendingRequests: 0,
    totalCandidates: 0,
    totalCompanies: 0
  });
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filteredJobs, setFilteredJobs] = useState<Job[]>([]);
  const [companies, setCompanies] = useState<string[]>([]);
  const [profiles, setProfiles] = useState<string[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<string>('');
  const [selectedProfile, setSelectedProfile] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Pipeline modal
  const [pipelineJobId, setPipelineJobId] = useState<number | null>(null);
  const [pipelineData, setPipelineData] = useState<Pipeline | null>(null);
  const [loadingPipeline, setLoadingPipeline] = useState(false);
  const [expandedStage, setExpandedStage] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);

  // Pipeline candidate profile modal
  const [selectedPipelineCandidate, setSelectedPipelineCandidate] = useState<PostulacionPipeline | null>(null);
  const [isPipelineCandidateModalOpen, setIsPipelineCandidateModalOpen] = useState(false);

  // Estado para ordenamiento de tabla
  const [sortField, setSortField] = useState<string>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // ADM-003: la tabla hacía slice(0, 20) y sólo decía "Mostrando 20 de N": las
  // vacantes 21+ no se podían abrir desde el panel. Ahora se pagina.
  const [paginaTabla, setPaginaTabla] = useState(1);
  // Cuántas vacantes hay en total según la API (la tabla carga hasta 100).
  const [vacantesEnServidor, setVacantesEnServidor] = useState(0);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    // Filtrar vacantes cuando cambia la empresa, especialidad o status seleccionado
    let filtered = jobs;
    if (selectedCompany) {
      filtered = filtered.filter(j => j.company === selectedCompany);
    }
    if (selectedProfile) {
      filtered = filtered.filter(j => j.profile === selectedProfile);
    }
    if (selectedStatus) {
      filtered = filtered.filter(j => j.status === selectedStatus);
    }
    setFilteredJobs(filtered);
    setPaginaTabla(1);
  }, [selectedCompany, selectedProfile, selectedStatus, jobs]);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch múltiples endpoints en paralelo (allSettled para resiliencia)
      // Las cifras salen de /api/admin/stats, que cuenta en la base de datos.
      // Calcularlas aquí con `.length` daba números falsos: estas respuestas
      // están paginadas (se topaban en 20/30) y /api/jobs devuelve sólo vacantes
      // activas por defecto, así que borradores, pausadas y cerradas salían
      // siempre en 0. La tabla sí necesita las filas, y pide el máximo por
      // página incluyendo borradores.
      // ADM-003: ya no se descarga /api/company-requests entero; su respuesta no
      // se usaba (las pendientes vienen contadas de /api/admin/stats).
      const results = await Promise.allSettled([
        fetch('/api/jobs?includeDrafts=true&limit=100').then(r => r.json()),
        fetch('/api/admin/stats').then(r => r.json())
      ]);

      const jobsData = results[0].status === 'fulfilled' ? results[0].value : { success: false };
      const statsData = results[1].status === 'fulfilled' ? results[1].value : { success: false };

      if (statsData.success && statsData.data) {
        setStats(prev => ({ ...prev, ...statsData.data }));
      }

      // Procesar vacantes
      if (jobsData.success) {
        const allJobs = jobsData.data || [];
        setJobs(allJobs);
        setFilteredJobs(allJobs);
        setVacantesEnServidor(jobsData.pagination?.total ?? allJobs.length);

        // Extraer empresas únicas
        const uniqueCompanies = [...new Set(allJobs.map((j: Job) => j.company))].sort() as string[];
        setCompanies(uniqueCompanies);

        // Extraer especialidades únicas (excluyendo null/undefined)
        const uniqueProfiles = [...new Set(allJobs.map((j: Job) => j.profile).filter(Boolean))].sort() as string[];
        setProfiles(uniqueProfiles);
      }

    } catch (err) {
      console.error('Error fetching dashboard:', err);
      setError('Error al cargar datos del dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch pipeline de una vacante
  const fetchPipeline = async (jobId: number) => {
    setPipelineJobId(jobId);
    setLoadingPipeline(true);
    setPipelineData(null);
    setExpandedStage(null);
    setFilterStatus(null);

    try {
      const res = await fetch(`/api/admin/jobs/${jobId}/pipeline`);
      const data = await res.json();
      if (data.success) {
        setPipelineData(data.data);
      }
    } catch (err) {
      console.error('Error fetching pipeline:', err);
    } finally {
      setLoadingPipeline(false);
    }
  };

  // Helper: obtener aplicaciones filtradas por status
  const getFilteredApplications = (status: string): PostulacionPipeline[] => {
    if (!pipelineData?.applications) return [];
    if (status === 'pending') {
      return pipelineData.applications.filter((a) =>
        a.status === 'pending' || a.status === 'injected_by_admin'
      );
    }
    return pipelineData.applications.filter((a) => a.status === status);
  };

  // Helper: label legible de status
  const getStatusLabel = (status: string): string => {
    const labels: Record<string, string> = {
      pending: 'Por revisar',
      reviewing: 'En revisión',
      sent_to_specialist: 'Enviados a especialista',
      discarded: 'Descartados',
      evaluating: 'Evaluando',
      sent_to_company: 'Enviados a empresa',
      company_interested: 'Le interesan',
      interested: 'Le interesan',
      interviewed: 'Entrevistados',
      rejected: 'Rechazados',
      accepted: 'Contratados',
      archived: 'Archivados'
    };
    return labels[status] || status;
  };

  // Función para manejar ordenamiento
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Ordenar jobs filtrados
  const sortedJobs = [...filteredJobs].sort((a, b) => {
    let aVal: string | number;
    let bVal: string | number;

    switch (sortField) {
      case 'title':
        aVal = a.title?.toLowerCase() || '';
        bVal = b.title?.toLowerCase() || '';
        break;
      case 'company':
        aVal = a.company?.toLowerCase() || '';
        bVal = b.company?.toLowerCase() || '';
        break;
      case 'location':
        aVal = a.location?.toLowerCase() || '';
        bVal = b.location?.toLowerCase() || '';
        break;
      case 'createdAt':
        aVal = new Date(a.createdAt).getTime();
        bVal = new Date(b.createdAt).getTime();
        break;
      case 'applications':
        aVal = a._count?.applications || 0;
        bVal = b._count?.applications || 0;
        break;
      case 'status':
        aVal = a.status || '';
        bVal = b.status || '';
        break;
      case 'profile':
        aVal = a.profile?.toLowerCase() || '';
        bVal = b.profile?.toLowerCase() || '';
        break;
      default:
        aVal = '';
        bVal = '';
    }

    let comparison = 0;
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      comparison = aVal.localeCompare(bVal);
    } else {
      comparison = (aVal as number) > (bVal as number) ? 1 : (aVal as number) < (bVal as number) ? -1 : 0;
    }

    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const abrirVacante = (job: Job) => {
    setSelectedJob(job);
    setIsModalOpen(true);
  };

  const cerrarVacante = () => {
    setIsModalOpen(false);
    setSelectedJob(null);
  };

  const cerrarPipeline = () => {
    setPipelineJobId(null);
    setPipelineData(null);
    setFilterStatus(null);
  };

  // Estado de una vacante: un valor desconocido se pinta como borrador (como siempre).
  const estadoVacante = (status: string) => (
    <StatusBadge estado={ESTADOS_VACANTE.includes(status) ? status : 'draft'} contexto="vacante" />
  );

  // Aviso de la ventana de edición (4 h tras publicar).
  const avisoEdicion = (job: Job) =>
    job.editableUntil ? (
      new Date(job.editableUntil) > new Date() ? (
        <span className="mt-1 flex items-center gap-1 whitespace-nowrap text-xs font-medium text-orange-dark">
          <Clock size={12} aria-hidden="true" />
          Editable hasta {hora(job.editableUntil)}
        </span>
      ) : (
        <span className="mt-1 flex items-center gap-1 whitespace-nowrap text-xs font-medium text-lime-dark">
          <CheckCircle size={12} aria-hidden="true" />
          Listo para procesar
        </span>
      )
    ) : null;

  // ---------------------------------------------------------------------------
  // Columnas de la tabla (declarativas: DataTable pinta, ordena y pasa a tarjetas)
  //
  // Densidad: filas de 44–48 px. El nivel va EN LÍNEA con el título (no debajo),
  // empresa y ubicación en una línea (con «…» y el texto entero en el title) y
  // la fecha no parte. En móvil, la tarjeta es título + una línea de «meta»
  // (empresa · ubicación · especialidad · candidatos · estado · fecha): ~110 px
  // por vacante en vez de los ~330 de seis pares «etiqueta: valor».
  // ---------------------------------------------------------------------------
  const columnas: Columna<Job>[] = [
    {
      id: 'title',
      encabezado: 'Vacante',
      ordenable: true,
      enTarjeta: 'titulo',
      className: 'min-w-[12rem]',
      celda: (job) => (
        // Sin flex-wrap: el nivel se queda a la derecha del título aunque éste
        // parta (antes bajaba a una línea propia y la fila medía 68 px).
        <div className="flex min-w-0 flex-nowrap items-center gap-x-2">
          <p className="min-w-0 font-semibold leading-snug text-ink">{job.title}</p>
          {job.seniority && (
            <Badge tono="neutro" sinPunto tamano="sm" className="flex-none">
              {job.seniority}
            </Badge>
          )}
          {/* Si la tabla es estrecha, la columna Especialidad se esconde
              (ocultarBajo 'xl') y su dato sube aquí: data-solo-bajo="xl"
              sólo se ve mientras esa columna está escondida. */}
          {job.profile && (
            <span data-solo-bajo="xl" className="inline-flex">
              <Badge tono="info" sinPunto tamano="sm">
                {job.profile}
              </Badge>
            </span>
          )}
        </div>
      ),
    },
    {
      id: 'company',
      encabezado: 'Empresa',
      ordenable: true,
      enTarjeta: 'meta',
      truncarEn: '14rem',
      tituloCelda: (job) => job.company,
      celda: (job) => <span className="font-medium text-ink">{job.company}</span>,
    },
    {
      id: 'location',
      encabezado: 'Ubicación',
      ordenable: true,
      ocultarBajo: 'xl',
      enTarjeta: 'meta',
      truncarEn: '12rem',
      tituloCelda: (job) => job.location,
      celda: (job) => <span className="text-ink-muted">{job.location}</span>,
    },
    {
      id: 'profile',
      encabezado: 'Especialidad',
      ordenable: true,
      ocultarBajo: 'xl',
      enTarjeta: 'meta',
      // «Administración de Oficina» ensanchaba la columna a 190 px: con «…» a
      // partir de 8 rem y el nombre entero en el title.
      truncarEn: '8rem',
      tituloCelda: (job) => job.profile || undefined,
      celda: (job) =>
        job.profile ? (
          <Badge tono="info" sinPunto>
            {job.profile}
          </Badge>
        ) : (
          <span className="text-ink-muted" aria-label="Sin especialidad">
            —
          </span>
        ),
    },
    {
      id: 'applications',
      encabezado: 'Candidatos',
      ordenable: true,
      alinear: 'centro',
      enTarjeta: 'meta',
      unaLinea: true,
      celda: (job) => {
        const total = job._count?.applications || 0;
        return (
          <>
            <button
              type="button"
              onClick={() => router.push(`/admin/assign-candidates?jobId=${job.id}`)}
              className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-teal-tint px-2.5 font-display text-sm font-semibold tabular-nums text-teal-dark transition-colors duration-150 hover:bg-teal hover:text-white"
              title="Ver candidatos asignados"
              aria-label={`Ver candidatos asignados a ${job.title}: ${total}`}
            >
              {total}
            </button>
            {/* En la tabla lo dice la cabecera; en la tarjeta, sin cabecera, la unidad. */}
            <span data-solo-tarjeta aria-hidden="true" className="ml-1.5">
              {total === 1 ? 'candidato' : 'candidatos'}
            </span>
          </>
        );
      },
    },
    {
      id: 'status',
      encabezado: 'Estado',
      ordenable: true,
      enTarjeta: 'meta',
      unaLinea: true,
      celda: (job) => estadoVacante(job.status),
    },
    {
      id: 'createdAt',
      encabezado: 'Fecha',
      ordenable: true,
      ocultarBajo: 'md',
      enTarjeta: 'meta',
      celda: (job) => (
        <div className="text-sm">
          <p className="whitespace-nowrap tabular-nums text-ink">
            <time dateTime={job.createdAt} title={`${fechaLarga(job.createdAt)}, ${hora(job.createdAt)}`}>
              {fechaHora(job.createdAt)}
            </time>
          </p>
          {avisoEdicion(job)}
        </div>
      ),
    },
    {
      // Las dos acciones de la fila juntas: el pipeline (icono con nombre
      // accesible y globo) y el detalle. Una columna menos que antes: así la
      // tabla cabe entera a 1440 px sin desplazarse de lado.
      id: 'acciones',
      encabezado: 'Acciones',
      encabezadoOculto: true,
      alinear: 'fin',
      enTarjeta: 'acciones',
      className: 'w-px whitespace-nowrap',
      celda: (job) => (
        <div className="flex items-center justify-end gap-1">
          <IconButton
            etiqueta={`Ver pipeline de ${job.title}`}
            title="Ver pipeline"
            icono={BarChart3}
            tamano="sm"
            onClick={() => fetchPipeline(job.id)}
          />
          {/* Icono (con el mismo nombre accesible que tenía el botón «Ver»):
              con texto, la columna medía 139 px y la tabla no cabía a 1440. */}
          <IconButton
            etiqueta={`Ver ${job.title}`}
            title="Ver detalle"
            icono={Eye}
            variante="contorno"
            tamano="sm"
            onClick={() => abrirVacante(job)}
          />
        </div>
      ),
    },
  ];

  const filtrosActivos = [selectedStatus, selectedCompany, selectedProfile].filter(Boolean).length;

  if (isLoading) {
    return <SkeletonPagina />;
  }

  return (
    <>
      <PageHeader
        antetitulo="Panel de administración"
        titulo="Vista general"
        remate="de INAKAT"
        descripcion="Vacantes, candidatos y solicitudes de todas las empresas."
        acciones={
          <Button variante="contorno" icono={RefreshCw} onClick={fetchDashboardData}>
            Actualizar
          </Button>
        }
      />

      {error && <AvisoError mensaje={error} />}

      {/* Cifras (contadas en la base por /api/admin/stats) */}
      {/* 2 columnas hasta 1280 px: con la barra lateral, a 1024 px cuatro
          cifras en fila recortaban sus etiquetas. */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:mb-8 xl:grid-cols-4">
        <StatCard
          etiqueta="Vacantes totales"
          valor={cifra(stats.totalJobs)}
          detalle={`${stats.activeJobs} activas, ${stats.draftJobs} borradores`}
          alerta={
            stats.pausedJobs > 0 && (
              <span className="flex items-center gap-1">
                <AlertCircle size={12} aria-hidden="true" />
                {stats.pausedJobs} pausada{stats.pausedJobs !== 1 ? 's' : ''}
              </span>
            )
          }
          icono={Briefcase}
          tono="teal"
        />
        <StatCard
          etiqueta="Candidatos"
          valor={cifra(stats.totalCandidates)}
          detalle="En banco de talentos"
          icono={Users}
          tono="lime"
        />
        <StatCard
          etiqueta="Aplicaciones"
          valor={cifra(stats.totalApplications)}
          detalle="Total recibidas"
          icono={FileText}
          tono="ink"
        />
        <StatCard
          etiqueta="Solicitudes pendientes"
          valor={cifra(stats.pendingRequests)}
          icono={Building2}
          tono="orange"
          enlace={{ href: '/admin/requests', etiqueta: 'Ver solicitudes' }}
        />
      </div>

      {/* Vacantes */}
      <Card
        titulo="Vacantes de todas las empresas"
        descripcion={`${stats.totalCompanies} empresas con vacantes publicadas`}
        sinRelleno
      >
        <div className="border-b border-line px-5 py-4">
          <FilterToolbar
            activos={filtrosActivos}
            alLimpiar={() => {
              setSelectedStatus('');
              setSelectedCompany('');
              setSelectedProfile('');
            }}
            resumen={`${sortedJobs.length} de ${jobs.length} vacantes`}
          >
            <FiltroSelect etiqueta="Estado" value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}>
              <option value="">Todos</option>
              <option value="active">Activas</option>
              <option value="paused">Pausadas</option>
              <option value="draft">Borradores</option>
              <option value="closed">Cerradas</option>
            </FiltroSelect>
            <FiltroSelect etiqueta="Empresa" value={selectedCompany} onChange={(e) => setSelectedCompany(e.target.value)}>
              <option value="">Todas</option>
              {companies.map(company => (
                <option key={company} value={company}>{company}</option>
              ))}
            </FiltroSelect>
            <FiltroSelect etiqueta="Especialidad" value={selectedProfile} onChange={(e) => setSelectedProfile(e.target.value)}>
              <option value="">Todas</option>
              {profiles.map(profile => (
                <option key={profile} value={profile}>{profile}</option>
              ))}
            </FiltroSelect>
          </FilterToolbar>
        </div>

        <DataTable
          etiqueta="Vacantes de todas las empresas"
          columnas={columnas}
          filas={sortedJobs.slice((paginaTabla - 1) * VACANTES_POR_PAGINA, paginaTabla * VACANTES_POR_PAGINA)}
          claveFila={(job) => job.id}
          orden={{ columna: sortField, direccion: sortDirection }}
          alOrdenar={handleSort}
          alActivarFila={abrirVacante}
          // En la tarjeta, «pipeline» y «Ver» caben junto al título (son
          // cortos y la fila entera ya abre el detalle): arriba a la derecha.
          accionesAbajo={false}
          paginacion={paginacionLocal(sortedJobs.length, paginaTabla, VACANTES_POR_PAGINA)}
          alCambiarPagina={setPaginaTabla}
          etiquetaTotal="vacantes"
          vacio={
            <EmptyState
              frase="Nada por aquí, todavía."
              titulo={
                selectedCompany || selectedProfile
                  ? 'No hay vacantes con los filtros seleccionados'
                  : 'No hay vacantes registradas'
              }
              accion={
                filtrosActivos > 0 ? (
                  <Button
                    variante="contorno"
                    tamano="sm"
                    onClick={() => {
                      setSelectedStatus('');
                      setSelectedCompany('');
                      setSelectedProfile('');
                    }}
                  >
                    Limpiar filtros
                  </Button>
                ) : undefined
              }
            />
          }
        />

        {vacantesEnServidor > jobs.length && (
          <p className="border-t border-line bg-paper/60 px-5 py-3 text-center text-[13px] text-ink-muted">
            La tabla carga las {jobs.length} vacantes más recientes de {vacantesEnServidor}.
          </p>
        )}
      </Card>

      {/* Detalle de vacante */}
      <Modal
        abierto={isModalOpen && selectedJob !== null}
        alCerrar={cerrarVacante}
        tamano="lg"
        titulo={selectedJob?.title}
        subtitulo={
          selectedJob && (
            <span className="flex items-center gap-1.5">
              <Building2 size={14} aria-hidden="true" />
              {selectedJob.company}
            </span>
          )
        }
        pie={
          selectedJob && (
            <>
              <Button variante="contorno" onClick={cerrarVacante}>
                Cerrar
              </Button>
              <ButtonLink href={`/admin/assign-candidates?jobId=${selectedJob.id}`} icono={Users}>
                Ver/Asignar candidatos
              </ButtonLink>
            </>
          )
        }
      >
        {selectedJob && (
          <>
            {/* Datos básicos */}
            <dl className="mb-6 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 md:grid-cols-3">
              {[
                { icono: MapPin, termino: 'Ubicación', valor: selectedJob.location },
                { icono: Banknote, termino: 'Salario', valor: selectedJob.salary },
                { icono: Clock, termino: 'Jornada', valor: selectedJob.jobType },
                {
                  icono: Monitor,
                  termino: 'Modalidad',
                  valor: selectedJob.workMode
                    ? selectedJob.workMode === 'remote'
                      ? 'Remoto'
                      : selectedJob.workMode === 'hybrid'
                        ? 'Híbrido'
                        : 'Presencial'
                    : undefined,
                },
                { icono: Briefcase, termino: 'Especialidad', valor: selectedJob.profile },
                { icono: GraduationCap, termino: 'Nivel', valor: selectedJob.seniority },
              ]
                .filter((d) => d.valor)
                .map(({ icono: Icono, termino, valor }) => (
                  <div key={termino} className="flex items-start gap-2.5">
                    <Icono size={16} className="mt-0.5 flex-none text-ink-muted" aria-hidden="true" />
                    <div className="min-w-0">
                      <dt className="text-xs text-ink-muted">{termino}</dt>
                      <dd className="text-sm font-medium text-ink">{valor}</dd>
                    </div>
                  </div>
                ))}
            </dl>

            {/* Estado */}
            <div className="mb-6 flex flex-wrap gap-2">
              {estadoVacante(selectedJob.status)}
              <Badge tono="info" icono={Users}>
                {selectedJob._count?.applications || 0} candidatos
              </Badge>
              <Badge tono="neutro" icono={Calendar}>
                {fechaLarga(selectedJob.createdAt)}, {hora(selectedJob.createdAt)}
              </Badge>
              {selectedJob.editableUntil &&
                (new Date(selectedJob.editableUntil) > new Date() ? (
                  <Badge tono="aviso" icono={Clock}>
                    Editable hasta {hora(selectedJob.editableUntil)}
                  </Badge>
                ) : (
                  <Badge tono="exito" icono={CheckCircle}>
                    Listo para procesar
                  </Badge>
                ))}
            </div>

            {/* Textos de la vacante */}
            <div className="space-y-5">
              {[
                { titulo: 'Descripción', texto: selectedJob.description },
                { titulo: 'Requisitos', texto: selectedJob.requirements },
                { titulo: 'Responsabilidades', texto: selectedJob.responsabilidades },
                { titulo: 'Habilidades', texto: selectedJob.habilidades },
                { titulo: 'Resultados Esperados', texto: selectedJob.resultadosEsperados },
                { titulo: 'Valores y Actitudes', texto: selectedJob.valoresActitudes },
                { titulo: 'Información Adicional', texto: selectedJob.informacionAdicional },
              ]
                .filter((s) => s.texto)
                .map((s) => (
                  <section key={s.titulo} className="[overflow:visible]">
                    <h3 className="mb-1.5 font-display text-sm font-semibold text-ink">{s.titulo}</h3>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{s.texto}</p>
                  </section>
                ))}
            </div>
          </>
        )}
      </Modal>

      {/* Pipeline de una vacante */}
      <Modal
        abierto={pipelineJobId !== null}
        alCerrar={cerrarPipeline}
        tamano="lg"
        iconoTitulo={<BarChart3 size={20} className="text-teal" aria-hidden="true" />}
        titulo="Pipeline de candidatos"
        subtitulo={
          pipelineData?.job && (
            <>
              <span className="font-medium text-ink">{pipelineData.job.title}</span>
              <span className="mx-1.5" aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1">
                <Building2 size={12} aria-hidden="true" />
                {pipelineData.job.company}
              </span>
            </>
          )
        }
        pie={
          <>
            <Button variante="contorno" onClick={cerrarPipeline}>
              Cerrar
            </Button>
            {pipelineData?.job && (
              <ButtonLink href={`/admin/assign-candidates?jobId=${pipelineData.job.id}`} icono={Users}>
                Ver/Asignar candidatos
              </ButtonLink>
            )}
          </>
        }
      >
        {loadingPipeline ? (
          <div className="flex items-center justify-center py-12" role="status">
            <Loader2 className="h-8 w-8 animate-spin text-teal" aria-hidden="true" />
            <span className="sr-only">Cargando pipeline…</span>
          </div>
        ) : pipelineData ? (
          <div className="space-y-5">
            {/* Totales por etapa */}
            <dl className="grid grid-cols-3 gap-2 sm:gap-3">
              {[
                { termino: 'Reclutador', valor: pipelineData.stageTotals.recruiter, clase: 'bg-teal-tint text-teal-dark' },
                { termino: 'Especialista', valor: pipelineData.stageTotals.specialist, clase: 'bg-orange-tint text-orange-dark' },
                { termino: 'Empresa', valor: pipelineData.stageTotals.company, clase: 'bg-lime-tint text-lime-dark' },
              ].map((etapa) => (
                <div key={etapa.termino} className={cn('flex flex-col-reverse rounded-xl px-3 py-3 text-center sm:px-4', etapa.clase)}>
                  <dt className="font-display text-[11px] font-semibold uppercase tracking-[0.12em]">{etapa.termino}</dt>
                  <dd className="mb-1 font-display text-2xl font-semibold tabular-nums">{etapa.valor}</dd>
                </div>
              ))}
            </dl>

            <p className="text-center text-sm text-ink-muted">
              {pipelineData.total} candidato{pipelineData.total !== 1 ? 's' : ''} en total
            </p>

            {/* ADM-090: las archivadas (desde Postulaciones Directas) entraban
                en el total pero en ninguna etapa: el modal decía 10 y las
                columnas sumaban 7, sin forma de verlas. */}
            {(pipelineData.archived ?? 0) > 0 && (
              <button
                type="button"
                onClick={() => setFilterStatus(filterStatus === 'archived' ? null : 'archived')}
                aria-pressed={filterStatus === 'archived'}
                className={cn(
                  'flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors duration-150',
                  filterStatus === 'archived' ? 'border-ink bg-mist text-ink' : 'border-line text-ink hover:bg-paper'
                )}
              >
                <span>Archivados</span>
                <span className="font-display font-semibold tabular-nums">{pipelineData.archived}</span>
              </button>
            )}

            {/* Etapas plegables */}
            {[
              {
                id: 'recruiter',
                titulo: 'Reclutador',
                icono: FileText,
                tono: 'teal' as const,
                items: [
                  { key: 'pending', label: 'Por revisar', count: pipelineData.stages.recruiter.pending },
                  { key: 'reviewing', label: 'En revisión', count: pipelineData.stages.recruiter.reviewing },
                  { key: 'sent_to_specialist', label: 'Enviados a especialista', count: pipelineData.stages.recruiter.sent_to_specialist },
                  { key: 'discarded', label: 'Descartados', count: pipelineData.stages.recruiter.discarded }
                ]
              },
              {
                id: 'specialist',
                titulo: 'Especialista',
                icono: GraduationCap,
                tono: 'orange' as const,
                items: [
                  { key: 'evaluating', label: 'Evaluando', count: pipelineData.stages.specialist.evaluating },
                  { key: 'sent_to_company', label: 'Enviados a empresa', count: pipelineData.stages.specialist.sent_to_company }
                ]
              },
              {
                id: 'company',
                titulo: 'Empresa',
                icono: Building2,
                tono: 'lime' as const,
                items: [
                  { key: 'company_interested', label: 'Le interesan', count: pipelineData.stages.company.interested },
                  { key: 'interviewed', label: 'Entrevistados', count: pipelineData.stages.company.interviewed },
                  { key: 'rejected', label: 'Rechazados', count: pipelineData.stages.company.rejected },
                  { key: 'accepted', label: 'Contratados', count: pipelineData.stages.company.accepted }
                ]
              }
            ].map((etapa) => {
              const abierta = expandedStage === etapa.id;
              const Icono = etapa.icono;
              const colores = {
                teal: { cabecera: 'bg-teal-tint text-teal-dark', activo: 'bg-teal-tint text-teal-dark', cifra: 'text-teal-dark' },
                orange: { cabecera: 'bg-orange-tint text-orange-dark', activo: 'bg-orange-tint text-orange-dark', cifra: 'text-orange-dark' },
                lime: { cabecera: 'bg-lime-tint text-lime-dark', activo: 'bg-lime-tint text-lime-dark', cifra: 'text-lime-dark' },
              }[etapa.tono];
              return (
                <div key={etapa.id} className="overflow-hidden rounded-xl border border-line">
                  <button
                    type="button"
                    onClick={() => { setExpandedStage(abierta ? null : etapa.id); setFilterStatus(null); }}
                    aria-expanded={abierta}
                    aria-controls={`etapa-${etapa.id}`}
                    className={cn('flex w-full items-center justify-between px-4 py-3 text-sm transition-colors duration-150 hover:brightness-[0.98]', colores.cabecera)}
                  >
                    <span className="flex items-center gap-2 font-display font-semibold">
                      <Icono size={16} aria-hidden="true" />
                      {etapa.titulo}
                    </span>
                    <ChevronRight size={16} className={cn('transition-transform duration-150', abierta && 'rotate-90')} aria-hidden="true" />
                  </button>
                  {abierta && (
                    <div id={`etapa-${etapa.id}`} className="space-y-0.5 p-2">
                      {etapa.items.map(item => (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => setFilterStatus(filterStatus === item.key ? null : item.key)}
                          aria-pressed={filterStatus === item.key}
                          className={cn(
                            'flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors duration-150',
                            filterStatus === item.key ? colores.activo : 'text-ink hover:bg-paper'
                          )}
                        >
                          <span>{item.label}</span>
                          <span className={cn('font-display font-semibold tabular-nums', item.count > 0 ? colores.cifra : 'text-ink-muted')}>
                            {item.count}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Candidatos de la etapa elegida */}
            {filterStatus && (
              <div className="overflow-hidden rounded-xl border border-line">
                <div className="flex items-center justify-between border-b border-line bg-paper px-4 py-2.5">
                  <h3 className="font-display text-sm font-semibold text-ink">
                    {getStatusLabel(filterStatus)}{' '}
                    <span className="tabular-nums text-ink-muted">({getFilteredApplications(filterStatus).length})</span>
                  </h3>
                  <IconButton etiqueta="Quitar filtro" icono={X} tamano="sm" onClick={() => setFilterStatus(null)} />
                </div>
                <ul className="max-h-60 divide-y divide-line overflow-y-auto">
                  {getFilteredApplications(filterStatus).length === 0 ? (
                    <li className="p-4 text-center text-sm text-ink-muted">No hay candidatos en esta etapa</li>
                  ) : (
                    getFilteredApplications(filterStatus).map((app) => (
                      <li key={app.id} className="flex items-center justify-between gap-3 px-4 py-3 transition-colors duration-150 hover:bg-paper">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-ink">{app.candidateName}</p>
                          <p className="truncate text-xs text-ink-muted">{app.candidateEmail}</p>
                        </div>
                        <div className="flex flex-none items-center gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPipelineCandidate(app);
                              setIsPipelineCandidateModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1 rounded text-sm font-medium text-teal hover:text-teal-dark hover:underline"
                          >
                            Ver ficha
                            <span className="sr-only"> de {app.candidateName}</span>
                            <ArrowRight size={14} aria-hidden="true" />
                          </button>
                          <p className="whitespace-nowrap text-xs tabular-nums text-ink-muted">
                            {fechaCorta(app.updatedAt)}
                          </p>
                        </div>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <p role="alert" className="py-8 text-center text-sm text-ink-muted">Error al cargar pipeline</p>
        )}
      </Modal>

      {/* Ficha de candidato desde el pipeline. Es un Modal del sistema: se
          lleva a sí mismo al final de <body> al abrirse, así queda encima del
          pipeline y sólo ella atiende Escape. */}
      {isPipelineCandidateModalOpen && selectedPipelineCandidate && (
        <CandidateProfileModal
          isOpen={isPipelineCandidateModalOpen}
          onClose={() => setIsPipelineCandidateModalOpen(false)}
          // Conversiones explícitas: la ficha tipa `candidate` como candidato
          // del banco completo y el pipeline trae su perfil parcial (se pasa
          // igual que siempre; antes lo ocultaba un `any`).
          application={selectedPipelineCandidate as unknown as PropsFicha['application']}
          candidate={selectedPipelineCandidate.candidateProfile as PropsFicha['candidate']}
          recruiterNotes={pipelineData?.jobAssignment?.recruiterNotes || undefined}
          showRecruiterNotes={!!pipelineData?.jobAssignment?.recruiterNotes}
          userRole="admin"
          jobHabilidades={pipelineData?.job?.habilidades}
        />
      )}
    </>
  );
}
