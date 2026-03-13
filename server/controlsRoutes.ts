import { Router, Response } from "express";
import { z } from "zod";
import { prisma } from "./db";
import { requireAuth, requireMinRole, logAuditTrail, AuthenticatedRequest } from "./auth";
import { requirePhaseInProgress, preventDeletionAfterFinalization } from "./middleware/auditLock";
import { validateEngagementAccess } from "./lib/validateEngagementAccess";

const router = Router();

);

router.get("/:engagementId/controls", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) {
      return res.status(access.error === "User not associated with a firm" ? 400 : 404).json({ error: access.error });
    }
    
    const controls = await prisma.internalControl.findMany({
      where: { engagementId: req.params.engagementId },
      include: {
        documentedBy: { select: { id: true, fullName: true, role: true } },
        walkthroughs: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        tests: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        deficiencies: {
          where: { remediationStatus: { not: "REMEDIATED" } },
        },
      },
      orderBy: [{ cycle: "asc" }, { controlId: "asc" }],
    });
    res.json(controls);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch controls", details: error.message });
  }
});

router.get("/:engagementId/controls/by-cycle/:cycle", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) {
      return res.status(access.error === "User not associated with a firm" ? 400 : 404).json({ error: access.error });
    }
    
    const controls = await prisma.internalControl.findMany({
      where: { 
        engagementId: req.params.engagementId,
        cycle: req.params.cycle as any,
      },
      include: {
        documentedBy: { select: { id: true, fullName: true, role: true } },
        walkthroughs: {
          orderBy: { createdAt: "desc" },
          include: {
            performedBy: { select: { id: true, fullName: true, role: true } },
            reviewedBy: { select: { id: true, fullName: true, role: true } },
          },
        },
        tests: {
          orderBy: { createdAt: "desc" },
          include: {
            performedBy: { select: { id: true, fullName: true, role: true } },
            reviewedBy: { select: { id: true, fullName: true, role: true } },
            managerApprovedBy: { select: { id: true, fullName: true, role: true } },
          },
        },
        deficiencies: true,
      },
      orderBy: { controlId: "asc" },
    });
    res.json(controls);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch controls by cycle", details: error.message });
  }
});

router.post("/:engagementId/controls", requireAuth, requirePhaseInProgress("EXECUTION"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) {
      return res.status(access.error === "User not associated with a firm" ? 400 : 404).json({ error: access.error });
    }
    
    const data = internalControlSchema.parse(req.body);
    
    const control = await prisma.internalControl.create({
      data: {
        ...data,
        engagementId: req.params.engagementId,
        documentedById: req.user!.id,
      },
      include: {
        documentedBy: { select: { id: true, fullName: true, role: true } },
      },
    });

    await logAuditTrail(
      req.user!.id,
      "CONTROL_DOCUMENTED",
      "internal_control",
      control.id,
      null,
      control,
      req.params.engagementId,
      `Control ${data.controlId} documented for ${data.cycle} cycle`,
      req.ip,
      req.get("user-agent")
    );

    res.status(201).json(control);
  } catch (error: any) {
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to create control", details: error.message });
  }
});

router.patch("/:engagementId/controls/:controlId", requireAuth, requirePhaseInProgress("EXECUTION"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) {
      return res.status(access.error === "User not associated with a firm" ? 400 : 404).json({ error: access.error });
    }
    
    const existing = await prisma.internalControl.findUnique({
      where: { id: req.params.controlId },
    });

    if (!existing) {
      return res.status(404).json({ error: "Control not found" });
    }

    const control = await prisma.internalControl.update({
      where: { id: req.params.controlId },
      data: req.body,
      include: {
        documentedBy: { select: { id: true, fullName: true, role: true } },
      },
    });

    await logAuditTrail(
      req.user!.id,
      "CONTROL_UPDATED",
      "internal_control",
      control.id,
      existing,
      control,
      req.params.engagementId,
      `Control ${control.controlId} updated`,
      req.ip,
      req.get("user-agent")
    );

    res.json(control);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to update control", details: error.message });
  }
});

const walkthroughSchema = z.object({
  controlId: z.string().min(1),
  walkthroughDate: z.coerce.date(),
  walkthroughNarrative: z.string().optional(),
  designAssessment: z.enum(ASSESSMENT_RESULTS).default("NOT_TESTED"),
  designComments: z.string().optional(),
  designDeficiencyNoted: z.boolean().default(false),
  implementationAssessment: z.enum(ASSESSMENT_RESULTS).default("NOT_TESTED"),
  implementationComments: z.string().optional(),
  implementationDeficiencyNoted: z.boolean().default(false),
  evidenceReferences: z.array(z.string()).default([]),
});

router.post("/:engagementId/walkthroughs", requireAuth, requirePhaseInProgress("EXECUTION"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) {
      return res.status(access.error === "User not associated with a firm" ? 400 : 404).json({ error: access.error });
    }
    
    const data = walkthroughSchema.parse(req.body);
    
    const walkthrough = await prisma.controlWalkthrough.create({
      data: {
        ...data,
        engagementId: req.params.engagementId,
        performedById: req.user!.id,
      },
      include: {
        performedBy: { select: { id: true, fullName: true, role: true } },
        control: { select: { controlId: true, cycle: true, controlDescription: true } },
      },
    });

    await logAuditTrail(
      req.user!.id,
      "WALKTHROUGH_PERFORMED",
      "control_walkthrough",
      walkthrough.id,
      null,
      walkthrough,
      req.params.engagementId,
      `Walkthrough performed for control ${walkthrough.control.controlId}`,
      req.ip,
      req.get("user-agent")
    );

    res.status(201).json(walkthrough);
  } catch (error: any) {
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to create walkthrough", details: error.message });
  }
});

router.post("/:engagementId/walkthroughs/:walkthroughId/review", requireAuth, requireMinRole("SENIOR"), requirePhaseInProgress("EXECUTION"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) {
      return res.status(access.error === "User not associated with a firm" ? 400 : 404).json({ error: access.error });
    }
    
    const walkthrough = await prisma.controlWalkthrough.update({
      where: { id: req.params.walkthroughId },
      data: {
        reviewedById: req.user!.id,
        reviewedDate: new Date(),
        reviewerComments: req.body.comments,
      },
      include: {
        performedBy: { select: { id: true, fullName: true, role: true } },
        reviewedBy: { select: { id: true, fullName: true, role: true } },
        control: { select: { controlId: true, cycle: true } },
      },
    });

    await logAuditTrail(
      req.user!.id,
      "WALKTHROUGH_REVIEWED",
      "control_walkthrough",
      walkthrough.id,
      null,
      { reviewedById: req.user!.id },
      req.params.engagementId,
      `Walkthrough reviewed for control ${walkthrough.control.controlId}`,
      req.ip,
      req.get("user-agent")
    );

    res.json(walkthrough);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to review walkthrough", details: error.message });
  }
});

const controlTestSchema = z.object({
  controlId: z.string().min(1),
  testingObjective: z.string().min(1),
  testingProcedure: z.string().min(1),
  populationDescription: z.string().optional(),
  populationSize: z.number().int().positive().optional(),
  sampleSize: z.number().int().positive().optional(),
  samplingMethod: z.string().optional(),
  testingPeriodStart: z.coerce.date().optional(),
  testingPeriodEnd: z.coerce.date().optional(),
  exceptionsNoted: z.number().int().default(0),
  exceptionDetails: z.string().optional(),
  operatingEffectiveness: z.enum(ASSESSMENT_RESULTS).default("NOT_TESTED"),
  operatingEffectivenessComments: z.string().optional(),
  controlRelianceConclusion: z.boolean().default(false),
  relianceJustification: z.string().optional(),
  evidenceReferences: z.array(z.string()).default([]),
  workpaperReference: z.string().optional(),
});

