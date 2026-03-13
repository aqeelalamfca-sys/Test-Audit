import { Router, Response } from "express";
import { z } from "zod";
import { prisma } from "./db";
import { requireAuth, requireMinRole, logAuditTrail, AuthenticatedRequest } from "./auth";
import { validateEngagementAccess } from "./lib/validateEngagementAccess";

const router = Router();

).optional();

// ============================================
// ASSERTION TESTS (ISA 315/500)
// ============================================

const assertionTestSchema = z.object({
  fsArea: z.enum(FS_AREAS),
  accountName: z.string().min(1),
  assertion: z.string().min(1),
  testObjective: z.string().min(1),
  testProcedures: z.string().min(1),
  existenceTested: z.boolean().default(false),
  existenceResult: z.string().optional(),
  completenessTested: z.boolean().default(false),
  completenessResult: z.string().optional(),
  accuracyTested: z.boolean().default(false),
  accuracyResult: z.string().optional(),
  valuationTested: z.boolean().default(false),
  valuationResult: z.string().optional(),
  rightsTested: z.boolean().default(false),
  rightsResult: z.string().optional(),
  obligationsTested: z.boolean().default(false),
  obligationsResult: z.string().optional(),
  cutOffTested: z.boolean().default(false),
  cutOffResult: z.string().optional(),
  classificationTested: z.boolean().default(false),
  classificationResult: z.string().optional(),
  presentationTested: z.boolean().default(false),
  presentationResult: z.string().optional(),
  overallConclusion: z.string().optional(),
  conclusionSatisfactory: z.boolean().optional(),
  linkedTestIds: z.array(z.string()).default([]),
});

router.get("/:engagementId/assertion-tests", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) {
      return res.status(access.error === "User not associated with a firm" ? 400 : 404).json({ error: access.error });
    }
    
    const tests = await prisma.assertionTest.findMany({
      where: { engagementId: req.params.engagementId },
      include: {
        performedBy: { select: { id: true, fullName: true, role: true } },
        reviewedBy: { select: { id: true, fullName: true, role: true } },
      },
      orderBy: [{ fsArea: "asc" }, { accountName: "asc" }],
    });
    res.json(tests);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch assertion tests", details: error.message });
  }
});

router.post("/:engagementId/assertion-tests", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) {
      return res.status(access.error === "User not associated with a firm" ? 400 : 404).json({ error: access.error });
    }
    
    const data = assertionTestSchema.parse(req.body);
    
    const test = await prisma.assertionTest.create({
      data: {
        engagementId: req.params.engagementId,
        performedById: req.user!.id,
        ...data,
      },
      include: {
        performedBy: { select: { id: true, fullName: true, role: true } },
      },
    });
    
    await logAuditTrail(req.user!.id, "CREATE", "AssertionTest", test.id, null, test);
    res.status(201).json(test);
  } catch (error: any) {
    if (error.code === "P2002") {
      return res.status(400).json({ error: "Assertion test already exists for this account and assertion" });
    }
    res.status(500).json({ error: "Failed to create assertion test", details: error.message });
  }
});

router.get("/:engagementId/assertion-matrix", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) {
      return res.status(access.error === "User not associated with a firm" ? 400 : 404).json({ error: access.error });
    }
    
    const tests = await prisma.assertionTest.findMany({
      where: { engagementId: req.params.engagementId },
      orderBy: [{ fsArea: "asc" }, { accountName: "asc" }],
    });
    
    const assertions = ["existence", "completeness", "accuracy", "valuation", "rights", "obligations", "cutOff", "classification", "presentation"];
    
    const matrix = tests.reduce((acc: any, test) => {
      if (!acc[test.fsArea]) {
        acc[test.fsArea] = {};
      }
      if (!acc[test.fsArea][test.accountName]) {
        acc[test.fsArea][test.accountName] = {};
      }
      
      assertions.forEach((assertion) => {
        const testedField = `${assertion}Tested` as keyof typeof test;
        const resultField = `${assertion}Result` as keyof typeof test;
        acc[test.fsArea][test.accountName][assertion] = {
          tested: test[testedField] || false,
          result: test[resultField] || null,
        };
      });
      
      return acc;
    }, {});
    
    res.json({
      matrix,
      assertions,
      summary: {
        totalAccounts: tests.length,
        completedTests: tests.filter((t) => t.conclusionSatisfactory !== null).length,
        satisfactory: tests.filter((t) => t.conclusionSatisfactory === true).length,
        unsatisfactory: tests.filter((t) => t.conclusionSatisfactory === false).length,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to generate assertion matrix", details: error.message });
  }
});

// ============================================
// EXTERNAL CONFIRMATIONS (ISA 505)
// ============================================

const confirmationSchema = z.object({
  confirmationType: z.enum(CONFIRMATION_TYPES),
  fsArea: z.enum(FS_AREAS),
  accountName: z.string().min(1),
  assertion: z.string().min(1),
  thirdPartyName: z.string().min(1),
  thirdPartyAddress: z.string().optional(),
  thirdPartyEmail: z.string().email().optional().or(z.literal("")),
  thirdPartyPhone: z.string().optional(),
  thirdPartyContact: z.string().optional(),
  requestedAmount: z.union([z.number(), z.string()]).transform((v) => v ? Number(v) : undefined).optional(),
  responseDeadline: z.string().optional(),
  substantiveTestId: z.string().optional(),
});

