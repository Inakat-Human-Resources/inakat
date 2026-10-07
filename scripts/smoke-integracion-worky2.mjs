#!/usr/bin/env node
// RUTA: scripts/smoke-integracion-worky2.mjs
//
// Prueba de humo EN VIVO del puente INAKAT ↔ Worky2, contra los despliegues
// reales. No crea, borra ni modifica nada en ninguno de los dos sistemas:
//   - el pull sólo LEE candidatos aceptados con la API key;
//   - al webhook de Worky2 se le mandan dos POST que rechaza ANTES de tocar su
//     base: uno con firma falsa (401) y otro bien firmado pero con un candidato
//     vacío (400). Ese 400 demuestra que token, secreto y reloj cuadran.
//
// Uso (todas opcionales salvo INAKAT_URL, que tiene valor por defecto):
//   INAKAT_URL=https://www.inakat.com \
//   INAKAT_API_KEY=inak_xxxxxxxx... \
//   WORKY_WEBHOOK_URL=https://<worky>/api/integrations/inakat/webhook/<token> \
//   WORKY_WEBHOOK_SECRET=<secreto que muestra Worky2> \
//   node scripts/smoke-integracion-worky2.mjs
//
// Sale con código 1 si algo falla. No imprime datos personales: sólo ids.

import crypto from 'node:crypto';
import dns from 'node:dns/promises';

const INAKAT_URL = (process.env.INAKAT_URL || 'https://www.inakat.com').replace(/\/+$/, '');
const API_KEY = process.env.INAKAT_API_KEY?.trim();
const WEBHOOK_URL = process.env.WORKY_WEBHOOK_URL?.trim();
const WEBHOOK_SECRET = process.env.WORKY_WEBHOOK_SECRET?.trim();

let fallas = 0;
const ok = (m) => console.log(`  ✅ ${m}`);
const mal = (m) => {
  fallas++;
  console.log(`  ❌ ${m}`);
};
const nota = (m) => console.log(`  ·  ${m}`);

async function pedir(url, init = {}) {
  return fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(15_000), ...init });
}

