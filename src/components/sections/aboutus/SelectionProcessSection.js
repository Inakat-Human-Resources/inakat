import React from "react";

// Importing images for each step
import step1 from "../../../assets/images/2-about/17.png";
import step2 from "../../../assets/images/2-about/18.png";
import step3 from "../../../assets/images/2-about/19.png";
import step4 from "../../../assets/images/2-about/20.png";
import step5 from "../../../assets/images/2-about/24.png";
import step6 from "../../../assets/images/2-about/23.png";
import step7 from "../../../assets/images/2-about/21.png";
import step8 from "../../../assets/images/2-about/22.png";
import step9 from "../../../assets/images/2-about/25.png";
import step10 from "../../../assets/images/2-about/26.png";

const steps = [
    { number: 1, title: "DEFINICIÓN DEL PERFIL DEL CANDIDATO - 1 día", image: step1 },
    { number: 2, title: "REUNIÓN INICIAL CON EL CLIENTE - 1 día (Opcional)", image: step2 },
    { number: 3, title: "BÚSQUEDA ACTIVA DE CANDIDATOS - 5 días", image: step3 },
    { number: 4, title: "EVALUACIÓN DE CURRÍCULOS - 3 días", image: step4 },
    { number: 5, title: "REFERENCIAS Y VERIFICACIÓN DE DOCUMENTOS - 4 días", image: step5 },
    { number: 6, title: "ENTREVISTAS CON ESPECIALISTAS, PRUEBAS TÉCNICAS Y EVALUACIÓN - 4 días", image: step6 },
    { number: 7, title: "PRESENTACIÓN DE CANDIDATOS - 1 día", image: step7 },
    { number: 8, title: "ENTREVISTAS CON EL CLIENTE - 4 días", image: step8 },
    { number: 9, title: "CIERRE DE ENTREVISTAS - 1 día", image: step9 },
    { number: 10, title: "SEGUIMIENTO POST CONTRATACIÓN", image: step9 },
    { number: 11, title: "EVALUACIÓN CONTINUA", image: step10 },
];




const SelectionProcessSection = () => {
    return (
        <section className="bg-custom-beige text-black py-20">
            <div className="container mx-auto text-center">
                
                {/* Title */}
                <h2 className="text-3xl font-bold mb-6">NUESTRO PROCESO DE SELECCIÓN</h2>

                {/* Grid Layout */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
                    {steps.map((step, index) => (
                        <div key={index} className="bg-lemon-green p-4 rounded-lg shadow-lg flex flex-col items-center text-center relative">
                            
                            {/* Step Number */}
                            <div className="absolute -top-4 bg-orange-500 text-white w-10 h-10 flex items-center justify-center rounded-full font-bold text-lg">
                                {step.number}
                            </div>
                            
                            {/* Step Title */}
                            <h3 className="text-sm font-bold mt-6 text-white">{step.title}</h3>

                            {/* Step Image with Circular Background */}
                            <div className="w-20 h-20 bg-custom-beige rounded-full flex items-center justify-center p-3 mt-4">
                                <img src={step.image} alt={step.title} className="w-12 h-12" />
                            </div>
                        </div>
                    ))}
                </div>

                {/* Closing Text with Larger Font Size */}
                <p className="mt-8 font-bold text-2xl">
                    Delega el proceso de reclutamiento en expertos, <br />
                    liberando a tu equipo para centrarse en objetivos clave.
                </p>
            </div>
        </section>
    );
};

export default SelectionProcessSection;