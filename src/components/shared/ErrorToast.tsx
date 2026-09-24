// RUTA: src/components/shared/ErrorToast.tsx
'use client';

import React from 'react';
import Toast from '@/components/ui/Toast';

interface ErrorToastProps {
  message: string | null;
  onClose: () => void;
  duration?: number;
}

/**
 * Puente con la firma de siempre hacia el Toast del sistema de diseño
 * (src/components/ui/Toast.tsx), que ya se anuncia como alerta (role="alert",
 * aria-live="assertive") y conserva el arreglo del temporizador huérfano.
 * Al rehacer una pantalla, importa directamente '@/components/ui/Toast'.
 */
const ErrorToast: React.FC<ErrorToastProps> = ({ message, onClose, duration = 8000 }) => (
  <Toast tono="error" mensaje={message} alCerrar={onClose} duracion={duration} />
);

export default ErrorToast;
