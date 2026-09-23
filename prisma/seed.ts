// RUTA: prisma/seed.ts
//
// Variables de entorno del seed:
// ─────────────────────────────────────────────────────────────────────────────
// SEED_ADMIN_PASSWORD       - Contraseña del admin principal (SIEMPRE requerida)
//
// Datos demo (solo si NO se usa SEED_ONLY_CATALOGS=1):
// SEED_COMPANY_PASSWORD     - Contraseña para usuarios de empresa demo
// SEED_RECRUITER_PASSWORD   - Contraseña para reclutadores demo
// SEED_SPECIALIST_PASSWORD  - Contraseña para especialistas demo
// SEED_CANDIDATE_PASSWORD   - Contraseña para el candidato demo
// SEED_USER_PASSWORD        - Contraseña para usuarios normales demo
//
// Opcionales (cada una habilita su bloque):
// ADMIN2_EMAIL              - Correo de un segundo admin (antes estaba hardcodeado)
// SEED_ADMIN2_PASSWORD      - Requerida solo si se define ADMIN2_EMAIL
// SEED_STAFF_ACCOUNTS=1     - Crea las cuentas del staff real @inakat.com
// SEED_STAFF_PASSWORD       - Requerida solo si SEED_STAFF_ACCOUNTS=1
// SEED_ONLY_CATALOGS=1      - Siembra solo catálogos (especialidades, precios,
//                             paquetes) y el admin: nada de datos demo
// SEED_FORCE_RESET=1        - Permite que el seed SOBRESCRIBA lo que el admin
//                             editó (precios de paquetes, especialidades)
// SEED_ALLOW_REMOTE=1       - Autoriza correr el seed contra una BD que no es local
// ─────────────────────────────────────────────────────────────────────────────

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import {
  LONGITUD_MINIMA_PASSWORD,
  esBaseLocal,
  esPasswordInvalida,
  hostDeBaseDeDatos,
  motivoParaBloquearSeed,
  normalizarEmail
} from './seed-guards';

const prisma = new PrismaClient();

// Solo catálogos: sin empresas, vacantes, candidatos ni postulaciones de ejemplo
const soloCatalogos = process.env.SEED_ONLY_CATALOGS === '1';
// Sobrescribir configuración que el admin administra desde el panel
const forzarReset = process.env.SEED_FORCE_RESET === '1';
// Crear las cuentas del staff real (@inakat.com) con contraseña compartida
const sembrarStaff = process.env.SEED_STAFF_ACCOUNTS === '1';

// Validar que las variables de entorno requeridas existen Y tienen un valor real
function validateEnvVars(): void {
  const requiredVars = ['SEED_ADMIN_PASSWORD'];

  if (!soloCatalogos) {
    requiredVars.push(
      'SEED_COMPANY_PASSWORD',
      'SEED_RECRUITER_PASSWORD',
      'SEED_SPECIALIST_PASSWORD',
      'SEED_CANDIDATE_PASSWORD',
      'SEED_USER_PASSWORD'
    );
  }
  if (process.env.ADMIN2_EMAIL) requiredVars.push('SEED_ADMIN2_PASSWORD');
  if (sembrarStaff) requiredVars.push('SEED_STAFF_PASSWORD');

  const missing = requiredVars.filter(v => !process.env[v]);

  if (missing.length > 0) {
    console.error('❌ ERROR: Faltan variables de entorno requeridas para el seed:\n');
    missing.forEach(v => console.error(`   • ${v}`));
    console.error('\n📝 Agrega estas variables a tu archivo .env antes de ejecutar el seed.');
    console.error('   Consulta .env.example para más información.\n');
    process.exit(1);
  }

  // Rechazar los placeholders de .env.example y las contraseñas demasiado cortas:
  // con solo comprobar presencia, un 'CHANGE_ME_...' copiado tal cual quedaba
  // como contraseña real del admin.
  const invalid = requiredVars.filter(v => esPasswordInvalida(process.env[v]));

  if (invalid.length > 0) {
    console.error('❌ ERROR: Estas variables tienen un valor de ejemplo o demasiado corto:\n');
    invalid.forEach(v => console.error(`   • ${v}`));
    console.error(
      `\n📝 Usa contraseñas propias de al menos ${LONGITUD_MINIMA_PASSWORD} caracteres,` +
      ' no los placeholders de .env.example.\n'
    );
    process.exit(1);
  }
}

// El seed crea usuarios, vacantes y postulaciones de ejemplo: no debe poder
// ejecutarse por accidente contra producción (o cualquier BD remota compartida).
function validateEntorno(): void {
  const host = hostDeBaseDeDatos(process.env.DATABASE_URL);
  console.log(`🔌 Base de datos: ${host || '(host desconocido)'}`);

  const motivo = motivoParaBloquearSeed({
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    SEED_ALLOW_REMOTE: process.env.SEED_ALLOW_REMOTE
  });

  if (motivo === 'produccion') {
    console.error('\n❌ ERROR: NODE_ENV=production. El seed no corre contra producción.');
    console.error('   Si de verdad lo necesitas, exporta SEED_ALLOW_REMOTE=1.\n');
    process.exit(1);
  }

  if (motivo === 'host-remoto') {
    console.error(`\n❌ ERROR: DATABASE_URL apunta a "${host || 'un host desconocido'}", que no es local.`);
    console.error('   El seed crea datos de ejemplo y sobrescribiría una base compartida.');
    console.error('   Si de verdad lo necesitas, exporta SEED_ALLOW_REMOTE=1.\n');
    process.exit(1);
  }

  if (!esBaseLocal(host)) {
    console.log('⚠️  SEED_ALLOW_REMOTE=1: sembrando contra una base NO local.');
  }
}

