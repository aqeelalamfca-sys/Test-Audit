import { Router, Response } from "express";
import { prisma } from "./db";
import { requireAuth, requireMinRole, type AuthenticatedRequest } from "./auth";
import { z } from "zod";
import type { AuditPhase, Prisma } from "@prisma/client";

const db = prisma as any;

const router = Router();

const PHASE_ORDER: AuditPhase[] = [
  "ONBOARDING",
  "PRE_PLANNING", 
  "PLANNING",
  "EXECUTION",
  "FINALIZATION",
  "REPORTING",
  "EQCR",
  "INSPECTION",
];

const PHASE_PREREQUISITES: Record<string, { requiredPhase: AuditPhase | null; checks: string[] }> = {
  ONBOARDING: { requiredPhase: null, checks: [] },
  PRE_PLANNING: { 
    requiredPhase: "ONBOARDING", 
    checks: ["engagement_letter_signed", "independence_declared", "team_assigned"] 
  },
  PLANNING: { 
    requiredPhase: "PRE_PLANNING", 
    checks: ["kyc_completed", "risk_assessment_started"] 
  },
  EXECUTION: { 
    requiredPhase: "PLANNING", 
    checks: ["materiality_set", "risk_assessment_completed", "audit_strategy_approved"] 
  },
  FINALIZATION: { 
    requiredPhase: "EXECUTION", 
    checks: ["procedures_completed", "findings_resolved", "manager_reviewed"] 
  },
  REPORTING: { 
    requiredPhase: "FINALIZATION", 
    checks: ["completion_checklist_done", "going_concern_assessed", "subsequent_events_reviewed"] 
  },
  EQCR: { 
    requiredPhase: "REPORTING", 
    checks: ["audit_report_drafted", "partner_approved"] 
  },
  INSPECTION: { 
    requiredPhase: "EQCR", 
    checks: ["eqcr_completed", "file_assembled"] 
  },
};

async function validatePhaseGate(engagementId: string, targetPhase: AuditPhase): Promise<{ 
  canProceed: boolean; 
  blockers: string[];
  passedChecks: string[];
}> {
  const prerequisite = PHASE_PREREQUISITES[targetPhase];
  const blockers: string[] = [];
  const passedChecks: string[] = [];

  if (!prerequisite || !prerequisite.requiredPhase) {
    return { canProceed: true, blockers: [], passedChecks: [] };
  }

  const engagement = await db.engagement.findUnique({
    where: { id: engagementId },
    include: {
      team: true,
      independenceDeclarations: true,
      engagementLetters: true,
      materialityAssessments: true,
      riskAssessments: true,
      auditStrategy: true,
      engagementProcedures: true,
      goingConcernAssessment: true,
      subsequentEvents: true,
      auditReport: true,
      eqcrAssignment: true,
    },
  });

  if (!engagement) {
    return { canProceed: false, blockers: ["Engagement not found"], passedChecks: [] };
  }

  const currentPhaseIndex = PHASE_ORDER.indexOf(engagement.currentPhase);
  const targetPhaseIndex = PHASE_ORDER.indexOf(targetPhase);

  if (targetPhaseIndex > currentPhaseIndex + 1) {
    blockers.push(`Cannot skip phases. Complete ${PHASE_ORDER[currentPhaseIndex + 1]} first.`);
  }

  for (const check of prerequisite.checks) {
    let passed = false;
    
    switch (check) {
      case "engagement_letter_signed":
        passed = engagement.engagementLetterSigned;
        break;
      case "independence_declared":
        passed = engagement.independenceCleared;
        break;
      case "team_assigned":
        passed = engagement.team.length > 0;
        break;
      case "kyc_completed":
        passed = engagement.amlScreeningDone;
        break;
      case "risk_assessment_started":
        passed = engagement.riskAssessments.length > 0;
        break;
      case "materiality_set":
        passed = engagement.materialityAssessments.some((m: any) => m.overallMateriality !== null);
        break;
      case "risk_assessment_completed":
        passed = engagement.riskAssessments.some((r: any) => r.significantRisk || r.materialMisstatementRisk);
        break;
      case "audit_strategy_approved":
        passed = engagement.auditStrategy !== null;
        break;
      case "procedures_completed":
        const totalProcs = engagement.engagementProcedures.length;
        const completedProcs = engagement.engagementProcedures.filter(
          (p: any) => p.status === "COMPLETED" || p.status === "REVIEWED"
        ).length;
        passed = totalProcs > 0 && completedProcs === totalProcs;
        break;
      case "findings_resolved":
        passed = true;
        break;
      case "manager_reviewed":
        passed = engagement.engagementProcedures.every((p: any) => p.reviewedById !== null);
        break;
      case "completion_checklist_done":
        passed = engagement.finalizationLocked || engagement.currentPhase === "FINALIZATION";
        break;
      case "going_concern_assessed":
        passed = engagement.goingConcernAssessment !== null;
        break;
      case "subsequent_events_reviewed":
        passed = true;
        break;
      case "audit_report_drafted":
        passed = engagement.auditReport !== null;
        break;
      case "partner_approved":
        passed = engagement.auditReport?.partnerApprovedAt !== null;
        break;
      case "eqcr_completed":
        passed = engagement.eqcrAssignment?.status === "COMPLETED";
        break;
      case "file_assembled":
        passed = true;
        break;
      default:
        passed = true;
    }

    if (passed) {
      passedChecks.push(check);
    } else {
      blockers.push(`Prerequisite not met: ${check.replace(/_/g, " ")}`);
    }
  }

  return {
    canProceed: blockers.length === 0,
    blockers,
    passedChecks,
  };
}

