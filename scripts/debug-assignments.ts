// Script de diagnóstico de asignaciones (reclutador → especialista).
//
// Ejecutar con:
//   npx tsx scripts/debug-assignments.ts --specialist-email=alguien@inakat.com
//   npx tsx scripts/debug-assignments.ts --job-id=19
//   npx tsx scripts/debug-assignments.ts --show-pii     (sin enmascarar; úsalo solo en local)
//
// Reglas de este script:
//   • Sin --show-pii NO imprime correos ni nombres completos de candidatos: su
//     salida acaba en el scrollback de la terminal o en el log de un pipeline,
//     fuera del control de acceso de la app.
//   • No muta nada: solo lee.
//   • Imprime el host de la base contra la que corre, para que nadie diagnostique
//     creyendo que está en local cuando su .env apunta a otra parte.
//   • Si algo falla, sale con código 1 (antes el catch se tragaba el error).

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Argumentos
// ---------------------------------------------------------------------------
function leerArgumento(nombre: string): string | undefined {
  const prefijo = `--${nombre}=`;
  const arg = process.argv.find(a => a.startsWith(prefijo));
  return arg ? arg.slice(prefijo.length) : undefined;
}

const specialistEmail = leerArgumento('specialist-email')?.toLowerCase().trim();
const jobIdArg = leerArgumento('job-id');
const jobId = jobIdArg ? Number(jobIdArg) : undefined;
const mostrarPII = process.argv.includes('--show-pii');

// Deja visible lo justo para reconocer al registro sin exponer el dato completo
function enmascarar(valor: string | null | undefined): string {
  if (!valor) return 'N/A';
  if (mostrarPII) return valor;
  if (valor.includes('@')) {
    const [usuario, dominio] = valor.split('@');
    return `${usuario.slice(0, 2)}***@${dominio}`;
  }
  return `${valor.slice(0, 2)}***`;
}

function hostDeBaseDeDatos(): string {
  const url = process.env.DATABASE_URL;
  if (!url) return '(DATABASE_URL sin definir)';
  try {
    return new URL(url).hostname;
  } catch {
    return '(host desconocido)';
  }
}

