import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { CurrentUser } from '../auth/current-user.types.js';
import { FindingsService } from './findings.service.js';

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

const developerActor: CurrentUser = {
  ...paysysActor,
  id: 'developer-user',
  role: 'PAYSYS_DEVELOPER',
  email: 'dev@example.local',
  fullName: 'Paysys Developer'
};

const vendorActor: CurrentUser = {
  ...paysysActor,
  id: 'vendor-user',
  role: 'VENDOR_ADMIN',
  organizationId: 'org-apprise',
  organizationName: 'Apprise',
  organizationType: 'VENDOR'
};

const auditorActor: CurrentUser = {
  ...paysysActor,
  id: 'auditor-user',
  role: 'AUDITOR',
  organizationId: 'org-auditor',
  organizationName: 'Auditor',
  organizationType: 'AUDITOR'
};

const baseFinding = {
  id: 'finding-1',
  engagementId: 'eng-1',
  sourceReportVersionId: null,
  findingReference: 'F-001',
  title: 'Missing authorization',
  description: 'Access control can be bypassed.',
  impact: null,
  recommendation: null,
  severity: 'HIGH',
  cvssScore: null,
  cwe: null,
  owaspCategory: null,
  status: 'ASSIGNED',
  assignedToUserId: 'developer-user',
  dueDate: null,
  fixedAt: null,
  closedAt: null,
  closedById: null,
  createdById: 'vendor-user',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  engagement: { id: 'eng-1', status: 'DEVELOPER_FIX', vendorOrganizationId: 'org-apprise', application: {}, vendorOrganization: {} },
  sourceReportVersion: null,
  assignedTo: { id: 'developer-user', fullName: 'Paysys Developer', email: 'dev@example.local' },
  createdBy: { id: 'vendor-user', fullName: 'Apprise Vendor', email: 'vendor@example.local' },
  closedBy: null,
  evidence: [],
  revalidations: [],
  statusHistory: []
};

const makeService = (prisma: object) =>
  new FindingsService(prisma as never, { get: vi.fn().mockReturnValue(undefined) } as never, {
    notifyFindingAssigned: vi.fn().mockResolvedValue(undefined),
    notifyRevalidationCompleted: vi.fn().mockResolvedValue(undefined)
  } as never);

describe('FindingsService', () => {
  it('allows vendor to create a finding and audits it', async () => {
    const created = { ...baseFinding, status: 'OPEN', assignedToUserId: null };
    const prisma = {
      vaptEngagement: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'eng-1', status: 'DRAFT_REPORT_UPLOADED', vendorOrganizationId: 'org-apprise' }),
        update: vi.fn().mockResolvedValue({})
      },
      finding: {
        create: vi.fn().mockResolvedValue(created)
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({})
      }
    };

    const result = await makeService(prisma).create(
      'eng-1',
      {
        findingReference: 'F-001',
        title: 'Missing authorization',
        description: 'Access control can be bypassed.',
        severity: 'HIGH'
      },
      vendorActor
    );

    expect(result.status).toBe('OPEN');
    expect(prisma.vaptEngagement.update).toHaveBeenCalledWith({
      where: { id: 'eng-1' },
      data: { status: 'PAYSYS_TRIAGE' }
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'FINDING_CREATED' }) })
    );
  });

  it('assigns findings only to Paysys Developers', async () => {
    const assigned = { ...baseFinding, status: 'ASSIGNED' };
    const prisma = {
      finding: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ ...baseFinding, status: 'OPEN', assignedToUserId: null }),
        update: vi.fn().mockResolvedValue(assigned)
      },
      user: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'developer-user', role: 'PAYSYS_DEVELOPER' })
      },
      vaptEngagement: {
        update: vi.fn().mockResolvedValue({})
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({})
      }
    };

    const result = await makeService(prisma).assign('finding-1', { assignedToUserId: 'developer-user' }, paysysActor);

    expect(result.assignedToUserId).toBe('developer-user');
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'FINDING_ASSIGNED' }) })
    );
  });

  it('allows only the assigned developer to mark fixed pending revalidation', async () => {
    const fixed = { ...baseFinding, status: 'FIXED_PENDING_REVALIDATION', fixedAt: new Date('2026-01-02T00:00:00Z') };
    const prisma = {
      finding: {
        findUniqueOrThrow: vi.fn().mockResolvedValue(baseFinding),
        update: vi.fn().mockResolvedValue(fixed)
      },
      vaptEngagement: {
        update: vi.fn().mockResolvedValue({})
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({})
      }
    };

    const result = await makeService(prisma).updateStatus(
      'finding-1',
      { targetStatus: 'FIXED_PENDING_REVALIDATION' },
      developerActor
    );

    expect(result.status).toBe('FIXED_PENDING_REVALIDATION');
    expect(prisma.vaptEngagement.update).toHaveBeenCalledWith({
      where: { id: 'eng-1' },
      data: { status: 'FIXED_PENDING_REVALIDATION' }
    });
  });

  it('blocks unassigned developers from updating finding status', async () => {
    const prisma = {
      finding: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          ...baseFinding,
          assignedToUserId: 'other-dev',
          assignedTo: { id: 'other-dev', fullName: 'Other Developer', email: 'other.dev@example.local' }
        })
      }
    };

    await expect(
      makeService(prisma).updateStatus('finding-1', { targetStatus: 'FIXED_PENDING_REVALIDATION' }, developerActor)
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows the assigned developer to upload evidence', async () => {
    const prisma = {
      finding: {
        findUniqueOrThrow: vi.fn().mockResolvedValue(baseFinding)
      },
      findingEvidence: {
        create: vi.fn().mockResolvedValue({
          id: 'evidence-1',
          findingId: 'finding-1',
          evidenceType: 'TEST_RESULT',
          title: 'Fix test',
          notes: null,
          fileName: null,
          fileSizeBytes: null,
          uploadedBy: { fullName: 'Paysys Developer', email: 'dev@example.local' }
        })
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({})
      }
    };

    const result = await makeService(prisma).createEvidence(
      'finding-1',
      { evidenceType: 'TEST_RESULT', title: 'Fix test' },
      undefined,
      developerActor
    );

    expect(result.title).toBe('Fix test');
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'EVIDENCE_UPLOADED' }) })
    );
  });

  it('records failed revalidation and routes the engagement back to developer fix', async () => {
    const revalidated = { ...baseFinding, status: 'REVALIDATION_FAILED' };
    const prisma = {
      finding: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ ...baseFinding, status: 'FIXED_PENDING_REVALIDATION' }),
        update: vi.fn().mockResolvedValue(revalidated)
      },
      revalidation: {
        create: vi.fn().mockResolvedValue({ id: 'reval-1', findingId: 'finding-1', result: 'FAILED' })
      },
      vaptEngagement: {
        update: vi.fn().mockResolvedValue({})
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({})
      }
    };

    const result = await makeService(prisma).createRevalidation(
      'finding-1',
      { result: 'FAILED', remarks: 'Fix not effective.' },
      vendorActor
    );

    expect(result.status).toBe('REVALIDATION_FAILED');
    expect(prisma.vaptEngagement.update).toHaveBeenCalledWith({
      where: { id: 'eng-1' },
      data: { status: 'DEVELOPER_FIX' }
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'REVALIDATION_FAILED' }) })
    );
  });

  it('blocks read-only users from creating findings', async () => {
    await expect(
      makeService({}).create(
        'eng-1',
        {
          findingReference: 'F-001',
          title: 'Missing authorization',
          description: 'Access control can be bypassed.',
          severity: 'HIGH'
        },
        auditorActor
      )
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
