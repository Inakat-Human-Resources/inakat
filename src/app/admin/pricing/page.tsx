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
  Filter
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

interface FormData {
  profile: string;
  seniority: string;
  workMode: string;
  location: string;
  credits: number;
  minSalary: string;
}

const INITIAL_FORM: FormData = {
  profile: '',
  seniority: 'Jr',
  workMode: 'presential',
  location: '',
  credits: 1,
  minSalary: ''
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

const LOCATIONS = [
  '',
  'CDMX',
  'Monterrey',
  'Guadalajara',
  'Puebla',
  'Querétaro',
  'Tijuana'
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

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<PricingEntry | null>(null);
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customProfile, setCustomProfile] = useState(false);

  useEffect(() => {
    fetchPricing();
  }, []);

  const fetchPricing = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (filterProfile) params.append('profile', filterProfile);
      if (filterSeniority) params.append('seniority', filterSeniority);
      if (filterWorkMode) params.append('workMode', filterWorkMode);

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
      credits: entry.credits,
      minSalary: entry.minSalary ? String(entry.minSalary) : ''
    });
    setCustomProfile(!profiles.includes(entry.profile));
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingEntry(null);
    setFormData(INITIAL_FORM);
    setCustomProfile(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEntry) return; // Solo permitir edición

    setIsSubmitting(true);
    setError(null);

    try {
      // Solo enviar id, credits y minSalary (no se puede modificar profile, seniority, workMode, location)
      const payload = {
        id: editingEntry.id,
        credits: Number(formData.credits),
        minSalary: formData.minSalary ? Number(formData.minSalary) : null
      };

      const response = await fetch('/api/admin/pricing', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('Créditos actualizados exitosamente');
        closeModal();
        fetchPricing();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error || 'Error al guardar');
      }
    } catch (err) {
      setError('Error de conexión');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (entry: PricingEntry) => {
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
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Error de conexión');
    }
  };

  const getWorkModeLabel = (mode: string) => {
    return WORK_MODES.find(m => m.value === mode)?.label || mode;
  };

  // Agrupar por perfil para visualización
  const groupedEntries = entries.reduce((acc, entry) => {
    if (!acc[entry.profile]) {
      acc[entry.profile] = [];
    }
    acc[entry.profile].push(entry);
    return acc;
  }, {} as Record<string, PricingEntry[]>);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto py-8 px-4">
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-800 mb-2">
              Matriz de Precios
            </h1>
            <p className="text-gray-600">
              Los precios se generan automáticamente al crear especialidades. Solo puedes editar los créditos.
            </p>
          </div>
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
              onClick={fetchPricing}
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
                fetchPricing();
              }}
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
                        <div className="flex justify-center">
                          <button
                            onClick={() => openEditModal(entry)}
                            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                            title="Editar créditos"
                          >
                            <Edit size={18} />
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
                  onChange={(e) => setFormData({ ...formData, credits: parseInt(e.target.value) || 0 })}
                  min="0"
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
    </div>
  );
}