router.get("/:engagementId/tests", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) {
      return res.status(access.error === "User not associated with a firm" ? 400 : 404).json({ error: access.error });
    }
    
    const tests = await prisma.controlTest.findMany({
      where: { engagementId: req.params.engagementId },
      include: {
        control: { select: { controlId: true, cycle: true, controlDescription: true, keyControl: true } },
        performedBy: { select: { id: true, fullName: true, role: true } },
        reviewedBy: { select: { id: true, fullName: true, role: true } },
        managerApprovedBy: { select: { id: true, fullName: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(tests);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch tests", details: error.message });
  }
});

router.post("/:engagementId/tests", requireAuth, requirePhaseInProgress("EXECUTION"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) {
      return res.status(access.error === "User not associated with a firm" ? 400 : 404).json({ error: access.error });
    }
    
    const data = controlTestSchema.parse(req.body);
    
    const test = await prisma.controlTest.create({
      data: {
        ...data,
        engagementId: req.params.engagementId,
        performedById: req.user!.id,
      },
      include: {
        performedBy: { select: { id: true, fullName: true, role: true } },
        control: { select: { controlId: true, cycle: true, controlDescription: true } },
      },
    });

    await logAuditTrail(
      req.user!.id,
      "CONTROL_TESTED",
      "control_test",
      test.id,
      null,
      test,
      req.params.engagementId,
      `Test of controls performed for ${test.control.controlId} - Result: ${data.operatingEffectiveness}`,
      req.ip,
      req.get("user-agent")
    );

    res.status(201).json(test);
  } catch (error: any) {
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to create test", details: error.message });
  }
});

router.post("/:engagementId/tests/:testId/review", requireAuth, requireMinRole("SENIOR"), requirePhaseInProgress("EXECUTION"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) {
      return res.status(access.error === "User not associated with a firm" ? 400 : 404).json({ error: access.error });
    }
    
    const test = await prisma.controlTest.update({
      where: { id: req.params.testId },
      data: {
        reviewedById: req.user!.id,
        reviewedDate: new Date(),
        reviewerComments: req.body.comments,
      },
      include: {
        performedBy: { select: { id: true, fullName: true, role: true } },
        reviewedBy: { select: { id: true, fullName: true, role: true } },
        control: { select: { controlId: true, cycle: true } },
      },
    });

    await logAuditTrail(
      req.user!.id,
      "TEST_REVIEWED",
      "control_test",
      test.id,
      null,
      { reviewedById: req.user!.id },
      req.params.engagementId,
      `Test reviewed for control ${test.control.controlId}`,
      req.ip,
      req.get("user-agent")
    );

    res.json(test);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to review test", details: error.message });
  }
});

router.post("/:engagementId/tests/:testId/manager-approve", requireAuth, requireMinRole("MANAGER"), requirePhaseInProgress("EXECUTION"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) {
      return res.status(access.error === "User not associated with a firm" ? 400 : 404).json({ error: access.error });
    }
    
    const test = await prisma.controlTest.update({
      where: { id: req.params.testId },
      data: {
        managerApprovedById: req.user!.id,
        managerApprovalDate: new Date(),
      },
      include: {
        performedBy: { select: { id: true, fullName: true, role: true } },
        reviewedBy: { select: { id: true, fullName: true, role: true } },
        managerApprovedBy: { select: { id: true, fullName: true, role: true } },
        control: { select: { controlId: true, cycle: true } },
      },
    });

    await logAuditTrail(
      req.user!.id,
      "TEST_MANAGER_APPROVED",
      "control_test",
      test.id,
      null,
      { managerApprovedById: req.user!.id },
      req.params.engagementId,
      `Test manager approved for control ${test.control.controlId}`,
      req.ip,
      req.get("user-agent")
    );

    res.json(test);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to approve test", details: error.message });
  }
});

const deficiencySchema = z.object({
  controlId: z.string().optional(),
  cycle: z.enum(CONTROL_CYCLES),
  deficiencyReference: z.string().min(1),
  deficiencyDescription: z.string().min(1),
  rootCause: z.string().optional(),
  severity: z.enum(DEFICIENCY_SEVERITIES),
  potentialMisstatementAmount: z.number().optional(),
  affectedAssertions: z.array(z.string()).default([]),
  affectedAccounts: z.array(z.string()).default([]),
  hasCompensatingControl: z.boolean().default(false),
  compensatingControlDescription: z.string().optional(),
  compensatingControlEffective: z.boolean().default(false),
  remediationPlan: z.string().optional(),
  remediationResponsible: z.string().optional(),
  remediationTargetDate: z.coerce.date().optional(),
  remediationStatus: z.enum(DEFICIENCY_STATUSES).default("OPEN"),
  communicationRequired: z.boolean().default(true),
  communicationRecipient: z.enum(COMMUNICATION_RECIPIENTS).optional(),
  impactOnAuditApproach: z.string().optional(),
  additionalProcedures: z.string().optional(),
});

router.get("/:engagementId/deficiencies", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) {
      return res.status(access.error === "User not associated with a firm" ? 400 : 404).json({ error: access.error });
    }
    
    const deficiencies = await prisma.controlDeficiency.findMany({
      where: { engagementId: req.params.engagementId },
      include: {
        control: { select: { controlId: true, cycle: true, controlDescription: true } },
        identifiedBy: { select: { id: true, fullName: true, role: true } },
        reviewedBy: { select: { id: true, fullName: true, role: true } },
        partnerApprovedBy: { select: { id: true, fullName: true, role: true } },
      },
      orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
    });
    res.json(deficiencies);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch deficiencies", details: error.message });
  }
});

router.post("/:engagementId/deficiencies", requireAuth, requirePhaseInProgress("EXECUTION"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) {
      return res.status(access.error === "User not associated with a firm" ? 400 : 404).json({ error: access.error });
    }
    
    const data = deficiencySchema.parse(req.body);
    
    const deficiency = await prisma.controlDeficiency.create({
      data: {
        ...data,
        engagementId: req.params.engagementId,
        identifiedById: req.user!.id,
      },
      include: {
        control: { select: { controlId: true, cycle: true } },
        identifiedBy: { select: { id: true, fullName: true, role: true } },
      },
    });

    await logAuditTrail(
      req.user!.id,
      "DEFICIENCY_IDENTIFIED",
      "control_deficiency",
      deficiency.id,
      null,
      deficiency,
      req.params.engagementId,
      `${data.severity} deficiency identified: ${data.deficiencyReference}`,
      req.ip,
      req.get("user-agent")
    );

    res.status(201).json(deficiency);
  } catch (error: any) {
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to create deficiency", details: error.message });
  }
});

router.patch("/:engagementId/deficiencies/:deficiencyId", requireAuth, requirePhaseInProgress("EXECUTION"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) {
      return res.status(access.error === "User not associated with a firm" ? 400 : 404).json({ error: access.error });
    }
    
    const existing = await prisma.controlDeficiency.findUnique({
      where: { id: req.params.deficiencyId },
    });

    if (!existing) {
      return res.status(404).json({ error: "Deficiency not found" });
    }

    const deficiency = await prisma.controlDeficiency.update({
      where: { id: req.params.deficiencyId },
      data: req.body,
      include: {
        control: { select: { controlId: true, cycle: true } },
        identifiedBy: { select: { id: true, fullName: true, role: true } },
        reviewedBy: { select: { id: true, fullName: true, role: true } },
      },
    });

    await logAuditTrail(
      req.user!.id,
      "DEFICIENCY_UPDATED",
      "control_deficiency",
      deficiency.id,
      existing,
      deficiency,
      req.params.engagementId,
      `Deficiency ${deficiency.deficiencyReference} updated`,
      req.ip,
      req.get("user-agent")
    );

    res.json(deficiency);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to update deficiency", details: error.message });
  }
});

