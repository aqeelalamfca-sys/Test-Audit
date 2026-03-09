import { Router, type Response } from "express";
import { requireAuth, requireMinRole, type AuthenticatedRequest } from "./auth";
import { enforcementEngine } from "./services/enforcementEngine";
import { attachEnforcementContext } from "./middleware/enforcementMiddleware";

const router = Router();

router.get("/status/:engagementId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const status = await enforcementEngine.getEngagementStatus(engagementId);
    res.json(status);
  } catch (error: any) {
    console.error("Get enforcement status error:", error);
    res.status(500).json({ error: error.message || "Failed to get enforcement status" });
  }
});

router.get("/why-blocked/:engagementId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const phase = req.query.phase as string | undefined;
    const blockedReasons = await enforcementEngine.getWhyBlocked(engagementId, phase as any);
    res.json({ blockedReasons });
  } catch (error: any) {
    console.error("Get why blocked error:", error);
    res.status(500).json({ error: error.message || "Failed to get blocked reasons" });
  }
});

router.post("/initialize/:engagementId", requireAuth, requireMinRole("MANAGER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    await enforcementEngine.initializeEngagementGates(engagementId, req.user!.id, req.user!.role);
    res.json({ success: true, message: "Enforcement gates initialized" });
  } catch (error: any) {
    console.error("Initialize enforcement error:", error);
    res.status(500).json({ error: error.message || "Failed to initialize enforcement gates" });
  }
});

router.post("/pass-gate/:engagementId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const { gateType, comments } = req.body;

    if (!gateType) {
      return res.status(400).json({ error: "Gate type required" });
    }

    const result = await enforcementEngine.passGate(
      engagementId,
      gateType,
      req.user!.id,
      req.user!.role,
      comments
    );

    if (result.success) {
      res.json({ success: true, message: `Gate ${gateType} passed` });
    } else {
      res.status(403).json({ error: result.error });
    }
  } catch (error: any) {
    console.error("Pass gate error:", error);
    res.status(500).json({ error: error.message || "Failed to pass gate" });
  }
});

router.post("/maker-checker/create", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId, entityType, entityId, comments } = req.body;

    if (!engagementId || !entityType || !entityId) {
      return res.status(400).json({ error: "engagementId, entityType, and entityId required" });
    }

    const result = await enforcementEngine.createMakerCheckerWorkflow(
      engagementId,
      entityType,
      entityId,
      req.user!.id,
      comments
    );

    if (result.success) {
      res.json({ success: true, workflowId: result.workflowId });
    } else {
      res.status(400).json({ error: result.error });
    }
  } catch (error: any) {
    console.error("Create maker-checker workflow error:", error);
    res.status(500).json({ error: error.message || "Failed to create workflow" });
  }
});

router.post("/maker-checker/advance", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId, entityType, entityId, action, comments, status } = req.body;

    if (!engagementId || !entityType || !entityId || !action) {
      return res.status(400).json({ error: "engagementId, entityType, entityId, and action required" });
    }

    if (!["REVIEW", "APPROVE"].includes(action)) {
      return res.status(400).json({ error: "Action must be REVIEW or APPROVE" });
    }

    const result = await enforcementEngine.advanceWorkflow(
      engagementId,
      entityType,
      entityId,
      action,
      req.user!.id,
      req.user!.role,
      comments,
      status
    );

    if (result.success) {
      res.json({ success: true, message: `Workflow ${action.toLowerCase()}ed successfully` });
    } else {
      res.status(403).json({ error: result.error });
    }
  } catch (error: any) {
    console.error("Advance workflow error:", error);
    res.status(500).json({ error: error.message || "Failed to advance workflow" });
  }
});

