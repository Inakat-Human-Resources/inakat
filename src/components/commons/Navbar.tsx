// RUTA: src/components/commons/Navbar.tsx

'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import { LogOut, User, ChevronDown } from 'lucide-react';
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
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });
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
        return '/admin/requests';
      case 'company':
        return '/company/dashboard';
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
    <nav className="fixed top-0 left-0 w-full bg-custom-beige py-10 md:py-12 z-50">
      <div className="container mx-auto flex justify-between items-center">
        {/* Logo */}
        <Link href="/">
          <Image src={logo} alt="INAKAT" className="w-32" priority />
        </Link>

        {/* Menu */}
        <ul className="flex space-x-4 md:space-x-6 items-center">
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
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg py-2 border border-gray-200">
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

                    {/* 👥 Gestión Candidatos - Solo para admin */}
                    {user.role === 'admin' && (
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
                        Gestión Candidatos
                      </Link>
                    )}

                    {/* Comprar Créditos - Solo para empresas */}
                    {user.role === 'company' && (
                      <Link
                        href="/credits/purchase"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-orange-50 transition-colors border-t border-gray-100"
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
    </nav>
  );
};

export default Navbar;
