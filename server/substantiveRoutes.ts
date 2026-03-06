import { Router, Response } from "express";
import { prisma } from "./db";
import { z } from "zod";

const router = Router();

interface AuthenticatedRequest {
  user?: { id: string; firmId: string; role: string };
  params: any;
  body: any;
  query: any;
  ip?: string;
  get: (header: string) => string | undefined;
}

function requireAuth(req: AuthenticatedRequest, res: Response, next: Function) {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
}

function requireMinRole(minRole: string) {
  const roleHierarchy = ["STAFF", "SENIOR", "MANAGER", "PARTNER", "EQCR", "FIRM_ADMIN"];
  return (req: AuthenticatedRequest, res: Response, next: Function) => {
    const userRoleIndex = roleHierarchy.indexOf(req.user?.role || "");
    const minRoleIndex = roleHierarchy.indexOf(minRole);
    if (userRoleIndex < minRoleIndex) {
      return res.status(403).json({ error: `Minimum role required: ${minRole}` });
    }
    next();
  };
}

async function validateEngagementAccess(engagementId: string, userId: string, firmId: string | undefined) {
  if (!firmId) return { valid: false, error: "User not associated with a firm" };
  const engagement = await prisma.engagement.findFirst({
    where: { id: engagementId, firmId },
  });
  if (!engagement) return { valid: false, error: "Engagement not found" };
  return { valid: true, engagement };
}

async function logAuditTrail(
  userId: string,
  action: string,
  entityType: string,
  entityId: string | null,
  beforeValue: any,
  afterValue: any,
  engagementId: string,
  justification: string,
  ipAddress?: string,
  userAgent?: string
) {
  await prisma.auditTrail.create({
    data: {
      userId,
      action,
      entityType,
      entityId,
      beforeValue,
      afterValue,
      engagementId,
      justification,
      ipAddress,
      userAgent,
    },
  });
}

const SAMPLING_METHODS = [
  "STATISTICAL_RANDOM", "STATISTICAL_SYSTEMATIC", "STATISTICAL_STRATIFIED",
  "MONETARY_UNIT_SAMPLING", "NON_STATISTICAL_HAPHAZARD", "NON_STATISTICAL_JUDGMENTAL",
  "BLOCK_SELECTION", "ALL_ITEMS"
] as const;

const FS_AREAS = [
  "REVENUE", "COST_OF_SALES", "OPERATING_EXPENSES", "OTHER_INCOME", "FINANCE_COSTS",
  "TAXATION", "CASH_AND_BANK", "RECEIVABLES", "INVENTORIES", "INVESTMENTS",
  "FIXED_ASSETS", "INTANGIBLES", "PAYABLES", "BORROWINGS", "PROVISIONS",
  "EQUITY", "RELATED_PARTIES", "CONTINGENCIES", "COMMITMENTS", "EVENTS_AFTER_REPORTING"
] as const;

const substantiveTestSchema = z.object({
  testReference: z.string().min(1),
  fsArea: z.enum(FS_AREAS),
  accountName: z.string().min(1),
  assertion: z.string().min(1),
  riskId: z.string().optional(),
  testingType: z.enum(["DETAIL", "ANALYTICAL", "COMBINED"]),
  testObjective: z.string().min(1),
  testProcedure: z.string().min(1),
  samplingMethod: z.enum(SAMPLING_METHODS).optional(),
  populationDescription: z.string().optional(),
  populationValue: z.number().optional(),
  populationCount: z.number().optional(),
  sampleSize: z.number().optional(),
  sampleValue: z.number().optional(),
  confidenceLevel: z.number().optional(),
  tolerableError: z.number().optional(),
  expectedError: z.number().optional(),
  samplingRationale: z.string().optional(),
  testingPeriodStart: z.coerce.date().optional(),
  testingPeriodEnd: z.coerce.date().optional(),
});

router.get("/:engagementId/tests", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) {
      return res.status(404).json({ error: access.error });
    }

    const { fsArea, testingType } = req.query;
    const where: any = { engagementId: req.params.engagementId };
    if (fsArea) where.fsArea = fsArea;
    if (testingType) where.testingType = testingType;

    const tests = await prisma.substantiveTest.findMany({
      where,
      include: {
        performedBy: { select: { id: true, fullName: true, role: true } },
        reviewedBy: { select: { id: true, fullName: true, role: true } },
        managerApprovedBy: { select: { id: true, fullName: true, role: true } },
        risk: { select: { id: true, riskDescription: true, accountOrClass: true } },
        _count: { select: { samples: true, misstatements: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(tests);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch tests", details: error.message });
  }
});

router.post("/:engagementId/tests", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) {
      return res.status(404).json({ error: access.error });
    }

    const data = substantiveTestSchema.parse(req.body);

    const test = await prisma.substantiveTest.create({
      data: {
        ...data,
        engagementId: req.params.engagementId,
        performedById: req.user!.id,
      },
      include: {
        performedBy: { select: { id: true, fullName: true, role: true } },
      },
    });

    await logAuditTrail(
      req.user!.id, "SUBSTANTIVE_TEST_CREATED", "substantive_test", test.id,
      null, test, req.params.engagementId,
      `Substantive test ${data.testReference} created for ${data.fsArea}`,
      req.ip, req.get("user-agent")
    );

    res.status(201).json(test);
  } catch (error: any) {
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to create test", details: error.message });
  }
});

