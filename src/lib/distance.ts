// RUTA: src/lib/distance.ts

/**
 * Calcula la distancia en kilómetros entre dos puntos usando la fórmula Haversine
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Radio de la tierra en km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Estima el tiempo de traslado basado en distancia
 * Velocidades promedio aproximadas en ciudad mexicana
 */
export function estimateTravelTime(distanceKm: number): {
  driving: string;
  transit: string;
} {
  const drivingMinutes = Math.round((distanceKm / 25) * 60);
  const transitMinutes = Math.round((distanceKm / 15) * 60);

  return {
    driving: formatTime(drivingMinutes),
    transit: formatTime(transitMinutes),
  };
}

function formatTime(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
}

/**
 * Genera un objeto de distancia completo entre candidato y vacante
 * Retorna null si faltan coordenadas
 */
export function getDistanceInfo(
  candidateLat: number | null | undefined,
  candidateLng: number | null | undefined,
  jobLat: number | null | undefined,
  jobLng: number | null | undefined
): { distanceKm: number; driving: string; transit: string } | null {
  if (!candidateLat || !candidateLng || !jobLat || !jobLng) {
    return null;
  }
  const distanceKm = calculateDistance(candidateLat, candidateLng, jobLat, jobLng);
  const travelTime = estimateTravelTime(distanceKm);
  return {
    distanceKm,
    ...travelTime,
  };
}
