-- ============================================================================
-- BASELINE DEL DRIFT + INDICES NUEVOS  (hallazgos DB-001, DB-003, DB-008,
-- DB-009, DB-016, DB-020, DB-022 de docs/auditoria-2026-09/db.md)
--
-- Las 7 migraciones anteriores solo crean 7 de las 22 tablas del schema: el
-- resto se aplico en las bases existentes con 'prisma db push', asi que un
-- entorno nuevo creado con 'prisma migrate deploy' quedaba sin 15 tablas y sin
-- 24 columnas. Esta migracion cierra esa brecha.
--
-- ES ADITIVA E IDEMPOTENTE A PROPOSITO: no borra ni modifica datos y todo va
-- con IF NOT EXISTS / guardas sobre pg_constraint, de modo que aplicarla sobre
-- una base que ya recibio 'db push' (produccion) no hace nada, y sobre una base
-- nueva deja el esquema completo.
--
-- Los indices unicos NUEVOS (Application, PricingMatrix, DiscountCode,
-- IntegrationWebhook) solo se crean si los datos actuales no tienen duplicados:
-- si los hay, la migracion NO falla, emite un WARNING con el conteo y deja el
-- indice sin crear. Deduplicar es una decision de negocio (implica borrar
-- filas) y queda fuera de una migracion automatica.
--
-- NO anade columnas que el schema no tenga: el build corre 'prisma generate'
-- pero no aplica migraciones, asi que una columna nueva en el schema haria que
-- el cliente la pida en cada SELECT y reventara con P2022 en una base que aun
-- no la tiene.
--
-- OJO con 'prisma db push': los indices unicos PARCIALES de la seccion 5 no se
-- pueden declarar en schema.prisma, y db push trata como sobrantes (y puede
-- borrar) los indices que el schema no declara. Mientras produccion se
-- sincronice con db push, hay que comprobar tras cada push que siguen ahi y,
-- si no, recrearlos con 'prisma db execute --file' (esta migracion es
-- idempotente, se puede reejecutar entera).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Columnas que faltan en las tablas que si crearon las migraciones previas
-- ---------------------------------------------------------------------------
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "credits" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "resetToken" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "resetTokenExpiry" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "specialty" TEXT;
ALTER TABLE "CompanyRequest" ADD COLUMN IF NOT EXISTS "latitud" DOUBLE PRECISION;
ALTER TABLE "CompanyRequest" ADD COLUMN IF NOT EXISTS "longitud" DOUBLE PRECISION;
ALTER TABLE "CompanyRequest" ADD COLUMN IF NOT EXISTS "logoUrl" TEXT;
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION;
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION;
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "salaryMin" INTEGER;
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "salaryMax" INTEGER;
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "closedReason" TEXT;
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "creditCost" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "profile" TEXT;
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "subcategory" TEXT;
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "seniority" TEXT;
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "educationLevel" TEXT;
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "habilidades" TEXT;
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "responsabilidades" TEXT;
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "resultadosEsperados" TEXT;
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "valoresActitudes" TEXT;
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "informacionAdicional" TEXT;
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "notasInternas" TEXT;
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "isConfidential" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "editableUntil" TIMESTAMP(3);

-- companyRating no debe nacer en 5.0: no hay sistema de resenas que lo respalde (DB-003)
ALTER TABLE "Job" ALTER COLUMN "companyRating" DROP DEFAULT;

