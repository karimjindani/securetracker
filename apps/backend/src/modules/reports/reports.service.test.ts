import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { CurrentUser } from '../auth/current-user.types.js';
import { ReportsService } from './reports.service.js';

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

const vendorActor: CurrentUser = {
  ...paysysActor,
  id: 'vendor-user',
  role: 'VENDOR_ADMIN',
  organizationId: 'org-apprise',
  organizationName: 'Apprise',
  organizationType: 'VENDOR'
};

const viewerActor: CurrentUser = {
  ...paysysActor,
  id: 'viewer-user',
  role: 'NBP_VIEWER',
  organizationId: 'org-nbp',
  organizationName: 'NBP',
  organizationType: 'NBP'
};

const pdfFile = (content = '%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF') =>
  ({
    originalname: 'REGRESSION_report.pdf',
    mimetype: 'application/pdf',
    buffer: Buffer.from(content),
    size: Buffer.byteLength(content)
  }) as Express.Multer.File;

const reportResponse = {
  id: 'report-1',
  engagementId: 'eng-1',
  reportType: 'DRAFT_REPORT',
  title: 'Draft VAPT Report',
  description: null,
  currentVersion: 1,
  status: 'ACTIVE',
  immutable: false,
  createdById: 'paysys-user',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  createdBy: { id: 'paysys-user', fullName: 'Paysys Admin', email: 'paysys.admin@example.local' },
  versions: [
    {
      id: 'version-1',
      reportId: 'report-1',
      versionNumber: 1,
      fileName: 'REGRESSION_report.pdf',
      fileMimeType: 'application/pdf',
      fileSizeBytes: BigInt(52),
      objectStorageKey: 'vapt-tracker/engagements/eng-1/reports/report-1/v1-REGRESSION_report.pdf',
      sha256Hash: 'a'.repeat(64),
      isPasswordProtected: false,
      uploadedById: 'paysys-user',
      uploadedAt: new Date('2026-01-01T00:00:00Z'),
      uploadNotes: null,
      uploadedBy: { id: 'paysys-user', fullName: 'Paysys Admin', email: 'paysys.admin@example.local' }
    }
  ]
};

const makeService = (prisma: object) => {
  const service = new ReportsService(
    prisma as never,
    { get: vi.fn().mockReturnValue(undefined) } as never,
    { notifyReportUploaded: vi.fn().mockResolvedValue(undefined) } as never
  );
  vi.spyOn(service as unknown as { ensureBucket: () => Promise<void> }, 'ensureBucket').mockResolvedValue(undefined);
  vi.spyOn((service as unknown as { minio: { putObject: () => Promise<object> } }).minio, 'putObject').mockResolvedValue({
    etag: 'etag'
  });
  return service;
};

describe('ReportsService', () => {
  it('uploads a draft report, stores metadata, advances workflow, and audits', async () => {
    const prisma = {
      vaptEngagement: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: 'eng-1',
          status: 'APPRISE_ASSESSMENT',
          vendorOrganizationId: 'org-apprise'
        }),
        update: vi.fn().mockResolvedValue({})
      },
      report: {
        create: vi.fn().mockResolvedValue(reportResponse)
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({})
      }
    };

    const result = await makeService(prisma).createReport(
      'eng-1',
      { reportType: 'DRAFT_REPORT', title: 'Draft VAPT Report' },
      pdfFile(),
      paysysActor
    );

    expect(result.versions[0].fileSizeBytes).toBe('52');
    expect(prisma.report.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reportType: 'DRAFT_REPORT',
          title: 'Draft VAPT Report',
          versions: expect.objectContaining({
            create: expect.objectContaining({
              sha256Hash: expect.stringMatching(/^[a-f0-9]{64}$/),
              isPasswordProtected: false
            })
          })
        })
      })
    );
    expect(prisma.vaptEngagement.update).toHaveBeenCalledWith({
      where: { id: 'eng-1' },
      data: { status: 'DRAFT_REPORT_UPLOADED' }
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'REPORT_UPLOADED' }) })
    );
  });

  it('detects protected PDFs without accepting passwords', async () => {
    const prisma = {
      vaptEngagement: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'eng-1', status: 'APPRISE_ASSESSMENT' })
      }
    };

    await expect(
      makeService(prisma).createReport(
        'eng-1',
        { reportType: 'DRAFT_REPORT', title: 'Draft VAPT Report', password: 'secret' } as never,
        pdfFile('%PDF-1.4\n/Encrypt\n%%EOF'),
        paysysActor
      )
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('blocks read-only roles from uploading reports', async () => {
    await expect(
      makeService({}).createReport(
        'eng-1',
        { reportType: 'DRAFT_REPORT', title: 'Draft VAPT Report' },
        pdfFile(),
        viewerActor
      )
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('blocks vendor uploads outside the vendor engagement', async () => {
    const prisma = {
      vaptEngagement: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: 'eng-1',
          status: 'APPRISE_ASSESSMENT',
          vendorOrganizationId: 'org-other'
        })
      }
    };

    await expect(
      makeService(prisma).createReport(
        'eng-1',
        { reportType: 'DRAFT_REPORT', title: 'Draft VAPT Report' },
        pdfFile(),
        vendorActor
      )
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('blocks final report versions after engagement closure', async () => {
    const closedFinalReport = {
      ...reportResponse,
      reportType: 'FINAL_REPORT',
      versions: reportResponse.versions
    };
    const prisma = {
      report: {
        findUniqueOrThrow: vi.fn().mockResolvedValue(closedFinalReport)
      },
      vaptEngagement: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'eng-1', status: 'CLOSED', vendorOrganizationId: 'org-apprise' })
      }
    };

    await expect(makeService(prisma).addVersion('report-1', {}, pdfFile(), paysysActor)).rejects.toBeInstanceOf(
      BadRequestException
    );
  });
});
