// RUTA: src/components/sections/companies/FormRegisterForQuotationSection.tsx
'use client';

// Registro de empresa (/companies#register), en el registro público «Arco».
//
// El FORMULARIO es el de siempre: mismo estado, mismas validaciones en línea,
// misma pre-validación (dryRun), mismas subidas a /api/upload y la misma alta
// en /api/company-requests; mismo modal de éxito con el mismo auto-login. Todo
// el bloque de lógica de abajo está intacto.
//
// Lo que cambia es la PRESENTACIÓN (docs/DISENO.md §6): cinco pasos con
// progreso, validación al intentar avanzar y un resumen antes de enviar. Los
// pasos son presentación: todos los campos siguen montados (los ocultos con
// `hidden`), así los <input type="file">, el mapa y el autocompletado conservan
// su estado al ir y volver.
//
// Validación por pasos = la de antes, repartida:
// - los errores en línea de handleInputChange (`errors`), como siempre;
// - las restricciones nativas que el navegador comprobaba al enviar (required,
//   type="email", minLength), leídas con checkValidity() del propio campo;
// - los documentos obligatorios, con los mismos mensajes que handleSubmit.
// Esos dos últimos van en un estado de PRESENTACIÓN aparte (`erroresPaso`): si
// fueran a `errors`, handleSubmit los vería y bloquearía el envío para siempre
// (handleInputChange no borra los errores de los campos que no valida).
// El formulario lleva noValidate: con campos ocultos, la validación nativa se
// quedaría muda («campo no enfocable»). Antes de llamar a handleSubmit se
// repasan TODOS los pasos, igual que hacía el navegador con `required`.

import React, { useState, useRef, useEffect, FormEvent, ChangeEvent, KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLoadScript, GoogleMap, Marker, Autocomplete } from '@react-google-maps/api';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  Circle,
  Clock,
  Mail,
  MapPin,
  Phone,
  Search,
  Send,
} from 'lucide-react';
import Toast from '@/components/ui/Toast';
import FormField, { Checkbox, Input } from '@/components/ui/FormField';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Stepper, { type PasoStepper } from '@/components/ui/Stepper';
import { Badge } from '@/components/ui/Badge';
import Skeleton from '@/components/ui/Skeleton';
import { CONTACTO } from '@/lib/nav-publica';
import { cn } from '@/lib/utils';
import CampoArchivo from '@/components/ui/CampoArchivo';
import Aviso from '@/components/ui/Aviso';
import { useFalloMapa } from '@/hooks/useFalloMapa';
import ResumenSolicitud, { type PasoEditable } from './ResumenSolicitud';

const libraries: ("places")[] = ["places"];
const mapContainerStyle = {
  width: '100%',
  height: '300px',
};
const defaultCenter = {
  lat: 19.4326, // CDMX por defecto
  lng: -99.1332
};

// Los mismos formatos de siempre para identificación y constancia fiscal.
const ACEPTA_DOCUMENTOS = '.pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx';

interface FormData {
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  departamento: string;
  identificacion: File | null;
  password: string;
  confirmPassword: string;
  nombreEmpresa: string;
  correoEmpresa: string;
  sitioWeb: string;
  razonSocial: string;
  rfc: string;
  calle: string;
  colonia: string;
  ciudad: string;
  codigoPostal: string;
  documentosConstitucion: File | null;
}

interface Errors {
  [key: string]: string;
}

/**
 * Compone el mensaje de error de la API.
 *
 * La API devuelve `errors: [{field, message}]`; mostrar sólo `data.error`
 * dejaba a la empresa con un «Datos inválidos» genérico sin saber qué campo
 * corregir, después de haber subido ya sus documentos.
 */
const mensajeDeError = (
  data: { error?: string; errors?: unknown },
  porDefecto: string
): string => {
  const detalle = Array.isArray(data?.errors)
    ? (data.errors as Array<{ field?: string; message?: string }>)
        .map((e) => (e?.field ? `${e.field}: ${e.message}` : e?.message))
        .filter(Boolean)
        .join(' · ')
    : '';
  return detalle || data?.error || porDefecto;
};

// ---------------------------------------------------------------------------
// Pasos (presentación)
// ---------------------------------------------------------------------------
type IdPaso = PasoEditable | 'revision';
type CampoDelFormulario = keyof FormData;

const PASOS: Array<PasoStepper & { id: IdPaso; titulo: string; remate: string }> = [
  { id: 'cuenta', etiqueta: 'Tu cuenta', descripcion: 'Quién la registra', titulo: 'Tu cuenta', remate: 'con ella entrarás a INAKAT' },
  { id: 'empresa', etiqueta: 'Tu empresa', descripcion: 'Nombre y datos fiscales', titulo: 'Tu empresa', remate: 'cómo te van a conocer' },
  { id: 'ubicacion', etiqueta: 'Ubicación', descripcion: 'Dirección y mapa', titulo: 'Ubicación', remate: 'dónde está tu empresa' },
  { id: 'documentos', etiqueta: 'Documentos', descripcion: 'Identificación y constancia', titulo: 'Documentos', remate: 'para validar tu empresa' },
  { id: 'revision', etiqueta: 'Revisión', descripcion: 'Confirma y envía', titulo: 'Revisa tu solicitud', remate: 'y envíala' },
];
const ULTIMO = PASOS.length - 1;

/** Campos de cada paso, en el orden en que se ven (el primero con error recibe el foco). */
const CAMPOS_POR_PASO: Record<IdPaso, CampoDelFormulario[]> = {
  cuenta: ['nombre', 'apellidoPaterno', 'apellidoMaterno', 'departamento', 'correoEmpresa', 'password', 'confirmPassword'],
  empresa: ['nombreEmpresa', 'sitioWeb', 'razonSocial', 'rfc'],
  ubicacion: ['calle', 'colonia', 'ciudad', 'codigoPostal'],
  documentos: ['identificacion', 'documentosConstitucion'],
  revision: [],
};

/** id del control de cada campo (lo reparte FormField). */
const idCampo = (campo: string) => `empresa-${campo}`;
const idTituloPaso = (paso: IdPaso) => `emp-titulo-paso-${paso}`;

/** Mensaje en español para lo que el navegador comprobaba al enviar. */
const mensajeNativo = (el: HTMLInputElement): string => {
  const v = el.validity;
  if (v.valueMissing) return 'Este campo es obligatorio.';
  if (v.typeMismatch) return 'Correo electrónico inválido';
  if (v.tooShort) return `Debe tener al menos ${el.minLength} caracteres`;
  return el.validationMessage || 'Revisa este campo.';
};

/** Campos del registro público: 48 px y 16 px (en iPhone, menos de 16 px hace zoom al enfocar). */
const CONTROL = 'h-12 text-base';

