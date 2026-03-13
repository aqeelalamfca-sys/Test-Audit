import { Router, Response } from "express";
import { prisma } from "./db";
import { requireAuth, logAuditTrail, type AuthenticatedRequest } from "./auth";

const router = Router();

interface SourceDataSnapshot {
  revenue: number;
  totalAssets: number;
  totalEquity: number;
  profitBeforeTax: number;
  grossProfit: number;
  totalExpenses: number;
  priorYearRevenue: number | null;
  priorYearAssets: number | null;
  priorYearPBT: number | null;
  priorYearEquity: number | null;
  entityType: string | null;
  industry: string | null;
  engagementType: string | null;
  ownershipStructure: string | null;
  regulatoryCategory: string | null;
  tbImported: boolean;
  fsMapped: boolean;
  riskAssessmentDone: boolean;
  fraudRiskCount: number;
  significantRiskCount: number;
  goingConcernFlag: boolean;
  relatedPartyFlag: boolean;
  covenantFlag: boolean;
  publicInterestFlag: boolean;
  accountCount: number;
  snapshotDate: string;
}

interface BenchmarkRecommendation {
  recommended: string;
  recommendedValue: number;
  recommendedPercentage: number;
  recommendedRange: { min: number; max: number };
  justification: string;
  alternates: Array<{
    type: string;
    value: number;
    range: { min: number; max: number };
    reason: string;
  }>;
  warnings: string[];
}

interface QualitativeFactorItem {
  id: string;
  title: string;
  present: boolean;
  severity: "LOW" | "MODERATE" | "HIGH";
  explanation: string;
  impact: "NO_CHANGE" | "REDUCE_OM" | "REDUCE_PM" | "SET_SPECIFIC";
  isaRef: string;
}

interface SpecificMaterialityItem {
  id: string;
  area: string;
  fsHead: string;
  amount: number;
  rationale: string;
  linkedRiskId: string | null;
}

interface OverrideRecord {
  id: string;
  field: string;
  systemValue: number;
  overriddenValue: number;
  reason: string;
  effectOnTesting: string;
  userId: string;
  userName: string;
  userRole: string;
  timestamp: string;
  reverted: boolean;
  revertedAt: string | null;
  revertedBy: string | null;
}

const BENCHMARK_CONFIGS: Record<string, { name: string; min: number; max: number; default: number; description: string }> = {
  PBT: { name: "Profit Before Tax", min: 5, max: 10, default: 5, description: "Standard for profit-oriented entities with stable earnings" },
  REVENUE: { name: "Total Revenue", min: 0.5, max: 2, default: 1, description: "Appropriate when profit is volatile or entity is revenue-focused" },
  TOTAL_ASSETS: { name: "Total Assets", min: 0.5, max: 2, default: 1, description: "Suitable for asset-intensive industries or financial institutions" },
  EQUITY: { name: "Total Equity", min: 1, max: 5, default: 2, description: "Used when equity is primary stakeholder focus" },
  GROSS_PROFIT: { name: "Gross Profit", min: 2, max: 5, default: 3, description: "Used for trading entities with thin margins" },
  TOTAL_EXPENSES: { name: "Total Expenditure", min: 0.5, max: 2, default: 1, description: "Appropriate for NPOs, grant-funded, or government entities" },
};

function formatPKR(amount: number): string {
  return new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}

function calculateTotalsFromAccounts(accounts: Array<Record<string, unknown>>): {
  revenue: number; totalAssets: number; totalEquity: number; profitBeforeTax: number; grossProfit: number; totalExpenses: number;
} {
  let revenue = 0, totalAssets = 0, totalEquity = 0, totalIncome = 0, totalExpenses = 0, costOfSales = 0;
  for (const acc of accounts) {
    const balance = Number(acc.closingBalance) || 0;
    const nature = String(acc.nature || "").toUpperCase();
    const cls = String(acc.accountClass || "").toUpperCase();
    const grp = String(acc.tbGroup || "").toUpperCase();
    const fsLine = String(acc.fsLineItem || "").toUpperCase();
    const sign = nature === "CR" ? -1 : 1;
    const absBalance = Math.abs(balance);
    if (cls.includes("ASSET") || grp.includes("ASSET")) totalAssets += absBalance;
    if (cls.includes("EQUITY") || grp.includes("EQUITY") || fsLine.includes("EQUITY") || fsLine.includes("CAPITAL")) {
      totalEquity += balance * sign;
    }
    if (cls.includes("REVENUE") || cls.includes("INCOME") || grp.includes("REVENUE") || grp.includes("INCOME") || fsLine.includes("REVENUE") || fsLine.includes("SALES")) {
      if (!fsLine.includes("EXPENSE") && !fsLine.includes("COST")) {
        revenue += absBalance;
        totalIncome += absBalance;
      }
    }
    if (cls.includes("EXPENSE") || cls.includes("COST") || grp.includes("EXPENSE") || grp.includes("COST")) {
      totalExpenses += absBalance;
      if (fsLine.includes("COST OF SALES") || fsLine.includes("COST OF GOODS") || cls.includes("COST OF SALES")) {
        costOfSales += absBalance;
      }
    }
  }
  return { revenue, totalAssets, totalEquity, profitBeforeTax: totalIncome - totalExpenses, grossProfit: revenue - costOfSales, totalExpenses };
}

