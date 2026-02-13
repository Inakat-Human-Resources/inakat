// RUTA: src/components/shared/CandidateProfileModal.tsx

'use client';

// FIX-02: Helper para asegurar que URLs externos tengan protocolo https://
const ensureUrl = (url: string) => url.startsWith('http') ? url : `https://${url}`;

import { useState, useRef, useEffect } from 'react';
import CandidatePhoto from '@/components/shared/CandidatePhoto'; // FEAT-2: Foto de perfil
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
  ClipboardList
} from 'lucide-react';

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
  createdAt: string;
  authorName?: string;
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
  source?: string;
  notas?: string;
  fotoUrl?: string; // FEAT-2: Foto de perfil
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
  source?: string | null;
  notas?: string | null;
  fotoUrl?: string | null; // FEAT-2: Foto de perfil
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
  userRole
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
  const [savingNote, setSavingNote] = useState(false);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const noteFileRef = useRef<HTMLInputElement>(null);

  // Determinar si el usuario puede agregar notas de evaluación
  const canAddEvaluationNotes = ['recruiter', 'specialist'].includes(userRole || '');
  const canViewEvaluationNotes = ['recruiter', 'specialist', 'admin'].includes(userRole || '');

  // FEAT-5: Cargar notas de evaluación cuando se abre el modal
  useEffect(() => {
    if (isOpen && application?.id && canViewEvaluationNotes) {
      fetchEvaluationNotes(application.id);
    }
    // Limpiar notas cuando se cierra
    if (!isOpen) {
      setEvaluationNotes([]);
      setNewNoteContent('');
      setNoteDocument(null);
    }
  }, [isOpen, application?.id, canViewEvaluationNotes]);

  // FEAT-5: Función para cargar notas de evaluación
  const fetchEvaluationNotes = async (applicationId: number) => {
    setLoadingNotes(true);
    try {
      const res = await fetch(`/api/evaluations/notes?applicationId=${applicationId}`);
      const data = await res.json();
      if (data.success) {
        setEvaluationNotes(data.data);
      }
    } catch (error) {
      console.error('Error cargando notas:', error);
    } finally {
      setLoadingNotes(false);
    }
  };

  // FEAT-5: Función para guardar nota de evaluación
  const handleSaveNote = async () => {
    if (!newNoteContent.trim() || !application?.id) return;
    setSavingNote(true);

    try {
      let documentUrl = null;
      let documentName = null;

      // Si hay documento, subirlo primero
      if (noteDocument) {
        const formData = new FormData();
        formData.append('file', noteDocument);
        const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
        if (!uploadRes.ok) {
          const errorData = await uploadRes.json().catch(() => ({}));
          throw new Error(errorData.error || 'Error al subir documento');
        }
        const uploadData = await uploadRes.json();
        if (uploadData.url) {
          documentUrl = uploadData.url;
          documentName = noteDocument.name;
        }
      }

      const res = await fetch('/api/evaluations/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationId: application.id,
          content: newNoteContent.trim(),
          documentUrl,
          documentName,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setEvaluationNotes(prev => [data.data, ...prev]);
        setNewNoteContent('');
        setNoteDocument(null);
        if (noteFileRef.current) noteFileRef.current.value = '';
      }
    } catch (error) {
      console.error('Error guardando nota:', error);
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
        source: application.candidateProfile?.source,
        adminNotas: application.candidateProfile?.notas,
        fotoUrl: application.candidateProfile?.fotoUrl, // FEAT-2: Foto de perfil
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
        source: candidate!.source,
        adminNotas: candidate!.notas,
        fotoUrl: candidate!.fotoUrl, // FEAT-2: Foto de perfil
        experiences: candidate!.experiences || [],
        documents: candidate!.documents || []
      };

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
      month: 'short'
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

  // FEATURE: Parsear educación múltiple
  const parseEducacion = (): Education[] => {
    if (data.educacion) {
      try {
        const parsed = JSON.parse(data.educacion);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
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

  const calculateAge = (fechaNacimiento?: string | null) => {
    if (!fechaNacimiento) return null;
    const birthDate = new Date(fechaNacimiento);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  // Obtener ubicación del candidato (de la experiencia más reciente)
  const getLocation = () => {
    const experiences = data.experiences || [];
    if (experiences.length > 0) {
      // Buscar trabajo actual primero
      const currentJob = experiences.find(exp => exp.esActual);
      if (currentJob?.ubicacion) return currentJob.ubicacion;
      // Si no, usar la experiencia más reciente
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
      const docResponse = await fetch(`/api/admin/candidates/${candidateId}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newDocName.trim(),
          fileUrl: uploadData.url,
          fileType: newDocFile.type.split('/')[1] || 'file'
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
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
            className="text-gray-400 hover:text-gray-600 p-1 flex-shrink-0"
          >
            <X size={24} />
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
                        <span className={`px-2 py-1 text-xs font-medium rounded ${
                          edu.estatus === 'Titulado' ? 'bg-green-100 text-green-800' :
                          edu.estatus === 'Terminado' ? 'bg-blue-100 text-blue-800' :
                          edu.estatus === 'Cursando' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
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

          {/* Cover Letter */}
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
                          <p className="text-xs text-gray-500 uppercase">{doc.fileType}</p>
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
                        <span className={`font-medium px-2 py-0.5 rounded text-xs ${
                          note.authorRole === 'recruiter'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-purple-100 text-purple-700'
                        }`}>
                          {note.authorRole === 'recruiter' ? '🧠 Reclutador' : '🔧 Especialista'}
                        </span>
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
                      <p className="text-gray-700 whitespace-pre-wrap">{note.content}</p>
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

              {/* Formulario para nueva nota (solo recruiter/specialist) */}
              {canAddEvaluationNotes && (
                <div className="space-y-3 bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <textarea
                    value={newNoteContent}
                    onChange={(e) => setNewNoteContent(e.target.value)}
                    placeholder="Escribe tus observaciones sobre este candidato..."
                    className="w-full border border-gray-300 rounded-lg p-3 text-sm resize-none focus:ring-2 focus:ring-[#2b5d62] focus:border-transparent"
                    rows={3}
                  />
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <label className="flex items-center gap-2 text-sm text-gray-500 cursor-pointer hover:text-gray-700 flex-1">
                      <Upload className="w-4 h-4" />
                      <span className="truncate">
                        {noteDocument ? noteDocument.name : 'Adjuntar documento (opcional)'}
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

          {/* Admin Notes */}
          {data.adminNotas && (
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
          {data.notes && (
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="text-lg font-bold">Agregar Documento</h3>
              <button
                onClick={() => {
                  setShowAddDocModal(false);
                  setNewDocName('');
                  setNewDocFile(null);
                  setDocError('');
                }}
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
                <p className="text-xs text-gray-500 mt-1">PDF, DOC, DOCX, JPG, PNG (máx. 5MB)</p>
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
