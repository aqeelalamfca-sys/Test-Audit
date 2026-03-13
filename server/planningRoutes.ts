import { Router, Response } from "express";
import { prisma } from "./db";
import { requireAuth, requireMinRole, logAuditTrail, type AuthenticatedRequest } from "./auth";
import { requirePhaseUnlocked, requirePreviousPhasesCompleted, preventDeletionAfterFinalization } from "./middleware/auditLock";
import { z } from "zod";

const router = Router();

const materialitySchema = z.object({
  benchmark: z.enum(["PBT", "REVENUE", "TOTAL_ASSETS", "EQUITY", "GROSS_PROFIT"]),
  benchmarkAmount: z.number().positive(),
  benchmarkPercentage: z.number().min(0.1).max(100),
  performanceMatPercentage: z.number().min(50).max(90).default(75),
  amptPercentage: z.number().min(1).max(10).default(5),
  justification: z.string().optional(),
});

const FS_AREAS = [
  "REVENUE", "COST_OF_SALES", "OPERATING_EXPENSES", "OTHER_INCOME", "FINANCE_COSTS",
  "TAXATION", "CASH_AND_BANK", "RECEIVABLES", "INVENTORIES", "INVESTMENTS",
  "FIXED_ASSETS", "INTANGIBLES", "PAYABLES", "BORROWINGS", "PROVISIONS",
  "EQUITY", "RELATED_PARTIES", "CONTINGENCIES", "COMMITMENTS", "EVENTS_AFTER_REPORTING"
] as const;

const AUDIT_CYCLES = [
  "REVENUE_CYCLE", "PURCHASE_CYCLE", "PAYROLL_CYCLE", "TREASURY_CYCLE",
  "INVENTORY_CYCLE", "FIXED_ASSETS_CYCLE", "INVESTMENTS_CYCLE",
  "FINANCING_CYCLE", "TAX_CYCLE", "PERIOD_END_CYCLE"
] as const;

const FRAUD_RISK_TYPES = [
  "REVENUE_RECOGNITION", "MANAGEMENT_OVERRIDE", "ASSET_MISAPPROPRIATION",
  "EXPENSE_MANIPULATION", "RELATED_PARTY_ABUSE", "DISCLOSURE_FRAUD", "OTHER"
] as const;

const ASSERTIONS = [
  "EXISTENCE", "COMPLETENESS", "ACCURACY", "VALUATION", "CUTOFF",
  "CLASSIFICATION", "OCCURRENCE", "RIGHTS_OBLIGATIONS", "PRESENTATION_DISCLOSURE"
] as const;

const riskAssessmentSchema = z.object({
  riskDescription: z.string().optional(),
  accountOrClass: z.string().min(1),
  fsArea: z.enum(FS_AREAS).optional(),
  auditCycle: z.enum(AUDIT_CYCLES).optional(),
  
  assertionImpacts: z.array(z.enum(ASSERTIONS)).default([]),
  assertion: z.enum(ASSERTIONS),
  
  inherentRisk: z.enum(["LOW", "MODERATE", "HIGH", "SIGNIFICANT"]),
  controlRisk: z.enum(["LOW", "MODERATE", "HIGH", "SIGNIFICANT"]),
  
  isSignificantRisk: z.boolean().default(false),
  significantRiskReason: z.string().optional(),
  
  isFraudRisk: z.boolean().default(false),
  fraudRiskType: z.enum(FRAUD_RISK_TYPES).optional(),
  fraudRiskIndicators: z.array(z.string()).default([]),
  fraudResponse: z.string().optional(),
  
  isLawsRegulationsRisk: z.boolean().default(false),
  applicableLaws: z.array(z.string()).default([]),
  complianceConsiderations: z.string().optional(),
  
  accountingFramework: z.string().default("IFRS"),
  companiesActSchedule: z.string().optional(),
  accountingStandardRef: z.string().optional(),
  
  inherentRiskFactors: z.array(z.string()).default([]),
  controlRiskFactors: z.array(z.string()).default([]),
  
  plannedResponse: z.string().optional(),
  natureOfProcedures: z.string().optional(),
  timingOfProcedures: z.string().optional(),
  extentOfProcedures: z.string().optional(),
});

function generatePlannedResponse(
  rommLevel: string, 
  isSignificantRisk: boolean,
  isFraudRisk: boolean,
  isLawsRegulationsRisk: boolean
): { nature: string; timing: string; extent: string; response: string } {
  let nature = "";
  let timing = "";
  let extent = "";
  
  if (rommLevel === "SIGNIFICANT" || isSignificantRisk || isFraudRisk) {
    nature = "Substantive procedures with emphasis on tests of details. Consider using external confirmations, physical inspection, and analytical procedures. For fraud risks, design procedures specifically to address the risk of management override.";
    timing = "Primarily at period end with some procedures performed during interim. For significant risks, more testing at period end.";
    extent = "Larger sample sizes. Consider 100% testing for high-value items. Use lower tolerable misstatement levels.";
  } else if (rommLevel === "HIGH") {
    nature = "Substantive procedures including tests of details and substantive analytical procedures. Consider external confirmations for key balances.";
    timing = "Mix of interim and period-end testing with emphasis on period end.";
    extent = "Increased sample sizes. Focus testing on higher-risk populations.";
  } else if (rommLevel === "MODERATE") {
    nature = "Combination of tests of controls (if controls are reliable) and substantive procedures. Include substantive analytical procedures.";
    timing = "Balance of interim and period-end procedures.";
    extent = "Moderate sample sizes based on assessed risk.";
  } else {
    nature = "Primarily substantive analytical procedures with limited tests of details. May rely on controls if tested.";
    timing = "Can perform more procedures at interim with limited period-end procedures.";
    extent = "Smaller sample sizes appropriate for low-risk areas.";
  }
  
  let response = `Nature: ${nature}\n\nTiming: ${timing}\n\nExtent: ${extent}`;
  
  if (isFraudRisk) {
    response += "\n\nFraud Response: Apply enhanced skepticism. Consider unpredictability in audit procedures. Obtain additional evidence from sources independent of the entity.";
  }
  
  if (isLawsRegulationsRisk) {
    response += "\n\nL&R Response: Inquire of management regarding compliance. Review correspondence with regulators. Consider obtaining legal confirmations.";
  }
  
  return { nature, timing, extent, response };
}

const goingConcernSchema = z.object({
  managementAssessmentPeriod: z.number().min(12).default(12),
  altmanZScore: z.number().optional(),
  currentRatio: z.number().optional(),
  quickRatio: z.number().optional(),
  debtEquityRatio: z.number().optional(),
  interestCoverage: z.number().optional(),
  netProfitLossTrend: z.string().optional(),
  cashFlowTrend: z.string().optional(),
  workingCapitalDeficit: z.boolean().default(false),
  defaultOnLoans: z.boolean().default(false),
  adverseKeyRatios: z.boolean().default(false),
  lossOfKeyCustomer: z.boolean().default(false),
  lossOfKeySupplier: z.boolean().default(false),
  laborDifficulties: z.boolean().default(false),
  materialShortages: z.boolean().default(false),
  lossOfMajorMarket: z.boolean().default(false),
  legalProceedings: z.boolean().default(false),
  regulatoryNonCompliance: z.boolean().default(false),
  pendingLegislation: z.boolean().default(false),
  managementPlans: z.string().optional(),
  managementPlansFeasibility: z.string().optional(),
  auditEvidence: z.string().optional(),
  auditConclusion: z.string().optional(),
  materialUncertaintyExists: z.boolean().default(false),
  reportingImplications: z.string().optional(),
});

const planningMemoSchema = z.object({
  entityBackground: z.string().optional(),
  industryAnalysis: z.string().optional(),
  accountingPolicies: z.string().optional(),
  internalControlSummary: z.string().optional(),
  keyAuditMatters: z.array(z.string()).default([]),
  significantRisks: z.array(z.string()).default([]),
  relatedParties: z.array(z.string()).default([]),
  auditApproach: z.string().optional(),
  samplingMethodology: z.string().optional(),
  teamBriefingNotes: z.string().optional(),
});

function calculateROMM(inherent: string, control: string): string {
  const riskMatrix: Record<string, Record<string, string>> = {
    LOW: { LOW: "LOW", MODERATE: "LOW", HIGH: "MODERATE", SIGNIFICANT: "HIGH" },
    MODERATE: { LOW: "LOW", MODERATE: "MODERATE", HIGH: "HIGH", SIGNIFICANT: "HIGH" },
    HIGH: { LOW: "MODERATE", MODERATE: "HIGH", HIGH: "HIGH", SIGNIFICANT: "SIGNIFICANT" },
    SIGNIFICANT: { LOW: "HIGH", MODERATE: "HIGH", HIGH: "SIGNIFICANT", SIGNIFICANT: "SIGNIFICANT" },
  };
  return riskMatrix[inherent]?.[control] || "MODERATE";
}

function calculateAltmanZScore(data: {
  workingCapital: number;
  retainedEarnings: number;
  ebit: number;
  marketValueEquity: number;
  bookValueDebt: number;
  sales: number;
  totalAssets: number;
}): { score: number; result: string } {
  const a = data.workingCapital / data.totalAssets;
  const b = data.retainedEarnings / data.totalAssets;
  const c = data.ebit / data.totalAssets;
  const d = data.marketValueEquity / data.bookValueDebt;
  const e = data.sales / data.totalAssets;
  
  const zScore = 1.2 * a + 1.4 * b + 3.3 * c + 0.6 * d + 1.0 * e;
  
  let result = "GREY";
  if (zScore > 2.99) result = "SAFE";
  else if (zScore < 1.81) result = "DISTRESS";
  
  return { score: Math.round(zScore * 100) / 100, result };
}

router.get("/:engagementId/materiality", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const assessments = await prisma.materialityAssessment.findMany({
      where: { engagementId: req.params.engagementId },
      include: { approvedBy: { select: { id: true, fullName: true, role: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json(assessments);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch materiality assessments", details: error.message });
  }
});

router.post("/:engagementId/materiality", requireAuth, requirePhaseUnlocked("PLANNING"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = materialitySchema.parse(req.body);
    
    const overallMateriality = data.benchmarkAmount * (data.benchmarkPercentage / 100);
    const performanceMateriality = overallMateriality * (data.performanceMatPercentage / 100);
    const amptThreshold = overallMateriality * (data.amptPercentage / 100);
    
    const assessment = await prisma.materialityAssessment.create({
      data: {
        engagementId: req.params.engagementId,
        benchmark: data.benchmark,
        benchmarkAmount: data.benchmarkAmount,
        benchmarkPercentage: data.benchmarkPercentage,
        overallMateriality,
        performanceMateriality,
        performanceMatPercentage: data.performanceMatPercentage,
        amptThreshold,
        amptPercentage: data.amptPercentage,
        justification: data.justification,
      },
      include: { approvedBy: { select: { id: true, fullName: true, role: true } } },
    });

    logAuditTrail(
      req.user!.id,
      "MATERIALITY_CREATED",
      "materiality_assessment",
      assessment.id,
      null,
      assessment,
      req.params.engagementId,
      `Created materiality assessment with OM: ${overallMateriality}`,
      req.ip,
      req.get("user-agent")
    ).catch(err => console.error("Audit trail error:", err));

    res.status(201).json(assessment);
  } catch (error: any) {
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to create materiality assessment", details: error.message });
  }
});

router.post("/:engagementId/materiality/:materialityId/approve", requireAuth, requireMinRole("PARTNER"), requirePhaseUnlocked("PLANNING"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const assessment = await prisma.materialityAssessment.update({
      where: { id: req.params.materialityId },
      data: {
        approvedById: req.user!.id,
        approvedDate: new Date(),
      },
      include: { approvedBy: { select: { id: true, fullName: true, role: true } } },
    });

    logAuditTrail(
      req.user!.id,
      "MATERIALITY_APPROVED",
      "materiality_assessment",
      assessment.id,
      null,
      assessment,
      req.params.engagementId,
      "Partner approved materiality assessment",
      req.ip,
      req.get("user-agent")
    ).catch(err => console.error("Audit trail error:", err));

    res.json(assessment);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to approve materiality", details: error.message });
  }
});

router.post("/:engagementId/materiality/calculate", requireAuth, requirePhaseUnlocked("PLANNING"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { benchmark, amount, percentage } = req.body;
    
    const benchmarkRanges: Record<string, { min: number; max: number; typical: number }> = {
      PBT: { min: 5, max: 10, typical: 5 },
      REVENUE: { min: 0.5, max: 2, typical: 1 },
      TOTAL_ASSETS: { min: 0.5, max: 2, typical: 1 },
      EQUITY: { min: 1, max: 5, typical: 2 },
      GROSS_PROFIT: { min: 0.5, max: 2, typical: 1 },
    };

    const range = benchmarkRanges[benchmark] || benchmarkRanges.PBT;
    const pct = percentage || range.typical;
    
    const overallMateriality = amount * (pct / 100);
    const performanceMateriality = overallMateriality * 0.75;
    const specificMateriality = overallMateriality * 0.5;
    const amptThreshold = overallMateriality * 0.05;

    res.json({
      benchmark,
      benchmarkAmount: amount,
      benchmarkPercentage: pct,
      suggestedRange: range,
      overallMateriality: Math.round(overallMateriality),
      performanceMateriality: Math.round(performanceMateriality),
      specificMateriality: Math.round(specificMateriality),
      amptThreshold: Math.round(amptThreshold),
      isaReference: "ISA 320",
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to calculate materiality", details: error.message });
  }
});

router.get("/:engagementId/risks", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const risks = await prisma.riskAssessment.findMany({
      where: { engagementId: req.params.engagementId },
      include: {
        assessedBy: { select: { id: true, fullName: true, role: true } },
        reviewedBy: { select: { id: true, fullName: true, role: true } },
        partnerApprovedBy: { select: { id: true, fullName: true, role: true } },
      },
      orderBy: [{ isSignificantRisk: "desc" }, { accountOrClass: "asc" }],
    });
    res.json(risks);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch risk assessments", details: error.message });
  }
});

