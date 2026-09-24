// Tests de la auditoría 2026-09, módulo AUTHUI: página /register.
// Cubre AUTHUI-003, 004, 005, 006, 007, 016, 017, 018, 020, 023, 024, 026 y 027.
// Son tests de comportamiento: llenan el formulario como lo haría un candidato
// y miran qué se envía (o qué NO se envía) a /api/auth/register.

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RegisterPage from '@/app/register/page';

jest.mock('next/image', () => ({
  __esModule: true,
  // eslint-disable-next-line @next/next/no-img-element, @typescript-eslint/no-explicit-any
  default: (props: any) => <img {...props} alt={props.alt} />,
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;
global.alert = jest.fn();

// jsdom no implementa matchMedia; SiteMotion (el movimiento del registro
// público) lo consulta en su efecto.
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

const respuestaEspecialidades = {
  ok: true,
  status: 200,
  headers: { get: () => 'application/json' },
  json: async () => ({
    success: true,
    data: [{ id: 1, name: 'Tecnología', subcategories: ['Desarrollo Web'] }],
  }),
};

const respuestaRegistro = {
  ok: true,
  status: 201,
  headers: { get: () => 'application/json' },
  json: async () => ({
    success: true,
    user: { id: 1, role: 'candidate' },
    candidate: { id: 1, experiencesCount: 0, documentsCount: 0 },
  }),
};

/** Deja el mock en su comportamiento normal (especialidades + registro OK). */
const mockPorDefecto = () => {
  mockFetch.mockImplementation((url: string) => {
    if (url.includes('/api/specialties')) return Promise.resolve(respuestaEspecialidades);
    if (url.includes('/api/auth/register')) return Promise.resolve(respuestaRegistro);
    return Promise.reject(new Error('URL no mockeada: ' + url));
  });
};

const llenarPaso1 = async () => {
  await userEvent.type(screen.getByPlaceholderText('Tu nombre'), 'Juan');
  await userEvent.type(screen.getByPlaceholderText('Tu apellido paterno'), 'Pérez');
  await userEvent.type(screen.getByPlaceholderText('tu@email.com'), 'juan@test.com');
  await userEvent.type(screen.getByPlaceholderText('8+ caracteres'), 'TestPass123');
  await userEvent.type(screen.getByPlaceholderText('Repítela'), 'TestPass123');
};

const siguiente = async (paso: number) => {
  fireEvent.click(screen.getByText('Siguiente'));
  await waitFor(() => expect(screen.getByText(new RegExp(`Paso ${paso} de 6`))).toBeInTheDocument());
};

const irAlPaso6 = async () => {
  fireEvent.click(screen.getByText(/Omitir y crear cuenta con datos básicos/));
  await waitFor(() => expect(screen.getByText(/Paso 6 de 6/)).toBeInTheDocument());
};

const botonCrearCuenta = () => screen.getByRole('button', { name: /CREAR CUENTA/i });

const crearCuenta = async () => {
  await waitFor(() => expect(botonCrearCuenta()).not.toBeDisabled());
  fireEvent.click(botonCrearCuenta());
};

const llamadasARegistro = () =>
  mockFetch.mock.calls.filter((llamada) => String(llamada[0]).includes('/api/auth/register'));

/** Cuerpo JSON del último POST a /api/auth/register. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cuerpoDelRegistro = (): any => {
  const llamadas = llamadasARegistro();
  return JSON.parse(llamadas[llamadas.length - 1][1].body);
};

const archivo = (nombre = 'cv.pdf', bytes = 10) =>
  new File([new Uint8Array(bytes)], nombre, { type: 'application/pdf' });

const inputsDeArchivo = (contenedor: HTMLElement) =>
  Array.from(contenedor.querySelectorAll('input[type="file"]')) as HTMLInputElement[];

describe('RegisterPage — auditoría AUTHUI', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPorDefecto();
  });

  // ============================================================
  // AUTHUI-006 / AUTHUI-018: nada se descarta en silencio
  // ============================================================

  describe('AUTHUI-006: filas incompletas ya no se descartan en silencio', () => {
    it('una experiencia sin fecha de inicio bloquea el alta y se señala en su tarjeta', async () => {
      render(<RegisterPage />);
      await llenarPaso1();
      await siguiente(2);
      await siguiente(3);
      await siguiente(4);

      fireEvent.click(screen.getByText('Agregar experiencia'));
      await waitFor(() => expect(screen.getByText('Experiencia 1')).toBeInTheDocument());
      await userEvent.type(screen.getByPlaceholderText('Nombre de la empresa'), 'INAKAT');
      await userEvent.type(screen.getByPlaceholderText('Tu puesto'), 'Desarrollador');

      await irAlPaso6();
      await crearCuenta();

      await waitFor(() => {
        expect(screen.getByText('Indica la fecha de inicio')).toBeInTheDocument();
      });
      expect(llamadasARegistro()).toHaveLength(0);
      expect(screen.getByText(/Paso 4 de 6/)).toBeInTheDocument();
    });

    it('un documento con nombre pero sin archivo bloquea el alta (AUTHUI-018)', async () => {
      render(<RegisterPage />);
      await llenarPaso1();
      await irAlPaso6();

      fireEvent.click(screen.getByText('Agregar documento'));
      await waitFor(() => expect(screen.getByText('Documento 1')).toBeInTheDocument());
      await userEvent.type(
        screen.getByPlaceholderText('Ej: Título universitario, Certificación AWS...'),
        'Certificación AWS'
      );

      await crearCuenta();

      await waitFor(() => {
        expect(screen.getByText('Adjunta el archivo del documento')).toBeInTheDocument();
      });
      expect(llamadasARegistro()).toHaveLength(0);
    });

    it('una educación con institución pero sin nivel bloquea el alta', async () => {
      render(<RegisterPage />);
      await llenarPaso1();
      await siguiente(2);

      fireEvent.click(screen.getByText('Agregar educación'));
      await waitFor(() => expect(screen.getByText('Educación 1')).toBeInTheDocument());
      await userEvent.type(
        screen.getByPlaceholderText('Ej: UANL, Tec de Monterrey, UNAM...'),
        'UANL'
      );

      await irAlPaso6();
      await crearCuenta();

      await waitFor(() => {
        expect(screen.getByText('Selecciona el nivel de estudios')).toBeInTheDocument();
      });
      expect(llamadasARegistro()).toHaveLength(0);
    });

    it('las filas totalmente vacías se siguen ignorando sin molestar al usuario', async () => {
      render(<RegisterPage />);
      await llenarPaso1();
      await siguiente(2);
      fireEvent.click(screen.getByText('Agregar educación'));
      await waitFor(() => expect(screen.getByText('Educación 1')).toBeInTheDocument());

      await irAlPaso6();
      fireEvent.click(screen.getByText('Agregar documento'));
      await waitFor(() => expect(screen.getByText('Documento 1')).toBeInTheDocument());

      await crearCuenta();

      await waitFor(() => expect(llamadasARegistro()).toHaveLength(1));
      expect(cuerpoDelRegistro().educacion).toEqual([]);
      expect(cuerpoDelRegistro().documents).toEqual([]);
    });
  });

  // ============================================================
  // AUTHUI-004: borrar una experiencia suelta su error
  // ============================================================

  describe('AUTHUI-004: errores de experiencia indexados por identidad', () => {
    const agregarExperienciaConFechasInvalidas = async () => {
      fireEvent.click(screen.getByText('Agregar experiencia'));
      await waitFor(() => expect(screen.getByText('Experiencia 1')).toBeInTheDocument());
      await userEvent.type(screen.getByPlaceholderText('Nombre de la empresa'), 'INAKAT');
      await userEvent.type(screen.getByPlaceholderText('Tu puesto'), 'Desarrollador');
      const fechas = screen.getAllByDisplayValue('') as HTMLInputElement[];
      const [inicio, fin] = fechas.filter((campo) => campo.type === 'date');
      fireEvent.change(inicio, { target: { value: '2024-01-01' } });
      fireEvent.change(fin, { target: { value: '2020-01-01' } });
      await waitFor(() =>
        expect(
          screen.getByText('La fecha de fin no puede ser anterior a la fecha de inicio')
        ).toBeInTheDocument()
      );
    };

    it('tras borrar la experiencia con fechas inválidas sí se puede crear la cuenta', async () => {
      const { container } = render(<RegisterPage />);
      await llenarPaso1();
      await siguiente(2);
      await siguiente(3);
      await siguiente(4);

      await agregarExperienciaConFechasInvalidas();

      // El bote de basura de la tarjeta de experiencia.
      const tarjeta = screen.getByText('Experiencia 1').closest('div')!.parentElement!;
      fireEvent.click(within(tarjeta).getAllByRole('button')[0]);
      await waitFor(() => expect(screen.queryByText('Experiencia 1')).not.toBeInTheDocument());

      await irAlPaso6();
      await crearCuenta();

      await waitFor(() => expect(llamadasARegistro()).toHaveLength(1));
      expect(cuerpoDelRegistro().experiences).toEqual([]);
      expect(container.textContent).not.toContain(
        'Corrige los errores en las fechas de experiencia'
      );
    });

    it('mientras la experiencia inválida siga ahí, el alta se bloquea', async () => {
      render(<RegisterPage />);
      await llenarPaso1();
      await siguiente(2);
      await siguiente(3);
      await siguiente(4);

      await agregarExperienciaConFechasInvalidas();

      await irAlPaso6();
      await crearCuenta();

      await waitFor(() => expect(screen.getByText(/Paso 4 de 6/)).toBeInTheDocument());
      expect(llamadasARegistro()).toHaveLength(0);
    });
  });

  // ============================================================
  // AUTHUI-005 / AUTHUI-007: subidas y estado
  // ============================================================

  describe('AUTHUI-005/007: subida de documentos', () => {
    /** Mock con la subida en suspenso hasta que la prueba la resuelva. */
    const mockSubidaControlada = () => {
      let resolver!: (url: string) => void;
      const enCurso = new Promise<string>((resolve) => {
        resolver = resolve;
      });
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/api/specialties')) return Promise.resolve(respuestaEspecialidades);
        if (url.includes('/api/auth/register')) return Promise.resolve(respuestaRegistro);
        if (url.includes('/api/upload')) {
          return enCurso.then((urlSubida) => ({
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: async () => ({ success: true, url: urlSubida }),
          }));
        }
        return Promise.reject(new Error('URL no mockeada: ' + url));
      });
      return { resolver: (url: string) => resolver(url) };
    };

    const prepararDocumentoSubiendo = async (contenedor: HTMLElement) => {
      await irAlPaso6();
      fireEvent.click(screen.getByText('Agregar documento'));
      await waitFor(() => expect(screen.getByText('Documento 1')).toBeInTheDocument());
      const [inputArchivo] = inputsDeArchivo(contenedor);
      fireEvent.change(inputArchivo, { target: { files: [archivo('titulo.pdf')] } });
      await waitFor(() => expect(screen.getByText(/Subiendo/)).toBeInTheDocument());
    };

    it('AUTHUI-005: el nombre tecleado durante la subida NO se pisa al terminar', async () => {
      const control = mockSubidaControlada();
      const { container } = render(<RegisterPage />);
      await llenarPaso1();
      await prepararDocumentoSubiendo(container);

      // El candidato escribe el nombre mientras el archivo sube.
      const campoNombre = screen.getByPlaceholderText(
        'Ej: Título universitario, Certificación AWS...'
      );
      await userEvent.type(campoNombre, 'Título universitario');

      control.resolver('https://blob.test/titulo.pdf');
      await waitFor(() => expect(screen.queryByText(/Subiendo/)).not.toBeInTheDocument());

      expect(campoNombre).toHaveValue('Título universitario');

      await crearCuenta();
      await waitFor(() => expect(llamadasARegistro()).toHaveLength(1));
      expect(cuerpoDelRegistro().documents).toEqual([
        { name: 'Título universitario', fileUrl: 'https://blob.test/titulo.pdf' },
      ]);
    });

    it('AUTHUI-007: con un archivo en vuelo, CREAR CUENTA está deshabilitado', async () => {
      const control = mockSubidaControlada();
      const { container } = render(<RegisterPage />);
      await llenarPaso1();
      await prepararDocumentoSubiendo(container);
      await userEvent.type(
        screen.getByPlaceholderText('Ej: Título universitario, Certificación AWS...'),
        'Título'
      );

      expect(botonCrearCuenta()).toBeDisabled();
      expect(screen.getByText('Espera a que terminen de subir tus archivos')).toBeInTheDocument();

      // Aunque se fuerce el submit, no sale nada hacia el API.
      fireEvent.submit(botonCrearCuenta().closest('form')!);
      expect(llamadasARegistro()).toHaveLength(0);

      control.resolver('https://blob.test/titulo.pdf');
      await waitFor(() => expect(botonCrearCuenta()).not.toBeDisabled());
    });

    it('AUTHUI-017: un fallo de subida se explica en la tarjeta, sin alert()', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/api/specialties')) return Promise.resolve(respuestaEspecialidades);
        if (url.includes('/api/upload')) {
          return Promise.resolve({
            ok: false,
            status: 413,
            headers: { get: () => 'text/plain' },
            text: async () => 'Request Entity Too Large',
            json: async () => {
              throw new SyntaxError('Unexpected token R in JSON at position 0');
            },
          });
        }
        return Promise.reject(new Error('URL no mockeada: ' + url));
      });

      const { container } = render(<RegisterPage />);
      await llenarPaso1();
      await irAlPaso6();
      fireEvent.click(screen.getByText('Agregar documento'));
      await waitFor(() => expect(screen.getByText('Documento 1')).toBeInTheDocument());

      const [inputArchivo] = inputsDeArchivo(container);
      fireEvent.change(inputArchivo, { target: { files: [archivo('titulo.pdf')] } });

      await waitFor(() => {
        expect(screen.getByText(/El archivo es demasiado grande/)).toBeInTheDocument();
      });
      expect(global.alert).not.toHaveBeenCalled();
      expect(container.textContent).not.toContain('JSON');
    });
  });

  // ============================================================
  // AUTHUI-003: errores del CV
  // ============================================================

  describe('AUTHUI-003: subida del CV', () => {
    const irAPaso5 = async () => {
      await siguiente(2);
      await siguiente(3);
      await siguiente(4);
      await siguiente(5);
    };

    it('muestra el motivo real que devuelve el servidor', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/api/specialties')) return Promise.resolve(respuestaEspecialidades);
        if (url.includes('/api/upload')) {
          return Promise.resolve({
            ok: false,
            status: 400,
            headers: { get: () => 'application/json' },
            json: async () => ({
              success: false,
              error: 'Tipo de archivo no permitido (text/html)',
            }),
          });
        }
        return Promise.reject(new Error('URL no mockeada: ' + url));
      });

      const { container } = render(<RegisterPage />);
      await llenarPaso1();
      await irAPaso5();

      const [inputCv] = inputsDeArchivo(container);
      fireEvent.change(inputCv, { target: { files: [archivo('cv.pdf')] } });

      await waitFor(() => {
        expect(screen.getByText('Tipo de archivo no permitido (text/html)')).toBeInTheDocument();
      });
    });

    it('rechaza el archivo por tamaño ANTES de subirlo', async () => {
      const { container } = render(<RegisterPage />);
      await llenarPaso1();
      await irAPaso5();

      const [inputCv] = inputsDeArchivo(container);
      fireEvent.change(inputCv, {
        target: { files: [archivo('enorme.pdf', 5 * 1024 * 1024)] },
      });

      await waitFor(() => {
        expect(screen.getByText(/no debe exceder 4MB/)).toBeInTheDocument();
      });
      expect(mockFetch.mock.calls.filter((c) => String(c[0]).includes('/api/upload'))).toHaveLength(0);
    });
  });

  // ============================================================
  // AUTHUI-027: reintentar con el mismo archivo
  // ============================================================

  it('AUTHUI-027: el input de archivo se limpia para poder reintentar con el mismo archivo', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/specialties')) return Promise.resolve(respuestaEspecialidades);
      if (url.includes('/api/upload')) {
        return Promise.resolve({
          ok: false,
          status: 500,
          headers: { get: () => 'application/json' },
          json: async () => ({ success: false, error: 'Error al subir el archivo' }),
        });
      }
      return Promise.reject(new Error('URL no mockeada: ' + url));
    });

    const { container } = render(<RegisterPage />);
    await llenarPaso1();
    await irAlPaso6();
    fireEvent.click(screen.getByText('Agregar documento'));
    await waitFor(() => expect(screen.getByText('Documento 1')).toBeInTheDocument());

    const [inputArchivo] = inputsDeArchivo(container);
    fireEvent.change(inputArchivo, { target: { files: [archivo('titulo.pdf')] } });
    await waitFor(() => expect(screen.getByText('Error al subir el archivo')).toBeInTheDocument());

    // El valor quedó vacío: elegir otra vez el MISMO archivo vuelve a disparar
    // el evento 'change' (antes el navegador no lo emitía y no pasaba nada).
    expect(inputsDeArchivo(container)[0].value).toBe('');

    fireEvent.change(inputsDeArchivo(container)[0], {
      target: { files: [archivo('titulo.pdf')] },
    });
    await waitFor(() =>
      expect(mockFetch.mock.calls.filter((c) => String(c[0]).includes('/api/upload')).length).toBe(2)
    );
  });

  // ============================================================
  // AUTHUI-016: especialidades
  // ============================================================

  describe('AUTHUI-016: carga de especialidades', () => {
    it('avisa y ofrece reintentar cuando /api/specialties falla', async () => {
      let intentos = 0;
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/api/specialties')) {
          intentos += 1;
          if (intentos === 1) {
            return Promise.resolve({
              ok: false,
              status: 500,
              headers: { get: () => 'application/json' },
              json: async () => ({ success: false, error: 'Error interno' }),
            });
          }
          return Promise.resolve(respuestaEspecialidades);
        }
        return Promise.reject(new Error('URL no mockeada: ' + url));
      });

      render(<RegisterPage />);
      await llenarPaso1();
      await siguiente(2);
      await siguiente(3);

      await waitFor(() => {
        expect(screen.getByText(/No pudimos cargar las áreas/)).toBeInTheDocument();
      });
      expect(screen.getAllByRole('combobox')[0]).toBeDisabled();

      fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'Tecnología' })).toBeInTheDocument();
      });
      expect(screen.queryByText(/No pudimos cargar las áreas/)).not.toBeInTheDocument();
      expect(screen.getAllByRole('combobox')[0]).not.toBeDisabled();
    });

    it('un 200 con success:false tampoco se toma por bueno', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/api/specialties')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: async () => ({ success: false }),
          });
        }
        return Promise.reject(new Error('URL no mockeada: ' + url));
      });

      render(<RegisterPage />);
      await llenarPaso1();
      await siguiente(2);
      await siguiente(3);

      await waitFor(() => {
        expect(screen.getByText(/No pudimos cargar las áreas/)).toBeInTheDocument();
      });
    });
  });

  // ============================================================
  // AUTHUI-023 / 024 / 026: validaciones de datos
  // ============================================================

  describe('AUTHUI-023/024/026: validaciones del formulario', () => {
    it('AUTHUI-023: un teléfono que no sirve para llamar no deja avanzar', async () => {
      render(<RegisterPage />);
      await llenarPaso1();
      await userEvent.type(screen.getByPlaceholderText('81 1234 5678'), '811234567');

      fireEvent.click(screen.getByText('Siguiente'));

      await waitFor(() => {
        expect(screen.getByText(/Teléfono inválido/)).toBeInTheDocument();
      });
      expect(screen.getByText(/Paso 1 de 6/)).toBeInTheDocument();
    });

    it('AUTHUI-023: acepta el formato con espacios que propone el placeholder', async () => {
      render(<RegisterPage />);
      await llenarPaso1();
      await userEvent.type(screen.getByPlaceholderText('81 1234 5678'), '81 1234 5678');

      await siguiente(2);
      expect(screen.queryByText(/Teléfono inválido/)).not.toBeInTheDocument();
    });

    it('AUTHUI-024: una fecha de nacimiento futura no pasa', async () => {
      render(<RegisterPage />);
      await llenarPaso1();

      const campos = screen.getAllByDisplayValue('') as HTMLInputElement[];
      const nacimiento = campos.find((campo) => campo.type === 'date')!;
      fireEvent.change(nacimiento, { target: { value: '2099-01-01' } });

      fireEvent.click(screen.getByText('Siguiente'));

      await waitFor(() => {
        expect(screen.getByText(/al menos 15 años/)).toBeInTheDocument();
      });
      expect(screen.getByText(/Paso 1 de 6/)).toBeInTheDocument();
    });

    it('AUTHUI-026: el año de fin anterior al de inicio se señala en la tarjeta', async () => {
      render(<RegisterPage />);
      await llenarPaso1();
      await siguiente(2);

      fireEvent.click(screen.getByText('Agregar educación'));
      await waitFor(() => expect(screen.getByText('Educación 1')).toBeInTheDocument());

      fireEvent.change(screen.getAllByRole('combobox')[0], {
        target: { value: 'Licenciatura' },
      });
      await userEvent.type(
        screen.getByPlaceholderText('Ej: UANL, Tec de Monterrey, UNAM...'),
        'UANL'
      );
      fireEvent.change(screen.getByPlaceholderText('2020'), { target: { value: '2019' } });
      fireEvent.change(screen.getByPlaceholderText('2024'), { target: { value: '2015' } });

      fireEvent.click(screen.getByText('Siguiente'));

      await waitFor(() => {
        expect(
          screen.getByText('El año de fin no puede ser anterior al de inicio')
        ).toBeInTheDocument();
      });
      expect(screen.getByText(/Paso 2 de 6/)).toBeInTheDocument();
    });

    it('AUTHUI-026: un año fuera de rango tampoco pasa', async () => {
      render(<RegisterPage />);
      await llenarPaso1();
      await siguiente(2);

      fireEvent.click(screen.getByText('Agregar educación'));
      await waitFor(() => expect(screen.getByText('Educación 1')).toBeInTheDocument());

      fireEvent.change(screen.getAllByRole('combobox')[0], {
        target: { value: 'Licenciatura' },
      });
      await userEvent.type(
        screen.getByPlaceholderText('Ej: UANL, Tec de Monterrey, UNAM...'),
        'UANL'
      );
      fireEvent.change(screen.getByPlaceholderText('2020'), { target: { value: '20' } });

      fireEvent.click(screen.getByText('Siguiente'));

      await waitFor(() => {
        expect(screen.getByText(/El año de inicio debe estar entre 1950/)).toBeInTheDocument();
      });
    });
  });

  // ============================================================
  // AUTHUI-020: doble alta
  // ============================================================

  describe('AUTHUI-020: doble envío del registro', () => {
    it('tras el 201 el botón NO se reactiva mientras se espera la redirección', async () => {
      render(<RegisterPage />);
      await llenarPaso1();
      await irAlPaso6();
      await crearCuenta();

      await waitFor(() =>
        expect(screen.getByText(/¡Registro exitoso!/)).toBeInTheDocument()
      );
      // Sigue en 'CREANDO...' y deshabilitado: no vuelve a 'CREAR CUENTA'.
      expect(screen.getByRole('button', { name: /CREANDO/i })).toBeDisabled();
      expect(screen.queryByRole('button', { name: /CREAR CUENTA/i })).not.toBeInTheDocument();
      expect(llamadasARegistro()).toHaveLength(1);
    });

    it('dos submits seguidos sólo crean una cuenta', async () => {
      render(<RegisterPage />);
      await llenarPaso1();
      await irAlPaso6();

      await waitFor(() => expect(botonCrearCuenta()).not.toBeDisabled());
      const form = botonCrearCuenta().closest('form')!;
      fireEvent.submit(form);
      fireEvent.submit(form);

      await waitFor(() => expect(llamadasARegistro()).toHaveLength(1));
    });
  });

  // ============================================================
  // AUTHUI-019: errores del servidor visibles
  // ============================================================

  describe('AUTHUI-019: errores del servidor', () => {
    const mockRespuestaRegistro = (status: number, cuerpo: unknown) => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/api/specialties')) return Promise.resolve(respuestaEspecialidades);
        if (url.includes('/api/auth/register')) {
          return Promise.resolve({
            ok: false,
            status,
            headers: { get: () => 'application/json' },
            json: async () => cuerpo,
          });
        }
        return Promise.reject(new Error('URL no mockeada: ' + url));
      });
    };

    it('el 409 de email duplicado se muestra junto al campo email, en el paso 1', async () => {
      mockRespuestaRegistro(409, { success: false, error: 'Este email ya está registrado' });
      render(<RegisterPage />);
      await llenarPaso1();
      await irAlPaso6();
      await crearCuenta();

      await waitFor(() => expect(screen.getByText(/Paso 1 de 6/)).toBeInTheDocument());
      expect(screen.getAllByText('Este email ya está registrado').length).toBeGreaterThan(0);
    });

    it('errores de zod como arrays se normalizan al primer mensaje', async () => {
      mockRespuestaRegistro(400, {
        success: false,
        errors: { nombre: ['Nombre muy corto', 'Otro mensaje'] },
      });
      render(<RegisterPage />);
      await llenarPaso1();
      await irAlPaso6();
      await crearCuenta();

      await waitFor(() => expect(screen.getByText('Nombre muy corto')).toBeInTheDocument());
      expect(screen.queryByText(/Nombre muy cortoOtro mensaje/)).not.toBeInTheDocument();
    });

    it('un error en un campo sin UI en el paso 1 no se pierde', async () => {
      mockRespuestaRegistro(400, {
        success: false,
        errors: { documents: ['Documento inválido'] },
      });
      render(<RegisterPage />);
      await llenarPaso1();
      await irAlPaso6();
      await crearCuenta();

      await waitFor(() => expect(screen.getByText('Documento inválido')).toBeInTheDocument());
    });
  });

  // ============================================================
  // AUTHUI-015 (parcial): el cuerpo enviado se vigila
  // ============================================================

  it('envía el cuerpo completo con los datos capturados', async () => {
    render(<RegisterPage />);
    await llenarPaso1();
    await userEvent.type(screen.getByPlaceholderText('81 1234 5678'), '8112345678');
    await userEvent.type(screen.getByPlaceholderText('Tu ciudad'), 'Monterrey');
    await siguiente(2);
    await siguiente(3);

    await waitFor(() =>
      expect(screen.getByRole('option', { name: 'Tecnología' })).toBeInTheDocument()
    );
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'Tecnología' } });
    await waitFor(() =>
      expect(screen.getByRole('option', { name: 'Desarrollo Web' })).toBeInTheDocument()
    );
    fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: 'Desarrollo Web' } });

    await irAlPaso6();
    await crearCuenta();

    await waitFor(() => expect(llamadasARegistro()).toHaveLength(1));
    const cuerpo = cuerpoDelRegistro();
    expect(cuerpo).toMatchObject({
      email: 'juan@test.com',
      password: 'TestPass123',
      nombre: 'Juan',
      apellidoPaterno: 'Pérez',
      telefono: '8112345678',
      ciudad: 'Monterrey',
      profile: 'Tecnología',
      subcategory: 'Desarrollo Web',
    });
  });
});
