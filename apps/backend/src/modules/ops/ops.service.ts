import { Inject, Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { PrismaService } from '../database/prisma.service.js';

const execFileAsync = promisify(execFile);

type ProbeStatus = 'ok' | 'down' | 'unavailable';
type RunStatus = 'running' | 'passed' | 'failed';

export interface RegressionRun {
  id: string;
  status: RunStatus;
  startedAt: string;
  finishedAt?: string;
  exitCode?: number | null;
  logs: string[];
}

@Injectable()
export class OpsService {
  private readonly runs = new Map<string, RegressionRun>();

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async health() {
    const [database, frontend, keycloak, minio, smtp] = await Promise.all([
      this.databaseProbe(),
      this.httpProbe(process.env.FRONTEND_BASE_URL ?? 'http://localhost:5173'),
      this.httpProbe(process.env.KEYCLOAK_ISSUER_URL ?? 'http://localhost:18080/realms/securetracker'),
      this.httpProbe(`http://${process.env.MINIO_ENDPOINT ?? 'localhost'}:${process.env.MINIO_PORT ?? '9000'}/minio/health/live`),
      this.httpProbe(process.env.SMTP_UI_URL ?? 'http://localhost:8025')
    ]);

    return {
      opsEnabled: process.env.OPS_ENABLED === 'true',
      prefix: process.env.REGRESSION_DATA_PREFIX ?? 'REGRESSION_',
      services: [
        { name: 'backend-api', status: 'ok' as ProbeStatus, detail: 'Ops API responded' },
        database,
        { name: 'frontend', ...frontend },
        { name: 'keycloak', ...keycloak },
        { name: 'minio', ...minio },
        { name: 'smtp-test-service', ...smtp }
      ]
    };
  }

  async containers() {
    try {
      const { stdout } = await execFileAsync('docker', ['compose', 'ps', '--format', 'json'], {
        cwd: this.repoRoot(),
        timeout: 10_000
      });
      return this.parseDockerComposeJson(stdout);
    } catch (error) {
      return [
        {
          name: 'docker-compose',
          service: 'local-docker',
          state: 'unavailable',
          status: error instanceof Error ? error.message : 'Docker status unavailable'
        }
      ];
    }
  }

  startRegressionRun() {
    const id = randomUUID();
    const run: RegressionRun = {
      id,
      status: 'running',
      startedAt: new Date().toISOString(),
      logs: []
    };
    this.runs.set(id, run);

    const command = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const child = execFile(command, ['run', 'test:regression'], { cwd: this.repoRoot() });

    child.stdout?.on('data', (chunk: Buffer) => run.logs.push(chunk.toString()));
    child.stderr?.on('data', (chunk: Buffer) => run.logs.push(chunk.toString()));
    child.on('exit', (code) => {
      run.exitCode = code;
      run.status = code === 0 ? 'passed' : 'failed';
      run.finishedAt = new Date().toISOString();
    });
    child.on('error', (error) => {
      run.exitCode = 1;
      run.status = 'failed';
      run.finishedAt = new Date().toISOString();
      run.logs.push(error.message);
    });

    return run;
  }

  getRegressionRun(id: string) {
    return this.runs.get(id) ?? null;
  }

  async cleanupRegressionData() {
    return cleanupRegressionData(this.prisma);
  }

  async resetToSeededData() {
    return resetToSeededData(this.prisma);
  }

  private async databaseProbe() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { name: 'postgres', status: 'ok' as ProbeStatus, detail: 'Database query succeeded' };
    } catch (error) {
      return { name: 'postgres', status: 'down' as ProbeStatus, detail: this.errorMessage(error) };
    }
  }

  private async httpProbe(url: string) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    try {
      const response = await fetch(url, { signal: controller.signal });
      return {
        status: response.ok ? ('ok' as ProbeStatus) : ('down' as ProbeStatus),
        detail: `${response.status} ${response.statusText}`
      };
    } catch (error) {
      return { status: 'down' as ProbeStatus, detail: this.errorMessage(error) };
    } finally {
      clearTimeout(timeout);
    }
  }

  private parseDockerComposeJson(stdout: string) {
    const trimmed = stdout.trim();
    if (!trimmed) return [];
    const lines = trimmed.split(/\r?\n/).filter(Boolean);
    return lines.flatMap((line) => {
      try {
        const parsed = JSON.parse(line) as { Name?: string; Service?: string; State?: string; Status?: string };
        return [
          {
            name: parsed.Name ?? parsed.Service ?? 'unknown',
            service: parsed.Service ?? 'unknown',
            state: parsed.State ?? 'unknown',
            status: parsed.Status ?? 'unknown'
          }
        ];
      } catch {
        return [];
      }
    });
  }

  private repoRoot() {
    const cwd = process.cwd();
    if (existsSync(path.join(cwd, 'package.json')) && existsSync(path.join(cwd, 'apps'))) return cwd;
    return path.resolve(cwd, '../..');
  }

  private errorMessage(error: unknown) {
    return error instanceof Error ? error.message : 'Unknown error';
  }
}

