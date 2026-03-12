import { Router, type Response } from "express";
import { prisma } from "../db";
import { requireAuth, requireMinRole, type AuthenticatedRequest } from "../auth";
import { z } from "zod";

const router = Router();

const checklistItemSchema = z.object({
  ref: z.string(),
  description: z.string(),
  status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED", "NOT_APPLICABLE"]).default("PENDING"),
  notes: z.string().optional(),
  evidence: z.string().optional(),
  lawRegulation: z.string().optional(),
  sectionRule: z.string().optional(),
  applicability: z.string().optional(),
  complianceRequirement: z.string().optional(),
  complianceStatus: z.string().optional(),
  remarks: z.string().optional(),
});

const ALLOWED_CHECKLIST_TYPES = [
  "COMPANIES_ACT_2017",
  "FBR_TAX_COMPLIANCE",
  "FBR_WHT_RECONCILIATION",
  "FBR_NTN_VERIFICATION",
  "SECP_COMPLIANCE",
  "SECP_XBRL_READINESS",
  "ISA_DOCUMENTATION",
  "ISQM_QUALITY_CONTROL",
  "CUSTOM",
] as const;

const upsertChecklistSchema = z.object({
  checklistType: z.enum(ALLOWED_CHECKLIST_TYPES),
  checklistReference: z.string().min(1),
  items: z.array(checklistItemSchema),
});

router.get("/:engagementId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(400).json({ error: "User not associated with a firm" });

    const engagement = await prisma.engagement.findFirst({
      where: { id: engagementId, firmId },
      select: { id: true },
    });
    if (!engagement) return res.status(404).json({ error: "Engagement not found" });

    const checklists = await prisma.complianceChecklist.findMany({
      where: { engagementId },
      include: {
        preparedBy: { select: { id: true, fullName: true } },
        reviewedBy: { select: { id: true, fullName: true } },
        partnerApprovedBy: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    res.json(checklists);
  } catch (error) {
    console.error("Get compliance checklists error:", error);
    res.status(500).json({ error: "Failed to fetch compliance checklists" });
  }
});

router.post("/:engagementId", requireAuth, requireMinRole("SENIOR"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(400).json({ error: "User not associated with a firm" });

    const engagement = await prisma.engagement.findFirst({
      where: { id: engagementId, firmId },
      select: { id: true },
    });
    if (!engagement) return res.status(404).json({ error: "Engagement not found" });

    const data = upsertChecklistSchema.parse(req.body);

    const totalItems = data.items.length;
    const completedItems = data.items.filter((i) => i.status === "COMPLETED").length;
    const notApplicableItems = data.items.filter((i) => i.status === "NOT_APPLICABLE").length;
    const isComplete = totalItems > 0 && completedItems + notApplicableItems === totalItems;

    const checklist = await prisma.complianceChecklist.upsert({
      where: {
        engagementId_checklistType: {
          engagementId,
          checklistType: data.checklistType,
        },
      },
      create: {
        engagementId,
        checklistType: data.checklistType,
        checklistReference: data.checklistReference,
        items: data.items as any,
        totalItems,
        completedItems,
        notApplicableItems,
        isComplete,
        preparedById: req.user!.id,
        preparedDate: new Date(),
      },
      update: {
        checklistReference: data.checklistReference,
        items: data.items as any,
        totalItems,
        completedItems,
        notApplicableItems,
        isComplete,
        updatedAt: new Date(),
      },
      include: {
        preparedBy: { select: { id: true, fullName: true } },
        reviewedBy: { select: { id: true, fullName: true } },
        partnerApprovedBy: { select: { id: true, fullName: true } },
      },
    });

    res.status(200).json(checklist);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    console.error("Save compliance checklist error:", error);
    res.status(500).json({ error: "Failed to save compliance checklist" });
  }
});

router.get("/:engagementId/export", requireAuth, requireMinRole("MANAGER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(400).json({ error: "User not associated with a firm" });

    const engagement = await prisma.engagement.findFirst({
      where: { id: engagementId, firmId },
      include: {
        client: { select: { name: true } },
        firm: { select: { name: true } },
      },
    });
    if (!engagement) return res.status(404).json({ error: "Engagement not found" });

    const checklists = await prisma.complianceChecklist.findMany({
      where: { engagementId },
      include: {
        preparedBy: { select: { fullName: true } },
        reviewedBy: { select: { fullName: true } },
        partnerApprovedBy: { select: { fullName: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    const exportData = {
      exportedAt: new Date().toISOString(),
      firm: engagement.firm?.name ?? null,
      client: engagement.client?.name ?? null,
      engagementCode: engagement.engagementCode,
      periodStart: engagement.periodStart,
      periodEnd: engagement.periodEnd,
      checklists: checklists.map((cl) => ({
        type: cl.checklistType,
        reference: cl.checklistReference,
        totalItems: cl.totalItems,
        completedItems: cl.completedItems,
        notApplicableItems: cl.notApplicableItems,
        isComplete: cl.isComplete,
        preparedBy: cl.preparedBy?.fullName ?? null,
        preparedDate: cl.preparedDate,
        reviewedBy: cl.reviewedBy?.fullName ?? null,
        reviewedDate: cl.reviewedDate,
        partnerApprovedBy: cl.partnerApprovedBy?.fullName ?? null,
        partnerApprovalDate: cl.partnerApprovalDate,
        items: cl.items,
      })),
    };

    res.json(exportData);
  } catch (error) {
    console.error("Export compliance checklists error:", error);
    res.status(500).json({ error: "Failed to export compliance checklists" });
  }
});

export default router;
