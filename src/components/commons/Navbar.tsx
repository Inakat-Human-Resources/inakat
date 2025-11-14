"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import logo from "@/assets/images/logo/logo.png";

const Navbar = () => {
  const pathname = usePathname();

  const getLinkClass = (path: string) => {
    return pathname === path
      ? "text-white bg-button-dark-green px-4 py-2 rounded-full cursor-default"
      : "px-4 py-2 rounded-full bg-transparent text-text-black hover:bg-button-dark-green hover:text-white transition-colors";
  };

  return (
    <nav className="fixed top-0 left-0 w-full bg-custom-beige py-10 md:py-12 z-50">
      <div className="container mx-auto flex justify-between items-center">
        {/* Logo */}
        <Link href="/">
          <Image src={logo} alt="INAKAT" className="w-32" priority />
        </Link>

        {/* Menu */}
        <ul className="flex space-x-4 md:space-x-6 items-center">
          <li>
            <Link href="/" className={getLinkClass("/")}>
              INICIO
            </Link>
          </li>
          <li>
            <Link href="/about" className={getLinkClass("/about")}>
              SOBRE NOSOTROS
            </Link>
          </li>
          <li>
            <Link href="/companies" className={getLinkClass("/companies")}>
              EMPRESAS
            </Link>
          </li>
          <li>
            <Link href="/talents" className={getLinkClass("/talents")}>
              TALENTOS
            </Link>
          </li>
          <li>
            <Link href="/contact" className={getLinkClass("/contact")}>
              CONTACTO
            </Link>
          </li>
          {/* Log-in Button */}
          <li>
            <Link
              href="/login"
              className="bg-button-orange text-white px-4 py-2 rounded-full"
            >
              LOG-IN
            </Link>
          </li>
        </ul>
      </div>
    </nav>
  );
};

export default Navbar;
