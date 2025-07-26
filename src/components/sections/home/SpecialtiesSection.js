import React from 'react';
import { useNavigate } from 'react-router-dom';

// Importar imágenes
import semicircleImage from '../../../assets/images/1-home/5.png';

const Specialties = () => {
    const navigate = useNavigate(); // Para redirigir al hacer clic en el botón

    // Lista de especialidades
    const specialties = [
        "psicología", "educación", "ciencias humanas",
        "tecnologías de la información",
        "ingeniería y tecnología avanzada",
        "negocios", "administración", "finanzas",
        "marketing", "comunicación", "diseño",
        "talento", "gestión", "operación de oficinas",
        "salud", "bienestar"
    ];

    return (
        <section className="relative w-full bg-custom-beige py-16">
            {/* Imagen del semicírculo izquierda */}
            <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-1/2">
                <img
                    src={semicircleImage}
                    alt="Decoración derecha"
                    className="absolute left-[-6em] top-1/2 transform -translate-y-1/2 w-32 md:w-40 lg:w-48"
                    style={{ clipPath: 'inset(0 0 0 50%)' }} // Corta la mitad derecha
                />
            </div>
            {/* Imagen derecha */}
            <div className="absolute right-0 top-1/2 transform -translate-y-1/2 w-1/2">
                <img
                    src={semicircleImage}
                    alt="Decoración izquierda"
                    className="absolute right-[-6em] top-1/2 transform -translate-y-1/2 w-32 md:w-40 lg:w-48"
                    style={{ clipPath: 'inset(0 50% 0 0)' }} // Corta la mitad izquierda
                />
            </div>

            {/* Contenido principal */}
            <div className="container mx-auto px-8 md:px-16 flex flex-col md:flex-row items-center justify-between">
                {/* Columna 1: Título y botón */}
                <div className="md:w-1/3 text-center md:text-left">
                    <h2 className="text-3xl font-bold text-title-dark">NUESTRAS ÁREAS DE ESPECIALIDAD</h2>
                    <button
                        onClick={() => navigate('/specialties')}
                        className="mt-6 bg-button-orange text-white py-2 px-6 rounded-full hover:bg-orange-700"
                    >
                        DESCUBRE MÁS →
                    </button>
                </div>

                {/* Columna 2: Especialidades */}
                <div className="md:w-2/3 flex flex-wrap justify-center md:justify-start gap-4 mt-6 md:mt-0">
                    {specialties.map((specialty, index) => (
                        <span
                            key={index}
                            className="bg-button-green text-white py-2 px-4 rounded-full shadow-md text-lg"
                        >
                            #{specialty}
                        </span>
                    ))}
                </div>
            </div>

        </section>
    );
};

export default Specialties;