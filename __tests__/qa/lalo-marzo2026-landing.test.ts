// RUTA: __tests__/qa/lalo-marzo2026-landing.test.ts

/**
 * Tests de regresión — Batch 2: Landing content (Marzo 2026)
 *
 * B: Fake company testimonials are hidden
 *
 * INFRA-009: los bloques A (FAQ: 9 preguntas y su copy literal) y C
 * (testimonios de la home: clases grid, imports de fotos, nombres) leían los
 * componentes de la home como texto. Cualquier rediseño los rompía aunque la
 * página funcionara, así que se retiraron; la home se prueba por
 * comportamiento en __tests__/qa/infra-home-comportamiento.test.tsx.
 */

import * as fs from 'fs';
import * as path from 'path';

const readFile = (filePath: string) =>
  fs.readFileSync(path.join(process.cwd(), filePath), 'utf-8');

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
