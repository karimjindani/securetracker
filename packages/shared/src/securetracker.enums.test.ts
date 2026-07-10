import { describe, expect, it } from 'vitest';
import {
  canManageApplications,
  canManageCalendar,
  canAccessOps,
  canCloseEngagement,
  canManageOrganizations,
  canMoveToGoLive,
  engagementStatuses,
  navigationByRole
} from './securetracker.enums.js';

describe('securetracker shared enums', () => {
  it('keeps the documented engagement lifecycle order', () => {
    expect(engagementStatuses.slice(0, 3)).toEqual([
      'PLANNED',
      'PAYSYS_APPRISE_INITIATED',
      'APPRISE_ASSESSMENT'
    ]);
    expect(engagementStatuses.at(-3)).toBe('CLOSED');
    expect(engagementStatuses.at(-2)).toBe('GO_LIVE');
  });

  it('enforces closure and go-live role boundaries', () => {
    expect(canCloseEngagement('NBP_SECURITY_ADMIN')).toBe(true);
    expect(canCloseEngagement('PAYSYS_SECURITY_ADMIN')).toBe(false);
    expect(canMoveToGoLive('PAYSYS_SECURITY_ADMIN')).toBe(true);
  });

  it('limits administration helpers and navigation', () => {
    expect(canManageOrganizations('SYSTEM_ADMIN')).toBe(true);
    expect(canManageOrganizations('AUDITOR')).toBe(false);
    expect(canManageApplications('PAYSYS_SECURITY_ADMIN')).toBe(true);
    expect(canManageApplications('AUDITOR')).toBe(false);
    expect(canManageCalendar('NBP_SECURITY_ADMIN')).toBe(true);
    expect(canAccessOps('SYSTEM_ADMIN')).toBe(true);
    expect(canAccessOps('NBP_SECURITY_ADMIN')).toBe(false);
    expect(navigationByRole.AUDITOR).toEqual(['dashboard', 'applications', 'calendar']);
  });
});
