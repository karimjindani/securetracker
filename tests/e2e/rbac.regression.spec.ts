import { expect, test } from '@playwright/test';
import { apiFor } from '../support/api-client.js';
import { regressionName } from '../support/factories.js';
import { seededUsers } from '../support/seeded-users.js';
import { isReachable, testConfig } from '../support/test-config.js';

test.beforeEach(async () => {
  test.skip(!(await isReachable(`${testConfig.apiBaseUrl}/health`)), 'Backend is not running.');
});

test('organization and user writes are restricted to System Admin', async () => {
  const systemApi = await apiFor(seededUsers.systemAdmin);
  const auditorApi = await apiFor(seededUsers.auditor);

  const organization = await systemApi.post('/organizations', {
    data: { name: regressionName('ORG'), organizationType: 'AUDITOR' }
  });
  expect(organization.ok(), await organization.text()).toBe(true);

  const forbiddenOrganization = await auditorApi.post('/organizations', {
    data: { name: regressionName('AUDITOR_ORG'), organizationType: 'AUDITOR' }
  });
  expect(forbiddenOrganization.status()).toBe(403);

  await systemApi.dispose();
  await auditorApi.dispose();
});

test('system settings are visible to authenticated users and writable only by System Admin', async () => {
  const systemApi = await apiFor(seededUsers.systemAdmin);
  const auditorApi = await apiFor(seededUsers.auditor);

  const settings = await auditorApi.get('/settings');
  expect(settings.ok(), await settings.text()).toBe(true);
  expect(await settings.json()).toEqual(expect.objectContaining({
    defaultPageSize: expect.any(Number),
    pageSizeOptions: expect.arrayContaining([10, 25, 50, 100])
  }));

  const forbiddenUpdate = await auditorApi.patch('/settings', { data: { defaultPageSize: 25 } });
  expect(forbiddenUpdate.status()).toBe(403);

  const update = await systemApi.patch('/settings', { data: { defaultPageSize: 25 } });
  expect(update.ok(), await update.text()).toBe(true);
  expect(await update.json()).toEqual(expect.objectContaining({ defaultPageSize: 25 }));

  const invalidUpdate = await systemApi.patch('/settings', { data: { defaultPageSize: 7 } });
  expect(invalidUpdate.status()).toBe(400);

  await systemApi.dispose();
  await auditorApi.dispose();
});

test('application and calendar permissions follow documented roles', async () => {
  const paysysApi = await apiFor(seededUsers.paysysAdmin);
  const nbpApi = await apiFor(seededUsers.nbpAdmin);
  const auditorApi = await apiFor(seededUsers.auditor);

  const application = await paysysApi.post('/applications', {
    data: {
      name: regressionName('APP'),
      environment: 'PRODUCTION',
      criticality: 'HIGH',
      internetFacing: true
    }
  });
  expect(application.ok(), await application.text()).toBe(true);
  const applicationBody = (await application.json()) as { id: string };

  const auditorApplication = await auditorApi.post('/applications', {
    data: {
      name: regressionName('AUDITOR_APP'),
      environment: 'PRODUCTION',
      criticality: 'LOW'
    }
  });
  expect(auditorApplication.status()).toBe(403);

  const calendarTitle = regressionName('CALENDAR');
  const calendarEntry = await nbpApi.post('/calendar', {
    data: {
      applicationId: applicationBody.id,
      title: calendarTitle,
      assessmentType: 'WHITEBOX',
      plannedYear: new Date().getFullYear(),
      plannedMonth: 'July'
    }
  });
  expect(calendarEntry.ok(), await calendarEntry.text()).toBe(true);
  const calendarBody = (await calendarEntry.json()) as { id: string };

  const duplicateCalendarEntry = await nbpApi.post('/calendar', {
    data: {
      applicationId: applicationBody.id,
      title: calendarTitle,
      assessmentType: 'WHITEBOX',
      plannedYear: new Date().getFullYear(),
      plannedMonth: 'July'
    }
  });
  expect(duplicateCalendarEntry.ok(), await duplicateCalendarEntry.text()).toBe(true);
  expect((await duplicateCalendarEntry.json()) as { id: string }).toEqual(expect.objectContaining({ id: calendarBody.id }));

  const julyCalendar = await nbpApi.get(`/calendar?year=${new Date().getFullYear()}&startingMonth=July`);
  expect(julyCalendar.ok(), await julyCalendar.text()).toBe(true);
  const julyEntries = (await julyCalendar.json()) as Array<{ plannedMonth?: string }>;
  expect(julyEntries.every((entry) => entry.plannedMonth === 'July')).toBe(true);

  const invalidCalendarEntry = await nbpApi.post('/calendar', {
    data: {
      applicationId: applicationBody.id,
      title: regressionName('INVALID_CALENDAR'),
      assessmentType: 'WHITEBOX',
      plannedYear: new Date().getFullYear(),
      plannedStartDate: '2026-07-20',
      plannedEndDate: '2026-07-10'
    }
  });
  expect(invalidCalendarEntry.status()).toBe(400);

  const auditorCalendarEntry = await auditorApi.post('/calendar', {
    data: {
      applicationId: applicationBody.id,
      title: regressionName('AUDITOR_CALENDAR'),
      assessmentType: 'WHITEBOX',
      plannedYear: new Date().getFullYear()
    }
  });
  expect(auditorCalendarEntry.status()).toBe(403);

  await paysysApi.dispose();
  await nbpApi.dispose();
  await auditorApi.dispose();
});
