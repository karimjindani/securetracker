import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { CurrentUser } from '../auth/current-user.types.js';
import { EngagementsService } from './engagements.service.js';

const paysysActor: CurrentUser = {
  id: 'paysys-user',
  keycloakUserId: 'kc-paysys',
  email: 'paysys.admin@example.local',
  fullName: 'Paysys Admin',
  role: 'PAYSYS_SECURITY_ADMIN',
  organizationId: 'org-paysys',
  organizationName: 'Paysys Labs',
  organizationType: 'PAYSYS'
};

const nbpActor: CurrentUser = {
  ...paysysActor,
  id: 'nbp-user',
  role: 'NBP_SECURITY_ADMIN',
  organizationId: 'org-nbp',
  organizationName: 'NBP',
  organizationType: 'NBP'
};

const notifications = {
  notifyEngagementStatus: vi.fn().mockResolvedValue(undefined)
};

const settings = {
  list: vi.fn().mockResolvedValue({ scheduleHealthWarningDays: 7 })
};

describe('EngagementsService', () => {
  it('adds schedule health and filters engagement lists by derived risk state', async () => {
    const prisma = {
      vaptEngagement: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'green-1',
            title: 'Future VAPT',
            status: 'PLANNED',
            plannedStartDate: new Date('2026-08-01T00:00:00Z'),
            plannedEndDate: new Date('2026-08-05T00:00:00Z')
          },
          {
            id: 'red-1',
            title: 'Expired VAPT',
            status: 'PAYSYS_TRIAGE',
            plannedStartDate: new Date('2026-07-01T00:00:00Z'),
            plannedEndDate: new Date('2026-07-10T00:00:00Z')
          }
        ])
      }
    };

    const result = await new EngagementsService(prisma as never, notifications as never, settings as never).list({ scheduleHealth: 'RED' });

    expect(result).toEqual([
      expect.objectContaining({
        id: 'red-1',
        scheduleHealth: 'RED'
      })
    ]);
  });

  it('uses the configured schedule-health warning window', async () => {
    const prisma = {
      vaptEngagement: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'soon-1',
            title: 'Soon VAPT',
            status: 'PLANNED',
            plannedStartDate: new Date('2026-08-01T00:00:00Z'),
            plannedEndDate: new Date('2026-08-05T00:00:00Z')
          }
        ])
      }
    };
    const wideWarning = { list: vi.fn().mockResolvedValue({ scheduleHealthWarningDays: 30 }) };

    const result = await new EngagementsService(prisma as never, notifications as never, wideWarning as never).list({
      scheduleHealth: 'YELLOW'
    });

    expect(result).toEqual([expect.objectContaining({ id: 'soon-1', scheduleHealth: 'YELLOW' })]);
  });


  it('rejects invalid schedule health filters', async () => {
    await expect(
      new EngagementsService({} as never, notifications as never, settings as never).list({ scheduleHealth: 'BLUE' })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('blocks non-NBP users from closing an engagement', async () => {
    const prisma = {
      vaptEngagement: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: 'eng-1',
          status: 'NBP_IS_REVIEW_CLOSING_MEETING',
          actualStartDate: null,
          scopingRecords: []
        })
      }
    };

    await expect(
      new EngagementsService(prisma as never, notifications as never, settings as never).transition(
        'eng-1',
        { targetStatus: 'CLOSED', remarks: 'Closing meeting complete' },
        paysysActor
      )
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows NBP Security Admin to close and audits the transition', async () => {
    const before = { id: 'eng-1', status: 'NBP_IS_REVIEW_CLOSING_MEETING', actualStartDate: null, scopingRecords: [] };
    const after = { ...before, status: 'CLOSED', closedById: 'nbp-user' };
    const prisma = {
      vaptEngagement: {
        findUniqueOrThrow: vi.fn().mockResolvedValue(before),
        update: vi.fn().mockResolvedValue(after)
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({})
      }
    };

    const result = await new EngagementsService(prisma as never, notifications as never, settings as never).transition(
      'eng-1',
      { targetStatus: 'CLOSED', remarks: 'Closing meeting complete' },
      nbpActor
    );

    expect(result).toBe(after);
    expect(prisma.vaptEngagement.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'CLOSED',
          closedById: 'nbp-user'
        })
      })
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'ENGAGEMENT_STATUS_CHANGED',
          remarks: 'Closing meeting complete'
        })
      })
    );
  });

  it('finalizes a draft scoping record and audits the action', async () => {
    const before = { id: 'scope-1', recordStatus: 'DRAFT' };
    const after = { id: 'scope-1', recordStatus: 'FINAL', finalizedById: 'paysys-user' };
    const prisma = {
      scopingRecord: {
        findUniqueOrThrow: vi.fn().mockResolvedValue(before),
        update: vi.fn().mockResolvedValue(after)
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({})
      }
    };

    const result = await new EngagementsService(prisma as never, notifications as never, settings as never).finalizeScopingRecord('scope-1', paysysActor);

    expect(result).toBe(after);
    expect(prisma.scopingRecord.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          recordStatus: 'FINAL',
          finalizedById: 'paysys-user'
        })
      })
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'SCOPING_RECORD_FINALIZED' })
      })
    );
  });
});
