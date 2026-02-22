// RUTA: src/components/commons/Footer.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import logoFooter from '@/assets/images/logo/logo-footer.png';
import { Instagram, MessageCircle } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="bg-title-dark text-white">
      {/* Main Footer Content */}
      <div className="container mx-auto px-4 py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 md:gap-8">
          {/* Column 1: Logo + Description */}
          <div className="md:col-span-1">
            <Image
              src={logoFooter}
              alt="INAKAT Logo"
              className="w-28 mb-4"
            />
            <p className="text-white/60 text-sm leading-relaxed">
              Talento evaluado por expertos reales. Psicólogos + especialistas
              técnicos + IA responsable.
            </p>
          </div>

          {/* Column 2: Navigation */}
          <div>
            <h4 className="text-button-green font-display font-bold text-sm uppercase tracking-wider mb-4">
              Navegación
            </h4>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/"
                  className="text-white/70 hover:text-white transition-colors text-sm"
                >
                  Inicio
                </Link>
              </li>
              <li>
                <Link
                  href="/about"
                  className="text-white/70 hover:text-white transition-colors text-sm"
                >
                  Sobre Nosotros
                </Link>
              </li>
              <li>
                <Link
                  href="/companies"
                  className="text-white/70 hover:text-white transition-colors text-sm"
                >
                  Empresas
                </Link>
              </li>
              <li>
                <Link
                  href="/talents"
                  className="text-white/70 hover:text-white transition-colors text-sm"
                >
                  Candidatos
                </Link>
              </li>
              <li>
                <Link
                  href="/contact"
                  className="text-white/70 hover:text-white transition-colors text-sm"
                >
                  Contacto
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Contact */}
          <div>
            <h4 className="text-button-green font-display font-bold text-sm uppercase tracking-wider mb-4">
              Contacto
            </h4>
            <ul className="space-y-3 text-sm">
              <li>
                <p className="text-white/50 text-xs uppercase tracking-wider">
                  Email
                </p>
                <a
                  href="mailto:info@inakat.com"
                  className="text-white/70 hover:text-white transition-colors"
                >
                  info@inakat.com
                </a>
              </li>
              <li>
                <p className="text-white/50 text-xs uppercase tracking-wider">
                  Teléfono
                </p>
                <a
                  href="tel:+528116312490"
                  className="text-white/70 hover:text-white transition-colors"
                >
                  +52 811 631 2490
                </a>
              </li>
            </ul>
          </div>

          {/* Column 4: Social + Legal */}
          <div>
            <h4 className="text-button-green font-display font-bold text-sm uppercase tracking-wider mb-4">
              Síguenos
            </h4>
            <div className="flex gap-3 mb-6">
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

            <div className="space-y-1 text-sm">
              <Link
                href="/terms"
                className="block text-white/50 hover:text-white/70 transition-colors"
              >
                Términos y Condiciones
              </Link>
              <Link
                href="/privacy"
                className="block text-white/50 hover:text-white/70 transition-colors"
              >
                Políticas de Privacidad
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Copyright Bar */}
      <div className="border-t border-white/10">
        <div className="container mx-auto px-4 py-4">
          <p className="text-center text-white/40 text-sm">
            © {new Date().getFullYear()} INAKAT. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