router.post("/:engagementId/risks", requireAuth, requirePhaseUnlocked("PLANNING"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const engagement = await prisma.engagement.findUnique({
      where: { id: req.params.engagementId },
      select: { currentPhase: true },
    });
    
    if (engagement && ["EXECUTION", "FINALIZATION", "REPORTING", "EQCR", "INSPECTION"].includes(engagement.currentPhase)) {
      return res.status(403).json({ 
        error: "Risk register is locked", 
        message: "Cannot add risks after Execution has begun. Submit an override request for Partner+EQCR approval." 
      });
    }
    
    const data = riskAssessmentSchema.parse(req.body);
    
    const rommLevel = calculateROMM(data.inherentRisk, data.controlRisk);
    
    const generatedResponse = generatePlannedResponse(
      rommLevel,
      data.isSignificantRisk,
      data.isFraudRisk,
      data.isLawsRegulationsRisk
    );
    
    const risk = await prisma.riskAssessment.create({
      data: {
        engagementId: req.params.engagementId,
        riskDescription: data.riskDescription,
        accountOrClass: data.accountOrClass,
        fsArea: data.fsArea as any,
        auditCycle: data.auditCycle as any,
        assertionImpacts: data.assertionImpacts,
        assertion: data.assertion,
        inherentRisk: data.inherentRisk,
        controlRisk: data.controlRisk,
        riskOfMaterialMisstatement: rommLevel as any,
        isSignificantRisk: data.isSignificantRisk,
        significantRiskReason: data.significantRiskReason,
        isFraudRisk: data.isFraudRisk,
        fraudRiskType: data.fraudRiskType as any,
        fraudRiskIndicators: data.fraudRiskIndicators,
        fraudResponse: data.fraudResponse || (data.isFraudRisk ? generatedResponse.response : undefined),
        isLawsRegulationsRisk: data.isLawsRegulationsRisk,
        applicableLaws: data.applicableLaws,
        complianceConsiderations: data.complianceConsiderations,
        accountingFramework: data.accountingFramework,
        companiesActSchedule: data.companiesActSchedule,
        accountingStandardRef: data.accountingStandardRef,
        inherentRiskFactors: data.inherentRiskFactors,
        controlRiskFactors: data.controlRiskFactors,
        plannedResponse: data.plannedResponse || generatedResponse.response,
        natureOfProcedures: data.natureOfProcedures || generatedResponse.nature,
        timingOfProcedures: data.timingOfProcedures || generatedResponse.timing,
        extentOfProcedures: data.extentOfProcedures || generatedResponse.extent,
        isaReference: data.isFraudRisk ? "ISA 240, ISA 315 (Revised 2019)" : 
                      data.isLawsRegulationsRisk ? "ISA 250, ISA 315 (Revised 2019)" : 
                      "ISA 315 (Revised 2019)",
        assessedById: req.user!.id,
      },
      include: {
        assessedBy: { select: { id: true, fullName: true, role: true } },
        reviewedBy: { select: { id: true, fullName: true, role: true } },
        partnerApprovedBy: { select: { id: true, fullName: true, role: true } },
      },
    });

    logAuditTrail(
      req.user!.id,
      "RISK_ASSESSED",
      "risk_assessment",
      risk.id,
      null,
      risk,
      req.params.engagementId,
      `Risk assessed for ${data.accountOrClass} - ${data.assertion}${data.isFraudRisk ? " [FRAUD RISK]" : ""}${data.isLawsRegulationsRisk ? " [L&R RISK]" : ""}`,
      req.ip,
      req.get("user-agent")
    ).catch(err => console.error("Audit trail error:", err));

    res.status(201).json(risk);
  } catch (error: any) {
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to create risk assessment", details: error.message });
  }
});

const riskUpdateSchema = z.object({
  riskDescription: z.string().optional(),
  accountOrClass: z.string().min(1).optional(),
  fsArea: z.enum(FS_AREAS).optional(),
  auditCycle: z.enum(AUDIT_CYCLES).optional(),
  assertionImpacts: z.array(z.enum(ASSERTIONS)).optional(),
  assertion: z.enum(ASSERTIONS).optional(),
  inherentRisk: z.enum(["LOW", "MODERATE", "HIGH", "SIGNIFICANT"]).optional(),
  controlRisk: z.enum(["LOW", "MODERATE", "HIGH", "SIGNIFICANT"]).optional(),
  isSignificantRisk: z.boolean().optional(),
  significantRiskReason: z.string().optional(),
  isFraudRisk: z.boolean().optional(),
  fraudRiskType: z.enum(FRAUD_RISK_TYPES).optional(),
  fraudRiskIndicators: z.array(z.string()).optional(),
  fraudResponse: z.string().optional(),
  isLawsRegulationsRisk: z.boolean().optional(),
  applicableLaws: z.array(z.string()).optional(),
  complianceConsiderations: z.string().optional(),
  accountingFramework: z.string().optional(),
  companiesActSchedule: z.string().optional(),
  accountingStandardRef: z.string().optional(),
  inherentRiskFactors: z.array(z.string()).optional(),
  controlRiskFactors: z.array(z.string()).optional(),
  plannedResponse: z.string().optional(),
  natureOfProcedures: z.string().optional(),
  timingOfProcedures: z.string().optional(),
  extentOfProcedures: z.string().optional(),
});

router.patch("/:engagementId/risks/:riskId", requireAuth, requirePhaseUnlocked("PLANNING"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const engagement = await prisma.engagement.findUnique({
      where: { id: req.params.engagementId },
      select: { currentPhase: true },
    });
    
    if (engagement && ["EXECUTION", "FINALIZATION", "REPORTING", "EQCR", "INSPECTION"].includes(engagement.currentPhase)) {
      return res.status(403).json({ 
        error: "Risk register is locked", 
        message: "Cannot modify risks after Execution has begun. Submit an override request for Partner+EQCR approval." 
      });
    }
    
    const existing = await prisma.riskAssessment.findUnique({
      where: { id: req.params.riskId },
    });

    if (!existing) {
      return res.status(404).json({ error: "Risk assessment not found" });
    }

    const validatedData = riskUpdateSchema.parse(req.body);
    
    const updateData: Record<string, any> = {};
    const allowedFields = [
      "riskDescription", "accountOrClass", "fsArea", "auditCycle", "assertionImpacts",
      "assertion", "inherentRisk", "controlRisk", "isSignificantRisk", "significantRiskReason",
      "isFraudRisk", "fraudRiskType", "fraudRiskIndicators", "fraudResponse",
      "isLawsRegulationsRisk", "applicableLaws", "complianceConsiderations",
      "accountingFramework", "companiesActSchedule", "accountingStandardRef",
      "inherentRiskFactors", "controlRiskFactors", "plannedResponse",
      "natureOfProcedures", "timingOfProcedures", "extentOfProcedures"
    ];
    
    for (const field of allowedFields) {
      if (validatedData[field as keyof typeof validatedData] !== undefined) {
        updateData[field] = validatedData[field as keyof typeof validatedData];
      }
    }
    
    if (updateData.inherentRisk || updateData.controlRisk) {
      const inherent = updateData.inherentRisk || existing.inherentRisk;
      const control = updateData.controlRisk || existing.controlRisk;
      updateData.riskOfMaterialMisstatement = calculateROMM(inherent, control);
    }

    const risk = await prisma.riskAssessment.update({
      where: { id: req.params.riskId },
      data: updateData,
      include: {
        assessedBy: { select: { id: true, fullName: true, role: true } },
        reviewedBy: { select: { id: true, fullName: true, role: true } },
        partnerApprovedBy: { select: { id: true, fullName: true, role: true } },
      },
    });

    logAuditTrail(
      req.user!.id,
      "RISK_UPDATED",
      "risk_assessment",
      risk.id,
      existing,
      risk,
      req.params.engagementId,
      "Risk assessment updated",
      req.ip,
      req.get("user-agent")
    ).catch(err => console.error("Audit trail error:", err));

    res.json(risk);
  } catch (error: any) {
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to update risk assessment", details: error.message });
  }
});

router.post("/:engagementId/risks/:riskId/partner-approve", requireAuth, requireMinRole("PARTNER"), requirePhaseUnlocked("PLANNING"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const existing = await prisma.riskAssessment.findUnique({
      where: { id: req.params.riskId },
    });

    if (!existing) {
      return res.status(404).json({ error: "Risk assessment not found" });
    }

    if (!existing.isSignificantRisk) {
      return res.status(400).json({ error: "Partner approval is only required for significant risks" });
    }

    const risk = await prisma.riskAssessment.update({
      where: { id: req.params.riskId },
      data: {
        partnerApprovedById: req.user!.id,
        partnerApprovalDate: new Date(),
        partnerComments: req.body.comments,
      },
      include: {
        assessedBy: { select: { id: true, fullName: true, role: true } },
        reviewedBy: { select: { id: true, fullName: true, role: true } },
        partnerApprovedBy: { select: { id: true, fullName: true, role: true } },
      },
    });

    logAuditTrail(
      req.user!.id,
      "SIGNIFICANT_RISK_PARTNER_APPROVED",
      "risk_assessment",
      risk.id,
      existing,
      risk,
      req.params.engagementId,
      `Partner approved significant risk: ${existing.accountOrClass}`,
      req.ip,
      req.get("user-agent")
    ).catch(err => console.error("Audit trail error:", err));

    res.json(risk);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to approve significant risk", details: error.message });
  }
});

router.post("/:engagementId/risks/:riskId/review", requireAuth, requireMinRole("MANAGER"), requirePhaseUnlocked("PLANNING"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const risk = await prisma.riskAssessment.update({
      where: { id: req.params.riskId },
      data: {
        reviewedById: req.user!.id,
        reviewedDate: new Date(),
      },
      include: {
        assessedBy: { select: { id: true, fullName: true, role: true } },
        reviewedBy: { select: { id: true, fullName: true, role: true } },
      },
    });

    logAuditTrail(
      req.user!.id,
      "RISK_REVIEWED",
      "risk_assessment",
      risk.id,
      null,
      risk,
      req.params.engagementId,
      "Risk assessment reviewed by manager",
      req.ip,
      req.get("user-agent")
    ).catch(err => console.error("Audit trail error:", err));

    res.json(risk);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to review risk", details: error.message });
  }
});

router.get("/:engagementId/going-concern", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const assessment = await prisma.goingConcernAssessment.findUnique({
      where: { engagementId: req.params.engagementId },
      include: {
        preparedBy: { select: { id: true, fullName: true, role: true } },
        reviewedBy: { select: { id: true, fullName: true, role: true } },
        partnerApprovedBy: { select: { id: true, fullName: true, role: true } },
        indicators: true,
      },
    });
    res.json(assessment);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch going concern assessment", details: error.message });
  }
});

