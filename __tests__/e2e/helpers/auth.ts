// RUTA: __tests__/e2e/helpers/auth.ts
import { Page } from '@playwright/test';

/**
 * Login helper — inicia sesion con credenciales dadas
 */
export async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.includes('/login'), {
    timeout: 10000,
  });
}

/**
 * Credenciales de test por rol
 * NOTA: Estas cuentas deben existir en la DB de test/staging
 */
export const TEST_ACCOUNTS = {
  admin: {
    email: 'admin@inakat.com',
    password: process.env.E2E_ADMIN_PASSWORD || 'TestAdmin123!',
  },
  company: {
    email: 'empresa@test.com',
    password: process.env.E2E_COMPANY_PASSWORD || 'TestCompany123!',
  },
  recruiter: {
    email: 'reclutador@test.com',
    password: process.env.E2E_RECRUITER_PASSWORD || 'TestRecruiter123!',
  },
  specialist: {
    email: 'especialista@test.com',
    password: process.env.E2E_SPECIALIST_PASSWORD || 'TestSpecialist123!',
  },
  candidate: {
    email: 'candidato@test.com',
    password: process.env.E2E_CANDIDATE_PASSWORD || 'TestCandidate123!',
  },
};
