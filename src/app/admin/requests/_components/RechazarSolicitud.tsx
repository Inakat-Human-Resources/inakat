// RUTA: src/app/admin/requests/_components/RechazarSolicitud.tsx
'use client';

/**
 * Confirmación de rechazo de una solicitud de empresa, con motivo opcional.
 *
 * Presentación nueva de src/components/sections/admin/RejectModal.tsx (ya borrado) con la
 * MISMA lógica: al confirmar llama a onConfirm(id, motivo recortado o
 * undefined). La página hace el PATCH de siempre.
 *
 * Los textos de ayuda dicen lo que de verdad pasa (PATCH
 * /api/company-requests/[id]): el motivo le llega a la empresa en su
 * notificación y en el correo, y rechazar desactiva su cuenta.
 */

import React, { useState } from 'react';
import { AlertTriangle, XCircle } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import FormField, { Textarea } from '@/components/ui/FormField';

interface RechazarSolicitudProps {
  requestId: number;
  companyName: string;
  onConfirm: (id: number, reason?: string) => void | Promise<void>;
  onCancel: () => void;
}

export default function RechazarSolicitud({ requestId, companyName, onConfirm, onCancel }: RechazarSolicitudProps) {
  const [rejectionReason, setRejectionReason] = useState('');
  // Sólo presentación: el botón muestra que se está enviando y no admite un
  // segundo clic mientras tanto.
  const [enviando, setEnviando] = useState(false);

  const handleSubmit = async () => {
    setEnviando(true);
    try {
      await onConfirm(requestId, rejectionReason.trim() || undefined);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal
      abierto
      alCerrar={onCancel}
      tamano="sm"
      iconoTitulo={<AlertTriangle size={20} className="text-danger" aria-hidden="true" />}
      titulo="Rechazar solicitud"
      descripcion="Al rechazarla, la cuenta de la empresa se desactiva y no podrá iniciar sesión."
      // Con un motivo a medio escribir, un clic fuera no lo tira.
      cerrarAlPulsarFondo={false}
      pie={
        <>
          <Button variante="contorno" onClick={onCancel} disabled={enviando}>
            Cancelar
          </Button>
          <Button variante="peligro" icono={XCircle} onClick={handleSubmit} cargando={enviando} textoCargando="Rechazando…">
            Rechazar solicitud
          </Button>
        </>
      }
    >
      <div className="rounded-xl border border-line bg-paper px-4 py-3">
        <p className="font-semibold text-ink">{companyName}</p>
        <p className="text-[13px] text-ink-muted tabular-nums">Solicitud #{requestId}</p>
      </div>

      <FormField
        etiqueta="Motivo del rechazo"
        opcional
        ayuda="La empresa lo recibirá en su notificación y por correo."
        className="mt-5"
      >
        <Textarea
          value={rejectionReason}
          onChange={(e) => setRejectionReason(e.target.value)}
          placeholder="Por ejemplo: el RFC no coincide con la constancia de situación fiscal."
          rows={4}
          className="resize-none"
        />
      </FormField>
    </Modal>
  );
}
