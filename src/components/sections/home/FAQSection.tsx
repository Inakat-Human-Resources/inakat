// RUTA: src/components/sections/home/FAQSection.tsx
'use client';

import { useState } from 'react';
import { useInView } from '@/hooks/useInView';
import { Plus, Minus } from 'lucide-react';

const faqs = [
  {
    question: '¿Cómo funciona el proceso de selección?',
    answer:
      'Cada candidato pasa por evaluación psicológica con nuestros psicólogos expertos y evaluación técnica con especialistas líderes en su área. Usamos IA como apoyo estratégico, pero las decisiones las toman personas reales.',
  },
  {
    question: '¿Cuánto tarda el proceso?',
    answer:
      'Nuestro proceso completo tiene 11 etapas y toma en promedio entre 3 y 4 semanas desde la definición del perfil hasta el cierre, más seguimiento post-contratación y evaluación continua.',
  },
  {
    question: '¿Qué tipo de perfiles manejan?',
    answer:
      'Cubrimos 7 áreas de especialidad: desde TI e ingeniería hasta psicología, salud, negocios, marketing y gestión operativa.',
  },
  {
    question: '¿Tienen cobertura en mi ciudad?',
    answer:
      'Tenemos presencia activa en la mayoría de los estados de la República Mexicana, con conexiones estratégicas en CDMX, Guadalajara, Monterrey y más.',
  },
  {
    question: '¿Cómo me registro como candidato?',
    answer:
      'Solo necesitas crear tu cuenta, completar tu perfil y subir tu CV. Nuestro equipo te contactará cuando surja una oportunidad que se ajuste a tu perfil.',
  },
  {
    question: '¿Cuánto cuesta el servicio?',
    answer:
      'Trabajamos con un modelo de créditos. Cada vacante tiene un costo en créditos que varía según el perfil, seniority, modalidad y ubicación. Puedes comprar paquetes de créditos desde nuestra plataforma. Contacta a nuestro equipo comercial para una cotización personalizada.',
  },
];

const FAQSection = () => {
  const { ref, isInView } = useInView(0.1);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section
      ref={ref as React.RefObject<HTMLDivElement>}
      className="bg-soft-beige py-16 md:py-24"
    >
      <div className="container mx-auto px-4">
        {/* Section title */}
        <h2
          className={`animate-on-scroll ${isInView ? 'in-view' : ''} font-display text-3xl md:text-4xl lg:text-5xl font-bold text-title-dark text-center mb-14`}
        >
          Preguntas frecuentes
        </h2>

        {/* FAQ Accordion */}
        <div className="max-w-3xl mx-auto space-y-3">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className={`animate-on-scroll ${isInView ? 'in-view' : ''} border-b border-title-dark/10`}
              style={{ transitionDelay: `${index * 80}ms` }}
            >
              <button
                onClick={() =>
                  setOpenIndex(openIndex === index ? null : index)
                }
                className="w-full flex items-center justify-between py-5 text-left group"
              >
                <span className="font-display text-lg font-semibold text-title-dark pr-8 group-hover:text-button-orange transition-colors">
                  {faq.question}
                </span>
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-title-dark/5 flex items-center justify-center group-hover:bg-button-orange/10 transition-colors">
                  {openIndex === index ? (
                    <Minus className="w-4 h-4 text-button-orange" />
                  ) : (
                    <Plus className="w-4 h-4 text-title-dark" />
                  )}
                </span>
              </button>

              {/* Answer */}
              <div
                className={`overflow-hidden transition-all duration-300 ${
                  openIndex === index ? 'max-h-96 pb-5' : 'max-h-0'
                }`}
              >
                <p className="text-text-black/70 text-base leading-relaxed pr-12">
                  {faq.answer}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FAQSection;
