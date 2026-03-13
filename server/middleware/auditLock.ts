import { prisma } from "../db";
import { performanceCache } from "../services/performanceCache";
import type { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "../auth";
import type { AuditPhase, PhaseProgress } from "@prisma/client";

const PHASE_CACHE_TTL = 10_000;

async function getCachedPhaseProgress(engagementId: string): Promise<PhaseProgress[]> {
  const cacheKey = `phases:${engagementId}`;
  const cached = performanceCache.get<PhaseProgress[]>(cacheKey);
  if (cached) return cached;
  const phases = await prisma.phaseProgress.findMany({ where: { engagementId } });
  performanceCache.set(cacheKey, phases, PHASE_CACHE_TTL);
  return phases;
}

export function invalidatePhaseCache(engagementId: string) {
  performanceCache.invalidate(`phases:${engagementId}`);
}

export function requirePhaseUnlocked(phase: AuditPhase) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const engagementId = req.params.engagementId || req.body.engagementId;
      
      if (!engagementId) {
        return res.status(400).json({ error: "Engagement ID required" });
      }

      const phases = await getCachedPhaseProgress(engagementId);
      const phaseProgress = phases.find(p => p.phase === phase);

      if (!phaseProgress) {
        return res.status(404).json({ error: "Phase not found for this engagement" });
      }

      if (phaseProgress.status === "LOCKED" || phaseProgress.status === "COMPLETED") {
        return res.status(403).json({
          error: `${phase} phase is locked. Partner unlock required to make modifications.`,
          phase,
          lockedAt: phaseProgress.lockedAt,
        });
      }

      (req as any).phaseProgress = phaseProgress;
      next();
    } catch (error) {
      console.error("Phase lock check error:", error);
      res.status(500).json({ error: "Failed to verify phase lock status" });
    }
  };
}

export function requirePhaseInProgress(phase: AuditPhase) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const engagementId = req.params.engagementId || req.body.engagementId;
      
      if (!engagementId) {
        return res.status(400).json({ error: "Engagement ID required" });
      }

      const phases = await getCachedPhaseProgress(engagementId);
      const phaseProgress = phases.find(p => p.phase === phase);

      if (!phaseProgress) {
        return res.status(404).json({ error: "Phase not found for this engagement" });
      }

      if (phaseProgress.status === "NOT_STARTED") {
        return res.status(403).json({
          error: `${phase} phase has not started yet. Complete previous phases first.`,
          phase,
        });
      }

      if (phaseProgress.status === "LOCKED" || phaseProgress.status === "COMPLETED") {
        return res.status(403).json({
          error: `${phase} phase is locked. Modifications are not allowed.`,
          phase,
          lockedAt: phaseProgress.lockedAt,
        });
      }

      (req as any).phaseProgress = phaseProgress;
      next();
    } catch (error) {
      console.error("Phase progress check error:", error);
      res.status(500).json({ error: "Failed to verify phase status" });
    }
  };
}

export function requirePreviousPhasesCompleted(phase: AuditPhase) {
  /** Backend storage phases — see shared/phases.ts for canonical 19-phase workflow */
  const PHASE_ORDER: AuditPhase[] = [
    "ONBOARDING",
    "PRE_PLANNING",
    "PLANNING",
    "EXECUTION",
    "FINALIZATION",
    "REPORTING",
    "EQCR",
    "INSPECTION",
  ];

  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const engagementId = req.params.engagementId || req.body.engagementId;
      
      if (!engagementId) {
        return res.status(400).json({ error: "Engagement ID required" });
      }

      const phaseIndex = PHASE_ORDER.indexOf(phase);
      if (phaseIndex < 0) {
        return res.status(400).json({ error: "Invalid phase" });
      }

      const phases = await getCachedPhaseProgress(engagementId);

      for (let i = 0; i < phaseIndex; i++) {
        const prevPhase = phases.find((p: PhaseProgress) => p.phase === PHASE_ORDER[i]);
        if (prevPhase && prevPhase.status !== "COMPLETED" && prevPhase.status !== "LOCKED") {
          return res.status(403).json({
            error: `Previous phase ${PHASE_ORDER[i]} must be completed before accessing ${phase}.`,
            requiredPhase: PHASE_ORDER[i],
            currentPhase: phase,
          });
        }
      }

      next();
    } catch (error) {
      console.error("Previous phases check error:", error);
      res.status(500).json({ error: "Failed to verify previous phases" });
    }
  };
}

export function requirePartnerApproval(entityType: string) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const partnerRoles = ["PARTNER", "EQCR"];
    
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!partnerRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Partner approval required for ${entityType}. Only Partners, Managing Partners, or EQCR can perform this action.`,
        requiredRoles: partnerRoles,
        currentRole: req.user.role,
      });
    }

    next();
  };
}

export function preventDeletionAfterFinalization() {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const engagementId = req.params.engagementId || req.body.engagementId;
      
      if (!engagementId) {
        return next();
      }

      const finalizationPhase = await prisma.phaseProgress.findFirst({
        where: {
          engagementId,
          phase: "FINALIZATION",
        },
      });

      if (finalizationPhase && (finalizationPhase.status === "COMPLETED" || finalizationPhase.status === "LOCKED")) {
        return res.status(403).json({
          error: "Deletion is not allowed after finalization. Records can only be superseded, not deleted.",
          suggestion: "Create a superseding entry instead of deleting.",
        });
      }

      next();
    } catch (error) {
      console.error("Finalization check error:", error);
      res.status(500).json({ error: "Failed to verify finalization status" });
    }
  };
}