router.post("/:engagementId/deficiencies/:deficiencyId/communicate", requireAuth, requireMinRole("MANAGER"), requirePhaseInProgress("EXECUTION"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) {
      return res.status(access.error === "User not associated with a firm" ? 400 : 404).json({ error: access.error });
    }
    
    const deficiency = await prisma.controlDeficiency.update({
      where: { id: req.params.deficiencyId },
      data: {
        communicatedDate: new Date(),
        communicationReference: req.body.communicationReference,
        communicationRecipient: req.body.recipient,
      },
      include: {
        identifiedBy: { select: { id: true, fullName: true, role: true } },
      },
    });

    await logAuditTrail(
      req.user!.id,
      "DEFICIENCY_COMMUNICATED",
      "control_deficiency",
      deficiency.id,
      null,
      { communicatedDate: new Date(), recipient: req.body.recipient },
      req.params.engagementId,
      `Deficiency ${deficiency.deficiencyReference} communicated to ${req.body.recipient}`,
      req.ip,
      req.get("user-agent")
    );

    res.json(deficiency);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to communicate deficiency", details: error.message });
  }
});

router.post("/:engagementId/deficiencies/:deficiencyId/partner-approve", requireAuth, requireMinRole("PARTNER"), requirePhaseInProgress("EXECUTION"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) {
      return res.status(access.error === "User not associated with a firm" ? 400 : 404).json({ error: access.error });
    }
    
    const deficiency = await prisma.controlDeficiency.update({
      where: { id: req.params.deficiencyId },
      data: {
        partnerApprovedById: req.user!.id,
        partnerApprovalDate: new Date(),
      },
      include: {
        identifiedBy: { select: { id: true, fullName: true, role: true } },
        partnerApprovedBy: { select: { id: true, fullName: true, role: true } },
      },
    });

    await logAuditTrail(
      req.user!.id,
      "DEFICIENCY_PARTNER_APPROVED",
      "control_deficiency",
      deficiency.id,
      null,
      { partnerApprovedById: req.user!.id },
      req.params.engagementId,
      `Deficiency ${deficiency.deficiencyReference} partner approved`,
      req.ip,
      req.get("user-agent")
    );

    res.json(deficiency);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to approve deficiency", details: error.message });
  }
});

router.get("/:engagementId/cycle-summary", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) {
      return res.status(access.error === "User not associated with a firm" ? 400 : 404).json({ error: access.error });
    }
    
    const cycles = ["REVENUE", "INVENTORY", "PURCHASES", "PAYROLL", "FINANCIAL_REPORTING"];
    
    const summaries = await Promise.all(cycles.map(async (cycle) => {
      const controls = await prisma.internalControl.findMany({
        where: { 
          engagementId: req.params.engagementId,
          cycle: cycle as any,
        },
        include: {
          tests: {
            where: { managerApprovedById: { not: null } },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
          deficiencies: true,
        },
      });

      const keyControls = controls.filter((c: any) => c.keyControl).length;
      const controlsWithTests = controls.filter((c: any) => c.tests.length > 0).length;
      const effectiveControls = controls.filter((c: any) => 
        c.tests.length > 0 && c.tests[0].operatingEffectiveness === "EFFECTIVE"
      ).length;
      const ineffectiveControls = controls.filter((c: any) => 
        c.tests.length > 0 && c.tests[0].operatingEffectiveness === "INEFFECTIVE"
      ).length;
      
      const allDeficiencies = controls.flatMap((c: any) => c.deficiencies);
      const significantDeficiencies = allDeficiencies.filter((d: any) => d.severity === "SIGNIFICANT_DEFICIENCY").length;
      const materialWeaknesses = allDeficiencies.filter((d: any) => d.severity === "MATERIAL_WEAKNESS").length;

      const relianceConclusion = await prisma.cycleRelianceConclusion.findUnique({
        where: {
          engagementId_cycle: {
            engagementId: req.params.engagementId,
            cycle: cycle as any,
          },
        },
      });

      return {
        cycle,
        totalControls: controls.length,
        keyControls,
        controlsTested: controlsWithTests,
        controlsEffective: effectiveControls,
        controlsIneffective: ineffectiveControls,
        deficienciesIdentified: allDeficiencies.length,
        significantDeficiencies,
        materialWeaknesses,
        relianceOnControls: relianceConclusion?.relianceOnControls || false,
        relianceApproved: !!relianceConclusion?.partnerApprovedById,
      };
    }));

    res.json(summaries);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch cycle summary", details: error.message });
  }
});

router.get("/:engagementId/reliance/:cycle", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) {
      return res.status(access.error === "User not associated with a firm" ? 400 : 404).json({ error: access.error });
    }
    
    const conclusion = await prisma.cycleRelianceConclusion.findUnique({
      where: {
        engagementId_cycle: {
          engagementId: req.params.engagementId,
          cycle: req.params.cycle as any,
        },
      },
      include: {
        preparedBy: { select: { id: true, fullName: true, role: true } },
        reviewedBy: { select: { id: true, fullName: true, role: true } },
        partnerApprovedBy: { select: { id: true, fullName: true, role: true } },
      },
    });

    res.json(conclusion);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch reliance conclusion", details: error.message });
  }
});

const relianceSchema = z.object({
  relianceOnControls: z.boolean(),
  relianceJustification: z.string().optional(),
  impactOnSubstantiveTesting: z.string().optional(),
  additionalSubstantiveProcedures: z.array(z.string()).default([]),
});

router.post("/:engagementId/reliance/:cycle", requireAuth, requirePhaseInProgress("EXECUTION"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) {
      return res.status(access.error === "User not associated with a firm" ? 400 : 404).json({ error: access.error });
    }
    
    const data = relianceSchema.parse(req.body);
    const cycle = req.params.cycle as any;
    
    const controls = await prisma.internalControl.findMany({
      where: { 
        engagementId: req.params.engagementId,
        cycle,
      },
      include: {
        tests: {
          where: { managerApprovedById: { not: null } },
        },
        deficiencies: true,
      },
    });

    if (data.relianceOnControls) {
      const keyControls = controls.filter(c => c.keyControl);
      const untestedKeyControls = keyControls.filter(c => c.tests.length === 0);
      
      if (untestedKeyControls.length > 0) {
        return res.status(400).json({ 
          error: "Cannot conclude reliance", 
          message: `${untestedKeyControls.length} key control(s) have not been tested with approved workpapers`,
          untestedControls: untestedKeyControls.map(c => c.controlId),
        });
      }
    }

    const keyControls = controls.filter(c => c.keyControl).length;
    const controlsTested = controls.filter(c => c.tests.length > 0).length;
    const effective = controls.filter(c => 
      c.tests.length > 0 && c.tests[0].operatingEffectiveness === "EFFECTIVE"
    ).length;
    const ineffective = controls.filter(c => 
      c.tests.length > 0 && c.tests[0].operatingEffectiveness === "INEFFECTIVE"
    ).length;
    
    const allDeficiencies = controls.flatMap(c => c.deficiencies);
    const significantDefs = allDeficiencies.filter(d => d.severity === "SIGNIFICANT_DEFICIENCY").length;
    const materialWeaks = allDeficiencies.filter(d => d.severity === "MATERIAL_WEAKNESS").length;

    const conclusion = await prisma.cycleRelianceConclusion.upsert({
      where: {
        engagementId_cycle: {
          engagementId: req.params.engagementId,
          cycle,
        },
      },
      update: {
        ...data,
        totalControlsInCycle: controls.length,
        keyControlsIdentified: keyControls,
        controlsTested,
        controlsEffective: effective,
        controlsIneffective: ineffective,
        deficienciesIdentified: allDeficiencies.length,
        significantDeficiencies: significantDefs,
        materialWeaknesses: materialWeaks,
      },
      create: {
        ...data,
        engagementId: req.params.engagementId,
        cycle,
        totalControlsInCycle: controls.length,
        keyControlsIdentified: keyControls,
        controlsTested,
        controlsEffective: effective,
        controlsIneffective: ineffective,
        deficienciesIdentified: allDeficiencies.length,
        significantDeficiencies: significantDefs,
        materialWeaknesses: materialWeaks,
        preparedById: req.user!.id,
      },
      include: {
        preparedBy: { select: { id: true, fullName: true, role: true } },
      },
    });

    await logAuditTrail(
      req.user!.id,
      "RELIANCE_CONCLUSION_CREATED",
      "cycle_reliance_conclusion",
      conclusion.id,
      null,
      conclusion,
      req.params.engagementId,
      `Reliance conclusion for ${cycle}: ${data.relianceOnControls ? "Rely" : "Do not rely"}`,
      req.ip,
      req.get("user-agent")
    );

    res.status(201).json(conclusion);
  } catch (error: any) {
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to create reliance conclusion", details: error.message });
  }
});

