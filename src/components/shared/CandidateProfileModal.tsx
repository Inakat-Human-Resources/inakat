// RUTA: src/components/shared/CandidateProfileModal.tsx

'use client';

import { useState, useRef, useEffect } from 'react';
import { normalizeUrl } from '@/lib/utils';
import CandidatePhoto from '@/components/shared/CandidatePhoto'; // FEAT-2: Foto de perfil
import DistanceBadge from '@/components/shared/DistanceBadge';
import {
  X,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Briefcase,
  GraduationCap,
  Link as LinkIcon,
  Linkedin,
  FileText,
  User,
  Clock,
  MessageSquare,
  Building,
  Download,
  ChevronLeft,
  ChevronRight,
  File,
  Plus,
  Upload,
  Loader2,
  Save,
  ClipboardList,
  Star
} from 'lucide-react';

/**
 * FIX-02: asegura que las URLs externas tengan protocolo https://.
 *
 * #PERF-018: la versión anterior (`startsWith('http') ? url : https://…`)
 * convertía las rutas locales que devuelve /api/upload en desarrollo
 * ('/uploads/cv.pdf') en 'https:///uploads/cv.pdf', un enlace roto.
 * normalizeUrl deja intactas las rutas relativas y respeta 'Https://'.
 */
const ensureUrl = (url: string) => normalizeUrl(url) ?? url;

// Tipos para el candidato (compatible con Application y Candidate)
interface Experience {
  id: number;
  empresa: string;
  puesto: string;
  ubicacion?: string;
  fechaInicio: string;
  fechaFin?: string;
  esActual: boolean;
  descripcion?: string;
}

interface CandidateDocument {
  id: number;
  name: string;
  fileUrl: string;
  fileType?: string;
  createdAt?: string;
}

/**
 * Colores del badge de estatus de educación (#PERF-012).
 *
 * Hay DOS vocabularios en producción: el del registro
 * (Cursando/Terminado/Trunco/Titulado) y el de /profile
 * (Completa/En curso/Trunca). El mapa anterior sólo conocía el primero, así que
 * todo lo guardado desde el perfil salía gris ante empresa y reclutador.
 * Mientras no se unifiquen con una migración de datos, aquí se reconocen ambos.
 */
/**
 * Límite real de /api/upload (#PERF-028): las funciones de Vercel rechazan
 * cuerpos de más de 4.5 MB antes de llegar al handler.
 */
const MAX_ADJUNTO_BYTES = 4 * 1024 * 1024;
const MAX_ADJUNTO_LABEL = '4MB';

const COLOR_ESTATUS_EDUCACION: Record<string, string> = {
  Titulado: 'bg-green-100 text-green-800',
  Completa: 'bg-green-100 text-green-800',
  Terminado: 'bg-blue-100 text-blue-800',
  Cursando: 'bg-yellow-100 text-yellow-800',
  'En curso': 'bg-yellow-100 text-yellow-800',
  Trunco: 'bg-orange-100 text-orange-800',
  Trunca: 'bg-orange-100 text-orange-800'
};

// FEATURE: Educación múltiple
interface Education {
  id: number;
  nivel: string;
  institucion: string;
  carrera: string;
  añoInicio?: number | null;
  añoFin?: number | null;
  estatus: string;
}

// FEAT-5: Notas de evaluación
interface EvaluationNote {
  id: number;
  authorId: number;
  authorRole: string;
  applicationId: number;
  content: string;
  documentUrl?: string | null;
  documentName?: string | null;
  isPublic?: boolean;
  createdAt: string;
  authorName?: string;
  /** EVAL-020: la API dice si el usuario actual puede editarla o retirarla. */
  canEdit?: boolean;
}

interface CandidateProfile {
  id?: number;
  universidad?: string;
  carrera?: string;
  nivelEstudios?: string;
  educacion?: string; // FEATURE: Educación múltiple (JSON string)
  añosExperiencia?: number;
  profile?: string;
  subcategory?: string;
  seniority?: string;
  linkedinUrl?: string;
  portafolioUrl?: string;
  cvUrl?: string;
  telefono?: string;
  sexo?: string;
  fechaNacimiento?: string;
  ciudad?: string;
  estado?: string;
  ubicacionCercana?: string;
  latitude?: number | null;
  longitude?: number | null;
  source?: string;
  notas?: string;
  fotoUrl?: string; // FEAT-2: Foto de perfil
  cartaPresentacion?: string;
  experiences?: Experience[];
  documents?: CandidateDocument[];
}

interface ApplicationData {
  id: number;
  candidateName: string;
  candidateEmail: string;
  candidatePhone?: string | null;
  cvUrl?: string | null;
  coverLetter?: string | null;
  status: string;
  createdAt: string;
  notes?: string | null;
  candidateProfile?: CandidateProfile | null;
}

// Para candidatos del banco (sin Application)
interface BankCandidate {
  id: number;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno?: string | null;
  email: string;
  telefono?: string | null;
  universidad?: string | null;
  carrera?: string | null;
  nivelEstudios?: string | null;
  educacion?: string | null; // FEATURE: Educación múltiple (JSON string)
  añosExperiencia: number;
  profile?: string | null;
  subcategory?: string | null;
  seniority?: string | null;
  linkedinUrl?: string | null;
  portafolioUrl?: string | null;
  cvUrl?: string | null;
  sexo?: string | null;
  fechaNacimiento?: string | null;
  ciudad?: string | null;
  estado?: string | null;
  ubicacionCercana?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  source?: string | null;
  notas?: string | null;
  fotoUrl?: string | null; // FEAT-2: Foto de perfil
  cartaPresentacion?: string | null;
  status: string;
  experiences?: Experience[];
  documents?: CandidateDocument[];
}

interface CandidateProfileModalProps {
  // Puede recibir una Application enriquecida o un Candidate del banco
  application?: ApplicationData | null;
  candidate?: BankCandidate | null;
  isOpen: boolean;
  onClose: () => void;
  // Notas del reclutador (solo visible para especialista)
  recruiterNotes?: string;
  showRecruiterNotes?: boolean;
  // Navegación entre candidatos
  onNext?: () => void;
  onPrev?: () => void;
  currentIndex?: number;
  totalCount?: number;
  // Agregar documentos (para reclutador/admin)
  canAddDocuments?: boolean;
  onDocumentsUpdated?: () => void;
  // FEAT-5: Notas de evaluación
  userRole?: string; // Para saber si puede agregar notas
  // Habilidades del job (JSON string o array) para evaluación
  jobHabilidades?: string | null;
  // Coordenadas de la vacante para badge de distancia
  jobLatitude?: number | null;
  jobLongitude?: number | null;
}

