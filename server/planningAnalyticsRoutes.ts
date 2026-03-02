import { Router, Response } from "express";
import { prisma } from "./db";
import { requireAuth, type AuthenticatedRequest } from "./auth";
import type { 
  PlanningAnalyticsResult, 
  FsHeadExpectation, 
  TrendAnalysisItem, 
  RatioAnalysisItem,
  SignificantFluctuation,
  RiskMatrixUpdate,
  AuditStrategyImpact
} from "../shared/models/planningAnalyticsTypes";

const router = Router();

const FS_HEAD_LABELS: Record<string, string> = {
  CASH_EQUIVALENTS: "Cash and Cash Equivalents",
  TRADE_RECEIVABLES: "Trade Receivables",
  INVENTORIES: "Inventories",
  PPE: "Property, Plant & Equipment",
  INTANGIBLE_ASSETS: "Intangible Assets",
  TRADE_PAYABLES: "Trade Payables",
  SHORT_TERM_BORROWINGS: "Short-term Borrowings",
  LONG_TERM_BORROWINGS: "Long-term Borrowings",
  SHARE_CAPITAL: "Share Capital",
  RETAINED_EARNINGS: "Retained Earnings",
  REVENUE: "Revenue",
  COST_OF_SALES: "Cost of Sales",
  ADMINISTRATIVE_EXPENSES: "Administrative Expenses",
  FINANCE_COSTS: "Finance Costs",
  TAX_EXPENSE: "Tax Expense",
};

const ASSERTIONS = [
  "Existence/Occurrence",
  "Completeness",
  "Rights & Obligations",
  "Valuation/Accuracy",
  "Cut-off",
  "Classification",
  "Presentation & Disclosure"
];

function determineStatus(movementPct: number, materiality: number, balance: number): 'Expected' | 'Requires Explanation' | 'Risk-Indicative' {
  const absMovement = Math.abs(movementPct);
  if (absMovement > 50 || Math.abs(balance) > materiality * 2) return 'Risk-Indicative';
  if (absMovement > 20 || Math.abs(balance) > materiality) return 'Requires Explanation';
  return 'Expected';
}

function generateRationale(fsHeadKey: string, basis: string, currentBalance: number, priorBalance: number): string {
  const movement = currentBalance - priorBalance;
  const movementPct = priorBalance !== 0 ? ((movement / Math.abs(priorBalance)) * 100).toFixed(1) : 'N/A';
  
  const rationales: Record<string, string> = {
    "Prior year trend": `[HEURISTIC - Requires Validation] Based on historical trend analysis. Actual expectation should be corroborated with client forecasts or industry data before reaching conclusions per ISA 520.`,
    "Budget": `[HEURISTIC - Requires Validation] Expected balance estimated from industry growth rates. Auditor should obtain and compare to management's approved budget for validation per ISA 520.`,
    "Industry norm": `[HEURISTIC - Requires Validation] Expected balance benchmarked against standard industry growth rates. Auditor should validate against actual industry benchmarks and entity-specific factors per ISA 520.`,
    "Analytical calculation": `[HEURISTIC - Requires Validation] Derived from standard account relationships. Auditor should verify against actual business factors and management explanations per ISA 520.`,
    "Management representation": `[HEURISTIC - Requires Validation] Preliminary estimate requiring validation through inquiry of management and corroboration per ISA 520.`
  };
  
  return rationales[basis] || `[HEURISTIC - Requires Validation] Expected balance based on ${basis} analysis. Requires auditor validation before conclusions per ISA 520.`;
}

