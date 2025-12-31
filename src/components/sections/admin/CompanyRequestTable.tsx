"use client";

import React from "react";

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
  createdAt: string;
  updatedAt: string;
}

interface CompanyRequestTableProps {
  data: CompanyRequest[];
  onEdit: (id: number) => void;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
  isLoading?: boolean;
}

const CompanyRequestTable = ({
  data,
  onEdit,
  onApprove,
  onReject,
  isLoading = false,
}: CompanyRequestTableProps) => {
  if (isLoading) {
    return (
      <div className="text-center py-10">
        <p className="text-gray-600">Cargando solicitudes...</p>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-10">
        <p className="text-gray-600">No hay solicitudes pendientes</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <h2 className="text-2xl font-bold mb-4">Solicitudes de alta</h2>
      <table className="min-w-full bg-white rounded-lg shadow">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-3 text-left">Nombre</th>
            <th className="p-3 text-left">Apellido Paterno</th>
            <th className="p-3 text-left">Apellido Materno</th>
            <th className="p-3 text-left">Empresa</th>
            <th className="p-3 text-left">RFC</th>
            <th className="p-3 text-left">Correo</th>
            <th className="p-3 text-left">Status</th>
            <th className="p-3 text-center">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {data.map((req) => (
            <tr key={req.id} className="border-t">
              <td className="p-3">{req.nombre}</td>
              <td className="p-3">{req.apellidoPaterno}</td>
              <td className="p-3">{req.apellidoMaterno}</td>
              <td className="p-3">{req.nombreEmpresa}</td>
              <td className="p-3">{req.rfc}</td>
              <td className="p-3">{req.correoEmpresa}</td>
              <td className="p-3">
                <span
                  className={`px-2 py-1 rounded text-sm ${
                    req.status === "pending"
                      ? "bg-yellow-200 text-yellow-800"
                      : req.status === "approved"
                      ? "bg-green-200 text-green-800"
                      : "bg-red-200 text-red-800"
                  }`}
                >
                  {req.status === "pending"
                    ? "Pendiente"
                    : req.status === "approved"
                    ? "Aprobado"
                    : "Rechazado"}
                </span>
              </td>
              <td className="p-3 flex justify-center gap-2">
                <button
                  onClick={() => onEdit(req.id)}
                  className="bg-blue-100 hover:bg-blue-200 text-blue-800 font-semibold px-4 py-1 rounded"
                >
                  {req.status === 'pending' ? 'Ver/Editar' : 'Ver'}
                </button>
                {req.status === "pending" && (
                  <>
                    <button
                      onClick={() => onReject(req.id)}
                      className="bg-red-500 hover:bg-red-600 text-white font-semibold px-4 py-1 rounded"
                    >
                      Rechazar
                    </button>
                    <button
                      onClick={() => onApprove(req.id)}
                      className="bg-green-500 hover:bg-green-600 text-white font-semibold px-4 py-1 rounded"
                    >
                      Aprobar
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default CompanyRequestTable;
