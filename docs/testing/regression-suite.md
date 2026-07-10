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

## Future Coverage Placeholders

Pending specs exist for engagement initiation, scoping, reports, findings, revalidation, risk acceptance, dashboards, audit search, and notifications.

## Data Safety

Regression-generated records must use the `REGRESSION_` prefix. Cleanup deletes only regression-prefixed applications and associated engagements. Reset removes business workflow data and restores seeded organizations.

## Browser Smoke

Browser smoke coverage is available but disabled by default to keep local API regression runnable without installed browser binaries.

```powershell
$env:RUN_BROWSER_E2E="true"
npm.cmd run test:regression
```
