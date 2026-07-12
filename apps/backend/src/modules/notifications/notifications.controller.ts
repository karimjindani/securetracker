import { Controller, Get, Inject, Param, Post, UseGuards } from '@nestjs/common';
import type { CurrentUser } from '../auth/current-user.types.js';
import { CurrentUserParam } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { NotificationsService } from './notifications.service.js';

@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotificationsController {
  constructor(@Inject(NotificationsService) private readonly notificationsService: NotificationsService) {}

  @Get()
  list(@CurrentUserParam() user: CurrentUser) {
    return this.notificationsService.listForUser(user);
  }

  @Get('unread-count')
  unreadCount(@CurrentUserParam() user: CurrentUser) {
    return this.notificationsService.unreadCount(user);
  }

  @Post(':id/read')
  markRead(@Param('id') id: string, @CurrentUserParam() user: CurrentUser) {
    return this.notificationsService.markRead(id, user);
  }

  @Post('read-all')
  markAllRead(@CurrentUserParam() user: CurrentUser) {
    return this.notificationsService.markAllRead(user);
  }

  @Post('run-due-checks')
  @Roles('SYSTEM_ADMIN')
  runDueChecks(@CurrentUserParam() user: CurrentUser) {
    return this.notificationsService.runDueChecks(user);
  }
}
