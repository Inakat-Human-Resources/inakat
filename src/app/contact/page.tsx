"use client";

import React, { useState, FormEvent } from "react";
import SocialLinks from "@/components/commons/SocialLinks";
import Footer from "@/components/commons/Footer";

interface FormData {
  nombre: string;
  email: string;
  telefono: string;
  mensaje: string;
}

export default function ContactPage() {
  const [formData, setFormData] = useState<FormData>({
    nombre: "",
    email: "",
    telefono: "",
    mensaje: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<{
    type: "success" | "error" | null;
    message: string;
  }>({ type: null, message: "" });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus({ type: null, message: "" });

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        setSubmitStatus({
          type: "success",
          message:
            "¡Mensaje enviado exitosamente! Nos contactaremos contigo pronto.",
        });

        // Reset form
        setFormData({
          nombre: "",
          email: "",
          telefono: "",
          mensaje: "",
        });
      } else {
        throw new Error(data.error || "Error al enviar el mensaje");
      }
    } catch (error) {
      setSubmitStatus({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Error al enviar el mensaje. Por favor, intenta de nuevo.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <section className="bg-custom-beige py-20">
        <div className="container mx-auto flex flex-col md:flex-row justify-center gap-8">
          {/* Bloque Izquierdo: Información de Contacto */}
          <div className="bg-title-dark text-white p-10 pl-9 pr-9 rounded-xl shadow-lg w-full md:w-1/2">
            <h2 className="text-2xl font-bold">CONTACTO</h2>
            <p className="mt-2">
              Síguenos en todas nuestras redes y mantente al tanto de cualquier
              información.
            </p>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-bold text-button-green">
                  OFICINAS
                </h3>
                <p className="mt-1">
                  GUADALAJARA
                  <br />
                  Lorem Ipsum Dolor
                  <br />
                  Sit Amet
                </p>
                <p className="mt-4">
                  MONTERREY
                  <br />
                  Lorem Ipsum Dolor
                  <br />
                  Sit Amet
                </p>
                <p className="mt-4">
                  CDMX
                  <br />
                  Lorem Ipsum Dolor
                  <br />
                  Sit Amet
                </p>
              </div>

              <div>
                <h3 className="text-lg font-bold text-button-green">EMAIL</h3>
                <p className="mt-1">info@inakat.com</p>

                <h3 className="text-lg font-bold text-button-green mt-4">
                  TELÉFONO
                </h3>
                <p className="mt-1">+52 00 00 00 00</p>
              </div>
            </div>

            <div className="mt-6">
              <SocialLinks />
            </div>
          </div>

          {/* Bloque Derecho: Formulario */}
          <div className="bg-button-green text-white p-10 pl-9 pr-9 rounded-xl shadow-lg w-full md:w-1/2">
            <h2 className="text-2xl font-bold">ESCRÍBENOS</h2>
            <p className="mt-2">
              Contáctanos para impulsar el futuro de tu empresa con talento
              altamente calificado.
            </p>

            {submitStatus.type && (
              <div
                className={`mt-4 p-4 rounded-lg ${
                  submitStatus.type === "success"
                    ? "bg-green-100 text-green-800"
                    : "bg-red-100 text-red-800"
                }`}
              >
                {submitStatus.message}
              </div>
            )}

            {/* Formulario */}
            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              <input
                type="text"
                name="nombre"
                value={formData.nombre}
                onChange={handleChange}
                placeholder="Nombre"
                className="w-full p-3 pr-6 bg-white text-black border border-gray-300 rounded-full input-field"
                required
              />
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="E-mail"
                className="w-full p-3 pr-6 bg-white text-black border border-gray-300 rounded-full input-field"
                required
              />
              <input
                type="tel"
                name="telefono"
                value={formData.telefono}
                onChange={handleChange}
                placeholder="Teléfono"
                className="w-full p-3 pr-6 bg-white text-black border border-gray-300 rounded-full input-field"
              />
              <textarea
                name="mensaje"
                value={formData.mensaje}
                onChange={handleChange}
                placeholder="Escribe tu mensaje..."
                className="w-full p-3 pr-6 bg-white text-black border border-gray-300 rounded-lg input-field"
                rows={4}
                required
              />

              <p className="text-sm mt-2">
                *Al dar click en el botón, aceptas nuestros términos y
                condiciones y política de privacidad.
              </p>

              {/* Botón Enviar */}
              <div className="flex justify-center">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-button-dark-green text-white font-bold py-3 px-6 rounded-full hover:bg-green-900 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? "ENVIANDO..." : "ENVIAR →"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}
