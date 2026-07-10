# VAPT Tracker Portal Architecture

## Version 1.0

---

# 1. Architecture Objective

The VAPT Tracker Portal is designed as a secure, auditable, role-based collaboration platform for:

- NBP
- Paysys Labs
- External VAPT Vendors such as Apprise
- Auditors and Management

The architecture must support:

- Annual VAPT calendar management
- Engagement initiation and scoping, beginning with Paysys and Apprise / External VAPT Vendor coordination while Bank / NBP attendance is optional for the first meeting
- Secure report repository
- Password-protected PDF handling
- Findings lifecycle tracking
- Remediation and revalidation workflow
- Risk acceptance
- Dashboards and reporting
- Full audit trail

---

# 2. High-Level Architecture

```mermaid
flowchart LR
    U[Users<br/>NBP / Paysys / Vendor / Auditor] --> FE[React Web Portal]

    FE --> API[NestJS Backend API]

    API --> AUTH[Keycloak<br/>OIDC / SSO / MFA]
    API --> DB[(PostgreSQL)]
    API --> OBJ[(MinIO Object Storage)]
    API --> MAIL[Email Notification Service]
    API --> AUDIT[(Audit Log Store)]

    API --> REPORT[Reporting Layer<br/>Grafana / Metabase]

    OBJ --> PDF[Encrypted / Password-Protected PDFs]
```

---

# 3. Suggested Technology Stack

## Frontend

- React
- TypeScript
- Vite
- Material UI
- PDF.js for report viewing

## Backend

- Node.js
- NestJS
- TypeScript
- REST APIs

## Database

- PostgreSQL

## Authentication

- Keycloak
- OIDC / OAuth2
- MFA support

## Object Storage

- MinIO
- S3-compatible storage

## Reporting

- Grafana or Metabase

## Deployment

- Docker Compose for MVP
- Kubernetes-ready for future deployment

---

# 4. Logical System Components

## 4.1 Web Portal

The web portal provides role-based access to:

- Dashboard
- Annual VAPT Calendar
- Application Inventory
- Engagements
- Scoping Records
- Reports
- Findings
- Risk Acceptance
- Audit Logs

The frontend must not expose unauthorized data. However, authorization must always be enforced by backend APIs.

---

## 4.2 Backend API

The backend API is responsible for:

- Authentication token validation
- Role-based authorization
- Business workflow enforcement
- CRUD operations
- Report metadata handling
- File upload and download controls
- Audit logging
- Notification triggers
- Dashboard aggregation

Recommended backend pattern:

```text
Controller → Service → Repository → Database / Object Storage
```

---

## 4.3 Authentication & Identity

Keycloak should manage:

- Users
- Organizations
- Roles
- MFA
- Session policies
- Password policies

Recommended organization model:

```text
Organization
 ├── NBP
 ├── Paysys
 └── Vendor
      └── Apprise
```

Each user belongs to one organization and one or more roles.

---

# 5. Role-Based Access Control

## Roles

| Role | Organization | Access Level |
|---|---|---|
| NBP Security Admin | NBP | Full governance access and only role authorized to close engagements |
| NBP Viewer | NBP | Read-only |
| Paysys Security Admin | Paysys | Full portal administration except closing engagements |
| Paysys Developer | Paysys | Assigned findings and fix status updates |
| Vendor Admin | Vendor | Upload reports, create findings, revalidate |
| Auditor | Any / Independent | Read-only audit access |
| System Admin | Platform | User and configuration management |

---

## Access Control Rules

### NBP Security Admin

Can:

- View all engagements
- Add new ad-hoc VAPT engagements and reports for mid-year projects
- View reports
- Perform final review and closing meeting
- Approve risk acceptance
- Close engagements. This is the ONLY role authorized to mark an engagement as Closed.
- View audit logs

### Paysys Security Admin

Can:

- View all Paysys-related engagements
- Add ad-hoc projects and reports
- Update engagement statuses except Closed
- Move engagement status to Go-Live
- Manage findings
- Initiate VAPT with Apprise
- Assign findings
- Upload remediation evidence
- Request revalidation
- Review final reports and coordinate with NBP
- View reports

### Paysys Developer

Can:

- View findings assigned to them
- Update remediation notes
- Upload fix evidence
- Mark findings as fixed
- Support production deployment after closure

### Vendor Admin

Can:

- Upload draft reports
- Upload final reports
- Create findings
- Revalidate findings
- Upload revalidation reports

### Auditor

Can:

- View all records
- Export reports
- View audit logs
- Cannot modify data

---

# 6. Data Architecture

## Core Entities

```mermaid
erDiagram
    ORGANIZATION ||--o{ USER : has
    APPLICATION ||--o{ VAPT_ENGAGEMENT : has
    VAPT_ENGAGEMENT ||--o{ SCOPING_RECORD : has
    VAPT_ENGAGEMENT ||--o{ REPORT : has
    VAPT_ENGAGEMENT ||--o{ FINDING : has
    FINDING ||--o{ FINDING_EVIDENCE : has
    FINDING ||--o{ REVALIDATION : has
    FINDING ||--o{ RISK_ACCEPTANCE : may_have
    USER ||--o{ AUDIT_LOG : performs
    REPORT ||--o{ REPORT_ACCESS_LOG : has
```

---

## Main Tables

### organizations

Stores NBP, Paysys, Vendor organizations.

Key fields:

- id
- name
- organization_type
- status
- created_at

---

### users

Stores portal users.

Key fields:

- id
- organization_id
- keycloak_user_id
- full_name
- email
- role
- status
- created_at

---

### applications

Stores application inventory.

Key fields:

- id
- name
- business_owner
- technical_owner
- environment
- url
- criticality
- technology_stack
- internet_facing
- status

---

### vapt_engagements

Stores each VAPT run.

Key fields:

- id
- application_id
- title
- assessment_type
- planned_start_date
- planned_end_date
- actual_start_date
- actual_end_date
- vendor_id
- status
- created_by
- closed_at

---

### scoping_records

Stores scoping meeting details.

The first Engagement Initiation meeting is between Paysys and Apprise / External VAPT Vendor. Bank / NBP attendance is optional and should be recorded in participants when present.

Key fields:

- id
- engagement_id
- meeting_date
- participants
- scope_included
- scope_excluded
- testing_window
- test_accounts_summary
- minutes
- record_status

---

### reports

Stores report metadata. Actual file is stored in MinIO.

Key fields:

- id
- engagement_id
- report_type
- file_name
- object_storage_key
- file_hash
- is_password_protected
- uploaded_by
- uploaded_at
- version
- immutable
- status

---

### findings

Stores each vulnerability.

Key fields:

- id
- engagement_id
- finding_reference
- title
- description
- recommendation
- severity
- status
- assigned_to
- due_date
- cwe
- owasp_category
- created_by
- closed_at

---

### finding_evidence

Stores remediation evidence metadata.

Key fields:

- id
- finding_id
- evidence_type
- notes
- file_object_key
- jira_reference
- git_commit_reference
- uploaded_by
- uploaded_at

---

### revalidations

Stores revalidation attempts.

Key fields:

- id
- finding_id
- revalidation_date
- result
- remarks
- performed_by
- report_id

---

### risk_acceptances

Stores risk acceptance decisions.

Key fields:

- id
- finding_id
- justification
- mitigating_controls
- expiry_date
- nbp_approval_user_id
- paysys_approval_user_id
- status
- approved_at

---

### audit_logs

Stores immutable audit records.

Key fields:

- id
- user_id
- organization_id
- action
- entity_type
- entity_id
- old_value
- new_value
- ip_address
- user_agent
- created_at

---

### report_access_logs

Stores report access events.

Key fields:

- id
- report_id
- user_id
- action
- success
- ip_address
- created_at

Important: PDF passwords must never be stored in this table.

---

# 7. Document Storage Architecture

## Storage Principle

All uploaded files are stored in MinIO.

The database stores only metadata and object keys.

```mermaid
flowchart LR
    FE[Frontend Upload] --> API[Backend API]
    API --> DB[(Report Metadata)]
    API --> MINIO[(MinIO Bucket)]
```

---

## Bucket Structure

Recommended structure:

```text
vapt-tracker/
  engagements/
    {engagement_id}/
      scope/
      reports/
      evidence/
      risk-acceptance/
```

Example:

```text
vapt-tracker/engagements/eng-2026-001/reports/final-report-v1.pdf
```

---

## File Integrity

For every upload, generate:

- SHA-256 hash
- Upload timestamp
- Uploader ID
- Version number

---

# 8. Password-Protected PDF Architecture

## Requirement

Apprise uploads VAPT reports as password-protected PDF files.

