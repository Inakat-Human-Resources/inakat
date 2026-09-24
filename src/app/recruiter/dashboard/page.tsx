// RUTA: src/app/recruiter/dashboard/page.tsx

'use client';

/**
 * Panel del reclutador: sus vacantes asignadas (con los candidatos por revisar
 * y sin ver) y el seguimiento de los que ya envió al especialista.
 *
 * Registro de aplicación (docs/DISENO.md): PageHeader → cifras → pestañas →
 * Card con DataTable. La lógica es la de siempre (una llamada a
 * /api/recruiter/dashboard, la misma transformación a JobSummary, los vistos
 * en localStorage y el modal de perfil); sólo cambió la presentación.
 */

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Briefcase,
  ChevronRight,
  AlertCircle,
  AlertTriangle,
  Building2,
  MapPin,
  Send,
  Inbox,
  EyeOff,
  RefreshCw,
  UserCheck
} from 'lucide-react';
import DistanceBadge from '@/components/shared/DistanceBadge';
import CandidateProfileModal from '@/components/shared/CandidateProfileModal';
import { getDistanceInfo } from '@/lib/distance';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import Card from '@/components/ui/Card';
import DataTable, { type Columna } from '@/components/ui/DataTable';
import StatusBadge, { Badge } from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import Button from '@/components/ui/Button';
import Tabs, { PanelPestana } from '@/components/ui/Tabs';
import { SkeletonPagina } from '@/components/ui/Skeleton';
import { paginacionLocal } from '@/components/ui/Pagination';
import { cn } from '@/lib/utils';
import { fechaCorta } from '@/lib/fechas';

// Key para localStorage de candidatos vistos
const VIEWED_CANDIDATES_KEY = 'inakat_viewed_candidates_recruiter';

/** Filas por página de las dos tablas (se paginan en el cliente). */
const FILAS_POR_PAGINA = 20;

/**
 * Texto de una celda secundaria (empresa, ubicación, especialista): en la
 * tabla va en un solo renglón con «…» (con el tope de ancho de su contenedor
 * y el texto entero en el title); en la vista de tarjetas (tabla < 600 px, la
 * misma container query de app.css) vuelve a partir en renglones, porque en
 * el móvil no hay puntero para ver el title. El texto completo está siempre
 * en el DOM: el lector de pantalla lo lee entero.
 */
const RECORTE =
  'truncate [@container_ap-tabla_(max-width:599.98px)]:overflow-visible [@container_ap-tabla_(max-width:599.98px)]:whitespace-normal';

/**
 * Los topes de ancho de esas celdas (max-w-[9rem]…) son de la TABLA: en la
 * línea meta de la tarjeta partían «Monterr/ey, NL».
 */
const SIN_TOPE_EN_TARJETA = '[@container_ap-tabla_(max-width:599.98px)]:max-w-none';

/**
 * Cómo llama esta pantalla a cada estado de un candidato enviado (su
 * vocabulario de siempre; el tono sale del mapa de StatusBadge).
 */
const ETIQUETAS_ENVIADO: Record<string, string> = {
  sent_to_specialist: 'Enviado a especialista',
  evaluating: 'En evaluación',
  sent_to_company: 'Enviado a empresa',
  company_interested: 'Le interesa a la empresa',
  interviewed: 'Entrevistado',
  accepted: 'Contratado',
  rejected: 'Rechazado'
};

interface Application {
  id: number;
  status: string;
}

interface Assignment {
  id: number;
  jobId: number;
  job: {
    id: number;
    title: string;
    company: string;
    location: string;
    workMode: string;
    profile: string;
    applications: Application[];
    user: {
      nombre: string;
      companyRequest?: {
        nombreEmpresa: string;
      };
    };
  };
  specialist?: {
    id: number;
    nombre: string;
    apellidoPaterno: string;
  };
}

interface JobSummary {
  id: number;
  jobId: number;
  title: string;
  company: string;
  location: string;
  workMode: string;
  profile: string;
  totalCandidates: number;
  pendingCandidates: number;
  unseenCandidates: number;
  hasSpecialist: boolean;
  specialistName: string | null;
}

