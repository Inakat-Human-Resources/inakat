// RUTA: src/components/shared/CompanyLogo.tsx

'use client';

import Image from 'next/image';
import { Building2 } from 'lucide-react';

interface CompanyLogoProps {
  logoUrl?: string | null;
  companyName: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeMap = {
  xs: { container: 'w-6 h-6', icon: 12 },
  sm: { container: 'w-8 h-8', icon: 16 },
  md: { container: 'w-10 h-10', icon: 20 },
  lg: { container: 'w-12 h-12', icon: 24 },
  xl: { container: 'w-16 h-16', icon: 32 },
};

export default function CompanyLogo({
  logoUrl,
  companyName,
  size = 'md',
  className = '',
}: CompanyLogoProps) {
  const { container, icon } = sizeMap[size];

  // Si hay logo válido, mostrar imagen
  if (logoUrl) {
    return (
      <div
        className={`${container} relative rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 ${className}`}
      >
        <Image
          src={logoUrl}
          alt={`Logo de ${companyName}`}
          fill
          className="object-cover"
          sizes={`(max-width: 768px) ${icon * 2}px, ${icon * 2}px`}
        />
      </div>
    );
  }

  // Fallback: Icono de edificio con inicial de empresa
  return (
    <div
      className={`${container} rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 ${className}`}
      title={companyName}
    >
      <Building2 className="text-gray-400" size={icon} />
    </div>
  );
}
