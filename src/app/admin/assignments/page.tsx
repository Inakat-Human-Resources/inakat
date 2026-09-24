// RUTA: src/app/admin/assignments/page.tsx

'use client';

/**
 * Asignar equipo: el admin reparte reclutador y especialista a cada vacante
 * activa (POST /api/admin/assignments, una fila cada vez).
 *
 * Registro de APLICACIÓN (docs/DISENO.md): PageHeader → tarjeta con pestañas
 * que filtran por estado del equipo (con sus cifras) → DataTable, que en móvil
 * pasa a tarjetas. La lógica —qué se pide, cómo se conservan los cambios sin
 * guardar de otras filas al guardar una (ADM-014), el reclutador desactivado
 * (ADM-015), retirar el equipo con confirmación (ADM-058)— es la de siempre;
 * sólo cambió la presentación.
 */

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  AlertTriangle,
  Building2,
  CheckCircle2,
  Clock,
  MapPin,
  RefreshCw,
  UserCheck,
  UserCog,
  Users,
  type LucideIcon
} from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import DataTable, { type Columna } from '@/components/ui/DataTable';
import StatusBadge, { Badge, type TonoBadge } from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import Button from '@/components/ui/Button';
import Tabs, { PanelPestana } from '@/components/ui/Tabs';
import Toast, { useAvisos } from '@/components/ui/Toast';
import { Select } from '@/components/ui/FormField';
import { SkeletonPagina } from '@/components/ui/Skeleton';
import { cn } from '@/lib/utils';

interface Job {
  id: number;
  title: string;
  company: string;
  location: string;
  profile: string;
  seniority: string;
  status: string;
  createdAt: string;
  user: {
    nombre: string;
    companyRequest?: {
      nombreEmpresa: string;
    };
  };
  assignment?: Assignment;
  _count?: {
    applications: number;
  };
}

interface Assignment {
  id: number;
  jobId: number;
  recruiterId: number | null;
  specialistId: number | null;
  recruiterStatus: string;
  specialistStatus: string;
  recruiter?: {
    id: number;
    nombre: string;
    apellidoPaterno: string;
    email: string;
  };
  specialist?: {
    id: number;
    nombre: string;
    apellidoPaterno: string;
    email: string;
    specialty: string;
  };
}

interface Person {
  id: number;
  nombre: string;
  apellidoPaterno?: string;
  email: string;
  specialty?: string;
}

interface Stats {
  total: number;
  unassigned: number;
  // ADM-029: vacantes con sólo reclutador o sólo especialista. No caían ni en
  // "Sin Asignar" ni en "Asignadas".
  partial?: number;
  assigned: number;
  inProgress: number;
  completed: number;
}

type Seleccion = { recruiterId?: number; specialistId?: number };
type Selecciones = { [jobId: number]: Seleccion };

/** Lo que el servidor tiene guardado para cada vacante. */
const seleccionesDelServidor = (lista: Job[]): Selecciones => {
  const resultado: Selecciones = {};
  lista.forEach((job) => {
    if (job.assignment) {
      resultado[job.id] = {
        recruiterId: job.assignment.recruiterId || undefined,
        specialistId: job.assignment.specialistId || undefined
      };
    }
  });
  return resultado;
};

/** Filtros por estado del equipo (los mismos valores que acepta la API). */
const FILTROS: Array<{ value: string; label: string; cifra: (s: Stats) => number }> = [
  { value: 'all', label: 'Todas', cifra: (s) => s.total },
  { value: 'unassigned', label: 'Sin asignar', cifra: (s) => s.unassigned },
  { value: 'partial', label: 'Incompletas', cifra: (s) => s.partial ?? 0 },
  { value: 'assigned', label: 'Asignadas', cifra: (s) => s.assigned },
  { value: 'in_progress', label: 'En proceso', cifra: (s) => s.inProgress },
  { value: 'completed', label: 'Completadas', cifra: (s) => s.completed }
];

/** «3 reclutadores» / «1 reclutador». */
const cuantos = (n: number, singular: string, plural: string) => `${n} ${n === 1 ? singular : plural}`;

type EstadoEquipo = 'unassigned' | 'partial' | 'assigned' | 'in_progress' | 'completed';

