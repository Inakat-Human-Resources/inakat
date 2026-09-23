// RUTA: __tests__/qa/feb2026-regression.test.ts

/**
 * Tests de regresión — Sesiones 23-24 Febrero 2026
 * Verifica que bugs corregidos y features implementadas no se reviertan.
 *
 * Commits cubiertos:
 * - 09a32e6: P1-P6 (interviews API, upload MIME, experts, testimonials, hero, admin injection)
 * - 901b9aa: Fotos testimonios (Mayela, Adrian)
 * - ed93ef8: P1-P5 (11 pasos Home, navbar mobile admin, notif logs, stats, FAQ)
 */

import * as fs from 'fs';
import * as path from 'path';

const readFile = (filePath: string) =>
  fs.readFileSync(path.join(process.cwd(), filePath), 'utf-8');

// INFRA-009: los bloques que leían los componentes de la HOME y afirmaban su
// copy o su implementación (testimonios, hero, 11 pasos en page.tsx, stats, FAQ
// y las secciones que importa page.tsx) se retiraron: rompían el CI con cada
// rediseño aunque la home funcionara. La home se prueba por comportamiento en
// __tests__/qa/infra-home-comportamiento.test.tsx.
//
// Las lecturas que quedan se hacen en beforeAll y no al declarar el describe:
// si un archivo se renombra, fallan sólo los tests de ese bloque, no la suite
// entera.

// ============================================================
// P1 (09a32e6): Admin Interviews API — response format
// Bug: API retornaba {interviews} pero frontend esperaba {success, data}
// ============================================================

describe('P1-09a: Admin interviews API returns correct format', () => {
  it('should return success field in response', () => {
    const content = readFile('src/app/api/admin/interviews/route.ts');
    expect(content).toContain('success: true');
  });

  it('should return data field (not just interviews)', () => {
    const content = readFile('src/app/api/admin/interviews/route.ts');
    expect(content).toMatch(/data:\s*interviews/);
  });

  it('should return pagination in response', () => {
    const content = readFile('src/app/api/admin/interviews/route.ts');
    expect(content).toContain('pagination');
  });

  it('frontend should check for success or interviews field', () => {
    const content = readFile('src/app/admin/interviews/page.tsx');
    expect(content).toMatch(/data\.(success|interviews)/);
  });
});

// ============================================================
// P2 (09a32e6): Upload — accept .docx, .xlsx formats
// Bug: MIME type for Word/Excel was rejected
// ============================================================

