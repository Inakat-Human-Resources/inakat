// RUTA: src/app/admin/pricing/page.tsx

'use client';

/**
 * Matriz de precios: cuántos créditos cuesta publicar cada combinación de
 * perfil, seniority y modalidad (y el salario mínimo que exige).
 *
 * Registro de aplicación (docs/DISENO.md §5). La lógica es la de siempre:
 * mismas llamadas a /api/admin/pricing y /api/admin/pricing/sync, mismos
 * cuerpos, mismas validaciones (leerCreditos) y el mismo orden de pasos. Los
 * `confirm()` del navegador pasaron a un Modal (useConfirmacion) que devuelve
 * la misma respuesta en el mismo punto del flujo.
 *
 * Presentación (revisión visual, sep 2026): eran 148 filas planas (8 318 px
 * en escritorio, 35 481 en móvil) con el nivel en orden alfabético. Ahora es
 * una matriz por perfil —nivel en filas, en orden de escalera; modalidad en
 * columnas— plegable, con el primer perfil abierto. Mismos datos, misma
 * petición; nada se agrupa en el servidor.
 */

import React, { useState, useEffect } from 'react';
import {
  RefreshCw,
  Pencil,
  Filter,
  Trash2,
  RotateCcw,
  Check,
  ChevronRight,
  ChevronsUpDown,
  ChevronsDownUp
} from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import FilterToolbar, { FiltroSelect } from '@/components/ui/FilterToolbar';
import StatusBadge, { Badge } from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import Skeleton from '@/components/ui/Skeleton';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Toast from '@/components/ui/Toast';
import FormField, { Input } from '@/components/ui/FormField';
import { AvisoError } from '@/components/ui/Aviso';
import Switch from '@/components/ui/Switch';
import { useConfirmacion } from '@/components/ui/useConfirmacion';
import { cn } from '@/lib/utils';

interface PricingEntry {
  id: number;
  profile: string;
  seniority: string;
  workMode: string;
  location: string | null;
  credits: number;
  minSalary: number | null;
  isActive: boolean;
  createdAt: string;
}

/** Vacante que bloquea el borrado (409 de DELETE /api/admin/pricing). */
interface VacanteEnConflicto {
  id: number;
  title: string;
  company: string;
  status: string;
}

// Perfil, seniority, modalidad y ubicación sólo se pintan (no se editan).
// `credits` va como texto mientras se escribe: con `parseInt(...) || 0` el
// campo vacío se convertía en 0, el `required` ya no protegía y un Enter
// guardaba la combinación GRATIS (ADM-022).
interface FormData {
  profile: string;
  seniority: string;
  workMode: string;
  location: string;
  credits: string;
  minSalary: string;
}

const INITIAL_FORM: FormData = {
  profile: '',
  seniority: 'Jr',
  workMode: 'presential',
  location: '',
  credits: '',
  minSalary: ''
};

/**
 * Valida los créditos del formulario. Devuelve el entero o un mensaje de error.
 * Misma regla que PUT /api/admin/pricing: entero mayor o igual a 1.
 */
const leerCreditos = (valor: string): number | string => {
  const texto = valor.trim();
  if (texto === '') return 'Escribe cuántos créditos cuesta esta combinación.';
  const n = Number(texto);
  if (!Number.isInteger(n) || n < 1) {
    return 'Los créditos deben ser un número entero mayor o igual a 1.';
  }
  return n;
};

const SENIORITIES = ['Practicante', 'Jr', 'Middle', 'Sr', 'Director'];
const WORK_MODES = [
  { value: 'remote', label: 'Remoto' },
  { value: 'hybrid', label: 'Híbrido' },
  { value: 'presential', label: 'Presencial' }
];

const DEFAULT_PROFILES = [
  'Tecnología',
  'Arquitectura',
  'Diseño Gráfico',
  'Producción Audiovisual',
  'Educación',
  'Administración de Oficina',
  'Finanzas'
];

/** Pesos con separador de miles: $60,000. */
const pesos = (n: number) => `$${n.toLocaleString('es-MX')}`;

// ---------------------------------------------------------------------------
// La matriz (sólo presentación: se arma en el cliente con lo que ya devolvió
// GET /api/admin/pricing, sin pedir nada más)
// ---------------------------------------------------------------------------

/**
 * Peldaño de un nivel en la escalera (Practicante → Director). La API ordena
 * por texto y dejaba «Director, Jr, Middle, Practicante, Sr»; un nivel que no
 * esté en la lista va al final, por orden alfabético.
 */
const rangoNivel = (nivel: string) => {
  const i = SENIORITIES.indexOf(nivel);
  return i === -1 ? SENIORITIES.length : i;
};

/** Columnas de la matriz: de la oficina al remoto. */
const ORDEN_MODALIDAD = ['presential', 'hybrid', 'remote'];
const rangoModalidad = (modo: string) => {
  const i = ORDEN_MODALIDAD.indexOf(modo);
  return i === -1 ? ORDEN_MODALIDAD.length : i;
};

