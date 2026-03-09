import { PrismaClient } from "@prisma/client";
import { auditHealthDashboardService } from "./auditHealthDashboardService";

const prisma = new PrismaClient();

export interface BlockingCheckResult {
  canIssueReport: boolean;
  blockers: string[];
  healthScore: number;
  requiredActions: string[];
}

class ReportBlockingService {
  
  async checkReportIssuanceEligibility(engagementId: string): Promise<BlockingCheckResult> {
    const blockers: string[] = [];
    const requiredActions: string[] = [];

    const [healthCertificate, qualityControls, alerts] = await Promise.all([
      auditHealthDashboardService.getHealthCertificate(engagementId),
      auditHealthDashboardService.getQualityControls(engagementId),
      auditHealthDashboardService.getCriticalAlerts(engagementId)
    ]);

    if (healthCertificate.score < 90) {
      blockers.push(`Health score ${healthCertificate.score}% is below 90% threshold`);
      requiredActions.push('Address ISA compliance gaps to improve health score');
    }

    if (healthCertificate.criticalFailures > 0) {
      blockers.push(`${healthCertificate.criticalFailures} critical ISA failure(s) detected`);
      requiredActions.push('Resolve all critical ISA compliance failures');
    }

    const blockingAlerts = alerts.filter(a => a.blocking);
    if (blockingAlerts.length > 0) {
      blockingAlerts.forEach(alert => {
        blockers.push(alert.message);
        requiredActions.push(alert.requiredAction);
      });
    }

    const failedControls = qualityControls.filter(c => c.required && c.blocksReport && !c.status);
    failedControls.forEach(control => {
      blockers.push(`${control.control} not completed (${control.isaReference})`);
      requiredActions.push(`Complete ${control.control}`);
    });

    const engagement = await prisma.engagement.findUnique({
      where: { id: engagementId },
      select: { eqcrRequired: true }
    });
    if (engagement?.eqcrRequired) {
      const eqcr = await prisma.eQCRAssignment.findFirst({ where: { engagementId } });
      if (!eqcr?.reviewCompletedDate) {
        blockers.push('EQCR not completed for Listed Entity');
        requiredActions.push('Complete EQCR review before report issuance');
      }
    }

    const signOffs = await prisma.signOffRegister.findMany({ where: { engagementId } });
    const hasPartnerSignOff = signOffs.some((s: any) => 
      s.signOffType === 'PARTNER_SIGN_OFF' || s.signOffType === 'PARTNER_APPROVAL'
    );
    if (!hasPartnerSignOff) {
      blockers.push('Partner sign-off not recorded');
      requiredActions.push('Obtain partner sign-off before report issuance');
    }

    return {
      canIssueReport: blockers.length === 0,
      blockers,
      healthScore: healthCertificate.score,
      requiredActions
    };
  }

  async enforceReportBlocking(engagementId: string, userId: string): Promise<{ allowed: boolean; reason?: string }> {
    const result = await this.checkReportIssuanceEligibility(engagementId);

    await prisma.auditTrail.create({
      data: {
        engagementId,
        userId,
        action: 'REPORT_ISSUANCE_CHECK',
        entityType: 'ENGAGEMENT',
        entityId: engagementId,
        afterValue: {
          allowed: result.canIssueReport,
          blockers: result.blockers,
          healthScore: result.healthScore,
          checkedAt: new Date()
        }
      }
    });

    if (!result.canIssueReport) {
      return {
        allowed: false,
        reason: `Report issuance blocked: ${result.blockers.join('; ')}`
      };
    }

    return { allowed: true };
  }

  async lockEngagementForReporting(engagementId: string, userId: string): Promise<{ success: boolean; error?: string; blockers?: string[] }> {
    const eligibility = await this.checkReportIssuanceEligibility(engagementId);

    if (!eligibility.canIssueReport) {
      return {
        success: false,
        error: `Cannot lock engagement: ${eligibility.blockers.join('; ')}`,
        blockers: eligibility.blockers
      };
    }

    await prisma.engagement.update({
      where: { id: engagementId },
      data: { 
        status: 'ARCHIVED',
        updatedAt: new Date()
      }
    });

    await prisma.auditTrail.create({
      data: {
        engagementId,
        userId,
        action: 'ENGAGEMENT_LOCKED_FOR_REPORTING',
        entityType: 'ENGAGEMENT',
        entityId: engagementId,
        afterValue: {
          lockedAt: new Date(),
          healthScore: eligibility.healthScore,
          lockedBy: userId
        }
      }
    });

    return { success: true };
  }
}

export const reportBlockingService = new ReportBlockingService();
