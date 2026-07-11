export const roles = [
  'SYSTEM_ADMIN',
  'NBP_SECURITY_ADMIN',
  'NBP_VIEWER',
  'PAYSYS_SECURITY_ADMIN',
  'PAYSYS_DEVELOPER',
  'VENDOR_ADMIN',
  'AUDITOR'
] as const;

export type Role = typeof roles[number];

export const organizationTypes = ['NBP', 'PAYSYS', 'VENDOR', 'AUDITOR'] as const;
export type OrganizationType = typeof organizationTypes[number];

export const engagementStatuses = [
  'PLANNED',
  'PAYSYS_APPRISE_INITIATED',
  'APPRISE_ASSESSMENT',
  'DRAFT_REPORT_UPLOADED',
  'PAYSYS_TRIAGE',
  'DEVELOPER_FIX',
  'FIXED_PENDING_REVALIDATION',
  'APPRISE_REVALIDATION',
  'FINAL_REPORT_UPLOADED',
  'PAYSYS_IS_REVIEW_AND_COMMENT',
  'NBP_IS_REVIEW_CLOSING_MEETING',
  'CLOSED',
  'GO_LIVE',
  'CANCELLED'
] as const;

export type EngagementStatus = typeof engagementStatuses[number];

export const scopingRecordStatuses = ['DRAFT', 'FINAL'] as const;
export type ScopingRecordStatus = typeof scopingRecordStatuses[number];

export const findingStatuses = [
  'OPEN',
  'ASSIGNED',
  'IN_PROGRESS',
  'FIX_IMPLEMENTED',
  'FIXED_PENDING_REVALIDATION',
  'REVALIDATION_PASSED',
  'REVALIDATION_FAILED',
  'RISK_ACCEPTANCE_REQUESTED',
  'RISK_ACCEPTED',
  'CLOSED'
] as const;

export type FindingStatus = typeof findingStatuses[number];

export const assessmentTypes = ['WHITEBOX', 'BLACK_GREY'] as const;
export type AssessmentType = typeof assessmentTypes[number];

export const applicationCriticalities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const;
export type ApplicationCriticality = typeof applicationCriticalities[number];

export const applicationEnvironments = ['PRODUCTION', 'STAGING', 'UAT', 'DEVELOPMENT'] as const;
export type ApplicationEnvironment = typeof applicationEnvironments[number];

export const canManageApplications = (role: Role): boolean =>
  role === 'SYSTEM_ADMIN' || role === 'PAYSYS_SECURITY_ADMIN';

export const canManageCalendar = (role: Role): boolean =>
  role === 'SYSTEM_ADMIN' || role === 'NBP_SECURITY_ADMIN' || role === 'PAYSYS_SECURITY_ADMIN';

export const canAccessOps = (role: Role): boolean => role === 'SYSTEM_ADMIN';

export const canCloseEngagement = (role: Role): boolean => role === 'NBP_SECURITY_ADMIN';

export const canMoveToGoLive = (role: Role): boolean => role === 'PAYSYS_SECURITY_ADMIN';

export const canManageEngagements = (role: Role): boolean =>
  role === 'SYSTEM_ADMIN' || role === 'NBP_SECURITY_ADMIN' || role === 'PAYSYS_SECURITY_ADMIN';

export const canManageScoping = (role: Role): boolean =>
  role === 'SYSTEM_ADMIN' || role === 'PAYSYS_SECURITY_ADMIN';

export const isReadOnlyRole = (role: Role): boolean => role === 'NBP_VIEWER' || role === 'AUDITOR';

export const canManageOrganizations = (role: Role): boolean => role === 'SYSTEM_ADMIN';

export const canManageUsers = (role: Role): boolean => role === 'SYSTEM_ADMIN';

export const navigationByRole: Record<Role, string[]> = {
  SYSTEM_ADMIN: ['dashboard', 'applications', 'calendar', 'engagements', 'organizations', 'users', 'ops'],
  NBP_SECURITY_ADMIN: ['dashboard', 'applications', 'calendar', 'engagements', 'organizations', 'users'],
  NBP_VIEWER: ['dashboard', 'applications', 'calendar', 'engagements'],
  PAYSYS_SECURITY_ADMIN: ['dashboard', 'applications', 'calendar', 'engagements', 'organizations', 'users'],
  PAYSYS_DEVELOPER: ['dashboard', 'applications', 'calendar', 'engagements'],
  VENDOR_ADMIN: ['dashboard', 'applications', 'calendar', 'engagements'],
  AUDITOR: ['dashboard', 'applications', 'calendar', 'engagements']
};

export const isRole = (value: string): value is Role => roles.includes(value as Role);
