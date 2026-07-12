import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { apiFor } from '../support/api-client.js';
import { regressionName } from '../support/factories.js';
import { seededUsers } from '../support/seeded-users.js';
import { isReachable, testConfig } from '../support/test-config.js';

const pdfBuffer = () =>
  Buffer.from(
    [
      '%PDF-1.4',
      '1 0 obj',
      '<< /Type /Catalog /Pages 2 0 R >>',
      'endobj',
      '2 0 obj',
      '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      'endobj',
      `% ${Date.now()}-${randomUUID()}`,
      '%%EOF'
    ].join('\n')
  );

test.beforeEach(async () => {
  test.skip(!(await isReachable(`${testConfig.apiBaseUrl}/health`)), 'Backend is not running.');
});

test('finding remediation and revalidation workflow runs end to end', async () => {
  const paysysApi = await apiFor(seededUsers.paysysAdmin);
  const developerApi = await apiFor(seededUsers.paysysDeveloper);
  const vendorApi = await apiFor(seededUsers.vendorAdmin);
  const auditorApi = await apiFor(seededUsers.auditor);

  const organizations = await paysysApi.get('/organizations');
  expect(organizations.ok(), await organizations.text()).toBe(true);
  const apprise = ((await organizations.json()) as Array<{ id: string; name: string }>).find(
    (organization) => organization.name === 'Apprise'
  );
  expect(apprise).toBeTruthy();

  const application = await paysysApi.post('/applications', {
    data: {
      name: regressionName('FINDING_APP'),
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
      title: regressionName('FINDING_ENGAGEMENT'),
      assessmentType: 'WHITEBOX',
      plannedYear: new Date().getFullYear(),
      plannedMonth: 'September',
      vendorOrganizationId: apprise?.id
    }
  });
  expect(calendarEntry.ok(), await calendarEntry.text()).toBe(true);
  const engagement = (await calendarEntry.json()) as { id: string };

  for (const targetStatus of ['PAYSYS_APPRISE_INITIATED', 'APPRISE_ASSESSMENT']) {
    const transition = await paysysApi.post(`/engagements/${engagement.id}/transitions`, {
      data: { targetStatus, remarks: `Regression move to ${targetStatus}` }
    });
    expect(transition.ok(), await transition.text()).toBe(true);
  }

  const reportUpload = await vendorApi.post(`/engagements/${engagement.id}/reports`, {
    multipart: {
      reportType: 'DRAFT_REPORT',
      title: regressionName('FINDINGS_DRAFT_REPORT'),
      file: {
        name: `${testConfig.regressionPrefix}findings-draft.pdf`,
        mimeType: 'application/pdf',
        buffer: pdfBuffer()
      }
    }
  });
  expect(reportUpload.ok(), await reportUpload.text()).toBe(true);
  const report = (await reportUpload.json()) as { versions: Array<{ id: string }> };

  const findingCreate = await vendorApi.post(`/engagements/${engagement.id}/findings`, {
    data: {
      sourceReportVersionId: report.versions[0].id,
      findingReference: regressionName('FINDING_REF'),
      title: 'Regression authorization bypass',
      description: 'A regression endpoint allows authorization bypass.',
      recommendation: 'Enforce server-side authorization checks.',
      severity: 'HIGH',
      cvssScore: '8.1'
    }
  });
  expect(findingCreate.ok(), await findingCreate.text()).toBe(true);
  const finding = (await findingCreate.json()) as { id: string; status: string };
  expect(finding.status).toBe('OPEN');

  const developerProfile = await developerApi.get('/me');
  expect(developerProfile.ok(), await developerProfile.text()).toBe(true);
  const developer = (await developerProfile.json()) as { id: string; email: string };
  expect(developer).toBeTruthy();

  const assign = await paysysApi.post(`/findings/${finding.id}/assign`, {
    data: { assignedToUserId: developer?.id, dueDate: '2026-10-01' }
  });
  expect(assign.ok(), await assign.text()).toBe(true);
  expect((await assign.json()) as { status: string; assignedToUserId: string }).toMatchObject({
    status: 'ASSIGNED',
    assignedToUserId: developer?.id
  });

  const auditorEvidence = await auditorApi.post(`/findings/${finding.id}/evidence`, {
    multipart: {
      evidenceType: 'DOCUMENT',
      title: 'Forbidden evidence'
    }
  });
  expect(auditorEvidence.status()).toBe(403);

  const evidence = await developerApi.post(`/findings/${finding.id}/evidence`, {
    multipart: {
      evidenceType: 'TEST_RESULT',
      title: 'Regression fix evidence',
      notes: 'Regression test evidence uploaded by assigned developer.',
      file: {
        name: `${testConfig.regressionPrefix}evidence.txt`,
        mimeType: 'text/plain',
        buffer: Buffer.from('Regression evidence')
      }
    }
  });
  expect(evidence.ok(), await evidence.text()).toBe(true);

  const fixed = await developerApi.post(`/findings/${finding.id}/status`, {
    data: { targetStatus: 'FIXED_PENDING_REVALIDATION' }
  });
  expect(fixed.ok(), await fixed.text()).toBe(true);

  const revalidationRequest = await paysysApi.post(`/findings/${finding.id}/status`, {
    data: { targetStatus: 'FIXED_PENDING_REVALIDATION' }
  });
  expect(revalidationRequest.ok(), await revalidationRequest.text()).toBe(true);

  const failed = await vendorApi.post(`/findings/${finding.id}/revalidations`, {
    data: { result: 'FAILED', revalidationDate: '2026-10-05', remarks: 'Fix was incomplete.' }
  });
  expect(failed.ok(), await failed.text()).toBe(true);
  expect((await failed.json()) as { status: string }).toMatchObject({ status: 'REVALIDATION_FAILED' });

  const fixedAgain = await developerApi.post(`/findings/${finding.id}/status`, {
    data: { targetStatus: 'FIXED_PENDING_REVALIDATION' }
  });
  expect(fixedAgain.ok(), await fixedAgain.text()).toBe(true);

  const passed = await vendorApi.post(`/findings/${finding.id}/revalidations`, {
    data: { result: 'PASSED', revalidationDate: '2026-10-10', remarks: 'Fix validated.' }
  });
  expect(passed.ok(), await passed.text()).toBe(true);
  expect((await passed.json()) as { status: string }).toMatchObject({ status: 'REVALIDATION_PASSED' });

  await paysysApi.dispose();
  await developerApi.dispose();
  await vendorApi.dispose();
  await auditorApi.dispose();
});