router.get("/:engagementId/confirmations", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) {
      return res.status(access.error === "User not associated with a firm" ? 400 : 404).json({ error: access.error });
    }
    
    const { status, fsArea } = req.query;
    const where: any = { engagementId: req.params.engagementId };
    if (status) where.status = status;
    if (fsArea) where.fsArea = fsArea;
    
    const confirmations = await prisma.externalConfirmation.findMany({
      where,
      include: {
        preparedBy: { select: { id: true, fullName: true, role: true } },
        reviewedBy: { select: { id: true, fullName: true, role: true } },
        substantiveTest: { select: { id: true, testReference: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(confirmations);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch confirmations", details: error.message });
  }
});

router.post("/:engagementId/confirmations", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) {
      return res.status(access.error === "User not associated with a firm" ? 400 : 404).json({ error: access.error });
    }
    
    const data = confirmationSchema.parse(req.body);
    
    const count = await prisma.externalConfirmation.count({
      where: { engagementId: req.params.engagementId },
    });
    
    const confirmation = await prisma.externalConfirmation.create({
      data: {
        engagementId: req.params.engagementId,
        confirmationReference: `CONF-${String(count + 1).padStart(4, "0")}`,
        preparedById: req.user!.id,
        confirmationType: data.confirmationType as any,
        fsArea: data.fsArea as any,
        accountName: data.accountName,
        assertion: data.assertion,
        thirdPartyName: data.thirdPartyName,
        thirdPartyAddress: data.thirdPartyAddress,
        thirdPartyEmail: data.thirdPartyEmail,
        thirdPartyPhone: data.thirdPartyPhone,
        thirdPartyContact: data.thirdPartyContact,
        requestedAmount: data.requestedAmount,
        responseDeadline: data.responseDeadline ? new Date(data.responseDeadline) : undefined,
        substantiveTestId: data.substantiveTestId,
      },
      include: {
        preparedBy: { select: { id: true, fullName: true, role: true } },
      },
    });
    
    await logAuditTrail(req.user!.id, "CREATE", "ExternalConfirmation", confirmation.id, null, confirmation);
    res.status(201).json(confirmation);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to create confirmation", details: error.message });
  }
});

router.put("/:engagementId/confirmations/:id/status", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) {
      return res.status(access.error === "User not associated with a firm" ? 400 : 404).json({ error: access.error });
    }
    
    const { status, confirmedAmount, differenceExplanation, alternativeProcedure, conclusion } = req.body;
    
    const updateData: any = { status };
    
    if (status === "SENT") {
      updateData.sentDate = new Date();
    } else if (status === "RECEIVED" || status === "CONFIRMED") {
      updateData.responseReceivedDate = new Date();
      if (confirmedAmount !== undefined) {
        updateData.confirmedAmount = confirmedAmount;
        const existing = await prisma.externalConfirmation.findUnique({
          where: { id: req.params.id },
        });
        if (existing?.requestedAmount) {
          updateData.difference = Number(confirmedAmount) - Number(existing.requestedAmount);
        }
      }
    } else if (status === "ALTERNATIVE_PROCEDURE") {
      updateData.alternativeProcedure = alternativeProcedure;
      updateData.alternativeProcedureDate = new Date();
    }
    
    if (differenceExplanation) updateData.differenceExplanation = differenceExplanation;
    if (conclusion) {
      updateData.conclusion = conclusion;
      updateData.conclusionSatisfactory = !conclusion.toLowerCase().includes("unsatisfactory");
    }
    
    const updated = await prisma.externalConfirmation.update({
      where: { id: req.params.id },
      data: updateData,
      include: {
        preparedBy: { select: { id: true, fullName: true, role: true } },
        reviewedBy: { select: { id: true, fullName: true, role: true } },
      },
    });
    
    await logAuditTrail(req.user!.id, "UPDATE", "ExternalConfirmation", updated.id, null, { status });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to update confirmation status", details: error.message });
  }
});

router.get("/:engagementId/confirmations/summary", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) {
      return res.status(access.error === "User not associated with a firm" ? 400 : 404).json({ error: access.error });
    }
    
    const confirmations = await prisma.externalConfirmation.findMany({
      where: { engagementId: req.params.engagementId },
    });
    
    const summary = {
      total: confirmations.length,
      byStatus: {} as Record<string, number>,
      byFsArea: {} as Record<string, number>,
      responseRate: 0,
      exceptionsCount: 0,
      totalRequestedAmount: 0,
      totalConfirmedAmount: 0,
      totalDifference: 0,
    };
    
    confirmations.forEach((c) => {
      summary.byStatus[c.status] = (summary.byStatus[c.status] || 0) + 1;
      summary.byFsArea[c.fsArea] = (summary.byFsArea[c.fsArea] || 0) + 1;
      if (c.requestedAmount) summary.totalRequestedAmount += Number(c.requestedAmount);
      if (c.confirmedAmount) summary.totalConfirmedAmount += Number(c.confirmedAmount);
      if (c.difference) summary.totalDifference += Math.abs(Number(c.difference));
      if (c.status === "EXCEPTION") summary.exceptionsCount++;
    });
    
    const responded = confirmations.filter((c) => ["RECEIVED", "CONFIRMED", "EXCEPTION"].includes(c.status)).length;
    summary.responseRate = summary.total > 0 ? (responded / summary.total) * 100 : 0;
    
    res.json(summary);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to generate confirmation summary", details: error.message });
  }
});

// ============================================
// REVENUE TESTING (IFRS 15, ISA 500/501)
// ============================================

const numericOptional = z.union([z.number(), z.string()]).transform((v) => v !== "" && v !== undefined ? Number(v) : undefined).optional();
const intOptional = z.union([z.number(), z.string()]).transform((v) => v !== "" && v !== undefined ? Math.round(Number(v)) : undefined).optional();

const revenueTestSchema = z.object({
  testType: z.string().min(1),
  contractAnalysis: z.boolean().default(false),
  performanceObligationsIdentified: z.boolean().default(false),
  transactionPriceAllocated: z.boolean().default(false),
  recognitionTimingValidated: z.boolean().default(false),
  cutOffTestingDone: z.boolean().default(false),
  cutOffDate: z.string().optional(),
  salesBeforeCutoff: intOptional,
  salesAfterCutoff: intOptional,
  cutOffExceptionsFound: z.union([z.number(), z.string()]).transform((v) => Number(v) || 0).default(0),
  cutOffExceptionDetails: z.string().optional(),
  populationDescription: z.string().optional(),
  populationValue: numericOptional,
  populationCount: intOptional,
  sampleSize: intOptional,
  exceptionsFound: z.union([z.number(), z.string()]).transform((v) => Number(v) || 0).default(0),
  exceptionDetails: z.string().optional(),
  relatedPartyRevenue: numericOptional,
  relatedPartyReviewed: z.boolean().default(false),
  returnProvisionTested: z.boolean().default(false),
  returnProvisionAmount: numericOptional,
  returnProvisionAssessment: z.string().optional(),
  variableConsiderationTested: z.boolean().default(false),
  variableConsiderationAmount: numericOptional,
  constraintApplied: z.boolean().default(false),
  billAndHoldArrangements: z.boolean().default(false),
  billAndHoldDetails: z.string().optional(),
  revenueReconciled: z.boolean().default(false),
  reconciledToGL: numericOptional,
  reconciledToSubLedger: numericOptional,
  conclusion: z.string().optional(),
  conclusionSatisfactory: z.boolean().optional(),
  workpaperReference: z.string().optional(),
});

