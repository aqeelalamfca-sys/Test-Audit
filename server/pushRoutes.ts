import { Router, Response } from "express";
import { prisma } from "./db";
import { requireAuth, requireMinRole, type AuthenticatedRequest } from "./auth";
import { z } from "zod";

const router = Router();

const PushRequestSchema = z.object({
  engagementId: z.string().uuid(),
  mappingData: z.array(z.object({
    accountCode: z.string(),
    accountName: z.string(),
    fsLineItem: z.string().optional(),
    closingDebit: z.number(),
    closingCredit: z.number(),
    openingDebit: z.number().optional(),
    openingCredit: z.number().optional(),
    glTotalDebit: z.number().optional(),
    glTotalCredit: z.number().optional(),
  })).optional(),
  approvalStatus: z.enum(["DRAFT", "PREPARED", "REVIEWED", "APPROVED"]),
  partnerOverride: z.boolean().optional(),
  partnerOverrideNotes: z.string().optional(),
  periodEndDate: z.string().optional(),
  currencyCode: z.string().optional(),
  tbTotals: z.object({
    closingDebit: z.number(),
    closingCredit: z.number(),
  }).optional(),
});

async function createAuditLog(
  engagementId: string,
  userId: string,
  action: string,
  module: string,
  dataBefore: any,
  dataAfter: any
) {
  try {
    return await prisma.auditTrail.create({
      data: {
        engagementId,
        userId,
        action: `PUSH_TO_${module.toUpperCase()}`,
        entityType: module,
        entityId: engagementId,
        beforeValue: dataBefore,
        afterValue: dataAfter,
        module,
        ipAddress: "system",
        userRole: "USER",
      },
    });
  } catch (err) {
    console.warn("Audit log creation failed:", err);
    return null;
  }
}

router.post("/coa", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const body = PushRequestSchema.parse(req.body);
    const userId = req.user!.id;
    const firmId = req.user!.firmId;

    if (!firmId) {
      return res.status(400).json({ error: "User not associated with a firm" });
    }

    const engagement = await prisma.engagement.findFirst({
      where: { id: body.engagementId, firmId },
    });

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    if (!body.mappingData || body.mappingData.length === 0) {
      return res.status(400).json({ error: "No mapping data provided" });
    }

    const existingAccounts = await prisma.coAAccount.findMany({
      where: { engagementId: body.engagementId },
      select: { accountCode: true },
    });
    const existingCodes = new Set(existingAccounts.map(a => a.accountCode));

    const accountsToCreate = body.mappingData.filter(d => !existingCodes.has(d.accountCode));
    const accountsToUpdate = body.mappingData.filter(d => existingCodes.has(d.accountCode));

    let created = 0;
    let updated = 0;

    for (const account of accountsToCreate) {
      await prisma.coAAccount.create({
        data: {
          engagementId: body.engagementId,
          accountCode: account.accountCode,
          accountName: account.accountName,
          fsLineItem: account.fsLineItem || null,
          nature: account.closingDebit > 0 ? "DR" : "CR",
          aiSuggestedFSLine: account.fsLineItem || null,
          aiConfidence: 0.85,
        },
      });
      created++;
    }

    for (const account of accountsToUpdate) {
      await prisma.coAAccount.updateMany({
        where: {
          engagementId: body.engagementId,
          accountCode: account.accountCode,
          isOverridden: false,
        },
        data: {
          accountName: account.accountName,
          fsLineItem: account.fsLineItem || null,
          updatedAt: new Date(),
        },
      });
      updated++;
    }

    await createAuditLog(body.engagementId, userId, "PUSH", "COA",
      { existingCount: existingAccounts.length },
      { created, updated, total: body.mappingData.length }
    );

    res.json({
      success: true,
      message: `Chart of Accounts updated: ${created} created, ${updated} updated`,
      data: { created, updated, total: body.mappingData.length },
    });
  } catch (error) {
    console.error("Push to CoA error:", error);
    res.status(500).json({ error: "Failed to push to Chart of Accounts" });
  }
});

function getIndustryBenchmarkRecommendation(industry: string | null): {
  recommendedBenchmark: "REVENUE" | "TOTAL_ASSETS" | "EQUITY" | "PBT" | "GROSS_PROFIT";
  percentageRange: { min: number; max: number; default: number };
  rationale: string;
} {
  const industryLower = (industry || "").toLowerCase();
  
  if (industryLower.includes("bank") || industryLower.includes("financial") || 
      industryLower.includes("insurance") || industryLower.includes("leasing")) {
    return {
      recommendedBenchmark: "TOTAL_ASSETS",
      percentageRange: { min: 0.5, max: 2.0, default: 1.0 },
      rationale: "Financial institutions typically use Total Assets as benchmark per ISA 320 guidance for regulated entities",
    };
  }
  
  if (industryLower.includes("non-profit") || industryLower.includes("ngo") || 
      industryLower.includes("charity") || industryLower.includes("welfare") ||
      industryLower.includes("trust") || industryLower.includes("foundation")) {
    return {
      recommendedBenchmark: "GROSS_PROFIT",
      percentageRange: { min: 0.5, max: 2.0, default: 1.0 },
      rationale: "Non-profit entities typically use Total Expenses/Expenditure as benchmark since they don't generate revenue in traditional sense",
    };
  }
  
  if (industryLower.includes("manufacturing") || industryLower.includes("trading") ||
      industryLower.includes("retail") || industryLower.includes("wholesale")) {
    return {
      recommendedBenchmark: "REVENUE",
      percentageRange: { min: 0.5, max: 1.0, default: 0.5 },
      rationale: "Manufacturing and trading entities commonly use Revenue as primary benchmark per ISA 320",
    };
  }
  
  if (industryLower.includes("real estate") || industryLower.includes("property") ||
      industryLower.includes("investment") || industryLower.includes("holding")) {
    return {
      recommendedBenchmark: "TOTAL_ASSETS",
      percentageRange: { min: 0.5, max: 2.0, default: 1.0 },
      rationale: "Asset-intensive industries typically use Total Assets as the most relevant benchmark",
    };
  }
  
  if (industryLower.includes("startup") || industryLower.includes("technology") ||
      industryLower.includes("loss-making") || industryLower.includes("development")) {
    return {
      recommendedBenchmark: "REVENUE",
      percentageRange: { min: 1.0, max: 3.0, default: 1.5 },
      rationale: "Loss-making or early-stage entities may use Revenue or Total Assets; PBT not applicable",
    };
  }
  
  return {
    recommendedBenchmark: "REVENUE",
    percentageRange: { min: 0.5, max: 1.0, default: 0.5 },
    rationale: "Default recommendation: Revenue benchmark commonly used for commercial entities per ISA 320",
  };
}

