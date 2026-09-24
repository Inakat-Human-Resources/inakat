/**
 * RUTA: __tests__/components/sistema-diseno-promovidos.test.tsx
 *
 * Piezas que la integración de la tanda de rediseño subió a src/components/ui
 * (antes vivían copiadas en cada bloque) y lo que se añadió a los componentes
 * que ya había. Se prueba lo que ve y hace una persona, no las clases; salvo el
 * ajuste de tailwind-merge, que es justo un problema de clases.
 */
import React, { useState } from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import Switch from '@/components/ui/Switch';
import Aviso, { AvisoError } from '@/components/ui/Aviso';
import { useConfirmacion } from '@/components/ui/useConfirmacion';
import ConfirmarModal from '@/components/ui/ConfirmarModal';
import DataTable, { type Columna } from '@/components/ui/DataTable';
import FilterToolbar, { FiltroSelect } from '@/components/ui/FilterToolbar';
import FormField, { Input } from '@/components/ui/FormField';
import CampoContrasena from '@/components/ui/CampoContrasena';
import { PanelPestana } from '@/components/ui/Tabs';
import TituloMascara from '@/components/ui/TituloMascara';
import Stepper from '@/components/ui/Stepper';
import StatCard from '@/components/ui/StatCard';
import { IconLink } from '@/components/ui/IconButton';
import { ButtonLink } from '@/components/ui/Button';

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...resto }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...resto}>
      {children}
    </a>
  ),
}));

// ------------------------------------------------------------------
describe('cn() con Tailwind 3', () => {
  it('conserva `outline` junto a `outline-2` (en Tailwind 3 uno es estilo y el otro ancho)', () => {
    const clases = cn('focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal');
    expect(clases.split(' ')).toEqual(
      expect.arrayContaining(['focus-visible:outline', 'focus-visible:outline-2', 'focus-visible:outline-teal'])
    );
  });

  it('sigue fusionando lo que sí choca', () => {
    expect(cn('outline-2 outline-4')).toBe('outline-4');
    expect(cn('px-3 px-5')).toBe('px-5');
    expect(cn('shadow-ap-1 shadow-ap-2')).toBe('shadow-ap-2');
  });
});

// ------------------------------------------------------------------
describe('Switch', () => {
  it('es un interruptor con el estado escrito y el objeto en su nombre', () => {
    const alCambiar = jest.fn();
    render(<Switch activo alCambiar={alCambiar} objeto="Pack 10" />);
    const sw = screen.getByRole('switch', { name: 'Activo: Pack 10' });
    expect(sw).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(sw);
    expect(alCambiar).toHaveBeenCalledTimes(1);
  });

  it('sin objeto, lo describe otro elemento; cargando, se deshabilita', () => {
    render(
      <>
        <span id="fila">Ana Ruiz</span>
        <Switch activo={false} alCambiar={jest.fn()} describidoPor="fila" cargando />
      </>
    );
    const sw = screen.getByRole('switch', { name: 'Guardando…' });
    expect(sw).toHaveAttribute('aria-checked', 'false');
    expect(sw).toHaveAttribute('aria-describedby', 'fila');
    expect(sw).toBeDisabled();
  });
});