async function main() {
  // Validar entorno y variables antes de escribir nada
  validateEntorno();
  validateEnvVars();

  console.log('🌱 Iniciando seed híbrido completo...\n');
  if (soloCatalogos) {
    console.log('📚 SEED_ONLY_CATALOGS=1: solo admin y catálogos, sin datos demo.\n');
  }

  // =============================================
  // 1. CREAR USUARIOS ADMIN
  // =============================================
  console.log('👤 Creando usuarios admin...');

  // El correo se normaliza a minúsculas porque el login busca email.toLowerCase()
  // y el unique de Postgres distingue mayúsculas: un ADMIN_EMAIL con mayúsculas
  // creaba un admin que nunca podía iniciar sesión.
  const admins = [
    {
      email: normalizarEmail(process.env.ADMIN_EMAIL || 'admin@inakat.com'),
      password: process.env.SEED_ADMIN_PASSWORD!,
      nombre: process.env.ADMIN_NOMBRE || 'Administrador'
    }
  ];

  // Segundo admin opcional: antes era un correo personal hardcodeado en el
  // código versionado, que se creaba en cualquier base donde corriera el seed.
  if (process.env.ADMIN2_EMAIL) {
    admins.push({
      email: normalizarEmail(process.env.ADMIN2_EMAIL),
      password: process.env.SEED_ADMIN2_PASSWORD!,
      nombre: process.env.ADMIN2_NOMBRE || 'Administrador 2'
    });
  }

  for (const adminData of admins) {
    const existingAdmin = await prisma.user.findUnique({
      where: { email: adminData.email }
    });

    if (existingAdmin) {
      console.log(`✅ Usuario admin ya existe: ${adminData.email}`);
      continue;
    }

    const hashedPassword = await bcrypt.hash(adminData.password, 10);

    const admin = await prisma.user.create({
      data: {
        email: adminData.email,
        password: hashedPassword,
        nombre: adminData.nombre,
        role: 'admin',
        isActive: true,
        emailVerified: new Date()
      }
    });

    console.log(`✅ Usuario admin creado: ${admin.email}`);
    console.log(`   📧 Email: ${adminData.email}`);
    console.log(`   🔑 Password: ********** (ver variables de entorno)\n`);
  }

  // =============================================
  // 1.5 CATÁLOGOS (especialidades, precios, paquetes y staff)
  // =============================================
  // Van antes que los datos demo para que SEED_ONLY_CATALOGS=1 pueda cortar
  // aquí: sembrar catálogos no debe arrastrar empresas y vacantes de ejemplo.
  await seedSpecialties();
  await seedPricingMatrix();
  await seedCreditPackages();
  await seedStaff();

  if (soloCatalogos) {
    console.log('\n✨ Catálogos sembrados. Se omiten los datos demo (SEED_ONLY_CATALOGS=1).\n');
    return;
  }

  // =============================================
  // 2. CREAR EMPRESAS (USERS CON ROLE COMPANY)
  // =============================================
  console.log('\n🏢 Creando empresas...');

  const companyPassword = await bcrypt.hash(process.env.SEED_COMPANY_PASSWORD!, 10);

  // Empresa 1: TechSolutions México
  let company1 = await prisma.user.findUnique({
    where: { email: 'contact@techsolutions.mx' }
  });

  if (!company1) {
    company1 = await prisma.user.create({
      data: {
        email: 'contact@techsolutions.mx',
        password: companyPassword,
        nombre: 'Juan Carlos',
        apellidoPaterno: 'Pérez',
        apellidoMaterno: 'García',
        role: 'company',
        isActive: true,
        emailVerified: new Date(),
        credits: 50 // ← CRÉDITOS INICIALES PARA PRUEBAS
      }
    });

    await prisma.companyRequest.create({
      data: {
        userId: company1.id,
        nombre: 'Juan Carlos',
        apellidoPaterno: 'Pérez',
        apellidoMaterno: 'García',
        nombreEmpresa: 'TechSolutions México',
        correoEmpresa: 'contact@techsolutions.mx',
        sitioWeb: 'https://techsolutions.mx',
        razonSocial: 'TechSolutions México S.A. de C.V.',
        rfc: 'TSM123456ABC',
        direccionEmpresa: 'Av. Constitución 100, Monterrey, Nuevo León',
        status: 'approved',
        approvedAt: new Date()
      }
    });

    console.log(
      `✅ Empresa creada: TechSolutions México (${company1.email}) - 50 créditos`
    );
  } else {
    console.log(`✅ Empresa ya existe: TechSolutions México`);
  }

  // Empresa 2: Creative Digital Studio
  let company2 = await prisma.user.findUnique({
    where: { email: 'rh@creativedigital.mx' }
  });

  if (!company2) {
    company2 = await prisma.user.create({
      data: {
        email: 'rh@creativedigital.mx',
        password: companyPassword,
        nombre: 'María Elena',
        apellidoPaterno: 'López',
        apellidoMaterno: 'Hernández',
        role: 'company',
        isActive: true,
        emailVerified: new Date(),
        credits: 50 // ← CRÉDITOS INICIALES
      }
    });

    await prisma.companyRequest.create({
      data: {
        userId: company2.id,
        nombre: 'María Elena',
        apellidoPaterno: 'López',
        apellidoMaterno: 'Hernández',
        nombreEmpresa: 'Creative Digital Studio',
        correoEmpresa: 'rh@creativedigital.mx',
        sitioWeb: 'https://creativedigital.mx',
        razonSocial: 'Creative Digital Studio S.A. de C.V.',
        rfc: 'CDS987654XYZ',
        direccionEmpresa: 'Av. Insurgentes Sur 500, CDMX',
        status: 'approved',
        approvedAt: new Date()
      }
    });

    console.log(
      `✅ Empresa creada: Creative Digital Studio (${company2.email}) - 50 créditos`
    );
  } else {
    console.log(`✅ Empresa ya existe: Creative Digital Studio`);
  }

  // Empresa 3: Grupo Financiero Nacional
  let company3 = await prisma.user.findUnique({
    where: { email: 'hr@grupofinanciero.mx' }
  });

  if (!company3) {
    company3 = await prisma.user.create({
      data: {
        email: 'hr@grupofinanciero.mx',
        password: companyPassword,
        nombre: 'Roberto',
        apellidoPaterno: 'Sánchez',
        apellidoMaterno: 'Martínez',
        role: 'company',
        isActive: true,
        emailVerified: new Date(),
        credits: 50 // ← CRÉDITOS INICIALES
      }
    });

    await prisma.companyRequest.create({
      data: {
        userId: company3.id,
        nombre: 'Roberto',
        apellidoPaterno: 'Sánchez',
        apellidoMaterno: 'Martínez',
        nombreEmpresa: 'Grupo Financiero Nacional',
        correoEmpresa: 'hr@grupofinanciero.mx',
        sitioWeb: 'https://grupofinanciero.mx',
        razonSocial: 'Grupo Financiero Nacional S.A.P.I. de C.V.',
        rfc: 'GFN456789KLM',
        direccionEmpresa: 'Torre Financiera, Reforma 222, CDMX',
        status: 'approved',
        approvedAt: new Date()
      }
    });

    console.log(
      `✅ Empresa creada: Grupo Financiero Nacional (${company3.email}) - 50 créditos`
    );
  } else {
    console.log(`✅ Empresa ya existe: Grupo Financiero Nacional`);
  }

  // =============================================
  // 2.5 RECLUTADORES DE PRUEBA
  // =============================================
  console.log('\n👥 Creando reclutadores de prueba...');
  const recruiterPassword = await bcrypt.hash(process.env.SEED_RECRUITER_PASSWORD!, 10);

  const recruiter1 = await prisma.user.upsert({
    where: { email: 'reclutador1@inakat.com' },
    update: {},
    create: {
      email: 'reclutador1@inakat.com',
      password: recruiterPassword,
      nombre: 'María',
      apellidoPaterno: 'García',
      apellidoMaterno: 'López',
      role: 'recruiter',
      isActive: true,
      emailVerified: new Date()
    }
  });
  console.log(`✅ Reclutador creado: ${recruiter1.email}`);

  const recruiter2 = await prisma.user.upsert({
    where: { email: 'reclutador2@inakat.com' },
    update: {},
    create: {
      email: 'reclutador2@inakat.com',
      password: recruiterPassword,
      nombre: 'Juan',
      apellidoPaterno: 'Pérez',
      apellidoMaterno: 'Martínez',
      role: 'recruiter',
      isActive: true,
      emailVerified: new Date()
    }
  });
  console.log(`✅ Reclutador creado: ${recruiter2.email}`);

  // =============================================
  // 2.6 ESPECIALISTAS DE PRUEBA
  // =============================================
  console.log('\n🔧 Creando especialistas de prueba...');
  const specialistPassword = await bcrypt.hash(process.env.SEED_SPECIALIST_PASSWORD!, 10);

  const specialist1 = await prisma.user.upsert({
    where: { email: 'especialista.tech@inakat.com' },
    update: {},
    create: {
      email: 'especialista.tech@inakat.com',
      password: specialistPassword,
      nombre: 'Carlos',
      apellidoPaterno: 'Rodríguez',
      apellidoMaterno: 'Sánchez',
      role: 'specialist',
      specialty: 'Tecnología',
      isActive: true,
      emailVerified: new Date()
    }
  });
  console.log(`✅ Especialista creado: ${specialist1.email} (Tecnología)`);

  const specialist2 = await prisma.user.upsert({
    where: { email: 'especialista.diseno@inakat.com' },
    update: {},
    create: {
      email: 'especialista.diseno@inakat.com',
      password: specialistPassword,
      nombre: 'Ana',
      apellidoPaterno: 'López',
      apellidoMaterno: 'Fernández',
      role: 'specialist',
      specialty: 'Diseño Gráfico',
      isActive: true,
      emailVerified: new Date()
    }
  });
  console.log(`✅ Especialista creado: ${specialist2.email} (Diseño Gráfico)`);

  const specialist3 = await prisma.user.upsert({
    where: { email: 'especialista.finanzas@inakat.com' },
    update: {},
    create: {
      email: 'especialista.finanzas@inakat.com',
      password: specialistPassword,
      nombre: 'Roberto',
      apellidoPaterno: 'Hernández',
      role: 'specialist',
      specialty: 'Finanzas',
      isActive: true,
      emailVerified: new Date()
    }
  });
  console.log(`✅ Especialista creado: ${specialist3.email} (Finanzas)`);

  // =============================================
  // 2.7 CANDIDATO CON CUENTA DE PRUEBA
  // =============================================
  console.log('\n🎯 Creando candidato con cuenta...');
  const candidatePassword = await bcrypt.hash(process.env.SEED_CANDIDATE_PASSWORD!, 10);

  const candidateUser = await prisma.user.upsert({
    where: { email: 'candidato.test@example.com' },
    update: {},
    create: {
      email: 'candidato.test@example.com',
      password: candidatePassword,
      nombre: 'Roberto',
      apellidoPaterno: 'Sánchez',
      apellidoMaterno: 'Gómez',
      role: 'candidate',
      isActive: true,
      emailVerified: new Date()
    }
  });

  // Crear el Candidate vinculado
  await prisma.candidate.upsert({
    where: { email: 'candidato.test@example.com' },
    update: { userId: candidateUser.id },
    create: {
      nombre: 'Roberto',
      apellidoPaterno: 'Sánchez',
      apellidoMaterno: 'Gómez',
      email: 'candidato.test@example.com',
      telefono: '5512345678',
      sexo: 'M',
      universidad: 'UNAM',
      carrera: 'Ingeniería en Computación',
      nivelEstudios: 'Licenciatura',
      profile: 'Tecnología',
      seniority: 'Jr',
      source: 'manual',
      status: 'available',
      userId: candidateUser.id
    }
  });
  console.log(`✅ Candidato con cuenta creado: ${candidateUser.email}`);

  // =============================================
  // 2.8 CREAR USUARIOS NORMALES (APLICANTES)
  // =============================================
  console.log('\n👤 Creando usuarios normales (aplicantes)...');

  const userPassword = await bcrypt.hash(process.env.SEED_USER_PASSWORD!, 10);

  const normalUsers = [
    {
      email: 'carlos.dev@example.com',
      password: userPassword,
      nombre: 'Carlos',
      apellidoPaterno: 'Ramírez',
      apellidoMaterno: 'López',
      role: 'user'
    },
    {
      email: 'ana.designer@example.com',
      password: userPassword,
      nombre: 'Ana',
      apellidoPaterno: 'Martínez',
      apellidoMaterno: 'García',
      role: 'user'
    },
    {
      email: 'luis.marketing@example.com',
      password: userPassword,
      nombre: 'Luis',
      apellidoPaterno: 'González',
      apellidoMaterno: 'Hernández',
      role: 'user'
    },
    {
      email: 'maria.rh@example.com',
      password: userPassword,
      nombre: 'María',
      apellidoPaterno: 'Sánchez',
      apellidoMaterno: 'Torres',
      role: 'user'
    },
    {
      email: 'pedro.junior@example.com',
      password: userPassword,
      nombre: 'Pedro',
      apellidoPaterno: 'Jiménez',
      apellidoMaterno: 'Ruiz',
      role: 'user'
    }
  ];

  let usersCreated = 0;
  for (const userData of normalUsers) {
    const existing = await prisma.user.findUnique({
      where: { email: userData.email }
    });

    if (!existing) {
      await prisma.user.create({
        data: {
          ...userData,
          isActive: true,
          emailVerified: new Date()
        }
      });
      usersCreated++;
      console.log(`✅ Usuario creado: ${userData.nombre} (${userData.email})`);
    } else {
      console.log(`⏭️  Usuario ya existe: ${userData.email}`);
    }
  }

  console.log(`✅ ${usersCreated} usuarios normales creados`);

  // (Los catálogos y el staff ya se sembraron en el paso 1.5)

  // =============================================
  // 3. CREAR VACANTES (DISTRIBUIDAS ENTRE EMPRESAS)
  // =============================================
  console.log('\n💼 Creando vacantes de ejemplo...\n');

  const sampleJobs = [
    // VACANTES DE TECHSOLUTIONS MÉXICO (company1) - 6 vacantes tech
    {
      title: 'Desarrollador Full Stack',
      company: 'TechSolutions México',
      location: 'Monterrey, Nuevo León',
      salary: '$35,000 - $50,000 / mes',
      jobType: 'Tiempo Completo',
      workMode: 'remote',
      profile: 'Tecnología', // ← NUEVO
      seniority: 'Middle', // ← NUEVO
      creditCost: 8, // ← NUEVO
      userId: company1.id,
      description: `Estamos buscando un desarrollador full stack apasionado para unirse a nuestro equipo dinámico.

Responsabilidades:
• Desarrollar aplicaciones web usando React y Node.js
• Colaborar con diseñadores y product managers
• Implementar APIs RESTful y GraphQL
• Mantener código de alta calidad con pruebas automatizadas

Ofrecemos:
• Ambiente de trabajo flexible
• Capacitación continua
• Seguro de gastos médicos mayores
• Vacaciones superiores a las de ley`,
      requirements: `• 3+ años de experiencia con JavaScript/TypeScript
• Experiencia sólida con React y Node.js
• Conocimientos de bases de datos SQL y NoSQL
• Familiaridad con Git y metodologías ágiles
• Inglés intermedio-avanzado
• Carrera en Ingeniería en Sistemas o afín`,
      status: 'active'
    },
    {
      title: 'Ingeniero DevOps',
      company: 'CloudNative Inc',
      location: 'Ciudad de México',
      salary: '$45,000 - $65,000 / mes',
      jobType: 'Tiempo Completo',
      workMode: 'presential',
      profile: 'Tecnología',
      seniority: 'Sr',
      creditCost: 14,
      userId: company1.id,
      description: `Únete a nuestro equipo de infraestructura cloud como Ingeniero DevOps.

Responsabilidades:
• Administrar infraestructura en AWS/Azure
• Implementar pipelines CI/CD
• Automatizar procesos con Terraform y Ansible
• Monitorear y optimizar sistemas en producción
• Garantizar alta disponibilidad de servicios`,
      requirements: `• 4+ años en roles DevOps o SRE
• Experiencia con Kubernetes y Docker
• Conocimientos de AWS o Azure
• Scripting en Python o Bash
• Certificaciones cloud (deseable)`,
      status: 'active'
    },
    {
      title: 'Analista de Ciberseguridad',
      company: 'SecureNet Solutions',
      location: 'Guadalajara, Jalisco',
      salary: '$40,000 - $55,000 / mes',
      jobType: 'Tiempo Completo',
      workMode: 'hybrid',
      profile: 'Tecnología',
      seniority: 'Middle',
      creditCost: 10,
      userId: company1.id,
      description: `Protege la infraestructura digital de empresas líderes.

Responsabilidades:
• Realizar análisis de vulnerabilidades
• Implementar controles de seguridad
• Responder a incidentes de seguridad
• Realizar auditorías de seguridad
• Capacitar al equipo en buenas prácticas`,
      requirements: `• Licenciatura en Ciberseguridad o Sistemas
• 2+ años en seguridad informática
• Conocimientos de herramientas SIEM
• Certificaciones como CEH, CISSP (deseable)
• Pensamiento analítico y atención al detalle`,
      status: 'active'
    },
    {
      title: 'Reclutador IT',
      company: 'TalentFinder',
      location: 'Ciudad de México',
      salary: '$22,000 - $32,000 / mes',
      jobType: 'Tiempo Completo',
      workMode: 'presential',
      profile: 'Administración de Oficina',
      seniority: 'Jr',
      creditCost: 5,
      userId: company1.id,
      description: `Conecta talento tech con las mejores oportunidades.

Responsabilidades:
• Reclutar perfiles de tecnología
• Realizar entrevistas técnicas básicas
• Gestionar proceso de selección end-to-end
• Mantener base de datos de candidatos
• Negociar ofertas laborales`,
      requirements: `• 2+ años en reclutamiento IT
• Conocimiento de tecnologías y roles tech
• Excelentes habilidades de comunicación
• Manejo de LinkedIn Recruiter
• Orientación a resultados`,
      status: 'active'
    },
    {
      title: 'Desarrollador Frontend (Freelance)',
      company: 'Digital Agency',
      location: 'Remoto',
      salary: '$400 - $600 / hora',
      jobType: 'Por Proyecto',
      workMode: 'remote',
      profile: 'Tecnología',
      seniority: 'Jr',
      creditCost: 5,
      userId: company1.id,
      description: `Proyectos web para clientes internacionales.

Esquema:
• Pago por proyecto o por hora
• Flexibilidad de horarios
• Proyectos variados y retadores
• Posibilidad de contrato indefinido

Tecnologías: React, Next.js, Vue.js`,
      requirements: `• Portfolio con proyectos reales
• 3+ años con React o Vue
• Manejo de Git
• Comunicación en inglés
• Disponibilidad mínima 20 hrs/semana`,
      status: 'active'
    },
    {
      title: 'Customer Success Specialist',
      company: 'SaaS Company',
      location: 'Remoto',
      salary: '$22,000 - $32,000 / mes',
      jobType: 'Tiempo Completo',
      workMode: 'remote',
      profile: 'Administración de Oficina',
      seniority: 'Jr',
      creditCost: 4,
      userId: company1.id,
      description: `Asegura el éxito de clientes en plataforma SaaS.

Responsabilidades:
• Onboarding de nuevos clientes
• Capacitación en uso de plataforma
• Resolver dudas técnicas
• Identificar oportunidades de upsell
• Monitorear satisfacción del cliente`,
      requirements: `• 1-2 años en atención a clientes
• Conocimientos técnicos básicos
• Excelente comunicación
• Empatía y paciencia
• Inglés intermedio`,
      status: 'active'
    },

    // VACANTES DE CREATIVE DIGITAL STUDIO (company2) - 6 vacantes diseño/marketing
    {
      title: 'Diseñador UX/UI Senior',
      company: 'Creative Digital Studio',
      location: 'Ciudad de México',
      salary: '$30,000 - $45,000 / mes',
      jobType: 'Tiempo Completo',
      workMode: 'hybrid',
      profile: 'Diseño Gráfico',
      seniority: 'Sr',
      creditCost: 11,
      userId: company2.id,
      description: `Crea experiencias digitales excepcionales para marcas reconocidas.

Responsabilidades:
• Diseñar interfaces web y móviles
• Crear prototipos interactivos en Figma
• Realizar investigación de usuarios
• Trabajar con equipos de desarrollo
• Mantener sistemas de diseño`,
      requirements: `• 4+ años de experiencia en UX/UI
• Dominio de Figma, Sketch o Adobe XD
• Portfolio sólido con casos de estudio
• Conocimientos de HTML/CSS (básico)
• Excelentes habilidades de comunicación`,
      status: 'active'
    },
    {
      title: 'Especialista en Marketing Digital',
      company: 'Marketing Pro Agency',
      location: 'Monterrey, Nuevo León',
      salary: '$25,000 - $35,000 / mes',
      jobType: 'Tiempo Completo',
      workMode: 'presential',
      profile: 'Administración de Oficina',
      seniority: 'Middle',
      creditCost: 7,
      userId: company2.id,
      description: `Impulsa estrategias digitales para clientes B2B y B2C.

Responsabilidades:
• Planear y ejecutar campañas en redes sociales
• Gestionar presupuestos de publicidad digital
• Analizar métricas y ROI
• Crear contenido para diferentes plataformas
• Optimizar campañas de Google Ads y Facebook Ads`,
      requirements: `• 2+ años en marketing digital
• Experiencia con Google Analytics y Google Ads
• Conocimientos de SEO/SEM
• Creatividad y pensamiento estratégico
• Carrera en Marketing o afín`,
      status: 'active'
    },
    {
      title: 'Community Manager',
      company: 'Social Media Masters',
      location: 'Remoto',
      salary: '$18,000 - $25,000 / mes',
      jobType: 'Tiempo Completo',
      workMode: 'remote',
      profile: 'Diseño Gráfico',
      seniority: 'Jr',
      creditCost: 5,
      userId: company2.id,
      description: `Gestiona la presencia digital de marcas en redes sociales.

Responsabilidades:
• Crear y programar contenido
• Responder comentarios y mensajes
• Monitorear menciones de marca
• Analizar métricas de engagement
• Colaborar con equipo creativo`,
      requirements: `• 1-2 años como Community Manager
• Conocimiento de plataformas sociales
• Redacción creativa
• Manejo de herramientas de programación
• Disponibilidad de horario flexible`,
      status: 'active'
    },
    {
      title: 'Psicólogo Organizacional',
      company: 'Consultoría Empresarial',
      location: 'Monterrey, Nuevo León',
      salary: '$20,000 - $30,000 / mes',
      jobType: 'Tiempo Completo',
      workMode: 'presential',
      profile: 'Educación',
      seniority: 'Middle',
      creditCost: 6,
      userId: company2.id,
      description: `Desarrolla talento y mejora clima organizacional.

Responsabilidades:
• Aplicar evaluaciones psicométricas
• Diseñar programas de desarrollo
• Realizar estudios de clima laboral
• Coaching y mentoring
• Intervenciones de cambio organizacional`,
      requirements: `• Licenciatura en Psicología (cédula)
• Especialización en Psicología Organizacional
• 2+ años de experiencia
• Conocimiento de herramientas psicométricas
• Habilidades de facilitación`,
      status: 'active'
    },
    {
      title: 'Diseñador Instruccional',
      company: 'EduTech Innovation',
      location: 'Remoto',
      salary: '$28,000 - $38,000 / mes',
      jobType: 'Tiempo Completo',
      workMode: 'remote',
      profile: 'Educación',
      seniority: 'Middle',
      creditCost: 5,
      userId: company2.id,
      description: `Crea experiencias de aprendizaje digital innovadoras.

Responsabilidades:
• Diseñar cursos e-learning
• Desarrollar contenidos educativos
• Utilizar herramientas de autor
• Aplicar modelos pedagógicos
• Evaluar efectividad de capacitaciones`,
      requirements: `• Licenciatura en Pedagogía o Educación
• 3+ años en diseño instruccional
• Dominio de Articulate Storyline o similar
• Conocimientos de LMS
• Pensamiento creativo`,
      status: 'active'
    },
    {
      title: 'Ejecutivo de Ventas B2B',
      company: 'Software Solutions Corp',
      location: 'Monterrey, Nuevo León',
      salary: '$20,000 - $30,000 + comisiones',
      jobType: 'Tiempo Completo',
      workMode: 'presential',
      profile: 'Administración de Oficina',
      seniority: 'Middle',
      creditCost: 7,
      userId: company2.id,
      description: `Vende soluciones de software empresarial.

Responsabilidades:
• Prospección de clientes corporativos
• Presentaciones de producto
• Negociación de contratos
• Seguimiento post-venta
• Alcanzar metas de ventas

Comisiones sin techo + prestaciones superiores`,
      requirements: `• 2+ años en ventas B2B
• Experiencia vendiendo software (deseable)
• Habilidades de negociación
• Orientación a resultados
• Licencia de conducir vigente`,
      status: 'active'
    },

    // VACANTES DE GRUPO FINANCIERO NACIONAL (company3) - 6 vacantes negocios/finanzas
    {
      title: 'Generalista de Recursos Humanos',
      company: 'Corporativo Industrial',
      location: 'Querétaro, Querétaro',
      salary: '$25,000 - $35,000 / mes',
      jobType: 'Tiempo Completo',
      workMode: 'presential',
      profile: 'Administración de Oficina',
      seniority: 'Middle',
      creditCost: 7,
      userId: company3.id,
      description: `Apoya todas las funciones de RRHH en empresa manufacturera.

Responsabilidades:
• Administración de nómina
• Reclutamiento y selección
• Capacitación y desarrollo
• Relaciones laborales
• Cumplimiento legal`,
      requirements: `• Licenciatura en Psicología o RRHH
• 3+ años como generalista
• Conocimiento de LFT
• Manejo de sistema de nómina
• Habilidades de negociación`,
      status: 'active'
    },
    {
      title: 'Analista Financiero',
      company: 'Grupo Financiero Nacional',
      location: 'Ciudad de México',
      salary: '$35,000 - $50,000 / mes',
      jobType: 'Tiempo Completo',
      workMode: 'presential',
      profile: 'Finanzas',
      seniority: 'Middle',
      creditCost: 7,
      userId: company3.id,
      description: `Analiza inversiones y proyecciones financieras.

Responsabilidades:
• Elaborar modelos financieros
• Analizar estados financieros
• Preparar reportes ejecutivos
• Evaluar proyectos de inversión
• Presentar recomendaciones a dirección`,
      requirements: `• Licenciatura en Finanzas o Contaduría
• 3+ años en análisis financiero
• Excel avanzado y modelado financiero
• Inglés avanzado
• CFA o certificación financiera (deseable)`,
      status: 'active'
    },
    {
      title: 'Project Manager',
      company: 'Consulting Group',
      location: 'Guadalajara, Jalisco',
      salary: '$40,000 - $55,000 / mes',
      jobType: 'Tiempo Completo',
      workMode: 'hybrid',
      profile: 'Administración de Oficina',
      seniority: 'Sr',
      creditCost: 10,
      userId: company3.id,
      description: `Lidera proyectos estratégicos de transformación digital.

Responsabilidades:
• Planificar y ejecutar proyectos
• Gestionar equipos multidisciplinarios
• Controlar presupuestos y timelines
• Comunicar con stakeholders
• Mitigar riesgos y resolver problemas`,
      requirements: `• 5+ años gestionando proyectos
• Certificación PMP o similar
• Experiencia con metodologías ágiles
• Excelentes habilidades de liderazgo
• Inglés fluido`,
      status: 'active'
    },
    {
      title: 'Contador General',
      company: 'Corporativo Comercial',
      location: 'Puebla, Puebla',
      salary: '$25,000 - $35,000 / mes',
      jobType: 'Tiempo Completo',
      workMode: 'presential',
      profile: 'Finanzas',
      seniority: 'Middle',
      creditCost: 7,
      userId: company3.id,
      description: `Gestiona contabilidad general de grupo empresarial.

Responsabilidades:
• Registro contable y conciliaciones
• Elaboración de estados financieros
• Declaraciones fiscales
• Auditorías internas y externas
• Análisis de cuentas`,
      requirements: `• Licenciatura en Contaduría (cédula)
• 4+ años como contador general
• Conocimiento de NIIF
• Manejo de CONTPAQi o SAP
• Orientación a detalles`,
      status: 'active'
    },
    {
      title: 'Ingeniero Mecatrónico',
      company: 'Automotive Parts Inc',
      location: 'Querétaro, Querétaro',
      salary: '$30,000 - $42,000 / mes',
      jobType: 'Tiempo Completo',
      workMode: 'presential',
      profile: 'Tecnología',
      seniority: 'Middle',
      creditCost: 10,
      userId: company3.id,
      description: `Desarrolla soluciones de automatización industrial.

Responsabilidades:
• Diseñar sistemas automatizados
• Programar PLCs y robots
• Mantener equipos de producción
• Optimizar procesos industriales
• Supervisar proyectos de mejora`,
      requirements: `• Ingeniería Mecatrónica o Electrónica
• 3+ años en manufactura
• Programación de PLCs (Siemens, Allen Bradley)
• Conocimientos de robótica
• Lectura de planos técnicos`,
      status: 'active'
    },
    {
      title: 'Ingeniero de Calidad',
      company: 'Manufacturing Excellence',
      location: 'Saltillo, Coahuila',
      salary: '$28,000 - $38,000 / mes',
      jobType: 'Tiempo Completo',
      workMode: 'presential',
      profile: 'Tecnología',
      seniority: 'Jr',
      creditCost: 6,
      userId: company3.id,
      description: `Asegura estándares de calidad en producción automotriz.

Responsabilidades:
• Implementar sistemas de calidad
• Realizar auditorías internas
• Análisis de causa raíz
• Manejo de quejas de clientes
• Capacitar personal en calidad`,
      requirements: `• Ingeniería Industrial o Mecánica
• Conocimiento de IATF 16949
• Herramientas de calidad (8Ds, AMEF, etc.)
• 2+ años en sector automotriz
• Six Sigma (deseable)`,
      status: 'active'
    }
  ];

  let jobsCreated = 0;
  // Ids de las vacantes del seed, en el mismo orden que sampleJobs. Las
  // postulaciones de ejemplo se cuelgan de estos ids y nunca de "las primeras
  // 18 vacantes de la base", que en staging/producción son vacantes reales.
  const idsVacantesDelSeed: number[] = [];

  for (const job of sampleJobs) {
    const existing = await prisma.job.findFirst({
      where: {
        title: job.title,
        company: job.company,
        userId: job.userId
      }
    });

    if (!existing) {
      const created = await prisma.job.create({ data: job });
      idsVacantesDelSeed.push(created.id);
      console.log(
        `✅ ${created.title} - ${created.company} (${created.creditCost} créditos)`
      );
      jobsCreated++;
    } else {
      idsVacantesDelSeed.push(existing.id);
      console.log(`⏭️  Ya existe: ${job.title}`);
    }
  }

  // =============================================
  // 4. CREAR APLICACIONES
  // =============================================
  await createSampleApplications(idsVacantesDelSeed);

  // =============================================
  // 5. CREAR SOLICITUDES PENDIENTES
  // =============================================
  console.log('\n🏢 Creando solicitudes de empresas pendientes...');

  const pendingRequests = [
    {
      nombre: 'Luis',
      apellidoPaterno: 'Martínez',
      apellidoMaterno: 'Rodríguez',
      nombreEmpresa: 'StartupMX',
      correoEmpresa: 'info@startupmx.com',
      sitioWeb: 'https://startupmx.com',
      razonSocial: 'StartupMX S.A. de C.V.',
      rfc: 'STM111222NNN',
      direccionEmpresa: 'Calle Reforma 321, Querétaro',
      status: 'pending'
    },
    {
      nombre: 'Carmen',
      apellidoPaterno: 'Vega',
      apellidoMaterno: 'Luna',
      nombreEmpresa: 'FinTech Solutions',
      correoEmpresa: 'contact@fintech.mx',
      sitioWeb: 'https://fintech.mx',
      razonSocial: 'FinTech Solutions S.A.P.I. de C.V.',
      rfc: 'FIN333444PPP',
      direccionEmpresa: 'Torre Financiera, Piso 15, CDMX',
      status: 'pending'
    }
  ];

  let requestsCreated = 0;
  for (const request of pendingRequests) {
    const existing = await prisma.companyRequest.findFirst({
      where: { rfc: request.rfc }
    });

    if (!existing) {
      await prisma.companyRequest.create({ data: request });
      requestsCreated++;
    }
  }

  console.log(`✅ ${requestsCreated} solicitudes pendientes creadas`);

  // =============================================
  // RESUMEN FINAL
  // =============================================
  console.log('\n✨ ¡Seed híbrido completado exitosamente!\n');
  console.log('📊 RESUMEN:');
  console.log(`  • Usuarios admin: ${admins.length} (${admins.map(a => a.email).join(', ')})`);
  console.log(`  • Empresas: 3 (cada una con 50 créditos de prueba)`);
  console.log(`  • Usuarios normales: ${usersCreated}`);
  console.log(
    `  • Vacantes: ${jobsCreated} nuevas creadas (18 total distribuidas)`
  );
  console.log(`  • Matriz de precios: ver detalles arriba`);
  console.log(`  • Paquetes de créditos: 4 (1, 10, 15, 20 créditos)`);
  console.log(`  • Aplicaciones: Ver detalles arriba`);
  console.log(`  • Solicitudes pendientes: ${requestsCreated}`);

  console.log('\n🔐 CREDENCIALES DE PRUEBA:');
  console.log('   (Las contraseñas se leen de variables de entorno SEED_*)\n');
  admins.forEach((a, i) => {
    console.log(`  👤 ADMIN ${i + 1}:`);
    console.log(`     Email: ${a.email}`);
    console.log(`     Password: $${i === 0 ? 'SEED_ADMIN_PASSWORD' : 'SEED_ADMIN2_PASSWORD'}`);
  });
  console.log('\n  🏢 EMPRESAS (Password: $SEED_COMPANY_PASSWORD):');
  console.log('     contact@techsolutions.mx - TechSolutions (50 créditos, 6 vacantes tech)');
  console.log('     rh@creativedigital.mx - Creative Digital (50 créditos, 6 vacantes diseño)');
  console.log('     hr@grupofinanciero.mx - Grupo Financiero (50 créditos, 6 vacantes finanzas)');
  console.log('\n  👥 RECLUTADORES (Password: $SEED_RECRUITER_PASSWORD):');
  console.log('     reclutador1@inakat.com');
  console.log('     reclutador2@inakat.com');

  console.log('\n  🔧 ESPECIALISTAS (Password: $SEED_SPECIALIST_PASSWORD):');
  console.log('     especialista.tech@inakat.com (Tecnología)');
  console.log('     especialista.diseno@inakat.com (Diseño Gráfico)');
  console.log('     especialista.finanzas@inakat.com (Finanzas)');

  console.log('\n  🎯 CANDIDATO CON CUENTA (Password: $SEED_CANDIDATE_PASSWORD):');
  console.log('     candidato.test@example.com');

  console.log('\n  👤 USUARIOS NORMALES (Password: $SEED_USER_PASSWORD):');
  console.log('     carlos.dev@example.com - Desarrollador');
  console.log('     ana.designer@example.com - Diseñadora');
  console.log('     luis.marketing@example.com - Marketing');
  console.log('     maria.rh@example.com - Recursos Humanos');
  console.log('     pedro.junior@example.com - Recién Egresado');
  console.log('\n🚀 Para probar:');
  console.log('   Admin: http://localhost:3000/admin/requests');
  console.log('   Empresa: http://localhost:3000/company/dashboard');
  console.log('   Usuario: http://localhost:3000/my-applications');
  console.log('   Reclutador: http://localhost:3000/recruiter/dashboard');
  console.log('   Especialista: http://localhost:3000/specialist/dashboard\n');
}

