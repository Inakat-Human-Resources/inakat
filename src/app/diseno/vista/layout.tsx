// RUTA: src/app/diseno/vista/layout.tsx
//
// /diseno/vista/<ruta real>: la página REAL de la aplicación, con fetch
// simulado y dentro del AppShell de su rol (?rol= para forzarlo).
import { Suspense } from 'react';
import BancoVista from '../_banco/BancoVista';

export default function VistaLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <BancoVista>{children}</BancoVista>
    </Suspense>
  );
}
