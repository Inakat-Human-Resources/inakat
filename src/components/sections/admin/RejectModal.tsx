'use client';

import React, { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';

interface RejectModalProps {
  requestId: number;
  companyName: string;
  onConfirm: (id: number, reason?: string) => void;
  onCancel: () => void;
}

const RejectModal = ({
  requestId,
  companyName,
  onConfirm,
  onCancel
}: RejectModalProps) => {
  const [rejectionReason, setRejectionReason] = useState('');

  const handleSubmit = () => {
    onConfirm(requestId, rejectionReason.trim() || undefined);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
        {/* HEADER */}
        <div className="bg-red-500 text-white px-6 py-4 rounded-t-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6" />
            <h2 className="text-xl font-bold">Rechazar Solicitud</h2>
          </div>
          <button
            onClick={onCancel}
            aria-label="Cerrar"
            className="p-1 hover:bg-red-600 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* CONTENT */}
        <div className="p-6 space-y-4">
          <p className="text-gray-700">
            ¿Estás seguro que deseas <strong>rechazar</strong> la solicitud de:
          </p>

          <div className="bg-gray-100 rounded-lg p-3 border-l-4 border-red-500">
            <p className="font-semibold text-gray-800">{companyName}</p>
            <p className="text-sm text-gray-600">ID: #{requestId}</p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Razón de rechazo (opcional)
            </label>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Describe por qué se rechaza esta solicitud..."
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
            />
            <p className="text-xs text-gray-500 mt-1">
              Esta razón será visible para referencia futura
            </p>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <p className="text-sm text-yellow-800">
              ⚠️ <strong>Nota:</strong> Esta acción no se puede deshacer
              fácilmente.
            </p>
          </div>
        </div>

        {/* FOOTER */}
        <div className="bg-gray-50 px-6 py-4 rounded-b-xl flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-5 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            className="px-5 py-2 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg transition-colors"
          >
            Rechazar Solicitud
          </button>
        </div>
      </div>
    </div>
  );
};

export default RejectModal;
