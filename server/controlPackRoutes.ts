import { Router, Response } from "express";
import { prisma } from "./db";
import { requireAuth, requireMinRole, logAuditTrail, type AuthenticatedRequest } from "./auth";
import { z } from "zod";
import type { MaterialitySetStatus, AuditPlanStatus, ProcedureStatus, SamplingFrameStatus, ExecutionResultStatus, LockGateStatus } from "@prisma/client";

const router = Router();

const createMaterialitySetSchema = z.object({
  benchmarkType: z.string().min(1),
  benchmarkAmount: z.number().positive(),
  percentApplied: z.number().min(0.1).max(100),
  overallMateriality: z.number().positive(),
  performanceMateriality: z.number().positive(),
  trivialThreshold: z.number().positive(),
  specificMateriality: z.record(z.any()).optional(),
  rationale: z.string().optional(),
});

const updateMaterialitySetSchema = createMaterialitySetSchema.partial();

const createAuditPlanSchema = z.object({
  materialitySetId: z.string().uuid().optional(),
  mappingVersionId: z.string().optional(),
  auditApproach: z.enum(["SUBSTANTIVE_ONLY", "CONTROLS_AND_SUBSTANTIVE", "COMBINED"]).default("SUBSTANTIVE_ONLY"),
  auditTiming: z.enum(["INTERIM", "FINAL", "BOTH"]).default("FINAL"),
  scopeDescription: z.string().optional(),
  staffingPlan: z.record(z.any()).optional(),
  relianceOnControls: z.boolean().default(false),
  relianceOnInternalAudit: z.boolean().default(false),
  relianceOnExperts: z.boolean().default(false),
  relianceOnIT: z.boolean().default(false),
  relianceDetails: z.record(z.any()).optional(),
  interimStartDate: z.string().optional(),
  interimEndDate: z.string().optional(),
  finalStartDate: z.string().optional(),
  finalEndDate: z.string().optional(),
  reportDeadline: z.string().optional(),
  milestoneDates: z.record(z.any()).optional(),
});

const updateAuditPlanSchema = createAuditPlanSchema.partial();

const createProcedureMatrixSchema = z.object({
  auditPlanId: z.string().uuid().optional(),
  riskAssessmentId: z.string().uuid().optional(),
  fsHeadKey: z.string().optional(),
  glCodeSet: z.array(z.string()).default([]),
  procedureLibraryCode: z.string().optional(),
  procedureName: z.string().min(1),
  procedureDescription: z.string().optional(),
  procedureType: z.enum(["TEST_OF_DETAILS", "TEST_OF_CONTROLS", "ANALYTICAL_PROCEDURE", "INQUIRY", "OBSERVATION", "INSPECTION", "RECALCULATION", "REPERFORMANCE", "CONFIRMATION"]).default("TEST_OF_DETAILS"),
  assertions: z.array(z.string()).default([]),
  populationDefinition: z.record(z.any()).optional(),
  populationFilters: z.record(z.any()).optional(),
  evidenceRequiredChecklist: z.record(z.any()).optional(),
  assignedToId: z.string().uuid().optional(),
  dueDate: z.string().optional(),
});

const updateProcedureMatrixSchema = createProcedureMatrixSchema.partial();

const bulkCreateProceduresSchema = z.object({
  auditPlanId: z.string().uuid().optional(),
  riskAssessmentIds: z.array(z.string().uuid()),
  procedures: z.array(createProcedureMatrixSchema),
});

const createSamplingFrameSchema = z.object({
  procedureId: z.string().uuid().optional(),
  samplingRunId: z.string().uuid().optional(),
  frameName: z.string().min(1),
  populationSource: z.string().min(1),
  populationGLCodes: z.array(z.string()).default([]),
  populationFilters: z.record(z.any()).optional(),
  stratificationRules: z.record(z.any()).optional(),
  samplingMethod: z.string().optional(),
  confidenceLevel: z.number().min(0).max(100).optional(),
  tolerableError: z.number().optional(),
  expectedError: z.number().optional(),
});

const updateSamplingFrameSchema = createSamplingFrameSchema.partial();

const generateSampleSchema = z.object({
  sampleSize: z.number().int().positive(),
  samplingMethod: z.enum(["RANDOM", "MUS", "SYSTEMATIC", "HAPHAZARD"]).default("RANDOM"),
  randomSeed: z.number().int().optional(),
});

const createExecutionResultSchema = z.object({
  procedureId: z.string().uuid().optional(),
  samplingFrameId: z.string().uuid().optional(),
  samplingItemId: z.string().optional(),
  fsHeadKey: z.string().optional(),
  glCode: z.string().optional(),
  resultType: z.enum(["TEST_OF_DETAILS", "TEST_OF_CONTROLS", "JOURNAL_ENTRY_TESTING", "ANALYTICAL_FOLLOWUP", "CONFIRMATION", "SUBSTANTIVE_PROCEDURE", "INQUIRY", "OBSERVATION"]).default("SUBSTANTIVE_PROCEDURE"),
  resultReference: z.string().optional(),
  stepChecklist: z.record(z.any()).optional(),
  bookValue: z.number().optional(),
  auditedValue: z.number().optional(),
  difference: z.number().optional(),
  exceptionAmount: z.number().optional(),
  exceptionDescription: z.string().optional(),
  testConclusion: z.string().optional(),
  attachments: z.record(z.any()).optional(),
});

const updateExecutionResultSchema = createExecutionResultSchema.partial();

const requestOverrideSchema = z.object({
  reason: z.string().min(1),
  failedGates: z.array(z.string()),
});

const approveOverrideSchema = z.object({
  overrideReason: z.string().min(1),
});

const lockEngagementSchema = z.object({
  lockReason: z.string().optional(),
});

router.get("/:engagementId/materiality-sets", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(403).json({ error: "No firm associated" });
    
    const engagement = await prisma.engagement.findFirst({
      where: { id: engagementId, firmId },
    });
    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }
    
    const materialitySets = await prisma.materialitySet.findMany({
      where: { engagementId },
      include: {
        preparedBy: { select: { id: true, fullName: true } },
        reviewedBy: { select: { id: true, fullName: true } },
        approvedBy: { select: { id: true, fullName: true } },
        lockedBy: { select: { id: true, fullName: true } },
      },
      orderBy: { versionId: "desc" },
    });
    
    res.json(materialitySets);
  } catch (error) {
    console.error("List materiality sets error:", error);
    res.status(500).json({ error: "Failed to fetch materiality sets" });
  }
});

