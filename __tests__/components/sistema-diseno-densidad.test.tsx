/**
 * RUTA: __tests__/components/sistema-diseno-densidad.test.tsx
 *
 * Correcciones del sistema tras la revisión visual (septiembre 2026):
 *  - DataTable en tarjetas: el valor de cada celda es UNA pieza (no se parte
 *    «7» / «años»), las celdas vacías quedan vacías, papeles «meta» y
 *    «acciones abajo», truncado con el texto entero en title;
 *  - densidad: dentro de una tabla los botones salen en `sm` (32 px) si la
 *    página no pide otro tamaño, y un modal abierto desde la tabla no lo hereda;
 *  - pestañas que no caben: se marca el borde con más pestañas y la activa se
 *    desplaza a la vista, sin mover la página;
 *  - campos a 16 px en móvil (zoom de iOS);
 *  - la marca del panel es la del sitio público.
 *
 * La maquetación en sí (container queries, :has, máscaras) no existe en jsdom:
 * de esa parte se comprueba la regla de CSS que la hace posible.
 */
import React, { useState } from 'react';
import fs from 'fs';
import path from 'path';
import { render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Eye } from 'lucide-react';
import DataTable, { type Columna } from '@/components/ui/DataTable';
import Button from '@/components/ui/Button';
import IconButton from '@/components/ui/IconButton';
import Modal from '@/components/ui/Modal';
import Tabs from '@/components/ui/Tabs';
import FormField, { Input } from '@/components/ui/FormField';
import { FiltroSelect } from '@/components/ui/FilterToolbar';
import MarcaInakat, { SimboloInakat } from '@/components/ui/MarcaInakat';

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...resto }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...resto}>
      {children}
    </a>
  ),
}));

const leer = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), 'utf-8');

// ------------------------------------------------------------------
describe('DataTable: una celda, un valor', () => {
  type Fila = { id: number; nombre: string; empresa: string; anios: number; nota: string | null };
  const FILAS: Fila[] = [
    { id: 1, nombre: 'María Guadalupe del Socorro Villarreal', empresa: 'Grupo Andes', anios: 7, nota: null },
  ];
  const columnas: Columna<Fila>[] = [
    { id: 'nombre', encabezado: 'Nombre', enTarjeta: 'titulo', celda: (f) => f.nombre },
    {
      id: 'empresa',
      encabezado: 'Empresa',
      enTarjeta: 'meta',
      truncarEn: '14rem',
      tituloCelda: (f) => f.empresa,
      celda: (f) => f.empresa,
    },
    {
      id: 'experiencia',
      encabezado: 'Experiencia',
      // Dos nodos: antes el segundo caía en la columna de las etiquetas.
      celda: (f) => (
        <>
          <span>{f.anios}</span> <span>años</span>
        </>
      ),
    },
    { id: 'nota', encabezado: 'Nota', celda: (f) => f.nota },
    {
      id: 'acciones',
      encabezado: 'Acciones',
      encabezadoOculto: true,
      enTarjeta: 'acciones',
      celda: (f) => <IconButton etiqueta={`Ver ${f.nombre}`} icono={Eye} />,
    },
  ];

  it('envuelve el contenido de cada celda en UN solo elemento (el «valor» de la tarjeta)', () => {
    render(<DataTable etiqueta="Personas" columnas={columnas} filas={FILAS} claveFila={(f) => f.id} />);
    const celda = screen.getByText('años').closest('td') as HTMLElement;
    expect(celda).toHaveAttribute('data-etiqueta', 'Experiencia');
    expect(celda.children).toHaveLength(1);
    expect(celda.firstElementChild).toHaveClass('ap-celda');
    expect(celda.firstElementChild).toHaveTextContent('7 años');
  });

  it('una celda sin nada queda vacía de verdad (en tarjetas no deja la etiqueta suelta)', () => {
    const { container } = render(
      <DataTable etiqueta="Personas" columnas={columnas} filas={FILAS} claveFila={(f) => f.id} />
    );
    const nota = container.querySelector('td[data-etiqueta="Nota"]') as HTMLElement;
    expect(nota).toBeEmptyDOMElement();
  });

  it('marca los papeles de tarjeta y trunca con el texto completo en title', () => {
    render(<DataTable etiqueta="Personas" columnas={columnas} filas={FILAS} claveFila={(f) => f.id} />);
    const empresa = screen.getByText('Grupo Andes').closest('td') as HTMLElement;
    expect(empresa).toHaveAttribute('data-tarjeta', 'meta');
    expect(empresa).toHaveAttribute('title', 'Grupo Andes');
    expect(empresa.firstElementChild).toHaveClass('ap-celda--truncar');
    expect(screen.getByText('María Guadalupe del Socorro Villarreal').closest('td')).toHaveAttribute('data-tarjeta', 'titulo');
  });

  it('accionesAbajo decide dónde van las acciones en la tarjeta (sin indicar: lo decide el CSS)', () => {
    const { rerender } = render(<DataTable etiqueta="P" columnas={columnas} filas={FILAS} claveFila={(f) => f.id} />);
    expect(screen.getByRole('table')).not.toHaveAttribute('data-acciones');
    rerender(<DataTable etiqueta="P" columnas={columnas} filas={FILAS} claveFila={(f) => f.id} accionesAbajo />);
    expect(screen.getByRole('table')).toHaveAttribute('data-acciones', 'abajo');
    rerender(<DataTable etiqueta="P" columnas={columnas} filas={FILAS} claveFila={(f) => f.id} accionesAbajo={false} />);
    expect(screen.getByRole('table')).toHaveAttribute('data-acciones', 'arriba');
  });

  it('las filas tienen alto mínimo de 44 px por defecto (compacta) y 48 en normal', () => {
    const { rerender } = render(<DataTable etiqueta="P" columnas={columnas} filas={FILAS} claveFila={(f) => f.id} />);
    expect(screen.getByText('Grupo Andes').closest('td')).toHaveClass('h-11');
    rerender(<DataTable etiqueta="P" columnas={columnas} filas={FILAS} claveFila={(f) => f.id} densidad="normal" />);
    expect(screen.getByText('Grupo Andes').closest('td')).toHaveClass('h-12');
  });
});

