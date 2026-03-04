import { Router, Response } from "express";
import { z } from "zod";
import { prisma } from "./db";
import { requireAuth, requireMinRole, requireRoles, AuthenticatedRequest } from "./auth";

const router = Router();

function requireFirmScope(req: AuthenticatedRequest, res: Response): string | null {
  const firmId = req.user?.firmId;
  if (!firmId) {
    res.status(400).json({ error: "User not associated with a firm" });
    return null;
  }
  if (req.user?.role === "SUPER_ADMIN") {
    res.status(403).json({ error: "Super Admin cannot access firm-scoped data" });
    return null;
  }
  return firmId;
}

const ENTITY_DOMAIN_MAP: Record<string, string> = {
  FirmQualityObjective: "Governance & Leadership",
  FirmQualityRisk: "Monitoring & Remediation",
  FirmQualityResponse: "Engagement Performance",
  FirmMonitoringReview: "Monitoring & Remediation",
  FirmDeficiencyRecord: "Monitoring & Remediation",
  FirmRemediationAction: "Monitoring & Remediation",
  FirmEqcrPolicy: "ISQM 2 / Engagement Quality Review",
  FirmEqcrAssignment: "ISQM 2 / Engagement Quality Review",
  FirmEthicsProgram: "Ethical Requirements",
  FirmPolicyDocument: "Governance & Leadership",
  FirmIsqmVersionControl: "Governance & Leadership",
};

const ACTION_STATUS_MAP: Record<string, string> = {
  create: "SUBMITTED",
  update: "REVIEWED",
  approve: "APPROVED",
  reject: "REJECTED",
};

async function logActivity(firmId: string, actorUserId: string, entityType: string, entityId: string | null, action: string, beforeJson?: any, afterJson?: any, extra?: { actorRole?: string; controlDomain?: string; status?: string; description?: string; ipAddress?: string; userAgent?: string }) {
  let actorRole = extra?.actorRole || null;
  if (!actorRole) {
    try {
      const user = await prisma.user.findUnique({ where: { id: actorUserId }, select: { role: true } });
      actorRole = user?.role || null;
    } catch {}
  }

  const controlDomain = extra?.controlDomain || ENTITY_DOMAIN_MAP[entityType] || null;
  const status = extra?.status || ACTION_STATUS_MAP[action] || "SUBMITTED";
  const description = extra?.description || `${action} ${entityType}${entityId ? ` (${entityId.substring(0, 8)})` : ""}`;

  await prisma.firmControlActivityLog.create({
    data: {
      firmId,
      actorUserId,
      actorRole,
      entityType,
      entityId,
      action,
      controlDomain,
      status,
      description,
      beforeJson,
      afterJson,
      ipAddress: extra?.ipAddress || null,
      userAgent: extra?.userAgent || null,
    },
  });
}

router.get("/quality-objectives", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const firmId = requireFirmScope(req, res);
  if (!firmId) return;
  try {
    const componentType = req.query.componentType as string | undefined;
    const where: any = { firmId };
    if (componentType) where.componentType = componentType;
    const objectives = await prisma.firmQualityObjective.findMany({
      where,
      include: { risks: true, responses: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(objectives);
  } catch (error) {
    console.error("Get firm quality objectives error:", error);
    res.status(500).json({ error: "Failed to fetch quality objectives" });
  }
});

router.post("/quality-objectives", requireAuth, requireRoles("PARTNER", "ADMIN", "FIRM_ADMIN"), async (req: AuthenticatedRequest, res: Response) => {
  const firmId = requireFirmScope(req, res);
  if (!firmId) return;
  try {
    const schema = z.object({
      componentType: z.string(),
      title: z.string().min(1),
      description: z.string().optional(),
      status: z.string().optional(),
    });
    const data = schema.parse(req.body);
    const obj = await prisma.firmQualityObjective.create({
      data: { firmId, ...data, createdById: req.user!.id },
    });
    await logActivity(firmId, req.user!.id, "FirmQualityObjective", obj.id, "create", null, data);
    res.status(201).json(obj);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: error.errors });
    console.error("Create quality objective error:", error);
    res.status(500).json({ error: "Failed to create quality objective" });
  }
});