router.get("/:engagementId/revenue-tests", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) {
      return res.status(access.error === "User not associated with a firm" ? 400 : 404).json({ error: access.error });
    }
    
    const tests = await prisma.revenueTest.findMany({
      where: { engagementId: req.params.engagementId },
      include: {
        performedBy: { select: { id: true, fullName: true, role: true } },
        reviewedBy: { select: { id: true, fullName: true, role: true } },
        partnerApprovedBy: { select: { id: true, fullName: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(tests);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch revenue tests", details: error.message });
  }
});

router.post("/:engagementId/revenue-tests", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) {
      return res.status(access.error === "User not associated with a firm" ? 400 : 404).json({ error: access.error });
    }
    
    const data = revenueTestSchema.parse(req.body);
    
    const count = await prisma.revenueTest.count({
      where: { engagementId: req.params.engagementId },
    });
    
    const test = await prisma.revenueTest.create({
      data: {
        engagementId: req.params.engagementId,
        testReference: `REV-${String(count + 1).padStart(3, "0")}`,
        performedById: req.user!.id,
        ...data,
        cutOffDate: data.cutOffDate ? new Date(data.cutOffDate) : undefined,
        reconciliationVariance: data.reconciledToGL && data.reconciledToSubLedger 
          ? data.reconciledToGL - data.reconciledToSubLedger : undefined,
      },
      include: {
        performedBy: { select: { id: true, fullName: true, role: true } },
      },
    });
    
    await logAuditTrail(req.user!.id, "CREATE", "RevenueTest", test.id, null, test);
    res.status(201).json(test);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to create revenue test", details: error.message });
  }
});

router.put("/:engagementId/revenue-tests/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) {
      return res.status(access.error === "User not associated with a firm" ? 400 : 404).json({ error: access.error });
    }
    
    const data = revenueTestSchema.partial().parse(req.body);
    
    const updated = await prisma.revenueTest.update({
      where: { id: req.params.id },
      data: {
        ...data,
        cutOffDate: data.cutOffDate ? new Date(data.cutOffDate) : undefined,
        reconciliationVariance: data.reconciledToGL && data.reconciledToSubLedger 
          ? data.reconciledToGL - data.reconciledToSubLedger : undefined,
      },
      include: {
        performedBy: { select: { id: true, fullName: true, role: true } },
        reviewedBy: { select: { id: true, fullName: true, role: true } },
      },
    });
    
    await logAuditTrail(req.user!.id, "UPDATE", "RevenueTest", updated.id, null, data);
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to update revenue test", details: error.message });
  }
});

// ============================================
// INVENTORY TESTING (IAS 2, ISA 501)
// ============================================

const inventoryTestSchema = z.object({
  inventoryCategory: z.string().optional(),
  location: z.string().optional(),
  physicalVerificationDone: z.boolean().default(false),
  physicalVerificationDate: z.string().optional(),
  physicalCountAttended: z.boolean().default(false),
  countSheetReference: z.string().optional(),
  bookQuantity: numericOptional,
  countedQuantity: numericOptional,
  valuationMethod: z.enum(VALUATION_METHODS).optional(),
  valuationTested: z.boolean().default(false),
  bookValue: numericOptional,
  auditedValue: numericOptional,
  costingRecordsTested: z.boolean().default(false),
  purchasePriceVerified: z.boolean().default(false),
  overheadAllocationReviewed: z.boolean().default(false),
  nrvTested: z.boolean().default(false),
  nrvCalculation: numericOptional,
  nrvBelow: z.boolean().default(false),
  nrvWritedown: numericOptional,
  obsolescenceReviewed: z.boolean().default(false),
  obsolescenceProvision: numericOptional,
  slowMovingItems: z.any().optional(),
  agingAnalysisDone: z.boolean().default(false),
  cutOffTestingDone: z.boolean().default(false),
  lastGRNBeforeCutoff: z.string().optional(),
  firstGRNAfterCutoff: z.string().optional(),
  lastGINBeforeCutoff: z.string().optional(),
  firstGINAfterCutoff: z.string().optional(),
  cutOffExceptionsFound: z.union([z.number(), z.string()]).transform((v) => Number(v) || 0).default(0),
  consignmentInventory: numericOptional,
  consignmentReviewed: z.boolean().default(false),
  goodsInTransit: numericOptional,
  transitTermsReviewed: z.boolean().default(false),
  conclusion: z.string().optional(),
  conclusionSatisfactory: z.boolean().optional(),
  workpaperReference: z.string().optional(),
});

