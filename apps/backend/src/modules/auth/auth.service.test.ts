import { describe, expect, it } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service.js';

describe('AuthService', () => {
  const service = new AuthService(new ConfigService());

  it('maps Keycloak claims to a SecureTracker user', () => {
    expect(
      service.toTokenUser({
        sub: 'kc-1',
        email: 'admin@example.com',
        name: 'NBP Admin',
        realm_access: { roles: ['offline_access', 'NBP_SECURITY_ADMIN'] },
        organization_name: 'NBP',
        organization_type: 'NBP'
      })
    ).toMatchObject({
      keycloakUserId: 'kc-1',
      role: 'NBP_SECURITY_ADMIN',
      organizationName: 'NBP'
    });
  });

  it('rejects tokens without a SecureTracker role', () => {
    expect(() =>
      service.toTokenUser({
        sub: 'kc-2',
        email: 'viewer@example.com',
        realm_access: { roles: ['offline_access'] }
      })
    ).toThrow('Token does not include a SecureTracker role');
  });

  it('rejects requests without bearer tokens', async () => {
    await expect(service.validateAuthorizationHeader()).rejects.toThrow('Missing bearer token');
  });
});
