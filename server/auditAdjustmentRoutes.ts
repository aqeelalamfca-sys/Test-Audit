import { Router, Response } from "express";
import { z } from "zod";
import { prisma } from "./db";
import { requireAuth, requireMinRole, logAuditTrail, AuthenticatedRequest } from "./auth";
import { validateEngagementAccess } from "./lib/validateEngagementAccess";


const router = Router();
const db = prisma as any;

const ADJUSTMENT_TYPES = ["CORRECTED", "UNCORRECTED", "RECLASSIFICATION", "DISCLOSURE"] as const;
const ADJUSTMENT_STATUSES = ["IDENTIFIED", "PROPOSED", "AGREED_POSTED", "AGREED_NOT_POSTED", "DISPUTED", "WAIVED"] as const;
const MISSTATEMENT_CLASSIFICATIONS = ["FACTUAL", "JUDGMENTAL", "PROJECTED"] as const;

const createSchema = z.object({
  engagementId: z.string().min(1),
  adjustmentType: z.enum(ADJUSTMENT_TYPES).default("CORRECTED"),
  misstatementClassification: z.enum(MISSTATEMENT_CLASSIFICATIONS).optional(),
  description: z.string().min(1, "Description is required"),
  reason: z.string().optional(),
  fsArea: z.string().optional(),
  debitAccountCode: z.string().optional(),
  debitAccountName: z.string().optional(),
  debitAmount: z.number().optional(),
  creditAccountCode: z.string().optional(),
  creditAccountName: z.string().optional(),
  creditAmount: z.number().optional(),
  isClearlyTrivial: z.boolean().default(false),
  trivialThresholdAmount: z.number().optional(),
  observationId: z.string().optional(),
  linkedProcedureId: z.string().optional(),
  linkedWorkpaperId: z.string().optional(),
  linkedEvidenceIds: z.array(z.string()).default([]),
});

const updateSchema = z.object({
  adjustmentType: z.enum(ADJUSTMENT_TYPES).optional(),
  misstatementClassification: z.enum(MISSTATEMENT_CLASSIFICATIONS).optional().nullable(),
  status: z.enum(ADJUSTMENT_STATUSES).optional(),
  description: z.string().min(1).optional(),
  auditImpact: z.string().optional().nullable(),
  fsArea: z.string().optional().nullable(),
  accountCode: z.string().optional().nullable(),
  accountName: z.string().optional().nullable(),
  debitAmount: z.number().optional().nullable(),
  creditAmount: z.number().optional().nullable(),
  isMaterial: z.boolean().optional(),
  isClearlyTrivial: z.boolean().optional(),
  trivialThresholdAmount: z.number().optional().nullable(),
  managementAccepted: z.boolean().optional().nullable(),
  managementResponse: z.string().optional().nullable(),
  sadNarrative: z.string().optional().nullable(),
  observationId: z.string().optional().nullable(),
  linkedProcedureId: z.string().optional().nullable(),
  linkedWorkpaperId: z.string().optional().nullable(),
  linkedEvidenceIds: z.array(z.string()).optional(),
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
            misstatementClassification: data.misstatementClassification || null,
            description: data.description,
            auditImpact: data.reason || null,
            accountCode: data.debitAccountCode || null,
            accountName: data.debitAccountName || null,
            fsArea: data.fsArea || journalMeta,
            debitAmount: data.debitAmount ?? null,
            creditAmount: data.creditAmount ?? null,
            netImpact: netImpact || null,
            isClearlyTrivial: data.isClearlyTrivial,
            trivialThresholdAmount: data.trivialThresholdAmount ?? null,
            observationId: data.observationId || null,
            linkedProcedureId: data.linkedProcedureId || null,
            linkedWorkpaperId: data.linkedWorkpaperId || null,
            linkedEvidenceIds: data.linkedEvidenceIds,
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

    await logAuditTrail(
      userId,
      "ADJUSTMENT_CREATED",
      "auditAdjustment",
      adjustment.id,
      null,
      adjustment,
      data.engagementId,
      `Adjustment ${adjustment.adjustmentRef} created (${data.adjustmentType})`,
      req.ip,
      req.get("user-agent")
    );

    res.status(201).json({ success: true, adjustment });
  } catch (error: any) {
    console.error("Error creating audit adjustment:", error);
    res.status(500).json({ error: "Failed to create adjustment" });
  }
});

