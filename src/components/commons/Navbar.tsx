// RUTA: src/components/commons/Navbar.tsx

'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import { LogOut, User, ChevronDown, Menu, X } from 'lucide-react';
import logo from '@/assets/images/logo/logo.png';

interface UserData {
  userId: number;
  email: string;
  role: string;
  nombre?: string;
  credits?: number; // 💰 Agregar créditos
}

const Navbar = () => {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<UserData | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Verificar autenticación llamando al endpoint /api/auth/me
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/me', {
          method: 'GET',
          credentials: 'include' // Importante: incluir cookies
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.user) {
            // Mapear los datos del usuario al formato esperado
            setUser({
              userId: data.user.id,
              email: data.user.email,
              role: data.user.role,
              nombre: data.user.nombre,
              credits: data.user.credits || 0 // 💰 Incluir créditos
            });
          }
        } else {
          // Si no está autenticado, limpiar el estado
          setUser(null);
        }
      } catch (error) {
        console.error('Error checking auth:', error);
        setUser(null);
      }
    };

    checkAuth();
  }, [pathname]);

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      // Llamar al endpoint de logout
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });
      if (!response.ok) {
        console.error('Error logging out: response not ok');
      }
    } catch (error) {
      console.error('Error logging out:', error);
    } finally {
      // Limpiar estado local y redirigir
      setUser(null);
      setDropdownOpen(false);
      router.push('/');
      router.refresh();
    }
  };

  const getDashboardLink = () => {
    if (!user) return '/';

    switch (user.role) {
      case 'admin':
        return '/admin'; // Cambiar a dashboard principal
      case 'company':
        return '/company/dashboard';
      case 'recruiter':
        return '/recruiter/dashboard';
      case 'specialist':
        return '/specialist/dashboard';
      case 'candidate':
        return '/candidate/applications';
      case 'user':
        return '/my-applications';
      default:
        return '/';
    }
  };

  const getDashboardLabel = () => {
    if (!user) return 'Dashboard';

    switch (user.role) {
      case 'admin':
        return 'Panel Admin';
      case 'company':
        return 'Dashboard Empresa';
      case 'recruiter':
        return 'Dashboard Reclutador';
      case 'specialist':
        return 'Dashboard Especialista';
      case 'candidate':
        return 'Mis Postulaciones';
      case 'user':
        return 'Mis Aplicaciones';
      default:
        return 'Dashboard';
    }
  };

  const getInitials = () => {
    if (!user) return 'U';

    if (user.nombre) {
      const names = user.nombre.split(' ');
      if (names.length >= 2) {
        return (names[0][0] + names[1][0]).toUpperCase();
      }
      return user.nombre.substring(0, 2).toUpperCase();
    }

    return user.email.substring(0, 2).toUpperCase();
  };

  const getRoleLabel = () => {
    if (!user) return '';

    switch (user.role) {
      case 'admin':
        return 'Administrador';
      case 'company':
        return 'Empresa';
      case 'recruiter':
        return 'Reclutador';
      case 'specialist':
        return 'Especialista';
      case 'candidate':
        return 'Candidato';
      case 'user':
        return 'Usuario';
      default:
        return '';
    }
  };

  const getLinkClass = (path: string) => {
    return pathname === path
      ? 'text-white bg-button-dark-green px-4 py-2 rounded-full cursor-default'
      : 'px-4 py-2 rounded-full bg-transparent text-text-black hover:bg-button-dark-green hover:text-white transition-colors';
  };

  return (
    <nav className="fixed top-0 left-0 w-full bg-custom-beige py-2 z-50">
      <div className="container mx-auto flex justify-between items-center px-4">
        {/* Logo */}
        <Link href="/">
          <Image src={logo} alt="INAKAT" className="w-24 md:w-32" priority />
        </Link>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2 text-title-dark"
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
        </button>

        {/* Desktop Menu */}
        <ul className="hidden md:flex space-x-4 lg:space-x-6 items-center">
          <li>
            <Link href="/" className={getLinkClass('/')}>
              INICIO
            </Link>
          </li>
          <li>
            <Link href="/about" className={getLinkClass('/about')}>
              SOBRE NOSOTROS
            </Link>
          </li>
          <li>
            <Link href="/companies" className={getLinkClass('/companies')}>
              EMPRESAS
            </Link>
          </li>
          <li>
            <Link href="/talents" className={getLinkClass('/talents')}>
              TALENTOS
            </Link>
          </li>
          <li>
            <Link href="/contact" className={getLinkClass('/contact')}>
              CONTACTO
            </Link>
          </li>

          {/* User Menu o Login Button */}
          <li>
            {user ? (
              // User Dropdown
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-2 bg-button-orange text-white px-4 py-2 rounded-full hover:bg-opacity-90 transition-colors"
                >
                  <div className="w-8 h-8 bg-white text-button-orange rounded-full flex items-center justify-center font-bold text-sm">
                    {getInitials()}
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 transition-transform ${
                      dropdownOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {/* Dropdown Menu */}
                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-[min(420px,90vw)] bg-white rounded-lg shadow-lg py-2 border border-gray-200">
                    {/* User Info */}
                    <div className="px-4 py-2 border-b border-gray-200">
                      <p className="text-sm font-semibold text-gray-900">
                        {user.nombre || user.email}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {user.email}
                      </p>
                      <p className="text-xs text-button-orange font-medium mt-1">
                        {getRoleLabel()}
                      </p>

                      {/* 💰 Mostrar créditos solo para empresas */}
                      {user.role === 'company' && (
                        <div className="mt-2 pt-2 border-t border-gray-100">
                          <p className="text-xs text-gray-600 flex items-center gap-1">
                            <svg
                              className="w-4 h-4 text-green-600"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                              />
                            </svg>
                            <span className="font-bold text-green-600">
                              {user.credits} créditos
                            </span>
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Dashboard Link */}
                    <Link
                      href={getDashboardLink()}
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      <User className="w-4 h-4" />
                      {getDashboardLabel()}
                    </Link>

                    {/* Mi Perfil - Para todos los usuarios autenticados */}
                    <Link
                      href="/profile"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                      Mi Perfil
                    </Link>

                    {/* Panel Vendedor - Solo para admin, recruiter, specialist, vendor */}
                    {['admin', 'recruiter', 'specialist', 'vendor'].includes(user.role) && (
                      <Link
                        href="/vendor/dashboard"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"
                          />
                        </svg>
                        Panel Vendedor
                      </Link>
                    )}

                    {/* Menú Admin completo */}
                    {user.role === 'admin' && (
                      <>
                        {/* Separador antes del grid */}
                        <div className="border-t border-gray-200 my-1"></div>

                        {/* Grid de 2 columnas para opciones admin */}
                        <div className="grid grid-cols-2 gap-1">
                        {/* Solicitudes de Empresas */}
                        <Link
                          href="/admin/requests"
                          onClick={() => setDropdownOpen(false)}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                            />
                          </svg>
                          Solicitudes Empresas
                        </Link>

                        {/* Aplicaciones Directas - OCULTO: No se usa actualmente (MEJ-006)
                        <Link
                          href="/admin/direct-applications"
                          onClick={() => setDropdownOpen(false)}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                            />
                          </svg>
                          Aplicaciones Directas
                        </Link>
                        */}

                        {/* Vacantes */}
                        <Link
                          href="/admin"
                          onClick={() => setDropdownOpen(false)}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                            />
                          </svg>
                          Vacantes
                        </Link>

                        {/* Candidatos */}
                        <Link
                          href="/admin/candidates"
                          onClick={() => setDropdownOpen(false)}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                            />
                          </svg>
                          Candidatos
                        </Link>

                        {/* Asignar Candidatos */}
                        <Link
                          href="/admin/assign-candidates"
                          onClick={() => setDropdownOpen(false)}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                            />
                          </svg>
                          Asignar Candidatos
                        </Link>

                        {/* Asignar Reclutadores/Especialistas a Vacantes */}
                        <Link
                          href="/admin/assignments"
                          onClick={() => setDropdownOpen(false)}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                            />
                          </svg>
                          Asignar Equipo
                        </Link>

                        {/* Usuarios */}
                        <Link
                          href="/admin/users"
                          onClick={() => setDropdownOpen(false)}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                            />
                          </svg>
                          Usuarios
                        </Link>

                        {/* Especialidades */}
                        <Link
                          href="/admin/specialties"
                          onClick={() => setDropdownOpen(false)}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                            />
                          </svg>
                          Especialidades
                        </Link>

                        {/* Precios */}
                        <Link
                          href="/admin/pricing"
                          onClick={() => setDropdownOpen(false)}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                          Precios
                        </Link>

                        {/* Paquetes de Créditos */}
                        <Link
                          href="/admin/credit-packages"
                          onClick={() => setDropdownOpen(false)}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                            />
                          </svg>
                          Paquetes de Créditos
                        </Link>

                        {/* Aplicaciones (todas) */}
                        <Link
                          href="/applications"
                          onClick={() => setDropdownOpen(false)}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                            />
                          </svg>
                          Aplicaciones
                        </Link>

                        {/* Vendedores */}
                        <Link
                          href="/admin/vendors"
                          onClick={() => setDropdownOpen(false)}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"
                            />
                          </svg>
                          Vendedores
                        </Link>
                        </div>
                        {/* Fin del grid de 2 columnas */}
                      </>
                    )}

                    {/* Menú Candidato */}
                    {user.role === 'candidate' && (
                      <>
                        {/* Mis Postulaciones */}
                        <Link
                          href="/candidate/applications"
                          onClick={() => setDropdownOpen(false)}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                            />
                          </svg>
                          Mis Postulaciones
                        </Link>
                      </>
                    )}

                    {/* Opciones adicionales para empresas */}
                    {user.role === 'company' && (
                      <>
                        {/* Separador */}
                        <div className="border-t border-gray-100 my-1"></div>

                        {/* Perfil de Empresa */}
                        <Link
                          href="/company/profile"
                          onClick={() => setDropdownOpen(false)}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                            />
                          </svg>
                          Perfil de Empresa
                        </Link>

                        {/* Comprar Créditos */}
                        <Link
                          href="/credits/purchase"
                          onClick={() => setDropdownOpen(false)}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-orange-50 transition-colors"
                        >
                          <svg
                            className="w-4 h-4 text-button-orange"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                          <span className="font-medium text-button-orange">
                            Comprar Créditos
                          </span>
                        </Link>
                      </>
                    )}

                    {/* Logout */}
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors border-t border-gray-100"
                    >
                      <LogOut className="w-4 h-4" />
                      Cerrar Sesión
                    </button>
                  </div>
                )}
              </div>
            ) : (
              // Login Button
              <Link
                href="/login"
                className="bg-button-orange text-white px-4 py-2 rounded-full hover:bg-opacity-90 transition-colors"
              >
                Iniciar Sesión
              </Link>
            )}
          </li>
        </ul>
      </div>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden absolute top-full left-0 w-full bg-custom-beige shadow-lg border-t border-gray-200">
          <div className="container mx-auto px-4 py-4">
            <ul className="flex flex-col space-y-2">
              <li>
                <Link
                  href="/"
                  className={getLinkClass('/')}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  INICIO
                </Link>
              </li>
              <li>
                <Link
                  href="/about"
                  className={getLinkClass('/about')}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  SOBRE NOSOTROS
                </Link>
              </li>
              <li>
                <Link
                  href="/companies"
                  className={getLinkClass('/companies')}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  EMPRESAS
                </Link>
              </li>
              <li>
                <Link
                  href="/talents"
                  className={getLinkClass('/talents')}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  TALENTOS
                </Link>
              </li>
              <li>
                <Link
                  href="/contact"
                  className={getLinkClass('/contact')}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  CONTACTO
                </Link>
              </li>

              {/* Mobile User Menu / Login */}
              <li className="pt-4 border-t border-gray-200">
                {user ? (
                  <div className="space-y-2">
                    {/* User Info */}
                    <div className="px-4 py-2 bg-white rounded-lg">
                      <p className="text-sm font-semibold text-gray-900">
                        {user.nombre || user.email}
                      </p>
                      <p className="text-xs text-button-orange font-medium">
                        {getRoleLabel()}
                      </p>
                      {user.role === 'company' && (
                        <p className="text-xs text-green-600 font-bold mt-1">
                          {user.credits} créditos
                        </p>
                      )}
                    </div>

                    {/* Dashboard Link */}
                    <Link
                      href={getDashboardLink()}
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-sm bg-button-green text-white rounded-lg"
                    >
                      <User className="w-4 h-4" />
                      {getDashboardLabel()}
                    </Link>

                    {/* Mi Perfil */}
                    <Link
                      href="/profile"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
                    >
                      Mi Perfil
                    </Link>

                    {/* Company specific links */}
                    {user.role === 'company' && (
                      <>
                        <Link
                          href="/company/profile"
                          onClick={() => setMobileMenuOpen(false)}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
                        >
                          Perfil de Empresa
                        </Link>
                        <Link
                          href="/credits/purchase"
                          onClick={() => setMobileMenuOpen(false)}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-button-orange font-medium hover:bg-orange-50 rounded-lg"
                        >
                          Comprar Créditos
                        </Link>
                      </>
                    )}

                    {/* Logout */}
                    <button
                      onClick={() => {
                        handleLogout();
                        setMobileMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <LogOut className="w-4 h-4" />
                      Cerrar Sesión
                    </button>
                  </div>
                ) : (
                  <Link
                    href="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block w-full text-center bg-button-orange text-white px-4 py-3 rounded-full hover:bg-opacity-90 transition-colors"
                  >
                    Iniciar Sesión
                  </Link>
                )}
              </li>
            </ul>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
