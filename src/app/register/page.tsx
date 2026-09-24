// RUTA: src/app/register/page.tsx

'use client';

import React, { useState, useEffect, useCallback, useRef, FormEvent } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Briefcase,
  FileText,
  GraduationCap,
  Loader2,
  Plus,
  RefreshCw,
  Upload,
  User
} from 'lucide-react';
import Footer from '@/components/commons/Footer';
import SiteMotion from '@/components/ui/SiteMotion';
import TituloMascara from '@/components/ui/TituloMascara';
import Toast from '@/components/ui/Toast';
import Stepper from '@/components/ui/Stepper';
import EmptyState from '@/components/ui/EmptyState';
import Button, { clasesBoton } from '@/components/ui/Button';
import FormField, { Checkbox, Input, Select, Textarea } from '@/components/ui/FormField';
import { cn } from '@/lib/utils';
import {
  AvisoAcceso,
  MarcoAcceso,
  PanelAcceso
} from '../login/_acceso/MarcoAcceso';
import { CampoContrasena, RequisitosContrasena } from '../login/_acceso/CampoContrasena';
import { ArchivoSubida, RecorridoRegistro, TarjetaFila } from './_componentes/PiezasRegistro';
import '../login/_acceso/acceso.css';

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
// Presentación de cada paso: `name` es la etiqueta corta (Stepper y recorrido),
// `titulo` el encabezado del paso e `intro` la línea que lo explica.
const STEPS = [
  { id: 1, name: 'Personal', titulo: 'Datos personales', intro: 'Los campos con * son obligatorios.' },
  { id: 2, name: 'Educación', titulo: 'Tu formación', intro: 'Cuéntanos sobre tu formación académica (opcional).' },
  {
    id: 3,
    name: 'Profesional',
    titulo: 'Tu perfil profesional',
    intro: 'Define tu perfil profesional para encontrar las mejores oportunidades (opcional).'
  },
  { id: 4, name: 'Experiencia', titulo: 'Experiencia laboral', intro: 'Agrega tu experiencia laboral (opcional).' },
  { id: 5, name: 'Enlaces', titulo: 'CV y enlaces', intro: 'Comparte tu CV y tus enlaces profesionales (opcional).' },
  { id: 6, name: 'Documentos', titulo: 'Documentos', intro: 'Certificaciones, títulos u otros comprobantes (opcional).' }
];

// Para el Stepper del sistema (índices desde 0; los pasos de arriba, desde 1).
const PASOS_STEPPER = STEPS.map((s) => ({ id: String(s.id), etiqueta: s.name }));

