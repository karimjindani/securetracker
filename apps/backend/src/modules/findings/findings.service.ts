import { BadRequestException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EvidenceType as PrismaEvidenceType, FindingStatus as PrismaFindingStatus, RevalidationResult as PrismaRevalidationResult } from '@prisma/client';
import { Client as MinioClient } from 'minio';
import { randomUUID } from 'node:crypto';
import {
  canAssignFindings,
  canCreateFindings,
  canRevalidateFindings,
  evidenceTypes,
  findingSeverities,
  findingStatuses,
  revalidationResults,
  type EvidenceType,
  type FindingSeverity,
  type FindingStatus,
  type RevalidationResult
} from '@securetracker/shared';
import type { CurrentUser } from '../auth/current-user.types.js';
import { PrismaService } from '../database/prisma.service.js';

export interface CreateFindingDto {
  sourceReportVersionId?: string;
  findingReference?: string;
  title?: string;
  description?: string;
  impact?: string;
  recommendation?: string;
  severity?: FindingSeverity;
  cvssScore?: string | number;
  cwe?: string;
  owaspCategory?: string;
  dueDate?: string;
}

export type UpdateFindingDto = Partial<CreateFindingDto>;

export interface AssignFindingDto {
  assignedToUserId?: string;
  dueDate?: string;
  comments?: string;
}

export interface UpdateFindingStatusDto {
  targetStatus?: FindingStatus;
  comments?: string;
}

export interface CreateEvidenceDto {
  evidenceType?: EvidenceType;
  title?: string;
  notes?: string;
  jiraReference?: string;
  gitCommitReference?: string;
}

export interface CreateRevalidationDto {
  result?: RevalidationResult;
  revalidationDate?: string;
  remarks?: string;
  reportVersionId?: string;
}