router.post("/:engagementId/reliance/:cycle/partner-approve", requireAuth, requireMinRole("PARTNER"), requirePhaseInProgress("EXECUTION"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) {
      return res.status(access.error === "User not associated with a firm" ? 400 : 404).json({ error: access.error });
    }
    
    const conclusion = await prisma.cycleRelianceConclusion.update({
      where: {
        engagementId_cycle: {
          engagementId: req.params.engagementId,
          cycle: req.params.cycle as any,
        },
      },
      data: {
        partnerApprovedById: req.user!.id,
        partnerApprovalDate: new Date(),
      },
      include: {
        preparedBy: { select: { id: true, fullName: true, role: true } },
        partnerApprovedBy: { select: { id: true, fullName: true, role: true } },
      },
    });

    await logAuditTrail(
      req.user!.id,
      "RELIANCE_PARTNER_APPROVED",
      "cycle_reliance_conclusion",
      conclusion.id,
      null,
      { partnerApprovedById: req.user!.id },
      req.params.engagementId,
      `Reliance conclusion for ${req.params.cycle} partner approved`,
      req.ip,
      req.get("user-agent")
    );

    res.json(conclusion);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to approve reliance conclusion", details: error.message });
  }
});

// ============================================
// PROCESS DOCUMENTATION TEMPLATES (ISA 315)
// ============================================

interface ProcessTemplate {
  cycle: string;
  processes: {
    processName: string;
    description: string;
    keyRisks: string[];
    typicalControls: {
      controlId: string;
      objective: string;
      description: string;
      type: string;
      nature: string;
      frequency: string;
      assertions: string[];
    }[];
  }[];
}

const PROCESS_TEMPLATES: Record<string, ProcessTemplate> = {
  REVENUE: {
    cycle: "REVENUE",
    processes: [
      {
        processName: "Order to Cash",
        description: "Process from customer order receipt through cash collection",
        keyRisks: ["FICTITIOUS_REVENUE", "REVENUE_CUTOFF", "CREDIT_RISK", "PRICING_ERRORS"],
        typicalControls: [
          {
            controlId: "REV-001",
            objective: "Ensure only valid orders are processed",
            description: "All sales orders require approval by sales manager before processing",
            type: "PREVENTIVE",
            nature: "MANUAL",
            frequency: "EACH_OCCURRENCE",
            assertions: ["OCCURRENCE", "ACCURACY"],
          },
          {
            controlId: "REV-002",
            objective: "Ensure revenue is recorded in correct period",
            description: "System-generated shipping documents dated upon dispatch with automatic revenue recognition",
            type: "PREVENTIVE",
            nature: "IT_AUTOMATED",
            frequency: "CONTINUOUS",
            assertions: ["CUTOFF", "COMPLETENESS"],
          },
          {
            controlId: "REV-003",
            objective: "Ensure accurate pricing",
            description: "System validates all prices against master price list; exceptions require manager approval",
            type: "PREVENTIVE",
            nature: "IT_DEPENDENT",
            frequency: "EACH_OCCURRENCE",
            assertions: ["ACCURACY", "VALUATION"],
          },
          {
            controlId: "REV-004",
            objective: "Segregation of duties in revenue cycle",
            description: "Order entry, credit approval, and cash receipt functions segregated",
            type: "PREVENTIVE",
            nature: "MANUAL",
            frequency: "CONTINUOUS",
            assertions: ["OCCURRENCE", "RIGHTS_OBLIGATIONS"],
          },
          {
            controlId: "REV-005",
            objective: "Ensure credit is properly approved",
            description: "Credit limits reviewed and approved by finance manager before order acceptance",
            type: "PREVENTIVE",
            nature: "MANUAL",
            frequency: "EACH_OCCURRENCE",
            assertions: ["VALUATION", "EXISTENCE"],
          },
        ],
      },
      {
        processName: "Accounts Receivable Management",
        description: "Monitoring and collection of customer balances",
        keyRisks: ["BAD_DEBT", "UNRECORDED_CREDITS", "MISAPPROPRIATION"],
        typicalControls: [
          {
            controlId: "REV-006",
            objective: "Ensure accurate customer statements",
            description: "Monthly customer statements sent and reconciled with AR ledger",
            type: "DETECTIVE",
            nature: "MANUAL",
            frequency: "MONTHLY",
            assertions: ["COMPLETENESS", "ACCURACY"],
          },
          {
            controlId: "REV-007",
            objective: "Ensure timely collection",
            description: "Weekly aging analysis reviewed by credit manager with follow-up on overdue accounts",
            type: "DETECTIVE",
            nature: "MANUAL",
            frequency: "WEEKLY",
            assertions: ["VALUATION", "EXISTENCE"],
          },
        ],
      },
    ],
  },
  PURCHASES: {
    cycle: "PURCHASES",
    processes: [
      {
        processName: "Procure to Pay",
        description: "Process from purchase requisition through vendor payment",
        keyRisks: ["UNAUTHORIZED_PURCHASES", "DUPLICATE_PAYMENTS", "FICTITIOUS_VENDORS", "PRICING_MANIPULATION"],
        typicalControls: [
          {
            controlId: "PUR-001",
            objective: "Ensure authorized purchases only",
            description: "All purchase orders require authorization per delegation of authority matrix",
            type: "PREVENTIVE",
            nature: "MANUAL",
            frequency: "EACH_OCCURRENCE",
            assertions: ["OCCURRENCE", "AUTHORIZATION"],
          },
          {
            controlId: "PUR-002",
            objective: "Three-way matching before payment",
            description: "System performs automatic match of PO, GRN, and invoice before payment approval",
            type: "PREVENTIVE",
            nature: "IT_AUTOMATED",
            frequency: "EACH_OCCURRENCE",
            assertions: ["ACCURACY", "COMPLETENESS", "OCCURRENCE"],
          },
          {
            controlId: "PUR-003",
            objective: "Prevent duplicate payments",
            description: "System blocks duplicate invoice numbers from same vendor",
            type: "PREVENTIVE",
            nature: "IT_AUTOMATED",
            frequency: "CONTINUOUS",
            assertions: ["OCCURRENCE", "ACCURACY"],
          },
          {
            controlId: "PUR-004",
            objective: "Valid vendor master maintenance",
            description: "New vendor setup requires documentation and finance manager approval",
            type: "PREVENTIVE",
            nature: "MANUAL",
            frequency: "EACH_OCCURRENCE",
            assertions: ["EXISTENCE", "RIGHTS_OBLIGATIONS"],
          },
          {
            controlId: "PUR-005",
            objective: "Segregation of duties in purchase cycle",
            description: "Requisition, ordering, receiving, and payment functions segregated",
            type: "PREVENTIVE",
            nature: "MANUAL",
            frequency: "CONTINUOUS",
            assertions: ["OCCURRENCE", "AUTHORIZATION"],
          },
        ],
      },
      {
        processName: "Accounts Payable Management",
        description: "Management and processing of vendor balances and payments",
        keyRisks: ["UNRECORDED_LIABILITIES", "EARLY_PAYMENTS", "MISSED_DISCOUNTS"],
        typicalControls: [
          {
            controlId: "PUR-006",
            objective: "Ensure complete recording of liabilities",
            description: "Monthly vendor statement reconciliation to AP ledger",
            type: "DETECTIVE",
            nature: "MANUAL",
            frequency: "MONTHLY",
            assertions: ["COMPLETENESS", "ACCURACY"],
          },
          {
            controlId: "PUR-007",
            objective: "Ensure cutoff accuracy",
            description: "Month-end accrual process for goods received not invoiced",
            type: "DETECTIVE",
            nature: "MANUAL",
            frequency: "MONTHLY",
            assertions: ["CUTOFF", "COMPLETENESS"],
          },
        ],
      },
    ],
  },
  INVENTORY: {
    cycle: "INVENTORY",
    processes: [
      {
        processName: "Inventory Management",
        description: "Receipt, storage, and issuance of inventory items",
        keyRisks: ["THEFT", "OBSOLESCENCE", "VALUATION_ERRORS", "EXISTENCE_ISSUES"],
        typicalControls: [
          {
            controlId: "INV-001",
            objective: "Ensure physical security of inventory",
            description: "Restricted warehouse access with security personnel and CCTV monitoring",
            type: "PREVENTIVE",
            nature: "MANUAL",
            frequency: "CONTINUOUS",
            assertions: ["EXISTENCE", "RIGHTS_OBLIGATIONS"],
          },
          {
            controlId: "INV-002",
            objective: "Accurate inventory quantities",
            description: "Perpetual inventory system with real-time updates on receipts and issuances",
            type: "PREVENTIVE",
            nature: "IT_AUTOMATED",
            frequency: "CONTINUOUS",
            assertions: ["COMPLETENESS", "EXISTENCE"],
          },
          {
            controlId: "INV-003",
            objective: "Verify inventory existence and condition",
            description: "Annual physical count with cycle counts throughout year",
            type: "DETECTIVE",
            nature: "MANUAL",
            frequency: "ANNUALLY",
            assertions: ["EXISTENCE", "VALUATION"],
          },
          {
            controlId: "INV-004",
            objective: "Proper inventory valuation",
            description: "Monthly review of slow-moving items with obsolescence provision",
            type: "DETECTIVE",
            nature: "MANUAL",
            frequency: "MONTHLY",
            assertions: ["VALUATION", "ALLOCATION"],
          },
          {
            controlId: "INV-005",
            objective: "Accurate cost assignment",
            description: "Standard costing system with variance analysis and annual review",
            type: "PREVENTIVE",
            nature: "IT_DEPENDENT",
            frequency: "MONTHLY",
            assertions: ["VALUATION", "ACCURACY"],
          },
        ],
      },
    ],
  },
  FINANCIAL_REPORTING: {
    cycle: "FINANCIAL_REPORTING",
    processes: [
      {
        processName: "Financial Close Process",
        description: "Monthly and annual financial statement preparation and review",
        keyRisks: ["MISSTATEMENT", "FRAUD", "ESTIMATE_ERRORS", "DISCLOSURE_OMISSIONS"],
        typicalControls: [
          {
            controlId: "FIN-001",
            objective: "Accurate journal entries",
            description: "All manual journal entries require supporting documentation and manager approval",
            type: "PREVENTIVE",
            nature: "MANUAL",
            frequency: "EACH_OCCURRENCE",
            assertions: ["ACCURACY", "OCCURRENCE"],
          },
          {
            controlId: "FIN-002",
            objective: "Complete account reconciliations",
            description: "Monthly reconciliation of all balance sheet accounts with independent review",
            type: "DETECTIVE",
            nature: "MANUAL",
            frequency: "MONTHLY",
            assertions: ["COMPLETENESS", "ACCURACY", "EXISTENCE"],
          },
          {
            controlId: "FIN-003",
            objective: "Accurate financial reporting",
            description: "CFO and CEO review and approval of financial statements before issuance",
            type: "DETECTIVE",
            nature: "MANUAL",
            frequency: "QUARTERLY",
            assertions: ["PRESENTATION", "DISCLOSURE"],
          },
          {
            controlId: "FIN-004",
            objective: "Proper segregation in financial reporting",
            description: "Preparer, reviewer, and approver segregated for financial close activities",
            type: "PREVENTIVE",
            nature: "MANUAL",
            frequency: "CONTINUOUS",
            assertions: ["OCCURRENCE", "ACCURACY"],
          },
          {
            controlId: "FIN-005",
            objective: "Accurate estimates and judgments",
            description: "Accounting estimates reviewed by finance committee with supporting calculations",
            type: "DETECTIVE",
            nature: "MANUAL",
            frequency: "QUARTERLY",
            assertions: ["VALUATION", "ALLOCATION"],
          },
        ],
      },
      {
        processName: "IT General Controls",
        description: "Controls over IT environment supporting financial reporting",
        keyRisks: ["UNAUTHORIZED_ACCESS", "DATA_INTEGRITY", "SYSTEM_AVAILABILITY"],
        typicalControls: [
          {
            controlId: "FIN-006",
            objective: "Logical access security",
            description: "User access provisioning based on job role with quarterly access reviews",
            type: "PREVENTIVE",
            nature: "IT_AUTOMATED",
            frequency: "QUARTERLY",
            assertions: ["OCCURRENCE", "AUTHORIZATION"],
          },
          {
            controlId: "FIN-007",
            objective: "Change management",
            description: "All system changes require testing and approval before production deployment",
            type: "PREVENTIVE",
            nature: "IT_DEPENDENT",
            frequency: "EACH_OCCURRENCE",
            assertions: ["ACCURACY", "COMPLETENESS"],
          },
          {
            controlId: "FIN-008",
            objective: "Data backup and recovery",
            description: "Daily incremental and weekly full backups with annual recovery testing",
            type: "CORRECTIVE",
            nature: "IT_AUTOMATED",
            frequency: "DAILY",
            assertions: ["COMPLETENESS", "EXISTENCE"],
          },
        ],
      },
    ],
  },
};

