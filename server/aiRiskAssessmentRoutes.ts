import { Router, Response } from "express";
import { prisma } from "./db";
import { requireAuth, type AuthenticatedRequest } from "./auth";
import { Decimal } from "@prisma/client/runtime/library";

const router = Router();

const FS_HEAD_LABELS: Record<string, string> = {
  CASH_EQUIVALENTS: "Cash and Cash Equivalents",
  CASH_AND_CASH_EQUIVALENTS: "Cash and Cash Equivalents",
  CASH: "Cash",
  BANK: "Bank",
  TRADE_RECEIVABLES: "Trade Receivables",
  RECEIVABLES: "Receivables",
  OTHER_RECEIVABLES: "Other Receivables",
  INVENTORIES: "Inventories",
  INVENTORY: "Inventory",
  STOCK: "Stock",
  PREPAYMENTS: "Prepayments",
  ADVANCES: "Advances",
  ADVANCES_AND_PREPAYMENTS: "Advances and Prepayments",
  SHORT_TERM_INVESTMENTS: "Short-term Investments",
  OTHER_CURRENT_ASSETS: "Other Current Assets",
  CURRENT_ASSETS: "Current Assets",
  PPE: "Property, Plant & Equipment",
  PROPERTY_PLANT_EQUIPMENT: "Property, Plant & Equipment",
  FIXED_ASSETS: "Fixed Assets",
  CAPITAL_WIP: "Capital Work in Progress",
  INTANGIBLE_ASSETS: "Intangible Assets",
  RIGHT_OF_USE_ASSETS: "Right-of-Use Assets",
  LONG_TERM_INVESTMENTS: "Long-term Investments",
  INVESTMENTS: "Investments",
  INVESTMENT_PROPERTY: "Investment Property",
  DEFERRED_TAX_ASSETS: "Deferred Tax Assets",
  OTHER_NON_CURRENT_ASSETS: "Other Non-Current Assets",
  TRADE_PAYABLES: "Trade Payables",
  PAYABLES: "Payables",
  CREDITORS: "Creditors",
  OTHER_PAYABLES: "Other Payables",
  SHORT_TERM_BORROWINGS: "Short-term Borrowings",
  SHORT_TERM_LOANS: "Short-term Loans",
  TAX_LIABILITIES: "Current Tax Liabilities",
  TAX_PAYABLE: "Tax Payable",
  ACCRUALS: "Accrued Expenses",
  ACCRUED_EXPENSES: "Accrued Expenses",
  ACCRUED_LIABILITIES: "Accrued Liabilities",
  OTHER_CURRENT_LIABILITIES: "Other Current Liabilities",
  CURRENT_LIABILITIES: "Current Liabilities",
  LONG_TERM_BORROWINGS: "Long-term Borrowings",
  LONG_TERM_LOANS: "Long-term Loans",
  LONG_TERM_LIABILITIES: "Long-term Liabilities",
  DEFERRED_TAX: "Deferred Tax Liabilities",
  DEFERRED_TAX_LIABILITY: "Deferred Tax Liabilities",
  PROVISIONS: "Provisions",
  OTHER_NON_CURRENT_LIABILITIES: "Other Non-Current Liabilities",
  SHARE_CAPITAL: "Share Capital",
  CAPITAL: "Capital",
  RESERVES_SURPLUS: "Reserves & Surplus",
  RESERVES: "Reserves",
  SURPLUS: "Surplus",
  RETAINED_EARNINGS: "Retained Earnings",
  ACCUMULATED_PROFITS: "Accumulated Profits",
  EQUITY: "Equity",
  SHAREHOLDERS_EQUITY: "Shareholders' Equity",
  REVENUE_OPERATIONS: "Revenue from Operations",
  REVENUE: "Revenue",
  SERVICE_REVENUE: "Service Revenue",
  SALES_REVENUE: "Sales Revenue",
  SALES: "Sales",
  TURNOVER: "Turnover",
  INCOME_FROM_OPERATIONS: "Income from Operations",
  OTHER_INCOME: "Other Income",
  INTEREST_INCOME: "Interest Income",
  DIVIDEND_INCOME: "Dividend Income",
  OTHER_OPERATING_INCOME: "Other Operating Income",
  MISCELLANEOUS_INCOME: "Miscellaneous Income",
  COST_MATERIALS: "Cost of Materials Consumed",
  COST_OF_GOODS_SOLD: "Cost of Goods Sold",
  COST_OF_SALES: "Cost of Sales",
  COGS: "Cost of Goods Sold",
  DIRECT_COSTS: "Direct Costs",
  PURCHASES: "Purchases",
  MANUFACTURING_COSTS: "Manufacturing Costs",
  EMPLOYEE_BENEFITS: "Employee Benefits Expense",
  SALARIES: "Salaries",
  WAGES: "Wages",
  DEPRECIATION: "Depreciation",
  DEPRECIATION_AMORTIZATION: "Depreciation & Amortization",
  AMORTIZATION: "Amortization",
  ADMINISTRATIVE_EXPENSES: "Administrative Expenses",
  ADMIN_EXPENSES: "Administrative Expenses",
  SELLING_EXPENSES: "Selling & Distribution Expenses",
  DISTRIBUTION_EXPENSES: "Distribution Expenses",
  OTHER_EXPENSES: "Other Expenses",
  OPERATING_EXPENSES: "Operating Expenses",
  GENERAL_EXPENSES: "General Expenses",
  FINANCE_COSTS: "Finance Costs",
  INTEREST_EXPENSE: "Interest Expense",
  BANK_CHARGES: "Bank Charges",
  FINANCIAL_CHARGES: "Financial Charges",
  TAX_EXPENSE: "Tax Expense",
  CURRENT_TAX: "Current Tax",
  DEFERRED_TAX_EXPENSE: "Deferred Tax Expense",
  INCOME_TAX: "Income Tax",
  TAXATION: "Taxation",
};

const ESTIMATION_ACCOUNTS = [
  "PROVISIONS", "DEFERRED_TAX", "DEFERRED_TAX_ASSETS", "DEFERRED_TAX_EXPENSE",
  "INTANGIBLE_ASSETS", "RIGHT_OF_USE_ASSETS", "INVENTORIES", "INVENTORY",
  "DEPRECIATION", "DEPRECIATION_AMORTIZATION", "AMORTIZATION",
  "OTHER_NON_CURRENT_LIABILITIES", "LONG_TERM_BORROWINGS", "INVESTMENTS"
];

