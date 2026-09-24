/**
 * QA del revamp de la portada (septiembre 2026).
 *
 * Estos tests vigilan las reglas que NO se pueden romper al seguir tocando la home:
 * que se lea sin JavaScript, que respete "movimiento reducido", que no vuelva a
 * presentar una imagen generada por IA como si fuera el equipo real, y que el
 * contenido que el cliente aprobó (FAQ, testimonios, cifras) siga intacto.
 *
 * Son tests de código fuente, como el resto de __tests__/qa: no montan React.
 */
import fs from 'fs';
import path from 'path';

const readFile = (filePath: string): string =>
  fs.readFileSync(path.join(process.cwd(), filePath), 'utf-8');

const HOME = 'src/app/page.tsx';
const CSS = 'src/app/home.css';
// Las primitivas compartidas (máscaras, revelados, botones, tokens) salieron de
// home.css a site.css, el registro público que carga el layout raíz.
const SITE_CSS = 'src/app/site.css';

// ============================================================
// Estructura de la portada
// ============================================================

describe('Home revamp: estructura de la página', () => {
  const content = readFile(HOME);

  it('carga su propia hoja de estilos', () => {
    expect(content).toContain('./home.css');
  });

  it('envuelve la página en .hm (ámbito de los estilos de la home)', () => {
    expect(content).toMatch(/<main className=(\{`|")hm /);
  });

  it('las primitivas compartidas llegan por el layout raíz (site.css)', () => {
    expect(readFile('src/app/layout.tsx')).toContain('./site.css');
  });

  it('mantiene todas las secciones del recorrido', () => {
    for (const section of [
      'HeroSection',
      'SocialProofBar',
      'PhilosophySection',
      'SelectionProcessSection',
      'DualCTASection',
      'WhyInakatSection',
      'SpecialtiesSection',
      'StatsSection',
      'TestimonialsSection',
      'CoverageMapSection',
      'FAQSection',
      'Footer',
    ]) {
      expect(content).toContain(section);
    }
  });

  it('usa el proceso de selección en su variante de arco', () => {
    expect(content).toMatch(/<SelectionProcessSection\s+variant="arc"\s*\/>/);
  });
});

// ============================================================
// Accesibilidad y degradación: lo que se cobra si se rompe
// ============================================================

describe('Home revamp: se lee sin JavaScript y con movimiento reducido', () => {
  const css = readFile(CSS);
  const site = readFile(SITE_CSS);

  it('las animaciones de entrada cuelgan de .hm--js (sin JS el estado es el final)', () => {
    // Si una animación de entrada se declara fuera de .hm--js y el reloj de
    // animación no avanza, el contenido se queda invisible para siempre.
    for (const rule of ['.hm--js .hm-window', '.hm--js .hm-hero__foot']) {
      expect(css).toContain(rule);
    }
    // La máscara del titular es compartida: vive en site.css.
    expect(site).toContain('.hm--js .hm-line > span');
    expect(site).not.toMatch(/^\.hm-line > span \{[^}]*animation/m);
  });

  it('site.css también deja lo ligado al scroll tras @supports + movimiento no reducido', () => {
    expect(site).toContain('@supports (animation-timeline: view())');
    expect(site).toContain('prefers-reduced-motion: no-preference');
    const reduce = site.slice(site.lastIndexOf('@media (prefers-reduced-motion: reduce)'));
    expect(reduce).toContain('.hm--js .hm-line > span');
    expect(reduce).toContain('animation: none !important');
  });

  it('todo lo ligado al scroll vive tras @supports + prefers-reduced-motion', () => {
    expect(css).toContain('@supports (animation-timeline: view())');
    expect(css).toContain('prefers-reduced-motion: no-preference');
  });

  it('apaga explícitamente las animaciones en bucle con movimiento reducido', () => {
    const reduce = css.slice(css.lastIndexOf('@media (prefers-reduced-motion: reduce)'));
    for (const selector of ['.hm-marquee__row', '.hm-cue::before', '.hm-pin::after']) {
      expect(reduce).toContain(selector);
    }
    expect(reduce).toContain('animation: none !important');
  });

  it('devuelve overflow: visible a las secciones que fijan contenido', () => {
    // globals.css declara `section { overflow: hidden }`, y eso mata todo
    // `position: sticky` que viva dentro de una <section>.
    expect(css).toMatch(/\.hm-proc,[\s\S]{0,120}overflow: visible/);
  });

  it('la animación de entrada no arranca hasta que la pestaña es visible', () => {
    // En una pestaña de fondo (ctrl+click, restaurar sesión) el reloj de animación
    // no avanza, y un `both` deja el título y la foto congelados en su fotograma
    // inicial: invisibles. Por eso .hm--js se pone sólo con la pestaña visible.
    // HomeMotion se generalizó en SiteMotion (lo monta cualquier página pública).
    expect(readFile(HOME)).toContain('<SiteMotion />');
    const motion = readFile('src/components/ui/SiteMotion.tsx');
    expect(motion).toContain("document.visibilityState !== 'visible'");
    expect(motion).toContain("addEventListener('visibilitychange'");
    expect(motion).toContain("removeEventListener('visibilitychange'");
  });

  it('el título partido lleva nombre accesible y sus trozos van aria-hidden', () => {
    const hero = readFile('src/components/sections/home/HeroSection.tsx');
    expect(hero).toMatch(/<h1[^>]*aria-label=\{lines\.join\(' '\)\}/);
    expect((hero.match(/aria-hidden="true"/g) || []).length).toBeGreaterThanOrEqual(3);
  });

  it('los acordeones son <details> nativos (teclado y sin-JS gratis)', () => {
    const faq = readFile('src/components/sections/home/FAQSection.tsx');
    const esp = readFile('src/components/sections/home/SpecialtiesSection.tsx');
    expect(faq).toMatch(/<details\s+key=/);
    expect(esp).toMatch(/<details\s+key=/);
  });
});

// ============================================================
// Honestidad del contenido
// ============================================================

describe('Home revamp: honestidad del contenido', () => {
  it('la foto generada por IA no se presenta como el equipo de INAKAT', () => {
    const hero = readFile('src/components/sections/home/HeroSection.tsx');
    expect(hero).not.toMatch(/alt="Equipo INAKAT/);
    expect(hero).toMatch(/alt="Ilustración/);
  });

  it('la marquesina no duplica su contenido para los lectores de pantalla', () => {
    const bar = readFile('src/components/sections/home/SocialProofBar.tsx');
    expect(bar).toMatch(/<MetricList hidden \/>/);
    expect(bar).toMatch(/aria-hidden=\{hidden \|\| undefined\}/);
  });

  it('conserva los dos testimonios reales con su empresa', () => {
    const t = readFile('src/components/sections/home/TestimonialsSection.tsx');
    for (const s of ['Mayela Sánchez', 'Grupo 4S', 'Adrian Cuadros', 'Reserhub']) {
      expect(t).toContain(s);
    }
  });

  it('conserva las 9 preguntas frecuentes aprobadas', () => {
    const faq = readFile('src/components/sections/home/FAQSection.tsx');
    expect((faq.match(/question:/g) || []).length).toBe(9);
    expect(faq).toContain('calculadora de costo');
  });

  it('conserva las cuatro cifras de la portada', () => {
    const stats = readFile('src/components/sections/home/StatsSection.tsx');
    for (const v of [/value: 100/, /value: 150/, /value: 15\b/, /value: 11/]) {
      expect(stats).toMatch(v);
    }
  });

  it('el mapa usa la versión con los estados sin cobertura visibles', () => {
    // El PNG original pintaba esos estados en (224,224,208) y el suelo de la
    // sección es #e8e7d4: 1.07:1 de contraste, o sea medio país invisible.
    const cov = readFile('src/components/sections/home/CoverageMapSection.tsx');
    expect(cov).toContain('mapa-cobertura.png');
    expect(cov).not.toContain('1-home/7.png');
  });

  it('cada ciudad del mapa tiene una posición dentro de la imagen', () => {
    const cov = readFile('src/components/sections/home/CoverageMapSection.tsx');
    const pos = [...cov.matchAll(/name: '([^']+)', top: '([\d.]+)%', left: '([\d.]+)%'/g)];
    expect(pos.length).toBeGreaterThanOrEqual(7);
    for (const [, nombre, top, left] of pos) {
      expect(Number(top)).toBeGreaterThan(0);
      expect(Number(top)).toBeLessThan(100);
      expect(Number(left)).toBeGreaterThan(0);
      expect(Number(left)).toBeLessThan(100);
      expect(nombre.length).toBeGreaterThan(2);
    }
    // Comprobaciones geográficas: Monterrey al norte de CDMX, y CDMX al oeste de Mérida
    const de = (n: string) => pos.find((p) => p[1] === n)!;
    expect(Number(de('Monterrey')[2])).toBeLessThan(Number(de('CDMX')[2]));
    expect(Number(de('CDMX')[3])).toBeLessThan(Number(de('Mérida')[3]));
    expect(Number(de('Guadalajara')[3])).toBeLessThan(Number(de('CDMX')[3]));
  });

  it('el hero usa el recorte en retrato, no la imagen horizontal estirada', () => {
    // La original es 1920x1280; mostrada en un arco vertical con cover se
    // ampliaba 1.73x y se veía borrosa.
    const hero = readFile('src/components/sections/home/HeroSection.tsx');
    expect(hero).toContain('hero-inakat-retrato.jpg');
    const css = readFile(CSS);
    expect(css).not.toMatch(/\.hm-window img \{[^}]*height: 140%/);
  });

  it('el teléfono y el correo del cierre son enlaces accionables', () => {
    const close = readFile('src/components/sections/home/HomeCloseSection.tsx');
    expect(close).toContain('mailto:info@inakat.com');
    expect(close).toContain('tel:+528116312490');
  });
});

// ============================================================
// El proceso de selección sigue siendo una sola fuente de datos
// ============================================================

describe('Home revamp: el proceso de selección no se duplicó', () => {
  const process = readFile('src/components/sections/aboutus/SelectionProcessSection.tsx');

  it('/about sigue usando la variante de rejilla', () => {
    const about = readFile('src/app/about/page.tsx');
    expect(about).toContain('SelectionProcessSection');
    expect(about).not.toContain('variant="arc"');
  });

  it('las 11 etapas viven en un único archivo', () => {
    expect(process).toContain('const mainSteps');
    expect(process).toContain('const postSteps');
    const arc = readFile('src/components/sections/home/ProcessArc.tsx');
    expect(arc).not.toContain('Definición del perfil');
  });

  it('la variante de arco recibe las 11 etapas', () => {
    expect(process).toMatch(/\.\.\.mainSteps\.map/);
    expect(process).toMatch(/\.\.\.postSteps\.map/);
  });
});
