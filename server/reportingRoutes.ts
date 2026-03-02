import { Router, Response } from "express";
import { requireAuth, type AuthenticatedRequest } from "./auth";
import { reportingService } from "./services/reportingService";
import { z } from "zod";

const router = Router();

const DateRangeSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
}).optional();

function parseDateRange(query: any): { from?: Date; to?: Date } | undefined {
  if (!query.from && !query.to) return undefined;
  return {
    from: query.from ? new Date(query.from) : undefined,
    to: query.to ? new Date(query.to) : undefined,
  };
}

async function validateEngagementAccess(
  engagementId: string,
  firmId: string | null
): Promise<{ valid: boolean; error?: string }> {
  if (!firmId) {
    return { valid: false, error: "User not associated with a firm" };
  }

  const { prisma } = await import("./db");
  const engagement = await prisma.engagement.findUnique({
    where: { id: engagementId },
    select: { firmId: true },
  });

  if (!engagement || engagement.firmId !== firmId) {
    return { valid: false, error: "Engagement not found or access denied" };
  }

  return { valid: true };
}

router.get(
  "/:engagementId/engagement-progress",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { engagementId } = req.params;
      const access = await validateEngagementAccess(engagementId, req.user!.firmId);

      if (!access.valid) {
        return res.status(access.error?.includes("not associated") ? 400 : 404).json({
          error: access.error,
        });
      }

      const report = await reportingService.generateEngagementProgressReport(
        engagementId,
        req.user!.id
      );

      res.json(report);
    } catch (error: any) {
      console.error("Engagement progress report error:", error);
      res.status(500).json({
        error: error.message || "Failed to generate engagement progress report",
      });
    }
  }
);

router.get(
  "/:engagementId/mapping-coverage",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { engagementId } = req.params;
      const access = await validateEngagementAccess(engagementId, req.user!.firmId);

      if (!access.valid) {
        return res.status(access.error?.includes("not associated") ? 400 : 404).json({
          error: access.error,
        });
      }

      const report = await reportingService.generateMappingCoverageReport(
        engagementId,
        req.user!.id
      );

      res.json(report);
    } catch (error: any) {
      console.error("Mapping coverage report error:", error);
      res.status(500).json({
        error: error.message || "Failed to generate mapping coverage report",
      });
    }
  }
);

router.get(
  "/:engagementId/tb-gl-reconciliation",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { engagementId } = req.params;
      const access = await validateEngagementAccess(engagementId, req.user!.firmId);

      if (!access.valid) {
        return res.status(access.error?.includes("not associated") ? 400 : 404).json({
          error: access.error,
        });
      }

      const report = await reportingService.generateTBGLReconciliationReport(
        engagementId,
        req.user!.id
      );

      res.json(report);
    } catch (error: any) {
      console.error("TB/GL reconciliation report error:", error);
      res.status(500).json({
        error: error.message || "Failed to generate TB/GL reconciliation report",
      });
    }
  }
);

router.get(
  "/:engagementId/sampling",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { engagementId } = req.params;
      const access = await validateEngagementAccess(engagementId, req.user!.firmId);

      if (!access.valid) {
        return res.status(access.error?.includes("not associated") ? 400 : 404).json({
          error: access.error,
        });
      }

      const dateRange = parseDateRange(req.query);

      const report = await reportingService.generateSamplingReport(
        engagementId,
        req.user!.id,
        dateRange
      );

      res.json(report);
    } catch (error: any) {
      console.error("Sampling report error:", error);
      res.status(500).json({
        error: error.message || "Failed to generate sampling report",
      });
    }
  }
);

router.get(
  "/:engagementId/adjustments-summary",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { engagementId } = req.params;
      const access = await validateEngagementAccess(engagementId, req.user!.firmId);

      if (!access.valid) {
        return res.status(access.error?.includes("not associated") ? 400 : 404).json({
          error: access.error,
        });
      }

      const report = await reportingService.generateAdjustmentsSummaryReport(
        engagementId,
        req.user!.id
      );

      res.json(report);
    } catch (error: any) {
      console.error("Adjustments summary report error:", error);
      res.status(500).json({
        error: error.message || "Failed to generate adjustments summary report",
      });
    }
  }
);

router.get(
  "/:engagementId/audit-trail",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { engagementId } = req.params;
      const access = await validateEngagementAccess(engagementId, req.user!.firmId);

      if (!access.valid) {
        return res.status(access.error?.includes("not associated") ? 400 : 404).json({
          error: access.error,
        });
      }

      const dateRange = parseDateRange(req.query);

      const report = await reportingService.generateAuditTrailReport(
        engagementId,
        req.user!.id,
        dateRange
      );

      res.json(report);
    } catch (error: any) {
      console.error("Audit trail report error:", error);
      res.status(500).json({
        error: error.message || "Failed to generate audit trail report",
      });
    }
  }
);

router.get(
  "/:engagementId/all",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { engagementId } = req.params;
      const access = await validateEngagementAccess(engagementId, req.user!.firmId);

      if (!access.valid) {
        return res.status(access.error?.includes("not associated") ? 400 : 404).json({
          error: access.error,
        });
      }

      const dateRange = parseDateRange(req.query);
      const userId = req.user!.id;

      const [
        engagementProgress,
        mappingCoverage,
        tbGlReconciliation,
        sampling,
        adjustmentsSummary,
        auditTrail,
      ] = await Promise.all([
        reportingService.generateEngagementProgressReport(engagementId, userId),
        reportingService.generateMappingCoverageReport(engagementId, userId),
        reportingService.generateTBGLReconciliationReport(engagementId, userId),
        reportingService.generateSamplingReport(engagementId, userId, dateRange),
        reportingService.generateAdjustmentsSummaryReport(engagementId, userId),
        reportingService.generateAuditTrailReport(engagementId, userId, dateRange),
      ]);

      res.json({
        engagementProgress,
        mappingCoverage,
        tbGlReconciliation,
        sampling,
        adjustmentsSummary,
        auditTrail,
        generatedAt: new Date(),
      });
    } catch (error: any) {
      console.error("All reports error:", error);
      res.status(500).json({
        error: error.message || "Failed to generate reports",
      });
    }
  }
);

export default router;