const ISA_330_PROCEDURE_MAP: Record<string, Record<string, string[]>> = {
  'Trade Receivables': {
    'Existence': ['AR-01-CONFIRM', 'AR-02-CUTOFF', 'AR-03-AGE'],
    'Valuation': ['AR-04-PROVISION', 'AR-05-ALLOWANCE', 'AR-06-NRV'],
    'Completeness': ['AR-07-SEARCH-UNRECORDED', 'AR-08-SUBSEQUENT-RECEIPTS'],
    'Rights & Obligations': ['AR-09-OWNERSHIP', 'AR-10-PLEDGE-CHECK'],
    'Cut-off': ['AR-02-CUTOFF', 'AR-11-SALES-CUTOFF'],
    'Classification': ['AR-12-CLASSIFICATION', 'AR-13-CURRENT-NONCURRENT'],
    'Presentation': ['AR-14-DISCLOSURE', 'AR-15-RELATED-PARTY']
  },
  'Receivables': {
    'Existence': ['AR-01-CONFIRM', 'AR-02-CUTOFF', 'AR-03-AGE'],
    'Valuation': ['AR-04-PROVISION', 'AR-05-ALLOWANCE', 'AR-06-NRV'],
    'Completeness': ['AR-07-SEARCH-UNRECORDED', 'AR-08-SUBSEQUENT-RECEIPTS'],
    'Rights & Obligations': ['AR-09-OWNERSHIP', 'AR-10-PLEDGE-CHECK'],
    'Cut-off': ['AR-02-CUTOFF', 'AR-11-SALES-CUTOFF']
  },
  'Revenue': {
    'Occurrence': ['REV-01-VOUCHING', 'REV-02-CUTOFF', 'REV-03-CONTRACT'],
    'Existence': ['REV-01-VOUCHING', 'REV-02-CUTOFF', 'REV-03-CONTRACT'],
    'Accuracy': ['REV-04-RECALC', 'REV-05-RECONCILE', 'REV-06-PRICING'],
    'Completeness': ['REV-07-SEQUENCE-CHECK', 'REV-08-GDN-RECONCILE'],
    'Cut-off': ['REV-02-CUTOFF', 'REV-09-PERIOD-END-TESTING'],
    'Classification': ['REV-10-CLASSIFICATION', 'REV-11-DISAGGREGATION'],
    'Presentation': ['REV-12-DISCLOSURE', 'REV-13-IFRS15-COMPLIANCE']
  },
  'Inventories': {
    'Existence': ['INV-01-COUNT', 'INV-02-OBSERVATION', 'INV-03-RECOUNT'],
    'Valuation': ['INV-04-COST', 'INV-05-NRV', 'INV-06-OBSOLESCENCE'],
    'Completeness': ['INV-07-CUTOFF', 'INV-08-CONSIGNMENT', 'INV-09-TRANSIT'],
    'Rights & Obligations': ['INV-10-OWNERSHIP', 'INV-11-PLEDGE-CHECK'],
    'Accuracy': ['INV-12-COSTING', 'INV-13-OVERHEAD-ALLOCATION']
  },
  'PPE': {
    'Existence': ['PPE-01-PHYSICAL', 'PPE-02-VERIFICATION', 'PPE-03-ADDITIONS'],
    'Valuation': ['PPE-04-DEPRECIATION', 'PPE-05-IMPAIRMENT', 'PPE-06-REVALUATION'],
    'Completeness': ['PPE-07-ADDITIONS-COMPLETE', 'PPE-08-CWIP-TRANSFER'],
    'Rights & Obligations': ['PPE-09-OWNERSHIP', 'PPE-10-TITLE-DOCS'],
    'Classification': ['PPE-11-CLASSIFICATION', 'PPE-12-USEFUL-LIFE'],
    'Presentation': ['PPE-13-DISCLOSURE', 'PPE-14-PLEDGES']
  },
  'Payables': {
    'Completeness': ['AP-01-SEARCH-UNRECORDED', 'AP-02-SUBSEQUENT-PAYMENTS', 'AP-03-CUTOFF'],
    'Accuracy': ['AP-04-RECONCILIATION', 'AP-05-INVOICE-MATCH'],
    'Cut-off': ['AP-03-CUTOFF', 'AP-06-PERIOD-END-TESTING'],
    'Existence': ['AP-07-CONFIRMATION', 'AP-08-VOUCHING'],
    'Classification': ['AP-09-CLASSIFICATION', 'AP-10-CURRENT-NONCURRENT'],
    'Presentation': ['AP-11-DISCLOSURE', 'AP-12-RELATED-PARTY']
  },
  'Borrowings': {
    'Completeness': ['DEBT-01-CONFIRMATION', 'DEBT-02-AGREEMENTS-REVIEW'],
    'Valuation': ['DEBT-03-INTEREST-RECALC', 'DEBT-04-AMORTIZATION'],
    'Classification': ['DEBT-05-CURRENT-NONCURRENT', 'DEBT-06-COVENANT-CHECK'],
    'Existence': ['DEBT-01-CONFIRMATION', 'DEBT-07-BANK-RECONCILE'],
    'Rights & Obligations': ['DEBT-08-TERMS-REVIEW', 'DEBT-09-SECURITY-CHECK'],
    'Presentation': ['DEBT-10-DISCLOSURE', 'DEBT-11-MATURITY-ANALYSIS']
  },
  'Cash': {
    'Existence': ['CASH-01-CONFIRMATION', 'CASH-02-COUNT', 'CASH-03-RECONCILE'],
    'Completeness': ['CASH-04-BANK-STMT-REVIEW', 'CASH-05-RECONCILE-ALL'],
    'Accuracy': ['CASH-06-TRANSLATION', 'CASH-07-RECONCILE-ITEMS'],
    'Rights & Obligations': ['CASH-08-RESTRICTIONS', 'CASH-09-PLEDGES'],
    'Valuation': ['CASH-06-TRANSLATION', 'CASH-10-YEAR-END-RATE'],
    'Cut-off': ['CASH-11-CUTOFF-BANK', 'CASH-12-OUTSTANDING-CHECKS']
  },
  'Provisions': {
    'Existence': ['PROV-01-DOCUMENTATION', 'PROV-02-LEGAL-CONFIRM'],
    'Valuation': ['PROV-03-ESTIMATE-REVIEW', 'PROV-04-ASSUMPTIONS', 'PROV-05-SENSITIVITY'],
    'Completeness': ['PROV-06-SEARCH-CONTINGENT', 'PROV-07-LEGAL-MATTERS'],
    'Accuracy': ['PROV-08-RECALCULATION', 'PROV-09-DISCOUNT-RATE'],
    'Presentation': ['PROV-10-DISCLOSURE', 'PROV-11-CONTINGENT-LIAB']
  },
  'Equity': {
    'Existence': ['EQ-01-REGISTER-REVIEW', 'EQ-02-RESOLUTIONS'],
    'Completeness': ['EQ-03-MOVEMENTS', 'EQ-04-DIVIDENDS'],
    'Accuracy': ['EQ-05-RECONCILIATION', 'EQ-06-SHARE-PREMIUM'],
    'Rights & Obligations': ['EQ-07-RESTRICTIONS', 'EQ-08-TREASURY-SHARES'],
    'Presentation': ['EQ-09-DISCLOSURE', 'EQ-10-STATEMENT-CHANGES']
  },
  'Expenses': {
    'Occurrence': ['EXP-01-VOUCHING', 'EXP-02-APPROVAL'],
    'Accuracy': ['EXP-03-RECALC', 'EXP-04-ALLOCATION'],
    'Completeness': ['EXP-05-ACCRUALS', 'EXP-06-CUTOFF'],
    'Cut-off': ['EXP-06-CUTOFF', 'EXP-07-PERIOD-END'],
    'Classification': ['EXP-08-OPEX-CAPEX', 'EXP-09-CATEGORIZATION']
  }
};

const FRAUD_SUSCEPTIBLE_ACCOUNTS = [
  'REVENUE', 'SALES', 'TURNOVER', 'SERVICE_REVENUE', 'SALES_REVENUE', 'REVENUE_OPERATIONS',
  'CASH', 'CASH_EQUIVALENTS', 'CASH_AND_CASH_EQUIVALENTS', 'BANK',
  'INVENTORIES', 'INVENTORY', 'STOCK',
  'RECEIVABLES', 'TRADE_RECEIVABLES', 'OTHER_RECEIVABLES',
  'PROVISIONS', 'ACCRUALS', 'ACCRUED_EXPENSES',
  'DEPRECIATION', 'DEPRECIATION_AMORTIZATION',
  'OTHER_INCOME', 'OTHER_EXPENSES'
];

interface EntityRiskFactors {
  industryRiskProfile: 'High' | 'Medium' | 'Low';
  complexityIndicators: string[];
  estimationComplexityFromNotes: 'High' | 'Medium' | 'Low';
  hasRelatedPartyTransactions: boolean;
  relatedPartyRiskLevel: 'High' | 'Medium' | 'Low';
  fraudRiskFactors: {
    pressureIndicators: string[];
    opportunityIndicators: string[];
    rationalizationIndicators: string[];
    overallFraudRisk: 'High' | 'Medium' | 'Low';
  };
}