router.get("/:engagementId/stats/summary", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) {
      return res.status(access.error === "User not associated with a firm" ? 400 : 404).json({ error: access.error });
    }

    const adjustments = await db.auditAdjustment.findMany({
      where: { engagementId: req.params.engagementId },
      select: {
        id: true,
        adjustmentRef: true,
        adjustmentType: true,
        status: true,
        misstatementClassification: true,
        description: true,
        debitAmount: true,
        creditAmount: true,
        netImpact: true,
        isMaterial: true,
        isClearlyTrivial: true,
        managementAccepted: true,
        managementResponse: true,
        sadNarrative: true,
        cumulativeEffect: true,
        observationId: true,
        linkedProcedureId: true,
        linkedWorkpaperId: true,
        linkedEvidenceIds: true,
        identifiedAt: true,
        reviewedAt: true,
        createdAt: true,
      },
    });

    let totalCorrected = 0, totalUncorrected = 0, totalReclassification = 0, totalDisclosure = 0;
    let correctedCount = 0, uncorrectedCount = 0, reclassificationCount = 0, disclosureCount = 0;
    let trivialCount = 0, materialCount = 0;
    let factualCount = 0, judgmentalCount = 0, projectedCount = 0;
    let acceptedCount = 0, disputedCount = 0, pendingCount = 0;
    let reviewedCount = 0, unreviewedCount = 0;
    let cumulativeNetImpact = 0;
    const byStatus: Record<string, number> = {};
    const byType: Record<string, number> = {};

    for (const adj of adjustments) {
      const net = Math.abs(Number(adj.netImpact) || 0);
      cumulativeNetImpact += Number(adj.netImpact) || 0;

      byStatus[adj.status] = (byStatus[adj.status] || 0) + 1;
      byType[adj.adjustmentType] = (byType[adj.adjustmentType] || 0) + 1;

      switch (adj.adjustmentType) {
        case "CORRECTED": correctedCount++; totalCorrected += net; break;
        case "UNCORRECTED": uncorrectedCount++; totalUncorrected += net; break;
        case "RECLASSIFICATION": reclassificationCount++; totalReclassification += net; break;
        case "DISCLOSURE": disclosureCount++; totalDisclosure += net; break;
      }

      if (adj.isClearlyTrivial) trivialCount++;
      if (adj.isMaterial) materialCount++;

      switch (adj.misstatementClassification) {
        case "FACTUAL": factualCount++; break;
        case "JUDGMENTAL": judgmentalCount++; break;
        case "PROJECTED": projectedCount++; break;
      }

      if (adj.managementAccepted === true) acceptedCount++;
      else if (adj.managementAccepted === false) disputedCount++;
      else pendingCount++;

      if (adj.reviewedAt) reviewedCount++;
      else unreviewedCount++;
    }

    let materiality = null;
    try {
      const matCalc = await db.materialityCalculation.findFirst({
        where: { engagementId: req.params.engagementId, isApproved: true },
        orderBy: { createdAt: "desc" },
        select: { overallMateriality: true, performanceMateriality: true, trivialThreshold: true },
      });
      if (matCalc) {
        materiality = {
          overall: Number(matCalc.overallMateriality) || 0,
          performance: Number(matCalc.performanceMateriality) || 0,
          trivial: Number(matCalc.trivialThreshold) || 0,
        };
      }
    } catch (_e) {}

    const hasSadSummary = adjustments.length > 0;

    res.json({
      total: adjustments.length,
      correctedCount, uncorrectedCount, reclassificationCount, disclosureCount,
      totalCorrected, totalUncorrected, totalReclassification, totalDisclosure,
      trivialCount, materialCount,
      factualCount, judgmentalCount, projectedCount,
      acceptedCount, disputedCount, pendingCount,
      reviewedCount, unreviewedCount,
      cumulativeNetImpact,
      byStatus, byType,
      materiality,
      hasSadSummary,
      adjustments,
    });
  } catch (error: any) {
    console.error("Error fetching adjustment stats:", error);
    res.status(500).json({ error: "Failed to fetch adjustment stats" });
  }
});

router.get("/:engagementId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firmId = req.user!.firmId;
    const { engagementId } = req.params;

    const access = await validateEngagementAccess(engagementId, firmId);
    if (!access.valid) {
      return res.status(access.error === "User not associated with a firm" ? 400 : 404).json({ error: access.error });
    }

    const adjustments = await db.auditAdjustment.findMany({
      where: { engagementId },
      orderBy: { createdAt: "desc" },
      include: {
        engagement: { select: { id: true, engagementCode: true } },
      },
    });

    res.json(adjustments);
  } catch (error: any) {
    console.error("Error fetching audit adjustments:", error);
    res.status(500).json({ error: "Failed to fetch adjustments" });
  }
});

router.get("/:engagementId/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) {
      return res.status(access.error === "User not associated with a firm" ? 400 : 404).json({ error: access.error });
    }

    const adjustment = await db.auditAdjustment.findUnique({
      where: { id: req.params.id },
    });

    if (!adjustment || adjustment.engagementId !== req.params.engagementId) {
      return res.status(404).json({ error: "Adjustment not found" });
    }

    res.json(adjustment);
  } catch (error: any) {
    console.error("Error fetching adjustment:", error);
    res.status(500).json({ error: "Failed to fetch adjustment" });
  }
});