function recommendBenchmark(data: SourceDataSnapshot): BenchmarkRecommendation {
  const warnings: string[] = [];
  const alternates: BenchmarkRecommendation["alternates"] = [];
  let recommended = "PBT";
  let recommendedValue = data.profitBeforeTax;
  const isProfitable = data.profitBeforeTax > 0;
  const isLoss = data.profitBeforeTax < 0;
  const pbtVolatility = data.priorYearPBT !== null && data.priorYearPBT !== 0
    ? Math.abs((data.profitBeforeTax - data.priorYearPBT) / data.priorYearPBT) : 0;
  const isFinancial = data.industry && ["BANKING", "INSURANCE", "FINANCIAL_SERVICES", "NBFC", "MICROFINANCE"].includes(data.industry.toUpperCase());
  const isNPO = data.entityType && ["NPO", "NFP", "NGO", "TRUST", "SOCIETY", "SECTION42"].includes(data.entityType.toUpperCase());
  const isRegulated = data.regulatoryCategory && ["REGULATED", "LISTED", "PUBLIC_INTEREST"].includes(data.regulatoryCategory.toUpperCase());

  if (data.revenue === 0 && data.totalAssets === 0) {
    warnings.push("No financial data available — Trial Balance may not be imported.");
  }
  if (data.profitBeforeTax === 0) warnings.push("Profit Before Tax is zero — cannot use PBT as benchmark.");
  if (isLoss) warnings.push("Entity is loss-making — PBT is not a suitable benchmark.");
  if (pbtVolatility > 0.5 && isProfitable) warnings.push(`PBT volatility is ${(pbtVolatility * 100).toFixed(0)}% — profits are unstable.`);

  if (isNPO) {
    recommended = "TOTAL_EXPENSES";
    recommendedValue = data.totalExpenses;
  } else if (isFinancial) {
    recommended = "TOTAL_ASSETS";
    recommendedValue = data.totalAssets;
  } else if (isLoss) {
    recommended = data.revenue > 0 ? "REVENUE" : "TOTAL_ASSETS";
    recommendedValue = data.revenue > 0 ? data.revenue : data.totalAssets;
  } else if (isProfitable && pbtVolatility > 0.5) {
    recommended = "REVENUE";
    recommendedValue = data.revenue;
  } else if (isProfitable) {
    recommended = "PBT";
    recommendedValue = data.profitBeforeTax;
  } else {
    recommended = data.totalAssets > data.revenue ? "TOTAL_ASSETS" : "REVENUE";
    recommendedValue = data.totalAssets > data.revenue ? data.totalAssets : data.revenue;
  }

  const cfg = BENCHMARK_CONFIGS[recommended];
  const justifications: Record<string, string> = {
    PBT: `Profit Before Tax of ${formatPKR(data.profitBeforeTax)} selected as the entity is profit-making with stable earnings. PBT is the most commonly used benchmark per ISA 320.A4 as users of financial statements focus on profitability.`,
    REVENUE: `Revenue of ${formatPKR(data.revenue)} selected as ${isLoss ? "the entity is loss-making" : "PBT is volatile"}. Revenue provides a stable and meaningful benchmark when profits are unreliable.`,
    TOTAL_ASSETS: `Total Assets of ${formatPKR(data.totalAssets)} selected as ${isFinancial ? "the entity is a financial institution where users focus on the asset base" : "other benchmarks are not meaningful"}. Asset-based benchmarks are standard for capital-intensive and financial entities.`,
    EQUITY: `Total Equity of ${formatPKR(data.totalEquity)} selected as equity is the primary stakeholder focus for this entity type.`,
    GROSS_PROFIT: `Gross Profit of ${formatPKR(data.grossProfit)} selected for this trading entity. Gross profit reflects operational performance better than revenue for thin-margin businesses.`,
    TOTAL_EXPENSES: `Total Expenditure of ${formatPKR(data.totalExpenses)} selected as the entity is a not-for-profit organization. Expenditure is the most relevant benchmark for NPOs where users focus on how funds are utilized.`,
  };

  for (const [type, config] of Object.entries(BENCHMARK_CONFIGS)) {
    if (type === recommended) continue;
    let value = 0;
    switch (type) {
      case "PBT": value = data.profitBeforeTax; break;
      case "REVENUE": value = data.revenue; break;
      case "TOTAL_ASSETS": value = data.totalAssets; break;
      case "EQUITY": value = data.totalEquity; break;
      case "GROSS_PROFIT": value = data.grossProfit; break;
      case "TOTAL_EXPENSES": value = data.totalExpenses; break;
    }
    let reason = `${config.name} available at ${formatPKR(value)} but ${BENCHMARK_CONFIGS[recommended].name} is more appropriate for this entity.`;
    if (type === "PBT" && isLoss) reason = "Entity is loss-making; PBT is not a meaningful benchmark.";
    if (type === "PBT" && pbtVolatility > 0.5) reason = `PBT volatility of ${(pbtVolatility * 100).toFixed(0)}% makes it unreliable.`;
    alternates.push({ type, value, range: { min: config.min, max: config.max }, reason });
  }

  return {
    recommended,
    recommendedValue,
    recommendedPercentage: cfg.default,
    recommendedRange: { min: cfg.min, max: cfg.max },
    justification: justifications[recommended] || `${cfg.name} selected as the most appropriate benchmark.`,
    alternates,
    warnings,
  };
}

