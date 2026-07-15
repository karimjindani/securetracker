# VAPT Tracker Portal PRD

## Version 1.0

### Executive Summary
The VAPT Tracker Portal is a centralized platform used by NBP, Paysys Labs, and approved external VAPT service providers to collaboratively plan, execute, monitor, remediate, revalidate, and close Vulnerability Assessment and Penetration Testing (VAPT) engagements.

### v0.11.3 Implementation Note
The current implementation includes API-backed Organizations and Users pages, risk acceptance request/review, live dashboard metrics, and audit search/export in addition to the prior report, finding, evidence, and revalidation workflows. Notifications remain a later slice.

### v0.18.2 Implementation Note
Applications, VAPT Calendar, Engagements, Organizations, and Users now present list data in tables with filters. Dashboard remains in summary-card form.

### v0.18.3 Implementation Note
Notifications are implemented as in-app records with unread counts, mark-read actions, System Admin due-check execution, and Mailpit-backed email delivery for workflow events.

### v0.18.4 Implementation Note
The seeded validation baseline now restores 3 workflow-party organizations, 7 demo users, 25 applications, and 50 annual Whitebox engagements. Engagements render as a Kanban board grouped by lifecycle stage.

### v0.18.5 Implementation Note
Dashboard schedule health now classifies planned and active engagements as On Track, Needs Attention, or At Risk based on planned dates and lifecycle status. Dashboard drill-down links open the Engagements Kanban with the matching schedule-health filter.

---

# Business Objectives

- Single source of truth for all VAPT engagements
- Complete auditability for regulatory reviews
- Track findings from identification until closure
- Shared visibility across NBP, Paysys, and Vendors
- Real-time dashboards and reporting
- Historical security posture tracking

---

# Stakeholders

- NBP Information Security Team
- NBP Application Teams
- Paysys Security Team
- Paysys Development Teams
- External VAPT Vendors (e.g. Apprise)
- Internal and External Auditors
- Executive Management

---

# User Roles

## NBP Security Administrator
- Manage calendar
- Add new ad-hoc VAPT engagements and reports for mid-year projects
- View reports
- Perform final review and closing meeting
- Close engagements. This is the ONLY role authorized to mark an engagement as Closed.
- Approve risk acceptance

## NBP Security Viewer
- Read-only access

## Paysys Security Administrator
- Manage applications
- Possesses full administrative rights across the portal to add ad-hoc projects and reports, update statuses, and manage findings, except the right to mark an engagement as Closed
- Initiate VAPT with Apprise
- Assign findings
- Upload remediation evidence
- Request Apprise revalidation
- Review final reports and coordinate with NBP
- Move engagement status to Go-Live

## Paysys Developer
- View assigned findings
- Upload fix evidence
- Mark findings as fixed
- Support production deployment after closure

## Vendor Administrator
- Upload reports
- Create findings
- Perform revalidation

## Auditor
- Read-only access to all records and audit trails

---

# Module 1: Application Inventory

Fields:

- Application Name
- Business Owner
- Technical Owner
- URL
- Environment
- Criticality
- Technology Stack
- Internet Facing

---

# Module 2: Annual VAPT Calendar

Tracks planned assessments.

Assessment Types:

1. Whitebox
2. Black&Grey

Lifecycle Status:

- Planned
- Paysys-Apprise Initiation
- Apprise Assessment
- Draft Report Uploaded
- Paysys Triage
- Developer Fix
- Fixed (Pending Revalidation)
- Apprise Revalidation
- Final Report Uploaded
- Paysys IS Review & Comment
- NBP IS Review & Closing Meeting
- Closed
- Go-Live

---

# Module 3: Engagement Initiation & Scoping

The first Engagement Initiation meeting is held between:

- Paysys Labs
- Apprise / External VAPT Vendor

Bank / NBP attendance is optional for this first meeting.

Capture:

- Meeting Date
- Participants, including optional Bank / NBP attendees if present
- Scope Included
- Scope Excluded
- Testing Window
- Test Accounts
- Assessment Type
- Minutes of Meeting
- Record Status

Outputs:

- Contact Matrix
- Architecture Documents
- Test Credentials
- Approved Test Plan

---

# Module 4: Engagement Management

Workflow:

Annual Calendar
-> Paysys-Apprise Initiation
-> Apprise Assessment
-> Draft Report Uploaded by Vendor
-> Paysys Triage & Developer Assignment
-> Developer Fix
-> Fixed (Pending Revalidation)
-> Apprise Revalidation
-> Final Report Uploaded by Vendor
-> Paysys IS Review & Comment
-> NBP IS Review & Closing Meeting
-> Closed
-> Go-Live

---