// ------------------------------------------------------------------
describe('Aviso', () => {
  it('el error se anuncia (alert) y ofrece Reintentar y cerrar', () => {
    const reintentar = jest.fn();
    const cerrar = jest.fn();
    render(<AvisoError mensaje="No se pudo cargar" alReintentar={reintentar} alCerrar={cerrar} />);
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo cargar');
    fireEvent.click(screen.getByRole('button', { name: /Reintentar/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar aviso' }));
    expect(reintentar).toHaveBeenCalled();
    expect(cerrar).toHaveBeenCalled();
  });

  it('el éxito es status y la información no se anuncia', () => {
    const { rerender } = render(<Aviso tono="exito">Listo</Aviso>);
    expect(screen.getByRole('status')).toHaveTextContent('Listo');
    rerender(<Aviso tono="info">Dato</Aviso>);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText('Dato')).toBeInTheDocument();
  });
});

// ------------------------------------------------------------------
describe('useConfirmacion', () => {
  function Pagina({ alResponder }: { alResponder: (ok: boolean) => void }) {
    const { confirmar, dialogo } = useConfirmacion();
    return (
      <>
        <button
          type="button"
          onClick={async () => alResponder(await confirmar({ titulo: '¿Pausar?', textoConfirmar: 'Pausar', variante: 'peligro' }))}
        >
          Abrir
        </button>
        {dialogo}
      </>
    );
  }

  it('confirmar responde true y cancelar responde false (como confirm())', async () => {
    const alResponder = jest.fn();
    render(<Pagina alResponder={alResponder} />);
    fireEvent.click(screen.getByRole('button', { name: 'Abrir' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Pausar' }));
    await waitFor(() => expect(alResponder).toHaveBeenLastCalledWith(true));

    fireEvent.click(screen.getByRole('button', { name: 'Abrir' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(alResponder).toHaveBeenLastCalledWith(false));
  });
});

describe('ConfirmarModal', () => {
  it('mientras corre la acción no se puede cancelar', () => {
    const cancelar = jest.fn();
    render(
      <ConfirmarModal abierto alCancelar={cancelar} alConfirmar={jest.fn()} titulo="Eliminar documento"
        textoConfirmar="Eliminar" textoCargando="Eliminando…" icono={Trash2} cargando />
    );
    expect(screen.getByRole('dialog', { name: 'Eliminar documento' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Eliminando/ })).toHaveAttribute('aria-busy', 'true');
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    expect(cancelar).not.toHaveBeenCalled();
  });
});

// ------------------------------------------------------------------
interface Fila {
  id: number;
  nombre: string;
  bloqueada?: boolean;
}
const FILAS: Fila[] = [
  { id: 1, nombre: 'Ana' },
  { id: 2, nombre: 'Luis' },
  { id: 3, nombre: 'Eva', bloqueada: true },
];
const COLUMNAS: Columna<Fila>[] = [{ id: 'nombre', encabezado: 'Nombre', enTarjeta: 'titulo', celda: (f) => f.nombre }];

describe('DataTable · selección múltiple', () => {
  function Tabla() {
    const [marcadas, setMarcadas] = useState<Set<number>>(new Set());
    const alternar = (id: number) =>
      setMarcadas((prev) => {
        const s = new Set(prev);
        if (s.has(id)) s.delete(id);
        else s.add(id);
        return s;
      });
    const habilitadas = FILAS.filter((f) => !f.bloqueada);
    return (
      <>
        <p>{marcadas.size} marcadas</p>
        <DataTable
          etiqueta="Personas"
          columnas={COLUMNAS}
          filas={FILAS}
          claveFila={(f) => f.id}
          seleccion={{
            marcada: (f) => marcadas.has(f.id),
            alAlternar: (f) => alternar(f.id),
            deshabilitada: (f) => Boolean(f.bloqueada),
            etiquetaFila: (f) => `Seleccionar a ${f.nombre}`,
            todas: {
              etiqueta: 'Seleccionar todos',
              alAlternar: () =>
                setMarcadas(habilitadas.every((f) => marcadas.has(f.id)) ? new Set() : new Set(habilitadas.map((f) => f.id))),
              extra: '1 ya asignada',
            },
          }}
        />
      </>
    );
  }

  it('casilla por fila, clic en la fila marca, fila bloqueada no, y «todos» con indeterminado', () => {
    render(<Tabla />);
    const ana = screen.getByRole('checkbox', { name: 'Seleccionar a Ana' });
    const eva = screen.getByRole('checkbox', { name: 'Seleccionar a Eva' });
    const todos = screen.getByRole('checkbox', { name: 'Seleccionar todos' }) as HTMLInputElement;
    expect(eva).toBeDisabled();
    expect(screen.getByText('1 ya asignada')).toBeInTheDocument();

    fireEvent.click(ana);
    expect(screen.getByText('1 marcadas')).toBeInTheDocument();
    expect(todos.indeterminate).toBe(true);

    // Clic en el texto de la fila (no es clicable: marca su casilla).
    fireEvent.click(screen.getByText('Luis'));
    expect(screen.getByText('2 marcadas')).toBeInTheDocument();
    expect(todos).toBeChecked();

    fireEvent.click(screen.getByText('Eva'));
    expect(screen.getByText('2 marcadas')).toBeInTheDocument();

    fireEvent.click(todos);
    expect(screen.getByText('0 marcadas')).toBeInTheDocument();
  });
});

// ------------------------------------------------------------------
describe('FilterToolbar · aplicar al enviar', () => {
  it('Intro o «Buscar» aplican; «Sin aplicar» se anuncia; en móvil los filtros se pliegan', () => {
    const alAplicar = jest.fn();
    render(
      <FilterToolbar
        busqueda={{ valor: 'ana', alCambiar: jest.fn(), etiqueta: 'Buscar candidatos' }}
        alAplicar={alAplicar}
        sinAplicar
        plegableEnMovil
        activos={1}
        debajo={<p>Panel avanzado</p>}
      >
        <FiltroSelect etiqueta="Estado" value="" onChange={jest.fn()}>
          <option value="">Todos</option>
        </FiltroSelect>
      </FilterToolbar>
    );
    fireEvent.submit(screen.getByRole('search'));
    fireEvent.click(screen.getByRole('button', { name: /^Buscar$/ }));
    expect(alAplicar).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('status')).toHaveTextContent('Sin aplicar');
    const filtros = screen.getByRole('button', { name: /Filtros/ });
    expect(filtros).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(filtros);
    expect(filtros).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Panel avanzado')).toBeInTheDocument();
  });
});

// ------------------------------------------------------------------
describe('FormField y campos', () => {
  it('obligatorio sólo a la vista: aria-required sin required nativo', () => {
    render(
      <FormField etiqueta="Nombre" requerido>
        <Input required={false} />
      </FormField>
    );
    const campo = screen.getByLabelText(/Nombre/);
    // Sin la validación nativa del navegador…
    expect(campo).not.toHaveAttribute('required');
    // …pero el lector sí oye que es obligatorio.
    expect(campo).toHaveAttribute('aria-required', 'true');
  });

  it('anunciarError pone el error en role="alert"', () => {
    render(
      <FormField etiqueta="Foto" error="No se pudo subir" anunciarError>
        <Input />
      </FormField>
    );
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo subir');
  });

  it('CampoContrasena: el ojo va dentro del campo y dice su estado', () => {
    function Campo() {
      const [ver, setVer] = useState(false);
      return (
        <FormField etiqueta="Contraseña">
          <CampoContrasena value="secreta" onChange={jest.fn()} visible={ver} alAlternar={() => setVer(!ver)} />
        </FormField>
      );
    }
    render(<Campo />);
    const campo = screen.getByLabelText('Contraseña');
    expect(campo).toHaveAttribute('type', 'password');
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar contraseña' }));
    expect(campo).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Ocultar contraseña' })).toHaveAttribute('aria-pressed', 'true');
  });
});

// ------------------------------------------------------------------
describe('Piezas sueltas', () => {
  it('PanelPestana con mantenerMontado deja el panel inactivo oculto, no desmontado', () => {
    render(
      <PanelPestana idBase="p" id="datos" activa="otra" mantenerMontado>
        <input aria-label="Campo del panel" />
      </PanelPestana>
    );
    const panel = document.getElementById('p-panel-datos');
    expect(panel).not.toBeNull();
    expect(panel).toHaveAttribute('hidden');
  });

  it('TituloMascara como <p> da su texto al lector en un sr-only', () => {
    render(<TituloMascara como="p" renglones={[{ texto: 'Tu talento,' }, { texto: 'evaluado.' }]} />);
    expect(screen.getByText('Tu talento, evaluado.')).toHaveClass('sr-only');
    expect(screen.getByText('Tu talento, evaluado.').closest('p')).not.toHaveAttribute('aria-label');
  });

  it('TituloMascara como encabezado conserva el aria-label', () => {
    render(<TituloMascara como="h1" renglones={[{ texto: 'Hola' }, { texto: 'mundo.' }]} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Hola mundo.' })).toBeInTheDocument();
  });

  it('Stepper con pasoMaximo deja saltar adelante hasta ese paso', () => {
    const alIrA = jest.fn();
    render(
      <Stepper
        pasos={[
          { id: 'a', etiqueta: 'Uno' },
          { id: 'b', etiqueta: 'Dos' },
          { id: 'c', etiqueta: 'Tres' },
          { id: 'd', etiqueta: 'Cuatro' },
        ]}
        actual={1}
        pasoMaximo={2}
        alIrA={alIrA}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Tres/ }));
    expect(alIrA).toHaveBeenCalledWith(2);
    expect(screen.queryByRole('button', { name: /Cuatro/ })).not.toBeInTheDocument();
  });

  it('StatCard achica sola una cifra larga', () => {
    const { container } = render(<StatCard etiqueta="Ingresos" valor="$1,262,050.00" />);
    expect(container.querySelector('p.text-lg')).toHaveTextContent('$1,262,050.00');
  });

  it('IconLink y ButtonLink externo abren en otra pestaña y lo dicen', () => {
    render(
      <>
        <IconLink href="https://www.linkedin.com/in/ana" etiqueta="LinkedIn de Ana" icono={Trash2} />
        <ButtonLink externo href="https://ejemplo.mx/cv.pdf">
          Ver CV
        </ButtonLink>
      </>
    );
    const icono = screen.getByRole('link', { name: /LinkedIn de Ana, se abre en una pestaña nueva/ });
    expect(icono).toHaveAttribute('target', '_blank');
    expect(icono).toHaveAttribute('rel', 'noopener noreferrer');
    const cv = screen.getByRole('link', { name: /Ver CV.*pestaña nueva/ });
    expect(cv).toHaveAttribute('target', '_blank');
  });
});

// act() se usa implícitamente por testing-library; se importa para versiones
// que lo exigen al resolver promesas de useConfirmacion.
void act;
