// RUTA: src/components/shared/CandidateProfileModal.tsx

'use client';

/**
 * Ficha de candidato. La abren admin (pipeline), empresa (candidatos de su
 * vacante), reclutador y especialista (panel y detalle de vacante).
 *
 * Rediseño de septiembre de 2026 con el sistema «Arco» (docs/DISENO.md):
 * - el Modal del sistema: role=dialog, foco atrapado, Escape, portal al final
 *   de <body>; en móvil sube desde abajo. «Agregar documento» y «¿Borrar esta
 *   nota?» son Modales apilados encima: sólo el de arriba atiende Escape;
 * - cabecera con foto, nombre y estado; a la derecha, pestañas: Resumen ·
 *   Evaluación · Trayectoria · Documentos. Evaluación (sólo para quien ve
 *   calificaciones o notas) va segunda: es lo que viene a ver la empresa y
 *   donde trabajan reclutador y especialista, y así en móvil nunca queda
 *   cortada por el borde;
 * - desde 1024 px, a la izquierda una columna con el contacto, los datos y los
 *   enlaces, siempre a la vista. Por debajo esa columna ocupaba la primera
 *   pantalla entera y empujaba las pestañas a la segunda (QA b9, 390 px): ahí
 *   se resume en una franja (correo · teléfono · CV · LinkedIn) y el resto se
 *   pliega en un <details> que adelanta ubicación y edad;
 * - la barra de pestañas se queda fija arriba del cuerpo al desplazarse.
 *
 * La LÓGICA es la de antes: mismas llamadas con los mismos cuerpos, mismos
 * permisos por rol, mismos reinicios al cambiar de candidato. Sólo cambió cómo
 * se ve.
 */

