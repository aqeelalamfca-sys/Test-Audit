import { Router, Response } from "express";
import { prisma } from "./db";

const router = Router();

interface AuthenticatedRequest {
  user?: { id: string; firmId: string; role: true };
  params: any;
  body: any;
  query: any;
  ip?: string;
  get: (header: string) => string | undefined;
}

function requireAuth(req: AuthenticatedRequest, res: Response, next: Function) {
  if (!req.user) return res.status(401).json({ error: "Authentication required" });
  next();
}

async function validateEngagementAccess(engagementId: string, userId: string, firmId: string | undefined) {
  if (!firmId) return { valid: false, error: "User not associated with a firm" };
  const engagement = await prisma.engagement.findFirst({ where: { id: engagementId, firmId } });
  if (!engagement) return { valid: false, error: "Engagement not found" };
  return { valid: true, engagement };
}

async function logAuditTrail(userId: string, action: string, entityType: string, entityId: string | null, beforeValue: any, afterValue: any, engagementId: string, justification: string, ipAddress?: string, userAgent?: string) {
  await prisma.auditTrail.create({ data: { userId, action, entityType, entityId, beforeValue, afterValue, engagementId, justification, ipAddress, userAgent } });
}

// Inspection Readiness Dashboard
router.get("/:engagementId/readiness", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) return res.status(404).json({ error: access.error });

    const [phases, checklistItems, openReviewNotes, tests, risks, evidence, eqcr, report] = await Promise.all([
      prisma.phaseProgress.findMany({ where: { engagementId: req.params.engagementId } }),
      prisma.checklistItem.findMany({ where: { engagementId: req.params.engagementId } }),
      prisma.reviewNote.count({ where: { engagementId: req.params.engagementId, status: "OPEN" } }),
      prisma.substantiveTest.findMany({ where: { engagementId: req.params.engagementId }, select: { id: true, riskId: true, conclusion: true, evidenceLinks: true } }),
      prisma.riskAssessment.findMany({ where: { engagementId: req.params.engagementId }, select: { id: true, plannedResponse: true } }),
      prisma.evidenceFile.count({ where: { engagementId: req.params.engagementId, status: "ACTIVE" } }),
      prisma.eQCRAssignment.findUnique({ where: { engagementId: req.params.engagementId } }),
      prisma.auditReport.findUnique({ where: { engagementId: req.params.engagementId } }),
    ]);

    const phaseLockStatus = phases.reduce((acc: any, p) => { acc[p.phase] = p.status; return acc; }, {});
    const checklistCompletion = {
      total: checklistItems.length,
      completed: checklistItems.filter(c => c.status === "COMPLETED").length,
      percentage: checklistItems.length ? Math.round((checklistItems.filter(c => c.status === "COMPLETED").length / checklistItems.length) * 100) : 0,
    };

    const risksWithTests = risks.filter(r => tests.some(t => t.riskId === r.id));
    const testsWithConclusions = tests.filter(t => t.conclusion);
    const testsWithEvidence = tests.filter(t => t.evidenceLinks?.length > 0);

    const mappingCompleteness = {
      risksAddressed: { total: risks.length, addressed: risksWithTests.length },
      testsWithConclusions: { total: tests.length, concluded: testsWithConclusions.length },
      testsWithEvidence: { total: tests.length, evidenced: testsWithEvidence.length },
    };

    const issues = [];
    if (openReviewNotes > 0) issues.push({ type: "OPEN_REVIEW_NOTES", count: openReviewNotes });
    if (checklistCompletion.percentage < 100) issues.push({ type: "INCOMPLETE_CHECKLISTS", percentage: checklistCompletion.percentage });
    if (risksWithTests.length < risks.length) issues.push({ type: "UNADDRESSED_RISKS", count: risks.length - risksWithTests.length });
    if (testsWithConclusions.length < tests.length) issues.push({ type: "TESTS_WITHOUT_CONCLUSIONS", count: tests.length - testsWithConclusions.length });
    if (eqcr?.isRequired && eqcr.status !== "CLEARED") issues.push({ type: "EQCR_NOT_CLEARED" });
    if (!report?.signedById) issues.push({ type: "REPORT_NOT_SIGNED" });

    const overallReadiness = Math.round(
      (checklistCompletion.percentage * 0.2 +
        (risksWithTests.length / Math.max(risks.length, 1)) * 100 * 0.2 +
        (testsWithConclusions.length / Math.max(tests.length, 1)) * 100 * 0.2 +
        (testsWithEvidence.length / Math.max(tests.length, 1)) * 100 * 0.2 +
        (openReviewNotes === 0 ? 100 : 0) * 0.2)
    );

    const readiness = await prisma.inspectionReadiness.upsert({
      where: { engagementId: req.params.engagementId },
      update: {
        lastCheckedDate: new Date(),
        lastCheckedById: req.user!.id,
        phaseLockStatus,
        checklistCompletion,
        openItemsCount: openReviewNotes,
        riskToProcedureMapping: mappingCompleteness,
        overallReadiness,
        readinessIssues: issues,
      },
      create: {
        engagementId: req.params.engagementId,
        lastCheckedDate: new Date(),
        lastCheckedById: req.user!.id,
        phaseLockStatus,
        checklistCompletion,
        openItemsCount: openReviewNotes,
        riskToProcedureMapping: mappingCompleteness,
        overallReadiness,
        readinessIssues: issues,
      },
    });

    res.json({
      ...readiness,
      evidenceFileCount: evidence,
      eqcrStatus: eqcr?.status || "NOT_REQUIRED",
      reportStatus: report?.signedById ? "SIGNED" : report?.partnerApprovedById ? "APPROVED" : "DRAFT",
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch readiness", details: error.message });
  }
});

