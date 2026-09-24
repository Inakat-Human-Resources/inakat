// RUTA: src/app/profile/_componentes/PanelCuenta.tsx
//
// Pestaña «Cuenta» de /profile (y todo el perfil de quien no es candidato):
// nombre de usuario, correo (fijo) y cambio de contraseña. Sólo presentación:
// los campos son los del <form> de la página y se envían con su handleSubmit.

import Card from '@/components/ui/Card';
import FormField, { Input } from '@/components/ui/FormField';
import CampoContrasenaSistema from '@/components/ui/CampoContrasena';

/** Un campo de texto controlado. */
interface Campo {
  valor: string;
  alCambiar: (valor: string) => void;
}

export interface PanelCuentaProps {
  nombre: Campo;
  email: string;
  contrasenaActual: Campo & { visible: boolean; alternar: () => void };
  contrasenaNueva: Campo & { visible: boolean; alternar: () => void };
  confirmacion: Campo;
}

/** Contraseña con el botón de mostrar/ocultar dentro del campo. */
function CampoContrasena({
  etiqueta,
  ayuda,
  campo,
  autoComplete,
  placeholder,
}: {
  etiqueta: string;
  ayuda?: string;
  campo: Campo & { visible: boolean; alternar: () => void };
  autoComplete: string;
  placeholder: string;
}) {
  const nombre = etiqueta.toLowerCase();
  return (
    <FormField etiqueta={etiqueta} ayuda={ayuda}>
      <CampoContrasenaSistema
        visible={campo.visible}
        alAlternar={campo.alternar}
        etiquetaMostrar={`Mostrar ${nombre}`}
        etiquetaOcultar={`Ocultar ${nombre}`}
        value={campo.valor}
        onChange={(e) => campo.alCambiar(e.target.value)}
        autoComplete={autoComplete}
        placeholder={placeholder}
      />
    </FormField>
  );
}

export default function PanelCuenta({ nombre, email, contrasenaActual, contrasenaNueva, confirmacion }: PanelCuentaProps) {
  return (
    <>
      <Card id="perfil-cuenta" titulo="Datos de cuenta" className="scroll-mt-32">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField etiqueta="Nombre de usuario">
            <Input
              type="text"
              value={nombre.valor}
              onChange={(e) => nombre.alCambiar(e.target.value)}
              autoComplete="nickname"
              placeholder="Tu nombre de usuario"
            />
          </FormField>
          <FormField etiqueta="Email" ayuda="El email no se puede cambiar">
            <Input type="email" value={email} disabled />
          </FormField>
        </div>
      </Card>

      <Card titulo="Cambiar contraseña" descripcion="Deja estos campos vacíos si no deseas cambiar tu contraseña">
        <div className="grid max-w-xl grid-cols-1 gap-4">
          <CampoContrasena
            etiqueta="Contraseña actual"
            campo={contrasenaActual}
            autoComplete="current-password"
            placeholder="Tu contraseña actual"
          />
          <CampoContrasena
            etiqueta="Nueva contraseña"
            ayuda="Mínimo 8 caracteres, con al menos una mayúscula y un número."
            campo={contrasenaNueva}
            autoComplete="new-password"
            placeholder="Mínimo 8 caracteres"
          />
          <FormField etiqueta="Confirmar nueva contraseña">
            <Input
              type="password"
              value={confirmacion.valor}
              onChange={(e) => confirmacion.alCambiar(e.target.value)}
              autoComplete="new-password"
              placeholder="Repite la nueva contraseña"
            />
          </FormField>
        </div>
      </Card>
    </>
  );
}