router.patch("/:engagementId/tests/:testId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) {
      return res.status(404).json({ error: access.error });
    }

    const existing = await prisma.substantiveTest.findUnique({ where: { id: req.params.testId } });
    if (!existing) {
      return res.status(404).json({ error: "Test not found" });
    }

    const test = await prisma.substantiveTest.update({
      where: { id: req.params.testId },
      data: req.body,
      include: {
        performedBy: { select: { id: true, fullName: true, role: true } },
        reviewedBy: { select: { id: true, fullName: true, role: true } },
      },
    });

    await logAuditTrail(
      req.user!.id, "SUBSTANTIVE_TEST_UPDATED", "substantive_test", test.id,
      existing, test, req.params.engagementId,
      `Substantive test ${test.testReference} updated`,
      req.ip, req.get("user-agent")
    );

    res.json(test);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to update test", details: error.message });
  }
});

router.post("/:engagementId/tests/:testId/review", requireAuth, requireMinRole("SENIOR"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) {
      return res.status(404).json({ error: access.error });
    }

    const test = await prisma.substantiveTest.update({
      where: { id: req.params.testId },
      data: {
        reviewedById: req.user!.id,
        reviewedDate: new Date(),
        reviewerComments: req.body.comments,
      },
      include: {
        performedBy: { select: { id: true, fullName: true, role: true } },
        reviewedBy: { select: { id: true, fullName: true, role: true } },
      },
    });

    await logAuditTrail(
      req.user!.id, "SUBSTANTIVE_TEST_REVIEWED", "substantive_test", test.id,
      null, { reviewedById: req.user!.id }, req.params.engagementId,
      `Substantive test ${test.testReference} reviewed`,
      req.ip, req.get("user-agent")
    );

    res.json(test);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to review test", details: error.message });
  }
});

router.post("/:engagementId/tests/:testId/manager-approve", requireAuth, requireMinRole("MANAGER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) {
      return res.status(404).json({ error: access.error });
    }

    const existing = await prisma.substantiveTest.findUnique({ where: { id: req.params.testId } });
    if (!existing?.reviewedById) {
      return res.status(400).json({ error: "Test must be reviewed before manager approval" });
    }

    const test = await prisma.substantiveTest.update({
      where: { id: req.params.testId },
      data: {
        managerApprovedById: req.user!.id,
        managerApprovalDate: new Date(),
      },
      include: {
        performedBy: { select: { id: true, fullName: true, role: true } },
        managerApprovedBy: { select: { id: true, fullName: true, role: true } },
      },
    });

    await logAuditTrail(
      req.user!.id, "SUBSTANTIVE_TEST_MANAGER_APPROVED", "substantive_test", test.id,
      null, { managerApprovedById: req.user!.id }, req.params.engagementId,
      `Substantive test ${test.testReference} manager approved`,
      req.ip, req.get("user-agent")
    );

    res.json(test);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to approve test", details: error.message });
  }
});

// Sample Size Calculator
router.post("/:engagementId/calculate-sample-size", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { samplingMethod, populationSize, populationValue, confidenceLevel, tolerableError, expectedError } = req.body;

    let sampleSize = 0;
    let rationale = "";

    if (samplingMethod === "MONETARY_UNIT_SAMPLING") {
      const confidenceFactor = confidenceLevel === 95 ? 3.0 : confidenceLevel === 90 ? 2.31 : 2.0;
      const tolerableErrorAmt = (tolerableError / 100) * populationValue;
      const expectedErrorAmt = (expectedError / 100) * populationValue;
      
      if (tolerableErrorAmt > 0) {
        sampleSize = Math.ceil((populationValue * confidenceFactor) / (tolerableErrorAmt - expectedErrorAmt));
      }
      rationale = `MUS: Population ${populationValue}, Confidence Factor ${confidenceFactor}, TE ${tolerableError}%, EE ${expectedError}%`;
    } else if (samplingMethod === "STATISTICAL_RANDOM") {
      const zScore = confidenceLevel === 95 ? 1.96 : confidenceLevel === 90 ? 1.645 : 1.28;
      const p = 0.5;
      const e = tolerableError / 100;
      
      sampleSize = Math.ceil((zScore * zScore * p * (1 - p)) / (e * e));
      if (populationSize && sampleSize > populationSize) {
        sampleSize = Math.ceil((sampleSize * populationSize) / (sampleSize + populationSize - 1));
      }
      rationale = `Statistical Random: Z=${zScore}, Population=${populationSize}, Confidence=${confidenceLevel}%`;
    } else {
      sampleSize = Math.max(25, Math.ceil(populationSize * 0.1));
      rationale = `Non-statistical: 10% of population with minimum 25 items`;
    }

    res.json({ sampleSize: Math.max(1, sampleSize), rationale, samplingMethod });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to calculate sample size", details: error.message });
  }
});

