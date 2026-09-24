// RUTA: src/app/_estados/SalidaPanel.tsx
//
// «Ir a mi panel» en la página 404, sólo si hay sesión. La 404 de una ruta de
// aplicación (/admin/loquesea) se pinta sin barra pública ni AppShell
// (docs/DISENO.md §9): esta es su salida a la aplicación. Lee la sesión con el
// mismo hook que PublicNav y AppShell (GET /api/auth/me: sin cookie responde
// 200 con user null, así que no ensucia la consola del visitante anónimo).
'use client';

import Link from 'next/link';
import { LayoutDashboard } from 'lucide-react';
import { useSesion } from '@/hooks/useSesion';
import { inicioDeRol } from '@/lib/nav-app';

export default function SalidaPanel() {
  const { usuario } = useSesion();
  if (!usuario) return null;
  return (
    <Link href={inicioDeRol(usuario.role)} className="hm-btn hm-btn--ghost">
      <LayoutDashboard aria-hidden="true" />
      Ir a mi panel
    </Link>
  );
}
