import { Router, Response } from "express";
import { z } from "zod";
import { prisma } from "./db";
import { requireAuth, requireMinRole, logAuditTrail, AuthenticatedRequest } from "./auth";
import { requirePhaseInProgress, preventDeletionAfterFinalization } from "./middleware/auditLock";
import { validateEngagementAccess } from "./lib/validateEngagementAccess";

const router = Router();
const db = prisma as any;



const OBSERVATION_TYPES = ["MISSTATEMENT", "CONTROL_DEFICIENCY", "MATERIAL_WEAKNESS", "SIGNIFICANT_DEFICIENCY", "AUDIT_FINDING", "PJE_RECLASS", "MANAGEMENT_POINT", "COMPLIANCE_ISSUE", "OTHER"] as const;
const OBSERVATION_STATUSES = ["OPEN", "UNDER_REVIEW", "MGMT_RESPONDED", "PENDING_CLEARANCE", "CLEARED", "ADJUSTED", "CARRIED_FORWARD", "WAIVED", "CLOSED"] as const;
const OBSERVATION_SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

const observationCreateSchema = z.object({
  observationRef: z.string().optional(),
  title: z.string().optional(),
  type: z.enum(OBSERVATION_TYPES).default("MISSTATEMENT"),
  severity: z.enum(OBSERVATION_SEVERITIES).default("MEDIUM"),
  fsHeadWorkingPaperId: z.string().optional(),
  fsHeadKey: z.string().optional(),
  fsHeadName: z.string().optional(),
  assertions: z.array(z.string()).default([]),
  isaReference: z.string().optional(),
  condition: z.string().min(1, "Condition is required"),
  criteria: z.string().optional(),
  cause: z.string().optional(),
  effect: z.string().optional(),
  effectAmount: z.union([z.number(), z.string()]).optional().transform(val => val !== undefined ? String(val) : undefined),
  effectQualitative: z.string().optional(),
  riskImplication: z.string().optional(),
  recommendation: z.string().optional(),
  proposedAction: z.string().optional(),
  proposedAdjustmentType: z.string().optional(),
  proposedDebitAccount: z.string().optional(),
  proposedDebitAmount: z.union([z.number(), z.string()]).optional().transform(val => val !== undefined ? String(val) : undefined),
  proposedCreditAccount: z.string().optional(),
  proposedCreditAmount: z.union([z.number(), z.string()]).optional().transform(val => val !== undefined ? String(val) : undefined),
  riskRatingAuto: z.string().optional(),
  riskRatingOverride: z.string().optional(),
  riskRatingReason: z.string().optional(),
  tolerableMisstatement: z.union([z.number(), z.string()]).optional().transform(val => val !== undefined ? String(val) : undefined),
  overallMateriality: z.union([z.number(), z.string()]).optional().transform(val => val !== undefined ? String(val) : undefined),
  materialityCompare: z.string().optional(),
  linkedProcedureId: z.string().optional(),
  linkedProcedureRef: z.string().optional(),
  linkedEvidenceIds: z.array(z.string()).default([]),
  linkedAdjustmentId: z.string().optional(),
  linkedControlDeficiencyId: z.string().optional(),
  includeInMgmtLetter: z.boolean().default(false),
  includeInMisstatementSummary: z.boolean().default(true),
});

const observationUpdateSchema = observationCreateSchema.partial().extend({
  status: z.enum(OBSERVATION_STATUSES).optional(),
});

const managementResponseSchema = z.object({
  managementResponse: z.string().min(1, "Management response is required"),
  managementAccepted: z.boolean().optional(),
});

const auditorConclusionSchema = z.object({
  auditorConclusion: z.string().min(1, "Auditor conclusion is required"),
});

const waiverSchema = z.object({
  waiverReason: z.string().min(1, "Waiver reason is required"),
});

