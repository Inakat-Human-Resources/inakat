'use client';

// RUTA: src/app/admin/vendors/page.tsx

import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  DollarSign,
  Clock,
  CheckCircle,
  Search,
  Filter,
  ExternalLink,
  Loader2,
  X,
  Upload,
  AlertCircle,
  TrendingUp,
  Eye
} from 'lucide-react';

interface Vendor {
  id: number;
  code: string;
  discountPercent: number;
  commissionPercent: number;
  isActive: boolean;
  createdAt: string;
  user: {
    id: number;
    nombre: string;
    email: string;
    role: string;
  };
  stats: {
    totalSales: number;
    totalRevenue: number;
    totalCommission: number;
    pendingCommission: number;
    paidCommission: number;
  };
}

interface Commission {
  id: number;
  vendor: {
    id: number;
    nombre: string;
    email: string;
    code: string;
  };
  company: {
    id: number;
    nombre: string;
    email: string;
    nombreEmpresa: string;
  };
  purchase: {
    id: number;
    credits: number;
    originalPrice: number;
    discountAmount: number;
    finalPrice: number;
  };
  commission: {
    amount: number;
    status: string;
    statusLabel: string;
    paidAt: string | null;
    dueDate: string | null;
    proofUrl: string | null;
  };
  createdAt: string;
}

interface GlobalStats {
  totalVendors: number;
  totalSales: number;
  totalRevenue: number;
  totalCommissions: number;
  pendingCommissions: number;
}

