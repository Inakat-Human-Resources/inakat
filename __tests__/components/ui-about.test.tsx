/**
 * RUTA: __tests__/components/ui-about.test.tsx
 *
 * Auditoría UI (septiembre 2026) — página /about y hooks de animación.
 * Tests de COMPORTAMIENTO: montan los componentes reales.
 *
 * Cubren:
 *  - UI-028: el modal de experto es un diálogo real (role, Escape, foco).
 *  - UI-027: el reveal vive en el envoltorio, no en la tarjeta con hover.
 *  - UI-024: la imagen del primer pantallazo no se carga en diferido.
 *  - UI-025: /about tiene un h1.
 *  - UI-029: useCountUp cancela su bucle y respeta "reducir movimiento".
 */
import React from 'react';
import { render, screen, fireEvent, renderHook, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import ExpertsSection from '@/components/sections/aboutus/ExpertsSection';
import AboutUsSection from '@/components/sections/aboutus/AboutUsSection';
import { useCountUp } from '@/hooks/useCountUp';

describe('UI-028: modal de detalle de experto', () => {
  function abrirPrimerExperto() {
    render(<ExpertsSection />);
    const tarjeta = screen.getByRole('button', { name: /Guillermo Sánchez/i });
    fireEvent.click(tarjeta);
    return tarjeta;
  }

  it('se anuncia como diálogo modal con el nombre del experto', () => {
    abrirPrimerExperto();

    const dialogo = screen.getByRole('dialog');
    expect(dialogo).toHaveAttribute('aria-modal', 'true');
    expect(dialogo).toHaveAccessibleName('Guillermo Sánchez');
  });

  it('mueve el foco al botón Cerrar y bloquea el scroll del fondo', () => {
    abrirPrimerExperto();

    expect(screen.getByRole('button', { name: 'Cerrar' })).toHaveFocus();
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('Escape lo cierra, devuelve el foco a la tarjeta y libera el scroll', () => {
    const tarjeta = abrirPrimerExperto();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(tarjeta).toHaveFocus();
    expect(document.body.style.overflow).toBe('');
  });
});

describe('UI-027: el hover de las tarjetas no lo anula el reveal', () => {
  it('la tarjeta con hover:-translate-y-1 no lleva animate-on-scroll; su envoltorio sí', () => {
    render(<ExpertsSection />);

    const tarjeta = screen.getByRole('button', { name: /Guillermo Sánchez/i });
    expect(tarjeta.className).toMatch(/hover:-translate-y-1/);
    expect(tarjeta.className).not.toMatch(/animate-on-scroll/);
    expect(tarjeta.getAttribute('style') ?? '').not.toMatch(/transition-delay/);

    const envoltorio = tarjeta.parentElement as HTMLElement;
    expect(envoltorio.className).toMatch(/animate-on-scroll/);
  });
});

describe('UI-024 / UI-025: primer pantallazo de /about', () => {
  it('la imagen principal no se carga en diferido', () => {
    render(<AboutUsSection />);

    const imagen = screen.getByAltText('Equipo INAKAT');
    expect(imagen).not.toHaveAttribute('loading', 'lazy');
  });

  it('el encabezado principal es un h1', () => {
    render(<AboutUsSection />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      /Quiénes\s*Somos/
    );
  });

  it('las fotos de expertos (bajo el pliegue) sí se cargan en diferido', () => {
    render(<ExpertsSection />);

    const foto = screen.getByAltText('Guillermo Sánchez');
    expect(foto).toHaveAttribute('loading', 'lazy');
  });
});

describe('UI-029: useCountUp', () => {
  const matchMediaOriginal = window.matchMedia;
  const rafOriginal = global.requestAnimationFrame;
  const cafOriginal = global.cancelAnimationFrame;

  afterEach(() => {
    window.matchMedia = matchMediaOriginal;
    global.requestAnimationFrame = rafOriginal;
    global.cancelAnimationFrame = cafOriginal;
  });

  function simularMovimientoReducido(reducido: boolean) {
    window.matchMedia = jest.fn().mockImplementation((query: string) => ({
      matches: reducido && query.includes('prefers-reduced-motion'),
      media: query,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    })) as unknown as typeof window.matchMedia;
  }

  it('con "reducir movimiento" muestra el valor final sin animar', () => {
    simularMovimientoReducido(true);
    const raf = jest.fn();
    global.requestAnimationFrame = raf as unknown as typeof requestAnimationFrame;

    const { result } = renderHook(() => useCountUp(95, 2000, true));

    expect(result.current).toBe(95);
    expect(raf).not.toHaveBeenCalled();
  });

  it('al desmontar cancela el bucle de requestAnimationFrame', () => {
    simularMovimientoReducido(false);
    const raf = jest.fn().mockReturnValue(42);
    const caf = jest.fn();
    global.requestAnimationFrame = raf as unknown as typeof requestAnimationFrame;
    global.cancelAnimationFrame = caf as unknown as typeof cancelAnimationFrame;

    const { unmount } = renderHook(() => useCountUp(100, 2000, true));
    expect(raf).toHaveBeenCalled();

    unmount();

    expect(caf).toHaveBeenCalledWith(42);
  });

  it('cancela el id del ÚLTIMO frame pedido, no sólo el primero', () => {
    simularMovimientoReducido(false);
    let siguienteId = 1;
    const pendientes = new Map<number, FrameRequestCallback>();
    global.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      const id = siguienteId++;
      pendientes.set(id, cb);
      return id;
    }) as typeof requestAnimationFrame;
    const caf = jest.fn();
    global.cancelAnimationFrame = caf as unknown as typeof cancelAnimationFrame;

    const { result, unmount } = renderHook(() => useCountUp(100, 1000, true));

    // Dos frames: arranque y, 500 ms después, la mitad de la animación.
    act(() => pendientes.get(1)?.(16));
    act(() => pendientes.get(2)?.(516));
    expect(result.current).toBe(50);

    unmount();

    expect(caf).toHaveBeenCalledWith(3);
  });
});