router.get("/phase-gate/:engagementId/:targetPhase", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId, targetPhase } = req.params;
    
    if (!PHASE_ORDER.includes(targetPhase as AuditPhase)) {
      return res.status(400).json({ error: "Invalid target phase" });
    }

    const result = await validatePhaseGate(engagementId, targetPhase as AuditPhase);
    
    await db.phaseGateCheck.upsert({
      where: {
        id: `${engagementId}-${targetPhase}`,
      },
      create: {
        id: `${engagementId}-${targetPhase}`,
        engagementId,
        phase: targetPhase as AuditPhase,
        prerequisitePhase: PHASE_PREREQUISITES[targetPhase].requiredPhase,
        checkType: "AUTOMATED",
        checkDescription: `Phase gate validation for ${targetPhase}`,
        isPassed: result.canProceed,
        checkedAt: new Date(),
        checkedById: req.user!.id,
        blockerReason: result.blockers.length > 0 ? result.blockers.join("; ") : null,
      },
      update: {
        isPassed: result.canProceed,
        checkedAt: new Date(),
        checkedById: req.user!.id,
        blockerReason: result.blockers.length > 0 ? result.blockers.join("; ") : null,
      },
    });

    res.json(result);
  } catch (error) {
    console.error("Phase gate check error:", error);
    res.status(500).json({ error: "Failed to validate phase gate" });
  }
});

router.post("/advance-phase/:engagementId", requireAuth, requireMinRole("MANAGER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    
    const engagement = await db.engagement.findUnique({
      where: { id: engagementId },
    });

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    const currentIndex = PHASE_ORDER.indexOf(engagement.currentPhase);
    if (currentIndex >= PHASE_ORDER.length - 1) {
      return res.status(400).json({ error: "Engagement is already at final phase" });
    }

    const nextPhase = PHASE_ORDER[currentIndex + 1];
    const gateResult = await validatePhaseGate(engagementId, nextPhase);

    if (!gateResult.canProceed) {
      return res.status(400).json({
        error: "Cannot advance to next phase",
        blockers: gateResult.blockers,
      });
    }

    const updated = await db.engagement.update({
      where: { id: engagementId },
      data: {
        currentPhase: nextPhase,
        [`${engagement.currentPhase.toLowerCase()}Locked`]: true,
      },
    });

    res.json({ 
      success: true, 
      previousPhase: engagement.currentPhase,
      currentPhase: updated.currentPhase 
    });
  } catch (error) {
    console.error("Advance phase error:", error);
    res.status(500).json({ error: "Failed to advance phase" });
  }
});

router.get("/procedure-library", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { category, type, search } = req.query;
    
    const where: any = { isActive: true };
    if (category) where.category = category;
    if (type) where.procedureType = type;
    if (search) {
      where.OR = [
        { title: { contains: search as string, mode: "insensitive" } },
        { description: { contains: search as string, mode: "insensitive" } },
        { code: { contains: search as string, mode: "insensitive" } },
      ];
    }

    const procedures = await db.masterProcedureLibrary.findMany({
      where,
      orderBy: [{ category: "asc" }, { code: "asc" }],
    });

    res.json(procedures);
  } catch (error) {
    console.error("Get procedure library error:", error);
    res.status(500).json({ error: "Failed to get procedure library" });
  }
});