router.put("/quality-objectives/:id", requireAuth, requireRoles("PARTNER", "ADMIN", "FIRM_ADMIN"), async (req: AuthenticatedRequest, res: Response) => {
  const firmId = requireFirmScope(req, res);
  if (!firmId) return;
  try {
    const existing = await prisma.firmQualityObjective.findFirst({ where: { id: req.params.id, firmId } });
    if (!existing) return res.status(404).json({ error: "Objective not found" });
    const schema = z.object({
      title: z.string().optional(),
      description: z.string().optional(),
      status: z.string().optional(),
      componentType: z.string().optional(),
      lastReviewAt: z.string().optional().transform(s => s ? new Date(s) : undefined),
      nextReviewDue: z.string().optional().transform(s => s ? new Date(s) : undefined),
    });
    const data = schema.parse(req.body);
    const updated = await prisma.firmQualityObjective.update({ where: { id: req.params.id }, data: data as any });
    await logActivity(firmId, req.user!.id, "FirmQualityObjective", req.params.id, "update", existing, data);
    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: error.errors });
    console.error("Update quality objective error:", error);
    res.status(500).json({ error: "Failed to update quality objective" });
  }
});

router.get("/quality-risks", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const firmId = requireFirmScope(req, res);
  if (!firmId) return;
  try {
    const objectiveId = req.query.objectiveId as string | undefined;
    const where: any = { firmId };
    if (objectiveId) where.objectiveId = objectiveId;
    const risks = await prisma.firmQualityRisk.findMany({ where, include: { responses: true }, orderBy: { createdAt: "desc" } });
    res.json(risks);
  } catch (error) {
    console.error("Get firm quality risks error:", error);
    res.status(500).json({ error: "Failed to fetch quality risks" });
  }
});

router.post("/quality-risks", requireAuth, requireMinRole("MANAGER"), async (req: AuthenticatedRequest, res: Response) => {
  const firmId = requireFirmScope(req, res);
  if (!firmId) return;
  try {
    const schema = z.object({
      objectiveId: z.string(),
      riskTitle: z.string().min(1),
      riskDescription: z.string().optional(),
      likelihood: z.string().optional(),
      impact: z.string().optional(),
      riskRating: z.string().optional(),
    });
    const data = schema.parse(req.body);
    const risk = await prisma.firmQualityRisk.create({ data: { firmId, ...data } });
    await logActivity(firmId, req.user!.id, "FirmQualityRisk", risk.id, "create", null, data);
    res.status(201).json(risk);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: error.errors });
    console.error("Create quality risk error:", error);
    res.status(500).json({ error: "Failed to create quality risk" });
  }
});

router.put("/quality-risks/:id", requireAuth, requireMinRole("MANAGER"), async (req: AuthenticatedRequest, res: Response) => {
  const firmId = requireFirmScope(req, res);
  if (!firmId) return;
  try {
    const existing = await prisma.firmQualityRisk.findFirst({ where: { id: req.params.id, firmId } });
    if (!existing) return res.status(404).json({ error: "Risk not found" });
    const schema = z.object({
      riskTitle: z.string().optional(),
      riskDescription: z.string().optional(),
      likelihood: z.string().optional(),
      impact: z.string().optional(),
      riskRating: z.string().optional(),
      status: z.string().optional(),
    });
    const data = schema.parse(req.body);
    const updated = await prisma.firmQualityRisk.update({ where: { id: req.params.id }, data });
    await logActivity(firmId, req.user!.id, "FirmQualityRisk", req.params.id, "update", existing, data);
    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: error.errors });
    console.error("Update quality risk error:", error);
    res.status(500).json({ error: "Failed to update quality risk" });
  }
});

router.get("/quality-responses", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const firmId = requireFirmScope(req, res);
  if (!firmId) return;
  try {
    const objectiveId = req.query.objectiveId as string | undefined;
    const riskId = req.query.riskId as string | undefined;
    const where: any = { firmId };
    if (objectiveId) where.objectiveId = objectiveId;
    if (riskId) where.riskId = riskId;
    const responses = await prisma.firmQualityResponse.findMany({ where, orderBy: { createdAt: "desc" } });
    res.json(responses);
  } catch (error) {
    console.error("Get firm quality responses error:", error);
    res.status(500).json({ error: "Failed to fetch quality responses" });
  }
});

