// RUTA: src/components/shared/CandidatePhoto.tsx

'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { iniciales } from '@/lib/nav-app';

interface CandidatePhotoProps {
  fotoUrl?: string | null;
  candidateName: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  /**
   * La foto va junto al nombre escrito (una cabecera, un título): alt vacío,
   * así el lector de pantalla no lee «Foto de Ana Ruiz, Ana Ruiz».
   */
  decorativa?: boolean;
}

/**
 * Tamaños: sm 32 · md 40 · lg 64 · xl 96 px. `icon` es la referencia para
 * `sizes` de next/image (el doble del icono ≈ el ancho real en pantallas 2x).
 */
const sizeMap = {
  sm: { container: 'w-8 h-8', icon: 14, letra: 'text-[11px]' },
  md: { container: 'w-10 h-10', icon: 18, letra: 'text-[13px]' },
  lg: { container: 'w-16 h-16', icon: 28, letra: 'text-lg' },
  xl: { container: 'w-24 h-24', icon: 40, letra: 'text-2xl' },
};

/**
 * ¿Se puede pintar esta foto con next/image? (#PERF-002)
 *
 * next/image LANZA en el render si el host no está en `images.remotePatterns`
 * (sólo *.public.blob.vercel-storage.com). Antes de validar fotoUrl en la API,
 * una foto con cualquier otro host tiraba la ficha entera del candidato para
 * reclutador, especialista y empresa. Las rutas locales '/uploads/…' (fallback
 * de desarrollo) también valen.
 */
export function esFotoRenderizable(fotoUrl?: string | null): fotoUrl is string {
  if (!fotoUrl) return false;
  if (fotoUrl.startsWith('/') && !fotoUrl.startsWith('//')) return true;
  try {
    const parsed = new URL(fotoUrl);
    return (
      parsed.protocol === 'https:' &&
      parsed.hostname.endsWith('.public.blob.vercel-storage.com')
    );
  } catch {
    return false;
  }
}

/**
 * Foto del candidato en un círculo. Sin foto (o si no carga), las iniciales en
 * tinta sobre lima (5.67:1), igual que el Avatar del sistema: distinguen a una
 * persona de otra en una lista mejor que un icono genérico. Las iniciales son
 * decorativas (el nombre siempre va escrito al lado).
 *
 * La raíz es un <span>: así cabe dentro de un encabezado (el título del Modal).
 */
export default function CandidatePhoto({
  fotoUrl,
  candidateName,
  size = 'md',
  className = '',
  decorativa = false,
}: CandidatePhotoProps) {
  const { container, icon, letra } = sizeMap[size];

  // #PERF-002: si la imagen no carga (borrada del blob, URL caducada…), se
  // vuelve a las iniciales en vez de dejar una imagen rota.
  const [fallo, setFallo] = useState(false);
  useEffect(() => {
    setFallo(false);
  }, [fotoUrl]);

  const mostrarFoto = esFotoRenderizable(fotoUrl) && !fallo;

  if (mostrarFoto) {
    return (
      <span
        className={cn(
          container,
          'relative flex flex-none items-center justify-center overflow-hidden rounded-full bg-mist ring-1 ring-inset ring-ink/10',
          className
        )}
      >
        <Image
          src={fotoUrl as string}
          alt={decorativa ? '' : `Foto de ${candidateName}`}
          fill
          className="object-cover"
          sizes={`(max-width: 768px) ${icon * 2}px, ${icon * 2}px`}
          onError={() => setFallo(true)}
        />
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        container,
        letra,
        'flex flex-none select-none items-center justify-center rounded-full bg-lime font-display font-bold leading-none text-ink',
        className
      )}
    >
      {iniciales(candidateName)}
    </span>
  );
}