function extractEntityRiskFactors(entityUnderstanding: any): EntityRiskFactors {
  const factors: EntityRiskFactors = {
    industryRiskProfile: 'Medium',
    complexityIndicators: [],
    estimationComplexityFromNotes: 'Low',
    hasRelatedPartyTransactions: false,
    relatedPartyRiskLevel: 'Low',
    fraudRiskFactors: {
      pressureIndicators: [],
      opportunityIndicators: [],
      rationalizationIndicators: [],
      overallFraudRisk: 'Low'
    }
  };

  if (!entityUnderstanding) return factors;

  const highRiskIndustries = ['construction', 'real estate', 'financial services', 'mining', 'oil', 'gas', 'pharmaceutical', 'technology', 'startup'];
  const mediumRiskIndustries = ['manufacturing', 'retail', 'hospitality', 'healthcare'];
  
  const industry = (entityUnderstanding.natureOfBusiness || entityUnderstanding.industry || '').toLowerCase();
  if (highRiskIndustries.some(i => industry.includes(i))) {
    factors.industryRiskProfile = 'High';
  } else if (mediumRiskIndustries.some(i => industry.includes(i))) {
    factors.industryRiskProfile = 'Medium';
  } else {
    factors.industryRiskProfile = 'Low';
  }

  if (entityUnderstanding.multipleLocations || entityUnderstanding.hasMultipleBranches) {
    factors.complexityIndicators.push('Multiple locations/branches');
  }
  if (entityUnderstanding.complexITSystems || entityUnderstanding.itEnvironment?.includes('complex')) {
    factors.complexityIndicators.push('Complex IT systems');
  }
  if (entityUnderstanding.foreignOperations || entityUnderstanding.hasForeignSubsidiaries) {
    factors.complexityIndicators.push('Foreign operations/subsidiaries');
  }
  if (entityUnderstanding.significantJudgments || entityUnderstanding.complexAccountingPolicies) {
    factors.complexityIndicators.push('Complex accounting policies');
  }
  if (entityUnderstanding.regulatedEntity || entityUnderstanding.isRegulated) {
    factors.complexityIndicators.push('Regulated industry');
  }

  const notes = (entityUnderstanding.significantEstimates || entityUnderstanding.accountingEstimates || '').toLowerCase();
  if (notes.includes('significant') || notes.includes('complex') || notes.includes('judgment') || notes.includes('fair value')) {
    factors.estimationComplexityFromNotes = 'High';
  } else if (notes.includes('estimate') || notes.includes('provision') || notes.includes('allowance')) {
    factors.estimationComplexityFromNotes = 'Medium';
  }

  const relatedParty = entityUnderstanding.relatedPartyTransactions || entityUnderstanding.hasRelatedParties;
  if (relatedParty) {
    factors.hasRelatedPartyTransactions = true;
    const rpDetails = (typeof relatedParty === 'string' ? relatedParty : '').toLowerCase();
    if (rpDetails.includes('significant') || rpDetails.includes('material') || rpDetails.includes('complex')) {
      factors.relatedPartyRiskLevel = 'High';
    } else if (rpDetails.includes('routine') || rpDetails.includes('minor')) {
      factors.relatedPartyRiskLevel = 'Low';
    } else {
      factors.relatedPartyRiskLevel = 'Medium';
    }
  }

  const businessDesc = JSON.stringify(entityUnderstanding).toLowerCase();
  
  if (businessDesc.includes('debt covenant') || businessDesc.includes('loan covenant') || 
      businessDesc.includes('financial pressure') || businessDesc.includes('cash flow issues') ||
      businessDesc.includes('bonus') || businessDesc.includes('performance target') ||
      businessDesc.includes('listing') || businessDesc.includes('ipo') ||
      businessDesc.includes('refinancing') || businessDesc.includes('working capital constraint')) {
    factors.fraudRiskFactors.pressureIndicators.push('Financial pressure or incentive structures identified');
  }
  if (businessDesc.includes('earnings target') || businessDesc.includes('analyst expectation')) {
    factors.fraudRiskFactors.pressureIndicators.push('Pressure to meet earnings expectations');
  }
  if (businessDesc.includes('declining') || businessDesc.includes('loss making') || businessDesc.includes('liquidity')) {
    factors.fraudRiskFactors.pressureIndicators.push('Declining performance or liquidity concerns');
  }

  if (businessDesc.includes('weak internal control') || businessDesc.includes('control deficienc') ||
      businessDesc.includes('override') || businessDesc.includes('management dominant')) {
    factors.fraudRiskFactors.opportunityIndicators.push('Weak internal control environment');
  }
  if (businessDesc.includes('complex structure') || businessDesc.includes('unusual transaction') ||
      businessDesc.includes('related party') && businessDesc.includes('significant')) {
    factors.fraudRiskFactors.opportunityIndicators.push('Complex or unusual transactions');
  }
  if (businessDesc.includes('manual') || businessDesc.includes('spreadsheet') || 
      businessDesc.includes('lack of segregation')) {
    factors.fraudRiskFactors.opportunityIndicators.push('Manual processes or lack of segregation of duties');
  }

  if (businessDesc.includes('aggressive') || businessDesc.includes('optimistic') ||
      businessDesc.includes('dispute') || businessDesc.includes('litigation history')) {
    factors.fraudRiskFactors.rationalizationIndicators.push('Aggressive management attitude or dispute history');
  }
  if (businessDesc.includes('new management') || businessDesc.includes('high turnover') ||
      businessDesc.includes('changed auditor')) {
    factors.fraudRiskFactors.rationalizationIndicators.push('Management changes or auditor changes');
  }

  const totalFraudIndicators = 
    factors.fraudRiskFactors.pressureIndicators.length +
    factors.fraudRiskFactors.opportunityIndicators.length +
    factors.fraudRiskFactors.rationalizationIndicators.length;

  if (totalFraudIndicators >= 4 || 
      (factors.fraudRiskFactors.pressureIndicators.length >= 2 && factors.fraudRiskFactors.opportunityIndicators.length >= 1)) {
    factors.fraudRiskFactors.overallFraudRisk = 'High';
  } else if (totalFraudIndicators >= 2) {
    factors.fraudRiskFactors.overallFraudRisk = 'Medium';
  } else {
    factors.fraudRiskFactors.overallFraudRisk = 'Low';
  }

  return factors;
}

function getLinkedProcedureIds(fsHeadKey: string, fsHeadLabel: string, assertion: string): string[] {
  const procedureKey = Object.keys(ISA_330_PROCEDURE_MAP).find(key => {
    const keyLower = key.toLowerCase();
    const fsHeadLower = fsHeadLabel.toLowerCase();
    const fsKeyLower = fsHeadKey.toLowerCase();
    return fsHeadLower.includes(keyLower) || keyLower.includes(fsHeadLower) ||
           fsKeyLower.includes(keyLower.replace(/ /g, '_')) ||
           (keyLower === 'trade receivables' && (fsKeyLower.includes('receivable') || fsKeyLower.includes('ar'))) ||
           (keyLower === 'inventories' && (fsKeyLower.includes('inventor') || fsKeyLower.includes('stock'))) ||
           (keyLower === 'ppe' && (fsKeyLower.includes('ppe') || fsKeyLower.includes('fixed') || fsKeyLower.includes('property'))) ||
           (keyLower === 'payables' && (fsKeyLower.includes('payable') || fsKeyLower.includes('creditor'))) ||
           (keyLower === 'borrowings' && (fsKeyLower.includes('borrow') || fsKeyLower.includes('loan') || fsKeyLower.includes('debt'))) ||
           (keyLower === 'cash' && (fsKeyLower.includes('cash') || fsKeyLower.includes('bank'))) ||
           (keyLower === 'provisions' && fsKeyLower.includes('provision')) ||
           (keyLower === 'equity' && (fsKeyLower.includes('equity') || fsKeyLower.includes('capital') || fsKeyLower.includes('reserve'))) ||
           (keyLower === 'expenses' && (fsKeyLower.includes('expense') || fsKeyLower.includes('cost')));
  });

  if (procedureKey && ISA_330_PROCEDURE_MAP[procedureKey][assertion]) {
    return ISA_330_PROCEDURE_MAP[procedureKey][assertion];
  }

  if (procedureKey) {
    const assertionMap = ISA_330_PROCEDURE_MAP[procedureKey];
    const firstAvailable = Object.values(assertionMap)[0];
    if (firstAvailable) return firstAvailable.slice(0, 2);
  }

  const category = getFsHeadCategory(fsHeadKey);
  const categoryMap: Record<string, string[]> = {
    'ASSETS': ['GEN-01-EXISTENCE', 'GEN-02-VALUATION', 'GEN-03-RIGHTS'],
    'LIABILITIES': ['GEN-04-COMPLETENESS', 'GEN-05-ACCURACY', 'GEN-06-CUTOFF'],
    'EQUITY': ['EQ-01-REGISTER-REVIEW', 'EQ-02-RESOLUTIONS'],
    'REVENUE': ['REV-01-VOUCHING', 'REV-02-CUTOFF'],
    'EXPENSES': ['EXP-01-VOUCHING', 'EXP-02-APPROVAL']
  };
  
  return categoryMap[category] || ['GEN-01-SUBSTANTIVE', 'GEN-02-ANALYTICAL'];
}

const ASSERTIONS = [
  "Existence", "Completeness", "Accuracy", "Valuation", 
  "Cut-off", "Rights & Obligations", "Classification", "Presentation"
];

const WCGW_TEMPLATES: Record<string, Record<string, string>> = {
  REVENUE: {
    "Existence": "Revenue recorded does not represent actual sales transactions that occurred during the period",
    "Completeness": "Not all sales transactions are recorded, resulting in understated revenue",
    "Cut-off": "Revenue is recorded in the wrong period, particularly around period end",
    "Accuracy": "Revenue is not recorded at the correct amounts based on contractual terms"
  },
  RECEIVABLES: {
    "Existence": "Recorded receivables do not represent valid amounts owed to the entity",
    "Valuation": "Receivables are not stated at net realizable value due to inadequate allowance for doubtful accounts",
    "Rights & Obligations": "Entity does not have legal rights to collect the recorded receivables"
  },
  INVENTORIES: {
    "Existence": "Recorded inventory does not physically exist or is not owned by the entity",
    "Valuation": "Inventory is not stated at lower of cost and net realizable value",
    "Completeness": "Not all inventory on hand is recorded in the financial statements"
  },
  PPE: {
    "Existence": "Recorded PPE assets do not physically exist or are not in use",
    "Valuation": "PPE is not stated at appropriate carrying value after depreciation and impairment",
    "Rights & Obligations": "Entity does not have ownership rights to the recorded PPE assets"
  },
  PAYABLES: {
    "Completeness": "Not all liabilities are recorded, resulting in understated payables",
    "Accuracy": "Payables are not recorded at correct amounts based on vendor invoices",
    "Cut-off": "Liabilities are recorded in the wrong period, particularly around period end"
  },
  BORROWINGS: {
    "Completeness": "Not all borrowing arrangements are recorded in the financial statements",
    "Valuation": "Borrowings are not measured at appropriate carrying value including accrued interest",
    "Classification": "Borrowings are not properly classified between current and non-current"
  },
  SHARE_CAPITAL: {
    "Existence": "Recorded share capital does not reflect actual issued and paid-up capital",
    "Completeness": "Not all share issues or changes in capital structure are recorded",
    "Presentation": "Equity components are not properly presented and disclosed"
  }
};