function calculateExpectedBalance(fsHeadKey: string, currentBalance: number, priorBalance: number, movementPct: number): { basis: string; expectedBalance: number } {
  const INDUSTRY_GROWTH_RATES: Record<string, number> = {
    REVENUE: 0.05,
    COST_OF_SALES: 0.04,
    ADMINISTRATIVE_EXPENSES: 0.03,
    TRADE_RECEIVABLES: 0.05,
    INVENTORIES: 0.04,
    PPE: 0.02,
    TRADE_PAYABLES: 0.04,
    CASH_EQUIVALENTS: 0.0,
    SHORT_TERM_BORROWINGS: 0.0,
    LONG_TERM_BORROWINGS: -0.05,
    SHARE_CAPITAL: 0.0,
    RETAINED_EARNINGS: 0.08,
    FINANCE_COSTS: 0.02,
    TAX_EXPENSE: 0.05,
    INTANGIBLE_ASSETS: -0.10
  };

  const matchedKey = Object.keys(INDUSTRY_GROWTH_RATES).find(k => fsHeadKey.includes(k)) || fsHeadKey;
  const expectedGrowth = INDUSTRY_GROWTH_RATES[matchedKey] ?? 0.03;

  if (priorBalance === 0 && currentBalance === 0) {
    return { basis: "Prior year trend", expectedBalance: 0 };
  }

  if (priorBalance === 0 && currentBalance !== 0) {
    return { 
      basis: "New account - requires management inquiry", 
      expectedBalance: currentBalance 
    };
  }

  if (fsHeadKey.includes('REVENUE') || fsHeadKey.includes('SALES')) {
    const expectedBalance = priorBalance * (1 + expectedGrowth);
    return { basis: "Industry norm", expectedBalance: Math.round(expectedBalance) };
  }

  if (fsHeadKey.includes('COST') || fsHeadKey.includes('EXPENSE')) {
    const marginFactor = 1 + (expectedGrowth * 0.9);
    const expectedBalance = priorBalance * marginFactor;
    return { basis: "Analytical calculation", expectedBalance: Math.round(expectedBalance) };
  }

  if (fsHeadKey.includes('RECEIVABLES') || fsHeadKey.includes('PAYABLES')) {
    const dsoAdjustment = 1 + expectedGrowth;
    const expectedBalance = priorBalance * dsoAdjustment;
    return { basis: "Prior year trend", expectedBalance: Math.round(expectedBalance) };
  }

  if (fsHeadKey.includes('PPE') || fsHeadKey.includes('INTANGIBLE')) {
    const depreciation = 0.10;
    const capex = 0.05;
    const expectedBalance = priorBalance * (1 - depreciation + capex);
    return { basis: "Analytical calculation", expectedBalance: Math.round(expectedBalance) };
  }

  if (fsHeadKey.includes('BORROWINGS') || fsHeadKey.includes('DEBT')) {
    const repayment = 0.10;
    const expectedBalance = priorBalance * (1 - repayment);
    return { basis: "Prior year trend", expectedBalance: Math.round(expectedBalance) };
  }

  if (fsHeadKey.includes('CAPITAL') || fsHeadKey.includes('EQUITY')) {
    return { basis: "Prior year trend", expectedBalance: priorBalance };
  }

  const historicalGrowth = movementPct !== 0 ? (movementPct / 100) * 0.5 : expectedGrowth;
  const expectedBalance = priorBalance * (1 + historicalGrowth);
  return { basis: "Prior year trend", expectedBalance: Math.round(expectedBalance) };
}

function getAffectedAssertions(fsHeadKey: string, movementPct: number): string[] {
  const assertionMap: Record<string, string[]> = {
    TRADE_RECEIVABLES: movementPct > 0 ? ["Existence/Occurrence", "Valuation/Accuracy", "Cut-off"] : ["Completeness", "Valuation/Accuracy"],
    INVENTORIES: movementPct > 0 ? ["Existence/Occurrence", "Valuation/Accuracy"] : ["Completeness", "Cut-off"],
    REVENUE: movementPct > 0 ? ["Existence/Occurrence", "Cut-off", "Accuracy"] : ["Completeness", "Cut-off"],
    COST_OF_SALES: ["Accuracy", "Cut-off", "Classification"],
    PPE: ["Existence/Occurrence", "Valuation/Accuracy", "Rights & Obligations"],
    TRADE_PAYABLES: movementPct < 0 ? ["Completeness", "Cut-off"] : ["Existence/Occurrence", "Valuation/Accuracy"],
    BORROWINGS: ["Completeness", "Valuation/Accuracy", "Presentation & Disclosure"],
    CASH_EQUIVALENTS: ["Existence/Occurrence", "Completeness", "Rights & Obligations"],
    ADMINISTRATIVE_EXPENSES: ["Occurrence", "Classification", "Cut-off"],
    FINANCE_COSTS: ["Completeness", "Accuracy", "Classification"],
    TAX_EXPENSE: ["Valuation/Accuracy", "Completeness", "Presentation & Disclosure"]
  };

  for (const [key, assertions] of Object.entries(assertionMap)) {
    if (fsHeadKey.includes(key)) {
      return assertions;
    }
  }

  return ["Valuation/Accuracy", "Existence/Occurrence"];
}

