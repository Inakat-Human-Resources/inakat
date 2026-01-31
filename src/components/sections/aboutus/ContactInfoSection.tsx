"use client";

import React, { useState, FormEvent } from "react";
import Image from "next/image";
import decorIcon from "@/assets/images/2-about/28.png";

const ContactInfoSection = () => {
  const [email, setEmail] = useState("");
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setNotification({ type: 'success', message: `Mensaje enviado con: ${email}` });
    setEmail("");
  };

  return (
    <section className="flex flex-col items-center py-16">
      {/* Notificación */}
      {notification.type && (
        <div
          className={`mb-6 p-4 rounded-lg flex items-center justify-between max-w-xl w-full mx-4 ${
            notification.type === 'success'
              ? 'bg-green-100 text-green-800 border border-green-300'
              : 'bg-red-100 text-red-800 border border-red-300'
          }`}
        >
          <span>{notification.message}</span>
          <button
            onClick={() => setNotification({ type: null, message: '' })}
            className="ml-4 hover:opacity-70 text-xl"
          >
            ×
          </button>
        </div>
      )}
      <div className="bg-orange-500 text-white px-5 py-6 rounded-lg flex flex-col md:flex-row max-w-xl w-full items-center gap-3">
        {/* Left Column: Title + Form */}
        <div className="flex flex-col w-full md:w-4/3 pr-4">
          <h2 className="text-2xl md:text-3xl font-bold text-center md:text-left mb-4">
            PONTE EN CONTACTO <br /> PARA MÁS INFORMACIÓN
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
              className="bg-soft-green text-white py-3 px-6 rounded-full flex items-center gap-2 hover:bg-soft-green"
            >
              ENVIAR <span className="ml-1">→</span>
            </button>
          </form>
        </div>

        {/* Right Column: Decorative Icon */}
        <div className="w-full md:w-1/3 flex justify-start">
          <Image src={decorIcon} alt="Decoración" className="w-30 h-30" />
        </div>
      </div>
    </section>
  );
};

export default ContactInfoSection;
