# VAPT Tracker Portal
# Epics and User Stories

## Version 1.0

---

# Purpose

This document defines the implementation backlog for the VAPT Tracker Portal.

The document is intended to be used by:

- Human developers
- Codex AI
- Project Managers
- Product Owners

Each Epic contains:

- Business Objective
- User Stories
- Acceptance Criteria
- Suggested Priority

---

# EPIC 1 – Authentication & User Management

## Objective

Provide secure authentication, authorization, and user management.

Priority: P0

---

### US-001 Login

As a user,

I want to log into the VAPT Tracker Portal,

So that I can access information based on my role.

Acceptance Criteria:

- User can authenticate using Keycloak
- Session established successfully
- Unauthorized users denied access

---

### US-002 Logout

As a user,

I want to logout securely,

So that my session is terminated.

Acceptance Criteria:

- Session invalidated
- User redirected to login page

---

### US-003 Role-Based Access Control

As a system,

I want to enforce permissions based on roles,

So that users only access authorized data.

Acceptance Criteria:

- Role permissions enforced at API level
- Role permissions enforced in UI

---

### US-004 User Administration

As a System Administrator,

I want to manage users,

So that access can be controlled.

Acceptance Criteria:

- Create user
- Disable user
- View user details
- Assign roles

---

# EPIC 2 – Organization Management

## Objective

Support multiple organizations.

Priority: P0

---

### US-005 Organization Setup

As an administrator,

I want to manage organizations,

So that NBP, Paysys and Vendors are represented separately.

Acceptance Criteria:

- Create organization
- Edit organization
- Disable organization

---

### US-006 Organization Visibility

As a user,

I want data visibility based on organization,

So that I only see appropriate information.

Acceptance Criteria:

- Data filtered by organization rules

---

# EPIC 3 – Application Inventory

## Objective

Maintain inventory of applications under VAPT governance.

Priority: P0

---

### US-007 Create Application

As a Paysys Security Administrator,

I want to register applications,

So that they can be scheduled for VAPT.

Acceptance Criteria:

- Create application
- Capture criticality
- Capture owners

---

### US-008 Update Application

As a Security Administrator,

I want to update application information,

So that inventory remains accurate.

Acceptance Criteria:

- Application details editable
- Changes audited

---

### US-009 View Application Inventory

As an authorized user,

I want to browse applications,

So that I can review coverage.

Acceptance Criteria:

- Search
- Filter
- Sort

---

# EPIC 4 – Annual VAPT Calendar

## Objective

Manage yearly VAPT planning.

Priority: P0

---

### US-010 Create Calendar Entry

As NBP Security,

I want to create a VAPT schedule,

So that assessments are planned.

Acceptance Criteria:

- Select application
- Select month
- Select assessment type
- Assessment type values are Whitebox and Black&Grey

---

### US-011 Modify Calendar Entry

As NBP Security,

I want to update schedules,

So that planning remains accurate.

Acceptance Criteria:

- Changes tracked in audit log

---

### US-012 Calendar View

As a user,

I want a yearly calendar view,

So that I can see upcoming engagements.

Acceptance Criteria:

- Monthly view
- Yearly view
- Status indicators

---

# EPIC 5 – Engagement Management

## Objective

Track the lifecycle of a VAPT engagement.

Priority: P0

---

### US-013 Create Engagement

As a Security Administrator,

I want to initiate an engagement,

So that execution can begin.

Acceptance Criteria:

- Linked to application
- Linked to calendar entry

---

### US-014 Engagement Workflow

As a system,

I want to manage engagement status,

So that lifecycle is visible.

Acceptance Criteria:

Statuses:

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

Final governance sequence:

- Paysys-Apprise Initiation
- Apprise Assessment
- Draft Report Uploaded by Vendor
- Paysys Triage & Developer Assignment
- Developer Fix
- Fixed (Pending Revalidation)
- Apprise Revalidation
- Final Report Uploaded by Vendor
- Paysys IS Review & Comment
- NBP IS Review & Closing Meeting
- Closed
- Go-Live

---

### US-015 Engagement Dashboard

As a user,

I want to view engagement progress,

So that status is visible.

Acceptance Criteria:

- Timeline view
- Current status
- Key dates

---

# EPIC 6 – Scoping & Initiation

## Objective

Support formal scoping and initiation. Paysys initiates VAPT with Apprise / External VAPT Vendor, with Bank / NBP attendance optional for the first Paysys-Apprise initiation meeting.

