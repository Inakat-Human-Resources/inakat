// RUTA: src/components/company/JobDetailModal.tsx

'use client';

/**
 * Detalle de una vacante de la empresa, en el Modal del sistema (role=dialog,
 * foco atrapado, Escape, portal). Mismos datos y mismas reglas que antes; sólo
 * cambió cómo se pintan.
 */

import {
  Banknote,
  Briefcase,
  Calendar,
  CheckCircle2,
  Clock,
  GraduationCap,
  Info,
  MapPin,
  Monitor,
  Star,
  Target,
  Users,
} from 'lucide-react';
import CompanyLogo from '@/components/shared/CompanyLogo';
import Modal from '@/components/ui/Modal';
import Dato, { Seccion } from '@/components/ui/Dato';
import Button from '@/components/ui/Button';
import StatusBadge, { Badge } from '@/components/ui/Badge';
import { fechaLarga } from '@/lib/fechas';
import { etiquetaTipoTrabajo } from '@/lib/tipos-trabajo';

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
  logoUrl?: string | null; // FEAT-1: Logo de empresa
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

// Etiquetas de estado de la vacante. 'paused' faltaba: al ver una vacante
// pausada el encabezado mostraba el valor crudo «paused» en gris.
const ETIQUETAS_ESTADO: Record<string, string> = {
  active: 'Activa',
  paused: 'En pausa',
  closed: 'Cerrada',
  draft: 'Borrador'
};

const getWorkModeLabel = (mode: string) => {
  const labels: Record<string, string> = {
    remote: 'Remoto',
    hybrid: 'Híbrido',
    presential: 'Presencial'
  };
  return labels[mode] || mode;
};

// Detalle: la fecha larga del formateador único (src/lib/fechas).
const formatDate = (dateString: string) => fechaLarga(dateString);

const TEXTO = 'whitespace-pre-wrap text-sm leading-relaxed text-ink';

export default function JobDetailModal({ job, isOpen, onClose }: JobDetailModalProps) {
  if (!isOpen || !job) return null;

  const estado = ETIQUETAS_ESTADO[job.status] ? job.status : null;

  // Habilidades: lista JSON (chips) o texto libre, como siempre.
  const habilidades = (() => {
    if (!job.habilidades) return null;
    try {
      const skills = JSON.parse(job.habilidades);
      if (Array.isArray(skills)) {
        return (
          <ul className="flex flex-wrap gap-1.5">
            {skills.map((skill: string, index: number) => (
              <li key={index}>
                <Badge tono="info" sinPunto>
                  {skill}
                </Badge>
              </li>
            ))}
          </ul>
        );
      }
    } catch {
      // Si no es JSON válido, mostrar como texto
      return <p className={TEXTO}>{job.habilidades}</p>;
    }
    return null;
  })();

  return (
    <Modal
      abierto={isOpen}
      alCerrar={onClose}
      tamano="lg"
      // El logo es decorativo: sin aria-hidden, su alt entraría en el nombre del diálogo.
      iconoTitulo={
        <span aria-hidden="true">
          <CompanyLogo logoUrl={job.logoUrl} companyName={job.company} size="sm" />
        </span>
      }
      titulo={job.title}
      subtitulo={
        <span className="flex flex-wrap items-center gap-2">
          <span>{job.company}</span>
          {estado ? (
            <StatusBadge estado={estado} etiqueta={ETIQUETAS_ESTADO[estado]} tamano="sm" />
          ) : (
            <Badge tono="neutro" tamano="sm">
              {job.status}
            </Badge>
          )}
        </span>
      }
      pie={
        <Button variante="contorno" onClick={onClose}>
          Cerrar
        </Button>
      }
    >
      {/* Datos básicos */}
      <dl className="mb-6 grid grid-cols-1 gap-x-6 gap-y-3 rounded-xl border border-line bg-paper/60 p-4 sm:grid-cols-2 md:grid-cols-3">
        <Dato icono={MapPin} termino="Ubicación">{job.location}</Dato>
        <Dato icono={Banknote} termino="Salario">{job.salary}</Dato>
        <Dato icono={Clock} termino="Tipo">{etiquetaTipoTrabajo(job.jobType)}</Dato>
        <Dato icono={Monitor} termino="Modalidad">{getWorkModeLabel(job.workMode)}</Dato>
        {job.profile && (
          <Dato icono={Briefcase} termino="Área">
            {job.profile}
            {job.subcategory && <span className="block text-xs font-normal text-ink-muted">{job.subcategory}</span>}
          </Dato>
        )}
        {job.seniority && <Dato icono={Target} termino="Nivel">{job.seniority}</Dato>}
        {job.educationLevel && <Dato icono={GraduationCap} termino="Nivel de estudios">{job.educationLevel}</Dato>}
        <Dato icono={Calendar} termino="Publicada">{formatDate(job.createdAt)}</Dato>
        {(job._count?.applications !== undefined || job.applicationCount !== undefined) && (
          <Dato icono={Users} termino="Aplicaciones">
            <span className="tabular-nums">{job._count?.applications ?? job.applicationCount ?? 0}</span>
          </Dato>
        )}
      </dl>

      {/* Textos de la vacante */}
      <div className="space-y-5">
        <Seccion tamano="sm" titulo="Descripción">
          <p className={TEXTO}>{job.description}</p>
        </Seccion>

        {job.requirements && (
          <Seccion tamano="sm" titulo="Requisitos">
            <p className={TEXTO}>{job.requirements}</p>
          </Seccion>
        )}

        {job.habilidades && (
          <Seccion tamano="sm" icono={CheckCircle2} titulo="Habilidades requeridas">
            {habilidades}
          </Seccion>
        )}

        {job.responsabilidades && (
          <Seccion tamano="sm" icono={Briefcase} titulo="Responsabilidades">
            <p className={TEXTO}>{job.responsabilidades}</p>
          </Seccion>
        )}

        {job.resultadosEsperados && (
          <Seccion tamano="sm" icono={Target} titulo="Resultados esperados">
            <p className={TEXTO}>{job.resultadosEsperados}</p>
          </Seccion>
        )}

        {job.valoresActitudes && (
          <Seccion tamano="sm" icono={Star} titulo="Valores y actitudes">
            <p className={TEXTO}>{job.valoresActitudes}</p>
          </Seccion>
        )}

        {job.informacionAdicional && (
          <Seccion tamano="sm" icono={Info} titulo="Información adicional">
            <p className={TEXTO}>{job.informacionAdicional}</p>
          </Seccion>
        )}
      </div>
    </Modal>
  );
}