router.post("/quality-responses", requireAuth, requireMinRole("MANAGER"), async (req: AuthenticatedRequest, res: Response) => {
  const firmId = requireFirmScope(req, res);
  if (!firmId) return;
  try {
    const schema = z.object({
      objectiveId: z.string(),
      riskId: z.string().optional(),
      responseTitle: z.string().min(1),
      designDescription: z.string().optional(),
      implementationStatus: z.string().optional(),
    });
    const data = schema.parse(req.body);
    const response = await prisma.firmQualityResponse.create({ data: { firmId, ...data } });
    await logActivity(firmId, req.user!.id, "FirmQualityResponse", response.id, "create", null, data);
    res.status(201).json(response);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: error.errors });
    console.error("Create quality response error:", error);
    res.status(500).json({ error: "Failed to create quality response" });
  }
});

router.put("/quality-responses/:id", requireAuth, requireMinRole("MANAGER"), async (req: AuthenticatedRequest, res: Response) => {
  const firmId = requireFirmScope(req, res);
  if (!firmId) return;
  try {
    const existing = await prisma.firmQualityResponse.findFirst({ where: { id: req.params.id, firmId } });
    if (!existing) return res.status(404).json({ error: "Response not found" });
    const schema = z.object({
      responseTitle: z.string().optional(),
      designDescription: z.string().optional(),
      implementationStatus: z.string().optional(),
      testingEvidenceRef: z.string().optional(),
      implementedAt: z.string().optional().transform(s => s ? new Date(s) : undefined),
      lastTestedAt: z.string().optional().transform(s => s ? new Date(s) : undefined),
    });
    const data = schema.parse(req.body);
    const updated = await prisma.firmQualityResponse.update({ where: { id: req.params.id }, data: data as any });
    await logActivity(firmId, req.user!.id, "FirmQualityResponse", req.params.id, "update", existing, data);
    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: error.errors });
    console.error("Update quality response error:", error);
    res.status(500).json({ error: "Failed to update quality response" });
  }
});

router.get("/monitoring-reviews", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const firmId = requireFirmScope(req, res);
  if (!firmId) return;
  try {
    const reviews = await prisma.firmMonitoringReview.findMany({
      where: { firmId },
      include: { leadReviewer: { select: { id: true, fullName: true, email: true } }, deficiencies: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(reviews);
  } catch (error) {
    console.error("Get monitoring reviews error:", error);
    res.status(500).json({ error: "Failed to fetch monitoring reviews" });
  }
});

router.post("/monitoring-reviews", requireAuth, requireRoles("PARTNER", "ADMIN", "FIRM_ADMIN"), async (req: AuthenticatedRequest, res: Response) => {
  const firmId = requireFirmScope(req, res);
  if (!firmId) return;
  try {
    const schema = z.object({
      reviewType: z.string(),
      cycleCode: z.string(),
      leadReviewerUserId: z.string().optional(),
      status: z.string().optional(),
    });
    const data = schema.parse(req.body);
    const review = await prisma.firmMonitoringReview.create({ data: { firmId, ...data } });
    await logActivity(firmId, req.user!.id, "FirmMonitoringReview", review.id, "create", null, data);
    res.status(201).json(review);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: error.errors });
    console.error("Create monitoring review error:", error);
    res.status(500).json({ error: "Failed to create monitoring review" });
  }
});

router.put("/monitoring-reviews/:id", requireAuth, requireMinRole("MANAGER"), async (req: AuthenticatedRequest, res: Response) => {
  const firmId = requireFirmScope(req, res);
  if (!firmId) return;
  try {
    const existing = await prisma.firmMonitoringReview.findFirst({ where: { id: req.params.id, firmId } });
    if (!existing) return res.status(404).json({ error: "Review not found" });
    const schema = z.object({
      reviewType: z.string().optional(),
      cycleCode: z.string().optional(),
      leadReviewerUserId: z.string().optional(),
      status: z.string().optional(),
      issuedAt: z.string().optional().transform(s => s ? new Date(s) : undefined),
    });
    const data = schema.parse(req.body);
    const updated = await prisma.firmMonitoringReview.update({ where: { id: req.params.id }, data: data as any });
    await logActivity(firmId, req.user!.id, "FirmMonitoringReview", req.params.id, "update", existing, data);
    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: error.errors });
    console.error("Update monitoring review error:", error);
    res.status(500).json({ error: "Failed to update monitoring review" });
  }
});

