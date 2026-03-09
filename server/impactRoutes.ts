import { Router, Response } from "express";
import { z } from "zod";
import { prisma } from "./db";
import { requireAuth, logAuditTrail, AuthenticatedRequest } from "./auth";
import * as impactService from "./impactService";
import { ImpactSeverity, ImpactStatus } from "./impactService";

const router = Router();

async function validateEngagementAccess(
  engagementId: string,
  userId: string,
  firmId: string | null
): Promise<{ valid: boolean; engagement?: any; error?: string }> {
  if (!firmId) {
    return { valid: false, error: "User not associated with a firm" };
  }

  const engagement = await prisma.engagement.findUnique({
    where: { id: engagementId },
    select: { id: true, firmId: true },
  });

  if (!engagement || engagement.firmId !== firmId) {
    return { valid: false, error: "Engagement not found" };
  }

  return { valid: true, engagement };
}

const IMPACT_STATUSES = Object.values(ImpactStatus);
const IMPACT_SEVERITIES = Object.values(ImpactSeverity);

const registerImpactSchema = z.object({
  sourceType: z.string().min(1, "Source type is required"),
  sourceId: z.string().min(1, "Source ID is required"),
  sourceVersion: z.number().optional(),
  changeType: z.string().min(1, "Change type is required"),
  changeDescription: z.string().min(1, "Change description is required"),
  targets: z.array(
    z.object({
      module: z.string().min(1, "Module is required"),
      entityType: z.string().optional(),
      entityId: z.string().optional(),
      description: z.string().min(1, "Description is required"),
      severity: z.enum(IMPACT_SEVERITIES as [string, ...string[]]).optional(),
      requiresRecompute: z.boolean().optional(),
      autoRecomputable: z.boolean().optional(),
    })
  ).min(1, "At least one target is required"),
});

const ignoreSchema = z.object({
  reason: z.string().min(1, "Reason is required"),
});

const bulkResolveSchema = z.object({
  impactIds: z.array(z.string()).min(1, "At least one impact ID is required"),
});

router.get("/:engagementId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(
      req.params.engagementId,
      req.user!.id,
      req.user!.firmId
    );
    if (!access.valid) {
      return res.status(access.error === "User not associated with a firm" ? 400 : 404)
        .json({ error: access.error });
    }

    const { status, severity, sourceType, impactedModule, requiresRecompute } = req.query;

    const filters: impactService.ImpactFilters = {};

    if (status && IMPACT_STATUSES.includes(status as ImpactStatus)) {
      filters.status = status as ImpactStatus;
    }
    if (severity && IMPACT_SEVERITIES.includes(severity as ImpactSeverity)) {
      filters.severity = severity as ImpactSeverity;
    }
    if (sourceType) {
      filters.sourceType = sourceType as string;
    }
    if (impactedModule) {
      filters.impactedModule = impactedModule as string;
    }
    if (requiresRecompute !== undefined) {
      filters.requiresRecompute = requiresRecompute === "true";
    }

    const impacts = await impactService.getImpactsByEngagement(
      req.params.engagementId,
      filters
    );

    res.json(impacts);
  } catch (error: any) {
    console.error("Error fetching impacts:", error);
    res.status(500).json({ error: "Failed to fetch impacts", details: error.message });
  }
});

router.get("/:engagementId/summary", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(
      req.params.engagementId,
      req.user!.id,
      req.user!.firmId
    );
    if (!access.valid) {
      return res.status(access.error === "User not associated with a firm" ? 400 : 404)
        .json({ error: access.error });
    }

    const summary = await impactService.getImpactSummary(req.params.engagementId);
    res.json(summary);
  } catch (error: any) {
    console.error("Error fetching impact summary:", error);
    res.status(500).json({ error: "Failed to fetch impact summary", details: error.message });
  }
});

router.get("/:engagementId/unresolved-count", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(
      req.params.engagementId,
      req.user!.id,
      req.user!.firmId
    );
    if (!access.valid) {
      return res.status(access.error === "User not associated with a firm" ? 400 : 404)
        .json({ error: access.error });
    }

    const count = await impactService.getUnresolvedCount(req.params.engagementId);
    res.json({ count });
  } catch (error: any) {
    console.error("Error fetching unresolved count:", error);
    res.status(500).json({ error: "Failed to fetch unresolved count", details: error.message });
  }
});

router.get("/:engagementId/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(
      req.params.engagementId,
      req.user!.id,
      req.user!.firmId
    );
    if (!access.valid) {
      return res.status(access.error === "User not associated with a firm" ? 400 : 404)
        .json({ error: access.error });
    }

    const impact = await impactService.getImpactById(req.params.id);

    if (!impact || impact.engagementId !== req.params.engagementId) {
      return res.status(404).json({ error: "Impact not found" });
    }

    res.json(impact);
  } catch (error: any) {
    console.error("Error fetching impact:", error);
    res.status(500).json({ error: "Failed to fetch impact", details: error.message });
  }
});

router.post("/:engagementId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(
      req.params.engagementId,
      req.user!.id,
      req.user!.firmId
    );
    if (!access.valid) {
      return res.status(access.error === "User not associated with a firm" ? 400 : 404)
        .json({ error: access.error });
    }

    const data = registerImpactSchema.parse(req.body);

    const impacts = await impactService.registerImpact({
      engagementId: req.params.engagementId,
      ...data,
      targets: data.targets.map((t) => ({
        ...t,
        severity: t.severity as ImpactSeverity | undefined,
      })),
    });

    await logAuditTrail(
      req.user!.id,
      "IMPACTS_REGISTERED",
      "upstreamImpact",
      impacts[0]?.id || "",
      null,
      { count: impacts.length, sourceType: data.sourceType },
      req.params.engagementId,
      `Registered ${impacts.length} upstream impact(s) for ${data.sourceType}`,
      req.ip,
      req.get("user-agent")
    );

    res.status(201).json(impacts);
  } catch (error: any) {
    console.error("Error registering impacts:", error);
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to register impacts", details: error.message });
  }
});

