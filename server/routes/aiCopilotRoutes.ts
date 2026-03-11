import { Router, Response } from "express";
import { requireAuth, type AuthenticatedRequest } from "../auth";
import { z } from "zod";
import {
  getCopilotAnalysis,
  analyzeFsHeadContext,
  analyzeRiskCoverage,
  analyzeEngagementLinkages,
  calculateQualityScore,
  calculateISAComplianceScore,
  generateAICopilotSuggestion,
  logCopilotInteraction,
  type CopilotContext,
  type CopilotObservation,
} from "../services/aiCopilotService";
import { prisma } from "../db";
import { withTenantContext } from "../middleware/tenantDbContext";

const router = Router();

const contextSchema = z.object({
  engagementId: z.string().uuid(),
  currentFsHead: z.string().optional(),
  auditPhase: z.string(),
  riskLevel: z.string().optional(),
  materialityThreshold: z.number().optional(),
  performanceMateriality: z.number().optional(),
});

router.post("/analysis", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = contextSchema.parse(req.body);
    const userId = req.user!.id;
    const userRole = req.user!.role;
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(400).json({ error: "User not associated with a firm" });

    const engagement = await withTenantContext(firmId, async (tx) => {
      return (tx as any).engagement.findFirst({
        where: { id: data.engagementId, firmId },
      });
    });

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    const context: CopilotContext = {
      engagementId: data.engagementId,
      userId,
      userRole,
      currentFsHead: data.currentFsHead,
      auditPhase: data.auditPhase,
      riskLevel: data.riskLevel,
      materialityThreshold: data.materialityThreshold,
      performanceMateriality: data.performanceMateriality,
    };

    const analysis = await getCopilotAnalysis(context, data.currentFsHead);

    await logCopilotInteraction(data.engagementId, userId, "VIEW_ANALYSIS", undefined, {
      fsHead: data.currentFsHead,
      phase: data.auditPhase,
      observationCount: analysis.observations.length,
    });

    res.json(analysis);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request", details: error.errors });
    }
    console.error("Copilot analysis error:", error);
    res.status(500).json({ error: "Failed to analyze engagement" });
  }
});

router.get("/fs-head/:engagementId/:fsHeadKey", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId, fsHeadKey } = req.params;
    const userId = req.user!.id;
    const userRole = req.user!.role;
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(400).json({ error: "User not associated with a firm" });

    const engagement = await withTenantContext(firmId, async (tx) => {
      return (tx as any).engagement.findFirst({
        where: { id: engagementId, firmId },
      });
    });

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    const context: CopilotContext = {
      engagementId,
      userId,
      userRole,
      currentFsHead: fsHeadKey,
      auditPhase: "execution",
    };

    const observations = await analyzeFsHeadContext(context, fsHeadKey);

    await logCopilotInteraction(engagementId, userId, "VIEW_FS_HEAD", undefined, {
      fsHead: fsHeadKey,
      observationCount: observations.length,
    });

    res.json({
      fsHeadKey,
      observations,
      disclaimer: "AI-assisted — subject to professional judgment",
    });
  } catch (error) {
    console.error("FS Head analysis error:", error);
    res.status(500).json({ error: "Failed to analyze FS Head" });
  }
});

router.get("/linkages/:engagementId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const userId = req.user!.id;
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(400).json({ error: "User not associated with a firm" });

    const engagement = await withTenantContext(firmId, async (tx) => {
      return (tx as any).engagement.findFirst({
        where: { id: engagementId, firmId },
      });
    });

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    const linkageStatus = await analyzeEngagementLinkages(engagementId);

    await logCopilotInteraction(engagementId, userId, "VIEW_LINKAGES", undefined, {
      totalGaps: linkageStatus.totalGaps,
    });

    res.json({
      ...linkageStatus,
      disclaimer: "AI-assisted — subject to professional judgment",
    });
  } catch (error) {
    console.error("Linkage analysis error:", error);
    res.status(500).json({ error: "Failed to analyze linkages" });
  }
});

router.get("/risk-coverage/:engagementId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const userId = req.user!.id;
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(400).json({ error: "User not associated with a firm" });

    const engagement = await withTenantContext(firmId, async (tx) => {
      return (tx as any).engagement.findFirst({
        where: { id: engagementId, firmId },
      });
    });

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    const observations = await analyzeRiskCoverage(engagementId);

    await logCopilotInteraction(engagementId, userId, "VIEW_RISK_COVERAGE", undefined, {
      observationCount: observations.length,
    });

    res.json({
      observations,
      disclaimer: "AI-assisted — subject to professional judgment",
    });
  } catch (error) {
    console.error("Risk coverage analysis error:", error);
    res.status(500).json({ error: "Failed to analyze risk coverage" });
  }
});

