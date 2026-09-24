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
import { render, screen, fireEvent, renderHook, act, waitFor } from '@testing-library/react';
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

  // Desde el rediseño «Arco» (sept. 2026) la ficha usa el Modal del sistema:
  // al abrir, el foco entra al diálogo (a su primer campo o, sin campos, al
  // propio diálogo, que anuncia el título) y el scroll se bloquea en <html>.
  it('mete el foco en el diálogo y bloquea el scroll del fondo', async () => {
    abrirPrimerExperto();

    const dialogo = screen.getByRole('dialog');
    await waitFor(() =>
      expect(dialogo).toContainElement(document.activeElement as HTMLElement)
    );
    expect(screen.getByRole('button', { name: 'Cerrar' })).toBeInTheDocument();
    expect(document.documentElement.style.overflow).toBe('hidden');
  });

  it('Escape lo cierra, devuelve el foco a la tarjeta y libera el scroll', () => {
    const tarjeta = abrirPrimerExperto();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(tarjeta).toHaveFocus();
    expect(document.documentElement.style.overflow).toBe('');
  });

  it('el botón Cerrar también lo cierra y devuelve el foco a la tarjeta', () => {
    const tarjeta = abrirPrimerExperto();

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(tarjeta).toHaveFocus();
  });
});

describe('UI-027: el hover de las tarjetas no lo anula el reveal', () => {
  it('el revelado ligado al scroll vive en el envoltorio, no en la tarjeta con hover', () => {
    render(<ExpertsSection />);

    const tarjeta = screen.getByRole('button', { name: /Guillermo Sánchez/i });
    // La tarjeta lleva su propio hover (about.css: .ab-experto:hover) …
    expect(tarjeta.className).toMatch(/\bab-experto\b/);
    // … y NO el revelado, cuyo transform lo anularía.
    expect(tarjeta.className).not.toMatch(/hm-rv|animate-on-scroll/);
    expect(tarjeta.getAttribute('style') ?? '').not.toMatch(/transition-delay/);

    const envoltorio = tarjeta.parentElement as HTMLElement;
    expect(envoltorio.className).toMatch(/\bhm-rv\b/);
  });
});

describe('UI-024 / UI-025: primer pantallazo de /about', () => {
  it('la imagen principal no se carga en diferido', () => {
    render(<AboutUsSection />);

    // Es una foto de archivo: el alt ya no la presenta como «Equipo INAKAT».
    const imagen = screen.getByAltText(/Fotografía de archivo/);
    expect(imagen).not.toHaveAttribute('loading', 'lazy');
  });

  it('el encabezado principal es un h1', () => {
    render(<AboutUsSection />);

    const h1 = screen.getByRole('heading', { level: 1 });
    // Titular partido en máscaras: el nombre accesible completo va en el h1.
    expect(h1).toHaveAccessibleName(/Quiénes\s*somos/i);
    expect(h1).toHaveTextContent(/Quiénes\s*somos/i);
  });

  it('las fotos de expertos (bajo el pliegue) sí se cargan en diferido', () => {
    render(<ExpertsSection />);

    // La foto de la tarjeta es decorativa (el nombre ya va en texto).
    const tarjeta = screen.getByRole('button', { name: /Guillermo Sánchez/i });
    const foto = tarjeta.querySelector('img');
    expect(foto).not.toBeNull();
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