import { useState, useRef, useEffect, useId, type ReactNode } from 'react';
import { normalizeUrl } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { fechaCorta, fechaHora } from '@/lib/fechas';
import CandidatePhoto from '@/components/shared/CandidatePhoto'; // FEAT-2: Foto de perfil
import DistanceBadge from '@/components/shared/DistanceBadge';
import Modal from '@/components/ui/Modal';
import Tabs, { PanelPestana, type Pestana } from '@/components/ui/Tabs';
import Button, { ButtonLink, clasesBoton } from '@/components/ui/Button';
import Aviso from '@/components/ui/Aviso';
import Dato, { Seccion } from '@/components/ui/Dato';
import IconButton from '@/components/ui/IconButton';
import SelectorArchivo from '@/components/ui/SelectorArchivo';
import StatusBadge, { Badge, tieneEtiquetaEnContexto, type TonoBadge } from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import FormField, { Input, Textarea, Checkbox } from '@/components/ui/FormField';
import Skeleton from '@/components/ui/Skeleton';
import {
  Mail,
  Phone,
  MapPin,
  CalendarCheck,
  Cake,
  Briefcase,
  GraduationCap,
  Link as LinkIcon,
  Linkedin,
  FileText,
  User,
  Clock,
  Building,
  Download,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Plus,
  Save,
  ClipboardList,
  Star,
  Signal,
  Layers,
  Compass,
  Eye,
  EyeOff,
  Lock,
  Pencil,
  Trash2,
  X,
  Paperclip,
  FolderOpen,
  AlertCircle,
  CheckCircle2,
  type LucideIcon
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
 * Límite real de /api/upload (#PERF-028): las funciones de Vercel rechazan
 * cuerpos de más de 4.5 MB antes de llegar al handler.
 */
const MAX_ADJUNTO_BYTES = 4 * 1024 * 1024;
const MAX_ADJUNTO_LABEL = '4MB';

/**
 * Tono del badge de estatus de educación (#PERF-012).
 *
 * Hay DOS vocabularios en producción: el del registro
 * (Cursando/Terminado/Trunco/Titulado) y el de /profile
 * (Completa/En curso/Trunca). El mapa anterior sólo conocía el primero, así que
 * todo lo guardado desde el perfil salía gris ante empresa y reclutador.
 * Mientras no se unifiquen con una migración de datos, aquí se reconocen ambos.
 * El texto del estatus siempre se escribe: el tono sólo lo acompaña.
 */
const COLOR_ESTATUS_EDUCACION: Record<string, TonoBadge> = {
  Titulado: 'exito',
  Completa: 'exito',
  Terminado: 'info',
  Cursando: 'aviso',
  'En curso': 'aviso',
  Trunco: 'neutro',
  Trunca: 'neutro'
};

/**
 * Etiquetas de estado que ya usaba la ficha. Un estado que no está aquí
 * (company_interested, accepted…) sale con la etiqueta del sistema de diseño
 * (antes salía el nombre crudo: «accepted»).
 */
const ETIQUETA_ESTADO: Record<string, string> = {
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


/** Columnas de la tabla de calificaciones: habilidad · estrellas · comentario. */
const COLUMNAS_HABILIDADES = 'sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,15rem)]';

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

  // Presentación: pestaña visible y nota pendiente de confirmar su borrado
  // (la confirmación era un confirm() del navegador; ahora es un Modal).
  const [pestana, setPestana] = useState('resumen');
  const [notaABorrar, setNotaABorrar] = useState<EvaluationNote | null>(null);
  const idFicha = `ficha${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

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
    // Y la confirmación de borrado, si hubiera una abierta.
    setNotaABorrar(null);
    if (noteFileRef.current) noteFileRef.current.value = '';
  }, [isOpen, application?.id, candidate?.id]);

  // Cada vez que se abre, la ficha empieza por el resumen (se reinicia al
  // CERRAR, así no asoma un instante la pestaña de la vez anterior). Al pasar
  // al siguiente candidato se queda en la que se estaba viendo: quien evalúa
  // uno tras otro sigue en «Evaluación».
  useEffect(() => {
    if (!isOpen) setPestana('resumen');
  }, [isOpen]);

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

  // A11y (#59) y #PERF-035: Escape lo atiende el Modal del sistema, y SÓLO la
  // capa de arriba. Con «Agregar documento» abierto, Escape cancela ese
  // sub-modal (su alCerrar es cancelarDocumento, que limpia nombre, archivo y
  // error) y la ficha sigue abierta; sin sub-modal, Escape cierra la ficha.
  // Por eso ya no hay aquí un oyente de teclado propio: habría cerrado dos
  // veces.

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

  // Se llama DESPUÉS de confirmar en el Modal «¿Borrar esta nota?» (antes, un
  // confirm() del navegador con el mismo texto). Lo que hace es lo de siempre.
  const borrarNota = async (note: EvaluationNote) => {
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

  /** «Borrar nota» en la confirmación: se cierra y se borra, como tras el confirm(). */
  const confirmarBorrado = () => {
    const nota = notaABorrar;
    setNotaABorrar(null);
    if (nota) borrarNota(nota);
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
  // Fecha corta del panel (src/lib/fechas): «23 sep 2026».
  const formatDate = (dateString: string) => fechaCorta(dateString);

  const formatExperienceDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'short',
      timeZone: 'UTC'
    });
  };

  // Estado con color Y texto: el vocabulario de siempre de la ficha y, para
  // los estados que no conocía, el del sistema. La empresa, el suyo: el
  // contexto «empresa» de StatusBadge, el MISMO que su lista de candidatos
  // (la ficha le decía «Enviado a empresa» a quien la lista llamaba «Por
  // revisar», QA b9).
  const getStatusBadge = (status: string) =>
    userRole === 'company' && tieneEtiquetaEnContexto(status, 'empresa') ? (
      <StatusBadge estado={status} contexto="empresa" />
    ) : (
      <StatusBadge estado={status} etiqueta={ETIQUETA_ESTADO[status]} />
    );

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

  // Cancelar «Agregar documento» (botón Cancelar, la X y Escape): el sub-modal
  // se cierra y no deja nada a medias para el siguiente candidato (#PERF-035).
  const cancelarDocumento = () => {
    setShowAddDocModal(false);
    setNewDocName('');
    setNewDocFile(null);
    setDocError('');
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

  // ---------------------------------------------------------------------
  // Presentación: qué se pinta y en qué pestaña. Las condiciones de cada
  // bloque son las de siempre (permisos por rol incluidos).
  // ---------------------------------------------------------------------
  const edad = calculateAge(data.fechaNacimiento);
  const ubicacion = getLocation();
  const experiencias = data.experiences || [];
  const documentos = data.documents || [];

  const verCalificaciones = canViewSkillRatings && parsedHabilidades.length > 0 && !!application?.id;
  const verNotasReclutador = showRecruiterNotes && !!recruiterNotes;
  const verNotasEvaluacion = canViewEvaluationNotes && !!application?.id;
  const verNotasInternas = puedeVerNotasInternas && (!!data.adminNotas || !!data.notes);
  const hayEvaluacion = verCalificaciones || verNotasReclutador || verNotasEvaluacion || verNotasInternas;

  // Evaluación, segunda: a 390 px las cuatro pestañas no caben, y la que se
  // cortaba por el borde era justo la que la empresa viene a ver.
  const pestanas: Pestana[] = [
    { id: 'resumen', etiqueta: 'Resumen' },
    ...(hayEvaluacion
      ? [{
          id: 'evaluacion',
          etiqueta: 'Evaluación',
          contador: verNotasEvaluacion && !loadingNotes ? evaluationNotes.length : undefined
        }]
      : []),
    { id: 'trayectoria', etiqueta: 'Trayectoria' },
    { id: 'documentos', etiqueta: 'Documentos', contador: documentos.length }
  ];
  // Si el candidato siguiente no tiene la pestaña que se veía, al resumen.
  const activa = pestanas.some((p) => p.id === pestana) ? pestana : 'resumen';

  const perfilProfesional = [
    data.añosExperiencia != null && {
      icono: Briefcase,
      termino: 'Años de experiencia',
      valor: `${data.añosExperiencia} ${data.añosExperiencia === 1 ? 'año' : 'años'}`
    },
    data.seniority && { icono: Signal, termino: 'Nivel de experiencia', valor: getSeniorityLabel(data.seniority) },
    data.profile && { icono: Layers, termino: 'Área de especialidad', valor: data.profile },
    data.subcategory && { icono: Layers, termino: 'Subespecialidad', valor: data.subcategory },
    data.source && { icono: Compass, termino: 'Fuente', valor: getSourceLabel(data.source) }
  ].filter(Boolean) as Array<{ icono: LucideIcon; termino: string; valor: string }>;

  const hayEnlaces = Boolean(data.cvUrl || data.linkedinUrl || data.portafolioUrl);
  const hayNavegacion = Boolean(onPrev || onNext);
  const hayDatos = Boolean(data.appliedAt || edad || data.sexo);

  // Bajo 1024 px: lo que se pliega (ubicación y datos) y la línea que lo
  // adelanta en el <summary>, para no tener que abrirlo para lo esencial.
  const hayPlegable = Boolean(ubicacion || hayDatos);
  const avanceDatos = [ubicacion, edad ? `${edad} años` : null].filter(Boolean).join(' · ');

  // Lo mismo se pinta en la columna (escritorio) y en el plegable (móvil):
  // un solo sitio para cada dato.
  const contenidoUbicacion = (
    <>
      <span className="block">{ubicacion}</span>
      {data.ubicacionCercana && (
        <span className="mt-0.5 block text-[13px] text-ink-muted">{data.ubicacionCercana}</span>
      )}
      <div className="mt-1.5 empty:hidden">
        <DistanceBadge
          candidateLat={data.latitude}
          candidateLng={data.longitude}
          jobLat={jobLatitude}
          jobLng={jobLongitude}
        />
      </div>
    </>
  );

  const datosPersonales = (
    <>
      {data.appliedAt && (
        <Dato icono={CalendarCheck} termino="Fecha de postulación" className="col-span-2 sm:col-span-1">
          {formatDate(data.appliedAt)}
        </Dato>
      )}
      {edad ? (
        <Dato icono={Cake} termino="Edad">
          <span className="tabular-nums">{edad}</span> años
        </Dato>
      ) : null}
      {data.sexo && (
        <Dato icono={User} termino="Sexo">
          {getSexoLabel(data.sexo)}
        </Dato>
      )}
    </>
  );

  return (
    <>
      <Modal
        abierto={isOpen}
        alCerrar={onClose}
        tamano="xl"
        iconoTitulo={
          <CandidatePhoto fotoUrl={data.fotoUrl} candidateName={data.name} size="md" decorativa />
        }
        titulo={
          <>
            <span className="sr-only">Perfil de </span>
            {data.name}
          </>
        }
        subtitulo={
          // Modal pinta la foto fuera del <h2>, en su propia columna: las
          // insignias arrancan solas bajo el nombre.
          <span className="flex flex-wrap items-center gap-1.5">
            {getStatusBadge(data.status)}
            {data.seniority && (
              <Badge tono="neutro" sinPunto>
                {getSeniorityLabel(data.seniority)}
              </Badge>
            )}
            {data.profile && (
              <Badge tono="info" sinPunto>
                {data.profile}
              </Badge>
            )}
          </span>
        }
        pie={
          <div className="flex w-full items-center justify-between gap-3">
            {hayNavegacion ? (
              <div role="group" aria-label="Navegar entre candidatos" className="flex items-center gap-1.5">
                <Button
                  variante="contorno"
                  tamano="sm"
                  icono={ChevronLeft}
                  onClick={onPrev}
                  disabled={!onPrev || currentIndex === 0}
                >
                  <span className="sr-only sm:not-sr-only">Anterior</span>
                </Button>
                {currentIndex !== undefined && totalCount !== undefined && (
                  <span
                    aria-live="polite"
                    className="min-w-[4.5rem] text-center font-display text-sm font-medium tabular-nums text-ink-muted"
                  >
                    <span className="sr-only">Candidato </span>
                    {currentIndex + 1} de {totalCount}
                  </span>
                )}
                <Button
                  variante="contorno"
                  tamano="sm"
                  iconoFinal={ChevronRight}
                  onClick={onNext}
                  disabled={!onNext || (currentIndex !== undefined && totalCount !== undefined && currentIndex >= totalCount - 1)}
                >
                  <span className="sr-only sm:not-sr-only">Siguiente</span>
                </Button>
              </div>
            ) : (
              <span aria-hidden="true" />
            )}
            <Button variante="contorno" onClick={onClose}>
              Cerrar
            </Button>
          </div>
        }
      >
        <div className="grid gap-5 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-7">
          {/* Bajo 1024 px: el contacto en una franja y el resto plegado, así
              las pestañas entran en la primera pantalla (QA b9, 390 px). */}
          <div className="min-w-0 rounded-xl border border-line bg-paper/70 lg:hidden">
            <ul aria-label="Contacto y enlaces" className="flex flex-wrap gap-2 p-3">
              <li className="min-w-0 max-w-full">
                <a href={`mailto:${data.email}`} className={cn(clasesBoton({ variante: 'contorno', tamano: 'sm' }), 'max-w-full')}>
                  <Mail aria-hidden="true" />
                  <span className="sr-only">Correo: </span>
                  <span className="min-w-0 truncate">{data.email}</span>
                </a>
              </li>
              {data.phone && (
                <li>
                  <a href={`tel:${data.phone}`} className={clasesBoton({ variante: 'contorno', tamano: 'sm' })}>
                    <Phone aria-hidden="true" />
                    <span className="sr-only">Teléfono: </span>
                    <span className="tabular-nums">{data.phone}</span>
                  </a>
                </li>
              )}
              {data.cvUrl && (
                <li>
                  <ButtonLink externo href={ensureUrl(data.cvUrl)} icono={FileText} variante="secundario" tamano="sm">
                    Ver CV
                  </ButtonLink>
                </li>
              )}
              {data.linkedinUrl && (
                <li>
                  <ButtonLink externo href={ensureUrl(data.linkedinUrl)} icono={Linkedin} variante="contorno" tamano="sm">
                    LinkedIn
                  </ButtonLink>
                </li>
              )}
              {data.portafolioUrl && (
                <li>
                  <ButtonLink externo href={ensureUrl(data.portafolioUrl)} icono={LinkIcon} variante="contorno" tamano="sm">
                    Portafolio
                  </ButtonLink>
                </li>
              )}
            </ul>

            {hayPlegable && (
              <details className="group border-t border-line">
                <summary className="flex min-h-[44px] cursor-pointer list-none items-center gap-2.5 rounded-b-xl px-3.5 py-2 hover:bg-ink/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-teal group-open:rounded-none [&::-webkit-details-marker]:hidden">
                  <span className="flex-none font-display text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
                    Datos
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-ink">
                    {avanceDatos ||
                      (data.appliedAt ? `Postuló el ${formatDate(data.appliedAt)}` : getSexoLabel(data.sexo ?? undefined))}
                  </span>
                  {/* Avance visual; para el lector, la distancia completa va dentro. */}
                  <span aria-hidden="true" className="flex-none empty:hidden">
                    <DistanceBadge
                      compact
                      candidateLat={data.latitude}
                      candidateLng={data.longitude}
                      jobLat={jobLatitude}
                      jobLng={jobLongitude}
                    />
                  </span>
                  <ChevronDown
                    aria-hidden="true"
                    className="h-4 w-4 flex-none text-ink-muted transition-transform duration-150 group-open:rotate-180"
                  />
                </summary>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line px-3.5 py-3.5 sm:grid-cols-3">
                  {ubicacion && (
                    <Dato icono={MapPin} termino="Ubicación" className="col-span-full">
                      {contenidoUbicacion}
                    </Dato>
                  )}
                  {datosPersonales}
                </dl>
              </details>
            )}
          </div>

          {/* Desde 1024 px: contacto, datos y enlaces en su columna, a la
              vista en todas las pestañas. */}
          <div className="hidden gap-5 self-start rounded-xl border border-line bg-paper/70 p-4 lg:grid">
            <BloqueLateral titulo="Contacto">
              <dl className="space-y-3">
                <Dato icono={Mail} termino="Correo">
                  <a href={`mailto:${data.email}`} className="break-all font-medium text-teal hover:underline">
                    {data.email}
                  </a>
                </Dato>
                {data.phone && (
                  <Dato icono={Phone} termino="Teléfono">
                    <a href={`tel:${data.phone}`} className="font-medium tabular-nums text-teal hover:underline">
                      {data.phone}
                    </a>
                  </Dato>
                )}
                {ubicacion && (
                  <Dato icono={MapPin} termino="Ubicación">
                    {contenidoUbicacion}
                  </Dato>
                )}
              </dl>
            </BloqueLateral>

            {hayDatos && (
              <BloqueLateral titulo="Datos">
                <dl className="space-y-3">{datosPersonales}</dl>
              </BloqueLateral>
            )}

            {hayEnlaces && (
              <BloqueLateral titulo="Enlaces">
                <div className="flex flex-col gap-2">
                  {data.cvUrl && (
                    <ButtonLink externo href={ensureUrl(data.cvUrl)} icono={FileText} variante="secundario" tamano="sm" className="w-full justify-start">
                      <span className="min-w-0 flex-1 truncate text-left">Ver CV</span>
                    </ButtonLink>
                  )}
                  {data.linkedinUrl && (
                    <ButtonLink externo href={ensureUrl(data.linkedinUrl)} icono={Linkedin} variante="contorno" tamano="sm" className="w-full justify-start">
                      <span className="min-w-0 flex-1 truncate text-left">LinkedIn</span>
                    </ButtonLink>
                  )}
                  {data.portafolioUrl && (
                    <ButtonLink externo href={ensureUrl(data.portafolioUrl)} icono={LinkIcon} variante="contorno" tamano="sm" className="w-full justify-start">
                      <span className="min-w-0 flex-1 truncate text-left">Portafolio</span>
                    </ButtonLink>
                  )}
                </div>
              </BloqueLateral>
            )}
          </div>

          {/* Pestañas. La barra se queda fija arriba del cuerpo del modal al
              desplazarse por la ficha. Bajo 1024 px va de borde a borde: si
              no caben las cuatro, la última se corta contra el borde de la
              pantalla y se entiende que se desliza. */}
          <div className="min-w-0">
            <div className="sticky top-0 z-10 bg-white">
              <Tabs
                idBase={idFicha}
                etiqueta="Secciones de la ficha"
                pestanas={pestanas}
                activa={activa}
                alCambiar={setPestana}
                className="-mx-5 scroll-px-5 px-5 sm:-mx-6 sm:scroll-px-6 sm:px-6 lg:mx-0 lg:scroll-px-0 lg:px-0"
              />
            </div>

            {/* ---------------- Resumen ---------------- */}
            <PanelPestana idBase={idFicha} id="resumen" activa={activa}>
              <div className="space-y-7">
                {perfilProfesional.length > 0 && (
                  <Seccion titulo="Perfil profesional">
                    <dl className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                      {perfilProfesional.map(({ icono: Icono, termino, valor }) => (
                        <div key={termino} className="rounded-lg border border-line px-3 py-2.5">
                          <dt className="flex items-center gap-1.5 text-xs text-ink-muted">
                            <Icono className="h-3.5 w-3.5 flex-none" aria-hidden="true" />
                            {termino}
                          </dt>
                          <dd className="mt-1 font-display text-[15px] font-semibold leading-snug text-ink">{valor}</dd>
                        </div>
                      ))}
                    </dl>
                  </Seccion>
                )}

                {/* Carta de presentación del perfil del candidato */}
                {data.cartaPresentacion && (
                  <Seccion titulo="Carta de presentación" remate="en sus palabras">
                    <Carta texto={data.cartaPresentacion} />
                  </Seccion>
                )}

                {/* Carta que acompañó a la postulación */}
                {data.coverLetter && (
                  <Seccion titulo="Carta de la postulación">
                    <Carta texto={data.coverLetter} />
                  </Seccion>
                )}

                {perfilProfesional.length === 0 && !data.cartaPresentacion && !data.coverLetter && (
                  <EmptyState
                    compacto
                    frase="Poco que contar por ahora."
                    titulo="Sin resumen profesional"
                    descripcion="El perfil todavía no tiene años de experiencia, especialidad ni carta de presentación."
                  />
                )}
              </div>
            </PanelPestana>

            {/* ---------------- Trayectoria ---------------- */}
            <PanelPestana idBase={idFicha} id="trayectoria" activa={activa}>
              {experiencias.length === 0 && educaciones.length === 0 ? (
                <EmptyState
                  compacto
                  frase="Todavía no hay trayectoria que mostrar."
                  titulo="Sin experiencia ni estudios registrados"
                />
              ) : (
                <div className="space-y-8">
                  <Seccion titulo="Experiencia laboral" contador={experiencias.length}>
                    {experiencias.length > 0 ? (
                      // Línea de tiempo: cada puesto es un punto sobre la línea
                      // (el punto y el puente del isotipo); el actual, en lima.
                      <ol className="ml-1 space-y-5 border-l-2 border-line pl-6">
                        {experiencias.map((exp, index) => (
                          <li key={exp.id || index} className="relative">
                            <span
                              aria-hidden="true"
                              className={cn(
                                'absolute -left-[31px] top-1.5 h-3 w-3 rounded-full ring-4 ring-white',
                                exp.esActual ? 'bg-lime' : 'bg-teal'
                              )}
                            />
                            <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                              <h4 className="font-display text-[15px] font-semibold leading-snug text-ink">{exp.puesto}</h4>
                              {exp.esActual && (
                                <Badge tono="exito" tamano="sm">
                                  Actual
                                </Badge>
                              )}
                            </div>
                            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-ink-muted">
                              <span className="inline-flex items-center gap-1.5">
                                <Building className="h-3.5 w-3.5 flex-none" aria-hidden="true" />
                                {exp.empresa}
                              </span>
                              {exp.ubicacion && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="inline-flex items-center gap-1.5">
                                    <MapPin className="h-3.5 w-3.5 flex-none" aria-hidden="true" />
                                    {exp.ubicacion}
                                  </span>
                                </>
                              )}
                            </p>
                            <p className="mt-1 flex items-center gap-1.5 text-[13px] tabular-nums text-ink-muted">
                              <Clock className="h-3.5 w-3.5 flex-none" aria-hidden="true" />
                              {formatExperienceDate(exp.fechaInicio)} – {exp.esActual ? 'Presente' : exp.fechaFin ? formatExperienceDate(exp.fechaFin) : 'N/A'}
                            </p>
                            {exp.descripcion && (
                              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink">{exp.descripcion}</p>
                            )}
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className="text-sm text-ink-muted">Sin experiencia laboral registrada.</p>
                    )}
                  </Seccion>

                  {/* FEATURE: Educación múltiple */}
                  <Seccion titulo="Educación" contador={educaciones.length}>
                    {educaciones.length > 0 ? (
                      <ul className="grid gap-3 md:grid-cols-2">
                        {educaciones.map((edu, index) => (
                          <li key={edu.id || index} className="flex gap-3 rounded-xl border border-line p-4">
                            <span
                              aria-hidden="true"
                              className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-teal-tint text-teal"
                            >
                              <GraduationCap className="h-[18px] w-[18px]" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <h4 className="min-w-0 font-display text-[15px] font-semibold leading-snug text-ink">
                                  {edu.carrera || 'Sin carrera'}
                                </h4>
                                {edu.estatus && (
                                  <Badge tono={COLOR_ESTATUS_EDUCACION[edu.estatus] || 'neutro'} tamano="sm">
                                    {edu.estatus}
                                  </Badge>
                                )}
                              </div>
                              <p className="mt-0.5 text-sm text-ink-muted">{edu.institucion || 'Sin institución'}</p>
                              {(edu.nivel || edu.añoInicio || edu.añoFin) && (
                                <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[13px] tabular-nums text-ink-muted">
                                  {edu.nivel && <span className="font-medium text-ink">{edu.nivel}</span>}
                                  {(edu.añoInicio || edu.añoFin) && (
                                    <>
                                      {edu.nivel && <span aria-hidden="true">·</span>}
                                      <span>
                                        {edu.añoInicio || '?'} – {edu.añoFin || 'Presente'}
                                      </span>
                                    </>
                                  )}
                                </p>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-ink-muted">Sin estudios registrados.</p>
                    )}
                  </Seccion>
                </div>
              )}
            </PanelPestana>

            {/* ---------------- Documentos ---------------- */}
            <PanelPestana idBase={idFicha} id="documentos" activa={activa}>
              {(documentos.length > 0 || (canAddDocuments && candidateId)) && (
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-ink-muted">
                    <span className="font-display font-semibold tabular-nums text-ink">{documentos.length}</span>{' '}
                    {documentos.length === 1 ? 'documento' : 'documentos'}
                  </p>
                  {canAddDocuments && candidateId && (
                    <Button variante="contorno" tamano="sm" icono={Plus} onClick={() => setShowAddDocModal(true)}>
                      Agregar documento
                    </Button>
                  )}
                </div>
              )}
              {documentos.length > 0 ? (
                <ul className="grid gap-2.5 sm:grid-cols-2">
                  {documentos.map((doc, index) => (
                    <li key={doc.id || index}>
                      <a
                        href={doc.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex items-center gap-3 rounded-xl border border-line bg-white p-3 transition-colors duration-150 hover:border-teal hover:bg-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
                      >
                        <span
                          aria-hidden="true"
                          className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-teal-tint text-teal"
                        >
                          <FileText className="h-5 w-5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-ink">{doc.name}</span>
                          {doc.fileType && (
                            <span className="block truncate text-xs uppercase tracking-wide text-ink-muted">{doc.fileType}</span>
                          )}
                        </span>
                        <Download
                          className="h-4 w-4 flex-none text-ink-muted transition-colors duration-150 group-hover:text-teal"
                          aria-hidden="true"
                        />
                        <span className="sr-only"> (se abre en una pestaña nueva)</span>
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  compacto
                  icono={FolderOpen}
                  titulo="No hay documentos"
                  descripcion={
                    canAddDocuments && candidateId
                      ? 'Pulsa «Agregar documento» para subir el primero.'
                      : 'Todavía no se ha subido ningún documento a este expediente.'
                  }
                />
              )}
            </PanelPestana>

            {/* ---------------- Evaluación ---------------- */}
            {hayEvaluacion && (
              <PanelPestana idBase={idFicha} id="evaluacion" activa={activa}>
                <div className="space-y-8">
                  {/* Evaluación de Habilidades */}
                  {canViewSkillRatings && parsedHabilidades.length > 0 && application?.id && (
                    <Seccion
                      titulo="Evaluación de habilidades"
                      descripcion={
                        canEditSkillRatings
                          ? 'Califica de 1 a 5 las habilidades que pide la vacante.'
                          : 'Calificaciones del especialista'
                      }
                    >
                      <div className="overflow-hidden rounded-xl border border-line">
                        <div
                          aria-hidden="true"
                          className={cn(
                            'hidden gap-4 border-b border-line bg-paper px-4 py-2 font-display text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted sm:grid',
                            COLUMNAS_HABILIDADES
                          )}
                        >
                          <span>Habilidad</span>
                          <span>Calificación</span>
                          <span>Comentario</span>
                        </div>
                        <ul className="divide-y divide-line">
                          {parsedHabilidades.map((skill, indice) => {
                            const currentRating = skillRatings[skill]?.rating || 0;
                            const currentComment = skillRatings[skill]?.comment || '';
                            const savedRating = savedSkillRatings.find(r => r.skillName === skill);
                            const idComentario = `${idFicha}-comentario-${indice}`;

                            return (
                              <li
                                key={skill}
                                className={cn('grid gap-2 px-4 py-3 sm:items-center sm:gap-4', COLUMNAS_HABILIDADES)}
                              >
                                <p className="min-w-0 text-sm font-medium text-ink">{skill}</p>

                                {canEditSkillRatings ? (
                                  <div role="group" aria-label={`Calificación de ${skill}`} className="flex items-center">
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
                                        className="inline-flex h-8 w-7 items-center justify-center rounded-md transition-transform duration-150 hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-teal"
                                      >
                                        <Star
                                          aria-hidden="true"
                                          strokeWidth={1.75}
                                          className={cn(
                                            'h-5 w-5',
                                            star <= currentRating ? 'fill-orange text-orange-dark' : 'fill-transparent text-line-strong'
                                          )}
                                        />
                                      </button>
                                    ))}
                                    <span
                                      aria-hidden="true"
                                      className="ml-1.5 w-8 font-display text-[13px] tabular-nums text-ink-muted"
                                    >
                                      {currentRating ? `${currentRating}/5` : '–'}
                                    </span>
                                  </div>
                                ) : (
                                  <EstrellasLectura valor={currentRating} />
                                )}

                                {canEditSkillRatings ? (
                                  <div className="min-w-0">
                                    {/* Etiqueta visible en móvil; en escritorio la da la cabecera «Comentario». */}
                                    <label
                                      htmlFor={idComentario}
                                      className="mb-1 block text-xs font-medium text-ink-muted sm:sr-only"
                                    >
                                      Comentario sobre {skill}
                                    </label>
                                    <Input
                                      id={idComentario}
                                      type="text"
                                      value={currentComment}
                                      onChange={(e) => {
                                        setSkillRatings(prev => ({
                                          ...prev,
                                          [skill]: { ...prev[skill], rating: prev[skill]?.rating || 0, comment: e.target.value }
                                        }));
                                      }}
                                      placeholder="Comentario (opcional)"
                                      className="h-9"
                                    />
                                  </div>
                                ) : (
                                  <div className="min-w-0 text-[13px]">
                                    {savedRating?.comment && <p className="text-ink">{savedRating.comment}</p>}
                                    {savedRating && (
                                      <p className="mt-0.5 text-xs text-ink-muted">por {savedRating.ratedBy.nombre}</p>
                                    )}
                                  </div>
                                )}
                              </li>
                            );
                          })}
                        </ul>

                        {canEditSkillRatings && (
                          <div className="flex flex-col-reverse gap-2 border-t border-line bg-paper/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                            {/* #PERF-014/#PERF-015: confirmación y error visibles */}
                            <div className="min-w-0 text-sm">
                              {ratingsError && (
                                <p role="alert" className="flex items-start gap-1.5 font-medium text-danger">
                                  <AlertCircle className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
                                  {ratingsError}
                                </p>
                              )}
                              {ratingsSaved && !ratingsError && (
                                <p role="status" className="flex items-center gap-1.5 font-medium text-lime-dark">
                                  <CheckCircle2 className="h-4 w-4 flex-none" aria-hidden="true" />
                                  Calificaciones guardadas
                                </p>
                              )}
                            </div>
                            <Button
                              icono={Save}
                              onClick={handleSaveSkillRatings}
                              disabled={savingSkillRatings || Object.values(skillRatings).every(v => v.rating === 0)}
                              cargando={savingSkillRatings}
                              textoCargando="Guardando…"
                              className="sm:flex-none"
                            >
                              Guardar calificaciones
                            </Button>
                          </div>
                        )}

                        {!canEditSkillRatings && skillRatingsLoaded && savedSkillRatings.length === 0 && (
                          <p className="border-t border-line px-4 py-3 text-center text-sm text-ink-muted">
                            Aún no se han calificado las habilidades.
                          </p>
                        )}
                      </div>
                    </Seccion>
                  )}

                  {/* Notas del reclutador sobre la vacante (sólo especialista) - JobAssignment */}
                  {showRecruiterNotes && recruiterNotes && (
                    <Seccion titulo="Notas del reclutador" descripcion="Sobre la vacante, para quien evalúa">
                      <div className="rounded-xl border border-line bg-paper/70 px-4 py-3.5">
                        <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{recruiterNotes}</p>
                      </div>
                    </Seccion>
                  )}

                  {/* FEAT-5: Sección de Notas de Evaluación */}
                  {canViewEvaluationNotes && application?.id && (
                    <Seccion titulo="Notas de evaluación" contador={loadingNotes ? undefined : evaluationNotes.length}>
                      {/* Notas existentes */}
                      {loadingNotes ? (
                        <div role="status" className="space-y-2.5">
                          <span className="sr-only">Cargando notas…</span>
                          {[0, 1].map((i) => (
                            <div key={i} className="rounded-xl border border-line p-4">
                              <Skeleton className="h-3.5 w-40" />
                              <Skeleton className="mt-3 h-3.5 w-full" />
                              <Skeleton className="mt-2 h-3.5 w-2/3" />
                            </div>
                          ))}
                        </div>
                      ) : evaluationNotes.length > 0 ? (
                        <ul className="space-y-3">
                          {evaluationNotes.map((note) => (
                            <li key={note.id} className="rounded-xl border border-line bg-white p-4">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <Badge tono={note.authorRole === 'recruiter' ? 'info' : 'marca'} sinPunto tamano="sm">
                                    {note.authorRole === 'recruiter' ? 'Reclutador' : 'Especialista'}
                                  </Badge>
                                  {userRole !== 'company' && (
                                    note.isPublic ? (
                                      <Badge tono="exito" icono={Eye} tamano="sm">
                                        Visible para la empresa
                                      </Badge>
                                    ) : (
                                      <Badge tono="neutro" icono={Lock} tamano="sm">
                                        Solo INAKAT
                                      </Badge>
                                    )
                                  )}
                                </div>
                                <time dateTime={note.createdAt} className="text-xs tabular-nums text-ink-muted">
                                  {fechaHora(note.createdAt)}
                                </time>
                              </div>

                              {editingNoteId === note.id ? (
                                <div className="mt-3 space-y-2.5">
                                  <FormField etiqueta="Editar nota">
                                    <Textarea
                                      value={editingNoteContent}
                                      onChange={(e) => setEditingNoteContent(e.target.value)}
                                      rows={3}
                                      maxLength={5000}
                                    />
                                  </FormField>
                                  <div className="flex flex-wrap gap-2">
                                    <Button
                                      variante="secundario"
                                      tamano="sm"
                                      onClick={() => actualizarNota(note, { content: editingNoteContent.trim() })}
                                      disabled={noteActionId === note.id || !editingNoteContent.trim()}
                                    >
                                      Guardar cambios
                                    </Button>
                                    <Button variante="contorno" tamano="sm" onClick={() => setEditingNoteId(null)}>
                                      Cancelar
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <p className="mt-2.5 whitespace-pre-wrap text-sm leading-relaxed text-ink">{note.content}</p>
                              )}

                              {note.documentUrl && (
                                <a
                                  href={note.documentUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="mt-2.5 inline-flex max-w-full items-center gap-1.5 rounded-lg border border-line bg-paper px-2.5 py-1.5 text-[13px] font-medium text-teal transition-colors duration-150 hover:border-teal hover:text-teal-dark"
                                >
                                  <Paperclip className="h-3.5 w-3.5 flex-none" aria-hidden="true" />
                                  <span className="truncate">{note.documentName || 'Documento adjunto'}</span>
                                  <span className="sr-only"> (se abre en una pestaña nueva)</span>
                                </a>
                              )}

                              {note.canEdit && userRole !== 'company' && editingNoteId !== note.id && (
                                <div className="-mb-1 -ml-2 mt-2 flex flex-wrap gap-1">
                                  <Button
                                    variante="fantasma"
                                    tamano="sm"
                                    icono={note.isPublic ? EyeOff : Eye}
                                    onClick={() => actualizarNota(note, { isPublic: !note.isPublic })}
                                    disabled={noteActionId === note.id}
                                  >
                                    {note.isPublic ? 'Ocultar a la empresa' : 'Hacer visible a la empresa'}
                                  </Button>
                                  <Button
                                    variante="fantasma"
                                    tamano="sm"
                                    icono={Pencil}
                                    onClick={() => {
                                      setEditingNoteId(note.id);
                                      setEditingNoteContent(note.content);
                                    }}
                                    disabled={noteActionId === note.id}
                                  >
                                    Editar
                                  </Button>
                                  <Button
                                    variante="fantasma"
                                    tamano="sm"
                                    icono={Trash2}
                                    onClick={() => setNotaABorrar(note)}
                                    disabled={noteActionId === note.id}
                                    className="text-danger hover:bg-danger-tint"
                                  >
                                    Borrar
                                  </Button>
                                </div>
                              )}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <EmptyState
                          compacto
                          icono={ClipboardList}
                          titulo="No hay notas de evaluación aún"
                          descripcion={canAddEvaluationNotes ? 'Escribe la primera en el recuadro de abajo.' : undefined}
                        />
                      )}
                      {noteActionError && (
                        <Aviso compacto className="mt-3">{noteActionError}</Aviso>
                      )}

                      {/* Formulario para nueva nota (solo recruiter/specialist) */}
                      {canAddEvaluationNotes && (
                        <div className="mt-4 space-y-3.5 rounded-xl border border-line bg-paper/70 p-4">
                          {/* #PERF-014/#PERF-015: antes cualquier fallo sólo iba a la
                              consola y el spinner desaparecía sin decir nada. */}
                          {noteError && (
                            <Aviso compacto>{noteError}</Aviso>
                          )}
                          <FormField etiqueta="Nueva nota">
                            <Textarea
                              value={newNoteContent}
                              onChange={(e) => setNewNoteContent(e.target.value)}
                              placeholder="Escribe tus observaciones sobre este candidato…"
                              rows={3}
                              className="resize-y bg-white"
                            />
                          </FormField>
                          <Checkbox
                            etiqueta="Visible para la empresa"
                            descripcion={
                              isNotePublic
                                ? 'La empresa podrá leer esta nota.'
                                : 'Sólo la verá el equipo de INAKAT.'
                            }
                            checked={isNotePublic}
                            onChange={(e) => setIsNotePublic(e.target.checked)}
                          />
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex min-w-0 flex-wrap items-center gap-2">
                              {/* El input de archivo va DENTRO de la etiqueta y sólo
                                  oculto a la vista (sr-only): así se alcanza con
                                  el tabulador (antes era display:none). */}
                              <SelectorArchivo
                                ref={noteFileRef}
                                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                                onChange={(e) => setNoteDocument(e.target.files?.[0] || null)}
                              >
                                {noteDocument ? 'Cambiar adjunto' : 'Adjuntar documento'}
                              </SelectorArchivo>
                              {noteDocument ? (
                                <span className="inline-flex min-w-0 max-w-full items-center gap-1 rounded-lg bg-white py-0.5 pl-2.5 pr-0.5 text-[13px] text-ink ring-1 ring-inset ring-line">
                                  <Paperclip className="h-3.5 w-3.5 flex-none text-ink-muted" aria-hidden="true" />
                                  <span className="truncate">{noteDocument.name}</span>
                                  <IconButton
                                    etiqueta="Quitar archivo"
                                    icono={X}
                                    tamano="sm"
                                    variante="peligro"
                                    onClick={() => {
                                      setNoteDocument(null);
                                      if (noteFileRef.current) noteFileRef.current.value = '';
                                    }}
                                  />
                                </span>
                              ) : (
                                <span className="text-[13px] text-ink-muted">Opcional, máx. {MAX_ADJUNTO_LABEL}</span>
                              )}
                            </div>
                            <Button
                              variante="secundario"
                              icono={Save}
                              onClick={handleSaveNote}
                              disabled={!newNoteContent.trim() || savingNote}
                              cargando={savingNote}
                              textoCargando="Guardando…"
                            >
                              Guardar nota
                            </Button>
                          </div>
                        </div>
                      )}
                    </Seccion>
                  )}

                  {/* Notas internas.
                      PRIVACIDAD (#50/#51), defensa en profundidad: `adminNotas`
                      (Candidate.notas) y `notes` (Application.notes) son material
                      interno de INAKAT. Las rutas de empresa ya no los envían, pero
                      este modal los pintaba sin mirar el rol, así que bastaba con que
                      una ruta volviera a incluirlos para reabrir la fuga. */}
                  {verNotasInternas && (
                    <Seccion
                      titulo="Notas internas"
                      insignia={
                        <Badge tono="neutro" icono={Lock} tamano="sm">
                          Solo INAKAT
                        </Badge>
                      }
                    >
                      <div className="space-y-3">
                        {puedeVerNotasInternas && data.adminNotas && (
                          <NotaInterna titulo="Notas del admin" texto={data.adminNotas} />
                        )}
                        {puedeVerNotasInternas && data.notes && (
                          <NotaInterna titulo="Notas de la postulación" texto={data.notes} />
                        )}
                      </div>
                    </Seccion>
                  )}
                </div>
              </PanelPestana>
            )}
          </div>
        </div>
      </Modal>

      {/* Agregar documento: Modal apilado encima de la ficha. Escape y la X
          cancelan sólo este sub-modal (#PERF-035); pulsar el fondo no lo cierra
          (tampoco lo hacía antes) y nada de lo que pase dentro llega a la
          ficha (#PERF-017). */}
      <Modal
        abierto={showAddDocModal}
        alCerrar={cancelarDocumento}
        titulo="Agregar documento"
        subtitulo={
          <>
            Al expediente de <span className="font-medium text-ink">{data.name}</span>
          </>
        }
        tamano="sm"
        cerrarAlPulsarFondo={false}
        pie={
          <>
            <Button variante="contorno" onClick={cancelarDocumento}>
              Cancelar
            </Button>
            <Button
              icono={Save}
              onClick={handleAddDocument}
              disabled={savingDoc || !newDocName.trim() || !newDocFile}
              cargando={savingDoc}
              textoCargando="Guardando…"
            >
              Guardar documento
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {docError && <Aviso compacto>{docError}</Aviso>}

          <FormField etiqueta="Nombre del documento" requerido>
            <Input
              type="text"
              placeholder="Ej: Título universitario, Certificación AWS"
              value={newDocName}
              onChange={(e) => setNewDocName(e.target.value)}
            />
          </FormField>

          <FormField etiqueta="Archivo" requerido ayuda={`PDF, DOC, DOCX, JPG o PNG (máx. ${MAX_ADJUNTO_LABEL})`}>
            <Input
              type="file"
              ref={docInputRef}
              onChange={(e) => setNewDocFile(e.target.files?.[0] || null)}
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              className="h-auto cursor-pointer px-2 py-2 text-ink-muted file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-ink file:px-3 file:py-1.5 file:font-display file:text-[13px] file:font-semibold file:text-white hover:file:bg-teal"
            />
          </FormField>

          {newDocFile && (
            <p className="flex min-w-0 items-center gap-2 rounded-lg bg-paper px-3 py-2 text-sm text-ink">
              <Paperclip className="h-4 w-4 flex-none text-ink-muted" aria-hidden="true" />
              <span className="min-w-0 truncate">
                Archivo seleccionado: <span className="font-medium">{newDocFile.name}</span>
              </span>
            </p>
          )}
        </div>
      </Modal>

      {/* ¿Borrar esta nota? (antes, un confirm() del navegador con este texto). */}
      <Modal
        abierto={notaABorrar !== null}
        alCerrar={() => setNotaABorrar(null)}
        titulo="¿Borrar esta nota?"
        descripcion="No se puede deshacer."
        tamano="sm"
        pie={
          <>
            <Button variante="contorno" onClick={() => setNotaABorrar(null)}>
              Cancelar
            </Button>
            <Button variante="peligro" icono={Trash2} onClick={confirmarBorrado}>
              Borrar nota
            </Button>
          </>
        }
      >
        {notaABorrar && (
          <blockquote className="line-clamp-4 whitespace-pre-wrap rounded-lg border border-line bg-paper px-3.5 py-2.5 text-sm leading-relaxed text-ink">
            {notaABorrar.content}
          </blockquote>
        )}
      </Modal>
    </>
  );
}

// ---------------------------------------------------------------------------
// Piezas de presentación de la ficha
// ---------------------------------------------------------------------------

/** Grupo de la columna de datos: antetítulo pequeño y su contenido. */
function BloqueLateral({ titulo, children, className }: { titulo: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('min-w-0', className)}>
      <h3 className="font-display text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">{titulo}</h3>
      <div className="mt-2.5">{children}</div>
    </div>
  );
}

/** Un texto del candidato (su carta): se respeta su formato y se marca como cita. */
function Carta({ texto }: { texto: string }) {
  return (
    <blockquote className="rounded-r-xl border-l-[3px] border-teal/70 bg-paper/80 px-4 py-3.5">
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{texto}</p>
    </blockquote>
  );
}

/** Nota interna de INAKAT (admin o postulación). */
function NotaInterna({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="rounded-xl border border-dashed border-line-strong/60 bg-paper/70 px-4 py-3.5">
      <h4 className="font-display text-[13px] font-semibold text-ink">{titulo}</h4>
      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink">{texto}</p>
    </div>
  );
}

/** Estrellas de sólo lectura (empresa): la cifra va escrita, no sólo pintada. */
function EstrellasLectura({ valor }: { valor: number }) {
  if (!valor) return <span className="text-[13px] text-ink-muted">Sin calificar</span>;
  return (
    <span className="flex items-center gap-2">
      <span className="flex" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((n) => (
          <Star
            key={n}
            strokeWidth={1.75}
            className={cn('h-4 w-4', n <= valor ? 'fill-orange text-orange-dark' : 'fill-transparent text-line-strong')}
          />
        ))}
      </span>
      <span className="font-display text-[13px] tabular-nums text-ink-muted">
        <span className="sr-only">{valor} de 5</span>
        <span aria-hidden="true">{valor}/5</span>
      </span>
    </span>
  );
}
