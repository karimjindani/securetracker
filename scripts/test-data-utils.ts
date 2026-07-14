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
  baselineOrganizations: number;
  baselineUsers: number;
  baselineApplications: number;
  baselineEngagements: number;
  baselineScopingRecords: number;
  baselineWhiteboxEngagements: number;
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

  const baseline = await seedBaselineData(prisma);

  return {
    ...cleanup,
    ...baseline
  };
}

export async function seedBaselineData(prisma = new PrismaClient()) {
  const baselineOrganizations = await seedBaselineOrganizations(prisma);
  const baselineUsers = await seedBaselineUsers(prisma);
  const baselineApplications = await seedBaselineApplications(prisma);
  const baselineEngagements = await seedBaselineEngagements(prisma);

  return {
    baselineOrganizations,
    baselineUsers,
    baselineApplications: baselineApplications.count,
    baselineEngagements: baselineEngagements.engagements,
    baselineScopingRecords: baselineEngagements.scopingRecords,
    baselineWhiteboxEngagements: baselineEngagements.whiteboxEngagements
  };
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
  const names = [
    'Core Banking Portal',
    'Mobile Banking API',
    'Internet Banking Web',
    'Corporate Payments Gateway',
    'ATM Switch Interface',
    'Card Management System',
    'Merchant Acquiring Portal',
    'Digital Wallet Service',
    'Loan Origination Platform',
    'Treasury Operations Portal',
    'Remittance Processing Hub',
    'Fraud Monitoring Console',
    'Customer Onboarding Portal',
    'KYC Document Repository',
    'Call Center CRM',
    'Branch Teller System',
    'Open Banking API',
    'Data Warehouse Portal',
    'Regulatory Reporting App',
    'HR Self Service Portal',
    'Vendor Management Portal',
    'Statement Generation Service',
    'Notification Gateway',
    'Dispute Management System',
    'API Developer Portal'
  ];
  const applications = names.map((name, index) => ({
    name: `Seeded ${name}`,
    description: `Seeded application ${index + 1} for annual Whitebox VAPT validation.`,
    businessOwnerName: `${name} Business Owner`,
    technicalOwnerName: `${name} Technical Owner`,
    environment: index % 5 === 0 ? ('UAT' as const) : ('PRODUCTION' as const),
    criticality: index % 4 === 0 ? 'CRITICAL' : index % 3 === 0 ? 'MEDIUM' : 'HIGH',
    technologyStack: index % 2 === 0 ? 'Java, PostgreSQL, React' : 'Node.js, PostgreSQL, Angular',
    internetFacing: index % 3 !== 0
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
    where: { name: { startsWith: 'Seeded ' } },
    orderBy: { name: 'asc' }
  });
  const currentYear = new Date().getFullYear();
  const h1Statuses = [
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
    'GO_LIVE'
  ] as const;
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  let scopingRecords = 0;
  let engagements = 0;
  for (const [index, application] of applications.entries()) {
    for (const half of [0, 1]) {
      const monthIndex = (index % 6) + half * 6;
      const weekInMonth = Math.floor(index / 6);
      const day = 1 + weekInMonth * 7;
      const plannedStartDate = new Date(Date.UTC(currentYear, monthIndex, day, 5, 0, 0));
      const plannedEndDate = new Date(Date.UTC(currentYear, monthIndex, day + 4, 13, 0, 0));
      const status = half === 0 ? h1Statuses[index % h1Statuses.length] : 'PLANNED';
      const engagement = await prisma.vaptEngagement.create({
        data: {
          applicationId: application.id,
          title: `Seeded ${application.name.replace(/^Seeded /, '')} H${half + 1} Whitebox VAPT`,
          assessmentType: 'WHITEBOX',
          plannedYear: currentYear,
          plannedMonth: monthNames[monthIndex],
          plannedStartDate,
          plannedEndDate,
          vendorOrganizationId: apprise.id,
          status,
          createdById: paysysAdmin.id
        }
      });
      engagements += 1;
      if (status !== 'PLANNED') {
        await prisma.scopingRecord.create({
          data: {
            engagementId: engagement.id,
            meetingDate: new Date(Date.UTC(currentYear, monthIndex, Math.max(1, day - 3), 5, 0, 0)),
            meetingTime: '10:00',
            participants: 'Paysys Labs Security, Apprise VAPT Team, NBP Information Security optional attendee',
            minutes: 'Seeded scoping notes for annual validation. No passwords are stored.',
            scopeIncluded: `${application.name} application, exposed APIs, and supporting integration points.`,
            scopeExcluded: 'Production credentials, destructive tests, and out-of-scope third-party systems.',
            testingWindowStart: plannedStartDate,
            testingWindowEnd: plannedEndDate,
            testAccountsSummary: 'Seeded test account summary only; no passwords stored.',
            architectureSummary: 'Seeded high-level architecture summary for workflow validation.',
            recordStatus: status === 'PAYSYS_APPRISE_INITIATED' ? 'DRAFT' : 'FINAL',
            finalizedAt: status === 'PAYSYS_APPRISE_INITIATED' ? undefined : new Date(Date.UTC(currentYear, monthIndex, Math.max(1, day - 2), 5, 0, 0)),
            finalizedById: status === 'PAYSYS_APPRISE_INITIATED' ? undefined : paysysAdmin.id,
            createdById: paysysAdmin.id
          }
        });
        scopingRecords += 1;
      }
    }
  }

  return { engagements, scopingRecords, whiteboxEngagements: engagements };
}