function getPossibleCauses(fsHeadKey: string, movementPct: number): string[] {
  const baseCauses: Record<string, string[]> = {
    REVENUE: ["Changes in sales volume or pricing", "New product lines or market expansion", "Loss of major customers", "Economic conditions affecting demand"],
    TRADE_RECEIVABLES: ["Extended credit terms to customers", "Changes in customer base", "Collection issues or disputes", "Revenue growth/decline impact"],
    INVENTORIES: ["Production capacity changes", "Supply chain disruptions", "Obsolescence or write-downs", "Stockpiling ahead of price increases"],
    PPE: ["Capital expenditure program", "Asset disposals or impairments", "Depreciation policy changes", "Business expansion or contraction"],
    COST_OF_SALES: ["Input cost fluctuations", "Production efficiency changes", "Product mix changes", "Currency fluctuations on imports"],
    TRADE_PAYABLES: ["Changes in payment terms with suppliers", "Supply chain financing arrangements", "Operational activity level changes"],
    BORROWINGS: ["Debt refinancing", "New financing arrangements", "Scheduled repayments", "Covenant violations or renegotiations"],
    CASH_EQUIVALENTS: ["Operating cash flow changes", "Investment activities", "Financing activities", "Working capital management"],
    ADMINISTRATIVE_EXPENSES: ["Staff changes or restructuring", "Inflation impact", "One-time costs", "Efficiency improvements"],
    FINANCE_COSTS: ["Interest rate changes", "Debt level changes", "Refinancing activities", "Foreign exchange on borrowings"],
    TAX_EXPENSE: ["Changes in applicable tax rates", "Tax planning effectiveness", "Prior period adjustments", "Deferred tax movements"]
  };

  for (const [key, causes] of Object.entries(baseCauses)) {
    if (fsHeadKey.includes(key)) {
      const result = causes.slice(0, 3);
      if (Math.abs(movementPct) > 50) {
        result.push("Potential errors or irregularities requiring investigation");
      }
      return result;
    }
  }

  return [
    "Business activity changes",
    "Accounting policy or estimate changes",
    "One-time transactions",
    Math.abs(movementPct) > 50 ? "Potential errors requiring investigation" : "Market or economic conditions"
  ].slice(0, 3);
}

