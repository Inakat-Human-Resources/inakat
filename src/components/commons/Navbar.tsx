// RUTA: src/components/commons/Navbar.tsx

'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import { LogOut, User, ChevronDown, Menu, X, Bell } from 'lucide-react';
import logo from '@/assets/images/logo/logo.png';
import NotificationBell from '@/components/shared/NotificationBell';
import { AUTH_REFRESH_EVENT } from '@/lib/auth-events';

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
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const mobileButtonRef = useRef<HTMLButtonElement>(null);
  const userButtonRef = useRef<HTMLButtonElement>(null);

  // Verificar autenticación llamando al endpoint /api/auth/me.
  // Se declara fuera del efecto porque la sesión se revalida desde varios
  // disparadores, no sólo al cambiar de ruta.
  const checkAuth = useCallback(async () => {
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
        } else {
          setUser(null);
        }
      } else {
        // Si no está autenticado, limpiar el estado
        setUser(null);
      }
    } catch (error) {
      console.error('Error checking auth:', error);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [pathname, checkAuth]);

  // Revalidar la sesión SIN cambiar de ruta: si no, publicar una vacante
  // (descuenta créditos) o guardar el perfil dejaba el menú del avatar con el
  // saldo y el nombre viejos. Cualquier pantalla puede avisar con
  // notifyAuthChanged() de '@/lib/auth-events'. Al recuperar el foco también,
  // para detectar sesiones caducadas con la pestaña abierta.
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') checkAuth();
    };

    window.addEventListener(AUTH_REFRESH_EVENT, checkAuth);
    window.addEventListener('focus', checkAuth);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener(AUTH_REFRESH_EVENT, checkAuth);
      window.removeEventListener('focus', checkAuth);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [checkAuth]);

  // Cerrar ambos menús al navegar (logo, botón atrás/adelante, redirecciones):
  // antes el drawer móvil seguía desplegado sobre la página nueva.
  useEffect(() => {
    setMobileMenuOpen(false);
    setDropdownOpen(false);
  }, [pathname]);

  // Cerrar dropdown y drawer al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      if (dropdownRef.current && !dropdownRef.current.contains(target)) {
        setDropdownOpen(false);
      }

      if (
        mobileMenuRef.current &&
        !mobileMenuRef.current.contains(target) &&
        !(mobileButtonRef.current?.contains(target) ?? false)
      ) {
        setMobileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Escape cierra el menú abierto y devuelve el foco a su botón (a11y).
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;

      setDropdownOpen((open) => {
        if (open) userButtonRef.current?.focus();
        return false;
      });
      setMobileMenuOpen((open) => {
        if (open) mobileButtonRef.current?.focus();
        return false;
      });
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleLogout = async () => {
    try {
      // Llamar al endpoint de logout
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });

      if (!response.ok) {
        // La cookie auth-token es httpOnly: si el servidor no la borró, el
        // cliente NO puede hacerlo. Dar la sesión por cerrada dejaría la sesión
        // viva en un equipo compartido, así que se avisa y no se redirige.
        console.error('Error logging out: response not ok');
        setLogoutError('No se pudo cerrar la sesión. Inténtalo de nuevo.');
        return;
      }
    } catch (error) {
      console.error('Error logging out:', error);
      setLogoutError('No se pudo cerrar la sesión. Revisa tu conexión.');
      return;
    }

    // Sólo si el servidor confirmó el cierre: limpiar estado local y redirigir
    setLogoutError(null);
    setUser(null);
    setDropdownOpen(false);
    setMobileMenuOpen(false);
    router.push('/');
    router.refresh();
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
      case 'vendor':
        return '/vendor/dashboard';
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
      case 'vendor':
        return 'Panel Vendedor';
      default:
        return 'Dashboard';
    }
  };

  const getInitials = () => {
    if (!user) return 'U';

    // Normalizar espacios: "Ana " o "Juan  Carlos" daban "AUNDEFINED" y un
    // nombre de sólo espacios lanzaba TypeError en el render. Como el Navbar
    // vive en el layout raíz, eso tumbaba la app entera para esa cuenta.
    const partes = (user.nombre ?? '').trim().split(/\s+/).filter(Boolean);

    if (partes.length >= 2) {
      return (partes[0][0] + partes[1][0]).toUpperCase();
    }

    if (partes.length === 1) {
      return partes[0].slice(0, 2).toUpperCase();
    }

    return (user.email || '').slice(0, 2).toUpperCase() || 'U';
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
      case 'vendor':
        return 'Vendedor';
      default:
        return '';
    }
  };

  // Marca el enlace de la ruta actual para lectores de pantalla: antes la
  // página activa sólo se distinguía por color (a11y).
  const getAriaCurrent = (path: string): 'page' | undefined =>
    pathname === path ? 'page' : undefined;

  // whitespace-nowrap: la píldora es un <a> inline y, si el texto se partía en
  // dos renglones, el fondo redondeado se fragmentaba.
  const getLinkClass = (path: string) => {
    return pathname === path
      ? 'whitespace-nowrap text-white bg-button-dark-green px-4 py-2 rounded-full cursor-default'
      : 'whitespace-nowrap px-4 py-2 rounded-full bg-transparent text-text-black hover:bg-button-dark-green hover:text-white transition-colors';
  };

  return (
    <nav className="fixed top-0 left-0 w-full bg-custom-beige py-2 z-50">
      <div className="container mx-auto flex justify-between items-center px-4">
        {/* Logo */}
        <Link href="/" onClick={() => setMobileMenuOpen(false)}>
          <Image src={logo} alt="INAKAT" className="w-24 md:w-32" priority />
        </Link>

        {/* Mobile Menu Button */}
        <button
          ref={mobileButtonRef}
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="lg:hidden p-2 text-title-dark"
          aria-label={mobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={mobileMenuOpen}
          aria-controls="menu-movil"
        >
          {mobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
        </button>

        {/* Desktop Menu: desde lg, no md. Entre 768 y ~1000px los 6 enlaces y el
            botón de sesión no cabían: se partían en dos renglones y el último
            quedaba fuera de pantalla, sin scroll posible en un nav fijo. */}
        <ul className="hidden lg:flex space-x-3 xl:space-x-6 items-center">
          <li>
            <Link
              href="/"
              className={getLinkClass('/')}
              aria-current={getAriaCurrent('/')}
            >
              INICIO
            </Link>
          </li>
          <li>
            <Link
              href="/about"
              className={getLinkClass('/about')}
              aria-current={getAriaCurrent('/about')}
            >
              SOBRE NOSOTROS
            </Link>
          </li>
          <li>
            <Link
              href="/companies"
              className={getLinkClass('/companies')}
              aria-current={getAriaCurrent('/companies')}
            >
              EMPRESAS
            </Link>
          </li>
          <li>
            <Link
              href="/talents"
              className={getLinkClass('/talents')}
              aria-current={getAriaCurrent('/talents')}
            >
              TALENTOS
            </Link>
          </li>
          <li>
            <Link
              href="/contact"
              className={getLinkClass('/contact')}
              aria-current={getAriaCurrent('/contact')}
            >
              CONTACTO
            </Link>
          </li>

          {/* Campanita de Notificaciones */}
          {user && (
            <li>
              <NotificationBell />
            </li>
          )}

          {/* User Menu o Login Button */}
          <li>
            {user ? (
              // User Dropdown
              <div className="relative" ref={dropdownRef}>
                <button
                  ref={userButtonRef}
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-2 bg-button-orange text-white px-4 py-2 rounded-full hover:bg-opacity-90 transition-colors"
                  aria-label={`Menú de cuenta de ${user.nombre || user.email}`}
                  aria-haspopup="menu"
                  aria-expanded={dropdownOpen}
                  aria-controls="menu-cuenta"
                >
                  <div
                    className="w-8 h-8 bg-white text-button-orange rounded-full flex items-center justify-center font-bold text-sm"
                    aria-hidden="true"
                  >
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
                  // max-h + scroll como en el drawer móvil: el menú de admin es
                  // más alto que un viewport bajo y "Cerrar Sesión" quedaba
                  // inalcanzable al colgar de un nav position:fixed.
                  <div
                    id="menu-cuenta"
                    className="absolute right-0 mt-2 w-[min(420px,90vw)] bg-white rounded-lg shadow-lg py-2 border border-gray-200 max-h-[calc(100vh-5rem)] overflow-y-auto overscroll-contain"
                  >
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

                    {/* Dashboard Link - No mostrar para admin porque "Vacantes" ya va a /admin */}
                    {user.role !== 'admin' && (
                      <Link
                        href={getDashboardLink()}
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                      >
                        <User className="w-4 h-4" />
                        {getDashboardLabel()}
                      </Link>
                    )}

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

                    {/* Panel Vendedor - Sólo para admin: el vendor ya llega
                        por su propio enlace de Dashboard (getDashboardLink) */}
                    {user.role === 'admin' && (
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

                    {/* Menú Admin - Grid 2 columnas */}
                    {user.role === 'admin' && (
                      <>
                        <div className="border-t border-gray-200 my-1"></div>
                        <div className="grid grid-cols-2 gap-x-1 gap-y-0">
                          {/* === SECCIÓN: Reclutamiento === */}
                          <p className="col-span-2 px-4 pt-2 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">Reclutamiento</p>

                          <Link
                            href="/admin"
                            onClick={() => setDropdownOpen(false)}
                            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            Vacantes
                          </Link>

                          <Link
                            href="/admin/assignments"
                            onClick={() => setDropdownOpen(false)}
                            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                            </svg>
                            Asignar Equipo
                          </Link>

                          <Link
                            href="/admin/assign-candidates"
                            onClick={() => setDropdownOpen(false)}
                            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                            </svg>
                            Asignar Candidatos
                          </Link>

                          <Link
                            href="/admin/interviews"
                            onClick={() => setDropdownOpen(false)}
                            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            Gestión Entrevistas
                          </Link>

                          <Link
                            href="/admin/direct-applications"
                            onClick={() => setDropdownOpen(false)}
                            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                            </svg>
                            Candidatos Interesados
                          </Link>

                          {/* === SECCIÓN: Empresas y Comercial === */}
                          <div className="col-span-2 border-t border-gray-100 my-1"></div>
                          <p className="col-span-2 px-4 pt-1 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">Empresas y Comercial</p>

                          <Link
                            href="/admin/requests"
                            onClick={() => setDropdownOpen(false)}
                            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                            Empresas
                          </Link>

                          <Link
                            href="/admin/vendors"
                            onClick={() => setDropdownOpen(false)}
                            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                            </svg>
                            Vendedores
                          </Link>

                          <Link
                            href="/admin/credit-packages"
                            onClick={() => setDropdownOpen(false)}
                            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                            </svg>
                            Paquetes de Créditos
                          </Link>

                          <Link
                            href="/admin/pricing"
                            onClick={() => setDropdownOpen(false)}
                            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Precios
                          </Link>

                          {/* === SECCIÓN: Sistema === */}
                          <div className="col-span-2 border-t border-gray-100 my-1"></div>
                          <p className="col-span-2 px-4 pt-1 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">Sistema</p>

                          <Link
                            href="/admin/candidates"
                            onClick={() => setDropdownOpen(false)}
                            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                            Candidatos
                          </Link>

                          <Link
                            href="/admin/users"
                            onClick={() => setDropdownOpen(false)}
                            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                            </svg>
                            Usuarios
                          </Link>

                          <Link
                            href="/admin/specialties"
                            onClick={() => setDropdownOpen(false)}
                            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                            </svg>
                            Especialidades
                          </Link>

                          {/* PLAT-002: la bandeja de mensajes de contacto. */}
                          <Link
                            href="/admin/contact-messages"
                            onClick={() => setDropdownOpen(false)}
                            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            Mensajes de contacto
                          </Link>
                        </div>
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

                        {/* Mis Entrevistas */}
                        <Link
                          href="/company/interviews"
                          onClick={() => setDropdownOpen(false)}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          Mis Entrevistas
                        </Link>

                        {/* Integraciones (API keys y webhooks del puente Worky2) */}
                        <Link
                          href="/company/integrations"
                          onClick={() => setDropdownOpen(false)}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 010 5.656l-3 3a4 4 0 11-5.656-5.656l1.5-1.5m4.5-4.5l1.5-1.5a4 4 0 115.656 5.656l-3 3a4 4 0 01-5.656 0" />
                          </svg>
                          Integraciones
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

                    {logoutError && (
                      <p
                        role="alert"
                        className="px-4 py-2 text-xs text-red-600 bg-red-50"
                      >
                        {logoutError}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              // Login Button
              <Link
                href="/login"
                className="whitespace-nowrap bg-button-orange text-white px-4 py-2 rounded-full hover:bg-opacity-90 transition-colors"
              >
                Iniciar Sesión
              </Link>
            )}
          </li>
        </ul>
      </div>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div
          id="menu-movil"
          ref={mobileMenuRef}
          className="lg:hidden absolute top-full left-0 w-full bg-custom-beige shadow-lg border-t border-gray-200 max-h-[80vh] overflow-y-auto"
        >
          <div className="container mx-auto px-4 py-4">
            <ul className="flex flex-col space-y-2">
              <li>
                <Link
                  href="/"
                  className={getLinkClass('/')}
                  aria-current={getAriaCurrent('/')}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  INICIO
                </Link>
              </li>
              <li>
                <Link
                  href="/about"
                  className={getLinkClass('/about')}
                  aria-current={getAriaCurrent('/about')}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  SOBRE NOSOTROS
                </Link>
              </li>
              <li>
                <Link
                  href="/companies"
                  className={getLinkClass('/companies')}
                  aria-current={getAriaCurrent('/companies')}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  EMPRESAS
                </Link>
              </li>
              <li>
                <Link
                  href="/talents"
                  className={getLinkClass('/talents')}
                  aria-current={getAriaCurrent('/talents')}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  TALENTOS
                </Link>
              </li>
              <li>
                <Link
                  href="/contact"
                  className={getLinkClass('/contact')}
                  aria-current={getAriaCurrent('/contact')}
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

                    {/* Notificaciones (mobile) */}
                    <Link
                      href="/notifications"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
                    >
                      <Bell className="w-4 h-4" />
                      Notificaciones
                    </Link>

                    {/* Dashboard Link - No mostrar para admin porque "Vacantes" ya va a /admin */}
                    {user.role !== 'admin' && (
                      <Link
                        href={getDashboardLink()}
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 text-sm bg-button-green text-white rounded-lg"
                      >
                        <User className="w-4 h-4" />
                        {getDashboardLabel()}
                      </Link>
                    )}

                    {/* Mi Perfil */}
                    <Link
                      href="/profile"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
                    >
                      Mi Perfil
                    </Link>

                    {/* Panel Vendedor (admin): el vendor ya llega por su propio
                        enlace de Dashboard. En móvil no existía ninguna ruta
                        hacia /vendor/dashboard. */}
                    {user.role === 'admin' && (
                      <Link
                        href="/vendor/dashboard"
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
                      >
                        Panel Vendedor
                      </Link>
                    )}

                    {/* Admin specific links (mobile) */}
                    {user.role === 'admin' && (
                      <>
                        <div className="border-t border-gray-200 my-2"></div>
                        <p className="px-4 py-1 text-xs font-semibold text-gray-400 uppercase">Reclutamiento</p>
                        <Link href="/admin" onClick={() => setMobileMenuOpen(false)}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">
                          Vacantes
                        </Link>
                        <Link href="/admin/assignments" onClick={() => setMobileMenuOpen(false)}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">
                          Asignar Equipo
                        </Link>
                        <Link href="/admin/assign-candidates" onClick={() => setMobileMenuOpen(false)}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">
                          Asignar Candidatos
                        </Link>
                        <Link href="/admin/interviews" onClick={() => setMobileMenuOpen(false)}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">
                          Gestión Entrevistas
                        </Link>
                        <Link href="/admin/direct-applications" onClick={() => setMobileMenuOpen(false)}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">
                          Candidatos Interesados
                        </Link>

                        <div className="border-t border-gray-100 my-1"></div>
                        <p className="px-4 py-1 text-xs font-semibold text-gray-400 uppercase">Empresas</p>
                        <Link href="/admin/requests" onClick={() => setMobileMenuOpen(false)}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">
                          Empresas
                        </Link>
                        <Link href="/admin/vendors" onClick={() => setMobileMenuOpen(false)}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">
                          Vendedores
                        </Link>
                        <Link href="/admin/credit-packages" onClick={() => setMobileMenuOpen(false)}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">
                          Paquetes de Créditos
                        </Link>
                        <Link href="/admin/pricing" onClick={() => setMobileMenuOpen(false)}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">
                          Precios
                        </Link>

                        <div className="border-t border-gray-100 my-1"></div>
                        <p className="px-4 py-1 text-xs font-semibold text-gray-400 uppercase">Sistema</p>
                        <Link href="/admin/candidates" onClick={() => setMobileMenuOpen(false)}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">
                          Candidatos
                        </Link>
                        <Link href="/admin/users" onClick={() => setMobileMenuOpen(false)}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">
                          Usuarios
                        </Link>
                        <Link href="/admin/specialties" onClick={() => setMobileMenuOpen(false)}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">
                          Especialidades
                        </Link>
                        <Link href="/admin/contact-messages" onClick={() => setMobileMenuOpen(false)}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">
                          Mensajes de contacto
                        </Link>
                      </>
                    )}

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
                          href="/company/integrations"
                          onClick={() => setMobileMenuOpen(false)}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
                        >
                          Integraciones
                        </Link>
                        <Link
                          href="/company/interviews"
                          onClick={() => setMobileMenuOpen(false)}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
                        >
                          Mis Entrevistas
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

                    {/* Logout: el menú sólo se cierra si el servidor confirmó
                        el cierre (lo hace handleLogout), no siempre. */}
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <LogOut className="w-4 h-4" />
                      Cerrar Sesión
                    </button>

                    {logoutError && (
                      <p
                        role="alert"
                        className="px-4 py-2 text-xs text-red-600 bg-red-50 rounded-lg"
                      >
                        {logoutError}
                      </p>
                    )}
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
