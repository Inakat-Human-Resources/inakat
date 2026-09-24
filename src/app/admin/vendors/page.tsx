'use client';

// RUTA: src/app/admin/vendors/page.tsx

/**
 * Vendedores, sus códigos de descuento y las comisiones que se les deben.
 *
 * Registro de aplicación (docs/DISENO.md §5): PageHeader → cifras → pestañas
 * con tabla paginada → modales. La lógica es la de siempre: mismas llamadas
 * (con page/limit/search/status), los mismos guardas de carrera
 * (peticionVendedores/peticionComisiones), las mismas validaciones del alta y
 * del comprobante, y el mismo manejo del 401. El `confirm()` de activar o
 * desactivar un código pasó a un Modal (useConfirmacion) que responde igual.
 */

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users,
  Clock,
  CheckCircle2,
  Search,
  AlertCircle,
  TrendingUp,
  Plus,
  Wallet,
  ExternalLink,
  RotateCw
} from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import Card from '@/components/ui/Card';
import DataTable, { type Columna } from '@/components/ui/DataTable';
import FilterToolbar from '@/components/ui/FilterToolbar';
import { Badge, RolBadge } from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Toast from '@/components/ui/Toast';
import Tabs, { PanelPestana } from '@/components/ui/Tabs';
import FormField, { Input } from '@/components/ui/FormField';
import type { PaginacionApi } from '@/components/ui/Pagination';
import { AvisoError } from '@/components/ui/Aviso';
import Switch from '@/components/ui/Switch';
import CampoContrasena from '@/components/ui/CampoContrasena';
import { useConfirmacion } from '@/components/ui/useConfirmacion';
import { fechaCorta } from '@/lib/fechas';

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
// (Ahora el alta sí va en un <form>, pero con noValidate: las reglas siguen
// siendo éstas, con sus mensajes, y no las del navegador.)
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
 *
 * La paginación la pinta ahora DataTable (Pagination del sistema). Esto sólo
 * traduce el bloque de estas APIs ({ totalCount }) al de las demás
 * ({ total, hasNext, hasPrev }), con la página que lleva la pantalla: «Anterior»
 * se apaga en la 1 y «Siguiente» en la última, como antes.
 */
function aPaginacionApi(pagination: Pagination, page: number): PaginacionApi {
  return {
    page,
    limit: pagination.limit,
    total: pagination.totalCount,
    totalPages: pagination.totalPages,
    hasNext: page < pagination.totalPages,
    hasPrev: page > 1
  };
}

/**
 * PAGO-008: un 401 o un 500 no pueden pintarse como "no hay comisiones
 * pendientes / todas han sido pagadas". El admin concluía que no debía nada.
 */
function AvisoDeError({ mensaje, onReintentar }: { mensaje: string; onReintentar: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <span className="mb-1 flex h-11 w-11 items-center justify-center rounded-full bg-danger-tint text-danger" aria-hidden="true">
        <AlertCircle className="h-5 w-5" />
      </span>
      <p className="font-display text-base font-semibold text-ink">No se pudieron cargar los datos</p>
      <p className="max-w-md text-sm text-ink-muted">{mensaje}</p>
      <Button variante="contorno" tamano="sm" icono={RotateCw} onClick={onReintentar} className="mt-2">
        Reintentar
      </Button>
    </div>
  );
}

