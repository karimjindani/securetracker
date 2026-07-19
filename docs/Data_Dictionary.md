# SecureTracker Data Dictionary

Current software version: `v0.18.9`  
Documentation baseline: `v0.18.10`  
Source of truth: `prisma/schema.prisma`

## Enums

| Enum | Values | Meaning |
|---|---|---|
| `OrganizationType` | `NBP`, `PAYSYS`, `VENDOR`, `AUDITOR` | Workflow-party classification. Current seeded organizations are NBP, Paysys Labs, and Apprise. |
| `RecordStatus` | `ACTIVE`, `INACTIVE`, `ARCHIVED` | Generic lifecycle for master records. |
| `ScopingRecordStatus` | `DRAFT`, `FINAL` | Scoping note state. |
| `UserRole` | `SYSTEM_ADMIN`, `NBP_SECURITY_ADMIN`, `NBP_VIEWER`, `PAYSYS_SECURITY_ADMIN`, `PAYSYS_DEVELOPER`, `VENDOR_ADMIN`, `AUDITOR` | Portal roles enforced by backend RBAC. |
| `AssessmentType` | `WHITEBOX`, `BLACK_GREY` | Supported VAPT assessment categories. |
| `EngagementStatus` | `PLANNED`, `PAYSYS_APPRISE_INITIATED`, `APPRISE_ASSESSMENT`, `DRAFT_REPORT_UPLOADED`, `PAYSYS_TRIAGE`, `DEVELOPER_FIX`, `FIXED_PENDING_REVALIDATION`, `APPRISE_REVALIDATION`, `FINAL_REPORT_UPLOADED`, `PAYSYS_IS_REVIEW_AND_COMMENT`, `NBP_IS_REVIEW_CLOSING_MEETING`, `CLOSED`, `GO_LIVE`, `CANCELLED` | Engagement lifecycle states. |
| `ReportType` | `DRAFT_REPORT`, `REVALIDATION_REPORT`, `FINAL_REPORT`, `RISK_ACCEPTANCE_DOCUMENT`, `EVIDENCE_DOCUMENT`, `ADDENDUM` | Report repository document types. There is no formal Scope Document report type. |
| `FindingSeverity` | `CRITICAL`, `HIGH`, `MEDIUM`, `LOW`, `INFORMATIONAL` | Finding severity. |
| `FindingStatus` | `OPEN`, `ASSIGNED`, `IN_PROGRESS`, `FIX_IMPLEMENTED`, `FIXED_PENDING_REVALIDATION`, `REVALIDATION_PASSED`, `REVALIDATION_FAILED`, `RISK_ACCEPTANCE_REQUESTED`, `RISK_ACCEPTED`, `CLOSED` | Finding workflow state. |
| `EvidenceType` | `SCREENSHOT`, `JIRA_REFERENCE`, `GIT_COMMIT`, `CONFIG_CHANGE`, `DEPLOYMENT_EVIDENCE`, `TEST_RESULT`, `DOCUMENT`, `OTHER` | Evidence classification. |
| `RevalidationResult` | `PASSED`, `FAILED` | Vendor revalidation outcome. |
| `RiskAcceptanceStatus` | `REQUESTED`, `APPROVED`, `REJECTED`, `EXPIRED`, `CANCELLED` | Risk acceptance workflow state. |
| `NotificationType` | `ENGAGEMENT_INITIATED`, `ENGAGEMENT_CLOSED`, `REPORT_UPLOADED`, `FINDING_ASSIGNED`, `FINDING_DUE_REMINDER`, `FINDING_OVERDUE`, `REVALIDATION_COMPLETED`, `RISK_ACCEPTANCE_EXPIRING` | Notification categories. |

## Tables And Models

