import { Router, Response } from "express";
import { prisma } from "./db";
import { requireAuth, requireMinRole, logAuditTrail, type AuthenticatedRequest } from "./auth";
import { requirePhaseUnlocked, preventDeletionAfterFinalization } from "./middleware/auditLock";
import { computePreDraftBlockers, computePreReportBlockers } from "./services/preReportBlockerService";
import { z } from "zod";

const router = Router();

async function validateEngagementAccess(engagementId: string, userId: string, firmId: string | null | undefined) {
  if (!firmId) return { valid: false, error: "User not associated with a firm" };
  const engagement = await prisma.engagement.findFirst({ where: { id: engagementId, firmId } });
  if (!engagement) return { valid: false, error: "Engagement not found" };
  return { valid: true, engagement };
}

// Subsequent Events
router.get("/:engagementId/subsequent-events", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) return res.status(404).json({ error: access.error });

    const events = await prisma.subsequentEvent.findMany({
      where: { engagementId: req.params.engagementId },
      include: {
        identifiedBy: { select: { id: true, fullName: true, role: true } },
        reviewedBy: { select: { id: true, fullName: true, role: true } },
        partnerApprovedBy: { select: { id: true, fullName: true, role: true } },
      },
      orderBy: { eventDate: "desc" },
    });
    res.json(events);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch events", details: error.message });
  }
});

router.post("/:engagementId/subsequent-events", requireAuth, requirePhaseUnlocked("FINALIZATION"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) return res.status(404).json({ error: access.error });

    const event = await prisma.subsequentEvent.create({
      data: { ...req.body, engagementId: req.params.engagementId, identifiedById: req.user!.id },
      include: { identifiedBy: { select: { id: true, fullName: true, role: true } } },
    });

    logAuditTrail(req.user!.id, "SUBSEQUENT_EVENT_IDENTIFIED", "subsequent_event", event.id, null, event, req.params.engagementId, `Subsequent event ${event.eventReference} identified`, req.ip, req.get("user-agent")).catch(err => console.error("Audit trail error:", err));
    res.status(201).json(event);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to create event", details: error.message });
  }
});

// Written Representations
router.get("/:engagementId/representations", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) return res.status(404).json({ error: access.error });

    const reps = await prisma.writtenRepresentation.findMany({
      where: { engagementId: req.params.engagementId },
      include: {
        preparedBy: { select: { id: true, fullName: true, role: true } },
        reviewedBy: { select: { id: true, fullName: true, role: true } },
      },
      orderBy: { createdAt: "asc" },
    });
    res.json(reps);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch representations", details: error.message });
  }
});

router.post("/:engagementId/representations", requireAuth, requirePhaseUnlocked("FINALIZATION"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) return res.status(404).json({ error: access.error });

    const rep = await prisma.writtenRepresentation.create({
      data: { ...req.body, engagementId: req.params.engagementId, preparedById: req.user!.id },
    });
    res.status(201).json(rep);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to create representation", details: error.message });
  }
});

// Audit Report
router.get("/:engagementId/report", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) return res.status(404).json({ error: access.error });

    const report = await prisma.auditReport.findUnique({
      where: { engagementId: req.params.engagementId },
      include: {
        draftedBy: { select: { id: true, fullName: true, role: true } },
        managerReviewedBy: { select: { id: true, fullName: true, role: true } },
        partnerApprovedBy: { select: { id: true, fullName: true, role: true } },
        signedBy: { select: { id: true, fullName: true, role: true } },
      },
    });
    res.json(report);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch report", details: error.message });
  }
});