router.post("/procedure-library", requireAuth, requireMinRole("MANAGER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const schema = z.object({
      code: z.string().min(1),
      title: z.string().min(1),
      description: z.string().optional(),
      category: z.enum(["PRE_PLANNING", "PLANNING", "EXECUTION", "FINALIZATION", "QUALITY_REVIEW"]),
      procedureType: z.enum([
        "CHECKLIST", "TEST_OF_CONTROL", "SUBSTANTIVE_ANALYTICAL", "TEST_OF_DETAILS",
        "WALKTHROUGH", "INQUIRY", "OBSERVATION", "INSPECTION", "CONFIRMATION",
        "RECALCULATION", "REPERFORMANCE"
      ]),
      isaReferences: z.array(z.string()).default([]),
      assertions: z.array(z.string()).default([]),
      applicableCycles: z.array(z.string()).default([]),
      applicableAccounts: z.array(z.string()).default([]),
      defaultSampleSize: z.number().optional(),
      samplingMethod: z.string().optional(),
      templateContent: z.any().optional(),
    });

    const data = schema.parse(req.body);

    const procedure = await db.masterProcedureLibrary.create({
      data: {
        ...data,
        firmId: req.user!.firmId,
        createdById: req.user!.id,
      },
    });

    res.status(201).json(procedure);
  } catch (error) {
    console.error("Create procedure error:", error);
    res.status(500).json({ error: "Failed to create procedure" });
  }
});

router.get("/engagement-procedures/:engagementId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const { category, status } = req.query;

    const where: any = { engagementId };
    if (category) where.category = category;
    if (status) where.status = status;

    const procedures = await db.engagementProcedure.findMany({
      where,
      include: {
        libraryProcedure: true,
        workpapers: true,
        journalEntryTests: true,
      },
      orderBy: [{ category: "asc" }, { createdAt: "asc" }],
    });

    res.json(procedures);
  } catch (error) {
    console.error("Get engagement procedures error:", error);
    res.status(500).json({ error: "Failed to get engagement procedures" });
  }
});

router.post("/engagement-procedures/:engagementId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const schema = z.object({
      libraryProcedureId: z.string().optional(),
      title: z.string().min(1),
      description: z.string().optional(),
      category: z.enum(["PRE_PLANNING", "PLANNING", "EXECUTION", "FINALIZATION", "QUALITY_REVIEW"]),
      procedureType: z.enum([
        "CHECKLIST", "TEST_OF_CONTROL", "SUBSTANTIVE_ANALYTICAL", "TEST_OF_DETAILS",
        "WALKTHROUGH", "INQUIRY", "OBSERVATION", "INSPECTION", "CONFIRMATION",
        "RECALCULATION", "REPERFORMANCE"
      ]),
      isaReferences: z.array(z.string()).default([]),
      assertions: z.array(z.string()).default([]),
      linkedRiskIds: z.array(z.string()).default([]),
      linkedAccountIds: z.array(z.string()).default([]),
      sampleSize: z.number().optional(),
      samplingMethod: z.string().optional(),
    });

    const data = schema.parse(req.body);
    
    const existingCount = await db.engagementProcedure.count({
      where: { engagementId },
    });
    const workpaperRef = `WP-${String(existingCount + 1).padStart(4, "0")}`;

    const procedure = await db.engagementProcedure.create({
      data: {
        ...data,
        engagementId,
        workpaperRef,
        performedById: req.user!.id,
      },
      include: { libraryProcedure: true },
    });

    res.status(201).json(procedure);
  } catch (error) {
    console.error("Create engagement procedure error:", error);
    res.status(500).json({ error: "Failed to create engagement procedure" });
  }
});

router.patch("/engagement-procedures/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const schema = z.object({
      status: z.string().optional(),
      conclusion: z.string().optional(),
      conclusionType: z.string().optional(),
      exceptionsFound: z.number().optional(),
      reviewNotes: z.string().optional(),
    });

    const data = schema.parse(req.body);
    let updateData: any = { ...data };

    if (data.status === "COMPLETED" && !data.conclusion) {
      updateData.performedAt = new Date();
    }

    if (data.status === "REVIEWED") {
      updateData.reviewedById = req.user!.id;
      updateData.reviewedAt = new Date();
    }

    const procedure = await db.engagementProcedure.update({
      where: { id },
      data: updateData,
    });

    res.json(procedure);
  } catch (error) {
    console.error("Update engagement procedure error:", error);
    res.status(500).json({ error: "Failed to update procedure" });
  }
});

router.get("/workpapers/:engagementId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const { phase, status } = req.query;

    const where: any = { engagementId };
    if (phase) where.phase = phase;
    if (status) where.status = status;

    const workpapers = await db.workpaperRegistry.findMany({
      where,
      include: {
        versions: { orderBy: { version: "desc" }, take: 1 },
        evidenceLinks: true,
        procedure: true,
      },
      orderBy: { workpaperRef: "asc" },
    });

    res.json(workpapers);
  } catch (error) {
    console.error("Get workpapers error:", error);
    res.status(500).json({ error: "Failed to get workpapers" });
  }
});