// Recibe los ids de las vacantes creadas por este mismo seed, en el orden de
// sampleJobs. Antes hacía findMany({ take: 18 }) sin where ni orderBy: en una
// base con vacantes reales les colgaba postulaciones inventadas.
async function createSampleApplications(idsVacantesDelSeed: number[]) {
  console.log('\n📝 Creando aplicaciones de ejemplo...\n');

  const jobs = idsVacantesDelSeed.map(id => ({ id }));

  if (jobs.length === 0) {
    console.log('⚠️  No hay vacantes del seed, saltando creación de aplicaciones.');
    return;
  }

  // Obtener IDs de los usuarios registrados
  const carlos = await prisma.user.findUnique({
    where: { email: 'carlos.dev@example.com' }
  });
  const ana = await prisma.user.findUnique({
    where: { email: 'ana.designer@example.com' }
  });
  const luis = await prisma.user.findUnique({
    where: { email: 'luis.marketing@example.com' }
  });
  const maria = await prisma.user.findUnique({
    where: { email: 'maria.rh@example.com' }
  });
  const pedro = await prisma.user.findUnique({
    where: { email: 'pedro.junior@example.com' }
  });

  const sampleApplications = [
    // CARLOS - Desarrollador (3 aplicaciones tech)
    {
      jobId: jobs[0]?.id,
      userId: carlos?.id,
      candidateName: 'Carlos Ramírez López',
      candidateEmail: 'carlos.dev@example.com',
      candidatePhone: '+52 81 1234 5678',
      coverLetter:
        'Estimado equipo, como desarrollador con 3 años de experiencia en React y Node.js, me entusiasma la oportunidad de unirme a su equipo. He trabajado en proyectos similares y estoy seguro de que puedo aportar valor.',
      status: 'pending'
    },
    {
      jobId: jobs[1]?.id,
      userId: carlos?.id,
      candidateName: 'Carlos Ramírez López',
      candidateEmail: 'carlos.dev@example.com',
      candidatePhone: '+52 81 1234 5678',
      coverLetter:
        'Me interesa mucho esta posición de DevOps. Tengo experiencia con Docker y Kubernetes, y he gestionado infraestructura en AWS.',
      status: 'reviewing',
      reviewedAt: new Date()
    },
    {
      jobId: jobs[2]?.id,
      userId: carlos?.id,
      candidateName: 'Carlos Ramírez López',
      candidateEmail: 'carlos.dev@example.com',
      candidatePhone: '+52 81 1234 5678',
      coverLetter:
        'Aunque mi experiencia principal es en desarrollo, tengo gran interés en seguridad informática y estoy certificándome en ethical hacking.',
      status: 'accepted',
      reviewedAt: new Date(),
      notes: 'Excelente perfil técnico. Oferta enviada.'
    },

    // ANA - Diseñadora (4 aplicaciones diseño/UX)
    {
      jobId: jobs[6]?.id,
      userId: ana?.id,
      candidateName: 'Ana Martínez García',
      candidateEmail: 'ana.designer@example.com',
      candidatePhone: '+52 55 9876 5432',
      coverLetter:
        'Como diseñadora UX/UI con más de 4 años de experiencia, he trabajado en proyectos para empresas como [empresas]. Domino Figma y tengo un portfolio que me encantaría compartir.',
      status: 'interviewed',
      reviewedAt: new Date(),
      notes: 'Portfolio muy bueno. Programar segunda entrevista.'
    },
    {
      jobId: jobs[10]?.id,
      userId: ana?.id,
      candidateName: 'Ana Martínez García',
      candidateEmail: 'ana.designer@example.com',
      candidatePhone: '+52 55 9876 5432',
      coverLetter:
        'Mi experiencia en UX/UI me ha dado una perspectiva única para el diseño instruccional. He creado experiencias de aprendizaje digitales intuitivas.',
      status: 'pending'
    },
    {
      jobId: jobs[8]?.id,
      userId: ana?.id,
      candidateName: 'Ana Martínez García',
      candidateEmail: 'ana.designer@example.com',
      candidatePhone: '+52 55 9876 5432',
      coverLetter:
        'Además de diseño, tengo experiencia gestionando redes sociales para marcas. Me apasiona la comunicación visual.',
      status: 'rejected',
      reviewedAt: new Date(),
      notes: 'Perfil más orientado a diseño que a community management.'
    },
    {
      jobId: jobs[4]?.id,
      userId: ana?.id,
      candidateName: 'Ana Martínez García',
      candidateEmail: 'ana.designer@example.com',
      candidatePhone: '+52 55 9876 5432',
      coverLetter:
        'Busco proyectos freelance que combinen diseño y desarrollo frontend. Manejo HTML/CSS/JS y frameworks modernos.',
      status: 'reviewing',
      reviewedAt: new Date()
    },

    // LUIS - Marketing (2 aplicaciones marketing)
    {
      jobId: jobs[7]?.id,
      userId: luis?.id,
      candidateName: 'Luis González Hernández',
      candidateEmail: 'luis.marketing@example.com',
      candidatePhone: '+52 33 5555 6666',
      coverLetter:
        'Especialista en marketing digital con 3 años de experiencia gestionando campañas en Google Ads y Facebook Ads. He logrado aumentar el ROI en un 150% en mi último proyecto.',
      status: 'pending'
    },
    {
      jobId: jobs[8]?.id,
      userId: luis?.id,
      candidateName: 'Luis González Hernández',
      candidateEmail: 'luis.marketing@example.com',
      candidatePhone: '+52 33 5555 6666',
      coverLetter:
        'Tengo experiencia gestionando comunidades de más de 50k seguidores. Me apasiona crear contenido que conecte con la audiencia.',
      status: 'reviewing',
      reviewedAt: new Date()
    },

    // MARÍA - RRHH (2 aplicaciones RRHH)
    {
      jobId: jobs[12]?.id,
      userId: maria?.id,
      candidateName: 'María Sánchez Torres',
      candidateEmail: 'maria.rh@example.com',
      candidatePhone: '+52 442 777 8888',
      coverLetter:
        'Psicóloga organizacional con 4 años de experiencia en todas las áreas de RRHH. He implementado sistemas de evaluación del desempeño y clima laboral.',
      status: 'interviewed',
      reviewedAt: new Date(),
      notes: 'Muy buena entrevista. Verificar referencias.'
    },
    {
      jobId: jobs[9]?.id,
      userId: maria?.id,
      candidateName: 'María Sánchez Torres',
      candidateEmail: 'maria.rh@example.com',
      candidatePhone: '+52 442 777 8888',
      coverLetter:
        'Mi especialidad es psicología organizacional. He diseñado programas de desarrollo de talento y coaching ejecutivo.',
      status: 'pending'
    },

    // PEDRO - Junior (2 aplicaciones entry-level)
    {
      jobId: jobs[5]?.id,
      userId: pedro?.id,
      candidateName: 'Pedro Jiménez Ruiz',
      candidateEmail: 'pedro.junior@example.com',
      candidatePhone: '+52 55 3333 4444',
      coverLetter:
        'Recién egresado de la carrera de Administración. Busco mi primera oportunidad en atención a clientes. Soy muy responsable y aprendo rápido.',
      status: 'pending'
    },
    {
      jobId: jobs[3]?.id,
      userId: pedro?.id,
      candidateName: 'Pedro Jiménez Ruiz',
      candidateEmail: 'pedro.junior@example.com',
      candidatePhone: '+52 55 3333 4444',
      coverLetter:
        'Me interesa el área de reclutamiento. Aunque no tengo experiencia formal, he participado en proyectos universitarios de selección de personal.',
      status: 'rejected',
      reviewedAt: new Date(),
      notes: 'Sin experiencia requerida para el puesto.'
    }
  ];

  let created = 0;
  for (const appData of sampleApplications) {
    if (!appData.jobId) continue;

    const existing = await prisma.application.findFirst({
      where: {
        candidateEmail: appData.candidateEmail,
        jobId: appData.jobId
      }
    });

    if (!existing) {
      await prisma.application.create({ data: appData });
      created++;
      console.log(
        `✅ Aplicación creada: ${appData.candidateName} → ${appData.status}`
      );
    }
  }

  console.log(`\n✅ ${created} aplicaciones de ejemplo creadas\n`);
}