router.get("/:engagementId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) {
      return res.status(access.error === "User not associated with a firm" ? 400 : 404).json({ error: access.error });
    }

    const { type, status, severity, fsHeadKey, includeInMgmtLetter, includeInMisstatementSummary } = req.query;

    const where: any = { engagementId: req.params.engagementId };

    if (type && OBSERVATION_TYPES.includes(type as any)) {
      where.type = type;
    }
    if (status && OBSERVATION_STATUSES.includes(status as any)) {
      where.status = status;
    }
    if (severity && OBSERVATION_SEVERITIES.includes(severity as any)) {
      where.severity = severity;
    }
    if (fsHeadKey) {
      where.fsHeadKey = fsHeadKey;
    }
    if (includeInMgmtLetter === "true") {
      where.includeInMgmtLetter = true;
    }
    if (includeInMisstatementSummary === "true") {
      where.includeInMisstatementSummary = true;
    }

    const observations = await db.observation.findMany({
      where,
      include: {
        identifiedBy: { select: { id: true, fullName: true, role: true } },
        reviewedBy: { select: { id: true, fullName: true, role: true } },
        clearedBy: { select: { id: true, fullName: true, role: true } },
        partnerApprovedBy: { select: { id: true, fullName: true, role: true } },
        waivedBy: { select: { id: true, fullName: true, role: true } },
        auditorConclusionBy: { select: { id: true, fullName: true, role: true } },
        fsHeadWorkingPaper: { select: { id: true, fsHeadKey: true, fsHeadName: true } },
      },
      orderBy: [{ identifiedAt: "desc" }, { createdAt: "desc" }],
    });

    res.json(observations);
  } catch (error: any) {
    console.error("Error fetching observations:", error);
    res.status(500).json({ error: "Failed to fetch observations", details: error.message });
  }
});

router.get("/:engagementId/summary", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) {
      return res.status(access.error === "User not associated with a firm" ? 400 : 404).json({ error: access.error });
    }

    const observations = await db.observation.findMany({
      where: { engagementId: req.params.engagementId },
      select: {
        id: true,
        type: true,
        status: true,
        severity: true,
        effectAmount: true,
        fsHeadKey: true,
        includeInMgmtLetter: true,
        includeInMisstatementSummary: true,
      },
    });

    const byType: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    const byFsHead: Record<string, number> = {};
    let totalEffectAmount = 0;
    let openCount = 0;
    let clearedCount = 0;
    let waivedCount = 0;
    let mgmtLetterCount = 0;
    let misstatementSummaryCount = 0;

    for (const obs of observations) {
      byType[obs.type] = (byType[obs.type] || 0) + 1;
      byStatus[obs.status] = (byStatus[obs.status] || 0) + 1;
      bySeverity[obs.severity] = (bySeverity[obs.severity] || 0) + 1;
      
      if (obs.fsHeadKey) {
        byFsHead[obs.fsHeadKey] = (byFsHead[obs.fsHeadKey] || 0) + 1;
      }

      if (obs.effectAmount) {
        totalEffectAmount += Number(obs.effectAmount);
      }

      if (obs.status === "OPEN" || obs.status === "UNDER_REVIEW") {
        openCount++;
      }
      if (obs.status === "CLEARED") {
        clearedCount++;
      }
      if (obs.status === "WAIVED") {
        waivedCount++;
      }
      if (obs.includeInMgmtLetter) {
        mgmtLetterCount++;
      }
      if (obs.includeInMisstatementSummary) {
        misstatementSummaryCount++;
      }
    }

    res.json({
      total: observations.length,
      openCount,
      clearedCount,
      waivedCount,
      totalEffectAmount,
      mgmtLetterCount,
      misstatementSummaryCount,
      byType,
      byStatus,
      bySeverity,
      byFsHead,
    });
  } catch (error: any) {
    console.error("Error fetching observation summary:", error);
    res.status(500).json({ error: "Failed to fetch observation summary", details: error.message });
  }
});

router.get("/:engagementId/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) {
      return res.status(access.error === "User not associated with a firm" ? 400 : 404).json({ error: access.error });
    }

    const observation = await db.observation.findUnique({
      where: { id: req.params.id },
      include: {
        identifiedBy: { select: { id: true, fullName: true, role: true } },
        reviewedBy: { select: { id: true, fullName: true, role: true } },
        clearedBy: { select: { id: true, fullName: true, role: true } },
        partnerApprovedBy: { select: { id: true, fullName: true, role: true } },
        waivedBy: { select: { id: true, fullName: true, role: true } },
        auditorConclusionBy: { select: { id: true, fullName: true, role: true } },
        fsHeadWorkingPaper: { select: { id: true, fsHeadKey: true, fsHeadName: true, status: true } },
        evidence: true,
      },
    });

    if (!observation || observation.engagementId !== req.params.engagementId) {
      return res.status(404).json({ error: "Observation not found" });
    }

    res.json(observation);
  } catch (error: any) {
    console.error("Error fetching observation:", error);
    res.status(500).json({ error: "Failed to fetch observation", details: error.message });
  }
});

