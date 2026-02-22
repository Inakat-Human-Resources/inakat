// RUTA: src/app/register/page.tsx

'use client';

import React, { useState, useEffect, FormEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Eye,
  EyeOff,
  User,
  GraduationCap,
  Briefcase,
  Link as LinkIcon,
  FileText,
  Plus,
  Trash2,
  Upload,
  Loader2,
  ChevronRight,
  ChevronLeft,
  Check
} from 'lucide-react';
import ErrorToast from '@/components/shared/ErrorToast';
import loginImage from '@/assets/images/6-login/1.png';
import logoIcon from '@/assets/images/6-login/logo-dark-green.png';

// Interfaces
interface Education {
  id: number;
  nivel: string;
  institucion: string;
  carrera: string;
  añoInicio?: number | null;
  añoFin?: number | null;
  estatus: string;
}

interface Experience {
  empresa: string;
  puesto: string;
  ubicacion: string;
  fechaInicio: string;
  fechaFin: string;
  esActual: boolean;
  descripcion: string;
}

interface Document {
  name: string;
  file: File | null;
  fileUrl: string;
  uploading: boolean;
}

interface Specialty {
  id: number;
  name: string;
  subcategories: string[];
}

interface FormErrors {
  [key: string]: string;
}

// Constantes
const STEPS = [
  { id: 1, name: 'Personal', icon: User },
  { id: 2, name: 'Educación', icon: GraduationCap },
  { id: 3, name: 'Profesional', icon: Briefcase },
  { id: 4, name: 'Experiencia', icon: Briefcase },
  { id: 5, name: 'Links', icon: LinkIcon },
  { id: 6, name: 'Documentos', icon: FileText }
];

const SENIORITIES = ['Practicante', 'Jr', 'Middle', 'Sr', 'Director'];
const NIVELES_ESTUDIO = ['Preparatoria', 'Técnico', 'Licenciatura', 'Posgrado'];