// ------------------------------------------------------------------
describe('Botones dentro de una tabla', () => {
  type Fila = { id: number; nombre: string };
  function Tabla({ conModal = false }: { conModal?: boolean }) {
    const [abierto, setAbierto] = useState(false);
    const columnas: Columna<Fila>[] = [
      { id: 'nombre', encabezado: 'Nombre', celda: (f) => f.nombre },
      {
        id: 'acciones',
        encabezado: 'Acciones',
        enTarjeta: 'acciones',
        celda: () => (
          <>
            <Button onClick={() => setAbierto(true)}>Aprobar</Button>
            <Button tamano="md">Grande a propósito</Button>
            <IconButton etiqueta="Ver" icono={Eye} />
            {conModal && (
              <Modal abierto={abierto} alCerrar={() => setAbierto(false)} titulo="Aprobar">
                <Button>Confirmar</Button>
              </Modal>
            )}
          </>
        ),
      },
    ];
    return <DataTable etiqueta="P" columnas={columnas} filas={[{ id: 1, nombre: 'Acme' }]} claveFila={(f) => f.id} />;
  }

  it('sin tamaño pedido salen en sm (32 px); un tamaño explícito gana', () => {
    render(<Tabla />);
    expect(screen.getByRole('button', { name: 'Aprobar' })).toHaveClass('h-8');
    expect(screen.getByRole('button', { name: 'Grande a propósito' })).toHaveClass('h-10');
    expect(screen.getByRole('button', { name: 'Ver' })).toHaveClass('h-8', 'w-8');
    // Fuera de una tabla, el de siempre.
    render(<Button>Fuera</Button>);
    expect(screen.getByRole('button', { name: 'Fuera' })).toHaveClass('h-10');
  });

  it('un botón con texto lo dice (la tarjeta baja esas acciones al pie)', () => {
    render(<Tabla />);
    expect(screen.getByRole('button', { name: 'Aprobar' })).toHaveAttribute('data-boton', 'texto');
    expect(screen.getByRole('button', { name: 'Ver' })).not.toHaveAttribute('data-boton');
  });

  it('un modal abierto desde una celda tiene sus botones normales', async () => {
    render(<Tabla conModal />);
    fireEvent.click(screen.getByRole('button', { name: 'Aprobar' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Aprobar' });
    expect(within(dialogo).getByRole('button', { name: 'Confirmar' })).toHaveClass('h-10');
  });
});

// ------------------------------------------------------------------
describe('Tabs que no caben', () => {
  const PESTANAS = ['Todas', 'Sin asignar', 'Incompletas', 'Asignadas', 'En proceso', 'Completadas'].map((e, i) => ({
    id: `p${i}`,
    etiqueta: e,
  }));
  const originales = {
    scrollWidth: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollWidth'),
    clientWidth: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth'),
    offsetLeft: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetLeft'),
    offsetWidth: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth'),
  };
  const scrollTo = jest.fn();

  beforeAll(() => {
    // Seis pestañas de 100 px en una fila de 300 px.
    const esLista = (el: HTMLElement) => el.getAttribute('role') === 'tablist';
    const indice = (el: HTMLElement) => Array.from(el.parentElement?.children ?? []).indexOf(el);
    Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
      configurable: true,
      get() {
        return esLista(this) ? 600 : 0;
      },
    });
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get() {
        return esLista(this) ? 300 : 0;
      },
    });
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
      configurable: true,
      get() {
        return this.getAttribute('role') === 'tab' ? 100 : 0;
      },
    });
    Object.defineProperty(HTMLElement.prototype, 'offsetLeft', {
      configurable: true,
      get() {
        return this.getAttribute('role') === 'tab' ? indice(this) * 100 : 0;
      },
    });
    (HTMLElement.prototype as unknown as { scrollTo: typeof scrollTo }).scrollTo = scrollTo;
  });

  afterAll(() => {
    (Object.keys(originales) as Array<keyof typeof originales>).forEach((k) => {
      const d = originales[k];
      // scrollWidth/clientWidth viven en Element.prototype: basta con quitar la sombra.
      if (d) Object.defineProperty(HTMLElement.prototype, k, d);
      else delete (HTMLElement.prototype as unknown as Record<string, unknown>)[k];
    });
    delete (HTMLElement.prototype as unknown as { scrollTo?: unknown }).scrollTo;
  });

  function Demo({ inicial = 'p0' }: { inicial?: string }) {
    const [activa, setActiva] = useState(inicial);
    return <Tabs idBase="t" etiqueta="Estados" activa={activa} alCambiar={setActiva} pestanas={PESTANAS} />;
  }

  it('marca que hay más pestañas a la derecha (el borde se desvanece)', () => {
    render(<Demo />);
    expect(screen.getByRole('tablist')).toHaveAttribute('data-desborde', 'fin');
  });

  it('la pestaña activa se desplaza a la vista dentro de la fila, sin mover la página', () => {
    scrollTo.mockClear();
    render(<Demo inicial="p5" />);
    // La última (500–600) con 48 px de margen en una fila de 300: 600 + 48 − 300.
    expect(scrollTo).toHaveBeenCalledWith({ left: 348, behavior: 'auto' });
    // Se desplaza la fila (el tablist), no la ventana.
    expect(scrollTo.mock.instances[0]).toBe(screen.getByRole('tablist'));
  });
});

