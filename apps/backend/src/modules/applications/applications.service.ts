import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  applicationCriticalities,
  applicationEnvironments,
  canManageApplications,
  type ApplicationCriticality,
  type ApplicationEnvironment
} from '@securetracker/shared';
import type { CurrentUser } from '../auth/current-user.types.js';
import { PrismaService } from '../database/prisma.service.js';

export interface UpsertApplicationDto {
  name: string;
  description?: string;
  businessOwnerName?: string;
  technicalOwnerName?: string;
  environment: ApplicationEnvironment;
  url?: string;
  criticality: ApplicationCriticality;
  technologyStack?: string;
  internetFacing?: boolean;
  status?: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
}

@Injectable()
export class ApplicationsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  list(search?: string) {
    const query = search?.trim();
    return this.prisma.application.findMany({
      where: query
        ? {
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { businessOwnerName: { contains: query, mode: 'insensitive' } },
              { technicalOwnerName: { contains: query, mode: 'insensitive' } }
            ]
          }
        : undefined,
      orderBy: { name: 'asc' },
      include: { createdBy: true }
    });
  }

  get(id: string) {
    return this.prisma.application.findUniqueOrThrow({
      where: { id },
      include: { createdBy: true, engagements: { orderBy: { createdAt: 'desc' } } }
    });
  }

  async create(input: UpsertApplicationDto, actor: CurrentUser) {
    this.assertCanManage(actor);
    this.validate(input, true);
    const application = await this.prisma.application.create({
      data: {
        name: input.name.trim(),
        description: this.optionalText(input.description),
        businessOwnerName: this.optionalText(input.businessOwnerName),
        technicalOwnerName: this.optionalText(input.technicalOwnerName),
        environment: input.environment,
        url: this.optionalText(input.url),
        criticality: input.criticality,
        technologyStack: this.optionalText(input.technologyStack),
        internetFacing: input.internetFacing ?? false,
        status: input.status ?? 'ACTIVE',
        createdById: actor.id
      }
    });
    await this.audit(actor, 'APPLICATION_CREATED', application.id, undefined, application);
    return application;
  }

  async update(id: string, input: Partial<UpsertApplicationDto>, actor: CurrentUser) {
    this.assertCanManage(actor);
    this.validate(input, false);
    const before = await this.prisma.application.findUniqueOrThrow({ where: { id } });
    const application = await this.prisma.application.update({
      where: { id },
      data: {
        ...input,
        name: input.name === undefined ? undefined : input.name.trim(),
        description: input.description === undefined ? undefined : this.optionalText(input.description),
        businessOwnerName:
          input.businessOwnerName === undefined ? undefined : this.optionalText(input.businessOwnerName),
        technicalOwnerName:
          input.technicalOwnerName === undefined ? undefined : this.optionalText(input.technicalOwnerName),
        url: input.url === undefined ? undefined : this.optionalText(input.url),
        technologyStack:
          input.technologyStack === undefined ? undefined : this.optionalText(input.technologyStack)
      }
    });
    await this.audit(actor, 'APPLICATION_UPDATED', application.id, before, application);
    return application;
  }

  private assertCanManage(actor: CurrentUser) {
    if (!canManageApplications(actor.role)) {
      throw new BadRequestException('Current role cannot manage applications');
    }
  }

  private validate(input: Partial<UpsertApplicationDto>, requireAll: boolean) {
    if (requireAll && !input.name?.trim()) throw new BadRequestException('Application name is required');
    if (input.name !== undefined && !input.name.trim()) throw new BadRequestException('Application name is required');
    if (requireAll && !input.environment) throw new BadRequestException('Environment is required');
    if (input.environment !== undefined && !applicationEnvironments.includes(input.environment)) {
      throw new BadRequestException('Invalid application environment');
    }
    if (requireAll && !input.criticality) throw new BadRequestException('Criticality is required');
    if (input.criticality !== undefined && !applicationCriticalities.includes(input.criticality)) {
      throw new BadRequestException('Invalid application criticality');
    }
  }

  private optionalText(value?: string) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  }

  private audit(actor: CurrentUser, action: string, entityId: string, oldValue: unknown, newValue: unknown) {
    return this.prisma.auditLog.create({
      data: {
        userId: actor.id,
        organizationId: actor.organizationId,
        action,
        entityType: 'APPLICATION',
        entityId,
        oldValue: oldValue === undefined ? undefined : JSON.parse(JSON.stringify(oldValue)),
        newValue: JSON.parse(JSON.stringify(newValue))
      }
    });
  }
}
