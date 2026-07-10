import { Inject, Injectable } from '@nestjs/common';
import type { CurrentUser, TokenUser } from './current-user.types.js';
import { PrismaService } from '../database/prisma.service.js';

@Injectable()
export class UserSyncService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async syncUser(tokenUser: TokenUser): Promise<CurrentUser> {
    const organization = await this.prisma.organization.upsert({
      where: { name: tokenUser.organizationName },
      update: { organizationType: tokenUser.organizationType },
      create: {
        name: tokenUser.organizationName,
        organizationType: tokenUser.organizationType
      }
    });

    const user = await this.prisma.user.upsert({
      where: { keycloakUserId: tokenUser.keycloakUserId },
      update: {
        email: tokenUser.email,
        fullName: tokenUser.fullName,
        role: tokenUser.role,
        organizationId: organization.id,
        lastLoginAt: new Date()
      },
      create: {
        keycloakUserId: tokenUser.keycloakUserId,
        email: tokenUser.email,
        fullName: tokenUser.fullName,
        role: tokenUser.role,
        organizationId: organization.id,
        lastLoginAt: new Date()
      }
    });

    return {
      id: user.id,
      keycloakUserId: user.keycloakUserId,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      organizationId: organization.id,
      organizationName: organization.name,
      organizationType: organization.organizationType
    };
  }
}