router.post("/:engagementId/report", requireAuth, requirePhaseUnlocked("REPORTING"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) return res.status(404).json({ error: access.error });

    const draftCheck = await computePreDraftBlockers(req.params.engagementId);
    if (!draftCheck.readyForDraft) {
      return res.status(400).json({ error: "Completion-phase blockers must be resolved before report drafting", blockers: draftCheck.issues });
    }

    const allowedFields = ["opinionType", "basisForOpinion", "keyAuditMatters", "emphasisOfMatter", "otherMatter", "goingConcernNote", "otherInformation", "reportTitle"];
    const safeData: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (req.body[key] !== undefined) safeData[key] = req.body[key];
    }

    const report = await prisma.auditReport.upsert({
      where: { engagementId: req.params.engagementId },
      update: safeData,
      create: { ...safeData, engagementId: req.params.engagementId, draftedById: req.user!.id, draftedDate: new Date() },
    });

    logAuditTrail(req.user!.id, "AUDIT_REPORT_DRAFTED", "audit_report", report.id, null, report, req.params.engagementId, "Audit report drafted", req.ip, req.get("user-agent")).catch(err => console.error("Audit trail error:", err));
    res.json(report);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to save report", details: error.message });
  }
});

router.post("/:engagementId/report/partner-approve", requireAuth, requireMinRole("PARTNER"), requirePhaseUnlocked("REPORTING"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) return res.status(404).json({ error: access.error });

    const draftCheck = await computePreDraftBlockers(req.params.engagementId);
    if (!draftCheck.readyForDraft) {
      return res.status(400).json({ error: "Completion-phase blockers must be resolved before approval", blockers: draftCheck.issues });
    }

    const report = await prisma.auditReport.update({
      where: { engagementId: req.params.engagementId },
      data: { partnerApprovedById: req.user!.id, partnerApprovalDate: new Date() },
    });

    logAuditTrail(req.user!.id, "AUDIT_REPORT_PARTNER_APPROVED", "audit_report", report.id, null, { partnerApprovedById: req.user!.id }, req.params.engagementId, "Audit report partner approved", req.ip, req.get("user-agent")).catch(err => console.error("Audit trail error:", err));
    res.json(report);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to approve report", details: error.message });
  }
});

router.post("/:engagementId/report/sign", requireAuth, requireMinRole("PARTNER"), requirePhaseUnlocked("REPORTING"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) return res.status(404).json({ error: access.error });

    const draftCheck = await computePreDraftBlockers(req.params.engagementId);
    if (!draftCheck.readyForDraft) {
      return res.status(400).json({ error: "Completion-phase blockers must be resolved before signing", blockers: draftCheck.issues });
    }

    const existing = await prisma.auditReport.findUnique({ where: { engagementId: req.params.engagementId } });
    if (!existing?.partnerApprovedById) {
      return res.status(400).json({ error: "Partner approval required before signing" });
    }

    const report = await prisma.auditReport.update({
      where: { engagementId: req.params.engagementId },
      data: { signedById: req.user!.id, signedDate: new Date(), signatureEvidence: req.body.signatureEvidence, reportDate: new Date() },
    });

    logAuditTrail(req.user!.id, "AUDIT_REPORT_SIGNED", "audit_report", report.id, null, { signedById: req.user!.id }, req.params.engagementId, "Audit report signed", req.ip, req.get("user-agent")).catch(err => console.error("Audit trail error:", err));
    res.json(report);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to sign report", details: error.message });
  }
});

// Management Letter
router.get("/:engagementId/management-letter", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) return res.status(404).json({ error: access.error });

    const letter = await prisma.managementLetter.findUnique({
      where: { engagementId: req.params.engagementId },
      include: {
        draftedBy: { select: { id: true, fullName: true, role: true } },
        partnerApprovedBy: { select: { id: true, fullName: true, role: true } },
      },
    });
    res.json(letter);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch letter", details: error.message });
  }
});

router.post("/:engagementId/management-letter", requireAuth, requirePhaseUnlocked("FINALIZATION"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) return res.status(404).json({ error: access.error });

    const letterAllowedFields = ["subject", "findings", "recommendations", "managementResponses", "letterBody"];
    const letterData: Record<string, unknown> = {};
    for (const key of letterAllowedFields) {
      if (req.body[key] !== undefined) letterData[key] = req.body[key];
    }

    const letter = await prisma.managementLetter.upsert({
      where: { engagementId: req.params.engagementId },
      update: letterData,
      create: { ...letterData, engagementId: req.params.engagementId, draftedById: req.user!.id, draftedDate: new Date() },
    });
    res.json(letter);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to save letter", details: error.message });
  }
});