/**
 * En qué pestaña cae una vacante: el MISMO criterio, en el mismo orden, que
 * `estadoDeAsignacion` de GET /api/admin/assignments (el que filtra y cuenta
 * las pestañas). Así la insignia de cada fila dice el nombre de su pestaña y
 * no un segundo vocabulario («Asignado», «Con reclutador»…) para lo mismo.
 * Sólo decide qué se PINTA; el filtro lo sigue haciendo la API.
 */
const estadoDeEquipo = (a: Assignment | undefined): EstadoEquipo => {
  if (!a || (!a.recruiterId && !a.specialistId)) return 'unassigned';
  if (a.specialistStatus === 'sent_to_company') return 'completed';
  if (
    a.recruiterStatus === 'reviewing' ||
    a.recruiterStatus === 'sent_to_specialist' ||
    a.specialistStatus === 'evaluating'
  ) {
    return 'in_progress';
  }
  if (a.recruiterId && a.specialistId) return 'assigned';
  return 'partial';
};

/** Tono e icono de cada estado (el texto es la etiqueta de su pestaña, FILTROS). */
const ASPECTO_EQUIPO: Record<EstadoEquipo, { tono: TonoBadge; icono?: LucideIcon }> = {
  unassigned: { tono: 'peligro' },
  partial: { tono: 'aviso', icono: AlertTriangle },
  assigned: { tono: 'neutro', icono: Clock },
  in_progress: { tono: 'info' },
  completed: { tono: 'exito', icono: CheckCircle2 }
};

/**
 * La tabla pasa a tarjetas cuando la TABLA mide menos de 600 px (container
 * query «ap-tabla» de app.css). Clases que sólo valen en uno de los dos modos:
 * - el w-px que ciñe la columna de acciones es de la TABLA: en la tarjeta (una
 *   rejilla) dejaba la columna en 1 px y el botón «Guardar», alineado al final,
 *   se montaba sobre la empresa, la ciudad y los candidatos;
 * - en la tarjeta, «Guardar» va al pie, a todo el ancho;
 * - los selects sólo se ensanchan cuando la tabla tiene sitio (a 1024 px de
 *   ventana la tabla mide ~710 px y no debe desplazarse de lado).
 */
const SOLO_EN_TABLA_CENIDA = '[@container_ap-tabla_(min-width:600px)]:w-px';
const EN_TARJETA_A_LO_ANCHO = '[@container_ap-tabla_(max-width:599.98px)]:mt-1.5 [@container_ap-tabla_(max-width:599.98px)]:w-full';
const ANCHO_SELECT =
  'min-w-[10rem] [@container_ap-tabla_(min-width:960px)]:min-w-[12.5rem] [@container_ap-tabla_(min-width:1100px)]:min-w-[16rem]';

