import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuditModule } from './audit/audit.module.js';
import { AuthModule } from './auth/auth.module.js';
import { ApplicationsModule } from './applications/applications.module.js';
import { CalendarModule } from './calendar/calendar.module.js';
import { DashboardModule } from './dashboard/dashboard.module.js';
import { DatabaseModule } from './database/database.module.js';
import { EngagementsModule } from './engagements/engagements.module.js';
import { FindingsModule } from './findings/findings.module.js';
import { HealthModule } from './health/health.module.js';
import { OrganizationsModule } from './organizations/organizations.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { ReportsModule } from './reports/reports.module.js';
import { RiskAcceptanceModule } from './risk-acceptance/risk-acceptance.module.js';
import { SettingsModule } from './settings/settings.module.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    AuditModule,
    AuthModule,
    HealthModule,
    DashboardModule,
    ApplicationsModule,
    CalendarModule,
    EngagementsModule,
    FindingsModule,
    ReportsModule,
    RiskAcceptanceModule,
    NotificationsModule,
    SettingsModule,
    OrganizationsModule,
    UsersModule
  ]
})
export class AppModule {}
