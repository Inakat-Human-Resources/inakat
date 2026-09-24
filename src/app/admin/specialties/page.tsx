// RUTA: src/app/admin/specialties/page.tsx

'use client';

/**
 * Catálogo de especialidades (perfiles profesionales) de la plataforma.
 *
 * Registro de aplicación (docs/DISENO.md §5): PageHeader → cifras → tabla →
 * modales. La lógica es la de siempre: mismas llamadas a
 * /api/admin/specialties con los mismos cuerpos, mismos estados y mismos
 * mensajes. Sólo cambió la presentación.
 */

import React, { useState, useEffect } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  Save,
  ChevronDown,
  Tags,
  CheckCircle2,
  CircleOff,
  X
} from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import Card from '@/components/ui/Card';
import DataTable, { type Columna } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import Button from '@/components/ui/Button';
import IconButton from '@/components/ui/IconButton';
import Modal from '@/components/ui/Modal';
import Toast from '@/components/ui/Toast';
import FormField, { Input, Textarea, Checkbox } from '@/components/ui/FormField';
import { SkeletonPagina } from '@/components/ui/Skeleton';
import { cn } from '@/lib/utils';
import { AvisoError } from '@/components/ui/Aviso';
import Switch from '@/components/ui/Switch';

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

/** «1 subcategoría», «8 subcategorías». */
const subcategoriasTexto = (n: number) => `${n} subcategoría${n !== 1 ? 's' : ''}`;

/** Muestra del color de la especialidad (dato del admin; decorativo: el nombre va al lado). */
function MuestraColor({ color, className }: { color: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn('inline-block h-2.5 w-2.5 flex-none rounded-full ring-1 ring-ink/15', className)}
      style={{ backgroundColor: color }}
    />
  );
}