router.get("/:engagementId/inventory-tests", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) {
      return res.status(access.error === "User not associated with a firm" ? 400 : 404).json({ error: access.error });
    }
    
    const tests = await prisma.inventoryTest.findMany({
      where: { engagementId: req.params.engagementId },
      include: {
        performedBy: { select: { id: true, fullName: true, role: true } },
        reviewedBy: { select: { id: true, fullName: true, role: true } },
        partnerApprovedBy: { select: { id: true, fullName: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(tests);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch inventory tests", details: error.message });
  }
});

router.post("/:engagementId/inventory-tests", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) {
      return res.status(access.error === "User not associated with a firm" ? 400 : 404).json({ error: access.error });
    }
    
    const data = inventoryTestSchema.parse(req.body);
    
    const count = await prisma.inventoryTest.count({
      where: { engagementId: req.params.engagementId },
    });
    
    let quantityVariance: number | undefined;
    let quantityVariancePercent: number | undefined;
    let valuationVariance: number | undefined;
    
    if (data.bookQuantity && data.countedQuantity) {
      quantityVariance = data.countedQuantity - data.bookQuantity;
      quantityVariancePercent = data.bookQuantity !== 0 
        ? (quantityVariance / data.bookQuantity) * 100 : 0;
    }
    
    if (data.bookValue && data.auditedValue) {
      valuationVariance = data.auditedValue - data.bookValue;
    }
    
    const test = await prisma.inventoryTest.create({
      data: {
        engagementId: req.params.engagementId,
        testReference: `INV-${String(count + 1).padStart(3, "0")}`,
        performedById: req.user!.id,
        ...data,
        physicalVerificationDate: data.physicalVerificationDate ? new Date(data.physicalVerificationDate) : undefined,
        quantityVariance,
        quantityVariancePercent,
        valuationVariance,
      },
      include: {
        performedBy: { select: { id: true, fullName: true, role: true } },
      },
    });
    
    await logAuditTrail(req.user!.id, "CREATE", "InventoryTest", test.id, null, test);
    res.status(201).json(test);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to create inventory test", details: error.message });
  }
});

router.put("/:engagementId/inventory-tests/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) {
      return res.status(access.error === "User not associated with a firm" ? 400 : 404).json({ error: access.error });
    }
    
    const data = inventoryTestSchema.partial().parse(req.body);
    
    let updateData: any = { ...data };
    
    if (data.physicalVerificationDate) {
      updateData.physicalVerificationDate = new Date(data.physicalVerificationDate);
    }
    
    if (data.bookQuantity !== undefined && data.countedQuantity !== undefined) {
      updateData.quantityVariance = data.countedQuantity - data.bookQuantity;
      updateData.quantityVariancePercent = data.bookQuantity !== 0 
        ? (updateData.quantityVariance / data.bookQuantity) * 100 : 0;
    }
    
    if (data.bookValue !== undefined && data.auditedValue !== undefined) {
      updateData.valuationVariance = data.auditedValue - data.bookValue;
    }
    
    const updated = await prisma.inventoryTest.update({
      where: { id: req.params.id },
      data: updateData,
      include: {
        performedBy: { select: { id: true, fullName: true, role: true } },
        reviewedBy: { select: { id: true, fullName: true, role: true } },
      },
    });
    
    await logAuditTrail(req.user!.id, "UPDATE", "InventoryTest", updated.id, null, data);
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to update inventory test", details: error.message });
  }
});

router.get("/:engagementId/inventory-tests/nrv-analysis", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) {
      return res.status(access.error === "User not associated with a firm" ? 400 : 404).json({ error: access.error });
    }
    
    const tests = await prisma.inventoryTest.findMany({
      where: { 
        engagementId: req.params.engagementId,
        nrvTested: true,
      },
    });
    
    const analysis = {
      totalItemsTested: tests.length,
      itemsBelowNRV: tests.filter((t) => t.nrvBelow).length,
      totalWritedownRequired: tests.reduce((sum, t) => sum + Number(t.nrvWritedown || 0), 0),
      byCategory: {} as Record<string, { count: number; writedown: number }>,
    };
    
    tests.forEach((t) => {
      const category = t.inventoryCategory || "Uncategorized";
      if (!analysis.byCategory[category]) {
        analysis.byCategory[category] = { count: 0, writedown: 0 };
      }
      if (t.nrvBelow) {
        analysis.byCategory[category].count++;
        analysis.byCategory[category].writedown += Number(t.nrvWritedown || 0);
      }
    });
    
    res.json(analysis);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to generate NRV analysis", details: error.message });
  }
});

// ============================================
// FIXED ASSETS TESTING (IAS 16/36, ISA 500/501)
// ============================================

const fixedAssetTestSchema = z.object({
  assetCategory: z.string().min(1),
  existenceVerified: z.boolean().default(false),
  physicalVerificationDate: z.string().optional(),
  assetsInspectedCount: z.union([z.number(), z.string()]).transform((v) => Number(v) || 0).default(0),
  assetsMissingCount: z.union([z.number(), z.string()]).transform((v) => Number(v) || 0).default(0),
  additionsTested: z.boolean().default(false),
  additionsAmount: numericOptional,
  additionsSampleSize: intOptional,
  additionsExceptions: z.union([z.number(), z.string()]).transform((v) => Number(v) || 0).default(0),
  capitalizationThresholdCompliant: z.boolean().default(false),
  disposalsTested: z.boolean().default(false),
  disposalsAmount: numericOptional,
  disposalsSampleSize: intOptional,
  disposalsExceptions: z.union([z.number(), z.string()]).transform((v) => Number(v) || 0).default(0),
  gainLossCalculationVerified: z.boolean().default(false),
  depreciationMethod: z.enum(DEPRECIATION_METHODS).optional(),
  depreciationTested: z.boolean().default(false),
  usefulLifeReasonable: z.boolean().default(false),
  residualValueReasonable: z.boolean().default(false),
  depreciationRecalculated: z.boolean().default(false),
  depreciationVariance: numericOptional,
  titleVerified: z.boolean().default(false),
  titleDocumentsReviewed: z.union([z.number(), z.string()]).transform((v) => Number(v) || 0).default(0),
  encumbrances: z.string().optional(),
  pledgedAssets: numericOptional,
  impairmentReviewed: z.boolean().default(false),
  impairmentIndicatorsPresent: z.boolean().default(false),
  impairmentIndicators: z.string().optional(),
  impairmentTestPerformed: z.boolean().default(false),
  recoverableAmount: numericOptional,
  impairmentLoss: numericOptional,
  revaluationReviewed: z.boolean().default(false),
  revaluationDate: z.string().optional(),
  valuationMethod: z.string().optional(),
  valuerIndependent: z.boolean().default(false),
  valuerName: z.string().optional(),
  valuerQualifications: z.string().optional(),
  revaluationSurplus: numericOptional,
  capitalWIPReviewed: z.boolean().default(false),
  capitalWIPAmount: numericOptional,
  wIPAgingReviewed: z.boolean().default(false),
  leasedAssetsTested: z.boolean().default(false),
  rouAssetAmount: numericOptional,
  leaseTermReasonable: z.boolean().default(false),
  conclusion: z.string().optional(),
  conclusionSatisfactory: z.boolean().optional(),
  workpaperReference: z.string().optional(),
});