router.get("/quality-score/:engagementId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const userId = req.user!.id;
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(400).json({ error: "User not associated with a firm" });

    const engagement = await withTenantContext(firmId, async (tx) => {
      return (tx as any).engagement.findFirst({
        where: { id: engagementId, firmId },
      });
    });

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    const { score, factors } = await calculateQualityScore(engagementId);

    await logCopilotInteraction(engagementId, userId, "VIEW_QUALITY_SCORE", undefined, {
      score,
    });

    res.json({
      score,
      factors,
      disclaimer: "AI-assisted — subject to professional judgment",
    });
  } catch (error) {
    console.error("Quality score error:", error);
    res.status(500).json({ error: "Failed to calculate quality score" });
  }
});

router.get("/isa-compliance/:engagementId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const userId = req.user!.id;
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(400).json({ error: "User not associated with a firm" });

    const engagement = await withTenantContext(firmId, async (tx) => {
      return (tx as any).engagement.findFirst({
        where: { id: engagementId, firmId },
      });
    });

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    const { score, isaScores } = await calculateISAComplianceScore(engagementId);

    await logCopilotInteraction(engagementId, userId, "VIEW_ISA_COMPLIANCE", undefined, {
      score,
    });

    res.json({
      score,
      isaScores,
      disclaimer: "AI-assisted — subject to professional judgment",
    });
  } catch (error) {
    console.error("ISA compliance score error:", error);
    res.status(500).json({ error: "Failed to calculate ISA compliance score" });
  }
});

router.get("/dismissed/:engagementId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(400).json({ error: "User not associated with a firm" });

    const { engagement, dismissedLogs } = await withTenantContext(firmId, async (tx) => {
      const eng = await (tx as any).engagement.findFirst({
        where: { id: engagementId, firmId },
      });
      if (!eng) return { engagement: null, dismissedLogs: [] };
      const logs = await (tx as any).aIAuditLog.findMany({
        where: { engagementId, action: "COPILOT_DISMISS_OBSERVATION" },
        orderBy: { createdAt: "desc" },
      });
      return { engagement: eng, dismissedLogs: logs };
    });

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    const dismissedIds = dismissedLogs.map((log: any) => log.fieldKey).filter((id: string) => id !== "system");

    res.json({ dismissedIds });
  } catch (error) {
    console.error("Dismissed observations fetch error:", error);
    res.status(500).json({ error: "Failed to fetch dismissed observations" });
  }
});

const suggestionSchema = z.object({
  engagementId: z.string().uuid(),
  observationType: z.string(),
  additionalContext: z.string(),
  currentFsHead: z.string().optional(),
  auditPhase: z.string(),
});

router.post("/suggest", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = suggestionSchema.parse(req.body);
    const userId = req.user!.id;
    const userRole = req.user!.role;
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(400).json({ error: "User not associated with a firm" });

    const engagement = await withTenantContext(firmId, async (tx) => {
      return (tx as any).engagement.findFirst({
        where: { id: data.engagementId, firmId },
      });
    });

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    const context: CopilotContext = {
      engagementId: data.engagementId,
      userId,
      userRole,
      currentFsHead: data.currentFsHead,
      auditPhase: data.auditPhase,
    };

    const suggestion = await generateAICopilotSuggestion(
      context,
      data.observationType,
      data.additionalContext
    );

    await logCopilotInteraction(data.engagementId, userId, "REQUEST_SUGGESTION", undefined, {
      observationType: data.observationType,
      fsHead: data.currentFsHead,
    });

    res.json({
      suggestion,
      disclaimer: "AI-assisted — subject to professional judgment",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request", details: error.errors });
    }
    console.error("Suggestion generation error:", error);
    res.status(500).json({ error: "Failed to generate suggestion" });
  }
});

const dismissSchema = z.object({
  engagementId: z.string().uuid(),
  observationId: z.string(),
  reason: z.string().optional(),
});

router.post("/dismiss", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = dismissSchema.parse(req.body);
    const userId = req.user!.id;

    await logCopilotInteraction(data.engagementId, userId, "DISMISS_OBSERVATION", data.observationId, {
      reason: data.reason,
    });

    res.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request", details: error.errors });
    }
    console.error("Dismiss observation error:", error);
    res.status(500).json({ error: "Failed to dismiss observation" });
  }
});

router.get("/history/:engagementId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const { limit = "50" } = req.query;
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(400).json({ error: "User not associated with a firm" });

    const { engagement, logs } = await withTenantContext(firmId, async (tx) => {
      const eng = await (tx as any).engagement.findFirst({
        where: { id: engagementId, firmId },
      });
      if (!eng) return { engagement: null, logs: [] };
      const l = await (tx as any).aIAuditLog.findMany({
        where: { engagementId, action: { startsWith: "COPILOT_" } },
        orderBy: { createdAt: "desc" },
        take: parseInt(limit as string, 10),
        include: {
          user: { select: { id: true, firstName: true, lastName: true, role: true } },
        },
      });
      return { engagement: eng, logs: l };
    });

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    res.json({ logs });
  } catch (error) {
    console.error("History fetch error:", error);
    res.status(500).json({ error: "Failed to fetch copilot history" });
  }
});

export default router;
