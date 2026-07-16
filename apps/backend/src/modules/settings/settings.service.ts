import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CurrentUser } from '../auth/current-user.types.js';
import { PrismaService } from '../database/prisma.service.js';

export interface UpdateSettingsDto {
  defaultPageSize?: number;
  scheduleHealthWarningDays?: number;
  notificationReminderDays?: number;
  riskAcceptanceExpiryReminderDays?: number;
  notificationsEmailEnabled?: boolean;
  notificationsSchedulerEnabled?: boolean;
  auditRetentionDays?: number;
}

export interface PortalSettings extends Required<UpdateSettingsDto> {
  pageSizeOptions: number[];
}

type SettingDefinition<T extends keyof UpdateSettingsDto> = {
  key: string;
  dtoKey: T;
  defaultValue: UpdateSettingsDto[T];
  parse: (value: string | undefined) => UpdateSettingsDto[T];
  serialize: (value: UpdateSettingsDto[T]) => string;
  assert: (value: UpdateSettingsDto[T]) => void;
};

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

@Injectable()
export class SettingsService {
  private readonly definitions: SettingDefinition<keyof UpdateSettingsDto>[];

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService) private readonly config: ConfigService
  ) {
    this.definitions = [
      this.integerDefinition('DEFAULT_PAGE_SIZE', 'defaultPageSize', 10, PAGE_SIZE_OPTIONS),
      this.integerDefinition('SCHEDULE_HEALTH_WARNING_DAYS', 'scheduleHealthWarningDays', 7, { min: 1, max: 30 }),
      this.integerDefinition(
        'NOTIFICATION_REMINDER_DAYS',
        'notificationReminderDays',
        Number(this.config.get<string>('NOTIFICATION_REMINDER_DAYS') ?? 7),
        { min: 1, max: 60 }
      ),
      this.integerDefinition(
        'RISK_ACCEPTANCE_EXPIRY_REMINDER_DAYS',
        'riskAcceptanceExpiryReminderDays',
        Number(this.config.get<string>('RISK_ACCEPTANCE_EXPIRY_REMINDER_DAYS') ?? 14),
        { min: 1, max: 90 }
      ),
      this.booleanDefinition(
        'NOTIFICATIONS_EMAIL_ENABLED',
        'notificationsEmailEnabled',
        (this.config.get<string>('NOTIFICATIONS_EMAIL_ENABLED') ?? 'true') !== 'false'
      ),
      this.booleanDefinition(
        'NOTIFICATIONS_SCHEDULER_ENABLED',
        'notificationsSchedulerEnabled',
        (this.config.get<string>('NOTIFICATIONS_SCHEDULER_ENABLED') ?? 'false') === 'true'
      ),
      this.integerDefinition('AUDIT_RETENTION_DAYS', 'auditRetentionDays', 365, { min: 30, max: 3650 })
    ];
  }

  async list(): Promise<PortalSettings> {
    const rows = await this.prisma.systemSetting.findMany({
      where: { key: { in: this.definitions.map((definition) => definition.key) } }
    });
    const rowByKey = new Map(rows.map((row) => [row.key, row.value]));
    const settings = Object.fromEntries(
      this.definitions.map((definition) => [definition.dtoKey, definition.parse(rowByKey.get(definition.key))])
    ) as Required<UpdateSettingsDto>;
    return { ...settings, pageSizeOptions: PAGE_SIZE_OPTIONS };
  }

  async update(input: UpdateSettingsDto, actor: CurrentUser): Promise<PortalSettings> {
    const changedDefinitions = this.definitions.filter((definition) => input[definition.dtoKey] !== undefined);
    if (changedDefinitions.length === 0) return this.list();

    for (const definition of changedDefinitions) {
      definition.assert(input[definition.dtoKey]);
    }

    for (const definition of changedDefinitions) {
      const nextValue = definition.serialize(input[definition.dtoKey]);
      const before = await this.prisma.systemSetting.findUnique({ where: { key: definition.key } });
      const setting = await this.prisma.systemSetting.upsert({
        where: { key: definition.key },
        create: {
          key: definition.key,
          value: nextValue,
          updatedById: actor.id
        },
        update: {
          value: nextValue,
          updatedById: actor.id
        }
      });
      await this.prisma.auditLog.create({
        data: {
          userId: actor.id,
          organizationId: actor.organizationId,
          action: 'SYSTEM_SETTING_UPDATED',
          entityType: 'SYSTEM_SETTING',
          oldValue: before ? { key: before.key, value: before.value } : undefined,
          newValue: { key: setting.key, value: setting.value }
        }
      });
    }

    return this.list();
  }

  private integerDefinition(
    key: string,
    dtoKey: keyof UpdateSettingsDto,
    defaultValue: number,
    allowed: number[] | { min: number; max: number }
  ): SettingDefinition<keyof UpdateSettingsDto> {
    return {
      key,
      dtoKey,
      defaultValue,
      parse: (value) => {
        const parsed = value === undefined ? defaultValue : Number(value);
        return this.isAllowedInteger(parsed, allowed) ? parsed : defaultValue;
      },
      serialize: (value) => String(value),
      assert: (value) => {
        if (typeof value !== 'number' || !this.isAllowedInteger(value, allowed)) {
          const range = Array.isArray(allowed) ? allowed.join(', ') : `${allowed.min}-${allowed.max}`;
          throw new BadRequestException(`${key} must be one of: ${range}`);
        }
      }
    };
  }

  private booleanDefinition(
    key: string,
    dtoKey: keyof UpdateSettingsDto,
    defaultValue: boolean
  ): SettingDefinition<keyof UpdateSettingsDto> {
    return {
      key,
      dtoKey,
      defaultValue,
      parse: (value) => (value === undefined ? defaultValue : value === 'true'),
      serialize: (value) => String(value),
      assert: (value) => {
        if (typeof value !== 'boolean') throw new BadRequestException(`${key} must be true or false`);
      }
    };
  }

  private isAllowedInteger(value: number, allowed: number[] | { min: number; max: number }) {
    if (!Number.isInteger(value)) return false;
    return Array.isArray(allowed) ? allowed.includes(value) : value >= allowed.min && value <= allowed.max;
  }
}
