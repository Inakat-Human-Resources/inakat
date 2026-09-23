// RUTA: playwright.config.ts
import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

// INFRA-015: Playwright no lee ningún .env por sí solo, así que las variables
// de .env.e2e (E2E_BASE_URL, E2E_*_EMAIL, E2E_*_PASSWORD) se ignoraban y los
// helpers caían a contraseñas por defecto que no existían en ninguna base.
// Las variables ya definidas en el entorno (CI) tienen prioridad.
dotenv.config({ path: '.env.e2e', quiet: true });

const LOCAL_URL = 'http://localhost:3000';
const baseURL = process.env.E2E_BASE_URL || LOCAL_URL;

// INFRA-033: sólo se levanta un servidor propio cuando la suite apunta a
// localhost. Contra staging (E2E_BASE_URL remota) arrancar `next dev` en local
// sólo servía para esperar 120 s a un servidor sin .env y abortar.
const apuntaALocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/.test(baseURL);

export default defineConfig({
  testDir: './__tests__/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : 'html',
  timeout: 30000,

  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile',
      use: { ...devices['iPhone 14'] },
    },
  ],

  webServer: apuntaALocal
    ? {
        // En CI se prueba el artefacto de producción (build + start), que es lo
        // que corre en Vercel; en local basta con el servidor de desarrollo.
        command: process.env.CI ? 'npm run build && npm run start' : 'npm run dev',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: process.env.CI ? 300000 : 120000,
      }
    : undefined,
});
