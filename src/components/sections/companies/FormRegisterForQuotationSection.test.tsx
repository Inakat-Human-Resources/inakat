// Tests para: src/components/sections/companies/FormRegisterForQuotationSection.tsx
//
// El rediseño por pasos es PRESENTACIÓN: estos tests fijan que el formulario
// sigue haciendo exactamente las mismas llamadas, con los mismos cuerpos y en
// el mismo orden (pre-validación dryRun → subidas → alta → auto-login), y que
// los pasos no dejan avanzar con lo que antes bloqueaba el navegador.

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import FormRegisterForQuotationSection from './FormRegisterForQuotationSection';

const push = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

// Sin Google Maps en jsdom: el mapa se queda «cargando» (es opcional).
jest.mock('@react-google-maps/api', () => ({
  useLoadScript: () => ({ isLoaded: false, loadError: undefined }),
  GoogleMap: () => null,
  Marker: () => null,
  Autocomplete: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

beforeAll(() => {
  Element.prototype.scrollIntoView = jest.fn();
  if (!window.matchMedia) {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  }
});

const respuesta = (cuerpo: unknown, ok = true) =>
  Promise.resolve({ ok, json: () => Promise.resolve(cuerpo) } as Response);

beforeEach(() => {
  jest.clearAllMocks();
  mockFetch.mockImplementation((url: string, init?: RequestInit) => {
    if (url === '/api/company-requests') {
      const cuerpo = JSON.parse(String(init?.body));
      return cuerpo.dryRun
        ? respuesta({ success: true, dryRun: true, message: 'Datos válidos' })
        : respuesta({ success: true, message: 'Solicitud enviada', data: { id: 7 } });
    }
    if (url === '/api/upload') {
      const n = mockFetch.mock.calls.filter(([u]) => u === '/api/upload').length;
      return respuesta({ url: `https://blob.example/doc-${n}.pdf` });
    }
    if (url === '/api/auth/login') return respuesta({ success: true });
    return respuesta({}, false);
  });
});

const campo = (container: HTMLElement, name: string) =>
  container.querySelector(`input[name="${name}"]:not([tabindex="-1"])`) as HTMLInputElement;

const escribir = (container: HTMLElement, valores: Record<string, string>) => {
  Object.entries(valores).forEach(([name, value]) => {
    fireEvent.change(campo(container, name), { target: { name, value } });
  });
};

const continuar = () => fireEvent.click(screen.getByRole('button', { name: /continuar/i }));

const pasoVisible = (nombre: RegExp) => screen.findByRole('heading', { level: 3, name: nombre });

const CUENTA = {
  nombre: 'Ana',
  apellidoPaterno: 'Ruiz',
  correoEmpresa: 'ana@industriasarco.mx',
  password: 'Segura123',
  confirmPassword: 'Segura123',
};
const EMPRESA = {
  nombreEmpresa: 'Industrias Arco',
  razonSocial: 'Industrias Arco SA de CV',
  rfc: 'iar010101ab1',
};
const UBICACION = {
  calle: 'Av. Constitución 742',
  colonia: 'Centro',
  ciudad: 'Monterrey',
  codigoPostal: '64000',
};

async function llegarARevision(container: HTMLElement) {
  escribir(container, CUENTA);
  continuar();
  await pasoVisible(/tu empresa/i);
  escribir(container, EMPRESA);
  continuar();
  await pasoVisible(/ubicación/i);
  escribir(container, UBICACION);
  continuar();
  await pasoVisible(/documentos/i);
  const [, identificacion, constancia] = Array.from(
    container.querySelectorAll('input[type="file"]')
  ) as HTMLInputElement[];
  fireEvent.change(identificacion, {
    target: { files: [new File(['ine'], 'ine.pdf', { type: 'application/pdf' })] },
  });
  fireEvent.change(constancia, {
    target: { files: [new File(['csf'], 'constancia.pdf', { type: 'application/pdf' })] },
  });
  continuar();
  await pasoVisible(/revisa tu solicitud/i);
}

describe('Registro de empresa por pasos', () => {
  it('conserva el ancla #register, el id #formulario-registro y un solo botón submit', () => {
    const { container } = render(<FormRegisterForQuotationSection />);
    expect(container.querySelector('#register')).not.toBeNull();
    expect(container.querySelector('#formulario-registro')).not.toBeNull();
    expect(container.querySelectorAll('button[type="submit"]')).toHaveLength(1);
    // Los campos del primer paso están a la vista (los usa el e2e).
    expect(campo(container, 'nombre')).toBeVisible();
    expect(campo(container, 'apellidoPaterno')).toBeVisible();
    expect(campo(container, 'correoEmpresa')).toBeVisible();
    expect(campo(container, 'departamento')).toBeVisible();
  });

  it('cada campo tiene una etiqueta visible asociada (no sólo placeholder)', () => {
    render(<FormRegisterForQuotationSection />);
    expect(screen.getByLabelText(/apellido paterno/i)).toHaveAttribute('name', 'apellidoPaterno');
    expect(screen.getByLabelText(/correo electrónico/i)).toHaveAttribute('name', 'correoEmpresa');
    expect(screen.getByLabelText(/departamento/i)).toHaveAttribute('name', 'departamento');
  });

  it('no avanza con obligatorios vacíos: marca los campos, avisa y no llama a la API', async () => {
    const { container } = render(<FormRegisterForQuotationSection />);
    continuar();

    const aviso = await screen.findByRole('alert');
    expect(aviso).toHaveTextContent(/revisa los 5 campos/i);
    expect(campo(container, 'nombre')).toHaveAttribute('aria-invalid', 'true');
    expect(campo(container, 'correoEmpresa')).toHaveAttribute('aria-invalid', 'true');
    expect(campo(container, 'apellidoMaterno')).not.toHaveAttribute('aria-invalid');
    expect(screen.getByRole('heading', { level: 3, name: /tu cuenta/i })).toBeVisible();
    expect(mockFetch).not.toHaveBeenCalled();

    // Al escribir, el aviso de «obligatorio» del campo desaparece.
    escribir(container, { nombre: 'Ana' });
    expect(campo(container, 'nombre')).not.toHaveAttribute('aria-invalid');
  });

  it('el título del paso se lee entero, con espacio antes del remate serif', () => {
    render(<FormRegisterForQuotationSection />);
    // Chrome leía «Tu cuentacon ella entrarás a INAKAT»: el espacio iba en un
    // nodo de texto aparte que su árbol de accesibilidad descarta.
    expect(screen.getByRole('heading', { level: 3, name: /tu cuenta/i })).toHaveAccessibleName(
      'Tu cuenta con ella entrarás a INAKAT'
    );
  });

  it('los errores en línea de siempre también bloquean el paso (RFC inválido)', async () => {
    const { container } = render(<FormRegisterForQuotationSection />);
    escribir(container, CUENTA);
    continuar();
    await pasoVisible(/tu empresa/i);
    escribir(container, { ...EMPRESA, rfc: 'XYZ' });
    expect(screen.getByText('RFC inválido')).toBeInTheDocument();
    continuar();
    expect(await screen.findByRole('alert')).toHaveTextContent(/revisa el campo marcado/i);
    expect(screen.getByRole('heading', { level: 3, name: /tu empresa/i })).toBeVisible();
  });

  it('no deja pasar de Documentos sin los dos archivos (mismos mensajes que antes)', async () => {
    const { container } = render(<FormRegisterForQuotationSection />);
    escribir(container, CUENTA);
    continuar();
    await pasoVisible(/tu empresa/i);
    escribir(container, EMPRESA);
    continuar();
    await pasoVisible(/ubicación/i);
    escribir(container, UBICACION);
    continuar();
    await pasoVisible(/documentos/i);
    continuar();
    expect(await screen.findByText('La identificación es requerida')).toBeInTheDocument();
    expect(screen.getByText('Los documentos son requeridos')).toBeInTheDocument();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('envía exactamente las mismas llamadas y cuerpos: dryRun → 2 subidas → alta → auto-login', async () => {
    const { container } = render(<FormRegisterForQuotationSection />);
    await llegarARevision(container);

    // El resumen repite lo capturado.
    expect(screen.getByText('Industrias Arco')).toBeInTheDocument();
    expect(screen.getByText('Av. Constitución 742, Centro, Monterrey, CP 64000')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /enviar solicitud/i }));
    const dialogo = await screen.findByRole('dialog', { name: /solicitud enviada exitosamente/i });

    const urls = mockFetch.mock.calls.map(([u]) => u);
    expect(urls).toEqual(['/api/company-requests', '/api/upload', '/api/upload', '/api/company-requests']);

    const base = {
      nombre: 'Ana',
      apellidoPaterno: 'Ruiz',
      apellidoMaterno: null,
      departamento: null,
      nombreEmpresa: 'Industrias Arco',
      correoEmpresa: 'ana@industriasarco.mx',
      sitioWeb: null,
      razonSocial: 'Industrias Arco SA de CV',
      rfc: 'IAR010101AB1',
      direccionEmpresa: 'Av. Constitución 742, Centro, Monterrey, CP 64000',
      latitud: null,
      longitud: null,
      password: 'Segura123',
    };
    const [, preInit] = mockFetch.mock.calls[0];
    expect(preInit.method).toBe('POST');
    expect(JSON.parse(preInit.body)).toEqual({
      ...base,
      identificacionUrl: null,
      documentosConstitucionUrl: null,
      dryRun: true,
    });
    expect(mockFetch.mock.calls[1][1].body).toBeInstanceOf(FormData);
    expect(mockFetch.mock.calls[2][1].body).toBeInstanceOf(FormData);
    expect(JSON.parse(mockFetch.mock.calls[3][1].body)).toEqual({
      ...base,
      identificacionUrl: 'https://blob.example/doc-1.pdf',
      documentosConstitucionUrl: 'https://blob.example/doc-2.pdf',
      logoUrl: null,
    });

    // «Ir a plataforma»: el mismo auto-login de siempre.
    fireEvent.click(within(dialogo.parentElement as HTMLElement).getByRole('button', { name: /ir a plataforma/i }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/company/dashboard'));
    const login = mockFetch.mock.calls.find(([u]) => u === '/api/auth/login');
    expect(JSON.parse(login![1].body)).toEqual({ email: 'ana@industriasarco.mx', password: 'Segura123' });
  });

  it('un error de la API se muestra (aviso flotante con role="alert") y no abre el modal', async () => {
    mockFetch.mockImplementation((url: string) =>
      url === '/api/company-requests'
        ? respuesta({ error: 'Ya existe una cuenta con este correo electrónico.' }, false)
        : respuesta({}, false)
    );
    const { container } = render(<FormRegisterForQuotationSection />);
    await llegarARevision(container);
    fireEvent.click(screen.getByRole('button', { name: /enviar solicitud/i }));

    const alertas = await screen.findAllByRole('alert');
    expect(alertas.some((a) => /ya existe una cuenta/i.test(a.textContent ?? ''))).toBe(true);
    expect(screen.queryByRole('dialog')).toBeNull();
    // Sólo la pre-validación: no se subió ningún documento.
    expect(mockFetch.mock.calls.map(([u]) => u)).toEqual(['/api/company-requests']);
  });
});
