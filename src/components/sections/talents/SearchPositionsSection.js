import React, { useState } from 'react';


// Iconos
import { FaSearch, FaMapMarkerAlt, FaBriefcase, FaBookmark, FaEllipsisV } from "react-icons/fa";

// Datos de ejemplo para vacantes
const jobListings = [
    {
        id: 1,
        title: "Asistente Administrativo",
        company: "Walmart",
        location: "Monterrey, Nuevo León",
        salary: "$25,000 - $35,000 / mes",
        type: "Tiempo Completo",
        remote: true,
        rating: 4.3,
        description: "Estamos buscando un individuo altamente organizado y proactivo para unirse a nuestro equipo como Asistente Administrativo. En este rol, serás responsable de proporcionar apoyo administrativo crucial para garantizar el funcionamiento eficiente de nuestras operaciones diarias."+
                        "Buscamos a alguien con excelentes habilidades de comunicación, capacidad para manejar múltiples tareas y una fuerte atención al detalle."+
                        "Si te apasiona trabajar en un entorno dinámico y colaborativo, ¡esperamos conocerte pronto!"
        },
    {
        id: 2,
        title: "Analista de Recursos Humanos",
        company: "Amazon",
        location: "CDMX",
        salary: "$30,000 - $40,000 / mes",
        type: "Medio Tiempo",
        remote: false,
        rating: 4.7,
        description: "Buscamos a alguien con excelentes habilidades de comunicación y capacidad para manejar múltiples tareas...",
    },
];