router.get("/:engagementId/materiality-sets/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId, id } = req.params;
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(403).json({ error: "No firm associated" });
    
    const materialitySet = await prisma.materialitySet.findFirst({
      where: { id, engagementId, engagement: { firmId } },
      include: {
        preparedBy: { select: { id: true, fullName: true } },
        reviewedBy: { select: { id: true, fullName: true } },
        approvedBy: { select: { id: true, fullName: true } },
        lockedBy: { select: { id: true, fullName: true } },
        auditPlans: true,
      },
    });
    
    if (!materialitySet) {
      return res.status(404).json({ error: "Materiality set not found" });
    }
    
    res.json(materialitySet);
  } catch (error) {
    console.error("Get materiality set error:", error);
    res.status(500).json({ error: "Failed to fetch materiality set" });
  }
});

router.post("/:engagementId/materiality-sets", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(403).json({ error: "No firm associated" });
    const userId = req.user!.id;
    
    const engagement = await prisma.engagement.findFirst({
      where: { id: engagementId, firmId },
    });
    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }
    
    const validation = createMaterialitySetSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Validation failed", details: validation.error.errors });
    }
    
    const latestVersion = await prisma.materialitySet.findFirst({
      where: { engagementId },
      orderBy: { versionId: "desc" },
    });
    
    const newVersionId = (latestVersion?.versionId || 0) + 1;
    
    if (latestVersion && latestVersion.status !== "SUPERSEDED") {
      await prisma.materialitySet.update({
        where: { id: latestVersion.id },
        data: { status: "SUPERSEDED" },
      });
    }
    
    const materialitySet = await prisma.materialitySet.create({
      data: {
        engagementId,
        versionId: newVersionId,
        previousVersionId: latestVersion?.id,
        benchmarkType: validation.data.benchmarkType,
        benchmarkAmount: validation.data.benchmarkAmount,
        percentApplied: validation.data.percentApplied,
        overallMateriality: validation.data.overallMateriality,
        performanceMateriality: validation.data.performanceMateriality,
        trivialThreshold: validation.data.trivialThreshold,
        specificMateriality: validation.data.specificMateriality || undefined,
        rationale: validation.data.rationale,
        preparedById: userId,
        preparedAt: new Date(),
        status: "DRAFT",
      },
      include: {
        preparedBy: { select: { id: true, fullName: true } },
      },
    });
    
    await logAuditTrail(req.user!.id, "MATERIALITY_SET_CREATED", "ControlPack", undefined, undefined, { materialitySetId: materialitySet.id, versionId: newVersionId }, engagementId);
    
    res.status(201).json(materialitySet);
  } catch (error) {
    console.error("Create materiality set error:", error);
    res.status(500).json({ error: "Failed to create materiality set" });
  }
});

router.patch("/:engagementId/materiality-sets/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId, id } = req.params;
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(403).json({ error: "No firm associated" });
    
    const existing = await prisma.materialitySet.findFirst({
      where: { id, engagementId, engagement: { firmId } },
    });
    if (!existing) {
      return res.status(404).json({ error: "Materiality set not found" });
    }
    if (existing.isLocked) {
      return res.status(403).json({ error: "Materiality set is locked and cannot be modified" });
    }
    
    const validation = updateMaterialitySetSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Validation failed", details: validation.error.errors });
    }
    
    const materialitySet = await prisma.materialitySet.update({
      where: { id },
      data: validation.data,
    });
    
    await logAuditTrail(req.user!.id, "MATERIALITY_SET_UPDATED", "ControlPack", undefined, undefined, { materialitySetId: id }, engagementId);
    
    res.json(materialitySet);
  } catch (error) {
    console.error("Update materiality set error:", error);
    res.status(500).json({ error: "Failed to update materiality set" });
  }
});

router.patch("/:engagementId/materiality-sets/:id/submit", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId, id } = req.params;
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(403).json({ error: "No firm associated" });
    const userId = req.user!.id;
    
    const existing = await prisma.materialitySet.findFirst({
      where: { id, engagementId, engagement: { firmId } },
    });
    if (!existing) {
      return res.status(404).json({ error: "Materiality set not found" });
    }
    if (existing.status !== "DRAFT") {
      return res.status(400).json({ error: "Only draft materiality sets can be submitted for review" });
    }
    
    const materialitySet = await prisma.materialitySet.update({
      where: { id },
      data: {
        status: "PENDING_REVIEW",
        reviewedById: null,
        reviewedAt: null,
      },
    });
    
    await logAuditTrail(req.user!.id, "MATERIALITY_SET_SUBMITTED", "ControlPack", undefined, undefined, { materialitySetId: id }, engagementId);
    
    res.json(materialitySet);
  } catch (error) {
    console.error("Submit materiality set error:", error);
    res.status(500).json({ error: "Failed to submit materiality set for review" });
  }
});

router.patch("/:engagementId/materiality-sets/:id/approve", requireAuth, requireMinRole("MANAGER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId, id } = req.params;
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(403).json({ error: "No firm associated" });
    const userId = req.user!.id;
    
    const existing = await prisma.materialitySet.findFirst({
      where: { id, engagementId, engagement: { firmId } },
    });
    if (!existing) {
      return res.status(404).json({ error: "Materiality set not found" });
    }
    if (existing.status !== "PENDING_REVIEW" && existing.status !== "PENDING_APPROVAL") {
      return res.status(400).json({ error: "Materiality set must be pending review/approval" });
    }
    
    const materialitySet = await prisma.materialitySet.update({
      where: { id },
      data: {
        status: "APPROVED",
        approvedById: userId,
        approvedAt: new Date(),
      },
    });
    
    await logAuditTrail(req.user!.id, "MATERIALITY_SET_APPROVED", "ControlPack", undefined, undefined, { materialitySetId: id, approvedBy: userId }, engagementId);
    
    res.json(materialitySet);
  } catch (error) {
    console.error("Approve materiality set error:", error);
    res.status(500).json({ error: "Failed to approve materiality set" });
  }
});

router.patch("/:engagementId/materiality-sets/:id/lock", requireAuth, requireMinRole("PARTNER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId, id } = req.params;
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(403).json({ error: "No firm associated" });
    const userId = req.user!.id;
    
    const existing = await prisma.materialitySet.findFirst({
      where: { id, engagementId, engagement: { firmId } },
    });
    if (!existing) {
      return res.status(404).json({ error: "Materiality set not found" });
    }
    if (existing.status !== "APPROVED") {
      return res.status(400).json({ error: "Only approved materiality sets can be locked" });
    }
    
    const materialitySet = await prisma.materialitySet.update({
      where: { id },
      data: {
        status: "LOCKED",
        isLocked: true,
        lockedAt: new Date(),
        lockedById: userId,
      },
    });
    
    await logAuditTrail(req.user!.id, "MATERIALITY_SET_LOCKED", "ControlPack", undefined, undefined, { materialitySetId: id, lockedBy: userId }, engagementId);
    
    res.json(materialitySet);
  } catch (error) {
    console.error("Lock materiality set error:", error);
    res.status(500).json({ error: "Failed to lock materiality set" });
  }
});