router.post("/materiality", requireAuth, requireMinRole("MANAGER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const body = PushRequestSchema.parse(req.body);
    const userId = req.user!.id;
    const firmId = req.user!.firmId;

    if (!firmId) {
      return res.status(400).json({ error: "User not associated with a firm" });
    }

    if (body.approvalStatus !== "APPROVED" && !body.partnerOverride) {
      return res.status(400).json({ error: "Mapping must be APPROVED or Partner Override required" });
    }

    if (body.partnerOverride && !body.partnerOverrideNotes) {
      return res.status(400).json({ error: "Partner override requires mandatory notes" });
    }

    const engagement = await prisma.engagement.findFirst({
      where: { id: body.engagementId, firmId },
      include: { client: true },
    });

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    const tbClosingDebit = body.tbTotals?.closingDebit || 0;
    const tbClosingCredit = body.tbTotals?.closingCredit || 0;
    
    const totalAssets = tbClosingDebit;
    const revenue = Number(engagement.lastYearRevenue) || 0;
    const equity = Number(engagement.shareCapital) || 0;
    const profitBeforeTax = revenue * 0.1;

    const industryRecommendation = getIndustryBenchmarkRecommendation(engagement.client?.industry || null);

    const benchmarkCalculations = {
      revenue: {
        baseAmount: revenue,
        percentage: 0.5,
        materialityAmount: revenue * 0.005,
        isRecommended: industryRecommendation.recommendedBenchmark === "REVENUE",
        rationale: "0.5% of Revenue - Standard benchmark for commercial entities",
      },
      totalAssets: {
        baseAmount: totalAssets,
        percentage: 1.0,
        materialityAmount: totalAssets * 0.01,
        isRecommended: industryRecommendation.recommendedBenchmark === "TOTAL_ASSETS",
        rationale: "1.0% of Total Assets - Common for asset-intensive or financial entities",
      },
      equity: {
        baseAmount: equity,
        percentage: 2.0,
        materialityAmount: equity * 0.02,
        isRecommended: industryRecommendation.recommendedBenchmark === "EQUITY",
        rationale: "2.0% of Shareholders' Equity - Alternative benchmark per ISA 320",
      },
      profitBeforeTax: {
        baseAmount: profitBeforeTax,
        percentage: 5.0,
        materialityAmount: profitBeforeTax * 0.05,
        isRecommended: industryRecommendation.recommendedBenchmark === "PBT",
        rationale: "5.0% of Profit Before Tax - Common for stable, profitable entities",
      },
    };

    let selectedBenchmark: "REVENUE" | "TOTAL_ASSETS" | "EQUITY" | "PBT" | "GROSS_PROFIT" = industryRecommendation.recommendedBenchmark;
    let selectedPercentage = industryRecommendation.percentageRange.default;
    let benchmarkAmount = 0;

    switch (selectedBenchmark) {
      case "REVENUE":
        benchmarkAmount = revenue;
        selectedPercentage = 0.5;
        break;
      case "TOTAL_ASSETS":
        benchmarkAmount = totalAssets;
        selectedPercentage = 1.0;
        break;
      case "EQUITY":
        benchmarkAmount = equity;
        selectedPercentage = 2.0;
        break;
      case "PBT":
        benchmarkAmount = profitBeforeTax;
        selectedPercentage = 5.0;
        break;
      case "GROSS_PROFIT":
        benchmarkAmount = revenue * 0.3;
        selectedPercentage = 1.0;
        break;
    }

    if (benchmarkAmount === 0 && revenue > 0) {
      selectedBenchmark = "REVENUE";
      benchmarkAmount = revenue;
      selectedPercentage = 0.5;
    } else if (benchmarkAmount === 0 && totalAssets > 0) {
      selectedBenchmark = "TOTAL_ASSETS";
      benchmarkAmount = totalAssets;
      selectedPercentage = 1.0;
    }

    const overallMateriality = benchmarkAmount * (selectedPercentage / 100);
    const performanceMateriality = overallMateriality * 0.75;
    const trivialThreshold = overallMateriality * 0.05;

    const benchmarkSelectionRationale = body.partnerOverride 
      ? `Partner Override: ${body.partnerOverrideNotes}`
      : `Industry: ${engagement.client?.industry || 'Not specified'}. ${industryRecommendation.rationale}. ` +
        `Selected ${selectedBenchmark} benchmark at ${selectedPercentage}% resulting in Overall Materiality of ${overallMateriality.toLocaleString()}. ` +
        `AI-Assisted calculation - Subject to Professional Judgment per ISA 320.`;

    const existingMateriality = await prisma.materialityAssessment.findFirst({
      where: { engagementId: body.engagementId },
    });

    const materialityData = {
      benchmark: selectedBenchmark,
      benchmarkAmount,
      benchmarkPercentage: selectedPercentage,
      overallMateriality,
      performanceMateriality,
      performanceMatPercentage: 75,
      amptThreshold: trivialThreshold,
      amptPercentage: 5,
      justification: benchmarkSelectionRationale,
      isaReference: "ISA 320",
      approvedById: body.approvalStatus === "APPROVED" ? userId : null,
      approvedDate: body.approvalStatus === "APPROVED" ? new Date() : null,
    };

    if (existingMateriality) {
      await prisma.materialityAssessment.update({
        where: { id: existingMateriality.id },
        data: materialityData,
      });
    } else {
      await prisma.materialityAssessment.create({
        data: {
          engagementId: body.engagementId,
          ...materialityData,
        },
      });
    }

    await createAuditLog(body.engagementId, userId, "PUSH", "MATERIALITY",
      existingMateriality,
      { 
        selectedBenchmark, 
        overallMateriality, 
        performanceMateriality, 
        trivialThreshold,
        allBenchmarks: benchmarkCalculations,
      }
    );

    res.json({
      success: true,
      message: "Materiality thresholds calculated and saved with industry-specific recommendations",
      data: {
        selectedBenchmark,
        benchmarkAmount,
        benchmarkPercentage: selectedPercentage,
        overallMateriality,
        performanceMateriality,
        trivialThreshold,
        industryRecommendation: {
          industry: engagement.client?.industry || "Not specified",
          recommendedBenchmark: industryRecommendation.recommendedBenchmark,
          percentageRange: industryRecommendation.percentageRange,
          rationale: industryRecommendation.rationale,
        },
        allBenchmarkOptions: benchmarkCalculations,
        benchmarkSelectionRationale,
        aiAssisted: true,
        isaReference: "ISA 320",
      },
    });
  } catch (error) {
    console.error("Push to Materiality error:", error);
    res.status(500).json({ error: "Failed to push to Materiality" });
  }
});

