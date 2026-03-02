import type { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "../auth";
import type { UserRole } from "@prisma/client";
import { enforcementEngine } from "../services/enforcementEngine";

type EnforcementPhase = 
  | "ADMINISTRATION"
  | "PRE_PLANNING"
  | "PLANNING"
  | "EXECUTION"
  | "EVIDENCE"
  | "FINALIZATION"
  | "DELIVERABLES"
  | "QR_EQCR"
  | "INSPECTION";

export function requirePhaseAccess(phase: EnforcementPhase) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const engagementId = req.params.engagementId || req.body.engagementId || req.query.engagementId;
      
      if (!engagementId) {
        return res.status(400).json({ error: "Engagement ID required for phase access check" });
      }

      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const access = await enforcementEngine.checkPhaseAccess(
        engagementId as string,
        phase,
        req.user.id,
        req.user.role
      );

      if (!access.allowed) {
        return res.status(403).json({
          error: access.reason || "Phase access denied",
          phase,
          blockers: access.blockers,
          code: "PHASE_ACCESS_DENIED"
        });
      }

      next();
    } catch (error: any) {
      console.error("Enforcement middleware error:", error);
      res.status(500).json({ error: "Failed to verify phase access" });
    }
  };
}

export function requireSignOff(action: string, entityType: string) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const engagementId = req.params.engagementId || req.body.engagementId;
      
      if (!engagementId) {
        return next();
      }

      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const phase = (req as any).currentPhase || "EXECUTION";

      const canPerform = await enforcementEngine.canPerformAction(
        engagementId,
        action,
        entityType,
        req.user.id,
        req.user.role,
        phase
      );

      if (!canPerform.allowed) {
        return res.status(403).json({
          error: canPerform.reason,
          requiredSignOff: canPerform.requiredSignOff,
          code: "SIGN_OFF_REQUIRED"
        });
      }

      next();
    } catch (error: any) {
      console.error("Sign-off check error:", error);
      res.status(500).json({ error: "Failed to verify sign-off requirements" });
    }
  };
}

export function requireMakerChecker(entityType: string) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const engagementId = req.params.engagementId || req.body.engagementId;
      const entityId = req.params.id || req.body.entityId;
      const action = req.body.action || (req.method === "POST" ? "PREPARE" : "REVIEW");
      
      if (!engagementId || !entityId) {
        return next();
      }

      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const validation = await enforcementEngine.validateMakerChecker(
        engagementId,
        entityType,
        entityId,
        action as "PREPARE" | "REVIEW" | "APPROVE",
        req.user.id,
        req.user.role
      );

      if (!validation.allowed) {
        return res.status(403).json({
          error: validation.reason,
          code: "MAKER_CHECKER_VIOLATION",
          isaReference: "ISA 220"
        });
      }

      next();
    } catch (error: any) {
      console.error("Maker-checker validation error:", error);
      res.status(500).json({ error: "Failed to validate maker-checker workflow" });
    }
  };
}

export function logAuditAction(entityType: string, action: string, isaReference?: string) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const originalSend = res.send.bind(res);
    
    res.send = function(body: any) {
      if (req.user && res.statusCode >= 200 && res.statusCode < 300) {
        const engagementId = req.params.engagementId || req.body.engagementId;
        const entityId = req.params.id || req.body.id;
        
        enforcementEngine.logAuditTrail({
          userId: req.user.id,
          userRole: req.user.role,
          engagementId,
          action,
          entityType,
          entityId,
          ipAddress: req.ip,
          userAgent: req.get("user-agent"),
          isaReference,
          module: req.baseUrl?.replace("/api/", "") || "unknown",
          screen: req.path
        }).catch(err => console.error("Audit log error:", err));
      }
      
      return originalSend(body);
    };

    next();
  };
}

export function enforceInspectionMode() {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const engagementId = req.params.engagementId || req.body.engagementId;
      
      if (!engagementId) {
        return next();
      }

      const status = await enforcementEngine.getEngagementStatus(engagementId);

      if (status.isInspectionMode && req.method !== "GET") {
        if (req.user?.role !== "ADMIN") {
          return res.status(403).json({
            error: "Engagement is in read-only inspection mode",
            code: "INSPECTION_MODE_LOCKED",
            isaReference: "ISA 230"
          });
        }
      }

      next();
    } catch (error: any) {
      console.error("Inspection mode check error:", error);
      next();
    }
  };
}

export function attachEnforcementContext() {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const engagementId = req.params.engagementId || req.body.engagementId || req.query.engagementId;
      
      if (engagementId && req.user) {
        const status = await enforcementEngine.getEngagementStatus(engagementId as string);
        (req as any).enforcementStatus = status;
        (req as any).currentPhase = status.currentPhase;
        (req as any).isInspectionMode = status.isInspectionMode;
      }

      next();
    } catch (error: any) {
      next();
    }
  };
}