async function cleanupRegressionData(prisma: PrismaClient) {
  const prefix = process.env.REGRESSION_DATA_PREFIX ?? 'REGRESSION_';
  const regressionApplications = await prisma.application.findMany({
    where: { name: { startsWith: prefix } },
    select: { id: true }
  });
  const regressionEngagements = await prisma.vaptEngagement.findMany({
    where: {
      OR: [
        { title: { startsWith: prefix } },
        { applicationId: { in: regressionApplications.map((application) => application.id) } }
      ]
    },
    select: { id: true }
  });
  const regressionUsers = await prisma.user.findMany({
    where: { OR: [{ email: { startsWith: prefix } }, { fullName: { startsWith: prefix } }] },
    select: { id: true }
  });
  const regressionOrganizations = await prisma.organization.findMany({
    where: { name: { startsWith: prefix } },
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
        { action: { startsWith: prefix } }
      ]
    }
  });
  await prisma.finding.deleteMany({ where: { engagementId: { in: engagementIds } } });
  await prisma.reportVersion.deleteMany({ where: { report: { engagementId: { in: engagementIds } } } });
  await prisma.report.deleteMany({ where: { engagementId: { in: engagementIds } } });
  await prisma.scopingRecord.deleteMany({ where: { engagementId: { in: engagementIds } } });
  const engagements = await prisma.vaptEngagement.deleteMany({
    where: { OR: [{ id: { in: engagementIds } }, { applicationId: { in: applicationIds } }] }
  });
  const applications = await prisma.application.deleteMany({ where: { id: { in: applicationIds } } });
  const users = await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  const organizations = await prisma.organization.deleteMany({ where: { id: { in: organizationIds } } });

  return {
    prefix,
    applications: applications.count,
    engagements: engagements.count,
    auditLogs: auditLogs.count,
    users: users.count,
    organizations: organizations.count
  };
}

async function resetToSeededData(prisma: PrismaClient) {
  const cleanup = await cleanupRegressionData(prisma);
  await prisma.auditLog.deleteMany();
  await prisma.finding.deleteMany();
  await prisma.reportVersion.deleteMany();
  await prisma.report.deleteMany();
  await prisma.scopingRecord.deleteMany();
  await prisma.vaptEngagement.deleteMany();
  await prisma.application.deleteMany();
  await prisma.user.deleteMany();

  const baselineOrganizations = await seedOrganizations(prisma);
  const baselineUsers = await seedUsers(prisma);
  const baselineApplications = await seedApplications(prisma);
  const baselineEngagements = await seedEngagements(prisma);

  return {
    ...cleanup,
    baselineOrganizations,
    baselineUsers,
    baselineApplications: baselineApplications.count,
    baselineEngagements: baselineEngagements.engagements,
    baselineScopingRecords: baselineEngagements.scopingRecords
  };
}

