// RUTA: __tests__/qa/lalo-marzo2026-bugs.test.ts

/**
 * Tests de regresión — Batch 1: Bug fixes (Marzo 2026)
 *
 * Bug A: Vacante se pierde al no tener créditos suficientes
 * Bug B: Campo departamento se autocompleta con datos del navegador
 * Bug C: Google Maps no muestra establecimientos en CreateJobForm
 */

import * as fs from 'fs';
import * as path from 'path';

const readFile = (filePath: string) =>
  fs.readFileSync(path.join(process.cwd(), filePath), 'utf-8');

// ============================================================
// Bug A: Vacante loss on insufficient credits
// handleSubmit must return boolean, modal must await before redirect
// ============================================================

describe('Bug A: Vacante saved as draft before credit redirect', () => {
  const content = readFile('src/components/sections/jobs/CreateJobForm.tsx');

  it('handleSubmit should return a boolean (true/false)', () => {
    // Must have "return true" and "return false" patterns
    expect(content).toContain('return true');
    expect(content).toContain('return false');
  });

  it('should have isSavingDraft state', () => {
    expect(content).toMatch(/isSavingDraft/);
    expect(content).toMatch(/setIsSavingDraft/);
  });

  it('insufficient credits modal should await handleSubmit before redirect', () => {
    expect(content).toMatch(/await handleSubmit/);
  });

  it('should only redirect to /credits/purchase if save succeeded', () => {
    // Pattern: if (saved) { ... router.push('/credits/purchase')
    expect(content).toMatch(/if\s*\(saved\)/);
    expect(content).toContain("router.push('/credits/purchase')");
  });

  it('modal button should say "Comprar Créditos y Guardar en Borrador"', () => {
    expect(content).toContain('Comprar Créditos y Guardar en Borrador');
  });

  it('modal button should be disabled while saving', () => {
    expect(content).toMatch(/disabled=\{isSavingDraft\}/);
  });
});

// ============================================================
// Bug B: Departamento field autofill
// Browser should NOT autofill department with personal data
// ============================================================

describe('Bug B: Departamento field does not trigger browser autofill', () => {
  const content = readFile(
    'src/components/sections/companies/FormRegisterForQuotationSection.tsx'
  );

  it('should NOT use autoComplete="organization-title"', () => {
    // Must not have the old value that triggers autofill
    expect(content).not.toMatch(
      /name="departamento"[\s\S]{0,200}autoComplete="organization-title"/
    );
  });

  it('should use autoComplete="one-time-code" to prevent autofill', () => {
    expect(content).toMatch(
      /name="departamento"[\s\S]{0,200}autoComplete="one-time-code"/
    );
  });

  it('should have a hidden dummy input to absorb autofill', () => {
    expect(content).toMatch(/display:\s*['"]?none['"]?/);
    expect(content).toMatch(/autoComplete="organization-title"/);
  });

  it('departamento input should have role="presentation"', () => {
    expect(content).toMatch(
      /name="departamento"[\s\S]{0,400}role="presentation"/
    );
  });
});

// ============================================================
// Bug C: Google Maps not showing establishments in CreateJobForm
// Autocomplete types must include 'establishment'
// ============================================================

describe('Bug C: Google Maps shows establishments in CreateJobForm', () => {
  const content = readFile('src/components/sections/jobs/CreateJobForm.tsx');

  it('should NOT have types: [\'address\'] (too restrictive)', () => {
    expect(content).not.toMatch(/types:\s*\[\s*['"]address['"]\s*\]/);
  });

  it('should include "geocode" in Autocomplete types', () => {
    expect(content).toContain("'geocode'");
  });

  it('should include "establishment" in Autocomplete types', () => {
    expect(content).toContain("'establishment'");
  });

  it('should request "name" field from Places API', () => {
    expect(content).toMatch(/fields:\s*\[[\s\S]*?'name'[\s\S]*?\]/);
  });

  it('should use place.name for establishments in location string', () => {
    expect(content).toMatch(/place\.name/);
  });

  it('FormRegisterForQuotation should already have correct types', () => {
    const formContent = readFile(
      'src/components/sections/companies/FormRegisterForQuotationSection.tsx'
    );
    expect(formContent).toContain("'geocode'");
    expect(formContent).toContain("'establishment'");
  });
});
