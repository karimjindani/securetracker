# SecureTracker Data Model

Current software version: `v0.18.9`  
Documentation baseline: `v0.18.10`  
Source of truth: `prisma/schema.prisma`

## Core Entity Relationship Model

```mermaid
erDiagram
    ORGANIZATION ||--o{ USER : has
    ORGANIZATION ||--o{ VAPT_ENGAGEMENT : vendor_for
    USER ||--o{ APPLICATION : creates
    USER ||--o{ VAPT_ENGAGEMENT : creates
    APPLICATION ||--o{ VAPT_ENGAGEMENT : has
    VAPT_ENGAGEMENT ||--o{ SCOPING_RECORD : has
    VAPT_ENGAGEMENT ||--o{ REPORT : has
    VAPT_ENGAGEMENT ||--o{ FINDING : has
    VAPT_ENGAGEMENT ||--o{ REVALIDATION : has
    VAPT_ENGAGEMENT ||--o{ RISK_ACCEPTANCE : has
    REPORT ||--o{ REPORT_VERSION : versions
    REPORT_VERSION ||--o{ FINDING : source_for
    REPORT_VERSION ||--o{ REVALIDATION : evidence_for
    FINDING ||--o{ FINDING_STATUS_HISTORY : history
    FINDING ||--o{ FINDING_EVIDENCE : evidence
    FINDING ||--o{ REVALIDATION : revalidated_by
    FINDING ||--o{ RISK_ACCEPTANCE : risk_acceptance
    USER ||--o{ NOTIFICATION : receives
    USER ||--o{ AUDIT_LOG : performs
```

## Governance And Identity

```mermaid
classDiagram
    class Organization {
      uuid id
      string name
      OrganizationType organizationType
      RecordStatus status
    }
    class User {
      uuid id
      uuid organizationId
      string keycloakUserId
      string fullName
      string email
      UserRole role
      RecordStatus status
      datetime lastLoginAt
    }
    class AuditLog {
      uuid id
      uuid userId
      uuid organizationId
      string action
      string entityType
      uuid entityId
      json oldValue
      json newValue
      datetime createdAt
    }
    Organization "1" --> "*" User
    User "1" --> "*" AuditLog
```

Organizations are the workflow parties, not arbitrary departments:

- NBP: Client / Bank governance party
- Paysys Labs: SaaS service provider / portal operator
- Apprise: VAPT service provider

## Engagement And Scoping

```mermaid
classDiagram
    class Application {
      uuid id
      string name
      string businessOwnerName
      string technicalOwnerName
      string environment
      string criticality
      bool internetFacing
      RecordStatus status
    }
    class VaptEngagement {
      uuid id
      uuid applicationId
      string title
      AssessmentType assessmentType
      datetime plannedStartDate
      datetime plannedEndDate
      int plannedYear
      string plannedMonth
      EngagementStatus status
      uuid vendorOrganizationId
    }
    class ScopingRecord {
      uuid id
      uuid engagementId
      datetime meetingDate
      string participants
      string scopeIncluded
      string scopeExcluded
      ScopingRecordStatus recordStatus
    }
    Application "1" --> "*" VaptEngagement
    VaptEngagement "1" --> "*" ScopingRecord
```

Schedule health is derived at read time from engagement status plus planned start/end dates. It is not stored in the database.

## Reports, Findings, And Risk

```mermaid
classDiagram
    class Report {
      uuid id
      uuid engagementId
      ReportType reportType
      string title
      int currentVersion
      bool immutable
    }
    class ReportVersion {
      uuid id
      uuid reportId
      int versionNumber
      string fileName
      bigint fileSizeBytes
      string objectStorageKey
      string sha256Hash
      bool isPasswordProtected
    }
    class Finding {
      uuid id
      uuid engagementId
      string findingReference
      string title
      FindingSeverity severity
      FindingStatus status
      uuid assignedToUserId
      datetime dueDate
    }
    class FindingEvidence {
      uuid id
      uuid findingId
      EvidenceType evidenceType
      string title
      string fileObjectKey
      string jiraReference
    }
    class Revalidation {
      uuid id
      uuid findingId
      uuid engagementId
      RevalidationResult result
      datetime revalidationDate
    }
    class RiskAcceptance {
      uuid id
      uuid findingId
      uuid engagementId
      RiskAcceptanceStatus status
      datetime expiryDate
    }
    Report "1" --> "*" ReportVersion
    ReportVersion "1" --> "*" Finding
    Finding "1" --> "*" FindingEvidence
    Finding "1" --> "*" Revalidation
    Finding "1" --> "*" RiskAcceptance
```

Report and evidence files are stored in object storage. PostgreSQL stores metadata, ownership, workflow state, and audit trail data.

## Operational Entities

```mermaid
classDiagram
    class Notification {
      uuid id
      uuid userId
      NotificationType notificationType
      string title
      string entityType
      uuid entityId
      bool isRead
      bool emailSent
      datetime createdAt
    }
    class SystemSetting {
      string key
      string value
      uuid updatedById
      datetime updatedAt
    }
    User "1" --> "*" Notification
```

System settings are global portal settings. They currently control default page size, schedule-health warning days, notification reminder days, risk acceptance expiry reminder days, email enablement, scheduler enablement, and audit retention target.

## Current Seeded Data

The reset baseline is validation data only:

- 3 organizations
- 7 demo users
- 23 screenshot-derived applications
- 45 2026 engagements
- 22 Whitebox and 23 Black/Grey assessments
- no seeded scoping records, reports, findings, risk acceptances, tickets, or synthetic application records
