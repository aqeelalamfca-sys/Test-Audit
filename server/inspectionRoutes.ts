import { Router, Response } from "express";
import { createHash } from "crypto";
import { prisma } from "./db";
import { requireAuth, requireMinRole, logAuditTrail, type AuthenticatedRequest } from "./auth";

const router = Router();

async function validateEngagementAccess(engagementId: string, userId: string, firmId: string | undefined) {
  if (!firmId) return { valid: false, error: "User not associated with a firm" };
  const engagement = await prisma.engagement.findFirst({ where: { id: engagementId, firmId } });
  if (!engagement) return { valid: false, error: "Engagement not found" };
  return { valid: true, engagement };
}

async function enforceArchiveImmutability(engagementId: string, res: Response): Promise<boolean> {
  const archive = await prisma.archivePackage.findUnique({ where: { engagementId } });
  if (archive && (archive.status === "SEALED" || archive.status === "RELEASED")) {
    res.status(403).json({ error: "Archive is sealed — no modifications allowed" });
    return true;
  }
  return false;
}

router.get("/:engagementId/stats", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) return res.status(404).json({ error: access.error });
    const eid = req.params.engagementId;

    const [
      phases, checklistItems, openReviewNotes, tests, risks,
      evidenceCount, eqcr, report, deliverables,
      exportLogs, auditTrailCount, archive, readiness
    ] = await Promise.all([
      prisma.phaseProgress.findMany({ where: { engagementId: eid } }),
      prisma.checklistItem.findMany({ where: { engagementId: eid } }),
      prisma.reviewNote.count({ where: { engagementId: eid, status: "OPEN" } }),
      prisma.substantiveTest.findMany({ where: { engagementId: eid }, select: { id: true, riskId: true, conclusion: true, evidenceLinks: true } }),
      prisma.riskAssessment.findMany({ where: { engagementId: eid }, select: { id: true, plannedResponse: true } }),
      prisma.evidenceFile.count({ where: { engagementId: eid, status: "ACTIVE" } }),
      prisma.eQCRAssignment.findUnique({ where: { engagementId: eid }, include: { partnerComment: true } }),
      prisma.auditReport.findUnique({ where: { engagementId: eid } }),
      prisma.deliverable.findMany({ where: { engagementId: eid } }),
      prisma.exportLog.findMany({ where: { engagementId: eid }, orderBy: { exportedDate: "desc" }, take: 5 }),
      prisma.auditTrail.count({ where: { engagementId: eid } }),
      prisma.archivePackage.findUnique({ where: { engagementId: eid } }),
      prisma.inspectionReadiness.findUnique({ where: { engagementId: eid } }),
    ]);

    const phaseLockStatus = phases.reduce((acc: any, p) => { acc[p.phase] = p.status; return acc; }, {});
    const completedPhases = phases.filter(p => p.status === "LOCKED" || p.status === "COMPLETED").length;
    const checklistCompleted = checklistItems.filter(c => c.status === "COMPLETED").length;
    const testsWithConclusions = tests.filter(t => t.conclusion).length;
    const risksAddressed = risks.filter(r => tests.some(t => t.riskId === r.id)).length;
    const deliverablesFinal = deliverables.filter((d: any) => d.status === "ISSUED" || d.status === "FINALIZED").length;

    const eqcrStatus = eqcr
      ? (eqcr.isFinalized ? "FINALIZED" : eqcr.status || "IN_PROGRESS")
      : "NOT_REQUIRED";
    const eqcrClearance = eqcr?.partnerComment?.clearanceStatus || "PENDING";
    const reportSigned = !!report?.signedById;

    res.json({
      success: true,
      data: {
        archiveStatus: archive?.status || "PENDING",
        archiveSealedAt: archive?.sealedAt,
        archiveReleasedAt: archive?.releasedAt,
        readinessScore: readiness?.overallReadiness || 0,
        readinessIssues: readiness?.readinessIssues || [],
        phaseLockStatus,
        metrics: {
          totalPhases: phases.length,
          completedPhases,
          totalWorkpapers: evidenceCount,
          totalFindings: tests.filter(t => t.conclusion && t.conclusion !== "SATISFACTORY").length,
          openItems: openReviewNotes,
          totalAdjustments: 0,
          checklistTotal: checklistItems.length,
          checklistCompleted,
          risksTotal: risks.length,
          risksAddressed,
          testsTotal: tests.length,
          testsWithConclusions,
          deliverablesTotal: deliverables.length,
          deliverablesFinal,
          auditTrailEntries: auditTrailCount,
          exportCount: exportLogs.length,
        },
        eqcrStatus,
        eqcrClearance,
        reportSigned,
        recentExports: exportLogs,
        engagement: {
          code: access.engagement!.engagementCode,
          clientName: "",
          periodStart: access.engagement!.periodStart,
          periodEnd: access.engagement!.periodEnd,
          status: access.engagement!.status,
        },
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch archive stats", details: error.message });
  }
});

