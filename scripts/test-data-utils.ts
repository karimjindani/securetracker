import { PrismaClient } from '@prisma/client';
import { Client as MinioClient } from 'minio';

export const regressionPrefix = process.env.REGRESSION_DATA_PREFIX ?? 'REGRESSION_';

export interface CleanupSummary {
  prefix: string;
  applications: number;
  engagements: number;
  auditLogs: number;
  users: number;
  organizations: number;
  notifications: number;
  reportObjects: number;
}

export interface ResetSummary extends CleanupSummary {
  baselineSettings: number;
  baselineOrganizations: number;
  baselineUsers: number;
  baselineApplications: number;
  baselineEngagements: number;
  baselineScopingRecords: number;
  baselineWhiteboxEngagements: number;
  baselineBlackGreyEngagements: number;
}

export async function cleanupRegressionData(prisma = new PrismaClient()): Promise<CleanupSummary> {
  const regressionApplications = await prisma.application.findMany({
    where: { name: { startsWith: regressionPrefix } },
    select: { id: true }
  });
  const regressionEngagements = await prisma.vaptEngagement.findMany({
    where: {
      OR: [
        { title: { startsWith: regressionPrefix } },
        { applicationId: { in: regressionApplications.map((application) => application.id) } }
      ]
    },
    select: { id: true }
  });
  const regressionUsers = await prisma.user.findMany({
    where: {
      OR: [{ email: { startsWith: regressionPrefix } }, { fullName: { startsWith: regressionPrefix } }]
    },
    select: { id: true }
  });
  const regressionOrganizations = await prisma.organization.findMany({
    where: { name: { startsWith: regressionPrefix } },
    select: { id: true }
  });

  const engagementIds = regressionEngagements.map((engagement) => engagement.id);
  const applicationIds = regressionApplications.map((application) => application.id);
  const userIds = regressionUsers.map((user) => user.id);
  const organizationIds = regressionOrganizations.map((organization) => organization.id);
  const regressionRiskAcceptances = await prisma.riskAcceptance.findMany({
    where: { engagementId: { in: engagementIds } },
    select: { id: true }
  });
  const riskAcceptanceIds = regressionRiskAcceptances.map((riskAcceptance) => riskAcceptance.id);

  const reportVersions = await prisma.reportVersion.findMany({
    where: { report: { engagementId: { in: engagementIds } } },
    select: { objectStorageKey: true }
  });
  const findingEvidence = await prisma.findingEvidence.findMany({
    where: { finding: { engagementId: { in: engagementIds } }, fileObjectKey: { not: null } },
    select: { fileObjectKey: true }
  });
  const reportObjects = await removeReportObjects(reportVersions.map((version) => version.objectStorageKey));
  const evidenceObjects = await removeReportObjects(
    findingEvidence.map((evidence) => evidence.fileObjectKey).filter((key): key is string => Boolean(key))
  );

  const auditLogs = await prisma.auditLog.deleteMany({
    where: {
      OR: [
        { entityId: { in: [...engagementIds, ...applicationIds, ...userIds, ...organizationIds, ...riskAcceptanceIds] } },
        { action: { startsWith: 'REGRESSION_' } }
      ]
    }
  });
  const notifications = await prisma.notification.deleteMany({
    where: {
      OR: [
        { userId: { in: userIds } },
        { entityId: { in: [...engagementIds, ...applicationIds, ...userIds, ...organizationIds, ...riskAcceptanceIds] } }
      ]
    }
  });
  await prisma.revalidation.deleteMany({ where: { engagementId: { in: engagementIds } } });
  await prisma.riskAcceptance.deleteMany({ where: { id: { in: riskAcceptanceIds } } });
  await prisma.findingEvidence.deleteMany({ where: { finding: { engagementId: { in: engagementIds } } } });
  await prisma.findingStatusHistory.deleteMany({ where: { finding: { engagementId: { in: engagementIds } } } });
  await prisma.finding.deleteMany({ where: { engagementId: { in: engagementIds } } });
  await prisma.reportVersion.deleteMany({
    where: { report: { engagementId: { in: engagementIds } } }
  });
  await prisma.report.deleteMany({ where: { engagementId: { in: engagementIds } } });
  await prisma.scopingRecord.deleteMany({ where: { engagementId: { in: engagementIds } } });
  const engagements = await prisma.vaptEngagement.deleteMany({
    where: {
      OR: [{ id: { in: engagementIds } }, { applicationId: { in: applicationIds } }]
    }
  });
  const applications = await prisma.application.deleteMany({ where: { id: { in: applicationIds } } });
  const users = await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  const organizations = await prisma.organization.deleteMany({ where: { id: { in: organizationIds } } });

  return {
    prefix: regressionPrefix,
    applications: applications.count,
    engagements: engagements.count,
    auditLogs: auditLogs.count,
    users: users.count,
    organizations: organizations.count,
    notifications: notifications.count,
    reportObjects: reportObjects + evidenceObjects
  };
}

