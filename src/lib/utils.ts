import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge, validators } from "tailwind-merge";

/**
 * tailwind-merge 3.x sigue la semántica de Tailwind 4, pero este proyecto usa
 * Tailwind 3. La diferencia que se cobra: en Tailwind 4 `outline` es un ANCHO
 * (1px) y en Tailwind 3 es un ESTILO (`outline-style: solid`). Sin este ajuste,
 * `cn('focus-visible:outline focus-visible:outline-2 …')` quitaba
 * `focus-visible:outline` por «chocar» con `outline-2` y el elemento se quedaba
 * sin anillo de foco (salvo que globals.css se lo diera por su cuenta).
 *
 * - `outline` (sin sufijo) pasa al grupo de estilo, como en Tailwind 3.
 * - `outline-N` sigue siendo el ancho.
 * - `shadow-ap-1/2/3` (tailwind.config.ts) son sombras, no colores de sombra.
 */
const twMerge = extendTailwindMerge({
  override: {
    classGroups: {
      "outline-w": [
        {
          outline: [
            validators.isNumber,
            validators.isArbitraryVariableLength,
            validators.isArbitraryLength,
          ],
        },
      ],
    },
  },
  extend: {
    classGroups: {
      "outline-style": [{ outline: [""] }],
      shadow: [{ shadow: ["ap-1", "ap-2", "ap-3"] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Asegura que una URL tenga protocolo https://.
 *
 * La comprobación anterior (`!url.startsWith('http')`) distinguía mayúsculas y
 * no hacía trim, así que los teclados móviles —que capitalizan la primera letra
 * de un input de texto— producían 'Https://linkedin.com/in/ana' y se guardaba
 * 'https://Https://linkedin.com/in/ana', un host inexistente. También rompía las
 * rutas relativas que devuelve /api/upload en desarrollo ('/uploads/cv.pdf' →
 * 'https:///uploads/cv.pdf').
 *
 * - Cadena vacía o sólo espacios → undefined.
 * - Ruta relativa ('/uploads/…') → se deja tal cual.
 * - Ya trae esquema http(s), en cualquier caja → se conserva, con el esquema en
 *   minúsculas.
 * - Cualquier otra cosa → se le antepone https://.
 */
export const normalizeUrl = (url?: string | null): string | undefined => {
  const limpio = url?.trim();
  if (!limpio) return undefined;
  if (limpio.startsWith('/')) return limpio;
  if (/^https?:\/\//i.test(limpio)) {
    return limpio.replace(/^https?/i, (esquema) => esquema.toLowerCase());
  }
  return `https://${limpio}`;
};

/**
 * URL pública de la aplicación, para construir enlaces que viajan por correo.
 *
 * CONFIG (AUTH-005): el correo de recuperación leía `NEXT_PUBLIC_BASE_URL`, una
 * variable que no existe en .env.example ni en la documentación —el resto del
 * proyecto usa NEXT_PUBLIC_APP_URL—, así que caía SIEMPRE al literal
 * 'https://inakat.com'. En staging, en una preview o en local, el enlace de
 * reset apuntaba a producción, donde ese token no existe: el flujo de
 * recuperación era imposible de probar fuera de producción.
 *
 * SEGURIDAD: en producción NUNCA se usa el origen de la petición. Ese origen
 * sale de la cabecera Host, que controla quien hace la petición: un atacante
 * que pidiera "olvidé mi contraseña" para la víctima con `Host: evil.tld`
 * haría que el enlace del correo —con el token dentro— apuntara a su servidor.
 *
 * @param requestUrl - URL de la petición en curso; fuera de producción su
 *   origen es el último recurso antes de caer al dominio de producción.
 */
export function getAppUrl(requestUrl?: string): string {
  const configurada = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configurada) return configurada.replace(/\/+$/, '');

  if (requestUrl && process.env.NODE_ENV !== 'production') {
    try {
      return new URL(requestUrl).origin;
    } catch {
      // URL no parseable: se usa el dominio de producción de abajo.
    }
  }

  return 'https://inakat.com';
}
