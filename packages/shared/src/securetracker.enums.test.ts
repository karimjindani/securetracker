import { describe, expect, it } from 'vitest';
import {
  canManageApplications,
  canManageCalendar,
  canManageEngagements,
  canManageScoping,
  canCloseEngagement,
  canManageOrganizations,
  canManageUsers,
  canMoveToGoLive,
  canRequestRiskAcceptance,
  canReviewRiskAcceptance,
  canViewAudit,
  evidenceTypes,
  engagementStatuses,
  findingStatuses,
  navigationByRole,
  riskAcceptanceStatuses
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
    expect(canManageEngagements('NBP_SECURITY_ADMIN')).toBe(true);
    expect(canManageScoping('PAYSYS_SECURITY_ADMIN')).toBe(true);
    expect(canManageScoping('NBP_SECURITY_ADMIN')).toBe(false);
    expect(canManageUsers('SYSTEM_ADMIN')).toBe(true);
    expect(navigationByRole.AUDITOR).toEqual(['dashboard', 'applications', 'calendar', 'engagements', 'audit']);
    expect(navigationByRole.PAYSYS_SECURITY_ADMIN).not.toContain('users');
  });

  it('exposes finding and evidence lifecycle constants', () => {
    expect(findingStatuses).toContain('FIXED_PENDING_REVALIDATION');
    expect(evidenceTypes).toContain('DEPLOYMENT_EVIDENCE');
  });

  it('exposes risk acceptance and audit role helpers', () => {
    expect(riskAcceptanceStatuses).toEqual(['REQUESTED', 'APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED']);
    expect(canRequestRiskAcceptance('PAYSYS_SECURITY_ADMIN')).toBe(true);
    expect(canReviewRiskAcceptance('NBP_SECURITY_ADMIN')).toBe(true);
    expect(canReviewRiskAcceptance('PAYSYS_SECURITY_ADMIN')).toBe(false);
    expect(canViewAudit('AUDITOR')).toBe(true);
  });
});
