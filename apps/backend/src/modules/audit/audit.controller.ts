import { Controller, Get, Inject, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import type { CurrentUser } from '../auth/current-user.types.js';
import { CurrentUserParam } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { AuditService, type AuditQuery } from './audit.service.js';

@Controller('audit-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SYSTEM_ADMIN', 'AUDITOR', 'NBP_SECURITY_ADMIN', 'PAYSYS_SECURITY_ADMIN')
export class AuditController {
  constructor(@Inject(AuditService) private readonly auditService: AuditService) {}

  @Get()
  list(@Query() query: AuditQuery) {
    return this.auditService.list(query);
  }

  @Get('export')
  async export(@Query() query: AuditQuery, @CurrentUserParam() user: CurrentUser, @Res({ passthrough: true }) response: Response) {
    const csv = await this.auditService.exportCsv(query, user);
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader('Content-Disposition', 'attachment; filename="securetracker-audit.csv"');
    return csv;
  }
}
