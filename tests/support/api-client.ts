import { request, type APIRequestContext } from '@playwright/test';
import type { SeededUser } from './seeded-users.js';
import { testConfig } from './test-config.js';

export async function getAccessToken(user: SeededUser) {
  const response = await fetch(
    `${testConfig.keycloakBaseUrl}/realms/${testConfig.keycloakRealm}/protocol/openid-connect/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'password',
        client_id: testConfig.keycloakClientId,
        username: user.username,
        password: user.password
      })
    }
  );

  if (!response.ok) {
    throw new Error(`Keycloak token request failed: ${response.status}`);
  }

  const body = (await response.json()) as { access_token: string };
  return body.access_token;
}

export async function apiFor(user: SeededUser): Promise<APIRequestContext> {
  const token = await getAccessToken(user);
  return request.newContext({
    baseURL: testConfig.apiBaseUrl,
    extraHTTPHeaders: { Authorization: `Bearer ${token}` }
  });
}