async function debugAssignments() {
  if (jobIdArg && (!Number.isInteger(jobId) || jobId! <= 0)) {
    throw new Error(`--job-id debe ser un entero positivo, llegó "${jobIdArg}"`);
  }

  console.log('\n========================================');
  console.log('   DIAGNÓSTICO DE ASIGNACIONES');
  console.log('   Fecha:', new Date().toISOString());
  console.log('   Base de datos:', hostDeBaseDeDatos());
  console.log(`   PII: ${mostrarPII ? 'VISIBLE (--show-pii)' : 'enmascarada'}`);
  if (specialistEmail) console.log('   Filtro especialista:', enmascarar(specialistEmail));
  if (jobId) console.log('   Filtro vacante:', jobId);
  console.log('========================================\n');

  // 1. Especialistas (filtrados si se pidió uno concreto)
  console.log('📋 ESPECIALISTAS REGISTRADOS:');
  console.log('─'.repeat(50));
  const specialists = await prisma.user.findMany({
    where: {
      role: 'specialist',
      ...(specialistEmail ? { email: specialistEmail } : {})
    },
    select: {
      id: true,
      email: true,
      nombre: true,
      apellidoPaterno: true,
      specialty: true
    }
  });

  if (specialists.length === 0) {
    console.log(
      specialistEmail
        ? `  ⚠️  No hay ningún especialista con ese correo`
        : '  ⚠️  NO HAY ESPECIALISTAS REGISTRADOS'
    );
  } else {
    specialists.forEach(s => {
      console.log(
        `  • ID: ${s.id} | ${enmascarar(s.nombre)} | ${enmascarar(s.email)} | Especialidad: ${s.specialty || 'N/A'}`
      );
    });
  }

  // 2. Asignaciones
  console.log('\n📋 ASIGNACIONES DE VACANTES:');
  console.log('─'.repeat(50));
  const assignments = await prisma.jobAssignment.findMany({
    where: {
      ...(jobId ? { jobId } : {}),
      ...(specialistEmail && specialists.length > 0
        ? { specialistId: { in: specialists.map(s => s.id) } }
        : {})
    },
    include: {
      job: { select: { id: true, title: true, company: true, status: true } },
      recruiter: { select: { id: true, email: true, nombre: true } },
      specialist: { select: { id: true, email: true, nombre: true } }
    },
    orderBy: { assignedAt: 'desc' }
  });

  if (assignments.length === 0) {
    console.log('  ⚠️  NO HAY ASIGNACIONES QUE COINCIDAN CON EL FILTRO');
  } else {
    for (const a of assignments) {
      console.log(`\n  📌 Vacante: "${a.job.title}" (ID: ${a.jobId})`);
      console.log(`     Empresa: ${a.job.company}`);
      console.log(`     Estado vacante: ${a.job.status}`);
      console.log(`     Reclutador: ${enmascarar(a.recruiter?.nombre)} (ID: ${a.recruiterId})`);
      console.log(`     Recruiter Status: ${a.recruiterStatus}`);

      if (a.specialistId) {
        console.log(
          `     ✅ Especialista: ${enmascarar(a.specialist?.nombre)} (ID: ${a.specialistId})`
        );
        console.log(`     Specialist Status: ${a.specialistStatus}`);
      } else {
        console.log(`     ❌ SIN ESPECIALISTA ASIGNADO`);
      }

      console.log(
        `     Candidatos enviados al especialista: ${a.candidatesSentToSpecialist || 'ninguno'}`
      );

      if (a.specialistId && a.recruiterStatus !== 'sent_to_specialist') {
        console.log(
          `     ⚠️  PROBLEMA: Tiene especialista pero recruiterStatus="${a.recruiterStatus}" (debe ser "sent_to_specialist")`
        );
      }
    }
  }

  // 3. Postulaciones en manos del especialista
  console.log('\n\n📋 APPLICATIONS PARA ESPECIALISTA:');
  console.log('─'.repeat(50));
  const idsVacantes = assignments.map(a => a.jobId);
  const applications = await prisma.application.findMany({
    where: {
      status: { in: ['sent_to_specialist', 'evaluating', 'sent_to_company'] },
      ...(jobId || specialistEmail ? { jobId: { in: idsVacantes } } : {})
    },
    include: { job: { select: { id: true, title: true } } },
    orderBy: { updatedAt: 'desc' }
  });

  if (applications.length === 0) {
    console.log('  ⚠️  NO HAY APPLICATIONS CON STATUS sent_to_specialist, evaluating o sent_to_company');
    console.log('     Esto significa que ningún reclutador ha enviado candidatos al especialista todavía.');
  } else {
    applications.forEach(app => {
      console.log(
        `  • ${enmascarar(app.candidateName)} | Status: ${app.status} | Vacante: ${app.job.title} (ID: ${app.jobId})`
      );
    });
  }

  // 4. Conteo por estado de cada vacante asignada (sin listar candidato por candidato)
  console.log('\n\n📋 APPLICATIONS POR VACANTE ASIGNADA:');
  console.log('─'.repeat(50));

  for (const assignment of assignments) {
    const porEstado = await prisma.application.groupBy({
      by: ['status'],
      where: { jobId: assignment.jobId },
      _count: { _all: true }
    });

    const total = porEstado.reduce((suma, fila) => suma + fila._count._all, 0);
    console.log(`\n  Vacante: "${assignment.job.title}" (ID: ${assignment.jobId})`);

    if (total === 0) {
      console.log('     No hay applications');
    } else {
      const resumen = Object.fromEntries(porEstado.map(f => [f.status, f._count._all]));
      console.log(`     Total: ${total} applications`);
      console.log(`     Por status: ${JSON.stringify(resumen)}`);
    }
  }

  // 5. Resumen de problemas
  console.log('\n\n🔍 DIAGNÓSTICO:');
  console.log('═'.repeat(50));

  const problems: string[] = [];

  if (specialists.length === 0) {
    problems.push('No hay usuarios con rol "specialist" que coincidan con el filtro');
  }

  const assignmentsWithoutSpecialist = assignments.filter(a => !a.specialistId);
  if (assignmentsWithoutSpecialist.length > 0) {
    problems.push(`${assignmentsWithoutSpecialist.length} vacante(s) sin especialista asignado`);
  }

  const assignmentsNotReady = assignments.filter(
    a => a.specialistId && a.recruiterStatus !== 'sent_to_specialist'
  );
  if (assignmentsNotReady.length > 0) {
    problems.push(
      `${assignmentsNotReady.length} vacante(s) con especialista pero recruiterStatus != "sent_to_specialist"`
    );
    problems.push('  → El reclutador debe enviar candidatos al especialista para que aparezcan en su dashboard');
  }

  if (applications.length === 0) {
    problems.push('No hay applications con status "sent_to_specialist"');
    problems.push('  → El reclutador debe mover candidatos de "En Proceso" a "Enviar a Especialista"');
  }

  if (problems.length === 0) {
    console.log('✅ No se detectaron problemas obvios');
    console.log('\nSi el especialista aún no ve candidatos, verificar:');
    console.log('  1. Que el usuario está logueado con el email correcto');
    console.log('  2. Que la cookie auth-token es válida');
    console.log('  3. Revisar la consola del navegador por errores');
  } else {
    console.log('❌ PROBLEMAS DETECTADOS:\n');
    problems.forEach((p, i) => console.log(`  ${i + 1}. ${p}`));
  }

  console.log('\n========================================\n');
}

debugAssignments()
  .catch(error => {
    console.error('❌ Error en el diagnóstico:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
