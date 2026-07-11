import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client as MinioClient } from 'minio';
import { createHash, randomUUID } from 'node:crypto';
import type { Readable } from 'node:stream';
import { canUploadReports, reportTypes, type ReportType } from '@securetracker/shared';
import type { CurrentUser } from '../auth/current-user.types.js';
import { PrismaService } from '../database/prisma.service.js';

export interface CreateReportDto {
  reportType?: ReportType;
  title?: string;
  description?: string;
  uploadNotes?: string;
}

interface StoredObject {
  objectKey: string;
  sha256Hash: string;
  fileSizeBytes: bigint;
  fileMimeType: string;
  isPasswordProtected: boolean;
  fileName: string;
}

@Injectable()
export class ReportsService {
  private readonly minio: MinioClient;
  private readonly bucketName: string;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService) private readonly config: ConfigService
  ) {
    this.bucketName = this.config.get<string>('MINIO_BUCKET') ?? 'vapt-tracker';
    this.minio = new MinioClient({
      endPoint: this.config.get<string>('MINIO_ENDPOINT') ?? 'localhost',
      port: Number(this.config.get<string>('MINIO_PORT') ?? 9000),
      useSSL: (this.config.get<string>('MINIO_USE_SSL') ?? 'false') === 'true',
      accessKey: this.config.get<string>('MINIO_ROOT_USER') ?? this.config.get<string>('MINIO_ACCESS_KEY') ?? 'minioadmin',
      secretKey:
        this.config.get<string>('MINIO_ROOT_PASSWORD') ?? this.config.get<string>('MINIO_SECRET_KEY') ?? 'minioadmin'
    });
  }

  async listForEngagement(engagementId: string, actor: CurrentUser) {
    await this.assertEngagementReadable(engagementId, actor);
    const reports = await this.prisma.report.findMany({
      where: { engagementId },
      orderBy: { createdAt: 'desc' },
      include: this.reportInclude()
    });
    return reports.map((report) => this.toReportDto(report));
  }

  async getReport(reportId: string, actor: CurrentUser) {
    const report = await this.findReportOrThrow(reportId);
    await this.assertEngagementReadable(report.engagementId, actor);
    return this.toReportDto(report);
  }

  async createReport(engagementId: string, input: CreateReportDto, file: Express.Multer.File, actor: CurrentUser) {
    this.assertCanUpload(actor);
    this.rejectPasswordFields(input as Record<string, unknown>);
    const engagement = await this.findEngagementForWrite(engagementId, actor);
    const reportType = this.requireReportType(input.reportType);
    const title = this.requiredText(input.title, 'Title');
    const reportId = randomUUID();
    const stored = await this.storeFile(engagementId, reportId, 1, file);

    const report = await this.prisma.report.create({
      data: {
        id: reportId,
        engagementId,
        reportType,
        title,
        description: this.optionalText(input.description),
        currentVersion: 1,
        createdById: actor.id,
        versions: {
          create: {
            versionNumber: 1,
            fileName: stored.fileName,
            fileMimeType: stored.fileMimeType,
            fileSizeBytes: stored.fileSizeBytes,
            objectStorageKey: stored.objectKey,
            sha256Hash: stored.sha256Hash,
            isPasswordProtected: stored.isPasswordProtected,
            uploadedById: actor.id,
            uploadNotes: this.optionalText(input.uploadNotes)
          }
        }
      },
      include: this.reportInclude()
    });

    await this.applyReportWorkflow(engagement.id, engagement.status, reportType);
    await this.audit(actor, 'REPORT_UPLOADED', 'REPORT', report.id, undefined, this.auditReport(report));
    return this.toReportDto(report);
  }

  async addVersion(
    reportId: string,
    input: Pick<CreateReportDto, 'uploadNotes'>,
    file: Express.Multer.File,
    actor: CurrentUser
  ) {
    this.assertCanUpload(actor);
    this.rejectPasswordFields(input as Record<string, unknown>);
    const report = await this.findReportOrThrow(reportId);
    const engagement = await this.findEngagementForWrite(report.engagementId, actor);
    if (report.immutable || (report.reportType === 'FINAL_REPORT' && ['CLOSED', 'GO_LIVE'].includes(engagement.status))) {
      throw new BadRequestException('Final reports cannot be modified after engagement closure');
    }
    const nextVersion = report.versions.length + 1;
    const stored = await this.storeFile(report.engagementId, report.id, nextVersion, file);

    const version = await this.prisma.reportVersion.create({
      data: {
        reportId,
        versionNumber: nextVersion,
        fileName: stored.fileName,
        fileMimeType: stored.fileMimeType,
        fileSizeBytes: stored.fileSizeBytes,
        objectStorageKey: stored.objectKey,
        sha256Hash: stored.sha256Hash,
        isPasswordProtected: stored.isPasswordProtected,
        uploadedById: actor.id,
        uploadNotes: this.optionalText(input.uploadNotes)
      }
    });
    const updated = await this.prisma.report.update({
      where: { id: reportId },
      data: { currentVersion: nextVersion },
      include: this.reportInclude()
    });

    await this.audit(actor, 'REPORT_VERSION_UPLOADED', 'REPORT_VERSION', version.id, undefined, this.auditVersion(version));
    return this.toReportDto(updated);
  }

  async getVersionStream(reportId: string, versionId: string, actor: CurrentUser, mode: 'view' | 'download') {
    const report = await this.findReportOrThrow(reportId);
    await this.assertEngagementReadable(report.engagementId, actor);
    const version = report.versions.find((entry) => entry.id === versionId);
    if (!version) throw new NotFoundException('Report version not found');
    await this.ensureBucket();
    const body = await this.minio.getObject(this.bucketName, version.objectStorageKey);
    await this.audit(
      actor,
      mode === 'view' ? 'REPORT_VIEWED' : 'REPORT_DOWNLOADED',
      'REPORT_VERSION',
      version.id,
      undefined,
      this.auditVersion(version)
    );
    return {
      body: body as Readable,
      fileName: version.fileName,
      fileMimeType: version.fileMimeType,
      fileSizeBytes: version.fileSizeBytes.toString()
    };
  }

  private async storeFile(engagementId: string, reportId: string, versionNumber: number, file?: Express.Multer.File) {
    this.validatePdf(file);
    const safeName = this.safeFileName(file.originalname);
    const objectKey = `vapt-tracker/engagements/${engagementId}/reports/${reportId}/v${versionNumber}-${safeName}`;
    await this.ensureBucket();
    await this.minio.putObject(this.bucketName, objectKey, file.buffer, file.size, {
      'Content-Type': file.mimetype || 'application/pdf'
    });
    return {
      objectKey,
      fileName: safeName,
      fileMimeType: file.mimetype || 'application/pdf',
      fileSizeBytes: BigInt(file.size),
      sha256Hash: createHash('sha256').update(file.buffer).digest('hex'),
      isPasswordProtected: this.isPdfPasswordProtected(file.buffer)
    } satisfies StoredObject;
  }

  private async ensureBucket() {
    const exists = await this.minio.bucketExists(this.bucketName);
    if (!exists) await this.minio.makeBucket(this.bucketName);
  }

  private async findReportOrThrow(reportId: string) {
    return this.prisma.report.findUniqueOrThrow({
      where: { id: reportId },
      include: this.reportInclude()
    });
  }

  private async assertEngagementReadable(engagementId: string, actor: CurrentUser) {
    void actor;
    await this.prisma.vaptEngagement.findUniqueOrThrow({
      where: { id: engagementId },
      include: { application: true, vendorOrganization: true }
    });
  }

  private async findEngagementForWrite(engagementId: string, actor: CurrentUser) {
    const engagement = await this.prisma.vaptEngagement.findUniqueOrThrow({
      where: { id: engagementId },
      include: { vendorOrganization: true }
    });
    if (actor.role === 'VENDOR_ADMIN' && engagement.vendorOrganizationId !== actor.organizationId) {
      throw new ForbiddenException('Vendor users can upload reports only for their engagements');
    }
    return engagement;
  }

  private async applyReportWorkflow(engagementId: string, currentStatus: string, reportType: ReportType) {
    if (reportType === 'DRAFT_REPORT' && currentStatus === 'APPRISE_ASSESSMENT') {
      await this.prisma.vaptEngagement.update({ where: { id: engagementId }, data: { status: 'DRAFT_REPORT_UPLOADED' } });
    }
    if (reportType === 'FINAL_REPORT' && ['APPRISE_REVALIDATION', 'FINAL_REPORT_UPLOADED'].includes(currentStatus)) {
      await this.prisma.vaptEngagement.update({ where: { id: engagementId }, data: { status: 'FINAL_REPORT_UPLOADED' } });
    }
  }

  private validatePdf(file?: Express.Multer.File): asserts file is Express.Multer.File {
    if (!file) throw new BadRequestException('PDF file is required');
    const isPdf = file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf');
    if (!isPdf) throw new BadRequestException('Only PDF report uploads are supported');
    if (!file.buffer?.length) throw new BadRequestException('Uploaded PDF is empty');
  }

  private rejectPasswordFields(input: Record<string, unknown>) {
    const hasPasswordField = Object.keys(input).some((key) => key.toLowerCase().includes('password'));
    if (hasPasswordField) {
      throw new BadRequestException('PDF passwords must be entered only in the browser viewer and are never submitted');
    }
  }

  private isPdfPasswordProtected(buffer: Buffer) {
    return buffer.includes(Buffer.from('/Encrypt'));
  }

  private requireReportType(value?: string) {
    if (!value || !reportTypes.includes(value as ReportType)) throw new BadRequestException('Invalid report type');
    return value as ReportType;
  }

  private assertCanUpload(actor: CurrentUser) {
    if (!canUploadReports(actor.role)) throw new ForbiddenException('Current role cannot upload reports');
  }

  private requiredText(value: string | undefined, label: string) {
    const trimmed = value?.trim();
    if (!trimmed) throw new BadRequestException(`${label} is required`);
    return trimmed;
  }

  private optionalText(value?: string) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  }

  private safeFileName(value: string) {
    return value.replace(/[^a-zA-Z0-9._-]/g, '_');
  }

  private reportInclude() {
    return {
      createdBy: true,
      versions: { orderBy: { versionNumber: 'desc' }, include: { uploadedBy: true } }
    } as const;
  }

  private toReportDto(report: Awaited<ReturnType<ReportsService['findReportOrThrow']>>) {
    return {
      ...report,
      versions: report.versions.map((version) => ({
        ...version,
        fileSizeBytes: version.fileSizeBytes.toString()
      }))
    };
  }

  private auditReport(report: Awaited<ReturnType<ReportsService['findReportOrThrow']>>) {
    return {
      id: report.id,
      engagementId: report.engagementId,
      reportType: report.reportType,
      title: report.title,
      currentVersion: report.currentVersion,
      immutable: report.immutable
    };
  }

  private auditVersion(version: {
    id: string;
    reportId: string;
    versionNumber: number;
    fileName: string;
    fileMimeType: string;
    fileSizeBytes: bigint;
    sha256Hash: string;
    isPasswordProtected: boolean;
  }) {
    return {
      id: version.id,
      reportId: version.reportId,
      versionNumber: version.versionNumber,
      fileName: version.fileName,
      fileMimeType: version.fileMimeType,
      fileSizeBytes: version.fileSizeBytes.toString(),
      sha256Hash: version.sha256Hash,
      isPasswordProtected: version.isPasswordProtected
    };
  }

  private audit(
    actor: CurrentUser,
    action: string,
    entityType: string,
    entityId: string,
    oldValue: unknown,
    newValue: unknown
  ) {
    return this.prisma.auditLog.create({
      data: {
        userId: actor.id,
        organizationId: actor.organizationId,
        action,
        entityType,
        entityId,
        oldValue: oldValue === undefined ? undefined : JSON.parse(JSON.stringify(oldValue)),
        newValue: JSON.parse(JSON.stringify(newValue))
      }
    });
  }
}
