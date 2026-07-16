import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { SettingsModule } from '../settings/settings.module.js';
import { EngagementsController } from './engagements.controller.js';
import { EngagementsService } from './engagements.service.js';

@Module({
  imports: [AuthModule, NotificationsModule, SettingsModule],
  controllers: [EngagementsController],
  providers: [EngagementsService]
})
export class EngagementsModule {}
