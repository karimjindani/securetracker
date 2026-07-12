import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NotificationType, Prisma, User } from '@prisma/client';
import nodemailer from 'nodemailer';
import type { CurrentUser } from '../auth/current-user.types.js';
import { PrismaService } from '../database/prisma.service.js';

interface NotificationInput {
  userId: string;
  notificationType: NotificationType;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
}

const activeFindingStatuses = [
  'OPEN',
  'ASSIGNED',
  'IN_PROGRESS',
  'FIX_IMPLEMENTED',
  'FIXED_PENDING_REVALIDATION',
  'REVALIDATION_FAILED',
  'RISK_ACCEPTANCE_REQUESTED'
] as const;

@Injectable()
export class NotificationsService {
  private readonly fromAddress: string;
  private readonly emailEnabled: boolean;
  private readonly transporter: nodemailer.Transporter;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService) private readonly config: ConfigService
  ) {
    this.fromAddress = this.config.get<string>('SMTP_FROM') ?? 'SecureTracker <securetracker@example.local>';
    this.emailEnabled = (this.config.get<string>('NOTIFICATIONS_EMAIL_ENABLED') ?? 'true') !== 'false';
    this.transporter = nodemailer.createTransport({
      host: this.config.get<string>('SMTP_HOST') ?? 'localhost',
      port: Number(this.config.get<string>('SMTP_PORT') ?? 1025),
      secure: (this.config.get<string>('SMTP_SECURE') ?? 'false') === 'true'
    });
  }

  listForUser(actor: CurrentUser) {
    return this.prisma.notification.findMany({
      where: { userId: actor.id },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
  }

  async unreadCount(actor: CurrentUser) {
    const count = await this.prisma.notification.count({ where: { userId: actor.id, isRead: false } });
    return { count };
  }

  async markRead(id: string, actor: CurrentUser) {
    const notification = await this.prisma.notification.findUnique({ where: { id } });
    if (!notification) throw new NotFoundException('Notification not found');
    if (notification.userId !== actor.id) throw new ForbiddenException('Cannot update another user notification');
    const updated = await this.prisma.notification.update({
      where: { id },
      data: { isRead: true, readAt: notification.readAt ?? new Date() }
    });
    await this.audit(actor, 'NOTIFICATION_READ', updated.id, { isRead: notification.isRead }, { isRead: true });
    return updated;
  }

  async markAllRead(actor: CurrentUser) {
    const result = await this.prisma.notification.updateMany({
      where: { userId: actor.id, isRead: false },
      data: { isRead: true, readAt: new Date() }
    });
    await this.audit(actor, 'NOTIFICATIONS_READ_ALL', undefined, undefined, { count: result.count });
    return { count: result.count };
  }

  async notifyEngagementStatus(engagementId: string, status: string, actor: CurrentUser) {
    if (status !== 'PAYSYS_APPRISE_INITIATED' && status !== 'CLOSED') return;
    const engagement = await this.prisma.vaptEngagement.findUniqueOrThrow({
      where: { id: engagementId },
      include: { application: true, vendorOrganization: true }
    });
    const recipientOr: Prisma.UserWhereInput[] = [
      { role: { in: ['SYSTEM_ADMIN', 'PAYSYS_SECURITY_ADMIN', 'NBP_SECURITY_ADMIN'] } }
    ];
    if (engagement.vendorOrganizationId) {
      recipientOr.push({ role: 'VENDOR_ADMIN', organizationId: engagement.vendorOrganizationId });
    }
    const users = await this.prisma.user.findMany({
      where: {
        status: 'ACTIVE',
        OR: recipientOr
      }
    });
    const initiated = status === 'PAYSYS_APPRISE_INITIATED';
    await this.createForUsers(users, {
      notificationType: initiated ? 'ENGAGEMENT_INITIATED' : 'ENGAGEMENT_CLOSED',
      title: initiated ? 'Engagement initiated' : 'Engagement closed',
      message: `${engagement.title} for ${engagement.application.name} is now ${status.replaceAll('_', ' ')}.`,
      entityType: 'VAPT_ENGAGEMENT',
      entityId: engagement.id
    });
    await this.audit(actor, initiated ? 'NOTIFICATION_ENGAGEMENT_INITIATED' : 'NOTIFICATION_ENGAGEMENT_CLOSED', engagement.id, undefined, {
      status,
      recipients: users.length
    });
  }

  async notifyReportUploaded(reportId: string, actor: CurrentUser) {
    const report = await this.prisma.report.findUniqueOrThrow({
      where: { id: reportId },
      include: { engagement: { include: { application: true, vendorOrganization: true } }, versions: true }
    });
    const recipientOr: Prisma.UserWhereInput[] = [
      { role: { in: ['SYSTEM_ADMIN', 'PAYSYS_SECURITY_ADMIN', 'NBP_SECURITY_ADMIN'] } }
    ];
    if (report.engagement.vendorOrganizationId) {
      recipientOr.push({ role: 'VENDOR_ADMIN', organizationId: report.engagement.vendorOrganizationId });
    }
    const users = await this.prisma.user.findMany({
      where: {
        status: 'ACTIVE',
        OR: recipientOr
      }
    });
    await this.createForUsers(users, {
      notificationType: 'REPORT_UPLOADED',
      title: 'Report uploaded',
      message: `${report.reportType.replaceAll('_', ' ')} uploaded for ${report.engagement.title}.`,
      entityType: 'REPORT',
      entityId: report.id
    });
    await this.audit(actor, 'NOTIFICATION_REPORT_UPLOADED', report.id, undefined, { recipients: users.length });
  }

  async notifyFindingAssigned(findingId: string, actor: CurrentUser) {
    const finding = await this.prisma.finding.findUniqueOrThrow({
      where: { id: findingId },
      include: { assignedTo: true, engagement: { include: { application: true } } }
    });
    if (!finding.assignedTo) return;
    await this.createForUser({
      userId: finding.assignedTo.id,
      notificationType: 'FINDING_ASSIGNED',
      title: 'Finding assigned',
      message: `${finding.findingReference}: ${finding.title} is assigned to you for ${finding.engagement.application.name}.`,
      entityType: 'FINDING',
      entityId: finding.id
    });
    await this.audit(actor, 'NOTIFICATION_FINDING_ASSIGNED', finding.id, undefined, { userId: finding.assignedTo.id });
  }

  async notifyRevalidationCompleted(findingId: string, actor: CurrentUser) {
    const finding = await this.prisma.finding.findUniqueOrThrow({
      where: { id: findingId },
      include: { assignedTo: true, engagement: { include: { application: true } } }
    });
    const recipientOr: Prisma.UserWhereInput[] = [{ role: { in: ['SYSTEM_ADMIN', 'PAYSYS_SECURITY_ADMIN'] } }];
    if (finding.assignedToUserId) {
      recipientOr.push({ id: finding.assignedToUserId });
    }
    const users = await this.prisma.user.findMany({
      where: {
        status: 'ACTIVE',
        OR: recipientOr
      }
    });
    await this.createForUsers(users, {
      notificationType: 'REVALIDATION_COMPLETED',
      title: 'Revalidation completed',
      message: `${finding.findingReference}: ${finding.title} revalidation completed with status ${finding.status.replaceAll('_', ' ')}.`,
      entityType: 'FINDING',
      entityId: finding.id
    });
    await this.audit(actor, 'NOTIFICATION_REVALIDATION_COMPLETED', finding.id, undefined, { recipients: users.length });
  }

  async runDueChecks(actor: CurrentUser) {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);
    const reminderDays = Number(this.config.get<string>('NOTIFICATION_REMINDER_DAYS') ?? 7);
    const riskDays = Number(this.config.get<string>('RISK_ACCEPTANCE_EXPIRY_REMINDER_DAYS') ?? 14);
    const dueSoon = new Date(todayEnd);
    dueSoon.setDate(dueSoon.getDate() + reminderDays);
    const riskSoon = new Date(todayEnd);
    riskSoon.setDate(riskSoon.getDate() + riskDays);

    const dueFindings = await this.prisma.finding.findMany({
      where: {
        assignedToUserId: { not: null },
        status: { in: [...activeFindingStatuses] },
        dueDate: { gte: todayStart, lt: dueSoon }
      },
      include: { assignedTo: true, engagement: { include: { application: true } } }
    });
    const overdueFindings = await this.prisma.finding.findMany({
      where: {
        assignedToUserId: { not: null },
        status: { in: [...activeFindingStatuses] },
        dueDate: { lt: todayStart }
      },
      include: { assignedTo: true, engagement: { include: { application: true } } }
    });
    const expiringRisks = await this.prisma.riskAcceptance.findMany({
      where: { status: 'APPROVED', expiryDate: { gte: todayStart, lt: riskSoon } },
      include: { requestedBy: true, reviewedBy: true, finding: true, engagement: { include: { application: true } } }
    });

    let created = 0;
    for (const finding of dueFindings) {
      if (!finding.assignedTo) continue;
      created += await this.createDailyUnique({
        userId: finding.assignedTo.id,
        notificationType: 'FINDING_DUE_REMINDER',
        title: 'Finding due soon',
        message: `${finding.findingReference}: ${finding.title} is due by ${finding.dueDate?.toISOString().slice(0, 10)}.`,
        entityType: 'FINDING',
        entityId: finding.id
      });
    }
    for (const finding of overdueFindings) {
      const recipients = await this.prisma.user.findMany({
        where: {
          status: 'ACTIVE',
          OR: [{ id: finding.assignedToUserId ?? '' }, { role: { in: ['SYSTEM_ADMIN', 'PAYSYS_SECURITY_ADMIN'] } }]
        }
      });
      for (const user of recipients) {
        created += await this.createDailyUnique({
          userId: user.id,
          notificationType: 'FINDING_OVERDUE',
          title: 'Finding overdue',
          message: `${finding.findingReference}: ${finding.title} is overdue for ${finding.engagement.application.name}.`,
          entityType: 'FINDING',
          entityId: finding.id
        });
      }
    }
    for (const risk of expiringRisks) {
      const governanceUsers = await this.prisma.user.findMany({
        where: { status: 'ACTIVE', role: { in: ['SYSTEM_ADMIN', 'PAYSYS_SECURITY_ADMIN', 'NBP_SECURITY_ADMIN'] } }
      });
      const users = this.uniqueUsers([risk.requestedBy, risk.reviewedBy, ...governanceUsers].filter(Boolean) as User[]);
      for (const user of users) {
        created += await this.createDailyUnique({
          userId: user.id,
          notificationType: 'RISK_ACCEPTANCE_EXPIRING',
          title: 'Risk acceptance expiring',
          message: `${risk.finding.findingReference}: accepted risk expires on ${risk.expiryDate.toISOString().slice(0, 10)}.`,
          entityType: 'RISK_ACCEPTANCE',
          entityId: risk.id
        });
      }
    }
    await this.audit(actor, 'NOTIFICATION_DUE_CHECKS_RUN', undefined, undefined, {
      dueFindings: dueFindings.length,
      overdueFindings: overdueFindings.length,
      expiringRisks: expiringRisks.length,
      created
    });
    return { dueFindings: dueFindings.length, overdueFindings: overdueFindings.length, expiringRisks: expiringRisks.length, created };
  }

  private async createForUsers(users: User[], input: Omit<NotificationInput, 'userId'>) {
    const unique = this.uniqueUsers(users);
    for (const user of unique) {
      await this.createForUser({ ...input, userId: user.id });
    }
  }

  private uniqueUsers(users: User[]) {
    return [...new Map(users.map((user) => [user.id, user])).values()];
  }

  private async createDailyUnique(input: NotificationInput) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const exists = await this.prisma.notification.findFirst({
      where: {
        userId: input.userId,
        notificationType: input.notificationType,
        entityType: input.entityType,
        entityId: input.entityId,
        createdAt: { gte: today, lt: tomorrow }
      }
    });
    if (exists) return 0;
    await this.createForUser(input);
    return 1;
  }

  private async createForUser(input: NotificationInput) {
    const notification = await this.prisma.notification.create({ data: input });
    let emailSent = false;
    let emailError: string | undefined;
    if (this.emailEnabled) {
      try {
        const user = await this.prisma.user.findUniqueOrThrow({ where: { id: input.userId } });
        await this.transporter.sendMail({
          from: this.fromAddress,
          to: user.email,
          subject: input.title,
          text: `${input.message}\n\nSecureTracker notification type: ${input.notificationType}`
        });
        emailSent = true;
      } catch (error) {
        emailError = error instanceof Error ? error.message : 'Email delivery failed';
      }
      return this.prisma.notification.update({ where: { id: notification.id }, data: { emailSent, emailError } });
    }
    return notification;
  }

  private audit(actor: CurrentUser, action: string, entityId: string | undefined, oldValue: unknown, newValue: unknown) {
    return this.prisma.auditLog.create({
      data: {
        userId: actor.id,
        organizationId: actor.organizationId,
        action,
        entityType: 'NOTIFICATION',
        entityId,
        oldValue: oldValue === undefined ? undefined : (JSON.parse(JSON.stringify(oldValue)) as Prisma.InputJsonValue),
        newValue: newValue === undefined ? undefined : (JSON.parse(JSON.stringify(newValue)) as Prisma.InputJsonValue)
      }
    });
  }
}
