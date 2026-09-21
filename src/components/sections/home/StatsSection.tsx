// RUTA: src/components/sections/home/StatsSection.tsx
// Cifras en contorno que se rellenan al pasar. Las cifras se pintan desde el servidor
// (sin contador JS): se leen igual sin JavaScript y con movimiento reducido.

const stats = [
  { value: 100, suffix: '%', label: 'evaluados por humanos', sublabel: 'cero decisiones de IA' },
  { value: 150, suffix: '+', label: 'especialistas en la red', sublabel: 'psicólogos + técnicos' },
  { value: 15, suffix: '+', label: 'estados con presencia', sublabel: 'en toda la república' },
  { value: 11, suffix: '', label: 'etapas de evaluación', sublabel: 'antes de presentar candidatos' },
];

const StatsSection = () => {
  return (
    <section className="hm-stats" aria-labelledby="hm-stats-title">
      <div className="hm-wrap">
        <h2 id="hm-stats-title" className="sr-only">
          INAKAT en cifras
        </h2>
        <dl className="hm-stats__grid">
          {stats.map((stat) => {
            const text = `${stat.value}${stat.suffix}`;
            return (
              <div key={stat.label} className="hm-stat">
                <dt className="hm-stat__l">
                  {stat.label}
                  {stat.sublabel && <small>{stat.sublabel}</small>}
                </dt>
                <dd className="hm-stat__v" data-t={text}>
                  <span>{text}</span>
                </dd>
              </div>
            );
          })}
        </dl>
      </div>
    </section>
  );
};

export default StatsSection;
