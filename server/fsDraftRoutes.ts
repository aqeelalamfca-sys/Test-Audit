import { Router, Response } from "express";
import { prisma } from "./db";
import { requireAuth, type AuthenticatedRequest } from "./auth";
import { z } from "zod";
import { Decimal } from "@prisma/client/runtime/library";

const router = Router();

const FS_STRUCTURE = {
  BALANCE_SHEET: {
    "Non-Current Assets": {
      lineItems: ["PPE", "PROPERTY_PLANT_EQUIPMENT", "INTANGIBLE_ASSETS", "RIGHT_OF_USE_ASSETS", "LONG_TERM_INVESTMENTS", "INVESTMENTS", "DEFERRED_TAX_ASSETS", "OTHER_NON_CURRENT_ASSETS", "FIXED_ASSETS", "CAPITAL_WIP", "INVESTMENT_PROPERTY"],
      displayOrder: 1,
      isSubtotal: false
    },
    "Current Assets": {
      lineItems: ["INVENTORIES", "INVENTORY", "STOCK", "TRADE_RECEIVABLES", "RECEIVABLES", "OTHER_RECEIVABLES", "PREPAYMENTS", "ADVANCES", "ADVANCES_AND_PREPAYMENTS", "SHORT_TERM_INVESTMENTS", "CASH_EQUIVALENTS", "CASH_AND_CASH_EQUIVALENTS", "CASH", "BANK", "OTHER_CURRENT_ASSETS", "CURRENT_ASSETS"],
      displayOrder: 2,
      isSubtotal: false
    },
    "Total Assets": {
      lineItems: [],
      displayOrder: 3,
      isSubtotal: true,
      subtotalOf: ["Non-Current Assets", "Current Assets"]
    },
    "Share Capital & Reserves": {
      lineItems: ["SHARE_CAPITAL", "CAPITAL", "RESERVES_SURPLUS", "RESERVES", "SURPLUS", "RETAINED_EARNINGS", "ACCUMULATED_PROFITS", "EQUITY", "SHAREHOLDERS_EQUITY"],
      displayOrder: 4,
      isSubtotal: false
    },
    "Non-Current Liabilities": {
      lineItems: ["LONG_TERM_BORROWINGS", "LONG_TERM_LOANS", "DEFERRED_TAX", "DEFERRED_TAX_LIABILITY", "PROVISIONS", "OTHER_NON_CURRENT_LIABILITIES", "LONG_TERM_LIABILITIES"],
      displayOrder: 5,
      isSubtotal: false
    },
    "Current Liabilities": {
      lineItems: ["TRADE_PAYABLES", "PAYABLES", "CREDITORS", "SHORT_TERM_BORROWINGS", "SHORT_TERM_LOANS", "TAX_LIABILITIES", "TAX_PAYABLE", "ACCRUALS", "ACCRUED_EXPENSES", "ACCRUED_LIABILITIES", "OTHER_CURRENT_LIABILITIES", "CURRENT_LIABILITIES"],
      displayOrder: 6,
      isSubtotal: false
    },
    "Total Equity & Liabilities": {
      lineItems: [],
      displayOrder: 7,
      isSubtotal: true,
      subtotalOf: ["Share Capital & Reserves", "Non-Current Liabilities", "Current Liabilities"]
    }
  },
  PROFIT_LOSS: {
    "Revenue": {
      lineItems: ["REVENUE_OPERATIONS", "REVENUE", "SERVICE_REVENUE", "SALES_REVENUE", "SALES", "TURNOVER", "INCOME_FROM_OPERATIONS"],
      displayOrder: 1,
      isSubtotal: false
    },
    "Other Income": {
      lineItems: ["OTHER_INCOME", "INTEREST_INCOME", "DIVIDEND_INCOME", "OTHER_OPERATING_INCOME", "MISCELLANEOUS_INCOME"],
      displayOrder: 2,
      isSubtotal: false
    },
    "Total Income": {
      lineItems: [],
      displayOrder: 3,
      isSubtotal: true,
      subtotalOf: ["Revenue", "Other Income"]
    },
    "Cost of Sales": {
      lineItems: ["COST_MATERIALS", "COST_OF_GOODS_SOLD", "COST_OF_SALES", "COGS", "DIRECT_COSTS", "PURCHASES", "MANUFACTURING_COSTS"],
      displayOrder: 4,
      isSubtotal: false
    },
    "Gross Profit": {
      lineItems: [],
      displayOrder: 5,
      isSubtotal: true,
      subtotalOf: ["Total Income"],
      subtractFrom: ["Cost of Sales"]
    },
    "Operating Expenses": {
      lineItems: ["EMPLOYEE_BENEFITS", "SALARIES", "WAGES", "DEPRECIATION", "DEPRECIATION_AMORTIZATION", "AMORTIZATION", "ADMINISTRATIVE_EXPENSES", "ADMIN_EXPENSES", "SELLING_EXPENSES", "DISTRIBUTION_EXPENSES", "OTHER_EXPENSES", "OPERATING_EXPENSES", "GENERAL_EXPENSES"],
      displayOrder: 6,
      isSubtotal: false
    },
    "Operating Profit": {
      lineItems: [],
      displayOrder: 7,
      isSubtotal: true,
      subtotalOf: ["Gross Profit"],
      subtractFrom: ["Operating Expenses"]
    },
    "Finance Costs": {
      lineItems: ["FINANCE_COSTS", "INTEREST_EXPENSE", "BANK_CHARGES", "FINANCIAL_CHARGES"],
      displayOrder: 8,
      isSubtotal: false
    },
    "Profit Before Tax": {
      lineItems: [],
      displayOrder: 9,
      isSubtotal: true,
      subtotalOf: ["Operating Profit"],
      subtractFrom: ["Finance Costs"]
    },
    "Tax Expense": {
      lineItems: ["TAX_EXPENSE", "CURRENT_TAX", "DEFERRED_TAX_EXPENSE", "INCOME_TAX", "TAXATION"],
      displayOrder: 10,
      isSubtotal: false
    },
    "Profit/(Loss) for the Year": {
      lineItems: [],
      displayOrder: 11,
      isSubtotal: true,
      subtotalOf: ["Profit Before Tax"],
      subtractFrom: ["Tax Expense"]
    }
  }
};

