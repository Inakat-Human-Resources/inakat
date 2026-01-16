// RUTA: src/app/admin/users/page.tsx

'use client';

import React, { useState, useEffect } from 'react';
import {
  Search,
  RefreshCw,
  Plus,
  Edit,
  Trash2,
  Users,
  Shield,
  Briefcase,
  GraduationCap,
  X,
  Eye,
  EyeOff,
  Check,
  AlertCircle
} from 'lucide-react';

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

const ROLES = [
  { value: 'admin', label: 'Administrador', icon: Shield, color: 'red' },
  { value: 'recruiter', label: 'Reclutador', icon: Briefcase, color: 'blue' },
  { value: 'specialist', label: 'Especialista', icon: GraduationCap, color: 'green' }
];

const SPECIALTIES = [
  'Tecnología',
  'Arquitectura',
  'Diseño Gráfico',
  'Producción Audiovisual',
  'Educación',
  'Administración de Oficina',
  'Finanzas'
];

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (roleFilter) params.append('role', roleFilter);
      if (activeFilter !== '') params.append('isActive', activeFilter);

      const response = await fetch(`/api/admin/users?${params}`);
      const data = await response.json();

      if (data.success) {
        setUsers(data.data);
      } else {
        setError(data.error || 'Error al cargar usuarios');
      }
    } catch (err) {
      setError('Error de conexión');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = () => {
    fetchUsers();
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
        setSuccess(data.message);
        closeModal();
        fetchUsers();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error || 'Error al guardar usuario');
      }
    } catch (err) {
      setError('Error de conexión');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (user: User) => {
    if (!confirm(`¿Estás seguro de desactivar a ${user.nombre}?`)) return;

    try {
      const response = await fetch(`/api/admin/users?id=${user.id}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('Usuario desactivado exitosamente');
        fetchUsers();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error || 'Error al desactivar usuario');
      }
    } catch (err) {
      setError('Error de conexión');
    }
  };

  const handleToggleActive = async (user: User) => {
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
        setSuccess(`Usuario ${user.isActive ? 'desactivado' : 'activado'} exitosamente`);
        fetchUsers();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error || 'Error al actualizar usuario');
      }
    } catch (err) {
      setError('Error de conexión');
    }
  };

  const getRoleBadge = (role: string) => {
    const roleConfig = ROLES.find(r => r.value === role);
    if (!roleConfig) return null;

    const colorClasses: Record<string, string> = {
      red: 'bg-red-100 text-red-800',
      blue: 'bg-blue-100 text-blue-800',
      green: 'bg-green-100 text-green-800'
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colorClasses[roleConfig.color]}`}>
        {roleConfig.label}
      </span>
    );
  };

  // Stats
  const stats = {
    total: users.length,
    admins: users.filter(u => u.role === 'admin').length,
    recruiters: users.filter(u => u.role === 'recruiter').length,
    specialists: users.filter(u => u.role === 'specialist').length,
    active: users.filter(u => u.isActive).length
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto py-8 px-4">
        {/* Header - Responsive */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-6 md:mb-8">
          <div>
            <h1 className="text-2xl md:text-4xl font-bold text-gray-800 mb-1 md:mb-2">
              Gestión de Usuarios
            </h1>
            <p className="text-gray-600 text-sm md:text-base">
              Administra reclutadores y especialistas
            </p>
          </div>
          <button
            onClick={openNewModal}
            className="w-full sm:w-auto px-4 md:px-6 py-2 md:py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 font-semibold text-sm md:text-base"
          >
            <Plus size={18} />
            Nuevo Usuario
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

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-gray-500">
            <div className="flex items-center gap-3">
              <Users className="text-gray-500" size={24} />
              <div>
                <p className="text-sm text-gray-600">Total</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-red-500">
            <div className="flex items-center gap-3">
              <Shield className="text-red-500" size={24} />
              <div>
                <p className="text-sm text-gray-600">Admins</p>
                <p className="text-2xl font-bold text-red-600">{stats.admins}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
            <div className="flex items-center gap-3">
              <Briefcase className="text-blue-500" size={24} />
              <div>
                <p className="text-sm text-gray-600">Reclutadores</p>
                <p className="text-2xl font-bold text-blue-600">{stats.recruiters}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
            <div className="flex items-center gap-3">
              <GraduationCap className="text-green-500" size={24} />
              <div>
                <p className="text-sm text-gray-600">Especialistas</p>
                <p className="text-2xl font-bold text-green-600">{stats.specialists}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-emerald-500">
            <div className="flex items-center gap-3">
              <Check className="text-emerald-500" size={24} />
              <div>
                <p className="text-sm text-gray-600">Activos</p>
                <p className="text-2xl font-bold text-emerald-600">{stats.active}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Buscar por nombre o email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-4 py-2 border rounded-lg"
            >
              <option value="">Todos los roles</option>
              {ROLES.map(role => (
                <option key={role.value} value={role.value}>{role.label}</option>
              ))}
            </select>

            <select
              value={activeFilter}
              onChange={(e) => setActiveFilter(e.target.value)}
              className="px-4 py-2 border rounded-lg"
            >
              <option value="">Todos</option>
              <option value="true">Activos</option>
              <option value="false">Inactivos</option>
            </select>

            <button
              onClick={handleSearch}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <Search size={20} />
              Buscar
            </button>

            <button
              onClick={fetchUsers}
              className="px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              <RefreshCw className={isLoading ? 'animate-spin' : ''} size={20} />
            </button>
          </div>
        </div>

        {/* Tabla */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Usuario</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Email</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Rol</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Especialidad</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Asignaciones</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Estado</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                      <RefreshCw className="animate-spin mx-auto mb-2" size={24} />
                      Cargando usuarios...
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                      <Users className="mx-auto mb-2 text-gray-400" size={40} />
                      No hay usuarios registrados
                    </td>
                  </tr>
                ) : (
                  users.map(user => (
                    <tr key={user.id} className={`hover:bg-gray-50 ${!user.isActive ? 'opacity-60' : ''}`}>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-gray-900">
                            {user.nombre} {user.apellidoPaterno}
                          </p>
                          {user.apellidoMaterno && (
                            <p className="text-sm text-gray-500">{user.apellidoMaterno}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-gray-600">{user.email}</p>
                        {user.lastLogin && (
                          <p className="text-xs text-gray-400">
                            Último acceso: {new Date(user.lastLogin).toLocaleDateString('es-MX')}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {getRoleBadge(user.role)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {user.specialty ? (
                          <span className="text-sm text-gray-700">{user.specialty}</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {user.role === 'recruiter' && user._count && (
                          <span className="text-sm font-medium">{user._count.recruiterAssignments}</span>
                        )}
                        {user.role === 'specialist' && user._count && (
                          <span className="text-sm font-medium">{user._count.specialistAssignments}</span>
                        )}
                        {user.role === 'admin' && <span className="text-gray-400">-</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleToggleActive(user)}
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            user.isActive
                              ? 'bg-green-100 text-green-800 hover:bg-green-200'
                              : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                          }`}
                        >
                          {user.isActive ? 'Activo' : 'Inactivo'}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-center gap-1">
                          <button
                            onClick={() => openEditModal(user)}
                            className="p-2 text-gray-500 hover:text-yellow-600 hover:bg-yellow-50 rounded"
                            title="Editar"
                          >
                            <Edit size={18} />
                          </button>
                          <button
                            onClick={() => handleDelete(user)}
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

        {/* Results count */}
        {!isLoading && users.length > 0 && (
          <div className="mt-4 text-center text-sm text-gray-600">
            Mostrando {users.length} usuario{users.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Modal de crear/editar */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-2xl font-bold">
                {editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Email */}
              <div>
                <label className="block text-sm font-semibold mb-1">Email *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-semibold mb-1">
                  Contraseña {editingUser ? '(dejar vacío para mantener)' : '*'}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 pr-10"
                    required={!editingUser}
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              {/* Nombre */}
              <div>
                <label className="block text-sm font-semibold mb-1">Nombre *</label>
                <input
                  type="text"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              {/* Apellidos */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1">Apellido Paterno</label>
                  <input
                    type="text"
                    value={formData.apellidoPaterno}
                    onChange={(e) => setFormData({ ...formData, apellidoPaterno: e.target.value })}
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Apellido Materno</label>
                  <input
                    type="text"
                    value={formData.apellidoMaterno}
                    onChange={(e) => setFormData({ ...formData, apellidoMaterno: e.target.value })}
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Rol */}
              <div>
                <label className="block text-sm font-semibold mb-1">Rol *</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                >
                  {ROLES.map(role => (
                    <option key={role.value} value={role.value}>{role.label}</option>
                  ))}
                </select>
              </div>

              {/* Especialidad (solo para specialists) */}
              {formData.role === 'specialist' && (
                <div>
                  <label className="block text-sm font-semibold mb-1">Especialidad *</label>
                  <select
                    value={formData.specialty}
                    onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Seleccionar especialidad</option>
                    {SPECIALTIES.map(spec => (
                      <option key={spec} value={spec}>{spec}</option>
                    ))}
                  </select>
                </div>
              )}

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
                      {editingUser ? 'Guardar Cambios' : 'Crear Usuario'}
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
