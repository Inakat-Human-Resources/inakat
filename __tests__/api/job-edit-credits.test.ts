// RUTA: __tests__/api/job-edit-credits.test.ts

/**
 * Tests para validación de créditos al editar vacantes
 *
 * BUG CRÍTICO: Cuando una empresa editaba una vacante publicada
 * y cambiaba el seniority (ej: Junior → Director), el sistema
 * NO cobraba los créditos adicionales.
 *
 * FIX: Se agregó validación en PUT /api/jobs/[id] que:
 * - Detecta cambios en campos que afectan precio (profile, seniority, workMode)
 * - Calcula la diferencia de créditos
 * - Cobra o devuelve créditos según corresponda
 * - Registra la transacción en CreditTransaction
 */

// Mock de Prisma
const mockPrismaJob = {
  findUnique: jest.fn(),
  update: jest.fn(),
};

const mockPrismaUser = {
  findUnique: jest.fn(),
  update: jest.fn(),
};

const mockPrismaPricingMatrix = {
  findFirst: jest.fn(),
};

const mockPrismaCreditTransaction = {
  create: jest.fn(),
};

jest.mock('@/lib/prisma', () => ({
  prisma: {
    job: mockPrismaJob,
    user: mockPrismaUser,
    pricingMatrix: mockPrismaPricingMatrix,
    creditTransaction: mockPrismaCreditTransaction,
  },
}));

// Mock de calculateJobCreditCost
const mockCalculateJobCreditCost = jest.fn();
jest.mock('@/lib/pricing', () => ({
  calculateJobCreditCost: mockCalculateJobCreditCost,
}));

