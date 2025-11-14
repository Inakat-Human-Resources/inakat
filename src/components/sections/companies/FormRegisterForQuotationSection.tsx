"use client";

import React, { useState, useRef, FormEvent, ChangeEvent } from "react";

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
    nombre: "",
    apellidoPaterno: "",
    apellidoMaterno: "",
    identificacion: null,
    password: "",
    confirmPassword: "",
    nombreEmpresa: "",
    correoEmpresa: "",
    sitioWeb: "",
    razonSocial: "",
    rfc: "",
    direccionEmpresa: "",
    documentosConstitucion: null,
  });

  const [errors, setErrors] = useState<Errors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<{
    type: "success" | "error" | null;
    message: string;
  }>({ type: null, message: "" });

  const fileInputIdRef = useRef<HTMLInputElement>(null);
  const fileInputDocRef = useRef<HTMLInputElement>(null);

  // Validations
  const validateName = (value: string) =>
    /^[A-Za-zÁáÉéÍíÓóÚúÑñ\s]+$/.test(value);
  const validateEmail = (email: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const validateURL = (url: string) =>
    /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/.test(url);
  const validateRFC = (rfc: string) =>
    /^[A-ZÑ&]{3,4}[0-9]{2}(0[1-9]|1[0-2])(0[1-9]|[12][0-9]|3[01])[A-Z0-9]{3}$/.test(
      rfc
    );
  const validatePasswords = () => formData.password === formData.confirmPassword;

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Real-time validations
    const newErrors = { ...errors };

    switch (name) {
      case "nombre":
      case "apellidoPaterno":
      case "apellidoMaterno":
        if (!validateName(value)) {
          newErrors[name] = "Solo se permiten letras";
        } else {
          delete newErrors[name];
        }
        break;
      case "correoEmpresa":
        if (!validateEmail(value)) {
          newErrors.correoEmpresa = "Correo electrónico inválido";
        } else {
          delete newErrors.correoEmpresa;
        }
        break;
      case "sitioWeb":
        if (value && !validateURL(value)) {
          newErrors.sitioWeb = "URL inválida";
        } else {
          delete newErrors.sitioWeb;
        }
        break;
      case "rfc":
        if (!validateRFC(value)) {
          newErrors.rfc = "RFC inválido";
        } else {
          delete newErrors.rfc;
        }
        break;
      case "confirmPassword":
        if (!validatePasswords()) {
          newErrors.confirmPassword = "Las contraseñas no coinciden";
        } else {
          delete newErrors.confirmPassword;
        }
        break;
    }

    setErrors(newErrors);
  };

  const handleFileChange = (
    e: ChangeEvent<HTMLInputElement>,
    fileType: "identificacion" | "documentosConstitucion"
  ) => {
    const file = e.target.files?.[0] || null;
    setFormData((prev) => ({
      ...prev,
      [fileType]: file,
    }));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus({ type: null, message: "" });

    // Final validation before submitting
    const formErrors: Errors = {};
    if (!validateName(formData.nombre))
      formErrors.nombre = "Solo se permiten letras";
    if (!validateName(formData.apellidoPaterno))
      formErrors.apellidoPaterno = "Solo se permiten letras";
    if (!validateName(formData.apellidoMaterno))
      formErrors.apellidoMaterno = "Solo se permiten letras";
    if (!validateEmail(formData.correoEmpresa))
      formErrors.correoEmpresa = "Correo electrónico inválido";
    if (formData.sitioWeb && !validateURL(formData.sitioWeb))
      formErrors.sitioWeb = "URL inválida";
    if (!validateRFC(formData.rfc)) formErrors.rfc = "RFC inválido";
    if (!validatePasswords())
      formErrors.confirmPassword = "Las contraseñas no coinciden";

    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors);
      setIsSubmitting(false);
      return;
    }

    try {
      // Note: File upload is not implemented yet
      // TODO: Implement file upload to cloud storage (AWS S3, Vercel Blob, etc.)
      // For now, we'll submit without file URLs

      const response = await fetch("/api/company-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nombre: formData.nombre,
          apellidoPaterno: formData.apellidoPaterno,
          apellidoMaterno: formData.apellidoMaterno,
          nombreEmpresa: formData.nombreEmpresa,
          correoEmpresa: formData.correoEmpresa,
          sitioWeb: formData.sitioWeb || null,
          razonSocial: formData.razonSocial,
          rfc: formData.rfc,
          direccionEmpresa: formData.direccionEmpresa,
          // TODO: Add file upload URLs once implemented
          // identificacionUrl: uploadedIdUrl,
          // documentosConstitucionUrl: uploadedDocUrl,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSubmitStatus({
          type: "success",
          message:
            "¡Solicitud enviada exitosamente! Nos contactaremos contigo pronto.",
        });

        // Reset form
        setFormData({
          nombre: "",
          apellidoPaterno: "",
          apellidoMaterno: "",
          identificacion: null,
          password: "",
          confirmPassword: "",
          nombreEmpresa: "",
          correoEmpresa: "",
          sitioWeb: "",
          razonSocial: "",
          rfc: "",
          direccionEmpresa: "",
          documentosConstitucion: null,
        });
      } else {
        throw new Error(data.error || "Error al enviar el formulario");
      }
    } catch (error) {
      setSubmitStatus({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Error al enviar el formulario. Por favor, intenta de nuevo.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section id="register" className="bg-title-dark text-white bg-center py-20">
      <div className="container mx-auto">
        <div className="max-w-4xl mx-auto bg-lemon-green p-8 rounded-2xl">
          <h2 className="text-3xl font-bold text-title-dark mb-12 text-center">
            ÚNETE HOY Y DESCUBRE CÓMO PODEMOS TRANSFORMAR TU EQUIPO
          </h2>

          {submitStatus.type && (
            <div
              className={`mb-6 p-4 rounded-lg ${
                submitStatus.type === "success"
                  ? "bg-green-100 text-green-800"
                  : "bg-red-100 text-red-800"
              }`}
            >
              {submitStatus.message}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Left column */}
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
                        placeholder="Nombre"
                        className="w-full p-3 rounded-lg border border-gray-300 text-gray-700"
                        required
                      />
                      {errors.nombre && (
                        <span className="text-red-500 text-sm">
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
                        placeholder="Apellido Paterno"
                        className="w-full p-3 rounded-lg border border-gray-300 text-gray-700"
                        required
                      />
                      {errors.apellidoPaterno && (
                        <span className="text-red-500 text-sm">
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
                        placeholder="Apellido Materno"
                        className="w-full p-3 rounded-lg border border-gray-300 text-gray-700"
                        required
                      />
                      {errors.apellidoMaterno && (
                        <span className="text-red-500 text-sm">
                          {errors.apellidoMaterno}
                        </span>
                      )}
                    </div>
                    <div>
                      <label className="block mb-2">
                        Identificación (INE, licencia, pasaporte)
                      </label>
                      <input
                        type="file"
                        ref={fileInputIdRef}
                        onChange={(e) => handleFileChange(e, "identificacion")}
                        className="hidden"
                        accept=".pdf,.jpg,.jpeg,.png"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputIdRef.current?.click()}
                        className="bg-soft-green text-white py-3 px-6 rounded-xl hover:bg-green-700 w-full md:w-auto flex items-center justify-center"
                      >
                        CARGAR DOCUMENTO <span className="ml-2">↑</span>
                      </button>
                      {formData.identificacion && (
                        <span className="text-sm text-gray-600 mt-2 block">
                          Archivo seleccionado: {formData.identificacion.name}
                        </span>
                      )}
                      <p className="text-xs text-gray-600 mt-1">
                        Nota: Los archivos no se subirán hasta implementar el
                        sistema de almacenamiento
                      </p>
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
                        placeholder="Genera tu contraseña"
                        className="w-full p-3 rounded-lg border border-gray-300 text-gray-700"
                        required
                      />
                    </div>
                    <div>
                      <input
                        type="password"
                        name="confirmPassword"
                        value={formData.confirmPassword}
                        onChange={handleInputChange}
                        placeholder="Confirma tu contraseña"
                        className="w-full p-3 rounded-lg border border-gray-300 text-gray-700"
                        required
                      />
                      {errors.confirmPassword && (
                        <span className="text-red-500 text-sm">
                          {errors.confirmPassword}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right column */}
              <div>
                <h3 className="font-bold text-lg mb-4">DATOS DE LA EMPRESA</h3>
                <div className="space-y-4">
                  <div>
                    <input
                      type="text"
                      name="nombreEmpresa"
                      value={formData.nombreEmpresa}
                      onChange={handleInputChange}
                      placeholder="Nombre comercial de la Empresa"
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
                      placeholder="Correo electrónico de la Empresa"
                      className="w-full p-3 rounded-lg border border-gray-300 text-gray-700"
                      required
                    />
                    {errors.correoEmpresa && (
                      <span className="text-red-500 text-sm">
                        {errors.correoEmpresa}
                      </span>
                    )}
                  </div>
                  <div>
                    <input
                      type="url"
                      name="sitioWeb"
                      value={formData.sitioWeb}
                      onChange={handleInputChange}
                      placeholder="Sitio web de la Empresa"
                      className="w-full p-3 rounded-lg border border-gray-300 text-gray-700"
                    />
                    {errors.sitioWeb && (
                      <span className="text-red-500 text-sm">
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
                      placeholder="Razón Social"
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
                      placeholder="RFC"
                      className="w-full p-3 rounded-lg border border-gray-300 text-gray-700"
                      required
                    />
                    {errors.rfc && (
                      <span className="text-red-500 text-sm">
                        {errors.rfc}
                      </span>
                    )}
                  </div>
                  <div>
                    <input
                      type="text"
                      name="direccionEmpresa"
                      value={formData.direccionEmpresa}
                      onChange={handleInputChange}
                      placeholder="Dirección de la Empresa"
                      className="w-full p-3 rounded-lg border border-gray-300 text-gray-700"
                      required
                    />
                  </div>
                  <div>
                    <label className="block mb-2 text-sm">
                      Documentos de constitución u otro documento evidencia que
                      nos ayuden a respaldar la veracidad de su cuenta
                    </label>
                    <input
                      type="file"
                      ref={fileInputDocRef}
                      onChange={(e) =>
                        handleFileChange(e, "documentosConstitucion")
                      }
                      className="hidden"
                      accept=".pdf,.jpg,.jpeg,.png"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputDocRef.current?.click()}
                      className="bg-soft-green text-white py-3 px-6 rounded-xl hover:bg-green-700 w-full md:w-auto flex items-center justify-center"
                    >
                      CARGAR DOCUMENTO <span className="ml-2">↑</span>
                    </button>
                    {formData.documentosConstitucion && (
                      <span className="text-sm text-gray-600 mt-2 block">
                        Archivo seleccionado:{" "}
                        {formData.documentosConstitucion.name}
                      </span>
                    )}
                    <p className="text-xs text-gray-600 mt-1">
                      Nota: Los archivos no se subirán hasta implementar el
                      sistema de almacenamiento
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Submit button aligned to the left */}
            <div className="mt-8">
              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-button-orange text-white py-3 px-12 rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "ENVIANDO..." : "ENVIAR →"}
              </button>
              <p className="text-xs mt-2 text-gray-600">
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
