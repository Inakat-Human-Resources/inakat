// RUTA: src/components/sections/home/CoverageMapSection.tsx
import Image from 'next/image';
import mapImage from '@/assets/images/1-home/mapa-cobertura.png';

// Posición de cada ciudad sobre el mapa, en % del ancho/alto de la imagen.
//
// No están puestas a ojo: el PNG ya marca en naranja tres estados, y sus centroides
// (medidos analizando el archivo por color) sirven de ancla geográfica —
// CDMX 56.9%/74.9%, Jalisco 41.6%/68.1%, Nuevo León 53.9%/41.2%. De ahí sale la
// proyección de este mapa, que resultó ser prácticamente equirectangular:
//
//   x% = 56.9 + (lon + 99.13) * 3.46        y% = 74.9 - (lat - 19.43) * 5.90
//
// Si alguna vez se cambia la imagen del mapa, hay que rehacer estas cuentas.
const cities = [
  { name: 'CDMX', top: '74.9%', left: '56.9%' },
  { name: 'Monterrey', top: '38.0%', left: '52.8%' },
  { name: 'Guadalajara', top: '67.6%', left: '42.3%' },
  { name: 'Puebla', top: '77.2%', left: '60.1%' },
  { name: 'Querétaro', top: '68.1%', left: '52.5%' },
  { name: 'León', top: '64.9%', left: '48.1%' },
  { name: 'Mérida', top: '65.8%', left: '89.9%' },
];

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
            {cities.map((city) => (
              <li key={city.name} className="hm-rv">
                {city.name}
              </li>
            ))}
            <li className="hm-rv hm-cities__mas">Y más…</li>
          </ul>
        </div>

        <div className="hm-map">
          <Image
            src={mapImage}
            alt="Mapa de la República Mexicana con las ciudades donde INAKAT tiene presencia"
            sizes="(max-width: 900px) 92vw, 58vw"
            loading="lazy"
          />
          {/* Decorativos: la lista de ciudades de al lado es la versión accesible */}
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
