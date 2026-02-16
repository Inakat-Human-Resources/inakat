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
  ExternalLink,
  FileText,
  Upload,
  Eye,
  EyeOff,
  KeyRound,
  CheckCircle
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

interface Document {
  id?: number;
  name: string;
  fileUrl: string;
  fileType?: string;
  file?: File;
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
  // FEAT-2: Foto de perfil
  const [fotoUrl, setFotoUrl] = useState('');
  const [fotoUploading, setFotoUploading] = useState(false);

  // Educación múltiple
  const [educations, setEducations] = useState<Education[]>([]);

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

  // Documentos
  const [documents, setDocuments] = useState<Document[]>([]);
  const [uploadingDoc, setUploadingDoc] = useState<number | null>(null);

  // Cuenta de acceso
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetPassword, setResetPassword] = useState('');
  const [showResetPasswordText, setShowResetPasswordText] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [showCreateAccount, setShowCreateAccount] = useState(false);

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
    'Posgrado'
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
      // Cargar educación múltiple
      if (candidateToEdit.educacion) {
        try {
          const parsed = typeof candidateToEdit.educacion === 'string'
            ? JSON.parse(candidateToEdit.educacion)
            : candidateToEdit.educacion;
          setEducations(Array.isArray(parsed) ? parsed : []);
        } catch {
          setEducations([]);
        }
      } else if (candidateToEdit.universidad || candidateToEdit.carrera) {
        // Migrar campos legacy a array
        setEducations([{
          id: Date.now(),
          nivel: candidateToEdit.nivelEstudios || '',
          institucion: candidateToEdit.universidad || '',
          carrera: candidateToEdit.carrera || '',
          añoInicio: null,
          añoFin: null,
          estatus: 'Completa'
        }]);
      } else {
        setEducations([]);
      }
      setProfile(candidateToEdit.profile || '');
      setSeniority(candidateToEdit.seniority || '');
      setCvUrl(candidateToEdit.cvUrl || '');
      setPortafolioUrl(candidateToEdit.portafolioUrl || '');
      setLinkedinUrl(candidateToEdit.linkedinUrl || '');
      setSource(candidateToEdit.source || 'manual');
      setNotas(candidateToEdit.notas || '');
      setFotoUrl(candidateToEdit.fotoUrl || ''); // FEAT-2: Foto de perfil

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

      if (candidateToEdit.documents) {
        setDocuments(
          candidateToEdit.documents.map((doc: any) => ({
            id: doc.id,
            name: doc.name,
            fileUrl: doc.fileUrl,
            fileType: doc.fileType
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
    setFotoUrl(''); // FEAT-2: Foto de perfil
    setEducations([]);
    setProfile('');
    setSeniority('');
    setCvUrl('');
    setPortafolioUrl('');
    setLinkedinUrl('');
    setSource('manual');
    setNotas('');
    setExperiences([]);
    setDocuments([]);
    setActiveTab('personal');
    setError('');
    setPassword('');
    setShowPassword(false);
    setShowResetPassword(false);
    setResetPassword('');
    setShowResetPasswordText(false);
    setResetSuccess(false);
    setShowCreateAccount(false);
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

  // CRUD para educación múltiple
  const addEducation = () => {
    setEducations([...educations, {
      id: Date.now(),
      nivel: '',
      institucion: '',
      carrera: '',
      añoInicio: null,
      añoFin: null,
      estatus: 'Completa'
    }]);
  };

  const updateEducation = (index: number, field: keyof Education, value: any) => {
    const updated = [...educations];
    (updated[index] as any)[field] = value;
    setEducations(updated);
  };

  const removeEducation = (index: number) => {
    setEducations(educations.filter((_, i) => i !== index));
  };

  // Agregar documento
  const addDocument = () => {
    setDocuments([
      ...documents,
      { name: '', fileUrl: '' }
    ]);
  };

  // Actualizar documento
  const updateDocument = (index: number, field: keyof Document, value: any) => {
    const updated = [...documents];
    updated[index] = { ...updated[index], [field]: value };
    setDocuments(updated);
  };

  // Eliminar documento
  const removeDocument = (index: number) => {
    setDocuments(documents.filter((_, i) => i !== index));
  };

  // Subir archivo de documento
  const handleDocumentUpload = async (index: number, file: File | undefined) => {
    if (!file) return;

    try {
      setUploadingDoc(index);

      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (data.success) {
        updateDocument(index, 'fileUrl', data.url);
        updateDocument(index, 'fileType', file.type.split('/')[1] || 'file');
      } else {
        setError(data.error || 'Error al subir archivo');
      }
    } catch (err) {
      setError('Error al subir archivo');
    } finally {
      setUploadingDoc(null);
    }
  };

  // FEAT-2: Subir foto de perfil
  const handleFotoUpload = async (file: File) => {
    // Validar tamaño (máximo 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setError('La foto no debe exceder 2MB');
      return;
    }
    // Validar tipo de archivo
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Solo se permiten imágenes JPG, PNG o WebP');
      return;
    }
    setFotoUploading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      const data = await response.json();
      if (data.success) {
        setFotoUrl(data.url);
      } else {
        setError(data.error || 'Error al subir foto');
      }
    } catch (err) {
      setError('Error al subir foto');
    } finally {
      setFotoUploading(false);
    }
  };

  // Resetear contraseña de candidato existente
  const handleResetPassword = async () => {
    if (!candidateToEdit || !resetPassword.trim()) return;

    if (resetPassword.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres');
      return;
    }

    setResettingPassword(true);
    setError('');

    try {
      const res = await fetch(`/api/admin/candidates/${candidateToEdit.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: resetPassword })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setResetSuccess(true);
        setResetPassword('');
        setShowResetPassword(false);
        setShowResetPasswordText(false);
        setShowCreateAccount(false);
        // Actualizar el candidateToEdit local para reflejar que ahora tiene userId
        if (data.userId) {
          candidateToEdit.userId = data.userId;
        }
      } else {
        setError(data.error || 'Error al resetear contraseña');
      }
    } catch (err) {
      console.error('Error resetting password:', err);
      setError('Error de conexión');
    } finally {
      setResettingPassword(false);
    }
  };

  // Enviar formulario
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validar contraseña si se proporcionó
    if (password && password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres');
      return;
    }

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
        fotoUrl: fotoUrl || null, // FEAT-2: Foto de perfil
        // Educación múltiple
        educacion: educations.filter(e => e.institucion || e.carrera || e.nivel),
        profile: profile || null,
        seniority: seniority || null,
        cvUrl: cvUrl || null,
        portafolioUrl: portafolioUrl || null,
        linkedinUrl: linkedinUrl || null,
        source,
        notas: notas || null,
        experiences: experiences.filter(
          (exp) => exp.empresa && exp.puesto && exp.fechaInicio
        ),
        documents: documents.filter(
          (doc) => doc.name && doc.fileUrl
        ).map(doc => ({
          id: doc.id,
          name: doc.name,
          fileUrl: doc.fileUrl,
          fileType: doc.fileType
        })),
        ...(password && { password }),
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
            {educations.length > 0 && (
              <span className="bg-blue-100 text-blue-600 text-xs px-2 py-0.5 rounded-full">
                {educations.length}
              </span>
            )}
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
          <button
            onClick={() => setActiveTab('documents')}
            className={`flex items-center gap-2 px-6 py-3 font-medium ${
              activeTab === 'documents'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <FileText size={18} />
            Documentos
            {documents.length > 0 && (
              <span className="bg-blue-100 text-blue-600 text-xs px-2 py-0.5 rounded-full">
                {documents.length}
              </span>
            )}
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
              {/* FEAT-2: Foto de perfil */}
              <div className="flex items-center gap-4 mb-4 pb-4 border-b">
                <div className="relative">
                  <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-100 border-2 border-gray-200 flex items-center justify-center">
                    {fotoUrl ? (
                      <img src={fotoUrl} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-8 h-8 text-gray-400" />
                    )}
                  </div>
                  <label className="absolute bottom-0 right-0 w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center cursor-pointer hover:bg-blue-700 shadow-lg">
                    {fotoUploading ? (
                      <Loader2 className="w-4 h-4 text-white animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4 text-white" />
                    )}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFotoUpload(file);
                      }}
                      disabled={fotoUploading}
                    />
                  </label>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Foto de perfil</p>
                  <p className="text-xs text-gray-500">JPG, PNG o WebP (máx 2MB)</p>
                  {fotoUrl && (
                    <button
                      type="button"
                      onClick={() => setFotoUrl('')}
                      className="text-xs text-red-500 hover:text-red-700 mt-1"
                    >
                      Eliminar foto
                    </button>
                  )}
                </div>
              </div>

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

              {/* Cuenta de Acceso */}
              <div className="border-t border-b border-gray-200 py-4 my-2">
                <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                  <KeyRound size={16} />
                  Cuenta de Acceso
                </h3>

                {!candidateToEdit ? (
                  /* Nuevo candidato: campo de contraseña opcional */
                  <div>
                    <label className="block text-sm font-semibold mb-1">
                      Contraseña
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Mínimo 8 caracteres"
                        className="w-full p-3 pr-10 border rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Opcional. Si se proporciona, el candidato podrá iniciar sesión en INAKAT con su email y esta contraseña.
                    </p>
                  </div>
                ) : (
                  /* Candidato existente: mostrar estado de cuenta */
                  <div>
                    {candidateToEdit.userId || resetSuccess ? (
                      /* Tiene cuenta */
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-green-700 bg-green-50 px-3 py-2 rounded-lg">
                          <CheckCircle size={16} />
                          <span className="text-sm font-medium">Tiene cuenta de acceso</span>
                        </div>
                        {!showResetPassword ? (
                          <button
                            type="button"
                            onClick={() => setShowResetPassword(true)}
                            className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                          >
                            <KeyRound size={14} />
                            Resetear Contraseña
                          </button>
                        ) : (
                          <div className="bg-gray-50 p-3 rounded-lg space-y-2">
                            <label className="block text-sm font-medium text-gray-700">Nueva contraseña</label>
                            <div className="relative">
                              <input
                                type={showResetPasswordText ? 'text' : 'password'}
                                value={resetPassword}
                                onChange={(e) => setResetPassword(e.target.value)}
                                placeholder="Mínimo 8 caracteres"
                                className="w-full p-2 pr-10 border rounded-lg text-sm"
                              />
                              <button
                                type="button"
                                onClick={() => setShowResetPasswordText(!showResetPasswordText)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                              >
                                {showResetPasswordText ? <EyeOff size={16} /> : <Eye size={16} />}
                              </button>
                            </div>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={handleResetPassword}
                                disabled={resettingPassword || resetPassword.length < 8}
                                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
                              >
                                {resettingPassword ? (
                                  <><Loader2 size={14} className="animate-spin" /> Guardando...</>
                                ) : (
                                  'Guardar'
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => { setShowResetPassword(false); setResetPassword(''); setShowResetPasswordText(false); }}
                                className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50"
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* No tiene cuenta */
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-gray-500 bg-gray-50 px-3 py-2 rounded-lg">
                          <User size={16} />
                          <span className="text-sm">Sin cuenta de acceso</span>
                        </div>
                        {!showCreateAccount ? (
                          <button
                            type="button"
                            onClick={() => setShowCreateAccount(true)}
                            className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                          >
                            <Plus size={14} />
                            Crear cuenta de acceso
                          </button>
                        ) : (
                          <div className="bg-gray-50 p-3 rounded-lg space-y-2">
                            <label className="block text-sm font-medium text-gray-700">Contraseña para la cuenta</label>
                            <div className="relative">
                              <input
                                type={showResetPasswordText ? 'text' : 'password'}
                                value={resetPassword}
                                onChange={(e) => setResetPassword(e.target.value)}
                                placeholder="Mínimo 8 caracteres"
                                className="w-full p-2 pr-10 border rounded-lg text-sm"
                              />
                              <button
                                type="button"
                                onClick={() => setShowResetPasswordText(!showResetPasswordText)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                              >
                                {showResetPasswordText ? <EyeOff size={16} /> : <Eye size={16} />}
                              </button>
                            </div>
                            <p className="text-xs text-gray-500">
                              Se creará una cuenta con el email del candidato y esta contraseña.
                            </p>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={handleResetPassword}
                                disabled={resettingPassword || resetPassword.length < 8}
                                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
                              >
                                {resettingPassword ? (
                                  <><Loader2 size={14} className="animate-spin" /> Creando...</>
                                ) : (
                                  'Crear cuenta'
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => { setShowCreateAccount(false); setResetPassword(''); setShowResetPasswordText(false); }}
                                className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50"
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
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

          {/* Tab: Educación - Cards dinámicas */}
          {activeTab === 'education' && (
            <div className="space-y-4">
              {educations.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-lg">
                  <GraduationCap className="mx-auto text-gray-400 mb-2" size={40} />
                  <p className="text-gray-500">No hay educación agregada</p>
                  <button
                    type="button"
                    onClick={addEducation}
                    className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2 mx-auto"
                  >
                    <Plus size={18} />
                    Agregar Educación
                  </button>
                </div>
              ) : (
                <>
                  {educations.map((edu, index) => (
                    <div key={edu.id} className="border rounded-lg p-4 bg-gray-50 relative">
                      <button
                        type="button"
                        onClick={() => removeEducation(index)}
                        className="absolute top-2 right-2 text-red-500 hover:text-red-700 p-1"
                        title="Eliminar"
                      >
                        <Trash2 size={18} />
                      </button>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-semibold mb-1">Nivel de Estudios</label>
                          <select
                            value={edu.nivel}
                            onChange={(e) => updateEducation(index, 'nivel', e.target.value)}
                            className="w-full p-3 border rounded-lg"
                          >
                            <option value="">Seleccionar</option>
                            <option value="Preparatoria">Preparatoria</option>
                            <option value="Técnico">Técnico</option>
                            <option value="Licenciatura">Licenciatura</option>
                            <option value="Posgrado">Posgrado</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-semibold mb-1">Institución</label>
                          <input
                            type="text"
                            value={edu.institucion}
                            onChange={(e) => updateEducation(index, 'institucion', e.target.value)}
                            placeholder="Ej: UANL, Tec de Monterrey..."
                            className="w-full p-3 border rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold mb-1">Carrera</label>
                          <input
                            type="text"
                            value={edu.carrera}
                            onChange={(e) => updateEducation(index, 'carrera', e.target.value)}
                            placeholder="Ej: Ingeniería en Sistemas..."
                            className="w-full p-3 border rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold mb-1">Estatus</label>
                          <select
                            value={edu.estatus}
                            onChange={(e) => updateEducation(index, 'estatus', e.target.value)}
                            className="w-full p-3 border rounded-lg"
                          >
                            <option value="Completa">Completa</option>
                            <option value="En curso">En curso</option>
                            <option value="Trunca">Trunca</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-semibold mb-1">Año Inicio</label>
                          <input
                            type="number"
                            value={edu.añoInicio || ''}
                            onChange={(e) => updateEducation(index, 'añoInicio', e.target.value ? parseInt(e.target.value) : null)}
                            placeholder="Ej: 2018"
                            className="w-full p-3 border rounded-lg"
                            min="1970" max="2030"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold mb-1">Año Fin</label>
                          <input
                            type="number"
                            value={edu.añoFin || ''}
                            onChange={(e) => updateEducation(index, 'añoFin', e.target.value ? parseInt(e.target.value) : null)}
                            placeholder="Ej: 2022"
                            className="w-full p-3 border rounded-lg"
                            min="1970" max="2030"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addEducation}
                    className="w-full py-3 border-2 border-dashed border-gray-300 text-gray-500 rounded-lg hover:border-blue-400 hover:text-blue-500 flex items-center justify-center gap-2"
                  >
                    <Plus size={18} />
                    Agregar otra educación
                  </button>
                </>
              )}
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

          {/* Tab: Documentos */}
          {activeTab === 'documents' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Agrega documentos adicionales del candidato (títulos, certificaciones, etc.)
              </p>

              {documents.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-lg">
                  <FileText className="mx-auto text-gray-400 mb-2" size={40} />
                  <p className="text-gray-500">No hay documentos agregados</p>
                  <button
                    type="button"
                    onClick={addDocument}
                    className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2 mx-auto"
                  >
                    <Plus size={18} />
                    Agregar Documento
                  </button>
                </div>
              ) : (
                <>
                  {documents.map((doc, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-3 p-4 border rounded-lg bg-gray-50"
                    >
                      <div className="flex-1">
                        <input
                          type="text"
                          value={doc.name}
                          onChange={(e) => updateDocument(index, 'name', e.target.value)}
                          placeholder="Nombre del documento (ej: Título universitario)"
                          className="w-full p-2 border rounded-lg mb-2"
                        />
                        {doc.fileUrl ? (
                          <div className="flex items-center gap-2">
                            <a
                              href={doc.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 text-sm hover:underline flex items-center gap-1"
                            >
                              <FileText size={14} />
                              Ver archivo
                            </a>
                            <button
                              type="button"
                              onClick={() => updateDocument(index, 'fileUrl', '')}
                              className="text-xs text-gray-500 hover:text-red-600"
                            >
                              Cambiar
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <label className="cursor-pointer px-3 py-1.5 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300 flex items-center gap-1">
                              {uploadingDoc === index ? (
                                <>
                                  <Loader2 size={14} className="animate-spin" />
                                  Subiendo...
                                </>
                              ) : (
                                <>
                                  <Upload size={14} />
                                  Subir archivo
                                </>
                              )}
                              <input
                                type="file"
                                onChange={(e) => handleDocumentUpload(index, e.target.files?.[0])}
                                className="hidden"
                                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                                disabled={uploadingDoc === index}
                              />
                            </label>
                            <span className="text-xs text-gray-500">o</span>
                            <input
                              type="url"
                              value={doc.fileUrl}
                              onChange={(e) => updateDocument(index, 'fileUrl', e.target.value)}
                              placeholder="URL del documento"
                              className="flex-1 p-2 border rounded-lg text-sm"
                            />
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeDocument(index)}
                        className="text-red-500 hover:text-red-700 p-2"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={addDocument}
                    className="w-full py-3 border-2 border-dashed border-gray-300 text-gray-500 rounded-lg hover:border-blue-400 hover:text-blue-500 flex items-center justify-center gap-2"
                  >
                    <Plus size={18} />
                    Agregar Otro Documento
                  </button>
                </>
              )}
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