# Module 5: Report Repository

Document Types:

- Draft Reports
- Revalidation Reports
- Final Reports
- Risk Acceptance Documents

Features:

- Versioning
- Download Tracking
- Immutable Final Reports
- Audit Trail

---

# Module 6: Findings Management

Each vulnerability becomes an individual finding.

Fields:

- Finding ID
- Engagement
- Application
- Title
- Description
- Recommendation
- Severity
- Owner
- Due Date
- Status

Severity:

- Critical
- High
- Medium
- Low
- Informational

Status:

- Open
- Assigned
- In Progress
- Fixed (Pending Revalidation)
- Passed
- Failed
- Risk Accepted
- Closed

---

# Module 7: Remediation & Revalidation

Workflow:

Open
-> Assigned
-> Fix Implemented
-> Evidence Uploaded
-> Fixed (Pending Revalidation)
-> Passed / Failed
-> Closed

Failed revalidation automatically reopens the finding and routes it back to the assigned developer for further fixing.

---

# Module 8: Risk Acceptance

Fields:

- Risk Description
- Business Justification
- Mitigating Controls
- Expiry Date

Approvals Required:

- NBP IS
- Paysys Security

---

# Module 9: Dashboards & Reporting

Metrics:

- Total Engagements
- Planned
- In Progress
- Closed
- Critical Open Findings
- High Open Findings
- Overdue Findings
- Revalidation Success Rate

Views:

- Executive Dashboard
- Application Heatmap
- Annual Calendar View

---

# Module 10: Notifications

Notifications for:

- Engagement initiation
- Report upload
- Finding assignment
- Due date reminders
- Revalidation completion
- Risk acceptance expiry
- Engagement closure

Implementation note: notification emails are best-effort; workflow actions remain successful if SMTP delivery fails.

---

# Module 11: Audit Trail

Audit Fields:

- Timestamp
- User
- Organization
- Action
- Old Value
- New Value
- IP Address

No hard deletes permitted.

---

# Password-Protected PDF Support

## Background

Apprise delivers VAPT reports as password-protected PDFs.

The platform must support secure upload and viewing of these documents.

### Requirements

#### Upload

- Upload password-protected PDFs without modification.
- Store original file unchanged.

#### Viewing

When a user opens a protected report:

1. System detects encryption.
2. User is prompted for password.
3. Password validated in memory.
4. PDF displayed if valid.

#### Security

- Passwords must never be stored.
- Passwords must never appear in logs.
- No decrypted copy stored on server.
- Original PDF remains encrypted.

#### Audit Events

- REPORT_UPLOADED
- REPORT_VERSION_UPLOADED
- REPORT_VIEWED
- REPORT_DOWNLOADED

Passwords are never captured in audit records.

### Recommended Technical Design

- Store original PDFs in MinIO.
- Detect encryption metadata.
- Use PDF.js password callback.
- Stream documents securely.
- Decrypt only in memory.

---

# Non-Functional Requirements

## Security

- OIDC / SSO
- MFA
- RBAC
- TLS 1.2+
- Encryption at Rest

## Availability

- Target: 99.5%

## Performance

- Dashboard load < 3 seconds
- Finding search < 2 seconds

---

# Suggested Technology Stack

## Frontend

- React
- TypeScript
- Vite
- Material UI

## Backend

- NestJS
- Node.js
- TypeScript

## Database

- PostgreSQL

## Authentication

- Keycloak

## Object Storage

- MinIO

## Reporting

- Grafana or Metabase

---

# Success Criteria

- 100% VAPT engagements tracked in system

# v0.6.0 Implementation Note

The implemented v0.6.0 baseline adds engagement list/detail pages, lifecycle transitions, scoping records, Report Repository, MinIO-backed PDF uploads/downloads, report version metadata, protected PDF viewer, findings management, developer evidence, and Apprise revalidation. The first Engagement Initiation meeting is captured as Paysys Labs plus Apprise / External VAPT Vendor, with Bank/NBP optional.

NBP does not approve or agree the initial scope in this process. NBP remains responsible for final review/closing meeting governance and is the only role authorized to mark an engagement `Closed`.

No formal `Scope Document` artifact is created. Scoping records capture meeting details, scope included/excluded, testing windows, test account summaries without passwords, and architecture summaries.

Uploaded report PDFs are stored unchanged in MinIO. PDF passwords are never stored, logged, or sent to the backend for validation; protected PDF passwords are entered only inside the browser viewer.
Findings are manually entered, assigned to Paysys Developers, remediated with evidence, and revalidated by Apprise with pass/fail results.
- Complete audit trail
- Centralized report repository
- Full finding lifecycle management
- Elimination of spreadsheet dependency

