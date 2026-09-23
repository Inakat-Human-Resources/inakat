// RUTA: src/components/shared/ErrorToast.tsx
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { X, AlertCircle } from 'lucide-react';

interface ErrorToastProps {
  message: string | null;
  onClose: () => void;
  duration?: number;
}

const ErrorToast: React.FC<ErrorToastProps> = ({ message, onClose, duration = 8000 }) => {
  const [isVisible, setIsVisible] = useState(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  // Temporizador de la animación de salida. Iba suelto dentro del setTimeout
  // exterior, así que el cleanup no lo cancelaba: si llegaba un error NUEVO
  // durante esos 300 ms de desvanecido, el temporizador huérfano llamaba a
  // onClose y el padre borraba el mensaje recién mostrado (el usuario no
  // alcanzaba a leerlo).
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelarCierre = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  useEffect(() => {
    cancelarCierre();

    if (message) {
      setIsVisible(true);
      if (duration > 0) {
        const timer = setTimeout(() => {
          setIsVisible(false);
          closeTimerRef.current = setTimeout(() => onCloseRef.current(), 300);
        }, duration);
        return () => {
          clearTimeout(timer);
          cancelarCierre();
        };
      }
    } else {
      setIsVisible(false);
    }

    return cancelarCierre;
  }, [message, duration]);

  if (!message) return null;

  const handleClose = () => {
    setIsVisible(false);
    cancelarCierre();
    closeTimerRef.current = setTimeout(() => onCloseRef.current(), 300);
  };

  return (
    <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-[9999] max-w-lg w-[calc(100%-2rem)] transition-all duration-300 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'}`}>
      {/* role="alert": sin él, el error sólo existía visualmente durante 8 s y
          un lector de pantalla no anunciaba nada (login, registro, vacantes). */}
      <div
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className="bg-red-600 text-white px-6 py-4 rounded-xl shadow-2xl flex items-start gap-3 border border-red-700"
      >
        <AlertCircle className="flex-shrink-0 mt-0.5" size={22} aria-hidden="true" />
        <p className="flex-1 font-medium text-sm md:text-base">{message}</p>
        <button onClick={handleClose} aria-label="Cerrar aviso" className="flex-shrink-0 hover:bg-red-700 rounded-full p-1 transition-colors">
          <X size={18} />
        </button>
      </div>
    </div>
  );
};

export default ErrorToast;
