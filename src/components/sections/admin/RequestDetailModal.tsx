'use client';

import React, { useState } from 'react';
import { X, FileText, Image as ImageIcon, ExternalLink, Pencil, Save, XCircle } from 'lucide-react';

interface CompanyRequest {
  id: number;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  nombreEmpresa: string;
  correoEmpresa: string;
  sitioWeb: string | null;
  razonSocial: string;
  rfc: string;
  direccionEmpresa: string;
  identificacionUrl: string | null;
  documentosConstitucionUrl: string | null;
  status: string;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
}

interface RequestDetailModalProps {
  request: CompanyRequest;
  onClose: () => void;
  onApprove?: (id: number) => void;
  onReject?: (id: number) => void;
  onUpdate?: () => void;
}

const RequestDetailModal = ({
  request,
  onClose,
  onApprove,
  onReject,
  onUpdate
}: RequestDetailModalProps) => {
  // Estados para modo edición
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editedData, setEditedData] = useState({
    nombre: request.nombre,
    apellidoPaterno: request.apellidoPaterno,
    apellidoMaterno: request.apellidoMaterno,
    nombreEmpresa: request.nombreEmpresa,
    correoEmpresa: request.correoEmpresa,
    sitioWeb: request.sitioWeb || '',
    razonSocial: request.razonSocial,
    rfc: request.rfc,
    direccionEmpresa: request.direccionEmpresa,
  });
  const [saveError, setSaveError] = useState<string | null>(null);

  // Función para guardar cambios
  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);
    try {
      const response = await fetch(`/api/company-requests/${request.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editedData),
      });

      if (response.ok) {
        setIsEditing(false);
        if (onUpdate) onUpdate();
        onClose();
      } else {
        const data = await response.json();
        setSaveError(data.error || 'Error al guardar cambios');
      }
    } catch (error) {
      console.error('Error al guardar:', error);
      setSaveError('Error de conexión al guardar');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setSaveError(null);
    // Restaurar datos originales
    setEditedData({
      nombre: request.nombre,
      apellidoPaterno: request.apellidoPaterno,
      apellidoMaterno: request.apellidoMaterno,
      nombreEmpresa: request.nombreEmpresa,
      correoEmpresa: request.correoEmpresa,
      sitioWeb: request.sitioWeb || '',
      razonSocial: request.razonSocial,
      rfc: request.rfc,
      direccionEmpresa: request.direccionEmpresa,
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      approved: 'bg-green-100 text-green-800 border-green-300',
      rejected: 'bg-red-100 text-red-800 border-red-300'
    };

    const labels = {
      pending: 'Pendiente',
      approved: 'Aprobado',
      rejected: 'Rechazado'
    };

    return (
      <span
        className={`px-3 py-1 rounded-full text-sm font-semibold border ${
          styles[status as keyof typeof styles]
        }`}
      >
        {labels[status as keyof typeof labels]}
      </span>
    );
  };

  const openFile = (url: string) => {
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* HEADER */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">
              Solicitud #{request.id}
            </h2>
            <p className="text-sm text-gray-500">
              Creada el {formatDate(request.createdAt)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {getStatusBadge(request.status)}
            {request.status === 'pending' && !isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-1 px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg text-sm font-medium transition-colors"
              >
                <Pencil className="w-4 h-4" />
                Editar
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* CONTENT */}
        <div className="p-6 space-y-6">
          {/* DATOS DEL REPRESENTANTE */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
              👤 Datos del Representante
              {isEditing && <span className="text-sm font-normal text-blue-600">(Editando)</span>}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-gray-500 uppercase mb-1">Nombre</p>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedData.nombre}
                    onChange={(e) => setEditedData(prev => ({ ...prev, nombre: e.target.value }))}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <p className="font-medium text-gray-800">{request.nombre}</p>
                )}
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase mb-1">Apellido Paterno</p>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedData.apellidoPaterno}
                    onChange={(e) => setEditedData(prev => ({ ...prev, apellidoPaterno: e.target.value }))}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <p className="font-medium text-gray-800">{request.apellidoPaterno}</p>
                )}
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase mb-1">Apellido Materno</p>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedData.apellidoMaterno}
                    onChange={(e) => setEditedData(prev => ({ ...prev, apellidoMaterno: e.target.value }))}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <p className="font-medium text-gray-800">{request.apellidoMaterno}</p>
                )}
              </div>
            </div>
          </div>

          {/* DATOS DE LA EMPRESA */}
          <div className="bg-blue-50 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
              🏢 Datos de la Empresa
              {isEditing && <span className="text-sm font-normal text-blue-600">(Editando)</span>}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 uppercase mb-1">Nombre Comercial</p>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedData.nombreEmpresa}
                    onChange={(e) => setEditedData(prev => ({ ...prev, nombreEmpresa: e.target.value }))}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <p className="font-medium text-gray-800">{request.nombreEmpresa}</p>
                )}
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase mb-1">Razón Social</p>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedData.razonSocial}
                    onChange={(e) => setEditedData(prev => ({ ...prev, razonSocial: e.target.value }))}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <p className="font-medium text-gray-800">{request.razonSocial}</p>
                )}
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase mb-1">RFC</p>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedData.rfc}
                    onChange={(e) => setEditedData(prev => ({ ...prev, rfc: e.target.value.toUpperCase() }))}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono uppercase"
                    maxLength={13}
                  />
                ) : (
                  <p className="font-medium text-gray-800 font-mono">{request.rfc}</p>
                )}
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase mb-1">Correo Electrónico</p>
                {isEditing ? (
                  <input
                    type="email"
                    value={editedData.correoEmpresa}
                    onChange={(e) => setEditedData(prev => ({ ...prev, correoEmpresa: e.target.value }))}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <p className="font-medium text-gray-800">{request.correoEmpresa}</p>
                )}
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase mb-1">Sitio Web</p>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedData.sitioWeb}
                    onChange={(e) => setEditedData(prev => ({ ...prev, sitioWeb: e.target.value }))}
                    placeholder="https://www.ejemplo.com"
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                ) : request.sitioWeb ? (
                  <a
                    href={request.sitioWeb}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  >
                    {request.sitioWeb}
                    <ExternalLink className="w-4 h-4" />
                  </a>
                ) : (
                  <p className="text-gray-400 italic">No especificado</p>
                )}
              </div>
              <div className="md:col-span-2">
                <p className="text-xs text-gray-500 uppercase mb-1">Dirección</p>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedData.direccionEmpresa}
                    onChange={(e) => setEditedData(prev => ({ ...prev, direccionEmpresa: e.target.value }))}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <p className="font-medium text-gray-800">{request.direccionEmpresa}</p>
                )}
              </div>
            </div>
          </div>

          {/* DOCUMENTOS */}
          <div className="bg-green-50 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
              📄 Documentos
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Identificación */}
              <div>
                <p className="text-xs text-gray-500 uppercase mb-2">
                  Identificación
                </p>
                {request.identificacionUrl ? (
                  <button
                    onClick={() => openFile(request.identificacionUrl!)}
                    className="flex items-center gap-2 bg-white border border-gray-300 rounded-lg p-3 hover:bg-gray-50 transition-colors w-full"
                  >
                    {request.identificacionUrl.endsWith('.pdf') ? (
                      <FileText className="w-5 h-5 text-red-500" />
                    ) : (
                      <ImageIcon className="w-5 h-5 text-blue-500" />
                    )}
                    <span className="text-sm font-medium text-gray-700 flex-1 text-left truncate">
                      Ver Identificación
                    </span>
                    <ExternalLink className="w-4 h-4 text-gray-400" />
                  </button>
                ) : (
                  <p className="text-sm text-gray-500 italic">No disponible</p>
                )}
              </div>

              {/* Documentos de Constitución */}
              <div>
                <p className="text-xs text-gray-500 uppercase mb-2">
                  Documentos de Constitución
                </p>
                {request.documentosConstitucionUrl ? (
                  <button
                    onClick={() => openFile(request.documentosConstitucionUrl!)}
                    className="flex items-center gap-2 bg-white border border-gray-300 rounded-lg p-3 hover:bg-gray-50 transition-colors w-full"
                  >
                    {request.documentosConstitucionUrl.endsWith('.pdf') ? (
                      <FileText className="w-5 h-5 text-red-500" />
                    ) : (
                      <ImageIcon className="w-5 h-5 text-blue-500" />
                    )}
                    <span className="text-sm font-medium text-gray-700 flex-1 text-left truncate">
                      Ver Documentos
                    </span>
                    <ExternalLink className="w-4 h-4 text-gray-400" />
                  </button>
                ) : (
                  <p className="text-sm text-gray-500 italic">No disponible</p>
                )}
              </div>
            </div>
          </div>

          {/* INFORMACIÓN DE ESTADO */}
          {request.status === 'rejected' && request.rejectionReason && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-red-800 mb-2">
                ❌ Razón de Rechazo
              </h3>
              <p className="text-gray-700">{request.rejectionReason}</p>
            </div>
          )}

          {request.status === 'approved' && request.approvedAt && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-green-800 mb-2">
                ✅ Aprobado
              </h3>
              <p className="text-gray-700">
                Aprobado el {formatDate(request.approvedAt)}
              </p>
            </div>
          )}
        </div>

        {/* FOOTER CON ACCIONES */}
        {request.status === 'pending' && onApprove && onReject && (
          <div className="sticky bottom-0 bg-gray-50 border-t px-6 py-4">
            {saveError && (
              <div className="mb-3 p-2 bg-red-100 text-red-700 rounded-lg text-sm">
                {saveError}
              </div>
            )}
            <div className="flex justify-end gap-3">
              {isEditing ? (
                <>
                  <button
                    onClick={handleCancelEdit}
                    disabled={isSaving}
                    className="flex items-center gap-2 px-6 py-2 bg-gray-400 hover:bg-gray-500 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
                  >
                    <XCircle className="w-4 h-4" />
                    Cancelar
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex items-center gap-2 px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {isSaving ? 'Guardando...' : 'Guardar Cambios'}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => onReject(request.id)}
                    className="px-6 py-2 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg transition-colors"
                  >
                    Rechazar
                  </button>
                  <button
                    onClick={() => onApprove(request.id)}
                    className="px-6 py-2 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-lg transition-colors"
                  >
                    Aprobar
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {request.status !== 'pending' && (
          <div className="sticky bottom-0 bg-gray-50 border-t px-6 py-4 flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-500 hover:bg-gray-600 text-white font-semibold rounded-lg transition-colors"
            >
              Cerrar
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default RequestDetailModal;