function calculateRiskAdjustments(
  basePercentage: number, sourceData: SourceDataSnapshot
): { adjustments: Array<{ factor: string; description: string; adjustment: number; applied: boolean; rationale: string }>; finalPercentage: number } {
  const adjustments: Array<{ factor: string; description: string; adjustment: number; applied: boolean; rationale: string }> = [];
  let total = 0;
  if (sourceData.fraudRiskCount > 0) {
    const adj = -0.5 * Math.min(sourceData.fraudRiskCount, 3);
    adjustments.push({ factor: "Fraud Risk", description: `${sourceData.fraudRiskCount} fraud risk(s) identified`, adjustment: adj, applied: true, rationale: "ISA 240 requires lower materiality when fraud risks are present" });
    total += adj;
  }
  if (sourceData.significantRiskCount > 2) {
    const adj = -0.3 * Math.min(sourceData.significantRiskCount - 2, 3);
    adjustments.push({ factor: "Significant Risks", description: `${sourceData.significantRiskCount} significant risks identified`, adjustment: adj, applied: true, rationale: "High number of significant risks warrants conservative materiality" });
    total += adj;
  }
  if (sourceData.publicInterestFlag) {
    adjustments.push({ factor: "Public Interest Entity", description: "Entity has public interest considerations", adjustment: -0.5, applied: true, rationale: "Wider stakeholder base requires lower materiality" });
    total += -0.5;
  }
  if (sourceData.goingConcernFlag) {
    adjustments.push({ factor: "Going Concern", description: "Going concern indicators identified", adjustment: -0.3, applied: true, rationale: "Going concern uncertainty increases inherent risk" });
    total += -0.3;
  }
  if (sourceData.covenantFlag) {
    adjustments.push({ factor: "Debt Covenants", description: "Debt covenant compliance is sensitive", adjustment: -0.2, applied: true, rationale: "Users focus on specific threshold compliance" });
    total += -0.2;
  }
  const final = Math.max(basePercentage + total, basePercentage * 0.4);
  return { adjustments, finalPercentage: Math.round(final * 100) / 100 };
}

const DEFAULT_QUALITATIVE_FACTORS: Omit<QualitativeFactorItem, "present" | "severity" | "explanation" | "impact">[] = [
  { id: "fraudRisk", title: "Fraud Risk Present", isaRef: "ISA 240" },
  { id: "goingConcern", title: "Going Concern Uncertainty", isaRef: "ISA 570" },
  { id: "regulatory", title: "Regulatory Reporting Requirements", isaRef: "ISA 250" },
  { id: "publicInterest", title: "Public Interest Entity", isaRef: "ISA 320.A4" },
  { id: "debtCovenant", title: "Debt Covenant Compliance", isaRef: "ISA 320.A6" },
  { id: "sensitiveDisclosures", title: "Sensitive Industry Disclosures", isaRef: "ISA 315" },
  { id: "relatedParty", title: "Related Party Sensitivity", isaRef: "ISA 550" },
  { id: "directorsRemuneration", title: "Directors' Remuneration Sensitivity", isaRef: "ISA 320.A10" },
  { id: "keyEstimates", title: "Key Management Estimates", isaRef: "ISA 540" },
  { id: "litigation", title: "Litigation / Contingent Liabilities", isaRef: "ISA 501" },
  { id: "grantRestrictions", title: "Grant / Donor Restrictions", isaRef: "ISA 800" },
  { id: "taxExposure", title: "Tax Exposure", isaRef: "ISA 320.A10" },
  { id: "priorMisstatements", title: "Prior Year Corrected/Uncorrected Misstatements", isaRef: "ISA 450" },
];

router.get("/:engagementId/source-data", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(400).json({ error: "User not associated with a firm" });

    const engagement = await prisma.engagement.findFirst({
      where: { id: engagementId, firmId },
      include: { client: true },
    });
    if (!engagement) return res.status(404).json({ error: "Engagement not found" });

    const coaAccounts = await prisma.coAAccount.findMany({ where: { engagementId } });
    const riskAssessments = await prisma.riskAssessment.findMany({ where: { engagementId } });
    const totals = calculateTotalsFromAccounts(coaAccounts);
    const fsLevelRisks = riskAssessments.map(r => (r.accountOrClass || "").toLowerCase());

    const snapshot: SourceDataSnapshot = {
      ...totals,
      priorYearRevenue: engagement.previousYearRevenue ? Number(engagement.previousYearRevenue) : null,
      priorYearAssets: null,
      priorYearPBT: null,
      priorYearEquity: null,
      entityType: engagement.client?.entityType || null,
      industry: engagement.client?.industry || null,
      engagementType: engagement.engagementType || null,
      ownershipStructure: engagement.client?.ownershipStructure || null,
      regulatoryCategory: engagement.client?.regulatoryCategory || null,
      tbImported: coaAccounts.length > 0,
      fsMapped: coaAccounts.some(a => a.fsLineItem !== null && a.fsLineItem !== ""),
      riskAssessmentDone: riskAssessments.length > 0,
      fraudRiskCount: riskAssessments.filter(r => r.isFraudRisk).length,
      significantRiskCount: riskAssessments.filter(r => r.isSignificantRisk).length,
      goingConcernFlag: fsLevelRisks.some(r => r.includes("going concern") || r.includes("liquidity")),
      relatedPartyFlag: fsLevelRisks.some(r => r.includes("related party")),
      covenantFlag: fsLevelRisks.some(r => r.includes("covenant") || r.includes("borrowing")),
      publicInterestFlag: engagement.client?.regulatoryCategory === "PUBLIC_INTEREST" || engagement.client?.entityType === "PUBLIC",
      accountCount: coaAccounts.length,
      snapshotDate: new Date().toISOString(),
    };

    const recommendation = recommendBenchmark(snapshot);
    const existingSet = await prisma.materialitySet.findFirst({
      where: { engagementId },
      orderBy: { versionId: "desc" },
      include: {
        preparedBy: { select: { id: true, fullName: true, role: true } },
        reviewedBy: { select: { id: true, fullName: true, role: true } },
        approvedBy: { select: { id: true, fullName: true, role: true } },
        lockedBy: { select: { id: true, fullName: true, role: true } },
      },
    });

    let isStale = false;
    let staleReason = "";
    if (existingSet && existingSet.sourceDataSnapshot) {
      const prev = existingSet.sourceDataSnapshot as unknown as SourceDataSnapshot;
      if (Math.abs(prev.revenue - snapshot.revenue) > 1 || Math.abs(prev.totalAssets - snapshot.totalAssets) > 1 ||
          Math.abs(prev.profitBeforeTax - snapshot.profitBeforeTax) > 1) {
        isStale = true;
        staleReason = "Source financial data has changed since materiality was last calculated. Reanalysis is recommended.";
      }
    }

    res.json({
      sourceData: snapshot,
      recommendation,
      existingSet,
      isStale,
      staleReason,
      qualitativeFactorDefaults: DEFAULT_QUALITATIVE_FACTORS,
      engagementInfo: {
        name: engagement.engagementCode || engagement.id,
        clientName: engagement.client?.name || "Unknown",
        financialYear: engagement.auditEndDate ? new Date(engagement.auditEndDate).getFullYear() : null,
        periodStart: engagement.auditStartDate,
        periodEnd: engagement.auditEndDate,
      },
    });
  } catch (error) {
    console.error("ISA 320 Source Data Error:", error);
    res.status(500).json({ error: "Failed to fetch source data", details: error instanceof Error ? error.message : "Unknown error" });
  }
});

