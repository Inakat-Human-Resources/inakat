// RUTA: __tests__/components/adm-candidatos-tabla.test.tsx

/**
 * /admin/candidates — la tabla del banco de candidatos (revisión visual del
 * 23/09/2026, bloque b2).
 *
 * - En tarjetas (móvil) cada hijo de una celda era una casilla de la rejilla
 *   «etiqueta · valor»: con dos hijos, «7» quedaba arriba y «años» caía en la
 *   columna de las etiquetas. DataTable ya envuelve cada celda en .ap-celda, y
 *   además cada celda de esta página devuelve UN solo nodo.
 * - Las acciones iban arriba a la derecha de la tarjeta y el nombre largo se
 *   metía debajo de los iconos: ahora van abajo, a lo ancho, y arriba a la
 *   derecha queda el estado. El avatar y el nombre no se separan (flex-nowrap).
 * - La tarjeta medía ~366 px (30 = 10 972 px de página): perfil, nivel y años
 *   van en UNA línea bajo el nombre; educación, edad y fuente, en la ficha.
 * - `truncate` no deja partir la línea: la columna medía el correo entero y la
 *   tabla se salía por la derecha a 1440 y 1280. Ninguna celda lo usa.
 * - La columna de acciones queda fija a la derecha en vista de tabla.
 *
 * El ancho real (columnas que se esconden por container queries) no se puede
 * medir en jsdom: se mide con capturas en /diseno/vista/admin/candidates.
 */

import React from 'react';
import { render, screen, within } from '@testing-library/react';

jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
  usePathname: () => '/admin/candidates'
}));

const respuesta = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: () => Promise.resolve(body)
});

const pag = (total: number, limit = 30) => ({
  page: 1,
  limit,
  total,
  totalPages: Math.max(1, Math.ceil(total / limit)),
  hasNext: total > limit,
  hasPrev: false
});

const candidata = {
  id: 7,
  nombre: 'María Guadalupe del Socorro',
  apellidoPaterno: 'Villarreal',
  apellidoMaterno: 'Montemayor',
  email: 'maria.guadalupe.villarreal.montemayor@correo.mx',
  telefono: '81 1274 1622',
  sexo: 'F',
  fechaNacimiento: null,
  edad: 37,
  universidad: 'Instituto Tecnológico y de Estudios Superiores de Monterrey',
  carrera: 'Ingeniería en Sistemas Computacionales',
  nivelEstudios: 'Licenciatura',
  educacion: null,
  profile: 'Diseño Gráfico',
  seniority: 'Director',
  añosExperiencia: 7,
  cvUrl: null,
  portafolioUrl: null,
  linkedinUrl: 'linkedin.com/in/maria-villarreal',
  source: 'linkedin',
  notas: null,
  status: 'in_process',
  createdAt: '2026-09-01T00:00:00.000Z',
  experiences: [],
  userId: null
};

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

import AdminCandidatesPage from '@/app/admin/candidates/page';

/** Nodos que cuentan como casilla de la rejilla: elementos y texto no vacío. */
const hijosVisibles = (celda: Element) =>
  Array.from(celda.childNodes).filter(
    (n) => n.nodeType === Node.ELEMENT_NODE || (n.nodeType === Node.TEXT_NODE && (n.textContent || '').trim() !== '')
  );

