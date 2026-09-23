// RUTA: src/app/register/page.tsx

'use client';

import React, { useState, useEffect, useCallback, useRef, FormEvent } from 'react';
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
  // AUTHUI-004/AUTHUI-005: identidad estable. Con listas indexadas por posición,
  // borrar una fila desplazaba errores y snapshots a la fila equivocada.
  id: number;
  empresa: string;
  puesto: string;
  ubicacion: string;
  fechaInicio: string;
  fechaFin: string;
  esActual: boolean;
  descripcion: string;
}

interface Document {
  id: number;
  name: string;
  file: File | null;
  fileUrl: string;
  uploading: boolean;
  /** AUTHUI-017: el fallo de subida se muestra en la tarjeta, no en un alert(). */
  error: string;
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

/**
 * AUTHUI-017: la UI anunciaba 5MB, pero las funciones de Vercel rechazan
 * cuerpos mayores a 4.5MB con un 413 en texto plano ANTES de llegar al handler,
 * así que un archivo de 4.5-5MB reventaba con un SyntaxError de JSON.
 */
const MAX_UPLOAD_MB = 4;
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

// AUTHUI-024/AUTHUI-026: cotas de fechas y años (se calculan al cargar, no fijas).
const HOY_ISO = new Date().toISOString().slice(0, 10);
const AÑO_ACTUAL = new Date().getFullYear();
const AÑO_MIN_EDUCACION = 1950;
const AÑO_MAX_EDUCACION = AÑO_ACTUAL + 8;
const FECHA_MIN_NACIMIENTO = '1930-01-01';

// AUTHUI-019: campos cuyo error SÍ se pinta junto al control en el paso 1.
const CAMPOS_CON_ERROR_EN_PASO_1 = [
  'nombre',
  'apellidoPaterno',
  'email',
  'telefono',
  'fechaNacimiento',
  'password',
  'confirmPassword',
  'fotoUrl'
];
const FECHA_MAX_NACIMIENTO = (() => {
  const fecha = new Date();
  fecha.setFullYear(fecha.getFullYear() - 15);
  return fecha.toISOString().slice(0, 10);
})();

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
  // AUTHUI-016: sin estado de carga, un fallo de /api/specialties dejaba el
  // select vacío y sin explicación (y el candidato se registraba sin perfil).
  const [specialtiesStatus, setSpecialtiesStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [profile, setProfile] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [seniority, setSeniority] = useState('');

  // Paso 4: Experiencias
  const [experiences, setExperiences] = useState<Experience[]>([]);
  // AUTHUI-004: indexado por ID de experiencia, no por posición.
  const [expErrors, setExpErrors] = useState<Record<number, string>>({});

  // Paso 5: Links
  const [cvUrl, setCvUrl] = useState('');
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [cvUploading, setCvUploading] = useState(false);
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [portafolioUrl, setPortafolioUrl] = useState('');

  // Paso 6: Documentos
  const [documents, setDocuments] = useState<Document[]>([]);

  // AUTHUI-020: guarda síncrona contra el doble envío (isSubmitting sólo se ve
  // tras el re-render, así que dos Enter seguidos disparaban dos POST).
  const enviandoRef = useRef(false);

  // AUTHUI-004/AUTHUI-005: generador de identidades estables para las listas.
  const idRef = useRef(0);
  const nuevoId = () => {
    idRef.current += 1;
    return idRef.current;
  };

  // Cargar especialidades
  const cargarEspecialidades = useCallback(() => {
    setSpecialtiesStatus('loading');
    fetch('/api/specialties?subcategories=true')
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok || !data?.success || !Array.isArray(data.data)) {
          throw new Error('Respuesta inválida de /api/specialties');
        }
        setSpecialties(data.data);
        setSpecialtiesStatus('ready');
      })
      .catch((error) => {
        console.error('Error cargando especialidades:', error);
        setSpecialtiesStatus('error');
      });
  }, []);

  useEffect(() => {
    cargarEspecialidades();
  }, [cargarEspecialidades]);

  // Obtener subcategorías del perfil seleccionado
  const currentSubcategories = specialties.find(s => s.name === profile)?.subcategories || [];

  // Función de upload
  const uploadFile = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/upload', { method: 'POST', body: formData });

    // AUTHUI-017: la plataforma responde 413/504 en texto plano (no JSON) antes
    // de llegar al handler; res.json() lanzaba un SyntaxError en inglés.
    const contentType = res.headers?.get?.('content-type') || '';
    if (!contentType.includes('application/json')) {
      if (res.status === 413) {
        throw new Error(`El archivo es demasiado grande (máximo ${MAX_UPLOAD_MB}MB)`);
      }
      if (res.status === 429) {
        throw new Error('Demasiadas subidas, espera unos minutos e inténtalo de nuevo');
      }
      throw new Error('No pudimos subir el archivo. Inténtalo de nuevo más tarde');
    }

    let data: { success?: boolean; url?: string; error?: string };
    try {
      data = await res.json();
    } catch {
      throw new Error('No pudimos subir el archivo. Inténtalo de nuevo más tarde');
    }

    if (!res.ok || !data?.success || !data.url) {
      throw new Error(data?.error || 'No pudimos subir el archivo. Inténtalo de nuevo más tarde');
    }
    return data.url;
  };

  // Manejar upload de CV
  const handleCvUpload = async (file: File) => {
    // AUTHUI-003: validar el tamaño ANTES de subir, como ya se hacía con la foto.
    if (file.size > MAX_UPLOAD_BYTES) {
      setErrors(prev => ({
        ...prev,
        cvUrl: `El archivo no debe exceder ${MAX_UPLOAD_MB}MB (${(file.size / (1024 * 1024)).toFixed(1)}MB)`
      }));
      return;
    }
    setCvUploading(true);
    setErrors(prev => { const { cvUrl: _omitido, ...resto } = prev; return resto; });
    try {
      const url = await uploadFile(file);
      setCvUrl(url);
      setCvFile(file);
    } catch (error) {
      console.error('Error uploading CV:', error);
      // AUTHUI-003: conservar el motivo real del servidor, no un genérico.
      setErrors(prev => ({
        ...prev,
        cvUrl: error instanceof Error ? error.message : 'Error al subir el archivo'
      }));
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
      setErrors(prev => ({
        ...prev,
        fotoUrl: error instanceof Error ? error.message : 'Error al subir la foto'
      }));
    } finally {
      setFotoUploading(false);
    }
  };

  // Manejar experiencias
  const addExperience = () => {
    setExperiences([
      ...experiences,
      {
        id: nuevoId(),
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
    const expId = updated[index].id;
    if (field === 'esActual' && value) {
      updated[index].fechaFin = '';
      setExpErrors(prev => { const n = { ...prev }; delete n[expId]; return n; });
    }
    // Validar que fechaFin no sea anterior a fechaInicio
    if (field === 'fechaInicio' || field === 'fechaFin') {
      const exp = updated[index];
      if (exp.fechaInicio && exp.fechaFin && !exp.esActual) {
        if (new Date(exp.fechaFin) < new Date(exp.fechaInicio)) {
          setExpErrors(prev => ({ ...prev, [expId]: 'La fecha de fin no puede ser anterior a la fecha de inicio' }));
        } else {
          setExpErrors(prev => { const n = { ...prev }; delete n[expId]; return n; });
        }
      } else {
        setExpErrors(prev => { const n = { ...prev }; delete n[expId]; return n; });
      }
    }
    setExperiences(updated);
  };

  const removeExperience = (index: number) => {
    // AUTHUI-004: al borrar la fila hay que soltar TAMBIÉN su error; si no,
    // quedaba una clave huérfana que bloqueaba el alta sin mostrar nada (y con
    // claves por posición el error se heredaba a la fila siguiente).
    const expId = experiences[index]?.id;
    setExperiences(experiences.filter((_, i) => i !== index));
    setExpErrors(prev => {
      const n = { ...prev };
      delete n[expId];
      return n;
    });
    setErrors(prev => {
      const n = { ...prev };
      delete n[`exp-${expId}`];
      return n;
    });
  };

  // Manejar educaciones (FEATURE: Educación múltiple)
  const addEducation = () => {
    setEducations([
      ...educations,
      {
        id: nuevoId(),
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
    const eduId = educations[index]?.id;
    setEducations(educations.filter((_, i) => i !== index));
    setErrors(prev => {
      const n = { ...prev };
      delete n[`edu-${eduId}`];
      return n;
    });
  };

  // Manejar documentos
  const addDocument = () => {
    setDocuments([
      ...documents,
      { id: nuevoId(), name: '', file: null, fileUrl: '', uploading: false, error: '' }
    ]);
  };

  /**
   * AUTHUI-005: antes se copiaba `documents` al entrar, se mutaba el objeto en
   * sitio y, tras esperar hasta 30 s el upload, se escribía ese snapshot viejo:
   * el nombre tecleado mientras subía se perdía, los documentos agregados
   * después desaparecían y los eliminados reaparecían. Ahora TODA escritura es
   * funcional e inmutable y localiza el documento por id, no por posición.
   */
  const updateDocument = async (id: number, field: keyof Document, value: any) => {
    if (field === 'file' && value instanceof File) {
      if (value.size > MAX_UPLOAD_BYTES) {
        setDocuments(prev =>
          prev.map(d =>
            d.id === id
              ? {
                  ...d,
                  error: `El archivo excede el tamaño máximo de ${MAX_UPLOAD_MB}MB (${(value.size / (1024 * 1024)).toFixed(1)}MB)`
                }
              : d
          )
        );
        return;
      }

      setDocuments(prev => prev.map(d => (d.id === id ? { ...d, uploading: true, error: '' } : d)));

      try {
        const uploadPromise = uploadFile(value);
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Tiempo de espera agotado. Intenta con un archivo más pequeño.')), 30000)
        );

        const url = await Promise.race([uploadPromise, timeoutPromise]);
        setDocuments(prev =>
          prev.map(d => (d.id === id ? { ...d, file: value, fileUrl: url, uploading: false, error: '' } : d))
        );
      } catch (error) {
        console.error('Error uploading document:', error);
        // AUTHUI-017: el fallo se muestra en la tarjeta, no en un alert() nativo.
        const errorMsg = error instanceof Error ? error.message : 'Error al subir archivo';
        setDocuments(prev =>
          prev.map(d =>
            d.id === id ? { ...d, file: null, fileUrl: '', uploading: false, error: errorMsg } : d
          )
        );
      }
      return;
    }

    setDocuments(prev => prev.map(d => (d.id === id ? { ...d, [field]: value } : d)));
  };

  const removeDocument = (id: number) => {
    // AUTHUI-005: funcional, para no pisar una subida que termine en paralelo.
    setDocuments(prev => prev.filter(d => d.id !== id));
    setErrors(prev => {
      const n = { ...prev };
      delete n[`doc-${id}`];
      return n;
    });
  };

  // AUTHUI-007: ¿queda algún archivo en vuelo? (foto, CV o documentos)
  const hayArchivosSubiendo = fotoUploading || cvUploading || documents.some(doc => doc.uploading);

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
  /**
   * Devuelve los errores del paso SIN tocar el estado, para poder revisar
   * varios pasos de una sola vez al enviar (AUTHUI-006).
   */
  const erroresDePaso = (step: number): FormErrors => {
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
      // AUTHUI-023: el teléfono es opcional, pero es el dato con el que el
      // reclutador contacta al candidato: si viene, debe servir para llamar.
      if (telefono.trim()) {
        const normalizado = telefono.replace(/[\s\-().]/g, '');
        if (!/^(\+?52)?\d{10}$/.test(normalizado)) {
          newErrors.telefono = 'Teléfono inválido. Formato: 10 dígitos, ej. 8112345678';
        }
      }
      // AUTHUI-024: una fecha de nacimiento en el futuro contamina los filtros
      // por edad y no se detectaba en ningún lado.
      if (fechaNacimiento) {
        if (fechaNacimiento < FECHA_MIN_NACIMIENTO) {
          newErrors.fechaNacimiento = 'Revisa la fecha de nacimiento';
        } else if (fechaNacimiento > FECHA_MAX_NACIMIENTO) {
          newErrors.fechaNacimiento = 'Debes tener al menos 15 años para registrarte';
        }
      }
    }

    // AUTHUI-006/AUTHUI-026: las filas a medio llenar se descartaban en silencio
    // pese a los asteriscos; sólo se ignoran las filas COMPLETAMENTE vacías.
    if (step === 2) {
      educations.forEach((edu) => {
        const vacia =
          !edu.nivel && !edu.institucion.trim() && !edu.carrera.trim() &&
          !edu.añoInicio && !edu.añoFin && !edu.estatus;
        if (vacia) return;

        const clave = `edu-${edu.id}`;
        if (!edu.nivel) {
          newErrors[clave] = 'Selecciona el nivel de estudios';
        } else if (!edu.institucion.trim()) {
          newErrors[clave] = 'Indica la institución';
        } else if (
          edu.añoInicio != null &&
          (!Number.isInteger(edu.añoInicio) || edu.añoInicio < AÑO_MIN_EDUCACION || edu.añoInicio > AÑO_MAX_EDUCACION)
        ) {
          newErrors[clave] = `El año de inicio debe estar entre ${AÑO_MIN_EDUCACION} y ${AÑO_MAX_EDUCACION}`;
        } else if (
          edu.añoFin != null &&
          (!Number.isInteger(edu.añoFin) || edu.añoFin < AÑO_MIN_EDUCACION || edu.añoFin > AÑO_MAX_EDUCACION)
        ) {
          newErrors[clave] = `El año de fin debe estar entre ${AÑO_MIN_EDUCACION} y ${AÑO_MAX_EDUCACION}`;
        } else if (edu.añoInicio != null && edu.añoFin != null && edu.añoFin < edu.añoInicio) {
          newErrors[clave] = 'El año de fin no puede ser anterior al de inicio';
        }
      });
    }

    if (step === 4) {
      experiences.forEach((exp) => {
        const vacia =
          !exp.empresa.trim() && !exp.puesto.trim() && !exp.ubicacion.trim() &&
          !exp.fechaInicio && !exp.fechaFin && !exp.descripcion.trim() && !exp.esActual;
        if (vacia) return;

        const clave = `exp-${exp.id}`;
        if (!exp.empresa.trim()) {
          newErrors[clave] = 'Indica la empresa';
        } else if (!exp.puesto.trim()) {
          newErrors[clave] = 'Indica el puesto';
        } else if (!exp.fechaInicio) {
          newErrors[clave] = 'Indica la fecha de inicio';
        } else if (exp.fechaInicio > HOY_ISO) {
          newErrors[clave] = 'La fecha de inicio no puede ser futura';
        } else if (!exp.esActual && !exp.fechaFin) {
          // AUTHUI-024: sin fecha fin el servidor la cuenta 'hasta hoy' e infla
          // añosExperiencia.
          newErrors[clave] = 'Indica la fecha de fin o marca "Trabajo actual"';
        } else if (!exp.esActual && exp.fechaFin && exp.fechaFin < exp.fechaInicio) {
          newErrors[clave] = 'La fecha de fin no puede ser anterior a la fecha de inicio';
        }
      });
    }

    if (step === 6) {
      documents.forEach((doc) => {
        const vacio = !doc.name.trim() && !doc.fileUrl && !doc.uploading;
        if (vacio) return;

        const clave = `doc-${doc.id}`;
        if (doc.uploading) {
          newErrors[clave] = 'Espera a que termine de subir el archivo';
        } else if (!doc.name.trim()) {
          newErrors[clave] = 'Ponle un nombre al documento';
        } else if (!doc.fileUrl) {
          newErrors[clave] = 'Adjunta el archivo del documento';
        }
      });
    }

    return newErrors;
  };

  const validateStep = (step: number): boolean => {
    const newErrors = erroresDePaso(step);
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

    // AUTHUI-020: guarda síncrona contra el doble envío.
    if (enviandoRef.current) return;

    // AUTHUI-007: el payload toma fotoUrl/cvUrl/doc.fileUrl del estado en este
    // instante: lo que siga subiendo se enviaría vacío y se perdería en silencio.
    if (hayArchivosSubiendo) {
      setGeneralError('Espera a que terminen de subir tus archivos');
      return;
    }

    // AUTHUI-006/AUTHUI-018: validar TODOS los pasos con contenido antes de
    // enviar; antes las filas incompletas se filtraban sin avisar y el usuario
    // veía '¡Registro exitoso!' sin su información.
    let erroresTotales: FormErrors = {};
    let primerPasoConError = 0;
    for (const paso of [1, 2, 4, 6]) {
      const erroresPaso = erroresDePaso(paso);
      if (Object.keys(erroresPaso).length > 0 && primerPasoConError === 0) {
        primerPasoConError = paso;
      }
      erroresTotales = { ...erroresTotales, ...erroresPaso };
    }

    if (primerPasoConError !== 0) {
      setErrors(erroresTotales);
      setCurrentStep(primerPasoConError);
      setGeneralError('Revisa los datos marcados antes de crear tu cuenta');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Validar errores de fechas en experiencias
    if (Object.keys(expErrors).length > 0) {
      setCurrentStep(4);
      setGeneralError('Corrige los errores en las fechas de experiencia antes de continuar');
      return;
    }

    enviandoRef.current = true;
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
          // Experiencias (filtrar vacías; el `id` es sólo de la UI)
          experiences: experiences
            .filter(exp => exp.empresa && exp.puesto && exp.fechaInicio)
            .map(({ id: _idExp, ...exp }) => exp),
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
        // AUTHUI-020: el botón NO se reactiva mientras se espera la redirección.
        return;
      }

      // AUTHUI-019: data.errors viene de zod como Record<campo, string[]>; al
      // guardarlo tal cual, dos mensajes se pintaban pegados sin separador.
      const erroresNormalizados: FormErrors = {};
      if (data?.errors && typeof data.errors === 'object') {
        for (const [campo, valor] of Object.entries(data.errors as Record<string, unknown>)) {
          const mensaje = Array.isArray(valor) ? valor[0] : valor;
          if (typeof mensaje === 'string' && mensaje) erroresNormalizados[campo] = mensaje;
        }
      }

      if (response.status === 409 && data?.error) {
        // AUTHUI-019: el email duplicado es el error más común; su campo vive en
        // el paso 1, así que se muestra ahí de forma persistente en vez de en un
        // toast que se autodescarta a los 8 s cinco pantallas más adelante.
        setErrors({ email: data.error });
        setCurrentStep(1);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else if (Object.keys(erroresNormalizados).length > 0) {
        setErrors(erroresNormalizados);
        setCurrentStep(1);
        // AUTHUI-019: si el servidor señala un campo que no se pinta en el paso 1
        // (sexo, educacion, experiences, documents...), antes se saltaba al paso 1
        // y no se veía NADA; se avisa además con el primer mensaje.
        const sinUiEnPaso1 = Object.keys(erroresNormalizados).filter(
          (campo) => !CAMPOS_CON_ERROR_EN_PASO_1.includes(campo)
        );
        if (sinUiEnPaso1.length > 0) {
          setGeneralError(erroresNormalizados[sinUiEnPaso1[0]]);
        }
        // Scroll hacia arriba para mostrar los errores
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        setGeneralError(data?.error || 'Error al registrarse');
      }
    } catch (error) {
      setGeneralError('Error al conectar con el servidor');
      console.error('Error registering:', error);
    }

    enviandoRef.current = false;
    setIsSubmitting(false);
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

          {/* Error general: el aviso vive en el ErrorToast de arriba. */}
          {/* Mensaje de éxito */}
          {successMessage && (
            <div role="status" className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg mb-4">
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
                      <label className="absolute bottom-0 right-0 w-8 h-8 bg-button-green rounded-full flex items-center justify-center cursor-pointer hover:bg-green-700 shadow-lg focus-within:ring-2 focus-within:ring-white">
                        {fotoUploading ? (
                          <Loader2 className="w-4 h-4 text-white animate-spin" />
                        ) : (
                          <Upload className="w-4 h-4 text-white" />
                        )}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          // AUTHUI-021: 'hidden' (display:none) sacaba los tres
                          // inputs de archivo del orden de tabulación; con
                          // sr-only siguen invisibles pero enfocables por teclado.
                          className="sr-only"
                          aria-label="Subir foto de perfil"
                          onChange={(e) => {
                            // AUTHUI-027: limpiar el input permite reintentar
                            // con el MISMO archivo tras un fallo (sin esto el
                            // navegador no vuelve a disparar 'change').
                            const input = e.target;
                            const file = input.files?.[0];
                            input.value = '';
                            if (file) handleFotoUpload(file);
                          }}
                          disabled={fotoUploading}
                        />
                      </label>
                    </div>
                    {errors.fotoUrl && (
                      <p role="alert" className="text-red-300 text-xs mt-1">{errors.fotoUrl}</p>
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
                        inputMode="tel"
                        autoComplete="tel"
                      />
                      {errors.telefono && (
                        <p role="alert" className="text-red-300 text-xs mt-1">{errors.telefono}</p>
                      )}
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
                        min={FECHA_MIN_NACIMIENTO}
                        max={FECHA_MAX_NACIMIENTO}
                      />
                      {errors.fechaNacimiento && (
                        <p role="alert" className="text-red-300 text-xs mt-1">{errors.fechaNacimiento}</p>
                      )}
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
                          // AUTHUI-025: botón sólo-icono sin nombre accesible.
                          aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                          aria-pressed={showPassword}
                        >
                          {showPassword ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
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
                          aria-label={showConfirmPassword ? 'Ocultar confirmación de contraseña' : 'Mostrar confirmación de contraseña'}
                          aria-pressed={showConfirmPassword}
                        >
                          {showConfirmPassword ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
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
                              aria-label={`Eliminar educación ${index + 1}`}
                            >
                              <Trash2 size={18} aria-hidden="true" />
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
                                min={AÑO_MIN_EDUCACION}
                                max={AÑO_MAX_EDUCACION}
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
                                min={AÑO_MIN_EDUCACION}
                                max={AÑO_MAX_EDUCACION}
                              />
                            </div>
                          </div>

                          {errors[`edu-${edu.id}`] && (
                            <p role="alert" className="text-red-300 text-xs mt-2">
                              {errors[`edu-${edu.id}`]}
                            </p>
                          )}
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
                      disabled={specialtiesStatus !== 'ready'}
                    >
                      <option value="">
                        {specialtiesStatus === 'loading'
                          ? 'Cargando áreas...'
                          : specialtiesStatus === 'error'
                          ? 'No se pudieron cargar las áreas'
                          : 'Seleccionar área'}
                      </option>
                      {specialties.map((spec) => (
                        <option key={spec.id} value={spec.name}>
                          {spec.name}
                        </option>
                      ))}
                    </select>
                    {/* AUTHUI-016: antes el fallo era invisible y el candidato
                        terminaba el registro sin perfil (su campo de matching). */}
                    {specialtiesStatus === 'error' && (
                      <div role="alert" className="mt-2 flex items-center gap-3">
                        <p className="text-red-300 text-xs">
                          No pudimos cargar las áreas. Sin ellas no podrás declarar tu perfil.
                        </p>
                        <button
                          type="button"
                          onClick={cargarEspecialidades}
                          className="px-3 py-1 bg-button-green text-white text-xs rounded-lg hover:bg-green-700"
                        >
                          Reintentar
                        </button>
                      </div>
                    )}
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
                        <div key={exp.id} className="bg-white/10 rounded-lg p-4">
                          <div className="flex justify-between items-start mb-3">
                            <h4 className="font-semibold text-white">Experiencia {index + 1}</h4>
                            <button
                              type="button"
                              onClick={() => removeExperience(index)}
                              className="text-red-300 hover:text-red-400 p-1"
                              aria-label={`Eliminar experiencia ${index + 1}`}
                            >
                              <Trash2 size={18} aria-hidden="true" />
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
                                max={HOY_ISO}
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
                                min={exp.fechaInicio || undefined}
                                max={HOY_ISO}
                              />
                            </div>
                          </div>

                          {expErrors[exp.id] && (
                            <p role="alert" className="text-red-300 text-xs mt-1">{expErrors[exp.id]}</p>
                          )}
                          {errors[`exp-${exp.id}`] && (
                            <p role="alert" className="text-red-300 text-xs mt-1">
                              {errors[`exp-${exp.id}`]}
                            </p>
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
                        <label className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-white/20 text-white rounded-lg cursor-pointer hover:bg-white/30 focus-within:ring-2 focus-within:ring-white">
                          <Upload size={18} />
                          {cvUploading ? 'Subiendo...' : cvFile ? cvFile.name : 'Subir archivo'}
                          <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            className="sr-only"
                            onChange={(e) => {
                              // AUTHUI-027: permitir reintentar con el mismo archivo.
                              const input = e.target;
                              const file = input.files?.[0];
                              input.value = '';
                              if (file) handleCvUpload(file);
                            }}
                            disabled={cvUploading}
                          />
                        </label>
                      </div>
                      {/* AUTHUI-003: el fallo de la subida sólo pintaba el borde
                          rojo del campo de URL, sin ningún texto. */}
                      {errors.cvUrl && (
                        <p role="alert" className="text-red-300 text-xs mt-1">{errors.cvUrl}</p>
                      )}
                    </div>
                    <p className="text-white/60 text-xs mt-1">
                      Puedes ingresar una URL o subir un archivo (PDF, JPG, PNG - máx {MAX_UPLOAD_MB}MB)
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
                        <div key={doc.id} className="bg-white/10 rounded-lg p-4">
                          <div className="flex justify-between items-start mb-3">
                            <h4 className="font-semibold text-white">Documento {index + 1}</h4>
                            <button
                              type="button"
                              onClick={() => removeDocument(doc.id)}
                              className="text-red-300 hover:text-red-400 p-1"
                              aria-label={`Eliminar documento ${index + 1}`}
                            >
                              <Trash2 size={18} aria-hidden="true" />
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
                                onChange={(e) => updateDocument(doc.id, 'name', e.target.value)}
                                onKeyDown={(e) => {
                                  // AUTHUI-018: Enter aquí enviaba el registro
                                  // completo y el documento a medio capturar se
                                  // descartaba en el filtro.
                                  if (e.key === 'Enter') e.preventDefault();
                                }}
                                className="w-full px-3 py-2 rounded-lg border border-gray-300"
                                placeholder="Ej: Título universitario, Certificación AWS..."
                              />
                            </div>

                            <div>
                              <label className="block text-white text-xs mb-1">Archivo *</label>
                              <label className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg focus-within:ring-2 focus-within:ring-white ${
                                doc.uploading
                                  ? 'bg-teal-700/50 text-teal-200 cursor-wait'
                                  : doc.fileUrl
                                  ? 'bg-green-700/50 text-green-200 cursor-pointer hover:bg-green-700/60'
                                  : 'bg-white/20 text-white cursor-pointer hover:bg-white/30'
                              }`}>
                                {doc.uploading ? (
                                  <>
                                    <div className="w-5 h-5 border-2 border-teal-200 border-t-transparent rounded-full animate-spin" />
                                    Subiendo{doc.file?.name ? ` "${doc.file.name}"` : ''}...
                                  </>
                                ) : doc.fileUrl ? (
                                  <>
                                    <Check size={18} className="text-green-400" />
                                    <span className="truncate max-w-[200px]">{doc.file?.name || 'Archivo subido'}</span>
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
                                  className="sr-only"
                                  onChange={(e) => {
                                    // AUTHUI-027: permitir reintentar con el mismo archivo.
                                    const input = e.target;
                                    const file = input.files?.[0];
                                    input.value = '';
                                    if (file) updateDocument(doc.id, 'file', file);
                                  }}
                                  disabled={doc.uploading}
                                />
                              </label>
                              {doc.error && (
                                <p role="alert" className="text-red-300 text-xs mt-1">{doc.error}</p>
                              )}
                            </div>
                          </div>

                          {errors[`doc-${doc.id}`] && (
                            <p role="alert" className="text-red-300 text-xs mt-2">
                              {errors[`doc-${doc.id}`]}
                            </p>
                          )}
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
                    // AUTHUI-007: con un archivo en vuelo, el payload saldría sin él.
                    disabled={isSubmitting || stepTransitioning || hayArchivosSubiendo}
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

              {/* AUTHUI-007: explicar por qué el botón está deshabilitado */}
              {currentStep === 6 && hayArchivosSubiendo && (
                <p role="status" className="w-full mt-3 text-white/80 text-sm text-center">
                  Espera a que terminen de subir tus archivos
                </p>
              )}

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