router.post("/workpapers/:engagementId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const schema = z.object({
      title: z.string().min(1),
      description: z.string().optional(),
      phase: z.enum(["ONBOARDING", "PRE_PLANNING", "PLANNING", "EXECUTION", "FINALIZATION", "REPORTING", "EQCR", "INSPECTION"]),
      section: z.string().optional(),
      fsArea: z.string().optional(),
      procedureId: z.string().optional(),
      linkedRiskIds: z.array(z.string()).default([]),
      linkedAssertions: z.array(z.string()).default([]),
      content: z.any().optional(),
    });

    const data = schema.parse(req.body);
    
    const existingCount = await db.workpaperRegistry.count({
      where: { engagementId },
    });
    const workpaperRef = `WP-${String(existingCount + 1).padStart(4, "0")}`;

    const workpaper = await db.workpaperRegistry.create({
      data: {
        engagementId,
        workpaperRef,
        title: data.title,
        description: data.description,
        phase: data.phase,
        section: data.section,
        fsArea: data.fsArea,
        procedureId: data.procedureId,
        linkedRiskIds: data.linkedRiskIds,
        linkedAssertions: data.linkedAssertions,
        preparedById: req.user!.id,
        preparedAt: new Date(),
      },
    });

    if (data.content) {
      await db.workpaperVersion.create({
        data: {
          workpaperId: workpaper.id,
          version: 1,
          content: data.content,
          changedById: req.user!.id,
        },
      });
    }

    res.status(201).json(workpaper);
  } catch (error) {
    console.error("Create workpaper error:", error);
    res.status(500).json({ error: "Failed to create workpaper" });
  }
});

router.get("/journal-tests/:engagementId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;

    const tests = await db.journalEntryTest.findMany({
      where: { engagementId },
      include: {
        testItems: true,
        procedure: true,
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(tests);
  } catch (error) {
    console.error("Get journal tests error:", error);
    res.status(500).json({ error: "Failed to get journal tests" });
  }
});

router.post("/journal-tests/:engagementId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const schema = z.object({
      procedureId: z.string().optional(),
      testingPeriod: z.string().optional(),
      populationSource: z.string().optional(),
      populationSize: z.number().optional(),
      selectionCriteria: z.any().optional(),
      samplingMethod: z.string().optional(),
      sampleSize: z.number().optional(),
      riskFactorsConsidered: z.array(z.string()).default([]),
      fraudIndicatorsUsed: z.array(z.string()).default([]),
    });

    const data = schema.parse(req.body);

    const existingCount = await db.journalEntryTest.count({
      where: { engagementId },
    });
    const workpaperRef = `JE-${String(existingCount + 1).padStart(4, "0")}`;

    const test = await db.journalEntryTest.create({
      data: {
        ...data,
        engagementId,
        workpaperRef,
        performedById: req.user!.id,
      },
    });

    res.status(201).json(test);
  } catch (error) {
    console.error("Create journal test error:", error);
    res.status(500).json({ error: "Failed to create journal test" });
  }
});

router.post("/journal-test-items/:testId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { testId } = req.params;
    const schema = z.object({
      jeNumber: z.string().optional(),
      jeDate: z.string().optional(),
      entryType: z.enum([
        "STANDARD", "MANUAL", "PERIOD_END", "POST_CLOSING", 
        "THIRTEENTH_MONTH", "REVERSING", "ADJUSTMENT", "OVERRIDE"
      ]),
      accountCode: z.string().optional(),
      accountName: z.string().optional(),
      debitAmount: z.number().optional(),
      creditAmount: z.number().optional(),
      description: z.string().optional(),
      preparedBy: z.string().optional(),
      approvedBy: z.string().optional(),
      testingPerformed: z.string().optional(),
      evidenceObtained: z.string().optional(),
      isException: z.boolean().default(false),
      exceptionDescription: z.string().optional(),
      conclusion: z.string().optional(),
    });

    const data = schema.parse(req.body);

    const item = await db.journalEntryTestItem.create({
      data: {
        ...data,
        journalTestId: testId,
        jeDate: data.jeDate ? new Date(data.jeDate) : null,
        testedById: req.user!.id,
        testedAt: new Date(),
      },
    });

    if (data.isException) {
      await db.journalEntryTest.update({
        where: { id: testId },
        data: { exceptionsIdentified: { increment: 1 } },
      });
    }

    res.status(201).json(item);
  } catch (error) {
    console.error("Create journal test item error:", error);
    res.status(500).json({ error: "Failed to create journal test item" });
  }
});

