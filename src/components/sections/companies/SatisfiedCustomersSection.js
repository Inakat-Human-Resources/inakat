import React from 'react';

import fondo from '../../../assets/images/3-companies/14.png';
import customer1 from '../../../assets/images/3-companies/11.png';
import customer2 from '../../../assets/images/3-companies/12.png';
import customer3 from '../../../assets/images/3-companies/13.png';

const testimonials = [
    {
        name: 'Ana García',
        role: 'Directora de Recursos Humanos',
        company: 'Innovación Tecnológica S.A. de C.V',
        comment: 'Gracias al equipo de reclutamiento, encontramos talentosos desarrolladores de software que no solo cumplieron con nuestros requisitos técnicos, sino que también se integraron perfectamente con nuestra cultura empresarial. Su dedicación y profesionalismo fueron clave para el éxito de nuestros proyectos. ¡Recomendaría sus servicios sin dudarlo!',
        image: customer1,
        bg_testimonial: 'bg-white',
        name_font_color: 'text-title-dark',
        role_font_color: 'text-gray-600'
    },
    {
        name: 'Javier Martínez',
        role: 'CEO',
        company: 'Bienestar y Salud Corp.',
        comment: 'El equipo de reclutamiento nos ayudó a encontrar psicólogos altamente calificados que han mejorado significativamente la calidad de nuestros servicios de atención médica. Su enfoque personalizado y su capacidad para entender nuestras necesidades específicas hicieron que el proceso fuera suave y eficiente. Estamos muy agradecidos por su excelente trabajo.',
        image: customer2,
        bg_testimonial: 'bg-button-orange',
        name_font_color: 'text-white',
        role_font_color: 'text-white'
    },
    {
        name: 'Laura Pérez',
        role: 'Gerente de contratación',
        company: 'ABC Empresas',
        comment: 'Desde que comenzamos a trabajar con el equipo de reclutamiento, hemos experimentado una notable mejora en la calidad de nuestros nuevos empleados. Su capacidad para encontrar candidatos que no solo tienen las habilidades técnicas necesarias, sino también el ajuste cultural adecuado, ha tenido un impacto positivo en nuestro equipo y en nuestros resultados empresariales.',
        image: customer3,
        bg_testimonial: 'bg-white',
        name_font_color: 'text-title-dark',
        role_font_color: 'text-gray-600'
    }
];

const SatisfiedCustomers = () => {
    return (
        <section 
            className="bg-soft-green text-black py-20"
            style={{ backgroundImage: `url(${fondo})`, backgroundSize: "cover", backgroundPosition: "center", }} >
            <div className="container mx-auto">
                <h2 className="text-3xl font-bold text-white text-center mb-12">
                    CLIENTES SATISFECHOS
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-16">
                    {testimonials.map((testimonial, index) => (
                        <div key={index} className={`${testimonial.bg_testimonial} p-10 rounded-[30px] shadow-lg relative`}>
                            <div className="absolute -top-6 -right-0">
                                <img 
                                    src={testimonial.image} 
                                    alt={testimonial.name} 
                                    className="w-28 h-28 rounded-full"
                                />
                            </div>
                            
                            <div className="mb-6">
                                <h3 className={`font-bold ${testimonial.name_font_color}`}>{testimonial.name}</h3>
                                <p className={`${testimonial.role_font_color}`}>{testimonial.role}</p>
                                <p className={`${testimonial.role_font_color}`}>{testimonial.company}</p>
                            </div>
                            
                            <p className={`${testimonial.name_font_color}`}>{testimonial.comment}</p>
                            
                            <div 
                                className="absolute left-1/2 -bottom-4 transform -translate-x-1/2" 
                                style={{
                                    width: '0',
                                    height: '0',
                                    borderLeft: '15px solid transparent',
                                    borderRight: '15px solid transparent',
                                    borderTop: `20px solid ${testimonial.bg_testimonial === 'bg-white' ? '#ffffff' : '#f48602'}`
                                }}
                            />
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default SatisfiedCustomers;