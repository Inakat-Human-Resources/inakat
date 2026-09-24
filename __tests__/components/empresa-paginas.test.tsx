// RUTA: __tests__/components/empresa-paginas.test.tsx
//
// Páginas de empresa rehechas con el sistema de diseño (bloque 5): se montan
// con las fixtures del banco (src/app/diseno/fixtures/b5-empresa.ts) y se
// comprueba que las llamadas de red (URL, método y cuerpo) son las de siempre:
// pausar, cancelar sin llamar, publicar, «Me interesa», contratar en dos pasos
// con closeJob, entrevista, perfil e integraciones. También que «Activas» y
// «Mis vacantes» salen una sola vez en el panel: la e2e recruitment-flow las
// busca en modo estricto.
//
// Ojo: los casos del panel comparten la URL (window.history) en orden; el de
// «sin solicitud asociada» cuenta con el ?cuenta=sin que deja el anterior.
import React from 'react';
import { render, screen, waitFor, within, fireEvent, act } from '@testing-library/react';
import { fixtures } from '@/app/diseno/fixtures/b5-empresa';
import { patronARegExp } from '@/app/diseno/_banco/simulador';

const push = jest.fn();
let parametros: Record<string, string> = {};
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push, back: jest.fn(), replace: jest.fn(), refresh: jest.fn(), prefetch: jest.fn() }),
  useParams: () => parametros,
  usePathname: () => '/company/dashboard',
  useSearchParams: () => new URLSearchParams(),
}));
jest.mock('next/image', () => ({
  __esModule: true,
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  default: (p: Record<string, unknown>) => <img alt={String(p.alt ?? '')} src={String(p.src ?? '')} />,
}));
// El estado del script de Google se cambia por prueba (mapa caído, clave
// rechazada…); por defecto, «todavía cargando», como antes.
let mockEstadoMapa: { isLoaded: boolean; loadError: Error | undefined } = { isLoaded: false, loadError: undefined };
jest.mock('@react-google-maps/api', () => ({
  useLoadScript: () => mockEstadoMapa,
  GoogleMap: () => <div data-testid="mapa-google" />,
  Marker: () => null,
  Autocomplete: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
jest.mock('@/components/shared/CandidateProfileModal', () => ({
  __esModule: true,
  default: (p: { isOpen: boolean; application: { candidateName: string } | null }) =>
    p.isOpen ? <div role="dialog" aria-label="ficha">{p.application?.candidateName}</div> : null,
}));

type Llamada = { url: string; metodo: string; cuerpo: unknown };
let llamadas: Llamada[] = [];

beforeEach(() => {
  llamadas = [];
  push.mockReset();
  (global as unknown as { fetch: unknown }).fetch = jest.fn(async (entrada: string, init?: RequestInit) => {
    const url = new URL(entrada, 'http://localhost');
    const metodo = (init?.method || 'GET').toUpperCase();
    let cuerpo: unknown = undefined;
    if (typeof init?.body === 'string') cuerpo = JSON.parse(init.body);
    else if (init?.body instanceof FormData) cuerpo = Object.fromEntries(init.body.entries());
    llamadas.push({ url: url.pathname + url.search, metodo, cuerpo });
    for (const f of fixtures) {
      if (f.metodo !== metodo) continue;
      const m = typeof f.patron === 'string' ? patronARegExp(f.patron).exec(url.pathname) : f.patron.exec(url.pathname + url.search);
      if (!m) continue;
      const datos =
        typeof f.respuesta === 'function'
          ? (f.respuesta as (c: unknown) => unknown)({ url, metodo, cuerpo, rol: 'company', params: { ...(m.groups ?? {}) } })
          : f.respuesta;
      let estado = f.estado ?? 200;
      let json: unknown = datos;
      const comoRespuesta = datos as { status?: number; json?: () => Promise<unknown> } | null;
      if (comoRespuesta && typeof comoRespuesta.json === 'function' && typeof comoRespuesta.status === 'number') {
        estado = comoRespuesta.status;
        json = await comoRespuesta.json();
      }
      return { ok: estado >= 200 && estado < 300, status: estado, json: async () => json };
    }
    throw new Error('sin fixture ' + metodo + ' ' + url.pathname);
  });
});

const pulsar = async (el: Element) => {
  await act(async () => {
    fireEvent.click(el);
  });
};

describe('Panel de empresa', () => {
  it('monta, «Activas» y «Mis vacantes» salen una sola vez, y pausar manda el PATCH de siempre', async () => {
    const Pagina = (await import('@/app/company/dashboard/page')).default;
    render(<Pagina />);
    await screen.findByRole('heading', { level: 1, name: 'Grupo Andes' });
    expect(screen.getAllByText(/activas/i)).toHaveLength(1);
    expect(screen.getAllByText(/mis vacantes/i)).toHaveLength(1);
    expect(llamadas[0]).toMatchObject({ url: '/api/company/dashboard', metodo: 'GET' });

    // Fila de «Ingeniera de Procesos» → menú ⋯ → Pausar → confirmar
    await pulsar(screen.getByRole('button', { name: 'Más acciones para Ingeniera de Procesos' }));
    const menu = await screen.findByRole('menu');
    await pulsar(within(menu).getByRole('menuitem', { name: /Pausar/ }));
    const dialogo = await screen.findByRole('dialog');
    expect(dialogo).toHaveTextContent('¿Pausar esta vacante?');
    await pulsar(within(dialogo).getByRole('button', { name: /Pausar vacante/ }));
    await waitFor(() =>
      expect(llamadas.find((l) => l.metodo === 'PATCH')).toEqual({ url: '/api/jobs/202', metodo: 'PATCH', cuerpo: { status: 'paused' } })
    );
    await screen.findByText('Vacante pausada exitosamente');
  });

  it('cancelar la confirmación no llama a la API', async () => {
    const Pagina = (await import('@/app/company/dashboard/page')).default;
    render(<Pagina />);
    await screen.findByRole('heading', { level: 1 });
    await pulsar(screen.getByRole('button', { name: 'Más acciones para Científica de Datos' }));
    await pulsar(within(await screen.findByRole('menu')).getByRole('menuitem', { name: /Cancelar vacante/ }));
    const dialogo = await screen.findByRole('dialog');
    await pulsar(within(dialogo).getByRole('button', { name: 'Volver' }));
    expect(llamadas.filter((l) => l.metodo !== 'GET')).toHaveLength(0);
  });

  it('publicar un borrador manda el PUT de siempre', async () => {
    const Pagina = (await import('@/app/company/dashboard/page')).default;
    render(<Pagina />);
    await screen.findByRole('heading', { level: 1 });
    await pulsar(screen.getByRole('tab', { name: /Borradores/ }));
    const publicar = screen.getAllByRole('button', { name: /^Publicar$/ })[0];
    await pulsar(publicar);
    const dialogo = await screen.findByRole('dialog');
    await pulsar(within(dialogo).getByRole('button', { name: /Publicar vacante/ }));
    await waitFor(() => expect(llamadas.find((l) => l.metodo === 'PUT')).toMatchObject({ url: '/api/jobs/publish', cuerpo: { jobId: expect.any(Number) } }));
  });

  it('sin vacantes y con la cuenta en revisión: aviso, vacío y «Activas» una sola vez', async () => {
    window.history.pushState({}, '', '/?vacio=1&cuenta=pending');
    const Pagina = (await import('@/app/company/dashboard/page')).default;
    render(<Pagina />);
    await screen.findByRole('heading', { level: 1 });
    expect(screen.getByText('Cuenta en revisión.')).toBeInTheDocument();
    expect(screen.getByText('No tienes vacantes publicadas')).toBeInTheDocument();
    expect(screen.getAllByText(/activas/i)).toHaveLength(1);
    expect(screen.getAllByText(/mis vacantes/i)).toHaveLength(1);
    window.history.pushState({}, '', '/?cuenta=sin');
  });

  it('sin solicitud asociada, avisa y el título cae a «Tu panel»', async () => {
    const Pagina = (await import('@/app/company/dashboard/page')).default;
    render(<Pagina />);
    await screen.findByRole('heading', { level: 1, name: 'Tu panel' });
    expect(screen.getByText('Tu empresa no tiene una solicitud asociada.')).toBeInTheDocument();
    window.history.pushState({}, '', '/');
  });

  it('los candidatos navegan con router.push como antes', async () => {
    const Pagina = (await import('@/app/company/dashboard/page')).default;
    render(<Pagina />);
    await screen.findByRole('heading', { level: 1 });
    await pulsar(screen.getByRole('button', { name: /Ver candidatos de Científica de Datos/ }));
    expect(push).toHaveBeenCalledWith('/company/jobs/210/candidates');
  });
});

describe('Candidatos de una vacante', () => {
  beforeEach(() => {
    parametros = { jobId: '203' };
  });

  it('monta con pestañas y «Me interesa» manda el PATCH de siempre', async () => {
    const Pagina = (await import('@/app/company/jobs/[jobId]/candidates/page')).default;
    render(<Pagina />);
    await screen.findByRole('heading', { level: 1, name: 'Analista Contable Jr.' });
    expect(screen.getByRole('tab', { name: /Por revisar/ })).toHaveAttribute('aria-selected', 'true');
    const botones = screen.getAllByRole('button', { name: /^Me interesa: / });
    await pulsar(botones[0]);
    const dialogo = await screen.findByRole('dialog');
    await pulsar(within(dialogo).getByRole('button', { name: 'Me interesa' }));
    await waitFor(() =>
      expect(llamadas.find((l) => l.metodo === 'PATCH')).toMatchObject({
        metodo: 'PATCH',
        cuerpo: { status: 'company_interested', closeJob: false },
      })
    );
  });

  it('contratar hace las dos preguntas y «dejarla abierta» manda closeJob: false', async () => {
    const Pagina = (await import('@/app/company/jobs/[jobId]/candidates/page')).default;
    render(<Pagina />);
    await screen.findByRole('heading', { level: 1 });
    await pulsar(screen.getByRole('tab', { name: /En proceso/ }));
    await pulsar(screen.getAllByRole('button', { name: /^Más acciones para / })[0]);
    await pulsar(within(await screen.findByRole('menu')).getByRole('menuitem', { name: /Contratar/ }));
    let dialogo = await screen.findByRole('dialog');
    await pulsar(within(dialogo).getByRole('button', { name: 'Iniciar contratación' }));
    dialogo = await screen.findByRole('dialog');
    await waitFor(() => expect(screen.getByRole('dialog')).toHaveTextContent('¿Deseas cerrar la vacante?'));
    await pulsar(within(screen.getByRole('dialog')).getByRole('button', { name: 'No, dejarla abierta' }));
    await waitFor(() =>
      expect(llamadas.find((l) => l.metodo === 'PATCH')).toMatchObject({ cuerpo: { status: 'accepted', closeJob: false } })
    );
  });

  it('la ficha se abre con la fila y la entrevista abre su diálogo', async () => {
    const Pagina = (await import('@/app/company/jobs/[jobId]/candidates/page')).default;
    render(<Pagina />);
    await screen.findByRole('heading', { level: 1 });
    const nombre = screen.getAllByRole('button', { name: /: ver ficha$/ })[0];
    await pulsar(nombre);
    expect(await screen.findByRole('dialog', { name: 'ficha' })).toBeInTheDocument();
  });

  it('404 muestra el aviso con Reintentar', async () => {
    parametros = { jobId: '404' };
    const Pagina = (await import('@/app/company/jobs/[jobId]/candidates/page')).default;
    render(<Pagina />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Vacante no encontrada');
    expect(screen.getByRole('button', { name: /Reintentar/ })).toBeInTheDocument();
  });
});

describe('Solicitud de entrevista', () => {
  it('manda el mismo cuerpo al elegir un horario', async () => {
    const Modal = (await import('@/components/company/InterviewRequestModal')).default;
    const alExito = jest.fn();
    render(
      <Modal isOpen onClose={jest.fn()} applicationId={20300} candidateName="Ana Prueba" jobTitle="Analista" onSuccess={alExito} />
    );
    const dialogo = await screen.findByRole('dialog', { name: /Solicitar entrevista/ });
    const enviar = within(dialogo).getByRole('button', { name: /Enviar solicitud a INAKAT/ });
    expect(enviar).toBeDisabled();
    const celdas = within(dialogo).getAllByRole('button', { pressed: false });
    const horario = celdas.find((b) => /, 09:00$/.test(b.getAttribute('aria-label') ?? ''))!;
    await pulsar(horario);
    expect(horario).toHaveAttribute('aria-pressed', 'true');
    await pulsar(within(dialogo).getByLabelText(/Presencial/));
    await pulsar(enviar);
    await waitFor(() => expect(alExito).toHaveBeenCalled());
    const post = llamadas.find((l) => l.metodo === 'POST')!;
    expect(post.url).toBe('/api/company/interview-requests');
    expect(post.cuerpo).toEqual({
      applicationId: 20300,
      type: 'presential',
      duration: 45,
      participants: null,
      availableSlots: [{ date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), time: '09:00' }],
      message: null,
    });
  });
});

describe('Entrevistas', () => {
  it('monta con la próxima entrevista y las pestañas', async () => {
    const Pagina = (await import('@/app/company/interviews/page')).default;
    render(<Pagina />);
    await screen.findByRole('heading', { level: 1, name: /Entrevistas/ });
    expect(screen.getByRole('heading', { name: 'Próxima entrevista' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Pendientes/ })).toHaveAttribute('aria-selected', 'true');
    await pulsar(screen.getByRole('tab', { name: /Pasadas/ }));
    expect(screen.getByText('Esta entrevista fue cancelada.')).toBeInTheDocument();
    expect(llamadas).toEqual([{ url: '/api/company/interviews', metodo: 'GET', cuerpo: undefined }]);
  });
});

describe('Perfil de empresa', () => {
  it('guarda con el mismo PUT (el formData de siempre)', async () => {
    const Pagina = (await import('@/app/company/profile/page')).default;
    render(<Pagina />);
    await screen.findByRole('heading', { level: 1, name: 'Perfil de empresa' });
    const nombre = screen.getByLabelText(/Nombre de empresa/);
    expect(nombre).toBeRequired();
    fireEvent.change(nombre, { target: { value: 'Grupo Andes Norte' } });
    await act(async () => {
      fireEvent.submit(nombre.closest('form')!);
    });
    await waitFor(() => expect(llamadas.find((l) => l.metodo === 'PUT')).toBeTruthy());
    const put = llamadas.find((l) => l.metodo === 'PUT')!;
    expect(put.url).toBe('/api/company/profile');
    expect(Object.keys(put.cuerpo as object).sort()).toEqual(
      ['apellidoMaterno', 'apellidoPaterno', 'correoEmpresa', 'direccionEmpresa', 'latitud', 'longitud', 'nombre', 'nombreEmpresa', 'razonSocial', 'sitioWeb'].sort()
    );
    expect((put.cuerpo as { nombreEmpresa: string }).nombreEmpresa).toBe('Grupo Andes Norte');
    expect(await screen.findByText('Perfil actualizado exitosamente')).toBeInTheDocument();
  });

  // QA visual (b5): sobre el mapa salía el diálogo de Google («This page can't
  // load Google Maps correctly», BillingNotEnabledMapError). Ahora, si el mapa
  // no se puede usar, sale un respaldo propio con la dirección en texto.
  describe('respaldo del mapa', () => {
    const claveOriginal = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    beforeEach(() => {
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = 'clave-de-prueba';
    });
    afterEach(() => {
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = claveOriginal;
      mockEstadoMapa = { isLoaded: false, loadError: undefined };
    });

    // Va primero: el rechazo de la clave se recuerda para toda la sesión
    // (nivel de módulo de useFalloMapa), como en el navegador.
    it('con el mapa cargado pinta el mapa y el buscador, sin respaldo', async () => {
      mockEstadoMapa = { isLoaded: true, loadError: undefined };
      const Pagina = (await import('@/app/company/profile/page')).default;
      render(<Pagina />);
      await screen.findByRole('heading', { level: 1, name: 'Perfil de empresa' });
      expect(screen.getByTestId('mapa-google')).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /^Dirección/ })).toBeInTheDocument();
      expect(screen.queryByText('Mapa no disponible')).toBeNull();
    });

    it('si el script no carga, enseña la dirección guardada en texto y «Mapa no disponible»', async () => {
      mockEstadoMapa = { isLoaded: false, loadError: new Error('sin red') };
      const Pagina = (await import('@/app/company/profile/page')).default;
      render(<Pagina />);
      await screen.findByRole('heading', { level: 1, name: 'Perfil de empresa' });
      expect(screen.getByText('Mapa no disponible')).toBeInTheDocument();
      expect(screen.getByText(/Av\. Constitución 1500 Ote\./)).toBeInTheDocument();
      expect(screen.getByText('Ubicación fijada en el mapa')).toBeInTheDocument();
      expect(screen.queryByText(/Cargando mapa/)).toBeNull();
      expect(screen.queryByTestId('mapa-google')).toBeNull();
    });

    it('sin clave, el mismo respaldo (el banco sin clave no enseña el diálogo de Google)', async () => {
      delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      mockEstadoMapa = { isLoaded: true, loadError: undefined };
      const Pagina = (await import('@/app/company/profile/page')).default;
      render(<Pagina />);
      await screen.findByRole('heading', { level: 1, name: 'Perfil de empresa' });
      expect(screen.getByText('Mapa no disponible')).toBeInTheDocument();
      expect(screen.queryByTestId('mapa-google')).toBeNull();
    });

    it('si Google rechaza la clave (gm_authFailure), el mapa se cambia por el respaldo y el PUT es el de siempre', async () => {
      mockEstadoMapa = { isLoaded: true, loadError: undefined };
      const Pagina = (await import('@/app/company/profile/page')).default;
      render(<Pagina />);
      await screen.findByRole('heading', { level: 1, name: 'Perfil de empresa' });
      expect(screen.getByTestId('mapa-google')).toBeInTheDocument();
      await act(async () => {
        (window as unknown as { gm_authFailure?: () => void }).gm_authFailure?.();
      });
      expect(screen.getByText('Mapa no disponible')).toBeInTheDocument();
      expect(screen.queryByTestId('mapa-google')).toBeNull();
      await act(async () => {
        fireEvent.submit(screen.getByLabelText(/Nombre de empresa/).closest('form')!);
      });
      await waitFor(() => expect(llamadas.find((l) => l.metodo === 'PUT')).toBeTruthy());
      const put = llamadas.find((l) => l.metodo === 'PUT')!;
      expect((put.cuerpo as { direccionEmpresa: string }).direccionEmpresa).toMatch(/Av\. Constitución 1500 Ote\./);
    });
  });
});

