// Script para arreglar el recruiterStatus de la vacante Machine Learning
// Ejecutar con: npx tsx scripts/fix-assignment-status.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixAssignmentStatus() {
  console.log('\n========================================');
  console.log('   FIX: Actualizar recruiterStatus');
  console.log('========================================\n');

  try {
    // Buscar el JobAssignment de Machine Learning (jobId: 19)
    const assignment = await prisma.jobAssignment.findFirst({
      where: { jobId: 19 },
      include: {
        job: { select: { title: true } },
        specialist: { select: { nombre: true, email: true } }
      }
    });

    if (!assignment) {
      console.log('❌ No se encontró la asignación para jobId: 19');
      return;
    }

    console.log('Asignación encontrada:');
    console.log(`  Vacante: ${assignment.job.title}`);
    console.log(`  Especialista: ${assignment.specialist?.nombre} (${assignment.specialist?.email})`);
    console.log(`  recruiterStatus actual: ${assignment.recruiterStatus}`);
    console.log(`  specialistStatus actual: ${assignment.specialistStatus}`);

    if (assignment.recruiterStatus === 'sent_to_specialist') {
      console.log('\n✅ El recruiterStatus ya es "sent_to_specialist". No se necesitan cambios.');
      return;
    }

    // Actualizar el recruiterStatus
    const updated = await prisma.jobAssignment.update({
      where: { id: assignment.id },
      data: {
        recruiterStatus: 'sent_to_specialist',
        specialistStatus: 'pending'
      }
    });

    console.log('\n✅ Asignación actualizada:');
    console.log(`  recruiterStatus: ${updated.recruiterStatus}`);
    console.log(`  specialistStatus: ${updated.specialistStatus}`);
    console.log('\n¡Ludim ahora debería ver la vacante en su dashboard!');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixAssignmentStatus();
