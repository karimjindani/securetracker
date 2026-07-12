# Version Baseline

## v0.1.0 - Scaffold and Dev Platform

Status: Implemented on feature branch

Baseline contents:

- Monorepo scaffold with frontend, backend, shared package, and Prisma schema.
- Docker Compose development services for PostgreSQL, Keycloak, MinIO, SMTP test service, and backend API.
- CI workflow with `db:generate`, `typecheck`, `lint`, `test`, and `build` stages.
- Initial frontend shell and backend health endpoint.
- Cleaned documentation baseline removing obsolete NBP initial-scope governance and formal scope document artifacts.

Documentation references:

- `docs/plans/v0.1.0-implementation-plan.md`
- `docs/Deployment.md`
- `docs/CI_CD_Pipeline.md`
- `docs/Source_Control_Policy.md`
- `docs/testing/v0.1.0-test-results.md`
- `docs/user-guides/v0.1.0-user-guide.md`

Code reference:

- Branch: `feat/v0.1.0-scaffold`
- Version: `0.1.0`

## v0.2.0 - Authentication, Organizations, Users, RBAC

Status: Implemented on feature branch

Baseline contents:

- Keycloak development realm import with local demo users.
- JWT validation and `/me` profile mapping.
- Backend RBAC guards and role decorators.
- Organizations and users APIs with audit records for writes.
- Frontend Keycloak login/logout shell and role-aware navigation.

Documentation references:

- `docs/plans/v0.2.0-auth-rbac-plan.md`
- `docs/testing/v0.2.0-test-results.md`
- `docs/user-guides/v0.2.0-auth-rbac-user-guide.md`

Code reference:

- Branch: `feat/v0.2.0-auth-rbac`
- Version: `0.2.0`

## v0.3.0 - Application Inventory and Annual VAPT Calendar

Status: Implemented on feature branch

Baseline contents:

- Application inventory APIs and frontend page.
- Annual/ad-hoc VAPT calendar APIs and frontend page.
- Calendar entries stored as `PLANNED` VAPT engagements.
- RBAC controls for application and calendar management.
- Audit records for application and calendar create/update actions.

Documentation references:

- `docs/plans/v0.3.0-application-calendar-plan.md`
- `docs/testing/v0.3.0-test-results.md`
- `docs/user-guides/v0.3.0-application-calendar-user-guide.md`

Code reference:

- Branch: `feat/v0.3.0-application-calendar`
- Version: `0.3.0`

## v0.3.1 - Regression Suite and Ops Console

Status: Implemented on feature branch

Baseline contents:

- Playwright regression suite for platform, auth, RBAC, applications, and calendar.
- Regression data cleanup and reset-to-seeded baseline scripts.
- External host-run Ops Console for health, containers, regression runs, cleanup, and reset.
- Ops Console runs outside the SecureTracker frontend/backend containers at `http://127.0.0.1:3300`.

Documentation references:

- `docs/plans/v0.3.1-regression-ops-plan.md`
- `docs/testing/regression-suite.md`
- `docs/testing/v0.3.1-test-results.md`
- `docs/user-guides/v0.3.1-ops-console-user-guide.md`

Code reference:

- Branch: `feat/v0.3.1-regression-ops`
- Version: `0.3.1`

## v0.4.0 - Engagement Initiation and Scoping Workflow

Status: Implemented on feature branch

Baseline contents:

- Engagement list/detail APIs and frontend routes.
- Paysys-Apprise initiation and scoping record workflow.
- Scoping records with `DRAFT` and `FINAL` status.
- Lifecycle transition enforcement for initiation, Apprise assessment, closure, and Go-Live.
- NBP Security Admin remains the only role authorized to mark an engagement `Closed`.
- Seeded applications, engagements, and scoping records for repeatable regression testing.
- Regression coverage for scoping creation/finalization and closure/go-live role boundaries.

Seeded records:

- `Seeded Core Banking Portal`, `Seeded Mobile Banking API`, and `Seeded Internet Banking Web`.
- Engagements in `PLANNED`, `PAYSYS_APPRISE_INITIATED`, `APPRISE_ASSESSMENT`, `NBP_IS_REVIEW_CLOSING_MEETING`, and `CLOSED`.
- Draft and final scoping records with no real credentials or passwords.

Documentation references:

- `docs/plans/v0.4.0-engagement-scoping-plan.md`
- `docs/testing/v0.4.0-test-results.md`
- `docs/user-guides/v0.4.0-engagement-scoping-user-guide.md`
- `docs/testing/regression-suite.md`

Code reference:

- Branch: `feat/v0.3.1-regression-ops`
- Version: `0.4.0`

## v0.5.0 - Report Repository, MinIO Uploads, and Protected PDF Viewer

Status: Implemented on feature branch

Baseline contents:

