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

type Rol = 'admin' | 'company' | 'recruiter' | 'specialist' | 'candidate';

/**
 * Cuentas de test por rol.
 *
 * INFRA-015: antes los emails (empresa@test.com, reclutador@test.com...) no
 * existían en ningún seed y las contraseñas caían a valores por defecto
 * escritos aquí mismo, así que la suite no podía pasar y además publicaba
 * contraseñas en el repo.
 *
 * Ahora:
 *  - Los emails por defecto son los de las cuentas que crea `npx prisma db seed`
 *    (se pueden cambiar con E2E_<ROL>_EMAIL para apuntar a staging).
 *  - Las contraseñas SÓLO salen de E2E_<ROL>_PASSWORD (.env.e2e). Contra una base
 *    sembrada en local son las mismas que SEED_<ROL>_PASSWORD. Si falta la
 *    variable, el test que la necesita falla con un mensaje claro en vez de
 *    agotar 10 s en /login con una contraseña inventada.
 */
const DEFINICION: Record<Rol, { emailVar: string; emailSeed: string; passwordVar: string }> = {
  admin: {
    emailVar: 'E2E_ADMIN_EMAIL',
    emailSeed: 'admin@inakat.com', // ADMIN_EMAIL del seed si no se definió otro
    passwordVar: 'E2E_ADMIN_PASSWORD',
  },
  company: {
    emailVar: 'E2E_COMPANY_EMAIL',
    emailSeed: 'contact@techsolutions.mx',
    passwordVar: 'E2E_COMPANY_PASSWORD',
  },
  recruiter: {
    emailVar: 'E2E_RECRUITER_EMAIL',
    emailSeed: 'reclutador1@inakat.com',
    passwordVar: 'E2E_RECRUITER_PASSWORD',
  },
  specialist: {
    emailVar: 'E2E_SPECIALIST_EMAIL',
    emailSeed: 'especialista.tech@inakat.com',
    passwordVar: 'E2E_SPECIALIST_PASSWORD',
  },
  candidate: {
    emailVar: 'E2E_CANDIDATE_EMAIL',
    emailSeed: 'candidato.test@example.com',
    passwordVar: 'E2E_CANDIDATE_PASSWORD',
  },
};

function cuenta(rol: Rol): { readonly email: string; readonly password: string } {
  const { emailVar, emailSeed, passwordVar } = DEFINICION[rol];
  return {
    get email() {
      return process.env[emailVar] || emailSeed;
    },
    get password() {
      const valor = process.env[passwordVar];
      if (!valor) {
        throw new Error(
          `Falta ${passwordVar}. Defínela en .env.e2e (ver .env.e2e.example); ` +
            `contra una base sembrada en local es la misma que la SEED_*_PASSWORD del rol.`
        );
      }
      return valor;
    },
  };
}

export const TEST_ACCOUNTS: Record<Rol, { readonly email: string; readonly password: string }> = {
  admin: cuenta('admin'),
  company: cuenta('company'),
  recruiter: cuenta('recruiter'),
  specialist: cuenta('specialist'),
  candidate: cuenta('candidate'),
};
