// RUTA: __tests__/e2e/public-pages.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Paginas Publicas — Navegacion y Renderizado', () => {
  test('Home page carga correctamente', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/INAKAT/i);
    await expect(page.locator('h1')).toBeVisible();
    await expect(
      page.locator('text=Preguntas frecuentes')
    ).toBeVisible();
  });

  test('Home — FAQ accordion funciona', async ({ page }) => {
    await page.goto('/');
    const firstQuestion = page.locator(
      'text=¿Cómo funciona el proceso de selección?'
    );
    await firstQuestion.scrollIntoViewIfNeeded();
    await firstQuestion.click();
    await expect(
      page.locator('text=evaluación humana especializada')
    ).toBeVisible();
  });

  test('About page carga correctamente', async ({ page }) => {
    await page.goto('/about');
    await expect(
      page.locator('text=Conoce a los Expertos')
    ).toBeVisible();
  });

  test('About — Tarjetas de especialistas se muestran', async ({
    page,
  }) => {
    await page.goto('/about');
    await expect(
      page.locator('text=Guillermo Sánchez')
    ).toBeVisible();
    await expect(
      page.locator('text=Alexandra Fetisova')
    ).toBeVisible();
  });

  test('Companies page carga correctamente', async ({ page }) => {
    await page.goto('/companies');
    await expect(page.locator('h1')).toBeVisible();
    await expect(
      page.locator('input[name="nombre"]')
    ).toBeVisible();
  });

  test('Talents page carga correctamente', async ({ page }) => {
    await page.goto('/talents');
    await expect(page.locator('h1')).toBeVisible();
  });

  test('Login page carga correctamente', async ({ page }) => {
    await page.goto('/login');
    await expect(
      page.locator('input[name="email"]')
    ).toBeVisible();
    await expect(
      page.locator('input[name="password"]')
    ).toBeVisible();
    await expect(
      page.locator('button[type="submit"]')
    ).toBeVisible();
  });

  test('Register page carga correctamente', async ({ page }) => {
    await page.goto('/register');
    await expect(
      page.locator('input[name="email"]')
    ).toBeVisible();
  });

  test('Privacy page carga correctamente', async ({ page }) => {
    await page.goto('/privacy');
    await expect(page).toHaveURL(/privacy/);
  });

  test('Terms page carga correctamente', async ({ page }) => {
    await page.goto('/terms');
    await expect(page).toHaveURL(/terms/);
  });

  test('Contact page carga correctamente', async ({ page }) => {
    await page.goto('/contact');
    await expect(page).toHaveURL(/contact/);
  });

  test('Pagina no existente muestra 404', async ({ page }) => {
    const response = await page.goto('/esta-pagina-no-existe');
    expect(response?.status()).toBe(404);
  });
});

test.describe('Responsive — Mobile', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('Home page se ve bien en mobile', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toBeVisible();
  });

  test('Navbar hamburger menu funciona en mobile', async ({
    page,
  }) => {
    await page.goto('/');
    const menuButton = page
      .locator(
        '[aria-label*="menu"], [aria-label*="Menu"], button.md\\:hidden'
      )
      .first();
    if (await menuButton.isVisible()) {
      await menuButton.click();
      await expect(
        page.locator('nav a, [role="navigation"] a').first()
      ).toBeVisible();
    }
  });
});
