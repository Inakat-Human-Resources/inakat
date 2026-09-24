/**
 * RUTA: __tests__/qa/ui-shell-seo.test.ts
 *
 * Auditoría UI (septiembre 2026) — shell público, SEO y restos de CRA.
 *
 * Cubren:
 *  - UI-001: /terms y /privacy provisionales fuera del índice y del sitemap;
 *            los avisos de los formularios enlazan a ambos documentos.
 *  - UI-002/UI-012: cada página con su metadata; base, canonical y og.
 *  - UI-003: existen error.tsx y global-error.tsx.
 *  - UI-008/UI-009: restos de create-react-app eliminados; manifest de marca.
 *  - UI-010: el CTA compartido ya no cuelga de sections/home.
 *  - UI-011: el reveal sólo esconde contenido si hay JavaScript.
 *  - UI-015: sitemap y robots derivan el dominio del entorno; fechas estables.
 */
import fs from 'fs';
import path from 'path';

import sitemap from '@/app/sitemap';
import robots from '@/app/robots';
import manifest from '@/app/manifest';
import { SITE_URL } from '@/lib/site-url';
import { BASE_OPEN_GRAPH } from '@/lib/seo';
import type { Metadata } from 'next';
import {
  metadata as rootMetadata,
  viewport as rootViewport,
} from '@/app/layout';
import { metadata as aboutMetadata } from '@/app/about/page';
import { metadata as companiesMetadata } from '@/app/companies/page';
import { metadata as talentsMetadata } from '@/app/talents/page';
import { metadata as contactMetadata } from '@/app/contact/layout';
import { metadata as termsMetadata } from '@/app/terms/page';
import { metadata as privacyMetadata } from '@/app/privacy/page';

const existe = (rel: string): boolean =>
  fs.existsSync(path.join(process.cwd(), rel));

const leer = (rel: string): string =>
  fs.readFileSync(path.join(process.cwd(), rel), 'utf-8');

// ============================================================
// UI-015 / UI-001 — sitemap
// ============================================================

describe('UI-015: sitemap', () => {
  const entradas = sitemap();
  const urls = entradas.map((e) => e.url);

  it('deriva todas las URLs de la misma base configurable', () => {
    expect(urls.length).toBeGreaterThan(0);
    urls.forEach((url) => expect(url.startsWith(SITE_URL)).toBe(true));
  });

  it('no deja el dominio a mano en el código', () => {
    const fuente = leer('src/app/sitemap.ts');
    expect(fuente).not.toContain("'https://inakat.com'");
    expect(fuente).not.toContain('"https://inakat.com"');
  });

  it('las fechas no cambian entre builds (no usa new Date() por entrada)', () => {
    const otra = sitemap();
    expect(otra.map((e) => String(e.lastModified))).toEqual(
      entradas.map((e) => String(e.lastModified))
    );
    // Todas las fechas deben ser pasadas y fijas, no "ahora".
    entradas.forEach((e) => {
      const fecha = new Date(String(e.lastModified)).getTime();
      expect(Number.isNaN(fecha)).toBe(false);
      expect(fecha).toBeLessThan(Date.now());
    });
  });

  it('mantiene las páginas públicas reales', () => {
    ['/about', '/companies', '/talents', '/contact'].forEach((ruta) => {
      expect(urls).toContain(`${SITE_URL}${ruta}`);
    });
    expect(urls).toContain(SITE_URL);
  });

  it('UI-001: deja fuera /terms y /privacy mientras son provisionales', () => {
    expect(urls).not.toContain(`${SITE_URL}/terms`);
    expect(urls).not.toContain(`${SITE_URL}/privacy`);
  });
});

// ============================================================
// UI-015 — robots
// ============================================================

describe('UI-015: robots', () => {
  const salida = robots();
  const regla = Array.isArray(salida.rules) ? salida.rules[0] : salida.rules;
  const disallow = ([] as string[]).concat(regla?.disallow ?? []);

  it('ya no se sirve desde public/robots.txt', () => {
    expect(existe('public/robots.txt')).toBe(false);
    expect(existe('src/app/robots.ts')).toBe(true);
  });

  it('bloquea las rutas con token y las privadas que faltaban', () => {
    ['/forgot-password', '/reset-password', '/notifications'].forEach((ruta) => {
      expect(disallow).toContain(ruta);
    });
  });

  it('conserva los bloqueos de paneles y API', () => {
    ['/admin/', '/api/', '/company/', '/vendor/', '/login', '/register'].forEach(
      (ruta) => {
        expect(disallow).toContain(ruta);
      }
    );
  });

  it('anuncia el sitemap sobre la misma base que el sitemap', () => {
    expect(salida.sitemap).toBe(`${SITE_URL}/sitemap.xml`);
  });
});

// ============================================================
// UI-009 — manifest de marca
// ============================================================

