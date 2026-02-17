// RUTA: src/lib/email.ts

import nodemailer from 'nodemailer';

// =============================================
// CONFIGURACIÓN SMTP (Zoho Mail)
// =============================================

const SMTP_HOST = process.env.SMTP_HOST || 'smtp.zoho.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '465');
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || 'INAKAT <noreply@inakat.com>';

function isEmailConfigured(): boolean {
  return Boolean(SMTP_USER && SMTP_PASS);
}

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (!isEmailConfigured()) {
    console.warn('[Email] SMTP no configurado — emails deshabilitados');
    return null;
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });
  }

  return transporter;
}

// =============================================
// HELPER GENÉRICO DE ENVÍO
// =============================================

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}

export async function sendEmail(params: SendEmailParams): Promise<boolean> {
  const transport = getTransporter();

  if (!transport) {
    console.warn('[Email] Skipping email (SMTP not configured):', params.subject);
    return false;
  }

  try {
    await transport.sendMail({
      from: SMTP_FROM,
      to: params.to,
      subject: params.subject,
      html: params.html,
      replyTo: params.replyTo,
    });
    console.log('[Email] Sent:', { to: params.to, subject: params.subject });
    return true;
  } catch (error) {
    console.error('[Email] Failed to send:', {
      to: params.to,
      subject: params.subject,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return false;
  }
}

// =============================================
// TEMPLATE BASE
// =============================================

function baseTemplate(content: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; }
    .header { background: #2b5d62; padding: 24px; text-align: center; }
    .header h1 { color: white; font-size: 20px; margin: 8px 0 0; }
    .body { padding: 32px 24px; color: #333; line-height: 1.6; }
    .body h2 { color: #2b5d62; margin-top: 0; }
    .btn { display: inline-block; background: #2b5d62; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; margin: 16px 0; }
    .footer { background: #f9fafb; padding: 16px 24px; text-align: center; font-size: 12px; color: #999; border-top: 1px solid #eee; }
    .info-box { background: #f0f9f4; border-left: 4px solid #2b5d62; padding: 12px 16px; margin: 16px 0; border-radius: 0 4px 4px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>INAKAT</h1>
    </div>
    <div class="body">
      ${content}
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} INAKAT — Reclutamiento inteligente</p>
      <p>Este es un correo automatico, por favor no responder directamente.</p>
    </div>
  </div>
</body>
</html>`;
}

// =============================================
// NOTIFICACIONES ESPECÍFICAS
// =============================================

/** 1. Empresa: Su solicitud de registro fue aprobada */
export async function sendCompanyApproved(params: {
  email: string;
  nombreEmpresa: string;
  password: string;
  loginUrl: string;
}): Promise<boolean> {
  const html = baseTemplate(`
    <h2>Bienvenido a INAKAT!</h2>
    <p>Nos complace informarte que la solicitud de registro de <strong>${params.nombreEmpresa}</strong> ha sido aprobada.</p>
    <div class="info-box">
      <p><strong>Tus credenciales de acceso:</strong></p>
      <p>Email: ${params.email}</p>
      <p>Contrasena: ${params.password}</p>
    </div>
    <p>Ya puedes acceder a la plataforma para publicar vacantes y encontrar el mejor talento.</p>
    <a href="${params.loginUrl}" class="btn">Ir a la Plataforma</a>
    <p style="font-size: 13px; color: #666;">Te recomendamos cambiar tu contrasena despues de iniciar sesion.</p>
  `);

  return sendEmail({
    to: params.email,
    subject: 'Tu empresa ha sido aprobada — INAKAT',
    html,
  });
}

/** 2. Empresa: Nuevo candidato enviado para revision */
export async function sendCandidateSentToCompany(params: {
  companyEmail: string;
  nombreEmpresa: string;
  candidateName: string;
  jobTitle: string;
  dashboardUrl: string;
}): Promise<boolean> {
  const html = baseTemplate(`
    <h2>Nuevo candidato disponible</h2>
    <p>Hola ${params.nombreEmpresa},</p>
    <p>Un nuevo candidato ha completado el proceso de evaluacion y esta listo para tu revision:</p>
    <div class="info-box">
      <p>Candidato: <strong>${params.candidateName}</strong></p>
      <p>Vacante: <strong>${params.jobTitle}</strong></p>
    </div>
    <p>Revisa su perfil y decide si deseas agendar una entrevista.</p>
    <a href="${params.dashboardUrl}" class="btn">Ver Candidatos</a>
  `);

  return sendEmail({
    to: params.companyEmail,
    subject: `Nuevo candidato para "${params.jobTitle}" — INAKAT`,
    html,
  });
}

/** 3. Admin: Nueva solicitud de entrevista de empresa */
export async function sendInterviewRequestToAdmin(params: {
  adminEmail: string;
  companyName: string;
  candidateName: string;
  jobTitle: string;
  interviewType: string;
  adminUrl: string;
}): Promise<boolean> {
  const html = baseTemplate(`
    <h2>Nueva solicitud de entrevista</h2>
    <p>La empresa <strong>${params.companyName}</strong> ha solicitado una entrevista:</p>
    <div class="info-box">
      <p>Candidato: <strong>${params.candidateName}</strong></p>
      <p>Vacante: <strong>${params.jobTitle}</strong></p>
      <p>Tipo: <strong>${params.interviewType === 'videocall' ? 'Videoconferencia' : 'Presencial'}</strong></p>
    </div>
    <p>Revisa los horarios propuestos y agenda la entrevista.</p>
    <a href="${params.adminUrl}" class="btn">Gestionar Entrevistas</a>
  `);

  return sendEmail({
    to: params.adminEmail,
    subject: `Solicitud de entrevista: ${params.candidateName} — ${params.companyName}`,
    html,
  });
}

/** 4. Empresa: Pago confirmado — creditos agregados */
export async function sendPaymentConfirmation(params: {
  companyEmail: string;
  nombreEmpresa: string;
  credits: number;
  totalPrice: number;
  newBalance: number;
}): Promise<boolean> {
  const html = baseTemplate(`
    <h2>Pago confirmado</h2>
    <p>Hola ${params.nombreEmpresa},</p>
    <p>Tu compra de creditos ha sido procesada exitosamente.</p>
    <div class="info-box">
      <p>Creditos comprados: <strong>${params.credits}</strong></p>
      <p>Total pagado: <strong>${params.totalPrice.toLocaleString('es-MX')} MXN</strong></p>
      <p>Balance actual: <strong>${params.newBalance} creditos</strong></p>
    </div>
    <p>Ya puedes usar tus creditos para publicar nuevas vacantes.</p>
  `);

  return sendEmail({
    to: params.companyEmail,
    subject: `Pago confirmado — ${params.credits} creditos agregados — INAKAT`,
    html,
  });
}