router.post("/fs", requireAuth, requireMinRole("SENIOR"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const body = PushRequestSchema.parse(req.body);
    const userId = req.user!.id;
    const firmId = req.user!.firmId;

    if (!firmId) {
      return res.status(400).json({ error: "User not associated with a firm" });
    }

    if (body.approvalStatus !== "APPROVED" && !body.partnerOverride) {
      return res.status(400).json({ error: "Mapping must be APPROVED for FS generation" });
    }

    const engagement = await prisma.engagement.findFirst({
      where: { id: body.engagementId, firmId },
    });

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    const fsLineItems: Record<string, { debit: number; credit: number }> = {};

    for (const item of body.mappingData || []) {
      if (item.fsLineItem) {
        if (!fsLineItems[item.fsLineItem]) {
          fsLineItems[item.fsLineItem] = { debit: 0, credit: 0 };
        }
        fsLineItems[item.fsLineItem].debit += item.closingDebit || 0;
        fsLineItems[item.fsLineItem].credit += item.closingCredit || 0;
      }
    }

    await createAuditLog(body.engagementId, userId, "PUSH", "FS",
      null,
      { lineItemCount: Object.keys(fsLineItems).length, lineItems: Object.keys(fsLineItems) }
    );

    res.json({
      success: true,
      message: "Financial Statement draft generated",
      data: {
        lineItemCount: Object.keys(fsLineItems).length,
        lineItems: fsLineItems,
        aiAssisted: true,
        note: "AI-Assisted - Subject to Professional Judgment",
      },
    });
  } catch (error) {
    console.error("Push to FS error:", error);
    res.status(500).json({ error: "Failed to generate Financial Statements" });
  }
});

function determineStatementType(fsLine: string): { statementType: string; fsType: string } {
  const bsKeywords = ["asset", "liability", "liabilities", "equity", "capital", "payable", "receivable", 
    "cash", "bank", "inventory", "property", "equipment", "investment", "loan", "borrowing", "debt",
    "fixed asset", "current asset", "non-current", "trade receivable", "trade payable", "accrual",
    "prepayment", "deposit", "provision", "reserve", "retained earning", "share capital"];
  const plKeywords = ["revenue", "income", "expense", "cost", "sales", "operating", "profit", "loss",
    "interest income", "interest expense", "depreciation", "amortization", "tax", "wages", "salary",
    "administrative", "selling", "distribution", "finance cost", "other income", "other expense"];
  
  const normalized = fsLine.toLowerCase();
  
  for (const kw of bsKeywords) {
    if (normalized.includes(kw)) {
      return { statementType: "BALANCE_SHEET", fsType: "BS" };
    }
  }
  for (const kw of plKeywords) {
    if (normalized.includes(kw)) {
      return { statementType: "INCOME_STATEMENT", fsType: "PL" };
    }
  }
  return { statementType: "BALANCE_SHEET", fsType: "BS" };
}

function determineRiskLevel(fsLine: string, balance: number): string {
  const normalized = fsLine.toLowerCase();
  if (normalized.includes("revenue") || normalized.includes("sales")) return "HIGH";
  if (normalized.includes("receivable")) return "HIGH";
  if (normalized.includes("inventory")) return "HIGH";
  if (normalized.includes("cash") && Math.abs(balance) > 10000000) return "HIGH";
  if (normalized.includes("related party")) return "HIGH";
  if (Math.abs(balance) > 50000000) return "HIGH";
  if (Math.abs(balance) > 10000000) return "MEDIUM";
  return "LOW";
}

function getDefaultProcedures(fsLine: string, fsType: string): Array<{ description: string; isaReference: string; assertions: string[] }> {
  const normalized = fsLine.toLowerCase();
  const procedures: Array<{ description: string; isaReference: string; assertions: string[] }> = [];
  
  procedures.push({
    description: `Obtain and review ${fsLine} schedule and reconcile to trial balance`,
    isaReference: "ISA 500",
    assertions: ["Accuracy", "Completeness"],
  });
  
  if (normalized.includes("receivable")) {
    procedures.push(
      { description: "Send balance confirmations to major debtors", isaReference: "ISA 505", assertions: ["Existence", "Rights and Obligations"] },
      { description: "Test subsequent receipts for collectability", isaReference: "ISA 540", assertions: ["Valuation"] },
      { description: "Review ageing analysis and assess provisions", isaReference: "ISA 540", assertions: ["Valuation", "Accuracy"] }
    );
  } else if (normalized.includes("payable")) {
    procedures.push(
      { description: "Send balance confirmations to major creditors", isaReference: "ISA 505", assertions: ["Completeness", "Existence"] },
      { description: "Test subsequent payments", isaReference: "ISA 500", assertions: ["Completeness", "Accuracy"] },
      { description: "Search for unrecorded liabilities at year end", isaReference: "ISA 500", assertions: ["Completeness"] }
    );
  } else if (normalized.includes("inventory")) {
    procedures.push(
      { description: "Attend physical inventory count", isaReference: "ISA 501", assertions: ["Existence", "Completeness"] },
      { description: "Test inventory valuation at lower of cost and NRV", isaReference: "ISA 540", assertions: ["Valuation"] },
      { description: "Review for slow-moving or obsolete items", isaReference: "ISA 500", assertions: ["Valuation"] }
    );
  } else if (normalized.includes("cash") || normalized.includes("bank")) {
    procedures.push(
      { description: "Obtain bank confirmation letters", isaReference: "ISA 505", assertions: ["Existence", "Completeness"] },
      { description: "Review bank reconciliation statements", isaReference: "ISA 500", assertions: ["Accuracy", "Completeness"] },
      { description: "Test subsequent clearance of reconciling items", isaReference: "ISA 500", assertions: ["Existence"] }
    );
  } else if (normalized.includes("revenue") || normalized.includes("sales")) {
    procedures.push(
      { description: "Perform cut-off testing at year end", isaReference: "ISA 500", assertions: ["Cut-off", "Accuracy"] },
      { description: "Test sample of sales invoices to supporting documents", isaReference: "ISA 500", assertions: ["Occurrence", "Accuracy"] },
      { description: "Analytical review of revenue by product/segment", isaReference: "ISA 520", assertions: ["Completeness", "Occurrence"] }
    );
  } else if (normalized.includes("property") || normalized.includes("equipment") || normalized.includes("fixed asset")) {
    procedures.push(
      { description: "Verify additions with purchase invoices and title documents", isaReference: "ISA 500", assertions: ["Existence", "Rights and Obligations"] },
      { description: "Recalculate depreciation and review policy compliance", isaReference: "ISA 500", assertions: ["Valuation", "Accuracy"] },
      { description: "Perform physical verification of major assets", isaReference: "ISA 500", assertions: ["Existence"] }
    );
  } else {
    procedures.push(
      { description: `Perform substantive analytical procedures on ${fsLine}`, isaReference: "ISA 520", assertions: ["Accuracy", "Valuation"] },
      { description: `Vouch sample transactions to supporting documentation`, isaReference: "ISA 500", assertions: ["Occurrence", "Accuracy"] }
    );
  }
  
  return procedures;
}

