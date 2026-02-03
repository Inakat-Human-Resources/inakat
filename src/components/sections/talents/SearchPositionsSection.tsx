// RUTA: src/components/sections/talents/SearchPositionsSection.tsx

'use client';

import React, { useState, useEffect } from 'react';
import {
  Search,
  MapPin,
  Briefcase,
  Bookmark,
  MoreVertical,
  Building2,
  ChevronDown  // FIX-05: Para dropdown de ordenamiento
} from 'lucide-react';
import ApplyJobModal from './ApplyJobModal';

interface Job {
  id: number;
  title: string;
  company: string;
  location: string;
  salary: string;
  jobType: string;
  workMode?: string; // Actualizado de isRemote
  companyRating: number | null;
  description: string;
  requirements: string | null;
  status: string;
  createdAt: string;
  profile?: string;  // FIX-06: Campo de especialidad para filtro
}

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
}

const SearchPositionsSection = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filteredJobs, setFilteredJobs] = useState<Job[]>([]);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Usuario actual
  const [user, setUser] = useState<User | null>(null);

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [jobTypeFilter, setJobTypeFilter] = useState('');

  // FIX-05: Estado para ordenamiento
  const [sortOrder, setSortOrder] = useState<string>('newest');
  const [showSortDropdown, setShowSortDropdown] = useState(false);

  // FIX-06: Estado para filtro de especialidad
  const [specialties, setSpecialties] = useState<{id: number, name: string}[]>([]);
  const [specialtyFilter, setSpecialtyFilter] = useState('');

  // Modal de aplicación
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [applicationSuccess, setApplicationSuccess] = useState(false);

  // Cargar usuario actual
  useEffect(() => {
    fetchCurrentUser();
  }, []);

  // Cargar vacantes desde la API
  useEffect(() => {
    fetchJobs();
  }, []);

  // FIX-06: Cargar especialidades al montar
  useEffect(() => {
    fetch('/api/specialties')
      .then(res => res.json())
      .then(data => {
        if (data.success) setSpecialties(data.data);
      })
      .catch(err => console.error('Error fetching specialties:', err));
  }, []);

  // Aplicar filtros cuando cambien (FIX-05: agregado sortOrder, FIX-06: agregado specialtyFilter)
  useEffect(() => {
    applyFilters();
  }, [jobs, searchTerm, locationFilter, jobTypeFilter, sortOrder, specialtyFilter]);

  const fetchCurrentUser = async () => {
    try {
      const response = await fetch('/api/auth/me');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setUser(data.user);
        }
      }
      // Si no está logueado o error, user queda null (está bien)
    } catch (error) {
      console.error('Error fetching user:', error);
    }
  };

  const fetchJobs = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/jobs?status=active');
      const data = await response.json();

      if (data.success) {
        setJobs(data.data);
        if (data.data.length > 0) {
          setSelectedJob(data.data[0]);
        }
      }
    } catch (error) {
      console.error('Error fetching jobs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...jobs];

    if (searchTerm.trim()) {
      const query = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (job) =>
          job.title.toLowerCase().includes(query) ||
          job.company.toLowerCase().includes(query) ||
          job.description.toLowerCase().includes(query)
      );
    }

    if (locationFilter.trim()) {
      filtered = filtered.filter((job) =>
        job.location.toLowerCase().includes(locationFilter.toLowerCase())
      );
    }

    if (jobTypeFilter && jobTypeFilter !== 'all') {
      filtered = filtered.filter((job) => job.jobType === jobTypeFilter);
    }

    // FIX-06: Filtro por especialidad
    if (specialtyFilter) {
      filtered = filtered.filter(job => job.profile === specialtyFilter);
    }

    // FIX-05: Ordenamiento
    switch (sortOrder) {
      case 'newest':
        filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case 'oldest':
        filtered.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        break;
      case 'az':
        filtered.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'za':
        filtered.sort((a, b) => b.title.localeCompare(a.title));
        break;
    }

    setFilteredJobs(filtered);
  };

  const getTimeSincePosted = (createdAt: string) => {
    const now = new Date();
    const posted = new Date(createdAt);
    const diffMs = now.getTime() - posted.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) return `Publicado hace ${diffMins} min.`;
    if (diffHours < 24)
      return `Publicado hace ${diffHours} hora${diffHours > 1 ? 's' : ''}.`;
    return `Publicado hace ${diffDays} día${diffDays > 1 ? 's' : ''}.`;
  };

  const handleApplyClick = () => {
    setIsApplyModalOpen(true);
  };

  const handleApplicationSuccess = () => {
    setApplicationSuccess(true);
    setTimeout(() => setApplicationSuccess(false), 5000);
  };

  // Helper para mostrar badge de modalidad
  const getWorkModeBadge = (job: Job) => {
    if (job.workMode === 'remote') {
      return (
        <span className="bg-orange-500 text-white px-3 py-1 rounded-full text-sm">
          Remoto
        </span>
      );
    }
    if (job.workMode === 'hybrid') {
      return (
        <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-sm">
          Híbrido
        </span>
      );
    }
    return null;
  };

  // Verificar si el usuario puede aplicar
  // Permitimos: no logueados, candidatos, y usuarios generales
  // Bloqueamos: empresas, admins, reclutadores, especialistas
  const blockedRoles = ['company', 'admin', 'recruiter', 'specialist'];
  const canApply = !user || !blockedRoles.includes(user.role);

  return (
    <section className="bg-custom-beige text-text-black pt-20">
      {/* Modal de aplicación */}
      {selectedJob && (
        <ApplyJobModal
          jobId={selectedJob.id}
          jobTitle={selectedJob.title}
          company={selectedJob.company}
          isOpen={isApplyModalOpen}
          onClose={() => setIsApplyModalOpen(false)}
          onSuccess={handleApplicationSuccess}
        />
      )}

      {/* Sección de Búsqueda */}
      <div className="bg-soft-green text-white py-24 mt-20">
        <div className="container mx-auto text-center">
          <h2 className="text-3xl font-bold mb-10">
            DESCUBRE TUS OPORTUNIDADES
          </h2>

          {/* Filtros */}
          <div className="flex flex-col md:flex-row justify-center gap-4 mb-10">
            <div className="relative w-full md:w-1/4">
              <input
                type="text"
                placeholder="Buscar puesto, área, empresa"
                className="w-full p-3 pl-10 text-black rounded-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Briefcase className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" />
            </div>

            <div className="relative w-full md:w-1/4">
              <input
                type="text"
                placeholder="Ubicación"
                className="w-full p-3 pl-10 text-black rounded-full"
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
              />
              <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" />
            </div>

            <div className="w-full md:w-1/4">
              <select
                className="w-full p-3 text-black rounded-full"
                value={jobTypeFilter}
                onChange={(e) => setJobTypeFilter(e.target.value)}
              >
                <option value="all">Modalidad de trabajo</option>
                <option value="Tiempo Completo">Tiempo Completo</option>
                <option value="Medio Tiempo">Medio Tiempo</option>
                <option value="Por Proyecto">Por Proyecto</option>
              </select>
            </div>

            {/* FIX-06: Filtro por especialidad */}
            <div className="w-full md:w-1/4">
              <select
                className="w-full p-3 text-black rounded-full"
                value={specialtyFilter}
                onChange={(e) => setSpecialtyFilter(e.target.value)}
              >
                <option value="">Todas las especialidades</option>
                {specialties.map(s => (
                  <option key={s.id} value={s.name}>{s.name}</option>
                ))}
              </select>
            </div>

            <button className="bg-lemon-green text-black font-bold px-8 py-3 rounded-full hover:bg-green-700 flex items-center justify-center gap-2">
              <Search size={20} />
              BUSCAR
            </button>
          </div>
        </div>
      </div>

      {/* Lista de Vacantes */}
      <div className="container mx-auto py-12 px-4">
        {/* Mensaje de éxito */}
        {applicationSuccess && (
          <div className="mb-6 p-4 bg-green-100 border-2 border-green-500 text-green-800 rounded-lg text-center font-semibold">
            ✅ ¡Aplicación enviada exitosamente! El reclutador revisará tu
            perfil pronto.
          </div>
        )}

        {/* Aviso para empresas */}
        {user && user.role === 'company' && (
          <div className="mb-6 p-4 bg-blue-50 border-2 border-blue-300 text-blue-800 rounded-lg flex items-center gap-3">
            <Building2 size={24} />
            <div>
              <p className="font-semibold">Estás viendo como empresa</p>
              <p className="text-sm">
                Puedes ver las vacantes publicadas pero no aplicar a ellas. Para
                publicar tus vacantes, ve a tu panel de empresa.
              </p>
            </div>
          </div>
        )}

        {/* Aviso para admin */}
        {user && user.role === 'admin' && (
          <div className="mb-6 p-4 bg-purple-50 border-2 border-purple-300 text-purple-800 rounded-lg flex items-center gap-3">
            <Building2 size={24} />
            <div>
              <p className="font-semibold">Vista de administrador</p>
              <p className="text-sm">
                Estás viendo las vacantes activas en la plataforma.
              </p>
            </div>
          </div>
        )}

        {/* Aviso para reclutador */}
        {user && user.role === 'recruiter' && (
          <div className="mb-6 p-4 bg-green-50 border-2 border-green-300 text-green-800 rounded-lg flex items-center gap-3">
            <Building2 size={24} />
            <div>
              <p className="font-semibold">Vista de reclutador</p>
              <p className="text-sm">
                Estás viendo las vacantes activas. Para gestionar candidatos, ve a tu dashboard.
              </p>
            </div>
          </div>
        )}

        {/* Aviso para especialista */}
        {user && user.role === 'specialist' && (
          <div className="mb-6 p-4 bg-indigo-50 border-2 border-indigo-300 text-indigo-800 rounded-lg flex items-center gap-3">
            <Building2 size={24} />
            <div>
              <p className="font-semibold">Vista de especialista</p>
              <p className="text-sm">
                Estás viendo las vacantes activas. Para evaluar candidatos, ve a tu dashboard.
              </p>
            </div>
          </div>
        )}

        {/* Filtros de estado y ordenamiento */}
        <div className="flex justify-between items-center mb-6">
          {/* FIX-04: Solo mostrar estos botones si hay sesión */}
          {user && (
            <div className="flex gap-2">
              <button className="text-black font-bold border-2 border-button-green px-6 py-2 rounded-full bg-button-green text-white">
                Guardados
              </button>
              <button className="text-black font-bold border-2 border-gray-600 px-6 py-2 rounded-full hover:border-button-green">
                Postulados
              </button>
              <button className="text-black font-bold border-2 border-gray-600 px-6 py-2 rounded-full hover:border-button-green">
                Vencidos
              </button>
            </div>
          )}
          {!user && <div />} {/* Spacer cuando no hay user */}

          {/* FIX-05: Dropdown funcional de ordenamiento */}
          <div className="relative">
            <button
              onClick={() => setShowSortDropdown(!showSortDropdown)}
              className="text-black font-bold border-2 border-gray-600 px-6 py-2 rounded-full hover:border-button-green flex items-center gap-2"
            >
              Ordenar por
              <ChevronDown size={16} />
            </button>
            {showSortDropdown && (
              <div className="absolute right-0 top-full mt-2 bg-white rounded-lg shadow-lg border z-10 min-w-[200px]">
                {[
                  { value: 'newest', label: 'Más reciente' },
                  { value: 'oldest', label: 'Menos reciente' },
                  { value: 'az', label: 'A → Z' },
                  { value: 'za', label: 'Z → A' },
                ].map(option => (
                  <button
                    key={option.value}
                    onClick={() => { setSortOrder(option.value); setShowSortDropdown(false); }}
                    className={`w-full text-left px-4 py-2 hover:bg-gray-100 ${sortOrder === option.value ? 'font-bold text-button-green' : 'text-gray-700'}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="text-center py-20">
            <p className="text-gray-600 text-lg">Cargando vacantes...</p>
          </div>
        )}

        {/* No hay vacantes */}
        {!isLoading && filteredJobs.length === 0 && (
          <div className="text-center py-20">
            <p className="text-gray-600 text-lg">
              {jobs.length === 0
                ? 'No hay vacantes disponibles en este momento.'
                : 'No se encontraron vacantes que coincidan con tu búsqueda.'}
            </p>
          </div>
        )}

        {/* Lista y Detalle */}
        {!isLoading && filteredJobs.length > 0 && (
          <div className="flex flex-col md:flex-row gap-6">
            {/* Columna Izquierda: Lista */}
            <div className="w-full md:w-1/2 space-y-4">
              {filteredJobs.map((job) => (
                <div
                  key={job.id}
                  className={`bg-white p-6 rounded-lg shadow-lg cursor-pointer hover:shadow-xl relative ${
                    selectedJob?.id === job.id
                      ? 'border-2 border-button-green'
                      : ''
                  }`}
                  onClick={() => setSelectedJob(job)}
                >
                  <div className="absolute top-4 right-4 flex gap-2">
                    <Bookmark className="text-gray-500 hover:text-button-green cursor-pointer" />
                    <MoreVertical className="text-gray-500 hover:text-button-green cursor-pointer" />
                  </div>

                  <p className="text-gray-500 text-sm">
                    {getTimeSincePosted(job.createdAt)}
                  </p>

                  <h3 className="text-xl font-bold text-black mt-2">
                    {job.title}
                  </h3>

                  <p className="text-gray-600">
                    {job.company}{' '}
                    {job.companyRating && `★ ${job.companyRating}`}
                  </p>
                  <p className="text-gray-600">{job.location}</p>

                  <p className="font-bold text-black mt-2">Salario:</p>
                  <p className="font-bold text-black">{job.salary}</p>

                  <div className="flex gap-2 mt-2">
                    <span className="bg-gray-800 text-white px-3 py-1 rounded-full text-sm">
                      {job.jobType}
                    </span>
                    {getWorkModeBadge(job)}
                  </div>
                </div>
              ))}
            </div>

            {/* Columna Derecha: Detalle */}
            <div className="w-full md:w-1/2">
              {selectedJob && (
                <div className="bg-white p-6 rounded-lg shadow-lg sticky top-4">
                  <div className="absolute top-4 right-4 flex gap-2">
                    <Bookmark className="text-gray-500 hover:text-button-green cursor-pointer" />
                    <MoreVertical className="text-gray-500 hover:text-button-green cursor-pointer" />
                  </div>

                  <p className="text-gray-500 text-sm">
                    {getTimeSincePosted(selectedJob.createdAt)}
                  </p>

                  <h2 className="text-2xl font-bold text-black mt-2">
                    {selectedJob.title}
                  </h2>

                  <p className="text-gray-600 mt-2">
                    {selectedJob.company}{' '}
                    {selectedJob.companyRating &&
                      `★ ${selectedJob.companyRating}`}
                  </p>
                  <p className="text-gray-600">{selectedJob.location}</p>

                  <p className="font-bold text-black mt-4">Salario:</p>
                  <p className="font-bold text-black">{selectedJob.salary}</p>

                  <div className="flex gap-2 mt-4">
                    <span className="bg-gray-800 text-white px-3 py-1 rounded-full text-sm">
                      {selectedJob.jobType}
                    </span>
                    {getWorkModeBadge(selectedJob)}
                  </div>

                  <hr className="my-6" />

                  <h3 className="font-bold text-lg mb-2">
                    Descripción del Puesto
                  </h3>
                  <p className="text-gray-700 whitespace-pre-line">
                    {selectedJob.description}
                  </p>

                  {selectedJob.requirements && (
                    <>
                      <h3 className="font-bold text-lg mt-6 mb-2">
                        Requisitos
                      </h3>
                      <p className="text-gray-700 whitespace-pre-line">
                        {selectedJob.requirements}
                      </p>
                    </>
                  )}

                  {/* BOTÓN POSTULARME - Solo para candidatos */}
                  {canApply ? (
                    <button
                      onClick={handleApplyClick}
                      className="w-full bg-button-green text-white font-bold py-3 rounded-lg mt-6 hover:bg-green-700 transition-colors"
                    >
                      POSTULARME
                    </button>
                  ) : (
                    <div className="mt-6 p-4 bg-gray-100 rounded-lg text-center text-gray-600">
                      {user?.role === 'company' && '🏢 Las empresas no pueden aplicar a vacantes'}
                      {user?.role === 'admin' && '⚙️ Los administradores no pueden aplicar a vacantes'}
                      {user?.role === 'recruiter' && '📋 Los reclutadores no pueden aplicar a vacantes'}
                      {user?.role === 'specialist' && '👔 Los especialistas no pueden aplicar a vacantes'}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default SearchPositionsSection;
