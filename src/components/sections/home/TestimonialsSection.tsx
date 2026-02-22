// RUTA: src/components/sections/home/TestimonialsSection.tsx
'use client';

import { useState, useEffect } from 'react';
import { useInView } from '@/hooks/useInView';

const testimonials = [
  {
    quote:
      'En INAKAT creemos que contratar bien es el primer paso para transformar empresas.',
    author: 'Equipo INAKAT',
    role: 'Fundadores',
  },
  {
    quote:
      'La evaluación dual garantiza que cada candidato no solo sabe, sino que también encaja.',
    author: 'Equipo INAKAT',
    role: 'Filosofía de trabajo',
  },
  {
    quote:
      'La tecnología potencia, pero son las personas quienes deciden. Así trabajamos.',
    author: 'Equipo INAKAT',
    role: 'Nuestro enfoque',
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
                <div className="mt-8">
                  <p className="text-white font-semibold text-lg">
                    — {testimonial.author}
                  </p>
                  <p className="text-white/60 text-sm mt-1">
                    {testimonial.role}
                  </p>
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