router.get("/:engagementId/audit-plans", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(403).json({ error: "No firm associated" });
    
    const engagement = await prisma.engagement.findFirst({
      where: { id: engagementId, firmId },
    });
    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }
    
    const auditPlans = await prisma.auditPlan.findMany({
      where: { engagementId },
      include: {
        materialitySet: { select: { id: true, versionId: true, overallMateriality: true } },
        preparedBy: { select: { id: true, fullName: true } },
        reviewedBy: { select: { id: true, fullName: true } },
        approvedBy: { select: { id: true, fullName: true } },
        lockedBy: { select: { id: true, fullName: true } },
      },
      orderBy: { versionNumber: "desc" },
    });
    
    res.json(auditPlans);
  } catch (error) {
    console.error("List audit plans error:", error);
    res.status(500).json({ error: "Failed to fetch audit plans" });
  }
});

router.get("/:engagementId/audit-plans/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId, id } = req.params;
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(403).json({ error: "No firm associated" });
    
    const auditPlan = await prisma.auditPlan.findFirst({
      where: { id, engagementId, engagement: { firmId } },
      include: {
        materialitySet: true,
        preparedBy: { select: { id: true, fullName: true } },
        reviewedBy: { select: { id: true, fullName: true } },
        approvedBy: { select: { id: true, fullName: true } },
        lockedBy: { select: { id: true, fullName: true } },
        proceduresMatrix: true,
      },
    });
    
    if (!auditPlan) {
      return res.status(404).json({ error: "Audit plan not found" });
    }
    
    res.json(auditPlan);
  } catch (error) {
    console.error("Get audit plan error:", error);
    res.status(500).json({ error: "Failed to fetch audit plan" });
  }
});

router.post("/:engagementId/audit-plans", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(403).json({ error: "No firm associated" });
    const userId = req.user!.id;
    
    const engagement = await prisma.engagement.findFirst({
      where: { id: engagementId, firmId },
    });
    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }
    
    const validation = createAuditPlanSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Validation failed", details: validation.error.errors });
    }
    
    const latestVersion = await prisma.auditPlan.findFirst({
      where: { engagementId },
      orderBy: { versionNumber: "desc" },
    });
    
    const newVersionNumber = (latestVersion?.versionNumber || 0) + 1;
    
    const auditPlan = await prisma.auditPlan.create({
      data: {
        engagementId,
        versionNumber: newVersionNumber,
        materialitySetId: validation.data.materialitySetId,
        mappingVersionId: validation.data.mappingVersionId,
        auditApproach: validation.data.auditApproach,
        auditTiming: validation.data.auditTiming,
        scopeDescription: validation.data.scopeDescription,
        staffingPlan: validation.data.staffingPlan || undefined,
        relianceOnControls: validation.data.relianceOnControls,
        relianceOnInternalAudit: validation.data.relianceOnInternalAudit,
        relianceOnExperts: validation.data.relianceOnExperts,
        relianceOnIT: validation.data.relianceOnIT,
        relianceDetails: validation.data.relianceDetails || undefined,
        interimStartDate: validation.data.interimStartDate ? new Date(validation.data.interimStartDate) : null,
        interimEndDate: validation.data.interimEndDate ? new Date(validation.data.interimEndDate) : null,
        finalStartDate: validation.data.finalStartDate ? new Date(validation.data.finalStartDate) : null,
        finalEndDate: validation.data.finalEndDate ? new Date(validation.data.finalEndDate) : null,
        reportDeadline: validation.data.reportDeadline ? new Date(validation.data.reportDeadline) : null,
        milestoneDates: validation.data.milestoneDates || undefined,
        preparedById: userId,
        preparedAt: new Date(),
        status: "DRAFT",
      },
      include: {
        preparedBy: { select: { id: true, fullName: true } },
      },
    });
    
    await logAuditTrail(req.user!.id, "AUDIT_PLAN_CREATED", "ControlPack", undefined, undefined, { auditPlanId: auditPlan.id, versionNumber: newVersionNumber }, engagementId);
    
    res.status(201).json(auditPlan);
  } catch (error) {
    console.error("Create audit plan error:", error);
    res.status(500).json({ error: "Failed to create audit plan" });
  }
});

router.patch("/:engagementId/audit-plans/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId, id } = req.params;
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(403).json({ error: "No firm associated" });
    
    const existing = await prisma.auditPlan.findFirst({
      where: { id, engagementId, engagement: { firmId } },
    });
    if (!existing) {
      return res.status(404).json({ error: "Audit plan not found" });
    }
    if (existing.isLocked) {
      return res.status(403).json({ error: "Audit plan is locked and cannot be modified" });
    }
    
    const validation = updateAuditPlanSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Validation failed", details: validation.error.errors });
    }
    
    const updateData: any = { ...validation.data };
    if (validation.data.interimStartDate) updateData.interimStartDate = new Date(validation.data.interimStartDate);
    if (validation.data.interimEndDate) updateData.interimEndDate = new Date(validation.data.interimEndDate);
    if (validation.data.finalStartDate) updateData.finalStartDate = new Date(validation.data.finalStartDate);
    if (validation.data.finalEndDate) updateData.finalEndDate = new Date(validation.data.finalEndDate);
    if (validation.data.reportDeadline) updateData.reportDeadline = new Date(validation.data.reportDeadline);
    
    const auditPlan = await prisma.auditPlan.update({
      where: { id },
      data: updateData,
    });
    
    await logAuditTrail(req.user!.id, "AUDIT_PLAN_UPDATED", "ControlPack", undefined, undefined, { auditPlanId: id }, engagementId);
    
    res.json(auditPlan);
  } catch (error) {
    console.error("Update audit plan error:", error);
    res.status(500).json({ error: "Failed to update audit plan" });
  }
});

router.patch("/:engagementId/audit-plans/:id/submit", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId, id } = req.params;
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(403).json({ error: "No firm associated" });
    
    const existing = await prisma.auditPlan.findFirst({
      where: { id, engagementId, engagement: { firmId } },
    });
    if (!existing) {
      return res.status(404).json({ error: "Audit plan not found" });
    }
    if (existing.status !== "DRAFT") {
      return res.status(400).json({ error: "Only draft audit plans can be submitted for review" });
    }
    
    const auditPlan = await prisma.auditPlan.update({
      where: { id },
      data: {
        status: "PENDING_REVIEW",
        reviewedById: null,
        reviewedAt: null,
      },
    });
    
    await logAuditTrail(req.user!.id, "AUDIT_PLAN_SUBMITTED", "ControlPack", undefined, undefined, { auditPlanId: id }, engagementId);
    
    res.json(auditPlan);
  } catch (error) {
    console.error("Submit audit plan error:", error);
    res.status(500).json({ error: "Failed to submit audit plan for review" });
  }
});

