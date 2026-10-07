// RUTA: src/lib/blob-en-uso.ts
// ¿Qué archivos del store de blobs sigue usando alguna fila de la base?
//
// SEGURIDAD: las rutas que borran blobs (documentos y CV/foto del perfil, y las
// de admin) sólo comprobaban que la URL fuera de `*.public.blob.vercel-storage.com`.
// Cualquier cuenta de candidato podía registrar como «su» documento la URL de un
// archivo ajeno —el logo público de una empresa, el CV que ve una empresa— y al
// borrar ese documento el servidor eliminaba el archivo de la víctima con el
// token de INAKAT. Además, reemplazar el CV borraba el anterior aunque las
// postulaciones hechas con él lo siguieran enlazando.
//
// Regla: un blob sólo se borra si, DESPUÉS de quitar la fila que lo usaba,
// ninguna otra fila lo referencia. Llamar siempre tras la escritura en base.

import { prisma } from './prisma';

/** Devuelve las URLs de `urls` que alguna fila de la base sigue referenciando. */
export async function urlsDeArchivoEnUso(urls: string[]): Promise<Set<string>> {
  const unicas = [...new Set(urls.filter(Boolean))];
  if (unicas.length === 0) return new Set();

  const en = { in: unicas };
  const [documentos, candidatos, postulaciones, solicitudes, compras, notas, comprobantes] =
    await Promise.all([
      prisma.candidateDocument.findMany({ where: { fileUrl: en }, select: { fileUrl: true } }),
      prisma.candidate.findMany({
        where: { OR: [{ cvUrl: en }, { fotoUrl: en }] },
        select: { cvUrl: true, fotoUrl: true }
      }),
      prisma.application.findMany({ where: { cvUrl: en }, select: { cvUrl: true } }),
      prisma.companyRequest.findMany({
        where: {
          OR: [{ logoUrl: en }, { identificacionUrl: en }, { documentosConstitucionUrl: en }]
        },
        select: { logoUrl: true, identificacionUrl: true, documentosConstitucionUrl: true }
      }),
      prisma.creditPurchase.findMany({ where: { receiptUrl: en }, select: { receiptUrl: true } }),
      prisma.evaluationNote.findMany({ where: { documentUrl: en }, select: { documentUrl: true } }),
      prisma.discountCodeUse.findMany({
        where: { paymentProofUrl: en },
        select: { paymentProofUrl: true }
      })
    ]);

  const referenciadas = new Set<string>(
    [
      ...documentos.map((f) => f.fileUrl),
      ...candidatos.flatMap((f) => [f.cvUrl, f.fotoUrl]),
      ...postulaciones.map((f) => f.cvUrl),
      ...solicitudes.flatMap((f) => [f.logoUrl, f.identificacionUrl, f.documentosConstitucionUrl]),
      ...compras.map((f) => f.receiptUrl),
      ...notas.map((f) => f.documentUrl),
      ...comprobantes.map((f) => f.paymentProofUrl)
    ].filter((url): url is string => typeof url === 'string')
  );

  return new Set(unicas.filter((url) => referenciadas.has(url)));
}