router.post("/:engagementId/calculate", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(400).json({ error: "User not associated with a firm" });

    const { benchmarkType, benchmarkAmount, percentApplied, pmPercentage = 75, trivialPercentage = 5, sourceData, qualitativeFactors, riskAdjustments: clientRiskAdj } = req.body;
    if (!benchmarkType || benchmarkAmount === undefined || !percentApplied) {
      return res.status(400).json({ error: "benchmarkType, benchmarkAmount, and percentApplied are required" });
    }

    const engagement = await prisma.engagement.findFirst({ where: { id: engagementId, firmId } });
    if (!engagement) return res.status(404).json({ error: "Engagement not found" });

    const om = Math.round(Number(benchmarkAmount) * (Number(percentApplied) / 100));
    const pm = Math.round(om * (Number(pmPercentage) / 100));
    const trivial = Math.round(om * (Number(trivialPercentage) / 100));

    let riskAdj = clientRiskAdj;
    if (!riskAdj && sourceData) {
      riskAdj = calculateRiskAdjustments(Number(percentApplied), sourceData);
    }

    res.json({
      benchmarkType,
      benchmarkAmount: Number(benchmarkAmount),
      percentApplied: Number(percentApplied),
      overallMateriality: om,
      performanceMateriality: pm,
      trivialThreshold: trivial,
      pmPercentage: Number(pmPercentage),
      trivialPercentage: Number(trivialPercentage),
      formulas: {
        overall: `${formatPKR(Number(benchmarkAmount))} × ${percentApplied}% = ${formatPKR(om)}`,
        performance: `${formatPKR(om)} × ${pmPercentage}% = ${formatPKR(pm)}`,
        trivial: `${formatPKR(om)} × ${trivialPercentage}% = ${formatPKR(trivial)}`,
      },
      riskAdjustments: riskAdj,
    });
  } catch (error) {
    console.error("ISA 320 Calculate Error:", error);
    res.status(500).json({ error: "Failed to calculate materiality" });
  }
});

router.post("/:engagementId/save", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const userId = req.user!.id;
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(400).json({ error: "User not associated with a firm" });

    const engagement = await prisma.engagement.findFirst({ where: { id: engagementId, firmId } });
    if (!engagement) return res.status(404).json({ error: "Engagement not found" });

    const {
      benchmarkType, benchmarkAmount, percentApplied, overallMateriality, performanceMateriality,
      trivialThreshold, pmPercentage, trivialPercentage, rationale, benchmarkJustification,
      sourceDataSnapshot, qualitativeFactors, riskAdjustments, specificMateriality,
      overrideHistory, stepProgress,
    } = req.body;

    if (!benchmarkType || overallMateriality === undefined) {
      return res.status(400).json({ error: "benchmarkType and overallMateriality are required" });
    }

    const existing = await prisma.materialitySet.findFirst({
      where: { engagementId, status: { not: "SUPERSEDED" } },
      orderBy: { versionId: "desc" },
    });

    if (existing && existing.isLocked) {
      return res.status(403).json({ error: "Materiality is locked. Unlock or create a new version to make changes." });
    }

    let result;
    if (existing) {
      result = await prisma.materialitySet.update({
        where: { id: existing.id },
        data: {
          benchmarkType, benchmarkAmount: Number(benchmarkAmount),
          percentApplied: Number(percentApplied),
          overallMateriality: Number(overallMateriality),
          performanceMateriality: Number(performanceMateriality),
          trivialThreshold: Number(trivialThreshold),
          pmPercentage: pmPercentage != null ? Number(pmPercentage) : undefined,
          trivialPercentage: trivialPercentage != null ? Number(trivialPercentage) : undefined,
          rationale, benchmarkJustification,
          sourceDataSnapshot: sourceDataSnapshot || undefined,
          qualitativeFactors: qualitativeFactors || undefined,
          riskAdjustments: riskAdjustments || undefined,
          specificMateriality: specificMateriality || undefined,
          overrideHistory: overrideHistory || undefined,
          stepProgress: stepProgress || undefined,
          isStale: false, staleReason: null,
          preparedById: userId, preparedAt: new Date(),
          updatedAt: new Date(),
        },
      });
    } else {
      result = await prisma.materialitySet.create({
        data: {
          engagementId, versionId: 1, status: "DRAFT",
          benchmarkType, benchmarkAmount: Number(benchmarkAmount),
          percentApplied: Number(percentApplied),
          overallMateriality: Number(overallMateriality),
          performanceMateriality: Number(performanceMateriality),
          trivialThreshold: Number(trivialThreshold),
          pmPercentage: pmPercentage != null ? Number(pmPercentage) : 75,
          trivialPercentage: trivialPercentage != null ? Number(trivialPercentage) : 5,
          rationale, benchmarkJustification,
          sourceDataSnapshot: sourceDataSnapshot || undefined,
          qualitativeFactors: qualitativeFactors || undefined,
          riskAdjustments: riskAdjustments || undefined,
          specificMateriality: specificMateriality || undefined,
          overrideHistory: overrideHistory || undefined,
          stepProgress: stepProgress || undefined,
          preparedById: userId, preparedAt: new Date(),
        },
      });
    }

    logAuditTrail(
      userId, "MATERIALITY_SAVED", "MaterialitySet", result.id,
      undefined, JSON.stringify({ benchmarkType, overallMateriality: Number(overallMateriality), version: result.versionId }),
      engagementId
    ).catch(err => console.error("Audit trail error:", err));

    res.json({ success: true, materialitySet: result });
  } catch (error) {
    console.error("ISA 320 Save Error:", error);
    res.status(500).json({ error: "Failed to save materiality", details: error instanceof Error ? error.message : "Unknown error" });
  }
});

