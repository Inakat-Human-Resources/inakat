// RUTA: src/app/admin/users/page.tsx

'use client';

/**
 * Usuarios del equipo interno: administradores, reclutadores y especialistas.
 *
 * Registro de APLICACIÓN (docs/DISENO.md): PageHeader → cifras → tabla paginada
 * en el servidor → modal de alta/edición → confirmación de desactivar. La
 * lógica es la de siempre (mismas llamadas, cuerpos, guardas y avisos); sólo
 * cambió la presentación.
 *
 * El único cambio de forma en el flujo: el confirm() del navegador de
 * «desactivar» pasó a un Modal de confirmación con el MISMO texto, y al
 * confirmar se hace exactamente la misma llamada (DELETE o PUT isActive).
 */

import React, { useState, useEffect } from 'react';
import {
  RefreshCw,
  Plus,
  Pencil,
  UserX,
  Users,
  Shield,
  Briefcase,
  GraduationCap,
  Check,
  Search
} from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import Card from '@/components/ui/Card';
import DataTable, { type Columna } from '@/components/ui/DataTable';
import FilterToolbar, { FiltroSelect } from '@/components/ui/FilterToolbar';
import { Badge, RolBadge } from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import Button from '@/components/ui/Button';
import IconButton from '@/components/ui/IconButton';
import Modal from '@/components/ui/Modal';
import Toast from '@/components/ui/Toast';
import Avatar from '@/components/ui/Avatar';
import Switch from '@/components/ui/Switch';
import { AvisoError } from '@/components/ui/Aviso';
import CampoContrasena from '@/components/ui/CampoContrasena';
import FormField, { Input, Select } from '@/components/ui/FormField';
import { SkeletonPagina } from '@/components/ui/Skeleton';
import { PAGINACION_VACIA, type PaginacionApi } from '@/components/ui/Pagination';
import { cn } from '@/lib/utils';
import { fechaCorta } from '@/lib/fechas';

interface User {
  id: number;
  email: string;
  nombre: string;
  apellidoPaterno: string | null;
  apellidoMaterno: string | null;
  role: string;
  specialty: string | null;
  isActive: boolean;
  lastLogin: string | null;
  createdAt: string;
  _count?: {
    recruiterAssignments: number;
    specialistAssignments: number;
  };
}

interface FormData {
  email: string;
  password: string;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  role: string;
  specialty: string;
}

const INITIAL_FORM: FormData = {
  email: '',
  password: '',
  nombre: '',
  apellidoPaterno: '',
  apellidoMaterno: '',
  role: 'recruiter',
  specialty: ''
};

// Los roles que se pueden dar de alta aquí. Su insignia (icono Y texto) es la
// del panel entero: RolBadge / INSIGNIA_ROL en components/ui/Badge.
const ROLES: Array<{ value: string; label: string }> = [
  { value: 'admin', label: 'Administrador' },
  { value: 'recruiter', label: 'Reclutador' },
  { value: 'specialist', label: 'Especialista' }
];

// Mínimo de contraseña del servidor (PASSWORD_MIN_LENGTH en src/lib/validations.ts).
// ADM-050: el input pedía 6 y la API ya exige 8, así que el navegador dejaba
// enviar contraseñas que el servidor rechazaba con un 400 genérico.
const PASSWORD_MIN_LENGTH = 8;

/** id del formulario del modal: el botón de guardar vive en el pie del Modal. */
const ID_FORM = 'form-usuario';

/** Rótulo de cada grupo del formulario (leyenda del fieldset). */
const CLASE_GRUPO =
  'font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted';

/** Cifra con separador de miles (1,284). */
const cifra = (n: number) => n.toLocaleString('es-MX');

/** «Ana Ruiz Soto»: nombre y apellidos que haya. */
const nombreCompleto = (u: Pick<User, 'nombre' | 'apellidoPaterno' | 'apellidoMaterno'>) =>
  [u.nombre, u.apellidoPaterno, u.apellidoMaterno].filter(Boolean).join(' ');

