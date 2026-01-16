// Verificar que Ludim puede ver la vacante
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function verify() {
  // Simular la query del dashboard del especialista para Ludim (ID: 11)
  const assignments = await prisma.jobAssignment.findMany({
    where: {
      specialistId: 11,
      recruiterStatus: 'sent_to_specialist'
    },
    include: {
      job: {
        include: {
          applications: {
            where: {
              status: { in: ['sent_to_specialist', 'evaluating', 'sent_to_company', 'discarded'] }
            }
          }
        }
      }
    }
  });

  console.log('\n=== VERIFICACIÓN: Dashboard de Ludim (ID: 11) ===\n');
  console.log('Vacantes visibles para Ludim:', assignments.length);

  for (const a of assignments) {
    console.log('\n  📌 ' + a.job.title + ' (ID: ' + a.jobId + ')');
    console.log('     Applications para revisar: ' + a.job.applications.length);
    a.job.applications.forEach(app => {
      console.log('       • ' + app.candidateName + ' | ' + app.status);
    });
  }

  if (assignments.length === 0) {
    console.log('\n❌ Ludim NO puede ver ninguna vacante');
  } else {
    console.log('\n✅ Ludim PUEDE ver ' + assignments.length + ' vacante(s)');
  }

  await prisma.$disconnect();
}
verify();