router.post("/:engagementId/partner-override", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const userId = req.user!.id;
    const userRole = req.user!.role;
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(400).json({ error: "User not associated with a firm" });

    if (!["PARTNER", "FIRM_ADMIN"].includes(userRole)) {
      return res.status(403).json({ error: "Only partners can apply materiality overrides" });
    }

    const { overrides, reason, effectOnTesting } = req.body;
    if (!overrides || !reason) {
      return res.status(400).json({ error: "overrides and reason are required" });
    }

    const existing = await prisma.materialitySet.findFirst({
      where: { engagementId, status: { not: "SUPERSEDED" } },
      orderBy: { versionId: "desc" },
    });
    if (!existing) return res.status(404).json({ error: "No materiality set found to override" });
    if (existing.isLocked) return res.status(403).json({ error: "Cannot override locked materiality" });

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { fullName: true, role: true } });
    const prevHistory = (existing.overrideHistory as OverrideRecord[] | null) || [];
    const newRecords: OverrideRecord[] = [];

    const updateData: Record<string, unknown> = {};
    for (const ov of overrides) {
      const record: OverrideRecord = {
        id: crypto.randomUUID(),
        field: ov.field,
        systemValue: ov.systemValue,
        overriddenValue: ov.overriddenValue,
        reason, effectOnTesting: effectOnTesting || "",
        userId, userName: user?.fullName || "", userRole: user?.role || userRole,
        timestamp: new Date().toISOString(), reverted: false, revertedAt: null, revertedBy: null,
      };
      newRecords.push(record);
      if (ov.field === "overallMateriality") updateData.overallMateriality = Number(ov.overriddenValue);
      if (ov.field === "performanceMateriality") updateData.performanceMateriality = Number(ov.overriddenValue);
      if (ov.field === "trivialThreshold") updateData.trivialThreshold = Number(ov.overriddenValue);
    }

    updateData.overrideHistory = [...prevHistory, ...newRecords];
    updateData.approvedById = userId;
    updateData.approvedAt = new Date();
    updateData.status = "APPROVED";

    const result = await prisma.materialitySet.update({ where: { id: existing.id }, data: updateData });

    logAuditTrail(
      userId, "MATERIALITY_OVERRIDE", "MaterialitySet", result.id,
      undefined, JSON.stringify({ overrides, reason }),
      engagementId
    ).catch(err => console.error("Audit trail error:", err));

    res.json({ success: true, materialitySet: result });
  } catch (error) {
    console.error("ISA 320 Override Error:", error);
    res.status(500).json({ error: "Failed to apply partner override" });
  }
});

router.post("/:engagementId/revert-override", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const userId = req.user!.id;
    const userRole = req.user!.role;
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(400).json({ error: "User not associated with a firm" });
    if (!["PARTNER", "FIRM_ADMIN"].includes(userRole)) {
      return res.status(403).json({ error: "Only partners can revert overrides" });
    }

    const { overrideId } = req.body;
    if (!overrideId) return res.status(400).json({ error: "overrideId is required" });

    const existing = await prisma.materialitySet.findFirst({
      where: { engagementId, status: { not: "SUPERSEDED" } },
      orderBy: { versionId: "desc" },
    });
    if (!existing) return res.status(404).json({ error: "No materiality set found" });
    if (existing.isLocked) return res.status(403).json({ error: "Cannot revert override on locked materiality" });

    const history = (existing.overrideHistory as OverrideRecord[] | null) || [];
    const target = history.find(h => h.id === overrideId);
    if (!target) return res.status(404).json({ error: "Override record not found" });

    target.reverted = true;
    target.revertedAt = new Date().toISOString();
    target.revertedBy = userId;

    const updateData: Record<string, unknown> = { overrideHistory: history };
    if (target.field === "overallMateriality") updateData.overallMateriality = Number(target.systemValue);
    if (target.field === "performanceMateriality") updateData.performanceMateriality = Number(target.systemValue);
    if (target.field === "trivialThreshold") updateData.trivialThreshold = Number(target.systemValue);

    const result = await prisma.materialitySet.update({ where: { id: existing.id }, data: updateData });

    logAuditTrail(
      userId, "MATERIALITY_OVERRIDE_REVERTED", "MaterialitySet", result.id,
      undefined, JSON.stringify({ overrideId, field: target.field, revertedTo: target.systemValue }),
      engagementId
    ).catch(err => console.error("Audit trail error:", err));

    res.json({ success: true, materialitySet: result });
  } catch (error) {
    console.error("ISA 320 Revert Override Error:", error);
    res.status(500).json({ error: "Failed to revert override" });
  }
});

