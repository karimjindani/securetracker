import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { CurrentUser } from '../auth/current-user.types.js';
import { PrismaService } from '../database/prisma.service.js';

export interface UpdateSettingsDto {
  defaultPageSize?: number;
}

export interface PortalSettings {
  defaultPageSize: number;
  pageSizeOptions: number[];
}

const DEFAULT_PAGE_SIZE_KEY = 'DEFAULT_PAGE_SIZE';
const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

@Injectable()
export class SettingsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(): Promise<PortalSettings> {
    const setting = await this.prisma.systemSetting.findUnique({ where: { key: DEFAULT_PAGE_SIZE_KEY } });
    const defaultPageSize = this.parsePageSize(setting?.value);
    return {
      defaultPageSize,
      pageSizeOptions: PAGE_SIZE_OPTIONS
    };
  }

  async update(input: UpdateSettingsDto, actor: CurrentUser): Promise<PortalSettings> {
    if (input.defaultPageSize === undefined) return this.list();
    this.assertPageSize(input.defaultPageSize);

    const before = await this.prisma.systemSetting.findUnique({ where: { key: DEFAULT_PAGE_SIZE_KEY } });
    const setting = await this.prisma.systemSetting.upsert({
      where: { key: DEFAULT_PAGE_SIZE_KEY },
      create: {
        key: DEFAULT_PAGE_SIZE_KEY,
        value: String(input.defaultPageSize),
        updatedById: actor.id
      },
      update: {
        value: String(input.defaultPageSize),
        updatedById: actor.id
      }
    });

    await this.prisma.auditLog.create({
      data: {
        userId: actor.id,
        organizationId: actor.organizationId,
        action: 'SYSTEM_SETTING_UPDATED',
        entityType: 'SYSTEM_SETTING',
        entityId: undefined,
        oldValue: before ? { key: before.key, value: before.value } : undefined,
        newValue: { key: setting.key, value: setting.value }
      }
    });

    return this.list();
  }

  private parsePageSize(value?: string) {
    const parsed = value === undefined ? DEFAULT_PAGE_SIZE : Number(value);
    return PAGE_SIZE_OPTIONS.includes(parsed) ? parsed : DEFAULT_PAGE_SIZE;
  }

  private assertPageSize(value: number) {
    if (!Number.isInteger(value) || !PAGE_SIZE_OPTIONS.includes(value)) {
      throw new BadRequestException(`Default page size must be one of: ${PAGE_SIZE_OPTIONS.join(', ')}`);
    }
  }
}
