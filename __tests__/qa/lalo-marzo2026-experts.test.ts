// RUTA: __tests__/qa/lalo-marzo2026-experts.test.ts

/**
 * Tests de regresión — Batch 3: Expert cards with modal (Marzo 2026)
 *
 * A: Expert data updated with bios
 * B: Modal opens on click
 * C: Video button support
 */

import * as fs from 'fs';
import * as path from 'path';

const readFile = (filePath: string) =>
  fs.readFileSync(path.join(process.cwd(), filePath), 'utf-8');

describe('Batch 3: Expert cards data and modal', () => {
  const content = readFile('src/components/sections/aboutus/ExpertsSection.tsx');

  // -- Interface & data --

  it('Expert interface should have bio field', () => {
    expect(content).toMatch(/bio:\s*string/);
  });

  it('Expert interface should have optional videoUrl field', () => {
    expect(content).toMatch(/videoUrl\?:\s*string/);
  });

  it('should have at least 9 experts', () => {
    const nameMatches = content.match(/name:\s*'/g) || [];
    expect(nameMatches.length).toBeGreaterThanOrEqual(9);
  });

  it('every expert should have a bio', () => {
    const bioMatches = content.match(/bio:\s*'/g) || [];
    expect(bioMatches.length).toBeGreaterThanOrEqual(9);
  });

  // -- Real team members still present --

  it('should have Guillermo Sánchez', () => {
    expect(content).toContain('Guillermo Sánchez');
  });

  it('should have Alexandra Fetisova', () => {
    expect(content).toContain('Alexandra Fetisova');
  });

  it('should have Omar García', () => {
    expect(content).toMatch(/Omar García/);
  });

  it('should have Andrea Avalos', () => {
    expect(content).toContain('Andrea Avalos');
  });

  it('should have Sofía de León', () => {
    expect(content).toMatch(/Sofía de León/);
  });

  it('should have Ernesto Zapata', () => {
    expect(content).toContain('Ernesto Zapata');
  });

  it('should have André Gracia', () => {
    expect(content).toContain('André Gracia');
  });

  it('should have Alejandro Martínez', () => {
    expect(content).toContain('Alejandro Martínez');
  });

  it('should have Denisse Tamez Escamilla', () => {
    expect(content).toContain('Denisse Tamez Escamilla');
  });

  // -- Modal implementation --

  it('should have selectedExpert state for modal', () => {
    expect(content).toMatch(/selectedExpert/);
    expect(content).toMatch(/setSelectedExpert/);
  });

  it('cards should be clickable (button or onClick)', () => {
    expect(content).toMatch(/onClick=\{.*setSelectedExpert/);
  });

  it('modal should render when selectedExpert is set', () => {
    expect(content).toMatch(/selectedExpert\s*&&/);
  });

  it('modal should display bio text', () => {
    expect(content).toMatch(/selectedExpert\.bio/);
  });

  it('modal should have close button', () => {
    expect(content).toMatch(/setSelectedExpert\(null\)/);
  });

  it('modal should support videoUrl with external link', () => {
    expect(content).toMatch(/selectedExpert\.videoUrl/);
    expect(content).toMatch(/target="_blank"/);
  });

  it('should import X icon for close button', () => {
    expect(content).toMatch(/import.*X.*from\s*['"]lucide-react['"]/);
  });

  it('should import Play icon for video button', () => {
    expect(content).toMatch(/import.*Play.*from\s*['"]lucide-react['"]/);
  });

  // -- Photo imports --

  it('should have at least 9 photo imports', () => {
    const imports = content.match(/import\s+\w+\s+from\s+['"]@\/assets/g) || [];
    expect(imports.length).toBeGreaterThanOrEqual(9);
  });
});
