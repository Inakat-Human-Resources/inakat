// RUTA: src/app/company/profile/page.tsx

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2,
  User,
  Mail,
  Globe,
  MapPin,
  FileText,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle,
  ArrowLeft,
  Camera
} from 'lucide-react';
import { useLoadScript, GoogleMap, Marker, Autocomplete } from '@react-google-maps/api';
import CompanyLogo from '@/components/shared/CompanyLogo';

// Configuración de Google Maps
const libraries: ("places")[] = ["places"];
const mapContainerStyle = {
  width: '100%',
  height: '250px',
  borderRadius: '8px'
};
const defaultCenter = {
  lat: 19.4326, // CDMX por defecto
  lng: -99.1332
};

interface CompanyProfile {
  userId: number;
  userEmail: string;
  userName: string;
  credits: number;
  representante: {
    nombre: string;
    apellidoPaterno: string;
    apellidoMaterno: string;
  };
  nombreEmpresa: string;
  correoEmpresa: string;
  sitioWeb: string | null;
  razonSocial: string;
  rfc: string;
  direccionEmpresa: string;
  latitud: number | null;
  longitud: number | null;
  logoUrl: string | null; // FEAT-1b: Logo de empresa
  status: string;
  createdAt: string;
  approvedAt: string | null;
}

interface FormData {
  // Representante
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  // Empresa
  nombreEmpresa: string;
  correoEmpresa: string;
  sitioWeb: string;
  razonSocial: string;
  direccionEmpresa: string;
  latitud: number | null;
  longitud: number | null;
}