async function removeReportObjects(objectKeys: string[]) {
  if (objectKeys.length === 0) return 0;
  try {
    const client = new MinioClient({
      endPoint: process.env.MINIO_ENDPOINT ?? 'localhost',
      port: Number(process.env.MINIO_PORT ?? 9000),
      useSSL: (process.env.MINIO_USE_SSL ?? 'false') === 'true',
      accessKey: process.env.MINIO_ROOT_USER ?? process.env.MINIO_ACCESS_KEY ?? 'securetracker',
      secretKey: process.env.MINIO_ROOT_PASSWORD ?? process.env.MINIO_SECRET_KEY ?? 'securetracker-secret'
    });
    await client.removeObjects(process.env.MINIO_BUCKET ?? 'vapt-tracker', objectKeys);
    return objectKeys.length;
  } catch {
    return 0;
  }
}

export async function resetToSeededData(prisma = new PrismaClient()): Promise<ResetSummary> {
  const cleanup = await cleanupRegressionData(prisma);

  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.revalidation.deleteMany();
  await prisma.riskAcceptance.deleteMany();
  await prisma.findingEvidence.deleteMany();
  await prisma.findingStatusHistory.deleteMany();
  await prisma.finding.deleteMany();
  await prisma.reportVersion.deleteMany();
  await prisma.report.deleteMany();
  await prisma.scopingRecord.deleteMany();
  await prisma.vaptEngagement.deleteMany();
  await prisma.application.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.systemSetting.deleteMany();

  const baseline = await seedBaselineData(prisma);

  return {
    ...cleanup,
    ...baseline
  };
}

export async function seedBaselineData(prisma = new PrismaClient()) {
  const baselineSettings = await seedBaselineSettings(prisma);
  const baselineOrganizations = await seedBaselineOrganizations(prisma);
  const baselineUsers = await seedBaselineUsers(prisma);
  const baselineApplications = await seedBaselineApplications(prisma);
  const baselineEngagements = await seedBaselineEngagements(prisma);

  return {
    baselineSettings,
    baselineOrganizations,
    baselineUsers,
    baselineApplications: baselineApplications.count,
    baselineEngagements: baselineEngagements.engagements,
    baselineScopingRecords: baselineEngagements.scopingRecords,
    baselineWhiteboxEngagements: baselineEngagements.whiteboxEngagements,
    baselineBlackGreyEngagements: baselineEngagements.blackGreyEngagements
  };
}

export async function seedBaselineSettings(prisma = new PrismaClient()) {
  const settings = [
    ['DEFAULT_PAGE_SIZE', '10'],
    ['SCHEDULE_HEALTH_WARNING_DAYS', '7'],
    ['NOTIFICATION_REMINDER_DAYS', '7'],
    ['RISK_ACCEPTANCE_EXPIRY_REMINDER_DAYS', '14'],
    ['NOTIFICATIONS_EMAIL_ENABLED', 'true'],
    ['NOTIFICATIONS_SCHEDULER_ENABLED', 'false'],
    ['AUDIT_RETENTION_DAYS', '365']
  ] as const;

  for (const [key, value] of settings) {
    await prisma.systemSetting.upsert({
      where: { key },
      update: { value, updatedById: undefined },
      create: { key, value }
    });
  }

  return settings.length;
}

export async function seedBaselineOrganizations(prisma = new PrismaClient()) {
  const organizations = [
    { name: 'NBP', organizationType: 'NBP' as const },
    { name: 'Paysys Labs', organizationType: 'PAYSYS' as const },
    { name: 'Apprise', organizationType: 'VENDOR' as const }
  ];

  for (const organization of organizations) {
    await prisma.organization.upsert({
      where: { name: organization.name },
      update: { organizationType: organization.organizationType, status: 'ACTIVE' },
      create: organization
    });
  }

  return organizations.length;
}