router.post("/:engagementId/going-concern", requireAuth, requirePhaseUnlocked("PLANNING"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = goingConcernSchema.parse(req.body);
    
    let altmanZScoreResult = null;
    if (data.altmanZScore !== undefined) {
      if (data.altmanZScore > 2.99) altmanZScoreResult = "SAFE";
      else if (data.altmanZScore < 1.81) altmanZScoreResult = "DISTRESS";
      else altmanZScoreResult = "GREY";
    }

    const assessment = await prisma.goingConcernAssessment.upsert({
      where: { engagementId: req.params.engagementId },
      create: {
        engagementId: req.params.engagementId,
        preparedById: req.user!.id,
        altmanZScoreResult,
        ...data,
      },
      update: {
        altmanZScoreResult,
        ...data,
      },
      include: {
        preparedBy: { select: { id: true, fullName: true, role: true } },
        reviewedBy: { select: { id: true, fullName: true, role: true } },
        partnerApprovedBy: { select: { id: true, fullName: true, role: true } },
        indicators: true,
      },
    });

    logAuditTrail(
      req.user!.id,
      "GOING_CONCERN_UPDATED",
      "going_concern_assessment",
      assessment.id,
      null,
      assessment,
      req.params.engagementId,
      "Going concern assessment updated",
      req.ip,
      req.get("user-agent")
    ).catch(err => console.error("Audit trail error:", err));

    res.json(assessment);
  } catch (error: any) {
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to save going concern assessment", details: error.message });
  }
});

router.post("/:engagementId/going-concern/calculate-zscore", requireAuth, requirePhaseUnlocked("PLANNING"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { workingCapital, retainedEarnings, ebit, marketValueEquity, bookValueDebt, sales, totalAssets } = req.body;
    
    if (!totalAssets || totalAssets === 0) {
      return res.status(400).json({ error: "Total assets must be provided and non-zero" });
    }

    const result = calculateAltmanZScore({
      workingCapital: workingCapital || 0,
      retainedEarnings: retainedEarnings || 0,
      ebit: ebit || 0,
      marketValueEquity: marketValueEquity || 0,
      bookValueDebt: bookValueDebt || 1,
      sales: sales || 0,
      totalAssets,
    });

    res.json({
      altmanZScore: result.score,
      result: result.result,
      interpretation: result.result === "SAFE" 
        ? "Z-Score > 2.99: Safe zone - low probability of bankruptcy"
        : result.result === "DISTRESS"
        ? "Z-Score < 1.81: Distress zone - high probability of bankruptcy"
        : "Z-Score 1.81-2.99: Grey zone - needs further analysis",
      isaReference: "ISA 570",
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to calculate Z-Score", details: error.message });
  }
});

router.get("/:engagementId/planning-memo", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const memo = await prisma.planningMemo.findUnique({
      where: { engagementId: req.params.engagementId },
      include: {
        preparedBy: { select: { id: true, fullName: true, role: true } },
        managerReviewedBy: { select: { id: true, fullName: true, role: true } },
        partnerApprovedBy: { select: { id: true, fullName: true, role: true } },
      },
    });
    res.json(memo);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch planning memo", details: error.message });
  }
});

router.post("/:engagementId/planning-memo", requireAuth, requirePhaseUnlocked("PLANNING"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = planningMemoSchema.parse(req.body);
    
    const memo = await prisma.planningMemo.upsert({
      where: { engagementId: req.params.engagementId },
      create: {
        engagementId: req.params.engagementId,
        preparedById: req.user!.id,
        ...data,
      },
      update: data,
      include: {
        preparedBy: { select: { id: true, fullName: true, role: true } },
        managerReviewedBy: { select: { id: true, fullName: true, role: true } },
        partnerApprovedBy: { select: { id: true, fullName: true, role: true } },
      },
    });

    logAuditTrail(
      req.user!.id,
      "PLANNING_MEMO_UPDATED",
      "planning_memo",
      memo.id,
      null,
      memo,
      req.params.engagementId,
      "Planning memo updated",
      req.ip,
      req.get("user-agent")
    ).catch(err => console.error("Audit trail error:", err));

    res.json(memo);
  } catch (error: any) {
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to save planning memo", details: error.message });
  }
});

router.post("/:engagementId/planning-memo/manager-review", requireAuth, requireMinRole("MANAGER"), requirePhaseUnlocked("PLANNING"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const memo = await prisma.planningMemo.update({
      where: { engagementId: req.params.engagementId },
      data: {
        managerReviewedById: req.user!.id,
        managerReviewedDate: new Date(),
      },
      include: {
        preparedBy: { select: { id: true, fullName: true, role: true } },
        managerReviewedBy: { select: { id: true, fullName: true, role: true } },
        partnerApprovedBy: { select: { id: true, fullName: true, role: true } },
      },
    });

    logAuditTrail(
      req.user!.id,
      "PLANNING_MEMO_REVIEWED",
      "planning_memo",
      memo.id,
      null,
      memo,
      req.params.engagementId,
      "Planning memo reviewed by manager",
      req.ip,
      req.get("user-agent")
    ).catch(err => console.error("Audit trail error:", err));

    res.json(memo);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to review planning memo", details: error.message });
  }
});

router.post("/:engagementId/planning-memo/partner-approve", requireAuth, requireMinRole("PARTNER"), requirePhaseUnlocked("PLANNING"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const memo = await prisma.planningMemo.update({
      where: { engagementId: req.params.engagementId },
      data: {
        partnerApprovedById: req.user!.id,
        partnerApprovalDate: new Date(),
      },
      include: {
        preparedBy: { select: { id: true, fullName: true, role: true } },
        managerReviewedBy: { select: { id: true, fullName: true, role: true } },
        partnerApprovedBy: { select: { id: true, fullName: true, role: true } },
      },
    });

    logAuditTrail(
      req.user!.id,
      "PLANNING_MEMO_APPROVED",
      "planning_memo",
      memo.id,
      null,
      memo,
      req.params.engagementId,
      "Planning memo approved by partner",
      req.ip,
      req.get("user-agent")
    ).catch(err => console.error("Audit trail error:", err));

    res.json(memo);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to approve planning memo", details: error.message });
  }
});

router.get("/:engagementId/planning-summary", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [materiality, risks, goingConcern, memo] = await Promise.all([
      prisma.materialityAssessment.findFirst({
        where: { engagementId: req.params.engagementId },
        orderBy: { createdAt: "desc" },
        include: { approvedBy: { select: { id: true, fullName: true } } },
      }),
      prisma.riskAssessment.findMany({
        where: { engagementId: req.params.engagementId },
      }),
      prisma.goingConcernAssessment.findUnique({
        where: { engagementId: req.params.engagementId },
      }),
      prisma.planningMemo.findUnique({
        where: { engagementId: req.params.engagementId },
      }),
    ]);

    const significantRisks = risks.filter(r => r.isSignificantRisk);
    const highRisks = risks.filter(r => r.riskOfMaterialMisstatement === "HIGH" || r.riskOfMaterialMisstatement === "SIGNIFICANT");

    const planningComplete = 
      !!materiality?.approvedById &&
      risks.length > 0 &&
      !!goingConcern?.partnerApprovedById &&
      !!memo?.partnerApprovedById;

    res.json({
      materiality: materiality ? {
        overallMateriality: materiality.overallMateriality,
        performanceMateriality: materiality.performanceMateriality,
        amptThreshold: materiality.amptThreshold,
        benchmark: materiality.benchmark,
        isApproved: !!materiality.approvedById,
      } : null,
      riskSummary: {
        total: risks.length,
        significantRisks: significantRisks.length,
        highRisks: highRisks.length,
        byAssertion: risks.reduce((acc: Record<string, number>, r) => {
          acc[r.assertion] = (acc[r.assertion] || 0) + 1;
          return acc;
        }, {}),
      },
      goingConcern: goingConcern ? {
        altmanZScore: goingConcern.altmanZScore,
        altmanZScoreResult: goingConcern.altmanZScoreResult,
        materialUncertaintyExists: goingConcern.materialUncertaintyExists,
        isApproved: !!goingConcern.partnerApprovedById,
      } : null,
      planningMemo: memo ? {
        isManagerReviewed: !!memo.managerReviewedById,
        isPartnerApproved: !!memo.partnerApprovedById,
        teamBriefingDone: memo.teamBriefingDone,
      } : null,
      planningComplete,
      isaReferences: ["ISA 300", "ISA 315 (Revised 2019)", "ISA 320", "ISA 570"],
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch planning summary", details: error.message });
  }
});

router.get("/:engagementId/risk-stats", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const engagementId = req.params.engagementId;
    const risks = await prisma.riskAssessment.findMany({
      where: { engagementId },
      select: {
        fsArea: true,
        assertionImpacts: true,
        isSignificantRisk: true,
        isFraudRisk: true,
        plannedResponse: true,
        riskOfMaterialMisstatement: true,
      },
    });

    const total = risks.length;
    const withFsArea = risks.filter(r => r.fsArea).length;
    const withAssertions = risks.filter(r => r.assertionImpacts && r.assertionImpacts.length > 0).length;
    const significant = risks.filter(r => r.isSignificantRisk).length;
    const fraud = risks.filter(r => r.isFraudRisk).length;
    const withResponse = risks.filter(r => r.plannedResponse).length;

    const fsAreas = FS_AREAS;
    const coveredAreas = new Set(risks.filter(r => r.fsArea).map(r => r.fsArea));
    const coveragePercent = Math.round((coveredAreas.size / fsAreas.length) * 100);
    const unmappedAreas = fsAreas.length - coveredAreas.size;

    const highRiskLevels = ["HIGH", "SIGNIFICANT"];
    const pendingHighRisk = risks.filter(r =>
      highRiskLevels.includes(r.riskOfMaterialMisstatement) && !r.plannedResponse
    ).length;

    res.json({ total, withFsArea, withAssertions, significant, fraud, withResponse, coveragePercent, unmappedAreas, pendingHighRisk });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch risk stats", details: error.message });
  }
});

router.get("/:engagementId/strategy-stats", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const engagementId = req.params.engagementId;
    const [strategy, teamCount, memo, riskCount] = await Promise.all([
      prisma.auditStrategy.findFirst({ where: { engagementId }, select: { overallStrategy: true, auditApproach: true, substantiveApproach: true, controlsReliance: true } }),
      prisma.engagementTeam.count({ where: { engagementId } }),
      prisma.planningMemo.findFirst({ where: { engagementId }, select: { id: true } }),
      prisma.riskAssessment.count({ where: { engagementId } }),
    ]);

    res.json({
      hasStrategy: !!(strategy?.overallStrategy || strategy?.auditApproach),
      hasScope: !!(strategy?.substantiveApproach || strategy?.controlsReliance),
      teamCount,
      hasMemo: !!memo,
      riskAssessmentExists: riskCount > 0,
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch strategy stats", details: error.message });
  }
});