router.patch("/:engagementId/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) {
      return res.status(access.error === "User not associated with a firm" ? 400 : 404).json({ error: access.error });
    }

    const existing = await db.auditAdjustment.findUnique({
      where: { id: req.params.id },
    });

    if (!existing || existing.engagementId !== req.params.engagementId) {
      return res.status(404).json({ error: "Adjustment not found" });
    }

    const data = updateSchema.parse(req.body);

    const updateData: any = { ...data };
    if (data.debitAmount !== undefined || data.creditAmount !== undefined) {
      const debit = data.debitAmount ?? (Number(existing.debitAmount) || 0);
      const credit = data.creditAmount ?? (Number(existing.creditAmount) || 0);
      updateData.netImpact = debit - credit;
    }

    const adjustment = await db.auditAdjustment.update({
      where: { id: req.params.id },
      data: updateData,
    });

    await logAuditTrail(
      req.user!.id,
      "ADJUSTMENT_UPDATED",
      "auditAdjustment",
      adjustment.id,
      existing,
      adjustment,
      req.params.engagementId,
      `Adjustment ${adjustment.adjustmentRef} updated`,
      req.ip,
      req.get("user-agent")
    );

    res.json(adjustment);
  } catch (error: any) {
    console.error("Error updating adjustment:", error);
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to update adjustment" });
  }
});

router.delete("/:engagementId/:id", requireAuth, requireMinRole("MANAGER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) {
      return res.status(access.error === "User not associated with a firm" ? 400 : 404).json({ error: access.error });
    }

    const existing = await db.auditAdjustment.findUnique({
      where: { id: req.params.id },
    });

    if (!existing || existing.engagementId !== req.params.engagementId) {
      return res.status(404).json({ error: "Adjustment not found" });
    }

    if (existing.status === "AGREED_POSTED") {
      return res.status(400).json({ error: "Cannot delete posted adjustments" });
    }

    await db.auditAdjustment.delete({ where: { id: req.params.id } });

    await logAuditTrail(
      req.user!.id,
      "ADJUSTMENT_DELETED",
      "auditAdjustment",
      req.params.id,
      existing,
      null,
      req.params.engagementId,
      `Adjustment ${existing.adjustmentRef} deleted`,
      req.ip,
      req.get("user-agent")
    );

    res.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting adjustment:", error);
    res.status(500).json({ error: "Failed to delete adjustment" });
  }
});

router.post("/:engagementId/:id/management-accept", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) {
      return res.status(access.error === "User not associated with a firm" ? 400 : 404).json({ error: access.error });
    }

    const { accepted, response } = z.object({
      accepted: z.boolean(),
      response: z.string().optional(),
    }).parse(req.body);

    const existing = await db.auditAdjustment.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.engagementId !== req.params.engagementId) {
      return res.status(404).json({ error: "Adjustment not found" });
    }

    const adjustment = await db.auditAdjustment.update({
      where: { id: req.params.id },
      data: {
        managementAccepted: accepted,
        managementResponse: response || null,
        managementResponseById: req.user!.id,
        managementResponseAt: new Date(),
        status: accepted ? "AGREED_POSTED" : "DISPUTED",
      },
    });

    await logAuditTrail(
      req.user!.id,
      accepted ? "ADJUSTMENT_ACCEPTED" : "ADJUSTMENT_DISPUTED",
      "auditAdjustment",
      adjustment.id,
      existing,
      adjustment,
      req.params.engagementId,
      `Adjustment ${adjustment.adjustmentRef} ${accepted ? "accepted" : "disputed"} by management`,
      req.ip,
      req.get("user-agent")
    );

    res.json(adjustment);
  } catch (error: any) {
    console.error("Error processing management acceptance:", error);
    res.status(500).json({ error: "Failed to process management acceptance" });
  }
});

router.post("/:engagementId/:id/review", requireAuth, requireMinRole("MANAGER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) {
      return res.status(access.error === "User not associated with a firm" ? 400 : 404).json({ error: access.error });
    }

    const existing = await db.auditAdjustment.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.engagementId !== req.params.engagementId) {
      return res.status(404).json({ error: "Adjustment not found" });
    }

    const adjustment = await db.auditAdjustment.update({
      where: { id: req.params.id },
      data: {
        reviewedById: req.user!.id,
        reviewedAt: new Date(),
        status: "PROPOSED",
      },
    });

    await logAuditTrail(
      req.user!.id,
      "ADJUSTMENT_REVIEWED",
      "auditAdjustment",
      adjustment.id,
      existing,
      adjustment,
      req.params.engagementId,
      `Adjustment ${adjustment.adjustmentRef} reviewed`,
      req.ip,
      req.get("user-agent")
    );

    res.json(adjustment);
  } catch (error: any) {
    console.error("Error reviewing adjustment:", error);
    res.status(500).json({ error: "Failed to review adjustment" });
  }
});

export default router;
