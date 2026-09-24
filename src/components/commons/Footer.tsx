// RUTA: src/components/commons/Footer.tsx
//
// Pie del registro PÚBLICO: tinta, dos arcos del isotipo creciendo desde el
// borde y la palabra INAKAT enorme, cortada por el borde inferior. Lo pinta
// cada página pública al final de su <main> (la aplicación no lleva pie).
// Sin JS y con movimiento reducido se ve completo y quieto; el movimiento
// (la palabra que sube, los arcos que crecen) vive en site.css tras
// @supports (animation-timeline) + prefers-reduced-motion: no-preference.
import Link from 'next/link';
import Image from 'next/image';
import { Instagram, Mail, MessageCircle, Phone } from 'lucide-react';
import logoFooter from '@/assets/images/logo/logo-footer.png';
import { CONTACTO } from '@/lib/nav-publica';

const NAVEGACION = [
  { etiqueta: 'Inicio', href: '/' },
  { etiqueta: 'Sobre Nosotros', href: '/about' },
  { etiqueta: 'Empresas', href: '/companies' },
  { etiqueta: 'Candidatos', href: '/talents' },
  { etiqueta: 'Contacto', href: '/contact' },
];

const Footer = () => {
  return (
    <footer className="hm-pie">
      <span className="hm-pie__arco" aria-hidden="true" />
      <span className="hm-pie__arco hm-pie__arco--b" aria-hidden="true" />

      <div className="hm-wrap">
        <div className="hm-pie__rejilla">
          <div className="hm-pie__marca">
            <Image src={logoFooter} alt="INAKAT" sizes="132px" />
            <p className="hm-pie__lema">
              Talento evaluado por expertos reales. Psicólogos + especialistas técnicos + IA responsable.
            </p>
          </div>

          <nav aria-labelledby="pie-navegacion">
            <h2 id="pie-navegacion" className="hm-pie__titulo">
              Navegación
            </h2>
            <ul className="hm-pie__lista">
              {NAVEGACION.map((enlace) => (
                <li key={enlace.href}>
                  <Link href={enlace.href}>{enlace.etiqueta}</Link>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <h2 className="hm-pie__titulo">Contacto</h2>
            <ul className="hm-pie__lista">
              <li>
                <a href={`mailto:${CONTACTO.email}`}>
                  <Mail aria-hidden="true" />
                  <span>
                    <span className="hm-pie__dato">Email</span>
                    {CONTACTO.email}
                  </span>
                </a>
              </li>
              <li>
                <a href={CONTACTO.telefonoHref}>
                  <Phone aria-hidden="true" />
                  <span>
                    <span className="hm-pie__dato">Teléfono</span>
                    {CONTACTO.telefono}
                  </span>
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h2 className="hm-pie__titulo">Síguenos</h2>
            <div className="hm-pie__redes">
              <a href={CONTACTO.whatsapp} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp (se abre en otra pestaña)">
                <MessageCircle aria-hidden="true" />
              </a>
              <a href={CONTACTO.instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram (se abre en otra pestaña)">
                <Instagram aria-hidden="true" />
              </a>
            </div>
            <ul className="hm-pie__lista">
              <li>
                <Link href="/terms">Términos y Condiciones</Link>
              </li>
              <li>
                <Link href="/privacy">Política de Privacidad</Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="hm-pie__base">
          <p>© {new Date().getFullYear()} INAKAT. Todos los derechos reservados.</p>
          <p>Reclutamiento con evaluación dual</p>
        </div>
      </div>

      <span className="hm-pie__palabra" aria-hidden="true">
        INAKAT
      </span>
    </footer>
  );
};

export default Footer;
