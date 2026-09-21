// RUTA: src/components/sections/home/ProcessArc.tsx
// Escena fijada de la home: el punto recorre el arco del isotipo, una etapa por tramo.
// Los datos viven en aboutus/SelectionProcessSection (fuente única de las 11 etapas).
// Sin scroll timelines o con movimiento reducido, home.css lo deja como lista ordenada.

export interface ProcessArcStep {
  number: number;
  title: string;
  tag: string;
}

const ProcessArc = ({ steps }: { steps: ProcessArcStep[] }) => {
  return (
    <section className="hm-proc hm-on-dark" aria-labelledby="hm-proc-title">
      <div className="hm-proc__stage">
        <div className="hm-wrap">
          <div className="hm-proc__head">
          <p className="hm-eyebrow">Nuestro proceso de selección</p>
          <h2 id="hm-proc-title" className="hm-h2">
            {steps.length} etapas antes de <em>presentarte a alguien.</em>
          </h2>
          <p className="hm-proc__lead">
            Delega el proceso de reclutamiento en expertos, liberando a tu equipo
            para centrarse en objetivos clave.
          </p>
          </div>
        </div>

        <div className="hm-proc__body">
          <div className="hm-proc__dial" aria-hidden="true">
            <span className="hm-proc__ring" />
            <span className="hm-proc__ring hm-proc__ring--in" />
            {steps.map((step, i) => (
              <span
                key={step.number}
                className="hm-tick"
                style={{ '--i': i } as React.CSSProperties}
              />
            ))}
            <span className="hm-runner" />
          </div>

          <div className="hm-wrap">
            <ol className="hm-steps">
              {steps.map((step, i) => (
                <li
                  key={step.number}
                  className="hm-step"
                  style={{ '--i': i } as React.CSSProperties}
                >
                  <span className="hm-step__n" aria-hidden="true">
                    {String(step.number).padStart(2, '0')}
                  </span>
                  <h3 className="hm-step__t">{step.title}</h3>
                  <span className="hm-step__d">{step.tag}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ProcessArc;
