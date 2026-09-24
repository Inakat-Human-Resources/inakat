// RUTA: src/app/login/page.tsx

'use client';

import React, { useState, useRef, FormEvent, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import Footer from '@/components/commons/Footer';
import SiteMotion from '@/components/ui/SiteMotion';
import TituloMascara from '@/components/ui/TituloMascara';
import Button from '@/components/ui/Button';
import FormField, { Input } from '@/components/ui/FormField';
import {
  AvisoAcceso,
  FormularioCargando,
  MarcoAcceso,
  PanelAcceso,
} from './_acceso/MarcoAcceso';
import { CampoContrasena } from './_acceso/CampoContrasena';
import './_acceso/acceso.css';

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

// Campos del registro público: 48 px de alto y 16 px de letra (con menos,
// Safari en iPhone amplía la página al enfocar el campo).
const CONTROL = 'h-12 text-base';

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
  // Presentación: mostrar u ocultar lo que se escribe en la contraseña.
  const [verContrasena, setVerContrasena] = useState(false);

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
    <>
      <div className="ac-tarjeta mt-8">
        {/* AUTHUI-013: el error se muestra UNA vez, junto al formulario (antes
            salía a la vez en un aviso flotante y aquí). */}
        {error && (
          <AvisoAcceso tono="error" className="mb-5">
            {error}
          </AvisoAcceso>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <FormField etiqueta="Correo electrónico" requerido id="email">
            <Input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              autoComplete="email"
              inputMode="email"
              placeholder="tu@email.com"
              className={CONTROL}
            />
          </FormField>

          <div>
            <FormField etiqueta="Contraseña" requerido id="password">
              <CampoContrasena
                name="password"
                value={formData.password}
                onChange={handleChange}
                autoComplete="current-password"
                placeholder="••••••••"
                className={CONTROL}
                visible={verContrasena}
                alAlternar={() => setVerContrasena((v) => !v)}
              />
            </FormField>
            <p className="mt-2 text-right text-sm">
              <Link href="/forgot-password" className="ac-enlace">
                ¿Olvidaste tu contraseña?
              </Link>
            </p>
          </div>

          <Button
            variante="publico-naranja"
            type="submit"
            tamano="lg"
            anchoCompleto
            cargando={isSubmitting}
            textoCargando="Ingresando…"
            iconoFinal={ArrowRight}
          >
            Ingresar
          </Button>
        </form>
      </div>

      {/* Registrarse */}
      <div className="hm-rv mt-10">
        <p className="font-display text-base font-semibold">¿Aún no tienes una cuenta?</p>
        <div className="ac-opciones mt-3">
          <Link href="/register" className="ac-opcion">
            <span className="ac-opcion__k">Soy candidato</span>
            <span className="ac-opcion__t">Crear mi cuenta</span>
            <ArrowRight aria-hidden="true" />
          </Link>
          {/* BUG-012 FIX: Ancla al formulario */}
          <Link href="/companies#formulario-registro" className="ac-opcion">
            <span className="ac-opcion__k">Soy empresa</span>
            <span className="ac-opcion__t">Registrar mi empresa</span>
            <ArrowRight aria-hidden="true" />
          </Link>
        </div>
      </div>
    </>
  );
}

export default function LoginPage() {
  return (
    <>
      <main className="hm">
        <MarcoAcceso
          panel={
            <PanelAcceso
              antetitulo="INAKAT"
              frase={[{ texto: 'Conectamos talentos' }, { texto: 'con especialistas.', em: true }]}
              pie="Evaluación dual: psicólogos + especialistas técnicos."
            />
          }
        >
          <p className="hm-eyebrow">Acceso</p>
          <TituloMascara
            como="h1"
            className="ac-titulo mt-5"
            renglones={[{ texto: 'Inicia' }, { texto: 'sesión.', contenido: <em>sesión.</em> }]}
          />
          <p className="hm-lead mt-4">Accede a tu cuenta de INAKAT.</p>

          {/* useSearchParams obliga a un límite de Suspense en el App Router. */}
          <Suspense fallback={<FormularioCargando className="mt-8" />}>
            <LoginForm />
          </Suspense>
        </MarcoAcceso>
      </main>
      <Footer />
      <SiteMotion />
    </>
  );
}