export async function seedBaselineUsers(prisma = new PrismaClient()) {
  const organizations = await prisma.organization.findMany();
  const organizationByName = new Map(organizations.map((organization) => [organization.name, organization.id]));
  const users = [
    {
      keycloakUserId: 'seed-system-admin',
      fullName: 'System Admin',
      email: 'system.admin@example.local',
      role: 'SYSTEM_ADMIN' as const,
      organizationName: 'Paysys Labs'
    },
    {
      keycloakUserId: 'seed-nbp-admin',
      fullName: 'NBP Admin',
      email: 'nbp.admin@example.local',
      role: 'NBP_SECURITY_ADMIN' as const,
      organizationName: 'NBP'
    },
    {
      keycloakUserId: 'seed-nbp-viewer',
      fullName: 'NBP Viewer',
      email: 'nbp.viewer@example.local',
      role: 'NBP_VIEWER' as const,
      organizationName: 'NBP'
    },
    {
      keycloakUserId: 'seed-paysys-admin',
      fullName: 'Paysys Admin',
      email: 'paysys.admin@example.local',
      role: 'PAYSYS_SECURITY_ADMIN' as const,
      organizationName: 'Paysys Labs'
    },
    {
      keycloakUserId: 'seed-paysys-dev',
      fullName: 'Paysys Developer',
      email: 'paysys.dev@example.local',
      role: 'PAYSYS_DEVELOPER' as const,
      organizationName: 'Paysys Labs'
    },
    {
      keycloakUserId: 'seed-apprise-vendor',
      fullName: 'Apprise Vendor',
      email: 'apprise.vendor@example.local',
      role: 'VENDOR_ADMIN' as const,
      organizationName: 'Apprise'
    },
    {
      keycloakUserId: 'seed-auditor',
      fullName: 'External Auditor',
      email: 'auditor@example.local',
      role: 'AUDITOR' as const,
      organizationName: 'NBP'
    }
  ];

  for (const user of users) {
    const organizationId = organizationByName.get(user.organizationName);
    if (!organizationId) throw new Error(`Missing organization for ${user.organizationName}`);
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        organizationId,
        keycloakUserId: user.keycloakUserId,
        fullName: user.fullName,
        role: user.role,
        status: 'ACTIVE'
      },
      create: {
        organizationId,
        keycloakUserId: user.keycloakUserId,
        fullName: user.fullName,
        email: user.email,
        role: user.role
      }
    });
  }

  return users.length;
}

async function seedBaselineApplications(prisma: PrismaClient) {
  const paysysAdmin = await prisma.user.findUniqueOrThrow({ where: { email: 'paysys.admin@example.local' } });
  const applications = screenshotApplications.map((application, index) => ({
    ...application,
    description: '2026 VAPT calendar application seeded from the supplied tracker screenshots.',
    environment: 'PRODUCTION' as const,
    criticality: index % 4 === 0 ? 'CRITICAL' : 'HIGH',
    technologyStack: 'Screenshot baseline - stack not specified',
    internetFacing: true
  }));

  let count = 0;
  for (const application of applications) {
    const existing = await prisma.application.findFirst({ where: { name: application.name } });
    if (existing) {
      await prisma.application.update({
        where: { id: existing.id },
        data: { ...application, status: 'ACTIVE' }
      });
    } else {
      await prisma.application.create({ data: { ...application, createdById: paysysAdmin.id } });
    }
    count += 1;
  }

  return { count };
}

