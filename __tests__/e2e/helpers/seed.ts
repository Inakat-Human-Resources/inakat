// RUTA: __tests__/e2e/helpers/seed.ts

/**
 * Cómo preparar los datos de la suite E2E (INFRA-015).
 *
 * La suite usa las cuentas que crea el seed del proyecto (ver TEST_ACCOUNTS en
 * ./auth.ts); no hace falta ningún script aparte.
 *
 * En local:
 *   1. `.env` con DATABASE_URL apuntando a una base LOCAL y las SEED_*_PASSWORD
 *      (ver .env.example). El seed se niega a correr contra una base remota.
 *   2. `npx prisma db push && npx prisma db seed`
 *   3. `cp .env.e2e.example .env.e2e` y en cada E2E_<ROL>_PASSWORD la misma
 *      contraseña que su SEED_<ROL>_PASSWORD:
 *        E2E_ADMIN_PASSWORD      = SEED_ADMIN_PASSWORD
 *        E2E_COMPANY_PASSWORD    = SEED_COMPANY_PASSWORD
 *        E2E_RECRUITER_PASSWORD  = SEED_RECRUITER_PASSWORD
 *        E2E_SPECIALIST_PASSWORD = SEED_SPECIALIST_PASSWORD
 *        E2E_CANDIDATE_PASSWORD  = SEED_CANDIDATE_PASSWORD
 *      Si definiste ADMIN_EMAIL, pon el mismo valor en E2E_ADMIN_EMAIL.
 *   4. `npm run test:e2e` (playwright.config.ts carga .env.e2e y levanta el
 *      servidor local).
 *
 * Contra staging: E2E_BASE_URL con la URL remota (Playwright ya no arranca un
 * servidor local) y E2E_<ROL>_EMAIL / E2E_<ROL>_PASSWORD con cuentas de staging.
 * Nunca contra producción.
 *
 * Lo que el seed deja y la suite necesita: empresa con créditos y vacantes
 * activas, reclutador y especialista, candidato con cuenta y paquetes de
 * créditos activos.
 */
export {};
