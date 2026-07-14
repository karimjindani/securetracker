import { BadRequestException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import {
  canCloseEngagement,
  canManageEngagements,
  canManageScoping,
  canMoveToGoLive,
  computeScheduleHealth,
  engagementStatuses,
  isScheduleHealth,
  type AssessmentType,
  type EngagementStatus,
  type ScheduleHealth
} from '@securetracker/shared';
import type { CurrentUser } from '../auth/current-user.types.js';
import { PrismaService } from '../database/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';

export interface ListEngagementsQuery {
  year?: string;
  status?: string;
  search?: string;
  scheduleHealth?: string;
}

export interface UpdateEngagementDto {
  title?: string;
  assessmentType?: AssessmentType;
  plannedStartDate?: string;
  plannedEndDate?: string;
  actualStartDate?: string;
  actualEndDate?: string;
  plannedMonth?: string;
  plannedYear?: number;
  vendorOrganizationId?: string;
}

export interface TransitionEngagementDto {
  targetStatus: EngagementStatus;
  remarks?: string;
}

export interface CreateScopingRecordDto {
  meetingDate: string;
  meetingTime?: string;
  participants: string;
  minutes?: string;
  scopeIncluded: string;
  scopeExcluded?: string;
  testingWindowStart?: string;
  testingWindowEnd?: string;
  testAccountsSummary?: string;
  architectureSummary?: string;
}

export type UpdateScopingRecordDto = Partial<CreateScopingRecordDto>;

const orderedTransitions: Partial<Record<EngagementStatus, EngagementStatus[]>> = {
  PLANNED: ['PAYSYS_APPRISE_INITIATED', 'CANCELLED'],
  PAYSYS_APPRISE_INITIATED: ['APPRISE_ASSESSMENT', 'CANCELLED'],
  APPRISE_ASSESSMENT: ['DRAFT_REPORT_UPLOADED', 'CANCELLED'],
  DRAFT_REPORT_UPLOADED: ['PAYSYS_TRIAGE', 'CANCELLED'],
  PAYSYS_TRIAGE: ['DEVELOPER_FIX', 'CANCELLED'],
  DEVELOPER_FIX: ['FIXED_PENDING_REVALIDATION', 'CANCELLED'],
  FIXED_PENDING_REVALIDATION: ['APPRISE_REVALIDATION', 'CANCELLED'],
  APPRISE_REVALIDATION: ['FINAL_REPORT_UPLOADED', 'DEVELOPER_FIX', 'CANCELLED'],
  FINAL_REPORT_UPLOADED: ['PAYSYS_IS_REVIEW_AND_COMMENT', 'CANCELLED'],
  PAYSYS_IS_REVIEW_AND_COMMENT: ['NBP_IS_REVIEW_CLOSING_MEETING', 'CANCELLED'],
  NBP_IS_REVIEW_CLOSING_MEETING: ['CLOSED', 'CANCELLED'],
  CLOSED: ['GO_LIVE']
};

@Injectable()
export class EngagementsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(NotificationsService) private readonly notifications: NotificationsService
  ) {}

  list(query: ListEngagementsQuery) {
    const parsedYear = query.year === undefined ? undefined : Number(query.year);
    if (query.year !== undefined && !Number.isInteger(parsedYear)) {
      throw new BadRequestException('Year must be a number');
    }
    const status = this.parseStatus(query.status);
    const scheduleHealth = this.parseScheduleHealth(query.scheduleHealth);
    const search = query.search?.trim();

    return this.prisma.vaptEngagement.findMany({
      where: {
        plannedYear: parsedYear,
        status,
        OR: search
          ? [
              { title: { contains: search, mode: 'insensitive' } },
              { application: { name: { contains: search, mode: 'insensitive' } } }
            ]
          : undefined
      },
      orderBy: [{ plannedYear: 'desc' }, { plannedStartDate: 'asc' }, { title: 'asc' }],
      include: {
        application: true,
        vendorOrganization: true,
        createdBy: true,
        scopingRecords: { orderBy: { createdAt: 'desc' } }
      }
    }).then((engagements) =>
      engagements
        .map((engagement) => this.withScheduleHealth(engagement))
        .filter((engagement) => !scheduleHealth || engagement.scheduleHealth === scheduleHealth)
    );
  }

  get(id: string) {
    return this.prisma.vaptEngagement.findUniqueOrThrow({
      where: { id },
      include: {
        application: true,
        vendorOrganization: true,
        createdBy: true,
        scopingRecords: { orderBy: { createdAt: 'desc' } }
      }
    });
  }

  async update(id: string, input: UpdateEngagementDto, actor: CurrentUser) {
    if (!canManageEngagements(actor.role)) throw new ForbiddenException('Current role cannot update engagements');
    const before = await this.prisma.vaptEngagement.findUniqueOrThrow({ where: { id } });
    if (before.status === 'CLOSED' || before.status === 'GO_LIVE') {
      throw new BadRequestException('Closed and Go-Live engagements cannot be edited');
    }
    const data = this.validateEngagementUpdate(input);
    const engagement = await this.prisma.vaptEngagement.update({
      where: { id },
      data,
      include: { application: true, vendorOrganization: true, createdBy: true, scopingRecords: true }
    });
    await this.audit(actor, 'ENGAGEMENT_UPDATED', 'VAPT_ENGAGEMENT', engagement.id, before, engagement);
    return engagement;
  }

  async transition(id: string, input: TransitionEngagementDto, actor: CurrentUser) {
    const targetStatus = this.requireStatus(input.targetStatus);
    const before = await this.prisma.vaptEngagement.findUniqueOrThrow({
      where: { id },
      include: { scopingRecords: true }
    });
    this.assertTransitionAllowed(before.status, targetStatus, actor);

    const engagement = await this.prisma.vaptEngagement.update({
      where: { id },
      data: {
        status: targetStatus,
        actualStartDate:
          targetStatus === 'APPRISE_ASSESSMENT' && before.actualStartDate === null ? new Date() : undefined,
        closedById: targetStatus === 'CLOSED' ? actor.id : undefined,
        closedAt: targetStatus === 'CLOSED' ? new Date() : undefined,
        closureNotes: targetStatus === 'CLOSED' ? this.optionalText(input.remarks) : undefined
      },
      include: { application: true, vendorOrganization: true, createdBy: true, scopingRecords: true }
    });
    await this.audit(actor, 'ENGAGEMENT_STATUS_CHANGED', 'VAPT_ENGAGEMENT', engagement.id, before, engagement, input.remarks);
    await this.notifications.notifyEngagementStatus(engagement.id, targetStatus, actor);
    return engagement;
  }

  listScopingRecords(engagementId: string) {
    return this.prisma.scopingRecord.findMany({
      where: { engagementId },
      orderBy: { createdAt: 'desc' }
    });
  }

  async createScopingRecord(engagementId: string, input: CreateScopingRecordDto, actor: CurrentUser) {
    this.assertCanManageScoping(actor);
    await this.prisma.vaptEngagement.findUniqueOrThrow({ where: { id: engagementId } });
    const data = this.validateScopingRecord(input, true);
    const record = await this.prisma.scopingRecord.create({
      data: {
        engagementId,
        meetingDate: data.meetingDate as Date,
        meetingTime: data.meetingTime,
        participants: data.participants as string,
        minutes: data.minutes,
        scopeIncluded: data.scopeIncluded as string,
        scopeExcluded: data.scopeExcluded,
        testingWindowStart: data.testingWindowStart,
        testingWindowEnd: data.testingWindowEnd,
        testAccountsSummary: data.testAccountsSummary,
        architectureSummary: data.architectureSummary,
        recordStatus: 'DRAFT',
        createdById: actor.id
      }
    });
    await this.audit(actor, 'SCOPING_RECORD_CREATED', 'SCOPING_RECORD', record.id, undefined, record);
    return record;
  }

  async updateScopingRecord(id: string, input: UpdateScopingRecordDto, actor: CurrentUser) {
    this.assertCanManageScoping(actor);
    const before = await this.prisma.scopingRecord.findUniqueOrThrow({ where: { id } });
    if (before.recordStatus === 'FINAL') throw new BadRequestException('Finalized scoping records cannot be edited');
    const data = this.validateScopingRecord(input, false);
    const record = await this.prisma.scopingRecord.update({ where: { id }, data });
    await this.audit(actor, 'SCOPING_RECORD_UPDATED', 'SCOPING_RECORD', record.id, before, record);
    return record;
  }

  async finalizeScopingRecord(id: string, actor: CurrentUser) {
    this.assertCanManageScoping(actor);
    const before = await this.prisma.scopingRecord.findUniqueOrThrow({ where: { id } });
    if (before.recordStatus === 'FINAL') return before;
    const record = await this.prisma.scopingRecord.update({
      where: { id },
      data: { recordStatus: 'FINAL', finalizedAt: new Date(), finalizedById: actor.id }
    });
    await this.audit(actor, 'SCOPING_RECORD_FINALIZED', 'SCOPING_RECORD', record.id, before, record);
    return record;
  }

  private assertTransitionAllowed(current: EngagementStatus, target: EngagementStatus, actor: CurrentUser) {
    if (!orderedTransitions[current]?.includes(target)) {
      throw new BadRequestException(`Cannot transition engagement from ${current} to ${target}`);
    }
    if (target === 'CLOSED') {
      if (!canCloseEngagement(actor.role)) throw new ForbiddenException('Only NBP Security Admin can close engagements');
      return;
    }
    if (current === 'CLOSED' && target === 'GO_LIVE') {
      if (!canMoveToGoLive(actor.role)) throw new ForbiddenException('Only Paysys Security Admin can move to Go-Live');
      return;
    }
    if (
      target === 'APPRISE_ASSESSMENT' &&
      actor.role !== 'SYSTEM_ADMIN' &&
      actor.role !== 'PAYSYS_SECURITY_ADMIN' &&
      actor.role !== 'VENDOR_ADMIN'
    ) {
      throw new ForbiddenException('Only Paysys Security Admin or Vendor Admin can start Apprise assessment');
    }
    if (target === 'CANCELLED' && actor.role !== 'SYSTEM_ADMIN' && actor.role !== 'PAYSYS_SECURITY_ADMIN') {
      throw new ForbiddenException('Only System Admin or Paysys Security Admin can cancel engagements');
    }
    if (actor.role !== 'SYSTEM_ADMIN' && actor.role !== 'PAYSYS_SECURITY_ADMIN' && actor.role !== 'VENDOR_ADMIN') {
      throw new ForbiddenException('Current role cannot transition this engagement');
    }
  }

  private validateEngagementUpdate(input: UpdateEngagementDto) {
    const plannedStartDate = this.parseDate(input.plannedStartDate, 'Planned start date');
    const plannedEndDate = this.parseDate(input.plannedEndDate, 'Planned end date');
    const actualStartDate = this.parseDate(input.actualStartDate, 'Actual start date');
    const actualEndDate = this.parseDate(input.actualEndDate, 'Actual end date');
    if (plannedStartDate && plannedEndDate && plannedEndDate < plannedStartDate) {
      throw new BadRequestException('Planned end date cannot be before planned start date');
    }
    if (actualStartDate && actualEndDate && actualEndDate < actualStartDate) {
      throw new BadRequestException('Actual end date cannot be before actual start date');
    }
    return {
      title: input.title === undefined ? undefined : this.requiredText(input.title, 'Title'),
      assessmentType: input.assessmentType,
      plannedStartDate,
      plannedEndDate,
      actualStartDate,
      actualEndDate,
      plannedMonth: input.plannedMonth === undefined ? undefined : this.optionalText(input.plannedMonth),
      plannedYear: input.plannedYear,
      vendorOrganizationId:
        input.vendorOrganizationId === undefined ? undefined : this.optionalText(input.vendorOrganizationId)
    };
  }

  private validateScopingRecord(input: UpdateScopingRecordDto, requireAll: boolean) {
    const meetingDate = this.parseDate(input.meetingDate, 'Meeting date');
    const testingWindowStart = this.parseDate(input.testingWindowStart, 'Testing window start');
    const testingWindowEnd = this.parseDate(input.testingWindowEnd, 'Testing window end');
    if (testingWindowStart && testingWindowEnd && testingWindowEnd < testingWindowStart) {
      throw new BadRequestException('Testing window end cannot be before start');
    }
    if (requireAll && !meetingDate) throw new BadRequestException('Meeting date is required');
    if (requireAll && !input.participants?.trim()) throw new BadRequestException('Participants are required');
    if (requireAll && !input.scopeIncluded?.trim()) throw new BadRequestException('Included scope is required');
    return {
      meetingDate,
      meetingTime: input.meetingTime === undefined ? undefined : this.optionalText(input.meetingTime),
      participants: input.participants === undefined ? undefined : this.requiredText(input.participants, 'Participants'),
      minutes: input.minutes === undefined ? undefined : this.optionalText(input.minutes),
      scopeIncluded:
        input.scopeIncluded === undefined ? undefined : this.requiredText(input.scopeIncluded, 'Included scope'),
      scopeExcluded: input.scopeExcluded === undefined ? undefined : this.optionalText(input.scopeExcluded),
      testingWindowStart,
      testingWindowEnd,
      testAccountsSummary:
        input.testAccountsSummary === undefined ? undefined : this.optionalText(input.testAccountsSummary),
      architectureSummary:
        input.architectureSummary === undefined ? undefined : this.optionalText(input.architectureSummary)
    };
  }

  private assertCanManageScoping(actor: CurrentUser) {
    if (!canManageScoping(actor.role)) throw new ForbiddenException('Current role cannot manage scoping records');
  }

  private parseStatus(value?: string) {
    if (value === undefined || value.trim() === '') return undefined;
    return this.requireStatus(value);
  }

  private parseScheduleHealth(value?: string) {
    if (value === undefined || value.trim() === '' || value === 'ALL') return undefined;
    if (!isScheduleHealth(value)) throw new BadRequestException('Invalid schedule health');
    return value as ScheduleHealth;
  }

  private withScheduleHealth<T extends { status: EngagementStatus; plannedStartDate?: Date | null; plannedEndDate?: Date | null }>(engagement: T) {
    return {
      ...engagement,
      scheduleHealth: computeScheduleHealth(engagement.status, engagement.plannedStartDate, engagement.plannedEndDate)
    };
  }

  private requireStatus(value: string) {
    if (!engagementStatuses.includes(value as EngagementStatus)) {
      throw new BadRequestException('Invalid engagement status');
    }
    return value as EngagementStatus;
  }

  private parseDate(value: string | undefined, label: string) {
    if (value === undefined || value.trim() === '') return undefined;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new BadRequestException(`${label} must be a valid date`);
    return date;
  }

  private requiredText(value: string, label: string) {
    const trimmed = value.trim();
    if (!trimmed) throw new BadRequestException(`${label} is required`);
    return trimmed;
  }

  private optionalText(value?: string) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  }

  private audit(
    actor: CurrentUser,
    action: string,
    entityType: string,
    entityId: string,
    oldValue: unknown,
    newValue: unknown,
    remarks?: string
  ) {
    return this.prisma.auditLog.create({
      data: {
        userId: actor.id,
        organizationId: actor.organizationId,
        action,
        entityType,
        entityId,
        oldValue: oldValue === undefined ? undefined : JSON.parse(JSON.stringify(oldValue)),
        newValue: JSON.parse(JSON.stringify(newValue)),
        remarks: this.optionalText(remarks)
      }
    });
  }
}
