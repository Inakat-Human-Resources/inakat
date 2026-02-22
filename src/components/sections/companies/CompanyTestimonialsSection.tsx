// RUTA: src/components/sections/companies/CompanyTestimonialsSection.tsx
'use client';

import Image, { StaticImageData } from 'next/image';
import { useInView } from '@/hooks/useInView';
import customer1 from '@/assets/images/3-companies/11.png';
import customer2 from '@/assets/images/3-companies/12.png';
import customer3 from '@/assets/images/3-companies/13.png';

interface Testimonial {
  name: string;
  role: string;
  company: string;
  comment: string;
  image: StaticImageData;
}

const testimonials: Testimonial[] = [
  {
    name: 'Ana García',
    role: 'Directora de Recursos Humanos',
    company: 'Innovación Tecnológica S.A. de C.V',
    comment:
      'Gracias al equipo de reclutamiento, encontramos talentosos desarrolladores de software que no solo cumplieron con nuestros requisitos técnicos, sino que también se integraron perfectamente con nuestra cultura empresarial.',
    image: customer1,
  },
  {
    name: 'Javier Martínez',
    role: 'CEO',
    company: 'Bienestar y Salud Corp.',
    comment:
      'El equipo de reclutamiento nos ayudó a encontrar psicólogos altamente calificados que han mejorado significativamente la calidad de nuestros servicios. Su enfoque personalizado hizo que el proceso fuera eficiente.',
    image: customer2,
  },
  {
    name: 'Laura Pérez',
    role: 'Gerente de contratación',
    company: 'ABC Empresas',
    comment:
      'Desde que comenzamos a trabajar con INAKAT, hemos experimentado una notable mejora en la calidad de nuestros nuevos empleados. Su capacidad para encontrar el ajuste cultural adecuado ha tenido un impacto positivo.',
    image: customer3,
  },
];

const CompanyTestimonialsSection = () => {
  const { ref, isInView } = useInView(0.1);

  return (
    <section
      ref={ref as React.RefObject<HTMLDivElement>}
      className="bg-custom-beige py-16 md:py-24"
    >
      <div className="container mx-auto px-4">
        {/* Title */}
        <h2
          className={`animate-on-scroll ${isInView ? 'in-view' : ''} font-display text-3xl md:text-4xl lg:text-5xl font-bold text-title-dark text-center mb-14`}
        >
          Clientes Satisfechos
        </h2>

        {/* Testimonials grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {testimonials.map((testimonial, index) => (
            <div
              key={index}
              className={`animate-on-scroll ${isInView ? 'in-view' : ''} bg-white rounded-2xl p-8 shadow-sm hover:shadow-md transition-shadow`}
              style={{ transitionDelay: `${index * 150}ms` }}
            >
              {/* Decorative quote */}
              <span className="text-button-green/20 text-6xl font-display leading-none select-none">
                &ldquo;
              </span>

              {/* Comment */}
              <p className="text-text-black/80 italic leading-relaxed -mt-4 mb-6">
                {testimonial.comment}
              </p>

              {/* Separator */}
              <div className="h-px bg-gray-100 mb-4" />

              {/* Author */}
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 bg-custom-beige">
                  <Image
                    src={testimonial.image}
                    alt={testimonial.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
                <div>
                  <p className="font-display font-bold text-title-dark text-sm">
                    {testimonial.name}
                  </p>
                  <p className="text-text-black/50 text-xs">
                    {testimonial.role}
                  </p>
                  <p className="text-button-green text-xs font-medium">
                    {testimonial.company}
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

export default CompanyTestimonialsSection;
