import { Body, Controller, Get, Inject, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import type { CurrentUser } from '../auth/current-user.types.js';
import { CurrentUserParam } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { CalendarService, type UpsertCalendarEntryDto } from './calendar.service.js';

@Controller('calendar')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CalendarController {
  constructor(@Inject(CalendarService) private readonly calendarService: CalendarService) {}

  @Get()
  list(@Query('year') year?: string) {
    return this.calendarService.list(year);
  }

  @Post()
  @Roles('SYSTEM_ADMIN', 'NBP_SECURITY_ADMIN', 'PAYSYS_SECURITY_ADMIN')
  create(@Body() body: UpsertCalendarEntryDto, @CurrentUserParam() user: CurrentUser) {
    return this.calendarService.create(body, user);
  }

  @Patch(':id')
  @Roles('SYSTEM_ADMIN', 'NBP_SECURITY_ADMIN', 'PAYSYS_SECURITY_ADMIN')
  update(
    @Param('id') id: string,
    @Body() body: Partial<UpsertCalendarEntryDto>,
    @CurrentUserParam() user: CurrentUser
  ) {
    return this.calendarService.update(id, body, user);
  }
}
