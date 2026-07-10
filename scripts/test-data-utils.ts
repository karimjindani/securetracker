import { PrismaClient } from '@prisma/client';

export const regressionPrefix = process.env.REGRESSION_DATA_PREFIX ?? 'REGRESSION_';

export interface CleanupSummary {
  prefix: string;
  applications: number;
  engagements: number;
  auditLogs: number;
  users: number;
  organizations: number;
}

export interface ResetSummary extends CleanupSummary {
  baselineOrganizations: number;
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

  const auditLogs = await prisma.auditLog.deleteMany({
    where: {
      OR: [
        { entityId: { in: [...engagementIds, ...applicationIds, ...userIds, ...organizationIds] } },
        { action: { startsWith: 'REGRESSION_' } }
      ]
    }
  });
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
    organizations: organizations.count
  };
}

export async function resetToSeededData(prisma = new PrismaClient()): Promise<ResetSummary> {
  const cleanup = await cleanupRegressionData(prisma);

  await prisma.auditLog.deleteMany();
  await prisma.finding.deleteMany();
  await prisma.reportVersion.deleteMany();
  await prisma.report.deleteMany();
  await prisma.scopingRecord.deleteMany();
  await prisma.vaptEngagement.deleteMany();
  await prisma.application.deleteMany();
  await prisma.user.deleteMany();

  const baselineOrganizations = await seedBaselineOrganizations(prisma);

  return {
    ...cleanup,
    baselineOrganizations
  };
}

export async function seedBaselineOrganizations(prisma = new PrismaClient()) {
  const organizations = [
    { name: 'NBP', organizationType: 'NBP' as const },
    { name: 'Paysys Labs', organizationType: 'PAYSYS' as const },
    { name: 'Apprise', organizationType: 'VENDOR' as const },
    { name: 'Auditor', organizationType: 'AUDITOR' as const }
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
