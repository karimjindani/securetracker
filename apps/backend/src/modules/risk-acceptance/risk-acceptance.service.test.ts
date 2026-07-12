import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { CurrentUser } from '../auth/current-user.types.js';
import { RiskAcceptanceService } from './risk-acceptance.service.js';

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

const auditorActor: CurrentUser = {
  ...paysysActor,
  id: 'auditor-user',
  role: 'AUDITOR',
  organizationId: 'org-auditor',
  organizationName: 'Auditor',
  organizationType: 'AUDITOR'
};

const finding = {
  id: 'finding-1',
  engagementId: 'engagement-1',
  status: 'REVALIDATION_FAILED',
  engagement: { id: 'engagement-1' }
};

const request = {
  id: 'risk-1',
  findingId: 'finding-1',
  engagementId: 'engagement-1',
  status: 'REQUESTED',
  finding
};

const makeService = (prisma: object) => new RiskAcceptanceService(prisma as never);

describe('RiskAcceptanceService', () => {
  it('allows Paysys to request risk acceptance and audits it', async () => {
    const prisma = {
      finding: {
        findUniqueOrThrow: vi.fn().mockResolvedValue(finding),
        update: vi.fn().mockResolvedValue({})
      },
      riskAcceptance: {
        create: vi.fn().mockResolvedValue(request)
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({})
      }
    };

    const result = await makeService(prisma).request(
      'finding-1',
      {
        riskDescription: 'Residual risk',
        businessJustification: 'Production dependency',
        expiryDate: '2026-12-31'
      },
      paysysActor
    );

    expect(result).toBe(request);
    expect(prisma.finding.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'RISK_ACCEPTANCE_REQUESTED' }) })
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'RISK_ACCEPTANCE_REQUESTED' }) })
    );
  });

  it('blocks read-only users from requesting risk acceptance', async () => {
    await expect(
      makeService({}).request(
        'finding-1',
        { riskDescription: 'Risk', businessJustification: 'Business', expiryDate: '2026-12-31' },
        auditorActor
      )
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows NBP to approve and updates the finding', async () => {
    const prisma = {
      riskAcceptance: {
        findUniqueOrThrow: vi.fn().mockResolvedValue(request),
        update: vi.fn().mockResolvedValue({ ...request, status: 'APPROVED' })
      },
      finding: {
        update: vi.fn().mockResolvedValue({})
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({})
      }
    };

    const result = await makeService(prisma).review('risk-1', { status: 'APPROVED' }, nbpActor);

    expect(result.status).toBe('APPROVED');
    expect(prisma.finding.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'RISK_ACCEPTED' }) })
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'RISK_ACCEPTANCE_APPROVED' }) })
    );
  });
});
