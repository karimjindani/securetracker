import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { CurrentUser } from '../auth/current-user.types.js';
import { SettingsService } from './settings.service.js';

const actor: CurrentUser = {
  id: 'user-1',
  keycloakUserId: 'kc-1',
  email: 'system.admin@example.local',
  fullName: 'System Admin',
  role: 'SYSTEM_ADMIN',
  organizationId: 'org-paysys',
  organizationName: 'Paysys Labs',
  organizationType: 'PAYSYS'
};

const config = {
  get: vi.fn((key: string) => {
    if (key === 'NOTIFICATIONS_EMAIL_ENABLED') return 'true';
    if (key === 'NOTIFICATIONS_SCHEDULER_ENABLED') return 'false';
    if (key === 'NOTIFICATION_REMINDER_DAYS') return '7';
    if (key === 'RISK_ACCEPTANCE_EXPIRY_REMINDER_DAYS') return '14';
    return undefined;
  })
};

describe('SettingsService', () => {
  it('returns all defaults when no settings exist', async () => {
    const prisma = {
      systemSetting: {
        findMany: vi.fn().mockResolvedValue([])
      }
    };

    await expect(new SettingsService(prisma as never, config as never).list()).resolves.toEqual({
      defaultPageSize: 10,
      pageSizeOptions: [10, 25, 50, 100],
      scheduleHealthWarningDays: 7,
      notificationReminderDays: 7,
      riskAcceptanceExpiryReminderDays: 14,
      notificationsEmailEnabled: true,
      notificationsSchedulerEnabled: false,
      auditRetentionDays: 365
    });
  });

  it('updates changed settings and writes one audit log per key', async () => {
    const prisma = {
      systemSetting: {
        findMany: vi.fn().mockResolvedValue([
          { key: 'DEFAULT_PAGE_SIZE', value: '25' },
          { key: 'SCHEDULE_HEALTH_WARNING_DAYS', value: '10' }
        ]),
        findUnique: vi.fn().mockResolvedValueOnce({ key: 'DEFAULT_PAGE_SIZE', value: '10' }).mockResolvedValueOnce(null),
        upsert: vi
          .fn()
          .mockResolvedValueOnce({ key: 'DEFAULT_PAGE_SIZE', value: '25' })
          .mockResolvedValueOnce({ key: 'SCHEDULE_HEALTH_WARNING_DAYS', value: '10' })
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({})
      }
    };

    const result = await new SettingsService(prisma as never, config as never).update(
      { defaultPageSize: 25, scheduleHealthWarningDays: 10 },
      actor
    );

    expect(result.defaultPageSize).toBe(25);
    expect(result.scheduleHealthWarningDays).toBe(10);
    expect(prisma.systemSetting.upsert).toHaveBeenCalledTimes(2);
    expect(prisma.auditLog.create).toHaveBeenCalledTimes(2);
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'SYSTEM_SETTING_UPDATED',
          entityType: 'SYSTEM_SETTING'
        })
      })
    );
  });

  it('rejects unsupported settings values', async () => {
    await expect(
      new SettingsService({} as never, config as never).update({ defaultPageSize: 7 }, actor)
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      new SettingsService({} as never, config as never).update({ scheduleHealthWarningDays: 31 }, actor)
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      new SettingsService({} as never, config as never).update({ notificationsEmailEnabled: 'yes' as never }, actor)
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
