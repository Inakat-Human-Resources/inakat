// RUTA: src/components/sections/home/TestimonialsSection.tsx
'use client';

import Image, { StaticImageData } from 'next/image';
import { useInView } from '@/hooks/useInView';
import imgMayela from '@/assets/images/testimonials/mayela-sanchez.jpeg';
import imgAdrian from '@/assets/images/testimonials/adrian-cuadros.jpeg';

interface Testimonial {
  quote: string;
  author: string;
  role: string;
  image: StaticImageData;
}

const testimonials: Testimonial[] = [
  {
    quote:
      'Conozco de muchos años la forma de trabajo de Inakat y he podido constatar su profesionalismo, claridad estratégica y capacidad para conectar a las organizaciones con talento altamente especializado.',
    author: 'Mayela Sánchez',
    role: 'Directora de Marketing · Grupo 4S',
    image: imgMayela,
  },
  {
    quote:
      'Llevo años trabajando con distintos especialistas de Inakat. En todos los casos, sin excepción, he encontrado profesionales de primer nivel; verdaderos cracks en sus respectivos ramos.',
    author: 'Adrian Cuadros',
    role: 'Co-Founder & CPO · Reserhub',
    image: imgAdrian,
  },
  {
    quote:
      'Un claro reflejo de la capacidad de Inakat para identificar y conectar el mejor talento especializado de alto nivel en equipos de producto, tecnología y operación.',
    author: 'Adrian Cuadros',
    role: 'Co-Founder & CPO · Reserhub',
    image: imgAdrian,
  },
];

const TestimonialsSection = () => {
  const { ref, isInView } = useInView(0.1);

  return (
    <section
      ref={ref as React.RefObject<HTMLDivElement>}
      className="bg-soft-green py-16 md:py-24"
      style={{
        backgroundImage:
          'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.03) 0%, transparent 50%), radial-gradient(circle at 80% 50%, rgba(255,255,255,0.03) 0%, transparent 50%)',
      }}
    >
      <div className="container mx-auto px-4">
        {/* Section title */}
        <h2
          className={`animate-on-scroll ${isInView ? 'in-view' : ''} font-display text-3xl md:text-4xl lg:text-5xl font-bold text-white text-center mb-14`}
        >
          Lo que dicen nuestros clientes
        </h2>

        {/* Card grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {testimonials.map((testimonial, index) => (
            <div
              key={index}
              className={`animate-on-scroll ${isInView ? 'in-view' : ''} bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/10 hover:bg-white/15 transition-colors`}
              style={{ transitionDelay: `${index * 150}ms` }}
            >
              {/* Decorative quote */}
              <span className="text-button-green text-6xl font-display leading-none select-none">
                &ldquo;
              </span>

              {/* Quote */}
              <blockquote className="text-white/90 italic leading-relaxed -mt-4 mb-6 text-base">
                {testimonial.quote}
              </blockquote>

              {/* Separator */}
              <div className="h-px bg-white/10 mb-4" />

              {/* Author */}
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 border-2 border-white/30">
                  <Image
                    src={testimonial.image}
                    alt={testimonial.author}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
                <div>
                  <p className="font-display font-bold text-white text-sm">
                    {testimonial.author}
                  </p>
                  <p className="text-white/60 text-xs">
                    {testimonial.role}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