router.get("/deficiencies", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const firmId = requireFirmScope(req, res);
  if (!firmId) return;
  try {
    const deficiencies = await prisma.firmDeficiencyRecord.findMany({
      where: { firmId },
      include: {
        owner: { select: { id: true, fullName: true, email: true } },
        remediations: true,
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(deficiencies);
  } catch (error) {
    console.error("Get firm deficiencies error:", error);
    res.status(500).json({ error: "Failed to fetch deficiencies" });
  }
});

router.post("/deficiencies", requireAuth, requireMinRole("MANAGER"), async (req: AuthenticatedRequest, res: Response) => {
  const firmId = requireFirmScope(req, res);
  if (!firmId) return;
  try {
    const schema = z.object({
      monitoringReviewId: z.string().optional(),
      severity: z.string(),
      deficiencyText: z.string().min(1),
      rootCause: z.string().optional(),
      ownerUserId: z.string().optional(),
      dueAt: z.string().optional().transform(s => s ? new Date(s) : undefined),
    });
    const data = schema.parse(req.body);
    const deficiency = await prisma.firmDeficiencyRecord.create({ data: { firmId, ...data } as any });
    await logActivity(firmId, req.user!.id, "FirmDeficiencyRecord", deficiency.id, "create", null, data);
    res.status(201).json(deficiency);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: error.errors });
    console.error("Create deficiency error:", error);
    res.status(500).json({ error: "Failed to create deficiency" });
  }
});

router.put("/deficiencies/:id", requireAuth, requireMinRole("MANAGER"), async (req: AuthenticatedRequest, res: Response) => {
  const firmId = requireFirmScope(req, res);
  if (!firmId) return;
  try {
    const existing = await prisma.firmDeficiencyRecord.findFirst({ where: { id: req.params.id, firmId } });
    if (!existing) return res.status(404).json({ error: "Deficiency not found" });
    const schema = z.object({
      severity: z.string().optional(),
      deficiencyText: z.string().optional(),
      rootCause: z.string().optional(),
      status: z.string().optional(),
      ownerUserId: z.string().optional(),
      dueAt: z.string().optional().transform(s => s ? new Date(s) : undefined),
    });
    const data = schema.parse(req.body);
    const updated = await prisma.firmDeficiencyRecord.update({ where: { id: req.params.id }, data: data as any });
    await logActivity(firmId, req.user!.id, "FirmDeficiencyRecord", req.params.id, "update", existing, data);
    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: error.errors });
    console.error("Update deficiency error:", error);
    res.status(500).json({ error: "Failed to update deficiency" });
  }
});

router.get("/remediations", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const firmId = requireFirmScope(req, res);
  if (!firmId) return;
  try {
    const deficiencyId = req.query.deficiencyId as string | undefined;
    const where: any = { firmId };
    if (deficiencyId) where.deficiencyId = deficiencyId;
    const remediations = await prisma.firmRemediationAction.findMany({
      where,
      include: { assignedTo: { select: { id: true, fullName: true, email: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json(remediations);
  } catch (error) {
    console.error("Get remediations error:", error);
    res.status(500).json({ error: "Failed to fetch remediations" });
  }
});

router.post("/remediations", requireAuth, requireMinRole("MANAGER"), async (req: AuthenticatedRequest, res: Response) => {
  const firmId = requireFirmScope(req, res);
  if (!firmId) return;
  try {
    const schema = z.object({
      deficiencyId: z.string(),
      actionText: z.string().min(1),
      assignedToUserId: z.string().optional(),
      deadlineAt: z.string().optional().transform(s => s ? new Date(s) : undefined),
    });
    const data = schema.parse(req.body);
    const remediation = await prisma.firmRemediationAction.create({ data: { firmId, ...data } as any });
    await logActivity(firmId, req.user!.id, "FirmRemediationAction", remediation.id, "create", null, data);
    res.status(201).json(remediation);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: error.errors });
    console.error("Create remediation error:", error);
    res.status(500).json({ error: "Failed to create remediation" });
  }
});

router.put("/remediations/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const firmId = requireFirmScope(req, res);
  if (!firmId) return;
  try {
    const existing = await prisma.firmRemediationAction.findFirst({ where: { id: req.params.id, firmId } });
    if (!existing) return res.status(404).json({ error: "Remediation not found" });
    const schema = z.object({
      actionText: z.string().optional(),
      status: z.string().optional(),
      evidenceStoragePath: z.string().optional(),
      assignedToUserId: z.string().optional(),
      deadlineAt: z.string().optional().transform(s => s ? new Date(s) : undefined),
    });
    const data = schema.parse(req.body);
    const updated = await prisma.firmRemediationAction.update({ where: { id: req.params.id }, data: data as any });
    await logActivity(firmId, req.user!.id, "FirmRemediationAction", req.params.id, "update", existing, data);
    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: error.errors });
    console.error("Update remediation error:", error);
    res.status(500).json({ error: "Failed to update remediation" });
  }
});

