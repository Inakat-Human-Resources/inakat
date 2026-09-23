// RUTA: src/components/shared/CandidatePhoto.tsx

'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { User } from 'lucide-react';

interface CandidatePhotoProps {
  fotoUrl?: string | null;
  candidateName: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeMap = {
  sm: { container: 'w-8 h-8', icon: 14 },
  md: { container: 'w-10 h-10', icon: 18 },
  lg: { container: 'w-16 h-16', icon: 28 },
  xl: { container: 'w-24 h-24', icon: 40 },
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

export default function CandidatePhoto({ fotoUrl, candidateName, size = 'md', className = '' }: CandidatePhotoProps) {
  const { container, icon } = sizeMap[size];

  // #PERF-002: si la imagen no carga (borrada del blob, URL caducada…), se
  // vuelve al icono en vez de dejar una imagen rota.
  const [fallo, setFallo] = useState(false);
  useEffect(() => {
    setFallo(false);
  }, [fotoUrl]);

  const mostrarFoto = esFotoRenderizable(fotoUrl) && !fallo;

  return (
    <div className={`${container} relative rounded-full overflow-hidden bg-gray-100 flex items-center justify-center flex-shrink-0 border border-gray-200 ${className}`}>
      {mostrarFoto ? (
        <Image
          src={fotoUrl as string}
          alt={`Foto de ${candidateName}`}
          fill
          className="object-cover"
          sizes={`(max-width: 768px) ${icon * 2}px, ${icon * 2}px`}
          onError={() => setFallo(true)}
        />
      ) : (
        <User className="text-gray-400" size={icon} />
      )}
    </div>
  );
}