const Talents = () => {
    const [selectedJob, setSelectedJob] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");

    // Filtrar vacantes por búsqueda
    const filteredJobs = jobListings.filter(job =>
        job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.company.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <>
            <section className="bg-custom-beige text-text-black">
                {/* Sección 2: Filtros de Búsqueda */}
                <div className="bg-soft-green text-white py-24 mt-20">
                    <div className="container mx-auto text-center">
                        {/* Título */}
                        <h2 className="text-3xl font-bold mb-10">DESCUBRE TUS OPORTUNIDADES</h2>

                        {/* Filtros */}
                        <div className="flex flex-col md:flex-row justify-center gap-4 mb-10">
                            {/* Filtro de Puesto/Área/Empresa */}
                            <div className="relative w-full md:w-1/4">
                                <input
                                    type="text"
                                    placeholder="Buscar puesto, área, empresa"
                                    className="w-full p-3 pl-10 text-black rounded-full"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                                <FaBriefcase className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500" />
                            </div>

                            {/* Filtro de Ubicación */}
                            <div className="relative w-full md:w-1/5">
                                <input
                                    type="text"
                                    placeholder="Ubicación"
                                    className="w-full p-3 pl-10 text-black rounded-full"
                                />
                                <FaMapMarkerAlt className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500" />
                            </div>

                            {/* Filtro de Modalidad de Trabajo */}
                            <div className="relative w-full md:w-1/5">
                                <select className="w-full p-3 pl-10 text-black rounded-full">
                                    <option value="">Modalidad de trabajo</option>
                                    <option value="remoto">Remoto</option>
                                    <option value="hibrido">Híbrido</option>
                                    <option value="en-sitio">En Sitio</option>
                                </select>
                            </div>

                            {/* Botón de Buscar */}
                            <button className="bg-button-green text-white py-3 px-6 rounded-full hover:bg-green-700">
                                <FaSearch className="inline-block mr-2" /> BUSCAR
                            </button>
                        </div>

                        {/* Contenedor de Vacantes Completo */}
                        <div className="bg-custom-beige p-6 rounded-lg shadow-lg">
                            {/* Opciones: Guardados, Postulados, Vencidos y Ordenar por */}
                            <div className="flex justify-between items-center mb-6">
                                <div className="flex">
                                    <button className="text-black font-bold border-2 border-gray-600 px-6 py-2 rounded-full hover:border-button-green mx-2">
                                        Guardados
                                    </button>
                                    <button className="text-black font-bold border-2 border-gray-600 px-6 py-2 rounded-full hover:border-button-green mx-2">
                                        Postulados
                                    </button>
                                    <button className="text-black font-bold border-2 border-gray-600 px-6 py-2 rounded-full hover:border-button-green mx-2">
                                        Vencidos
                                    </button>
                                </div>
                                <button className="text-black font-bold border-2 border-gray-600 px-6 py-2 rounded-full hover:border-button-green ml-2">
                                    Ordenar por
                                </button>
                            </div>

                            {/* Lista de Vacantes y Detalle */}
                            <div className="container mx-auto flex flex-col md:flex-row gap-6">
                                {/* Columna Izquierda: Lista de Vacantes */}
                                <div className="w-full md:w-1/2">
                                    {filteredJobs.map(job => (
                                        <div
                                            key={job.id}
                                            className="bg-white p-6 rounded-lg shadow-lg mb-4 cursor-pointer hover:shadow-xl relative text-left"
                                            onClick={() => setSelectedJob(job)}
                                        >
                                            {/* Iconos de Guardado y Opciones */}
                                            <div className="absolute top-4 right-4 flex gap-2">
                                                <FaBookmark className="text-gray-500 hover:text-button-green cursor-pointer" />
                                                <FaEllipsisV className="text-gray-500 hover:text-button-green cursor-pointer" />
                                            </div>

                                            {/* Información de la Vacante */}
                                            <p className="text-gray-500 text-sm">Publicado hace 7 min.</p>
                                            
                                            {/* ✅ TÍTULO - Alinear a la izquierda */}
                                            <h3 className="text-xl font-bold text-black mt-2 text-left">{job.title}</h3>

                                            <p className="text-gray-600 text-left">{job.company} ★ {job.rating}</p>
                                            <p className="text-gray-600 text-left">{job.location}</p>

                                            {/* ✅ SALARIO - Asegurar alineación */}
                                            <p className="font-bold text-black mt-2 text-left">Salario:</p>
                                            <p className="font-bold text-black text-left">{job.salary}</p>

                                            {/* ✅ ETIQUETAS - Alineación correcta */}
                                            <div className="flex gap-2 mt-2 text-left">
                                                <span className="bg-gray-800 text-white px-3 py-1 rounded-full text-sm">{job.type}</span>
                                                {job.remote && <span className="bg-orange-500 text-white px-3 py-1 rounded-full text-sm">Remoto</span>}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Columna Derecha: Detalle de Vacante */}
                                <div className="w-full md:w-1/2">
                                    {selectedJob ? (
                                        <div className="bg-white p-6 rounded-lg shadow-lg text-left max-h-full overflow-visible relative">
                                            {/* Iconos de Guardado y Opciones */}
                                            <div className="absolute top-4 right-4 flex gap-2">
                                                <FaBookmark className="text-gray-500 hover:text-button-green cursor-pointer" />
                                                <FaEllipsisV className="text-gray-500 hover:text-button-green cursor-pointer" />
                                            </div>

                                            <p className="text-gray-500 text-sm">Publicado hace 7 min.</p>
                                            
                                            {/* ✅ TÍTULO EN NEGRITAS Y VISIBLE */}
                                            <h3 className="text-xl font-bold text-black mt-2">{selectedJob.title}</h3>

                                            <p className="text-gray-600">{selectedJob.company} ★ {selectedJob.rating}</p>
                                            <p className="text-gray-600">{selectedJob.location}</p>

                                            {/* ✅ SALARIO EN NEGRITAS Y VISIBLE */}
                                            <p className="font-bold text-black mt-2">Salario:</p>
                                            <p className="font-bold text-black">{selectedJob.salary}</p>

                                            {/* ✅ ETIQUETAS - Tipo de Trabajo y Modalidad */}
                                            <div className="flex gap-2 mt-2">
                                                <span className="bg-gray-800 text-white px-3 py-1 rounded-full text-sm">{selectedJob.type}</span>
                                                {selectedJob.remote && <span className="bg-orange-500 text-white px-3 py-1 rounded-full text-sm">Remoto</span>}
                                            </div>

                                            {/* ✅ TEXTO DE DESCRIPCIÓN ASEGURANDO SU VISIBILIDAD */}
                                            <p className="mt-4 text-black whitespace-pre-line break-words leading-relaxed overflow-visible">
                                                {selectedJob.description}
                                            </p>

                                            <button className="bg-button-green text-white py-3 px-6 rounded-full mt-4 hover:bg-green-700">
                                                POSTULARSE →
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="text-center text-gray-500 p-6">
                                            <p>Selecciona una vacante para ver los detalles.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </>
    );
};

export default Talents;