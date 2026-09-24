// RUTA: src/components/company/CompanyJobsTable.tsx
'use client';

/**
 * «Mis vacantes» del panel de empresa: pestañas por estado + DataTable.
 *
 * La lógica es la de siempre (qué vacante cae en qué pestaña, cuándo se puede
 * editar, qué acción aparece con cada estado); cambió la presentación:
 * - pestañas del sistema (Tabs, con flechas) en vez de botones sueltos;
 * - tabla con orden y paginación en el cliente, que en móvil pasa a tarjetas;
 * - la acción del estado (Publicar, Reanudar) a la vista, «Ver» como icono y
 *   el resto (Editar, Pausar, cerrar) en el menú «⋯» de la fila.
 */

import { useState } from 'react';
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Clock,
  Eye,
  Pause,
  Pencil,
  Play,
  Plus,
  Send,
  Users,
} from 'lucide-react';
import Card from '@/components/ui/Card';
import Tabs, { PanelPestana } from '@/components/ui/Tabs';
import DataTable, { type Columna, type OrdenTabla } from '@/components/ui/DataTable';
import StatusBadge, { Badge } from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import IconButton from '@/components/ui/IconButton';
import EmptyState from '@/components/ui/EmptyState';
import { paginacionLocal } from '@/components/ui/Pagination';
import MenuAcciones, { type OpcionMenu } from '@/components/ui/MenuAcciones';
import { fechaCorta } from '@/lib/fechas';
import { etiquetaTipoTrabajo } from '@/lib/tipos-trabajo';

interface Job {
  id: number;
  title: string;
  location: string;
  salary: string;
  status: string;
  closedReason?: string; // 'success' | 'cancelled'
  jobType: string;
  workMode: string;
  createdAt: string;
  expiresAt?: string;
  editableUntil?: string; // Límite de 4 horas para editar
  applicationCount?: number;
  _count?: {
    applications: number;
  };
}

interface CompanyJobsTableProps {
  jobs: Job[];
  onEdit?: (jobId: number) => void;
  onView?: (jobId: number) => void;
  onClose?: (jobId: number, reason: 'success' | 'cancelled') => void;
  onPause?: (jobId: number) => void;
  onResume?: (jobId: number) => void;
  onViewCandidates?: (jobId: number, jobTitle: string) => void;
  onPublish?: (jobId: number) => void;
  /** Candidatos por revisar de cada vacante (jobId → cuántos), de jobStats del panel. */
  porRevisar?: Record<number, number>;
  /** Acción del estado vacío: publicar una vacante. */
  onCreate?: () => void;
}

type JobTab = 'active' | 'paused' | 'expired' | 'draft' | 'closed';

/** Filas por página. */
const POR_PAGINA = 20;

const MODALIDAD: Record<string, string> = { remote: 'Remoto', hybrid: 'Híbrido' };
const modalidad = (workMode: string) => MODALIDAD[workMode] ?? 'Presencial';

// Estado vacío de cada pestaña. OJO: ningún texto repite «Activas» (la prueba
// e2e del panel busca ese texto y debe encontrar sólo la pestaña).
const VACIOS: Record<JobTab, { titulo: string; descripcion: string }> = {
  active: {
    titulo: 'No tienes vacantes publicadas',
    descripcion: 'Cuando publiques una vacante, aparecerá aquí con sus candidatos.',
  },
  paused: {
    titulo: 'No tienes vacantes en pausa',
    descripcion: 'Una vacante en pausa deja de recibir candidatos hasta que la reanudes.',
  },
  expired: {
    titulo: 'No tienes vacantes expiradas',
    descripcion: 'Las vacantes que pasen su fecha de expiración aparecerán aquí.',
  },
  draft: {
    titulo: 'No tienes borradores',
    descripcion: 'Los borradores se guardan sin gastar créditos; los publicas cuando quieras.',
  },
  closed: {
    titulo: 'Aún no has cerrado ninguna vacante',
    descripcion: 'Aquí quedan las vacantes cerradas por contratación o canceladas.',
  },
};

