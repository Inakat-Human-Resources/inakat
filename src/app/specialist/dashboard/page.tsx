// RUTA: src/app/specialist/dashboard/page.tsx

'use client';

/**
 * Panel del especialista: las vacantes cuyos candidatos ya le envió el
 * reclutador, con cuántos esperan evaluación y cuántos no ha visto.
 *
 * Registro de aplicación (docs/DISENO.md): PageHeader → cifras → Card con
 * DataTable. La lógica es la de siempre (una llamada a
 * /api/specialist/dashboard, la misma transformación a JobSummary y los
 * vistos en localStorage); sólo cambió la presentación.
 */

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Briefcase,
  Users,
  ChevronRight,
  AlertCircle,
  Building2,
  MapPin,
  Star,
  Inbox,
  EyeOff,
  RefreshCw,
  FileText
} from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import Card from '@/components/ui/Card';
import DataTable, { type Columna } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import Button from '@/components/ui/Button';
import { SkeletonPagina } from '@/components/ui/Skeleton';
import { paginacionLocal } from '@/components/ui/Pagination';

// Key para localStorage de candidatos vistos
const VIEWED_CANDIDATES_KEY = 'inakat_viewed_candidates_specialist';

/** Filas por página (la lista se pagina en el cliente). */
const FILAS_POR_PAGINA = 20;

/**
 * Texto de una celda secundaria (empresa, ubicación, reclutador): en la tabla
 * va en un solo renglón con «…» (con el tope de ancho de su contenedor y el
 * texto entero en el title); en la vista de tarjetas (tabla < 600 px, la
 * misma container query de app.css) vuelve a partir en renglones, porque en
 * el móvil no hay puntero para ver el title. El texto completo está siempre
 * en el DOM: el lector de pantalla lo lee entero.
 */
const RECORTE =
  'truncate [@container_ap-tabla_(max-width:599.98px)]:overflow-visible [@container_ap-tabla_(max-width:599.98px)]:whitespace-normal';

interface Application {
  id: number;
  status: string;
}

interface Assignment {
  id: number;
  jobId: number;
  recruiterNotes: string | null;
  applications: Application[];
  job: {
    id: number;
    title: string;
    company: string;
    location: string;
    workMode: string;
    profile: string;
    user: {
      nombre: string;
      companyRequest?: {
        nombreEmpresa: string;
      };
    };
  };
  recruiter?: {
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
  hasRecruiter: boolean;
  recruiterName: string | null;
  hasRecruiterNotes: boolean;
}

export default function SpecialistDashboard() {
  const router = useRouter();
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [specialist, setSpecialist] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Página de la tabla (presentación: la lista ya llega entera).
  const [pagina, setPagina] = useState(1);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/specialist/dashboard');

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
        setSpecialist(data.data.specialist);

        // Transformar assignments a JobSummary
        const viewedIds = getViewedCandidates();
        const jobSummaries: JobSummary[] = data.data.assignments.map((a: Assignment) => {
          const applications = a.applications || [];
          // Para especialista, "pending" son los que vienen del reclutador (sent_to_specialist)
          const pendingApps = applications.filter(
            (app: Application) => app.status === 'sent_to_specialist'
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
            hasRecruiter: !!a.recruiter,
            recruiterName: a.recruiter
              ? `${a.recruiter.nombre} ${a.recruiter.apellidoPaterno}`
              : null,
            hasRecruiterNotes: !!a.recruiterNotes
          };
        });

        setJobs(jobSummaries);
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
      antetitulo="Evaluación"
      titulo="Vacantes por evaluar"
      remate="con ojo de experto"
      descripcion={
        <>
          {specialist?.specialty && (
            <span className="mb-1 inline-flex items-center gap-1.5 font-medium text-ink">
              <Star size={15} className="flex-none text-orange-dark" aria-hidden="true" />
              Especialidad: {specialist.specialty}
            </span>
          )}
          <span className="block">Selecciona una vacante para evaluar sus candidatos.</span>
        </>
      }
      acciones={acciones}
    />
  );

  if (isLoading) {
    return <SkeletonPagina />;
  }