router.post("/fs-heads", requireAuth, requireMinRole("SENIOR"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const body = PushRequestSchema.parse(req.body);
    const userId = req.user!.id;
    const firmId = req.user!.firmId;

    if (!firmId) {
      return res.status(400).json({ error: "User not associated with a firm" });
    }

    if (body.approvalStatus !== "APPROVED" && !body.partnerOverride) {
      return res.status(400).json({ error: "Mapping must be APPROVED for FS Heads creation" });
    }

    const engagement = await prisma.engagement.findFirst({
      where: { id: body.engagementId, firmId },
    });

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    const materiality = await prisma.materialityAssessment.findFirst({
      where: { engagementId: body.engagementId },
      select: { overallMateriality: true, performanceMateriality: true, amptThreshold: true },
    });

    const fsLineGroups: Record<string, {
      accounts: Array<{ accountCode: string; accountName: string }>;
      totalDebit: number;
      totalCredit: number;
    }> = {};

    for (const item of body.mappingData || []) {
      if (item.fsLineItem) {
        if (!fsLineGroups[item.fsLineItem]) {
          fsLineGroups[item.fsLineItem] = { accounts: [], totalDebit: 0, totalCredit: 0 };
        }
        fsLineGroups[item.fsLineItem].accounts.push({
          accountCode: item.accountCode,
          accountName: item.accountName,
        });
        fsLineGroups[item.fsLineItem].totalDebit += item.closingDebit || 0;
        fsLineGroups[item.fsLineItem].totalCredit += item.closingCredit || 0;
      }
    }

    const existingFsHeads = await prisma.fSHeadWorkingPaper.findMany({
      where: { engagementId: body.engagementId },
      select: { fsHeadName: true },
    });
    const existingNames = new Set(existingFsHeads.map((h: { fsHeadName: string }) => h.fsHeadName));

    let created = 0;
    let proceduresCreated = 0;

    for (const [fsLine, group] of Object.entries(fsLineGroups)) {
      if (!existingNames.has(fsLine)) {
        const balance = group.totalDebit - group.totalCredit;
        const { statementType, fsType } = determineStatementType(fsLine);
        const riskLevel = determineRiskLevel(fsLine, balance);
        const accountCodes = group.accounts.map(a => a.accountCode);
        
        const overallMat = materiality?.overallMateriality ? Number(materiality.overallMateriality) : null;
        const perfMat = materiality?.performanceMateriality ? Number(materiality.performanceMateriality) : null;
        const trivial = materiality?.amptThreshold ? Number(materiality.amptThreshold) : null;
        const isMaterial = overallMat ? Math.abs(balance) >= overallMat * 0.1 : Math.abs(balance) > 0;

        const workingPaper = await prisma.fSHeadWorkingPaper.create({
          data: {
            engagementId: body.engagementId,
            fsHeadKey: fsLine.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, ""),
            fsHeadName: fsLine,
            statementType,
            fsType,
            linkedAccountIds: accountCodes,
            accountCodeRange: accountCodes.length > 0 ? `${accountCodes[0]} - ${accountCodes[accountCodes.length - 1]}` : null,
            currentYearBalance: balance,
            priorYearBalance: 0,
            movement: balance,
            movementPercentage: 0,
            overallMateriality: overallMat,
            performanceMateriality: perfMat,
            trivialThreshold: trivial,
            isMaterialHead: isMaterial,
            materialityRelevance: isMaterial ? "Material balance requiring substantive procedures" : "Below materiality threshold",
            riskLevel,
            inherentRisk: riskLevel,
            controlRisk: "MEDIUM",
            detectionRisk: riskLevel === "HIGH" ? "LOW" : "MEDIUM",
            combinedRiskAssessment: riskLevel,
            auditStatus: "NOT_STARTED",
            isaReference: "ISA 315, ISA 330, ISA 500",
            preparedById: userId,
          },
        });
        created++;

        const defaultProcedures = getDefaultProcedures(fsLine, fsType);
        for (let i = 0; i < defaultProcedures.length; i++) {
          const proc = defaultProcedures[i];
          await prisma.fSHeadProcedure.create({
            data: {
              workingPaperId: workingPaper.id,
              procedureRef: `${workingPaper.fsHeadKey.substring(0, 3).toUpperCase()}-${(i + 1).toString().padStart(2, "0")}`,
              description: proc.description,
              isaReference: proc.isaReference,
              assertions: proc.assertions,
              riskLevel,
              nature: "Substantive",
              isAISuggested: true,
              aiConfidence: 0.85,
              aiRationale: "Standard procedure based on account type and ISA requirements",
              orderIndex: i,
            },
          });
          proceduresCreated++;
        }
      }
    }

    await createAuditLog(body.engagementId, userId, "PUSH", "FS_HEADS",
      { existingCount: existingFsHeads.length },
      { created, proceduresCreated, total: Object.keys(fsLineGroups).length }
    );

    res.json({
      success: true,
      message: `FS Heads created: ${created} new working papers with ${proceduresCreated} audit procedures`,
      data: { 
        created, 
        proceduresCreated,
        existing: existingFsHeads.length, 
        total: Object.keys(fsLineGroups).length,
        linkedAccounts: Object.entries(fsLineGroups).reduce((sum, [_, g]) => sum + g.accounts.length, 0),
      },
    });
  } catch (error) {
    console.error("Push to FS Heads error:", error);
    res.status(500).json({ error: "Failed to create FS Heads" });
  }
});

