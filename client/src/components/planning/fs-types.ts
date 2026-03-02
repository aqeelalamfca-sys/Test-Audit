export interface DraftFSLineItem {
  fsLineItem: string;
  displayName: string;
  originalTotal: number;
  adjustedTotal: number;
  accountCount: number;
  notesRef?: string;
  openingTotal?: number;
}

export interface DraftFSSection {
  sectionName: string;
  displayOrder: number;
  isSubtotal: boolean;
  lineItems: DraftFSLineItem[];
  sectionOriginalTotal: number;
  sectionAdjustedTotal: number;
}

export interface DraftFSData {
  balanceSheet: {
    sections: DraftFSSection[];
    totalAssets: number;
    totalEquityLiabilities: number;
    isBalanced: boolean;
    variance: number;
  };
  profitLoss: {
    sections: DraftFSSection[];
    revenue: number;
    expenses: number;
    netProfit: number;
  };
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

export interface CoAAccountData {
  id: string;
  accountCode: string;
  accountName: string;
  accountClass: string;
  accountSubclass: string;
  nature: string;
  tbGroup: string;
  fsLineItem: string;
  notesDisclosureRef: string;
  openingBalance: number;
  periodDr: number;
  periodCr: number;
  closingBalance: number;
}

export interface FSPriorYear {
  propertyPlantEquipment: string;
  intangibleAssets: string;
  inventories: string;
  tradeReceivables: string;
  cashBankBalances: string;
  shareCapital: string;
  retainedEarnings: string;
  revenue: string;
  costOfSales: string;
  adminExpenses: string;
  distributionCosts: string;
  otherOperatingIncome: string;
  financeIncome: string;
  financeCosts: string;
  incomeTax: string;
}

export interface TrialBalanceData {
  fileUploaded: boolean;
  fileName: string;
  reportingPeriodEnd: string;
  currency: string;
  validationStatus: string;
  profitBeforeTax: string;
  revenue: string;
  totalAssets: string;
  totalEquity: string;
  aiObservations: string;
  professionalNotes: string;
}

export function parseNum(val: string | number | undefined | null): number {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number') return val;
  return parseFloat(val.replace(/,/g, '')) || 0;
}
