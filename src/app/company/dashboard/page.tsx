// RUTA: src/app/company/dashboard/page.tsx

'use client';

/**
 * Panel de la empresa: estado de la cuenta, cifras del proceso y «Mis
 * vacantes» con sus acciones.
 *
 * Registro de aplicación (docs/DISENO.md, modelo src/app/admin/page.tsx):
 * PageHeader → avisos de la cuenta → StatCard → tabla → modales. La lógica es
 * la de siempre: las mismas llamadas con los mismos cuerpos y las mismas
 * condiciones. Los confirm() del navegador pasaron al Modal del sistema con la
 * misma forma (una promesa sí/no): el flujo que sigue a cada respuesta no cambió.
 */

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  AlertTriangle,
  Ban,
  Briefcase,
  CheckCircle2,
  Clock,
  Inbox,
  LogIn,
  Pause,
  Plus,
  RefreshCw,
  Send,
  UserCheck,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import CompanyJobsTable from '@/components/company/CompanyJobsTable';
import JobDetailModal from '@/components/company/JobDetailModal';
import { useConfirmacion, type OpcionesConfirmacion } from '@/components/ui/useConfirmacion';
import CompanyLogo from '@/components/shared/CompanyLogo';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import Button from '@/components/ui/Button';
import Toast from '@/components/ui/Toast';
import { SkeletonPagina } from '@/components/ui/Skeleton';
import { notifyAuthChanged } from '@/lib/auth-events';
import { cn } from '@/lib/utils';

interface Job {
  id: number;
  title: string;
  company: string;
  location: string;
  salary: string;
  jobType: string;
  workMode: string;
  description: string;
  requirements?: string;
  status: string;
  profile?: string;
  seniority?: string;
  createdAt: string;
  expiresAt?: string;
  applicationCount?: number;
  _count?: {
    applications: number;
  };
}

interface DashboardData {
  company: {
    userId: number;
    userName: string;
    email: string;
    credits: number;
    // Puede ser null: si un admin borra la CompanyRequest, el User de la
    // empresa sobrevive y esta ruta responde companyInfo: null.
    companyInfo: {
      nombreEmpresa: string;
      correoEmpresa: string;
      sitioWeb?: string;
      rfc: string;
      direccionEmpresa: string;
      logoUrl?: string | null; // FEAT-1b: Logo de empresa
      status?: string;
      rejectionReason?: string | null;
    } | null;
  };
  stats: {
    jobs: {
      total: number;
      active: number;
      paused: number;
      expired: number;
      closed: number;
      draft: number;
    };
    applications: {
      total: number;
      pendingReview: number; // Candidatos por revisar (sent_to_company)
      interested: number; // Candidatos marcados "Me interesa"
      interviewed: number;
      accepted: number;
      rejected: number;
    };
  };
  recentApplications: any[];
  allApplications: any[];
  /** Conteos por vacante (GET /api/company/dashboard). */
  jobStats: Array<{ jobId: number; jobTitle: string; pendingReview: number }>;
  allJobs: Job[];
}

/** Cifra con separador de miles. */
const cifra = (n: number) => n.toLocaleString('es-MX');

/** Aviso fijo del estado de la cuenta (color Y texto, con icono). */
function AvisoCuenta({
  tono,
  icono: Icono,
  titulo,
  children,
}: {
  tono: 'aviso' | 'peligro';
  icono: LucideIcon;
  titulo: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        'mb-4 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm',
        // orange-dark sobre orange-tint 6.14 · danger-dark sobre danger-tint 6.30
        tono === 'aviso' ? 'border-orange/40 bg-orange-tint text-orange-dark' : 'border-danger/30 bg-danger-tint text-danger-dark'
      )}
    >
      <Icono className="mt-0.5 h-[18px] w-[18px] flex-none" aria-hidden="true" />
      <p>
        <strong className="font-semibold">{titulo}</strong> {children}
      </p>
    </div>
  );
}