/** Una fila de la matriz: un nivel y, si la combinación la tiene, una ubicación concreta. */
interface FilaMatriz {
  clave: string;
  nivel: string;
  ubicacion: string | null;
  /** Por modalidad. Casi siempre una entrada; si hubiera dos, se enseñan las dos. */
  celdas: Record<string, PricingEntry[]>;
}

/** Todas las combinaciones de un perfil (una especialidad). */
interface GrupoPerfil {
  perfil: string;
  filas: FilaMatriz[];
  total: number;
  inactivas: number;
  /** Huecos de la matriz general (sin ubicación): los que crea «Regenerar». */
  sinConfigurar: number;
  minCreditos: number;
  maxCreditos: number;
}

/**
 * Reparte las entradas en una matriz por perfil: el nivel en filas (en orden
 * de escalera) y la modalidad en columnas. Filas y columnas son las mismas
 * para todos los perfiles (las que aparecen en la respuesta, así un filtro de
 * nivel o de modalidad deja sólo lo suyo) y un hueco se ve como hueco.
 */
function armarMatriz(entries: PricingEntry[]): { modalidades: string[]; grupos: GrupoPerfil[] } {
  const modalidades = [...new Set(entries.map((e) => e.workMode))].sort(
    (a, b) => rangoModalidad(a) - rangoModalidad(b) || a.localeCompare(b, 'es')
  );
  const niveles = [...new Set(entries.map((e) => e.seniority))].sort(
    (a, b) => rangoNivel(a) - rangoNivel(b) || a.localeCompare(b, 'es')
  );
  // Los perfiles, en el orden en que los devuelve la API (alfabético).
  const perfiles = [...new Set(entries.map((e) => e.profile))];

  const grupos = perfiles.map((perfil): GrupoPerfil => {
    const delPerfil = entries.filter((e) => e.profile === perfil);
    const filas: FilaMatriz[] = [];
    let sinConfigurar = 0;

    for (const nivel of niveles) {
      const delNivel = delPerfil.filter((e) => e.seniority === nivel);
      const ubicaciones = [
        ...new Set(delNivel.map((e) => e.location).filter((u): u is string => Boolean(u)))
      ].sort((a, b) => a.localeCompare(b, 'es'));

      // Primero la fila general (cualquier ubicación); debajo, las excepciones por ciudad.
      for (const ubicacion of [null, ...ubicaciones]) {
        const celdas: Record<string, PricingEntry[]> = {};
        for (const e of delNivel) {
          if ((e.location || null) !== ubicacion) continue;
          if (!celdas[e.workMode]) celdas[e.workMode] = [];
          celdas[e.workMode].push(e);
        }
        if (ubicacion === null) {
          sinConfigurar += modalidades.filter((m) => !celdas[m]).length;
        }
        filas.push({ clave: `${nivel}|${ubicacion ?? ''}`, nivel, ubicacion, celdas });
      }
    }

    const creditos = delPerfil.map((e) => e.credits);
    return {
      perfil,
      filas,
      total: delPerfil.length,
      inactivas: delPerfil.filter((e) => !e.isActive).length,
      sinConfigurar,
      minCreditos: Math.min(...creditos),
      maxCreditos: Math.max(...creditos)
    };
  });

  return { modalidades, grupos };
}

/**
 * La escalera del nivel: un peldaño más alto por nivel, encendidos hasta el
 * suyo. Decorativa (el nombre del nivel va escrito al lado).
 */
function Peldanos({ nivel }: { nivel: string }) {
  const rango = SENIORITIES.indexOf(nivel);
  return (
    <span className="flex h-3.5 w-7 flex-none items-end gap-[2px]" aria-hidden="true">
      {rango !== -1 &&
        SENIORITIES.map((s, i) => (
          <span
            key={s}
            className={cn('w-1 rounded-full', i <= rango ? 'bg-teal' : 'bg-line')}
            style={{ height: `${6 + i * 2}px` }}
          />
        ))}
    </span>
  );
}

