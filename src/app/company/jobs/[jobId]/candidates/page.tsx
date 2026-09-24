// RUTA: src/app/company/jobs/[jobId]/candidates/page.tsx

'use client';

/**
 * Candidatos de una vacante, vistos por la empresa: los que INAKAT ya evaluó
 * y le envió, por etapa (por revisar, en proceso, en contratación,
 * descartados), con las decisiones de la empresa en cada fila.
 *
 * Registro de aplicación (docs/DISENO.md): PageHeader con migas → Card con
 * Tabs + DataTable (tarjetas en móvil) → modales. La lógica es la de siempre:
 * la misma carga, el mismo PATCH con el mismo cuerpo, la misma ficha y la misma
 * solicitud de entrevista. Los dos confirm() del navegador pasaron al Modal del
 * sistema con la misma forma (una promesa sí/no). La información rápida que
 * antes salía sólo al pasar el ratón (universidad, carrera, nivel…) ahora está
 * en la columna «Perfil», a la vista y para el teclado.
 */

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  Banknote,
  Building,
  GraduationCap,
  Heart,
  MapPin,
  RefreshCw,
  RotateCcw,
  Trash2,
  UserCheck,
  Video,
} from 'lucide-react';
import CandidateProfileModal from '@/components/shared/CandidateProfileModal';
import CandidatePhoto from '@/components/shared/CandidatePhoto'; // FEAT-2: Foto de perfil
import InterviewRequestModal from '@/components/company/InterviewRequestModal'; // FEAT-6: Solicitud de entrevista
import DistanceBadge from '@/components/shared/DistanceBadge';
import MenuAcciones, { type OpcionMenu } from '@/components/ui/MenuAcciones';
import { useConfirmacion } from '@/components/ui/useConfirmacion';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import Tabs, { PanelPestana } from '@/components/ui/Tabs';
import DataTable, { type Columna } from '@/components/ui/DataTable';
import StatusBadge, { Badge } from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import Toast from '@/components/ui/Toast';
import { SkeletonPagina } from '@/components/ui/Skeleton';
import { fechaCorta } from '@/lib/fechas';

// Tipos
interface Job {
  id: number;
  title: string;
  company: string;
  location: string;
  latitude?: number | null;
  longitude?: number | null;
  salary: string;
  status: string;
  profile?: string;
  seniority?: string;
  habilidades?: string | null;
  createdAt: string;
}

interface Application {
  id: number;
  candidateName: string;
  candidateEmail: string;
  candidatePhone?: string;
  status: string;
  createdAt: string;
  cvUrl?: string;
  candidateProfile?: {
    id?: number;
    profile?: string;
    seniority?: string;
    universidad?: string;
    carrera?: string;
    nivelEstudios?: string;
    telefono?: string;
    linkedinUrl?: string;
    portafolioUrl?: string;
    cvUrl?: string;
    fotoUrl?: string; // FEAT-2: Foto de perfil
    experiences?: any[];
    documents?: any[];
    latitude?: number | null;
    longitude?: number | null;
  };
}

type TabKey = 'new' | 'in_process' | 'rejected' | 'hiring';

interface TabConfig {
  key: TabKey;
  label: string;
  statuses: string[];
  /** Estado vacío de la pestaña. */
  vacio: { titulo: string; descripcion: string };
}

// El orden es el del embudo (por revisar → en proceso → contratación) y
// después los descartados. Las claves y los estados de cada pestaña, los de
// siempre.
const TABS: TabConfig[] = [
  {
    key: 'new',
    label: 'Por revisar',
    statuses: ['sent_to_company'],
    vacio: {
      titulo: 'No hay candidatos por revisar',
      descripcion: 'Los candidatos aparecerán aquí cuando el especialista los envíe.',
    },
  },
  {
    key: 'in_process',
    label: 'En proceso',
    statuses: ['company_interested', 'interviewed'],
    vacio: {
      titulo: 'Nadie en proceso todavía',
      descripcion: 'Marca candidatos como «Me interesa» para verlos aquí.',
    },
  },
  {
    key: 'hiring',
    label: 'En contratación',
    statuses: ['accepted'],
    vacio: {
      titulo: 'Aún no contratas a nadie',
      descripcion: 'Los candidatos en proceso de contratación aparecerán aquí.',
    },
  },
  {
    key: 'rejected',
    label: 'Descartados',
    statuses: ['rejected'],
    vacio: {
      titulo: 'No has descartado a nadie',
      descripcion: 'Los candidatos descartados aparecerán aquí; desde ahí puedes recuperarlos.',
    },
  },
];

