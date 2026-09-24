// RUTA: src/app/diseno/vista/admin/contact-messages/page.tsx
// Banco de pruebas: la página REAL /admin/contact-messages con fetch simulado (fixtures) y el
// AppShell de su rol. El layout de /diseno/vista instala el simulador antes.
import PaginaReal from '@/app/admin/contact-messages/page';

export default function Vista() {
  return <PaginaReal />;
}
