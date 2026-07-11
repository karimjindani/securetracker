# Regression Suite

## Purpose

The regression suite verifies that committed SecureTracker baselines continue to work as new modules are added.

## Commands

```powershell
npm.cmd run test:e2e
npm.cmd run test:regression
npm.cmd run test:regression:headed
npm.cmd run test:data:cleanup
npm.cmd run reset:seeded
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

## Future Coverage Placeholders

Pending specs remain for reports, findings, revalidation, risk acceptance, dashboards, audit search, and notifications.

## Data Safety

Regression-generated records must use the `REGRESSION_` prefix. Cleanup deletes only regression-prefixed applications, engagements, scoping records, users, organizations, and related audit records. Reset removes business workflow data and restores seeded organizations, demo users, applications, engagements, and scoping records.

## Seeded v0.4.0 Workflow Records

The seeded baseline includes:

- Three seeded applications.
- Five seeded engagements covering planned, initiated, assessment, closing meeting, and closed states.
- Draft and final scoping records for initiation/scoping regression.
- No real credentials or passwords.

## Browser Smoke

Browser smoke coverage is available but disabled by default to keep local API regression runnable without installed browser binaries.

```powershell
$env:RUN_BROWSER_E2E="true"
npm.cmd run test:regression
```