router.post("/risk", requireAuth, requireMinRole("SENIOR"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const body = PushRequestSchema.parse(req.body);
    const userId = req.user!.id;
    const firmId = req.user!.firmId;

    if (!firmId) {
      return res.status(400).json({ error: "User not associated with a firm" });
    }

    const engagement = await prisma.engagement.findFirst({
      where: { id: body.engagementId, firmId },
    });

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    const riskCandidates: Array<{ accountCode: string; accountName: string; riskType: string; reason: string }> = [];

    for (const item of body.mappingData || []) {
      if (item.accountName.toLowerCase().includes("suspense")) {
        riskCandidates.push({
          accountCode: item.accountCode,
          accountName: item.accountName,
          riskType: "SUSPENSE_ACCOUNT",
          reason: "Suspense account requires investigation",
        });
      }

      if (item.fsLineItem?.toLowerCase().includes("revenue")) {
        riskCandidates.push({
          accountCode: item.accountCode,
          accountName: item.accountName,
          riskType: "REVENUE_RECOGNITION",
          reason: "ISA 240 presumed fraud risk - Revenue recognition",
        });
      }
    }

    await createAuditLog(body.engagementId, userId, "PUSH", "RISK",
      null,
      { candidateCount: riskCandidates.length, candidates: riskCandidates }
    );

    res.json({
      success: true,
      message: `Risk assessment: ${riskCandidates.length} candidates identified`,
      data: {
        candidates: riskCandidates,
        aiAssisted: true,
        note: "AI-Assisted - Subject to Professional Judgment",
      },
    });
  } catch (error) {
    console.error("Push to Risk error:", error);
    res.status(500).json({ error: "Failed to generate risk assessment" });
  }
});

router.post("/analytical", requireAuth, requireMinRole("SENIOR"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const body = PushRequestSchema.parse(req.body);
    const userId = req.user!.id;
    const firmId = req.user!.firmId;

    if (!firmId) {
      return res.status(400).json({ error: "User not associated with a firm" });
    }

    const engagement = await prisma.engagement.findFirst({
      where: { id: body.engagementId, firmId },
    });

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    const analyticalResults: Array<{
      fsLineItem: string;
      currentYear: number;
      priorYear: number;
      variance: number;
      variancePercent: number;
      flag: string;
    }> = [];

    const groupedByFs: Record<string, { current: number; prior: number }> = {};

    for (const item of body.mappingData || []) {
      const fsLine = item.fsLineItem || "Unmapped";
      if (!groupedByFs[fsLine]) {
        groupedByFs[fsLine] = { current: 0, prior: 0 };
      }
      groupedByFs[fsLine].current += (item.closingDebit || 0) - (item.closingCredit || 0);
      groupedByFs[fsLine].prior += (item.openingDebit || 0) - (item.openingCredit || 0);
    }

    for (const [fsLine, values] of Object.entries(groupedByFs)) {
      const variance = values.current - values.prior;
      const variancePercent = values.prior !== 0 ? (variance / Math.abs(values.prior)) * 100 : 0;
      
      let flag = "NORMAL";
      if (Math.abs(variancePercent) > 20) flag = "HIGH_VARIANCE";
      else if (Math.abs(variancePercent) > 10) flag = "MODERATE_VARIANCE";

      analyticalResults.push({
        fsLineItem: fsLine,
        currentYear: values.current,
        priorYear: values.prior,
        variance,
        variancePercent,
        flag,
      });
    }

    await createAuditLog(body.engagementId, userId, "PUSH", "ANALYTICAL",
      null,
      { resultCount: analyticalResults.length }
    );

    res.json({
      success: true,
      message: `Analytical procedures: ${analyticalResults.length} line items analyzed`,
      data: {
        results: analyticalResults,
        highVarianceCount: analyticalResults.filter(r => r.flag === "HIGH_VARIANCE").length,
        aiAssisted: true,
      },
    });
  } catch (error) {
    console.error("Push to Analytical error:", error);
    res.status(500).json({ error: "Failed to generate analytical procedures" });
  }
});

function determineSampleSize(
  populationCount: number,
  totalValue: number,
  riskLevel: "HIGH" | "MEDIUM" | "LOW",
  trivialThreshold: number
): { sampleSize: number; samplePercentage: number; rationale: string } {
  const riskMultipliers = {
    HIGH: 1.0,
    MEDIUM: 0.3,
    LOW: 0.1,
  };
  
  const multiplier = riskMultipliers[riskLevel];
  const itemsAboveTrivial = Math.ceil(populationCount * (totalValue > trivialThreshold ? 1 : 0.5));
  
  let sampleSize = Math.ceil(itemsAboveTrivial * multiplier);
  
  sampleSize = Math.max(sampleSize, Math.min(5, populationCount));
  sampleSize = Math.min(sampleSize, populationCount);
  
  if (riskLevel === "HIGH" && populationCount <= 30) {
    sampleSize = populationCount;
  }
  
  const samplePercentage = populationCount > 0 ? (sampleSize / populationCount) * 100 : 0;
  
  const rationale = riskLevel === "HIGH" && sampleSize === populationCount
    ? "100% testing due to HIGH risk level and small population"
    : `${(multiplier * 100).toFixed(0)}% sampling rate applied for ${riskLevel} risk per ISA 530`;
  
  return { sampleSize, samplePercentage, rationale };
}

function determineSamplingMethod(
  populationCount: number,
  totalValue: number,
  overallMateriality: number
): { method: "RANDOM" | "SYSTEMATIC" | "MUS"; rationale: string } {
  if (totalValue > overallMateriality * 10 && populationCount > 50) {
    return {
      method: "MUS",
      rationale: "Monetary Unit Sampling recommended: High value population with items likely above tolerable misstatement",
    };
  }
  
  if (populationCount > 100) {
    return {
      method: "SYSTEMATIC",
      rationale: "Systematic sampling recommended: Large population requiring efficient selection",
    };
  }
  
  return {
    method: "RANDOM",
    rationale: "Random sampling recommended: Moderate population size suitable for random selection",
  };
}

