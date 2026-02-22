// RUTA: src/components/shared/DistanceBadge.tsx
'use client';

import { MapPin, Car, Bus } from 'lucide-react';
import { getDistanceInfo } from '@/lib/distance';

interface DistanceBadgeProps {
  candidateLat?: number | null;
  candidateLng?: number | null;
  jobLat?: number | null;
  jobLng?: number | null;
  compact?: boolean;
}

export default function DistanceBadge({
  candidateLat,
  candidateLng,
  jobLat,
  jobLng,
  compact = false,
}: DistanceBadgeProps) {
  const info = getDistanceInfo(candidateLat, candidateLng, jobLat, jobLng);

  if (!info) return null;

  const colorClass =
    info.distanceKm <= 10
      ? 'bg-green-50 text-green-700 border-green-200'
      : info.distanceKm <= 30
        ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
        : info.distanceKm <= 60
          ? 'bg-orange-50 text-orange-700 border-orange-200'
          : 'bg-red-50 text-red-700 border-red-200';

  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${colorClass}`}
        title={`Auto: ${info.driving} | Transporte: ${info.transit}`}
      >
        <MapPin size={10} />
        {info.distanceKm} km
      </span>
    );
  }

  return (
    <div className={`inline-flex items-center gap-3 px-3 py-1.5 rounded-lg text-xs border ${colorClass}`}>
      <span className="flex items-center gap-1 font-semibold">
        <MapPin size={12} />
        {info.distanceKm} km
      </span>
      <span className="flex items-center gap-1">
        <Car size={12} />
        {info.driving}
      </span>
      <span className="flex items-center gap-1">
        <Bus size={12} />
        {info.transit}
      </span>
    </div>
  );
}