The system must store these PDFs as-is and prompt users for the password when they attempt to view the report.

---

## Design Principles

- Do not require password during upload
- Store original PDF unchanged
- Do not store PDF passwords
- Do not log PDF passwords
- Do not store decrypted PDFs
- Decrypt only in user session / browser memory

---

## Recommended Flow

```mermaid
sequenceDiagram
    participant User
    participant Portal
    participant API
    participant MinIO
    participant PDFJS as PDF.js Viewer

    User->>Portal: Click View Report
    Portal->>API: Request report metadata
    API->>Portal: Report is password protected
    Portal->>User: Prompt for PDF password
    User->>PDFJS: Enter password
    PDFJS->>API: Request encrypted PDF stream
    API->>MinIO: Fetch encrypted PDF
    MinIO->>API: Return encrypted PDF
    API->>PDFJS: Stream encrypted PDF
    PDFJS->>PDFJS: Decrypt in browser memory
    PDFJS->>User: Display PDF
```

---

## Upload Detection

During upload, backend should attempt to detect whether PDF is encrypted.

If encrypted:

```text
is_password_protected = true
```

If detection fails, allow manual marking by uploader.

---

## Password Handling Rules

The PDF password:

- Is entered only by the viewing user
- Is used only by PDF.js
- Is never sent to application logs
- Is never saved in the database
- Is never included in audit records
- Is cleared when viewer closes or session expires

---

## Audit Events for PDF Viewing

| Event | Description |
|---|---|
| REPORT_VIEW_REQUESTED | User attempted to open report |
| REPORT_VIEW_SUCCESS | Report successfully opened |
| REPORT_VIEW_FAILED | Incorrect password or access failure |
| REPORT_DOWNLOADED | Original encrypted PDF downloaded |

No password value is ever recorded.

---

# 9. Workflow Architecture

## Engagement Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Planned
    Planned --> PaysysAppriseInitiated
    PaysysAppriseInitiated --> AppriseAssessment
    AppriseAssessment --> DraftReportUploaded
    DraftReportUploaded --> PaysysTriage
    PaysysTriage --> DeveloperFix
    DeveloperFix --> FixedPendingRevalidation
    FixedPendingRevalidation --> AppriseRevalidation
    AppriseRevalidation --> FinalReportUploaded
    FinalReportUploaded --> PaysysISReviewAndComment
    PaysysISReviewAndComment --> NBPISReviewAndClosingMeeting
    NBPISReviewAndClosingMeeting --> Closed
    Closed --> GoLive
    GoLive --> [*]
```

---

## Finding Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Open
    Open --> Assigned
    Assigned --> InProgress
    InProgress --> FixedPendingRevalidation
    FixedPendingRevalidation --> Passed
    FixedPendingRevalidation --> Failed
    Failed --> InProgress
    Passed --> Closed
    InProgress --> RiskAcceptanceRequested
    RiskAcceptanceRequested --> RiskAccepted
    RiskAccepted --> Closed
    Closed --> [*]
```

---

# 10. Audit Architecture

## Audit Principles

- All business-critical actions must be audited
- Audit logs must be append-only
- No hard delete of records
- Passwords and secrets must never be logged
- Final reports should be immutable after closure

---

## Events to Audit

- User login
- Scoping record created
- Scoping record updated
- Report uploaded
- Report viewed
- Report downloaded
- Finding created
- Finding severity changed
- Finding assigned
- Evidence uploaded
- Revalidation requested
- Revalidation passed
- Revalidation failed
- Risk acceptance requested
- Risk acceptance approved
- Engagement closed

---

# 11. Notification Architecture

## Notification Events

Email notifications should be triggered for:

- Engagement created
- Scoping meeting scheduled
- Scoping record updated
- Report uploaded
- Finding assigned
- Due date approaching
- Finding overdue
- Revalidation requested
- Revalidation completed
- Risk acceptance expiring
- Engagement closed

---

## Email Service

Recommended MVP approach:

```text
Backend API → SMTP Server
```

Future option:

```text
Backend API → Notification Queue → Email / Teams / Slack
```

---

# 12. Dashboard Architecture

Dashboards should be generated from PostgreSQL views or backend aggregation APIs.

## Recommended Dashboard Views

### Executive View

- Total engagements
- Engagements by status
- Findings by severity
- Open critical and high findings
- Overdue findings
- Closure rate