function determineFsHeadRiskLevel(fsHead: string, totalValue: number, overallMateriality: number): "HIGH" | "MEDIUM" | "LOW" {
  const normalized = fsHead.toLowerCase();
  
  if (normalized.includes("revenue") || normalized.includes("sales")) return "HIGH";
  if (normalized.includes("receivable")) return "HIGH";
  if (normalized.includes("inventory")) return "HIGH";
  if (normalized.includes("related party")) return "HIGH";
  if (normalized.includes("journal") || normalized.includes("adjustment")) return "HIGH";
  
  if (totalValue > overallMateriality * 2) return "HIGH";
  if (totalValue > overallMateriality) return "MEDIUM";
  
  if (normalized.includes("payable")) return "MEDIUM";
  if (normalized.includes("expense")) return "MEDIUM";
  if (normalized.includes("cost")) return "MEDIUM";
  
  return "LOW";
}

router.post("/sampling", requireAuth, requireMinRole("SENIOR"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const body = PushRequestSchema.parse(req.body);
    const userId = req.user!.id;
    const firmId = req.user!.firmId;

    if (!firmId) {
      return res.status(400).json({ error: "User not associated with a firm" });
    }

    const engagement = await prisma.engagement.findFirst({
      where: { id: body.engagementId, firmId },
    });

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    const materiality = await prisma.materialityAssessment.findFirst({
      where: { engagementId: body.engagementId },
      select: { overallMateriality: true, performanceMateriality: true, amptThreshold: true },
    });

    const overallMateriality = materiality?.overallMateriality ? Number(materiality.overallMateriality) : 1000000;
    const performanceMateriality = materiality?.performanceMateriality ? Number(materiality.performanceMateriality) : overallMateriality * 0.75;
    const trivialThreshold = materiality?.amptThreshold ? Number(materiality.amptThreshold) : overallMateriality * 0.05;

    const glEntries = await prisma.gLEntry.findMany({
      where: { 
        engagementId: body.engagementId,
        hasErrors: false,
        isDuplicate: false,
      },
      select: {
        id: true,
        accountCode: true,
        accountName: true,
        debit: true,
        credit: true,
        transactionDate: true,
        voucherNumber: true,
        description: true,
      },
    });

    if (glEntries.length === 0) {
      const glAccountsWithData = (body.mappingData || []).filter(
        d => (d.glTotalDebit || 0) > 0 || (d.glTotalCredit || 0) > 0
      );

      if (glAccountsWithData.length === 0) {
        return res.status(400).json({ error: "GL data required for sampling. No GL entries found for this engagement." });
      }
    }

    const accountCodeToFsHead: Record<string, string> = {};
    for (const item of body.mappingData || []) {
      if (item.fsLineItem) {
        accountCodeToFsHead[item.accountCode] = item.fsLineItem;
      }
    }

    const accountTotals: Record<string, {
      accountCode: string;
      accountName: string;
      fsHead: string;
      entryCount: number;
      totalDebit: number;
      totalCredit: number;
      netAmount: number;
      entries: Array<{ id: string; debit: number; credit: number; date: Date | null; voucher: string | null }>;
    }> = {};

    for (const entry of glEntries) {
      const accountCode = entry.accountCode;
      const fsHead = accountCodeToFsHead[accountCode] || "Unmapped";
      
      if (!accountTotals[accountCode]) {
        accountTotals[accountCode] = {
          accountCode,
          accountName: entry.accountName,
          fsHead,
          entryCount: 0,
          totalDebit: 0,
          totalCredit: 0,
          netAmount: 0,
          entries: [],
        };
      }
      
      const debit = Number(entry.debit) || 0;
      const credit = Number(entry.credit) || 0;
      
      accountTotals[accountCode].entryCount++;
      accountTotals[accountCode].totalDebit += debit;
      accountTotals[accountCode].totalCredit += credit;
      accountTotals[accountCode].netAmount += (debit - credit);
      accountTotals[accountCode].entries.push({
        id: entry.id,
        debit,
        credit,
        date: entry.transactionDate,
        voucher: entry.voucherNumber,
      });
    }

    const fsHeadGroups: Record<string, {
      fsHead: string;
      accounts: string[];
      totalPopulationCount: number;
      totalPopulationValue: number;
      accountDetails: Array<{
        accountCode: string;
        accountName: string;
        entryCount: number;
        netAmount: number;
      }>;
    }> = {};

    for (const [accountCode, data] of Object.entries(accountTotals)) {
      const fsHead = data.fsHead;
      
      if (!fsHeadGroups[fsHead]) {
        fsHeadGroups[fsHead] = {
          fsHead,
          accounts: [],
          totalPopulationCount: 0,
          totalPopulationValue: 0,
          accountDetails: [],
        };
      }
      
      fsHeadGroups[fsHead].accounts.push(accountCode);
      fsHeadGroups[fsHead].totalPopulationCount += data.entryCount;
      fsHeadGroups[fsHead].totalPopulationValue += Math.abs(data.netAmount);
      fsHeadGroups[fsHead].accountDetails.push({
        accountCode: data.accountCode,
        accountName: data.accountName,
        entryCount: data.entryCount,
        netAmount: data.netAmount,
      });
    }

    const samplingFrames: Array<{
      fsHead: string;
      riskLevel: "HIGH" | "MEDIUM" | "LOW";
      populationCount: number;
      populationValue: number;
      sampleSize: number;
      samplePercentage: number;
      samplingMethod: "RANDOM" | "SYSTEMATIC" | "MUS";
      itemsAboveTrivial: number;
      trivialThreshold: number;
      performanceMateriality: number;
      accountCodes: string[];
      samplingRationale: string;
      methodRationale: string;
    }> = [];

    let totalSamplingRunsCreated = 0;

    for (const [fsHead, group] of Object.entries(fsHeadGroups)) {
      const riskLevel = determineFsHeadRiskLevel(fsHead, group.totalPopulationValue, overallMateriality);
      const { sampleSize, samplePercentage, rationale: sampleRationale } = determineSampleSize(
        group.totalPopulationCount,
        group.totalPopulationValue,
        riskLevel,
        trivialThreshold
      );
      const { method: samplingMethod, rationale: methodRationale } = determineSamplingMethod(
        group.totalPopulationCount,
        group.totalPopulationValue,
        overallMateriality
      );

      const itemsAboveTrivial = group.accountDetails.filter(a => Math.abs(a.netAmount) >= trivialThreshold).length;

      samplingFrames.push({
        fsHead,
        riskLevel,
        populationCount: group.totalPopulationCount,
        populationValue: group.totalPopulationValue,
        sampleSize,
        samplePercentage,
        samplingMethod,
        itemsAboveTrivial,
        trivialThreshold,
        performanceMateriality,
        accountCodes: group.accounts,
        samplingRationale: sampleRationale,
        methodRationale,
      });

      if (group.totalPopulationCount > 0) {
        const existingRunCount = await prisma.samplingRun.count({
          where: { engagementId: body.engagementId },
        });

        await prisma.samplingRun.create({
          data: {
            engagementId: body.engagementId,
            firmId,
            runNumber: existingRunCount + 1,
            runName: `${fsHead} - Auto-generated Sampling Frame`,
            samplingMethod: samplingMethod,
            populationSource: "GL_ENTRIES",
            populationCount: group.totalPopulationCount,
            populationValue: group.totalPopulationValue,
            sampleSize,
            sampleValue: (group.totalPopulationValue / group.totalPopulationCount) * sampleSize,
            coveragePercentage: samplePercentage,
            materialityThreshold: overallMateriality,
            tolerableError: performanceMateriality,
            expectedError: trivialThreshold,
            targetedCriteria: {
              fsHead,
              riskLevel,
              accountCodes: group.accounts,
            },
            status: "COMPLETED",
            createdById: userId,
          },
        });
        totalSamplingRunsCreated++;
      }
    }

    await createAuditLog(body.engagementId, userId, "PUSH", "SAMPLING",
      null,
      { 
        frameCount: samplingFrames.length,
        totalGLEntries: glEntries.length,
        samplingRunsCreated: totalSamplingRunsCreated,
        materialityUsed: { overallMateriality, performanceMateriality, trivialThreshold },
      }
    );

    res.json({
      success: true,
      message: `Sampling frames generated: ${samplingFrames.length} FS heads with ${totalSamplingRunsCreated} sampling runs created`,
      data: {
        frames: samplingFrames,
        summary: {
          totalFSHeads: samplingFrames.length,
          totalGLEntries: glEntries.length,
          totalAccountCodes: Object.keys(accountTotals).length,
          samplingRunsCreated: totalSamplingRunsCreated,
          highRiskFrames: samplingFrames.filter(f => f.riskLevel === "HIGH").length,
          mediumRiskFrames: samplingFrames.filter(f => f.riskLevel === "MEDIUM").length,
          lowRiskFrames: samplingFrames.filter(f => f.riskLevel === "LOW").length,
        },
        materialityThresholds: {
          overallMateriality,
          performanceMateriality,
          trivialThreshold,
        },
        riskBasedSampling: {
          highRiskPercentage: "100% of items above trivial threshold",
          mediumRiskPercentage: "30% of items above trivial threshold",
          lowRiskPercentage: "10% of items above trivial threshold",
        },
        aiAssisted: true,
        isaReference: "ISA 530 - Audit Sampling",
        note: "AI-Assisted sampling frames - Subject to Professional Judgment. Review sample selection before execution.",
      },
    });
  } catch (error) {
    console.error("Push to Sampling error:", error);
    res.status(500).json({ error: "Failed to generate sampling frames" });
  }
});

