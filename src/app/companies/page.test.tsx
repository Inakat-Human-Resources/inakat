// Tests para: src/app/companies/page.tsx
//
// /companies por COMPORTAMIENTO (lo que ve y puede hacer un visitante), no por
// clases: así el diseño puede cambiar sin romper la prueba, y lo que importa
// (un h1 con nombre, el ancla #register, las secciones, el pie fuera de <main>)
// no se pierde en el camino.

import React from 'react';
import { render, screen, within } from '@testing-library/react';
import CompaniesPage from './page';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('@react-google-maps/api', () => ({
  useLoadScript: () => ({ isLoaded: false, loadError: undefined }),
  GoogleMap: () => null,
  Marker: () => null,
  Autocomplete: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

beforeAll(() => {
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

describe('/companies — comportamiento visible', () => {
  it('tiene un solo h1 y se lee entero (el titular partido en máscaras lleva aria-label)', () => {
    render(<CompaniesPage />);
    const h1s = screen.getAllByRole('heading', { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(h1s[0]).toHaveAccessibleName('Encuentra al talento que tu empresa merece.');
  });

  it('presenta las garantías, las seis razones, el proceso y el registro', () => {
    render(<CompaniesPage />);
    // Las garantías: una lista numerada con nombre (la cejilla «LO QUE RECIBES»
    // era un h2 que sólo contenía el rótulo en mayúsculas) y sus tres promesas.
    const garantias = screen.getByRole('list', { name: 'Lo que recibes' });
    expect(within(garantias).getAllByRole('listitem')).toHaveLength(3);
    expect(within(garantias).getByText(/evaluación psicológica/i)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /lo que recibes/i })).toBeNull();

    const razones = screen.getByRole('heading', { level: 2, name: /por qué elegir inakat/i }).closest('section');
    expect(within(razones as HTMLElement).getAllByRole('heading', { level: 3 })).toHaveLength(6);

    const proceso = screen.getByRole('heading', { level: 2, name: /cómo funciona inakat/i }).closest('section');
    expect(within(proceso as HTMLElement).getAllByRole('listitem')).toHaveLength(4);

    expect(screen.getByRole('heading', { level: 2, name: 'Registra tu empresa.' })).toBeInTheDocument();
  });

  it('los CTA de la portada llevan al formulario (#register) y el ancla existe', () => {
    const { container } = render(<CompaniesPage />);
    const portada = screen.getByRole('heading', { level: 1 }).closest('section') as HTMLElement;
    const registro = within(portada).getByRole('link', { name: /registra tu empresa/i });
    expect(registro).toHaveAttribute('href', '#register');
    expect(container.querySelector('section#register')).not.toBeNull();
    expect(container.querySelector('#formulario-registro form')).not.toBeNull();
  });

  it('el pie va después de <main>, no dentro', () => {
    const { container } = render(<CompaniesPage />);
    const main = container.querySelector('main');
    expect(main).not.toBeNull();
    expect(main!.querySelector('footer')).toBeNull();
    expect(container.querySelector('footer')).not.toBeNull();
  });
});