// Completion Memo
router.get("/:engagementId/completion-memo", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) return res.status(404).json({ error: access.error });

    const memo = await prisma.completionMemo.findUnique({
      where: { engagementId: req.params.engagementId },
      include: {
        preparedBy: { select: { id: true, fullName: true, role: true } },
        managerReviewedBy: { select: { id: true, fullName: true, role: true } },
        partnerApprovedBy: { select: { id: true, fullName: true, role: true } },
      },
    });
    res.json(memo);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch memo", details: error.message });
  }
});

router.post("/:engagementId/completion-memo", requireAuth, requirePhaseUnlocked("FINALIZATION"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) return res.status(404).json({ error: access.error });

    const memoAllowedFields = ["summaryOfAudit", "significantFindings", "significantJudgments", "misstatementSummary", "misstatementConclusion", "subsequentEventsConclusion", "goingConcernConclusion", "overallConclusion", "opinionRecommendation"];
    const memoData: Record<string, unknown> = {};
    for (const key of memoAllowedFields) {
      if (req.body[key] !== undefined) memoData[key] = req.body[key];
    }

    const memo = await prisma.completionMemo.upsert({
      where: { engagementId: req.params.engagementId },
      update: memoData,
      create: { ...memoData, engagementId: req.params.engagementId, preparedById: req.user!.id, preparedDate: new Date() },
    });
    res.json(memo);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to save memo", details: error.message });
  }
});

// Compliance Checklists
router.get("/:engagementId/checklists", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) return res.status(404).json({ error: access.error });

    const checklists = await prisma.complianceChecklist.findMany({
      where: { engagementId: req.params.engagementId },
      include: {
        preparedBy: { select: { id: true, fullName: true, role: true } },
        reviewedBy: { select: { id: true, fullName: true, role: true } },
        partnerApprovedBy: { select: { id: true, fullName: true, role: true } },
      },
    });
    res.json(checklists);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch checklists", details: error.message });
  }
});

router.post("/:engagementId/checklists", requireAuth, requirePhaseUnlocked("FINALIZATION"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) return res.status(404).json({ error: access.error });

    const checklist = await prisma.complianceChecklist.upsert({
      where: { engagementId_checklistType: { engagementId: req.params.engagementId, checklistType: req.body.checklistType } },
      update: { ...req.body },
      create: { ...req.body, engagementId: req.params.engagementId, preparedById: req.user!.id, preparedDate: new Date() },
    });
    res.json(checklist);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to save checklist", details: error.message });
  }
});

