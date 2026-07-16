import { describe, expect, it } from 'vitest';
import { isProductionDeployment, resolveCorsOrigin, validateProductionEnvironment } from './environment.js';

describe('production environment validation', () => {
  it('does not validate local development mode', () => {
    expect(() => validateProductionEnvironment({ NODE_ENV: 'production' })).not.toThrow();
    expect(isProductionDeployment({ NODE_ENV: 'production' })).toBe(false);
  });

  it('fails clearly when production deployment values are missing', () => {
    expect(() => validateProductionEnvironment({ SECURETRACKER_DEPLOYMENT_MODE: 'production' })).toThrow(
      /DATABASE_URL.*KEYCLOAK_ISSUER_URL.*MINIO_ENDPOINT.*SMTP_HOST.*CORS_ORIGIN or PUBLIC_FRONTEND_URL/
    );
  });

  it('accepts a complete production environment', () => {
    expect(() =>
      validateProductionEnvironment({
        SECURETRACKER_DEPLOYMENT_MODE: 'production',
        DATABASE_URL: 'postgresql://securetracker:secret@postgres:5432/securetracker?schema=public',
        KEYCLOAK_ISSUER_URL: 'https://idp.example.local/realms/securetracker',
        KEYCLOAK_JWKS_URL: 'https://idp.example.local/realms/securetracker/protocol/openid-connect/certs',
        KEYCLOAK_CLIENT_ID: 'securetracker-web',
        MINIO_ENDPOINT: 's3.example.local',
        MINIO_PORT: '443',
        MINIO_BUCKET: 'securetracker-prod',
        MINIO_ACCESS_KEY: 'access-key',
        MINIO_SECRET_KEY: 'secret-key',
        SMTP_HOST: 'smtp.example.local',
        SMTP_PORT: '587',
        SMTP_FROM: 'SecureTracker <securetracker@example.local>',
        PUBLIC_FRONTEND_URL: 'https://securetracker.example.local'
      })
    ).not.toThrow();
  });

  it('resolves CORS origin from production public URL fallback', () => {
    expect(resolveCorsOrigin({ PUBLIC_FRONTEND_URL: 'https://securetracker.example.local' })).toBe(
      'https://securetracker.example.local'
    );
    expect(resolveCorsOrigin({})).toBe(true);
  });
});