router.get("/:engagementId/process-templates", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { cycle } = req.query;
    
    if (cycle && typeof cycle === "string") {
      const template = PROCESS_TEMPLATES[cycle.toUpperCase()];
      if (!template) {
        return res.status(404).json({ error: "Template not found for cycle", availableCycles: Object.keys(PROCESS_TEMPLATES) });
      }
      return res.json(template);
    }

    res.json({
      availableCycles: Object.keys(PROCESS_TEMPLATES),
      templates: PROCESS_TEMPLATES,
      isaReference: "ISA 315 (Revised 2019) - Understanding the Entity's Internal Control",
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch process templates", details: error.message });
  }
});

router.post("/:engagementId/apply-template/:cycle", requireAuth, requirePhaseInProgress("EXECUTION"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) {
      return res.status(access.error === "User not associated with a firm" ? 400 : 404).json({ error: access.error });
    }

    const cycle = req.params.cycle.toUpperCase();
    const template = PROCESS_TEMPLATES[cycle];
    
    if (!template) {
      return res.status(404).json({ error: "Template not found", availableCycles: Object.keys(PROCESS_TEMPLATES) });
    }

    const createdControls = [];
    
    for (const process of template.processes) {
      for (const control of process.typicalControls) {
        const existing = await prisma.internalControl.findFirst({
          where: {
            engagementId: req.params.engagementId,
            controlId: control.controlId,
          },
        });

        if (!existing) {
          const created = await prisma.internalControl.create({
            data: {
              engagementId: req.params.engagementId,
              cycle: cycle as any,
              processName: process.processName,
              processNarrative: process.description,
              controlId: control.controlId,
              controlObjective: control.objective,
              controlDescription: control.description,
              controlType: control.type as any,
              controlNature: control.nature as any,
              frequency: control.frequency as any,
              keyControl: true,
              relyOnControl: false,
              relatedAssertions: control.assertions,
              documentedById: req.user!.id,
            },
          });
          createdControls.push(created);
        }
      }
    }

    await logAuditTrail(
      req.user!.id,
      "TEMPLATE_APPLIED",
      "internal_control",
      req.params.engagementId,
      null,
      { cycle, controlsCreated: createdControls.length },
      req.params.engagementId,
      `Applied ${cycle} process template - ${createdControls.length} controls created`,
      req.ip,
      req.get("user-agent")
    );

    res.json({
      message: `Template applied successfully`,
      cycle,
      controlsCreated: createdControls.length,
      controls: createdControls,
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to apply template", details: error.message });
  }
});

// ============================================
// RISK & CONTROL MATRIX (ISA 315, ISA 330)
// ============================================

