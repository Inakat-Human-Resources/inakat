// RUTA: src/components/sections/home/TestimonialsSection.tsx
import Image, { StaticImageData } from 'next/image';
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
];

const TestimonialsSection = () => {
  return (
    <section className="hm-testi hm-on-dark" aria-labelledby="hm-testi-title">
      <span className="hm-testi__arc" aria-hidden="true" />
      <div className="hm-wrap">
        <div className="hm-testi__head">
          <p className="hm-eyebrow">Testimonios</p>
          <h2 id="hm-testi-title" className="hm-h2">
            Lo que dicen <em>nuestros clientes</em>
          </h2>
        </div>

        {/* Rejilla (no carrusel): los dos testimonios reales, a la vista */}
        <div className="hm-testi__grid grid grid-cols-1 md:grid-cols-2">
          {testimonials.map((testimonial) => (
            <figure key={testimonial.author} className="hm-quote hm-rv">
              <blockquote>{testimonial.quote}</blockquote>
              <figcaption>
                <div className="hm-quote__photo">
                  <Image
                    src={testimonial.image}
                    alt={testimonial.author}
                    sizes="80px"
                    loading="lazy"
                  />
                </div>
                <div>
                  <p className="hm-quote__name">{testimonial.author}</p>
                  <p className="hm-quote__role">{testimonial.role}</p>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
