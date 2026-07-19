# SecureTracker Product Architecture

Current software version: `v0.18.9`  
Documentation baseline: `v0.18.10`

## Purpose

SecureTracker is a Dockerized VAPT tracking portal for NBP, Paysys Labs, Apprise, and auditors. It provides a single audited workflow for application inventory, annual VAPT calendar planning, engagement Kanban tracking, scoping notes, report storage, findings remediation, revalidation, risk acceptance, notifications, dashboards, audit search, and system settings.

## System Context

```mermaid
flowchart LR
    NBP["NBP users\nClient / Bank governance"] --> FE["SecureTracker Web Portal"]
    Paysys["Paysys Labs users\nSaaS provider / operator"] --> FE
    Apprise["Apprise users\nVAPT service provider"] --> FE
    Auditor["Auditors"] --> FE

    FE --> API["NestJS REST API"]
    API --> OIDC["OIDC Provider\nLocal Keycloak for dev\nExternal IdP for production"]
    API --> DB[("PostgreSQL")]
    API --> S3[("MinIO / S3 object storage")]
    API --> SMTP["SMTP\nMailpit for local dev"]
    API --> Audit[("AuditLog records")]
```

## Container Architecture

```mermaid
flowchart TB
    Browser["Browser"] --> Frontend["frontend container\nReact + Vite build served by Nginx"]
    Frontend --> Backend["backend-api container\nNestJS + Prisma"]
    Backend --> Postgres["postgres container"]
    Backend --> MinIO["minio container"]
    Backend --> Mailpit["smtp-test-service container"]
    Backend --> Keycloak["keycloak container for local/dev"]
    Ops["External Ops Console\nhost-run on 127.0.0.1:3300"] --> Docker["Docker Compose services"]
    Ops --> Backend
```

The Ops Console is intentionally outside the product containers. It is a local operator tool for health checks, regression execution, cleanup, and seeded reset. It is not deployed as part of production.

## Application Components

```mermaid
classDiagram
    class ReactPortal {
      Dashboard
      Applications
      VAPT Calendar
      Engagements Kanban
      Engagement Detail
      Organizations
      Users
      Notifications
      Audit
      Settings
    }
    class NestApi {
      Auth/RBAC
      Organizations
      Users
      Applications
      Calendar
      Engagements
      Reports
      Findings
      Risk Acceptance
      Dashboard
      Notifications
      Audit
      Settings
    }
    class Prisma {
      PostgreSQL models
      enum validation
      relational access
    }
    class ObjectStorage {
      reports
      finding evidence
      SHA-256 metadata
    }

    ReactPortal --> NestApi
    NestApi --> Prisma
    NestApi --> ObjectStorage
```

## Role Model

```mermaid
flowchart LR
    SYSTEM_ADMIN["SYSTEM_ADMIN"] --> Admin["Manage organizations, users, settings, broad portal administration"]
    NBP_SECURITY_ADMIN["NBP_SECURITY_ADMIN"] --> Close["Final review, closing meeting, mark Closed"]
    NBP_VIEWER["NBP_VIEWER"] --> View["Read governance records"]
    PAYSYS_SECURITY_ADMIN["PAYSYS_SECURITY_ADMIN"] --> Operate["Applications, calendar, engagements, scoping, assignment, reports, Go-Live"]
    PAYSYS_DEVELOPER["PAYSYS_DEVELOPER"] --> Fix["Fix assigned findings and add evidence"]
    VENDOR_ADMIN["VENDOR_ADMIN"] --> Vendor["Upload reports, create findings, perform revalidation"]
    AUDITOR["AUDITOR"] --> AuditRead["Read-only audit/governance visibility"]
```

Backend RBAC is the final authority. The frontend hides navigation and actions where possible, but every sensitive API operation is role checked server-side.

## Engagement Lifecycle

