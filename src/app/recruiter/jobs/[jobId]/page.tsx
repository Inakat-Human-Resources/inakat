// RUTA: src/app/recruiter/jobs/[jobId]/page.tsx

'use client';

/**
 * Candidatos de una vacante asignada al reclutador, por etapa: Por revisar →
 * En proceso → Enviadas (al especialista) · Descartados.
 *
 * Registro de aplicación (docs/DISENO.md): PageHeader con migas → equipo de la
 * vacante → Card con pestañas y DataTable. La lógica es la de siempre (una
 * llamada con ?jobId=, las transiciones de RECRUITER_TRANSITIONS, la
 * actualización local tras cada movimiento, los vistos en localStorage y el
 * modal de perfil con navegación); sólo cambió la presentación.
 */

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft,
  Send,
  Eye,
  PlayCircle,
  UserX,
  RotateCcw,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  MapPin,
  Mail,
  Phone,
  GraduationCap,
  Briefcase,
  RefreshCw,
  UserCheck,
  X
} from 'lucide-react';
import CandidateProfileModal from '@/components/shared/CandidateProfileModal';
import CompanyLogo from '@/components/shared/CompanyLogo';
import CandidatePhoto from '@/components/shared/CandidatePhoto'; // FEAT-2: Foto de perfil
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import DataTable, { type Columna } from '@/components/ui/DataTable';
import StatusBadge, { Badge } from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import Button from '@/components/ui/Button';
import IconButton from '@/components/ui/IconButton';
import Tabs, { PanelPestana } from '@/components/ui/Tabs';
import { SkeletonPagina } from '@/components/ui/Skeleton';
import { paginacionLocal } from '@/components/ui/Pagination';

// Key para localStorage de candidatos vistos
const VIEWED_CANDIDATES_KEY = 'inakat_viewed_candidates_recruiter';

/**
 * Transiciones que la API acepta desde cada estado (espejo de
 * allowedTransitions en src/app/api/recruiter/dashboard/route.ts).
 * Los botones se pintan a partir de esta tabla: antes la pestaña "Por revisar"
 * y "Descartados" ofrecían un botón "Enviar" que la API rechazaba siempre con
 * un 400, porque sent_to_specialist sólo se permite desde 'reviewing'.
 */
const RECRUITER_TRANSITIONS: Record<string, string[]> = {
  pending: ['reviewing', 'discarded'],
  injected_by_admin: ['reviewing', 'discarded'],
  reviewing: ['sent_to_specialist', 'discarded', 'pending'],
  discarded: ['reviewing', 'pending']
};

const canMove = (from: string, to: string): boolean =>
  (RECRUITER_TRANSITIONS[from] || []).includes(to);

/**
 * Estados en los que la postulación ya salió de manos del reclutador. La
 * pestaña "Enviadas" filtraba sólo 'sent_to_specialist': en cuanto el
 * especialista la tomaba (evaluating) o la empresa actuaba, el candidato no
 * aparecía en ninguna pestaña de la vacante.
 */
const SENT_STATUSES = [
  'sent_to_specialist',
  'evaluating',
  'sent_to_company',
  'company_interested',
  'interviewed',
  'accepted',
  'rejected'
];

const SENT_STATUS_LABELS: Record<string, string> = {
  sent_to_specialist: 'Enviado',
  evaluating: 'En evaluación',
  sent_to_company: 'Enviado a empresa',
  company_interested: 'Le interesa a la empresa',
  interviewed: 'Entrevistado',
  accepted: 'Contratado',
  rejected: 'Rechazado'
};

type TabType = 'pending' | 'reviewing' | 'sent' | 'discarded';

/** Filas por página de la tabla (se pagina en el cliente). */
const FILAS_POR_PAGINA = 25;

/** Qué hacer en cada pestaña, en una línea (sobre la tabla). */
const AYUDA_PESTANA: Record<TabType, string> = {
  pending: 'Pulsa «Revisar» para pasar a un candidato a «En proceso».',
  reviewing: 'Desde aquí envías al especialista o regresas al candidato a «Por revisar».',
  sent: 'Sólo lectura: desde el envío, el estado lo actualizan el especialista y la empresa.',
  discarded: 'Puedes reactivar a un candidato o moverlo directamente a «En proceso».'
};

