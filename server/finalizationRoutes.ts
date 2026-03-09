import { Router, Response } from "express";
import { prisma } from "./db";
import { requireAuth, requireMinRole, logAuditTrail, type AuthenticatedRequest } from "./auth";
import { requirePhaseUnlocked, preventDeletionAfterFinalization } from "./middleware/auditLock";
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

    await logAuditTrail(req.user!.id, "SUBSEQUENT_EVENT_IDENTIFIED", "subsequent_event", event.id, null, event, req.params.engagementId, `Subsequent event ${event.eventReference} identified`, req.ip, req.get("user-agent"));
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

    const report = await prisma.auditReport.upsert({
      where: { engagementId: req.params.engagementId },
      update: { ...req.body },
      create: { ...req.body, engagementId: req.params.engagementId, draftedById: req.user!.id, draftedDate: new Date() },
    });

    await logAuditTrail(req.user!.id, "AUDIT_REPORT_DRAFTED", "audit_report", report.id, null, report, req.params.engagementId, "Audit report drafted", req.ip, req.get("user-agent"));
    res.json(report);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to save report", details: error.message });
  }
});

router.post("/:engagementId/report/partner-approve", requireAuth, requireMinRole("PARTNER"), requirePhaseUnlocked("REPORTING"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) return res.status(404).json({ error: access.error });

    const eqcr = await prisma.eQCRAssignment.findUnique({ where: { engagementId: req.params.engagementId } });
    if (eqcr?.isRequired && eqcr.status !== "CLEARED") {
      return res.status(400).json({ error: "EQCR clearance required before report approval" });
    }

    const report = await prisma.auditReport.update({
      where: { engagementId: req.params.engagementId },
      data: { partnerApprovedById: req.user!.id, partnerApprovalDate: new Date() },
    });

    await logAuditTrail(req.user!.id, "AUDIT_REPORT_PARTNER_APPROVED", "audit_report", report.id, null, { partnerApprovedById: req.user!.id }, req.params.engagementId, "Audit report partner approved", req.ip, req.get("user-agent"));
    res.json(report);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to approve report", details: error.message });
  }
});

router.post("/:engagementId/report/sign", requireAuth, requireMinRole("PARTNER"), requirePhaseUnlocked("REPORTING"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) return res.status(404).json({ error: access.error });

    const existing = await prisma.auditReport.findUnique({ where: { engagementId: req.params.engagementId } });
    if (!existing?.partnerApprovedById) {
      return res.status(400).json({ error: "Partner approval required before signing" });
    }

    const report = await prisma.auditReport.update({
      where: { engagementId: req.params.engagementId },
      data: { signedById: req.user!.id, signedDate: new Date(), signatureEvidence: req.body.signatureEvidence, reportDate: new Date() },
    });

    await logAuditTrail(req.user!.id, "AUDIT_REPORT_SIGNED", "audit_report", report.id, null, { signedById: req.user!.id }, req.params.engagementId, "Audit report signed", req.ip, req.get("user-agent"));
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

    const letter = await prisma.managementLetter.upsert({
      where: { engagementId: req.params.engagementId },
      update: { ...req.body },
      create: { ...req.body, engagementId: req.params.engagementId, draftedById: req.user!.id, draftedDate: new Date() },
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

    const memo = await prisma.completionMemo.upsert({
      where: { engagementId: req.params.engagementId },
      update: { ...req.body },
      create: { ...req.body, engagementId: req.params.engagementId, preparedById: req.user!.id, preparedDate: new Date() },
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

// Pre-report checklist validation
router.get("/:engagementId/pre-report-check", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) return res.status(404).json({ error: access.error });

    const [openNotes, unapprovedTests, incompleteMemo, eqcr, report] = await Promise.all([
      prisma.reviewNote.count({ where: { engagementId: req.params.engagementId, status: "OPEN" } }),
      prisma.substantiveTest.count({ where: { engagementId: req.params.engagementId, managerApprovedById: null } }),
      prisma.completionMemo.findUnique({ where: { engagementId: req.params.engagementId } }),
      prisma.eQCRAssignment.findUnique({ where: { engagementId: req.params.engagementId } }),
      prisma.auditReport.findUnique({ where: { engagementId: req.params.engagementId } }),
    ]);

    const issues = [];
    if (openNotes > 0) issues.push({ type: "OPEN_REVIEW_NOTES", count: openNotes, message: `${openNotes} open review notes` });
    if (unapprovedTests > 0) issues.push({ type: "UNAPPROVED_TESTS", count: unapprovedTests, message: `${unapprovedTests} unapproved substantive tests` });
    if (!incompleteMemo?.partnerApprovedById) issues.push({ type: "COMPLETION_MEMO", message: "Completion memo not approved" });
    if (eqcr?.isRequired && eqcr.status !== "CLEARED") issues.push({ type: "EQCR", message: "EQCR clearance required" });
    if (!report?.partnerApprovedById) issues.push({ type: "REPORT", message: "Audit report not approved" });

    res.json({ readyForRelease: issues.length === 0, issues });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to check", details: error.message });
  }
});

export default router;