interface SentApplication {
  id: number;
  candidateName: string;
  candidateEmail: string;
  candidatePhone?: string | null;
  cvUrl?: string | null;
  coverLetter?: string | null;
  status: string;
  jobId: number;
  jobTitle: string;
  company: string;
  createdAt?: string;
  updatedAt: string;
  candidateProfile?: any;
  jobLatitude?: number | null;
  jobLongitude?: number | null;
}

interface Stats {
  totalSent: number;
  sentToSpecialist: number;
  evaluating: number;
  sentToCompany: number;
  companyInterested: number;
  interviewed: number;
  hired: number;
  rejected: number;
}

export default function RecruiterDashboard() {
  const router = useRouter();
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [sentApplications, setSentApplications] = useState<SentApplication[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [activeTab, setActiveTab] = useState<'vacantes' | 'enviados'>('vacantes');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal de perfil de candidato
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState<any>(null);

  // Página de cada tabla (presentación: las listas ya llegan enteras).
  const [paginaVacantes, setPaginaVacantes] = useState(1);
  const [paginaEnviados, setPaginaEnviados] = useState(1);

  const openCandidateProfile = (app: SentApplication) => {
    setSelectedApplication({
      id: app.id,
      candidateName: app.candidateName,
      candidateEmail: app.candidateEmail,
      // El CV, el teléfono y la carta que el candidato subió AL POSTULARSE:
      // sin ellos el modal no mostraba "Ver CV" para quien aplicó con CV
      // propio pero no lo tiene en su perfil del banco.
      candidatePhone: app.candidatePhone ?? null,
      cvUrl: app.cvUrl ?? null,
      coverLetter: app.coverLetter ?? null,
      createdAt: app.createdAt,
      status: app.status,
      candidateProfile: app.candidateProfile || null,
    });
    setProfileModalOpen(true);
  };

  const closeCandidateProfile = () => {
    setProfileModalOpen(false);
    setSelectedApplication(null);
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/recruiter/dashboard');

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
        // Transformar assignments a JobSummary
        const viewedIds = getViewedCandidates();
        const jobSummaries: JobSummary[] = data.data.assignments.map((a: Assignment) => {
          const applications = a.job.applications || [];
          const pendingApps = applications.filter(
            (app: Application) => app.status === 'pending' || app.status === 'injected_by_admin'
          );
          const unseenApps = applications.filter(
            (app: Application) => !viewedIds.includes(app.id)
          );

          return {
            id: a.id,
            jobId: a.jobId,
            title: a.job.title,
            company: a.job.user?.companyRequest?.nombreEmpresa || a.job.company,
            location: a.job.location,
            workMode: a.job.workMode,
            profile: a.job.profile,
            totalCandidates: applications.length,
            pendingCandidates: pendingApps.length,
            unseenCandidates: unseenApps.length,
            hasSpecialist: !!a.specialist,
            specialistName: a.specialist
              ? `${a.specialist.nombre} ${a.specialist.apellidoPaterno}`
              : null
          };
        });

        setJobs(jobSummaries);
        setSentApplications(data.data.sentApplications || []);
        setStats(data.data.stats || null);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Error de conexión');
    } finally {
      setIsLoading(false);
    }
  };

  const getViewedCandidates = (): number[] => {
    if (typeof window === 'undefined') return [];
    try {
      return JSON.parse(localStorage.getItem(VIEWED_CANDIDATES_KEY) || '[]');
    } catch {
      return [];
    }
  };

  const getWorkModeLabel = (mode: string) => {
    const labels: Record<string, string> = {
      remote: 'Remoto',
      hybrid: 'Híbrido',
      presential: 'Presencial'
    };
    return labels[mode] || mode;
  };

  const cabecera = (acciones?: React.ReactNode) => (
    <PageHeader
      antetitulo="Reclutamiento"
      titulo="Tus vacantes"
      remate="y quién va avanzando"
      descripcion="Revisa a los candidatos de cada vacante y sigue a los que ya enviaste al especialista."
      acciones={acciones}
    />
  );

  if (isLoading) {
    return <SkeletonPagina />;
  }

  if (error) {
    // Sin datos que enseñar: el aviso ocupa el lugar de la página (como antes),
    // con la cabecera para no perder dónde se está.
    return (
      <>
        {cabecera()}
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-xl border border-danger/30 bg-danger-tint px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="flex items-center gap-2 text-sm font-medium text-danger-dark">
            <AlertCircle size={18} className="flex-none" aria-hidden="true" />
            {error}
          </p>
          <Button variante="contorno" tamano="sm" icono={RefreshCw} onClick={fetchDashboard} className="self-start sm:self-auto">
            Reintentar
          </Button>
        </div>
      </>
    );
  }

  // Fecha corta del panel (src/lib/fechas): «23 sep 2026».
  const formatDate = (dateString: string) => fechaCorta(dateString);

  // Cifras de la cabecera: salen de las mismas listas que pintan las tablas.
  const porRevisar = jobs.reduce((suma, j) => suma + j.pendingCandidates, 0);
  const sinVer = jobs.reduce((suma, j) => suma + j.unseenCandidates, 0);
  const sinEspecialista = jobs.filter((j) => !j.hasSpecialist).length;
  const totalEnviados = stats?.totalSent ?? 0;

  // Un número que no es cero se destaca con su tono; el cero va apagado.
  const cifraCelda = (n: number, tono: 'aviso' | 'info') =>
    n > 0 ? (
      <Badge tono={tono} sinPunto className="font-display font-semibold tabular-nums">
        {n}
      </Badge>
    ) : (
      <span className="tabular-nums text-ink-muted">0</span>
    );

  // ---------------------------------------------------------------------------
  // Vacantes asignadas
  // ---------------------------------------------------------------------------
  const columnasVacantes: Columna<JobSummary>[] = [
    {
      id: 'title',
      encabezado: 'Vacante',
      enTarjeta: 'titulo',
      className: 'min-w-[14rem]',
      celda: (job) => (
        // max-w: un título largo ya no se come la tabla (parte en dos renglones
        // y deja sitio a empresa, ubicación y especialista en uno). La
        // especialidad va EN LÍNEA con el título (debajo, la fila medía 71 px).
        <div className="min-w-0 max-w-[22rem]">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <p className="min-w-0 font-semibold text-ink">{job.title}</p>
            {job.profile && (
              <Badge tono="info" sinPunto tamano="sm" className="flex-none">
                {job.profile}
              </Badge>
            )}
            {/* «Sin especialista» lo dice su columna; sube aquí sólo cuando se
                esconde (tabla estrecha). En la tarjeta sale en la línea meta. */}
            {!job.hasSpecialist && (
              <span data-solo-bajo="xl" className="inline-flex flex-none">
                <Badge tono="aviso" icono={AlertTriangle} tamano="sm">
                  Sin especialista
                </Badge>
              </span>
            )}
          </div>
          {/* La empresa sube aquí cuando su columna se esconde (tabla estrecha). */}
          <p data-solo-bajo="md" className="mt-0.5 text-[13px] text-ink-muted">
            {job.company}
          </p>
        </div>
      ),
    },
    // Móvil: la tarjeta es la vacante + UNA línea «empresa · ciudad ·
    // modalidad · especialista» y otra con las cifras con su nombre
    // («14 candidatos · 4 por revisar · 14 sin ver»): ~150 px en vez de ~270.
    {
      id: 'company',
      encabezado: 'Empresa',
      ocultarBajo: 'md',
      enTarjeta: 'meta',
      // Topes de ancho de las tres columnas de texto: con las ocho columnas a
      // la vista la tabla cabe desde 1100 px aunque los nombres sean largos.
      celda: (job) => (
        <span className={cn('flex max-w-[10rem] items-center gap-1.5 font-medium text-ink', SIN_TOPE_EN_TARJETA)}>
          <Building2 size={14} className="flex-none text-ink-muted" aria-hidden="true" />
          <span className={RECORTE} title={job.company}>
            {job.company}
          </span>
        </span>
      ),
    },
    {
      id: 'location',
      encabezado: 'Ubicación',
      ocultarBajo: 'lg',
      enTarjeta: 'meta',
      celda: (job) => (
        <div className={cn('max-w-[9rem] text-[13px]', SIN_TOPE_EN_TARJETA)}>
          <p className="flex items-center gap-1.5 text-ink">
            <MapPin size={14} className="flex-none text-ink-muted" aria-hidden="true" />
            <span className={RECORTE} title={job.location}>
              {job.location}
            </span>
            {/* En la línea meta de la tarjeta, la modalidad va seguida. */}
            <span data-solo-tarjeta className="whitespace-nowrap text-ink-muted">
              · {getWorkModeLabel(job.workMode)}
            </span>
          </p>
          <p data-solo-tabla className="mt-0.5 whitespace-nowrap text-ink-muted">
            {getWorkModeLabel(job.workMode)}
          </p>
        </div>
      ),
    },
    {
      id: 'specialist',
      encabezado: 'Especialista',
      ocultarBajo: 'xl',
      enTarjeta: 'meta',
      celda: (job) =>
        job.hasSpecialist ? (
          <span className={cn('flex max-w-[9rem] items-center gap-1.5 text-[13px] text-ink', SIN_TOPE_EN_TARJETA)}>
            <UserCheck size={14} className="flex-none text-teal" aria-hidden="true" />
            <span className={RECORTE} title={job.specialistName ?? undefined}>
              {job.specialistName}
            </span>
          </span>
        ) : (
          // Antes, un «Sin especialista» naranja bajo el título; ahora, aquí.
          <Badge tono="aviso" icono={AlertTriangle} tamano="sm">
            Sin especialista
          </Badge>
        ),
    },
    {
      id: 'total',
      encabezado: 'Candidatos',
      numerica: true,
      enTarjeta: 'meta',
      celda: (job) => (
        <span className="whitespace-nowrap">
          <span className="font-display font-semibold">{job.totalCandidates}</span>
          {/* En la tabla lo dice la cabecera; en la tarjeta, sin cabecera, la unidad. */}
          <span data-solo-tarjeta className="text-ink-muted">
            {' '}
            {job.totalCandidates === 1 ? 'candidato' : 'candidatos'}
          </span>
        </span>
      ),
    },
    {
      id: 'pending',
      encabezado: 'Por revisar',
      alinear: 'centro',
      enTarjeta: 'meta',
      celda: (job) => (
        <span className="whitespace-nowrap">
          {cifraCelda(job.pendingCandidates, 'aviso')}
          <span data-solo-tarjeta className="text-ink-muted">
            {' '}
            por revisar
          </span>
        </span>
      ),
    },
    {
      id: 'unseen',
      encabezado: 'Sin ver',
      alinear: 'centro',
      enTarjeta: 'meta',
      celda: (job) => (
        <span className="whitespace-nowrap">
          {cifraCelda(job.unseenCandidates, 'info')}
          <span data-solo-tarjeta className="text-ink-muted">
            {' '}
            sin ver
          </span>
        </span>
      ),
    },
    {
      id: 'abrir',
      encabezado: 'Abrir',
      encabezadoOculto: true,
      alinear: 'fin',
      enTarjeta: 'acciones',
      className: 'w-px',
      celda: () => (
        <ChevronRight
          size={18}
          className="text-ink-muted transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-ink"
          aria-hidden="true"
        />
      ),
    },
  ];

  // ---------------------------------------------------------------------------
  // Candidatos enviados (sólo lectura)
  // ---------------------------------------------------------------------------
  const columnasEnviados: Columna<SentApplication>[] = [
    {
      id: 'candidate',
      encabezado: 'Candidato',
      enTarjeta: 'titulo',
      className: 'min-w-[13rem]',
      celda: (app) => (
        <div className="min-w-0">
          <p className="font-semibold text-ink">{app.candidateName}</p>
          <p className="truncate text-[13px] text-ink-muted">{app.candidateEmail}</p>
          <p data-solo-bajo="md" className="mt-1 text-[13px] text-ink-muted">
            {app.jobTitle} · {app.company}
          </p>
        </div>
      ),
    },
    {
      id: 'job',
      encabezado: 'Vacante',
      ocultarBajo: 'md',
      celda: (app) => (
        <div className="min-w-0 text-[13px]">
          <p className="inline-flex items-center gap-1.5 font-medium text-ink">
            <Briefcase size={14} className="flex-none text-ink-muted" aria-hidden="true" />
            {app.jobTitle}
          </p>
          <p className="mt-0.5 inline-flex items-center gap-1.5 text-ink-muted">
            <Building2 size={14} className="flex-none" aria-hidden="true" />
            {app.company}
          </p>
        </div>
      ),
    },
    {
      id: 'status',
      encabezado: 'Estado',
      celda: (app) => <StatusBadge estado={app.status} etiqueta={ETIQUETAS_ENVIADO[app.status]} />,
    },
    {
      id: 'distance',
      encabezado: 'Distancia',
      ocultarBajo: 'lg',
      celda: (app) =>
        getDistanceInfo(app.candidateProfile?.latitude, app.candidateProfile?.longitude, app.jobLatitude, app.jobLongitude) ? (
          <DistanceBadge
            candidateLat={app.candidateProfile?.latitude}
            candidateLng={app.candidateProfile?.longitude}
            jobLat={app.jobLatitude}
            jobLng={app.jobLongitude}
            compact
          />
        ) : (
          <span className="text-ink-muted" aria-label="Sin ubicación">
            —
          </span>
        ),
    },
    {
      id: 'updatedAt',
      encabezado: 'Actualizado',
      ocultarBajo: 'lg',
      className: 'whitespace-nowrap',
      celda: (app) => <span className="tabular-nums text-ink-muted">{formatDate(app.updatedAt)}</span>,
    },
    {
      id: 'abrir',
      encabezado: 'Ver perfil',
      encabezadoOculto: true,
      alinear: 'fin',
      enTarjeta: 'acciones',
      className: 'w-px',
      celda: () => (
        <ChevronRight
          size={18}
          className="text-ink-muted transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-ink"
          aria-hidden="true"
        />
      ),
    },
  ];

  // Dónde están los enviados (las cifras que ya calculaba la API).
  const embudo = stats
    ? [
        { etiqueta: 'En especialista', valor: stats.sentToSpecialist, punto: 'bg-teal' },
        { etiqueta: 'En evaluación', valor: stats.evaluating, punto: 'bg-teal' },
        { etiqueta: 'En empresa', valor: stats.sentToCompany, punto: 'bg-teal' },
        { etiqueta: 'Le interesan', valor: stats.companyInterested, punto: 'bg-orange' },
        { etiqueta: 'Entrevistados', valor: stats.interviewed, punto: 'bg-teal' },
        { etiqueta: 'Contratados', valor: stats.hired, punto: 'bg-lime' },
        { etiqueta: 'Rechazados', valor: stats.rejected, punto: 'bg-danger' }
      ]
    : [];

  const paginaV = Math.min(paginaVacantes, Math.max(1, Math.ceil(jobs.length / FILAS_POR_PAGINA)));
  const paginaE = Math.min(paginaEnviados, Math.max(1, Math.ceil(sentApplications.length / FILAS_POR_PAGINA)));

  return (
    <>
      {cabecera(
        <Button variante="contorno" icono={RefreshCw} onClick={fetchDashboard}>
          Actualizar
        </Button>
      )}

      {/* Cifras (salen de las mismas listas que las tablas) */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:mb-8 xl:grid-cols-4">
        <StatCard
          etiqueta="Vacantes asignadas"
          valor={jobs.length}
          icono={Briefcase}
          tono="teal"
          alerta={
            sinEspecialista > 0 && (
              <span className="flex items-center gap-1">
                <AlertTriangle size={12} aria-hidden="true" />
                {sinEspecialista} sin especialista
              </span>
            )
          }
        />
        <StatCard
          etiqueta="Por revisar"
          valor={porRevisar}
          detalle="Candidatos esperando tu revisión"
          icono={Inbox}
          tono="orange"
        />
        <StatCard
          etiqueta="Sin ver"
          valor={sinVer}
          detalle="Aún no abres su perfil"
          icono={EyeOff}
          tono="ink"
        />
        <StatCard
          etiqueta="En seguimiento"
          valor={totalEnviados}
          detalle="Enviados al especialista o más adelante"
          icono={Send}
          tono="lime"
        />
      </div>

      <Tabs
        idBase="panel-reclutador"
        etiqueta="Secciones del panel"
        activa={activeTab}
        alCambiar={(id) => setActiveTab(id as 'vacantes' | 'enviados')}
        pestanas={[
          { id: 'vacantes', etiqueta: 'Vacantes', contador: jobs.length },
          { id: 'enviados', etiqueta: 'Enviados', contador: totalEnviados }
        ]}
        className="mb-5"
      />

      {/* Tab: Vacantes */}
      <PanelPestana idBase="panel-reclutador" id="vacantes" activa={activeTab} className="pt-0">
        <Card
          titulo="Vacantes asignadas"
          descripcion="Abre una vacante para revisar a sus candidatos y moverlos de etapa."
          sinRelleno
        >
          <DataTable
            etiqueta="Vacantes asignadas"
            columnas={columnasVacantes}
            filas={jobs.slice((paginaV - 1) * FILAS_POR_PAGINA, paginaV * FILAS_POR_PAGINA)}
            claveFila={(job) => job.id}
            alActivarFila={(job) => router.push(`/recruiter/jobs/${job.jobId}`)}
            paginacion={paginacionLocal(jobs.length, paginaV, FILAS_POR_PAGINA)}
            alCambiarPagina={setPaginaVacantes}
            etiquetaTotal="vacantes"
            vacio={
              <EmptyState
                frase="Todavía nada por aquí."
                titulo="No tienes vacantes asignadas"
                descripcion="Cuando el equipo de INAKAT te asigne una vacante, aparecerá aquí con sus candidatos."
              />
            }
          />
        </Card>
      </PanelPestana>

      {/* Tab: Enviados */}
      <PanelPestana idBase="panel-reclutador" id="enviados" activa={activeTab} className="pt-0">
        {stats && stats.totalSent > 0 && (
          <Card titulo="Dónde están tus candidatos" className="mb-5" claseCuerpo="px-5 py-4">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4 xl:grid-cols-7">
              {embudo.map((etapa) => (
                <div key={etapa.etiqueta} className="flex min-w-0 flex-col-reverse gap-1">
                  <dt className="flex items-center gap-1.5 text-xs text-ink-muted">
                    <span className={cn('h-1.5 w-1.5 flex-none rounded-full', etapa.punto)} aria-hidden="true" />
                    {etapa.etiqueta}
                  </dt>
                  <dd
                    className={cn(
                      'font-display text-2xl font-semibold leading-none tabular-nums',
                      etapa.valor > 0 ? 'text-ink' : 'text-ink-muted'
                    )}
                  >
                    {etapa.valor}
                  </dd>
                </div>
              ))}
            </dl>
          </Card>
        )}

        {/* Lista de candidatos enviados */}
        <Card
          titulo="Candidatos enviados"
          descripcion="Sólo lectura: el estado lo actualizan el especialista y la empresa."
          sinRelleno
        >
          <DataTable
            etiqueta="Candidatos enviados"
            columnas={columnasEnviados}
            filas={sentApplications.slice((paginaE - 1) * FILAS_POR_PAGINA, paginaE * FILAS_POR_PAGINA)}
            claveFila={(app) => app.id}
            alActivarFila={openCandidateProfile}
            paginacion={paginacionLocal(sentApplications.length, paginaE, FILAS_POR_PAGINA)}
            alCambiarPagina={setPaginaEnviados}
            etiquetaTotal="candidatos"
            vacio={
              <EmptyState
                frase="Aún no envías a nadie."
                titulo="No has enviado candidatos al especialista"
                descripcion="Los candidatos que envíes aparecerán aquí para que sigas su avance."
              />
            }
          />
        </Card>
      </PanelPestana>

      {/* Modal de perfil de candidato */}
      <CandidateProfileModal
        application={selectedApplication}
        candidate={null}
        isOpen={profileModalOpen}
        onClose={closeCandidateProfile}
        showRecruiterNotes={false}
        userRole="recruiter"
      />
    </>
  );
}
