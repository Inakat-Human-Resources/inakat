import React, { useState } from 'react';

import logoImage from '../../../assets/images/2-about/2.png';
import aboutBackground from '../../../assets/images/2-about/3.png';


const OurCompromises = () => {
    const [selected, setSelected] = useState(null);

    return (
        <section 
            className="bg-cover bg-center flex items-center justify-center py-10 relative"
            style={{ backgroundImage: `url(${aboutBackground})` }} >
            <div className="container mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 items-center min-h-[80%]">
                {/* Imagen decorativa izquierda (rotada -90°) */}
                <img 
                    src={logoImage} 
                    alt="Decoración izquierda" 
                    className="absolute left-[-5em] top-1/2 transform -translate-y-1/2 -rotate-90 w-1/6"
                />
                {/* Primera columna: Compromiso (alineado a la derecha) */}
                <div className="bg-primary-light-green p-8 rounded-lg shadow-lg flex items-center justify-end max-w-md ml-auto flex-1 h-full">
                    <p className="text-white text-left">
                        <span className='font-bold text-xl'>Evaluación profunda y experta</span>
                        <br />
                        Todo el proceso está conducido por especialistas reales:
                        <ul className="list-disc pl-6">
                            <li className='font-bold'>
                                Psicólogos expertos evalúan actitudes, valores, formas de trabajo, claridad de intención y compatibilidad cultural.    
                            </li>
                            <li className='font-bold'>
                                Especialistas técnicos validan habilidades, experiencia y nivel de ejecución.
                            </li>
                        </ul>
                        <br />
                        La tecnología y la inteligencia artificial nos ayudan a detectar señales relevantes, pero <span className='font-bold'>cada paso, cada filtro y cada elección está pensada y ejecutada por personas expertas. </span>
                    </p>
                </div>

                {/* Segunda columna: Con Transparencia */}
                <div className="bg-custom-beige p-8 rounded-lg shadow-lg flex items-center justify-start max-w-md flex-1 h-full">
                    <p className="text-black text-left">
                        <span className='font-bold text-xl'>Nuestra promesa</span>
                        <br />
                        Si creemos que un candidato no es adecuado, lo explicamos con fundamentos.
                        <br />
                        Si vemos señales de alerta, las hacemos visibles.
                        <br />
                        Y si encontramos una gran oportunidad para tu empresa, también te lo decimos con argumentos.
                        <br />
                        No ofrecemos fórmulas genéricas ni promesas vacías.
                        <br />
                        Ofrecemos claridad, criterio y compromiso para ayudarte a elegir bien.
                    </p>
                </div>

                {/* Imagen decorativa derecha (rotada +90°) */}
                <img 
                    src={logoImage} 
                    alt="Decoración derecha" 
                    className="absolute right-[-5em] top-1/2 transform -translate-y-1/2 rotate-90 w-1/6"
                />
            </div>
        </section>
    );
};

export default OurCompromises;