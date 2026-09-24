// RUTA: src/app/forgot-password/page.tsx

'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Mail } from 'lucide-react';
import Footer from '@/components/commons/Footer';
import SiteMotion from '@/components/ui/SiteMotion';
import TituloMascara from '@/components/ui/TituloMascara';
import Button from '@/components/ui/Button';
import FormField, { Input } from '@/components/ui/FormField';
import { AvisoAcceso, BOTON_FANTASMA, MarcoAcceso, PanelAcceso } from '../login/_acceso/MarcoAcceso';
import '../login/_acceso/acceso.css';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  // Presentación: al cambiar a «Revisa tu correo» el formulario desaparece;
  // el foco pasa a la confirmación para no quedarse en la nada.
  const confirmacionRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (sent) confirmacionRef.current?.focus();
  }, [sent]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await res.json();

      if (data.success) {
        setSent(true);
      } else {
        setError(data.error || 'Error al enviar solicitud');
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <main className="hm">
        <MarcoAcceso
          panel={
            <PanelAcceso
              antetitulo="INAKAT"
              frase={[{ texto: 'Sin problema.' }, { texto: 'Te ayudamos a volver a entrar.', em: true }]}
              pie="Por seguridad, cada enlace sirve una sola vez y caduca en una hora."
            />
          }
        >
          {sent ? (
            <div
              ref={confirmacionRef}
              tabIndex={-1}
              role="status"
              className="outline-none"
            >
              <p className="hm-eyebrow">Correo enviado</p>
              <TituloMascara
                key="enviado"
                como="h1"
                className="ac-titulo mt-5"
                renglones={[{ texto: 'Revisa' }, { texto: 'tu correo.', contenido: <em>tu correo.</em> }]}
              />
              <p className="hm-lead mt-5">
                Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.
              </p>
              <p className="mt-4 text-sm text-ink-muted">
                ¿No lo ves en unos minutos? Revisa la carpeta de correo no deseado.
              </p>
              <div className="mt-8">
                <Link href="/login" className={`${BOTON_FANTASMA} ac-atras`}>
                  <ArrowLeft aria-hidden="true" />
                  Volver a iniciar sesión
                </Link>
              </div>
            </div>
          ) : (
            <>
              <p className="hm-eyebrow">Recuperar acceso</p>
              <TituloMascara
                key="formulario"
                como="h1"
                className="ac-titulo mt-5"
                renglones={[
                  { texto: '¿Olvidaste' },
                  {
                    texto: 'tu contraseña?',
                    contenido: (
                      <>
                        tu <em>contraseña?</em>
                      </>
                    ),
                  },
                ]}
              />
              <p className="hm-lead mt-5">
                Ingresa tu correo electrónico y te enviaremos un enlace para restablecerla.
              </p>

              <div className="ac-tarjeta mt-8">
                {error && (
                  // AUTHUI-014: sin role="alert" el lector de pantalla no anunciaba el error.
                  <AvisoAcceso tono="error" className="mb-5">
                    {error}
                  </AvisoAcceso>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                  <FormField
                    etiqueta="Correo electrónico"
                    requerido
                    id="email"
                    ayuda="Usa el correo con el que te registraste."
                  >
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      inputMode="email"
                      placeholder="tu@correo.com"
                      prefijo={<Mail />}
                      className="h-12 text-base"
                    />
                  </FormField>

                  <Button
                    variante="publico-naranja"
                    type="submit"
                    tamano="lg"
                    anchoCompleto
                    cargando={isSubmitting}
                    textoCargando="Enviando…"
                    iconoFinal={ArrowRight}
                  >
                    Enviar enlace
                  </Button>
                </form>
              </div>

              <p className="mt-6 text-sm">
                <Link href="/login" className="ac-enlace inline-flex items-center gap-1.5">
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  Volver a iniciar sesión
                </Link>
              </p>
            </>
          )}
        </MarcoAcceso>
      </main>
      <Footer />
      <SiteMotion />
    </>
  );
}