router.patch("/:engagementId/audit-plans/:id/approve", requireAuth, requireMinRole("MANAGER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId, id } = req.params;
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(403).json({ error: "No firm associated" });
    const userId = req.user!.id;
    
    const existing = await prisma.auditPlan.findFirst({
      where: { id, engagementId, engagement: { firmId } },
    });
    if (!existing) {
      return res.status(404).json({ error: "Audit plan not found" });
    }
    if (existing.status !== "DRAFT" && existing.status !== "PENDING_REVIEW" && existing.status !== "PENDING_APPROVAL") {
      return res.status(400).json({ error: "Audit plan is not in a state that can be approved" });
    }
    
    const auditPlan = await prisma.auditPlan.update({
      where: { id },
      data: {
        status: "APPROVED",
        approvedById: userId,
        approvedAt: new Date(),
      },
    });
    
    await logAuditTrail(req.user!.id, "AUDIT_PLAN_APPROVED", "ControlPack", undefined, undefined, { auditPlanId: id, approvedBy: userId }, engagementId);
    
    res.json(auditPlan);
  } catch (error) {
    console.error("Approve audit plan error:", error);
    res.status(500).json({ error: "Failed to approve audit plan" });
  }
});

router.patch("/:engagementId/audit-plans/:id/lock", requireAuth, requireMinRole("PARTNER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId, id } = req.params;
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(403).json({ error: "No firm associated" });
    const userId = req.user!.id;
    
    const existing = await prisma.auditPlan.findFirst({
      where: { id, engagementId, engagement: { firmId } },
    });
    if (!existing) {
      return res.status(404).json({ error: "Audit plan not found" });
    }
    if (existing.status !== "APPROVED") {
      return res.status(400).json({ error: "Only approved audit plans can be locked" });
    }
    
    const auditPlan = await prisma.auditPlan.update({
      where: { id },
      data: {
        status: "LOCKED",
        isLocked: true,
        lockedAt: new Date(),
        lockedById: userId,
      },
    });
    
    await logAuditTrail(req.user!.id, "AUDIT_PLAN_LOCKED", "ControlPack", undefined, undefined, { auditPlanId: id, lockedBy: userId }, engagementId);
    
    res.json(auditPlan);
  } catch (error) {
    console.error("Lock audit plan error:", error);
    res.status(500).json({ error: "Failed to lock audit plan" });
  }
});

router.get("/:engagementId/procedures-matrix", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const { fsHeadKey, status } = req.query;
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(403).json({ error: "No firm associated" });
    
    const engagement = await prisma.engagement.findFirst({
      where: { id: engagementId, firmId },
    });
    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }
    
    const whereClause: any = { engagementId };
    if (fsHeadKey) whereClause.fsHeadKey = fsHeadKey as string;
    if (status) whereClause.status = status as ProcedureStatus;
    
    const procedures = await prisma.procedureMatrixItem.findMany({
      where: whereClause,
      include: {
        auditPlan: { select: { id: true, versionNumber: true } },
        assignedTo: { select: { id: true, fullName: true } },
        preparedBy: { select: { id: true, fullName: true } },
        reviewedBy: { select: { id: true, fullName: true } },
        approvedBy: { select: { id: true, fullName: true } },
      },
      orderBy: [{ fsHeadKey: "asc" }, { procedureName: "asc" }],
    });
    
    res.json(procedures);
  } catch (error) {
    console.error("List procedures matrix error:", error);
    res.status(500).json({ error: "Failed to fetch procedures matrix" });
  }
});

router.get("/:engagementId/procedures-matrix/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId, id } = req.params;
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(403).json({ error: "No firm associated" });
    
    const procedure = await prisma.procedureMatrixItem.findFirst({
      where: { id, engagementId, engagement: { firmId } },
      include: {
        auditPlan: true,
        assignedTo: { select: { id: true, fullName: true } },
        preparedBy: { select: { id: true, fullName: true } },
        reviewedBy: { select: { id: true, fullName: true } },
        approvedBy: { select: { id: true, fullName: true } },
        samplingFrames: true,
        executionResults: true,
      },
    });
    
    if (!procedure) {
      return res.status(404).json({ error: "Procedure not found" });
    }
    
    res.json(procedure);
  } catch (error) {
    console.error("Get procedure error:", error);
    res.status(500).json({ error: "Failed to fetch procedure" });
  }
});

router.post("/:engagementId/procedures-matrix", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(403).json({ error: "No firm associated" });
    const userId = req.user!.id;
    
    const engagement = await prisma.engagement.findFirst({
      where: { id: engagementId, firmId },
    });
    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }
    
    const validation = createProcedureMatrixSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Validation failed", details: validation.error.errors });
    }
    
    const procedure = await prisma.procedureMatrixItem.create({
      data: {
        engagementId,
        auditPlanId: validation.data.auditPlanId,
        riskAssessmentId: validation.data.riskAssessmentId,
        fsHeadKey: validation.data.fsHeadKey,
        glCodeSet: validation.data.glCodeSet,
        procedureLibraryCode: validation.data.procedureLibraryCode,
        procedureName: validation.data.procedureName,
        procedureDescription: validation.data.procedureDescription,
        procedureType: validation.data.procedureType,
        assertions: validation.data.assertions,
        populationDefinition: validation.data.populationDefinition || undefined,
        populationFilters: validation.data.populationFilters || undefined,
        evidenceRequiredChecklist: validation.data.evidenceRequiredChecklist || undefined,
        assignedToId: validation.data.assignedToId,
        dueDate: validation.data.dueDate ? new Date(validation.data.dueDate) : null,
        preparedById: userId,
        preparedAt: new Date(),
        status: "PLANNED",
      },
    });
    
    await logAuditTrail(req.user!.id, "PROCEDURE_CREATED", "ControlPack", undefined, undefined, { procedureId: procedure.id }, engagementId);
    
    res.status(201).json(procedure);
  } catch (error) {
    console.error("Create procedure error:", error);
    res.status(500).json({ error: "Failed to create procedure" });
  }
});

