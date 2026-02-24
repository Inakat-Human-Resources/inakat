// RUTA: src/components/sections/home/TestimonialsSection.tsx
'use client';

import { useState, useEffect } from 'react';
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
  const { ref, isInView } = useInView(0.2);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % testimonials.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

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
        <div
          className={`animate-on-scroll ${isInView ? 'in-view' : ''} max-w-4xl mx-auto text-center`}
        >
          {/* Decorative quote */}
          <span className="text-button-green text-8xl md:text-9xl font-display leading-none select-none">
            &ldquo;
          </span>

          {/* Quote */}
          <div className="relative -mt-12 md:-mt-16">
            {testimonials.map((testimonial, index) => (
              <div
                key={index}
                className={`transition-opacity duration-700 ${
                  index === currentIndex
                    ? 'opacity-100'
                    : 'opacity-0 absolute inset-0'
                }`}
              >
                <blockquote className="text-white text-2xl md:text-3xl lg:text-4xl font-light italic leading-relaxed">
                  {testimonial.quote}
                </blockquote>
                <div className="mt-8 flex flex-col items-center gap-3">
                  <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-white/30">
                    <Image
                      src={testimonial.image}
                      alt={testimonial.author}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <div>
                    <p className="text-white font-semibold text-lg">
                      — {testimonial.author}
                    </p>
                    <p className="text-white/60 text-sm mt-1">
                      {testimonial.role}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Dots */}
          <div className="flex justify-center gap-3 mt-10">
            {testimonials.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={`w-3 h-3 rounded-full transition-all duration-300 ${
                  index === currentIndex
                    ? 'bg-button-green scale-125'
                    : 'bg-white/30 hover:bg-white/50'
                }`}
                aria-label={`Testimonial ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