const FS_LEVEL_RISK_TEMPLATES = [
  {
    riskDescription: "Risk of management override of controls through inappropriate journal entries or adjustments",
    source: "Entity" as const,
    isFraudIndicator: true,
    impactedFsAreas: ["All FS Areas"],
    severity: "High" as const,
    isaReference: "ISA 240.31"
  },
  {
    riskDescription: "Going concern uncertainty due to recurring losses or negative working capital trends",
    source: "Entity" as const,
    isFraudIndicator: false,
    impactedFsAreas: ["All FS Areas"],
    severity: "High" as const,
    isaReference: "ISA 570.10"
  },
  {
    riskDescription: "Related party transactions may not be at arm's length or properly disclosed",
    source: "Entity" as const,
    isFraudIndicator: true,
    impactedFsAreas: ["Revenue", "Receivables", "Payables", "Investments"],
    severity: "Medium" as const,
    isaReference: "ISA 550.18"
  },
  {
    riskDescription: "Revenue recognition fraud risk due to pressure to meet targets or covenants",
    source: "Industry" as const,
    isFraudIndicator: true,
    impactedFsAreas: ["Revenue", "Receivables"],
    severity: "High" as const,
    isaReference: "ISA 240.26"
  },
  {
    riskDescription: "Significant accounting estimates involve management judgment and may be materially misstated",
    source: "Analytics" as const,
    isFraudIndicator: false,
    impactedFsAreas: ["Provisions", "Depreciation", "Inventory Valuation", "Receivables Allowance"],
    severity: "Medium" as const,
    isaReference: "ISA 540.13"
  }
];

function toNumber(val: Decimal | number | null | undefined): number {
  if (val === null || val === undefined) return 0;
  return typeof val === 'number' ? val : Number(val);
}

function determineSizeVsMateriality(balance: number, performanceMateriality: number): 'Above' | 'Below' | 'Near' {
  const absBalance = Math.abs(balance);
  if (absBalance > performanceMateriality) return 'Above';
  if (absBalance > performanceMateriality * 0.75) return 'Near';
  return 'Below';
}

function determineVolatility(currentBalance: number, priorBalance: number): 'High' | 'Medium' | 'Low' {
  if (priorBalance === 0) return currentBalance !== 0 ? 'High' : 'Low';
  const change = Math.abs((currentBalance - priorBalance) / priorBalance);
  if (change > 0.20) return 'High';
  if (change > 0.10) return 'Medium';
  return 'Low';
}

function determineEstimationComplexity(fsHeadKey: string): 'High' | 'Medium' | 'Low' {
  if (ESTIMATION_ACCOUNTS.includes(fsHeadKey)) return 'High';
  if (['RECEIVABLES', 'TRADE_RECEIVABLES', 'INVENTORIES', 'INVENTORY', 'PPE', 'FIXED_ASSETS'].includes(fsHeadKey)) return 'Medium';
  return 'Low';
}

function calculateRiskRating(likelihood: 'High' | 'Medium' | 'Low', magnitude: 'High' | 'Medium' | 'Low'): 'High' | 'Medium' | 'Low' {
  if (likelihood === 'High' && magnitude === 'High') return 'High';
  if (likelihood === 'High' || magnitude === 'High') return 'Medium';
  if (likelihood === 'Medium' || magnitude === 'Medium') return 'Medium';
  return 'Low';
}

function getFsHeadCategory(fsHeadKey: string): string {
  const assetKeys = ['CASH', 'BANK', 'CASH_EQUIVALENTS', 'CASH_AND_CASH_EQUIVALENTS', 'RECEIVABLES', 'TRADE_RECEIVABLES', 
    'INVENTORIES', 'INVENTORY', 'STOCK', 'PREPAYMENTS', 'ADVANCES', 'SHORT_TERM_INVESTMENTS', 'OTHER_CURRENT_ASSETS',
    'PPE', 'PROPERTY_PLANT_EQUIPMENT', 'FIXED_ASSETS', 'INTANGIBLE_ASSETS', 'INVESTMENTS', 'LONG_TERM_INVESTMENTS',
    'DEFERRED_TAX_ASSETS', 'RIGHT_OF_USE_ASSETS', 'CAPITAL_WIP', 'INVESTMENT_PROPERTY'];
  const liabilityKeys = ['PAYABLES', 'TRADE_PAYABLES', 'CREDITORS', 'ACCRUALS', 'TAX_LIABILITIES', 'TAX_PAYABLE',
    'SHORT_TERM_BORROWINGS', 'SHORT_TERM_LOANS', 'OTHER_CURRENT_LIABILITIES', 'LONG_TERM_BORROWINGS', 'LONG_TERM_LOANS',
    'DEFERRED_TAX', 'PROVISIONS', 'OTHER_NON_CURRENT_LIABILITIES'];
  const equityKeys = ['SHARE_CAPITAL', 'CAPITAL', 'RESERVES', 'RESERVES_SURPLUS', 'RETAINED_EARNINGS', 'EQUITY'];
  const revenueKeys = ['REVENUE', 'SALES', 'TURNOVER', 'SERVICE_REVENUE', 'SALES_REVENUE', 'REVENUE_OPERATIONS', 
    'OTHER_INCOME', 'INTEREST_INCOME', 'DIVIDEND_INCOME'];
  
  if (assetKeys.includes(fsHeadKey)) return 'ASSETS';
  if (liabilityKeys.includes(fsHeadKey)) return 'LIABILITIES';
  if (equityKeys.includes(fsHeadKey)) return 'EQUITY';
  if (revenueKeys.includes(fsHeadKey)) return 'REVENUE';
  return 'EXPENSES';
}

