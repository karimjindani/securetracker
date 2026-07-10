import { Inject, Injectable } from '@nestjs/common';
import type { Role } from '@securetracker/shared';
import { PrismaService } from '../database/prisma.service.js';
import type { CurrentUser } from '../auth/current-user.types.js';

export interface UpsertUserDto {
  organizationId: string;
  keycloakUserId: string;
  fullName: string;
  email: string;
  role: Role;
  status?: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
}

@Injectable()
export class UsersService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.user.findMany({
      orderBy: { fullName: 'asc' },
      include: { organization: true }
    });
  }

  async create(input: UpsertUserDto, actor: CurrentUser) {
    const user = await this.prisma.user.create({
      data: {
        organizationId: input.organizationId,
        keycloakUserId: input.keycloakUserId,
        fullName: input.fullName,
        email: input.email,
        role: input.role,
        status: input.status ?? 'ACTIVE'
      }
    });
    await this.audit(actor, 'USER_CREATED', user.id, undefined, user);
    return user;
  }

  async update(id: string, input: Partial<UpsertUserDto>, actor: CurrentUser) {
    const before = await this.prisma.user.findUniqueOrThrow({ where: { id } });
    const user = await this.prisma.user.update({ where: { id }, data: input });
    await this.audit(actor, 'USER_UPDATED', user.id, before, user);
    return user;
  }

  private audit(actor: CurrentUser, action: string, entityId: string, oldValue: unknown, newValue: unknown) {
    return this.prisma.auditLog.create({
      data: {
        userId: actor.id,
        organizationId: actor.organizationId,
        action,
        entityType: 'USER',
        entityId,
        oldValue: oldValue === undefined ? undefined : JSON.parse(JSON.stringify(oldValue)),
        newValue: JSON.parse(JSON.stringify(newValue))
      }
    });
  }
}
