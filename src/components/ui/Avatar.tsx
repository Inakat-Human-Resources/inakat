// RUTA: src/components/ui/Avatar.tsx

import { cn } from '@/lib/utils';
import { iniciales } from '@/lib/nav-app';

/**
 * Círculo con las iniciales (tinta sobre lima: 5.67:1). Decorativo: el nombre
 * va siempre en texto al lado.
 *
 *   <Avatar nombre="Ana Ruiz" email="ana@inakat.com" />
 */
export default function Avatar({
  nombre,
  email,
  tamano = 'md',
  className,
}: {
  nombre?: string | null;
  email?: string | null;
  tamano?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex flex-none items-center justify-center rounded-full bg-lime font-display font-bold text-ink',
        tamano === 'sm' && 'h-7 w-7 text-[11px]',
        tamano === 'md' && 'h-9 w-9 text-[13px]',
        tamano === 'lg' && 'h-12 w-12 text-base',
        className
      )}
    >
      {iniciales(nombre, email)}
    </span>
  );
}
