export const testConfig = {
  apiBaseUrl: process.env.API_BASE_URL ?? 'http://localhost:3000',
  frontendBaseUrl: process.env.FRONTEND_BASE_URL ?? 'http://localhost:5173',
  keycloakBaseUrl: process.env.KEYCLOAK_BASE_URL ?? 'http://localhost:18080',
  keycloakRealm: process.env.KEYCLOAK_REALM ?? 'securetracker',
  keycloakClientId: process.env.KEYCLOAK_CLIENT_ID ?? 'securetracker-web',
  regressionPrefix: process.env.REGRESSION_DATA_PREFIX ?? 'REGRESSION_'
};

export async function isReachable(url: string) {
  try {
    const response = await fetch(url);
    return response.ok || response.status < 500;
  } catch {
    return false;
  }
}
