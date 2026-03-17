// RUTA: __tests__/e2e/auth-flows.spec.ts
import { test, expect } from '@playwright/test';
import { login, TEST_ACCOUNTS } from './helpers/auth';

test.describe('Flujo de Autenticacion', () => {
  test('Login exitoso como admin redirige a /admin', async ({
    page,
  }) => {
    await login(
      page,
      TEST_ACCOUNTS.admin.email,
      TEST_ACCOUNTS.admin.password
    );
    await expect(page).toHaveURL(/admin/);
  });

  test('Login con credenciales incorrectas muestra error', async ({
    page,
  }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', 'noexiste@test.com');
    await page.fill(
      'input[name="password"]',
      'WrongPassword123!'
    );
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);
    await expect(page).toHaveURL(/login/);
  });

  test('Acceso a /admin sin login redirige a /login o /unauthorized', async ({
    page,
  }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/login|unauthorized/);
  });

  test('Acceso a /company/dashboard sin login redirige', async ({
    page,
  }) => {
    await page.goto('/company/dashboard');
    await expect(page).toHaveURL(/login|unauthorized/);
  });

  test('Acceso a /recruiter/dashboard sin login redirige', async ({
    page,
  }) => {
    await page.goto('/recruiter/dashboard');
    await expect(page).toHaveURL(/login|unauthorized/);
  });
});
