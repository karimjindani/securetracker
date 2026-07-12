import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { CurrentUser } from '../auth/current-user.types.js';
import { NotificationsService } from './notifications.service.js';

const actor: CurrentUser = {
  id: 'system-user',
  keycloakUserId: 'kc-system',
  email: 'system.admin@example.local',
  fullName: 'System Admin',
  role: 'SYSTEM_ADMIN',
  organizationId: 'org-system',
  organizationName: 'SecureTracker',
  organizationType: 'PAYSYS'
};

const developer = {
  id: 'developer-user',
  email: 'dev@example.local',
  fullName: 'Paysys Developer',
  role: 'PAYSYS_DEVELOPER',
  status: 'ACTIVE'
};

const makeService = (prisma: object) =>
  new NotificationsService(prisma as never, {
    get: vi.fn((key: string) => {
      if (key === 'NOTIFICATIONS_EMAIL_ENABLED') return 'false';
      if (key === 'NOTIFICATION_REMINDER_DAYS') return '7';
      if (key === 'RISK_ACCEPTANCE_EXPIRY_REMINDER_DAYS') return '14';
      return undefined;
    })
  } as never);

describe('NotificationsService', () => {
  it('creates an assignment notification for the assigned developer', async () => {
    const prisma = {
      finding: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: 'finding-1',
          findingReference: 'F-001',
          title: 'Missing authorization',
          assignedTo: developer,
          engagement: { application: { name: 'Payments Portal' } }
        })
      },
      notification: {
        create: vi.fn().mockResolvedValue({ id: 'notification-1' })
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({})
      }
    };

    await makeService(prisma).notifyFindingAssigned('finding-1', actor);

    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'developer-user',
          notificationType: 'FINDING_ASSIGNED',
          entityType: 'FINDING',
          entityId: 'finding-1'
        })
      })
    );
  });

  it('prevents users from marking another user notification as read', async () => {
    const prisma = {
      notification: {
        findUnique: vi.fn().mockResolvedValue({ id: 'notification-1', userId: 'other-user', isRead: false })
      }
    };

    await expect(makeService(prisma).markRead('notification-1', actor)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('marks all unread notifications for the current user', async () => {
    const prisma = {
      notification: {
        updateMany: vi.fn().mockResolvedValue({ count: 3 })
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({})
      }
    };

    const result = await makeService(prisma).markAllRead(actor);

    expect(result).toEqual({ count: 3 });
    expect(prisma.notification.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'system-user', isRead: false }
      })
    );
  });

  it('creates daily due reminder notifications without duplicates', async () => {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 2);
    const prisma = {
      finding: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([
            {
              id: 'finding-1',
              findingReference: 'F-001',
              title: 'Missing authorization',
              dueDate,
              assignedTo: developer,
              engagement: { application: { name: 'Payments Portal' } }
            }
          ])
          .mockResolvedValueOnce([])
      },
      riskAcceptance: {
        findMany: vi.fn().mockResolvedValue([])
      },
      notification: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'notification-1' })
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({})
      }
    };

    const result = await makeService(prisma).runDueChecks(actor);

    expect(result.created).toBe(1);
    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ notificationType: 'FINDING_DUE_REMINDER' })
      })
    );
  });
});