router.get("/:engagementId/readiness", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) return res.status(404).json({ error: access.error });
    const eid = req.params.engagementId;

    const archiveCheck = await prisma.archivePackage.findUnique({ where: { engagementId: eid } });
    if (archiveCheck && (archiveCheck.status === "SEALED" || archiveCheck.status === "RELEASED")) {
      const cached = await prisma.inspectionReadiness.findUnique({ where: { engagementId: eid } });
      return res.json({ success: true, data: cached || {}, sealed: true });
    }

    const [phases, checklistItems, openReviewNotes, tests, risks, evidence, eqcr, report] = await Promise.all([
      prisma.phaseProgress.findMany({ where: { engagementId: eid } }),
      prisma.checklistItem.findMany({ where: { engagementId: eid } }),
      prisma.reviewNote.count({ where: { engagementId: eid, status: "OPEN" } }),
      prisma.substantiveTest.findMany({ where: { engagementId: eid }, select: { id: true, riskId: true, conclusion: true, evidenceLinks: true } }),
      prisma.riskAssessment.findMany({ where: { engagementId: eid }, select: { id: true, plannedResponse: true } }),
      prisma.evidenceFile.count({ where: { engagementId: eid, status: "ACTIVE" } }),
      prisma.eQCRAssignment.findUnique({ where: { engagementId: eid } }),
      prisma.auditReport.findUnique({ where: { engagementId: eid } }),
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

    const issues: any[] = [];
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
      where: { engagementId: eid },
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
        engagementId: eid,
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
      success: true,
      data: {
        ...readiness,
        evidenceFileCount: evidence,
        eqcrStatus: eqcr?.status || "NOT_REQUIRED",
        reportStatus: report?.signedById ? "SIGNED" : report?.partnerApprovedById ? "APPROVED" : "DRAFT",
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch readiness", details: error.message });
  }
});

router.get("/:engagementId/archive", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) return res.status(404).json({ error: access.error });

    const archive = await prisma.archivePackage.findUnique({
      where: { engagementId: req.params.engagementId },
      include: {
        sealedBy: { select: { id: true, fullName: true, role: true } },
        releasedBy: { select: { id: true, fullName: true, role: true } },
      },
    });

    res.json({ success: true, data: archive });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch archive", details: error.message });
  }
});

