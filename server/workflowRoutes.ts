import { Router, Response, NextFunction } from "express";
import { requireAuth, AuthenticatedRequest } from "./auth";
import { computeWorkflowDashboard, resolveWorkflowException, bulkResolveExceptions, getPhaseConfig, runPhaseExceptionScan } from "./services/workflowOrchestrator";
import { computeDataHealth } from "./services/dataHealthService";
import { computePhaseEngine } from "./services/phaseEngine";
import { createProposal, listProposals, getProposal, reviewProposal, approveProposal, applyProposal, rejectProposal, getProposalCounts } from "./services/aiWorkflowService";
import { prisma } from "./db";
import { z } from "zod";

const router = Router();

async function requireEngagementAccess(req: any, res: Response, next: NextFunction) {
  try {
    const { engagementId } = req.params;
    if (!engagementId) return next();
    const engagement = await prisma.engagement.findUnique({
      where: { id: engagementId },
      select: { firmId: true },
    });
    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }
    if (engagement.firmId !== req.user!.firmId) {
      return res.status(403).json({ error: "Access denied" });
    }
    next();
  } catch (err) {
    return res.status(500).json({ error: "Authorization check failed" });
  }
}

router.get("/:engagementId/dashboard", requireAuth, requireEngagementAccess, async (req: any, res: Response) => {
  try {
    const { engagementId } = req.params;
    const dashboard = await computeWorkflowDashboard(engagementId);
    res.json(dashboard);
  } catch (err: any) {
    if (err.message === "Engagement not found") {
      return res.status(404).json({ error: "Engagement not found" });
    }
    console.error("Workflow dashboard error:", err);
    res.status(500).json({ error: "Failed to compute workflow dashboard" });
  }
});

router.get("/:engagementId/phases/:phase", requireAuth, requireEngagementAccess, async (req: any, res: Response) => {
  try {
    const { engagementId, phase } = req.params;
    const status = await (prisma as any).workflowPhaseStatus.findUnique({
      where: { engagementId_phase: { engagementId, phase } },
    });
    if (!status) return res.status(404).json({ error: "Phase status not found" });
    res.json(status);
  } catch (err: any) {
    console.error("Phase status error:", err);
    res.status(500).json({ error: "Failed to fetch phase status" });
  }
});

router.get("/:engagementId/exceptions", requireAuth, requireEngagementAccess, async (req: any, res: Response) => {
  try {
    const { engagementId } = req.params;
    const { phase, status, taxonomy } = req.query;
    const where: any = { engagementId };
    if (phase) where.phase = phase;
    if (status) where.status = status;
    if (taxonomy) where.taxonomy = taxonomy;

    const exceptions = await (prisma as any).workflowException.findMany({
      where,
      orderBy: [{ taxonomy: "asc" }, { createdAt: "desc" }],
    });
    res.json(exceptions);
  } catch (err: any) {
    console.error("Exceptions error:", err);
    res.status(500).json({ error: "Failed to fetch exceptions" });
  }
});

const raiseExceptionSchema = z.object({
  phase: z.string(),
  taxonomy: z.enum(["S1_BLOCKER", "S2_HIGH", "S3_MEDIUM", "S4_LOW"]),
  ruleId: z.string().optional(),
  description: z.string().min(1),
  sheet: z.string().optional(),
  rowId: z.string().optional(),
  accountCode: z.string().optional(),
  amountImpact: z.number().optional(),
  suggestedFix: z.string().optional(),
});

router.post("/:engagementId/exceptions", requireAuth, requireEngagementAccess, async (req: any, res: Response) => {
  try {
    const { engagementId } = req.params;
    const body = raiseExceptionSchema.parse(req.body);
    const exception = await (prisma as any).workflowException.create({
      data: {
        engagement: { connect: { id: engagementId } },
        phase: body.phase,
        taxonomy: body.taxonomy,
        ruleId: body.ruleId || `MANUAL_${Date.now()}`,
        description: body.description,
        sheet: body.sheet || "",
        rowId: body.rowId || "",
        accountCode: body.accountCode || "",
        amountImpact: body.amountImpact || 0,
        suggestedFix: body.suggestedFix || "",
      },
    });
    res.status(201).json(exception);
  } catch (err: any) {
    if (err.name === "ZodError") return res.status(400).json({ error: "Invalid request", details: err.errors });
    console.error("Raise exception error:", err);
    res.status(500).json({ error: "Failed to raise exception" });
  }
});

router.patch("/:engagementId/exceptions/:exceptionId/resolve", requireAuth, requireEngagementAccess, async (req: any, res: Response) => {
  try {
    const { exceptionId } = req.params;
    const { resolution } = req.body;
    const resolved = await resolveWorkflowException(exceptionId, req.user!.id, resolution || "");
    res.json(resolved);
  } catch (err: any) {
    console.error("Resolve exception error:", err);
    res.status(500).json({ error: "Failed to resolve exception" });
  }
});

router.post("/:engagementId/exceptions/bulk-resolve", requireAuth, requireEngagementAccess, async (req: any, res: Response) => {
  try {
    const { engagementId } = req.params;
    const { phase, taxonomy, resolution } = req.body;
    if (!phase || !taxonomy) {
      return res.status(400).json({ error: "phase and taxonomy required" });
    }
    const count = await bulkResolveExceptions(
      engagementId,
      phase,
      taxonomy,
      req.user!.id,
      resolution || ""
    );
    res.json({ resolved: count });
  } catch (err: any) {
    console.error("Bulk resolve error:", err);
    res.status(500).json({ error: "Failed to bulk resolve exceptions" });
  }
});

