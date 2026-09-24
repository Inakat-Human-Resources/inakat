// RUTA: src/app/candidate/_componentes/FilaPostulacion.tsx
//
// Una postulación vista por quien postuló: la usan /candidate/applications
// (rol candidato) y /my-applications (rol usuario). Es sólo presentación: cada
// página decide qué datos pasa, con sus textos y sus formatos de siempre.
//
// Por qué una lista y no un DataTable: cada fila lleva el título de la vacante
// como encabezado (el lector de pantalla salta de una postulación a otra con
// «siguiente encabezado»), un aviso de texto según el estado y ninguna columna
// ordenable; en una tabla ese aviso sería una columna casi siempre vacía.
// Candidato a subir a src/components/ui si otra pantalla lo necesita.
//
// Las dos páginas hermanas pintan la MISMA tarjeta: mismos detalles, la misma
// fecha corta (fechaCorta), la misma modalidad legible (etiquetaModalidad) y
// el mismo aviso por estado (avisoDeEstado). Por eso esos tres viven aquí.

import type { ReactNode } from 'react';
import {
  CalendarCheck,
  CheckCircle2,
  Clock,
  Eye,
  Send,
  Sparkles,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import CompanyLogo from '@/components/shared/CompanyLogo';
import { Badge, type TonoBadge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';

/**
 * Tono del badge a partir del color que devuelve el mapa único de estados
 * (src/lib/application-status.ts). El color sigue viniendo de allí: aquí sólo
 * se traduce a la paleta. Texto sobre fondo, medido: aviso 6.14 · info 8.18 ·
 * marca 10.70 · destacado 5.67 · neutro 6.44.
 */
export function tonoDeColorEstado(color: string | null | undefined): TonoBadge {
  switch (color) {
    case 'blue':
    case 'indigo':
      return 'info';
    case 'purple':
      return 'marca';
    case 'green':
      return 'destacado';
    case 'gray':
      return 'neutro';
    default:
      return 'aviso';
  }
}

/** Icono que acompaña al estado (el color nunca va solo: el texto manda). */
export function iconoDeEstado(status: string): LucideIcon {
  switch (status) {
    case 'reviewing':
    case 'evaluating':
    case 'sent_to_specialist':
      return Eye;
    case 'sent_to_company':
      return Send;
    case 'company_interested':
      return Sparkles;
    case 'interviewed':
      return CalendarCheck;
    case 'accepted':
      return CheckCircle2;
    case 'rejected':
    case 'discarded':
    case 'archived':
      return XCircle;
    default:
      return Clock;
  }
}

export interface DetallePostulacion {
  icono: LucideIcon;
  /** Nombre del dato para el lector de pantalla («Salario»). */
  etiqueta: string;
  valor: ReactNode;
}

/** Aviso bajo la postulación (p. ej. «¡Felicidades! …»). */
export interface AvisoPostulacion {
  tono: 'exito' | 'info' | 'marca';
  texto: string;
}

// Texto oscuro sobre su tinte: 7.84 · 8.18 · tinta sobre naranja claro 10.70.
const TONOS_AVISO: Record<AvisoPostulacion['tono'], string> = {
  exito: 'border-lime bg-lime-tint text-lime-dark',
  info: 'border-teal bg-teal-tint text-teal-dark',
  marca: 'border-orange bg-orange-tint text-ink',
};

/**
 * Mensaje bajo la postulación según su estado (los textos de siempre de
 * /candidate/applications). 'discarded' y 'archived' no llevan mensaje: la
 * etiqueta ya dice «No seleccionado» / «Proceso finalizado».
 */
export function avisoDeEstado(status: string): AvisoPostulacion | null {
  switch (status) {
    case 'accepted':
      return {
        tono: 'exito',
        texto: '¡Felicidades! Has sido seleccionado para este puesto. La empresa se pondrá en contacto contigo pronto.',
      };
    case 'interviewed':
      return {
        tono: 'info',
        texto: 'Tu entrevista ha sido registrada. El equipo está evaluando tu perfil.',
      };
    case 'sent_to_company':
      return {
        tono: 'marca',
        texto: '¡Buenas noticias! Tu perfil ha sido enviado a la empresa. Pronto podrías recibir noticias.',
      };
    default:
      return null;
  }
}

/** Modalidad legible (remote → Remoto); un valor desconocido sale tal cual. */
export function etiquetaModalidad(workMode: string): string {
  const modos: Record<string, string> = {
    remote: 'Remoto',
    hybrid: 'Híbrido',
    presential: 'Presencial',
  };
  return modos[workMode] || workMode;
}

/**
 * Fecha corta del panel: «20 sep 2026». Es el formateador único de
 * src/lib/fechas (una fecha vacía o inválida sale «—»); se reexporta aquí
 * para que las dos páginas hermanas lo importen del mismo sitio que la fila.
 */
export { fechaCorta } from '@/lib/fechas';

export interface FilaPostulacionProps {
  titulo: string;
  empresa: string;
  ubicacion?: string | null;
  logoUrl?: string | null;
  /** Estado crudo (sólo para elegir el icono). */
  estado: string;
  /** Etiqueta y color del mapa único de estados. */
  etiquetaEstado: string;
  colorEstado: string;
  detalles?: DetallePostulacion[];
  /** Especialidad, nivel… */
  etiquetas?: string[];
  /** Fechas ya formateadas con fechaCorta: [{ etiqueta: 'Aplicado', valor: '12 ene 2026' }]. */
  fechas: Array<{ etiqueta: string; valor: string }>;
  aviso?: AvisoPostulacion | null;
  nivelTitulo?: 2 | 3;
}

export default function FilaPostulacion({
  titulo,
  empresa,
  ubicacion,
  logoUrl,
  estado,
  etiquetaEstado,
  colorEstado,
  detalles = [],
  etiquetas = [],
  fechas,
  aviso,
  nivelTitulo = 3,
}: FilaPostulacionProps) {
  const Titulo = nivelTitulo === 2 ? 'h2' : 'h3';
  const detallesVisibles = detalles.filter((d) => d.valor);
  const etiquetasVisibles = etiquetas.filter(Boolean);
  const hayMeta = detallesVisibles.length > 0 || etiquetasVisibles.length > 0;

  return (
    <li className="flex gap-3 px-4 py-4 transition-colors duration-150 hover:bg-paper/70 sm:gap-4 sm:px-5">
      <CompanyLogo logoUrl={logoUrl} companyName={empresa} size="md" className="mt-0.5" />

      <div className="min-w-0 flex-1">
        {/* Rejilla y no flex: desde sm, la columna del estado (badge + fechas)
            ocupa dos filas y la meta (jornada, salario…) va en la segunda fila
            de la columna del título. Con flex, cuando el estado era más alto
            que el título (Aplicado + Revisado), la meta bajaba con él y quedaba
            un hueco entre el título y su propia meta. La 2.ª fila es `1fr`: el
            alto que sobre de la columna del estado se va DEBAJO de la meta, no
            entre ella y el título. En móvil, una columna: título → estado → meta. */}
        <div
          className={cn(
            'grid gap-y-2.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-x-6',
            hayMeta && 'sm:grid-rows-[auto_1fr]'
          )}
        >
          <div className="min-w-0 sm:col-start-1 sm:row-start-1">
            <Titulo className="font-display text-[15px] font-semibold leading-snug text-ink">{titulo}</Titulo>
            <p className="mt-0.5 text-sm text-ink-muted">
              <span className="font-medium text-ink">{empresa}</span>
              {ubicacion && (
                <>
                  <span className="mx-1.5" aria-hidden="true">
                    ·
                  </span>
                  {ubicacion}
                </>
              )}
            </p>
          </div>

          <div
            className={cn(
              'flex flex-wrap items-center gap-x-3 gap-y-1.5 sm:col-start-2 sm:row-start-1 sm:flex-col sm:items-end',
              hayMeta && 'sm:row-span-2'
            )}
          >
            <Badge tono={tonoDeColorEstado(colorEstado)} icono={iconoDeEstado(estado)}>
              {etiquetaEstado}
            </Badge>
            {fechas.map((f) => (
              <p key={f.etiqueta} className="whitespace-nowrap text-xs tabular-nums text-ink-muted">
                {f.etiqueta}: {f.valor}
              </p>
            ))}
          </div>

          {hayMeta && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 self-start text-[13px] text-ink-muted sm:col-start-1 sm:row-start-2">
              {detallesVisibles.map(({ icono: Icono, etiqueta, valor }) => (
                <span key={etiqueta} className="inline-flex items-center gap-1.5">
                  <Icono className="h-3.5 w-3.5 flex-none" aria-hidden="true" />
                  <span className="sr-only">{etiqueta}: </span>
                  {valor}
                </span>
              ))}
              {etiquetasVisibles.map((e) => (
                <Badge key={e} tono="neutro" sinPunto tamano="sm">
                  {e}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {aviso && (
          <p className={cn('mt-3 rounded-lg border-l-[3px] px-3 py-2 text-[13px] leading-relaxed', TONOS_AVISO[aviso.tono])}>
            {aviso.texto}
          </p>
        )}
      </div>
    </li>
  );
}

/** Esqueleto de la lista mientras carga (decorativo; quien lo usa anuncia la carga). */
export function FilasPostulacionEsqueleto({ filas = 4 }: { filas?: number }) {
  return (
    <ul aria-hidden="true" className="divide-y divide-line">
      {Array.from({ length: filas }, (_, i) => (
        <li key={i} className="flex gap-4 px-5 py-4">
          <span className="skeleton block h-10 w-10 flex-none rounded-lg" />
          <span className="flex-1 space-y-2">
            <span className="skeleton block h-4 w-1/2 rounded-md" />
            <span className="skeleton block h-3.5 w-1/3 rounded-md" />
            <span className="skeleton block h-3 w-2/3 rounded-md" />
          </span>
          <span className="skeleton hidden h-6 w-24 flex-none rounded-full sm:block" />
        </li>
      ))}
    </ul>
  );
}