router.post("/:engagementId/analyze", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const firmId = req.user!.firmId;

    if (!firmId) {
      return res.status(400).json({ error: "User not associated with a firm" });
    }

    const engagement = await prisma.engagement.findFirst({
      where: { id: engagementId, firmId },
      include: {
        planningData: true,
        client: true
      }
    });

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    const tbAccounts = await prisma.coAAccount.findMany({
      where: { engagementId },
      select: {
        id: true,
        accountCode: true,
        accountName: true,
        fsLineItem: true,
        closingBalance: true,
        openingBalance: true,
        nature: true
      }
    });

    const materialityData = engagement.planningData?.materiality as any;
    const overallMateriality = materialityData?.overallMateriality || 100000;
    const performanceMateriality = materialityData?.performanceMateriality || overallMateriality * 0.75;

    const fsHeadTotals = new Map<string, { current: number; prior: number; label: string }>();
    
    for (const acc of tbAccounts) {
      if (!acc.fsLineItem) continue;
      
      const key = acc.fsLineItem.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');
      const existing = fsHeadTotals.get(key) || { current: 0, prior: 0, label: acc.fsLineItem };
      
      const closing = acc.closingBalance ? parseFloat(acc.closingBalance.toString()) : 0;
      const opening = acc.openingBalance ? parseFloat(acc.openingBalance.toString()) : 0;
      
      existing.current += closing;
      existing.prior += opening;
      existing.label = acc.fsLineItem;
      
      fsHeadTotals.set(key, existing);
    }

    const fsHeadExpectations: FsHeadExpectation[] = [];
    const trendAnalysis: TrendAnalysisItem[] = [];
    const significantFluctuations: SignificantFluctuation[] = [];
    const riskMatrixUpdates: RiskMatrixUpdate[] = [];
    const auditStrategyImpact: AuditStrategyImpact[] = [];

    let idx = 0;
    for (const [key, data] of fsHeadTotals.entries()) {
      const movement = data.current - data.prior;
      const movementPct = data.prior !== 0 ? (movement / Math.abs(data.prior)) * 100 : (data.current !== 0 ? 100 : 0);
      
      const { basis, expectedBalance } = calculateExpectedBalance(key, data.current, data.prior, movementPct);
      
      fsHeadExpectations.push({
        fsHeadKey: key,
        fsHeadLabel: FS_HEAD_LABELS[key] || data.label,
        currentYearBalance: data.current,
        priorYearBalance: data.prior,
        expectedBalance: Math.round(expectedBalance),
        expectationBasis: basis,
        expectationRationale: generateRationale(key, basis, data.current, data.prior)
      });

      const status = determineStatus(movementPct, performanceMateriality, data.current);
      const isMaterial = Math.abs(data.current) > performanceMateriality;

      trendAnalysis.push({
        id: `TREND-${String(idx + 1).padStart(3, '0')}`,
        fsHeadKey: key,
        fsHeadLabel: FS_HEAD_LABELS[key] || data.label,
        currentYear: data.current,
        priorYear: data.prior,
        movement,
        movementPercentage: parseFloat(movementPct.toFixed(2)),
        status,
        materialityFlag: isMaterial,
        explanation: status !== 'Expected' ? `Movement of ${movementPct.toFixed(1)}% requires investigation per ISA 520.` : undefined
      });

      if (status === 'Risk-Indicative' || (status === 'Requires Explanation' && isMaterial)) {
        const possibleCauses = getPossibleCauses(key, movementPct);
        const affectedAssertions = getAffectedAssertions(key, movementPct);

        significantFluctuations.push({
          id: `FLUCT-${String(significantFluctuations.length + 1).padStart(3, '0')}`,
          fsHeadKey: key,
          fsHeadLabel: FS_HEAD_LABELS[key] || data.label,
          natureOfFluctuation: `${movementPct > 0 ? 'Increase' : 'Decrease'} of ${Math.abs(movementPct).toFixed(1)}% (${Math.abs(movement).toLocaleString()})`,
          possibleCauses,
          affectedAssertions,
          riskImpact: status === 'Risk-Indicative' ? 'Elevates Risk Rating' : 'Confirms Existing Risk',
          riskLevel: isMaterial ? 'FS Level' : 'Assertion Level',
          fraudConsideration: Math.abs(movementPct) > 75 || (movementPct > 50 && key.includes('REVENUE')),
          significantRiskFlag: status === 'Risk-Indicative',
          documentedJustification: `Per ISA 520.7, significant fluctuation identified requiring further investigation. Movement exceeds ${isMaterial ? 'performance materiality' : 'acceptable threshold'}.`
        });

        const previousRating = status === 'Risk-Indicative' ? 'Medium' : 'Low';
        const updatedRating = status === 'Risk-Indicative' ? 'High' : 'Medium';

        affectedAssertions.forEach((assertion, assertionIdx) => {
          riskMatrixUpdates.push({
            fsHeadKey: key,
            assertion,
            previousRiskRating: previousRating as 'High' | 'Medium' | 'Low',
            updatedRiskRating: updatedRating as 'High' | 'Medium' | 'Low',
            changeReason: `Analytical procedures identified ${status === 'Risk-Indicative' ? 'risk-indicative' : 'significant'} fluctuation of ${movementPct.toFixed(1)}% affecting ${assertion}`,
            analyticsReference: `TREND-${String(idx + 1).padStart(3, '0')}-A${assertionIdx + 1}`
          });
        });

        auditStrategyImpact.push({
          fsHeadKey: key,
          fsHeadLabel: FS_HEAD_LABELS[key] || data.label,
          impactOnNature: status === 'Risk-Indicative' ? 'More substantive testing required' : 'Focused substantive procedures',
          impactOnTiming: status === 'Risk-Indicative' ? 'Year-End' : 'Both',
          impactOnExtent: status === 'Risk-Indicative' ? 'Increased sample size (>25 items)' : 'Standard sample size with targeted selection',
          controlsRelianceImpact: status === 'Risk-Indicative' ? 'Reduced reliance on controls' : 'Normal controls reliance with corroboration',
          planningConclusion: `Per ISA 330, ${status === 'Risk-Indicative' ? 'extended' : 'focused'} substantive procedures planned for ${FS_HEAD_LABELS[key] || data.label} due to analytical findings.`
        });
      }

      idx++;
    }

    const ratioAnalysis: RatioAnalysisItem[] = [];
    
    const getBalanceByKeyPattern = (patterns: string[], useCurrent: boolean = true): number => {
      let total = 0;
      for (const [key, data] of fsHeadTotals.entries()) {
        if (patterns.some(p => key.includes(p))) {
          total += useCurrent ? data.current : data.prior;
        }
      }
      return total;
    };

    const currentAssets = getBalanceByKeyPattern(['CASH', 'RECEIVABLES', 'INVENTORIES', 'PREPAID']);
    const totalAssets = currentAssets + getBalanceByKeyPattern(['PPE', 'INTANGIBLE', 'INVESTMENT']);
    const currentLiabilities = getBalanceByKeyPattern(['TRADE_PAYABLES', 'SHORT_TERM', 'ACCRUED', 'TAX_PAYABLE']);
    const totalLiabilities = currentLiabilities + getBalanceByKeyPattern(['LONG_TERM', 'BORROWINGS', 'DEFERRED']);
    
    const priorAssets = getBalanceByKeyPattern(['CASH', 'RECEIVABLES', 'INVENTORIES', 'PPE', 'INTANGIBLE'], false);
    const priorLiabilities = getBalanceByKeyPattern(['PAYABLES', 'BORROWINGS'], false);
    
    const revenue = getBalanceByKeyPattern(['REVENUE', 'SALES']) || 1;
    const priorRevenue = getBalanceByKeyPattern(['REVENUE', 'SALES'], false) || 1;
    const costOfSales = getBalanceByKeyPattern(['COST_OF_SALES', 'COST_OF_GOODS']) || revenue * 0.6;
    const priorCostOfSales = getBalanceByKeyPattern(['COST_OF_SALES', 'COST_OF_GOODS'], false) || priorRevenue * 0.6;
    
    const adminExpenses = getBalanceByKeyPattern(['ADMINISTRATIVE', 'ADMIN', 'OPERATING']);
    const financeCosts = getBalanceByKeyPattern(['FINANCE_COSTS', 'INTEREST']) || 1;
    const priorFinanceCosts = getBalanceByKeyPattern(['FINANCE_COSTS', 'INTEREST'], false) || 1;
    
    const equity = (totalAssets - totalLiabilities) || 1;
    const priorEquity = (priorAssets - priorLiabilities) || 1;

    const priorCurrentRatio = priorAssets > 0 && priorLiabilities > 0 ? 
      getBalanceByKeyPattern(['CASH', 'RECEIVABLES', 'INVENTORIES'], false) / getBalanceByKeyPattern(['TRADE_PAYABLES', 'SHORT_TERM'], false) : 1.5;
    const priorGrossMargin = priorRevenue > 0 ? ((priorRevenue - priorCostOfSales) / priorRevenue) * 100 : 35;
    const priorDebtToEquity = priorEquity > 0 ? priorLiabilities / priorEquity : 0.8;
    const priorAssetTurnover = priorAssets > 0 ? priorRevenue / priorAssets : 1.2;
    const priorInterestCoverage = priorFinanceCosts > 0 ? (priorRevenue - priorCostOfSales - getBalanceByKeyPattern(['ADMINISTRATIVE'], false)) / priorFinanceCosts : 4.5;

    const ratios = [
      {
        name: "Current Ratio",
        category: "Liquidity" as const,
        current: currentLiabilities > 0 ? currentAssets / currentLiabilities : 0,
        prior: priorCurrentRatio || 1.5,
        industryAvg: 1.8,
        linkedFsHeads: ['CASH_EQUIVALENTS', 'TRADE_RECEIVABLES', 'INVENTORIES', 'TRADE_PAYABLES']
      },
      {
        name: "Gross Profit Margin (%)",
        category: "Profitability" as const,
        current: revenue > 0 ? ((revenue - costOfSales) / revenue) * 100 : 0,
        prior: priorGrossMargin || 35,
        industryAvg: 32,
        linkedFsHeads: ['REVENUE', 'COST_OF_SALES']
      },
      {
        name: "Debt to Equity",
        category: "Leverage" as const,
        current: equity > 0 ? totalLiabilities / equity : 0,
        prior: priorDebtToEquity || 0.8,
        industryAvg: 1.0,
        linkedFsHeads: ['LONG_TERM_BORROWINGS', 'SHORT_TERM_BORROWINGS', 'SHARE_CAPITAL', 'RETAINED_EARNINGS']
      },
      {
        name: "Asset Turnover",
        category: "Efficiency" as const,
        current: totalAssets > 0 ? revenue / totalAssets : 0,
        prior: priorAssetTurnover || 1.2,
        industryAvg: 1.3,
        linkedFsHeads: ['REVENUE', 'PPE', 'INVENTORIES', 'TRADE_RECEIVABLES']
      },
      {
        name: "Interest Coverage",
        category: "Coverage" as const,
        current: financeCosts > 0 ? (revenue - costOfSales - adminExpenses) / financeCosts : 0,
        prior: priorInterestCoverage || 4.5,
        industryAvg: 5.0,
        linkedFsHeads: ['REVENUE', 'COST_OF_SALES', 'ADMINISTRATIVE_EXPENSES', 'FINANCE_COSTS']
      }
    ];

    ratios.forEach((ratio, i) => {
      const variance = ratio.current - ratio.prior;
      const variancePct = Math.abs((variance / ratio.prior) * 100);
      const status = variancePct > 30 ? 'Risk-Indicative' : variancePct > 15 ? 'Requires Explanation' : 'Expected';

      ratioAnalysis.push({
        id: `RATIO-${String(i + 1).padStart(3, '0')}`,
        ratioName: ratio.name,
        category: ratio.category,
        currentYear: parseFloat(ratio.current.toFixed(2)),
        priorYear: ratio.prior,
        industryAverage: ratio.industryAvg,
        variance: parseFloat(variance.toFixed(2)),
        status,
        linkedFsHeads: ratio.linkedFsHeads,
        interpretation: status === 'Expected' 
          ? `${ratio.name} is within expected range.`
          : `${ratio.name} shows ${variance > 0 ? 'improvement' : 'deterioration'} of ${variancePct.toFixed(1)}% requiring investigation.`
      });
    });

    const result: PlanningAnalyticsResult = {
      fsHeadExpectations,
      trendAnalysis,
      ratioAnalysis,
      significantFluctuations,
      riskMatrixUpdates,
      auditStrategyImpact,
      analysisDate: new Date().toISOString(),
      totalFluctuationsIdentified: significantFluctuations.length,
      riskIndicativeCount: trendAnalysis.filter(t => t.status === 'Risk-Indicative').length,
      riskMatrixUpdatesCount: riskMatrixUpdates.length
    };

    await prisma.engagement.update({
      where: { id: engagementId },
      data: {
        planningData: {
          update: {
            analyticalProcedures: result as any
          }
        }
      }
    });

    res.json(result);
  } catch (error) {
    console.error("Planning analytics error:", error);
    res.status(500).json({ error: "Failed to run planning analytical procedures" });
  }
});

