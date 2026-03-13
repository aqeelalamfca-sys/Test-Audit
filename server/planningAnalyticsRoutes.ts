import { Router, Response } from "express";
import { prisma } from "./db";
import { requireAuth, type AuthenticatedRequest } from "./auth";
import { requirePhaseUnlocked } from "./middleware/auditLock";
import type { 
  PlanningAnalyticsResult, 
  FsHeadExpectation, 
  TrendAnalysisItem, 
  VerticalAnalysisItem,
  RatioAnalysisItem,
  ReasonablenessItem,
  SignificantFluctuation,
  RiskMatrixUpdate,
  AuditStrategyImpact,
  PlanningNarration
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
  SELLING_EXPENSES: "Selling & Distribution Expenses",
  OTHER_INCOME: "Other Income",
  FINANCE_COSTS: "Finance Costs",
  TAX_EXPENSE: "Tax Expense",
  OTHER_EXPENSES: "Other Expenses",
  PREPAYMENTS: "Prepayments & Advances",
  ACCRUED_LIABILITIES: "Accrued Liabilities",
  PROVISIONS: "Provisions",
  DEFERRED_TAX: "Deferred Tax",
  RIGHT_OF_USE_ASSETS: "Right-of-Use Assets",
  LEASE_LIABILITIES: "Lease Liabilities",
  INVESTMENT_PROPERTY: "Investment Property",
  INVESTMENTS: "Investments",
};

function determineStatus(movementPct: number, movementAmt: number, performanceMateriality: number): 'Expected' | 'Requires Explanation' | 'Risk-Indicative' {
  const absMovement = Math.abs(movementPct);
  const absAmtChange = Math.abs(movementAmt);
  if (absMovement > 50 && absAmtChange > performanceMateriality) return 'Risk-Indicative';
  if (absMovement > 50 || (absMovement > 20 && absAmtChange > performanceMateriality)) return 'Requires Explanation';
  if (absMovement > 20) return 'Requires Explanation';
  return 'Expected';
}

function generateRationale(fsHeadKey: string, basis: string, currentBalance: number, priorBalance: number): string {
  const rationales: Record<string, string> = {
    "Prior year trend": `[HEURISTIC] Based on historical trend analysis. Validate against client forecasts per ISA 520.`,
    "Budget": `[HEURISTIC] Estimated from industry growth rates. Compare to management's approved budget per ISA 520.`,
    "Industry norm": `[HEURISTIC] Benchmarked against standard industry growth rates. Validate against actual industry data per ISA 520.`,
    "Analytical calculation": `[HEURISTIC] Derived from standard account relationships. Verify against actual business factors per ISA 520.`,
    "Management representation": `[HEURISTIC] Preliminary estimate requiring validation through inquiry of management per ISA 520.`,
    "New account - requires management inquiry": `[NEW] Account has no prior year balance. Inquiry of management required per ISA 520.`
  };
  return rationales[basis] || `[HEURISTIC] Expected balance based on ${basis} analysis. Requires auditor validation per ISA 520.`;
}

function calculateExpectedBalance(fsHeadKey: string, currentBalance: number, priorBalance: number, _movementPct: number): { basis: string; expectedBalance: number } {
  const INDUSTRY_GROWTH_RATES: Record<string, number> = {
    REVENUE: 0.05, COST_OF_SALES: 0.04, ADMINISTRATIVE_EXPENSES: 0.03, SELLING_EXPENSES: 0.03,
    TRADE_RECEIVABLES: 0.05, INVENTORIES: 0.04, PPE: 0.02, TRADE_PAYABLES: 0.04,
    CASH_EQUIVALENTS: 0.0, SHORT_TERM_BORROWINGS: 0.0, LONG_TERM_BORROWINGS: -0.05,
    SHARE_CAPITAL: 0.0, RETAINED_EARNINGS: 0.08, FINANCE_COSTS: 0.02, TAX_EXPENSE: 0.05,
    INTANGIBLE_ASSETS: -0.10, OTHER_INCOME: 0.0, PROVISIONS: 0.02, DEFERRED_TAX: 0.02
  };

  const matchedKey = Object.keys(INDUSTRY_GROWTH_RATES).find(k => fsHeadKey.includes(k)) || fsHeadKey;
  const expectedGrowth = INDUSTRY_GROWTH_RATES[matchedKey] ?? 0.03;

  if (priorBalance === 0 && currentBalance === 0) {
    return { basis: "Prior year trend", expectedBalance: 0 };
  }
  if (priorBalance === 0 && currentBalance !== 0) {
    return { basis: "New account - requires management inquiry", expectedBalance: currentBalance };
  }
  if (fsHeadKey.includes('REVENUE') || fsHeadKey.includes('SALES')) {
    return { basis: "Industry norm", expectedBalance: Math.round(priorBalance * (1 + expectedGrowth)) };
  }
  if (fsHeadKey.includes('COST') || fsHeadKey.includes('EXPENSE')) {
    return { basis: "Analytical calculation", expectedBalance: Math.round(priorBalance * (1 + expectedGrowth * 0.9)) };
  }
  if (fsHeadKey.includes('RECEIVABLES') || fsHeadKey.includes('PAYABLES')) {
    return { basis: "Prior year trend", expectedBalance: Math.round(priorBalance * (1 + expectedGrowth)) };
  }
  if (fsHeadKey.includes('PPE') || fsHeadKey.includes('INTANGIBLE')) {
    return { basis: "Analytical calculation", expectedBalance: Math.round(priorBalance * 0.95) };
  }
  if (fsHeadKey.includes('BORROWINGS') || fsHeadKey.includes('DEBT')) {
    return { basis: "Prior year trend", expectedBalance: Math.round(priorBalance * 0.9) };
  }
  if (fsHeadKey.includes('CAPITAL') || fsHeadKey.includes('EQUITY')) {
    return { basis: "Prior year trend", expectedBalance: priorBalance };
  }

  const historicalGrowth = _movementPct !== 0 ? (_movementPct / 100) * 0.5 : expectedGrowth;
  return { basis: "Prior year trend", expectedBalance: Math.round(priorBalance * (1 + historicalGrowth)) };
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
    if (fsHeadKey.includes(key)) return assertions;
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
      if (Math.abs(movementPct) > 50) result.push("Potential errors or irregularities requiring investigation");
      return result;
    }
  }
  return ["Business activity changes", "Accounting policy or estimate changes", Math.abs(movementPct) > 50 ? "Potential errors requiring investigation" : "Market or economic conditions"];
}