router.post("/:engagementId/finalize", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const userId = req.user!.id;
    const userRole = req.user!.role;
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(400).json({ error: "User not associated with a firm" });

    const { action } = req.body;

    const existing = await prisma.materialitySet.findFirst({
      where: { engagementId, status: { not: "SUPERSEDED" } },
      orderBy: { versionId: "desc" },
    });
    if (!existing) return res.status(404).json({ error: "No materiality set found" });

    const updateData: Record<string, unknown> = {};

    if (action === "submit_review") {
      updateData.status = "PENDING_REVIEW";
    } else if (action === "review") {
      if (!["SENIOR", "MANAGER", "PARTNER", "FIRM_ADMIN"].includes(userRole)) {
        return res.status(403).json({ error: "Insufficient role to review" });
      }
      updateData.status = "PENDING_APPROVAL";
      updateData.reviewedById = userId;
      updateData.reviewedAt = new Date();
    } else if (action === "approve") {
      if (!["PARTNER", "FIRM_ADMIN"].includes(userRole)) {
        return res.status(403).json({ error: "Only partners can approve materiality" });
      }
      updateData.status = "APPROVED";
      updateData.approvedById = userId;
      updateData.approvedAt = new Date();
    } else if (action === "lock") {
      if (!["PARTNER", "FIRM_ADMIN"].includes(userRole)) {
        return res.status(403).json({ error: "Only partners can lock materiality" });
      }
      if (existing.status !== "APPROVED") {
        return res.status(400).json({ error: "Materiality must be approved before locking" });
      }
      updateData.status = "LOCKED";
      updateData.isLocked = true;
      updateData.lockedAt = new Date();
      updateData.lockedById = userId;
    } else if (action === "unlock") {
      if (!["PARTNER", "FIRM_ADMIN"].includes(userRole)) {
        return res.status(403).json({ error: "Only partners can unlock materiality" });
      }
      updateData.status = "APPROVED";
      updateData.isLocked = false;
      updateData.lockedAt = null;
      updateData.lockedById = null;
    } else {
      return res.status(400).json({ error: "Invalid action. Use: submit_review, review, approve, lock, unlock" });
    }

    const result = await prisma.materialitySet.update({ where: { id: existing.id }, data: updateData });

    logAuditTrail(
      userId, `MATERIALITY_${action.toUpperCase()}`, "MaterialitySet", result.id,
      JSON.stringify({ status: existing.status }), JSON.stringify({ status: updateData.status }),
      engagementId
    ).catch(err => console.error("Audit trail error:", err));

    res.json({ success: true, materialitySet: result });
  } catch (error) {
    console.error("ISA 320 Finalize Error:", error);
    res.status(500).json({ error: "Failed to finalize materiality" });
  }
});

router.get("/:engagementId/memo", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(400).json({ error: "User not associated with a firm" });

    const engagement = await prisma.engagement.findFirst({
      where: { id: engagementId, firmId },
      include: { client: true },
    });
    if (!engagement) return res.status(404).json({ error: "Engagement not found" });

    const matSet = await prisma.materialitySet.findFirst({
      where: { engagementId, status: { not: "SUPERSEDED" } },
      orderBy: { versionId: "desc" },
      include: {
        preparedBy: { select: { fullName: true, role: true } },
        reviewedBy: { select: { fullName: true, role: true } },
        approvedBy: { select: { fullName: true, role: true } },
      },
    });
    if (!matSet) return res.status(404).json({ error: "No materiality set found" });

    const source = matSet.sourceDataSnapshot as SourceDataSnapshot | null;
    const quals = (matSet.qualitativeFactors as QualitativeFactorItem[] | null) || [];
    const specifics = (matSet.specificMateriality as SpecificMaterialityItem[] | null) || [];
    const overrides = (matSet.overrideHistory as OverrideRecord[] | null) || [];
    const cfg = BENCHMARK_CONFIGS[matSet.benchmarkType] || BENCHMARK_CONFIGS.PBT;
    const activeOverrides = overrides.filter(o => !o.reverted);

    const memo = {
      title: "ISA 320 — Planning Materiality Memo",
      engagementDetails: {
        engagementName: engagement.engagementCode || engagement.id,
        clientName: engagement.client?.name || "Unknown",
        financialYearEnd: engagement.auditEndDate ? new Date(engagement.auditEndDate).toLocaleDateString("en-GB") : "N/A",
        periodStart: engagement.auditStartDate ? new Date(engagement.auditStartDate).toLocaleDateString("en-GB") : "N/A",
        periodEnd: engagement.auditEndDate ? new Date(engagement.auditEndDate).toLocaleDateString("en-GB") : "N/A",
        entityType: engagement.client?.entityType || "N/A",
        industry: engagement.client?.industry || "N/A",
      },
      sourceFinancialData: source ? {
        revenue: formatPKR(source.revenue),
        profitBeforeTax: formatPKR(source.profitBeforeTax),
        totalAssets: formatPKR(source.totalAssets),
        totalEquity: formatPKR(source.totalEquity),
        grossProfit: formatPKR(source.grossProfit),
        totalExpenses: formatPKR(source.totalExpenses),
        priorYearPBT: source.priorYearPBT ? formatPKR(source.priorYearPBT) : "N/A",
      } : null,
      benchmarkSelection: {
        selectedBenchmark: cfg.name,
        benchmarkValue: formatPKR(Number(matSet.benchmarkAmount)),
        percentageApplied: `${matSet.percentApplied}%`,
        acceptableRange: `${cfg.min}% - ${cfg.max}%`,
        rationale: matSet.benchmarkJustification || matSet.rationale || "As determined by the engagement team.",
      },
      materialityCalculation: {
        overallMateriality: formatPKR(Number(matSet.overallMateriality)),
        formula: `${cfg.name} ${formatPKR(Number(matSet.benchmarkAmount))} × ${matSet.percentApplied}%`,
        performanceMateriality: formatPKR(Number(matSet.performanceMateriality)),
        pmBasis: `${matSet.pmPercentage || 75}% of Overall Materiality`,
        trivialThreshold: formatPKR(Number(matSet.trivialThreshold)),
        trivialBasis: `${matSet.trivialPercentage || 5}% of Overall Materiality`,
      },
      qualitativeFactors: quals.filter(q => q.present).map(q => ({
        factor: q.title,
        severity: q.severity,
        explanation: q.explanation,
        impact: q.impact,
        isaReference: q.isaRef,
      })),
      specificMateriality: specifics.map(s => ({
        area: s.area,
        amount: formatPKR(s.amount),
        rationale: s.rationale,
      })),
      partnerOverride: activeOverrides.length > 0 ? {
        hasOverride: true,
        overrides: activeOverrides.map(o => ({
          field: o.field,
          systemValue: formatPKR(o.systemValue),
          overriddenValue: formatPKR(o.overriddenValue),
          reason: o.reason,
          approvedBy: o.userName,
          date: new Date(o.timestamp).toLocaleDateString("en-GB"),
        })),
      } : { hasOverride: false, overrides: [] },
      signOff: {
        preparedBy: matSet.preparedBy?.fullName || "N/A",
        preparedAt: matSet.preparedAt ? new Date(matSet.preparedAt).toLocaleDateString("en-GB") : "N/A",
        reviewedBy: matSet.reviewedBy?.fullName || "N/A",
        reviewedAt: matSet.reviewedAt ? new Date(matSet.reviewedAt).toLocaleDateString("en-GB") : "N/A",
        approvedBy: matSet.approvedBy?.fullName || "N/A",
        approvedAt: matSet.approvedAt ? new Date(matSet.approvedAt).toLocaleDateString("en-GB") : "N/A",
      },
      isaReferences: [
        "ISA 320.10 — Materiality in planning and performing an audit",
        "ISA 320.11 — Performance materiality for risk assessment",
        "ISA 320.A3 — Benchmarks for determining materiality",
        "ISA 320.A4 — Percentage ranges for benchmarks",
        "ISA 450.A2 — Clearly trivial threshold",
        "ISA 450.5 — Accumulating identified misstatements",
      ],
      conclusion: `Based on our assessment, overall materiality for the audit of ${engagement.client?.name || "the entity"} ` +
        `for the period ending ${engagement.auditEndDate ? new Date(engagement.auditEndDate).toLocaleDateString("en-GB") : "N/A"} ` +
        `has been determined at ${formatPKR(Number(matSet.overallMateriality))} using ${cfg.name} as the benchmark. ` +
        `Performance materiality has been set at ${formatPKR(Number(matSet.performanceMateriality))} and the clearly trivial ` +
        `threshold at ${formatPKR(Number(matSet.trivialThreshold))}. These levels will be applied throughout the audit for ` +
        `risk assessment, sampling, analytical procedures, and evaluation of misstatements.`,
      status: matSet.status,
      version: matSet.versionId,
      generatedAt: new Date().toISOString(),
    };

    res.json(memo);
  } catch (error) {
    console.error("ISA 320 Memo Error:", error);
    res.status(500).json({ error: "Failed to generate memo" });
  }
});

