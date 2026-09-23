// RUTA: src/lib/auth-events.ts
//
// Aviso global de "la sesión cambió" para que el Navbar vuelva a leer
// /api/auth/me sin esperar a un cambio de ruta. Antes, publicar una vacante
// (que descuenta créditos) o guardar el perfil dejaba el menú del avatar con el
// saldo y el nombre viejos: dos cifras distintas en la misma pantalla.
//
// Uso desde cualquier pantalla cliente, después de una acción que cambia
// créditos, nombre o rol:
//
//   import { notifyAuthChanged } from '@/lib/auth-events';
//   ...
//   notifyAuthChanged();

export const AUTH_REFRESH_EVENT = 'inakat:auth-refresh';

export function notifyAuthChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(AUTH_REFRESH_EVENT));
}