router.post("/:engagementId/:id/acknowledge", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(
      req.params.engagementId,
      req.user!.id,
      req.user!.firmId
    );
    if (!access.valid) {
      return res.status(access.error === "User not associated with a firm" ? 400 : 404)
        .json({ error: access.error });
    }

    const existing = await impactService.getImpactById(req.params.id);
    if (!existing || existing.engagementId !== req.params.engagementId) {
      return res.status(404).json({ error: "Impact not found" });
    }

    if (existing.status !== ImpactStatus.PENDING) {
      return res.status(400).json({ error: "Impact is not in PENDING status" });
    }

    const impact = await impactService.acknowledgeImpact(req.params.id, req.user!.id);

    await logAuditTrail(
      req.user!.id,
      "IMPACT_ACKNOWLEDGED",
      "upstreamImpact",
      impact.id,
      { status: existing.status },
      { status: impact.status },
      req.params.engagementId,
      `Impact acknowledged`,
      req.ip,
      req.get("user-agent")
    );

    res.json(impact);
  } catch (error: any) {
    console.error("Error acknowledging impact:", error);
    res.status(500).json({ error: "Failed to acknowledge impact", details: error.message });
  }
});

router.post("/:engagementId/:id/resolve", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(
      req.params.engagementId,
      req.user!.id,
      req.user!.firmId
    );
    if (!access.valid) {
      return res.status(access.error === "User not associated with a firm" ? 400 : 404)
        .json({ error: access.error });
    }

    const existing = await impactService.getImpactById(req.params.id);
    if (!existing || existing.engagementId !== req.params.engagementId) {
      return res.status(404).json({ error: "Impact not found" });
    }

    if (existing.status === ImpactStatus.RECOMPUTED || existing.status === ImpactStatus.IGNORED) {
      return res.status(400).json({ error: "Impact is already resolved or ignored" });
    }

    const impact = await impactService.resolveImpact(req.params.id, req.user!.id);

    await logAuditTrail(
      req.user!.id,
      "IMPACT_RESOLVED",
      "upstreamImpact",
      impact.id,
      { status: existing.status },
      { status: impact.status },
      req.params.engagementId,
      `Impact resolved/recomputed`,
      req.ip,
      req.get("user-agent")
    );

    res.json(impact);
  } catch (error: any) {
    console.error("Error resolving impact:", error);
    res.status(500).json({ error: "Failed to resolve impact", details: error.message });
  }
});

router.post("/:engagementId/:id/ignore", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(
      req.params.engagementId,
      req.user!.id,
      req.user!.firmId
    );
    if (!access.valid) {
      return res.status(access.error === "User not associated with a firm" ? 400 : 404)
        .json({ error: access.error });
    }

    const existing = await impactService.getImpactById(req.params.id);
    if (!existing || existing.engagementId !== req.params.engagementId) {
      return res.status(404).json({ error: "Impact not found" });
    }

    if (existing.status === ImpactStatus.RECOMPUTED || existing.status === ImpactStatus.IGNORED) {
      return res.status(400).json({ error: "Impact is already resolved or ignored" });
    }

    const data = ignoreSchema.parse(req.body);
    const impact = await impactService.ignoreImpact(req.params.id, req.user!.id, data.reason);

    await logAuditTrail(
      req.user!.id,
      "IMPACT_IGNORED",
      "upstreamImpact",
      impact.id,
      { status: existing.status },
      { status: impact.status, ignoreReason: data.reason },
      req.params.engagementId,
      `Impact ignored: ${data.reason}`,
      req.ip,
      req.get("user-agent")
    );

    res.json(impact);
  } catch (error: any) {
    console.error("Error ignoring impact:", error);
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to ignore impact", details: error.message });
  }
});

router.post("/:engagementId/bulk-resolve", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(
      req.params.engagementId,
      req.user!.id,
      req.user!.firmId
    );
    if (!access.valid) {
      return res.status(access.error === "User not associated with a firm" ? 400 : 404)
        .json({ error: access.error });
    }

    const data = bulkResolveSchema.parse(req.body);
    const result = await impactService.bulkResolveImpacts(data.impactIds, req.user!.id);

    await logAuditTrail(
      req.user!.id,
      "IMPACTS_BULK_RESOLVED",
      "upstreamImpact",
      "",
      null,
      { count: result.updated },
      req.params.engagementId,
      `Bulk resolved ${result.updated} impact(s)`,
      req.ip,
      req.get("user-agent")
    );

    res.json(result);
  } catch (error: any) {
    console.error("Error bulk resolving impacts:", error);
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to bulk resolve impacts", details: error.message });
  }
});

router.get("/:engagementId/check/:entityType/:entityId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId, entityType, entityId } = req.params;
    const userId = req.user!.id;
    const firmId = req.user!.firmId;

    const accessCheck = await validateEngagementAccess(engagementId, userId, firmId);
    if (!accessCheck.valid) {
      return res.status(404).json({ error: accessCheck.error });
    }

    const result = await impactService.checkImpact(entityType, entityId, engagementId);
    res.json(result);
  } catch (error: any) {
    console.error("Error checking impact:", error);
    res.status(500).json({ error: "Failed to check impact", details: error.message });
  }
});

export default router;
