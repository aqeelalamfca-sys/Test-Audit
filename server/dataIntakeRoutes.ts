import { Router, Response } from "express";
import { requireAuth, type AuthenticatedRequest } from "./auth";
import { getDataIntakeStatus, triggerPostImportReconciliation } from "./services/dataIntakeStatusService";

const router = Router();

router.get("/engagements/:engagementId/data-intake/status", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const status = await getDataIntakeStatus(engagementId);
    res.json(status);
  } catch (error) {
    console.error("Error fetching data intake status:", error);
    res.status(500).json({ error: "Failed to fetch data intake status" });
  }
});

router.post("/engagements/:engagementId/data-intake/reconcile", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const userId = req.user!.id;
    const result = await triggerPostImportReconciliation(engagementId, userId);
    res.json(result);
  } catch (error) {
    console.error("Error triggering reconciliation:", error);
    res.status(500).json({ error: "Failed to trigger reconciliation" });
  }
});

export default router;