function generateAssertionRisks(
  significantFsHeads: Array<{fsHeadKey: string; fsHeadLabel: string; balance: number;}>,
  entityUnderstanding: any,
  entityRiskFactors?: EntityRiskFactors
): Array<{
  id: string;
  fsHeadKey: string;
  fsHeadLabel: string;
  assertion: string;
  riskStatement: string;
  whatCouldGoWrong: string;
  riskDriver: string;
  isFraudRisk: boolean;
  isSignificantRisk: boolean;
  significantRiskRationale: string;
  likelihood: 'High' | 'Medium' | 'Low';
  magnitude: 'High' | 'Medium' | 'Low';
  riskRating: 'High' | 'Medium' | 'Low';
  linkedProcedureIds: string[];
  fraudSusceptibility: 'High' | 'Medium' | 'Low';
  fraudRiskCriteria: {
    pressureIndicators: string[];
    opportunityIndicators: string[];
    rationalizationIndicators: string[];
  };
  isa315Adjustments: string[];
}> {
  const risks: Array<any> = [];
  let riskId = 1;
  
  const factors = entityRiskFactors || extractEntityRiskFactors(entityUnderstanding);

  for (const fsHead of significantFsHeads) {
    const category = getFsHeadCategory(fsHead.fsHeadKey);
    const wcgwTemplates = WCGW_TEMPLATES[category] || WCGW_TEMPLATES.REVENUE;
    
    const relevantAssertions = Object.keys(wcgwTemplates);
    for (const assertion of relevantAssertions.slice(0, 3)) {
      const wcgw = wcgwTemplates[assertion] || `Risk that ${fsHead.fsHeadLabel} is materially misstated regarding ${assertion}`;
      
      const isFraudSusceptibleAccount = FRAUD_SUSCEPTIBLE_ACCOUNTS.includes(fsHead.fsHeadKey);
      let isFraudRisk = (category === 'REVENUE' && (assertion === 'Existence' || assertion === 'Occurrence'));
      
      if (isFraudSusceptibleAccount && factors.fraudRiskFactors.overallFraudRisk === 'High') {
        isFraudRisk = true;
      }
      
      const isSignificantRisk = isFraudRisk || Math.abs(fsHead.balance) > 1000000 ||
        (factors.industryRiskProfile === 'High' && Math.abs(fsHead.balance) > 500000);
      
      let baseLikelihood: 'High' | 'Medium' | 'Low' = isSignificantRisk ? 'High' : (Math.abs(fsHead.balance) < 50000 ? 'Low' : 'Medium');
      let baseMagnitude: 'High' | 'Medium' | 'Low' = Math.abs(fsHead.balance) > 500000 ? 'High' : 'Medium';
      
      const isa315Adjustments: string[] = [];
      
      if (factors.industryRiskProfile === 'High') {
        if (baseLikelihood === 'Low') baseLikelihood = 'Medium';
        else if (baseLikelihood === 'Medium' && Math.abs(fsHead.balance) > 100000) baseLikelihood = 'High';
        isa315Adjustments.push('Elevated due to high-risk industry profile (ISA 315.A34)');
      }
      
      if (factors.complexityIndicators.length >= 2) {
        if (baseLikelihood === 'Low') baseLikelihood = 'Medium';
        isa315Adjustments.push(`Complexity factors: ${factors.complexityIndicators.slice(0, 2).join(', ')} (ISA 315.A40)`);
      }
      
      if (factors.estimationComplexityFromNotes === 'High' && 
          (assertion === 'Valuation' || fsHead.fsHeadKey.includes('PROVISION') || fsHead.fsHeadKey.includes('DEPRECIATION'))) {
        if (baseLikelihood === 'Medium') baseLikelihood = 'High';
        isa315Adjustments.push('Significant estimation complexity identified (ISA 315.A128)');
      }
      
      if (factors.hasRelatedPartyTransactions && factors.relatedPartyRiskLevel !== 'Low') {
        if (factors.relatedPartyRiskLevel === 'High') baseLikelihood = 'High';
        isa315Adjustments.push(`Related party transaction risk: ${factors.relatedPartyRiskLevel} (ISA 550.18)`);
      }
      
      let fraudSusceptibility: 'High' | 'Medium' | 'Low' = 'Low';
      const fraudRiskCriteria = {
        pressureIndicators: [] as string[],
        opportunityIndicators: [] as string[],
        rationalizationIndicators: [] as string[]
      };
      
      if (isFraudSusceptibleAccount) {
        if (factors.fraudRiskFactors.overallFraudRisk === 'High') {
          fraudSusceptibility = 'High';
          fraudRiskCriteria.pressureIndicators = [...factors.fraudRiskFactors.pressureIndicators];
          fraudRiskCriteria.opportunityIndicators = [...factors.fraudRiskFactors.opportunityIndicators];
          fraudRiskCriteria.rationalizationIndicators = [...factors.fraudRiskFactors.rationalizationIndicators];
        } else if (factors.fraudRiskFactors.overallFraudRisk === 'Medium' || category === 'REVENUE') {
          fraudSusceptibility = 'Medium';
          if (factors.fraudRiskFactors.pressureIndicators.length > 0) {
            fraudRiskCriteria.pressureIndicators = factors.fraudRiskFactors.pressureIndicators.slice(0, 1);
          }
          if (factors.fraudRiskFactors.opportunityIndicators.length > 0) {
            fraudRiskCriteria.opportunityIndicators = factors.fraudRiskFactors.opportunityIndicators.slice(0, 1);
          }
        }
        
        if (category === 'REVENUE' && (assertion === 'Existence' || assertion === 'Occurrence')) {
          fraudSusceptibility = 'High';
          if (!fraudRiskCriteria.pressureIndicators.includes('Presumed revenue fraud risk per ISA 240.26')) {
            fraudRiskCriteria.pressureIndicators.push('Presumed revenue fraud risk per ISA 240.26');
          }
        }
      }
      
      const linkedProcedureIds = getLinkedProcedureIds(fsHead.fsHeadKey, fsHead.fsHeadLabel, assertion);
      
      let riskDriver = `Identified based on ${category.toLowerCase()} balance materiality and inherent risk factors`;
      if (isa315Adjustments.length > 0) {
        riskDriver += `. Risk adjusted per ISA 315 factors.`;
      }
      if (fraudSusceptibility !== 'Low') {
        riskDriver += ` ISA 240 fraud susceptibility: ${fraudSusceptibility}.`;
      }
      
      let significantRiskRationale = '';
      if (isSignificantRisk) {
        if (isFraudRisk) {
          significantRiskRationale = 'Presumed fraud risk per ISA 240';
        } else if (factors.industryRiskProfile === 'High') {
          significantRiskRationale = 'High-risk industry with material balance';
        } else {
          significantRiskRationale = 'Material balance with estimation uncertainty';
        }
      }
      
      risks.push({
        id: `AR-${String(riskId++).padStart(3, '0')}`,
        fsHeadKey: fsHead.fsHeadKey,
        fsHeadLabel: fsHead.fsHeadLabel,
        assertion,
        riskStatement: `${fsHead.fsHeadLabel} - ${assertion} assertion risk`,
        whatCouldGoWrong: wcgw,
        riskDriver,
        isFraudRisk,
        isSignificantRisk,
        significantRiskRationale,
        likelihood: baseLikelihood,
        magnitude: baseMagnitude,
        riskRating: calculateRiskRating(baseLikelihood, baseMagnitude),
        linkedProcedureIds,
        fraudSusceptibility,
        fraudRiskCriteria,
        isa315Adjustments
      });
    }
  }

  return risks;
}

function generateRiskAnalytics(
  fsHeadBalances: Record<string, {current: number; prior: number}>,
  materiality: {overall: number; performance: number; trivial: number}
): Array<{
  id: string;
  indicator: string;
  value: string;
  benchmark: string;
  variance: string;
  linkedFsHeads: string[];
  riskImplication: string;
}> {
  const analytics: Array<any> = [];
  let id = 1;

  const totalAssets = Object.entries(fsHeadBalances)
    .filter(([key]) => getFsHeadCategory(key) === 'ASSETS')
    .reduce((sum, [, val]) => sum + val.current, 0);

  const totalLiabilities = Object.entries(fsHeadBalances)
    .filter(([key]) => getFsHeadCategory(key) === 'LIABILITIES')
    .reduce((sum, [, val]) => sum + Math.abs(val.current), 0);

  const currentAssets = Object.entries(fsHeadBalances)
    .filter(([key]) => ['CASH_EQUIVALENTS', 'CASH', 'BANK', 'RECEIVABLES', 'TRADE_RECEIVABLES', 'INVENTORIES', 'INVENTORY', 'PREPAYMENTS'].includes(key))
    .reduce((sum, [, val]) => sum + val.current, 0);

  const currentLiabilities = Object.entries(fsHeadBalances)
    .filter(([key]) => ['PAYABLES', 'TRADE_PAYABLES', 'ACCRUALS', 'TAX_LIABILITIES', 'SHORT_TERM_BORROWINGS', 'OTHER_CURRENT_LIABILITIES'].includes(key))
    .reduce((sum, [, val]) => sum + Math.abs(val.current), 0);

  const revenue = Object.entries(fsHeadBalances)
    .filter(([key]) => getFsHeadCategory(key) === 'REVENUE')
    .reduce((sum, [, val]) => sum + Math.abs(val.current), 0);

  if (currentLiabilities > 0) {
    const currentRatio = currentAssets / currentLiabilities;
    analytics.push({
      id: `RA-${String(id++).padStart(3, '0')}`,
      indicator: "Current Ratio",
      value: currentRatio.toFixed(2),
      benchmark: "1.5 - 2.0",
      variance: currentRatio < 1 ? "Below benchmark - liquidity concern" : (currentRatio > 2 ? "Above benchmark" : "Within benchmark"),
      linkedFsHeads: ["Current Assets", "Current Liabilities"],
      riskImplication: currentRatio < 1 ? "Potential going concern indicator - entity may face liquidity issues" : "Adequate working capital position"
    });
  }

  if (totalAssets > 0) {
    const debtRatio = (totalLiabilities / totalAssets) * 100;
    analytics.push({
      id: `RA-${String(id++).padStart(3, '0')}`,
      indicator: "Debt to Assets Ratio",
      value: `${debtRatio.toFixed(1)}%`,
      benchmark: "40% - 60%",
      variance: debtRatio > 70 ? "High leverage - above benchmark" : (debtRatio < 30 ? "Conservative leverage" : "Within benchmark"),
      linkedFsHeads: ["Total Liabilities", "Total Assets"],
      riskImplication: debtRatio > 70 ? "High financial leverage increases financial risk and covenant pressure" : "Acceptable leverage levels"
    });
  }

  const receivables = fsHeadBalances.RECEIVABLES?.current || fsHeadBalances.TRADE_RECEIVABLES?.current || 0;
  if (revenue > 0 && receivables > 0) {
    const dso = (receivables / revenue) * 365;
    analytics.push({
      id: `RA-${String(id++).padStart(3, '0')}`,
      indicator: "Days Sales Outstanding (DSO)",
      value: `${dso.toFixed(0)} days`,
      benchmark: "30 - 60 days",
      variance: dso > 90 ? "Significantly above benchmark" : (dso > 60 ? "Above benchmark" : "Within benchmark"),
      linkedFsHeads: ["Trade Receivables", "Revenue"],
      riskImplication: dso > 90 ? "Elevated collection risk - review allowance for doubtful debts" : "Collection efficiency appears reasonable"
    });
  }

  const inventory = fsHeadBalances.INVENTORIES?.current || fsHeadBalances.INVENTORY?.current || 0;
  const cogs = fsHeadBalances.COST_OF_GOODS_SOLD?.current || fsHeadBalances.COST_OF_SALES?.current || fsHeadBalances.COGS?.current || 0;
  if (cogs > 0 && inventory > 0) {
    const dio = (inventory / Math.abs(cogs)) * 365;
    analytics.push({
      id: `RA-${String(id++).padStart(3, '0')}`,
      indicator: "Days Inventory Outstanding (DIO)",
      value: `${dio.toFixed(0)} days`,
      benchmark: "30 - 90 days",
      variance: dio > 120 ? "Significantly above benchmark - obsolescence risk" : (dio > 90 ? "Above benchmark" : "Within benchmark"),
      linkedFsHeads: ["Inventories", "Cost of Sales"],
      riskImplication: dio > 120 ? "High inventory levels - potential valuation/obsolescence risk" : "Inventory turnover appears reasonable"
    });
  }

  Object.entries(fsHeadBalances).forEach(([key, val]) => {
    if (val.prior !== 0) {
      const changePercent = ((val.current - val.prior) / Math.abs(val.prior)) * 100;
      if (Math.abs(changePercent) > 25) {
        analytics.push({
          id: `RA-${String(id++).padStart(3, '0')}`,
          indicator: `YoY Change - ${FS_HEAD_LABELS[key] || key}`,
          value: `${changePercent > 0 ? '+' : ''}${changePercent.toFixed(1)}%`,
          benchmark: "±10%",
          variance: `${Math.abs(changePercent) > 50 ? 'Significant' : 'Notable'} fluctuation requiring investigation`,
          linkedFsHeads: [FS_HEAD_LABELS[key] || key],
          riskImplication: `Material year-over-year change warrants substantive analytical procedures`
        });
      }
    }
  });

  return analytics;
}