-- ---------------------------------------------------------------------------
-- 2. Tablas que nunca se crearon por migracion
-- ---------------------------------------------------------------------------
-- CreateTable
CREATE TABLE IF NOT EXISTS "Notification" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link" TEXT,
    "metadata" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PricingMatrix" (
    "id" SERIAL NOT NULL,
    "profile" TEXT NOT NULL,
    "seniority" TEXT NOT NULL,
    "workMode" TEXT NOT NULL,
    "location" TEXT,
    "credits" INTEGER NOT NULL,
    "minSalary" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PricingMatrix_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CreditPackage" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "credits" INTEGER NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "pricePerCredit" DOUBLE PRECISION NOT NULL,
    "badge" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CreditPurchase" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "pricePerCredit" DOUBLE PRECISION NOT NULL,
    "totalPrice" DOUBLE PRECISION NOT NULL,
    "packageType" TEXT,
    "paymentStatus" TEXT NOT NULL DEFAULT 'pending',
    "paymentId" TEXT,
    "paymentMethod" TEXT,
    "receiptUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "CreditPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CreditTransaction" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "balanceBefore" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "jobId" INTEGER,
    "purchaseId" INTEGER,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Candidate" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellidoPaterno" TEXT NOT NULL,
    "apellidoMaterno" TEXT,
    "email" TEXT NOT NULL,
    "telefono" TEXT,
    "sexo" TEXT,
    "fechaNacimiento" TIMESTAMP(3),
    "ciudad" TEXT,
    "estado" TEXT,
    "ubicacionCercana" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "universidad" TEXT,
    "carrera" TEXT,
    "nivelEstudios" TEXT,
    "educacion" TEXT,
    "añosExperiencia" INTEGER NOT NULL DEFAULT 0,
    "profile" TEXT,
    "subcategory" TEXT,
    "seniority" TEXT,
    "cvUrl" TEXT,
    "portafolioUrl" TEXT,
    "linkedinUrl" TEXT,
    "fotoUrl" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "notas" TEXT,
    "cartaPresentacion" TEXT,
    "status" TEXT NOT NULL DEFAULT 'available',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" INTEGER,

    CONSTRAINT "Candidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Experience" (
    "id" SERIAL NOT NULL,
    "candidateId" INTEGER NOT NULL,
    "empresa" TEXT NOT NULL,
    "puesto" TEXT NOT NULL,
    "ubicacion" TEXT,
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaFin" TIMESTAMP(3),
    "esActual" BOOLEAN NOT NULL DEFAULT false,
    "descripcion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Experience_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CandidateDocument" (
    "id" SERIAL NOT NULL,
    "candidateId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CandidateDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Specialty" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "color" TEXT DEFAULT '#2b5d62',
    "subcategories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Specialty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "JobAssignment" (
    "id" SERIAL NOT NULL,
    "jobId" INTEGER NOT NULL,
    "recruiterId" INTEGER,
    "specialistId" INTEGER,
    "recruiterStatus" TEXT NOT NULL DEFAULT 'pending',
    "specialistStatus" TEXT NOT NULL DEFAULT 'pending',
    "recruiterNotes" TEXT,
    "specialistNotes" TEXT,
    "candidatesSentToSpecialist" TEXT,
    "candidatesSentToCompany" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "followUpDate" TIMESTAMP(3),
    "followUpCompleted" BOOLEAN NOT NULL DEFAULT false,
    "followUpNotes" TEXT,

    CONSTRAINT "JobAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "EvaluationNote" (
    "id" SERIAL NOT NULL,
    "authorId" INTEGER NOT NULL,
    "authorRole" TEXT NOT NULL,
    "applicationId" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "documentUrl" TEXT,
    "documentName" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvaluationNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "DiscountCode" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "discountPercent" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "commissionPercent" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscountCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "DiscountCodeUse" (
    "id" SERIAL NOT NULL,
    "codeId" INTEGER NOT NULL,
    "purchaseId" INTEGER NOT NULL,
    "companyUserId" INTEGER NOT NULL,
    "originalPrice" DOUBLE PRECISION NOT NULL,
    "discountAmount" DOUBLE PRECISION NOT NULL,
    "finalPrice" DOUBLE PRECISION NOT NULL,
    "commissionAmount" DOUBLE PRECISION NOT NULL,
    "commissionStatus" TEXT NOT NULL DEFAULT 'pending',
    "commissionPaidAt" TIMESTAMP(3),
    "paymentProofUrl" TEXT,
    "paymentDueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscountCodeUse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "InterviewRequest" (
    "id" SERIAL NOT NULL,
    "applicationId" INTEGER NOT NULL,
    "requestedById" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "duration" INTEGER NOT NULL DEFAULT 45,
    "participants" TEXT,
    "availableSlots" TEXT NOT NULL,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "confirmedSlot" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "confirmedById" INTEGER,
    "topic" TEXT,
    "scheduledStart" TIMESTAMP(3),
    "scheduledEnd" TIMESTAMP(3),
    "location" TEXT,
    "meetingUrl" TEXT,
    "adminNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterviewRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SkillRating" (
    "id" SERIAL NOT NULL,
    "applicationId" INTEGER NOT NULL,
    "ratedById" INTEGER NOT NULL,
    "skillName" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SkillRating_pkey" PRIMARY KEY ("id")
);

-- ---------------------------------------------------------------------------
-- 3. Indices (todos idempotentes; los ya creados se saltan solos)
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");

CREATE UNIQUE INDEX IF NOT EXISTS "User_resetToken_key" ON "User"("resetToken");

CREATE INDEX IF NOT EXISTS "User_email_idx" ON "User"("email");

CREATE INDEX IF NOT EXISTS "User_role_idx" ON "User"("role");

CREATE INDEX IF NOT EXISTS "User_isActive_idx" ON "User"("isActive");

CREATE INDEX IF NOT EXISTS "Notification_userId_read_idx" ON "Notification"("userId", "read");

CREATE INDEX IF NOT EXISTS "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

CREATE INDEX IF NOT EXISTS "Notification_createdAt_idx" ON "Notification"("createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "CompanyRequest_userId_key" ON "CompanyRequest"("userId");

CREATE INDEX IF NOT EXISTS "CompanyRequest_status_idx" ON "CompanyRequest"("status");

CREATE INDEX IF NOT EXISTS "CompanyRequest_createdAt_idx" ON "CompanyRequest"("createdAt");

CREATE INDEX IF NOT EXISTS "CompanyRequest_rfc_idx" ON "CompanyRequest"("rfc");

CREATE INDEX IF NOT EXISTS "CompanyRequest_correoEmpresa_idx" ON "CompanyRequest"("correoEmpresa");

CREATE INDEX IF NOT EXISTS "ContactMessage_createdAt_idx" ON "ContactMessage"("createdAt");

CREATE INDEX IF NOT EXISTS "ContactMessage_email_idx" ON "ContactMessage"("email");

CREATE INDEX IF NOT EXISTS "Job_status_idx" ON "Job"("status");

CREATE INDEX IF NOT EXISTS "Job_userId_idx" ON "Job"("userId");

CREATE INDEX IF NOT EXISTS "Job_createdAt_idx" ON "Job"("createdAt");

CREATE INDEX IF NOT EXISTS "Job_location_idx" ON "Job"("location");

CREATE INDEX IF NOT EXISTS "Job_jobType_idx" ON "Job"("jobType");

CREATE INDEX IF NOT EXISTS "Job_workMode_idx" ON "Job"("workMode");

CREATE INDEX IF NOT EXISTS "Job_profile_idx" ON "Job"("profile");

CREATE INDEX IF NOT EXISTS "Job_seniority_idx" ON "Job"("seniority");

CREATE INDEX IF NOT EXISTS "Application_jobId_idx" ON "Application"("jobId");

CREATE INDEX IF NOT EXISTS "Application_userId_idx" ON "Application"("userId");

CREATE INDEX IF NOT EXISTS "Application_status_idx" ON "Application"("status");

CREATE INDEX IF NOT EXISTS "Application_candidateEmail_idx" ON "Application"("candidateEmail");

CREATE INDEX IF NOT EXISTS "Application_createdAt_idx" ON "Application"("createdAt");

CREATE INDEX IF NOT EXISTS "Application_jobId_status_idx" ON "Application"("jobId", "status");

-- Application_jobId_candidateEmail_key: solo si no hay postulaciones duplicadas (mismo jobId + candidateEmail)
DO $$
DECLARE dups INTEGER;
BEGIN
  SELECT COUNT(*) INTO dups FROM (SELECT 1 FROM (SELECT "jobId", "candidateEmail" FROM "Application" GROUP BY 1, 2 HAVING COUNT(*) > 1) d) x;
  IF dups = 0 THEN
    CREATE UNIQUE INDEX IF NOT EXISTS "Application_jobId_candidateEmail_key" ON "Application"("jobId", "candidateEmail");
  ELSE
    RAISE WARNING 'Application_jobId_candidateEmail_key no creado: hay % postulaciones duplicadas (mismo jobId + candidateEmail). Deduplica y crea el indice a mano.', dups;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "PricingMatrix_profile_idx" ON "PricingMatrix"("profile");

CREATE INDEX IF NOT EXISTS "PricingMatrix_seniority_idx" ON "PricingMatrix"("seniority");

CREATE INDEX IF NOT EXISTS "PricingMatrix_workMode_idx" ON "PricingMatrix"("workMode");

CREATE INDEX IF NOT EXISTS "PricingMatrix_location_idx" ON "PricingMatrix"("location");

CREATE INDEX IF NOT EXISTS "PricingMatrix_isActive_idx" ON "PricingMatrix"("isActive");

CREATE UNIQUE INDEX IF NOT EXISTS "PricingMatrix_profile_seniority_workMode_location_key" ON "PricingMatrix"("profile", "seniority", "workMode", "location");

CREATE INDEX IF NOT EXISTS "CreditPackage_isActive_idx" ON "CreditPackage"("isActive");

CREATE INDEX IF NOT EXISTS "CreditPackage_sortOrder_idx" ON "CreditPackage"("sortOrder");

CREATE UNIQUE INDEX IF NOT EXISTS "CreditPurchase_paymentId_key" ON "CreditPurchase"("paymentId");

CREATE INDEX IF NOT EXISTS "CreditPurchase_userId_idx" ON "CreditPurchase"("userId");

CREATE INDEX IF NOT EXISTS "CreditPurchase_paymentStatus_idx" ON "CreditPurchase"("paymentStatus");

CREATE INDEX IF NOT EXISTS "CreditPurchase_createdAt_idx" ON "CreditPurchase"("createdAt");

CREATE INDEX IF NOT EXISTS "CreditPurchase_paymentId_idx" ON "CreditPurchase"("paymentId");

CREATE INDEX IF NOT EXISTS "CreditTransaction_userId_idx" ON "CreditTransaction"("userId");

CREATE INDEX IF NOT EXISTS "CreditTransaction_type_idx" ON "CreditTransaction"("type");

CREATE INDEX IF NOT EXISTS "CreditTransaction_createdAt_idx" ON "CreditTransaction"("createdAt");

CREATE INDEX IF NOT EXISTS "CreditTransaction_jobId_idx" ON "CreditTransaction"("jobId");

CREATE INDEX IF NOT EXISTS "CreditTransaction_purchaseId_idx" ON "CreditTransaction"("purchaseId");

CREATE INDEX IF NOT EXISTS "CreditTransaction_userId_createdAt_idx" ON "CreditTransaction"("userId", "createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "Candidate_email_key" ON "Candidate"("email");

CREATE UNIQUE INDEX IF NOT EXISTS "Candidate_userId_key" ON "Candidate"("userId");

CREATE INDEX IF NOT EXISTS "Candidate_email_idx" ON "Candidate"("email");

CREATE INDEX IF NOT EXISTS "Candidate_userId_idx" ON "Candidate"("userId");

CREATE INDEX IF NOT EXISTS "Candidate_sexo_idx" ON "Candidate"("sexo");

CREATE INDEX IF NOT EXISTS "Candidate_universidad_idx" ON "Candidate"("universidad");

CREATE INDEX IF NOT EXISTS "Candidate_profile_idx" ON "Candidate"("profile");

CREATE INDEX IF NOT EXISTS "Candidate_seniority_idx" ON "Candidate"("seniority");

CREATE INDEX IF NOT EXISTS "Candidate_status_idx" ON "Candidate"("status");

CREATE INDEX IF NOT EXISTS "Candidate_source_idx" ON "Candidate"("source");

CREATE INDEX IF NOT EXISTS "Candidate_añosExperiencia_idx" ON "Candidate"("añosExperiencia");

CREATE INDEX IF NOT EXISTS "Candidate_createdAt_idx" ON "Candidate"("createdAt");

CREATE INDEX IF NOT EXISTS "Experience_candidateId_idx" ON "Experience"("candidateId");

CREATE INDEX IF NOT EXISTS "Experience_empresa_idx" ON "Experience"("empresa");

CREATE INDEX IF NOT EXISTS "Experience_fechaInicio_idx" ON "Experience"("fechaInicio");

CREATE INDEX IF NOT EXISTS "CandidateDocument_candidateId_idx" ON "CandidateDocument"("candidateId");

CREATE UNIQUE INDEX IF NOT EXISTS "Specialty_name_key" ON "Specialty"("name");

CREATE UNIQUE INDEX IF NOT EXISTS "Specialty_slug_key" ON "Specialty"("slug");

CREATE INDEX IF NOT EXISTS "Specialty_isActive_idx" ON "Specialty"("isActive");

CREATE INDEX IF NOT EXISTS "Specialty_sortOrder_idx" ON "Specialty"("sortOrder");

CREATE INDEX IF NOT EXISTS "Specialty_slug_idx" ON "Specialty"("slug");

CREATE INDEX IF NOT EXISTS "JobAssignment_recruiterId_idx" ON "JobAssignment"("recruiterId");

CREATE INDEX IF NOT EXISTS "JobAssignment_specialistId_idx" ON "JobAssignment"("specialistId");

CREATE INDEX IF NOT EXISTS "JobAssignment_recruiterStatus_idx" ON "JobAssignment"("recruiterStatus");

CREATE INDEX IF NOT EXISTS "JobAssignment_specialistStatus_idx" ON "JobAssignment"("specialistStatus");

CREATE UNIQUE INDEX IF NOT EXISTS "JobAssignment_jobId_key" ON "JobAssignment"("jobId");

CREATE INDEX IF NOT EXISTS "EvaluationNote_applicationId_idx" ON "EvaluationNote"("applicationId");

CREATE INDEX IF NOT EXISTS "EvaluationNote_authorId_idx" ON "EvaluationNote"("authorId");

CREATE INDEX IF NOT EXISTS "EvaluationNote_createdAt_idx" ON "EvaluationNote"("createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "DiscountCode_code_key" ON "DiscountCode"("code");

CREATE INDEX IF NOT EXISTS "DiscountCode_userId_idx" ON "DiscountCode"("userId");

CREATE INDEX IF NOT EXISTS "DiscountCode_code_idx" ON "DiscountCode"("code");

CREATE INDEX IF NOT EXISTS "DiscountCode_isActive_idx" ON "DiscountCode"("isActive");

CREATE UNIQUE INDEX IF NOT EXISTS "DiscountCodeUse_purchaseId_key" ON "DiscountCodeUse"("purchaseId");

CREATE INDEX IF NOT EXISTS "DiscountCodeUse_codeId_idx" ON "DiscountCodeUse"("codeId");

CREATE INDEX IF NOT EXISTS "DiscountCodeUse_companyUserId_idx" ON "DiscountCodeUse"("companyUserId");

CREATE INDEX IF NOT EXISTS "DiscountCodeUse_commissionStatus_idx" ON "DiscountCodeUse"("commissionStatus");

CREATE INDEX IF NOT EXISTS "DiscountCodeUse_createdAt_idx" ON "DiscountCodeUse"("createdAt");

CREATE INDEX IF NOT EXISTS "InterviewRequest_applicationId_idx" ON "InterviewRequest"("applicationId");

CREATE INDEX IF NOT EXISTS "InterviewRequest_requestedById_idx" ON "InterviewRequest"("requestedById");

CREATE INDEX IF NOT EXISTS "InterviewRequest_status_idx" ON "InterviewRequest"("status");

CREATE INDEX IF NOT EXISTS "InterviewRequest_scheduledStart_idx" ON "InterviewRequest"("scheduledStart");

CREATE INDEX IF NOT EXISTS "SkillRating_applicationId_idx" ON "SkillRating"("applicationId");

CREATE INDEX IF NOT EXISTS "SkillRating_ratedById_idx" ON "SkillRating"("ratedById");

CREATE UNIQUE INDEX IF NOT EXISTS "SkillRating_applicationId_skillName_key" ON "SkillRating"("applicationId", "skillName");

CREATE UNIQUE INDEX IF NOT EXISTS "IntegrationApiKey_keyHash_key" ON "IntegrationApiKey"("keyHash");

CREATE INDEX IF NOT EXISTS "IntegrationApiKey_userId_idx" ON "IntegrationApiKey"("userId");

CREATE INDEX IF NOT EXISTS "IntegrationApiKey_isActive_idx" ON "IntegrationApiKey"("isActive");

CREATE INDEX IF NOT EXISTS "IntegrationWebhook_userId_idx" ON "IntegrationWebhook"("userId");

CREATE INDEX IF NOT EXISTS "IntegrationWebhook_isActive_idx" ON "IntegrationWebhook"("isActive");

-- ---------------------------------------------------------------------------
-- 4. Llaves foraneas (se saltan si la restriccion ya existe)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Notification_userId_fkey') THEN
    ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CompanyRequest_userId_fkey') THEN
    ALTER TABLE "CompanyRequest" ADD CONSTRAINT "CompanyRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Job_userId_fkey') THEN
    ALTER TABLE "Job" ADD CONSTRAINT "Job_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Application_jobId_fkey') THEN
    ALTER TABLE "Application" ADD CONSTRAINT "Application_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Application_userId_fkey') THEN
    ALTER TABLE "Application" ADD CONSTRAINT "Application_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CreditPurchase_userId_fkey') THEN
    ALTER TABLE "CreditPurchase" ADD CONSTRAINT "CreditPurchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Candidate_userId_fkey') THEN
    ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Experience_candidateId_fkey') THEN
    ALTER TABLE "Experience" ADD CONSTRAINT "Experience_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CandidateDocument_candidateId_fkey') THEN
    ALTER TABLE "CandidateDocument" ADD CONSTRAINT "CandidateDocument_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'JobAssignment_jobId_fkey') THEN
    ALTER TABLE "JobAssignment" ADD CONSTRAINT "JobAssignment_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'JobAssignment_recruiterId_fkey') THEN
    ALTER TABLE "JobAssignment" ADD CONSTRAINT "JobAssignment_recruiterId_fkey" FOREIGN KEY ("recruiterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'JobAssignment_specialistId_fkey') THEN
    ALTER TABLE "JobAssignment" ADD CONSTRAINT "JobAssignment_specialistId_fkey" FOREIGN KEY ("specialistId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EvaluationNote_authorId_fkey') THEN
    ALTER TABLE "EvaluationNote" ADD CONSTRAINT "EvaluationNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EvaluationNote_applicationId_fkey') THEN
    ALTER TABLE "EvaluationNote" ADD CONSTRAINT "EvaluationNote_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DiscountCode_userId_fkey') THEN
    ALTER TABLE "DiscountCode" ADD CONSTRAINT "DiscountCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DiscountCodeUse_codeId_fkey') THEN
    ALTER TABLE "DiscountCodeUse" ADD CONSTRAINT "DiscountCodeUse_codeId_fkey" FOREIGN KEY ("codeId") REFERENCES "DiscountCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DiscountCodeUse_purchaseId_fkey') THEN
    ALTER TABLE "DiscountCodeUse" ADD CONSTRAINT "DiscountCodeUse_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "CreditPurchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InterviewRequest_applicationId_fkey') THEN
    ALTER TABLE "InterviewRequest" ADD CONSTRAINT "InterviewRequest_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InterviewRequest_requestedById_fkey') THEN
    ALTER TABLE "InterviewRequest" ADD CONSTRAINT "InterviewRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SkillRating_applicationId_fkey') THEN
    ALTER TABLE "SkillRating" ADD CONSTRAINT "SkillRating_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SkillRating_ratedById_fkey') THEN
    ALTER TABLE "SkillRating" ADD CONSTRAINT "SkillRating_ratedById_fkey" FOREIGN KEY ("ratedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'IntegrationApiKey_userId_fkey') THEN
    ALTER TABLE "IntegrationApiKey" ADD CONSTRAINT "IntegrationApiKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'IntegrationWebhook_userId_fkey') THEN
    ALTER TABLE "IntegrationWebhook" ADD CONSTRAINT "IntegrationWebhook_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 5. Unicidades nuevas que Prisma no sabe declarar (indices parciales)
-- ---------------------------------------------------------------------------
-- DB-009: con location NULL el @@unique de Prisma no impide duplicados,
-- porque en Postgres NULL <> NULL dentro de un indice unico.
DO $$
DECLARE dups INTEGER;
BEGIN
  SELECT COUNT(*) INTO dups FROM (
    SELECT 1 FROM "PricingMatrix" WHERE "location" IS NULL
    GROUP BY "profile", "seniority", "workMode" HAVING COUNT(*) > 1
  ) x;
  IF dups = 0 THEN
    CREATE UNIQUE INDEX IF NOT EXISTS "PricingMatrix_profile_seniority_workMode_null_location_key" ON "PricingMatrix" ("profile", "seniority", "workMode") WHERE "location" IS NULL;
  ELSE
    RAISE WARNING 'PricingMatrix_profile_seniority_workMode_null_location_key no creado: hay % combinaciones duplicadas con location NULL.', dups;
  END IF;
END $$;

-- DB-022: vendor/my-code y vendor/my-sales asumen un solo codigo por vendor.
DO $$
DECLARE dups INTEGER;
BEGIN
  SELECT COUNT(*) INTO dups FROM (
    SELECT 1 FROM "DiscountCode" GROUP BY "userId" HAVING COUNT(*) > 1
  ) x;
  IF dups = 0 THEN
    CREATE UNIQUE INDEX IF NOT EXISTS "DiscountCode_userId_key" ON "DiscountCode" ("userId");
  ELSE
    RAISE WARNING 'DiscountCode_userId_key no creado: hay % vendors con mas de un codigo.', dups;
  END IF;
END $$;

-- DB-022: un doble alta de la misma URL duplicaria cada candidate.accepted.
DO $$
DECLARE dups INTEGER;
BEGIN
  SELECT COUNT(*) INTO dups FROM (
    SELECT 1 FROM "IntegrationWebhook" WHERE "isActive"
    GROUP BY "userId", "url" HAVING COUNT(*) > 1
  ) x;
  IF dups = 0 THEN
    CREATE UNIQUE INDEX IF NOT EXISTS "IntegrationWebhook_userId_url_active_key" ON "IntegrationWebhook" ("userId", "url") WHERE "isActive";
  ELSE
    RAISE WARNING 'IntegrationWebhook_userId_url_active_key no creado: hay % webhooks activos duplicados.', dups;
  END IF;
END $$;
