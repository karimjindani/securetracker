import { Body, Controller, Get, Inject, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import type { CurrentUser } from '../auth/current-user.types.js';
import { CurrentUserParam } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import {
  EngagementsService,
  type CreateScopingRecordDto,
  type TransitionEngagementDto,
  type UpdateEngagementDto,
  type UpdateScopingRecordDto
} from './engagements.service.js';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class EngagementsController {
  constructor(@Inject(EngagementsService) private readonly engagementsService: EngagementsService) {}

  @Get('engagements')
  list(
    @Query('year') year?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('scheduleHealth') scheduleHealth?: string
  ) {
    return this.engagementsService.list({ year, status, search, scheduleHealth });
  }

  @Get('engagements/:id')
  get(@Param('id') id: string) {
    return this.engagementsService.get(id);
  }

  @Patch('engagements/:id')
  @Roles('SYSTEM_ADMIN', 'PAYSYS_SECURITY_ADMIN')
  update(@Param('id') id: string, @Body() body: UpdateEngagementDto, @CurrentUserParam() user: CurrentUser) {
    return this.engagementsService.update(id, body, user);
  }

  @Post('engagements/:id/transitions')
  @Roles('SYSTEM_ADMIN', 'NBP_SECURITY_ADMIN', 'PAYSYS_SECURITY_ADMIN', 'VENDOR_ADMIN')
  transition(@Param('id') id: string, @Body() body: TransitionEngagementDto, @CurrentUserParam() user: CurrentUser) {
    return this.engagementsService.transition(id, body, user);
  }

  @Get('engagements/:id/scoping-records')
  scopingRecords(@Param('id') id: string) {
    return this.engagementsService.listScopingRecords(id);
  }

  @Post('engagements/:id/scoping-records')
  @Roles('SYSTEM_ADMIN', 'PAYSYS_SECURITY_ADMIN')
  createScopingRecord(
    @Param('id') id: string,
    @Body() body: CreateScopingRecordDto,
    @CurrentUserParam() user: CurrentUser
  ) {
    return this.engagementsService.createScopingRecord(id, body, user);
  }

  @Patch('scoping-records/:id')
  @Roles('SYSTEM_ADMIN', 'PAYSYS_SECURITY_ADMIN')
  updateScopingRecord(
    @Param('id') id: string,
    @Body() body: UpdateScopingRecordDto,
    @CurrentUserParam() user: CurrentUser
  ) {
    return this.engagementsService.updateScopingRecord(id, body, user);
  }

  @Post('scoping-records/:id/finalize')
  @Roles('SYSTEM_ADMIN', 'PAYSYS_SECURITY_ADMIN')
  finalizeScopingRecord(@Param('id') id: string, @CurrentUserParam() user: CurrentUser) {
    return this.engagementsService.finalizeScopingRecord(id, user);
  }
}
