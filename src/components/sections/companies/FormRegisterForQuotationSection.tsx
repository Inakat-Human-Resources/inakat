// RUTA: src/components/sections/companies/FormRegisterForQuotationSection.tsx
'use client';

import React, { useState, useRef, FormEvent, ChangeEvent } from 'react';
import { useLoadScript, GoogleMap, Marker, Autocomplete } from '@react-google-maps/api';

const libraries: ("places")[] = ["places"];
const mapContainerStyle = {
  width: '100%',
  height: '300px',
  borderRadius: '8px'
};
const defaultCenter = {
  lat: 19.4326, // CDMX por defecto
  lng: -99.1332
};

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

const FormRegisterForQuotationSection = () => {
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

  const fileInputIdRef = useRef<HTMLInputElement>(null);
  const fileInputDocRef = useRef<HTMLInputElement>(null);

  // Estados para Google Maps
  const [mapCenter, setMapCenter] = useState(defaultCenter);
  const [markerPosition, setMarkerPosition] = useState(defaultCenter);
  const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    libraries,
  });

  // Validaciones mejoradas
  const validateName = (value: string) =>
    /^[A-Za-zÁáÉéÍíÓóÚúÑñ\s]+$/.test(value);

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
      case 'apellidoMaterno':
        if (!validateName(value)) {
          newErrors[name] = 'Solo se permiten letras';
        } else {
          delete newErrors[name];
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
        if (formData.confirmPassword && value !== formData.confirmPassword) {
          newErrors.confirmPassword = 'Las contraseñas no coinciden';
        } else {
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

    if (file) {
      const newErrors = { ...errors };
      delete newErrors[fileType];
      setErrors(newErrors);
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

      // Validar tamaño de archivos (máximo 5MB)
      const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
      if (formData.identificacion.size > MAX_FILE_SIZE) {
        throw new Error('El archivo de identificación excede el tamaño máximo de 5MB');
      }
      if (formData.documentosConstitucion.size > MAX_FILE_SIZE) {
        throw new Error('Los documentos de constitución exceden el tamaño máximo de 5MB');
      }

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

      // Concatenar dirección para enviar al backend
      const direccionCompleta = `${formData.calle}, ${formData.colonia}, ${formData.ciudad}, CP ${formData.codigoPostal}`;

      const response = await fetch('/api/company-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: formData.nombre,
          apellidoPaterno: formData.apellidoPaterno,
          apellidoMaterno: formData.apellidoMaterno,
          departamento: formData.departamento || null,
          nombreEmpresa: formData.nombreEmpresa,
          correoEmpresa: formData.correoEmpresa,
          sitioWeb: formData.sitioWeb || null,
          razonSocial: formData.razonSocial,
          rfc: formData.rfc.toUpperCase(),
          direccionEmpresa: direccionCompleta,
          identificacionUrl: idData.url,
          documentosConstitucionUrl: docData.url,
          password: formData.password
        })
      });

      const data = await response.json();

      if (data.success) {
        setSubmitStatus({
          type: 'success',
          message: '¡Solicitud enviada exitosamente!'
        });

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
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        throw new Error(data.error || 'Error al enviar solicitud');
      }
    } catch (error) {
      // Scroll hacia arriba para mostrar el mensaje de error
      window.scrollTo({ top: 0, behavior: 'smooth' });

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

  return (
    <section
      id="register"
      className="bg-title-dark text-white bg-center py-20"
      suppressHydrationWarning
    >
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto bg-lemon-green p-8 rounded-2xl">
          <h2 className="text-3xl font-bold text-title-dark mb-12 text-center">
            ÚNETE HOY Y DESCUBRE CÓMO PODEMOS TRANSFORMAR TU EQUIPO
          </h2>

          {submitStatus.type && (
            <div
              className={`mb-6 p-4 rounded-lg ${
                submitStatus.type === 'success'
                  ? 'bg-green-100 text-green-800 border-2 border-green-500'
                  : 'bg-red-100 text-red-800 border-2 border-red-500'
              }`}
            >
              <p className="font-semibold">{submitStatus.message}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} suppressHydrationWarning>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <div className="mb-8">
                  <h3 className="font-bold text-lg mb-4">DATOS DEL USUARIO</h3>
                  <div className="space-y-4">
                    <div>
                      <input
                        type="text"
                        name="nombre"
                        value={formData.nombre}
                        onChange={handleInputChange}
                        placeholder="Nombre *"
                        className="w-full p-3 rounded-lg border border-gray-300 text-gray-700"
                        required
                      />
                      {errors.nombre && (
                        <span className="text-red-600 text-sm font-semibold block mt-1">
                          {errors.nombre}
                        </span>
                      )}
                    </div>

                    <div>
                      <input
                        type="text"
                        name="apellidoPaterno"
                        value={formData.apellidoPaterno}
                        onChange={handleInputChange}
                        placeholder="Apellido Paterno *"
                        className="w-full p-3 rounded-lg border border-gray-300 text-gray-700"
                        required
                      />
                      {errors.apellidoPaterno && (
                        <span className="text-red-600 text-sm font-semibold block mt-1">
                          {errors.apellidoPaterno}
                        </span>
                      )}
                    </div>

                    <div>
                      <input
                        type="text"
                        name="apellidoMaterno"
                        value={formData.apellidoMaterno}
                        onChange={handleInputChange}
                        placeholder="Apellido Materno *"
                        className="w-full p-3 rounded-lg border border-gray-300 text-gray-700"
                        required
                      />
                      {errors.apellidoMaterno && (
                        <span className="text-red-600 text-sm font-semibold block mt-1">
                          {errors.apellidoMaterno}
                        </span>
                      )}
                    </div>

                    <div>
                      <input
                        type="text"
                        name="departamento"
                        value={formData.departamento}
                        onChange={handleInputChange}
                        placeholder="Departamento de la empresa (ej: Recursos Humanos)"
                        className="w-full p-3 rounded-lg border border-gray-300 text-gray-700"
                      />
                    </div>

                    <div>
                      <label className="block mb-2 font-semibold">
                        Identificación *
                      </label>
                      <input
                        type="file"
                        ref={fileInputIdRef}
                        onChange={(e) => handleFileChange(e, 'identificacion')}
                        className="hidden"
                        accept=".pdf,.jpg,.jpeg,.png"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputIdRef.current?.click()}
                        className="bg-soft-green text-white py-3 px-6 rounded-xl hover:bg-green-700 w-full md:w-auto flex items-center justify-center transition-colors"
                      >
                        CARGAR DOCUMENTO <span className="ml-2">↑</span>
                      </button>
                      {formData.identificacion && (
                        <span className="text-sm text-gray-700 mt-2 block font-semibold">
                          ✓ {formData.identificacion.name}
                        </span>
                      )}
                      {errors.identificacion && (
                        <span className="text-red-600 text-sm font-semibold block mt-1">
                          {errors.identificacion}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mb-8">
                  <h3 className="font-bold text-lg mb-4">
                    GENERA TU CONTRASEÑA
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <input
                        type="password"
                        name="password"
                        value={formData.password}
                        onChange={handleInputChange}
                        placeholder="Genera tu contraseña *"
                        className="w-full p-3 rounded-lg border border-gray-300 text-gray-700"
                        required
                        minLength={6}
                      />
                    </div>

                    <div>
                      <input
                        type="password"
                        name="confirmPassword"
                        value={formData.confirmPassword}
                        onChange={handleInputChange}
                        placeholder="Confirma tu contraseña *"
                        className="w-full p-3 rounded-lg border border-gray-300 text-gray-700"
                        required
                      />
                      {errors.confirmPassword && (
                        <span className="text-red-600 text-sm font-semibold block mt-1">
                          {errors.confirmPassword}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-bold text-lg mb-4">DATOS DE LA EMPRESA</h3>
                <div className="space-y-4">
                  <div>
                    <input
                      type="text"
                      name="nombreEmpresa"
                      value={formData.nombreEmpresa}
                      onChange={handleInputChange}
                      placeholder="Nombre comercial *"
                      className="w-full p-3 rounded-lg border border-gray-300 text-gray-700"
                      required
                    />
                  </div>

                  <div>
                    <input
                      type="email"
                      name="correoEmpresa"
                      value={formData.correoEmpresa}
                      onChange={handleInputChange}
                      placeholder="Correo electrónico *"
                      className="w-full p-3 rounded-lg border border-gray-300 text-gray-700"
                      required
                    />
                    {errors.correoEmpresa && (
                      <span className="text-red-600 text-sm font-semibold block mt-1">
                        {errors.correoEmpresa}
                      </span>
                    )}
                  </div>

                  <div>
                    <input
                      type="text"
                      name="sitioWeb"
                      value={formData.sitioWeb}
                      onChange={handleInputChange}
                      placeholder="Sitio web (opcional)"
                      className="w-full p-3 rounded-lg border border-gray-300 text-gray-700"
                    />
                    {errors.sitioWeb && (
                      <span className="text-red-600 text-sm font-semibold block mt-1">
                        {errors.sitioWeb}
                      </span>
                    )}
                  </div>

                  <div>
                    <input
                      type="text"
                      name="razonSocial"
                      value={formData.razonSocial}
                      onChange={handleInputChange}
                      placeholder="Razón Social *"
                      className="w-full p-3 rounded-lg border border-gray-300 text-gray-700"
                      required
                    />
                  </div>

                  <div>
                    <input
                      type="text"
                      name="rfc"
                      value={formData.rfc}
                      onChange={handleInputChange}
                      placeholder="RFC *"
                      className="w-full p-3 rounded-lg border border-gray-300 text-gray-700 uppercase"
                      required
                      maxLength={13}
                    />
                    {errors.rfc && (
                      <span className="text-red-600 text-sm font-semibold block mt-1">
                        {errors.rfc}
                      </span>
                    )}
                  </div>

                  {/* Dirección desglosada */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <input
                        type="text"
                        name="calle"
                        value={formData.calle}
                        onChange={handleInputChange}
                        placeholder="Calle y número *"
                        className="w-full p-3 rounded-lg border border-gray-300 text-gray-700"
                        required
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        name="colonia"
                        value={formData.colonia}
                        onChange={handleInputChange}
                        placeholder="Colonia *"
                        className="w-full p-3 rounded-lg border border-gray-300 text-gray-700"
                        required
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        name="ciudad"
                        value={formData.ciudad}
                        onChange={handleInputChange}
                        placeholder="Ciudad *"
                        className="w-full p-3 rounded-lg border border-gray-300 text-gray-700"
                        required
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        name="codigoPostal"
                        value={formData.codigoPostal}
                        onChange={handleInputChange}
                        placeholder="Código Postal *"
                        className="w-full p-3 rounded-lg border border-gray-300 text-gray-700"
                        maxLength={5}
                        required
                      />
                    </div>
                  </div>

                  {/* Mapa de ubicación */}
                  <div className="mt-4">
                    <label className="block mb-2 text-sm font-semibold">
                      Ubicación en mapa
                    </label>

                    {loadError && (
                      <p className="text-red-500 text-sm">Error al cargar el mapa</p>
                    )}

                    {!isLoaded ? (
                      <div className="w-full h-[300px] bg-gray-200 rounded-lg flex items-center justify-center">
                        <p className="text-gray-500">Cargando mapa...</p>
                      </div>
                    ) : (
                      <>
                        {/* Campo de búsqueda con autocompletado */}
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
                            placeholder="Busca tu dirección..."
                            className="w-full p-3 rounded-lg border border-gray-300 text-gray-700 mb-3"
                          />
                        </Autocomplete>

                        {/* Mapa */}
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

                        <p className="text-xs text-gray-600 mt-2">
                          Puedes buscar tu dirección o hacer clic en el mapa para ajustar la ubicación
                        </p>
                      </>
                    )}
                  </div>

                  <div>
                    <label className="block mb-2 text-sm font-semibold">
                      Documentos *
                    </label>
                    <input
                      type="file"
                      ref={fileInputDocRef}
                      onChange={(e) =>
                        handleFileChange(e, 'documentosConstitucion')
                      }
                      className="hidden"
                      accept=".pdf,.jpg,.jpeg,.png"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputDocRef.current?.click()}
                      className="bg-soft-green text-white py-3 px-6 rounded-xl hover:bg-green-700 w-full md:w-auto flex items-center justify-center transition-colors"
                    >
                      CARGAR DOCUMENTO <span className="ml-2">↑</span>
                    </button>
                    {formData.documentosConstitucion && (
                      <span className="text-sm text-gray-700 mt-2 block font-semibold">
                        ✓ {formData.documentosConstitucion.name}
                      </span>
                    )}
                    {errors.documentosConstitucion && (
                      <span className="text-red-600 text-sm font-semibold block mt-1">
                        {errors.documentosConstitucion}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8">
              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-button-orange text-white py-3 px-12 rounded-lg hover:bg-orange-700 disabled:opacity-50 transition-colors font-semibold"
              >
                {isSubmitting ? 'ENVIANDO...' : 'ENVIAR →'}
              </button>
              <p className="text-xs mt-2 text-gray-700">
                *Al dar click, aceptas términos y condiciones.
              </p>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
};

export default FormRegisterForQuotationSection;