router.post("/:engagementId/procedures-matrix/bulk", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(403).json({ error: "No firm associated" });
    const userId = req.user!.id;
    
    const engagement = await prisma.engagement.findFirst({
      where: { id: engagementId, firmId },
    });
    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }
    
    const validation = bulkCreateProceduresSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Validation failed", details: validation.error.errors });
    }
    
    const createdProcedures = await prisma.$transaction(
      validation.data.procedures.map((proc) =>
        prisma.procedureMatrixItem.create({
          data: {
            engagementId,
            auditPlanId: validation.data.auditPlanId || proc.auditPlanId,
            riskAssessmentId: proc.riskAssessmentId,
            fsHeadKey: proc.fsHeadKey,
            glCodeSet: proc.glCodeSet,
            procedureLibraryCode: proc.procedureLibraryCode,
            procedureName: proc.procedureName,
            procedureDescription: proc.procedureDescription,
            procedureType: proc.procedureType,
            assertions: proc.assertions,
            populationDefinition: proc.populationDefinition || undefined,
            populationFilters: proc.populationFilters || undefined,
            evidenceRequiredChecklist: proc.evidenceRequiredChecklist || undefined,
            assignedToId: proc.assignedToId,
            dueDate: proc.dueDate ? new Date(proc.dueDate) : null,
            preparedById: userId,
            preparedAt: new Date(),
            status: "PLANNED",
          },
        })
      )
    );
    
    await logAuditTrail(req.user!.id, "PROCEDURES_BULK_CREATED", "ControlPack", undefined, undefined, { count: createdProcedures.length }, engagementId);
    
    res.status(201).json(createdProcedures);
  } catch (error) {
    console.error("Bulk create procedures error:", error);
    res.status(500).json({ error: "Failed to bulk create procedures" });
  }
});

router.patch("/:engagementId/procedures-matrix/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId, id } = req.params;
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(403).json({ error: "No firm associated" });
    
    const existing = await prisma.procedureMatrixItem.findFirst({
      where: { id, engagementId, engagement: { firmId } },
    });
    if (!existing) {
      return res.status(404).json({ error: "Procedure not found" });
    }
    if (existing.status === "APPROVED") {
      return res.status(403).json({ error: "Approved procedures cannot be modified" });
    }
    
    const validation = updateProcedureMatrixSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Validation failed", details: validation.error.errors });
    }
    
    const updateData: any = { ...validation.data };
    if (validation.data.dueDate) updateData.dueDate = new Date(validation.data.dueDate);
    
    const procedure = await prisma.procedureMatrixItem.update({
      where: { id },
      data: updateData,
    });
    
    await logAuditTrail(req.user!.id, "PROCEDURE_UPDATED", "ControlPack", undefined, undefined, { procedureId: id }, engagementId);
    
    res.json(procedure);
  } catch (error) {
    console.error("Update procedure error:", error);
    res.status(500).json({ error: "Failed to update procedure" });
  }
});

router.patch("/:engagementId/procedures-matrix/:id/status", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId, id } = req.params;
    const { status } = req.body;
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(403).json({ error: "No firm associated" });
    const userId = req.user!.id;
    
    if (!status || !["PLANNED", "IN_PROGRESS", "COMPLETED", "REVIEWED", "APPROVED", "NOT_APPLICABLE"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }
    
    const existing = await prisma.procedureMatrixItem.findFirst({
      where: { id, engagementId, engagement: { firmId } },
    });
    if (!existing) {
      return res.status(404).json({ error: "Procedure not found" });
    }
    
    const updateData: any = { status };
    if (status === "REVIEWED") {
      updateData.reviewedById = userId;
      updateData.reviewedAt = new Date();
    } else if (status === "APPROVED") {
      if (!["MANAGER", "PARTNER", "MANAGING_PARTNER", "ADMIN"].includes(req.user!.role)) {
        return res.status(403).json({ error: "Only managers and above can approve procedures" });
      }
      updateData.approvedById = userId;
      updateData.approvedAt = new Date();
    }
    
    const procedure = await prisma.procedureMatrixItem.update({
      where: { id },
      data: updateData,
    });
    
    await logAuditTrail(req.user!.id, "PROCEDURE_STATUS_UPDATED", "ControlPack", undefined, undefined, { procedureId: id, status }, engagementId);
    
    res.json(procedure);
  } catch (error) {
    console.error("Update procedure status error:", error);
    res.status(500).json({ error: "Failed to update procedure status" });
  }
});

router.get("/:engagementId/sampling-frames", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(403).json({ error: "No firm associated" });
    
    const engagement = await prisma.engagement.findFirst({
      where: { id: engagementId, firmId },
    });
    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }
    
    const samplingFrames = await prisma.samplingFrame.findMany({
      where: { engagementId },
      include: {
        procedure: { select: { id: true, procedureName: true } },
        createdBy: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    
    res.json(samplingFrames);
  } catch (error) {
    console.error("List sampling frames error:", error);
    res.status(500).json({ error: "Failed to fetch sampling frames" });
  }
});

router.get("/:engagementId/sampling-frames/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId, id } = req.params;
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(403).json({ error: "No firm associated" });
    
    const samplingFrame = await prisma.samplingFrame.findFirst({
      where: { id, engagementId, engagement: { firmId } },
      include: {
        procedure: true,
        createdBy: { select: { id: true, fullName: true } },
        executionResults: true,
      },
    });
    
    if (!samplingFrame) {
      return res.status(404).json({ error: "Sampling frame not found" });
    }
    
    res.json(samplingFrame);
  } catch (error) {
    console.error("Get sampling frame error:", error);
    res.status(500).json({ error: "Failed to fetch sampling frame" });
  }
});

router.post("/:engagementId/sampling-frames", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(403).json({ error: "No firm associated" });
    const userId = req.user!.id;
    
    const engagement = await prisma.engagement.findFirst({
      where: { id: engagementId, firmId },
    });
    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }
    
    const validation = createSamplingFrameSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Validation failed", details: validation.error.errors });
    }
    
    const samplingFrame = await prisma.samplingFrame.create({
      data: {
        engagementId,
        procedureId: validation.data.procedureId,
        samplingRunId: validation.data.samplingRunId,
        frameName: validation.data.frameName,
        populationSource: validation.data.populationSource,
        populationGLCodes: validation.data.populationGLCodes,
        populationFilters: validation.data.populationFilters || undefined,
        stratificationRules: validation.data.stratificationRules || undefined,
        samplingMethod: validation.data.samplingMethod,
        confidenceLevel: validation.data.confidenceLevel,
        tolerableError: validation.data.tolerableError,
        expectedError: validation.data.expectedError,
        createdById: userId,
        status: "CREATED",
      },
    });
    
    await logAuditTrail(req.user!.id, "SAMPLING_FRAME_CREATED", "ControlPack", undefined, undefined, { samplingFrameId: samplingFrame.id }, engagementId);
    
    res.status(201).json(samplingFrame);
  } catch (error) {
    console.error("Create sampling frame error:", error);
    res.status(500).json({ error: "Failed to create sampling frame" });
  }
});

