import { Router, type Response } from "express";
import { requireAuth, requireMinRole, type AuthenticatedRequest } from "../auth";
import { runComplianceSimulation, type SimulationResult } from "../services/complianceSimulationService";
import { prisma } from "../db";

const router = Router();

const simulationCache = new Map<string, SimulationResult>();

router.post("/run/:engagementId", requireAuth, requireMinRole("MANAGER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const firmId = req.user!.firmId;

    if (!firmId) {
      return res.status(400).json({ error: "User not associated with a firm" });
    }

    const engagement = await prisma.engagement.findUnique({
      where: { id: engagementId },
      select: { id: true, firmId: true },
    });

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    if (engagement.firmId !== firmId) {
      return res.status(403).json({ error: "Access denied" });
    }

    const result = await runComplianceSimulation(engagementId);
    simulationCache.set(engagementId, result);

    res.json(result);
  } catch (error: any) {
    console.error("Simulation run error:", error);
    res.status(500).json({ error: error.message || "Failed to run simulation" });
  }
});

router.get("/results/:engagementId", requireAuth, requireMinRole("MANAGER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const firmId = req.user!.firmId;

    if (!firmId) {
      return res.status(400).json({ error: "User not associated with a firm" });
    }

    const engagement = await prisma.engagement.findUnique({
      where: { id: engagementId },
      select: { id: true, firmId: true },
    });

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    if (engagement.firmId !== firmId) {
      return res.status(403).json({ error: "Access denied" });
    }

    const cached = simulationCache.get(engagementId);
    if (cached) {
      return res.json(cached);
    }

    return res.json(null);
  } catch (error: any) {
    console.error("Simulation results error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch simulation results" });
  }
});

export default router;
