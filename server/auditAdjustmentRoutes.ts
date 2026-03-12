import { Router, Response } from "express";
import { z } from "zod";
import { prisma } from "./db";
import { requireAuth, AuthenticatedRequest } from "./auth";

const router = Router();
const db = prisma as any;

const createSchema = z.object({
  engagementId: z.string().min(1),
  adjustmentType: z.enum(["CORRECTED", "UNCORRECTED", "RECLASSIFICATION", "DISCLOSURE"]).default("CORRECTED"),
  description: z.string().min(1, "Description is required"),
  reason: z.string().optional(),
  debitAccountCode: z.string().optional(),
  debitAccountName: z.string().optional(),
  debitAmount: z.number().optional(),
  creditAccountCode: z.string().optional(),
  creditAccountName: z.string().optional(),
  creditAmount: z.number().optional(),
});

router.post("/", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const firmId = req.user!.firmId;

    const validation = createSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: validation.error.errors[0]?.message });
    }

    const data = validation.data;

    const engagement = await prisma.engagement.findUnique({
      where: { id: data.engagementId },
      select: { id: true, firmId: true },
    });

    if (!engagement || engagement.firmId !== firmId) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    const netImpact = (data.debitAmount || 0) - (data.creditAmount || 0);

    const journalMeta = JSON.stringify({
      debitAccountCode: data.debitAccountCode || null,
      debitAccountName: data.debitAccountName || null,
      creditAccountCode: data.creditAccountCode || null,
      creditAccountName: data.creditAccountName || null,
    });

    let adjustment: any;
    let retries = 3;
    while (retries > 0) {
      try {
        const count = await db.auditAdjustment.count({ where: { engagementId: data.engagementId } });
        adjustment = await db.auditAdjustment.create({
          data: {
            engagementId: data.engagementId,
            adjustmentRef: `AJE-${String(count + 1).padStart(3, "0")}`,
            adjustmentType: data.adjustmentType,
            description: data.description,
            auditImpact: data.reason || null,
            accountCode: data.debitAccountCode || null,
            accountName: data.debitAccountName || null,
            fsArea: journalMeta,
            debitAmount: data.debitAmount ?? null,
            creditAmount: data.creditAmount ?? null,
            netImpact: netImpact || null,
            identifiedById: userId,
            identifiedAt: new Date(),
          },
        });
        break;
      } catch (err: any) {
        if (err.code === "P2002" && retries > 1) {
          retries--;
          continue;
        }
        throw err;
      }
    }

    res.json({ success: true, adjustment });
  } catch (error: any) {
    console.error("Error creating audit adjustment:", error);
    res.status(500).json({ error: "Failed to create adjustment" });
  }
});

router.get("/:engagementId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firmId = req.user!.firmId;
    const { engagementId } = req.params;

    const engagement = await prisma.engagement.findUnique({
      where: { id: engagementId },
      select: { id: true, firmId: true },
    });

    if (!engagement || engagement.firmId !== firmId) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    const adjustments = await db.auditAdjustment.findMany({
      where: { engagementId },
      orderBy: { createdAt: "desc" },
    });

    res.json(adjustments);
  } catch (error: any) {
    console.error("Error fetching audit adjustments:", error);
    res.status(500).json({ error: "Failed to fetch adjustments" });
  }
});

export default router;
