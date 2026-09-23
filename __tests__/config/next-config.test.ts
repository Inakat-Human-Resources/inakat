/**
 * @jest-environment node
 */
// RUTA: __tests__/config/next-config.test.ts
//
// INFRA-023: este test declaraba un array local con el hostname esperado y
// comprobaba que el array local contenía ese hostname. Nunca cargaba la
// configuración real: habría pasado aunque next.config.ts permitiera cualquier
// dominio o perdiera todas las cabeceras de seguridad (#86).
//
// Ahora se importa next.config.ts y se afirma sobre lo que Next va a usar.

import nextConfig from '../../next.config';

type Header = { key: string; value: string };

async function cabecerasGlobales(): Promise<Header[]> {
  expect(typeof nextConfig.headers).toBe('function');
  const reglas = await nextConfig.headers!();
  const global = reglas.find((r) => r.source === '/:path*');
  expect(global).toBeDefined();
  return global!.headers as Header[];
}

function valor(headers: Header[], key: string): string | undefined {
  return headers.find((h) => h.key.toLowerCase() === key.toLowerCase())?.value;
}

describe('next.config.ts — imágenes remotas', () => {
  it('sólo permite imágenes https de Vercel Blob', () => {
    const patrones = nextConfig.images?.remotePatterns ?? [];
    expect(patrones.length).toBeGreaterThan(0);

    for (const p of patrones) {
      if (p instanceof URL) throw new Error('remotePatterns no debe usar URL sueltas');
      expect(p.protocol).toBe('https');
      expect(p.hostname).toMatch(/\.public\.blob\.vercel-storage\.com$/);
    }
  });

  it('no admite comodines abiertos (** o hostnames de cualquier dominio)', () => {
    const patrones = nextConfig.images?.remotePatterns ?? [];
    for (const p of patrones) {
      if (p instanceof URL) continue;
      expect(p.hostname).not.toBe('**');
      expect(p.hostname.startsWith('**')).toBe(false);
    }
    expect(nextConfig.images?.domains ?? []).toEqual([]);
  });
});

describe('next.config.ts — cabeceras de seguridad (#86)', () => {
  it('envía X-Frame-Options, nosniff, HSTS, Referrer-Policy y Permissions-Policy', async () => {
    const headers = await cabecerasGlobales();

    expect(valor(headers, 'X-Frame-Options')).toBe('SAMEORIGIN');
    expect(valor(headers, 'X-Content-Type-Options')).toBe('nosniff');
    expect(valor(headers, 'Strict-Transport-Security')).toMatch(/max-age=\d{7,}/);
    expect(valor(headers, 'Referrer-Policy')).toBeTruthy();
    expect(valor(headers, 'Permissions-Policy')).toMatch(/camera=\(\)/);
  });

  it('no anuncia X-Powered-By (INFRA-014)', () => {
    expect(nextConfig.poweredByHeader).toBe(false);
  });
});

describe('next.config.ts — Content-Security-Policy (INFRA-014)', () => {
  it('declara una CSP (en Report-Only mientras no se valide en staging, o ya en enforce)', async () => {
    const headers = await cabecerasGlobales();
    const csp =
      valor(headers, 'Content-Security-Policy') ??
      valor(headers, 'Content-Security-Policy-Report-Only');
    expect(csp).toBeDefined();
  });

  it('la CSP cierra lo básico y permite los orígenes que la app necesita', async () => {
    const headers = await cabecerasGlobales();
    const csp = (valor(headers, 'Content-Security-Policy') ??
      valor(headers, 'Content-Security-Policy-Report-Only'))!;

    const directivas = new Map(
      csp.split(';').map((d) => {
        const [nombre, ...fuentes] = d.trim().split(/\s+/);
        return [nombre, fuentes] as const;
      })
    );

    expect(directivas.get('default-src')).toEqual(["'self'"]);
    expect(directivas.get('object-src')).toEqual(["'none'"]);
    expect(directivas.get('base-uri')).toEqual(["'self'"]);
    expect(directivas.get('frame-ancestors')).toEqual(["'self'"]);

    // Checkout de Mercado Pago (sólo /credits/purchase) y Google Maps.
    expect(directivas.get('script-src')).toEqual(
      expect.arrayContaining(['https://sdk.mercadopago.com', 'https://maps.googleapis.com'])
    );
    expect(directivas.get('frame-src')).toEqual(
      expect.arrayContaining(['https://*.mercadopago.com'])
    );
    // Logos, fotos y documentos servidos desde Vercel Blob.
    expect(directivas.get('img-src')).toEqual(
      expect.arrayContaining(['https://*.public.blob.vercel-storage.com'])
    );

    // Ninguna directiva abre la puerta a cualquier origen.
    for (const [, fuentes] of directivas) {
      expect(fuentes).not.toContain('*');
      expect(fuentes).not.toContain('https:');
      expect(fuentes).not.toContain('http:');
    }
  });
});
