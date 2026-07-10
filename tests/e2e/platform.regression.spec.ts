import { expect, test } from '@playwright/test';
import { seededUsers } from '../support/seeded-users.js';
import { apiFor } from '../support/api-client.js';
import { isReachable, testConfig } from '../support/test-config.js';

test('platform services respond and API auth is enforced', async ({ request }) => {
  test.skip(!(await isReachable(`${testConfig.apiBaseUrl}/health`)), 'Backend is not running.');

  const health = await request.get(`${testConfig.apiBaseUrl}/health`);
  expect(health.ok()).toBe(true);
  const keycloak = await request.get(`${testConfig.keycloakBaseUrl}/realms/${testConfig.keycloakRealm}`);
  expect(keycloak.ok()).toBe(true);

  const unauthenticatedMe = await request.get(`${testConfig.apiBaseUrl}/me`);
  expect(unauthenticatedMe.status()).toBe(401);
});

test('seeded users can authenticate through Keycloak and /me', async () => {
  test.skip(!(await isReachable(`${testConfig.apiBaseUrl}/health`)), 'Backend is not running.');
  test.skip(!(await isReachable(`${testConfig.keycloakBaseUrl}/realms/${testConfig.keycloakRealm}`)), 'Keycloak is not running.');

  for (const user of Object.values(seededUsers)) {
    const api = await apiFor(user);
    const response = await api.get('/me');
    expect(response.ok()).toBe(true);
    const profile = (await response.json()) as { role: string };
    expect(profile.role).toBe(user.role);
    await api.dispose();
  }
});

test.describe('browser smoke', () => {
  test.skip(process.env.RUN_BROWSER_E2E !== 'true', 'Set RUN_BROWSER_E2E=true to enable browser smoke coverage.');

  test('frontend loads login screen', async ({ page }) => {
    await page.goto(testConfig.frontendBaseUrl);
    await expect(page.getByRole('button', { name: /login with keycloak/i })).toBeVisible();
  });
});
