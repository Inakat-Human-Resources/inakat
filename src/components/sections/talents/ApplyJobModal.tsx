'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { X, AlertCircle, CheckCircle, User, Loader2 } from 'lucide-react';

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
  nombre?: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;
  email: string;
  telefono?: string;
  cvUrl?: string;
}

const ApplyJobModal = ({
  jobId,
  jobTitle,
  company,
  isOpen,
  onClose,
  onSuccess
}: ApplyJobModalProps) => {
  const [formData, setFormData] = useState({
    candidateName: '',
    candidateEmail: '',
    candidatePhone: '',
    coverLetter: ''
  });

  const [cvFile, setCvFile] = useState<File | null>(null);
  const [profileCvUrl, setProfileCvUrl] = useState<string | null>(null);
  const [useProfileCv, setUseProfileCv] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [existingApplication, setExistingApplication] = useState<ExistingApplication | null>(null);
  const [checkingEmail, setCheckingEmail] = useState(false);

  // Estado para datos pre-llenados del perfil
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);

  // Cargar datos del perfil si el usuario está logueado
  useEffect(() => {
    if (isOpen) {
      loadUserProfile();
    }
  }, [isOpen]);

  const loadUserProfile = async () => {
    try {
      setLoadingProfile(true);

      const response = await fetch('/api/profile', {
        credentials: 'include'
      });

      if (response.status === 401) {
        // Usuario no logueado - no es error, simplemente no pre-llenamos
        setLoadingProfile(false);
        return;
      }

      const data = await response.json();

      if (data.success && data.data.candidate) {
        const candidate = data.data.candidate;

        // Construir nombre completo
        const fullName = [
          candidate.nombre,
          candidate.apellidoPaterno,
          candidate.apellidoMaterno
        ].filter(Boolean).join(' ');

        // Pre-llenar formulario
        setFormData({
          candidateName: fullName || '',
          candidateEmail: data.data.email || '',
          candidatePhone: candidate.telefono || '',
          coverLetter: ''
        });

        // Si tiene CV en el perfil, ofrecer usarlo
        if (candidate.cvUrl) {
          setProfileCvUrl(candidate.cvUrl);
          setUseProfileCv(true);
        }

        setProfileLoaded(true);

        // Verificar si ya aplicó con este email
        if (data.data.email) {
          checkExistingApplication(data.data.email);
        }
      }
    } catch (err) {
      console.error('Error loading profile:', err);
    } finally {
      setLoadingProfile(false);
    }
  };

  // Verificar si el email ya aplicó
  const checkExistingApplication = useCallback(async (email: string) => {
    if (!email || !email.includes('@')) {
      setExistingApplication(null);
      return;
    }

    setCheckingEmail(true);
    try {
      const response = await fetch(
        `/api/applications/check?jobId=${jobId}&email=${encodeURIComponent(email)}`
      );
      const data = await response.json();

      if (data.success && data.hasApplied) {
        setExistingApplication(data.application);
      } else {
        setExistingApplication(null);
      }
    } catch (err) {
      console.error('Error checking application:', err);
      setExistingApplication(null);
    } finally {
      setCheckingEmail(false);
    }
  }, [jobId]);

  // Debounce para verificar email
  const handleEmailChange = (email: string) => {
    setFormData({ ...formData, candidateEmail: email });
    setExistingApplication(null);
  };

  const handleEmailBlur = () => {
    if (formData.candidateEmail) {
      checkExistingApplication(formData.candidateEmail);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      let cvUrl = null;

      // Determinar qué CV usar
      if (useProfileCv && profileCvUrl) {
        // Usar CV del perfil
        cvUrl = profileCvUrl;
      } else if (cvFile) {
        // Subir nuevo CV
        const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
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
          const uploadError = await uploadRes.json().catch(() => ({}));
          console.error('CV upload failed:', uploadError);
          throw new Error(uploadError.error || 'Error al subir CV. Verifica el formato y tamaño del archivo.');
        }

        const uploadData = await uploadRes.json();
        cvUrl = uploadData.url;
      }

      // 2. Crear aplicación
      const applicationPayload = {
        jobId,
        candidateName: formData.candidateName,
        candidateEmail: formData.candidateEmail,
        candidatePhone: formData.candidatePhone || null,
        coverLetter: formData.coverLetter || null,
        cvUrl
      };

      console.log('Sending application:', { jobId, email: formData.candidateEmail });

      const response = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(applicationPayload)
      });

      const data = await response.json();
      console.log('Application response:', data);

      if (data.success) {
        // Resetear formulario
        setFormData({
          candidateName: '',
          candidateEmail: '',
          candidatePhone: '',
          coverLetter: ''
        });
        setCvFile(null);
        setProfileCvUrl(null);
        setUseProfileCv(false);
        setProfileLoaded(false);

        onSuccess();
        onClose();
      } else {
        console.error('Application failed:', data);
        // Mensajes de error más específicos
        if (response.status === 409) {
          setError('Ya has aplicado a esta vacante anteriormente con este email.');
        } else if (response.status === 404) {
          setError('La vacante ya no está disponible.');
        } else {
          setError(data.error || 'Error al enviar aplicación. Por favor intenta nuevamente.');
        }
      }
    } catch (err) {
      console.error('Application error:', err);
      setError(
        err instanceof Error ? err.message : 'Error al procesar la solicitud'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    // Resetear todo al cerrar
    setFormData({
      candidateName: '',
      candidateEmail: '',
      candidatePhone: '',
      coverLetter: ''
    });
    setCvFile(null);
    setProfileCvUrl(null);
    setUseProfileCv(false);
    setProfileLoaded(false);
    setExistingApplication(null);
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-start p-6 border-b">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Aplicar a Vacante
            </h2>
            <p className="text-gray-600 mt-1">
              {jobTitle} - {company}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={24} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          {/* Mensaje de datos cargados del perfil */}
          {profileLoaded && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg flex items-center gap-2">
              <User className="w-5 h-5" />
              <span>Datos cargados desde tu perfil. Puedes modificarlos si lo deseas.</span>
            </div>
          )}

          {loadingProfile && (
            <div className="mb-4 p-4 bg-gray-50 border border-gray-200 text-gray-600 rounded-lg flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Cargando datos de tu perfil...</span>
            </div>
          )}

          {error && (
            <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}

          <div className="space-y-4">
            {/* Nombre completo */}
            <div>
              <label className="block text-sm font-semibold mb-2">
                Nombre Completo *
              </label>
              <input
                type="text"
                value={formData.candidateName}
                onChange={(e) =>
                  setFormData({ ...formData, candidateName: e.target.value })
                }
                placeholder="Juan Pérez García"
                className="w-full p-3 border border-gray-300 rounded-lg"
                required
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-semibold mb-2">
                Email *
              </label>
              <input
                type="email"
                value={formData.candidateEmail}
                onChange={(e) => handleEmailChange(e.target.value)}
                onBlur={handleEmailBlur}
                placeholder="juan.perez@email.com"
                className={`w-full p-3 border rounded-lg ${
                  existingApplication
                    ? 'border-amber-400 bg-amber-50'
                    : 'border-gray-300'
                }`}
                required
              />
              {checkingEmail && (
                <p className="text-sm text-gray-500 mt-1">Verificando...</p>
              )}
              {existingApplication && (
                <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-amber-800">
                        Ya aplicaste a esta vacante
                      </p>
                      <p className="text-sm text-amber-700 mt-1">
                        Estado actual: <span className="font-semibold">{existingApplication.statusLabel}</span>
                      </p>
                      <p className="text-xs text-amber-600 mt-1">
                        Fecha de aplicación: {new Date(existingApplication.appliedAt).toLocaleDateString('es-MX', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Teléfono */}
            <div>
              <label className="block text-sm font-semibold mb-2">
                Teléfono (opcional)
              </label>
              <input
                type="tel"
                value={formData.candidatePhone}
                onChange={(e) =>
                  setFormData({ ...formData, candidatePhone: e.target.value })
                }
                placeholder="81 1234 5678"
                className="w-full p-3 border border-gray-300 rounded-lg"
              />
            </div>

            {/* CV */}
            <div>
              <label className="block text-sm font-semibold mb-2">
                Curriculum Vitae (opcional)
              </label>

              {/* Opción de usar CV del perfil */}
              {profileCvUrl && (
                <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useProfileCv}
                      onChange={(e) => {
                        setUseProfileCv(e.target.checked);
                        if (e.target.checked) setCvFile(null);
                      }}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="text-sm text-blue-800">
                      Usar el CV de mi perfil
                    </span>
                  </label>
                  <a
                    href={profileCvUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline ml-6"
                  >
                    Ver mi CV actual
                  </a>
                </div>
              )}

              {/* Subir nuevo CV */}
              {!useProfileCv && (
                <>
                  <input
                    type="file"
                    onChange={(e) => setCvFile(e.target.files?.[0] || null)}
                    accept=".pdf,.doc,.docx"
                    className="w-full p-3 border border-gray-300 rounded-lg"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Formatos aceptados: PDF, DOC, DOCX (máx. 5MB)
                  </p>
                  {cvFile && (
                    <p className="text-sm text-green-600 mt-2">
                      ✓ Archivo seleccionado: {cvFile.name}
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Carta de presentación */}
            <div>
              <label className="block text-sm font-semibold mb-2">
                Carta de Presentación (opcional)
              </label>
              <textarea
                value={formData.coverLetter}
                onChange={(e) =>
                  setFormData({ ...formData, coverLetter: e.target.value })
                }
                placeholder="Cuéntanos por qué eres el candidato ideal para esta posición..."
                rows={6}
                className="w-full p-3 border border-gray-300 rounded-lg resize-none"
              />
            </div>
          </div>

          {/* Botones */}
          <div className="flex gap-4 mt-6">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-semibold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !!existingApplication}
              className="flex-1 px-6 py-3 bg-button-green text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Enviando...
                </>
              ) : existingApplication ? (
                'Ya aplicaste'
              ) : (
                'Enviar Aplicación'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ApplyJobModal;