router.get("/eqcr-policy", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const firmId = requireFirmScope(req, res);
  if (!firmId) return;
  try {
    const policy = await prisma.firmEqcrPolicy.findFirst({ where: { firmId } });
    res.json(policy);
  } catch (error) {
    console.error("Get EQCR policy error:", error);
    res.status(500).json({ error: "Failed to fetch EQCR policy" });
  }
});

router.post("/eqcr-policy", requireAuth, requireRoles("PARTNER", "ADMIN", "FIRM_ADMIN"), async (req: AuthenticatedRequest, res: Response) => {
  const firmId = requireFirmScope(req, res);
  if (!firmId) return;
  try {
    const schema = z.object({
      criteriaJson: z.any().optional(),
      independenceConfirmRequired: z.boolean().optional(),
      checklistRequired: z.boolean().optional(),
    });
    const data = schema.parse(req.body);
    const existing = await prisma.firmEqcrPolicy.findFirst({ where: { firmId } });
    let policy;
    if (existing) {
      policy = await prisma.firmEqcrPolicy.update({ where: { id: existing.id }, data });
    } else {
      policy = await prisma.firmEqcrPolicy.create({ data: { firmId, ...data } });
    }
    await logActivity(firmId, req.user!.id, "FirmEqcrPolicy", policy.id, existing ? "update" : "create", existing, data);
    res.json(policy);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: error.errors });
    console.error("Save EQCR policy error:", error);
    res.status(500).json({ error: "Failed to save EQCR policy" });
  }
});

router.get("/eqcr-assignments", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const firmId = requireFirmScope(req, res);
  if (!firmId) return;
  try {
    const assignments = await prisma.firmEqcrAssignment.findMany({
      where: { firmId },
      include: { eqcrPartner: { select: { id: true, fullName: true, email: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json(assignments);
  } catch (error) {
    console.error("Get EQCR assignments error:", error);
    res.status(500).json({ error: "Failed to fetch EQCR assignments" });
  }
});

router.post("/eqcr-assignments", requireAuth, requireRoles("PARTNER", "ADMIN", "FIRM_ADMIN", "MANAGER"), async (req: AuthenticatedRequest, res: Response) => {
  const firmId = requireFirmScope(req, res);
  if (!firmId) return;
  try {
    const schema = z.object({
      engagementId: z.string().optional(),
      eqcrPartnerUserId: z.string(),
      status: z.string().optional(),
    });
    const data = schema.parse(req.body);
    const assignment = await prisma.firmEqcrAssignment.create({ data: { firmId, ...data } });
    await logActivity(firmId, req.user!.id, "FirmEqcrAssignment", assignment.id, "create", null, data);
    res.status(201).json(assignment);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: error.errors });
    console.error("Create EQCR assignment error:", error);
    res.status(500).json({ error: "Failed to create EQCR assignment" });
  }
});

router.put("/eqcr-assignments/:id", requireAuth, requireRoles("PARTNER", "ADMIN", "FIRM_ADMIN"), async (req: AuthenticatedRequest, res: Response) => {
  const firmId = requireFirmScope(req, res);
  if (!firmId) return;
  try {
    const existing = await prisma.firmEqcrAssignment.findFirst({ where: { id: req.params.id, firmId } });
    if (!existing) return res.status(404).json({ error: "Assignment not found" });
    const schema = z.object({
      status: z.string().optional(),
      completedAt: z.string().optional().transform(s => s ? new Date(s) : undefined),
    });
    const data = schema.parse(req.body);
    const updated = await prisma.firmEqcrAssignment.update({ where: { id: req.params.id }, data: data as any });
    await logActivity(firmId, req.user!.id, "FirmEqcrAssignment", req.params.id, "update", existing, data);
    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: error.errors });
    console.error("Update EQCR assignment error:", error);
    res.status(500).json({ error: "Failed to update EQCR assignment" });
  }
});

