import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module.js';
import { ApplicationsModule } from './applications/applications.module.js';
import { CalendarModule } from './calendar/calendar.module.js';
import { DatabaseModule } from './database/database.module.js';
import { EngagementsModule } from './engagements/engagements.module.js';
import { HealthModule } from './health/health.module.js';
import { OrganizationsModule } from './organizations/organizations.module.js';
import { ReportsModule } from './reports/reports.module.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    AuthModule,
    HealthModule,
    ApplicationsModule,
    CalendarModule,
    EngagementsModule,
    ReportsModule,
    OrganizationsModule,
    UsersModule
  ]
})
export class AppModule {}