async function seedPricingMatrix() {
  console.log('\n🎯 Poblando matriz de precios...\n');

  // MATRIZ BASE: Perfil x Seniority x Modalidad
  const baseMatrix = [
    // TECNOLOGÍA (15 combinaciones)
    {
      profile: 'Tecnología',
      seniority: 'Practicante',
      workMode: 'remote',
      location: null,
      credits: 4
    },
    {
      profile: 'Tecnología',
      seniority: 'Practicante',
      workMode: 'hybrid',
      location: null,
      credits: 5
    },
    {
      profile: 'Tecnología',
      seniority: 'Practicante',
      workMode: 'presential',
      location: 'Monterrey',
      credits: 5
    },
    {
      profile: 'Tecnología',
      seniority: 'Jr',
      workMode: 'remote',
      location: null,
      credits: 5
    },
    {
      profile: 'Tecnología',
      seniority: 'Jr',
      workMode: 'hybrid',
      location: null,
      credits: 6
    },
    {
      profile: 'Tecnología',
      seniority: 'Jr',
      workMode: 'presential',
      location: 'Monterrey',
      credits: 6
    },
    {
      profile: 'Tecnología',
      seniority: 'Middle',
      workMode: 'remote',
      location: null,
      credits: 8
    },
    {
      profile: 'Tecnología',
      seniority: 'Middle',
      workMode: 'hybrid',
      location: null,
      credits: 10
    },
    {
      profile: 'Tecnología',
      seniority: 'Middle',
      workMode: 'presential',
      location: 'Monterrey',
      credits: 10
    },
    {
      profile: 'Tecnología',
      seniority: 'Sr',
      workMode: 'remote',
      location: null,
      credits: 12
    },
    {
      profile: 'Tecnología',
      seniority: 'Sr',
      workMode: 'hybrid',
      location: null,
      credits: 14
    },
    {
      profile: 'Tecnología',
      seniority: 'Sr',
      workMode: 'presential',
      location: 'Monterrey',
      credits: 14
    },
    {
      profile: 'Tecnología',
      seniority: 'Director',
      workMode: 'remote',
      location: null,
      credits: 15
    },
    {
      profile: 'Tecnología',
      seniority: 'Director',
      workMode: 'hybrid',
      location: null,
      credits: 18
    },
    {
      profile: 'Tecnología',
      seniority: 'Director',
      workMode: 'presential',
      location: 'Monterrey',
      credits: 18
    },

    // ARQUITECTURA (15 combinaciones - mismos precios que tecnología)
    {
      profile: 'Arquitectura',
      seniority: 'Practicante',
      workMode: 'remote',
      location: null,
      credits: 4
    },
    {
      profile: 'Arquitectura',
      seniority: 'Practicante',
      workMode: 'hybrid',
      location: null,
      credits: 5
    },
    {
      profile: 'Arquitectura',
      seniority: 'Practicante',
      workMode: 'presential',
      location: 'Monterrey',
      credits: 5
    },
    {
      profile: 'Arquitectura',
      seniority: 'Jr',
      workMode: 'remote',
      location: null,
      credits: 5
    },
    {
      profile: 'Arquitectura',
      seniority: 'Jr',
      workMode: 'hybrid',
      location: null,
      credits: 6
    },
    {
      profile: 'Arquitectura',
      seniority: 'Jr',
      workMode: 'presential',
      location: 'Monterrey',
      credits: 6
    },
    {
      profile: 'Arquitectura',
      seniority: 'Middle',
      workMode: 'remote',
      location: null,
      credits: 8
    },
    {
      profile: 'Arquitectura',
      seniority: 'Middle',
      workMode: 'hybrid',
      location: null,
      credits: 10
    },
    {
      profile: 'Arquitectura',
      seniority: 'Middle',
      workMode: 'presential',
      location: 'Monterrey',
      credits: 10
    },
    {
      profile: 'Arquitectura',
      seniority: 'Sr',
      workMode: 'remote',
      location: null,
      credits: 12
    },
    {
      profile: 'Arquitectura',
      seniority: 'Sr',
      workMode: 'hybrid',
      location: null,
      credits: 14
    },
    {
      profile: 'Arquitectura',
      seniority: 'Sr',
      workMode: 'presential',
      location: 'Monterrey',
      credits: 14
    },
    {
      profile: 'Arquitectura',
      seniority: 'Director',
      workMode: 'remote',
      location: null,
      credits: 15
    },
    {
      profile: 'Arquitectura',
      seniority: 'Director',
      workMode: 'hybrid',
      location: null,
      credits: 18
    },
    {
      profile: 'Arquitectura',
      seniority: 'Director',
      workMode: 'presential',
      location: 'Monterrey',
      credits: 18
    },

    // DISEÑO GRÁFICO (15 combinaciones)
    {
      profile: 'Diseño Gráfico',
      seniority: 'Practicante',
      workMode: 'remote',
      location: null,
      credits: 4
    },
    {
      profile: 'Diseño Gráfico',
      seniority: 'Practicante',
      workMode: 'hybrid',
      location: null,
      credits: 5
    },
    {
      profile: 'Diseño Gráfico',
      seniority: 'Practicante',
      workMode: 'presential',
      location: 'Monterrey',
      credits: 5
    },
    {
      profile: 'Diseño Gráfico',
      seniority: 'Jr',
      workMode: 'remote',
      location: null,
      credits: 5
    },
    {
      profile: 'Diseño Gráfico',
      seniority: 'Jr',
      workMode: 'hybrid',
      location: null,
      credits: 6
    },
    {
      profile: 'Diseño Gráfico',
      seniority: 'Jr',
      workMode: 'presential',
      location: 'Monterrey',
      credits: 6
    },
    {
      profile: 'Diseño Gráfico',
      seniority: 'Middle',
      workMode: 'remote',
      location: null,
      credits: 6
    },
    {
      profile: 'Diseño Gráfico',
      seniority: 'Middle',
      workMode: 'hybrid',
      location: null,
      credits: 8
    },
    {
      profile: 'Diseño Gráfico',
      seniority: 'Middle',
      workMode: 'presential',
      location: 'Monterrey',
      credits: 8
    },
    {
      profile: 'Diseño Gráfico',
      seniority: 'Sr',
      workMode: 'remote',
      location: null,
      credits: 9
    },
    {
      profile: 'Diseño Gráfico',
      seniority: 'Sr',
      workMode: 'hybrid',
      location: null,
      credits: 11
    },
    {
      profile: 'Diseño Gráfico',
      seniority: 'Sr',
      workMode: 'presential',
      location: 'Monterrey',
      credits: 11
    },
    {
      profile: 'Diseño Gráfico',
      seniority: 'Director',
      workMode: 'remote',
      location: null,
      credits: 12
    },
    {
      profile: 'Diseño Gráfico',
      seniority: 'Director',
      workMode: 'hybrid',
      location: null,
      credits: 14
    },
    {
      profile: 'Diseño Gráfico',
      seniority: 'Director',
      workMode: 'presential',
      location: 'Monterrey',
      credits: 14
    },

    // PRODUCCIÓN AUDIOVISUAL (15 combinaciones - mismos precios que Diseño Gráfico)
    {
      profile: 'Producción Audiovisual',
      seniority: 'Practicante',
      workMode: 'remote',
      location: null,
      credits: 4
    },
    {
      profile: 'Producción Audiovisual',
      seniority: 'Practicante',
      workMode: 'hybrid',
      location: null,
      credits: 5
    },
    {
      profile: 'Producción Audiovisual',
      seniority: 'Practicante',
      workMode: 'presential',
      location: 'Monterrey',
      credits: 5
    },
    {
      profile: 'Producción Audiovisual',
      seniority: 'Jr',
      workMode: 'remote',
      location: null,
      credits: 5
    },
    {
      profile: 'Producción Audiovisual',
      seniority: 'Jr',
      workMode: 'hybrid',
      location: null,
      credits: 6
    },
    {
      profile: 'Producción Audiovisual',
      seniority: 'Jr',
      workMode: 'presential',
      location: 'Monterrey',
      credits: 6
    },
    {
      profile: 'Producción Audiovisual',
      seniority: 'Middle',
      workMode: 'remote',
      location: null,
      credits: 6
    },
    {
      profile: 'Producción Audiovisual',
      seniority: 'Middle',
      workMode: 'hybrid',
      location: null,
      credits: 8
    },
    {
      profile: 'Producción Audiovisual',
      seniority: 'Middle',
      workMode: 'presential',
      location: 'Monterrey',
      credits: 8
    },
    {
      profile: 'Producción Audiovisual',
      seniority: 'Sr',
      workMode: 'remote',
      location: null,
      credits: 9
    },
    {
      profile: 'Producción Audiovisual',
      seniority: 'Sr',
      workMode: 'hybrid',
      location: null,
      credits: 11
    },
    {
      profile: 'Producción Audiovisual',
      seniority: 'Sr',
      workMode: 'presential',
      location: 'Monterrey',
      credits: 11
    },
    {
      profile: 'Producción Audiovisual',
      seniority: 'Director',
      workMode: 'remote',
      location: null,
      credits: 12
    },
    {
      profile: 'Producción Audiovisual',
      seniority: 'Director',
      workMode: 'hybrid',
      location: null,
      credits: 14
    },
    {
      profile: 'Producción Audiovisual',
      seniority: 'Director',
      workMode: 'presential',
      location: 'Monterrey',
      credits: 14
    },

    // EDUCACIÓN (15 combinaciones)
    {
      profile: 'Educación',
      seniority: 'Practicante',
      workMode: 'remote',
      location: null,
      credits: 3
    },
    {
      profile: 'Educación',
      seniority: 'Practicante',
      workMode: 'hybrid',
      location: null,
      credits: 4
    },
    {
      profile: 'Educación',
      seniority: 'Practicante',
      workMode: 'presential',
      location: 'Monterrey',
      credits: 4
    },
    {
      profile: 'Educación',
      seniority: 'Jr',
      workMode: 'remote',
      location: null,
      credits: 4
    },
    {
      profile: 'Educación',
      seniority: 'Jr',
      workMode: 'hybrid',
      location: null,
      credits: 5
    },
    {
      profile: 'Educación',
      seniority: 'Jr',
      workMode: 'presential',
      location: 'Monterrey',
      credits: 5
    },
    {
      profile: 'Educación',
      seniority: 'Middle',
      workMode: 'remote',
      location: null,
      credits: 5
    },
    {
      profile: 'Educación',
      seniority: 'Middle',
      workMode: 'hybrid',
      location: null,
      credits: 6
    },
    {
      profile: 'Educación',
      seniority: 'Middle',
      workMode: 'presential',
      location: 'Monterrey',
      credits: 6
    },
    {
      profile: 'Educación',
      seniority: 'Sr',
      workMode: 'remote',
      location: null,
      credits: 6
    },
    {
      profile: 'Educación',
      seniority: 'Sr',
      workMode: 'hybrid',
      location: null,
      credits: 9
    },
    {
      profile: 'Educación',
      seniority: 'Sr',
      workMode: 'presential',
      location: 'Monterrey',
      credits: 9
    },
    {
      profile: 'Educación',
      seniority: 'Director',
      workMode: 'remote',
      location: null,
      credits: 10
    },
    {
      profile: 'Educación',
      seniority: 'Director',
      workMode: 'hybrid',
      location: null,
      credits: 12
    },
    {
      profile: 'Educación',
      seniority: 'Director',
      workMode: 'presential',
      location: 'Monterrey',
      credits: 12
    },

    // ADMINISTRACIÓN DE OFICINA (15 combinaciones)
    {
      profile: 'Administración de Oficina',
      seniority: 'Practicante',
      workMode: 'remote',
      location: null,
      credits: 3
    },
    {
      profile: 'Administración de Oficina',
      seniority: 'Practicante',
      workMode: 'hybrid',
      location: null,
      credits: 4
    },
    {
      profile: 'Administración de Oficina',
      seniority: 'Practicante',
      workMode: 'presential',
      location: 'Monterrey',
      credits: 4
    },
    {
      profile: 'Administración de Oficina',
      seniority: 'Jr',
      workMode: 'remote',
      location: null,
      credits: 4
    },
    {
      profile: 'Administración de Oficina',
      seniority: 'Jr',
      workMode: 'hybrid',
      location: null,
      credits: 5
    },
    {
      profile: 'Administración de Oficina',
      seniority: 'Jr',
      workMode: 'presential',
      location: 'Monterrey',
      credits: 5
    },
    {
      profile: 'Administración de Oficina',
      seniority: 'Middle',
      workMode: 'remote',
      location: null,
      credits: 5
    },
    {
      profile: 'Administración de Oficina',
      seniority: 'Middle',
      workMode: 'hybrid',
      location: null,
      credits: 7
    },
    {
      profile: 'Administración de Oficina',
      seniority: 'Middle',
      workMode: 'presential',
      location: 'Monterrey',
      credits: 7
    },
    {
      profile: 'Administración de Oficina',
      seniority: 'Sr',
      workMode: 'remote',
      location: null,
      credits: 7
    },
    {
      profile: 'Administración de Oficina',
      seniority: 'Sr',
      workMode: 'hybrid',
      location: null,
      credits: 10
    },
    {
      profile: 'Administración de Oficina',
      seniority: 'Sr',
      workMode: 'presential',
      location: 'Monterrey',
      credits: 10
    },
    {
      profile: 'Administración de Oficina',
      seniority: 'Director',
      workMode: 'remote',
      location: null,
      credits: 11
    },
    {
      profile: 'Administración de Oficina',
      seniority: 'Director',
      workMode: 'hybrid',
      location: null,
      credits: 13
    },
    {
      profile: 'Administración de Oficina',
      seniority: 'Director',
      workMode: 'presential',
      location: 'Monterrey',
      credits: 13
    },

    // FINANZAS (15 combinaciones - mismos precios que Administración de Oficina)
    {
      profile: 'Finanzas',
      seniority: 'Practicante',
      workMode: 'remote',
      location: null,
      credits: 3
    },
    {
      profile: 'Finanzas',
      seniority: 'Practicante',
      workMode: 'hybrid',
      location: null,
      credits: 4
    },
    {
      profile: 'Finanzas',
      seniority: 'Practicante',
      workMode: 'presential',
      location: 'Monterrey',
      credits: 4
    },
    {
      profile: 'Finanzas',
      seniority: 'Jr',
      workMode: 'remote',
      location: null,
      credits: 4
    },
    {
      profile: 'Finanzas',
      seniority: 'Jr',
      workMode: 'hybrid',
      location: null,
      credits: 5
    },
    {
      profile: 'Finanzas',
      seniority: 'Jr',
      workMode: 'presential',
      location: 'Monterrey',
      credits: 5
    },
    {
      profile: 'Finanzas',
      seniority: 'Middle',
      workMode: 'remote',
      location: null,
      credits: 5
    },
    {
      profile: 'Finanzas',
      seniority: 'Middle',
      workMode: 'hybrid',
      location: null,
      credits: 7
    },
    {
      profile: 'Finanzas',
      seniority: 'Middle',
      workMode: 'presential',
      location: 'Monterrey',
      credits: 7
    },
    {
      profile: 'Finanzas',
      seniority: 'Sr',
      workMode: 'remote',
      location: null,
      credits: 7
    },
    {
      profile: 'Finanzas',
      seniority: 'Sr',
      workMode: 'hybrid',
      location: null,
      credits: 10
    },
    {
      profile: 'Finanzas',
      seniority: 'Sr',
      workMode: 'presential',
      location: 'Monterrey',
      credits: 10
    },
    {
      profile: 'Finanzas',
      seniority: 'Director',
      workMode: 'remote',
      location: null,
      credits: 11
    },
    {
      profile: 'Finanzas',
      seniority: 'Director',
      workMode: 'hybrid',
      location: null,
      credits: 13
    },
    {
      profile: 'Finanzas',
      seniority: 'Director',
      workMode: 'presential',
      location: 'Monterrey',
      credits: 13
    }
  ];

  // Los perfiles de la matriz TIENEN que llamarse igual que las especialidades:
  // calculateJobCreditCost busca por string exacto y, si no encuentra fila,
  // cobra DEFAULT_CREDITS (5) en silencio.
  const nombresCatalogo = specialtiesData.map(s => s.name);
  const perfilesMatriz = [...new Set(baseMatrix.map(p => p.profile))];

  const perfilesHuerfanos = perfilesMatriz.filter(p => !nombresCatalogo.includes(p));
  if (perfilesHuerfanos.length > 0) {
    console.warn(
      `⚠️  Perfiles de la matriz que NO existen en el catálogo de especialidades: ${perfilesHuerfanos.join(', ')}`
    );
  }

  const especialidadesSinPrecio = nombresCatalogo.filter(n => !perfilesMatriz.includes(n));
  if (especialidadesSinPrecio.length > 0) {
    console.warn(
      `⚠️  Especialidades sin precio configurado (se cobrarían al valor por defecto): ${especialidadesSinPrecio.join(', ')}`
    );
  }

  let created = 0;
  let skipped = 0;

  for (const price of baseMatrix) {
    // Comprobación explícita en vez de un try/catch ciego: con location null el
    // @@unique de Postgres no impide duplicados (NULL <> NULL), así que un
    // create a ciegas no fallaba, duplicaba la fila.
    const existing = await prisma.pricingMatrix.findFirst({
      where: {
        profile: price.profile,
        seniority: price.seniority,
        workMode: price.workMode,
        location: price.location
      }
    });

    if (existing) {
      skipped++;
      continue;
    }

    await prisma.pricingMatrix.create({ data: price });
    created++;
  }

  console.log(`✨ Matriz de precios poblada:`);
  console.log(`   Creados: ${created}`);
  console.log(`   Saltados (ya existían): ${skipped}`);
  console.log(
    `   Total sembrado: ${baseMatrix.length} combinaciones (${perfilesMatriz.length} perfiles x 5 seniorities x 3 modalidades)\n`
  );
}

