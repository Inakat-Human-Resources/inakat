// RUTA: src/app/contact/page.tsx
'use client';

import React, { useState, FormEvent } from 'react';
import { useInView } from '@/hooks/useInView';
import { Mail, Phone, MessageCircle, Instagram } from 'lucide-react';
import Footer from '@/components/commons/Footer';

interface FormData {
  nombre: string;
  email: string;
  telefono: string;
  mensaje: string;
}

export default function ContactPage() {
  const { ref, isInView } = useInView(0.1);

  const [formData, setFormData] = useState<FormData>({
    nombre: '',
    email: '',
    telefono: '',
    mensaje: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus({ type: null, message: '' });

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        setSubmitStatus({
          type: 'success',
          message:
            '¡Mensaje enviado exitosamente! Nos contactaremos contigo pronto.',
        });
        setFormData({ nombre: '', email: '', telefono: '', mensaje: '' });
      } else {
        throw new Error(data.error || 'Error al enviar el mensaje');
      }
    } catch (error) {
      setSubmitStatus({
        type: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Error al enviar el mensaje. Por favor, intenta de nuevo.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen">
      <section
        ref={ref as React.RefObject<HTMLDivElement>}
        className="bg-custom-beige py-16 md:py-24"
      >
        <div className="container mx-auto px-4">
          {/* Section title */}
          <h1
            className={`animate-on-scroll ${isInView ? 'in-view' : ''} font-display text-3xl md:text-4xl lg:text-5xl font-bold text-title-dark text-center mb-4`}
          >
            Contáctanos
          </h1>
          <p
            className={`animate-on-scroll ${isInView ? 'in-view' : ''} text-text-black/60 text-lg text-center mb-14 max-w-2xl mx-auto`}
            style={{ transitionDelay: '100ms' }}
          >
            ¿Tienes preguntas sobre nuestros servicios? Escríbenos y te
            responderemos lo antes posible.
          </p>

          {/* Two-column layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* Left column: Contact info */}
            <div
              className={`animate-on-scroll ${isInView ? 'in-view' : ''} bg-title-dark rounded-2xl p-8 md:p-10`}
              style={{ transitionDelay: '150ms' }}
            >
              <h2 className="font-display text-2xl font-bold text-white mb-8">
                Información de Contacto
              </h2>

              <div className="space-y-6">
                {/* Email */}
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                    <Mail className="w-5 h-5 text-button-green" />
                  </div>
                  <div>
                    <p className="text-white/50 text-xs uppercase tracking-wider mb-1">
                      Email
                    </p>
                    <a
                      href="mailto:info@inakat.com"
                      className="text-white hover:text-button-green transition-colors"
                    >
                      info@inakat.com
                    </a>
                  </div>
                </div>

                {/* Phone */}
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                    <Phone className="w-5 h-5 text-button-green" />
                  </div>
                  <div>
                    <p className="text-white/50 text-xs uppercase tracking-wider mb-1">
                      Teléfono
                    </p>
                    <a
                      href="tel:+528116312490"
                      className="text-white hover:text-button-green transition-colors"
                    >
                      +52 811 631 2490
                    </a>
                  </div>
                </div>

                {/* WhatsApp */}
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                    <MessageCircle className="w-5 h-5 text-button-green" />
                  </div>
                  <div>
                    <p className="text-white/50 text-xs uppercase tracking-wider mb-1">
                      WhatsApp
                    </p>
                    <a
                      href="https://wa.me/528116312490"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-white hover:text-button-green transition-colors"
                    >
                      Enviar mensaje
                    </a>
                  </div>
                </div>
              </div>

              {/* Social icons */}
              <div className="mt-10 pt-8 border-t border-white/10">
                <p className="text-white/50 text-xs uppercase tracking-wider mb-4">
                  Síguenos
                </p>
                <div className="flex gap-3">
                  <a
                    href="https://wa.me/528116312490"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white/70 hover:bg-button-green hover:text-white transition-all"
                    aria-label="WhatsApp"
                  >
                    <MessageCircle className="w-5 h-5" />
                  </a>
                  <a
                    href="https://www.instagram.com/inakatmx/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white/70 hover:bg-button-green hover:text-white transition-all"
                    aria-label="Instagram"
                  >
                    <Instagram className="w-5 h-5" />
                  </a>
                </div>
              </div>
            </div>

            {/* Right column: Form */}
            <div
              className={`animate-on-scroll ${isInView ? 'in-view' : ''} bg-white rounded-2xl p-8 md:p-10 shadow-sm`}
              style={{ transitionDelay: '300ms' }}
            >
              <h2 className="font-display text-2xl font-bold text-title-dark mb-2">
                Escríbenos
              </h2>
              <p className="text-text-black/60 text-sm mb-6">
                Contáctanos para impulsar el futuro de tu empresa con talento
                altamente calificado.
              </p>

              {/* Status message */}
              {submitStatus.type && (
                <div
                  className={`mb-6 p-4 rounded-lg text-sm ${
                    submitStatus.type === 'success'
                      ? 'bg-green-50 text-green-800 border border-green-200'
                      : 'bg-red-50 text-red-800 border border-red-200'
                  }`}
                >
                  {submitStatus.message}
                </div>
              )}

              {/* Form */}
              <form className="space-y-5" onSubmit={handleSubmit}>
                <div>
                  <label
                    htmlFor="nombre"
                    className="block text-sm font-semibold text-title-dark mb-1.5"
                  >
                    Nombre
                  </label>
                  <input
                    type="text"
                    id="nombre"
                    name="nombre"
                    value={formData.nombre}
                    onChange={handleChange}
                    placeholder="Tu nombre completo"
                    className="w-full p-3 bg-white text-text-black border border-gray-200 rounded-lg focus:border-button-green focus:ring-2 focus:ring-button-green/20 outline-none transition-all"
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-semibold text-title-dark mb-1.5"
                  >
                    E-mail
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="tu@email.com"
                    className="w-full p-3 bg-white text-text-black border border-gray-200 rounded-lg focus:border-button-green focus:ring-2 focus:ring-button-green/20 outline-none transition-all"
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="telefono"
                    className="block text-sm font-semibold text-title-dark mb-1.5"
                  >
                    Teléfono
                  </label>
                  <input
                    type="tel"
                    id="telefono"
                    name="telefono"
                    value={formData.telefono}
                    onChange={handleChange}
                    placeholder="+52 000 000 0000"
                    className="w-full p-3 bg-white text-text-black border border-gray-200 rounded-lg focus:border-button-green focus:ring-2 focus:ring-button-green/20 outline-none transition-all"
                  />
                </div>

                <div>
                  <label
                    htmlFor="mensaje"
                    className="block text-sm font-semibold text-title-dark mb-1.5"
                  >
                    Mensaje
                  </label>
                  <textarea
                    id="mensaje"
                    name="mensaje"
                    value={formData.mensaje}
                    onChange={handleChange}
                    placeholder="Escribe tu mensaje..."
                    className="w-full p-3 bg-white text-text-black border border-gray-200 rounded-lg focus:border-button-green focus:ring-2 focus:ring-button-green/20 outline-none transition-all"
                    rows={4}
                    required
                  />
                </div>

                <p className="text-xs text-text-black/50">
                  *Al dar click en el botón, aceptas nuestros términos y
                  condiciones y política de privacidad.
                </p>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-button-orange text-white font-semibold py-4 rounded-full hover:scale-105 hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  {isSubmitting ? 'Enviando...' : 'Enviar Mensaje'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
