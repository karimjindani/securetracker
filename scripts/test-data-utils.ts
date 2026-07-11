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
  baselineUsers: number;
  baselineApplications: number;
  baselineEngagements: number;
  baselineScopingRecords: number;
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
    baselineScopingRecords: baselineEngagements.scopingRecords
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

export async function seedBaselineUsers(prisma = new PrismaClient()) {
  const organizations = await prisma.organization.findMany();
  const organizationByName = new Map(organizations.map((organization) => [organization.name, organization.id]));
  const users = [
    {
      keycloakUserId: 'seed-system-admin',
      fullName: 'System Admin',
      email: 'system.admin@example.local',
      role: 'SYSTEM_ADMIN' as const,
      organizationName: 'Auditor'
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
      organizationName: 'Auditor'
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
  const applications = [
    {
      name: 'Seeded Core Banking Portal',
      description: 'Seeded application for v0.4.0 engagement workflow testing.',
      businessOwnerName: 'Core Banking Business Owner',
      technicalOwnerName: 'Core Banking Technical Owner',
      environment: 'PRODUCTION' as const,
      criticality: 'CRITICAL',
      technologyStack: 'Java, PostgreSQL',
      internetFacing: false
    },
    {
      name: 'Seeded Mobile Banking API',
      description: 'Seeded API for v0.4.0 engagement workflow testing.',
      businessOwnerName: 'Digital Channels Owner',
      technicalOwnerName: 'API Platform Owner',
      environment: 'PRODUCTION' as const,
      criticality: 'HIGH',
      technologyStack: 'Node.js, PostgreSQL',
      internetFacing: true
    },
    {
      name: 'Seeded Internet Banking Web',
      description: 'Seeded web application for v0.4.0 engagement workflow testing.',
      businessOwnerName: 'Internet Banking Owner',
      technicalOwnerName: 'Web Platform Owner',
      environment: 'PRODUCTION' as const,
      criticality: 'HIGH',
      technologyStack: 'React, Java',
      internetFacing: true
    }
  ];

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
  const nbpAdmin = await prisma.user.findUniqueOrThrow({ where: { email: 'nbp.admin@example.local' } });
  const apprise = await prisma.organization.findUniqueOrThrow({ where: { name: 'Apprise' } });
  const applications = await prisma.application.findMany({
    where: { name: { startsWith: 'Seeded ' } },
    orderBy: { name: 'asc' }
  });
  const appByName = new Map(applications.map((application) => [application.name, application.id]));
  const currentYear = new Date().getFullYear();
  const engagementInputs = [
    {
      title: 'Seeded Core Banking Planned Whitebox VAPT',
      applicationName: 'Seeded Core Banking Portal',
      assessmentType: 'WHITEBOX' as const,
      status: 'PLANNED' as const,
      plannedMonth: 'August'
    },
    {
      title: 'Seeded Mobile Banking Paysys-Apprise Initiated VAPT',
      applicationName: 'Seeded Mobile Banking API',
      assessmentType: 'BLACK_GREY' as const,
      status: 'PAYSYS_APPRISE_INITIATED' as const,
      plannedMonth: 'September',
      scoping: 'DRAFT' as const
    },
    {
      title: 'Seeded Internet Banking Apprise Assessment VAPT',
      applicationName: 'Seeded Internet Banking Web',
      assessmentType: 'WHITEBOX' as const,
      status: 'APPRISE_ASSESSMENT' as const,
      plannedMonth: 'October',
      scoping: 'FINAL' as const
    },
    {
      title: 'Seeded Core Banking NBP Closing Meeting VAPT',
      applicationName: 'Seeded Core Banking Portal',
      assessmentType: 'BLACK_GREY' as const,
      status: 'NBP_IS_REVIEW_CLOSING_MEETING' as const,
      plannedMonth: 'November',
      scoping: 'FINAL' as const
    },
    {
      title: 'Seeded Mobile Banking Closed VAPT',
      applicationName: 'Seeded Mobile Banking API',
      assessmentType: 'WHITEBOX' as const,
      status: 'CLOSED' as const,
      plannedMonth: 'December',
      scoping: 'FINAL' as const
    }
  ];

  let scopingRecords = 0;
  for (const input of engagementInputs) {
    const applicationId = appByName.get(input.applicationName);
    if (!applicationId) throw new Error(`Missing application for ${input.applicationName}`);
    const existing = await prisma.vaptEngagement.findFirst({ where: { title: input.title } });
    const engagement = existing
      ? await prisma.vaptEngagement.update({
        where: { id: existing.id },
        data: {
          applicationId,
          assessmentType: input.assessmentType,
          plannedYear: currentYear,
          plannedMonth: input.plannedMonth,
          vendorOrganizationId: apprise.id,
          status: input.status,
          closedById: input.status === 'CLOSED' ? nbpAdmin.id : null,
          closedAt: input.status === 'CLOSED' ? new Date(`${currentYear}-01-15T10:00:00Z`) : null,
          closureNotes: input.status === 'CLOSED' ? 'Seeded closed engagement for Go-Live transition testing.' : null
        }
      })
      : await prisma.vaptEngagement.create({
        data: {
        applicationId,
        title: input.title,
        assessmentType: input.assessmentType,
        plannedYear: currentYear,
        plannedMonth: input.plannedMonth,
        vendorOrganizationId: apprise.id,
        status: input.status,
        createdById: paysysAdmin.id,
        closedById: input.status === 'CLOSED' ? nbpAdmin.id : undefined,
        closedAt: input.status === 'CLOSED' ? new Date(`${currentYear}-01-15T10:00:00Z`) : undefined,
        closureNotes: input.status === 'CLOSED' ? 'Seeded closed engagement for Go-Live transition testing.' : undefined
      }
    });

    if (input.scoping) {
      await prisma.scopingRecord.deleteMany({ where: { engagementId: engagement.id } });
      await prisma.scopingRecord.create({
        data: {
          engagementId: engagement.id,
          meetingDate: new Date(`${currentYear}-01-10T00:00:00Z`),
          meetingTime: '10:00',
          participants:
            input.scoping === 'FINAL'
              ? 'Paysys Labs Security, Apprise VAPT Team, NBP Information Security optional attendee'
              : 'Paysys Labs Security, Apprise VAPT Team',
          minutes: 'Seeded scoping notes for v0.4.0 testing. No passwords are stored.',
          scopeIncluded: `${input.applicationName} application and exposed APIs.`,
          scopeExcluded: 'Production credentials, destructive tests, and out-of-scope third-party systems.',
          testingWindowStart: new Date(`${currentYear}-01-20T00:00:00Z`),
          testingWindowEnd: new Date(`${currentYear}-01-30T00:00:00Z`),
          testAccountsSummary: 'Seeded test account summary only; no passwords stored.',
          architectureSummary: 'Seeded high-level architecture summary for workflow validation.',
          recordStatus: input.scoping,
          finalizedAt: input.scoping === 'FINAL' ? new Date(`${currentYear}-01-12T10:00:00Z`) : undefined,
          finalizedById: input.scoping === 'FINAL' ? paysysAdmin.id : undefined,
          createdById: paysysAdmin.id
        }
      });
      scopingRecords += 1;
    }
  }

  return { engagements: engagementInputs.length, scopingRecords };
}
