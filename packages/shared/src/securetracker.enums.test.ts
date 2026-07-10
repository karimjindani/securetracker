import { describe, expect, it } from 'vitest';
import { canCloseEngagement, canMoveToGoLive, engagementStatuses } from './securetracker.enums.js';

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
});