export default function AdminPricingPage() {
  const [entries, setEntries] = useState<PricingEntry[]>([]);
  const [profiles, setProfiles] = useState<string[]>(DEFAULT_PROFILES);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Filtros
  const [filterProfile, setFilterProfile] = useState('');
  const [filterSeniority, setFilterSeniority] = useState('');
  const [filterWorkMode, setFilterWorkMode] = useState('');

  // Modal de edición
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<PricingEntry | null>(null);
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Error del modal de edición. El banner de la página queda DEBAJO del
  // overlay del modal y el admin no lo veía (ADM-067).
  const [modalError, setModalError] = useState<string | null>(null);

  // Estado para eliminación
  const [deleteConfirm, setDeleteConfirm] = useState<PricingEntry | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [conflictJobs, setConflictJobs] = useState<VacanteEnConflicto[]>([]);

  // Presentación: qué perfiles de la matriz están desplegados. null = el admin
  // todavía no ha tocado ninguno, y entonces se abre el primero.
  const [desplegados, setDesplegados] = useState<Set<string> | null>(null);

  // Las dos preguntas de la página (desactivar y regenerar) con el Modal del
  // sistema en lugar de window.confirm; responden igual (true/false).
  const { confirmar, dialogo } = useConfirmacion();

  useEffect(() => {
    fetchPricing();
  }, []);

  /**
   * ADM-021: los filtros se pueden pasar explícitos. El botón de limpiar hacía
   * los tres setState y llamaba a fetchPricing() en la misma pasada, que leía
   * los valores VIEJOS del closure: los selects se vaciaban pero la tabla
   * seguía filtrada.
   */
  const fetchPricing = async (
    filtros: { profile: string; seniority: string; workMode: string } = {
      profile: filterProfile,
      seniority: filterSeniority,
      workMode: filterWorkMode
    }
  ) => {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (filtros.profile) params.append('profile', filtros.profile);
      if (filtros.seniority) params.append('seniority', filtros.seniority);
      if (filtros.workMode) params.append('workMode', filtros.workMode);

      const response = await fetch(`/api/admin/pricing?${params}`);
      const data = await response.json();

      if (data.success) {
        setEntries(data.data);
        if (data.profiles && data.profiles.length > 0) {
          // Combinar perfiles existentes con los default
          const allProfiles = [...new Set([...DEFAULT_PROFILES, ...data.profiles])].sort();
          setProfiles(allProfiles);
        }
      } else {
        setError(data.error || 'Error al cargar precios');
      }
    } catch (err) {
      setError('Error de conexión');
    } finally {
      setIsLoading(false);
    }
  };

  const openEditModal = (entry: PricingEntry) => {
    setEditingEntry(entry);
    setFormData({
      profile: entry.profile,
      seniority: entry.seniority,
      workMode: entry.workMode,
      location: entry.location || '',
      credits: String(entry.credits),
      minSalary: entry.minSalary ? String(entry.minSalary) : ''
    });
    setModalError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingEntry(null);
    setFormData(INITIAL_FORM);
    setModalError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEntry) return; // Solo permitir edición

    // ADM-022: vacío o 0 ya no se guardan en silencio como "gratis".
    const credits = leerCreditos(formData.credits);
    if (typeof credits === 'string') {
      setModalError(credits);
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setModalError(null);

    try {
      // Solo enviar id, credits y minSalary (no se puede modificar profile, seniority, workMode, location)
      const payload = {
        id: editingEntry.id,
        credits,
        minSalary: formData.minSalary ? Number(formData.minSalary) : null
      };

      const response = await fetch('/api/admin/pricing', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSuccess('Créditos actualizados exitosamente');
        closeModal();
        fetchPricing();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setModalError(data.error || 'Error al guardar');
      }
    } catch (err) {
      setModalError('Error de conexión');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (entry: PricingEntry) => {
    // ADM-020: el pill desactivaba con un clic, sin aviso. Una combinación
    // inactiva deja de tener precio en la matriz (calculateJobCreditCost sólo
    // mira filas activas): ya no cobra estos créditos ni exige su salario
    // mínimo. Eso se confirma antes, igual que el borrado.
    if (entry.isActive) {
      const salario = entry.minSalary
        ? ` ni exigirá el salario mínimo de $${entry.minSalary.toLocaleString('es-MX')}`
        : '';
      const ok = await confirmar({
        titulo: `¿Desactivar ${entry.profile} / ${entry.seniority} / ${getWorkModeLabel(entry.workMode)}?`,
        descripcion: `Mientras esté inactiva, esta combinación deja de tener precio: publicar una vacante con ella ya no costará ${entry.credits} crédito${entry.credits !== 1 ? 's' : ''}${salario}.`,
        textoConfirmar: 'Desactivar',
        variante: 'peligro'
      });
      if (!ok) return;
    }

    try {
      const response = await fetch('/api/admin/pricing', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: entry.id,
          isActive: !entry.isActive
        })
      });

      const data = await response.json();

      if (data.success) {
        fetchPricing();
        // ADM-045: cuántas vacantes (activas, pausadas o borradores) usan la
        // combinación recién desactivada.
        const afectadas = typeof data.affectedJobs === 'number' ? data.affectedJobs : 0;
        if (afectadas > 0) {
          setSuccess(
            `Combinación desactivada. ${afectadas} vacante(s) la usan: los borradores no podrán publicarse con ella hasta reactivarla.`
          );
          setTimeout(() => setSuccess(null), 8000);
        }
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Error de conexión');
    }
  };

  const handleDelete = async (entry: PricingEntry) => {
    setIsDeleting(true);
    setDeleteError(null);
    setConflictJobs([]);

    try {
      const response = await fetch(`/api/admin/pricing?id=${entry.id}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (response.status === 409) {
        // Hay vacantes usando este precio
        setDeleteError(data.error);
        setConflictJobs(data.activeJobs || []);
        return;
      }

      if (!response.ok) {
        setDeleteError(data.error || 'Error al eliminar');
        return;
      }

      // Éxito - cerrar modal y recargar datos
      setDeleteConfirm(null);
      setSuccess('Entrada de precios eliminada exitosamente');
      fetchPricing();
      setTimeout(() => setSuccess(null), 3000);

    } catch (err) {
      setDeleteError('Error de conexión');
    } finally {
      setIsDeleting(false);
    }
  };

  const closeDeleteModal = () => {
    setDeleteConfirm(null);
    setDeleteError(null);
    setConflictJobs([]);
  };

  /**
   * ADM-045: borrar una fila de la matriz era irreversible desde la interfaz:
   * el alta manual está deshabilitada y POST /api/admin/pricing/sync, el único
   * mecanismo que regenera las combinaciones que faltan, no lo llamaba nadie.
   * Una fila borrada por error dejaba esa combinación cobrando el precio por
   * defecto hasta que alguien tocara la base a mano.
   */
  const [isSyncing, setIsSyncing] = useState(false);
  const handleSyncFaltantes = async () => {
    setIsSyncing(true);
    setError(null);

    // Primero se consulta qué falta (GET) para que el admin sepa qué va a crear.
    let faltan: string[] = [];
    try {
      const previa = await fetch('/api/admin/pricing/sync');
      const datosPrevia = await previa.json().catch(() => null);
      if (previa.ok && datosPrevia?.success && datosPrevia.data) {
        const sinPrecios: Array<{ name: string }> = datosPrevia.data.missingPricing ?? [];
        const incompletas: Array<{ name: string; missingCombinations?: string[] }> =
          datosPrevia.data.incompletePricing ?? [];
        if (sinPrecios.length === 0 && incompletas.length === 0) {
          setSuccess('No falta ninguna combinación: la matriz está completa.');
          setTimeout(() => setSuccess(null), 5000);
          setIsSyncing(false);
          return;
        }
        faltan = [
          ...sinPrecios.map((e) => `${e.name}: sin ningún precio`),
          ...incompletas.map(
            (e) => `${e.name}: faltan ${e.missingCombinations?.length ?? 0} combinación(es)`
          )
        ];
      }
    } catch {
      // Sin vista previa se sigue con la confirmación genérica.
    }

    const ok = await confirmar({
      titulo: '¿Regenerar las combinaciones de precio que falten?',
      descripcion:
        'Se crean con los créditos por defecto sólo las filas que no existen; las que ya están no se tocan.',
      contenido:
        faltan.length > 0 ? (
          <div>
            <p className="mb-2 font-display text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">Falta</p>
            <ul className="space-y-1.5 text-sm text-ink">
              {faltan.slice(0, 15).map((linea) => (
                <li key={linea} className="flex items-start gap-2">
                  <span className="mt-[7px] h-1.5 w-1.5 flex-none rounded-full bg-orange" aria-hidden="true" />
                  {linea}
                </li>
              ))}
              {faltan.length > 15 && <li className="pl-3.5 text-ink-muted">…</li>}
            </ul>
          </div>
        ) : undefined,
      textoConfirmar: 'Crear las que faltan'
    });
    if (!ok) {
      setIsSyncing(false);
      return;
    }

    try {
      const response = await fetch('/api/admin/pricing/sync', { method: 'POST' });
      const data = await response.json();
      if (response.ok && data.success) {
        setSuccess(data.message || 'Sincronización completada');
        fetchPricing();
        setTimeout(() => setSuccess(null), 5000);
      } else {
        setError(data.error || 'Error al sincronizar precios');
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setIsSyncing(false);
    }
  };

  const getWorkModeLabel = (mode: string) => {
    return WORK_MODES.find(m => m.value === mode)?.label || mode;
  };

  // ---------------------------------------------------------------------------
  // Presentación
  // ---------------------------------------------------------------------------
  // Con la ubicación, si la tiene: en la matriz, «Sr · Presencial» general y
  // «Sr · Presencial · Monterrey» son dos celdas distintas y el lector debe oírlo.
  const combinacion = (entry: PricingEntry) =>
    `${entry.profile} · ${entry.seniority} · ${getWorkModeLabel(entry.workMode)}${entry.location ? ` · ${entry.location}` : ''}`;

  const limpiarYRecargar = () => {
    setFilterProfile('');
    setFilterSeniority('');
    setFilterWorkMode('');
    fetchPricing({ profile: '', seniority: '', workMode: '' });
  };

  const hayFiltros = Boolean(filterProfile || filterSeniority || filterWorkMode);
  const inactivas = entries.filter((e) => !e.isActive).length;

  /**
   * Borrar se pide desde el modal de edición (era la papelera roja de cada
   * fila; en una matriz serían quince papeleras junto a quince interruptores).
   * Abre la MISMA confirmación de siempre, con la misma entrada.
   */
  const pedirBorrado = () => {
    if (!editingEntry) return;
    const entrada = editingEntry;
    closeModal();
    setDeleteConfirm(entrada);
  };

  // --- Matriz por perfil ----------------------------------------------------
  const { modalidades, grupos } = armarMatriz(entries);
  // Con un solo perfil (p. ej. filtrando por uno) no hay nada que plegar.
  const plegable = grupos.length > 1;
  const estaDesplegado = (perfil: string, indice: number) =>
    !plegable || (desplegados ? desplegados.has(perfil) : indice === 0);
  const todosDesplegados = grupos.length > 0 && grupos.every((g, i) => estaDesplegado(g.perfil, i));

  const alternarGrupo = (perfil: string) => {
    setDesplegados((previos) => {
      const siguiente = new Set(previos ?? (grupos[0] ? [grupos[0].perfil] : []));
      if (siguiente.has(perfil)) siguiente.delete(perfil);
      else siguiente.add(perfil);
      return siguiente;
    });
  };

  const alternarTodos = () => {
    setDesplegados(todosDesplegados ? new Set() : new Set(grupos.map((g) => g.perfil)));
  };

  const plural = (n: number, singular: string, varios: string) => `${n} ${n === 1 ? singular : varios}`;

  /** Una combinación dentro de su celda: la cifra (abre la edición), el mínimo y el estado. */
  const celdaPrecio = (entry: PricingEntry) => (
    <div key={entry.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
      <div className="min-w-0">
        <button
          type="button"
          onClick={() => openEditModal(entry)}
          title="Editar créditos"
          aria-label={`Editar ${plural(entry.credits, 'crédito', 'créditos')} de ${combinacion(entry)}`}
          className={cn(
            'group/cifra -mx-1.5 inline-flex items-baseline gap-1.5 rounded-md px-1.5 py-1',
            'transition-colors duration-150 hover:bg-teal-tint',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-teal'
          )}
        >
          <span
            className={cn(
              'font-display text-xl font-semibold leading-none tabular-nums',
              entry.isActive ? 'text-ink' : 'text-ink-muted'
            )}
          >
            {entry.credits}
          </span>
          <span className="text-xs text-ink-muted">{entry.credits === 1 ? 'crédito' : 'créditos'}</span>
          <Pencil
            className="h-3.5 w-3.5 flex-none self-center text-ink-muted transition-colors duration-150 group-hover/cifra:text-teal"
            aria-hidden="true"
          />
        </button>
        <p className="mt-0.5 text-xs tabular-nums text-ink-muted">
          {entry.minSalary ? `mín. ${pesos(entry.minSalary)}` : 'Sin mínimo'}
        </p>
      </div>
      <Switch activo={entry.isActive} alCambiar={() => handleToggleActive(entry)} objeto={combinacion(entry)} />
    </div>
  );

  const claseEncabezado =
    'border-b border-line bg-paper px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.06em] text-ink-muted';

  /**
   * La matriz de un perfil. Desde 640 px, tabla: nivel en filas, modalidad en
   * columnas. En móvil, la MISMA tabla (un solo DOM) se apila: cada nivel es
   * un bloque y cada celda dice su modalidad.
   */
  const matriz = (grupo: GrupoPerfil) => (
    <div className="rounded-lg border border-line [overflow:clip]">
      <table className="w-full border-collapse text-sm max-sm:block">
        <caption className="sr-only">
          Créditos de {grupo.perfil}: nivel en filas, de Practicante a Director, y modalidad en columnas
        </caption>
        <thead className="max-sm:hidden">
          <tr>
            <th scope="col" className={cn(claseEncabezado, 'w-40')}>
              Nivel
            </th>
            {modalidades.map((m) => (
              <th key={m} scope="col" className={cn(claseEncabezado, 'border-l')}>
                {getWorkModeLabel(m)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="max-sm:block">
          {grupo.filas.map((fila) => (
            <tr
              key={fila.clave}
              className="border-b border-line last:border-b-0 max-sm:block max-sm:px-3 max-sm:py-3"
            >
              <th scope="row" className="px-4 py-3 text-left align-middle font-normal max-sm:block max-sm:p-0 max-sm:pb-1">
                <span className="flex items-center gap-2.5">
                  <Peldanos nivel={fila.nivel} />
                  <span className="font-display text-sm font-semibold text-ink">{fila.nivel}</span>
                </span>
                {fila.ubicacion && (
                  <span className="mt-0.5 block pl-[38px] text-xs text-ink-muted">Solo en {fila.ubicacion}</span>
                )}
              </th>
              {modalidades.map((m) => {
                const lista = fila.celdas[m];
                const apagada = Boolean(lista) && lista.every((e) => !e.isActive);
                return (
                  <td
                    key={m}
                    className={cn(
                      'border-l border-line px-4 py-2.5 align-middle',
                      'max-sm:flex max-sm:items-center max-sm:gap-3 max-sm:border-l-0 max-sm:px-0 max-sm:py-1.5',
                      apagada && 'bg-mist/50 max-sm:-mx-2 max-sm:rounded-md max-sm:px-2'
                    )}
                  >
                    {/* En móvil no hay cabecera de columnas: la celda dice su modalidad. */}
                    <span className="w-[4.5rem] flex-none text-[13px] text-ink-muted sm:hidden">{getWorkModeLabel(m)}</span>
                    {lista ? (
                      <div className="min-w-0 flex-1 space-y-2">{lista.map(celdaPrecio)}</div>
                    ) : (
                      <p className="flex-1 rounded-md border border-dashed border-line-strong/50 px-2.5 py-2 text-xs text-ink-muted">
                        Sin configurar
                      </p>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  /** Un perfil: su cabecera (plegable si hay varios) y su matriz. */
  const grupoPerfil = (grupo: GrupoPerfil, indice: number) => {
    const abierto = estaDesplegado(grupo.perfil, indice);
    const idPanel = `matriz-perfil-${indice}`;
    const rango =
      grupo.minCreditos === grupo.maxCreditos
        ? plural(grupo.minCreditos, 'crédito', 'créditos')
        : `de ${grupo.minCreditos} a ${grupo.maxCreditos} créditos`;
    const partesResumen = [
      plural(grupo.total, 'combinación', 'combinaciones'),
      rango,
      grupo.inactivas > 0 ? plural(grupo.inactivas, 'inactiva', 'inactivas') : null,
      grupo.sinConfigurar > 0 ? `${grupo.sinConfigurar} sin configurar` : null
    ].filter((p): p is string => Boolean(p));
    const resumenGrupo = (
      <span
        className={cn(
          'flex flex-wrap items-center gap-x-3 gap-y-1 font-body text-[13px] font-normal tabular-nums text-ink-muted sm:justify-end',
          // En móvil va debajo del nombre: alineado con él, no con la flecha.
          plegable && 'max-sm:pl-[26px]'
        )}
      >
        <span>{plural(grupo.total, 'combinación', 'combinaciones')}</span>
        <span>{rango}</span>
        {grupo.inactivas > 0 && (
          <Badge tono="neutro" tamano="sm">
            {plural(grupo.inactivas, 'inactiva', 'inactivas')}
          </Badge>
        )}
        {grupo.sinConfigurar > 0 && (
          <Badge tono="aviso" tamano="sm">
            {grupo.sinConfigurar} sin configurar
          </Badge>
        )}
      </span>
    );
    const claseCabecera = 'flex w-full flex-col gap-1.5 px-5 py-3.5 text-left sm:flex-row sm:items-center sm:justify-between sm:gap-4';

    return (
      <div key={grupo.perfil} className="border-b border-line last:border-b-0">
        {plegable ? (
          <h3 className="font-display text-[15px] font-semibold text-ink">
            <button
              type="button"
              aria-expanded={abierto}
              aria-controls={abierto ? idPanel : undefined}
              // El nombre, con comas: los trozos del resumen son cajas flex y
              // el lector los juntaría («Arquitectura15 combinaciones…»).
              aria-label={`${grupo.perfil}: ${partesResumen.join(', ')}`}
              onClick={() => alternarGrupo(grupo.perfil)}
              className={cn(
                claseCabecera,
                'transition-colors duration-150 hover:bg-paper',
                'focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-teal'
              )}
            >
              <span className="flex items-center gap-2.5">
                <ChevronRight
                  className={cn(
                    'h-4 w-4 flex-none text-ink-muted transition-transform duration-150',
                    abierto && 'rotate-90'
                  )}
                  aria-hidden="true"
                />
                {grupo.perfil}
              </span>
              {resumenGrupo}
            </button>
          </h3>
        ) : (
          <div className={claseCabecera}>
            <h3 className="font-display text-[15px] font-semibold text-ink">{grupo.perfil}</h3>
            {resumenGrupo}
          </div>
        )}
        {abierto && (
          <div id={idPanel} className="px-5 pb-5 max-sm:px-3 max-sm:pb-3">
            {matriz(grupo)}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <PageHeader
        antetitulo="Empresas y comercial"
        titulo="Matriz de precios"
        remate="en créditos"
        descripcion="Lo que cuesta publicar cada combinación de perfil, seniority y modalidad. Solo puedes editar los créditos asignados."
        acciones={
          <Button
            variante="contorno"
            icono={RefreshCw}
            onClick={handleSyncFaltantes}
            cargando={isSyncing}
          >
            Regenerar combinaciones faltantes
          </Button>
        }
      />

      {error && (
        <AvisoError
          mensaje={error}
          alCerrar={() => setError(null)}
          alReintentar={entries.length === 0 ? () => fetchPricing() : undefined}
        />
      )}

      <Toast tono="exito" mensaje={success} alCerrar={() => setSuccess(null)} duracion={0} />

      <Card
        titulo="Combinaciones"
        descripcion="Una matriz por perfil: el nivel en filas y la modalidad en columnas. Pulsa una cifra para editar sus créditos; debajo va el salario mínimo que exige."
        acciones={
          plegable ? (
            <Button
              variante="fantasma"
              tamano="sm"
              icono={todosDesplegados ? ChevronsDownUp : ChevronsUpDown}
              onClick={alternarTodos}
            >
              {todosDesplegados ? 'Plegar todos' : 'Desplegar todos'}
            </Button>
          ) : undefined
        }
        sinRelleno
      >
        <div className="border-b border-line px-5 py-4">
          <FilterToolbar
            plegableEnMovil
            activosPlegables={[filterProfile, filterSeniority, filterWorkMode].filter(Boolean).length}
            resumen={
              !isLoading && entries.length > 0
                ? `${entries.length} precio${entries.length !== 1 ? 's' : ''} configurado${entries.length !== 1 ? 's' : ''}${inactivas > 0 ? ` · ${inactivas} inactivo${inactivas !== 1 ? 's' : ''}` : ''}`
                : undefined
            }
            acciones={
              <Button variante="fantasma" tamano="sm" icono={RotateCcw} onClick={limpiarYRecargar}>
                Limpiar y recargar
              </Button>
            }
          >
            <FiltroSelect etiqueta="Perfil" value={filterProfile} onChange={(e) => setFilterProfile(e.target.value)}>
              <option value="">Todos los perfiles</option>
              {profiles.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </FiltroSelect>
            <FiltroSelect etiqueta="Seniority" value={filterSeniority} onChange={(e) => setFilterSeniority(e.target.value)}>
              <option value="">Todos</option>
              {SENIORITIES.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </FiltroSelect>
            <FiltroSelect etiqueta="Modalidad" value={filterWorkMode} onChange={(e) => setFilterWorkMode(e.target.value)}>
              <option value="">Todas</option>
              {WORK_MODES.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </FiltroSelect>
            {/* Los filtros se aplican al pulsar «Filtrar» (piden la matriz al servidor). */}
            <Button
              variante="secundario"
              tamano="sm"
              icono={Filter}
              onClick={() => fetchPricing()}
              className="h-9 w-full sm:w-auto"
            >
              Filtrar
            </Button>
          </FilterToolbar>
        </div>

        {isLoading && entries.length === 0 ? (
          // Primera carga: la silueta de un perfil desplegado y varios plegados.
          <div aria-busy="true">
            <p role="status" className="sr-only">
              Cargando la matriz de precios…
            </p>
            <div aria-hidden="true">
              <div className="flex items-center justify-between gap-4 px-5 py-4">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-40" />
              </div>
              <div className="mx-5 mb-5 space-y-3 rounded-lg border border-line p-4">
                {Array.from({ length: 5 }, (_, i) => (
                  <div key={i} className="grid grid-cols-[8rem_1fr_1fr_1fr] gap-4 max-sm:grid-cols-[6rem_1fr]">
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-5 w-3/4 max-sm:hidden" />
                    <Skeleton className="h-5 w-3/4 max-sm:hidden" />
                  </div>
                ))}
              </div>
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="flex items-center justify-between gap-4 border-t border-line px-5 py-4">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-32" />
                </div>
              ))}
            </div>
          </div>
        ) : entries.length === 0 ? (
          error ? (
            <p className="px-5 py-10 text-center text-sm text-ink-muted">
              No se pudo cargar la matriz. Pulsa «Reintentar» en el aviso de arriba.
            </p>
          ) : (
            <EmptyState
              frase="Nada por aquí, todavía."
              titulo="No hay precios configurados"
              descripcion={
                hayFiltros
                  ? 'Ninguna combinación coincide con estos filtros.'
                  : 'Las combinaciones se generan al crear especialidades.'
              }
              accion={
                hayFiltros ? (
                  <Button variante="contorno" tamano="sm" icono={RotateCcw} onClick={limpiarYRecargar}>
                    Quitar filtros
                  </Button>
                ) : (
                  <Button variante="contorno" tamano="sm" icono={RefreshCw} onClick={handleSyncFaltantes}>
                    Generar las que faltan
                  </Button>
                )
              }
            />
          )
        ) : (
          // Al recargar (tras guardar o filtrar) la matriz se queda a la vista, atenuada.
          <div
            aria-busy={isLoading || undefined}
            className={cn('transition-opacity duration-150', isLoading && 'opacity-60')}
          >
            {grupos.map(grupoPerfil)}
          </div>
        )}
      </Card>

      {/* Editar créditos */}
      <Modal
        abierto={isModalOpen && editingEntry !== null}
        alCerrar={closeModal}
        tamano="sm"
        titulo="Editar créditos"
        subtitulo={editingEntry ? combinacion(editingEntry) : undefined}
        cerrarAlPulsarFondo={false}
        pie={
          <>
            <Button
              variante="fantasma"
              icono={Trash2}
              onClick={pedirBorrado}
              disabled={isSubmitting}
              className="text-danger hover:bg-danger-tint sm:mr-auto"
            >
              Eliminar combinación
            </Button>
            <Button variante="contorno" onClick={closeModal}>
              Cancelar
            </Button>
            <Button
              type="submit"
              form="form-creditos"
              icono={Check}
              cargando={isSubmitting}
              textoCargando="Guardando…"
            >
              Guardar créditos
            </Button>
          </>
        }
      >
        <form id="form-creditos" onSubmit={handleSubmit} className="space-y-5">
          {modalError && <AvisoError mensaje={modalError} className="mb-0" />}

          {/* Información de solo lectura */}
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border border-line bg-paper px-4 py-3">
            <div className="col-span-2">
              <dt className="text-xs text-ink-muted">Perfil</dt>
              <dd className="font-semibold text-ink">{formData.profile}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted">Seniority</dt>
              <dd className="font-semibold text-ink">{formData.seniority}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted">Modalidad</dt>
              <dd className="font-semibold text-ink">{getWorkModeLabel(formData.workMode)}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-xs text-ink-muted">Ubicación</dt>
              <dd className="font-semibold text-ink">{formData.location || 'Cualquier ubicación'}</dd>
            </div>
          </dl>

          <FormField
            etiqueta="Créditos"
            requerido
            ayuda="Costo en créditos para publicar vacantes con esta configuración."
          >
            <Input
              type="number"
              value={formData.credits}
              onChange={(e) => setFormData({ ...formData, credits: e.target.value })}
              min="1"
              step="1"
              inputMode="numeric"
              className="h-12 font-display text-lg font-semibold tabular-nums"
            />
          </FormField>

          <FormField
            etiqueta="Salario mínimo (MXN)"
            opcional
            ayuda="Salario mínimo que debe ofrecer la empresa para publicar. Déjalo vacío para no exigir mínimo."
          >
            <Input
              type="number"
              value={formData.minSalary}
              onChange={(e) => setFormData({ ...formData, minSalary: e.target.value })}
              min="0"
              inputMode="numeric"
              placeholder="Ej: 15000"
              prefijo={<span className="text-sm">$</span>}
              className="tabular-nums"
            />
          </FormField>
        </form>
      </Modal>

      {/* Confirmar borrado */}
      <Modal
        abierto={deleteConfirm !== null}
        // Mientras se borra no se cierra (antes la X se deshabilitaba).
        alCerrar={() => {
          if (!isDeleting) closeDeleteModal();
        }}
        tamano="md"
        titulo="¿Eliminar entrada de precios?"
        descripcion="Esta acción no se puede deshacer. Solo se permite eliminar si no hay vacantes activas usando esta configuración."
        pie={
          <>
            <Button variante="contorno" onClick={closeDeleteModal} disabled={isDeleting}>
              Cancelar
            </Button>
            <Button
              variante="peligro"
              icono={Trash2}
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
              cargando={isDeleting}
              textoCargando="Eliminando…"
            >
              Eliminar
            </Button>
          </>
        }
      >
        {deleteConfirm && (
          <div className="space-y-4">
            {/* Información del precio a eliminar */}
            <div className="rounded-lg border border-line bg-paper px-4 py-3">
              <p className="font-semibold text-ink">{deleteConfirm.profile}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge tono="neutro" sinPunto>
                  {deleteConfirm.seniority}
                </Badge>
                <Badge tono="neutro" sinPunto>
                  {getWorkModeLabel(deleteConfirm.workMode)}
                </Badge>
                {deleteConfirm.location && (
                  <Badge tono="neutro" sinPunto>
                    {deleteConfirm.location}
                  </Badge>
                )}
                <Badge tono="info" sinPunto>
                  {deleteConfirm.credits} créditos
                </Badge>
              </div>
            </div>

            {/* Error y lista de vacantes en conflicto */}
            {deleteError && (
              <div role="alert" className="rounded-lg border border-danger/30 bg-danger-tint px-4 py-3 text-sm text-danger-dark">
                <p className="font-medium">{deleteError}</p>
                {conflictJobs.length > 0 && (
                  <div className="mt-3">
                    <p className="mb-1.5 text-[13px] font-medium">Vacantes que usan esta configuración:</p>
                    <ul className="divide-y divide-danger/15 rounded-lg bg-white/70">
                      {conflictJobs.map((job) => (
                        <li key={job.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                          <span className="min-w-0 text-ink">
                            <span className="font-medium">{job.title}</span>{' '}
                            <span className="text-ink-muted">({job.company})</span>
                          </span>
                          <StatusBadge estado={job.status} contexto="vacante" tamano="sm" />
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>

      {dialogo}
    </>
  );
}
