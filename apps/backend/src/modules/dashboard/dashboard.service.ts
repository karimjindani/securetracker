import { Inject, Injectable } from '@nestjs/common';
import { computeScheduleHealth, type ScheduleHealth } from '@securetracker/shared';
import { PrismaService } from '../database/prisma.service.js';
import { SettingsService } from '../settings/settings.service.js';

@Injectable()
export class DashboardService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(SettingsService) private readonly settingsService: SettingsService
  ) {}

  async summary() {
    const now = new Date();
    const settings = await this.settingsService.list();
    const inProgressStatuses = [
      'PAYSYS_APPRISE_INITIATED',
      'APPRISE_ASSESSMENT',
      'DRAFT_REPORT_UPLOADED',
      'PAYSYS_TRIAGE',
      'DEVELOPER_FIX',
      'FIXED_PENDING_REVALIDATION',
      'APPRISE_REVALIDATION',
      'FINAL_REPORT_UPLOADED',
      'PAYSYS_IS_REVIEW_AND_COMMENT',
      'NBP_IS_REVIEW_CLOSING_MEETING'
    ] as const;
    const [
      totalEngagements,
      plannedEngagements,
      inProgressEngagements,
      closedEngagements,
      criticalOpenFindings,
      highOpenFindings,
      overdueFindings,
      acceptedRisks,
      expiringRisks,
      revalidationPassed,
      revalidationFailed,
      heatmapRows,
      upcomingEngagements,
      vendorRows,
      reportRows
    ] = await Promise.all([
      this.prisma.vaptEngagement.count(),
      this.prisma.vaptEngagement.count({ where: { status: 'PLANNED' } }),
      this.prisma.vaptEngagement.count({ where: { status: { in: [...inProgressStatuses] } } }),
      this.prisma.vaptEngagement.count({ where: { status: { in: ['CLOSED', 'GO_LIVE'] } } }),
      this.prisma.finding.count({ where: { severity: 'CRITICAL', status: { notIn: ['CLOSED', 'RISK_ACCEPTED'] } } }),
      this.prisma.finding.count({ where: { severity: 'HIGH', status: { notIn: ['CLOSED', 'RISK_ACCEPTED'] } } }),
      this.prisma.finding.count({ where: { dueDate: { lt: now }, status: { notIn: ['CLOSED', 'RISK_ACCEPTED', 'REVALIDATION_PASSED'] } } }),
      this.prisma.riskAcceptance.count({ where: { status: 'APPROVED' } }),
      this.prisma.riskAcceptance.count({
        where: {
          status: 'APPROVED',
          expiryDate: { gte: now, lte: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) }
        }
      }),
      this.prisma.revalidation.count({ where: { result: 'PASSED' } }),
      this.prisma.revalidation.count({ where: { result: 'FAILED' } }),
      this.prisma.finding.groupBy({
        by: ['severity', 'engagementId'],
        _count: { _all: true },
        where: { status: { notIn: ['CLOSED'] } }
      }),
      this.prisma.vaptEngagement.findMany({
        where: { status: 'PLANNED', plannedStartDate: { gte: now } },
        orderBy: { plannedStartDate: 'asc' },
        take: 6,
        include: { application: true, vendorOrganization: true }
      }),
      this.prisma.revalidation.groupBy({ by: ['engagementId', 'result'], _count: { _all: true } }),
      this.prisma.report.groupBy({ by: ['engagementId', 'reportType'], _count: { _all: true } })
    ]);
    const scheduleEngagements = await this.prisma.vaptEngagement.findMany({
      where: { status: { notIn: ['CLOSED', 'GO_LIVE', 'CANCELLED'] } },
      orderBy: [{ plannedEndDate: 'asc' }, { plannedStartDate: 'asc' }, { title: 'asc' }],
      include: { application: true, vendorOrganization: true }
    });
    const scheduleRows = scheduleEngagements
      .map((engagement) => ({
        id: engagement.id,
        title: engagement.title,
        plannedStartDate: engagement.plannedStartDate,
        plannedEndDate: engagement.plannedEndDate,
        plannedMonth: engagement.plannedMonth,
        plannedYear: engagement.plannedYear,
        status: engagement.status,
        scheduleHealth: computeScheduleHealth(
          engagement.status,
          engagement.plannedStartDate,
          engagement.plannedEndDate,
          now,
          settings.scheduleHealthWarningDays
        ),
        applicationName: engagement.application.name,
        vendorName: engagement.vendorOrganization?.name
      }))
      .filter((engagement): engagement is typeof engagement & { scheduleHealth: ScheduleHealth } => Boolean(engagement.scheduleHealth));
    const scheduleCounts = {
      greenScheduleEngagements: scheduleRows.filter((engagement) => engagement.scheduleHealth === 'GREEN').length,
      attentionEngagements: scheduleRows.filter((engagement) => engagement.scheduleHealth === 'YELLOW').length,
      atRiskEngagements: scheduleRows.filter((engagement) => engagement.scheduleHealth === 'RED').length
    };

    const engagements = await this.prisma.vaptEngagement.findMany({
      where: { id: { in: [...new Set([...heatmapRows.map((row) => row.engagementId), ...vendorRows.map((row) => row.engagementId), ...reportRows.map((row) => row.engagementId)])] } },
      include: { application: true, vendorOrganization: true }
    });
    const engagementById = new Map(engagements.map((engagement) => [engagement.id, engagement]));
    const heatmap = new Map<string, { applicationName: string; CRITICAL: number; HIGH: number; MEDIUM: number; LOW: number; INFORMATIONAL: number }>();
    for (const row of heatmapRows) {
      const engagement = engagementById.get(row.engagementId);
      const applicationName = engagement?.application.name ?? 'Unknown application';
      const current =
        heatmap.get(applicationName) ?? { applicationName, CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFORMATIONAL: 0 };
      current[row.severity] += row._count._all;
      heatmap.set(applicationName, current);
    }

    const vendorPerformance = new Map<string, { vendorName: string; reports: number; passed: number; failed: number }>();
    for (const row of vendorRows) {
      const vendorName = engagementById.get(row.engagementId)?.vendorOrganization?.name ?? 'Unassigned vendor';
      const current = vendorPerformance.get(vendorName) ?? { vendorName, reports: 0, passed: 0, failed: 0 };
      if (row.result === 'PASSED') current.passed += row._count._all;
      if (row.result === 'FAILED') current.failed += row._count._all;
      vendorPerformance.set(vendorName, current);
    }
    for (const row of reportRows) {
      const vendorName = engagementById.get(row.engagementId)?.vendorOrganization?.name ?? 'Unassigned vendor';
      const current = vendorPerformance.get(vendorName) ?? { vendorName, reports: 0, passed: 0, failed: 0 };
      current.reports += row._count._all;
      vendorPerformance.set(vendorName, current);
    }

    const totalRevalidations = revalidationPassed + revalidationFailed;
    return {
      ...scheduleCounts,
      metrics: {
        totalEngagements,
        plannedEngagements,
        inProgressEngagements,
        closedEngagements,
        criticalOpenFindings,
        highOpenFindings,
        overdueFindings,
        acceptedRisks,
        expiringRisks,
        ...scheduleCounts,
        revalidationSuccessRate: totalRevalidations === 0 ? 0 : Math.round((revalidationPassed / totalRevalidations) * 100)
      },
      heatmap: [...heatmap.values()],
      upcomingEngagements: upcomingEngagements.map((engagement) => ({
        id: engagement.id,
        title: engagement.title,
        plannedStartDate: engagement.plannedStartDate,
        plannedMonth: engagement.plannedMonth,
        plannedYear: engagement.plannedYear,
        applicationName: engagement.application.name,
        vendorName: engagement.vendorOrganization?.name
      })),
      scheduleAttentionEngagements: scheduleRows.filter((engagement) => engagement.scheduleHealth === 'YELLOW').slice(0, 6),
      scheduleAtRiskEngagements: scheduleRows.filter((engagement) => engagement.scheduleHealth === 'RED').slice(0, 6),
      vendorPerformance: [...vendorPerformance.values()]
    };
  }
}
