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
  const uploadRoute = readFile('src/app/api/upload/route.ts');

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
  const content = readFile('src/components/sections/aboutus/ExpertsSection.tsx');

  it('should NOT have placeholder names', () => {
    expect(content).not.toContain('David Bisbal');
    expect(content).not.toContain('Denisse Tamez');
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

  it('should have at least 8 experts', () => {
    const nameMatches = content.match(/name:\s*'/g) || [];
    expect(nameMatches.length).toBeGreaterThanOrEqual(8);
  });
});

// ============================================================
// P4 (09a32e6 + 901b9aa): TestimonialsSection — real client testimonials
// ============================================================

describe('P4-09a: TestimonialsSection uses real client testimonials', () => {
  const content = readFile('src/components/sections/home/TestimonialsSection.tsx');

  it('should NOT have generic "Equipo INAKAT" testimonials', () => {
    expect(content).not.toMatch(/author:\s*['"]Equipo INAKAT['"]/);
  });

  it('should have Mayela Sánchez testimonial', () => {
    expect(content).toContain('Mayela Sánchez');
  });

  it('should have Adrian Cuadros testimonial', () => {
    expect(content).toContain('Adrian Cuadros');
  });

  it('should reference Grupo 4S', () => {
    expect(content).toContain('Grupo 4S');
  });

  it('should reference Reserhub', () => {
    expect(content).toContain('Reserhub');
  });

  it('should import Image from next/image (for client photos)', () => {
    expect(content).toMatch(/import.*Image.*from\s*['"]next\/image['"]/);
  });

  it('should have image field in testimonials', () => {
    expect(content).toMatch(/image:\s*img(Mayela|Adrian)/);
  });

  it('should render testimonial photos', () => {
    expect(content).toMatch(/<Image[\s\S]*?testimonial\.image/);
  });
});

// ============================================================
// P5 (09a32e6): Hero image updated
// ============================================================

describe('P5-09a: Hero image is updated', () => {
  it('should import hero image file (not old 1.png)', () => {
    const content = readFile('src/components/sections/home/HeroSection.tsx');
    expect(content).toMatch(/import.*hero.*from/i);
    expect(content).toContain('hero-inakat');
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
// P1 (ed93ef8): 11 pasos del proceso en Home
// Home should show full 11-step process, not 4 simplified steps
// ============================================================

describe('P1-ed9: Home page shows full 11-step selection process', () => {
  it('should import SelectionProcessSection (not HowItWorksSection)', () => {
    const content = readFile('src/app/page.tsx');
    expect(content).toContain('SelectionProcessSection');
  });

  it('should NOT import HowItWorksSection', () => {
    const content = readFile('src/app/page.tsx');
    expect(content).not.toMatch(/import\s+HowItWorksSection/);
  });

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
  const navbar = readFile('src/components/commons/Navbar.tsx');
  const mobileSection = navbar.slice(navbar.indexOf('mobileMenuOpen && ('));

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
// P4 (ed93ef8): StatsSection — updated metrics
// ============================================================

describe('P4-ed9: StatsSection has updated wow metrics', () => {
  const content = readFile('src/components/sections/home/StatsSection.tsx');

  it('should show 11 (pasos)', () => {
    expect(content).toMatch(/value:\s*11/);
  });

  it('should show 7+ (áreas)', () => {
    expect(content).toMatch(/value:\s*7/);
  });

  it('should show 24 (días hábiles)', () => {
    expect(content).toMatch(/value:\s*24/);
  });

  it('should NOT still show 100% transparencia (old metric)', () => {
    expect(content).not.toMatch(/value:\s*100/);
  });
});

// ============================================================
// P5 (ed93ef8): FAQ updated
// ============================================================

describe('P5-ed9: FAQ has updated answers', () => {
  const content = readFile('src/components/sections/home/FAQSection.tsx');

  it('FAQ about duration should mention 11 etapas', () => {
    expect(content).toMatch(/11\s*etapas/);
  });

  it('FAQ about duration should mention 3-4 semanas', () => {
    expect(content).toMatch(/3\s*(y|a|-)\s*4\s*semanas/);
  });

  it('FAQ about pricing should mention créditos model', () => {
    expect(content).toMatch(/modelo\s*de\s*créditos/i);
  });

  it('FAQ about pricing should mention paquetes or cotización', () => {
    expect(content).toMatch(/paquetes|cotización/i);
  });
});

// ============================================================
// GENERAL: Structural integrity checks
// ============================================================

describe('Structural integrity', () => {
  it('Home page should have all expected sections', () => {
    const content = readFile('src/app/page.tsx');
    expect(content).toContain('HeroSection');
    expect(content).toContain('SelectionProcessSection');
    expect(content).toContain('TestimonialsSection');
    expect(content).toContain('StatsSection');
    expect(content).toContain('FAQSection');
    expect(content).toContain('Footer');
  });

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

  it('Testimonial photos should exist as imports', () => {
    const content = readFile('src/components/sections/home/TestimonialsSection.tsx');
    expect(content).toMatch(/import.*imgMayela/);
    expect(content).toMatch(/import.*imgAdrian/);
  });
});
