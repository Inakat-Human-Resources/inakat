// RUTA: src/app/contact/page.tsx
//
// Contacto en el registro PÚBLICO «Arco» (estilos en contact.css, prefijo ct-).
// La lógica es la de siempre, sin tocar: mismo estado, mismo POST /api/contact
// con el mismo cuerpo, mismos mensajes y mismo detalle de errores por campo.
// Cambia la presentación: titular a escala de encuadre, los canales directos
// como filas grandes (en móvil van ANTES del formulario: WhatsApp y llamar son
// lo más rápido desde un teléfono) y el formulario con los FormField del
// sistema (etiqueta visible, ayuda enlazada, obligatorio anunciado).
'use client';

import './contact.css';
import React, { useState, FormEvent } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Instagram,
  Loader2,
  Mail,
  MessageCircle,
  Phone,
} from 'lucide-react';
import Footer from '@/components/commons/Footer';
import SiteMotion from '@/components/ui/SiteMotion';
import TituloMascara from '@/components/ui/TituloMascara';
import FormField, { Input, Textarea } from '@/components/ui/FormField';
import { CONTACTO } from '@/lib/nav-publica';

interface FormData {
  nombre: string;
  email: string;
  telefono: string;
  mensaje: string;
}

export default function ContactPage() {
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
        // La API devuelve `errors: [{field, message}]` con el detalle. Mostrar
        // sólo `data.error` dejaba al visitante con un «Datos inválidos» que no
        // decía qué campo fallaba: el caso típico era el teléfono escrito tal
        // como lo sugería el placeholder.
        const detalle = Array.isArray(data.errors)
          ? data.errors
              .map((e: { message?: string }) => e?.message)
              .filter(Boolean)
              .join(' ')
          : '';
        throw new Error(detalle || data.error || 'Error al enviar el mensaje');
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
    <>
      <main className="hm">
        <section className="hm-suelo--arena ct" aria-labelledby="ct-titulo">
          <div className="ct__arcos" aria-hidden="true">
            <span className="hm-arc hm-arc--a" />
            <span className="hm-arc hm-arc--b" />
            <span className="hm-arc hm-arc--c" />
          </div>

          <div className="hm-wrap">
            <div className="ct__cabeza">
              <div>
                <p className="hm-eyebrow hm-entra">Contacto</p>
                <TituloMascara
                  como="h1"
                  id="ct-titulo"
                  className="hm-display mt-5"
                  renglones={[{ texto: 'Contáctanos' }]}
                />
              </div>
              <p className="hm-lead hm-entra" style={{ '--i': 1 } as React.CSSProperties}>
                ¿Tienes preguntas sobre nuestros servicios? Escríbenos y te
                responderemos lo antes posible.
              </p>
            </div>

            <div className="ct__rejilla">
              {/* Canales directos */}
              <div className="hm-entra" style={{ '--i': 2 } as React.CSSProperties}>
                <h2 className="ct__subtitulo">Información de contacto</h2>
                <ul className="ct__lista">
                  <li>
                    <a className="ct-canal" href={`mailto:${CONTACTO.email}`}>
                      <span className="ct-canal__icono" aria-hidden="true">
                        <Mail />
                      </span>
                      <span>
                        <span className="ct-canal__etiqueta">Email</span>
                        <span className="ct-canal__valor">{CONTACTO.email}</span>
                      </span>
                      <ArrowUpRight className="ct-canal__flecha" aria-hidden="true" />
                    </a>
                  </li>
                  <li>
                    <a className="ct-canal" href={CONTACTO.telefonoHref}>
                      <span className="ct-canal__icono" aria-hidden="true">
                        <Phone />
                      </span>
                      <span>
                        <span className="ct-canal__etiqueta">Teléfono</span>
                        <span className="ct-canal__valor">{CONTACTO.telefono}</span>
                      </span>
                      <ArrowUpRight className="ct-canal__flecha" aria-hidden="true" />
                    </a>
                  </li>
                  <li>
                    <a
                      className="ct-canal"
                      href={CONTACTO.whatsapp}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <span className="ct-canal__icono" aria-hidden="true">
                        <MessageCircle />
                      </span>
                      <span>
                        <span className="ct-canal__etiqueta">WhatsApp</span>
                        <span className="ct-canal__valor">
                          Enviar mensaje
                          <span className="sr-only"> (se abre en otra pestaña)</span>
                        </span>
                      </span>
                      <ArrowUpRight className="ct-canal__flecha" aria-hidden="true" />
                    </a>
                  </li>
                </ul>

                <div className="ct__redes">
                  <p className="ct__redes-titulo">Síguenos</p>
                  <a
                    href={CONTACTO.whatsapp}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="WhatsApp (se abre en otra pestaña)"
                  >
                    <MessageCircle aria-hidden="true" />
                  </a>
                  <a
                    href={CONTACTO.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Instagram (se abre en otra pestaña)"
                  >
                    <Instagram aria-hidden="true" />
                  </a>
                </div>
              </div>

              {/* El formulario, en una hoja blanca */}
              <div className="ct-hoja hm-entra" style={{ '--i': 3 } as React.CSSProperties}>
                <h2 className="ct-hoja__titulo">
                  Escríbenos<em>.</em>
                </h2>
                <p className="ct-hoja__intro">
                  Contáctanos para impulsar el futuro de tu empresa con talento
                  altamente calificado.
                </p>

                {/* Región viva fija: el éxito se anuncia sin mover el foco. El
                    error va en role="alert" (se anuncia al momento). */}
                <div role="status" aria-live="polite">
                  {submitStatus.type === 'success' && (
                    <p className="ct-aviso ct-aviso--exito">
                      <CheckCircle2 aria-hidden="true" />
                      {submitStatus.message}
                    </p>
                  )}
                </div>
                {submitStatus.type === 'error' && (
                  <div role="alert" className="ct-aviso ct-aviso--error">
                    <AlertCircle aria-hidden="true" />
                    {submitStatus.message}
                  </div>
                )}

                <form className="ct-form" onSubmit={handleSubmit}>
                  <FormField etiqueta="Nombre" requerido id="nombre">
                    <Input
                      type="text"
                      name="nombre"
                      value={formData.nombre}
                      onChange={handleChange}
                      placeholder="Tu nombre completo"
                      autoComplete="name"
                      className="h-12"
                    />
                  </FormField>

                  <div className="ct-form__par">
                    <FormField etiqueta="Correo electrónico" requerido id="email">
                      <Input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        placeholder="tu@correo.com"
                        autoComplete="email"
                        className="h-12"
                      />
                    </FormField>

                    <FormField
                      etiqueta="Teléfono"
                      opcional
                      id="telefono"
                      ayuda="10 dígitos, por ejemplo 8112345678."
                    >
                      <Input
                        type="tel"
                        name="telefono"
                        value={formData.telefono}
                        onChange={handleChange}
                        maxLength={20}
                        autoComplete="tel"
                        className="h-12"
                      />
                    </FormField>
                  </div>

                  {/* La API exige al menos 10 caracteres (contactMessageSchema):
                      se dice antes de enviar, no sólo en el error. */}
                  <FormField
                    etiqueta="Mensaje"
                    requerido
                    id="mensaje"
                    ayuda="Al menos 10 caracteres."
                  >
                    <Textarea
                      name="mensaje"
                      value={formData.mensaje}
                      onChange={handleChange}
                      placeholder="Cuéntanos qué necesitas…"
                      rows={5}
                    />
                  </FormField>

                  {/* El aviso declaraba una aceptación sin poner los documentos
                      a disposición: son enlaces reales. */}
                  <p className="ct-form__aviso">
                    *Al dar click en el botón, aceptas nuestros{' '}
                    <Link href="/terms">términos y condiciones</Link> y{' '}
                    <Link href="/privacy">política de privacidad</Link>.
                  </p>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    aria-busy={isSubmitting || undefined}
                    className="hm-btn hm-btn--orange ct-form__enviar"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="animate-spin" aria-hidden="true" />
                        Enviando…
                      </>
                    ) : (
                      <>
                        Enviar mensaje
                        <ArrowRight aria-hidden="true" />
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
      <SiteMotion />
    </>
  );
}
