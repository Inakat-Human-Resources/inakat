import React from "react";
import Image from "next/image";
import mapImage from "@/assets/images/2-about/27.png";

const states = [
  "Baja California Sur",
  "Aguascalientes",
  "Campeche",
  "Chihuahua",
  "Morelos",
  "Durango",
  "Guanajuato",
  "Baja California",
  "Sonora",
  "Yucatán",
  "Morelia",
  "Puebla",
  "Querétaro",
  "Coahuila",
  "San Luis",
  "Sinaloa",
  "Tamaulipas",
  "Toluca",
  "Veracruz",
  "Zacatecas",
];

const offices = ["Nuevo León", "Estado de México", "Jalisco"];

const LocationSection = () => {
  return (
    <section className="bg-soft-green text-white py-20">
      <div className="container mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
        {/* Left Column: Text and State List */}
        <div>
          <h2 className="text-3xl font-bold mb-6">
            TENEMOS PRESENCIA EN LA <br />
            MAYORÍA DE LOS ESTADOS DE <br />
            LA REPÚBLICA MEXICANA
          </h2>

          {/* State List */}
          <div className="flex flex-wrap gap-2 mb-6">
            {states.map((state, index) => (
              <span
                key={index}
                className="bg-lemon-green text-white px-4 py-2 rounded-full text-sm font-medium"
              >
                {state}
              </span>
            ))}
          </div>

          {/* Office Locations */}
          <h3 className="text-xl font-bold mt-6">CONTAMOS CON OFICINAS EN:</h3>
          <div className="flex flex-wrap gap-2 mt-2">
            {offices.map((office, index) => (
              <span
                key={index}
                className="bg-orange-500 text-white px-4 py-2 rounded-full text-sm font-medium"
              >
                {office}
              </span>
            ))}
          </div>
        </div>

        {/* Right Column: Map Image */}
        <div className="flex justify-center">
          <Image
            src={mapImage}
            alt="Mapa de México"
            className="w-full max-w-lg"
          />
        </div>
      </div>
    </section>
  );
};

export default LocationSection;
