// RUTA: src/app/profile/page.tsx

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User, Lock, Save, Loader2, Eye, EyeOff, CheckCircle } from 'lucide-react';

interface ProfileData {
  id: number;
  email: string;
  nombre: string;
  role: string;
  company?: string;
  credits?: number;
  candidate?: {
    id: number;
    nombre?: string;
    apellidoPaterno?: string;
    apellidoMaterno?: string;
    telefono?: string;
    universidad?: string;
    carrera?: string;
    nivelEstudios?: string;
    profile?: string;
    seniority?: string;
    linkedinUrl?: string;
    portafolioUrl?: string;
  };
}

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state
  const [nombre, setNombre] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Candidate data
  const [telefono, setTelefono] = useState('');
  const [universidad, setUniversidad] = useState('');
  const [carrera, setCarrera] = useState('');
  const [nivelEstudios, setNivelEstudios] = useState('');
  const [profileField, setProfileField] = useState('');
  const [seniority, setSeniority] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [portafolioUrl, setPortafolioUrl] = useState('');

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/profile', {
        credentials: 'include'
      });

      if (response.status === 401) {
        router.push('/login');
        return;
      }

      const data = await response.json();
      if (data.success) {
        setProfile(data.data);
        setNombre(data.data.nombre || '');

        // Cargar datos de candidato si existen
        if (data.data.candidate) {
          setTelefono(data.data.candidate.telefono || '');
          setUniversidad(data.data.candidate.universidad || '');
          setCarrera(data.data.candidate.carrera || '');
          setNivelEstudios(data.data.candidate.nivelEstudios || '');
          setProfileField(data.data.candidate.profile || '');
          setSeniority(data.data.candidate.seniority || '');
          setLinkedinUrl(data.data.candidate.linkedinUrl || '');
          setPortafolioUrl(data.data.candidate.portafolioUrl || '');
        }
      } else {
        setError(data.error || 'Error al cargar perfil');
      }
    } catch (err) {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validar passwords si se quiere cambiar
    if (newPassword || confirmPassword) {
      if (!currentPassword) {
        setError('Debes ingresar tu contraseña actual');
        return;
      }
      if (newPassword !== confirmPassword) {
        setError('Las contraseñas nuevas no coinciden');
        return;
      }
      if (newPassword.length < 8) {
        setError('La nueva contraseña debe tener al menos 8 caracteres');
        return;
      }
    }

    try {
      setSaving(true);

      const updateData: any = { nombre };

      if (newPassword && currentPassword) {
        updateData.currentPassword = currentPassword;
        updateData.newPassword = newPassword;
      }

      // Si es candidato, incluir datos adicionales
      if (profile?.candidate) {
        updateData.candidateData = {
          telefono,
          universidad,
          carrera,
          nivelEstudios,
          profile: profileField,
          seniority,
          linkedinUrl,
          portafolioUrl
        };
      }

      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updateData)
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('Perfil actualizado exitosamente');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        // Recargar datos
        fetchProfile();
      } else {
        setError(data.error || 'Error al actualizar');
      }
    } catch (err) {
      setError('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      admin: 'Administrador',
      company: 'Empresa',
      recruiter: 'Reclutador',
      specialist: 'Especialista',
      candidate: 'Candidato',
      user: 'Usuario'
    };
    return labels[role] || role;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pt-32 pb-12 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-button-orange" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50 pt-32 pb-12">
        <div className="max-w-2xl mx-auto px-4">
          <div className="bg-red-50 text-red-700 p-4 rounded-lg">
            Error al cargar el perfil
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-32 pb-12">
      <div className="max-w-2xl mx-auto px-4">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-button-orange text-white rounded-full flex items-center justify-center text-2xl font-bold">
              {nombre ? nombre.substring(0, 2).toUpperCase() : profile.email.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {nombre || profile.email}
              </h1>
              <p className="text-gray-500">{profile.email}</p>
              <span className="inline-block mt-1 px-3 py-1 bg-button-orange/10 text-button-orange text-sm font-medium rounded-full">
                {getRoleLabel(profile.role)}
              </span>
            </div>
          </div>

          {profile.role === 'company' && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-600">
                Empresa: <span className="font-semibold">{profile.company || 'No especificada'}</span>
              </p>
              <p className="text-sm text-gray-600">
                Créditos disponibles: <span className="font-bold text-green-600">{profile.credits || 0}</span>
              </p>
            </div>
          )}
        </div>

        {/* Messages */}
        {error && (
          <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-6 flex items-center gap-2">
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="bg-green-50 text-green-700 p-4 rounded-lg mb-6 flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            <span>{success}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Datos básicos */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <User className="w-5 h-5" />
              Datos Personales
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre completo
                </label>
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-button-orange focus:border-button-orange"
                  placeholder="Tu nombre"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={profile.email}
                  disabled
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500"
                />
                <p className="text-xs text-gray-500 mt-1">El email no se puede cambiar</p>
              </div>
            </div>
          </div>

          {/* Datos de Candidato */}
          {profile.candidate && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">
                Datos Profesionales
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Teléfono
                  </label>
                  <input
                    type="tel"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-button-orange focus:border-button-orange"
                    placeholder="+52 555 123 4567"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Universidad
                  </label>
                  <input
                    type="text"
                    value={universidad}
                    onChange={(e) => setUniversidad(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-button-orange focus:border-button-orange"
                    placeholder="Nombre de la universidad"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Carrera
                  </label>
                  <input
                    type="text"
                    value={carrera}
                    onChange={(e) => setCarrera(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-button-orange focus:border-button-orange"
                    placeholder="Ingeniería en Sistemas"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nivel de Estudios
                  </label>
                  <select
                    value={nivelEstudios}
                    onChange={(e) => setNivelEstudios(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-button-orange focus:border-button-orange"
                  >
                    <option value="">Seleccionar...</option>
                    <option value="Técnico">Técnico</option>
                    <option value="Licenciatura">Licenciatura</option>
                    <option value="Maestría">Maestría</option>
                    <option value="Doctorado">Doctorado</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Perfil
                  </label>
                  <input
                    type="text"
                    value={profileField}
                    onChange={(e) => setProfileField(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-button-orange focus:border-button-orange"
                    placeholder="Ej: Tecnología, Marketing"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Seniority
                  </label>
                  <select
                    value={seniority}
                    onChange={(e) => setSeniority(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-button-orange focus:border-button-orange"
                  >
                    <option value="">Seleccionar...</option>
                    <option value="Practicante">Practicante</option>
                    <option value="Jr">Jr</option>
                    <option value="Middle">Middle</option>
                    <option value="Sr">Sr</option>
                    <option value="Director">Director</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    LinkedIn URL
                  </label>
                  <input
                    type="url"
                    value={linkedinUrl}
                    onChange={(e) => setLinkedinUrl(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-button-orange focus:border-button-orange"
                    placeholder="https://linkedin.com/in/..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Portfolio URL
                  </label>
                  <input
                    type="url"
                    value={portafolioUrl}
                    onChange={(e) => setPortafolioUrl(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-button-orange focus:border-button-orange"
                    placeholder="https://miportfolio.com"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Cambiar contraseña */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Lock className="w-5 h-5" />
              Cambiar Contraseña
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              Deja estos campos vacíos si no deseas cambiar tu contraseña
            </p>

            <div className="space-y-4">
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contraseña actual
                </label>
                <input
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-button-orange focus:border-button-orange pr-10"
                  placeholder="Tu contraseña actual"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-8 text-gray-400 hover:text-gray-600"
                >
                  {showCurrentPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nueva contraseña
                </label>
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-button-orange focus:border-button-orange pr-10"
                  placeholder="Mínimo 8 caracteres"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-8 text-gray-400 hover:text-gray-600"
                >
                  {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Confirmar nueva contraseña
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-button-orange focus:border-button-orange"
                  placeholder="Repite la nueva contraseña"
                />
              </div>
            </div>
          </div>

          {/* Submit button */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 bg-button-orange text-white px-6 py-3 rounded-lg hover:bg-opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
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