router.get("/:engagementId/fixed-asset-tests", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) {
      return res.status(access.error === "User not associated with a firm" ? 400 : 404).json({ error: access.error });
    }
    
    const tests = await prisma.fixedAssetTest.findMany({
      where: { engagementId: req.params.engagementId },
      include: {
        performedBy: { select: { id: true, fullName: true, role: true } },
        reviewedBy: { select: { id: true, fullName: true, role: true } },
        partnerApprovedBy: { select: { id: true, fullName: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(tests);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch fixed asset tests", details: error.message });
  }
});

router.post("/:engagementId/fixed-asset-tests", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) {
      return res.status(access.error === "User not associated with a firm" ? 400 : 404).json({ error: access.error });
    }
    
    const data = fixedAssetTestSchema.parse(req.body);
    
    const count = await prisma.fixedAssetTest.count({
      where: { engagementId: req.params.engagementId },
    });
    
    const test = await prisma.fixedAssetTest.create({
      data: {
        engagementId: req.params.engagementId,
        testReference: `FA-${String(count + 1).padStart(3, "0")}`,
        performedById: req.user!.id,
        ...data,
        physicalVerificationDate: data.physicalVerificationDate ? new Date(data.physicalVerificationDate) : undefined,
        revaluationDate: data.revaluationDate ? new Date(data.revaluationDate) : undefined,
      },
      include: {
        performedBy: { select: { id: true, fullName: true, role: true } },
      },
    });
    
    await logAuditTrail(req.user!.id, "CREATE", "FixedAssetTest", test.id, null, test);
    res.status(201).json(test);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to create fixed asset test", details: error.message });
  }
});

router.put("/:engagementId/fixed-asset-tests/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) {
      return res.status(access.error === "User not associated with a firm" ? 400 : 404).json({ error: access.error });
    }
    
    const data = fixedAssetTestSchema.partial().parse(req.body);
    
    const updated = await prisma.fixedAssetTest.update({
      where: { id: req.params.id },
      data: {
        ...data,
        physicalVerificationDate: data.physicalVerificationDate ? new Date(data.physicalVerificationDate) : undefined,
        revaluationDate: data.revaluationDate ? new Date(data.revaluationDate) : undefined,
      },
      include: {
        performedBy: { select: { id: true, fullName: true, role: true } },
        reviewedBy: { select: { id: true, fullName: true, role: true } },
      },
    });
    
    await logAuditTrail(req.user!.id, "UPDATE", "FixedAssetTest", updated.id, null, data);
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to update fixed asset test", details: error.message });
  }
});

// ============================================
// ACCOUNTING ESTIMATES (ISA 540)
// ============================================

const accountingEstimateSchema = z.object({
  estimateName: z.string().min(1),
  fsArea: z.enum(FS_AREAS),
  accountName: z.string().min(1),
  estimateComplexity: z.enum(ESTIMATE_COMPLEXITIES).default("MODERATE"),
  significantRisk: z.boolean().default(false),
  estimatedAmount: numericOptional,
  priorYearEstimate: numericOptional,
  priorYearActual: numericOptional,
  managementMethod: z.string().optional(),
  managementAssumptions: z.any().optional(),
  managementDataSources: z.string().optional(),
  auditorAssessment: z.string().optional(),
  auditorPointEstimate: numericOptional,
  auditorRangeMin: numericOptional,
  auditorRangeMax: numericOptional,
  inherentRiskFactors: z.any().optional(),
  specializedSkillsNeeded: z.boolean().default(false),
  expertUsed: z.boolean().default(false),
  expertName: z.string().optional(),
  expertArea: z.string().optional(),
  keyAssumptions: z.any().optional(),
  assumptionsSupportedByEvidence: z.boolean().default(false),
  assumptionsConsistentWithMarket: z.boolean().default(false),
  sensitivityAnalysisDone: z.boolean().default(false),
  sensitivityResults: z.any().optional(),
  modelValidated: z.boolean().default(false),
  modelDescription: z.string().optional(),
  disclosuresAdequate: z.boolean().default(false),
  disclosureReview: z.string().optional(),
  conclusion: z.string().optional(),
  conclusionSatisfactory: z.boolean().optional(),
  workpaperReference: z.string().optional(),
});

router.get("/:engagementId/accounting-estimates", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) {
      return res.status(access.error === "User not associated with a firm" ? 400 : 404).json({ error: access.error });
    }
    
    const estimates = await prisma.accountingEstimate.findMany({
      where: { engagementId: req.params.engagementId },
      include: {
        performedBy: { select: { id: true, fullName: true, role: true } },
        reviewedBy: { select: { id: true, fullName: true, role: true } },
        partnerApprovedBy: { select: { id: true, fullName: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(estimates);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch accounting estimates", details: error.message });
  }
});

router.post("/:engagementId/accounting-estimates", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) {
      return res.status(access.error === "User not associated with a firm" ? 400 : 404).json({ error: access.error });
    }
    
    const data = accountingEstimateSchema.parse(req.body);
    
    const count = await prisma.accountingEstimate.count({
      where: { engagementId: req.params.engagementId },
    });
    
    let retrospectiveVariance: number | undefined;
    if (data.priorYearEstimate && data.priorYearActual) {
      retrospectiveVariance = data.priorYearActual - data.priorYearEstimate;
    }
    
    const estimate = await prisma.accountingEstimate.create({
      data: {
        engagementId: req.params.engagementId,
        estimateReference: `EST-${String(count + 1).padStart(3, "0")}`,
        performedById: req.user!.id,
        ...data,
        estimateComplexity: data.estimateComplexity as any,
        fsArea: data.fsArea as any,
        retrospectiveVariance,
      },
      include: {
        performedBy: { select: { id: true, fullName: true, role: true } },
      },
    });
    
    await logAuditTrail(req.user!.id, "CREATE", "AccountingEstimate", estimate.id, null, estimate);
    res.status(201).json(estimate);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to create accounting estimate", details: error.message });
  }
});