async function seedBaselineEngagements(prisma: PrismaClient) {
  const paysysAdmin = await prisma.user.findUniqueOrThrow({ where: { email: 'paysys.admin@example.local' } });
  const apprise = await prisma.organization.findUniqueOrThrow({ where: { name: 'Apprise' } });
  const applications = await prisma.application.findMany({
    where: { name: { in: screenshotApplications.map((application) => application.name) } },
    orderBy: { name: 'asc' }
  });
  const applicationByName = new Map(applications.map((application) => [application.name, application]));
  const engagementIndexByMonth = new Map<string, number>();
  let engagements = 0;
  let whiteboxEngagements = 0;
  let blackGreyEngagements = 0;

  for (const entry of screenshotCalendarEntries) {
    const application = applicationByName.get(entry.applicationName);
    if (!application) throw new Error(`Missing screenshot application ${entry.applicationName}`);
    const windowIndex = engagementIndexByMonth.get(entry.month) ?? 0;
    engagementIndexByMonth.set(entry.month, windowIndex + 1);
    const { plannedStartDate, plannedEndDate } = plannedWindow(entry.month, windowIndex);
    const status =
      screenshotStatusByApplication[entry.applicationName] && plannedStartDate <= new Date(Date.UTC(2026, 5, 30, 23, 59, 59))
        ? screenshotStatusByApplication[entry.applicationName]
        : 'PLANNED';

    await prisma.vaptEngagement.create({
      data: {
        applicationId: application.id,
        title: `${entry.applicationName} ${entry.assessmentType === 'WHITEBOX' ? 'Whitebox' : 'Black/Grey'} VAPT - ${entry.month} 2026`,
        assessmentType: entry.assessmentType,
        plannedYear: 2026,
        plannedMonth: entry.month,
        plannedStartDate,
        plannedEndDate,
        vendorOrganizationId: apprise.id,
        status,
        createdById: paysysAdmin.id
      }
    });
    engagements += 1;
    if (entry.assessmentType === 'WHITEBOX') whiteboxEngagements += 1;
    if (entry.assessmentType === 'BLACK_GREY') blackGreyEngagements += 1;
  }

  return { engagements, scopingRecords: 0, whiteboxEngagements, blackGreyEngagements };
}

const screenshotApplications = [
  { name: 'NBP Digital Android (Mobile App)', businessOwnerName: 'Aamir Khan', technicalOwnerName: 'Eiquan' },
  { name: 'NBP Digital IOS (Mobile App)', businessOwnerName: 'Aamir Khan', technicalOwnerName: 'Eiquan' },
  { name: 'NBP Internet Banking', businessOwnerName: 'Aamir Khan', technicalOwnerName: 'Mohsin' },
  { name: 'NBP Digital back office portal', businessOwnerName: 'Aamir Khan', technicalOwnerName: 'Owais' },
  { name: 'NBP digital app services / NBP IB/MB APIs', businessOwnerName: 'Aamir Khan', technicalOwnerName: 'Eiquan' },
  { name: 'NBP RAAST APIs (P2P)', businessOwnerName: 'Omer Khan', technicalOwnerName: 'Yasir' },
  { name: 'NBP RAAST APIs (P2M)', businessOwnerName: 'Omer Khan', technicalOwnerName: 'Yasir' },
  { name: 'NBP MPG RAAST Back office', businessOwnerName: 'Aamir Khan', technicalOwnerName: 'Salman Z' },
  { name: 'NBP DAO Web Portal', businessOwnerName: 'Nasir Khan', technicalOwnerName: 'Saeed' },
  { name: 'NBP DAO APIs', businessOwnerName: 'Nasir Khan', technicalOwnerName: 'Saeed' },
  { name: 'NBP ePayments Portal', businessOwnerName: 'Yasher Ali', technicalOwnerName: 'Huzaifa' },
  { name: 'NBP ePayments APIs', businessOwnerName: 'Yasher Ali', technicalOwnerName: 'Huzaifa' },
  { name: 'NBP ePayments Backoffice', businessOwnerName: 'Omer Khan', technicalOwnerName: 'Babar' },
  { name: 'NBP Merchant Management System', businessOwnerName: 'Omer Khan', technicalOwnerName: 'Mubashir' },
  { name: 'NBP Merchant Portal', businessOwnerName: 'Omer Khan', technicalOwnerName: 'Mubashir' },
  { name: 'NBP Merchant APIs', businessOwnerName: 'Omer Khan', technicalOwnerName: 'Usama' },
  { name: 'NBP WHATSAPP APIs', businessOwnerName: 'Yasher Ali', technicalOwnerName: 'Ahmed A' },
  { name: 'NBP RM Portal', businessOwnerName: 'Nasir Khan', technicalOwnerName: 'Saeed' },
  { name: 'NBP IBFT APIs', businessOwnerName: 'Aamir Khan', technicalOwnerName: 'Umer A' },
  { name: 'NBP UBCS APIs', businessOwnerName: 'Aamir Khan', technicalOwnerName: 'Umer A' },
  { name: 'NBP RAAST OTC P2P', businessOwnerName: 'Omer Khan', technicalOwnerName: 'Asad Arshad' },
  { name: 'NBP RAAST Bulk Sending', businessOwnerName: 'Omer Khan', technicalOwnerName: undefined },
  { name: 'NBP RAAST Bulk Receiving', businessOwnerName: 'Omer Khan', technicalOwnerName: undefined }
];

