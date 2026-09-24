/**
 * RUTA: __tests__/components/p4-legal-nombre.test.tsx
 *
 * Revisión visual de la Parte B (septiembre 2026), bloque p4-info:
 *  - /privacy y /terms: el h1 lleva remate serif como el resto de páginas
 *    públicas, el estado «provisional» se avisa UNA sola vez (antes salía en
 *    un chip y en un aviso), el texto del cliente sigue entero y los canales
 *    de contacto siguen enlazados.
 *  - /about, «Nuestro nombre»: el contorno de INAKAT no se pinta sin la tapa
 *    que esconde las costuras de la fuente variable (Outfit dibuja la N, las A,
 *    la K y la T con piezas solapadas y -webkit-text-stroke traza cada pieza).
 */
import fs from 'fs';
import path from 'path';
import React from 'react';
import { render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import PrivacyPage from '@/app/privacy/page';
import TermsPage from '@/app/terms/page';
import AboutUsSection from '@/components/sections/aboutus/AboutUsSection';

// SiteMotion sólo arma las entradas (usa matchMedia, que jsdom no trae); aquí
// se mira el documento, no el movimiento.
jest.mock('@/components/ui/SiteMotion', () => ({
  __esModule: true,
  default: () => null,
}));

describe('/privacy y /terms: documento legible con un solo aviso', () => {
  it.each([
    ['privacy', PrivacyPage, /Política de\s+privacidad/],
    ['terms', TermsPage, /Términos\s+y condiciones/],
  ])('%s: h1 con remate serif y nombre accesible completo', (_ruta, Pagina, nombre) => {
    render(<Pagina />);

    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveAccessibleName(nombre);
    // El remate va en <em> (serif itálica en todo .hm).
    expect(h1.querySelector('em')).not.toBeNull();
  });

  it.each([
    ['privacy', PrivacyPage],
    ['terms', TermsPage],
  ])('%s: «provisional» se avisa una sola vez', (_ruta, Pagina) => {
    const { container } = render(<Pagina />);

    const main = container.querySelector('main') as HTMLElement;
    const apariciones = (main.textContent ?? '').match(/provisional/gi) ?? [];
    expect(apariciones).toHaveLength(1);
    expect(within(main).getByText(/pendiente de publicación/)).toBeInTheDocument();
  });

  it('privacy: el texto del cliente sigue entero (entrada, principios y ARCO)', () => {
    render(<PrivacyPage />);

    expect(screen.getByText(/nos comprometemos a proteger la privacidad/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Principios generales' })).toBeInTheDocument();
    expect(screen.getByText(/No vendemos ni compartimos tus datos/)).toBeInTheDocument();
    expect(screen.getByText(/derechos ARCO/)).toBeInTheDocument();
  });

  it('terms: el texto del cliente sigue entero', () => {
    render(<TermsPage />);

    expect(screen.getByText(/Esta página está en construcción/)).toBeInTheDocument();
    expect(screen.getByText(/Si tienes preguntas legales/)).toBeInTheDocument();
  });

  it('los canales de contacto siguen enlazados (correo y WhatsApp en otra pestaña)', () => {
    const { container } = render(<PrivacyPage />);
    const main = container.querySelector('main') as HTMLElement;

    const correo = within(main).getByRole('link', { name: /info@inakat\.com/ });
    expect(correo).toHaveAttribute('href', 'mailto:info@inakat.com');

    const whatsapp = within(main).getByRole('link', { name: /WhatsApp/ });
    expect(whatsapp.getAttribute('href')).toMatch(/^https:\/\/wa\.me\//);
    expect(whatsapp).toHaveAttribute('target', '_blank');
    expect(whatsapp).toHaveAttribute('rel', expect.stringContaining('noopener'));
    expect(whatsapp).toHaveAccessibleName(/se abre en otra pestaña/);
  });
});

describe('/about: el contorno de INAKAT sin costuras', () => {
  it('el nombre se lee una vez y el contorno decorativo trae el texto de su tapa', () => {
    render(<AboutUsSection />);

    const h2 = screen.getByRole('heading', { level: 2, name: 'INAKAT' });
    const contorno = h2.querySelector('[aria-hidden="true"]') as HTMLElement;
    expect(contorno).not.toBeNull();
    // La tapa (::after) pinta attr(data-t): tiene que ser la misma palabra.
    expect(contorno.getAttribute('data-t')).toBe(contorno.textContent?.trim());
  });

  it('about.css no traza el contorno sin la tapa del color del suelo encima', () => {
    const css = fs
      .readFileSync(path.join(process.cwd(), 'src/app/about/about.css'), 'utf8')
      // Sin comentarios: la aserción mira las reglas, no la explicación.
      .replace(/\/\*[\s\S]*?\*\//g, '');

    // Todas las declaraciones de un selector exacto (la base y la del bloque
    // de movimiento), juntas.
    const regla = (selector: string) => {
      const bloques: string[] = [];
      let i = css.indexOf(`${selector} {`);
      while (i > -1) {
        bloques.push(css.slice(i, css.indexOf('}', i)));
        i = css.indexOf(`${selector} {`, i + 1);
      }
      expect(bloques.length).toBeGreaterThan(0);
      return bloques.join('\n');
    };

    // El trazo es opaco (con alfa brillaba donde dos letras se tocan) …
    expect(regla('.ab-nombre__contorno')).toMatch(/-webkit-text-stroke:[^;]*#[0-9a-f]{6}\s*;/i);
    // … y la tapa pinta la misma palabra en tinta, sin trazo, encima de él.
    const tapa = regla('.ab-nombre__contorno::after');
    expect(tapa).toMatch(/content:\s*attr\(data-t\)/);
    expect(tapa).toMatch(/color:\s*var\(--ink\)/);
    expect(tapa).toMatch(/-webkit-text-stroke-width:\s*0/);
    // El relleno queda por encima de contorno y tapa.
    expect(regla('.ab-nombre__lleno')).toMatch(/z-index:\s*1/);
  });
});
