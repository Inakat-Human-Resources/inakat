// RUTA: src/app/profile/page.tsx

'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  User,
  Lock,
  Save,
  Loader2,
  Eye,
  EyeOff,
  CheckCircle,
  Briefcase,
  Plus,
  Edit2,
  Trash2,
  FileText,
  Upload,
  X,
  Calendar,
  Building,
  MapPin,
  ExternalLink,
  GraduationCap
} from 'lucide-react';

const ensureUrl = (url: string) => url.startsWith('http') ? url : `https://${url}`;

interface Experience {
  id: number;
  empresa: string;
  puesto: string;
  ubicacion?: string;
  fechaInicio: string;
  fechaFin?: string;
  esActual: boolean;
  descripcion?: string;
}

interface Education {
  id: number;
  nivel: string;
  institucion: string;
  carrera: string;
  añoInicio?: number | null;
  añoFin?: number | null;
  estatus: string;
}

interface CandidateDocument {
  id: number;
  name: string;
  fileUrl: string;
  fileType?: string;
}

interface ProfileData {
  id: number;
  email: string;
  nombre: string;
  role: string;
  company?: string;
  credits?: number;
  candidate?: {
    id: number;
    nombre?: string;
    apellidoPaterno?: string;
    apellidoMaterno?: string;
    telefono?: string;
    fechaNacimiento?: string;
    sexo?: string;
    universidad?: string;
    carrera?: string;
    nivelEstudios?: string;
    añosExperiencia?: number;
    profile?: string;
    seniority?: string;
    linkedinUrl?: string;
    portafolioUrl?: string;
    cvUrl?: string;
    fotoUrl?: string; // FEAT-2: Foto de perfil
    cartaPresentacion?: string;
    experiences?: Experience[];
    educacion?: Education[];
  };
}

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state - Datos de User
  const [nombre, setNombre] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Candidate data - Información personal
  const [candidateNombre, setCandidateNombre] = useState('');
  const [apellidoPaterno, setApellidoPaterno] = useState('');
  const [apellidoMaterno, setApellidoMaterno] = useState('');
  const [telefono, setTelefono] = useState('');
  const [fechaNacimiento, setFechaNacimiento] = useState('');
  const [sexo, setSexo] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [estado, setEstado] = useState('');
  const [ubicacionCercana, setUbicacionCercana] = useState('');
  // FEAT-2: Foto de perfil
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const fotoInputRef = useRef<HTMLInputElement>(null);

  // Candidate data - Datos profesionales
  const [añosExperiencia, setAñosExperiencia] = useState<number | ''>('');
  const [profileField, setProfileField] = useState('');
  const [seniority, setSeniority] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [portafolioUrl, setPortafolioUrl] = useState('');
  const [cartaPresentacion, setCartaPresentacion] = useState('');

  // Experiencias
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [showExpModal, setShowExpModal] = useState(false);
  const [editingExp, setEditingExp] = useState<Experience | null>(null);
  const [expForm, setExpForm] = useState({
    empresa: '',
    puesto: '',
    ubicacion: '',
    fechaInicio: '',
    fechaFin: '',
    esActual: false,
    descripcion: ''
  });
  const [savingExp, setSavingExp] = useState(false);

  // Educación
  const [educacion, setEducacion] = useState<Education[]>([]);
  const [showEduModal, setShowEduModal] = useState(false);
  const [editingEdu, setEditingEdu] = useState<Education | null>(null);
  const [eduForm, setEduForm] = useState({
    nivel: '',
    institucion: '',
    carrera: '',
    añoInicio: '' as string | number,
    añoFin: '' as string | number,
    estatus: 'Completa'
  });

  // CV
  const [cvUrl, setCvUrl] = useState<string | null>(null);
  const [uploadingCv, setUploadingCv] = useState(false);
  const cvInputRef = useRef<HTMLInputElement>(null);

  // Documentos adicionales
  const [documents, setDocuments] = useState<CandidateDocument[]>([]);
  const [showAddDocModal, setShowAddDocModal] = useState(false);
  const [newDocName, setNewDocName] = useState('');
  const [newDocFile, setNewDocFile] = useState<File | null>(null);
  const [savingDoc, setSavingDoc] = useState(false);
  const docInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchProfile();
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const response = await fetch('/api/profile/documents', { credentials: 'include' });
      const data = await response.json();
      if (data.success) {
        setDocuments(data.data || []);
      }
    } catch (err) {
      console.error('Error fetching documents:', err);
    }
  };

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/profile', {
        credentials: 'include'
      });

      if (response.status === 401) {
        router.push('/login');
        return;
      }

      const data = await response.json();
      if (data.success) {
        setProfile(data.data);
        setNombre(data.data.nombre || '');

        // Cargar datos de candidato si existen
        if (data.data.candidate) {
          const c = data.data.candidate;
          setCandidateNombre(c.nombre || '');
          setApellidoPaterno(c.apellidoPaterno || '');
          setApellidoMaterno(c.apellidoMaterno || '');
          setTelefono(c.telefono || '');
          setFechaNacimiento(c.fechaNacimiento ? c.fechaNacimiento.split('T')[0] : '');
          setSexo(c.sexo || '');
          setCiudad(c.ciudad || '');
          setEstado(c.estado || '');
          setUbicacionCercana(c.ubicacionCercana || '');
          setAñosExperiencia(c.añosExperiencia ?? '');
          setProfileField(c.profile || '');
          setSeniority(c.seniority || '');
          setLinkedinUrl(c.linkedinUrl || '');
          setPortafolioUrl(c.portafolioUrl || '');
          setCartaPresentacion(c.cartaPresentacion || '');
          setCvUrl(c.cvUrl || null);
          setFotoUrl(c.fotoUrl || null); // FEAT-2: Foto de perfil
          setExperiences(c.experiences || []);
          setEducacion(c.educacion || []);
        }
      } else {
        setError(data.error || 'Error al cargar perfil');
      }
    } catch (err) {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validar passwords si se quiere cambiar
    if (newPassword || confirmPassword) {
      if (!currentPassword) {
        setError('Debes ingresar tu contraseña actual');
        return;
      }
      if (newPassword !== confirmPassword) {
        setError('Las contraseñas nuevas no coinciden');
        return;
      }
      if (newPassword.length < 8) {
        setError('La nueva contraseña debe tener al menos 8 caracteres');
        return;
      }
    }

    try {
      setSaving(true);

      const updateData: any = { nombre };

      if (newPassword && currentPassword) {
        updateData.currentPassword = currentPassword;
        updateData.newPassword = newPassword;
      }

      // Si es candidato, incluir datos adicionales
      if (profile?.candidate) {
        updateData.candidateData = {
          nombre: candidateNombre,
          apellidoPaterno,
          apellidoMaterno,
          telefono,
          fechaNacimiento: fechaNacimiento || null,
          sexo: sexo || null,
          ciudad: ciudad || null,
          estado: estado || null,
          ubicacionCercana: ubicacionCercana || null,
          añosExperiencia: añosExperiencia === '' ? null : añosExperiencia,
          profile: profileField,
          seniority,
          linkedinUrl,
          portafolioUrl,
          cartaPresentacion: cartaPresentacion || null,
          educacion: educacion
        };
      }

      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updateData)
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('Perfil actualizado exitosamente');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        fetchProfile();
      } else {
        setError(data.error || 'Error al actualizar');
      }
    } catch (err) {
      setError('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  // Experiencias - CRUD
  const openExpModal = (exp?: Experience) => {
    if (exp) {
      setEditingExp(exp);
      setExpForm({
        empresa: exp.empresa,
        puesto: exp.puesto,
        ubicacion: exp.ubicacion || '',
        fechaInicio: exp.fechaInicio.split('T')[0],
        fechaFin: exp.fechaFin ? exp.fechaFin.split('T')[0] : '',
        esActual: exp.esActual,
        descripcion: exp.descripcion || ''
      });
    } else {
      setEditingExp(null);
      setExpForm({
        empresa: '',
        puesto: '',
        ubicacion: '',
        fechaInicio: '',
        fechaFin: '',
        esActual: false,
        descripcion: ''
      });
    }
    setShowExpModal(true);
  };

  const saveExperience = async () => {
    if (!expForm.empresa || !expForm.puesto || !expForm.fechaInicio) {
      setError('Empresa, puesto y fecha de inicio son requeridos');
      return;
    }

    // Validar que fechaFin no sea anterior a fechaInicio
    if (expForm.fechaFin && !expForm.esActual) {
      if (new Date(expForm.fechaFin) < new Date(expForm.fechaInicio)) {
        setError('La fecha de fin no puede ser anterior a la fecha de inicio');
        return;
      }
    }

    try {
      setSavingExp(true);
      setError('');

      const url = editingExp
        ? `/api/profile/experience/${editingExp.id}`
        : '/api/profile/experience';
      const method = editingExp ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(expForm)
      });

      const data = await response.json();

      if (data.success) {
        setShowExpModal(false);
        setSuccess(editingExp ? 'Experiencia actualizada' : 'Experiencia agregada');
        fetchProfile();
      } else {
        setError(data.error || 'Error al guardar experiencia');
      }
    } catch (err) {
      setError('Error de conexión');
    } finally {
      setSavingExp(false);
    }
  };

  const deleteExperience = async (expId: number) => {
    if (!confirm('¿Estás seguro de eliminar esta experiencia?')) return;

    try {
      const response = await fetch(`/api/profile/experience/${expId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('Experiencia eliminada');
        fetchProfile();
      } else {
        setError(data.error || 'Error al eliminar');
      }
    } catch (err) {
      setError('Error de conexión');
    }
  };

  // Educación - CRUD (local, se guarda con el perfil)
  const openEduModal = (edu?: Education) => {
    if (edu) {
      setEditingEdu(edu);
      setEduForm({
        nivel: edu.nivel,
        institucion: edu.institucion,
        carrera: edu.carrera,
        añoInicio: edu.añoInicio || '',
        añoFin: edu.añoFin || '',
        estatus: edu.estatus
      });
    } else {
      setEditingEdu(null);
      setEduForm({
        nivel: '',
        institucion: '',
        carrera: '',
        añoInicio: '',
        añoFin: '',
        estatus: 'Completa'
      });
    }
    setShowEduModal(true);
  };

  const saveEducation = () => {
    if (!eduForm.nivel || !eduForm.institucion) {
      setError('Nivel de estudios e institución son requeridos');
      return;
    }

    const newEdu: Education = {
      id: editingEdu ? editingEdu.id : Date.now(),
      nivel: eduForm.nivel,
      institucion: eduForm.institucion,
      carrera: eduForm.carrera,
      añoInicio: eduForm.añoInicio ? Number(eduForm.añoInicio) : null,
      añoFin: eduForm.añoFin ? Number(eduForm.añoFin) : null,
      estatus: eduForm.estatus
    };

    if (editingEdu) {
      setEducacion(prev => prev.map(e => e.id === editingEdu.id ? newEdu : e));
      setSuccess('Educación actualizada. Guarda tu perfil para aplicar los cambios.');
    } else {
      setEducacion(prev => [...prev, newEdu]);
      setSuccess('Educación agregada. Guarda tu perfil para aplicar los cambios.');
    }

    setShowEduModal(false);
    setEditingEdu(null);
  };

  const deleteEducation = (eduId: number) => {
    if (!confirm('¿Estás seguro de eliminar esta entrada de educación?')) return;
    setEducacion(prev => prev.filter(e => e.id !== eduId));
    setSuccess('Educación eliminada. Guarda tu perfil para aplicar los cambios.');
  };

  // CV Upload
  const handleCvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tamaño
    if (file.size > 5 * 1024 * 1024) {
      setError('El archivo excede el tamaño máximo de 5MB');
      return;
    }

    try {
      setUploadingCv(true);
      setError('');

      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'cv');

      const response = await fetch('/api/profile/documents', {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      const data = await response.json();

      if (data.success) {
        setCvUrl(data.data.url);
        setSuccess('CV subido exitosamente');
      } else {
        setError(data.error || 'Error al subir CV');
      }
    } catch (err) {
      setError('Error al subir archivo');
    } finally {
      setUploadingCv(false);
      if (cvInputRef.current) cvInputRef.current.value = '';
    }
  };

  const deleteCv = async () => {
    if (!confirm('¿Estás seguro de eliminar tu CV?')) return;

    try {
      const response = await fetch('/api/profile/documents?type=cv', {
        method: 'DELETE',
        credentials: 'include'
      });

      const data = await response.json();

      if (data.success) {
        setCvUrl(null);
        setSuccess('CV eliminado');
      } else {
        setError(data.error || 'Error al eliminar CV');
      }
    } catch (err) {
      setError('Error de conexión');
    }
  };

  // FEAT-2: Subir foto de perfil
  const handleFotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tamaño (máximo 2MB para fotos)
    if (file.size > 2 * 1024 * 1024) {
      setError('La foto no debe exceder 2MB');
      return;
    }
    // Validar tipo de archivo
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Solo se permiten imágenes JPG, PNG o WebP');
      return;
    }

    try {
      setUploadingFoto(true);
      setError('');

      const formData = new FormData();
      formData.append('file', file);

      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      if (!uploadRes.ok) {
        const errorData = await uploadRes.json().catch(() => ({}));
        throw new Error(errorData.error || 'Error al subir foto');
      }

      const uploadData = await uploadRes.json();

      if (!uploadData.success) {
        setError(uploadData.error || 'Error al subir foto');
        return;
      }

      // Guardar URL de foto en el perfil
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          candidateData: { fotoUrl: uploadData.url }
        })
      });

      const data = await response.json();

      if (data.success) {
        setFotoUrl(uploadData.url);
        setSuccess('Foto actualizada exitosamente');
      } else {
        setError(data.error || 'Error al guardar foto');
      }
    } catch (err) {
      setError('Error al subir foto');
    } finally {
      setUploadingFoto(false);
      if (fotoInputRef.current) fotoInputRef.current.value = '';
    }
  };

  // Documentos adicionales - CRUD
  const handleAddDocument = async () => {
    if (!newDocName.trim()) {
      setError('El nombre del documento es requerido');
      return;
    }
    if (!newDocFile) {
      setError('Selecciona un archivo');
      return;
    }

    try {
      setSavingDoc(true);
      setError('');

      // 1. Subir archivo
      const formData = new FormData();
      formData.append('file', newDocFile);

      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        credentials: 'include',
        body: formData
      });
      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json().catch(() => ({}));
        throw new Error(errorData.error || 'Error al subir archivo');
      }

      const uploadData = await uploadResponse.json();

      if (!uploadData.success) {
        setError(uploadData.error || 'Error al subir archivo');
        return;
      }

      // 2. Crear documento
      const docResponse = await fetch('/api/profile/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: newDocName.trim(),
          fileUrl: uploadData.url,
          fileType: newDocFile.type.split('/')[1] || 'file'
        })
      });
      if (!docResponse.ok) {
        const errorData = await docResponse.json().catch(() => ({}));
        throw new Error(errorData.error || 'Error al guardar documento');
      }

      const docData = await docResponse.json();

      if (docData.success) {
        setShowAddDocModal(false);
        setNewDocName('');
        setNewDocFile(null);
        if (docInputRef.current) docInputRef.current.value = '';
        setSuccess('Documento agregado exitosamente');
        fetchDocuments();
      } else {
        setError(docData.error || 'Error al guardar documento');
      }
    } catch (err) {
      setError('Error de conexión');
    } finally {
      setSavingDoc(false);
    }
  };

  const deleteDocument = async (docId: number) => {
    if (!confirm('¿Estás seguro de eliminar este documento?')) return;

    try {
      const response = await fetch(`/api/profile/documents?id=${docId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('Documento eliminado');
        fetchDocuments();
      } else {
        setError(data.error || 'Error al eliminar documento');
      }
    } catch (err) {
      setError('Error de conexión');
    }
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      admin: 'Administrador',
      company: 'Empresa',
      recruiter: 'Reclutador',
      specialist: 'Especialista',
      candidate: 'Candidato',
      user: 'Usuario'
    };
    return labels[role] || role;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long'
    });
  };

  const calculateAge = (birthDate: string) => {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pt-32 pb-12 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-button-orange" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50 pt-32 pb-12">
        <div className="max-w-2xl mx-auto px-4">
          <div className="bg-red-50 text-red-700 p-4 rounded-lg">
            Error al cargar el perfil
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-24 md:pt-32 pb-12">
      <div className="max-w-3xl mx-auto px-4">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-4 md:p-6 mb-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left">
            {/* FEAT-2: Foto de perfil con upload */}
            <div className="relative">
              <div className="w-14 h-14 md:w-16 md:h-16 bg-gray-100 rounded-full flex items-center justify-center overflow-hidden border-2 border-gray-200 flex-shrink-0">
                {fotoUrl ? (
                  <img src={fotoUrl} alt="Foto de perfil" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xl md:text-2xl font-bold text-button-orange">
                    {candidateNombre || nombre ? (candidateNombre || nombre).substring(0, 2).toUpperCase() : profile.email.substring(0, 2).toUpperCase()}
                  </span>
                )}
              </div>
              {profile.candidate && (
                <label className="absolute bottom-0 right-0 w-6 h-6 bg-button-orange rounded-full flex items-center justify-center cursor-pointer hover:bg-orange-600 shadow-lg">
                  {uploadingFoto ? (
                    <Loader2 className="w-3 h-3 text-white animate-spin" />
                  ) : (
                    <Upload className="w-3 h-3 text-white" />
                  )}
                  <input
                    type="file"
                    ref={fotoInputRef}
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handleFotoUpload}
                    disabled={uploadingFoto}
                  />
                </label>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl md:text-2xl font-bold text-gray-900 truncate">
                {candidateNombre && apellidoPaterno
                  ? `${candidateNombre} ${apellidoPaterno} ${apellidoMaterno || ''}`
                  : nombre || profile.email}
              </h1>
              <p className="text-gray-500 text-sm md:text-base truncate">{profile.email}</p>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-1">
                <span className="px-3 py-1 bg-button-orange/10 text-button-orange text-sm font-medium rounded-full">
                  {getRoleLabel(profile.role)}
                </span>
                {fechaNacimiento && (
                  <span className="text-sm text-gray-500">
                    {calculateAge(fechaNacimiento)} años
                  </span>
                )}
              </div>
            </div>
          </div>

          {profile.role === 'company' && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-600">
                Empresa: <span className="font-semibold">{profile.company || 'No especificada'}</span>
              </p>
              <p className="text-sm text-gray-600">
                Créditos disponibles: <span className="font-bold text-green-600">{profile.credits || 0}</span>
              </p>
            </div>
          )}
        </div>

        {/* Messages */}
        {error && (
          <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-6 flex items-center gap-2">
            <span>{error}</span>
            <button onClick={() => setError('')} className="ml-auto">×</button>
          </div>
        )}

        {success && (
          <div className="bg-green-50 text-green-700 p-4 rounded-lg mb-6 flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            <span>{success}</span>
            <button onClick={() => setSuccess('')} className="ml-auto">×</button>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Datos de cuenta */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <User className="w-5 h-5" />
              Datos de Cuenta
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre de usuario
                </label>
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-button-orange focus:border-button-orange"
                  placeholder="Tu nombre de usuario"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={profile.email}
                  disabled
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500"
                />
                <p className="text-xs text-gray-500 mt-1">El email no se puede cambiar</p>
              </div>
            </div>
          </div>

          {/* Datos personales de Candidato */}
          {profile.candidate && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">
                Información Personal
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre *
                  </label>
                  <input
                    type="text"
                    value={candidateNombre}
                    onChange={(e) => setCandidateNombre(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-button-orange focus:border-button-orange"
                    placeholder="Juan"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Apellido Paterno *
                  </label>
                  <input
                    type="text"
                    value={apellidoPaterno}
                    onChange={(e) => setApellidoPaterno(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-button-orange focus:border-button-orange"
                    placeholder="Pérez"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Apellido Materno
                  </label>
                  <input
                    type="text"
                    value={apellidoMaterno}
                    onChange={(e) => setApellidoMaterno(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-button-orange focus:border-button-orange"
                    placeholder="García"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fecha de Nacimiento
                  </label>
                  <input
                    type="date"
                    value={fechaNacimiento}
                    onChange={(e) => setFechaNacimiento(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-button-orange focus:border-button-orange"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Teléfono
                  </label>
                  <input
                    type="tel"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-button-orange focus:border-button-orange"
                    placeholder="+52 555 123 4567"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sexo
                  </label>
                  <select
                    value={sexo}
                    onChange={(e) => setSexo(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-button-orange focus:border-button-orange"
                  >
                    <option value="">Seleccionar...</option>
                    <option value="M">Masculino</option>
                    <option value="F">Femenino</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ciudad
                  </label>
                  <input
                    type="text"
                    value={ciudad}
                    onChange={(e) => setCiudad(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-button-orange focus:border-button-orange"
                    placeholder="Tu ciudad"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Estado
                  </label>
                  <input
                    type="text"
                    value={estado}
                    onChange={(e) => setEstado(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-button-orange focus:border-button-orange"
                    placeholder="Tu estado"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ubicación cercana
                  </label>
                  <input
                    type="text"
                    value={ubicacionCercana}
                    onChange={(e) => setUbicacionCercana(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-button-orange focus:border-button-orange"
                    placeholder="Colonia, zona o referencia"
                  />
                  <p className="text-gray-400 text-xs mt-1">
                    Indica una ubicación cercana o de referencia (por ejemplo, tu colonia o zona). No es necesario que sea exacta. Esta información sólo se utiliza para ofrecerte oportunidades cercanas a ti.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Educación del Candidato */}
          {profile.candidate && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <GraduationCap className="w-5 h-5" />
                  Educación
                </h2>
                <button
                  type="button"
                  onClick={() => openEduModal()}
                  className="flex items-center gap-1 px-3 py-2 bg-button-orange text-white text-sm rounded-lg hover:bg-opacity-90"
                >
                  <Plus size={16} />
                  Agregar
                </button>
              </div>

              {educacion.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <GraduationCap className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p>No has agregado información de educación</p>
                  <p className="text-sm">Agrega tu formación académica para mejorar tu perfil</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {educacion.map((edu) => (
                    <div key={edu.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-semibold text-gray-900">{edu.carrera || edu.nivel}</h4>
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              edu.estatus === 'Completa' ? 'bg-green-100 text-green-700' :
                              edu.estatus === 'En curso' ? 'bg-blue-100 text-blue-700' :
                              'bg-yellow-100 text-yellow-700'
                            }`}>
                              {edu.estatus}
                            </span>
                          </div>
                          <p className="text-gray-600 mt-1">{edu.institucion}</p>
                          <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                            <span className="px-2 py-0.5 bg-gray-100 rounded">{edu.nivel}</span>
                            {(edu.añoInicio || edu.añoFin) && (
                              <span>
                                {edu.añoInicio || '?'} - {edu.añoFin || 'Presente'}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEduModal(edu)}
                            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteEducation(edu.id)}
                            className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Datos Profesionales de Candidato */}
          {profile.candidate && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">
                Datos Profesionales
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Años de Experiencia
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="50"
                    value={añosExperiencia}
                    onChange={(e) => setAñosExperiencia(e.target.value === '' ? '' : parseInt(e.target.value))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-button-orange focus:border-button-orange"
                    placeholder="Ej: 5"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Perfil / Área
                  </label>
                  <input
                    type="text"
                    value={profileField}
                    onChange={(e) => setProfileField(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-button-orange focus:border-button-orange"
                    placeholder="Ej: Tecnología, Marketing"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Seniority
                  </label>
                  <select
                    value={seniority}
                    onChange={(e) => setSeniority(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-button-orange focus:border-button-orange"
                  >
                    <option value="">Seleccionar...</option>
                    <option value="Practicante">Practicante</option>
                    <option value="Jr">Jr</option>
                    <option value="Middle">Middle</option>
                    <option value="Sr">Sr</option>
                    <option value="Director">Director</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    LinkedIn URL
                  </label>
                  <input
                    type="url"
                    value={linkedinUrl}
                    onChange={(e) => setLinkedinUrl(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-button-orange focus:border-button-orange"
                    placeholder="https://linkedin.com/in/..."
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Portfolio URL
                  </label>
                  <input
                    type="url"
                    value={portafolioUrl}
                    onChange={(e) => setPortafolioUrl(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-button-orange focus:border-button-orange"
                    placeholder="https://miportfolio.com"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Carta de Presentación */}
          {profile.candidate && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Carta de Presentación
              </h2>
              <textarea
                value={cartaPresentacion}
                onChange={(e) => {
                  if (e.target.value.length <= 1000) setCartaPresentacion(e.target.value);
                }}
                placeholder="Redacta una breve introducción que resuma quién eres profesionalmente, tu experiencia clave y el tipo de oportunidades que buscas."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-button-orange focus:border-button-orange resize-none"
                rows={5}
              />
              <div className="flex justify-between items-center mt-2">
                <p className="text-xs text-gray-500">
                  Esta carta será visible para las empresas que revisen tu perfil.
                </p>
                <span className={`text-xs ${cartaPresentacion.length >= 1000 ? 'text-red-500' : 'text-gray-400'}`}>
                  {cartaPresentacion.length}/1000
                </span>
              </div>
            </div>
          )}

          {/* Documentos - CV */}
          {profile.candidate && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Mi Curriculum Vitae
              </h2>

              {cvUrl ? (
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <FileText className="w-8 h-8 text-blue-600" />
                    <div>
                      <p className="font-medium text-gray-900">CV cargado</p>
                      <a
                        href={ensureUrl(cvUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                      >
                        Ver documento <ExternalLink size={14} />
                      </a>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="cursor-pointer px-3 py-2 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">
                      Reemplazar
                      <input
                        type="file"
                        ref={cvInputRef}
                        onChange={handleCvUpload}
                        accept=".pdf,.doc,.docx"
                        className="hidden"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={deleteCv}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                  <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600 mb-3">Sube tu CV para usarlo en tus postulaciones</p>
                  <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-button-orange text-white rounded-lg hover:bg-opacity-90">
                    {uploadingCv ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Subiendo...
                      </>
                    ) : (
                      <>
                        <Upload size={18} />
                        Seleccionar archivo
                      </>
                    )}
                    <input
                      type="file"
                      ref={cvInputRef}
                      onChange={handleCvUpload}
                      accept=".pdf,.doc,.docx"
                      className="hidden"
                      disabled={uploadingCv}
                    />
                  </label>
                  <p className="text-xs text-gray-500 mt-2">PDF, DOC, DOCX (máx. 5MB)</p>
                </div>
              )}
            </div>
          )}

          {/* Mis Documentos */}
          {profile.candidate && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Mis Documentos
                </h2>
                <button
                  type="button"
                  onClick={() => setShowAddDocModal(true)}
                  className="flex items-center gap-1 px-3 py-2 bg-button-orange text-white text-sm rounded-lg hover:bg-opacity-90"
                >
                  <Plus size={16} />
                  Agregar
                </button>
              </div>

              {documents.length === 0 ? (
                <p className="text-gray-500 text-center py-4">
                  No tienes documentos adicionales. Agrega títulos, certificaciones, etc.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {documents.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <FileText className="w-6 h-6 text-blue-600" />
                        <div>
                          <p className="font-medium text-gray-900">{doc.name}</p>
                          <a
                            href={doc.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline"
                          >
                            Ver documento
                          </a>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => deleteDocument(doc.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Experiencia Laboral */}
          {profile.candidate && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Briefcase className="w-5 h-5" />
                  Experiencia Laboral
                </h2>
                <button
                  type="button"
                  onClick={() => openExpModal()}
                  className="flex items-center gap-1 px-3 py-2 bg-button-orange text-white text-sm rounded-lg hover:bg-opacity-90"
                >
                  <Plus size={16} />
                  Agregar
                </button>
              </div>

              {experiences.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Briefcase className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p>No has agregado experiencias laborales</p>
                  <p className="text-sm">Agrega tus empleos anteriores para mejorar tu perfil</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {experiences.map((exp) => (
                    <div key={exp.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900">{exp.puesto}</h4>
                          <div className="flex items-center gap-2 text-gray-600 mt-1">
                            <Building size={14} />
                            <span>{exp.empresa}</span>
                            {exp.ubicacion && (
                              <>
                                <span className="text-gray-400">•</span>
                                <MapPin size={14} />
                                <span>{exp.ubicacion}</span>
                              </>
                            )}
                          </div>
                          <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
                            <Calendar size={14} />
                            <span>
                              {formatDate(exp.fechaInicio)} - {exp.esActual ? 'Presente' : exp.fechaFin ? formatDate(exp.fechaFin) : 'N/A'}
                            </span>
                            {exp.esActual && (
                              <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded">
                                Actual
                              </span>
                            )}
                          </div>
                          {exp.descripcion && (
                            <p className="text-sm text-gray-600 mt-2">{exp.descripcion}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openExpModal(exp)}
                            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteExperience(exp.id)}
                            className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Cambiar contraseña */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Lock className="w-5 h-5" />
              Cambiar Contraseña
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              Deja estos campos vacíos si no deseas cambiar tu contraseña
            </p>

            <div className="space-y-4">
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contraseña actual
                </label>
                <input
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-button-orange focus:border-button-orange pr-10"
                  placeholder="Tu contraseña actual"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-8 text-gray-400 hover:text-gray-600"
                >
                  {showCurrentPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nueva contraseña
                </label>
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-button-orange focus:border-button-orange pr-10"
                  placeholder="Mínimo 8 caracteres"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-8 text-gray-400 hover:text-gray-600"
                >
                  {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Confirmar nueva contraseña
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-button-orange focus:border-button-orange"
                  placeholder="Repite la nueva contraseña"
                />
              </div>
            </div>
          </div>

          {/* Submit button */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 bg-button-orange text-white px-6 py-3 rounded-lg hover:bg-opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Guardar Cambios
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Modal de Experiencia */}
      {showExpModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="text-lg font-bold">
                {editingExp ? 'Editar Experiencia' : 'Nueva Experiencia'}
              </h3>
              <button onClick={() => setShowExpModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Empresa *
                </label>
                <input
                  type="text"
                  value={expForm.empresa}
                  onChange={(e) => setExpForm({ ...expForm, empresa: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-button-orange focus:border-button-orange"
                  placeholder="Nombre de la empresa"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Puesto *
                </label>
                <input
                  type="text"
                  value={expForm.puesto}
                  onChange={(e) => setExpForm({ ...expForm, puesto: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-button-orange focus:border-button-orange"
                  placeholder="Título del puesto"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ubicación
                </label>
                <input
                  type="text"
                  value={expForm.ubicacion}
                  onChange={(e) => setExpForm({ ...expForm, ubicacion: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-button-orange focus:border-button-orange"
                  placeholder="Ciudad, País"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fecha Inicio *
                  </label>
                  <input
                    type="date"
                    value={expForm.fechaInicio}
                    onChange={(e) => setExpForm({ ...expForm, fechaInicio: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-button-orange focus:border-button-orange"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fecha Fin
                  </label>
                  <input
                    type="date"
                    value={expForm.fechaFin}
                    onChange={(e) => setExpForm({ ...expForm, fechaFin: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-button-orange focus:border-button-orange"
                    disabled={expForm.esActual}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="esActual"
                  checked={expForm.esActual}
                  onChange={(e) => setExpForm({ ...expForm, esActual: e.target.checked, fechaFin: '' })}
                  className="w-4 h-4 text-button-orange rounded"
                />
                <label htmlFor="esActual" className="text-sm text-gray-700">
                  Trabajo actual
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descripción
                </label>
                <textarea
                  value={expForm.descripcion}
                  onChange={(e) => setExpForm({ ...expForm, descripcion: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-button-orange focus:border-button-orange"
                  rows={3}
                  placeholder="Describe tus responsabilidades y logros..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 p-4 border-t">
              <button
                type="button"
                onClick={() => setShowExpModal(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={saveExperience}
                disabled={savingExp}
                className="flex items-center gap-2 px-4 py-2 bg-button-orange text-white rounded-lg hover:bg-opacity-90 disabled:opacity-50"
              >
                {savingExp ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    Guardar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Educación */}
      {showEduModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="text-lg font-bold">
                {editingEdu ? 'Editar Educación' : 'Nueva Educación'}
              </h3>
              <button onClick={() => setShowEduModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nivel de Estudios *
                </label>
                <select
                  value={eduForm.nivel}
                  onChange={(e) => setEduForm({ ...eduForm, nivel: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-button-orange focus:border-button-orange"
                >
                  <option value="">Seleccionar...</option>
                  <option value="Preparatoria">Preparatoria</option>
                  <option value="Técnico">Técnico</option>
                  <option value="Licenciatura">Licenciatura</option>
                  <option value="Posgrado">Posgrado</option>
                  <option value="Diplomado">Diplomado</option>
                  <option value="Certificación">Certificación</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Institución / Universidad *
                </label>
                <input
                  type="text"
                  value={eduForm.institucion}
                  onChange={(e) => setEduForm({ ...eduForm, institucion: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-button-orange focus:border-button-orange"
                  placeholder="Nombre de la institución"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Carrera / Programa
                </label>
                <input
                  type="text"
                  value={eduForm.carrera}
                  onChange={(e) => setEduForm({ ...eduForm, carrera: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-button-orange focus:border-button-orange"
                  placeholder="Ej: Ingeniería en Sistemas, MBA"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Año de Inicio
                  </label>
                  <input
                    type="number"
                    min="1950"
                    max="2030"
                    value={eduForm.añoInicio}
                    onChange={(e) => setEduForm({ ...eduForm, añoInicio: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-button-orange focus:border-button-orange"
                    placeholder="Ej: 2018"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Año de Fin
                  </label>
                  <input
                    type="number"
                    min="1950"
                    max="2030"
                    value={eduForm.añoFin}
                    onChange={(e) => setEduForm({ ...eduForm, añoFin: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-button-orange focus:border-button-orange"
                    placeholder="Ej: 2022"
                    disabled={eduForm.estatus === 'En curso'}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Estatus
                </label>
                <select
                  value={eduForm.estatus}
                  onChange={(e) => setEduForm({
                    ...eduForm,
                    estatus: e.target.value,
                    añoFin: e.target.value === 'En curso' ? '' : eduForm.añoFin
                  })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-button-orange focus:border-button-orange"
                >
                  <option value="Completa">Completa</option>
                  <option value="En curso">En curso</option>
                  <option value="Trunca">Trunca</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 p-4 border-t">
              <button
                type="button"
                onClick={() => setShowEduModal(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={saveEducation}
                className="flex items-center gap-2 px-4 py-2 bg-button-orange text-white rounded-lg hover:bg-opacity-90"
              >
                <Save size={16} />
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Agregar Documento */}
      {showAddDocModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="text-lg font-bold">Agregar Documento</h3>
              <button
                onClick={() => {
                  setShowAddDocModal(false);
                  setNewDocName('');
                  setNewDocFile(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre del documento *
                </label>
                <input
                  type="text"
                  placeholder="Ej: Título universitario, Certificación AWS"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-button-orange focus:border-button-orange"
                  value={newDocName}
                  onChange={(e) => setNewDocName(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Archivo *
                </label>
                <input
                  type="file"
                  ref={docInputRef}
                  onChange={(e) => setNewDocFile(e.target.files?.[0] || null)}
                  className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-button-orange file:text-white hover:file:bg-opacity-90"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                />
                <p className="text-xs text-gray-500 mt-1">PDF, DOC, DOCX, JPG, PNG (máx. 5MB)</p>
              </div>

              {newDocFile && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-700">
                    Archivo seleccionado: <span className="font-medium">{newDocFile.name}</span>
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 p-4 border-t">
              <button
                type="button"
                onClick={() => {
                  setShowAddDocModal(false);
                  setNewDocName('');
                  setNewDocFile(null);
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleAddDocument}
                disabled={savingDoc || !newDocName.trim() || !newDocFile}
                className="flex items-center gap-2 px-4 py-2 bg-button-orange text-white rounded-lg hover:bg-opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingDoc ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    Guardar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