router.get("/:engagementId/procedures-stats", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const engagementId = req.params.engagementId;
    const [
      allProcedures,
      risks,
      samplingFrameCount,
      materialityCalc,
    ] = await Promise.all([
      prisma.engagementProcedure.findMany({
        where: { engagementId },
        select: {
          id: true,
          title: true,
          category: true,
          procedureType: true,
          status: true,
          assertions: true,
          linkedRiskIds: true,
          linkedAccountIds: true,
          sampleSize: true,
          samplingMethod: true,
          populationSize: true,
          reviewedById: true,
          performedById: true,
          workpaperRef: true,
        },
      }),
      prisma.riskAssessment.findMany({
        where: { engagementId },
        select: {
          id: true,
          fsArea: true,
          riskOfMaterialMisstatement: true,
          isSignificantRisk: true,
          isFraudRisk: true,
          assertion: true,
          assertionImpacts: true,
        },
      }),
      prisma.samplingFrame.count({ where: { engagementId } }),
      prisma.materialityCalculation.findFirst({
        where: { engagementId },
        select: { overallMateriality: true, performanceMateriality: true },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const totalProcedures = allProcedures.length;
    const linkedToRisks = allProcedures.filter(p => p.linkedRiskIds.length > 0).length;
    const withAssertions = allProcedures.filter(p => p.assertions.length > 0).length;
    const withSampling = allProcedures.filter(p => p.sampleSize && p.sampleSize > 0).length;
    const withPopulation = allProcedures.filter(p => p.populationSize && p.populationSize > 0 && p.samplingMethod).length;
    const reviewed = allProcedures.filter(p => p.reviewedById).length;
    const completed = allProcedures.filter(p => p.status === "COMPLETED").length;
    const inProgress = allProcedures.filter(p => p.status === "IN_PROGRESS").length;

    const highRisks = risks.filter(r =>
      r.riskOfMaterialMisstatement === "HIGH" ||
      r.riskOfMaterialMisstatement === "SIGNIFICANT" ||
      r.isSignificantRisk
    );
    const highRiskIds = new Set(highRisks.map(r => r.id));
    const coveredHighRiskIds = new Set<string>();
    for (const proc of allProcedures) {
      for (const riskId of proc.linkedRiskIds) {
        if (highRiskIds.has(riskId)) coveredHighRiskIds.add(riskId);
      }
    }

    const byCategory: Record<string, number> = {};
    const byType: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    for (const p of allProcedures) {
      byCategory[p.category] = (byCategory[p.category] || 0) + 1;
      byType[p.procedureType] = (byType[p.procedureType] || 0) + 1;
      byStatus[p.status] = (byStatus[p.status] || 0) + 1;
    }

    const assertionCoverage: Record<string, number> = {};
    for (const p of allProcedures) {
      for (const a of p.assertions) {
        assertionCoverage[a] = (assertionCoverage[a] || 0) + 1;
      }
    }

    const fsAreaCoverage: Record<string, { procedures: number; risks: number; highRisks: number; covered: boolean }> = {};
    for (const risk of risks) {
      const area = risk.fsArea || "UNCLASSIFIED";
      if (!fsAreaCoverage[area]) fsAreaCoverage[area] = { procedures: 0, risks: 0, highRisks: 0, covered: false };
      fsAreaCoverage[area].risks++;
      if (highRiskIds.has(risk.id)) fsAreaCoverage[area].highRisks++;
    }
    for (const proc of allProcedures) {
      for (const riskId of proc.linkedRiskIds) {
        const risk = risks.find(r => r.id === riskId);
        if (risk?.fsArea && fsAreaCoverage[risk.fsArea]) {
          fsAreaCoverage[risk.fsArea].procedures++;
          fsAreaCoverage[risk.fsArea].covered = true;
        }
      }
    }

    res.json({
      totalProcedures,
      linkedToRisks,
      withAssertions,
      withSampling,
      withPopulation,
      reviewed,
      completed,
      inProgress,
      notStarted: totalProcedures - completed - inProgress,
      totalRisks: risks.length,
      highRiskCount: highRisks.length,
      highRiskCovered: coveredHighRiskIds.size,
      samplingFrameCount,
      overallMateriality: materialityCalc?.overallMateriality ? Number(materialityCalc.overallMateriality) : null,
      performanceMateriality: materialityCalc?.performanceMateriality ? Number(materialityCalc.performanceMateriality) : null,
      byCategory,
      byType,
      byStatus,
      assertionCoverage,
      fsAreaCoverage,
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch procedures stats", details: error.message });
  }
});

router.get("/:engagementId/risks/fs-level", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const risks = await prisma.riskAssessment.findMany({
      where: { engagementId: req.params.engagementId },
      include: {
        assessedBy: { select: { id: true, fullName: true, role: true } },
        partnerApprovedBy: { select: { id: true, fullName: true, role: true } },
      },
      orderBy: [{ fsArea: "asc" }, { riskOfMaterialMisstatement: "desc" }],
    });

    const groupedByFsArea: Record<string, any[]> = {};
    const fsAreaSummary: Record<string, { total: number; significant: number; fraud: number; lawsReg: number; maxRomm: string }> = {};

    for (const risk of risks) {
      const area = risk.fsArea || "UNCLASSIFIED";
      if (!groupedByFsArea[area]) {
        groupedByFsArea[area] = [];
        fsAreaSummary[area] = { total: 0, significant: 0, fraud: 0, lawsReg: 0, maxRomm: "LOW" };
      }
      groupedByFsArea[area].push(risk);
      fsAreaSummary[area].total++;
      if (risk.isSignificantRisk) fsAreaSummary[area].significant++;
      if (risk.isFraudRisk) fsAreaSummary[area].fraud++;
      if (risk.isLawsRegulationsRisk) fsAreaSummary[area].lawsReg++;
      
      const rommOrder = ["LOW", "MODERATE", "HIGH", "SIGNIFICANT"];
      if (rommOrder.indexOf(risk.riskOfMaterialMisstatement) > rommOrder.indexOf(fsAreaSummary[area].maxRomm)) {
        fsAreaSummary[area].maxRomm = risk.riskOfMaterialMisstatement;
      }
    }

    res.json({
      risks: groupedByFsArea,
      summary: fsAreaSummary,
      totalRisks: risks.length,
      fsAreas: Object.keys(groupedByFsArea),
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch FS-level risk view", details: error.message });
  }
});

router.get("/:engagementId/risks/assertion-level", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const risks = await prisma.riskAssessment.findMany({
      where: { engagementId: req.params.engagementId },
      include: {
        assessedBy: { select: { id: true, fullName: true, role: true } },
        partnerApprovedBy: { select: { id: true, fullName: true, role: true } },
      },
      orderBy: [{ assertion: "asc" }, { riskOfMaterialMisstatement: "desc" }],
    });

    const groupedByAssertion: Record<string, any[]> = {};
    const assertionSummary: Record<string, { total: number; significant: number; fraud: number; lawsReg: number; maxRomm: string }> = {};

    for (const risk of risks) {
      const assertion = risk.assertion;
      if (!groupedByAssertion[assertion]) {
        groupedByAssertion[assertion] = [];
        assertionSummary[assertion] = { total: 0, significant: 0, fraud: 0, lawsReg: 0, maxRomm: "LOW" };
      }
      groupedByAssertion[assertion].push(risk);
      assertionSummary[assertion].total++;
      if (risk.isSignificantRisk) assertionSummary[assertion].significant++;
      if (risk.isFraudRisk) assertionSummary[assertion].fraud++;
      if (risk.isLawsRegulationsRisk) assertionSummary[assertion].lawsReg++;
      
      const rommOrder = ["LOW", "MODERATE", "HIGH", "SIGNIFICANT"];
      if (rommOrder.indexOf(risk.riskOfMaterialMisstatement) > rommOrder.indexOf(assertionSummary[assertion].maxRomm)) {
        assertionSummary[assertion].maxRomm = risk.riskOfMaterialMisstatement;
      }
    }

    res.json({
      risks: groupedByAssertion,
      summary: assertionSummary,
      totalRisks: risks.length,
      assertions: Object.keys(groupedByAssertion),
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch assertion-level risk view", details: error.message });
  }
});

router.get("/:engagementId/risks/fs-matrix", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const risks = await prisma.riskAssessment.findMany({
      where: { engagementId: req.params.engagementId },
    });

    const matrix: Record<string, Record<string, { romm: string; isSignificant: boolean; isFraud: boolean; count: number }>> = {};
    
    const allFsAreas = FS_AREAS as readonly string[];
    const allAssertions = ASSERTIONS as readonly string[];

    for (const area of allFsAreas) {
      matrix[area] = {};
      for (const assertion of allAssertions) {
        matrix[area][assertion] = { romm: "", isSignificant: false, isFraud: false, count: 0 };
      }
    }

    for (const risk of risks) {
      const area = risk.fsArea || "UNCLASSIFIED";
      if (!matrix[area]) {
        matrix[area] = {};
        for (const assertion of allAssertions) {
          matrix[area][assertion] = { romm: "", isSignificant: false, isFraud: false, count: 0 };
        }
      }
      
      const assertion = risk.assertion;
      const cell = matrix[area][assertion];
      cell.count++;
      
      const rommOrder = ["LOW", "MODERATE", "HIGH", "SIGNIFICANT"];
      if (!cell.romm || rommOrder.indexOf(risk.riskOfMaterialMisstatement) > rommOrder.indexOf(cell.romm)) {
        cell.romm = risk.riskOfMaterialMisstatement;
      }
      if (risk.isSignificantRisk) cell.isSignificant = true;
      if (risk.isFraudRisk) cell.isFraud = true;
    }

    res.json({
      matrix,
      fsAreas: [...allFsAreas, "UNCLASSIFIED"],
      assertions: allAssertions,
      legend: {
        romm: { LOW: "L", MODERATE: "M", HIGH: "H", SIGNIFICANT: "S" },
        flags: { isSignificant: "*", isFraud: "F" },
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to generate FS risk matrix", details: error.message });
  }
});

router.get("/:engagementId/risks/assertion-matrix", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const risks = await prisma.riskAssessment.findMany({
      where: { engagementId: req.params.engagementId },
    });

    const allAssertions = ASSERTIONS as readonly string[];
    const allAccounts = [...new Set(risks.map(r => r.accountOrClass))].sort();

    const matrix: Record<string, Record<string, { romm: string; isSignificant: boolean; isFraud: boolean; count: number }>> = {};

    for (const account of allAccounts) {
      matrix[account] = {};
      for (const assertion of allAssertions) {
        matrix[account][assertion] = { romm: "", isSignificant: false, isFraud: false, count: 0 };
      }
    }

    for (const risk of risks) {
      const account = risk.accountOrClass;
      const assertion = risk.assertion;
      const cell = matrix[account][assertion];
      cell.count++;
      
      const rommOrder = ["LOW", "MODERATE", "HIGH", "SIGNIFICANT"];
      if (!cell.romm || rommOrder.indexOf(risk.riskOfMaterialMisstatement) > rommOrder.indexOf(cell.romm)) {
        cell.romm = risk.riskOfMaterialMisstatement;
      }
      if (risk.isSignificantRisk) cell.isSignificant = true;
      if (risk.isFraudRisk) cell.isFraud = true;
    }

    res.json({
      matrix,
      accounts: allAccounts,
      assertions: allAssertions,
      legend: {
        romm: { LOW: "L", MODERATE: "M", HIGH: "H", SIGNIFICANT: "S" },
        flags: { isSignificant: "*", isFraud: "F" },
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to generate assertion risk matrix", details: error.message });
  }
});

router.get("/:engagementId/risks/planned-responses", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const risks = await prisma.riskAssessment.findMany({
      where: { 
        engagementId: req.params.engagementId,
        OR: [
          { isSignificantRisk: true },
          { riskOfMaterialMisstatement: { in: ["HIGH", "SIGNIFICANT"] } },
          { isFraudRisk: true },
          { isLawsRegulationsRisk: true },
        ],
      },
      orderBy: [
        { isSignificantRisk: "desc" },
        { isFraudRisk: "desc" },
        { riskOfMaterialMisstatement: "desc" },
      ],
    });

    const responses = risks.map(risk => ({
      riskId: risk.id,
      accountOrClass: risk.accountOrClass,
      assertion: risk.assertion,
      fsArea: risk.fsArea,
      romm: risk.riskOfMaterialMisstatement,
      flags: {
        significant: risk.isSignificantRisk,
        fraud: risk.isFraudRisk,
        lawsReg: risk.isLawsRegulationsRisk,
      },
      plannedResponse: risk.plannedResponse,
      nature: risk.natureOfProcedures,
      timing: risk.timingOfProcedures,
      extent: risk.extentOfProcedures,
      fraudResponse: risk.fraudResponse,
      auditProcedureIds: risk.auditProcedureIds,
      isaReference: risk.isaReference,
    }));

    res.json({
      responses,
      totalHighRiskAreas: risks.length,
      fraudRisks: risks.filter(r => r.isFraudRisk).length,
      significantRisks: risks.filter(r => r.isSignificantRisk).length,
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch planned responses", details: error.message });
  }
});

const overrideRequestSchema = z.object({
  requestReason: z.string().min(10),
  proposedChanges: z.record(z.any()),
});

router.post("/:engagementId/risks/:riskId/override-request", requireAuth, requirePhaseUnlocked("PLANNING"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const risk = await prisma.riskAssessment.findUnique({
      where: { id: req.params.riskId },
    });

    if (!risk) {
      return res.status(404).json({ error: "Risk assessment not found" });
    }

    const engagement = await prisma.engagement.findUnique({
      where: { id: req.params.engagementId },
      select: { currentPhase: true },
    });

    if (!engagement || !["EXECUTION", "FINALIZATION", "REPORTING", "EQCR", "INSPECTION"].includes(engagement.currentPhase)) {
      return res.status(400).json({ 
        error: "Override not required", 
        message: "Risk register is not locked. Direct edits are permitted." 
      });
    }

    const data = overrideRequestSchema.parse(req.body);

    const override = await prisma.riskOverrideRequest.create({
      data: {
        riskAssessmentId: risk.id,
        engagementId: req.params.engagementId,
        requestReason: data.requestReason,
        proposedChanges: data.proposedChanges,
        requestedById: req.user!.id,
      },
      include: {
        requestedBy: { select: { id: true, fullName: true, role: true } },
        riskAssessment: { select: { id: true, accountOrClass: true, assertion: true } },
      },
    });

    logAuditTrail(
      req.user!.id,
      "RISK_OVERRIDE_REQUESTED",
      "risk_override_request",
      override.id,
      null,
      override,
      req.params.engagementId,
      `Override requested for risk: ${risk.accountOrClass}`,
      req.ip,
      req.get("user-agent")
    ).catch(err => console.error("Audit trail error:", err));

    res.status(201).json(override);
  } catch (error: any) {
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to create override request", details: error.message });
  }
});

router.get("/:engagementId/override-requests", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const overrides = await prisma.riskOverrideRequest.findMany({
      where: { engagementId: req.params.engagementId },
      include: {
        requestedBy: { select: { id: true, fullName: true, role: true } },
        partnerApprovedBy: { select: { id: true, fullName: true, role: true } },
        eqcrApprovedBy: { select: { id: true, fullName: true, role: true } },
        rejectedBy: { select: { id: true, fullName: true, role: true } },
        riskAssessment: { select: { id: true, accountOrClass: true, assertion: true, fsArea: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(overrides);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch override requests", details: error.message });
  }
});

router.post("/:engagementId/override-requests/:overrideId/partner-approve", requireAuth, requireMinRole("PARTNER"), requirePhaseUnlocked("PLANNING"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const override = await prisma.riskOverrideRequest.findUnique({
      where: { id: req.params.overrideId },
    });

    if (!override) {
      return res.status(404).json({ error: "Override request not found" });
    }

    if (override.status !== "PENDING") {
      return res.status(400).json({ error: "Override request is not pending" });
    }

    const updated = await prisma.riskOverrideRequest.update({
      where: { id: req.params.overrideId },
      data: {
        partnerApprovedById: req.user!.id,
        partnerApprovalDate: new Date(),
        partnerComments: req.body.comments,
        status: "PARTNER_APPROVED",
      },
      include: {
        requestedBy: { select: { id: true, fullName: true, role: true } },
        partnerApprovedBy: { select: { id: true, fullName: true, role: true } },
        riskAssessment: { select: { id: true, accountOrClass: true, assertion: true } },
      },
    });

    logAuditTrail(
      req.user!.id,
      "RISK_OVERRIDE_PARTNER_APPROVED",
      "risk_override_request",
      updated.id,
      override,
      updated,
      req.params.engagementId,
      "Partner approved risk override request",
      req.ip,
      req.get("user-agent")
    ).catch(err => console.error("Audit trail error:", err));

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to approve override request", details: error.message });
  }
});

router.post("/:engagementId/override-requests/:overrideId/eqcr-approve", requireAuth, requireMinRole("EQCR"), requirePhaseUnlocked("PLANNING"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const override = await prisma.riskOverrideRequest.findUnique({
      where: { id: req.params.overrideId },
      include: { riskAssessment: true },
    });

    if (!override) {
      return res.status(404).json({ error: "Override request not found" });
    }

    if (override.status !== "PARTNER_APPROVED") {
      return res.status(400).json({ error: "Override request requires Partner approval first" });
    }

    const updated = await prisma.riskOverrideRequest.update({
      where: { id: req.params.overrideId },
      data: {
        eqcrApprovedById: req.user!.id,
        eqcrApprovalDate: new Date(),
        eqcrComments: req.body.comments,
        status: "EQCR_APPROVED",
      },
    });

    const proposedChanges = override.proposedChanges as Record<string, any>;
    const allowedOverrideFields = [
      "riskDescription", "accountOrClass", "fsArea", "auditCycle", "assertionImpacts",
      "assertion", "inherentRisk", "controlRisk", "isSignificantRisk", "significantRiskReason",
      "isFraudRisk", "fraudRiskType", "fraudRiskIndicators", "fraudResponse",
      "isLawsRegulationsRisk", "applicableLaws", "complianceConsiderations",
      "inherentRiskFactors", "controlRiskFactors", "plannedResponse",
      "natureOfProcedures", "timingOfProcedures", "extentOfProcedures"
    ];

    const safeChanges: Record<string, any> = {};
    for (const field of allowedOverrideFields) {
      if (proposedChanges[field] !== undefined) {
        safeChanges[field] = proposedChanges[field];
      }
    }

    if (safeChanges.inherentRisk || safeChanges.controlRisk) {
      const inherent = safeChanges.inherentRisk || override.riskAssessment.inherentRisk;
      const control = safeChanges.controlRisk || override.riskAssessment.controlRisk;
      safeChanges.riskOfMaterialMisstatement = calculateROMM(inherent, control);
    }

    const updatedRisk = await prisma.riskAssessment.update({
      where: { id: override.riskAssessmentId },
      data: safeChanges,
    });

    logAuditTrail(
      req.user!.id,
      "RISK_OVERRIDE_EQCR_APPROVED",
      "risk_override_request",
      updated.id,
      override,
      { override: updated, riskChanges: safeChanges },
      req.params.engagementId,
      `EQCR approved risk override - changes applied to risk: ${override.riskAssessment.accountOrClass}`,
      req.ip,
      req.get("user-agent")
    ).catch(err => console.error("Audit trail error:", err));

    res.json({ override: updated, updatedRisk });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to approve override request", details: error.message });
  }
});

router.post("/:engagementId/override-requests/:overrideId/reject", requireAuth, requireMinRole("PARTNER"), requirePhaseUnlocked("PLANNING"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const override = await prisma.riskOverrideRequest.findUnique({
      where: { id: req.params.overrideId },
    });

    if (!override) {
      return res.status(404).json({ error: "Override request not found" });
    }

    if (override.status === "EQCR_APPROVED" || override.status === "REJECTED") {
      return res.status(400).json({ error: "Cannot reject this override request" });
    }

    const updated = await prisma.riskOverrideRequest.update({
      where: { id: req.params.overrideId },
      data: {
        rejectedById: req.user!.id,
        rejectedAt: new Date(),
        rejectionReason: req.body.reason,
        status: "REJECTED",
      },
      include: {
        requestedBy: { select: { id: true, fullName: true, role: true } },
        rejectedBy: { select: { id: true, fullName: true, role: true } },
        riskAssessment: { select: { id: true, accountOrClass: true, assertion: true } },
      },
    });

    logAuditTrail(
      req.user!.id,
      "RISK_OVERRIDE_REJECTED",
      "risk_override_request",
      updated.id,
      override,
      updated,
      req.params.engagementId,
      `Override request rejected: ${req.body.reason}`,
      req.ip,
      req.get("user-agent")
    ).catch(err => console.error("Audit trail error:", err));

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to reject override request", details: error.message });
  }
});

router.get("/:engagementId/risks/fraud-risks", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const risks = await prisma.riskAssessment.findMany({
      where: { 
        engagementId: req.params.engagementId,
        isFraudRisk: true,
      },
      include: {
        assessedBy: { select: { id: true, fullName: true, role: true } },
        partnerApprovedBy: { select: { id: true, fullName: true, role: true } },
      },
      orderBy: { fraudRiskType: "asc" },
    });

    const byType = risks.reduce((acc: Record<string, any[]>, risk) => {
      const type = risk.fraudRiskType || "OTHER";
      if (!acc[type]) acc[type] = [];
      acc[type].push(risk);
      return acc;
    }, {});

    res.json({
      risks,
      byType,
      total: risks.length,
      isaReference: "ISA 240 - The Auditor's Responsibilities Relating to Fraud",
      presumedFraudRisks: ["REVENUE_RECOGNITION", "MANAGEMENT_OVERRIDE"],
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch fraud risks", details: error.message });
  }
});

router.get("/:engagementId/risks/laws-regulations", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const risks = await prisma.riskAssessment.findMany({
      where: { 
        engagementId: req.params.engagementId,
        isLawsRegulationsRisk: true,
      },
      include: {
        assessedBy: { select: { id: true, fullName: true, role: true } },
        partnerApprovedBy: { select: { id: true, fullName: true, role: true } },
      },
    });

    const allLaws = risks.flatMap(r => r.applicableLaws);
    const uniqueLaws = [...new Set(allLaws)];

    res.json({
      risks,
      applicableLaws: uniqueLaws,
      total: risks.length,
      isaReference: "ISA 250 - Consideration of Laws and Regulations",
      commonLaws: [
        "Companies Act 2017",
        "Income Tax Ordinance 2001",
        "Sales Tax Act 1990",
        "SECP Regulations",
        "Pakistan Stock Exchange Rules",
        "Anti-Money Laundering Act 2010",
        "Foreign Exchange Regulation Act 1947",
      ],
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch L&R risks", details: error.message });
  }
});

// ============================================
// ENTITY UNDERSTANDING (ISA 315)
// ============================================

const entityUnderstandingSchema = z.object({
  entityName: z.string().optional(),
  legalStructure: z.string().optional(),
  ownershipStructure: z.string().optional(),
  managementStructure: z.string().optional(),
  governanceStructure: z.string().optional(),
  natureOfBusiness: z.string().optional(),
  principalActivities: z.string().optional(),
  revenueStreams: z.array(z.string()).optional(),
  keyProducts: z.array(z.string()).optional(),
  keyMarkets: z.string().optional(),
  competitivePosition: z.string().optional(),
  regulatoryEnvironment: z.string().optional(),
  applicableLaws: z.array(z.string()).optional(),
  industryRegulations: z.array(z.string()).optional(),
  licensingRequirements: z.string().optional(),
  accountingPolicies: z.any().optional(),
  significantEstimates: z.array(z.string()).optional(),
  relatedPartyPolicies: z.string().optional(),
  itEnvironment: z.string().optional(),
  keyITSystems: z.array(z.string()).optional(),
  itGeneralControls: z.string().optional(),
  itApplicationControls: z.string().optional(),
  keyPerformanceIndicators: z.any().optional(),
  financialRatios: z.any().optional(),
  strategicObjectives: z.string().optional(),
  businessRisks: z.array(z.string()).optional(),
});

router.get("/:engagementId/entity-understanding", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    let understanding = await prisma.entityUnderstanding.findUnique({
      where: { engagementId: req.params.engagementId },
    });

    if (!understanding) {
      const engagement = await prisma.engagement.findUnique({
        where: { id: req.params.engagementId },
        include: { client: true },
      });

      if (!engagement) {
        return res.status(404).json({ error: "Engagement not found" });
      }

      understanding = await prisma.entityUnderstanding.create({
        data: {
          engagementId: req.params.engagementId,
          entityName: engagement.client.name,
          legalStructure: engagement.client.entityType,
          natureOfBusiness: engagement.client.industry,
        },
      });
    }

    res.json(understanding);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch entity understanding", details: error.message });
  }
});

router.patch("/:engagementId/entity-understanding", requireAuth, requirePhaseUnlocked("PLANNING"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = entityUnderstandingSchema.parse(req.body);
    
    const existing = await prisma.entityUnderstanding.findUnique({
      where: { engagementId: req.params.engagementId },
    });

    const understanding = await prisma.entityUnderstanding.upsert({
      where: { engagementId: req.params.engagementId },
      create: {
        engagementId: req.params.engagementId,
        ...data,
        preparedById: req.user!.id,
        preparedDate: new Date(),
      },
      update: {
        ...data,
      },
    });

    logAuditTrail(
      req.user!.id,
      existing ? "ENTITY_UNDERSTANDING_UPDATED" : "ENTITY_UNDERSTANDING_CREATED",
      "entity_understanding",
      understanding.id,
      existing,
      understanding,
      req.params.engagementId,
      "Entity understanding documented per ISA 315",
      req.ip,
      req.get("user-agent")
    ).catch(err => console.error("Audit trail error:", err));

    res.json(understanding);
  } catch (error: any) {
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to update entity understanding", details: error.message });
  }
});

router.post("/:engagementId/entity-understanding/partner-approve", requireAuth, requireMinRole("PARTNER"), requirePhaseUnlocked("PLANNING"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const understanding = await prisma.entityUnderstanding.update({
      where: { engagementId: req.params.engagementId },
      data: {
        partnerApprovedById: req.user!.id,
        partnerApprovalDate: new Date(),
      },
    });

    logAuditTrail(
      req.user!.id,
      "ENTITY_UNDERSTANDING_PARTNER_APPROVED",
      "entity_understanding",
      understanding.id,
      null,
      understanding,
      req.params.engagementId,
      "Partner approved entity understanding",
      req.ip,
      req.get("user-agent")
    ).catch(err => console.error("Audit trail error:", err));

    res.json(understanding);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to approve entity understanding", details: error.message });
  }
});

// ============================================
// RELATED PARTIES (ISA 550)
// ============================================

const relatedPartySchema = z.object({
  partyName: z.string().min(1),
  partyType: z.enum(["PARENT", "SUBSIDIARY", "ASSOCIATE", "JOINT_VENTURE", "KEY_MANAGEMENT", "CLOSE_FAMILY", "DIRECTOR", "SHAREHOLDER", "OTHER"]),
  relationshipType: z.string().min(1),
  natureOfRelationship: z.string().optional(),
  ownershipPercentage: z.number().min(0).max(100).optional(),
  isControlling: z.boolean().default(false),
  isKeyManagement: z.boolean().default(false),
  transactionTypes: z.array(z.string()).optional(),
  transactionValue: z.number().optional(),
  balanceOutstanding: z.number().optional(),
  armLengthAssessment: z.string().optional(),
  disclosureRequired: z.boolean().default(true),
  disclosureAdequate: z.boolean().optional(),
  riskAssessment: z.string().optional(),
  auditProcedures: z.string().optional(),
});

router.get("/:engagementId/related-parties", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parties = await prisma.relatedParty.findMany({
      where: { engagementId: req.params.engagementId },
      orderBy: { createdAt: "desc" },
    });

    const summary = {
      total: parties.length,
      controlling: parties.filter((p: { isControlling: boolean }) => p.isControlling).length,
      keyManagement: parties.filter((p: { isKeyManagement: boolean }) => p.isKeyManagement).length,
      totalTransactionValue: parties.reduce((sum: number, p: { transactionValue: number | null }) => sum + (p.transactionValue || 0), 0),
      totalBalanceOutstanding: parties.reduce((sum: number, p: { balanceOutstanding: number | null }) => sum + (p.balanceOutstanding || 0), 0),
    };

    res.json({ parties, summary, isaReference: "ISA 550 - Related Parties" });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch related parties", details: error.message });
  }
});