const LINE_ITEM_DISPLAY_NAMES: Record<string, string> = {
  CASH_EQUIVALENTS: "Cash and Cash Equivalents",
  TRADE_RECEIVABLES: "Trade Receivables",
  OTHER_RECEIVABLES: "Other Receivables",
  INVENTORIES: "Inventories",
  PREPAYMENTS: "Prepayments",
  SHORT_TERM_INVESTMENTS: "Short-term Investments",
  OTHER_CURRENT_ASSETS: "Other Current Assets",
  PPE: "Property, Plant & Equipment",
  INTANGIBLE_ASSETS: "Intangible Assets",
  RIGHT_OF_USE_ASSETS: "Right-of-Use Assets",
  LONG_TERM_INVESTMENTS: "Long-term Investments",
  INVESTMENTS: "Investments",
  DEFERRED_TAX_ASSETS: "Deferred Tax Assets",
  OTHER_NON_CURRENT_ASSETS: "Other Non-Current Assets",
  TRADE_PAYABLES: "Trade Payables",
  OTHER_PAYABLES: "Other Payables",
  SHORT_TERM_BORROWINGS: "Short-term Borrowings",
  TAX_LIABILITIES: "Current Tax Liabilities",
  ACCRUALS: "Accrued Expenses",
  OTHER_CURRENT_LIABILITIES: "Other Current Liabilities",
  LONG_TERM_BORROWINGS: "Long-term Borrowings",
  DEFERRED_TAX: "Deferred Tax Liabilities",
  PROVISIONS: "Provisions",
  OTHER_NON_CURRENT_LIABILITIES: "Other Non-Current Liabilities",
  SHARE_CAPITAL: "Share Capital",
  RESERVES_SURPLUS: "Reserves & Surplus",
  RETAINED_EARNINGS: "Retained Earnings",
  REVENUE_OPERATIONS: "Revenue from Operations",
  SERVICE_REVENUE: "Service Revenue",
  SALES_REVENUE: "Sales Revenue",
  OTHER_INCOME: "Other Income",
  INTEREST_INCOME: "Interest Income",
  DIVIDEND_INCOME: "Dividend Income",
  COST_MATERIALS: "Cost of Materials Consumed",
  COST_OF_GOODS_SOLD: "Cost of Goods Sold",
  DIRECT_COSTS: "Direct Costs",
  EMPLOYEE_BENEFITS: "Employee Benefits Expense",
  DEPRECIATION: "Depreciation",
  DEPRECIATION_AMORTIZATION: "Depreciation & Amortization",
  ADMINISTRATIVE_EXPENSES: "Administrative Expenses",
  SELLING_EXPENSES: "Selling & Distribution Expenses",
  OTHER_EXPENSES: "Other Expenses",
  FINANCE_COSTS: "Finance Costs",
  INTEREST_EXPENSE: "Interest Expense",
  TAX_EXPENSE: "Tax Expense",
  CURRENT_TAX: "Current Tax",
  DEFERRED_TAX_EXPENSE: "Deferred Tax Expense"
};

interface FSLineItemData {
  fsLineItem: string;
  displayName: string;
  accounts: Array<{
    accountCode: string;
    accountName: string;
    nature: string;
    originalAmount: number;
    adjustedAmount: number;
    adjustments: number;
    isUnmapped: boolean;
  }>;
  originalTotal: number;
  adjustedTotal: number;
  adjustmentsTotal: number;
  accountCount: number;
  openingTotal: number;
  notesRef: string | null;
}

