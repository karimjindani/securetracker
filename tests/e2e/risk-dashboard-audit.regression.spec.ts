import { expect, test } from '@playwright/test';
import { apiFor } from '../support/api-client.js';
import { regressionName } from '../support/factories.js';
import { seededUsers } from '../support/seeded-users.js';
import { isReachable, testConfig } from '../support/test-config.js';

test.beforeEach(async () => {
  test.skip(!(await isReachable(`${testConfig.apiBaseUrl}/health`)), 'Backend is not running.');
});

test('admin data, risk acceptance, dashboard, and audit export work end to end', async () => {
  const systemApi = await apiFor(seededUsers.systemAdmin);
  const paysysApi = await apiFor(seededUsers.paysysAdmin);
  const nbpApi = await apiFor(seededUsers.nbpAdmin);
  const auditorApi = await apiFor(seededUsers.auditor);

  const organizations = await systemApi.get('/organizations');
  expect(organizations.ok(), await organizations.text()).toBe(true);
  expect((await organizations.json()) as Array<{ name: string }>).toEqual(
    expect.arrayContaining([expect.objectContaining({ name: 'NBP' }), expect.objectContaining({ name: 'Paysys Labs' })])
  );

  const users = await systemApi.get('/users');
  expect(users.ok(), await users.text()).toBe(true);
  expect((await users.json()) as Array<{ email: string }>).toEqual(
    expect.arrayContaining([expect.objectContaining({ email: 'system.admin@example.local' })])
  );

  const auditorUsers = await auditorApi.get('/users');
  expect(auditorUsers.status()).toBe(403);

  const app = await paysysApi.post('/applications', {
    data: {
      name: regressionName('RISK_APP'),
      environment: 'PRODUCTION',
      criticality: 'HIGH',
      internetFacing: true
    }
  });
  expect(app.ok(), await app.text()).toBe(true);
  const application = (await app.json()) as { id: string };

  const engagementCreate = await paysysApi.post('/calendar', {
    data: {
      applicationId: application.id,
      title: regressionName('RISK_ENGAGEMENT'),
      assessmentType: 'WHITEBOX',
      plannedYear: new Date().getFullYear(),
      plannedMonth: 'November'
    }
  });
  expect(engagementCreate.ok(), await engagementCreate.text()).toBe(true);
  const engagement = (await engagementCreate.json()) as { id: string };

  const findingCreate = await paysysApi.post(`/engagements/${engagement.id}/findings`, {
    data: {
      findingReference: regressionName('RISK_FINDING'),
      title: 'Regression accepted risk',
      description: 'A regression finding is accepted by governance.',
      recommendation: 'Compensating control required.',
      severity: 'HIGH',
      dueDate: '2026-10-01'
    }
  });
  expect(findingCreate.ok(), await findingCreate.text()).toBe(true);
  const finding = (await findingCreate.json()) as { id: string };

  const riskRequest = await paysysApi.post(`/findings/${finding.id}/risk-acceptances`, {
    data: {
      riskDescription: 'Temporary residual risk for regression.',
      businessJustification: 'Deployment dependency requires temporary exception.',
      mitigatingControls: 'Monitoring and compensating WAF rule.',
      expiryDate: '2027-12-31',
      requestNotes: 'Regression request'
    }
  });
  expect(riskRequest.ok(), await riskRequest.text()).toBe(true);
  const risk = (await riskRequest.json()) as { id: string; status: string };
  expect(risk.status).toBe('REQUESTED');

  const approve = await nbpApi.post(`/risk-acceptances/${risk.id}/review`, {
    data: { status: 'APPROVED', reviewNotes: 'Approved for regression.' }
  });
  expect(approve.ok(), await approve.text()).toBe(true);
  expect((await approve.json()) as { status: string }).toMatchObject({ status: 'APPROVED' });

  const reviewedFinding = await paysysApi.get(`/findings/${finding.id}`);
  expect(reviewedFinding.ok(), await reviewedFinding.text()).toBe(true);
  expect((await reviewedFinding.json()) as { status: string }).toMatchObject({ status: 'RISK_ACCEPTED' });

  const rejectFindingCreate = await paysysApi.post(`/engagements/${engagement.id}/findings`, {
    data: {
      findingReference: regressionName('REJECT_RISK_FINDING'),
      title: 'Regression rejected risk',
      description: 'A second regression finding is rejected by governance.',
      recommendation: 'Fix required.',
      severity: 'MEDIUM'
    }
  });
  expect(rejectFindingCreate.ok(), await rejectFindingCreate.text()).toBe(true);
  const rejectFinding = (await rejectFindingCreate.json()) as { id: string };

  const rejectRequest = await paysysApi.post(`/findings/${rejectFinding.id}/risk-acceptances`, {
    data: {
      riskDescription: 'Rejected residual risk.',
      businessJustification: 'Insufficient justification.',
      expiryDate: '2027-12-31'
    }
  });
  expect(rejectRequest.ok(), await rejectRequest.text()).toBe(true);
  const rejectRisk = (await rejectRequest.json()) as { id: string };

  const reject = await nbpApi.post(`/risk-acceptances/${rejectRisk.id}/review`, {
    data: { status: 'REJECTED', reviewNotes: 'Rejected for regression.' }
  });
  expect(reject.ok(), await reject.text()).toBe(true);
  expect((await reject.json()) as { status: string }).toMatchObject({ status: 'REJECTED' });

  const dashboard = await paysysApi.get('/dashboard/summary');
  expect(dashboard.ok(), await dashboard.text()).toBe(true);
  const dashboardBody = (await dashboard.json()) as { metrics: { acceptedRisks: number; highOpenFindings: number } };
  expect(dashboardBody.metrics.acceptedRisks).toBeGreaterThanOrEqual(1);
  expect(dashboardBody.metrics.highOpenFindings).toBeGreaterThanOrEqual(0);

  const auditSearch = await auditorApi.get('/audit-logs?action=RISK_ACCEPTANCE_APPROVED');
  expect(auditSearch.ok(), await auditSearch.text()).toBe(true);
  expect((await auditSearch.json()) as Array<{ action: string }>).toEqual(
    expect.arrayContaining([expect.objectContaining({ action: 'RISK_ACCEPTANCE_APPROVED' })])
  );

  const auditExport = await auditorApi.get('/audit-logs/export?action=RISK_ACCEPTANCE_APPROVED');
  expect(auditExport.ok(), await auditExport.text()).toBe(true);
  expect(await auditExport.text()).toContain('RISK_ACCEPTANCE_APPROVED');

  await systemApi.dispose();
  await paysysApi.dispose();
  await nbpApi.dispose();
  await auditorApi.dispose();
});
