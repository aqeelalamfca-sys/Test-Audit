interface ClassificationResult {
  accountClass: string;
  accountSubclass: string;
  fsHeadKey: string;
  source: 'RULE' | 'AI' | 'MANUAL';
  confidence: number;
}

interface ClassificationRule {
  pattern: RegExp;
  codeRange?: { min: number; max: number };
  accountClass: string;
  accountSubclass: string;
  fsHeadKey: string;
  priority: number;
}

const CLASSIFICATION_RULES: ClassificationRule[] = [
  // Cash & Bank accounts (10xxx series or name patterns)
  { pattern: /^10[0-9]{2,3}$/, accountClass: 'ASSET', accountSubclass: 'CURRENT_ASSET', fsHeadKey: 'CASH_EQUIVALENTS', priority: 10 },
  { pattern: /cash|bank|petty\s*cash/i, accountClass: 'ASSET', accountSubclass: 'CURRENT_ASSET', fsHeadKey: 'CASH_EQUIVALENTS', priority: 5 },
  
  // Trade Receivables (11xxx series or name patterns)
  { pattern: /^11[0-9]{2,3}$/, accountClass: 'ASSET', accountSubclass: 'CURRENT_ASSET', fsHeadKey: 'TRADE_RECEIVABLES', priority: 10 },
  { pattern: /trade\s*receiv|accounts\s*receiv|debtors?|customer/i, accountClass: 'ASSET', accountSubclass: 'CURRENT_ASSET', fsHeadKey: 'TRADE_RECEIVABLES', priority: 5 },
  
  // Inventories (12xxx series or name patterns)
  { pattern: /^12[0-9]{2,3}$/, accountClass: 'ASSET', accountSubclass: 'CURRENT_ASSET', fsHeadKey: 'INVENTORIES', priority: 10 },
  { pattern: /inventor|stock|raw\s*material|finished\s*goods|work\s*in\s*progress|wip/i, accountClass: 'ASSET', accountSubclass: 'CURRENT_ASSET', fsHeadKey: 'INVENTORIES', priority: 5 },
  
  // Other Current Assets (13xxx series)
  { pattern: /^13[0-9]{2,3}$/, accountClass: 'ASSET', accountSubclass: 'CURRENT_ASSET', fsHeadKey: 'OTHER_CURRENT_ASSETS', priority: 10 },
  { pattern: /prepaid|advance|deposit|other\s*current\s*asset/i, accountClass: 'ASSET', accountSubclass: 'CURRENT_ASSET', fsHeadKey: 'OTHER_CURRENT_ASSETS', priority: 5 },
  
  // Property, Plant & Equipment (14xxx, 15xxx series)
  { pattern: /^1[45][0-9]{2,3}$/, accountClass: 'ASSET', accountSubclass: 'FIXED_ASSET', fsHeadKey: 'PPE', priority: 10 },
  { pattern: /property|plant|equipment|machinery|vehicle|furniture|building|land|fixed\s*asset|ppe|depreciation/i, accountClass: 'ASSET', accountSubclass: 'FIXED_ASSET', fsHeadKey: 'PPE', priority: 5 },
  
  // Intangible Assets (16xxx series)
  { pattern: /^16[0-9]{2,3}$/, accountClass: 'ASSET', accountSubclass: 'INTANGIBLE_ASSET', fsHeadKey: 'INTANGIBLE_ASSETS', priority: 10 },
  { pattern: /intangible|goodwill|patent|trademark|software|license|amort/i, accountClass: 'ASSET', accountSubclass: 'INTANGIBLE_ASSET', fsHeadKey: 'INTANGIBLE_ASSETS', priority: 5 },
  
  // Investments (17xxx series)
  { pattern: /^17[0-9]{2,3}$/, accountClass: 'ASSET', accountSubclass: 'NON_CURRENT_ASSET', fsHeadKey: 'INVESTMENTS', priority: 10 },
  { pattern: /invest|subsid|associat|joint\s*venture/i, accountClass: 'ASSET', accountSubclass: 'NON_CURRENT_ASSET', fsHeadKey: 'INVESTMENTS', priority: 5 },
  
  // Trade Payables (20xxx series)
  { pattern: /^20[0-9]{2,3}$/, accountClass: 'LIABILITY', accountSubclass: 'CURRENT_LIABILITY', fsHeadKey: 'TRADE_PAYABLES', priority: 10 },
  { pattern: /trade\s*payab|accounts\s*payab|creditors?|supplier|vendor/i, accountClass: 'LIABILITY', accountSubclass: 'CURRENT_LIABILITY', fsHeadKey: 'TRADE_PAYABLES', priority: 5 },
  
  // Short-term Borrowings (21xxx series)
  { pattern: /^21[0-9]{2,3}$/, accountClass: 'LIABILITY', accountSubclass: 'CURRENT_LIABILITY', fsHeadKey: 'SHORT_TERM_BORROWINGS', priority: 10 },
  { pattern: /short\s*term\s*loan|overdraft|current\s*portion|running\s*finance/i, accountClass: 'LIABILITY', accountSubclass: 'CURRENT_LIABILITY', fsHeadKey: 'SHORT_TERM_BORROWINGS', priority: 5 },
  
  // Other Current Liabilities (22xxx, 23xxx series)
  { pattern: /^2[23][0-9]{2,3}$/, accountClass: 'LIABILITY', accountSubclass: 'CURRENT_LIABILITY', fsHeadKey: 'OTHER_CURRENT_LIABILITIES', priority: 10 },
  { pattern: /accrued|accrual|payroll\s*payab|tax\s*payab|provision|deferred\s*revenue|unearned/i, accountClass: 'LIABILITY', accountSubclass: 'CURRENT_LIABILITY', fsHeadKey: 'OTHER_CURRENT_LIABILITIES', priority: 5 },
  
  // Long-term Borrowings (24xxx, 25xxx series)
  { pattern: /^2[45][0-9]{2,3}$/, accountClass: 'LIABILITY', accountSubclass: 'NON_CURRENT_LIABILITY', fsHeadKey: 'LONG_TERM_BORROWINGS', priority: 10 },
  { pattern: /long\s*term\s*loan|term\s*finance|bond|debenture|mortgage/i, accountClass: 'LIABILITY', accountSubclass: 'NON_CURRENT_LIABILITY', fsHeadKey: 'LONG_TERM_BORROWINGS', priority: 5 },
  
  // Deferred Tax (26xxx series)
  { pattern: /^26[0-9]{2,3}$/, accountClass: 'LIABILITY', accountSubclass: 'NON_CURRENT_LIABILITY', fsHeadKey: 'DEFERRED_TAX', priority: 10 },
  { pattern: /deferred\s*tax/i, accountClass: 'LIABILITY', accountSubclass: 'NON_CURRENT_LIABILITY', fsHeadKey: 'DEFERRED_TAX', priority: 5 },
  
  // Share Capital (30xxx series)
  { pattern: /^30[0-9]{2,3}$/, accountClass: 'EQUITY', accountSubclass: 'SHARE_CAPITAL', fsHeadKey: 'SHARE_CAPITAL', priority: 10 },
  { pattern: /share\s*capital|common\s*stock|ordinary\s*share|preference\s*share|paid.?in\s*capital/i, accountClass: 'EQUITY', accountSubclass: 'SHARE_CAPITAL', fsHeadKey: 'SHARE_CAPITAL', priority: 5 },
  
  // Reserves & Surplus (31xxx, 32xxx series)
  { pattern: /^3[12][0-9]{2,3}$/, accountClass: 'EQUITY', accountSubclass: 'RESERVES', fsHeadKey: 'RESERVES_SURPLUS', priority: 10 },
  { pattern: /reserve|surplus|retained\s*earn|accumulate|revaluation/i, accountClass: 'EQUITY', accountSubclass: 'RESERVES', fsHeadKey: 'RESERVES_SURPLUS', priority: 5 },
  
  // Revenue from Operations (40xxx series)
  { pattern: /^40[0-9]{2,3}$/, accountClass: 'INCOME', accountSubclass: 'OPERATING_REVENUE', fsHeadKey: 'REVENUE_OPERATIONS', priority: 10 },
  { pattern: /sales|revenue|income\s*from\s*operation|service\s*income|turnover/i, accountClass: 'INCOME', accountSubclass: 'OPERATING_REVENUE', fsHeadKey: 'REVENUE_OPERATIONS', priority: 5 },
  
  // Other Income (41xxx, 42xxx series)
  { pattern: /^4[12][0-9]{2,3}$/, accountClass: 'INCOME', accountSubclass: 'OTHER_INCOME', fsHeadKey: 'OTHER_INCOME', priority: 10 },
  { pattern: /other\s*income|interest\s*income|dividend\s*income|gain\s*on|rental\s*income/i, accountClass: 'INCOME', accountSubclass: 'OTHER_INCOME', fsHeadKey: 'OTHER_INCOME', priority: 5 },
  
  // Cost of Materials (50xxx series)
  { pattern: /^50[0-9]{2,3}$/, accountClass: 'EXPENSE', accountSubclass: 'COST_OF_SALES', fsHeadKey: 'COST_MATERIALS', priority: 10 },
  { pattern: /cost\s*of\s*(goods\s*)?sold|cogs|material\s*cost|purchase|direct\s*cost/i, accountClass: 'EXPENSE', accountSubclass: 'COST_OF_SALES', fsHeadKey: 'COST_MATERIALS', priority: 5 },
  
  // Employee Benefits (51xxx, 52xxx series)
  { pattern: /^5[12][0-9]{2,3}$/, accountClass: 'EXPENSE', accountSubclass: 'OPERATING_EXPENSE', fsHeadKey: 'EMPLOYEE_BENEFITS', priority: 10 },
  { pattern: /salar|wage|employee|staff|payroll|bonus|benefit|pension|gratuity/i, accountClass: 'EXPENSE', accountSubclass: 'OPERATING_EXPENSE', fsHeadKey: 'EMPLOYEE_BENEFITS', priority: 5 },
  
  // Depreciation (53xxx series)
  { pattern: /^53[0-9]{2,3}$/, accountClass: 'EXPENSE', accountSubclass: 'OPERATING_EXPENSE', fsHeadKey: 'DEPRECIATION', priority: 10 },
  { pattern: /depreciation|amortization|impairment/i, accountClass: 'EXPENSE', accountSubclass: 'OPERATING_EXPENSE', fsHeadKey: 'DEPRECIATION', priority: 5 },
  
  // Other Expenses (54xxx - 59xxx series)
  { pattern: /^5[4-9][0-9]{2,3}$/, accountClass: 'EXPENSE', accountSubclass: 'OPERATING_EXPENSE', fsHeadKey: 'OTHER_EXPENSES', priority: 10 },
  { pattern: /rent|utilit|insurance|repair|maintenance|travel|marketing|advertis|office|admin|general\s*expense|operating\s*expense/i, accountClass: 'EXPENSE', accountSubclass: 'OPERATING_EXPENSE', fsHeadKey: 'OTHER_EXPENSES', priority: 5 },
  
  // Finance Costs (60xxx series)
  { pattern: /^60[0-9]{2,3}$/, accountClass: 'EXPENSE', accountSubclass: 'FINANCE_COST', fsHeadKey: 'FINANCE_COSTS', priority: 10 },
  { pattern: /interest\s*expense|finance\s*cost|finance\s*charge|bank\s*charge|loan\s*interest/i, accountClass: 'EXPENSE', accountSubclass: 'FINANCE_COST', fsHeadKey: 'FINANCE_COSTS', priority: 5 },
  
  // Tax Expense (70xxx series)
  { pattern: /^70[0-9]{2,3}$/, accountClass: 'EXPENSE', accountSubclass: 'TAX_EXPENSE', fsHeadKey: 'TAX_EXPENSE', priority: 10 },
  { pattern: /income\s*tax|tax\s*expense|current\s*tax|corporate\s*tax/i, accountClass: 'EXPENSE', accountSubclass: 'TAX_EXPENSE', fsHeadKey: 'TAX_EXPENSE', priority: 5 },
];

