// RUTA: __tests__/api/notifications.test.ts

import * as fs from 'fs';
import * as path from 'path';

const readFile = (filePath: string) =>
  fs.readFileSync(path.join(process.cwd(), filePath), 'utf-8');

// ============================================================
// Modelo Notification en Prisma
// ============================================================

describe('Prisma schema: Notification model', () => {
  const schema = readFile('prisma/schema.prisma');

  it('should have Notification model', () => {
    expect(schema).toContain('model Notification {');
  });

  it('should have required fields: userId, type, title, message, read, createdAt', () => {
    const notifModel = schema.match(/model Notification \{[\s\S]*?\n\}/);
    expect(notifModel).toBeTruthy();
    const model = notifModel![0];
    expect(model).toContain('userId');
    expect(model).toContain('type');
    expect(model).toContain('title');
    expect(model).toContain('message');
    expect(model).toContain('read');
    expect(model).toContain('createdAt');
  });

  it('should have optional fields: link, metadata, readAt', () => {
    const notifModel = schema.match(/model Notification \{[\s\S]*?\n\}/);
    const model = notifModel![0];
    expect(model).toContain('link');
    expect(model).toContain('metadata');
    expect(model).toContain('readAt');
  });

  it('should have relation to User', () => {
    const notifModel = schema.match(/model Notification \{[\s\S]*?\n\}/);
    const model = notifModel![0];
    expect(model).toContain('user');
    expect(model).toContain('User');
    expect(model).toContain('onDelete: Cascade');
  });

  it('should have index on userId + read', () => {
    const notifModel = schema.match(/model Notification \{[\s\S]*?\n\}/);
    const model = notifModel![0];
    expect(model).toContain('@@index([userId, read])');
  });

  it('should have notifications relation in User model', () => {
    const userModel = schema.match(/model User \{[\s\S]*?\n\}/);
    expect(userModel).toBeTruthy();
    expect(userModel![0]).toContain('notifications');
    expect(userModel![0]).toContain('Notification[]');
  });
});

// ============================================================
// Notification utility (src/lib/notifications.ts)
// ============================================================