export default function CandidateProfileModal({
  application,
  candidate,
  isOpen,
  onClose,
  recruiterNotes,
  showRecruiterNotes = false,
  onNext,
  onPrev,
  currentIndex,
  totalCount,
  canAddDocuments = false,
  onDocumentsUpdated,
  userRole,
  jobHabilidades,
  jobLatitude,
  jobLongitude
}: CandidateProfileModalProps) {
  // Estados para agregar documento
  const [showAddDocModal, setShowAddDocModal] = useState(false);
  const [newDocName, setNewDocName] = useState('');
  const [newDocFile, setNewDocFile] = useState<File | null>(null);
  const [savingDoc, setSavingDoc] = useState(false);
  const [docError, setDocError] = useState('');
  const docInputRef = useRef<HTMLInputElement>(null);

  // FEAT-5: Estados para notas de evaluación
  const [evaluationNotes, setEvaluationNotes] = useState<EvaluationNote[]>([]);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [noteDocument, setNoteDocument] = useState<File | null>(null);
  const [isNotePublic, setIsNotePublic] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const noteFileRef = useRef<HTMLInputElement>(null);

  // #PERF-014/#PERF-015: antes guardar nota o calificaciones sólo hacía
  // console.error; el evaluador no sabía si se había guardado.
  const [noteError, setNoteError] = useState('');
  const [ratingsError, setRatingsError] = useState('');
  const [ratingsSaved, setRatingsSaved] = useState(false);

  // Determinar si el usuario puede agregar notas de evaluación
  const canAddEvaluationNotes = ['recruiter', 'specialist'].includes(userRole || '');
  const canViewEvaluationNotes = ['recruiter', 'specialist', 'admin', 'company'].includes(userRole || '');

  // Skill Ratings (calificaciones de habilidades)
  const [skillRatings, setSkillRatings] = useState<Record<string, { rating: number; comment: string }>>({});
  const [savedSkillRatings, setSavedSkillRatings] = useState<Array<{ skillName: string; rating: number; comment: string | null; ratedBy: { nombre: string }; updatedAt: string }>>([]);
  const [savingSkillRatings, setSavingSkillRatings] = useState(false);
  const [skillRatingsLoaded, setSkillRatingsLoaded] = useState(false);
  // Notas INTERNAS de INAKAT (Candidate.notas y Application.notes): nunca para
  // la empresa ni para el propio candidato.
  const puedeVerNotasInternas = ['admin', 'recruiter', 'specialist'].includes(userRole || '');

  const canEditSkillRatings = ['specialist', 'admin'].includes(userRole || '');
  const canViewSkillRatings = ['specialist', 'admin', 'company'].includes(userRole || '');

  /**
   * #PERF-013: al pulsar «Siguiente» con el modal abierto sólo cambia
   * application.id, no isOpen. El efecto anterior únicamente limpiaba al
   * cerrar, así que el borrador de nota, el adjunto y el check «Visible para
   * empresa» viajaban al siguiente candidato y la nota podía acabar (pública)
   * en la aplicación equivocada.
   *
   * Este efecto reinicia TODO el estado por candidato en cuanto cambia el id.
   */
  useEffect(() => {
    setEvaluationNotes([]);
    setEditingNoteId(null);
    setNoteActionError(null);
    setNewNoteContent('');
    setNoteDocument(null);
    setIsNotePublic(false);
    setNoteError('');
    setRatingsError('');
    setRatingsSaved(false);
    setSkillRatings({});
    setSavedSkillRatings([]);
    setSkillRatingsLoaded(false);
    // El sub-modal de documento también se cierra: si no, quedaba en true y
    // reaparecía encima del siguiente candidato (#PERF-017).
    setShowAddDocModal(false);
    setNewDocName('');
    setNewDocFile(null);
    setDocError('');
    if (noteFileRef.current) noteFileRef.current.value = '';
  }, [isOpen, application?.id, candidate?.id]);

  // FEAT-5: Cargar notas de evaluación cuando se abre el modal
  useEffect(() => {
    if (!isOpen || !application?.id || !canViewEvaluationNotes) return;

    // #PERF-013: sin esto, una respuesta lenta del candidato anterior pisaba
    // las notas del que se está viendo.
    let ignorar = false;
    fetchEvaluationNotes(application.id, () => ignorar);
    return () => {
      ignorar = true;
    };
  }, [isOpen, application?.id, canViewEvaluationNotes]);

  // Parsear habilidades del job
  const parsedHabilidades: string[] = (() => {
    if (!jobHabilidades) return [];
    try {
      const parsed = JSON.parse(jobHabilidades);
      return Array.isArray(parsed) ? parsed.filter((h: unknown) => typeof h === 'string' && h.trim()) : [];
    } catch {
      return [];
    }
  })();

  // Cargar skill ratings cuando se abre el modal
  useEffect(() => {
    if (!isOpen || !application?.id || !canViewSkillRatings || parsedHabilidades.length === 0) return;

    // #PERF-013: descartar la respuesta si ya cambiamos de candidato.
    let ignorar = false;
    fetchSkillRatings(application.id, () => ignorar);
    return () => {
      ignorar = true;
    };
  }, [isOpen, application?.id, canViewSkillRatings]);

  // A11y (#59): cerrar con la tecla Escape mientras el modal está abierto.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // #PERF-035: con el sub-modal «Agregar Documento» abierto, Escape cerraba
      // la ficha entera y dejaba showAddDocModal en true, así que reaparecía
      // sobre el siguiente candidato. Escape cancela primero el sub-modal.
      if (showAddDocModal) {
        setShowAddDocModal(false);
        setNewDocName('');
        setNewDocFile(null);
        setDocError('');
        return;
      }
      onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose, showAddDocModal]);

  const fetchSkillRatings = async (applicationId: number, cancelado: () => boolean = () => false) => {
    try {
      const res = await fetch(`/api/evaluations/skill-ratings?applicationId=${applicationId}`);
      const data = await res.json();
      if (cancelado()) return;
      if (data.success) {
        setSavedSkillRatings(data.data);
        // Precargar ratings en el estado editable
        const ratingsMap: Record<string, { rating: number; comment: string }> = {};
        for (const r of data.data) {
          ratingsMap[r.skillName] = { rating: r.rating, comment: r.comment || '' };
        }
        setSkillRatings(ratingsMap);
        setSkillRatingsLoaded(true);
      }
    } catch (error) {
      console.error('Error cargando skill ratings:', error);
    }
  };

  const handleSaveSkillRatings = async () => {
    if (!application?.id) return;
    setRatingsError('');
    setRatingsSaved(false);

    const ratings = Object.entries(skillRatings)
      .filter(([, v]) => v.rating > 0)
      .map(([skillName, v]) => ({
        skillName,
        rating: v.rating,
        comment: v.comment || null
      }));

    if (ratings.length === 0) {
      setRatingsError('Califica al menos una habilidad antes de guardar');
      return;
    }

    setSavingSkillRatings(true);
    try {
      const res = await fetch('/api/evaluations/skill-ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId: application.id, ratings })
      });
      const data = await res.json().catch(() => ({}));

      // #PERF-014/#PERF-015: antes un 403/500 no producía ningún aviso y el
      // especialista daba por guardada una evaluación que no existía.
      if (!res.ok || !data.success) {
        setRatingsError(data.error || 'No se pudieron guardar las calificaciones');
        return;
      }

      // Recargar para obtener datos actualizados
      await fetchSkillRatings(application.id);
      setRatingsSaved(true);
    } catch (error) {
      console.error('Error guardando skill ratings:', error);
      setRatingsError(error instanceof Error ? error.message : 'Error de conexión');
    } finally {
      setSavingSkillRatings(false);
    }
  };

  // FEAT-5: Función para cargar notas de evaluación
  const fetchEvaluationNotes = async (applicationId: number, cancelado: () => boolean = () => false) => {
    setLoadingNotes(true);
    try {
      const res = await fetch(`/api/evaluations/notes?applicationId=${applicationId}`);
      const data = await res.json();
      if (cancelado()) return;
      if (data.success) {
        setEvaluationNotes(data.data);
      }
    } catch (error) {
      console.error('Error cargando notas:', error);
    } finally {
      if (!cancelado()) setLoadingNotes(false);
    }
  };

  // EVAL-020: editar, cambiar la visibilidad o borrar una nota propia (o
  // cualquiera, si es admin). Antes la API existía pero sin UI, así que una
  // nota publicada por error seguía visible para la empresa.
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [editingNoteContent, setEditingNoteContent] = useState('');
  const [noteActionId, setNoteActionId] = useState<number | null>(null);
  const [noteActionError, setNoteActionError] = useState<string | null>(null);

  const actualizarNota = async (
    note: EvaluationNote,
    cambios: { content?: string; isPublic?: boolean }
  ) => {
    setNoteActionId(note.id);
    setNoteActionError(null);
    try {
      const res = await fetch(`/api/evaluations/notes/${note.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cambios),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setNoteActionError(data.error || 'No se pudo actualizar la nota');
        return;
      }
      setEvaluationNotes(prev =>
        prev.map(n => (n.id === note.id ? { ...n, ...cambios } : n))
      );
      setEditingNoteId(null);
    } catch {
      setNoteActionError('Error de conexión');
    } finally {
      setNoteActionId(null);
    }
  };

  const borrarNota = async (note: EvaluationNote) => {
    if (!confirm('¿Borrar esta nota? No se puede deshacer.')) return;
    setNoteActionId(note.id);
    setNoteActionError(null);
    try {
      const res = await fetch(`/api/evaluations/notes/${note.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setNoteActionError(data.error || 'No se pudo borrar la nota');
        return;
      }
      setEvaluationNotes(prev => prev.filter(n => n.id !== note.id));
    } catch {
      setNoteActionError('Error de conexión');
    } finally {
      setNoteActionId(null);
    }
  };

  // FEAT-5: Función para guardar nota de evaluación
  const handleSaveNote = async () => {
    if (!newNoteContent.trim() || !application?.id) return;
    setNoteError('');

    // #PERF-014: el selector de archivo no validaba tamaño en cliente, así que
    // el adjunto grande sólo fallaba (en silencio) al llegar a /api/upload.
    if (noteDocument && noteDocument.size > MAX_ADJUNTO_BYTES) {
      setNoteError(`El adjunto supera el máximo de ${MAX_ADJUNTO_LABEL}`);
      return;
    }

    setSavingNote(true);

    try {
      let documentUrl = null;
      let documentName = null;

      // Si hay documento, subirlo primero
      if (noteDocument) {
        const formData = new FormData();
        formData.append('file', noteDocument);
        const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
        const uploadData = await uploadRes.json().catch(() => ({}));

        if (!uploadRes.ok || !uploadData.success) {
          setNoteError(uploadData.error || 'Error al subir el documento adjunto');
          return;
        }

        // #PERF-015: si la subida responde 200 sin url, antes la nota se
        // guardaba SIN adjunto y nadie se enteraba.
        if (!uploadData.url) {
          setNoteError('El documento no se pudo subir. Inténtalo de nuevo.');
          return;
        }

        documentUrl = uploadData.url;
        documentName = noteDocument.name;
      }

      const res = await fetch('/api/evaluations/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationId: application.id,
          content: newNoteContent.trim(),
          documentUrl,
          documentName,
          isPublic: isNotePublic,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.success) {
        setNoteError(data.error || 'No se pudo guardar la nota');
        return;
      }

      // Quien la acaba de escribir es su autor: puede editarla o retirarla.
      setEvaluationNotes(prev => [{ ...data.data, canEdit: true }, ...prev]);
      setNewNoteContent('');
      setNoteDocument(null);
      setIsNotePublic(false);
      if (noteFileRef.current) noteFileRef.current.value = '';
    } catch (error) {
      console.error('Error guardando nota:', error);
      setNoteError(error instanceof Error ? error.message : 'Error de conexión');
    } finally {
      setSavingNote(false);
    }
  };

  if (!isOpen || (!application && !candidate)) return null;

  // Obtener candidateId
  const candidateId = application?.candidateProfile?.id || candidate?.id;

  // Normalizar datos según la fuente
  const data = application
    ? {
        name: application.candidateName,
        email: application.candidateEmail,
        phone: application.candidatePhone || application.candidateProfile?.telefono,
        cvUrl: application.cvUrl || application.candidateProfile?.cvUrl,
        coverLetter: application.coverLetter,
        status: application.status,
        appliedAt: application.createdAt,
        notes: application.notes,
        // Datos del perfil enriquecido
        universidad: application.candidateProfile?.universidad,
        carrera: application.candidateProfile?.carrera,
        nivelEstudios: application.candidateProfile?.nivelEstudios,
        educacion: application.candidateProfile?.educacion, // FEATURE: Educación múltiple
        añosExperiencia: application.candidateProfile?.añosExperiencia,
        profile: application.candidateProfile?.profile,
        subcategory: application.candidateProfile?.subcategory,
        seniority: application.candidateProfile?.seniority,
        linkedinUrl: application.candidateProfile?.linkedinUrl,
        portafolioUrl: application.candidateProfile?.portafolioUrl,
        sexo: application.candidateProfile?.sexo,
        fechaNacimiento: application.candidateProfile?.fechaNacimiento,
        ciudad: application.candidateProfile?.ciudad,
        estado: application.candidateProfile?.estado,
        ubicacionCercana: application.candidateProfile?.ubicacionCercana,
        latitude: application.candidateProfile?.latitude,
        longitude: application.candidateProfile?.longitude,
        source: application.candidateProfile?.source,
        adminNotas: application.candidateProfile?.notas,
        fotoUrl: application.candidateProfile?.fotoUrl, // FEAT-2: Foto de perfil
        cartaPresentacion: application.candidateProfile?.cartaPresentacion,
        experiences: application.candidateProfile?.experiences || [],
        documents: application.candidateProfile?.documents || []
      }
    : {
        name: `${candidate!.nombre} ${candidate!.apellidoPaterno} ${candidate!.apellidoMaterno || ''}`.trim(),
        email: candidate!.email,
        phone: candidate!.telefono,
        cvUrl: candidate!.cvUrl,
        coverLetter: null,
        status: candidate!.status,
        appliedAt: null,
        notes: null,
        // Datos del perfil
        universidad: candidate!.universidad,
        carrera: candidate!.carrera,
        nivelEstudios: candidate!.nivelEstudios,
        educacion: candidate!.educacion, // FEATURE: Educación múltiple
        añosExperiencia: candidate!.añosExperiencia,
        profile: candidate!.profile,
        subcategory: candidate!.subcategory,
        seniority: candidate!.seniority,
        linkedinUrl: candidate!.linkedinUrl,
        portafolioUrl: candidate!.portafolioUrl,
        sexo: candidate!.sexo,
        fechaNacimiento: candidate!.fechaNacimiento,
        ciudad: candidate!.ciudad,
        estado: candidate!.estado,
        ubicacionCercana: candidate!.ubicacionCercana,
        latitude: candidate!.latitude,
        longitude: candidate!.longitude,
        source: candidate!.source,
        adminNotas: candidate!.notas,
        fotoUrl: candidate!.fotoUrl, // FEAT-2: Foto de perfil
        cartaPresentacion: candidate!.cartaPresentacion,
        experiences: candidate!.experiences || [],
        documents: candidate!.documents || []
      };

  // #PERF-011: la API guarda `new Date('2020-03-01')` = 2020-03-01T00:00:00Z.
  // Sin `timeZone: 'UTC'`, en México (UTC-6) eso es el 29-feb a las 18:00 y la
  // ficha mostraba «febrero de 2020» mientras el formulario de edición decía
  // 2020-03-01. Afectaba a toda experiencia que empezara o terminara el día 1.
  //
  // OJO: formatDate se usa para la fecha de postulación, que es un instante
  // real (createdAt), no una fecha guardada a medianoche UTC: ésa se muestra en
  // hora local. Con UTC, una postulación hecha a las 19:00 en México salía con
  // la fecha del día siguiente. Sólo formatExperienceDate va en UTC.
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatExperienceDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'short',
      timeZone: 'UTC'
    });
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      reviewing: 'bg-blue-100 text-blue-800',
      sent_to_specialist: 'bg-purple-100 text-purple-800',
      evaluating: 'bg-indigo-100 text-indigo-800',
      sent_to_company: 'bg-green-100 text-green-800',
      hired: 'bg-emerald-100 text-emerald-800',
      discarded: 'bg-red-100 text-red-800',
      available: 'bg-green-100 text-green-800',
      in_process: 'bg-blue-100 text-blue-800',
      inactive: 'bg-gray-100 text-gray-800'
    };

    const labels: Record<string, string> = {
      pending: 'Pendiente',
      reviewing: 'En revisión',
      sent_to_specialist: 'Enviado a especialista',
      evaluating: 'En evaluación técnica',
      sent_to_company: 'Enviado a empresa',
      hired: 'Contratado',
      discarded: 'Descartado',
      available: 'Disponible',
      in_process: 'En proceso',
      inactive: 'Inactivo'
    };

    return (
      <span className={`px-3 py-1 text-sm font-semibold rounded-full ${badges[status] || 'bg-gray-100 text-gray-800'}`}>
        {labels[status] || status}
      </span>
    );
  };

  /**
   * Normaliza una entrada de educación venida de la BD (#PERF-006).
   *
   * El JSON se guardaba tal cual: un `null` dentro del array hacía que
   * `edu.id` lanzara un TypeError y, como sólo admin tiene error boundary, la
   * página entera de reclutador/especialista/empresa se caía. Un campo que no
   * fuera string daba «Objects are not valid as a React child».
   */
  const normalizarEducacion = (entrada: unknown, index: number): Education | null => {
    if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada)) return null;

    const e = entrada as Record<string, unknown>;
    const texto = (v: unknown) => (typeof v === 'string' || typeof v === 'number' ? String(v) : '');
    const anio = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

    return {
      id: typeof e.id === 'number' ? e.id : index + 1,
      nivel: texto(e.nivel),
      institucion: texto(e.institucion),
      carrera: texto(e.carrera),
      añoInicio: anio(e.añoInicio),
      añoFin: anio(e.añoFin),
      estatus: texto(e.estatus)
    };
  };

  // FEATURE: Parsear educación múltiple
  const parseEducacion = (): Education[] => {
    if (data.educacion) {
      try {
        const parsed = JSON.parse(data.educacion);
        if (Array.isArray(parsed)) {
          const normalizadas = parsed
            .map(normalizarEducacion)
            .filter((e): e is Education => e !== null);
          // #PERF-007: si se guardó un array (aunque esté vacío) manda ese
          // array; el fallback legacy sólo aplica cuando nunca se guardó nada.
          return normalizadas;
        }
      } catch {
        // Si falla el parse, continuamos con fallback
      }
    }
    // Fallback: crear array con datos legacy si existen
    if (data.universidad || data.carrera || data.nivelEstudios) {
      return [{
        id: 1,
        nivel: data.nivelEstudios || '',
        institucion: data.universidad || '',
        carrera: data.carrera || '',
        añoInicio: null,
        añoFin: null,
        estatus: ''
      }];
    }
    return [];
  };

  const educaciones = parseEducacion();

  const getSourceLabel = (source?: string) => {
    const labels: Record<string, string> = {
      manual: 'Ingreso manual',
      linkedin: 'LinkedIn',
      occ: 'OCC',
      referido: 'Referido',
      portal: 'Portal web'
    };
    return labels[source || ''] || source || 'No especificado';
  };

  const getSeniorityLabel = (seniority?: string) => {
    const labels: Record<string, string> = {
      Practicante: 'Practicante',
      Jr: 'Junior',
      Middle: 'Middle',
      Sr: 'Senior',
      Director: 'Director'
    };
    return labels[seniority || ''] || seniority || '';
  };

  const getSexoLabel = (sexo?: string) => {
    const labels: Record<string, string> = {
      M: 'Masculino',
      F: 'Femenino',
      Otro: 'Otro'
    };
    return labels[sexo || ''] || sexo || 'No especificado';
  };

  // #PERF-011: la fecha de nacimiento se guarda a medianoche UTC; comparándola
  // con los getters locales la edad cambiaba un día antes de tiempo.
  const calculateAge = (fechaNacimiento?: string | null) => {
    if (!fechaNacimiento) return null;
    const birthDate = new Date(fechaNacimiento);
    if (Number.isNaN(birthDate.getTime())) return null;
    const today = new Date();
    let age = today.getUTCFullYear() - birthDate.getUTCFullYear();
    const monthDiff = today.getUTCMonth() - birthDate.getUTCMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getUTCDate() < birthDate.getUTCDate())) {
      age--;
    }
    return age;
  };

  // Obtener ubicación del candidato (datos personales primero, luego experiencia)
  const getLocation = () => {
    // Primero usar ubicación personal si existe
    if (data.ciudad || data.estado) {
      const parts = [data.ciudad, data.estado].filter(Boolean);
      return parts.join(', ');
    }
    // Fallback: experiencia más reciente
    const experiences = data.experiences || [];
    if (experiences.length > 0) {
      const currentJob = experiences.find(exp => exp.esActual);
      if (currentJob?.ubicacion) return currentJob.ubicacion;
      if (experiences[0]?.ubicacion) return experiences[0].ubicacion;
    }
    return null;
  };

  // Agregar documento
  const handleAddDocument = async () => {
    if (!candidateId) {
      setDocError('No se encontró el ID del candidato');
      return;
    }
    if (!newDocName.trim()) {
      setDocError('El nombre del documento es requerido');
      return;
    }
    if (!newDocFile) {
      setDocError('Selecciona un archivo');
      return;
    }
    if (newDocFile.size > MAX_ADJUNTO_BYTES) {
      setDocError(`El archivo supera el máximo de ${MAX_ADJUNTO_LABEL}`);
      return;
    }

    try {
      setSavingDoc(true);
      setDocError('');

      // 1. Subir archivo
      const formData = new FormData();
      formData.append('file', newDocFile);

      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json().catch(() => ({}));
        setDocError(errorData.error || 'Error al subir archivo');
        return;
      }

      const uploadData = await uploadResponse.json();

      if (!uploadData.success) {
        setDocError(uploadData.error || 'Error al subir archivo');
        return;
      }

      // 2. Crear documento en el candidato
      //
      // #PERF-016: antes se llamaba a /api/admin/candidates/[id]/documents,
      // reservada a admin: para reclutador y especialista fallaba siempre y el
      // archivo ya subido quedaba huérfano. Esta ruta comprueba la asignación.
      const docResponse = await fetch(`/api/evaluations/candidates/${candidateId}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newDocName.trim(),
          fileUrl: uploadData.url,
          // #PERF-032: con el subtipo MIME, un .docx guardaba
          // 'vnd.openxmlformats-officedocument.wordprocessingml.document' y la
          // tarjeta lo pintaba entero en mayúsculas.
          fileType: newDocFile.name.split('.').pop()?.toLowerCase() || 'file'
        })
      });
      if (!docResponse.ok) {
        const errorData = await docResponse.json().catch(() => ({}));
        setDocError(errorData.error || 'Error al guardar documento');
        return;
      }

      const docData = await docResponse.json();

      if (docData.success) {
        setShowAddDocModal(false);
        setNewDocName('');
        setNewDocFile(null);
        if (docInputRef.current) docInputRef.current.value = '';
        onDocumentsUpdated?.();
      } else {
        setDocError(docData.error || 'Error al guardar documento');
      }
    } catch (err) {
      setDocError('Error de conexión');
    } finally {
      setSavingDoc(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 fade-in-fast"
      // #PERF-037: con onClick, arrastrar una selección de texto desde dentro
      // del diálogo y soltar fuera despachaba `click` sobre el overlay (ancestro
      // común) y cerraba el modal, borrando el borrador de nota. onMouseDown +
      // `e.target === e.currentTarget` sólo cierra al pulsar el fondo.
      //
      // #PERF-017: además ya no hace falta stopPropagation en el diálogo, que
      // era lo que dejaba desprotegido al sub-modal «Agregar Documento» (hijo
      // del overlay pero hermano del diálogo): cualquier clic dentro de él
      // burbujeaba hasta aquí y cerraba toda la ficha.
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Perfil de ${data.name}`}
        className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 md:p-6 flex justify-between items-start gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 md:gap-3 mb-2">
              {/* FEAT-2: Foto de perfil del candidato */}
              <CandidatePhoto
                fotoUrl={data.fotoUrl}
                candidateName={data.name}
                size="lg"
              />
              <div className="min-w-0">
                <h2 className="text-lg md:text-2xl font-bold text-gray-900 truncate">{data.name}</h2>
                <div className="flex items-center gap-1 md:gap-2 mt-1 flex-wrap">
                  {getStatusBadge(data.status)}
                  {data.seniority && (
                    <span className="px-2 py-0.5 md:py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded">
                      {getSeniorityLabel(data.seniority)}
                    </span>
                  )}
                  {data.profile && (
                    <span className="px-2 py-0.5 md:py-1 text-xs font-medium bg-[#e8f4f4] text-[#2b5d62] rounded hidden sm:inline">
                      {data.profile}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="text-gray-400 hover:text-gray-600 p-1 flex-shrink-0 rounded-full"
          >
            <X size={24} aria-hidden="true" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 md:p-6">
          {/* Contact Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 mb-6">
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
              <Mail className="w-5 h-5 text-[#2b5d62]" />
              <div>
                <p className="text-xs text-gray-500">Email</p>
                <a href={`mailto:${data.email}`} className="text-sm font-medium text-[#2b5d62] hover:underline">
                  {data.email}
                </a>
              </div>
            </div>

            {data.phone && (
              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                <Phone className="w-5 h-5 text-[#2b5d62]" />
                <div>
                  <p className="text-xs text-gray-500">Teléfono</p>
                  <a href={`tel:${data.phone}`} className="text-sm font-medium text-[#2b5d62] hover:underline">
                    {data.phone}
                  </a>
                </div>
              </div>
            )}

            {data.appliedAt && (
              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                <Calendar className="w-5 h-5 text-[#2b5d62]" />
                <div>
                  <p className="text-xs text-gray-500">Fecha de aplicación</p>
                  <p className="text-sm font-medium text-gray-900">{formatDate(data.appliedAt)}</p>
                </div>
              </div>
            )}

            {data.sexo && (
              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                <User className="w-5 h-5 text-[#2b5d62]" />
                <div>
                  <p className="text-xs text-gray-500">Sexo</p>
                  <p className="text-sm font-medium text-gray-900">{getSexoLabel(data.sexo)}</p>
                </div>
              </div>
            )}

            {calculateAge(data.fechaNacimiento) && (
              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                <Calendar className="w-5 h-5 text-[#2b5d62]" />
                <div>
                  <p className="text-xs text-gray-500">Edad</p>
                  <p className="text-sm font-medium text-gray-900">{calculateAge(data.fechaNacimiento)} años</p>
                </div>
              </div>
            )}

            {getLocation() && (
              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                <MapPin className="w-5 h-5 text-[#2b5d62]" />
                <div>
                  <p className="text-xs text-gray-500">Ubicación</p>
                  <p className="text-sm font-medium text-gray-900">{getLocation()}</p>
                  {data.ubicacionCercana && (
                    <p className="text-xs text-gray-500 mt-0.5">{data.ubicacionCercana}</p>
                  )}
                  <DistanceBadge
                    candidateLat={data.latitude}
                    candidateLng={data.longitude}
                    jobLat={jobLatitude}
                    jobLng={jobLongitude}
                  />
                </div>
              </div>
            )}
          </div>

          {/* FEATURE: Educación múltiple */}
          {educaciones.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-[#2b5d62]" />
                Educación
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {educaciones.map((edu, index) => (
                  <div key={edu.id || index} className="p-4 border border-gray-200 rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-semibold text-gray-900">{edu.carrera || 'Sin carrera'}</h4>
                        <p className="text-sm text-gray-600">{edu.institucion || 'Sin institución'}</p>
                      </div>
                      {edu.estatus && (
                        <span className={`px-2 py-1 text-xs font-medium rounded ${COLOR_ESTATUS_EDUCACION[edu.estatus] || 'bg-gray-100 text-gray-800'}`}>
                          {edu.estatus}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      {edu.nivel && <span className="font-medium">{edu.nivel}</span>}
                      {(edu.añoInicio || edu.añoFin) && (
                        <>
                          <span className="text-gray-400">•</span>
                          <span>
                            {edu.añoInicio || '?'} - {edu.añoFin || 'Presente'}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Experience & Professional Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {data.añosExperiencia !== undefined && (
              <div className="p-4 border border-gray-200 rounded-lg">
                <div className="flex items-center gap-2 text-gray-500 mb-1">
                  <Briefcase className="w-4 h-4" />
                  <span className="text-xs font-medium">Años de Experiencia</span>
                </div>
                <p className="text-sm font-semibold text-gray-900">
                  {data.añosExperiencia} {data.añosExperiencia === 1 ? 'año' : 'años'}
                </p>
              </div>
            )}

            {data.seniority && (
              <div className="p-4 border border-gray-200 rounded-lg">
                <div className="flex items-center gap-2 text-gray-500 mb-1">
                  <Briefcase className="w-4 h-4" />
                  <span className="text-xs font-medium">Nivel de Experiencia</span>
                </div>
                <p className="text-sm font-semibold text-gray-900">{getSeniorityLabel(data.seniority)}</p>
              </div>
            )}

            {data.profile && (
              <div className="p-4 border border-gray-200 rounded-lg">
                <div className="flex items-center gap-2 text-gray-500 mb-1">
                  <Briefcase className="w-4 h-4" />
                  <span className="text-xs font-medium">Área de Especialidad</span>
                </div>
                <p className="text-sm font-semibold text-gray-900">{data.profile}</p>
              </div>
            )}

            {data.subcategory && (
              <div className="p-4 border border-gray-200 rounded-lg">
                <div className="flex items-center gap-2 text-gray-500 mb-1">
                  <Briefcase className="w-4 h-4" />
                  <span className="text-xs font-medium">Subespecialidad</span>
                </div>
                <p className="text-sm font-semibold text-gray-900">{data.subcategory}</p>
              </div>
            )}

            {data.source && (
              <div className="p-4 border border-gray-200 rounded-lg">
                <div className="flex items-center gap-2 text-gray-500 mb-1">
                  <User className="w-4 h-4" />
                  <span className="text-xs font-medium">Fuente</span>
                </div>
                <p className="text-sm font-semibold text-gray-900">{getSourceLabel(data.source)}</p>
              </div>
            )}
          </div>

          {/* Links */}
          <div className="flex flex-wrap gap-3 mb-6">
            {data.cvUrl && (
              <a
                href={ensureUrl(data.cvUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#2b5d62] text-white rounded-lg hover:bg-[#1e4347] transition-colors"
              >
                <FileText className="w-4 h-4" />
                Ver CV
              </a>
            )}

            {data.linkedinUrl && (
              <a
                href={ensureUrl(data.linkedinUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#0077b5] text-white rounded-lg hover:bg-[#006097] transition-colors"
              >
                <Linkedin className="w-4 h-4" />
                LinkedIn
              </a>
            )}

            {data.portafolioUrl && (
              <a
                href={ensureUrl(data.portafolioUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                <LinkIcon className="w-4 h-4" />
                Portafolio
              </a>
            )}
          </div>

          {/* Carta de Presentación del candidato */}
          {data.cartaPresentacion && (
            <div className="mb-6">
              <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#2b5d62]" />
                Carta de Presentación
              </h3>
              <div className="p-4 bg-[#e8f4f4] border border-[#2b5d62]/20 rounded-lg">
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{data.cartaPresentacion}</p>
              </div>
            </div>
          )}

          {/* Cover Letter (de la aplicación) */}
          {data.coverLetter && (
            <div className="mb-6">
              <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-[#2b5d62]" />
                Carta de Presentación
              </h3>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{data.coverLetter}</p>
              </div>
            </div>
          )}

          {/* Evaluación de Habilidades */}
          {canViewSkillRatings && parsedHabilidades.length > 0 && application?.id && (
            <div className="mb-6 border border-amber-200 rounded-lg overflow-hidden">
              <div className="bg-amber-50 px-4 py-3 border-b border-amber-200">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Star className="w-5 h-5 text-amber-500" />
                  Evaluación de Habilidades
                </h3>
                {!canEditSkillRatings && (
                  <p className="text-xs text-gray-500 mt-1">Calificaciones del especialista</p>
                )}
              </div>
              <div className="p-4 space-y-3">
                {parsedHabilidades.map((skill) => {
                  const currentRating = skillRatings[skill]?.rating || 0;
                  const currentComment = skillRatings[skill]?.comment || '';
                  const savedRating = savedSkillRatings.find(r => r.skillName === skill);

                  return (
                    <div key={skill} className="flex flex-col sm:flex-row sm:items-center gap-2 py-2 border-b border-gray-100 last:border-0">
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-gray-800">{skill}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4, 5].map(star => (
                            <button
                              key={star}
                              type="button"
                              aria-label={`Calificar ${skill}: ${star} de 5 estrella${star > 1 ? 's' : ''}`}
                              aria-pressed={star <= currentRating}
                              title={`${star} de 5`}
                              onClick={() => {
                                if (!canEditSkillRatings) return;
                                setSkillRatings(prev => ({
                                  ...prev,
                                  [skill]: { ...prev[skill], rating: star, comment: prev[skill]?.comment || '' }
                                }));
                              }}
                              disabled={!canEditSkillRatings}
                              className={`text-xl transition-colors ${
                                canEditSkillRatings ? 'cursor-pointer hover:scale-110' : 'cursor-default'
                              } ${star <= currentRating ? 'text-amber-400' : 'text-gray-300'}`}
                            >
                              <span aria-hidden="true">{star <= currentRating ? '★' : '☆'}</span>
                            </button>
                          ))}
                        </div>
                        {canEditSkillRatings && (
                          <input
                            type="text"
                            value={currentComment}
                            onChange={(e) => {
                              setSkillRatings(prev => ({
                                ...prev,
                                [skill]: { ...prev[skill], rating: prev[skill]?.rating || 0, comment: e.target.value }
                              }));
                            }}
                            placeholder="Comentario..."
                            className="w-36 px-2 py-1 text-xs border border-gray-200 rounded focus:ring-1 focus:ring-amber-400 focus:border-amber-400"
                          />
                        )}
                        {!canEditSkillRatings && savedRating?.comment && (
                          <span className="text-xs text-gray-500 italic max-w-[200px] truncate" title={savedRating.comment}>
                            {savedRating.comment}
                          </span>
                        )}
                      </div>
                      {!canEditSkillRatings && savedRating && (
                        <span className="text-xs text-gray-400">
                          por {savedRating.ratedBy.nombre}
                        </span>
                      )}
                    </div>
                  );
                })}

                {canEditSkillRatings && (
                  <div className="pt-2 space-y-2">
                    <button
                      type="button"
                      onClick={handleSaveSkillRatings}
                      disabled={savingSkillRatings || Object.values(skillRatings).every(v => v.rating === 0)}
                      className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {savingSkillRatings ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Guardando...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          Guardar Calificaciones
                        </>
                      )}
                    </button>
                    {/* #PERF-014/#PERF-015: confirmación y error visibles */}
                    {ratingsError && (
                      <p role="alert" className="text-sm text-red-600">{ratingsError}</p>
                    )}
                    {ratingsSaved && !ratingsError && (
                      <p role="status" className="text-sm text-green-600">Calificaciones guardadas</p>
                    )}
                  </div>
                )}

                {!canEditSkillRatings && skillRatingsLoaded && savedSkillRatings.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-2">
                    Aún no se han calificado las habilidades.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Experience */}
          {data.experiences && data.experiences.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-[#2b5d62]" />
                Experiencia Laboral
              </h3>
              <div className="space-y-4">
                {data.experiences.map((exp, index) => (
                  <div key={exp.id || index} className="p-4 border border-gray-200 rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-semibold text-gray-900">{exp.puesto}</h4>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Building className="w-4 h-4" />
                          <span>{exp.empresa}</span>
                          {exp.ubicacion && (
                            <>
                              <span className="text-gray-400">•</span>
                              <MapPin className="w-4 h-4" />
                              <span>{exp.ubicacion}</span>
                            </>
                          )}
                        </div>
                      </div>
                      {exp.esActual && (
                        <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded">
                          Actual
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-sm text-gray-500 mb-2">
                      <Clock className="w-4 h-4" />
                      <span>
                        {formatExperienceDate(exp.fechaInicio)} - {exp.esActual ? 'Presente' : exp.fechaFin ? formatExperienceDate(exp.fechaFin) : 'N/A'}
                      </span>
                    </div>
                    {exp.descripcion && (
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{exp.descripcion}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Documents */}
          {(data.documents && data.documents.length > 0) || canAddDocuments ? (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <File className="w-5 h-5 text-[#2b5d62]" />
                  Documentos {data.documents && data.documents.length > 0 && `(${data.documents.length})`}
                </h3>
                {canAddDocuments && candidateId && (
                  <button
                    type="button"
                    onClick={() => setShowAddDocModal(true)}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm bg-[#2b5d62] text-white rounded-lg hover:bg-[#1e4347] transition-colors"
                  >
                    <Plus size={16} />
                    Agregar
                  </button>
                )}
              </div>
              {data.documents && data.documents.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {data.documents.map((doc, index) => (
                    <a
                      key={doc.id || index}
                      href={doc.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-[#2b5d62] transition-colors group"
                    >
                      <div className="w-10 h-10 bg-[#e8f4f4] rounded-lg flex items-center justify-center flex-shrink-0">
                        <FileText className="w-5 h-5 text-[#2b5d62]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{doc.name}</p>
                        {doc.fileType && (
                          <p className="text-xs text-gray-500 uppercase truncate">{doc.fileType}</p>
                        )}
                      </div>
                      <Download className="w-4 h-4 text-gray-400 group-hover:text-[#2b5d62] flex-shrink-0" />
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">
                  No hay documentos. {canAddDocuments && 'Haz clic en "Agregar" para subir uno.'}
                </p>
              )}
            </div>
          ) : null}

          {/* Recruiter Notes (only for specialist) - Legacy JobAssignment notes */}
          {showRecruiterNotes && recruiterNotes && (
            <div className="mb-6">
              <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-purple-600" />
                Notas del Reclutador (Vacante)
              </h3>
              <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{recruiterNotes}</p>
              </div>
            </div>
          )}

          {/* FEAT-5: Sección de Notas de Evaluación */}
          {canViewEvaluationNotes && application?.id && (
            <div className="mb-6 border-t pt-6">
              <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-[#2b5d62]" />
                Notas de Evaluación
              </h3>

              {/* Notas existentes */}
              {loadingNotes ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                  <span className="ml-2 text-sm text-gray-500">Cargando notas...</span>
                </div>
              ) : evaluationNotes.length > 0 ? (
                <div className="space-y-3 mb-4 max-h-60 overflow-y-auto">
                  {evaluationNotes.map((note) => (
                    <div key={note.id} className="bg-gray-50 rounded-lg p-3 text-sm border border-gray-200">
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`font-medium px-2 py-0.5 rounded text-xs ${
                            note.authorRole === 'recruiter'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-purple-100 text-purple-700'
                          }`}>
                            {note.authorRole === 'recruiter' ? 'Reclutador' : 'Especialista'}
                          </span>
                          {userRole !== 'company' && (
                            note.isPublic ? (
                              <span className="px-2 py-0.5 rounded text-xs bg-green-100 text-green-700 font-medium">
                                Visible empresa
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-500 font-medium">
                                Solo INAKAT
                              </span>
                            )
                          )}
                        </div>
                        <span className="text-xs text-gray-400">
                          {new Date(note.createdAt).toLocaleDateString('es-MX', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      {editingNoteId === note.id ? (
                        <div className="space-y-2">
                          <textarea
                            value={editingNoteContent}
                            onChange={(e) => setEditingNoteContent(e.target.value)}
                            rows={3}
                            maxLength={5000}
                            aria-label="Editar nota"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => actualizarNota(note, { content: editingNoteContent.trim() })}
                              disabled={noteActionId === note.id || !editingNoteContent.trim()}
                              className="text-xs px-3 py-1 rounded bg-[#2b5d62] text-white disabled:opacity-50"
                            >
                              Guardar
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingNoteId(null)}
                              className="text-xs px-3 py-1 rounded border border-gray-300 text-gray-600"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-gray-700 whitespace-pre-wrap">{note.content}</p>
                      )}
                      {note.canEdit && userRole !== 'company' && editingNoteId !== note.id && (
                        <div className="flex flex-wrap gap-3 mt-2 text-xs">
                          <button
                            type="button"
                            onClick={() => actualizarNota(note, { isPublic: !note.isPublic })}
                            disabled={noteActionId === note.id}
                            className="text-[#2b5d62] hover:underline disabled:opacity-50"
                          >
                            {note.isPublic ? 'Ocultar a la empresa' : 'Hacer visible a la empresa'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingNoteId(note.id);
                              setEditingNoteContent(note.content);
                            }}
                            disabled={noteActionId === note.id}
                            className="text-gray-600 hover:underline disabled:opacity-50"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => borrarNota(note)}
                            disabled={noteActionId === note.id}
                            className="text-red-600 hover:underline disabled:opacity-50"
                          >
                            Borrar
                          </button>
                        </div>
                      )}
                      {note.documentUrl && (
                        <a
                          href={note.documentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#2b5d62] text-xs underline mt-2 inline-flex items-center gap-1 hover:text-[#1e4347]"
                        >
                          <FileText size={12} />
                          {note.documentName || 'Documento adjunto'}
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm mb-4">No hay notas de evaluación aún.</p>
              )}
              {noteActionError && (
                <p role="alert" className="text-sm text-red-600 mb-3">{noteActionError}</p>
              )}

              {/* Formulario para nueva nota (solo recruiter/specialist) */}
              {canAddEvaluationNotes && (
                <div className="space-y-3 bg-gray-50 p-4 rounded-lg border border-gray-200">
                  {/* #PERF-014/#PERF-015: antes cualquier fallo sólo iba a la
                      consola y el spinner desaparecía sin decir nada. */}
                  {noteError && (
                    <p role="alert" className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">
                      {noteError}
                    </p>
                  )}
                  <textarea
                    value={newNoteContent}
                    onChange={(e) => setNewNoteContent(e.target.value)}
                    placeholder="Escribe tus observaciones sobre este candidato..."
                    className="w-full border border-gray-300 rounded-lg p-3 text-sm resize-none focus:ring-2 focus:ring-[#2b5d62] focus:border-transparent"
                    rows={3}
                  />
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isNotePublic}
                      onChange={(e) => setIsNotePublic(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-[#2b5d62] focus:ring-[#2b5d62]"
                    />
                    <span className="text-sm text-gray-600">Visible para empresa</span>
                    {isNotePublic && (
                      <span className="text-xs text-green-600 font-medium">(La empresa podrá leer esta nota)</span>
                    )}
                  </label>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <label className="flex items-center gap-2 text-sm text-gray-500 cursor-pointer hover:text-gray-700 flex-1">
                      <Upload className="w-4 h-4" />
                      <span className="truncate">
                        {noteDocument ? noteDocument.name : `Adjuntar documento (opcional, máx. ${MAX_ADJUNTO_LABEL})`}
                      </span>
                      <input
                        type="file"
                        ref={noteFileRef}
                        className="hidden"
                        accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                        onChange={(e) => setNoteDocument(e.target.files?.[0] || null)}
                      />
                    </label>
                    {noteDocument && (
                      <button
                        type="button"
                        onClick={() => {
                          setNoteDocument(null);
                          if (noteFileRef.current) noteFileRef.current.value = '';
                        }}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Quitar archivo
                      </button>
                    )}
                    <button
                      onClick={handleSaveNote}
                      disabled={!newNoteContent.trim() || savingNote}
                      className="bg-[#2b5d62] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#1e4347] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 justify-center"
                    >
                      {savingNote ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Guardando...
                        </>
                      ) : (
                        <>
                          <Save size={16} />
                          Guardar nota
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Admin Notes.
              PRIVACIDAD (#50/#51), defensa en profundidad: `adminNotas`
              (Candidate.notas) y `notes` (Application.notes) son material
              interno de INAKAT. Las rutas de empresa ya no los envían, pero
              este modal los pintaba sin mirar el rol, así que bastaba con que
              una ruta volviera a incluirlos para reabrir la fuga. */}
          {puedeVerNotasInternas && data.adminNotas && (
            <div className="mb-6">
              <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-gray-500" />
                Notas del Admin
              </h3>
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{data.adminNotas}</p>
              </div>
            </div>
          )}

          {/* Application Notes */}
          {puedeVerNotasInternas && data.notes && (
            <div className="mb-6">
              <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-blue-500" />
                Notas de la Aplicación
              </h3>
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{data.notes}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 p-3 md:p-4 flex flex-col sm:flex-row justify-between items-center gap-3">
          {/* Navigation */}
          {(onPrev || onNext) && (
            <div className="flex items-center gap-2 w-full sm:w-auto justify-center sm:justify-start">
              <button
                onClick={onPrev}
                disabled={!onPrev || currentIndex === 0}
                className="flex items-center gap-1 px-2 md:px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Anterior</span>
              </button>
              {currentIndex !== undefined && totalCount !== undefined && (
                <span className="text-sm text-gray-500 px-2">
                  {currentIndex + 1}/{totalCount}
                </span>
              )}
              <button
                onClick={onNext}
                disabled={!onNext || (currentIndex !== undefined && totalCount !== undefined && currentIndex >= totalCount - 1)}
                className="flex items-center gap-1 px-2 md:px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <span className="hidden sm:inline">Siguiente</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
          {!(onPrev || onNext) && <div className="hidden sm:block" />}

          <button
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>

      {/* Modal de Agregar Documento */}
      {showAddDocModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4"
          // #PERF-017: este sub-modal es HIJO del overlay externo; sin esto,
          // cualquier interacción dentro (nombre, selector de archivo, Guardar)
          // llegaba al overlay y cerraba toda la ficha.
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div role="dialog" aria-modal="true" aria-label="Agregar documento" className="bg-white rounded-lg w-full max-w-md">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="text-lg font-bold">Agregar Documento</h3>
              <button
                onClick={() => {
                  setShowAddDocModal(false);
                  setNewDocName('');
                  setNewDocFile(null);
                  setDocError('');
                }}
                aria-label="Cerrar"
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {docError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                  {docError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre del documento *
                </label>
                <input
                  type="text"
                  placeholder="Ej: Título universitario, Certificación AWS"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2b5d62] focus:border-[#2b5d62]"
                  value={newDocName}
                  onChange={(e) => setNewDocName(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Archivo *
                </label>
                <input
                  type="file"
                  ref={docInputRef}
                  onChange={(e) => setNewDocFile(e.target.files?.[0] || null)}
                  className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#2b5d62] file:text-white hover:file:bg-[#1e4347]"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                />
                <p className="text-xs text-gray-500 mt-1">PDF, DOC, DOCX, JPG, PNG (máx. {MAX_ADJUNTO_LABEL})</p>
              </div>

              {newDocFile && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-700">
                    Archivo seleccionado: <span className="font-medium">{newDocFile.name}</span>
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 p-4 border-t">
              <button
                type="button"
                onClick={() => {
                  setShowAddDocModal(false);
                  setNewDocName('');
                  setNewDocFile(null);
                  setDocError('');
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleAddDocument}
                disabled={savingDoc || !newDocName.trim() || !newDocFile}
                className="flex items-center gap-2 px-4 py-2 bg-[#2b5d62] text-white rounded-lg hover:bg-[#1e4347] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingDoc ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    Guardar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
