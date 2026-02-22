// RUTA: __tests__/api/auth-reset-password.test.ts

import * as fs from 'fs';
import * as path from 'path';

const readFile = (filePath: string) =>
  fs.readFileSync(path.join(process.cwd(), filePath), 'utf-8');

// ============================================================
// 2A: Schema — resetToken y resetTokenExpiry en User
// ============================================================

describe('Schema: resetToken fields', () => {
  const schema = readFile('prisma/schema.prisma');

  it('should have resetToken field on User', () => {
    expect(schema).toContain('resetToken');
  });

  it('should have resetTokenExpiry field on User', () => {
    expect(schema).toContain('resetTokenExpiry');
  });

  it('resetToken should be optional and unique', () => {
    const userModel = schema.match(/model User \{[\s\S]*?\n\}/);
    expect(userModel).toBeTruthy();
    const model = userModel![0];
    expect(model).toMatch(/resetToken\s+String\?\s+@unique/);
  });

  it('resetTokenExpiry should be DateTime?', () => {
    const userModel = schema.match(/model User \{[\s\S]*?\n\}/);
    const model = userModel![0];
    expect(model).toMatch(/resetTokenExpiry\s+DateTime\?/);
  });
});

// ============================================================
// 2B: API forgot-password
// ============================================================

describe('API: /api/auth/forgot-password', () => {
  it('should exist', () => {
    const filePath = path.join(process.cwd(), 'src/app/api/auth/forgot-password/route.ts');
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it('should export POST handler', () => {
    const content = readFile('src/app/api/auth/forgot-password/route.ts');
    expect(content).toContain('export async function POST');
  });

  it('should use crypto.randomBytes for token', () => {
    const content = readFile('src/app/api/auth/forgot-password/route.ts');
    expect(content).toContain('crypto');
    expect(content).toContain('randomBytes');
  });

  it('should set 1 hour expiry', () => {
    const content = readFile('src/app/api/auth/forgot-password/route.ts');
    expect(content).toContain('3600000');
  });

  it('should send email with reset link', () => {
    const content = readFile('src/app/api/auth/forgot-password/route.ts');
    expect(content).toContain('sendEmail');
    expect(content).toContain('resetUrl');
    expect(content).toContain('reset-password?token=');
  });

  it('should always return same response (security)', () => {
    const content = readFile('src/app/api/auth/forgot-password/route.ts');
    expect(content).toContain('Si el correo está registrado');
  });
});

// ============================================================
// 2C: API reset-password
// ============================================================

describe('API: /api/auth/reset-password', () => {
  it('should exist', () => {
    const filePath = path.join(process.cwd(), 'src/app/api/auth/reset-password/route.ts');
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it('should export POST handler', () => {
    const content = readFile('src/app/api/auth/reset-password/route.ts');
    expect(content).toContain('export async function POST');
  });

  it('should validate password length >= 6', () => {
    const content = readFile('src/app/api/auth/reset-password/route.ts');
    expect(content).toContain('password.length < 6');
  });

  it('should verify token is valid and not expired', () => {
    const content = readFile('src/app/api/auth/reset-password/route.ts');
    expect(content).toContain('resetToken: token');
    expect(content).toContain('resetTokenExpiry');
    expect(content).toContain('gt');
  });

  it('should use hashPassword from auth lib', () => {
    const content = readFile('src/app/api/auth/reset-password/route.ts');
    expect(content).toContain('hashPassword');
    expect(content).toContain("from '@/lib/auth'");
  });

  it('should clear token after successful reset', () => {
    const content = readFile('src/app/api/auth/reset-password/route.ts');
    expect(content).toContain('resetToken: null');
    expect(content).toContain('resetTokenExpiry: null');
  });
});

// ============================================================
// 2D: Page forgot-password
// ============================================================

describe('Page: /forgot-password', () => {
  it('should exist', () => {
    const filePath = path.join(process.cwd(), 'src/app/forgot-password/page.tsx');
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it('should have email input', () => {
    const content = readFile('src/app/forgot-password/page.tsx');
    expect(content).toContain('type="email"');
    expect(content).toContain('email');
  });

  it('should call /api/auth/forgot-password', () => {
    const content = readFile('src/app/forgot-password/page.tsx');
    expect(content).toContain('/api/auth/forgot-password');
  });

  it('should show success state after submit', () => {
    const content = readFile('src/app/forgot-password/page.tsx');
    expect(content).toContain('sent');
    expect(content).toContain('Correo enviado');
  });

  it('should have link back to login', () => {
    const content = readFile('src/app/forgot-password/page.tsx');
    expect(content).toContain('/login');
    expect(content).toContain('Volver al login');
  });
});

// ============================================================
// 2E: Page reset-password
// ============================================================

describe('Page: /reset-password', () => {
  it('should exist', () => {
    const filePath = path.join(process.cwd(), 'src/app/reset-password/page.tsx');
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it('should read token from URL params', () => {
    const content = readFile('src/app/reset-password/page.tsx');
    expect(content).toContain('useSearchParams');
    expect(content).toContain("searchParams.get('token')");
  });

  it('should have password and confirm fields', () => {
    const content = readFile('src/app/reset-password/page.tsx');
    expect(content).toContain('password');
    expect(content).toContain('confirmPassword');
  });

  it('should validate passwords match', () => {
    const content = readFile('src/app/reset-password/page.tsx');
    expect(content).toContain('password !== confirmPassword');
    expect(content).toContain('no coinciden');
  });

  it('should call /api/auth/reset-password', () => {
    const content = readFile('src/app/reset-password/page.tsx');
    expect(content).toContain('/api/auth/reset-password');
  });

  it('should redirect to login after success', () => {
    const content = readFile('src/app/reset-password/page.tsx');
    expect(content).toContain("router.push('/login')");
  });

  it('should use Suspense for useSearchParams', () => {
    const content = readFile('src/app/reset-password/page.tsx');
    expect(content).toContain('Suspense');
  });

  it('should show/hide password toggle', () => {
    const content = readFile('src/app/reset-password/page.tsx');
    expect(content).toContain('showPassword');
    expect(content).toContain('Eye');
    expect(content).toContain('EyeOff');
  });
});

// ============================================================
// 2F: Migration SQL
// ============================================================

describe('Migration: PENDING_reset_token.sql', () => {
  it('should exist', () => {
    const filePath = path.join(process.cwd(), 'prisma/migrations/PENDING_reset_token.sql');
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it('should add resetToken column', () => {
    const content = readFile('prisma/migrations/PENDING_reset_token.sql');
    expect(content).toContain('resetToken');
    expect(content).toContain('ALTER TABLE');
  });

  it('should add resetTokenExpiry column', () => {
    const content = readFile('prisma/migrations/PENDING_reset_token.sql');
    expect(content).toContain('resetTokenExpiry');
  });

  it('should create unique index on resetToken', () => {
    const content = readFile('prisma/migrations/PENDING_reset_token.sql');
    expect(content).toContain('UNIQUE INDEX');
    expect(content).toContain('User_resetToken_key');
  });
});

// ============================================================
// Login page link update
// ============================================================

describe('Login page forgot-password link', () => {
  it('should link to /forgot-password instead of WhatsApp', () => {
    const content = readFile('src/app/login/page.tsx');
    expect(content).toContain('/forgot-password');
    expect(content).not.toContain('wa.me');
  });
});

// ============================================================
// 3A-3D: Console cleanup
// ============================================================

describe('Console cleanup', () => {
  it('3A: webhook mercadopago should not have console.log', () => {
    const content = readFile('src/app/api/webhooks/mercadopago/route.ts');
    // Should NOT have console.log (only console.info, console.error, console.warn)
    const logMatches = content.match(/console\.log/g);
    expect(logMatches).toBeNull();
  });

  it('3A: webhook mercadopago should use console.info for audit', () => {
    const content = readFile('src/app/api/webhooks/mercadopago/route.ts');
    expect(content).toContain('console.info');
  });

  it('3B: credit purchases should use console.info', () => {
    const content = readFile('src/app/api/credits/purchases/route.ts');
    const logMatches = content.match(/console\.log/g);
    expect(logMatches).toBeNull();
    expect(content).toContain('console.info');
  });

  it('3C: email lib should use console.info for sent', () => {
    const content = readFile('src/lib/email.ts');
    expect(content).toContain("console.info('[Email] Sent:'");
  });

  it('3D: auth lib should keep console.warn', () => {
    const content = readFile('src/lib/auth.ts');
    expect(content).toContain('console.warn');
  });
});

// ============================================================
// 1D: Scrollbar-hide CSS
// ============================================================

describe('Scrollbar-hide CSS', () => {
  it('should have scrollbar-hide class in globals.css', () => {
    const content = readFile('src/app/globals.css');
    expect(content).toContain('.scrollbar-hide');
    expect(content).toContain('scrollbar-width: none');
    expect(content).toContain('-webkit-scrollbar');
  });

  it('specialist tabs should use scrollbar-hide', () => {
    const content = readFile('src/app/specialist/jobs/[jobId]/page.tsx');
    expect(content).toContain('scrollbar-hide');
  });
});

// ============================================================
// 1A: Admin table responsive columns
// ============================================================

describe('Admin table responsive columns', () => {
  it('should hide secondary columns on mobile', () => {
    const content = readFile('src/app/admin/page.tsx');
    // Headers and cells should have hidden classes
    expect(content).toContain('hidden md:table-cell');
    expect(content).toContain('hidden lg:table-cell');
  });
});

// ============================================================
// 1B: Stats cards truncate
// ============================================================

describe('Admin stats cards', () => {
  it('should have truncate on long labels', () => {
    const content = readFile('src/app/admin/page.tsx');
    expect(content).toContain('truncate');
    expect(content).toContain('min-w-0');
  });
});
