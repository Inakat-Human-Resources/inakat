// RUTA: __tests__/qa/infra-home-comportamiento.test.tsx
//
// INFRA-009: feb2026-regression y lalo-marzo2026-landing leían con
// fs.readFileSync los componentes de la home y afirmaban literales de copy y de
// implementación (9 preguntas contadas con regex, clases grid, que page.tsx
// importara tal sección...). Cualquier rediseño de la home ponía el CI en rojo
// aunque la página funcionara, y un archivo renombrado tumbaba con ENOENT
// también los tests no relacionados de esas suites.
//
// Aquí se prueba la home por COMPORTAMIENTO, renderizándola: lo que ve y puede
// hacer un visitante, no cómo está escrito el componente.

import React from 'react';
import { render, screen, within } from '@testing-library/react';
import Home from '@/app/page';

beforeAll(() => {
  // jsdom no implementa matchMedia; HomeMotion lo consulta en su efecto.
  if (!window.matchMedia) {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  }
});

describe('Home — comportamiento visible', () => {
  it('tiene exactamente un h1 con texto', () => {
    render(<Home />);
    const h1s = screen.getAllByRole('heading', { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(h1s[0]).toHaveAccessibleName(/\S/);
  });

  it('ofrece llamadas a la acción hacia el registro de empresas y hacia vacantes', () => {
    render(<Home />);
    const destinos = screen.getAllByRole('link').map((a) => a.getAttribute('href'));
    expect(destinos).toContain('/companies');
    expect(destinos).toContain('/talents');
  });

  it('las preguntas frecuentes existen y cada una se abre y se cierra', () => {
    render(<Home />);

    const titulo = screen.getByRole('heading', { name: /preguntas\s+frecuentes/i });
    const seccion = titulo.closest('section');
    expect(seccion).not.toBeNull();

    const items = seccion!.querySelectorAll('details');
    expect(items.length).toBeGreaterThan(0);

    const primera = items[0] as HTMLDetailsElement;
    const resumen = within(primera).getByText(/\?\s*$/).closest('summary') as HTMLElement;
    expect(resumen).not.toBeNull();
    expect(primera.open).toBe(false);

    // Un <summary> alterna su <details> al hacer clic (comportamiento nativo).
    resumen.click();
    expect(primera.open).toBe(true);
    resumen.click();
    expect(primera.open).toBe(false);
  });

  it('cada pregunta frecuente trae su respuesta', () => {
    render(<Home />);
    const titulo = screen.getByRole('heading', { name: /preguntas\s+frecuentes/i });
    const items = titulo.closest('section')!.querySelectorAll('details');

    items.forEach((item) => {
      const pregunta = item.querySelector('summary')?.textContent?.trim() ?? '';
      const respuesta = (item.textContent ?? '').replace(pregunta, '').trim();
      expect(pregunta.length).toBeGreaterThan(0);
      expect(respuesta.length).toBeGreaterThan(20);
    });
  });
});
