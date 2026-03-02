import { Router, Response } from "express";
import { requireAuth, AuthenticatedRequest } from "../auth";
import { auditHealthDashboardService } from "../services/auditHealthDashboardService";
import { reportBlockingService } from "../services/reportBlockingService";
import { PrismaClient } from "@prisma/client";

const router = Router();
const prisma = new PrismaClient();

async function validateEngagementAccess(engagementId: string, userId: string, firmId: string | null) {
  if (!firmId) return { valid: false, error: "User not associated with a firm" };
  const engagement = await prisma.engagement.findFirst({
    where: { id: engagementId, firmId }
  });
  if (!engagement) return { valid: false, error: "Engagement not found or access denied" };
  return { valid: true, engagement };
}

router.get("/engagements/:engagementId/dashboard", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) return res.status(404).json({ error: access.error });

    const dashboard = await auditHealthDashboardService.getFullDashboard(req.params.engagementId);
    res.json(dashboard);
  } catch (error: any) {
    console.error("Dashboard error:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/engagements/:engagementId/health-score", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) return res.status(404).json({ error: access.error });

    const data = await auditHealthDashboardService.getHealthScorePanel(req.params.engagementId);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/engagements/:engagementId/isa-matrix", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) return res.status(404).json({ error: access.error });

    const data = await auditHealthDashboardService.getISAComplianceMatrix(req.params.engagementId);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/engagements/:engagementId/alerts", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) return res.status(404).json({ error: access.error });

    const data = await auditHealthDashboardService.getCriticalAlerts(req.params.engagementId);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/engagements/:engagementId/data-integrity", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) return res.status(404).json({ error: access.error });

    const data = await auditHealthDashboardService.getDataIntegrityFlow(req.params.engagementId);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/engagements/:engagementId/ai-diagnostics", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) return res.status(404).json({ error: access.error });

    const data = await auditHealthDashboardService.getAIDiagnostics(req.params.engagementId);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/engagements/:engagementId/evidence-coverage", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) return res.status(404).json({ error: access.error });

    const data = await auditHealthDashboardService.getEvidenceCoverage(req.params.engagementId);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/engagements/:engagementId/misstatements", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) return res.status(404).json({ error: access.error });

    const data = await auditHealthDashboardService.getMisstatementTracker(req.params.engagementId);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/engagements/:engagementId/quality-controls", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) return res.status(404).json({ error: access.error });

    const data = await auditHealthDashboardService.getQualityControls(req.params.engagementId);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/engagements/:engagementId/auto-fixes", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) return res.status(404).json({ error: access.error });

    const data = await auditHealthDashboardService.getAutoFixItems(req.params.engagementId);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/engagements/:engagementId/health-certificate", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) return res.status(404).json({ error: access.error });

    const data = await auditHealthDashboardService.getHealthCertificate(req.params.engagementId);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/engagements/:engagementId/generate-certificate", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) return res.status(404).json({ error: access.error });

    const certificate = await auditHealthDashboardService.getHealthCertificate(req.params.engagementId);
    
    if (!certificate.eligible) {
      return res.status(400).json({
        error: "Cannot generate health certificate",
        blockers: certificate.blockers
      });
    }

    await prisma.auditTrail.create({
      data: {
        engagementId: req.params.engagementId,
        userId: req.user!.id,
        action: 'HEALTH_CERTIFICATE_GENERATED',
        entityType: 'ENGAGEMENT',
        entityId: req.params.engagementId,
        details: JSON.stringify({
          score: certificate.score,
          generatedAt: new Date(),
          verifiedBy: req.user!.id
        })
      }
    });

    res.json({
      ...certificate,
      generatedAt: new Date(),
      verifiedBy: req.user!.fullName || req.user!.email,
      message: "Audit Health Certificate - System Verified"
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/engagements/:engagementId/report-eligibility", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) return res.status(404).json({ error: access.error });

    const result = await reportBlockingService.checkReportIssuanceEligibility(req.params.engagementId);
    
    await prisma.auditTrail.create({
      data: {
        engagementId: req.params.engagementId,
        userId: req.user!.id,
        action: 'REPORT_ELIGIBILITY_CHECK',
        entityType: 'ENGAGEMENT',
        entityId: req.params.engagementId,
        details: JSON.stringify({
          canIssueReport: result.canIssueReport,
          blockers: result.blockers,
          healthScore: result.healthScore,
          checkedAt: new Date()
        })
      }
    });

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/engagements/:engagementId/verify-report-issuance", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) return res.status(404).json({ error: access.error });

    const result = await reportBlockingService.enforceReportBlocking(req.params.engagementId, req.user!.id);
    
    if (!result.allowed) {
      return res.status(403).json({
        allowed: false,
        reason: result.reason
      });
    }

    res.json({ allowed: true, message: "Report issuance permitted" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/engagements/:engagementId/lock-for-reporting", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) return res.status(404).json({ error: access.error });

    if (req.user!.role !== 'PARTNER' && req.user!.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only Partners can lock audit files' });
    }

    const result = await reportBlockingService.lockEngagementForReporting(req.params.engagementId, req.user!.id);
    
    if (!result.success) {
      return res.status(403).json({
        allowed: false,
        reason: result.error,
        blockers: result.blockers || []
      });
    }

    res.json({ 
      success: true, 
      message: "Engagement locked for reporting per ISA 230.14"
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/engagements/:engagementId/partner-override", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) return res.status(404).json({ error: access.error });

    if (req.user!.role !== 'PARTNER' && req.user!.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only Partners can apply overrides' });
    }

    const { reason, overrideType, targetId } = req.body;
    if (!reason || reason.trim().length < 10) {
      return res.status(400).json({ error: 'Override reason is required (minimum 10 characters)' });
    }

    await prisma.auditTrail.create({
      data: {
        engagementId: req.params.engagementId,
        userId: req.user!.id,
        action: 'PARTNER_OVERRIDE',
        entityType: overrideType || 'ENGAGEMENT',
        entityId: targetId || req.params.engagementId,
        details: JSON.stringify({
          reason,
          overrideType,
          appliedBy: req.user!.fullName || req.user!.email,
          appliedAt: new Date()
        })
      }
    });

    res.json({ 
      success: true, 
      message: "Partner override applied and logged for QCR"
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/engagements/:engagementId/request-eqcr", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) return res.status(404).json({ error: access.error });

    if (req.user!.role !== 'PARTNER' && req.user!.role !== 'ADMIN' && req.user!.role !== 'MANAGER') {
      return res.status(403).json({ error: 'Only Partners/Managers can request EQCR' });
    }

    await prisma.auditTrail.create({
      data: {
        engagementId: req.params.engagementId,
        userId: req.user!.id,
        action: 'EQCR_REQUESTED',
        entityType: 'ENGAGEMENT',
        entityId: req.params.engagementId,
        details: JSON.stringify({
          requestedBy: req.user!.fullName || req.user!.email,
          requestedAt: new Date()
        })
      }
    });

    res.json({ 
      success: true, 
      message: "EQCR request submitted"
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/engagements/:engagementId/approve-report-issuance", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) return res.status(404).json({ error: access.error });

    if (req.user!.role !== 'PARTNER' && req.user!.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only Partners can approve report issuance' });
    }

    const eligibility = await reportBlockingService.checkReportIssuanceEligibility(req.params.engagementId);
    if (!eligibility.canIssueReport) {
      return res.status(403).json({
        allowed: false,
        reason: 'Report issuance blocked',
        blockers: eligibility.blockers
      });
    }

    await prisma.auditTrail.create({
      data: {
        engagementId: req.params.engagementId,
        userId: req.user!.id,
        action: 'REPORT_ISSUANCE_APPROVED',
        entityType: 'ENGAGEMENT',
        entityId: req.params.engagementId,
        details: JSON.stringify({
          approvedBy: req.user!.fullName || req.user!.email,
          approvedAt: new Date(),
          healthScore: eligibility.healthScore
        })
      }
    });

    res.json({ 
      success: true, 
      message: "Report issuance approved by Partner"
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/engagements/:engagementId/ai-recommendation", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) return res.status(404).json({ error: access.error });

    if (req.user!.role !== 'PARTNER' && req.user!.role !== 'ADMIN' && req.user!.role !== 'MANAGER') {
      return res.status(403).json({ error: 'Only Partners/Managers can review AI recommendations' });
    }

    const { recommendationId, action, editedValue, reason } = req.body;
    if (!['ACCEPT', 'REJECT', 'EDIT'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action. Must be ACCEPT, REJECT, or EDIT' });
    }

    await prisma.auditTrail.create({
      data: {
        engagementId: req.params.engagementId,
        userId: req.user!.id,
        action: `AI_RECOMMENDATION_${action}`,
        entityType: 'AI_RECOMMENDATION',
        entityId: recommendationId || 'unknown',
        details: JSON.stringify({
          action,
          editedValue,
          reason,
          reviewedBy: req.user!.fullName || req.user!.email,
          reviewerRole: req.user!.role,
          reviewedAt: new Date()
        })
      }
    });

    res.json({ 
      success: true, 
      message: `AI recommendation ${action.toLowerCase()}ed`
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/engagements/:engagementId/gap/:gapId/mark-fixed", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) return res.status(404).json({ error: access.error });

    if (req.user!.role !== 'PARTNER' && req.user!.role !== 'ADMIN' && req.user!.role !== 'MANAGER') {
      return res.status(403).json({ error: 'Only Partners/Managers can mark gaps as fixed' });
    }

    await prisma.auditTrail.create({
      data: {
        engagementId: req.params.engagementId,
        userId: req.user!.id,
        action: 'GAP_MARKED_FIXED',
        entityType: 'GAP',
        entityId: req.params.gapId,
        details: JSON.stringify({
          markedBy: req.user!.fullName || req.user!.email,
          markedAt: new Date()
        })
      }
    });

    res.json({ 
      success: true, 
      message: "Gap marked as fixed"
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/engagements/:engagementId/gap/:gapId/assign", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) return res.status(404).json({ error: access.error });

    if (req.user!.role !== 'PARTNER' && req.user!.role !== 'ADMIN' && req.user!.role !== 'MANAGER') {
      return res.status(403).json({ error: 'Only Partners/Managers can assign staff to gaps' });
    }

    const { assigneeId } = req.body;
    if (!assigneeId) {
      return res.status(400).json({ error: 'Assignee ID is required' });
    }

    await prisma.auditTrail.create({
      data: {
        engagementId: req.params.engagementId,
        userId: req.user!.id,
        action: 'GAP_ASSIGNED',
        entityType: 'GAP',
        entityId: req.params.gapId,
        details: JSON.stringify({
          assignedTo: assigneeId,
          assignedBy: req.user!.fullName || req.user!.email,
          assignedAt: new Date()
        })
      }
    });

    res.json({ 
      success: true, 
      message: "Gap assigned to staff"
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
