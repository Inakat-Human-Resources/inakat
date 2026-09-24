// RUTA: src/components/sections/talents/vacante.tsx
//
// Lo que comparten la tarjeta y el detalle de la bolsa pública (/talents): la
// forma de una vacante tal como la devuelve GET /api/jobs y dos piezas de
// presentación. Sin estado ni llamadas: la lógica vive en SearchPositionsSection.

import { Badge } from '@/components/ui/Badge';

export interface Job {
  id: number;
  title: string;
  company: string;
  location: string;
  salary: string;
  jobType: string;
  workMode?: string; // Actualizado de isRemote
  companyRating: number | null;
  description: string;
  requirements: string | null;
  status: string;
  createdAt: string;
  profile?: string; // FIX-06: Campo de especialidad para filtro
  logoUrl?: string | null; // FEAT-1: Logo de empresa
  subcategory?: string;
  seniority?: string;
  educationLevel?: string;
  habilidades?: string;
  responsabilidades?: string;
  resultadosEsperados?: string;
  valoresActitudes?: string;
  informacionAdicional?: string;
}

/**
 * Texto de la modalidad. Como antes, sólo se anuncian «Remoto» e «Híbrido»:
 * la presencial es la de por defecto y no llevaba etiqueta.
 */
export function textoModalidad(workMode?: string): string | null {
  if (workMode === 'remote') return 'Remoto';
  if (workMode === 'hybrid') return 'Híbrido';
  return null;
}

/** Etiqueta de modalidad (color Y texto). */
export function EtiquetaModalidad({ workMode, tamano = 'md' }: { workMode?: string; tamano?: 'sm' | 'md' }) {
  const texto = textoModalidad(workMode);
  if (!texto) return null;
  return (
    <Badge tono={workMode === 'remote' ? 'marca' : 'info'} tamano={tamano}>
      {texto}
    </Badge>
  );
}

// Abreviaturas fijas (no Intl): el mismo texto en cualquier navegador y en las pruebas.
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/**
 * «Publicado hace…» por tramos. Hasta un mes, relativo (minutos, horas, días,
 * semanas); pasado el mes, la fecha corta («Publicado en dic 2025.»): contar
 * «hace 212 días» hacía que la bolsa pareciera abandonada. Sólo cambia el
 * texto: el orden y los datos son los de siempre.
 */
export function textoPublicada(createdAt: string, ahora: Date = new Date()): string {
  const publicada = new Date(createdAt);
  if (Number.isNaN(publicada.getTime())) return '';

  const minutos = Math.floor((ahora.getTime() - publicada.getTime()) / 60000);
  // También cubre un reloj adelantado (antes salía «hace -3 min.»).
  if (minutos < 1) return 'Publicado hace un momento.';
  if (minutos < 60) return `Publicado hace ${minutos} min.`;

  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `Publicado hace ${horas} hora${horas > 1 ? 's' : ''}.`;

  const dias = Math.floor(horas / 24);
  if (dias < 7) return `Publicado hace ${dias} día${dias > 1 ? 's' : ''}.`;
  if (dias < 30) {
    const semanas = Math.floor(dias / 7);
    return `Publicado hace ${semanas} semana${semanas > 1 ? 's' : ''}.`;
  }

  return `Publicado en ${MESES_CORTOS[publicada.getMonth()]} ${publicada.getFullYear()}.`;
}

/**
 * Habilidades guardadas como JSON. Misma regla que antes: si no es una lista
 * legible, no se pinta nada.
 */
export function leerHabilidades(habilidades?: string): string[] {
  if (!habilidades) return [];
  try {
    const lista = JSON.parse(habilidades);
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}
