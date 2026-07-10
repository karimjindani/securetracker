import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { CurrentUser } from '../auth/current-user.types.js';
import { ApplicationsService } from './applications.service.js';

const actor: CurrentUser = {
  id: 'user-1',
  keycloakUserId: 'kc-1',
  email: 'paysys.admin@example.local',
  fullName: 'Paysys Admin',
  role: 'PAYSYS_SECURITY_ADMIN',
  organizationId: 'org-1',
  organizationName: 'Paysys Labs',
  organizationType: 'PAYSYS'
};

describe('ApplicationsService', () => {
  it('creates an application and audit entry', async () => {
    const application = { id: 'app-1', name: 'Internet Banking' };
    const prisma = {
      application: {
        create: vi.fn().mockResolvedValue(application)
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({})
      }
    };

    const result = await new ApplicationsService(prisma as never).create(
      {
        name: 'Internet Banking',
        environment: 'PRODUCTION',
        criticality: 'CRITICAL',
        internetFacing: true
      },
      actor
    );

    expect(result).toBe(application);
    expect(prisma.application.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          createdById: 'user-1',
          environment: 'PRODUCTION',
          criticality: 'CRITICAL'
        })
      })
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'APPLICATION_CREATED',
          entityType: 'APPLICATION',
          entityId: 'app-1'
        })
      })
    );
  });

  it('rejects invalid criticality values', async () => {
    const prisma = {};

    await expect(
      new ApplicationsService(prisma as never).create(
        {
          name: 'Internet Banking',
          environment: 'PRODUCTION',
          criticality: 'URGENT' as never
        },
        actor
      )
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
