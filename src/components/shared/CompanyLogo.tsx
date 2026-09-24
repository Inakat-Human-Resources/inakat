// RUTA: src/components/shared/CompanyLogo.tsx

'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CompanyLogoProps {
  logoUrl?: string | null;
  companyName: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

/** Tamaños: xs 24 · sm 32 · md 40 · lg 48 · xl 64 px. */
const sizeMap = {
  xs: { container: 'w-6 h-6', icon: 12 },
  sm: { container: 'w-8 h-8', icon: 16 },
  md: { container: 'w-10 h-10', icon: 20 },
  lg: { container: 'w-12 h-12', icon: 24 },
  xl: { container: 'w-16 h-16', icon: 32 },
};

/**
 * Logo de la empresa en un cuadro redondeado. Los logos suelen venir con fondo
 * transparente y proporciones libres: van sobre blanco y enteros
 * (object-contain), sin recortarlos. Sin logo, un edificio en verde azulado
 * sobre su tinte (6.18:1), con el mismo nombre accesible que tendría la imagen.
 */
export default function CompanyLogo({
  logoUrl,
  companyName,
  size = 'md',
  className = '',
}: CompanyLogoProps) {
  const { container, icon } = sizeMap[size];
  // `logoUrl` se persiste tal cual llega del cliente y next.config.ts sólo
  // autoriza *.public.blob.vercel-storage.com en images.remotePatterns: con
  // cualquier otro host (o un blob ya borrado) el optimizador responde 400 y
  // sin `onError` se quedaba el icono de imagen rota del navegador en vez del
  // fallback de edificio que el componente promete.
  // Se guarda la URL que falló, no un booleano: si el componente recibe después
  // otro logo (misma instancia, otra empresa) hay que volver a intentarlo.
  const [urlFallida, setUrlFallida] = useState<string | null>(null);

  if (logoUrl && urlFallida !== logoUrl) {
    return (
      <div
        className={cn(
          container,
          'relative flex-none overflow-hidden rounded-lg bg-white ring-1 ring-inset ring-line',
          className
        )}
      >
        <Image
          src={logoUrl}
          alt={`Logo de ${companyName}`}
          fill
          className="object-contain p-[8%]"
          sizes={`(max-width: 768px) ${icon * 2}px, ${icon * 2}px`}
          onError={() => setUrlFallida(logoUrl)}
        />
      </div>
    );
  }

  // Sin logo (o no cargó): edificio sobre el tinte verde azulado.
  return (
    <div
      role="img"
      aria-label={`Logo de ${companyName}`}
      title={companyName}
      className={cn(
        container,
        'flex flex-none items-center justify-center rounded-lg bg-teal-tint text-teal',
        className
      )}
    >
      <Building2 size={icon} aria-hidden="true" />
    </div>
  );
}
