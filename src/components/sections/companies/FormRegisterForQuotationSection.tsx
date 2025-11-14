'use client';

import React, { useState, useRef, FormEvent, ChangeEvent } from 'react';

interface FormData {
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  identificacion: File | null;
  password: string;
  confirmPassword: string;
  nombreEmpresa: string;
  correoEmpresa: string;
  sitioWeb: string;
  razonSocial: string;
  rfc: string;
  direccionEmpresa: string;
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
    identificacion: null,
    password: '',
    confirmPassword: '',
    nombreEmpresa: '',
    correoEmpresa: '',
    sitioWeb: '',
    razonSocial: '',
    rfc: '',
    direccionEmpresa: '',
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

  // =============================================
  // VALIDACIONES MEJORADAS
  // =============================================

  const validateName = (value: string) =>
    /^[A-Za-zÁáÉéÍíÓóÚúÑñ\s]+$/.test(value);

  const validateEmail = (email: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const validateURL = (url: string) => {
    if (!url) return true; // Si está vacío, es válido (no es required)
    // Acepta URLs con o sin protocolo
    const urlPattern =
      /^(https?:\/\/)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/;
    return urlPattern.test(url);
  };

  const validateRFC = (rfc: string) => {
    if (!rfc) return false;
    // RFC más flexible - acepta formato estándar mexicano
    const rfcPattern = /^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$/;
    return rfcPattern.test(rfc.toUpperCase());
  };

  // =============================================
  // MANEJO DE CAMBIOS EN INPUTS
  // =============================================

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Validaciones en tiempo real
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
        // Solo validar si hay un valor
        if (value && !validateURL(value)) {
          newErrors.sitioWeb =
            'URL inválida. Ejemplo: www.empresa.com o https://empresa.com';
        } else {
          delete newErrors.sitioWeb;
        }
        break;

      case 'rfc':
        const upperRFC = value.toUpperCase();
        if (!validateRFC(upperRFC)) {
          newErrors.rfc = 'RFC inválido. Formato: ABC123456XYZ (13 caracteres)';
        } else {
          delete newErrors.rfc;
        }
        break;

      case 'password':
        // Validar cuando cambian el password
        if (formData.confirmPassword && value !== formData.confirmPassword) {
          newErrors.confirmPassword = 'Las contraseñas no coinciden';
        } else {
          delete newErrors.confirmPassword;
        }
        break;

      case 'confirmPassword':
        // Comparar con el value actual, no con formData.confirmPassword
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

    // Actualizar el archivo en el estado
    setFormData((prev) => ({
      ...prev,
      [fileType]: file
    }));

    // IMPORTANTE: Limpiar el error cuando se selecciona un archivo
    if (file) {
      const newErrors = { ...errors };
      delete newErrors[fileType];
      setErrors(newErrors);
    }
  };

  // =============================================
  // ENVÍO DEL FORMULARIO
  // =============================================

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Limpiar errores previos de archivos
    const newErrors = { ...errors };
    delete newErrors.identificacion;
    delete newErrors.documentosConstitucion;

    // Validar que los archivos estén presentes
    if (!formData.identificacion) {
      setErrors({
        ...errors,
        identificacion: 'La identificación es requerida'
      });
      return;
    }

    if (!formData.documentosConstitucion) {
      setErrors({
        ...errors,
        documentosConstitucion: 'Los documentos son requeridos'
      });
      return;
    }

    // Validar que no haya errores
    if (Object.keys(errors).length > 0) {
      setSubmitStatus({
        type: 'error',
        message: 'Por favor corrige los errores en el formulario'
      });
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus({ type: null, message: '' });

    try {
      // 1. Subir identificación
      const idFormData = new FormData();
      idFormData.append('file', formData.identificacion);

      const idUploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: idFormData
      });

      if (!idUploadRes.ok) {
        const errorData = await idUploadRes.json();
        throw new Error(errorData.error || 'Error al subir identificación');
      }

      const idData = await idUploadRes.json();

      // 2. Subir documentos de constitución
      const docFormData = new FormData();
      docFormData.append('file', formData.documentosConstitucion);

