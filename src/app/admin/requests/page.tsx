"use client";

import React, { useState, useEffect } from "react";
import CompanyRequestTable from "@/components/sections/admin/CompanyRequestTable";

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

export default function AdminRequestsPage() {
  const [requests, setRequests] = useState<CompanyRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<CompanyRequest | null>(
    null
  );

  // Fetch requests from API
  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/company-requests");
      const data = await response.json();

      if (response.ok) {
        setRequests(data.data);
      } else {
        setError(data.error || "Error al cargar solicitudes");
      }
    } catch (error) {
      setError("Error al conectar con el servidor");
      console.error("Error fetching requests:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (id: number) => {
    const request = requests.find((req) => req.id === id);
    if (request) {
      setSelectedRequest(request);
    }
  };

  const handleApprove = async (id: number) => {
    try {
      const response = await fetch(`/api/company-requests/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "approved" }),
      });

      if (response.ok) {
        // Refresh the list
        await fetchRequests();
        alert("Solicitud aprobada exitosamente");
      } else {
        const data = await response.json();
        alert(data.error || "Error al aprobar solicitud");
      }
    } catch (error) {
      console.error("Error approving request:", error);
      alert("Error al aprobar solicitud");
    }
  };

  const handleReject = async (id: number) => {
    if (!confirm("¿Está seguro que desea rechazar esta solicitud?")) {
      return;
    }

    try {
      const response = await fetch(`/api/company-requests/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "rejected" }),
      });

      if (response.ok) {
        // Refresh the list
        await fetchRequests();
        alert("Solicitud rechazada");
      } else {
        const data = await response.json();
        alert(data.error || "Error al rechazar solicitud");
      }
    } catch (error) {
      console.error("Error rejecting request:", error);
      alert("Error al rechazar solicitud");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto py-10 px-4">
        <h1 className="text-3xl font-bold mb-6">Panel de Administración</h1>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <CompanyRequestTable
          data={requests}
          onEdit={handleEdit}
          onApprove={handleApprove}
          onReject={handleReject}
          isLoading={isLoading}
        />

        {/* Modal para ver detalles */}
        {selectedRequest && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <h2 className="text-2xl font-bold mb-4">
                Detalles de la Solicitud
              </h2>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold text-gray-700">
                    Datos del Usuario
                  </h3>
                  <p>
                    <strong>Nombre:</strong> {selectedRequest.nombre}
                  </p>
                  <p>
                    <strong>Apellido Paterno:</strong>{" "}
                    {selectedRequest.apellidoPaterno}
                  </p>
                  <p>
                    <strong>Apellido Materno:</strong>{" "}
                    {selectedRequest.apellidoMaterno}
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-700">
                    Datos de la Empresa
                  </h3>
                  <p>
                    <strong>Nombre:</strong> {selectedRequest.nombreEmpresa}
                  </p>
                  <p>
                    <strong>Correo:</strong> {selectedRequest.correoEmpresa}
                  </p>
                  <p>
                    <strong>RFC:</strong> {selectedRequest.rfc}
                  </p>
                </div>

                <div className="col-span-2">
                  <p>
                    <strong>Razón Social:</strong>{" "}
                    {selectedRequest.razonSocial}
                  </p>
                  <p>
                    <strong>Dirección:</strong>{" "}
                    {selectedRequest.direccionEmpresa}
                  </p>
                  {selectedRequest.sitioWeb && (
                    <p>
                      <strong>Sitio Web:</strong>{" "}
                      <a
                        href={selectedRequest.sitioWeb}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {selectedRequest.sitioWeb}
                      </a>
                    </p>
                  )}
                </div>

                <div className="col-span-2">
                  <p>
                    <strong>Status:</strong>{" "}
                    <span
                      className={`px-2 py-1 rounded text-sm ${
                        selectedRequest.status === "pending"
                          ? "bg-yellow-200 text-yellow-800"
                          : selectedRequest.status === "approved"
                          ? "bg-green-200 text-green-800"
                          : "bg-red-200 text-red-800"
                      }`}
                    >
                      {selectedRequest.status === "pending"
                        ? "Pendiente"
                        : selectedRequest.status === "approved"
                        ? "Aprobado"
                        : "Rechazado"}
                    </span>
                  </p>
                  <p className="text-sm text-gray-600 mt-2">
                    Creado:{" "}
                    {new Date(selectedRequest.createdAt).toLocaleString(
                      "es-MX"
                    )}
                  </p>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2">
                {selectedRequest.status === "pending" && (
                  <>
                    <button
                      onClick={() => {
                        handleReject(selectedRequest.id);
                        setSelectedRequest(null);
                      }}
                      className="bg-red-500 hover:bg-red-600 text-white font-semibold px-6 py-2 rounded"
                    >
                      Rechazar
                    </button>
                    <button
                      onClick={() => {
                        handleApprove(selectedRequest.id);
                        setSelectedRequest(null);
                      }}
                      className="bg-green-500 hover:bg-green-600 text-white font-semibold px-6 py-2 rounded"
                    >
                      Aprobar
                    </button>
                  </>
                )}
                <button
                  onClick={() => setSelectedRequest(null)}
                  className="bg-gray-300 hover:bg-gray-400 text-black font-semibold px-6 py-2 rounded"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