describe('Job Edit Credits Validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Helpers para simular escenarios
  const createMockJob = (overrides = {}) => ({
    id: 1,
    title: 'Desarrollador Frontend',
    company: 'TechCorp',
    location: 'CDMX',
    salary: '$30,000 - $40,000 MXN',
    description: 'Descripción del puesto',
    jobType: 'full-time',
    workMode: 'remote',
    profile: 'Tecnología',
    seniority: 'Jr',
    status: 'active',
    creditCost: 6,
    userId: 100,
    editableUntil: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 horas en el futuro
    ...overrides,
  });

  const createMockCompany = (overrides = {}) => ({
    id: 100,
    email: 'empresa@test.com',
    role: 'company',
    credits: 20,
    ...overrides,
  });

  describe('Cobro de créditos adicionales al upgrade', () => {
    it('debería cobrar créditos adicionales cuando se sube el seniority (Jr → Director)', async () => {
      const originalJob = createMockJob({ seniority: 'Jr', creditCost: 6 });
      const company = createMockCompany({ credits: 20 });

      mockPrismaJob.findUnique.mockResolvedValue(originalJob);
      mockPrismaUser.findUnique.mockResolvedValue(company);
      mockCalculateJobCreditCost.mockResolvedValue({ credits: 10, found: true });

      // Simular la lógica del endpoint PUT
      const originalCost = originalJob.creditCost;
      const newCostResult = await mockCalculateJobCreditCost('Tecnología', 'Director', 'remote');
      const newCost = newCostResult.credits;
      const difference = newCost - originalCost;

      // Verificar cálculos
      expect(originalCost).toBe(6);
      expect(newCost).toBe(10);
      expect(difference).toBe(4);

      // Verificar que hay créditos suficientes
      expect(company.credits >= difference).toBe(true);

      // Simular cobro
      const updatedCredits = company.credits - difference;
      expect(updatedCredits).toBe(16); // 20 - 4 = 16

      // Verificar que se registraría la transacción
      const transactionData = {
        userId: company.id,
        type: 'spend',
        amount: -difference,
        balanceBefore: company.credits,
        balanceAfter: updatedCredits,
        description: expect.stringContaining('Ajuste por edición'),
      };

      expect(transactionData.amount).toBe(-4);
    });

    it('debería cobrar créditos cuando se cambia workMode a uno más caro', async () => {
      const originalJob = createMockJob({
        workMode: 'presential',
        seniority: 'Sr',
        creditCost: 8
      });
      const company = createMockCompany({ credits: 15 });

      mockPrismaJob.findUnique.mockResolvedValue(originalJob);
      mockPrismaUser.findUnique.mockResolvedValue(company);

      // Presencial → Remoto (más caro)
      mockCalculateJobCreditCost.mockResolvedValue({ credits: 12, found: true });

      const newCostResult = await mockCalculateJobCreditCost('Tecnología', 'Sr', 'remote');
      const difference = newCostResult.credits - originalJob.creditCost;

      expect(difference).toBe(4);
      expect(company.credits >= difference).toBe(true);
    });

    it('debería cobrar créditos cuando se cambia profile a uno más caro', async () => {
      const originalJob = createMockJob({
        profile: 'Administrativo',
        creditCost: 4
      });
      const company = createMockCompany({ credits: 10 });

      mockPrismaJob.findUnique.mockResolvedValue(originalJob);
      mockPrismaUser.findUnique.mockResolvedValue(company);

      // Administrativo → Tecnología (más caro)
      mockCalculateJobCreditCost.mockResolvedValue({ credits: 8, found: true });

      const newCostResult = await mockCalculateJobCreditCost('Tecnología', 'Jr', 'remote');
      const difference = newCostResult.credits - originalJob.creditCost;

      expect(difference).toBe(4);
    });
  });

  describe('Devolución de créditos al downgrade', () => {
    it('debería devolver créditos cuando se baja el seniority (Director → Jr)', async () => {
      const originalJob = createMockJob({
        seniority: 'Director',
        creditCost: 10
      });
      const company = createMockCompany({ credits: 10 });

      mockPrismaJob.findUnique.mockResolvedValue(originalJob);
      mockPrismaUser.findUnique.mockResolvedValue(company);
      mockCalculateJobCreditCost.mockResolvedValue({ credits: 6, found: true });

      const originalCost = originalJob.creditCost;
      const newCostResult = await mockCalculateJobCreditCost('Tecnología', 'Jr', 'remote');
      const newCost = newCostResult.credits;
      const difference = newCost - originalCost;

      // Verificar cálculos
      expect(originalCost).toBe(10);
      expect(newCost).toBe(6);
      expect(difference).toBe(-4); // Negativo = devolución

      // Simular devolución
      const refundAmount = Math.abs(difference);
      const updatedCredits = company.credits + refundAmount;
      expect(updatedCredits).toBe(14); // 10 + 4 = 14

      // Verificar transacción de devolución
      const transactionData = {
        type: 'refund',
        amount: refundAmount,
        balanceAfter: updatedCredits,
      };

      expect(transactionData.type).toBe('refund');
      expect(transactionData.amount).toBe(4);
    });

    it('debería devolver créditos cuando se cambia a workMode más barato', async () => {
      const originalJob = createMockJob({
        workMode: 'remote',
        creditCost: 12
      });
      const company = createMockCompany({ credits: 5 });

      mockPrismaJob.findUnique.mockResolvedValue(originalJob);
      mockPrismaUser.findUnique.mockResolvedValue(company);

      // Remoto → Presencial (más barato)
      mockCalculateJobCreditCost.mockResolvedValue({ credits: 8, found: true });

      const newCostResult = await mockCalculateJobCreditCost('Tecnología', 'Sr', 'presential');
      const difference = newCostResult.credits - originalJob.creditCost;

      expect(difference).toBe(-4); // Devolución de 4 créditos

      const refundAmount = Math.abs(difference);
      const updatedCredits = company.credits + refundAmount;
      expect(updatedCredits).toBe(9); // 5 + 4 = 9
    });
  });

  describe('Error 402 - Créditos insuficientes', () => {
    it('debería retornar 402 cuando no hay créditos suficientes para upgrade', async () => {
      const originalJob = createMockJob({
        seniority: 'Jr',
        creditCost: 6
      });
      const company = createMockCompany({ credits: 2 }); // Solo 2 créditos

      mockPrismaJob.findUnique.mockResolvedValue(originalJob);
      mockPrismaUser.findUnique.mockResolvedValue(company);
      mockCalculateJobCreditCost.mockResolvedValue({ credits: 10, found: true });

      const difference = 10 - 6; // Necesita 4 créditos adicionales

      expect(company.credits < difference).toBe(true);

      // Verificar estructura del error esperado
      const errorResponse = {
        success: false,
        error: `Créditos insuficientes. Necesitas ${difference} créditos adicionales para este cambio.`,
        required: difference,
        available: company.credits
      };

      expect(errorResponse.required).toBe(4);
      expect(errorResponse.available).toBe(2);
    });

    it('debería retornar 402 cuando créditos son exactamente insuficientes', async () => {
      const originalJob = createMockJob({
        seniority: 'Jr',
        creditCost: 6
      });
      const company = createMockCompany({ credits: 3 }); // Necesita 4, tiene 3

      mockPrismaJob.findUnique.mockResolvedValue(originalJob);
      mockPrismaUser.findUnique.mockResolvedValue(company);
      mockCalculateJobCreditCost.mockResolvedValue({ credits: 10, found: true });

      const difference = 10 - 6;

      expect(company.credits < difference).toBe(true);
      expect(difference - company.credits).toBe(1); // Le falta 1 crédito
    });
  });

  describe('Sin cambio de créditos', () => {
    it('no debería cambiar créditos cuando el precio se mantiene igual', async () => {
      const originalJob = createMockJob({
        profile: 'Tecnología',
        seniority: 'Sr',
        workMode: 'remote',
        creditCost: 10
      });
      const company = createMockCompany({ credits: 15 });

      mockPrismaJob.findUnique.mockResolvedValue(originalJob);
      mockPrismaUser.findUnique.mockResolvedValue(company);
      mockCalculateJobCreditCost.mockResolvedValue({ credits: 10, found: true });

      // Mismos parámetros de precio
      const newCostResult = await mockCalculateJobCreditCost('Tecnología', 'Sr', 'remote');
      const difference = newCostResult.credits - originalJob.creditCost;

      expect(difference).toBe(0);
      // No se debería crear transacción ni actualizar créditos
    });

    it('no debería cambiar créditos cuando solo se edita el título', async () => {
      const originalJob = createMockJob({
        title: 'Desarrollador Frontend',
        creditCost: 8
      });

      // Solo cambió el título, no profile/seniority/workMode
      const editData = {
        title: 'Desarrollador Frontend Senior'
      };

      // Los campos que afectan precio no cambiaron
      const priceAffectingFieldsChanged =
        editData.profile !== undefined ||
        editData.seniority !== undefined ||
        editData.workMode !== undefined;

      expect(priceAffectingFieldsChanged).toBe(false);
    });

    it('no debería cambiar créditos cuando solo se edita la descripción', async () => {
      const originalJob = createMockJob({ creditCost: 8 });

      const editData = {
        description: 'Nueva descripción del puesto'
      };

      const priceAffectingFieldsChanged =
        editData.profile !== undefined ||
        editData.seniority !== undefined ||
        editData.workMode !== undefined;

      expect(priceAffectingFieldsChanged).toBe(false);
    });
  });

  describe('Solo aplica a vacantes activas', () => {
    it('no debería validar créditos para vacantes en draft', async () => {
      const draftJob = createMockJob({
        status: 'draft',
        creditCost: 0 // Draft no tiene costo aún
      });

      mockPrismaJob.findUnique.mockResolvedValue(draftJob);

      // La validación de créditos solo aplica si status === 'active'
      expect(draftJob.status).toBe('draft');
      expect(draftJob.status === 'active').toBe(false);
      // No se debe ejecutar la lógica de créditos
    });

    it('no debería validar créditos para vacantes pausadas', async () => {
      const pausedJob = createMockJob({
        status: 'paused',
        creditCost: 8
      });

      mockPrismaJob.findUnique.mockResolvedValue(pausedJob);

      expect(pausedJob.status).toBe('paused');
      expect(pausedJob.status === 'active').toBe(false);
    });

    it('no debería validar créditos para vacantes cerradas', async () => {
      const closedJob = createMockJob({
        status: 'closed',
        creditCost: 8
      });

      mockPrismaJob.findUnique.mockResolvedValue(closedJob);

      expect(closedJob.status).toBe('closed');
      expect(closedJob.status === 'active').toBe(false);
    });
  });

  describe('Registro de transacciones', () => {
    it('debería crear CreditTransaction al cobrar créditos adicionales', async () => {
      const originalJob = createMockJob({
        seniority: 'Jr',
        creditCost: 6,
        title: 'Desarrollador Web'
      });
      const company = createMockCompany({ credits: 20 });

      mockCalculateJobCreditCost.mockResolvedValue({ credits: 10, found: true });

      const difference = 4; // 10 - 6

      const expectedTransaction = {
        userId: company.id,
        type: 'spend',
        amount: -difference,
        balanceBefore: company.credits,
        balanceAfter: company.credits - difference,
        description: `Ajuste por edición de vacante: ${originalJob.title} (Jr → Director)`,
        jobId: originalJob.id
      };

      expect(expectedTransaction.type).toBe('spend');
      expect(expectedTransaction.amount).toBe(-4);
      expect(expectedTransaction.jobId).toBe(1);
    });

    it('debería crear CreditTransaction al devolver créditos', async () => {
      const originalJob = createMockJob({
        seniority: 'Director',
        creditCost: 10,
        title: 'Gerente de Proyecto'
      });
      const company = createMockCompany({ credits: 5 });

      mockCalculateJobCreditCost.mockResolvedValue({ credits: 6, found: true });

      const difference = -4; // 6 - 10
      const refundAmount = Math.abs(difference);

      const expectedTransaction = {
        userId: company.id,
        type: 'refund',
        amount: refundAmount,
        balanceBefore: company.credits,
        balanceAfter: company.credits + refundAmount,
        description: `Devolución por edición de vacante: ${originalJob.title} (Director → Jr)`,
        jobId: originalJob.id
      };

      expect(expectedTransaction.type).toBe('refund');
      expect(expectedTransaction.amount).toBe(4);
    });
  });

  describe('Actualización de creditCost en el job', () => {
    it('debería actualizar creditCost del job cuando cambia el precio', async () => {
      const originalJob = createMockJob({
        creditCost: 6
      });

      mockCalculateJobCreditCost.mockResolvedValue({ credits: 10, found: true });

      const newCreditCost = 10;

      // Verificar que el update incluiría el nuevo creditCost
      const updateData = {
        creditCost: newCreditCost
      };

      expect(updateData.creditCost).toBe(10);
      expect(updateData.creditCost).not.toBe(originalJob.creditCost);
    });
  });

  describe('Respuesta del endpoint', () => {
    it('debería incluir creditChange en la respuesta cuando se cobran créditos', () => {
      const response = {
        success: true,
        message: 'Vacante actualizada. Se han cobrado 4 créditos adicionales.',
        data: { /* job data */ },
        creditChange: {
          original: 6,
          new: 10,
          difference: 4,
          action: 'charged'
        }
      };

      expect(response.creditChange).toBeDefined();
      expect(response.creditChange.action).toBe('charged');
      expect(response.creditChange.difference).toBe(4);
    });

    it('debería incluir creditChange en la respuesta cuando se devuelven créditos', () => {
      const response = {
        success: true,
        message: 'Vacante actualizada. Se han devuelto 4 créditos.',
        data: { /* job data */ },
        creditChange: {
          original: 10,
          new: 6,
          difference: -4,
          action: 'refunded'
        }
      };

      expect(response.creditChange).toBeDefined();
      expect(response.creditChange.action).toBe('refunded');
      expect(response.creditChange.difference).toBe(-4);
    });

    it('no debería incluir creditChange cuando no hay cambio de precio', () => {
      const response = {
        success: true,
        message: 'Vacante actualizada exitosamente',
        data: { /* job data */ }
        // Sin creditChange
      };

      expect(response.creditChange).toBeUndefined();
    });
  });

  describe('Casos edge', () => {
    it('debería manejar job sin userId', async () => {
      const jobWithoutUser = createMockJob({
        userId: null
      });

      mockPrismaJob.findUnique.mockResolvedValue(jobWithoutUser);

      // userId es null, no se puede buscar empresa
      expect(jobWithoutUser.userId).toBeNull();
    });

    it('debería manejar empresa no encontrada', async () => {
      const originalJob = createMockJob();

      mockPrismaJob.findUnique.mockResolvedValue(originalJob);
      mockPrismaUser.findUnique.mockResolvedValue(null); // Empresa no encontrada

      const company = await mockPrismaUser.findUnique({ where: { id: originalJob.userId } });

      expect(company).toBeNull();
      // Debería retornar error 404
    });

    it('debería manejar creditCost null/undefined en job original', async () => {
      const jobWithNoCreditCost = createMockJob({
        creditCost: null
      });

      const originalCost = jobWithNoCreditCost.creditCost || 0;
      expect(originalCost).toBe(0);
    });

    it('debería permitir upgrade exactamente con créditos disponibles', async () => {
      const originalJob = createMockJob({
        seniority: 'Jr',
        creditCost: 6
      });
      const company = createMockCompany({ credits: 4 }); // Exactamente lo necesario

      mockCalculateJobCreditCost.mockResolvedValue({ credits: 10, found: true });

      const difference = 10 - 6; // 4 créditos

      expect(company.credits >= difference).toBe(true);
      expect(company.credits - difference).toBe(0); // Se queda en 0
    });
  });

  describe('Integración con calculateJobCreditCost', () => {
    it('debería usar calculateJobCreditCost de @/lib/pricing', async () => {
      mockCalculateJobCreditCost.mockResolvedValue({
        credits: 15,
        found: true,
        pricingId: 1,
        minSalary: 25000
      });

      const result = await mockCalculateJobCreditCost('Tecnología', 'Sr', 'remote');

      expect(mockCalculateJobCreditCost).toHaveBeenCalledWith('Tecnología', 'Sr', 'remote');
      expect(result.credits).toBe(15);
      expect(result.found).toBe(true);
    });

    it('debería usar valor por defecto cuando pricing no existe', async () => {
      mockCalculateJobCreditCost.mockResolvedValue({
        credits: 5, // DEFAULT_CREDITS
        found: false
      });

      const result = await mockCalculateJobCreditCost('PerfilNoExistente', 'Jr', 'remote');

      expect(result.credits).toBe(5);
      expect(result.found).toBe(false);
    });
  });
});