const screenshotCalendarEntries = [
  { applicationName: 'NBP Digital Android (Mobile App)', month: 'February', assessmentType: 'BLACK_GREY' as const },
  { applicationName: 'NBP Digital Android (Mobile App)', month: 'August', assessmentType: 'WHITEBOX' as const },
  { applicationName: 'NBP Digital IOS (Mobile App)', month: 'February', assessmentType: 'BLACK_GREY' as const },
  { applicationName: 'NBP Digital IOS (Mobile App)', month: 'August', assessmentType: 'WHITEBOX' as const },
  { applicationName: 'NBP Internet Banking', month: 'March', assessmentType: 'WHITEBOX' as const },
  { applicationName: 'NBP Internet Banking', month: 'September', assessmentType: 'BLACK_GREY' as const },
  { applicationName: 'NBP Digital back office portal', month: 'April', assessmentType: 'WHITEBOX' as const },
  { applicationName: 'NBP Digital back office portal', month: 'October', assessmentType: 'BLACK_GREY' as const },
  { applicationName: 'NBP digital app services / NBP IB/MB APIs', month: 'March', assessmentType: 'WHITEBOX' as const },
  { applicationName: 'NBP digital app services / NBP IB/MB APIs', month: 'September', assessmentType: 'BLACK_GREY' as const },
  { applicationName: 'NBP RAAST APIs (P2P)', month: 'June', assessmentType: 'WHITEBOX' as const },
  { applicationName: 'NBP RAAST APIs (P2P)', month: 'November', assessmentType: 'BLACK_GREY' as const },
  { applicationName: 'NBP RAAST APIs (P2M)', month: 'February', assessmentType: 'WHITEBOX' as const },
  { applicationName: 'NBP RAAST APIs (P2M)', month: 'July', assessmentType: 'BLACK_GREY' as const },
  { applicationName: 'NBP MPG RAAST Back office', month: 'November', assessmentType: 'BLACK_GREY' as const },
  { applicationName: 'NBP DAO Web Portal', month: 'January', assessmentType: 'BLACK_GREY' as const },
  { applicationName: 'NBP DAO Web Portal', month: 'July', assessmentType: 'WHITEBOX' as const },
  { applicationName: 'NBP DAO APIs', month: 'March', assessmentType: 'BLACK_GREY' as const },
  { applicationName: 'NBP DAO APIs', month: 'August', assessmentType: 'WHITEBOX' as const },
  { applicationName: 'NBP ePayments Portal', month: 'April', assessmentType: 'WHITEBOX' as const },
  { applicationName: 'NBP ePayments Portal', month: 'October', assessmentType: 'BLACK_GREY' as const },
  { applicationName: 'NBP ePayments APIs', month: 'April', assessmentType: 'BLACK_GREY' as const },
  { applicationName: 'NBP ePayments APIs', month: 'September', assessmentType: 'WHITEBOX' as const },
  { applicationName: 'NBP ePayments Backoffice', month: 'May', assessmentType: 'WHITEBOX' as const },
  { applicationName: 'NBP ePayments Backoffice', month: 'October', assessmentType: 'BLACK_GREY' as const },
  { applicationName: 'NBP Merchant Management System', month: 'May', assessmentType: 'BLACK_GREY' as const },
  { applicationName: 'NBP Merchant Management System', month: 'October', assessmentType: 'WHITEBOX' as const },
  { applicationName: 'NBP Merchant Portal', month: 'April', assessmentType: 'BLACK_GREY' as const },
  { applicationName: 'NBP Merchant Portal', month: 'September', assessmentType: 'WHITEBOX' as const },
  { applicationName: 'NBP Merchant APIs', month: 'January', assessmentType: 'BLACK_GREY' as const },
  { applicationName: 'NBP Merchant APIs', month: 'July', assessmentType: 'WHITEBOX' as const },
  { applicationName: 'NBP WHATSAPP APIs', month: 'May', assessmentType: 'BLACK_GREY' as const },
  { applicationName: 'NBP WHATSAPP APIs', month: 'November', assessmentType: 'WHITEBOX' as const },
  { applicationName: 'NBP RM Portal', month: 'May', assessmentType: 'BLACK_GREY' as const },
  { applicationName: 'NBP RM Portal', month: 'October', assessmentType: 'WHITEBOX' as const },
  { applicationName: 'NBP IBFT APIs', month: 'June', assessmentType: 'BLACK_GREY' as const },
  { applicationName: 'NBP IBFT APIs', month: 'November', assessmentType: 'WHITEBOX' as const },
  { applicationName: 'NBP UBCS APIs', month: 'June', assessmentType: 'BLACK_GREY' as const },
  { applicationName: 'NBP UBCS APIs', month: 'November', assessmentType: 'WHITEBOX' as const },
  { applicationName: 'NBP RAAST OTC P2P', month: 'June', assessmentType: 'BLACK_GREY' as const },
  { applicationName: 'NBP RAAST OTC P2P', month: 'November', assessmentType: 'WHITEBOX' as const },
  { applicationName: 'NBP RAAST Bulk Sending', month: 'July', assessmentType: 'BLACK_GREY' as const },
  { applicationName: 'NBP RAAST Bulk Sending', month: 'October', assessmentType: 'WHITEBOX' as const },
  { applicationName: 'NBP RAAST Bulk Receiving', month: 'July', assessmentType: 'BLACK_GREY' as const },
  { applicationName: 'NBP RAAST Bulk Receiving', month: 'October', assessmentType: 'WHITEBOX' as const }
];

