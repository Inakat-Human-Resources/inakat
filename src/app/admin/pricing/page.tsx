// RUTA: src/app/admin/pricing/page.tsx

'use client';

import React, { useState, useEffect } from 'react';
import {
  RefreshCw,
  Edit,
  DollarSign,
  X,
  Check,
  AlertCircle,
  Filter,
  Trash2,
  Loader2
} from 'lucide-react';

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
  const [conflictJobs, setConflictJobs] = useState<any[]>([]);

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
      const ok = confirm(
        `¿Desactivar ${entry.profile} / ${entry.seniority} / ${getWorkModeLabel(entry.workMode)}?\n\n` +
          `Mientras esté inactiva, esta combinación deja de tener precio: publicar una vacante con ella ya no costará ${entry.credits} crédito${entry.credits !== 1 ? 's' : ''}${salario}.`
      );
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
    let resumen = '';
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
        const lineas = [
          ...sinPrecios.map((e) => `• ${e.name}: sin ningún precio`),
          ...incompletas.map(
            (e) => `• ${e.name}: faltan ${e.missingCombinations?.length ?? 0} combinación(es)`
          )
        ];
        resumen = `\n\nFalta:\n${lineas.slice(0, 15).join('\n')}${lineas.length > 15 ? '\n…' : ''}`;
      }
    } catch {
      // Sin vista previa se sigue con la confirmación genérica.
    }

    const ok = confirm(
      '¿Regenerar las combinaciones de precio que falten?\n\n' +
        'Se crean con los créditos por defecto sólo las filas que no existen; las que ya están no se tocan.' +
        resumen
    );
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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto py-8 px-4">
        {/* Header - Responsive */}
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl md:text-4xl font-bold text-gray-800 mb-1 md:mb-2">
            Matriz de Precios
          </h1>
          <p className="text-gray-600 text-sm md:text-base">
            Solo puedes editar los créditos asignados
          </p>
          <button
            type="button"
            onClick={handleSyncFaltantes}
            disabled={isSyncing}
            className="mt-2 text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50 inline-flex items-center gap-1"
          >
            <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
            Regenerar combinaciones faltantes
          </button>
        </div>

        {/* Mensajes */}
        {error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg flex items-center gap-2">
            <AlertCircle size={20} />
            {error}
            <button onClick={() => setError(null)} className="ml-auto">
              <X size={16} />
            </button>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-100 border border-green-400 text-green-700 rounded-lg flex items-center gap-2">
            <Check size={20} />
            {success}
          </div>
        )}

        {/* Filtros */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1">Perfil</label>
              <select
                value={filterProfile}
                onChange={(e) => setFilterProfile(e.target.value)}
                className="w-full p-2 border rounded-lg"
              >
                <option value="">Todos los perfiles</option>
                {profiles.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <div className="flex-1">
              <label className="block text-sm font-medium mb-1">Seniority</label>
              <select
                value={filterSeniority}
                onChange={(e) => setFilterSeniority(e.target.value)}
                className="w-full p-2 border rounded-lg"
              >
                <option value="">Todos</option>
                {SENIORITIES.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div className="flex-1">
              <label className="block text-sm font-medium mb-1">Modalidad</label>
              <select
                value={filterWorkMode}
                onChange={(e) => setFilterWorkMode(e.target.value)}
                className="w-full p-2 border rounded-lg"
              >
                <option value="">Todas</option>
                {WORK_MODES.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>

            <button
              onClick={() => fetchPricing()}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <Filter size={20} />
              Filtrar
            </button>

            <button
              onClick={() => {
                setFilterProfile('');
                setFilterSeniority('');
                setFilterWorkMode('');
                fetchPricing({ profile: '', seniority: '', workMode: '' });
              }}
              title="Limpiar filtros"
              aria-label="Limpiar filtros y recargar"
              className="px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              <RefreshCw className={isLoading ? 'animate-spin' : ''} size={20} />
            </button>
          </div>
        </div>

        {/* Tabla */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Perfil</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Seniority</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Modalidad</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Ubicación</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Créditos</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Salario Mín.</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Estado</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                      <RefreshCw className="animate-spin mx-auto mb-2" size={24} />
                      Cargando precios...
                    </td>
                  </tr>
                ) : entries.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                      <DollarSign className="mx-auto mb-2 text-gray-400" size={40} />
                      No hay precios configurados
                    </td>
                  </tr>
                ) : (
                  entries.map(entry => (
                    <tr key={entry.id} className={`hover:bg-gray-50 ${!entry.isActive ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-3">
                        <span className="font-medium text-gray-900">{entry.profile}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">
                          {entry.seniority}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded text-sm">
                          {getWorkModeLabel(entry.workMode)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600">
                        {entry.location || <span className="text-gray-400">Cualquiera</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center gap-1 font-bold text-green-600">
                          <DollarSign size={16} />
                          {entry.credits}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {entry.minSalary ? (
                          <span className="text-sm font-medium text-blue-600">
                            ${entry.minSalary.toLocaleString('es-MX')}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-sm">No definido</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleToggleActive(entry)}
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            entry.isActive
                              ? 'bg-green-100 text-green-800 hover:bg-green-200'
                              : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                          }`}
                        >
                          {entry.isActive ? 'Activo' : 'Inactivo'}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-center gap-1">
                          <button
                            onClick={() => openEditModal(entry)}
                            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                            title="Editar créditos"
                          >
                            <Edit size={18} />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(entry)}
                            className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                            title="Eliminar"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Contador */}
        {!isLoading && entries.length > 0 && (
          <div className="mt-4 text-center text-sm text-gray-600">
            {entries.length} precio{entries.length !== 1 ? 's' : ''} configurado{entries.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Modal de editar créditos */}
      {isModalOpen && editingEntry && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-2xl font-bold">Editar Créditos</h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {modalError && (
                <div role="alert" className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex items-center gap-2">
                  <AlertCircle size={16} className="flex-shrink-0" />
                  {modalError}
                </div>
              )}

              {/* Información de solo lectura */}
              <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Perfil</label>
                  <p className="font-semibold text-gray-900">{formData.profile}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Seniority</label>
                    <p className="font-semibold text-gray-900">{formData.seniority}</p>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Modalidad</label>
                    <p className="font-semibold text-gray-900">{getWorkModeLabel(formData.workMode)}</p>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Ubicación</label>
                  <p className="font-semibold text-gray-900">{formData.location || 'Cualquier ubicación'}</p>
                </div>
              </div>

              {/* Credits */}
              <div>
                <label className="block text-sm font-semibold mb-1">Créditos *</label>
                <input
                  type="number"
                  value={formData.credits}
                  onChange={(e) => setFormData({ ...formData, credits: e.target.value })}
                  min="1"
                  step="1"
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 text-lg font-bold"
                  required
                  autoFocus
                />
                <p className="text-xs text-gray-500 mt-1">
                  Costo en créditos para publicar vacantes con esta configuración
                </p>
              </div>

              {/* Salario Mínimo */}
              <div>
                <label className="block text-sm font-semibold mb-1">Salario Mínimo (MXN)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number"
                    value={formData.minSalary}
                    onChange={(e) => setFormData({ ...formData, minSalary: e.target.value })}
                    min="0"
                    placeholder="Ej: 15000"
                    className="w-full p-3 pl-8 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Salario mínimo que debe ofrecer la empresa para publicar. Dejar vacío para no requerir mínimo.
                </p>
              </div>

              {/* Botones */}
              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-semibold flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="animate-spin" size={20} />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Check size={20} />
                      Guardar Créditos
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de confirmación de eliminación */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-xl font-bold text-gray-900">
                ¿Eliminar entrada de precios?
              </h2>
              <button
                onClick={closeDeleteModal}
                disabled={isDeleting}
                className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6">
              {/* Información del precio a eliminar */}
              <div className="bg-gray-50 p-4 rounded-lg mb-4">
                <p className="font-semibold text-gray-900 mb-2">{deleteConfirm.profile}</p>
                <div className="flex flex-wrap gap-2 text-sm">
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded">
                    {deleteConfirm.seniority}
                  </span>
                  <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded">
                    {getWorkModeLabel(deleteConfirm.workMode)}
                  </span>
                  <span className="px-2 py-1 bg-green-100 text-green-800 rounded">
                    {deleteConfirm.credits} créditos
                  </span>
                </div>
              </div>

              <p className="text-gray-600 mb-4">
                Esta acción no se puede deshacer. Solo se permite eliminar si no hay vacantes activas usando esta configuración.
              </p>

              {/* Error y lista de vacantes en conflicto */}
              {deleteError && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-700 font-medium mb-2">{deleteError}</p>
                  {conflictJobs.length > 0 && (
                    <div className="mt-2">
                      <p className="text-red-600 text-sm font-medium mb-1">Vacantes que usan esta configuración:</p>
                      <ul className="text-red-600 text-sm space-y-1">
                        {conflictJobs.map((job) => (
                          <li key={job.id} className="flex items-center gap-2">
                            <span className="w-2 h-2 bg-red-400 rounded-full"></span>
                            <span className="font-medium">{job.title}</span>
                            <span className="text-red-500">({job.company})</span>
                            <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-xs">
                              {job.status}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Botones */}
              <div className="flex gap-3">
                <button
                  onClick={closeDeleteModal}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleDelete(deleteConfirm)}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 font-semibold flex items-center justify-center gap-2"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Eliminando...
                    </>
                  ) : (
                    <>
                      <Trash2 size={18} />
                      Eliminar
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