- Report repository APIs for engagement report list, report detail, upload, version upload, view, and download.
- MinIO storage for original PDF files under engagement/report object keys.
- Report and report version metadata with SHA-256 hash, file size, MIME type, object key, uploader, upload notes, and protected PDF flag.
- Audit events for report upload, version upload, view, and download.
- Frontend reports panel on engagement detail with upload, version list, view, and download actions.
- Browser PDF.js viewer with local-only password prompt for protected PDFs.
- Regression coverage for generated `REGRESSION_` PDFs, protected flag detection, download integrity, and upload RBAC.

Seeded records:

- v0.5.0 does not seed real report files.
- Reset restores the v0.4.0 seeded applications, engagements, and scoping records with no report metadata or objects.
- Regression creates temporary `REGRESSION_` report files at runtime.

Documentation references:

- `docs/plans/v0.5.0-report-repository-plan.md`
- `docs/testing/v0.5.0-test-results.md`
- `docs/user-guides/v0.5.0-report-repository-user-guide.md`
- `docs/testing/regression-suite.md`

Code reference:

- Branch: `feat/v0.3.1-regression-ops`
- Version: `0.5.0`

## v0.6.0 - Findings, Evidence, and Revalidation

Status: Implemented on main

Baseline contents:

- Findings APIs for engagement finding list, create, detail, update, assignment, status transitions, evidence, and revalidation.
- Finding status history, remediation evidence, and revalidation attempt records.
- MinIO-backed evidence file storage.
- Engagement detail UI for findings, assignment, developer evidence, and vendor revalidation.
- Workflow enforcement for Vendor Admin, Paysys Security Admin, and Paysys Developer.
- Regression coverage for create, assign, evidence upload, failed revalidation, refix, and passed revalidation.

Documentation references:

- `docs/plans/v0.6.0-findings-revalidation-plan.md`
- `docs/testing/v0.6.0-test-results.md`
- `docs/user-guides/v0.6.0-findings-revalidation-user-guide.md`
- `docs/testing/regression-suite.md`

Code reference:

- Branch: `main`
- Version: `0.6.0`

## v0.11.3 - Admin Pages, Risk Acceptance, Dashboards, and Audit Search

Status: Implemented on main

Version allocation:

- `AGENTS.md` required remote version inspection before assigning the code version.
- `origin/main` was fetched with prune, active remote branches were inspected, and the highest remote version found was `v0.11.2`.
- This slice therefore uses `v0.11.3`.

Baseline contents:

- API-backed Organizations and Users frontend pages with System Admin create/update controls.
- Users navigation restricted to `SYSTEM_ADMIN`; audit navigation added for governance/auditor roles.
- Risk acceptance request and NBP approve/reject workflow linked to findings.
- Live dashboard metrics for engagements, findings, accepted risks, expiring risks, revalidation, heatmap, upcoming engagements, and vendor performance.
- Audit search and CSV export.
- Regression cleanup/reset support for risk acceptance records.

Documentation references:

- `docs/plans/v0.11.3-admin-risk-dashboard-audit-plan.md`
- `docs/testing/v0.11.3-test-results.md`
- `docs/user-guides/v0.11.3-admin-risk-dashboard-audit-user-guide.md`
- `docs/testing/regression-suite.md`

Code reference:

- Branch: `main`
- Version: `0.11.3`

## v0.18.2 - Tabular List UX

Status: Implemented on main

Version allocation:

- `AGENTS.md` required remote version inspection before assigning the code version.
- After pushing the governance baseline, `origin/main` contained `v0.18.1` as the highest allocated version.
- This slice therefore uses `v0.18.2`.

Baseline contents:

- Applications, VAPT Calendar, Engagements, Organizations, and Users render list data in responsive tables.
- Filters/search controls update table rows on the relevant pages.
- Empty states are displayed inside table rows.
- Dashboard metrics remain unchanged.

Documentation references:

- `docs/plans/v0.18.2-tabular-list-ux-plan.md`
- `docs/testing/v0.18.2-test-results.md`
- `docs/user-guides/v0.18.2-tabular-list-ux-user-guide.md`
- `docs/testing/regression-suite.md`

Code reference:

- Branch: `main`
- Version: `0.18.2`

## v0.18.3 - Notifications and Email Alerts

Status: Implemented on main

Version allocation:

- `AGENTS.md` required remote version inspection before assigning the code version.
- `origin/main` was fetched with prune, active remote branches were inspected, and the highest remote version found was `v0.18.2`.
- This slice therefore uses `v0.18.3`.

Baseline contents:

- Notification records linked to users and workflow entities.
- In-app notification list, unread count badge, unread filter, mark-read, and mark-all-read actions.
- Mailpit-backed SMTP email delivery for notification events with non-blocking delivery failure handling.
- Workflow triggers for engagement initiation/closure, report upload, finding assignment, revalidation completion, due reminders, overdue findings, and risk acceptance expiry.
- System Admin due-check execution for deterministic local validation.
- Cleanup/reset support for regression notification data.

Documentation references:

- `docs/plans/v0.18.3-notifications-plan.md`
- `docs/testing/v0.18.3-test-results.md`
- `docs/user-guides/v0.18.3-notifications-user-guide.md`
- `docs/testing/regression-suite.md`

Code reference:

- Branch: `main`
- Version: `0.18.3`
