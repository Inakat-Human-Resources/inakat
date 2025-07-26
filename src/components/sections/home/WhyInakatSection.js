import React from 'react';
import { useNavigate } from 'react-router-dom';

import semicircleImage from '../../../assets/images/1-home/6.png';


const WhyInakat = () => {
    const navigate = useNavigate();
        
    return (
        <section className="bg-soft-green text-white">
            <div className="container mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="relative w-full h-full min-h-[400px]">
                    <img
                        src={semicircleImage}
                        alt="Por qué INAKAT"
                        className="absolute w-full h-full object-cover left-[-4em]"
                    />
                </div>
                <div className="md:w-4/3 flex flex-wrap justify-center md:justify-start gap-4 mt-6 mb-16 md:mt-0 pt-16">
                    <h2 className="text-3xl font-bold mb-6 text-primary-blue">¿Por qué INAKAT?</h2>
                    <p className="text-lg leading-relaxed mb-6">
                        En INAKAT, las personas son el centro de todo.
                        <br />
                        Cada perfil pasa por dos filtros fundamentales:
                        <ul className="list-disc pl-6">
                            <li>
                                Psicólogos expertos en reclutamiento, que evalúan actitud, compromiso, valores y compatibilidad con tu cultura.
                            </li>
                            <li>
                                Especialistas líderes en cada disciplina —ingeniería, tecnología, finanzas, educación, salud— 
                                que no solo validan que el candidato puede hacer el trabajo, sino que lo hace de forma destacada.
                            </li>
                        </ul>
                    </p>
                    <p className="text-lg leading-relaxed mb-6">
                        Complementamos este proceso con inteligencia artificial usada de forma responsable.
                        <br />
                        No decide por nosotros, pero <strong>nos brinda señales valiosas </strong>como: 
                        <br />
                        "fíjate en esto", "esto destaca", "esto puede ser un riesgo".
                        <br />
                        <strong>
                            Nos ayuda a ver mejor, pero nunca a sustituir el criterio humano.
                        </strong>
                    </p>
                    <p className="text-lg leading-relaxed mb-6">
                        Todo esto ocurre en una plataforma que <strong>nace de la visión de psicólogos especializados en selección</strong> 
                        <br />
                        y ha sido diseñada por  <strong>ingenieros y creativos pensando en ti:</strong>
                        <br />
                        para que tengas claridad, confianza y  <strong> transparencia total en cada paso del proceso.</strong>
                    </p>
                    <p className="text-lg leading-relaxed mb-6">
                        Además, <strong>contamos con presencia activa en diversas ciudades clave de México,</strong>
                        <br />
                        lo que nos permite conocer a fondo el talento local y conectar a cada empresa con profesionales calificados,
                        <br />
                        <strong>acorde a su región, su industria y su cultura organizacional.</strong>
                    </p>
                    <p className="text-lg leading-relaxed mb-6">
                        Porque no se trata solo de filtrar perfiles.
                        <br />
                        <strong>Se trata de encontrar a quienes realmente hacen la diferencia.</strong>
                    </p>
                    <button
                        onClick={() => navigate('/about')}
                        className="mt-6 bg-lemon-green text-white py-2 px-6 rounded-full hover:bg-title-dark font-bold">
                            CONOCE NUESTRO PROCESO →
                    </button>
                </div>
            </div>
        </section>
    );
};

export default WhyInakat;