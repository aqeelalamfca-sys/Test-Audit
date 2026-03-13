import { Router, Response } from "express";
import { prisma } from "./db";
import { z } from "zod";
import { validateEngagementAccess } from "./lib/validateEngagementAccess";

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



async function logAuditTrail(
  userId: string, action: string, entityType: string, entityId: string | null,
  beforeValue: any, afterValue: any, engagementId: string, justification: string,
  ipAddress?: string, userAgent?: string
) {
  await prisma.auditTrail.create({
    data: { userId, action, entityType, entityId, beforeValue, afterValue, engagementId, justification, ipAddress, userAgent },
  });
}

// Trial Balance Import
router.post("/:engagementId/trial-balance", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) {
      return res.status(404).json({ error: access.error });
    }

    const { periodType, periodEnd, lineItems } = req.body;

    const tb = await prisma.trialBalance.create({
      data: {
        engagementId: req.params.engagementId,
        periodType: periodType || "current",
        periodEnd: new Date(periodEnd),
        importedById: req.user!.id,
        sourceFile: req.body.sourceFile,
        totalAssets: req.body.totalAssets,
        totalLiabilities: req.body.totalLiabilities,
        totalEquity: req.body.totalEquity,
        totalRevenue: req.body.totalRevenue,
        totalExpenses: req.body.totalExpenses,
        netIncome: req.body.netIncome,
        lineItems: {
          create: lineItems?.map((item: any) => ({
            accountCode: item.accountCode,
            accountName: item.accountName,
            fsArea: item.fsArea,
            openingBalance: item.openingBalance || 0,
            debits: item.debits || 0,
            credits: item.credits || 0,
            closingBalance: item.closingBalance || 0,
            priorYearBalance: item.priorYearBalance,
            budgetAmount: item.budgetAmount,
          })) || [],
        },
      },
      include: {
        importedBy: { select: { id: true, fullName: true, role: true } },
        _count: { select: { lineItems: true } },
      },
    });

    await logAuditTrail(
      req.user!.id, "TRIAL_BALANCE_IMPORTED", "trial_balance", tb.id,
      null, { lineItemsCount: lineItems?.length || 0 }, req.params.engagementId,
      `Trial balance imported for ${periodType} period`,
      req.ip, req.get("user-agent")
    );

    res.status(201).json(tb);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to import trial balance", details: error.message });
  }
});

router.get("/:engagementId/trial-balance", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) {
      return res.status(404).json({ error: access.error });
    }

    const trialBalances = await prisma.trialBalance.findMany({
      where: { engagementId: req.params.engagementId },
      include: {
        importedBy: { select: { id: true, fullName: true, role: true } },
        lineItems: true,
        _count: { select: { lineItems: true, analyticalProcedures: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(trialBalances);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch trial balances", details: error.message });
  }
});

// Analytical Procedures
router.get("/:engagementId/procedures", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) {
      return res.status(404).json({ error: access.error });
    }

    const procedures = await prisma.analyticalProcedure.findMany({
      where: { engagementId: req.params.engagementId },
      include: {
        performedBy: { select: { id: true, fullName: true, role: true } },
        reviewedBy: { select: { id: true, fullName: true, role: true } },
        managerApprovedBy: { select: { id: true, fullName: true, role: true } },
        escalatedTo: { select: { id: true, fullName: true, role: true } },
        ratioAnalyses: true,
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(procedures);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch procedures", details: error.message });
  }
});

const analyticalProcedureSchema = z.object({
  procedureReference: z.string().min(1),
  analyticalType: z.enum(["RATIO_ANALYSIS", "TREND_ANALYSIS", "VARIANCE_ANALYSIS", "REASONABLENESS_TEST", "REGRESSION_ANALYSIS"]),
  fsArea: z.string().optional(),
  linkedRiskIds: z.array(z.string()).default([]),
  linkedAssertions: z.array(z.string()).default([]),
  description: z.string().min(1),
  expectation: z.string().min(1),
  expectationBasis: z.string().optional(),
  thresholdType: z.string().optional(),
  thresholdValue: z.number().optional(),
  thresholdPercentage: z.number().optional(),
  trialBalanceId: z.string().optional(),
});

router.post("/:engagementId/procedures", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) {
      return res.status(404).json({ error: access.error });
    }

    const data = analyticalProcedureSchema.parse(req.body);

    const procedure = await prisma.analyticalProcedure.create({
      data: {
        ...data,
        fsArea: data.fsArea as any,
        engagementId: req.params.engagementId,
        performedById: req.user!.id,
      },
      include: {
        performedBy: { select: { id: true, fullName: true, role: true } },
      },
    });

    await logAuditTrail(
      req.user!.id, "ANALYTICAL_PROCEDURE_CREATED", "analytical_procedure", procedure.id,
      null, procedure, req.params.engagementId,
      `Analytical procedure ${data.procedureReference} created`,
      req.ip, req.get("user-agent")
    );

    res.status(201).json(procedure);
  } catch (error: any) {
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to create procedure", details: error.message });
  }
});