router.post("/:engagementId", requireAuth, requirePhaseInProgress("EXECUTION"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) {
      return res.status(access.error === "User not associated with a firm" ? 400 : 404).json({ error: access.error });
    }

    const data = observationCreateSchema.parse(req.body);

    const existingCount = await db.observation.count({
      where: { engagementId: req.params.engagementId },
    });
    
    const observationRef = data.observationRef || `OBS-${String(existingCount + 1).padStart(4, "0")}`;

    const observation = await db.observation.create({
      data: {
        ...data,
        observationRef,
        engagementId: req.params.engagementId,
        identifiedById: req.user!.id,
        identifiedAt: new Date(),
      },
      include: {
        identifiedBy: { select: { id: true, fullName: true, role: true } },
        fsHeadWorkingPaper: { select: { id: true, fsHeadKey: true, fsHeadName: true } },
      },
    });

    await logAuditTrail(
      req.user!.id,
      "OBSERVATION_CREATED",
      "observation",
      observation.id,
      null,
      observation,
      req.params.engagementId,
      `Observation ${observationRef} created`,
      req.ip,
      req.get("user-agent")
    );

    res.status(201).json(observation);
  } catch (error: any) {
    console.error("Error creating observation:", error);
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to create observation", details: error.message });
  }
});

router.patch("/:engagementId/:id", requireAuth, requirePhaseInProgress("EXECUTION"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) {
      return res.status(access.error === "User not associated with a firm" ? 400 : 404).json({ error: access.error });
    }

    const existing = await db.observation.findUnique({
      where: { id: req.params.id },
    });

    if (!existing || existing.engagementId !== req.params.engagementId) {
      return res.status(404).json({ error: "Observation not found" });
    }

    const data = observationUpdateSchema.parse(req.body);

    const observation = await db.observation.update({
      where: { id: req.params.id },
      data,
      include: {
        identifiedBy: { select: { id: true, fullName: true, role: true } },
        reviewedBy: { select: { id: true, fullName: true, role: true } },
        clearedBy: { select: { id: true, fullName: true, role: true } },
        partnerApprovedBy: { select: { id: true, fullName: true, role: true } },
        waivedBy: { select: { id: true, fullName: true, role: true } },
        fsHeadWorkingPaper: { select: { id: true, fsHeadKey: true, fsHeadName: true } },
      },
    });

    await logAuditTrail(
      req.user!.id,
      "OBSERVATION_UPDATED",
      "observation",
      observation.id,
      existing,
      observation,
      req.params.engagementId,
      `Observation ${observation.observationRef} updated`,
      req.ip,
      req.get("user-agent")
    );

    res.json(observation);
  } catch (error: any) {
    console.error("Error updating observation:", error);
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to update observation", details: error.message });
  }
});

router.delete("/:engagementId/:id", requireAuth, requireMinRole("MANAGER"), preventDeletionAfterFinalization(), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) {
      return res.status(access.error === "User not associated with a firm" ? 400 : 404).json({ error: access.error });
    }

    const existing = await db.observation.findUnique({
      where: { id: req.params.id },
    });

    if (!existing || existing.engagementId !== req.params.engagementId) {
      return res.status(404).json({ error: "Observation not found" });
    }

    if (existing.status === "CLEARED" || existing.status === "CLOSED") {
      return res.status(400).json({ error: "Cannot delete cleared or closed observations" });
    }

    await db.observation.delete({
      where: { id: req.params.id },
    });

    await logAuditTrail(
      req.user!.id,
      "OBSERVATION_DELETED",
      "observation",
      req.params.id,
      existing,
      null,
      req.params.engagementId,
      `Observation ${existing.observationRef} deleted`,
      req.ip,
      req.get("user-agent")
    );

    res.json({ success: true, message: "Observation deleted" });
  } catch (error: any) {
    console.error("Error deleting observation:", error);
    res.status(500).json({ error: "Failed to delete observation", details: error.message });
  }
});

