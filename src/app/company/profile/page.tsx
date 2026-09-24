// RUTA: src/app/company/profile/page.tsx

'use client';

/**
 * Perfil de la empresa: representante, datos fiscales y de contacto, dirección
 * con mapa y logo.
 *
 * Registro de aplicación (docs/DISENO.md). Misma carga, mismo PUT con el mismo
 * cuerpo, misma subida del logo y el mismo mapa de Google; cambió la
 * presentación: campos con etiqueta visible (FormField), tarjetas por tema, una
 * columna con el logo y el estado de la cuenta, y la barra de «Guardar
 * cambios» fija abajo para no tener que bajar hasta el final del formulario.
 * Si Google Maps no se puede usar, en lugar del mapa (y del diálogo de error
 * de Google) sale un respaldo propio con la dirección guardada en texto.
 */

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  Camera,
  FileText,
  Globe,
  Loader2,
  Mail,
  MapPin,
  RefreshCw,
  Save,
} from 'lucide-react';
import { useLoadScript, GoogleMap, Marker, Autocomplete } from '@react-google-maps/api';
import CompanyLogo from '@/components/shared/CompanyLogo';
import MapaNoDisponible from '@/components/company/MapaNoDisponible';
import { useFalloMapa } from '@/hooks/useFalloMapa';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import FormField, { Input } from '@/components/ui/FormField';
import Button, { clasesBoton } from '@/components/ui/Button';
import StatusBadge from '@/components/ui/Badge';
import Toast from '@/components/ui/Toast';
import Skeleton, { SkeletonPagina } from '@/components/ui/Skeleton';
import { notifyAuthChanged } from '@/lib/auth-events';
import { cn } from '@/lib/utils';
import { fechaCorta, fechaLarga } from '@/lib/fechas';