export default function CompanyProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false); // FEAT-1b

  const [formData, setFormData] = useState<FormData>({
    nombre: '',
    apellidoPaterno: '',
    apellidoMaterno: '',
    nombreEmpresa: '',
    correoEmpresa: '',
    sitioWeb: '',
    razonSocial: '',
    direccionEmpresa: '',
    latitud: null,
    longitud: null
  });

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

        // Usar dirección completa
        const direccion = place.formatted_address || '';

        setFormData(prev => ({
          ...prev,
          direccionEmpresa: direccion,
          latitud: lat,
          longitud: lng
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
          const direccion = results[0].formatted_address || '';

          setFormData(prev => ({
            ...prev,
            direccionEmpresa: direccion,
            latitud: lat,
            longitud: lng
          }));
        }
      });
    }
  };

  // FEAT-1b: Manejar cambio de logo
  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setError('El logo no debe pesar más de 2MB');
      return;
    }

    setUploadingLogo(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });

      if (!uploadRes.ok) {
        throw new Error('Error al subir el logo');
      }

      const uploadData = await uploadRes.json();

      if (uploadData.url) {
        // Actualizar perfil con nuevo logo
        const updateRes = await fetch('/api/company/profile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ logoUrl: uploadData.url }),
        });

        if (updateRes.ok) {
          setSuccess('Logo actualizado exitosamente');
          // Actualizar el perfil local
          if (profile) {
            setProfile({ ...profile, logoUrl: uploadData.url });
          }
          setTimeout(() => setSuccess(null), 3000);
        } else {
          throw new Error('Error al actualizar el perfil');
        }
      }
    } catch (err) {
      setError('Error al cambiar el logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await fetch('/api/company/profile');

      if (response.status === 401) {
        router.push('/login?redirect=/company/profile');
        return;
      }

      if (response.status === 403) {
        setError('No tienes permisos para acceder a esta página');
        setLoading(false);
        return;
      }

      const result = await response.json();

      if (result.success) {
        setProfile(result.data);
        setFormData({
          nombre: result.data.representante.nombre || '',
          apellidoPaterno: result.data.representante.apellidoPaterno || '',
          apellidoMaterno: result.data.representante.apellidoMaterno || '',
          nombreEmpresa: result.data.nombreEmpresa || '',
          correoEmpresa: result.data.correoEmpresa || '',
          sitioWeb: result.data.sitioWeb || '',
          razonSocial: result.data.razonSocial || '',
          direccionEmpresa: result.data.direccionEmpresa || '',
          latitud: result.data.latitud || null,
          longitud: result.data.longitud || null
        });

        // Si hay coordenadas guardadas, centrar el mapa ahí
        if (result.data.latitud && result.data.longitud) {
          const savedPosition = {
            lat: result.data.latitud,
            lng: result.data.longitud
          };
          setMapCenter(savedPosition);
          setMarkerPosition(savedPosition);
        }
      } else {
        setError(result.error || 'Error al cargar el perfil');
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
      setError('Error al cargar el perfil');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/company/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const result = await response.json();

      if (result.success) {
        setSuccess('Perfil actualizado exitosamente');
        // Actualizar el perfil local
        if (profile) {
          setProfile({
            ...profile,
            representante: {
              nombre: formData.nombre,
              apellidoPaterno: formData.apellidoPaterno,
              apellidoMaterno: formData.apellidoMaterno
            },
            nombreEmpresa: formData.nombreEmpresa,
            correoEmpresa: formData.correoEmpresa,
            sitioWeb: formData.sitioWeb || null,
            razonSocial: formData.razonSocial,
            direccionEmpresa: formData.direccionEmpresa,
            latitud: formData.latitud,
            longitud: formData.longitud
          });
        }
        // Limpiar mensaje de éxito después de 3 segundos
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(result.error || 'Error al actualizar el perfil');
      }
    } catch (err) {
      console.error('Error updating profile:', err);
      setError('Error al actualizar el perfil');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-custom-beige">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-button-orange mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando perfil...</p>
        </div>
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-custom-beige">
        <div className="text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => router.push('/company/dashboard')}
            className="px-6 py-2 bg-button-orange text-white rounded-lg hover:bg-opacity-90 transition-colors"
          >
            Volver al Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-custom-beige py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header - Responsive */}
        <div className="mb-6 md:mb-8">
          <button
            onClick={() => router.push('/company/dashboard')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 text-sm md:text-base"
          >
            <ArrowLeft size={18} />
            Volver al Dashboard
          </button>
          <h1 className="text-2xl md:text-3xl font-bold text-title-dark flex items-center gap-2 md:gap-3">
            <Building2 className="text-button-green w-6 h-6 md:w-8 md:h-8" />
            Perfil de Empresa
          </h1>
          <p className="text-gray-600 mt-2 text-sm md:text-base">
            Actualiza la información de tu empresa
          </p>
        </div>

        {/* Mensajes de estado */}
        {error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-300 rounded-lg flex items-center gap-3 text-red-700">
            <AlertCircle size={20} />
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-100 border border-green-300 rounded-lg flex items-center gap-3 text-green-700">
            <CheckCircle size={20} />
            {success}
          </div>
        )}

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
          {/* Datos del Representante */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:p-6">
            <h2 className="text-base md:text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <User className="text-button-green" size={18} />
              Datos del Representante
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre
                </label>
                <input
                  type="text"
                  name="nombre"
                  value={formData.nombre}
                  onChange={handleChange}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-button-green focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Apellido Paterno
                </label>
                <input
                  type="text"
                  name="apellidoPaterno"
                  value={formData.apellidoPaterno}
                  onChange={handleChange}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-button-green focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Apellido Materno
                </label>
                <input
                  type="text"
                  name="apellidoMaterno"
                  value={formData.apellidoMaterno}
                  onChange={handleChange}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-button-green focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Datos de la Empresa */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:p-6">
            <h2 className="text-base md:text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Building2 className="text-button-green" size={18} />
              Datos de la Empresa
            </h2>
            <div className="space-y-4">
              {/* FEAT-1b: Logo de empresa */}
              <div className="flex items-center gap-4 pb-4 border-b border-gray-200">
                <div className="relative">
                  <CompanyLogo
                    logoUrl={profile?.logoUrl}
                    companyName={profile?.nombreEmpresa || 'Empresa'}
                    size="xl"
                  />
                  {uploadingLogo && (
                    <div className="absolute inset-0 bg-black bg-opacity-50 rounded-lg flex items-center justify-center">
                      <Loader2 className="animate-spin text-white" size={24} />
                    </div>
                  )}
                </div>
                <div>
                  <label className="cursor-pointer bg-white border border-gray-300 rounded-lg px-4 py-2 text-sm hover:bg-gray-50 inline-flex items-center gap-2">
                    <Camera size={16} />
                    {profile?.logoUrl ? 'Cambiar logo' : 'Subir logo'}
                    <input
                      type="file"
                      className="hidden"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleLogoChange}
                      disabled={uploadingLogo}
                    />
                  </label>
                  <p className="text-xs text-gray-400 mt-1">PNG, JPG o WebP. Máx 2MB.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre de Empresa *
                  </label>
                  <input
                    type="text"
                    name="nombreEmpresa"
                    value={formData.nombreEmpresa}
                    onChange={handleChange}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-button-green focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Razón Social *
                  </label>
                  <input
                    type="text"
                    name="razonSocial"
                    value={formData.razonSocial}
                    onChange={handleChange}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-button-green focus:border-transparent"
                    required
                  />
                </div>
              </div>

              {/* RFC - Solo lectura */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  RFC
                  <span className="ml-2 text-xs text-gray-500">(No editable)</span>
                </label>
                <div className="w-full p-3 bg-gray-100 border border-gray-300 rounded-lg text-gray-600 flex items-center gap-2">
                  <FileText size={16} className="text-gray-400" />
                  {profile?.rfc}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                    <Mail size={14} />
                    Correo de Empresa *
                  </label>
                  <input
                    type="email"
                    name="correoEmpresa"
                    value={formData.correoEmpresa}
                    onChange={handleChange}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-button-green focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                    <Globe size={14} />
                    Sitio Web
                  </label>
                  <input
                    type="url"
                    name="sitioWeb"
                    value={formData.sitioWeb}
                    onChange={handleChange}
                    placeholder="https://ejemplo.com"
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-button-green focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                  <MapPin size={14} />
                  Dirección de la Empresa *
                </label>

                {mapLoadError && (
                  <p className="text-red-500 text-sm mb-2">Error al cargar el mapa</p>
                )}

                {!isMapLoaded ? (
                  <div className="w-full h-[250px] bg-gray-100 rounded-lg flex items-center justify-center">
                    <p className="text-gray-500">Cargando mapa...</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Autocomplete de Google Places */}
                    <Autocomplete
                      onLoad={onAutocompleteLoad}
                      onPlaceChanged={onPlaceChanged}
                      options={{
                        componentRestrictions: { country: 'mx' },
                        types: ['address']
                      }}
                    >
                      <input
                        type="text"
                        value={formData.direccionEmpresa}
                        onChange={(e) =>
                          setFormData(prev => ({ ...prev, direccionEmpresa: e.target.value }))
                        }
                        placeholder="Busca tu dirección..."
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-button-green focus:border-transparent"
                        required
                      />
                    </Autocomplete>

                    {/* Mapa */}
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
                      Busca tu dirección o haz clic en el mapa para seleccionar la ubicación exacta
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Información adicional (solo lectura) */}
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-gray-600">
              <span className="font-medium">Cuenta creada:</span>{' '}
              {profile?.createdAt
                ? new Date(profile.createdAt).toLocaleDateString('es-MX', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })
                : '-'}
            </p>
            {profile?.approvedAt && (
              <p className="text-sm text-gray-600 mt-1">
                <span className="font-medium">Aprobada:</span>{' '}
                {new Date(profile.approvedAt).toLocaleDateString('es-MX', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
            )}
          </div>

          {/* Botón Guardar */}
          <div className="flex justify-center md:justify-end">
            <button
              type="submit"
              disabled={saving}
              className="w-full md:w-auto px-8 py-3 bg-button-green text-white font-bold rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  Guardando...
                </>
              ) : (
                <>
                  <Save size={20} />
                  Guardar Cambios
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