// Mismas reglas que candidatoInakatSchema de Worky2 (src/lib/inakat-api.ts).
const EMAIL = /^(?!\.)(?!.*\.\.)([A-Za-z0-9_'+\-.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9-]*\.)+[A-Za-z]{2,}$/;
const opcional = (v, tipo) => v === null || v === undefined || typeof v === tipo;
function motivoFueraDeContrato(c) {
  if (!Number.isInteger(c.inakatCandidateId) || c.inakatCandidateId <= 0) return 'inakatCandidateId';
  if (typeof c.nombre !== 'string' || c.nombre.length < 1) return 'nombre';
  if (typeof c.apellidoPaterno !== 'string') return 'apellidoPaterno';
  if (typeof c.email !== 'string' || !EMAIL.test(c.email)) return 'email';
  for (const k of ['apellidoMaterno', 'telefono', 'cvUrl', 'evaluacionPsicologica', 'evaluacionTecnica',
    'notasAdicionales', 'puesto', 'universidad', 'carrera', 'fechaAceptacion']) {
    if (!opcional(c[k], 'string')) return k;
  }
  if (!opcional(c.experienciaAnios, 'number')) return 'experienciaAnios';
  const s = c.salarioMensualPropuesto;
  if (!opcional(s, 'number') || (typeof s === 'number' && (s < 0 || s > 10_000_000))) return 'salarioMensualPropuesto';
  return null;
}

async function probarInakat() {
  console.log(`\nINAKAT · ${INAKAT_URL}`);

  const sinKey = await pedir(`${INAKAT_URL}/api/integration/candidates`);
  if (sinKey.status === 401) ok('GET /api/integration/candidates sin key → 401');
  else if (sinKey.status === 500) mal('sin key responde 500: probablemente faltan las tablas IntegrationApiKey/IntegrationWebhook');
  else mal(`sin key respondió ${sinKey.status} (se esperaba 401)`);

  if (!API_KEY) {
    nota('Sin INAKAT_API_KEY: se omite la lectura de candidatos.');
    return;
  }
  if (!/^inak_[0-9a-f]{32}$/.test(API_KEY)) mal('INAKAT_API_KEY no tiene el formato inak_ + 32 hex');

  let total = 0;
  let paginas = 0;
  const fuera = [];
  const sinApellido = [];
  for (let page = 1; page <= 20; page++) {
    const res = await pedir(`${INAKAT_URL}/api/integration/candidates?status=accepted&page=${page}&limit=100`, {
      headers: { 'X-Api-Key': API_KEY }
    });
    if (res.status !== 200) {
      mal(`página ${page} respondió ${res.status}${res.status === 401 ? ' (key inválida, revocada o empresa desactivada)' : ''}`);
      return;
    }
    const json = await res.json();
    if (json.success !== true || !Array.isArray(json.data) || typeof json.pagination?.hasNext !== 'boolean') {
      mal(`página ${page}: el sobre no es { success, data[], pagination }`);
      return;
    }
    paginas++;
    for (const c of json.data) {
      total++;
      const motivo = motivoFueraDeContrato(c);
      if (motivo) fuera.push(`#${c.inakatCandidateId} (${motivo})`);
      else if (c.apellidoPaterno.trim().length < 2 || c.nombre.trim().length < 2) sinApellido.push(`#${c.inakatCandidateId}`);
    }
    if (!json.pagination.hasNext) break;
  }

  ok(`pull con la key: ${total} aceptado(s) en ${paginas} página(s)`);
  if (fuera.length) mal(`Worky2 omitiría ${fuera.length}: ${fuera.join(', ')}`);
  else ok('todos cumplen el contrato que valida Worky2');
  if (sinApellido.length) nota(`${sinApellido.length} se importarán con «Completar e importar» (nombre o apellido incompleto): ${sinApellido.join(', ')}`);
}

function firmar(ts, cuerpo, secreto) {
  return 'v1=' + crypto.createHmac('sha256', secreto).update(`${ts}.${cuerpo}`).digest('hex');
}

async function probarWebhook() {
  if (!WEBHOOK_URL) {
    console.log('');
    nota('Sin WORKY_WEBHOOK_URL: se omite la prueba del webhook.');
    return;
  }
  console.log(`\nWorky2 · webhook ${WEBHOOK_URL.replace(/[0-9a-f-]{36}$/i, '<token>')}`);

  let url;
  try {
    url = new URL(WEBHOOK_URL);
  } catch {
    mal('WORKY_WEBHOOK_URL no es una URL válida');
    return;
  }
  // Las mismas reglas con las que INAKAT acepta la URL (src/lib/worky2-webhook.ts)
  if (url.protocol !== 'https:') mal('INAKAT exige https:// en producción');
  else ok('https');
  if (url.port && url.port !== '443') mal(`puerto ${url.port}: INAKAT sólo admite 80/443`);
  try {
    const direcciones = await dns.lookup(url.hostname, { all: true });
    ok(`DNS ${url.hostname} → ${direcciones.map((d) => d.address).join(', ')}`);
  } catch {
    mal(`no se pudo resolver ${url.hostname}`);
    return;
  }

  const ts = Math.floor(Date.now() / 1000);
  const cuerpo = JSON.stringify({ event: 'candidate.accepted', id: crypto.randomUUID(), createdAt: new Date().toISOString(), candidate: {} });

  const falsa = await pedir(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Inakat-Timestamp': String(ts), 'X-Inakat-Signature': 'v1=' + '0'.repeat(64) },
    body: cuerpo
  });
  if (falsa.status >= 300 && falsa.status < 400) {
    mal(`redirige (${falsa.status} → ${falsa.headers.get('location')}): INAKAT NO sigue redirecciones, el evento se perdería. Registra la URL final.`);
    return;
  }
  if (falsa.status === 404) {
    mal('404: token desconocido o conexión INAKAT desactivada en Worky2');
    return;
  }
  if (falsa.status === 401) ok('firma falsa → 401 (el receptor es público y verifica la firma)');
  else mal(`firma falsa respondió ${falsa.status} (se esperaba 401)`);

  if (!WEBHOOK_SECRET) {
    nota('Sin WORKY_WEBHOOK_SECRET: no se puede comprobar que el secreto registrado en INAKAT es el correcto.');
    return;
  }
  const firmada = await pedir(WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Inakat-Timestamp': String(ts),
      'X-Inakat-Delivery': crypto.randomUUID(),
      'X-Inakat-Signature': firmar(ts, cuerpo, WEBHOOK_SECRET)
    },
    body: cuerpo
  });
  if (firmada.status === 400) ok('bien firmada con candidato vacío → 400: token, secreto y reloj correctos (no se creó nada)');
  else if (firmada.status === 401) mal('bien firmada → 401: el secreto no coincide con el de Worky2 o el reloj está desfasado > 5 min');
  else mal(`bien firmada respondió ${firmada.status} (se esperaba 400)`);
}

try {
  await probarInakat();
  await probarWebhook();
} catch (error) {
  mal(`error inesperado: ${error instanceof Error ? error.message : error}`);
}

console.log(fallas ? `\n${fallas} problema(s).` : '\nTodo en orden.');
process.exit(fallas ? 1 : 0);
