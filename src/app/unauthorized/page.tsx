// RUTA: src/app/unauthorized/page.tsx
'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import Footer from '@/components/commons/Footer';
import SiteMotion from '@/components/ui/SiteMotion';
import TituloMascara, { type RenglonTitulo } from '@/components/ui/TituloMascara';
import {
  BOTON_FANTASMA,
  BOTON_NARANJA,
  MarcoAcceso,
  PanelAcceso,
  type RenglonFrase,
} from '../login/_acceso/MarcoAcceso';
import '../login/_acceso/acceso.css';

/**
 * AUTHUI-001: el middleware añade ?redirect=<ruta> al mandar aquí sin sesión,
 * pero el enlace a 'Iniciar Sesión' no lo propagaba y el deep-link se perdía
 * siempre. Se propaga sólo si es una ruta interna (nunca '//evil.com',
 * '/\evil.com' ni una URL absoluta), para no abrir un open redirect.
 */
const esRedirectInterno = (valor: string | null): valor is string => {
  if (!valor) return false;
  if (valor.charAt(0) !== '/') return false;
  if (valor.charAt(1) === '/' || valor.charAt(1) === '\\') return false;
  if (valor.indexOf('\\') !== -1) return false;
  if (valor.indexOf('://') !== -1) return false;
  if (/[\s\u0000-\u001F\u007F]/.test(valor)) return false;
  return true;
};

const getMessage = (reason: string | null) => {
  switch (reason) {
    case 'no-token':
      return 'Debes iniciar sesión para acceder a esta página.';
    case 'expired':
      return 'Tu sesión ha expirado. Por favor inicia sesión nuevamente.';
    case 'no-permission':
      return 'No tienes permisos para acceder a este recurso.';
    default:
      return 'No tienes autorización para ver esta página.';
  }
};

// --- Presentación por motivo ------------------------------------------------
type Motivo = 'no-token' | 'expired' | 'no-permission' | 'otro';

const motivoDe = (reason: string | null): Motivo =>
  reason === 'no-token' || reason === 'expired' || reason === 'no-permission' ? reason : 'otro';

const PRESENTACION: Record<Motivo, { antetitulo: string; titulo: RenglonTitulo[]; frase: RenglonFrase[] }> = {
  'no-token': {
    antetitulo: 'Acceso restringido',
    titulo: [{ texto: 'Primero,' }, { texto: 'inicia sesión.', contenido: <em>inicia sesión.</em> }],
    frase: [{ texto: 'Estás a un paso' }, { texto: 'de entrar.', em: true }],
  },
  expired: {
    antetitulo: 'Sesión cerrada',
    titulo: [{ texto: 'Tu sesión' }, { texto: 'expiró.', contenido: <em>expiró.</em> }],
    frase: [{ texto: 'Por seguridad,' }, { texto: 'cerramos tu sesión.', em: true }],
  },
  'no-permission': {
    antetitulo: 'Permisos',
    titulo: [{ texto: 'Sin acceso' }, { texto: 'a esta sección.', contenido: <em>a esta sección.</em> }],
    frase: [{ texto: 'Cada cuenta' }, { texto: 've lo suyo.', em: true }],
  },
  otro: {
    antetitulo: 'Acceso restringido',
    titulo: [{ texto: 'Acceso' }, { texto: 'denegado.', contenido: <em>denegado.</em> }],
    frase: [{ texto: 'Aquí no' }, { texto: 'podemos dejarte pasar.', em: true }],
  },
};

/**
 * Las salidas cambian según el motivo:
 * - sin sesión o sesión caducada: iniciar sesión (con el deep-link) es lo primero;
 * - sin permiso: ya hay sesión con otro rol, así que lo primero es volver al
 *   inicio o a la página anterior; iniciar sesión queda como «con otra cuenta».
 */
function VistaNoAutorizado({ reason, loginHref }: { reason: string | null; loginHref: string }) {
  const motivo = motivoDe(reason);
  const p = PRESENTACION[motivo];

  // «Volver a la página anterior» sólo si hay a dónde volver.
  const [puedeVolver, setPuedeVolver] = useState(false);
  useEffect(() => {
    setPuedeVolver(window.history.length > 1);
  }, []);

  return (
    <MarcoAcceso panel={<PanelAcceso antetitulo="INAKAT" frase={p.frase} />}>
      <p className="hm-eyebrow">{p.antetitulo}</p>
      <TituloMascara key={motivo} como="h1" className="ac-titulo mt-5" renglones={p.titulo} />
      <p className="hm-lead mt-5">{getMessage(reason)}</p>

      <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        {motivo === 'no-permission' ? (
          <>
            <Link href="/" className={BOTON_NARANJA} data-hm-magnet>
              Ir al inicio
              <ArrowRight aria-hidden="true" />
            </Link>
            <Link href={loginHref} className={BOTON_FANTASMA} data-hm-magnet>
              Iniciar sesión con otra cuenta
            </Link>
          </>
        ) : (
          <>
            <Link href={loginHref} className={BOTON_NARANJA} data-hm-magnet>
              {motivo === 'expired' ? 'Iniciar sesión de nuevo' : 'Iniciar sesión'}
              <ArrowRight aria-hidden="true" />
            </Link>
            {motivo === 'no-token' && (
              <Link href="/register" className={BOTON_FANTASMA} data-hm-magnet>
                Crear cuenta de candidato
              </Link>
            )}
            {motivo !== 'no-token' && (
              <Link href="/" className={BOTON_FANTASMA} data-hm-magnet>
                Ir al inicio
              </Link>
            )}
          </>
        )}
      </div>

      <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        {motivo === 'no-permission' && puedeVolver && (
          <button type="button" onClick={() => window.history.back()} className="ac-enlace inline-flex items-center gap-1.5">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Volver a la página anterior
          </button>
        )}
        {motivo === 'no-token' && (
          <Link href="/" className="ac-enlace">
            Ir al inicio
          </Link>
        )}
      </div>

      <div className="hm-rv mt-12 border-t border-line pt-6">
        <p className="font-serif text-2xl italic leading-tight">¿Crees que es un error?</p>
        <p className="mt-2 text-sm text-ink-muted">
          Cuéntanos qué intentabas abrir y te ayudamos.{' '}
          <Link href="/contact" className="ac-enlace">
            Escríbenos
          </Link>
        </p>
      </div>
    </MarcoAcceso>
  );
}

function UnauthorizedContent() {
  const searchParams = useSearchParams();
  const reason = searchParams.get('reason');
  const redirect = searchParams.get('redirect');

  // El deep-link sólo tiene sentido cuando falta la sesión: con
  // reason=no-permission el usuario ya está autenticado con otro rol.
  const propagaRedirect = reason === 'no-token' || reason === 'expired';
  const loginHref =
    propagaRedirect && esRedirectInterno(redirect)
      ? `/login?redirect=${encodeURIComponent(redirect)}`
      : '/login';

  return <VistaNoAutorizado reason={reason} loginHref={loginHref} />;
}

export default function UnauthorizedPage() {
  return (
    <>
      <main className="hm">
        {/* Sin JavaScript (y mientras se lee la URL) se ve el caso general,
            con sus salidas: iniciar sesión e ir al inicio. */}
        <Suspense fallback={<VistaNoAutorizado reason={null} loginHref="/login" />}>
          <UnauthorizedContent />
        </Suspense>
      </main>
      <Footer />
      <SiteMotion />
    </>
  );
}
