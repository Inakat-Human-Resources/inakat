// RUTA: src/app/api/admin/candidates/[id]/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { isSafeHttpUrl } from '@/lib/sanitize';

/**
 * ¿La URL apunta a nuestro propio almacén de blobs? Sólo esos se borran al
 * eliminar al candidato; una URL externa (LinkedIn, Drive...) se deja intacta.
 */
function esBlobPropio(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith('.public.blob.vercel-storage.com');
  } catch {
    return false;
  }
}

/**
 * Borra archivos del store de blobs sin bloquear la respuesta: si falla, se
 * registra y se sigue (la fila ya se eliminó y el admin no puede reintentarlo).
 */
async function borrarBlobs(urls: string[]): Promise<void> {
  if (urls.length === 0 || !process.env.BLOB_READ_WRITE_TOKEN) return;
  try {
    // Import diferido: el SDK de blobs sólo hace falta al borrar, no para
    // GET/PUT de esta misma ruta.
    const { del } = await import('@vercel/blob');
    await del(urls);
  } catch (error) {
    console.error('[admin/candidates] No se pudieron borrar los blobs del candidato:', error);
  }
}

// Estados válidos de un candidato (schema: Candidate.status)
const ESTADOS_CANDIDATO = ['available', 'in_process', 'hired', 'inactive'];

// Longitud máxima de las notas internas del admin.
const MAX_NOTAS = 5000;

/**
 * URL que acabará renderizada como href (CV, portafolio, LinkedIn, foto,
 * documentos): sólo http(s). Devuelve el mensaje de error o null.
 * TODO(handoff): mover a src/lib; un route.ts no puede exportar helpers.
 */
function urlInseguraEn(campos: Array<[string, unknown]>): string | null {
  for (const [etiqueta, valor] of campos) {
    if (valor === undefined || valor === null || valor === '') continue;
    if (!isSafeHttpUrl(valor)) {
      return `${etiqueta} debe ser una dirección http(s) válida`;
    }
  }
  return null;
}

/**
 * Valida el array de experiencias ANTES de borrar nada: antes el deleteMany se
 * ejecutaba primero y una fecha inválida dejaba al candidato sin historial.
 */
function validarExperiencias(experiences: unknown): string | null {
  if (!Array.isArray(experiences)) {
    return 'experiences debe ser un array';
  }
  for (const exp of experiences as any[]) {
    if (!exp || typeof exp !== 'object') return 'Experiencia inválida';
    if (typeof exp.empresa !== 'string' || !exp.empresa.trim()) {
      return 'Cada experiencia necesita empresa';
    }
    if (typeof exp.puesto !== 'string' || !exp.puesto.trim()) {
      return 'Cada experiencia necesita puesto';
    }
    if (Number.isNaN(new Date(exp.fechaInicio).getTime())) {
      return `Fecha de inicio inválida en la experiencia "${exp.empresa}"`;
    }
    if (exp.fechaFin && Number.isNaN(new Date(exp.fechaFin).getTime())) {
      return `Fecha de fin inválida en la experiencia "${exp.empresa}"`;
    }
  }
  return null;
}

// Función auxiliar para calcular años de experiencia
function calcularAñosExperiencia(experiences: Array<{ fechaInicio: Date; fechaFin: Date | null }>): number {
  if (!experiences || experiences.length === 0) return 0;

  const today = new Date();
  let totalMonths = 0;

  for (const exp of experiences) {
    const start = new Date(exp.fechaInicio);
    const end = exp.fechaFin ? new Date(exp.fechaFin) : today;
    const months =
      (end.getFullYear() - start.getFullYear()) * 12 +
      (end.getMonth() - start.getMonth());
    totalMonths += Math.max(0, months);
  }

  return Math.round(totalMonths / 12);
}

