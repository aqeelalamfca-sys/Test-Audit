import { Router, Response } from "express";
import { requireAuth, type AuthenticatedRequest } from "./auth";
import { samplingService } from "./samplingService";
import { z } from "zod";

const router = Router();

const generateSampleSchema = z.object({
  engagementId: z.string().uuid(),
  method: z.enum([
    "STATISTICAL_RANDOM",
    "STATISTICAL_SYSTEMATIC",
    "STATISTICAL_STRATIFIED",
    "MONETARY_UNIT_SAMPLING",
    "NON_STATISTICAL_HAPHAZARD",
    "NON_STATISTICAL_JUDGMENTAL",
    "BLOCK_SELECTION",
    "ALL_ITEMS",
  ]),
  sampleSize: z.number().int().min(1).max(10000),
  confidenceLevel: z.number().min(0).max(100).optional(),
  materialityThreshold: z.number().min(0).optional(),
  tolerableError: z.number().min(0).optional(),
  expectedError: z.number().min(0).optional(),
  randomSeed: z.number().int().optional(),
  stratificationRanges: z
    .array(
      z.object({
        min: z.number(),
        max: z.number(),
        name: z.string(),
      })
    )
    .optional(),
  targetedCriteria: z
    .object({
      highValue: z.boolean().optional(),
      highValueThreshold: z.number().optional(),
      unusualJournals: z.boolean().optional(),
      weekendPostings: z.boolean().optional(),
      roundAmounts: z.boolean().optional(),
      relatedPartyKeywords: z.array(z.string()).optional(),
    })
    .optional(),
});

router.post("/generate", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    if (!user.firmId) {
      return res.status(400).json({ error: "User not associated with a firm" });
    }

    const validation = generateSampleSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: "Invalid request",
        details: validation.error.issues,
      });
    }

    const config = validation.data;
    const context = {
      userId: user.id,
      userRole: user.role,
      userName: user.fullName,
      firmId: user.firmId,
    };

    const result = await samplingService.generateSample(config.engagementId, config, context);

    res.json({
      success: true,
      isaReference: "ISA 530 - Audit Sampling",
      ...result,
    });
  } catch (error: any) {
    console.error("Generate sample error:", error);
    res.status(500).json({
      error: error.message || "Failed to generate sample",
    });
  }
});

router.get("/:engagementId/runs", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;

    if (!engagementId) {
      return res.status(400).json({ error: "Engagement ID is required" });
    }

    const runs = await samplingService.getSamplingRuns(engagementId);

    res.json({
      runs,
      isaReference: "ISA 530 - Audit Sampling",
    });
  } catch (error: any) {
    console.error("Get sampling runs error:", error);
    res.status(500).json({
      error: error.message || "Failed to fetch sampling runs",
    });
  }
});

router.get("/run/:runId/samples", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { runId } = req.params;

    if (!runId) {
      return res.status(400).json({ error: "Run ID is required" });
    }

    const result = await samplingService.getSamplingRunItems(runId);

    res.json({
      ...result,
      isaReference: "ISA 530 - Audit Sampling",
    });
  } catch (error: any) {
    console.error("Get sample items error:", error);
    res.status(500).json({
      error: error.message || "Failed to fetch sample items",
    });
  }
});

router.get("/run/:runId/export", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { runId } = req.params;

    if (!runId) {
      return res.status(400).json({ error: "Run ID is required" });
    }

    const { items } = await samplingService.getSamplingRunItems(runId);

    const formattedItems = items.map((item: any) => ({
      glEntryId: item.glEntryId || "",
      itemNumber: item.itemNumber,
      selectionReason: item.selectionReason || "",
      voucherNumber: item.voucherNumber,
      transactionDate: item.transactionDate || new Date(),
      accountCode: item.accountCode,
      accountName: item.accountName,
      debit: Number(item.debit),
      credit: Number(item.credit),
      amount: Number(item.amount),
      description: item.description,
      reference: item.reference,
      stratum: item.stratum,
    }));

    const csv = samplingService.generateCSVExport(formattedItems);

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=sampling_run_${runId}.csv`);
    res.send(csv);
  } catch (error: any) {
    console.error("Export sample error:", error);
    res.status(500).json({
      error: error.message || "Failed to export sample",
    });
  }
});

router.delete("/run/:runId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { runId } = req.params;
    const user = req.user!;

    if (!user.firmId) {
      return res.status(400).json({ error: "User not associated with a firm" });
    }

    const context = {
      userId: user.id,
      userRole: user.role,
      userName: user.fullName,
      firmId: user.firmId,
    };

    const result = await samplingService.deleteSamplingRun(runId, context);

    res.json(result);
  } catch (error: any) {
    console.error("Delete sampling run error:", error);
    res.status(500).json({
      error: error.message || "Failed to delete sampling run",
    });
  }
});

export default router;
