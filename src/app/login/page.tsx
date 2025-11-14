"use client";

import React, { useState, FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { Facebook, Linkedin } from "lucide-react";
import loginImage from "@/assets/images/6-login/1.png";
import logoIcon from "@/assets/images/6-login/logo-dark-green.png";

interface LoginFormData {
  email: string;
  password: string;
}

export default function LoginPage() {
  const [formData, setFormData] = useState<LoginFormData>({
    email: "",
    password: "",
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
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        // Redirect to dashboard or home
        window.location.href = "/admin/requests";
      } else {
        setError(data.error || "Error al iniciar sesión");
      }
    } catch (error) {
      setError("Error al conectar con el servidor");
      console.error("Error logging in:", error);
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
          <div className="w-24 h-24 bg-lemon-green rounded-full flex items-center justify-center mb-4">
            <Image src={logoIcon} alt="Logo" className="w-10 h-14" />
          </div>
          <h2 className="text-white text-xl font-bold mb-6">INICIA SESIÓN</h2>

          {error && (
            <div className="w-full max-w-xs mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Formulario */}
          <form className="w-full max-w-xs space-y-4" onSubmit={handleSubmit}>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="E-mail"
              className="w-full p-3 bg-white text-black border border-gray-300 rounded-full input-field"
              required
            />
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Contraseña"
              className="w-full p-3 bg-white text-black border border-gray-300 rounded-full input-field"
              required
            />

            {/* Olvidaste contraseña */}
            <p className="text-white text-sm text-center cursor-pointer hover:underline">
              ¿Olvidaste tu contraseña?
            </p>

            {/* Botón Ingresar */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-button-green text-white font-bold py-3 rounded-full hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "INGRESANDO..." : "INGRESAR →"}
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

            {/* Registrarse */}
            <div className="text-center mt-4 w-full">
              <p className="text-white text-sm">¿No tienes una cuenta?</p>
              <Link href="/companies" className="w-full flex justify-center">
                <button
                  type="button"
                  className="w-full bg-button-orange text-white font-bold py-3 rounded-full mt-2 hover:bg-orange-700"
                >
                  REGÍSTRATE →
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
