// RUTA: src/app/admin/credit-packages/page.tsx

'use client';

/**
 * Paquetes de créditos que las empresas pueden comprar.
 *
 * Registro de aplicación (docs/DISENO.md §5). La lógica es la de siempre:
 * mismas llamadas a /api/admin/credit-packages, mismos cuerpos y mismos
 * mensajes. Los `confirm()` del navegador pasaron a un Modal
 * (useConfirmacion) que responde lo mismo en el mismo punto del flujo.
 */

import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Check, Info } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import DataTable, { type Columna } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import Button from '@/components/ui/Button';
import IconButton from '@/components/ui/IconButton';
import Modal from '@/components/ui/Modal';
import Toast from '@/components/ui/Toast';
import FormField, { Input, Select } from '@/components/ui/FormField';
import { AvisoError } from '@/components/ui/Aviso';
import Switch from '@/components/ui/Switch';
import { useConfirmacion } from '@/components/ui/useConfirmacion';

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
  { value: '', label: 'Sin etiqueta' },
  { value: 'MÁS POPULAR', label: 'MÁS POPULAR' },
  { value: 'PROMOCIÓN', label: 'PROMOCIÓN' }
];

/** Referencia comercial (OCC) que el admin consulta al fijar precios. */
const REFERENCIA_OCC = [
  '1 crédito = $4,000 MXN ($4,000/crédito)',
  '10 créditos = $35,000 MXN ($3,500/crédito) - MÁS POPULAR',
  '15 créditos = $50,000 MXN ($3,333/crédito)',
  '20 créditos = $65,000 MXN ($3,250/crédito) - PROMOCIÓN'
];