// Campos del registro público: 48 px de alto y 16 px de letra (con menos,
// Safari en iPhone amplía la página al enfocar el campo). En las filas de
// listas (educación, experiencia, documentos), un poco más compactos.
const CONTROL = 'h-12 text-base';
const CONTROL_FILA = 'h-11 text-base';

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

  // ---------------------------------------------------------------------------
  // PRESENTACIÓN: foco y desplazamiento entre pasos. No toca datos, validaciones
  // ni llamadas: sólo decide a dónde va el foco y si la tarjeta sube a la vista.
  // ---------------------------------------------------------------------------
  const tarjetaRef = useRef<HTMLDivElement>(null);
  const tituloPasoRef = useRef<HTMLHeadingElement>(null);
  // true cuando el cambio de paso lo pidió la navegación (Siguiente, Anterior,
  // Omitir, el Stepper): entonces, si la tarjeta quedó arriba, se sube a verla.
  // Los saltos que hace el envío ya llevan su propio scroll (window.scrollTo).
  const desplazarAlPaso = useRef(false);
  const pasoMostrado = useRef(currentStep);

  useEffect(() => {
    if (pasoMostrado.current === currentStep) return;
    pasoMostrado.current = currentStep;
    if (desplazarAlPaso.current) {
      desplazarAlPaso.current = false;
      const tarjeta = tarjetaRef.current;
      if (tarjeta && typeof tarjeta.scrollIntoView === 'function' && tarjeta.getBoundingClientRect().top < 64) {
        const calma =
          typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        tarjeta.scrollIntoView({ block: 'start', behavior: calma ? 'auto' : 'smooth' });
      }
    }
    // El lector anuncia el paso nuevo.
    tituloPasoRef.current?.focus({ preventScroll: true });
  }, [currentStep]);

  const irAlPaso = (paso: number) => {
    desplazarAlPaso.current = true;
    setCurrentStep(paso);
  };

  const alPulsarAnterior = () => {
    desplazarAlPaso.current = true;
    handlePrev();
  };

  // Siguiente: la MISMA validación de siempre (handleNext). Si el paso no pasa,
  // el foco va al primer campo marcado (en el orden en que se ve).
  const alPulsarSiguiente = () => {
    const pendientes = Object.keys(erroresDePaso(currentStep));
    if (pendientes.length === 0) {
      desplazarAlPaso.current = true;
      handleNext();
      return;
    }
    handleNext();
    requestAnimationFrame(() => {
      const destinos = pendientes
        .map((clave) => document.getElementById(`reg-${clave}`))
        .filter((el): el is HTMLElement => Boolean(el))
        .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
      destinos[0]?.focus();
    });
  };

  const pasoActual = STEPS[currentStep - 1];

  return (
    <>
      <main className="hm">
        {/* Error general: aviso flotante (como antes), visible esté donde esté
            el scroll en un formulario largo. */}
        <Toast tono="error" mensaje={generalError} alCerrar={() => setGeneralError(null)} />

        <MarcoAcceso
          ancho
          panel={
            <PanelAcceso
              antetitulo="INAKAT"
              frase={[{ texto: 'Únete a INAKAT.' }, { texto: 'Completa tu perfil profesional.', em: true }]}
              recorrido
            >
              <RecorridoRegistro pasos={STEPS.map((s) => s.name)} actual={currentStep} />
            </PanelAcceso>
          }
        >
          <p className="hm-eyebrow">Para candidatos</p>
          <TituloMascara
            como="h1"
            className="ac-titulo mt-5"
            renglones={[{ texto: 'Crea tu' }, { texto: 'cuenta.', contenido: <em>cuenta.</em> }]}
          />
          <p className="hm-lead mt-4">
            Sólo los datos personales son obligatorios; el resto te ayuda a encontrar mejores oportunidades.
          </p>

          <div ref={tarjetaRef} className="ac-tarjeta mt-8">
            <Stepper
              pasos={PASOS_STEPPER}
              actual={currentStep - 1}
              alIrA={(indice) => irAlPaso(indice + 1)}
              className="mb-7"
            />

            {/* Mensaje de éxito */}
            {successMessage && (
              <AvisoAcceso tono="exito" className="mb-6">
                {successMessage}
              </AvisoAcceso>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit}>
              <div className="mb-6">
                <p className="hidden font-display text-[13px] font-semibold uppercase tracking-[0.14em] text-teal sm:block">
                  Paso {currentStep} de 6
                </p>
                <h2
                  ref={tituloPasoRef}
                  tabIndex={-1}
                  className="mt-1 font-display text-2xl font-bold tracking-tight text-ink outline-none sm:text-[1.75rem]"
                >
                  {pasoActual.titulo}
                </h2>
                <p className="mt-1.5 text-sm text-ink-muted">{pasoActual.intro}</p>
              </div>

              {/* Paso 1: Datos Personales */}
              {currentStep === 1 && (
                <div className="space-y-6">
                  {/* FEAT-2: Foto de perfil */}
                  <div className="flex items-center gap-4">
                    <span className="flex h-20 w-20 flex-none items-center justify-center overflow-hidden rounded-full bg-mist ring-1 ring-line">
                      {fotoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={fotoUrl} alt="Vista previa de tu foto de perfil" className="h-full w-full object-cover" />
                      ) : (
                        <User className="h-9 w-9 text-ink-muted" aria-hidden="true" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink">
                        Foto de perfil <span className="font-normal text-ink-muted">(opcional)</span>
                      </p>
                      <label
                        className={cn(
                          clasesBoton({ variante: 'contorno', tamano: 'sm' }),
                          'mt-2 cursor-pointer focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-teal',
                          fotoUploading && 'cursor-wait opacity-70'
                        )}
                      >
                        {fotoUploading ? (
                          <Loader2 className="animate-spin" aria-hidden="true" />
                        ) : (
                          <Upload aria-hidden="true" />
                        )}
                        {fotoUploading ? 'Subiendo foto…' : fotoUrl ? 'Cambiar foto' : 'Subir foto'}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          // AUTHUI-021: 'hidden' (display:none) sacaba los tres
                          // inputs de archivo del orden de tabulación; con
                          // sr-only siguen invisibles pero enfocables por teclado.
                          className="sr-only"
                          // El nombre contiene el texto visible (WCAG 2.5.3).
                          aria-label={fotoUrl ? 'Cambiar foto de perfil' : 'Subir foto de perfil'}
                          aria-describedby={errors.fotoUrl ? 'reg-foto-error reg-foto-ayuda' : 'reg-foto-ayuda'}
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
                      <p id="reg-foto-ayuda" className="mt-1.5 text-[13px] text-ink-muted">
                        JPG, PNG o WebP (máx 2MB)
                      </p>
                      {errors.fotoUrl && (
                        <p
                          id="reg-foto-error"
                          role="alert"
                          className="mt-1.5 flex items-start gap-1.5 text-[13px] font-medium text-danger"
                        >
                          <AlertCircle className="mt-px h-4 w-4 flex-none" aria-hidden="true" />
                          {errors.fotoUrl}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                    <FormField etiqueta="Nombre" requerido id="reg-nombre" error={errors.nombre}>
                      <Input
                        type="text"
                        value={nombre}
                        onChange={(e) => setNombre(e.target.value)}
                        required={false}
                        autoComplete="given-name"
                        placeholder="Tu nombre"
                        className={CONTROL}
                      />
                    </FormField>
                    <FormField etiqueta="Apellido paterno" requerido id="reg-apellidoPaterno" error={errors.apellidoPaterno}>
                      <Input
                        type="text"
                        value={apellidoPaterno}
                        onChange={(e) => setApellidoPaterno(e.target.value)}
                        required={false}
                        autoComplete="family-name"
                        placeholder="Tu apellido paterno"
                        className={CONTROL}
                      />
                    </FormField>
                    <FormField etiqueta="Apellido materno" id="reg-apellidoMaterno">
                      <Input
                        type="text"
                        value={apellidoMaterno}
                        onChange={(e) => setApellidoMaterno(e.target.value)}
                        aria-invalid={Boolean(errors.apellidoMaterno) || undefined}
                        placeholder="Tu apellido materno"
                        className={CONTROL}
                      />
                    </FormField>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <FormField etiqueta="Correo electrónico" requerido id="reg-email" error={errors.email}>
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required={false}
                        autoComplete="email"
                        inputMode="email"
                        placeholder="tu@email.com"
                        className={CONTROL}
                      />
                    </FormField>
                    <FormField etiqueta="Teléfono" id="reg-telefono" error={errors.telefono} ayuda="10 dígitos. Es el número con el que te contactarán.">
                      <Input
                        type="tel"
                        value={telefono}
                        onChange={(e) => setTelefono(e.target.value)}
                        placeholder="81 1234 5678"
                        inputMode="tel"
                        autoComplete="tel"
                        className={CONTROL}
                      />
                    </FormField>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <FormField etiqueta="Sexo" id="reg-sexo">
                      <Select
                        value={sexo}
                        onChange={(e) => setSexo(e.target.value)}
                        aria-invalid={Boolean(errors.sexo) || undefined}
                        className={CONTROL}
                      >
                        <option value="">Seleccionar</option>
                        <option value="M">Masculino</option>
                        <option value="F">Femenino</option>
                        <option value="Otro">Otro</option>
                      </Select>
                    </FormField>
                    <FormField etiqueta="Fecha de nacimiento" id="reg-fechaNacimiento" error={errors.fechaNacimiento}>
                      <Input
                        type="date"
                        value={fechaNacimiento}
                        onChange={(e) => setFechaNacimiento(e.target.value)}
                        autoComplete="bday"
                        min={FECHA_MIN_NACIMIENTO}
                        max={FECHA_MAX_NACIMIENTO}
                        className={CONTROL}
                      />
                    </FormField>
                  </div>

                  <div className="space-y-2">
                    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                      <FormField etiqueta="Ciudad" id="reg-ciudad">
                        <Input
                          type="text"
                          value={ciudad}
                          onChange={(e) => setCiudad(e.target.value)}
                          aria-invalid={Boolean(errors.ciudad) || undefined}
                          autoComplete="address-level2"
                          placeholder="Tu ciudad"
                          className={CONTROL}
                        />
                      </FormField>
                      <FormField etiqueta="Estado" id="reg-estado">
                        <Input
                          type="text"
                          value={estado}
                          onChange={(e) => setEstado(e.target.value)}
                          aria-invalid={Boolean(errors.estado) || undefined}
                          autoComplete="address-level1"
                          placeholder="Tu estado"
                          className={CONTROL}
                        />
                      </FormField>
                      <FormField etiqueta="Ubicación cercana" id="reg-ubicacionCercana">
                        <Input
                          type="text"
                          value={ubicacionCercana}
                          onChange={(e) => setUbicacionCercana(e.target.value)}
                          aria-invalid={Boolean(errors.ubicacionCercana) || undefined}
                          aria-describedby="reg-ubicacion-ayuda"
                          placeholder="Colonia o zona"
                          className={CONTROL}
                        />
                      </FormField>
                    </div>
                    <p id="reg-ubicacion-ayuda" className="text-[13px] text-ink-muted">
                      Indica una ubicación cercana o de referencia (por ejemplo, tu colonia o zona). No es necesario que sea exacta. Esta información sólo se utiliza para ofrecerte oportunidades cercanas a ti.
                    </p>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <FormField
                      etiqueta="Contraseña"
                      requerido
                      id="reg-password"
                      error={errors.password}
                      ayuda={<RequisitosContrasena valor={password} />}
                    >
                      <CampoContrasena
                        value={password}
                        onChange={(e) => handlePasswordChange(e.target.value)}
                        required={false}
                        autoComplete="new-password"
                        placeholder="8+ caracteres"
                        className={CONTROL}
                        // AUTHUI-025: botón sólo-icono con nombre accesible.
                        visible={showPassword}
                        alAlternar={() => setShowPassword(!showPassword)}
                      />
                    </FormField>
                    <FormField etiqueta="Confirmar contraseña" requerido id="reg-confirmPassword" error={errors.confirmPassword}>
                      <CampoContrasena
                        value={confirmPassword}
                        onChange={(e) => handleConfirmPasswordChange(e.target.value)}
                        required={false}
                        autoComplete="new-password"
                        placeholder="Repítela"
                        className={CONTROL}
                        visible={showConfirmPassword}
                        alAlternar={() => setShowConfirmPassword(!showConfirmPassword)}
                        etiquetaMostrar="Mostrar confirmación de contraseña"
                        etiquetaOcultar="Ocultar confirmación de contraseña"
                      />
                    </FormField>
                  </div>
                </div>
              )}

              {/* Paso 2: Educación (FEATURE: Educación múltiple) */}
              {currentStep === 2 && (
                <div className="space-y-4">
                  {educations.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-line-strong/50 bg-paper">
                      <EmptyState
                        compacto
                        icono={GraduationCap}
                        titulo="No hay educación agregada"
                        descripcion="Agrega tu formación: preparatoria, técnico, licenciatura o posgrado."
                        accion={
                          <Button variante="contorno" icono={Plus} onClick={addEducation}>
                            Agregar educación
                          </Button>
                        }
                      />
                    </div>
                  ) : (
                    <>
                      {educations.map((edu, index) => (
                        <TarjetaFila
                          key={edu.id}
                          id={`reg-edu-${edu.id}`}
                          titulo={`Educación ${index + 1}`}
                          etiquetaEliminar={`Eliminar educación ${index + 1}`}
                          alEliminar={() => removeEducation(index)}
                          errores={[errors[`edu-${edu.id}`]]}
                        >
                          <div className="grid gap-4 sm:grid-cols-2">
                            <FormField etiqueta="Nivel de estudios" requerido id={`reg-edu-${edu.id}-nivel`}>
                              <Select
                                value={edu.nivel}
                                onChange={(e) => updateEducation(index, 'nivel', e.target.value)}
                                required={false}
                                className={CONTROL_FILA}
                              >
                                <option value="">Seleccionar</option>
                                {NIVELES_ESTUDIO.map((nivel) => (
                                  <option key={nivel} value={nivel}>
                                    {nivel}
                                  </option>
                                ))}
                              </Select>
                            </FormField>
                            <FormField etiqueta="Estatus" id={`reg-edu-${edu.id}-estatus`}>
                              <Select
                                value={edu.estatus}
                                onChange={(e) => updateEducation(index, 'estatus', e.target.value)}
                                className={CONTROL_FILA}
                              >
                                <option value="">Seleccionar</option>
                                <option value="Cursando">Cursando</option>
                                <option value="Terminado">Terminado</option>
                                <option value="Trunco">Trunco</option>
                                <option value="Titulado">Titulado</option>
                              </Select>
                            </FormField>
                            <FormField
                              etiqueta="Institución"
                              requerido
                              id={`reg-edu-${edu.id}-institucion`}
                              className="sm:col-span-2"
                            >
                              <Input
                                type="text"
                                value={edu.institucion}
                                onChange={(e) => updateEducation(index, 'institucion', e.target.value)}
                                required={false}
                                placeholder="Ej: UANL, Tec de Monterrey, UNAM..."
                                className={CONTROL_FILA}
                              />
                            </FormField>
                            <FormField etiqueta="Carrera" id={`reg-edu-${edu.id}-carrera`} className="sm:col-span-2">
                              <Input
                                type="text"
                                value={edu.carrera}
                                onChange={(e) => updateEducation(index, 'carrera', e.target.value)}
                                placeholder="Ej: Ingeniería en Sistemas, Diseño Gráfico..."
                                className={CONTROL_FILA}
                              />
                            </FormField>
                            <div className="grid grid-cols-2 gap-4 sm:col-span-2">
                              <FormField etiqueta="Año de inicio" id={`reg-edu-${edu.id}-inicio`}>
                                <Input
                                  type="number"
                                  inputMode="numeric"
                                  value={edu.añoInicio || ''}
                                  onChange={(e) => updateEducation(index, 'añoInicio', e.target.value ? parseInt(e.target.value) : null)}
                                  placeholder="2020"
                                  min={AÑO_MIN_EDUCACION}
                                  max={AÑO_MAX_EDUCACION}
                                  className={cn(CONTROL_FILA, 'tabular-nums')}
                                />
                              </FormField>
                              <FormField etiqueta="Año de fin" id={`reg-edu-${edu.id}-fin`}>
                                <Input
                                  type="number"
                                  inputMode="numeric"
                                  value={edu.añoFin || ''}
                                  onChange={(e) => updateEducation(index, 'añoFin', e.target.value ? parseInt(e.target.value) : null)}
                                  placeholder="2024"
                                  min={AÑO_MIN_EDUCACION}
                                  max={AÑO_MAX_EDUCACION}
                                  className={cn(CONTROL_FILA, 'tabular-nums')}
                                />
                              </FormField>
                            </div>
                          </div>
                        </TarjetaFila>
                      ))}

                      <Button variante="contorno" icono={Plus} anchoCompleto onClick={addEducation} className="h-12 border-dashed">
                        Agregar otra educación
                      </Button>
                    </>
                  )}
                </div>
              )}

              {/* Paso 3: Profesional */}
              {currentStep === 3 && (
                <div className="space-y-5">
                  <FormField etiqueta="Área / especialidad" id="reg-profile">
                    <Select
                      value={profile}
                      onChange={(e) => {
                        setProfile(e.target.value);
                        setSubcategory('');
                      }}
                      aria-invalid={Boolean(errors.profile) || undefined}
                      className={CONTROL}
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
                    </Select>
                  </FormField>
                  {/* AUTHUI-016: antes el fallo era invisible y el candidato
                      terminaba el registro sin perfil (su campo de matching). */}
                  {specialtiesStatus === 'error' && (
                    <AvisoAcceso tono="error">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <span>No pudimos cargar las áreas. Sin ellas no podrás declarar tu perfil.</span>
                        <Button variante="contorno" tamano="sm" icono={RefreshCw} onClick={cargarEspecialidades}>
                          Reintentar
                        </Button>
                      </div>
                    </AvisoAcceso>
                  )}

                  {currentSubcategories.length > 0 && (
                    <FormField etiqueta="Sub-especialidad" id="reg-subcategory">
                      <Select
                        value={subcategory}
                        onChange={(e) => setSubcategory(e.target.value)}
                        aria-invalid={Boolean(errors.subcategory) || undefined}
                        className={CONTROL}
                      >
                        <option value="">Seleccionar sub-especialidad</option>
                        {currentSubcategories.map((sub) => (
                          <option key={sub} value={sub}>
                            {sub}
                          </option>
                        ))}
                      </Select>
                    </FormField>
                  )}

                  <FormField etiqueta="Nivel de experiencia" id="reg-seniority">
                    <Select
                      value={seniority}
                      onChange={(e) => setSeniority(e.target.value)}
                      aria-invalid={Boolean(errors.seniority) || undefined}
                      className={CONTROL}
                    >
                      <option value="">Seleccionar nivel</option>
                      {SENIORITIES.map((sen) => (
                        <option key={sen} value={sen}>
                          {sen}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                </div>
              )}

              {/* Paso 4: Experiencia */}
              {currentStep === 4 && (
                <div className="space-y-4">
                  {experiences.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-line-strong/50 bg-paper">
                      <EmptyState
                        compacto
                        icono={Briefcase}
                        titulo="No hay experiencias agregadas"
                        descripcion="Empieza por tu trabajo más reciente."
                        accion={
                          <Button variante="contorno" icono={Plus} onClick={addExperience}>
                            Agregar experiencia
                          </Button>
                        }
                      />
                    </div>
                  ) : (
                    <>
                      {experiences.map((exp, index) => (
                        <TarjetaFila
                          key={exp.id}
                          id={`reg-exp-${exp.id}`}
                          titulo={`Experiencia ${index + 1}`}
                          etiquetaEliminar={`Eliminar experiencia ${index + 1}`}
                          alEliminar={() => removeExperience(index)}
                          errores={[expErrors[exp.id], errors[`exp-${exp.id}`]]}
                        >
                          <div className="grid gap-4 sm:grid-cols-2">
                            <FormField etiqueta="Empresa" requerido id={`reg-exp-${exp.id}-empresa`}>
                              <Input
                                type="text"
                                value={exp.empresa}
                                onChange={(e) => updateExperience(index, 'empresa', e.target.value)}
                                required={false}
                                autoComplete="organization"
                                placeholder="Nombre de la empresa"
                                className={CONTROL_FILA}
                              />
                            </FormField>
                            <FormField etiqueta="Puesto" requerido id={`reg-exp-${exp.id}-puesto`}>
                              <Input
                                type="text"
                                value={exp.puesto}
                                onChange={(e) => updateExperience(index, 'puesto', e.target.value)}
                                required={false}
                                autoComplete="organization-title"
                                placeholder="Tu puesto"
                                className={CONTROL_FILA}
                              />
                            </FormField>
                            <div className="grid gap-4 sm:col-span-2 sm:grid-cols-2 xl:grid-cols-3">
                              <FormField
                                etiqueta="Ubicación"
                                id={`reg-exp-${exp.id}-ubicacion`}
                                className="sm:col-span-2 xl:col-span-1"
                              >
                                <Input
                                  type="text"
                                  value={exp.ubicacion}
                                  onChange={(e) => updateExperience(index, 'ubicacion', e.target.value)}
                                  placeholder="Ciudad, País"
                                  className={CONTROL_FILA}
                                />
                              </FormField>
                              <FormField etiqueta="Fecha de inicio" requerido id={`reg-exp-${exp.id}-inicio`}>
                                <Input
                                  type="date"
                                  value={exp.fechaInicio}
                                  onChange={(e) => updateExperience(index, 'fechaInicio', e.target.value)}
                                  required={false}
                                  max={HOY_ISO}
                                  className={CONTROL_FILA}
                                />
                              </FormField>
                              <FormField etiqueta="Fecha de fin" id={`reg-exp-${exp.id}-fin`}>
                                <Input
                                  type="date"
                                  value={exp.fechaFin}
                                  onChange={(e) => updateExperience(index, 'fechaFin', e.target.value)}
                                  disabled={exp.esActual}
                                  min={exp.fechaInicio || undefined}
                                  max={HOY_ISO}
                                  className={CONTROL_FILA}
                                />
                              </FormField>
                            </div>
                            <Checkbox
                              className="sm:col-span-2"
                              etiqueta="Trabajo actual"
                              descripcion="Márcalo si todavía trabajas aquí; no hace falta fecha de fin."
                              checked={exp.esActual}
                              onChange={(e) => updateExperience(index, 'esActual', e.target.checked)}
                            />
                            <FormField etiqueta="Descripción" id={`reg-exp-${exp.id}-descripcion`} className="sm:col-span-2">
                              <Textarea
                                value={exp.descripcion}
                                onChange={(e) => updateExperience(index, 'descripcion', e.target.value)}
                                rows={3}
                                placeholder="Describe tus responsabilidades y logros..."
                                className="resize-none text-base"
                              />
                            </FormField>
                          </div>
                        </TarjetaFila>
                      ))}

                      <Button variante="contorno" icono={Plus} anchoCompleto onClick={addExperience} className="h-12 border-dashed">
                        Agregar otra experiencia
                      </Button>
                    </>
                  )}
                </div>
              )}

              {/* Paso 5: Links */}
              {currentStep === 5 && (
                <div className="space-y-5">
                  <FormField
                    etiqueta="CV (currículum)"
                    id="reg-cvUrl"
                    ayuda={`Puedes ingresar una URL o subir un archivo (PDF, JPG, PNG - máx ${MAX_UPLOAD_MB}MB)`}
                  >
                    <Input
                      type="text"
                      inputMode="url"
                      value={cvUrl}
                      onChange={(e) => setCvUrl(e.target.value)}
                      aria-invalid={Boolean(errors.cvUrl) || undefined}
                      aria-describedby={errors.cvUrl ? 'reg-cv-error' : undefined}
                      placeholder="https://drive.google.com/... o sube un archivo"
                      className={CONTROL}
                    />
                    <ArchivoSubida
                      estado={cvUploading ? 'subiendo' : cvFile ? 'listo' : 'vacio'}
                      texto={cvUploading ? 'Subiendo...' : cvFile ? cvFile.name : 'Subir archivo'}
                      accept=".pdf,.jpg,.jpeg,.png"
                      disabled={cvUploading}
                      invalido={Boolean(errors.cvUrl)}
                      alElegir={(file) => handleCvUpload(file)}
                      contexto="CV"
                    />
                    {/* AUTHUI-003: el fallo de la subida sólo pintaba el borde
                        rojo del campo de URL, sin ningún texto. */}
                    {errors.cvUrl && (
                      <p
                        id="reg-cv-error"
                        role="alert"
                        className="flex items-start gap-1.5 text-[13px] font-medium text-danger"
                      >
                        <AlertCircle className="mt-px h-4 w-4 flex-none" aria-hidden="true" />
                        {errors.cvUrl}
                      </p>
                    )}
                  </FormField>

                  <FormField etiqueta="LinkedIn" id="reg-linkedinUrl">
                    <Input
                      type="text"
                      inputMode="url"
                      value={linkedinUrl}
                      onChange={(e) => setLinkedinUrl(e.target.value)}
                      aria-invalid={Boolean(errors.linkedinUrl) || undefined}
                      placeholder="https://linkedin.com/in/tu-perfil"
                      className={CONTROL}
                    />
                  </FormField>

                  <FormField etiqueta="Portafolio" id="reg-portafolioUrl">
                    <Input
                      type="text"
                      inputMode="url"
                      value={portafolioUrl}
                      onChange={(e) => setPortafolioUrl(e.target.value)}
                      aria-invalid={Boolean(errors.portafolioUrl) || undefined}
                      placeholder="https://behance.net/... o tu sitio web"
                      className={CONTROL}
                    />
                  </FormField>
                </div>
              )}

              {/* Paso 6: Documentos */}
              {currentStep === 6 && (
                <div className="space-y-4">
                  {/* FIX: Mensaje informativo para que el usuario pause y vea que está en el último paso */}
                  <AvisoAcceso tono="info" titulo="Último paso antes de crear tu cuenta">
                    Si tienes certificaciones, títulos u otros documentos relevantes, puedes agregarlos aquí. Si no
                    tienes documentos por ahora, puedes pulsar «Crear cuenta» directamente.
                  </AvisoAcceso>

                  {documents.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-line-strong/50 bg-paper">
                      <EmptyState
                        compacto
                        icono={FileText}
                        titulo="No hay documentos agregados"
                        descripcion={`PDF, JPG o PNG de hasta ${MAX_UPLOAD_MB}MB cada uno.`}
                        accion={
                          <Button variante="contorno" icono={Plus} onClick={addDocument}>
                            Agregar documento
                          </Button>
                        }
                      />
                    </div>
                  ) : (
                    <>
                      {documents.map((doc, index) => (
                        <TarjetaFila
                          key={doc.id}
                          id={`reg-doc-${doc.id}`}
                          titulo={`Documento ${index + 1}`}
                          etiquetaEliminar={`Eliminar documento ${index + 1}`}
                          alEliminar={() => removeDocument(doc.id)}
                          errores={[errors[`doc-${doc.id}`]]}
                        >
                          <div className="space-y-4">
                            <FormField etiqueta="Nombre del documento" requerido id={`reg-doc-${doc.id}-nombre`}>
                              <Input
                                type="text"
                                value={doc.name}
                                onChange={(e) => updateDocument(doc.id, 'name', e.target.value)}
                                onKeyDown={(e) => {
                                  // AUTHUI-018: Enter aquí enviaba el registro
                                  // completo y el documento a medio capturar se
                                  // descartaba en el filtro.
                                  if (e.key === 'Enter') e.preventDefault();
                                }}
                                required={false}
                                placeholder="Ej: Título universitario, Certificación AWS..."
                                className={CONTROL_FILA}
                              />
                            </FormField>

                            <div className="space-y-1.5">
                              <p className="text-sm font-medium text-ink">
                                Archivo
                                <span className="ml-0.5 text-danger" aria-hidden="true">
                                  *
                                </span>
                              </p>
                              <ArchivoSubida
                                estado={doc.uploading ? 'subiendo' : doc.fileUrl ? 'listo' : 'vacio'}
                                texto={
                                  doc.uploading
                                    ? `Subiendo${doc.file?.name ? ` «${doc.file.name}»` : ''}…`
                                    : doc.fileUrl
                                    ? doc.file?.name || 'Archivo subido'
                                    : 'Seleccionar archivo'
                                }
                                accept=".pdf,.jpg,.jpeg,.png"
                                disabled={doc.uploading}
                                invalido={Boolean(doc.error)}
                                alElegir={(file) => updateDocument(doc.id, 'file', file)}
                                contexto={`documento ${index + 1} (obligatorio)`}
                              />
                              {doc.error && (
                                <p role="alert" className="flex items-start gap-1.5 text-[13px] font-medium text-danger">
                                  <AlertCircle className="mt-px h-4 w-4 flex-none" aria-hidden="true" />
                                  {doc.error}
                                </p>
                              )}
                            </div>
                          </div>
                        </TarjetaFila>
                      ))}

                      <Button variante="contorno" icono={Plus} anchoCompleto onClick={addDocument} className="h-12 border-dashed">
                        Agregar otro documento
                      </Button>
                    </>
                  )}
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="mt-8 border-t border-line pt-6">
                <div className="flex flex-wrap gap-3">
                  {currentStep > 1 && (
                    <Button
                      variante="publico-fantasma"
                      tamano="lg"
                      icono={ArrowLeft}
                      onClick={alPulsarAnterior}
                      className="ac-atras flex-1 sm:flex-none"
                    >
                      Anterior
                    </Button>
                  )}

                  {currentStep < 6 ? (
                    <Button
                      variante="publico-naranja"
                      tamano="lg"
                      iconoFinal={ArrowRight}
                      onClick={alPulsarSiguiente}
                      className="flex-1 sm:ml-auto sm:flex-none"
                    >
                      Siguiente
                    </Button>
                  ) : (
                    <Button
                      variante="publico-naranja"
                      type="submit"
                      tamano="lg"
                      // AUTHUI-007: con un archivo en vuelo, el payload saldría sin él.
                      disabled={stepTransitioning || hayArchivosSubiendo}
                      cargando={isSubmitting}
                      textoCargando="Creando cuenta…"
                      iconoFinal={ArrowRight}
                      className="flex-1 sm:ml-auto sm:flex-none"
                    >
                      Crear cuenta
                    </Button>
                  )}
                </div>

                {/* AUTHUI-007: explicar por qué el botón está deshabilitado */}
                {currentStep === 6 && hayArchivosSubiendo && (
                  <p role="status" className="mt-3 text-center text-sm text-ink-muted sm:text-right">
                    Espera a que terminen de subir tus archivos
                  </p>
                )}

                {/* Skip to end */}
                {currentStep < 6 && (
                  <button
                    type="button"
                    onClick={() => {
                      // FIX: Protección contra double-click al saltar a paso 6
                      desplazarAlPaso.current = true;
                      setStepTransitioning(true);
                      setCurrentStep(6);
                      setTimeout(() => setStepTransitioning(false), 500);
                    }}
                    className="mx-auto mt-5 block rounded-md px-2 py-1 text-sm font-medium text-ink-muted underline decoration-ink-muted/40 underline-offset-4 transition-colors duration-150 hover:text-ink hover:decoration-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
                  >
                    Omitir y crear cuenta con datos básicos
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Footer */}
          <p className="hm-rv mt-8 text-sm text-ink">
            <span>¿Ya tienes una cuenta?</span>{' '}
            <Link href="/login" className="ac-enlace">
              Iniciar sesión
            </Link>
          </p>
        </MarcoAcceso>
      </main>
      <Footer />
      <SiteMotion />
    </>
  );
}
