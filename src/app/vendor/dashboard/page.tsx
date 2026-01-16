'use client';

// RUTA: src/app/vendor/dashboard/page.tsx

import React, { useState, useEffect } from 'react';
import {
  Copy,
  Check,
  Edit2,
  Save,
  X,
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle,
  ExternalLink,
  Loader2,
  Gift,
  AlertCircle
} from 'lucide-react';

interface DiscountCode {
  id: number;
  code: string;
  discountPercent: number;
  commissionPercent: number;
  isActive: boolean;
  createdAt: string;
  _count?: {
    uses: number;
  };
}

interface Sale {
  id: number;
  company: {
    id: number;
    nombre: string;
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

interface Summary {
  totalSales: number;
  totalCommission: number;
  pendingCommission: number;
  paidCommission: number;
}

export default function VendorDashboardPage() {
  // Estado para código de descuento
  const [discountCode, setDiscountCode] = useState<DiscountCode | null>(null);
  const [loadingCode, setLoadingCode] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [savingCode, setSavingCode] = useState(false);
  const [copied, setCopied] = useState(false);

  // Estado para ventas
  const [sales, setSales] = useState<Sale[]>([]);
  const [summary, setSummary] = useState<Summary>({
    totalSales: 0,
    totalCommission: 0,
    pendingCommission: 0,
    paidCommission: 0
  });
  const [loadingSales, setLoadingSales] = useState(true);

  // Cargar código al montar
  useEffect(() => {
    fetchDiscountCode();
    fetchSales();
  }, []);

  const fetchDiscountCode = async () => {
    try {
      setLoadingCode(true);
      const res = await fetch('/api/vendor/my-code');
      const data = await res.json();

      if (data.success && data.data) {
        setDiscountCode(data.data);
        setNewCode(data.data.code);
      }
    } catch (error) {
      console.error('Error fetching discount code:', error);
    } finally {
      setLoadingCode(false);
    }
  };

  const fetchSales = async () => {
    try {
      setLoadingSales(true);
      const res = await fetch('/api/vendor/my-sales');
      const data = await res.json();

      if (data.success) {
        setSales(data.data.sales || []);
        setSummary(data.data.summary || {
          totalSales: 0,
          totalCommission: 0,
          pendingCommission: 0,
          paidCommission: 0
        });
      }
    } catch (error) {
      console.error('Error fetching sales:', error);
    } finally {
      setLoadingSales(false);
    }
  };

  const validateCode = (code: string): string | null => {
    if (!code) return 'El código es requerido';
    if (code.length < 4) return 'Mínimo 4 caracteres';
    if (code.length > 20) return 'Máximo 20 caracteres';
    if (!/^[a-zA-Z0-9]+$/.test(code)) return 'Solo letras y números';
    return null;
  };

  const handleSaveCode = async () => {
    const error = validateCode(newCode);
    if (error) {
      setCodeError(error);
      return;
    }

    setSavingCode(true);
    setCodeError('');

    try {
      const method = discountCode ? 'PUT' : 'POST';
      const res = await fetch('/api/vendor/my-code', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: newCode })
      });

      const data = await res.json();

      if (data.success) {
        setDiscountCode(data.data);
        setIsEditing(false);
        fetchSales(); // Recargar ventas
      } else {
        setCodeError(data.error || 'Error al guardar');
      }
    } catch (error) {
      setCodeError('Error de conexión');
    } finally {
      setSavingCode(false);
    }
  };

  const copyToClipboard = async () => {
    if (!discountCode) return;

    try {
      await navigator.clipboard.writeText(discountCode.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Error copying:', error);
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'approved':
        return 'bg-blue-100 text-blue-800';
      case 'pending':
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Panel de Vendedor</h1>
          <p className="text-gray-600 mt-1 text-sm md:text-base">
            Gestiona tu código de descuento y visualiza tus comisiones
          </p>
        </div>

        {/* Resumen de Comisiones */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
          <div className="bg-white rounded-lg shadow p-3 md:p-6">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="p-2 md:p-3 bg-blue-100 rounded-lg">
                <TrendingUp className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-xs md:text-sm text-gray-500">Ventas</p>
                <p className="text-xl md:text-2xl font-bold">{summary.totalSales}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-3 md:p-6">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="p-2 md:p-3 bg-green-100 rounded-lg">
                <DollarSign className="w-5 h-5 md:w-6 md:h-6 text-green-600" />
              </div>
              <div>
                <p className="text-xs md:text-sm text-gray-500">Totales</p>
                <p className="text-lg md:text-2xl font-bold">{formatCurrency(summary.totalCommission)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-3 md:p-6">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="p-2 md:p-3 bg-yellow-100 rounded-lg">
                <Clock className="w-5 h-5 md:w-6 md:h-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-xs md:text-sm text-gray-500">Pendientes</p>
                <p className="text-lg md:text-2xl font-bold">{formatCurrency(summary.pendingCommission)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-3 md:p-6">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="p-2 md:p-3 bg-emerald-100 rounded-lg">
                <CheckCircle className="w-5 h-5 md:w-6 md:h-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs md:text-sm text-gray-500">Pagadas</p>
                <p className="text-lg md:text-2xl font-bold">{formatCurrency(summary.paidCommission)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Mi Código de Descuento */}
        <div className="bg-white rounded-lg shadow mb-6 md:mb-8">
          <div className="p-4 md:p-6 border-b">
            <h2 className="text-lg md:text-xl font-semibold flex items-center gap-2">
              <Gift className="w-5 h-5 text-button-orange" />
              Mi Código de Descuento
            </h2>
          </div>

          <div className="p-4 md:p-6">
            {loadingCode ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
              </div>
            ) : !discountCode && !isEditing ? (
              // No tiene código - mostrar formulario de creación
              <div className="text-center py-8">
                <Gift className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Aún no tienes un código de descuento
                </h3>
                <p className="text-gray-500 mb-6">
                  Crea tu código personalizado y gana comisiones cuando las empresas lo usen
                </p>
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-6 py-3 bg-button-green text-white rounded-lg hover:bg-green-700 font-semibold"
                >
                  Crear Mi Código
                </button>
              </div>
            ) : isEditing ? (
              // Modo edición
              <div className="max-w-md">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tu código de descuento
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newCode}
                    onChange={(e) => {
                      setNewCode(e.target.value.toUpperCase());
                      setCodeError('');
                    }}
                    placeholder="Ej: EDUARDO10"
                    className={`flex-1 px-4 py-3 border rounded-lg uppercase ${
                      codeError ? 'border-red-500' : 'border-gray-300'
                    }`}
                    maxLength={20}
                  />
                  <button
                    onClick={handleSaveCode}
                    disabled={savingCode}
                    className="px-4 py-3 bg-button-green text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    {savingCode ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Save className="w-5 h-5" />
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      setNewCode(discountCode?.code || '');
                      setCodeError('');
                    }}
                    className="px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                {codeError && (
                  <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {codeError}
                  </p>
                )}
                <p className="mt-2 text-sm text-gray-500">
                  Solo letras y números, entre 4 y 20 caracteres
                </p>
              </div>
            ) : discountCode && (
              // Mostrar código existente
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-3xl font-bold text-button-green">
                      {discountCode.code}
                    </span>
                    <button
                      onClick={copyToClipboard}
                      className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Copiar código"
                    >
                      {copied ? (
                        <Check className="w-5 h-5 text-green-600" />
                      ) : (
                        <Copy className="w-5 h-5" />
                      )}
                    </button>
                    <button
                      onClick={() => setIsEditing(true)}
                      className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Editar código"
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>
                  </div>
                  <p className="text-gray-600">
                    {discountCode.discountPercent}% de descuento para clientes ·
                    {discountCode.commissionPercent}% de comisión para ti
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    Creado el {formatDate(discountCode.createdAt)}
                  </p>
                </div>

                <div className={`px-4 py-2 rounded-full text-sm font-medium ${
                  discountCode.isActive
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {discountCode.isActive ? 'Activo' : 'Inactivo'}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Historial de Ventas */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 md:p-6 border-b">
            <h2 className="text-lg md:text-xl font-semibold">Historial de Ventas</h2>
            <p className="text-gray-500 text-xs md:text-sm mt-1">
              Ventas realizadas usando tu código de descuento
            </p>
          </div>

          {loadingSales ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : sales.length === 0 ? (
            <div className="text-center py-12 px-4">
              <TrendingUp className="w-12 h-12 md:w-16 md:h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-base md:text-lg font-medium text-gray-900 mb-2">
                Aún no tienes ventas
              </h3>
              <p className="text-gray-500 text-sm">
                Comparte tu código con empresas para empezar a ganar comisiones
              </p>
            </div>
          ) : (
            <>
              {/* Mobile Cards */}
              <div className="md:hidden p-4 space-y-4">
                {sales.map((sale) => (
                  <div key={sale.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <p className="font-medium text-gray-900">
                          {sale.company.nombreEmpresa}
                        </p>
                        <p className="text-xs text-gray-500">
                          {sale.purchase.credits} créditos • {formatDate(sale.createdAt)}
                        </p>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        getStatusColor(sale.commission.status)
                      }`}>
                        {sale.commission.statusLabel}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                      <div>
                        <p className="text-gray-500 text-xs">Original</p>
                        <p>{formatCurrency(sale.purchase.originalPrice)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs">Descuento</p>
                        <p className="text-red-600">-{formatCurrency(sale.purchase.discountAmount)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs">Final</p>
                        <p className="font-medium">{formatCurrency(sale.purchase.finalPrice)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs">Mi Comisión</p>
                        <p className="font-bold text-button-green">{formatCurrency(sale.commission.amount)}</p>
                      </div>
                    </div>

                    {sale.commission.proofUrl && (
                      <a
                        href={sale.commission.proofUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-button-green hover:underline inline-flex items-center gap-1 text-sm"
                      >
                        Ver comprobante <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                ))}
              </div>

              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Empresa
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Fecha
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        Original
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        Descuento
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        Final
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        Mi Comisión
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                        Estado
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                        Comprobante
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {sales.map((sale) => (
                      <tr key={sale.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div>
                            <p className="font-medium text-gray-900">
                              {sale.company.nombreEmpresa}
                            </p>
                            <p className="text-sm text-gray-500">
                              {sale.purchase.credits} créditos
                            </p>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {formatDate(sale.createdAt)}
                        </td>
                        <td className="px-6 py-4 text-right text-sm text-gray-500">
                          {formatCurrency(sale.purchase.originalPrice)}
                        </td>
                        <td className="px-6 py-4 text-right text-sm text-red-600">
                          -{formatCurrency(sale.purchase.discountAmount)}
                        </td>
                        <td className="px-6 py-4 text-right text-sm font-medium">
                          {formatCurrency(sale.purchase.finalPrice)}
                        </td>
                        <td className="px-6 py-4 text-right text-sm font-bold text-button-green">
                          {formatCurrency(sale.commission.amount)}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            getStatusColor(sale.commission.status)
                          }`}>
                            {sale.commission.statusLabel}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          {sale.commission.proofUrl ? (
                            <a
                              href={sale.commission.proofUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-button-green hover:underline inline-flex items-center gap-1"
                            >
                              Ver <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Info sobre pagos */}
        <div className="mt-6 md:mt-8 p-4 md:p-6 bg-blue-50 rounded-lg border border-blue-200">
          <h3 className="font-semibold text-blue-900 mb-2 text-sm md:text-base">
            Información sobre pagos de comisiones
          </h3>
          <ul className="text-xs md:text-sm text-blue-800 space-y-1">
            <li>• Las comisiones se pagan dentro de los 4 meses siguientes a la venta</li>
            <li>• Recibirás un comprobante de pago cuando se procese tu comisión</li>
            <li>• Si tienes dudas, contacta al administrador</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