router.get("/:engagementId/risk-control-matrix", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) {
      return res.status(access.error === "User not associated with a firm" ? 400 : 404).json({ error: access.error });
    }

    const controls = await prisma.internalControl.findMany({
      where: { engagementId: req.params.engagementId },
      include: {
        documentedBy: { select: { id: true, fullName: true } },
        walkthroughs: { orderBy: { createdAt: "desc" }, take: 1 },
        tests: { orderBy: { createdAt: "desc" }, take: 1 },
        deficiencies: { where: { remediationStatus: { not: "REMEDIATED" } } },
      },
      orderBy: [{ cycle: "asc" }, { controlId: "asc" }],
    });

    const risks = await prisma.riskAssessment.findMany({
      where: { engagementId: req.params.engagementId },
      select: {
        id: true,
        accountOrClass: true,
        assertion: true,
        riskDescription: true,
        inherentRisk: true,
        controlRisk: true,
        riskOfMaterialMisstatement: true,
        isSignificantRisk: true,
      },
    });

    const matrix = controls.map((control: any) => {
      const relatedRisks = risks.filter((r: any) => 
        control.relatedRiskIds?.includes(r.id) ||
        control.relatedAssertions?.some((a: string) => a === r.assertion)
      );

      const latestWalkthrough = control.walkthroughs[0];
      const latestTest = control.tests[0];

      return {
        controlId: control.controlId,
        cycle: control.cycle,
        processName: control.processName,
        controlObjective: control.controlObjective,
        controlDescription: control.controlDescription,
        controlType: control.controlType,
        controlNature: control.controlNature,
        frequency: control.frequency,
        controlOwner: control.controlOwner,
        keyControl: control.keyControl,
        relyOnControl: control.relyOnControl,
        relatedAssertions: control.relatedAssertions,
        relatedRisks: relatedRisks.map((r: any) => ({
          id: r.id,
          accountOrClass: r.accountOrClass,
          assertion: r.assertion,
          riskDescription: r.riskDescription,
          romm: r.riskOfMaterialMisstatement,
          isSignificant: r.isSignificantRisk,
        })),
        designEffectiveness: latestWalkthrough?.designAssessment || "NOT_TESTED",
        implementationEffectiveness: latestWalkthrough?.implementationAssessment || "NOT_TESTED",
        operatingEffectiveness: latestTest?.operatingEffectiveness || "NOT_TESTED",
        exceptionsNoted: latestTest?.exceptionsNoted || 0,
        openDeficiencies: control.deficiencies.length,
        testingComplete: !!latestTest?.managerApprovedById,
      };
    });

    const summary = {
      totalControls: controls.length,
      keyControls: controls.filter((c: any) => c.keyControl).length,
      controlsByType: {
        preventive: controls.filter((c: any) => c.controlType === "PREVENTIVE").length,
        detective: controls.filter((c: any) => c.controlType === "DETECTIVE").length,
        corrective: controls.filter((c: any) => c.controlType === "CORRECTIVE").length,
      },
      controlsByNature: {
        manual: controls.filter((c: any) => c.controlNature === "MANUAL").length,
        itAutomated: controls.filter((c: any) => c.controlNature === "IT_AUTOMATED").length,
        itDependent: controls.filter((c: any) => c.controlNature === "IT_DEPENDENT").length,
      },
      testingStatus: {
        notTested: matrix.filter((m: any) => m.operatingEffectiveness === "NOT_TESTED").length,
        effective: matrix.filter((m: any) => m.operatingEffectiveness === "EFFECTIVE").length,
        ineffective: matrix.filter((m: any) => m.operatingEffectiveness === "INEFFECTIVE").length,
        partiallyEffective: matrix.filter((m: any) => m.operatingEffectiveness === "PARTIALLY_EFFECTIVE").length,
      },
      totalOpenDeficiencies: matrix.reduce((sum: number, m: any) => sum + m.openDeficiencies, 0),
    };

    res.json({
      matrix,
      summary,
      isaReference: "ISA 315 (Revised 2019), ISA 330 - Risk & Control Matrix",
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to generate risk-control matrix", details: error.message });
  }
});

// ============================================
// AI-ASSISTED CONTROLS ANALYSIS
// ============================================

interface ControlGap {
  cycle: string;
  assertion: string;
  risk: string;
  missingControlType: string;
  recommendation: string;
  priority: string;
}

function analyzeControlGaps(controls: any[], risks: any[]): ControlGap[] {
  const gaps: ControlGap[] = [];
  
  const controlsByCycleAssertion: Record<string, any[]> = {};
  controls.forEach((c: any) => {
    c.relatedAssertions?.forEach((assertion: string) => {
      const key = `${c.cycle}-${assertion}`;
      if (!controlsByCycleAssertion[key]) {
        controlsByCycleAssertion[key] = [];
      }
      controlsByCycleAssertion[key].push(c);
    });
  });

  risks.forEach((risk: any) => {
    if (risk.isSignificantRisk || risk.riskOfMaterialMisstatement === "HIGH") {
      const key = `${risk.cycle || "FINANCIAL_REPORTING"}-${risk.assertion}`;
      const relatedControls = controlsByCycleAssertion[key] || [];
      
      if (relatedControls.length === 0) {
        gaps.push({
          cycle: risk.cycle || "FINANCIAL_REPORTING",
          assertion: risk.assertion,
          risk: risk.riskDescription,
          missingControlType: "ANY",
          recommendation: `No controls identified for ${risk.assertion} assertion. Document preventive and detective controls.`,
          priority: "HIGH",
        });
      } else {
        const hasPreventive = relatedControls.some((c: any) => c.controlType === "PREVENTIVE");
        const hasDetective = relatedControls.some((c: any) => c.controlType === "DETECTIVE");
        const hasKeyControl = relatedControls.some((c: any) => c.keyControl);

        if (!hasPreventive && risk.isSignificantRisk) {
          gaps.push({
            cycle: risk.cycle || "FINANCIAL_REPORTING",
            assertion: risk.assertion,
            risk: risk.riskDescription,
            missingControlType: "PREVENTIVE",
            recommendation: "Significant risk without preventive control. Consider implementing authorization or validation controls.",
            priority: "HIGH",
          });
        }

        if (!hasDetective) {
          gaps.push({
            cycle: risk.cycle || "FINANCIAL_REPORTING",
            assertion: risk.assertion,
            risk: risk.riskDescription,
            missingControlType: "DETECTIVE",
            recommendation: "No detective control for risk mitigation. Consider implementing reconciliation or monitoring controls.",
            priority: "MEDIUM",
          });
        }

        if (!hasKeyControl && risk.isSignificantRisk) {
          gaps.push({
            cycle: risk.cycle || "FINANCIAL_REPORTING",
            assertion: risk.assertion,
            risk: risk.riskDescription,
            missingControlType: "KEY_CONTROL",
            recommendation: "No key control designated for significant risk. Designate primary control for testing.",
            priority: "HIGH",
          });
        }
      }
    }
  });

  return gaps;
}

interface DeviationPattern {
  pattern: string;
  frequency: number;
  controls: string[];
  rootCauseSuggestion: string;
  remediationSuggestion: string;
}

