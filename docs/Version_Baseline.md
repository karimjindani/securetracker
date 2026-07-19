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

Historical seeded records for this earlier slice, superseded by the `v0.18.9` screenshot-derived baseline:

- Three synthetic application records used only by this earlier historical slice.
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

## v0.18.4 - Seeded Validation Baseline, Kanban Engagements, and Admin Page Fixes

Status: Implemented on main

Version allocation:

- `AGENTS.md` required remote version inspection before assigning the code version.
- `origin/main` was fetched with prune, active remote branches were inspected, and the highest remote version found was `v0.18.3`.
- This slice therefore uses `v0.18.4`.

Baseline contents:

- Reset applies Prisma schema sync before restoring seeded validation data.
- Seeded baseline includes exactly 3 organizations: NBP, Paysys Labs, and Apprise.
- Historical seeded baseline included 7 demo users, 25 applications, and 50 annual Whitebox engagements. This was superseded by `v0.18.9`, which restores 23 screenshot-derived applications and 45 mixed Whitebox / Black-Grey engagements.
- Each historical seeded application had two Whitebox engagements spaced six months apart.
- The historical seeded annual plan was distributed so Apprise had no more than five assessments per month.
- Engagements page renders lifecycle Kanban columns instead of a table-first list.
- Organizations page clarifies workflow-party meaning and shows user/vendor engagement counts.

Documentation references:

- `docs/plans/v0.18.4-seeded-kanban-admin-fix-plan.md`
- `docs/testing/v0.18.4-test-results.md`
- `docs/user-guides/v0.18.4-seeded-validation-user-guide.md`
- `docs/testing/regression-suite.md`

Code reference:

- Branch: `main`
- Version: `0.18.4`

## v0.18.5 - Schedule Health Dashboard Drill-Down

Status: Implemented on main

Version allocation:

- `AGENTS.md` required remote version inspection before assigning the code version.
- `origin/main` was fetched with prune, active remote branches were inspected, and the highest remote version found was `v0.18.4`.
- This slice therefore uses `v0.18.5`.

Baseline contents:

- Derived schedule-health classification for engagements: `GREEN`, `YELLOW`, and `RED`.
- Dashboard counts for On Track, Needs Attention, and At Risk engagements.
- Dashboard short lists and links into filtered Engagements Kanban views.
- Engagements API and Kanban schedule-health filtering.
- Colored schedule-health chips on Kanban cards.

Documentation references:

- `docs/plans/v0.18.5-schedule-health-dashboard-plan.md`
- `docs/testing/v0.18.5-test-results.md`
- `docs/user-guides/v0.18.5-schedule-health-user-guide.md`
- `docs/testing/regression-suite.md`

Code reference:

- Branch: `codex/v0.18.5-schedule-health-dashboard`
- Version: `0.18.5`

## v0.18.6 - UX Stabilization and Data Quality

Status: Implemented on feature branch

Version allocation:

- `AGENTS.md` required remote version inspection before assigning the code version.
- `origin/main` was fetched with prune, active remote branches were inspected, and the highest remote version found was `v0.18.5`.
- This slice therefore uses `v0.18.6`.

Baseline contents:

- Database-backed System Settings module with `DEFAULT_PAGE_SIZE`.
- System Admin Settings page for updating Default Page Size.
- Table pagination driven by the backend setting across list-heavy pages.
- Audit search results rendered as a paginated table.
- Calendar API supports `startingMonth` filtering alongside `year`.
- Duplicate Calendar create behavior remains idempotent for identical planned entries.

Documentation references:

- `docs/plans/v0.18.6-ux-stabilization-plan.md`
- `docs/testing/v0.18.6-test-results.md`
- `docs/user-guides/v0.18.6-ux-stabilization-user-guide.md`
- `docs/testing/regression-suite.md`

Code reference:

- Branch: `codex/v0.18.6-ux-stabilization`
- Version: `0.18.6`

## v0.18.7 - System Administration and Configuration

Status: Implemented on feature branch

Version allocation:

- `AGENTS.md` required remote version inspection before assigning the code version.
- `origin/main` was fetched with prune, active remote branches were inspected, and the highest remote version found was `v0.18.6`.
- This slice therefore uses `v0.18.7`.

Baseline contents:

- System Settings now includes schedule-health, notification, scheduler, and audit retention settings.
- Dashboard and Engagements schedule health use the configured warning window.
- Notification due checks use configured finding and risk reminder windows.
- Notification email delivery can be enabled or disabled from Settings.
- Backend scheduled due checks are controlled by `notificationsSchedulerEnabled`.
- Settings page is grouped into Portal Defaults, Schedule Health, Notifications, and Audit and Retention.

Documentation references:

- `docs/plans/v0.18.7-system-configuration-plan.md`
- `docs/testing/v0.18.7-test-results.md`
- `docs/user-guides/v0.18.7-system-configuration-user-guide.md`
- `docs/testing/regression-suite.md`

Code reference:

- Branch: `codex/v0.18.7-system-configuration`
- Version: `0.18.7`

## v0.18.8 - CI, Security, and Production Deployment Hardening

Status: Implemented on feature branch

Version allocation:

- `AGENTS.md` required remote version inspection before assigning the code version.
- `origin/main` was fetched with prune, active remote branches were inspected, and the highest remote version found was `v0.18.7`.
- This slice therefore uses `v0.18.8`.

Baseline contents:

- Production Docker VM assets with `docker-compose.prod.yml` and `.env.production.example`.
- Explicit production environment validation through `SECURETRACKER_DEPLOYMENT_MODE=production`.
- CI dependency audit, secret scan, Docker image builds, production Compose validation, and non-blocking container scan.
- Backup and restore runbook for PostgreSQL, MinIO, and host-managed configuration.

Documentation references:

- `docs/plans/v0.18.8-production-hardening-plan.md`
- `docs/testing/v0.18.8-test-results.md`
- `docs/user-guides/v0.18.8-production-operations-guide.md`
- `docs/Backup_Restore_Runbook.md`

Code reference:

- Branch: `codex/v0.18.8-production-hardening`
- Version: `0.18.8`

## v0.18.9 - Screenshot-Based Seeded Validation Data

Status: Implemented on feature branch

Version allocation:

- `AGENTS.md` required remote version inspection before assigning the code version.
- `origin/main` was fetched with prune and active remote branches were inspected.
- `origin/main` contained `v0.18.7`; active branch `codex/v0.18.8-production-hardening` allocated `v0.18.8`.
- This slice therefore uses `v0.18.9`.

Baseline contents:

- Reset restores screenshot-derived application and engagement data only.
- Seeded applications: 23.
- Seeded 2026 engagements: 45 total, 22 `WHITEBOX` and 23 `BLACK_GREY`.
- Current engagement statuses are mapped from the pending-report tracker screenshot where rows match calendar applications.
- No scoping records, reports, findings, risk acceptances, tickets, or synthetic `Seeded ...` applications are created.

Documentation references:

- `docs/plans/v0.18.9-screenshot-seeded-data-plan.md`
- `docs/testing/v0.18.9-test-results.md`
- `docs/user-guides/v0.18.9-screenshot-seeded-data-user-guide.md`

Code reference:

- Branch: `codex/v0.18.9-screenshot-seeded-data`
- Version: `0.18.9`

## v0.18.10 - Documentation Alignment

Status: Documentation-only baseline

Version allocation:

- `AGENTS.md` required remote version inspection before assigning the documentation baseline.
- `origin/main` was fetched with prune and active remote branches were inspected.
- `origin/main` contained `v0.18.9`; no active remote branch allocated a higher version.
- This documentation-only slice therefore uses `v0.18.10`.

Baseline contents:

- Canonical current-state product architecture document with Mermaid UML-style diagrams.
- Canonical data model document derived from `prisma/schema.prisma`.
- Canonical data dictionary covering implemented enums, models, key fields, and operational notes.
- Consolidated screenshot-based user guide using the local seeded `v0.18.9` app.
- Living docs now reference the canonical current-state documents.
- Software remains `0.18.9`; no package, schema, API, Docker, or runtime behavior changes are included.

Documentation references:

- `docs/Product_Architecture.md`
- `docs/Data_Model.md`
- `docs/Data_Dictionary.md`
- `docs/User_Guide.md`
- `docs/plans/v0.18.10-documentation-alignment-plan.md`
- `docs/testing/v0.18.10-documentation-review.md`

Code reference:

- Branch: `codex/v0.18.10-documentation-alignment`
- Software version: `0.18.9`
- Documentation baseline: `v0.18.10`
