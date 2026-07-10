import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@securetracker/shared';
import { ROLES_KEY } from './roles.decorator.js';
import type { CurrentUser } from './current-user.types.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles =
      this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [context.getHandler(), context.getClass()]) ?? [];
    if (requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest<{ user?: CurrentUser }>();
    if (!request.user || !requiredRoles.includes(request.user.role)) {
      throw new ForbiddenException('Insufficient role');
    }

    return true;
  }
}