describe('/admin/candidates · tabla y tarjetas', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockImplementation((url: string) => {
      const u = String(url);
      if (u.startsWith('/api/specialties')) {
        return Promise.resolve(respuesta({ success: true, names: ['Diseño Gráfico'], data: [] }));
      }
      if (u.startsWith('/api/admin/candidates')) {
        const params = new URL(u, 'http://x').searchParams;
        if (params.get('limit') === '1') {
          return Promise.resolve(respuesta({ success: true, data: [], pagination: pag(1, 1) }));
        }
        return Promise.resolve(respuesta({ success: true, data: [candidata], pagination: pag(1) }));
      }
      return Promise.resolve(respuesta({ success: false }, 404));
    });
  });

  const filaDeLaCandidata = async () => {
    render(<AdminCandidatesPage />);
    await screen.findAllByText(/María Guadalupe del Socorro/);
    const tabla = screen.getByRole('table', { name: /Banco de candidatos/ });
    const [fila] = within(tabla).getAllByRole('row').filter((f) => f.closest('tbody'));
    return fila;
  };

  it('cada celda devuelve un solo nodo (en tarjetas, un segundo hijo cae en la columna de etiquetas)', async () => {
    const fila = await filaDeLaCandidata();
    const celdas = within(fila).getAllByRole('cell');
    expect(celdas.length).toBeGreaterThan(0);
    celdas.forEach((celda) => {
      // El valor de la celda: lo que hay dentro de la envoltura de DataTable.
      const valor = celda.querySelector(':scope > .ap-celda') ?? celda;
      expect({ columna: celda.getAttribute('data-etiqueta'), hijos: hijosVisibles(valor).length }).toEqual({
        columna: celda.getAttribute('data-etiqueta'),
        hijos: 1
      });
    });
    // «7 años» es un solo texto, no «7» y «años» por separado.
    const experiencia = fila.querySelector('td[data-etiqueta="Experiencia"]') as HTMLElement;
    expect(experiencia.textContent?.replace(/\s+/g, ' ').trim()).toBe('7 años');
  });

  it('en tarjetas: nombre y estado arriba, perfil en una línea, acciones abajo y a lo ancho', async () => {
    const fila = await filaDeLaCandidata();
    const papel = (columna: string) =>
      fila.querySelector(`td[data-etiqueta="${columna}"]`)?.getAttribute('data-tarjeta') ?? 'normal';

    expect(papel('Candidato')).toBe('titulo');
    expect(papel('Estado')).toBe('acciones');
    expect(papel('Acciones')).toBe('completa');
    expect(papel('Perfil')).toBe('meta');
    expect(papel('Teléfono')).toBe('normal');
    // En la ficha (y los años, en la línea del perfil).
    expect(papel('Educación')).toBe('oculta');
    expect(papel('Edad')).toBe('oculta');
    expect(papel('Fuente')).toBe('oculta');
    expect(papel('Experiencia')).toBe('oculta');

    // El avatar y el nombre no se separan: en tarjetas, DataTable envuelve
    // las filas flexibles del título que no digan lo contrario.
    const titulo = fila.querySelector('td[data-etiqueta="Candidato"]') as HTMLElement;
    expect(titulo.querySelector('.flex')?.className.split(/\s+/)).toContain('flex-nowrap');

    // La línea del perfil en la tarjeta dice los años con su nombre.
    const perfil = fila.querySelector('td[data-etiqueta="Perfil"]') as HTMLElement;
    expect(perfil.querySelector('[data-solo-tarjeta].tabular-nums')?.textContent).toMatch(/7 años de experiencia/);

    // La fuente sigue a la vista bajo el estado mientras su columna no cabe.
    const estado = fila.querySelector('td[data-etiqueta="Estado"]') as HTMLElement;
    expect(within(estado).getByText('En proceso')).toBeInTheDocument();
    expect(within(estado).getByText(/Fuente: LinkedIn/)).toBeInTheDocument();
  });

  it('las acciones siguen todas en la fila y la columna queda fija a la derecha en vista de tabla', async () => {
    const fila = await filaDeLaCandidata();
    const acciones = fila.querySelector('td[data-etiqueta="Acciones"]') as HTMLElement;
    const nombre = 'María Guadalupe del Socorro Villarreal';
    expect(within(acciones).getByRole('button', { name: `Ver ficha de ${nombre}` })).toBeInTheDocument();
    expect(within(acciones).getByRole('button', { name: `Editar a ${nombre}` })).toBeInTheDocument();
    expect(within(acciones).getByRole('link', { name: new RegExp(`LinkedIn de ${nombre}`) })).toBeInTheDocument();
    expect(within(acciones).getByRole('button', { name: `Eliminar a ${nombre}` })).toBeInTheDocument();

    const clases = acciones.className.split(/\s+/);
    expect(clases).toEqual(expect.arrayContaining(['md:sticky', 'md:right-0']));
  });

  it('ninguna celda usa truncate ni un ancho fijo que valga también en tarjetas', async () => {
    const fila = await filaDeLaCandidata();
    // truncate (nowrap) hacía medir a la columna el correo entero (y la carrera
    // entera): la tabla se salía. (Las pastillas de Badge llevan el suyo: son
    // cortas y ya no parten línea.)
    ['Candidato', 'Educación', 'Perfil'].forEach((columna) => {
      const celda = fila.querySelector(`td[data-etiqueta="${columna}"]`) as HTMLElement;
      expect({ columna, truncados: celda.querySelectorAll('.truncate').length }).toEqual({ columna, truncados: 0 });
    });
    // min-w/max-w sin prefijo de ancho también se aplican a la tarjeta: el nombre
    // se metía bajo los iconos y la educación arrancaba más a la izquierda.
    within(fila)
      .getAllByRole('cell')
      .forEach((celda) => {
        const sinPrefijo = celda.className.split(/\s+/).filter((c) => /^(min|max)-w-/.test(c));
        expect(sinPrefijo).toEqual([]);
      });
    // El correo completo sigue en el documento (sólo se recorta a la vista).
    expect(within(fila).getByText(candidata.email)).toBeInTheDocument();
  });
});