Priority: P0

---

### US-016 Create Scoping Record

As Paysys Security,

I want to capture a scoping meeting,

So that scope is documented.

Acceptance Criteria:

- Meeting date
- Participants, including optional Bank / NBP attendees if present
- Scope included
- Scope excluded

---

### US-017 Upload Scoping Attachments

As a user,

I want to upload scoping attachments,

So that records are maintained.

Acceptance Criteria:

- Multiple files supported

Note: scoping attachments are stored with scoping records and are not listed as report repository document types.

---

### US-018 Finalize Scoping Record

As Paysys Security,

I want to finalize the scoping record,

So that initiation details are locked before testing proceeds.

Acceptance Criteria:

- Record status changes from Draft to Final
- Audit trail

---

# EPIC 7 – Report Repository

## Objective

Store and manage VAPT reports.

Priority: P0

---

### US-019 Upload Draft Report

As Vendor,

I want to upload a draft report,

So that findings can be reviewed.

Acceptance Criteria:

- PDF upload supported
- Version tracking

---

### US-020 Upload Final Report

As Vendor,

I want to upload final reports,

So that closure documentation exists.

Acceptance Criteria:

- Immutable option available

---

### US-021 Report Versioning

As a user,

I want report versions retained,

So that historical copies are available.

Acceptance Criteria:

- Previous versions accessible

---

# EPIC 8 – Password Protected PDF Viewer

## Objective

Allow viewing of password-protected Apprise reports.

Priority: P0

---

### US-022 Upload Protected PDF

As Vendor,

I want to upload password-protected PDFs,

So that report security remains intact.

Acceptance Criteria:

- Original file stored unchanged

---

### US-023 Open Protected PDF

As a user,

I want to enter a PDF password,

So that I can view the report.

Acceptance Criteria:

- Password prompt shown
- PDF opens successfully

---

### US-024 Incorrect Password Handling

As a user,

I want feedback when password is incorrect,

So that I can retry.

Acceptance Criteria:

- Friendly error displayed

---

### US-025 Password Security

As a system,

I must never store PDF passwords,

So that report confidentiality is maintained.

Acceptance Criteria:

- No password stored
- No password logged

---

# EPIC 9 – Findings Management

## Objective

Track vulnerabilities from identification to closure.

Priority: P0

---

### US-026 Create Finding

As Vendor,

I want to record findings,

So that vulnerabilities are tracked.

Acceptance Criteria:

- Severity
- Description
- Recommendation
- Findings originate from the Apprise draft report

---

### US-027 Assign Finding

As Security Administrator,

I want to assign findings,

So that ownership is clear.

Acceptance Criteria:

- Assigned user captured
- Paysys IS triages the draft report before assignment

---

### US-028 Update Finding Status

As Developer,

I want to update remediation progress,

So that stakeholders are informed.

Acceptance Criteria:

- Status changes recorded
- Developer can mark a remediated finding as Fixed (Pending Revalidation)

---

### US-029 View Findings

As User,

I want to search findings,

So that issues can be analyzed.

Acceptance Criteria:

- Search
- Filter
- Severity filtering

---

# EPIC 10 – Remediation Evidence

## Objective

Track evidence for fixes.

Priority: P1

---

### US-030 Upload Evidence

As Developer,

I want to upload remediation evidence,

So that fixes can be validated.

Acceptance Criteria:

- File upload
- Notes
- References

---

### US-031 Link JIRA Tickets

As Developer,

I want to reference JIRA tickets,

So that implementation work is traceable.

Acceptance Criteria:

- Ticket ID field

---

### US-032 Link Commits

As Developer,

I want to link commits,

So that code changes are traceable.

Acceptance Criteria:

- Commit reference field

---

# EPIC 11 – Revalidation Workflow

## Objective

Track retesting of findings.

Priority: P0

---

### US-033 Request Revalidation

As Paysys Security,

I want to request revalidation,

So that fixes can be tested.

Acceptance Criteria:

- Request recorded
- Request is sent to Apprise after developer marks findings Fixed (Pending Revalidation)

---

### US-034 Record Revalidation Result

As Vendor,

I want to record revalidation results,

So that findings can be closed.

Acceptance Criteria:

- Pass
- Fail
- Passed findings can proceed toward final reporting
- Failed findings are routed back to developers

---

### US-035 Reopen Failed Findings

As a system,

I want failed findings reopened,

So that remediation continues.