router.get("/adjustments/:engagementId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const { type, status } = req.query;

    const where: any = { engagementId };
    if (type) where.adjustmentType = type;
    if (status) where.status = status;

    const adjustments = await db.auditAdjustment.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    const summary = {
      totalAdjustments: adjustments.length,
      corrected: adjustments.filter((a: any) => a.adjustmentType === "CORRECTED").length,
      uncorrected: adjustments.filter((a: any) => a.adjustmentType === "UNCORRECTED").length,
      totalDebitImpact: adjustments.reduce((sum: number, a: any) => sum + (Number(a.debitAmount) || 0), 0),
      totalCreditImpact: adjustments.reduce((sum: number, a: any) => sum + (Number(a.creditAmount) || 0), 0),
      materialAdjustments: adjustments.filter((a: any) => a.isMaterial).length,
    };

    res.json({ adjustments, summary });
  } catch (error) {
    console.error("Get adjustments error:", error);
    res.status(500).json({ error: "Failed to get adjustments" });
  }
});

router.post("/adjustments/:engagementId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const schema = z.object({
      adjustmentType: z.enum(["CORRECTED", "UNCORRECTED", "RECLASSIFICATION", "DISCLOSURE"]),
      fsArea: z.string().optional(),
      accountCode: z.string().optional(),
      accountName: z.string().optional(),
      description: z.string().min(1),
      auditImpact: z.string().optional(),
      debitAmount: z.number().optional(),
      creditAmount: z.number().optional(),
      isMaterial: z.boolean().default(false),
      materialityImpact: z.string().optional(),
      linkedProcedureId: z.string().optional(),
      linkedWorkpaperId: z.string().optional(),
    });

    const data = schema.parse(req.body);

    const existingCount = await db.auditAdjustment.count({
      where: { engagementId },
    });
    const adjustmentRef = `ADJ-${String(existingCount + 1).padStart(4, "0")}`;

    const netImpact = (data.debitAmount || 0) - (data.creditAmount || 0);

    const adjustment = await db.auditAdjustment.create({
      data: {
        ...data,
        engagementId,
        adjustmentRef,
        netImpact,
        identifiedById: req.user!.id,
        identifiedAt: new Date(),
      },
    });

    res.status(201).json(adjustment);
  } catch (error) {
    console.error("Create adjustment error:", error);
    res.status(500).json({ error: "Failed to create adjustment" });
  }
});

router.patch("/adjustments/:id/status", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const schema = z.object({
      status: z.enum(["IDENTIFIED", "PROPOSED", "AGREED_POSTED", "AGREED_NOT_POSTED", "DISPUTED", "WAIVED"]),
      managementResponse: z.string().optional(),
      waiverReason: z.string().optional(),
    });

    const data = schema.parse(req.body);
    const updateData: any = { status: data.status };

    if (data.managementResponse) {
      updateData.managementResponse = data.managementResponse;
      updateData.managementResponseById = req.user!.id;
      updateData.managementResponseAt = new Date();
    }

    if (data.status === "WAIVED") {
      if (req.user!.role !== "PARTNER") {
        return res.status(403).json({ error: "Only partners can waive adjustments" });
      }
      updateData.waivedById = req.user!.id;
      updateData.waivedAt = new Date();
      updateData.waiverReason = data.waiverReason;
      updateData.partnerApprovedWaiver = true;
    }

    const adjustment = await db.auditAdjustment.update({
      where: { id },
      data: updateData,
    });

    res.json(adjustment);
  } catch (error) {
    console.error("Update adjustment status error:", error);
    res.status(500).json({ error: "Failed to update adjustment status" });
  }
});

router.get("/qcr-readiness/:engagementId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;

    const checks = await db.qCRReadinessCheck.findMany({
      where: { engagementId },
      orderBy: [{ checkCategory: "asc" }, { createdAt: "asc" }],
    });

    const categories = [
      { name: "Engagement Acceptance", isa: "ISA 210, 220" },
      { name: "Independence & Ethics", isa: "IESBA, ICAP Code" },
      { name: "Planning", isa: "ISA 300, 315, 320" },
      { name: "Risk Assessment", isa: "ISA 315, 240" },
      { name: "Execution", isa: "ISA 330, 500, 501" },
      { name: "Finalization", isa: "ISA 560, 570, 580" },
      { name: "Reporting", isa: "ISA 700, 705, 706" },
      { name: "Documentation", isa: "ISA 230" },
      { name: "Quality Control", isa: "ISQM 1, ISA 220" },
    ];

    const summary = categories.map(cat => {
      const catChecks = checks.filter((c: any) => c.checkCategory === cat.name);
      return {
        category: cat.name,
        isaReference: cat.isa,
        totalItems: catChecks.length,
        compliant: catChecks.filter((c: any) => c.isCompliant === true).length,
        nonCompliant: catChecks.filter((c: any) => c.isCompliant === false).length,
        notChecked: catChecks.filter((c: any) => c.status === "NOT_CHECKED").length,
      };
    });

    const totalItems = checks.length;
    const compliantItems = checks.filter((c: any) => c.isCompliant === true).length;
    const readinessScore = totalItems > 0 ? Math.round((compliantItems / totalItems) * 100) : 0;

    res.json({
      checks,
      summary,
      overall: {
        totalItems,
        compliantItems,
        nonCompliantItems: checks.filter((c: any) => c.isCompliant === false).length,
        notCheckedItems: checks.filter((c: any) => c.status === "NOT_CHECKED").length,
        readinessScore,
      },
    });
  } catch (error) {
    console.error("Get QCR readiness error:", error);
    res.status(500).json({ error: "Failed to get QCR readiness" });
  }
});

