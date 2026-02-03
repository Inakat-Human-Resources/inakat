// Tests para: src/app/register/page.tsx

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RegisterPage from './page';

// Mock de next/image
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => {
    // eslint-disable-next-line @next/next/no-img-element
    return <img {...props} alt={props.alt} />;
  },
}));

// Mock de next/link
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// Mock de fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock de alert
global.alert = jest.fn();

describe('RegisterPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock default responses
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/specialties')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: [
                { id: 1, name: 'Tecnología', subcategories: ['Desarrollo Web', 'Mobile', 'DevOps'] },
                { id: 2, name: 'Diseño', subcategories: ['UX/UI', 'Gráfico', 'Industrial'] },
              ],
            }),
        });
      }
      if (url.includes('/api/auth/register')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              message: 'Registro exitoso',
              user: { id: 1, role: 'candidate' },
              candidate: { id: 1, experiencesCount: 0, documentsCount: 0 },
            }),
        });
      }
      return Promise.reject(new Error('Not found'));
    });
  });

  describe('Renderizado inicial', () => {
    it('debería renderizar el formulario de registro', async () => {
      render(<RegisterPage />);

      expect(screen.getByText('Crear Cuenta')).toBeInTheDocument();
      expect(screen.getByText(/Paso 1 de 6/)).toBeInTheDocument();
    });

    it('debería mostrar el paso 1 (Personal) por defecto', () => {
      render(<RegisterPage />);

      expect(screen.getByPlaceholderText('Tu nombre')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('tu@email.com')).toBeInTheDocument();
    });

    it('debería cargar las especialidades del API', async () => {
      render(<RegisterPage />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/specialties?subcategories=true');
      });
    });
  });

  describe('Navegación entre pasos', () => {
    it('debería navegar al paso 2 con el botón Siguiente', async () => {
      render(<RegisterPage />);

      // Llenar campos requeridos del paso 1
      await userEvent.type(screen.getByPlaceholderText('Tu nombre'), 'Juan');
      await userEvent.type(screen.getByPlaceholderText('Tu apellido paterno'), 'Pérez');
      await userEvent.type(screen.getByPlaceholderText('tu@email.com'), 'juan@test.com');
      await userEvent.type(screen.getByPlaceholderText('Mínimo 8 caracteres'), 'TestPass123');
      await userEvent.type(screen.getByPlaceholderText('Repite tu contraseña'), 'TestPass123');

      // Click en Siguiente
      fireEvent.click(screen.getByText('Siguiente'));

      await waitFor(() => {
        expect(screen.getByText(/Paso 2 de 6/)).toBeInTheDocument();
      });
    });

    it('debería mostrar errores si faltan campos requeridos', async () => {
      render(<RegisterPage />);

      // Intentar avanzar sin llenar campos
      fireEvent.click(screen.getByText('Siguiente'));

      await waitFor(() => {
        expect(screen.getByText(/El nombre es requerido/)).toBeInTheDocument();
      });
    });

    it('debería validar formato de email', async () => {
      render(<RegisterPage />);

      await userEvent.type(screen.getByPlaceholderText('Tu nombre'), 'Juan');
      await userEvent.type(screen.getByPlaceholderText('Tu apellido paterno'), 'Pérez');
      await userEvent.type(screen.getByPlaceholderText('tu@email.com'), 'invalid-email');
      await userEvent.type(screen.getByPlaceholderText('Mínimo 8 caracteres'), 'TestPass123');
      await userEvent.type(screen.getByPlaceholderText('Repite tu contraseña'), 'TestPass123');

      fireEvent.click(screen.getByText('Siguiente'));

      await waitFor(() => {
        expect(screen.getByText(/Email inválido/)).toBeInTheDocument();
      });
    });

    it('debería validar que las contraseñas coincidan', async () => {
      render(<RegisterPage />);

      await userEvent.type(screen.getByPlaceholderText('Tu nombre'), 'Juan');
      await userEvent.type(screen.getByPlaceholderText('Tu apellido paterno'), 'Pérez');
      await userEvent.type(screen.getByPlaceholderText('tu@email.com'), 'juan@test.com');
      await userEvent.type(screen.getByPlaceholderText('Mínimo 8 caracteres'), 'TestPass123');
      await userEvent.type(screen.getByPlaceholderText('Repite tu contraseña'), 'DifferentPass123');

      fireEvent.click(screen.getByText('Siguiente'));

      await waitFor(() => {
        expect(screen.getByText(/Las contraseñas no coinciden/)).toBeInTheDocument();
      });
    });

    it('debería permitir volver al paso anterior', async () => {
      render(<RegisterPage />);

      // Llenar y avanzar al paso 2
      await userEvent.type(screen.getByPlaceholderText('Tu nombre'), 'Juan');
      await userEvent.type(screen.getByPlaceholderText('Tu apellido paterno'), 'Pérez');
      await userEvent.type(screen.getByPlaceholderText('tu@email.com'), 'juan@test.com');
      await userEvent.type(screen.getByPlaceholderText('Mínimo 8 caracteres'), 'TestPass123');
      await userEvent.type(screen.getByPlaceholderText('Repite tu contraseña'), 'TestPass123');

      fireEvent.click(screen.getByText('Siguiente'));

      await waitFor(() => {
        expect(screen.getByText(/Paso 2 de 6/)).toBeInTheDocument();
      });

      // Volver al paso 1
      fireEvent.click(screen.getByText('Anterior'));

      await waitFor(() => {
        expect(screen.getByText(/Paso 1 de 6/)).toBeInTheDocument();
      });
    });
  });

  describe('Opción de omitir', () => {
    it('debería mostrar la opción de omitir y crear cuenta básica', () => {
      render(<RegisterPage />);

      expect(screen.getByText(/Omitir y crear cuenta con datos básicos/)).toBeInTheDocument();
    });

    it('debería saltar al paso 6 al hacer click en omitir', async () => {
      render(<RegisterPage />);

      fireEvent.click(screen.getByText(/Omitir y crear cuenta con datos básicos/));

      await waitFor(() => {
        expect(screen.getByText(/Paso 6 de 6/)).toBeInTheDocument();
      });
    });
  });

  describe('Paso 4: Experiencias', () => {
    it('debería mostrar opciones de experiencia en el paso 4', async () => {
      render(<RegisterPage />);

      // Llenar paso 1
      await userEvent.type(screen.getByPlaceholderText('Tu nombre'), 'Juan');
      await userEvent.type(screen.getByPlaceholderText('Tu apellido paterno'), 'Pérez');
      await userEvent.type(screen.getByPlaceholderText('tu@email.com'), 'juan@test.com');
      await userEvent.type(screen.getByPlaceholderText('Mínimo 8 caracteres'), 'TestPass123');
      await userEvent.type(screen.getByPlaceholderText('Repite tu contraseña'), 'TestPass123');

      // Navegar al paso 4
      fireEvent.click(screen.getByText('Siguiente')); // Paso 2
      await waitFor(() => expect(screen.getByText(/Paso 2 de 6/)).toBeInTheDocument());

      fireEvent.click(screen.getByText('Siguiente')); // Paso 3
      await waitFor(() => expect(screen.getByText(/Paso 3 de 6/)).toBeInTheDocument());

      fireEvent.click(screen.getByText('Siguiente')); // Paso 4
      await waitFor(() => expect(screen.getByText(/Paso 4 de 6/)).toBeInTheDocument());

      // Verificar que se muestra la opción de agregar experiencia
      expect(screen.getByText(/No hay experiencias agregadas/)).toBeInTheDocument();
      expect(screen.getByText('Agregar Experiencia')).toBeInTheDocument();
    });

    it('debería permitir agregar experiencias', async () => {
      render(<RegisterPage />);

      await userEvent.type(screen.getByPlaceholderText('Tu nombre'), 'Juan');
      await userEvent.type(screen.getByPlaceholderText('Tu apellido paterno'), 'Pérez');
      await userEvent.type(screen.getByPlaceholderText('tu@email.com'), 'juan@test.com');
      await userEvent.type(screen.getByPlaceholderText('Mínimo 8 caracteres'), 'TestPass123');
      await userEvent.type(screen.getByPlaceholderText('Repite tu contraseña'), 'TestPass123');

      fireEvent.click(screen.getByText('Siguiente'));
      await waitFor(() => expect(screen.getByText(/Paso 2 de 6/)).toBeInTheDocument());

      fireEvent.click(screen.getByText('Siguiente'));
      await waitFor(() => expect(screen.getByText(/Paso 3 de 6/)).toBeInTheDocument());

      fireEvent.click(screen.getByText('Siguiente'));
      await waitFor(() => expect(screen.getByText(/Paso 4 de 6/)).toBeInTheDocument());

      // Agregar experiencia
      fireEvent.click(screen.getByText('Agregar Experiencia'));

      await waitFor(() => {
        expect(screen.getByText('Experiencia 1')).toBeInTheDocument();
      });
    });
  });

  describe('Paso 6: Documentos', () => {
    it('debería mostrar opciones de documentos en el paso 6', async () => {
      render(<RegisterPage />);

      fireEvent.click(screen.getByText(/Omitir y crear cuenta con datos básicos/));

      await waitFor(() => {
        expect(screen.getByText(/Paso 6 de 6/)).toBeInTheDocument();
        expect(screen.getByText(/No hay documentos agregados/)).toBeInTheDocument();
        expect(screen.getByText('Agregar Documento')).toBeInTheDocument();
      });
    });

    it('debería permitir agregar documentos', async () => {
      render(<RegisterPage />);

      fireEvent.click(screen.getByText(/Omitir y crear cuenta con datos básicos/));

      await waitFor(() => {
        expect(screen.getByText(/Paso 6 de 6/)).toBeInTheDocument();
      });

      // Agregar documento
      fireEvent.click(screen.getByText('Agregar Documento'));

      await waitFor(() => {
        expect(screen.getByText('Documento 1')).toBeInTheDocument();
      });
    });
  });

  describe('Envío del formulario', () => {
    it('debería enviar el formulario correctamente', async () => {
      render(<RegisterPage />);

      // Llenar datos mínimos y saltar al final
      await userEvent.type(screen.getByPlaceholderText('Tu nombre'), 'Juan');
      await userEvent.type(screen.getByPlaceholderText('Tu apellido paterno'), 'Pérez');
      await userEvent.type(screen.getByPlaceholderText('tu@email.com'), 'juan@test.com');
      await userEvent.type(screen.getByPlaceholderText('Mínimo 8 caracteres'), 'TestPass123');
      await userEvent.type(screen.getByPlaceholderText('Repite tu contraseña'), 'TestPass123');

      // Saltar al paso 6
      fireEvent.click(screen.getByText(/Omitir y crear cuenta con datos básicos/));

      await waitFor(() => {
        expect(screen.getByText(/Paso 6 de 6/)).toBeInTheDocument();
      });

      // Esperar a que el botón esté habilitado (protección anti double-click)
      await waitFor(() => {
        const button = screen.getByRole('button', { name: /CREAR CUENTA/i });
        expect(button).not.toBeDisabled();
      });

      // Enviar formulario
      fireEvent.click(screen.getByRole('button', { name: /CREAR CUENTA/i }));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/auth/register',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          })
        );
      });
    });

    it('debería mostrar mensaje de éxito', async () => {
      render(<RegisterPage />);

      await userEvent.type(screen.getByPlaceholderText('Tu nombre'), 'Juan');
      await userEvent.type(screen.getByPlaceholderText('Tu apellido paterno'), 'Pérez');
      await userEvent.type(screen.getByPlaceholderText('tu@email.com'), 'juan@test.com');
      await userEvent.type(screen.getByPlaceholderText('Mínimo 8 caracteres'), 'TestPass123');
      await userEvent.type(screen.getByPlaceholderText('Repite tu contraseña'), 'TestPass123');

      fireEvent.click(screen.getByText(/Omitir y crear cuenta con datos básicos/));

      await waitFor(() => {
        expect(screen.getByText(/Paso 6 de 6/)).toBeInTheDocument();
      });

      // Esperar a que el botón esté habilitado (protección anti double-click)
      await waitFor(() => {
        const button = screen.getByRole('button', { name: /CREAR CUENTA/i });
        expect(button).not.toBeDisabled();
      });

      fireEvent.click(screen.getByRole('button', { name: /CREAR CUENTA/i }));

      await waitFor(() => {
        expect(screen.getByText(/¡Registro exitoso! Bienvenido a INAKAT/)).toBeInTheDocument();
      });
    });

    it('debería mostrar error si el registro falla', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/api/specialties')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true, data: [] }),
          });
        }
        if (url.includes('/api/auth/register')) {
          return Promise.resolve({
            ok: false,
            json: () =>
              Promise.resolve({
                success: false,
                error: 'Este email ya está registrado',
              }),
          });
        }
        return Promise.reject(new Error('Not found'));
      });

      render(<RegisterPage />);

      await userEvent.type(screen.getByPlaceholderText('Tu nombre'), 'Juan');
      await userEvent.type(screen.getByPlaceholderText('Tu apellido paterno'), 'Pérez');
      await userEvent.type(screen.getByPlaceholderText('tu@email.com'), 'existing@test.com');
      await userEvent.type(screen.getByPlaceholderText('Mínimo 8 caracteres'), 'TestPass123');
      await userEvent.type(screen.getByPlaceholderText('Repite tu contraseña'), 'TestPass123');

      fireEvent.click(screen.getByText(/Omitir y crear cuenta con datos básicos/));

      await waitFor(() => {
        expect(screen.getByText(/Paso 6 de 6/)).toBeInTheDocument();
      });

      // Esperar a que el botón esté habilitado (protección anti double-click)
      await waitFor(() => {
        const button = screen.getByRole('button', { name: /CREAR CUENTA/i });
        expect(button).not.toBeDisabled();
      });

      fireEvent.click(screen.getByRole('button', { name: /CREAR CUENTA/i }));

      await waitFor(() => {
        expect(screen.getByText('Este email ya está registrado')).toBeInTheDocument();
      });
    });
  });

  describe('Link a login', () => {
    it('debería tener link a la página de login', () => {
      render(<RegisterPage />);

      expect(screen.getByText('¿Ya tienes una cuenta?')).toBeInTheDocument();
      expect(screen.getByText('INICIAR SESIÓN')).toBeInTheDocument();

      const loginLink = screen.getByRole('link', { name: /INICIAR SESIÓN/i });
      expect(loginLink).toHaveAttribute('href', '/login');
    });
  });

  describe('Validación de contraseña', () => {
    it('debería validar contraseña sin mayúscula', async () => {
      render(<RegisterPage />);

      await userEvent.type(screen.getByPlaceholderText('Tu nombre'), 'Juan');
      await userEvent.type(screen.getByPlaceholderText('Tu apellido paterno'), 'Pérez');
      await userEvent.type(screen.getByPlaceholderText('tu@email.com'), 'juan@test.com');
      await userEvent.type(screen.getByPlaceholderText('Mínimo 8 caracteres'), 'testpass123');
      await userEvent.type(screen.getByPlaceholderText('Repite tu contraseña'), 'testpass123');

      fireEvent.click(screen.getByText('Siguiente'));

      await waitFor(() => {
        expect(screen.getByText(/Debe contener al menos una mayúscula/)).toBeInTheDocument();
      });
    });

    it('debería validar contraseña sin número', async () => {
      render(<RegisterPage />);

      await userEvent.type(screen.getByPlaceholderText('Tu nombre'), 'Juan');
      await userEvent.type(screen.getByPlaceholderText('Tu apellido paterno'), 'Pérez');
      await userEvent.type(screen.getByPlaceholderText('tu@email.com'), 'juan@test.com');
      await userEvent.type(screen.getByPlaceholderText('Mínimo 8 caracteres'), 'TestPassword');
      await userEvent.type(screen.getByPlaceholderText('Repite tu contraseña'), 'TestPassword');

      fireEvent.click(screen.getByText('Siguiente'));

      await waitFor(() => {
        expect(screen.getByText(/Debe contener al menos un número/)).toBeInTheDocument();
      });
    });

    it('debería validar contraseña corta', async () => {
      render(<RegisterPage />);

      await userEvent.type(screen.getByPlaceholderText('Tu nombre'), 'Juan');
      await userEvent.type(screen.getByPlaceholderText('Tu apellido paterno'), 'Pérez');
      await userEvent.type(screen.getByPlaceholderText('tu@email.com'), 'juan@test.com');
      await userEvent.type(screen.getByPlaceholderText('Mínimo 8 caracteres'), 'Test1');
      await userEvent.type(screen.getByPlaceholderText('Repite tu contraseña'), 'Test1');

      fireEvent.click(screen.getByText('Siguiente'));

      await waitFor(() => {
        expect(screen.getByText(/La contraseña debe tener al menos 8 caracteres/)).toBeInTheDocument();
      });
    });
  });
});
