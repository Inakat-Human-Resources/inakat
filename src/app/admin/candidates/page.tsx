// RUTA: src/app/admin/candidates/page.tsx

'use client';

// FIX-02: Helper para asegurar que URLs externos tengan protocolo https://
const ensureUrl = (url: string) => url.startsWith('http') ? url : `https://${url}`;

import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  RefreshCw,
  Plus,
  Eye,
  Edit,
  Trash2,
  Download,
  ExternalLink,
  Users,
  Briefcase,
  GraduationCap,
  ChevronDown,
  X,
  FileText,
  Upload,
  Paperclip,
  Loader2
} from 'lucide-react';
import CandidateForm from '@/components/sections/admin/CandidateForm';

interface CandidateDocument {
  id: number;
  candidateId: number;
  name: string;
  fileUrl: string;
  fileType: string | null;
  createdAt: string;
}

// FEATURE: Educación múltiple
interface Education {
  id: number;
  nivel: string;
  institucion: string;
  carrera: string;
  añoInicio?: number | null;
  añoFin?: number | null;
  estatus: string;
}

interface Candidate {
  id: number;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string | null;
  email: string;
  telefono: string | null;
  sexo: string | null;
  fechaNacimiento: string | null;
  edad: number | null;
  universidad: string | null;
  carrera: string | null;
  nivelEstudios: string | null;
  educacion: string | null; // FEATURE: Educación múltiple (JSON string)
  profile: string | null;
  seniority: string | null;
  añosExperiencia: number;
  cvUrl: string | null;
  portafolioUrl: string | null;
  linkedinUrl: string | null;
  source: string;
  notas: string | null;
  status: string;
  createdAt: string;
  experiences: any[];
}