router.put("/:engagementId/accounting-estimates/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) {
      return res.status(access.error === "User not associated with a firm" ? 400 : 404).json({ error: access.error });
    }
    
    const data = accountingEstimateSchema.partial().parse(req.body);
    
    let updateData: any = { ...data };
    
    if (data.priorYearEstimate !== undefined && data.priorYearActual !== undefined) {
      updateData.retrospectiveVariance = data.priorYearActual - data.priorYearEstimate;
    }
    
    const updated = await prisma.accountingEstimate.update({
      where: { id: req.params.id },
      data: updateData,
      include: {
        performedBy: { select: { id: true, fullName: true, role: true } },
        reviewedBy: { select: { id: true, fullName: true, role: true } },
      },
    });
    
    await logAuditTrail(req.user!.id, "UPDATE", "AccountingEstimate", updated.id, null, data);
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to update accounting estimate", details: error.message });
  }
});

// ============================================
// AI-POWERED TESTING & ANOMALY DETECTION
// ============================================

router.post("/:engagementId/ai-anomaly-detection", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) {
      return res.status(access.error === "User not associated with a firm" ? 400 : 404).json({ error: access.error });
    }
    
    const { transactions, analysisType } = req.body;
    
    if (!transactions || !Array.isArray(transactions)) {
      return res.status(400).json({ error: "Transactions array required" });
    }
    
    const anomalies: any[] = [];
    let findingCount = await prisma.testAnomalyFinding.count({
      where: { engagementId: req.params.engagementId },
    });
    
    // Statistical Outlier Detection (Z-score method)
    const amounts = transactions.map((t: any) => Number(t.amount)).filter((a) => !isNaN(a));
    if (amounts.length > 0) {
      const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
      const stdDev = Math.sqrt(amounts.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / amounts.length);
      
      transactions.forEach((t: any, index: number) => {
        const amount = Number(t.amount);
        if (!isNaN(amount) && stdDev > 0) {
          const zScore = Math.abs((amount - mean) / stdDev);
          if (zScore > 3) {
            anomalies.push({
              type: "STATISTICAL_OUTLIER",
              severity: zScore > 4 ? "CRITICAL" : "HIGH",
              transaction: t,
              score: zScore,
              confidence: Math.min(0.99, 0.7 + (zScore - 3) * 0.1),
              description: `Transaction amount ${amount} is ${zScore.toFixed(2)} standard deviations from mean`,
              expectedValue: mean,
              actualValue: amount,
              deviationPercent: ((amount - mean) / mean) * 100,
            });
          }
        }
      });
    }
    
    // Benford's Law Analysis (first digit distribution)
    if (analysisType === "benford" || !analysisType) {
      const expectedBenford = [0, 30.1, 17.6, 12.5, 9.7, 7.9, 6.7, 5.8, 5.1, 4.6];
      const firstDigitCounts = new Array(10).fill(0);
      
      transactions.forEach((t: any) => {
        const amount = Math.abs(Number(t.amount));
        if (amount >= 1) {
          const firstDigit = parseInt(String(amount)[0]);
          if (firstDigit >= 1 && firstDigit <= 9) {
            firstDigitCounts[firstDigit]++;
          }
        }
      });
      
      const total = firstDigitCounts.reduce((a, b) => a + b, 0);
      if (total > 50) {
        for (let digit = 1; digit <= 9; digit++) {
          const observedPercent = (firstDigitCounts[digit] / total) * 100;
          const deviation = Math.abs(observedPercent - expectedBenford[digit]);
          if (deviation > 5) {
            anomalies.push({
              type: "BENFORD_ANOMALY",
              severity: deviation > 10 ? "HIGH" : "MEDIUM",
              description: `Digit ${digit} appears ${observedPercent.toFixed(1)}% vs expected ${expectedBenford[digit]}%`,
              expectedValue: expectedBenford[digit],
              actualValue: observedPercent,
              deviationPercent: deviation,
              confidence: Math.min(0.95, 0.6 + (deviation - 5) * 0.03),
              statisticalSignificance: deviation / expectedBenford[digit],
            });
          }
        }
      }
    }
    
    // Duplicate Transaction Detection
    const seen = new Map();
    transactions.forEach((t: any, index: number) => {
      const key = `${t.amount}_${t.date}_${t.description}`;
      if (seen.has(key)) {
        anomalies.push({
          type: "DUPLICATE_TRANSACTION",
          severity: "MEDIUM",
          transaction: t,
          originalIndex: seen.get(key),
          duplicateIndex: index,
          description: `Potential duplicate transaction: ${t.description} for ${t.amount}`,
          confidence: 0.85,
        });
      } else {
        seen.set(key, index);
      }
    });
    
    // Round Number Pattern Detection
    const roundNumbers = transactions.filter((t: any) => {
      const amount = Number(t.amount);
      return amount >= 1000 && amount % 1000 === 0;
    });
    
    const roundNumberPercent = (roundNumbers.length / transactions.length) * 100;
    if (roundNumberPercent > 20) {
      anomalies.push({
        type: "ROUND_NUMBER_PATTERN",
        severity: roundNumberPercent > 40 ? "HIGH" : "MEDIUM",
        description: `${roundNumberPercent.toFixed(1)}% of transactions are round numbers (expected ~5%)`,
        expectedValue: 5,
        actualValue: roundNumberPercent,
        deviationPercent: roundNumberPercent - 5,
        confidence: Math.min(0.9, 0.5 + (roundNumberPercent - 20) * 0.02),
        affectedTransactions: roundNumbers.length,
      });
    }
    
    // Save significant anomalies to database
    const savedAnomalies = [];
    for (const anomaly of anomalies.filter((a) => a.confidence > 0.7)) {
      findingCount++;
      const finding = await prisma.testAnomalyFinding.create({
        data: {
          engagementId: req.params.engagementId,
          findingReference: `ANO-${String(findingCount).padStart(4, "0")}`,
          anomalyType: anomaly.type as any,
          severity: anomaly.severity as any,
          fsArea: anomaly.transaction?.fsArea as any || null,
          accountName: anomaly.transaction?.accountName || null,
          transactionDate: anomaly.transaction?.date ? new Date(anomaly.transaction.date) : null,
          transactionReference: anomaly.transaction?.reference || null,
          transactionAmount: anomaly.transaction?.amount || null,
          aiScore: anomaly.score || null,
          aiConfidence: anomaly.confidence,
          aiModel: "AuditWise Anomaly Detection v1.0",
          description: anomaly.description,
          detectionCriteria: anomaly.type,
          expectedValue: anomaly.expectedValue || null,
          actualValue: anomaly.actualValue || null,
          deviationPercent: anomaly.deviationPercent || null,
          statisticalSignificance: anomaly.statisticalSignificance || null,
          populationAnalyzed: transactions.length,
        },
      });
      savedAnomalies.push(finding);
    }
    
    await logAuditTrail(req.user!.id, "CREATE", "AnomalyDetection", req.params.engagementId, null, {
      transactionsAnalyzed: transactions.length,
      anomaliesFound: anomalies.length,
      savedToDatabase: savedAnomalies.length,
    });
    
    res.json({
      summary: {
        transactionsAnalyzed: transactions.length,
        totalAnomalies: anomalies.length,
        highSeverity: anomalies.filter((a) => a.severity === "HIGH" || a.severity === "CRITICAL").length,
        mediumSeverity: anomalies.filter((a) => a.severity === "MEDIUM").length,
        lowSeverity: anomalies.filter((a) => a.severity === "LOW").length,
        savedFindings: savedAnomalies.length,
      },
      anomalies,
      savedFindings: savedAnomalies,
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to perform anomaly detection", details: error.message });
  }
});

