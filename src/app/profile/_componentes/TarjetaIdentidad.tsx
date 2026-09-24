// RUTA: src/app/profile/_componentes/TarjetaIdentidad.tsx
//
// Resumen de la persona en /profile: foto (con su botón de subir), nombre,
// correo, rol y edad; para la empresa, su nombre y sus créditos. Sólo
// presentación: la subida la hace la página (handleFotoUpload de siempre).

import type { ChangeEvent, RefObject } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import Card from '@/components/ui/Card';
import Avatar from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { FOCO_ETIQUETA_ARCHIVO } from './estilos';

export interface TarjetaIdentidadProps {
  nombre: string;
  email: string;
  /** Rol ya traducido («Candidato»). */
  rol: string;
  edad: number | null;
  fotoUrl: string | null;
  /** Subir foto (sólo candidatos). */
  foto?: {
    subiendo: boolean;
    inputRef: RefObject<HTMLInputElement | null>;
    alCambiar: (e: ChangeEvent<HTMLInputElement>) => void;
  };
  /** Datos de la empresa (rol empresa). */
  empresa?: { nombre: string; creditos: number };
}

export default function TarjetaIdentidad({ nombre, email, rol, edad, fotoUrl, foto, empresa }: TarjetaIdentidadProps) {
  const textoFoto = fotoUrl ? 'Cambiar foto de perfil' : 'Subir foto de perfil';
  return (
    <Card>
      <div className="flex items-center gap-4">
        <div className="relative flex-none">
          {fotoUrl ? (
            // La URL puede ser una ruta local de /api/upload (desarrollo) o un
            // blob: <img> como antes, sin el optimizador de next/image.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={fotoUrl}
              alt="Foto de perfil"
              className="h-16 w-16 rounded-full object-cover shadow-ap-1 ring-2 ring-white"
            />
          ) : (
            <Avatar nombre={nombre} email={email} tamano="lg" className="h-16 w-16 text-xl" />
          )}
          {foto && (
            // El input va con sr-only (no `hidden`): se alcanza con el tabulador
            // y se abre con Intro o Espacio; la etiqueta pinta el foco.
            // 28 px (h-7) y colgado de la esquina: a 32 px el círculo tapaba la
            // segunda inicial del avatar («AL» se leía «A»). Sigue por encima
            // del mínimo de 24 px de objetivo táctil (WCAG 2.5.8).
            <label
              className={`${FOCO_ETIQUETA_ARCHIVO} absolute -bottom-1.5 -right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-ink text-white shadow-ap-2 ring-2 ring-white transition-colors duration-150 hover:bg-teal`}
              title={textoFoto}
            >
              {foto.subiendo ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Camera className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              <span className="sr-only">{textoFoto}</span>
              <input
                type="file"
                ref={foto.inputRef}
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={foto.alCambiar}
                disabled={foto.subiendo}
              />
            </label>
          )}
        </div>
        <div className="min-w-0">
          <h2 className="truncate font-display text-lg font-semibold leading-snug text-ink">{nombre}</h2>
          <p className="truncate text-sm text-ink-muted">{email}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <Badge tono="info" sinPunto>
              {rol}
            </Badge>
            {edad !== null && <span className="text-[13px] tabular-nums text-ink-muted">{edad} años</span>}
          </div>
        </div>
      </div>

      {foto && <p className="mt-4 text-xs text-ink-muted">Foto: JPG, PNG o WebP, de hasta 2MB.</p>}

      {empresa && (
        <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-line pt-4">
          <div className="min-w-0">
            <dt className="text-xs text-ink-muted">Empresa</dt>
            <dd className="truncate text-sm font-semibold text-ink">{empresa.nombre}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-muted">Créditos disponibles</dt>
            <dd className="font-display text-lg font-semibold tabular-nums text-ink">{empresa.creditos}</dd>
          </div>
        </dl>
      )}
    </Card>
  );
}