export function classifyAccount(accountCode: string, accountName: string): ClassificationResult | null {
  let bestMatch: ClassificationResult | null = null;
  let bestPriority = 0;

  for (const rule of CLASSIFICATION_RULES) {
    let matches = false;
    
    // Check if the pattern matches account code or name
    if (rule.pattern.test(accountCode) || rule.pattern.test(accountName || '')) {
      matches = true;
    }
    
    // Check code range if specified
    if (rule.codeRange) {
      const codeNum = parseInt(accountCode, 10);
      if (!isNaN(codeNum) && codeNum >= rule.codeRange.min && codeNum <= rule.codeRange.max) {
        matches = true;
      }
    }
    
    if (matches && rule.priority > bestPriority) {
      bestPriority = rule.priority;
      bestMatch = {
        accountClass: rule.accountClass,
        accountSubclass: rule.accountSubclass,
        fsHeadKey: rule.fsHeadKey,
        source: 'RULE',
        confidence: rule.priority >= 10 ? 95 : 75,
      };
    }
  }

  return bestMatch;
}

export function classifyAccountBatch(accounts: Array<{ accountCode: string; accountName: string }>): Array<ClassificationResult | null> {
  return accounts.map(acc => classifyAccount(acc.accountCode, acc.accountName));
}

export function getDefaultClassificationForCode(accountCode: string): ClassificationResult {
  const codeNum = parseInt(accountCode, 10);
  
  // Default classification based on first digit of account code
  if (!isNaN(codeNum)) {
    const firstDigit = Math.floor(codeNum / 10000) || Math.floor(codeNum / 1000);
    
    switch (firstDigit) {
      case 1:
        return { accountClass: 'ASSET', accountSubclass: 'CURRENT_ASSET', fsHeadKey: 'OTHER_CURRENT_ASSETS', source: 'RULE', confidence: 50 };
      case 2:
        return { accountClass: 'LIABILITY', accountSubclass: 'CURRENT_LIABILITY', fsHeadKey: 'OTHER_CURRENT_LIABILITIES', source: 'RULE', confidence: 50 };
      case 3:
        return { accountClass: 'EQUITY', accountSubclass: 'RESERVES', fsHeadKey: 'RESERVES_SURPLUS', source: 'RULE', confidence: 50 };
      case 4:
        return { accountClass: 'INCOME', accountSubclass: 'OPERATING_REVENUE', fsHeadKey: 'REVENUE_OPERATIONS', source: 'RULE', confidence: 50 };
      case 5:
      case 6:
      case 7:
        return { accountClass: 'EXPENSE', accountSubclass: 'OPERATING_EXPENSE', fsHeadKey: 'OTHER_EXPENSES', source: 'RULE', confidence: 50 };
      default:
        return { accountClass: 'ASSET', accountSubclass: 'CURRENT_ASSET', fsHeadKey: 'OTHER_CURRENT_ASSETS', source: 'RULE', confidence: 30 };
    }
  }
  
  return { accountClass: 'ASSET', accountSubclass: 'CURRENT_ASSET', fsHeadKey: 'OTHER_CURRENT_ASSETS', source: 'RULE', confidence: 30 };
}
