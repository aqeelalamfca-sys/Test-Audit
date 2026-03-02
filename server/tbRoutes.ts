import { Router, Request, Response, NextFunction } from "express";
import { tbService } from "./services/tbService";
import type { UserRole } from "@prisma/client";

const router = Router();

interface AuthRequest extends Request {
  user?: {
    id: string;
    role: UserRole;
    fullName?: string;
  };
}

const ROLE_HIERARCHY: Record<UserRole, number> = {
  STAFF: 1,
  SENIOR: 2,
  TEAM_LEAD: 3,
  MANAGER: 4,
  PARTNER: 5,
  MANAGING_PARTNER: 6,
  EQCR: 5,
  ADMIN: 7
};

function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
}

function requireRole(...roles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const minRequired = Math.min(...roles.map(r => ROLE_HIERARCHY[r]));
    if (ROLE_HIERARCHY[req.user.role] < minRequired) {
      return res.status(403).json({ 
        error: `Insufficient permissions. Required: ${roles.join(" or ")} (ISA 220)` 
      });
    }
    next();
  };
}

function getServiceContext(req: AuthRequest) {
  return {
    userId: req.user!.id,
    userRole: req.user!.role,
    userName: req.user!.fullName,
    ipAddress: req.ip,
    userAgent: req.get("User-Agent")
  };
}

router.get("/template", requireAuth, (req: AuthRequest, res: Response) => {
  const csv = tbService.generateCSVTemplate();
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=trial_balance_template.csv");
  res.send(csv);
});

router.post("/generate-from-gl", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { engagementId, firmId, glBatchId, periodStart, periodEnd, fiscalYear } = req.body;

    if (!engagementId || !firmId || !glBatchId || !periodStart || !periodEnd || !fiscalYear) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const result = await tbService.generateFromApprovedGL(
      engagementId,
      firmId,
      glBatchId,
      new Date(periodStart),
      new Date(periodEnd),
      fiscalYear,
      getServiceContext(req)
    );

    res.status(201).json({
      message: "Trial Balance generated from approved GL (ISA 500)",
      ...result
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post("/upload", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { 
      engagementId, 
      firmId, 
      entries, 
      periodStart, 
      periodEnd, 
      fiscalYear,
      sourceFileName,
      sourceFileType
    } = req.body;

    if (!engagementId || !firmId || !entries || !periodStart || !periodEnd || !fiscalYear) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (!Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ error: "Entries array is required and must not be empty" });
    }

    const result = await tbService.uploadExternalTB(
      engagementId,
      firmId,
      entries,
      new Date(periodStart),
      new Date(periodEnd),
      fiscalYear,
      sourceFileName,
      sourceFileType,
      getServiceContext(req)
    );

    res.status(201).json({
      message: "Trial Balance uploaded successfully (ISA 230)",
      ...result
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get("/engagement/:engagementId", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const includeSuperseded = req.query.includeSuperseded === "true";
    
    const batches = await tbService.getBatchesForEngagement(engagementId, includeSuperseded);
    res.json(batches);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/batch/:batchId", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const batch = await tbService.getBatch(req.params.batchId, getServiceContext(req));
    if (!batch) {
      return res.status(404).json({ error: "Batch not found" });
    }
    res.json(batch);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/batch/:batchId/validation-errors", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const errors = await tbService.getValidationErrors(req.params.batchId);
    res.json(errors);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/batch/:batchId/reconciliations", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const reconciliations = await tbService.getReconciliations(req.params.batchId);
    res.json(reconciliations);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/batch/:batchId/audit-log", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const logs = await tbService.getAuditLog(req.params.batchId);
    res.json(logs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/batch/:batchId/validate", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const errors = await tbService.validateBatch(req.params.batchId, getServiceContext(req));
    res.json({ 
      validationErrors: errors,
      hasBlockingErrors: errors.some((e: any) => e.isBlocking),
      message: "Validation completed (ISA 500)"
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/batch/:batchId/reconcile", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { performanceMateriality } = req.body;

    if (performanceMateriality === undefined || performanceMateriality < 0) {
      return res.status(400).json({ error: "Performance materiality is required and must be non-negative" });
    }

    const result = await tbService.reconcileWithGL(
      req.params.batchId,
      performanceMateriality,
      getServiceContext(req)
    );

    res.json({
      message: "GL↔TB reconciliation completed (ISA 500)",
      ...result
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post("/reconciliation/:reconciliationId/resolve", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { resolutionType, resolutionNote, evidenceIds } = req.body;

    if (!resolutionNote) {
      return res.status(400).json({ error: "Resolution note is required (ISA 230)" });
    }

    const result = await tbService.resolveVariance(
      req.params.reconciliationId,
      resolutionType || "EXPLAINED",
      resolutionNote,
      evidenceIds || [],
      getServiceContext(req)
    );

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ 
      message: "Variance resolved (ISA 500, ISA 230)",
      success: true 
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/batch/:batchId/submit-for-review", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const result = await tbService.submitForReview(req.params.batchId, getServiceContext(req));
    
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ 
      message: "TB submitted for review (ISA 230)",
      success: true 
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post(
  "/batch/:batchId/review",
  requireAuth,
  requireRole("SENIOR", "TEAM_LEAD", "MANAGER", "PARTNER"),
  async (req: AuthRequest, res: Response) => {
    try {
      const { approved, comments } = req.body;

      if (approved === undefined) {
        return res.status(400).json({ error: "Approval decision is required" });
      }

      const result = await tbService.reviewBatch(
        req.params.batchId,
        approved,
        comments,
        getServiceContext(req)
      );

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      res.json({ 
        message: approved ? "TB reviewed (ISA 220)" : "TB review rejected (ISA 220)",
        success: true 
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.post("/batch/:batchId/submit-for-approval", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const result = await tbService.submitForApproval(req.params.batchId, getServiceContext(req));
    
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ 
      message: "TB submitted for partner approval (ISA 220)",
      success: true 
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post(
  "/batch/:batchId/approve",
  requireAuth,
  requireRole("PARTNER", "MANAGING_PARTNER"),
  async (req: AuthRequest, res: Response) => {
    try {
      const { partnerPin, comments } = req.body;

      const result = await tbService.approveBatch(
        req.params.batchId,
        partnerPin,
        comments,
        getServiceContext(req)
      );

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      res.json({ 
        message: "TB approved by Partner and locked (ISA 220, ISA 230)",
        success: true 
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.get("/engagement/:engagementId/can-proceed-to-fs", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const result = await tbService.canProceedToFS(req.params.engagementId);
    res.json({
      canProceed: result.canProceed,
      blockers: result.blockers,
      isaReference: "ISA 500, ISA 315"
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
