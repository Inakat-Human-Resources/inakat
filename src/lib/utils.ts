import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Asegura que una URL tenga protocolo https://.
 * Si la URL ya tiene protocolo (http:// o https://), la deja intacta.
 * Si no tiene protocolo, le agrega https://.
 * Retorna undefined si el input es undefined.
 */
export const normalizeUrl = (url: string | undefined): string | undefined =>
  url && !url.startsWith('http') ? `https://${url}` : url;