router.post("/:engagementId/related-parties", requireAuth, requirePhaseUnlocked("PLANNING"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = relatedPartySchema.parse(req.body);

    const party = await prisma.relatedParty.create({
      data: {
        engagementId: req.params.engagementId,
        ...data,
        identifiedById: req.user!.id,
        identifiedDate: new Date(),
      },
    });

    logAuditTrail(
      req.user!.id,
      "RELATED_PARTY_IDENTIFIED",
      "related_party",
      party.id,
      null,
      party,
      req.params.engagementId,
      "Related party identified: " + data.partyName,
      req.ip,
      req.get("user-agent")
    ).catch(err => console.error("Audit trail error:", err));

    res.status(201).json(party);
  } catch (error: any) {
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to create related party", details: error.message });
  }
});

router.patch("/:engagementId/related-parties/:partyId", requireAuth, requirePhaseUnlocked("PLANNING"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = relatedPartySchema.partial().parse(req.body);
    
    const existing = await prisma.relatedParty.findUnique({
      where: { id: req.params.partyId },
    });

    if (!existing) {
      return res.status(404).json({ error: "Related party not found" });
    }

    const party = await prisma.relatedParty.update({
      where: { id: req.params.partyId },
      data,
    });

    logAuditTrail(
      req.user!.id,
      "RELATED_PARTY_UPDATED",
      "related_party",
      party.id,
      existing,
      party,
      req.params.engagementId,
      "Related party updated: " + party.partyName,
      req.ip,
      req.get("user-agent")
    ).catch(err => console.error("Audit trail error:", err));

    res.json(party);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to update related party", details: error.message });
  }
});

