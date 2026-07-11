import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { apiFor } from '../support/api-client.js';
import { regressionName } from '../support/factories.js';
import { seededUsers } from '../support/seeded-users.js';
import { isReachable, testConfig } from '../support/test-config.js';

const pdfBuffer = (label: string, protectedPdf = false) =>
  Buffer.from(
    [
      '%PDF-1.4',
      '1 0 obj',
      '<< /Type /Catalog /Pages 2 0 R >>',
      'endobj',
      '2 0 obj',
      '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      'endobj',
      '3 0 obj',
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 120] >>',
      'endobj',
      protectedPdf ? '/Encrypt' : `% ${label}`,
      `% ${Date.now()}-${randomUUID()}`,
      '%%EOF'
    ].join('\n')
  );

test.beforeEach(async () => {
  test.skip(!(await isReachable(`${testConfig.apiBaseUrl}/health`)), 'Backend is not running.');
});

test('Vendor uploads draft report versions and downloads the original PDF', async () => {
  const paysysApi = await apiFor(seededUsers.paysysAdmin);
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
      name: regressionName('REPORT_APP'),
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
      title: regressionName('REPORT_ENGAGEMENT'),
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

  const draftPdf = pdfBuffer('draft');
  const upload = await vendorApi.post(`/engagements/${engagement.id}/reports`, {
    multipart: {
      reportType: 'DRAFT_REPORT',
      title: regressionName('DRAFT_REPORT'),
      uploadNotes: 'Regression draft upload',
      file: {
        name: `${testConfig.regressionPrefix}draft.pdf`,
        mimeType: 'application/pdf',
        buffer: draftPdf
      }
    }
  });
  expect(upload.ok(), await upload.text()).toBe(true);
  const report = (await upload.json()) as {
    id: string;
    reportType: string;
    currentVersion: number;
    versions: Array<{ id: string; isPasswordProtected: boolean; sha256Hash: string; fileSizeBytes: string }>;
  };
  expect(report.reportType).toBe('DRAFT_REPORT');
  expect(report.currentVersion).toBe(1);
  expect(report.versions[0].isPasswordProtected).toBe(false);
  expect(report.versions[0].sha256Hash).toMatch(/^[a-f0-9]{64}$/);

  const refreshedEngagement = await paysysApi.get(`/engagements/${engagement.id}`);
  expect(refreshedEngagement.ok(), await refreshedEngagement.text()).toBe(true);
  expect((await refreshedEngagement.json()) as { status: string }).toMatchObject({ status: 'DRAFT_REPORT_UPLOADED' });

  const download = await paysysApi.get(`/reports/${report.id}/versions/${report.versions[0].id}/download`);
  expect(download.ok(), await download.text()).toBe(true);
  expect(Buffer.from(await download.body()).equals(draftPdf)).toBe(true);

  const forbiddenUpload = await auditorApi.post(`/engagements/${engagement.id}/reports`, {
    multipart: {
      reportType: 'DRAFT_REPORT',
      title: regressionName('AUDITOR_REPORT'),
      file: {
        name: `${testConfig.regressionPrefix}auditor.pdf`,
        mimeType: 'application/pdf',
        buffer: pdfBuffer('auditor')
      }
    }
  });
  expect(forbiddenUpload.status()).toBe(403);

  await paysysApi.dispose();
  await vendorApi.dispose();
  await auditorApi.dispose();
});

test('Protected PDF upload sets the protected flag without submitting passwords', async () => {
  const paysysApi = await apiFor(seededUsers.paysysAdmin);

  const application = await paysysApi.post('/applications', {
    data: {
      name: regressionName('PROTECTED_REPORT_APP'),
      environment: 'PRODUCTION',
      criticality: 'MEDIUM',
      internetFacing: false
    }
  });
  expect(application.ok(), await application.text()).toBe(true);
  const applicationBody = (await application.json()) as { id: string };

  const calendarEntry = await paysysApi.post('/calendar', {
    data: {
      applicationId: applicationBody.id,
      title: regressionName('PROTECTED_REPORT_ENGAGEMENT'),
      assessmentType: 'BLACK_GREY',
      plannedYear: new Date().getFullYear(),
      plannedMonth: 'October'
    }
  });
  expect(calendarEntry.ok(), await calendarEntry.text()).toBe(true);
  const engagement = (await calendarEntry.json()) as { id: string };

  const upload = await paysysApi.post(`/engagements/${engagement.id}/reports`, {
    multipart: {
      reportType: 'ADDENDUM',
      title: regressionName('PROTECTED_ADDENDUM'),
      file: {
        name: `${testConfig.regressionPrefix}protected.pdf`,
        mimeType: 'application/pdf',
        buffer: pdfBuffer('protected', true)
      }
    }
  });
  expect(upload.ok(), await upload.text()).toBe(true);
  const report = (await upload.json()) as { versions: Array<{ isPasswordProtected: boolean }> };
  expect(report.versions[0].isPasswordProtected).toBe(true);

  const rejectedPassword = await paysysApi.post(`/engagements/${engagement.id}/reports`, {
    multipart: {
      reportType: 'ADDENDUM',
      title: regressionName('PASSWORD_FIELD_REPORT'),
      pdfPassword: 'NeverSendThis',
      file: {
        name: `${testConfig.regressionPrefix}password-field.pdf`,
        mimeType: 'application/pdf',
        buffer: pdfBuffer('password-field')
      }
    }
  });
  expect(rejectedPassword.status()).toBe(400);

  await paysysApi.dispose();
});
