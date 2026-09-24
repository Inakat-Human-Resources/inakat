// RUTA: src/components/ui/CampoContrasena.tsx
'use client';

import { forwardRef } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input, type InputProps } from './FormField';
import IconButton from './IconButton';
import { cn } from '@/lib/utils';

export interface CampoContrasenaProps extends Omit<InputProps, 'type' | 'prefijo' | 'sufijo'> {
  /** ¿Se ve el texto? (el estado lo lleva la página, como siempre). */
  visible: boolean;
  alAlternar: () => void;
  /** Nombre accesible del botón («Mostrar contraseña actual»…). */
  etiquetaMostrar?: string;
  etiquetaOcultar?: string;
  /** sm (32 px, campos de 40 px: por defecto) o md (40 px, campos altos de las páginas de acceso). */
  tamanoBoton?: 'sm' | 'md';
}

/**
 * Contraseña con el botón de mostrar/ocultar DENTRO del campo (el `sufijo` de
 * Input). Va dentro de un <FormField>, como cualquier <Input>: recibe de él su
 * id, aria-describedby, aria-invalid y required.
 *
 *   <FormField etiqueta="Contraseña" requerido>
 *     <CampoContrasena value={pw} onChange={…} visible={ver} alAlternar={() => setVer(!ver)}
 *       autoComplete="new-password" />
 *   </FormField>
 *
 * El botón dice su estado con aria-pressed y cambia de nombre (Mostrar/Ocultar).
 */
const CampoContrasena = forwardRef<HTMLInputElement, CampoContrasenaProps>(function CampoContrasena(
  {
    visible,
    alAlternar,
    etiquetaMostrar = 'Mostrar contraseña',
    etiquetaOcultar = 'Ocultar contraseña',
    tamanoBoton = 'sm',
    className,
    ...props
  },
  ref
) {
  return (
    <Input
      ref={ref}
      {...props}
      type={visible ? 'text' : 'password'}
      className={cn(tamanoBoton === 'md' && 'pr-12', className)}
      sufijo={
        <IconButton
          etiqueta={visible ? etiquetaOcultar : etiquetaMostrar}
          icono={visible ? EyeOff : Eye}
          tamano={tamanoBoton}
          aria-pressed={visible}
          onClick={alAlternar}
          className="text-ink-muted hover:text-ink"
        />
      }
    />
  );
});

export default CampoContrasena;
