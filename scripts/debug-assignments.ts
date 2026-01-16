// Script de diagnóstico para investigar asignaciones
// Ejecutar con: npx ts-node scripts/debug-assignments.ts
// O: npx tsx scripts/debug-assignments.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function debugAssignments() {
  console.log('\n========================================');
  console.log('   DIAGNÓSTICO DE ASIGNACIONES');
  console.log('   Fecha:', new Date().toISOString());
  console.log('========================================\n');

  try {
    // 1. Obtener todos los especialistas
    console.log('📋 ESPECIALISTAS REGISTRADOS:');
    console.log('─'.repeat(50));
    const specialists = await prisma.user.findMany({
      where: { role: 'specialist' },
      select: {
        id: true,
        email: true,
        nombre: true,
        apellidoPaterno: true,
        specialty: true
      }
    });

    if (specialists.length === 0) {
      console.log('  ⚠️  NO HAY ESPECIALISTAS REGISTRADOS');
    } else {
      specialists.forEach(s => {
        console.log(`  • ID: ${s.id} | ${s.nombre} ${s.apellidoPaterno || ''} | ${s.email} | Especialidad: ${s.specialty || 'N/A'}`);
      });
    }

    // 2. Obtener todas las asignaciones
    console.log('\n📋 ASIGNACIONES DE VACANTES:');
    console.log('─'.repeat(50));
    const assignments = await prisma.jobAssignment.findMany({
      include: {
        job: {
          select: {
            id: true,
            title: true,
            company: true,
            status: true
          }
        },
        recruiter: {
          select: {
            id: true,
            email: true,
            nombre: true
          }
        },
        specialist: {
          select: {
            id: true,
            email: true,
            nombre: true
          }
        }
      },
      orderBy: { assignedAt: 'desc' }
    });

    if (assignments.length === 0) {
      console.log('  ⚠️  NO HAY ASIGNACIONES');
    } else {
      for (const a of assignments) {
        console.log(`\n  📌 Vacante: "${a.job.title}" (ID: ${a.jobId})`);
        console.log(`     Empresa: ${a.job.company}`);
        console.log(`     Estado vacante: ${a.job.status}`);
        console.log(`     Reclutador: ${a.recruiter?.nombre || 'N/A'} (ID: ${a.recruiterId})`);
        console.log(`     Recruiter Status: ${a.recruiterStatus}`);

        if (a.specialistId) {
          console.log(`     ✅ Especialista: ${a.specialist?.nombre || 'N/A'} (ID: ${a.specialistId})`);
          console.log(`     Specialist Status: ${a.specialistStatus}`);
        } else {
          console.log(`     ❌ SIN ESPECIALISTA ASIGNADO`);
        }

        console.log(`     Candidatos enviados al especialista: ${a.candidatesSentToSpecialist || 'ninguno'}`);

        // Verificar si el recruiterStatus permite que el especialista vea la vacante
        if (a.specialistId && a.recruiterStatus !== 'sent_to_specialist') {
          console.log(`     ⚠️  PROBLEMA: Tiene especialista pero recruiterStatus="${a.recruiterStatus}" (debe ser "sent_to_specialist")`);
        }
      }
    }

    // 3. Obtener applications relevantes
    console.log('\n\n📋 APPLICATIONS PARA ESPECIALISTA:');
    console.log('─'.repeat(50));
    const applications = await prisma.application.findMany({
      where: {
        status: { in: ['sent_to_specialist', 'evaluating', 'sent_to_company'] }
      },
      include: {
        job: {
          select: {
            id: true,
            title: true
          }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    if (applications.length === 0) {
      console.log('  ⚠️  NO HAY APPLICATIONS CON STATUS sent_to_specialist, evaluating o sent_to_company');
      console.log('     Esto significa que ningún reclutador ha enviado candidatos al especialista todavía.');
    } else {
      applications.forEach(app => {
        console.log(`  • ${app.candidateName} | Status: ${app.status} | Vacante: ${app.job.title} (ID: ${app.jobId})`);
      });
    }

    // 4. Verificar todas las applications por vacante asignada
    console.log('\n\n📋 TODAS LAS APPLICATIONS POR VACANTE ASIGNADA:');
    console.log('─'.repeat(50));

    for (const assignment of assignments) {
      const allApps = await prisma.application.findMany({
        where: { jobId: assignment.jobId },
        select: {
          id: true,
          candidateName: true,
          candidateEmail: true,
          status: true,
          createdAt: true
        },
        orderBy: { createdAt: 'desc' }
      });

      console.log(`\n  Vacante: "${assignment.job.title}" (ID: ${assignment.jobId})`);
      if (allApps.length === 0) {
        console.log('     No hay applications');
      } else {
        const statusCounts: Record<string, number> = {};
        allApps.forEach(app => {
          statusCounts[app.status] = (statusCounts[app.status] || 0) + 1;
        });

        console.log(`     Total: ${allApps.length} applications`);
        console.log(`     Por status: ${JSON.stringify(statusCounts)}`);

        allApps.forEach(app => {
          const icon = app.status === 'sent_to_specialist' ? '📤' :
                       app.status === 'pending' ? '⏳' :
                       app.status === 'reviewing' ? '🔍' :
                       app.status === 'discarded' ? '🗑️' : '📄';
          console.log(`       ${icon} ${app.candidateName} | ${app.status}`);
        });
      }
    }

    // 5. Resumen de problemas
    console.log('\n\n🔍 DIAGNÓSTICO:');
    console.log('═'.repeat(50));

    const problems: string[] = [];

    if (specialists.length === 0) {
      problems.push('No hay usuarios con rol "specialist"');
    }

    const assignmentsWithoutSpecialist = assignments.filter(a => !a.specialistId);
    if (assignmentsWithoutSpecialist.length > 0) {
      problems.push(`${assignmentsWithoutSpecialist.length} vacante(s) sin especialista asignado`);
    }

    const assignmentsNotReady = assignments.filter(
      a => a.specialistId && a.recruiterStatus !== 'sent_to_specialist'
    );
    if (assignmentsNotReady.length > 0) {
      problems.push(`${assignmentsNotReady.length} vacante(s) con especialista pero recruiterStatus != "sent_to_specialist"`);
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

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugAssignments();