// ------------------------------------------------------------------
describe('Campos a 16 px en móvil (iOS hace zoom con menos)', () => {
  it('Input y FiltroSelect: 16 px bajo sm, el tamaño de siempre desde sm', () => {
    render(
      <>
        <FormField etiqueta="Correo">
          <Input />
        </FormField>
        <FiltroSelect etiqueta="Estado" value="" onChange={() => undefined}>
          <option value="">Todos</option>
        </FiltroSelect>
      </>
    );
    expect(screen.getByLabelText('Correo')).toHaveClass('text-base', 'sm:text-sm');
    expect(screen.getByLabelText('Estado')).toHaveClass('text-base', 'sm:text-[13px]');
  });

  it('globals.css lo garantiza para los campos sueltos bajo 640 px', () => {
    const css = leer('src/app/globals.css');
    const bloque = css.slice(css.indexOf('@media (max-width: 639.98px)'));
    expect(bloque).toMatch(/select,\s*textarea/);
    expect(bloque).toMatch(/font-size: max\(1em, 16px\)/);
  });
});

// ------------------------------------------------------------------
describe('Tarjetas: las reglas que evitan botones encima del texto', () => {
  const css = leer('src/app/app.css');
  const tarjetas = css.slice(css.indexOf('@container ap-tabla (max-width: 599.98px)'));

  it('en tarjetas no cuentan los anchos de escritorio de la columna (w-px, min-w-…)', () => {
    const td = tarjetas.slice(tarjetas.indexOf('.ap-tabla--tarjetas tbody td {'));
    const cuerpo = td.slice(0, td.indexOf('}'));
    expect(cuerpo).toMatch(/width: auto;/);
    expect(cuerpo).toMatch(/min-width: 0;/);
    // Etiqueta de ancho fijo: los valores alinean entre celdas.
    expect(cuerpo).toMatch(/grid-template-columns: 7\.5rem minmax\(0, 1fr\)/);
  });

  it('las acciones con texto bajan al pie en una regla aparte de la forzada (sin :has no se pierde)', () => {
    const forzada = tarjetas.indexOf(".ap-tabla--tarjetas[data-acciones='abajo'] tbody td[data-tarjeta='acciones'] {");
    const conHas = tarjetas.indexOf(":has([data-boton='texto']");
    expect(forzada).toBeGreaterThan(-1);
    expect(conHas).toBeGreaterThan(-1);
    // No comparten lista de selectores.
    expect(tarjetas.slice(forzada, conHas)).toContain('}');
  });
});

// ------------------------------------------------------------------
describe('Una sola marca', () => {
  it('el panel usa la figura de logo.png (la del sitio público), no el isotipo naranja', () => {
    const shell = leer('src/components/ui/AppShell.tsx');
    expect(shell).toContain("from './MarcaInakat'");
    expect(shell).not.toContain('<Isotipo');
    expect(leer('src/components/ui/MarcaInakat.tsx')).toContain("from '@/assets/images/logo/logo.png'");
    expect(leer('src/components/commons/PublicNav.tsx')).toContain("from '@/assets/images/logo/logo.png'");
  });

  it('la figura es decorativa (el nombre lo lleva el enlace) y la palabra va en arena', () => {
    const { container } = render(
      <>
        <SimboloInakat />
        <MarcaInakat />
      </>
    );
    container.querySelectorAll('.ap-simbolo').forEach((s) => expect(s).toHaveAttribute('aria-hidden', 'true'));
    expect(container.querySelector('img')?.getAttribute('src')).toContain('inakat-palabra-arena');
  });
});
