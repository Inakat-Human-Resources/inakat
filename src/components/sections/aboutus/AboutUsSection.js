import React, { useState } from 'react';

import aboutImage from '../../../assets/images/2-about/1.png';

const AboutUs = () => {
    const [selected, setSelected] = useState(null);

    return (
        <section className="py-20">
            <div className="container mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
                <div className="relative md:col-span-2">
                    <img 
                        src={aboutImage} 
                        alt="Equipo INAKAT" 
                        className="shadow-lg w-full" style={{ borderRadius: "30px" }}
                    />
                    <div className="absolute inset-0 bg-soft-green opacity-60 rounded-lg" style={{ borderRadius: "30px" }}></div>
                </div>
                <div className="md:col-span-1">
                    <h2 className="text-4xl font-bold mb-6 text-title-dark">¿QUIÉNES <br />SOMOS?</h2>
                    <p className="text-lg">
                        En INAKAT entendemos que reclutar no es solo cubrir un puesto.
                    </p>
                    <p className="text-lg">
                        Es encontrar a la persona adecuada <strong>para el rol, la cultura y las condiciones reales de tu empresa.</strong>
                    </p>
                    <p className="text-lg">
                        Sabemos que <strong>un candidato no es solo lo que sabe hacer, sino cómo se comporta, cómo se comunica, cómo se adapta, cuánto le importa el puesto y si realmente puede sostenerlo en el tiempo.</strong>
                    </p>
                    <p className="text-lg">
                        Por eso, <strong>no elegimos solo por currículum, elegimos por compatibilidad, compromiso, ubicación, cultura y realidad humana.</strong>
                    </p>
                    <p className="text-lg">
                        El nombre <i>INAKAT</i> proviene de la palabra “talento” en lengua wayuu, una comunidad que honra las habilidades únicas de cada persona.
                    </p>
                    <p className="text-lg">
                        Eso nos inspira a ver más allá de lo obvio y conectar a las empresas con quienes <strong>de verdad pueden aportar a su equipo, su operación y sus metas.</strong>
                    </p>
                </div>
            </div>
        </section>
    );
};

export default AboutUs;