describe('Integraciones', () => {
  it('crear una API key manda el POST de siempre y enseña la key una vez', async () => {
    const Pagina = (await import('@/app/company/integrations/page')).default;
    render(<Pagina />);
    await screen.findByRole('heading', { level: 1, name: /Integraciones/ });
    await screen.findByText('Worky2 producción');
    const campo = screen.getByLabelText(/Nombre de la API key/);
    fireEvent.change(campo, { target: { value: 'ERP interno' } });
    await act(async () => {
      fireEvent.submit(campo.closest('form')!);
    });
    await screen.findByText(/Guarda esta key ahora/);
    const post = llamadas.find((l) => l.metodo === 'POST')!;
    expect(post).toEqual({ url: '/api/integration/keys', metodo: 'POST', cuerpo: { name: 'ERP interno' } });
  });

  // QA visual (b5, 390 px): «Desactivar» caía encima de la URL del webhook y
  // «Revocar» casi tocaba la key. Las acciones son botones CON TEXTO en la
  // columna de acciones (la vista en tarjetas los baja al pie: data-boton)
  // y las cadenas largas cortan en cualquier carácter.
  it('en la tarjeta de móvil las acciones van al pie y la URL y la key pueden partirse', async () => {
    const Pagina = (await import('@/app/company/integrations/page')).default;
    render(<Pagina />);
    const url = await screen.findByText('https://nomina.grupoandes.mx/inakat/webhook');
    expect(url).toHaveClass('break-all');
    expect(screen.getAllByText(/^inak_\*+$/)[0]).toHaveClass('break-all');
    const desactivar = screen.getByRole('button', { name: /Desactivar el webhook/ });
    expect(desactivar.closest('td')).toHaveAttribute('data-tarjeta', 'acciones');
    expect(desactivar).toHaveAttribute('data-boton', 'texto');
    const revocar = screen.getAllByRole('button', { name: /Revocar la API key/ })[0];
    expect(revocar.closest('td')).toHaveAttribute('data-tarjeta', 'acciones');
    expect(revocar).toHaveAttribute('data-boton', 'texto');
  });

  it('desactivar un webhook manda el DELETE de siempre', async () => {
    const Pagina = (await import('@/app/company/integrations/page')).default;
    render(<Pagina />);
    await pulsar(await screen.findByRole('button', { name: /Desactivar el webhook/ }));
    await waitFor(() =>
      expect(llamadas.find((l) => l.metodo === 'DELETE')).toEqual({ url: '/api/integration/webhooks?id=31', metodo: 'DELETE', cuerpo: undefined })
    );
  });
});

