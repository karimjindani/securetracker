import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { CurrentUser } from '../auth/current-user.types.js';
import { CalendarService } from './calendar.service.js';

const actor: CurrentUser = {
  id: 'user-1',
  keycloakUserId: 'kc-1',
  email: 'nbp.admin@example.local',
  fullName: 'NBP Admin',
  role: 'NBP_SECURITY_ADMIN',
  organizationId: 'org-1',
  organizationName: 'NBP',
  organizationType: 'NBP'
};

describe('CalendarService', () => {
  it('creates a planned engagement and audit entry', async () => {
    const engagement = { id: 'eng-1', title: 'Internet Banking VAPT', status: 'PLANNED' };
    const prisma = {
      vaptEngagement: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(engagement)
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({})
      }
    };

    const result = await new CalendarService(prisma as never).create(
      {
        applicationId: 'app-1',
        title: 'Internet Banking VAPT',
        assessmentType: 'WHITEBOX',
        plannedYear: 2026,
        plannedMonth: 'July'
      },
      actor
    );

    expect(result).toBe(engagement);
    expect(prisma.vaptEngagement.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          applicationId: 'app-1',
          title: 'Internet Banking VAPT',
          assessmentType: 'WHITEBOX',
          plannedYear: 2026,
          plannedMonth: 'July',
          status: 'PLANNED'
        })
      })
    );
    expect(prisma.vaptEngagement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'PLANNED',
          createdById: 'user-1',
          assessmentType: 'WHITEBOX',
          plannedYear: 2026
        })
      })
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'CALENDAR_ENTRY_CREATED',
          entityType: 'VAPT_ENGAGEMENT',
          entityId: 'eng-1'
        })
      })
    );
  });

  it('returns an existing planned entry instead of creating a duplicate', async () => {
    const engagement = { id: 'eng-existing', title: 'Internet Banking VAPT', status: 'PLANNED' };
    const prisma = {
      vaptEngagement: {
        findFirst: vi.fn().mockResolvedValue(engagement),
        create: vi.fn()
      },
      auditLog: {
        create: vi.fn()
      }
    };

    const result = await new CalendarService(prisma as never).create(
      {
        applicationId: 'app-1',
        title: 'Internet Banking VAPT',
        assessmentType: 'WHITEBOX',
        plannedYear: 2026,
        plannedMonth: 'July'
      },
      actor
    );

    expect(result).toBe(engagement);
    expect(prisma.vaptEngagement.create).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('rejects an end date before the start date', async () => {
    await expect(
      new CalendarService({} as never).create(
        {
          applicationId: 'app-1',
          title: 'Internet Banking VAPT',
          assessmentType: 'WHITEBOX',
          plannedYear: 2026,
          plannedStartDate: '2026-07-20',
          plannedEndDate: '2026-07-10'
        },
        actor
      )
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