function safeDiv(num: number, den: number): number {
  if (den === 0 || !isFinite(num) || !isFinite(den)) return 0;
  return num / den;
}

router.post("/:engagementId/analyze", requireAuth, requirePhaseUnlocked("PLANNING"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(400).json({ error: "User not associated with a firm" });

    const engagement = await prisma.engagement.findFirst({
      where: { id: engagementId, firmId },
      include: { planningMemo: true, client: true }
    });
    if (!engagement) return res.status(404).json({ error: "Engagement not found" });

    let planningData: any = {};
    try {
      if (engagement.planningMemo?.teamBriefingNotes) {
        planningData = JSON.parse(engagement.planningMemo.teamBriefingNotes);
      }
    } catch { planningData = {}; }

    const tbAccounts = await prisma.coAAccount.findMany({
      where: { engagementId },
      select: {
        id: true, accountCode: true, accountName: true,
        fsLineItem: true, closingBalance: true, openingBalance: true, nature: true
      }
    });

    const materialityData = planningData?.isa320MaterialityAnalysis?.step4_materialityLevels || planningData?.materiality;
    const overallMateriality = materialityData?.overallMateriality || 100000;
    const performanceMateriality = materialityData?.performanceMateriality || overallMateriality * 0.75;

    const fsHeadTotals = new Map<string, { current: number; prior: number; label: string }>();
    for (const acc of tbAccounts) {
      if (!acc.fsLineItem) continue;
      const key = acc.fsLineItem.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');
      const existing = fsHeadTotals.get(key) || { current: 0, prior: 0, label: acc.fsLineItem };
      const rawClosing = acc.closingBalance ? parseFloat(acc.closingBalance.toString()) : 0;
      const rawOpening = acc.openingBalance ? parseFloat(acc.openingBalance.toString()) : 0;
      const sign = acc.nature === 'CR' ? -1 : 1;
      existing.current += rawClosing * sign;
      existing.prior += rawOpening * sign;
      existing.label = acc.fsLineItem;
      fsHeadTotals.set(key, existing);
    }

    const getBalance = (patterns: string[], useCurrent = true): number => {
      let total = 0;
      for (const [key, data] of fsHeadTotals.entries()) {
        if (patterns.some(p => key.includes(p))) total += useCurrent ? data.current : data.prior;
      }
      return total;
    };

    const revenue = getBalance(['REVENUE', 'SALES']);
    const priorRevenue = getBalance(['REVENUE', 'SALES'], false);
    const costOfSales = getBalance(['COST_OF_SALES', 'COST_OF_GOODS']);
    const priorCostOfSales = getBalance(['COST_OF_SALES', 'COST_OF_GOODS'], false);
    const adminExpenses = getBalance(['ADMINISTRATIVE', 'ADMIN', 'OPERATING']);
    const priorAdminExpenses = getBalance(['ADMINISTRATIVE', 'ADMIN', 'OPERATING'], false);
    const sellingExpenses = getBalance(['SELLING', 'DISTRIBUTION', 'MARKETING']);
    const financeCosts = getBalance(['FINANCE_COSTS', 'INTEREST']);
    const priorFinanceCosts = getBalance(['FINANCE_COSTS', 'INTEREST'], false);
    const taxExpense = getBalance(['TAX_EXPENSE', 'INCOME_TAX']);
    const priorTaxExpense = getBalance(['TAX_EXPENSE', 'INCOME_TAX'], false);
    const otherIncome = getBalance(['OTHER_INCOME']);

    const grossProfit = revenue - costOfSales;
    const priorGrossProfit = priorRevenue - priorCostOfSales;
    const totalExpenses = costOfSales + adminExpenses + sellingExpenses + financeCosts + taxExpense;
    const priorTotalExpenses = priorCostOfSales + priorAdminExpenses + getBalance(['SELLING', 'DISTRIBUTION', 'MARKETING'], false) + priorFinanceCosts + priorTaxExpense;
    const operatingProfit = grossProfit - adminExpenses - sellingExpenses + otherIncome;
    const netProfit = operatingProfit - financeCosts - taxExpense;
    const priorOperatingProfit = priorGrossProfit - priorAdminExpenses - getBalance(['SELLING', 'DISTRIBUTION', 'MARKETING'], false) + getBalance(['OTHER_INCOME'], false);
    const priorNetProfit = priorOperatingProfit - priorFinanceCosts - priorTaxExpense;

    const cash = getBalance(['CASH']);
    const receivables = getBalance(['RECEIVABLES']);
    const inventory = getBalance(['INVENTOR']);
    const prepayments = getBalance(['PREPAID', 'PREPAYMENT', 'ADVANCE']);
    const currentAssets = cash + receivables + inventory + prepayments;
    const ppe = getBalance(['PPE', 'PROPERTY', 'PLANT']);
    const intangibles = getBalance(['INTANGIBLE']);
    const investments = getBalance(['INVESTMENT']);
    const totalAssets = currentAssets + ppe + intangibles + investments + getBalance(['RIGHT_OF_USE', 'DEFERRED_TAX_ASSET']);

    const tradePayables = getBalance(['TRADE_PAYABLES', 'PAYABLES']);
    const shortTermBorrowings = getBalance(['SHORT_TERM']);
    const accrued = getBalance(['ACCRUED']);
    const currentLiabilities = tradePayables + shortTermBorrowings + accrued + getBalance(['TAX_PAYABLE', 'CURRENT_TAX']);
    const longTermBorrowings = getBalance(['LONG_TERM']);
    const totalLiabilities = currentLiabilities + longTermBorrowings + getBalance(['DEFERRED_TAX_LIAB', 'PROVISION', 'LEASE_LIAB']);
    const totalEquity = totalAssets - totalLiabilities;

    const priorReceivables = getBalance(['RECEIVABLES'], false);
    const priorInventory = getBalance(['INVENTOR'], false);
    const priorCurrentAssets = getBalance(['CASH'], false) + priorReceivables + priorInventory + getBalance(['PREPAID', 'PREPAYMENT', 'ADVANCE'], false);
    const priorTotalAssets = priorCurrentAssets + getBalance(['PPE', 'PROPERTY', 'PLANT'], false) + getBalance(['INTANGIBLE'], false) + getBalance(['INVESTMENT'], false) + getBalance(['RIGHT_OF_USE', 'DEFERRED_TAX_ASSET'], false);
    const priorPayables = getBalance(['TRADE_PAYABLES', 'PAYABLES'], false);
    const priorCurrentLiabilities = priorPayables + getBalance(['SHORT_TERM'], false) + getBalance(['ACCRUED'], false) + getBalance(['TAX_PAYABLE', 'CURRENT_TAX'], false);
    const priorTotalLiabilities = priorCurrentLiabilities + getBalance(['LONG_TERM'], false) + getBalance(['DEFERRED_TAX_LIAB', 'PROVISION', 'LEASE_LIAB'], false);
    const priorTotalEquity = priorTotalAssets - priorTotalLiabilities;
    const totalDebt = shortTermBorrowings + longTermBorrowings;

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
        fsHeadKey: key, fsHeadLabel: FS_HEAD_LABELS[key] || data.label,
        currentYearBalance: data.current, priorYearBalance: data.prior,
        expectedBalance: Math.round(expectedBalance), expectationBasis: basis,
        expectationRationale: generateRationale(key, basis, data.current, data.prior)
      });

      const status = determineStatus(movementPct, movement, performanceMateriality);
      const isMaterial = Math.abs(movement) > performanceMateriality;

      trendAnalysis.push({
        id: `TREND-${String(idx + 1).padStart(3, '0')}`, fsHeadKey: key,
        fsHeadLabel: FS_HEAD_LABELS[key] || data.label,
        currentYear: data.current, priorYear: data.prior, movement,
        movementPercentage: parseFloat(movementPct.toFixed(2)), status, materialityFlag: isMaterial,
        explanation: status !== 'Expected' ? `Movement of ${movementPct.toFixed(1)}% requires investigation per ISA 520.` : undefined
      });

      if (status === 'Risk-Indicative' || (status === 'Requires Explanation' && isMaterial)) {
        const possibleCauses = getPossibleCauses(key, movementPct);
        const affectedAssertions = getAffectedAssertions(key, movementPct);

        significantFluctuations.push({
          id: `FLUCT-${String(significantFluctuations.length + 1).padStart(3, '0')}`,
          fsHeadKey: key, fsHeadLabel: FS_HEAD_LABELS[key] || data.label,
          natureOfFluctuation: `${movementPct > 0 ? 'Increase' : 'Decrease'} of ${Math.abs(movementPct).toFixed(1)}% (${Math.abs(movement).toLocaleString()})`,
          possibleCauses, affectedAssertions,
          riskImpact: status === 'Risk-Indicative' ? 'Elevates Risk Rating' : 'Confirms Existing Risk',
          riskLevel: isMaterial ? 'FS Level' : 'Assertion Level',
          fraudConsideration: Math.abs(movementPct) > 75 || (movementPct > 50 && key.includes('REVENUE')),
          significantRiskFlag: status === 'Risk-Indicative',
          documentedJustification: `Per ISA 520.7, significant fluctuation identified requiring investigation. Movement exceeds ${isMaterial ? 'performance materiality' : 'acceptable threshold'}.`
        });

        const previousRating = status === 'Risk-Indicative' ? 'Medium' : 'Low';
        const updatedRating = status === 'Risk-Indicative' ? 'High' : 'Medium';
        affectedAssertions.forEach((assertion, assertionIdx) => {
          riskMatrixUpdates.push({
            fsHeadKey: key, assertion,
            previousRiskRating: previousRating as 'High' | 'Medium' | 'Low',
            updatedRiskRating: updatedRating as 'High' | 'Medium' | 'Low',
            changeReason: `Analytical procedures identified ${status === 'Risk-Indicative' ? 'risk-indicative' : 'significant'} fluctuation of ${movementPct.toFixed(1)}%`,
            analyticsReference: `TREND-${String(idx + 1).padStart(3, '0')}-A${assertionIdx + 1}`
          });
        });

        auditStrategyImpact.push({
          fsHeadKey: key, fsHeadLabel: FS_HEAD_LABELS[key] || data.label,
          impactOnNature: status === 'Risk-Indicative' ? 'More substantive testing required' : 'Focused substantive procedures',
          impactOnTiming: status === 'Risk-Indicative' ? 'Year-End' : 'Both',
          impactOnExtent: status === 'Risk-Indicative' ? 'Increased sample size (>25 items)' : 'Standard sample size with targeted selection',
          controlsRelianceImpact: status === 'Risk-Indicative' ? 'Reduced reliance on controls' : 'Normal controls reliance with corroboration',
          planningConclusion: `Per ISA 330, ${status === 'Risk-Indicative' ? 'extended' : 'focused'} substantive procedures planned for ${FS_HEAD_LABELS[key] || data.label}.`
        });
      }
      idx++;
    }

    const verticalAnalysis: VerticalAnalysisItem[] = [];
    for (const [key, data] of fsHeadTotals.entries()) {
      const isIncome = key.includes('REVENUE') || key.includes('SALES') || key.includes('INCOME');
      const isExpense = key.includes('COST') || key.includes('EXPENSE') || key.includes('FINANCE') || key.includes('TAX') || key.includes('ADMIN') || key.includes('SELLING');
      const isAsset = key.includes('CASH') || key.includes('RECEIVABLES') || key.includes('INVENTOR') || key.includes('PPE') || key.includes('INTANGIBLE') || key.includes('INVESTMENT') || key.includes('PREPAID');
      const isLiability = key.includes('PAYABLE') || key.includes('BORROWING') || key.includes('ACCRUED') || key.includes('PROVISION') || key.includes('LEASE') || key.includes('DEFERRED');

      let pctOfRev = null, priorPctOfRev = null, pctOfAssets = null, priorPctOfAssets = null, pctOfExp = null, priorPctOfExp = null;
      if (isIncome || isExpense) {
        pctOfRev = revenue ? parseFloat(((data.current / Math.abs(revenue)) * 100).toFixed(2)) : null;
        priorPctOfRev = priorRevenue ? parseFloat(((data.prior / Math.abs(priorRevenue)) * 100).toFixed(2)) : null;
        if (isExpense && totalExpenses) {
          pctOfExp = parseFloat(((data.current / Math.abs(totalExpenses)) * 100).toFixed(2));
          priorPctOfExp = priorTotalExpenses ? parseFloat(((data.prior / Math.abs(priorTotalExpenses)) * 100).toFixed(2)) : null;
        }
      }
      if (isAsset && totalAssets) {
        pctOfAssets = parseFloat(((data.current / Math.abs(totalAssets)) * 100).toFixed(2));
        priorPctOfAssets = priorTotalAssets ? parseFloat(((data.prior / Math.abs(priorTotalAssets)) * 100).toFixed(2)) : null;
      }
      if (isLiability && totalAssets) {
        pctOfAssets = parseFloat(((data.current / Math.abs(totalAssets)) * 100).toFixed(2));
        priorPctOfAssets = priorTotalAssets ? parseFloat(((data.prior / Math.abs(priorTotalAssets)) * 100).toFixed(2)) : null;
      }

      const mainPct = pctOfRev ?? pctOfAssets ?? pctOfExp ?? null;
      const priorMainPct = priorPctOfRev ?? priorPctOfAssets ?? priorPctOfExp ?? null;
      const shift = (mainPct !== null && priorMainPct !== null) ? parseFloat((mainPct - priorMainPct).toFixed(2)) : null;

      verticalAnalysis.push({
        fsHeadKey: key, fsHeadLabel: FS_HEAD_LABELS[key] || data.label,
        currentYear: data.current, priorYear: data.prior,
        pctOfRevenue: pctOfRev, pctOfTotalAssets: pctOfAssets, pctOfTotalExpenses: pctOfExp,
        priorPctOfRevenue: priorPctOfRev, priorPctOfTotalAssets: priorPctOfAssets, priorPctOfTotalExpenses: priorPctOfExp,
        compositionShift: shift
      });
    }

    const ratioAnalysis: RatioAnalysisItem[] = [];
    const ratioSpecs: Array<{
      name: string; category: 'Liquidity' | 'Profitability' | 'Leverage' | 'Efficiency' | 'Coverage';
      current: number; prior: number; industryAvg: number; formula: string; linked: string[];
    }> = [
      { name: "Current Ratio", category: "Liquidity", current: safeDiv(currentAssets, currentLiabilities), prior: safeDiv(priorCurrentAssets, priorCurrentLiabilities) || 1.5, industryAvg: 1.8, formula: "Current Assets / Current Liabilities", linked: ['CASH_EQUIVALENTS', 'TRADE_RECEIVABLES', 'INVENTORIES', 'TRADE_PAYABLES'] },
      { name: "Quick Ratio", category: "Liquidity", current: safeDiv(currentAssets - inventory, currentLiabilities), prior: safeDiv(priorCurrentAssets - priorInventory, priorCurrentLiabilities) || 1.0, industryAvg: 1.2, formula: "(Current Assets - Inventory) / Current Liabilities", linked: ['CASH_EQUIVALENTS', 'TRADE_RECEIVABLES', 'TRADE_PAYABLES'] },
      { name: "Gross Profit Margin %", category: "Profitability", current: safeDiv(grossProfit, revenue) * 100, prior: safeDiv(priorGrossProfit, priorRevenue) * 100 || 35, industryAvg: 32, formula: "(Revenue - Cost of Sales) / Revenue × 100", linked: ['REVENUE', 'COST_OF_SALES'] },
      { name: "Operating Margin %", category: "Profitability", current: safeDiv(operatingProfit, revenue) * 100, prior: safeDiv(priorOperatingProfit, priorRevenue) * 100 || 12, industryAvg: 10, formula: "Operating Profit / Revenue × 100", linked: ['REVENUE', 'COST_OF_SALES', 'ADMINISTRATIVE_EXPENSES'] },
      { name: "Net Profit Margin %", category: "Profitability", current: safeDiv(netProfit, revenue) * 100, prior: safeDiv(priorNetProfit, priorRevenue) * 100 || 8, industryAvg: 7, formula: "Net Profit / Revenue × 100", linked: ['REVENUE', 'COST_OF_SALES', 'FINANCE_COSTS', 'TAX_EXPENSE'] },
      { name: "Return on Assets (ROA) %", category: "Profitability", current: safeDiv(netProfit, totalAssets) * 100, prior: safeDiv(priorNetProfit, priorTotalAssets) * 100 || 6, industryAvg: 5, formula: "Net Profit / Total Assets × 100", linked: ['PPE', 'INVENTORIES', 'TRADE_RECEIVABLES'] },
      { name: "Return on Equity (ROE) %", category: "Profitability", current: safeDiv(netProfit, totalEquity) * 100, prior: safeDiv(priorNetProfit, priorTotalEquity) * 100 || 12, industryAvg: 15, formula: "Net Profit / Total Equity × 100", linked: ['SHARE_CAPITAL', 'RETAINED_EARNINGS'] },
      { name: "Debt to Equity", category: "Leverage", current: safeDiv(totalLiabilities, totalEquity), prior: safeDiv(priorTotalLiabilities, priorTotalEquity) || 0.8, industryAvg: 1.0, formula: "Total Liabilities / Total Equity", linked: ['LONG_TERM_BORROWINGS', 'SHORT_TERM_BORROWINGS', 'SHARE_CAPITAL'] },
      { name: "Debt Ratio", category: "Leverage", current: safeDiv(totalLiabilities, totalAssets), prior: safeDiv(priorTotalLiabilities, priorTotalAssets) || 0.5, industryAvg: 0.5, formula: "Total Liabilities / Total Assets", linked: ['LONG_TERM_BORROWINGS', 'PPE'] },
      { name: "Asset Turnover", category: "Efficiency", current: safeDiv(revenue, totalAssets), prior: safeDiv(priorRevenue, priorTotalAssets) || 1.2, industryAvg: 1.3, formula: "Revenue / Total Assets", linked: ['REVENUE', 'PPE', 'INVENTORIES'] },
      { name: "Receivable Days", category: "Efficiency", current: safeDiv(receivables, revenue) * 365, prior: safeDiv(priorReceivables, priorRevenue) * 365 || 45, industryAvg: 45, formula: "(Trade Receivables / Revenue) × 365", linked: ['TRADE_RECEIVABLES', 'REVENUE'] },
      { name: "Payable Days", category: "Efficiency", current: safeDiv(tradePayables, costOfSales) * 365, prior: safeDiv(priorPayables, priorCostOfSales) * 365 || 30, industryAvg: 30, formula: "(Trade Payables / Cost of Sales) × 365", linked: ['TRADE_PAYABLES', 'COST_OF_SALES'] },
      { name: "Inventory Days", category: "Efficiency", current: safeDiv(inventory, costOfSales) * 365, prior: safeDiv(priorInventory, priorCostOfSales) * 365 || 60, industryAvg: 60, formula: "(Inventory / Cost of Sales) × 365", linked: ['INVENTORIES', 'COST_OF_SALES'] },
      { name: "Interest Coverage", category: "Coverage", current: safeDiv(operatingProfit, financeCosts), prior: safeDiv(priorOperatingProfit, priorFinanceCosts) || 4.5, industryAvg: 5.0, formula: "Operating Profit / Finance Costs", linked: ['REVENUE', 'COST_OF_SALES', 'FINANCE_COSTS'] },
    ];

    ratioSpecs.forEach((spec, i) => {
      const variance = spec.current - spec.prior;
      const variancePct = spec.prior !== 0 ? Math.abs((variance / spec.prior) * 100) : 0;
      const status: 'Expected' | 'Requires Explanation' | 'Risk-Indicative' = variancePct > 30 ? 'Risk-Indicative' : variancePct > 15 ? 'Requires Explanation' : 'Expected';
      ratioAnalysis.push({
        id: `RATIO-${String(i + 1).padStart(3, '0')}`, ratioName: spec.name, category: spec.category,
        currentYear: parseFloat(spec.current.toFixed(2)), priorYear: parseFloat(spec.prior.toFixed(2)),
        industryAverage: spec.industryAvg, variance: parseFloat(variance.toFixed(2)),
        status, linkedFsHeads: spec.linked, formula: spec.formula,
        interpretation: status === 'Expected'
          ? `${spec.name} is within expected range.`
          : `${spec.name} shows ${variance > 0 ? 'improvement' : 'deterioration'} of ${variancePct.toFixed(1)}% — requires investigation.`
      });
    });

    const reasonablenessTests: ReasonablenessItem[] = [];
    let rIdx = 0;
    if (revenue && costOfSales) {
      const gpRatio = safeDiv(grossProfit, revenue) * 100;
      const priorGpRatio = safeDiv(priorGrossProfit, priorRevenue) * 100;
      const gpShift = Math.abs(gpRatio - priorGpRatio);
      reasonablenessTests.push({
        id: `REAS-${String(++rIdx).padStart(3, '0')}`, testName: "Gross Margin Consistency",
        description: "Compare gross profit margin CY vs PY",
        expectedRelationship: `GP margin should remain within 2-3% of prior year (${priorGpRatio.toFixed(1)}%)`,
        actualResult: `CY GP margin: ${gpRatio.toFixed(1)}% vs PY: ${priorGpRatio.toFixed(1)}% (shift: ${gpShift.toFixed(1)}pp)`,
        status: gpShift > 5 ? 'Inconsistent' : 'Consistent',
        auditImplication: gpShift > 5 ? "Significant margin shift — investigate product mix, pricing, or cost structure changes" : "Margin consistent with expectations"
      });
    }
    if (receivables && revenue) {
      const recDays = safeDiv(receivables, revenue) * 365;
      const priorRecDays = safeDiv(priorReceivables, priorRevenue) * 365;
      const dayShift = Math.abs(recDays - priorRecDays);
      reasonablenessTests.push({
        id: `REAS-${String(++rIdx).padStart(3, '0')}`, testName: "Receivable Days vs Revenue",
        description: "Compare receivable collection period with revenue trend",
        expectedRelationship: "Receivable days should move proportionally with revenue changes",
        actualResult: `CY: ${recDays.toFixed(0)} days vs PY: ${priorRecDays.toFixed(0)} days (shift: ${dayShift.toFixed(0)} days)`,
        status: dayShift > 15 ? 'Inconsistent' : 'Consistent',
        auditImplication: dayShift > 15 ? "Collection period changed significantly — may indicate credit risk or revenue recognition issues" : "Collection period consistent"
      });
    }
    if (financeCosts && totalDebt) {
      const impliedRate = safeDiv(financeCosts, totalDebt) * 100;
      reasonablenessTests.push({
        id: `REAS-${String(++rIdx).padStart(3, '0')}`, testName: "Finance Cost vs Debt",
        description: "Compare finance costs to total borrowings (implied interest rate)",
        expectedRelationship: "Implied interest rate should be reasonable (typically 8-18% in Pakistan)",
        actualResult: `Implied rate: ${impliedRate.toFixed(1)}% (Finance costs: ${financeCosts.toLocaleString()} / Debt: ${totalDebt.toLocaleString()})`,
        status: impliedRate > 25 || impliedRate < 3 ? 'Inconsistent' : 'Consistent',
        auditImplication: impliedRate > 25 ? "Implied rate unusually high — verify completeness of borrowings or accuracy of finance costs" : impliedRate < 3 ? "Implied rate unusually low — verify if all finance costs captured" : "Implied rate within expected range"
      });
    }
    if (taxExpense && netProfit) {
      const effectiveRate = safeDiv(taxExpense, netProfit + taxExpense) * 100;
      reasonablenessTests.push({
        id: `REAS-${String(++rIdx).padStart(3, '0')}`, testName: "Tax Expense vs Profit",
        description: "Compare effective tax rate with statutory rate",
        expectedRelationship: "Effective rate should be near statutory rate (29% corporate rate in Pakistan)",
        actualResult: `Effective tax rate: ${effectiveRate.toFixed(1)}% vs statutory ~29%`,
        status: Math.abs(effectiveRate - 29) > 10 ? 'Inconsistent' : 'Consistent',
        auditImplication: Math.abs(effectiveRate - 29) > 10 ? "Significant deviation from statutory rate — investigate tax adjustments, exemptions, or permanent differences" : "Tax rate within expected range"
      });
    }
    if (ppe) {
      const depRate = getBalance(['DEPRECIATION']);
      if (depRate) {
        const impliedDepRate = safeDiv(depRate, ppe) * 100;
        reasonablenessTests.push({
          id: `REAS-${String(++rIdx).padStart(3, '0')}`, testName: "Depreciation vs Fixed Assets",
          description: "Compare depreciation expense to gross PPE",
          expectedRelationship: "Depreciation should be 5-15% of PPE (depending on asset mix)",
          actualResult: `Implied depreciation rate: ${impliedDepRate.toFixed(1)}%`,
          status: impliedDepRate > 25 || impliedDepRate < 2 ? 'Inconsistent' : 'Consistent',
          auditImplication: impliedDepRate > 25 ? "Unusually high depreciation — verify asset lives and impairments" : impliedDepRate < 2 ? "Unusually low — check if all assets being depreciated" : "Depreciation rate appears reasonable"
        });
      }
    }
    if (inventory && costOfSales) {
      const invDays = safeDiv(inventory, costOfSales) * 365;
      const priorInvDays = safeDiv(priorInventory, priorCostOfSales) * 365;
      const dayShift = Math.abs(invDays - priorInvDays);
      reasonablenessTests.push({
        id: `REAS-${String(++rIdx).padStart(3, '0')}`, testName: "Inventory Holding vs Production",
        description: "Compare inventory holding period with cost of sales trend",
        expectedRelationship: "Inventory days should be stable or consistent with production changes",
        actualResult: `CY: ${invDays.toFixed(0)} days vs PY: ${priorInvDays.toFixed(0)} days (shift: ${dayShift.toFixed(0)} days)`,
        status: dayShift > 20 ? 'Inconsistent' : 'Consistent',
        auditImplication: dayShift > 20 ? "Significant change in inventory holding — investigate slow-moving stock, obsolescence, or production changes" : "Inventory holding period consistent"
      });
    }
    if (revenue && receivables && inventory) {
      const revGrowth = priorRevenue ? ((revenue - priorRevenue) / Math.abs(priorRevenue)) * 100 : 0;
      const recGrowth = priorReceivables ? ((receivables - priorReceivables) / Math.abs(priorReceivables)) * 100 : 0;
      const invGrowth = priorInventory ? ((inventory - priorInventory) / Math.abs(priorInventory)) * 100 : 0;
      const inconsistent = (recGrowth > revGrowth + 15) || (invGrowth > revGrowth + 15);
      reasonablenessTests.push({
        id: `REAS-${String(++rIdx).padStart(3, '0')}`, testName: "Sales vs Receivables & Inventory Growth",
        description: "Compare growth rates of revenue, receivables, and inventory",
        expectedRelationship: "Working capital should grow proportionally with revenue",
        actualResult: `Revenue: ${revGrowth.toFixed(1)}%, Receivables: ${recGrowth.toFixed(1)}%, Inventory: ${invGrowth.toFixed(1)}%`,
        status: inconsistent ? 'Inconsistent' : 'Consistent',
        auditImplication: inconsistent ? "Working capital growing faster than revenue — possible overstatement of assets or channel stuffing" : "Growth rates appear proportional"
      });
    }

    const clientName = engagement.client?.name || 'the entity';
    const significantItems = significantFluctuations.map(f => f.fsHeadLabel).join(', ');
    const narration: PlanningNarration = {
      overallConclusion: `Analytical procedures were performed at planning stage in accordance with ISA 520 for ${clientName}. A total of ${fsHeadTotals.size} financial statement line items were analyzed. ${significantFluctuations.length} significant fluctuation(s) were identified requiring further investigation.`,
      significantMovements: significantFluctuations.length > 0
        ? `Significant fluctuations were noted in: ${significantItems}. These movements exceed the performance materiality threshold of ${performanceMateriality.toLocaleString()} and/or show percentage changes exceeding acceptable thresholds.`
        : `No significant fluctuations were identified that exceeded performance materiality of ${performanceMateriality.toLocaleString()} or analytical thresholds.`,
      possibleReasons: significantFluctuations.length > 0
        ? `Preliminary assessment suggests the changes may be attributable to: ${significantFluctuations.flatMap(f => f.possibleCauses.slice(0, 1)).join('; ')}. These preliminary assessments require corroboration through management inquiry and examination of supporting documentation.`
        : `All balances appear consistent with our understanding of the entity and its environment.`,
      planningImplications: significantFluctuations.length > 0
        ? `These movements may require additional substantive procedures and/or revision in risk assessment. ${auditStrategyImpact.length} area(s) have been identified for enhanced audit response.`
        : `No modifications to the planned audit approach appear necessary based on analytical procedures alone. Standard substantive procedures should be sufficient.`,
      proposedAuditResponse: auditStrategyImpact.length > 0
        ? `Extended substantive testing is recommended for ${auditStrategyImpact.map(a => a.fsHeadLabel).join(', ')}. Year-end confirmation/observation procedures should be prioritized for material items.`
        : `Standard audit procedures as per the audit program should be applied. No additional procedures identified from planning analytics.`,
      riskAssessmentLinkage: riskMatrixUpdates.length > 0
        ? `${riskMatrixUpdates.length} risk matrix update(s) have been proposed based on analytical findings. These should be reviewed and approved before proceeding to execution phase.`
        : `No risk matrix updates are proposed based on the analytical review.`,
      lastUpdated: new Date().toISOString(),
      updatedBy: req.user!.name || req.user!.email || undefined
    };

    const existingNarration = planningData?.analyticalProcedures?.narration;
    const finalNarration = existingNarration ? { ...narration, ...existingNarration, lastUpdated: narration.lastUpdated } : narration;

    const result: PlanningAnalyticsResult = {
      fsHeadExpectations, trendAnalysis, verticalAnalysis, ratioAnalysis, reasonablenessTests,
      significantFluctuations, riskMatrixUpdates, auditStrategyImpact,
      narration: finalNarration,
      analysisDate: new Date().toISOString(),
      analyzedBy: req.user!.name || req.user!.email || undefined,
      totalAccountsAnalyzed: fsHeadTotals.size,
      totalFluctuationsIdentified: significantFluctuations.length,
      riskIndicativeCount: trendAnalysis.filter(t => t.status === 'Risk-Indicative').length,
      riskMatrixUpdatesCount: riskMatrixUpdates.length,
      ratiosOutOfRange: ratioAnalysis.filter(r => r.status !== 'Expected').length,
      overallMateriality, performanceMateriality
    };

    const updatedPlanningData = { ...planningData, analyticalProcedures: result };
    if (engagement.planningMemo) {
      await prisma.planningMemo.update({
        where: { id: engagement.planningMemo.id },
        data: { teamBriefingNotes: JSON.stringify(updatedPlanningData) }
      });
    } else {
      await prisma.planningMemo.create({
        data: { engagementId, preparedById: req.user!.id, teamBriefingNotes: JSON.stringify(updatedPlanningData) }
      });
    }

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
    if (!firmId) return res.status(400).json({ error: "User not associated with a firm" });

    const engagement = await prisma.engagement.findFirst({
      where: { id: engagementId, firmId },
      include: { planningMemo: true }
    });
    if (!engagement) return res.status(404).json({ error: "Engagement not found" });

    let analyticalProcedures: PlanningAnalyticsResult | null = null;
    try {
      if (engagement.planningMemo?.teamBriefingNotes) {
        const pd = JSON.parse(engagement.planningMemo.teamBriefingNotes);
        analyticalProcedures = pd?.analyticalProcedures || null;
      }
    } catch { analyticalProcedures = null; }

    res.json(analyticalProcedures);
  } catch (error) {
    console.error("Get planning analytics error:", error);
    res.status(500).json({ error: "Failed to get planning analytical procedures" });
  }
});

