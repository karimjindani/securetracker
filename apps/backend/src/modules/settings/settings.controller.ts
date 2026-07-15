import { Body, Controller, Get, Inject, Patch, UseGuards } from '@nestjs/common';
import type { CurrentUser } from '../auth/current-user.types.js';
import { CurrentUserParam } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { SettingsService, type UpdateSettingsDto } from './settings.service.js';

@Controller('settings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SettingsController {
  constructor(@Inject(SettingsService) private readonly settingsService: SettingsService) {}

  @Get()
  list() {
    return this.settingsService.list();
  }

  @Patch()
  @Roles('SYSTEM_ADMIN')
  update(@Body() body: UpdateSettingsDto, @CurrentUserParam() user: CurrentUser) {
    return this.settingsService.update(body, user);
  }
}
