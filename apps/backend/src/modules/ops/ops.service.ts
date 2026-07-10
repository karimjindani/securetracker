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

  const engagementIds = regressionEngagements.map((engagement) => engagement.id);
  const applicationIds = regressionApplications.map((application) => application.id);

  const auditLogs = await prisma.auditLog.deleteMany({
    where: { entityId: { in: [...engagementIds, ...applicationIds] } }
  });
  await prisma.finding.deleteMany({ where: { engagementId: { in: engagementIds } } });
  await prisma.reportVersion.deleteMany({ where: { report: { engagementId: { in: engagementIds } } } });
  await prisma.report.deleteMany({ where: { engagementId: { in: engagementIds } } });
  await prisma.scopingRecord.deleteMany({ where: { engagementId: { in: engagementIds } } });
  const engagements = await prisma.vaptEngagement.deleteMany({
    where: { OR: [{ id: { in: engagementIds } }, { applicationId: { in: applicationIds } }] }
  });
  const applications = await prisma.application.deleteMany({ where: { id: { in: applicationIds } } });

  return { prefix, applications: applications.count, engagements: engagements.count, auditLogs: auditLogs.count };
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

  const baselineOrganizations = [
    { name: 'NBP', organizationType: 'NBP' as const },
    { name: 'Paysys Labs', organizationType: 'PAYSYS' as const },
    { name: 'Apprise', organizationType: 'VENDOR' as const },
    { name: 'Auditor', organizationType: 'AUDITOR' as const }
  ];

  for (const organization of baselineOrganizations) {
    await prisma.organization.upsert({
      where: { name: organization.name },
      update: { organizationType: organization.organizationType, status: 'ACTIVE' },
      create: organization
    });
  }

  return { ...cleanup, baselineOrganizations: baselineOrganizations.length };
}
