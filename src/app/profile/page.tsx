// RUTA: src/app/profile/page.tsx

'use client';

/**
 * Mi perfil (todos los roles; el candidato ve además sus datos, experiencia,
 * educación y documentos). Registro de aplicación (docs/DISENO.md).
 *
 * Presentación: PageHeader → resumen (foto, nombre y cuánto del perfil está
 * lleno, dicho con el arco del isotipo) → pestañas Datos · Experiencia ·
 * Educación · Documentos · Cuenta → barra fija «Guardar cambios».
 *
 * La lógica es la de siempre, sin tocar: las mismas llamadas (GET/PUT
 * /api/profile, /api/profile/experience, /api/profile/documents, /api/upload),
 * los mismos cuerpos, las mismas validaciones y el mismo <form> con su
 * handleSubmit. Las pestañas son presentación: los paneles ocultos siguen
 * montados (con `hidden`), así el formulario envía y valida exactamente lo que
 * enviaba y validaba antes. Los window.confirm de borrar pasan a un Modal de
 * confirmación que ejecuta la MISMA función.
 *
 * Aquí viven TODO el estado, las llamadas, las validaciones, el formulario de
 * datos y los modales. Las piezas sólo de presentación (resumen, indicador,
 * paneles de experiencia, educación, documentos y cuenta) están en
 * ./_componentes y reciben datos y acciones por props.
 */

import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { useRouter } from 'next/navigation';
import { AlertCircle, RefreshCw, Save, Trash2 } from 'lucide-react';

import { useLoadScript, Autocomplete } from '@react-google-maps/api';
import { useFalloMapa } from '@/hooks/useFalloMapa';
import { normalizeUrl } from '@/lib/utils';
import { notifyAuthChanged } from '@/lib/auth-events';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import Tabs, { PanelPestana } from '@/components/ui/Tabs';
import Button from '@/components/ui/Button';
import FormField, { Checkbox, Input, Select, Textarea } from '@/components/ui/FormField';
import Modal from '@/components/ui/Modal';
import Toast from '@/components/ui/Toast';
import { SkeletonPagina } from '@/components/ui/Skeleton';
// Piezas de presentación de esta página (sin lógica: reciben datos y acciones).
import IndicadorPerfil, { type PasoPerfil } from './_componentes/IndicadorPerfil';
import TarjetaIdentidad from './_componentes/TarjetaIdentidad';
import PanelExperiencia from './_componentes/PanelExperiencia';
import PanelEducacion from './_componentes/PanelEducacion';
import PanelDocumentos from './_componentes/PanelDocumentos';
import PanelCuenta from './_componentes/PanelCuenta';

/**
 * #PERF-018: la versión anterior (`startsWith('http') ? url : https://…`)
 * convertía las rutas locales que devuelve /api/upload en desarrollo
 * ('/uploads/cv.pdf') en 'https:///uploads/cv.pdf', un enlace roto.
 */
const ensureUrl = (url: string) => normalizeUrl(url) ?? url;

const MAPS_LIBRARIES: ('places')[] = ['places'];

/** Límite real de /api/upload (#PERF-028): Vercel corta los cuerpos > 4.5 MB. */
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const MAX_UPLOAD_LABEL = '4MB';

/** Rango de años admisible en educación (#PERF-030). */
const ANIO_MIN_EDUCACION = 1950;
const ANIO_MAX_EDUCACION = new Date().getFullYear() + 8;

/**
 * Estatus de educación (#PERF-012).
 *
 * El registro guarda Cursando/Terminado/Trunco/Titulado, pero este formulario
 * ofrecía Completa/En curso/Trunca: lo guardado desde el perfil salía siempre
 * gris en las vistas de reclutador, empresa y admin, y al editar una entrada
 * creada en el registro el <select> mostraba «Completa» aunque el estado
 * conservara «Titulado». Aquí se usa el vocabulario del registro; los valores
 * antiguos siguen siendo editables (se añaden como opción si aparecen) hasta
 * que se migren los datos.
 */
const ESTATUS_EDUCACION = ['Cursando', 'Terminado', 'Titulado', 'Trunco'];

/** Valores que significan «sin terminar»: no llevan año de fin. */
const ESTATUS_EN_CURSO = ['Cursando', 'En curso'];

/** Pestañas del perfil del candidato (presentación). */
type PestanaPerfil = 'datos' | 'experiencia' | 'educacion' | 'documentos' | 'cuenta';

/** A qué pestaña lleva cada pendiente del indicador de completitud. */
const PESTANA_DE_PASO: Record<string, PestanaPerfil> = {
  personales: 'datos',
  ubicacion: 'datos',
  profesional: 'datos',
  carta: 'datos',
  experiencia: 'experiencia',
  educacion: 'educacion',
  cv: 'documentos'
};

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

