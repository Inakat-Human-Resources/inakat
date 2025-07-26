import React, { useState } from 'react';

const specialtiesData = [
    {
        title: "Psicología, Educación y Ciencias Humanas",
        image: require("../../../assets/images/2-about/4.png"),
        subcategories: ["Psicología", "Lingüística", "Educación", "Pedagogía", 
            "Formación académica", "Generación de contenido especializado", 
            "Diseño instruccional", "Intervención social"]
    },
    {
        title: "Tecnologías de la Información",
        image: require("../../../assets/images/2-about/5.png"),
        subcategories: ["Desarrollo web", "Devops", "Infraestructura TI", 
            "Ciberseguridad", "Bases de datos", "Soporte técnico",
            "Machine learning", "Inteligencia artificial"
        ]
    },
    {
        title: "Ingeniería y Tecnología Avanzada",
        image: require("../../../assets/images/2-about/6.png"),
        subcategories: ["Mecatrónica", "Electrónica", "Automatización",
            "Proyectos industriales", "Diseño de producto", "I+D"
    ]
    },
    {
        title: "Negocios, Administración y Finanzas",
        image: require("../../../assets/images/2-about/7.png"),
        subcategories: ["Administración", "Finanzas",
            "Análisis financiero", "Project Management",
            "Consultoría empresarial", "Contabilidad"
        ]
    },
    {
        title: "Marketing, Comunicación y Diseño",
        image: require("../../../assets/images/2-about/7.png"),
        subcategories: ["Marketing", "Diseño gráfico", "Diseño UI/UX",
            "Producción audiovisual", "Comunicación",
            "Community manager", "Publicidad", "Branding"
        ]
    },
    {
        title: "Talento, Gestión y Operación de Oficinas",
        image: require("../../../assets/images/2-about/7.png"),
        subcategories: ["Recursos Humanos", "Asistente administrativo",
            "Gestión documental", "Atención al cliente",
            "Reclutamiento y selección"
        ]
    },
    {
        title: "Salud y Bienestar",
        image: require("../../../assets/images/2-about/7.png"),
        subcategories: ["Psicología clínica", "Nutrición", 
            "Orientación familiar", "Educación en salud"
        ]
    }
];

const Specialties = () => {
    const [selected, setSelected] = useState(null);

    return (
        <section className="bg-background-beige py-20">
            <div className="container mx-auto text-center">
                <h2 className="text-3xl font-bold text-title-dark mb-6">NUESTRAS ÁREAS DE ESPECIALIDAD</h2>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {specialtiesData.map((specialty, index) => (
                        <div 
                            key={index} 
                            className="relative bg-white p-6 rounded-lg shadow-lg cursor-pointer transition-all duration-300 min-h-[360px] flex flex-col justify-center items-center"
                            onClick={() => setSelected(selected === index ? null : index)}
                            style={{ backgroundImage: `url(${specialty.image})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
                        >
                            <div className="absolute inset-0 bg-black opacity-40 rounded-lg"></div>

                            {selected === index ? (
                                <div className="flex flex-col items-center space-y-4">
                                    {specialty.subcategories.map((sub, subIndex) => (
                                        <span 
                                            key={subIndex} 
                                            className="bg-primary-light-green text-white py-2 px-4 rounded-full shadow-md text-lg"
                                        >
                                            {sub}
                                        </span>
                                    ))}
                                    <button 
                                        className="mt-4 bg-primary-dark-blue text-white py-2 px-4 rounded hover:bg-primary-light-blue"
                                        onClick={() => setSelected(null)}
                                    >
                                        ← Regresar
                                    </button>
                                </div>
                            ) : (
                                <div 
                                    className="relative flex items-center justify-center h-56 bg-cover bg-center rounded-lg"
                                >
                                    <h3 className="relative text-white text-xl font-bold">{specialty.title}</h3>
                                    <div className="absolute bottom-4 right-4 bg-primary-light-green p-2 rounded-full">
                                        <span className="text-white text-xl">→</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default Specialties;