const specialtiesData = [
  {
    name: 'Tecnología',
    slug: 'tecnologia',
    description: 'Desarrollo de software, infraestructura y sistemas',
    icon: '💻',
    color: '#3B82F6',
    sortOrder: 1,
    subcategories: [
      'Desarrollo web',
      'DevOps',
      'Infraestructura TI',
      'Ciberseguridad',
      'Bases de datos',
      'Soporte técnico',
      'Machine learning',
      'Inteligencia artificial'
    ]
  },
  {
    name: 'Arquitectura',
    slug: 'arquitectura',
    description: 'Diseño arquitectónico y construcción',
    icon: '🏛️',
    color: '#8B5CF6',
    sortOrder: 2,
    subcategories: [
      'Diseño arquitectónico',
      'Urbanismo',
      'Interiorismo',
      'Arquitectura sustentable',
      'BIM',
      'Supervisión de obra'
    ]
  },
  {
    name: 'Diseño Gráfico',
    slug: 'diseno-grafico',
    description: 'Diseño visual, branding y comunicación gráfica',
    icon: '🎨',
    color: '#EC4899',
    sortOrder: 3,
    subcategories: [
      'Diseño UI/UX',
      'Branding',
      'Ilustración',
      'Motion graphics',
      'Diseño editorial',
      'Diseño de packaging'
    ]
  },
  {
    name: 'Producción Audiovisual',
    slug: 'produccion-audiovisual',
    description: 'Video, fotografía y producción multimedia',
    icon: '🎬',
    color: '#F59E0B',
    sortOrder: 4,
    subcategories: [
      'Fotografía',
      'Video',
      'Edición',
      'Animación',
      'Producción de contenido',
      'Streaming'
    ]
  },
  {
    name: 'Educación',
    slug: 'educacion',
    description: 'Enseñanza, pedagogía y formación',
    icon: '📚',
    color: '#10B981',
    sortOrder: 5,
    subcategories: [
      'Psicología',
      'Lingüística',
      'Pedagogía',
      'Formación académica',
      'Diseño instruccional',
      'E-learning',
      'Capacitación corporativa'
    ]
  },
  {
    name: 'Administración de Oficina',
    slug: 'administracion-oficina',
    description: 'Gestión administrativa y operaciones',
    icon: '📋',
    color: '#6366F1',
    sortOrder: 6,
    subcategories: [
      'Recursos Humanos',
      'Asistente administrativo',
      'Gestión documental',
      'Atención al cliente',
      'Reclutamiento y selección',
      'Recepción'
    ]
  },
  {
    name: 'Finanzas',
    slug: 'finanzas',
    description: 'Contabilidad, análisis financiero y tesorería',
    icon: '💰',
    color: '#059669',
    sortOrder: 7,
    subcategories: [
      'Contabilidad',
      'Análisis financiero',
      'Tesorería',
      'Auditoría',
      'Impuestos',
      'Facturación'
    ]
  },
  {
    name: 'Marketing',
    slug: 'marketing',
    description: 'Marketing digital, comunicación y publicidad',
    icon: '📢',
    color: '#EF4444',
    sortOrder: 8,
    subcategories: [
      'Marketing digital',
      'SEO/SEM',
      'Community manager',
      'Publicidad',
      'Email marketing',
      'Growth hacking'
    ]
  },
  {
    name: 'Ingeniería',
    slug: 'ingenieria',
    description: 'Ingeniería industrial, mecánica y electrónica',
    icon: '⚙️',
    color: '#78716C',
    sortOrder: 9,
    subcategories: [
      'Mecatrónica',
      'Electrónica',
      'Automatización',
      'Proyectos industriales',
      'Diseño de producto',
      'I+D',
      'Control de calidad'
    ]
  },
  {
    name: 'Salud',
    slug: 'salud',
    description: 'Salud, bienestar y ciencias de la vida',
    icon: '🏥',
    color: '#DC2626',
    sortOrder: 10,
    subcategories: [
      'Psicología clínica',
      'Nutrición',
      'Enfermería',
      'Orientación familiar',
      'Educación en salud',
      'Medicina ocupacional'
    ]
  }
];

