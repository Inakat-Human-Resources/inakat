// RUTA: src/app/login/_acceso/CampoContrasena.tsx
'use client';

// Contraseña con el botón de mostrar/ocultar, y la política de contraseña
// dicha en claro mientras se escribe. Presentación pura: el estado (el valor
// y si se ve) lo lleva la página, igual que antes.
//
// El campo es el del sistema (src/components/ui/CampoContrasena); aquí sólo se
// fija el botón de 40 px que piden los campos altos de las páginas de acceso.
// Los nombres «Mostrar/Ocultar contraseña» los buscan los tests (AUTHUI-025).
import { Check, Circle } from 'lucide-react';
import CampoContrasenaSistema, { type CampoContrasenaProps } from '@/components/ui/CampoContrasena';
import { cn } from '@/lib/utils';

export type { CampoContrasenaProps };

/**
 * Va dentro de un <FormField>, como cualquier <Input>: recibe de él su id,
 * aria-describedby, aria-invalid y required.
 */
export function CampoContrasena(props: CampoContrasenaProps) {
  return <CampoContrasenaSistema tamanoBoton="md" {...props} />;
}

/** Las mismas tres reglas que valida la página y exige el API. */
const REGLAS: Array<{ texto: string; cumple: (valor: string) => boolean }> = [
  { texto: 'Al menos 8 caracteres', cumple: (v) => v.length >= 8 },
  { texto: 'Una mayúscula', cumple: (v) => /[A-Z]/.test(v) },
  { texto: 'Un número', cumple: (v) => /[0-9]/.test(v) },
];

/**
 * La política de contraseña, marcada según se escribe. Estado con icono Y
 * texto (para el lector: «cumplido» / «pendiente»), nunca sólo color. Son
 * <span> porque va dentro del <p> de ayuda de FormField.
 */
export function RequisitosContrasena({ valor }: { valor: string }) {
  return (
    <span className="flex flex-wrap gap-x-4 gap-y-1">
      {REGLAS.map((regla) => {
        const ok = regla.cumple(valor);
        const Icono = ok ? Check : Circle;
        return (
          <span
            key={regla.texto}
            className={cn(
              'inline-flex items-center gap-1.5 transition-colors duration-150',
              // lime-dark sobre blanco: 8.92 · ink-muted sobre blanco: 5.85
              ok ? 'font-medium text-lime-dark' : 'text-ink-muted'
            )}
          >
            <Icono className={cn('h-3.5 w-3.5 flex-none', !ok && 'h-2.5 w-2.5')} strokeWidth={ok ? 3 : 2} aria-hidden="true" />
            {regla.texto}
            <span className="sr-only">{ok ? ' (cumplido)' : ' (pendiente)'}</span>
          </span>
        );
      })}
    </span>
  );
}
