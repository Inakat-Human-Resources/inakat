'use client';

import React, { useState } from 'react';
import { X } from 'lucide-react';

interface ApplyJobModalProps {
  jobId: number;
  jobTitle: string;
  company: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const ApplyJobModal = ({
  jobId,
  jobTitle,
  company,
  isOpen,
  onClose,
  onSuccess
}: ApplyJobModalProps) => {
  const [formData, setFormData] = useState({
    candidateName: '',
    candidateEmail: '',
    candidatePhone: '',
    coverLetter: ''
  });

  const [cvFile, setCvFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      let cvUrl = null;

      // 1. Subir CV si existe
      if (cvFile) {
        const cvFormData = new FormData();
        cvFormData.append('file', cvFile);

        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          body: cvFormData
        });

        if (!uploadRes.ok) {
          throw new Error('Error al subir CV');
        }

        const uploadData = await uploadRes.json();
        cvUrl = uploadData.url;
      }

      // 2. Crear aplicación
      const response = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId,
          candidateName: formData.candidateName,
          candidateEmail: formData.candidateEmail,
          candidatePhone: formData.candidatePhone || null,
          coverLetter: formData.coverLetter || null,
          cvUrl
        })
      });

      const data = await response.json();

      if (data.success) {
        // Resetear formulario
        setFormData({
          candidateName: '',
          candidateEmail: '',
          candidatePhone: '',
          coverLetter: ''
        });
        setCvFile(null);

        onSuccess();
        onClose();
      } else {
        setError(data.error || 'Error al enviar aplicación');
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Error al procesar la solicitud'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-start p-6 border-b">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Aplicar a Vacante
            </h2>
            <p className="text-gray-600 mt-1">
              {jobTitle} - {company}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={24} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}

          <div className="space-y-4">
            {/* Nombre completo */}
            <div>
              <label className="block text-sm font-semibold mb-2">
                Nombre Completo *
              </label>
              <input
                type="text"
                value={formData.candidateName}
                onChange={(e) =>
                  setFormData({ ...formData, candidateName: e.target.value })
                }
                placeholder="Juan Pérez García"
                className="w-full p-3 border border-gray-300 rounded-lg"
                required
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-semibold mb-2">
                Email *
              </label>
              <input
                type="email"
                value={formData.candidateEmail}
                onChange={(e) =>
                  setFormData({ ...formData, candidateEmail: e.target.value })
                }
                placeholder="juan.perez@email.com"
                className="w-full p-3 border border-gray-300 rounded-lg"
                required
              />
            </div>

            {/* Teléfono */}
            <div>
              <label className="block text-sm font-semibold mb-2">
                Teléfono (opcional)
              </label>
              <input
                type="tel"
                value={formData.candidatePhone}
                onChange={(e) =>
                  setFormData({ ...formData, candidatePhone: e.target.value })
                }
                placeholder="81 1234 5678"
                className="w-full p-3 border border-gray-300 rounded-lg"
              />
            </div>

            {/* CV */}
            <div>
              <label className="block text-sm font-semibold mb-2">
                Curriculum Vitae (opcional)
              </label>
              <input
                type="file"
                onChange={(e) => setCvFile(e.target.files?.[0] || null)}
                accept=".pdf,.doc,.docx"
                className="w-full p-3 border border-gray-300 rounded-lg"
              />
              <p className="text-xs text-gray-500 mt-1">
                Formatos aceptados: PDF, DOC, DOCX (máx. 5MB)
              </p>
              {cvFile && (
                <p className="text-sm text-green-600 mt-2">
                  ✓ Archivo seleccionado: {cvFile.name}
                </p>
              )}
            </div>

            {/* Carta de presentación */}
            <div>
              <label className="block text-sm font-semibold mb-2">
                Carta de Presentación (opcional)
              </label>
              <textarea
                value={formData.coverLetter}
                onChange={(e) =>
                  setFormData({ ...formData, coverLetter: e.target.value })
                }
                placeholder="Cuéntanos por qué eres el candidato ideal para esta posición..."
                rows={6}
                className="w-full p-3 border border-gray-300 rounded-lg resize-none"
              />
            </div>
          </div>

          {/* Botones */}
          <div className="flex gap-4 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-semibold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-6 py-3 bg-button-green text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
            >
              {isSubmitting ? 'Enviando...' : 'Enviar Aplicación'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ApplyJobModal;
