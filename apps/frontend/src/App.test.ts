import { describe, expect, it } from 'vitest';
import { engagementStatuses, navigationByRole } from '@securetracker/shared';

describe('frontend lifecycle contract', () => {
  it('starts at planned and reaches go-live after closure', () => {
    expect(engagementStatuses[0]).toBe('PLANNED');
    expect(engagementStatuses.indexOf('CLOSED')).toBeLessThan(engagementStatuses.indexOf('GO_LIVE'));
  });

  it('shows admin navigation only for administrative roles', () => {
    expect(navigationByRole.SYSTEM_ADMIN).toContain('users');
    expect(navigationByRole.SYSTEM_ADMIN).toContain('ops');
    expect(navigationByRole.AUDITOR).not.toContain('users');
    expect(navigationByRole.AUDITOR).not.toContain('ops');
    expect(navigationByRole.AUDITOR).toContain('applications');
    expect(navigationByRole.AUDITOR).toContain('calendar');
    expect(navigationByRole.AUDITOR).toContain('engagements');
  });
});