/** Guion de celda vacía con su lectura para el lector de pantalla. */
function Vacio({ lectura }: { lectura: string }) {
  return (
    <span className="text-ink-muted">
      <span aria-hidden="true">—</span>
      <span className="sr-only">{lectura}</span>
    </span>
  );
}

/** Lo que el Modal de confirmación va a hacer si se acepta. */
interface Confirmacion {
  /** eliminar = DELETE (botón de desactivar) · alternar = PUT isActive (interruptor). */
  tipo: 'eliminar' | 'alternar';
  user: User;
  /** El mismo texto que antes llevaba el confirm(). */
  aviso: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // ADM-024: las especialidades salen del catálogo (/admin/specialties), no de
  // una lista de 7 nombres escrita a mano que impedía dar de alta a un
  // especialista de una especialidad nueva.
  const [specialties, setSpecialties] = useState<string[]>([]);

  // ADM-009/051: id del admin conectado, para no ofrecerle desactivarse ni
  // degradarse a sí mismo (la API ya lo rechaza; aquí se evita el intento).
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);

  // Paginación (ADM-025: la API devuelve 30 por tanda)
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<PaginacionApi>(PAGINACION_VACIA);

  // Tarjetas de conteo: antes se calculaban con .filter() sobre la página
  // cargada, así que con 35 usuarios "Total" decía 30 para siempre (ADM-025).
  const [stats, setStats] = useState({
    total: 0,
    admins: 0,
    recruiters: 0,
    specialists: 0,
    active: 0
  });

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState('');

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- Estado sólo de presentación ------------------------------------------
  // Confirmación de desactivar (antes, confirm() del navegador).
  const [confirmacion, setConfirmacion] = useState<Confirmacion | null>(null);
  // El esqueleto de página sólo en la PRIMERA carga: al buscar o paginar se
  // queda la página (y el foco en el buscador) y sólo la tabla muestra filas
  // esqueleto.
  const [cargaInicial, setCargaInicial] = useState(true);
  useEffect(() => {
    if (!isLoading) setCargaInicial(false);
  }, [isLoading]);
  // Las cifras llegan en su propia tanda: hasta entonces, esqueleto (no «0»).
  const [cifrasListas, setCifrasListas] = useState(false);

  /**
   * Conteos reales: una petición por tarjeta pidiendo una sola fila y leyendo
   * `pagination.total`.
   * TODO(handoff): un endpoint de conteo (groupBy role) ahorraría estas cinco
   * llamadas, igual que hizo /api/admin/stats para el dashboard.
   */
  const fetchStats = async () => {
    try {
      const pedirTotal = async (extra?: Record<string, string>) => {
        const params = new URLSearchParams({ limit: '1', ...(extra || {}) });
        const res = await fetch(`/api/admin/users?${params}`);
        const data = await res.json();
        return data.success ? (data.pagination?.total ?? 0) : 0;
      };

      const [total, admins, recruiters, specialists, active] = await Promise.all([
        pedirTotal(),
        pedirTotal({ role: 'admin' }),
        pedirTotal({ role: 'recruiter' }),
        pedirTotal({ role: 'specialist' }),
        pedirTotal({ isActive: 'true' })
      ]);

      setStats({ total, admins, recruiters, specialists, active });
    } catch (err) {
      console.error('Error cargando conteos de usuarios:', err);
    } finally {
      setCifrasListas(true);
    }
  };

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    const cargarCatalogos = async () => {
      try {
        const [resEsp, resYo] = await Promise.all([
          fetch('/api/specialties'),
          fetch('/api/auth/me')
        ]);

        const dataEsp = await resEsp.json().catch(() => null);
        if (dataEsp?.success && Array.isArray(dataEsp.names)) {
          setSpecialties(dataEsp.names as string[]);
        }

        const dataYo = await resYo.json().catch(() => null);
        if (dataYo?.success && dataYo.user) {
          setCurrentUserId(dataYo.user.id);
        }
      } catch (err) {
        console.error('Error cargando catálogos:', err);
      }
    };
    cargarCatalogos();
  }, []);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (roleFilter) params.append('role', roleFilter);
      if (activeFilter !== '') params.append('isActive', activeFilter);
      params.append('page', String(page));

      const response = await fetch(`/api/admin/users?${params}`);
      const data = await response.json();

      if (data.success) {
        setUsers(data.data);
        setPagination(data.pagination || PAGINACION_VACIA);
      } else {
        setError(data.error || 'Error al cargar usuarios');
      }
    } catch (err) {
      setError('Error de conexión');
    } finally {
      setIsLoading(false);
    }
  };

  // Buscar siempre desde la primera página: filtrar estando en la 3 devolvía
  // una tabla vacía.
  const handleSearch = () => {
    if (page !== 1) {
      setPage(1);
    } else {
      fetchUsers();
    }
  };

  const openNewModal = () => {
    setEditingUser(null);
    setFormData(INITIAL_FORM);
    setIsModalOpen(true);
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      password: '',
      nombre: user.nombre,
      apellidoPaterno: user.apellidoPaterno || '',
      apellidoMaterno: user.apellidoMaterno || '',
      role: user.role,
      specialty: user.specialty || ''
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingUser(null);
    setFormData(INITIAL_FORM);
    setShowPassword(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const url = '/api/admin/users';
      const method = editingUser ? 'PUT' : 'POST';

      const payload: any = {
        ...formData
      };

      // ADM-097: al pasar a un especialista a otro rol, el formulario seguía
      // enviando su especialidad anterior y la cuenta quedaba como reclutador
      // "de Tecnología". Sólo el rol specialist lleva especialidad.
      if (payload.role !== 'specialist') {
        payload.specialty = '';
      }

      if (editingUser) {
        payload.id = editingUser.id;
        // Si no se cambió la contraseña, no enviarla
        if (!payload.password) {
          delete payload.password;
        }
      }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (data.success) {
        mostrarExito(data.message, data.activeAssignments);
        closeModal();
        fetchUsers();
        fetchStats();
      } else {
        setError(data.error || 'Error al guardar usuario');
      }
    } catch (err) {
      setError('Error de conexión');
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * ADM-098: la API devuelve `activeAssignments` (vacantes vivas que quedan sin
   * responsable al desactivar o cambiar el rol). Se avisa en el mensaje de éxito
   * y se deja más tiempo en pantalla para que dé tiempo a leerlo.
   */
  const mostrarExito = (mensaje: string, vacantesSinResponsable?: unknown) => {
    const n = typeof vacantesSinResponsable === 'number' ? vacantesSinResponsable : 0;
    setSuccess(
      n > 0
        ? `${mensaje}. ${n} vacante(s) activa(s) quedaron sin responsable: reasígnalas en Asignaciones.`
        : mensaje
    );
    setTimeout(() => setSuccess(null), n > 0 ? 8000 : 3000);
  };

  const handleDelete = async (user: User) => {
    // ADM-009/051: la propia cuenta no se desactiva desde aquí; el botón ni
    // siquiera se pinta, pero la guarda se queda por si se llama de otro modo.
    if (esUsuarioActual(user)) {
      setError('No puedes desactivar tu propia cuenta de administrador.');
      return;
    }

    const asignaciones =
      (user._count?.recruiterAssignments || 0) + (user._count?.specialistAssignments || 0);
    const aviso = asignaciones > 0
      ? `¿Desactivar a ${user.nombre}? Tiene ${asignaciones} vacante(s) asignada(s) que quedarán sin responsable.`
      : `¿Estás seguro de desactivar a ${user.nombre}?`;

    // Antes: if (!confirm(aviso)) return; — ahora el mismo aviso en un Modal
    // y, al aceptar, la MISMA llamada (desactivarUsuario).
    setConfirmacion({ tipo: 'eliminar', user, aviso });
  };

  const desactivarUsuario = async (user: User) => {
    try {
      const response = await fetch(`/api/admin/users?id=${user.id}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (data.success) {
        mostrarExito('Usuario desactivado exitosamente', data.activeAssignments);
        fetchUsers();
        fetchStats();
      } else {
        setError(data.error || 'Error al desactivar usuario');
      }
    } catch (err) {
      setError('Error de conexión');
    }
  };

  /** ¿Es la fila del admin que está usando la pantalla? (ADM-009/051) */
  const esUsuarioActual = (user: User) => currentUserId !== null && user.id === currentUserId;

  const handleToggleActive = async (user: User) => {
    if (esUsuarioActual(user) && user.isActive) {
      setError('No puedes desactivar tu propia cuenta de administrador.');
      return;
    }

    // ADM-098: el mismo aviso de vacantes asignadas que en el botón de
    // desactivar; desde el pill se desactivaba sin enterarse de que quedaban
    // vacantes sin responsable.
    if (user.isActive) {
      const asignaciones =
        (user._count?.recruiterAssignments || 0) + (user._count?.specialistAssignments || 0);
      const aviso = asignaciones > 0
        ? `¿Desactivar a ${user.nombre}? Perderá el acceso al sistema y tiene ${asignaciones} vacante(s) asignada(s) que quedarán sin responsable.`
        : `¿Desactivar a ${user.nombre}? Perderá el acceso al sistema.`;
      // Antes: if (!confirm(aviso)) return; — ahora un Modal con el mismo aviso.
      setConfirmacion({ tipo: 'alternar', user, aviso });
      return;
    }

    // Activar no pide confirmación (como siempre).
    await alternarActivo(user);
  };

  const alternarActivo = async (user: User) => {
    try {
      const response = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: user.id,
          isActive: !user.isActive
        })
      });

      const data = await response.json();

      if (data.success) {
        mostrarExito(
          `Usuario ${user.isActive ? 'desactivado' : 'activado'} exitosamente`,
          data.activeAssignments
        );
        fetchUsers();
        fetchStats();
      } else {
        setError(data.error || 'Error al actualizar usuario');
      }
    } catch (err) {
      setError('Error de conexión');
    }
  };

  /** El usuario aceptó el Modal: la misma llamada que seguía al confirm(). */
  const confirmarDesactivacion = () => {
    if (!confirmacion) return;
    const { tipo, user } = confirmacion;
    setConfirmacion(null);
    if (tipo === 'eliminar') {
      desactivarUsuario(user);
    } else {
      alternarActivo(user);
    }
  };

  /** La insignia de rol del panel (la misma que /admin/vendors). */
  const insigniaRol = (role: string) => <RolBadge rol={role} />;

  // ---------------------------------------------------------------------------
  // Columnas de la tabla
  // ---------------------------------------------------------------------------
  const idNombre = (user: User) => `usuario-${user.id}-nombre`;

  /** Vacantes asignadas según el rol (la misma regla de siempre); null si no aplica. */
  const asignacionesDe = (user: User): number | null => {
    if (user.role === 'recruiter' && user._count) return user._count.recruiterAssignments;
    if (user.role === 'specialist' && user._count) return user._count.specialistAssignments;
    return null;
  };

  const columnas: Columna<User>[] = [
    {
      id: 'usuario',
      encabezado: 'Usuario',
      enTarjeta: 'titulo',
      className: 'min-w-[12rem]',
      celda: (user) => (
        <div className="flex min-w-0 items-center gap-3">
          <Avatar
            nombre={nombreCompleto(user)}
            email={user.email}
            tamano="sm"
            className={cn(!user.isActive && 'bg-mist text-ink-muted')}
          />
          <div className="min-w-0">
            <p
              id={idNombre(user)}
              className={cn('font-semibold leading-snug', user.isActive ? 'text-ink' : 'text-ink-muted')}
            >
              {nombreCompleto(user)}
              {esUsuarioActual(user) && <span className="ml-1.5 font-normal text-ink-muted">(tú)</span>}
            </p>
            <p className="break-all text-[13px] leading-snug text-ink-muted">{user.email}</p>
          </div>
        </div>
      )
    },
    {
      id: 'role',
      encabezado: 'Rol',
      celda: (user) => {
        const asignaciones = asignacionesDe(user);
        return (
          <div className="flex flex-col items-start gap-1">
            {insigniaRol(user.role)}
            {/* Si las columnas Especialidad o Asignaciones se esconden (tabla
                estrecha), su dato sube aquí: data-solo-bajo sólo se ve
                mientras su columna está escondida. */}
            {user.specialty && (
              <span data-solo-bajo="xl" className="inline-flex">
                <Badge tono="neutro" sinPunto tamano="sm">
                  {user.specialty}
                </Badge>
              </span>
            )}
            {asignaciones !== null && (
              <span data-solo-bajo="md" className="text-xs tabular-nums text-ink-muted">
                {asignaciones} {asignaciones === 1 ? 'asignación' : 'asignaciones'}
              </span>
            )}
          </div>
        );
      }
    },
    {
      id: 'specialty',
      encabezado: 'Especialidad',
      ocultarBajo: 'xl',
      celda: (user) =>
        user.specialty ? (
          <span className="text-ink">{user.specialty}</span>
        ) : (
          <Vacio lectura="Sin especialidad" />
        )
    },
    {
      id: 'asignaciones',
      encabezado: 'Asignaciones',
      numerica: true,
      ocultarBajo: 'md',
      celda: (user) => {
        const asignaciones = asignacionesDe(user);
        if (asignaciones !== null) {
          return <span className="font-display font-semibold">{asignaciones}</span>;
        }
        if (user.role === 'admin') return <Vacio lectura="No aplica" />;
        return null;
      }
    },
    {
      id: 'lastLogin',
      encabezado: 'Último acceso',
      ocultarBajo: 'md',
      celda: (user) =>
        user.lastLogin ? (
          <span className="whitespace-nowrap tabular-nums text-ink">{fechaCorta(user.lastLogin)}</span>
        ) : (
          <span className="whitespace-nowrap text-ink-muted">Nunca</span>
        )
    },
    {
      id: 'estado',
      encabezado: 'Estado',
      className: 'whitespace-nowrap',
      celda: (user) =>
        // ADM-009/051: sobre la propia fila no se ofrece desactivar; quedarse
        // sin admin activo deja el panel inaccesible para todos.
        esUsuarioActual(user) && user.isActive ? (
          <Badge tono="exito" title="Es tu cuenta: no puedes desactivarte">
            Activo (tú)
          </Badge>
        ) : (
          // Interruptor de acceso (el «pill» de antes): el estado lo dicen
          // aria-checked y el texto; a quién pertenece, el nombre de la fila.
          <Switch
            activo={user.isActive}
            alCambiar={() => handleToggleActive(user)}
            describidoPor={idNombre(user)}
            tono="lima-oscuro"
            className="-ml-1"
          />
        )
    },
    {
      id: 'acciones',
      encabezado: 'Acciones',
      encabezadoOculto: true,
      alinear: 'fin',
      // En tarjeta, las acciones van en su propia fila, al final y a lo ancho.
      // Arriba a la derecha ('acciones') la celda mide 1 px (w-px) y el lápiz
      // se desbordaba hacia la izquierda, encima de los nombres largos
      // («Luisa Fernanda Hinojosa Tamez»). Con justify-start arrancan en el
      // borde de la celda; en la tabla da igual (la columna mide lo que sus
      // acciones) y el lápiz queda en la misma vertical en todas las filas.
      enTarjeta: 'completa',
      className: 'w-px whitespace-nowrap',
      celda: (user) => (
        <div className="flex items-center justify-start gap-1">
          <IconButton
            etiqueta={`Editar a ${nombreCompleto(user)}`}
            title="Editar"
            icono={Pencil}
            tamano="sm"
            onClick={() => openEditModal(user)}
          />
          {!esUsuarioActual(user) && (
            <IconButton
              etiqueta={`Desactivar a ${nombreCompleto(user)}`}
              title="Desactivar"
              icono={UserX}
              variante="peligro"
              tamano="sm"
              onClick={() => handleDelete(user)}
            />
          )}
        </div>
      )
    }
  ];

  const hayFiltros = Boolean(searchTerm || roleFilter || activeFilter);
  const inactivos = Math.max(0, stats.total - stats.active);

  if (isLoading && cargaInicial) {
    return <SkeletonPagina />;
  }

  // El error va donde se ve: dentro del modal si está abierto (antes quedaba
  // detrás del fondo oscuro), y arriba de la página si no.
  const avisoError = (dentroDelModal: boolean) =>
    error && (
      <AvisoError
        mensaje={error}
        className={dentroDelModal ? 'mb-5' : undefined}
        // Sin filas, el error es de carga: se ofrece volver a pedir la lista.
        alReintentar={!dentroDelModal && users.length === 0 ? fetchUsers : undefined}
        alCerrar={() => setError(null)}
      />
    );

  return (
    <>
      <PageHeader
        antetitulo="Sistema"
        titulo="Usuarios"
        remate="del equipo"
        descripcion="Administradores, reclutadores y especialistas con acceso al panel."
        acciones={
          <>
            <Button variante="contorno" icono={RefreshCw} onClick={fetchUsers} cargando={isLoading}>
              Actualizar
            </Button>
            <Button icono={Plus} onClick={openNewModal}>
              Nuevo usuario
            </Button>
          </>
        }
      />

      {!isModalOpen && avisoError(false)}

      {/* Cifras reales (pagination.total de la API, ADM-025) */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:mb-8 xl:grid-cols-4">
        <StatCard
          etiqueta="Total de usuarios"
          valor={cifra(stats.total)}
          detalle={cifrasListas ? `${cifra(stats.active)} activos · ${cifra(inactivos)} inactivos` : undefined}
          icono={Users}
          tono="ink"
          cargando={!cifrasListas}
        />
        <StatCard
          etiqueta="Administradores"
          valor={cifra(stats.admins)}
          icono={Shield}
          tono="orange"
          cargando={!cifrasListas}
        />
        <StatCard
          etiqueta="Reclutadores"
          valor={cifra(stats.recruiters)}
          icono={Briefcase}
          tono="teal"
          cargando={!cifrasListas}
        />
        <StatCard
          etiqueta="Especialistas"
          valor={cifra(stats.specialists)}
          icono={GraduationCap}
          tono="lime"
          cargando={!cifrasListas}
        />
      </div>

      <Card sinRelleno>
        {/* Intro en el buscador busca (como siempre); los filtros se aplican
            con «Buscar», igual que antes. */}
        <div
          className="border-b border-line px-5 py-4"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') handleSearch();
          }}
        >
          <FilterToolbar
            busqueda={{
              valor: searchTerm,
              alCambiar: setSearchTerm,
              etiqueta: 'Buscar usuarios',
              placeholder: 'Nombre o correo'
            }}
            resumen={
              !isLoading && users.length > 0
                ? `Mostrando ${users.length} de ${pagination.total} usuario${pagination.total !== 1 ? 's' : ''}`
                : undefined
            }
          >
            <FiltroSelect etiqueta="Rol" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
              <option value="">Todos los roles</option>
              {ROLES.map(role => (
                <option key={role.value} value={role.value}>{role.label}</option>
              ))}
            </FiltroSelect>
            <FiltroSelect etiqueta="Estado" value={activeFilter} onChange={(e) => setActiveFilter(e.target.value)}>
              <option value="">Todos</option>
              <option value="true">Activos</option>
              <option value="false">Inactivos</option>
            </FiltroSelect>
            <Button variante="secundario" tamano="sm" icono={Search} onClick={handleSearch} className="h-9">
              Buscar
            </Button>
          </FilterToolbar>
        </div>

        <DataTable
          etiqueta="Usuarios del equipo"
          columnas={columnas}
          filas={users}
          claveFila={(user) => user.id}
          cargando={isLoading}
          alActivarFila={openEditModal}
          paginacion={pagination}
          alCambiarPagina={setPage}
          etiquetaTotal="usuarios"
          vacio={
            // Un error de carga no es una lista vacía: lo explica el aviso de arriba.
            error ? (
              <p className="px-5 py-10 text-center text-sm text-ink-muted">
                La lista no se pudo cargar. Revisa el aviso de arriba.
              </p>
            ) : (
              <EmptyState
                frase="Nadie por aquí, todavía."
                titulo={hayFiltros ? 'No hay usuarios con estos filtros' : 'No hay usuarios registrados'}
                descripcion={
                  hayFiltros
                    ? 'Cambia la búsqueda o los filtros y pulsa «Buscar».'
                    : 'Da de alta a tu primer reclutador o especialista.'
                }
                accion={
                  hayFiltros ? undefined : (
                    <Button variante="contorno" tamano="sm" icono={Plus} onClick={openNewModal}>
                      Nuevo usuario
                    </Button>
                  )
                }
              />
            )
          }
        />
      </Card>

      {/* Alta / edición */}
      <Modal
        abierto={isModalOpen}
        alCerrar={closeModal}
        titulo={editingUser ? 'Editar usuario' : 'Nuevo usuario'}
        descripcion={
          editingUser
            ? `Datos, rol y contraseña de ${editingUser.email}.`
            : 'Da de alta a un administrador, reclutador o especialista.'
        }
        cerrarAlPulsarFondo={false}
        pie={
          <>
            <Button variante="contorno" onClick={closeModal}>
              Cancelar
            </Button>
            <Button type="submit" form={ID_FORM} icono={Check} cargando={isSubmitting} textoCargando="Guardando…">
              {editingUser ? 'Guardar cambios' : 'Crear usuario'}
            </Button>
          </>
        }
      >
        <form id={ID_FORM} onSubmit={handleSubmit}>
          {avisoError(true)}

          <fieldset className="space-y-4">
            <legend className={CLASE_GRUPO}>Persona</legend>
            <FormField etiqueta="Nombre" requerido>
              <Input
                type="text"
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                autoComplete="off"
              />
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField etiqueta="Apellido paterno" opcional>
                <Input
                  type="text"
                  value={formData.apellidoPaterno}
                  onChange={(e) => setFormData({ ...formData, apellidoPaterno: e.target.value })}
                  autoComplete="off"
                />
              </FormField>
              <FormField etiqueta="Apellido materno" opcional>
                <Input
                  type="text"
                  value={formData.apellidoMaterno}
                  onChange={(e) => setFormData({ ...formData, apellidoMaterno: e.target.value })}
                  autoComplete="off"
                />
              </FormField>
            </div>
          </fieldset>

          {/* El separador va en un envoltorio: un borde en el propio fieldset
              lo cortaría la leyenda. */}
          <div className="mt-6 border-t border-line pt-5">
            <fieldset className="space-y-4">
              <legend className={CLASE_GRUPO}>Acceso</legend>
              <FormField etiqueta="Correo electrónico" requerido ayuda="Con este correo inicia sesión.">
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  autoComplete="off"
                />
              </FormField>
              <FormField
                etiqueta="Contraseña"
                requerido={!editingUser}
                ayuda={
                  editingUser
                    ? `Déjala vacía para mantener la actual. Mínimo ${PASSWORD_MIN_LENGTH} caracteres.`
                    : `Mínimo ${PASSWORD_MIN_LENGTH} caracteres.`
                }
              >
                <CampoContrasena
                  visible={showPassword}
                  alAlternar={() => setShowPassword(!showPassword)}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  minLength={PASSWORD_MIN_LENGTH}
                  autoComplete="new-password"
                />
              </FormField>
            </fieldset>
          </div>

          <div className="mt-6 border-t border-line pt-5">
            <fieldset className="space-y-4">
              <legend className={CLASE_GRUPO}>Rol en el equipo</legend>
              <div className={cn('grid gap-4', formData.role === 'specialist' && 'sm:grid-cols-2')}>
                <FormField
                  etiqueta="Rol"
                  requerido
                  ayuda={
                    editingUser && esUsuarioActual(editingUser)
                      ? 'Es tu propia cuenta: otro administrador debe cambiarte el rol.'
                      : undefined
                  }
                >
                  <Select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    // ADM-009/051: un admin no puede degradarse a sí mismo; se
                    // quedaría fuera del panel en la siguiente petición.
                    disabled={editingUser ? esUsuarioActual(editingUser) : false}
                  >
                    {ROLES.map(role => (
                      <option key={role.value} value={role.value}>{role.label}</option>
                    ))}
                  </Select>
                </FormField>

                {/* Especialidad (solo para specialists) */}
                {formData.role === 'specialist' && (
                  <FormField etiqueta="Especialidad" requerido>
                    <Select
                      value={formData.specialty}
                      onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
                    >
                      <option value="">Selecciona una especialidad</option>
                      {/* ADM-024: catálogo real. Si el especialista tiene una
                          especialidad que ya no está en el catálogo (renombrada o
                          desactivada) se añade como opción para no cambiársela
                          sin querer al guardar. */}
                      {(specialties.includes(formData.specialty) || !formData.specialty
                        ? specialties
                        : [formData.specialty, ...specialties]
                      ).map(spec => (
                        <option key={spec} value={spec}>{spec}</option>
                      ))}
                    </Select>
                  </FormField>
                )}
              </div>
            </fieldset>
          </div>
        </form>
      </Modal>

      {/* Confirmación de desactivar (antes, confirm() del navegador) */}
      <Modal
        abierto={confirmacion !== null}
        alCerrar={() => setConfirmacion(null)}
        tamano="sm"
        iconoTitulo={<UserX size={20} className="text-danger" aria-hidden="true" />}
        titulo="Desactivar usuario"
        descripcion={confirmacion?.aviso}
        pie={
          <>
            <Button variante="contorno" onClick={() => setConfirmacion(null)}>
              Cancelar
            </Button>
            <Button variante="peligro" icono={UserX} onClick={confirmarDesactivacion}>
              Desactivar
            </Button>
          </>
        }
      >
        {confirmacion && (
          <div className="flex items-center gap-3 rounded-xl border border-line bg-paper px-4 py-3">
            <Avatar nombre={nombreCompleto(confirmacion.user)} email={confirmacion.user.email} tamano="sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">{nombreCompleto(confirmacion.user)}</p>
              <p className="truncate text-[13px] text-ink-muted">{confirmacion.user.email}</p>
            </div>
            <span className="ml-auto flex-none">{insigniaRol(confirmacion.user.role)}</span>
          </div>
        )}
      </Modal>

      {/* Éxito: el temporizador sigue siendo el de mostrarExito (3 s, u 8 s si
          quedaron vacantes sin responsable). */}
      <Toast tono="exito" mensaje={success} alCerrar={() => setSuccess(null)} duracion={0} />
    </>
  );
}