router.delete("/:engagementId/related-parties/:partyId", requireAuth, requireMinRole("MANAGER"), requirePhaseUnlocked("PLANNING"), preventDeletionAfterFinalization, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const existing = await prisma.relatedParty.findUnique({
      where: { id: req.params.partyId },
    });

    if (!existing) {
      return res.status(404).json({ error: "Related party not found" });
    }

    await prisma.relatedParty.delete({
      where: { id: req.params.partyId },
    });

    logAuditTrail(
      req.user!.id,
      "RELATED_PARTY_DELETED",
      "related_party",
      req.params.partyId,
      existing,
      null,
      req.params.engagementId,
      "Related party deleted: " + existing.partyName,
      req.ip,
      req.get("user-agent")
    ).catch(err => console.error("Audit trail error:", err));

    res.json({ message: "Related party deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to delete related party", details: error.message });
  }
});

// ============================================
// INDUSTRY ANALYSIS (ISA 315)
// ============================================

const industryAnalysisSchema = z.object({
  industryCode: z.string().optional(),
  industrySector: z.string().optional(),
  industrySubsector: z.string().optional(),
  marketConditions: z.string().optional(),
  competitiveEnvironment: z.string().optional(),
  regulatoryFactors: z.string().optional(),
  technologicalChanges: z.string().optional(),
  economicFactors: z.string().optional(),
  industryRisks: z.array(z.string()).optional(),
  typicalFraudSchemes: z.array(z.string()).optional(),
  commonMisstatements: z.array(z.string()).optional(),
  industryBenchmarks: z.any().optional(),
  keyRatios: z.any().optional(),
  industryTrends: z.string().optional(),
  seasonalFactors: z.string().optional(),
  cyclicalFactors: z.string().optional(),
  externalSources: z.array(z.string()).optional(),
  riskImplications: z.string().optional(),
  auditImplications: z.string().optional(),
});

const INDUSTRY_BENCHMARKS: Record<string, any> = {
  MANUFACTURING: {
    grossMargin: { min: 20, max: 40, typical: 30 },
    netMargin: { min: 5, max: 15, typical: 8 },
    currentRatio: { min: 1.2, max: 2.5, typical: 1.5 },
    inventoryTurnover: { min: 4, max: 12, typical: 6 },
    receivablesDays: { min: 30, max: 60, typical: 45 },
    typicalRisks: ["INVENTORY_OBSOLESCENCE", "REVENUE_CUTOFF", "FIXED_ASSET_IMPAIRMENT"],
    fraudSchemes: ["INVENTORY_MANIPULATION", "CHANNEL_STUFFING", "FICTITIOUS_REVENUE"],
  },
  RETAIL: {
    grossMargin: { min: 25, max: 50, typical: 35 },
    netMargin: { min: 2, max: 8, typical: 4 },
    currentRatio: { min: 1.0, max: 2.0, typical: 1.3 },
    inventoryTurnover: { min: 6, max: 20, typical: 10 },
    receivablesDays: { min: 0, max: 30, typical: 15 },
    typicalRisks: ["INVENTORY_SHRINKAGE", "CASH_MISAPPROPRIATION", "SEASONAL_CUTOFF"],
    fraudSchemes: ["CASH_SKIMMING", "INVENTORY_THEFT", "VENDOR_KICKBACKS"],
  },
  BANKING: {
    netInterestMargin: { min: 2, max: 5, typical: 3.5 },
    capitalAdequacyRatio: { min: 10, max: 20, typical: 15 },
    nplRatio: { min: 1, max: 10, typical: 5 },
    typicalRisks: ["LOAN_LOSS_PROVISIONS", "FAIR_VALUE_ESTIMATES", "REGULATORY_COMPLIANCE"],
    fraudSchemes: ["LOAN_FRAUD", "EMBEZZLEMENT", "REGULATORY_MANIPULATION"],
  },
  TECHNOLOGY: {
    grossMargin: { min: 50, max: 80, typical: 65 },
    netMargin: { min: 10, max: 30, typical: 18 },
    rndToRevenue: { min: 10, max: 30, typical: 15 },
    typicalRisks: ["REVENUE_RECOGNITION_SOFTWARE", "INTANGIBLE_IMPAIRMENT", "DEFERRED_REVENUE"],
    fraudSchemes: ["PREMATURE_REVENUE_RECOGNITION", "CAPITALIZED_COSTS_ABUSE", "RELATED_PARTY_MANIPULATION"],
  },
  CONSTRUCTION: {
    grossMargin: { min: 10, max: 25, typical: 15 },
    netMargin: { min: 2, max: 8, typical: 4 },
    currentRatio: { min: 1.0, max: 1.8, typical: 1.3 },
    typicalRisks: ["PERCENTAGE_OF_COMPLETION", "CONTRACT_LOSSES", "RETENTIONS_RECOVERABILITY"],
    fraudSchemes: ["OVER_BILLING", "COST_SHIFTING", "BID_RIGGING"],
  },
  REAL_ESTATE: {
    grossMargin: { min: 20, max: 40, typical: 28 },
    netMargin: { min: 10, max: 25, typical: 15 },
    debtToEquity: { min: 0.5, max: 2.0, typical: 1.0 },
    typicalRisks: ["PROPERTY_VALUATION", "IMPAIRMENT", "REVENUE_TIMING"],
    fraudSchemes: ["VALUATION_MANIPULATION", "FICTITIOUS_SALES", "RELATED_PARTY_TRANSACTIONS"],
  },
};

router.get("/:engagementId/industry-analysis", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    let analysis = await prisma.industryAnalysis.findUnique({
      where: { engagementId: req.params.engagementId },
    });

    if (!analysis) {
      const engagement = await prisma.engagement.findUnique({
        where: { id: req.params.engagementId },
        include: { client: true },
      });

      if (!engagement) {
        return res.status(404).json({ error: "Engagement not found" });
      }

      const industry = engagement.client.industry?.toUpperCase() || "OTHER";
      const benchmarks = INDUSTRY_BENCHMARKS[industry] || {};

      analysis = await prisma.industryAnalysis.create({
        data: {
          engagementId: req.params.engagementId,
          industrySector: engagement.client.industry,
          industryBenchmarks: benchmarks,
          industryRisks: benchmarks.typicalRisks || [],
          typicalFraudSchemes: benchmarks.fraudSchemes || [],
        },
      });
    }

    res.json(analysis);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch industry analysis", details: error.message });
  }
});

router.patch("/:engagementId/industry-analysis", requireAuth, requirePhaseUnlocked("PLANNING"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = industryAnalysisSchema.parse(req.body);
    
    const existing = await prisma.industryAnalysis.findUnique({
      where: { engagementId: req.params.engagementId },
    });

    const analysis = await prisma.industryAnalysis.upsert({
      where: { engagementId: req.params.engagementId },
      create: {
        engagementId: req.params.engagementId,
        ...data,
        preparedById: req.user!.id,
        preparedDate: new Date(),
      },
      update: data,
    });

    logAuditTrail(
      req.user!.id,
      existing ? "INDUSTRY_ANALYSIS_UPDATED" : "INDUSTRY_ANALYSIS_CREATED",
      "industry_analysis",
      analysis.id,
      existing,
      analysis,
      req.params.engagementId,
      "Industry analysis documented per ISA 315",
      req.ip,
      req.get("user-agent")
    ).catch(err => console.error("Audit trail error:", err));

    res.json(analysis);
  } catch (error: any) {
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to update industry analysis", details: error.message });
  }
});

router.get("/:engagementId/industry-benchmarks", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const engagement = await prisma.engagement.findUnique({
      where: { id: req.params.engagementId },
      include: { client: true },
    });

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    const industry = engagement.client.industry?.toUpperCase() || "OTHER";
    const benchmarks = INDUSTRY_BENCHMARKS[industry] || {
      message: "No specific benchmarks available for this industry",
      typicalRisks: ["REVENUE_RECOGNITION", "MANAGEMENT_ESTIMATES", "RELATED_PARTIES"],
      fraudSchemes: ["MANAGEMENT_OVERRIDE", "FICTITIOUS_REVENUE", "ASSET_MISAPPROPRIATION"],
    };

    res.json({
      industry: engagement.client.industry,
      benchmarks,
      availableIndustries: Object.keys(INDUSTRY_BENCHMARKS),
      isaReference: "ISA 315 (Revised 2019) - Industry Knowledge",
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch industry benchmarks", details: error.message });
  }
});