/** La etiqueta destacada del paquete, como se verá en la compra. */
function EtiquetaPaquete({ badge }: { badge: string }) {
  return (
    <Badge tono={badge === 'MÁS POPULAR' ? 'destacado' : 'marca'} sinPunto tamano="sm">
      {badge}
    </Badge>
  );
}

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
  // ADM-067: el error de guardado va DENTRO del modal. El banner de la página
  // queda debajo del overlay y el admin reintentaba sin saber qué pasaba.
  const [modalError, setModalError] = useState<string | null>(null);

  // Las preguntas de desactivar, con el Modal del sistema (responden true/false).
  const { confirmar, dialogo } = useConfirmacion();

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
    setModalError(null);
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
    setModalError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingPackage(null);
    setFormData(INITIAL_FORM);
    setModalError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setModalError(null);

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

      if (response.ok && data.success) {
        setSuccess(data.message);
        closeModal();
        fetchPackages();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setModalError(data.error || 'Error al guardar');
      }
    } catch {
      setModalError('Error de conexión');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (pkg: CreditPackage) => {
    if (
      !(await confirmar({
        titulo: `¿Desactivar el paquete "${pkg.name}"?`,
        textoConfirmar: 'Desactivar',
        variante: 'peligro'
      }))
    )
      return;

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
    // ADM-061: el pill desactivaba con un clic, sin aviso, mientras la papelera
    // (que hace lo mismo) sí pedía confirmación. Un paquete inactivo deja de
    // poder comprarse.
    if (
      pkg.isActive &&
      !(await confirmar({
        titulo: `¿Desactivar el paquete "${pkg.name}"?`,
        descripcion: 'Las empresas dejarán de poder comprarlo.',
        textoConfirmar: 'Desactivar',
        variante: 'peligro'
      }))
    ) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/credit-packages/${pkg.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !pkg.isActive })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSuccess(pkg.isActive ? 'Paquete desactivado' : 'Paquete activado');
        fetchPackages();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error || 'Error al actualizar el paquete');
      }
    } catch (err) {
      setError('Error de conexión');
    }
  };

  // ADM-062: el formulario admite centavos (step 0.01) y el cargo se hace por
  // el importe exacto. Redondear a pesos enteros aquí escondía la diferencia:
  // un paquete de $34,999.50 se veía como $35,000.
  // Siempre con dos decimales: con un mínimo de 0 salían «$18,999.5» o
  // «$3,799.9», que en una tabla de dinero parecen un error, y las cifras de
  // la columna no alineaban los centavos.
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  // Calcular precio por crédito en el formulario
  const calculatedPricePerCredit = formData.credits > 0
    ? (formData.price / formData.credits).toFixed(2)
    : '0';

  // ---------------------------------------------------------------------------
  // Presentación
  // ---------------------------------------------------------------------------
  const activos = packages.filter(p => p.isActive).length;

  const columnas: Columna<CreditPackage>[] = [
    {
      id: 'sortOrder',
      encabezado: 'Orden',
      alinear: 'centro',
      // Las filas ya vienen en este orden: con la tabla estrecha, la columna sobra.
      ocultarBajo: 'md',
      className: 'w-px whitespace-nowrap',
      celda: (pkg) => <span className="font-display tabular-nums text-ink-muted">{pkg.sortOrder}</span>,
    },
    {
      id: 'name',
      encabezado: 'Nombre',
      enTarjeta: 'titulo',
      className: 'min-w-[8rem]',
      celda: (pkg) => (
        <div className="min-w-0">
          <p className="font-semibold text-ink">{pkg.name}</p>
          {/* Con la tabla estrecha la columna Etiqueta se esconde: su dato sube aquí. */}
          {pkg.badge && (
            <span data-solo-bajo="lg" className="mt-1 inline-flex">
              <EtiquetaPaquete badge={pkg.badge} />
            </span>
          )}
        </div>
      ),
    },
    {
      id: 'credits',
      encabezado: 'Créditos',
      numerica: true,
      className: 'whitespace-nowrap',
      celda: (pkg) => <span className="font-display text-[15px] font-semibold text-ink">{pkg.credits}</span>,
    },
    {
      id: 'price',
      encabezado: 'Precio',
      numerica: true,
      className: 'whitespace-nowrap',
      celda: (pkg) => (
        <div>
          <span className="font-semibold text-ink">{formatCurrency(pkg.price)}</span>
          {/* Precio por crédito: sube aquí cuando su columna se esconde. */}
          <p data-solo-bajo="md" className="text-xs text-ink-muted">
            {formatCurrency(pkg.pricePerCredit)} por crédito
          </p>
        </div>
      ),
    },
    {
      id: 'pricePerCredit',
      encabezado: 'Precio/crédito',
      numerica: true,
      ocultarBajo: 'md',
      className: 'whitespace-nowrap',
      celda: (pkg) => <span className="text-ink-muted">{formatCurrency(pkg.pricePerCredit)}</span>,
    },
    {
      id: 'badge',
      encabezado: 'Etiqueta',
      ocultarBajo: 'lg',
      className: 'whitespace-nowrap',
      celda: (pkg) =>
        pkg.badge ? (
          <EtiquetaPaquete badge={pkg.badge} />
        ) : (
          <span className="text-ink-muted" aria-label="Sin etiqueta">
            —
          </span>
        ),
    },
    {
      id: 'isActive',
      encabezado: 'Estado',
      className: 'w-px whitespace-nowrap',
      celda: (pkg) => (
        <Switch activo={pkg.isActive} alCambiar={() => handleToggleActive(pkg)} objeto={pkg.name} />
      ),
    },
    {
      id: 'acciones',
      encabezado: 'Acciones',
      encabezadoOculto: true,
      alinear: 'fin',
      enTarjeta: 'acciones',
      className: 'w-px whitespace-nowrap',
      celda: (pkg) => (
        <div className="flex items-center justify-end gap-1">
          <IconButton etiqueta={`Editar ${pkg.name}`} title="Editar" icono={Pencil} tamano="sm" onClick={() => openEditModal(pkg)} />
          {pkg.isActive && (
            <IconButton
              etiqueta={`Desactivar ${pkg.name}`}
              title="Desactivar"
              icono={Trash2}
              tamano="sm"
              variante="peligro"
              onClick={() => handleDelete(pkg)}
            />
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        antetitulo="Empresas y comercial"
        titulo="Paquetes de créditos"
        remate="a la venta"
        descripcion="Configura paquetes disponibles para compra"
        acciones={
          <Button icono={Plus} onClick={openNewModal}>
            Nuevo paquete
          </Button>
        }
      />

      {error && (
        <AvisoError
          mensaje={error}
          alCerrar={() => setError(null)}
          alReintentar={packages.length === 0 ? fetchPackages : undefined}
        />
      )}

      <Toast tono="exito" mensaje={success} alCerrar={() => setSuccess(null)} duracion={0} />

      {/* Info de referencia */}
      <section
        aria-labelledby="referencia-occ"
        className="mb-6 rounded-xl border border-teal/20 bg-teal-tint/70 px-5 py-4"
      >
        <h2 id="referencia-occ" className="flex items-center gap-2 font-display text-sm font-semibold text-teal-dark">
          <Info className="h-4 w-4 flex-none" aria-hidden="true" />
          Referencia de precios (OCC)
        </h2>
        <ul className="mt-2.5 grid gap-x-6 gap-y-1.5 text-[13px] text-teal-dark sm:grid-cols-2">
          {REFERENCIA_OCC.map((linea) => (
            <li key={linea} className="flex items-start gap-2 tabular-nums">
              <span className="mt-[7px] h-1 w-1 flex-none rounded-full bg-teal" aria-hidden="true" />
              {linea}
            </li>
          ))}
        </ul>
      </section>

      <Card
        titulo="Paquetes"
        descripcion={
          !isLoading && packages.length > 0
            ? `${packages.length} paquete${packages.length !== 1 ? 's' : ''} configurado${packages.length !== 1 ? 's' : ''} · ${activos} activo${activos !== 1 ? 's' : ''}`
            : 'En su orden de aparición. Pulsa una fila para editarla.'
        }
        sinRelleno
      >
        <DataTable
          etiqueta="Paquetes de créditos"
          columnas={columnas}
          filas={packages}
          claveFila={(pkg) => pkg.id}
          cargando={isLoading}
          filasEsqueleto={4}
          alActivarFila={openEditModal}
          etiquetaTotal="paquetes"
          vacio={
            error ? (
              <p className="px-5 py-10 text-center text-sm text-ink-muted">
                No se pudieron cargar los paquetes. Pulsa «Reintentar» en el aviso de arriba.
              </p>
            ) : (
              <EmptyState
                frase="Todavía nada por aquí."
                titulo="No hay paquetes configurados"
                descripcion="Crea el primer paquete de créditos"
                accion={
                  <Button variante="contorno" tamano="sm" icono={Plus} onClick={openNewModal}>
                    Crear el primero
                  </Button>
                }
              />
            )
          }
        />
      </Card>

      {/* Crear / editar */}
      <Modal
        abierto={isModalOpen}
        alCerrar={closeModal}
        tamano="md"
        titulo={editingPackage ? 'Editar paquete' : 'Nuevo paquete'}
        subtitulo={editingPackage ? editingPackage.name : undefined}
        cerrarAlPulsarFondo={false}
        pie={
          <>
            <Button variante="contorno" onClick={closeModal}>
              Cancelar
            </Button>
            <Button type="submit" form="form-paquete" icono={Check} cargando={isSubmitting} textoCargando="Guardando…">
              {editingPackage ? 'Guardar cambios' : 'Crear paquete'}
            </Button>
          </>
        }
      >
        <form id="form-paquete" onSubmit={handleSubmit} className="space-y-5">
          {modalError && <AvisoError mensaje={modalError} className="mb-0" />}

          <FormField etiqueta="Nombre del paquete" requerido>
            <Input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="ej. Pack 10"
              autoComplete="off"
            />
          </FormField>

          <div className="grid gap-5 sm:grid-cols-2">
            <FormField etiqueta="Créditos" requerido>
              <Input
                type="number"
                value={formData.credits}
                onChange={(e) => setFormData({ ...formData, credits: parseInt(e.target.value) || 0 })}
                min="1"
                inputMode="numeric"
                className="tabular-nums"
              />
            </FormField>
            <FormField etiqueta="Precio (MXN)" requerido>
              <Input
                type="number"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                min="1"
                step="0.01"
                inputMode="decimal"
                prefijo={<span className="text-sm">$</span>}
                className="tabular-nums"
              />
            </FormField>
          </div>

          {/* Precio por crédito calculado */}
          <div className="flex items-center justify-between gap-4 rounded-lg border border-line bg-paper px-4 py-3">
            <div>
              <p className="text-sm font-medium text-ink">Precio por crédito</p>
              <p className="text-xs text-ink-muted">Se calcula automáticamente</p>
            </div>
            <p className="font-display text-xl font-semibold tabular-nums text-ink">
              {formatCurrency(parseFloat(calculatedPricePerCredit))}
            </p>
          </div>

          <FormField
            etiqueta="Etiqueta destacada"
            opcional
            ayuda="Se mostrará como etiqueta destacada en la página de compra"
          >
            <Select value={formData.badge} onChange={(e) => setFormData({ ...formData, badge: e.target.value })}>
              {BADGE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </Select>
          </FormField>

          <FormField etiqueta="Orden de aparición" ayuda="Los paquetes se ordenan de menor a mayor">
            <Input
              type="number"
              value={formData.sortOrder}
              onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
              min="0"
              inputMode="numeric"
              className="sm:max-w-[10rem]"
            />
          </FormField>
        </form>
      </Modal>

      {dialogo}
    </>
  );
}
