import { Router, Request, Response } from "express";

interface AuthenticatedRequest extends Request {
  user?: { id: string };
}
import { z } from "zod";
import {
  getFieldDefinitions,
  refreshAutoFields,
  getDrilldownData,
  overrideFieldValue,
  lockField,
  unlockField,
  getFieldAuditHistory,
  signOffField,
  FetchContext,
} from "./services/fetchEngineService";
import { seedFetchRules } from "./seeds/fetchRuleSeeds";

export const fetchEngineRouter = Router();

const RefreshFieldsSchema = z.object({
  scopeType: z.enum(["ENGAGEMENT", "FS_HEAD", "PROCEDURE", "CONFIRMATION"]).optional(),
  scopeId: z.string().optional(),
  forceRefresh: z.boolean().optional(),
});

const OverrideFieldSchema = z.object({
  newValue: z.unknown(),
  overrideReason: z.string().min(1, "Override reason is required"),
});

const LockFieldSchema = z.object({
  lockReason: z.string().min(1, "Lock reason is required"),
});

const SignOffFieldSchema = z.object({
  signOffLevel: z.enum(["PREPARED", "REVIEWED", "APPROVED"]),
});

fetchEngineRouter.get(
  "/engagements/:engagementId/fields",
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { engagementId } = req.params;
      const { module, tab, scopeType, scopeId } = req.query;

      if (!module || typeof module !== "string") {
        return res.status(400).json({ error: "Module is required" });
      }

      const validScopeTypes = ["ENGAGEMENT", "FS_HEAD", "PROCEDURE", "CONFIRMATION"];
      const parsedScopeType = typeof scopeType === "string" && validScopeTypes.includes(scopeType)
        ? scopeType as "ENGAGEMENT" | "FS_HEAD" | "PROCEDURE" | "CONFIRMATION"
        : undefined;

      const fields = await getFieldDefinitions(
        engagementId,
        module,
        typeof tab === "string" ? tab : undefined,
        parsedScopeType,
        typeof scopeId === "string" ? scopeId : undefined
      );

      return res.json({ fields });
    } catch (error) {
      console.error("Error fetching field definitions:", error);
      return res.status(500).json({ error: "Failed to fetch field definitions" });
    }
  }
);

fetchEngineRouter.post(
  "/engagements/:engagementId/fields/refresh",
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { engagementId } = req.params;
      const userId = req.user?.id || "system";

      const body = RefreshFieldsSchema.parse(req.body);

      const context: FetchContext = {
        engagementId,
        scopeType: body.scopeType || "ENGAGEMENT",
        scopeId: body.scopeId,
        userId,
        forceRefresh: body.forceRefresh,
      };

      const refreshedCount = await refreshAutoFields(context);

      return res.json({
        success: true,
        refreshedCount,
        message: `Refreshed ${refreshedCount} fields`,
      });
    } catch (error) {
      console.error("Error refreshing fields:", error);
      return res.status(500).json({ error: "Failed to refresh fields" });
    }
  }
);

fetchEngineRouter.get(
  "/engagements/:engagementId/fields/:blueprintId/drilldown",
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { engagementId, blueprintId } = req.params;
      const { scopeType, scopeId } = req.query;
      const userId = req.user?.id || "system";

      const context: FetchContext = {
        engagementId,
        scopeType: (scopeType as "ENGAGEMENT" | "FS_HEAD" | "PROCEDURE" | "CONFIRMATION") || "ENGAGEMENT",
        scopeId: typeof scopeId === "string" ? scopeId : undefined,
        userId,
      };

      const drilldownData = await getDrilldownData(blueprintId, context);

      return res.json({ drilldownData });
    } catch (error) {
      console.error("Error fetching drilldown data:", error);
      return res.status(500).json({ error: "Failed to fetch drilldown data" });
    }
  }
);

fetchEngineRouter.post(
  "/field-instances/:instanceId/override",
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { instanceId } = req.params;
      const userId = req.user?.id || "system";

      const body = OverrideFieldSchema.parse(req.body);

      await overrideFieldValue(instanceId, body.newValue, body.overrideReason, userId);

      return res.json({
        success: true,
        message: "Field value overridden successfully",
      });
    } catch (error) {
      console.error("Error overriding field value:", error);
      if (error instanceof Error) {
        return res.status(400).json({ error: error.message });
      }
      return res.status(500).json({ error: "Failed to override field value" });
    }
  }
);

fetchEngineRouter.post(
  "/field-instances/:instanceId/lock",
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { instanceId } = req.params;
      const userId = req.user?.id || "system";

      const body = LockFieldSchema.parse(req.body);

      await lockField(instanceId, body.lockReason, userId);

      return res.json({
        success: true,
        message: "Field locked successfully",
      });
    } catch (error) {
      console.error("Error locking field:", error);
      if (error instanceof Error) {
        return res.status(400).json({ error: error.message });
      }
      return res.status(500).json({ error: "Failed to lock field" });
    }
  }
);

fetchEngineRouter.post(
  "/field-instances/:instanceId/unlock",
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { instanceId } = req.params;
      const userId = req.user?.id || "system";

      await unlockField(instanceId, userId);

      return res.json({
        success: true,
        message: "Field unlocked successfully",
      });
    } catch (error) {
      console.error("Error unlocking field:", error);
      if (error instanceof Error) {
        return res.status(400).json({ error: error.message });
      }
      return res.status(500).json({ error: "Failed to unlock field" });
    }
  }
);

fetchEngineRouter.post(
  "/field-instances/:instanceId/sign-off",
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { instanceId } = req.params;
      const userId = req.user?.id || "system";

      const body = SignOffFieldSchema.parse(req.body);

      await signOffField(instanceId, body.signOffLevel, userId);

      return res.json({
        success: true,
        message: `Field signed off as ${body.signOffLevel}`,
      });
    } catch (error) {
      console.error("Error signing off field:", error);
      if (error instanceof Error) {
        return res.status(400).json({ error: error.message });
      }
      return res.status(500).json({ error: "Failed to sign off field" });
    }
  }
);

fetchEngineRouter.get(
  "/engagements/:engagementId/fields/audit-history",
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { engagementId } = req.params;
      const { fieldKey } = req.query;

      const auditHistory = await getFieldAuditHistory(
        engagementId,
        typeof fieldKey === "string" ? fieldKey : undefined
      );

      return res.json({ auditHistory });
    } catch (error) {
      console.error("Error fetching audit history:", error);
      return res.status(500).json({ error: "Failed to fetch audit history" });
    }
  }
);

fetchEngineRouter.post("/fetch-rules/seed", async (_req: Request, res: Response) => {
  try {
    const created = await seedFetchRules();

    return res.json({
      success: true,
      created,
      message: `Seeded ${created} fetch rules`,
    });
  } catch (error) {
    console.error("Error seeding fetch rules:", error);
    return res.status(500).json({ error: "Failed to seed fetch rules" });
  }
});
