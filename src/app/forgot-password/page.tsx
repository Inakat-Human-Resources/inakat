// RUTA: src/app/forgot-password/page.tsx

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Mail, ArrowLeft, Loader2, CheckCircle } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await res.json();

      if (data.success) {
        setSent(true);
      } else {
        setError(data.error || 'Error al enviar solicitud');
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
        {sent ? (
          <div className="text-center">
            <CheckCircle className="mx-auto text-green-500 mb-4" size={48} />
            <h2 className="text-xl font-bold text-gray-800 mb-2">Correo enviado</h2>
            <p className="text-gray-600 mb-6">
              Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.
            </p>
            <Link
              href="/login"
              className="text-blue-600 hover:underline flex items-center justify-center gap-2"
            >
              <ArrowLeft size={16} />
              Volver al login
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">¿Olvidaste tu contraseña?</h1>
            <p className="text-gray-600 mb-6">
              Ingresa tu correo electrónico y te enviaremos un enlace para restablecerla.
            </p>

            {error && (
              <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Correo electrónico
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="tu@correo.com"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="animate-spin" size={18} />
                    Enviando...
                  </>
                ) : (
                  'Enviar enlace'
                )}
              </button>
            </form>

            <div className="mt-4 text-center">
              <Link
                href="/login"
                className="text-sm text-gray-600 hover:underline flex items-center justify-center gap-1"
              >
                <ArrowLeft size={14} />
                Volver al login
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
