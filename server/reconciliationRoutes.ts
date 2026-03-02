import { Router, Response } from "express";
import { requireAuth, type AuthenticatedRequest } from "./auth";
import { getReconciliationStatus, validatePhaseTransition } from "./services/reconciliationService";
import { computeFieldsForEngagement } from "./services/fieldRegistryEngine";

const router = Router();

router.get("/engagements/:engagementId/reconciliation-status", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    
    const status = await getReconciliationStatus(engagementId);
    
    res.json(status);
  } catch (error) {
    console.error("Error fetching reconciliation status:", error);
    res.status(500).json({ error: "Failed to fetch reconciliation status" });
  }
});

router.get("/engagements/:engagementId/stale-fields", requireAuth, async (_req: AuthenticatedRequest, res: Response) => {
  res.json([]);
});

router.post("/engagements/:engagementId/refresh-computed-fields", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const userId = req.user?.id;
    
    const results = await computeFieldsForEngagement(engagementId, userId);
    
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    
    res.json({
      success: true,
      message: `Refreshed ${successCount} fields${failCount > 0 ? `, ${failCount} failed` : ""}`,
      results
    });
  } catch (error) {
    console.error("Error refreshing computed fields:", error);
    res.status(500).json({ error: "Failed to refresh computed fields" });
  }
});

router.post("/engagements/:engagementId/validate-phase-transition", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const { targetPhase } = req.body;
    
    if (!targetPhase) {
      return res.status(400).json({ error: "Target phase is required" });
    }
    
    const validation = await validatePhaseTransition(engagementId, targetPhase);
    
    res.json(validation);
  } catch (error) {
    console.error("Error validating phase transition:", error);
    res.status(500).json({ error: "Failed to validate phase transition" });
  }
});

router.get("/engagements/:engagementId/data-quality", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    
    const reconciliationStatus = await getReconciliationStatus(engagementId);
    
    res.json({
      summary: {
        tbBalanced: reconciliationStatus.tbBalanced,
        glBalanced: reconciliationStatus.glBalanced,
        tbGlReconciled: reconciliationStatus.tbGlReconciled,
      },
      tbStatus: reconciliationStatus.tbStatus,
      glStatus: reconciliationStatus.glStatus,
      glCodeRecon: reconciliationStatus.glCodeRecon,
      phaseRequirements: reconciliationStatus.phaseRequirements,
      overallHealth: calculateOverallHealth(reconciliationStatus)
    });
  } catch (error) {
    console.error("Error fetching data quality:", error);
    res.status(500).json({ error: "Failed to fetch data quality" });
  }
});

function calculateOverallHealth(status: any): {
  score: number;
  rating: "EXCELLENT" | "GOOD" | "FAIR" | "POOR";
  issues: string[];
} {
  let score = 100;
  const issues: string[] = [];
  
  if (!status.tbStatus.hasData) {
    score -= 30;
    issues.push("Trial Balance not uploaded");
  } else if (!status.tbBalanced) {
    score -= 20;
    issues.push("Trial Balance is not balanced");
  }
  
  if (!status.glStatus.hasData) {
    score -= 20;
    issues.push("General Ledger not uploaded");
  } else if (!status.glBalanced) {
    score -= 15;
    issues.push("General Ledger is not balanced");
  }
  
  if (!status.tbGlReconciled && status.tbStatus.hasData && status.glStatus.hasData) {
    score -= 15;
    issues.push("TB and GL are not reconciled");
  }
  
  score = Math.max(0, score);
  
  let rating: "EXCELLENT" | "GOOD" | "FAIR" | "POOR";
  if (score >= 90) rating = "EXCELLENT";
  else if (score >= 70) rating = "GOOD";
  else if (score >= 50) rating = "FAIR";
  else rating = "POOR";
  
  return { score, rating, issues };
}

export default router;
