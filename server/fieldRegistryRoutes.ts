import { Router, Request, Response } from "express";
import { requireAuth, type AuthenticatedRequest } from "./auth";
import { z } from "zod";
import { prisma } from "./db";
import { seedFieldRegistry } from "./seeds/fieldRegistrySeeds";
import {
  computeFieldsForEngagement,
  getComputedFieldsForEngagement,
  overrideComputedField,
  clearFieldOverride
} from "./services/fieldRegistryEngine";

const router = Router();

router.get("/", requireAuth, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const fieldRegistry = await prisma.fieldRegistry.findMany({
      orderBy: [{ module: "asc" }, { tab: "asc" }, { fieldCode: "asc" }]
    });
    
    return res.json({ fields: fieldRegistry });
  } catch (error) {
    console.error("Error fetching field registry:", error);
    return res.status(500).json({ error: "Failed to fetch field registry" });
  }
});

router.get("/by-module/:module", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { module } = req.params;
    const { tab } = req.query;
    
    const whereClause: { module: string; tab?: string } = { module };
    if (typeof tab === "string") {
      whereClause.tab = tab;
    }
    
    const fieldRegistry = await prisma.fieldRegistry.findMany({
      where: whereClause,
      orderBy: { fieldCode: "asc" }
    });
    
    return res.json({ fields: fieldRegistry });
  } catch (error) {
    console.error("Error fetching field registry by module:", error);
    return res.status(500).json({ error: "Failed to fetch field registry by module" });
  }
});

router.post("/seed", requireAuth, async (_req: Request, res: Response) => {
  try {
    const created = await seedFieldRegistry();
    return res.json({ success: true, created, message: `Seeded ${created} field registry entries` });
  } catch (error) {
    console.error("Error seeding field registry:", error);
    return res.status(500).json({ error: "Failed to seed field registry" });
  }
});

const OverrideSchema = z.object({
  overrideValue: z.string(),
  overrideReason: z.string().min(1, "Override reason is required")
});

router.get("/engagements/:engagementId/computed-fields", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const { module, tab } = req.query;
    
    let result = await getComputedFieldsForEngagement(engagementId);
    
    if (typeof module === "string") {
      result = {
        fields: result.fields.filter(f => f.module === module)
      };
    }
    
    if (typeof tab === "string") {
      result = {
        fields: result.fields.filter(f => f.tab === tab)
      };
    }
    
    return res.json(result);
  } catch (error) {
    console.error("Error fetching computed fields:", error);
    return res.status(500).json({ error: "Failed to fetch computed fields" });
  }
});

router.post("/engagements/:engagementId/computed-fields/recompute", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const userId = req.user?.id;
    
    const results = await computeFieldsForEngagement(engagementId, userId);
    
    const successCount = results.filter(r => r.success).length;
    const failedCount = results.filter(r => !r.success).length;
    
    return res.json({
      success: true,
      message: `Recomputed ${successCount} fields (${failedCount} failed)`,
      results: results.map(r => ({
        fieldCode: r.fieldCode,
        success: r.success,
        error: r.error
      }))
    });
  } catch (error) {
    console.error("Error recomputing fields:", error);
    return res.status(500).json({ error: "Failed to recompute fields" });
  }
});

router.patch("/engagements/:engagementId/computed-fields/:fieldCode/override", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId, fieldCode } = req.params;
    const userId = req.user!.id;
    
    const body = OverrideSchema.parse(req.body);
    
    const result = await overrideComputedField(
      engagementId,
      fieldCode,
      body.overrideValue,
      body.overrideReason,
      userId
    );
    
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    
    return res.json({ success: true, message: "Field overridden successfully" });
  } catch (error) {
    console.error("Error overriding field:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    return res.status(500).json({ error: "Failed to override field" });
  }
});

router.delete("/engagements/:engagementId/computed-fields/:fieldCode/override", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId, fieldCode } = req.params;
    
    const result = await clearFieldOverride(engagementId, fieldCode);
    
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    
    return res.json({ success: true, message: "Override cleared successfully" });
  } catch (error) {
    console.error("Error clearing override:", error);
    return res.status(500).json({ error: "Failed to clear override" });
  }
});

export default router;