function analyzeDeviationPatterns(tests: any[], deficiencies: any[]): DeviationPattern[] {
  const patterns: DeviationPattern[] = [];
  
  const exceptionsByOwner: Record<string, { count: number; controls: string[] }> = {};
  const exceptionsByFrequency: Record<string, { count: number; controls: string[] }> = {};
  const exceptionsByNature: Record<string, { count: number; controls: string[] }> = {};

  tests.forEach((test: any) => {
    if (test.exceptionsNoted > 0 && test.control) {
      const owner = test.control.controlOwner || "Unknown";
      const frequency = test.control.frequency || "Unknown";
      const nature = test.control.controlNature || "Unknown";

      if (!exceptionsByOwner[owner]) exceptionsByOwner[owner] = { count: 0, controls: [] };
      exceptionsByOwner[owner].count += test.exceptionsNoted;
      exceptionsByOwner[owner].controls.push(test.control.controlId);

      if (!exceptionsByFrequency[frequency]) exceptionsByFrequency[frequency] = { count: 0, controls: [] };
      exceptionsByFrequency[frequency].count += test.exceptionsNoted;
      exceptionsByFrequency[frequency].controls.push(test.control.controlId);

      if (!exceptionsByNature[nature]) exceptionsByNature[nature] = { count: 0, controls: [] };
      exceptionsByNature[nature].count += test.exceptionsNoted;
      exceptionsByNature[nature].controls.push(test.control.controlId);
    }
  });

  Object.entries(exceptionsByOwner).forEach(([owner, data]) => {
    if (data.count >= 3) {
      patterns.push({
        pattern: `Multiple exceptions for controls owned by ${owner}`,
        frequency: data.count,
        controls: data.controls,
        rootCauseSuggestion: "Possible training gap or workload issues for control owner",
        remediationSuggestion: "Provide training or redistribute control responsibilities",
      });
    }
  });

  Object.entries(exceptionsByFrequency).forEach(([frequency, data]) => {
    if (data.count >= 3) {
      patterns.push({
        pattern: `High exception rate for ${frequency} controls`,
        frequency: data.count,
        controls: data.controls,
        rootCauseSuggestion: "Control frequency may be insufficient or unrealistic",
        remediationSuggestion: "Review control frequency and consider automation",
      });
    }
  });

  if (exceptionsByNature["MANUAL"]?.count >= 5) {
    patterns.push({
      pattern: "High exception rate for manual controls",
      frequency: exceptionsByNature["MANUAL"].count,
      controls: exceptionsByNature["MANUAL"].controls,
      rootCauseSuggestion: "Manual controls prone to human error or override",
      remediationSuggestion: "Consider automating key controls or implementing IT-dependent controls",
    });
  }

  return patterns;
}

interface FailurePrediction {
  controlId: string;
  controlDescription: string;
  riskScore: number;
  riskLevel: string;
  factors: string[];
  recommendation: string;
}

function predictControlFailures(controls: any[], tests: any[], deficiencies: any[]): FailurePrediction[] {
  const predictions: FailurePrediction[] = [];

  controls.forEach((control: any) => {
    let riskScore = 0;
    const factors: string[] = [];

    const controlTests = tests.filter((t: any) => t.controlId === control.id);
    const controlDeficiencies = deficiencies.filter((d: any) => d.controlId === control.id);

    if (control.controlNature === "MANUAL") {
      riskScore += 15;
      factors.push("Manual control (higher human error risk)");
    }

    if (control.frequency === "EACH_OCCURRENCE") {
      riskScore += 10;
      factors.push("High-frequency control (fatigue risk)");
    }

    const recentTest = controlTests[0];
    if (recentTest?.exceptionsNoted > 0) {
      riskScore += recentTest.exceptionsNoted * 10;
      factors.push(`${recentTest.exceptionsNoted} exceptions in recent testing`);
    }

    if (recentTest?.operatingEffectiveness === "PARTIALLY_EFFECTIVE") {
      riskScore += 20;
      factors.push("Previously assessed as partially effective");
    }

    if (controlDeficiencies.length > 0) {
      riskScore += controlDeficiencies.length * 15;
      factors.push(`${controlDeficiencies.length} open deficiencies`);
    }

    if (!control.controlOwner) {
      riskScore += 10;
      factors.push("No designated control owner");
    }

    if (control.keyControl && riskScore > 0) {
      riskScore += 10;
      factors.push("Key control with identified issues");
    }

    if (riskScore >= 30) {
      let riskLevel = "LOW";
      if (riskScore >= 70) riskLevel = "HIGH";
      else if (riskScore >= 50) riskLevel = "MEDIUM";

      let recommendation = "Monitor control performance";
      if (riskScore >= 70) {
        recommendation = "Immediate remediation required. Consider compensating controls or increased substantive testing.";
      } else if (riskScore >= 50) {
        recommendation = "Enhance control design or increase monitoring frequency.";
      }

      predictions.push({
        controlId: control.controlId,
        controlDescription: control.controlDescription,
        riskScore,
        riskLevel,
        factors,
        recommendation,
      });
    }
  });

  return predictions.sort((a, b) => b.riskScore - a.riskScore);
}