const validPhases = ["UPLOAD_PROFILE", "DATA_QUALITY", "TB_GL_RECON", "FS_MAPPING", "PLANNING_ANALYTICS", "SAMPLING", "EXECUTION_WP", "COMPLETION"] as const;

router.post("/:engagementId/scan/:phase", requireAuth, requireEngagementAccess, async (req: any, res: Response) => {
  try {
    const { engagementId, phase } = req.params;
    if (!validPhases.includes(phase)) {
      return res.status(400).json({ error: "Invalid phase" });
    }
    const created = await runPhaseExceptionScan(engagementId, phase);
    res.json({ phase, exceptionsCreated: created });
  } catch (err: any) {
    console.error("Scan error:", err);
    res.status(500).json({ error: "Failed to run phase scan" });
  }
});

router.get("/config/phases", requireAuth, async (req: any, res: Response) => {
  res.json(getPhaseConfig());
});

router.get("/:engagementId/data-health", requireAuth, requireEngagementAccess, async (req: any, res: Response) => {
  try {
    const { engagementId } = req.params;
    const health = await computeDataHealth(engagementId);
    res.json(health);
  } catch (err: any) {
    console.error("Data health error:", err);
    res.status(500).json({ error: "Failed to compute data health" });
  }
});

router.get("/:engagementId/phase-engine", requireAuth, requireEngagementAccess, async (req: any, res: Response) => {
  try {
    const { engagementId } = req.params;
    const state = await computePhaseEngine(engagementId);
    res.json(state);
  } catch (err: any) {
    console.error("Phase engine error:", err);
    res.status(500).json({ error: "Failed to compute phase engine state" });
  }
});

router.get("/:engagementId/ai-proposals", requireAuth, requireEngagementAccess, async (req: any, res: Response) => {
  try {
    const { engagementId } = req.params;
    const { tabKey, status } = req.query;
    const proposals = await listProposals(engagementId, { tabKey, status });
    res.json(proposals);
  } catch (err: any) {
    console.error("List proposals error:", err);
    res.status(500).json({ error: "Failed to list AI proposals" });
  }
});

router.get("/:engagementId/ai-proposals/counts", requireAuth, requireEngagementAccess, async (req: any, res: Response) => {
  try {
    const { engagementId } = req.params;
    const counts = await getProposalCounts(engagementId);
    res.json(counts);
  } catch (err: any) {
    console.error("Proposal counts error:", err);
    res.status(500).json({ error: "Failed to get proposal counts" });
  }
});

router.get("/:engagementId/ai-proposals/:proposalId", requireAuth, requireEngagementAccess, async (req: any, res: Response) => {
  try {
    const { proposalId } = req.params;
    const proposal = await getProposal(proposalId);
    if (!proposal) return res.status(404).json({ error: "Proposal not found" });
    res.json(proposal);
  } catch (err: any) {
    console.error("Get proposal error:", err);
    res.status(500).json({ error: "Failed to get AI proposal" });
  }
});

router.post("/:engagementId/ai-proposals", requireAuth, requireEngagementAccess, async (req: any, res: Response) => {
  try {
    const { engagementId } = req.params;
    const body = z.object({
      tabKey: z.string(),
      proposalType: z.string(),
      title: z.string(),
      description: z.string(),
      changes: z.array(z.object({
        field: z.string(),
        entityId: z.string(),
        entityType: z.string(),
        currentValue: z.string().nullable(),
        proposedValue: z.string(),
        reason: z.string(),
      })),
      confidence: z.number().min(0).max(1),
      reasoning: z.string(),
    }).parse(req.body);

    const proposal = await createProposal({ ...body, engagementId });
    res.status(201).json(proposal);
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: "Invalid proposal data", details: err.errors });
    console.error("Create proposal error:", err);
    res.status(500).json({ error: "Failed to create AI proposal" });
  }
});

router.post("/:engagementId/ai-proposals/:proposalId/review", requireAuth, requireEngagementAccess, async (req: any, res: Response) => {
  try {
    const { proposalId } = req.params;
    const result = await reviewProposal(proposalId, req.user!.id);
    res.json(result);
  } catch (err: any) {
    console.error("Review proposal error:", err);
    res.status(400).json({ error: err.message || "Failed to review proposal" });
  }
});

router.post("/:engagementId/ai-proposals/:proposalId/approve", requireAuth, requireEngagementAccess, async (req: any, res: Response) => {
  try {
    const { proposalId } = req.params;
    const result = await approveProposal(proposalId, req.user!.id);
    res.json(result);
  } catch (err: any) {
    console.error("Approve proposal error:", err);
    res.status(400).json({ error: err.message || "Failed to approve proposal" });
  }
});

router.post("/:engagementId/ai-proposals/:proposalId/apply", requireAuth, requireEngagementAccess, async (req: any, res: Response) => {
  try {
    const { proposalId } = req.params;
    const result = await applyProposal(proposalId);
    res.json(result);
  } catch (err: any) {
    console.error("Apply proposal error:", err);
    res.status(400).json({ error: err.message || "Failed to apply proposal" });
  }
});

router.post("/:engagementId/ai-proposals/:proposalId/reject", requireAuth, requireEngagementAccess, async (req: any, res: Response) => {
  try {
    const { proposalId } = req.params;
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ error: "Rejection reason is required" });
    const result = await rejectProposal(proposalId, req.user!.id, reason);
    res.json(result);
  } catch (err: any) {
    console.error("Reject proposal error:", err);
    res.status(400).json({ error: err.message || "Failed to reject proposal" });
  }
});

export default router;