router.patch("/:engagementId/sampling-frames/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId, id } = req.params;
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(403).json({ error: "No firm associated" });
    
    const existing = await prisma.samplingFrame.findFirst({
      where: { id, engagementId, engagement: { firmId } },
    });
    if (!existing) {
      return res.status(404).json({ error: "Sampling frame not found" });
    }
    if (existing.status === "COMPLETED" || existing.status === "REVIEWED") {
      return res.status(403).json({ error: "Completed/reviewed sampling frames cannot be modified" });
    }
    
    const validation = updateSamplingFrameSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Validation failed", details: validation.error.errors });
    }
    
    const samplingFrame = await prisma.samplingFrame.update({
      where: { id },
      data: validation.data,
    });
    
    await logAuditTrail(req.user!.id, "SAMPLING_FRAME_UPDATED", "ControlPack", undefined, undefined, { samplingFrameId: id }, engagementId);
    
    res.json(samplingFrame);
  } catch (error) {
    console.error("Update sampling frame error:", error);
    res.status(500).json({ error: "Failed to update sampling frame" });
  }
});

router.post("/:engagementId/sampling-frames/:id/generate-sample", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId, id } = req.params;
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(403).json({ error: "No firm associated" });
    
    const existing = await prisma.samplingFrame.findFirst({
      where: { id, engagementId, engagement: { firmId } },
    });
    if (!existing) {
      return res.status(404).json({ error: "Sampling frame not found" });
    }
    
    const validation = generateSampleSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Validation failed", details: validation.error.errors });
    }
    
    const { sampleSize, samplingMethod, randomSeed } = validation.data;
    
    const seed = randomSeed || Math.floor(Math.random() * 1000000);
    const selectedItems: any[] = [];
    
    for (let i = 0; i < sampleSize; i++) {
      selectedItems.push({
        itemIndex: i + 1,
        selectedAt: new Date().toISOString(),
        samplingMethod,
        randomSeed: seed,
      });
    }
    
    const samplingFrame = await prisma.samplingFrame.update({
      where: { id },
      data: {
        sampleSize,
        samplingMethod,
        randomSeed: seed,
        selectedItems,
        status: "SAMPLED",
      },
    });
    
    await logAuditTrail(req.user!.id, "SAMPLE_GENERATED", "ControlPack", undefined, undefined, { samplingFrameId: id, sampleSize, samplingMethod }, engagementId);
    
    res.json(samplingFrame);
  } catch (error) {
    console.error("Generate sample error:", error);
    res.status(500).json({ error: "Failed to generate sample" });
  }
});

router.get("/:engagementId/execution-results", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const { procedureId, fsHeadKey, status } = req.query;
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(403).json({ error: "No firm associated" });
    
    const engagement = await prisma.engagement.findFirst({
      where: { id: engagementId, firmId },
    });
    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }
    
    const whereClause: any = { engagementId };
    if (procedureId) whereClause.procedureId = procedureId as string;
    if (fsHeadKey) whereClause.fsHeadKey = fsHeadKey as string;
    if (status) whereClause.status = status as ExecutionResultStatus;
    
    const executionResults = await prisma.executionResult.findMany({
      where: whereClause,
      include: {
        procedure: { select: { id: true, procedureName: true } },
        samplingFrame: { select: { id: true, frameName: true } },
        performedBy: { select: { id: true, fullName: true } },
        reviewedBy: { select: { id: true, fullName: true } },
        approvedBy: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    
    res.json(executionResults);
  } catch (error) {
    console.error("List execution results error:", error);
    res.status(500).json({ error: "Failed to fetch execution results" });
  }
});

router.get("/:engagementId/execution-results/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId, id } = req.params;
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(403).json({ error: "No firm associated" });
    
    const executionResult = await prisma.executionResult.findFirst({
      where: { id, engagementId, engagement: { firmId } },
      include: {
        procedure: true,
        samplingFrame: true,
        performedBy: { select: { id: true, fullName: true } },
        reviewedBy: { select: { id: true, fullName: true } },
        approvedBy: { select: { id: true, fullName: true } },
      },
    });
    
    if (!executionResult) {
      return res.status(404).json({ error: "Execution result not found" });
    }
    
    res.json(executionResult);
  } catch (error) {
    console.error("Get execution result error:", error);
    res.status(500).json({ error: "Failed to fetch execution result" });
  }
});

router.post("/:engagementId/execution-results", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(403).json({ error: "No firm associated" });
    const userId = req.user!.id;
    
    const engagement = await prisma.engagement.findFirst({
      where: { id: engagementId, firmId },
    });
    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }
    
    const validation = createExecutionResultSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Validation failed", details: validation.error.errors });
    }
    
    const executionResult = await prisma.executionResult.create({
      data: {
        engagementId,
        procedureId: validation.data.procedureId,
        samplingFrameId: validation.data.samplingFrameId,
        samplingItemId: validation.data.samplingItemId,
        fsHeadKey: validation.data.fsHeadKey,
        glCode: validation.data.glCode,
        resultType: validation.data.resultType,
        resultReference: validation.data.resultReference,
        stepChecklist: validation.data.stepChecklist || undefined,
        bookValue: validation.data.bookValue,
        auditedValue: validation.data.auditedValue,
        difference: validation.data.difference,
        exceptionAmount: validation.data.exceptionAmount,
        exceptionDescription: validation.data.exceptionDescription,
        testConclusion: validation.data.testConclusion,
        attachments: validation.data.attachments || undefined,
        performedById: userId,
        performedAt: new Date(),
        status: "PENDING",
      },
    });
    
    await logAuditTrail(req.user!.id, "EXECUTION_RESULT_CREATED", "ControlPack", undefined, undefined, { executionResultId: executionResult.id }, engagementId);
    
    res.status(201).json(executionResult);
  } catch (error) {
    console.error("Create execution result error:", error);
    res.status(500).json({ error: "Failed to create execution result" });
  }
});