/** Confirmación de un borrado (antes, window.confirm). La acción es la de siempre. */
interface Confirmacion {
  titulo: string;
  descripcion: string;
  etiquetaAccion: string;
  accion: () => void | Promise<void>;
}

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // #PERF-009: los modales son overlays fixed z-50 y el único banner de error
  // se pinta al principio de la página, detrás del overlay. Con setError(...) el
  // botón «Guardar» parecía no hacer nada. Cada modal tiene ahora su propio
  // mensaje, renderizado dentro.
  const [expError, setExpError] = useState('');
  const [eduError, setEduError] = useState('');
  const [docError, setDocError] = useState('');

  // #PERF-010: refrescar la lista de experiencias no debe desmontar el
  // formulario (loading) ni pisar los campos aún sin guardar.
  const [refreshingExperiences, setRefreshingExperiences] = useState(false);

  // Presentación: pestaña visible y confirmación de borrado en curso.
  const [pestana, setPestana] = useState<PestanaPerfil>('datos');
  const [confirmacion, setConfirmacion] = useState<Confirmacion | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

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
  const [candidateLatitude, setCandidateLatitude] = useState<number | null>(null);
  const [candidateLongitude, setCandidateLongitude] = useState<number | null>(null);
  const [locationAutocomplete, setLocationAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);
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
    estatus: 'Terminado'
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

  // Google Maps para ubicación del candidato
  const { isLoaded: isMapsLoaded } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    libraries: MAPS_LIBRARIES,
  });
  // Con la clave rechazada por Google (facturación apagada, dominio no
  // permitido) el script carga, pero Google apaga el autocompletado y deja el
  // campo inservible: se cae al campo de texto simple, como mientras carga.
  // Aquí no hay mapa (sólo el buscador), así que la detección va sólo por
  // gm_authFailure; el rechazo se recuerda para la sesión (src/hooks/useFalloMapa).
  const sinMapa = useRef<HTMLDivElement>(null);
  const claveMapaRechazada = useFalloMapa(sinMapa, false);
  const buscadorListo = isMapsLoaded && !claveMapaRechazada;

  const onLocationAutocompleteLoad = useCallback((auto: google.maps.places.Autocomplete) => {
    setLocationAutocomplete(auto);
  }, []);

  const onLocationPlaceChanged = useCallback(() => {
    if (locationAutocomplete) {
      const place = locationAutocomplete.getPlace();
      if (place.formatted_address) {
        setUbicacionCercana(place.formatted_address);
      }
      if (place.geometry?.location) {
        setCandidateLatitude(place.geometry.location.lat());
        setCandidateLongitude(place.geometry.location.lng());
      }
    }
  }, [locationAutocomplete]);

  /**
   * Edición manual de «Ubicación cercana» (#PERF-033).
   *
   * Las coordenadas sólo se fijan desde onPlaceChanged. Al escribir a mano se
   * quedaban las anteriores: alguien que se mudaba de Monterrey a CDMX veía su
   * texto nuevo en la ficha mientras DistanceBadge seguía midiendo desde
   * Monterrey. Escribir a mano invalida las coordenadas.
   */
  const handleUbicacionManual = (valor: string) => {
    setUbicacionCercana(valor);
    setCandidateLatitude(null);
    setCandidateLongitude(null);
  };

  useEffect(() => {
    fetchProfile();
    fetchDocuments();
  }, []);

  // Pestañas y validación nativa del <form>: los paneles ocultos siguen
  // montados, así que un campo inválido de otra pestaña (una URL de LinkedIn
  // mal escrita, unos años fuera de rango) bloquea el envío igual que antes;
  // pero el navegador no puede señalar un campo oculto. Si el PRIMER campo
  // inválido está en una pestaña oculta, se abre esa pestaña y se vuelve a
  // pedir la validación para que el navegador lo señale. No cambia qué se
  // valida ni qué se envía.
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    let primeroVisto = false;
    const alCampoInvalido = (e: Event) => {
      if (primeroVisto) return;
      primeroVisto = true;
      requestAnimationFrame(() => {
        primeroVisto = false;
      });
      const panel = (e.target as HTMLElement).closest<HTMLElement>('[data-pestana]');
      if (!panel || !panel.hidden) return;
      flushSync(() => setPestana(panel.dataset.pestana as PestanaPerfil));
      setTimeout(() => form.reportValidity(), 0);
    };
    form.addEventListener('invalid', alCampoInvalido, true);
    return () => form.removeEventListener('invalid', alCampoInvalido, true);
  }, [loading, profile]);

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
          setCandidateLatitude(c.latitude || null);
          setCandidateLongitude(c.longitude || null);
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
      // #PERF-024: misma política que registro y reset-password. Antes aquí
      // sólo se exigía longitud y desde el perfil se podía bajar a 'aaaaaaaa'.
      if (newPassword.length < 8) {
        setError('La nueva contraseña debe tener al menos 8 caracteres');
        return;
      }
      if (!/[A-Z]/.test(newPassword)) {
        setError('La contraseña debe contener al menos una mayúscula');
        return;
      }
      if (!/[0-9]/.test(newPassword)) {
        setError('La contraseña debe contener al menos un número');
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
          latitude: candidateLatitude,
          longitude: candidateLongitude,
          // #PERF-008: la columna es Int NOT NULL. Mandar null al vaciar el
          // input hacía reventar prisma.candidate.update y TODO el guardado
          // respondía 500 sin decir por qué. Vacío = «no lo toques».
          añosExperiencia: añosExperiencia === '' ? undefined : añosExperiencia,
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
        // UI-004: nombre e iniciales del avatar (Navbar).
        notifyAuthChanged();
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
    setExpError(''); // #PERF-009: no arrastrar el error del intento anterior
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

  /**
   * Recarga SOLO las experiencias (#PERF-010).
   *
   * Antes se llamaba a fetchProfile(), que pone loading=true (desmonta el
   * formulario y pierde el scroll) y pisa TODOS los campos con lo que hay en
   * servidor: la maestría recién agregada en «Educación» y el teléfono
   * corregido desaparecían sin ningún aviso.
   */
  const refreshExperiences = async () => {
    try {
      setRefreshingExperiences(true);
      const response = await fetch('/api/profile/experience', { credentials: 'include' });
      const data = await response.json();
      if (data.success) {
        setExperiences(data.data || []);
        // El servidor recalcula los años con cada cambio de experiencia: sin
        // esto, «Guardar Cambios» reenviaba el valor viejo y pisaba el nuevo.
        if (typeof data.añosExperiencia === 'number') {
          setAñosExperiencia(data.añosExperiencia);
        }
      }
    } catch (err) {
      console.error('Error refrescando experiencias:', err);
    } finally {
      setRefreshingExperiences(false);
    }
  };

  const saveExperience = async () => {
    if (!expForm.empresa || !expForm.puesto || !expForm.fechaInicio) {
      setExpError('Empresa, puesto y fecha de inicio son requeridos');
      return;
    }

    // #PERF-021: una experiencia no actual sin fecha de fin se contaba «hasta
    // hoy» al recalcular los años de experiencia.
    if (!expForm.esActual && !expForm.fechaFin) {
      setExpError('Indica la fecha de fin o marca "Trabajo actual"');
      return;
    }

    // Validar que fechaFin no sea anterior a fechaInicio
    if (expForm.fechaFin && !expForm.esActual) {
      if (new Date(expForm.fechaFin) < new Date(expForm.fechaInicio)) {
        setExpError('La fecha de fin no puede ser anterior a la fecha de inicio');
        return;
      }
    }

    try {
      setSavingExp(true);
      setExpError('');

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
        setExpError('');
        setSuccess(editingExp ? 'Experiencia actualizada' : 'Experiencia agregada');
        await refreshExperiences();
      } else {
        setExpError(data.error || 'Error al guardar experiencia');
      }
    } catch (err) {
      setExpError('Error de conexión');
    } finally {
      setSavingExp(false);
    }
  };

  // La confirmación («¿Estás seguro de eliminar esta experiencia?») la pide
  // el Modal de confirmación antes de llamar aquí.
  const deleteExperience = async (expId: number) => {
    try {
      const response = await fetch(`/api/profile/experience/${expId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('Experiencia eliminada');
        await refreshExperiences();
      } else {
        setError(data.error || 'Error al eliminar');
      }
    } catch (err) {
      setError('Error de conexión');
    }
  };

  // Educación - CRUD (local, se guarda con el perfil)
  const openEduModal = (edu?: Education) => {
    setEduError(''); // #PERF-009
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
        estatus: 'Terminado'
      });
    }
    setShowEduModal(true);
  };

  const saveEducation = () => {
    if (!eduForm.nivel || !eduForm.institucion) {
      setEduError('Nivel de estudios e institución son requeridos');
      return;
    }

    // #PERF-030: los modales se renderizan FUERA del <form> y «Guardar» es
    // type=button, así que min/max de los inputs nunca se validaban: se podía
    // guardar «20222 - 2018».
    const inicio = eduForm.añoInicio === '' ? null : Number(eduForm.añoInicio);
    const fin = eduForm.añoFin === '' ? null : Number(eduForm.añoFin);

    if (inicio !== null && (!Number.isInteger(inicio) || inicio < ANIO_MIN_EDUCACION || inicio > ANIO_MAX_EDUCACION)) {
      setEduError(`El año de inicio debe estar entre ${ANIO_MIN_EDUCACION} y ${ANIO_MAX_EDUCACION}`);
      return;
    }

    if (fin !== null && (!Number.isInteger(fin) || fin < ANIO_MIN_EDUCACION || fin > ANIO_MAX_EDUCACION)) {
      setEduError(`El año de fin debe estar entre ${ANIO_MIN_EDUCACION} y ${ANIO_MAX_EDUCACION}`);
      return;
    }

    if (inicio !== null && fin !== null && fin < inicio) {
      setEduError('El año de fin no puede ser anterior al de inicio');
      return;
    }

    setEduError('');

    const newEdu: Education = {
      id: editingEdu ? editingEdu.id : Date.now(),
      nivel: eduForm.nivel,
      institucion: eduForm.institucion,
      carrera: eduForm.carrera,
      añoInicio: inicio,
      añoFin: fin,
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

  // Confirmación previa en el Modal (antes, window.confirm).
  const deleteEducation = (eduId: number) => {
    setEducacion(prev => prev.filter(e => e.id !== eduId));
    setSuccess('Educación eliminada. Guarda tu perfil para aplicar los cambios.');
  };

  // CV Upload
  const handleCvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tamaño (#PERF-028)
    if (file.size > MAX_UPLOAD_BYTES) {
      setError(`El archivo excede el tamaño máximo de ${MAX_UPLOAD_LABEL}`);
      return;
    }

    try {
      setUploadingCv(true);
      setError('');

      // Subir el archivo y guardar la URL en el perfil: el mismo patrón en dos
      // pasos que usa la foto.
      //
      // Antes esto mandaba un FormData a /api/profile/documents, que hace
      // `request.json()` y espera `{ name, fileUrl, fileType }`: la petición
      // reventaba siempre, así que subir el CV desde el perfil no funcionaba.
      const formData = new FormData();
      formData.append('file', file);

      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      const uploadData = await uploadRes.json().catch(() => ({}));

      if (!uploadRes.ok || !uploadData.success) {
        setError(uploadData.error || 'Error al subir CV');
        return;
      }

      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ candidateData: { cvUrl: uploadData.url } })
      });

      const data = await response.json();

      if (data.success) {
        setCvUrl(uploadData.url);
        setSuccess('CV subido exitosamente');
      } else {
        setError(data.error || 'Error al guardar el CV en tu perfil');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al subir archivo');
    } finally {
      setUploadingCv(false);
      if (cvInputRef.current) cvInputRef.current.value = '';
    }
  };

  // Confirmación previa en el Modal (antes, window.confirm).
  const deleteCv = async () => {
    try {
      // El CV vive en `Candidate.cvUrl`, no en la tabla de documentos: se quita
      // poniéndolo a null. Antes se llamaba a /api/profile/documents?type=cv,
      // que espera `?id=<docId>` y respondía 400 «ID requerido».
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ candidateData: { cvUrl: null } })
      });

      const data = await response.json();

      if (data.success) {
        setCvUrl(null);
        setSuccess('CV eliminado');
      } else {
        setError(data.error || 'Error al eliminar CV');
      }
    } catch {
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

      // #PERF-031: el error real del servidor («Archivo muy grande», «Tipo de
      // archivo no permitido», «Demasiadas solicitudes») se perdía y la UI
      // mostraba un genérico; el candidato reintentaba hasta acabar en 429.
      const uploadData = await uploadRes.json().catch(() => ({}));

      if (!uploadRes.ok || !uploadData.success) {
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
      setError(err instanceof Error ? err.message : 'Error al subir foto');
    } finally {
      setUploadingFoto(false);
      if (fotoInputRef.current) fotoInputRef.current.value = '';
    }
  };

  // Documentos adicionales - CRUD
  const handleAddDocument = async () => {
    if (!newDocName.trim()) {
      setDocError('El nombre del documento es requerido');
      return;
    }
    if (!newDocFile) {
      setDocError('Selecciona un archivo');
      return;
    }
    // #PERF-031: validar tamaño en cliente antes de gastar una subida.
    if (newDocFile.size > MAX_UPLOAD_BYTES) {
      setDocError(`El archivo excede el tamaño máximo de ${MAX_UPLOAD_LABEL}`);
      return;
    }

    try {
      setSavingDoc(true);
      setDocError('');

      // 1. Subir archivo
      const formData = new FormData();
      formData.append('file', newDocFile);

      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      // #PERF-031: conservar el mensaje real del servidor.
      const uploadData = await uploadResponse.json().catch(() => ({}));

      if (!uploadResponse.ok || !uploadData.success) {
        setDocError(uploadData.error || 'Error al subir archivo');
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
          // #PERF-032: con el subtipo MIME, un .docx guardaba
          // 'vnd.openxmlformats-officedocument.wordprocessingml.document' y la
          // ficha lo pintaba entero en mayúsculas.
          fileType: newDocFile.name.split('.').pop()?.toLowerCase() || 'file'
        })
      });

      const docData = await docResponse.json().catch(() => ({}));

      if (!docResponse.ok || !docData.success) {
        setDocError(docData.error || 'Error al guardar documento');
        return;
      }

      setShowAddDocModal(false);
      setNewDocName('');
      setNewDocFile(null);
      setDocError('');
      if (docInputRef.current) docInputRef.current.value = '';
      setSuccess('Documento agregado exitosamente');
      fetchDocuments();
    } catch (err) {
      setDocError(err instanceof Error ? err.message : 'Error de conexión');
    } finally {
      setSavingDoc(false);
    }
  };

  // Confirmación previa en el Modal (antes, window.confirm).
  const deleteDocument = async (docId: number) => {
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

  /** Cerrar el modal de documento (X, Cancelar, Escape): lo mismo que hacían los dos botones. */
  const cerrarModalDocumento = () => {
    setShowAddDocModal(false);
    setNewDocName('');
    setNewDocFile(null);
    setDocError('');
  };

  /** «Eliminar» del Modal de confirmación: ejecuta la acción de siempre y cierra. */
  const confirmarBorrado = async () => {
    if (!confirmacion) return;
    setConfirmando(true);
    try {
      await confirmacion.accion();
    } finally {
      setConfirmando(false);
      setConfirmacion(null);
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

  // #PERF-011: las fechas se guardan a medianoche UTC. Sin `timeZone: 'UTC'`,
  // en México (UTC-6) una experiencia iniciada el 01/03/2020 se mostraba como
  // «febrero de 2020», contradiciendo al propio formulario de edición.
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      timeZone: 'UTC'
    });
  };

  const calculateAge = (birthDate: string) => {
    const birth = new Date(birthDate);
    if (Number.isNaN(birth.getTime())) return null;
    const today = new Date();
    let age = today.getUTCFullYear() - birth.getUTCFullYear();
    const m = today.getUTCMonth() - birth.getUTCMonth();
    if (m < 0 || (m === 0 && today.getUTCDate() < birth.getUTCDate())) {
      age--;
    }
    return age;
  };

  // Avisos de la página (éxito y error) arriba y siempre a la vista: con las
  // pestañas y la barra fija, un banner al principio de la página quedaba
  // fuera de pantalla al guardar desde abajo. El error no se cierra solo.
  const aviso = (
    <Toast
      tono={error ? 'error' : 'exito'}
      mensaje={error || success || null}
      alCerrar={() => (error ? setError('') : setSuccess(''))}
      duracion={error ? 0 : 6000}
    />
  );

  if (loading) {
    return (
      <>
        {aviso}
        <SkeletonPagina conCifras={false} />
      </>
    );
  }

  if (!profile) {
    return (
      <>
        <PageHeader antetitulo="Cuenta" titulo="Mi perfil" />
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-xl border border-danger/30 bg-danger-tint px-4 py-4 text-sm text-danger-dark sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-2">
            <AlertCircle size={18} className="mt-0.5 flex-none" aria-hidden="true" />
            <div>
              <p className="font-display font-semibold">Error al cargar el perfil</p>
              {error && <p className="mt-0.5">{error}</p>}
            </div>
          </div>
          <Button
            variante="contorno"
            tamano="sm"
            icono={RefreshCw}
            onClick={() => {
              fetchProfile();
              fetchDocuments();
            }}
          >
            Reintentar
          </Button>
        </div>
      </>
    );
  }

  // ---------------------------------------------------------------------------
  // Presentación (derivada del estado; sin llamadas)
  // ---------------------------------------------------------------------------
  const esCandidato = Boolean(profile.candidate);
  const nombreVisible =
    candidateNombre && apellidoPaterno
      ? `${candidateNombre} ${apellidoPaterno} ${apellidoMaterno || ''}`.trim()
      : nombre || profile.email;
  const edad = fechaNacimiento ? calculateAge(fechaNacimiento) : null;

  // Completitud del perfil: sale de lo que hay en pantalla (incluidos los
  // cambios aún sin guardar), no de una llamada nueva.
  const pasosPerfil: PasoPerfil[] = [
    { id: 'foto', etiqueta: 'Foto de perfil', hecho: Boolean(fotoUrl) },
    {
      id: 'personales',
      etiqueta: 'Datos personales',
      hecho: Boolean(candidateNombre.trim() && apellidoPaterno.trim() && telefono.trim() && fechaNacimiento)
    },
    { id: 'ubicacion', etiqueta: 'Ubicación', hecho: Boolean((ciudad.trim() && estado.trim()) || ubicacionCercana.trim()) },
    { id: 'profesional', etiqueta: 'Perfil profesional', hecho: Boolean(profileField.trim() && seniority) },
    { id: 'carta', etiqueta: 'Carta de presentación', hecho: cartaPresentacion.trim().length > 0 },
    { id: 'experiencia', etiqueta: 'Experiencia laboral', hecho: experiences.length > 0 },
    { id: 'educacion', etiqueta: 'Educación', hecho: educacion.length > 0 },
    { id: 'cv', etiqueta: 'Currículum (CV)', hecho: Boolean(cvUrl) }
  ];

  /** Lleva a lo que falta: abre el selector de foto o la pestaña y su sección. */
  const irAPaso = (id: string) => {
    if (id === 'foto') {
      fotoInputRef.current?.click();
      return;
    }
    const destino = PESTANA_DE_PASO[id];
    if (!destino) return;
    setPestana(destino);
    requestAnimationFrame(() => {
      const seccion = document.getElementById(`perfil-${id}`);
      if (!seccion) return;
      seccion.scrollIntoView({ block: 'start' });
      const campo = seccion.querySelector<HTMLElement>('input:not([disabled]), select, textarea, button');
      campo?.focus({ preventScroll: true });
    });
  };

  const pestanas = [
    { id: 'datos', etiqueta: 'Datos' },
    { id: 'experiencia', etiqueta: 'Experiencia', contador: experiences.length },
    { id: 'educacion', etiqueta: 'Educación', contador: educacion.length },
    { id: 'documentos', etiqueta: 'Documentos', contador: documents.length + (cvUrl ? 1 : 0) },
    { id: 'cuenta', etiqueta: 'Cuenta' }
  ];

  /** Panel de una pestaña. Oculto con `hidden`, no desmontado (ver arriba). */
  const panel = (id: PestanaPerfil, contenido: ReactNode) =>
    esCandidato ? (
      <PanelPestana idBase="perfil" id={id} activa={pestana} mantenerMontado data-pestana={id} className="space-y-6 pt-0">
        {contenido}
      </PanelPestana>
    ) : (
      <div className="space-y-6">{contenido}</div>
    );

  // Resumen de la persona: foto (con su botón de subir), nombre, correo y rol.
  const identidad = (
    <TarjetaIdentidad
      nombre={nombreVisible}
      email={profile.email}
      rol={getRoleLabel(profile.role)}
      edad={edad}
      fotoUrl={fotoUrl}
      foto={
        profile.candidate
          ? { subiendo: uploadingFoto, inputRef: fotoInputRef, alCambiar: handleFotoUpload }
          : undefined
      }
      empresa={
        profile.role === 'company'
          ? { nombre: profile.company || 'No especificada', creditos: profile.credits || 0 }
          : undefined
      }
    />
  );

  // ---------------------------------------------------------------------------
  // Paneles
  // ---------------------------------------------------------------------------
  const panelDatos = (
    <>
      <Card id="perfil-personales" titulo="Información personal" className="scroll-mt-32">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField etiqueta="Nombre" requerido>
            <Input
              type="text"
              value={candidateNombre}
              onChange={(e) => setCandidateNombre(e.target.value)}
              required={false}
              autoComplete="given-name"
              placeholder="Juan"
            />
          </FormField>
          <FormField etiqueta="Apellido paterno" requerido>
            <Input
              type="text"
              value={apellidoPaterno}
              onChange={(e) => setApellidoPaterno(e.target.value)}
              required={false}
              autoComplete="family-name"
              placeholder="Pérez"
            />
          </FormField>
          <FormField etiqueta="Apellido materno">
            <Input
              type="text"
              value={apellidoMaterno}
              onChange={(e) => setApellidoMaterno(e.target.value)}
              placeholder="García"
            />
          </FormField>
          <FormField etiqueta="Fecha de nacimiento">
            <Input
              type="date"
              value={fechaNacimiento}
              onChange={(e) => setFechaNacimiento(e.target.value)}
              autoComplete="bday"
            />
          </FormField>
          <FormField etiqueta="Teléfono" ayuda="10 dígitos; puedes incluir la lada del país.">
            <Input
              type="tel"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              autoComplete="tel"
              placeholder="+52 555 123 4567"
            />
          </FormField>
          <FormField etiqueta="Sexo">
            <Select value={sexo} onChange={(e) => setSexo(e.target.value)}>
              <option value="">Seleccionar...</option>
              <option value="M">Masculino</option>
              <option value="F">Femenino</option>
              <option value="Otro">Otro</option>
            </Select>
          </FormField>
        </div>
      </Card>

      <Card
        id="perfil-ubicacion"
        titulo="Ubicación"
        descripcion="Sólo se usa para ofrecerte oportunidades cercanas a ti."
        className="scroll-mt-32"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField etiqueta="Ciudad">
            <Input
              type="text"
              value={ciudad}
              onChange={(e) => setCiudad(e.target.value)}
              autoComplete="address-level2"
              placeholder="Tu ciudad"
            />
          </FormField>
          <FormField etiqueta="Estado">
            <Input
              type="text"
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
              autoComplete="address-level1"
              placeholder="Tu estado"
            />
          </FormField>
          <FormField
            etiqueta="Ubicación cercana"
            className="sm:col-span-2"
            ayuda="Indica una ubicación cercana o de referencia (por ejemplo, tu colonia o zona). No es necesario que sea exacta. Esta información sólo se utiliza para ofrecerte oportunidades cercanas a ti."
          >
            {buscadorListo ? (
              <Autocomplete
                onLoad={onLocationAutocompleteLoad}
                onPlaceChanged={onLocationPlaceChanged}
                options={{
                  componentRestrictions: { country: 'mx' },
                  types: ['geocode', 'establishment']
                }}
              >
                <Input
                  type="text"
                  value={ubicacionCercana}
                  onChange={(e) => handleUbicacionManual(e.target.value)}
                  placeholder="Busca tu colonia o zona…"
                />
              </Autocomplete>
            ) : (
              // Un input nuevo (key propia): sin lo que el autocompletado de
              // Google le hubiera hecho al anterior (deshabilitarlo).
              <Input
                key="ubicacion-texto"
                type="text"
                value={ubicacionCercana}
                onChange={(e) => handleUbicacionManual(e.target.value)}
                placeholder="Colonia o zona"
              />
            )}
          </FormField>
        </div>
      </Card>

      <Card id="perfil-profesional" titulo="Datos profesionales" className="scroll-mt-32">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            etiqueta="Años de experiencia"
            ayuda="Se recalcula cuando agregas o editas tu experiencia laboral."
          >
            <Input
              type="number"
              min="0"
              max="50"
              inputMode="numeric"
              value={añosExperiencia}
              onChange={(e) => setAñosExperiencia(e.target.value === '' ? '' : parseInt(e.target.value))}
              className="tabular-nums"
              placeholder="Ej: 5"
            />
          </FormField>
          <FormField etiqueta="Perfil / Área">
            <Input
              type="text"
              value={profileField}
              onChange={(e) => setProfileField(e.target.value)}
              placeholder="Ej: Tecnología, Marketing"
            />
          </FormField>
          <FormField etiqueta="Seniority">
            <Select value={seniority} onChange={(e) => setSeniority(e.target.value)}>
              <option value="">Seleccionar...</option>
              <option value="Practicante">Practicante</option>
              <option value="Jr">Jr</option>
              <option value="Middle">Middle</option>
              <option value="Sr">Sr</option>
              <option value="Director">Director</option>
            </Select>
          </FormField>
          <FormField etiqueta="LinkedIn">
            <Input
              type="url"
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              autoComplete="url"
              placeholder="https://linkedin.com/in/..."
            />
          </FormField>
          <FormField etiqueta="Portafolio" className="sm:col-span-2">
            <Input
              type="url"
              value={portafolioUrl}
              onChange={(e) => setPortafolioUrl(e.target.value)}
              placeholder="https://miportfolio.com"
            />
          </FormField>
        </div>
      </Card>

      <Card
        id="perfil-carta"
        titulo="Carta de presentación"
        descripcion="Esta carta será visible para las empresas que revisen tu perfil."
        className="scroll-mt-32"
      >
        <FormField
          etiqueta="Tu presentación"
          ayuda={
            <span className="flex items-center justify-between gap-3">
              <span>Quién eres, tu experiencia clave y qué buscas. Hasta 1000 caracteres.</span>
              <span
                className={`flex-none tabular-nums ${cartaPresentacion.length >= 1000 ? 'font-semibold text-danger' : ''}`}
              >
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
            placeholder="Redacta una breve introducción que resuma quién eres profesionalmente, tu experiencia clave y el tipo de oportunidades que buscas."
            className="resize-y"
            rows={6}
          />
        </FormField>
      </Card>
    </>
  );

  const panelExperiencia = (
    <PanelExperiencia
      experiencias={experiences}
      actualizando={refreshingExperiences}
      formatearFecha={formatDate}
      alAgregar={() => openExpModal()}
      alEditar={(exp) => openExpModal(exp)}
      alEliminar={(exp) =>
        setConfirmacion({
          titulo: 'Eliminar experiencia',
          descripcion: `¿Estás seguro de eliminar esta experiencia? «${exp.puesto} en ${exp.empresa}» se borrará de tu perfil.`,
          etiquetaAccion: 'Eliminar experiencia',
          accion: () => deleteExperience(exp.id)
        })
      }
    />
  );

  const panelEducacion = (
    <PanelEducacion
      entradas={educacion}
      esEnCurso={(estatus) => ESTATUS_EN_CURSO.includes(estatus)}
      alAgregar={() => openEduModal()}
      alEditar={(edu) => openEduModal(edu)}
      alEliminar={(edu) =>
        setConfirmacion({
          titulo: 'Eliminar educación',
          descripcion:
            '¿Estás seguro de eliminar esta entrada de educación? Se quitará de tu perfil cuando guardes los cambios.',
          etiquetaAccion: 'Eliminar',
          accion: () => deleteEducation(edu.id)
        })
      }
    />
  );

  const panelDocumentos = (
    <PanelDocumentos
      hrefCv={cvUrl ? ensureUrl(cvUrl) : null}
      subiendoCv={uploadingCv}
      cvInputRef={cvInputRef}
      alCambiarCv={handleCvUpload}
      alEliminarCv={() =>
        setConfirmacion({
          titulo: 'Eliminar CV',
          descripcion: '¿Estás seguro de eliminar tu CV? Podrás subir otro cuando quieras.',
          etiquetaAccion: 'Eliminar CV',
          accion: () => deleteCv()
        })
      }
      documentos={documents}
      alAgregarDocumento={() => {
        setDocError(''); // #PERF-009
        setShowAddDocModal(true);
      }}
      alEliminarDocumento={(doc) =>
        setConfirmacion({
          titulo: 'Eliminar documento',
          descripcion: `¿Estás seguro de eliminar este documento? «${doc.name}» se borrará de tu perfil.`,
          etiquetaAccion: 'Eliminar documento',
          accion: () => deleteDocument(doc.id)
        })
      }
      limiteSubida={MAX_UPLOAD_LABEL}
    />
  );

  const panelCuenta = (
    <PanelCuenta
      nombre={{ valor: nombre, alCambiar: setNombre }}
      email={profile.email}
      contrasenaActual={{
        valor: currentPassword,
        alCambiar: setCurrentPassword,
        visible: showCurrentPassword,
        alternar: () => setShowCurrentPassword(!showCurrentPassword)
      }}
      contrasenaNueva={{
        valor: newPassword,
        alCambiar: setNewPassword,
        visible: showNewPassword,
        alternar: () => setShowNewPassword(!showNewPassword)
      }}
      confirmacion={{ valor: confirmPassword, alCambiar: setConfirmPassword }}
    />
  );

  return (
    <>
      {aviso}

      <PageHeader
        antetitulo="Cuenta"
        titulo="Mi perfil"
        descripcion={
          esCandidato
            ? 'Tus datos, tu experiencia y tus documentos: lo que ven las empresas cuando revisan tu perfil.'
            : 'Tu nombre de usuario y tu contraseña.'
        }
      />

      <div className={esCandidato ? 'xl:grid xl:grid-cols-[minmax(0,1fr)_19rem] xl:items-start xl:gap-8' : 'max-w-3xl'}>
        {/* Resumen: a la derecha desde xl; arriba en pantallas más estrechas. */}
        <aside
          aria-label="Resumen del perfil"
          className={
            esCandidato
              ? 'mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:col-start-2 xl:row-start-1 xl:mb-0 xl:grid-cols-1'
              : 'mb-6'
          }
        >
          {identidad}
          {esCandidato && (
            <Card titulo="Completa tu perfil">
              <IndicadorPerfil pasos={pasosPerfil} alIr={irAPaso} />
            </Card>
          )}
        </aside>

        <div className="min-w-0 xl:col-start-1 xl:row-start-1">
          {esCandidato && (
            <div className="sticky top-14 z-20 mb-6 bg-paper">
              <Tabs
                idBase="perfil"
                etiqueta="Secciones del perfil"
                pestanas={pestanas}
                activa={pestana}
                alCambiar={(id) => setPestana(id as PestanaPerfil)}
              />
            </div>
          )}

          <form ref={formRef} onSubmit={handleSubmit}>
            {esCandidato && (
              <>
                {panel('datos', panelDatos)}
                {panel('experiencia', panelExperiencia)}
                {panel('educacion', panelEducacion)}
                {panel('documentos', panelDocumentos)}
              </>
            )}
            {panel('cuenta', panelCuenta)}

            {/* Guardar: siempre a la vista, al pie de la ventana. Suelo papel
                OPACO y sombra hacia arriba: con papel translúcido el campo que
                pasa por debajo se leía a través de la barra, encimado con el
                texto de ayuda. */}
            <div className="sticky bottom-0 z-20 mt-6 border-t border-line bg-paper pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_16px_-12px_rgb(40_55_57/0.25)]">
              <div className="flex items-center justify-between gap-4">
                <p className="hidden text-[13px] text-ink-muted sm:block">
                  {esCandidato
                    ? 'Guarda tus datos, tu educación y tu contraseña. La experiencia y los documentos se guardan al momento.'
                    : 'Guarda tu nombre de usuario y tu contraseña.'}
                </p>
                <Button
                  type="submit"
                  cargando={saving}
                  textoCargando="Guardando..."
                  icono={Save}
                  className="w-full flex-none sm:w-auto"
                >
                  Guardar cambios
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Modal de Experiencia */}
      <Modal
        abierto={showExpModal}
        alCerrar={() => setShowExpModal(false)}
        titulo={editingExp ? 'Editar experiencia' : 'Nueva experiencia'}
        descripcion="Se guarda en tu perfil al pulsar «Guardar»."
        cerrarAlPulsarFondo={false}
        pie={
          <>
            <Button variante="contorno" onClick={() => setShowExpModal(false)}>
              Cancelar
            </Button>
            <Button onClick={saveExperience} cargando={savingExp} textoCargando="Guardando..." icono={Save}>
              Guardar
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {/* #PERF-009: el error se pinta DENTRO del modal; el banner de la
              página quedaba detrás del overlay. */}
          {expError && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger-tint px-3 py-2.5 text-sm font-medium text-danger-dark"
            >
              <AlertCircle size={16} className="mt-0.5 flex-none" aria-hidden="true" />
              {expError}
            </div>
          )}

          <FormField etiqueta="Empresa" requerido>
            <Input
              type="text"
              value={expForm.empresa}
              onChange={(e) => setExpForm({ ...expForm, empresa: e.target.value })}
              placeholder="Nombre de la empresa"
            />
          </FormField>

          <FormField etiqueta="Puesto" requerido>
            <Input
              type="text"
              value={expForm.puesto}
              onChange={(e) => setExpForm({ ...expForm, puesto: e.target.value })}
              placeholder="Título del puesto"
            />
          </FormField>

          <FormField etiqueta="Ubicación">
            <Input
              type="text"
              value={expForm.ubicacion}
              onChange={(e) => setExpForm({ ...expForm, ubicacion: e.target.value })}
              placeholder="Ciudad, País"
            />
          </FormField>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField etiqueta="Fecha de inicio" requerido>
              <Input
                type="date"
                value={expForm.fechaInicio}
                onChange={(e) => setExpForm({ ...expForm, fechaInicio: e.target.value })}
              />
            </FormField>

            <FormField etiqueta="Fecha de fin" ayuda={expForm.esActual ? 'Sin fecha de fin: es tu trabajo actual.' : undefined}>
              <Input
                type="date"
                value={expForm.fechaFin}
                onChange={(e) => setExpForm({ ...expForm, fechaFin: e.target.value })}
                disabled={expForm.esActual}
              />
            </FormField>
          </div>

          <Checkbox
            id="esActual"
            etiqueta="Trabajo actual"
            checked={expForm.esActual}
            onChange={(e) => setExpForm({ ...expForm, esActual: e.target.checked, fechaFin: '' })}
          />

          <FormField etiqueta="Descripción">
            <Textarea
              value={expForm.descripcion}
              onChange={(e) => setExpForm({ ...expForm, descripcion: e.target.value })}
              rows={3}
              placeholder="Describe tus responsabilidades y logros..."
            />
          </FormField>
        </div>
      </Modal>

      {/* Modal de Educación */}
      <Modal
        abierto={showEduModal}
        alCerrar={() => setShowEduModal(false)}
        titulo={editingEdu ? 'Editar educación' : 'Nueva educación'}
        descripcion="Se aplica a tu perfil al pulsar «Guardar cambios»."
        cerrarAlPulsarFondo={false}
        pie={
          <>
            <Button variante="contorno" onClick={() => setShowEduModal(false)}>
              Cancelar
            </Button>
            <Button onClick={saveEducation} icono={Save}>
              Guardar
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {/* #PERF-009 */}
          {eduError && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger-tint px-3 py-2.5 text-sm font-medium text-danger-dark"
            >
              <AlertCircle size={16} className="mt-0.5 flex-none" aria-hidden="true" />
              {eduError}
            </div>
          )}

          <FormField etiqueta="Nivel de estudios" requerido>
            <Select value={eduForm.nivel} onChange={(e) => setEduForm({ ...eduForm, nivel: e.target.value })}>
              <option value="">Seleccionar...</option>
              <option value="Preparatoria">Preparatoria</option>
              <option value="Técnico">Técnico</option>
              <option value="Licenciatura">Licenciatura</option>
              <option value="Posgrado">Posgrado</option>
              <option value="Diplomado">Diplomado</option>
              <option value="Certificación">Certificación</option>
              <option value="Otro">Otro</option>
            </Select>
          </FormField>

          <FormField etiqueta="Institución / Universidad" requerido>
            <Input
              type="text"
              value={eduForm.institucion}
              onChange={(e) => setEduForm({ ...eduForm, institucion: e.target.value })}
              placeholder="Nombre de la institución"
            />
          </FormField>

          <FormField etiqueta="Carrera / Programa">
            <Input
              type="text"
              value={eduForm.carrera}
              onChange={(e) => setEduForm({ ...eduForm, carrera: e.target.value })}
              placeholder="Ej: Ingeniería en Sistemas, MBA"
            />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField etiqueta="Año de inicio">
              <Input
                type="number"
                min="1950"
                max="2030"
                inputMode="numeric"
                value={eduForm.añoInicio}
                onChange={(e) => setEduForm({ ...eduForm, añoInicio: e.target.value })}
                className="tabular-nums"
                placeholder="Ej: 2018"
              />
            </FormField>

            <FormField etiqueta="Año de fin">
              <Input
                type="number"
                min="1950"
                max="2030"
                inputMode="numeric"
                value={eduForm.añoFin}
                onChange={(e) => setEduForm({ ...eduForm, añoFin: e.target.value })}
                className="tabular-nums"
                placeholder="Ej: 2022"
                disabled={ESTATUS_EN_CURSO.includes(eduForm.estatus)}
              />
            </FormField>
          </div>

          <FormField etiqueta="Estatus">
            <Select
              value={eduForm.estatus}
              onChange={(e) => setEduForm({
                ...eduForm,
                estatus: e.target.value,
                añoFin: ESTATUS_EN_CURSO.includes(e.target.value) ? '' : eduForm.añoFin
              })}
            >
              {ESTATUS_EDUCACION.map((estatus) => (
                <option key={estatus} value={estatus}>{estatus}</option>
              ))}
              {/* #PERF-012: valor heredado (Completa / En curso / Trunca).
                  Sin esta opción el <select> controlado mostraba otra cosa
                  distinta de lo que guardaba. */}
              {eduForm.estatus && !ESTATUS_EDUCACION.includes(eduForm.estatus) && (
                <option value={eduForm.estatus}>{eduForm.estatus}</option>
              )}
            </Select>
          </FormField>
        </div>
      </Modal>

      {/* Modal de Agregar Documento */}
      <Modal
        abierto={showAddDocModal}
        alCerrar={cerrarModalDocumento}
        titulo="Agregar documento"
        tamano="sm"
        cerrarAlPulsarFondo={false}
        pie={
          <>
            <Button variante="contorno" onClick={cerrarModalDocumento}>
              Cancelar
            </Button>
            <Button
              onClick={handleAddDocument}
              disabled={savingDoc || !newDocName.trim() || !newDocFile}
              cargando={savingDoc}
              textoCargando="Guardando..."
              icono={Save}
            >
              Guardar
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {/* #PERF-009 */}
          {docError && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger-tint px-3 py-2.5 text-sm font-medium text-danger-dark"
            >
              <AlertCircle size={16} className="mt-0.5 flex-none" aria-hidden="true" />
              {docError}
            </div>
          )}

          <FormField etiqueta="Nombre del documento" requerido>
            <Input
              type="text"
              placeholder="Ej: Título universitario, Certificación AWS"
              value={newDocName}
              onChange={(e) => setNewDocName(e.target.value)}
            />
          </FormField>

          <FormField etiqueta="Archivo" requerido ayuda={`PDF, DOC, DOCX, JPG, PNG (máx. ${MAX_UPLOAD_LABEL})`}>
            <Input
              type="file"
              ref={docInputRef}
              onChange={(e) => setNewDocFile(e.target.files?.[0] || null)}
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              className="h-auto cursor-pointer py-1.5 pl-1.5 text-ink-muted file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-ink file:px-3 file:py-1.5 file:font-display file:text-[13px] file:font-semibold file:text-white hover:file:bg-teal"
            />
          </FormField>

          {newDocFile && (
            <p className="rounded-lg bg-paper px-3 py-2 text-sm text-ink">
              Archivo seleccionado: <span className="font-medium">{newDocFile.name}</span>
            </p>
          )}
        </div>
      </Modal>

      {/* Confirmación de borrado (antes, window.confirm) */}
      <Modal
        abierto={confirmacion !== null}
        alCerrar={() => {
          if (!confirmando) setConfirmacion(null);
        }}
        titulo={confirmacion?.titulo ?? ''}
        descripcion={confirmacion?.descripcion}
        tamano="sm"
        pie={
          <>
            <Button variante="contorno" onClick={() => setConfirmacion(null)} disabled={confirmando}>
              Cancelar
            </Button>
            <Button variante="peligro" icono={Trash2} onClick={confirmarBorrado} cargando={confirmando}>
              {confirmacion?.etiquetaAccion ?? 'Eliminar'}
            </Button>
          </>
        }
      />
    </>
  );
}
