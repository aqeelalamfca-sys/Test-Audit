import { Router, Response } from "express";
import { prisma } from "./db";
import { requireAuth, AuthenticatedRequest, requireMinRole } from "./auth";
import { 
  seedFieldBlueprints, 
  initializeFieldInstances, 
  pushRouter, 
  calculateModuleReadiness,
  PushRouterParams,
  ReadinessResult
} from "./services/fieldOrchestrationService";
import { z } from "zod";

const router = Router();

const PushRouterSchema = z.object({
  engagementId: z.string().uuid(),
  fiscalYearId: z.string().uuid().optional(),
  tbBatchId: z.string().uuid().optional(),
  glBatchId: z.string().uuid().optional(),
  mappingSessionId: z.string().uuid().optional(),
  targets: z.array(z.string()),
});

router.post("/seed-blueprints", requireAuth, requireMinRole("FIRM_ADMIN"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const created = await seedFieldBlueprints();
    res.json({
      success: true,
      message: `Seeded ${created} field blueprints`,
      count: created,
    });
  } catch (error) {
    console.error("Seed blueprints error:", error);
    res.status(500).json({ error: "Failed to seed field blueprints" });
  }
});

router.post("/initialize/:engagementId", requireAuth, requireMinRole("STAFF"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const userId = req.user!.id;
    const firmId = req.user!.firmId;

    const engagement = await prisma.engagement.findFirst({
      where: { id: engagementId, firmId: firmId || undefined },
    });

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    const created = await initializeFieldInstances(engagementId, userId);

    res.json({
      success: true,
      message: `Initialized ${created} field instances for engagement`,
      count: created,
    });
  } catch (error) {
    console.error("Initialize field instances error:", error);
    res.status(500).json({ error: "Failed to initialize field instances" });
  }
});

router.post("/push", requireAuth, requireMinRole("SENIOR"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const body = PushRouterSchema.parse(req.body);
    const userId = req.user!.id;
    const firmId = req.user!.firmId;

    const engagement = await prisma.engagement.findFirst({
      where: { id: body.engagementId, firmId: firmId || undefined },
    });

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    const params: PushRouterParams = {
      ...body,
      userId,
    };

    const results = await pushRouter(params);

    const readinessResults: ReadinessResult[] = [];
    for (const target of body.targets) {
      const readiness = await calculateModuleReadiness(body.engagementId, target);
      readinessResults.push(readiness);
    }

    res.json({
      success: true,
      message: "Push completed successfully",
      updatedFields: results,
      readiness: readinessResults,
    });
  } catch (error) {
    console.error("Push router error:", error);
    res.status(500).json({ error: "Failed to push data to modules" });
  }
});

router.get("/readiness/:engagementId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const { module, tab } = req.query;
    const firmId = req.user!.firmId;

    const engagement = await prisma.engagement.findFirst({
      where: { id: engagementId, firmId: firmId || undefined },
    });

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    if (module) {
      const readiness = await calculateModuleReadiness(
        engagementId, 
        module as string, 
        tab as string | undefined
      );
      return res.json(readiness);
    }

    const allModules = ["INFORMATION_REQUISITION", "PRE_PLANNING", "PLANNING", "EXECUTION", "FS_HEADS", "FINALIZATION", "QUALITY_REVIEW", "INSPECTION"];
    const readinessResults: ReadinessResult[] = [];

    for (const mod of allModules) {
      const readiness = await calculateModuleReadiness(engagementId, mod);
      readinessResults.push(readiness);
    }

    res.json({
      engagementId,
      modules: readinessResults,
      overallReadiness: Math.round(
        readinessResults.reduce((sum, r) => sum + r.readinessPercentage, 0) / readinessResults.length
      ),
    });
  } catch (error) {
    console.error("Get readiness error:", error);
    res.status(500).json({ error: "Failed to get readiness status" });
  }
});

router.get("/instances/:engagementId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const { module, tab } = req.query;
    const firmId = req.user!.firmId;

    const engagement = await prisma.engagement.findFirst({
      where: { id: engagementId, firmId: firmId || undefined },
    });

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    const whereClause: any = { engagementId };
    if (module) whereClause.module = module;
    if (tab) whereClause.tab = tab;

    const instances = await prisma.requiredFieldInstance.findMany({
      where: whereClause,
      include: { blueprint: true },
      orderBy: [{ module: "asc" }, { tab: "asc" }, { blueprint: { orderIndex: "asc" } }],
    });

    res.json(instances);
  } catch (error) {
    console.error("Get instances error:", error);
    res.status(500).json({ error: "Failed to get field instances" });
  }
});

