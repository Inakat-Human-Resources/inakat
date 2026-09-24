'use client';

// RUTA: src/app/vendor/dashboard/page.tsx

/**
 * Panel del vendedor: su código de descuento, lo que lleva ganado en
 * comisiones y el historial de ventas hechas con el código.
 *
 * Registro de aplicación (docs/DISENO.md): PageHeader → cifras → código +
 * información de pagos → Card con DataTable paginada. La lógica es la de
 * siempre (GET/POST/PUT /api/vendor/my-code, GET /api/vendor/my-sales con
 * page y limit, la misma validación del código); sólo cambió la presentación.
 */

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
  Gift,
  AlertCircle,
  Plus,
  Info
} from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import Card from '@/components/ui/Card';
import DataTable, { type Columna } from '@/components/ui/DataTable';
import StatusBadge, { Badge } from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import Button from '@/components/ui/Button';
import IconButton from '@/components/ui/IconButton';
import FormField, { Input } from '@/components/ui/FormField';
import { SkeletonTexto } from '@/components/ui/Skeleton';
import type { PaginacionApi } from '@/components/ui/Pagination';
import { fechaCorta } from '@/lib/fechas';

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

interface Pagination {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
}

// La API devuelve 20 ventas por tanda; la página tiene que pedir el resto.
const VENTAS_POR_PAGINA = 20;

const PAGINACION_VACIA: Pagination = {
  page: 1,
  limit: VENTAS_POR_PAGINA,
  totalCount: 0,
  totalPages: 1
};

/**
 * PAGO-026: Anterior / Siguiente para el historial de ventas. La API de
 * ventas pagina con su propia forma ({ page, limit, totalCount, totalPages });
 * aquí se traduce a la que pinta <Pagination> (la de DataTable), con la página
 * que lleva la pantalla: Anterior se apaga en la 1 y Siguiente en la última.
 */