router.patch("/:engagementId/execution-results/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId, id } = req.params;
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(403).json({ error: "No firm associated" });
    
    const existing = await prisma.executionResult.findFirst({
      where: { id, engagementId, engagement: { firmId } },
    });
    if (!existing) {
      return res.status(404).json({ error: "Execution result not found" });
    }
    if (existing.status === "APPROVED") {
      return res.status(403).json({ error: "Approved execution results cannot be modified" });
    }
    
    const validation = updateExecutionResultSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Validation failed", details: validation.error.errors });
    }
    
    const executionResult = await prisma.executionResult.update({
      where: { id },
      data: validation.data,
    });
    
    await logAuditTrail(req.user!.id, "EXECUTION_RESULT_UPDATED", "ControlPack", undefined, undefined, { executionResultId: id }, engagementId);
    
    res.json(executionResult);
  } catch (error) {
    console.error("Update execution result error:", error);
    res.status(500).json({ error: "Failed to update execution result" });
  }
});

router.patch("/:engagementId/execution-results/:id/review", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId, id } = req.params;
    const { reviewerNotes } = req.body;
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(403).json({ error: "No firm associated" });
    const userId = req.user!.id;
    
    const existing = await prisma.executionResult.findFirst({
      where: { id, engagementId, engagement: { firmId } },
    });
    if (!existing) {
      return res.status(404).json({ error: "Execution result not found" });
    }
    if (existing.status !== "COMPLETED" && existing.status !== "EXCEPTION_FOUND") {
      return res.status(400).json({ error: "Execution result must be completed before review" });
    }
    
    const executionResult = await prisma.executionResult.update({
      where: { id },
      data: {
        status: "REVIEWED",
        reviewedById: userId,
        reviewedAt: new Date(),
        reviewerNotes: reviewerNotes || undefined,
      },
    });
    
    await logAuditTrail(req.user!.id, "EXECUTION_RESULT_REVIEWED", "ControlPack", undefined, undefined, { executionResultId: id, reviewedBy: userId }, engagementId);
    
    res.json(executionResult);
  } catch (error) {
    console.error("Review execution result error:", error);
    res.status(500).json({ error: "Failed to review execution result" });
  }
});

router.patch("/:engagementId/execution-results/:id/approve", requireAuth, requireMinRole("MANAGER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId, id } = req.params;
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(403).json({ error: "No firm associated" });
    const userId = req.user!.id;
    
    const existing = await prisma.executionResult.findFirst({
      where: { id, engagementId, engagement: { firmId } },
    });
    if (!existing) {
      return res.status(404).json({ error: "Execution result not found" });
    }
    if (existing.status !== "REVIEWED") {
      return res.status(400).json({ error: "Execution result must be reviewed before approval" });
    }
    
    const executionResult = await prisma.executionResult.update({
      where: { id },
      data: {
        status: "APPROVED",
        approvedById: userId,
        approvedAt: new Date(),
      },
    });
    
    await logAuditTrail(req.user!.id, "EXECUTION_RESULT_APPROVED", "ControlPack", undefined, undefined, { executionResultId: id, approvedBy: userId }, engagementId);
    
    res.json(executionResult);
  } catch (error) {
    console.error("Approve execution result error:", error);
    res.status(500).json({ error: "Failed to approve execution result" });
  }
});

router.get("/:engagementId/lock-gate", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(403).json({ error: "No firm associated" });
    
    const engagement = await prisma.engagement.findFirst({
      where: { id: engagementId, firmId },
    });
    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }
    
    let lockGate = await prisma.lockGateEvidence.findFirst({
      where: { engagementId },
      include: {
        materialitySet: { select: { id: true, versionId: true, overallMateriality: true } },
        auditPlan: { select: { id: true, versionNumber: true } },
        lockedBy: { select: { id: true, fullName: true } },
        overrideApprovedBy: { select: { id: true, fullName: true } },
      },
      orderBy: { snapshotVersion: "desc" },
    });
    
    if (!lockGate) {
      lockGate = await prisma.lockGateEvidence.create({
        data: {
          engagementId,
          snapshotVersion: 1,
          status: "PENDING",
        },
        include: {
          materialitySet: { select: { id: true, versionId: true, overallMateriality: true } },
          auditPlan: { select: { id: true, versionNumber: true } },
          lockedBy: { select: { id: true, fullName: true } },
          overrideApprovedBy: { select: { id: true, fullName: true } },
        },
      });
    }
    
    res.json(lockGate);
  } catch (error) {
    console.error("Get lock gate error:", error);
    res.status(500).json({ error: "Failed to fetch lock gate status" });
  }
});

router.post("/:engagementId/lock-gate/check-gates", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(403).json({ error: "No firm associated" });
    
    const engagement = await prisma.engagement.findFirst({
      where: { id: engagementId, firmId },
    });
    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }
    
    const [
      materialitySets,
      auditPlans,
      procedures,
      executionResults,
      openExceptions,
    ] = await Promise.all([
      prisma.materialitySet.findMany({ where: { engagementId, status: "APPROVED" } }),
      prisma.auditPlan.findMany({ where: { engagementId, status: "APPROVED" } }),
      prisma.procedureMatrixItem.findMany({ where: { engagementId } }),
      prisma.executionResult.findMany({ where: { engagementId } }),
      prisma.executionResult.count({ where: { engagementId, status: "EXCEPTION_FOUND" } }),
    ]);
    
    const gateChecklist: any = {
      materialityApproved: { passed: materialitySets.length > 0, message: materialitySets.length > 0 ? "Approved materiality set found" : "No approved materiality set" },
      auditPlanApproved: { passed: auditPlans.length > 0, message: auditPlans.length > 0 ? "Approved audit plan found" : "No approved audit plan" },
      allProceduresCompleted: { 
        passed: procedures.length > 0 && procedures.every(p => p.status === "APPROVED" || p.status === "NOT_APPLICABLE"),
        message: procedures.length === 0 ? "No procedures defined" : `${procedures.filter(p => p.status === "APPROVED" || p.status === "NOT_APPLICABLE").length}/${procedures.length} procedures completed`
      },
      allExecutionResultsApproved: {
        passed: executionResults.length > 0 && executionResults.every(e => e.status === "APPROVED"),
        message: executionResults.length === 0 ? "No execution results" : `${executionResults.filter(e => e.status === "APPROVED").length}/${executionResults.length} results approved`
      },
      noOpenExceptions: { passed: openExceptions === 0, message: openExceptions === 0 ? "No open exceptions" : `${openExceptions} open exceptions` },
    };
    
    const allGatesPassed = Object.values(gateChecklist).every((g: any) => g.passed);
    
    const lockGate = await prisma.lockGateEvidence.upsert({
      where: {
        id: (await prisma.lockGateEvidence.findFirst({ where: { engagementId }, orderBy: { snapshotVersion: "desc" } }))?.id || "new",
      },
      create: {
        engagementId,
        snapshotVersion: 1,
        status: allGatesPassed ? "GATES_PASSED" : "GATES_FAILED",
        materialitySetId: materialitySets[0]?.id,
        auditPlanId: auditPlans[0]?.id,
        openExceptionsCount: openExceptions,
        exceptionsRegisterClosed: openExceptions === 0,
        gateChecklist,
      },
      update: {
        status: allGatesPassed ? "GATES_PASSED" : "GATES_FAILED",
        materialitySetId: materialitySets[0]?.id,
        auditPlanId: auditPlans[0]?.id,
        openExceptionsCount: openExceptions,
        exceptionsRegisterClosed: openExceptions === 0,
        gateChecklist,
      },
    });
    
    await logAuditTrail(req.user!.id, "LOCK_GATES_CHECKED", "ControlPack", undefined, undefined, { allGatesPassed, gateChecklist }, engagementId);
    
    res.json({ lockGate, gateChecklist, allGatesPassed });
  } catch (error) {
    console.error("Check gates error:", error);
    res.status(500).json({ error: "Failed to check lock gates" });
  }
});

