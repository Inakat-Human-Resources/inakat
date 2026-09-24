/**
 * RUTA: __tests__/components/sistema-diseno-ui.test.tsx
 *
 * Comportamiento de los componentes de src/components/ui que las 40 páginas
 * van a usar: si uno de estos se rompe, se rompen todas. Se prueba lo que ve y
 * hace una persona (con ratón, teclado o lector de pantalla), no las clases.
 */
import React, { useState } from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import Modal from '@/components/ui/Modal';
import Capa from '@/components/ui/Capa';
import DataTable, { type Columna } from '@/components/ui/DataTable';
import FormField, { Input, Checkbox } from '@/components/ui/FormField';
import StatusBadge from '@/components/ui/Badge';
import Tabs, { PanelPestana } from '@/components/ui/Tabs';
import Stepper from '@/components/ui/Stepper';
import Toast from '@/components/ui/Toast';
import Pagination from '@/components/ui/Pagination';
import IconButton from '@/components/ui/IconButton';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import { Trash2 } from 'lucide-react';

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...resto }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...resto}>
      {children}
    </a>
  ),
}));

// ------------------------------------------------------------------
describe('Modal', () => {
  function ConBoton({ alCerrar = jest.fn() }: { alCerrar?: () => void }) {
    const [abierto, setAbierto] = useState(false);
    return (
      <>
        <button type="button" onClick={() => setAbierto(true)}>
          Abrir
        </button>
        <Modal
          abierto={abierto}
          alCerrar={() => {
            alCerrar();
            setAbierto(false);
          }}
          titulo="Eliminar vacante"
          descripcion="No se puede deshacer."
          pie={<Button variante="peligro">Eliminar</Button>}
        >
          <input aria-label="Motivo" />
        </Modal>
      </>
    );
  }

  it('es un diálogo modal con nombre y descripción', async () => {
    render(<ConBoton />);
    fireEvent.click(screen.getByText('Abrir'));
    const dialogo = await screen.findByRole('dialog', { name: 'Eliminar vacante' });
    expect(dialogo).toHaveAttribute('aria-modal', 'true');
    expect(dialogo).toHaveAccessibleDescription('No se puede deshacer.');
  });

  it('mete el foco, lo atrapa con Tab y Escape cierra devolviéndolo al botón', async () => {
    const alCerrar = jest.fn();
    render(<ConBoton alCerrar={alCerrar} />);
    const abrir = screen.getByText('Abrir');
    abrir.focus();
    fireEvent.click(abrir);

    const dialogo = await screen.findByRole('dialog');
    const cerrar = within(dialogo).getByRole('button', { name: 'Cerrar' });
    // El foco entra al primer CAMPO del cuerpo (para escribir sin más).
    await waitFor(() => expect(within(dialogo).getByLabelText('Motivo')).toHaveFocus());

    // Del último (Eliminar) Tab vuelve al primero (Cerrar).
    const eliminar = within(dialogo).getByRole('button', { name: 'Eliminar' });
    eliminar.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(cerrar).toHaveFocus();
    // Y Mayús+Tab desde el primero va al último.
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(eliminar).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(alCerrar).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(abrir).toHaveFocus();
  });

  it('con otro diálogo encima (p. ej. un modal heredado en <Capa>), Escape no lo cierra', async () => {
    const alCerrar = jest.fn();
    render(
      <>
        <Modal abierto alCerrar={alCerrar} titulo="Pipeline">
          <p>contenido</p>
        </Modal>
        <Capa>
          <div role="dialog" aria-modal="true" aria-label="Ficha">
            <button type="button">Dentro de la ficha</button>
          </div>
        </Capa>
      </>
    );
    await screen.findByRole('dialog', { name: 'Ficha' });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(alCerrar).not.toHaveBeenCalled();
  });

  it('sin campos en el cuerpo, el foco va al propio diálogo (nunca a «Eliminar»)', async () => {
    render(
      <Modal
        abierto
        alCerrar={jest.fn()}
        titulo="¿Eliminar la vacante?"
        descripcion="No se puede deshacer."
        pie={<Button variante="peligro">Eliminar</Button>}
      />
    );
    const dialogo = await screen.findByRole('dialog', { name: '¿Eliminar la vacante?' });
    await waitFor(() => expect(dialogo).toHaveFocus());
    expect(screen.getByRole('button', { name: 'Eliminar' })).not.toHaveFocus();
  });
});

