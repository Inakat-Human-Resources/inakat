// RUTA: src/components/shared/CandidateProfileModal.tsx

'use client';

import { useState, useRef } from 'react';
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
  Save
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

interface CandidateProfile {
  id?: number;
  universidad?: string;
  carrera?: string;
  nivelEstudios?: string;
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
  onDocumentsUpdated
}: CandidateProfileModalProps) {
  // Estados para agregar documento
  const [showAddDocModal, setShowAddDocModal] = useState(false);
  const [newDocName, setNewDocName] = useState('');
  const [newDocFile, setNewDocFile] = useState<File | null>(null);
  const [savingDoc, setSavingDoc] = useState(false);
  const [docError, setDocError] = useState('');
  const docInputRef = useRef<HTMLInputElement>(null);

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
              <div className="w-10 h-10 md:w-12 md:h-12 bg-[#2b5d62] text-white rounded-full flex items-center justify-center text-base md:text-lg font-bold flex-shrink-0">
                {data.name.charAt(0).toUpperCase()}
              </div>
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

          {/* Education & Experience Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {data.universidad && (
              <div className="p-4 border border-gray-200 rounded-lg">
                <div className="flex items-center gap-2 text-gray-500 mb-1">
                  <GraduationCap className="w-4 h-4" />
                  <span className="text-xs font-medium">Universidad</span>
                </div>
                <p className="text-sm font-semibold text-gray-900">{data.universidad}</p>
                {data.carrera && (
                  <p className="text-xs text-gray-600 mt-1">{data.carrera}</p>
                )}
              </div>
            )}

            {data.nivelEstudios && (
              <div className="p-4 border border-gray-200 rounded-lg">
                <div className="flex items-center gap-2 text-gray-500 mb-1">
                  <GraduationCap className="w-4 h-4" />
                  <span className="text-xs font-medium">Nivel de Estudios</span>
                </div>
                <p className="text-sm font-semibold text-gray-900">{data.nivelEstudios}</p>
              </div>
            )}

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
                href={data.cvUrl}
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
                href={data.linkedinUrl}
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
                href={data.portafolioUrl}
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

          {/* Recruiter Notes (only for specialist) */}
          {showRecruiterNotes && recruiterNotes && (
            <div className="mb-6">
              <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-purple-600" />
                Notas del Reclutador
              </h3>
              <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{recruiterNotes}</p>
              </div>
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
