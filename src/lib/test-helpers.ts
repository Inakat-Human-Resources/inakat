// RUTA: src/lib/test-helpers.ts

/**
 * Helpers para testing de route handlers de Next.js
 * Permite testear handlers directamente sin levantar el servidor
 */

/**
 * Crea un Request para testing de route handlers
 */
export function createTestRequest(
  url: string,
  options: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
    searchParams?: Record<string, string>;
  } = {}
): Request {
  const { method = 'GET', body, headers = {}, searchParams = {} } = options;

  const urlObj = new URL(url, 'http://localhost:3000');
  Object.entries(searchParams).forEach(([key, value]) => {
    urlObj.searchParams.set(key, value);
  });

  const requestInit: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };

  if (body && method !== 'GET') {
    requestInit.body = JSON.stringify(body);
  }

  return new Request(urlObj.toString(), requestInit);
}

/**
 * Genera headers de cookie mock para testing con rol específico
 */
export function createMockAuthHeader(role: string = 'admin'): Record<string, string> {
  return { Cookie: `auth-token=mock-${role}-token` };
}
