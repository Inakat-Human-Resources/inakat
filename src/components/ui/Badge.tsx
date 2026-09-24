// RUTA: src/components/ui/Badge.tsx

import type { ReactNode } from 'react';
import { Briefcase, Building2, GraduationCap, Shield, Tag, User, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { etiquetaRol } from '@/lib/nav-app';

/**
 * Tonos de estado. Texto sobre fondo, contraste MEDIDO:
 *   exito 7.84 · aviso 6.14 · info 8.18 · peligro 6.30 · neutro 6.44 ·
 *   destacado (tinta sobre lima) 5.67 · marca (tinta sobre naranja claro) 10.70
 * El color nunca va solo: siempre acompaña a un texto (y a un punto).
 */
export type TonoBadge = 'exito' | 'aviso' | 'info' | 'peligro' | 'neutro' | 'destacado' | 'marca';

const TONOS: Record<TonoBadge, { caja: string; punto: string }> = {
  exito: { caja: 'bg-lime-tint text-lime-dark', punto: 'bg-lime' },
  aviso: { caja: 'bg-orange-tint text-orange-dark', punto: 'bg-orange' },
  info: { caja: 'bg-teal-tint text-teal-dark', punto: 'bg-teal' },
  peligro: { caja: 'bg-danger-tint text-danger-dark', punto: 'bg-danger' },
  neutro: { caja: 'bg-mist text-[#4a5557]', punto: 'bg-line-strong' },
  destacado: { caja: 'bg-lime text-ink', punto: 'bg-ink' },
  marca: { caja: 'bg-orange-tint text-ink', punto: 'bg-orange' },
};

export interface BadgeProps {
  tono?: TonoBadge;
  children: ReactNode;
  /** Icono en lugar del punto. */
  icono?: LucideIcon;
  /** Sin punto ni icono (p. ej. etiquetas de especialidad). */
  sinPunto?: boolean;
  tamano?: 'sm' | 'md';
  className?: string;
  title?: string;
}

/**
 * Etiqueta corta: un estado, una especialidad, un nivel.
 *
 *   <Badge tono="info">Tecnología</Badge>
 *   <Badge tono="neutro" sinPunto>Sr</Badge>
 */
export function Badge({ tono = 'neutro', children, icono: Icono, sinPunto, tamano = 'md', className, title }: BadgeProps) {
  const t = TONOS[tono];
  return (
    <span
      title={title}
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 whitespace-nowrap rounded-full font-medium leading-none',
        tamano === 'sm' ? 'px-2 py-1 text-[11px]' : 'px-2.5 py-1 text-xs',
        t.caja,
        className
      )}
    >
      {Icono ? (
        <Icono className="h-3.5 w-3.5 flex-none" aria-hidden="true" />
      ) : (
        !sinPunto && <span className={cn('h-1.5 w-1.5 flex-none rounded-full', t.punto)} aria-hidden="true" />
      )}
      <span className="truncate">{children}</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Estados de la aplicación
// ---------------------------------------------------------------------------

/**
 * TODOS los estados que maneja la aplicación, con su tono y su etiqueta por
 * defecto. Salen de prisma/schema.prisma y de un grep de los literales que
 * usan las pantallas (septiembre 2026):
 *
 * - Postulación (Application.status, src/lib/application-status.ts): pending,
 *   reviewing, evaluating, sent_to_specialist, sent_to_company,
 *   company_interested, interviewed, rejected, accepted, injected_by_admin,
 *   discarded, archived.
 * - Vacante (Job.status): active, paused, closed, draft.
 * - Pago (Purchase.paymentStatus y estados de Mercado Pago): pending, paid,
 *   failed, refunded, approved, rejected, cancelled, in_process, charged_back,
 *   in_mediation, authorized.
 * - Solicitud de empresa (CompanyRequest.status): pending, approved, rejected.
 * - Entrevista (InterviewRequest.status): pending, confirmed, rejected, cancelled.
 * - Candidato del banco (Candidate.status): available, in_process, hired, inactive.
 * - Comisión (commissionStatus): pending, paid.
 * - Asignación (recruiterStatus / specialistStatus): pending, reviewing,
 *   sent_to_specialist, evaluating, sent_to_company.
 */
export const ESTADOS: Record<string, { tono: TonoBadge; etiqueta: string }> = {
  // Postulación / proceso
  pending: { tono: 'aviso', etiqueta: 'Pendiente' },
  injected_by_admin: { tono: 'aviso', etiqueta: 'Asignado por admin' },
  reviewing: { tono: 'info', etiqueta: 'En revisión' },
  evaluating: { tono: 'info', etiqueta: 'Evaluando' },
  sent_to_specialist: { tono: 'info', etiqueta: 'Con especialista' },
  sent_to_company: { tono: 'info', etiqueta: 'Enviado a empresa' },
  company_interested: { tono: 'marca', etiqueta: 'Le interesa a la empresa' },
  interested: { tono: 'marca', etiqueta: 'Le interesa a la empresa' },
  interviewed: { tono: 'info', etiqueta: 'Entrevistado' },
  accepted: { tono: 'destacado', etiqueta: 'Contratado' },
  rejected: { tono: 'peligro', etiqueta: 'Rechazado' },
  discarded: { tono: 'neutro', etiqueta: 'Descartado' },
  archived: { tono: 'neutro', etiqueta: 'Archivado' },
  // Vacante
  active: { tono: 'exito', etiqueta: 'Activa' },
  paused: { tono: 'aviso', etiqueta: 'Pausada' },
  closed: { tono: 'neutro', etiqueta: 'Cerrada' },
  draft: { tono: 'neutro', etiqueta: 'Borrador' },
  // Pago
  paid: { tono: 'exito', etiqueta: 'Pagado' },
  approved: { tono: 'exito', etiqueta: 'Aprobado' },
  failed: { tono: 'peligro', etiqueta: 'Fallido' },
  refunded: { tono: 'neutro', etiqueta: 'Reembolsado' },
  charged_back: { tono: 'peligro', etiqueta: 'Contracargo' },
  cancelled: { tono: 'neutro', etiqueta: 'Cancelado' },
  in_process: { tono: 'info', etiqueta: 'En proceso' },
  in_mediation: { tono: 'peligro', etiqueta: 'En disputa' },
  authorized: { tono: 'info', etiqueta: 'Autorizado' },
  // Entrevista (y las pestañas de las pantallas de entrevistas)
  confirmed: { tono: 'exito', etiqueta: 'Confirmada' },
  scheduled: { tono: 'info', etiqueta: 'Programada' },
  // Pestaña «Enviadas» de reclutador y especialista
  sent: { tono: 'info', etiqueta: 'Enviado' },
  // Candidato del banco
  available: { tono: 'exito', etiqueta: 'Disponible' },
  hired: { tono: 'destacado', etiqueta: 'Contratado' },
  inactive: { tono: 'neutro', etiqueta: 'Inactivo' },
  // Genéricos
  completed: { tono: 'exito', etiqueta: 'Completado' },
  expired: { tono: 'neutro', etiqueta: 'Vencido' },
  read: { tono: 'neutro', etiqueta: 'Leída' },
  unread: { tono: 'marca', etiqueta: 'Sin leer' },
};

/**
 * Etiquetas que cambian según de qué se hable (género, vocabulario de cada
 * pantalla). Si una pantalla ya tenía su texto, pásalo con `etiqueta`.
 */
export type ContextoEstado =
  | 'vacante'
  | 'postulacion'
  | 'pago'
  | 'solicitud'
  | 'entrevista'
  | 'candidato'
  | 'comision'
  | 'asignacion'
  | 'empresa';

const POR_CONTEXTO: Partial<Record<ContextoEstado, Record<string, string>>> = {
  vacante: { active: 'Activa', paused: 'Pausada', closed: 'Cerrada', draft: 'Borrador' },
  postulacion: {
    pending: 'Por revisar',
    injected_by_admin: 'Por revisar',
    rejected: 'Rechazado',
  },
  pago: { pending: 'Pendiente', approved: 'Aprobado', rejected: 'Rechazado', cancelled: 'Cancelado' },
  solicitud: { pending: 'Pendiente', approved: 'Aprobada', rejected: 'Rechazada' },
  entrevista: {
    pending: 'Por confirmar',
    confirmed: 'Confirmada',
    rejected: 'Rechazada',
    cancelled: 'Cancelada',
  },
  candidato: { in_process: 'En proceso', available: 'Disponible', hired: 'Contratado', inactive: 'Inactivo' },
  comision: { pending: 'Por pagar', paid: 'Pagada', cancelled: 'Cancelada' },
  asignacion: { pending: 'Sin empezar' },
  // Lo que ve la EMPRESA de sus candidatos (/company/jobs/[id]/candidates y
  // la ficha abierta por la empresa): su vocabulario, no el del proceso.
  empresa: {
    sent_to_company: 'Por revisar',
    company_interested: 'Me interesa',
    interviewed: 'Entrevistado',
    accepted: 'En contratación',
    rejected: 'Descartado',
  },
};

/** Tonos que cambian según quién mira (por defecto, los de ESTADOS). */
const TONO_POR_CONTEXTO: Partial<Record<ContextoEstado, Record<string, TonoBadge>>> = {
  // Para la empresa, lo enviado es trabajo pendiente (aviso) y un descartado
  // no es un error (neutro).
  empresa: {
    sent_to_company: 'aviso',
    company_interested: 'marca',
    interviewed: 'info',
    accepted: 'destacado',
    rejected: 'neutro',
  },
};

/** Etiqueta legible de un estado (con contexto opcional). */
export function etiquetaEstado(estado: string | null | undefined, contexto?: ContextoEstado): string {
  if (!estado) return 'Sin estado';
  return (contexto && POR_CONTEXTO[contexto]?.[estado]) || ESTADOS[estado]?.etiqueta || estado;
}

/** Tono de un estado (con contexto opcional); desconocido → neutro. */
export function tonoEstado(estado: string | null | undefined, contexto?: ContextoEstado): TonoBadge {
  if (!estado) return 'neutro';
  return (contexto && TONO_POR_CONTEXTO[contexto]?.[estado]) || ESTADOS[estado]?.tono || 'neutro';
}

/** ¿El contexto tiene su propia etiqueta para este estado? */
export function tieneEtiquetaEnContexto(estado: string | null | undefined, contexto: ContextoEstado): boolean {
  return Boolean(estado && POR_CONTEXTO[contexto]?.[estado]);
}

export interface StatusBadgeProps {
  estado: string | null | undefined;
  contexto?: ContextoEstado;
  /** Texto propio (gana a la etiqueta del mapa). */
  etiqueta?: string;
  /** Tono propio (gana al del mapa). */
  tono?: TonoBadge;
  tamano?: 'sm' | 'md';
  className?: string;
}

/**
 * Estado con color Y texto (nunca sólo color).
 *
 *   <StatusBadge estado={vacante.status} contexto="vacante" />
 *   <StatusBadge estado={compra.paymentStatus} contexto="pago" />
 */
export default function StatusBadge({ estado, contexto, etiqueta, tono, tamano, className }: StatusBadgeProps) {
  return (
    <Badge tono={tono ?? tonoEstado(estado, contexto)} tamano={tamano} className={className}>
      {etiqueta ?? etiquetaEstado(estado, contexto)}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

/**
 * La insignia de cada rol: UNA sola para todo el panel (/admin/users,
 * /admin/vendors…). Un rol es una categoría, no un estado: icono Y texto, sin
 * punto; el tono sólo ayuda a distinguirlos de un vistazo.
 */
export const INSIGNIA_ROL: Record<string, { tono: TonoBadge; icono: LucideIcon }> = {
  admin: { tono: 'marca', icono: Shield },
  recruiter: { tono: 'info', icono: Briefcase },
  specialist: { tono: 'exito', icono: GraduationCap },
  vendor: { tono: 'neutro', icono: Tag },
  company: { tono: 'neutro', icono: Building2 },
  candidate: { tono: 'neutro', icono: User },
  user: { tono: 'neutro', icono: User },
};

export interface RolBadgeProps {
  /** El rol tal como lo guarda la API: 'admin', 'recruiter'… */
  rol: string;
  tamano?: 'sm' | 'md';
  className?: string;
}

/**
 * Rol con icono y texto (la etiqueta sale de etiquetaRol, src/lib/nav-app).
 * Un rol desconocido sale neutro, sin icono y con su nombre.
 *
 *   <RolBadge rol={usuario.role} />
 */
export function RolBadge({ rol, tamano, className }: RolBadgeProps) {
  const insignia = INSIGNIA_ROL[rol];
  const etiqueta = etiquetaRol(rol) || rol;
  return insignia ? (
    <Badge tono={insignia.tono} icono={insignia.icono} tamano={tamano} className={className}>
      {etiqueta}
    </Badge>
  ) : (
    <Badge tono="neutro" sinPunto tamano={tamano} className={className}>
      {etiqueta}
    </Badge>
  );
}