const FormRegisterForQuotationSection = () => {
  const router = useRouter();
  const [loginCredentials, setLoginCredentials] = useState<{email: string, password: string} | null>(null);
  const [formData, setFormData] = useState<FormData>({
    nombre: '',
    apellidoPaterno: '',
    apellidoMaterno: '',
    departamento: '',
    identificacion: null,
    password: '',
    confirmPassword: '',
    nombreEmpresa: '',
    correoEmpresa: '',
    sitioWeb: '',
    razonSocial: '',
    rfc: '',
    calle: '',
    colonia: '',
    ciudad: '',
    codigoPostal: '',
    documentosConstitucion: null
  });

  const [errors, setErrors] = useState<Errors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const fileInputIdRef = useRef<HTMLInputElement>(null);
  const fileInputDocRef = useRef<HTMLInputElement>(null);

  // URLs ya subidas a Blob en este intento. Se cachean para que un reintento
  // (correo duplicado, validación del servidor) no vuelva a publicar el INE y
  // la constancia fiscal ni gaste el límite de 15 uploads/hora por IP.
  const urlsSubidasRef = useRef<{
    identificacion: string | null;
    documentosConstitucion: string | null;
    logo: string | null;
  }>({ identificacion: null, documentosConstitucion: null, logo: null });

  // FEAT-1b: Estados para logo de empresa
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  // Estados para Google Maps
  const [mapCenter, setMapCenter] = useState(defaultCenter);
  const [markerPosition, setMarkerPosition] = useState(defaultCenter);
  // El mapa arranca centrado en CDMX: sin esta marca no hay forma de distinguir
  // «no eligió ubicación» de «su empresa está en el Zócalo».
  const [ubicacionElegida, setUbicacionElegida] = useState(false);
  const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    libraries,
  });

  // BUG-012 FIX: Scroll automático cuando se navega con anchor #formulario-registro
  useEffect(() => {
    if (window.location.hash === '#formulario-registro') {
      const element = document.getElementById('formulario-registro');
      if (element) {
        setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 300);
      }
    }
  }, []);

  // Validaciones mejoradas
  //
  // El patrón anterior (`/^[A-Za-zÁáÉéÍíÓóÚúÑñ\s]+$/`) rechazaba diéresis
  // («Argüelles»), apóstrofos («D'Angelo»), guiones («María-José») y puntos
  // («Ma. Fernanda»), y el error bloqueaba el envío: gente con nombre real no
  // podía registrarse. Mismo patrón que el servidor (NOMBRE_PERSONA_REGEX).
  const validateName = (value: string) =>
    /^[\p{L}\p{M}'’.\- ]+$/u.test(value);

  const validateEmail = (email: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const validateURL = (url: string) => {
    if (!url) return true;
    const urlPattern =
      /^(https?:\/\/)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/;
    return urlPattern.test(url);
  };

  const validateRFC = (rfc: string) => {
    if (!rfc) return false;
    const rfcPattern = /^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$/;
    return rfcPattern.test(rfc.toUpperCase());
  };

  // Funciones para Google Maps
  const onAutocompleteLoad = (auto: google.maps.places.Autocomplete) => {
    setAutocomplete(auto);
  };

  const onPlaceChanged = () => {
    if (autocomplete) {
      const place = autocomplete.getPlace();

      if (place.geometry?.location) {
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();

        setMapCenter({ lat, lng });
        setMarkerPosition({ lat, lng });
        setUbicacionElegida(true);

        // Extraer componentes de la dirección
        const addressComponents = place.address_components || [];

        let calle = '';
        let colonia = '';
        let ciudad = '';
        let codigoPostal = '';

        addressComponents.forEach((component) => {
          const types = component.types;

          if (types.includes('street_number')) {
            calle = component.long_name + ' ' + calle;
          }
          if (types.includes('route')) {
            calle = calle + component.long_name;
          }
          if (types.includes('sublocality_level_1') || types.includes('neighborhood')) {
            colonia = component.long_name;
          }
          if (types.includes('locality')) {
            ciudad = component.long_name;
          }
          if (types.includes('postal_code')) {
            codigoPostal = component.long_name;
          }
        });

        // Actualizar el formulario
        setFormData(prev => ({
          ...prev,
          calle: calle.trim() || prev.calle,
          colonia: colonia || prev.colonia,
          ciudad: ciudad || prev.ciudad,
          codigoPostal: codigoPostal || prev.codigoPostal,
        }));
      }
    }
  };

  const onMapClick = (e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      setMarkerPosition({ lat, lng });
      setUbicacionElegida(true);

      // Reverse geocoding para obtener la dirección
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        if (status === 'OK' && results?.[0]) {
          const addressComponents = results[0].address_components || [];

          let calle = '';
          let colonia = '';
          let ciudad = '';
          let codigoPostal = '';

          addressComponents.forEach((component) => {
            const types = component.types;

            if (types.includes('street_number')) {
              calle = component.long_name + ' ' + calle;
            }
            if (types.includes('route')) {
              calle = calle + component.long_name;
            }
            if (types.includes('sublocality_level_1') || types.includes('neighborhood')) {
              colonia = component.long_name;
            }
            if (types.includes('locality')) {
              ciudad = component.long_name;
            }
            if (types.includes('postal_code')) {
              codigoPostal = component.long_name;
            }
          });

          setFormData(prev => ({
            ...prev,
            calle: calle.trim() || prev.calle,
            colonia: colonia || prev.colonia,
            ciudad: ciudad || prev.ciudad,
            codigoPostal: codigoPostal || prev.codigoPostal,
          }));
        }
      });
    }
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    const newErrors = { ...errors };

    switch (name) {
      case 'nombre':
      case 'apellidoPaterno':
        if (!validateName(value)) {
          newErrors[name] = 'Nombre inválido';
        } else {
          delete newErrors[name];
        }
        break;

      // El apellido materno es OPCIONAL (igual que en el registro de
      // candidatos): un representante con un solo apellido no podía registrarse.
      case 'apellidoMaterno':
        if (value && !validateName(value)) {
          newErrors.apellidoMaterno = 'Apellido inválido';
        } else {
          delete newErrors.apellidoMaterno;
        }
        break;

      case 'correoEmpresa':
        if (!validateEmail(value)) {
          newErrors.correoEmpresa = 'Correo electrónico inválido';
        } else {
          delete newErrors.correoEmpresa;
        }
        break;

      case 'sitioWeb':
        if (value && !validateURL(value)) {
          newErrors.sitioWeb = 'URL inválida';
        } else {
          delete newErrors.sitioWeb;
        }
        break;

      case 'rfc':
        if (!validateRFC(value.toUpperCase())) {
          newErrors.rfc = 'RFC inválido';
        } else {
          delete newErrors.rfc;
        }
        break;

      case 'password':
        // Validar fortaleza de contraseña
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
        if (formData.confirmPassword && value !== formData.confirmPassword) {
          newErrors.confirmPassword = 'Las contraseñas no coinciden';
        } else if (formData.confirmPassword && value === formData.confirmPassword) {
          delete newErrors.confirmPassword;
        }
        break;

      case 'confirmPassword':
        if (value !== formData.password) {
          newErrors.confirmPassword = 'Las contraseñas no coinciden';
        } else {
          delete newErrors.confirmPassword;
        }
        break;
    }

    setErrors(newErrors);
  };

  const handleFileChange = (
    e: ChangeEvent<HTMLInputElement>,
    fileType: 'identificacion' | 'documentosConstitucion'
  ) => {
    const file = e.target.files?.[0] || null;
    setFormData((prev) => ({ ...prev, [fileType]: file }));
    // El archivo cambió: la URL cacheada de un intento anterior ya no es la de
    // este documento. Sin esto el reintento reutilizaba el archivo VIEJO y la
    // solicitud se guardaba con el documento equivocado.
    urlsSubidasRef.current[fileType] = null;

    if (file) {
      const newErrors = { ...errors };
      delete newErrors[fileType];
      setErrors(newErrors);
    }
  };

  const handleFileRemove = (fileType: 'identificacion' | 'documentosConstitucion') => {
    setFormData((prev) => ({ ...prev, [fileType]: null }));
    urlsSubidasRef.current[fileType] = null;

    // Reset the file input so the same file can be selected again
    if (fileType === 'identificacion' && fileInputIdRef.current) {
      fileInputIdRef.current.value = '';
    } else if (fileType === 'documentosConstitucion' && fileInputDocRef.current) {
      fileInputDocRef.current.value = '';
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const newErrors = { ...errors };
    let hasErrors = false;

    if (!formData.identificacion) {
      newErrors.identificacion = 'La identificación es requerida';
      hasErrors = true;
    }

    if (!formData.documentosConstitucion) {
      newErrors.documentosConstitucion = 'Los documentos son requeridos';
      hasErrors = true;
    }

    if (hasErrors || Object.keys(errors).length > 0) {
      setErrors(newErrors);
      setSubmitStatus({
        type: 'error',
        message: 'Por favor corrige los errores en el formulario'
      });
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus({ type: null, message: '' });

    try {
      // Verificación de seguridad para TypeScript (ya validado arriba)
      if (!formData.identificacion || !formData.documentosConstitucion) {
        throw new Error('Archivos requeridos no encontrados');
      }

      // Validar tamaño de archivos (máximo 4MB, PERF-028: /api/upload y Vercel cortan antes)
      const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4MB
      if (formData.identificacion.size > MAX_FILE_SIZE) {
        throw new Error('El archivo de identificación excede el tamaño máximo de 4MB');
      }
      if (formData.documentosConstitucion.size > MAX_FILE_SIZE) {
        throw new Error('Los documentos de constitución exceden el tamaño máximo de 4MB');
      }

      // Concatenar dirección para enviar al backend
      const direccionCompleta = `${formData.calle}, ${formData.colonia}, ${formData.ciudad}, CP ${formData.codigoPostal}`;

      // Payload común de la pre-validación y del alta real.
      const datosSolicitud = {
        nombre: formData.nombre,
        apellidoPaterno: formData.apellidoPaterno,
        apellidoMaterno: formData.apellidoMaterno || null,
        departamento: formData.departamento || null,
        nombreEmpresa: formData.nombreEmpresa,
        correoEmpresa: formData.correoEmpresa,
        sitioWeb: formData.sitioWeb || null,
        razonSocial: formData.razonSocial,
        rfc: formData.rfc.toUpperCase(),
        direccionEmpresa: direccionCompleta,
        // La ubicación del mapa sólo se manda si el usuario la eligió: si no,
        // se estaría guardando el centro por defecto (CDMX) como si fuera el
        // domicilio real de la empresa.
        latitud: ubicacionElegida ? markerPosition.lat : null,
        longitud: ubicacionElegida ? markerPosition.lng : null,
        password: formData.password
      };

      // INTEGRIDAD: PRE-VALIDAR antes de subir nada.
      //
      // Antes se subían identificación y constancia fiscal a Blob (acceso
      // público, URL permanente) y sólo después se llamaba al alta: si ésta
      // fallaba (correo duplicado, zod, 500), esos documentos con PII quedaban
      // publicados sin ninguna fila que los referenciara ni forma de borrarlos,
      // y cada reintento los volvía a subir hasta agotar el límite de 15
      // uploads/hora.
      const preValidacion = await fetch('/api/company-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...datosSolicitud,
          // URLs de relleno: en dryRun no se guarda nada, sólo se valida.
          identificacionUrl: null,
          documentosConstitucionUrl: null,
          dryRun: true
        })
      });

      const preData = await preValidacion.json().catch(() => ({}));
      if (!preValidacion.ok || !preData.success) {
        throw new Error(mensajeDeError(preData, 'No se pudo validar la solicitud'));
      }

      // Los documentos ya subidos se reutilizan en los reintentos: sin esto,
      // cada intento dejaba una copia más del INE y la constancia en Blob.
      if (!urlsSubidasRef.current.identificacion) {
        const idFormData = new FormData();
        idFormData.append('file', formData.identificacion);

        const idUploadRes = await fetch('/api/upload', {
          method: 'POST',
          body: idFormData
        });

        if (!idUploadRes.ok) {
          const idErrorData = await idUploadRes.json().catch(() => ({}));
          throw new Error(idErrorData.error || 'Error al subir identificación. Verifica el formato y tamaño del archivo.');
        }
        const idData = await idUploadRes.json();
        urlsSubidasRef.current.identificacion = idData.url;
      }

      if (!urlsSubidasRef.current.documentosConstitucion) {
        const docFormData = new FormData();
        docFormData.append('file', formData.documentosConstitucion);

        const docUploadRes = await fetch('/api/upload', {
          method: 'POST',
          body: docFormData
        });

        if (!docUploadRes.ok) {
          const docErrorData = await docUploadRes.json().catch(() => ({}));
          throw new Error(docErrorData.error || 'Error al subir documentos. Verifica el formato y tamaño del archivo.');
        }
        const docData = await docUploadRes.json();
        urlsSubidasRef.current.documentosConstitucion = docData.url;
      }

      // FEAT-1b: Subir logo si existe
      if (logoFile && !urlsSubidasRef.current.logo) {
        const logoFormData = new FormData();
        logoFormData.append('file', logoFile);
        const logoRes = await fetch('/api/upload', { method: 'POST', body: logoFormData });
        if (logoRes.ok) {
          const logoData = await logoRes.json();
          if (logoData.url) {
            urlsSubidasRef.current.logo = logoData.url;
          }
        }
      }

      const response = await fetch('/api/company-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...datosSolicitud,
          identificacionUrl: urlsSubidasRef.current.identificacion,
          documentosConstitucionUrl: urlsSubidasRef.current.documentosConstitucion,
          logoUrl: urlsSubidasRef.current.logo // FEAT-1b: Logo de empresa
        })
      });

      const data = await response.json();

      if (data.success) {
        // Guardar credenciales para auto-login
        setLoginCredentials({ email: formData.correoEmpresa, password: formData.password });
        // Limpiar el formulario
        setFormData({
          nombre: '',
          apellidoPaterno: '',
          apellidoMaterno: '',
          departamento: '',
          identificacion: null,
          password: '',
          confirmPassword: '',
          nombreEmpresa: '',
          correoEmpresa: '',
          sitioWeb: '',
          razonSocial: '',
          rfc: '',
          calle: '',
          colonia: '',
          ciudad: '',
          codigoPostal: '',
          documentosConstitucion: null
        });
        setErrors({});
        setSubmitStatus({ type: null, message: '' });
        // FEAT-1b: Limpiar logo
        setLogoFile(null);
        setLogoPreview(null);
        setUbicacionElegida(false);
        urlsSubidasRef.current = {
          identificacion: null,
          documentosConstitucion: null,
          logo: null
        };

        // Mostrar modal de éxito
        setShowSuccessModal(true);
      } else {
        throw new Error(mensajeDeError(data, 'Error al enviar solicitud'));
      }
    } catch (error) {
      setSubmitStatus({
        type: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Error al procesar la solicitud'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Auto-login del modal de éxito (el mismo de siempre, sólo con nombre).
  const irAPlataforma = async () => {
    if (!loginCredentials) {
      router.push('/login');
      return;
    }
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: loginCredentials.email,
          password: loginCredentials.password
        })
      });
      if (res.ok) {
        router.push('/company/dashboard');
      } else {
        router.push('/login');
      }
    } catch {
      router.push('/login');
    }
  };

  // =========================================================================
  // PRESENTACIÓN: pasos, errores al intentar avanzar y foco
  // =========================================================================
  const [paso, setPaso] = useState(0);
  // El paso más lejano al que se llegó validando: el Stepper deja volver a él
  // de un salto (p. ej. de «Revisión» → «Editar» → otra vez «Revisión»).
  const [pasoMaximo, setPasoMaximo] = useState(0);
  // Errores que antes pintaba el navegador (obligatorio, formato de correo) y
  // los de documentos. No gobiernan el envío: sólo se muestran.
  const [erroresPaso, setErroresPaso] = useState<Errors>({});
  const [avisoPaso, setAvisoPaso] = useState<{ paso: number; total: number } | null>(null);
  const [verContrasenas, setVerContrasenas] = useState(false);
  // Antes era un alert() del navegador; el flujo es el mismo (no se guarda el logo).
  const [errorLogo, setErrorLogo] = useState<string | null>(null);
  // El mapa se monta la primera vez que se VE su paso (inicializarlo oculto lo
  // dejaría sin tamaño) y después se queda montado.
  const [mapaVisto, setMapaVisto] = useState(false);
  // ¿Google rechazó la clave? (facturación apagada, dominio no permitido: el
  // script carga, pero tapa el mapa con su diálogo en inglés y apaga el
  // buscador). Entonces no se pintan ni el buscador ni el mapa, que son
  // opcionales: la dirección se escribe a mano en los campos de siempre.
  const contenedorMapaRef = useRef<HTMLDivElement>(null);
  const claveMapaRechazada = useFalloMapa(contenedorMapaRef, isLoaded && !loadError && mapaVisto);
  const mapaNoDisponible = Boolean(loadError) || claveMapaRechazada;
  const [entrando, setEntrando] = useState(false);
  const [foco, setFoco] = useState<{ id: string; desplazar: boolean; n: number } | null>(null);
  const tarjetaRef = useRef<HTMLDivElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const idPaso = PASOS[paso].id;

  // Mueve el foco DESPUÉS de pintar el paso nuevo (o los errores nuevos).
  useEffect(() => {
    if (!foco) return;
    const tarjeta = tarjetaRef.current;
    if (foco.desplazar && tarjeta && tarjeta.getBoundingClientRect().top < 0) {
      const calma = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      tarjeta.scrollIntoView({ block: 'start', behavior: calma ? 'auto' : 'smooth' });
    }
    document.getElementById(foco.id)?.focus({ preventScroll: foco.desplazar });
  }, [foco]);

  // Tras enviar con éxito el formulario ya quedó vacío: vuelve al primer paso.
  useEffect(() => {
    if (!showSuccessModal) return;
    setPaso(0);
    setPasoMaximo(0);
    setErroresPaso({});
    setAvisoPaso(null);
    setVerContrasenas(false);
    setErrorLogo(null);
  }, [showSuccessModal]);

  const irAPaso = (indice: number) => {
    setPaso(indice);
    setPasoMaximo((m) => Math.max(m, indice));
    setAvisoPaso(null);
    if (PASOS[indice].id === 'ubicacion') setMapaVisto(true);
    // El lector anuncia el paso nuevo: el foco va a su título.
    setFoco({ id: idTituloPaso(PASOS[indice].id), desplazar: true, n: Date.now() });
  };

  /** Lo que falta o sobra en un paso, con la validación de siempre. */
  const erroresDelPaso = (indice: number): Errors => {
    const encontrados: Errors = {};
    for (const campo of CAMPOS_POR_PASO[PASOS[indice].id]) {
      // 1. Los errores en línea de handleInputChange.
      if (errors[campo]) {
        encontrados[campo] = errors[campo];
        continue;
      }
      // 2. Los documentos obligatorios: los mismos mensajes que handleSubmit.
      if (campo === 'identificacion' || campo === 'documentosConstitucion') {
        if (!formData[campo]) {
          encontrados[campo] =
            campo === 'identificacion' ? 'La identificación es requerida' : 'Los documentos son requeridos';
        }
        continue;
      }
      // 3. Lo que comprobaba el navegador al enviar (required, type, minLength).
      const control = document.getElementById(idCampo(campo));
      if (control instanceof HTMLInputElement && !control.checkValidity()) {
        encontrados[campo] = mensajeNativo(control);
      }
    }
    return encontrados;
  };

  /** Pinta los errores de un paso y lleva el foco al primero. */
  const mostrarErrores = (indice: number, encontrados: Errors) => {
    const claves = Object.keys(encontrados);
    setErroresPaso((prev) => {
      const siguiente = { ...prev };
      claves.forEach((c) => {
        // Los de `errors` ya se pintan solos; aquí sólo los demás.
        if (!errors[c]) siguiente[c] = encontrados[c];
      });
      return siguiente;
    });
    setAvisoPaso({ paso: indice, total: claves.length });
    if (indice !== paso) {
      setPaso(indice);
      if (PASOS[indice].id === 'ubicacion') setMapaVisto(true);
    }
    setFoco({ id: idCampo(claves[0]), desplazar: false, n: Date.now() });
  };

  const avanzar = () => {
    const encontrados = erroresDelPaso(paso);
    if (Object.keys(encontrados).length > 0) {
      mostrarErrores(paso, encontrados);
      return;
    }
    irAPaso(paso + 1);
  };

  /**
   * Desde el Stepper. Hacia atrás, sin más (como siempre). Hacia adelante
   * (hasta el paso más lejano ya alcanzado), repasando cada paso que se salta
   * igual que «Continuar»: el primero con errores se muestra y ahí se queda.
   */
  const saltarAPaso = (indice: number) => {
    if (indice <= paso) {
      irAPaso(indice);
      return;
    }
    for (let i = paso; i < indice; i++) {
      const encontrados = erroresDelPaso(i);
      if (Object.keys(encontrados).length > 0) {
        mostrarErrores(i, encontrados);
        return;
      }
    }
    irAPaso(indice);
  };

  // Intro en cualquier campo avanza de paso (el botón «Continuar» es el submit
  // del formulario). En el último paso, antes de handleSubmit se repasan todos
  // los pasos, como hacía la validación nativa del navegador.
  const alEnviar = (e: FormEvent<HTMLFormElement>) => {
    if (paso < ULTIMO) {
      e.preventDefault();
      avanzar();
      return;
    }
    for (let i = 0; i < ULTIMO; i++) {
      const encontrados = erroresDelPaso(i);
      if (Object.keys(encontrados).length > 0) {
        e.preventDefault();
        mostrarErrores(i, encontrados);
        return;
      }
    }
    handleSubmit(e);
  };

  const quitarErrorPaso = (campo: string) => {
    setErroresPaso((prev) => {
      if (!(campo in prev)) return prev;
      const siguiente = { ...prev };
      delete siguiente[campo];
      return siguiente;
    });
  };

  // handleInputChange de siempre + quitar el aviso de «obligatorio» del campo.
  const alCambiarCampo = (e: ChangeEvent<HTMLInputElement>) => {
    handleInputChange(e);
    quitarErrorPaso(e.target.name);
  };

  // En el buscador de direcciones, Intro elige la sugerencia de Google: no
  // debe además enviar el formulario (avanzaría de paso a medio elegir).
  const evitarEnvioConIntro = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') e.preventDefault();
  };

  const errorDe = (campo: string) => errors[campo] || erroresPaso[campo] || undefined;

  const erroresVisibles = CAMPOS_POR_PASO[idPaso].filter((c) => errorDe(c)).length;
  const mostrarAviso = avisoPaso !== null && avisoPaso.paso === paso && erroresVisibles > 0;

  const reglasContrasena = [
    { ok: formData.password.length >= 8, texto: '8 caracteres o más' },
    { ok: /[A-Z]/.test(formData.password), texto: 'una mayúscula' },
    { ok: /[0-9]/.test(formData.password), texto: 'un número' },
  ];

  /**
   * Título de cada paso: estructura + remate serif (la voz humana).
   * El espacio va DENTRO del mismo nodo de texto que el título: suelto
   * (`{p.titulo}{' '}`) React lo deja en un nodo aparte, sólo de espacio, que el
   * árbol de accesibilidad de Chrome descarta, y el lector decía «Tu
   * cuentacon ella entrarás a INAKAT». El aria-label lo deja atado del todo.
   */
  const tituloDePaso = (i: number) => {
    const p = PASOS[i];
    return (
      <div className="mb-6">
        <h3
          id={idTituloPaso(p.id)}
          tabIndex={-1}
          aria-label={`${p.titulo} ${p.remate}`}
          className="font-display text-[1.65rem] font-bold leading-tight tracking-tight text-ink outline-none sm:text-3xl"
        >
          {`${p.titulo} `}
          <em className="font-serif font-normal italic tracking-normal text-teal">{p.remate}</em>
        </h3>
      </div>
    );
  };

  return (
    <>
    <Toast
      tono="error"
      mensaje={submitStatus.type === 'error' ? submitStatus.message : null}
      alCerrar={() => setSubmitStatus({ type: null, message: '' })}
    />
    <section
      id="register"
      className="hm-suelo--tinta emp-registro"
      aria-labelledby="emp-registro-titulo"
      suppressHydrationWarning
    >
      <div className="emp-registro__arcos" aria-hidden="true">
        <span className="emp-registro__arco" />
        <span className="emp-registro__arco emp-registro__arco--b" />
      </div>

      <div className="hm-wrap emp-registro__rejilla">
        {/* Columna: qué es, qué se necesita y a quién preguntar */}
        <div className="emp-registro__lado">
          <p className="hm-eyebrow">Registro de empresa</p>
          <h2 id="emp-registro-titulo" className="hm-h2 emp-registro__titulo mt-5" aria-label="Registra tu empresa.">
            <span className="hm-mask" aria-hidden="true">
              <span>Registra</span>
            </span>{' '}
            <span className="hm-mask" aria-hidden="true">
              <span>
                tu <em>empresa.</em>
              </span>
            </span>
          </h2>
          <p className="hm-lead mt-6">
            Completa el formulario y nuestro equipo te contactará para iniciar
            el proceso.
          </p>
          <p className="emp-registro__voz">
            Únete hoy y descubre cómo podemos transformar tu equipo.
          </p>

          <div className="emp-registro__mano">
            <h3>Ten a la mano</h3>
            <ul>
              <li>Tu RFC y la razón social</li>
              <li>
                <span>
                  Tu identificación y la Constancia de Situación Fiscal
                  <small>PDF, imagen, Word o Excel · máx. 4 MB cada una</small>
                </span>
              </li>
              <li>
                <span>
                  El logo de tu empresa, si quieres
                  <small>PNG, JPG o WebP · máx. 2 MB</small>
                </span>
              </li>
            </ul>
          </div>

          <p className="emp-registro__contacto">
            ¿Dudas?{' '}
            <a href={`mailto:${CONTACTO.email}`}>
              <Mail aria-hidden="true" />
              {CONTACTO.email}
            </a>
            {' · '}
            <a href={CONTACTO.telefonoHref}>
              <Phone aria-hidden="true" />
              {CONTACTO.telefono}
            </a>
          </p>
        </div>

        {/* La tarjeta del formulario */}
        <div id="formulario-registro" ref={tarjetaRef} className="emp-form">
          <Stepper pasos={PASOS} actual={paso} alIrA={saltarAPaso} pasoMaximo={pasoMaximo} className="mb-8" />

          <form onSubmit={alEnviar} autoComplete="off" noValidate suppressHydrationWarning>
            {/* Honeypots ocultos: absorben el autofill agresivo de Chrome
                (recuerda credenciales de admin de sesiones anteriores). */}
            <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', top: 'auto', width: 1, height: 1, overflow: 'hidden' }}>
              <input type="text" name="username" tabIndex={-1} autoComplete="username" />
              <input type="password" name="password" tabIndex={-1} autoComplete="current-password" />
            </div>

            {/* ============ Paso 1 · Tu cuenta ============ */}
            <div hidden={idPaso !== 'cuenta'}>
              <div className="emp-panel">
                {tituloDePaso(0)}
                <div className="grid gap-5 sm:grid-cols-2">
                  <FormField etiqueta="Nombre" requerido id={idCampo('nombre')} error={errorDe('nombre')}>
                    <Input
                      type="text"
                      name="nombre"
                      value={formData.nombre}
                      onChange={alCambiarCampo}
                      className={CONTROL}
                      autoComplete="off"
                    />
                  </FormField>
                  <FormField etiqueta="Apellido paterno" requerido id={idCampo('apellidoPaterno')} error={errorDe('apellidoPaterno')}>
                    <Input
                      type="text"
                      name="apellidoPaterno"
                      value={formData.apellidoPaterno}
                      onChange={alCambiarCampo}
                      className={CONTROL}
                      autoComplete="off"
                    />
                  </FormField>
                  <FormField etiqueta="Apellido materno" opcional id={idCampo('apellidoMaterno')} error={errorDe('apellidoMaterno')}>
                    <Input
                      type="text"
                      name="apellidoMaterno"
                      value={formData.apellidoMaterno}
                      onChange={alCambiarCampo}
                      className={CONTROL}
                      autoComplete="off"
                    />
                  </FormField>
                  <FormField etiqueta="Departamento" opcional id={idCampo('departamento')} error={errorDe('departamento')}>
                    <>
                      {/* Hidden dummy input to absorb browser autofill */}
                      <input type="text" name="fakeField" style={{ display: 'none' }} tabIndex={-1} autoComplete="organization-title" />
                      <Input
                        type="text"
                        name="departamento"
                        autoComplete="one-time-code"
                        role="presentation"
                        value={formData.departamento}
                        onChange={alCambiarCampo}
                        placeholder="Ej.: Recursos Humanos"
                        className={CONTROL}
                      />
                    </>
                  </FormField>
                  <FormField
                    etiqueta="Correo electrónico"
                    requerido
                    id={idCampo('correoEmpresa')}
                    error={errorDe('correoEmpresa')}
                    ayuda="Será tu usuario para entrar a la plataforma."
                    className="sm:col-span-2"
                  >
                    <Input
                      type="email"
                      name="correoEmpresa"
                      value={formData.correoEmpresa}
                      onChange={alCambiarCampo}
                      placeholder="nombre@tuempresa.com"
                      className={CONTROL}
                      autoComplete="off"
                    />
                  </FormField>
                  <FormField
                    etiqueta="Genera tu contraseña"
                    requerido
                    id={idCampo('password')}
                    error={errorDe('password')}
                    ayuda={
                      <>
                        <span className="sr-only">Mínimo 8 caracteres, una mayúscula y un número.</span>
                        <span className="flex flex-wrap gap-x-4 gap-y-1" aria-hidden="true">
                          {reglasContrasena.map((r) => (
                            <span
                              key={r.texto}
                              className={cn('inline-flex items-center gap-1.5', r.ok ? 'font-medium text-lime-dark' : 'text-ink-muted')}
                            >
                              {r.ok ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <Circle className="h-3 w-3" />}
                              {r.texto}
                            </span>
                          ))}
                        </span>
                      </>
                    }
                  >
                    <Input
                      type={verContrasenas ? 'text' : 'password'}
                      name="password"
                      value={formData.password}
                      onChange={alCambiarCampo}
                      className={CONTROL}
                      autoComplete="new-password"
                      minLength={8}
                    />
                  </FormField>
                  <FormField etiqueta="Confirma tu contraseña" requerido id={idCampo('confirmPassword')} error={errorDe('confirmPassword')}>
                    <Input
                      type={verContrasenas ? 'text' : 'password'}
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={alCambiarCampo}
                      className={CONTROL}
                      autoComplete="new-password"
                    />
                  </FormField>
                  <Checkbox
                    className="sm:col-span-2"
                    etiqueta="Mostrar contraseñas"
                    checked={verContrasenas}
                    onChange={(e) => setVerContrasenas(e.target.checked)}
                  />
                </div>
              </div>
            </div>

            {/* ============ Paso 2 · Tu empresa ============ */}
            <div hidden={idPaso !== 'empresa'}>
              <div className="emp-panel">
                {tituloDePaso(1)}
                <div className="grid gap-5 sm:grid-cols-2">
                  {/* FEAT-1b: Logo de la empresa */}
                  <FormField
                    etiqueta="Logo de la empresa"
                    opcional
                    id="empresa-logo"
                    ayuda="PNG, JPG o WebP. Máx 2MB."
                    error={errorLogo}
                    className="sm:col-span-2"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-20 w-20 flex-none items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-line-strong bg-paper">
                        {logoPreview ? (
                          // Vista previa local (blob:), no pasa por next/image.
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={logoPreview} alt="Vista previa del logo" className="h-full w-full object-cover" />
                        ) : (
                          <Building2 className="h-8 w-8 text-ink-muted" aria-hidden="true" />
                        )}
                      </div>
                      <input
                        type="file"
                        ref={logoInputRef}
                        className="hidden"
                        tabIndex={-1}
                        accept="image/png,image/jpeg,image/webp"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            if (file.size > 2 * 1024 * 1024) {
                              setErrorLogo('El logo no debe pesar más de 2MB');
                              return;
                            }
                            setErrorLogo(null);
                            setLogoFile(file);
                            setLogoPreview(URL.createObjectURL(file));
                            // Logo nuevo: no reutilizar el subido en un intento anterior.
                            urlsSubidasRef.current.logo = null;
                          }
                        }}
                      />
                      {/* El FormField apunta su etiqueta a este botón (id) y
                          reparte los ids de su ayuda y su error. */}
                      <Button
                        variante="contorno"
                        id="empresa-logo"
                        aria-describedby={errorLogo ? 'empresa-logo-error empresa-logo-ayuda' : 'empresa-logo-ayuda'}
                        onClick={() => logoInputRef.current?.click()}
                      >
                        {logoFile ? 'Cambiar logo' : 'Subir logo'}
                      </Button>
                    </div>
                  </FormField>
                  <FormField etiqueta="Nombre comercial" requerido id={idCampo('nombreEmpresa')} error={errorDe('nombreEmpresa')}>
                    <Input
                      type="text"
                      name="nombreEmpresa"
                      value={formData.nombreEmpresa}
                      onChange={alCambiarCampo}
                      className={CONTROL}
                      autoComplete="off"
                    />
                  </FormField>
                  <FormField
                    etiqueta="Sitio web"
                    opcional
                    id={idCampo('sitioWeb')}
                    error={errorDe('sitioWeb')}
                  >
                    <Input
                      type="text"
                      name="sitioWeb"
                      value={formData.sitioWeb}
                      onChange={alCambiarCampo}
                      placeholder="www.tuempresa.com"
                      className={CONTROL}
                      autoComplete="off"
                    />
                  </FormField>
                  <FormField etiqueta="Razón social" requerido id={idCampo('razonSocial')} error={errorDe('razonSocial')}>
                    <Input
                      type="text"
                      name="razonSocial"
                      value={formData.razonSocial}
                      onChange={alCambiarCampo}
                      className={CONTROL}
                      autoComplete="off"
                    />
                  </FormField>
                  <FormField
                    etiqueta="RFC"
                    requerido
                    id={idCampo('rfc')}
                    error={errorDe('rfc')}
                    ayuda="12 caracteres si es persona moral, 13 si es persona física."
                  >
                    <Input
                      type="text"
                      name="rfc"
                      value={formData.rfc}
                      onChange={alCambiarCampo}
                      className={cn(CONTROL, 'font-display uppercase tracking-wide')}
                      autoComplete="off"
                      maxLength={13}
                    />
                  </FormField>
                </div>
              </div>
            </div>

            {/* ============ Paso 3 · Ubicación ============ */}
            <div hidden={idPaso !== 'ubicacion'}>
              <div className="emp-panel">
                {tituloDePaso(2)}

                {/* Buscador: rellena calle, colonia, ciudad y CP */}
                {mapaNoDisponible ? (
                  // No es un error de quien llena el formulario: aviso
                  // informativo, con el mismo tono que en /create-job.
                  <Aviso tono="info" compacto className="mb-5">
                    El buscador y el mapa no están disponibles en este momento. Escribe la dirección a mano: la
                    ubicación en el mapa es opcional.
                  </Aviso>
                ) : !isLoaded ? (
                  <div className="mb-5 grid gap-2" role="status">
                    <span className="sr-only">Cargando mapa...</span>
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-12 w-full rounded-lg" />
                  </div>
                ) : (
                  mapaVisto && (
                    <FormField
                      etiqueta="Busca tu dirección"
                      opcional
                      id="empresa-buscador"
                      ayuda="Elige una sugerencia y llenamos la dirección por ti."
                      className="mb-5"
                    >
                      <Autocomplete
                        onLoad={onAutocompleteLoad}
                        onPlaceChanged={onPlaceChanged}
                        options={{
                          componentRestrictions: { country: 'mx' },
                          types: ['geocode', 'establishment']
                        }}
                      >
                        <Input
                          type="text"
                          prefijo={<Search />}
                          placeholder="Calle, colonia o lugar"
                          onKeyDown={evitarEnvioConIntro}
                          className={CONTROL}
                        />
                      </Autocomplete>
                    </FormField>
                  )
                )}

                <div className="grid gap-5 sm:grid-cols-2">
                  <FormField etiqueta="Calle y número" requerido id={idCampo('calle')} error={errorDe('calle')} className="sm:col-span-2">
                    <Input
                      type="text"
                      name="calle"
                      value={formData.calle}
                      onChange={alCambiarCampo}
                      className={CONTROL}
                      autoComplete="off"
                    />
                  </FormField>
                  <FormField etiqueta="Colonia" requerido id={idCampo('colonia')} error={errorDe('colonia')}>
                    <Input
                      type="text"
                      name="colonia"
                      value={formData.colonia}
                      onChange={alCambiarCampo}
                      className={CONTROL}
                      autoComplete="off"
                    />
                  </FormField>
                  <FormField etiqueta="Ciudad" requerido id={idCampo('ciudad')} error={errorDe('ciudad')}>
                    <Input
                      type="text"
                      name="ciudad"
                      value={formData.ciudad}
                      onChange={alCambiarCampo}
                      className={CONTROL}
                      autoComplete="off"
                    />
                  </FormField>
                  <FormField etiqueta="Código postal" requerido id={idCampo('codigoPostal')} error={errorDe('codigoPostal')}>
                    <Input
                      type="text"
                      name="codigoPostal"
                      inputMode="numeric"
                      value={formData.codigoPostal}
                      onChange={alCambiarCampo}
                      className={cn(CONTROL, 'tabular-nums')}
                      autoComplete="off"
                      maxLength={5}
                    />
                  </FormField>
                </div>

                {/* Mapa de ubicación */}
                {isLoaded && !mapaNoDisponible && mapaVisto && (
                  <div className="mt-6">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-ink">
                        Ubicación en mapa <span className="font-normal text-ink-muted">(opcional)</span>
                      </p>
                      {ubicacionElegida ? (
                        <Badge tono="exito" icono={MapPin}>Ubicación marcada</Badge>
                      ) : (
                        <Badge tono="neutro">Sin marcar</Badge>
                      )}
                    </div>
                    {/* Envoltorio del mapa: ahí busca useFalloMapa el aviso de Google. */}
                    <div ref={contenedorMapaRef} className="overflow-hidden rounded-xl border border-line">
                      <GoogleMap
                        mapContainerStyle={mapContainerStyle}
                        zoom={15}
                        center={mapCenter}
                        onClick={onMapClick}
                        options={{
                          streetViewControl: false,
                          mapTypeControl: false,
                        }}
                      >
                        <Marker
                          position={markerPosition}
                          draggable={true}
                          onDragEnd={(e) => {
                            if (e.latLng) {
                              onMapClick(e as google.maps.MapMouseEvent);
                            }
                          }}
                        />
                      </GoogleMap>
                    </div>
                    <p className="mt-2 text-[13px] text-ink-muted">
                      Puedes buscar tu dirección o hacer clic en el mapa para ajustar la ubicación
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* ============ Paso 4 · Documentos ============ */}
            <div hidden={idPaso !== 'documentos'}>
              <div className="emp-panel">
                {tituloDePaso(3)}
                <div className="grid gap-6">
                  <FormField
                    etiqueta="Identificación"
                    requerido
                    id={idCampo('identificacion')}
                    error={errorDe('identificacion')}
                    ayuda="De quien registra la cuenta. PDF, imagen, Word o Excel; máximo 4 MB."
                  >
                    <CampoArchivo
                      nombre="Identificación"
                      archivo={formData.identificacion}
                      inputRef={fileInputIdRef}
                      accept={ACEPTA_DOCUMENTOS}
                      alCambiar={(e) => {
                        handleFileChange(e, 'identificacion');
                        quitarErrorPaso('identificacion');
                      }}
                      alQuitar={() => handleFileRemove('identificacion')}
                    />
                  </FormField>
                  <FormField
                    etiqueta="Constancia de Situación Fiscal"
                    requerido
                    id={idCampo('documentosConstitucion')}
                    error={errorDe('documentosConstitucion')}
                    ayuda="PDF, imagen, Word o Excel; máximo 4 MB."
                  >
                    <CampoArchivo
                      nombre="Constancia de Situación Fiscal"
                      archivo={formData.documentosConstitucion}
                      inputRef={fileInputDocRef}
                      accept={ACEPTA_DOCUMENTOS}
                      alCambiar={(e) => {
                        handleFileChange(e, 'documentosConstitucion');
                        quitarErrorPaso('documentosConstitucion');
                      }}
                      alQuitar={() => handleFileRemove('documentosConstitucion')}
                    />
                  </FormField>
                  <p className="flex items-start gap-2 rounded-xl bg-teal-tint px-4 py-3 text-sm text-teal-dark">
                    <Clock className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
                    Los documentos se suben al enviar la solicitud, no antes.
                  </p>
                </div>
              </div>
            </div>

            {/* ============ Paso 5 · Revisión ============ */}
            <div hidden={idPaso !== 'revision'}>
              <div className="emp-panel">
                {tituloDePaso(4)}
                <ResumenSolicitud
                  datos={formData}
                  logoPreview={logoPreview}
                  ubicacionElegida={ubicacionElegida}
                  alEditar={(p) => irAPaso(PASOS.findIndex((x) => x.id === p))}
                />
                <p className="mt-5 text-sm text-ink-muted">
                  Al enviar se crea tu cuenta. Publicar vacantes y ver candidatos
                  se habilitará cuando INAKAT apruebe tu empresa.
                </p>

                {submitStatus.type === 'error' && (
                  // Sin role: el aviso flotante (Toast) ya lo anuncia como alerta.
                  <div className="mt-5 flex items-start gap-2 rounded-xl border border-danger/30 bg-danger-tint px-4 py-3 text-sm font-medium text-danger-dark">
                    <AlertCircle className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
                    <p>{submitStatus.message}</p>
                  </div>
                )}

                {/* El aviso declaraba una aceptación sin poner los documentos a
                    disposición: ahora son enlaces reales. */}
                <p className="mt-5 text-xs text-ink-muted">
                  *Al dar click, aceptas los{' '}
                  <Link
                    href="/terms"
                    className="font-medium text-teal underline underline-offset-2 hover:text-ink"
                  >
                    términos y condiciones
                  </Link>{' '}
                  y la{' '}
                  <Link
                    href="/privacy"
                    className="font-medium text-teal underline underline-offset-2 hover:text-ink"
                  >
                    política de privacidad
                  </Link>
                  .
                </p>
              </div>
            </div>

            {/* Resumen de errores del paso (al intentar avanzar) */}
            {mostrarAviso && (
              <div
                role="alert"
                className="mt-6 flex items-start gap-2 rounded-xl border border-danger/30 bg-danger-tint px-4 py-3 text-sm font-medium text-danger-dark"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
                {avisoPaso.total === 1
                  ? 'Revisa el campo marcado para continuar.'
                  : `Revisa los ${avisoPaso.total} campos marcados para continuar.`}
              </div>
            )}

            {/* Navegación: un solo botón submit (Intro en un campo = «Continuar») */}
            <div className="mt-8 flex flex-col-reverse gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
              {paso > 0 ? (
                <Button
                  variante="contorno"
                  tamano="lg"
                  icono={ArrowLeft}
                  onClick={() => irAPaso(paso - 1)}
                  disabled={isSubmitting}
                  className="w-full sm:w-auto"
                >
                  Anterior
                </Button>
              ) : (
                <span className="hidden sm:block" aria-hidden="true" />
              )}
              {paso < ULTIMO ? (
                <Button type="submit" tamano="lg" iconoFinal={ArrowRight} className="w-full sm:w-auto">
                  Continuar
                </Button>
              ) : (
                <Button
                  type="submit"
                  tamano="lg"
                  iconoFinal={Send}
                  cargando={isSubmitting}
                  textoCargando="Enviando solicitud…"
                  className="w-full sm:w-auto"
                >
                  Enviar solicitud
                </Button>
              )}
            </div>
          </form>
        </div>
      </div>
    </section>

    {/* Modal de éxito.
        El texto anterior («Ya puedes acceder a la plataforma») prometía
        algo que el servidor no concede: publicar vacantes y ver
        candidatos requiere que un admin apruebe la solicitud. */}
    <Modal
      abierto={showSuccessModal}
      alCerrar={() => setShowSuccessModal(false)}
      titulo="¡Solicitud enviada exitosamente!"
      iconoTitulo={<CheckCircle2 className="h-5 w-5 flex-none text-lime-dark" aria-hidden="true" />}
      descripcion="Tu cuenta ha sido creada. Ya puedes entrar, pero publicar vacantes y ver candidatos se habilitará cuando INAKAT apruebe tu empresa."
      tamano="sm"
      cerrarAlPulsarFondo={false}
      pie={
        <Button
          tamano="lg"
          anchoCompleto
          iconoFinal={ArrowRight}
          cargando={entrando}
          onClick={async () => {
            setEntrando(true);
            try {
              await irAPlataforma();
            } finally {
              setEntrando(false);
            }
          }}
        >
          Ir a plataforma
        </Button>
      }
    >
      <ul className="grid gap-2">
        <li className="flex items-center gap-3 rounded-xl bg-lime-tint px-4 py-3 text-sm font-medium text-lime-dark">
          <Check className="h-4 w-4 flex-none" strokeWidth={3} aria-hidden="true" />
          Cuenta creada
        </li>
        <li className="flex items-center gap-3 rounded-xl bg-orange-tint px-4 py-3 text-sm font-medium text-orange-dark">
          <Clock className="h-4 w-4 flex-none" aria-hidden="true" />
          Aprobación de tu empresa: pendiente
        </li>
      </ul>
    </Modal>
    </>
  );
};

export default FormRegisterForQuotationSection;
