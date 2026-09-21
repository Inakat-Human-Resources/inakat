// RUTA: src/components/sections/home/SocialProofBar.tsx
// Marquesina de garantías. La primera lista es la real; la segunda es el duplicado
// que hace el bucle sin costura y va oculta a lectores de pantalla.

const metrics = [
  { value: '7 Áreas', label: 'de especialidad' },
  { value: 'Presencia', label: 'en toda la República' },
  { value: 'Evaluación', label: 'dual garantizada' },
  { value: 'IA + Humanos', label: 'en cada proceso' },
  { value: 'Transparencia', label: 'total en cada paso' },
];

const MetricList = ({ hidden = false }: { hidden?: boolean }) => (
  <ul className="hm-marquee__list" aria-hidden={hidden || undefined}>
    {metrics.map((metric) => (
      <li key={metric.value} className="hm-marquee__item">
        <span>
          {metric.value} <em>{metric.label}</em>
        </span>
      </li>
    ))}
  </ul>
);

const SocialProofBar = () => {
  return (
    <section className="hm-marquee hm-on-dark" aria-label="Lo que garantiza INAKAT">
      <div className="hm-marquee__row">
        <MetricList />
        <MetricList hidden />
      </div>
    </section>
  );
};

export default SocialProofBar;