export default function CompanyDashboard() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });

  // Modal state
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [showJobModal, setShowJobModal] = useState(false);

  // Confirmaciones (antes, confirm() del navegador).
  const { confirmar, dialogo } = useConfirmacion();

  // Botón flotante «Publicar vacante» (móvil y tableta): sólo sale cuando el
  // de la cabecera ya no se ve. Al cargar, el flotante tapaba la fila «Estado»
  // de la primera tarjeta; así la acción sigue a la vista al bajar por la
  // tabla, pero nunca duplica ni tapa a la de arriba. Es un cambio de estado
  // (visible / oculto) con transición de 200 ms, no movimiento ligado al
  // scroll. Sin IntersectionObserver (o en pruebas), el flotante se queda
  // siempre visible, como antes.
  const [flotanteVisible, setFlotanteVisible] = useState(false);
  const anclaPublicar = useCallback((boton: HTMLButtonElement | null) => {
    if (!boton) return;
    if (typeof IntersectionObserver === 'undefined') {
      setFlotanteVisible(true);
      return;
    }
    // -56px arriba: lo que queda debajo de la cabecera fija del AppShell (h-14) no se ve.
    const observador = new IntersectionObserver(
      (entradas) => setFlotanteVisible(!entradas[entradas.length - 1].isIntersecting),
      { rootMargin: '-56px 0px 0px 0px' }
    );
    observador.observe(boton);
    return () => observador.disconnect();
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const response = await fetch('/api/company/dashboard');

      if (response.status === 401) {
        router.push('/login?redirect=/company/dashboard');
        return;
      }

      if (response.status === 403) {
        setError('No tienes permisos para acceder a este dashboard');
        return;
      }

      if (!response.ok) {
        throw new Error('Error al cargar el dashboard');
      }

      const result = await response.json();

      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error || 'Error desconocido');
      }
    } catch {
      setError('Error al cargar el dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleViewJob = (jobId: number) => {
    if (!data) return;
    const job = data.allJobs.find((j) => j.id === jobId);
    if (job) {
      setSelectedJob(job);
      setShowJobModal(true);
    }
  };

  // Navegar a la página de candidatos de una vacante
  const handleViewCandidates = (jobId: number, jobTitle: string) => {
    router.push(`/company/jobs/${jobId}/candidates`);
  };


  const handleEditJob = (jobId: number) => {
    router.push(`/create-job?edit=${jobId}`);
  };

  // Publicar borrador
  const handlePublishJob = async (jobId: number) => {
    if (!data) return;

    const job = data.allJobs.find((j) => j.id === jobId);
    if (!job) return;

    if (
      !(await confirmar({
        titulo: `¿Publicar la vacante «${job.title}»?`,
        descripcion: `Se descontarán los créditos correspondientes. Tienes ${data.company.credits} créditos.`,
        textoConfirmar: 'Publicar vacante',
        icono: Send,
      }))
    ) {
      return;
    }

    try {
      const response = await fetch('/api/jobs/publish', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId })
      });

      const result = await response.json();

      if (response.status === 402) {
        // Créditos insuficientes
        setNotification({ type: 'error', message: `Créditos insuficientes. Necesitas ${result.required} créditos, tienes ${result.available}.` });
        router.push('/credits/purchase');
        return;
      }

      if (response.ok && result.success) {
        setNotification({ type: 'success', message: `¡Vacante publicada! Se descontaron ${result.creditCost} créditos.` });
        fetchDashboardData();
        // UI-004: el saldo del menú del avatar (Navbar) también cambió.
        notifyAuthChanged();
      } else {
        setNotification({ type: 'error', message: result.error || 'Error al publicar la vacante' });
      }
    } catch {
      setNotification({ type: 'error', message: 'Error al publicar la vacante' });
    }
  };

  const handlePauseJob = async (jobId: number) => {
    if (
      !(await confirmar({
        titulo: '¿Pausar esta vacante?',
        descripcion: 'Los candidatos no podrán aplicar mientras esté pausada. Puedes reanudarla cuando quieras.',
        textoConfirmar: 'Pausar vacante',
        variante: 'secundario',
        icono: Pause,
      }))
    ) {
      return;
    }

    try {
      const response = await fetch(`/api/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'paused' })
      });

      if (response.ok) {
        setNotification({ type: 'success', message: 'Vacante pausada exitosamente' });
        fetchDashboardData();
      } else {
        const result = await response.json();
        setNotification({ type: 'error', message: result.error || 'Error al pausar la vacante' });
      }
    } catch {
      setNotification({ type: 'error', message: 'Error al pausar la vacante' });
    }
  };

  const handleResumeJob = async (jobId: number) => {
    try {
      const response = await fetch(`/api/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'active' })
      });

      if (response.ok) {
        setNotification({ type: 'success', message: 'Vacante reanudada exitosamente' });
        fetchDashboardData();
      } else {
        const result = await response.json();
        setNotification({ type: 'error', message: result.error || 'Error al reanudar la vacante' });
      }
    } catch {
      setNotification({ type: 'error', message: 'Error al reanudar la vacante' });
    }
  };

  // Cerrar vacante con motivo específico
  const handleCloseJob = async (jobId: number, reason: 'success' | 'cancelled') => {
    const messages: Record<'success' | 'cancelled', OpcionesConfirmacion> = {
      success: {
        titulo: '¿Cerrar como contratación exitosa?',
        descripcion: 'Esto indica que encontraste al candidato ideal. La vacante deja de recibir candidatos.',
        textoConfirmar: 'Cerrar vacante',
        icono: CheckCircle2,
      },
      cancelled: {
        titulo: '¿Cancelar esta vacante?',
        descripcion: 'Esto indica que la vacante se cierra sin haber contratado a nadie.',
        textoConfirmar: 'Cancelar vacante',
        textoCancelar: 'Volver',
        variante: 'peligro',
        icono: Ban,
      }
    };

    if (!(await confirmar(messages[reason]))) {
      return;
    }

    try {
      const response = await fetch(`/api/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'closed', closedReason: reason })
      });

      if (response.ok) {
        const successMessages = {
          success: '¡Felicidades! La vacante ha sido cerrada exitosamente.',
          cancelled: 'La vacante ha sido cancelada.'
        };
        setNotification({ type: 'success', message: successMessages[reason] });
        fetchDashboardData();
      } else {
        const result = await response.json();
        setNotification({ type: 'error', message: result.error || 'Error al cerrar la vacante' });
      }
    } catch {
      setNotification({ type: 'error', message: 'Error al cerrar la vacante' });
    }
  };

  // «Reintentar» del aviso de error: la misma carga de siempre.
  const reintentar = () => {
    setError(null);
    setLoading(true);
    fetchDashboardData();
  };

  if (loading) {
    return <SkeletonPagina />;
  }

  if (error || !data) {
    return (
      <>
        <PageHeader antetitulo="Panel de empresa" titulo="Tu panel" />
        <div
          role="alert"
          className="flex flex-col gap-4 rounded-xl border border-danger/30 bg-danger-tint p-5 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-3 text-danger-dark">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-none" aria-hidden="true" />
            <div>
              <p className="font-display font-semibold">Error al cargar</p>
              <p className="mt-0.5 text-sm">{error || 'No se pudo cargar el dashboard'}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variante="contorno" icono={RefreshCw} onClick={reintentar}>
              Reintentar
            </Button>
            <Button variante="secundario" icono={LogIn} onClick={() => router.push('/login')}>
              Ir al inicio de sesión
            </Button>
          </div>
        </div>
      </>
    );
  }

  const companyInfo = data.company.companyInfo;
  const nombreEmpresa = companyInfo?.nombreEmpresa || 'tu empresa';
  const estadoSolicitud = companyInfo?.status;
  const vacantes = data.stats.jobs;
  const postulaciones = data.stats.applications;
  // Candidatos por revisar de cada vacante (para el aviso en su fila).
  const porRevisar = Object.fromEntries((data.jobStats ?? []).map((s) => [s.jobId, s.pendingReview]));
  // Atajo de «Por revisar»: la vacante con más candidatos esperando decisión.
  const masPendiente = [...(data.jobStats ?? [])].sort((a, b) => b.pendingReview - a.pendingReview)[0];
  const publicar = () => router.push('/create-job');

  return (
    <>
      <div className="mb-6 flex items-start gap-4 sm:mb-8">
        <CompanyLogo
          logoUrl={companyInfo?.logoUrl}
          companyName={nombreEmpresa}
          size="lg"
          className="mt-1 hidden border border-line shadow-ap-1 sm:flex"
        />
        <PageHeader
          className="mb-0 min-w-0 flex-1 sm:mb-0"
          antetitulo="Panel de empresa"
          titulo={companyInfo?.nombreEmpresa || 'Tu panel'}
          descripcion={
            <>
              Bienvenido, <span className="font-medium text-ink">{data.company.userName}</span>. Publica vacantes y
              decide sobre los candidatos que INAKAT ya evaluó para ti.
            </>
          }
          acciones={
            // A la vista en todos los anchos: en móvil, al bajar, la releva el
            // botón flotante (ver anclaPublicar).
            <Button ref={anclaPublicar} icono={Plus} onClick={publicar}>
              Publicar vacante
            </Button>
          }
        />
      </div>

      {/* Estado de la solicitud: el servidor bloquea publicar vacantes y ver
          candidatos hasta que un admin apruebe la empresa, así que hay que
          decirlo aquí en vez de dejar que el usuario choque con un 403. */}
      {!companyInfo && (
        <AvisoCuenta tono="peligro" icono={XCircle} titulo="Tu empresa no tiene una solicitud asociada.">
          Contacta a soporte para reactivar tu cuenta.
        </AvisoCuenta>
      )}
      {estadoSolicitud === 'pending' && (
        <AvisoCuenta tono="aviso" icono={Clock} titulo="Cuenta en revisión.">
          Publicar vacantes y ver candidatos se habilitará cuando INAKAT apruebe tu empresa.
        </AvisoCuenta>
      )}
      {estadoSolicitud === 'rejected' && (
        <AvisoCuenta tono="peligro" icono={XCircle} titulo="Tu solicitud fue rechazada.">
          {companyInfo?.rejectionReason
            ? `Motivo: ${companyInfo.rejectionReason}.`
            : ''}{' '}
          Contacta a soporte para más información.
        </AvisoCuenta>
      )}

      {/* Cifras del proceso (contadas por /api/company/dashboard). Ningún texto
          dice «activas»: la prueba e2e del panel busca ese texto en la pestaña. */}
      <div className="mb-6 mt-2 grid grid-cols-2 gap-3 sm:gap-4 lg:mb-8 xl:grid-cols-4">
        <StatCard
          etiqueta="Por revisar"
          valor={cifra(postulaciones.pendingReview)}
          detalle="Candidatos evaluados que esperan tu decisión"
          icono={Inbox}
          tono="orange"
          enlace={
            masPendiente && masPendiente.pendingReview > 0
              ? { href: `/company/jobs/${masPendiente.jobId}/candidates`, etiqueta: 'Empezar a revisar' }
              : undefined
          }
        />
        <StatCard
          etiqueta="En proceso"
          valor={cifra(postulaciones.interested + postulaciones.interviewed)}
          detalle={`${postulaciones.interested} te interesan · ${postulaciones.interviewed} entrevistados`}
          icono={Clock}
          tono="teal"
        />
        <StatCard
          etiqueta="En contratación"
          valor={cifra(postulaciones.accepted)}
          detalle={`De ${cifra(postulaciones.total)} candidatos recibidos`}
          icono={UserCheck}
          tono="lime"
        />
        <StatCard
          etiqueta="Vacantes publicadas"
          valor={cifra(vacantes.active)}
          detalle={`${vacantes.paused} en pausa · ${vacantes.draft} ${vacantes.draft === 1 ? 'borrador' : 'borradores'}`}
          alerta={
            vacantes.expired > 0 && (
              <span className="flex items-center gap-1">
                <AlertTriangle size={12} aria-hidden="true" />
                {vacantes.expired} expirada{vacantes.expired !== 1 ? 's' : ''}
              </span>
            )
          }
          icono={Briefcase}
          tono="ink"
        />
      </div>

      {/* Tabla de Vacantes */}
      <CompanyJobsTable
        jobs={data.allJobs}
        onView={handleViewJob}
        onEdit={handleEditJob}
        onClose={handleCloseJob}
        onPause={handlePauseJob}
        onResume={handleResumeJob}
        onViewCandidates={handleViewCandidates}
        onPublish={handlePublishJob}
        porRevisar={porRevisar}
        onCreate={publicar}
      />

      {/* Botón flotante para crear vacante (UX-01). En móvil y tableta, donde
          no hay barra lateral, es la forma de publicar sin volver arriba; en
          escritorio la acción está en la cabecera y en la barra lateral.
          Oculto (inert: fuera del orden de tabulación y del lector) mientras
          se ve el botón de la cabecera. */}
      <div
        data-oculto={!flotanteVisible}
        inert={!flotanteVisible}
        className="fixed bottom-5 right-4 z-40 transition-[opacity,transform] duration-200 ease-marca data-[oculto=true]:pointer-events-none data-[oculto=true]:translate-y-3 data-[oculto=true]:opacity-0 motion-reduce:transition-none lg:hidden"
      >
        <Button icono={Plus} onClick={publicar} title="Crear nueva vacante" className="h-12 rounded-full px-5 shadow-ap-3">
          Publicar vacante
        </Button>
      </div>
      {/* Hueco para que el botón flotante (48 px a 20 px del borde) no tape
          la última fila al llegar al final. */}
      <div className="h-20 lg:hidden" aria-hidden="true" />

      {/* Avisos de las acciones: arriba y a la vista estés donde estés de la
          tabla. Los errores se quedan hasta que los cierras. */}
      <Toast
        tono={notification.type === 'error' ? 'error' : 'exito'}
        mensaje={notification.type ? notification.message : null}
        alCerrar={() => setNotification({ type: null, message: '' })}
        duracion={notification.type === 'error' ? 0 : 6000}
      />

      {dialogo}

      {/* Job Detail Modal.
          El modal espera `job.logoUrl`, pero las vacantes de
          /api/company/dashboard no traen ese campo: sin inyectarlo aquí el
          encabezado mostraba siempre el icono genérico. */}
      <JobDetailModal
        job={selectedJob ? { ...selectedJob, logoUrl: companyInfo?.logoUrl } : null}
        isOpen={showJobModal}
        onClose={() => setShowJobModal(false)}
      />
    </>
  );
}
