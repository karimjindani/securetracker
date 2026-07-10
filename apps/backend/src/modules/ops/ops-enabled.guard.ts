import { CanActivate, Injectable, NotFoundException } from '@nestjs/common';

@Injectable()
export class OpsEnabledGuard implements CanActivate {
  canActivate(): boolean {
    if (process.env.OPS_ENABLED !== 'true') {
      throw new NotFoundException('Ops endpoints are disabled');
    }

    return true;
  }
}