/**
 * GET /api/admin/candidates/[id]
 * Obtener un candidato por ID con experiencias y documentos
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireRole('admin');
    if ('error' in auth) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const { id } = await params;
    const candidateId = parseInt(id);

    if (isNaN(candidateId)) {
      return NextResponse.json(
        { success: false, error: 'ID de candidato inválido' },
        { status: 400 }
      );
    }

    const candidate = await prisma.candidate.findUnique({
      where: { id: candidateId },
      include: {
        experiences: {
          orderBy: { fechaInicio: 'desc' }
        },
        documents: {
          orderBy: { createdAt: 'desc' }
        },
        user: {
          select: {
            id: true,
            email: true,
            role: true
          }
        }
      }
    });

    if (!candidate) {
      return NextResponse.json(
        { success: false, error: 'Candidato no encontrado' },
        { status: 404 }
      );
    }

    // Calcular edad
    let edad = null;
    if (candidate.fechaNacimiento) {
      const today = new Date();
      const birth = new Date(candidate.fechaNacimiento);
      edad = today.getFullYear() - birth.getFullYear();
      const monthDiff = today.getMonth() - birth.getMonth();
      if (
        monthDiff < 0 ||
        (monthDiff === 0 && today.getDate() < birth.getDate())
      ) {
        edad--;
      }
    }

    return NextResponse.json({
      success: true,
      data: { ...candidate, edad }
    });
  } catch (error) {
    console.error('Error fetching candidate:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener candidato' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/candidates/[id]
 * Actualizar candidato (recalcula añosExperiencia si cambian experiencias)
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireRole('admin');
    if ('error' in auth) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const { id } = await params;
    const candidateId = parseInt(id);

    if (isNaN(candidateId)) {
      return NextResponse.json(
        { success: false, error: 'ID de candidato inválido' },
        { status: 400 }
      );
    }

    // Verificar que existe
    const existingCandidate = await prisma.candidate.findUnique({
      where: { id: candidateId },
      include: { experiences: true }
    });

    if (!existingCandidate) {
      return NextResponse.json(
        { success: false, error: 'Candidato no encontrado' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const {
      nombre,
      apellidoPaterno,
      apellidoMaterno,
      email,
      telefono,
      sexo,
      fechaNacimiento,
      universidad,
      carrera,
      nivelEstudios,
      educacion, // FEATURE: Educación múltiple (array)
      profile,
      subcategory,
      seniority,
      cvUrl,
      portafolioUrl,
      linkedinUrl,
      source,
      notas,
      status,
      fotoUrl, // El formulario lo envía y antes se descartaba en silencio
      cartaPresentacion, // Idem: "Visible para empresas" pero nunca se guardaba
      ciudad,
      estado,
      ubicacionCercana,
      documents, // Documentos nuevos añadidos desde la pestaña "Documentos"
      experiences // Array de experiencias (opcional)
    } = body;

    // ---- Validación del body ANTES de escribir nada ----
    // Un string vacío pasaba el `!== undefined` y se guardaba: el candidato
    // perdía nombre o email (y el segundo email '' reventaba el unique con 500).
    const camposObligatorios: Array<[string, unknown]> = [
      ['nombre', nombre],
      ['apellidoPaterno', apellidoPaterno]
    ];
    for (const [campo, valor] of camposObligatorios) {
      if (valor !== undefined && (typeof valor !== 'string' || valor.trim().length < 2)) {
        return NextResponse.json(
          { success: false, error: `El campo ${campo} no puede quedar vacío` },
          { status: 400 }
        );
      }
    }

    if (email !== undefined) {
      if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        return NextResponse.json(
          { success: false, error: 'Email inválido' },
          { status: 400 }
        );
      }
    }

    if (status !== undefined && !ESTADOS_CANDIDATO.includes(status)) {
      return NextResponse.json(
        { success: false, error: `Estado inválido. Valores permitidos: ${ESTADOS_CANDIDATO.join(', ')}` },
        { status: 400 }
      );
    }

    if (notas !== undefined && notas !== null && typeof notas !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Las notas deben ser texto' },
        { status: 400 }
      );
    }

    if (typeof notas === 'string' && notas.length > MAX_NOTAS) {
      return NextResponse.json(
        { success: false, error: `Las notas no pueden superar ${MAX_NOTAS} caracteres` },
        { status: 400 }
      );
    }

    const urlInvalida = urlInseguraEn([
      ['El CV', cvUrl],
      ['El portafolio', portafolioUrl],
      ['El LinkedIn', linkedinUrl],
      ['La foto', fotoUrl]
    ]);
    if (urlInvalida) {
      return NextResponse.json({ success: false, error: urlInvalida }, { status: 400 });
    }

    if (experiences !== undefined) {
      const errorExperiencias = validarExperiencias(experiences);
      if (errorExperiencias) {
        return NextResponse.json(
          { success: false, error: errorExperiencias },
          { status: 400 }
        );
      }
    }

    // Documentos: sólo se dan de alta los que llegan SIN id (los nuevos de la
    // pestaña "Documentos"). No se borra nada aquí: para eliminar existe
    // DELETE /api/admin/candidates/[id]/documents.
    const documentosNuevos: Array<{ name: string; fileUrl: string; fileType: string | null }> = [];
    if (documents !== undefined) {
      if (!Array.isArray(documents)) {
        return NextResponse.json(
          { success: false, error: 'documents debe ser un array' },
          { status: 400 }
        );
      }
      for (const doc of documents as any[]) {
        if (!doc || doc.id) continue; // ya existe en BD
        if (typeof doc.name !== 'string' || !doc.name.trim()) {
          return NextResponse.json(
            { success: false, error: 'Cada documento necesita un nombre' },
            { status: 400 }
          );
        }
        if (!isSafeHttpUrl(doc.fileUrl)) {
          return NextResponse.json(
            { success: false, error: `La URL del documento "${doc.name}" debe ser http(s)` },
            { status: 400 }
          );
        }
        documentosNuevos.push({
          name: doc.name.trim(),
          fileUrl: doc.fileUrl,
          fileType: doc.fileType || null
        });
      }
    }

    const emailNuevo = email !== undefined ? email.trim().toLowerCase() : null;
    const cambiaEmail = emailNuevo !== null && emailNuevo !== existingCandidate.email.toLowerCase();

    // Validar email único si se está cambiando (en Candidate y en User: si el
    // candidato tiene cuenta, hay que mover también su login)
    if (cambiaEmail) {
      const emailExists = await prisma.candidate.findUnique({
        where: { email: emailNuevo }
      });

      if (emailExists) {
        return NextResponse.json(
          {
            success: false,
            error: `Ya existe un candidato con ese email (ID: ${emailExists.id})`
          },
          { status: 409 }
        );
      }

      const usuarioConEseEmail = await prisma.user.findUnique({
        where: { email: emailNuevo }
      });

      if (usuarioConEseEmail && usuarioConEseEmail.id !== existingCandidate.userId) {
        return NextResponse.json(
          { success: false, error: 'Ya existe un usuario con ese email' },
          { status: 409 }
        );
      }
    }

    // Preparar datos de actualización
    const updateData: any = {};

    if (nombre !== undefined) updateData.nombre = nombre.trim();
    if (apellidoPaterno !== undefined) updateData.apellidoPaterno = apellidoPaterno.trim();
    if (apellidoMaterno !== undefined) updateData.apellidoMaterno = apellidoMaterno || null;
    if (emailNuevo !== null) updateData.email = emailNuevo;
    if (telefono !== undefined) updateData.telefono = telefono || null;
    if (sexo !== undefined) updateData.sexo = sexo || null;
    if (fechaNacimiento !== undefined) {
      updateData.fechaNacimiento = fechaNacimiento ? new Date(fechaNacimiento) : null;
    }
    if (universidad !== undefined) updateData.universidad = universidad || null;
    if (carrera !== undefined) updateData.carrera = carrera || null;
    if (nivelEstudios !== undefined) updateData.nivelEstudios = nivelEstudios || null;
    if (profile !== undefined) updateData.profile = profile || null;
    if (subcategory !== undefined) updateData.subcategory = subcategory || null;
    if (seniority !== undefined) updateData.seniority = seniority || null;
    if (cvUrl !== undefined) updateData.cvUrl = cvUrl || null;
    if (portafolioUrl !== undefined) updateData.portafolioUrl = portafolioUrl || null;
    if (linkedinUrl !== undefined) updateData.linkedinUrl = linkedinUrl || null;
    if (source !== undefined) updateData.source = source || 'manual';
    // Las notas se guardan tal cual (limitadas en longitud): el saneador borraba
    // todo lo que pareciera una etiqueta y destrozaba texto legítimo como
    // "Pretensión < 25k y experiencia > 3 años". React ya escapa al renderizar,
    // y POST nunca saneó, así que el tratamiento queda unificado.
    if (notas !== undefined) updateData.notas = notas || null;
    if (status !== undefined) updateData.status = status;
    // Campos que el formulario enviaba y el PUT descartaba en silencio
    if (fotoUrl !== undefined) updateData.fotoUrl = fotoUrl || null;
    if (cartaPresentacion !== undefined) updateData.cartaPresentacion = cartaPresentacion || null;
    if (ciudad !== undefined) updateData.ciudad = ciudad || null;
    if (estado !== undefined) updateData.estado = estado || null;
    if (ubicacionCercana !== undefined) updateData.ubicacionCercana = ubicacionCercana || null;

    // FEATURE: Educación múltiple - guardar JSON y sincronizar campos legacy
    if (educacion !== undefined) {
      updateData.educacion = educacion && educacion.length > 0 ? JSON.stringify(educacion) : null;
      // Sincronizar campos legacy con la primera educación
      if (educacion && educacion.length > 0) {
        updateData.universidad = educacion[0].institucion || null;
        updateData.carrera = educacion[0].carrera || null;
        updateData.nivelEstudios = educacion[0].nivel || null;
      } else {
        updateData.universidad = null;
        updateData.carrera = null;
        updateData.nivelEstudios = null;
      }
    }

    // Recalcular años de experiencia si vienen experiencias nuevas
    if (experiences !== undefined) {
      updateData.añosExperiencia = calcularAñosExperiencia(
        experiences.map((exp: any) => ({
          fechaInicio: new Date(exp.fechaInicio),
          fechaFin: exp.fechaFin ? new Date(exp.fechaFin) : null
        }))
      );
    }

    // Todo en UNA transacción: antes el deleteMany de experiencias y el
    // update iban sueltos, así que cualquier fallo intermedio dejaba al
    // candidato sin historial laboral y respondía 500.
    const emailAnterior = existingCandidate.email.toLowerCase();
    const updatedCandidate = await prisma.$transaction(async (tx) => {
      if (experiences !== undefined) {
        await tx.experience.deleteMany({ where: { candidateId } });

        if (experiences.length > 0) {
          await tx.experience.createMany({
            data: experiences.map((exp: any) => ({
              candidateId,
              empresa: exp.empresa,
              puesto: exp.puesto,
              ubicacion: exp.ubicacion || null,
              fechaInicio: new Date(exp.fechaInicio),
              fechaFin: exp.fechaFin ? new Date(exp.fechaFin) : null,
              esActual: exp.esActual || false,
              descripcion: exp.descripcion || null
            }))
          });
        }
      }

      if (documentosNuevos.length > 0) {
        await tx.candidateDocument.createMany({
          data: documentosNuevos.map((doc) => ({ ...doc, candidateId }))
        });
      }

      // Application y Candidate se enlazan por email (no hay candidateId), así
      // que cambiar el email sin arrastrar las postulaciones dejaba al candidato
      // sin perfil en los pipelines y sin postulaciones en su propia cuenta.
      if (cambiaEmail && emailNuevo) {
        await tx.application.updateMany({
          where: { candidateEmail: emailAnterior },
          data: { candidateEmail: emailNuevo }
        });

        if (existingCandidate.userId) {
          await tx.user.update({
            where: { id: existingCandidate.userId },
            data: { email: emailNuevo }
          });
        }
      }

      return tx.candidate.update({
        where: { id: candidateId },
        data: updateData,
        include: {
          experiences: {
            orderBy: { fechaInicio: 'desc' }
          },
          documents: {
            orderBy: { createdAt: 'desc' }
          },
          user: {
            select: {
              id: true,
              email: true,
              role: true
            }
          }
        }
      });
    });

    return NextResponse.json({
      success: true,
      message: 'Candidato actualizado exitosamente',
      data: updatedCandidate
    });
  } catch (error) {
    console.error('Error updating candidate:', error);
    if ((error as { code?: string })?.code === 'P2002') {
      return NextResponse.json(
        { success: false, error: 'Ya existe un registro con ese email' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { success: false, error: 'Error al actualizar candidato' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/candidates/[id]
 * Eliminar candidato
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireRole('admin');
    if ('error' in auth) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const { id } = await params;
    const candidateId = parseInt(id);

    if (isNaN(candidateId)) {
      return NextResponse.json(
        { success: false, error: 'ID de candidato inválido' },
        { status: 400 }
      );
    }

    // Verificar que existe (con sus documentos: sus archivos se borran después)
    const candidate = await prisma.candidate.findUnique({
      where: { id: candidateId },
      include: { documents: { select: { fileUrl: true } } }
    });

    if (!candidate) {
      return NextResponse.json(
        { success: false, error: 'Candidato no encontrado' },
        { status: 404 }
      );
    }

    // Eliminar candidato (las experiencias y documentos se eliminan por cascade)
    // y desactivar su cuenta de acceso en la MISMA transacción: la FK vive en
    // Candidate.userId con onDelete SetNull, así que borrar el candidato dejaba
    // un User activo con role 'candidate' y sin perfil — podía iniciar sesión,
    // veía 404 en sus postulaciones y no podía volver a registrarse (409).
    let cuentaDesactivada = false;
    await prisma.$transaction(async (tx) => {
      if (candidate.userId) {
        const usuario = await tx.user.findUnique({
          where: { id: candidate.userId },
          select: { id: true, role: true }
        });

        if (usuario?.role === 'candidate') {
          await tx.user.update({
            where: { id: usuario.id },
            data: { isActive: false, resetToken: null, resetTokenExpiry: null }
          });
          cuentaDesactivada = true;
        }
      }

      await tx.candidate.delete({
        where: { id: candidateId }
      });
    });

    // Borrar también los archivos del store de blobs: el cascade sólo elimina
    // las filas y el CV, la foto y las identificaciones seguían descargables por
    // URL indefinidamente. Se respetan los que una postulación sigue usando
    // (Application.cvUrl), porque la empresa los consulta en su historial.
    const urlsDelCandidato = [
      ...candidate.documents.map((doc) => doc.fileUrl),
      candidate.cvUrl,
      candidate.fotoUrl
    ].filter((url): url is string => typeof url === 'string' && esBlobPropio(url));

    if (urlsDelCandidato.length > 0) {
      const enUso = await prisma.application.findMany({
        where: { cvUrl: { in: urlsDelCandidato } },
        select: { cvUrl: true }
      });
      const urlsEnUso = new Set(enUso.map((app) => app.cvUrl));
      await borrarBlobs(urlsDelCandidato.filter((url) => !urlsEnUso.has(url)));
    }

    return NextResponse.json({
      success: true,
      message: cuentaDesactivada
        ? 'Candidato eliminado exitosamente y su cuenta de acceso fue desactivada'
        : 'Candidato eliminado exitosamente',
      accountDeactivated: cuentaDesactivada
    });
  } catch (error) {
    console.error('Error deleting candidate:', error);
    return NextResponse.json(
      { success: false, error: 'Error al eliminar candidato' },
      { status: 500 }
    );
  }
}