@Injectable()
export class FindingsService {
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
    const findings = await this.prisma.finding.findMany({
      where: { engagementId },
      orderBy: [{ severity: 'asc' }, { createdAt: 'desc' }],
      include: this.findingInclude()
    });
    return findings.map((finding) => this.toFindingDto(finding));
  }

  async get(id: string, actor: CurrentUser) {
    const finding = await this.findFindingOrThrow(id);
    await this.assertEngagementReadable(finding.engagementId, actor);
    return this.toFindingDto(finding);
  }

  listAssignees() {
    return this.prisma.user.findMany({
      where: { role: 'PAYSYS_DEVELOPER', status: 'ACTIVE' },
      orderBy: { fullName: 'asc' },
      select: { id: true, fullName: true, email: true, role: true }
    });
  }

  async create(engagementId: string, input: CreateFindingDto, actor: CurrentUser) {
    if (!canCreateFindings(actor.role)) throw new ForbiddenException('Current role cannot create findings');
    const engagement = await this.findEngagementForWrite(engagementId, actor);
    const data = await this.validateFindingInput(engagementId, input, true);
    const finding = await this.prisma.finding.create({
      data: {
        engagementId,
        sourceReportVersionId: data.sourceReportVersionId,
        findingReference: data.findingReference as string,
        title: data.title as string,
        description: data.description as string,
        impact: data.impact,
        recommendation: data.recommendation,
        severity: data.severity as FindingSeverity,
        cvssScore: data.cvssScore,
        cwe: data.cwe,
        owaspCategory: data.owaspCategory,
        dueDate: data.dueDate,
        status: 'OPEN',
        createdById: actor.id,
        statusHistory: {
          create: { oldStatus: null, newStatus: 'OPEN', changedById: actor.id, comments: 'Finding created' }
        }
      },
      include: this.findingInclude()
    });
    if (engagement.status === 'DRAFT_REPORT_UPLOADED') {
      await this.prisma.vaptEngagement.update({ where: { id: engagementId }, data: { status: 'PAYSYS_TRIAGE' } });
    }
    await this.audit(actor, 'FINDING_CREATED', 'FINDING', finding.id, undefined, this.auditFinding(finding));
    return this.toFindingDto(finding);
  }

  async update(id: string, input: UpdateFindingDto, actor: CurrentUser) {
    const before = await this.findFindingOrThrow(id);
    await this.assertCanModifyFinding(before, actor);
    const data = await this.validateFindingInput(before.engagementId, input, false);
    const finding = await this.prisma.finding.update({ where: { id }, data, include: this.findingInclude() });
    await this.audit(actor, 'FINDING_UPDATED', 'FINDING', finding.id, this.auditFinding(before), this.auditFinding(finding));
    return this.toFindingDto(finding);
  }

  async assign(id: string, input: AssignFindingDto, actor: CurrentUser) {
    if (!canAssignFindings(actor.role)) throw new ForbiddenException('Current role cannot assign findings');
    const before = await this.findFindingOrThrow(id);
    const assigneeId = this.requiredText(input.assignedToUserId, 'Assignee');
    const assignee = await this.prisma.user.findUniqueOrThrow({ where: { id: assigneeId } });
    if (assignee.role !== 'PAYSYS_DEVELOPER') throw new BadRequestException('Findings can be assigned only to Paysys Developers');
    const oldStatus = before.status;
    const finding = await this.prisma.finding.update({
      where: { id },
      data: {
        assignedToUserId: assignee.id,
        dueDate: this.parseDate(input.dueDate, 'Due date'),
        status: 'ASSIGNED',
        statusHistory: {
          create: { oldStatus, newStatus: 'ASSIGNED', changedById: actor.id, comments: this.optionalText(input.comments) }
        }
      },
      include: this.findingInclude()
    });
    if (before.engagement.status === 'PAYSYS_TRIAGE') {
      await this.prisma.vaptEngagement.update({ where: { id: before.engagementId }, data: { status: 'DEVELOPER_FIX' } });
    }
    await this.audit(actor, 'FINDING_ASSIGNED', 'FINDING', finding.id, this.auditFinding(before), this.auditFinding(finding));
    await this.audit(actor, 'FINDING_STATUS_CHANGED', 'FINDING', finding.id, { status: oldStatus }, { status: 'ASSIGNED' });
    return this.toFindingDto(finding);
  }

  async updateStatus(id: string, input: UpdateFindingStatusDto, actor: CurrentUser) {
    const before = await this.findFindingOrThrow(id);
    const targetStatus = this.requireFindingStatus(input.targetStatus);
    this.assertStatusAllowed(before, targetStatus, actor);

    if (before.status === targetStatus && targetStatus === 'FIXED_PENDING_REVALIDATION' && canAssignFindings(actor.role)) {
      await this.prisma.vaptEngagement.update({ where: { id: before.engagementId }, data: { status: 'APPRISE_REVALIDATION' } });
      await this.audit(actor, 'REVALIDATION_REQUESTED', 'FINDING', before.id, undefined, {
        id: before.id,
        status: before.status
      });
      return this.toFindingDto(before);
    }

    const finding = await this.prisma.finding.update({
      where: { id },
      data: {
        status: targetStatus,
        fixedAt: targetStatus === 'FIXED_PENDING_REVALIDATION' ? new Date() : undefined,
        closedAt: targetStatus === 'CLOSED' ? new Date() : undefined,
        closedById: targetStatus === 'CLOSED' ? actor.id : undefined,
        statusHistory: {
          create: {
            oldStatus: before.status,
            newStatus: targetStatus,
            changedById: actor.id,
            comments: this.optionalText(input.comments)
          }
        }
      },
      include: this.findingInclude()
    });

    if (targetStatus === 'FIXED_PENDING_REVALIDATION') {
      await this.prisma.vaptEngagement.update({ where: { id: before.engagementId }, data: { status: 'FIXED_PENDING_REVALIDATION' } });
    }
    await this.audit(actor, 'FINDING_STATUS_CHANGED', 'FINDING', finding.id, { status: before.status }, { status: targetStatus });
    return this.toFindingDto(finding);
  }

  async createEvidence(id: string, input: CreateEvidenceDto, file: Express.Multer.File | undefined, actor: CurrentUser) {
    const finding = await this.findFindingOrThrow(id);
    this.assertCanAddEvidence(finding, actor);
    const evidenceType = this.requireEvidenceType(input.evidenceType);
    const title = this.requiredText(input.title, 'Evidence title');
    const stored = file ? await this.storeEvidenceFile(finding.engagementId, finding.id, file) : undefined;
    const evidence = await this.prisma.findingEvidence.create({
      data: {
        findingId: finding.id,
        evidenceType,
        title,
        notes: this.optionalText(input.notes),
        jiraReference: this.optionalText(input.jiraReference),
        gitCommitReference: this.optionalText(input.gitCommitReference),
        fileObjectKey: stored?.objectKey,
        fileName: stored?.fileName,
        fileMimeType: stored?.fileMimeType,
        fileSizeBytes: stored?.fileSizeBytes,
        uploadedById: actor.id
      },
      include: { uploadedBy: true }
    });
    await this.audit(actor, 'EVIDENCE_UPLOADED', 'FINDING_EVIDENCE', evidence.id, undefined, this.auditEvidence(evidence));
    return this.toEvidenceDto(evidence);
  }

  async createRevalidation(id: string, input: CreateRevalidationDto, actor: CurrentUser) {
    if (!canRevalidateFindings(actor.role)) throw new ForbiddenException('Current role cannot record revalidation');
    const before = await this.findFindingOrThrow(id);
    if (actor.role === 'VENDOR_ADMIN' && before.engagement.vendorOrganizationId !== actor.organizationId) {
      throw new ForbiddenException('Vendor users can revalidate only their engagements');
    }
    const result = this.requireRevalidationResult(input.result);
    if (input.reportVersionId) await this.assertReportVersionBelongsToEngagement(before.engagementId, input.reportVersionId);

    const revalidation = await this.prisma.revalidation.create({
      data: {
        findingId: before.id,
        engagementId: before.engagementId,
        revalidationDate: this.parseDate(input.revalidationDate, 'Revalidation date') ?? new Date(),
        result,
        remarks: this.optionalText(input.remarks),
        performedById: actor.id,
        reportVersionId: this.optionalText(input.reportVersionId)
      }
    });
    const targetStatus = result === 'PASSED' ? 'REVALIDATION_PASSED' : 'REVALIDATION_FAILED';
    const finding = await this.prisma.finding.update({
      where: { id },
      data: {
        status: targetStatus,
        statusHistory: {
          create: {
            oldStatus: before.status,
            newStatus: targetStatus,
            changedById: actor.id,
            comments: this.optionalText(input.remarks)
          }
        }
      },
      include: this.findingInclude()
    });
    if (result === 'FAILED') {
      await this.prisma.vaptEngagement.update({ where: { id: before.engagementId }, data: { status: 'DEVELOPER_FIX' } });
    }
    await this.audit(actor, result === 'PASSED' ? 'REVALIDATION_PASSED' : 'REVALIDATION_FAILED', 'REVALIDATION', revalidation.id, undefined, {
      id: revalidation.id,
      findingId: before.id,
      result
    });
    await this.audit(actor, 'FINDING_STATUS_CHANGED', 'FINDING', finding.id, { status: before.status }, { status: targetStatus });
    return this.toFindingDto(finding);
  }

  private async storeEvidenceFile(engagementId: string, findingId: string, file: Express.Multer.File) {
    if (!file.buffer?.length) throw new BadRequestException('Evidence file is empty');
    const fileName = this.safeFileName(file.originalname);
    const objectKey = `vapt-tracker/engagements/${engagementId}/findings/${findingId}/evidence/${randomUUID()}-${fileName}`;
    await this.ensureBucket();
    await this.minio.putObject(this.bucketName, objectKey, file.buffer, file.size, {
      'Content-Type': file.mimetype || 'application/octet-stream'
    });
    return {
      objectKey,
      fileName,
      fileMimeType: file.mimetype || 'application/octet-stream',
      fileSizeBytes: BigInt(file.size)
    };
  }

  private async ensureBucket() {
    const exists = await this.minio.bucketExists(this.bucketName);
    if (!exists) await this.minio.makeBucket(this.bucketName);
  }

  private async findFindingOrThrow(id: string) {
    return this.prisma.finding.findUniqueOrThrow({ where: { id }, include: this.findingInclude() });
  }

  private async assertEngagementReadable(engagementId: string, actor: CurrentUser) {
    void actor;
    await this.prisma.vaptEngagement.findUniqueOrThrow({ where: { id: engagementId } });
  }

  private async findEngagementForWrite(engagementId: string, actor: CurrentUser) {
    const engagement = await this.prisma.vaptEngagement.findUniqueOrThrow({
      where: { id: engagementId },
      include: { vendorOrganization: true }
    });
    if (actor.role === 'VENDOR_ADMIN' && engagement.vendorOrganizationId !== actor.organizationId) {
      throw new ForbiddenException('Vendor users can create findings only for their engagements');
    }
    return engagement;
  }

  private async validateFindingInput(engagementId: string, input: UpdateFindingDto, requireAll: boolean) {
    const severity = input.severity === undefined ? undefined : this.requireSeverity(input.severity);
    if (input.sourceReportVersionId) await this.assertReportVersionBelongsToEngagement(engagementId, input.sourceReportVersionId);
    if (requireAll && !input.findingReference?.trim()) throw new BadRequestException('Finding reference is required');
    if (requireAll && !input.title?.trim()) throw new BadRequestException('Finding title is required');
    if (requireAll && !input.description?.trim()) throw new BadRequestException('Finding description is required');
    if (requireAll && !severity) throw new BadRequestException('Finding severity is required');
    return {
      sourceReportVersionId: input.sourceReportVersionId === undefined ? undefined : this.optionalText(input.sourceReportVersionId),
      findingReference:
        input.findingReference === undefined ? undefined : this.requiredText(input.findingReference, 'Finding reference'),
      title: input.title === undefined ? undefined : this.requiredText(input.title, 'Finding title'),
      description: input.description === undefined ? undefined : this.requiredText(input.description, 'Finding description'),
      impact: input.impact === undefined ? undefined : this.optionalText(input.impact),
      recommendation: input.recommendation === undefined ? undefined : this.optionalText(input.recommendation),
      severity,
      cvssScore: input.cvssScore === undefined || input.cvssScore === '' ? undefined : this.parseCvss(input.cvssScore),
      cwe: input.cwe === undefined ? undefined : this.optionalText(input.cwe),
      owaspCategory: input.owaspCategory === undefined ? undefined : this.optionalText(input.owaspCategory),
      dueDate: this.parseDate(input.dueDate, 'Due date')
    };
  }

  private assertStatusAllowed(finding: Awaited<ReturnType<FindingsService['findFindingOrThrow']>>, target: FindingStatus, actor: CurrentUser) {
    if (actor.role === 'PAYSYS_DEVELOPER') {
      if (!this.isAssignedDeveloper(finding, actor)) throw new ForbiddenException('Developers can update only assigned findings');
      if (!['IN_PROGRESS', 'FIXED_PENDING_REVALIDATION'].includes(target)) {
        throw new ForbiddenException('Developers can only start work or mark findings fixed pending revalidation');
      }
      return;
    }
    if (target === 'CLOSED' && !['REVALIDATION_PASSED', 'RISK_ACCEPTED'].includes(finding.status)) {
      throw new BadRequestException('Only passed revalidation or accepted risk findings can be closed');
    }
    if (!canAssignFindings(actor.role)) throw new ForbiddenException('Current role cannot update finding status');
  }

  private async assertCanModifyFinding(finding: Awaited<ReturnType<FindingsService['findFindingOrThrow']>>, actor: CurrentUser) {
    if (actor.role === 'PAYSYS_DEVELOPER' && !this.isAssignedDeveloper(finding, actor)) {
      throw new ForbiddenException('Developers can update only assigned findings');
    }
    if (actor.role === 'VENDOR_ADMIN' && finding.engagement.vendorOrganizationId !== actor.organizationId) {
      throw new ForbiddenException('Vendor users can update only their engagement findings');
    }
  }

  private assertCanAddEvidence(finding: Awaited<ReturnType<FindingsService['findFindingOrThrow']>>, actor: CurrentUser) {
    if (actor.role === 'PAYSYS_DEVELOPER' && this.isAssignedDeveloper(finding, actor)) return;
    if (canAssignFindings(actor.role)) return;
    throw new ForbiddenException('Current role cannot add evidence to this finding');
  }

  private isAssignedDeveloper(finding: Awaited<ReturnType<FindingsService['findFindingOrThrow']>>, actor: CurrentUser) {
    return finding.assignedToUserId === actor.id || finding.assignedTo?.email === actor.email;
  }

  private async assertReportVersionBelongsToEngagement(engagementId: string, reportVersionId: string) {
    await this.prisma.reportVersion.findFirstOrThrow({
      where: { id: reportVersionId, report: { engagementId } }
    });
  }

  private findingInclude() {
    return {
      engagement: { include: { application: true, vendorOrganization: true } },
      sourceReportVersion: true,
      assignedTo: true,
      createdBy: true,
      closedBy: true,
      evidence: { orderBy: { uploadedAt: 'desc' }, include: { uploadedBy: true } },
      revalidations: { orderBy: { createdAt: 'desc' }, include: { performedBy: true } },
      riskAcceptances: { orderBy: { requestedAt: 'desc' }, include: { requestedBy: true, reviewedBy: true } },
      statusHistory: { orderBy: { changedAt: 'desc' }, include: { changedBy: true } }
    } as const;
  }

  private requireFindingStatus(value?: string) {
    if (!value || !findingStatuses.includes(value as FindingStatus)) throw new BadRequestException('Invalid finding status');
    return value as FindingStatus;
  }

  private requireSeverity(value?: string) {
    if (!value || !findingSeverities.includes(value as FindingSeverity)) throw new BadRequestException('Invalid severity');
    return value as FindingSeverity;
  }

  private requireEvidenceType(value?: string) {
    if (!value || !evidenceTypes.includes(value as EvidenceType)) throw new BadRequestException('Invalid evidence type');
    return value as PrismaEvidenceType;
  }

  private requireRevalidationResult(value?: string) {
    if (!value || !revalidationResults.includes(value as RevalidationResult)) throw new BadRequestException('Invalid revalidation result');
    return value as PrismaRevalidationResult;
  }

  private parseCvss(value: string | number) {
    const score = Number(value);
    if (!Number.isFinite(score) || score < 0 || score > 10) throw new BadRequestException('CVSS score must be between 0 and 10');
    return score;
  }

  private parseDate(value: string | undefined, label: string) {
    if (value === undefined || value.trim() === '') return undefined;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new BadRequestException(`${label} must be a valid date`);
    return date;
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

  private toFindingDto(finding: Awaited<ReturnType<FindingsService['findFindingOrThrow']>>) {
    return {
      ...finding,
      cvssScore: finding.cvssScore === null ? null : finding.cvssScore.toString(),
      sourceReportVersion:
        finding.sourceReportVersion === null
          ? null
          : {
            ...finding.sourceReportVersion,
            fileSizeBytes: finding.sourceReportVersion.fileSizeBytes.toString()
          },
      evidence: finding.evidence.map((entry) => this.toEvidenceDto(entry)),
      revalidations: finding.revalidations.map((entry) => ({
        ...entry,
        revalidationDate: entry.revalidationDate.toISOString()
      }))
    };
  }

  private toEvidenceDto<T extends { fileSizeBytes: bigint | null }>(evidence: T): Omit<T, 'fileSizeBytes'> & { fileSizeBytes: string | null } {
    return {
      ...evidence,
      fileSizeBytes: evidence.fileSizeBytes === null ? null : evidence.fileSizeBytes.toString()
    };
  }

  private auditFinding(finding: Awaited<ReturnType<FindingsService['findFindingOrThrow']>>) {
    return {
      id: finding.id,
      engagementId: finding.engagementId,
      findingReference: finding.findingReference,
      title: finding.title,
      severity: finding.severity,
      status: finding.status,
      assignedToUserId: finding.assignedToUserId
    };
  }

  private auditEvidence(evidence: { id: string; findingId: string; evidenceType: PrismaEvidenceType; title: string; fileName: string | null }) {
    return {
      id: evidence.id,
      findingId: evidence.findingId,
      evidenceType: evidence.evidenceType,
      title: evidence.title,
      fileName: evidence.fileName
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
