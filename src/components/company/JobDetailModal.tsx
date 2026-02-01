// RUTA: src/components/company/JobDetailModal.tsx

'use client';

import { X, MapPin, DollarSign, Briefcase, Calendar, Users, Building, GraduationCap, Target, CheckCircle, Star, Info } from 'lucide-react';

interface Job {
  id: number;
  title: string;
  company: string;
  location: string;
  salary: string;
  jobType: string;
  workMode: string;
  description: string;
  requirements?: string;
  status: string;
  profile?: string;
  subcategory?: string;
  seniority?: string;
  educationLevel?: string;
  habilidades?: string;
  responsabilidades?: string;
  resultadosEsperados?: string;
  valoresActitudes?: string;
  informacionAdicional?: string;
  createdAt: string;
  _count?: {
    applications: number;
  };
  applicationCount?: number;
}

interface JobDetailModalProps {
  job: Job | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function JobDetailModal({ job, isOpen, onClose }: JobDetailModalProps) {
  if (!isOpen || !job) return null;

  const getWorkModeLabel = (mode: string) => {
    const labels: Record<string, string> = {
      remote: 'Remoto',
      hybrid: 'Híbrido',
      presential: 'Presencial'
    };
    return labels[mode] || mode;
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, string> = {
      active: 'bg-green-100 text-green-800',
      closed: 'bg-gray-100 text-gray-800',
      draft: 'bg-yellow-100 text-yellow-800'
    };

    const labels: Record<string, string> = {
      active: 'Activa',
      closed: 'Cerrada',
      draft: 'Borrador'
    };

    return (
      <span className={`px-3 py-1 text-sm font-semibold rounded-full ${badges[status] || 'bg-gray-100 text-gray-800'}`}>
        {labels[status] || status}
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex justify-between items-start">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-2xl font-bold text-gray-900">{job.title}</h2>
              {getStatusBadge(job.status)}
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <Building className="w-4 h-4" />
              <span>{job.company}</span>
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
          {/* Info Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center gap-2 text-gray-500 mb-1">
                <MapPin className="w-4 h-4" />
                <span className="text-xs font-medium">Ubicación</span>
              </div>
              <p className="text-sm font-semibold text-gray-900">{job.location}</p>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center gap-2 text-gray-500 mb-1">
                <DollarSign className="w-4 h-4" />
                <span className="text-xs font-medium">Salario</span>
              </div>
              <p className="text-sm font-semibold text-gray-900">{job.salary}</p>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center gap-2 text-gray-500 mb-1">
                <Briefcase className="w-4 h-4" />
                <span className="text-xs font-medium">Tipo</span>
              </div>
              <p className="text-sm font-semibold text-gray-900">{job.jobType}</p>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center gap-2 text-gray-500 mb-1">
                <MapPin className="w-4 h-4" />
                <span className="text-xs font-medium">Modalidad</span>
              </div>
              <p className="text-sm font-semibold text-gray-900">{getWorkModeLabel(job.workMode)}</p>
            </div>
          </div>

          {/* Additional Info Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {job.profile && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center gap-2 text-gray-500 mb-1">
                  <Briefcase className="w-4 h-4" />
                  <span className="text-xs font-medium">Área</span>
                </div>
                <p className="text-sm font-semibold text-gray-900">{job.profile}</p>
                {job.subcategory && (
                  <p className="text-xs text-gray-600 mt-1">{job.subcategory}</p>
                )}
              </div>
            )}

            {job.seniority && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center gap-2 text-gray-500 mb-1">
                  <Target className="w-4 h-4" />
                  <span className="text-xs font-medium">Nivel</span>
                </div>
                <p className="text-sm font-semibold text-gray-900">{job.seniority}</p>
              </div>
            )}

            {job.educationLevel && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center gap-2 text-gray-500 mb-1">
                  <GraduationCap className="w-4 h-4" />
                  <span className="text-xs font-medium">Nivel de Estudios</span>
                </div>
                <p className="text-sm font-semibold text-gray-900">{job.educationLevel}</p>
              </div>
            )}

            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center gap-2 text-gray-500 mb-1">
                <Calendar className="w-4 h-4" />
                <span className="text-xs font-medium">Publicada</span>
              </div>
              <p className="text-sm font-semibold text-gray-900">{formatDate(job.createdAt)}</p>
            </div>

            {(job._count?.applications !== undefined || job.applicationCount !== undefined) && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center gap-2 text-gray-500 mb-1">
                  <Users className="w-4 h-4" />
                  <span className="text-xs font-medium">Aplicaciones</span>
                </div>
                <p className="text-sm font-semibold text-gray-900">
                  {job._count?.applications ?? job.applicationCount ?? 0}
                </p>
              </div>
            )}
          </div>

          {/* Description */}
          <div className="mb-6">
            <h3 className="text-lg font-bold text-gray-900 mb-3">Descripción</h3>
            <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
              {job.description}
            </div>
          </div>

          {/* Requirements */}
          {job.requirements && (
            <div className="mb-6">
              <h3 className="text-lg font-bold text-gray-900 mb-3">Requisitos</h3>
              <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
                {job.requirements}
              </div>
            </div>
          )}

          {/* Habilidades */}
          {job.habilidades && (
            <div className="mb-6">
              <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-[#2b5d62]" />
                Habilidades Requeridas
              </h3>
              <div className="flex flex-wrap gap-2">
                {(() => {
                  try {
                    const skills = JSON.parse(job.habilidades);
                    if (Array.isArray(skills)) {
                      return skills.map((skill: string, index: number) => (
                        <span
                          key={index}
                          className="px-3 py-1 bg-[#e8f4f4] text-[#2b5d62] text-sm font-medium rounded-full"
                        >
                          {skill}
                        </span>
                      ));
                    }
                  } catch {
                    // Si no es JSON válido, mostrar como texto
                    return (
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">
                        {job.habilidades}
                      </p>
                    );
                  }
                  return null;
                })()}
              </div>
            </div>
          )}

          {/* Responsabilidades */}
          {job.responsabilidades && (
            <div className="mb-6">
              <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-[#2b5d62]" />
                Responsabilidades
              </h3>
              <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
                {job.responsabilidades}
              </div>
            </div>
          )}

          {/* Resultados Esperados */}
          {job.resultadosEsperados && (
            <div className="mb-6">
              <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                <Target className="w-5 h-5 text-[#2b5d62]" />
                Resultados Esperados
              </h3>
              <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
                {job.resultadosEsperados}
              </div>
            </div>
          )}

          {/* Valores y Actitudes */}
          {job.valoresActitudes && (
            <div className="mb-6">
              <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                <Star className="w-5 h-5 text-[#2b5d62]" />
                Valores y Actitudes
              </h3>
              <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
                {job.valoresActitudes}
              </div>
            </div>
          )}

          {/* Información Adicional */}
          {job.informacionAdicional && (
            <div className="mb-6">
              <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                <Info className="w-5 h-5 text-[#2b5d62]" />
                Información Adicional
              </h3>
              <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
                {job.informacionAdicional}
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
