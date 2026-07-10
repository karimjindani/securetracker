import { NotFoundException } from '@nestjs/common';
import { afterEach, describe, expect, it } from 'vitest';
import { OpsEnabledGuard } from './ops-enabled.guard.js';

describe('OpsEnabledGuard', () => {
  const originalValue = process.env.OPS_ENABLED;

  afterEach(() => {
    process.env.OPS_ENABLED = originalValue;
  });

  it('allows ops endpoints when enabled', () => {
    process.env.OPS_ENABLED = 'true';

    expect(new OpsEnabledGuard().canActivate()).toBe(true);
  });

  it('hides ops endpoints when disabled', () => {
    process.env.OPS_ENABLED = 'false';

    expect(() => new OpsEnabledGuard().canActivate()).toThrow(NotFoundException);
  });
});