export default function SpecialtiesPage() {
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
  // ADM-069: el error de guardado se pinta DENTRO del modal. El banner de la
  // página queda debajo del overlay y el admin no veía por qué no se guardaba.
  const [modalError, setModalError] = useState<string | null>(null);

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
    setModalError(null);
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
    setModalError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setFormData(initialFormData);
    setNewSubcategory('');
    setModalError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setModalError(null);

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
        setModalError(data.error || 'Error al guardar');
      }
    } catch {
      setModalError('Error de conexión');
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

  // ---------------------------------------------------------------------------
  // Presentación
  // ---------------------------------------------------------------------------
  const activas = specialties.filter((s) => s.isActive).length;
  const porEliminar = specialties.find((s) => s.id === deleteConfirmId) ?? null;

  const columnas: Columna<Specialty>[] = [
    {
      id: 'sortOrder',
      encabezado: 'Orden',
      alinear: 'centro',
      // Las filas ya vienen en este orden: con la tabla estrecha, la columna sobra.
      ocultarBajo: 'md',
      className: 'w-px whitespace-nowrap',
      celda: (s) => <span className="font-display tabular-nums text-ink-muted">{s.sortOrder}</span>,
    },
    {
      id: 'name',
      encabezado: 'Especialidad',
      enTarjeta: 'titulo',
      className: 'min-w-[12rem]',
      celda: (s) => (
        <div className="flex min-w-0 items-start gap-3">
          <MuestraColor color={s.color} className="mt-[7px]" />
          <div className="min-w-0">
            <p className="font-semibold text-ink">
              {s.icon && (
                <span className="mr-1.5" aria-hidden="true">
                  {s.icon}
                </span>
              )}
              {s.name}
            </p>
            {s.description && (
              <p className="mt-0.5 line-clamp-2 max-w-md text-[13px] leading-snug text-ink-muted">{s.description}</p>
            )}
          </div>
        </div>
      ),
    },
    {
      id: 'subcategories',
      encabezado: 'Subcategorías',
      celda: (s) => {
        if (s.subcategories.length === 0) {
          return <span className="text-[13px] text-ink-muted">Sin subcategorías</span>;
        }
        const abierta = expandedRows.has(s.id);
        return (
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => toggleRowExpand(s.id)}
              aria-expanded={abierta}
              aria-controls={`subcategorias-${s.id}`}
              className="-mx-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[13px] font-medium text-teal transition-colors duration-150 hover:bg-teal-tint hover:text-teal-dark"
            >
              {subcategoriasTexto(s.subcategories.length)}
              <span className="sr-only"> de {s.name}</span>
              <ChevronDown
                className={cn('h-4 w-4 transition-transform duration-150', abierta && 'rotate-180')}
                aria-hidden="true"
              />
            </button>
            {abierta && (
              <ul id={`subcategorias-${s.id}`} className="mt-1.5 flex max-w-sm flex-wrap gap-1.5">
                {s.subcategories.map((sub, index) => (
                  <li key={index}>
                    <Badge tono="neutro" sinPunto tamano="sm">
                      #{sub}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      },
    },
    {
      id: 'isActive',
      encabezado: 'Estado',
      className: 'w-px whitespace-nowrap',
      celda: (s) => (
        <Switch
          activo={s.isActive}
          alCambiar={() => toggleActive(s)}
          objeto={s.name}
          textos={{ activo: 'Activa', inactivo: 'Inactiva' }}
        />
      ),
    },
    {
      id: 'acciones',
      encabezado: 'Acciones',
      encabezadoOculto: true,
      alinear: 'fin',
      enTarjeta: 'acciones',
      className: 'w-px whitespace-nowrap',
      celda: (s) => (
        <div className="flex items-center justify-end gap-1">
          <IconButton etiqueta={`Editar ${s.name}`} title="Editar" icono={Pencil} tamano="sm" onClick={() => openEditModal(s)} />
          <IconButton
            etiqueta={`Eliminar ${s.name}`}
            title="Eliminar"
            icono={Trash2}
            tamano="sm"
            variante="peligro"
            onClick={() => setDeleteConfirmId(s.id)}
          />
        </div>
      ),
    },
  ];

  if (isLoading && specialties.length === 0) {
    return <SkeletonPagina />;
  }

  return (
    <>
      <PageHeader
        antetitulo="Sistema"
        titulo="Especialidades"
        remate="del catálogo"
        descripcion="Gestiona los perfiles profesionales disponibles en la plataforma"
        acciones={
          <Button icono={Plus} onClick={openCreateModal}>
            Nueva especialidad
          </Button>
        }
      />

      {error && (
        <AvisoError
          mensaje={error}
          alCerrar={() => setError(null)}
          // Sin lista, el fallo fue al cargarla: se ofrece volver a pedirla.
          alReintentar={specialties.length === 0 ? fetchSpecialties : undefined}
        />
      )}

      <Toast tono="exito" mensaje={success} alCerrar={() => setSuccess(null)} duracion={0} />

      <div className="mb-6 grid grid-cols-3 gap-3 sm:gap-4 lg:mb-8">
        <StatCard etiqueta="Total" valor={specialties.length} icono={Tags} tono="teal" />
        <StatCard etiqueta="Activas" valor={activas} icono={CheckCircle2} tono="lime" />
        <StatCard etiqueta="Inactivas" valor={specialties.length - activas} icono={CircleOff} tono="ink" />
      </div>

      <Card titulo="Catálogo" descripcion="En su orden de aparición. Pulsa una fila para editarla." sinRelleno>
        <DataTable
          etiqueta="Especialidades"
          columnas={columnas}
          filas={specialties}
          claveFila={(s) => s.id}
          cargando={isLoading}
          alActivarFila={openEditModal}
          etiquetaTotal="especialidades"
          vacio={
            error ? (
              <p className="px-5 py-10 text-center text-sm text-ink-muted">
                No se pudo cargar el catálogo. Pulsa «Reintentar» en el aviso de arriba.
              </p>
            ) : (
              <EmptyState
                frase="Todavía nada por aquí."
                titulo="No hay especialidades registradas"
                descripcion="Crea la primera: al guardarla se generan sus precios."
                accion={
                  <Button variante="contorno" tamano="sm" icono={Plus} onClick={openCreateModal}>
                    Crear la primera
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
        titulo={editingId ? 'Editar especialidad' : 'Nueva especialidad'}
        cerrarAlPulsarFondo={false}
        pie={
          <>
            <Button variante="contorno" onClick={closeModal}>
              Cancelar
            </Button>
            <Button
              type="submit"
              form="form-especialidad"
              icono={Save}
              cargando={isSubmitting}
              textoCargando="Guardando…"
            >
              {editingId ? 'Guardar cambios' : 'Crear especialidad'}
            </Button>
          </>
        }
      >
        <form id="form-especialidad" onSubmit={handleSubmit} className="space-y-5">
          {modalError && <AvisoError mensaje={modalError} className="mb-0" />}

          <FormField etiqueta="Nombre" requerido>
            <Input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ej: Tecnología"
              autoComplete="off"
            />
          </FormField>

          <FormField etiqueta="Descripción" opcional>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Descripción breve de la especialidad"
              rows={2}
            />
          </FormField>

          <div className="grid gap-5 sm:grid-cols-2">
            <FormField etiqueta="Color" ayuda="Hexadecimal, por ejemplo #2b5d62.">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  aria-label="Elegir el color en la paleta"
                  className="h-10 w-12 flex-none cursor-pointer rounded-lg border border-line-strong bg-white p-1 transition-colors duration-150 hover:border-ink"
                />
                <Input
                  type="text"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  placeholder="#2b5d62"
                  className="font-mono"
                  spellCheck={false}
                />
              </div>
            </FormField>

            <FormField etiqueta="Icono (emoji)" opcional>
              <Input
                type="text"
                value={formData.icon}
                onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                placeholder="💻"
              />
            </FormField>
          </div>

          <FormField etiqueta="Orden de aparición" ayuda="Se ordenan de menor a mayor.">
            <Input
              type="number"
              value={formData.sortOrder}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  sortOrder: parseInt(e.target.value) || 0
                })
              }
              min="0"
              className="sm:max-w-[10rem]"
            />
          </FormField>

          <div className="space-y-2.5">
            <FormField etiqueta="Subcategorías" opcional ayuda="Escribe una y pulsa Intro o «Añadir».">
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={newSubcategory}
                  onChange={(e) => setNewSubcategory(e.target.value)}
                  onKeyPress={(e) =>
                    e.key === 'Enter' &&
                    (e.preventDefault(), addSubcategory())
                  }
                  placeholder="Ej: Desarrollo web"
                />
                <Button variante="contorno" icono={Plus} onClick={addSubcategory} className="flex-none">
                  Añadir
                </Button>
              </div>
            </FormField>
            {formData.subcategories.length > 0 && (
              <ul aria-label="Subcategorías añadidas" className="flex flex-wrap gap-1.5">
                {formData.subcategories.map((sub, index) => (
                  <li
                    key={index}
                    className="inline-flex items-center gap-0.5 rounded-full bg-mist py-0.5 pl-2.5 pr-0.5 text-xs font-medium text-ink"
                  >
                    #{sub}
                    <button
                      type="button"
                      onClick={() => removeSubcategory(index)}
                      aria-label={`Quitar ${sub}`}
                      title={`Quitar ${sub}`}
                      className="flex h-6 w-6 items-center justify-center rounded-full text-ink-muted transition-colors duration-150 hover:bg-danger-tint hover:text-danger"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Checkbox
            etiqueta="Especialidad activa"
            descripcion="Si está inactiva, deja de aparecer en el catálogo de especialidades."
            checked={formData.isActive}
            onChange={() => setFormData({ ...formData, isActive: !formData.isActive })}
          />
        </form>
      </Modal>

      {/* Confirmar borrado */}
      <Modal
        abierto={deleteConfirmId !== null}
        alCerrar={() => setDeleteConfirmId(null)}
        tamano="sm"
        titulo="¿Eliminar especialidad?"
        descripcion="Esta acción no se puede deshacer. Si la especialidad está en uso, no podrá eliminarse."
        claseCuerpo={porEliminar ? undefined : 'hidden'}
        pie={
          <>
            <Button variante="contorno" onClick={() => setDeleteConfirmId(null)}>
              Cancelar
            </Button>
            <Button
              variante="peligro"
              icono={Trash2}
              onClick={() => deleteConfirmId !== null && handleDelete(deleteConfirmId)}
            >
              Sí, eliminar
            </Button>
          </>
        }
      >
        {porEliminar && (
          <div className="flex items-center gap-3 rounded-lg border border-line bg-paper px-4 py-3">
            <MuestraColor color={porEliminar.color} />
            <div className="min-w-0">
              <p className="font-semibold text-ink">
                {porEliminar.icon && (
                  <span className="mr-1.5" aria-hidden="true">
                    {porEliminar.icon}
                  </span>
                )}
                {porEliminar.name}
              </p>
              <p className="text-[13px] text-ink-muted">
                {porEliminar.subcategories.length > 0
                  ? subcategoriasTexto(porEliminar.subcategories.length)
                  : 'Sin subcategorías'}
              </p>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