// ------------------------------------------------------------------
describe('DataTable', () => {
  type Fila = { id: number; nombre: string; total: number };
  const FILAS: Fila[] = [
    { id: 1, nombre: 'Ana', total: 3 },
    { id: 2, nombre: 'Beto', total: 12 },
  ];
  const columnas = (alBorrar = jest.fn()): Columna<Fila>[] => [
    { id: 'nombre', encabezado: 'Nombre', ordenable: true, enTarjeta: 'titulo', celda: (f) => f.nombre },
    { id: 'total', encabezado: 'Total', numerica: true, celda: (f) => f.total },
    {
      id: 'acciones',
      encabezado: 'Acciones',
      encabezadoOculto: true,
      celda: (f) => <IconButton etiqueta={`Borrar ${f.nombre}`} icono={Trash2} onClick={() => alBorrar(f)} />,
    },
  ];

  it('pinta cada dato UNA vez (la vista de tarjetas es la misma tabla)', () => {
    render(<DataTable etiqueta="Personas" columnas={columnas()} filas={FILAS} claveFila={(f) => f.id} />);
    expect(screen.getAllByText('Ana')).toHaveLength(1);
    expect(screen.getByRole('table', { name: /Personas/ })).toBeInTheDocument();
    // En móvil cada celda lleva su etiqueta para la tarjeta.
    expect(screen.getByText('12').closest('td')).toHaveAttribute('data-etiqueta', 'Total');
  });

  it('ordena con botones en la cabecera y anuncia aria-sort', () => {
    const alOrdenar = jest.fn();
    render(
      <DataTable
        etiqueta="Personas"
        columnas={columnas()}
        filas={FILAS}
        claveFila={(f) => f.id}
        orden={{ columna: 'nombre', direccion: 'asc' }}
        alOrdenar={alOrdenar}
      />
    );
    const cabecera = screen.getByRole('columnheader', { name: /Nombre/ });
    expect(cabecera).toHaveAttribute('aria-sort', 'ascending');
    fireEvent.click(within(cabecera).getByRole('button'));
    expect(alOrdenar).toHaveBeenCalledWith('nombre');
  });

  it('la fila se abre con clic y con Intro, pero no al pulsar un botón de dentro', () => {
    const alActivar = jest.fn();
    const alBorrar = jest.fn();
    render(
      <DataTable etiqueta="Personas" columnas={columnas(alBorrar)} filas={FILAS} claveFila={(f) => f.id} alActivarFila={alActivar} />
    );
    const fila = screen.getByText('Beto').closest('tr') as HTMLElement;
    expect(fila).toHaveAttribute('tabindex', '0');

    fireEvent.click(within(fila).getByText('Beto'));
    expect(alActivar).toHaveBeenLastCalledWith(FILAS[1]);

    fireEvent.keyDown(fila, { key: 'Enter' });
    expect(alActivar).toHaveBeenCalledTimes(2);

    fireEvent.click(within(fila).getByRole('button', { name: 'Borrar Beto' }));
    expect(alBorrar).toHaveBeenCalledWith(FILAS[1]);
    expect(alActivar).toHaveBeenCalledTimes(2);
  });

  it('muestra el estado vacío, el de carga y la paginación real', () => {
    const alCambiar = jest.fn();
    const { rerender } = render(
      <DataTable
        etiqueta="Personas"
        columnas={columnas()}
        filas={[]}
        claveFila={(f) => f.id}
        vacio={<EmptyState titulo="Nadie todavía" />}
      />
    );
    expect(screen.getByText('Nadie todavía')).toBeInTheDocument();

    rerender(<DataTable etiqueta="Personas" columnas={columnas()} filas={[]} claveFila={(f) => f.id} cargando />);
    expect(screen.getByRole('table')).toHaveAttribute('aria-busy', 'true');

    rerender(
      <DataTable
        etiqueta="Personas"
        columnas={columnas()}
        filas={FILAS}
        claveFila={(f) => f.id}
        paginacion={{ page: 1, limit: 2, total: 5, totalPages: 3, hasNext: true, hasPrev: false }}
        alCambiarPagina={alCambiar}
        etiquetaTotal="personas"
      />
    );
    expect(screen.getByText(/Página 1 de 3 · 5 personas/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(alCambiar).toHaveBeenCalledWith(2);
    fireEvent.click(screen.getByRole('button', { name: 'Página 3' }));
    expect(alCambiar).toHaveBeenCalledWith(3);
  });
});

// ------------------------------------------------------------------
describe('Formularios', () => {
  it('etiqueta visible asociada; ayuda y error enlazados; aria-invalid', () => {
    render(
      <FormField etiqueta="Correo" ayuda="Te escribiremos aquí." error="Falta la arroba" requerido>
        <Input type="email" />
      </FormField>
    );
    const campo = screen.getByLabelText(/Correo/);
    expect(campo).toHaveAttribute('aria-invalid', 'true');
    expect(campo).toBeRequired();
    expect(campo).toHaveAccessibleDescription('Falta la arroba Te escribiremos aquí.');
  });

  it('sin error no marca aria-invalid; la casilla lleva su etiqueta clicable', () => {
    render(
      <>
        <FormField etiqueta="Nombre">
          <Input />
        </FormField>
        <Checkbox etiqueta="Vacante confidencial" descripcion="No se muestra la empresa." />
      </>
    );
    expect(screen.getByLabelText('Nombre')).not.toHaveAttribute('aria-invalid');
    const casilla = screen.getByLabelText('Vacante confidencial');
    fireEvent.click(screen.getByText('Vacante confidencial'));
    expect(casilla).toBeChecked();
    expect(casilla).toHaveAccessibleDescription('No se muestra la empresa.');
  });
});

// ------------------------------------------------------------------
describe('Estados, pestañas, pasos y avisos', () => {
  it('StatusBadge dice el estado con texto', () => {
    render(<StatusBadge estado="paused" contexto="vacante" />);
    expect(screen.getByText('Pausada')).toBeInTheDocument();
  });

  it('Tabs: flechas mueven la selección; sólo la activa es tabulable', () => {
    function Demo() {
      const [activa, setActiva] = useState('a');
      return (
        <>
          <Tabs
            idBase="t"
            etiqueta="Secciones"
            activa={activa}
            alCambiar={setActiva}
            pestanas={[
              { id: 'a', etiqueta: 'Datos' },
              { id: 'b', etiqueta: 'Experiencia', contador: 2 },
            ]}
          />
          <PanelPestana idBase="t" id="a" activa={activa}>Panel A</PanelPestana>
          <PanelPestana idBase="t" id="b" activa={activa}>Panel B</PanelPestana>
        </>
      );
    }
    render(<Demo />);
    const datos = screen.getByRole('tab', { name: 'Datos' });
    expect(datos).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /Experiencia/ })).toHaveAttribute('tabindex', '-1');

    fireEvent.keyDown(datos, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: /Experiencia/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Panel B');
  });

  it('Stepper marca el paso actual y deja volver a los hechos', () => {
    const alIrA = jest.fn();
    render(
      <Stepper
        actual={1}
        alIrA={alIrA}
        pasos={[
          { id: 'uno', etiqueta: 'El puesto' },
          { id: 'dos', etiqueta: 'Detalle' },
          { id: 'tres', etiqueta: 'Revisión' },
        ]}
      />
    );
    const lista = screen.getByRole('list', { name: 'Progreso del formulario' });
    expect(within(lista).getByText('Detalle').closest('li')).toHaveAttribute('aria-current', 'step');
    fireEvent.click(within(lista).getByRole('button', { name: /El puesto/ }));
    expect(alIrA).toHaveBeenCalledWith(0);
    // Un paso pendiente no es pulsable.
    expect(within(lista).queryByRole('button', { name: /Revisión/ })).not.toBeInTheDocument();
  });

  it('Toast: un error es alerta; lo demás, estado cortés', () => {
    const { rerender } = render(<Toast tono="error" mensaje="No se pudo guardar" alCerrar={() => {}} />);
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo guardar');
    rerender(<Toast tono="exito" mensaje="Guardado" alCerrar={() => {}} />);
    expect(screen.getByRole('status')).toHaveTextContent('Guardado');
  });

  it('Pagination no se pinta con una sola página', () => {
    const { container } = render(
      <Pagination
        pagination={{ page: 1, limit: 20, total: 3, totalPages: 1, hasNext: false, hasPrev: false }}
        alCambiar={() => {}}
        etiqueta="filas"
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('IconButton exige nombre accesible', () => {
    render(<IconButton etiqueta="Eliminar vacante" icono={Trash2} />);
    expect(screen.getByRole('button', { name: 'Eliminar vacante' })).toHaveAttribute('title', 'Eliminar vacante');
  });

  it('Button cargando se deshabilita y lo anuncia', () => {
    render(<Button cargando>Guardar</Button>);
    const boton = screen.getByRole('button', { name: /Guardar/ });
    expect(boton).toBeDisabled();
    expect(boton).toHaveAttribute('aria-busy', 'true');
  });
});
