# Regression Suite

## Purpose

The regression suite verifies that committed SecureTracker baselines continue to work as new modules are added.

Regression runs from the host machine through npm or the external Ops Console. It targets the Dockerized SecureTracker app at the configured localhost URLs and is not executed from the application backend container.

## Commands

```powershell
npm.cmd run test:e2e
npm.cmd run test:regression
npm.cmd run test:regression:headed
npm.cmd run test:data:cleanup
npm.cmd run reset:seeded
npm.cmd run ops
```

## Current Coverage

- Platform health, Keycloak reachability, and unauthenticated API rejection.
- Seeded role login and `/me` profile mapping.
- System Admin organization write access and Auditor denial.
- Paysys Security Admin application creation and Auditor denial.
- NBP Security Admin calendar creation, invalid date rejection, and Auditor denial.
- Paysys Security Admin engagement initiation and scoping finalization.
- Auditor denial for scoping writes.
- Seeded NBP closing meeting engagement can be closed only by NBP Security Admin.
- Seeded closed engagement can be moved to `GO_LIVE` by Paysys Security Admin.
- Vendor/Paysys report upload creates version metadata and MinIO-backed files.
- Protected PDF uploads set the protected flag without submitting passwords.
- Report download returns the original uploaded PDF bytes.
- Auditor cannot upload reports.
- Vendor creates findings from draft-report-backed engagements.
- Paysys assigns findings to developers.
- Developer uploads evidence and marks findings fixed pending revalidation.
- Vendor records failed and passed revalidation.
- System Admin sees populated Organizations and Users data.
- Paysys requests risk acceptance, NBP approves/rejects, and approved risks update findings.
- Dashboard metrics include accepted risks and finding counts.
- Auditor searches audit logs and exports CSV.

## Future Coverage Placeholders

Pending specs remain for notifications, reference data administration, and system configuration.

## Data Safety

Regression-generated records must use the `REGRESSION_` prefix. Cleanup deletes only regression-prefixed applications, engagements, scoping records, report metadata, report versions, users, organizations, risk acceptance records, and related audit records. Reset removes business workflow data and restores seeded organizations, demo users, applications, engagements, and scoping records.

The external Ops Console at `http://127.0.0.1:3300` provides buttons for running regression, cleanup, and reset. It streams real command logs so startup and dependency failures are visible.

## Seeded v0.4.0 Workflow Records

The seeded baseline includes:

- Three seeded applications.
- Five seeded engagements covering planned, initiated, assessment, closing meeting, and closed states.
- Draft and final scoping records for initiation/scoping regression.
- No real credentials, passwords, or seeded report PDFs.

## Browser Smoke

Browser smoke coverage is available but disabled by default to keep local API regression runnable without installed browser binaries.

```powershell
$env:RUN_BROWSER_E2E="true"
npm.cmd run test:regression
```