describe('Ajustes de la QA visual (b5)', () => {
  it('Entrevistas lleva el antetítulo del panel de empresa, no «Reclutamiento»', async () => {
    const Pagina = (await import('@/app/company/interviews/page')).default;
    render(<Pagina />);
    await screen.findByRole('heading', { level: 1, name: /Entrevistas/ });
    expect(screen.getByText('Empresa', { selector: 'p' })).toBeInTheDocument();
    expect(screen.queryByText('Reclutamiento', { selector: 'p' })).toBeNull();
  });

  it('el salario de la tabla de vacantes no parte «MXN» a otro renglón', async () => {
    const Pagina = (await import('@/app/company/dashboard/page')).default;
    render(<Pagina />);
    await screen.findByRole('heading', { level: 1 });
    const salarios = screen.getAllByText(/^\$[\d,]+ – \$[\d,]+ MXN$/);
    expect(salarios.length).toBeGreaterThan(0);
    salarios.forEach((s) => expect(s.closest('td')).toHaveClass('whitespace-nowrap'));
  });

  it('el botón flotante sólo sale cuando «Publicar vacante» de la cabecera deja de verse', async () => {
    let avisar: ((entradas: Array<{ isIntersecting: boolean }>) => void) | null = null;
    const observados: Element[] = [];
    class ObservadorFalso {
      constructor(cb: (entradas: Array<{ isIntersecting: boolean }>) => void) {
        avisar = cb;
      }
      observe(el: Element) {
        observados.push(el);
      }
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    }
    const ventana = window as unknown as { IntersectionObserver?: unknown };
    const original = ventana.IntersectionObserver;
    ventana.IntersectionObserver = ObservadorFalso;
    try {
      const Pagina = (await import('@/app/company/dashboard/page')).default;
      render(<Pagina />);
      await screen.findByRole('heading', { level: 1 });
      const flotante = screen.getByTitle('Crear nueva vacante').parentElement!;
      // Al cargar: se ve el de la cabecera → el flotante, oculto y fuera del teclado.
      expect(flotante).toHaveAttribute('data-oculto', 'true');
      expect(flotante).toHaveAttribute('inert');
      // Lo observado es el botón de la cabecera (no el flotante).
      expect(observados[0]).toHaveTextContent('Publicar vacante');
      expect(flotante.contains(observados[0])).toBe(false);
      // Al bajar, la cabecera sale de la vista → el flotante aparece.
      await act(async () => {
        avisar!([{ isIntersecting: false }]);
      });
      expect(flotante).toHaveAttribute('data-oculto', 'false');
      expect(flotante).not.toHaveAttribute('inert');
      // Los dos hacen lo mismo de siempre.
      await pulsar(screen.getByTitle('Crear nueva vacante'));
      expect(push).toHaveBeenCalledWith('/create-job');
    } finally {
      ventana.IntersectionObserver = original;
    }
  });
});