router.post("/:engagementId/:id/management-response", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) {
      return res.status(access.error === "User not associated with a firm" ? 400 : 404).json({ error: access.error });
    }

    const existing = await db.observation.findUnique({
      where: { id: req.params.id },
    });

    if (!existing || existing.engagementId !== req.params.engagementId) {
      return res.status(404).json({ error: "Observation not found" });
    }

    const data = managementResponseSchema.parse(req.body);

    const observation = await db.observation.update({
      where: { id: req.params.id },
      data: {
        managementResponse: data.managementResponse,
        managementAccepted: data.managementAccepted,
        managementRespondedById: req.user!.id,
        managementRespondedAt: new Date(),
        status: "MGMT_RESPONDED",
      },
      include: {
        identifiedBy: { select: { id: true, fullName: true, role: true } },
        reviewedBy: { select: { id: true, fullName: true, role: true } },
      },
    });

    await logAuditTrail(
      req.user!.id,
      "OBSERVATION_MGMT_RESPONSE",
      "observation",
      observation.id,
      existing,
      observation,
      req.params.engagementId,
      `Management response added to observation ${observation.observationRef}`,
      req.ip,
      req.get("user-agent")
    );

    res.json(observation);
  } catch (error: any) {
    console.error("Error adding management response:", error);
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to add management response", details: error.message });
  }
});

router.post("/:engagementId/:id/auditor-conclusion", requireAuth, requireMinRole("SENIOR"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) {
      return res.status(access.error === "User not associated with a firm" ? 400 : 404).json({ error: access.error });
    }

    const existing = await db.observation.findUnique({
      where: { id: req.params.id },
    });

    if (!existing || existing.engagementId !== req.params.engagementId) {
      return res.status(404).json({ error: "Observation not found" });
    }

    const data = auditorConclusionSchema.parse(req.body);

    const observation = await db.observation.update({
      where: { id: req.params.id },
      data: {
        auditorConclusion: data.auditorConclusion,
        auditorConclusionById: req.user!.id,
        auditorConclusionAt: new Date(),
        status: "UNDER_REVIEW",
        reviewedById: req.user!.id,
        reviewedAt: new Date(),
      },
      include: {
        identifiedBy: { select: { id: true, fullName: true, role: true } },
        reviewedBy: { select: { id: true, fullName: true, role: true } },
        auditorConclusionBy: { select: { id: true, fullName: true, role: true } },
      },
    });

    await logAuditTrail(
      req.user!.id,
      "OBSERVATION_AUDITOR_CONCLUSION",
      "observation",
      observation.id,
      existing,
      observation,
      req.params.engagementId,
      `Auditor conclusion added to observation ${observation.observationRef}`,
      req.ip,
      req.get("user-agent")
    );

    res.json(observation);
  } catch (error: any) {
    console.error("Error adding auditor conclusion:", error);
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to add auditor conclusion", details: error.message });
  }
});

router.post("/:engagementId/:id/clear", requireAuth, requireMinRole("MANAGER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) {
      return res.status(access.error === "User not associated with a firm" ? 400 : 404).json({ error: access.error });
    }

    const existing = await db.observation.findUnique({
      where: { id: req.params.id },
    });

    if (!existing || existing.engagementId !== req.params.engagementId) {
      return res.status(404).json({ error: "Observation not found" });
    }

    if (existing.status === "WAIVED") {
      return res.status(400).json({ error: "Cannot clear a waived observation" });
    }

    const observation = await db.observation.update({
      where: { id: req.params.id },
      data: {
        status: "CLEARED",
        clearedById: req.user!.id,
        clearedAt: new Date(),
      },
      include: {
        identifiedBy: { select: { id: true, fullName: true, role: true } },
        reviewedBy: { select: { id: true, fullName: true, role: true } },
        clearedBy: { select: { id: true, fullName: true, role: true } },
      },
    });

    await logAuditTrail(
      req.user!.id,
      "OBSERVATION_CLEARED",
      "observation",
      observation.id,
      existing,
      observation,
      req.params.engagementId,
      `Observation ${observation.observationRef} cleared`,
      req.ip,
      req.get("user-agent")
    );

    res.json(observation);
  } catch (error: any) {
    console.error("Error clearing observation:", error);
    res.status(500).json({ error: "Failed to clear observation", details: error.message });
  }
});

