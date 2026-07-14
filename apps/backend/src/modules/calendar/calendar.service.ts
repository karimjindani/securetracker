import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { assessmentTypes, canManageCalendar, type AssessmentType } from '@securetracker/shared';
import type { CurrentUser } from '../auth/current-user.types.js';
import { PrismaService } from '../database/prisma.service.js';

export interface UpsertCalendarEntryDto {
  applicationId: string;
  title: string;
  assessmentType: AssessmentType;
  plannedStartDate?: string;
  plannedEndDate?: string;
  plannedMonth?: string;
  plannedYear: number;
  vendorOrganizationId?: string;
}

@Injectable()
export class CalendarService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private readonly engagementInclude = { application: true, vendorOrganization: true, createdBy: true } as const;

  list(year?: string) {
    const parsedYear = year === undefined ? undefined : Number(year);
    if (year !== undefined && !Number.isInteger(parsedYear)) {
      throw new BadRequestException('Year must be a number');
    }

    return this.prisma.vaptEngagement.findMany({
      where: {
        plannedYear: parsedYear
      },
      orderBy: [{ plannedYear: 'asc' }, { plannedStartDate: 'asc' }, { title: 'asc' }],
      include: this.engagementInclude
    });
  }

  async create(input: UpsertCalendarEntryDto, actor: CurrentUser) {
    this.assertCanManage(actor);
    const data = this.validate(input, true);
    const existing = await this.findExistingPlannedEntry(data);
    if (existing) return existing;
    const engagement = await this.prisma.vaptEngagement.create({
      data: {
        applicationId: data.applicationId as string,
        title: data.title as string,
        assessmentType: data.assessmentType as AssessmentType,
        plannedStartDate: data.plannedStartDate,
        plannedEndDate: data.plannedEndDate,
        plannedMonth: data.plannedMonth,
        plannedYear: data.plannedYear as number,
        vendorOrganizationId: data.vendorOrganizationId,
        status: 'PLANNED',
        createdById: actor.id
      },
      include: this.engagementInclude
    });
    await this.audit(actor, 'CALENDAR_ENTRY_CREATED', engagement.id, undefined, engagement);
    return engagement;
  }

  async update(id: string, input: Partial<UpsertCalendarEntryDto>, actor: CurrentUser) {
    this.assertCanManage(actor);
    const before = await this.prisma.vaptEngagement.findUniqueOrThrow({ where: { id } });
    if (before.status !== 'PLANNED') {
      throw new BadRequestException('Only planned calendar entries can be updated in v0.3.0');
    }
    const data = this.validate(input, false);
    const engagement = await this.prisma.vaptEngagement.update({
      where: { id },
      data,
      include: this.engagementInclude
    });
    await this.audit(actor, 'CALENDAR_ENTRY_UPDATED', engagement.id, before, engagement);
    return engagement;
  }

  private assertCanManage(actor: CurrentUser) {
    if (!canManageCalendar(actor.role)) {
      throw new BadRequestException('Current role cannot manage calendar entries');
    }
  }

  private validate(input: Partial<UpsertCalendarEntryDto>, requireAll: boolean) {
    if (requireAll && !input.applicationId) throw new BadRequestException('Application is required');
    if (requireAll && !input.title?.trim()) throw new BadRequestException('Title is required');
    if (input.title !== undefined && !input.title.trim()) throw new BadRequestException('Title is required');
    if (requireAll && !input.assessmentType) throw new BadRequestException('Assessment type is required');
    if (input.assessmentType !== undefined && !assessmentTypes.includes(input.assessmentType)) {
      throw new BadRequestException('Invalid assessment type');
    }
    if (requireAll && input.plannedYear === undefined) throw new BadRequestException('Planned year is required');
    if (input.plannedYear !== undefined && (!Number.isInteger(input.plannedYear) || input.plannedYear < 2020)) {
      throw new BadRequestException('Planned year must be a valid year');
    }

    const plannedStartDate = this.parseDate(input.plannedStartDate, 'Planned start date');
    const plannedEndDate = this.parseDate(input.plannedEndDate, 'Planned end date');
    if (plannedStartDate && plannedEndDate && plannedEndDate < plannedStartDate) {
      throw new BadRequestException('Planned end date cannot be before planned start date');
    }

    return {
      applicationId: input.applicationId,
      title: input.title === undefined ? undefined : input.title.trim(),
      assessmentType: input.assessmentType,
      plannedStartDate,
      plannedEndDate,
      plannedMonth: input.plannedMonth === undefined ? undefined : this.optionalText(input.plannedMonth),
      plannedYear: input.plannedYear,
      vendorOrganizationId:
        input.vendorOrganizationId === undefined ? undefined : this.optionalText(input.vendorOrganizationId)
    };
  }

  private parseDate(value: string | undefined, label: string) {
    if (value === undefined || value.trim() === '') return undefined;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new BadRequestException(`${label} must be a valid date`);
    return date;
  }

  private optionalText(value?: string) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  }

  private findExistingPlannedEntry(data: ReturnType<CalendarService['validate']>) {
    return this.prisma.vaptEngagement.findFirst({
      where: {
        applicationId: data.applicationId as string,
        title: data.title as string,
        assessmentType: data.assessmentType as AssessmentType,
        plannedYear: data.plannedYear as number,
        plannedMonth: data.plannedMonth ?? null,
        plannedStartDate: data.plannedStartDate ?? null,
        plannedEndDate: data.plannedEndDate ?? null,
        status: 'PLANNED'
      },
      include: this.engagementInclude
    });
  }

  private audit(actor: CurrentUser, action: string, entityId: string, oldValue: unknown, newValue: unknown) {
    return this.prisma.auditLog.create({
      data: {
        userId: actor.id,
        organizationId: actor.organizationId,
        action,
        entityType: 'VAPT_ENGAGEMENT',
        entityId,
        oldValue: oldValue === undefined ? undefined : JSON.parse(JSON.stringify(oldValue)),
        newValue: JSON.parse(JSON.stringify(newValue))
      }
    });
  }
}
