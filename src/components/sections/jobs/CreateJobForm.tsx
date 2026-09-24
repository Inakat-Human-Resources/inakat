// RUTA: src/components/sections/jobs/CreateJobForm.tsx

'use client';

/**
 * Publicar vacante (/create-job) y editarla (/create-job?edit=<id>).
 *
 * Registro de APLICACIÓN, patrón de formulario largo (docs/DISENO.md §6):
 * - Publicar: cuatro pasos (Stepper) sobre el MISMO estado, la MISMA validación
 *   y el MISMO envío de siempre. Los pasos son presentación: todos siguen
 *   montados (los que no tocan, con `hidden`), así el mapa y lo escrito no se
 *   pierden al ir y volver, y «Siguiente» sólo muestra los errores del paso.
 * - Editar: las mismas secciones, todas a la vista, cada una en su tarjeta.
 * - La calculadora de costo en créditos está SIEMPRE a la vista
 *   (ResumenPublicacion): columna lateral fija desde 1280 px; por debajo,
 *   barra pegada al borde inferior. Los botones de guardar y publicar viven ahí.
 *
 * La lógica es la de antes, sin cambios: mismas llamadas (GET/POST
 * /api/pricing/calculate, /api/specialties, /api/auth/me, /api/company/profile,
 * GET/PUT /api/jobs/:id, POST /api/jobs) con los mismos cuerpos, mismas
 * validaciones y mensajes, mismos cobros, confirmaciones y redirecciones.
 */

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  Coins,
  EyeOff,
  Lock,
  MapPin,
  Plus,
  RefreshCw,
  Save,
  Send,
  X
} from 'lucide-react';
import { useLoadScript, GoogleMap, Marker, Autocomplete } from '@react-google-maps/api';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import Stepper, { type PasoStepper } from '@/components/ui/Stepper';
import Button from '@/components/ui/Button';
import IconButton from '@/components/ui/IconButton';
import Modal from '@/components/ui/Modal';
import Aviso from '@/components/ui/Aviso';
import { Badge } from '@/components/ui/Badge';
import FormField, { Input, Select, Textarea, Checkbox } from '@/components/ui/FormField';
import { notifyAuthChanged } from '@/lib/auth-events';
import { cn } from '@/lib/utils';
import CreateJobFormFallback from './CreateJobFormFallback';
import ResumenPublicacion, { ID_AYUDA_COSTO, ID_RESUMEN } from './ResumenPublicacion';
import RevisionVacante from './RevisionVacante';
import SeccionVacante from './SeccionVacante';
import { useFalloMapa } from '@/hooks/useFalloMapa';
// Tipos de trabajo: el `valor` es el que se guarda (y el que ya llevan las
// vacantes publicadas y los filtros); la `etiqueta` es la que se lee. Es el
// mismo mapa que usan los listados (src/lib/tipos-trabajo).
import { TIPOS_DE_TRABAJO } from '@/lib/tipos-trabajo';

// Configuración de Google Maps
const libraries: ("places")[] = ["places"];
const mapContainerStyle = {
  width: '100%',
  height: '200px',
  borderRadius: '8px'
};
const defaultCenter = {
  lat: 19.4326, // CDMX por defecto
  lng: -99.1332
};

interface PricingOptions {
  profiles: string[];
  seniorities: string[];
  workModes: string[];
  locations: string[];
}

interface Specialty {
  id: number;
  name: string;
  slug: string;
  icon: string | null;
  color: string;
  subcategories: string[] | null;
}

interface UserInfo {
  credits: number;
  role: string;
  companyName?: string; // Nombre de la empresa pre-cargado
}

/** Los datos del formulario (el mismo objeto de siempre, ahora con nombre). */
interface DatosVacante {
  title: string;
  company: string;
  location: string;
  salaryMin: string;
  salaryMax: string;
  jobType: string;
  workMode: string;
  description: string;
  requirements: string;
  profile: string;
  subcategory: string;
  seniority: string;
  educationLevel: string;
  habilidades: string[];
  responsabilidades: string;
  resultadosEsperados: string;
  valoresActitudes: string;
  informacionAdicional: string;
  notasInternas: string;
  isConfidential: boolean;
}

/**
 * Convierte el campo `habilidades` de la vacante en una lista de strings sin
 * lanzar nunca: acepta el JSON válido que escribe este formulario y degrada
 * cualquier otro valor (array con basura, texto plano «React, Node») a algo
 * editable en vez de romper la pantalla de edición.
 */
export function parseHabilidades(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.filter((h): h is string => typeof h === 'string');
  }
  if (typeof raw !== 'string' || !raw.trim()) return [];

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((h): h is string => typeof h === 'string');
    }
  } catch {
    // No era JSON: se trata como lista separada por comas.
  }

  return raw
    .split(',')
    .map((h) => h.trim())
    .filter(Boolean);
}

/**
 * Errores de validación de la vacante (BUG-02): las MISMAS reglas, mensajes y
 * orden que siempre tuvo validateForm, sacados a una función pura para que el
 * botón «Siguiente» de cada paso use exactamente la misma validación que el
 * guardado.
 */