router.post("/log-ai-interaction", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      engagementId,
      promptText,
      outputText,
      action,
      editedOutput,
      contextType,
      contextId,
      module,
      screen,
      processingTimeMs,
      tokenCount,
      modelUsed
    } = req.body;

    if (!promptText || !outputText || !action) {
      return res.status(400).json({ error: "promptText, outputText, and action required" });
    }

    const result = await enforcementEngine.logAIInteraction({
      userId: req.user!.id,
      userRole: req.user!.role,
      engagementId,
      promptText,
      outputText,
      action,
      editedOutput,
      contextType,
      contextId,
      module,
      screen,
      processingTimeMs,
      tokenCount,
      modelUsed,
      ipAddress: req.ip,
      userAgent: req.get("user-agent")
    });

    res.json({ success: true, id: result.id, outputId: result.outputId });
  } catch (error: any) {
    console.error("Log AI interaction error:", error);
    res.status(500).json({ error: error.message || "Failed to log AI interaction" });
  }
});

router.get("/ai-config", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  res.json({
    isNonAuthoritative: enforcementEngine.isAIOutputNonAuthoritative(),
    label: enforcementEngine.getAIOutputLabel(),
    requiresHumanApproval: true,
    editableByUser: true
  });
});

router.post("/submit-phase/:engagementId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const { phase, comments } = req.body;

    if (!phase) {
      return res.status(400).json({ error: "Phase is required" });
    }

    const result = await enforcementEngine.submitPhaseForReview(
      engagementId,
      phase,
      req.user!.id,
      req.user!.role,
      comments
    );

    if (result.success) {
      res.json({ success: true, message: `Phase ${phase} submitted for review` });
    } else {
      res.status(400).json({ error: result.error });
    }
  } catch (error: any) {
    console.error("Submit phase error:", error);
    res.status(500).json({ error: error.message || "Failed to submit phase" });
  }
});

router.post("/approve-phase/:engagementId", requireAuth, requireMinRole("MANAGER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const { phase, approved, comments } = req.body;

    if (!phase || typeof approved !== "boolean") {
      return res.status(400).json({ error: "Phase and approved status required" });
    }

    const result = await enforcementEngine.approvePhase(
      engagementId,
      phase,
      approved,
      req.user!.id,
      req.user!.role,
      comments
    );

    if (result.success) {
      res.json({ 
        success: true, 
        message: approved ? `Phase ${phase} approved and locked` : `Phase ${phase} approval rejected`
      });
    } else {
      res.status(400).json({ error: result.error });
    }
  } catch (error: any) {
    console.error("Approve phase error:", error);
    res.status(500).json({ error: error.message || "Failed to approve phase" });
  }
});

router.post("/lock-phase/:engagementId", requireAuth, requireMinRole("MANAGER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const { phase, lock, comments } = req.body;

    if (!phase || typeof lock !== "boolean") {
      return res.status(400).json({ error: "Phase and lock status required" });
    }

    const result = await enforcementEngine.lockPhase(
      engagementId,
      phase,
      lock,
      req.user!.id,
      req.user!.role,
      comments
    );

    if (result.success) {
      res.json({ 
        success: true, 
        message: lock ? `Phase ${phase} locked` : `Phase ${phase} unlocked`
      });
    } else {
      res.status(400).json({ error: result.error });
    }
  } catch (error: any) {
    console.error("Lock phase error:", error);
    res.status(500).json({ error: error.message || "Failed to update phase lock status" });
  }
});

router.post("/log-audit", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      engagementId,
      action,
      entityType,
      entityId,
      field,
      beforeValue,
      afterValue,
      reason,
      isaReference,
      module,
      screen
    } = req.body;

    if (!action || !entityType) {
      return res.status(400).json({ error: "action and entityType required" });
    }

    const id = await enforcementEngine.logAuditTrail({
      userId: req.user!.id,
      userRole: req.user!.role,
      engagementId,
      action,
      entityType,
      entityId,
      field,
      beforeValue,
      afterValue,
      reason,
      isaReference,
      module,
      screen,
      ipAddress: req.ip,
      userAgent: req.get("user-agent")
    });

    res.json({ success: true, id });
  } catch (error: any) {
    console.error("Log audit error:", error);
    res.status(500).json({ error: error.message || "Failed to log audit entry" });
  }
});

export default router;
