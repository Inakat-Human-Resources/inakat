// RUTA: src/components/sections/admin/CandidateForm.tsx

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  X,
  Plus,
  Trash2,
  User,
  GraduationCap,
  Briefcase,
  Link as LinkIcon,
  Save,
  Loader2,
  ExternalLink
} from 'lucide-react';

interface Experience {
  id?: number;
  empresa: string;
  puesto: string;
  ubicacion: string;
  fechaInicio: string;
  fechaFin: string;
  esActual: boolean;
  descripcion: string;
}

interface CandidateFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  candidateToEdit?: any; // Si se pasa, es modo edición
}

const CandidateForm = ({
  isOpen,
  onClose,
  onSuccess,
  candidateToEdit
}: CandidateFormProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [existingCandidateId, setExistingCandidateId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState('personal');

  // Datos personales
  const [nombre, setNombre] = useState('');
  const [apellidoPaterno, setApellidoPaterno] = useState('');
  const [apellidoMaterno, setApellidoMaterno] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [sexo, setSexo] = useState('');
  const [fechaNacimiento, setFechaNacimiento] = useState('');

  // Educación
  const [universidad, setUniversidad] = useState('');
  const [carrera, setCarrera] = useState('');
  const [nivelEstudios, setNivelEstudios] = useState('');

  // Profesional
  const [profile, setProfile] = useState('');
  const [seniority, setSeniority] = useState('');

  // Links
  const [cvUrl, setCvUrl] = useState('');
  const [portafolioUrl, setPortafolioUrl] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');

  // Otros
  const [source, setSource] = useState('manual');
  const [notas, setNotas] = useState('');

  // Experiencias
  const [experiences, setExperiences] = useState<Experience[]>([]);

  // Opciones
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
  const sources = [
    { value: 'manual', label: 'Ingreso Manual' },
    { value: 'linkedin', label: 'LinkedIn' },
    { value: 'occ', label: 'OCC' },
    { value: 'referido', label: 'Referido' }
  ];

  const nivelesEstudio = [
    'Preparatoria',
    'Técnico',
    'Licenciatura',
    'Maestría',
    'Doctorado'
  ];

  // Cargar datos si es edición
  useEffect(() => {
    if (candidateToEdit) {
      setNombre(candidateToEdit.nombre || '');
      setApellidoPaterno(candidateToEdit.apellidoPaterno || '');
      setApellidoMaterno(candidateToEdit.apellidoMaterno || '');
      setEmail(candidateToEdit.email || '');
      setTelefono(candidateToEdit.telefono || '');
      setSexo(candidateToEdit.sexo || '');
      setFechaNacimiento(
        candidateToEdit.fechaNacimiento
          ? new Date(candidateToEdit.fechaNacimiento)
              .toISOString()
              .split('T')[0]
          : ''
      );
      setUniversidad(candidateToEdit.universidad || '');
      setCarrera(candidateToEdit.carrera || '');
      setNivelEstudios(candidateToEdit.nivelEstudios || '');
      setProfile(candidateToEdit.profile || '');
      setSeniority(candidateToEdit.seniority || '');
      setCvUrl(candidateToEdit.cvUrl || '');
      setPortafolioUrl(candidateToEdit.portafolioUrl || '');
      setLinkedinUrl(candidateToEdit.linkedinUrl || '');
      setSource(candidateToEdit.source || 'manual');
      setNotas(candidateToEdit.notas || '');

      if (candidateToEdit.experiences) {
        setExperiences(
          candidateToEdit.experiences.map((exp: any) => ({
            ...exp,
            fechaInicio: exp.fechaInicio
              ? new Date(exp.fechaInicio).toISOString().split('T')[0]
              : '',
            fechaFin: exp.fechaFin
              ? new Date(exp.fechaFin).toISOString().split('T')[0]
              : ''
          }))
        );
      }
    }
  }, [candidateToEdit]);

  // Reset form
  const resetForm = () => {
    setNombre('');
    setApellidoPaterno('');
    setApellidoMaterno('');
    setEmail('');
    setTelefono('');
    setSexo('');
    setFechaNacimiento('');
    setUniversidad('');
    setCarrera('');
    setNivelEstudios('');
    setProfile('');
    setSeniority('');
    setCvUrl('');
    setPortafolioUrl('');
    setLinkedinUrl('');
    setSource('manual');
    setNotas('');
    setExperiences([]);
    setActiveTab('personal');
    setError('');
  };

  // Agregar experiencia
  const addExperience = () => {
    setExperiences([
      ...experiences,
      {
        empresa: '',
        puesto: '',
        ubicacion: '',
        fechaInicio: '',
        fechaFin: '',
        esActual: false,
        descripcion: ''
      }
    ]);
  };

  // Actualizar experiencia
  const updateExperience = (
    index: number,
    field: keyof Experience,
    value: any
  ) => {
    const updated = [...experiences];
    updated[index] = { ...updated[index], [field]: value };

    // Si marca como actual, limpiar fecha fin
    if (field === 'esActual' && value) {
      updated[index].fechaFin = '';
    }

    setExperiences(updated);
  };

  // Eliminar experiencia
  const removeExperience = (index: number) => {
    setExperiences(experiences.filter((_, i) => i !== index));
  };

  // Enviar formulario
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const data = {
        nombre,
        apellidoPaterno,
        apellidoMaterno: apellidoMaterno || null,
        email,
        telefono: telefono || null,
        sexo: sexo || null,
        fechaNacimiento: fechaNacimiento || null,
        universidad: universidad || null,
        carrera: carrera || null,
        nivelEstudios: nivelEstudios || null,
        profile: profile || null,
        seniority: seniority || null,
        cvUrl: cvUrl || null,
        portafolioUrl: portafolioUrl || null,
        linkedinUrl: linkedinUrl || null,
        source,
        notas: notas || null,
        experiences: experiences.filter(
          (exp) => exp.empresa && exp.puesto && exp.fechaInicio
        )
      };

      const url = candidateToEdit
        ? `/api/admin/candidates/${candidateToEdit.id}`
        : '/api/admin/candidates';

      const method = candidateToEdit ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      const result = await response.json();

      if (result.success) {
        resetForm();
        onSuccess();
        onClose();
      } else {
        // Si es error 409 (candidato existente), mostrar mensaje especial
        if (response.status === 409 && result.existingCandidateId) {
          setError(result.error);
          setExistingCandidateId(result.existingCandidateId);
        } else {
          setError(result.error || 'Error al guardar candidato');
          setExistingCandidateId(null);
        }
      }
    } catch (err) {
      setError('Error de conexión');
      setExistingCandidateId(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b bg-gray-50">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {candidateToEdit
                ? 'Editar Candidato'
                : 'Inyectar Nuevo Candidato'}
            </h2>
            <p className="text-gray-600 text-sm mt-1">
              {candidateToEdit
                ? 'Modifica los datos del candidato'
                : 'Agrega un candidato manualmente desde LinkedIn, OCC, etc.'}
            </p>
          </div>
          <button
            onClick={() => {
              resetForm();
              onClose();
            }}
            className="text-gray-400 hover:text-gray-600 p-2"
          >
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b bg-gray-50">
          <button
            onClick={() => setActiveTab('personal')}
            className={`flex items-center gap-2 px-6 py-3 font-medium ${
              activeTab === 'personal'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <User size={18} />
            Personal
          </button>
          <button
            onClick={() => setActiveTab('education')}
            className={`flex items-center gap-2 px-6 py-3 font-medium ${
              activeTab === 'education'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <GraduationCap size={18} />
            Educación
          </button>
          <button
            onClick={() => setActiveTab('experience')}
            className={`flex items-center gap-2 px-6 py-3 font-medium ${
              activeTab === 'experience'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Briefcase size={18} />
            Experiencia
            {experiences.length > 0 && (
              <span className="bg-blue-100 text-blue-600 text-xs px-2 py-0.5 rounded-full">
                {experiences.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('links')}
            className={`flex items-center gap-2 px-6 py-3 font-medium ${
              activeTab === 'links'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <LinkIcon size={18} />
            Links
          </button>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
              <p>{error}</p>
              {existingCandidateId && (
                <div className="mt-3 flex flex-wrap gap-3">
                  <Link
                    href={`/admin/candidates?search=${encodeURIComponent(email)}`}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                    onClick={onClose}
                  >
                    <ExternalLink size={14} />
                    Buscar en Banco de Candidatos
                  </Link>
                  <Link
                    href="/admin/assign-candidates"
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                    onClick={onClose}
                  >
                    <ExternalLink size={14} />
                    Ir a Asignar Candidatos
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* Tab: Personal */}
          {activeTab === 'personal' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1">
                    Nombre *
                  </label>
                  <input
                    type="text"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    className="w-full p-3 border rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">
                    Apellido Paterno *
                  </label>
                  <input
                    type="text"
                    value={apellidoPaterno}
                    onChange={(e) => setApellidoPaterno(e.target.value)}
                    className="w-full p-3 border rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">
                    Apellido Materno
                  </label>
                  <input
                    type="text"
                    value={apellidoMaterno}
                    onChange={(e) => setApellidoMaterno(e.target.value)}
                    className="w-full p-3 border rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full p-3 border rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">
                    Teléfono
                  </label>
                  <input
                    type="tel"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    placeholder="81 1234 5678"
                    className="w-full p-3 border rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1">
                    Sexo
                  </label>
                  <select
                    value={sexo}
                    onChange={(e) => setSexo(e.target.value)}
                    className="w-full p-3 border rounded-lg"
                  >
                    <option value="">Seleccionar</option>
                    <option value="M">Masculino</option>
                    <option value="F">Femenino</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">
                    Fecha de Nacimiento
                  </label>
                  <input
                    type="date"
                    value={fechaNacimiento}
                    onChange={(e) => setFechaNacimiento(e.target.value)}
                    className="w-full p-3 border rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1">
                    Perfil Profesional
                  </label>
                  <select
                    value={profile}
                    onChange={(e) => setProfile(e.target.value)}
                    className="w-full p-3 border rounded-lg"
                  >
                    <option value="">Seleccionar</option>
                    {profiles.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">
                    Nivel de Experiencia
                  </label>
                  <select
                    value={seniority}
                    onChange={(e) => setSeniority(e.target.value)}
                    className="w-full p-3 border rounded-lg"
                  >
                    <option value="">Seleccionar</option>
                    {seniorities.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">
                  Fuente del Candidato
                </label>
                <select
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  className="w-full p-3 border rounded-lg"
                >
                  {sources.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">
                  Notas Internas
                </label>
                <textarea
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  rows={3}
                  placeholder="Observaciones sobre el candidato..."
                  className="w-full p-3 border rounded-lg resize-none"
                />
              </div>
            </div>
          )}

          {/* Tab: Educación */}
          {activeTab === 'education' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1">
                  Universidad
                </label>
                <input
                  type="text"
                  value={universidad}
                  onChange={(e) => setUniversidad(e.target.value)}
                  placeholder="Ej: UANL, Tec de Monterrey, UNAM..."
                  className="w-full p-3 border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">
                  Carrera
                </label>
                <input
                  type="text"
                  value={carrera}
                  onChange={(e) => setCarrera(e.target.value)}
                  placeholder="Ej: Ingeniería en Sistemas, Diseño Gráfico..."
                  className="w-full p-3 border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">
                  Nivel de Estudios
                </label>
                <select
                  value={nivelEstudios}
                  onChange={(e) => setNivelEstudios(e.target.value)}
                  className="w-full p-3 border rounded-lg"
                >
                  <option value="">Seleccionar</option>
                  {nivelesEstudio.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Tab: Experiencia */}
          {activeTab === 'experience' && (
            <div className="space-y-4">
              {experiences.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-lg">
                  <Briefcase className="mx-auto text-gray-400 mb-2" size={40} />
                  <p className="text-gray-500">No hay experiencias agregadas</p>
                  <button
                    type="button"
                    onClick={addExperience}
                    className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2 mx-auto"
                  >
                    <Plus size={18} />
                    Agregar Experiencia
                  </button>
                </div>
              ) : (
                <>
                  {experiences.map((exp, index) => (
                    <div
                      key={index}
                      className="border rounded-lg p-4 bg-gray-50"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <h4 className="font-semibold text-gray-700">
                          Experiencia {index + 1}
                        </h4>
                        <button
                          type="button"
                          onClick={() => removeExperience(index)}
                          className="text-red-500 hover:text-red-700 p-1"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium mb-1">
                            Empresa *
                          </label>
                          <input
                            type="text"
                            value={exp.empresa}
                            onChange={(e) =>
                              updateExperience(index, 'empresa', e.target.value)
                            }
                            className="w-full p-2 border rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">
                            Puesto *
                          </label>
                          <input
                            type="text"
                            value={exp.puesto}
                            onChange={(e) =>
                              updateExperience(index, 'puesto', e.target.value)
                            }
                            className="w-full p-2 border rounded-lg"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
                        <div>
                          <label className="block text-sm font-medium mb-1">
                            Ubicación
                          </label>
                          <input
                            type="text"
                            value={exp.ubicacion}
                            onChange={(e) =>
                              updateExperience(
                                index,
                                'ubicacion',
                                e.target.value
                              )
                            }
                            placeholder="Ciudad, País"
                            className="w-full p-2 border rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">
                            Fecha Inicio *
                          </label>
                          <input
                            type="date"
                            value={exp.fechaInicio}
                            onChange={(e) =>
                              updateExperience(
                                index,
                                'fechaInicio',
                                e.target.value
                              )
                            }
                            className="w-full p-2 border rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">
                            Fecha Fin
                          </label>
                          <input
                            type="date"
                            value={exp.fechaFin}
                            onChange={(e) =>
                              updateExperience(
                                index,
                                'fechaFin',
                                e.target.value
                              )
                            }
                            disabled={exp.esActual}
                            className="w-full p-2 border rounded-lg disabled:bg-gray-200"
                          />
                        </div>
                      </div>

                      <div className="mt-3">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={exp.esActual}
                            onChange={(e) =>
                              updateExperience(
                                index,
                                'esActual',
                                e.target.checked
                              )
                            }
                            className="w-4 h-4"
                          />
                          <span className="text-sm">Trabajo actual</span>
                        </label>
                      </div>

                      <div className="mt-3">
                        <label className="block text-sm font-medium mb-1">
                          Descripción
                        </label>
                        <textarea
                          value={exp.descripcion}
                          onChange={(e) =>
                            updateExperience(
                              index,
                              'descripcion',
                              e.target.value
                            )
                          }
                          rows={2}
                          placeholder="Responsabilidades y logros..."
                          className="w-full p-2 border rounded-lg resize-none"
                        />
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={addExperience}
                    className="w-full py-3 border-2 border-dashed border-gray-300 text-gray-500 rounded-lg hover:border-blue-400 hover:text-blue-500 flex items-center justify-center gap-2"
                  >
                    <Plus size={18} />
                    Agregar Otra Experiencia
                  </button>
                </>
              )}
            </div>
          )}

          {/* Tab: Links */}
          {activeTab === 'links' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1">
                  URL del CV
                </label>
                <input
                  type="url"
                  value={cvUrl}
                  onChange={(e) => setCvUrl(e.target.value)}
                  placeholder="https://drive.google.com/..."
                  className="w-full p-3 border rounded-lg"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Link a Google Drive, Dropbox, etc.
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">
                  LinkedIn
                </label>
                <input
                  type="url"
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                  placeholder="https://linkedin.com/in/..."
                  className="w-full p-3 border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">
                  Portafolio
                </label>
                <input
                  type="url"
                  value={portafolioUrl}
                  onChange={(e) => setPortafolioUrl(e.target.value)}
                  placeholder="https://behance.net/..."
                  className="w-full p-3 border rounded-lg"
                />
              </div>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex justify-end gap-4 p-6 border-t bg-gray-50">
          <button
            type="button"
            onClick={() => {
              resetForm();
              onClose();
            }}
            className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-semibold"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-semibold flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="animate-spin" size={18} />
                Guardando...
              </>
            ) : (
              <>
                <Save size={18} />
                {candidateToEdit ? 'Actualizar' : 'Guardar Candidato'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CandidateForm;