router.post("/qcr-readiness/:engagementId/initialize", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;

    const checklistItems = [
      { category: "Engagement Acceptance", item: "Engagement letter signed by both parties", isa: "ISA 210" },
      { category: "Engagement Acceptance", item: "Client acceptance/continuance documented", isa: "ISA 220" },
      { category: "Engagement Acceptance", item: "Terms of engagement agreed", isa: "ISA 210" },
      { category: "Independence & Ethics", item: "Independence declarations obtained from all team members", isa: "IESBA" },
      { category: "Independence & Ethics", item: "Conflicts of interest assessed and documented", isa: "IESBA" },
      { category: "Independence & Ethics", item: "Ethics confirmations obtained", isa: "ICAP Code" },
      { category: "Planning", item: "Understanding of entity and environment documented", isa: "ISA 315" },
      { category: "Planning", item: "Materiality calculated and documented", isa: "ISA 320" },
      { category: "Planning", item: "Audit strategy and plan approved", isa: "ISA 300" },
      { category: "Risk Assessment", item: "Significant risks identified and documented", isa: "ISA 315" },
      { category: "Risk Assessment", item: "Fraud risk factors assessed", isa: "ISA 240" },
      { category: "Risk Assessment", item: "Risk assessment at assertion level completed", isa: "ISA 315" },
      { category: "Execution", item: "All planned procedures performed", isa: "ISA 330" },
      { category: "Execution", item: "Sufficient appropriate audit evidence obtained", isa: "ISA 500" },
      { category: "Execution", item: "External confirmations sent and received", isa: "ISA 505" },
      { category: "Execution", item: "Journal entry testing performed", isa: "ISA 240" },
      { category: "Finalization", item: "Subsequent events reviewed", isa: "ISA 560" },
      { category: "Finalization", item: "Going concern assessment completed", isa: "ISA 570" },
      { category: "Finalization", item: "Written representations obtained", isa: "ISA 580" },
      { category: "Reporting", item: "Audit opinion appropriate to findings", isa: "ISA 700" },
      { category: "Reporting", item: "Key audit matters identified (if applicable)", isa: "ISA 701" },
      { category: "Documentation", item: "Workpapers properly indexed and cross-referenced", isa: "ISA 230" },
      { category: "Documentation", item: "Audit file assembly completed within 60 days", isa: "ISA 230" },
      { category: "Quality Control", item: "Engagement partner review completed", isa: "ISA 220" },
      { category: "Quality Control", item: "EQCR performed (if required)", isa: "ISQM 1" },
    ];

    const createData = checklistItems.map(item => ({
      engagementId,
      checkCategory: item.category,
      checkItem: item.item,
      isaReference: item.isa,
      status: "NOT_CHECKED",
    }));

    await db.qCRReadinessCheck.createMany({
      data: createData,
      skipDuplicates: true,
    });

    const checks = await db.qCRReadinessCheck.findMany({
      where: { engagementId },
      orderBy: [{ checkCategory: "asc" }, { createdAt: "asc" }],
    });

    res.json(checks);
  } catch (error) {
    console.error("Initialize QCR readiness error:", error);
    res.status(500).json({ error: "Failed to initialize QCR readiness checklist" });
  }
});

router.patch("/qcr-readiness/:checkId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { checkId } = req.params;
    const schema = z.object({
      status: z.string().optional(),
      isCompliant: z.boolean().optional(),
      evidenceRef: z.string().optional(),
      comments: z.string().optional(),
    });

    const data = schema.parse(req.body);

    const check = await db.qCRReadinessCheck.update({
      where: { id: checkId },
      data: {
        ...data,
        checkedById: req.user!.id,
        checkedAt: new Date(),
      },
    });

    res.json(check);
  } catch (error) {
    console.error("Update QCR check error:", error);
    res.status(500).json({ error: "Failed to update QCR check" });
  }
});

