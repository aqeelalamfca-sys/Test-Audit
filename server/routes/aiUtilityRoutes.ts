import { Router, type Response } from "express";
import { requireAuth, requireMinRole, type AuthenticatedRequest } from "../auth";
import { prisma } from "../db";
import {
  analyzeEvidenceSufficiency,
  detectRiskResponseGaps,
  checkDocumentationCompleteness,
  generateDraftMemo,
  logAIOutput,
} from "../services/aiAuditUtilities";

const router = Router();

async function validateEngagementAccess(req: AuthenticatedRequest, res: Response, engagementId: string): Promise<boolean> {
  const engagement = await prisma.engagement.findFirst({
    where: { id: engagementId, firmId: req.user!.firmId! },
    select: { id: true }
  });
  if (!engagement) {
    res.status(404).json({ error: "Engagement not found or access denied" });
    return false;
  }
  return true;
}

router.post("/evidence-sufficiency/:engagementId", requireAuth, requireMinRole("SENIOR"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    if (!await validateEngagementAccess(req, res, engagementId)) return;
    const result = await analyzeEvidenceSufficiency(engagementId);

    await logAIOutput(
      req.user!.firmId!,
      engagementId,
      req.user!.id,
      "evidence_sufficiency",
      "ANALYZE",
      result.modelVersion,
      result.modelVersion,
      result.analysis,
      result.processingTimeMs
    );

    res.json(result);
  } catch (error: any) {
    console.error("Evidence sufficiency analysis error:", error);
    res.status(500).json({ error: error.message || "Failed to analyze evidence sufficiency" });
  }
});

router.post("/risk-response-gaps/:engagementId", requireAuth, requireMinRole("SENIOR"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    if (!await validateEngagementAccess(req, res, engagementId)) return;
    const result = await detectRiskResponseGaps(engagementId);

    await logAIOutput(
      req.user!.firmId!,
      engagementId,
      req.user!.id,
      "risk_response_gaps",
      "ANALYZE",
      result.modelVersion,
      result.modelVersion,
      result.analysis,
      result.processingTimeMs
    );

    res.json(result);
  } catch (error: any) {
    console.error("Risk-response gap detection error:", error);
    res.status(500).json({ error: error.message || "Failed to detect risk-response gaps" });
  }
});

router.post("/documentation-completeness/:engagementId", requireAuth, requireMinRole("SENIOR"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    if (!await validateEngagementAccess(req, res, engagementId)) return;
    const result = await checkDocumentationCompleteness(engagementId);

    await logAIOutput(
      req.user!.firmId!,
      engagementId,
      req.user!.id,
      "documentation_completeness",
      "ANALYZE",
      result.modelVersion,
      result.modelVersion,
      result.analysis,
      result.processingTimeMs
    );

    res.json(result);
  } catch (error: any) {
    console.error("Documentation completeness check error:", error);
    res.status(500).json({ error: error.message || "Failed to check documentation completeness" });
  }
});

router.post("/draft-memo/:engagementId", requireAuth, requireMinRole("SENIOR"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    if (!await validateEngagementAccess(req, res, engagementId)) return;
    const { memoType } = req.body;

    const validTypes = ["planning", "completion", "going_concern", "subsequent_events", "summary"];
    if (!memoType || !validTypes.includes(memoType)) {
      return res.status(400).json({
        error: `Invalid memo type. Must be one of: ${validTypes.join(", ")}`,
      });
    }

    const result = await generateDraftMemo(engagementId, memoType);

    await logAIOutput(
      req.user!.firmId!,
      engagementId,
      req.user!.id,
      `memo_${memoType}`,
      "GENERATE",
      result.modelVersion,
      result.modelVersion,
      result.analysis,
      result.processingTimeMs
    );

    res.json(result);
  } catch (error: any) {
    console.error("Draft memo generation error:", error);
    res.status(500).json({ error: error.message || "Failed to generate draft memo" });
  }
});

export default router;
