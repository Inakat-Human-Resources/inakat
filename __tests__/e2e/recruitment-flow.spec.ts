// RUTA: __tests__/e2e/recruitment-flow.spec.ts
import { test, expect } from '@playwright/test';
import { login, TEST_ACCOUNTS } from './helpers/auth';

/**
 * Flujo completo de reclutamiento:
 * Empresa publica vacante -> Admin asigna -> Reclutador evalua ->
 * Especialista evalua -> Empresa revisa candidatos
 *
 * PREREQUISITOS: DB de staging con datos de seed
 */

test.describe('Flujo de Reclutamiento E2E', () => {
  test('Empresa puede ver su dashboard con vacantes', async ({
    page,
  }) => {
    await login(
      page,
      TEST_ACCOUNTS.company.email,
      TEST_ACCOUNTS.company.password
    );
    await page.goto('/company/dashboard');
    await expect(page.locator('text=Mis Vacantes')).toBeVisible();
    await expect(page.locator('text=Activas')).toBeVisible();
  });

  test('Empresa puede acceder al formulario de crear vacante', async ({
    page,
  }) => {
    await login(
      page,
      TEST_ACCOUNTS.company.email,
      TEST_ACCOUNTS.company.password
    );
    await page.goto('/create-job');
    await expect(
      page.locator('input[name="title"]')
    ).toBeVisible();
    await expect(page.locator('text=créditos')).toBeVisible();
  });

  test('Reclutador puede ver su dashboard con candidatos asignados', async ({
    page,
  }) => {
    await login(
      page,
      TEST_ACCOUNTS.recruiter.email,
      TEST_ACCOUNTS.recruiter.password
    );
    await page.goto('/recruiter/dashboard');
    await expect(
      page
        .locator('text=Sin Revisar')
        .or(page.locator('text=En Proceso'))
    ).toBeVisible();
  });

  test('Especialista puede ver su dashboard', async ({ page }) => {
    await login(
      page,
      TEST_ACCOUNTS.specialist.email,
      TEST_ACCOUNTS.specialist.password
    );
    await page.goto('/specialist/dashboard');
    await expect(page).toHaveURL(/specialist/);
  });

  test('Admin puede ver panel principal', async ({ page }) => {
    await login(
      page,
      TEST_ACCOUNTS.admin.email,
      TEST_ACCOUNTS.admin.password
    );
    await page.goto('/admin');
    await expect(
      page
        .locator('text=admin')
        .or(page.locator('text=Admin'))
        .or(page.locator('text=Dashboard'))
    ).toBeVisible();
  });

  test('Admin puede ver lista de candidatos', async ({ page }) => {
    await login(
      page,
      TEST_ACCOUNTS.admin.email,
      TEST_ACCOUNTS.admin.password
    );
    await page.goto('/admin/candidates');
    await expect(page).toHaveURL(/admin\/candidates/);
  });

  test('Admin puede ver solicitudes de empresa', async ({
    page,
  }) => {
    await login(
      page,
      TEST_ACCOUNTS.admin.email,
      TEST_ACCOUNTS.admin.password
    );
    await page.goto('/admin/requests');
    await expect(page).toHaveURL(/admin\/requests/);
  });
});