router.patch("/instance/:instanceId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { instanceId } = req.params;
    const { value, overrideReason } = req.body;
    const userId = req.user!.id;
    const firmId = req.user!.firmId;

    const instance = await prisma.requiredFieldInstance.findUnique({
      where: { id: instanceId },
      include: { engagement: true, blueprint: true },
    });

    if (!instance || instance.engagement.firmId !== firmId) {
      return res.status(404).json({ error: "Field instance not found" });
    }

    if (instance.isLocked) {
      return res.status(403).json({ error: "Field is locked and cannot be modified" });
    }

    if (instance.blueprint.minRoleToEdit) {
      const roleHierarchy = ["STAFF", "SENIOR", "MANAGER", "EQCR", "PARTNER", "FIRM_ADMIN"];
      const userRoleIndex = roleHierarchy.indexOf(req.user!.role);
      const requiredRoleIndex = roleHierarchy.indexOf(instance.blueprint.minRoleToEdit);
      if (userRoleIndex < requiredRoleIndex) {
        return res.status(403).json({ error: `Requires ${instance.blueprint.minRoleToEdit} role or higher` });
      }
    }

    const beforeJson = {
      value: instance.valueJson,
      status: instance.status,
    };

    const displayValue = value !== null ? (typeof value === "object" ? JSON.stringify(value) : String(value)) : null;

    const isOverride = instance.status === "POPULATED" && overrideReason;

    const updated = await prisma.requiredFieldInstance.update({
      where: { id: instanceId },
      data: {
        valueJson: value,
        displayValue,
        status: value !== null && value !== undefined 
          ? (isOverride ? "OVERRIDDEN" : "POPULATED") 
          : "MISSING",
        overrideSnapshot: isOverride ? beforeJson : instance.overrideSnapshot,
        overrideReason: isOverride ? overrideReason : instance.overrideReason,
        updatedById: userId,
      },
      include: { blueprint: true },
    });

    await prisma.fieldAuditLog.create({
      data: {
        instanceId,
        engagementId: instance.engagementId,
        action: isOverride ? "USER_OVERRIDE" : "USER_UPDATE",
        beforeJson,
        afterJson: { value, status: updated.status },
        sourceType: "USER_INPUT",
        userId,
      },
    });

    res.json({
      success: true,
      instance: updated,
    });
  } catch (error) {
    console.error("Update instance error:", error);
    res.status(500).json({ error: "Failed to update field instance" });
  }
});

router.post("/sign-off/:instanceId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { instanceId } = req.params;
    const { level } = req.body;
    const userId = req.user!.id;
    const userRole = req.user!.role;
    const firmId = req.user!.firmId;

    const instance = await prisma.requiredFieldInstance.findUnique({
      where: { id: instanceId },
      include: { engagement: true },
    });

    if (!instance || instance.engagement.firmId !== firmId) {
      return res.status(404).json({ error: "Field instance not found" });
    }

    const roleToLevel: Record<string, string[]> = {
      STAFF: ["PREPARED"],
      SENIOR: ["PREPARED"],
      TEAM_LEAD: ["PREPARED"],
      MANAGER: ["PREPARED", "REVIEWED"],
      EQCR: ["PREPARED", "REVIEWED"],
      PARTNER: ["PREPARED", "REVIEWED", "APPROVED"],
      MANAGING_PARTNER: ["PREPARED", "REVIEWED", "APPROVED"],
      ADMIN: ["PREPARED", "REVIEWED", "APPROVED"],
    };

    const allowedLevels = roleToLevel[userRole] || [];
    if (!allowedLevels.includes(level)) {
      return res.status(403).json({ error: `Your role cannot sign off at ${level} level` });
    }

    const updateData: any = {
      signOffLevel: level,
    };

    if (level === "PREPARED") {
      updateData.preparedById = userId;
      updateData.preparedAt = new Date();
    } else if (level === "REVIEWED") {
      updateData.reviewedById = userId;
      updateData.reviewedAt = new Date();
    } else if (level === "APPROVED") {
      updateData.approvedById = userId;
      updateData.approvedAt = new Date();
      updateData.isLocked = true;
      updateData.lockedById = userId;
      updateData.lockedAt = new Date();
      updateData.lockReason = "Approved and locked";
    }

    const updated = await prisma.requiredFieldInstance.update({
      where: { id: instanceId },
      data: updateData,
      include: { blueprint: true },
    });

    await prisma.fieldAuditLog.create({
      data: {
        instanceId,
        engagementId: instance.engagementId,
        action: `SIGN_OFF_${level}`,
        afterJson: { level, signedBy: userId },
        userId,
      },
    });

    res.json({
      success: true,
      instance: updated,
    });
  } catch (error) {
    console.error("Sign-off error:", error);
    res.status(500).json({ error: "Failed to sign off field" });
  }
});

