// RUTA: src/components/sections/home/PhilosophySection.tsx
// Manifiesto con palabras que se encienden al pasar. El texto real va en un span
// sr-only; los trozos visuales van aria-hidden para que el lector de pantalla lea
// frases y no palabras sueltas.

type Segment = { text: string; bold?: boolean };

const paragraphs: Segment[][] = [
  [
    {
      text: 'En INAKAT entendemos que reclutar no es solo cubrir un puesto. Es encontrar a la persona adecuada',
    },
    {
      text: 'para el rol, la cultura y las condiciones reales de tu empresa.',
      bold: true,
    },
  ],
  [
    { text: 'Sabemos que' },
    {
      text: 'un candidato no es solo lo que sabe hacer, sino cómo se comporta, cómo se comunica, cómo se adapta, cuánto le importa el puesto y si realmente puede sostenerlo en el tiempo.',
      bold: true,
    },
  ],
  [
    { text: 'Por eso,' },
    {
      text: 'no elegimos solo por currículum, elegimos por compatibilidad, compromiso, ubicación, cultura y realidad humana.',
      bold: true,
    },
  ],
];

const LitParagraph = ({ segments }: { segments: Segment[] }) => {
  const words = segments.flatMap((segment) =>
    segment.text.split(' ').map((word) => ({ word, bold: segment.bold }))
  );

  return (
    <p>
      <span className="sr-only">{segments.map((s) => s.text).join(' ')}</span>
      <span aria-hidden="true">
        {words.map(({ word, bold }, i) => (
          <span key={i}>
            <span
              className={bold ? 'hm-w hm-w--b' : 'hm-w'}
              style={{ '--w': i % 9 } as React.CSSProperties}
            >
              {word}
            </span>{' '}
          </span>
        ))}
      </span>
    </p>
  );
};

const PhilosophySection = () => {
  return (
    <section className="hm-manifesto" aria-labelledby="hm-manifesto-title">
      <span className="hm-manifesto__deco" aria-hidden="true" />
      <div className="hm-wrap hm-manifesto__grid">
        <div className="hm-manifesto__head">
          <p className="hm-eyebrow">Nuestra filosofía</p>
          <h2 id="hm-manifesto-title" className="hm-h2">
            Reclutamiento con <em>sentido humano</em>
          </h2>
        </div>

        <div className="hm-manifesto__text">
          {paragraphs.map((segments, i) => (
            <LitParagraph key={i} segments={segments} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default PhilosophySection;
