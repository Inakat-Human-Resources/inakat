/**
 * Cobro al publicar una vacante (POST /api/jobs).
 *
 * Dos agujeros que estaban abiertos en producción:
 *  1. `creditCost` sólo se calculaba `if (profile && seniority && workMode)`, y
 *     esos campos no eran obligatorios: omitirlos publicaba la vacante GRATIS.
 *  2. El cobro eran tres llamadas sueltas fuera de transacción, con un
 *     `findUnique` previo para comprobar el saldo: dos publicaciones simultáneas
 *     leían el mismo saldo y ambas cobraban (saldo negativo), y si `job.create`
 *     fallaba el cobro ya estaba hecho.
 */
import fs from 'fs';
import path from 'path';

const readFile = (filePath: string): string =>
  fs.readFileSync(path.join(process.cwd(), filePath), 'utf-8');

const ROUTE = 'src/app/api/jobs/route.ts';

describe('POST /api/jobs — no se puede publicar gratis', () => {
  const content = readFile(ROUTE);

  it('rechaza publicar sin los tres campos que determinan el precio', () => {
    expect(content).toMatch(
      /publishNow && userRole === 'company' && !\(profile && seniority && workMode\)/
    );
  });

  it('responde 400 y dice cuáles faltan', () => {
    const bloque = content.slice(
      content.indexOf('!(profile && seniority && workMode)'),
      content.indexOf('!(profile && seniority && workMode)') + 900
    );
    expect(bloque).toContain('missing');
    expect(bloque).toContain('status: 400');
  });
});

describe('POST /api/jobs — el cobro es atómico', () => {
  const content = readFile(ROUTE);

  it('cobro, ledger y creación de la vacante van en una sola transacción', () => {
    expect(content).toMatch(/const job = await prisma\.\$transaction\(async \(tx\) => \{/);
    // dentro de la transacción, no con el cliente suelto
    const tx = content.slice(content.indexOf('await prisma.$transaction(async (tx)'));
    expect(tx).toContain('tx.user.updateMany');
    expect(tx).toContain('tx.job.create');
    expect(tx).toContain('tx.creditTransaction.create');
  });

  it('el saldo se reclama con una condición atómica, no con una lectura previa', () => {
    // `updateMany` con `credits: { gte: creditCost }` lo resuelve la base de datos
    // en una sola sentencia: dos peticiones simultáneas no pueden ganar las dos.
    expect(content).toMatch(
      /updateMany\(\{\s*where: \{ id: userId, credits: \{ gte: creditCost \} \}/
    );
    expect(content).toContain('if (claimed.count === 0)');
  });

  it('cuando el saldo no alcanza responde 402 sin haber cobrado', () => {
    expect(content).toContain('InsufficientCreditsError');
    expect(content).toMatch(/status: 402/);
  });

  it('el ledger se escribe con el jobId, sin atarlo después por descripción', () => {
    expect(content).toContain('jobId: created.id');
    // el parche viejo buscaba por título y ataba varias vacantes homónimas
    expect(content).not.toMatch(
      /creditTransaction\.updateMany\([\s\S]{0,200}description: `Publicación de vacante/
    );
  });

  it('no queda ningún cobro fuera de la transacción', () => {
    const post = content.slice(content.indexOf('export async function POST'));
    expect(post).not.toMatch(/await prisma\.user\.update\(\{[\s\S]{0,200}decrement: creditCost/);
  });
});
