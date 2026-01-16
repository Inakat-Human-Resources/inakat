// RUTA: src/app/login/page.tsx

'use client';

import React, { useState, FormEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Facebook, Linkedin } from 'lucide-react';
import loginImage from '@/assets/images/6-login/1.png';
import logoIcon from '@/assets/images/6-login/logo-dark-green.png';

interface LoginFormData {
  email: string;
  password: string;
}

export default function LoginPage() {
  const [formData, setFormData] = useState<LoginFormData>({
    email: '',
    password: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError(null);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
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
        const role = data.user.role;

        if (role === 'admin') {
          window.location.href = '/admin/requests';
        } else if (role === 'company') {
          window.location.href = '/company/dashboard';
        } else if (role === 'recruiter') {
          window.location.href = '/recruiter/dashboard';
        } else if (role === 'specialist') {
          window.location.href = '/specialist/dashboard';
        } else {
          window.location.href = '/talents';
        }
      } else {
        setError(data.error || 'Error al iniciar sesión');
        // Scroll hacia arriba para mostrar el mensaje de error
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (error) {
      setError('Error al conectar con el servidor');
      // Scroll hacia arriba para mostrar el mensaje de error
      window.scrollTo({ top: 0, behavior: 'smooth' });
      console.error('Error logging in:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="bg-custom-beige min-h-screen flex items-center justify-center">
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
        <div className="w-full md:w-1/2 bg-soft-green p-10 flex flex-col justify-center items-center">
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
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
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
              <Link
                href="/forgot-password"
                className="text-white text-sm hover:underline"
              >
                ¿Olvidaste tu contraseña?
              </Link>
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
            {/* Divider */}
            <div className="flex items-center justify-center mt-4">
              <hr className="w-1/4 border-white" />
              <span className="text-white px-2 text-sm">Inicia sesión con</span>
              <hr className="w-1/4 border-white" />
            </div>

            {/* Redes Sociales */}
            <div className="flex justify-center gap-4 mt-4">
              <button
                type="button"
                className="w-12 h-12 bg-custom-beige rounded-full flex items-center justify-center hover:bg-gray-200 transition"
              >
                <Facebook className="text-button-green text-2xl" />
              </button>
              <button
                type="button"
                className="w-12 h-12 bg-custom-beige rounded-full flex items-center justify-center hover:bg-gray-200 transition"
              >
                <Linkedin className="text-button-green text-2xl" />
              </button>
            </div>

            {/* Registrarse - ACTUALIZADO con dos opciones */}
            <div className="text-center mt-4 w-full space-y-3">
              <p className="text-white text-sm font-semibold">
                ¿No tienes una cuenta?
              </p>

              {/* Registro Candidato */}
              <Link href="/register" className="w-full flex justify-center">
                <button
                  type="button"
                  className="w-full bg-button-green text-white font-bold py-3 rounded-full hover:bg-green-700 transition"
                >
                  REGISTRARSE COMO CANDIDATO →
                </button>
              </Link>

              {/* Registro Empresa */}
              <Link href="/companies" className="w-full flex justify-center">
                <button
                  type="button"
                  className="w-full bg-button-orange text-white font-bold py-3 rounded-full hover:bg-orange-700 transition"
                >
                  REGISTRAR EMPRESA →
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
