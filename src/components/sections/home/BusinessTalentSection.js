import React from 'react';
import { useNavigate } from 'react-router-dom';

// Importar imágenes
import backgroundImage from '../../../assets/images/1-home/1.png';
import arrowIcon from '../../../assets/images/1-home/3.png';
import companiesImage from '../../../assets/images/1-home/4.png';

const BusinessTalentSection = () => {
    const navigate = useNavigate();
        
    return (
        <>
            {/* Sección con fondo de la imagen */}
            <section
                className="relative bg-cover bg-center py-20"
                style={{ 
                    backgroundImage: `url(${backgroundImage})`, 
                    backgroundSize: 'cover', 
                    backgroundPosition: 'center', 
                    maxHeight: '500px' // Ajusta la altura para que solo cubra las tarjetas
                }}
            >
                <div className="container mx-auto flex flex-col md:flex-row justify-center gap-8 relative">
                    {/* Tarjeta Para Empresas */}
                    <div className="bg-button-green p-8 rounded-xl shadow-lg w-full md:w-1/2 relative">
                        <h2 className="text-white text-2xl font-bold">PARA <br /> EMPRESAS</h2>
                        <p className="text-white mt-2">
                            ¿En búsqueda de talentos? Registra tu empresa y conoce todo nuestro proceso de selección.
                        </p>
                        <img
                            src={arrowIcon}
                            alt="Flecha"
                            className="absolute top-4 right-4 w-6"
                        />
                        <button
                            onClick={() => navigate('/companies')}
                            className="mt-4 bg-button-orange text-white py-2 px-6 rounded hover:bg-orange-700"
                        >
                            Conoce más →
                        </button>
                    </div>

                    {/* Tarjeta Para Talentos */}
                    <div className="bg-custom-beige p-8 rounded-xl shadow-lg w-full md:w-1/2 relative">
                        <h2 className="text-number-green text-2xl font-bold">PARA <br /> TALENTOS</h2>
                        <p className="text-number-green mt-2">
                            ¿Buscas empleo? Regístrate, sube tu CV y en breve nos contactaremos contigo.
                        </p>
                        <img
                            src={arrowIcon}
                            alt="Flecha"
                            className="absolute top-4 right-4 w-6"
                        />
                        <button
                            onClick={() => navigate('/talents')}
                            className="mt-4 bg-button-orange text-white py-2 px-6 rounded hover:bg-orange-700"
                        >
                            Conoce más →
                        </button>
                    </div>
                </div>
            </section>

            {/* Logos de empresas (fuera de la imagen de fondo) */}
            {/*
            
            <div className="bg-title-dark py-6">
                <div className="container mx-auto flex justify-center gap-10">
                    <img
                        src={companiesImage}
                        alt="Flecha"
                    />
                </div>
            </div>
            */}
        </>
    );
};

export default BusinessTalentSection;