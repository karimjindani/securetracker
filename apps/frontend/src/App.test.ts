import { describe, expect, it } from 'vitest';
import { engagementStatuses } from '@securetracker/shared';

describe('frontend lifecycle contract', () => {
  it('starts at planned and reaches go-live after closure', () => {
    expect(engagementStatuses[0]).toBe('PLANNED');
    expect(engagementStatuses.indexOf('CLOSED')).toBeLessThan(engagementStatuses.indexOf('GO_LIVE'));
  });
});