export default function AdminVendorsPage() {
  // Estado para vendedores
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loadingVendors, setLoadingVendors] = useState(true);
  const [globalStats, setGlobalStats] = useState<GlobalStats>({
    totalVendors: 0,
    totalSales: 0,
    totalRevenue: 0,
    totalCommissions: 0,
    pendingCommissions: 0
  });
  const [vendorSearch, setVendorSearch] = useState('');

  // Estado para comisiones
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [loadingCommissions, setLoadingCommissions] = useState(true);
  const [commissionFilter, setCommissionFilter] = useState<'all' | 'pending' | 'paid'>('pending');
  const [commissionSummary, setCommissionSummary] = useState({
    pending: { count: 0, total: 0 },
    paid: { count: 0, total: 0 }
  });

  // Modal de pago
  const [paymentModal, setPaymentModal] = useState<{
    isOpen: boolean;
    commission: Commission | null;
  }>({ isOpen: false, commission: null });
  const [paymentProofUrl, setPaymentProofUrl] = useState('');
  const [processingPayment, setProcessingPayment] = useState(false);

  // Tab activa
  const [activeTab, setActiveTab] = useState<'vendors' | 'pending' | 'history'>('vendors');

  // Notificación
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });

  // Cargar datos al montar
  useEffect(() => {
    fetchVendors();
    fetchCommissions();
  }, []);

  // Recargar comisiones cuando cambia el filtro
  useEffect(() => {
    fetchCommissions();
  }, [commissionFilter]);

  const fetchVendors = async () => {
    try {
      setLoadingVendors(true);
      const res = await fetch(`/api/admin/vendors?search=${vendorSearch}`);
      const data = await res.json();

      if (data.success) {
        setVendors(data.data.vendors || []);
        setGlobalStats(data.data.globalStats || {
          totalVendors: 0,
          totalSales: 0,
          totalRevenue: 0,
          totalCommissions: 0,
          pendingCommissions: 0
        });
      }
    } catch (error) {
      console.error('Error fetching vendors:', error);
    } finally {
      setLoadingVendors(false);
    }
  };

  const fetchCommissions = async () => {
    try {
      setLoadingCommissions(true);
      const statusParam = commissionFilter !== 'all' ? `?status=${commissionFilter}` : '';
      const res = await fetch(`/api/admin/vendors/commissions${statusParam}`);
      const data = await res.json();

      if (data.success) {
        setCommissions(data.data.commissions || []);
        setCommissionSummary(data.data.summary || {
          pending: { count: 0, total: 0 },
          paid: { count: 0, total: 0 }
        });
      }
    } catch (error) {
      console.error('Error fetching commissions:', error);
    } finally {
      setLoadingCommissions(false);
    }
  };

  const handleSearchVendors = useCallback(() => {
    fetchVendors();
  }, [vendorSearch]);

  const handleMarkAsPaid = async () => {
    if (!paymentModal.commission) return;

    setProcessingPayment(true);
    try {
      const res = await fetch(`/api/admin/vendors/commissions/${paymentModal.commission.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'paid',
          paymentProofUrl: paymentProofUrl || null
        })
      });

      const data = await res.json();

      if (data.success) {
        setPaymentModal({ isOpen: false, commission: null });
        setPaymentProofUrl('');
        fetchCommissions();
        fetchVendors(); // Actualizar stats
        setNotification({ type: 'success', message: 'Pago registrado exitosamente' });
      } else {
        setNotification({ type: 'error', message: data.error || 'Error al procesar pago' });
      }
    } catch (error) {
      console.error('Error marking as paid:', error);
      setNotification({ type: 'error', message: 'Error de conexión' });
    } finally {
      setProcessingPayment(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getRoleLabel = (role: string) => {
    const roles: Record<string, string> = {
      admin: 'Administrador',
      company: 'Empresa',
      recruiter: 'Reclutador',
      specialist: 'Especialista',
      candidate: 'Candidato',
      user: 'Usuario'
    };
    return roles[role] || role;
  };

  const getRoleColor = (role: string) => {
    const colors: Record<string, string> = {
      admin: 'bg-purple-100 text-purple-800',
      company: 'bg-blue-100 text-blue-800',
      recruiter: 'bg-green-100 text-green-800',
      specialist: 'bg-orange-100 text-orange-800',
      candidate: 'bg-cyan-100 text-cyan-800',
      user: 'bg-gray-100 text-gray-800'
    };
    return colors[role] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header - Responsive */}
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Gestión de Vendedores</h1>
          <p className="text-gray-600 mt-1 text-sm md:text-base">
            Códigos de descuento y comisiones
          </p>
        </div>

        {/* Notificación */}
        {notification.type && (
          <div
            className={`mb-6 p-4 rounded-lg flex items-center justify-between ${
              notification.type === 'success'
                ? 'bg-green-100 text-green-800 border border-green-300'
                : 'bg-red-100 text-red-800 border border-red-300'
            }`}
          >
            <span>{notification.message}</span>
            <button
              onClick={() => setNotification({ type: null, message: '' })}
              className="ml-4 hover:opacity-70 text-xl"
            >
              ×
            </button>
          </div>
        )}

        {/* Stats Globales - Responsive */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4 mb-6 md:mb-8">
          <div className="bg-white rounded-lg shadow p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Users className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Vendedores</p>
                <p className="text-xl font-bold">{globalStats.totalVendors}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <TrendingUp className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Ventas</p>
                <p className="text-xl font-bold">{globalStats.totalSales}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <DollarSign className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Ingresos</p>
                <p className="text-xl font-bold">{formatCurrency(globalStats.totalRevenue)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Clock className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Pendiente</p>
                <p className="text-xl font-bold text-yellow-600">
                  {formatCurrency(globalStats.pendingCommissions)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Total Comisiones</p>
                <p className="text-xl font-bold">{formatCurrency(globalStats.totalCommissions)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="border-b">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab('vendors')}
                className={`px-6 py-4 text-sm font-medium border-b-2 ${
                  activeTab === 'vendors'
                    ? 'border-button-green text-button-green'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Users className="w-4 h-4 inline mr-2" />
                Vendedores ({globalStats.totalVendors})
              </button>
              <button
                onClick={() => {
                  setActiveTab('pending');
                  setCommissionFilter('pending');
                }}
                className={`px-6 py-4 text-sm font-medium border-b-2 ${
                  activeTab === 'pending'
                    ? 'border-button-green text-button-green'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Clock className="w-4 h-4 inline mr-2" />
                Pendientes ({commissionSummary.pending.count})
              </button>
              <button
                onClick={() => {
                  setActiveTab('history');
                  setCommissionFilter('paid');
                }}
                className={`px-6 py-4 text-sm font-medium border-b-2 ${
                  activeTab === 'history'
                    ? 'border-button-green text-button-green'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <CheckCircle className="w-4 h-4 inline mr-2" />
                Historial de Pagos
              </button>
            </nav>
          </div>

          {/* Tab: Vendedores */}
          {activeTab === 'vendors' && (
            <div>
              {/* Búsqueda */}
              <div className="p-4 border-b">
                <div className="flex gap-2">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={vendorSearch}
                      onChange={(e) => setVendorSearch(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSearchVendors()}
                      placeholder="Buscar por código, nombre o email..."
                      className="w-full pl-10 pr-4 py-2 border rounded-lg"
                    />
                  </div>
                  <button
                    onClick={handleSearchVendors}
                    className="px-4 py-2 bg-button-green text-white rounded-lg hover:bg-green-700"
                  >
                    Buscar
                  </button>
                </div>
              </div>

              {/* Tabla de vendedores */}
              <div className="overflow-x-auto">
                {loadingVendors ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                  </div>
                ) : vendors.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      No hay vendedores registrados
                    </h3>
                  </div>
                ) : (
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Vendedor
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Rol
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                          Código
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                          Ventas
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                          Ingresos
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                          Comisiones
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                          Estado
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {vendors.map((vendor) => (
                        <tr key={vendor.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <div>
                              <p className="font-medium text-gray-900">
                                {vendor.user.nombre}
                              </p>
                              <p className="text-sm text-gray-500">
                                {vendor.user.email}
                              </p>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              getRoleColor(vendor.user.role)
                            }`}>
                              {getRoleLabel(vendor.user.role)}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="font-mono font-bold text-button-green">
                              {vendor.code}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right font-medium">
                            {vendor.stats.totalSales}
                          </td>
                          <td className="px-6 py-4 text-right">
                            {formatCurrency(vendor.stats.totalRevenue)}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div>
                              <p className="font-medium">
                                {formatCurrency(vendor.stats.totalCommission)}
                              </p>
                              {vendor.stats.pendingCommission > 0 && (
                                <p className="text-xs text-yellow-600">
                                  {formatCurrency(vendor.stats.pendingCommission)} pendiente
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                              vendor.isActive
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {vendor.isActive ? 'Activo' : 'Inactivo'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* Tab: Comisiones Pendientes */}
          {activeTab === 'pending' && (
            <div>
              <div className="p-4 border-b bg-yellow-50">
                <div className="flex items-center gap-2 text-yellow-800">
                  <AlertCircle className="w-5 h-5" />
                  <span className="font-medium">
                    {commissionSummary.pending.count} comisiones pendientes por{' '}
                    {formatCurrency(commissionSummary.pending.total)}
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                {loadingCommissions ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                  </div>
                ) : commissions.length === 0 ? (
                  <div className="text-center py-12">
                    <CheckCircle className="w-16 h-16 text-green-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      No hay comisiones pendientes
                    </h3>
                    <p className="text-gray-500">
                      Todas las comisiones han sido pagadas
                    </p>
                  </div>
                ) : (
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Vendedor
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Empresa
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                          Fecha Venta
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                          Monto Venta
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                          Comisión
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                          Fecha Límite
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                          Acción
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {commissions.map((comm) => (
                        <tr key={comm.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <div>
                              <p className="font-medium text-gray-900">
                                {comm.vendor.nombre}
                              </p>
                              <p className="text-sm text-gray-500">
                                Código: {comm.vendor.code}
                              </p>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div>
                              <p className="font-medium text-gray-900">
                                {comm.company.nombreEmpresa}
                              </p>
                              <p className="text-sm text-gray-500">
                                {comm.purchase.credits} créditos
                              </p>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center text-sm">
                            {formatDate(comm.createdAt)}
                          </td>
                          <td className="px-6 py-4 text-right">
                            {formatCurrency(comm.purchase.finalPrice)}
                          </td>
                          <td className="px-6 py-4 text-right font-bold text-button-green">
                            {formatCurrency(comm.commission.amount)}
                          </td>
                          <td className="px-6 py-4 text-center text-sm">
                            {comm.commission.dueDate
                              ? formatDate(comm.commission.dueDate)
                              : '-'}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <button
                              onClick={() => setPaymentModal({ isOpen: true, commission: comm })}
                              className="px-4 py-2 bg-button-green text-white text-sm rounded-lg hover:bg-green-700"
                            >
                              Marcar Pagada
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* Tab: Historial de Pagos */}
          {activeTab === 'history' && (
            <div>
              <div className="p-4 border-b bg-green-50">
                <div className="flex items-center gap-2 text-green-800">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-medium">
                    {commissionSummary.paid.count} comisiones pagadas por{' '}
                    {formatCurrency(commissionSummary.paid.total)}
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                {loadingCommissions ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                  </div>
                ) : commissions.length === 0 ? (
                  <div className="text-center py-12">
                    <Clock className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      No hay pagos realizados
                    </h3>
                  </div>
                ) : (
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Vendedor
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Empresa
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                          Fecha Venta
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                          Comisión
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                          Fecha Pago
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                          Comprobante
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {commissions.map((comm) => (
                        <tr key={comm.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <div>
                              <p className="font-medium text-gray-900">
                                {comm.vendor.nombre}
                              </p>
                              <p className="text-sm text-gray-500">
                                {comm.vendor.email}
                              </p>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-gray-900">
                              {comm.company.nombreEmpresa}
                            </p>
                          </td>
                          <td className="px-6 py-4 text-center text-sm">
                            {formatDate(comm.createdAt)}
                          </td>
                          <td className="px-6 py-4 text-right font-bold text-green-600">
                            {formatCurrency(comm.commission.amount)}
                          </td>
                          <td className="px-6 py-4 text-center text-sm">
                            {comm.commission.paidAt
                              ? formatDate(comm.commission.paidAt)
                              : '-'}
                          </td>
                          <td className="px-6 py-4 text-center">
                            {comm.commission.proofUrl ? (
                              <a
                                href={comm.commission.proofUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-button-green hover:underline"
                              >
                                <Eye className="w-4 h-4" />
                                Ver
                              </a>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Pago */}
      {paymentModal.isOpen && paymentModal.commission && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6 border-b flex justify-between items-center">
              <h3 className="text-lg font-semibold">Marcar Comisión como Pagada</h3>
              <button
                onClick={() => setPaymentModal({ isOpen: false, commission: null })}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Vendedor</p>
                    <p className="font-medium">{paymentModal.commission.vendor.nombre}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Código</p>
                    <p className="font-mono font-bold text-button-green">
                      {paymentModal.commission.vendor.code}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Empresa</p>
                    <p className="font-medium">{paymentModal.commission.company.nombreEmpresa}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Comisión a Pagar</p>
                    <p className="text-xl font-bold text-button-green">
                      {formatCurrency(paymentModal.commission.commission.amount)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  URL del Comprobante de Pago (opcional)
                </label>
                <input
                  type="url"
                  value={paymentProofUrl}
                  onChange={(e) => setPaymentProofUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-4 py-2 border rounded-lg"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Puedes subir el comprobante a un servicio externo y pegar la URL
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setPaymentModal({ isOpen: false, commission: null })}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleMarkAsPaid}
                  disabled={processingPayment}
                  className="flex-1 px-4 py-2 bg-button-green text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {processingPayment ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Procesando...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Confirmar Pago
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