// ============================================
// AUDIT STRATEGY (ISA 300, ISA 330)
// ============================================

const auditStrategySchema = z.object({
  overallStrategy: z.string().optional(),
  auditApproach: z.enum(["SUBSTANTIVE", "COMBINED", "CONTROLS_RELIANCE"]).optional(),
  controlsReliance: z.enum(["NO_RELIANCE", "LIMITED_RELIANCE", "FULL_RELIANCE"]).optional(),
  controlsRelianceRationale: z.string().optional(),
  planToTestControls: z.boolean().default(false),
  controlsTestingScope: z.any().optional(),
  substantiveApproach: z.string().optional(),
  substantiveProcedures: z.any().optional(),
  significantRisksStrategy: z.any().optional(),
  fraudRisksStrategy: z.any().optional(),
  timingOfProcedures: z.enum(["PRIMARILY_INTERIM", "BALANCED", "PRIMARILY_YEAR_END"]).optional(),
  interimTestingPlanned: z.boolean().default(false),
  interimTestingScope: z.string().optional(),
  periodEndTestingScope: z.string().optional(),
  teamComposition: z.any().optional(),
  budgetedHours: z.any().optional(),
  keyMilestones: z.any().optional(),
  expertiseRequired: z.any().optional(),
  specialistInvolvement: z.any().optional(),
  serviceOrganizations: z.any().optional(),
  componentAuditors: z.any().optional(),
  technologyTools: z.any().optional(),
  dataAnalyticsPlanned: z.boolean().default(false),
  dataAnalyticsScope: z.string().optional(),
  materialityConsiderations: z.string().optional(),
  samplingApproach: z.string().optional(),
  communicationPlan: z.string().optional(),
});

router.get("/:engagementId/audit-strategy", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    let strategy = await prisma.auditStrategy.findUnique({
      where: { engagementId: req.params.engagementId },
    });

    if (!strategy) {
      const engagement = await prisma.engagement.findUnique({
        where: { id: req.params.engagementId },
        include: { riskAssessments: true, materialityAssessments: true },
      });

      if (!engagement) {
        return res.status(404).json({ error: "Engagement not found" });
      }

      const significantRisks = engagement.riskAssessments.filter((r: { isSignificantRisk: boolean }) => r.isSignificantRisk);
      const fraudRisks = engagement.riskAssessments.filter((r: { isFraudRisk: boolean }) => r.isFraudRisk);

      strategy = await prisma.auditStrategy.create({
        data: {
          engagementId: req.params.engagementId,
          auditApproach: significantRisks.length > 3 ? "SUBSTANTIVE" : "COMBINED",
          controlsReliance: "LIMITED_RELIANCE",
          significantRisksStrategy: significantRisks.map((r: { accountOrClass: string; assertion: string; plannedResponse: string | null }) => ({
            risk: r.accountOrClass,
            assertion: r.assertion,
            response: r.plannedResponse,
          })),
          fraudRisksStrategy: fraudRisks.map((r: { accountOrClass: string; fraudRiskType: string | null; fraudResponse: string | null }) => ({
            risk: r.accountOrClass,
            type: r.fraudRiskType,
            response: r.fraudResponse,
          })),
        },
      });
    }

    res.json(strategy);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch audit strategy", details: error.message });
  }
});

router.patch("/:engagementId/audit-strategy", requireAuth, requirePhaseUnlocked("PLANNING"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = auditStrategySchema.parse(req.body);
    
    const existing = await prisma.auditStrategy.findUnique({
      where: { engagementId: req.params.engagementId },
    });

    const strategy = await prisma.auditStrategy.upsert({
      where: { engagementId: req.params.engagementId },
      create: {
        engagementId: req.params.engagementId,
        ...data,
        preparedById: req.user!.id,
        preparedDate: new Date(),
      },
      update: data,
    });

    logAuditTrail(
      req.user!.id,
      existing ? "AUDIT_STRATEGY_UPDATED" : "AUDIT_STRATEGY_CREATED",
      "audit_strategy",
      strategy.id,
      existing,
      strategy,
      req.params.engagementId,
      "Audit strategy documented per ISA 300/330",
      req.ip,
      req.get("user-agent")
    ).catch(err => console.error("Audit trail error:", err));

    res.json(strategy);
  } catch (error: any) {
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to update audit strategy", details: error.message });
  }
});

router.post("/:engagementId/audit-strategy/partner-approve", requireAuth, requireMinRole("PARTNER"), requirePhaseUnlocked("PLANNING"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const strategy = await prisma.auditStrategy.update({
      where: { engagementId: req.params.engagementId },
      data: {
        partnerApprovedById: req.user!.id,
        partnerApprovalDate: new Date(),
      },
    });

    logAuditTrail(
      req.user!.id,
      "AUDIT_STRATEGY_PARTNER_APPROVED",
      "audit_strategy",
      strategy.id,
      null,
      strategy,
      req.params.engagementId,
      "Partner approved audit strategy",
      req.ip,
      req.get("user-agent")
    ).catch(err => console.error("Audit trail error:", err));

    res.json(strategy);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to approve audit strategy", details: error.message });
  }
});

// ============================================
// INTERNAL CONTROL ASSESSMENT (ISA 315)
// ============================================

const internalControlAssessmentSchema = z.object({
  controlEnvironment: z.string().optional(),
  controlEnvironmentRating: z.enum(["STRONG", "ADEQUATE", "WEAK"]).optional(),
  entityRiskAssessment: z.string().optional(),
  entityRiskAssessmentRating: z.enum(["STRONG", "ADEQUATE", "WEAK"]).optional(),
  informationSystems: z.string().optional(),
  informationSystemsRating: z.enum(["STRONG", "ADEQUATE", "WEAK"]).optional(),
  controlActivities: z.string().optional(),
  controlActivitiesRating: z.enum(["STRONG", "ADEQUATE", "WEAK"]).optional(),
  monitoringActivities: z.string().optional(),
  monitoringActivitiesRating: z.enum(["STRONG", "ADEQUATE", "WEAK"]).optional(),
  overallAssessment: z.string().optional(),
  overallRating: z.enum(["STRONG", "ADEQUATE", "WEAK"]).optional(),
  significantDeficiencies: z.array(z.string()).optional(),
  materialWeaknesses: z.array(z.string()).optional(),
  impactOnAuditStrategy: z.string().optional(),
});

router.get("/:engagementId/internal-control-assessment", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const assessments = await prisma.internalControlAssessment.findMany({
      where: { engagementId: req.params.engagementId },
      orderBy: { createdAt: "desc" },
    });

    res.json({
      assessments,
      coso2013Components: [
        "Control Environment",
        "Risk Assessment",
        "Control Activities",
        "Information & Communication",
        "Monitoring Activities",
      ],
      isaReference: "ISA 315 (Revised 2019)",
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch internal control assessments", details: error.message });
  }
});

router.post("/:engagementId/internal-control-assessment", requireAuth, requirePhaseUnlocked("PLANNING"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = internalControlAssessmentSchema.parse(req.body);

    const ratings = [
      data.controlEnvironmentRating,
      data.entityRiskAssessmentRating,
      data.informationSystemsRating,
      data.controlActivitiesRating,
      data.monitoringActivitiesRating,
    ].filter(Boolean);

    let overallRating = data.overallRating;
    if (!overallRating && ratings.length > 0) {
      const weakCount = ratings.filter((r: string | undefined) => r === "WEAK").length;
      const strongCount = ratings.filter((r: string | undefined) => r === "STRONG").length;
      if (weakCount >= 2) overallRating = "WEAK";
      else if (strongCount >= 3) overallRating = "STRONG";
      else overallRating = "ADEQUATE";
    }

    const assessment = await prisma.internalControlAssessment.create({
      data: {
        engagementId: req.params.engagementId,
        ...data,
        overallRating,
        preparedById: req.user!.id,
        preparedDate: new Date(),
      },
    });

    logAuditTrail(
      req.user!.id,
      "INTERNAL_CONTROL_ASSESSMENT_CREATED",
      "internal_control_assessment",
      assessment.id,
      null,
      assessment,
      req.params.engagementId,
      "Internal control assessment documented - Overall: " + overallRating,
      req.ip,
      req.get("user-agent")
    ).catch(err => console.error("Audit trail error:", err));

    res.status(201).json(assessment);
  } catch (error: any) {
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to create internal control assessment", details: error.message });
  }
});

// ============================================
// AI-ASSISTED RISK SCORING
// ============================================

function calculateRiskScore(factors: {
  industryRisk: string;
  entitySize: string;
  complexTransactions: boolean;
  relatedPartyTransactions: boolean;
  managementIntegrity: string;
  priorMisstatements: boolean;
  firstYearAudit: boolean;
  regulatoryScrutiny: boolean;
  goingConcernIssues: boolean;
  significantEstimates: boolean;
}): { score: number; level: string; recommendations: string[] } {
  let score = 0;
  const recommendations: string[] = [];

  const industryScores: Record<string, number> = { LOW: 10, MEDIUM: 20, HIGH: 30 };
  score += industryScores[factors.industryRisk] || 20;
  if (factors.industryRisk === "HIGH") {
    recommendations.push("Consider industry-specific fraud schemes in risk assessment");
  }

  const sizeScores: Record<string, number> = { SMALL: 10, MEDIUM: 15, LARGE: 20, COMPLEX: 30 };
  score += sizeScores[factors.entitySize] || 15;

  if (factors.complexTransactions) {
    score += 15;
    recommendations.push("Design substantive procedures for complex transactions");
  }

  if (factors.relatedPartyTransactions) {
    score += 20;
    recommendations.push("Enhanced procedures for related party transactions per ISA 550");
  }

  const integrityScores: Record<string, number> = { HIGH: 5, MODERATE: 15, LOW: 30 };
  score += integrityScores[factors.managementIntegrity] || 15;
  if (factors.managementIntegrity === "LOW") {
    recommendations.push("Heightened professional skepticism required");
  }

  if (factors.priorMisstatements) {
    score += 15;
    recommendations.push("Review prior period misstatements and related controls");
  }

  if (factors.firstYearAudit) {
    score += 10;
    recommendations.push("Consider opening balance procedures per ISA 510");
  }

  if (factors.regulatoryScrutiny) {
    score += 10;
    recommendations.push("Enhanced L&R procedures per ISA 250");
  }

  if (factors.goingConcernIssues) {
    score += 20;
    recommendations.push("Detailed going concern assessment per ISA 570");
  }

  if (factors.significantEstimates) {
    score += 15;
    recommendations.push("Enhanced procedures for accounting estimates per ISA 540");
  }

  let level: string;
  if (score >= 100) level = "SIGNIFICANT";
  else if (score >= 70) level = "HIGH";
  else if (score >= 40) level = "MODERATE";
  else level = "LOW";

  return { score, level, recommendations };
}

router.post("/:engagementId/ai-risk-assessment", requireAuth, requirePhaseUnlocked("PLANNING"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const factors = req.body;
    const result = calculateRiskScore(factors);

    const engagement = await prisma.engagement.findUnique({
      where: { id: req.params.engagementId },
      include: { riskAssessments: true, relatedParties: true },
    });

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    const existingRisks = engagement.riskAssessments;
    const significantRisks = existingRisks.filter((r: { isSignificantRisk: boolean }) => r.isSignificantRisk).length;
    const fraudRisks = existingRisks.filter((r: { isFraudRisk: boolean }) => r.isFraudRisk).length;

    const aiInsights = {
      overallRiskScore: result.score,
      riskLevel: result.level,
      recommendations: result.recommendations,
      existingRisksSummary: {
        total: existingRisks.length,
        significant: significantRisks,
        fraud: fraudRisks,
      },
      suggestedMaterialityAdjustment: result.level === "SIGNIFICANT" ? "Consider lower performance materiality" : null,
      suggestedSamplingAdjustment: result.level === "HIGH" ? "Increase sample sizes" : null,
      relatedPartyRiskFlag: engagement.relatedParties.length > 5,
      isaReferences: [
        "ISA 315 (Revised 2019) - Identifying and Assessing Risks",
        "ISA 330 - Auditor's Responses to Assessed Risks",
        "ISA 240 - Fraud Risk Assessment",
      ],
    };

    logAuditTrail(
      req.user!.id,
      "AI_RISK_ASSESSMENT_PERFORMED",
      "engagement",
      req.params.engagementId,
      null,
      aiInsights,
      req.params.engagementId,
      "AI-assisted risk assessment performed - Score: " + result.score,
      req.ip,
      req.get("user-agent")
    ).catch(err => console.error("Audit trail error:", err));

    res.json(aiInsights);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to perform AI risk assessment", details: error.message });
  }
});