// Export Logs
router.get("/:engagementId/exports", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) return res.status(404).json({ error: access.error });

    const exports = await prisma.exportLog.findMany({
      where: { engagementId: req.params.engagementId },
      include: { exportedBy: { select: { id: true, fullName: true, role: true } } },
      orderBy: { exportedDate: "desc" },
    });
    res.json(exports);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch exports", details: error.message });
  }
});

router.post("/:engagementId/exports", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) return res.status(404).json({ error: access.error });

    if (req.body.exportType === "FINAL_AUDIT_FILE") {
      const report = await prisma.auditReport.findUnique({ where: { engagementId: req.params.engagementId } });
      const finalization = await prisma.phaseProgress.findFirst({ where: { engagementId: req.params.engagementId, phase: "FINALIZATION", status: "LOCKED" } });
      
      if (!report?.signedById || !finalization) {
        return res.status(400).json({ error: "Final audit file export requires signed report and locked finalization phase" });
      }
    }

    const exportLog = await prisma.exportLog.create({
      data: {
        engagementId: req.params.engagementId,
        exportType: req.body.exportType,
        exportFormat: req.body.exportFormat,
        exportFilePath: req.body.exportFilePath,
        exportedById: req.user!.id,
        exportParameters: req.body.parameters,
      },
      include: { exportedBy: { select: { id: true, fullName: true, role: true } } },
    });

    await logAuditTrail(req.user!.id, "EXPORT_CREATED", "export_log", exportLog.id, null, exportLog, req.params.engagementId, `Export: ${req.body.exportType} as ${req.body.exportFormat}`, req.ip, req.get("user-agent"));
    res.status(201).json(exportLog);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to create export", details: error.message });
  }
});

// Audit Trail Export
router.get("/:engagementId/audit-trail", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) return res.status(404).json({ error: access.error });

    const trail = await prisma.auditTrail.findMany({
      where: { engagementId: req.params.engagementId },
      include: { user: { select: { id: true, fullName: true, role: true } } },
      orderBy: { createdAt: "desc" },
      take: req.query.limit ? parseInt(req.query.limit as string) : 1000,
    });
    res.json(trail);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch audit trail", details: error.message });
  }
});

export default router;