describe('UI-009: manifest', () => {
  const datos = manifest();

  it('sustituye al manifest de create-react-app', () => {
    expect(existe('public/manifest.json')).toBe(false);
    expect(datos.name).not.toBe('Landing Page');
    expect(datos.short_name).toBe('INAKAT');
  });

  it('usa los colores de marca y el arranque en la raíz', () => {
    expect(datos.theme_color).toBe('#2b5d62');
    expect(datos.background_color).toBe('#e8e7d4');
    expect(datos.start_url).toBe('/');
  });

  it('declara los iconos de marca que ya existen en public/', () => {
    const fuentes = (datos.icons ?? []).map((i) => i.src);
    expect(fuentes).toContain('/logo192.png');
    expect(fuentes).toContain('/logo512.png');
    expect(existe('public/logo192.png')).toBe(true);
    expect(existe('public/logo512.png')).toBe(true);
  });
});

// ============================================================
// UI-008 — restos de create-react-app
// ============================================================

describe('UI-008: restos de create-react-app', () => {
  it('ya no se sirve /index.html ni quedan hojas/logo huérfanos', () => {
    expect(existe('public/index.html')).toBe(false);
    expect(existe('src/index.css')).toBe(false);
    expect(existe('src/App.css')).toBe(false);
    expect(existe('src/logo.svg')).toBe(false);
  });

  it('conserva los archivos que sí se usan', () => {
    expect(existe('public/favicon.ico')).toBe(true);
    expect(existe('src/app/globals.css')).toBe(true);
  });
});

// ============================================================
// UI-003 — error boundaries
// ============================================================

describe('UI-003: error boundaries', () => {
  it('existe el boundary raíz y el global', () => {
    expect(existe('src/app/error.tsx')).toBe(true);
    expect(existe('src/app/global-error.tsx')).toBe(true);
  });

  it('el boundary raíz ofrece reintentar y volver al inicio', () => {
    const fuente = leer('src/app/error.tsx');
    expect(fuente).toContain("'use client'");
    // La función reset de Next debe estar cableada a un control real.
    expect(fuente).toMatch(/onClick=\{reset\}/);
    expect(fuente).toMatch(/href="\/"/);
  });

  it('global-error renderiza sus propios <html> y <body>', () => {
    const fuente = leer('src/app/global-error.tsx');
    expect(fuente).toMatch(/<html/);
    expect(fuente).toMatch(/<body/);
    expect(fuente).toMatch(/onClick=\{reset\}/);
  });
});

// ============================================================
// UI-002 / UI-012 — metadata por página
// ============================================================