/** «1 crédito», «5 créditos». */
const creditosTexto = (n: number) => `${n} ${n === 1 ? 'crédito' : 'créditos'}`;

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

  // La pregunta de activar/desactivar un código, con el Modal del sistema.
  const { confirmar, dialogo } = useConfirmacion();

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
      ? {
          titulo: `¿Reactivar el código ${vendor.code}?`,
          descripcion: 'Volverá a dar descuento y a generar comisiones.',
          textoConfirmar: 'Reactivar',
          variante: 'primario' as const
        }
      : {
          titulo: `¿Desactivar el código ${vendor.code}?`,
          descripcion: 'Dejará de dar descuento y de generar comisiones. El vendedor no podrá reactivarlo por su cuenta.',
          textoConfirmar: 'Desactivar',
          variante: 'peligro' as const
        };
    if (!(await confirmar(pregunta))) return;

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

  // Fecha corta del panel (src/lib/fechas): «23 sep 2026»; «—» si falta.
  const formatDate = (dateString: string | null | undefined) => fechaCorta(dateString);

  // ---------------------------------------------------------------------------
  // Presentación
  // ---------------------------------------------------------------------------

  /** Cambiar de pestaña hace lo mismo que hacían los tres botones de antes. */
  const cambiarPestana = (id: string) => {
    if (id === 'vendors') {
      setActiveTab('vendors');
    } else if (id === 'pending') {
      setActiveTab('pending');
      setCommissionFilter('pending');
      setCommissionPage(1);
    } else if (id === 'history') {
      setActiveTab('history');
      setCommissionFilter('paid');
      setCommissionPage(1);
    }
  };

  const abrirModalAlta = () => {
    setIsCreateModalOpen(true);
    setCreateError('');
  };

  const cerrarModalAlta = () => {
    setIsCreateModalOpen(false);
    setCreateError('');
    setShowPassword(false);
  };

  // Mientras llega la primera respuesta las cifras no son ceros: son «cargando».
  const cifrasCargando = loadingVendors && vendors.length === 0 && !vendorsError;

  const hoy = new Date();

  /**
   * El rol con la insignia del panel (RolBadge: la misma que /admin/users).
   * Las altas de esta pantalla crean usuarios con rol 'vendor': sale
   * «Vendedor», no la palabra cruda.
   */
  const insigniaRol = (role: string, tamano?: 'sm' | 'md') => <RolBadge rol={role} tamano={tamano} />;

  const columnasVendedores: Columna<Vendor>[] = [
    {
      id: 'vendedor',
      encabezado: 'Vendedor',
      enTarjeta: 'titulo',
      className: 'min-w-[10rem]',
      celda: (vendor) => (
        <div className="min-w-0">
          <p className="font-semibold text-ink">{vendor.user.nombre}</p>
          <p className="break-all text-[13px] text-ink-muted">{vendor.user.email}</p>
          {/* Con la tabla estrecha la columna Rol se esconde: su dato sube aquí. */}
          <span data-solo-bajo="lg" className="mt-1 inline-flex">
            {insigniaRol(vendor.user.role, 'sm')}
          </span>
        </div>
      ),
    },
    // Móvil: la tarjeta es el nombre + UNA línea «rol · código · % desc. ·
    // % com.», las comisiones y el interruptor arriba a la derecha. Ventas e
    // ingresos (el resumen) no salen: ~130 px por vendedor en vez de ~260.
    {
      id: 'rol',
      encabezado: 'Rol',
      ocultarBajo: 'lg',
      enTarjeta: 'meta',
      className: 'whitespace-nowrap',
      celda: (vendor) => insigniaRol(vendor.user.role),
    },
    {
      id: 'codigo',
      encabezado: 'Código',
      enTarjeta: 'meta',
      className: 'whitespace-nowrap',
      celda: (vendor) => (
        <div>
          <p className="font-mono text-sm font-semibold tracking-wide text-teal">
            {vendor.code}
            {/* En la línea meta de la tarjeta, los porcentajes van seguidos. */}
            <span data-solo-tarjeta className="font-sans text-xs font-normal tracking-normal tabular-nums text-ink-muted">
              {' '}
              · {vendor.discountPercent}% desc. · {vendor.commissionPercent}% com.
            </span>
          </p>
          {/* PAGO-009: la API ya devolvía los porcentajes, pero
              no se enseñaban en ninguna parte; un 100% tecleado
              por error era invisible desde el panel. */}
          <p data-solo-tabla className="text-xs tabular-nums text-ink-muted">
            {vendor.discountPercent}% desc. · {vendor.commissionPercent}% com.
          </p>
        </div>
      ),
    },
    {
      id: 'ventas',
      encabezado: 'Ventas',
      numerica: true,
      ocultarBajo: 'md',
      enTarjeta: 'oculta',
      celda: (vendor) => <span className="font-medium">{vendor.stats.totalSales}</span>,
    },
    {
      id: 'ingresos',
      encabezado: 'Ingresos',
      numerica: true,
      ocultarBajo: 'md',
      enTarjeta: 'oculta',
      className: 'whitespace-nowrap',
      celda: (vendor) => formatCurrency(vendor.stats.totalRevenue),
    },
    {
      id: 'comisiones',
      encabezado: 'Comisiones',
      numerica: true,
      className: 'whitespace-nowrap',
      celda: (vendor) => (
        <div>
          <p className="font-medium text-ink">{formatCurrency(vendor.stats.totalCommission)}</p>
          {vendor.stats.pendingCommission > 0 && (
            <p className="text-xs font-medium text-orange-dark">
              {formatCurrency(vendor.stats.pendingCommission)} pendiente
            </p>
          )}
          {/* Ventas: suben aquí cuando su columna se esconde (tabla estrecha). */}
          <p data-solo-bajo="md" className="text-xs text-ink-muted">
            {vendor.stats.totalSales} venta{vendor.stats.totalSales !== 1 ? 's' : ''}
          </p>
        </div>
      ),
    },
    {
      id: 'estado',
      encabezado: 'Estado',
      alinear: 'fin',
      // El interruptor, arriba a la derecha de la tarjeta (se nombra solo:
      // «código X»), como las acciones de icono.
      enTarjeta: 'acciones',
      className: 'w-px whitespace-nowrap',
      celda: (vendor) => (
        <Switch
          activo={vendor.isActive}
          alCambiar={() => handleToggleVendor(vendor)}
          objeto={`código ${vendor.code}`}
          cargando={togglingVendorId === vendor.id}
        />
      ),
    },
  ];

  const columnasPendientes: Columna<Commission>[] = [
    {
      id: 'vendedor',
      encabezado: 'Vendedor',
      enTarjeta: 'titulo',
      className: 'min-w-[10rem]',
      celda: (comm) => (
        <div className="min-w-0">
          <p className="font-semibold text-ink">{comm.vendor.nombre}</p>
          <p className="text-[13px] text-ink-muted">
            Código: <span className="font-mono">{comm.vendor.code}</span>
          </p>
          {/* Con la tabla estrecha la columna Empresa se esconde: su dato sube aquí. */}
          <p data-solo-bajo="md" className="mt-0.5 text-[13px] text-ink">
            {`${comm.company.nombreEmpresa} · ${creditosTexto(comm.purchase.credits)}`}
          </p>
        </div>
      ),
    },
    // Móvil: vendedor + UNA línea «empresa · créditos · fecha», la comisión,
    // la fecha límite y «Marcar pagada» al pie. El monto de la venta no sale
    // (la comisión es lo que se paga).
    {
      id: 'empresa',
      encabezado: 'Empresa',
      ocultarBajo: 'md',
      enTarjeta: 'meta',
      className: 'min-w-[9rem]',
      celda: (comm) => (
        <div className="min-w-0">
          <p className="font-medium text-ink">
            {comm.company.nombreEmpresa}
            <span data-solo-tarjeta className="font-normal text-ink-muted">
              {' '}
              · {creditosTexto(comm.purchase.credits)}
            </span>
          </p>
          <p data-solo-tabla className="text-[13px] text-ink-muted">
            {creditosTexto(comm.purchase.credits)}
          </p>
        </div>
      ),
    },
    {
      id: 'fechaVenta',
      encabezado: 'Fecha venta',
      ocultarBajo: 'lg',
      enTarjeta: 'meta',
      className: 'whitespace-nowrap',
      celda: (comm) => <span className="tabular-nums">{formatDate(comm.createdAt)}</span>,
    },
    {
      id: 'montoVenta',
      encabezado: 'Monto venta',
      numerica: true,
      ocultarBajo: 'md',
      enTarjeta: 'oculta',
      className: 'whitespace-nowrap',
      celda: (comm) => formatCurrency(comm.purchase.finalPrice),
    },
    {
      id: 'comision',
      encabezado: 'Comisión',
      numerica: true,
      className: 'whitespace-nowrap',
      celda: (comm) => (
        <div>
          <p className="font-display text-[15px] font-semibold text-ink">{formatCurrency(comm.commission.amount)}</p>
          {/* Monto de la venta: sube aquí cuando su columna se esconde. */}
          <p data-solo-bajo="md" className="text-xs text-ink-muted">
            de {formatCurrency(comm.purchase.finalPrice)}
          </p>
        </div>
      ),
    },
    {
      id: 'fechaLimite',
      encabezado: 'Fecha límite',
      className: 'whitespace-nowrap',
      celda: (comm) =>
        comm.commission.dueDate ? (
          <div>
            <p className="tabular-nums">{formatDate(comm.commission.dueDate)}</p>
            {new Date(comm.commission.dueDate) < hoy && (
              <Badge tono="peligro" tamano="sm" className="mt-1">
                Vencida
              </Badge>
            )}
          </div>
        ) : (
          <span className="text-ink-muted" aria-label="Sin fecha límite">
            —
          </span>
        ),
    },
    {
      id: 'accion',
      encabezado: 'Acción',
      encabezadoOculto: true,
      alinear: 'fin',
      enTarjeta: 'acciones',
      className: 'w-px whitespace-nowrap',
      celda: (comm) => (
        <Button variante="contorno" tamano="sm" icono={CheckCircle2} onClick={() => abrirModalPago(comm)}>
          Marcar pagada
          <span className="sr-only">
            {' '}
            la comisión de {comm.vendor.nombre} ({comm.company.nombreEmpresa})
          </span>
        </Button>
      ),
    },
  ];

  const columnasHistorial: Columna<Commission>[] = [
    {
      id: 'vendedor',
      encabezado: 'Vendedor',
      enTarjeta: 'titulo',
      className: 'min-w-[10rem]',
      celda: (comm) => (
        <div className="min-w-0">
          <p className="font-semibold text-ink">{comm.vendor.nombre}</p>
          <p className="break-all text-[13px] text-ink-muted">{comm.vendor.email}</p>
          {/* Con la tabla estrecha la columna Empresa se esconde: su dato sube aquí. */}
          <p data-solo-bajo="md" className="mt-0.5 text-[13px] text-ink">
            {`Empresa: ${comm.company.nombreEmpresa}`}
          </p>
        </div>
      ),
    },
    // Móvil: vendedor + UNA línea «empresa · fecha de venta», la comisión, la
    // fecha de pago y el comprobante.
    {
      id: 'empresa',
      encabezado: 'Empresa',
      ocultarBajo: 'md',
      enTarjeta: 'meta',
      className: 'min-w-[9rem]',
      celda: (comm) => <span className="text-ink">{comm.company.nombreEmpresa}</span>,
    },
    {
      id: 'fechaVenta',
      encabezado: 'Fecha venta',
      ocultarBajo: 'md',
      enTarjeta: 'meta',
      className: 'whitespace-nowrap',
      celda: (comm) => <span className="tabular-nums">{formatDate(comm.createdAt)}</span>,
    },
    {
      id: 'comision',
      encabezado: 'Comisión',
      numerica: true,
      className: 'whitespace-nowrap',
      celda: (comm) => (
        <span className="font-display text-[15px] font-semibold text-lime-dark">
          {formatCurrency(comm.commission.amount)}
        </span>
      ),
    },
    {
      id: 'fechaPago',
      encabezado: 'Fecha pago',
      className: 'whitespace-nowrap',
      celda: (comm) =>
        comm.commission.paidAt ? (
          <span className="tabular-nums">{formatDate(comm.commission.paidAt)}</span>
        ) : (
          <span className="text-ink-muted" aria-label="Sin fecha de pago">
            —
          </span>
        ),
    },
    {
      id: 'comprobante',
      encabezado: 'Comprobante',
      alinear: 'fin',
      className: 'w-px whitespace-nowrap',
      celda: (comm) =>
        comm.commission.proofUrl ? (
          <a
            href={comm.commission.proofUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded text-sm font-medium text-teal hover:text-teal-dark hover:underline"
          >
            Ver
            <span className="sr-only"> el comprobante de {comm.vendor.nombre} (se abre en otra pestaña)</span>
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        ) : (
          <span className="text-[13px] text-ink-muted">Sin comprobante</span>
        ),
    },
  ];

  const pestanas = [
    { id: 'vendors', etiqueta: 'Vendedores', contador: globalStats.totalVendors },
    { id: 'pending', etiqueta: 'Pendientes', contador: commissionSummary.pending.count },
    { id: 'history', etiqueta: 'Historial de pagos' }
  ];

  return (
    <>
      <PageHeader
        antetitulo="Empresas y comercial"
        titulo="Vendedores"
        remate="y sus comisiones"
        descripcion="Códigos de descuento y comisiones"
        acciones={
          <Button icono={Plus} onClick={abrirModalAlta}>
            Nuevo vendedor
          </Button>
        }
      />

      {/* Notificación: los errores se quedan hasta cerrarlos; los avisos de éxito se van solos. */}
      <Toast
        tono={notification.type === 'error' ? 'error' : 'exito'}
        mensaje={notification.type ? notification.message : null}
        alCerrar={() => setNotification({ type: null, message: '' })}
        duracion={notification.type === 'error' ? 0 : 8000}
      />

      {/* Cifras globales (sin filtro de búsqueda: las cuenta la API) */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:mb-8 xl:grid-cols-4">
        <StatCard
          etiqueta="Vendedores"
          valor={globalStats.totalVendors.toLocaleString('es-MX')}
          icono={Users}
          tono="ink"
          cargando={cifrasCargando}
        />
        <StatCard
          etiqueta="Ingresos"
          valor={formatCurrency(globalStats.totalRevenue)}
          compacta
          detalle={`${globalStats.totalSales.toLocaleString('es-MX')} venta${globalStats.totalSales !== 1 ? 's' : ''} con código`}
          icono={TrendingUp}
          tono="teal"
          cargando={cifrasCargando}
        />
        <StatCard
          etiqueta="Comisión pendiente"
          valor={formatCurrency(globalStats.pendingCommissions)}
          compacta
          detalle="Por pagar a vendedores"
          icono={Clock}
          tono="orange"
          cargando={cifrasCargando}
        />
        <StatCard
          etiqueta="Total comisiones"
          valor={formatCurrency(globalStats.totalCommissions)}
          compacta
          detalle="De compras pagadas"
          icono={Wallet}
          tono="lime"
          cargando={cifrasCargando}
        />
      </div>

      <Card sinRelleno>
        <Tabs
          idBase="vendedores"
          etiqueta="Vendedores y comisiones"
          activa={activeTab}
          alCambiar={cambiarPestana}
          pestanas={pestanas}
          className="px-2 sm:px-3"
        />

        {/* Tab: Vendedores */}
        <PanelPestana idBase="vendedores" id="vendors" activa={activeTab} className="pt-0">
          <form
            className="border-b border-line px-5 py-4"
            onSubmit={(e) => {
              e.preventDefault();
              handleSearchVendors();
            }}
          >
            <FilterToolbar
              busqueda={{
                valor: vendorSearch,
                alCambiar: setVendorSearch,
                etiqueta: 'Buscar vendedores',
                placeholder: 'Código, nombre o email'
              }}
            >
              {/* La búsqueda va al servidor al pulsar «Buscar» o Intro (como antes). */}
              <Button type="submit" variante="secundario" tamano="sm" icono={Search} className="h-9 w-full sm:w-auto">
                Buscar
              </Button>
            </FilterToolbar>
          </form>

          <DataTable
            etiqueta="Vendedores"
            columnas={columnasVendedores}
            filas={vendors}
            claveFila={(vendor) => vendor.id}
            cargando={loadingVendors}
            paginacion={
              !loadingVendors && !vendorsError && vendors.length > 0
                ? aPaginacionApi(vendorPagination, vendorPage)
                : undefined
            }
            alCambiarPagina={setVendorPage}
            etiquetaTotal="vendedores"
            vacio={
              vendorsError ? (
                <AvisoDeError mensaje={vendorsError} onReintentar={fetchVendors} />
              ) : (
                <EmptyState
                  icono={Users}
                  titulo={
                    vendorSearch.trim()
                      ? 'Ningún vendedor coincide con la búsqueda'
                      : 'No hay vendedores registrados'
                  }
                  descripcion={
                    vendorSearch.trim()
                      ? 'Prueba con otro código, nombre o email.'
                      : 'Da de alta al primero con «Nuevo vendedor».'
                  }
                />
              )
            }
          />
        </PanelPestana>

        {/* Tab: Comisiones Pendientes */}
        <PanelPestana idBase="vendedores" id="pending" activa={activeTab} className="pt-0">
          <p className="flex items-center gap-2 border-b border-line bg-orange-tint/60 px-5 py-3 text-sm font-medium text-orange-dark">
            <AlertCircle className="h-[18px] w-[18px] flex-none" aria-hidden="true" />
            <span className="tabular-nums">
              {commissionSummary.pending.count} comisiones pendientes por{' '}
              {formatCurrency(commissionSummary.pending.total)}
            </span>
          </p>

          <DataTable
            etiqueta="Comisiones pendientes"
            columnas={columnasPendientes}
            filas={commissions}
            claveFila={(comm) => comm.id}
            cargando={loadingCommissions}
            paginacion={
              !loadingCommissions && !commissionsError && commissions.length > 0
                ? aPaginacionApi(commissionPagination, commissionPage)
                : undefined
            }
            alCambiarPagina={setCommissionPage}
            etiquetaTotal="comisiones pendientes"
            vacio={
              commissionsError ? (
                <AvisoDeError mensaje={commissionsError} onReintentar={fetchCommissions} />
              ) : (
                <EmptyState
                  frase="Al día."
                  titulo="No hay comisiones pendientes"
                  descripcion="Todas las comisiones han sido pagadas"
                />
              )
            }
          />
        </PanelPestana>

        {/* Tab: Historial de Pagos */}
        <PanelPestana idBase="vendedores" id="history" activa={activeTab} className="pt-0">
          <p className="flex items-center gap-2 border-b border-line bg-lime-tint/70 px-5 py-3 text-sm font-medium text-lime-dark">
            <CheckCircle2 className="h-[18px] w-[18px] flex-none" aria-hidden="true" />
            <span className="tabular-nums">
              {commissionSummary.paid.count} comisiones pagadas por{' '}
              {formatCurrency(commissionSummary.paid.total)}
            </span>
          </p>

          <DataTable
            etiqueta="Historial de pagos de comisiones"
            columnas={columnasHistorial}
            filas={commissions}
            claveFila={(comm) => comm.id}
            cargando={loadingCommissions}
            paginacion={
              !loadingCommissions && !commissionsError && commissions.length > 0
                ? aPaginacionApi(commissionPagination, commissionPage)
                : undefined
            }
            alCambiarPagina={setCommissionPage}
            etiquetaTotal="comisiones pagadas"
            vacio={
              commissionsError ? (
                <AvisoDeError mensaje={commissionsError} onReintentar={fetchCommissions} />
              ) : (
                <EmptyState icono={Clock} titulo="No hay pagos realizados" />
              )
            }
          />
        </PanelPestana>
      </Card>

      {/* Modal de pago */}
      <Modal
        abierto={paymentModal.isOpen && paymentModal.commission !== null}
        alCerrar={cerrarModalPago}
        tamano="sm"
        titulo="Marcar comisión como pagada"
        cerrarAlPulsarFondo={false}
        pie={
          <>
            <Button variante="contorno" onClick={cerrarModalPago}>
              Cancelar
            </Button>
            <Button
              type="submit"
              form="form-pago-comision"
              icono={CheckCircle2}
              cargando={processingPayment}
              textoCargando="Procesando…"
            >
              Confirmar pago
            </Button>
          </>
        }
      >
        {paymentModal.commission && (
          <form
            id="form-pago-comision"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              handleMarkAsPaid();
            }}
            className="space-y-5"
          >
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border border-line bg-paper px-4 py-3 text-sm">
              <div className="min-w-0">
                <dt className="text-xs text-ink-muted">Vendedor</dt>
                <dd className="font-medium text-ink">{paymentModal.commission.vendor.nombre}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-xs text-ink-muted">Código</dt>
                <dd className="font-mono font-semibold text-teal">{paymentModal.commission.vendor.code}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-xs text-ink-muted">Empresa</dt>
                <dd className="font-medium text-ink">{paymentModal.commission.company.nombreEmpresa}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-xs text-ink-muted">Comisión a pagar</dt>
                <dd className="font-display text-xl font-semibold tabular-nums text-ink">
                  {formatCurrency(paymentModal.commission.commission.amount)}
                </dd>
              </div>
            </dl>

            <FormField
              etiqueta="URL del comprobante de pago"
              opcional
              error={proofError || null}
              ayuda="Puedes subir el comprobante a un servicio externo y pegar la URL"
            >
              <Input
                type="url"
                inputMode="url"
                value={paymentProofUrl}
                onChange={(e) => { setPaymentProofUrl(e.target.value); setProofError(''); }}
                placeholder="https://..."
                autoComplete="off"
              />
            </FormField>
          </form>
        )}
      </Modal>

      {/* Modal crear vendedor */}
      <Modal
        abierto={isCreateModalOpen}
        alCerrar={cerrarModalAlta}
        tamano="md"
        titulo="Nuevo vendedor"
        descripcion="Se crea su cuenta con rol de vendedor y su código de descuento."
        cerrarAlPulsarFondo={false}
        pie={
          <>
            <Button variante="contorno" onClick={cerrarModalAlta}>
              Cancelar
            </Button>
            <Button
              type="submit"
              form="form-alta-vendedor"
              icono={Plus}
              cargando={creatingVendor}
              textoCargando="Creando…"
            >
              Crear vendedor
            </Button>
          </>
        }
      >
        <form
          id="form-alta-vendedor"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            handleCreateVendor();
          }}
          className="space-y-5"
        >
          <fieldset className="space-y-4">
            <legend className="mb-3 font-display text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
              Cuenta
            </legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField etiqueta="Nombre" requerido>
                <Input
                  type="text"
                  value={createForm.nombre}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, nombre: e.target.value }))}
                  autoComplete="off"
                />
              </FormField>
              <FormField etiqueta="Apellido paterno" requerido>
                <Input
                  type="text"
                  value={createForm.apellidoPaterno}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, apellidoPaterno: e.target.value }))}
                  autoComplete="off"
                />
              </FormField>
              <FormField etiqueta="Apellido materno" opcional>
                <Input
                  type="text"
                  value={createForm.apellidoMaterno}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, apellidoMaterno: e.target.value }))}
                  autoComplete="off"
                />
              </FormField>
            </div>

            <FormField etiqueta="Email" requerido>
              <Input
                type="email"
                value={createForm.email}
                onChange={(e) => setCreateForm(prev => ({ ...prev, email: e.target.value }))}
                placeholder="vendedor@ejemplo.com"
                autoComplete="off"
              />
            </FormField>

            <FormField etiqueta="Contraseña" requerido ayuda="Mínimo 8 caracteres, una mayúscula y un número.">
              <CampoContrasena
                visible={showPassword}
                alAlternar={() => setShowPassword(!showPassword)}
                value={createForm.password}
                onChange={(e) => setCreateForm(prev => ({ ...prev, password: e.target.value }))}
                autoComplete="new-password"
              />
            </FormField>
          </fieldset>

          <div className="border-t border-line pt-5">
            <fieldset className="space-y-4">
              <legend className="mb-3 font-display text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
                Código de descuento
              </legend>
              <FormField
                etiqueta="Código"
                requerido
                ayuda="Entre 4 y 20 letras y números. Se convertirá a mayúsculas automáticamente."
              >
                <Input
                  type="text"
                  value={createForm.code}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                  placeholder="Ej: VENDEDOR10"
                  autoComplete="off"
                  spellCheck={false}
                  className="font-mono uppercase tracking-wide"
                />
              </FormField>

              <div className="grid grid-cols-2 gap-4">
                <FormField etiqueta="% de descuento" ayuda="Para la empresa, de 0 a 99.">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    inputMode="decimal"
                    value={createForm.discountPercent}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, discountPercent: e.target.value }))}
                    className="tabular-nums"
                  />
                </FormField>
                <FormField etiqueta="% de comisión" ayuda="Para el vendedor, de 0 a 99.">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    inputMode="decimal"
                    value={createForm.commissionPercent}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, commissionPercent: e.target.value }))}
                    className="tabular-nums"
                  />
                </FormField>
              </div>
            </fieldset>
          </div>

          {/* Error */}
          {createError && <AvisoError mensaje={createError} className="mb-0" />}
        </form>
      </Modal>

      {dialogo}
    </>
  );
}