interface FSSectionData {
  sectionName: string;
  displayOrder: number;
  isSubtotal: boolean;
  lineItems: FSLineItemData[];
  sectionOriginalTotal: number;
  sectionAdjustedTotal: number;
}

interface FSGeneratedData {
  balanceSheet: {
    sections: FSSectionData[];
    totalAssets: number;
    totalEquityLiabilities: number;
    isBalanced: boolean;
    variance: number;
  };
  profitLoss: {
    sections: FSSectionData[];
    revenue: number;
    expenses: number;
    netProfit: number;
  };
  unmappedAccounts: Array<{
    accountCode: string;
    accountName: string;
    closingBalance: number;
    nature: string;
  }>;
  summary: {
    totalMappedAccounts: number;
    totalUnmappedAccounts: number;
    mappingCompleteness: number;
    generatedAt: string;
  };
  keywordTotals: {
    totalAssets: number;
    totalLiabilities: number;
    totalEquity: number;
    totalIncome: number;
    totalExpenses: number;
  };
  fsHeads: Array<{
    fsLineItem: string;
    displayName: string;
    accountCount: number;
    debitTotal: number;
    creditTotal: number;
    netBalance: number;
    adjustedNetBalance: number;
  }>;
}

router.get("/:engagementId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const viewType = (req.query.viewType as string) || "ADJUSTED";

    const engagement = await prisma.engagement.findUnique({
      where: { id: engagementId },
      include: { client: true }
    });

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    // PRIMARY SOURCE: ImportAccountBalance (same as Draft FS in Data Intake)
    const importBalances = await prisma.importAccountBalance.findMany({
      where: { engagementId },
      orderBy: { accountCode: "asc" }
    });

    // FALLBACK: CoAAccount (if no import data)
    const coaAccounts = await prisma.coAAccount.findMany({
      where: { engagementId },
      orderBy: { accountCode: "asc" }
    });

    const trialBalance = await prisma.trialBalance.findFirst({
      where: { engagementId },
      orderBy: { importedDate: "desc" },
      include: { lineItems: true }
    });

    const adjustmentEntries = await prisma.auditAdjustment.findMany({
      where: { engagementId, status: "AGREED_POSTED" }
    });

    const adjustmentsByAccount: Record<string, number> = {};
    for (const aje of adjustmentEntries) {
      const code = aje.accountCode;
      if (!code) continue;
      if (!adjustmentsByAccount[code]) adjustmentsByAccount[code] = 0;
      const debit = Number(aje.debitAmount || 0);
      const credit = Number(aje.creditAmount || 0);
      adjustmentsByAccount[code] += debit - credit;
    }

    const accountBalances: Record<string, { original: number; adjusted: number; nature: string; name: string; opening: number; fsHeadKey: string | null }> = {};

    // Use ImportAccountBalance as primary source (same as Draft FS in Data Intake)
    // ImportAccountBalance uses balanceType (OB/CB) with debitAmount/creditAmount fields
    if (importBalances.length > 0) {
      // Separate OB and CB records
      const closingBalances: Record<string, { debit: number; credit: number; name: string; fsHeadKey: string | null }> = {};
      const openingBalances: Record<string, { debit: number; credit: number }> = {};
      
      for (const line of importBalances) {
        const debit = Number(line.debitAmount) || 0;
        const credit = Number(line.creditAmount) || 0;
        
        if (line.balanceType === 'CB') {
          closingBalances[line.accountCode] = {
            debit,
            credit,
            name: line.accountName || '',
            fsHeadKey: line.fsHeadKey || null
          };
        } else if (line.balanceType === 'OB') {
          openingBalances[line.accountCode] = { debit, credit };
        }
      }
      
      // Build account balances from closing balances
      for (const [accountCode, closing] of Object.entries(closingBalances)) {
        const opening = openingBalances[accountCode] || { debit: 0, credit: 0 };
        
        // Net balance = Debit - Credit (positive = debit balance, negative = credit balance)
        const originalBalance = closing.debit - closing.credit;
        const openingBalance = opening.debit - opening.credit;
        const nature = originalBalance >= 0 ? "DR" : "CR";
        const adjustment = adjustmentsByAccount[accountCode] || 0;
        const adjustedBalance = originalBalance + adjustment;

        accountBalances[accountCode] = {
          original: originalBalance,
          adjusted: adjustedBalance,
          nature,
          name: closing.name,
          opening: openingBalance,
          fsHeadKey: closing.fsHeadKey
        };
      }
    } else if (trialBalance?.lineItems) {
      for (const line of trialBalance.lineItems) {
        const coaMatch = coaAccounts.find(a => a.accountCode === line.accountCode);
        const nature = coaMatch?.nature || "DR";
        const originalBalance = Number(line.closingBalance || 0);
        const adjustment = adjustmentsByAccount[line.accountCode] || 0;
        const adjustedBalance = originalBalance + (nature === "DR" ? adjustment : -adjustment);

        accountBalances[line.accountCode] = {
          original: originalBalance,
          adjusted: adjustedBalance,
          nature,
          name: line.accountName,
          opening: 0,
          fsHeadKey: coaMatch?.fsLineItem || null
        };
      }
    } else {
      for (const coa of coaAccounts) {
        accountBalances[coa.accountCode] = {
          original: 0,
          adjusted: adjustmentsByAccount[coa.accountCode] || 0,
          nature: coa.nature,
          name: coa.accountName,
          opening: Number(coa.openingBalance || 0),
          fsHeadKey: coa.fsLineItem || null
        };
      }
    }

    const accountsByFsLineItem: Record<string, FSLineItemData> = {};
    const unmappedAccounts: Array<{ accountCode: string; accountName: string; closingBalance: number; nature: string }> = [];

    // Keyword-based classification matching Data Intake logic
    const assetKeywords = ['CASH', 'RECEIVABLES', 'INVENTORIES', 'PPE', 'INTANGIBLE', 'INVESTMENTS', 'ASSET', 'RIGHT_OF_USE', 'DEFERRED_TAX_ASSETS', 'PREPAYMENTS'];
    const liabilityKeywords = ['PAYABLES', 'BORROWINGS', 'LIABILITIES', 'DEFERRED_TAX', 'PROVISIONS', 'ACCRUALS', 'TAX_LIABILITIES'];
    const equityKeywords = ['CAPITAL', 'RESERVES', 'SURPLUS', 'EQUITY', 'RETAINED_EARNINGS'];
    const incomeKeywords = ['REVENUE', 'INCOME', 'SALES'];
    const expenseKeywords = ['COST', 'EXPENSE', 'DEPRECIATION', 'FINANCE_COSTS', 'TAX_EXPENSE', 'EMPLOYEE', 'ADMINISTRATIVE', 'SELLING'];

    const keywordTotals = {
      totalAssets: 0,
      totalLiabilities: 0,
      totalEquity: 0,
      totalIncome: 0,
      totalExpenses: 0
    };

    const classifyByKeyword = (fsLineItem: string): 'asset' | 'liability' | 'equity' | 'income' | 'expense' | null => {
      const upper = fsLineItem.toUpperCase();
      if (assetKeywords.some(kw => upper.includes(kw))) return 'asset';
      if (liabilityKeywords.some(kw => upper.includes(kw))) return 'liability';
      if (equityKeywords.some(kw => upper.includes(kw))) return 'equity';
      if (incomeKeywords.some(kw => upper.includes(kw))) return 'income';
      if (expenseKeywords.some(kw => upper.includes(kw))) return 'expense';
      return null;
    };

    // Build list of accounts to process - prefer ImportAccountBalance, fallback to CoAAccount
    const accountsToProcess: Array<{
      accountCode: string;
      accountName: string;
      nature: string;
      fsLine: string | null;
      notesRef: string | null;
    }> = [];

    if (Object.keys(accountBalances).length > 0 && importBalances.length > 0) {
      // Use accountBalances (derived from ImportAccountBalance closing balances) as source
      for (const [accountCode, balance] of Object.entries(accountBalances)) {
        accountsToProcess.push({
          accountCode,
          accountName: balance.name,
          nature: balance.nature,
          fsLine: balance.fsHeadKey,
          notesRef: null
        });
      }
    } else if (coaAccounts.length > 0) {
      // Fallback to CoAAccount
      for (const coa of coaAccounts) {
        accountsToProcess.push({
          accountCode: coa.accountCode,
          accountName: coa.accountName,
          nature: coa.nature,
          fsLine: coa.fsLineItem || null,
          notesRef: coa.notesDisclosureRef || null
        });
      }
    }

    for (const account of accountsToProcess) {
      const balance = accountBalances[account.accountCode];
      if (!balance) continue;

      const fsLine = account.fsLine;
      if (!fsLine) {
        unmappedAccounts.push({
          accountCode: account.accountCode,
          accountName: account.accountName,
          closingBalance: balance.adjusted,
          nature: account.nature
        });
        continue;
      }

      if (!accountsByFsLineItem[fsLine]) {
        accountsByFsLineItem[fsLine] = {
          fsLineItem: fsLine,
          displayName: LINE_ITEM_DISPLAY_NAMES[fsLine] || fsLine,
          accounts: [],
          originalTotal: 0,
          adjustedTotal: 0,
          adjustmentsTotal: 0,
          accountCount: 0,
          openingTotal: 0,
          notesRef: null
        };
      }

      const adjustmentAmount = (adjustmentsByAccount[account.accountCode] || 0);
      // Use the already-signed values from accountBalances (they were signed during creation)
      const signedOriginal = balance.original;
      const signedAdjusted = balance.adjusted;
      const signedAdj = adjustmentAmount;
      const signedOpening = balance.opening;

      accountsByFsLineItem[fsLine].accounts.push({
        accountCode: account.accountCode,
        accountName: account.accountName,
        nature: account.nature,
        originalAmount: signedOriginal,
        adjustedAmount: signedAdjusted,
        adjustments: signedAdj,
        isUnmapped: false
      });
      accountsByFsLineItem[fsLine].originalTotal += signedOriginal;
      accountsByFsLineItem[fsLine].adjustedTotal += signedAdjusted;
      accountsByFsLineItem[fsLine].adjustmentsTotal += signedAdj;
      accountsByFsLineItem[fsLine].accountCount++;
      accountsByFsLineItem[fsLine].openingTotal += signedOpening;

      // Set notesRef to first non-null notesRef
      if (!accountsByFsLineItem[fsLine].notesRef && account.notesRef) {
        accountsByFsLineItem[fsLine].notesRef = account.notesRef;
      }

      // Compute keyword-based totals (matching Data Intake logic)
      const category = classifyByKeyword(fsLine);
      const balanceValue = viewType === "ADJUSTED" ? signedAdjusted : signedOriginal;
      if (category === 'asset') {
        keywordTotals.totalAssets += balanceValue;
      } else if (category === 'liability') {
        keywordTotals.totalLiabilities += Math.abs(balanceValue);
      } else if (category === 'equity') {
        keywordTotals.totalEquity += Math.abs(balanceValue);
      } else if (category === 'income') {
        keywordTotals.totalIncome += Math.abs(balanceValue);
      } else if (category === 'expense') {
        keywordTotals.totalExpenses += balanceValue;
      }
    }

    const matchesFsLineItem = (actualKey: string, templateKey: string): boolean => {
      const actual = actualKey.toUpperCase().replace(/_/g, '');
      const template = templateKey.toUpperCase().replace(/_/g, '');
      if (actual === template) return true;
      if (actual.includes(template)) return true;
      if (template.includes(actual)) return true;
      const actualWords = actualKey.toUpperCase().split('_');
      const templateWords = templateKey.toUpperCase().split('_');
      const commonWords = actualWords.filter(w => templateWords.includes(w));
      return commonWords.length >= Math.min(actualWords.length, templateWords.length) * 0.6;
    };

    const usedFsLineItems = new Set<string>();

    const buildSections = (structure: Record<string, any>): FSSectionData[] => {
      const sections: FSSectionData[] = [];
      const sectionTotals: Record<string, { original: number; adjusted: number }> = {};

      for (const [sectionName, config] of Object.entries(structure)) {
        const section: FSSectionData = {
          sectionName,
          displayOrder: config.displayOrder,
          isSubtotal: config.isSubtotal || false,
          lineItems: [],
          sectionOriginalTotal: 0,
          sectionAdjustedTotal: 0
        };

        if (!config.isSubtotal) {
          for (const lineItemKey of config.lineItems) {
            let exactData = accountsByFsLineItem[lineItemKey];
            if (exactData && exactData.accountCount > 0 && !usedFsLineItems.has(lineItemKey)) {
              section.lineItems.push(exactData);
              section.sectionOriginalTotal += exactData.originalTotal;
              section.sectionAdjustedTotal += exactData.adjustedTotal;
              usedFsLineItems.add(lineItemKey);
            }
            for (const [actualKey, data] of Object.entries(accountsByFsLineItem)) {
              if (usedFsLineItems.has(actualKey)) continue;
              if (actualKey !== lineItemKey && matchesFsLineItem(actualKey, lineItemKey) && data.accountCount > 0) {
                section.lineItems.push(data);
                section.sectionOriginalTotal += data.originalTotal;
                section.sectionAdjustedTotal += data.adjustedTotal;
                usedFsLineItems.add(actualKey);
              }
            }
          }
          sectionTotals[sectionName] = {
            original: section.sectionOriginalTotal,
            adjusted: section.sectionAdjustedTotal
          };
        } else {
          if (config.subtotalOf) {
            for (const subSec of config.subtotalOf) {
              if (sectionTotals[subSec]) {
                section.sectionOriginalTotal += sectionTotals[subSec].original;
                section.sectionAdjustedTotal += sectionTotals[subSec].adjusted;
              }
            }
          }
          if (config.subtractFrom) {
            for (const subSec of config.subtractFrom) {
              if (sectionTotals[subSec]) {
                section.sectionOriginalTotal -= sectionTotals[subSec].original;
                section.sectionAdjustedTotal -= sectionTotals[subSec].adjusted;
              }
            }
          }
          sectionTotals[sectionName] = {
            original: section.sectionOriginalTotal,
            adjusted: section.sectionAdjustedTotal
          };
        }

        sections.push(section);
      }

      return sections.sort((a, b) => a.displayOrder - b.displayOrder);
    };

    const balanceSheetSections = buildSections(FS_STRUCTURE.BALANCE_SHEET);
    const profitLossSections = buildSections(FS_STRUCTURE.PROFIT_LOSS);

    const revenueSection = profitLossSections.find(s => s.sectionName === "Total Income");
    const netProfitSection = profitLossSections.find(s => s.sectionName === "Profit/(Loss) for the Year");
    const revenue = viewType === "ADJUSTED" ? (revenueSection?.sectionAdjustedTotal || 0) : (revenueSection?.sectionOriginalTotal || 0);
    const netProfit = viewType === "ADJUSTED" ? (netProfitSection?.sectionAdjustedTotal || 0) : (netProfitSection?.sectionOriginalTotal || 0);

    const currentYearProfitSection: FSSectionData = {
      sectionName: "Profit/(Loss) for the Year",
      displayOrder: 4.5,
      isSubtotal: false,
      lineItems: [{
        fsLineItem: "CURRENT_YEAR_PROFIT",
        displayName: "Profit/(Loss) for the Year",
        accounts: [],
        originalTotal: profitLossSections.find(s => s.sectionName === "Profit/(Loss) for the Year")?.sectionOriginalTotal || 0,
        adjustedTotal: profitLossSections.find(s => s.sectionName === "Profit/(Loss) for the Year")?.sectionAdjustedTotal || 0,
        adjustmentsTotal: 0,
        accountCount: 0,
        openingTotal: 0,
        notesRef: null
      }],
      sectionOriginalTotal: profitLossSections.find(s => s.sectionName === "Profit/(Loss) for the Year")?.sectionOriginalTotal || 0,
      sectionAdjustedTotal: profitLossSections.find(s => s.sectionName === "Profit/(Loss) for the Year")?.sectionAdjustedTotal || 0
    };

    const equityIdx = balanceSheetSections.findIndex(s => s.sectionName === "Share Capital & Reserves");
    if (equityIdx >= 0) {
      balanceSheetSections.splice(equityIdx + 1, 0, currentYearProfitSection);
    }

    const totalELSection = balanceSheetSections.find(s => s.sectionName === "Total Equity & Liabilities");
    if (totalELSection) {
      totalELSection.sectionOriginalTotal += currentYearProfitSection.sectionOriginalTotal;
      totalELSection.sectionAdjustedTotal += currentYearProfitSection.sectionAdjustedTotal;
    }

    const totalAssetsSection = balanceSheetSections.find(s => s.sectionName === "Total Assets");
    const totalAssets = viewType === "ADJUSTED" ? (totalAssetsSection?.sectionAdjustedTotal || 0) : (totalAssetsSection?.sectionOriginalTotal || 0);
    const totalEL = viewType === "ADJUSTED" ? (totalELSection?.sectionAdjustedTotal || 0) : (totalELSection?.sectionOriginalTotal || 0);

    const result: FSGeneratedData = {
      balanceSheet: {
        sections: balanceSheetSections,
        totalAssets: totalAssets,
        totalEquityLiabilities: totalEL,
        isBalanced: Math.abs(totalAssets - totalEL) < 0.01,
        variance: totalAssets - totalEL
      },
      profitLoss: {
        sections: profitLossSections,
        revenue: revenue,
        expenses: revenue - netProfit,
        netProfit: netProfit
      },
      unmappedAccounts,
      summary: {
        totalMappedAccounts: coaAccounts.filter(a => a.fsLineItem).length,
        totalUnmappedAccounts: unmappedAccounts.length,
        mappingCompleteness: coaAccounts.length > 0 
          ? Math.round((coaAccounts.filter(a => a.fsLineItem).length / coaAccounts.length) * 100) 
          : 0,
        generatedAt: new Date().toISOString()
      },
      keywordTotals,
      fsHeads: Object.values(accountsByFsLineItem).map(item => ({
        fsLineItem: item.fsLineItem,
        displayName: item.displayName,
        accountCount: item.accountCount,
        debitTotal: item.originalTotal > 0 ? item.originalTotal : 0,
        creditTotal: item.originalTotal < 0 ? Math.abs(item.originalTotal) : 0,
        netBalance: viewType === "ADJUSTED" ? item.adjustedTotal : item.originalTotal,
        adjustedNetBalance: item.adjustedTotal,
        openingTotal: item.openingTotal,
        notesRef: item.notesRef
      }))
    };

    res.json(result);
  } catch (error) {
    console.error("Error generating FS draft:", error);
    res.status(500).json({ error: "Failed to generate financial statement draft" });
  }
});

