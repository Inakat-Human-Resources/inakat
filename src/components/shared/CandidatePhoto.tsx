// RUTA: src/components/shared/CandidatePhoto.tsx

'use client';

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

export default function CandidatePhoto({ fotoUrl, candidateName, size = 'md', className = '' }: CandidatePhotoProps) {
  const { container, icon } = sizeMap[size];

  return (
    <div className={`${container} relative rounded-full overflow-hidden bg-gray-100 flex items-center justify-center flex-shrink-0 border border-gray-200 ${className}`}>
      {fotoUrl ? (
        <Image
          src={fotoUrl}
          alt={`Foto de ${candidateName}`}
          fill
          className="object-cover"
          sizes={`(max-width: 768px) ${icon * 2}px, ${icon * 2}px`}
        />
      ) : (
        <User className="text-gray-400" size={icon} />
      )}
    </div>
  );
}
