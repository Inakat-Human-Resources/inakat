// RUTA: src/hooks/useSesion.ts
'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AUTH_REFRESH_EVENT } from '@/lib/auth-events';

/** Lo que la navegación necesita saber de quien tiene la sesión abierta. */
export interface UsuarioSesion {
  userId: number;
  email: string;
  role: string;
  nombre?: string;
  credits?: number;
}

export interface Sesion {
  usuario: UsuarioSesion | null;
  /** true hasta que llega la primera respuesta de /api/auth/me. */
  cargando: boolean;
  /** Vuelve a leer /api/auth/me (lo mismo que notifyAuthChanged()). */
  refrescar: () => Promise<void>;
  /** POST /api/auth/logout; sólo redirige si el servidor confirmó el cierre. */
  cerrarSesion: () => Promise<void>;
  cerrando: boolean;
  /** Mensaje si el cierre de sesión falló (la sesión sigue viva). */
  errorCierre: string | null;
}

/**
 * Sesión de la navegación (PublicNav y AppShell). Es la lógica que tenía el
 * Navbar antiguo, sin cambiar una llamada:
 *
 * - Lee GET /api/auth/me (con cookies) al montar y en cada cambio de ruta.
 * - Revalida SIN cambiar de ruta con el evento global de
 *   '@/lib/auth-events' (notifyAuthChanged(): publicar una vacante descuenta
 *   créditos, guardar el perfil cambia el nombre), al recuperar el foco y al
 *   volver a la pestaña — así se detecta una sesión caducada con la pestaña
 *   abierta (UI-004).
 * - Cierra sesión con POST /api/auth/logout. La cookie auth-token es httpOnly:
 *   si el servidor no la borró, el cliente NO puede, así que un fallo se avisa
 *   y NO se redirige (en un equipo compartido la sesión seguiría viva, UI-018).
 */
export function useSesion(): Sesion {
  const pathname = usePathname();
  const router = useRouter();
  const [usuario, setUsuario] = useState<UsuarioSesion | null>(null);
  const [cargando, setCargando] = useState(true);
  const [cerrando, setCerrando] = useState(false);
  const [errorCierre, setErrorCierre] = useState<string | null>(null);

  const refrescar = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/me', {
        method: 'GET',
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.user) {
          setUsuario({
            userId: data.user.id,
            email: data.user.email,
            role: data.user.role,
            nombre: data.user.nombre,
            credits: data.user.credits || 0,
          });
        } else {
          setUsuario(null);
        }
      } else {
        setUsuario(null);
      }
    } catch (error) {
      console.error('Error checking auth:', error);
      setUsuario(null);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    refrescar();
  }, [pathname, refrescar]);

  useEffect(() => {
    const alVolver = () => {
      if (document.visibilityState === 'visible') refrescar();
    };

    window.addEventListener(AUTH_REFRESH_EVENT, refrescar);
    window.addEventListener('focus', refrescar);
    document.addEventListener('visibilitychange', alVolver);

    return () => {
      window.removeEventListener(AUTH_REFRESH_EVENT, refrescar);
      window.removeEventListener('focus', refrescar);
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, [refrescar]);

  const cerrarSesion = useCallback(async () => {
    setCerrando(true);
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        console.error('Error logging out: response not ok');
        setErrorCierre('No se pudo cerrar la sesión. Inténtalo de nuevo.');
        return;
      }
    } catch (error) {
      console.error('Error logging out:', error);
      setErrorCierre('No se pudo cerrar la sesión. Revisa tu conexión.');
      return;
    } finally {
      setCerrando(false);
    }

    // Sólo si el servidor confirmó el cierre: limpiar estado local y salir.
    setErrorCierre(null);
    setUsuario(null);
    router.push('/');
    router.refresh();
  }, [router]);

  return { usuario, cargando, refrescar, cerrarSesion, cerrando, errorCierre };
}