/** La voz humana del estado vacío de cada pestaña. */
const FRASE_VACIO: Record<TabType, string> = {
  pending: 'Bandeja al día.',
  reviewing: 'Nada en proceso.',
  sent: 'Aún no envías a nadie.',
  discarded: 'Nadie descartado.'
};

/**
 * Nombre en pantalla de cada estado al que se mueve un candidato (el de las
 * pestañas). La API ya responde con estos nombres («Candidato movido a
 * «En proceso»»); la guardia local y una API anterior citan el estado crudo
 * («"reviewing"»): al PINTARLOS se cambia por este nombre. El mensaje guardado
 * en el estado es el de siempre.
 */
const NOMBRE_ESTADO: Record<string, string> = {
  pending: 'Por revisar',
  injected_by_admin: 'Por revisar',
  reviewing: 'En proceso',
  sent_to_specialist: 'Enviado al especialista',
  discarded: 'Descartados'
};

const legible = (texto: string) =>
  texto.replace(/"([a-z_]+)"/g, (entero, estado: string) =>
    NOMBRE_ESTADO[estado] ? `«${NOMBRE_ESTADO[estado]}»` : entero
  );

interface CandidateProfile {
  id?: number;
  universidad?: string;
  carrera?: string;
  nivelEstudios?: string;
  añosExperiencia?: number;
  profile?: string;
  seniority?: string;
  linkedinUrl?: string;
  portafolioUrl?: string;
  cvUrl?: string;
  telefono?: string;
  sexo?: string;
  fechaNacimiento?: string;
  source?: string;
  notas?: string;
  fotoUrl?: string; // FEAT-2: Foto de perfil
  experiences?: any[];
  educacion?: string;
  subcategory?: string;
  documents?: any[];
}

interface Application {
  id: number;
  candidateName: string;
  candidateEmail: string;
  candidatePhone: string | null;
  status: string;
  createdAt: string;
  cvUrl: string | null;
  coverLetter?: string;
  notes?: string;
  candidateProfile?: CandidateProfile | null;
}

interface JobData {
  id: number;
  title: string;
  company: string;
  location: string;
  latitude?: number | null;
  longitude?: number | null;
  workMode: string;
  profile: string;
  seniority: string;
  description: string;
  applications: Application[];
  user: {
    nombre: string;
    companyRequest?: {
      nombreEmpresa: string;
      logoUrl?: string | null; // FEAT-1b: Logo de empresa
    };
  };
}

interface AssignmentData {
  id: number;
  jobId: number;
  job: JobData;
  specialist?: {
    id: number;
    nombre: string;
    apellidoPaterno: string;
    email: string;
    specialty: string;
  };
}

