// RUTA: src/components/sections/home/CoverageMapSection.tsx
import Image from 'next/image';
import mapImage from '@/assets/images/1-home/7.png';

// Posición de cada ciudad medida sobre 7.png (1840 × 1265 px), en % del ancho/alto.
const cities = [
  { name: 'CDMX', top: '74.5%', left: '56.8%' },
  { name: 'Monterrey', top: '43%', left: '53.5%' },
  { name: 'Guadalajara', top: '65.6%', left: '43.5%' },
  { name: 'Puebla', top: '75.5%', left: '59.8%' },
  { name: 'Querétaro', top: '67.2%', left: '54.6%' },
];

const cityList = ['CDMX', 'Monterrey', 'Guadalajara', 'Puebla', 'Querétaro', 'León', 'Mérida', 'Y más...'];

const CoverageMapSection = () => {
  return (
    <section className="hm-cov" aria-labelledby="hm-cov-title">
      <div className="hm-wrap hm-cov__grid">
        <div>
          <p className="hm-eyebrow">Cobertura</p>
          <h2 id="hm-cov-title" className="hm-h2" style={{ marginTop: '1.2rem' }}>
            Presencia en toda <em>la República Mexicana</em>
          </h2>
          <p className="hm-cov__lead">
            Conexiones estratégicas en las principales ciudades del país.
            Conocemos el mercado laboral local para conectarte con el
            mejor talento de cada región.
          </p>

          <ul className="hm-cities">
            {cityList.map((city) => (
              <li key={city} className="hm-rv">
                {city}
              </li>
            ))}
          </ul>
        </div>

        <div className="hm-map">
          <Image
            src={mapImage}
            alt="Mapa de cobertura INAKAT en la República Mexicana"
            sizes="(max-width: 900px) 100vw, 58vw"
            loading="lazy"
          />
          {/* Decorativos: las ciudades ya están en la lista de texto */}
          {cities.map((city, index) => (
            <span
              key={city.name}
              className="hm-pin"
              aria-hidden="true"
              style={{ top: city.top, left: city.left, '--i': index } as React.CSSProperties}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default CoverageMapSection;
