// RUTA: src/components/sections/home/WhyInakatSection.tsx
// Lista editorial: número en contorno que se rellena al pasar, título y descripción.
import { Brain, Microscope, Bot, Eye, BarChart3, MapPin } from 'lucide-react';

const features = [
  {
    icon: Brain,
    title: 'Psicólogos expertos',
    description:
      'Evalúan actitud, valores y fit cultural. Cada candidato es analizado por profesionales de psicología organizacional.',
  },
  {
    icon: Microscope,
    title: 'Especialistas técnicos',
    description:
      'Validan que el candidato domina su disciplina. Líderes de industria evalúan las competencias reales.',
  },
  {
    icon: Bot,
    title: 'IA responsable',
    description:
      'No decide. Señala. Usamos inteligencia artificial como apoyo estratégico. El criterio siempre es humano.',
  },
  {
    icon: Eye,
    title: 'Transparencia total',
    description:
      'Ves cada paso del proceso en tiempo real. Sin sorpresas, sin cajas negras. Información clara desde el día uno.',
  },
  {
    icon: BarChart3,
    title: 'Reportes detallados',
    description:
      'Cada candidato viene con evaluación completa: perfil psicológico, competencias técnicas y recomendaciones.',
  },
  {
    icon: MapPin,
    title: 'Presencia nacional',
    description:
      'Conocemos el talento local de cada región de México. Conexiones estratégicas en las principales ciudades.',
  },
];

const WhyInakatSection = () => {
  return (
    <section className="hm-why" aria-labelledby="hm-why-title">
      <div className="hm-wrap">
        <div className="hm-why__head">
          <p className="hm-eyebrow">Por qué INAKAT</p>
          <h2 id="hm-why-title" className="hm-h2">
            ¿Por qué las empresas <em>eligen INAKAT?</em>
          </h2>
          <p className="hm-why__lead">
            Una combinación única de expertise humano y tecnología para encontrar
            al candidato ideal.
          </p>
        </div>

        <ol className="hm-why__list">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            const n = String(index + 1).padStart(2, '0');
            return (
              <li key={feature.title} className="hm-why__row hm-rv">
                <span className="hm-num" data-t={n} aria-hidden="true">
                  <span className="hm-num__fill">{n}</span>
                </span>
                <h3 className="hm-why__title">
                  <Icon aria-hidden="true" />
                  {feature.title}
                </h3>
                <p className="hm-why__desc">{feature.description}</p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
};

export default WhyInakatSection;
