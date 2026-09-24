// RUTA: src/components/sections/admin/CandidateForm.tsx

'use client';

/**
 * Alta («inyectar») y edición de un candidato del banco, desde el panel de
 * administración.
 *
 * Registro de APLICACIÓN (docs/DISENO.md): Modal accesible + pestañas (Tabs)
 * con el MISMO estado de siempre (`activeTab`), los mismos campos, las mismas
 * validaciones de handleSubmit y el mismo cuerpo hacia la misma API. Pestañas
 * y no pasos: el admin salta directo a «Documentos» o guarda sólo los datos
 * personales, y el botón de guardar sirve desde cualquier pestaña (como antes).
 *
 * Presentación nueva, sin tocar la lógica:
 * - el error de handleSubmit se sigue pintando arriba (role="alert") y además
 *   marca el campo al que se refiere y le lleva el foco;
 * - el enlace de un documento es siempre editable (antes, al escribir la
 *   primera letra el campo se sustituía por «Enlace no válido» y sólo se podía
 *   pegar la URL de una vez);
 * - la foto rota muestra el icono en vez del de imagen rota del navegador.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Plus,
  User,
  UserPlus,
  UserPen,
  GraduationCap,
  Briefcase,
  Link as LinkIcon,
  Linkedin,
  Save,
  Search,
  FileText,
  KeyRound,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  X
} from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Tabs, { PanelPestana } from '@/components/ui/Tabs';
import FormField, { Input, Select, Textarea, Checkbox } from '@/components/ui/FormField';
import Button, { ButtonLink } from '@/components/ui/Button';
import CampoContrasena from '@/components/ui/CampoContrasena';
import SelectorArchivo from '@/components/ui/SelectorArchivo';
import TarjetaRepetible from '@/components/ui/TarjetaRepetible';
import EmptyState from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';

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

/**
 * ADM-052: vocabulario único de estatus de educación, el mismo del registro
 * público (src/app/register/page.tsx) y el que colorean las vistas. Antes el
 * alta desde admin guardaba Completa/En curso/Trunca, que ninguna vista
 * reconocía: el badge salía siempre en gris.
 */
const ESTATUS_EDUCACION = ['Cursando', 'Terminado', 'Trunco', 'Titulado'];
const ESTATUS_EDUCACION_POR_DEFECTO = 'Terminado';

/** Id del <form>: el botón de guardar vive fuera de él, en el pie del modal. */
const FORM_ID = 'candidate-form';

/** Prefijo de ids de pestañas y paneles. */
const ID_PESTANAS = 'form-candidato';

/**
 * ¿Es una URL http(s) absoluta? Misma regla que isSafeHttpUrl
 * (src/lib/sanitize.ts). Estas URLs acaban como `href` que abren reclutadores,
 * especialistas y empresas: `javascript:` no puede entrar (ADM-079).
 */
