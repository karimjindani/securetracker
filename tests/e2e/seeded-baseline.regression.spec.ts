import { expect, test } from '@playwright/test';
import { apiFor } from '../support/api-client.js';
import { seededUsers } from '../support/seeded-users.js';
import { isReachable, testConfig } from '../support/test-config.js';

test.beforeEach(async () => {
  test.skip(!(await isReachable(`${testConfig.apiBaseUrl}/health`)), 'Backend is not running.');
});

test('seeded validation baseline exposes organizations, users, applications, calendar, and Kanban data', async () => {
  const systemApi = await apiFor(seededUsers.systemAdmin);
  const auditorApi = await apiFor(seededUsers.auditor);
  const currentYear = new Date().getFullYear();

  const organizationsResponse = await systemApi.get('/organizations');
  expect(organizationsResponse.ok(), await organizationsResponse.text()).toBe(true);
  const organizations = (await organizationsResponse.json()) as Array<{ name: string; _count?: { users: number; vendorEngagements: number } }>;
  const seededOrganizationNames = organizations
    .map((organization) => organization.name)
    .filter((name) => ['Apprise', 'NBP', 'Paysys Labs'].includes(name))
    .sort();
  expect(seededOrganizationNames).toEqual(['Apprise', 'NBP', 'Paysys Labs']);
  expect(organizations.map((organization) => organization.name)).not.toContain('Platform');
  expect(organizations.find((organization) => organization.name === 'Apprise')?._count?.vendorEngagements).toBeGreaterThanOrEqual(50);

  const usersResponse = await systemApi.get('/users');
  expect(usersResponse.ok(), await usersResponse.text()).toBe(true);
  const users = (await usersResponse.json()) as Array<{ email: string; organization?: { name: string } }>;
  expect(users).toEqual(expect.arrayContaining([
    expect.objectContaining({ email: 'system.admin@example.local', organization: expect.objectContaining({ name: 'Paysys Labs' }) }),
    expect.objectContaining({ email: 'apprise.vendor@example.local', organization: expect.objectContaining({ name: 'Apprise' }) }),
    expect.objectContaining({ email: 'auditor@example.local', organization: expect.objectContaining({ name: 'NBP' }) })
  ]));

  const auditorUsers = await auditorApi.get('/users');
  expect(auditorUsers.status()).toBe(403);

  const applicationsResponse = await systemApi.get('/applications');
  expect(applicationsResponse.ok(), await applicationsResponse.text()).toBe(true);
  const applications = (await applicationsResponse.json()) as Array<{ id: string; name: string }>;
  const seededApplications = applications.filter((application) => application.name.startsWith('Seeded '));
  expect(seededApplications).toHaveLength(25);

  const calendarResponse = await systemApi.get(`/calendar?year=${currentYear}`);
  expect(calendarResponse.ok(), await calendarResponse.text()).toBe(true);
  const calendar = (await calendarResponse.json()) as Array<{
    application: { id: string; name: string };
    assessmentType: string;
    plannedStartDate: string;
    plannedYear: number;
    status: string;
  }>;
  const seededWhitebox = calendar.filter((entry) => entry.application.name.startsWith('Seeded ') && entry.assessmentType === 'WHITEBOX');
  expect(seededWhitebox).toHaveLength(50);
  expect(seededWhitebox.some((entry) => entry.status !== 'PLANNED')).toBe(true);

  for (const application of seededApplications) {
    const entries = seededWhitebox
      .filter((entry) => entry.application.id === application.id)
      .sort((a, b) => new Date(a.plannedStartDate).getTime() - new Date(b.plannedStartDate).getTime());
    expect(entries, application.name).toHaveLength(2);
    const first = new Date(entries[0].plannedStartDate);
    const second = new Date(entries[1].plannedStartDate);
    expect(second.getUTCMonth() - first.getUTCMonth()).toBe(6);
  }

  const monthlyCounts = new Map<number, number>();
  for (const entry of seededWhitebox) {
    const month = new Date(entry.plannedStartDate).getUTCMonth();
    monthlyCounts.set(month, (monthlyCounts.get(month) ?? 0) + 1);
  }
  expect([...monthlyCounts.values()].every((count) => count <= 5)).toBe(true);

  const engagementsResponse = await systemApi.get(`/engagements?year=${currentYear}`);
  expect(engagementsResponse.ok(), await engagementsResponse.text()).toBe(true);
  const engagements = (await engagementsResponse.json()) as Array<{ title: string; status: string; scopingRecords?: unknown[] }>;
  const seededEngagements = engagements.filter((engagement) => engagement.title.startsWith('Seeded '));
  expect(seededEngagements).toHaveLength(50);
  expect(seededEngagements).toEqual(expect.arrayContaining([
    expect.objectContaining({ status: 'PAYSYS_APPRISE_INITIATED' }),
    expect.objectContaining({ status: 'APPRISE_ASSESSMENT' }),
    expect.objectContaining({ status: 'DEVELOPER_FIX' }),
    expect.objectContaining({ status: 'CLOSED' }),
    expect.objectContaining({ status: 'GO_LIVE' })
  ]));
  expect(seededEngagements.some((engagement) => (engagement.scopingRecords?.length ?? 0) > 0)).toBe(true);
});
