import { Router, type Response } from "express";
import { requireAuth, requireMinRole, type AuthenticatedRequest } from "../auth";
import { runComplianceSimulation, type SimulationResult } from "../services/complianceSimulationService";
import { prisma } from "../db";

const router = Router();

const MAX_CACHE_SIZE = 100;
const CACHE_TTL_MS = 30 * 60 * 1000;

interface CacheEntry {
  result: SimulationResult;
  timestamp: number;
}

const simulationCache = new Map<string, CacheEntry>();

function pruneCache() {
  const now = Date.now();
  for (const [key, entry] of simulationCache) {
    if (now - entry.timestamp > CACHE_TTL_MS) {
      simulationCache.delete(key);
    }
  }
  if (simulationCache.size > MAX_CACHE_SIZE) {
    const oldest = [...simulationCache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp);
    for (let i = 0; i < oldest.length - MAX_CACHE_SIZE; i++) {
      simulationCache.delete(oldest[i][0]);
    }
  }
}

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

    simulationCache.set(engagementId, { result, timestamp: Date.now() });
    pruneCache();

    res.json(result);
  } catch (error: any) {
    console.error("Simulation run error:", error);
    res.status(500).json({ error: "Failed to run compliance simulation" });
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
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return res.json(cached.result);
    }

    if (cached) {
      simulationCache.delete(engagementId);
    }

    return res.json(null);
  } catch (error: any) {
    console.error("Simulation results error:", error);
    res.status(500).json({ error: "Failed to fetch simulation results" });
  }
});

export default router;