async function seedOrganizations(prisma: PrismaClient) {
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

async function seedUsers(prisma: PrismaClient) {
  const organizations = await prisma.organization.findMany();
  const organizationByName = new Map(organizations.map((organization) => [organization.name, organization.id]));
  const users = [
    ['seed-system-admin', 'System Admin', 'system.admin@example.local', 'SYSTEM_ADMIN', 'Auditor'],
    ['seed-nbp-admin', 'NBP Admin', 'nbp.admin@example.local', 'NBP_SECURITY_ADMIN', 'NBP'],
    ['seed-nbp-viewer', 'NBP Viewer', 'nbp.viewer@example.local', 'NBP_VIEWER', 'NBP'],
    ['seed-paysys-admin', 'Paysys Admin', 'paysys.admin@example.local', 'PAYSYS_SECURITY_ADMIN', 'Paysys Labs'],
    ['seed-paysys-dev', 'Paysys Developer', 'paysys.dev@example.local', 'PAYSYS_DEVELOPER', 'Paysys Labs'],
    ['seed-apprise-vendor', 'Apprise Vendor', 'apprise.vendor@example.local', 'VENDOR_ADMIN', 'Apprise'],
    ['seed-auditor', 'External Auditor', 'auditor@example.local', 'AUDITOR', 'Auditor']
  ] as const;
  for (const [keycloakUserId, fullName, email, role, organizationName] of users) {
    const organizationId = organizationByName.get(organizationName);
    if (!organizationId) throw new Error(`Missing organization for ${organizationName}`);
    await prisma.user.upsert({
      where: { email },
      update: { organizationId, keycloakUserId, fullName, role, status: 'ACTIVE' },
      create: { organizationId, keycloakUserId, fullName, email, role }
    });
  }
  return users.length;
}

async function seedApplications(prisma: PrismaClient) {
  const paysysAdmin = await prisma.user.findUniqueOrThrow({ where: { email: 'paysys.admin@example.local' } });
  const applications = [
    ['Seeded Core Banking Portal', 'CRITICAL', false],
    ['Seeded Mobile Banking API', 'HIGH', true],
    ['Seeded Internet Banking Web', 'HIGH', true]
  ] as const;
  for (const [name, criticality, internetFacing] of applications) {
    await prisma.application.create({
      data: {
        name,
        description: 'Seeded application for v0.4.0 engagement workflow testing.',
        businessOwnerName: `${name} Business Owner`,
        technicalOwnerName: `${name} Technical Owner`,
        environment: 'PRODUCTION',
        criticality,
        technologyStack: 'Seeded technology stack',
        internetFacing,
        createdById: paysysAdmin.id
      }
    });
  }
  return { count: applications.length };
}

async function seedEngagements(prisma: PrismaClient) {
  const paysysAdmin = await prisma.user.findUniqueOrThrow({ where: { email: 'paysys.admin@example.local' } });
  const nbpAdmin = await prisma.user.findUniqueOrThrow({ where: { email: 'nbp.admin@example.local' } });
  const apprise = await prisma.organization.findUniqueOrThrow({ where: { name: 'Apprise' } });
  const applications = await prisma.application.findMany({ where: { name: { startsWith: 'Seeded ' } } });
  const appByName = new Map(applications.map((application) => [application.name, application.id]));
  const currentYear = new Date().getFullYear();
  const engagements = [
    ['Seeded Core Banking Planned Whitebox VAPT', 'Seeded Core Banking Portal', 'WHITEBOX', 'PLANNED', 'August', undefined],
    ['Seeded Mobile Banking Paysys-Apprise Initiated VAPT', 'Seeded Mobile Banking API', 'BLACK_GREY', 'PAYSYS_APPRISE_INITIATED', 'September', 'DRAFT'],
    ['Seeded Internet Banking Apprise Assessment VAPT', 'Seeded Internet Banking Web', 'WHITEBOX', 'APPRISE_ASSESSMENT', 'October', 'FINAL'],
    ['Seeded Core Banking NBP Closing Meeting VAPT', 'Seeded Core Banking Portal', 'BLACK_GREY', 'NBP_IS_REVIEW_CLOSING_MEETING', 'November', 'FINAL'],
    ['Seeded Mobile Banking Closed VAPT', 'Seeded Mobile Banking API', 'WHITEBOX', 'CLOSED', 'December', 'FINAL']
  ] as const;
  let scopingRecords = 0;
  for (const [title, applicationName, assessmentType, status, plannedMonth, scopingStatus] of engagements) {
    const applicationId = appByName.get(applicationName);
    if (!applicationId) throw new Error(`Missing application for ${applicationName}`);
    const engagement = await prisma.vaptEngagement.create({
      data: {
        applicationId,
        title,
        assessmentType,
        plannedYear: currentYear,
        plannedMonth,
        vendorOrganizationId: apprise.id,
        status,
        createdById: paysysAdmin.id,
        closedById: status === 'CLOSED' ? nbpAdmin.id : undefined,
        closedAt: status === 'CLOSED' ? new Date(`${currentYear}-01-15T10:00:00Z`) : undefined,
        closureNotes: status === 'CLOSED' ? 'Seeded closed engagement for Go-Live transition testing.' : undefined
      }
    });
    if (scopingStatus) {
      await prisma.scopingRecord.create({
        data: {
          engagementId: engagement.id,
          meetingDate: new Date(`${currentYear}-01-10T00:00:00Z`),
          meetingTime: '10:00',
          participants:
            scopingStatus === 'FINAL'
              ? 'Paysys Labs Security, Apprise VAPT Team, NBP Information Security optional attendee'
              : 'Paysys Labs Security, Apprise VAPT Team',
          minutes: 'Seeded scoping notes for v0.4.0 testing. No passwords are stored.',
          scopeIncluded: `${applicationName} application and exposed APIs.`,
          scopeExcluded: 'Production credentials, destructive tests, and out-of-scope third-party systems.',
          testingWindowStart: new Date(`${currentYear}-01-20T00:00:00Z`),
          testingWindowEnd: new Date(`${currentYear}-01-30T00:00:00Z`),
          testAccountsSummary: 'Seeded test account summary only; no passwords stored.',
          architectureSummary: 'Seeded high-level architecture summary for workflow validation.',
          recordStatus: scopingStatus,
          finalizedAt: scopingStatus === 'FINAL' ? new Date(`${currentYear}-01-12T10:00:00Z`) : undefined,
          finalizedById: scopingStatus === 'FINAL' ? paysysAdmin.id : undefined,
          createdById: paysysAdmin.id
        }
      });
      scopingRecords += 1;
    }
  }
  return { engagements: engagements.length, scopingRecords };
}