export default function CompanyJobsTable({
  jobs,
  onEdit,
  onView,
  onClose,
  onPause,
  onResume,
  onViewCandidates,
  onPublish,
  porRevisar,
  onCreate,
}: CompanyJobsTableProps) {
  const [activeTab, setActiveTab] = useState<JobTab>('active');
  // Presentación: orden y página de la tabla (la API ya las manda por fecha, desc).
  const [orden, setOrden] = useState<OrdenTabla>({ columna: 'createdAt', direccion: 'desc' });
  const [pagina, setPagina] = useState(1);

  // Determinar si un job está expirado
  const isExpired = (job: Job) => {
    if (!job.expiresAt) return false;
    return new Date(job.expiresAt) <= new Date() && job.status === 'active';
  };

  // Determinar si aún se puede editar (dentro de 4 horas)
  const canEdit = (job: Job) => {
    // Borradores siempre son editables
    if (job.status === 'draft') return true;
    // Vacantes activas: verificar tiempo límite
    if (!job.editableUntil) return true;
    return new Date(job.editableUntil) > new Date();
  };

  // Obtener tiempo restante para editar
  const getEditTimeRemaining = (job: Job) => {
    // No mostrar contador para borradores
    if (job.status === 'draft') return null;
    if (!job.editableUntil) return null;
    const now = new Date();
    const editableUntil = new Date(job.editableUntil);
    const diff = editableUntil.getTime() - now.getTime();
    if (diff <= 0) return null;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) return `${hours}h ${minutes}m para editar`;
    return `${minutes}m para editar`;
  };

  // Categorizar jobs.
  //
  // La pestaña 'Expiradas' está comentada (ver más abajo), así que 'Activas'
  // NO puede excluir las expiradas: una vacante activa con expiresAt vencido
  // no aparecía en ninguna pestaña aunque contara en el total, y la empresa no
  // podía verla, pausarla ni cerrarla. El badge ya la marca como «Expirada».
  const categorizedJobs = {
    active: jobs.filter(job => job.status === 'active'),
    paused: jobs.filter(job => job.status === 'paused'),
    expired: jobs.filter(job => isExpired(job)),
    draft: jobs.filter(job => job.status === 'draft'),
    closed: jobs.filter(job => job.status === 'closed')
  };

  const filteredJobs = categorizedJobs[activeTab];

  const tabs: { key: JobTab; label: string; count: number }[] = [
    { key: 'active', label: 'Activas', count: categorizedJobs.active.length },
    { key: 'paused', label: 'En pausa', count: categorizedJobs.paused.length },
    // { key: 'expired', label: 'Expiradas', count: categorizedJobs.expired.length }, // TODO: Habilitar cuando se implemente expiración automática
    { key: 'draft', label: 'Borradores', count: categorizedJobs.draft.length },
    { key: 'closed', label: 'Cerradas', count: categorizedJobs.closed.length }
  ];

  const getApplicationCount = (job: Job) => {
    return job.applicationCount ?? job._count?.applications ?? 0;
  };

  // Fecha corta del panel (src/lib/fechas): «23 sep 2026».
  const formatDate = (dateString: string) => fechaCorta(dateString);

  // Estado con color Y texto. Los casos propios de la empresa (expirada,
  // cerrada por contratación o cancelada) llevan su etiqueta e icono.
  const getStatusBadge = (job: Job) => {
    if (isExpired(job)) {
      return (
        <Badge tono="aviso" icono={AlertTriangle}>
          Expirada
        </Badge>
      );
    }
    if (job.status === 'closed') {
      return job.closedReason === 'success' ? (
        <Badge tono="exito" icono={CheckCircle2}>
          Contratación exitosa
        </Badge>
      ) : (
        <Badge tono="neutro" icono={Ban}>
          Cancelada
        </Badge>
      );
    }
    const etiquetas: Record<string, string> = { active: 'Activa', paused: 'En pausa', draft: 'Borrador' };
    const estado = etiquetas[job.status] ? job.status : 'draft';
    return <StatusBadge estado={estado} etiqueta={etiquetas[estado]} />;
  };

  // ---------------------------------------------------------------------------
  // Orden y página (presentación)
  // ---------------------------------------------------------------------------
  const ordenarPor = (columna: string) => {
    setOrden((o) =>
      o.columna === columna
        ? { columna, direccion: o.direccion === 'asc' ? 'desc' : 'asc' }
        : { columna, direccion: columna === 'title' ? 'asc' : 'desc' }
    );
    setPagina(1);
  };

  const ordenadas = [...filteredJobs].sort((a, b) => {
    let comparacion = 0;
    if (orden.columna === 'title') comparacion = a.title.localeCompare(b.title, 'es');
    else if (orden.columna === 'candidatos') comparacion = getApplicationCount(a) - getApplicationCount(b);
    else comparacion = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    return orden.direccion === 'asc' ? comparacion : -comparacion;
  });
  const filas = ordenadas.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);

  const cambiarPestana = (id: string) => {
    setActiveTab(id as JobTab);
    setPagina(1);
  };

  // ---------------------------------------------------------------------------
  // Acciones de cada fila (mismas condiciones que antes)
  // ---------------------------------------------------------------------------
  const opcionesDe = (job: Job): OpcionMenu[] => {
    const opciones: OpcionMenu[] = [];
    if (onEdit && job.status !== 'closed' && canEdit(job)) {
      opciones.push({
        id: 'editar',
        etiqueta: 'Editar',
        icono: Pencil,
        detalle: getEditTimeRemaining(job) ?? undefined,
        alElegir: () => onEdit(job.id),
      });
    }
    if (onPause && job.status === 'active' && !isExpired(job)) {
      opciones.push({ id: 'pausar', etiqueta: 'Pausar', icono: Pause, alElegir: () => onPause(job.id) });
    }
    if (onClose && (job.status === 'active' || job.status === 'paused')) {
      opciones.push(
        {
          id: 'exitosa',
          etiqueta: 'Cerrar: contratación exitosa',
          icono: CheckCircle2,
          detalle: 'Encontraste a la persona que buscabas',
          alElegir: () => onClose(job.id, 'success'),
        },
        {
          id: 'cancelar',
          etiqueta: 'Cancelar vacante',
          icono: Ban,
          detalle: 'Se cierra sin haber contratado',
          peligro: true,
          alElegir: () => onClose(job.id, 'cancelled'),
        }
      );
    }
    return opciones;
  };

  const columnas: Columna<Job>[] = [
    {
      id: 'title',
      encabezado: 'Vacante',
      ordenable: true,
      enTarjeta: 'titulo',
      className: 'min-w-[13rem]',
      celda: (job) => {
        const restante = getEditTimeRemaining(job);
        return (
          <div className="min-w-0">
            <p className="font-semibold leading-snug text-ink">{job.title}</p>
            <p className="mt-0.5 text-[13px] text-ink-muted">
              {job.location}
              <span className="mx-1.5" aria-hidden="true">·</span>
              {modalidad(job.workMode)}
            </p>
            {/* La columna «Creada» se esconde en tablas estrechas: el aviso de
                edición sube aquí mientras tanto. */}
            {restante && (
              <p data-solo-bajo="md" className="mt-1 flex items-center gap-1 text-xs font-medium text-orange-dark">
                <Clock className="h-3 w-3" aria-hidden="true" />
                {restante}
              </p>
            )}
          </div>
        );
      },
    },
    // Móvil: la tarjeta es la vacante (con su ciudad y modalidad) + UNA línea
    // «estado · candidatos · fecha» y el salario; los iconos arriba a la
    // derecha. ~150 px por vacante en vez de ~250 con un par por columna.
    {
      id: 'status',
      encabezado: 'Estado',
      enTarjeta: 'meta',
      className: 'whitespace-nowrap',
      celda: (job) => getStatusBadge(job),
    },
    {
      id: 'candidatos',
      encabezado: 'Candidatos',
      ordenable: true,
      enTarjeta: 'meta',
      // La cifra y «N por revisar» en UNA línea: apiladas, la fila pasaba de
      // 87 px (/company/dashboard). Con la tabla estrecha se esconden otras
      // columnas antes (Salario, Creada), así que cabe.
      unaLinea: true,
      celda: (job) => {
        const total = getApplicationCount(job);
        const nuevos = porRevisar?.[job.id] ?? 0;
        return (
          <div className="flex flex-nowrap items-center gap-2">
            <button
              type="button"
              onClick={() => onViewCandidates?.(job.id, job.title)}
              className="group inline-flex h-8 items-center gap-1.5 rounded-full bg-teal-tint px-3 font-display text-sm font-semibold tabular-nums text-teal-dark transition-colors duration-150 hover:bg-teal hover:text-white"
              title="Ver candidatos de esta vacante"
              aria-label={`Ver candidatos de ${job.title}: ${total}`}
            >
              <Users className="h-3.5 w-3.5" aria-hidden="true" />
              {total}
            </button>
            {nuevos > 0 && (
              <Badge tono="aviso" tamano="sm">
                {nuevos} por revisar
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      id: 'salary',
      encabezado: 'Salario',
      ocultarBajo: 'xl',
      // El rango en un solo renglón: partido, «MXN» caía solo en la línea de
      // abajo. En la tarjeta de móvil sí puede partir (lo decide DataTable).
      unaLinea: true,
      celda: (job) => (
        <div className="min-w-0">
          <p className="tabular-nums text-ink">{job.salary}</p>
          <p className="text-xs text-ink-muted">{etiquetaTipoTrabajo(job.jobType)}</p>
        </div>
      ),
    },
    {
      id: 'createdAt',
      encabezado: 'Creada',
      ordenable: true,
      ocultarBajo: 'md',
      enTarjeta: 'meta',
      className: 'whitespace-nowrap',
      celda: (job) => {
        const restante = getEditTimeRemaining(job);
        return (
          <div>
            <p className="tabular-nums text-ink">{formatDate(job.createdAt)}</p>
            {restante && (
              <p className="mt-1 flex items-center gap-1 text-xs font-medium text-orange-dark">
                <Clock className="h-3 w-3" aria-hidden="true" />
                {restante}
              </p>
            )}
          </div>
        );
      },
    },
    {
      id: 'acciones',
      encabezado: 'Acciones',
      encabezadoOculto: true,
      alinear: 'fin',
      // En la tarjeta: los iconos (Ver, «⋯») arriba a la derecha; con
      // «Publicar» o «Reanudar» (botones con texto) DataTable los baja al pie.
      enTarjeta: 'acciones',
      className: 'w-px whitespace-nowrap',
      celda: (job) => (
        // Sin flex-wrap: con w-px la columna tomaría el ancho del botón más
        // ancho y apilaría las acciones.
        <div className="flex items-center justify-end gap-1">
          {/* Publicar borrador */}
          {onPublish && job.status === 'draft' && (
            <Button variante="secundario" tamano="sm" icono={Send} onClick={() => onPublish(job.id)}>
              Publicar
            </Button>
          )}
          {onResume && job.status === 'paused' && (
            <Button variante="contorno" tamano="sm" icono={Play} onClick={() => onResume(job.id)}>
              Reanudar
            </Button>
          )}
          {onView && (
            <IconButton etiqueta={`Ver detalle de ${job.title}`} icono={Eye} tamano="sm" onClick={() => onView(job.id)} />
          )}
          <MenuAcciones etiqueta={`Más acciones para ${job.title}`} opciones={opcionesDe(job)} />
        </div>
      ),
    },
  ];

  const vacio = VACIOS[activeTab];

  return (
    <Card
      titulo="Mis vacantes"
      descripcion={`${jobs.length} ${jobs.length === 1 ? 'vacante' : 'vacantes'} en total`}
      sinRelleno
    >
      <Tabs
        idBase="vacantes"
        etiqueta="Vacantes por estado"
        activa={activeTab}
        alCambiar={cambiarPestana}
        pestanas={tabs.map((tab) => ({ id: tab.key, etiqueta: tab.label, contador: tab.count }))}
        className="px-3"
      />
      <PanelPestana idBase="vacantes" id={activeTab} activa={activeTab} className="pt-0">
        <DataTable
          // Sin repetir «Mis vacantes» ni el nombre de la pestaña: la prueba e2e
          // del panel exige que esos textos aparezcan una sola vez.
          etiqueta="Vacantes de la pestaña elegida"
          columnas={columnas}
          filas={filas}
          claveFila={(job) => job.id}
          orden={orden}
          alOrdenar={ordenarPor}
          alActivarFila={onView ? (job) => onView(job.id) : undefined}
          paginacion={paginacionLocal(ordenadas.length, pagina, POR_PAGINA)}
          alCambiarPagina={setPagina}
          etiquetaTotal="vacantes"
          vacio={
            <EmptyState
              frase="Todavía nada por aquí."
              titulo={vacio.titulo}
              descripcion={vacio.descripcion}
              accion={
                onCreate && (activeTab === 'active' || activeTab === 'draft') ? (
                  <Button variante="contorno" tamano="sm" icono={Plus} onClick={onCreate}>
                    Publicar vacante
                  </Button>
                ) : undefined
              }
            />
          }
        />
      </PanelPestana>
    </Card>
  );
}