router.post("/:engagementId/analyze", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const firmId = req.user!.firmId;

    if (!firmId) {
      return res.status(400).json({ error: "User not associated with a firm" });
    }

    const engagement = await prisma.engagement.findUnique({
      where: { id: engagementId },
      include: { client: true }
    });

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    if (engagement.firmId !== firmId) {
      return res.status(403).json({ error: "Access denied" });
    }

    const [
      materiality,
      entityUnderstanding,
      importBalances,
      coaAccounts,
      planningMemo
    ] = await Promise.all([
      prisma.materialityCalculation.findFirst({
        where: { engagementId },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.entityUnderstanding.findUnique({
        where: { engagementId }
      }),
      prisma.importAccountBalance.findMany({
        where: { engagementId, balanceType: 'CB' },
        orderBy: { accountCode: 'asc' }
      }),
      prisma.coAAccount.findMany({
        where: { engagementId },
        orderBy: { accountCode: 'asc' }
      }),
      prisma.planningMemo.findUnique({
        where: { engagementId }
      })
    ]);

    const overallMateriality = toNumber(materiality?.overallMateriality) || 100000;
    const performanceMateriality = toNumber(materiality?.performanceMateriality) || overallMateriality * 0.75;
    const trivialThreshold = toNumber(materiality?.trivialThreshold) || overallMateriality * 0.05;

    const fsHeadBalances: Record<string, {current: number; prior: number; accountCount: number}> = {};

    if (importBalances.length > 0) {
      for (const balance of importBalances) {
        const fsHeadKey = balance.fsHeadKey || 'UNMAPPED';
        if (fsHeadKey === 'UNMAPPED') continue;
        
        if (!fsHeadBalances[fsHeadKey]) {
          fsHeadBalances[fsHeadKey] = { current: 0, prior: 0, accountCount: 0 };
        }
        
        const netBalance = toNumber(balance.debitAmount) - toNumber(balance.creditAmount);
        fsHeadBalances[fsHeadKey].current += netBalance;
        fsHeadBalances[fsHeadKey].accountCount += 1;
      }
    } else if (coaAccounts.length > 0) {
      for (const account of coaAccounts) {
        const fsHeadKey = account.fsLineItem || 'UNMAPPED';
        if (fsHeadKey === 'UNMAPPED') continue;
        
        if (!fsHeadBalances[fsHeadKey]) {
          fsHeadBalances[fsHeadKey] = { current: 0, prior: 0, accountCount: 0 };
        }
        
        const balance = toNumber(account.closingBalance);
        fsHeadBalances[fsHeadKey].current += balance;
        fsHeadBalances[fsHeadKey].accountCount += 1;
      }
    }

    const significantFsHeads = Object.entries(fsHeadBalances)
      .filter(([key]) => key !== 'UNMAPPED')
      .map(([fsHeadKey, data]) => {
        const balance = data.current;
        const priorBalance = data.prior;
        const sizeVsMateriality = determineSizeVsMateriality(balance, performanceMateriality);
        const volatility = determineVolatility(balance, priorBalance);
        const estimationComplexity = determineEstimationComplexity(fsHeadKey);
        
        const isSignificant = sizeVsMateriality === 'Above' || volatility === 'High' || estimationComplexity === 'High';
        
        let rationale = [];
        if (sizeVsMateriality === 'Above') rationale.push(`Balance (${balance.toLocaleString()}) exceeds performance materiality (${performanceMateriality.toLocaleString()})`);
        if (volatility === 'High') rationale.push('High year-over-year volatility (>20%)');
        if (estimationComplexity === 'High') rationale.push('Account involves significant estimates');
        
        return {
          fsHeadKey,
          fsHeadLabel: FS_HEAD_LABELS[fsHeadKey] || fsHeadKey.replace(/_/g, ' '),
          isSignificant,
          significanceRationale: rationale.join('; ') || 'Below significance thresholds',
          sizeVsMateriality,
          volatility,
          estimationComplexity,
          balance
        };
      })
      .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance));

    const significantOnly = significantFsHeads.filter(h => h.isSignificant);
    
    const fsLevelRisks = FS_LEVEL_RISK_TEMPLATES.map((template, idx) => ({
      id: `FSR-${String(idx + 1).padStart(3, '0')}`,
      ...template
    }));

    if (entityUnderstanding?.significantEstimates) {
      fsLevelRisks.push({
        id: `FSR-${String(fsLevelRisks.length + 1).padStart(3, '0')}`,
        riskDescription: "Significant accounting estimates per entity understanding require enhanced audit procedures",
        source: "Entity" as const,
        isFraudIndicator: false,
        impactedFsAreas: ["Multiple FS Areas"],
        severity: "Medium" as const,
        isaReference: "ISA 540.13"
      });
    }

    const entityRiskFactors = extractEntityRiskFactors(entityUnderstanding);

    const assertionRisks = generateAssertionRisks(
      significantOnly.map(h => ({ fsHeadKey: h.fsHeadKey, fsHeadLabel: h.fsHeadLabel, balance: h.balance })),
      entityUnderstanding,
      entityRiskFactors
    );

    const riskAnalytics = generateRiskAnalytics(
      Object.fromEntries(
        Object.entries(fsHeadBalances).map(([key, data]) => [key, { current: data.current, prior: data.prior }])
      ),
      { overall: overallMateriality, performance: performanceMateriality, trivial: trivialThreshold }
    );

    // Generate Audit Strategy Inputs
    const hasHighROMMRisks = assertionRisks.some(r => r.riskRating === 'High') || 
                             fsLevelRisks.some(r => r.severity === 'High');
    const hasFraudRisks = assertionRisks.some(r => r.isFraudRisk) || 
                          fsLevelRisks.some(r => r.isFraudIndicator);
    
    // Determine controls reliance decision
    let controlsRelianceDecision: 'Substantive Only' | 'Combined' | 'Controls Reliance' = 'Combined';
    let controlsRelianceRationale = 'Combined approach appropriate based on assessed risk levels and control environment.';
    
    if (hasHighROMMRisks || hasFraudRisks) {
      controlsRelianceDecision = 'Substantive Only';
      controlsRelianceRationale = hasHighROMMRisks && hasFraudRisks 
        ? 'High ROMM risks and fraud indicators identified. Substantive-only approach required per ISA 330.21.'
        : hasHighROMMRisks 
          ? 'High ROMM risks identified across significant accounts. Substantive-only approach recommended per ISA 330.21.'
          : 'Fraud risk indicators present. Enhanced substantive testing required per ISA 240.';
    }

    // Generate high-risk areas with recommended procedures and linked procedure IDs (ISA 330 integration)
    const highRiskAreas = assertionRisks
      .filter(r => r.riskRating === 'High' || r.isSignificantRisk)
      .map(r => ({
        fsHeadKey: r.fsHeadKey,
        fsHeadLabel: r.fsHeadLabel,
        assertion: r.assertion,
        riskId: r.id,
        riskRating: r.riskRating,
        isFraudRisk: r.isFraudRisk,
        fraudSusceptibility: r.fraudSusceptibility,
        procedureIds: r.linkedProcedureIds,
        recommendedApproach: r.isFraudRisk 
          ? 'Extended substantive testing with unpredictability elements'
          : 'Enhanced substantive analytical procedures and detailed testing',
        procedureFocus: r.isFraudRisk 
          ? ['Journal entry testing', 'Cut-off testing', 'Third-party confirmations', 'Management inquiry']
          : r.assertion === 'Valuation' 
            ? ['Recomputation', 'Expert valuation review', 'Impairment testing']
            : r.assertion === 'Existence' 
              ? ['Physical verification', 'Confirmation', 'Vouching']
              : r.assertion === 'Completeness' 
                ? ['Subsequent events review', 'Cut-off testing', 'Search for unrecorded items']
                : ['Detailed testing', 'Analytical procedures', 'Inquiry'],
        isa315Adjustments: r.isa315Adjustments,
        fraudRiskCriteria: r.fraudRiskCriteria
      }));

    // Generate sampling strategy inputs per FS Head
    const samplingStrategyInputs = significantOnly.map(h => {
      const relatedRisks = assertionRisks.filter(r => r.fsHeadKey === h.fsHeadKey);
      const maxRiskLevel = relatedRisks.reduce((max, r) => {
        if (r.riskRating === 'High') return 'High';
        if (r.riskRating === 'Medium' && max !== 'High') return 'Medium';
        return max;
      }, 'Low' as 'High' | 'Medium' | 'Low');
      
      let samplingApproach: 'Statistical' | 'Non-Statistical' | 'MUS' | 'Targeted' = 'Non-Statistical';
      let rationale = 'Non-statistical sampling appropriate for moderate risk areas.';
      
      if (maxRiskLevel === 'High') {
        samplingApproach = 'Targeted';
        rationale = 'Targeted selection of high-risk items required due to elevated ROMM.';
      } else if (h.fsHeadKey.includes('RECEIVABLES') || h.fsHeadKey.includes('PAYABLES')) {
        samplingApproach = 'MUS';
        rationale = 'Monetary Unit Sampling (MUS) appropriate for accounts with homogeneous populations.';
      } else if (fsHeadBalances[h.fsHeadKey]?.accountCount > 100) {
        samplingApproach = 'Statistical';
        rationale = 'Statistical sampling provides measurable confidence for large populations.';
      }
      
      return {
        fsHeadKey: h.fsHeadKey,
        samplingApproach,
        rationale,
        riskLevel: maxRiskLevel
      };
    });

    // Focus areas for substantive testing
    const focusAreasForSubstantive: string[] = [];
    if (hasFraudRisks) {
      focusAreasForSubstantive.push('Revenue recognition - presumed fraud risk per ISA 240');
      focusAreasForSubstantive.push('Management override of controls - journal entry testing');
    }
    assertionRisks
      .filter(r => r.isSignificantRisk)
      .slice(0, 5)
      .forEach(r => {
        focusAreasForSubstantive.push(`${r.fsHeadLabel} - ${r.assertion} assertion`);
      });

    // Key Audit Matters
    const keyAuditMatters: string[] = [];
    fsLevelRisks
      .filter(r => r.severity === 'High')
      .forEach(r => keyAuditMatters.push(r.riskDescription));
    assertionRisks
      .filter(r => r.isSignificantRisk && r.riskRating === 'High')
      .slice(0, 3)
      .forEach(r => keyAuditMatters.push(`${r.fsHeadLabel}: ${r.whatCouldGoWrong}`));

    const auditStrategyInputs = {
      controlsRelianceDecision,
      controlsRelianceRationale,
      highRiskAreas,
      samplingStrategyInputs,
      focusAreasForSubstantive,
      keyAuditMatters
    };

    const highFraudSusceptibilityAccounts = assertionRisks
      .filter(r => r.fraudSusceptibility === 'High')
      .map(r => ({
        fsHeadKey: r.fsHeadKey,
        fsHeadLabel: r.fsHeadLabel,
        assertion: r.assertion,
        fraudRiskCriteria: r.fraudRiskCriteria,
        linkedProcedureIds: r.linkedProcedureIds
      }));

    const isa240FraudAnalysis = {
      overallFraudRisk: entityRiskFactors.fraudRiskFactors.overallFraudRisk,
      fraudTriangle: {
        pressureIndicators: entityRiskFactors.fraudRiskFactors.pressureIndicators,
        opportunityIndicators: entityRiskFactors.fraudRiskFactors.opportunityIndicators,
        rationalizationIndicators: entityRiskFactors.fraudRiskFactors.rationalizationIndicators
      },
      highFraudSusceptibilityAccounts,
      presumedFraudRisks: [
        {
          riskType: 'Revenue Recognition',
          isaReference: 'ISA 240.26',
          status: 'Presumed - cannot be rebutted without documented rationale',
          linkedProcedures: ['REV-01-VOUCHING', 'REV-02-CUTOFF', 'JE-01-TESTING']
        },
        {
          riskType: 'Management Override of Controls',
          isaReference: 'ISA 240.31',
          status: 'Presumed - requires journal entry testing and review of estimates',
          linkedProcedures: ['JE-01-TESTING', 'JE-02-UNUSUAL', 'EST-01-REVIEW']
        }
      ]
    };

    const isa315EntityFactors = {
      industryRiskProfile: entityRiskFactors.industryRiskProfile,
      complexityIndicators: entityRiskFactors.complexityIndicators,
      estimationComplexity: entityRiskFactors.estimationComplexityFromNotes,
      relatedPartyTransactions: {
        present: entityRiskFactors.hasRelatedPartyTransactions,
        riskLevel: entityRiskFactors.relatedPartyRiskLevel
      }
    };

    const result = {
      significantFsHeads: significantFsHeads.map(h => ({
        fsHeadKey: h.fsHeadKey,
        fsHeadLabel: h.fsHeadLabel,
        isSignificant: h.isSignificant,
        significanceRationale: h.significanceRationale,
        sizeVsMateriality: h.sizeVsMateriality,
        volatility: h.volatility,
        estimationComplexity: h.estimationComplexity
      })),
      fsLevelRisks,
      assertionRisks,
      riskAnalytics,
      analysisDate: new Date().toISOString(),
      materiality: {
        overall: overallMateriality,
        performance: performanceMateriality,
        trivial: trivialThreshold
      },
      totalRisksIdentified: fsLevelRisks.length + assertionRisks.length,
      significantRisksCount: assertionRisks.filter(r => r.isSignificantRisk).length + fsLevelRisks.filter(r => r.severity === 'High').length,
      fraudRisksCount: assertionRisks.filter(r => r.isFraudRisk).length + fsLevelRisks.filter(r => r.isFraudIndicator).length,
      entityContext: {
        clientName: engagement.client?.name || 'Unknown',
        periodEnd: engagement.periodEnd?.toISOString().split('T')[0] || '',
        industry: entityUnderstanding?.natureOfBusiness || engagement.client?.industry || 'Not specified'
      },
      isa315EntityFactors,
      isa240FraudAnalysis,
      auditStrategyInputs,
      saveRiskAssessment: {
        canPersist: true,
        persistEndpoint: `/api/ai-risk-assessment/${engagementId}/persist`,
        dataVersion: '1.0.0',
        generatedAt: new Date().toISOString()
      }
    };

    res.json(result);
  } catch (error) {
    console.error("AI Risk Assessment analyze error:", error);
    res.status(500).json({ error: "Failed to run AI risk assessment analysis" });
  }
});

