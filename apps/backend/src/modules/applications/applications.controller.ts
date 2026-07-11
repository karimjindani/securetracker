import { Body, Controller, Get, Inject, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import type { CurrentUser } from '../auth/current-user.types.js';
import { CurrentUserParam } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { ApplicationsService, type UpsertApplicationDto } from './applications.service.js';

@Controller('applications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ApplicationsController {
  constructor(@Inject(ApplicationsService) private readonly applicationsService: ApplicationsService) {}

  @Get()
  list(@Query('search') search?: string) {
    return this.applicationsService.list(search);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.applicationsService.get(id);
  }

  @Post()
  @Roles('SYSTEM_ADMIN', 'PAYSYS_SECURITY_ADMIN')
  create(@Body() body: UpsertApplicationDto, @CurrentUserParam() user: CurrentUser) {
    return this.applicationsService.create(body, user);
  }

  @Patch(':id')
  @Roles('SYSTEM_ADMIN', 'PAYSYS_SECURITY_ADMIN')
  update(
    @Param('id') id: string,
    @Body() body: Partial<UpsertApplicationDto>,
    @CurrentUserParam() user: CurrentUser
  ) {
    return this.applicationsService.update(id, body, user);
  }
}
