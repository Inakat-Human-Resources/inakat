'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  X,
  AlertCircle,
  CheckCircle,
  User,
  Loader2,
  LogIn,
  UserPlus,
  FileText,
  AlertTriangle,
  Briefcase,
  ArrowRight
} from 'lucide-react';

interface ApplyJobModalProps {
  jobId: number;
  jobTitle: string;
  company: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ExistingApplication {
  status: string;
  statusLabel: string;
  appliedAt: string;
}

interface CandidateProfile {
  id: number;
  nombre?: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;
  telefono?: string;
  cvUrl?: string;
  email?: string;
}

interface ProfileData {
  id: number;
  email: string;
  nombre: string;
  role: string;
  candidate?: CandidateProfile;
}

// Campos requeridos para postulación
const REQUIRED_FIELDS = ['nombre', 'apellidoPaterno', 'telefono', 'cvUrl'];

type ModalView = 'loading' | 'not_logged_in' | 'profile_incomplete' | 'confirm_apply' | 'already_applied' | 'manual_form';

const ApplyJobModal = ({
  jobId,
  jobTitle,
  company,
  isOpen,
  onClose,
  onSuccess
}: ApplyJobModalProps) => {
  const router = useRouter();

  // Vista actual del modal
  const [view, setView] = useState<ModalView>('loading');

  // Datos del usuario
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [existingApplication, setExistingApplication] = useState<ExistingApplication | null>(null);

  // Campos faltantes
  const [missingFields, setMissingFields] = useState<string[]>([]);

  // Estados de carga
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Formulario manual (para usuarios no logueados que eligen aplicar sin cuenta)
  const [showManualForm, setShowManualForm] = useState(false);
  const [formData, setFormData] = useState({
    candidateName: '',
    candidateEmail: '',
    candidatePhone: '',
    coverLetter: ''
  });
  const [cvFile, setCvFile] = useState<File | null>(null);

  // Cargar perfil cuando se abre el modal
  useEffect(() => {
    if (isOpen) {
      loadProfileAndCheck();
    } else {
      // Reset states when closing
      setView('loading');
      setProfile(null);
      setExistingApplication(null);
      setMissingFields([]);
      setError('');
      setShowManualForm(false);
      setFormData({
        candidateName: '',
        candidateEmail: '',
        candidatePhone: '',
        coverLetter: ''
      });
      setCvFile(null);
    }
  }, [isOpen]);

  const loadProfileAndCheck = async () => {
    setView('loading');
    setError('');

    try {
      // 1. Verificar si está logueado
      const profileRes = await fetch('/api/profile', { credentials: 'include' });

      if (profileRes.status === 401) {
        setView('not_logged_in');
        return;
      }

      const profileData = await profileRes.json();

      if (!profileData.success) {
        setView('not_logged_in');
        return;
      }

      setProfile(profileData.data);

      // 2. Verificar si ya aplicó
      const checkRes = await fetch(
        `/api/applications/check?jobId=${jobId}&email=${encodeURIComponent(profileData.data.email)}`
      );
      const checkData = await checkRes.json();

      if (checkData.success && checkData.hasApplied) {
        setExistingApplication(checkData.application);
        setView('already_applied');
        return;
      }

      // 3. Verificar si tiene perfil de candidato completo
      const candidate = profileData.data.candidate;

      if (!candidate) {
        // Usuario logueado pero no es candidato (puede ser company, etc.)
        setView('profile_incomplete');
        setMissingFields(['Perfil de candidato no encontrado']);
        return;
      }

      // 4. Verificar campos requeridos
      const missing: string[] = [];
      const fieldLabels: Record<string, string> = {
        nombre: 'Nombre',
        apellidoPaterno: 'Apellido Paterno',
        telefono: 'Teléfono',
        cvUrl: 'Curriculum Vitae (CV)'
      };

      for (const field of REQUIRED_FIELDS) {
        const value = candidate[field as keyof CandidateProfile];
        if (!value || (typeof value === 'string' && value.trim() === '')) {
          missing.push(fieldLabels[field] || field);
        }
      }

      if (missing.length > 0) {
        setMissingFields(missing);
        setView('profile_incomplete');
        return;
      }

      // 5. Perfil completo - mostrar confirmación
      setView('confirm_apply');

    } catch (err) {
      console.error('Error loading profile:', err);
      setError('Error al cargar los datos');
      setView('not_logged_in');
    }
  };

  // Postulación automática con datos del perfil
  const handleQuickApply = async () => {
    if (!profile || !profile.candidate) return;

    setIsSubmitting(true);
    setError('');

    try {
      const candidate = profile.candidate;
      const fullName = [
        candidate.nombre,
        candidate.apellidoPaterno,
        candidate.apellidoMaterno
      ].filter(Boolean).join(' ');

      const applicationPayload = {
        jobId,
        candidateName: fullName,
        candidateEmail: profile.email,
        candidatePhone: candidate.telefono || null,
        cvUrl: candidate.cvUrl || null,
        coverLetter: null
      };

      const response = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(applicationPayload)
      });

      const data = await response.json();

      if (data.success) {
        onSuccess();
        onClose();
      } else {
        if (response.status === 409) {
          setError('Ya has aplicado a esta vacante anteriormente.');
        } else if (response.status === 404) {
          setError('La vacante ya no está disponible.');
        } else {
          setError(data.error || 'Error al enviar aplicación.');
        }
      }
    } catch (err) {
      console.error('Application error:', err);
      setError('Error al procesar la solicitud');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Aplicación manual (sin cuenta)
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      let cvUrl = null;

      // Subir CV si existe
      if (cvFile) {
        const MAX_FILE_SIZE = 5 * 1024 * 1024;
        if (cvFile.size > MAX_FILE_SIZE) {
          throw new Error('El archivo CV excede el tamaño máximo de 5MB');
        }

        const cvFormData = new FormData();
        cvFormData.append('file', cvFile);

        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          body: cvFormData
        });

