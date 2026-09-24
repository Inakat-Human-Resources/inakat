'use client';

// RUTA: src/components/sections/talents/ApplyJobModal.tsx
//
// Postulación a una vacante desde la bolsa pública. Presentación con el Modal
// del sistema (role="dialog", foco atrapado, Escape, portal, en móvil sube
// desde abajo); la lógica es la de siempre: mismas vistas, mismas llamadas
// (/api/profile, /api/applications/check, /api/upload, /api/applications) y
// mismos cuerpos.

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  CheckCircle,
  User,
  Loader2,
  LogIn,
  UserPlus,
  FileText,
  AlertTriangle,
  Briefcase,
  ArrowRight,
  ExternalLink
} from 'lucide-react';
import { isSafeHttpUrl } from '@/lib/sanitize';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import FormField, { Input, Textarea } from '@/components/ui/FormField';
import { cn } from '@/lib/utils';
import { fechaLarga } from '@/lib/fechas';

// Sólo http(s) absoluto llega al href del CV; un dominio suelto se fuerza a
// https y cualquier otro esquema se anula (mismo criterio que los paneles).
const ensureUrl = (url: string): string | undefined => {
  const candidata = /^[a-z][a-z0-9+.-]*:/i.test(url) ? url : `https://${url}`;
  return isSafeHttpUrl(candidata) ? candidata : undefined;
};

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

/** id del formulario sin cuenta (su botón de envío vive en el pie del modal). */
const ID_FORM_MANUAL = 'form-aplicar-sin-cuenta';

/** Círculo con el icono de cada vista (decorativo). */
function IconoVista({ icono: Icono, tono }: { icono: typeof User; tono: 'exito' | 'aviso' | 'info' | 'neutro' }) {
  const colores = {
    exito: 'bg-lime-tint text-lime-dark',
    aviso: 'bg-orange-tint text-orange-dark',
    info: 'bg-teal-tint text-teal',
    neutro: 'bg-mist text-ink-muted',
  }[tono];
  return (
    <span className={cn('mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full', colores)} aria-hidden="true">
      <Icono className="h-8 w-8" />
    </span>
  );
}