router.post("/:engagementId/ai-control-analysis", requireAuth, requirePhaseInProgress("EXECUTION"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) {
      return res.status(access.error === "User not associated with a firm" ? 400 : 404).json({ error: access.error });
    }

    const controls = await prisma.internalControl.findMany({
      where: { engagementId: req.params.engagementId },
      include: {
        tests: { orderBy: { createdAt: "desc" } },
        deficiencies: { where: { remediationStatus: { not: "REMEDIATED" } } },
      },
    });

    const risks = await prisma.riskAssessment.findMany({
      where: { engagementId: req.params.engagementId },
    });

    const tests = await prisma.controlTest.findMany({
      where: { engagementId: req.params.engagementId },
      include: {
        control: { select: { controlId: true, controlOwner: true, frequency: true, controlNature: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const deficiencies = await prisma.controlDeficiency.findMany({
      where: { 
        engagementId: req.params.engagementId,
        remediationStatus: { not: "REMEDIATED" },
      },
    });

    const controlGaps = analyzeControlGaps(controls, risks);
    const deviationPatterns = analyzeDeviationPatterns(tests, deficiencies);
    const failurePredictions = predictControlFailures(controls, tests, deficiencies);

    const testingSuggestions = [];
    
    const untestedKeyControls = controls.filter((c: any) => 
      c.keyControl && !c.tests.some((t: any) => t.managerApprovedById)
    );
    if (untestedKeyControls.length > 0) {
      testingSuggestions.push({
        priority: "HIGH",
        suggestion: `${untestedKeyControls.length} key controls require testing`,
        controls: untestedKeyControls.map((c: any) => c.controlId),
      });
    }

    const controlsWithExceptions = controls.filter((c: any) => 
      c.tests.some((t: any) => t.exceptionsNoted > 0)
    );
    if (controlsWithExceptions.length > 0) {
      testingSuggestions.push({
        priority: "MEDIUM",
        suggestion: "Consider additional testing for controls with prior exceptions",
        controls: controlsWithExceptions.map((c: any) => c.controlId),
      });
    }

    const analysis = {
      controlGaps,
      deviationPatterns,
      failurePredictions,
      testingSuggestions,
      summary: {
        totalGapsIdentified: controlGaps.length,
        highPriorityGaps: controlGaps.filter((g: ControlGap) => g.priority === "HIGH").length,
        patternsIdentified: deviationPatterns.length,
        controlsAtRisk: failurePredictions.length,
        highRiskControls: failurePredictions.filter((p: FailurePrediction) => p.riskLevel === "HIGH").length,
      },
      isaReferences: [
        "ISA 265 - Communicating Deficiencies in Internal Control",
        "ISA 315 (Revised 2019) - Identifying and Assessing Risks",
        "ISA 330 - Auditor's Responses to Assessed Risks",
      ],
      cosoComponents: [
        "Control Environment",
        "Risk Assessment",
        "Control Activities",
        "Information & Communication",
        "Monitoring Activities",
      ],
    };

    await logAuditTrail(
      req.user!.id,
      "AI_CONTROL_ANALYSIS_PERFORMED",
      "engagement",
      req.params.engagementId,
      null,
      analysis.summary,
      req.params.engagementId,
      `AI control analysis: ${controlGaps.length} gaps, ${failurePredictions.length} at-risk controls`,
      req.ip,
      req.get("user-agent")
    );

    res.json(analysis);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to perform AI control analysis", details: error.message });
  }
});

// ============================================
// CONTROLS TESTING SUMMARY (COSO, ISA 265)
// ============================================

router.get("/:engagementId/controls-testing-summary", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) {
      return res.status(access.error === "User not associated with a firm" ? 400 : 404).json({ error: access.error });
    }

    const controls = await prisma.internalControl.findMany({
      where: { engagementId: req.params.engagementId },
      include: {
        walkthroughs: { orderBy: { createdAt: "desc" }, take: 1 },
        tests: { 
          orderBy: { createdAt: "desc" }, 
          take: 1,
          include: {
            performedBy: { select: { fullName: true } },
            reviewedBy: { select: { fullName: true } },
            managerApprovedBy: { select: { fullName: true } },
          },
        },
        deficiencies: true,
      },
    });

    const deficiencies = await prisma.controlDeficiency.findMany({
      where: { engagementId: req.params.engagementId },
      include: {
        control: { select: { controlId: true, cycle: true } },
        identifiedBy: { select: { fullName: true } },
        partnerApprovedBy: { select: { fullName: true } },
      },
    });

    const relianceConclusions = await prisma.cycleRelianceConclusion.findMany({
      where: { engagementId: req.params.engagementId },
      include: {
        preparedBy: { select: { fullName: true } },
        partnerApprovedBy: { select: { fullName: true } },
      },
    });

    const cycles = ["REVENUE", "INVENTORY", "PURCHASES", "PAYROLL", "FINANCIAL_REPORTING"];
    
    const cycleSummaries = cycles.map((cycle) => {
      const cycleControls = controls.filter((c: any) => c.cycle === cycle);
      const cycleDeficiencies = deficiencies.filter((d: any) => d.cycle === cycle);
      const reliance = relianceConclusions.find((r: any) => r.cycle === cycle);

      return {
        cycle,
        controlsDocumented: cycleControls.length,
        keyControls: cycleControls.filter((c: any) => c.keyControl).length,
        walkthroughsComplete: cycleControls.filter((c: any) => c.walkthroughs.length > 0).length,
        testsComplete: cycleControls.filter((c: any) => c.tests.some((t: any) => t.managerApprovedById)).length,
        effectiveControls: cycleControls.filter((c: any) => 
          c.tests.length > 0 && c.tests[0].operatingEffectiveness === "EFFECTIVE"
        ).length,
        deficienciesIdentified: cycleDeficiencies.length,
        significantDeficiencies: cycleDeficiencies.filter((d: any) => d.severity === "SIGNIFICANT_DEFICIENCY").length,
        materialWeaknesses: cycleDeficiencies.filter((d: any) => d.severity === "MATERIAL_WEAKNESS").length,
        relianceConclusion: reliance?.relianceOnControls || false,
        relianceApproved: !!reliance?.partnerApprovedById,
      };
    });

    const overallSummary = {
      totalControls: controls.length,
      totalKeyControls: controls.filter((c: any) => c.keyControl).length,
      walkthroughsComplete: controls.filter((c: any) => c.walkthroughs.length > 0).length,
      testsComplete: controls.filter((c: any) => c.tests.some((t: any) => t.managerApprovedById)).length,
      effectiveControls: controls.filter((c: any) => 
        c.tests.length > 0 && c.tests[0].operatingEffectiveness === "EFFECTIVE"
      ).length,
      ineffectiveControls: controls.filter((c: any) => 
        c.tests.length > 0 && c.tests[0].operatingEffectiveness === "INEFFECTIVE"
      ).length,
      totalDeficiencies: deficiencies.length,
      openDeficiencies: deficiencies.filter((d: any) => d.remediationStatus !== "REMEDIATED").length,
      significantDeficiencies: deficiencies.filter((d: any) => d.severity === "SIGNIFICANT_DEFICIENCY").length,
      materialWeaknesses: deficiencies.filter((d: any) => d.severity === "MATERIAL_WEAKNESS").length,
      deficienciesCommunicated: deficiencies.filter((d: any) => d.communicatedDate).length,
      cyclesWithReliance: relianceConclusions.filter((r: any) => r.relianceOnControls).length,
      relianceConclusionsApproved: relianceConclusions.filter((r: any) => r.partnerApprovedById).length,
    };

    const completionPercentage = Math.round(
      ((overallSummary.testsComplete / Math.max(overallSummary.totalKeyControls, 1)) * 100)
    );

    const isa265Communications = {
      significantDeficienciesToGovernance: deficiencies.filter((d: any) => 
        d.severity === "SIGNIFICANT_DEFICIENCY" && d.communicationRecipient === "AUDIT_COMMITTEE"
      ).length,
      materialWeaknessesToGovernance: deficiencies.filter((d: any) => 
        d.severity === "MATERIAL_WEAKNESS" && d.communicationRecipient === "AUDIT_COMMITTEE"
      ).length,
      deficienciesToManagement: deficiencies.filter((d: any) => 
        d.communicationRecipient === "MANAGEMENT" && d.communicatedDate
      ).length,
      pendingCommunications: deficiencies.filter((d: any) => 
        d.communicationRequired && !d.communicatedDate
      ).length,
    };

    res.json({
      cycleSummaries,
      overallSummary,
      completionPercentage,
      isa265Communications,
      cosoFramework: {
        description: "COSO Internal Control - Integrated Framework (2013)",
        components: [
          { name: "Control Environment", assessed: true },
          { name: "Risk Assessment", assessed: true },
          { name: "Control Activities", assessed: true },
          { name: "Information & Communication", assessed: true },
          { name: "Monitoring Activities", assessed: true },
        ],
      },
      regulatoryReferences: [
        "ISA 265 - Communicating Deficiencies in Internal Control",
        "ISA 315 (Revised 2019) - Identifying and Assessing Risks",
        "ISA 330 - Auditor's Responses to Assessed Risks",
        "Companies Act 2017, Section 227 - Internal Financial Controls",
        "SECP Internal Control Guidelines",
      ],
      readyForFinalization: completionPercentage >= 90 && overallSummary.materialWeaknesses === 0,
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to generate controls testing summary", details: error.message });
  }
});

// ============================================
// SAMPLING METHODOLOGY (ISA 530)
// ============================================

router.post("/:engagementId/calculate-sample-size", requireAuth, requirePhaseInProgress("EXECUTION"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { populationSize, expectedDeviationRate, tolerableDeviationRate, confidenceLevel } = req.body;

    if (!populationSize || populationSize <= 0) {
      return res.status(400).json({ error: "Valid population size required" });
    }

    const expectedRate = expectedDeviationRate || 0;
    const tolerableRate = tolerableDeviationRate || 5;
    const confidence = confidenceLevel || 95;

    const confidenceFactors: Record<number, number> = {
      90: 2.31,
      95: 3.0,
      99: 4.61,
    };

    const factor = confidenceFactors[confidence] || 3.0;
    
    let sampleSize = Math.ceil(
      (factor * (1 - expectedRate / 100)) / (tolerableRate / 100 - expectedRate / 100)
    );

    if (populationSize < sampleSize * 10) {
      sampleSize = Math.ceil((sampleSize * populationSize) / (sampleSize + populationSize));
    }

    sampleSize = Math.max(sampleSize, 25);
    sampleSize = Math.min(sampleSize, populationSize);

    const samplingMethods = [
      {
        method: "Random Sampling",
        description: "Each item has equal probability of selection",
        suitableFor: "Homogeneous populations",
      },
      {
        method: "Systematic Sampling",
        description: "Select every nth item after random start",
        suitableFor: "Large populations with no pattern",
      },
      {
        method: "Haphazard Sampling",
        description: "Selection without specific reason or bias",
        suitableFor: "Small populations with physical access",
      },
      {
        method: "Block Sampling",
        description: "Select contiguous items (periods)",
        suitableFor: "Testing over specific time periods",
      },
    ];

    res.json({
      inputs: {
        populationSize,
        expectedDeviationRate: expectedRate,
        tolerableDeviationRate: tolerableRate,
        confidenceLevel: confidence,
      },
      calculatedSampleSize: sampleSize,
      samplingInterval: Math.floor(populationSize / sampleSize),
      samplingMethods,
      isaReference: "ISA 530 - Audit Sampling",
      guidance: {
        minSampleSize: 25,
        deviationEvaluation: `If more than ${Math.floor((tolerableRate / 100) * sampleSize)} deviations found, control may be ineffective`,
        projectedDeviationRate: `Expected: ${expectedRate}%, Tolerable: ${tolerableRate}%`,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to calculate sample size", details: error.message });
  }
});

export default router;
