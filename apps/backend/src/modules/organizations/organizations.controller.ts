import { Body, Controller, Get, Inject, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { CurrentUserParam } from '../auth/current-user.decorator.js';
import type { CurrentUser } from '../auth/current-user.types.js';
import { OrganizationsService, type UpsertOrganizationDto } from './organizations.service.js';

@Controller('organizations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrganizationsController {
  constructor(@Inject(OrganizationsService) private readonly organizationsService: OrganizationsService) {}

  @Get()
  list() {
    return this.organizationsService.list();
  }

  @Post()
  @Roles('SYSTEM_ADMIN')
  create(@Body() body: UpsertOrganizationDto, @CurrentUserParam() user: CurrentUser) {
    return this.organizationsService.create(body, user);
  }

  @Patch(':id')
  @Roles('SYSTEM_ADMIN')
  update(@Param('id') id: string, @Body() body: Partial<UpsertOrganizationDto>, @CurrentUserParam() user: CurrentUser) {
    return this.organizationsService.update(id, body, user);
  }
}
