export type EnvironmentMap = Record<string, string | undefined>;

const productionModes = new Set(['production', 'prod']);

export function isProductionDeployment(env: EnvironmentMap = process.env) {
  return productionModes.has((env.SECURETRACKER_DEPLOYMENT_MODE ?? '').toLowerCase());
}

export function validateProductionEnvironment(env: EnvironmentMap = process.env) {
  if (!isProductionDeployment(env)) return;

  const missing = [
    required('DATABASE_URL', env),
    required('KEYCLOAK_ISSUER_URL', env),
    required('KEYCLOAK_JWKS_URL', env),
    required('KEYCLOAK_CLIENT_ID', env),
    required('MINIO_ENDPOINT', env),
    required('MINIO_PORT', env),
    required('MINIO_BUCKET', env),
    requiredAny(['MINIO_ACCESS_KEY', 'MINIO_ROOT_USER'], env),
    requiredAny(['MINIO_SECRET_KEY', 'MINIO_ROOT_PASSWORD'], env),
    required('SMTP_HOST', env),
    required('SMTP_PORT', env),
    required('SMTP_FROM', env),
    requiredAny(['CORS_ORIGIN', 'PUBLIC_FRONTEND_URL'], env)
  ].filter(Boolean);

  if (missing.length > 0) {
    throw new Error(`Production environment validation failed. Missing required value(s): ${missing.join(', ')}`);
  }
}

export function resolveCorsOrigin(env: EnvironmentMap = process.env) {
  return env.CORS_ORIGIN ?? env.PUBLIC_FRONTEND_URL ?? true;
}

function required(key: string, env: EnvironmentMap) {
  return env[key]?.trim() ? undefined : key;
}

function requiredAny(keys: string[], env: EnvironmentMap) {
  return keys.some((key) => env[key]?.trim()) ? undefined : keys.join(' or ');
}
