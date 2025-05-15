import React from 'react';
import { useLocation } from 'react-router-dom';

import logoFooter from '../../assets/images/logo/logo-footer.png';

import { FaFacebook, FaLinkedin, FaInstagram, FaWhatsapp } from "react-icons/fa";

const Footer = () => {
    const location = useLocation();
    const currentPath = location.pathname;

    const isHome = currentPath === '/';
    const isTalents = currentPath === '/talents';

    const isAbout = currentPath === '/about';
    const footerBg = isAbout ? 'bg-title-dark' : isHome || isTalents ? 'bg-title-dark' : 'bg-number-green';
    const iconBg = isAbout ? 'bg-button-green' : isHome || isTalents ? 'bg-custom-beige' : 'bg-custom-beige';
    const iconText = isAbout ? '' : isHome ? 'text-button-green' : 'text-button-green';


    return (
        <footer className={`${footerBg} text-white`}>
            {/* Redes Sociales Bar */}
            
            <div className="relative">
                <div className="absolute top-[-1.5rem] left-1/2 transform -translate-x-1/2 flex gap-4">
                    <div className="flex gap-4">
                        <a href="https://wa.me/5200000000" target="_blank" rel="noopener noreferrer" className="hover:text-button-green">
                            <div className={`${iconBg} rounded-full p-3 ${iconText} hover:bg-button-green hover:text-white transition`}>
                                <FaWhatsapp className="text-xl" />
                            </div>
                        </a>
                        <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="hover:text-button-green">
                            <div className={`${iconBg} rounded-full p-3 ${iconText} hover:bg-button-green hover:text-white transition`}>
                                <FaLinkedin className="text-xl" />
                            </div>
                        </a>
                        <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="hover:text-button-green">
                            <div className={`${iconBg} rounded-full p-3 ${iconText} hover:bg-button-green hover:text-white transition`}>
                                <FaInstagram className="text-xl" />
                            </div>
                        </a>
                        <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className="hover:text-button-green">
                            <div className={`${iconBg} rounded-full p-3 ${iconText} hover:bg-button-green hover:text-white transition`}>
                                <FaFacebook className="text-xl" />
                            </div>
                        </a>
                    </div>
                </div>
            </div>
            
            <div>
                <br /><br />
                {/* CONTACTO Title Row */}
                <div className="container mx-auto mb-6">
                    <h3 className="text-xl font-bold">CONTACTO</h3>
                </div>

                {/* Grid Content */}
                <div className="container mx-auto grid grid-cols-1 md:grid-cols-4 gap-8 text-sm">
                    {/* Column 1: Oficinas */}
                    <div className="pr-4">
                    <div className="border-white h-full pr-4" style={{ borderRightWidth: '1px' }}>
                        <p className="text-button-green font-bold mb-2">OFICINAS</p>
                        <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="mt-1">
                                <span className="font-bold">GUADALAJARA</span>
                                <br />Lorem Ipsum Dolor<br />Sit Amet
                            </p>
                            <p className="mt-4">
                                <span className="font-bold">MONTERREY</span>
                                <br />Lorem Ipsum Dolor
                                <br />Sit Amet
                            </p>
                        </div>
                        <div>
                            <p className="mt-1">
                                <span className="font-bold">CDMX</span>
                                <br />Lorem Ipsum Dolor
                                <br />Sit Amet
                            </p>
                        </div>
                        </div>
                    </div>
                    </div>
                    {/* Column 2: Email / Teléfono */}
                    <div className="pr-4">
                    <div className="border-white h-full pr-4" style={{ borderRightWidth: '1px' }}>
                        <p className="text-button-green font-bold">EMAIL</p>
                        <p className="mt-1">info@inakat.com</p>
                        <p className="text-button-green font-bold mt-4">TELÉFONO</p>
                        <p className="mt-1">+52 00 00 00 00</p>
                    </div>
                    </div>
                    {/* Column 3: Info */}
                    <div className="px-4">
                        <p className="text-button-green font-bold">INFO</p>
                        <p className="mt-1">TÉRMINOS Y CONDICIONES</p>
                        <p className="mt-1">POLÍTICAS DE PRIVACIDAD</p>
                    </div>
                    {/* Column 4: Logo */}
                    <div className="flex justify-center md:justify-end items-start">
                        <img src={logoFooter} alt="INAKAT Logo" className="w-24" />
                    </div>
                </div>
                {/* Derechos Reservados */}
                <div className="text-center text-sm mt-6 pt-4">
                    <p>© {new Date().getFullYear()} INAKAT. Todos los derechos reservados.</p>
                </div>
            </div>
        </footer>
    );
};

export default Footer;