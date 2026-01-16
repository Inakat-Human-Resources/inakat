// RUTA: src/app/admin/specialties/page.tsx

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Edit2,
  Trash2,
  Save,
  X,
  GripVertical,
  ChevronDown,
  ChevronUp,
  Tag,
  Palette,
  ToggleLeft,
  ToggleRight,
  Loader2,
  AlertCircle,
  CheckCircle
} from 'lucide-react';

interface Specialty {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  color: string;
  subcategories: string[];
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface FormData {
  name: string;
  description: string;
  icon: string;
  color: string;
  subcategories: string[];
  sortOrder: number;
  isActive: boolean;
}

const initialFormData: FormData = {
  name: '',
  description: '',
  icon: '',
  color: '#2b5d62',
  subcategories: [],
  sortOrder: 0,
  isActive: true
};

export default function SpecialtiesPage() {
  const router = useRouter();
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newSubcategory, setNewSubcategory] = useState('');

  // Delete confirmation
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  // Expanded rows for subcategories
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  useEffect(() => {
    fetchSpecialties();
  }, []);

  const fetchSpecialties = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/admin/specialties');
      const data = await response.json();

      if (data.success) {
        setSpecialties(data.data);
      } else {
        setError(data.error || 'Error al cargar especialidades');
      }
    } catch (err) {
      setError('Error de conexión');
      console.error('Error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const openCreateModal = () => {
    setFormData({
      ...initialFormData,
      sortOrder: specialties.length + 1
    });
    setEditingId(null);
    setIsModalOpen(true);
  };

  const openEditModal = (specialty: Specialty) => {
    setFormData({
      name: specialty.name,
      description: specialty.description || '',
      icon: specialty.icon || '',
      color: specialty.color || '#2b5d62',
      subcategories: specialty.subcategories || [],
      sortOrder: specialty.sortOrder,
      isActive: specialty.isActive
    });
    setEditingId(specialty.id);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setFormData(initialFormData);
    setNewSubcategory('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const url = editingId
        ? `/api/admin/specialties/${editingId}`
        : '/api/admin/specialties';

      const method = editingId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(
          editingId ? 'Especialidad actualizada' : 'Especialidad creada'
        );
        closeModal();
        fetchSpecialties();
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

  const handleDelete = async (id: number) => {
    try {
      const response = await fetch(`/api/admin/specialties/${id}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('Especialidad eliminada');
        setDeleteConfirmId(null);
        fetchSpecialties();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error || 'Error al eliminar');
        setDeleteConfirmId(null);
      }
    } catch (err) {
      setError('Error de conexión');
      setDeleteConfirmId(null);
    }
  };

  const toggleActive = async (specialty: Specialty) => {
    try {
      const response = await fetch(`/api/admin/specialties/${specialty.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !specialty.isActive })
      });

      const data = await response.json();

      if (data.success) {
        fetchSpecialties();
      } else {
        setError(data.error || 'Error al actualizar');
      }
    } catch (err) {
      setError('Error de conexión');
    }
  };

  const addSubcategory = () => {
    if (
      newSubcategory.trim() &&
      !formData.subcategories.includes(newSubcategory.trim())
    ) {
      setFormData({
        ...formData,
        subcategories: [...formData.subcategories, newSubcategory.trim()]
      });
      setNewSubcategory('');
    }
  };

  const removeSubcategory = (index: number) => {
    setFormData({
      ...formData,
      subcategories: formData.subcategories.filter((_, i) => i !== index)
    });
  };

  const toggleRowExpand = (id: number) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="animate-spin text-button-green" size={40} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-6 md:mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Especialidades</h1>
            <p className="text-gray-600 mt-1 text-sm md:text-base">
              Gestiona los perfiles profesionales disponibles en la plataforma
            </p>
          </div>
          <button
            onClick={openCreateModal}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-button-green text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Plus size={20} />
            Nueva Especialidad
          </button>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
            <AlertCircle size={20} />
            {error}
            <button onClick={() => setError(null)} className="ml-auto">
              <X size={18} />
            </button>
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700">
            <CheckCircle size={20} />
            {success}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 md:gap-4 mb-6 md:mb-8">
          <div className="bg-white p-3 md:p-4 rounded-lg shadow-sm border">
            <p className="text-xs md:text-sm text-gray-500">Total</p>
            <p className="text-xl md:text-2xl font-bold text-gray-900">
              {specialties.length}
            </p>
          </div>
          <div className="bg-white p-3 md:p-4 rounded-lg shadow-sm border">
            <p className="text-xs md:text-sm text-gray-500">Activas</p>
            <p className="text-xl md:text-2xl font-bold text-green-600">
              {specialties.filter((s) => s.isActive).length}
            </p>
          </div>
          <div className="bg-white p-3 md:p-4 rounded-lg shadow-sm border">
            <p className="text-xs md:text-sm text-gray-500">Inactivas</p>
            <p className="text-xl md:text-2xl font-bold text-gray-400">
              {specialties.filter((s) => !s.isActive).length}
            </p>
          </div>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden space-y-3">
          {specialties.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border p-8 text-center text-gray-500">
              No hay especialidades registradas. ¡Crea la primera!
            </div>
          ) : (
            specialties.map((specialty) => (
              <div
                key={specialty.id}
                className="bg-white rounded-lg shadow-sm border p-4"
              >
                {/* Header con nombre y estado */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: specialty.color }}
                    />
                    <div>
                      <p className="font-medium text-gray-900">
                        {specialty.icon && (
                          <span className="mr-1">{specialty.icon}</span>
                        )}
                        {specialty.name}
                      </p>
                      <span className="text-xs text-gray-400">
                        Orden: {specialty.sortOrder}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleActive(specialty)}
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium flex-shrink-0 ${
                      specialty.isActive
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {specialty.isActive ? (
                      <>
                        <ToggleRight size={12} />
                        Activa
                      </>
                    ) : (
                      <>
                        <ToggleLeft size={12} />
                        Inactiva
                      </>
                    )}
                  </button>
                </div>

                {/* Descripción */}
                {specialty.description && (
                  <p className="text-sm text-gray-500 mb-3 line-clamp-2">
                    {specialty.description}
                  </p>
                )}

                {/* Subcategorías */}
                {specialty.subcategories.length > 0 && (
                  <div className="mb-3">
                    <button
                      onClick={() => toggleRowExpand(specialty.id)}
                      className="flex items-center gap-1 text-sm text-blue-600"
                    >
                      {specialty.subcategories.length} subcategorías
                      {expandedRows.has(specialty.id) ? (
                        <ChevronUp size={14} />
                      ) : (
                        <ChevronDown size={14} />
                      )}
                    </button>
                    {expandedRows.has(specialty.id) && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {specialty.subcategories.map((sub, index) => (
                          <span
                            key={index}
                            className="px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-600"
                          >
                            #{sub}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Acciones */}
                <div className="flex gap-2 pt-3 border-t">
                  <button
                    onClick={() => openEditModal(specialty)}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-blue-600 bg-blue-50 rounded-lg text-sm"
                  >
                    <Edit2 size={16} />
                    Editar
                  </button>
                  <button
                    onClick={() => setDeleteConfirmId(specialty.id)}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-red-600 bg-red-50 rounded-lg text-sm"
                  >
                    <Trash2 size={16} />
                    Eliminar
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block bg-white rounded-lg shadow-sm border overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">
                  Orden
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">
                  Especialidad
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">
                  Subcategorías
                </th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-600">
                  Estado
                </th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {specialties.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-12 text-center text-gray-500"
                  >
                    No hay especialidades registradas. ¡Crea la primera!
                  </td>
                </tr>
              ) : (
                specialties.map((specialty) => (
                  <React.Fragment key={specialty.id}>
                    <tr className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 text-gray-400">
                          <GripVertical size={16} />
                          <span className="font-mono text-sm">
                            {specialty.sortOrder}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: specialty.color }}
                          />
                          <div>
                            <p className="font-medium text-gray-900">
                              {specialty.icon && (
                                <span className="mr-1">{specialty.icon}</span>
                              )}
                              {specialty.name}
                            </p>
                            {specialty.description && (
                              <p className="text-sm text-gray-500 truncate max-w-xs">
                                {specialty.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {specialty.subcategories.length > 0 ? (
                          <button
                            onClick={() => toggleRowExpand(specialty.id)}
                            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
                          >
                            {specialty.subcategories.length} subcategorías
                            {expandedRows.has(specialty.id) ? (
                              <ChevronUp size={16} />
                            ) : (
                              <ChevronDown size={16} />
                            )}
                          </button>
                        ) : (
                          <span className="text-sm text-gray-400">
                            Sin subcategorías
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => toggleActive(specialty)}
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                            specialty.isActive
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {specialty.isActive ? (
                            <>
                              <ToggleRight size={14} />
                              Activa
                            </>
                          ) : (
                            <>
                              <ToggleLeft size={14} />
                              Inactiva
                            </>
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEditModal(specialty)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                            title="Editar"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(specialty.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                            title="Eliminar"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {/* Expanded subcategories row */}
                    {expandedRows.has(specialty.id) &&
                      specialty.subcategories.length > 0 && (
                        <tr className="bg-gray-50">
                          <td colSpan={5} className="px-4 py-3">
                            <div className="flex flex-wrap gap-2 pl-8">
                              {specialty.subcategories.map((sub, index) => (
                                <span
                                  key={index}
                                  className="px-2 py-1 bg-white border rounded text-sm text-gray-600"
                                >
                                  #{sub}
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Create/Edit Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center p-6 border-b">
                <h2 className="text-xl font-bold">
                  {editingId ? 'Editar Especialidad' : 'Nueva Especialidad'}
                </h2>
                <button
                  onClick={closeModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                {/* Nombre */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-button-green focus:border-transparent"
                    placeholder="Ej: Tecnología"
                    required
                  />
                </div>

                {/* Descripción */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Descripción
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-button-green focus:border-transparent"
                    placeholder="Descripción breve de la especialidad"
                    rows={2}
                  />
                </div>

                {/* Color e Icono */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <Palette size={14} className="inline mr-1" />
                      Color
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={formData.color}
                        onChange={(e) =>
                          setFormData({ ...formData, color: e.target.value })
                        }
                        className="w-12 h-10 rounded cursor-pointer"
                      />
                      <input
                        type="text"
                        value={formData.color}
                        onChange={(e) =>
                          setFormData({ ...formData, color: e.target.value })
                        }
                        className="flex-1 p-2 border rounded-lg text-sm"
                        placeholder="#2b5d62"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Icono (emoji)
                    </label>
                    <input
                      type="text"
                      value={formData.icon}
                      onChange={(e) =>
                        setFormData({ ...formData, icon: e.target.value })
                      }
                      className="w-full p-3 border rounded-lg"
                      placeholder="💻"
                    />
                  </div>
                </div>

                {/* Orden */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Orden de aparición
                  </label>
                  <input
                    type="number"
                    value={formData.sortOrder}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        sortOrder: parseInt(e.target.value) || 0
                      })
                    }
                    className="w-full p-3 border rounded-lg"
                    min="0"
                  />
                </div>

                {/* Subcategorías */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Tag size={14} className="inline mr-1" />
                    Subcategorías
                  </label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={newSubcategory}
                      onChange={(e) => setNewSubcategory(e.target.value)}
                      onKeyPress={(e) =>
                        e.key === 'Enter' &&
                        (e.preventDefault(), addSubcategory())
                      }
                      className="flex-1 p-2 border rounded-lg"
                      placeholder="Agregar subcategoría..."
                    />
                    <button
                      type="button"
                      onClick={addSubcategory}
                      className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg"
                    >
                      <Plus size={20} />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {formData.subcategories.map((sub, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-sm"
                      >
                        #{sub}
                        <button
                          type="button"
                          onClick={() => removeSubcategory(index)}
                          className="text-gray-400 hover:text-red-500"
                        >
                          <X size={14} />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Estado */}
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-gray-700">
                    Estado:
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setFormData({ ...formData, isActive: !formData.isActive })
                    }
                    className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${
                      formData.isActive
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {formData.isActive ? (
                      <>
                        <ToggleRight size={16} />
                        Activa
                      </>
                    ) : (
                      <>
                        <ToggleLeft size={16} />
                        Inactiva
                      </>
                    )}
                  </button>
                </div>

                {/* Buttons */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 px-4 py-3 bg-button-green text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <Loader2 className="animate-spin" size={20} />
                    ) : (
                      <Save size={20} />
                    )}
                    {editingId ? 'Guardar Cambios' : 'Crear Especialidad'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteConfirmId && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-md w-full p-6">
              <div className="text-center">
                <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                  <AlertCircle className="text-red-600" size={32} />
                </div>
                <h3 className="text-xl font-bold mb-2">
                  ¿Eliminar especialidad?
                </h3>
                <p className="text-gray-600 mb-6">
                  Esta acción no se puede deshacer. Si la especialidad está en
                  uso, no podrá eliminarse.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setDeleteConfirmId(null)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => handleDelete(deleteConfirmId)}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                  >
                    Sí, eliminar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
