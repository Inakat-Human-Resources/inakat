'use client';

// RUTA: src/app/admin/vendors/page.tsx

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users,
  DollarSign,
  Clock,
  CheckCircle,
  Search,
  Loader2,
  X,
  AlertCircle,
  TrendingUp,
  Eye,
  EyeOff,
  Plus
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

interface Pagination {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
}

// Cuántas filas pide la página por tanda (es también el valor por omisión de las APIs)
const FILAS_POR_PAGINA = 20;

const PAGINACION_VACIA: Pagination = {
  page: 1,
  limit: FILAS_POR_PAGINA,
  totalCount: 0,
  totalPages: 1
};

// PAGO-036: el modal no es un <form>, así que el navegador no valida nada de
// lo que escribe el admin. Estas son las mismas reglas que aplica el servidor.
const FORMATO_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const FORMATO_CODIGO = /^[A-Z0-9]{4,20}$/;

/**
 * PAGO-013: el comprobante se guarda tal cual y luego se pinta como enlace en
 * el panel del vendedor. Sin esquema, 'drive.google.com/x' se convierte en una
 * ruta relativa que lleva a un 404.
 */
function esEnlaceValido(valor: string): boolean {
  try {
    const url = new URL(valor);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * PAGO-011: los porcentajes se guardan como texto mientras se escriben (para
 * que borrar el campo no se convierta en un 0 silencioso) y se validan al
 * enviar. El servidor recortaba a [0,100] sin avisar: 100% de descuento deja el
 * precio en 0 y Mercado Pago no puede cobrar eso.
 */
function leerPorcentaje(valor: string): number | null {
  const texto = valor.trim();
  if (texto === '') return null;
  const numero = Number(texto);
  if (!Number.isFinite(numero) || numero < 0 || numero >= 100) return null;
  return numero;
}

/**
 * PAGO-007: las APIs devuelven 20 filas por tanda y la página no tenía forma de
 * pedir la siguiente. Los contadores decían "27 pendientes" y la tabla enseñaba
 * 20; como se ordenan por fecha descendente, las que quedaban escondidas eran
 * justo las más antiguas, las más cercanas a su fecha límite de pago.
 */
function ControlesPaginacion({
  pagination,
  page,
  onChange,
  etiqueta
}: {
  pagination: Pagination;
  page: number;
  onChange: (nuevaPagina: number) => void;
  etiqueta: string;
}) {
  if (pagination.totalPages <= 1) return null;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 sm:px-6 py-4 border-t">
      <p className="text-sm text-gray-600">
        Página {page} de {pagination.totalPages} · {pagination.totalCount} {etiqueta}
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Anterior
        </button>
        <button
          onClick={() => onChange(page + 1)}
          disabled={page >= pagination.totalPages}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}

/**
 * PAGO-008: un 401 o un 500 no pueden pintarse como "no hay comisiones
 * pendientes / todas han sido pagadas". El admin concluía que no debía nada.
 */
function AvisoDeError({ mensaje, onReintentar }: { mensaje: string; onReintentar: () => void }) {
  return (
    <div className="text-center py-12 px-4">
      <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
      <h3 className="text-lg font-medium text-gray-900 mb-2">No se pudieron cargar los datos</h3>
      <p className="text-gray-500 text-sm mb-4">{mensaje}</p>
      <button
        onClick={onReintentar}
        className="px-4 py-2 bg-button-green text-white rounded-lg hover:bg-green-700 text-sm font-medium"
      >
        Reintentar
      </button>
    </div>
  );
}

export default function AdminVendorsPage() {
  const router = useRouter();
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
  // PAGO-007: la API pagina de 20 en 20; la página tiene que llevar la cuenta.
  const [vendorPage, setVendorPage] = useState(1);
  const [vendorPagination, setVendorPagination] = useState<Pagination>(PAGINACION_VACIA);
  // PAGO-008: un 401/500 no puede confundirse con "no hay nada".
  const [vendorsError, setVendorsError] = useState<string | null>(null);

  // Estado para comisiones
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [loadingCommissions, setLoadingCommissions] = useState(true);
  const [commissionFilter, setCommissionFilter] = useState<'all' | 'pending' | 'paid'>('pending');
  const [commissionPage, setCommissionPage] = useState(1);
  const [commissionPagination, setCommissionPagination] = useState<Pagination>(PAGINACION_VACIA);
  const [commissionsError, setCommissionsError] = useState<string | null>(null);
  const [commissionSummary, setCommissionSummary] = useState({
    pending: { count: 0, total: 0 },
    paid: { count: 0, total: 0 }
  });

  // PAGO-028: cada cambio de pestaña lanza una petición; si llegan desordenadas
  // ganaba la última EN LLEGAR, no la última pedida (y "Pendientes" acababa
  // mostrando comisiones ya pagadas, con su botón de "Marcar Pagada").
  const peticionComisiones = useRef(0);
  const peticionVendedores = useRef(0);

  // Modal de pago
  const [paymentModal, setPaymentModal] = useState<{
    isOpen: boolean;
    commission: Commission | null;
  }>({ isOpen: false, commission: null });
  const [paymentProofUrl, setPaymentProofUrl] = useState('');
  const [proofError, setProofError] = useState('');
  const [processingPayment, setProcessingPayment] = useState(false);

  // Tab activa
  const [activeTab, setActiveTab] = useState<'vendors' | 'pending' | 'history'>('vendors');

  // Notificación
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });

  // Modal crear vendedor
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [creatingVendor, setCreatingVendor] = useState(false);
  const [createError, setCreateError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [createForm, setCreateForm] = useState({
    nombre: '',
    apellidoPaterno: '',
    apellidoMaterno: '',
    email: '',
    password: '',
    code: '',
    // PAGO-011: texto mientras se escribe, número al enviar.
    discountPercent: '10',
    commissionPercent: '10'
  });

  // Cargar vendedores al montar y cuando cambia la página
  useEffect(() => {
    fetchVendors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorPage]);

  // PAGO-028: un solo efecto para las comisiones. Antes había dos (montaje y
  // filtro) y al abrir la página se pedían las comisiones dos veces.
  useEffect(() => {
    fetchCommissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commissionFilter, commissionPage]);

  /** Sesión caducada: al login, sin dejar la pantalla mintiendo con ceros. */
  const manejarNoAutorizado = () => {
    router.push('/login');
  };

  const fetchVendors = async () => {
    const idPeticion = ++peticionVendedores.current;
    try {
      setLoadingVendors(true);
      const params = new URLSearchParams({
        page: String(vendorPage),
        limit: String(FILAS_POR_PAGINA)
      });
      if (vendorSearch.trim()) params.set('search', vendorSearch.trim());

      const res = await fetch(`/api/admin/vendors?${params.toString()}`);
      const data = await res.json().catch(() => null);

      if (idPeticion !== peticionVendedores.current) return;

      if (res.status === 401) {
        manejarNoAutorizado();
        return;
      }

      if (!res.ok || !data?.success) {
        setVendors([]);
        setVendorsError(data?.error || 'No se pudieron cargar los vendedores.');
        return;
      }

      setVendorsError(null);
      setVendors(data.data.vendors || []);
      setGlobalStats(data.data.globalStats || {
        totalVendors: 0,
        totalSales: 0,
        totalRevenue: 0,
        totalCommissions: 0,
        pendingCommissions: 0
      });
      setVendorPagination(data.data.pagination || PAGINACION_VACIA);
    } catch (error) {
      console.error('Error fetching vendors:', error);
      if (idPeticion !== peticionVendedores.current) return;
      setVendors([]);
      setVendorsError('Error de conexión al cargar los vendedores. Intenta recargar la página.');
    } finally {
      if (idPeticion === peticionVendedores.current) setLoadingVendors(false);
    }
  };

  // PAGO-009/PAGO-020: activar o desactivar el código de un vendedor desde el
  // panel (PATCH /api/admin/vendors/[id]). Antes el estado era de sólo lectura.
  const [togglingVendorId, setTogglingVendorId] = useState<number | null>(null);

  const handleToggleVendor = async (vendor: Vendor) => {
    const activar = !vendor.isActive;
    const pregunta = activar
      ? `¿Reactivar el código ${vendor.code}? Volverá a dar descuento y a generar comisiones.`
      : `¿Desactivar el código ${vendor.code}? Dejará de dar descuento y de generar comisiones. El vendedor no podrá reactivarlo por su cuenta.`;
    if (!confirm(pregunta)) return;

    setTogglingVendorId(vendor.id);
    try {
      const res = await fetch(`/api/admin/vendors/${vendor.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: activar })
      });
      const data = await res.json().catch(() => null);

      if (res.status === 401) {
        manejarNoAutorizado();
        return;
      }

      if (!res.ok || !data?.success) {
        setNotification({ type: 'error', message: data?.error || 'No se pudo actualizar el código' });
        return;
      }

      setVendors((prev) => prev.map((v) => (v.id === vendor.id ? { ...v, isActive: activar } : v)));
      setNotification({
        type: 'success',
        message: activar ? `Código ${vendor.code} reactivado` : `Código ${vendor.code} desactivado`
      });
    } catch {
      setNotification({ type: 'error', message: 'Error de conexión' });
    } finally {
      setTogglingVendorId(null);
    }
  };

  const fetchCommissions = async () => {
    const idPeticion = ++peticionComisiones.current;
    try {
      setLoadingCommissions(true);
      const params = new URLSearchParams({
        page: String(commissionPage),
        limit: String(FILAS_POR_PAGINA)
      });
      if (commissionFilter !== 'all') params.set('status', commissionFilter);

      const res = await fetch(`/api/admin/vendors/commissions?${params.toString()}`);
      const data = await res.json().catch(() => null);

      // PAGO-028: si mientras tanto se pidió otra cosa, esta respuesta se tira.
      if (idPeticion !== peticionComisiones.current) return;

      if (res.status === 401) {
        manejarNoAutorizado();
        return;
      }

      if (!res.ok || !data?.success) {
        setCommissions([]);
        setCommissionsError(data?.error || 'No se pudieron cargar las comisiones.');
        return;
      }

      setCommissionsError(null);
      setCommissions(data.data.commissions || []);
      setCommissionSummary(data.data.summary || {
        pending: { count: 0, total: 0 },
        paid: { count: 0, total: 0 }
      });
      setCommissionPagination(data.data.pagination || PAGINACION_VACIA);
    } catch (error) {
      console.error('Error fetching commissions:', error);
      if (idPeticion !== peticionComisiones.current) return;
      setCommissions([]);
      setCommissionsError('Error de conexión al cargar las comisiones. Intenta recargar la página.');
    } finally {
      if (idPeticion === peticionComisiones.current) setLoadingCommissions(false);
    }
  };

  const handleSearchVendors = () => {
    // Una búsqueda nueva siempre empieza en la primera página.
    if (vendorPage !== 1) {
      setVendorPage(1);
    } else {
      fetchVendors();
    }
  };

  /**
   * PAGO-010: el comprobante vivía en un estado que sólo se limpiaba al
   * terminar bien. Al cancelar y abrir otra comisión, el campo venía relleno
   * con la URL de la anterior y se guardaba en la comisión equivocada.
   */
  const abrirModalPago = (commission: Commission) => {
    setPaymentProofUrl('');
    setProofError('');
    setPaymentModal({ isOpen: true, commission });
  };

  const cerrarModalPago = () => {
    setPaymentModal({ isOpen: false, commission: null });
    setPaymentProofUrl('');
    setProofError('');
  };

  const handleMarkAsPaid = async () => {
    if (!paymentModal.commission) return;

    // PAGO-013: el comprobante es opcional, pero si se escribe tiene que ser un
    // enlace de verdad (http/https), no un texto suelto.
    const comprobante = paymentProofUrl.trim();
    if (comprobante && !esEnlaceValido(comprobante)) {
      setProofError('El comprobante debe ser un enlace completo que empiece por http:// o https://');
      return;
    }
    setProofError('');

    setProcessingPayment(true);
    try {
      const res = await fetch(`/api/admin/vendors/commissions/${paymentModal.commission.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'paid',
          paymentProofUrl: comprobante || null
        })
      });

      const data = await res.json().catch(() => null);

      if (res.ok && data?.success) {
        cerrarModalPago();
        fetchCommissions();
        fetchVendors(); // Actualizar stats
        setNotification({ type: 'success', message: 'Pago registrado exitosamente' });
      } else {
        setNotification({ type: 'error', message: data?.error || 'Error al procesar pago' });
      }
    } catch (error) {
      console.error('Error marking as paid:', error);
      setNotification({ type: 'error', message: 'Error de conexión' });
    } finally {
      setProcessingPayment(false);
    }
  };

  const handleCreateVendor = async () => {
    if (!createForm.nombre.trim() || !createForm.apellidoPaterno.trim() || !createForm.email.trim() || !createForm.password.trim() || !createForm.code.trim()) {
      setCreateError('Nombre, apellido paterno, email, contraseña y código son requeridos');
      return;
    }

    // PAGO-036: sin <form> el navegador no comprueba el type="email".
    if (!FORMATO_EMAIL.test(createForm.email.trim())) {
      setCreateError('El email no tiene un formato válido');
      return;
    }

    // PAGO-015: misma política de contraseña que el registro y el reseteo.
    const password = createForm.password;
    if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      setCreateError('La contraseña debe tener al menos 8 caracteres, una mayúscula y un número');
      return;
    }

    // PAGO-036: la misma regla que aplica el endpoint del propio vendedor.
    if (!FORMATO_CODIGO.test(createForm.code.trim().toUpperCase())) {
      setCreateError('El código debe tener entre 4 y 20 caracteres, sólo letras y números');
      return;
    }

    // PAGO-011: un campo vacío ya no se convierte en 0 sin avisar, y un 150 ya
    // no se recorta a 100 en silencio (100% de descuento deja el precio en 0).
    const discountPercent = leerPorcentaje(createForm.discountPercent);
    if (discountPercent === null) {
      setCreateError('El % de descuento debe ser un número entre 0 y 99');
      return;
    }

    const commissionPercent = leerPorcentaje(createForm.commissionPercent);
    if (commissionPercent === null) {
      setCreateError('El % de comisión debe ser un número entre 0 y 99');
      return;
    }

    setCreatingVendor(true);
    setCreateError('');

    try {
      const res = await fetch('/api/admin/vendors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...createForm,
          email: createForm.email.trim(),
          code: createForm.code.trim().toUpperCase(),
          discountPercent,
          commissionPercent
        })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setIsCreateModalOpen(false);
        setCreateForm({
          nombre: '',
          apellidoPaterno: '',
          apellidoMaterno: '',
          email: '',
          password: '',
          code: '',
          discountPercent: '10',
          commissionPercent: '10'
        });
        setCreateError('');
        setShowPassword(false);
        fetchVendors();
        setNotification({ type: 'success', message: data.message || 'Vendedor creado exitosamente' });
      } else {
        setCreateError(data.error || 'Error al crear vendedor');
      }
    } catch (error) {
      console.error('Error creating vendor:', error);
      setCreateError('Error de conexión');
    } finally {
      setCreatingVendor(false);
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
        <div className="mb-6 md:mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Gestión de Vendedores</h1>
            <p className="text-gray-600 mt-1 text-sm md:text-base">
              Códigos de descuento y comisiones
            </p>
          </div>
          <button
            onClick={() => { setIsCreateModalOpen(true); setCreateError(''); }}
            className="px-4 py-2.5 bg-button-green text-white rounded-lg hover:bg-green-700 transition-colors font-medium text-sm flex items-center gap-2 self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            Nuevo Vendedor
          </button>
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
                  setCommissionPage(1);
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
                  setCommissionPage(1);
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
                ) : vendorsError ? (
                  <AvisoDeError mensaje={vendorsError} onReintentar={fetchVendors} />
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
                            {/* PAGO-009: la API ya devolvía los porcentajes, pero
                                no se enseñaban en ninguna parte; un 100% tecleado
                                por error era invisible desde el panel. */}
                            <p className="text-xs text-gray-500 mt-1">
                              {vendor.discountPercent}% desc. · {vendor.commissionPercent}% com.
                            </p>
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
                            <div className="flex flex-col items-center gap-1">
                              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                vendor.isActive
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                                {vendor.isActive ? 'Activo' : 'Inactivo'}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleToggleVendor(vendor)}
                                disabled={togglingVendorId === vendor.id}
                                className="text-xs text-blue-600 hover:underline disabled:opacity-50"
                              >
                                {togglingVendorId === vendor.id
                                  ? 'Guardando…'
                                  : vendor.isActive
                                    ? 'Desactivar'
                                    : 'Reactivar'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {!loadingVendors && !vendorsError && vendors.length > 0 && (
                <ControlesPaginacion
                  pagination={vendorPagination}
                  page={vendorPage}
                  onChange={setVendorPage}
                  etiqueta="vendedores"
                />
              )}
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
                ) : commissionsError ? (
                  <AvisoDeError mensaje={commissionsError} onReintentar={fetchCommissions} />
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
                              onClick={() => abrirModalPago(comm)}
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

              {!loadingCommissions && !commissionsError && commissions.length > 0 && (
                <ControlesPaginacion
                  pagination={commissionPagination}
                  page={commissionPage}
                  onChange={setCommissionPage}
                  etiqueta="comisiones pendientes"
                />
              )}
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
                ) : commissionsError ? (
                  <AvisoDeError mensaje={commissionsError} onReintentar={fetchCommissions} />
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

              {!loadingCommissions && !commissionsError && commissions.length > 0 && (
                <ControlesPaginacion
                  pagination={commissionPagination}
                  page={commissionPage}
                  onChange={setCommissionPage}
                  etiqueta="comisiones pagadas"
                />
              )}
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
                onClick={cerrarModalPago}
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
                  onChange={(e) => { setPaymentProofUrl(e.target.value); setProofError(''); }}
                  placeholder="https://..."
                  className={`w-full px-4 py-2 border rounded-lg ${proofError ? 'border-red-500' : ''}`}
                />
                {proofError ? (
                  <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 flex-shrink-0" />
                    {proofError}
                  </p>
                ) : (
                  <p className="text-xs text-gray-500 mt-1">
                    Puedes subir el comprobante a un servicio externo y pegar la URL
                  </p>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={cerrarModalPago}
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

      {/* Modal Crear Vendedor */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white p-6 border-b flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <Plus className="w-5 h-5 text-green-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">Nuevo Vendedor</h3>
              </div>
              <button
                onClick={() => { setIsCreateModalOpen(false); setCreateError(''); setShowPassword(false); }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Nombre */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                  <input
                    type="text"
                    value={createForm.nombre}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, nombre: e.target.value }))}
                    placeholder="Nombre"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Apellido Paterno *</label>
                  <input
                    type="text"
                    value={createForm.apellidoPaterno}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, apellidoPaterno: e.target.value }))}
                    placeholder="Apellido Paterno"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Apellido Materno</label>
                  <input
                    type="text"
                    value={createForm.apellidoMaterno}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, apellidoMaterno: e.target.value }))}
                    placeholder="Apellido Materno"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="vendedor@ejemplo.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              {/* Contraseña */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña *</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={createForm.password}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="Mínimo 8 caracteres, una mayúscula y un número"
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Código de descuento */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Código de Descuento *</label>
                <input
                  type="text"
                  value={createForm.code}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                  placeholder="Ej: VENDEDOR10"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono uppercase focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">Se convertirá a mayúsculas automáticamente</p>
              </div>

              {/* Porcentajes */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">% Descuento</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={createForm.discountPercent}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, discountPercent: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">% Comisión</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={createForm.commissionPercent}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, commissionPercent: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Error */}
              {createError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {createError}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-gray-50 border-t p-4 flex gap-3">
              <button
                onClick={() => { setIsCreateModalOpen(false); setCreateError(''); setShowPassword(false); }}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 font-medium text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateVendor}
                disabled={creatingVendor}
                className="flex-1 px-4 py-2.5 bg-button-green text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium text-sm flex items-center justify-center gap-2"
              >
                {creatingVendor ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creando...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Crear Vendedor
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