router.post("/:engagementId/archive/build", requireAuth, requireMinRole("PARTNER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) return res.status(404).json({ error: access.error });
    const eid = req.params.engagementId;

    const existing = await prisma.archivePackage.findUnique({ where: { engagementId: eid } });
    if (existing && (existing.status === "SEALED" || existing.status === "RELEASED")) {
      return res.status(400).json({ error: "Archive is already sealed — cannot rebuild" });
    }

    const [phases, deliverables, evidenceCount, checklistItems, tests, risks, auditTrailCount, eqcr, report] = await Promise.all([
      prisma.phaseProgress.findMany({ where: { engagementId: eid } }),
      prisma.deliverable.findMany({ where: { engagementId: eid } }),
      prisma.evidenceFile.count({ where: { engagementId: eid, status: "ACTIVE" } }),
      prisma.checklistItem.findMany({ where: { engagementId: eid } }),
      prisma.substantiveTest.count({ where: { engagementId: eid } }),
      prisma.riskAssessment.count({ where: { engagementId: eid } }),
      prisma.auditTrail.count({ where: { engagementId: eid } }),
      prisma.eQCRAssignment.findUnique({ where: { engagementId: eid }, include: { partnerComment: true } }),
      prisma.auditReport.findUnique({ where: { engagementId: eid } }),
    ]);

    const manifest = {
      builtAt: new Date().toISOString(),
      builtById: req.user!.id,
      contents: {
        phases: phases.map(p => ({ phase: p.phase, status: p.status })),
        deliverables: deliverables.length,
        evidenceFiles: evidenceCount,
        checklistItems: checklistItems.length,
        substantiveTests: tests,
        riskAssessments: risks,
        auditTrailEntries: auditTrailCount,
        eqcrStatus: eqcr?.status || "NOT_REQUIRED",
        eqcrClearance: eqcr?.partnerComment?.clearanceStatus || "N/A",
        reportSigned: !!report?.signedById,
      },
    };

    const frozenSnapshot = {
      frozenAt: new Date().toISOString(),
      phases: phases.map(p => ({ phase: p.phase, status: p.status, updatedAt: p.updatedAt })),
      deliverables: deliverables.map((d: any) => ({
        id: d.id, name: d.name || d.title, type: d.type, status: d.status, issuedAt: d.issuedAt,
      })),
      checklistSummary: {
        total: checklistItems.length,
        completed: checklistItems.filter(c => c.status === "COMPLETED").length,
      },
      eqcr: eqcr ? {
        status: eqcr.status,
        isFinalized: eqcr.isFinalized,
        clearance: eqcr.partnerComment?.clearanceStatus,
      } : null,
      report: report ? {
        signed: !!report.signedById,
        signedDate: report.signedDate,
        opinionType: report.opinionType,
      } : null,
    };

    const hash = createHash("sha256").update(JSON.stringify(manifest)).digest("hex");

    const archive = await prisma.archivePackage.upsert({
      where: { engagementId: eid },
      update: {
        status: "BUILDING",
        packageManifest: manifest,
        frozenSnapshot,
        packageHash: hash,
        notes: req.body.notes || null,
      },
      create: {
        engagementId: eid,
        status: "BUILDING",
        packageManifest: manifest,
        frozenSnapshot,
        packageHash: hash,
        notes: req.body.notes || null,
      },
    });

    await logAuditTrail(req.user!.id, "ARCHIVE_BUILT", "archive_package", archive.id, null, { status: "BUILDING" }, eid, "Archive package built", req.ip, req.get("user-agent"));

    res.json({ success: true, data: archive });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to build archive", details: error.message });
  }
});

router.post("/:engagementId/archive/seal", requireAuth, requireMinRole("PARTNER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) return res.status(404).json({ error: access.error });
    const eid = req.params.engagementId;

    const archive = await prisma.archivePackage.findUnique({ where: { engagementId: eid } });
    if (!archive) return res.status(400).json({ error: "Archive package must be built first" });
    if (archive.status === "SEALED" || archive.status === "RELEASED") {
      return res.status(400).json({ error: "Archive is already sealed" });
    }
    if (archive.status !== "BUILDING") {
      return res.status(400).json({ error: "Archive must be in BUILDING state to seal" });
    }

    const readiness = await prisma.inspectionReadiness.findUnique({ where: { engagementId: eid } });
    if (!readiness || readiness.overallReadiness < 80) {
      return res.status(400).json({ error: `Archive readiness too low (${readiness?.overallReadiness || 0}%) — must be ≥80% to seal` });
    }

    const sealed = await prisma.archivePackage.update({
      where: { engagementId: eid },
      data: {
        status: "SEALED",
        sealedAt: new Date(),
        sealedById: req.user!.id,
      },
      include: {
        sealedBy: { select: { id: true, fullName: true, role: true } },
      },
    });

    await logAuditTrail(req.user!.id, "ARCHIVE_SEALED", "archive_package", sealed.id, { status: "BUILDING" }, { status: "SEALED" }, eid, "Archive sealed — engagement file is now immutable", req.ip, req.get("user-agent"));

    res.json({ success: true, data: sealed });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to seal archive", details: error.message });
  }
});