export function erroresDeVacante(formData: DatosVacante): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!formData.title.trim()) {
    errors.title = 'El título del puesto es requerido';
  }
  if (!formData.company.trim()) {
    errors.company = 'El nombre de la empresa es requerido';
  }
  if (!formData.location.trim()) {
    errors.location = 'La ubicación es requerida';
  }
  if (!formData.profile) {
    errors.profile = 'Selecciona una especialidad';
  }
  if (!formData.seniority) {
    errors.seniority = 'Selecciona el nivel de experiencia';
  }
  if (!formData.salaryMin || !formData.salaryMax) {
    errors.salary = 'Ingresa el rango salarial completo';
  }
  if (!formData.description.trim()) {
    errors.description = 'La descripción del puesto es requerida';
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Pasos (sólo presentación)
// ---------------------------------------------------------------------------
const PASOS: PasoStepper[] = [
  { id: 'puesto', etiqueta: 'Puesto', descripcion: 'Título, empresa y ubicación' },
  { id: 'perfil', etiqueta: 'Perfil y sueldo', descripcion: 'Especialidad, nivel y salario' },
  { id: 'descripcion', etiqueta: 'Descripción', descripcion: 'Qué hará y a quién buscas' },
  { id: 'revision', etiqueta: 'Privacidad y revisión', descripcion: 'Confirma y publica' }
];
const ULTIMO_PASO = PASOS.length - 1;

/** Paso en el que vive cada campo que valida el formulario (la clave de su error). */
const PASO_DE_CAMPO: Record<string, number> = {
  title: 0,
  company: 0,
  location: 0,
  profile: 1,
  seniority: 1,
  salary: 1,
  description: 2
};

/** Clases del aviso de error en bloque (el de /admin): peligro oscuro sobre su tinte, 6.30:1. */
const AVISO_ERROR =
  'flex items-start gap-2 rounded-xl border border-danger/30 bg-danger-tint px-4 py-3 text-sm text-danger-dark';

const CreateJobForm = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editJobId = searchParams.get('edit');

  // Estado para modo edición
  const [isEditing, setIsEditing] = useState(false);
  const [isLoadingJob, setIsLoadingJob] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [formData, setFormData] = useState<DatosVacante>({
    title: '',
    company: '',
    location: '',
    salaryMin: '',
    salaryMax: '',
    jobType: 'Tiempo Completo',
    workMode: 'presential',
    description: '',
    requirements: '',
    // Campos para pricing
    profile: '',
    subcategory: '', // Sub-especialidad
    seniority: '',
    educationLevel: '', // Nivel de estudios requerido
    // Campos extendidos
    habilidades: [] as string[],
    responsabilidades: '',
    resultadosEsperados: '',
    valoresActitudes: '',
    informacionAdicional: '',
    notasInternas: '',
    // Vacante confidencial
    isConfidential: false
  });

  // Opciones de nivel de estudios
  const EDUCATION_LEVELS = [
    'Sin requisito',
    'Primaria',
    'Secundaria',
    'Preparatoria/Bachillerato',
    'Licenciatura',
    'Posgrado'
  ];

  // Estado para error de salario
  const [salaryError, setSalaryError] = useState<string | null>(null);

  // Especialidades del catálogo
  const [specialties, setSpecialties] = useState<Specialty[]>([]);

  // Estado para input de habilidades (chips)
  const [habilidadInput, setHabilidadInput] = useState('');

  const [pricingOptions, setPricingOptions] = useState<PricingOptions>({
    profiles: [],
    seniorities: [],
    workModes: [],
    locations: []
  });

  const [calculatedCost, setCalculatedCost] = useState<number>(0);
  const [minSalaryRequired, setMinSalaryRequired] = useState<number | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  // Identifica la última petición de cálculo de costo (ver calculateCost).
  const calculoCostoRef = useRef(0);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showInsufficientCreditsModal, setShowInsufficientCreditsModal] =
    useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  // Cifras del 402 al EDITAR (créditos que pide el cambio y saldo actual). En
  // null el modal usa el costo de publicación.
  const [faltaCreditos, setFaltaCreditos] = useState<{
    requeridos: number;
    disponibles: number;
  } | null>(null);
  const [submitStatus, setSubmitStatus] = useState<{
    type: 'success' | 'error' | 'draft' | null;
    message: string;
  }>({ type: null, message: '' });

  // Estado para errores de validación de campos (BUG-02)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Estado para modal de éxito (BUG-03)
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successData, setSuccessData] = useState<{
    creditCost: number;
    action: 'published' | 'draft' | 'updated';
    message?: string;
  } | null>(null);

  // Datos de la vacante tal como estaba al abrir la edición. Sirven para saber
  // si el cambio de perfil/nivel/modalidad va a mover créditos.
  const [vacanteOriginal, setVacanteOriginal] = useState<{
    status: string;
    creditCost: number;
    profile: string;
    seniority: string;
    workMode: string;
  } | null>(null);

  // Cobro/devolución pendiente de confirmar antes de mandar el PUT de edición.
  const [cambioCreditosPendiente, setCambioCreditosPendiente] = useState<{
    costoOriginal: number;
    costoNuevo: number;
    delta: number;
  } | null>(null);
  const confirmacionCreditosRef = useRef(false);

  // Temporizador de redirección tras guardar un borrador (ver handleSubmit).
  const redireccionBorradorRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (redireccionBorradorRef.current) {
        clearTimeout(redireccionBorradorRef.current);
      }
    };
  }, []);

  // Estados para Google Maps
  // markerPosition arranca en null a propósito: el mapa puede centrarse en CDMX,
  // pero mientras el usuario no elija un punto (autocompletado, clic o arrastre)
  // la vacante NO debe guardar las coordenadas del Zócalo. Esas coordenadas las
  // usan reclutador y especialista para calcular la distancia al candidato.
  const [mapCenter, setMapCenter] = useState(defaultCenter);
  const [markerPosition, setMarkerPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);

  // Cargar Google Maps
  const { isLoaded: isMapLoaded, loadError: mapLoadError } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    libraries,
  });

  // Si Google rechaza la clave (p. ej. sin facturación), el script carga igual
  // pero pinta su diálogo sobre el mapa: en ese caso, y si el script no carga,
  // la ubicación se escribe a mano (el mismo campo `location`, sin mapa).
  const contenedorMapaRef = useRef<HTMLDivElement>(null);
  const claveRechazada = useFalloMapa(contenedorMapaRef, isMapLoaded && !mapLoadError);
  const mapaNoDisponible = Boolean(mapLoadError) || claveRechazada;
  const mapaListo = isMapLoaded && !mapaNoDisponible;

  // ---------------------------------------------------------------------------
  // Presentación: pasos, foco y botón en curso. No toca datos ni llamadas.
  // ---------------------------------------------------------------------------
  // `isEditing` se enciende en un efecto; el parámetro ya se sabe al pintar.
  const modoEdicion = isEditing || Boolean(editJobId);
  const [paso, setPaso] = useState(0);
  // Qué botón disparó el envío en curso (para poner el giro en ése y no en los dos).
  const [accionEnCurso, setAccionEnCurso] = useState<'publicar' | 'guardar' | null>(null);
  // Intentos de envío fallidos: tras cada uno se lleva al primer campo con error.
  const [intentoEnvio, setIntentoEnvio] = useState(0);
  // Elemento que debe recibir el foco tras pintar (un campo o el título de un paso).
  const [focoPedido, setFocoPedido] = useState<{ id: string; n: number } | null>(null);

  const pedirFoco = (id: string) => setFocoPedido((previo) => ({ id, n: (previo?.n ?? 0) + 1 }));

  useEffect(() => {
    if (!focoPedido) return;
    const destino = document.getElementById(focoPedido.id);
    if (!destino) return;
    // El título de un paso (h2 con tabIndex -1) o el contenedor `field-*` de un campo.
    const esTitulo = focoPedido.id.startsWith('paso-titulo-');
    const control = esTitulo
      ? destino
      : destino.querySelector<HTMLElement>('input:not([type="hidden"]), select, textarea') ?? destino;
    // 'auto' respeta el scroll-behavior del documento (suave, o inmediato con
    // movimiento reducido).
    destino.scrollIntoView?.({ behavior: 'auto', block: esTitulo ? 'start' : 'center' });
    control.focus({ preventScroll: true });
  }, [focoPedido]);

  // Tras un envío que no pasó la validación: al paso del primer error y a su campo.
  useEffect(() => {
    if (!intentoEnvio) return;
    const primero = Object.keys(fieldErrors)[0] ?? (salaryError ? 'salary' : null);
    if (!primero) return;
    const destino = PASO_DE_CAMPO[primero];
    if (destino !== undefined) setPaso(destino);
    pedirFoco(`field-${primero}`);
    // Sólo al fallar un envío: escribir en un campo no debe mover al usuario.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intentoEnvio]);

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

        // Extraer la ubicación formateada
        const addressComponents = place.address_components || [];
        let ciudad = '';
        let estado = '';

        addressComponents.forEach((component) => {
          const types = component.types;
          if (types.includes('locality')) {
            ciudad = component.long_name;
          }
          if (types.includes('administrative_area_level_1')) {
            estado = component.short_name;
          }
        });

        // Si es un establecimiento, mostrar nombre + dirección
        const hasName = place.name && !place.name.match(/^\d/); // nombre real, no un número de calle
        const locationStr = hasName
          ? `${place.name}, ${place.formatted_address || `${ciudad}, ${estado}`}`
          : place.formatted_address || `${ciudad}, ${estado}`;

        setFormData(prev => ({
          ...prev,
          location: locationStr
        }));
      }
    }
  };

  /**
   * El usuario teclea la ubicación a mano: lo que haya en el mapa deja de
   * corresponder al texto, así que se descarta el punto. Si después elige una
   * sugerencia del autocompletado, onPlaceChanged vuelve a fijarlo (ese evento
   * llega después del onChange del input).
   */
  const handleLocationTyped = (value: string) => {
    setFormData((prev) => ({ ...prev, location: value }));
    setMarkerPosition(null);
    clearFieldError('location');
  };

  const onMapClick = (e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      setMarkerPosition({ lat, lng });

      // Reverse geocoding para obtener la dirección
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        if (status === 'OK' && results?.[0]) {
          const addressComponents = results[0].address_components || [];
          let ciudad = '';
          let estado = '';

          addressComponents.forEach((component) => {
            const types = component.types;
            if (types.includes('locality')) {
              ciudad = component.long_name;
            }
            if (types.includes('administrative_area_level_1')) {
              estado = component.short_name;
            }
          });

          // Usar la dirección completa del reverse geocoding
          const locationStr = results[0].formatted_address || `${ciudad}, ${estado}`;

          setFormData(prev => ({
            ...prev,
            location: locationStr
          }));
        }
      });
    }
  };

  // Cargar datos de la vacante si estamos en modo edición
  useEffect(() => {
    if (editJobId) {
      setIsEditing(true);
      fetchJobData(editJobId);
    }
  }, [editJobId]);

  // Cargar opciones de pricing y especialidades al montar
  useEffect(() => {
    fetchPricingOptions();
    fetchUserInfo();
    fetchSpecialties();
  }, []);

  // FIX-01: Re-fetch créditos cuando el usuario regresa de otra página (ej: comprar créditos)
  useEffect(() => {
    const handleFocus = () => {
      // Re-cargar info del usuario para tener créditos actualizados
      fetchUserInfo();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  // La subcategoría se limpia en el onChange del select de especialidad, NO en un
  // efecto sobre formData.profile: en modo edición fetchJobData cambia `profile`
  // de '' al valor guardado, el efecto se disparaba tras ese render y borraba la
  // sub-especialidad ya cargada, así que guardar un typo en la descripción
  // mandaba subcategory:'' y la API la persistía como null.

  // Calcular costo cuando cambian los campos relevantes
  useEffect(() => {
    if (formData.profile && formData.seniority && formData.workMode) {
      calculateCost();
    } else {
      calculoCostoRef.current++; // invalida cualquier cálculo en vuelo
      setIsCalculating(false);
      setCalculatedCost(0);
      setMinSalaryRequired(null);
    }
  }, [formData.profile, formData.seniority, formData.workMode]);

  const fetchJobData = async (jobId: string) => {
    setIsLoadingJob(true);
    setLoadError(null);

    try {
      const response = await fetch(`/api/jobs/${jobId}`);
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 404) {
          setLoadError('La vacante no existe o fue eliminada.');
        } else if (response.status === 403) {
          setLoadError('No tienes permiso para editar esta vacante.');
        } else {
          setLoadError(data.error || 'Error al cargar la vacante.');
        }
        return;
      }

      if (data.success && data.data) {
        const job = data.data;
        // `habilidades` se guarda como JSON, pero la API acepta cualquier string
        // (datos legados o escritos por API). Un JSON.parse suelto caía en el
        // catch general y dejaba la vacante imposible de editar con el mensaje
        // 'Error de conexión'. Se degrada a lista separada por comas.
        const parsedHabilidades = parseHabilidades(job.habilidades);

        // Extraer salaryMin y salaryMax (pueden venir del job o parsear el salary string)
        let salaryMinVal = job.salaryMin ? String(job.salaryMin) : '';
        let salaryMaxVal = job.salaryMax ? String(job.salaryMax) : '';

        // Si no hay valores numéricos pero hay salary string, intentar parsear
        if (!salaryMinVal && !salaryMaxVal && job.salary) {
          const salaryMatch = job.salary.match(/\$?([\d,]+)\s*-\s*\$?([\d,]+)/);
          if (salaryMatch) {
            salaryMinVal = salaryMatch[1].replace(/,/g, '');
            salaryMaxVal = salaryMatch[2].replace(/,/g, '');
          }
        }

        setFormData({
          title: job.title || '',
          company: job.company || '',
          location: job.location || '',
          salaryMin: salaryMinVal,
          salaryMax: salaryMaxVal,
          jobType: job.jobType || 'Tiempo Completo',
          workMode: job.workMode || 'presential',
          description: job.description || '',
          requirements: job.requirements || '',
          profile: job.profile || '',
          subcategory: job.subcategory || '',
          seniority: job.seniority || '',
          educationLevel: job.educationLevel || '',
          habilidades: parsedHabilidades,
          responsabilidades: job.responsabilidades || '',
          resultadosEsperados: job.resultadosEsperados || '',
          valoresActitudes: job.valoresActitudes || '',
          informacionAdicional: job.informacionAdicional || '',
          notasInternas: job.notasInternas || '',
          isConfidential: job.isConfidential || false
        });

        // Guardar el estado de partida para detectar movimientos de créditos.
        setVacanteOriginal({
          status: job.status || '',
          creditCost: Number(job.creditCost) || 0,
          profile: job.profile || '',
          seniority: job.seniority || '',
          workMode: job.workMode || 'presential'
        });

        // Recuperar el punto guardado: sin esto el mapa de edición mostraba
        // siempre CDMX aunque la vacante estuviera en otra ciudad, y al guardar
        // se enviaban coordenadas nulas o equivocadas.
        const lat = Number(job.latitude);
        const lng = Number(job.longitude);
        if (
          job.latitude !== null && job.latitude !== undefined &&
          job.longitude !== null && job.longitude !== undefined &&
          Number.isFinite(lat) && Number.isFinite(lng) &&
          Math.abs(lat) <= 90 && Math.abs(lng) <= 180
        ) {
          setMapCenter({ lat, lng });
          setMarkerPosition({ lat, lng });
        }
      } else {
        setLoadError('Error al cargar los datos de la vacante.');
      }
    } catch {
      setLoadError('Error de conexión. Intenta de nuevo.');
    } finally {
      setIsLoadingJob(false);
    }
  };

  const fetchPricingOptions = async () => {
    try {
      const response = await fetch('/api/pricing/calculate');
      if (!response.ok) return;
      const data = await response.json();
      if (data.success) {
        setPricingOptions(data.options);
      }
    } catch {
      // Silent fail - form will use defaults
    }
  };

  const fetchSpecialties = async () => {
    try {
      const response = await fetch('/api/specialties?subcategories=true');
      if (!response.ok) return;
      const data = await response.json();
      if (data.success) {
        setSpecialties(data.data);
      }
    } catch {
      // Silent fail - specialties will be empty
    }
  };

  const fetchUserInfo = async () => {
    try {
      const response = await fetch('/api/auth/me');
      const data = await response.json();
      if (data.success && data.user) {
        const userInfoData: UserInfo = {
          credits: data.user.credits || 0,
          role: data.user.role
        };

        // Si es empresa, obtener el nombre de la empresa para pre-llenar
        if (data.user.role === 'company') {
          try {
            const companyRes = await fetch('/api/company/profile');
            const companyData = await companyRes.json();
            if (companyData.success && companyData.data?.nombreEmpresa) {
              userInfoData.companyName = companyData.data.nombreEmpresa;
              // Pre-llenar el campo company solo si está vacío (no en modo edición)
              if (!editJobId) {
                setFormData((prev) => ({
                  ...prev,
                  company: companyData.data.nombreEmpresa
                }));
              }
            }
          } catch {
            // Silent fail - company name won't be pre-filled
          }
        }

        setUserInfo(userInfoData);
      }
    } catch {
      // Silent fail - user info unavailable
    }
  };

  const calculateCost = async () => {
    // Contador de petición: si el usuario cambia de nivel dos veces seguidas, la
    // respuesta que llegue tarde (la del nivel viejo) ya no debe pisar el costo.
    const peticion = ++calculoCostoRef.current;
    setIsCalculating(true);
    try {
      const response = await fetch('/api/pricing/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile: formData.profile,
          seniority: formData.seniority,
          workMode: formData.workMode
        })
      });
      const data = await response.json();
      if (peticion !== calculoCostoRef.current) return; // respuesta obsoleta
      if (data.success) {
        setCalculatedCost(data.credits);
        setMinSalaryRequired(data.minSalary || null);
      }
    } catch {
      // Silent fail - cost remains at 0
    } finally {
      if (peticion === calculoCostoRef.current) {
        setIsCalculating(false);
      }
    }
  };

  // Función de validación del formulario (BUG-02)
  const validateForm = (): boolean => {
    const errors = erroresDeVacante(formData);

    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      // Scroll al primer error
      const firstErrorField = Object.keys(errors)[0];
      const element = document.getElementById(`field-${firstErrorField}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return false;
    }

    return true;
  };

  // Limpiar error de un campo específico
  const clearFieldError = (fieldName: string) => {
    if (fieldErrors[fieldName]) {
      setFieldErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[fieldName];
        return newErrors;
      });
    }
  };

  // Validación en tiempo real del rango salarial
  const validateSalaryRange = (min: string, max: string): boolean => {
    const minNum = parseInt(min) || 0;
    const maxNum = parseInt(max) || 0;

    // Solo validar si ambos valores están presentes
    if (!minNum || !maxNum) {
      setSalaryError(null);
      return true;
    }

    if (minNum > maxNum) {
      setSalaryError('El salario mínimo no puede ser mayor al máximo');
      return false;
    }

    if (maxNum - minNum > 10000) {
      setSalaryError('La diferencia entre salario máximo y mínimo no puede ser mayor a $10,000 MXN');
      return false;
    }

    // Validar salario mínimo requerido para la especialidad
    if (minSalaryRequired && minNum < minSalaryRequired) {
      setSalaryError(`El salario mínimo debe ser al menos $${minSalaryRequired.toLocaleString('es-MX')} MXN para esta especialidad`);
      return false;
    }

    setSalaryError(null);
    return true;
  };

  /**
   * Diferencia de créditos que provocará el PUT de edición.
   *
   * PUT /api/jobs/[id] cobra o devuelve la diferencia cuando cambian perfil,
   * nivel o modalidad de una vacante ACTIVA. Hasta ahora el formulario ocultaba
   * el costo en edición, así que el movimiento pasaba desapercibido.
   * Devuelve 0 cuando no hay cobro/devolución posible.
   */
  const calcularDeltaCreditos = (): number => {
    if (!isEditing || !vacanteOriginal) return 0;
    if (vacanteOriginal.status !== 'active') return 0;
    if (userInfo?.role === 'admin') return 0;
    if (!calculatedCost) return 0;

    const cambioPricing =
      formData.profile !== vacanteOriginal.profile ||
      formData.seniority !== vacanteOriginal.seniority ||
      formData.workMode !== vacanteOriginal.workMode;
    if (!cambioPricing) return 0;

    return calculatedCost - vacanteOriginal.creditCost;
  };

  const handleSubmit = async (
    e: React.FormEvent,
    publishNow: boolean = false,
    opciones: { redirigirTrasBorrador?: boolean } = {}
  ): Promise<boolean> => {
    e.preventDefault();

    const { redirigirTrasBorrador = true } = opciones;

    // Limpiar errores previos
    setFieldErrors({});

    // Validar formulario primero (BUG-02)
    if (!validateForm()) {
      return false;
    }

    // Validar salarios
    const salaryMinNum = parseInt(formData.salaryMin) || 0;
    const salaryMaxNum = parseInt(formData.salaryMax) || 0;

    if (!salaryMinNum || !salaryMaxNum) {
      setSalaryError('Debes ingresar el salario mínimo y máximo');
      return false;
    }

    if (salaryMinNum > salaryMaxNum) {
      setSalaryError('El salario mínimo no puede ser mayor al máximo');
      return false;
    }

    if (salaryMaxNum - salaryMinNum > 10000) {
      setSalaryError('La diferencia máxima permitida es $10,000 MXN');
      return false;
    }

    // Validar salario mínimo requerido para la especialidad
    if (minSalaryRequired && salaryMinNum < minSalaryRequired) {
      setSalaryError(`El salario mínimo debe ser al menos $${minSalaryRequired.toLocaleString('es-MX')} MXN para esta especialidad`);
      return false;
    }

    setSalaryError(null);

    // Verificar créditos antes de publicar (solo para nuevas vacantes)
    if (!isEditing && publishNow && userInfo && userInfo.role !== 'admin') {
      if (userInfo.credits < calculatedCost) {
        setFaltaCreditos(null);
        setShowInsufficientCreditsModal(true);
        return false;
      }
    }

    // Editar perfil/nivel/modalidad de una vacante activa mueve créditos: se
    // avisa y se pide confirmación ANTES de mandar el PUT.
    if (!confirmacionCreditosRef.current) {
      const delta = calcularDeltaCreditos();
      if (delta !== 0) {
        setCambioCreditosPendiente({
          costoOriginal: vacanteOriginal?.creditCost ?? 0,
          costoNuevo: calculatedCost,
          delta
        });
        return false;
      }
    }

    setIsSubmitting(true);
    setSubmitStatus({ type: null, message: '' });

    try {
      // Usar PUT para edición, POST para creación
      const url = isEditing ? `/api/jobs/${editJobId}` : '/api/jobs';
      const method = isEditing ? 'PUT' : 'POST';

      // Construir el salary string desde min/max
      const salaryStr = `$${salaryMinNum.toLocaleString('es-MX')} - $${salaryMaxNum.toLocaleString('es-MX')} / mes`;

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          salary: salaryStr,
          salaryMin: salaryMinNum,
          salaryMax: salaryMaxNum,
          latitude: markerPosition ? markerPosition.lat : null,
          longitude: markerPosition ? markerPosition.lng : null,
          habilidades:
            formData.habilidades.length > 0 ? JSON.stringify(formData.habilidades) : null,
          publishNow: isEditing ? undefined : publishNow // No enviar publishNow en edición
        })
      });

      const data = await response.json();

      if (response.status === 402) {
        // Créditos insuficientes. En edición lo que falta es la DIFERENCIA del
        // cambio, no el costo total: se guardan las cifras que manda la API
        // para que el modal no diga «te faltan 7» cuando faltan 2.
        setFaltaCreditos(
          isEditing
            ? {
                requeridos: Number(data?.required) || 0,
                disponibles: Number(data?.available) || 0
              }
            : null
        );
        setShowInsufficientCreditsModal(true);
        return false;
      }

      if (response.status === 403) {
        // El 403 del servidor no es siempre «no eres el dueño»: también cubre la
        // ventana de edición de 4 h vencida y el rol no autorizado al crear. Se
        // muestra su mensaje cuando lo trae.
        setSubmitStatus({
          type: 'error',
          message: data?.error || 'No tienes permiso para editar esta vacante.'
        });
        return false;
      }

      if (data.success) {
        if (isEditing) {
          // Para edición, mostrar modal de éxito con el movimiento de créditos
          // que informa la API (data.message / data.creditChange).
          setSuccessData({
            creditCost: 0,
            action: 'updated',
            message: typeof data.message === 'string' ? data.message : undefined
          });
          setShowSuccessModal(true);
          // El saldo cambió si hubo cobro o devolución: se relee.
          if (data.creditChange) {
            fetchUserInfo();
            // Y el saldo de la cabecera del AppShell también (docs/DISENO.md §4).
            notifyAuthChanged();
            setVacanteOriginal((prev) =>
              prev
                ? {
                    ...prev,
                    creditCost: data.creditChange.new ?? prev.creditCost,
                    profile: formData.profile,
                    seniority: formData.seniority,
                    workMode: formData.workMode
                  }
                : prev
            );
          }
        } else if (data.status === 'active') {
          // Para publicación, mostrar modal de éxito (BUG-03)
          setSuccessData({ creditCost: data.creditCost, action: 'published' });
          setShowSuccessModal(true);
          // Actualizar créditos del usuario
          if (userInfo) {
            setUserInfo({
              ...userInfo,
              credits: userInfo.credits - data.creditCost
            });
          }
          // El saldo de la cabecera del AppShell se relee (docs/DISENO.md §4).
          notifyAuthChanged();
        } else {
          // Borrador guardado.
          // El temporizador sólo se programa cuando este guardado ES el destino
          // final. Desde el modal de créditos insuficientes NO: ahí se navega a
          // /credits/purchase y un push diferido a /company/dashboard sacaba a la
          // empresa del embudo de pago 1,5 s después. Además se guarda el id para
          // poder cancelarlo al desmontar.
          setSubmitStatus({
            type: 'draft',
            message: redirigirTrasBorrador
              ? 'Vacante guardada como borrador. Redirigiendo...'
              : 'Vacante guardada como borrador.'
          });
          if (redirigirTrasBorrador) {
            if (redireccionBorradorRef.current) {
              clearTimeout(redireccionBorradorRef.current);
            }
            redireccionBorradorRef.current = setTimeout(() => {
              redireccionBorradorRef.current = null;
              router.push('/company/dashboard');
            }, 1500);
          }
        }
        return true;
      } else {
        throw new Error(
          data.error || `Error al ${isEditing ? 'actualizar' : 'crear'} vacante`
        );
      }
    } catch (error) {
      setSubmitStatus({
        type: 'error',
        message:
          error instanceof Error
            ? error.message
            : `Error al ${isEditing ? 'actualizar' : 'crear'} vacante`
      });
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      company: '',
      location: '',
      salaryMin: '',
      salaryMax: '',
      jobType: 'Tiempo Completo',
      workMode: 'presential',
      description: '',
      requirements: '',
      profile: '',
      subcategory: '',
      seniority: '',
      educationLevel: '',
      habilidades: [],
      responsabilidades: '',
      resultadosEsperados: '',
      valoresActitudes: '',
      informacionAdicional: '',
      notasInternas: '',
      isConfidential: false
    });
    setCalculatedCost(0);
    setMinSalaryRequired(null);
    setHabilidadInput('');
    setSalaryError(null);
  };

  const workModeLabels: Record<string, string> = {
    remote: 'Remoto',
    hybrid: 'Híbrido',
    presential: 'Presencial'
  };

  const hasEnoughCredits = userInfo
    ? userInfo.role === 'admin' || userInfo.credits >= calculatedCost
    : false;

  // Cobro/devolución que provocaría guardar la edición actual (0 si no aplica).
  const deltaCreditosEdicion = calcularDeltaCreditos();

  // ---------------------------------------------------------------------------
  // Presentación: envío, pasos y habilidades (llaman a lo de siempre)
  // ---------------------------------------------------------------------------

  /**
   * Envía con handleSubmit, igual que antes (borrador/guardar o publicar). Sólo
   * añade presentación: marca qué botón está en curso y, si la validación
   * falla, lleva al paso y al campo del primer error.
   */
  const enviar = async (e: React.FormEvent, publicar: boolean) => {
    setAccionEnCurso(publicar ? 'publicar' : 'guardar');
    const guardado = await handleSubmit(e, publicar);
    setAccionEnCurso(null);
    if (!guardado) setIntentoEnvio((n) => n + 1);
  };

  const irAPaso = (indice: number) => {
    setPaso(indice);
    pedirFoco(`paso-titulo-${PASOS[indice].id}`);
  };

  /** «Siguiente»: la validación de siempre, sólo con los campos de este paso. */
  const avanzar = () => {
    const campos = Object.keys(PASO_DE_CAMPO).filter((c) => PASO_DE_CAMPO[c] === paso);
    const todos = erroresDeVacante(formData);
    const delPaso = campos.filter((c) => todos[c]);
    if (delPaso.length > 0) {
      setFieldErrors((prev) => ({
        ...prev,
        ...Object.fromEntries(delPaso.map((c) => [c, todos[c]]))
      }));
      pedirFoco(`field-${delPaso[0]}`);
      return;
    }
    if (campos.includes('salary') && salaryError) {
      pedirFoco('field-salary');
      return;
    }
    // Este paso ya está bien: fuera sus avisos (los de otros pasos se quedan).
    setFieldErrors((prev) =>
      Object.fromEntries(Object.entries(prev).filter(([c]) => !campos.includes(c)))
    );
    irAPaso(Math.min(paso + 1, ULTIMO_PASO));
  };

  /** Desde el resumen de errores: al paso del campo y a su control. */
  const irACampo = (campo: string) => {
    const destino = PASO_DE_CAMPO[campo];
    if (!modoEdicion && destino !== undefined) setPaso(destino);
    pedirFoco(`field-${campo}`);
  };

  /**
   * En móvil y tableta la barra del costo va pegada abajo: si el campo que
   * recibe el foco (con Tab) queda debajo de ella, se sube lo justo para verlo.
   */
  const alEnfocarCampo = (e: React.FocusEvent<HTMLFormElement>) => {
    const barra = document.getElementById(ID_RESUMEN);
    const campo = e.target as HTMLElement;
    if (!barra || barra.contains(campo)) return;
    const b = barra.getBoundingClientRect();
    const c = campo.getBoundingClientRect();
    const mismaColumna = c.left < b.right && c.right > b.left;
    if (mismaColumna && c.bottom > b.top && c.top < b.bottom) {
      window.scrollBy({ top: c.bottom - b.top + 16 });
    }
  };

  const agregarHabilidad = () => {
    const trimmed = habilidadInput.trim();
    if (trimmed && !formData.habilidades.includes(trimmed)) {
      setFormData((prev) => ({
        ...prev,
        habilidades: [...prev.habilidades, trimmed]
      }));
      setHabilidadInput('');
    }
  };

  // Mostrar loading mientras carga datos de vacante en modo edición (también el
  // primer pintado con ?edit=, antes de que el efecto encienda la carga).
  if (isLoadingJob || (Boolean(editJobId) && !isEditing)) {
    return <CreateJobFormFallback mensaje="Cargando la vacante…" />;
  }

  // Mostrar error si no se pudo cargar la vacante
  if (loadError) {
    return (
      <>
        <PageHeader
          antetitulo="Vacantes"
          titulo="Editar vacante"
          migas={[{ etiqueta: 'Panel', href: '/company/dashboard' }, { etiqueta: 'Editar vacante' }]}
        />
        <div
          role="alert"
          className={cn(AVISO_ERROR, 'flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between')}
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-none" aria-hidden="true" />
            <div>
              <p className="font-display font-semibold">No se pudo abrir la vacante</p>
              <p className="mt-0.5">{loadError}</p>
            </div>
          </div>
          <div className="flex flex-none flex-wrap gap-2">
            <Button
              variante="contorno"
              icono={RefreshCw}
              onClick={() => {
                if (editJobId) fetchJobData(editJobId);
              }}
            >
              Reintentar
            </Button>
            <Button variante="secundario" icono={ArrowLeft} onClick={() => router.push('/company/dashboard')}>
              Volver al panel
            </Button>
          </div>
        </div>
      </>
    );
  }

  const etiquetaModalidad = workModeLabels[formData.workMode] ?? formData.workMode;
  const etiquetaTipoTrabajo =
    TIPOS_DE_TRABAJO.find((tipo) => tipo.valor === formData.jobType)?.etiqueta ?? formData.jobType;
  const errorSalario = salaryError || fieldErrors.salary || null;
  const clavesConError = Object.keys(fieldErrors).filter((c) => fieldErrors[c]);

  // ---------------------------------------------------------------------------
  // Bloques del formulario (el mismo contenido en pasos o en tarjetas)
  // ---------------------------------------------------------------------------
  const bloquePuesto = (
    <>
      <div id="field-title">
        <FormField etiqueta="Título del puesto" requerido error={fieldErrors.title}>
          <Input
            type="text"
            name="title"
            value={formData.title}
            onChange={(e) => {
              setFormData({ ...formData, title: e.target.value });
              clearFieldError('title');
            }}
            placeholder="ej. Desarrollador Full Stack"
          />
        </FormField>
      </div>

      <div id="field-company">
        {userInfo?.role === 'company' && userInfo?.companyName ? (
          // Campo de sólo lectura para empresas con nombre pre-cargado
          <FormField
            etiqueta="Nombre de la empresa"
            requerido
            error={fieldErrors.company}
            ayuda="Se toma del perfil de tu empresa."
          >
            <Input type="text" name="company" value={formData.company} readOnly className="cursor-not-allowed bg-mist" />
          </FormField>
        ) : (
          // Campo editable para admin u otros roles
          <FormField etiqueta="Nombre de la empresa" requerido error={fieldErrors.company}>
            <Input
              type="text"
              name="company"
              value={formData.company}
              onChange={(e) => {
                setFormData({ ...formData, company: e.target.value });
                clearFieldError('company');
              }}
              placeholder="ej. Tech Corp"
            />
          </FormField>
        )}
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <FormField etiqueta="Tipo de trabajo" requerido>
          <Select
            name="jobType"
            value={formData.jobType}
            onChange={(e) =>
              setFormData({ ...formData, jobType: e.target.value })
            }
          >
            {TIPOS_DE_TRABAJO.map((tipo) => (
              <option key={tipo.valor} value={tipo.valor}>
                {tipo.etiqueta}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField etiqueta="Modalidad de trabajo" requerido ayuda="Influye en el costo de publicación.">
          <Select
            name="workMode"
            value={formData.workMode}
            onChange={(e) =>
              setFormData({ ...formData, workMode: e.target.value })
            }
          >
            <option value="presential">Presencial</option>
            <option value="hybrid">Híbrido</option>
            <option value="remote">Remoto</option>
          </Select>
        </FormField>
      </div>

      <div id="field-location" className="space-y-3">
        <FormField
          etiqueta="Ubicación"
          requerido
          error={fieldErrors.location}
          ayuda={
            mapaListo
              ? 'Busca la dirección o haz clic en el mapa para seleccionar la ubicación exacta'
              : mapaNoDisponible
                ? 'Escribe la dirección con ciudad y estado.'
                : undefined
          }
        >
          {!mapaListo ? (
            // Mientras carga el mapa, o si Google no lo da: el campo de texto
            // simple (un input nuevo, sin lo que el autocompletado le hubiera puesto).
            <Input
              type="text"
              name="location"
              value={formData.location}
              onChange={(e) => handleLocationTyped(e.target.value)}
              placeholder={
                mapaNoDisponible
                  ? 'ej. Monterrey, Nuevo León'
                  : 'Cargando mapa... ej. Monterrey, Nuevo León'
              }
              prefijo={<MapPin />}
            />
          ) : (
            // Autocomplete de Google Places
            <Autocomplete
              onLoad={onAutocompleteLoad}
              onPlaceChanged={() => {
                onPlaceChanged();
                clearFieldError('location');
              }}
              options={{
                componentRestrictions: { country: 'mx' },
                types: ['geocode', 'establishment'],
                fields: ['formatted_address', 'geometry', 'address_components', 'name', 'place_id']
              }}
            >
              <Input
                type="text"
                name="location"
                value={formData.location}
                onChange={(e) => handleLocationTyped(e.target.value)}
                placeholder="Busca una dirección..."
                prefijo={<MapPin />}
              />
            </Autocomplete>
          )}
        </FormField>

        {/* Respaldo sin mapa: no es un error de quien llena el formulario, así
            que es un aviso informativo (teal oscuro sobre su tinte, 8.18:1).
            Al editar, la vacante puede traer su punto guardado: se conserva
            mientras no se reescriba la dirección (handleLocationTyped lo borra). */}
        {mapaNoDisponible && (
          <Aviso tono="info" compacto>
            {markerPosition
              ? 'El mapa no está disponible en este momento. Se conserva el punto que ya tenía la vacante; si cambias la dirección, se guardará sin punto exacto.'
              : 'El mapa no está disponible en este momento. La vacante se guarda igual con la dirección que escribas, sin punto exacto en el mapa.'}
          </Aviso>
        )}

        {mapaListo && (
          <div>
            {/* Mapa interactivo */}
            <div ref={contenedorMapaRef} className="overflow-hidden rounded-lg border border-line">
              <GoogleMap
                mapContainerStyle={mapContainerStyle}
                zoom={16}
                center={mapCenter}
                onClick={onMapClick}
                options={{
                  streetViewControl: false,
                  mapTypeControl: false,
                  fullscreenControl: false,
                }}
              >
                {/* Sin punto elegido no hay marcador: un marcador por defecto
                    hacía creer que la ubicación exacta ya estaba seleccionada. */}
                {markerPosition && (
                  <Marker
                    position={markerPosition}
                    draggable={true}
                    onDragEnd={(e) => {
                      if (e.latLng) {
                        onMapClick(e as google.maps.MapMouseEvent);
                      }
                    }}
                  />
                )}
              </GoogleMap>
            </div>
            {/* El estado del punto, dicho con texto (no sólo con el marcador). */}
            <p className="mt-2" aria-live="polite">
              {markerPosition ? (
                <Badge tono="exito" icono={MapPin}>
                  Punto marcado en el mapa
                </Badge>
              ) : (
                <Badge tono="neutro">Sin punto exacto en el mapa</Badge>
              )}
            </p>
          </div>
        )}
      </div>
    </>
  );

  // Sub-especialidad (si aplica)
  const subcategoriasPerfil =
    specialties.find((s) => s.name === formData.profile)?.subcategories || [];

  const bloquePerfil = (
    <>
      <div className="grid gap-5 md:grid-cols-2">
        <div id="field-profile">
          <FormField
            etiqueta="Especialidad del puesto"
            requerido
            error={fieldErrors.profile}
            ayuda={specialties.length === 0 && !fieldErrors.profile ? 'Cargando especialidades...' : undefined}
          >
            <Select
              name="profile"
              value={formData.profile}
              onChange={(e) => {
                // Al cambiar de especialidad la sub-especialidad anterior deja
                // de existir en el catálogo, por eso se limpia aquí.
                setFormData({
                  ...formData,
                  profile: e.target.value,
                  subcategory: ''
                });
                clearFieldError('profile');
              }}
            >
              <option value="">Selecciona una especialidad</option>
              {specialties.map((specialty) => (
                <option key={specialty.id} value={specialty.name}>
                  {specialty.icon ? `${specialty.icon} ` : ''}
                  {specialty.name}
                </option>
              ))}
            </Select>
          </FormField>
        </div>

        <div id="field-seniority">
          <FormField etiqueta="Nivel de experiencia" requerido error={fieldErrors.seniority}>
            <Select
              name="seniority"
              value={formData.seniority}
              onChange={(e) => {
                setFormData({ ...formData, seniority: e.target.value });
                clearFieldError('seniority');
              }}
            >
              <option value="">Selecciona el nivel</option>
              {pricingOptions.seniorities.map((seniority) => (
                <option key={seniority} value={seniority}>
                  {seniority}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
      </div>

      {subcategoriasPerfil.length > 0 && (
        <FormField
          etiqueta="Sub-especialidad"
          opcional
          ayuda={`Especifica el área dentro de ${formData.profile}`}
        >
          <Select
            name="subcategory"
            value={formData.subcategory}
            onChange={(e) =>
              setFormData({ ...formData, subcategory: e.target.value })
            }
          >
            <option value="">Selecciona una sub-especialidad</option>
            {subcategoriasPerfil.map((sub) => (
              <option key={sub} value={sub}>
                {sub}
              </option>
            ))}
          </Select>
        </FormField>
      )}

      {/* Nivel de estudios requerido */}
      <FormField
        etiqueta="Nivel de estudios requerido"
        opcional
        ayuda="Indica el nivel mínimo de estudios requerido para el puesto"
      >
        <Select
          name="educationLevel"
          value={formData.educationLevel}
          onChange={(e) =>
            setFormData({ ...formData, educationLevel: e.target.value })
          }
        >
          <option value="">Selecciona el nivel de estudios</option>
          {EDUCATION_LEVELS.map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </Select>
      </FormField>

      {/* Salario (Rango): un error para los dos campos, enlazado a ambos. */}
      <div id="field-salary">
        <fieldset aria-describedby="salario-ayuda">
          <legend className="font-display text-sm font-semibold text-ink">Salario mensual (MXN)</legend>
          <div className="mt-2 grid gap-4 sm:grid-cols-2">
            <FormField etiqueta="Mínimo" id="salario-minimo" requerido>
              <Input
                type="number"
                inputMode="numeric"
                name="salaryMin"
                value={formData.salaryMin}
                onChange={(e) => {
                  const newMin = e.target.value;
                  setFormData({ ...formData, salaryMin: newMin });
                  validateSalaryRange(newMin, formData.salaryMax);
                  clearFieldError('salary');
                }}
                placeholder="15,000"
                prefijo={<span className="text-sm">$</span>}
                min="0"
                aria-invalid={errorSalario ? true : undefined}
                aria-describedby={errorSalario ? 'salario-error' : undefined}
                className="tabular-nums"
              />
            </FormField>
            <FormField etiqueta="Máximo" id="salario-maximo" requerido>
              <Input
                type="number"
                inputMode="numeric"
                name="salaryMax"
                value={formData.salaryMax}
                onChange={(e) => {
                  const newMax = e.target.value;
                  setFormData({ ...formData, salaryMax: newMax });
                  validateSalaryRange(formData.salaryMin, newMax);
                  clearFieldError('salary');
                }}
                placeholder="22,000"
                prefijo={<span className="text-sm">$</span>}
                min="0"
                aria-invalid={errorSalario ? true : undefined}
                aria-describedby={errorSalario ? 'salario-error' : undefined}
                className="tabular-nums"
              />
            </FormField>
          </div>
          {errorSalario && (
            <p id="salario-error" className="mt-2 flex items-start gap-1.5 text-[13px] font-medium text-danger">
              <AlertCircle className="mt-px h-4 w-4 flex-none" aria-hidden="true" />
              {errorSalario}
            </p>
          )}
          <p id="salario-ayuda" className="mt-2 text-[13px] text-ink-muted">
            La diferencia máxima permitida entre mínimo y máximo es $10,000 MXN
          </p>
          {minSalaryRequired && (
            <p className="mt-3 rounded-lg bg-teal-tint px-3 py-2.5 text-sm text-teal-dark">
              <strong>Salario mínimo requerido:</strong> ${minSalaryRequired.toLocaleString('es-MX')} MXN/mes para esta especialidad
            </p>
          )}
        </fieldset>
      </div>
    </>
  );

  const bloqueDescripcion = (
    <>
      <div id="field-description">
        <FormField etiqueta="Descripción del puesto" requerido error={fieldErrors.description}>
          <Textarea
            name="description"
            value={formData.description}
            onChange={(e) => {
              setFormData({ ...formData, description: e.target.value });
              clearFieldError('description');
            }}
            placeholder="Describe las responsabilidades, el ambiente de trabajo, beneficios, etc."
            rows={6}
          />
        </FormField>
      </div>

      <FormField etiqueta="Requisitos" opcional>
        <Textarea
          name="requirements"
          value={formData.requirements}
          onChange={(e) =>
            setFormData({ ...formData, requirements: e.target.value })
          }
          placeholder="Lista los requisitos, habilidades necesarias, experiencia, etc."
          rows={4}
        />
      </FormField>

      {/* Habilidades importantes (chips libres) */}
      <fieldset className="rounded-lg border border-line bg-paper/60 p-4">
        <legend className="sr-only">Habilidades y características importantes</legend>
        <p className="font-display text-sm font-semibold text-ink" aria-hidden="true">
          Habilidades y características importantes
        </p>
        <p className="mt-0.5 text-[13px] text-ink-muted">
          Agrega las habilidades que deben tener mayor peso en la evaluación
        </p>

        <div className="mt-3 flex items-end gap-2">
          <FormField etiqueta="Nueva habilidad" className="min-w-0 flex-1">
            <Input
              type="text"
              value={habilidadInput}
              onChange={(e) => setHabilidadInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  agregarHabilidad();
                }
              }}
              placeholder="Escribe una habilidad..."
            />
          </FormField>
          <Button variante="contorno" icono={Plus} onClick={agregarHabilidad}>
            Agregar
          </Button>
        </div>

        {/* Lista de chips */}
        {formData.habilidades.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2" aria-label="Habilidades agregadas">
            {formData.habilidades.map((hab, index) => (
              <li
                key={index}
                className="inline-flex items-center gap-1 rounded-full bg-teal-tint py-1 pl-3 pr-1 text-sm font-medium text-teal-dark"
              >
                <span>{hab}</span>
                <button
                  type="button"
                  onClick={() => {
                    setFormData((prev) => ({
                      ...prev,
                      habilidades: prev.habilidades.filter((_, i) => i !== index)
                    }));
                  }}
                  aria-label={`Quitar habilidad ${hab}`}
                  title="Quitar"
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full transition-colors duration-150 hover:bg-teal hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-teal"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-3 text-xs text-ink-muted">
          Escribe una habilidad y presiona Enter o pulsa Agregar
        </p>
      </fieldset>

      <FormField
        etiqueta="Responsabilidades específicas"
        ayuda="Describe qué actividades o funciones realizará el candidato"
      >
        <Textarea
          name="responsabilidades"
          value={formData.responsabilidades}
          onChange={(e) =>
            setFormData((prev) => ({
              ...prev,
              responsabilidades: e.target.value
            }))
          }
          rows={3}
          placeholder="Ej: coordinar campañas digitales, revisar facturación mensual, dar seguimiento a clientes..."
        />
      </FormField>

      <FormField
        etiqueta="Resultados esperados (3-6 meses)"
        ayuda="Indica metas, entregables o indicadores clave de éxito"
      >
        <Textarea
          name="resultadosEsperados"
          value={formData.resultadosEsperados}
          onChange={(e) =>
            setFormData((prev) => ({
              ...prev,
              resultadosEsperados: e.target.value
            }))
          }
          rows={3}
          placeholder="Ej: Reducir errores operativos, aumentar clientes activos, implementar sistema de gestión..."
        />
      </FormField>

      <FormField
        etiqueta="Valores y actitudes esenciales"
        ayuda="Ayúdanos a encontrar a alguien que encaje con tu cultura"
      >
        <Textarea
          name="valoresActitudes"
          value={formData.valoresActitudes}
          onChange={(e) =>
            setFormData((prev) => ({
              ...prev,
              valoresActitudes: e.target.value
            }))
          }
          rows={2}
          placeholder="Ej: Honestidad, disposición al cambio, orientación a resultados, atención al detalle..."
        />
      </FormField>

      {/* Información Adicional (público) */}
      <FormField
        etiqueta="Información adicional"
        opcional
        ayuda="Visible para los candidatos que vean esta vacante."
      >
        <Textarea
          name="informacionAdicional"
          value={formData.informacionAdicional}
          onChange={(e) =>
            setFormData((prev) => ({
              ...prev,
              informacionAdicional: e.target.value
            }))
          }
          rows={3}
          placeholder="Comparte cualquier información complementaria que ayude a entender mejor la posición, el contexto del proyecto o lo que buscas en el perfil."
        />
      </FormField>
    </>
  );

  const bloquePrivacidad = (
    <>
      {/* Notas Internas (solo INAKAT) */}
      <div className="rounded-lg border border-line bg-paper/60 p-4">
        <p className="mb-3 inline-flex items-center gap-1.5 font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-teal">
          <Lock className="h-3.5 w-3.5" aria-hidden="true" />
          Sólo para INAKAT
        </p>
        <FormField
          etiqueta="Información interna para INAKAT (no visible para candidatos)"
          ayuda="Este espacio es sólo para uso interno de INAKAT. Aquí puedes agregar detalles sensibles o estratégicos que nos ayuden a identificar mejor al perfil ideal."
        >
          <Textarea
            name="notasInternas"
            value={formData.notasInternas}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                notasInternas: e.target.value
              }))
            }
            rows={3}
            placeholder="Información confidencial: perfil ideal, contexto interno, rangos reales de negociación, etc."
          />
        </FormField>
      </div>

      {/* Vacante Confidencial */}
      <div className="rounded-lg border border-line p-4">
        <Checkbox
          etiqueta={
            <span className="inline-flex items-center gap-2">
              <EyeOff className="h-4 w-4 text-orange-dark" aria-hidden="true" />
              Vacante confidencial
            </span>
          }
          descripcion={
            <>
              Oculta el nombre de la empresa y la dirección exacta en la publicación pública.
              Los candidatos verán &quot;Empresa Confidencial&quot; y solo la ciudad/estado.
            </>
          }
          name="isConfidential"
          checked={formData.isConfidential}
          onChange={(e) =>
            setFormData((prev) => ({
              ...prev,
              isConfidential: e.target.checked
            }))
          }
        />
        {formData.isConfidential && (
          <p className="mt-3 rounded-lg bg-orange-tint px-3 py-2.5 text-sm text-ink">
            <strong>Vista pública:</strong> Los candidatos verán &quot;Empresa Confidencial&quot;
            en lugar de &quot;{formData.company || 'tu empresa'}&quot;
          </p>
        )}
      </div>

      {/* Publicar: el último paso repite lo capturado, de lectura. */}
      {!modoEdicion && paso === ULTIMO_PASO && (
        <RevisionVacante
          datos={formData}
          tipoTrabajo={etiquetaTipoTrabajo}
          modalidad={etiquetaModalidad}
          conPunto={Boolean(markerPosition)}
          alEditar={irAPaso}
        />
      )}
    </>
  );

  const secciones = [
    {
      titulo: 'El puesto',
      descripcion: 'Cómo se llama, quién lo publica y dónde se trabaja.',
      contenido: bloquePuesto
    },
    {
      titulo: 'Perfil y sueldo',
      descripcion: 'La especialidad y el nivel, junto con la modalidad, definen el costo en créditos.',
      contenido: bloquePerfil
    },
    {
      titulo: 'Descripción del puesto',
      descripcion: 'Lo que leerán los candidatos y lo que más pesará en la evaluación.',
      contenido: bloqueDescripcion
    },
    {
      titulo: modoEdicion ? 'Privacidad' : 'Privacidad y revisión',
      descripcion: modoEdicion
        ? 'Qué se muestra en la publicación y qué queda sólo para INAKAT.'
        : 'Decide qué se muestra y revisa todo antes de publicar.',
      contenido: bloquePrivacidad
    }
  ];

  // Resumen de errores de validación (BUG-02): cada uno lleva a su campo.
  const resumenErrores = clavesConError.length > 0 && (
    <div role="alert" className={cn(AVISO_ERROR, 'mb-6')}>
      <AlertCircle className="mt-0.5 h-[18px] w-[18px] flex-none" aria-hidden="true" />
      <div className="min-w-0">
        <p className="font-semibold">Corrige estos campos para continuar:</p>
        <ul className="mt-1.5 space-y-1">
          {clavesConError.map((campo) => (
            <li key={campo}>
              <button
                type="button"
                onClick={() => irACampo(campo)}
                className="text-left underline decoration-danger/40 underline-offset-2 transition-colors duration-150 hover:decoration-danger-dark"
              >
                {fieldErrors[campo]}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );

  // Aviso del último envío, junto a los botones (error o borrador guardado).
  const avisoEnvio =
    submitStatus.type === 'error' ? (
      <div role="alert" className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger-tint py-2 pl-3 pr-1.5 text-[13px] font-medium text-danger-dark">
        <AlertCircle className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
        <p className="min-w-0 flex-1 py-0.5">{submitStatus.message}</p>
        <IconButton
          etiqueta="Cerrar aviso"
          icono={X}
          tamano="sm"
          className="h-7 w-7 text-danger-dark hover:bg-danger/10"
          onClick={() => setSubmitStatus({ type: null, message: '' })}
        />
      </div>
    ) : submitStatus.type ? (
      <div role="status" className="flex items-start gap-2 rounded-lg bg-lime-tint px-3 py-2.5 text-[13px] font-medium text-lime-dark">
        <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
        <p className="min-w-0">{submitStatus.message}</p>
      </div>
    ) : null;

  // Botones: los de siempre, con sus mismas condiciones.
  const acciones = modoEdicion ? (
    <>
      {/* Botón cancelar para edición */}
      <Button
        variante="contorno"
        onClick={() => router.push('/company/dashboard')}
        disabled={isSubmitting}
      >
        Cancelar
      </Button>
      {/* Botón guardar cambios */}
      <Button
        type="submit"
        icono={Save}
        disabled={isSubmitting || !!salaryError}
        cargando={isSubmitting}
        textoCargando="Guardando…"
      >
        Guardar cambios
      </Button>
    </>
  ) : (
    <>
      {/* Guardar como borrador */}
      <Button
        type="submit"
        variante="contorno"
        icono={Save}
        disabled={isSubmitting || !!salaryError}
        cargando={isSubmitting && accionEnCurso === 'guardar'}
        textoCargando="Guardando…"
      >
        <span className="sm:hidden">Borrador</span>
        <span className="hidden sm:inline">Guardar borrador</span>
      </Button>
      {/* Publicar ahora */}
      <Button
        icono={hasEnoughCredits ? Send : Coins}
        onClick={(e) => enviar(e, true)}
        // `isCalculating` también bloquea: mientras se recalcula, el botón
        // seguía mostrando (y usando) el costo del perfil anterior.
        disabled={isSubmitting || isCalculating || !calculatedCost || !!salaryError}
        cargando={isSubmitting && accionEnCurso === 'publicar'}
        textoCargando="Publicando…"
        aria-describedby={!calculatedCost && !isCalculating ? ID_AYUDA_COSTO : undefined}
      >
        {isCalculating ? (
          'Calculando costo…'
        ) : !calculatedCost ? (
          'Publicar vacante'
        ) : hasEnoughCredits ? (
          <>
            <span className="hidden sm:inline">Publicar ({calculatedCost} créditos)</span>
            <span className="sm:hidden">Publicar ({calculatedCost})</span>
          </>
        ) : (
          'Comprar créditos'
        )}
      </Button>
    </>
  );

  return (
    <>
      <PageHeader
        antetitulo="Vacantes"
        titulo={modoEdicion ? 'Editar vacante' : 'Publicar vacante'}
        remate={modoEdicion ? undefined : 'paso a paso'}
        descripcion={
          modoEdicion
            ? 'Modifica la información de la vacante. Los cambios se aplican al guardar.'
            : 'Completa la información en cuatro pasos. El costo en créditos se calcula mientras avanzas y sólo se descuenta al publicar.'
        }
        migas={
          modoEdicion
            ? [{ etiqueta: 'Panel', href: '/company/dashboard' }, { etiqueta: 'Editar vacante' }]
            : undefined
        }
      />

      {/* noValidate: la validación es la del formulario (validateForm). La del
          navegador no puede enfocar un campo obligatorio de un paso oculto y
          bloqueaba el borrador sin decir nada. */}
      <form
        onSubmit={(e) => enviar(e, false)}
        noValidate
        onFocus={alEnfocarCampo}
        className="xl:grid xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start xl:gap-6"
      >
        <div className="min-w-0">
          {modoEdicion ? (
            <div className="space-y-6">
              {resumenErrores}
              {secciones.map((s, i) => (
                <SeccionVacante key={PASOS[i].id} id={PASOS[i].id} titulo={s.titulo} descripcion={s.descripcion} enTarjeta>
                  {s.contenido}
                </SeccionVacante>
              ))}
            </div>
          ) : (
            <Card
              sinRelleno
              pie={
                <div className="flex items-center justify-between gap-3">
                  {paso > 0 ? (
                    <Button variante="contorno" icono={ArrowLeft} onClick={() => irAPaso(paso - 1)}>
                      Anterior
                    </Button>
                  ) : (
                    <span aria-hidden="true" />
                  )}
                  {paso < ULTIMO_PASO ? (
                    <Button variante="secundario" iconoFinal={ArrowRight} onClick={avanzar}>
                      <span className="sm:hidden">Siguiente</span>
                      <span className="hidden sm:inline">Siguiente: {PASOS[paso + 1].etiqueta}</span>
                    </Button>
                  ) : (
                    <p className="text-right text-[13px] text-ink-muted">
                      ¿Todo en orden? Publica la vacante o guárdala como borrador.
                    </p>
                  )}
                </div>
              }
            >
              <div className="border-b border-line px-5 py-5 sm:px-6">
                <Stepper pasos={PASOS} actual={paso} alIrA={irAPaso} />
              </div>
              <div className="px-5 py-6 sm:px-6">
                {resumenErrores}
                {secciones.map((s, i) => (
                  <SeccionVacante
                    key={PASOS[i].id}
                    id={PASOS[i].id}
                    titulo={s.titulo}
                    descripcion={s.descripcion}
                    enTarjeta={false}
                    oculta={paso !== i}
                  >
                    {s.contenido}
                  </SeccionVacante>
                ))}
              </div>
            </Card>
          )}
        </div>

        <ResumenPublicacion
          modoEdicion={modoEdicion}
          saldo={userInfo && userInfo.role !== 'admin' ? userInfo.credits : null}
          costo={calculatedCost}
          calculando={isCalculating}
          suficientes={hasEnoughCredits}
          perfil={formData.profile}
          nivel={formData.seniority}
          modalidad={etiquetaModalidad}
          estadoVacante={vacanteOriginal?.status}
          costoPagado={vacanteOriginal?.creditCost}
          deltaEdicion={deltaCreditosEdicion}
          aviso={avisoEnvio}
          acciones={acciones}
        />
      </form>

      {/* Modal de créditos insuficientes */}
      <Modal
        abierto={showInsufficientCreditsModal}
        alCerrar={() => {
          if (!isSavingDraft) setShowInsufficientCreditsModal(false);
        }}
        titulo="Créditos insuficientes"
        iconoTitulo={<AlertCircle className="h-5 w-5 flex-none text-danger" aria-hidden="true" />}
        tamano="sm"
        pie={
          <>
            <Button
              variante="contorno"
              onClick={() => setShowInsufficientCreditsModal(false)}
              disabled={isSavingDraft}
            >
              Cancelar
            </Button>
            <Button
              icono={Coins}
              cargando={isSavingDraft}
              textoCargando="Guardando borrador…"
              onClick={async () => {
                // En edición no hay borrador que guardar: reenviar el PUT
                // repetía el mismo 402 y cerraba el modal sin navegar. Se va
                // directo a comprar créditos.
                if (isEditing) {
                  setShowInsufficientCreditsModal(false);
                  router.push('/credits/purchase');
                  return;
                }
                setIsSavingDraft(true);
                const saved = await handleSubmit(
                  new Event('submit') as unknown as React.FormEvent,
                  false,
                  { redirigirTrasBorrador: false }
                );
                setIsSavingDraft(false);
                if (saved) {
                  setShowInsufficientCreditsModal(false);
                  router.push('/credits/purchase');
                } else {
                  setShowInsufficientCreditsModal(false);
                }
              }}
            >
              {isEditing ? 'Comprar créditos' : 'Comprar créditos y guardar en borrador'}
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-ink">
          Necesitas{' '}
          <strong>
            {faltaCreditos ? faltaCreditos.requeridos : calculatedCost} créditos
          </strong>{' '}
          {faltaCreditos ? 'para aplicar este cambio.' : 'para publicar esta vacante.'}
          <br />
          Actualmente tienes{' '}
          <strong>
            {faltaCreditos ? faltaCreditos.disponibles : userInfo?.credits || 0} créditos
          </strong>
          .
        </p>
        <p className="mt-3 text-sm text-ink-muted">
          Te faltan{' '}
          <strong className="text-danger">
            {faltaCreditos
              ? Math.max(0, faltaCreditos.requeridos - faltaCreditos.disponibles)
              : calculatedCost - (userInfo?.credits || 0)}{' '}
            créditos
          </strong>
          .
        </p>
      </Modal>

      {/* Modal de confirmación del movimiento de créditos al editar */}
      <Modal
        abierto={Boolean(cambioCreditosPendiente)}
        alCerrar={() => setCambioCreditosPendiente(null)}
        titulo={
          cambioCreditosPendiente && cambioCreditosPendiente.delta > 0
            ? 'Este cambio tiene costo'
            : 'Este cambio te devuelve créditos'
        }
        iconoTitulo={<Coins className="h-5 w-5 flex-none text-orange-dark" aria-hidden="true" />}
        tamano="sm"
        pie={
          <>
            <Button variante="contorno" onClick={() => setCambioCreditosPendiente(null)}>
              Cancelar
            </Button>
            <Button
              onClick={async () => {
                setCambioCreditosPendiente(null);
                confirmacionCreditosRef.current = true;
                try {
                  await handleSubmit(
                    new Event('submit') as unknown as React.FormEvent,
                    false
                  );
                } finally {
                  confirmacionCreditosRef.current = false;
                }
              }}
            >
              {cambioCreditosPendiente && cambioCreditosPendiente.delta > 0
                ? `Confirmar y pagar ${cambioCreditosPendiente.delta} créditos`
                : 'Confirmar cambio'}
            </Button>
          </>
        }
      >
        {cambioCreditosPendiente && (
          <>
            <p className="text-sm leading-relaxed text-ink">
              Cambiar la especialidad, el nivel o la modalidad recalcula el
              precio de la vacante: pasa de{' '}
              <strong>{cambioCreditosPendiente.costoOriginal} créditos</strong>{' '}
              a <strong>{cambioCreditosPendiente.costoNuevo} créditos</strong>.
            </p>
            <p className="mt-3 text-sm text-ink">
              {cambioCreditosPendiente.delta > 0 ? (
                <>
                  Se te cobrarán{' '}
                  <strong className="text-orange-dark">
                    {cambioCreditosPendiente.delta} créditos
                  </strong>{' '}
                  adicionales.
                </>
              ) : (
                <>
                  Se te devolverán{' '}
                  <strong className="text-lime-dark">
                    {Math.abs(cambioCreditosPendiente.delta)} créditos
                  </strong>
                  .
                </>
              )}
            </p>
          </>
        )}
      </Modal>

      {/* Modal de éxito al publicar/actualizar (BUG-03). Cerrarlo lleva al
          panel, como su botón: quedarse con el formulario ya publicado lleno
          invitaba a publicarlo dos veces. */}
      <Modal
        abierto={showSuccessModal && Boolean(successData)}
        alCerrar={() => router.push('/company/dashboard')}
        cerrarAlPulsarFondo={false}
        titulo={
          successData?.action === 'published'
            ? '¡Tu vacante ha sido publicada!'
            : '¡Vacante actualizada exitosamente!'
        }
        iconoTitulo={<CheckCircle2 className="h-5 w-5 flex-none text-lime-dark" aria-hidden="true" />}
        pie={
          <>
            {successData?.action === 'published' && (
              <Button
                variante="contorno"
                icono={Plus}
                onClick={() => {
                  setShowSuccessModal(false);
                  setSuccessData(null);
                  // Resetear formulario
                  resetForm();
                  // Y volver al primer paso.
                  irAPaso(0);
                }}
              >
                Crear otra vacante
              </Button>
            )}
            <Button iconoFinal={ArrowRight} onClick={() => router.push('/company/dashboard')}>
              Ir al panel
            </Button>
          </>
        }
      >
        {/* Créditos descontados (solo para publicación) */}
        {successData?.action === 'published' && successData.creditCost > 0 && (
          <p className="text-sm text-ink">
            Se han descontado{' '}
            <span className="font-display font-semibold tabular-nums text-ink">
              {successData.creditCost} créditos
            </span>{' '}
            de tu cuenta.
          </p>
        )}

        {/* Info del proceso (solo para publicación) */}
        {successData?.action === 'published' && (
          <div className="mt-4 rounded-lg border border-line bg-paper/60 p-4">
            <p className="flex items-center gap-2 font-display text-sm font-semibold text-ink">
              <Clock className="h-[18px] w-[18px] text-orange-dark" aria-hidden="true" />
              Tienes 4 horas para editar
            </p>
            <p className="mt-3 text-sm font-semibold text-ink">Próximos pasos:</p>
            <ol className="mt-2 space-y-2 text-sm text-ink">
              {[
                'Tu vacante será asignada a un reclutador',
                'El reclutador filtrará candidatos por perfil psicológico',
                'Un especialista evaluará las habilidades técnicas',
                'Recibirás los candidatos finales para entrevista'
              ].map((pasoProceso, i) => (
                <li key={pasoProceso} className="flex items-start gap-2.5">
                  <span
                    className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-teal font-display text-[11px] font-bold tabular-nums text-white"
                    aria-hidden="true"
                  >
                    {i + 1}
                  </span>
                  {pasoProceso}
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Mensaje para actualización: se usa el del servidor, que dice si
            se cobraron o devolvieron créditos por el cambio. */}
        {successData?.action === 'updated' && (
          <p className="text-sm text-ink">
            {successData.message || 'Los cambios se han guardado correctamente.'}
          </p>
        )}
      </Modal>
    </>
  );
};

export default CreateJobForm;