function aPaginacionDeTabla(pagination: Pagination, page: number): PaginacionApi {
  return {
    page,
    limit: pagination.limit,
    total: pagination.totalCount,
    totalPages: pagination.totalPages,
    hasNext: page < pagination.totalPages,
    hasPrev: page > 1
  };
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

  // Estado para errores
  const [error, setError] = useState<string | null>(null);

  // Estado para ventas
  const [sales, setSales] = useState<Sale[]>([]);
  const [summary, setSummary] = useState<Summary>({
    totalSales: 0,
    totalCommission: 0,
    pendingCommission: 0,
    paidCommission: 0
  });
  const [loadingSales, setLoadingSales] = useState(true);
  // PAGO-026: el resumen cuenta TODAS las ventas, pero la tabla sólo traía las
  // 20 últimas y no había forma de llegar a las anteriores ni a sus comprobantes.
  const [salesPage, setSalesPage] = useState(1);
  const [salesPagination, setSalesPagination] = useState<Pagination>(PAGINACION_VACIA);

  // Cargar código al montar
  useEffect(() => {
    fetchDiscountCode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cargar ventas al montar y al cambiar de página
  useEffect(() => {
    fetchSales();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salesPage]);

  const fetchDiscountCode = async () => {
    try {
      setLoadingCode(true);
      const res = await fetch('/api/vendor/my-code');
      const data = await res.json().catch(() => null);

      // PAGO-050: un 500 o una sesión caducada no pueden verse igual que "aún
      // no tienes código"; el vendedor acababa intentando crear uno y recibía
      // un mensaje para desarrolladores.
      if (!res.ok || !data?.success) {
        // El 404 sí significa de verdad que todavía no hay código.
        if (res.status !== 404) {
          setError(data?.error || 'No pudimos cargar tu código de descuento. Intenta recargar la página.');
        }
        return;
      }

      if (data.data) {
        setDiscountCode(data.data);
        setNewCode(data.data.code);
      }
    } catch (error) {
      console.error('Error fetching discount code:', error);
      setError('Error al cargar tu código de descuento. Intenta recargar la página.');
    } finally {
      setLoadingCode(false);
    }
  };

  const fetchSales = async () => {
    try {
      setLoadingSales(true);
      const params = new URLSearchParams({
        page: String(salesPage),
        limit: String(VENTAS_POR_PAGINA)
      });
      const res = await fetch(`/api/vendor/my-sales?${params.toString()}`);
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        setSales([]);
        setError(data?.error || 'No pudimos cargar tus ventas. Intenta recargar la página.');
        return;
      }

      setSales(data.data.sales || []);
      setSummary(data.data.summary || {
        totalSales: 0,
        totalCommission: 0,
        pendingCommission: 0,
        paidCommission: 0
      });
      setSalesPagination(data.data.pagination || PAGINACION_VACIA);
    } catch (error) {
      console.error('Error fetching sales:', error);
      setError('Error al cargar las ventas. Intenta recargar la página.');
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

  // Fecha corta del panel (src/lib/fechas): «23 sep 2026».
  const formatDate = (dateString: string) => fechaCorta(dateString);

  const cancelarEdicion = () => {
    setIsEditing(false);
    setNewCode(discountCode?.code || '');
    setCodeError('');
  };

  // Cifra de una StatCard de este panel: más pequeña en móvil para que
  // «$141,750.00» quepa en media tarjeta sin salirse (las cuatro iguales).
  const cifraAjustada = (valor: string | number) => <span className="text-xl sm:text-[28px]">{valor}</span>;

  // ---------------------------------------------------------------------------
  // Historial de ventas (columnas declarativas: DataTable pinta y pasa a
  // tarjetas en móvil; las secundarias se esconden si la tabla es estrecha)
  // ---------------------------------------------------------------------------
  const columnas: Columna<Sale>[] = [
    {
      id: 'company',
      encabezado: 'Empresa',
      enTarjeta: 'titulo',
      className: 'min-w-[12rem]',
      celda: (sale) => (
        <div className="min-w-0">
          <p className="font-semibold text-ink">{sale.company.nombreEmpresa}</p>
          <p className="text-[13px] text-ink-muted">
            {sale.purchase.credits} {sale.purchase.credits === 1 ? 'crédito' : 'créditos'}
            {/* Tabla estrecha: el total y la fecha suben aquí (sus columnas se esconden). */}
            <span data-solo-bajo="md" className="tabular-nums">
              {' '}
              · {formatCurrency(sale.purchase.finalPrice)} · {formatDate(sale.createdAt)}
            </span>
          </p>
        </div>
      ),
    },
    // Móvil: la tarjeta es la empresa + UNA línea «fecha · venta $X · estado»
    // y la comisión; el precio original y el descuento (el detalle de la
    // cuenta) no salen: ~130 px por venta en vez de ~300.
    {
      id: 'createdAt',
      encabezado: 'Fecha',
      ocultarBajo: 'md',
      enTarjeta: 'meta',
      className: 'whitespace-nowrap',
      celda: (sale) => <span className="tabular-nums text-ink-muted">{formatDate(sale.createdAt)}</span>,
    },
    {
      id: 'original',
      encabezado: 'Original',
      numerica: true,
      ocultarBajo: 'lg',
      enTarjeta: 'oculta',
      className: 'whitespace-nowrap',
      celda: (sale) => <span className="text-ink-muted">{formatCurrency(sale.purchase.originalPrice)}</span>,
    },
    {
      id: 'discount',
      encabezado: 'Descuento',
      numerica: true,
      ocultarBajo: 'lg',
      enTarjeta: 'oculta',
      className: 'whitespace-nowrap',
      celda: (sale) => <span className="text-ink-muted">−{formatCurrency(sale.purchase.discountAmount)}</span>,
    },
    {
      id: 'final',
      encabezado: 'Final',
      numerica: true,
      ocultarBajo: 'md',
      enTarjeta: 'meta',
      className: 'whitespace-nowrap',
      celda: (sale) => (
        <span className="font-medium text-ink">
          {/* En la tabla lo dice la cabecera; en la línea meta, sin etiqueta, el nombre. */}
          <span data-solo-tarjeta className="font-normal text-ink-muted">
            Venta{' '}
          </span>
          {formatCurrency(sale.purchase.finalPrice)}
        </span>
      ),
    },
    {
      id: 'commission',
      encabezado: 'Mi comisión',
      numerica: true,
      className: 'whitespace-nowrap',
      celda: (sale) => (
        <span className="font-display font-semibold text-lime-dark">{formatCurrency(sale.commission.amount)}</span>
      ),
    },
    {
      id: 'status',
      encabezado: 'Estado',
      alinear: 'centro',
      enTarjeta: 'meta',
      celda: (sale) => (
        <StatusBadge estado={sale.commission.status} contexto="comision" etiqueta={sale.commission.statusLabel} />
      ),
    },
    {
      id: 'proof',
      encabezado: 'Comprobante',
      alinear: 'centro',
      className: 'whitespace-nowrap',
      celda: (sale) =>
        sale.commission.proofUrl ? (
          <a
            href={sale.commission.proofUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded text-[13px] font-semibold text-teal underline-offset-2 hover:text-teal-dark hover:underline"
          >
            Ver
            <span className="sr-only"> comprobante de {sale.company.nombreEmpresa} (se abre en otra pestaña)</span>
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        ) : (
          <span className="text-ink-muted" aria-label="Sin comprobante">
            —
          </span>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        antetitulo="Ventas"
        titulo="Tu código"
        remate="y lo que te deja"
        descripcion="Gestiona tu código de descuento y consulta tus comisiones."
      />

      {/* Error */}
      {error && (
        <div
          role="alert"
          className="mb-6 flex items-start gap-3 rounded-xl border border-danger/30 bg-danger-tint px-4 py-3 text-sm font-medium text-danger-dark"
        >
          <AlertCircle size={18} className="mt-px flex-none" aria-hidden="true" />
          <p className="min-w-0 flex-1">{error}</p>
          <IconButton
            etiqueta="Cerrar aviso"
            icono={X}
            tamano="sm"
            onClick={() => setError(null)}
            className="-my-1.5 -mr-1.5 text-danger-dark hover:bg-danger/10"
          />
        </div>
      )}

      {/* Resumen de Comisiones */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:mb-8 xl:grid-cols-4">
        <StatCard
          etiqueta="Ventas"
          valor={cifraAjustada(summary.totalSales)}
          detalle="Compras pagadas con tu código"
          icono={TrendingUp}
          tono="teal"
          cargando={loadingSales}
        />
        <StatCard
          etiqueta="Comisión total"
          valor={cifraAjustada(formatCurrency(summary.totalCommission))}
          icono={DollarSign}
          tono="ink"
          cargando={loadingSales}
        />
        <StatCard
          etiqueta="Pendiente de pago"
          valor={cifraAjustada(formatCurrency(summary.pendingCommission))}
          icono={Clock}
          tono="orange"
          cargando={loadingSales}
        />
        <StatCard
          etiqueta="Pagada"
          valor={cifraAjustada(formatCurrency(summary.paidCommission))}
          icono={CheckCircle}
          tono="lime"
          cargando={loadingSales}
        />
      </div>

      <div className="mb-6 grid gap-5 lg:mb-8 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        {/* Mi Código de Descuento */}
        <Card
          titulo={
            <span className="inline-flex items-center gap-2">
              <Gift size={18} className="text-orange-dark" aria-hidden="true" />
              Mi código de descuento
            </span>
          }
        >
          {loadingCode ? (
            <div role="status" className="py-2">
              <span className="sr-only">Cargando tu código…</span>
              <SkeletonTexto lineas={3} />
            </div>
          ) : !discountCode && !isEditing ? (
            // No tiene código - mostrar formulario de creación
            <EmptyState
              compacto
              icono={Gift}
              titulo="Aún no tienes un código de descuento"
              descripcion="Crea tu código personalizado y gana comisiones cuando las empresas lo usen."
              accion={
                <Button icono={Plus} onClick={() => setIsEditing(true)}>
                  Crear mi código
                </Button>
              }
            />
          ) : isEditing ? (
            // Modo edición
            <form
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveCode();
              }}
              className="max-w-md"
            >
              <FormField
                etiqueta="Tu código de descuento"
                ayuda="Solo letras y números, entre 4 y 20 caracteres."
                error={codeError || null}
              >
                <Input
                  type="text"
                  value={newCode}
                  onChange={(e) => {
                    setNewCode(e.target.value.toUpperCase());
                    setCodeError('');
                  }}
                  placeholder="Ej: EDUARDO10"
                  maxLength={20}
                  autoComplete="off"
                  spellCheck={false}
                  className="h-11 font-display text-base font-semibold uppercase tracking-[0.08em]"
                />
              </FormField>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button type="submit" icono={Save} cargando={savingCode} textoCargando="Guardando…">
                  {discountCode ? 'Guardar código' : 'Crear código'}
                </Button>
                <Button variante="contorno" icono={X} onClick={cancelarEdicion} disabled={savingCode}>
                  Cancelar
                </Button>
              </div>
            </form>
          ) : discountCode && (
            // Mostrar código existente
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="break-all rounded-lg border border-dashed border-line-strong bg-paper px-3 py-1.5 font-display text-2xl font-bold tracking-[0.08em] text-ink sm:text-3xl">
                    {discountCode.code}
                  </p>
                  <IconButton
                    etiqueta={copied ? 'Código copiado' : 'Copiar código'}
                    icono={copied ? Check : Copy}
                    variante="contorno"
                    onClick={copyToClipboard}
                    className={copied ? 'text-lime-dark' : undefined}
                  />
                  <IconButton etiqueta="Editar código" icono={Edit2} variante="contorno" onClick={() => setIsEditing(true)} />
                  <span role="status" className="sr-only">
                    {copied ? 'Código copiado' : ''}
                  </span>
                </div>
                <p className="mt-3 text-sm text-ink">
                  <span className="font-semibold">{discountCode.discountPercent}%</span> de descuento para clientes ·{' '}
                  <span className="font-semibold">{discountCode.commissionPercent}%</span> de comisión para ti
                </p>
                <p className="mt-1 text-[13px] text-ink-muted">Creado el {formatDate(discountCode.createdAt)}</p>
              </div>

              {discountCode.isActive ? (
                <Badge tono="exito" className="self-start">
                  Activo
                </Badge>
              ) : (
                <Badge tono="neutro" className="self-start">
                  Inactivo
                </Badge>
              )}
            </div>
          )}
        </Card>

        {/* Info sobre pagos */}
        <Card
          titulo={
            <span className="inline-flex items-center gap-2">
              <Info size={18} className="text-teal" aria-hidden="true" />
              Información sobre pagos de comisiones
            </span>
          }
          className="bg-teal-tint/40"
        >
          <ul className="space-y-2 text-sm text-ink">
            <li className="flex gap-2">
              <span className="mt-[7px] h-1.5 w-1.5 flex-none rounded-full bg-teal" aria-hidden="true" />
              Las comisiones se pagan dentro de los 4 meses siguientes a la venta
            </li>
            <li className="flex gap-2">
              <span className="mt-[7px] h-1.5 w-1.5 flex-none rounded-full bg-teal" aria-hidden="true" />
              Recibirás un comprobante de pago cuando se procese tu comisión
            </li>
            <li className="flex gap-2">
              <span className="mt-[7px] h-1.5 w-1.5 flex-none rounded-full bg-teal" aria-hidden="true" />
              Si tienes dudas, contacta al administrador
            </li>
          </ul>
        </Card>
      </div>

      {/* Historial de Ventas */}
      <Card titulo="Historial de ventas" descripcion="Ventas realizadas usando tu código de descuento" sinRelleno>
        <DataTable
          etiqueta="Historial de ventas"
          columnas={columnas}
          filas={sales}
          claveFila={(sale) => sale.id}
          cargando={loadingSales}
          paginacion={aPaginacionDeTabla(salesPagination, salesPage)}
          alCambiarPagina={setSalesPage}
          etiquetaTotal="ventas"
          vacio={
            <EmptyState
              frase="Todo empieza con la primera."
              titulo="Aún no tienes ventas"
              descripcion="Comparte tu código con empresas para empezar a ganar comisiones."
            />
          }
        />
      </Card>
    </>
  );
}
