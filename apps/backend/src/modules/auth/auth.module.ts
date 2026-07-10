import { Module } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { MeController } from './me.controller.js';
import { RolesGuard } from './roles.guard.js';
import { UserSyncService } from './user-sync.service.js';

@Module({
  controllers: [MeController],
  providers: [AuthService, UserSyncService, JwtAuthGuard, RolesGuard],
  exports: [AuthService, UserSyncService, JwtAuthGuard, RolesGuard]
})
export class AuthModule {}
