'use client';

import React, { useState, useEffect } from 'react';
import { Search, Filter, RefreshCw } from 'lucide-react';
import CompanyRequestTable from '@/components/sections/admin/CompanyRequestTable';
import RequestDetailModal from '@/components/sections/admin/RequestDetailModal';
import RejectModal from '@/components/sections/admin/RejectModal';

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

export default function AdminRequestsPage() {
  const [requests, setRequests] = useState<CompanyRequest[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<CompanyRequest[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });

  // Modales
  const [selectedRequest, setSelectedRequest] = useState<CompanyRequest | null>(
    null
  );
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [requestToReject, setRequestToReject] = useState<CompanyRequest | null>(
    null
  );

  // Filtros
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch requests from API
  useEffect(() => {
    fetchRequests();
  }, []);

  // Aplicar filtros cuando cambian
  useEffect(() => {
    applyFilters();
  }, [requests, statusFilter, searchQuery]);

  const fetchRequests = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/company-requests');
      const data = await response.json();

      if (response.ok) {
        setRequests(data.data);
      } else {
        setError(data.error || 'Error al cargar solicitudes');
      }
    } catch (error) {
      setError('Error al conectar con el servidor');
      console.error('Error fetching requests:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...requests];

    // Filtrar por estado
    if (statusFilter !== 'all') {
      filtered = filtered.filter((req) => req.status === statusFilter);
    }

    // Filtrar por búsqueda
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (req) =>
          req.nombreEmpresa.toLowerCase().includes(query) ||
          req.rfc.toLowerCase().includes(query) ||
          req.correoEmpresa.toLowerCase().includes(query) ||
          req.nombre.toLowerCase().includes(query)
      );
    }

    setFilteredRequests(filtered);
  };

  const handleViewDetails = (id: number) => {
    const request = requests.find((req) => req.id === id);
    if (request) {
      setSelectedRequest(request);
    }
  };

  const handleApprove = async (id: number) => {
    if (!confirm('¿Estás seguro que deseas aprobar esta solicitud?')) {
      return;
    }

    try {
      const response = await fetch(`/api/company-requests/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: 'approved' })
      });

      if (response.ok) {
        await fetchRequests();
        setSelectedRequest(null);
        setNotification({ type: 'success', message: 'Solicitud aprobada exitosamente' });
      } else {
        const data = await response.json();
        setNotification({ type: 'error', message: data.error || 'Error al aprobar solicitud' });
      }
    } catch (error) {
      console.error('Error approving request:', error);
      setNotification({ type: 'error', message: 'Error al aprobar solicitud' });
    }
  };

  const handleRejectClick = (id: number) => {
    const request = requests.find((req) => req.id === id);
    if (request) {
      setRequestToReject(request);
      setRejectModalOpen(true);
      setSelectedRequest(null); // Cerrar modal de detalles si está abierto
    }
  };

  const handleRejectConfirm = async (id: number, reason?: string) => {
    try {
      const response = await fetch(`/api/company-requests/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: 'rejected',
          rejectionReason: reason || null
        })
      });

      if (response.ok) {
        await fetchRequests();
        setRejectModalOpen(false);
        setRequestToReject(null);
        setNotification({ type: 'success', message: 'Solicitud rechazada' });
      } else {
        const data = await response.json();
        setNotification({ type: 'error', message: data.error || 'Error al rechazar solicitud' });
      }
    } catch (error) {
      console.error('Error rejecting request:', error);
      setNotification({ type: 'error', message: 'Error al rechazar solicitud' });
    }
  };

  // Estadísticas
  const stats = {
    total: requests.length,
    pending: requests.filter((r) => r.status === 'pending').length,
    approved: requests.filter((r) => r.status === 'approved').length,
    rejected: requests.filter((r) => r.status === 'rejected').length
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto py-8 px-4">
        {/* HEADER - Responsive */}
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl md:text-4xl font-bold text-gray-800 mb-1 md:mb-2">
            Solicitudes de Empresas
          </h1>
          <p className="text-gray-600 text-sm md:text-base">
            Gestiona las solicitudes de registro
          </p>
        </div>

        {/* Notificación */}
        {notification.type && (
          <div
            className={`mb-6 p-4 rounded-lg flex items-center justify-between ${
              notification.type === 'success'
                ? 'bg-green-100 text-green-800 border border-green-300'
                : 'bg-red-100 text-red-800 border border-red-300'
            }`}
          >
            <span>{notification.message}</span>
            <button
              onClick={() => setNotification({ type: null, message: '' })}
              className="ml-4 hover:opacity-70 text-xl"
            >
              ×
            </button>
          </div>
        )}

        {/* ESTADÍSTICAS - Responsive */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
            <p className="text-sm text-gray-600 mb-1">Total</p>
            <p className="text-3xl font-bold text-gray-800">{stats.total}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-yellow-500">
            <p className="text-sm text-gray-600 mb-1">Pendientes</p>
            <p className="text-3xl font-bold text-yellow-600">
              {stats.pending}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
            <p className="text-sm text-gray-600 mb-1">Aprobadas</p>
            <p className="text-3xl font-bold text-green-600">
              {stats.approved}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-red-500">
            <p className="text-sm text-gray-600 mb-1">Rechazadas</p>
            <p className="text-3xl font-bold text-red-600">{stats.rejected}</p>
          </div>
        </div>

        {/* FILTROS Y BÚSQUEDA */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Búsqueda */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Buscar por empresa, RFC, correo o nombre..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Filtro por estado */}
            <div className="flex items-center gap-2">
              <Filter className="text-gray-400 w-5 h-5" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">Todos los estados</option>
                <option value="pending">Pendientes</option>
                <option value="approved">Aprobadas</option>
                <option value="rejected">Rechazadas</option>
              </select>
            </div>

            {/* Botón refrescar */}
            <button
              onClick={fetchRequests}
              disabled={isLoading}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              <RefreshCw
                className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`}
              />
              Refrescar
            </button>
          </div>
        </div>

        {/* ERROR MESSAGE */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-6">
            <p className="font-semibold">Error</p>
            <p>{error}</p>
          </div>
        )}

        {/* TABLA */}
        <div className="bg-white rounded-lg shadow">
          <CompanyRequestTable
            data={filteredRequests}
            onEdit={handleViewDetails}
            onApprove={handleApprove}
            onReject={handleRejectClick}
            isLoading={isLoading}
          />
        </div>

        {/* INFO DE RESULTADOS */}
        {!isLoading && filteredRequests.length === 0 && !error && (
          <div className="text-center py-10 bg-white rounded-lg shadow mt-6">
            <p className="text-gray-600">
              {searchQuery || statusFilter !== 'all'
                ? 'No se encontraron solicitudes que coincidan con los filtros'
                : 'No hay solicitudes registradas'}
            </p>
          </div>
        )}

        {!isLoading && filteredRequests.length > 0 && (
          <div className="mt-4 text-center text-sm text-gray-600">
            Mostrando {filteredRequests.length} de {requests.length} solicitudes
          </div>
        )}
      </div>

      {/* MODAL DE DETALLES */}
      {selectedRequest && (
        <RequestDetailModal
          request={selectedRequest}
          onClose={() => setSelectedRequest(null)}
          onApprove={handleApprove}
          onReject={handleRejectClick}
        />
      )}

      {/* MODAL DE RECHAZO */}
      {rejectModalOpen && requestToReject && (
        <RejectModal
          requestId={requestToReject.id}
          companyName={requestToReject.nombreEmpresa}
          onConfirm={handleRejectConfirm}
          onCancel={() => {
            setRejectModalOpen(false);
            setRequestToReject(null);
          }}
        />
      )}
    </div>
  );
}
