import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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

    const lastLoginAt = new Date();
    const syncData = {
      keycloakUserId: tokenUser.keycloakUserId,
      email: tokenUser.email,
      fullName: tokenUser.fullName,
      role: tokenUser.role,
      organizationId: organization.id,
      lastLoginAt
    };

    const user = await this.upsertUser(syncData);

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

  private async upsertUser(syncData: {
    keycloakUserId: string;
    email: string;
    fullName: string;
    role: TokenUser['role'];
    organizationId: string;
    lastLoginAt: Date;
  }) {
    try {
      return await this.prisma.user.upsert({
        where: { keycloakUserId: syncData.keycloakUserId },
        update: syncData,
        create: syncData
      });
    } catch (error) {
      if (!this.isUniqueEmailConflict(error)) throw error;
      return this.prisma.user.update({
        where: { email: syncData.email },
        data: syncData
      });
    }
  }

  private isUniqueEmailConflict(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002' &&
      Array.isArray(error.meta?.target) &&
      error.meta.target.includes('email')
    );
  }
}