router.get("/:engagementId/finalization-stats", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) return res.status(404).json({ error: access.error });

    const eid = req.params.engagementId;
    const [events, gcAssessment, representations, memo, observations, adjustments, checklists] = await Promise.all([
      prisma.subsequentEvent.findMany({
        where: { engagementId: eid },
        select: { id: true, eventReference: true, eventType: true, evaluation: true, reviewedById: true, partnerApprovedById: true },
      }),
      prisma.goingConcernAssessment.findFirst({
        where: { engagementId: eid },
        select: { id: true, auditConclusion: true, auditEvidence: true, reviewedById: true, partnerApprovedById: true },
      }),
      prisma.writtenRepresentation.findMany({
        where: { engagementId: eid },
        select: { id: true, representationType: true, managementAcknowledged: true, preparedById: true, reviewedById: true },
      }),
      prisma.completionMemo.findUnique({
        where: { engagementId: eid },
        select: {
          id: true, summaryOfAudit: true, overallConclusion: true, significantFindings: true,
          subsequentEventsConclusion: true, goingConcernConclusion: true,
          preparedById: true, managerReviewedById: true, partnerApprovedById: true,
          preparedDate: true, managerReviewDate: true, partnerApprovalDate: true,
        },
      }),
      prisma.observation.findMany({
        where: { engagementId: eid },
        select: { id: true, status: true, severity: true, type: true },
      }),
      prisma.auditAdjustment.findMany({
        where: { engagementId: eid },
        select: { id: true, status: true, adjustmentType: true, managementAccepted: true, netImpact: true },
      }),
      prisma.complianceChecklist.findMany({
        where: { engagementId: eid, checklistType: "COMPLETION" },
        select: { id: true, isComplete: true },
      }),
    ]);

    const openFindings = observations.filter((o: any) => ["OPEN", "UNDER_REVIEW"].includes(o.status));
    const criticalOpen = openFindings.filter((o: any) => ["HIGH", "CRITICAL"].includes(o.severity));
    const resolvedFindings = observations.filter((o: any) => ["CLEARED", "ADJUSTED", "WAIVED", "CLOSED"].includes(o.status));
    const pendingAdj = adjustments.filter((a: any) => a.status === "IDENTIFIED");
    const uncorrectedAdj = adjustments.filter((a: any) => a.adjustmentType === "UNCORRECTED");
    const eventsReviewed = events.filter((e: any) => e.reviewedById);

    const mgmtRepObtained = representations.some((r: any) =>
      (r.representationType === "MANAGEMENT" || r.representationType === "GENERAL") &&
      r.managementAcknowledged
    );

    const completionProgress = {
      checklistDone: checklists.length > 0 && checklists.every((c: any) => c.isComplete),
      subsequentEventsReviewed: events.length === 0 || events.every((e: any) => e.evaluation && e.reviewedById),
      goingConcernAssessed: !!(gcAssessment?.auditConclusion && gcAssessment?.auditEvidence),
      representationObtained: mgmtRepObtained,
      findingsAddressed: criticalOpen.length === 0 && pendingAdj.length === 0,
      memoComplete: !!(memo?.overallConclusion),
      managerReviewed: !!(memo?.managerReviewedById),
      partnerApproved: !!(memo?.partnerApprovedById),
    };

    const doneCount = Object.values(completionProgress).filter(Boolean).length;
    const totalCount = Object.keys(completionProgress).length;

    res.json({
      subsequentEvents: { total: events.length, reviewed: eventsReviewed.length, pending: events.length - eventsReviewed.length },
      goingConcern: gcAssessment ? {
        concluded: !!gcAssessment.auditConclusion,
        conclusion: gcAssessment.auditConclusion,
        reviewed: !!gcAssessment.reviewedById,
        partnerApproved: !!gcAssessment.partnerApprovedById,
      } : null,
      representations: {
        total: representations.length,
        obtained: mgmtRepObtained,
        items: representations,
      },
      completionMemo: memo ? {
        hasSummary: !!memo.summaryOfAudit,
        hasConclusion: !!memo.overallConclusion,
        hasFindings: !!memo.significantFindings,
        managerReviewed: !!memo.managerReviewedById,
        partnerApproved: !!memo.partnerApprovedById,
        preparedDate: memo.preparedDate,
        managerReviewDate: memo.managerReviewDate,
        partnerApprovalDate: memo.partnerApprovalDate,
      } : null,
      findings: {
        total: observations.length,
        open: openFindings.length,
        criticalOpen: criticalOpen.length,
        resolved: resolvedFindings.length,
      },
      adjustments: {
        total: adjustments.length,
        pending: pendingAdj.length,
        uncorrected: uncorrectedAdj.length,
        uncorrectedTotal: uncorrectedAdj.reduce((sum: number, a: any) => sum + Math.abs(Number(a.netImpact) || 0), 0),
      },
      completionProgress,
      completionPercent: totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0,
      reportReady: doneCount === totalCount,
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch finalization stats", details: error.message });
  }
});

router.get("/:engagementId/pre-report-check", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) return res.status(404).json({ error: access.error });

    const [draftResult, releaseResult] = await Promise.all([
      computePreDraftBlockers(req.params.engagementId),
      computePreReportBlockers(req.params.engagementId),
    ]);
    res.json({
      readyForDraft: draftResult.readyForDraft,
      readyForRelease: releaseResult.readyForRelease,
      draftIssues: draftResult.issues,
      issues: releaseResult.issues,
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to check", details: error.message });
  }
});

export default router;