router.post("/unlock/:instanceId", requireAuth, requireMinRole("PARTNER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { instanceId } = req.params;
    const { reason } = req.body;
    const userId = req.user!.id;
    const firmId = req.user!.firmId;

    if (!reason) {
      return res.status(400).json({ error: "Unlock reason is required" });
    }

    const instance = await prisma.requiredFieldInstance.findUnique({
      where: { id: instanceId },
      include: { engagement: true },
    });

    if (!instance || instance.engagement.firmId !== firmId) {
      return res.status(404).json({ error: "Field instance not found" });
    }

    const updated = await prisma.requiredFieldInstance.update({
      where: { id: instanceId },
      data: {
        isLocked: false,
        signOffLevel: "PREPARED",
        approvedById: null,
        approvedAt: null,
        reviewedById: null,
        reviewedAt: null,
      },
      include: { blueprint: true },
    });

    await prisma.fieldAuditLog.create({
      data: {
        instanceId,
        engagementId: instance.engagementId,
        action: "PARTNER_UNLOCK",
        beforeJson: { locked: true, signOffLevel: instance.signOffLevel },
        afterJson: { locked: false, signOffLevel: "PREPARED", reason },
        userId,
      },
    });

    res.json({
      success: true,
      instance: updated,
    });
  } catch (error) {
    console.error("Unlock error:", error);
    res.status(500).json({ error: "Failed to unlock field" });
  }
});

router.get("/audit-log/:engagementId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const { instanceId, limit = "50" } = req.query;
    const firmId = req.user!.firmId;

    const engagement = await prisma.engagement.findFirst({
      where: { id: engagementId, firmId: firmId || undefined },
    });

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    const whereClause: any = { engagementId };
    if (instanceId) {
      whereClause.instanceId = instanceId;
    }

    const logs = await prisma.fieldAuditLog.findMany({
      where: whereClause,
      include: {
        user: { select: { id: true, fullName: true, role: true } },
        instance: { select: { fieldKey: true, module: true, tab: true } },
      },
      orderBy: { createdAt: "desc" },
      take: parseInt(limit as string),
    });

    res.json(logs);
  } catch (error) {
    console.error("Get audit log error:", error);
    res.status(500).json({ error: "Failed to get audit log" });
  }
});

router.get("/blueprints", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { module, tab } = req.query;

    const whereClause: any = { isActive: true };
    if (module) whereClause.module = module;
    if (tab) whereClause.tab = tab;

    const blueprints = await prisma.requiredFieldBlueprint.findMany({
      where: whereClause,
      orderBy: [{ module: "asc" }, { tab: "asc" }, { orderIndex: "asc" }],
    });

    res.json(blueprints);
  } catch (error) {
    console.error("Get blueprints error:", error);
    res.status(500).json({ error: "Failed to get field blueprints" });
  }
});

router.get("/module-tabs", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const blueprints = await prisma.requiredFieldBlueprint.findMany({
      where: { isActive: true },
      select: { module: true, tab: true },
      distinct: ["module", "tab"],
      orderBy: [{ module: "asc" }, { tab: "asc" }],
    });

    const grouped = blueprints.reduce((acc, bp) => {
      if (!acc[bp.module]) {
        acc[bp.module] = [];
      }
      if (!acc[bp.module].includes(bp.tab)) {
        acc[bp.module].push(bp.tab);
      }
      return acc;
    }, {} as Record<string, string[]>);

    res.json(grouped);
  } catch (error) {
    console.error("Get module tabs error:", error);
    res.status(500).json({ error: "Failed to get module tabs" });
  }
});

export default router;
