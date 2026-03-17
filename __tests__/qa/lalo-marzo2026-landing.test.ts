// RUTA: __tests__/qa/lalo-marzo2026-landing.test.ts

/**
 * Tests de regresión — Batch 2: Landing content (Marzo 2026)
 *
 * A: FAQ content is up to date
 * B: Fake company testimonials are hidden
 * C: Home testimonials use card grid (not carousel)
 */

import * as fs from 'fs';
import * as path from 'path';

const readFile = (filePath: string) =>
  fs.readFileSync(path.join(process.cwd(), filePath), 'utf-8');

// ============================================================
// A: FAQ content
// ============================================================

describe('Batch 2A: FAQ content is current (9 preguntas)', () => {
  const content = readFile('src/components/sections/home/FAQSection.tsx');

  it('should have exactly 9 FAQ items', () => {
    const questions = content.match(/question:/g) || [];
    expect(questions.length).toBe(9);
  });

  it('should have the new question about transparency', () => {
    expect(content).toContain('¿Qué significa que nuestro proceso es transparente?');
  });

  it('should have the new question about INAKAT vs traditional agencies', () => {
    expect(content).toContain('¿Qué diferencia a INAKAT de una agencia de reclutamiento tradicional?');
  });

  it('should have the new question about accessibility vs other firms', () => {
    expect(content).toContain('¿Por qué INAKAT es más accesible que otras firmas de reclutamiento?');
  });

  it('should have the new question about human + technology', () => {
    expect(content).toContain('¿Por qué decimos que el proceso es humano complementado con tecnología?');
  });

  it('should mention calculadora de costo in pricing FAQ', () => {
    expect(content).toContain('calculadora de costo');
  });

  it('should mention specific cities: Monterrey, Morelia, CDMX, Puebla, Guadalajara', () => {
    expect(content).toContain('Monterrey');
    expect(content).toContain('Morelia');
    expect(content).toContain('Puebla');
    expect(content).toContain('Guadalajara');
  });
});

// ============================================================
// B: Fake company testimonials are hidden
// ============================================================

describe('Batch 2B: Fake company testimonials are hidden', () => {
  it('companies page should NOT import CompanyTestimonialsSection', () => {
    const content = readFile('src/app/companies/page.tsx');
    expect(content).not.toMatch(/import\s+CompanyTestimonialsSection/);
  });

  it('companies page should NOT render <CompanyTestimonialsSection', () => {
    const content = readFile('src/app/companies/page.tsx');
    expect(content).not.toMatch(/<CompanyTestimonialsSection/);
  });

  it('companies page should still have all other sections', () => {
    const content = readFile('src/app/companies/page.tsx');
    expect(content).toContain('CompaniesHeroSection');
    expect(content).toContain('CompanyBenefitsSection');
    expect(content).toContain('FormRegisterForQuotationSection');
    expect(content).toContain('Footer');
  });
});

// ============================================================
// C: Home testimonials redesign — card grid (not carousel)
// ============================================================

describe('Batch 2C: Home testimonials are card grid, not carousel', () => {
  const content = readFile('src/components/sections/home/TestimonialsSection.tsx');

  it('should NOT use setInterval (carousel auto-rotate)', () => {
    expect(content).not.toContain('setInterval');
  });

  it('should NOT use currentIndex state (carousel index)', () => {
    expect(content).not.toMatch(/currentIndex/);
  });

  it('should use a grid layout', () => {
    expect(content).toMatch(/grid-cols-1\s+md:grid-cols-/);
  });

  it('should still have Mayela Sánchez testimonial', () => {
    expect(content).toContain('Mayela Sánchez');
  });

  it('should still have Adrian Cuadros testimonial', () => {
    expect(content).toContain('Adrian Cuadros');
  });

  it('should still import Image from next/image', () => {
    expect(content).toMatch(/import.*Image.*from\s*['"]next\/image['"]/);
  });

  it('should still import client photos', () => {
    expect(content).toMatch(/import.*imgMayela/);
    expect(content).toMatch(/import.*imgAdrian/);
  });

  it('should render photos with <Image component', () => {
    expect(content).toMatch(/<Image[\s\S]*?testimonial\.image/);
  });

  it('should have Grupo 4S reference', () => {
    expect(content).toContain('Grupo 4S');
  });

  it('should have Reserhub reference', () => {
    expect(content).toContain('Reserhub');
  });
});
