import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { SettingsModule } from '../settings/settings.module.js';
import { DashboardController } from './dashboard.controller.js';
import { DashboardService } from './dashboard.service.js';

@Module({
  imports: [AuthModule, DatabaseModule, SettingsModule],
  controllers: [DashboardController],
  providers: [DashboardService]
})
export class DashboardModule {}