/** Aviso de error dentro del modal (se anuncia al momento). */
function AvisoError({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="alert"
      className="mb-4 flex items-start gap-2 rounded-xl border border-danger/30 bg-danger-tint px-4 py-3 text-sm font-medium text-danger-dark"
    >
      <AlertCircle className="mt-px h-[18px] w-[18px] flex-none" aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

const ApplyJobModal = ({
  jobId,
  jobTitle,
  company,
  isOpen,
  onClose,
  onSuccess
}: ApplyJobModalProps) => {
  const router = useRouter();

  // A11y (#59): Escape cierra el modal. Ahora lo hace el Modal del sistema
  // (sólo la capa de arriba lo atiende, así no cierra de paso el panel de
  // detalle que queda debajo en el móvil).

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
  const [applicationSent, setApplicationSent] = useState(false);

  // Formulario manual (para usuarios no logueados que eligen aplicar sin cuenta)
  const [showManualForm, setShowManualForm] = useState(false);
  const [formData, setFormData] = useState({
    candidateName: '',
    candidateEmail: '',
    candidatePhone: '',
    coverLetter: ''
  });
  const [cvFile, setCvFile] = useState<File | null>(null);

  // Presentación: al cambiar de vista, el foco va a su encabezado (el lector
  // anuncia el nuevo estado) o, en el formulario, al primer campo. Sin esto el
  // botón pulsado desaparecía y el foco caía al <body>.
  const encabezadoRef = useRef<HTMLHeadingElement>(null);
  const nombreRef = useRef<HTMLInputElement>(null);

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
      setApplicationSent(false);
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

  useEffect(() => {
    if (!isOpen || view === 'loading') return;
    const t = window.setTimeout(() => {
      if (!applicationSent && view === 'manual_form') nombreRef.current?.focus();
      else encabezadoRef.current?.focus({ preventScroll: true });
    }, 0);
    return () => window.clearTimeout(t);
  }, [isOpen, view, applicationSent]);

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
      // El email ya no se manda: la ruta lo toma de la sesión (antes era pública
      // y respondía por cualquier correo que se le pasara).
      const checkRes = await fetch(`/api/applications/check?jobId=${jobId}`);
      if (!checkRes.ok) {
        const errorData = await checkRes.json().catch(() => ({}));
        throw new Error(errorData.error || 'Error al verificar aplicación');
      }
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
        setApplicationSent(true);
        onSuccess();
        setTimeout(() => {
          onClose();
        }, 2500);
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
        // PERF-028: /api/upload rechaza por encima de 4MB y Vercel corta los cuerpos
        // de más de 4.5MB con un 413 que no es JSON.
        const MAX_FILE_SIZE = 4 * 1024 * 1024;
        if (cvFile.size > MAX_FILE_SIZE) {
          throw new Error('El archivo CV excede el tamaño máximo de 4MB');
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
        setApplicationSent(true);
        onSuccess();
        setTimeout(() => {
          onClose();
        }, 2500);
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
    // Vuelve a ESTA vacante tras el login (SearchPositionsSection lee ?vacante=).
    router.push(`/login?redirect=${encodeURIComponent(`/talents?vacante=${jobId}`)}`);
    onClose();
  };

  const goToRegister = () => {
    router.push('/register?role=candidate');
    onClose();
  };

  // Encabezado de cada vista: recibe el foco al cambiar de vista.
  const claseEncabezado = 'font-display text-lg font-semibold text-ink outline-none';

  // Pie del modal según la vista (cancelar primero; la acción principal, al final).
  let pie: React.ReactNode = undefined;
  if (!applicationSent && view === 'confirm_apply' && profile?.candidate) {
    pie = (
      <>
        <Button variante="contorno" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          icono={CheckCircle}
          onClick={handleQuickApply}
          cargando={isSubmitting}
          textoCargando="Enviando…"
        >
          Confirmar
        </Button>
      </>
    );
  } else if (!applicationSent && view === 'manual_form') {
    pie = (
      <>
        <Button
          variante="contorno"
          onClick={() => {
            setShowManualForm(false);
            setView('not_logged_in');
          }}
        >
          Atrás
        </Button>
        <Button type="submit" form={ID_FORM_MANUAL} cargando={isSubmitting} textoCargando="Enviando…">
          Enviar aplicación
        </Button>
      </>
    );
  } else if (!applicationSent && view === 'profile_incomplete') {
    pie = (
      <Button icono={FileText} iconoFinal={ArrowRight} onClick={goToProfile}>
        Ir a mi perfil
      </Button>
    );
  } else if (!applicationSent && view === 'already_applied' && existingApplication) {
    pie = (
      <Button variante="secundario" icono={Briefcase} onClick={() => router.push('/my-applications')}>
        Ver mis aplicaciones
      </Button>
    );
  }

  return (
    <Modal
      abierto={isOpen}
      alCerrar={onClose}
      titulo={view === 'manual_form' ? 'Aplicar a vacante' : 'Postularme'}
      subtitulo={`${jobTitle} · ${company}`}
      tamano="md"
      // Con el formulario a medias, un clic fuera no debe tirar lo escrito.
      cerrarAlPulsarFondo={view !== 'manual_form'}
      pie={pie}
    >
      {/* Vista: Aplicación enviada exitosamente */}
      {applicationSent && (
        <div className="py-6 text-center" role="status">
          <IconoVista icono={CheckCircle} tono="exito" />
          <h3 ref={encabezadoRef} tabIndex={-1} className={cn(claseEncabezado, 'text-xl')}>
            ¡Aplicación Enviada!
          </h3>
          <p className="mt-2 text-sm text-ink-muted">
            Tu postulación fue enviada exitosamente. El reclutador revisará tu perfil pronto.
          </p>
          <p className="mt-4 rounded-xl bg-lime-tint px-4 py-3 text-sm font-medium text-lime-dark">
            Puedes revisar el estado de tus aplicaciones en &quot;Mis Aplicaciones&quot;
          </p>
        </div>
      )}

      {/* Vista: Cargando */}
      {!applicationSent && view === 'loading' && (
        <div className="py-8 text-center" role="status">
          <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-teal" aria-hidden="true" />
          <p className="text-sm text-ink-muted">Verificando tu perfil…</p>
        </div>
      )}

      {/* Vista: No logueado */}
      {!applicationSent && view === 'not_logged_in' && !showManualForm && (
        <div className="py-2 text-center">
          {/* Si la comprobación falló, se dice (antes el error quedaba oculto). */}
          {error && <AvisoError>{error}</AvisoError>}
          <IconoVista icono={User} tono="neutro" />
          <h3 ref={encabezadoRef} tabIndex={-1} className={claseEncabezado}>
            Inicia sesión para aplicar
          </h3>
          <p className="mx-auto mt-2 max-w-sm text-sm text-ink-muted">
            Con tu cuenta podrás postularte con un solo clic usando tu perfil guardado.
          </p>

          <div className="mt-6 space-y-3">
            <Button icono={LogIn} onClick={goToLogin} anchoCompleto tamano="lg">
              Iniciar sesión
            </Button>
            <Button variante="contorno" icono={UserPlus} onClick={goToRegister} anchoCompleto tamano="lg">
              Registrarme como candidato
            </Button>

            <div className="relative py-2" aria-hidden="true">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-line" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-white px-3 font-serif text-base italic text-ink-muted">o</span>
              </div>
            </div>

            <Button
              variante="fantasma"
              iconoFinal={ArrowRight}
              onClick={() => {
                setShowManualForm(true);
                setView('manual_form');
              }}
            >
              Aplicar sin cuenta
            </Button>
          </div>
        </div>
      )}

      {/* Vista: Perfil incompleto */}
      {!applicationSent && view === 'profile_incomplete' && (
        <div className="py-2 text-center">
          <IconoVista icono={AlertTriangle} tono="aviso" />
          <h3 ref={encabezadoRef} tabIndex={-1} className={claseEncabezado}>
            Completa tu perfil
          </h3>
          <p className="mt-2 text-sm text-ink-muted">
            Para postularte con un clic, necesitas completar la siguiente información:
          </p>

          <div className="mt-5 rounded-xl border border-orange/40 bg-orange-tint p-4 text-left">
            <p className="mb-2 text-sm font-semibold text-orange-dark">Campos faltantes:</p>
            <ul className="space-y-1.5">
              {missingFields.map((field, idx) => (
                <li key={idx} className="flex items-center gap-2 text-sm text-orange-dark">
                  <span className="h-1.5 w-1.5 flex-none rounded-full bg-orange-dark" aria-hidden="true" />
                  {field}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Vista: Ya aplicó */}
      {!applicationSent && view === 'already_applied' && existingApplication && (
        <div className="py-2 text-center">
          <IconoVista icono={Briefcase} tono="info" />
          <h3 ref={encabezadoRef} tabIndex={-1} className={claseEncabezado}>
            Ya te postulaste
          </h3>
          <p className="mt-2 text-sm text-ink-muted">Ya enviaste tu aplicación a esta vacante.</p>

          <dl className="mt-5 rounded-xl bg-teal-tint p-4 text-sm text-teal-dark">
            <div className="flex flex-wrap justify-center gap-x-1.5">
              <dt className="font-medium">Estado actual:</dt>
              <dd className="font-semibold">{existingApplication.statusLabel}</dd>
            </div>
            <div className="mt-1 flex flex-wrap justify-center gap-x-1.5 text-[13px]">
              <dt>Fecha de aplicación:</dt>
              <dd>
                {fechaLarga(existingApplication.appliedAt)}
              </dd>
            </div>
          </dl>
        </div>
      )}

      {/* Vista: Confirmar postulación (perfil completo) */}
      {!applicationSent && view === 'confirm_apply' && profile?.candidate && (
        <div className="py-1">
          <div className="mb-5 text-center">
            <IconoVista icono={CheckCircle} tono="exito" />
            <h3 ref={encabezadoRef} tabIndex={-1} className={claseEncabezado}>
              ¿Deseas postularte?
            </h3>
            <p className="mt-2 text-sm text-ink-muted">
              Tu información se enviará automáticamente desde tu perfil.
            </p>
          </div>

          {/* Datos a enviar */}
          <div className="mb-5 rounded-xl border border-line bg-paper p-4">
            <h4 className="mb-3 font-display text-sm font-semibold text-ink">Datos a enviar:</h4>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-ink-muted">Nombre:</dt>
                <dd className="text-right font-medium text-ink">
                  {[
                    profile.candidate.nombre,
                    profile.candidate.apellidoPaterno,
                    profile.candidate.apellidoMaterno
                  ].filter(Boolean).join(' ')}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-muted">Email:</dt>
                <dd className="min-w-0 break-all text-right font-medium text-ink">{profile.email}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-muted">Teléfono:</dt>
                <dd className="text-right font-medium tabular-nums text-ink">{profile.candidate.telefono}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-ink-muted">CV:</dt>
                <dd>
                  <a
                    href={(profile.candidate.cvUrl && ensureUrl(profile.candidate.cvUrl)) || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-teal underline-offset-2 hover:underline"
                  >
                    Ver mi CV
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    <span className="sr-only">(se abre en una pestaña nueva)</span>
                  </a>
                </dd>
              </div>
            </dl>
          </div>

          {error && <AvisoError>{error}</AvisoError>}

          <p className="text-center text-[13px] text-ink-muted">
            ¿Datos incorrectos?{' '}
            <button
              type="button"
              onClick={goToProfile}
              className="font-medium text-teal underline underline-offset-2 hover:text-ink"
            >
              Editar mi perfil
            </button>
          </p>
        </div>
      )}

      {/* Vista: Formulario manual */}
      {!applicationSent && view === 'manual_form' && (
        <form id={ID_FORM_MANUAL} onSubmit={handleManualSubmit} className="py-1">
          {error && <AvisoError>{error}</AvisoError>}

          <div className="space-y-4">
            <FormField etiqueta="Nombre completo" requerido>
              <Input
                ref={nombreRef}
                type="text"
                value={formData.candidateName}
                onChange={(e) => setFormData({ ...formData, candidateName: e.target.value })}
                placeholder="Juan Pérez García"
                autoComplete="name"
              />
            </FormField>

            <FormField etiqueta="Email" requerido>
              <Input
                type="email"
                value={formData.candidateEmail}
                onChange={(e) => setFormData({ ...formData, candidateEmail: e.target.value })}
                placeholder="juan.perez@email.com"
                autoComplete="email"
              />
            </FormField>

            <FormField etiqueta="Teléfono" opcional>
              <Input
                type="tel"
                value={formData.candidatePhone}
                onChange={(e) => setFormData({ ...formData, candidatePhone: e.target.value })}
                placeholder="81 1234 5678"
                autoComplete="tel"
              />
            </FormField>

            <FormField etiqueta="CV" opcional ayuda="PDF, DOC o DOCX, máximo 4 MB.">
              <Input
                type="file"
                onChange={(e) => setCvFile(e.target.files?.[0] || null)}
                accept=".pdf,.doc,.docx"
                className="h-auto cursor-pointer py-2 file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-ink file:px-3 file:py-1.5 file:font-display file:text-[13px] file:font-semibold file:text-white hover:file:bg-teal"
              />
            </FormField>

            <FormField etiqueta="Carta de presentación" opcional>
              <Textarea
                value={formData.coverLetter}
                onChange={(e) => setFormData({ ...formData, coverLetter: e.target.value })}
                placeholder="Cuéntanos por qué eres el candidato ideal..."
                rows={4}
              />
            </FormField>
          </div>

          <p className="mt-5 text-center text-[13px] text-ink-muted">
            ¿Ya tienes cuenta?{' '}
            <button
              type="button"
              onClick={goToLogin}
              className="font-medium text-teal underline underline-offset-2 hover:text-ink"
            >
              Inicia sesión
            </button>
          </p>
        </form>
      )}
    </Modal>
  );
};

export default ApplyJobModal;