Acceptance Criteria:

- Status automatically updated
- Failed revalidation returns the finding to developer fixing workflow

---

### US-036 Coordinate Go-Live

As Paysys Security,

I want to coordinate production deployment with NBP POCs after formal closure,

So that validated security fixes are promoted to production.

Acceptance Criteria:

- Engagement must be Closed before Go-Live
- NBP POC deployment coordination captured
- Go-Live status update recorded

---

# EPIC 12 – Risk Acceptance

## Objective

Manage formally accepted risks.

Priority: P1

---

### US-036 Request Risk Acceptance

As Paysys Security,

I want to request risk acceptance,

So that unresolved issues can be documented.

Acceptance Criteria:

- Justification captured

---

### US-037 Approve Risk Acceptance

As NBP Security,

I want to approve risk acceptance,

So that governance requirements are met.

Acceptance Criteria:

- Approval workflow

---

### US-038 Expiry Monitoring

As a system,

I want to track expiry dates,

So that accepted risks are reviewed.

Acceptance Criteria:

- Notifications generated

---

# EPIC 13 – Notifications

## Objective

Notify stakeholders of important events.

Priority: P1

---

### US-039 Send Assignment Notification

As a system,

I want to notify assigned users,

So that work begins quickly.

Acceptance Criteria:

- Email generated

---

### US-040 Due Date Reminder

As a system,

I want to send reminders,

So that findings are addressed on time.

Acceptance Criteria:

- Configurable reminder period

---

### US-041 Overdue Notification

As a system,

I want to alert stakeholders,

So that overdue findings are escalated.

Acceptance Criteria:

- Escalation email sent

---

# EPIC 14 – Dashboards & Reporting

## Objective

Provide management visibility.

Priority: P0

---

### US-042 Executive Dashboard

As Management,

I want a high-level dashboard,

So that security posture is visible.

Acceptance Criteria:

- Total engagements
- Open findings
- Critical findings
- Overdue findings

---

### US-043 Security Heatmap

As Security Team,

I want application risk heatmaps,

So that risk concentration is visible.

Acceptance Criteria:

- Severity by application

---

### US-044 Calendar Dashboard

As User,

I want calendar reporting,

So that upcoming engagements are visible.

Acceptance Criteria:

- Annual schedule view

---

### US-045 Vendor Performance Dashboard

As Management,

I want vendor metrics,

So that vendor performance can be reviewed.

Acceptance Criteria:

- Turnaround times
- Report delivery statistics

---

# EPIC 15 – Audit Trail

## Objective

Maintain a complete audit history.

Priority: P0

---

### US-046 Audit Logging

As a system,

I want important actions logged,

So that activity is traceable.

Acceptance Criteria:

- Audit entries generated automatically

---

### US-047 Audit Search

As Auditor,

I want to search audit logs,

So that investigations can be performed.

Acceptance Criteria:

- Filter by user
- Filter by action
- Filter by date

---

### US-048 Audit Export

As Auditor,

I want to export logs,

So that reviews can be conducted.

Acceptance Criteria:

- CSV export

---

# EPIC 16 – Administration

## Objective

Provide system administration capabilities.

Priority: P2

---

### US-049 Manage Reference Data

As System Administrator,

I want to manage lookup values,

So that the platform remains configurable.

Acceptance Criteria:

- Severity lists
- Status lists
- Assessment types

---

### US-050 System Configuration

As System Administrator,

I want to manage system settings,

So that operational parameters can be controlled.

Acceptance Criteria:

- Notification settings
- Retention settings

---

# MVP Release Scope

The MVP should include:

Epic 1 – Authentication & User Management
Epic 2 – Organization Management
Epic 3 – Application Inventory
Epic 4 – Annual VAPT Calendar
Epic 5 – Engagement Management
Epic 6 – Scoping & Initiation
Epic 7 – Report Repository
Epic 8 – Password Protected PDF Viewer
Epic 9 – Findings Management
Epic 11 – Revalidation Workflow
Epic 14 – Dashboards & Reporting
Epic 15 – Audit Trail

---

# Phase 2 Scope

Epic 10 – Remediation Evidence
Epic 12 – Risk Acceptance
Epic 13 – Notifications
Epic 16 – Administration

---

# Future Phase 3

- JIRA Integration
- CVSS Automation
- AI Report Parsing
- AI Finding Extraction
- AI Executive Summaries
- SIEM Integration
- SLA Analytics