router.patch("/:engagementId/procedures/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) {
      return res.status(404).json({ error: access.error });
    }

    const existing = await prisma.analyticalProcedure.findUnique({ where: { id: req.params.id } });

    const { actualValue, expectedValue, thresholdPercentage } = req.body;
    let varianceStatus = req.body.varianceStatus;

    if (actualValue !== undefined && expectedValue !== undefined) {
      const variance = actualValue - expectedValue;
      const variancePercentage = expectedValue !== 0 ? (variance / expectedValue) * 100 : 0;
      req.body.variance = variance;
      req.body.variancePercentage = variancePercentage;

      if (thresholdPercentage && Math.abs(variancePercentage) > thresholdPercentage) {
        varianceStatus = "EXCEEDS_THRESHOLD";
        req.body.investigationRequired = true;
      } else {
        varianceStatus = "WITHIN_THRESHOLD";
      }
      req.body.varianceStatus = varianceStatus;
    }

    const procedure = await prisma.analyticalProcedure.update({
      where: { id: req.params.id },
      data: req.body,
      include: {
        performedBy: { select: { id: true, fullName: true, role: true } },
        reviewedBy: { select: { id: true, fullName: true, role: true } },
      },
    });

    await logAuditTrail(
      req.user!.id, "ANALYTICAL_PROCEDURE_UPDATED", "analytical_procedure", procedure.id,
      existing, procedure, req.params.engagementId,
      `Analytical procedure ${procedure.procedureReference} updated`,
      req.ip, req.get("user-agent")
    );

    res.json(procedure);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to update procedure", details: error.message });
  }
});

router.post("/:engagementId/procedures/:id/escalate", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) {
      return res.status(404).json({ error: access.error });
    }

    const procedure = await prisma.analyticalProcedure.update({
      where: { id: req.params.id },
      data: {
        escalationRequired: true,
        escalatedToId: req.body.escalatedToId,
        escalationDate: new Date(),
        varianceStatus: "ESCALATED",
      },
      include: {
        performedBy: { select: { id: true, fullName: true, role: true } },
        escalatedTo: { select: { id: true, fullName: true, role: true } },
      },
    });

    await logAuditTrail(
      req.user!.id, "ANALYTICAL_PROCEDURE_ESCALATED", "analytical_procedure", procedure.id,
      null, { escalatedToId: req.body.escalatedToId }, req.params.engagementId,
      `Analytical procedure ${procedure.procedureReference} escalated`,
      req.ip, req.get("user-agent")
    );

    res.json(procedure);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to escalate", details: error.message });
  }
});

router.post("/:engagementId/procedures/:id/review", requireAuth, requireMinRole("SENIOR"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) {
      return res.status(404).json({ error: access.error });
    }

    const procedure = await prisma.analyticalProcedure.update({
      where: { id: req.params.id },
      data: {
        reviewedById: req.user!.id,
        reviewedDate: new Date(),
        reviewerComments: req.body.comments,
      },
    });

    res.json(procedure);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to review", details: error.message });
  }
});

// Auto-calculate ratios
router.post("/:engagementId/procedures/:id/calculate-ratios", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) {
      return res.status(404).json({ error: access.error });
    }

    const procedure = await prisma.analyticalProcedure.findUnique({
      where: { id: req.params.id },
      include: { trialBalance: { include: { lineItems: true } } },
    });

    if (!procedure?.trialBalance) {
      return res.status(400).json({ error: "No trial balance linked to this procedure" });
    }

    const tb = procedure.trialBalance;
    const lines = tb.lineItems;

    const getSum = (areas: string[]) => lines
      .filter(l => l.fsArea && areas.includes(l.fsArea))
      .reduce((sum, l) => sum + Number(l.closingBalance), 0);

    const ratios = [
      { name: "Current Ratio", formula: "Current Assets / Current Liabilities", currentValue: 0, priorYearValue: 0 },
      { name: "Quick Ratio", formula: "(Current Assets - Inventory) / Current Liabilities", currentValue: 0, priorYearValue: 0 },
      { name: "Gross Profit Margin", formula: "Gross Profit / Revenue", currentValue: 0, priorYearValue: 0 },
      { name: "Net Profit Margin", formula: "Net Income / Revenue", currentValue: Number(tb.netIncome) / Number(tb.totalRevenue) * 100 || 0, priorYearValue: 0 },
      { name: "Debt to Equity", formula: "Total Liabilities / Total Equity", currentValue: Number(tb.totalLiabilities) / Number(tb.totalEquity) || 0, priorYearValue: 0 },
    ];

    await prisma.ratioAnalysis.deleteMany({ where: { analyticalProcedureId: procedure.id } });
    
    const createdRatios = await Promise.all(ratios.map(ratio =>
      prisma.ratioAnalysis.create({
        data: {
          analyticalProcedureId: procedure.id,
          ratioName: ratio.name,
          ratioFormula: ratio.formula,
          currentValue: ratio.currentValue,
          priorYearValue: ratio.priorYearValue,
          varianceFromPrior: ratio.currentValue - ratio.priorYearValue,
        },
      })
    ));

    res.json(createdRatios);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to calculate ratios", details: error.message });
  }
});

// Variance alerts
router.get("/:engagementId/variance-alerts", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) {
      return res.status(404).json({ error: access.error });
    }

    const procedures = await prisma.analyticalProcedure.findMany({
      where: {
        engagementId: req.params.engagementId,
        varianceStatus: { in: ["EXCEEDS_THRESHOLD", "UNEXPLAINED", "ESCALATED"] },
      },
      include: {
        performedBy: { select: { id: true, fullName: true, role: true } },
        escalatedTo: { select: { id: true, fullName: true, role: true } },
      },
      orderBy: { variancePercentage: "desc" },
    });

    res.json(procedures);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch alerts", details: error.message });
  }
});

export default router;
