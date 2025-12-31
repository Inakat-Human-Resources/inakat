"use client";

import React, { useState, FormEvent } from "react";
import Image from "next/image";
import fondo from "@/assets/images/2-about/fondo.png";
import decorIcon from "@/assets/images/2-about/28.png";

const NewsletterSection = () => {
  const [email, setEmail] = useState("");
  const [submitStatus, setSubmitStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitStatus({
      type: 'success',
      message: 'Se ha enviado correctamente el formulario a INAKAT'
    });
    setEmail("");

    // Ocultar mensaje después de 5 segundos
    setTimeout(() => {
      setSubmitStatus({ type: null, message: '' });
    }, 5000);
  };

  return (
    <section
      className="bg-soft-green text-black py-16 relative -z-10"
      style={{
        backgroundImage: `url(${fondo.src})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="bg-lemon-green text-white px-20 py-8 rounded-lg flex flex-col md:flex-row max-w-4xl w-full md:w-auto items-center gap-3 mx-auto justify-center">
        {/* Left Column: Title + Form */}
        <div className="flex flex-col w-full md:w-4/3 pr-4">
          <h2 className="text-2xl md:text-4xl font-bold text-center md:text-left mb-4">
            SUSCRÍBETE A NUESTRO NEWSLETTER
          </h2>

          <form
            onSubmit={handleSubmit}
            className="flex flex-col md:flex-row gap-4 w-full md:w-auto"
          >
            <input
              type="email"
              placeholder="ej. info@inakat.com"
              className="p-3 rounded-full text-black w-full md:w-50 focus:outline-none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <button
              type="submit"
              className="bg-orange-500 text-white py-3 px-6 rounded-full flex items-center gap-2 hover:bg-soft-green"
            >
              SUSCRIBIRME <span className="ml-1">→</span>
            </button>
          </form>

          {submitStatus.type && (
            <div className={`mt-4 p-3 rounded-lg text-center ${
              submitStatus.type === 'success'
                ? 'bg-white/20 text-white'
                : 'bg-red-100 text-red-800'
            }`}>
              {submitStatus.message}
            </div>
          )}
        </div>

        {/* Right Column: Decorative Icon */}
        <div className="w-full md:w-1/5 flex justify-start">
          <Image
            src={decorIcon}
            alt="Decoración"
            style={{ width: "120px", height: "120px" }}
            className="object-contain"
          />
        </div>
      </div>
    </section>
  );
};

export default NewsletterSection;
