import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { UserSyncService } from './user-sync.service.js';
import type { CurrentUser } from './current-user.types.js';

type AuthenticatedRequest = {
  headers: { authorization?: string };
  user?: CurrentUser;
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(UserSyncService) private readonly userSyncService: UserSyncService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const tokenUser = await this.authService.validateAuthorizationHeader(request.headers.authorization);
    request.user = await this.userSyncService.syncUser(tokenUser);
    return true;
  }
}