const esUrlHttp = (valor: string): boolean => {
  try {
    const url = new URL(valor);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

/** Formato mínimo de correo (el navegador no lo valida: ver FORM_ID). */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Sólo presentación: ¿lo escrito todavía puede ser el principio de
 * «https://» o «http://»? Así el aviso de enlace no válido no salta mientras
 * se teclea el esquema.
 */
const empiezaUnEsquema = (valor: string) => {
  const v = valor.trim().toLowerCase();
  return 'https://'.startsWith(v) || 'http://'.startsWith(v);
};

/** Título de un bloque del formulario (h3: el h2 es el título del modal). */
function TituloBloque({ icono: Icono, children, id }: { icono: typeof User; children: React.ReactNode; id: string }) {
  return (
    <h3 id={id} className="mb-4 flex items-center gap-2 font-display text-sm font-semibold text-ink">
      <Icono size={16} className="text-teal" aria-hidden="true" />
      {children}
    </h3>
  );
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
  const [cartaPresentacion, setCartaPresentacion] = useState('');

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

  // Sólo presentación: la URL de foto que no se pudo pintar (se guarda la URL,
  // no un booleano, para reintentar si llega otra).
  const [fotoFallida, setFotoFallida] = useState<string | null>(null);
  const nombreRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Opciones.
  // ADM-024: los perfiles salen del catálogo de especialidades (/admin/specialties).
  // Antes era una lista fija de 7 nombres: una especialidad nueva ("Marketing")
  // no se podía asignar y una renombrada dejaba el select vacío al editar.
  const [catalogoPerfiles, setCatalogoPerfiles] = useState<string[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelado = false;
    const cargar = async () => {
      try {
        const res = await fetch('/api/specialties');
        const data = await res.json();
        if (!cancelado && data.success && Array.isArray(data.names)) {
          setCatalogoPerfiles(data.names as string[]);
        }
      } catch (err) {
        console.error('Error cargando especialidades:', err);
      }
    };
    cargar();
    return () => {
      cancelado = true;
    };
  }, [isOpen]);

  // Si el candidato tiene un perfil que ya no está en el catálogo (renombrado o
  // desactivado) se conserva como opción para no borrárselo al guardar.
  const profiles =
    profile && !catalogoPerfiles.includes(profile)
      ? [profile, ...catalogoPerfiles]
      : catalogoPerfiles;

  const seniorities = ['Practicante', 'Jr', 'Middle', 'Sr', 'Director'];
  const sources = [
    { value: 'manual', label: 'Ingreso manual' },
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
          estatus: ESTATUS_EDUCACION_POR_DEFECTO
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
      setCartaPresentacion(candidateToEdit.cartaPresentacion || '');
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
    setCartaPresentacion('');
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
      estatus: ESTATUS_EDUCACION_POR_DEFECTO
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

    /**
     * ADM-032: los `required`/`type=email` del formulario no protegían nada. El
     * botón de guardar estaba fuera del <form> y llamaba a handleSubmit por
     * onClick, así que el navegador nunca validaba; y los campos de las pestañas
     * no visibles ni siquiera están en el DOM. Borrar el email por error y
     * pulsar "Actualizar" lo guardaba vacío y el candidato perdía el vínculo
     * con sus postulaciones. Se valida aquí, siempre.
     */
    if (!nombre.trim() || !apellidoPaterno.trim()) {
      setActiveTab('personal');
      setError('Nombre y apellido paterno son obligatorios.');
      return;
    }
    if (!EMAIL_REGEX.test(email.trim())) {
      setActiveTab('personal');
      setError('Escribe un email válido.');
      return;
    }

    // ADM-079: sólo enlaces http(s); cualquier otra cosa acaba como href.
    const urlsDePerfil: Array<[string, string]> = [
      ['URL del CV', cvUrl],
      ['LinkedIn', linkedinUrl],
      ['Portafolio', portafolioUrl]
    ];
    const urlMala = urlsDePerfil.find(([, valor]) => valor.trim() && !esUrlHttp(valor.trim()));
    if (urlMala) {
      setActiveTab('links');
      setError(`${urlMala[0]}: el enlace debe empezar por https:// (o http://).`);
      return;
    }
    const documentoMalo = documents.find(
      (doc) => doc.name && doc.fileUrl && !esUrlHttp(doc.fileUrl.trim())
    );
    if (documentoMalo) {
      setActiveTab('documents');
      setError(`El documento "${documentoMalo.name}" no tiene un enlace http(s) válido.`);
      return;
    }

    // Validar contraseña si se proporcionó
    if (password && password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres');
      return;
    }

    setIsSubmitting(true);

    try {
      const data = {
        nombre: nombre.trim(),
        apellidoPaterno: apellidoPaterno.trim(),
        apellidoMaterno: apellidoMaterno || null,
        email: email.trim(),
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
        cartaPresentacion: cartaPresentacion || null,
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

  // ---------------------------------------------------------------------------
  // Presentación
  // ---------------------------------------------------------------------------

  // ¿A qué campo se refiere el error de handleSubmit? (sólo para marcarlo; el
  // mensaje completo se sigue pintando arriba)
  const errorNombre = error === 'Nombre y apellido paterno son obligatorios.';
  const errorEmail = error === 'Escribe un email válido.';
  const errorContrasena = error === 'La contraseña debe tener al menos 8 caracteres';
  const errorEnlace = (etiqueta: string) => error.startsWith(`${etiqueta}:`);
  const errorDocumento = (doc: Document) =>
    !!doc.name && error === `El documento "${doc.name}" no tiene un enlace http(s) válido.`;

  // Con un error nuevo, el foco va al primer campo marcado (si lo hay): el
  // lector anuncia el mensaje y la persona puede corregir sin buscarlo. Sólo
  // cuando CAMBIA el error: cambiar de pestaña no debe robar el foco.
  useEffect(() => {
    if (!error) return;
    const t = window.setTimeout(() => {
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    }, 0);
    return () => window.clearTimeout(t);
  }, [error]);

  const cerrar = () => {
    resetForm();
    onClose();
  };

  const nombreEdicion = candidateToEdit
    ? [candidateToEdit.nombre, candidateToEdit.apellidoPaterno, candidateToEdit.apellidoMaterno].filter(Boolean).join(' ')
    : '';

  const tieneCuenta = Boolean(candidateToEdit?.userId || resetSuccess);

  if (!isOpen) return null;

  return (
    <Modal
      abierto={isOpen}
      alCerrar={cerrar}
      tamano="lg"
      // Un formulario a medias no se pierde por pulsar fuera (antes tampoco).
      cerrarAlPulsarFondo={false}
      focoInicial={nombreRef}
      iconoTitulo={
        candidateToEdit ? (
          <UserPen size={20} className="flex-none text-teal" aria-hidden="true" />
        ) : (
          <UserPlus size={20} className="flex-none text-teal" aria-hidden="true" />
        )
      }
      titulo={candidateToEdit ? 'Editar candidato' : 'Inyectar nuevo candidato'}
      subtitulo={
        candidateToEdit ? (
          <span className="font-medium text-ink">{nombreEdicion}</span>
        ) : undefined
      }
      descripcion={
        candidateToEdit
          ? 'Modifica los datos del candidato.'
          : 'Agrega un candidato manualmente desde LinkedIn, OCC, etc.'
      }
      claseCuerpo="pt-0"
      pie={
        <>
          <Button variante="contorno" onClick={cerrar}>
            Cancelar
          </Button>
          {/* Botón de envío real del <form> (ADM-032): Enter y clic pasan por
              onSubmit y por la validación de handleSubmit. */}
          <Button
            type="submit"
            form={FORM_ID}
            icono={Save}
            cargando={isSubmitting}
            textoCargando="Guardando…"
          >
            {candidateToEdit ? 'Actualizar' : 'Guardar candidato'}
          </Button>
        </>
      }
    >
      {/* Pestañas fijas arriba del cuerpo mientras se baja por el formulario */}
      <div className="sticky top-0 z-10 -mx-5 bg-white px-5 sm:-mx-6 sm:px-6">
        <Tabs
          idBase={ID_PESTANAS}
          etiqueta="Secciones del candidato"
          activa={activeTab}
          alCambiar={setActiveTab}
          pestanas={[
            { id: 'personal', etiqueta: 'Datos personales' },
            { id: 'education', etiqueta: 'Educación', contador: educations.length > 0 ? educations.length : undefined },
            { id: 'experience', etiqueta: 'Experiencia', contador: experiences.length > 0 ? experiences.length : undefined },
            { id: 'links', etiqueta: 'Enlaces' },
            { id: 'documents', etiqueta: 'Documentos', contador: documents.length > 0 ? documents.length : undefined }
          ]}
        />
      </div>

      <form ref={formRef} id={FORM_ID} onSubmit={handleSubmit} noValidate>
        {error && (
          <div
            role="alert"
            className="mt-5 rounded-xl border border-danger/30 bg-danger-tint px-4 py-3 text-sm text-danger-dark"
          >
            <div className="flex items-start gap-2">
              <AlertCircle size={18} className="mt-px flex-none" aria-hidden="true" />
              <p className="font-medium">{error}</p>
            </div>
            {existingCandidateId && (
              <div className="mt-3 flex flex-wrap gap-2 pl-7">
                <ButtonLink
                  href={`/admin/candidates?search=${encodeURIComponent(email)}`}
                  variante="secundario"
                  tamano="sm"
                  icono={Search}
                  onClick={onClose}
                >
                  Buscar en el banco de candidatos
                </ButtonLink>
                <ButtonLink
                  href="/admin/assign-candidates"
                  variante="contorno"
                  tamano="sm"
                  icono={ExternalLink}
                  onClick={onClose}
                >
                  Ir a Asignar candidatos
                </ButtonLink>
              </div>
            )}
          </div>
        )}

        {/* Pestaña: datos personales */}
        <PanelPestana idBase={ID_PESTANAS} id="personal" activa={activeTab}>
          <div className="space-y-8">
            <section aria-labelledby="cf-identidad" className="[overflow:visible]">
              <TituloBloque icono={User} id="cf-identidad">
                Identidad y contacto
              </TituloBloque>

              {/* FEAT-2: Foto de perfil */}
              <div className="mb-5 flex items-center gap-4 rounded-xl border border-line bg-paper/60 p-4">
                <div className="flex h-16 w-16 flex-none items-center justify-center overflow-hidden rounded-full bg-mist ring-1 ring-line">
                  {fotoUrl && fotoFallida !== fotoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={fotoUrl}
                      alt="Foto de perfil del candidato"
                      className="h-full w-full object-cover"
                      onError={() => setFotoFallida(fotoUrl)}
                    />
                  ) : (
                    <User className="h-7 w-7 text-ink-muted" aria-hidden="true" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink">Foto de perfil</p>
                  <p id="cf-foto-ayuda" className="text-[13px] text-ink-muted">
                    JPG, PNG o WebP (máx. 2 MB)
                    {fotoUrl && fotoFallida === fotoUrl && ' · No se pudo mostrar la vista previa.'}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {/* El <input type="file"> va dentro, oculto a la vista pero
                        alcanzable con Tab (SelectorArchivo). */}
                    <SelectorArchivo
                      accept="image/jpeg,image/png,image/webp"
                      aria-describedby="cf-foto-ayuda"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFotoUpload(file);
                      }}
                      cargando={fotoUploading}
                      textoCargando="Subiendo…"
                    >
                      {fotoUrl ? 'Cambiar foto' : 'Subir foto'}
                    </SelectorArchivo>
                    {fotoUrl && (
                      <Button
                        variante="fantasma"
                        tamano="sm"
                        icono={X}
                        className="text-danger hover:bg-danger-tint"
                        onClick={() => setFotoUrl('')}
                      >
                        Eliminar foto
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <FormField
                  etiqueta="Nombre"
                  requerido
                  id="cf-nombre"
                  error={errorNombre && !nombre.trim() ? 'Escribe el nombre.' : undefined}
                >
                  <Input
                    ref={nombreRef}
                    type="text"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                  />
                </FormField>
                <FormField
                  etiqueta="Apellido paterno"
                  requerido
                  id="cf-apellido-paterno"
                  error={errorNombre && !apellidoPaterno.trim() ? 'Escribe el apellido paterno.' : undefined}
                >
                  <Input
                    type="text"
                    value={apellidoPaterno}
                    onChange={(e) => setApellidoPaterno(e.target.value)}
                  />
                </FormField>
                <FormField etiqueta="Apellido materno" opcional id="cf-apellido-materno">
                  <Input
                    type="text"
                    value={apellidoMaterno}
                    onChange={(e) => setApellidoMaterno(e.target.value)}
                  />
                </FormField>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  etiqueta="Email"
                  requerido
                  id="cf-email"
                  error={errorEmail ? 'Revisa el formato: nombre@dominio.com' : undefined}
                >
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </FormField>
                <FormField etiqueta="Teléfono" opcional id="cf-telefono">
                  <Input
                    type="tel"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    placeholder="81 1234 5678"
                  />
                </FormField>
                <FormField etiqueta="Sexo" opcional id="cf-sexo">
                  <Select value={sexo} onChange={(e) => setSexo(e.target.value)}>
                    <option value="">Seleccionar</option>
                    <option value="M">Masculino</option>
                    <option value="F">Femenino</option>
                    <option value="Otro">Otro</option>
                  </Select>
                </FormField>
                <FormField etiqueta="Fecha de nacimiento" opcional id="cf-fecha-nacimiento">
                  <Input
                    type="date"
                    value={fechaNacimiento}
                    onChange={(e) => setFechaNacimiento(e.target.value)}
                  />
                </FormField>
              </div>
            </section>

            <section aria-labelledby="cf-profesional" className="border-t border-line pt-6 [overflow:visible]">
              <TituloBloque icono={Briefcase} id="cf-profesional">
                Perfil profesional
              </TituloBloque>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <FormField etiqueta="Perfil profesional" id="cf-perfil">
                  <Select value={profile} onChange={(e) => setProfile(e.target.value)}>
                    <option value="">Seleccionar</option>
                    {profiles.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField etiqueta="Nivel de experiencia" id="cf-nivel">
                  <Select value={seniority} onChange={(e) => setSeniority(e.target.value)}>
                    <option value="">Seleccionar</option>
                    {seniorities.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField etiqueta="Fuente del candidato" id="cf-fuente">
                  <Select value={source} onChange={(e) => setSource(e.target.value)}>
                    {sources.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </Select>
                </FormField>
              </div>
            </section>

            {/* Cuenta de acceso */}
            <section aria-labelledby="cf-cuenta" className="border-t border-line pt-6 [overflow:visible]">
              <TituloBloque icono={KeyRound} id="cf-cuenta">
                Cuenta de acceso
              </TituloBloque>

              {!candidateToEdit ? (
                /* Nuevo candidato: campo de contraseña opcional */
                <FormField
                  etiqueta="Contraseña"
                  opcional
                  id="cf-password"
                  className="sm:max-w-sm"
                  error={errorContrasena && password ? 'Mínimo 8 caracteres.' : undefined}
                  ayuda="Si la escribes, el candidato podrá iniciar sesión en INAKAT con su email y esta contraseña."
                >
                  <CampoContrasena
                    visible={showPassword}
                    alAlternar={() => setShowPassword(!showPassword)}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    autoComplete="new-password"
                  />
                </FormField>
              ) : (
                /* Candidato existente: mostrar estado de cuenta */
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    {tieneCuenta ? (
                      <Badge tono="exito" icono={CheckCircle}>
                        Tiene cuenta de acceso
                      </Badge>
                    ) : (
                      <Badge tono="neutro" icono={User}>
                        Sin cuenta de acceso
                      </Badge>
                    )}
                    {tieneCuenta && !showResetPassword && (
                      <Button variante="fantasma" tamano="sm" icono={KeyRound} onClick={() => setShowResetPassword(true)}>
                        Resetear contraseña
                      </Button>
                    )}
                    {!tieneCuenta && !showCreateAccount && (
                      <Button variante="fantasma" tamano="sm" icono={Plus} onClick={() => setShowCreateAccount(true)}>
                        Crear cuenta de acceso
                      </Button>
                    )}
                    {/* Región viva siempre presente: anuncia el éxito al llegar. */}
                    <p role="status" className="text-[13px] font-medium text-lime-dark">
                      {resetSuccess ? 'Listo: la contraseña de acceso quedó guardada.' : ''}
                    </p>
                  </div>

                  {((tieneCuenta && showResetPassword) || (!tieneCuenta && showCreateAccount)) && (
                    <div className="space-y-3 rounded-xl border border-line bg-paper p-4 sm:max-w-md">
                      <FormField
                        etiqueta={tieneCuenta ? 'Nueva contraseña' : 'Contraseña para la cuenta'}
                        id="cf-reset-password"
                        error={errorContrasena ? 'Mínimo 8 caracteres.' : undefined}
                        ayuda={
                          tieneCuenta
                            ? 'Mínimo 8 caracteres.'
                            : 'Se creará una cuenta con el email del candidato y esta contraseña.'
                        }
                      >
                        <CampoContrasena
                          visible={showResetPasswordText}
                          alAlternar={() => setShowResetPasswordText(!showResetPasswordText)}
                          value={resetPassword}
                          onChange={(e) => setResetPassword(e.target.value)}
                          placeholder="Mínimo 8 caracteres"
                          autoComplete="new-password"
                        />
                      </FormField>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variante="secundario"
                          tamano="sm"
                          onClick={handleResetPassword}
                          disabled={resetPassword.length < 8}
                          cargando={resettingPassword}
                          textoCargando={tieneCuenta ? 'Guardando…' : 'Creando…'}
                        >
                          {tieneCuenta ? 'Guardar' : 'Crear cuenta'}
                        </Button>
                        <Button
                          variante="fantasma"
                          tamano="sm"
                          onClick={() => {
                            if (tieneCuenta) {
                              setShowResetPassword(false);
                            } else {
                              setShowCreateAccount(false);
                            }
                            setResetPassword('');
                            setShowResetPasswordText(false);
                          }}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>

            <section aria-labelledby="cf-presentacion" className="border-t border-line pt-6 [overflow:visible]">
              <TituloBloque icono={FileText} id="cf-presentacion">
                Presentación y notas
              </TituloBloque>
              <div className="space-y-4">
                <FormField
                  etiqueta="Carta de presentación"
                  opcional
                  id="cf-carta"
                  ayuda={
                    <span className="flex items-start justify-between gap-3">
                      <span>Visible para empresas que revisen el perfil.</span>
                      <span className={cn('flex-none tabular-nums', cartaPresentacion.length >= 1000 && 'font-medium text-danger')}>
                        {cartaPresentacion.length}/1000
                      </span>
                    </span>
                  }
                >
                  <Textarea
                    value={cartaPresentacion}
                    onChange={(e) => {
                      if (e.target.value.length <= 1000) setCartaPresentacion(e.target.value);
                    }}
                    rows={4}
                    placeholder="Breve introducción profesional del candidato…"
                    className="resize-y"
                  />
                </FormField>
                <FormField etiqueta="Notas internas" opcional id="cf-notas">
                  <Textarea
                    value={notas}
                    onChange={(e) => setNotas(e.target.value)}
                    rows={3}
                    placeholder="Observaciones sobre el candidato…"
                    className="resize-y"
                  />
                </FormField>
              </div>
            </section>
          </div>
        </PanelPestana>

        {/* Pestaña: educación (tarjetas dinámicas) */}
        <PanelPestana idBase={ID_PESTANAS} id="education" activa={activeTab}>
          {educations.length === 0 ? (
            <EmptyState
              compacto
              icono={GraduationCap}
              titulo="No hay educación agregada"
              descripcion="Agrega los estudios del candidato, del más reciente al más antiguo."
              accion={
                <Button variante="contorno" tamano="sm" icono={Plus} onClick={addEducation}>
                  Agregar educación
                </Button>
              }
            />
          ) : (
            <div className="space-y-4">
              <p className="text-[13px] text-ink-muted">
                El primer estudio de la lista es el que se usa en el filtro por universidad del banco.
              </p>
              <ol className="space-y-4">
                {educations.map((edu, index) => (
                  <TarjetaRepetible
                    key={edu.id}
                    titulo={edu.carrera || `Estudio ${index + 1}`}
                    detalle={[edu.nivel, edu.institucion].filter(Boolean).join(' · ') || undefined}
                    etiquetaQuitar={`Eliminar estudio ${index + 1}`}
                    alQuitar={() => removeEducation(index)}
                  >
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <FormField etiqueta="Nivel de estudios" id={`cf-edu-${edu.id}-nivel`}>
                        <Select
                          value={edu.nivel}
                          onChange={(e) => updateEducation(index, 'nivel', e.target.value)}
                        >
                          <option value="">Seleccionar</option>
                          {nivelesEstudio.map((nivel) => (
                            <option key={nivel} value={nivel}>
                              {nivel}
                            </option>
                          ))}
                        </Select>
                      </FormField>
                      <FormField etiqueta="Institución" id={`cf-edu-${edu.id}-institucion`}>
                        <Input
                          type="text"
                          value={edu.institucion}
                          onChange={(e) => updateEducation(index, 'institucion', e.target.value)}
                          placeholder="Ej: UANL, Tec de Monterrey…"
                        />
                      </FormField>
                      <FormField etiqueta="Carrera" id={`cf-edu-${edu.id}-carrera`}>
                        <Input
                          type="text"
                          value={edu.carrera}
                          onChange={(e) => updateEducation(index, 'carrera', e.target.value)}
                          placeholder="Ej: Ingeniería en Sistemas…"
                        />
                      </FormField>
                      <FormField etiqueta="Estatus" id={`cf-edu-${edu.id}-estatus`}>
                        <Select
                          value={edu.estatus}
                          onChange={(e) => updateEducation(index, 'estatus', e.target.value)}
                        >
                          {/* Un valor viejo (Completa/En curso/Trunca) se
                              conserva como opción hasta que el admin lo cambie. */}
                          {edu.estatus && !ESTATUS_EDUCACION.includes(edu.estatus) && (
                            <option value={edu.estatus}>{edu.estatus}</option>
                          )}
                          {ESTATUS_EDUCACION.map((estatus) => (
                            <option key={estatus} value={estatus}>{estatus}</option>
                          ))}
                        </Select>
                      </FormField>
                      <FormField etiqueta="Año de inicio" opcional id={`cf-edu-${edu.id}-inicio`}>
                        <Input
                          type="number"
                          inputMode="numeric"
                          value={edu.añoInicio || ''}
                          onChange={(e) => updateEducation(index, 'añoInicio', e.target.value ? parseInt(e.target.value) : null)}
                          placeholder="Ej: 2018"
                          className="tabular-nums"
                          min="1970" max="2030"
                        />
                      </FormField>
                      <FormField etiqueta="Año de fin" opcional id={`cf-edu-${edu.id}-fin`}>
                        <Input
                          type="number"
                          inputMode="numeric"
                          value={edu.añoFin || ''}
                          onChange={(e) => updateEducation(index, 'añoFin', e.target.value ? parseInt(e.target.value) : null)}
                          placeholder="Ej: 2022"
                          className="tabular-nums"
                          min="1970" max="2030"
                        />
                      </FormField>
                    </div>
                  </TarjetaRepetible>
                ))}
              </ol>
              <Button variante="contorno" anchoCompleto icono={Plus} className="border-dashed" onClick={addEducation}>
                Agregar otra educación
              </Button>
            </div>
          )}
        </PanelPestana>

        {/* Pestaña: experiencia */}
        <PanelPestana idBase={ID_PESTANAS} id="experience" activa={activeTab}>
          {experiences.length === 0 ? (
            <EmptyState
              compacto
              icono={Briefcase}
              titulo="No hay experiencias agregadas"
              descripcion="Los años de experiencia del candidato se calculan con estas fechas."
              accion={
                <Button variante="contorno" tamano="sm" icono={Plus} onClick={addExperience}>
                  Agregar experiencia
                </Button>
              }
            />
          ) : (
            <div className="space-y-4">
              <p className="text-[13px] text-ink-muted">
                Una experiencia sin empresa, puesto o fecha de inicio no se guarda.
              </p>
              <ol className="space-y-4">
                {experiences.map((exp, index) => (
                  <TarjetaRepetible
                    key={index}
                    titulo={`Experiencia ${index + 1}`}
                    detalle={[exp.puesto, exp.empresa].filter(Boolean).join(' · ') || undefined}
                    etiquetaQuitar={`Eliminar experiencia ${index + 1}`}
                    alQuitar={() => removeExperience(index)}
                  >
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <FormField etiqueta="Empresa" requerido id={`cf-exp-${index}-empresa`}>
                        <Input
                          type="text"
                          value={exp.empresa}
                          onChange={(e) =>
                            updateExperience(index, 'empresa', e.target.value)
                          }
                        />
                      </FormField>
                      <FormField etiqueta="Puesto" requerido id={`cf-exp-${index}-puesto`}>
                        <Input
                          type="text"
                          value={exp.puesto}
                          onChange={(e) =>
                            updateExperience(index, 'puesto', e.target.value)
                          }
                        />
                      </FormField>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <FormField etiqueta="Ubicación" opcional id={`cf-exp-${index}-ubicacion`}>
                        <Input
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
                        />
                      </FormField>
                      <FormField etiqueta="Fecha de inicio" requerido id={`cf-exp-${index}-inicio`}>
                        <Input
                          type="date"
                          value={exp.fechaInicio}
                          onChange={(e) =>
                            updateExperience(
                              index,
                              'fechaInicio',
                              e.target.value
                            )
                          }
                        />
                      </FormField>
                      <FormField
                        etiqueta="Fecha de fin"
                        id={`cf-exp-${index}-fin`}
                        ayuda={exp.esActual ? 'Trabajo actual: sin fecha de fin.' : undefined}
                      >
                        <Input
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
                        />
                      </FormField>
                    </div>

                    <Checkbox
                      className="mt-4"
                      id={`cf-exp-${index}-actual`}
                      etiqueta="Trabajo actual"
                      checked={exp.esActual}
                      onChange={(e) =>
                        updateExperience(
                          index,
                          'esActual',
                          e.target.checked
                        )
                      }
                    />

                    <FormField etiqueta="Descripción" opcional id={`cf-exp-${index}-descripcion`} className="mt-4">
                      <Textarea
                        value={exp.descripcion}
                        onChange={(e) =>
                          updateExperience(
                            index,
                            'descripcion',
                            e.target.value
                          )
                        }
                        rows={3}
                        placeholder="Responsabilidades y logros…"
                        className="resize-y"
                      />
                    </FormField>
                  </TarjetaRepetible>
                ))}
              </ol>

              <Button variante="contorno" anchoCompleto icono={Plus} className="border-dashed" onClick={addExperience}>
                Agregar otra experiencia
              </Button>
            </div>
          )}
        </PanelPestana>

        {/* Pestaña: enlaces */}
        <PanelPestana idBase={ID_PESTANAS} id="links" activa={activeTab}>
          <div className="space-y-4 sm:max-w-xl">
            <FormField
              etiqueta="URL del CV"
              opcional
              id="cf-cv"
              ayuda="Enlace a Google Drive, Dropbox, etc."
              error={errorEnlace('URL del CV') ? 'El enlace debe empezar por https:// (o http://).' : undefined}
            >
              <Input
                type="url"
                value={cvUrl}
                onChange={(e) => setCvUrl(e.target.value)}
                placeholder="https://drive.google.com/..."
                prefijo={<FileText />}
              />
            </FormField>

            <FormField
              etiqueta="LinkedIn"
              opcional
              id="cf-linkedin"
              error={errorEnlace('LinkedIn') ? 'El enlace debe empezar por https:// (o http://).' : undefined}
            >
              <Input
                type="url"
                value={linkedinUrl}
                onChange={(e) => setLinkedinUrl(e.target.value)}
                placeholder="https://linkedin.com/in/..."
                prefijo={<Linkedin />}
              />
            </FormField>

            <FormField
              etiqueta="Portafolio"
              opcional
              id="cf-portafolio"
              error={errorEnlace('Portafolio') ? 'El enlace debe empezar por https:// (o http://).' : undefined}
            >
              <Input
                type="url"
                value={portafolioUrl}
                onChange={(e) => setPortafolioUrl(e.target.value)}
                placeholder="https://behance.net/..."
                prefijo={<LinkIcon />}
              />
            </FormField>
          </div>
        </PanelPestana>

        {/* Pestaña: documentos */}
        <PanelPestana idBase={ID_PESTANAS} id="documents" activa={activeTab}>
          <div className="space-y-4">
            <p className="text-sm text-ink-muted">
              Agrega documentos adicionales del candidato (títulos, certificaciones, etc.)
            </p>

            {documents.length === 0 ? (
              <EmptyState
                compacto
                icono={FileText}
                titulo="No hay documentos agregados"
                accion={
                  <Button variante="contorno" tamano="sm" icono={Plus} onClick={addDocument}>
                    Agregar documento
                  </Button>
                }
              />
            ) : (
              <>
                <ol className="space-y-4">
                  {documents.map((doc, index) => {
                    const enlace = doc.fileUrl.trim();
                    const valido = enlace !== '' && esUrlHttp(enlace);
                    const invalido = enlace !== '' && !valido && !empiezaUnEsquema(enlace);
                    const subiendo = uploadingDoc === index;
                    return (
                      <TarjetaRepetible
                        key={index}
                        titulo={doc.name || `Documento ${index + 1}`}
                        detalle={doc.fileType ? doc.fileType.toUpperCase() : undefined}
                        etiquetaQuitar={`Quitar documento ${index + 1}`}
                        alQuitar={() => removeDocument(index)}
                      >
                        <div className="grid grid-cols-1 gap-4">
                          <FormField etiqueta="Nombre del documento" id={`cf-doc-${index}-nombre`}>
                            <Input
                              type="text"
                              value={doc.name}
                              onChange={(e) => updateDocument(index, 'name', e.target.value)}
                              placeholder="Ej: Título universitario"
                            />
                          </FormField>

                          <FormField
                            etiqueta="Archivo"
                            id={`cf-doc-${index}-archivo`}
                            ayuda="Sube un PDF, Word o imagen, o pega un enlace que empiece por https://."
                            error={
                              errorDocumento(doc) || invalido
                                ? `Enlace no válido: ${doc.fileUrl}`
                                : undefined
                            }
                          >
                            <div className="flex flex-col gap-2 sm:flex-row">
                              <div className="min-w-0 flex-1">
                                <Input
                                  type="url"
                                  value={doc.fileUrl}
                                  onChange={(e) => updateDocument(index, 'fileUrl', e.target.value)}
                                  placeholder="URL del documento"
                                  prefijo={<LinkIcon />}
                                />
                              </div>
                              <SelectorArchivo
                                className="h-10 flex-none"
                                onChange={(e) => handleDocumentUpload(index, e.target.files?.[0])}
                                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                                cargando={subiendo}
                                textoCargando="Subiendo…"
                              >
                                {doc.fileUrl ? 'Subir otro' : 'Subir archivo'}
                              </SelectorArchivo>
                            </div>
                          </FormField>

                          {valido && (
                            <div className="flex flex-wrap items-center gap-3">
                              <a
                                href={doc.fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 rounded text-sm font-medium text-teal hover:text-teal-dark hover:underline"
                              >
                                <FileText size={14} aria-hidden="true" />
                                Ver archivo
                                <span className="sr-only"> (se abre en otra pestaña)</span>
                              </a>
                              <button
                                type="button"
                                onClick={() => updateDocument(index, 'fileUrl', '')}
                                className="rounded text-[13px] text-ink-muted hover:text-danger hover:underline"
                              >
                                Quitar archivo
                              </button>
                            </div>
                          )}
                        </div>
                      </TarjetaRepetible>
                    );
                  })}
                </ol>

                <Button variante="contorno" anchoCompleto icono={Plus} className="border-dashed" onClick={addDocument}>
                  Agregar otro documento
                </Button>
              </>
            )}
          </div>
        </PanelPestana>
      </form>
    </Modal>
  );
};

export default CandidateForm;