router.post("/:engagementId/archive/release", requireAuth, requireMinRole("PARTNER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) return res.status(404).json({ error: access.error });
    const eid = req.params.engagementId;

    const archive = await prisma.archivePackage.findUnique({ where: { engagementId: eid } });
    if (!archive) return res.status(400).json({ error: "Archive package must be built first" });
    if (archive.status === "RELEASED") return res.status(400).json({ error: "Archive is already released" });
    if (archive.status !== "SEALED") return res.status(400).json({ error: "Archive must be sealed before releasing" });

    const released = await prisma.$transaction(async (tx) => {
      const pkg = await tx.archivePackage.update({
        where: { engagementId: eid },
        data: {
          status: "RELEASED",
          releasedAt: new Date(),
          releasedById: req.user!.id,
        },
        include: {
          releasedBy: { select: { id: true, fullName: true, role: true } },
        },
      });
      await tx.engagement.update({
        where: { id: eid },
        data: { status: "ARCHIVED" },
      });
      return pkg;
    });

    await logAuditTrail(req.user!.id, "ARCHIVE_RELEASED", "archive_package", released.id, { status: "SEALED" }, { status: "RELEASED" }, eid, "Archive released — engagement transitioned to ARCHIVED state", req.ip, req.get("user-agent"));

    res.json({ success: true, data: released });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to release archive", details: error.message });
  }
});

router.post("/:engagementId/archive/generate-index", requireAuth, requireMinRole("PARTNER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) return res.status(404).json({ error: access.error });
    const eid = req.params.engagementId;

    if (await enforceArchiveImmutability(eid, res)) return;

    const [phases, deliverables, evidenceFiles, checklistItems, tests, risks, reviewNotes, eqcr, report] = await Promise.all([
      prisma.phaseProgress.findMany({ where: { engagementId: eid }, orderBy: { updatedAt: "asc" } }),
      prisma.deliverable.findMany({ where: { engagementId: eid } }),
      prisma.evidenceFile.findMany({ where: { engagementId: eid, status: "ACTIVE" }, select: { id: true, fileName: true, fileType: true, category: true, uploadedAt: true } }),
      prisma.checklistItem.findMany({ where: { engagementId: eid }, select: { id: true, section: true, question: true, status: true } }),
      prisma.substantiveTest.findMany({ where: { engagementId: eid }, select: { id: true, description: true, conclusion: true } }),
      prisma.riskAssessment.findMany({ where: { engagementId: eid }, select: { id: true, area: true, riskLevel: true, plannedResponse: true } }),
      prisma.reviewNote.findMany({ where: { engagementId: eid }, select: { id: true, title: true, status: true, priority: true, createdAt: true } }),
      prisma.eQCRAssignment.findUnique({ where: { engagementId: eid }, include: { partnerComment: true } }),
      prisma.auditReport.findUnique({ where: { engagementId: eid } }),
    ]);

    const archiveIndex = {
      generatedAt: new Date().toISOString(),
      sections: [
        {
          ref: "A",
          title: "Engagement Administration",
          items: [
            { ref: "A.1", description: "Engagement letter & amendments", count: deliverables.filter((d: any) => d.type === "ENGAGEMENT_LETTER").length },
            { ref: "A.2", description: "Independence declarations", count: 0 },
            { ref: "A.3", description: "Client acceptance documentation", count: 0 },
          ],
        },
        {
          ref: "B",
          title: "Planning & Strategy",
          items: [
            { ref: "B.1", description: "Planning memorandum", count: phases.filter(p => p.phase === "PLANNING").length },
            { ref: "B.2", description: "Risk assessments", count: risks.length, details: risks.map(r => ({ id: r.id, area: r.area, riskLevel: r.riskLevel })) },
            { ref: "B.3", description: "Materiality calculations", count: 0 },
          ],
        },
        {
          ref: "C",
          title: "Execution & Testing",
          items: [
            { ref: "C.1", description: "Substantive tests", count: tests.length },
            { ref: "C.2", description: "Compliance checklists", count: checklistItems.length, completedCount: checklistItems.filter(c => c.status === "COMPLETED").length },
            { ref: "C.3", description: "Evidence files", count: evidenceFiles.length },
          ],
        },
        {
          ref: "D",
          title: "Review & Quality",
          items: [
            { ref: "D.1", description: "Review notes", count: reviewNotes.length, openCount: reviewNotes.filter(r => r.status === "OPEN").length },
            { ref: "D.2", description: "EQCR documentation", count: eqcr ? 1 : 0, status: eqcr?.partnerComment?.clearanceStatus || "N/A" },
          ],
        },
        {
          ref: "E",
          title: "Reporting & Deliverables",
          items: [
            { ref: "E.1", description: "Audit report", count: report ? 1 : 0, signed: !!report?.signedById },
            { ref: "E.2", description: "Deliverables register", count: deliverables.length },
          ],
        },
        {
          ref: "F",
          title: "Completion & Archive",
          items: [
            { ref: "F.1", description: "Phase completion records", count: phases.length },
          ],
        },
      ],
      totals: {
        evidenceFiles: evidenceFiles.length,
        checklistItems: checklistItems.length,
        substantiveTests: tests.length,
        riskAssessments: risks.length,
        reviewNotes: reviewNotes.length,
        deliverables: deliverables.length,
      },
    };

    const archive = await prisma.archivePackage.upsert({
      where: { engagementId: eid },
      update: { archiveIndex },
      create: { engagementId: eid, status: "PENDING", archiveIndex },
    });

    await logAuditTrail(req.user!.id, "ARCHIVE_INDEX_GENERATED", "archive_package", archive.id, null, { indexSections: archiveIndex.sections.length }, eid, "Archive index generated for inspection retrieval", req.ip, req.get("user-agent"));

    res.json({ success: true, data: archiveIndex });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to generate archive index", details: error.message });
  }
});

