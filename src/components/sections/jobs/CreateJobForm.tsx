// RUTA: src/components/sections/jobs/CreateJobForm.tsx

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  Coins,
  Save,
  Send,
  Calculator,
  ArrowLeft,
  Loader2,
  MapPin,
  X,
  Plus,
  CheckCircle,
  Clock
} from 'lucide-react';
import { useLoadScript, GoogleMap, Marker, Autocomplete } from '@react-google-maps/api';

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

const CreateJobForm = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editJobId = searchParams.get('edit');

  // Estado para modo edición
  const [isEditing, setIsEditing] = useState(false);
  const [isLoadingJob, setIsLoadingJob] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
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
    informacionAdicional: ''
  });

  // Opciones de nivel de estudios
  const EDUCATION_LEVELS = [
    'Sin requisito',
    'Primaria',
    'Secundaria',
    'Preparatoria/Bachillerato',
    'Licenciatura',
    'Maestría',
    'Doctorado'
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
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showInsufficientCreditsModal, setShowInsufficientCreditsModal] =
    useState(false);
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
  } | null>(null);

  // Estados para Google Maps
  const [mapCenter, setMapCenter] = useState(defaultCenter);
  const [markerPosition, setMarkerPosition] = useState(defaultCenter);
  const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);

  // Cargar Google Maps
  const { isLoaded: isMapLoaded, loadError: mapLoadError } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    libraries,
  });

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

        // Usar la dirección completa de Google Maps para mayor precisión
        const locationStr = place.formatted_address || `${ciudad}, ${estado}`;

        setFormData(prev => ({
          ...prev,
          location: locationStr
        }));
      }
    }
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

  // Limpiar subcategoría cuando cambia el perfil
  useEffect(() => {
    setFormData((prev) => ({ ...prev, subcategory: '' }));
  }, [formData.profile]);

  // Calcular costo cuando cambian los campos relevantes
  useEffect(() => {
    if (formData.profile && formData.seniority && formData.workMode) {
      calculateCost();
    } else {
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
        const parsedHabilidades = job.habilidades
          ? JSON.parse(job.habilidades)
          : [];

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
          informacionAdicional: job.informacionAdicional || ''
        });
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
      if (data.success) {
        setCalculatedCost(data.credits);
        setMinSalaryRequired(data.minSalary || null);
      }
    } catch {
      // Silent fail - cost remains at 0
    } finally {
      setIsCalculating(false);
    }
  };

  // Función de validación del formulario (BUG-02)
  const validateForm = (): boolean => {
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

  const handleSubmit = async (
    e: React.FormEvent,
    publishNow: boolean = false
  ) => {
    e.preventDefault();

    // Limpiar errores previos
    setFieldErrors({});

    // Validar formulario primero (BUG-02)
    if (!validateForm()) {
      return;
    }

    // Validar salarios
    const salaryMinNum = parseInt(formData.salaryMin) || 0;
    const salaryMaxNum = parseInt(formData.salaryMax) || 0;

    if (!salaryMinNum || !salaryMaxNum) {
      setSalaryError('Debes ingresar el salario mínimo y máximo');
      return;
    }

    if (salaryMinNum > salaryMaxNum) {
      setSalaryError('El salario mínimo no puede ser mayor al máximo');
      return;
    }

    if (salaryMaxNum - salaryMinNum > 10000) {
      setSalaryError('La diferencia máxima permitida es $10,000 MXN');
      return;
    }

    // Validar salario mínimo requerido para la especialidad
    if (minSalaryRequired && salaryMinNum < minSalaryRequired) {
      setSalaryError(`El salario mínimo debe ser al menos $${minSalaryRequired.toLocaleString('es-MX')} MXN para esta especialidad`);
      return;
    }

    setSalaryError(null);

    // Verificar créditos antes de publicar (solo para nuevas vacantes)
    if (!isEditing && publishNow && userInfo && userInfo.role !== 'admin') {
      if (userInfo.credits < calculatedCost) {
        setShowInsufficientCreditsModal(true);
        return;
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
          habilidades:
            formData.habilidades.length > 0 ? JSON.stringify(formData.habilidades) : null,
          publishNow: isEditing ? undefined : publishNow // No enviar publishNow en edición
        })
      });

      const data = await response.json();

      if (response.status === 402) {
        // Créditos insuficientes
        setShowInsufficientCreditsModal(true);
        return;
      }

      if (response.status === 403) {
        setSubmitStatus({
          type: 'error',
          message: 'No tienes permiso para editar esta vacante.'
        });
        return;
      }

      if (data.success) {
        if (isEditing) {
          // Para edición, mostrar modal de éxito
          setSuccessData({ creditCost: 0, action: 'updated' });
          setShowSuccessModal(true);
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
        } else {
          // Borrador guardado - redirigir directamente
          setSubmitStatus({
            type: 'draft',
            message: 'Vacante guardada como borrador. Redirigiendo...'
          });
          setTimeout(() => {
            router.push('/company/dashboard');
          }, 1500);
        }
      } else {
        throw new Error(
          data.error || `Error al ${isEditing ? 'actualizar' : 'crear'} vacante`
        );
      }
    } catch (error) {
      // Scroll hacia arriba para mostrar el mensaje de error
      window.scrollTo({ top: 0, behavior: 'smooth' });

      setSubmitStatus({
        type: 'error',
        message:
          error instanceof Error
            ? error.message
            : `Error al ${isEditing ? 'actualizar' : 'crear'} vacante`
      });
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
      informacionAdicional: ''
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

  // Mostrar loading mientras carga datos de vacante en modo edición
  if (isLoadingJob) {
    return (
      <div className="max-w-4xl mx-auto bg-white p-8 rounded-lg shadow-lg">
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="w-12 h-12 text-button-green animate-spin mb-4" />
          <p className="text-gray-600">Cargando datos de la vacante...</p>
        </div>
      </div>
    );
  }

  // Mostrar error si no se pudo cargar la vacante
  if (loadError) {
    return (
      <div className="max-w-4xl mx-auto bg-white p-8 rounded-lg shadow-lg">
        <div className="flex flex-col items-center justify-center py-12">
          <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Error al cargar
          </h2>
          <p className="text-gray-600 mb-6">{loadError}</p>
          <button
            onClick={() => router.push('/company/dashboard')}
            className="flex items-center gap-2 px-6 py-2 bg-button-green text-white rounded-lg hover:bg-green-700"
          >
            <ArrowLeft size={20} />
            Volver al Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto bg-white p-4 md:p-8 rounded-lg shadow-lg">
      {/* Header con créditos - Responsive */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-6">
        <div>
          {isEditing && (
            <button
              onClick={() => router.push('/company/dashboard')}
              className="flex items-center gap-1 text-gray-600 hover:text-gray-900 mb-2 text-sm"
            >
              <ArrowLeft size={16} />
              Volver al Dashboard
            </button>
          )}
          <h2 className="text-2xl md:text-3xl font-bold">
            {isEditing ? 'Editar Vacante' : 'Publicar Nueva Vacante'}
          </h2>
          <p className="text-gray-600 mt-1 text-sm md:text-base">
            {isEditing
              ? 'Modifica la información de la vacante'
              : 'Completa la información de la vacante'}
          </p>
        </div>

        {userInfo && userInfo.role !== 'admin' && !isEditing && (
          <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2 flex items-center justify-between sm:block sm:text-right">
            <p className="text-sm text-gray-600">Tus créditos</p>
            <p className="text-xl md:text-2xl font-bold text-green-600 flex items-center gap-1">
              <Coins size={20} className="md:w-6 md:h-6" />
              {userInfo.credits}
            </p>
          </div>
        )}
      </div>

      {/* Mensajes de estado */}
      {submitStatus.type && (
        <div
          className={`mb-6 p-4 rounded-lg flex items-center gap-2 ${
            submitStatus.type === 'success'
              ? 'bg-green-100 text-green-800 border-2 border-green-500'
              : submitStatus.type === 'draft'
              ? 'bg-blue-100 text-blue-800 border-2 border-blue-500'
              : 'bg-red-100 text-red-800 border-2 border-red-500'
          }`}
        >
          {submitStatus.type === 'success' && '✅'}
          {submitStatus.type === 'draft' && '📝'}
          {submitStatus.type === 'error' && '❌'}
          {submitStatus.message}
        </div>
      )}

      {/* Mensaje de errores de validación (BUG-02) */}
      {Object.keys(fieldErrors).length > 0 && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <p className="font-semibold text-red-700">
                Por favor corrige los siguientes errores:
              </p>
              <ul className="list-disc list-inside text-red-600 text-sm mt-1">
                {Object.values(fieldErrors).filter(Boolean).map((error, i) => (
                  <li key={i}>{error}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-6">
        {/* Título */}
        <div id="field-title">
          <label className="block text-sm font-semibold mb-2">
            Título del Puesto *
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => {
              setFormData({ ...formData, title: e.target.value });
              clearFieldError('title');
            }}
            placeholder="ej. Desarrollador Full Stack"
            className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-button-green focus:border-transparent ${
              fieldErrors.title ? 'border-red-500 bg-red-50' : 'border-gray-300'
            }`}
            required
          />
          {fieldErrors.title && (
            <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
              <AlertCircle size={14} />
              {fieldErrors.title}
            </p>
          )}
        </div>

        {/* Empresa y Ubicación */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div id="field-company">
            <label className="block text-sm font-semibold mb-2">
              Nombre de la Empresa *
            </label>
            {userInfo?.role === 'company' && userInfo?.companyName ? (
              // Campo readonly para empresas con nombre pre-cargado
              <div className="relative">
                <input
                  type="text"
                  value={formData.company}
                  readOnly
                  className={`w-full p-3 border rounded-lg bg-gray-100 text-gray-700 cursor-not-allowed ${
                    fieldErrors.company ? 'border-red-500' : 'border-gray-300'
                  }`}
                  required
                />
                <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded">
                  Auto
                </span>
              </div>
            ) : (
              // Campo editable para admin u otros roles
              <input
                type="text"
                value={formData.company}
                onChange={(e) => {
                  setFormData({ ...formData, company: e.target.value });
                  clearFieldError('company');
                }}
                placeholder="ej. Tech Corp"
                className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-button-green ${
                  fieldErrors.company ? 'border-red-500 bg-red-50' : 'border-gray-300'
                }`}
                required
              />
            )}
            {fieldErrors.company && (
              <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                <AlertCircle size={14} />
                {fieldErrors.company}
              </p>
            )}
          </div>

          <div id="field-location">
            <label className="block text-sm font-semibold mb-2">
              Ubicación *
            </label>

            {/* Campo de ubicación con mapa */}
            {mapLoadError && (
              <p className="text-red-500 text-sm mb-2">Error al cargar el mapa</p>
            )}

            {!isMapLoaded ? (
              // Loading state o input simple mientras carga
              <input
                type="text"
                value={formData.location}
                onChange={(e) => {
                  setFormData({ ...formData, location: e.target.value });
                  clearFieldError('location');
                }}
                placeholder="Cargando mapa... ej. Monterrey, Nuevo León"
                className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-button-green ${
                  fieldErrors.location ? 'border-red-500 bg-red-50' : 'border-gray-300'
                }`}
                required
              />
            ) : (
              <div className="space-y-3">
                {/* Autocomplete de Google Places */}
                <Autocomplete
                  onLoad={onAutocompleteLoad}
                  onPlaceChanged={() => {
                    onPlaceChanged();
                    clearFieldError('location');
                  }}
                  options={{
                    componentRestrictions: { country: 'mx' },
                    types: ['address']
                  }}
                >
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      type="text"
                      value={formData.location}
                      onChange={(e) => {
                        setFormData({ ...formData, location: e.target.value });
                        clearFieldError('location');
                      }}
                      placeholder="Busca una dirección..."
                      className={`w-full p-3 pl-10 border rounded-lg focus:ring-2 focus:ring-button-green ${
                        fieldErrors.location ? 'border-red-500 bg-red-50' : 'border-gray-300'
                      }`}
                      required
                    />
                  </div>
                </Autocomplete>

                {/* Mapa interactivo */}
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

                <p className="text-xs text-gray-500">
                  Busca la dirección o haz clic en el mapa para seleccionar la ubicación exacta
                </p>
              </div>
            )}
            {fieldErrors.location && (
              <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                <AlertCircle size={14} />
                {fieldErrors.location}
              </p>
            )}
          </div>
        </div>

        {/* Salario (Rango) */}
        <div id="field-salary">
          <label className="block text-sm font-semibold mb-2">
            Salario mensual (MXN) *
          </label>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                <input
                  type="number"
                  value={formData.salaryMin}
                  onChange={(e) => {
                    const newMin = e.target.value;
                    setFormData({ ...formData, salaryMin: newMin });
                    validateSalaryRange(newMin, formData.salaryMax);
                    clearFieldError('salary');
                  }}
                  placeholder="15,000"
                  className={`w-full p-3 pl-8 border rounded-lg focus:ring-2 focus:ring-button-green ${
                    salaryError || fieldErrors.salary ? 'border-red-500 bg-red-50' : 'border-gray-300'
                  }`}
                  min="0"
                  required
                />
              </div>
              <span className="text-xs text-gray-500 mt-1 block">Mínimo</span>
            </div>
            <div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                <input
                  type="number"
                  value={formData.salaryMax}
                  onChange={(e) => {
                    const newMax = e.target.value;
                    setFormData({ ...formData, salaryMax: newMax });
                    validateSalaryRange(formData.salaryMin, newMax);
                    clearFieldError('salary');
                  }}
                  placeholder="22,000"
                  className={`w-full p-3 pl-8 border rounded-lg focus:ring-2 focus:ring-button-green ${
                    salaryError || fieldErrors.salary ? 'border-red-500 bg-red-50' : 'border-gray-300'
                  }`}
                  min="0"
                  required
                />
              </div>
              <span className="text-xs text-gray-500 mt-1 block">Máximo</span>
            </div>
          </div>
          {fieldErrors.salary && !salaryError && (
            <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
              <AlertCircle size={14} />
              {fieldErrors.salary}
            </p>
          )}
          {salaryError && (
            <div className="flex items-center gap-2 mt-2 text-red-600 text-sm">
              <AlertCircle size={16} />
              {salaryError}
            </div>
          )}
          <p className="text-xs text-gray-500 mt-2">
            La diferencia máxima permitida entre mínimo y máximo es $10,000 MXN
          </p>
          {minSalaryRequired && (
            <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-700">
                <strong>Salario mínimo requerido:</strong> ${minSalaryRequired.toLocaleString('es-MX')} MXN/mes para esta especialidad
              </p>
            </div>
          )}
        </div>

        {/* Tipo de trabajo y Modalidad */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold mb-2">
              Tipo de Trabajo *
            </label>
            <select
              value={formData.jobType}
              onChange={(e) =>
                setFormData({ ...formData, jobType: e.target.value })
              }
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-button-green"
              required
            >
              <option value="Tiempo Completo">Tiempo Completo</option>
              <option value="Medio Tiempo">Medio Tiempo</option>
              <option value="Por Proyecto">Por Proyecto</option>
              <option value="Temporal">Temporal</option>
              <option value="Prácticas">Prácticas</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">
              Modalidad de Trabajo *
            </label>
            <select
              value={formData.workMode}
              onChange={(e) =>
                setFormData({ ...formData, workMode: e.target.value })
              }
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-button-green"
              required
            >
              <option value="presential">Presencial</option>
              <option value="hybrid">Híbrido</option>
              <option value="remote">Remoto</option>
            </select>
          </div>
        </div>

        {/* 🎯 SECCIÓN DE PRICING - Perfil y Seniority */}
        <div className="bg-gray-50 p-6 rounded-lg border-2 border-dashed border-gray-300">
          <div className="flex items-center gap-2 mb-4">
            <Calculator className="text-button-green" size={24} />
            <h3 className="text-lg font-bold">
              {isEditing ? 'Categorización' : 'Cálculo de Créditos'}
            </h3>
          </div>

          <p className="text-sm text-gray-600 mb-4">
            {isEditing
              ? 'Perfil y nivel de experiencia del puesto.'
              : 'El costo de publicación depende del perfil, nivel de experiencia y modalidad.'}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div id="field-profile">
              <label className="block text-sm font-semibold mb-2">
                Especialidad del Puesto *
              </label>
              <select
                value={formData.profile}
                onChange={(e) => {
                  setFormData({ ...formData, profile: e.target.value });
                  clearFieldError('profile');
                }}
                className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-button-green bg-white ${
                  fieldErrors.profile ? 'border-red-500 bg-red-50' : 'border-gray-300'
                }`}
                required
              >
                <option value="">Selecciona una especialidad</option>
                {specialties.map((specialty) => (
                  <option key={specialty.id} value={specialty.name}>
                    {specialty.icon ? `${specialty.icon} ` : ''}
                    {specialty.name}
                  </option>
                ))}
              </select>
              {fieldErrors.profile && (
                <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                  <AlertCircle size={14} />
                  {fieldErrors.profile}
                </p>
              )}
              {specialties.length === 0 && !fieldErrors.profile && (
                <p className="text-xs text-gray-500 mt-1">
                  Cargando especialidades...
                </p>
              )}
            </div>

            <div id="field-seniority">
              <label className="block text-sm font-semibold mb-2">
                Nivel de Experiencia *
              </label>
              <select
                value={formData.seniority}
                onChange={(e) => {
                  setFormData({ ...formData, seniority: e.target.value });
                  clearFieldError('seniority');
                }}
                className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-button-green bg-white ${
                  fieldErrors.seniority ? 'border-red-500 bg-red-50' : 'border-gray-300'
                }`}
                required
              >
                <option value="">Selecciona el nivel</option>
                {pricingOptions.seniorities.map((seniority) => (
                  <option key={seniority} value={seniority}>
                    {seniority}
                  </option>
                ))}
              </select>
              {fieldErrors.seniority && (
                <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                  <AlertCircle size={14} />
                  {fieldErrors.seniority}
                </p>
              )}
            </div>
          </div>

          {/* Sub-especialidad (si aplica) */}
          {(() => {
            const selectedSpecialty = specialties.find(
              (s) => s.name === formData.profile
            );
            const subcategories = selectedSpecialty?.subcategories || [];
            if (subcategories.length === 0) return null;

            return (
              <div className="mt-4">
                <label className="block text-sm font-semibold mb-2">
                  Sub-especialidad (opcional)
                </label>
                <select
                  value={formData.subcategory}
                  onChange={(e) =>
                    setFormData({ ...formData, subcategory: e.target.value })
                  }
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-button-green bg-white"
                >
                  <option value="">Selecciona una sub-especialidad</option>
                  {subcategories.map((sub) => (
                    <option key={sub} value={sub}>
                      {sub}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Especifica el área dentro de {formData.profile}
                </p>
              </div>
            );
          })()}

          {/* Nivel de estudios requerido */}
          <div className="mt-4">
            <label className="block text-sm font-semibold mb-2">
              Nivel de Estudios Requerido
            </label>
            <select
              value={formData.educationLevel}
              onChange={(e) =>
                setFormData({ ...formData, educationLevel: e.target.value })
              }
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-button-green bg-white"
            >
              <option value="">Selecciona el nivel de estudios</option>
              {EDUCATION_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Indica el nivel mínimo de estudios requerido para el puesto
            </p>
          </div>

          {/* Costo calculado - Solo mostrar para creación */}
          {!isEditing && calculatedCost > 0 && (
            <div
              className={`mt-4 p-4 rounded-lg flex items-center justify-between ${
                hasEnoughCredits
                  ? 'bg-green-100 border border-green-300'
                  : 'bg-red-100 border border-red-300'
              }`}
            >
              <div>
                <p className="font-semibold">Costo de publicación:</p>
                <p className="text-sm text-gray-600">
                  {formData.profile} • {formData.seniority} •{' '}
                  {workModeLabels[formData.workMode]}
                </p>
              </div>
              <div className="text-right">
                <p
                  className={`text-3xl font-bold ${
                    hasEnoughCredits ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {isCalculating ? '...' : calculatedCost}
                </p>
                <p className="text-sm text-gray-600">créditos</p>
              </div>
            </div>
          )}

          {!isEditing &&
            !hasEnoughCredits &&
            calculatedCost > 0 &&
            userInfo && (
              <div className="mt-3 flex items-center gap-2 text-red-600">
                <AlertCircle size={16} />
                <span className="text-sm">
                  Te faltan {calculatedCost - userInfo.credits} créditos para
                  publicar esta vacante
                </span>
              </div>
            )}
        </div>

        {/* Descripción */}
        <div id="field-description">
          <label className="block text-sm font-semibold mb-2">
            Descripción del Puesto *
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => {
              setFormData({ ...formData, description: e.target.value });
              clearFieldError('description');
            }}
            placeholder="Describe las responsabilidades, el ambiente de trabajo, beneficios, etc."
            rows={6}
            className={`w-full p-3 border rounded-lg resize-none focus:ring-2 focus:ring-button-green ${
              fieldErrors.description ? 'border-red-500 bg-red-50' : 'border-gray-300'
            }`}
            required
          />
          {fieldErrors.description && (
            <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
              <AlertCircle size={14} />
              {fieldErrors.description}
            </p>
          )}
        </div>

        {/* Requisitos */}
        <div>
          <label className="block text-sm font-semibold mb-2">
            Requisitos (opcional)
          </label>
          <textarea
            value={formData.requirements}
            onChange={(e) =>
              setFormData({ ...formData, requirements: e.target.value })
            }
            placeholder="Lista los requisitos, habilidades necesarias, experiencia, etc."
            rows={4}
            className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-button-green"
          />
        </div>

        {/* Sección: Habilidades Importantes (Chips libres) */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="font-semibold mb-3">
            Habilidades y Características Importantes
          </h3>
          <p className="text-sm text-gray-600 mb-3">
            Agrega las habilidades que deben tener mayor peso en la evaluación
          </p>

          {/* Input para agregar habilidad */}
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={habilidadInput}
              onChange={(e) => setHabilidadInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const trimmed = habilidadInput.trim();
                  if (trimmed && !formData.habilidades.includes(trimmed)) {
                    setFormData((prev) => ({
                      ...prev,
                      habilidades: [...prev.habilidades, trimmed]
                    }));
                    setHabilidadInput('');
                  }
                }
              }}
              placeholder="Escribe una habilidad..."
              className="flex-1 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-button-green focus:border-transparent text-sm"
            />
            <button
              type="button"
              onClick={() => {
                const trimmed = habilidadInput.trim();
                if (trimmed && !formData.habilidades.includes(trimmed)) {
                  setFormData((prev) => ({
                    ...prev,
                    habilidades: [...prev.habilidades, trimmed]
                  }));
                  setHabilidadInput('');
                }
              }}
              className="px-4 py-2 bg-button-green text-white rounded-lg hover:bg-green-700 flex items-center gap-1 text-sm font-medium"
            >
              <Plus size={16} />
              Agregar
            </button>
          </div>

          {/* Lista de chips */}
          {formData.habilidades.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {formData.habilidades.map((hab, index) => (
                <span
                  key={index}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-button-green text-white rounded-full text-sm"
                >
                  {hab}
                  <button
                    type="button"
                    onClick={() => {
                      setFormData((prev) => ({
                        ...prev,
                        habilidades: prev.habilidades.filter((_, i) => i !== index)
                      }));
                    }}
                    className="hover:bg-green-800 rounded-full p-0.5"
                  >
                    <X size={14} />
                  </button>
                </span>
              ))}
            </div>
          )}

          <p className="text-xs text-gray-500 mt-3">
            Escribe una habilidad y presiona Enter o click en Agregar
          </p>
        </div>

        {/* Responsabilidades Específicas */}
        <div>
          <label className="block text-sm font-semibold mb-1">
            Responsabilidades Específicas
          </label>
          <p className="text-xs text-gray-500 mb-2">
            Describe qué actividades o funciones realizará el candidato
          </p>
          <textarea
            value={formData.responsabilidades}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                responsabilidades: e.target.value
              }))
            }
            rows={3}
            placeholder="Ej: coordinar campañas digitales, revisar facturación mensual, dar seguimiento a clientes..."
            className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-button-green"
          />
        </div>

        {/* Resultados Esperados */}
        <div>
          <label className="block text-sm font-semibold mb-1">
            Resultados Esperados (3-6 meses)
          </label>
          <p className="text-xs text-gray-500 mb-2">
            Indica metas, entregables o indicadores clave de éxito
          </p>
          <textarea
            value={formData.resultadosEsperados}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                resultadosEsperados: e.target.value
              }))
            }
            rows={3}
            placeholder="Ej: Reducir errores operativos, aumentar clientes activos, implementar sistema de gestión..."
            className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-button-green"
          />
        </div>

        {/* Valores y Actitudes */}
        <div>
          <label className="block text-sm font-semibold mb-1">
            Valores y Actitudes Esenciales
          </label>
          <p className="text-xs text-gray-500 mb-2">
            Ayúdanos a encontrar a alguien que encaje con tu cultura
          </p>
          <textarea
            value={formData.valoresActitudes}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                valoresActitudes: e.target.value
              }))
            }
            rows={2}
            placeholder="Ej: Honestidad, disposición al cambio, orientación a resultados, atención al detalle..."
            className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-button-green"
          />
        </div>

        {/* Información Adicional */}
        <div>
          <label className="block text-sm font-semibold mb-1">
            Información Adicional (Opcional)
          </label>
          <textarea
            value={formData.informacionAdicional}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                informacionAdicional: e.target.value
              }))
            }
            rows={2}
            placeholder="Aspectos técnicos, contextuales o estratégicos adicionales..."
            className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-button-green"
          />
        </div>

        {/* Botones de acción - Stack en móvil, row en desktop */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-4">
          {isEditing ? (
            <>
              {/* Botón cancelar para edición */}
              <button
                type="button"
                onClick={() => router.push('/company/dashboard')}
                disabled={isSubmitting}
                className="flex-1 bg-gray-200 text-gray-700 font-bold py-3 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 order-2 sm:order-1"
              >
                Cancelar
              </button>
              {/* Botón guardar cambios */}
              <button
                type="submit"
                disabled={isSubmitting || !!salaryError}
                className="flex-1 bg-button-green text-white font-bold py-3 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 order-1 sm:order-2"
              >
                <Save size={20} />
                {isSubmitting ? 'GUARDANDO...' : 'GUARDAR CAMBIOS'}
              </button>
            </>
          ) : (
            <>
              {/* Publicar ahora - Primero en móvil */}
              <button
                type="button"
                onClick={(e) => handleSubmit(e, true)}
                disabled={isSubmitting || !calculatedCost || !!salaryError}
                className={`flex-1 font-bold py-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 order-1 sm:order-2 ${
                  hasEnoughCredits
                    ? 'bg-button-green text-white hover:bg-green-700'
                    : 'bg-orange-500 text-white hover:bg-orange-600'
                }`}
              >
                <Send size={20} />
                <span className="hidden sm:inline">
                  {isSubmitting
                    ? 'PUBLICANDO...'
                    : hasEnoughCredits
                    ? `PUBLICAR (${calculatedCost} créditos)`
                    : 'COMPRAR CRÉDITOS'}
                </span>
                <span className="sm:hidden">
                  {isSubmitting
                    ? 'PUBLICANDO...'
                    : hasEnoughCredits
                    ? `PUBLICAR (${calculatedCost})`
                    : 'COMPRAR CRÉDITOS'}
                </span>
              </button>

              {/* Guardar como borrador */}
              <button
                type="submit"
                disabled={isSubmitting || !!salaryError}
                className="flex-1 bg-gray-600 text-white font-bold py-3 rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 order-2 sm:order-1"
              >
                <Save size={20} />
                {isSubmitting ? 'GUARDANDO...' : 'GUARDAR BORRADOR'}
              </button>
            </>
          )}
        </div>
      </form>

      {/* Modal de créditos insuficientes */}
      {showInsufficientCreditsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-md mx-4">
            <div className="text-center">
              <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <AlertCircle className="text-red-600" size={32} />
              </div>
              <h3 className="text-xl font-bold mb-2">Créditos Insuficientes</h3>
              <p className="text-gray-600 mb-4">
                Necesitas <strong>{calculatedCost} créditos</strong> para
                publicar esta vacante.
                <br />
                Actualmente tienes{' '}
                <strong>{userInfo?.credits || 0} créditos</strong>.
              </p>
              <p className="text-sm text-gray-500 mb-6">
                Te faltan{' '}
                <strong className="text-red-600">
                  {calculatedCost - (userInfo?.credits || 0)} créditos
                </strong>
                .
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowInsufficientCreditsModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => router.push('/credits/purchase')}
                  className="flex-1 px-4 py-2 bg-button-green text-white rounded-lg hover:bg-green-700 font-semibold"
                >
                  Comprar Créditos
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de éxito al publicar/actualizar (BUG-03) */}
      {showSuccessModal && successData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 md:p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="text-center">
              {/* Icono de éxito */}
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="text-green-600" size={40} />
              </div>

              {/* Título según acción */}
              <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">
                {successData.action === 'published'
                  ? '¡Tu vacante ha sido publicada!'
                  : '¡Vacante actualizada exitosamente!'}
              </h3>

              {/* Créditos descontados (solo para publicación) */}
              {successData.action === 'published' && successData.creditCost > 0 && (
                <p className="text-gray-600 mb-6">
                  Se han descontado{' '}
                  <span className="font-semibold text-button-green">
                    {successData.creditCost} créditos
                  </span>{' '}
                  de tu cuenta.
                </p>
              )}

              {/* Info del proceso (solo para publicación) */}
              {successData.action === 'published' && (
                <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className="text-button-orange" size={20} />
                    <span className="font-semibold text-gray-700">
                      Tienes 4 horas para editar
                    </span>
                  </div>

                  <p className="text-sm text-gray-600 mb-3">
                    <strong>Próximos pasos:</strong>
                  </p>
                  <ol className="text-sm text-gray-600 space-y-2">
                    <li className="flex items-start gap-2">
                      <span className="bg-button-green text-white rounded-full w-5 h-5 flex items-center justify-center text-xs flex-shrink-0">
                        1
                      </span>
                      Tu vacante será asignada a un reclutador
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="bg-button-green text-white rounded-full w-5 h-5 flex items-center justify-center text-xs flex-shrink-0">
                        2
                      </span>
                      El reclutador filtrará candidatos por perfil psicológico
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="bg-button-green text-white rounded-full w-5 h-5 flex items-center justify-center text-xs flex-shrink-0">
                        3
                      </span>
                      Un especialista evaluará las habilidades técnicas
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="bg-button-green text-white rounded-full w-5 h-5 flex items-center justify-center text-xs flex-shrink-0">
                        4
                      </span>
                      Recibirás los candidatos finales para entrevista
                    </li>
                  </ol>
                </div>
              )}

              {/* Mensaje para actualización */}
              {successData.action === 'updated' && (
                <p className="text-gray-600 mb-6">
                  Los cambios se han guardado correctamente.
                </p>
              )}

              {/* Botones */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => router.push('/company/dashboard')}
                  className="flex-1 px-6 py-3 bg-button-green text-white font-bold rounded-lg hover:bg-green-700 transition-colors"
                >
                  Ir al Dashboard
                </button>
                {successData.action === 'published' && (
                  <button
                    onClick={() => {
                      setShowSuccessModal(false);
                      setSuccessData(null);
                      // Resetear formulario
                      resetForm();
                    }}
                    className="flex-1 px-6 py-3 border-2 border-button-green text-button-green font-bold rounded-lg hover:bg-green-50 transition-colors"
                  >
                    Crear otra vacante
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateJobForm;