export default function AssignmentsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [recruiters, setRecruiters] = useState<Person[]>([]);
  const [specialists, setSpecialists] = useState<Person[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  // Filtro
  const [statusFilter, setStatusFilter] = useState('all');

  // Selecciones temporales para asignar
  const [selections, setSelections] = useState<Selecciones>({});
  const [savingJobId, setSavingJobId] = useState<number | null>(null);

  // Última foto de lo que hay guardado, para saber qué filas tienen cambios
  // sin guardar.
  const guardadoEnServidor = useRef<Selecciones>({});

  useEffect(() => {
    fetchAssignments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  /**
   * ADM-014: cada fila tiene su propio botón Guardar, pero tras guardar se
   * recargaba todo con el spinner de página completa y las selecciones se
   * reconstruían desde el servidor: los cambios pendientes de las OTRAS filas
   * se perdían y el admin tenía que rehacerlos. Ahora la recarga posterior a
   * guardar no bloquea la pantalla y las filas con cambios sin guardar
   * conservan lo que el admin eligió.
   */
  const fetchAssignments = async (
    opciones: { silencioso?: boolean; recienGuardada?: number } = {}
  ) => {
    try {
      if (!opciones.silencioso) setIsLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      const response = await fetch(`/api/admin/assignments?${params}`);
      const data = await response.json();

      if (data.success) {
        setJobs(data.data);
        setRecruiters(data.recruiters);
        setSpecialists(data.specialists);
        setStats(data.stats);

        const anterior = guardadoEnServidor.current;
        const nuevas = seleccionesDelServidor(data.data);
        guardadoEnServidor.current = nuevas;

        setSelections((previas) => {
          const resultado: Selecciones = { ...nuevas };
          for (const [clave, seleccion] of Object.entries(previas)) {
            const jobId = Number(clave);
            if (jobId === opciones.recienGuardada) continue;
            const base = anterior[jobId] || {};
            const tieneCambios =
              seleccion.recruiterId !== base.recruiterId ||
              seleccion.specialistId !== base.specialistId;
            if (tieneCambios) resultado[jobId] = seleccion;
          }
          return resultado;
        });
      } else {
        setError(data.error || 'Error al cargar');
      }
    } catch (err) {
      setError('Error de conexión');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * ADM-015: si el reclutador/especialista guardado ya no está entre los
   * activos, el select mostraba "Sin asignar" pero el estado conservaba su id y
   * se reenviaba al guardar. Se pinta como opción propia, marcada, para que el
   * admin vea que hay que sustituirlo.
   *
   * Presentación: el aviso ya no va en el texto de la opción (el select lo
   * recortaba justo ahí: «Laura Benítez (desactivado: reasi…»). La opción
   * lleva sólo el nombre, dentro de un grupo «Desactivado» en la lista
   * desplegada, y junto al select sale la insignia «Desactivado · reasigna»
   * (enlazada al select con aria-describedby).
   */
  const estaFuera = (idSeleccionado: number | undefined, lista: Person[]) =>
    !!idSeleccionado && !lista.some((p) => p.id === idSeleccionado);

  const opcionFuera = (
    persona: { id: number; nombre: string; apellidoPaterno?: string } | undefined,
    idSeleccionado: number | undefined,
    lista: Person[]
  ) => {
    if (!idSeleccionado || !estaFuera(idSeleccionado, lista)) return null;
    const nombre = persona && persona.id === idSeleccionado
      ? `${persona.nombre} ${persona.apellidoPaterno || ''}`.trim()
      : `Usuario #${idSeleccionado}`;
    return (
      <optgroup label="Desactivado">
        <option value={idSeleccionado}>{nombre}</option>
      </optgroup>
    );
  };

  const handleSaveAssignment = async (jobId: number) => {
    const selection = selections[jobId] || {};
    if (!selection.recruiterId && !selection.specialistId) {
      // ADM-058: con ambos en "Sin asignar" no se podía guardar nunca, así que
      // una asignación hecha por error sólo podía sustituirse, no retirarse. Si
      // la vacante ya tiene equipo guardado, se permite quitarlo (la API acepta
      // ambos en null), previa confirmación.
      const guardado = guardadoEnServidor.current[jobId];
      if (!guardado?.recruiterId && !guardado?.specialistId) {
        setError('Selecciona al menos un reclutador o especialista');
        return;
      }
      if (!window.confirm('¿Quitar el reclutador y el especialista asignados a esta vacante?')) {
        return;
      }
    }

    try {
      setSavingJobId(jobId);
      setError(null);
      setWarning(null);

      const response = await fetch('/api/admin/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId,
          recruiterId: selection.recruiterId || null,
          specialistId: selection.specialistId || null
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSuccess('Asignación guardada');
        fetchAssignments({ silencioso: true, recienGuardada: jobId });
        setTimeout(() => setSuccess(null), 3000);

        // Mostrar warning si existe (especialidad no coincide)
        if (data.warning) {
          setWarning(data.warning);
          setTimeout(() => setWarning(null), 8000);
        }
      } else {
        setError(data.error || 'Error al guardar la asignación');
      }
    } catch (err) {
      setError('Error al guardar');
    } finally {
      setSavingJobId(null);
    }
  };

  // ---------------------------------------------------------------------------
  // Presentación (nada de lo que sigue pide datos ni cambia qué se envía)
  // ---------------------------------------------------------------------------
  const { avisar } = useAvisos();

  // Se guarda fila a fila, muchas veces lejos de la cabecera: el «guardado» y
  // la advertencia de especialidad salen como avisos flotantes.
  useEffect(() => {
    if (success) avisar({ tono: 'exito', mensaje: success, duracion: 3000 });
  }, [success, avisar]);
  useEffect(() => {
    if (warning) avisar({ tono: 'aviso', titulo: 'Especialidad distinta', mensaje: warning, duracion: 8000 });
  }, [warning, avisar]);

  /** ¿La fila tiene una elección distinta de la guardada? */
  const tieneCambios = (jobId: number) => {
    const seleccion = selections[jobId] || {};
    const base = guardadoEnServidor.current[jobId] || {};
    return seleccion.recruiterId !== base.recruiterId || seleccion.specialistId !== base.specialistId;
  };
  const filasConCambios = jobs.filter((j) => tieneCambios(j.id)).length;

  const empresaDe = (job: Job) => job.user?.companyRequest?.nombreEmpresa || job.company;

  const getJobStatusBadge = (status: string) => (
    <StatusBadge estado={status} contexto="vacante" tamano="sm" />
  );

  /**
   * Estado del equipo de una fila: color, icono (o punto) y TEXTO, que es el
   * nombre de la pestaña en la que cae (ADM-029: mismo criterio que el filtro
   * y las cifras de la API). «En proceso» dice debajo con quién está.
   */
  const getAssignmentStatusBadge = (job: Job, enLinea = false) => {
    const estado = estadoDeEquipo(job.assignment);
    const etiqueta = FILTROS.find((f) => f.value === estado)?.label ?? estado;
    const conEspecialista =
      job.assignment?.recruiterStatus === 'sent_to_specialist' ||
      job.assignment?.specialistStatus === 'evaluating';
    const { tono } = ASPECTO_EQUIPO[estado];
    const Icono =
      estado === 'in_progress' ? (conEspecialista ? UserCog : UserCheck) : ASPECTO_EQUIPO[estado].icono;
    return (
      <span className={cn('inline-flex items-start gap-x-2 gap-y-1', enLinea ? 'flex-wrap items-center' : 'flex-col')}>
        <Badge tono={tono} icono={Icono} tamano="sm">
          {etiqueta}
        </Badge>
        {estado === 'in_progress' && (
          <span className="text-xs text-ink-muted">
            {conEspecialista ? 'con el especialista' : 'con el reclutador'}
          </span>
        )}
      </span>
    );
  };

  /** Especialistas agrupados por especialidad (grupos de la lista desplegada). */
  const gruposEspecialistas = specialists.reduce<Array<{ nombre: string; personas: Person[] }>>((grupos, s) => {
    const nombre = s.specialty || 'Sin especialidad';
    const grupo = grupos.find((g) => g.nombre === nombre);
    if (grupo) grupo.personas.push(s);
    else grupos.push({ nombre, personas: [s] });
    return grupos;
  }, []);

  /** Especialidad de quien está elegido en la fila (activo o desactivado). */
  const especialidadElegida = (job: Job): string | null => {
    const id = selections[job.id]?.specialistId;
    if (!id) return null;
    const activo = specialists.find((s) => s.id === id);
    if (activo) return activo.specialty || null;
    return job.assignment?.specialist?.id === id ? job.assignment.specialist.specialty || null : null;
  };

  /** Insignia bajo un select cuyo elegido ya no está activo. */
  const avisoDesactivado = (id: string) => (
    <p id={id} className="mt-1.5">
      <Badge tono="aviso" icono={AlertTriangle} tamano="sm">
        Desactivado · reasigna
      </Badge>
    </p>
  );

  // Anchos medidos: a 1024 px de ventana la tabla sólo tiene ~710 px. Por eso
  // empresa, ciudad y candidatos van en la celda de la vacante (no en columnas
  // propias) y el estado del equipo sube a ella cuando su columna se esconde.
  const columnas: Columna<Job>[] = [
    {
      id: 'vacante',
      encabezado: 'Vacante',
      enTarjeta: 'titulo',
      className: 'min-w-[11rem]',
      celda: (job) => {
        const candidatos = job._count?.applications || 0;
        return (
          <div className="min-w-0">
            {/* Título y especialidad en una línea (que envuelve): la fila
                queda en dos o tres renglones en vez de cuatro. */}
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-semibold leading-snug text-ink">{job.title}</span>
              {/* La API sólo lista activas: el estado se enseña si NO lo es. */}
              {job.status !== 'active' && getJobStatusBadge(job.status)}
              {job.profile && (
                <Badge tono="info" sinPunto tamano="sm">
                  {job.profile}
                </Badge>
              )}
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px] text-ink-muted">
              <span className="inline-flex min-w-0 items-center gap-1">
                <Building2 size={13} className="flex-none" aria-hidden="true" />
                {empresaDe(job)}
              </span>
              <span className="inline-flex min-w-0 items-center gap-1">
                <MapPin size={13} className="flex-none" aria-hidden="true" />
                {job.location}
              </span>
              <Link
                href={`/admin/assign-candidates?jobId=${job.id}`}
                title="Gestionar candidatos"
                className="inline-flex items-center gap-1 rounded font-medium tabular-nums text-teal hover:text-teal-dark hover:underline"
              >
                <Users size={13} className="flex-none" aria-hidden="true" />
                {candidatos} {candidatos === 1 ? 'candidato' : 'candidatos'}
                <span className="sr-only"> de {job.title}: gestionar</span>
              </Link>
            </p>
            {/* El estado del equipo sube aquí cuando su columna se esconde. */}
            <span data-solo-bajo="lg" className="mt-1.5 flex">
              {getAssignmentStatusBadge(job, true)}
            </span>
          </div>
        );
      }
    },
    {
      id: 'reclutador',
      encabezado: 'Reclutador',
      celda: (job) => {
        const elegido = selections[job.id]?.recruiterId;
        const fuera = estaFuera(elegido, recruiters);
        const idAviso = `reclutador-desactivado-${job.id}`;
        return (
          <div className={cn('w-full', ANCHO_SELECT)}>
            <Select
              aria-label={`Reclutador de ${job.title}`}
              aria-describedby={fuera ? idAviso : undefined}
              value={elegido || ''}
              onChange={(e) =>
                setSelections({
                  ...selections,
                  [job.id]: {
                    ...selections[job.id],
                    recruiterId: e.target.value ? parseInt(e.target.value) : undefined
                  }
                })
              }
              className="h-8 sm:text-[13px]"
            >
              <option value="">Sin asignar</option>
              {opcionFuera(job.assignment?.recruiter, elegido, recruiters)}
              {recruiters.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nombre} {r.apellidoPaterno || ''}
                </option>
              ))}
            </Select>
            {fuera && avisoDesactivado(idAviso)}
          </div>
        );
      }
    },
    {
      id: 'especialista',
      encabezado: 'Especialista',
      celda: (job) => {
        const elegido = selections[job.id]?.specialistId;
        const fuera = estaFuera(elegido, specialists);
        const especialidad = especialidadElegida(job);
        const idAviso = `especialista-desactivado-${job.id}`;
        const idAyuda = `especialista-especialidad-${job.id}`;
        const describe = [fuera && idAviso, especialidad && idAyuda].filter(Boolean).join(' ') || undefined;
        return (
          <div className={cn('w-full', ANCHO_SELECT)}>
            <Select
              aria-label={`Especialista de ${job.title}`}
              aria-describedby={describe}
              value={elegido || ''}
              onChange={(e) =>
                setSelections({
                  ...selections,
                  [job.id]: {
                    ...selections[job.id],
                    specialistId: e.target.value ? parseInt(e.target.value) : undefined
                  }
                })
              }
              className="h-8 sm:text-[13px]"
            >
              <option value="">Sin asignar</option>
              {opcionFuera(job.assignment?.specialist, elegido, specialists)}
              {/* La especialidad ya no va en el texto de la opción (el select la
                  recortaba: «Diego Calderón (Tecnolog…»): agrupa la lista y se
                  lee como ayuda bajo el select. */}
              {gruposEspecialistas.map((grupo) => (
                <optgroup key={grupo.nombre} label={grupo.nombre}>
                  {grupo.personas.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre} {s.apellidoPaterno || ''}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
            {fuera && avisoDesactivado(idAviso)}
            {especialidad && (
              <p id={idAyuda} className="mt-1 text-xs text-ink-muted">
                Especialidad: <span className="text-ink">{especialidad}</span>
              </p>
            )}
          </div>
        );
      }
    },
    {
      id: 'asignacion',
      encabezado: 'Equipo',
      ocultarBajo: 'lg',
      className: 'whitespace-nowrap',
      celda: (job) => getAssignmentStatusBadge(job)
    },
    {
      id: 'acciones',
      encabezado: 'Acciones',
      encabezadoOculto: true,
      alinear: 'fin',
      // En la tarjeta, al pie y a lo ancho, después de los dos selects: nunca
      // encima de la línea de empresa y ciudad.
      enTarjeta: 'completa',
      className: cn('whitespace-nowrap', SOLO_EN_TABLA_CENIDA),
      celda: (job) => {
        const cambios = tieneCambios(job.id);
        return (
          // Una fila con cambios sin guardar cambia de botón (tinta) y lleva un
          // punto; el lector lo oye en el nombre del botón.
          <Button
            variante={cambios ? 'secundario' : 'contorno'}
            tamano="sm"
            cargando={savingJobId === job.id}
            onClick={() => handleSaveAssignment(job.id)}
            aria-label={`Guardar equipo de ${job.title}${cambios ? ' (cambios sin guardar)' : ''}`}
            title={cambios ? 'Hay cambios sin guardar' : 'Guardar asignación'}
            className={EN_TARJETA_A_LO_ANCHO}
          >
            {cambios && <span className="h-1.5 w-1.5 flex-none rounded-full bg-orange" aria-hidden="true" />}
            Guardar
          </Button>
        );
      }
    }
  ];

  // Esqueleto de página sólo en la primera carga; al cambiar de pestaña
  // se ve la tabla cargando y la cabecera se queda.
  if (isLoading && !stats) {
    return <SkeletonPagina conCifras={false} />;
  }

  const filtroActual = FILTROS.find((f) => f.value === statusFilter);
  const errorDeCarga = !!error && jobs.length === 0;

  return (
    <>
      <PageHeader
        antetitulo="Reclutamiento"
        titulo="Asignar equipo"
        remate="a cada vacante"
        descripcion="Elige reclutador y especialista para cada vacante activa y guarda fila por fila."
      />

      {/* Error de una acción (con la lista a la vista): aviso fijo arriba,
          visible aunque la fila quede lejos. El de carga va en la tarjeta. */}
      <Toast
        tono="error"
        mensaje={errorDeCarga ? null : error}
        alCerrar={() => setError(null)}
        duracion={0}
      />

      <Card
        titulo="Vacantes activas"
        descripcion={
          <>
            <span className="inline-flex items-center gap-1">
              <UserCheck size={14} aria-hidden="true" />
              {recruiters.length === 0 ? 'No hay reclutadores registrados' : `${cuantos(recruiters.length, 'reclutador', 'reclutadores')} disponibles`}
            </span>
            <span aria-hidden="true" className="mx-2">·</span>
            <span className="inline-flex items-center gap-1">
              <UserCog size={14} aria-hidden="true" />
              {specialists.length === 0 ? 'No hay especialistas registrados' : `${cuantos(specialists.length, 'especialista', 'especialistas')} disponibles`}
            </span>
          </>
        }
        acciones={
          filasConCambios > 0 && (
            <Badge tono="aviso">
              {filasConCambios === 1 ? '1 fila con cambios sin guardar' : `${filasConCambios} filas con cambios sin guardar`}
            </Badge>
          )
        }
        sinRelleno
      >
        <Tabs
          idBase="equipo"
          etiqueta="Filtrar vacantes por estado del equipo"
          activa={statusFilter}
          alCambiar={setStatusFilter}
          pestanas={FILTROS.map((f) => ({
            id: f.value,
            etiqueta: f.label,
            contador: stats ? f.cifra(stats) : undefined
          }))}
          className="px-3"
        />

        <PanelPestana idBase="equipo" id={statusFilter} activa={statusFilter} className="pt-0">
          {errorDeCarga ? (
            <div role="alert" className="flex flex-col items-center gap-3 px-6 py-12 text-center">
              <AlertCircle className="h-6 w-6 text-danger" aria-hidden="true" />
              <p className="font-display font-semibold text-ink">No se pudo cargar la lista</p>
              <p className="text-sm text-ink-muted">{error}</p>
              <Button variante="contorno" tamano="sm" icono={RefreshCw} onClick={() => fetchAssignments()}>
                Reintentar
              </Button>
            </div>
          ) : (
            <DataTable
              etiqueta={`Vacantes activas: ${filtroActual?.label ?? 'todas'}`}
              columnas={columnas}
              filas={jobs}
              claveFila={(job) => job.id}
              cargando={isLoading}
              vacio={
                <EmptyState
                  frase="Nada que repartir por aquí."
                  titulo="No hay vacantes para mostrar"
                  descripcion={statusFilter !== 'all' ? 'Ninguna vacante activa está en este estado.' : undefined}
                  accion={
                    statusFilter !== 'all' ? (
                      <Button variante="contorno" tamano="sm" onClick={() => setStatusFilter('all')}>
                        Ver todas
                      </Button>
                    ) : undefined
                  }
                />
              }
            />
          )}
        </PanelPestana>
      </Card>
    </>
  );
}
