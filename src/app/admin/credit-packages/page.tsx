// RUTA: src/app/admin/credit-packages/page.tsx

'use client';

import React, { useState, useEffect } from 'react';
import {
  RefreshCw,
  Plus,
  Edit,
  Trash2,
  Coins,
  X,
  Check,
  AlertCircle,
  Package,
  DollarSign,
  Tag
} from 'lucide-react';

interface CreditPackage {
  id: number;
  name: string;
  credits: number;
  price: number;
  pricePerCredit: number;
  badge: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
}

interface FormData {
  name: string;
  credits: number;
  price: number;
  badge: string;
  sortOrder: number;
}

const INITIAL_FORM: FormData = {
  name: '',
  credits: 1,
  price: 4000,
  badge: '',
  sortOrder: 0
};

const BADGE_OPTIONS = [
  { value: '', label: 'Sin badge' },
  { value: 'MÁS POPULAR', label: 'MÁS POPULAR' },
  { value: 'PROMOCIÓN', label: 'PROMOCIÓN' }
];

export default function AdminCreditPackagesPage() {
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState<CreditPackage | null>(null);
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchPackages();
  }, []);

  const fetchPackages = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/admin/credit-packages');
      const data = await response.json();

      if (data.success) {
        setPackages(data.data);
      } else {
        setError(data.error || 'Error al cargar paquetes');
      }
    } catch (err) {
      setError('Error de conexión');
    } finally {
      setIsLoading(false);
    }
  };

  const openNewModal = () => {
    setEditingPackage(null);
    setFormData(INITIAL_FORM);
    setIsModalOpen(true);
  };

  const openEditModal = (pkg: CreditPackage) => {
    setEditingPackage(pkg);
    setFormData({
      name: pkg.name,
      credits: pkg.credits,
      price: pkg.price,
      badge: pkg.badge || '',
      sortOrder: pkg.sortOrder
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingPackage(null);
    setFormData(INITIAL_FORM);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const url = editingPackage
        ? `/api/admin/credit-packages/${editingPackage.id}`
        : '/api/admin/credit-packages';
      const method = editingPackage ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(data.message);
        closeModal();
        fetchPackages();
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

  const handleDelete = async (pkg: CreditPackage) => {
    if (!confirm(`¿Desactivar el paquete "${pkg.name}"?`)) return;

    try {
      const response = await fetch(`/api/admin/credit-packages/${pkg.id}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('Paquete desactivado');
        fetchPackages();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error || 'Error al eliminar');
      }
    } catch (err) {
      setError('Error de conexión');
    }
  };

  const handleToggleActive = async (pkg: CreditPackage) => {
    try {
      const response = await fetch(`/api/admin/credit-packages/${pkg.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !pkg.isActive })
      });

      const data = await response.json();

      if (data.success) {
        fetchPackages();
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Error de conexión');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  // Calcular precio por crédito en el formulario
  const calculatedPricePerCredit = formData.credits > 0
    ? (formData.price / formData.credits).toFixed(2)
    : '0';

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto py-8 px-4">
        {/* Header - Responsive */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-6 md:mb-8">
          <div>
            <h1 className="text-2xl md:text-4xl font-bold text-gray-800 mb-1 md:mb-2">
              Paquetes de Créditos
            </h1>
            <p className="text-gray-600 text-sm md:text-base">
              Configura paquetes disponibles para compra
            </p>
          </div>
          <button
            onClick={openNewModal}
            className="w-full sm:w-auto px-4 md:px-6 py-2 md:py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 font-semibold text-sm md:text-base"
          >
            <Plus size={18} />
            Nuevo Paquete
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

        {/* Info de referencia */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
            <Tag size={18} />
            Referencia de precios (OCC)
          </h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>1 crédito = $4,000 MXN ($4,000/crédito)</li>
            <li>10 créditos = $35,000 MXN ($3,500/crédito) - MÁS POPULAR</li>
            <li>15 créditos = $50,000 MXN ($3,333/crédito)</li>
            <li>20 créditos = $65,000 MXN ($3,250/crédito) - PROMOCIÓN</li>
          </ul>
        </div>

        {/* Tabla */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Orden</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Nombre</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Créditos</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Precio</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Precio/Crédito</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Badge</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Estado</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                      <RefreshCw className="animate-spin mx-auto mb-2" size={24} />
                      Cargando paquetes...
                    </td>
                  </tr>
                ) : packages.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                      <Package className="mx-auto mb-2 text-gray-400" size={40} />
                      No hay paquetes configurados
                      <br />
                      <span className="text-sm">Crea el primer paquete de créditos</span>
                    </td>
                  </tr>
                ) : (
                  packages.map(pkg => (
                    <tr key={pkg.id} className={`hover:bg-gray-50 ${!pkg.isActive ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-3 text-center text-gray-500">
                        {pkg.sortOrder}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-gray-900">{pkg.name}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center gap-1 font-bold text-blue-600">
                          <Coins size={16} />
                          {pkg.credits}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-semibold text-gray-900">
                          {formatCurrency(pkg.price)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-gray-600">
                          {formatCurrency(pkg.pricePerCredit)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {pkg.badge ? (
                          <span className={`px-2 py-1 rounded text-xs font-bold ${
                            pkg.badge === 'MÁS POPULAR'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-orange-100 text-orange-800'
                          }`}>
                            {pkg.badge}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleToggleActive(pkg)}
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            pkg.isActive
                              ? 'bg-green-100 text-green-800 hover:bg-green-200'
                              : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                          }`}
                        >
                          {pkg.isActive ? 'Activo' : 'Inactivo'}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-center gap-1">
                          <button
                            onClick={() => openEditModal(pkg)}
                            className="p-2 text-gray-500 hover:text-yellow-600 hover:bg-yellow-50 rounded"
                            title="Editar"
                          >
                            <Edit size={18} />
                          </button>
                          <button
                            onClick={() => handleDelete(pkg)}
                            className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                            title="Desactivar"
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
        {!isLoading && packages.length > 0 && (
          <div className="mt-4 text-center text-sm text-gray-600">
            {packages.length} paquete{packages.length !== 1 ? 's' : ''} configurado{packages.length !== 1 ? 's' : ''}
            {' • '}
            {packages.filter(p => p.isActive).length} activo{packages.filter(p => p.isActive).length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Modal de crear/editar */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-2xl font-bold">
                {editingPackage ? 'Editar Paquete' : 'Nuevo Paquete'}
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Nombre */}
              <div>
                <label className="block text-sm font-semibold mb-1">Nombre del Paquete *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="ej. Pack 10"
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              {/* Créditos y Precio */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1">Créditos *</label>
                  <input
                    type="number"
                    value={formData.credits}
                    onChange={(e) => setFormData({ ...formData, credits: parseInt(e.target.value) || 0 })}
                    min="1"
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Precio (MXN) *</label>
                  <input
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                    min="1"
                    step="0.01"
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              {/* Precio por crédito calculado */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Precio por crédito:</span>
                  <span className="text-xl font-bold text-green-600">
                    {formatCurrency(parseFloat(calculatedPricePerCredit))}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Se calcula automáticamente
                </p>
              </div>

              {/* Badge */}
              <div>
                <label className="block text-sm font-semibold mb-1">Badge (opcional)</label>
                <select
                  value={formData.badge}
                  onChange={(e) => setFormData({ ...formData, badge: e.target.value })}
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {BADGE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Se mostrará como etiqueta destacada en la página de compra
                </p>
              </div>

              {/* Orden */}
              <div>
                <label className="block text-sm font-semibold mb-1">Orden de aparición</label>
                <input
                  type="number"
                  value={formData.sortOrder}
                  onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
                  min="0"
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Los paquetes se ordenan de menor a mayor
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
                      {editingPackage ? 'Guardar Cambios' : 'Crear Paquete'}
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
