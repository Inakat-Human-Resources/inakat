// RUTA: __tests__/e2e/helpers/seed.ts

/**
 * Instrucciones para preparar datos de E2E:
 *
 * Antes de correr E2E tests, asegurarse de que la DB de test/staging tiene:
 * 1. Un usuario admin con las credenciales de TEST_ACCOUNTS.admin
 * 2. Un usuario company con creditos > 10
 * 3. Un usuario recruiter asignado como reclutador
 * 4. Un usuario specialist asignado como especialista
 * 5. Un usuario candidate con perfil completo
 * 6. Al menos 1 vacante activa
 * 7. Al menos 1 paquete de creditos activo
 *
 * Usar el script existente: npx tsx prisma/seed.ts
 * O crear: npx tsx scripts/seed-e2e.ts para datos especificos de E2E
 */
export {};