router.post("/audit-program", requireAuth, requireMinRole("SENIOR"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const body = PushRequestSchema.parse(req.body);
    const userId = req.user!.id;
    const firmId = req.user!.firmId;

    if (!firmId) {
      return res.status(400).json({ error: "User not associated with a firm" });
    }

    const engagement = await prisma.engagement.findFirst({
      where: { id: body.engagementId, firmId },
    });

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    const auditProgramItems: Array<{
      fsHead: string;
      procedures: string[];
      testType: string;
    }> = [];

    const uniqueFsLines = new Set<string>();
    for (const item of body.mappingData || []) {
      if (item.fsLineItem) {
        uniqueFsLines.add(item.fsLineItem);
      }
    }

    const procedureTemplates: Record<string, string[]> = {
      "Revenue": ["ISA 240 - Revenue recognition fraud risk assessment", "Cutoff testing", "Analytical review"],
      "Cash": ["Bank reconciliation review", "Confirmation of bank balances", "Cutoff testing"],
      "Receivables": ["Confirmation procedures", "Subsequent receipts testing", "Allowance review"],
      "Inventory": ["Physical count observation", "Valuation testing", "NRV assessment"],
      "Payables": ["Supplier confirmation", "Search for unrecorded liabilities", "Cutoff testing"],
      "default": ["Substantive analytical procedures", "Test of details", "Documentation review"],
    };

    for (const fsLine of uniqueFsLines) {
      let procedures = procedureTemplates["default"];
      
      for (const [key, procs] of Object.entries(procedureTemplates)) {
        if (fsLine.toLowerCase().includes(key.toLowerCase())) {
          procedures = procs;
          break;
        }
      }

      auditProgramItems.push({
        fsHead: fsLine,
        procedures,
        testType: "TOD",
      });
    }

    await createAuditLog(body.engagementId, userId, "PUSH", "AUDIT_PROGRAM",
      null,
      { itemCount: auditProgramItems.length }
    );

    res.json({
      success: true,
      message: `Audit program generated: ${auditProgramItems.length} FS heads with procedures`,
      data: {
        items: auditProgramItems,
        totalProcedures: auditProgramItems.reduce((sum, i) => sum + i.procedures.length, 0),
        aiAssisted: true,
        note: "AI-Assisted - Subject to Professional Judgment",
      },
    });
  } catch (error) {
    console.error("Push to Audit Program error:", error);
    res.status(500).json({ error: "Failed to generate audit program" });
  }
});