const screenshotStatusByApplication = {
  'NBP Digital Android (Mobile App)': 'CLOSED',
  'NBP Digital IOS (Mobile App)': 'CLOSED',
  'NBP Internet Banking': 'DEVELOPER_FIX',
  'NBP Digital back office portal': 'APPRISE_REVALIDATION',
  'NBP digital app services / NBP IB/MB APIs': 'DEVELOPER_FIX',
  'NBP RAAST APIs (P2P)': 'DEVELOPER_FIX',
  'NBP RAAST APIs (P2M)': 'CLOSED',
  'NBP DAO Web Portal': 'DEVELOPER_FIX',
  'NBP DAO APIs': 'DEVELOPER_FIX',
  'NBP ePayments Portal': 'NBP_IS_REVIEW_CLOSING_MEETING',
  'NBP ePayments APIs': 'NBP_IS_REVIEW_CLOSING_MEETING',
  'NBP ePayments Backoffice': 'NBP_IS_REVIEW_CLOSING_MEETING',
  'NBP Merchant Management System': 'PLANNED',
  'NBP Merchant Portal': 'PLANNED',
  'NBP Merchant APIs': 'PLANNED',
  'NBP WHATSAPP APIs': 'APPRISE_ASSESSMENT',
  'NBP RM Portal': 'DEVELOPER_FIX',
  'NBP IBFT APIs': 'APPRISE_ASSESSMENT',
  'NBP UBCS APIs': 'APPRISE_ASSESSMENT',
  'NBP RAAST OTC P2P': 'APPRISE_ASSESSMENT'
} as const;

const monthIndexByName = new Map([
  ['January', 0],
  ['February', 1],
  ['March', 2],
  ['April', 3],
  ['May', 4],
  ['June', 5],
  ['July', 6],
  ['August', 7],
  ['September', 8],
  ['October', 9],
  ['November', 10],
  ['December', 11]
]);

function plannedWindow(month: string, entryIndexInMonth: number) {
  const monthIndex = monthIndexByName.get(month);
  if (monthIndex === undefined) throw new Error(`Invalid screenshot month ${month}`);
  const day = 1 + (entryIndexInMonth % 5) * 5;
  return {
    plannedStartDate: new Date(Date.UTC(2026, monthIndex, day, 5, 0, 0)),
    plannedEndDate: new Date(Date.UTC(2026, monthIndex, day + 4, 13, 0, 0))
  };
}