// Configuración de Google Maps
const libraries: ("places")[] = ["places"];
const mapContainerStyle = {
  width: '100%',
  height: '260px',
  borderRadius: '12px'
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

  // ¿Se puede usar el mapa? Sin clave, sin script (loadError) o con la clave
  // rechazada por Google (facturación apagada, dominio no permitido: el
  // script carga pero Google tapa el mapa con su diálogo y apaga el
  // autocompletado). En los tres casos se pinta el respaldo propio en vez del
  // mapa. Presentación: el formulario y el PUT no cambian.
  const contenedorMapaRef = useRef<HTMLDivElement>(null);
  const sinClaveMapa = !process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const claveRechazada = useFalloMapa(contenedorMapaRef, isMapLoaded && !loading && !sinClaveMapa && !mapLoadError);
  const mapaNoDisponible = sinClaveMapa || Boolean(mapLoadError) || claveRechazada;

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
        // El nombre del representante también es el de la cuenta (la API
        // actualiza User.nombre): la tarjeta de usuario del AppShell se
        // refresca sin esperar a cambiar de página (docs/DISENO.md §4).
        notifyAuthChanged();
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
    return <SkeletonPagina conCifras={false} />;
  }

  if (error && !profile) {
    return (
      <>
        <PageHeader antetitulo="Empresa" titulo="Perfil de empresa" />
        <div
          role="alert"
          className="flex flex-col gap-4 rounded-xl border border-danger/30 bg-danger-tint p-5 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="flex items-start gap-3 font-medium text-danger-dark">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-none" aria-hidden="true" />
            {error}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variante="contorno"
              icono={RefreshCw}
              onClick={() => {
                setError(null);
                setLoading(true);
                fetchProfile();
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

  return (
    <>
      <PageHeader
        antetitulo="Empresa"
        titulo="Perfil de empresa"
        descripcion="Actualiza la información de tu empresa. Es la que INAKAT usa para tus vacantes y tu facturación."
      />

      {/* Formulario */}
      <form onSubmit={handleSubmit}>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="min-w-0 space-y-6">
            {/* Datos del Representante */}
            <Card titulo="Datos del representante" descripcion="La persona que trata con INAKAT en nombre de la empresa.">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <FormField etiqueta="Nombre" requerido>
                  <Input
                    type="text"
                    name="nombre"
                    value={formData.nombre}
                    onChange={handleChange}
                    autoComplete="given-name"
                  />
                </FormField>
                <FormField etiqueta="Apellido paterno" requerido>
                  <Input
                    type="text"
                    name="apellidoPaterno"
                    value={formData.apellidoPaterno}
                    onChange={handleChange}
                    autoComplete="family-name"
                  />
                </FormField>
                <FormField etiqueta="Apellido materno" opcional>
                  <Input
                    type="text"
                    name="apellidoMaterno"
                    value={formData.apellidoMaterno}
                    onChange={handleChange}
                  />
                </FormField>
              </div>
            </Card>

            {/* Datos de la Empresa */}
            <Card titulo="Datos de la empresa" descripcion="Nombre comercial, razón social y contacto.">
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <FormField etiqueta="Nombre de empresa" requerido>
                    <Input
                      type="text"
                      name="nombreEmpresa"
                      value={formData.nombreEmpresa}
                      onChange={handleChange}
                      autoComplete="organization"
                    />
                  </FormField>
                  <FormField etiqueta="Razón social" requerido>
                    <Input
                      type="text"
                      name="razonSocial"
                      value={formData.razonSocial}
                      onChange={handleChange}
                    />
                  </FormField>
                </div>

                {/* RFC - Solo lectura */}
                <FormField etiqueta="RFC" ayuda="El RFC identifica a tu empresa y no se puede editar.">
                  <Input
                    type="text"
                    value={profile?.rfc ?? ''}
                    readOnly
                    prefijo={<FileText />}
                    className="bg-mist text-ink-muted hover:border-line-strong focus:ring-0"
                  />
                </FormField>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <FormField etiqueta="Correo de empresa" requerido>
                    <Input
                      type="email"
                      name="correoEmpresa"
                      value={formData.correoEmpresa}
                      onChange={handleChange}
                      autoComplete="email"
                      prefijo={<Mail />}
                    />
                  </FormField>
                  <FormField etiqueta="Sitio web" opcional ayuda="Con https://, por ejemplo https://ejemplo.com">
                    <Input
                      type="url"
                      name="sitioWeb"
                      value={formData.sitioWeb}
                      onChange={handleChange}
                      placeholder="https://ejemplo.com"
                      autoComplete="url"
                      prefijo={<Globe />}
                    />
                  </FormField>
                </div>
              </div>
            </Card>

            {/* Dirección */}
            <Card titulo="Dirección de la empresa" descripcion="Se usa para calcular la distancia de cada candidato a tus vacantes.">
              {mapaNoDisponible ? (
                <MapaNoDisponible
                  direccion={formData.direccionEmpresa}
                  conUbicacion={formData.latitud != null && formData.longitud != null}
                />
              ) : !isMapLoaded ? (
                <div className="space-y-3" role="status">
                  <Skeleton className="h-10 w-full rounded-lg" />
                  <div className="flex h-[260px] w-full items-center justify-center rounded-xl bg-mist">
                    <p className="flex items-center gap-2 text-sm text-ink-muted">
                      <MapPin className="h-4 w-4" aria-hidden="true" />
                      Cargando mapa...
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Autocomplete de Google Places */}
                  <FormField
                    etiqueta="Dirección"
                    requerido
                    ayuda="Busca tu dirección o haz clic en el mapa para seleccionar la ubicación exacta"
                  >
                    <Autocomplete
                      onLoad={onAutocompleteLoad}
                      onPlaceChanged={onPlaceChanged}
                      options={{
                        componentRestrictions: { country: 'mx' },
                        types: ['address']
                      }}
                    >
                      <Input
                        type="text"
                        value={formData.direccionEmpresa}
                        onChange={(e) =>
                          setFormData(prev => ({ ...prev, direccionEmpresa: e.target.value }))
                        }
                        placeholder="Busca tu dirección..."
                        prefijo={<MapPin />}
                      />
                    </Autocomplete>
                  </FormField>

                  {/* Mapa (su envoltorio es donde useFalloMapa busca el aviso de Google) */}
                  <div ref={contenedorMapaRef} className="overflow-hidden rounded-xl border border-line">
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
                  </div>
                </div>
              )}
            </Card>
          </div>

          {/* Columna lateral: logo y cuenta */}
          <div className="min-w-0 space-y-6">
            {/* FEAT-1b: Logo de empresa */}
            <Card titulo="Logo" descripcion="Aparece en tus vacantes y en tu panel.">
              <div className="flex items-center gap-4 xl:flex-col xl:items-start">
                <div className="relative">
                  <CompanyLogo
                    logoUrl={profile?.logoUrl}
                    companyName={profile?.nombreEmpresa || 'Empresa'}
                    size="xl"
                    className="border border-line"
                  />
                  {uploadingLogo && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-ink/60" role="status">
                      <Loader2 className="animate-spin text-white" size={24} aria-hidden="true" />
                      <span className="sr-only">Subiendo logo…</span>
                    </div>
                  )}
                </div>
                <div>
                  {/* El input va dentro de la etiqueta y con sr-only (no hidden): así
                      se alcanza con el teclado y el anillo de foco se ve en el botón. */}
                  <label
                    className={cn(
                      clasesBoton({ variante: 'contorno', tamano: 'sm' }),
                      // ring y no outline: cn (tailwind-merge 3) descarta `outline` junto a `outline-2`.
                      'cursor-pointer focus-within:ring-2 focus-within:ring-teal focus-within:ring-offset-2',
                      uploadingLogo && 'pointer-events-none opacity-50'
                    )}
                  >
                    <Camera aria-hidden="true" />
                    {profile?.logoUrl ? 'Cambiar logo' : 'Subir logo'}
                    <input
                      type="file"
                      className="sr-only"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleLogoChange}
                      disabled={uploadingLogo}
                    />
                  </label>
                  <p className="mt-1.5 text-xs text-ink-muted">PNG, JPG o WebP. Máx 2MB.</p>
                </div>
              </div>
            </Card>

            {/* Información adicional (solo lectura) */}
            <Card titulo="Tu cuenta">
              <dl className="space-y-3 text-sm">
                {profile?.status && (
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-ink-muted">Estado</dt>
                    <dd>
                      <StatusBadge estado={profile.status} contexto="solicitud" />
                    </dd>
                  </div>
                )}
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-ink-muted">Cuenta creada</dt>
                  <dd
                    className="text-right font-medium tabular-nums text-ink"
                    title={profile?.createdAt ? fechaLarga(profile.createdAt) : undefined}
                  >
                    {fechaCorta(profile?.createdAt)}
                  </dd>
                </div>
                {profile?.approvedAt && (
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-ink-muted">Aprobada</dt>
                    <dd className="text-right font-medium tabular-nums text-ink" title={fechaLarga(profile.approvedAt)}>
                      {fechaCorta(profile.approvedAt)}
                    </dd>
                  </div>
                )}
                {profile?.userEmail && (
                  <div className="flex items-start justify-between gap-3">
                    <dt className="text-ink-muted">Acceso</dt>
                    <dd className="min-w-0 break-all text-right font-medium text-ink">{profile.userEmail}</dd>
                  </div>
                )}
              </dl>
            </Card>
          </div>
        </div>

        {/* Botón Guardar: barra fija abajo mientras se edita el formulario */}
        <div className="sticky bottom-0 z-20 -mx-4 mt-6 flex items-center justify-between gap-3 border-t border-line bg-paper/95 px-4 py-3 backdrop-blur-sm sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <p className="hidden text-[13px] text-ink-muted sm:block">
            Los campos con <span className="text-danger" aria-hidden="true">*</span>
            <span className="sr-only">asterisco</span> son obligatorios.
          </p>
          <Button
            type="submit"
            icono={Save}
            cargando={saving}
            textoCargando="Guardando..."
            className="w-full sm:w-auto"
          >
            Guardar cambios
          </Button>
        </div>
      </form>

      {/* Mensajes de estado: arriba y a la vista, estés donde estés del formulario. */}
      <Toast tono="error" mensaje={error} alCerrar={() => setError(null)} duracion={0} />
      <Toast tono="exito" mensaje={success} alCerrar={() => setSuccess(null)} duracion={0} />
    </>
  );
}