router.post("/adjusted-fs", requireAuth, requireMinRole("MANAGER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const body = PushRequestSchema.parse(req.body);
    const userId = req.user!.id;
    const firmId = req.user!.firmId;

    if (!firmId) {
      return res.status(400).json({ error: "User not associated with a firm" });
    }

    if (body.approvalStatus !== "APPROVED" && !body.partnerOverride) {
      return res.status(400).json({ error: "Mapping must be APPROVED for Adjusted FS generation" });
    }

    const engagement = await prisma.engagement.findFirst({
      where: { id: body.engagementId, firmId },
    });

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    const adjustments = await prisma.fSHeadAdjustment.findMany({
      where: {
        workingPaper: { engagementId: body.engagementId },
        isPosted: true,
      },
      select: {
        adjustmentRef: true,
        adjustmentType: true,
        description: true,
        debitAccountCode: true,
        debitAccountName: true,
        debitAmount: true,
        creditAccountCode: true,
        creditAccountName: true,
        creditAmount: true,
        netImpact: true,
        fsImpact: true,
        isMaterial: true,
      },
    });

    const unadjustedFS: Record<string, { debit: number; credit: number }> = {};

    for (const item of body.mappingData || []) {
      if (item.fsLineItem) {
        if (!unadjustedFS[item.fsLineItem]) {
          unadjustedFS[item.fsLineItem] = { debit: 0, credit: 0 };
        }
        unadjustedFS[item.fsLineItem].debit += item.closingDebit || 0;
        unadjustedFS[item.fsLineItem].credit += item.closingCredit || 0;
      }
    }

    const adjustmentsByFsLine: Record<string, { debitTotal: number; creditTotal: number; count: number }> = {};

    for (const adj of adjustments) {
      const fsLine = adj.fsImpact || "Unclassified";
      if (!adjustmentsByFsLine[fsLine]) {
        adjustmentsByFsLine[fsLine] = { debitTotal: 0, creditTotal: 0, count: 0 };
      }
      adjustmentsByFsLine[fsLine].debitTotal += Number(adj.debitAmount) || 0;
      adjustmentsByFsLine[fsLine].creditTotal += Number(adj.creditAmount) || 0;
      adjustmentsByFsLine[fsLine].count++;
    }

    const adjustedFS: Record<string, {
      unadjustedDebit: number;
      unadjustedCredit: number;
      adjustmentDebit: number;
      adjustmentCredit: number;
      adjustedDebit: number;
      adjustedCredit: number;
      netBalance: number;
      adjustmentCount: number;
    }> = {};

    for (const [fsLine, values] of Object.entries(unadjustedFS)) {
      const adjs = adjustmentsByFsLine[fsLine] || { debitTotal: 0, creditTotal: 0, count: 0 };
      adjustedFS[fsLine] = {
        unadjustedDebit: values.debit,
        unadjustedCredit: values.credit,
        adjustmentDebit: adjs.debitTotal,
        adjustmentCredit: adjs.creditTotal,
        adjustedDebit: values.debit + adjs.debitTotal,
        adjustedCredit: values.credit + adjs.creditTotal,
        netBalance: (values.debit + adjs.debitTotal) - (values.credit + adjs.creditTotal),
        adjustmentCount: adjs.count,
      };
    }

    const bsLines: typeof adjustedFS = {};
    const plLines: typeof adjustedFS = {};

    for (const [fsLine, values] of Object.entries(adjustedFS)) {
      const { statementType } = determineStatementType(fsLine);
      if (statementType === "BALANCE_SHEET") {
        bsLines[fsLine] = values;
      } else {
        plLines[fsLine] = values;
      }
    }

    let totalBSAssets = 0;
    let totalBSLiabilitiesEquity = 0;
    
    for (const [key, values] of Object.entries(bsLines)) {
      const normalized = key.toLowerCase();
      const isAsset = normalized.includes("asset") || normalized.includes("receivable") ||
        normalized.includes("cash") || normalized.includes("inventory") ||
        normalized.includes("property");
      const isLiabilityEquity = normalized.includes("liabilit") || normalized.includes("payable") ||
        normalized.includes("equity") || normalized.includes("capital") ||
        normalized.includes("reserve");
      
      if (isAsset) {
        totalBSAssets += values.netBalance;
      } else if (isLiabilityEquity) {
        totalBSLiabilitiesEquity += Math.abs(values.netBalance);
      }
    }

    let totalPLIncome = 0;
    let totalPLExpenses = 0;
    
    for (const [key, values] of Object.entries(plLines)) {
      const normalized = key.toLowerCase();
      const isIncome = normalized.includes("revenue") || normalized.includes("income") ||
        normalized.includes("sales");
      const isExpense = normalized.includes("expense") || normalized.includes("cost") ||
        normalized.includes("depreciation");
      
      if (isIncome) {
        totalPLIncome += values.netBalance;
      } else if (isExpense) {
        totalPLExpenses += Math.abs(values.netBalance);
      }
    }

    const netProfit = totalPLIncome - totalPLExpenses;

    await createAuditLog(body.engagementId, userId, "PUSH", "ADJUSTED_FS",
      { unadjustedLineCount: Object.keys(unadjustedFS).length },
      { 
        adjustedLineCount: Object.keys(adjustedFS).length,
        adjustmentCount: adjustments.length,
        netProfit,
      }
    );

    res.json({
      success: true,
      message: `Adjusted Financial Statements generated with ${adjustments.length} adjustments applied`,
      data: {
        balanceSheet: {
          lineItems: bsLines,
          totalAssets: totalBSAssets,
          totalLiabilitiesEquity: totalBSLiabilitiesEquity,
          balanced: Math.abs(totalBSAssets - totalBSLiabilitiesEquity + netProfit) < 1,
        },
        incomeStatement: {
          lineItems: plLines,
          totalIncome: totalPLIncome,
          totalExpenses: totalPLExpenses,
          netProfit,
        },
        adjustmentsSummary: {
          totalAdjustments: adjustments.length,
          adjustmentsByFsLine,
          materialAdjustments: adjustments.filter(a => a.isMaterial).length,
        },
        snapshot: {
          generatedAt: new Date().toISOString(),
          generatedById: userId,
          status: "DRAFT",
          isaReference: "ISA 450, ISA 700",
        },
        aiAssisted: true,
        note: "AI-Assisted - Subject to Professional Judgment and Partner Review",
      },
    });
  } catch (error) {
    console.error("Push to Adjusted FS error:", error);
    res.status(500).json({ error: "Failed to generate Adjusted Financial Statements" });
  }
});

export default router;
