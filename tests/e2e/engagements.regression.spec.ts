import { expect, test } from '@playwright/test';
import { apiFor } from '../support/api-client.js';
import { regressionName } from '../support/factories.js';
import { seededUsers } from '../support/seeded-users.js';
import { isReachable, testConfig } from '../support/test-config.js';

test.beforeEach(async () => {
  test.skip(!(await isReachable(`${testConfig.apiBaseUrl}/health`)), 'Backend is not running.');
});

test('Paysys initiates engagement and finalizes scoping without NBP scope approval', async () => {
  const paysysApi = await apiFor(seededUsers.paysysAdmin);
  const auditorApi = await apiFor(seededUsers.auditor);

  const application = await paysysApi.post('/applications', {
    data: {
      name: regressionName('ENG_APP'),
      environment: 'PRODUCTION',
      criticality: 'HIGH',
      internetFacing: true
    }
  });
  expect(application.ok(), await application.text()).toBe(true);
  const applicationBody = (await application.json()) as { id: string };

  const calendarEntry = await paysysApi.post('/calendar', {
    data: {
      applicationId: applicationBody.id,
      title: regressionName('ENGAGEMENT'),
      assessmentType: 'WHITEBOX',
      plannedYear: new Date().getFullYear(),
      plannedMonth: 'August'
    }
  });
  expect(calendarEntry.ok(), await calendarEntry.text()).toBe(true);
  const engagement = (await calendarEntry.json()) as { id: string };

  const scoping = await paysysApi.post(`/engagements/${engagement.id}/scoping-records`, {
    data: {
      meetingDate: '2026-08-01',
      meetingTime: '10:00',
      participants: 'Paysys Labs Security, Apprise VAPT Team',
      scopeIncluded: 'Regression application and API endpoints',
      scopeExcluded: 'Production credentials and destructive testing',
      testingWindowStart: '2026-08-10',
      testingWindowEnd: '2026-08-20',
      testAccountsSummary: 'Regression test account summary; no passwords stored.',
      architectureSummary: 'Regression architecture summary.'
    }
  });
  expect(scoping.ok(), await scoping.text()).toBe(true);
  const scopingBody = (await scoping.json()) as { id: string; recordStatus: string; participants: string };
  expect(scopingBody.recordStatus).toBe('DRAFT');
  expect(scopingBody.participants).not.toContain('NBP Scope Agreement');

  const finalize = await paysysApi.post(`/scoping-records/${scopingBody.id}/finalize`);
  expect(finalize.ok(), await finalize.text()).toBe(true);
  expect((await finalize.json()) as { recordStatus: string }).toMatchObject({ recordStatus: 'FINAL' });

  const initiated = await paysysApi.post(`/engagements/${engagement.id}/transitions`, {
    data: { targetStatus: 'PAYSYS_APPRISE_INITIATED', remarks: 'Regression initiation meeting completed.' }
  });
  expect(initiated.ok(), await initiated.text()).toBe(true);
  expect((await initiated.json()) as { status: string }).toMatchObject({ status: 'PAYSYS_APPRISE_INITIATED' });

  const forbiddenScoping = await auditorApi.post(`/engagements/${engagement.id}/scoping-records`, {
    data: {
      meetingDate: '2026-08-02',
      participants: 'Auditor',
      scopeIncluded: 'Forbidden write'
    }
  });
  expect(forbiddenScoping.status()).toBe(403);

  await paysysApi.dispose();
  await auditorApi.dispose();
});

test('closing and Go-Live transitions enforce ownership rules', async () => {
  const paysysApi = await apiFor(seededUsers.paysysAdmin);
  const nbpApi = await apiFor(seededUsers.nbpAdmin);

  const application = await paysysApi.post('/applications', {
    data: {
      name: regressionName('CLOSE_APP'),
      environment: 'PRODUCTION',
      criticality: 'HIGH',
      internetFacing: false
    }
  });
  expect(application.ok(), await application.text()).toBe(true);
  const applicationBody = (await application.json()) as { id: string };

  const calendarEntry = await paysysApi.post('/calendar', {
    data: {
      applicationId: applicationBody.id,
      title: regressionName('CLOSING_ENGAGEMENT'),
      assessmentType: 'BLACK_GREY',
      plannedYear: new Date().getFullYear(),
      plannedMonth: 'November'
    }
  });
  expect(calendarEntry.ok(), await calendarEntry.text()).toBe(true);
  const engagement = (await calendarEntry.json()) as { id: string };

  for (const targetStatus of [
    'PAYSYS_APPRISE_INITIATED',
    'APPRISE_ASSESSMENT',
    'DRAFT_REPORT_UPLOADED',
    'PAYSYS_TRIAGE',
    'DEVELOPER_FIX',
    'FIXED_PENDING_REVALIDATION',
    'APPRISE_REVALIDATION',
    'FINAL_REPORT_UPLOADED',
    'PAYSYS_IS_REVIEW_AND_COMMENT',
    'NBP_IS_REVIEW_CLOSING_MEETING'
  ]) {
    const response = await paysysApi.post(`/engagements/${engagement.id}/transitions`, {
      data: { targetStatus, remarks: `Regression move to ${targetStatus}` }
    });
    expect(response.ok(), await response.text()).toBe(true);
  }

  const forbiddenClose = await paysysApi.post(`/engagements/${engagement.id}/transitions`, {
    data: { targetStatus: 'CLOSED', remarks: 'Paysys should not close.' }
  });
  expect(forbiddenClose.status()).toBe(403);

  const closed = await nbpApi.post(`/engagements/${engagement.id}/transitions`, {
    data: { targetStatus: 'CLOSED', remarks: 'NBP closing meeting complete.' }
  });
  expect(closed.ok(), await closed.text()).toBe(true);
  expect((await closed.json()) as { status: string }).toMatchObject({ status: 'CLOSED' });

  const goLive = await paysysApi.post(`/engagements/${engagement.id}/transitions`, {
    data: { targetStatus: 'GO_LIVE', remarks: 'Production deployment coordination complete.' }
  });
  expect(goLive.ok(), await goLive.text()).toBe(true);
  expect((await goLive.json()) as { status: string }).toMatchObject({ status: 'GO_LIVE' });

  await paysysApi.dispose();
  await nbpApi.dispose();
});
