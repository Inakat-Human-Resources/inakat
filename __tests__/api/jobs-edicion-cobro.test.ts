/**
 * Cobro al editar y al cambiar de estado una vacante (`/api/jobs/[id]`).
 *
 * Tres agujeros que estaban abiertos:
 *  1. PATCH sólo bloqueaba draft -> active, y el bloqueo se rodeaba en dos pasos:
 *     draft -> paused -> active, porque el segundo salto ya no partía de un borrador.
 *  2. PATCH aceptaba `profile`, `seniority` y `workMode` —los campos que fijan el
 *     precio— sin recalcular ni cobrar: publicar barato y ascender gratis.
 *  3. El ajuste de créditos del PUT eran llamadas sueltas sobre un saldo leído
 *     antes: dos ediciones simultáneas devolvían los créditos dos veces.
 */
import fs from 'fs';
import path from 'path';

const readFile = (filePath: string): string =>
  fs.readFileSync(path.join(process.cwd(), filePath), 'utf-8');

const ROUTE = 'src/app/api/jobs/[id]/route.ts';
const content = readFile(ROUTE);

describe('PATCH /api/jobs/[id] — un borrador no sale de borrador', () => {
  it('bloquea cualquier cambio de estado desde draft, no sólo draft -> active', () => {
    expect(content).toMatch(
      /existingJob\.status === 'draft' &&\s*body\.status !== undefined &&\s*body\.status !== 'draft' &&\s*auth\.role !== 'admin'/
    );
  });

  it('remite al flujo que sí cobra', () => {
    const bloque = content.slice(content.indexOf("existingJob.status === 'draft' &&"));
    expect(bloque.slice(0, 700)).toContain('/api/jobs/publish');
    expect(bloque.slice(0, 700)).toContain('status: 403');
  });

  it('no usa creditCost como prueba de pago (las vacantes viejas tienen 0)', () => {
    // Si se usara, el dueño de una vacante anterior al cobro no podría reanudarla.
    expect(content).not.toMatch(/body\.status === 'active' &&\s*\(existingJob\.creditCost/);
  });
});

describe('PATCH /api/jobs/[id] — no se cambian los campos que fijan el precio', () => {
  it('profile, subcategory, seniority y workMode sólo los toca un admin', () => {
    expect(content).toContain("const PRICE_FIELDS = ['profile', 'subcategory', 'seniority', 'workMode']");
    expect(content).toMatch(/\.\.\.\(auth\.role === 'admin' \? PRICE_FIELDS : \[\]\)/);
  });

  it('si una empresa los manda, responde 400 y dice cuáles', () => {
    const bloque = content.slice(content.indexOf('const intentados = PRICE_FIELDS'));
    expect(bloque.slice(0, 700)).toContain('fields: intentados');
    expect(bloque.slice(0, 700)).toContain('status: 400');
  });
});

describe('PUT /api/jobs/[id] — el ajuste de créditos es atómico', () => {
  it('el cobro de la diferencia reclama el saldo con una condición atómica', () => {
    expect(content).toMatch(
      /updateMany\(\{\s*where: \{ id: existingJob\.userId!, credits: \{ gte: difference \} \}/
    );
  });

  it('la devolución es idempotente: se ancla al creditCost que se leyó', () => {
    // Si otra petición ya devolvió y dejó el coste en newCost, esta no encuentra
    // la fila y no vuelve a devolver: es lo que impide acuñar créditos.
    expect(content).toMatch(
      /updateMany\(\{\s*where: \{ id: jobId, creditCost: originalCost \}/
    );
    expect(content).toContain('status: 409');
  });

  it('ni el cobro ni la devolución quedan fuera de una transacción', () => {
    const put = content.slice(content.indexOf('VALIDACIÓN DE CRÉDITOS AL EDITAR'));
    expect(put).not.toMatch(/await prisma\.user\.update\(\{[\s\S]{0,160}decrement: difference/);
    expect(put).not.toMatch(/await prisma\.user\.update\(\{[\s\S]{0,160}increment: refundAmount/);
    expect(put).toMatch(/await prisma\.\$transaction\(async \(tx\) => \{/);
  });

  it('el saldo del ledger se calcula desde el valor posterior real, no desde la lectura previa', () => {
    expect(content).toMatch(/balanceBefore: balanceAfter \+ difference/);
    expect(content).toMatch(/balanceBefore: after\.credits - refundAmount/);
  });
});