  if (error) {
    // Sin datos que enseñar: el aviso ocupa el lugar de la página (como antes).
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

  // Cifras de la cabecera: salen de la misma lista que pinta la tabla.
  const porRevisar = jobs.reduce((suma, j) => suma + j.pendingCandidates, 0);
  const sinVer = jobs.reduce((suma, j) => suma + j.unseenCandidates, 0);
  const candidatos = jobs.reduce((suma, j) => suma + j.totalCandidates, 0);

  // Un número que no es cero se destaca con su tono; el cero va apagado.
  const cifraCelda = (n: number, tono: 'aviso' | 'info') =>
    n > 0 ? (
      <Badge tono={tono} sinPunto className="font-display font-semibold tabular-nums">
        {n}
      </Badge>
    ) : (
      <span className="tabular-nums text-ink-muted">0</span>
    );

  const columnas: Columna<JobSummary>[] = [
    {
      id: 'title',
      encabezado: 'Vacante',
      enTarjeta: 'titulo',
      className: 'min-w-[14rem]',
      celda: (job) => (
        // max-w: un título largo no se come la tabla (parte en dos renglones y
        // deja sitio a empresa, ubicación y reclutador en uno).
        <div className="min-w-0 max-w-[22rem]">
          <p className="font-semibold text-ink">{job.title}</p>
          {/* La empresa sube aquí cuando su columna se esconde (tabla estrecha). */}
          <p data-solo-bajo="md" className="mt-0.5 text-[13px] text-ink-muted">
            {job.company}
          </p>
          {(job.profile || job.hasRecruiterNotes) && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {job.profile && (
                <Badge tono="info" sinPunto tamano="sm">
                  {job.profile}
                </Badge>
              )}
              {job.hasRecruiterNotes && (
                <Badge tono="neutro" icono={FileText} tamano="sm">
                  Con notas
                </Badge>
              )}
            </div>
          )}
        </div>
      ),
    },
    {
      id: 'company',
      encabezado: 'Empresa',
      ocultarBajo: 'md',
      // Topes de ancho de las tres columnas de texto: con las ocho columnas a
      // la vista la tabla cabe desde 1100 px aunque los nombres sean largos.
      celda: (job) => (
        <span className="flex max-w-[10rem] items-center gap-1.5 font-medium text-ink">
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
      celda: (job) => (
        <div className="max-w-[9rem] text-[13px]">
          <p className="flex items-center gap-1.5 text-ink">
            <MapPin size={14} className="flex-none text-ink-muted" aria-hidden="true" />
            <span className={RECORTE} title={job.location}>
              {job.location}
            </span>
          </p>
          <p className="mt-0.5 whitespace-nowrap text-ink-muted">{getWorkModeLabel(job.workMode)}</p>
        </div>
      ),
    },
    {
      id: 'recruiter',
      encabezado: 'Reclutador',
      ocultarBajo: 'xl',
      celda: (job) =>
        job.hasRecruiter ? (
          <span className={`block max-w-[9rem] text-[13px] text-ink ${RECORTE}`} title={job.recruiterName ?? undefined}>
            {job.recruiterName}
          </span>
        ) : (
          <span className="whitespace-nowrap text-[13px] text-ink-muted">Sin asignar</span>
        ),
    },
    {
      id: 'total',
      encabezado: 'Candidatos',
      numerica: true,
      celda: (job) => <span className="font-display font-semibold">{job.totalCandidates}</span>,
    },
    {
      id: 'pending',
      encabezado: 'Por revisar',
      alinear: 'centro',
      celda: (job) => cifraCelda(job.pendingCandidates, 'aviso'),
    },
    {
      id: 'unseen',
      encabezado: 'Sin ver',
      alinear: 'centro',
      celda: (job) => cifraCelda(job.unseenCandidates, 'info'),
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

  const paginaActual = Math.min(pagina, Math.max(1, Math.ceil(jobs.length / FILAS_POR_PAGINA)));

  return (
    <>
      {cabecera(
        <Button variante="contorno" icono={RefreshCw} onClick={fetchDashboard}>
          Actualizar
        </Button>
      )}

      {/* Cifras (salen de la misma lista que la tabla) */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:mb-8 xl:grid-cols-4">
        <StatCard etiqueta="Vacantes asignadas" valor={jobs.length} icono={Briefcase} tono="teal" />
        <StatCard
          etiqueta="Por revisar"
          valor={porRevisar}
          detalle="Enviados por el reclutador, sin evaluar"
          icono={Inbox}
          tono="orange"
        />
        <StatCard etiqueta="Sin ver" valor={sinVer} detalle="Aún no abres su perfil" icono={EyeOff} tono="ink" />
        <StatCard
          etiqueta="Candidatos"
          valor={candidatos}
          detalle="En todas tus vacantes"
          icono={Users}
          tono="lime"
        />
      </div>

      {/* Lista de vacantes */}
      <Card
        titulo="Vacantes asignadas"
        descripcion="Abre una vacante para evaluar a sus candidatos y enviarlos a la empresa."
        sinRelleno
      >
        <DataTable
          etiqueta="Vacantes asignadas"
          columnas={columnas}
          filas={jobs.slice((paginaActual - 1) * FILAS_POR_PAGINA, paginaActual * FILAS_POR_PAGINA)}
          claveFila={(job) => job.id}
          alActivarFila={(job) => router.push(`/specialist/jobs/${job.jobId}`)}
          paginacion={paginacionLocal(jobs.length, paginaActual, FILAS_POR_PAGINA)}
          alCambiarPagina={setPagina}
          etiquetaTotal="vacantes"
          vacio={
            <EmptyState
              frase="Todavía nada por aquí."
              titulo="No tienes vacantes asignadas con candidatos"
              descripcion="Cuando un reclutador te envíe candidatos para evaluar, su vacante aparecerá aquí."
            />
          }
        />
      </Card>
    </>
  );
}