describe('P2-09a: Upload route accepts office document formats', () => {
  let uploadRoute = '';
  beforeAll(() => {
    uploadRoute = readFile('src/app/api/upload/route.ts');
  });

  it('should allow .docx MIME type', () => {
    expect(uploadRoute).toContain('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  });

  it('should allow .doc MIME type', () => {
    expect(uploadRoute).toContain('application/msword');
  });

  it('should allow .xlsx MIME type', () => {
    expect(uploadRoute).toContain('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  });

  it('should allow .xls MIME type', () => {
    expect(uploadRoute).toContain('application/vnd.ms-excel');
  });

  it('should have .docx in ALLOWED_EXTENSIONS', () => {
    expect(uploadRoute).toContain('.docx');
  });

  it('should have .xlsx in ALLOWED_EXTENSIONS', () => {
    expect(uploadRoute).toContain('.xlsx');
  });

  it('error message should mention DOC/DOCX/XLS/XLSX', () => {
    expect(uploadRoute).toMatch(/DOC.*DOCX|DOCX.*DOC/i);
  });
});

describe('P2-09a: Company form accepts office documents', () => {
  it('should accept .docx and .xlsx in file input', () => {
    const content = readFile('src/components/sections/companies/FormRegisterForQuotationSection.tsx');
    expect(content).toContain('.docx');
    expect(content).toContain('.xlsx');
  });
});

// ============================================================
// P3 (09a32e6): ExpertsSection — real team profiles
// Replaced placeholder names with real INAKAT team
// ============================================================

describe('P3-09a: ExpertsSection uses real team profiles', () => {
  let content = '';
  beforeAll(() => {
    content = readFile('src/components/sections/aboutus/ExpertsSection.tsx');
  });

  it('should NOT have placeholder names', () => {
    expect(content).not.toContain('David Bisbal');
    // Denisse Tamez Escamilla is now a real team member (added in f656093)
    expect(content).not.toContain('Javier Martínez');
    expect(content).not.toContain('Diego Torres');
    expect(content).not.toContain('Laura Pérez');
    expect(content).not.toContain('Marcos Rodríguez');
    expect(content).not.toContain('Martha López');
  });

  it('should have Guillermo Sánchez (Fundador)', () => {
    expect(content).toContain('Guillermo Sánchez');
  });

  it('should have Alexandra Fetisova', () => {
    expect(content).toContain('Alexandra Fetisova');
  });

  it('should have Omar García Jane', () => {
    expect(content).toMatch(/Omar García/);
  });

  it('should have Andrea Ávalos', () => {
    expect(content).toContain('Andrea Ávalos');
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

  it('should have at least 8 experts', () => {
    const nameMatches = content.match(/name:\s*'/g) || [];
    expect(nameMatches.length).toBeGreaterThanOrEqual(8);
  });
});

// ============================================================
// P6 (09a32e6): Candidate injection — admin only
// ============================================================

describe('P6-09a: Candidate injection is admin-only', () => {
  it('admin/candidates page should exist', () => {
    expect(fs.existsSync(path.join(process.cwd(), 'src/app/admin/candidates/page.tsx'))).toBe(true);
  });

  it('admin layout should have force-dynamic', () => {
    const content = readFile('src/app/admin/layout.tsx');
    expect(content).toContain('force-dynamic');
  });

  it('middleware should protect /admin routes', () => {
    const content = readFile('src/middleware.ts');
    expect(content).toMatch(/admin/);
  });

  it('assign-candidates route should be under /api/admin/ (middleware-protected)', () => {
    // This route is protected by middleware (pathname.startsWith('/api/admin/'))
    expect(fs.existsSync(path.join(process.cwd(), 'src/app/api/admin/assign-candidates/route.ts'))).toBe(true);
  });

  it('middleware should reject non-admin users for /admin routes', () => {
    const content = readFile('src/middleware.ts');
    expect(content).toMatch(/role\s*!==\s*['"]admin['"]/);
  });
});

// ============================================================
// P1 (ed93ef8): 11 pasos del proceso de selección
// (INFRA-009: ya no se afirma qué importa src/app/page.tsx; sólo el contenido
// del componente de proceso, que también usa /about)
// ============================================================

describe('P1-ed9: SelectionProcessSection shows the full 11-step process', () => {
  it('SelectionProcessSection should have 11 steps total', () => {
    const content = readFile('src/components/sections/aboutus/SelectionProcessSection.tsx');
    const mainSteps = content.match(/number:\s*\d+/g) || [];
    expect(mainSteps.length).toBeGreaterThanOrEqual(11);
  });

  it('SelectionProcessSection should have post-hire steps (10 and 11)', () => {
    const content = readFile('src/components/sections/aboutus/SelectionProcessSection.tsx');
    expect(content).toContain('Seguimiento post contratación');
    expect(content).toContain('Evaluación continua');
  });
});

// ============================================================
// P2 (ed93ef8): Navbar mobile — admin links
// Mobile menu was missing ALL admin links
// ============================================================

describe('P2-ed9: Navbar mobile menu has admin links', () => {
  let mobileSection = '';
  beforeAll(() => {
    const navbar = readFile('src/components/commons/Navbar.tsx');
    mobileSection = navbar.slice(navbar.indexOf('mobileMenuOpen && ('));
  });

  it('mobile menu should have Vacantes link for admin', () => {
    expect(mobileSection).toContain('/admin"');
  });

  it('mobile menu should have Asignar Equipo link', () => {
    expect(mobileSection).toContain('/admin/assignments');
  });

  it('mobile menu should have Asignar Candidatos link', () => {
    expect(mobileSection).toContain('/admin/assign-candidates');
  });

  it('mobile menu should have Gestión Entrevistas link', () => {
    expect(mobileSection).toContain('/admin/interviews');
  });

  it('mobile menu should have Candidatos Interesados link', () => {
    expect(mobileSection).toContain('/admin/direct-applications');
  });

  it('mobile menu should have Empresas link', () => {
    expect(mobileSection).toContain('/admin/requests');
  });

  it('mobile menu should have Vendedores link', () => {
    expect(mobileSection).toContain('/admin/vendors');
  });

  it('mobile menu should have Paquetes de Créditos link', () => {
    expect(mobileSection).toContain('/admin/credit-packages');
  });

  it('mobile menu should have Precios link', () => {
    expect(mobileSection).toContain('/admin/pricing');
  });

  it('mobile menu should have Candidatos (sistema) link', () => {
    expect(mobileSection).toContain('/admin/candidates');
  });

  it('mobile menu should have Usuarios link', () => {
    expect(mobileSection).toContain('/admin/users');
  });

  it('mobile menu should have Especialidades link', () => {
    expect(mobileSection).toContain('/admin/specialties');
  });

  it('mobile menu should be scrolleable (max-h + overflow-y)', () => {
    expect(mobileSection).toMatch(/max-h-\[.*\].*overflow-y-auto|overflow-y-auto.*max-h/);
  });

  it('admin links should only show for admin role', () => {
    expect(mobileSection).toMatch(/user\.role\s*===\s*['"]admin['"]/);
  });
});

// ============================================================
// P3 (ed93ef8): Notifications — debug logging
// ============================================================

describe('P3-ed9: notifyAllAdmins has debug logging', () => {
  it('should have console.log for debugging', () => {
    const content = readFile('src/lib/notifications.ts');
    expect(content).toMatch(/console\.log.*notifyAllAdmins|console\.log.*NOTIF/);
  });

  it('should still filter admins by isActive: true', () => {
    const content = readFile('src/lib/notifications.ts');
    expect(content).toContain('isActive: true');
  });

  it('should still filter by role admin', () => {
    const content = readFile('src/lib/notifications.ts');
    expect(content).toMatch(/role:\s*['"]admin['"]/);
  });
});

// ============================================================
// GENERAL: Structural integrity checks
// ============================================================

describe('Structural integrity', () => {
  it('About page should have all expected sections', () => {
    const content = readFile('src/app/about/page.tsx');
    expect(content).toContain('ExpertsSection');
    expect(content).toContain('SelectionProcessSection');
    expect(content).toContain('Footer');
  });

  it('All 8 expert photos should exist as imports', () => {
    const content = readFile('src/components/sections/aboutus/ExpertsSection.tsx');
    const imports = content.match(/import\s+\w+\s+from\s+['"]@\/assets/g) || [];
    expect(imports.length).toBeGreaterThanOrEqual(8);
  });
});
