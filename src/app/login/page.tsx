// RUTA: src/app/login/page.tsx

'use client';

import React, { useState, useRef, FormEvent, Suspense } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import ErrorToast from '@/components/shared/ErrorToast';
import loginImage from '@/assets/images/6-login/1.png';
import logoIcon from '@/assets/images/6-login/logo-dark-green.png';

interface LoginFormData {
  email: string;
  password: string;
}

// === INICIO destino-tras-login ===
// AUTHUI-001 / AUTHUI-011: once pantallas y el middleware mandan
// ?redirect=<ruta>, pero el login lo ignoraba y siempre aterrizaba en el
// destino por rol (y 'vendor' caía en el genérico /talents). Aquí se resuelve
// el destino: se respeta el deep-link SÓLO si es una ruta interna y además
// pertenece a un prefijo permitido para el rol; si no, el home del rol.
// El bloque se mantiene sin dependencias para poder probar su lógica aparte.
const HOME_POR_ROL: Record<string, string> = {
  admin: '/admin/requests',
  company: '/company/dashboard',
  recruiter: '/recruiter/dashboard',
  specialist: '/specialist/dashboard',
  vendor: '/vendor/dashboard',
  candidate: '/talents',
  user: '/talents'
};

const PREFIJOS_POR_ROL: Record<string, string[]> = {
  admin: ['/admin', '/applications', '/talents', '/my-applications', '/profile', '/notifications'],
  company: ['/company', '/talents', '/profile', '/notifications'],
  recruiter: ['/recruiter', '/talents', '/profile', '/notifications'],
  specialist: ['/specialist', '/talents', '/profile', '/notifications'],
  vendor: ['/vendor', '/talents', '/profile', '/notifications'],
  candidate: ['/talents', '/my-applications', '/candidate', '/profile', '/notifications'],
  user: ['/talents', '/my-applications', '/profile', '/notifications']
};

// Sólo rutas internas: descarta '//evil.com', '/\evil.com', 'https://…',
// cualquier cosa con '://' o con espacios/saltos de línea (open redirect).
const esRedirectInterno = (valor: string | null) => {
  if (!valor) return false;
  if (valor.charAt(0) !== '/') return false;
  if (valor.charAt(1) === '/' || valor.charAt(1) === '\\') return false;
  if (valor.indexOf('\\') !== -1) return false;
  if (valor.indexOf('://') !== -1) return false;
  if (/[\s\u0000-\u001F\u007F]/.test(valor)) return false;
  return true;
};

const destinoTrasLogin = (rol: string, redirect: string | null) => {
  const home = HOME_POR_ROL[rol] || '/talents';
  if (!esRedirectInterno(redirect)) return home;
  const destino = String(redirect);
  const ruta = destino.split('?')[0].split('#')[0];
  const permitidos = PREFIJOS_POR_ROL[rol] || PREFIJOS_POR_ROL.user;
  const permitido = permitidos.some((prefijo) => ruta === prefijo || ruta.indexOf(prefijo + '/') === 0);
  return permitido ? destino : home;
};
// === FIN destino-tras-login ===

