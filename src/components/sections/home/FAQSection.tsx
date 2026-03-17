// RUTA: src/components/sections/home/FAQSection.tsx
'use client';

import { useState } from 'react';
import { useInView } from '@/hooks/useInView';
import { Plus, Minus } from 'lucide-react';

const faqs = [
  {
    question: '¿Cómo funciona el proceso de selección?',
    answer:
      'En INAKAT combinamos evaluación humana especializada con tecnología e inteligencia artificial. Nuestro proceso incluye: identificación del perfil requerido, búsqueda y preselección de candidatos, evaluación por especialistas (psicólogos y expertos técnicos), validación mediante herramientas tecnológicas y análisis de datos, y presentación de candidatos evaluados al cliente. De esta forma, las empresas reciben talento previamente evaluado y con mayor probabilidad de fit y éxito en el puesto.',
  },
  {
    question: '¿Por qué INAKAT es más accesible que otras firmas de reclutamiento?',
    answer:
      'Muchas firmas tradicionales de reclutamiento y headhunters cobran entre 2 y hasta 4 meses del salario de la persona contratada. En INAKAT nos hicimos una pregunta simple: ¿por qué el costo del proceso debería depender del sueldo del candidato? En INAKAT cobramos con base en el esfuerzo real del proceso, considerando factores como plataformas de búsqueda utilizadas, tiempo de especialistas y reclutadores, evaluaciones profesionales y gestión del proceso. Esto nos permite ofrecer costos significativamente más competitivos, sin sacrificar la calidad.',
  },
  {
    question: '¿Qué significa que nuestro proceso es transparente?',
    answer:
      'La transparencia es uno de los pilares de INAKAT. En muchos modelos tradicionales, el proceso ocurre dentro de una "caja negra" donde la empresa no sabe qué está pasando. En INAKAT las empresas pueden dar seguimiento en tiempo real, ver el avance de la búsqueda, revisar evaluaciones de candidatos y entender por qué un candidato es recomendado. Todo desde la plataforma. No tienes que estar preguntando cómo va el proceso, siempre puedes observarlo directamente.',
  },
  {
    question: '¿Por qué decimos que el proceso es humano complementado con tecnología?',
    answer:
      'En muchos modelos actuales, la inteligencia artificial intenta reemplazar el juicio humano. En INAKAT creemos lo contrario: la tecnología debe potenciar el criterio humano, no sustituirlo. Nuestro modelo combina evaluación humana especializada con análisis tecnológico posterior, lo que permite tomar decisiones más confiables y mejor contextualizadas. Muchos profesionales valiosos no tienen su perfil actualizado porque están concentrados en su trabajo actual; un algoritmo podría descartarlos simplemente porque su información no coincide con ciertos filtros.',
  },
  {
    question: '¿Qué tipo de perfiles manejan?',
    answer:
      'Trabajamos principalmente con perfiles profesionales especializados donde la evaluación permite distinguir entre distintos niveles de talento. Entre ellos: perfiles tecnológicos, de negocio, administración, educación, diseño, producción audiovisual, docentes, diseñadores instruccionales, ingeniería en circuitos embebidos, ingeniería eléctrica, ingeniería química, ingeniería industrial y arquitectura. En general, trabajamos con perfiles donde la evaluación profesional permite identificar talento diferencial.',
  },
  {
    question: '¿Cuánto tarda el proceso?',
    answer:
      'El tiempo depende de la complejidad del perfil. Sin embargo, gracias a nuestro modelo tecnológico y red de especialistas, los procesos suelen ser más ágiles que los esquemas tradicionales de reclutamiento.',
  },
  {
    question: '¿Tienen cobertura en mi ciudad?',
    answer:
      'INAKAT trabaja con un modelo híbrido y digital, lo que nos permite evaluar talento en distintas ciudades. Actualmente contamos con presencia en Monterrey, Morelia, Ciudad de México, Puebla y Guadalajara.',
  },
  {
    question: '¿Cuánto cuesta el servicio?',
    answer:
      'El costo depende del tipo de perfil y del alcance del proceso. Nuestro modelo permite ofrecer costos más accesibles que las firmas tradicionales de reclutamiento, manteniendo evaluaciones profesionales y un proceso transparente. El precio exacto puede calcularse directamente dentro de la plataforma. Una vez que te registres como empresa y crees una vacante, encontrarás una calculadora de costo dentro del formulario donde podrás ver el precio del proceso de manera inmediata.',
  },
  {
    question: '¿Qué diferencia a INAKAT de una agencia de reclutamiento tradicional?',
    answer:
      'Las agencias tradicionales suelen operar como intermediarios: reciben una vacante, buscan candidatos y presentan perfiles filtrados. Gran parte del proceso ocurre fuera de la vista de la empresa y el costo suele estar ligado al salario del puesto. INAKAT funciona de forma distinta: nuestro modelo combina evaluación humana especializada, tecnología y transparencia en el proceso. Los candidatos pasan primero por evaluación profesional antes de ser presentados, las empresas pueden dar seguimiento en tiempo real, y el costo se basa en el esfuerzo real del proceso, no en el salario del candidato.',
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
                  openIndex === index ? 'max-h-[600px] pb-5' : 'max-h-0'
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
