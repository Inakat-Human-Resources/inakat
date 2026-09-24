// RUTA: src/components/shared/DistanceBadge.tsx
'use client';

import { MapPin, Car, Bus, TriangleAlert } from 'lucide-react';
import { getDistanceInfo } from '@/lib/distance';
import { cn } from '@/lib/utils';

interface DistanceBadgeProps {
  candidateLat?: number | null;
  candidateLng?: number | null;
  jobLat?: number | null;
  jobLng?: number | null;
  compact?: boolean;
}

/**
 * A partir de aquí el candidato queda «lejos» de la vacante (a 25 km/h,
 * estimateTravelTime, más de 1 h 10 min en auto). Es el mismo corte donde
 * antes el chip pasaba de verde azulado a naranja.
 */
export const UMBRAL_LEJOS_KM = 30;

/**
 * Chip de distancia del candidato a la vacante. UNO para todos los paneles
 * (empresa, reclutador, especialista y la ficha del candidato).
 *
 * Antes la cercanía se decía sólo con color (lima, teal, naranja, rojo): un
 * 73.9 km en rojo y un 11.9 km en teal no decían «lejos» ni «cerca» a quien
 * no distingue colores, y el mismo color no significaba lo mismo entre
 * paneles. Ahora el chip es NEUTRO para todas las distancias (la cifra manda)
 * y, pasado UMBRAL_LEJOS_KM, lleva un icono de aviso y el texto «lejos»:
 * color Y texto (docs/DISENO.md §0.4).
 *
 * Contraste (fórmula WCAG): #4a5557 / mist 6.44 (el de Badge neutro) ·
 * orange-dark / mist 5.94 (icono y «lejos»).
 */
export default function DistanceBadge({
  candidateLat,
  candidateLng,
  jobLat,
  jobLng,
  compact = false,
}: DistanceBadgeProps) {
  const info = getDistanceInfo(candidateLat, candidateLng, jobLat, jobLng);

  if (!info) return null;

  const lejos = info.distanceKm > UMBRAL_LEJOS_KM;
  const Icono = lejos ? TriangleAlert : MapPin;

  // Compacto (listas y tablas): sólo los km a la vista; los tiempos, en el
  // globo al pasar y, para el lector de pantalla, en texto (el `title` no lo
  // ven el teclado ni el móvil).
  if (compact) {
    return (
      <span
        className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-mist px-2 py-0.5 text-xs font-medium tabular-nums text-[#4a5557]"
        title={`Auto: ${info.driving} | Transporte: ${info.transit}`}
      >
        <Icono size={11} className={cn('flex-none', lejos && 'text-orange-dark')} aria-hidden="true" />
        <span className="sr-only">A </span>
        {info.distanceKm} km
        {lejos && (
          <span className="text-orange-dark" aria-hidden="true">
            {' '}· lejos
          </span>
        )}
        <span className="sr-only">
          {' '}de la vacante{lejos ? ' (lejos)' : ''}: {info.driving} en auto, {info.transit} en transporte público
        </span>
      </span>
    );
  }

  return (
    <div className="inline-flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-mist px-2.5 py-1.5 text-xs tabular-nums text-[#4a5557]">
      <span className="flex items-center gap-1 font-semibold">
        <Icono size={12} className={cn('flex-none', lejos && 'text-orange-dark')} aria-hidden="true" />
        <span className="sr-only">Distancia a la vacante: </span>
        {info.distanceKm} km
        {lejos && (
          <span className="font-medium text-orange-dark">
            <span aria-hidden="true"> · </span>
            <span className="sr-only">, </span>
            lejos
          </span>
        )}
      </span>
      <span className="flex items-center gap-1">
        <Car size={12} aria-hidden="true" />
        <span className="sr-only">En auto: </span>
        {info.driving}
      </span>
      <span className="flex items-center gap-1">
        <Bus size={12} aria-hidden="true" />
        <span className="sr-only">En transporte público: </span>
        {info.transit}
      </span>
    </div>
  );
}