      const docUploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: docFormData
      });

      if (!docUploadRes.ok) {
        const errorData = await docUploadRes.json();
        throw new Error(errorData.error || 'Error al subir documentos');
      }

      const docData = await docUploadRes.json();

      // 3. Enviar solicitud con las URLs de los archivos
      const response = await fetch('/api/company-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: formData.nombre,
          apellidoPaterno: formData.apellidoPaterno,
          apellidoMaterno: formData.apellidoMaterno,
          nombreEmpresa: formData.nombreEmpresa,
          correoEmpresa: formData.correoEmpresa,
          sitioWeb: formData.sitioWeb || null,
          razonSocial: formData.razonSocial,
          rfc: formData.rfc.toUpperCase(),
          direccionEmpresa: formData.direccionEmpresa,
          identificacionUrl: idData.url,
          documentosConstitucionUrl: docData.url
        })
      });

      const data = await response.json();

      if (data.success) {
        setSubmitStatus({
          type: 'success',
          message:
            '¡Solicitud enviada exitosamente! Revisaremos tu información y te contactaremos pronto.'
        });

        // Resetear formulario
        setFormData({
          nombre: '',
          apellidoPaterno: '',
          apellidoMaterno: '',
          identificacion: null,
          password: '',
          confirmPassword: '',
          nombreEmpresa: '',
          correoEmpresa: '',
          sitioWeb: '',
          razonSocial: '',
          rfc: '',
          direccionEmpresa: '',
          documentosConstitucion: null
        });

        // Limpiar errores
        setErrors({});

        // Scroll al mensaje de éxito
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        throw new Error(data.error || 'Error al enviar solicitud');
      }
    } catch (error) {
      console.error('Error:', error);
      setSubmitStatus({
        type: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Error al procesar la solicitud. Por favor intenta de nuevo.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section id="register" className="bg-title-dark text-white bg-center py-20">
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

          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* COLUMNA IZQUIERDA */}
              <div>
                {/* DATOS DEL USUARIO */}
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
                      <label className="block mb-2 font-semibold">
                        Identificación (INE, licencia, pasaporte) *
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
                          ✓ Archivo seleccionado: {formData.identificacion.name}
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

                {/* CONTRASEÑAS */}
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
                      <p className="text-xs text-gray-700 mt-1">
                        Mínimo 6 caracteres
                      </p>
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

              {/* COLUMNA DERECHA */}
              <div>
                <h3 className="font-bold text-lg mb-4">DATOS DE LA EMPRESA</h3>
                <div className="space-y-4">
                  <div>
                    <input
                      type="text"
                      name="nombreEmpresa"
                      value={formData.nombreEmpresa}
                      onChange={handleInputChange}
                      placeholder="Nombre comercial de la Empresa *"
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
                      placeholder="Correo electrónico de la Empresa *"
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
                      placeholder="Sitio web de la Empresa (opcional)"
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
                    <p className="text-xs text-gray-700 mt-1">
                      Formato: ABC123456XYZ (13 caracteres)
                    </p>
                  </div>

                  <div>
                    <input
                      type="text"
                      name="direccionEmpresa"
                      value={formData.direccionEmpresa}
                      onChange={handleInputChange}
                      placeholder="Dirección de la Empresa *"
                      className="w-full p-3 rounded-lg border border-gray-300 text-gray-700"
                      required
                    />
                  </div>

                  <div>
                    <label className="block mb-2 text-sm font-semibold">
                      Documentos de constitución u otro documento evidencia *
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
                        ✓ Archivo seleccionado:{' '}
                        {formData.documentosConstitucion.name}
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

            {/* BOTÓN DE ENVÍO */}
            <div className="mt-8">
              <button
                type="submit"
                disabled={isSubmitting || Object.keys(errors).length > 0}
                className="bg-button-orange text-white py-3 px-12 rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold"
              >
                {isSubmitting ? 'ENVIANDO...' : 'ENVIAR →'}
              </button>
              <p className="text-xs mt-2 text-gray-700">
                *Al dar click en el botón, aceptas nuestros términos y
                condiciones y política de privacidad.
              </p>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
};

export default FormRegisterForQuotationSection;
