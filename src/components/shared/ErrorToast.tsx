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

  useEffect(() => {
    if (message) {
      setIsVisible(true);
      if (duration > 0) {
        const timer = setTimeout(() => {
          setIsVisible(false);
          setTimeout(() => onCloseRef.current(), 300);
        }, duration);
        return () => clearTimeout(timer);
      }
    } else {
      setIsVisible(false);
    }
  }, [message, duration]);

  if (!message) return null;

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => onCloseRef.current(), 300);
  };

  return (
    <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-[9999] max-w-lg w-[calc(100%-2rem)] transition-all duration-300 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'}`}>
      <div className="bg-red-600 text-white px-6 py-4 rounded-xl shadow-2xl flex items-start gap-3 border border-red-700">
        <AlertCircle className="flex-shrink-0 mt-0.5" size={22} />
        <p className="flex-1 font-medium text-sm md:text-base">{message}</p>
        <button onClick={handleClose} className="flex-shrink-0 hover:bg-red-700 rounded-full p-1 transition-colors">
          <X size={18} />
        </button>
      </div>
    </div>
  );
};

export default ErrorToast;
