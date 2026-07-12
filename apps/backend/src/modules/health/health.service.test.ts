import { describe, expect, it } from 'vitest';
import { HealthService } from './health.service.js';

describe('HealthService', () => {
  it('returns the service health contract', () => {
    expect(new HealthService().getHealth()).toMatchObject({
      service: 'securetracker-api',
      status: 'ok',
      version: '0.18.2',
      firstEngagementStatus: 'PLANNED'
    });
  });
});