export default function RecruiterJobCandidates() {
  const router = useRouter();
  const params = useParams();
  const jobId = params.jobId as string;

  const [assignment, setAssignment] = useState<AssignmentData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Dos errores distintos: el de CARGA sustituye la página (no hay nada que
  // enseñar) y el de una ACCIÓN se muestra como alerta descartable sin tirar
  // cabecera, pestañas ni scroll. Antes compartían estado, así que cualquier
  // 400 de un botón borraba la página entera y la alerta inline con su '×'
  // era código inalcanzable.
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Pestaña activa
  const [activeTab, setActiveTab] = useState<TabType>('pending');

  // Estados de carga para acciones
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  // Modal de perfil de candidato
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);

  // Navegación entre candidatos
  const [currentCandidatesList, setCurrentCandidatesList] = useState<Application[]>([]);
  const [currentCandidateIndex, setCurrentCandidateIndex] = useState<number>(0);

  // IDs de candidatos vistos (localStorage)
  const [viewedIds, setViewedIds] = useState<number[]>([]);

  // Página de la tabla (presentación: la lista de la pestaña ya llega entera).
  const [pagina, setPagina] = useState(1);

  // Pestañas configuración - "Sin Revisar" → "Por revisar"
  const tabs: { id: TabType; label: string }[] = [
    { id: 'pending', label: 'Por revisar' },
    { id: 'reviewing', label: 'En proceso' },
    { id: 'sent', label: 'Enviadas' },
    { id: 'discarded', label: 'Descartados' }
  ];

  useEffect(() => {
    // Cargar IDs vistos de localStorage
    const stored = getViewedCandidates();
    setViewedIds(stored);
    fetchJobData();
  }, [jobId]);

  const getViewedCandidates = (): number[] => {
    if (typeof window === 'undefined') return [];
    try {
      return JSON.parse(localStorage.getItem(VIEWED_CANDIDATES_KEY) || '[]');
    } catch {
      return [];
    }
  };

  const markAsViewed = (applicationId: number) => {
    if (typeof window === 'undefined') return;
    const viewed = getViewedCandidates();
    if (!viewed.includes(applicationId)) {
      viewed.push(applicationId);
      localStorage.setItem(VIEWED_CANDIDATES_KEY, JSON.stringify(viewed));
      setViewedIds(viewed);
    }
  };

  // `silencioso`: recarga sin pasar por el spinner de página completa (que
  // desmontaría el modal abierto), p. ej. tras agregar un documento.
  const fetchJobData = async (silencioso = false) => {
    try {
      if (!silencioso) setIsLoading(true);
      setLoadError(null);

      // ?jobId= para traer SOLO esta vacante: sin el filtro el endpoint
      // devolvía todas las asignaciones del reclutador con todas sus
      // postulaciones y el perfil completo de cada candidato.
      const response = await fetch(`/api/recruiter/dashboard?jobId=${encodeURIComponent(jobId)}`);

      if (response.status === 401) {
        router.push('/login?redirect=/recruiter/dashboard');
        return;
      }

      if (response.status === 403) {
        setLoadError('No tienes permisos de reclutador');
        return;
      }

      const data = await response.json();

      if (data.success) {
        // Buscar el assignment que corresponde a este jobId
        const foundAssignment = data.data.assignments.find(
          (a: AssignmentData) => a.jobId === parseInt(jobId)
        );

        if (foundAssignment) {
          setAssignment(foundAssignment);
          // PERF-016: el modal muestra `selectedApplication`; sin esto un
          // documento recién agregado no aparecía hasta cerrarlo y reabrirlo.
          setSelectedApplication((prev) =>
            prev
              ? (foundAssignment as AssignmentData).job.applications.find((a) => a.id === prev.id) ?? prev
              : prev
          );
        } else {
          setLoadError('No tienes acceso a esta vacante o no existe');
        }
      } else {
        setLoadError(data.error);
      }
    } catch (err) {
      setLoadError('Error de conexión');
    } finally {
      setIsLoading(false);
    }
  };

  // Filtrar applications por pestaña activa
  const filterApplicationsByTab = (applications: Application[]): Application[] => {
    switch (activeTab) {
      case 'pending':
        return applications.filter(app =>
          app.status === 'pending' || app.status === 'injected_by_admin'
        );
      case 'reviewing':
        return applications.filter(app => app.status === 'reviewing');
      case 'sent':
        return applications.filter(app => SENT_STATUSES.includes(app.status));
      case 'discarded':
        return applications.filter(app => app.status === 'discarded');
      default:
        return applications;
    }
  };

  // Contar applications por tab
  const getTabCount = (tab: TabType): number => {
    if (!assignment) return 0;
    const apps = assignment.job.applications;
    switch (tab) {
      case 'pending':
        return apps.filter(app =>
          app.status === 'pending' || app.status === 'injected_by_admin'
        ).length;
      case 'reviewing':
        return apps.filter(app => app.status === 'reviewing').length;
      case 'sent':
        return apps.filter(app => SENT_STATUSES.includes(app.status)).length;
      case 'discarded':
        return apps.filter(app => app.status === 'discarded').length;
      default:
        return 0;
    }
  };

  // Mover candidato a otro estado
  const handleMoveApplication = async (applicationId: number, newStatus: string) => {
    // Guardia local con la misma tabla que usa la API: si un botón pidiera una
    // transición imposible, se avisa en la alerta inline en vez de gastar un
    // round-trip que siempre acabaría en 400.
    const current = assignment?.job.applications.find((app) => app.id === applicationId);
    if (current && !canMove(current.status, newStatus)) {
      setActionError(`No se puede mover de "${current.status}" a "${newStatus}"`);
      return;
    }

    try {
      setActionLoading(applicationId);
      setActionError(null);

      const response = await fetch('/api/recruiter/dashboard', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updateApplicationId: applicationId,
          newApplicationStatus: newStatus
        })
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(data.message);
        // Actualización local en vez de volver a descargar la vacante entera
        // tras cada click (antes: spinner de pantalla completa y scroll perdido
        // en cada movimiento de candidato).
        setAssignment((prev) =>
          prev
            ? {
                ...prev,
                job: {
                  ...prev.job,
                  applications: prev.job.applications.map((app) =>
                    app.id === applicationId ? { ...app, status: newStatus } : app
                  )
                }
              }
            : prev
        );
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setActionError(data.error);
      }
    } catch (err) {
      setActionError('Error al actualizar');
    } finally {
      setActionLoading(null);
    }
  };

  const openApplicationProfile = (application: Application, candidatesList: Application[] = []) => {
    const index = candidatesList.findIndex(app => app.id === application.id);
    setSelectedApplication(application);
    setCurrentCandidatesList(candidatesList);
    setCurrentCandidateIndex(index >= 0 ? index : 0);
    setProfileModalOpen(true);

    // Marcar como visto
    markAsViewed(application.id);
  };

  const closeProfileModal = () => {
    setProfileModalOpen(false);
    setSelectedApplication(null);
    setCurrentCandidatesList([]);
    setCurrentCandidateIndex(0);
  };

  const goToNextCandidate = () => {
    if (currentCandidateIndex < currentCandidatesList.length - 1) {
      const nextIndex = currentCandidateIndex + 1;
      setCurrentCandidateIndex(nextIndex);
      setSelectedApplication(currentCandidatesList[nextIndex]);
      markAsViewed(currentCandidatesList[nextIndex].id);
    }
  };

  const goToPrevCandidate = () => {
    if (currentCandidateIndex > 0) {
      const prevIndex = currentCandidateIndex - 1;
      setCurrentCandidateIndex(prevIndex);
      setSelectedApplication(currentCandidatesList[prevIndex]);
      markAsViewed(currentCandidatesList[prevIndex].id);
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

  if (isLoading) {
    return <SkeletonPagina conCifras={false} />;
  }

  if (loadError || !assignment) {
    return (
      <>
        <PageHeader
          migas={[{ etiqueta: 'Panel', href: '/recruiter/dashboard' }, { etiqueta: 'Vacante' }]}
          antetitulo="Vacante asignada"
          titulo="No pudimos abrir la vacante"
        />
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-xl border border-danger/30 bg-danger-tint px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="flex items-center gap-2 text-sm font-medium text-danger-dark">
            <AlertCircle size={18} className="flex-none" aria-hidden="true" />
            {loadError || 'Vacante no encontrada'}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variante="contorno" tamano="sm" icono={RefreshCw} onClick={() => fetchJobData()}>
              Reintentar
            </Button>
            <Button variante="secundario" tamano="sm" icono={ArrowLeft} onClick={() => router.push('/recruiter/dashboard')}>
              Volver al panel
            </Button>
          </div>
        </div>
      </>
    );
  }

  const job = assignment.job;
  const filteredApps = filterApplicationsByTab(job.applications);
  const empresa = job.user?.companyRequest?.nombreEmpresa || job.company;
  const etiquetaPestana = tabs.find((t) => t.id === activeTab)?.label ?? '';
  const totalPaginas = Math.max(1, Math.ceil(filteredApps.length / FILAS_POR_PAGINA));
  const paginaActual = Math.min(pagina, totalPaginas);

  // Formación y experiencia de un candidato (se usan en su columna y, cuando
  // la tabla es estrecha y la columna se esconde, dentro de la celda principal).
  const formacion = (perfil?: CandidateProfile | null) =>
    perfil && (perfil.universidad || perfil.carrera || perfil.nivelEstudios) ? (
      <div className="min-w-0 text-[13px]">
        {perfil.universidad && (
          <p className="inline-flex items-center gap-1.5 text-ink">
            <GraduationCap size={14} className="flex-none text-ink-muted" aria-hidden="true" />
            {perfil.universidad}
          </p>
        )}
        {(perfil.carrera || perfil.nivelEstudios) && (
          <p className="mt-0.5 text-ink-muted">
            {[perfil.carrera, perfil.nivelEstudios].filter(Boolean).join(' · ')}
          </p>
        )}
      </div>
    ) : null;

  const experiencia = (perfil?: CandidateProfile | null) =>
    perfil &&
    ((perfil.añosExperiencia !== undefined && perfil.añosExperiencia > 0) ||
      perfil.profile ||
      perfil.seniority ||
      perfil.source) ? (
      <div className="min-w-0">
        <div className="flex flex-wrap gap-1">
          {perfil.añosExperiencia !== undefined && perfil.añosExperiencia > 0 && (
            <Badge tono="neutro" icono={Briefcase} tamano="sm">
              {perfil.añosExperiencia} {perfil.añosExperiencia === 1 ? 'año' : 'años'} exp.
            </Badge>
          )}
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
        {perfil.source && <p className="mt-1 text-xs text-ink-muted">Fuente: {perfil.source}</p>}
      </div>
    ) : null;

  const sinDato = (
    <span className="text-ink-muted" aria-label="Sin dato">
      —
    </span>
  );

  // ---------------------------------------------------------------------------
  // Columnas (declarativas: DataTable pinta y pasa a tarjetas en móvil)
  // ---------------------------------------------------------------------------
  const columnas: Columna<Application>[] = [
    {
      id: 'candidate',
      encabezado: 'Candidato',
      enTarjeta: 'titulo',
      className: 'min-w-[15rem]',
      celda: (app) => {
        const isUnseen = !viewedIds.includes(app.id);
        return (
          <div className="flex min-w-0 items-start gap-3">
            {/* FEAT-2: Foto de perfil del candidato */}
            <CandidatePhoto
              fotoUrl={app.candidateProfile?.fotoUrl}
              candidateName={app.candidateName}
              size="sm"
            />
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-semibold text-ink">{app.candidateName}</span>
                {isUnseen && (
                  <Badge tono="info" tamano="sm">
                    Sin ver
                  </Badge>
                )}
              </p>
              <p className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[13px] text-ink-muted">
                <span className="inline-flex min-w-0 items-center gap-1">
                  <Mail size={13} className="flex-none" aria-hidden="true" />
                  <span className="truncate">{app.candidateEmail}</span>
                </span>
                {app.candidatePhone && (
                  <span className="inline-flex items-center gap-1 tabular-nums">
                    <Phone size={13} className="flex-none" aria-hidden="true" />
                    {app.candidatePhone}
                  </span>
                )}
              </p>
              {/* Tabla estrecha: formación y perfil suben aquí (sus columnas se esconden). */}
              {(formacion(app.candidateProfile) || experiencia(app.candidateProfile)) && (
                <div data-solo-bajo="lg" className="mt-2 space-y-1.5">
                  {formacion(app.candidateProfile)}
                  {experiencia(app.candidateProfile)}
                </div>
              )}
            </div>
          </div>
        );
      },
    },
    {
      id: 'education',
      encabezado: 'Formación',
      ocultarBajo: 'lg',
      className: 'min-w-[11rem]',
      celda: (app) => formacion(app.candidateProfile) ?? sinDato,
    },
    {
      id: 'profile',
      encabezado: 'Perfil',
      ocultarBajo: 'lg',
      celda: (app) => experiencia(app.candidateProfile) ?? sinDato,
    },
    {
      id: 'actions',
      encabezado: 'Acciones',
      encabezadoOculto: true,
      alinear: 'fin',
      enTarjeta: 'completa',
      className: 'w-px whitespace-nowrap',
      celda: (app) => (
        // Sin flex-wrap: con w-px la celda toma el ancho mínimo del contenido,
        // y con wrap ese mínimo es el botón más ancho, así que cada acción caía
        // en su propia línea (filas de 133 px; en tarjeta, una columna de tres).
        // En una sola fila el ancho es el de las acciones juntas; en tarjeta
        // quedan alineadas al inicio porque la caja abraza su contenido.
        <div className="flex flex-nowrap items-center justify-end gap-1.5">
          {/* Ver perfil - siempre disponible */}
          <IconButton
            etiqueta={`Ver perfil de ${app.candidateName}`}
            icono={Eye}
            variante="contorno"
            tamano="sm"
            onClick={() => openApplicationProfile(app, filteredApps)}
          />

          {/* Acciones según pestaña */}
          {activeTab === 'pending' && (
            <>
              <Button
                variante="secundario"
                tamano="sm"
                icono={PlayCircle}
                cargando={actionLoading === app.id}
                onClick={() => handleMoveApplication(app.id, 'reviewing')}
                aria-label={`Revisar a ${app.candidateName}`}
                title="Iniciar revisión"
              >
                Revisar
              </Button>
              {/* Sin botón "Enviar": la API exige pasar por
                  'En proceso' (pending → sent_to_specialist no
                  es una transición permitida). */}
              <IconButton
                etiqueta={`Descartar a ${app.candidateName}`}
                icono={UserX}
                variante="peligro"
                tamano="sm"
                disabled={actionLoading === app.id}
                onClick={() => handleMoveApplication(app.id, 'discarded')}
              />
            </>
          )}

          {activeTab === 'reviewing' && (
            <>
              <Button
                variante="contorno"
                tamano="sm"
                icono={ArrowLeft}
                cargando={actionLoading === app.id}
                onClick={() => handleMoveApplication(app.id, 'pending')}
                aria-label={`Regresar a ${app.candidateName} a Por revisar`}
                title="Regresar a por revisar"
              >
                Regresar
              </Button>
              <Button
                variante="secundario"
                tamano="sm"
                icono={Send}
                cargando={actionLoading === app.id}
                disabled={!assignment.specialist}
                onClick={() => handleMoveApplication(app.id, 'sent_to_specialist')}
                aria-label={`Enviar a ${app.candidateName} al especialista`}
                title={assignment.specialist ? 'Enviar al especialista' : 'No hay especialista asignado'}
              >
                Enviar
              </Button>
              <IconButton
                etiqueta={`Descartar a ${app.candidateName}`}
                icono={UserX}
                variante="peligro"
                tamano="sm"
                disabled={actionLoading === app.id}
                onClick={() => handleMoveApplication(app.id, 'discarded')}
              />
            </>
          )}

          {activeTab === 'sent' && (
            /* Badge de sólo lectura con el estado REAL: a partir
               del envío mandan el especialista y la empresa. */
            <StatusBadge estado={app.status} etiqueta={SENT_STATUS_LABELS[app.status] || 'Enviado'} />
          )}

          {activeTab === 'discarded' && (
            <>
              <Button
                variante="contorno"
                tamano="sm"
                icono={RotateCcw}
                cargando={actionLoading === app.id}
                onClick={() => handleMoveApplication(app.id, 'pending')}
                aria-label={`Reactivar a ${app.candidateName}`}
                title="Reactivar candidato"
              >
                Reactivar
              </Button>
              <Button
                variante="contorno"
                tamano="sm"
                icono={PlayCircle}
                cargando={actionLoading === app.id}
                onClick={() => handleMoveApplication(app.id, 'reviewing')}
                aria-label={`Mover a ${app.candidateName} a En proceso`}
                title="Mover a en proceso"
              >
                En proceso
              </Button>
              {/* Sin botón "Enviar": desde 'Descartados' la API
                  sólo deja reactivar a 'pending' o 'reviewing'. */}
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        migas={[{ etiqueta: 'Panel', href: '/recruiter/dashboard' }, { etiqueta: job.title }]}
        antetitulo="Vacante asignada"
        titulo={job.title}
        descripcion={
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="inline-flex items-center gap-2 font-medium text-ink">
              <CompanyLogo logoUrl={job.user?.companyRequest?.logoUrl} companyName={empresa} size="xs" />
              {empresa}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin size={15} className="flex-none" aria-hidden="true" />
              {job.location}
            </span>
            <span className="flex flex-wrap gap-1">
              <Badge tono="neutro" sinPunto>
                {getWorkModeLabel(job.workMode)}
              </Badge>
              {job.profile && (
                <Badge tono="info" sinPunto>
                  {job.profile}
                </Badge>
              )}
              {job.seniority && (
                <Badge tono="neutro" sinPunto>
                  {job.seniority}
                </Badge>
              )}
            </span>
          </div>
        }
      />

      {/* Info del especialista */}
      {assignment.specialist ? (
        <p className="mb-5 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink shadow-ap-1">
          <UserCheck size={16} className="flex-none text-teal" aria-hidden="true" />
          <span className="text-ink-muted">Especialista:</span>
          <span className="font-medium">
            {assignment.specialist.nombre} {assignment.specialist.apellidoPaterno}
          </span>
          {assignment.specialist.specialty && (
            <Badge tono="info" sinPunto tamano="sm">
              {assignment.specialist.specialty}
            </Badge>
          )}
        </p>
      ) : (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-orange/40 bg-orange-tint px-4 py-3 text-sm text-orange-dark">
          <AlertTriangle size={18} className="mt-px flex-none" aria-hidden="true" />
          <p>
            <span className="font-semibold">Sin especialista asignado.</span> No podrás enviar candidatos
            hasta que el equipo de INAKAT asigne uno a esta vacante.
          </p>
        </div>
      )}

      {/* Avisos: fijos bajo la cabecera para que se vean desde cualquier fila.
          El error es role="alert" (se anuncia al momento); el éxito vive en
          una región polite que existe siempre, para que se anuncie al llegar. */}
      <div className="sticky top-16 z-20">
        {actionError && (
          <div
            role="alert"
            className="mb-4 flex items-start gap-3 rounded-xl border border-danger/30 bg-danger-tint px-4 py-3 text-sm font-medium text-danger-dark shadow-ap-2"
          >
            <AlertCircle size={18} className="mt-px flex-none" aria-hidden="true" />
            <p className="min-w-0 flex-1">{legible(actionError)}</p>
            <IconButton
              etiqueta="Cerrar aviso"
              icono={X}
              tamano="sm"
              onClick={() => setActionError(null)}
              className="-my-1.5 -mr-1.5 text-danger-dark hover:bg-danger/10"
            />
          </div>
        )}

        <div aria-live="polite">
          {success && (
            <p className="mb-4 flex items-center gap-2 rounded-xl border border-lime/50 bg-lime-tint px-4 py-3 text-sm font-medium text-lime-dark shadow-ap-2">
              <CheckCircle size={18} className="flex-none" aria-hidden="true" />
              {legible(success)}
            </p>
          )}
        </div>
      </div>

      {/* Candidatos por etapa */}
      <Card sinRelleno>
        <div className="border-b border-line px-2 sm:px-4">
          <Tabs
            idBase="etapas"
            etiqueta="Etapas de la vacante"
            activa={activeTab}
            alCambiar={(id) => {
              setActiveTab(id as TabType);
              setPagina(1);
            }}
            pestanas={tabs.map((tab) => ({ id: tab.id, etiqueta: tab.label, contador: getTabCount(tab.id) }))}
            className="border-b-0"
          />
        </div>

        <PanelPestana idBase="etapas" id={activeTab} activa={activeTab} className="pt-0">
          <p className="border-b border-line bg-paper/60 px-5 py-2.5 text-[13px] text-ink-muted">
            {AYUDA_PESTANA[activeTab]}
          </p>
          <DataTable
            etiqueta={`Candidatos: ${etiquetaPestana}`}
            columnas={columnas}
            filas={filteredApps.slice((paginaActual - 1) * FILAS_POR_PAGINA, paginaActual * FILAS_POR_PAGINA)}
            claveFila={(app) => app.id}
            alActivarFila={(app) => openApplicationProfile(app, filteredApps)}
            paginacion={paginacionLocal(filteredApps.length, paginaActual, FILAS_POR_PAGINA)}
            alCambiarPagina={setPagina}
            etiquetaTotal="candidatos"
            vacio={
              <EmptyState
                frase={FRASE_VACIO[activeTab]}
                titulo={`No hay candidatos en «${etiquetaPestana}»`}
              />
            }
          />
        </PanelPestana>
      </Card>

      {/* Modal de perfil de candidato */}
      <CandidateProfileModal
        application={selectedApplication}
        candidate={null}
        isOpen={profileModalOpen}
        onClose={closeProfileModal}
        showRecruiterNotes={false}
        onNext={currentCandidatesList.length > 1 ? goToNextCandidate : undefined}
        onPrev={currentCandidatesList.length > 1 ? goToPrevCandidate : undefined}
        currentIndex={currentCandidateIndex}
        totalCount={currentCandidatesList.length}
        /* PERF-016: el modal hace POST a /api/evaluations/candidates/[id]/documents,
           que comprueba que el reclutador tenga asignada una vacante con este
           candidato (antes iba a /api/admin/... y siempre daba 403). */
        canAddDocuments={true}
        onDocumentsUpdated={() => fetchJobData(true)}
        userRole="recruiter"
        jobLatitude={job?.latitude}
        jobLongitude={job?.longitude}
      />
    </>
  );
}