router.get("/:engagementId/final-reports", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) return res.status(404).json({ error: access.error });
    const eid = req.params.engagementId;

    const [report, deliverables, signedReport] = await Promise.all([
      prisma.auditReport.findUnique({
        where: { engagementId: eid },
        include: {
          signedBy: { select: { id: true, fullName: true, role: true } },
          partnerApprovedBy: { select: { id: true, fullName: true, role: true } },
        },
      }),
      prisma.deliverable.findMany({
        where: { engagementId: eid },
        orderBy: { createdAt: "asc" },
      }),
      prisma.eQCRSignedReport.findFirst({ where: { assignment: { engagementId: eid } } }),
    ]);

    res.json({ success: true, data: { report, deliverables, signedReport } });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch final reports", details: error.message });
  }
});

router.get("/:engagementId/review-history", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) return res.status(404).json({ error: access.error });
    const eid = req.params.engagementId;

    const [reviewNotes, eqcrComments, sectionSignOffs] = await Promise.all([
      prisma.reviewNote.findMany({
        where: { engagementId: eid },
        include: {
          assignee: { select: { id: true, fullName: true, role: true } },
          createdByUser: { select: { id: true, fullName: true, role: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.eQCRComment.findMany({
        where: { assignment: { engagementId: eid } },
        include: {
          createdBy: { select: { id: true, fullName: true, role: true } },
          respondedBy: { select: { id: true, fullName: true, role: true } },
          clearedBy: { select: { id: true, fullName: true, role: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.sectionSignOff.findMany({
        where: { engagementId: eid },
        include: {
          preparedBy: { select: { id: true, fullName: true, role: true } },
          reviewedBy: { select: { id: true, fullName: true, role: true } },
          partnerApproval: { select: { id: true, fullName: true, role: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    res.json({
      success: true,
      data: {
        reviewNotes,
        eqcrComments,
        sectionSignOffs,
        summary: {
          totalReviewNotes: reviewNotes.length,
          openReviewNotes: reviewNotes.filter(r => r.status === "OPEN").length,
          resolvedReviewNotes: reviewNotes.filter(r => r.status === "RESOLVED" || r.status === "CLOSED").length,
          totalEqcrComments: eqcrComments.length,
          clearedEqcrComments: eqcrComments.filter(c => c.status === "CLEARED").length,
          totalSignOffs: sectionSignOffs.length,
        },
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch review history", details: error.message });
  }
});

router.get("/:engagementId/audit-trail", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) return res.status(404).json({ error: access.error });

    const trail = await prisma.auditTrail.findMany({
      where: { engagementId: req.params.engagementId },
      include: { user: { select: { id: true, fullName: true, role: true } } },
      orderBy: { createdAt: "desc" },
      take: req.query.limit ? parseInt(req.query.limit as string) : 500,
    });
    res.json({ success: true, data: trail });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch audit trail", details: error.message });
  }
});

router.get("/:engagementId/working-papers", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) return res.status(404).json({ error: access.error });
    const eid = req.params.engagementId;

    const [evidenceFiles, workpapers] = await Promise.all([
      prisma.evidenceFile.findMany({
        where: { engagementId: eid, status: "ACTIVE" },
        select: { id: true, fileName: true, fileType: true, category: true, fileSize: true, uploadedAt: true, uploadedById: true },
        orderBy: { uploadedAt: "desc" },
      }),
      prisma.workPaper.findMany({
        where: { engagementId: eid },
        select: { id: true, title: true, reference: true, status: true, fsHeadId: true, createdAt: true, updatedAt: true },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    res.json({
      success: true,
      data: {
        evidenceFiles,
        workpapers,
        summary: {
          totalEvidence: evidenceFiles.length,
          totalWorkpapers: workpapers.length,
        },
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch working papers", details: error.message });
  }
});

router.get("/:engagementId/exports", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) return res.status(404).json({ error: access.error });

    const exports = await prisma.exportLog.findMany({
      where: { engagementId: req.params.engagementId },
      include: { exportedBy: { select: { id: true, fullName: true, role: true } } },
      orderBy: { exportedDate: "desc" },
    });
    res.json({ success: true, data: exports });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch exports", details: error.message });
  }
});

router.post("/:engagementId/exports", requireAuth, requireMinRole("MANAGER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) return res.status(404).json({ error: access.error });
    const eid = req.params.engagementId;

    if (req.body.exportType === "FINAL_AUDIT_FILE") {
      const archive = await prisma.archivePackage.findUnique({ where: { engagementId: eid } });
      if (!archive || archive.status !== "SEALED" && archive.status !== "RELEASED") {
        return res.status(400).json({ error: "Final audit file export requires a sealed or released archive" });
      }
    }

    const exportLog = await prisma.exportLog.create({
      data: {
        engagementId: eid,
        exportType: req.body.exportType,
        exportFormat: req.body.exportFormat || "JSON",
        exportFilePath: req.body.exportFilePath,
        exportedById: req.user!.id,
        exportParameters: req.body.parameters,
      },
      include: { exportedBy: { select: { id: true, fullName: true, role: true } } },
    });

    await logAuditTrail(req.user!.id, "EXPORT_CREATED", "export_log", exportLog.id, null, exportLog, eid, `Export: ${req.body.exportType} as ${req.body.exportFormat || "JSON"}`, req.ip, req.get("user-agent"));

    res.status(201).json({ success: true, data: exportLog });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to create export", details: error.message });
  }
});

router.post("/:engagementId/generate-completeness-analysis", requireAuth, requireMinRole("MANAGER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) return res.status(404).json({ error: access.error });
    const eid = req.params.engagementId;

    if (await enforceArchiveImmutability(eid, res)) return;

    const [readiness, archive, phases] = await Promise.all([
      prisma.inspectionReadiness.findUnique({ where: { engagementId: eid } }),
      prisma.archivePackage.findUnique({ where: { engagementId: eid } }),
      prisma.phaseProgress.findMany({ where: { engagementId: eid } }),
    ]);

    const context = {
      readinessScore: readiness?.overallReadiness || 0,
      readinessIssues: readiness?.readinessIssues || [],
      archiveStatus: archive?.status || "PENDING",
      phases: phases.map(p => ({ phase: p.phase, status: p.status })),
    };

    const { executeAICapability } = await import("./services/aiPhaseOrchestrator");
    const result = await executeAICapability({
      engagementId: eid,
      phaseKey: "inspection",
      capabilityId: "archive-completeness-analysis",
      firmId: req.user!.firmId,
      userId: req.user!.id,
      additionalContext: context,
    });

    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to generate analysis", details: error.message });
  }
});

router.post("/:engagementId/generate-gap-summary", requireAuth, requireMinRole("MANAGER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) return res.status(404).json({ error: access.error });
    const eid = req.params.engagementId;

    if (await enforceArchiveImmutability(eid, res)) return;

    const readiness = await prisma.inspectionReadiness.findUnique({ where: { engagementId: eid } });

    const context = {
      readinessIssues: readiness?.readinessIssues || [],
      openItems: readiness?.openItemsCount || 0,
      checklistCompletion: readiness?.checklistCompletion || {},
      riskCoverage: readiness?.riskToProcedureMapping || {},
    };

    const { executeAICapability } = await import("./services/aiPhaseOrchestrator");
    const result = await executeAICapability({
      engagementId: eid,
      phaseKey: "inspection",
      capabilityId: "inspection-gap-summary",
      firmId: req.user!.firmId,
      userId: req.user!.id,
      additionalContext: context,
    });

    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to generate gap summary", details: error.message });
  }
});

export default router;
