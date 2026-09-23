// RUTA: src/app/api/applications/counts/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';

/** Tope de correos por petición: la pantalla muestra 30 candidatos por página. */
const MAX_EMAILS = 200;

/**
 * POST /api/applications/counts
 * Cuántas postulaciones tiene cada correo de la lista.
 * Body: { emails: string[] }
 * Respuesta: { success, data: { [email]: número } } (sólo los que tienen alguna)
 *
 * RENDIMIENTO (#VAC-011): /admin/assign-candidates descargaba GET
 * /api/applications completo —con coverLetter, notas y dos joins— cada vez que
 * se elegía una vacante o se asignaban candidatos, sólo para contar cuántas
 * postulaciones tenía cada uno de los ~30 candidatos visibles. Con decenas de
 * miles de filas la respuesta pasaba del límite de 4.5 MB de Vercel y la
 * pantalla mostraba "Error al cargar las asignaciones". El conteo lo hace la
 * base con un groupBy sobre los correos visibles.
 *
 * Admin-only: el middleware ya restringe /api/applications/* a admin, y aquí se
 * vuelve a comprobar contra la base (rol vigente e isActive).
 */
export async function POST(request: Request) {
  try {
    const auth = await requireRole('admin');
    if ('error' in auth) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'El cuerpo debe ser JSON' },
        { status: 400 }
      );
    }

    const emailsRaw = (body as { emails?: unknown } | null)?.emails;
    if (!Array.isArray(emailsRaw) || emailsRaw.some((e) => typeof e !== 'string')) {
      return NextResponse.json(
        { success: false, error: 'emails debe ser una lista de correos' },
        { status: 400 }
      );
    }

    // Los correos de Application se guardan en minúsculas.
    const emails = Array.from(
      new Set(
        (emailsRaw as string[])
          .map((e) => e.trim().toLowerCase())
          .filter((e) => e.length > 0)
      )
    );

    if (emails.length > MAX_EMAILS) {
      return NextResponse.json(
        { success: false, error: `Máximo ${MAX_EMAILS} correos por petición` },
        { status: 400 }
      );
    }

    if (emails.length === 0) {
      return NextResponse.json({ success: true, data: {} });
    }

    const grupos = await prisma.application.groupBy({
      by: ['candidateEmail'],
      where: { candidateEmail: { in: emails } },
      _count: { _all: true }
    });

    const data: Record<string, number> = {};
    for (const g of grupos) {
      data[g.candidateEmail.toLowerCase()] = g._count._all;
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error counting applications:', error);
    return NextResponse.json(
      { success: false, error: 'Error al contar las postulaciones' },
      { status: 500 }
    );
  }
}