const saveSnapshotSchema = z.object({
  snapshotName: z.string().min(1),
  snapshotType: z.enum(["UNADJUSTED", "ADJUSTED", "FINAL"]).default("ADJUSTED"),
  notes: z.string().optional()
});

router.post("/:engagementId/snapshot", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const data = saveSnapshotSchema.parse(req.body);
    const userId = req.user!.id;
    const firmId = req.user!.firmId;

    if (!firmId) {
      return res.status(400).json({ error: "User not associated with a firm" });
    }

    const engagement = await prisma.engagement.findUnique({
      where: { id: engagementId }
    });

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    let fsStructure = await prisma.fSStructure.findFirst({
      where: { engagementId, isActive: true }
    });

    if (!fsStructure) {
      fsStructure = await prisma.fSStructure.create({
        data: {
          engagementId,
          firmId,
          name: "Default FS Structure",
          fsType: "BALANCE_SHEET",
          reportingFramework: "IFRS",
          fiscalYear: new Date().getFullYear(),
          createdById: userId
        }
      });
    }

    const existingSnapshots = await prisma.fSSnapshot.count({
      where: { engagementId }
    });

    const periodStart = engagement.periodStart || new Date();
    const periodEnd = engagement.periodEnd || new Date();

    const snapshot = await prisma.fSSnapshot.create({
      data: {
        structureId: fsStructure.id,
        engagementId,
        firmId,
        snapshotName: data.snapshotName,
        snapshotType: data.snapshotType,
        version: existingSnapshots + 1,
        fsType: "BALANCE_SHEET",
        fiscalYear: new Date().getFullYear(),
        periodStart,
        periodEnd,
        preparedById: userId,
        preparedAt: new Date()
      }
    });

    res.status(201).json(snapshot);
  } catch (error) {
    console.error("Error saving FS snapshot:", error);
    res.status(500).json({ error: "Failed to save snapshot" });
  }
});

