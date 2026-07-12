import { BadRequestException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { canRequestRiskAcceptance, type RiskAcceptanceStatus } from '@securetracker/shared';
import type { CurrentUser } from '../auth/current-user.types.js';
import { PrismaService } from '../database/prisma.service.js';

export interface CreateRiskAcceptanceDto {
  riskDescription?: string;
  businessJustification?: string;
  mitigatingControls?: string;
  expiryDate?: string;
  requestNotes?: string;
}

export interface ReviewRiskAcceptanceDto {
  status?: 'APPROVED' | 'REJECTED';
  reviewNotes?: string;
}

@Injectable()
export class RiskAcceptanceService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  list(actor: CurrentUser) {
    void actor;
    return this.prisma.riskAcceptance.findMany({
      orderBy: [{ requestedAt: 'desc' }],
      include: this.include()
    });
  }

  async listForFinding(findingId: string, actor: CurrentUser) {
    void actor;
    await this.prisma.finding.findUniqueOrThrow({ where: { id: findingId } });
    return this.prisma.riskAcceptance.findMany({
      where: { findingId },
      orderBy: [{ requestedAt: 'desc' }],
      include: this.include()
    });
  }

  async request(findingId: string, input: CreateRiskAcceptanceDto, actor: CurrentUser) {
    if (!canRequestRiskAcceptance(actor.role)) throw new ForbiddenException('Current role cannot request risk acceptance');
    const finding = await this.prisma.finding.findUniqueOrThrow({
      where: { id: findingId },
      include: { engagement: true }
    });
    if (['RISK_ACCEPTED', 'CLOSED'].includes(finding.status)) {
      throw new BadRequestException('Risk acceptance can be requested only for unresolved findings');
    }
    const expiryDate = this.parseDate(input.expiryDate, 'Expiry date');
    if (expiryDate.getTime() <= Date.now()) throw new BadRequestException('Expiry date must be in the future');
    const riskAcceptance = await this.prisma.riskAcceptance.create({
      data: {
        findingId: finding.id,
        engagementId: finding.engagementId,
        riskDescription: this.requiredText(input.riskDescription, 'Risk description'),
        businessJustification: this.requiredText(input.businessJustification, 'Business justification'),
        mitigatingControls: this.optionalText(input.mitigatingControls),
        expiryDate,
        requestNotes: this.optionalText(input.requestNotes),
        requestedById: actor.id
      },
      include: this.include()
    });
    await this.prisma.finding.update({
      where: { id: finding.id },
      data: {
        status: 'RISK_ACCEPTANCE_REQUESTED',
        statusHistory: {
          create: {
            oldStatus: finding.status,
            newStatus: 'RISK_ACCEPTANCE_REQUESTED',
            changedById: actor.id,
            comments: 'Risk acceptance requested'
          }
        }
      }
    });
    await this.audit(actor, 'RISK_ACCEPTANCE_REQUESTED', riskAcceptance.id, undefined, riskAcceptance);
    return riskAcceptance;
  }

  async review(id: string, input: ReviewRiskAcceptanceDto, actor: CurrentUser) {
    const status = this.requireReviewStatus(input.status);
    const before = await this.prisma.riskAcceptance.findUniqueOrThrow({
      where: { id },
      include: this.include()
    });
    if (before.status !== 'REQUESTED') throw new BadRequestException('Only requested risk acceptances can be reviewed');
    const riskAcceptance = await this.prisma.riskAcceptance.update({
      where: { id },
      data: {
        status,
        reviewNotes: this.optionalText(input.reviewNotes),
        reviewedById: actor.id,
        reviewedAt: new Date()
      },
      include: this.include()
    });
    if (status === 'APPROVED') {
      await this.prisma.finding.update({
        where: { id: before.findingId },
        data: {
          status: 'RISK_ACCEPTED',
          statusHistory: {
            create: {
              oldStatus: before.finding.status,
              newStatus: 'RISK_ACCEPTED',
              changedById: actor.id,
              comments: this.optionalText(input.reviewNotes) ?? 'Risk acceptance approved'
            }
          }
        }
      });
    }
    await this.audit(
      actor,
      status === 'APPROVED' ? 'RISK_ACCEPTANCE_APPROVED' : 'RISK_ACCEPTANCE_REJECTED',
      riskAcceptance.id,
      before,
      riskAcceptance
    );
    return riskAcceptance;
  }

  private include() {
    return {
      finding: { include: { engagement: { include: { application: true } } } },
      engagement: { include: { application: true } },
      requestedBy: true,
      reviewedBy: true
    } as const;
  }

  private requireReviewStatus(value?: string) {
    if (value !== 'APPROVED' && value !== 'REJECTED') throw new BadRequestException('Review status must be APPROVED or REJECTED');
    return value as Extract<RiskAcceptanceStatus, 'APPROVED' | 'REJECTED'>;
  }

  private parseDate(value: string | undefined, label: string) {
    if (!value) throw new BadRequestException(`${label} is required`);
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new BadRequestException(`${label} is invalid`);
    return date;
  }

  private requiredText(value: string | undefined, label: string) {
    const trimmed = value?.trim();
    if (!trimmed) throw new BadRequestException(`${label} is required`);
    return trimmed;
  }

  private optionalText(value?: string) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  }

  private audit(actor: CurrentUser, action: string, entityId: string, oldValue: unknown, newValue: unknown) {
    return this.prisma.auditLog.create({
      data: {
        userId: actor.id,
        organizationId: actor.organizationId,
        action,
        entityType: 'RISK_ACCEPTANCE',
        entityId,
        oldValue: oldValue === undefined ? undefined : JSON.parse(JSON.stringify(oldValue)),
        newValue: JSON.parse(JSON.stringify(newValue))
      }
    });
  }
}
