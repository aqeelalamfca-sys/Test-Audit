import { Router, Response } from "express";
import { requireAuth, AuthenticatedRequest } from "../auth";
import {
  getEngagementPhaseState,
  getPhaseState,
  updatePhaseStatus,
  updatePhaseCompletion,
  getPhaseRegistry,
  getCanonicalStatusValues,
  validateEngagementAccess,
} from "../services/phaseStateService";
import type { PhaseStatus } from "../../shared/phases";

const router = Router();

router.get("/registry", requireAuth, (req: AuthenticatedRequest, res: Response) => {
  res.json(getPhaseRegistry());
});

router.get("/statuses", requireAuth, (req: AuthenticatedRequest, res: Response) => {
  res.json(getCanonicalStatusValues());
});

router.get("/:engagementId/state", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) {
      return res.status(access.error === "User not associated with a firm" ? 400 : 404).json({ error: access.error });
    }

    const includeGates = req.query.gates === "true";
    const state = await getEngagementPhaseState(req.params.engagementId, includeGates);
    res.json(state);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.includes("not found")) {
      return res.status(404).json({ error: message });
    }
    console.error("Error fetching phase state:", error);
    res.status(500).json({ error: "Failed to fetch phase state" });
  }
});

router.get("/:engagementId/phases/:phaseKey", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) {
      return res.status(access.error === "User not associated with a firm" ? 400 : 404).json({ error: access.error });
    }

    const state = await getPhaseState(req.params.engagementId, req.params.phaseKey);
    if (!state) {
      return res.status(404).json({ error: `Phase ${req.params.phaseKey} not found` });
    }
    res.json(state);
  } catch (error) {
    console.error("Error fetching phase state:", error);
    res.status(500).json({ error: "Failed to fetch phase state" });
  }
});

router.patch("/:engagementId/phases/:phaseKey/status", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) {
      return res.status(access.error === "User not associated with a firm" ? 400 : 404).json({ error: access.error });
    }

    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ error: "status is required" });
    }

    const validStatuses: PhaseStatus[] = ["NOT_STARTED", "IN_PROGRESS", "NEEDS_REVIEW", "BLOCKED", "COMPLETED", "APPROVED", "LOCKED"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` });
    }

    const result = await updatePhaseStatus(
      req.params.engagementId,
      req.params.phaseKey,
      status as PhaseStatus,
      req.user!.id
    );

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json(result);
  } catch (error) {
    console.error("Error updating phase status:", error);
    res.status(500).json({ error: "Failed to update phase status" });
  }
});

router.patch("/:engagementId/phases/:phaseKey/completion", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) {
      return res.status(access.error === "User not associated with a firm" ? 400 : 404).json({ error: access.error });
    }

    const { completionPercentage } = req.body;
    if (typeof completionPercentage !== "number") {
      return res.status(400).json({ error: "completionPercentage must be a number" });
    }

    const success = await updatePhaseCompletion(
      req.params.engagementId,
      req.params.phaseKey,
      completionPercentage
    );

    if (!success) {
      return res.status(404).json({ error: "Phase progress record not found. Phase may not have been initialized yet." });
    }

    res.json({ success: true, completionPercentage: Math.max(0, Math.min(100, Math.round(completionPercentage))) });
  } catch (error) {
    console.error("Error updating phase completion:", error);
    res.status(500).json({ error: "Failed to update phase completion" });
  }
});

export default router;
