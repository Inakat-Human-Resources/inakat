// RUTA: src/components/company/MapaNoDisponible.tsx

/**
 * Respaldo del mapa de la dirección cuando Google Maps no se puede usar.
 *
 * Sin él, lo primero que se veía en «Dirección de la empresa» era el diálogo
 * de Google en inglés («This page can't load Google Maps correctly. Do you own
 * this website?», BillingNotEnabledMapError) encima del mapa, o un «Cargando
 * mapa…» eterno si el script no llegaba. Casos que cubre (los junta la
 * página): sin clave, el script no carga (loadError) y la clave rechazada
 * (useFalloMapa, de src/hooks).
 *
 * Es de sólo lectura a propósito: con el mapa caído Google también apaga el
 * autocompletado, y una dirección escrita a mano se guardaría con las
 * coordenadas viejas (la distancia a los candidatos se mediría desde el punto
 * anterior). La dirección guardada se conserva y se enseña en texto.
 *
 * Contraste (fórmula WCAG): ink/paper 11.35 · ink-muted/paper 5.36 ·
 * teal/mist 6.17 (icono) · teal/paper 6.77 (icono).
 */

import { MapPin, MapPinOff } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';

export interface MapaNoDisponibleProps {
  /** La dirección que hay en el formulario (la guardada, si no se tocó). */
  direccion: string;
  /** ¿Tiene coordenadas? (sin ellas no se calcula la distancia a los candidatos). */
  conUbicacion: boolean;
  className?: string;
}

export default function MapaNoDisponible({ direccion, conUbicacion, className }: MapaNoDisponibleProps) {
  const hayDireccion = direccion.trim().length > 0;

  return (
    <div className={cn('rounded-xl border border-line bg-paper p-4 sm:p-5', className)}>
      <div className="flex items-start gap-3" role="status">
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-mist text-teal" aria-hidden="true">
          <MapPinOff className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="font-display text-[15px] font-semibold text-ink">Mapa no disponible</p>
          <p className="mt-0.5 text-sm text-ink-muted">
            {hayDireccion
              ? 'No pudimos cargar el mapa. Tu dirección guardada se conserva; para cambiarla o fijar el punto exacto, vuelve a intentarlo más tarde.'
              : 'No pudimos cargar el mapa. Para registrar la dirección de tu empresa, vuelve a intentarlo más tarde.'}
          </p>
        </div>
      </div>

      <dl className="mt-4 space-y-3 border-t border-line pt-4 text-sm">
        <div>
          <dt className="text-xs font-medium text-ink-muted">Dirección registrada</dt>
          <dd className="mt-1 flex items-start gap-2 font-medium text-ink">
            <MapPin className="mt-0.5 h-4 w-4 flex-none text-teal" aria-hidden="true" />
            <span className={cn('min-w-0 break-words', !hayDireccion && 'font-normal text-ink-muted')}>
              {hayDireccion ? direccion : 'Sin dirección registrada'}
            </span>
          </dd>
        </div>
        <div>
          <dt className="sr-only">Ubicación en el mapa</dt>
          <dd>
            {conUbicacion ? (
              <Badge tono="exito">Ubicación fijada en el mapa</Badge>
            ) : (
              <Badge tono="aviso">Sin ubicación en el mapa</Badge>
            )}
          </dd>
        </div>
      </dl>
    </div>
  );
}