router.post("/:engagementId/save-narration", requireAuth, requirePhaseUnlocked("PLANNING"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const { narration } = req.body as { narration: PlanningNarration };
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(400).json({ error: "User not associated with a firm" });

    const engagement = await prisma.engagement.findFirst({
      where: { id: engagementId, firmId },
      include: { planningMemo: true }
    });
    if (!engagement) return res.status(404).json({ error: "Engagement not found" });

    let planningData: any = {};
    try {
      if (engagement.planningMemo?.teamBriefingNotes) {
        planningData = JSON.parse(engagement.planningMemo.teamBriefingNotes);
      }
    } catch { planningData = {}; }

    if (!planningData.analyticalProcedures) {
      return res.status(400).json({ error: "No analytics data found. Run analytics first." });
    }

    planningData.analyticalProcedures.narration = {
      ...narration,
      lastUpdated: new Date().toISOString(),
      updatedBy: req.user!.name || req.user!.email || undefined
    };

    if (engagement.planningMemo) {
      await prisma.planningMemo.update({
        where: { id: engagement.planningMemo.id },
        data: { teamBriefingNotes: JSON.stringify(planningData) }
      });
    }

    res.json({ success: true, message: "Narration saved successfully" });
  } catch (error) {
    console.error("Save narration error:", error);
    res.status(500).json({ error: "Failed to save narration" });
  }
});