router.post("/:engagementId/:id/waive", requireAuth, requireMinRole("PARTNER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) {
      return res.status(access.error === "User not associated with a firm" ? 400 : 404).json({ error: access.error });
    }

    const existing = await db.observation.findUnique({
      where: { id: req.params.id },
    });

    if (!existing || existing.engagementId !== req.params.engagementId) {
      return res.status(404).json({ error: "Observation not found" });
    }

    if (existing.status === "CLEARED" || existing.status === "CLOSED") {
      return res.status(400).json({ error: "Cannot waive a cleared or closed observation" });
    }

    const data = waiverSchema.parse(req.body);

    const observation = await db.observation.update({
      where: { id: req.params.id },
      data: {
        status: "WAIVED",
        waivedById: req.user!.id,
        waivedAt: new Date(),
        waiverReason: data.waiverReason,
        partnerApprovedWaiver: true,
        partnerApprovedById: req.user!.id,
        partnerApprovedAt: new Date(),
      },
      include: {
        identifiedBy: { select: { id: true, fullName: true, role: true } },
        reviewedBy: { select: { id: true, fullName: true, role: true } },
        waivedBy: { select: { id: true, fullName: true, role: true } },
        partnerApprovedBy: { select: { id: true, fullName: true, role: true } },
      },
    });

    await logAuditTrail(
      req.user!.id,
      "OBSERVATION_WAIVED",
      "observation",
      observation.id,
      existing,
      observation,
      req.params.engagementId,
      `Observation ${observation.observationRef} waived by partner: ${data.waiverReason}`,
      req.ip,
      req.get("user-agent")
    );

    res.json(observation);
  } catch (error: any) {
    console.error("Error waiving observation:", error);
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to waive observation", details: error.message });
  }
});

router.post("/:engagementId/:id/review", requireAuth, requireMinRole("SENIOR"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) {
      return res.status(access.error === "User not associated with a firm" ? 400 : 404).json({ error: access.error });
    }

    const existing = await db.observation.findUnique({
      where: { id: req.params.id },
    });

    if (!existing || existing.engagementId !== req.params.engagementId) {
      return res.status(404).json({ error: "Observation not found" });
    }

    if (existing.status !== "OPEN") {
      return res.status(400).json({ error: "Only OPEN observations can be submitted for review" });
    }

    const observation = await db.observation.update({
      where: { id: req.params.id },
      data: {
        status: "UNDER_REVIEW",
        reviewedById: req.user!.id,
        reviewedAt: new Date(),
      },
      include: {
        identifiedBy: { select: { id: true, fullName: true, role: true } },
        reviewedBy: { select: { id: true, fullName: true, role: true } },
        fsHeadWorkingPaper: { select: { id: true, fsHeadKey: true, fsHeadName: true } },
      },
    });

    await logAuditTrail(
      req.user!.id,
      "OBSERVATION_SUBMITTED_FOR_REVIEW",
      "observation",
      observation.id,
      existing,
      observation,
      req.params.engagementId,
      `Observation ${observation.observationRef} submitted for review`,
      req.ip,
      req.get("user-agent")
    );

    res.json(observation);
  } catch (error: any) {
    console.error("Error submitting observation for review:", error);
    res.status(500).json({ error: "Failed to submit observation for review", details: error.message });
  }
});

const autoCreateSchema = z.object({
  engagementId: z.string().uuid(),
  includeReconciliationMismatches: z.boolean().default(true),
  includeControlAccountDifferences: z.boolean().default(true),
  includeDataQualityIssues: z.boolean().default(true),
  includeMappingExceptions: z.boolean().default(true),
  materialityThreshold: z.number().optional(),
});

async function determineSeverity(amount: number, materialityThreshold?: number): Promise<"LOW" | "MEDIUM" | "HIGH" | "CRITICAL"> {
  if (!materialityThreshold || materialityThreshold <= 0) {
    if (amount > 1000000) return "CRITICAL";
    if (amount > 100000) return "HIGH";
    if (amount > 10000) return "MEDIUM";
    return "LOW";
  }
  
  const percentOfMateriality = (amount / materialityThreshold) * 100;
  if (percentOfMateriality >= 100) return "CRITICAL";
  if (percentOfMateriality >= 50) return "HIGH";
  if (percentOfMateriality >= 25) return "MEDIUM";
  return "LOW";
}