async function seedSpecialties() {
  console.log('🌱 Seeding specialties...');

  for (const specialty of specialtiesData) {
    const existing = await prisma.specialty.findUnique({
      where: { name: specialty.name }
    });

    if (existing) {
      // Specialty la administra el admin desde /admin/specialties (subcategorías,
      // color, orden...). Sobrescribirla en cada seed revertía sus cambios en
      // silencio, y las vacantes que usaban las subcategorías nuevas dejaban de
      // validar. Solo se pisa con SEED_FORCE_RESET=1.
      if (forzarReset) {
        console.log(
          `  ♻️  Specialty "${specialty.name}" ya existe, SOBRESCRITA (SEED_FORCE_RESET=1)`
        );
        await prisma.specialty.update({
          where: { name: specialty.name },
          data: specialty
        });
      } else {
        console.log(
          `  ⏭️  Specialty "${specialty.name}" ya existe, se respeta lo que hay`
        );
      }
    } else {
      console.log(`  ✅ Creating specialty "${specialty.name}"`);
      await prisma.specialty.create({
        data: specialty
      });
    }
  }

  console.log('✅ Specialties seeded successfully!');
}

async function seedStaff() {
  // Estas son cuentas de personas reales (@inakat.com) y todas comparten la
  // misma contraseña, así que no se crean por defecto: lo normal es darlas de
  // alta desde /admin/users con contraseña individual + "olvidé mi contraseña".
  if (!sembrarStaff) {
    console.log(
      '\n⏭️  Staff real no sembrado (usa SEED_STAFF_ACCOUNTS=1 si de verdad lo necesitas).'
    );
    console.log(
      '   Recomendado: crear cada cuenta desde /admin/users con contraseña individual.\n'
    );
    return;
  }

  console.log('🌱 Creando especialistas...\n');

  const defaultPassword = await bcrypt.hash(process.env.SEED_STAFF_PASSWORD!, 10);

  // =============================================
  // ESPECIALISTAS (de la lista de Lalo)
  // =============================================
  const specialists = [
    {
      email: 'ludim@inakat.com',
      nombre: 'Ludim',
      apellidoPaterno: 'Salo',
      specialty: 'Tecnología',
      role: 'specialist'
    },
    {
      email: 'memo@inakat.com',
      nombre: 'Memo',
      apellidoPaterno: 'García',
      specialty: 'Tecnología',
      role: 'specialist'
    },
    {
      email: 'alex@inakat.com',
      nombre: 'Alex',
      apellidoPaterno: 'Rodríguez',
      specialty: 'Tecnología',
      role: 'specialist'
    },
    {
      email: 'denisse@inakat.com',
      nombre: 'Denisse',
      apellidoPaterno: 'López',
      specialty: 'Diseño Gráfico',
      role: 'specialist'
    },
    {
      email: 'andre@inakat.com',
      nombre: 'André',
      apellidoPaterno: 'Martínez',
      specialty: 'Producción Audiovisual',
      role: 'specialist'
    },
    {
      email: 'lalo@inakat.com',
      nombre: 'Lalo',
      apellidoPaterno: 'Hernández',
      // 'Project Management' no existe en el catálogo de especialidades: con ese
      // valor la asignación avisaba siempre "la especialidad no coincide".
      specialty: 'Administración de Oficina',
      role: 'specialist'
    },
    {
      email: 'mayela@inakat.com',
      nombre: 'Mayela',
      apellidoPaterno: 'Sánchez',
      specialty: 'Marketing',
      role: 'specialist'
    },
    {
      email: 'omar@inakat.com',
      nombre: 'Omar',
      apellidoPaterno: 'Pérez',
      specialty: 'Educación',
      role: 'specialist'
    }
  ];

  console.log('👨‍💻 Creando especialistas...');

  let specialistsCreated = 0;
  for (const data of specialists) {
    const existing = await prisma.user.findUnique({
      where: { email: data.email }
    });

    if (existing) {
      // NO se toca el rol de un usuario que ya existe: el seed degradaba a
      // 'specialist' a quien hubiera sido promovido a admin desde /admin/users,
      // y recuperarlo exigía entrar a la base a mano.
      console.log(
        `  ⏭️  ${data.nombre} ya existe (rol actual: ${existing.role}), no se modifica`
      );
    } else {
      await prisma.user.create({
        data: {
          email: data.email,
          password: defaultPassword,
          nombre: data.nombre,
          apellidoPaterno: data.apellidoPaterno,
          role: 'specialist',
          specialty: data.specialty,
          isActive: true,
          emailVerified: new Date()
        }
      });
      specialistsCreated++;
      console.log(`  ✅ ${data.nombre} - ${data.specialty}`);
    }
  }

  // Los reclutadores de prueba (reclutador1/reclutador2@inakat.com) ya los crea
  // la sección 2.5 con SEED_RECRUITER_PASSWORD. Aquí se volvían a escribir con
  // otros nombres y otra contraseña, y el resumen mentía sobre cuál era.

  // =============================================
  // RESUMEN
  // =============================================
  console.log('\n✨ ¡Staff creado exitosamente!\n');
  console.log('📊 RESUMEN:');
  console.log(`  • Especialistas: ${specialistsCreated} nuevos`);

  console.log('\n🔐 CREDENCIALES:');
  console.log('   Especialistas nuevos: $SEED_STAFF_PASSWORD (compartida: cámbiala en cuanto entren)');
  console.log('   Los que ya existían conservan su contraseña y su rol.\n');

  console.log('👨‍💻 ESPECIALISTAS:');
  specialists.forEach((s) => {
    console.log(`   • ${s.nombre} (${s.specialty}): ${s.email}`);
  });

  console.log('\n🚀 Para probar:');
  console.log('   Especialista: http://localhost:3000/specialist/dashboard');
  console.log('   Admin (asignar): http://localhost:3000/admin/assignments\n');
}