function LoginForm() {
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect');

  const [formData, setFormData] = useState<LoginFormData>({
    email: '',
    password: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // AUTHUI-020: guarda síncrona; isSubmitting sólo se refleja tras el re-render,
  // así que dos Enter seguidos disparaban dos POST.
  const enviandoRef = useRef(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError(null);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (enviandoRef.current) return;
    enviandoRef.current = true;
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (response.ok) {
        const role = typeof data?.user?.role === 'string' ? data.user.role : '';
        // AUTHUI-020: no se reactiva el botón; la navegación ya está en curso.
        window.location.href = destinoTrasLogin(role, redirect);
        return;
      }

      // AUTHUI-002: el 400 de validación llega en `errors` ([{field, message}])
      // y sin clave `error`; antes todo fallo de validación se veía como
      // 'Error al iniciar sesión'.
      const mensaje =
        data?.error ||
        (Array.isArray(data?.errors) && data.errors[0]?.message) ||
        'Error al iniciar sesión';
      setError(mensaje);
    } catch (error) {
      setError('Error al conectar con el servidor');
      console.error('Error logging in:', error);
    }

    enviandoRef.current = false;
    setIsSubmitting(false);
  };

  return (
    <section className="bg-custom-beige min-h-screen flex items-center justify-center px-4">
      <ErrorToast
        message={error}
        onClose={() => setError(null)}
      />
      <div className="w-full max-w-4xl flex bg-white rounded-lg shadow-lg overflow-hidden">
        {/* Columna Izquierda: Imagen y Texto */}
        <div className="relative w-1/2 hidden md:flex flex-col justify-center items-center p-8 bg-cover bg-center">
          <Image
            src={loginImage}
            alt="Login background"
            fill
            className="object-cover"
          />

          {/* Capa de Oscurecimiento */}
          <div className="absolute inset-0 bg-black opacity-60"></div>

          <h2 className="relative text-white text-2xl font-bold text-center z-10">
            CONECTAMOS TALENTOS CON ESPECIALISTAS
          </h2>
        </div>

        {/* Columna Derecha: Formulario */}
        <div className="w-full md:w-1/2 bg-soft-green p-6 md:p-10 flex flex-col justify-center items-center">
          <div className="w-24 h-24 mb-4">
            <Image
              src={logoIcon}
              alt="INAKAT Logo"
              width={96}
              height={96}
              className="object-contain"
            />
          </div>

          <h1 className="text-3xl font-bold text-white mb-2">Inicia sesión</h1>
          <p className="text-white text-sm mb-6">
            Accede a tu cuenta de INAKAT
          </p>

          <form onSubmit={handleSubmit} className="w-full max-w-xs space-y-4">
            {/* Mensaje de error */}
            {error && (
              <div role="alert" className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-white text-sm mb-1">
                Email
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 rounded-full focus:outline-none focus:ring-2 focus:ring-button-green"
                placeholder="tu@email.com"
              />
            </div>

            {/* Contraseña */}
            <div>
              <label
                htmlFor="password"
                className="block text-white text-sm mb-1"
              >
                Contraseña
              </label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 rounded-full focus:outline-none focus:ring-2 focus:ring-button-green"
                placeholder="••••••••"
              />
            </div>

            {/* Olvidaste tu contraseña */}
            <p className="text-right">
              <a
                href="/forgot-password"
                className="text-white text-sm hover:underline"
              >
                ¿Olvidaste tu contraseña?
              </a>
            </p>

            {/* Botón Ingresar */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-button-green text-white font-bold py-3 rounded-full hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'INGRESANDO...' : 'INGRESAR →'}
            </button>
          </form>

          <div className="w-full max-w-xs space-y-4">
            {/* Registrarse */}
            <div className="text-center mt-4 w-full space-y-3">
              <p className="text-white text-sm font-semibold">
                ¿No tienes una cuenta?
              </p>

              {/* Registro Candidato */}
              <Link
                href="/register"
                className="block w-full bg-button-green text-white font-bold py-3 rounded-full hover:bg-green-700 transition text-center"
              >
                REGISTRARSE COMO CANDIDATO →
              </Link>

              {/* Registro Empresa - BUG-012 FIX: Ancla al formulario */}
              <Link
                href="/companies#formulario-registro"
                className="block w-full bg-button-orange text-white font-bold py-3 rounded-full hover:bg-orange-700 transition text-center"
              >
                REGISTRAR EMPRESA →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function LoginPage() {
  // useSearchParams obliga a un límite de Suspense en el App Router.
  return (
    <Suspense
      fallback={
        <section className="bg-custom-beige min-h-screen flex items-center justify-center px-4">
          <p className="text-title-dark">Cargando...</p>
        </section>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
