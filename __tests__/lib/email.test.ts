// RUTA: __tests__/lib/email.test.ts

/**
 * Tests para el módulo de email.
 * Verifica que:
 * - sendEmail retorna false cuando SMTP no está configurado
 * - Funciones de notificación generan HTML correcto y llaman sendEmail
 * - Graceful degradation: nunca lanza excepciones
 */

// Mock nodemailer ANTES de importar
const mockSendMail = jest.fn();
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: mockSendMail,
  })),
}));

// Guardar env originales
const originalEnv = { ...process.env };

describe('Email module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset module registry para re-evaluar env vars
    jest.resetModules();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('sendEmail sin SMTP configurado', () => {
    it('debe retornar false y no lanzar error', async () => {
      // Sin SMTP_USER ni SMTP_PASS
      delete process.env.SMTP_USER;
      delete process.env.SMTP_PASS;

      // Re-importar módulo con env limpio
      jest.resetModules();
      // Re-mock nodemailer para el nuevo contexto
      jest.mock('nodemailer', () => ({
        createTransport: jest.fn(() => ({
          sendMail: mockSendMail,
        })),
      }));
      const { sendEmail } = require('@/lib/email');

      const result = await sendEmail({
        to: 'test@test.com',
        subject: 'Test',
        html: '<p>Test</p>',
      });

      expect(result).toBe(false);
      expect(mockSendMail).not.toHaveBeenCalled();
    });
  });

  describe('sendEmail con SMTP configurado', () => {
    it('debe enviar email y retornar true', async () => {
      process.env.SMTP_USER = 'test@zoho.com';
      process.env.SMTP_PASS = 'password123';

      jest.resetModules();
      jest.mock('nodemailer', () => ({
        createTransport: jest.fn(() => ({
          sendMail: mockSendMail,
        })),
      }));
      const { sendEmail } = require('@/lib/email');

      mockSendMail.mockResolvedValue({ messageId: 'msg-123' });

      const result = await sendEmail({
        to: 'dest@test.com',
        subject: 'Test Subject',
        html: '<p>Contenido</p>',
      });

      expect(result).toBe(true);
      expect(mockSendMail).toHaveBeenCalledTimes(1);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'dest@test.com',
          subject: 'Test Subject',
        })
      );
    });

    it('debe retornar false si sendMail lanza error', async () => {
      process.env.SMTP_USER = 'test@zoho.com';
      process.env.SMTP_PASS = 'password123';

      jest.resetModules();
      jest.mock('nodemailer', () => ({
        createTransport: jest.fn(() => ({
          sendMail: mockSendMail,
        })),
      }));
      const { sendEmail } = require('@/lib/email');

      mockSendMail.mockRejectedValue(new Error('SMTP connection failed'));

      const result = await sendEmail({
        to: 'dest@test.com',
        subject: 'Test',
        html: '<p>Test</p>',
      });

      expect(result).toBe(false);
    });

    it('debe incluir replyTo si se proporciona', async () => {
      process.env.SMTP_USER = 'test@zoho.com';
      process.env.SMTP_PASS = 'password123';

      jest.resetModules();
      jest.mock('nodemailer', () => ({
        createTransport: jest.fn(() => ({
          sendMail: mockSendMail,
        })),
      }));
      const { sendEmail } = require('@/lib/email');

      mockSendMail.mockResolvedValue({});

      await sendEmail({
        to: 'dest@test.com',
        subject: 'Test',
        html: '<p>Test</p>',
        replyTo: 'reply@test.com',
      });

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          replyTo: 'reply@test.com',
        })
      );
    });
  });

  describe('Funciones de notificación', () => {
    beforeEach(() => {
      process.env.SMTP_USER = 'test@zoho.com';
      process.env.SMTP_PASS = 'password123';
    });

    it('sendCompanyApproved debe enviar email con datos correctos', async () => {
      jest.resetModules();
      jest.mock('nodemailer', () => ({
        createTransport: jest.fn(() => ({
          sendMail: mockSendMail,
        })),
      }));
      const { sendCompanyApproved } = require('@/lib/email');

      mockSendMail.mockResolvedValue({});

      const result = await sendCompanyApproved({
        email: 'empresa@test.com',
        nombreEmpresa: 'Tech Corp',
        password: 'abc123',
        loginUrl: 'https://inakat.com/login',
      });

      expect(result).toBe(true);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'empresa@test.com',
          subject: expect.stringContaining('aprobada'),
        })
      );
      // HTML debe contener nombre de empresa
      const htmlSent = mockSendMail.mock.calls[0][0].html;
      expect(htmlSent).toContain('Tech Corp');
      expect(htmlSent).toContain('INAKAT');
    });

    it('sendPaymentConfirmation debe enviar email con monto y créditos', async () => {
      jest.resetModules();
      jest.mock('nodemailer', () => ({
        createTransport: jest.fn(() => ({
          sendMail: mockSendMail,
        })),
      }));
      const { sendPaymentConfirmation } = require('@/lib/email');

      mockSendMail.mockResolvedValue({});

      const result = await sendPaymentConfirmation({
        companyEmail: 'empresa@test.com',
        nombreEmpresa: 'Mi Empresa',
        credits: 10,
        totalPrice: 5000,
        newBalance: 15,
      });

      expect(result).toBe(true);
      const htmlSent = mockSendMail.mock.calls[0][0].html;
      expect(htmlSent).toContain('10'); // créditos
      expect(htmlSent).toContain('15'); // balance
      expect(htmlSent).toContain('Mi Empresa');
    });

    it('sendInterviewRequestToAdmin debe incluir datos de la entrevista', async () => {
      jest.resetModules();
      jest.mock('nodemailer', () => ({
        createTransport: jest.fn(() => ({
          sendMail: mockSendMail,
        })),
      }));
      const { sendInterviewRequestToAdmin } = require('@/lib/email');

      mockSendMail.mockResolvedValue({});

      await sendInterviewRequestToAdmin({
        adminEmail: 'admin@inakat.com',
        companyName: 'Corp SA',
        candidateName: 'Juan Pérez',
        jobTitle: 'Dev Senior',
        interviewType: 'videocall',
        adminUrl: 'https://inakat.com/admin/interviews',
      });

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'admin@inakat.com',
        })
      );
      const htmlSent = mockSendMail.mock.calls[0][0].html;
      expect(htmlSent).toContain('Juan Pérez');
      expect(htmlSent).toContain('Dev Senior');
      expect(htmlSent).toContain('Corp SA');
      expect(htmlSent).toContain('Videoconferencia');
    });

    it('sendCandidateSentToCompany debe incluir nombre candidato y vacante', async () => {
      jest.resetModules();
      jest.mock('nodemailer', () => ({
        createTransport: jest.fn(() => ({
          sendMail: mockSendMail,
        })),
      }));
      const { sendCandidateSentToCompany } = require('@/lib/email');

      mockSendMail.mockResolvedValue({});

      await sendCandidateSentToCompany({
        companyEmail: 'rh@empresa.com',
        nombreEmpresa: 'Startup MX',
        candidateName: 'María López',
        jobTitle: 'Frontend Dev',
        dashboardUrl: 'https://inakat.com/company/dashboard',
      });

      const htmlSent = mockSendMail.mock.calls[0][0].html;
      expect(htmlSent).toContain('María López');
      expect(htmlSent).toContain('Frontend Dev');
      expect(htmlSent).toContain('Startup MX');
    });
  });
});
