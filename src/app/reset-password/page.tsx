// RUTA: src/app/reset-password/page.tsx

'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import Footer from '@/components/commons/Footer';
import SiteMotion from '@/components/ui/SiteMotion';
import TituloMascara from '@/components/ui/TituloMascara';
import Button from '@/components/ui/Button';
import FormField, { Input } from '@/components/ui/FormField';
import {
  AvisoAcceso,
  BOTON_FANTASMA,
  BOTON_NARANJA,
  FormularioCargando,
  MarcoAcceso,
  PanelAcceso,
} from '../login/_acceso/MarcoAcceso';
import { CampoContrasena, RequisitosContrasena } from '../login/_acceso/CampoContrasena';
import '../login/_acceso/acceso.css';

// Campos del registro público: 48 px de alto y 16 px de letra (con menos,
// Safari en iPhone amplía la página al enfocar el campo).
const CONTROL = 'h-12 text-base';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // AUTHUI-008: la página anunciaba y validaba 6 caracteres mientras
    // /api/auth/reset-password exige 8 + mayúscula + número, así que el usuario
    // descubría la política a prueba y error, gastando el rate limit (5/15 min)
    // con un token que caduca en 1 hora. Mismas reglas que el API y que /register.
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres');
      return;
    }

    if (!/[A-Z]/.test(password)) {
      setError('Debe contener al menos una mayúscula');
      return;
    }

    if (!/[0-9]/.test(password)) {
      setError('Debe contener al menos un número');
      return;
    }

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password })
      });

      const data = await res.json();

      if (data.success) {
        setSuccess(true);
        setTimeout(() => router.push('/login'), 3000);
      } else {
        setError(data.error || 'Error al restablecer contraseña');
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Presentación ---------------------------------------------------------
  // AUTHUI-028: el API responde «Token inválido o expirado» cuando el enlace
  // caducó, ya se usó o no existe. Volver a enviar el formulario no sirve de
  // nada: en vez del aviso suelto se ofrece pedir un enlace nuevo. El estado es
  // el mismo `error` de siempre; sólo cambia cómo se pinta.
  const enlaceVencido = /token/i.test(error);

  // Cuando el formulario se va (éxito o enlace vencido), el foco pasa al
  // mensaje que lo sustituye en lugar de perderse.
  const estadoRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (success || enlaceVencido) estadoRef.current?.focus();
  }, [success, enlaceVencido]);

  if (!token) {
    return (
      <div>
        <p className="hm-eyebrow">Enlace no válido</p>
        <TituloMascara
          como="h1"
          className="ac-titulo mt-5"
          renglones={[{ texto: 'Este enlace' }, { texto: 'no funciona.', contenido: <em>no funciona.</em> }]}
        />
        <p className="hm-lead mt-5">El enlace es inválido. Solicita uno nuevo.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/forgot-password" className={BOTON_NARANJA} data-hm-magnet>
            Solicitar nuevo enlace
            <ArrowRight aria-hidden="true" />
          </Link>
        </div>
        <p className="mt-6 text-sm">
          <Link href="/login" className="ac-enlace inline-flex items-center gap-1.5">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Volver a iniciar sesión
          </Link>
        </p>
      </div>
    );
  }

  if (success) {
    return (
      <div ref={estadoRef} tabIndex={-1} role="status" className="outline-none">
        <p className="hm-eyebrow">Listo</p>
        <TituloMascara
          key="exito"
          como="h1"
          className="ac-titulo mt-5"
          renglones={[{ texto: 'Contraseña' }, { texto: 'actualizada.', contenido: <em>actualizada.</em> }]}
        />
        <p className="hm-lead mt-5">
          Tu contraseña fue restablecida correctamente. Serás redirigido al inicio de sesión en unos segundos.
        </p>
        <div className="mt-8">
          <Link href="/login" className={BOTON_NARANJA}>
            Iniciar sesión ahora
            <ArrowRight aria-hidden="true" />
          </Link>
        </div>
      </div>
    );
  }

  if (enlaceVencido) {
    return (
      <div ref={estadoRef} tabIndex={-1} role="alert" className="outline-none">
        <p className="hm-eyebrow">Enlace caducado</p>
        <TituloMascara
          key="vencido"
          como="h1"
          className="ac-titulo mt-5"
          renglones={[{ texto: 'Este enlace' }, { texto: 'ya no sirve.', contenido: <em>ya no sirve.</em> }]}
        />
        <p className="hm-lead mt-5">
          Por seguridad, cada enlace sirve una sola vez y caduca en una hora. Pide uno nuevo y te lo
          enviamos a tu correo.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/forgot-password" className={BOTON_NARANJA} data-hm-magnet>
            Solicitar nuevo enlace
            <ArrowRight aria-hidden="true" />
          </Link>
          <Link href="/login" className={`${BOTON_FANTASMA} ac-atras`}>
            <ArrowLeft aria-hidden="true" />
            Volver a iniciar sesión
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="hm-eyebrow">Recuperar acceso</p>
      <TituloMascara
        key="formulario"
        como="h1"
        className="ac-titulo mt-5"
        renglones={[{ texto: 'Nueva' }, { texto: 'contraseña.', contenido: <em>contraseña.</em> }]}
      />
      <p className="hm-lead mt-5">Ingresa tu nueva contraseña.</p>

      <div className="ac-tarjeta mt-8">
        {error && (
          <AvisoAcceso tono="error" className="mb-5">
            {error}
          </AvisoAcceso>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <FormField
            etiqueta="Nueva contraseña"
            requerido
            id="password"
            ayuda={<RequisitosContrasena valor={password} />}
          >
            <CampoContrasena
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              placeholder="Mínimo 8 caracteres"
              className={CONTROL}
              // AUTHUI-025: botón sólo-icono con nombre accesible y estado.
              visible={showPassword}
              alAlternar={() => setShowPassword(!showPassword)}
            />
          </FormField>

          <FormField etiqueta="Confirmar contraseña" requerido id="confirmPassword">
            <Input
              type={showPassword ? 'text' : 'password'}
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              placeholder="Repite la contraseña"
              className={CONTROL}
            />
          </FormField>

          <Button
            variante="publico-naranja"
            type="submit"
            tamano="lg"
            anchoCompleto
            cargando={isSubmitting}
            textoCargando="Actualizando…"
            iconoFinal={ArrowRight}
          >
            Restablecer contraseña
          </Button>
        </form>
      </div>

      <p className="mt-6 text-sm">
        <Link href="/login" className="ac-enlace inline-flex items-center gap-1.5">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Volver a iniciar sesión
        </Link>
      </p>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <>
      <main className="hm">
        <MarcoAcceso
          panel={
            <PanelAcceso
              antetitulo="INAKAT"
              frase={[{ texto: 'Un paso más' }, { texto: 'y vuelves a entrar.', em: true }]}
              pie="Por seguridad, cada enlace sirve una sola vez y caduca en una hora."
            />
          }
        >
          {/* useSearchParams (el token) obliga a un límite de Suspense. */}
          <Suspense
            fallback={
              <div>
                <p className="hm-eyebrow">Recuperar acceso</p>
                <TituloMascara
                  como="h1"
                  className="ac-titulo mt-5"
                  renglones={[{ texto: 'Nueva' }, { texto: 'contraseña.', contenido: <em>contraseña.</em> }]}
                />
                <FormularioCargando className="mt-8" />
              </div>
            }
          >
            <ResetPasswordForm />
          </Suspense>
        </MarcoAcceso>
      </main>
      <Footer />
      <SiteMotion />
    </>
  );
}
