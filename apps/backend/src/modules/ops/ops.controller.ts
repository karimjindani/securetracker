import { Controller, Get, Inject, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { OpsEnabledGuard } from './ops-enabled.guard.js';
import { OpsService } from './ops.service.js';

@Controller('ops')
@UseGuards(OpsEnabledGuard, JwtAuthGuard, RolesGuard)
@Roles('SYSTEM_ADMIN')
export class OpsController {
  constructor(@Inject(OpsService) private readonly opsService: OpsService) {}

  @Get('health')
  health() {
    return this.opsService.health();
  }

  @Get('containers')
  containers() {
    return this.opsService.containers();
  }

  @Post('regression/run')
  runRegression() {
    return this.opsService.startRegressionRun();
  }

  @Get('regression/runs/:id')
  getRegressionRun(@Param('id') id: string) {
    return this.opsService.getRegressionRun(id);
  }

  @Post('test-data/cleanup')
  cleanupRegressionData() {
    return this.opsService.cleanupRegressionData();
  }

  @Post('reset')
  resetToSeededData() {
    return this.opsService.resetToSeededData();
  }
}