```mermaid
stateDiagram-v2
    [*] --> PLANNED
    PLANNED --> PAYSYS_APPRISE_INITIATED
    PAYSYS_APPRISE_INITIATED --> APPRISE_ASSESSMENT
    APPRISE_ASSESSMENT --> DRAFT_REPORT_UPLOADED
    DRAFT_REPORT_UPLOADED --> PAYSYS_TRIAGE
    PAYSYS_TRIAGE --> DEVELOPER_FIX
    DEVELOPER_FIX --> FIXED_PENDING_REVALIDATION
    FIXED_PENDING_REVALIDATION --> APPRISE_REVALIDATION
    APPRISE_REVALIDATION --> FINAL_REPORT_UPLOADED
    FINAL_REPORT_UPLOADED --> PAYSYS_IS_REVIEW_AND_COMMENT
    PAYSYS_IS_REVIEW_AND_COMMENT --> NBP_IS_REVIEW_CLOSING_MEETING
    NBP_IS_REVIEW_CLOSING_MEETING --> CLOSED
    CLOSED --> GO_LIVE
    PLANNED --> CANCELLED
    PAYSYS_APPRISE_INITIATED --> CANCELLED
    APPRISE_ASSESSMENT --> CANCELLED
```

NBP attendance is optional for the first Paysys-Apprise initiation meeting. NBP does not approve the initial scope. NBP Security Admin remains the only role authorized to move an engagement to `CLOSED`.

## Report And PDF Flow

```mermaid
sequenceDiagram
    participant Vendor as Vendor/Paysys uploader
    participant UI as React Portal
    participant API as Reports API
    participant Store as MinIO/S3
    participant DB as PostgreSQL
    participant Audit as Audit Log

    Vendor->>UI: Select PDF and metadata
    UI->>API: Multipart upload
    API->>Store: Store original file unchanged
    API->>DB: Save report/version metadata, hash, size, protected flag
    API->>Audit: REPORT_UPLOADED
    UI->>API: View or download version
    API->>Audit: REPORT_VIEWED or REPORT_DOWNLOADED
    API->>UI: Stream original PDF
```

Password-protected PDFs remain encrypted. PDF passwords are entered only in the browser viewer and are not stored, logged, or submitted as metadata.

## Findings And Revalidation Flow

```mermaid
stateDiagram-v2
    [*] --> OPEN
    OPEN --> ASSIGNED
    ASSIGNED --> IN_PROGRESS
    IN_PROGRESS --> FIXED_PENDING_REVALIDATION
    FIXED_PENDING_REVALIDATION --> REVALIDATION_PASSED
    FIXED_PENDING_REVALIDATION --> REVALIDATION_FAILED
    REVALIDATION_FAILED --> IN_PROGRESS
    REVALIDATION_PASSED --> CLOSED
    OPEN --> RISK_ACCEPTANCE_REQUESTED
    ASSIGNED --> RISK_ACCEPTANCE_REQUESTED
    RISK_ACCEPTANCE_REQUESTED --> RISK_ACCEPTED
```

Vendor Admin creates findings and records revalidation results. Paysys Security Admin triages and assigns. Paysys Developer fixes assigned findings, uploads evidence, and marks findings `FIXED_PENDING_REVALIDATION`.

## Notifications And Audit

```mermaid
flowchart LR
    Workflow["Workflow events"] --> Notifications["Notification records"]
    Notifications --> Email["SMTP delivery when enabled"]
    Notifications --> Inbox["User notification inbox"]
    Writes["Business/admin writes"] --> Audit["AuditLog"]
    Audit --> Search["Audit search"]
    Audit --> Csv["CSV export"]
```

Notification windows, email enablement, scheduler enablement, schedule-health warning days, default page size, and audit retention target are global system settings.

## Deployment And CI

```mermaid
flowchart LR
    PR["Pull Request"] --> CI["GitHub Actions"]
    CI --> Gates["generate, typecheck, lint, test, build"]
    CI --> Security["audit, secret scan, Docker image build, container scan"]
    Main["main"] --> ProdCompose["docker-compose.prod.yml"]
    ProdCompose --> VM["Docker VM pilot"]
    VM --> ExternalOIDC["External OIDC"]
    VM --> ProdSMTP["Production SMTP"]
    VM --> Volumes["Persistent PostgreSQL and object storage volumes"]
```

Local development uses Docker Compose with PostgreSQL, Keycloak, MinIO, Mailpit, backend, and frontend. Production pilot deployment uses production Compose assets, external OIDC, real SMTP, persistent volumes, and documented backup/restore procedures.

## Current Seeded Baseline

`npm.cmd run reset:seeded` restores:

- 3 organizations: NBP, Paysys Labs, Apprise
- 7 demo users
- 23 screenshot-derived applications
- 45 2026 engagements
- 22 Whitebox and 23 Black/Grey assessments
- no seeded scoping records, reports, findings, risk acceptances, tickets, or synthetic applications