router.get("/:engagementId/summary", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const firmId = req.user!.firmId;

    if (!firmId) {
      return res.status(400).json({ error: "User not associated with a firm" });
    }

    const engagement = await prisma.engagement.findUnique({
      where: { id: engagementId },
      include: { client: true }
    });

    if (!engagement || engagement.firmId !== firmId) {
      return res.status(404).json({ error: "Engagement not found or access denied" });
    }

    const [materiality, riskAssessments] = await Promise.all([
      prisma.materialityCalculation.findFirst({
        where: { engagementId },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.riskAssessment.findMany({
        where: { engagementId },
        orderBy: { createdAt: 'desc' }
      })
    ]);

    res.json({
      hasData: !!materiality || riskAssessments.length > 0,
      materialitySet: !!materiality,
      risksIdentified: riskAssessments.length,
      significantRisks: riskAssessments.filter(r => r.isSignificantRisk).length,
      fraudRisks: riskAssessments.filter(r => r.isFraudRisk).length,
      lastUpdated: materiality?.createdAt || riskAssessments[0]?.createdAt || null
    });
  } catch (error) {
    console.error("AI Risk Assessment summary error:", error);
    res.status(500).json({ error: "Failed to fetch risk assessment summary" });
  }
});

router.post("/:engagementId/persist", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const firmId = req.user!.firmId;
    const userId = req.user!.id;

    if (!firmId) {
      return res.status(400).json({ error: "User not associated with a firm" });
    }

    const engagement = await prisma.engagement.findUnique({
      where: { id: engagementId }
    });

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    if (engagement.firmId !== firmId) {
      return res.status(403).json({ error: "Access denied" });
    }

    const { 
      assertionRisks, 
      fsLevelRisks, 
      isa315EntityFactors, 
      isa240FraudAnalysis,
      auditStrategyInputs,
      materiality
    } = req.body;

    if (!assertionRisks || !Array.isArray(assertionRisks)) {
      return res.status(400).json({ error: "assertionRisks array is required" });
    }

    const assertionEnumMap: Record<string, string> = {
      'EXISTENCE': 'EXISTENCE',
      'COMPLETENESS': 'COMPLETENESS',
      'ACCURACY': 'ACCURACY',
      'VALUATION': 'VALUATION',
      'CUTOFF': 'CUTOFF',
      'CLASSIFICATION': 'CLASSIFICATION',
      'OCCURRENCE': 'OCCURRENCE',
      'RIGHTS_OBLIGATIONS': 'RIGHTS_OBLIGATIONS',
      'PRESENTATION_DISCLOSURE': 'PRESENTATION_DISCLOSURE',
      'Existence': 'EXISTENCE',
      'Completeness': 'COMPLETENESS',
      'Accuracy': 'ACCURACY',
      'Valuation': 'VALUATION',
      'Cut-off': 'CUTOFF',
      'Classification': 'CLASSIFICATION',
      'Occurrence': 'OCCURRENCE',
      'Rights & Obligations': 'RIGHTS_OBLIGATIONS',
      'Rights and Obligations': 'RIGHTS_OBLIGATIONS',
      'Presentation & Disclosure': 'PRESENTATION_DISCLOSURE',
      'Presentation and Disclosure': 'PRESENTATION_DISCLOSURE',
    };

    const riskLevelMap: Record<string, string> = {
      'High': 'HIGH',
      'Medium': 'MODERATE',
      'Low': 'LOW',
      'HIGH': 'HIGH',
      'MODERATE': 'MODERATE',
      'LOW': 'LOW',
      'Significant': 'SIGNIFICANT',
      'SIGNIFICANT': 'SIGNIFICANT',
    };

    const fraudTypeMap: Record<string, string> = {
      'Revenue Recognition': 'REVENUE_RECOGNITION',
      'Management Override': 'MANAGEMENT_OVERRIDE',
      'Asset Misappropriation': 'ASSET_MISAPPROPRIATION',
      'Expense Manipulation': 'EXPENSE_MANIPULATION',
      'Related Party Abuse': 'RELATED_PARTY_ABUSE',
      'Disclosure Fraud': 'DISCLOSURE_FRAUD',
    };

    const fsAreaMap: Record<string, string> = {
      'REVENUE': 'REVENUE',
      'COST_OF_SALES': 'COST_OF_SALES',
      'OPERATING_EXPENSES': 'OPERATING_EXPENSES',
      'OTHER_INCOME': 'OTHER_INCOME',
      'FINANCE_COSTS': 'FINANCE_COSTS',
      'TAXATION': 'TAXATION',
      'CASH_AND_BANK': 'CASH_AND_BANK',
      'RECEIVABLES': 'RECEIVABLES',
      'INVENTORIES': 'INVENTORIES',
      'INVESTMENTS': 'INVESTMENTS',
      'FIXED_ASSETS': 'FIXED_ASSETS',
      'INTANGIBLES': 'INTANGIBLES',
      'PAYABLES': 'PAYABLES',
      'BORROWINGS': 'BORROWINGS',
      'PROVISIONS': 'PROVISIONS',
    };

    const mapAssertion = (val: string): string => assertionEnumMap[val] || 'EXISTENCE';
    const mapRiskLevel = (val: string): string => riskLevelMap[val] || 'MODERATE';

    let created = 0;
    let skipped = 0;
    const errors: string[] = [];

    await prisma.$transaction(async (tx) => {
      for (const risk of assertionRisks) {
        try {
          const assertion = mapAssertion(risk.assertion);
          const inherentRisk = mapRiskLevel(risk.riskRating || risk.likelihood || 'Medium');
          const controlRisk = mapRiskLevel(risk.magnitude || 'Medium');
          const romm = mapRiskLevel(risk.riskRating || 'Medium');
          const fsArea = fsAreaMap[risk.fsHeadKey?.toUpperCase()] || null;

          const fraudRiskIndicators: string[] = [];
          if (risk.fraudRiskCriteria) {
            if (risk.fraudRiskCriteria.pressureIndicators) fraudRiskIndicators.push(...risk.fraudRiskCriteria.pressureIndicators);
            if (risk.fraudRiskCriteria.opportunityIndicators) fraudRiskIndicators.push(...risk.fraudRiskCriteria.opportunityIndicators);
            if (risk.fraudRiskCriteria.rationalizationIndicators) fraudRiskIndicators.push(...risk.fraudRiskCriteria.rationalizationIndicators);
          }

          let fraudRiskType = null;
          if (risk.isFraudRisk) {
            const category = risk.fsHeadKey?.toUpperCase() || '';
            if (category.includes('REVENUE')) fraudRiskType = 'REVENUE_RECOGNITION';
            else if (category.includes('EXPENSE') || category.includes('COST')) fraudRiskType = 'EXPENSE_MANIPULATION';
            else if (category.includes('CASH') || category.includes('INVENTORY') || category.includes('FIXED')) fraudRiskType = 'ASSET_MISAPPROPRIATION';
            else fraudRiskType = 'MANAGEMENT_OVERRIDE';
          }

          await tx.riskAssessment.create({
            data: {
              engagementId,
              riskDescription: risk.riskStatement || risk.whatCouldGoWrong || `Risk for ${risk.fsHeadLabel} - ${risk.assertion}`,
              accountOrClass: risk.fsHeadLabel || risk.fsHeadKey || 'General',
              fsArea: fsArea as any || undefined,
              assertionImpacts: [assertion] as any[],
              assertion: assertion as any,
              inherentRisk: inherentRisk as any,
              controlRisk: controlRisk as any,
              riskOfMaterialMisstatement: romm as any,
              isSignificantRisk: !!risk.isSignificantRisk,
              significantRiskReason: risk.significantRiskRationale || null,
              isFraudRisk: !!risk.isFraudRisk,
              fraudRiskType: fraudRiskType as any || undefined,
              fraudRiskIndicators,
              fraudResponse: risk.isFraudRisk ? `Fraud risk identified for ${risk.fsHeadLabel}: ${risk.whatCouldGoWrong || risk.riskStatement}` : null,
              inherentRiskFactors: risk.isa315Adjustments || [],
              controlRiskFactors: risk.riskDriver ? [risk.riskDriver] : [],
              plannedResponse: risk.linkedProcedureIds?.length > 0 ? `Linked to ${risk.linkedProcedureIds.length} audit procedure(s)` : null,
              auditProcedureIds: risk.linkedProcedureIds || [],
              assessedById: userId,
              assessedDate: new Date(),
            },
          });
          created++;
        } catch (err: any) {
          skipped++;
          errors.push(`Risk for ${risk.fsHeadLabel || 'unknown'} - ${risk.assertion || 'unknown'}: ${err.message}`);
        }
      }
    });

    res.json({
      success: true,
      message: `Risk assessment persisted: ${created} risks created, ${skipped} skipped.`,
      metadata: {
        engagementId,
        userId,
        created,
        skipped,
        errors: errors.length > 0 ? errors : undefined,
        persistedAt: new Date().toISOString(),
        version: '1.0.0'
      }
    });
  } catch (error) {
    console.error("AI Risk Assessment persist error:", error);
    res.status(500).json({ error: "Failed to persist risk assessment" });
  }
});

router.get("/:engagementId/procedure-matrix", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const firmId = req.user!.firmId;

    if (!firmId) {
      return res.status(400).json({ error: "User not associated with a firm" });
    }

    const engagement = await prisma.engagement.findUnique({
      where: { id: engagementId }
    });

    if (!engagement || engagement.firmId !== firmId) {
      return res.status(404).json({ error: "Engagement not found or access denied" });
    }

    res.json({
      procedureMatrix: ISA_330_PROCEDURE_MAP,
      version: '1.0.0',
      isaReference: 'ISA 330 - The Auditor\'s Responses to Assessed Risks',
      description: 'Standard audit procedure templates linked to FS heads and assertions'
    });
  } catch (error) {
    console.error("AI Risk Assessment procedure matrix error:", error);
    res.status(500).json({ error: "Failed to fetch procedure matrix" });
  }
});

export default router;