router.post("/:engagementId/materiality-optimization", requireAuth, requirePhaseUnlocked("PLANNING"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { financialData } = req.body;

    if (!financialData) {
      return res.status(400).json({ error: "Financial data required" });
    }

    const engagement = await prisma.engagement.findUnique({
      where: { id: req.params.engagementId },
      include: { client: true, riskAssessments: true },
    });

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    const benchmarkRanges: Record<string, { min: number; max: number; typical: number; rationale: string }> = {
      PBT: { min: 5, max: 10, typical: 5, rationale: "Most common for profit-making entities" },
      REVENUE: { min: 0.5, max: 2, typical: 1, rationale: "Suitable for revenue-focused or loss-making entities" },
      TOTAL_ASSETS: { min: 0.5, max: 2, typical: 1, rationale: "Suitable for asset-intensive entities" },
      EQUITY: { min: 1, max: 5, typical: 2, rationale: "Suitable for entities where equity is primary focus" },
      GROSS_PROFIT: { min: 0.5, max: 2, typical: 1, rationale: "Alternative for entities with volatile PBT" },
    };

    const isLossMaking = (financialData.pbt || 0) < 0;
    const isAssetIntensive = (financialData.totalAssets || 0) > (financialData.revenue || 0) * 3;
    const hasVolatilePBT = Math.abs(financialData.pbtVariance || 0) > 50;
    const significantRisks = engagement.riskAssessments.filter((r: { isSignificantRisk: boolean }) => r.isSignificantRisk).length;

    let recommendedBenchmark = "PBT";
    let recommendedPercentage = 5;
    let performanceMatPercentage = 75;
    const rationale: string[] = [];

    if (isLossMaking) {
      recommendedBenchmark = "REVENUE";
      recommendedPercentage = 1;
      rationale.push("Entity is loss-making, revenue used as benchmark");
    } else if (isAssetIntensive) {
      recommendedBenchmark = "TOTAL_ASSETS";
      recommendedPercentage = 1;
      rationale.push("Entity is asset-intensive, total assets used as benchmark");
    } else if (hasVolatilePBT) {
      recommendedBenchmark = "GROSS_PROFIT";
      recommendedPercentage = 1;
      rationale.push("PBT is volatile, gross profit used as more stable benchmark");
    }

    if (significantRisks >= 3) {
      performanceMatPercentage = 60;
      rationale.push("Multiple significant risks identified, reduced PM percentage");
    }

    const benchmarkAmount = financialData[recommendedBenchmark.toLowerCase().replace(/_/g, "")] || 
                           financialData.pbt || financialData.revenue || 0;
    
    const overallMateriality = Math.round(benchmarkAmount * (recommendedPercentage / 100));
    const performanceMateriality = Math.round(overallMateriality * (performanceMatPercentage / 100));
    const specificMateriality = Math.round(overallMateriality * 0.5);
    const amptThreshold = Math.round(overallMateriality * 0.05);

    res.json({
      recommendation: {
        benchmark: recommendedBenchmark,
        benchmarkAmount,
        percentage: recommendedPercentage,
        overallMateriality,
        performanceMateriality,
        specificMateriality,
        performanceMatPercentage,
        amptThreshold,
        rationale,
      },
      alternatives: Object.entries(benchmarkRanges).map(([key, range]) => ({
        benchmark: key,
        amount: financialData[key.toLowerCase().replace(/_/g, "")] || 0,
        suggestedPercentage: range.typical,
        range,
        rationale: range.rationale,
      })),
      isaReference: "ISA 320 - Materiality in Planning and Performing an Audit",
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to optimize materiality", details: error.message });
  }
});

router.get("/:engagementId/resource-planning", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const engagement = await prisma.engagement.findUnique({
      where: { id: req.params.engagementId },
      include: {
        client: true,
        team: { include: { user: { select: { id: true, fullName: true, role: true } } } },
        riskAssessments: true,
        materialityAssessments: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    const significantRisks = engagement.riskAssessments.filter((r: { isSignificantRisk: boolean }) => r.isSignificantRisk).length;
    const fraudRisks = engagement.riskAssessments.filter((r: { isFraudRisk: boolean }) => r.isFraudRisk).length;

    let baseHours = 100;
    if (engagement.riskRating === "HIGH") baseHours *= 1.5;
    else if (engagement.riskRating === "LOW") baseHours *= 0.8;

    baseHours += significantRisks * 20;
    baseHours += fraudRisks * 30;

    const hoursBreakdown = {
      planning: Math.round(baseHours * 0.15),
      execution: Math.round(baseHours * 0.55),
      finalization: Math.round(baseHours * 0.20),
      supervision: Math.round(baseHours * 0.10),
    };

    const teamRecommendation = {
      partner: Math.round(baseHours * 0.05),
      manager: Math.round(baseHours * 0.15),
      senior: Math.round(baseHours * 0.35),
      staff: Math.round(baseHours * 0.45),
    };

    const milestones = [
      { phase: "Planning Complete", suggestedDate: engagement.fieldworkStartDate },
      { phase: "Interim Fieldwork Complete", suggestedDate: engagement.fieldworkStartDate ? new Date(new Date(engagement.fieldworkStartDate).getTime() + 14 * 24 * 60 * 60 * 1000) : null },
      { phase: "Year-End Fieldwork Complete", suggestedDate: engagement.fieldworkEndDate },
      { phase: "Draft Report", suggestedDate: engagement.reportDeadline ? new Date(new Date(engagement.reportDeadline).getTime() - 14 * 24 * 60 * 60 * 1000) : null },
      { phase: "Final Report", suggestedDate: engagement.reportDeadline },
    ];

    res.json({
      totalBudgetedHours: Math.round(baseHours),
      currentTeam: engagement.team,
      hoursBreakdown,
      teamRecommendation,
      milestones,
      riskFactors: {
        engagementRisk: engagement.riskRating,
        significantRisks,
        fraudRisks,
      },
      isaReference: "ISA 300 - Planning an Audit of Financial Statements",
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to generate resource planning", details: error.message });
  }
});

// ============================================
// PLANNING SUMMARY
// ============================================

router.get("/:engagementId/planning-summary", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const engagement = await prisma.engagement.findUnique({
      where: { id: req.params.engagementId },
      include: {
        client: true,
        entityUnderstanding: true,
        industryAnalysis: true,
        auditStrategy: true,
        materialityAssessments: { orderBy: { createdAt: "desc" }, take: 1 },
        riskAssessments: true,
        relatedParties: true,
        goingConcernAssessment: true,
        planningMemo: true,
        internalControlAssessments: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    const completionStatus = {
      entityUnderstanding: !!engagement.entityUnderstanding?.partnerApprovedById,
      industryAnalysis: !!engagement.industryAnalysis?.reviewedById,
      materiality: engagement.materialityAssessments.length > 0 && !!engagement.materialityAssessments[0].approvedById,
      riskAssessment: engagement.riskAssessments.length > 0,
      significantRisksApproved: engagement.riskAssessments.filter((r: { isSignificantRisk: boolean; partnerApprovedById: string | null }) => r.isSignificantRisk && r.partnerApprovedById).length === 
                                engagement.riskAssessments.filter((r: { isSignificantRisk: boolean }) => r.isSignificantRisk).length,
      relatedParties: engagement.relatedParties.length > 0,
      auditStrategy: !!engagement.auditStrategy?.partnerApprovedById,
      goingConcern: !!engagement.goingConcernAssessment?.partnerApprovedById,
      internalControls: engagement.internalControlAssessments.length > 0,
      planningMemo: !!engagement.planningMemo?.partnerApprovedById,
    };

    const completedItems = Object.values(completionStatus).filter(Boolean).length;
    const totalItems = Object.keys(completionStatus).length;
    const completionPercentage = Math.round((completedItems / totalItems) * 100);

    const summary = {
      engagementId: engagement.id,
      clientName: engagement.client.name,
      fiscalYearEnd: engagement.fiscalYearEnd,
      overallCompletion: completionPercentage,
      completionStatus,
      riskSummary: {
        totalRisks: engagement.riskAssessments.length,
        significantRisks: engagement.riskAssessments.filter((r: { isSignificantRisk: boolean }) => r.isSignificantRisk).length,
        fraudRisks: engagement.riskAssessments.filter((r: { isFraudRisk: boolean }) => r.isFraudRisk).length,
        highRomm: engagement.riskAssessments.filter((r: { riskOfMaterialMisstatement: string }) => r.riskOfMaterialMisstatement === "HIGH" || r.riskOfMaterialMisstatement === "SIGNIFICANT").length,
      },
      materialitySummary: engagement.materialityAssessments[0] ? {
        overallMateriality: engagement.materialityAssessments[0].overallMateriality,
        performanceMateriality: engagement.materialityAssessments[0].performanceMateriality,
        benchmark: engagement.materialityAssessments[0].benchmark,
        approved: !!engagement.materialityAssessments[0].approvedById,
      } : null,
      relatedPartiesSummary: {
        total: engagement.relatedParties.length,
        totalTransactionValue: engagement.relatedParties.reduce((sum: number, p: { transactionValue: number | null }) => sum + (p.transactionValue || 0), 0),
      },
      auditApproach: engagement.auditStrategy?.auditApproach,
      controlsReliance: engagement.auditStrategy?.controlsReliance,
      readyForExecution: completionPercentage >= 80,
      isaReferences: [
        "ISA 300 - Planning an Audit",
        "ISA 315 (Revised 2019) - Identifying and Assessing Risks",
        "ISA 320 - Materiality",
        "ISA 330 - Auditor's Responses to Assessed Risks",
      ],
    };

    res.json(summary);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to generate planning summary", details: error.message });
  }
});

router.get("/api/engagements/:engagementId/planning-status", async (req, res) => {
  try {
    const { engagementId } = req.params;

    const engagement = await prisma.engagement.findUnique({
      where: { id: engagementId },
      include: {
        materialityAssessments: { take: 1 },
        riskAssessments: { take: 1 },
        auditPrograms: { take: 1 },
        coAAccounts: { take: 1 },
        trialBalanceEntries: { take: 1 },
        glEntries: { take: 1 },
        phases: true
      }
    });

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    const planningPhase = engagement.phases?.find((p: any) => p.phase === "PLANNING");
    const prePlanningPhase = engagement.phases?.find((p: any) => p.phase === "PRE_PLANNING");

    const hasTBEntries = engagement.trialBalanceEntries?.length > 0;
    const hasGLEntries = engagement.glEntries?.length > 0;
    const hasMappedAccounts = engagement.coAAccounts?.length > 0;
    const hasMateriality = engagement.materialityAssessments?.length > 0;
    const hasRiskAssessment = engagement.riskAssessments?.length > 0;
    const hasAuditProgram = engagement.auditPrograms?.length > 0;

    const materialityApproved = engagement.materialityAssessments?.[0]?.approvedById != null;
    const mappingApproved = prePlanningPhase?.status === "COMPLETED" || hasMappedAccounts;
    const riskAssessmentApproved = planningPhase?.status === "COMPLETED" || hasRiskAssessment;
    const auditProgramApproved = planningPhase?.status === "COMPLETED" || (engagement.auditPrograms?.[0]?.approvedById != null);

    res.json({
      tbUploaded: hasTBEntries,
      glUploaded: hasGLEntries,
      mappingApproved: mappingApproved,
      materialityApproved: materialityApproved,
      riskAssessmentApproved: riskAssessmentApproved,
      auditProgramApproved: auditProgramApproved
    });
  } catch (error: any) {
    console.error("Error fetching planning status:", error);
    res.status(500).json({ error: "Failed to fetch planning status", details: error.message });
  }
});

export default router;