export default function RegisterPage() {
  // Estado de navegación
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [stepTransitioning, setStepTransitioning] = useState(false); // FIX: Prevenir double-click en transición a paso 6

  // Paso 1: Datos personales
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [nombre, setNombre] = useState('');
  const [apellidoPaterno, setApellidoPaterno] = useState('');
  const [apellidoMaterno, setApellidoMaterno] = useState('');
  const [telefono, setTelefono] = useState('');
  const [sexo, setSexo] = useState('');
  const [fechaNacimiento, setFechaNacimiento] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [estado, setEstado] = useState('');
  const [ubicacionCercana, setUbicacionCercana] = useState('');
  // FEAT-2: Foto de perfil
  const [fotoUrl, setFotoUrl] = useState('');
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoUploading, setFotoUploading] = useState(false);

  // Paso 2: Educación (FEATURE: Educación múltiple)
  const [educations, setEducations] = useState<Education[]>([]);

  // Paso 3: Profesional
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [profile, setProfile] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [seniority, setSeniority] = useState('');

  // Paso 4: Experiencias
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [expErrors, setExpErrors] = useState<Record<number, string>>({});

  // Paso 5: Links
  const [cvUrl, setCvUrl] = useState('');
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [cvUploading, setCvUploading] = useState(false);
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [portafolioUrl, setPortafolioUrl] = useState('');

  // Paso 6: Documentos
  const [documents, setDocuments] = useState<Document[]>([]);

  // Cargar especialidades
  useEffect(() => {
    fetch('/api/specialties?subcategories=true')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setSpecialties(data.data);
        }
      })
      .catch(console.error);
  }, []);

  // Obtener subcategorías del perfil seleccionado
  const currentSubcategories = specialties.find(s => s.name === profile)?.subcategories || [];

  // Función de upload
  const uploadFile = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    return data.url;
  };

  // Manejar upload de CV
  const handleCvUpload = async (file: File) => {
    setCvUploading(true);
    try {
      const url = await uploadFile(file);
      setCvUrl(url);
      setCvFile(file);
    } catch (error) {
      console.error('Error uploading CV:', error);
      setErrors(prev => ({ ...prev, cvUrl: 'Error al subir el archivo' }));
    } finally {
      setCvUploading(false);
    }
  };

  // FEAT-2: Manejar upload de foto de perfil
  const handleFotoUpload = async (file: File) => {
    // Validar tamaño (máximo 2MB para fotos)
    if (file.size > 2 * 1024 * 1024) {
      setErrors(prev => ({ ...prev, fotoUrl: 'La foto no debe exceder 2MB' }));
      return;
    }
    // Validar tipo de archivo
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setErrors(prev => ({ ...prev, fotoUrl: 'Solo se permiten imágenes JPG, PNG o WebP' }));
      return;
    }
    setFotoUploading(true);
    setErrors(prev => { const { fotoUrl: _, ...rest } = prev; return rest; });
    try {
      const url = await uploadFile(file);
      setFotoUrl(url);
      setFotoFile(file);
    } catch (error) {
      console.error('Error uploading photo:', error);
      setErrors(prev => ({ ...prev, fotoUrl: 'Error al subir la foto' }));
    } finally {
      setFotoUploading(false);
    }
  };

  // Manejar experiencias
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

  const updateExperience = (index: number, field: keyof Experience, value: any) => {
    const updated = [...experiences];
    updated[index] = { ...updated[index], [field]: value };
    if (field === 'esActual' && value) {
      updated[index].fechaFin = '';
      setExpErrors(prev => { const n = { ...prev }; delete n[index]; return n; });
    }
    // Validar que fechaFin no sea anterior a fechaInicio
    if (field === 'fechaInicio' || field === 'fechaFin') {
      const exp = updated[index];
      if (exp.fechaInicio && exp.fechaFin && !exp.esActual) {
        if (new Date(exp.fechaFin) < new Date(exp.fechaInicio)) {
          setExpErrors(prev => ({ ...prev, [index]: 'La fecha de fin no puede ser anterior a la fecha de inicio' }));
        } else {
          setExpErrors(prev => { const n = { ...prev }; delete n[index]; return n; });
        }
      } else {
        setExpErrors(prev => { const n = { ...prev }; delete n[index]; return n; });
      }
    }
    setExperiences(updated);
  };

  const removeExperience = (index: number) => {
    setExperiences(experiences.filter((_, i) => i !== index));
  };

  // Manejar educaciones (FEATURE: Educación múltiple)
  const addEducation = () => {
    setEducations([
      ...educations,
      {
        id: Date.now(),
        nivel: '',
        institucion: '',
        carrera: '',
        añoInicio: null,
        añoFin: null,
        estatus: ''
      }
    ]);
  };

  const updateEducation = (index: number, field: keyof Education, value: any) => {
    const updated = [...educations];
    updated[index] = { ...updated[index], [field]: value };
    setEducations(updated);
  };

  const removeEducation = (index: number) => {
    setEducations(educations.filter((_, i) => i !== index));
  };

  // Manejar documentos
  const addDocument = () => {
    setDocuments([...documents, { name: '', file: null, fileUrl: '', uploading: false }]);
  };

  const updateDocument = async (index: number, field: keyof Document, value: any) => {
    const updated = [...documents];

    if (field === 'file' && value instanceof File) {
      updated[index].uploading = true;
      setDocuments(updated);

      try {
        const url = await uploadFile(value);
        updated[index].file = value;
        updated[index].fileUrl = url;
        updated[index].uploading = false;
      } catch (error) {
        console.error('Error uploading document:', error);
        updated[index].uploading = false;
      }
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }

    setDocuments(updated);
  };

  const removeDocument = (index: number) => {
    setDocuments(documents.filter((_, i) => i !== index));
  };

  // Manejadores de contraseña con validación en tiempo real
  const handlePasswordChange = (value: string) => {
    setPassword(value);

    // Validar fortaleza de contraseña en tiempo real
    const newErrors = { ...errors };

    if (value.length > 0 && value.length < 8) {
      newErrors.password = 'La contraseña debe tener al menos 8 caracteres';
    } else if (value.length >= 8 && !/[A-Z]/.test(value)) {
      newErrors.password = 'Debe contener al menos una mayúscula';
    } else if (value.length >= 8 && !/[0-9]/.test(value)) {
      newErrors.password = 'Debe contener al menos un número';
    } else {
      delete newErrors.password;
    }

    // Validar coincidencia si ya hay confirmPassword
    if (confirmPassword && value !== confirmPassword) {
      newErrors.confirmPassword = 'Las contraseñas no coinciden';
    } else if (confirmPassword && value === confirmPassword) {
      delete newErrors.confirmPassword;
    }

    setErrors(newErrors);
  };

  const handleConfirmPasswordChange = (value: string) => {
    setConfirmPassword(value);

    // Validar coincidencia en tiempo real
    const newErrors = { ...errors };

    if (value !== password) {
      newErrors.confirmPassword = 'Las contraseñas no coinciden';
    } else {
      delete newErrors.confirmPassword;
    }

    setErrors(newErrors);
  };

  // Validaciones por paso
  const validateStep = (step: number): boolean => {
    const newErrors: FormErrors = {};

    if (step === 1) {
      if (!nombre || nombre.trim().length < 2) {
        newErrors.nombre = 'El nombre es requerido (mínimo 2 caracteres)';
      }
      if (!apellidoPaterno || apellidoPaterno.trim().length < 2) {
        newErrors.apellidoPaterno = 'El apellido paterno es requerido';
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email || !emailRegex.test(email)) {
        newErrors.email = 'Email inválido';
      }
      if (!password || password.length < 8) {
        newErrors.password = 'La contraseña debe tener al menos 8 caracteres';
      } else if (!/[A-Z]/.test(password)) {
        newErrors.password = 'Debe contener al menos una mayúscula';
      } else if (!/[0-9]/.test(password)) {
        newErrors.password = 'Debe contener al menos un número';
      }
      if (password !== confirmPassword) {
        newErrors.confirmPassword = 'Las contraseñas no coinciden';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Navegación
  const handleNext = () => {
    if (validateStep(currentStep)) {
      const nextStep = Math.min(currentStep + 1, 6);
      // FIX: Protección contra double-click al llegar a paso 6
      if (nextStep === 6) {
        setStepTransitioning(true);
        setCurrentStep(nextStep);
        setTimeout(() => setStepTransitioning(false), 500);
      } else {
        setCurrentStep(nextStep);
      }
    }
  };

  const handlePrev = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  // Enviar formulario
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // FIX: Protección contra double-click en transición de paso
    if (stepTransitioning) return;

    // BUG-008 FIX: Solo permitir submit desde el último paso (6 - Documentos)
    // Evita que Enter en pasos anteriores envíe el formulario prematuramente
    if (currentStep < 6) {
      handleNext();
      return;
    }

    if (!validateStep(1)) {
      setCurrentStep(1);
      return;
    }

    // Validar errores de fechas en experiencias
    if (Object.keys(expErrors).length > 0) {
      setGeneralError('Corrige los errores en las fechas de experiencia antes de continuar');
      return;
    }

    setIsSubmitting(true);
    setGeneralError(null);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Auth
          email,
          password,
          // Datos personales
          nombre,
          apellidoPaterno,
          apellidoMaterno: apellidoMaterno || undefined,
          telefono: telefono || undefined,
          sexo: sexo || undefined,
          fechaNacimiento: fechaNacimiento || undefined,
          ciudad: ciudad || undefined,
          estado: estado || undefined,
          ubicacionCercana: ubicacionCercana || undefined,
          fotoUrl: fotoUrl || undefined, // FEAT-2: Foto de perfil
          // Educación (FEATURE: Educación múltiple)
          educacion: educations.filter(e => e.institucion || e.carrera || e.nivel),
          // Profesional
          profile: profile || undefined,
          subcategory: subcategory || undefined,
          seniority: seniority || undefined,
          // Links
          cvUrl: cvUrl || undefined,
          linkedinUrl: linkedinUrl || undefined,
          portafolioUrl: portafolioUrl || undefined,
          // Experiencias (filtrar vacías)
          experiences: experiences.filter(
            exp => exp.empresa && exp.puesto && exp.fechaInicio
          ),
          // Documentos (filtrar sin URL)
          documents: documents
            .filter(doc => doc.name && doc.fileUrl)
            .map(doc => ({ name: doc.name, fileUrl: doc.fileUrl }))
        })
      });

      const data = await response.json();

      if (response.ok) {
        setSuccessMessage('¡Registro exitoso! Bienvenido a INAKAT. Redirigiendo...');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setTimeout(() => {
          window.location.href = '/talents';
        }, 1500);
      } else {
        if (data.errors) {
          setErrors(data.errors);
          setCurrentStep(1);
          // Scroll hacia arriba para mostrar los errores
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
          setGeneralError(data.error || 'Error al registrarse');
        }
      }
    } catch (error) {
      setGeneralError('Error al conectar con el servidor');
      console.error('Error registering:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Input class helper
  const inputClass = (fieldName: string) =>
    `w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 ${
      errors[fieldName]
        ? 'border-red-500 focus:ring-red-500'
        : 'border-gray-300 focus:ring-button-green'
    }`;

  const selectClass = (fieldName: string) =>
    `w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 bg-white ${
      errors[fieldName]
        ? 'border-red-500 focus:ring-red-500'
        : 'border-gray-300 focus:ring-button-green'
    }`;

  return (
    <section className="bg-custom-beige min-h-screen flex items-center justify-center py-8 px-4">
      <ErrorToast
        message={generalError}
        onClose={() => setGeneralError(null)}
      />
      <div className="w-full max-w-6xl flex bg-white rounded-lg shadow-lg overflow-hidden min-h-[700px]">
        {/* Columna Izquierda: Imagen y Texto */}
        <div className="relative w-1/3 hidden lg:flex flex-col justify-center items-center p-8 bg-cover bg-center">
          <Image
            src={loginImage}
            alt="Register background"
            fill
            className="object-cover"
          />
          <div className="absolute inset-0 bg-black opacity-60"></div>
          <h2 className="relative text-white text-2xl font-bold text-center z-10">
            ÚNETE A INAKAT
            <br />
            <span className="text-lg font-normal mt-2 block">
              Completa tu perfil profesional
            </span>
          </h2>

          {/* Progress indicator */}
          <div className="relative z-10 mt-8 w-full max-w-[200px]">
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              const isCompleted = currentStep > step.id;
              const isCurrent = currentStep === step.id;

              return (
                <div key={step.id} className="flex items-center mb-3">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      isCompleted
                        ? 'bg-green-500'
                        : isCurrent
                        ? 'bg-button-green'
                        : 'bg-gray-500'
                    }`}
                  >
                    {isCompleted ? (
                      <Check size={16} className="text-white" />
                    ) : (
                      <Icon size={16} className="text-white" />
                    )}
                  </div>
                  <span
                    className={`ml-3 text-sm ${
                      isCurrent ? 'text-white font-semibold' : 'text-gray-300'
                    }`}
                  >
                    {step.name}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Columna Derecha: Formulario */}
        <div className="w-full lg:w-2/3 bg-soft-green p-6 md:p-8 flex flex-col">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-16 h-16 mx-auto mb-3">
              <Image
                src={logoIcon}
                alt="INAKAT Logo"
                width={64}
                height={64}
                className="object-contain"
              />
            </div>
            <h1 className="text-xl font-bold text-white">Crear Cuenta</h1>
            <p className="text-white text-sm opacity-90">
              Paso {currentStep} de 6: {STEPS[currentStep - 1].name}
            </p>
          </div>

          {/* Mobile progress bar */}
          <div className="lg:hidden mb-6">
            <div className="flex justify-between text-xs text-white mb-2">
              <span>Progreso</span>
              <span>{Math.round((currentStep / 6) * 100)}%</span>
            </div>
            <div className="h-2 bg-white/30 rounded-full">
              <div
                className="h-full bg-button-green rounded-full transition-all"
                style={{ width: `${(currentStep / 6) * 100}%` }}
              />
            </div>
          </div>

          {/* Error general */}
          {/* Mensaje de éxito */}
          {successMessage && (
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg mb-4">
              {successMessage}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex-1 flex flex-col">
            <div className="flex-1 overflow-y-auto">
              {/* Paso 1: Datos Personales */}
              {currentStep === 1 && (
                <div className="space-y-4">
                  {/* FEAT-2: Foto de perfil */}
                  <div className="flex flex-col items-center mb-4">
                    <label className="block text-white text-sm mb-2">Foto de perfil (opcional)</label>
                    <div className="relative">
                      <div className="w-24 h-24 rounded-full overflow-hidden bg-white/20 border-2 border-white/40 flex items-center justify-center">
                        {fotoUrl ? (
                          <img src={fotoUrl} alt="Preview" className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-10 h-10 text-white/50" />
                        )}
                      </div>
                      <label className="absolute bottom-0 right-0 w-8 h-8 bg-button-green rounded-full flex items-center justify-center cursor-pointer hover:bg-green-700 shadow-lg">
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
                    {errors.fotoUrl && (
                      <p className="text-red-300 text-xs mt-1">{errors.fotoUrl}</p>
                    )}
                    <p className="text-white/60 text-xs mt-1">JPG, PNG o WebP (máx 2MB)</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-white text-sm mb-1">Nombre *</label>
                      <input
                        type="text"
                        value={nombre}
                        onChange={(e) => setNombre(e.target.value)}
                        className={inputClass('nombre')}
                        placeholder="Tu nombre"
                      />
                      {errors.nombre && (
                        <p className="text-red-300 text-xs mt-1">{errors.nombre}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-white text-sm mb-1">Apellido Paterno *</label>
                      <input
                        type="text"
                        value={apellidoPaterno}
                        onChange={(e) => setApellidoPaterno(e.target.value)}
                        className={inputClass('apellidoPaterno')}
                        placeholder="Tu apellido paterno"
                      />
                      {errors.apellidoPaterno && (
                        <p className="text-red-300 text-xs mt-1">{errors.apellidoPaterno}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-white text-sm mb-1">Apellido Materno</label>
                      <input
                        type="text"
                        value={apellidoMaterno}
                        onChange={(e) => setApellidoMaterno(e.target.value)}
                        className={inputClass('apellidoMaterno')}
                        placeholder="Tu apellido materno"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-white text-sm mb-1">Email *</label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className={inputClass('email')}
                        placeholder="tu@email.com"
                      />
                      {errors.email && (
                        <p className="text-red-300 text-xs mt-1">{errors.email}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-white text-sm mb-1">Teléfono</label>
                      <input
                        type="tel"
                        value={telefono}
                        onChange={(e) => setTelefono(e.target.value)}
                        className={inputClass('telefono')}
                        placeholder="81 1234 5678"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-white text-sm mb-1">Sexo</label>
                      <select
                        value={sexo}
                        onChange={(e) => setSexo(e.target.value)}
                        className={selectClass('sexo')}
                      >
                        <option value="">Seleccionar</option>
                        <option value="M">Masculino</option>
                        <option value="F">Femenino</option>
                        <option value="Otro">Otro</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-white text-sm mb-1">Fecha de Nacimiento</label>
                      <input
                        type="date"
                        value={fechaNacimiento}
                        onChange={(e) => setFechaNacimiento(e.target.value)}
                        className={inputClass('fechaNacimiento')}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-white text-sm mb-1">Ciudad</label>
                      <input
                        type="text"
                        value={ciudad}
                        onChange={(e) => setCiudad(e.target.value)}
                        className={inputClass('ciudad')}
                        placeholder="Tu ciudad"
                      />
                    </div>
                    <div>
                      <label className="block text-white text-sm mb-1">Estado</label>
                      <input
                        type="text"
                        value={estado}
                        onChange={(e) => setEstado(e.target.value)}
                        className={inputClass('estado')}
                        placeholder="Tu estado"
                      />
                    </div>
                    <div>
                      <label className="block text-white text-sm mb-1">Ubicación cercana</label>
                      <input
                        type="text"
                        value={ubicacionCercana}
                        onChange={(e) => setUbicacionCercana(e.target.value)}
                        className={inputClass('ubicacionCercana')}
                        placeholder="Colonia, zona o referencia"
                      />
                    </div>
                  </div>
                  <p className="text-white/60 text-xs mt-1">
                    Indica una ubicación cercana o de referencia (por ejemplo, tu colonia o zona). No es necesario que sea exacta. Esta información sólo se utiliza para ofrecerte oportunidades cercanas a ti.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-white text-sm mb-1">Contraseña *</label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => handlePasswordChange(e.target.value)}
                          className={`${inputClass('password')} pr-10`}
                          placeholder="Mínimo 8 caracteres"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                        >
                          {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                      </div>
                      {errors.password && (
                        <p className="text-red-300 text-xs mt-1">{errors.password}</p>
                      )}
                      <p className="text-white/70 text-xs mt-1">
                        8+ caracteres, 1 mayúscula, 1 número
                      </p>
                    </div>
                    <div>
                      <label className="block text-white text-sm mb-1">Confirmar Contraseña *</label>
                      <div className="relative">
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          value={confirmPassword}
                          onChange={(e) => handleConfirmPasswordChange(e.target.value)}
                          className={`${inputClass('confirmPassword')} pr-10`}
                          placeholder="Repite tu contraseña"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                        >
                          {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                      </div>
                      {errors.confirmPassword && (
                        <p className="text-red-300 text-xs mt-1">{errors.confirmPassword}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Paso 2: Educación (FEATURE: Educación múltiple) */}
              {currentStep === 2 && (
                <div className="space-y-4">
                  <p className="text-white/80 text-sm mb-4">
                    Cuéntanos sobre tu formación académica (opcional)
                  </p>

                  {educations.length === 0 ? (
                    <div className="text-center py-8 bg-white/10 rounded-lg">
                      <GraduationCap className="mx-auto text-white/50 mb-2" size={40} />
                      <p className="text-white/70 mb-4">No hay educación agregada</p>
                      <button
                        type="button"
                        onClick={addEducation}
                        className="px-4 py-2 bg-button-green text-white rounded-lg hover:bg-green-700 flex items-center gap-2 mx-auto"
                      >
                        <Plus size={18} />
                        Agregar Educación
                      </button>
                    </div>
                  ) : (
                    <>
                      {educations.map((edu, index) => (
                        <div key={edu.id} className="bg-white/10 rounded-lg p-4">
                          <div className="flex justify-between items-start mb-3">
                            <h4 className="font-semibold text-white">Educación {index + 1}</h4>
                            <button
                              type="button"
                              onClick={() => removeEducation(index)}
                              className="text-red-300 hover:text-red-400 p-1"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-white text-xs mb-1">Nivel de Estudios</label>
                              <select
                                value={edu.nivel}
                                onChange={(e) => updateEducation(index, 'nivel', e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white"
                              >
                                <option value="">Seleccionar</option>
                                {NIVELES_ESTUDIO.map((nivel) => (
                                  <option key={nivel} value={nivel}>
                                    {nivel}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-white text-xs mb-1">Estatus</label>
                              <select
                                value={edu.estatus}
                                onChange={(e) => updateEducation(index, 'estatus', e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white"
                              >
                                <option value="">Seleccionar</option>
                                <option value="Cursando">Cursando</option>
                                <option value="Terminado">Terminado</option>
                                <option value="Trunco">Trunco</option>
                                <option value="Titulado">Titulado</option>
                              </select>
                            </div>
                          </div>

                          <div className="mt-3">
                            <label className="block text-white text-xs mb-1">Institución</label>
                            <input
                              type="text"
                              value={edu.institucion}
                              onChange={(e) => updateEducation(index, 'institucion', e.target.value)}
                              className="w-full px-3 py-2 rounded-lg border border-gray-300"
                              placeholder="Ej: UANL, Tec de Monterrey, UNAM..."
                            />
                          </div>

                          <div className="mt-3">
                            <label className="block text-white text-xs mb-1">Carrera</label>
                            <input
                              type="text"
                              value={edu.carrera}
                              onChange={(e) => updateEducation(index, 'carrera', e.target.value)}
                              className="w-full px-3 py-2 rounded-lg border border-gray-300"
                              placeholder="Ej: Ingeniería en Sistemas, Diseño Gráfico..."
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-3 mt-3">
                            <div>
                              <label className="block text-white text-xs mb-1">Año Inicio</label>
                              <input
                                type="number"
                                value={edu.añoInicio || ''}
                                onChange={(e) => updateEducation(index, 'añoInicio', e.target.value ? parseInt(e.target.value) : null)}
                                className="w-full px-3 py-2 rounded-lg border border-gray-300"
                                placeholder="2020"
                                min="1950"
                                max="2030"
                              />
                            </div>
                            <div>
                              <label className="block text-white text-xs mb-1">Año Fin</label>
                              <input
                                type="number"
                                value={edu.añoFin || ''}
                                onChange={(e) => updateEducation(index, 'añoFin', e.target.value ? parseInt(e.target.value) : null)}
                                className="w-full px-3 py-2 rounded-lg border border-gray-300"
                                placeholder="2024"
                                min="1950"
                                max="2030"
                              />
                            </div>
                          </div>
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={addEducation}
                        className="w-full py-3 border-2 border-dashed border-white/30 text-white/70 rounded-lg hover:border-white/50 hover:text-white flex items-center justify-center gap-2"
                      >
                        <Plus size={18} />
                        Agregar Otra Educación
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* Paso 3: Profesional */}
              {currentStep === 3 && (
                <div className="space-y-4">
                  <p className="text-white/80 text-sm mb-4">
                    Define tu perfil profesional para encontrar las mejores oportunidades (opcional)
                  </p>

                  <div>
                    <label className="block text-white text-sm mb-1">Área / Especialidad</label>
                    <select
                      value={profile}
                      onChange={(e) => {
                        setProfile(e.target.value);
                        setSubcategory('');
                      }}
                      className={selectClass('profile')}
                    >
                      <option value="">Seleccionar área</option>
                      {specialties.map((spec) => (
                        <option key={spec.id} value={spec.name}>
                          {spec.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {currentSubcategories.length > 0 && (
                    <div>
                      <label className="block text-white text-sm mb-1">Sub-especialidad</label>
                      <select
                        value={subcategory}
                        onChange={(e) => setSubcategory(e.target.value)}
                        className={selectClass('subcategory')}
                      >
                        <option value="">Seleccionar sub-especialidad</option>
                        {currentSubcategories.map((sub) => (
                          <option key={sub} value={sub}>
                            {sub}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-white text-sm mb-1">Nivel de Experiencia</label>
                    <select
                      value={seniority}
                      onChange={(e) => setSeniority(e.target.value)}
                      className={selectClass('seniority')}
                    >
                      <option value="">Seleccionar nivel</option>
                      {SENIORITIES.map((sen) => (
                        <option key={sen} value={sen}>
                          {sen}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Paso 4: Experiencia */}
              {currentStep === 4 && (
                <div className="space-y-4">
                  <p className="text-white/80 text-sm mb-4">
                    Agrega tu experiencia laboral (opcional)
                  </p>

                  {experiences.length === 0 ? (
                    <div className="text-center py-8 bg-white/10 rounded-lg">
                      <Briefcase className="mx-auto text-white/50 mb-2" size={40} />
                      <p className="text-white/70 mb-4">No hay experiencias agregadas</p>
                      <button
                        type="button"
                        onClick={addExperience}
                        className="px-4 py-2 bg-button-green text-white rounded-lg hover:bg-green-700 flex items-center gap-2 mx-auto"
                      >
                        <Plus size={18} />
                        Agregar Experiencia
                      </button>
                    </div>
                  ) : (
                    <>
                      {experiences.map((exp, index) => (
                        <div key={index} className="bg-white/10 rounded-lg p-4">
                          <div className="flex justify-between items-start mb-3">
                            <h4 className="font-semibold text-white">Experiencia {index + 1}</h4>
                            <button
                              type="button"
                              onClick={() => removeExperience(index)}
                              className="text-red-300 hover:text-red-400 p-1"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-white text-xs mb-1">Empresa *</label>
                              <input
                                type="text"
                                value={exp.empresa}
                                onChange={(e) => updateExperience(index, 'empresa', e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-gray-300"
                                placeholder="Nombre de la empresa"
                              />
                            </div>
                            <div>
                              <label className="block text-white text-xs mb-1">Puesto *</label>
                              <input
                                type="text"
                                value={exp.puesto}
                                onChange={(e) => updateExperience(index, 'puesto', e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-gray-300"
                                placeholder="Tu puesto"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                            <div>
                              <label className="block text-white text-xs mb-1">Ubicación</label>
                              <input
                                type="text"
                                value={exp.ubicacion}
                                onChange={(e) => updateExperience(index, 'ubicacion', e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-gray-300"
                                placeholder="Ciudad, País"
                              />
                            </div>
                            <div>
                              <label className="block text-white text-xs mb-1">Fecha Inicio *</label>
                              <input
                                type="date"
                                value={exp.fechaInicio}
                                onChange={(e) => updateExperience(index, 'fechaInicio', e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-gray-300"
                              />
                            </div>
                            <div>
                              <label className="block text-white text-xs mb-1">Fecha Fin</label>
                              <input
                                type="date"
                                value={exp.fechaFin}
                                onChange={(e) => updateExperience(index, 'fechaFin', e.target.value)}
                                disabled={exp.esActual}
                                className="w-full px-3 py-2 rounded-lg border border-gray-300 disabled:bg-gray-200"
                              />
                            </div>
                          </div>

                          {expErrors[index] && (
                            <p className="text-red-300 text-xs mt-1">{expErrors[index]}</p>
                          )}

                          <div className="mt-3">
                            <label className="flex items-center gap-2 text-white text-sm">
                              <input
                                type="checkbox"
                                checked={exp.esActual}
                                onChange={(e) => updateExperience(index, 'esActual', e.target.checked)}
                                className="w-4 h-4"
                              />
                              Trabajo actual
                            </label>
                          </div>

                          <div className="mt-3">
                            <label className="block text-white text-xs mb-1">Descripción</label>
                            <textarea
                              value={exp.descripcion}
                              onChange={(e) => updateExperience(index, 'descripcion', e.target.value)}
                              rows={2}
                              placeholder="Describe tus responsabilidades y logros..."
                              className="w-full px-3 py-2 rounded-lg border border-gray-300 resize-none"
                            />
                          </div>
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={addExperience}
                        className="w-full py-3 border-2 border-dashed border-white/30 text-white/70 rounded-lg hover:border-white/50 hover:text-white flex items-center justify-center gap-2"
                      >
                        <Plus size={18} />
                        Agregar Otra Experiencia
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* Paso 5: Links */}
              {currentStep === 5 && (
                <div className="space-y-4">
                  <p className="text-white/80 text-sm mb-4">
                    Comparte tus links profesionales (opcional)
                  </p>

                  <div>
                    <label className="block text-white text-sm mb-1">CV (Currículum)</label>
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={cvUrl}
                        onChange={(e) => setCvUrl(e.target.value)}
                        className={inputClass('cvUrl')}
                        placeholder="https://drive.google.com/... o sube un archivo"
                      />
                      <div className="flex items-center gap-2">
                        <label className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-white/20 text-white rounded-lg cursor-pointer hover:bg-white/30">
                          <Upload size={18} />
                          {cvUploading ? 'Subiendo...' : cvFile ? cvFile.name : 'Subir archivo'}
                          <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleCvUpload(file);
                            }}
                            disabled={cvUploading}
                          />
                        </label>
                      </div>
                    </div>
                    <p className="text-white/60 text-xs mt-1">
                      Puedes ingresar una URL o subir un archivo (PDF, JPG, PNG - máx 5MB)
                    </p>
                  </div>

                  <div>
                    <label className="block text-white text-sm mb-1">LinkedIn</label>
                    <input
                      type="text"
                      value={linkedinUrl}
                      onChange={(e) => setLinkedinUrl(e.target.value)}
                      className={inputClass('linkedinUrl')}
                      placeholder="https://linkedin.com/in/tu-perfil"
                    />
                  </div>

                  <div>
                    <label className="block text-white text-sm mb-1">Portafolio</label>
                    <input
                      type="text"
                      value={portafolioUrl}
                      onChange={(e) => setPortafolioUrl(e.target.value)}
                      className={inputClass('portafolioUrl')}
                      placeholder="https://behance.net/... o tu sitio web"
                    />
                  </div>
                </div>
              )}

              {/* Paso 6: Documentos */}
              {currentStep === 6 && (
                <div className="space-y-4">
                  {/* FIX: Mensaje informativo para que el usuario pause y vea que está en el último paso */}
                  <div className="bg-white/20 border border-white/30 rounded-lg p-4 mb-2">
                    <p className="text-white font-semibold text-sm mb-1">📋 Último paso antes de crear tu cuenta</p>
                    <p className="text-white/80 text-xs">
                      Si tienes certificaciones, títulos u otros documentos relevantes, puedes agregarlos aquí.
                      Si no tienes documentos por ahora, puedes dar click en &quot;Crear Cuenta&quot; directamente.
                    </p>
                  </div>

                  {documents.length === 0 ? (
                    <div className="text-center py-8 bg-white/10 rounded-lg">
                      <FileText className="mx-auto text-white/50 mb-2" size={40} />
                      <p className="text-white/70 mb-4">No hay documentos agregados</p>
                      <button
                        type="button"
                        onClick={addDocument}
                        className="px-4 py-2 bg-button-green text-white rounded-lg hover:bg-green-700 flex items-center gap-2 mx-auto"
                      >
                        <Plus size={18} />
                        Agregar Documento
                      </button>
                    </div>
                  ) : (
                    <>
                      {documents.map((doc, index) => (
                        <div key={index} className="bg-white/10 rounded-lg p-4">
                          <div className="flex justify-between items-start mb-3">
                            <h4 className="font-semibold text-white">Documento {index + 1}</h4>
                            <button
                              type="button"
                              onClick={() => removeDocument(index)}
                              className="text-red-300 hover:text-red-400 p-1"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>

                          <div className="space-y-3">
                            <div>
                              <label className="block text-white text-xs mb-1">
                                Nombre del documento *
                              </label>
                              <input
                                type="text"
                                value={doc.name}
                                onChange={(e) => updateDocument(index, 'name', e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-gray-300"
                                placeholder="Ej: Título universitario, Certificación AWS..."
                              />
                            </div>

                            <div>
                              <label className="block text-white text-xs mb-1">Archivo *</label>
                              <label className="flex items-center justify-center gap-2 px-4 py-3 bg-white/20 text-white rounded-lg cursor-pointer hover:bg-white/30">
                                {doc.uploading ? (
                                  <>
                                    <Loader2 className="animate-spin" size={18} />
                                    Subiendo...
                                  </>
                                ) : doc.fileUrl ? (
                                  <>
                                    <Check size={18} className="text-green-400" />
                                    {doc.file?.name || 'Archivo subido'}
                                  </>
                                ) : (
                                  <>
                                    <Upload size={18} />
                                    Seleccionar archivo
                                  </>
                                )}
                                <input
                                  type="file"
                                  accept=".pdf,.jpg,.jpeg,.png"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) updateDocument(index, 'file', file);
                                  }}
                                  disabled={doc.uploading}
                                />
                              </label>
                            </div>
                          </div>
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={addDocument}
                        className="w-full py-3 border-2 border-dashed border-white/30 text-white/70 rounded-lg hover:border-white/50 hover:text-white flex items-center justify-center gap-2"
                      >
                        <Plus size={18} />
                        Agregar Otro Documento
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Navigation Buttons */}
            <div className="mt-6 pt-4 border-t border-white/20">
              <div className="flex justify-between gap-4">
                {currentStep > 1 ? (
                  <button
                    type="button"
                    onClick={handlePrev}
                    className="flex-1 py-3 border-2 border-white text-white font-semibold rounded-lg hover:bg-white/10 flex items-center justify-center gap-2"
                  >
                    <ChevronLeft size={20} />
                    Anterior
                  </button>
                ) : (
                  <div className="flex-1" />
                )}

                {currentStep < 6 ? (
                  <button
                    type="button"
                    onClick={handleNext}
                    className="flex-1 py-3 bg-button-green text-white font-semibold rounded-lg hover:bg-green-700 flex items-center justify-center gap-2"
                  >
                    Siguiente
                    <ChevronRight size={20} />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={isSubmitting || stepTransitioning}
                    className="flex-1 py-3 bg-button-orange text-white font-semibold rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="animate-spin" size={20} />
                        CREANDO...
                      </>
                    ) : (
                      <>
                        CREAR CUENTA
                        <ChevronRight size={20} />
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Skip to end */}
              {currentStep < 6 && (
                <button
                  type="button"
                  onClick={() => {
                    // FIX: Protección contra double-click al saltar a paso 6
                    setStepTransitioning(true);
                    setCurrentStep(6);
                    setTimeout(() => setStepTransitioning(false), 500);
                  }}
                  className="w-full mt-3 text-white/70 text-sm hover:text-white"
                >
                  Omitir y crear cuenta con datos básicos
                </button>
              )}
            </div>
          </form>

          {/* Footer */}
          <div className="text-center mt-4 pt-4 border-t border-white/20">
            <p className="text-white text-sm">¿Ya tienes una cuenta?</p>
            <Link
              href="/login"
              className="block w-full max-w-xs bg-button-orange text-white font-bold py-2 rounded-full mt-2 hover:bg-orange-700 transition text-center"
            >
              INICIAR SESIÓN
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
