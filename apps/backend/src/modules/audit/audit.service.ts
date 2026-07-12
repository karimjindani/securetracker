import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { CurrentUser } from '../auth/current-user.types.js';
import { PrismaService } from '../database/prisma.service.js';

export interface AuditQuery {
  userId?: string;
  organizationId?: string;
  action?: string;
  entityType?: string;
  dateFrom?: string;
  dateTo?: string;
}

@Injectable()
export class AuditService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  list(query: AuditQuery) {
    return this.prisma.auditLog.findMany({
      where: this.where(query),
      orderBy: { createdAt: 'desc' },
      take: 250,
      include: { user: true }
    });
  }

  async exportCsv(query: AuditQuery, actor: CurrentUser) {
    const rows = await this.prisma.auditLog.findMany({
      where: this.where(query),
      orderBy: { createdAt: 'desc' },
      take: 1000,
      include: { user: true }
    });
    await this.prisma.auditLog.create({
      data: {
        userId: actor.id,
        organizationId: actor.organizationId,
        action: 'AUDIT_EXPORTED',
        entityType: 'AUDIT_LOG',
        newValue: JSON.parse(JSON.stringify({ filters: query, rowCount: rows.length }))
      }
    });
    const header = ['timestamp', 'user', 'organizationId', 'action', 'entityType', 'entityId', 'oldValue', 'newValue', 'ipAddress'];
    const body = rows.map((row) =>
      [
        row.createdAt.toISOString(),
        row.user?.email ?? '',
        row.organizationId ?? '',
        row.action,
        row.entityType,
        row.entityId ?? '',
        JSON.stringify(row.oldValue ?? ''),
        JSON.stringify(row.newValue ?? ''),
        row.ipAddress ?? ''
      ]
        .map((value) => this.csv(value))
        .join(',')
    );
    return [header.join(','), ...body].join('\n');
  }

  private where(query: AuditQuery): Prisma.AuditLogWhereInput {
    return {
      userId: this.optionalText(query.userId),
      organizationId: this.optionalText(query.organizationId),
      action: this.optionalText(query.action),
      entityType: this.optionalText(query.entityType),
      createdAt:
        query.dateFrom || query.dateTo
          ? {
              gte: query.dateFrom ? this.parseDate(query.dateFrom, 'Date from') : undefined,
              lte: query.dateTo ? this.parseDate(query.dateTo, 'Date to') : undefined
            }
          : undefined
    };
  }

  private parseDate(value: string, label: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new BadRequestException(`${label} is invalid`);
    return date;
  }

  private optionalText(value?: string) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  }

  private csv(value: string) {
    return `"${value.replaceAll('"', '""')}"`;
  }
}