router.post("/:engagementId/push-downstream", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const userId = req.user!.id;
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(400).json({ error: "User not associated with a firm" });

    const matSet = await prisma.materialitySet.findFirst({
      where: { engagementId, status: { in: ["APPROVED", "LOCKED"] } },
      orderBy: { versionId: "desc" },
    });
    if (!matSet) return res.status(400).json({ error: "No approved/locked materiality to push downstream" });

    const om = Number(matSet.overallMateriality);
    const pm = Number(matSet.performanceMateriality);
    const trivial = Number(matSet.trivialThreshold);

    const coaAccounts = await prisma.coAAccount.findMany({ where: { engagementId } });
    const significantAccounts = coaAccounts
      .filter(a => Math.abs(Number(a.closingBalance)) > om)
      .map(a => ({ id: a.id, name: a.accountName, balance: Number(a.closingBalance), percentOfOM: Math.round((Math.abs(Number(a.closingBalance)) / om) * 100) }));

    const fsHeadWPs = await prisma.fSHeadWorkingPaper.findMany({ where: { engagementId } });
    let allocationsUpdated = 0;
    for (const wp of fsHeadWPs) {
      const balance = Number(wp.currentBalance) || 0;
      const isSignificant = Math.abs(balance) > om;
      const allocatedPM = isSignificant ? pm : pm * 0.5;
      try {
        await prisma.materialityAllocation.upsert({
          where: { engagementId_fsHeadId: { engagementId, fsHeadId: wp.id } },
          update: { allocatedPM, trivialAmount: trivial, materialityId: matSet.id, rationale: `Auto-allocated from ISA 320 v${matSet.versionId}` },
          create: { engagementId, fsHeadId: wp.id, materialityId: matSet.id, allocatedPM, trivialAmount: trivial, rationale: `Auto-allocated from ISA 320 v${matSet.versionId}` },
        });
        allocationsUpdated++;
      } catch {
        // skip if relation constraints fail
      }
    }

    logAuditTrail(
      userId, "MATERIALITY_PUSHED_DOWNSTREAM", "MaterialitySet", matSet.id,
      undefined, JSON.stringify({ significantAccounts: significantAccounts.length, allocationsUpdated }),
      engagementId
    ).catch(err => console.error("Audit trail error:", err));

    res.json({
      success: true,
      significantAccounts,
      allocationsUpdated,
      thresholds: {
        overallMateriality: om,
        performanceMateriality: pm,
        trivialThreshold: trivial,
        investigationThreshold: Math.round(pm * 0.5),
        jeTestingThreshold: trivial,
      },
    });
  } catch (error) {
    console.error("ISA 320 Push Downstream Error:", error);
    res.status(500).json({ error: "Failed to push materiality downstream" });
  }
});