router.post("/:engagementId/update-risk-matrix", requireAuth, requirePhaseUnlocked("PLANNING"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const { riskMatrixUpdates } = req.body as { riskMatrixUpdates: RiskMatrixUpdate[] };
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(400).json({ error: "User not associated with a firm" });

    const engagement = await prisma.engagement.findFirst({
      where: { id: engagementId, firmId },
      include: { planningMemo: true }
    });
    if (!engagement) return res.status(404).json({ error: "Engagement not found" });

    let engPlanningData: any = {};
    try {
      if (engagement.planningMemo?.teamBriefingNotes) {
        engPlanningData = JSON.parse(engagement.planningMemo.teamBriefingNotes);
      }
    } catch { engPlanningData = {}; }

    const existingRiskMatrix = (engPlanningData?.riskAssessment as any)?.assertionLevelRisks || [];
    const updatedMatrix = existingRiskMatrix.map((risk: any) => {
      const update = riskMatrixUpdates.find(u =>
        u.fsHeadKey === risk.fsHeadKey &&
        (u.assertion === risk.assertion || u.assertion === risk.assertionCode || risk.assertions?.includes(u.assertion))
      );
      if (update) {
        return {
          ...risk, romm: update.updatedRiskRating.toLowerCase(),
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
        fsHeadKey: u.fsHeadKey, fsHeadLabel: FS_HEAD_LABELS[u.fsHeadKey] || u.fsHeadKey,
        assertion: u.assertion, assertionCode: u.assertion,
        inherentRisk: 'medium', controlRisk: 'medium', romm: u.updatedRiskRating.toLowerCase(),
        significantRisk: u.updatedRiskRating === 'High', fraudRisk: false,
        analyticsReference: u.analyticsReference, analyticsUpdateReason: u.changeReason,
        source: 'Analytics', createdAt: new Date().toISOString()
      }));

    const finalMatrix = [...updatedMatrix, ...newRisks];
    const updatedRiskData = {
      ...engPlanningData,
      riskAssessment: {
        ...(engPlanningData?.riskAssessment || {}),
        assertionLevelRisks: finalMatrix,
        analyticsUpdatedAt: new Date().toISOString()
      }
    };

    if (engagement.planningMemo) {
      await prisma.planningMemo.update({
        where: { id: engagement.planningMemo.id },
        data: { teamBriefingNotes: JSON.stringify(updatedRiskData) }
      });
    } else {
      await prisma.planningMemo.create({
        data: { engagementId, preparedById: req.user!.id, teamBriefingNotes: JSON.stringify(updatedRiskData) }
      });
    }

    const updatedCount = updatedMatrix.filter((r: any, i: number) =>
      JSON.stringify(r) !== JSON.stringify(existingRiskMatrix[i])
    ).length;

    res.json({
      success: true,
      message: `Updated ${updatedCount} existing risks and added ${newRisks.length} new risks based on analytical procedures`,
      updatedCount, newRisksCount: newRisks.length
    });
  } catch (error) {
    console.error("Update risk matrix error:", error);
    res.status(500).json({ error: "Failed to update risk matrix" });
  }
});

export default router;
