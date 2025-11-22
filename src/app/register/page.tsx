// RUTA: src/app/register/page.tsx

'use client';

import React, { useState, FormEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Facebook, Linkedin, Eye, EyeOff } from 'lucide-react';
import loginImage from '@/assets/images/6-login/1.png';
import logoIcon from '@/assets/images/6-login/logo-dark-green.png';

interface RegisterFormData {
  email: string;
  password: string;
  confirmPassword: string;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
}

interface FormErrors {
  [key: string]: string;
}

export default function RegisterPage() {
  const [formData, setFormData] = useState<RegisterFormData>({
    email: '',
    password: '',
    confirmPassword: '',
    nombre: '',
    apellidoPaterno: '',
    apellidoMaterno: ''
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Limpiar error del campo
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
    setGeneralError(null);
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Validar nombre
    if (!formData.nombre || formData.nombre.trim().length < 2) {
      newErrors.nombre = 'El nombre es requerido (mínimo 2 caracteres)';
    }

    // Validar apellido paterno
    if (
      !formData.apellidoPaterno ||
      formData.apellidoPaterno.trim().length < 2
    ) {
      newErrors.apellidoPaterno = 'El apellido paterno es requerido';
    }

    // Validar email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email || !emailRegex.test(formData.email)) {
      newErrors.email = 'Email inválido';
    }

    // Validar contraseña
    if (!formData.password || formData.password.length < 8) {
      newErrors.password = 'La contraseña debe tener al menos 8 caracteres';
    } else if (!/[A-Z]/.test(formData.password)) {
      newErrors.password = 'Debe contener al menos una mayúscula';
    } else if (!/[0-9]/.test(formData.password)) {
      newErrors.password = 'Debe contener al menos un número';
    }

    // Validar confirmación de contraseña
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Las contraseñas no coinciden';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setGeneralError(null);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          nombre: formData.nombre,
          apellidoPaterno: formData.apellidoPaterno,
          apellidoMaterno: formData.apellidoMaterno || undefined
        })
      });

      const data = await response.json();

      if (response.ok) {
        // Registro exitoso, redirigir
        alert('¡Registro exitoso! Bienvenido a INAKAT');
        window.location.href = '/talents';
      } else {
        if (data.errors) {
          setErrors(data.errors);
        } else {
          setGeneralError(data.error || 'Error al registrarse');
        }
      }
    } catch (error) {
      setGeneralError('Error al conectar con el servidor');
      console.error('Error registering:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="bg-custom-beige min-h-screen flex items-center justify-center py-8">
      <div className="w-full max-w-5xl flex bg-white rounded-lg shadow-lg overflow-hidden">
        {/* Columna Izquierda: Imagen y Texto */}
        <div className="relative w-1/2 hidden md:flex flex-col justify-center items-center p-8 bg-cover bg-center">
          <Image
            src={loginImage}
            alt="Register background"
            fill
            className="object-cover"
          />

          {/* Capa de Oscurecimiento */}
          <div className="absolute inset-0 bg-black opacity-60"></div>

          <h2 className="relative text-white text-2xl font-bold text-center z-10">
            ÚNETE A INAKAT
            <br />
            <span className="text-lg font-normal mt-2 block">
              Encuentra tu próxima oportunidad laboral
            </span>
          </h2>
        </div>

        {/* Columna Derecha: Formulario */}
        <div className="w-full md:w-1/2 bg-soft-green p-8 flex flex-col justify-center items-center overflow-y-auto max-h-screen">
          <div className="w-24 h-24 mb-4">
            <Image
              src={logoIcon}
              alt="INAKAT Logo"
              width={96}
              height={96}
              className="object-contain"
            />
          </div>

          <h1 className="text-2xl font-bold text-white mb-2">Crear Cuenta</h1>
          <p className="text-white text-sm mb-6 text-center">
            Completa el formulario para registrarte
          </p>

          <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
            {/* Mensaje de error general */}
            {generalError && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                {generalError}
              </div>
            )}

            {/* Nombre */}
            <div>
              <label htmlFor="nombre" className="block text-white text-sm mb-1">
                Nombre *
              </label>
              <input
                type="text"
                id="nombre"
                name="nombre"
                value={formData.nombre}
                onChange={handleChange}
                className={`w-full px-4 py-2 rounded-full focus:outline-none focus:ring-2 ${
                  errors.nombre
                    ? 'border-2 border-red-500 focus:ring-red-500'
                    : 'focus:ring-button-green'
                }`}
                placeholder="Tu nombre"
              />
              {errors.nombre && (
                <p className="text-red-300 text-xs mt-1">{errors.nombre}</p>
              )}
            </div>

            {/* Apellido Paterno */}
            <div>
              <label
                htmlFor="apellidoPaterno"
                className="block text-white text-sm mb-1"
              >
                Apellido Paterno *
              </label>
              <input
                type="text"
                id="apellidoPaterno"
                name="apellidoPaterno"
                value={formData.apellidoPaterno}
                onChange={handleChange}
                className={`w-full px-4 py-2 rounded-full focus:outline-none focus:ring-2 ${
                  errors.apellidoPaterno
                    ? 'border-2 border-red-500 focus:ring-red-500'
                    : 'focus:ring-button-green'
                }`}
                placeholder="Tu apellido paterno"
              />
              {errors.apellidoPaterno && (
                <p className="text-red-300 text-xs mt-1">
                  {errors.apellidoPaterno}
                </p>
              )}
            </div>

            {/* Apellido Materno */}
            <div>
              <label
                htmlFor="apellidoMaterno"
                className="block text-white text-sm mb-1"
              >
                Apellido Materno (opcional)
              </label>
              <input
                type="text"
                id="apellidoMaterno"
                name="apellidoMaterno"
                value={formData.apellidoMaterno}
                onChange={handleChange}
                className="w-full px-4 py-2 rounded-full focus:outline-none focus:ring-2 focus:ring-button-green"
                placeholder="Tu apellido materno"
              />
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-white text-sm mb-1">
                Email *
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className={`w-full px-4 py-2 rounded-full focus:outline-none focus:ring-2 ${
                  errors.email
                    ? 'border-2 border-red-500 focus:ring-red-500'
                    : 'focus:ring-button-green'
                }`}
                placeholder="tu@email.com"
              />
              {errors.email && (
                <p className="text-red-300 text-xs mt-1">{errors.email}</p>
              )}
            </div>

            {/* Contraseña */}
            <div>
              <label
                htmlFor="password"
                className="block text-white text-sm mb-1"
              >
                Contraseña *
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className={`w-full px-4 py-2 rounded-full focus:outline-none focus:ring-2 pr-10 ${
                    errors.password
                      ? 'border-2 border-red-500 focus:ring-red-500'
                      : 'focus:ring-button-green'
                  }`}
                  placeholder="Mínimo 8 caracteres"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              {errors.password && (
                <p className="text-red-300 text-xs mt-1">{errors.password}</p>
              )}
              <p className="text-white text-xs mt-1">
                Debe contener: 8+ caracteres, 1 mayúscula, 1 número
              </p>
            </div>

            {/* Confirmar Contraseña */}
            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-white text-sm mb-1"
              >
                Confirmar Contraseña *
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className={`w-full px-4 py-2 rounded-full focus:outline-none focus:ring-2 pr-10 ${
                    errors.confirmPassword
                      ? 'border-2 border-red-500 focus:ring-red-500'
                      : 'focus:ring-button-green'
                  }`}
                  placeholder="Repite tu contraseña"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showConfirmPassword ? (
                    <EyeOff size={20} />
                  ) : (
                    <Eye size={20} />
                  )}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-red-300 text-xs mt-1">
                  {errors.confirmPassword}
                </p>
              )}
            </div>

            {/* Botón Registrarse */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-button-green text-white font-bold py-3 rounded-full hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {isSubmitting ? 'REGISTRANDO...' : 'CREAR CUENTA →'}
            </button>
          </form>

          <div className="w-full max-w-sm space-y-4 mt-6">
            {/* Divider */}
            <div className="flex items-center justify-center">
              <hr className="w-1/4 border-white" />
              <span className="text-white px-2 text-sm">O regístrate con</span>
              <hr className="w-1/4 border-white" />
            </div>

            {/* Redes Sociales */}
            <div className="flex justify-center gap-4">
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

            {/* Ya tienes cuenta */}
            <div className="text-center w-full">
              <p className="text-white text-sm">¿Ya tienes una cuenta?</p>
              <Link href="/login" className="w-full flex justify-center">
                <button
                  type="button"
                  className="w-full bg-button-orange text-white font-bold py-3 rounded-full mt-2 hover:bg-orange-700 transition"
                >
                  INICIAR SESIÓN →
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
