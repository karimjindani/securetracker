# VAPT Tracker Portal PRD

## Version 1.0

### Executive Summary
The VAPT Tracker Portal is a centralized platform used by NBP, Paysys Labs, and approved external VAPT service providers to collaboratively plan, execute, monitor, remediate, revalidate, and close Vulnerability Assessment and Penetration Testing (VAPT) engagements.

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
- Approve scope
- View reports
- Close engagements
- Approve risk acceptance

## NBP Security Viewer
- Read-only access

## Paysys Security Administrator
- Manage applications
- Manage engagements
- Assign findings
- Upload remediation evidence

## Paysys Developer
- View assigned findings
- Upload fix evidence

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

- White Box
- Grey Box
- Black Box

Lifecycle Status:

- Planned
- Initiated
- In Progress
- Draft Report
- Fixing
- Revalidation
- Final Report
- Closed

---

# Module 3: Engagement Initiation & Scoping

Formal scoping meeting between:

- NBP Information Security Team
- Paysys Labs
- External VAPT Vendor

Capture:

- Meeting Date
- Participants
- Scope Included
- Scope Excluded
- Testing Window
- Test Accounts
- Assessment Type
- Minutes of Meeting
- Approval Status

Outputs:

- Scope Document
- Contact Matrix
- Architecture Documents
- Test Credentials
- Approved Test Plan

---

# Module 4: Engagement Management

Workflow:

Annual Calendar
→ Scoping Meeting
→ Scope Approval
→ Assessment Execution
→ Draft Report
→ Remediation
→ Revalidation
→ Final Report
→ Closure

---

# Module 5: Report Repository

Document Types:

- Scope Documents
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
- Ready for Revalidation
- Passed
- Failed
- Risk Accepted
- Closed

---

# Module 7: Remediation & Revalidation

Workflow:

Open
→ Assigned
→ Fix Implemented
→ Evidence Uploaded
→ Revalidation Requested
→ Passed / Failed
→ Closed

Failed revalidation automatically reopens the finding.

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

- REPORT_VIEW_REQUESTED
- REPORT_VIEW_SUCCESS
- REPORT_VIEW_FAILED

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
- Complete audit trail
- Centralized report repository
- Full finding lifecycle management
- Elimination of spreadsheet dependency
