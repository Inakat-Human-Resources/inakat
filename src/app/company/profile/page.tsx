// RUTA: src/app/company/profile/page.tsx

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2,
  User,
  Mail,
  Globe,
  MapPin,
  FileText,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle,
  ArrowLeft
} from 'lucide-react';

interface CompanyProfile {
  userId: number;
  userEmail: string;
  userName: string;
  credits: number;
  representante: {
    nombre: string;
    apellidoPaterno: string;
    apellidoMaterno: string;
  };
  nombreEmpresa: string;
  correoEmpresa: string;
  sitioWeb: string | null;
  razonSocial: string;
  rfc: string;
  direccionEmpresa: string;
  status: string;
  createdAt: string;
  approvedAt: string | null;
}

interface FormData {
  // Representante
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  // Empresa
  nombreEmpresa: string;
  correoEmpresa: string;
  sitioWeb: string;
  razonSocial: string;
  direccionEmpresa: string;
}

export default function CompanyProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [formData, setFormData] = useState<FormData>({
    nombre: '',
    apellidoPaterno: '',
    apellidoMaterno: '',
    nombreEmpresa: '',
    correoEmpresa: '',
    sitioWeb: '',
    razonSocial: '',
    direccionEmpresa: ''
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await fetch('/api/company/profile');

      if (response.status === 401) {
        router.push('/login?redirect=/company/profile');
        return;
      }

      if (response.status === 403) {
        setError('No tienes permisos para acceder a esta página');
        setLoading(false);
        return;
      }

      const result = await response.json();

      if (result.success) {
        setProfile(result.data);
        setFormData({
          nombre: result.data.representante.nombre || '',
          apellidoPaterno: result.data.representante.apellidoPaterno || '',
          apellidoMaterno: result.data.representante.apellidoMaterno || '',
          nombreEmpresa: result.data.nombreEmpresa || '',
          correoEmpresa: result.data.correoEmpresa || '',
          sitioWeb: result.data.sitioWeb || '',
          razonSocial: result.data.razonSocial || '',
          direccionEmpresa: result.data.direccionEmpresa || ''
        });
      } else {
        setError(result.error || 'Error al cargar el perfil');
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
      setError('Error al cargar el perfil');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/company/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const result = await response.json();

      if (result.success) {
        setSuccess('Perfil actualizado exitosamente');
        // Actualizar el perfil local
        if (profile) {
          setProfile({
            ...profile,
            representante: {
              nombre: formData.nombre,
              apellidoPaterno: formData.apellidoPaterno,
              apellidoMaterno: formData.apellidoMaterno
            },
            nombreEmpresa: formData.nombreEmpresa,
            correoEmpresa: formData.correoEmpresa,
            sitioWeb: formData.sitioWeb || null,
            razonSocial: formData.razonSocial,
            direccionEmpresa: formData.direccionEmpresa
          });
        }
        // Limpiar mensaje de éxito después de 3 segundos
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(result.error || 'Error al actualizar el perfil');
      }
    } catch (err) {
      console.error('Error updating profile:', err);
      setError('Error al actualizar el perfil');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-custom-beige">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-button-orange mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando perfil...</p>
        </div>
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-custom-beige">
        <div className="text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => router.push('/company/dashboard')}
            className="px-6 py-2 bg-button-orange text-white rounded-lg hover:bg-opacity-90 transition-colors"
          >
            Volver al Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-custom-beige py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/company/dashboard')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft size={20} />
            Volver al Dashboard
          </button>
          <h1 className="text-3xl font-bold text-title-dark flex items-center gap-3">
            <Building2 className="text-button-green" />
            Perfil de Empresa
          </h1>
          <p className="text-gray-600 mt-2">
            Actualiza la información de tu empresa
          </p>
        </div>

        {/* Mensajes de estado */}
        {error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-300 rounded-lg flex items-center gap-3 text-red-700">
            <AlertCircle size={20} />
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-100 border border-green-300 rounded-lg flex items-center gap-3 text-green-700">
            <CheckCircle size={20} />
            {success}
          </div>
        )}

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Datos del Representante */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <User className="text-button-green" size={20} />
              Datos del Representante
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre
                </label>
                <input
                  type="text"
                  name="nombre"
                  value={formData.nombre}
                  onChange={handleChange}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-button-green focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Apellido Paterno
                </label>
                <input
                  type="text"
                  name="apellidoPaterno"
                  value={formData.apellidoPaterno}
                  onChange={handleChange}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-button-green focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Apellido Materno
                </label>
                <input
                  type="text"
                  name="apellidoMaterno"
                  value={formData.apellidoMaterno}
                  onChange={handleChange}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-button-green focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Datos de la Empresa */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Building2 className="text-button-green" size={20} />
              Datos de la Empresa
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre de Empresa *
                  </label>
                  <input
                    type="text"
                    name="nombreEmpresa"
                    value={formData.nombreEmpresa}
                    onChange={handleChange}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-button-green focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Razón Social *
                  </label>
                  <input
                    type="text"
                    name="razonSocial"
                    value={formData.razonSocial}
                    onChange={handleChange}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-button-green focus:border-transparent"
                    required
                  />
                </div>
              </div>

              {/* RFC - Solo lectura */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  RFC
                  <span className="ml-2 text-xs text-gray-500">(No editable)</span>
                </label>
                <div className="w-full p-3 bg-gray-100 border border-gray-300 rounded-lg text-gray-600 flex items-center gap-2">
                  <FileText size={16} className="text-gray-400" />
                  {profile?.rfc}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                    <Mail size={14} />
                    Correo de Empresa *
                  </label>
                  <input
                    type="email"
                    name="correoEmpresa"
                    value={formData.correoEmpresa}
                    onChange={handleChange}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-button-green focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                    <Globe size={14} />
                    Sitio Web
                  </label>
                  <input
                    type="url"
                    name="sitioWeb"
                    value={formData.sitioWeb}
                    onChange={handleChange}
                    placeholder="https://ejemplo.com"
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-button-green focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                  <MapPin size={14} />
                  Dirección de la Empresa *
                </label>
                <textarea
                  name="direccionEmpresa"
                  value={formData.direccionEmpresa}
                  onChange={handleChange}
                  rows={3}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-button-green focus:border-transparent resize-none"
                  placeholder="Calle, número, colonia, ciudad, CP"
                  required
                />
              </div>
            </div>
          </div>

          {/* Información adicional (solo lectura) */}
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-gray-600">
              <span className="font-medium">Cuenta creada:</span>{' '}
              {profile?.createdAt
                ? new Date(profile.createdAt).toLocaleDateString('es-MX', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })
                : '-'}
            </p>
            {profile?.approvedAt && (
              <p className="text-sm text-gray-600 mt-1">
                <span className="font-medium">Aprobada:</span>{' '}
                {new Date(profile.approvedAt).toLocaleDateString('es-MX', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
            )}
          </div>

          {/* Botón Guardar */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-8 py-3 bg-button-green text-white font-bold rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  Guardando...
                </>
              ) : (
                <>
                  <Save size={20} />
                  Guardar Cambios
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