// =============================================
// PAQUETES DE CRÉDITOS
// =============================================
async function seedCreditPackages() {
  console.log('\n💳 Poblando paquetes de créditos...\n');

  const packages = [
    {
      name: '1 Crédito',
      credits: 1,
      price: 4000,
      pricePerCredit: 4000,
      badge: null,
      sortOrder: 1,
      isActive: true
    },
    {
      name: 'Pack 10',
      credits: 10,
      price: 35000,
      pricePerCredit: 3500,
      badge: 'MÁS POPULAR',
      sortOrder: 2,
      isActive: true
    },
    {
      name: 'Pack 15',
      credits: 15,
      price: 50000,
      pricePerCredit: 3333.33,
      badge: null,
      sortOrder: 3,
      isActive: true
    },
    {
      name: 'Pack 20',
      credits: 20,
      price: 65000,
      pricePerCredit: 3250,
      badge: 'PROMOCIÓN',
      sortOrder: 4,
      isActive: true
    }
  ];

  let created = 0;
  let updated = 0;
  let skippedPackages = 0;

  for (const pkg of packages) {
    const existing = await prisma.creditPackage.findFirst({
      where: { credits: pkg.credits }
    });

    if (existing) {
      // Los paquetes los administra el admin desde /admin/credit-packages:
      // reescribirlos en cada seed devolvía precios viejos y reactivaba
      // paquetes desactivados, y la compra cobraba el precio revertido.
      if (forzarReset) {
        await prisma.creditPackage.update({
          where: { id: existing.id },
          data: pkg
        });
        updated++;
        console.log(`  ♻️  ${pkg.name} ya existe, SOBRESCRITO (SEED_FORCE_RESET=1)`);
      } else {
        skippedPackages++;
        console.log(`  ⏭️  ${pkg.name} ya existe, se respeta el precio actual`);
      }
    } else {
      await prisma.creditPackage.create({
        data: pkg
      });
      created++;
      console.log(`  ✅ ${pkg.name} - $${pkg.price.toLocaleString()} MXN (${pkg.credits} créditos)`);
    }
  }

  console.log(`\n✨ Paquetes de créditos:`);
  console.log(`   Creados: ${created}`);
  console.log(`   Actualizados: ${updated}`);
  console.log(`   Respetados (ya existían): ${skippedPackages}\n`);
}

// =============================================
// EJECUTAR SEED
// =============================================
main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
