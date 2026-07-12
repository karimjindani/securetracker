import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { FindingsController } from './findings.controller.js';
import { FindingsService } from './findings.service.js';

@Module({
  imports: [AuthModule, ConfigModule, DatabaseModule, NotificationsModule],
  controllers: [FindingsController],
  providers: [FindingsService]
})
export class FindingsModule {}
