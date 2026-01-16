"use client";

import React, { useState, FormEvent } from "react";
import SocialLinks from "./SocialLinks";

const ContactForm = () => {
  const [formData, setFormData] = useState({
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
        // Scroll hacia arriba para mostrar el mensaje
        window.scrollTo({ top: 0, behavior: 'smooth' });

        setSubmitStatus({
          type: "success",
          message: "Se ha enviado correctamente el formulario a INAKAT",
        });
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
      // Scroll hacia arriba para mostrar el mensaje de error
      window.scrollTo({ top: 0, behavior: 'smooth' });

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

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <section className="bg-button-green text-white p-10 pl-9 pr-9 rounded-3xl shadow-lg w-full h-full flex flex-col">
      <h2 className="text-2xl font-bold">ESCRÍBENOS</h2>
      <p className="mt-2">
        Contáctanos para impulsar el futuro de tu empresa con talento altamente
        calificado.
      </p>

      {/* Form */}
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
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
          className="w-full p-7 pr-6 bg-white text-black border border-gray-300 rounded-xl input-field"
          required
        />

        {submitStatus.type && (
          <div
            className={`p-3 rounded-lg ${
              submitStatus.type === "success"
                ? "bg-green-100 text-green-800"
                : "bg-red-100 text-red-800"
            }`}
          >
            {submitStatus.message}
          </div>
        )}

        <p className="text-sm mt-2">
          *Al dar click en el botón, aceptas nuestros términos y condiciones y
          política de privacidad.
        </p>

        {/* Submit Button */}
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
    </section>
  );
};

export default ContactForm;