router.get("/:engagementId/anomaly-findings", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) {
      return res.status(access.error === "User not associated with a firm" ? 400 : 404).json({ error: access.error });
    }
    
    const { severity, status, type } = req.query;
    const where: any = { engagementId: req.params.engagementId };
    if (severity) where.severity = severity;
    if (status) where.investigationStatus = status;
    if (type) where.anomalyType = type;
    
    const findings = await prisma.testAnomalyFinding.findMany({
      where,
      include: {
        investigatedBy: { select: { id: true, fullName: true, role: true } },
        reviewedBy: { select: { id: true, fullName: true, role: true } },
        misstatement: { select: { id: true, misstatementReference: true } },
      },
      orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
    });
    res.json(findings);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch anomaly findings", details: error.message });
  }
});

router.put("/:engagementId/anomaly-findings/:id/investigate", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) {
      return res.status(access.error === "User not associated with a firm" ? 400 : 404).json({ error: access.error });
    }
    
    const { investigationNotes, falsePositive, falsePositiveReason, isMisstatement, recommendation, actionTaken } = req.body;
    
    const updated = await prisma.testAnomalyFinding.update({
      where: { id: req.params.id },
      data: {
        investigationStatus: falsePositive ? "false_positive" : isMisstatement ? "misstatement" : "investigated",
        investigationNotes,
        investigatedById: req.user!.id,
        investigatedDate: new Date(),
        falsePositive: falsePositive || false,
        falsePositiveReason,
        isMisstatement: isMisstatement || false,
        recommendation,
        actionTaken,
      },
      include: {
        investigatedBy: { select: { id: true, fullName: true, role: true } },
      },
    });
    
    await logAuditTrail(req.user!.id, "UPDATE", "TestAnomalyFinding", updated.id, null, { investigationStatus: updated.investigationStatus });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to update anomaly investigation", details: error.message });
  }
});

router.post("/:engagementId/automated-sample-selection", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) {
      return res.status(access.error === "User not associated with a firm" ? 400 : 404).json({ error: access.error });
    }
    
    const { population, sampleSize, method, confidenceLevel, tolerableMisstatement, expectedMisstatement, stratify } = req.body;
    
    if (!population || !Array.isArray(population) || population.length === 0) {
      return res.status(400).json({ error: "Population array required" });
    }
    
    const sortedPopulation = [...population].sort((a, b) => Number(b.value) - Number(a.value));
    const totalValue = sortedPopulation.reduce((sum, item) => sum + Number(item.value || 0), 0);
    
    let selectedItems: any[] = [];
    let calculatedSampleSize = sampleSize;
    
    // Calculate sample size if not provided (using audit sampling formula)
    if (!sampleSize && confidenceLevel && tolerableMisstatement) {
      const reliabilityFactor = confidenceLevel >= 95 ? 3.0 : confidenceLevel >= 90 ? 2.3 : 1.9;
      const expectedMisstatementFactor = expectedMisstatement ? (expectedMisstatement / tolerableMisstatement) : 0;
      calculatedSampleSize = Math.ceil((reliabilityFactor * totalValue) / (tolerableMisstatement * (1 - expectedMisstatementFactor)));
      calculatedSampleSize = Math.min(calculatedSampleSize, population.length);
    }
    
    const targetSampleSize = calculatedSampleSize || Math.min(30, population.length);
    
    switch (method) {
      case "MUS": // Monetary Unit Sampling
        const samplingInterval = totalValue / targetSampleSize;
        let cumulativeValue = 0;
        let nextSamplingPoint = Math.random() * samplingInterval;
        
        for (const item of sortedPopulation) {
          cumulativeValue += Number(item.value);
          while (nextSamplingPoint <= cumulativeValue && selectedItems.length < targetSampleSize) {
            selectedItems.push({
              ...item,
              selectionMethod: "MUS",
              samplingPoint: nextSamplingPoint.toFixed(2),
            });
            nextSamplingPoint += samplingInterval;
          }
        }
        break;
        
      case "STRATIFIED":
        if (stratify) {
          const strata = new Map();
          population.forEach((item) => {
            const key = item[stratify] || "Other";
            if (!strata.has(key)) strata.set(key, []);
            strata.get(key).push(item);
          });
          
          const itemsPerStratum = Math.ceil(targetSampleSize / strata.size);
          strata.forEach((items, stratum) => {
            const sorted = items.sort((a: any, b: any) => Number(b.value) - Number(a.value));
            const selected = sorted.slice(0, Math.min(itemsPerStratum, items.length));
            selected.forEach((item: any) => {
              selectedItems.push({ ...item, selectionMethod: "STRATIFIED", stratum });
            });
          });
        }
        break;
        
      case "HIGH_VALUE":
        selectedItems = sortedPopulation.slice(0, targetSampleSize).map((item) => ({
          ...item,
          selectionMethod: "HIGH_VALUE",
        }));
        break;
        
      case "RANDOM":
      default:
        const shuffled = [...population].sort(() => Math.random() - 0.5);
        selectedItems = shuffled.slice(0, targetSampleSize).map((item) => ({
          ...item,
          selectionMethod: "RANDOM",
        }));
        break;
    }
    
    const selectedValue = selectedItems.reduce((sum, item) => sum + Number(item.value || 0), 0);
    
    res.json({
      summary: {
        populationSize: population.length,
        populationValue: totalValue,
        sampleSize: selectedItems.length,
        sampleValue: selectedValue,
        coveragePercent: ((selectedValue / totalValue) * 100).toFixed(2),
        method: method || "RANDOM",
        confidenceLevel,
        tolerableMisstatement,
      },
      selectedItems,
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to perform sample selection", details: error.message });
  }
});