describe('UI-002: cada página pública exporta su propia metadata', () => {
  const paginas = [
    'src/app/about/page.tsx',
    'src/app/companies/page.tsx',
    'src/app/talents/page.tsx',
    'src/app/terms/page.tsx',
    'src/app/privacy/page.tsx',
    // 'use client': su metadata vive en el layout del segmento
    'src/app/contact/layout.tsx',
    'src/app/login/layout.tsx',
    'src/app/register/layout.tsx',
    'src/app/forgot-password/layout.tsx',
    'src/app/reset-password/layout.tsx',
    'src/app/unauthorized/layout.tsx',
  ];

  it.each(paginas)('%s exporta metadata', (ruta) => {
    expect(existe(ruta)).toBe(true);
    expect(leer(ruta)).toMatch(/export const metadata\s*:/);
  });

  it('las páginas de autenticación no se indexan', () => {
    [
      'src/app/login/layout.tsx',
      'src/app/register/layout.tsx',
      'src/app/forgot-password/layout.tsx',
      'src/app/reset-password/layout.tsx',
      'src/app/unauthorized/layout.tsx',
    ].forEach((ruta) => {
      expect(leer(ruta)).toMatch(/index:\s*false/);
    });
  });

  it('UI-001: /terms y /privacy provisionales tampoco se indexan', () => {
    expect(leer('src/app/terms/page.tsx')).toMatch(/index:\s*false/);
    expect(leer('src/app/privacy/page.tsx')).toMatch(/index:\s*false/);
  });

  it('el layout raíz usa plantilla de título en vez de un título único', () => {
    const fuente = leer('src/app/layout.tsx');
    expect(fuente).toMatch(/template:\s*["'`]%s \| INAKAT/);
  });
});

describe('UI-012: metadata social y canónica del layout raíz', () => {
  const og = (rootMetadata.openGraph ?? {}) as Record<string, unknown>;
  const tw = (rootMetadata.twitter ?? {}) as Record<string, unknown>;

  it('define metadataBase a partir de la base configurable', () => {
    expect(String(rootMetadata.metadataBase)).toBe(new URL(SITE_URL).toString());
  });

  it('declara canonical, siteName, imagen de Open Graph y twitter', () => {
    expect(rootMetadata.alternates?.canonical).toBe('/');
    expect(og.siteName).toBe('INAKAT');
    expect(og.locale).toBe('es_MX');
    expect(og.images).toBeDefined();
    expect(tw.card).toBeDefined();
  });

  it('twitter no fija un título único: cada página cae a su og:title', () => {
    expect(tw.title).toBeUndefined();
    expect(tw.description).toBeUndefined();
  });

  it('declara iconos de marca y color de tema', () => {
    const icons = rootMetadata.icons as Record<string, unknown>;
    expect(icons.apple).toBe('/logo192.png');
    expect(rootViewport.themeColor).toBe('#2b5d62');
  });
});

// Next NO fusiona openGraph entre segmentos: el de la página sustituye al del
// layout raíz. Sin partir de la base, /about, /companies, /talents y /contact
// perdían siteName, locale e imagen en las vistas previas de WhatsApp/LinkedIn.
describe('UI-012: las páginas con openGraph propio conservan la base del sitio', () => {
  const casos: Array<[string, Metadata, string]> = [
    ['/about', aboutMetadata, '/about'],
    ['/companies', companiesMetadata, '/companies'],
    ['/talents', talentsMetadata, '/talents'],
    ['/contact', contactMetadata, '/contact'],
  ];

  it.each(casos)('%s', (_ruta, metadata, canonical) => {
    const og = (metadata.openGraph ?? {}) as Record<string, unknown>;

    expect(metadata.alternates?.canonical).toBe(canonical);
    expect(og.url).toBe(canonical);
    expect(og.siteName).toBe('INAKAT');
    expect(og.locale).toBe('es_MX');
    expect(og.images).toEqual(BASE_OPEN_GRAPH.images);
  });

  it('/terms y /privacy no heredan la canónica de la home', () => {
    expect(termsMetadata.alternates?.canonical).toBe('/terms');
    expect(privacyMetadata.alternates?.canonical).toBe('/privacy');
  });
});

// ============================================================
// UI-001 — los avisos de consentimiento enlazan a los documentos
// ============================================================

describe('UI-001: los formularios enlazan a términos y privacidad', () => {
  it('el formulario de contacto enlaza ambos documentos', () => {
    const fuente = leer('src/app/contact/page.tsx');
    expect(fuente).toMatch(/href="\/terms"/);
    expect(fuente).toMatch(/href="\/privacy"/);
  });

  it('el formulario de registro de empresas enlaza ambos documentos', () => {
    const fuente = leer(
      'src/components/sections/companies/FormRegisterForQuotationSection.tsx'
    );
    expect(fuente).toMatch(/href="\/terms"/);
    expect(fuente).toMatch(/href="\/privacy"/);
  });
});

// ============================================================
// UI-010 / UI-011 — acoplamiento del CTA y reveal sin JavaScript
// ============================================================

describe('UI-010: el CTA compartido vive en commons', () => {
  it('ya no cuelga de sections/home', () => {
    // commons/CTAFinalSection se quedó sin consumidores con el cierre propio
    // de /about: puede borrarse sin que este test lo impida.
    expect(existe('src/components/sections/home/CTAFinalSection.tsx')).toBe(false);
  });

  // Desde el rediseño «Arco» (sept. 2026) /about tiene su propio cierre en
  // sections/aboutus (el de commons pintaba blanco sobre naranja, 2.54:1). La
  // intención de UI-010 se conserva: el cierre de /about no depende de la
  // carpeta de la portada, y un rediseño de la home no puede romper /about.
  it('/about no importa nada de sections/home para su cierre', () => {
    const about = leer('src/app/about/page.tsx');
    expect(about).not.toMatch(/@\/components\/sections\/home\//);
    expect(about).toContain('@/components/sections/aboutus/AboutCloseSection');
    const cierre = leer('src/components/sections/aboutus/AboutCloseSection.tsx');
    expect(cierre).not.toMatch(/@\/components\/sections\/home\//);
    expect(cierre).toMatch(/href="\/companies"/);
    expect(cierre).toMatch(/href="\/talents"/);
  });
});

describe('UI-011: el reveal sólo esconde contenido si hay JavaScript', () => {
  const css = leer('src/app/globals.css');

  it('la regla que pone opacity:0 cuelga de .js', () => {
    expect(css).toMatch(/\.js \.animate-on-scroll\s*\{/);
    expect(css).not.toMatch(/^\.animate-on-scroll\s*\{/m);
  });

  it('el layout marca .js antes de pintar', () => {
    expect(leer('src/app/layout.tsx')).toMatch(
      /document\.documentElement\.classList\.add\('js'\)/
    );
  });

  it('useInView no deja el contenido invisible sin IntersectionObserver', () => {
    const fuente = leer('src/hooks/useInView.ts');
    expect(fuente).toMatch(/typeof IntersectionObserver === 'undefined'/);
    expect(fuente).toMatch(/setIsInView\(true\)/);
  });
});

// ============================================================
// UI-025 — jerarquía de encabezados de /about
// ============================================================

describe('UI-025: /about tiene un h1', () => {
  it('AboutUsSection encabeza con <h1>', () => {
    const fuente = leer('src/components/sections/aboutus/AboutUsSection.tsx');
    // Rediseño «Arco»: el h1 es un titular en máscaras (TituloMascara como="h1").
    expect(fuente).toMatch(/<h1|como="h1"/);
  });

  it('el primer encabezado de OurCompromiseSection es de nivel 2', () => {
    const fuente = leer(
      'src/components/sections/aboutus/OurCompromiseSection.tsx'
    );
    const primero = fuente.match(/<h([1-6])/);
    expect(primero?.[1]).toBe('2');
  });
});