router.get("/ethics-program", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const firmId = requireFirmScope(req, res);
  if (!firmId) return;
  try {
    const program = await prisma.firmEthicsProgram.findFirst({ where: { firmId } });
    res.json(program);
  } catch (error) {
    console.error("Get ethics program error:", error);
    res.status(500).json({ error: "Failed to fetch ethics program" });
  }
});

router.post("/ethics-program", requireAuth, requireRoles("PARTNER", "ADMIN", "FIRM_ADMIN"), async (req: AuthenticatedRequest, res: Response) => {
  const firmId = requireFirmScope(req, res);
  if (!firmId) return;
  try {
    const schema = z.object({
      annualIndependenceRequired: z.boolean().optional(),
      declarationCycle: z.string().optional(),
      breachReportingChannel: z.string().optional(),
      nonCompliancePolicyRef: z.string().optional(),
    });
    const data = schema.parse(req.body);
    const existing = await prisma.firmEthicsProgram.findFirst({ where: { firmId } });
    let program;
    if (existing) {
      program = await prisma.firmEthicsProgram.update({ where: { id: existing.id }, data });
    } else {
      program = await prisma.firmEthicsProgram.create({ data: { firmId, ...data } });
    }
    await logActivity(firmId, req.user!.id, "FirmEthicsProgram", program.id, existing ? "update" : "create", existing, data);
    res.json(program);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: error.errors });
    console.error("Save ethics program error:", error);
    res.status(500).json({ error: "Failed to save ethics program" });
  }
});

router.get("/policy-documents", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const firmId = requireFirmScope(req, res);
  if (!firmId) return;
  try {
    const docType = req.query.docType as string | undefined;
    const where: any = { firmId };
    if (docType) where.docType = docType;
    const docs = await prisma.firmPolicyDocument.findMany({
      where,
      include: { uploadedBy: { select: { id: true, fullName: true } } },
      orderBy: { uploadedAt: "desc" },
    });
    res.json(docs);
  } catch (error) {
    console.error("Get policy documents error:", error);
    res.status(500).json({ error: "Failed to fetch policy documents" });
  }
});

router.post("/policy-documents", requireAuth, requireRoles("PARTNER", "ADMIN", "FIRM_ADMIN"), async (req: AuthenticatedRequest, res: Response) => {
  const firmId = requireFirmScope(req, res);
  if (!firmId) return;
  try {
    const schema = z.object({
      docType: z.string(),
      title: z.string().min(1),
      version: z.string().optional(),
      storagePath: z.string().optional(),
    });
    const data = schema.parse(req.body);
    const doc = await prisma.firmPolicyDocument.create({ data: { firmId, ...data, uploadedByUserId: req.user!.id } });
    await logActivity(firmId, req.user!.id, "FirmPolicyDocument", doc.id, "create", null, data);
    res.status(201).json(doc);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: error.errors });
    console.error("Create policy document error:", error);
    res.status(500).json({ error: "Failed to create policy document" });
  }
});