router.get("/:engagementId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const firmId = req.user!.firmId;

    if (!firmId) {
      return res.status(400).json({ error: "User not associated with a firm" });
    }

    const engagement = await prisma.engagement.findFirst({
      where: { id: engagementId, firmId },
      include: { planningData: true }
    });

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    const analyticalProcedures = engagement.planningData?.analyticalProcedures as PlanningAnalyticsResult | null;

    if (!analyticalProcedures) {
      return res.json(null);
    }

    res.json(analyticalProcedures);
  } catch (error) {
    console.error("Get planning analytics error:", error);
    res.status(500).json({ error: "Failed to get planning analytical procedures" });
  }
});

router.post("/:engagementId/update-risk-matrix", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const { riskMatrixUpdates } = req.body as { riskMatrixUpdates: RiskMatrixUpdate[] };
    const firmId = req.user!.firmId;

    if (!firmId) {
      return res.status(400).json({ error: "User not associated with a firm" });
    }

    const engagement = await prisma.engagement.findFirst({
      where: { id: engagementId, firmId },
      include: { planningData: true }
    });

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    const existingRiskMatrix = (engagement.planningData?.riskAssessment as any)?.assertionLevelRisks || [];

    const updatedMatrix = existingRiskMatrix.map((risk: any) => {
      const update = riskMatrixUpdates.find(u => 
        u.fsHeadKey === risk.fsHeadKey && 
        (u.assertion === risk.assertion || 
         u.assertion === risk.assertionCode ||
         risk.assertions?.includes(u.assertion))
      );
      if (update) {
        return {
          ...risk,
          romm: update.updatedRiskRating.toLowerCase(),
          significantRisk: update.updatedRiskRating === 'High',
          analyticsReference: update.analyticsReference,
          analyticsUpdateReason: update.changeReason,
          analyticsAssertion: update.assertion,
          lastUpdatedByAnalytics: new Date().toISOString()
        };
      }
      return risk;
    });

    const existingKeys = existingRiskMatrix.map((r: any) => `${r.fsHeadKey}:${r.assertion || r.assertionCode}`);
    const newRisks = riskMatrixUpdates
      .filter(u => !existingKeys.includes(`${u.fsHeadKey}:${u.assertion}`))
      .map(u => ({
        fsHeadKey: u.fsHeadKey,
        fsHeadLabel: FS_HEAD_LABELS[u.fsHeadKey] || u.fsHeadKey,
        assertion: u.assertion,
        assertionCode: u.assertion,
        inherentRisk: 'medium',
        controlRisk: 'medium',
        romm: u.updatedRiskRating.toLowerCase(),
        significantRisk: u.updatedRiskRating === 'High',
        fraudRisk: false,
        analyticsReference: u.analyticsReference,
        analyticsUpdateReason: u.changeReason,
        source: 'Analytics',
        createdAt: new Date().toISOString()
      }));

    const finalMatrix = [...updatedMatrix, ...newRisks];

    await prisma.engagement.update({
      where: { id: engagementId },
      data: {
        planningData: {
          update: {
            riskAssessment: {
              ...(engagement.planningData?.riskAssessment as any),
              assertionLevelRisks: finalMatrix,
              analyticsUpdatedAt: new Date().toISOString()
            }
          }
        }
      }
    });

    const updatedCount = updatedMatrix.filter((r: any, i: number) => 
      JSON.stringify(r) !== JSON.stringify(existingRiskMatrix[i])
    ).length;

    res.json({ 
      success: true, 
      message: `Updated ${updatedCount} existing risks and added ${newRisks.length} new risks based on analytical procedures`,
      updatedCount,
      newRisksCount: newRisks.length
    });
  } catch (error) {
    console.error("Update risk matrix error:", error);
    res.status(500).json({ error: "Failed to update risk matrix" });
  }
});

export default router;
