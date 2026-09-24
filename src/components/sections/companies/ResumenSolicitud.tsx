// RUTA: src/components/sections/companies/ResumenSolicitud.tsx
'use client';

import type { ReactNode } from 'react';
import { Building2, Pencil } from 'lucide-react';
import Button from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { formatearTamano } from '@/components/ui/CampoArchivo';

/** Lo que el resumen lee del formulario (sólo lectura: aquí no se edita nada). */
export interface DatosResumen {
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  departamento: string;
  correoEmpresa: string;
  nombreEmpresa: string;
  sitioWeb: string;
  razonSocial: string;
  rfc: string;
  calle: string;
  colonia: string;
  ciudad: string;
  codigoPostal: string;
  identificacion: File | null;
  documentosConstitucion: File | null;
}

export type PasoEditable = 'cuenta' | 'empresa' | 'ubicacion' | 'documentos';

interface ResumenSolicitudProps {
  datos: DatosResumen;
  logoPreview: string | null;
  ubicacionElegida: boolean;
  /** Vuelve al paso para corregir (el formulario conserva lo capturado). */
  alEditar: (paso: PasoEditable) => void;
}

const SIN_DATO = <span className="text-ink-muted">No indicado</span>;

function Dato({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5 py-2.5 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-4">
      <dt className="text-[13px] text-ink-muted">{etiqueta}</dt>
      <dd className="min-w-0 break-words text-[15px] text-ink">{children}</dd>
    </div>
  );
}

function Grupo({
  titulo,
  paso,
  alEditar,
  children,
}: {
  titulo: string;
  paso: PasoEditable;
  alEditar: (paso: PasoEditable) => void;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-line px-4 py-3 sm:px-5">
      <div className="flex items-center justify-between gap-3 border-b border-line pb-2.5">
        <h4 className="font-display text-base font-semibold text-ink">{titulo}</h4>
        <Button variante="fantasma" tamano="sm" icono={Pencil} onClick={() => alEditar(paso)}>
          Editar<span className="sr-only"> {titulo.toLowerCase()}</span>
        </Button>
      </div>
      <dl className="divide-y divide-line">{children}</dl>
    </div>
  );
}

/**
 * Último paso del registro de empresa: repite lo capturado para confirmarlo
 * antes de enviar (DISENO.md §6). La contraseña no se muestra.
 */
export default function ResumenSolicitud({ datos, logoPreview, ubicacionElegida, alEditar }: ResumenSolicitudProps) {
  const nombreCompleto = [datos.nombre, datos.apellidoPaterno, datos.apellidoMaterno].filter(Boolean).join(' ');
  // El mismo formato con el que se envía la dirección (direccionEmpresa).
  const direccion = `${datos.calle}, ${datos.colonia}, ${datos.ciudad}, CP ${datos.codigoPostal}`;

  return (
    <div className="grid gap-4">
      <Grupo titulo="Tu cuenta" paso="cuenta" alEditar={alEditar}>
        <Dato etiqueta="Nombre">{nombreCompleto || SIN_DATO}</Dato>
        <Dato etiqueta="Departamento">{datos.departamento || SIN_DATO}</Dato>
        <Dato etiqueta="Correo electrónico">{datos.correoEmpresa || SIN_DATO}</Dato>
      </Grupo>

      <Grupo titulo="Tu empresa" paso="empresa" alEditar={alEditar}>
        <Dato etiqueta="Nombre comercial">
          <span className="flex items-center gap-3">
            <span className="flex h-9 w-9 flex-none items-center justify-center overflow-hidden rounded-full border border-line bg-paper">
              {logoPreview ? (
                // Vista previa local (blob:), no pasa por next/image.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoPreview} alt="Logo de la empresa" className="h-full w-full object-cover" />
              ) : (
                <Building2 className="h-4 w-4 text-ink-muted" aria-hidden="true" />
              )}
            </span>
            <span className="min-w-0">{datos.nombreEmpresa || SIN_DATO}</span>
          </span>
        </Dato>
        <Dato etiqueta="Razón social">{datos.razonSocial || SIN_DATO}</Dato>
        <Dato etiqueta="RFC">
          <span className="font-display tabular-nums tracking-wide">{datos.rfc.toUpperCase() || SIN_DATO}</span>
        </Dato>
        <Dato etiqueta="Sitio web">{datos.sitioWeb || SIN_DATO}</Dato>
      </Grupo>

      <Grupo titulo="Ubicación" paso="ubicacion" alEditar={alEditar}>
        <Dato etiqueta="Dirección">{direccion}</Dato>
        <Dato etiqueta="Mapa">
          {ubicacionElegida ? (
            <Badge tono="exito">Ubicación marcada en el mapa</Badge>
          ) : (
            <Badge tono="neutro">Sin marcar en el mapa (opcional)</Badge>
          )}
        </Dato>
      </Grupo>

      <Grupo titulo="Documentos" paso="documentos" alEditar={alEditar}>
        <Dato etiqueta="Identificación">
          {datos.identificacion
            ? `${datos.identificacion.name} · ${formatearTamano(datos.identificacion.size)}`
            : SIN_DATO}
        </Dato>
        <Dato etiqueta="Constancia de Situación Fiscal">
          {datos.documentosConstitucion
            ? `${datos.documentosConstitucion.name} · ${formatearTamano(datos.documentosConstitucion.size)}`
            : SIN_DATO}
        </Dato>
      </Grupo>
    </div>
  );
}