router.get("/:engagementId/snapshots", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;

    const snapshots = await prisma.fSSnapshot.findMany({
      where: { engagementId },
      orderBy: { createdAt: "desc" },
      include: {
        preparedBy: {
          select: { id: true, fullName: true }
        }
      }
    });

    res.json(snapshots);
  } catch (error) {
    console.error("Error fetching FS snapshots:", error);
    res.status(500).json({ error: "Failed to fetch snapshots" });
  }
});

router.get("/:engagementId/snapshots/:snapshotId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { snapshotId } = req.params;

    const snapshot = await prisma.fSSnapshot.findUnique({
      where: { id: snapshotId },
      include: {
        preparedBy: { select: { id: true, fullName: true } },
        lines: true
      }
    });

    if (!snapshot) {
      return res.status(404).json({ error: "Snapshot not found" });
    }

    res.json(snapshot);
  } catch (error) {
    console.error("Error fetching FS snapshot:", error);
    res.status(500).json({ error: "Failed to fetch snapshot" });
  }
});

router.get("/:engagementId/drilldown/:fsLineItem", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId, fsLineItem } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const dateFrom = req.query.dateFrom as string;
    const dateTo = req.query.dateTo as string;
    const minAmount = req.query.minAmount ? parseFloat(req.query.minAmount as string) : undefined;
    const maxAmount = req.query.maxAmount ? parseFloat(req.query.maxAmount as string) : undefined;
    const partyFilter = req.query.party as string;

    const engagement = await prisma.engagement.findUnique({
      where: { id: engagementId }
    });

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    const importBalances = await prisma.importAccountBalance.findMany({
      where: {
        engagementId,
        fsHeadKey: fsLineItem
      },
      orderBy: { accountCode: "asc" }
    });

    const coaAccounts = await prisma.coAAccount.findMany({
      where: { 
        engagementId,
        fsLineItem: fsLineItem
      },
      orderBy: { accountCode: "asc" }
    });

    const importClosingRecords = importBalances.filter(b => b.balanceType === 'CB');
    const useImportData = importClosingRecords.length > 0;

    if (!useImportData && coaAccounts.length === 0) {
      return res.json({
        fsLineItem,
        displayName: LINE_ITEM_DISPLAY_NAMES[fsLineItem] || fsLineItem,
        accounts: [],
        population: [],
        mapping: {
          fsHead: fsLineItem,
          class: null,
          subClass: null,
          mappedGlCount: 0
        },
        totals: {
          accountsTotal: 0,
          populationCount: 0,
          populationDr: 0,
          populationCr: 0,
          populationNet: 0
        }
      });
    }

    let accountCodes: string[] = [];
    let accounts: Array<{ glCode: string; glName: string; opening: number; periodDr: number; periodCr: number; closing: number; net: number }> = [];
    let mappingClass: string | null = null;
    let mappingSubClass: string | null = null;

    if (useImportData) {
      const closingByCode: Record<string, { debit: number; credit: number; name: string; accountClass: string | null; accountSubclass: string | null }> = {};
      const openingByCode: Record<string, { debit: number; credit: number }> = {};

      for (const line of importBalances) {
        const debit = Number(line.debitAmount) || 0;
        const credit = Number(line.creditAmount) || 0;

        if (line.balanceType === 'CB') {
          closingByCode[line.accountCode] = {
            debit,
            credit,
            name: line.accountName || '',
            accountClass: line.accountClass || null,
            accountSubclass: line.accountSubclass || null
          };
        } else if (line.balanceType === 'OB') {
          openingByCode[line.accountCode] = { debit, credit };
        }
      }

      accountCodes = Object.keys(closingByCode);
      const firstEntry = Object.values(closingByCode)[0];
      mappingClass = firstEntry?.accountClass || null;
      mappingSubClass = firstEntry?.accountSubclass || null;

      accounts = accountCodes.map(code => {
        const closing = closingByCode[code];
        const opening = openingByCode[code] || { debit: 0, credit: 0 };

        const openingNet = opening.debit - opening.credit;
        const closingNet = closing.debit - closing.credit;
        const periodDr = closing.debit - opening.debit;
        const periodCr = closing.credit - opening.credit;

        return {
          glCode: code,
          glName: closing.name,
          opening: openingNet,
          periodDr: periodDr > 0 ? periodDr : 0,
          periodCr: periodCr > 0 ? periodCr : 0,
          closing: closingNet,
          net: closingNet
        };
      });
    } else {
      accountCodes = coaAccounts.map(a => a.accountCode);
      mappingClass = coaAccounts[0]?.accountClass || null;
      mappingSubClass = coaAccounts[0]?.accountSubclass || null;

      accounts = coaAccounts.map(coa => ({
        glCode: coa.accountCode,
        glName: coa.accountName,
        opening: Number(coa.openingBalance || 0),
        periodDr: Number(coa.periodDr || 0),
        periodCr: Number(coa.periodCr || 0),
        closing: Number(coa.closingBalance || 0),
        net: Number(coa.closingBalance || 0)
      }));
    }

    const accountsTotal = accounts.reduce((sum, a) => sum + a.closing, 0);

    const glBatches = await prisma.gLBatch.findMany({
      where: { engagementId, status: "APPROVED" },
      select: { id: true }
    });
    const batchIds = glBatches.map(b => b.id);

    let glWhereClause: any = {
      engagementId,
      accountCode: { in: accountCodes }
    };
    
    if (batchIds.length > 0) {
      glWhereClause.batchId = { in: batchIds };
    }
    
    if (dateFrom || dateTo) {
      glWhereClause.transactionDate = {};
      if (dateFrom) glWhereClause.transactionDate.gte = new Date(dateFrom);
      if (dateTo) glWhereClause.transactionDate.lte = new Date(dateTo);
    }
    
    if (partyFilter) {
      glWhereClause.counterparty = { contains: partyFilter, mode: 'insensitive' };
    }

    const totalPopulationCount = await prisma.gLEntry.count({
      where: glWhereClause
    });

    const populationAggregates = await prisma.gLEntry.aggregate({
      where: glWhereClause,
      _sum: {
        debit: true,
        credit: true
      }
    });

    const populationDr = Number(populationAggregates._sum.debit || 0);
    const populationCr = Number(populationAggregates._sum.credit || 0);
    const populationNet = populationDr - populationCr;

    let glEntries = await prisma.gLEntry.findMany({
      where: glWhereClause,
      orderBy: { transactionDate: "desc" },
      skip: (page - 1) * limit,
      take: limit
    });

    if (minAmount !== undefined || maxAmount !== undefined) {
      glEntries = glEntries.filter(entry => {
        const amount = Math.max(Number(entry.debit), Number(entry.credit));
        if (minAmount !== undefined && amount < minAmount) return false;
        if (maxAmount !== undefined && amount > maxAmount) return false;
        return true;
      });
    }

    const population = glEntries.map(entry => ({
      postingDate: entry.transactionDate.toISOString().split('T')[0],
      voucherNo: entry.voucherNumber || entry.referenceNumber || '-',
      glCode: entry.accountCode,
      partyId: entry.counterparty || null,
      narrative: entry.narrative || entry.description || null,
      debit: Number(entry.debit || 0),
      credit: Number(entry.credit || 0),
      net: Number(entry.debit || 0) - Number(entry.credit || 0),
      sourceModule: entry.documentType || null
    }));

    const mapping = {
      fsHead: fsLineItem,
      class: mappingClass,
      subClass: mappingSubClass,
      mappedGlCount: accounts.length
    };

    res.json({
      fsLineItem,
      displayName: LINE_ITEM_DISPLAY_NAMES[fsLineItem] || fsLineItem,
      accounts,
      population,
      mapping,
      totals: {
        accountsTotal,
        populationCount: totalPopulationCount,
        populationDr,
        populationCr,
        populationNet
      },
      pagination: {
        page,
        limit,
        totalCount: totalPopulationCount,
        totalPages: Math.ceil(totalPopulationCount / limit)
      }
    });
  } catch (error) {
    console.error("Error fetching FS drilldown:", error);
    res.status(500).json({ error: "Failed to fetch drilldown data" });
  }
});

export default router;
