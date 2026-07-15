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

describe('SettingsService', () => {
  it('returns the default page size when no setting exists', async () => {
    const prisma = {
      systemSetting: {
        findUnique: vi.fn().mockResolvedValue(null)
      }
    };

    await expect(new SettingsService(prisma as never).list()).resolves.toEqual({
      defaultPageSize: 10,
      pageSizeOptions: [10, 25, 50, 100]
    });
  });

  it('updates the default page size and writes an audit log', async () => {
    const prisma = {
      systemSetting: {
        findUnique: vi.fn().mockResolvedValueOnce({ key: 'DEFAULT_PAGE_SIZE', value: '10' }).mockResolvedValueOnce({ key: 'DEFAULT_PAGE_SIZE', value: '25' }),
        upsert: vi.fn().mockResolvedValue({ key: 'DEFAULT_PAGE_SIZE', value: '25' })
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({})
      }
    };

    const result = await new SettingsService(prisma as never).update({ defaultPageSize: 25 }, actor);

    expect(result.defaultPageSize).toBe(25);
    expect(prisma.systemSetting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key: 'DEFAULT_PAGE_SIZE' },
        update: expect.objectContaining({ value: '25', updatedById: 'user-1' })
      })
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'SYSTEM_SETTING_UPDATED',
          entityType: 'SYSTEM_SETTING'
        })
      })
    );
  });

  it('rejects unsupported page sizes', async () => {
    await expect(new SettingsService({} as never).update({ defaultPageSize: 7 }, actor)).rejects.toBeInstanceOf(BadRequestException);
  });
});