// ============================================
// TESTING SUMMARY & DASHBOARD
// ============================================

router.get("/:engagementId/substantive-testing/summary", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) {
      return res.status(access.error === "User not associated with a firm" ? 400 : 404).json({ error: access.error });
    }
    
    const [
      assertionTests,
      confirmations,
      revenueTests,
      inventoryTests,
      fixedAssetTests,
      estimates,
      anomalies,
      substantiveTests,
      misstatements,
    ] = await Promise.all([
      prisma.assertionTest.count({ where: { engagementId: req.params.engagementId } }),
      prisma.externalConfirmation.findMany({ where: { engagementId: req.params.engagementId } }),
      prisma.revenueTest.findMany({ where: { engagementId: req.params.engagementId } }),
      prisma.inventoryTest.findMany({ where: { engagementId: req.params.engagementId } }),
      prisma.fixedAssetTest.findMany({ where: { engagementId: req.params.engagementId } }),
      prisma.accountingEstimate.findMany({ where: { engagementId: req.params.engagementId } }),
      prisma.testAnomalyFinding.findMany({ where: { engagementId: req.params.engagementId } }),
      prisma.substantiveTest.findMany({ where: { engagementId: req.params.engagementId } }),
      prisma.misstatement.findMany({ where: { engagementId: req.params.engagementId } }),
    ]);
    
    const confirmationSummary = {
      total: confirmations.length,
      sent: confirmations.filter((c) => c.status !== "DRAFTED").length,
      confirmed: confirmations.filter((c) => c.status === "CONFIRMED").length,
      exceptions: confirmations.filter((c) => c.status === "EXCEPTION").length,
      pending: confirmations.filter((c) => c.status === "SENT").length,
    };
    
    const testingSummary = {
      revenue: {
        total: revenueTests.length,
        completed: revenueTests.filter((t) => t.conclusionSatisfactory !== null).length,
        satisfactory: revenueTests.filter((t) => t.conclusionSatisfactory === true).length,
      },
      inventory: {
        total: inventoryTests.length,
        completed: inventoryTests.filter((t) => t.conclusionSatisfactory !== null).length,
        satisfactory: inventoryTests.filter((t) => t.conclusionSatisfactory === true).length,
      },
      fixedAssets: {
        total: fixedAssetTests.length,
        completed: fixedAssetTests.filter((t) => t.conclusionSatisfactory !== null).length,
        satisfactory: fixedAssetTests.filter((t) => t.conclusionSatisfactory === true).length,
      },
      estimates: {
        total: estimates.length,
        completed: estimates.filter((e) => e.conclusionSatisfactory !== null).length,
        satisfactory: estimates.filter((e) => e.conclusionSatisfactory === true).length,
        highComplexity: estimates.filter((e) => e.estimateComplexity === "COMPLEX").length,
      },
    };
    
    const anomalySummary = {
      total: anomalies.length,
      critical: anomalies.filter((a) => a.severity === "CRITICAL").length,
      high: anomalies.filter((a) => a.severity === "HIGH").length,
      investigated: anomalies.filter((a) => a.investigationStatus !== "pending").length,
      falsePositives: anomalies.filter((a) => a.falsePositive).length,
      confirmedMisstatements: anomalies.filter((a) => a.isMisstatement).length,
    };
    
    const misstatementSummary = {
      total: misstatements.length,
      factual: misstatements.filter((m) => m.misstatementType === "FACTUAL").length,
      judgmental: misstatements.filter((m) => m.misstatementType === "JUDGMENTAL").length,
      projected: misstatements.filter((m) => m.misstatementType === "PROJECTED").length,
      adjusted: misstatements.filter((m) => m.status === "ADJUSTED").length,
      unadjusted: misstatements.filter((m) => m.status === "UNADJUSTED").length,
      totalAmount: misstatements.reduce((sum, m) => sum + Number(m.misstatementAmount || 0), 0),
    };
    
    const overallProgress = {
      assertionTests,
      confirmations: confirmationSummary,
      testing: testingSummary,
      anomalies: anomalySummary,
      misstatements: misstatementSummary,
      substantiveTests: substantiveTests.length,
      completionStatus: {
        revenueComplete: revenueTests.length > 0 && revenueTests.every((t) => t.conclusionSatisfactory !== null),
        inventoryComplete: inventoryTests.length > 0 && inventoryTests.every((t) => t.conclusionSatisfactory !== null),
        fixedAssetsComplete: fixedAssetTests.length > 0 && fixedAssetTests.every((t) => t.conclusionSatisfactory !== null),
        estimatesComplete: estimates.length > 0 && estimates.every((e) => e.conclusionSatisfactory !== null),
        confirmationsComplete: confirmations.length > 0 && confirmations.every((c) => ["CONFIRMED", "ALTERNATIVE_PROCEDURE", "CANCELLED"].includes(c.status)),
      },
    };
    
    res.json(overallProgress);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to generate substantive testing summary", details: error.message });
  }
});

export default router;