export default function AdminCandidatesPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });

  // Modal
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [candidateToEdit, setCandidateToEdit] = useState<Candidate | null>(
    null
  );
  const [candidateToView, setCandidateToView] = useState<Candidate | null>(
    null
  );

  // Estados para documentos
  const [documents, setDocuments] = useState<CandidateDocument[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [showAddDoc, setShowAddDoc] = useState(false);
  const [newDocName, setNewDocName] = useState('');
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);

  // Filtros
  const [showFilters, setShowFilters] = useState(false);
  const [search, setSearch] = useState('');
  const [sexoFilter, setSexoFilter] = useState('');
  const [universidadFilter, setUniversidadFilter] = useState('');
  const [profileFilter, setProfileFilter] = useState('');
  const [seniorityFilter, setSeniorityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [minAge, setMinAge] = useState('');
  const [maxAge, setMaxAge] = useState('');
  const [minExperience, setMinExperience] = useState('');
  const [maxExperience, setMaxExperience] = useState('');

  // Opciones para filtros
  const profiles = [
    'Tecnología',
    'Arquitectura',
    'Diseño Gráfico',
    'Producción Audiovisual',
    'Educación',
    'Administración de Oficina',
    'Finanzas'
  ];
  const seniorities = ['Practicante', 'Jr', 'Middle', 'Sr', 'Director'];
  const statuses = [
    { value: 'available', label: 'Disponible' },
    { value: 'in_process', label: 'En Proceso' },
    { value: 'hired', label: 'Contratado' },
    { value: 'inactive', label: 'Inactivo' }
  ];
  const sources = [
    { value: 'manual', label: 'Manual' },
    { value: 'linkedin', label: 'LinkedIn' },
    { value: 'occ', label: 'OCC' },
    { value: 'referido', label: 'Referido' }
  ];

  // Fetch candidates
  const fetchCandidates = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (sexoFilter) params.append('sexo', sexoFilter);
      if (universidadFilter) params.append('universidad', universidadFilter);
      if (profileFilter) params.append('profile', profileFilter);
      if (seniorityFilter) params.append('seniority', seniorityFilter);
      if (statusFilter) params.append('status', statusFilter);
      if (sourceFilter) params.append('source', sourceFilter);
      if (minAge) params.append('minAge', minAge);
      if (maxAge) params.append('maxAge', maxAge);
      if (minExperience) params.append('minExperience', minExperience);
      if (maxExperience) params.append('maxExperience', maxExperience);

      const response = await fetch(`/api/admin/candidates?${params}`);
      const data = await response.json();

      if (response.ok && data.success) {
        setCandidates(data.data);
      } else {
        setError(data.error || 'Error al cargar candidatos');
      }
    } catch (error) {
      setError('Error de conexión');
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCandidates();
  }, []);

  // Aplicar filtros
  const applyFilters = () => {
    fetchCandidates();
  };

  // Limpiar filtros
  const clearFilters = () => {
    setSearch('');
    setSexoFilter('');
    setUniversidadFilter('');
    setProfileFilter('');
    setSeniorityFilter('');
    setStatusFilter('');
    setSourceFilter('');
    setMinAge('');
    setMaxAge('');
    setMinExperience('');
    setMaxExperience('');
  };

  // Eliminar candidato
  const handleDelete = async (id: number) => {
    if (!confirm('¿Estás seguro de eliminar este candidato?')) return;

    try {
      const response = await fetch(`/api/admin/candidates/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        fetchCandidates();
        setNotification({ type: 'success', message: 'Candidato eliminado exitosamente' });
      } else {
        const data = await response.json();
        setNotification({ type: 'error', message: data.error || 'Error al eliminar' });
      }
    } catch (error) {
      setNotification({ type: 'error', message: 'Error de conexión' });
    }
  };

  // Editar candidato
  const handleEdit = (candidate: Candidate) => {
    setCandidateToEdit(candidate);
    setIsFormOpen(true);
  };

  // Ver candidato
  const handleView = async (candidate: Candidate) => {
    setCandidateToView(candidate);
    // Cargar documentos del candidato
    await fetchDocuments(candidate.id);
  };

  // Cargar documentos de un candidato
  const fetchDocuments = async (candidateId: number) => {
    try {
      setIsLoadingDocs(true);
      const response = await fetch(`/api/admin/candidates/${candidateId}/documents`);
      const data = await response.json();
      if (data.success) {
        setDocuments(data.data);
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setIsLoadingDocs(false);
    }
  };

  // Subir archivo y agregar documento
  const handleAddDocument = async (file: File) => {
    if (!candidateToView || !newDocName.trim()) return;

    try {
      setIsUploadingDoc(true);

      // 1. Subir archivo
      const formData = new FormData();
      formData.append('file', file);

      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      const uploadData = await uploadRes.json();

      if (!uploadData.success) {
        setNotification({ type: 'error', message: uploadData.error || 'Error al subir archivo' });
        return;
      }

      // 2. Crear documento en BD
      const docRes = await fetch(`/api/admin/candidates/${candidateToView.id}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newDocName.trim(),
          fileUrl: uploadData.url,
          fileType: file.type
        })
      });
      const docData = await docRes.json();

      if (docData.success) {
        setDocuments([docData.data, ...documents]);
        setNewDocName('');
        setShowAddDoc(false);
        setNotification({ type: 'success', message: 'Documento agregado exitosamente' });
      } else {
        setNotification({ type: 'error', message: docData.error || 'Error al guardar documento' });
      }
    } catch (error) {
      console.error('Error adding document:', error);
      setNotification({ type: 'error', message: 'Error al agregar documento' });
    } finally {
      setIsUploadingDoc(false);
    }
  };

  // Eliminar documento
  const handleDeleteDocument = async (docId: number) => {
    if (!candidateToView) return;
    if (!confirm('¿Eliminar este documento?')) return;

    try {
      const response = await fetch(
        `/api/admin/candidates/${candidateToView.id}/documents?documentId=${docId}`,
        { method: 'DELETE' }
      );
      const data = await response.json();

      if (data.success) {
        setDocuments(documents.filter(d => d.id !== docId));
        setNotification({ type: 'success', message: 'Documento eliminado' });
      } else {
        setNotification({ type: 'error', message: data.error || 'Error al eliminar' });
      }
    } catch (error) {
      console.error('Error deleting document:', error);
      setNotification({ type: 'error', message: 'Error al eliminar documento' });
    }
  };

  // Nuevo candidato
  const handleNew = () => {
    setCandidateToEdit(null);
    setIsFormOpen(true);
  };

  // Status badge
  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      available: 'bg-green-100 text-green-800',
      in_process: 'bg-yellow-100 text-yellow-800',
      hired: 'bg-blue-100 text-blue-800',
      inactive: 'bg-gray-100 text-gray-800'
    };
    const labels: Record<string, string> = {
      available: 'Disponible',
      in_process: 'En Proceso',
      hired: 'Contratado',
      inactive: 'Inactivo'
    };
    return (
      <span
        className={`px-2 py-1 rounded-full text-xs font-medium ${
          styles[status] || styles.inactive
        }`}
      >
        {labels[status] || status}
      </span>
    );
  };

  // Source badge
  const getSourceBadge = (source: string) => {
    const styles: Record<string, string> = {
      manual: 'bg-gray-100 text-gray-700',
      linkedin: 'bg-blue-100 text-blue-700',
      occ: 'bg-purple-100 text-purple-700',
      referido: 'bg-orange-100 text-orange-700'
    };
    return (
      <span
        className={`px-2 py-1 rounded-full text-xs font-medium ${
          styles[source] || styles.manual
        }`}
      >
        {source}
      </span>
    );
  };

  // FEATURE: Parsear educación múltiple
  const parseEducacion = (candidate: Candidate): Education[] => {
    if (candidate.educacion) {
      try {
        const parsed = JSON.parse(candidate.educacion);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch {
        // Si falla el parse, continuamos con fallback
      }
    }
    // Fallback: crear array con datos legacy si existen
    if (candidate.universidad || candidate.carrera || candidate.nivelEstudios) {
      return [{
        id: 1,
        nivel: candidate.nivelEstudios || '',
        institucion: candidate.universidad || '',
        carrera: candidate.carrera || '',
        añoInicio: null,
        añoFin: null,
        estatus: ''
      }];
    }
    return [];
  };

  // Stats
  const stats = {
    total: candidates.length,
    available: candidates.filter((c) => c.status === 'available').length,
    inProcess: candidates.filter((c) => c.status === 'in_process').length,
    hired: candidates.filter((c) => c.status === 'hired').length
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto py-8 px-4">
        {/* Header - Responsive */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-6 md:mb-8">
          <div>
            <h1 className="text-2xl md:text-4xl font-bold text-gray-800 mb-1 md:mb-2">
              Gestión de Candidatos
            </h1>
            <p className="text-gray-600 text-sm md:text-base">
              Inyecta candidatos de LinkedIn, OCC y otras fuentes
            </p>
          </div>
          <button
            onClick={handleNew}
            className="w-full sm:w-auto px-4 md:px-6 py-2 md:py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 font-semibold text-sm md:text-base"
          >
            <Plus size={18} />
            <span className="sm:inline">Nuevo Candidato</span>
          </button>
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
              className="ml-4 hover:opacity-70"
            >
              <X size={18} />
            </button>
          </div>
        )}

        {/* Stats - Responsive grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
            <div className="flex items-center gap-3">
              <Users className="text-blue-500" size={24} />
              <div>
                <p className="text-sm text-gray-600">Total</p>
                <p className="text-2xl font-bold text-gray-800">
                  {stats.total}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
            <div className="flex items-center gap-3">
              <Users className="text-green-500" size={24} />
              <div>
                <p className="text-sm text-gray-600">Disponibles</p>
                <p className="text-2xl font-bold text-green-600">
                  {stats.available}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-yellow-500">
            <div className="flex items-center gap-3">
              <Briefcase className="text-yellow-500" size={24} />
              <div>
                <p className="text-sm text-gray-600">En Proceso</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {stats.inProcess}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-purple-500">
            <div className="flex items-center gap-3">
              <GraduationCap className="text-purple-500" size={24} />
              <div>
                <p className="text-sm text-gray-600">Contratados</p>
                <p className="text-2xl font-bold text-purple-600">
                  {stats.hired}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                  size={20}
                />
                <input
                  type="text"
                  placeholder="Buscar por nombre, email, carrera..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Toggle Filters */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-4 py-2 border rounded-lg flex items-center gap-2 ${
                showFilters
                  ? 'bg-blue-50 border-blue-300 text-blue-700'
                  : 'hover:bg-gray-50'
              }`}
            >
              <Filter size={20} />
              Filtros
              <ChevronDown
                className={`transform transition-transform ${
                  showFilters ? 'rotate-180' : ''
                }`}
                size={16}
              />
            </button>

            {/* Search Button */}
            <button
              onClick={applyFilters}
              disabled={isLoading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <Search size={20} />
              Buscar
            </button>

            {/* Refresh */}
            <button
              onClick={fetchCandidates}
              disabled={isLoading}
              className="px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              <RefreshCw
                className={isLoading ? 'animate-spin' : ''}
                size={20}
              />
            </button>
          </div>

          {/* Expanded Filters */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Sexo */}
                <div>
                  <label className="block text-sm font-medium mb-1">Sexo</label>
                  <select
                    value={sexoFilter}
                    onChange={(e) => setSexoFilter(e.target.value)}
                    className="w-full p-2 border rounded-lg"
                  >
                    <option value="">Todos</option>
                    <option value="M">Masculino</option>
                    <option value="F">Femenino</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>

                {/* Universidad */}
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Universidad
                  </label>
                  <input
                    type="text"
                    value={universidadFilter}
                    onChange={(e) => setUniversidadFilter(e.target.value)}
                    placeholder="Ej: UANL, Tec..."
                    className="w-full p-2 border rounded-lg"
                  />
                </div>

                {/* Perfil */}
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Perfil
                  </label>
                  <select
                    value={profileFilter}
                    onChange={(e) => setProfileFilter(e.target.value)}
                    className="w-full p-2 border rounded-lg"
                  >
                    <option value="">Todos</option>
                    {profiles.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Seniority */}
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Nivel
                  </label>
                  <select
                    value={seniorityFilter}
                    onChange={(e) => setSeniorityFilter(e.target.value)}
                    className="w-full p-2 border rounded-lg"
                  >
                    <option value="">Todos</option>
                    {seniorities.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Status */}
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Estado
                  </label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full p-2 border rounded-lg"
                  >
                    <option value="">Todos</option>
                    {statuses.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Source */}
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Fuente
                  </label>
                  <select
                    value={sourceFilter}
                    onChange={(e) => setSourceFilter(e.target.value)}
                    className="w-full p-2 border rounded-lg"
                  >
                    <option value="">Todas</option>
                    {sources.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Edad */}
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Edad (min - max)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={minAge}
                      onChange={(e) => setMinAge(e.target.value)}
                      placeholder="Min"
                      min="18"
                      max="70"
                      className="w-1/2 p-2 border rounded-lg"
                    />
                    <input
                      type="number"
                      value={maxAge}
                      onChange={(e) => setMaxAge(e.target.value)}
                      placeholder="Max"
                      min="18"
                      max="70"
                      className="w-1/2 p-2 border rounded-lg"
                    />
                  </div>
                </div>

                {/* Experiencia */}
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Años Exp. (min - max)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={minExperience}
                      onChange={(e) => setMinExperience(e.target.value)}
                      placeholder="Min"
                      min="0"
                      max="40"
                      className="w-1/2 p-2 border rounded-lg"
                    />
                    <input
                      type="number"
                      value={maxExperience}
                      onChange={(e) => setMaxExperience(e.target.value)}
                      placeholder="Max"
                      min="0"
                      max="40"
                      className="w-1/2 p-2 border rounded-lg"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end mt-4">
                <button
                  onClick={clearFilters}
                  className="text-gray-500 hover:text-gray-700 text-sm"
                >
                  Limpiar filtros
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Candidates List */}
        {isLoading ? (
          <div className="bg-white rounded-lg shadow p-12 text-center text-gray-500">
            <RefreshCw className="animate-spin mx-auto mb-2" size={24} />
            Cargando candidatos...
          </div>
        ) : candidates.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center text-gray-500">
            <Users className="mx-auto mb-2 text-gray-400" size={40} />
            No hay candidatos registrados
          </div>
        ) : (
          <>
            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
              {candidates.map((candidate) => (
                <div key={candidate.id} className="bg-white rounded-lg shadow p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="font-semibold text-gray-900">
                        {candidate.nombre} {candidate.apellidoPaterno}
                        {candidate.sexo && (
                          <span className="ml-1 text-xs">
                            {candidate.sexo === 'M' ? '👨' : candidate.sexo === 'F' ? '👩' : '🧑'}
                          </span>
                        )}
                      </p>
                      <p className="text-sm text-gray-500 truncate">{candidate.email}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {getStatusBadge(candidate.status)}
                      {getSourceBadge(candidate.source)}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                    <div>
                      <span className="text-gray-500">Perfil:</span>{' '}
                      <span className="font-medium">{candidate.profile || '-'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Nivel:</span>{' '}
                      <span className="font-medium">{candidate.seniority || '-'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Exp:</span>{' '}
                      <span className="font-medium">{candidate.añosExperiencia} años</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Edad:</span>{' '}
                      <span className="font-medium">{candidate.edad || '-'}</span>
                    </div>
                  </div>

                  <div className="flex justify-end gap-1 pt-2 border-t">
                    <button
                      onClick={() => handleView(candidate)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                    >
                      <Eye size={18} />
                    </button>
                    <button
                      onClick={() => handleEdit(candidate)}
                      className="p-2 text-yellow-600 hover:bg-yellow-50 rounded"
                    >
                      <Edit size={18} />
                    </button>
                    {candidate.linkedinUrl && (
                      <a
                        href={ensureUrl(candidate.linkedinUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                      >
                        <ExternalLink size={18} />
                      </a>
                    )}
                    <button
                      onClick={() => handleDelete(candidate.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Candidato</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Contacto</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Perfil</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Educación</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Exp.</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Edad</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Estado</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Fuente</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {candidates.map((candidate) => (
                      <tr key={candidate.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-gray-900">
                              {candidate.nombre} {candidate.apellidoPaterno}
                            </p>
                            {candidate.sexo && (
                              <span className="text-xs text-gray-500">
                                {candidate.sexo === 'M' ? '👨' : candidate.sexo === 'F' ? '👩' : '🧑'}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-gray-600">{candidate.email}</p>
                          {candidate.telefono && (
                            <p className="text-xs text-gray-400">{candidate.telefono}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium">{candidate.profile || '-'}</p>
                          <p className="text-xs text-gray-500">{candidate.seniority || '-'}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm">{candidate.universidad || '-'}</p>
                          <p className="text-xs text-gray-500">{candidate.carrera || '-'}</p>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="font-medium">{candidate.añosExperiencia}</span>
                          <span className="text-xs text-gray-500"> años</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {candidate.edad ? <span>{candidate.edad}</span> : <span className="text-gray-400">-</span>}
                        </td>
                        <td className="px-4 py-3 text-center">{getStatusBadge(candidate.status)}</td>
                        <td className="px-4 py-3 text-center">{getSourceBadge(candidate.source)}</td>
                        <td className="px-4 py-3">
                          <div className="flex justify-center gap-1">
                            <button onClick={() => handleView(candidate)} className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded" title="Ver detalles">
                              <Eye size={18} />
                            </button>
                            <button onClick={() => handleEdit(candidate)} className="p-2 text-gray-500 hover:text-yellow-600 hover:bg-yellow-50 rounded" title="Editar">
                              <Edit size={18} />
                            </button>
                            {candidate.linkedinUrl && (
                              <a href={ensureUrl(candidate.linkedinUrl)} target="_blank" rel="noopener noreferrer" className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded" title="Ver LinkedIn">
                                <ExternalLink size={18} />
                              </a>
                            )}
                            <button onClick={() => handleDelete(candidate.id)} className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded" title="Eliminar">
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* Results count */}
        {!isLoading && candidates.length > 0 && (
          <div className="mt-4 text-center text-sm text-gray-600">
            Mostrando {candidates.length} candidato
            {candidates.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Form Modal */}
      <CandidateForm
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setCandidateToEdit(null);
        }}
        onSuccess={fetchCandidates}
        candidateToEdit={candidateToEdit}
      />

      {/* View Modal */}
      {candidateToView && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start p-6 border-b">
              <div>
                <h2 className="text-2xl font-bold">
                  {candidateToView.nombre} {candidateToView.apellidoPaterno}{' '}
                  {candidateToView.apellidoMaterno}
                </h2>
                <p className="text-gray-600">{candidateToView.email}</p>
              </div>
              <button
                onClick={() => {
                  setCandidateToView(null);
                  setDocuments([]);
                  setShowAddDoc(false);
                  setNewDocName('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Teléfono</p>
                  <p className="font-medium">
                    {candidateToView.telefono || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Edad</p>
                  <p className="font-medium">
                    {candidateToView.edad || '-'} años
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Perfil</p>
                  <p className="font-medium">
                    {candidateToView.profile || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Seniority</p>
                  <p className="font-medium">
                    {candidateToView.seniority || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Años de Experiencia</p>
                  <p className="font-medium">
                    {candidateToView.añosExperiencia}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Fuente</p>
                  <p className="font-medium">{candidateToView.source}</p>
                </div>
              </div>

              {/* FEATURE: Educación múltiple */}
              {parseEducacion(candidateToView).length > 0 && (
                <div>
                  <p className="text-sm text-gray-500 mb-2 flex items-center gap-2">
                    <GraduationCap size={16} />
                    Educación
                  </p>
                  <div className="space-y-2">
                    {parseEducacion(candidateToView).map((edu) => (
                      <div key={edu.id} className="bg-gray-50 p-3 rounded-lg">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium">{edu.carrera || 'Sin carrera'}</p>
                            <p className="text-sm text-gray-600">{edu.institucion || 'Sin institución'}</p>
                            {edu.nivel && (
                              <p className="text-xs text-gray-500">{edu.nivel}</p>
                            )}
                          </div>
                          {edu.estatus && (
                            <span className={`px-2 py-1 text-xs font-medium rounded ${
                              edu.estatus === 'Titulado' ? 'bg-green-100 text-green-700' :
                              edu.estatus === 'Terminado' ? 'bg-blue-100 text-blue-700' :
                              edu.estatus === 'Cursando' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {edu.estatus}
                            </span>
                          )}
                        </div>
                        {(edu.añoInicio || edu.añoFin) && (
                          <p className="text-xs text-gray-400 mt-1">
                            {edu.añoInicio || '?'} - {edu.añoFin || 'Presente'}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {candidateToView.notas && (
                <div>
                  <p className="text-sm text-gray-500">Notas</p>
                  <p className="bg-gray-50 p-3 rounded-lg">
                    {candidateToView.notas}
                  </p>
                </div>
              )}

              {candidateToView.experiences.length > 0 && (
                <div>
                  <p className="text-sm text-gray-500 mb-2">
                    Experiencia Laboral
                  </p>
                  <div className="space-y-3">
                    {candidateToView.experiences.map((exp: any, i: number) => (
                      <div key={i} className="bg-gray-50 p-3 rounded-lg">
                        <p className="font-medium">{exp.puesto}</p>
                        <p className="text-sm text-gray-600">{exp.empresa}</p>
                        <p className="text-xs text-gray-400">
                          {new Date(exp.fechaInicio).toLocaleDateString(
                            'es-MX'
                          )}{' '}
                          -
                          {exp.esActual
                            ? ' Actual'
                            : exp.fechaFin
                            ? ` ${new Date(exp.fechaFin).toLocaleDateString(
                                'es-MX'
                              )}`
                            : ''}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-4 border-t">
                {candidateToView.cvUrl && (
                  <a
                    href={ensureUrl(candidateToView.cvUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 flex items-center gap-2"
                  >
                    <Download size={16} />
                    Ver CV
                  </a>
                )}
                {candidateToView.linkedinUrl && (
                  <a
                    href={ensureUrl(candidateToView.linkedinUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 flex items-center gap-2"
                  >
                    <ExternalLink size={16} />
                    LinkedIn
                  </a>
                )}
                {candidateToView.portafolioUrl && (
                  <a
                    href={ensureUrl(candidateToView.portafolioUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 flex items-center gap-2"
                  >
                    <ExternalLink size={16} />
                    Portafolio
                  </a>
                )}
              </div>

              {/* Sección de Documentos */}
              <div className="pt-4 border-t">
                <div className="flex justify-between items-center mb-3">
                  <p className="text-sm text-gray-500 font-medium flex items-center gap-2">
                    <Paperclip size={16} />
                    Documentos Adicionales
                  </p>
                  <button
                    onClick={() => setShowAddDoc(!showAddDoc)}
                    className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  >
                    <Plus size={16} />
                    Agregar
                  </button>
                </div>

                {/* Formulario para agregar documento */}
                {showAddDoc && (
                  <div className="bg-gray-50 p-4 rounded-lg mb-3">
                    <div className="mb-3">
                      <label className="block text-sm font-medium mb-1">
                        Nombre del documento
                      </label>
                      <input
                        type="text"
                        value={newDocName}
                        onChange={(e) => setNewDocName(e.target.value)}
                        placeholder="Ej: CV Actualizado, Carta de Recomendación..."
                        className="w-full p-2 border rounded-lg text-sm"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                          isUploadingDoc
                            ? 'bg-gray-100 border-gray-300'
                            : newDocName.trim()
                            ? 'border-blue-300 hover:border-blue-500 hover:bg-blue-50'
                            : 'border-gray-300 bg-gray-100 cursor-not-allowed'
                        }`}
                      >
                        {isUploadingDoc ? (
                          <>
                            <Loader2 size={18} className="animate-spin" />
                            <span className="text-sm">Subiendo...</span>
                          </>
                        ) : (
                          <>
                            <Upload size={18} />
                            <span className="text-sm">
                              {newDocName.trim() ? 'Seleccionar archivo' : 'Ingresa nombre primero'}
                            </span>
                          </>
                        )}
                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png,.webp"
                          className="hidden"
                          disabled={!newDocName.trim() || isUploadingDoc}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleAddDocument(file);
                            e.target.value = '';
                          }}
                        />
                      </label>
                      <button
                        onClick={() => {
                          setShowAddDoc(false);
                          setNewDocName('');
                        }}
                        className="px-3 py-2 text-gray-500 hover:text-gray-700"
                      >
                        Cancelar
                      </button>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                      Formatos: PDF, JPG, PNG, WEBP. Máximo 5MB.
                    </p>
                  </div>
                )}

                {/* Lista de documentos */}
                {isLoadingDocs ? (
                  <div className="flex items-center justify-center py-4 text-gray-400">
                    <Loader2 size={20} className="animate-spin mr-2" />
                    Cargando documentos...
                  </div>
                ) : documents.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">
                    No hay documentos adicionales
                  </p>
                ) : (
                  <div className="space-y-2">
                    {documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <FileText size={20} className="text-gray-400" />
                          <div>
                            <p className="font-medium text-sm">{doc.name}</p>
                            <p className="text-xs text-gray-400">
                              {new Date(doc.createdAt).toLocaleDateString('es-MX')}
                              {doc.fileType && ` - ${doc.fileType.split('/')[1]?.toUpperCase()}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <a
                            href={doc.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 text-blue-600 hover:bg-blue-100 rounded"
                            title="Ver/Descargar"
                          >
                            <Download size={16} />
                          </a>
                          <button
                            onClick={() => handleDeleteDocument(doc.id)}
                            className="p-2 text-red-500 hover:bg-red-100 rounded"
                            title="Eliminar"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
