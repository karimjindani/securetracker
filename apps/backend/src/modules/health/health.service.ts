import { Injectable } from '@nestjs/common';
import { engagementStatuses } from '@securetracker/shared';

@Injectable()
export class HealthService {
  getHealth() {
    return {
      service: 'securetracker-api',
      status: 'ok',
      version: '0.18.6',
      firstEngagementStatus: engagementStatuses[0]
    };
  }
}