router.get("/isqm-versions", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const firmId = requireFirmScope(req, res);
  if (!firmId) return;
  try {
    const versions = await prisma.firmIsqmVersionControl.findMany({
      where: { firmId },
      include: { approvedBy: { select: { id: true, fullName: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json(versions);
  } catch (error) {
    console.error("Get ISQM versions error:", error);
    res.status(500).json({ error: "Failed to fetch ISQM versions" });
  }
});

router.post("/isqm-versions", requireAuth, requireRoles("PARTNER", "ADMIN", "FIRM_ADMIN"), async (req: AuthenticatedRequest, res: Response) => {
  const firmId = requireFirmScope(req, res);
  if (!firmId) return;
  try {
    const schema = z.object({
      manualVersion: z.string().min(1),
      changeSummary: z.string().optional(),
      approvalDate: z.string().optional().transform(s => s ? new Date(s) : undefined),
    });
    const data = schema.parse(req.body);
    const version = await prisma.firmIsqmVersionControl.create({
      data: { firmId, ...data, approvedByUserId: req.user!.id } as any,
    });
    await logActivity(firmId, req.user!.id, "FirmIsqmVersionControl", version.id, "create", null, data);
    res.status(201).json(version);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: error.errors });
    console.error("Create ISQM version error:", error);
    res.status(500).json({ error: "Failed to create ISQM version" });
  }
});

router.get("/activity-logs", requireAuth, requireMinRole("MANAGER"), async (req: AuthenticatedRequest, res: Response) => {
  const firmId = requireFirmScope(req, res);
  if (!firmId) return;
  try {
    const logs = await prisma.firmControlActivityLog.findMany({
      where: { firmId },
      include: { actor: { select: { id: true, fullName: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    res.json(logs);
  } catch (error) {
    console.error("Get activity logs error:", error);
    res.status(500).json({ error: "Failed to fetch activity logs" });
  }
});

router.get("/compliance-dashboard", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const firmId = requireFirmScope(req, res);
  if (!firmId) return;
  try {
    const [objectives, risks, responses, deficiencies, remediations, monitoringReviews, eqcrAssignments, policyDocs] = await Promise.all([
      prisma.firmQualityObjective.findMany({ where: { firmId } }),
      prisma.firmQualityRisk.findMany({ where: { firmId } }),
      prisma.firmQualityResponse.findMany({ where: { firmId } }),
      prisma.firmDeficiencyRecord.findMany({ where: { firmId } }),
      prisma.firmRemediationAction.findMany({ where: { firmId } }),
      prisma.firmMonitoringReview.findMany({ where: { firmId } }),
      prisma.firmEqcrAssignment.findMany({ where: { firmId } }),
      prisma.firmPolicyDocument.findMany({ where: { firmId } }),
    ]);

    const componentTypes = ["governance", "ethics", "acceptance", "performance", "resources", "info_comm", "monitoring"];
    const componentScores: Record<string, { score: number; total: number; status: string }> = {};

    for (const comp of componentTypes) {
      const compObjectives = objectives.filter(o => o.componentType === comp);
      const compRisks = risks.filter(r => compObjectives.some(o => o.id === r.objectiveId));
      const compResponses = responses.filter(resp => compObjectives.some(o => o.id === resp.objectiveId));

      let total = 0;
      let score = 0;

      if (compObjectives.length > 0) {
        total += compObjectives.length;
        score += compObjectives.filter(o => o.status === "approved").length;
      }
      if (compRisks.length > 0) {
        total += compRisks.length;
        score += compRisks.filter(r => r.status === "mitigated").length;
      }
      if (compResponses.length > 0) {
        total += compResponses.length;
        score += compResponses.filter(r => r.implementationStatus === "tested" || r.implementationStatus === "implemented").length;
      }

      const pct = total > 0 ? Math.round((score / total) * 100) : 0;
      componentScores[comp] = {
        score: pct,
        total,
        status: pct >= 80 ? "green" : pct >= 50 ? "amber" : "red",
      };
    }

    const overallScore = componentTypes.length > 0
      ? Math.round(componentTypes.reduce((sum, c) => sum + (componentScores[c]?.score || 0), 0) / componentTypes.length)
      : 0;

    const openDeficiencies = deficiencies.filter(d => d.status === "open" || d.status === "actioned").length;
    const pendingRemediations = remediations.filter(r => r.status === "open" || r.status === "in_progress").length;
    const pendingEqcr = eqcrAssignments.filter(a => a.status !== "completed" && a.status !== "waived").length;

    res.json({
      overallScore,
      componentScores,
      stats: {
        totalObjectives: objectives.length,
        approvedObjectives: objectives.filter(o => o.status === "approved").length,
        totalRisks: risks.length,
        mitigatedRisks: risks.filter(r => r.status === "mitigated").length,
        openRisks: risks.filter(r => r.status === "open").length,
        totalResponses: responses.length,
        implementedResponses: responses.filter(r => r.implementationStatus === "implemented" || r.implementationStatus === "tested").length,
        openDeficiencies,
        pendingRemediations,
        pendingEqcr,
        totalMonitoringReviews: monitoringReviews.length,
        totalPolicyDocs: policyDocs.length,
      },
    });
  } catch (error) {
    console.error("Get compliance dashboard error:", error);
    res.status(500).json({ error: "Failed to fetch compliance dashboard" });
  }
});

export default router;