router.post("/file-lock/:engagementId", requireAuth, requireMinRole("PARTNER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const schema = z.object({
      lockType: z.string().optional(),
      lockReason: z.string().optional(),
      retentionPeriodYears: z.number().default(7),
    });

    const data = schema.parse(req.body);

    const gateResult = await validatePhaseGate(engagementId, "INSPECTION");
    if (!gateResult.canProceed) {
      return res.status(400).json({
        error: "Cannot lock file - prerequisites not met",
        blockers: gateResult.blockers,
      });
    }

    const fileLock = await db.engagementFileLock.upsert({
      where: { engagementId },
      create: {
        engagementId,
        isLocked: true,
        lockType: data.lockType || "POST_ISSUANCE",
        lockedAt: new Date(),
        lockedById: req.user!.id,
        lockReason: data.lockReason || "Audit report issued",
        reportIssuedAt: new Date(),
        archivalDueDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        retentionPeriodYears: data.retentionPeriodYears,
      },
      update: {
        isLocked: true,
        lockedAt: new Date(),
        lockedById: req.user!.id,
        lockReason: data.lockReason,
      },
    });

    await db.engagement.update({
      where: { id: engagementId },
      data: {
        status: "COMPLETED",
        onboardingLocked: true,
        planningLocked: true,
        executionLocked: true,
        finalizationLocked: true,
      },
    });

    res.json(fileLock);
  } catch (error) {
    console.error("File lock error:", error);
    res.status(500).json({ error: "Failed to lock engagement file" });
  }
});

router.get("/independence-breaches", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firmId = req.user!.firmId;
    if (!firmId) {
      return res.status(400).json({ error: "User not associated with a firm" });
    }

    const { engagementId, severity, resolved } = req.query;
    const where: any = { firmId };
    if (engagementId) where.engagementId = engagementId;
    if (severity) where.severity = severity;
    if (resolved === "true") where.resolvedDate = { not: null };
    if (resolved === "false") where.resolvedDate = null;

    const breaches = await db.independenceBreach.findMany({
      where,
      orderBy: { identifiedDate: "desc" },
    });

    res.json(breaches);
  } catch (error) {
    console.error("Get independence breaches error:", error);
    res.status(500).json({ error: "Failed to get independence breaches" });
  }
});

router.post("/independence-breaches", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const schema = z.object({
      engagementId: z.string().optional(),
      breachType: z.string().min(1),
      description: z.string().min(1),
      identifiedDate: z.string(),
      affectedUserId: z.string().optional(),
      affectedClientId: z.string().optional(),
      severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
      safeguardsApplied: z.string().optional(),
    });

    const data = schema.parse(req.body);

    const breach = await db.independenceBreach.create({
      data: {
        firmId: req.user!.firmId!,
        engagementId: data.engagementId,
        breachType: data.breachType,
        description: data.description,
        identifiedDate: new Date(data.identifiedDate),
        affectedUserId: data.affectedUserId,
        affectedClientId: data.affectedClientId,
        severity: data.severity,
        safeguardsApplied: data.safeguardsApplied,
        identifiedById: req.user!.id,
      },
    });

    res.status(201).json(breach);
  } catch (error) {
    console.error("Create independence breach error:", error);
    res.status(500).json({ error: "Failed to create independence breach" });
  }
});

router.patch("/independence-breaches/:id/resolve", requireAuth, requireMinRole("PARTNER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const schema = z.object({
      resolution: z.string().min(1),
      partnerDecision: z.string().min(1),
    });

    const data = schema.parse(req.body);

    const breach = await db.independenceBreach.update({
      where: { id },
      data: {
        resolution: data.resolution,
        resolvedDate: new Date(),
        reportedToPartner: true,
        reportedDate: new Date(),
        partnerDecision: data.partnerDecision,
        reviewedById: req.user!.id,
      },
    });

    res.json(breach);
  } catch (error) {
    console.error("Resolve independence breach error:", error);
    res.status(500).json({ error: "Failed to resolve independence breach" });
  }
});

