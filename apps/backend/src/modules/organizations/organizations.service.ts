import { Inject, Injectable } from '@nestjs/common';
import type { OrganizationType } from '@securetracker/shared';
import { PrismaService } from '../database/prisma.service.js';
import type { CurrentUser } from '../auth/current-user.types.js';

export interface UpsertOrganizationDto {
  name: string;
  organizationType: OrganizationType;
  status?: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
}

@Injectable()
export class OrganizationsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list() {
    const organizations = await this.prisma.organization.findMany({ orderBy: { name: 'asc' } });
    const userCounts = await this.prisma.user.groupBy({
      by: ['organizationId'],
      _count: { _all: true }
    });
    const engagementCounts = await this.prisma.vaptEngagement.groupBy({
      by: ['vendorOrganizationId'],
      where: { vendorOrganizationId: { not: null } },
      _count: { _all: true }
    });
    const usersByOrganization = new Map(userCounts.map((count) => [count.organizationId, count._count._all]));
    const engagementsByVendor = new Map(
      engagementCounts.map((count) => [count.vendorOrganizationId, count._count._all])
    );
    return organizations.map((organization) => ({
      ...organization,
      _count: {
        users: usersByOrganization.get(organization.id) ?? 0,
        vendorEngagements: engagementsByVendor.get(organization.id) ?? 0
      }
    }));
  }

  async create(input: UpsertOrganizationDto, actor: CurrentUser) {
    const organization = await this.prisma.organization.create({
      data: {
        name: input.name,
        organizationType: input.organizationType,
        status: input.status ?? 'ACTIVE'
      }
    });
    await this.audit(actor, 'ORGANIZATION_CREATED', organization.id, undefined, organization);
    return organization;
  }

  async update(id: string, input: Partial<UpsertOrganizationDto>, actor: CurrentUser) {
    const before = await this.prisma.organization.findUniqueOrThrow({ where: { id } });
    const organization = await this.prisma.organization.update({
      where: { id },
      data: input
    });
    await this.audit(actor, 'ORGANIZATION_UPDATED', organization.id, before, organization);
    return organization;
  }

  private audit(actor: CurrentUser, action: string, entityId: string, oldValue: unknown, newValue: unknown) {
    return this.prisma.auditLog.create({
      data: {
        userId: actor.id,
        organizationId: actor.organizationId,
        action,
        entityType: 'ORGANIZATION',
        entityId,
        oldValue: oldValue === undefined ? undefined : JSON.parse(JSON.stringify(oldValue)),
        newValue: JSON.parse(JSON.stringify(newValue))
      }
    });
  }
}