describe('Notifications utility', () => {
  it('should exist', () => {
    const filePath = path.join(process.cwd(), 'src/lib/notifications.ts');
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it('should export createNotification, notifyAllAdmins, getUnreadCount', () => {
    const content = readFile('src/lib/notifications.ts');
    expect(content).toContain('export async function createNotification');
    expect(content).toContain('export async function notifyAllAdmins');
    expect(content).toContain('export async function getUnreadCount');
  });

  it('should import prisma', () => {
    const content = readFile('src/lib/notifications.ts');
    expect(content).toContain("from './prisma'");
  });

  it('should define NotificationType union type', () => {
    const content = readFile('src/lib/notifications.ts');
    expect(content).toContain('NotificationType');
    expect(content).toContain('new_request');
    expect(content).toContain('assignment');
    expect(content).toContain('credits_purchased');
    expect(content).toContain('sent_to_company');
    expect(content).toContain('application_status');
  });
});

// ============================================================
// API Route: /api/notifications
// ============================================================

describe('API Route: /api/notifications', () => {
  it('should exist', () => {
    const filePath = path.join(process.cwd(), 'src/app/api/notifications/route.ts');
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it('should export GET and PATCH handlers', () => {
    const content = readFile('src/app/api/notifications/route.ts');
    expect(content).toContain('export async function GET');
    expect(content).toContain('export async function PATCH');
  });

  it('should use requireAuth', () => {
    const content = readFile('src/app/api/notifications/route.ts');
    expect(content).toContain('requireAuth');
  });

  it('should support pagination', () => {
    const content = readFile('src/app/api/notifications/route.ts');
    expect(content).toContain('page');
    expect(content).toContain('limit');
    expect(content).toContain('pagination');
  });

  it('should support filter (unread/read)', () => {
    const content = readFile('src/app/api/notifications/route.ts');
    expect(content).toContain('filter');
    expect(content).toContain('unread');
  });

  it('PATCH should support marking all as read', () => {
    const content = readFile('src/app/api/notifications/route.ts');
    expect(content).toContain('body.all');
    expect(content).toContain('read: true');
    expect(content).toContain('readAt');
  });

  it('PATCH should support marking specific ids as read', () => {
    const content = readFile('src/app/api/notifications/route.ts');
    expect(content).toContain('body.ids');
  });
});

// ============================================================
// API Route: /api/notifications/count
// ============================================================

describe('API Route: /api/notifications/count', () => {
  it('should exist', () => {
    const filePath = path.join(process.cwd(), 'src/app/api/notifications/count/route.ts');
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it('should export GET handler', () => {
    const content = readFile('src/app/api/notifications/count/route.ts');
    expect(content).toContain('export async function GET');
  });

  it('should use getUnreadCount', () => {
    const content = readFile('src/app/api/notifications/count/route.ts');
    expect(content).toContain('getUnreadCount');
  });
});

// ============================================================
// NotificationBell component
// ============================================================

describe('NotificationBell component', () => {
  it('should exist', () => {
    const filePath = path.join(process.cwd(), 'src/components/shared/NotificationBell.tsx');
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it('should use Bell icon from lucide', () => {
    const content = readFile('src/components/shared/NotificationBell.tsx');
    expect(content).toContain('Bell');
    expect(content).toContain('lucide-react');
  });

  it('should poll for unread count', () => {
    const content = readFile('src/components/shared/NotificationBell.tsx');
    expect(content).toContain('/api/notifications/count');
    expect(content).toContain('setInterval');
    expect(content).toContain('30000');
  });

  it('should fetch notifications on dropdown open', () => {
    const content = readFile('src/components/shared/NotificationBell.tsx');
    expect(content).toContain('/api/notifications');
    expect(content).toContain('fetchNotifications');
  });

  it('should support mark all read', () => {
    const content = readFile('src/components/shared/NotificationBell.tsx');
    expect(content).toContain('markAllRead');
    expect(content).toMatch(/all.*true/);
  });

  it('should link to /notifications page', () => {
    const content = readFile('src/components/shared/NotificationBell.tsx');
    expect(content).toContain('/notifications');
    expect(content).toContain('Ver todas');
  });

  it('should show badge with unread count', () => {
    const content = readFile('src/components/shared/NotificationBell.tsx');
    expect(content).toContain('unreadCount');
    expect(content).toContain('99+');
  });
});

// ============================================================
// Navbar integration
// ============================================================

describe('Navbar should include NotificationBell', () => {
  it('should import NotificationBell', () => {
    const content = readFile('src/components/commons/Navbar.tsx');
    expect(content).toContain('NotificationBell');
    expect(content).toContain('@/components/shared/NotificationBell');
  });

  it('should render NotificationBell when user is logged in', () => {
    const content = readFile('src/components/commons/Navbar.tsx');
    expect(content).toContain('<NotificationBell');
  });
});

// ============================================================
// Notifications page
// ============================================================

describe('Notifications page', () => {
  it('should exist', () => {
    const filePath = path.join(process.cwd(), 'src/app/notifications/page.tsx');
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it('should have filter buttons (all, unread, read)', () => {
    const content = readFile('src/app/notifications/page.tsx');
    expect(content).toContain('Todas');
    expect(content).toContain('No leídas');
    expect(content).toContain('Leídas');
  });

  it('should have pagination', () => {
    const content = readFile('src/app/notifications/page.tsx');
    expect(content).toContain('Anterior');
    expect(content).toContain('Siguiente');
    expect(content).toContain('totalPages');
  });

  it('should support marking all as read', () => {
    const content = readFile('src/app/notifications/page.tsx');
    expect(content).toContain('markAllRead');
    expect(content).toContain('Marcar todas leídas');
  });
});

// ============================================================
// Middleware should include notification routes
// ============================================================

describe('Middleware should protect notification routes', () => {
  it('should include /api/notifications in matcher', () => {
    const content = readFile('src/middleware.ts');
    expect(content).toContain("'/api/notifications'");
  });

  it('should include /api/notifications/:path* in matcher', () => {
    const content = readFile('src/middleware.ts');
    expect(content).toContain("'/api/notifications/:path*'");
  });

  it('should include /notifications in matcher', () => {
    const content = readFile('src/middleware.ts');
    expect(content).toContain("'/notifications'");
  });
});

// ============================================================
// Trigger integrations (fire-and-forget pattern)
// ============================================================

describe('Notification triggers in API routes', () => {
  it('G1: company-requests/route.ts should notify admins on new request', () => {
    const content = readFile('src/app/api/company-requests/route.ts');
    expect(content).toContain('notifyAllAdmins');
    expect(content).toContain('new_request');
    expect(content).toContain('.catch(() => {})');
  });

  it('G2: company-requests/[id]/route.ts should notify company on status change', () => {
    const content = readFile('src/app/api/company-requests/[id]/route.ts');
    expect(content).toContain('createNotification');
    expect(content).toContain('request_approved');
    expect(content).toContain('request_rejected');
  });

  it('G3: admin/assignments/route.ts should notify recruiter and specialist', () => {
    const content = readFile('src/app/api/admin/assignments/route.ts');
    expect(content).toContain('createNotification');
    expect(content).toContain('assignment');
    const matches = content.match(/createNotification\(/g);
    expect(matches).toBeTruthy();
    expect(matches!.length).toBeGreaterThanOrEqual(2);
  });

  it('G4: admin/assign-candidates/route.ts should notify recruiter on injection', () => {
    const content = readFile('src/app/api/admin/assign-candidates/route.ts');
    expect(content).toContain('createNotification');
    expect(content).toContain('new_application');
  });

  it('G5: applications/route.ts should notify admins on new application', () => {
    const content = readFile('src/app/api/applications/route.ts');
    expect(content).toContain('notifyAllAdmins');
    expect(content).toContain('new_application');
  });

  it('G6: webhooks/mercadopago/route.ts should notify company on credit purchase', () => {
    const content = readFile('src/app/api/webhooks/mercadopago/route.ts');
    expect(content).toContain('createNotification');
    expect(content).toContain('credits_purchased');
  });

  it('G7: recruiter/dashboard/route.ts should notify specialist on sent_to_specialist', () => {
    const content = readFile('src/app/api/recruiter/dashboard/route.ts');
    expect(content).toContain('createNotification');
    expect(content).toContain('sent_to_specialist');
  });

  it('G8: specialist/dashboard/route.ts should notify company on sent_to_company', () => {
    const content = readFile('src/app/api/specialist/dashboard/route.ts');
    expect(content).toContain('createNotification');
    expect(content).toContain('sent_to_company');
  });

  it('G9: company/applications/[id]/route.ts should notify admins on status change', () => {
    const content = readFile('src/app/api/company/applications/[id]/route.ts');
    expect(content).toContain('notifyAllAdmins');
    expect(content).toContain('application_status');
  });

  it('All triggers should use fire-and-forget pattern (.catch)', () => {
    const files = [
      'src/app/api/company-requests/route.ts',
      'src/app/api/company-requests/[id]/route.ts',
      'src/app/api/admin/assignments/route.ts',
      'src/app/api/admin/assign-candidates/route.ts',
      'src/app/api/applications/route.ts',
      'src/app/api/webhooks/mercadopago/route.ts',
      'src/app/api/recruiter/dashboard/route.ts',
      'src/app/api/specialist/dashboard/route.ts',
      'src/app/api/company/applications/[id]/route.ts',
    ];

    files.forEach((file) => {
      const content = readFile(file);
      if (content.includes('createNotification') || content.includes('notifyAllAdmins')) {
        expect(content).toContain('.catch(() => {})');
      }
    });
  });
});

// ============================================================
// Distance utility (previous tests - keep them here for completeness)
// ============================================================

describe('Notification utility functions (unit)', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { createNotification, notifyAllAdmins, getUnreadCount } = require('../../src/lib/notifications');

  it('should export createNotification as a function', () => {
    expect(typeof createNotification).toBe('function');
  });

  it('should export notifyAllAdmins as a function', () => {
    expect(typeof notifyAllAdmins).toBe('function');
  });

  it('should export getUnreadCount as a function', () => {
    expect(typeof getUnreadCount).toBe('function');
  });
});