### Application Heatmap

- Application-wise critical/high/medium/low findings
- Open vs closed findings
- Repeat findings

### Vendor Performance View

- Reports submitted on time
- Revalidation turnaround
- Finding quality metrics

### SLA View

- Overdue critical findings
- Overdue high findings
- Average days to close
- Revalidation failure count

---

# 13. API Architecture

## Example API Groups

```text
/auth
/organizations
/users
/applications
/engagements
/scoping
/reports
/findings
/evidence
/revalidations
/risk-acceptance
/audit
/dashboard
/notifications
```

---

## API Principles

- All APIs require authentication
- All APIs enforce RBAC
- All write APIs create audit logs
- All file APIs validate access before returning files
- Pagination required for list APIs
- Search and filters required for findings and engagements

## v0.2.0 Auth API Baseline

```text
GET /me
GET /organizations
POST /organizations
PATCH /organizations/:id
GET /users
POST /users
PATCH /users/:id
```

JWTs are validated against the Keycloak realm issuer and JWKS endpoint. Local users are synchronized from token claims and mapped to organizations in PostgreSQL.

---

# 14. Security Architecture

## Controls

- TLS for all traffic
- MFA for privileged users
- Keycloak for identity
- RBAC at API layer
- File access authorization
- Signed URLs with short expiry for downloads
- Encryption at rest for database and object storage
- Audit trail for sensitive actions
- No hard delete
- Secrets managed using environment variables or vault

---

## Sensitive Data Handling

The following must never be logged:

- PDF passwords
- User passwords
- Keycloak tokens
- Test account passwords
- API keys
- Private keys
- Access tokens

---

# 15. Deployment Architecture

## MVP Deployment

```mermaid
flowchart TB
    Browser --> Nginx
    Nginx --> ReactApp[React Static App]
    Nginx --> API[NestJS API]
    API --> Postgres[(PostgreSQL)]
    API --> MinIO[(MinIO)]
    API --> Keycloak[(Keycloak)]
```

---

## Docker Compose Services

Recommended services:

- frontend
- backend-api
- postgres
- minio
- keycloak
- nginx
- smtp-test-service

---

## Future Production Deployment

- Kubernetes
- External managed PostgreSQL
- External object storage
- Centralized logging
- SIEM integration
- Backup and disaster recovery

---

# 16. Backup and Retention

## Database Backup

- Daily full backup
- Point-in-time recovery if supported
- Minimum retention: 7 years or as per NBP policy

## Object Storage Backup

- Daily object storage backup
- Versioning enabled
- Immutable final reports

## Audit Log Retention

- Minimum retention: 7 years or as per NBP policy
- Append-only storage recommended

---

# 17. MVP Scope

The MVP should include:

1. Login and RBAC
2. Application inventory
3. Annual VAPT calendar
4. Engagement creation and tracking
5. Scoping record capture
6. Report upload and repository
7. Password-protected PDF viewing prompt
8. Findings management
9. Evidence upload
10. Revalidation workflow
11. Risk acceptance workflow
12. Executive dashboard
13. Audit trail
14. Email notifications

---

# 18. Future Enhancements

## Phase 2

- JIRA integration
- CVSS scoring
- SLA automation
- Bulk finding import from Excel/PDF
- Advanced reporting

## Phase 3

- AI-assisted VAPT report parsing
- AI finding deduplication
- AI remediation recommendations
- AI executive summaries
- Repeat vulnerability detection
- SIEM integration

---

# 19. Key Implementation Notes for Codex

A human developer using Codex should build the project in small vertical slices.

Recommended sequence:

1. Scaffold monorepo
2. Add authentication and RBAC
3. Create application inventory
4. Create engagement calendar
5. Add report upload to MinIO
6. Add password-protected PDF viewer
7. Add findings lifecycle
8. Add evidence upload
9. Add revalidation workflow
10. Add audit logging to all write operations
11. Add dashboards
12. Add notifications

Each feature should include:

- Backend API
- Database migration
- Frontend screen
- Unit tests
- Basic integration tests
- Audit events where applicable

---

# 20. Architecture Success Criteria

The architecture is successful if:

- All parties have controlled visibility
- Reports are stored securely
- Password-protected PDFs remain protected
- Findings are traceable from discovery to closure
- Every critical action has an audit trail
- Dashboards replace manual Excel reporting
- The system can support future AI-assisted report ingestion