| Model | Purpose | Key Fields | Important Relationships / Indexes |
|---|---|---|---|
| `Organization` | Workflow party records. | `name`, `organizationType`, `status` | One organization has many users. Apprise can be vendor on engagements. |
| `User` | Local metadata synchronized from Keycloak/OIDC identities. | `keycloakUserId`, `fullName`, `email`, `role`, `status`, `lastLoginAt` | Belongs to organization. Connected to created records, assignments, notifications, and audit logs. |
| `Application` | Application inventory under VAPT coverage. | `name`, `businessOwnerName`, `technicalOwnerName`, `environment`, `criticality`, `internetFacing`, `status` | Has many VAPT engagements. Indexed by `status` and `criticality`. |
| `VaptEngagement` | Annual calendar item and engagement workflow record. | `applicationId`, `title`, `assessmentType`, `plannedStartDate`, `plannedEndDate`, `plannedYear`, `plannedMonth`, `status` | Has scoping records, reports, findings, revalidations, and risk acceptances. Indexed by application, year/month, status, and vendor. |
| `ScopingRecord` | Meeting and scope capture notes. | `meetingDate`, `participants`, `scopeIncluded`, `scopeExcluded`, `testingWindowStart`, `testingWindowEnd`, `recordStatus` | Belongs to one engagement. There is no NBP initial scope approval field. |
| `Report` | Logical report record for an engagement. | `reportType`, `title`, `currentVersion`, `status`, `immutable` | Has many versions. Final reports become immutable after closure behavior. |
| `ReportVersion` | Stored file metadata for each report version. | `versionNumber`, `fileName`, `fileMimeType`, `fileSizeBytes`, `objectStorageKey`, `sha256Hash`, `isPasswordProtected` | Unique `sha256Hash`; unique version number per report. |
| `Finding` | Vulnerability finding from assessment activity. | `findingReference`, `title`, `severity`, `status`, `assignedToUserId`, `dueDate`, `fixedAt`, `closedAt` | Belongs to engagement and optionally source report version. Has history, evidence, revalidations, and risk acceptances. |
| `FindingStatusHistory` | Audit-grade finding status trail. | `oldStatus`, `newStatus`, `changedById`, `comments`, `changedAt` | Belongs to finding and user who changed status. |
| `FindingEvidence` | Remediation evidence and references. | `evidenceType`, `title`, `fileObjectKey`, `jiraReference`, `gitCommitReference` | Belongs to finding and uploader. File metadata points to object storage when applicable. |
| `Revalidation` | Vendor revalidation attempts. | `revalidationDate`, `result`, `remarks`, `performedById`, `reportVersionId` | Belongs to finding and engagement. May link to report version. |
| `RiskAcceptance` | Risk acceptance requests and NBP review outcome. | `riskDescription`, `businessJustification`, `mitigatingControls`, `expiryDate`, `status`, `reviewNotes` | Belongs to finding and engagement. Tracks requester and reviewer. |
| `AuditLog` | Cross-module audit trail. | `userId`, `organizationId`, `action`, `entityType`, `entityId`, `oldValue`, `newValue`, `ipAddress`, `createdAt` | Searchable/exportable via Audit page. |
| `Notification` | In-app and email notification record. | `userId`, `notificationType`, `title`, `message`, `entityType`, `entityId`, `isRead`, `emailSent` | Indexed by unread state, type, entity, and creation date. |
| `SystemSetting` | Global portal configuration. | `key`, `value`, `updatedById`, `updatedAt` | Stores operational settings as strings with service-level validation. |

## Operational Field Notes

- All `id` values are UUIDs generated by Prisma/PostgreSQL.
- `createdAt` and `updatedAt` are system-maintained timestamps where present.
- Object storage keys are metadata only; original report/evidence files live in MinIO/S3.
- Password-protected PDF passwords are never modeled or persisted.
- Schedule health is derived, not stored.
- Regression cleanup removes only `REGRESSION_` data; seeded reset restores screenshot-derived validation data.

## Seeded Baseline Dictionary

| Baseline Area | Current Value |
|---|---|
| Organizations | NBP, Paysys Labs, Apprise |
| Users | 7 demo users mapped to the 3 workflow parties |
| Applications | 23 screenshot-derived applications |
| Engagements | 45 2026 calendar engagements |
| Assessment mix | 22 `WHITEBOX`, 23 `BLACK_GREY` |
| Excluded from seed | Scoping records, reports, findings, risk acceptances, tickets, synthetic records |