router.post("/auto-create-from-exceptions", requireAuth, requireMinRole("SENIOR"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = autoCreateSchema.parse(req.body);
    
    const access = await validateEngagementAccess(data.engagementId, req.user!.firmId);
    if (!access.valid) {
      return res.status(access.error === "User not associated with a firm" ? 400 : 404).json({ error: access.error });
    }

    const createdObservations: any[] = [];
    let autoRefCounter = 1;

    const existingAutoCount = await db.observation.count({
      where: {
        engagementId: data.engagementId,
        observationRef: { startsWith: "OBS-AUTO-" },
      },
    });
    autoRefCounter = existingAutoCount + 1;

    const generateAutoRef = () => {
      const ref = `OBS-AUTO-${String(autoRefCounter).padStart(3, "0")}`;
      autoRefCounter++;
      return ref;
    };

    if (data.includeReconciliationMismatches) {
      const reconciliations = await db.tBReconciliation.findMany({
        where: {
          engagementId: data.engagementId,
          isResolved: false,
        },
        include: {
          tbEntry: { select: { accountCode: true, accountName: true } },
        },
      });

      for (const recon of reconciliations) {
        const diffAmount = Math.abs(Number(recon.varianceAmount) || 0);
        if (diffAmount === 0) continue;

        const existingObs = await db.observation.findFirst({
          where: {
            engagementId: data.engagementId,
            linkedProcedureRef: `RECON-${recon.id}`,
          },
        });

        if (!existingObs) {
          const severity = await determineSeverity(diffAmount, data.materialityThreshold);
          const obs = await db.observation.create({
            data: {
              engagementId: data.engagementId,
              observationRef: generateAutoRef(),
              type: "MISSTATEMENT",
              severity,
              status: "OPEN",
              condition: `Reconciliation mismatch detected: TB vs GL difference of ${diffAmount.toLocaleString()} for account ${recon.tbEntry?.accountCode || recon.accountCode || "Unknown"} (${recon.tbEntry?.accountName || "Unknown"})`,
              criteria: "TB amounts should reconcile with GL totals",
              effect: `Potential misstatement of ${diffAmount.toLocaleString()}`,
              effectAmount: diffAmount.toString(),
              linkedProcedureRef: `RECON-${recon.id}`,
              identifiedById: req.user!.id,
              identifiedAt: new Date(),
              includeInMisstatementSummary: true,
            },
          });
          createdObservations.push(obs);
        }
      }
    }

    if (data.includeControlAccountDifferences) {
      const controlDiffs = await db.tBReconciliation.findMany({
        where: {
          engagementId: data.engagementId,
          reconciliationType: { in: ["CONTROL_TO_SUBLEDGER", "AP_SUBLEDGER", "AR_SUBLEDGER", "BANK_RECON"] },
          isResolved: false,
        },
        include: {
          tbEntry: { select: { accountCode: true, accountName: true } },
        },
      });

      for (const diff of controlDiffs) {
        const diffAmount = Math.abs(Number(diff.varianceAmount) || 0);
        if (diffAmount === 0) continue;

        const existingObs = await db.observation.findFirst({
          where: {
            engagementId: data.engagementId,
            linkedProcedureRef: `CONTROL-${diff.id}`,
          },
        });

        if (!existingObs) {
          const severity = await determineSeverity(diffAmount, data.materialityThreshold);
          const obs = await db.observation.create({
            data: {
              engagementId: data.engagementId,
              observationRef: generateAutoRef(),
              type: "CONTROL_DEFICIENCY",
              severity,
              status: "OPEN",
              condition: `Control account difference: ${diff.reconciliationType} shows difference of ${diffAmount.toLocaleString()} for account ${diff.tbEntry?.accountCode || diff.accountCode || "Unknown"}`,
              criteria: "Control account balances should agree with underlying subledgers",
              cause: "Potential timing difference, unrecorded transactions, or control breakdown",
              effect: `Control account variance of ${diffAmount.toLocaleString()}`,
              effectAmount: diffAmount.toString(),
              linkedProcedureRef: `CONTROL-${diff.id}`,
              identifiedById: req.user!.id,
              identifiedAt: new Date(),
              includeInMgmtLetter: true,
            },
          });
          createdObservations.push(obs);
        }
      }
    }

    if (data.includeDataQualityIssues) {
      const validationErrors = await db.tBValidationError.findMany({
        where: {
          batch: { engagementId: data.engagementId },
          isResolved: false,
          isBlocking: true,
        },
        include: {
          entry: { select: { accountCode: true, accountName: true } },
        },
      });

      for (const error of validationErrors) {
        const existingObs = await db.observation.findFirst({
          where: {
            engagementId: data.engagementId,
            linkedProcedureRef: `DATAERR-${error.id}`,
          },
        });

        if (!existingObs) {
          const obs = await db.observation.create({
            data: {
              engagementId: data.engagementId,
              observationRef: generateAutoRef(),
              type: "OTHER",
              severity: error.isBlocking ? "HIGH" : "MEDIUM",
              status: "OPEN",
              condition: `Data quality issue detected: ${error.errorType} - ${error.errorMessage || "Validation failed"} for account ${error.entry?.accountCode || "Unknown"}`,
              criteria: "Financial data should meet quality standards with no missing mandatory fields or duplicates",
              effect: "Data integrity concern affecting reliability of financial information",
              linkedProcedureRef: `DATAERR-${error.id}`,
              identifiedById: req.user!.id,
              identifiedAt: new Date(),
            },
          });
          createdObservations.push(obs);
        }
      }

      const glValidationErrors = await db.gLValidationError.findMany({
        where: {
          batch: { engagementId: data.engagementId },
          isResolved: false,
        },
        include: {
          entry: { select: { accountCode: true, description: true } },
        },
      });

      for (const error of glValidationErrors) {
        const existingObs = await db.observation.findFirst({
          where: {
            engagementId: data.engagementId,
            linkedProcedureRef: `GLERR-${error.id}`,
          },
        });

        if (!existingObs) {
          const obs = await db.observation.create({
            data: {
              engagementId: data.engagementId,
              observationRef: generateAutoRef(),
              type: "OTHER",
              severity: "MEDIUM",
              status: "OPEN",
              condition: `GL data quality issue: ${error.errorType} - ${error.errorMessage || "Validation failed"} for entry ${error.entry?.accountCode || "Unknown"}`,
              criteria: "General ledger entries should be complete and balanced",
              effect: "Data quality concern in general ledger",
              linkedProcedureRef: `GLERR-${error.id}`,
              identifiedById: req.user!.id,
              identifiedAt: new Date(),
            },
          });
          createdObservations.push(obs);
        }
      }
    }

    if (data.includeMappingExceptions) {
      const unmappedItems = await db.tBEntry.findMany({
        where: {
          engagementId: data.engagementId,
          closingBalance: { not: 0 },
        },
        take: 50,
      }).catch(() => [] as any[]);

      for (const item of unmappedItems) {
        const amount = Math.abs(Number(item.closingBalance) || 0);
        if (data.materialityThreshold && amount < data.materialityThreshold * 0.05) continue;

        const existingObs = await db.observation.findFirst({
          where: {
            engagementId: data.engagementId,
            linkedProcedureRef: `UNMAPPED-${item.id}`,
          },
        });

        if (!existingObs) {
          const severity = await determineSeverity(amount, data.materialityThreshold);
          const obs = await db.observation.create({
            data: {
              engagementId: data.engagementId,
              observationRef: generateAutoRef(),
              type: "OTHER",
              severity,
              status: "OPEN",
              condition: `Unmapped account with material balance: Account ${item.accountCode} (${item.accountName || "No Name"}) has closing balance of ${amount.toLocaleString()} but is not mapped to any FS Head`,
              criteria: "All material account balances should be mapped to appropriate FS line items",
              effect: `Potential classification error affecting ${amount.toLocaleString()} in financial statements`,
              effectAmount: amount.toString(),
              linkedProcedureRef: `UNMAPPED-${item.id}`,
              identifiedById: req.user!.id,
              identifiedAt: new Date(),
            },
          });
          createdObservations.push(obs);
        }
      }
    }

    await logAuditTrail(
      req.user!.id,
      "OBSERVATIONS_AUTO_CREATED",
      "observation",
      undefined,
      null,
      { count: createdObservations.length },
      data.engagementId,
      `Auto-created ${createdObservations.length} observations from detected exceptions`,
      req.ip,
      req.get("user-agent")
    );

    res.status(201).json({
      success: true,
      createdCount: createdObservations.length,
      observations: createdObservations,
    });
  } catch (error: any) {
    console.error("Error auto-creating observations from exceptions:", error);
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to auto-create observations", details: error.message });
  }
});

export default router;
