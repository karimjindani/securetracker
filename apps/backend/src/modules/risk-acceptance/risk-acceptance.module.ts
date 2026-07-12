import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { RiskAcceptanceController } from './risk-acceptance.controller.js';
import { RiskAcceptanceService } from './risk-acceptance.service.js';

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [RiskAcceptanceController],
  providers: [RiskAcceptanceService]
})
export class RiskAcceptanceModule {}
