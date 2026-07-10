import { describe, expect, it } from 'vitest';
import { HealthService } from './health.service.js';

describe('HealthService', () => {
  it('returns the v0.1.0 service contract', () => {
    expect(new HealthService().getHealth()).toMatchObject({
      service: 'securetracker-api',
      status: 'ok',
      version: '0.2.0',
      firstEngagementStatus: 'PLANNED'
    });
  });
});
