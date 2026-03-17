// RUTA: __tests__/e2e/company-registration.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Registro de Empresa — Formulario', () => {
  test('formulario de registro carga todos los campos', async ({
    page,
  }) => {
    await page.goto('/companies');
    await expect(
      page.locator('input[name="nombre"]')
    ).toBeVisible();
    await expect(
      page.locator('input[name="apellidoPaterno"]')
    ).toBeVisible();
    await expect(
      page.locator('input[name="email"], input[name="correoEmpresa"]').first()
    ).toBeVisible();
  });

  test('campo departamento NO debe prerrellenarse con email', async ({
    page,
  }) => {
    await page.goto('/companies');
    const deptInput = page.locator(
      'input[name="departamento"]'
    );
    await deptInput.scrollIntoViewIfNeeded();
    const value = await deptInput.inputValue();
    expect(value).toBe('');
    const autocomplete =
      (await deptInput.getAttribute('autocomplete')) ||
      (await deptInput.getAttribute('autoComplete'));
    expect(autocomplete).not.toBe('email');
    expect(autocomplete).not.toBe('username');
  });

  test('validacion muestra errores en campos vacios', async ({
    page,
  }) => {
    await page.goto('/companies');
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.scrollIntoViewIfNeeded();
    await submitButton.click();
    await page.waitForTimeout(500);
    const errorMessages = await page
      .locator('.text-red-500, .text-red-600, [role="alert"]')
      .count();
    expect(errorMessages).toBeGreaterThan(0);
  });
});