export default function JobCandidatesPage() {
  const router = useRouter();
  const params = useParams();
  const jobId = params.jobId as string;

  const [job, setJob] = useState<Job | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('new');

  // Modal de ficha de candidato
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);
  const [showCandidateProfile, setShowCandidateProfile] = useState(false);
  const [candidateIndex, setCandidateIndex] = useState(0);

  // Notificación
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });

  // FEAT-6: Solicitud de entrevista
  const [interviewApp, setInterviewApp] = useState<Application | null>(null);
  const [showInterviewModal, setShowInterviewModal] = useState(false);

  // Confirmaciones (antes, confirm() del navegador).
  const { confirmar, dialogo } = useConfirmacion();

  useEffect(() => {
    if (jobId) {
      fetchData();
    }
  }, [jobId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/company/jobs/${jobId}/candidates`);

      if (response.status === 401) {
        router.push('/login?redirect=/company/dashboard');
        return;
      }

      if (response.status === 403) {
        setError('No tienes permisos para ver esta vacante');
        return;
      }

      if (response.status === 404) {
        setError('Vacante no encontrada');
        return;
      }

      if (!response.ok) {
        throw new Error('Error al cargar datos');
      }

      const result = await response.json();

      if (result.success) {
        setJob(result.data.job);
        setApplications(result.data.applications);
      } else {
        setError(result.error || 'Error desconocido');
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  // Filtrar candidatos por tab activa
  const getFilteredCandidates = (tabKey: TabKey) => {
    const tab = TABS.find(t => t.key === tabKey);
    if (!tab) return [];
    return applications.filter(app => tab.statuses.includes(app.status));
  };

  const filteredCandidates = getFilteredCandidates(activeTab);

  // Contar candidatos por tab
  const getCandidateCount = (tabKey: TabKey) => {
    return getFilteredCandidates(tabKey).length;
  };

  // Abrir ficha de candidato
  const handleViewCandidateProfile = (application: Application, index: number) => {
    setSelectedApplication(application);
    setCandidateIndex(index);
    setShowCandidateProfile(true);
  };

  // Navegación entre candidatos
  const handleNextCandidate = () => {
    if (candidateIndex < filteredCandidates.length - 1) {
      const newIndex = candidateIndex + 1;
      setCandidateIndex(newIndex);
      setSelectedApplication(filteredCandidates[newIndex]);
    }
  };

  const handlePrevCandidate = () => {
    if (candidateIndex > 0) {
      const newIndex = candidateIndex - 1;
      setCandidateIndex(newIndex);
      setSelectedApplication(filteredCandidates[newIndex]);
    }
  };

  // Acciones sobre candidatos
  const handleCandidateAction = async (
    applicationId: number,
    action: 'company_interested' | 'interviewed' | 'accepted' | 'rejected',
    candidateName: string
  ) => {
    const confirmMessages: Record<string, { titulo: string; textoConfirmar: string; variante?: 'primario' | 'secundario' | 'peligro' }> = {
      company_interested: { titulo: `¿Marcar a ${candidateName} como "Me interesa"?`, textoConfirmar: 'Me interesa', variante: 'secundario' },
      interviewed: { titulo: `¿Marcar a ${candidateName} como "Entrevistado"?`, textoConfirmar: 'Marcar como entrevistado', variante: 'secundario' },
      rejected: { titulo: `¿Descartar a ${candidateName}?`, textoConfirmar: 'Descartar', variante: 'peligro' },
      accepted: { titulo: `¿Iniciar proceso de contratación con ${candidateName}?`, textoConfirmar: 'Iniciar contratación' }
    };

    if (!(await confirmar(confirmMessages[action]))) return;

    let closeJob = false;
    if (action === 'accepted') {
      // «Sí» cierra la vacante; «No» (o Escape) la deja abierta. En los dos
      // casos la contratación sigue, igual que con el confirm() de antes.
      closeJob = await confirmar({
        titulo: '¿Deseas cerrar la vacante?',
        descripcion: 'Esto significa que ya no recibirás más candidatos.',
        textoConfirmar: 'Sí, cerrar la vacante',
        textoCancelar: 'No, dejarla abierta',
        variante: 'secundario',
      });
    }

    try {
      const response = await fetch(`/api/company/applications/${applicationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: action, closeJob })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setNotification({ type: 'success', message: result.message });
        fetchData();
        if (result.jobClosed) {
          router.push('/company/dashboard');
        }
      } else {
        setNotification({ type: 'error', message: result.error || 'Error al actualizar candidato' });
      }
    } catch (error) {
      console.error('Error updating candidate:', error);
      setNotification({ type: 'error', message: 'Error al actualizar candidato' });
    }
  };

  // Fecha corta del panel (src/lib/fechas): «23 sep 2026».
  const formatDate = (dateString: string) => fechaCorta(dateString);

  // Estado de la postulación en el vocabulario de la empresa (color Y texto:
  // el contexto «empresa» de StatusBadge, el mismo que usa la ficha). Un
  // estado desconocido sale neutro con su nombre.
  const getStatusBadge = (status: string) => <StatusBadge estado={status} contexto="empresa" />;

  const abrirEntrevista = (app: Application) => {
    setInterviewApp(app);
    setShowInterviewModal(true);
  };

  // ---------------------------------------------------------------------------
  // Acciones de cada candidato: las MISMAS de siempre y con las mismas
  // condiciones (Me interesa sólo por revisar; entrevista por revisar o «me
  // interesa»; contratar y descartar mientras no sea final; recuperar o
  // contratar a un descartado). En la fila se ve sólo la siguiente del embudo;
  // el resto, en el menú «⋯».
  // ---------------------------------------------------------------------------
  const accionesDe = (app: Application): OpcionMenu[] => {
    const contratar: OpcionMenu = {
      id: 'contratar',
      etiqueta: 'Contratar',
      icono: UserCheck,
      detalle: 'Iniciar el proceso de contratación',
      alElegir: () => handleCandidateAction(app.id, 'accepted', app.candidateName),
    };
    // FIX-03: un descartado se puede recuperar o contratar directamente.
    if (app.status === 'rejected') {
      return [
        {
          id: 'recuperar',
          etiqueta: 'Recuperar',
          icono: RotateCcw,
          detalle: 'Vuelve a «Me interesa»',
          alElegir: () => handleCandidateAction(app.id, 'company_interested', app.candidateName),
        },
        contratar,
      ];
    }
    if (app.status === 'accepted') return [];

    const acciones: OpcionMenu[] = [];
    // Me interesa - Solo si está en sent_to_company
    if (app.status === 'sent_to_company') {
      acciones.push({
        id: 'interesa',
        etiqueta: 'Me interesa',
        icono: Heart,
        alElegir: () => handleCandidateAction(app.id, 'company_interested', app.candidateName),
      });
    }
    // Solicitar Entrevista - Para sent_to_company y company_interested
    if (app.status === 'sent_to_company' || app.status === 'company_interested') {
      acciones.push({
        id: 'entrevista',
        etiqueta: 'Solicitar entrevista',
        icono: Video,
        detalle: 'INAKAT la coordina con el candidato',
        alElegir: () => abrirEntrevista(app),
      });
    }
    acciones.push(contratar, {
      id: 'descartar',
      etiqueta: 'Descartar candidato',
      icono: Trash2,
      peligro: true,
      alElegir: () => handleCandidateAction(app.id, 'rejected', app.candidateName),
    });
    return acciones;
  };

  // Texto corto del botón visible (la columna de acciones no puede crecer) y
  // su nombre completo para el lector de pantalla.
  const ETIQUETA_CORTA: Record<string, string> = {
    interesa: 'Me interesa',
    entrevista: 'Entrevista',
    contratar: 'Contratar',
    recuperar: 'Recuperar',
  };
  const ETIQUETA_ACCESIBLE: Record<string, (nombre: string) => string> = {
    interesa: (nombre) => `Me interesa: ${nombre}`,
    entrevista: (nombre) => `Solicitar entrevista con ${nombre}`,
    contratar: (nombre) => `Contratar a ${nombre}`,
    recuperar: (nombre) => `Recuperar a ${nombre}`,
  };

  // ---------------------------------------------------------------------------
  // Columnas (DataTable pinta la tabla y, en móvil, las tarjetas)
  // ---------------------------------------------------------------------------
  const abrirFicha = (app: Application) => handleViewCandidateProfile(app, filteredCandidates.indexOf(app));

  const columnas: Columna<Application>[] = [
    {
      id: 'candidato',
      encabezado: 'Candidato',
      enTarjeta: 'titulo',
      className: 'min-w-[13rem]',
      celda: (app) => (
        <div className="flex min-w-0 items-center gap-3">
          {/* FEAT-2: Foto de perfil del candidato */}
          <CandidatePhoto fotoUrl={app.candidateProfile?.fotoUrl} candidateName={app.candidateName} size="md" />
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => abrirFicha(app)}
              className="block max-w-full truncate rounded text-left font-semibold text-ink transition-colors duration-150 hover:text-teal hover:underline"
            >
              {app.candidateName}
              <span className="sr-only">: ver ficha</span>
            </button>
            <p className="truncate text-[13px] text-ink-muted">{app.candidateEmail}</p>
            {/* Si la columna «Perfil» se esconde (tabla estrecha), su dato principal sube aquí. */}
            {(app.candidateProfile?.profile || app.candidateProfile?.seniority) && (
              <span data-solo-bajo="lg" className="mt-1 flex flex-wrap gap-1">
                {app.candidateProfile?.profile && (
                  <Badge tono="info" sinPunto tamano="sm">
                    {app.candidateProfile.profile}
                  </Badge>
                )}
                {app.candidateProfile?.seniority && (
                  <Badge tono="neutro" sinPunto tamano="sm">
                    {app.candidateProfile.seniority}
                  </Badge>
                )}
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      id: 'perfil',
      encabezado: 'Perfil',
      ocultarBajo: 'lg',
      className: 'min-w-[10rem]',
      celda: (app) => {
        const perfil = app.candidateProfile;
        if (!perfil) return <span className="text-ink-muted">Sin expediente</span>;
        const estudios = [perfil.carrera, perfil.universidad].filter(Boolean).join(' · ');
        return (
          <div className="min-w-0 space-y-1">
            {(perfil.profile || perfil.seniority) && (
              <div className="flex flex-wrap gap-1">
                {perfil.profile && (
                  <Badge tono="info" sinPunto tamano="sm">
                    {perfil.profile}
                  </Badge>
                )}
                {perfil.seniority && (
                  <Badge tono="neutro" sinPunto tamano="sm">
                    {perfil.seniority}
                  </Badge>
                )}
              </div>
            )}
            {(estudios || perfil.nivelEstudios) && (
              <p className="flex items-start gap-1.5 text-[13px] leading-snug text-ink-muted">
                <GraduationCap className="mt-0.5 h-3.5 w-3.5 flex-none" aria-hidden="true" />
                <span>
                  {estudios}
                  {perfil.nivelEstudios && (
                    <span className="block text-xs">{perfil.nivelEstudios}</span>
                  )}
                </span>
              </p>
            )}
          </div>
        );
      },
    },
    {
      id: 'distancia',
      encabezado: 'Distancia',
      ocultarBajo: 'xl',
      className: 'whitespace-nowrap',
      celda: (app) =>
        app.candidateProfile?.latitude != null && job?.latitude != null ? (
          <DistanceBadge
            candidateLat={app.candidateProfile?.latitude}
            candidateLng={app.candidateProfile?.longitude}
            jobLat={job?.latitude}
            jobLng={job?.longitude}
            compact
          />
        ) : (
          // aria-label en un <span> sin rol no se anuncia: el texto va en sr-only.
          <span className="text-ink-muted">
            <span aria-hidden="true">—</span>
            <span className="sr-only">Sin ubicación</span>
          </span>
        ),
    },
    {
      id: 'createdAt',
      encabezado: 'Recibido',
      ocultarBajo: 'md',
      className: 'whitespace-nowrap',
      celda: (app) => <span className="tabular-nums text-ink">{formatDate(app.createdAt)}</span>,
    },
    {
      id: 'status',
      encabezado: 'Estado',
      className: 'whitespace-nowrap',
      celda: (app) => getStatusBadge(app.status),
    },
    {
      id: 'acciones',
      encabezado: 'Acciones',
      encabezadoOculto: true,
      alinear: 'fin',
      enTarjeta: 'completa',
      className: 'w-px whitespace-nowrap',
      celda: (app) => {
        const [principal, ...resto] = accionesDe(app);
        if (!principal) return null;
        const Icono = principal.icono;
        return (
          // Sin flex-wrap: con w-px la columna tomaría el ancho del botón más
          // ancho y apilaría las acciones.
          <div className="flex items-center justify-end gap-1.5">
            <Button
              variante="contorno"
              tamano="sm"
              icono={Icono}
              onClick={principal.alElegir}
              aria-label={ETIQUETA_ACCESIBLE[principal.id]?.(app.candidateName) ?? principal.etiqueta}
            >
              {ETIQUETA_CORTA[principal.id] ?? principal.etiqueta}
            </Button>
            <MenuAcciones etiqueta={`Más acciones para ${app.candidateName}`} opciones={resto} />
          </div>
        );
      },
    },
  ];

  if (loading) {
    return <SkeletonPagina conCifras={false} />;
  }

  if (error) {
    return (
      <>
        <PageHeader
          migas={[{ etiqueta: 'Panel', href: '/company/dashboard' }, { etiqueta: 'Candidatos' }]}
          antetitulo="Candidatos de la vacante"
          titulo="No pudimos abrir esta vacante"
        />
        <div
          role="alert"
          className="flex flex-col gap-4 rounded-xl border border-danger/30 bg-danger-tint p-5 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="flex items-start gap-3 font-medium text-danger-dark">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-none" aria-hidden="true" />
            {error}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variante="contorno"
              icono={RefreshCw}
              onClick={() => {
                setError(null);
                fetchData();
              }}
            >
              Reintentar
            </Button>
            <Button variante="secundario" icono={ArrowLeft} onClick={() => router.push('/company/dashboard')}>
              Volver al panel
            </Button>
          </div>
        </div>
      </>
    );
  }

  const tabActiva = TABS.find((t) => t.key === activeTab) ?? TABS[0];

  return (
    <>
      <PageHeader
        migas={[
          { etiqueta: 'Panel', href: '/company/dashboard' },
          { etiqueta: job?.title ?? 'Vacante' },
          { etiqueta: 'Candidatos' },
        ]}
        antetitulo="Candidatos de la vacante"
        titulo={job?.title ?? 'Vacante'}
        descripcion={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <span className="inline-flex items-center gap-1.5">
              <Building className="h-4 w-4 flex-none" aria-hidden="true" />
              {job?.company}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-4 w-4 flex-none" aria-hidden="true" />
              {job?.location}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Banknote className="h-4 w-4 flex-none" aria-hidden="true" />
              {job?.salary}
            </span>
            {job?.profile && (
              <Badge tono="info" sinPunto>
                {job.profile}
              </Badge>
            )}
          </span>
        }
        acciones={
          <Button variante="contorno" icono={ArrowLeft} onClick={() => router.push('/company/dashboard')}>
            Volver al panel
          </Button>
        }
      />

      <Card
        titulo="Candidatos evaluados por INAKAT"
        descripcion={`${applications.length} ${applications.length === 1 ? 'candidato' : 'candidatos'} en total · abre la ficha para ver su evaluación`}
        sinRelleno
      >
        <Tabs
          idBase="candidatos"
          etiqueta="Candidatos por etapa"
          activa={activeTab}
          alCambiar={(id) => setActiveTab(id as TabKey)}
          pestanas={TABS.map((tab) => ({ id: tab.key, etiqueta: tab.label, contador: getCandidateCount(tab.key) }))}
          className="px-3"
        />
        <PanelPestana idBase="candidatos" id={activeTab} activa={activeTab} className="pt-0">
          <DataTable
            etiqueta={`Candidatos: ${tabActiva.label}`}
            columnas={columnas}
            filas={filteredCandidates}
            claveFila={(app) => app.id}
            alActivarFila={abrirFicha}
            vacio={
              <EmptyState
                frase="Todavía nada por aquí."
                titulo={tabActiva.vacio.titulo}
                descripcion={tabActiva.vacio.descripcion}
              />
            }
          />
        </PanelPestana>
      </Card>

      {/* Avisos de las acciones (arriba, a la vista). Los errores se quedan hasta cerrarlos. */}
      <Toast
        tono={notification.type === 'error' ? 'error' : 'exito'}
        mensaje={notification.type ? notification.message : null}
        alCerrar={() => setNotification({ type: null, message: '' })}
        duracion={notification.type === 'error' ? 0 : 6000}
      />

      {dialogo}

      {/* Modal de Ficha de Candidato */}
      <CandidateProfileModal
        application={selectedApplication}
        isOpen={showCandidateProfile}
        onClose={() => setShowCandidateProfile(false)}
        onNext={handleNextCandidate}
        onPrev={handlePrevCandidate}
        currentIndex={candidateIndex}
        totalCount={filteredCandidates.length}
        userRole="company"
        jobHabilidades={job?.habilidades}
      />

      {/* FEAT-6: Modal de Solicitud de Entrevista */}
      {interviewApp && (
        <InterviewRequestModal
          isOpen={showInterviewModal}
          onClose={() => {
            setShowInterviewModal(false);
            setInterviewApp(null);
          }}
          applicationId={interviewApp.id}
          candidateName={interviewApp.candidateName}
          jobTitle={job?.title || ''}
          candidatePhoto={interviewApp.candidateProfile?.fotoUrl}
          onSuccess={() => {
            setNotification({ type: 'success', message: `Solicitud de entrevista enviada para ${interviewApp.candidateName}` });
            fetchData();
          }}
        />
      )}
    </>
  );
}
