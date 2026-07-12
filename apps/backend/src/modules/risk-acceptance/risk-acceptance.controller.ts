import { Body, Controller, Get, Inject, Param, Post, UseGuards } from '@nestjs/common';
import type { CurrentUser } from '../auth/current-user.types.js';
import { CurrentUserParam } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import {
  RiskAcceptanceService,
  type CreateRiskAcceptanceDto,
  type ReviewRiskAcceptanceDto
} from './risk-acceptance.service.js';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class RiskAcceptanceController {
  constructor(@Inject(RiskAcceptanceService) private readonly riskAcceptanceService: RiskAcceptanceService) {}

  @Get('risk-acceptances')
  list(@CurrentUserParam() user: CurrentUser) {
    return this.riskAcceptanceService.list(user);
  }

  @Get('findings/:id/risk-acceptances')
  listForFinding(@Param('id') findingId: string, @CurrentUserParam() user: CurrentUser) {
    return this.riskAcceptanceService.listForFinding(findingId, user);
  }

  @Post('findings/:id/risk-acceptances')
  @Roles('SYSTEM_ADMIN', 'PAYSYS_SECURITY_ADMIN')
  request(@Param('id') findingId: string, @Body() body: CreateRiskAcceptanceDto, @CurrentUserParam() user: CurrentUser) {
    return this.riskAcceptanceService.request(findingId, body, user);
  }

  @Post('risk-acceptances/:id/review')
  @Roles('NBP_SECURITY_ADMIN')
  review(@Param('id') id: string, @Body() body: ReviewRiskAcceptanceDto, @CurrentUserParam() user: CurrentUser) {
    return this.riskAcceptanceService.review(id, body, user);
  }
}
