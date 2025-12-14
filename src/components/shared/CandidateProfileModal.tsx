// RUTA: src/components/shared/CandidateProfileModal.tsx

'use client';

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
  Building
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

interface CandidateProfile {
  id?: number;
  universidad?: string;
  carrera?: string;
  nivelEstudios?: string;
  añosExperiencia?: number;
  profile?: string;
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
}

export default function CandidateProfileModal({
  application,
  candidate,
  isOpen,
  onClose,
  recruiterNotes,
  showRecruiterNotes = false
}: CandidateProfileModalProps) {
  if (!isOpen || (!application && !candidate)) return null;

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
        seniority: application.candidateProfile?.seniority,
        linkedinUrl: application.candidateProfile?.linkedinUrl,
        portafolioUrl: application.candidateProfile?.portafolioUrl,
        sexo: application.candidateProfile?.sexo,
        fechaNacimiento: application.candidateProfile?.fechaNacimiento,
        source: application.candidateProfile?.source,
        adminNotas: application.candidateProfile?.notas,
        experiences: application.candidateProfile?.experiences || []
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
        seniority: candidate!.seniority,
        linkedinUrl: candidate!.linkedinUrl,
        portafolioUrl: candidate!.portafolioUrl,
        sexo: candidate!.sexo,
        fechaNacimiento: candidate!.fechaNacimiento,
        source: candidate!.source,
        adminNotas: candidate!.notas,
        experiences: candidate!.experiences || []
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex justify-between items-start">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-[#2b5d62] text-white rounded-full flex items-center justify-center text-lg font-bold">
                {data.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{data.name}</h2>
                <div className="flex items-center gap-2 mt-1">
                  {getStatusBadge(data.status)}
                  {data.seniority && (
                    <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded">
                      {getSeniorityLabel(data.seniority)}
                    </span>
                  )}
                  {data.profile && (
                    <span className="px-2 py-1 text-xs font-medium bg-[#e8f4f4] text-[#2b5d62] rounded">
                      {data.profile}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Contact Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
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
                  <span className="text-xs font-medium">Experiencia</span>
                </div>
                <p className="text-sm font-semibold text-gray-900">
                  {data.añosExperiencia} {data.añosExperiencia === 1 ? 'año' : 'años'}
                </p>
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
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 p-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
