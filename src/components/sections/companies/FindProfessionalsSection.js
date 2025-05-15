import React from 'react';
import image15 from '../../../assets/images/3-companies/15.png';

const FindProfessionals = () => {
    return (
        <section className="bg-soft-beige py-16">
            <div className="container mx-auto">
                <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16 mb-8">
                    <img src={image15} alt="Professional icon 1" className="w-1/2 h-full" />
                    <h2 className="text-3xl md:text-4xl font-bold text-title-dark text-center max-w-4xl mx-auto leading-tight text-right">
                        ENCUENTRA A LOS PROFESIONALES QUE HARÁN REALIDAD LA VISIÓN DE TU EMPRESA
                    </h2>
                </div>
            </div>
        </section>
    );
};

export default FindProfessionals;