router.post("/:engagementId/lock-gate/request-override", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(403).json({ error: "No firm associated" });
    const userId = req.user!.id;
    
    const validation = requestOverrideSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Validation failed", details: validation.error.errors });
    }
    
    const lockGate = await prisma.lockGateEvidence.findFirst({
      where: { engagementId, engagement: { firmId } },
      orderBy: { snapshotVersion: "desc" },
    });
    
    if (!lockGate) {
      return res.status(404).json({ error: "Lock gate not found" });
    }
    if (lockGate.status !== "GATES_FAILED") {
      return res.status(400).json({ error: "Override can only be requested for failed gates" });
    }
    
    const overridesLog = (lockGate.overridesLog as any[]) || [];
    overridesLog.push({
      requestedAt: new Date().toISOString(),
      requestedBy: userId,
      reason: validation.data.reason,
      failedGates: validation.data.failedGates,
      status: "PENDING",
    });
    
    const updated = await prisma.lockGateEvidence.update({
      where: { id: lockGate.id },
      data: {
        status: "OVERRIDE_REQUESTED",
        overridesLog,
        overrideReason: validation.data.reason,
      },
    });
    
    await logAuditTrail(req.user!.id, "LOCK_GATE_OVERRIDE_REQUESTED", "ControlPack", undefined, undefined, { reason: validation.data.reason, failedGates: validation.data.failedGates }, engagementId);
    
    res.json(updated);
  } catch (error) {
    console.error("Request override error:", error);
    res.status(500).json({ error: "Failed to request override" });
  }
});

router.post("/:engagementId/lock-gate/approve-override", requireAuth, requireMinRole("PARTNER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(403).json({ error: "No firm associated" });
    const userId = req.user!.id;
    
    const validation = approveOverrideSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Validation failed", details: validation.error.errors });
    }
    
    const lockGate = await prisma.lockGateEvidence.findFirst({
      where: { engagementId, engagement: { firmId } },
      orderBy: { snapshotVersion: "desc" },
    });
    
    if (!lockGate) {
      return res.status(404).json({ error: "Lock gate not found" });
    }
    if (lockGate.status !== "OVERRIDE_REQUESTED") {
      return res.status(400).json({ error: "No override request pending" });
    }
    
    const overridesLog = (lockGate.overridesLog as any[]) || [];
    if (overridesLog.length > 0) {
      overridesLog[overridesLog.length - 1].status = "APPROVED";
      overridesLog[overridesLog.length - 1].approvedAt = new Date().toISOString();
      overridesLog[overridesLog.length - 1].approvedBy = userId;
      overridesLog[overridesLog.length - 1].approvalReason = validation.data.overrideReason;
    }
    
    const updated = await prisma.lockGateEvidence.update({
      where: { id: lockGate.id },
      data: {
        status: "OVERRIDE_APPROVED",
        overrideApprovedById: userId,
        overrideApprovedAt: new Date(),
        overrideReason: validation.data.overrideReason,
        overridesLog,
      },
    });
    
    await logAuditTrail(req.user!.id, "LOCK_GATE_OVERRIDE_APPROVED", "ControlPack", undefined, undefined, { approvedBy: userId, overrideReason: validation.data.overrideReason }, engagementId);
    
    res.json(updated);
  } catch (error) {
    console.error("Approve override error:", error);
    res.status(500).json({ error: "Failed to approve override" });
  }
});

router.post("/:engagementId/lock-gate/lock", requireAuth, requireMinRole("PARTNER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(403).json({ error: "No firm associated" });
    const userId = req.user!.id;
    
    const validation = lockEngagementSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Validation failed", details: validation.error.errors });
    }
    
    const lockGate = await prisma.lockGateEvidence.findFirst({
      where: { engagementId, engagement: { firmId } },
      orderBy: { snapshotVersion: "desc" },
    });
    
    if (!lockGate) {
      return res.status(404).json({ error: "Lock gate not found" });
    }
    if (lockGate.status !== "GATES_PASSED" && lockGate.status !== "OVERRIDE_APPROVED") {
      return res.status(400).json({ error: "Gates must pass or override must be approved before locking" });
    }
    
    const [materialitySets, auditPlans, procedures, executionResults] = await Promise.all([
      prisma.materialitySet.findMany({ where: { engagementId } }),
      prisma.auditPlan.findMany({ where: { engagementId } }),
      prisma.procedureMatrixItem.findMany({ where: { engagementId } }),
      prisma.executionResult.findMany({ where: { engagementId } }),
    ]);
    
    const archiveSnapshot = {
      createdAt: new Date().toISOString(),
      materialitySets: materialitySets.map(m => ({ id: m.id, versionId: m.versionId, overallMateriality: m.overallMateriality.toString() })),
      auditPlans: auditPlans.map(a => ({ id: a.id, versionNumber: a.versionNumber, status: a.status })),
      proceduresCount: procedures.length,
      executionResultsCount: executionResults.length,
    };
    
    const updated = await prisma.lockGateEvidence.update({
      where: { id: lockGate.id },
      data: {
        status: "LOCKED",
        lockedById: userId,
        lockedAt: new Date(),
        lockReason: validation.data.lockReason,
        archiveSnapshot,
      },
    });
    
    await prisma.engagement.update({
      where: { id: engagementId },
      data: { status: "COMPLETED" },
    });
    
    await logAuditTrail(req.user!.id, "ENGAGEMENT_LOCKED", "ControlPack", undefined, undefined, { lockedBy: userId, lockReason: validation.data.lockReason }, engagementId);
    
    res.json(updated);
  } catch (error) {
    console.error("Lock engagement error:", error);
    res.status(500).json({ error: "Failed to lock engagement" });
  }
});

export default router;