        if (!uploadRes.ok) {
          throw new Error('Error al subir CV');
        }

        const uploadData = await uploadRes.json();
        cvUrl = uploadData.url;
      }

      // Crear aplicación
      const applicationPayload = {
        jobId,
        candidateName: formData.candidateName,
        candidateEmail: formData.candidateEmail,
        candidatePhone: formData.candidatePhone || null,
        coverLetter: formData.coverLetter || null,
        cvUrl
      };

      const response = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(applicationPayload)
      });

      const data = await response.json();

      if (data.success) {
        onSuccess();
        onClose();
      } else {
        if (response.status === 409) {
          setError('Ya has aplicado a esta vacante con este email.');
        } else {
          setError(data.error || 'Error al enviar aplicación.');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al procesar la solicitud');
    } finally {
      setIsSubmitting(false);
    }
  };

  const goToProfile = () => {
    router.push('/profile');
    onClose();
  };

  const goToLogin = () => {
    router.push(`/login?redirect=/talents`);
    onClose();
  };

  const goToRegister = () => {
    router.push('/register?role=candidate');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-start p-6 border-b">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {view === 'manual_form' ? 'Aplicar a Vacante' : 'Postularme'}
            </h2>
            <p className="text-gray-600 mt-1 text-sm">
              {jobTitle} - {company}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Vista: Cargando */}
          {view === 'loading' && (
            <div className="text-center py-8">
              <Loader2 className="w-12 h-12 animate-spin text-button-orange mx-auto mb-4" />
              <p className="text-gray-600">Verificando tu perfil...</p>
            </div>
          )}

          {/* Vista: No logueado */}
          {view === 'not_logged_in' && !showManualForm && (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <User className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Inicia sesión para aplicar
              </h3>
              <p className="text-gray-600 mb-6">
                Con tu cuenta podrás postularte con un solo clic usando tu perfil guardado.
              </p>

              <div className="space-y-3">
                <button
                  onClick={goToLogin}
                  className="w-full flex items-center justify-center gap-2 bg-button-orange text-white py-3 rounded-lg hover:bg-opacity-90 font-semibold"
                >
                  <LogIn size={20} />
                  Iniciar Sesión
                </button>

                <button
                  onClick={goToRegister}
                  className="w-full flex items-center justify-center gap-2 border-2 border-button-orange text-button-orange py-3 rounded-lg hover:bg-orange-50 font-semibold"
                >
                  <UserPlus size={20} />
                  Registrarme como Candidato
                </button>

                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-gray-500">o</span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setShowManualForm(true);
                    setView('manual_form');
                  }}
                  className="w-full text-gray-600 py-2 hover:text-gray-900 text-sm"
                >
                  Aplicar sin cuenta →
                </button>
              </div>
            </div>
          )}

          {/* Vista: Perfil incompleto */}
          {view === 'profile_incomplete' && (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-yellow-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Completa tu perfil
              </h3>
              <p className="text-gray-600 mb-4">
                Para postularte con un clic, necesitas completar la siguiente información:
              </p>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6 text-left">
                <p className="text-sm font-medium text-yellow-800 mb-2">
                  Campos faltantes:
                </p>
                <ul className="space-y-1">
                  {missingFields.map((field, idx) => (
                    <li key={idx} className="text-sm text-yellow-700 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-yellow-600 rounded-full"></span>
                      {field}
                    </li>
                  ))}
                </ul>
              </div>

              <button
                onClick={goToProfile}
                className="w-full flex items-center justify-center gap-2 bg-button-orange text-white py-3 rounded-lg hover:bg-opacity-90 font-semibold"
              >
                <FileText size={20} />
                Ir a Mi Perfil
                <ArrowRight size={18} />
              </button>
            </div>
          )}

          {/* Vista: Ya aplicó */}
          {view === 'already_applied' && existingApplication && (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Briefcase className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Ya te postulaste
              </h3>
              <p className="text-gray-600 mb-4">
                Ya enviaste tu aplicación a esta vacante.
              </p>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-blue-800">
                  <span className="font-medium">Estado actual:</span>{' '}
                  <span className="font-semibold">{existingApplication.statusLabel}</span>
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  Fecha de aplicación:{' '}
                  {new Date(existingApplication.appliedAt).toLocaleDateString('es-MX', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              </div>

              <button
                onClick={() => router.push('/my-applications')}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 font-semibold"
              >
                Ver Mis Aplicaciones
              </button>
            </div>
          )}

          {/* Vista: Confirmar postulación (perfil completo) */}
          {view === 'confirm_apply' && profile?.candidate && (
            <div className="py-4">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  ¿Deseas postularte?
                </h3>
                <p className="text-gray-600 text-sm">
                  Tu información se enviará automáticamente desde tu perfil.
                </p>
              </div>

              {/* Preview de datos */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">
                  Datos a enviar:
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Nombre:</span>
                    <span className="font-medium text-gray-900">
                      {[
                        profile.candidate.nombre,
                        profile.candidate.apellidoPaterno,
                        profile.candidate.apellidoMaterno
                      ].filter(Boolean).join(' ')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Email:</span>
                    <span className="font-medium text-gray-900">{profile.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Teléfono:</span>
                    <span className="font-medium text-gray-900">{profile.candidate.telefono}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">CV:</span>
                    <a
                      href={profile.candidate.cvUrl || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline text-sm"
                    >
                      Ver mi CV
                    </a>
                  </div>
                </div>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-center gap-2">
                  <AlertCircle size={18} />
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleQuickApply}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-3 bg-button-green text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-semibold flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <CheckCircle size={20} />
                      Confirmar
                    </>
                  )}
                </button>
              </div>

              <p className="text-xs text-gray-500 text-center mt-4">
                ¿Datos incorrectos?{' '}
                <button onClick={goToProfile} className="text-button-orange hover:underline">
                  Editar mi perfil
                </button>
              </p>
            </div>
          )}

          {/* Vista: Formulario manual */}
          {view === 'manual_form' && (
            <form onSubmit={handleManualSubmit} className="py-2">
              {error && (
                <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">
                    Nombre Completo *
                  </label>
                  <input
                    type="text"
                    value={formData.candidateName}
                    onChange={(e) => setFormData({ ...formData, candidateName: e.target.value })}
                    placeholder="Juan Pérez García"
                    className="w-full p-3 border border-gray-300 rounded-lg"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">
                    Email *
                  </label>
                  <input
                    type="email"
                    value={formData.candidateEmail}
                    onChange={(e) => setFormData({ ...formData, candidateEmail: e.target.value })}
                    placeholder="juan.perez@email.com"
                    className="w-full p-3 border border-gray-300 rounded-lg"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">
                    Teléfono
                  </label>
                  <input
                    type="tel"
                    value={formData.candidatePhone}
                    onChange={(e) => setFormData({ ...formData, candidatePhone: e.target.value })}
                    placeholder="81 1234 5678"
                    className="w-full p-3 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">
                    CV (opcional)
                  </label>
                  <input
                    type="file"
                    onChange={(e) => setCvFile(e.target.files?.[0] || null)}
                    accept=".pdf,.doc,.docx"
                    className="w-full p-3 border border-gray-300 rounded-lg"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    PDF, DOC, DOCX (máx. 5MB)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">
                    Carta de Presentación (opcional)
                  </label>
                  <textarea
                    value={formData.coverLetter}
                    onChange={(e) => setFormData({ ...formData, coverLetter: e.target.value })}
                    placeholder="Cuéntanos por qué eres el candidato ideal..."
                    rows={4}
                    className="w-full p-3 border border-gray-300 rounded-lg resize-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowManualForm(false);
                    setView('not_logged_in');
                  }}
                  className="flex-1 px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-semibold"
                >
                  Atrás
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-3 bg-button-green text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-semibold flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    'Enviar Aplicación'
                  )}
                </button>
              </div>

              <p className="text-xs text-gray-500 text-center mt-4">
                ¿Ya tienes cuenta?{' '}
                <button type="button" onClick={goToLogin} className="text-button-orange hover:underline">
                  Inicia sesión
                </button>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ApplyJobModal;