router.get("/isa-compliance/:engagementId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;

    const engagement = await db.engagement.findUnique({
      where: { id: engagementId },
      include: {
        engagementLetters: true,
        independenceDeclarations: true,
        materialityAssessments: true,
        riskAssessments: true,
        auditStrategy: true,
        engagementProcedures: true,
        journalEntryTests: true,
        goingConcernAssessment: true,
        subsequentEvents: true,
        auditReport: true,
        eqcrAssignment: true,
        workpaperRegistry: true,
      },
    });

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    const isaCompliance = [
      {
        isa: "ISA 200",
        title: "Overall Objectives",
        status: engagement.status !== "DRAFT" ? "COMPLIANT" : "IN_PROGRESS",
        evidence: "Engagement established and active",
      },
      {
        isa: "ISA 210",
        title: "Terms of Engagement",
        status: engagement.engagementLetterSigned ? "COMPLIANT" : "NON_COMPLIANT",
        evidence: engagement.engagementLetterSigned 
          ? `Engagement letter signed on ${engagement.engagementLetterSignedDate?.toLocaleDateString()}`
          : "Engagement letter not yet signed",
      },
      {
        isa: "ISA 220",
        title: "Quality Control",
        status: engagement.team.length > 0 ? "COMPLIANT" : "NON_COMPLIANT",
        evidence: `Team of ${engagement.team.length} assigned`,
      },
      {
        isa: "ISA 230",
        title: "Documentation",
        status: engagement.workpaperRegistry.length > 0 ? "COMPLIANT" : "IN_PROGRESS",
        evidence: `${engagement.workpaperRegistry.length} workpapers documented`,
      },
      {
        isa: "ISA 240",
        title: "Fraud",
        status: engagement.journalEntryTests.length > 0 ? "COMPLIANT" : "NOT_STARTED",
        evidence: `${engagement.journalEntryTests.length} journal entry tests performed`,
      },
      {
        isa: "ISA 300",
        title: "Planning",
        status: engagement.auditStrategy ? "COMPLIANT" : engagement.planningLocked ? "IN_PROGRESS" : "NOT_STARTED",
        evidence: engagement.auditStrategy ? "Audit strategy documented" : "Planning in progress",
      },
      {
        isa: "ISA 315",
        title: "Risk Assessment",
        status: engagement.riskAssessments.length > 0 ? "COMPLIANT" : "NOT_STARTED",
        evidence: `${engagement.riskAssessments.length} risks identified`,
      },
      {
        isa: "ISA 320",
        title: "Materiality",
        status: engagement.materialityAssessments.some((m: any) => m.overallMateriality) ? "COMPLIANT" : "NOT_STARTED",
        evidence: engagement.materialityAssessments[0]?.overallMateriality 
          ? `Materiality set at ${engagement.materialityAssessments[0].overallMateriality}`
          : "Materiality not yet determined",
      },
      {
        isa: "ISA 330",
        title: "Responses to Risks",
        status: engagement.engagementProcedures.length > 0 ? "COMPLIANT" : "NOT_STARTED",
        evidence: `${engagement.engagementProcedures.length} audit procedures designed`,
      },
      {
        isa: "ISA 500",
        title: "Audit Evidence",
        status: engagement.engagementProcedures.filter((p: any) => p.status === "COMPLETED").length > 0 ? "COMPLIANT" : "IN_PROGRESS",
        evidence: `${engagement.engagementProcedures.filter((p: any) => p.status === "COMPLETED").length} procedures completed`,
      },
      {
        isa: "ISA 560",
        title: "Subsequent Events",
        status: engagement.subsequentEvents.length > 0 ? "COMPLIANT" : engagement.currentPhase === "FINALIZATION" ? "IN_PROGRESS" : "NOT_STARTED",
        evidence: `${engagement.subsequentEvents.length} events reviewed`,
      },
      {
        isa: "ISA 570",
        title: "Going Concern",
        status: engagement.goingConcernAssessment ? "COMPLIANT" : "NOT_STARTED",
        evidence: engagement.goingConcernAssessment ? "Assessment completed" : "Assessment pending",
      },
      {
        isa: "ISA 700",
        title: "Audit Report",
        status: engagement.auditReport ? "COMPLIANT" : "NOT_STARTED",
        evidence: engagement.auditReport ? `Opinion: ${engagement.auditReport.opinionType}` : "Report not yet issued",
      },
    ];

    const summary = {
      total: isaCompliance.length,
      compliant: isaCompliance.filter(i => i.status === "COMPLIANT").length,
      inProgress: isaCompliance.filter(i => i.status === "IN_PROGRESS").length,
      nonCompliant: isaCompliance.filter(i => i.status === "NON_COMPLIANT").length,
      notStarted: isaCompliance.filter(i => i.status === "NOT_STARTED").length,
      complianceScore: Math.round((isaCompliance.filter(i => i.status === "COMPLIANT").length / isaCompliance.length) * 100),
    };

    res.json({ standards: isaCompliance, summary });
  } catch (error) {
    console.error("Get ISA compliance error:", error);
    res.status(500).json({ error: "Failed to get ISA compliance matrix" });
  }
});

export default router;