// Sample Items
router.get("/:engagementId/tests/:testId/samples", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) {
      return res.status(404).json({ error: access.error });
    }

    const samples = await prisma.sampleItem.findMany({
      where: { substantiveTestId: req.params.testId },
      include: {
        testedBy: { select: { id: true, fullName: true, role: true } },
      },
      orderBy: { createdAt: "asc" },
    });
    res.json(samples);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch samples", details: error.message });
  }
});

router.post("/:engagementId/tests/:testId/samples", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) {
      return res.status(404).json({ error: access.error });
    }

    const sample = await prisma.sampleItem.create({
      data: {
        ...req.body,
        substantiveTestId: req.params.testId,
        testedById: req.user!.id,
        difference: req.body.bookValue && req.body.auditedValue 
          ? req.body.bookValue - req.body.auditedValue 
          : null,
      },
      include: {
        testedBy: { select: { id: true, fullName: true, role: true } },
      },
    });

    res.status(201).json(sample);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to create sample", details: error.message });
  }
});

// Misstatements
router.get("/:engagementId/misstatements", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) {
      return res.status(404).json({ error: access.error });
    }

    const misstatements = await prisma.misstatement.findMany({
      where: { engagementId: req.params.engagementId },
      include: {
        identifiedBy: { select: { id: true, fullName: true, role: true } },
        reviewedBy: { select: { id: true, fullName: true, role: true } },
        partnerApprovedBy: { select: { id: true, fullName: true, role: true } },
        substantiveTest: { select: { id: true, testReference: true, fsArea: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(misstatements);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch misstatements", details: error.message });
  }
});

router.post("/:engagementId/misstatements", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) {
      return res.status(404).json({ error: access.error });
    }

    const misstatement = await prisma.misstatement.create({
      data: {
        ...req.body,
        engagementId: req.params.engagementId,
        identifiedById: req.user!.id,
      },
      include: {
        identifiedBy: { select: { id: true, fullName: true, role: true } },
      },
    });

    await logAuditTrail(
      req.user!.id, "MISSTATEMENT_IDENTIFIED", "misstatement", misstatement.id,
      null, misstatement, req.params.engagementId,
      `Misstatement ${misstatement.misstatementReference} identified: ${misstatement.misstatementAmount}`,
      req.ip, req.get("user-agent")
    );

    res.status(201).json(misstatement);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to create misstatement", details: error.message });
  }
});

router.patch("/:engagementId/misstatements/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) {
      return res.status(404).json({ error: access.error });
    }

    const existing = await prisma.misstatement.findUnique({ where: { id: req.params.id } });
    
    const misstatement = await prisma.misstatement.update({
      where: { id: req.params.id },
      data: req.body,
      include: {
        identifiedBy: { select: { id: true, fullName: true, role: true } },
      },
    });

    await logAuditTrail(
      req.user!.id, "MISSTATEMENT_UPDATED", "misstatement", misstatement.id,
      existing, misstatement, req.params.engagementId,
      `Misstatement ${misstatement.misstatementReference} updated`,
      req.ip, req.get("user-agent")
    );

    res.json(misstatement);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to update misstatement", details: error.message });
  }
});

router.get("/:engagementId/misstatement-summary", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) {
      return res.status(404).json({ error: access.error });
    }

    const misstatements = await prisma.misstatement.findMany({
      where: { engagementId: req.params.engagementId },
    });

    const materiality = await prisma.materialityAssessment.findFirst({
      where: { engagementId: req.params.engagementId, approvedById: { not: null } },
      orderBy: { createdAt: "desc" },
    });

    const totalIdentified = misstatements.reduce((sum, m) => sum + Number(m.misstatementAmount), 0);
    const totalAdjusted = misstatements
      .filter(m => m.status === "ADJUSTED")
      .reduce((sum, m) => sum + Number(m.misstatementAmount), 0);
    const totalUnadjusted = misstatements
      .filter(m => m.status === "UNADJUSTED")
      .reduce((sum, m) => sum + Number(m.misstatementAmount), 0);

    res.json({
      totalMisstatements: misstatements.length,
      totalIdentified,
      totalAdjusted,
      totalUnadjusted,
      byStatus: {
        identified: misstatements.filter(m => m.status === "IDENTIFIED").length,
        adjusted: misstatements.filter(m => m.status === "ADJUSTED").length,
        unadjusted: misstatements.filter(m => m.status === "UNADJUSTED").length,
        waived: misstatements.filter(m => m.status === "WAIVED").length,
      },
      materialityComparison: materiality ? {
        performanceMateriality: Number(materiality.performanceMateriality),
        unadjustedExceedsPM: totalUnadjusted > Number(materiality.performanceMateriality),
        overallMateriality: Number(materiality.overallMateriality),
        unadjustedExceedsOM: totalUnadjusted > Number(materiality.overallMateriality),
      } : null,
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch summary", details: error.message });
  }
});

export default router;