router.post("/:engagementId/analyze", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(400).json({ error: "User not associated with a firm" });

    const engagement = await prisma.engagement.findFirst({
      where: { id: engagementId, firmId },
      include: { client: true },
    });
    if (!engagement) return res.status(404).json({ error: "Engagement not found" });

    const coaAccounts = await prisma.coAAccount.findMany({ where: { engagementId } });
    const riskAssessments = await prisma.riskAssessment.findMany({ where: { engagementId } });
    const totals = calculateTotalsFromAccounts(coaAccounts);
    const fsLevelRisks = riskAssessments.map(r => (r.accountOrClass || "").toLowerCase());

    const snapshot: SourceDataSnapshot = {
      ...totals,
      priorYearRevenue: engagement.previousYearRevenue ? Number(engagement.previousYearRevenue) : null,
      priorYearAssets: null, priorYearPBT: null, priorYearEquity: null,
      entityType: engagement.client?.entityType || null,
      industry: engagement.client?.industry || null,
      engagementType: engagement.engagementType || null,
      ownershipStructure: engagement.client?.ownershipStructure || null,
      regulatoryCategory: engagement.client?.regulatoryCategory || null,
      tbImported: coaAccounts.length > 0,
      fsMapped: coaAccounts.some(a => a.fsLineItem !== null && a.fsLineItem !== ""),
      riskAssessmentDone: riskAssessments.length > 0,
      fraudRiskCount: riskAssessments.filter(r => r.isFraudRisk).length,
      significantRiskCount: riskAssessments.filter(r => r.isSignificantRisk).length,
      goingConcernFlag: fsLevelRisks.some(r => r.includes("going concern") || r.includes("liquidity")),
      relatedPartyFlag: fsLevelRisks.some(r => r.includes("related party")),
      covenantFlag: fsLevelRisks.some(r => r.includes("covenant") || r.includes("borrowing")),
      publicInterestFlag: engagement.client?.regulatoryCategory === "PUBLIC_INTEREST" || engagement.client?.entityType === "PUBLIC",
      accountCount: coaAccounts.length,
      snapshotDate: new Date().toISOString(),
    };

    const recommendation = recommendBenchmark(snapshot);
    const riskAdj = calculateRiskAdjustments(recommendation.recommendedPercentage, snapshot);
    const om = Math.round(recommendation.recommendedValue * (riskAdj.finalPercentage / 100));
    const hasHighRisk = snapshot.fraudRiskCount > 0 || snapshot.significantRiskCount > 3;
    const pmPct = hasHighRisk ? 65 : 75;
    const trivialPct = hasHighRisk ? 3 : 5;
    const pm = Math.round(om * (pmPct / 100));
    const trivial = Math.round(om * (trivialPct / 100));

    const significantFSHeads = coaAccounts
      .filter(acc => Math.abs(Number(acc.closingBalance)) > om)
      .map(acc => ({
        accountName: acc.accountName,
        balance: Number(acc.closingBalance),
        percentOfMateriality: Math.round((Math.abs(Number(acc.closingBalance)) / om) * 100),
        riskRating: Math.abs(Number(acc.closingBalance)) > om * 2 ? "HIGH" : "MEDIUM",
      }))
      .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance))
      .slice(0, 20);

    const result = {
      engagementId,
      analysisTimestamp: new Date().toISOString(),
      step1_dataIngestion: snapshot,
      step2_benchmarkSelection: {
        selectedBenchmark: recommendation.recommended,
        benchmarkValue: recommendation.recommendedValue,
        percentageRange: recommendation.recommendedRange,
        justification: recommendation.justification,
        alternativeBenchmarks: recommendation.alternates,
      },
      step3_riskAdjustedPercentage: {
        basePercentage: recommendation.recommendedPercentage,
        adjustments: riskAdj.adjustments,
        finalPercentage: riskAdj.finalPercentage,
      },
      step4_materialityLevels: {
        overallMateriality: om,
        performanceMateriality: pm,
        performanceMaterialityPercentage: pmPct,
        trivialThreshold: trivial,
        trivialThresholdPercentage: trivialPct,
        calculationFormulas: {
          overall: `${formatPKR(recommendation.recommendedValue)} × ${riskAdj.finalPercentage}% = ${formatPKR(om)}`,
          performance: `${formatPKR(om)} × ${pmPct}% = ${formatPKR(pm)}`,
          trivial: `${formatPKR(om)} × ${trivialPct}% = ${formatPKR(trivial)}`,
        },
      },
      step5_qualitativeFactors: {
        factors: DEFAULT_QUALITATIVE_FACTORS.map(f => ({
          ...f,
          present: f.id === "fraudRisk" ? snapshot.fraudRiskCount > 0 :
                   f.id === "goingConcern" ? snapshot.goingConcernFlag :
                   f.id === "publicInterest" ? snapshot.publicInterestFlag :
                   f.id === "relatedParty" ? snapshot.relatedPartyFlag :
                   f.id === "debtCovenant" ? snapshot.covenantFlag : false,
          severity: "LOW" as const,
          explanation: "",
          impact: "NO_CHANGE" as const,
        })),
      },
      step6_riskAssessmentLinkage: {
        significantFSHeads,
        samplingParameters: {
          suggestedConfidenceLevel: hasHighRisk ? 95 : 90,
          tolerableMisstatement: pm,
          expectedError: Math.round(pm * 0.1),
        },
        thresholds: {
          investigationThreshold: Math.round(pm * 0.5),
          jeTestingThreshold: trivial,
        },
      },
      step8_documentation: {
        benchmarkSelectionRationale: recommendation.justification,
      },
    };

    res.json(result);
  } catch (error) {
    console.error("ISA 320 Analysis Error:", error);
    res.status(500).json({ error: "Failed to perform materiality analysis" });
  }
});

export default router;
