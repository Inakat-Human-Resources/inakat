// RUTA: src/components/shared/CandidatePhoto.tsx

import { User } from 'lucide-react';

interface CandidatePhotoProps {
  fotoUrl?: string | null;
  candidateName: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeMap = {
  sm: 'w-8 h-8 text-sm',
  md: 'w-10 h-10 text-lg',
  lg: 'w-16 h-16 text-2xl',
  xl: 'w-24 h-24 text-3xl',
};

const iconSizeMap = {
  sm: 14,
  md: 18,
  lg: 28,
  xl: 40,
};

export default function CandidatePhoto({ fotoUrl, candidateName, size = 'md', className = '' }: CandidatePhotoProps) {
  const sizeClasses = sizeMap[size];
  const iconSize = iconSizeMap[size];

  return (
    <div className={`rounded-full overflow-hidden bg-gray-100 flex items-center justify-center flex-shrink-0 border border-gray-200 ${sizeClasses} ${className}`}>
      {fotoUrl ? (
        <img src={fotoUrl} alt={candidateName} className="w-full h-full object-cover" />
      ) : (
        <User className="text-gray-400" size={iconSize} />
      )}
    </div>
  );
}
