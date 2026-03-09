import type { EntityProfile, DisclosureNote, DisclosureTable, NoteCategory } from './notes-disclosure-registry';
import {
  DISCLOSURE_NOTES_REGISTRY as DISCLOSURE_NOTES,
  getApplicableNotes,
  getNoteIndex,
  getRequiredTables,
  determineFramework,
  buildDefaultEntityProfile,
  ACCOUNTING_POLICY_TEMPLATES,
  getApplicablePolicies,
  getPolicyText,
} from './notes-disclosure-registry';
import type { ReportingFramework, CompanyType } from './notes-disclosure-registry';
import type { DraftFSData, CoAAccountData, FSPriorYear, TrialBalanceData } from '../planning/fs-types';
import { parseNum } from '../planning/fs-types';

export interface NoteIndexEntry {
  noteNumber: string;
  title: string;
  category: NoteCategory;
  status: 'complete' | 'partial' | 'missing_data' | 'not_applicable';
  dataCompleteness: number;
}

export interface GeneratedNoteContent {
  noteNumber: string;
  key: string;
  title: string;
  category: NoteCategory;
  ifrsReference: string;
  narrativeText: string;
  subItems: GeneratedSubItem[];
  tables: GeneratedTable[];
  missingFields: string[];
  isApplicable: boolean;
  notApplicableReason?: string;
}

export interface GeneratedSubItem {
  label: string;
  currentYear: string | number | null;
  priorYear: string | number | null;
  format: string;
  isMissing: boolean;
}

export interface GeneratedTable {
  type: string;
  title: string;
  columns: { key: string; label: string; format?: string }[];
  rows: Record<string, string | number | null>[];
  footnotes: string[];
  isEmpty: boolean;
}

export interface ChecklistEntry {
  noteNumber: string;
  noteTitle: string;
  ifrsReference: string;
  status: 'required' | 'not_applicable';
  rationale: string;
  dataStatus: 'complete' | 'partial' | 'missing';
  missingItems: string[];
}

export interface MissingInfoItem {
  noteNumber: string;
  noteTitle: string;
  field: string;
  description: string;
  severity: 'critical' | 'important' | 'optional';
  suggestedSource: string;
}

export interface DisclosurePackage {
  entityProfile: EntityProfile;
  frameworkLabel: string;
  companyTypeLabel: string;
  generatedAt: string;
  noteIndex: NoteIndexEntry[];
  notes: GeneratedNoteContent[];
  checklist: ChecklistEntry[];
  missingInfo: MissingInfoItem[];
  statistics: {
    totalNotes: number;
    applicableNotes: number;
    completeNotes: number;
    partialNotes: number;
    missingDataNotes: number;
    notApplicableNotes: number;
    overallCompleteness: number;
    totalMissingItems: number;
    criticalMissing: number;
  };
}

const CRITICAL_KEYS = new Set([
  'ppe', 'revenue', 'cost_of_sales', 'taxation', 'trade_receivables',
  'cash_bank', 'inventories', 'share_capital', 'admin_expenses',
  'basis_of_preparation', 'company_info',
]);

const IMPORTANT_KEYS = new Set([
  'related_party_transactions', 'contingencies_commitments', 'long_term_borrowings',
  'short_term_borrowings', 'trade_payables', 'employee_benefits',
  'intangible_assets', 'provisions', 'deferred_tax',
]);

export function formatCurrency(amount: number): string {
  if (amount === 0) return 'Rs. -';
  const abs = Math.abs(amount);
  const formatted = abs.toLocaleString('en-PK', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  const fallback = abs.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const result = formatted !== abs.toString() ? formatted : fallback;
  return amount < 0 ? `Rs. (${result})` : `Rs. ${result}`;
}

export function fillTemplate(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value || `[${key}]`);
  }
  result = result.replace(/\{\{(\w+)\}\}/g, '[$1]');
  return result;
}

export function getAccountsByClass(coaAccounts: CoAAccountData[], classes: string[]): CoAAccountData[] {
  const lowerClasses = classes.map((c) => c.toLowerCase());
  return coaAccounts.filter((a) => {
    const cls = (a.accountClass || '').toLowerCase();
    const sub = (a.accountSubclass || '').toLowerCase();
    return lowerClasses.some((c) => cls.includes(c) || sub.includes(c));
  });
}

export function getAccountsByFsLine(coaAccounts: CoAAccountData[], fsLines: string[]): CoAAccountData[] {
  const upperLines = fsLines.map((f) => f.toUpperCase());
  return coaAccounts.filter((a) => {
    const fsLine = (a.fsLineItem || '').toUpperCase();
    const tbGroup = (a.tbGroup || '').toUpperCase();
    const noteRef = (a.notesDisclosureRef || '').toUpperCase();
    return upperLines.some(
      (f) => fsLine.includes(f) || tbGroup.includes(f) || noteRef.includes(f),
    );
  });
}

export function sumClosingBalances(accounts: CoAAccountData[]): number {
  return accounts.reduce((sum, a) => sum + (a.closingBalance || 0), 0);
}

export function sumOpeningBalances(accounts: CoAAccountData[]): number {
  return accounts.reduce((sum, a) => sum + (a.openingBalance || 0), 0);
}

export function getPriorYearValue(fsPriorYear: FSPriorYear | undefined, key: string): number {
  if (!fsPriorYear) return 0;
  const keyMap: Record<string, keyof FSPriorYear> = {
    ppe: 'propertyPlantEquipment',
    property_plant_equipment: 'propertyPlantEquipment',
    intangible: 'intangibleAssets',
    intangible_assets: 'intangibleAssets',
    inventories: 'inventories',
    trade_receivables: 'tradeReceivables',
    cash_bank: 'cashBankBalances',
    cash: 'cashBankBalances',
    share_capital: 'shareCapital',
    retained_earnings: 'retainedEarnings',
    revenue: 'revenue',
    cost_of_sales: 'costOfSales',
    admin_expenses: 'adminExpenses',
    distribution_costs: 'distributionCosts',
    other_operating_income: 'otherOperatingIncome',
    finance_income: 'financeIncome',
    finance_costs: 'financeCosts',
    income_tax: 'incomeTax',
    taxation: 'incomeTax',
  };
  const mapped = keyMap[key.toLowerCase()];
  if (!mapped) return 0;
  return parseNum(fsPriorYear[mapped]);
}

export function checkCondition(profile: EntityProfile, condition: string): boolean {
  const value = (profile as unknown as Record<string, unknown>)[condition];
  return value === true;
}

export function getFrameworkLabel(framework: ReportingFramework): string {
  switch (framework) {
    case 'full_ifrs':
      return 'International Financial Reporting Standards (IFRS) as applicable in Pakistan';
    case 'ifrs_sme':
      return 'IFRS for Small and Medium-sized Entities (IFRS for SMEs) as applicable in Pakistan';
    case 'companies_act_2017':
      return 'Accounting requirements of the Companies Act, 2017';
    default:
      return 'Applicable accounting and reporting standards';
  }
}

export function getCompanyTypeLabel(companyType: CompanyType): string {
  switch (companyType) {
    case 'small': return 'Small-sized Company (Private Limited)';
    case 'medium': return 'Medium-sized Company (Private Limited)';
    case 'large': return 'Large-sized Company (Private Limited)';
    case 'public_unlisted': return 'Public Unlisted Company';
    case 'listed': return 'Listed Company';
    case 'section_42_npo': return 'Section 42 - Not for Profit Organisation';
    case 'regulated_bank': return 'Regulated Entity - Banking Company';
    case 'regulated_nbfc': return 'Regulated Entity - Non-Banking Finance Company';
    case 'regulated_insurance': return 'Regulated Entity - Insurance Company';
    default: return 'Company';
  }
}

function findMatchingAccounts(coaAccounts: CoAAccountData[], requiredDataKeys: string[]): CoAAccountData[] {
  if (!requiredDataKeys || requiredDataKeys.length === 0) return [];
  return getAccountsByFsLine(coaAccounts, requiredDataKeys);
}

export function buildMovementSchedule(accounts: CoAAccountData[], categories: string[]): GeneratedTable {
  const depAccounts: CoAAccountData[] = [];
  const assetAccounts: CoAAccountData[] = [];

  for (const acc of accounts) {
    const name = (acc.accountName || '').toLowerCase();
    const cls = (acc.accountClass || '').toLowerCase();
    if (name.includes('depreciation') || name.includes('amort') || cls.includes('depreciation') || cls.includes('amort')) {
      depAccounts.push(acc);
    } else {
      assetAccounts.push(acc);
    }
  }

  const grouped = new Map<string, CoAAccountData[]>();
  for (const acc of assetAccounts) {
    const cat = acc.accountSubclass || acc.accountClass || 'Other';
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push(acc);
  }

  const totalDepClosing = depAccounts.reduce((s, a) => s + Math.abs(a.closingBalance || 0), 0);
  const totalDepOpening = depAccounts.reduce((s, a) => s + Math.abs(a.openingBalance || 0), 0);
  const totalAssetClosing = assetAccounts.reduce((s, a) => s + (a.closingBalance || 0), 0);

  const rows: Record<string, string | number | null>[] = [];
  for (const [cat, accs] of grouped.entries()) {
    const opening = accs.reduce((s, a) => s + (a.openingBalance || 0), 0);
    const additions = accs.reduce((s, a) => s + (a.periodDr || 0), 0);
    const disposals = accs.reduce((s, a) => s + (a.periodCr || 0), 0);
    const closing = accs.reduce((s, a) => s + (a.closingBalance || 0), 0);

    const catDepAccounts = depAccounts.filter(d => {
      const dSub = (d.accountSubclass || '').toLowerCase();
      const catLower = cat.toLowerCase();
      return dSub.includes(catLower) || catLower.includes(dSub.replace('depreciation', '').replace('amort', '').trim());
    });

    let catDepClosing = 0;
    let catDepOpening = 0;
    let chargeYear = 0;
    if (catDepAccounts.length > 0) {
      catDepClosing = catDepAccounts.reduce((s, a) => s + Math.abs(a.closingBalance || 0), 0);
      catDepOpening = catDepAccounts.reduce((s, a) => s + Math.abs(a.openingBalance || 0), 0);
      chargeYear = catDepClosing - catDepOpening;
    } else if (depAccounts.length > 0 && totalAssetClosing > 0) {
      const proportion = closing / totalAssetClosing;
      catDepClosing = Math.round(totalDepClosing * proportion);
      catDepOpening = Math.round(totalDepOpening * proportion);
      chargeYear = catDepClosing - catDepOpening;
    }

    const nbv = closing - catDepClosing;

    rows.push({
      asset_class: cat,
      opening_cost: opening,
      additions,
      disposals,
      transfers: 0,
      closing_cost: closing,
      opening_dep: catDepOpening,
      charge_year: chargeYear > 0 ? chargeYear : 0,
      dep_on_disposals: 0,
      closing_dep: catDepClosing,
      nbv,
      rate: null,
      opening: opening,
      depreciation: chargeYear > 0 ? chargeYear : 0,
      derecognition: 0,
      closing: closing,
    });
  }

  const hasDepData = depAccounts.length > 0;

  return {
    type: 'movement_schedule',
    title: 'Movement Schedule',
    columns: [
      { key: 'asset_class', label: 'Category', format: 'text' },
      { key: 'opening_cost', label: 'Opening Cost', format: 'currency' },
      { key: 'additions', label: 'Additions', format: 'currency' },
      { key: 'disposals', label: 'Disposals', format: 'currency' },
      { key: 'closing_cost', label: 'Closing Cost', format: 'currency' },
      { key: 'closing_dep', label: 'Acc. Depreciation', format: 'currency' },
      { key: 'nbv', label: 'Net Book Value', format: 'currency' },
    ],
    rows,
    footnotes: rows.length === 0
      ? ['No movement data available. Detailed depreciation/amortisation data requires manual input.']
      : hasDepData
        ? ['Depreciation allocated from accumulated depreciation accounts in the Chart of Accounts.']
        : ['No accumulated depreciation accounts found. Depreciation details require manual input or separate depreciation schedule upload.'],
    isEmpty: rows.length === 0,
  };
}

export function buildAgeingAnalysis(accounts: CoAAccountData[]): GeneratedTable {
  const total = sumClosingBalances(accounts);
  const rows: Record<string, string | number | null>[] = [
    { age_bucket: '0 - 30 days', amount: total > 0 ? Math.round(total * 0.5) : null, percentage: total > 0 ? 50 : null },
    { age_bucket: '31 - 60 days', amount: total > 0 ? Math.round(total * 0.25) : null, percentage: total > 0 ? 25 : null },
    { age_bucket: '61 - 90 days', amount: total > 0 ? Math.round(total * 0.15) : null, percentage: total > 0 ? 15 : null },
    { age_bucket: 'Over 90 days', amount: total > 0 ? Math.round(total * 0.10) : null, percentage: total > 0 ? 10 : null },
  ];

  return {
    type: 'ageing_analysis',
    title: 'Estimated Ageing Analysis',
    columns: [
      { key: 'age_bucket', label: 'Age Bucket', format: 'text' },
      { key: 'amount', label: 'Amount (Estimated)', format: 'currency' },
      { key: 'percentage', label: '%', format: 'percentage' },
    ],
    rows: total > 0 ? rows : [],
    footnotes: total > 0
      ? [
          'ESTIMATED: This ageing breakdown is an approximation based on total balances. Actual ageing data is not available from the trial balance.',
          'Actual ageing analysis requires detailed sub-ledger data or accounts receivable/payable ageing reports from the client.',
          'The auditor should obtain and verify the actual ageing schedule from management before finalising these disclosures.',
        ]
      : ['No receivable/payable balances to age.'],
    isEmpty: total === 0,
  };
}

export function buildMaturityAnalysis(accounts: CoAAccountData[]): GeneratedTable {
  const total = Math.abs(sumClosingBalances(accounts));
  const rows: Record<string, string | number | null>[] = total > 0
    ? [
        { period: 'Within 1 year', undiscounted_amount: Math.round(total * 0.3), present_value: Math.round(total * 0.28) },
        { period: '1 - 2 years', undiscounted_amount: Math.round(total * 0.3), present_value: Math.round(total * 0.26) },
        { period: '2 - 5 years', undiscounted_amount: Math.round(total * 0.3), present_value: Math.round(total * 0.24) },
        { period: 'Over 5 years', undiscounted_amount: Math.round(total * 0.1), present_value: Math.round(total * 0.07) },
      ]
    : [];

  return {
    type: 'maturity_analysis',
    title: 'Estimated Maturity Analysis',
    columns: [
      { key: 'period', label: 'Period', format: 'text' },
      { key: 'undiscounted_amount', label: 'Undiscounted Amount (Estimated)', format: 'currency' },
      { key: 'present_value', label: 'Present Value (Estimated)', format: 'currency' },
    ],
    rows,
    footnotes: total > 0
      ? [
          'ESTIMATED: This maturity profile is an approximation based on total balances. Actual maturity data is not available from the trial balance.',
          'Actual maturity breakdown requires loan/lease schedules, borrowing agreements, and contractual terms from the client.',
          'The auditor should obtain and verify the actual maturity schedule from management before finalising these disclosures.',
        ]
      : ['No balances to analyse.'],
    isEmpty: rows.length === 0,
  };
}

export function buildBreakdownTable(accounts: CoAAccountData[], groupBy: string): GeneratedTable {
  const grouped = new Map<string, { current: number; opening: number }>();
  for (const acc of accounts) {
    const key = groupBy === 'fsLineItem'
      ? (acc.fsLineItem || acc.accountName || 'Other')
      : (acc.accountSubclass || acc.accountName || 'Other');
    if (!grouped.has(key)) grouped.set(key, { current: 0, opening: 0 });
    const g = grouped.get(key)!;
    g.current += acc.closingBalance || 0;
    g.opening += acc.openingBalance || 0;
  }

  const rows: Record<string, string | number | null>[] = [];
  for (const [desc, vals] of grouped.entries()) {
    rows.push({
      description: desc,
      revenue_stream: desc,
      current_year: vals.current,
      prior_year: vals.opening,
      timing: 'At a point in time',
    });
  }

  return {
    type: 'basic_breakdown',
    title: 'Breakdown',
    columns: [
      { key: 'description', label: 'Description', format: 'text' },
      { key: 'current_year', label: 'Current Year', format: 'currency' },
      { key: 'prior_year', label: 'Prior Year', format: 'currency' },
    ],
    rows,
    footnotes: rows.length === 0 ? ['No data available for breakdown.'] : [],
    isEmpty: rows.length === 0,
  };
}

function buildTableForNote(
  tableSpec: DisclosureTable,
  accounts: CoAAccountData[],
): GeneratedTable {
  switch (tableSpec.type) {
    case 'movement_schedule':
      return { ...buildMovementSchedule(accounts, []), title: tableSpec.title, type: tableSpec.type };
    case 'ageing_analysis':
      return { ...buildAgeingAnalysis(accounts), title: tableSpec.title, type: tableSpec.type };
    case 'maturity_analysis':
    case 'lease_maturity':
    case 'borrowing_schedule':
      return { ...buildMaturityAnalysis(accounts), title: tableSpec.title, type: tableSpec.type };
    case 'provision_movement':
      return { ...buildMovementSchedule(accounts, []), title: tableSpec.title, type: tableSpec.type };
    case 'revenue_disaggregation':
      return { ...buildBreakdownTable(accounts, 'accountSubclass'), title: tableSpec.title, type: tableSpec.type };
    case 'tax_reconciliation': {
      const total = sumClosingBalances(accounts);
      const rows: Record<string, string | number | null>[] = total !== 0
        ? [
            { description: 'Profit before taxation', amount: null, rate: null },
            { description: 'Tax at applicable rate', amount: null, rate: null },
            { description: 'Tax effect of permanent differences', amount: null, rate: null },
            { description: 'Tax effect of temporary differences', amount: null, rate: null },
            { description: 'Prior year adjustments', amount: null, rate: null },
            { description: 'Tax charge for the year', amount: total, rate: null },
          ]
        : [];
      return {
        type: tableSpec.type,
        title: tableSpec.title,
        columns: tableSpec.columns,
        rows,
        footnotes: rows.length > 0
          ? ['Tax reconciliation requires manual input of applicable tax rate and permanent/temporary differences.']
          : ['No tax data available.'],
        isEmpty: rows.length === 0,
      };
    }
    case 'related_party_matrix': {
      return {
        type: tableSpec.type,
        title: tableSpec.title,
        columns: tableSpec.columns,
        rows: [
          { party_name: '[Related party name]', relationship: '[Relationship]', nature: '[Nature of transaction]', amount: null, balance: null },
        ],
        footnotes: ['Related party details require manual input from engagement team.'],
        isEmpty: false,
      };
    }
    case 'sensitivity_analysis':
    case 'fair_value_hierarchy':
    case 'segment_analysis':
      return {
        type: tableSpec.type,
        title: tableSpec.title,
        columns: tableSpec.columns,
        rows: [],
        footnotes: ['This analysis requires manual input from the engagement team.'],
        isEmpty: true,
      };
    case 'basic_breakdown':
    case 'inventory_breakdown':
    default:
      return { ...buildBreakdownTable(accounts, 'accountSubclass'), title: tableSpec.title, type: tableSpec.type };
  }
}

function findFsLineItemAmount(
  draftFsData: DraftFSData | undefined,
  statementKey: 'balanceSheet' | 'profitLoss',
  searchTerms: string[],
): { current: number; opening: number; found: boolean } {
  if (!draftFsData) return { current: 0, opening: 0, found: false };
  const sections = draftFsData[statementKey]?.sections || [];
  for (const section of sections) {
    for (const li of section.lineItems || []) {
      const name = (li.displayName || li.fsLineItem || '').toLowerCase();
      if (searchTerms.some(t => name.includes(t.toLowerCase()))) {
        return {
          current: li.adjustedTotal || li.originalTotal || 0,
          opening: li.openingTotal || 0,
          found: true,
        };
      }
    }
  }
  return { current: 0, opening: 0, found: false };
}

function generateNoteContent(
  note: DisclosureNote,
  draftFsData: DraftFSData | undefined,
  coaAccounts: CoAAccountData[],
  fsPriorYear: FSPriorYear | undefined,
  trialBalance: TrialBalanceData | undefined,
  clientName: string,
  periodEnd: string,
  entityProfile: EntityProfile,
): GeneratedNoteContent {
  const missingFields: string[] = [];
  const matchedAccounts = findMatchingAccounts(coaAccounts, note.requiredDataKeys);
  const hasData = matchedAccounts.length > 0 || note.requiredDataKeys.length === 0;
  const currentTotal = sumClosingBalances(matchedAccounts);
  const openingTotal = sumOpeningBalances(matchedAccounts);
  const priorValue = getPriorYearValue(fsPriorYear, note.key);

  const currency = trialBalance?.currency || 'Pakistani Rupee';
  const framework = entityProfile.reportingFramework;
  const frameworkDesc = getFrameworkLabel(framework);

  const templateVars: Record<string, string> = {
    companyName: clientName,
    periodEnd,
    currency,
    registeredOffice: '[Address to be provided]',
    principalActivity: entityProfile.industry || '[Principal activity to be provided]',
    framework: framework === 'full_ifrs' ? 'IFRS' : framework === 'ifrs_sme' ? 'IFRS for SMEs' : 'Companies Act 2017',
    frameworkDescription: frameworkDesc,
    priorYear: 'Prior year',
    roundingUnit: 'Rupee',
    incorporationDate: '[Date to be provided]',
    companyType: getCompanyTypeLabel(entityProfile.companyType),
    incorporationLaw: 'Companies Act 2017',
    secpNo: '[SECP No. to be provided]',
    numberOfEmployees: '[To be provided]',
    priorYearEmployees: '[To be provided]',
  };

  const ppeFs = findFsLineItemAmount(draftFsData, 'balanceSheet', ['Property, Plant', 'Fixed Assets', 'PPE']);
  const inventoryFs = findFsLineItemAmount(draftFsData, 'balanceSheet', ['Inventor']);
  const receivableFs = findFsLineItemAmount(draftFsData, 'balanceSheet', ['Receivable', 'Trade Debtor']);
  const payableFs = findFsLineItemAmount(draftFsData, 'balanceSheet', ['Payable', 'Trade Creditor']);
  const revenueFs = findFsLineItemAmount(draftFsData, 'profitLoss', ['Revenue', 'Sales', 'Turnover']);

  if (hasData && note.requiredDataKeys.length > 0) {
    templateVars[`${note.key}Total`] = formatCurrency(currentTotal);
    templateVars[`prior${capitalize(note.key)}Total`] = priorValue ? formatCurrency(priorValue) : formatCurrency(openingTotal);

    const ppeAmount = ppeFs.found ? ppeFs.current : currentTotal;
    const ppePrior = ppeFs.found ? ppeFs.opening : (priorValue || openingTotal);
    templateVars['ppeGross'] = formatCurrency(ppeAmount);
    templateVars['priorPpeGross'] = formatCurrency(ppePrior);
    templateVars['ppeAccDep'] = '[Accumulated depreciation to be provided]';
    templateVars['priorPpeAccDep'] = '[Prior year accumulated depreciation]';
    templateVars['ppeNet'] = formatCurrency(ppeAmount);
    templateVars['priorPpeNet'] = formatCurrency(ppePrior);

    templateVars['intangibleNet'] = formatCurrency(currentTotal);
    templateVars['priorIntangibleNet'] = formatCurrency(priorValue || openingTotal);

    const revAmount = revenueFs.found ? Math.abs(revenueFs.current) : Math.abs(currentTotal);
    const revPrior = revenueFs.found ? Math.abs(revenueFs.opening) : Math.abs(priorValue || openingTotal);
    templateVars['revenueTotal'] = formatCurrency(revAmount);
    templateVars['priorRevenueTotal'] = formatCurrency(revPrior);
    templateVars['grossRevenue'] = formatCurrency(revAmount);
    templateVars['netRevenue'] = formatCurrency(revAmount);

    templateVars['costOfSalesTotal'] = formatCurrency(Math.abs(currentTotal));
    templateVars['priorCostOfSalesTotal'] = formatCurrency(Math.abs(priorValue || openingTotal));
    templateVars['adminTotal'] = formatCurrency(Math.abs(currentTotal));
    templateVars['priorAdminTotal'] = formatCurrency(Math.abs(priorValue || openingTotal));
    templateVars['distributionTotal'] = formatCurrency(Math.abs(currentTotal));
    templateVars['priorDistributionTotal'] = formatCurrency(Math.abs(priorValue || openingTotal));
    templateVars['otherIncomeTotal'] = formatCurrency(Math.abs(currentTotal));
    templateVars['priorOtherIncomeTotal'] = formatCurrency(Math.abs(priorValue || openingTotal));
    templateVars['otherExpenseTotal'] = formatCurrency(Math.abs(currentTotal));
    templateVars['priorOtherExpenseTotal'] = formatCurrency(Math.abs(priorValue || openingTotal));
    templateVars['financeCostsTotal'] = formatCurrency(Math.abs(currentTotal));
    templateVars['priorFinanceCostsTotal'] = formatCurrency(Math.abs(priorValue || openingTotal));
    templateVars['salesTax'] = '[To be provided]';
    templateVars['tradeDiscounts'] = '[To be provided]';
    templateVars['currentTax'] = '[To be provided]';
    templateVars['deferredTaxCharge'] = '[To be provided]';
    templateVars['totalTaxCharge'] = formatCurrency(Math.abs(currentTotal));
    templateVars['priorTotalTaxCharge'] = formatCurrency(Math.abs(priorValue || openingTotal));
    templateVars['provisionsTotal'] = formatCurrency(Math.abs(currentTotal));
    templateVars['priorProvisionsTotal'] = formatCurrency(Math.abs(priorValue || openingTotal));

    const invAmount = inventoryFs.found ? inventoryFs.current : currentTotal;
    const invPrior = inventoryFs.found ? inventoryFs.opening : (priorValue || openingTotal);
    templateVars['inventoriesTotal'] = formatCurrency(invAmount);
    templateVars['priorInventoriesTotal'] = formatCurrency(invPrior);

    const recAmount = receivableFs.found ? receivableFs.current : currentTotal;
    const recPrior = receivableFs.found ? receivableFs.opening : (priorValue || openingTotal);
    templateVars['tradeReceivablesGross'] = formatCurrency(recAmount);
    templateVars['tradeReceivablesNet'] = formatCurrency(recAmount);
    templateVars['priorTradeReceivablesNet'] = formatCurrency(recPrior);

    const payAmount = payableFs.found ? Math.abs(payableFs.current) : Math.abs(currentTotal);
    const payPrior = payableFs.found ? Math.abs(payableFs.opening) : Math.abs(priorValue || openingTotal);
    templateVars['tradePayablesTotal'] = formatCurrency(payAmount);
    templateVars['priorTradePayablesTotal'] = formatCurrency(payPrior);

    templateVars['cashTotal'] = formatCurrency(currentTotal);
    templateVars['priorCashTotal'] = formatCurrency(priorValue || openingTotal);
    templateVars['shareCapitalTotal'] = formatCurrency(Math.abs(currentTotal));
    templateVars['rouNet'] = formatCurrency(currentTotal);
    templateVars['priorRouNet'] = formatCurrency(openingTotal);
    templateVars['leaseTotal'] = formatCurrency(Math.abs(currentTotal));
    templateVars['priorLeaseTotal'] = formatCurrency(Math.abs(openingTotal));
  } else if (note.requiredDataKeys.length > 0) {
    missingFields.push(`No matching accounts found for: ${note.requiredDataKeys.join(', ')}`);
  }

  if (note.key === 'significant_accounting_policies') {
    const applicablePolicies = getApplicablePolicies(entityProfile);
    const policyTexts: string[] = [];
    let policyIdx = 1;
    for (const [pKey] of Object.entries(applicablePolicies)) {
      const text = getPolicyText(pKey, framework);
      if (text) {
        const template = applicablePolicies[pKey];
        policyTexts.push(`3.${policyIdx} ${template.title}\n${text}`);
        policyIdx++;
      }
    }
    templateVars['policyTexts'] = policyTexts.length > 0
      ? policyTexts.join('\n\n')
      : '[Accounting policies to be drafted based on entity profile]';
  }

  if (note.key === 'critical_estimates') {
    templateVars['estimatesList'] = '[Critical estimates and judgements to be documented by the engagement team]';
  }
  if (note.key === 'contingencies_commitments') {
    templateVars['contingenciesList'] = '[Contingent liabilities to be documented]';
    templateVars['capitalCommitmentsContracted'] = '[To be provided]';
    templateVars['capitalCommitmentsAuthorised'] = '[To be provided]';
    templateVars['otherCommitments'] = '[To be provided]';
    templateVars['bankGuarantees'] = '[To be provided]';
    templateVars['priorBankGuarantees'] = '[To be provided]';
  }
  if (note.key === 'related_party_transactions') {
    templateVars['relatedPartyList'] = '[Related party details to be provided by management]';
    templateVars['kmpShortTerm'] = '[To be provided]';
    templateVars['kmpPostEmployment'] = '[To be provided]';
    templateVars['kmpTotal'] = '[To be provided]';
  }
  if (note.key === 'cash_flow_notes') {
    templateVars['cashInHand'] = '[To be provided]';
    templateVars['bankBalances'] = '[To be provided]';
    templateVars['shortTermDeposits'] = '[To be provided]';
    templateVars['bankOverdrafts'] = '[To be provided]';
    templateVars['cashEquivalentsTotal'] = formatCurrency(currentTotal);
    templateVars['nonCashActivities'] = '[Non-cash activities to be documented]';
  }

  const narrativeText = fillTemplate(note.narrativeTemplate, templateVars);

  const subItems: GeneratedSubItem[] = note.subItems.map((si) => {
    let currentVal: string | number | null = null;
    let priorVal: string | number | null = null;
    let isMissing = true;

    if (si.format === 'currency' && si.dataKey && matchedAccounts.length > 0) {
      const relevantAccounts = getAccountsByFsLine(matchedAccounts, [si.dataKey]);
      if (relevantAccounts.length > 0) {
        currentVal = sumClosingBalances(relevantAccounts);
        priorVal = sumOpeningBalances(relevantAccounts);
        isMissing = false;
      } else {
        currentVal = currentTotal;
        priorVal = openingTotal;
        isMissing = matchedAccounts.length === 0;
      }
    } else if (si.format === 'currency' && matchedAccounts.length > 0) {
      isMissing = true;
    } else if (si.format === 'text') {
      isMissing = true;
    }

    if (isMissing && si.format === 'currency') {
      missingFields.push(si.label);
    }

    return {
      label: si.label,
      currentYear: currentVal,
      priorYear: priorVal,
      format: si.format || 'text',
      isMissing,
    };
  });

  const tables: GeneratedTable[] = note.tables.map((tableSpec) =>
    buildTableForNote(tableSpec, matchedAccounts),
  );

  return {
    noteNumber: note.noteNumber,
    key: note.key,
    title: note.title,
    category: note.category,
    ifrsReference: note.ifrsReference,
    narrativeText,
    subItems,
    tables,
    missingFields,
    isApplicable: true,
  };
}

function computeNoteStatus(
  note: GeneratedNoteContent,
): { status: NoteIndexEntry['status']; completeness: number } {
  if (!note.isApplicable) {
    return { status: 'not_applicable', completeness: 100 };
  }

  const totalItems = note.subItems.length + note.tables.length;
  if (totalItems === 0 && note.missingFields.length === 0) {
    return { status: 'complete', completeness: 100 };
  }

  const filledSubItems = note.subItems.filter((si) => !si.isMissing).length;
  const nonEmptyTables = note.tables.filter((t) => !t.isEmpty).length;
  const filledCount = filledSubItems + nonEmptyTables;

  if (totalItems === 0) {
    return note.missingFields.length > 0
      ? { status: 'missing_data', completeness: 0 }
      : { status: 'complete', completeness: 100 };
  }

  const completeness = Math.round((filledCount / totalItems) * 100);

  if (completeness >= 80) return { status: 'complete', completeness };
  if (completeness > 0) return { status: 'partial', completeness };
  return { status: 'missing_data', completeness: 0 };
}

export function buildChecklist(
  applicableNotes: DisclosureNote[],
  generatedNotes: GeneratedNoteContent[],
  entityProfile: EntityProfile,
): ChecklistEntry[] {
  const applicableKeys = new Set(applicableNotes.map((n) => n.key));
  const generatedMap = new Map(generatedNotes.map((n) => [n.key, n]));

  return DISCLOSURE_NOTES.map((note) => {
    const isApplicable = applicableKeys.has(note.key);
    const generated = generatedMap.get(note.key);
    const missingItems: string[] = generated ? [...generated.missingFields] : [];

    let dataStatus: ChecklistEntry['dataStatus'] = 'missing';
    if (generated) {
      const { status } = computeNoteStatus(generated);
      if (status === 'complete') dataStatus = 'complete';
      else if (status === 'partial') dataStatus = 'partial';
      else dataStatus = 'missing';
    }

    let rationale = '';
    if (isApplicable) {
      rationale = `Required under ${note.ifrsReference} for ${getCompanyTypeLabel(entityProfile.companyType)}.`;
    } else {
      rationale = note.notApplicableRationale || `Not applicable based on entity profile and conditions.`;
    }

    return {
      noteNumber: note.noteNumber,
      noteTitle: note.title,
      ifrsReference: note.ifrsReference,
      status: isApplicable ? 'required' : 'not_applicable',
      rationale,
      dataStatus: isApplicable ? dataStatus : 'complete',
      missingItems: isApplicable ? missingItems : [],
    };
  });
}

export function collectMissingInfo(notes: GeneratedNoteContent[]): MissingInfoItem[] {
  const items: MissingInfoItem[] = [];

  for (const note of notes) {
    if (!note.isApplicable) continue;

    for (const field of note.missingFields) {
      let severity: MissingInfoItem['severity'] = 'optional';
      let suggestedSource = 'Management / Engagement team';

      if (CRITICAL_KEYS.has(note.key)) {
        severity = 'critical';
        suggestedSource = 'Trial Balance / Chart of Accounts / Client records';
      } else if (IMPORTANT_KEYS.has(note.key)) {
        severity = 'important';
        suggestedSource = 'Client management / Supporting schedules';
      }

      const lowerField = field.toLowerCase();
      if (lowerField.includes('sensitivity') || lowerField.includes('fair value') || lowerField.includes('hierarchy')) {
        severity = 'optional';
        suggestedSource = 'Valuation reports / Management estimates';
      }
      if (lowerField.includes('related party') || lowerField.includes('kmp')) {
        severity = 'important';
        suggestedSource = 'Management representation / Related party questionnaire';
      }
      if (lowerField.includes('tax') || lowerField.includes('revenue') || lowerField.includes('ppe') || lowerField.includes('cost')) {
        severity = 'critical';
        suggestedSource = 'Trial Balance / Supporting schedules / Tax computations';
      }

      items.push({
        noteNumber: note.noteNumber,
        noteTitle: note.title,
        field,
        description: `Missing: ${field} for Note ${note.noteNumber} - ${note.title}`,
        severity,
        suggestedSource,
      });
    }

    for (const si of note.subItems) {
      if (si.isMissing && si.format === 'currency') {
        const alreadyTracked = items.some(
          (i) => i.noteNumber === note.noteNumber && i.field === si.label,
        );
        if (alreadyTracked) continue;

        let severity: MissingInfoItem['severity'] = 'optional';
        if (CRITICAL_KEYS.has(note.key)) severity = 'critical';
        else if (IMPORTANT_KEYS.has(note.key)) severity = 'important';

        items.push({
          noteNumber: note.noteNumber,
          noteTitle: note.title,
          field: si.label,
          description: `Missing amount: ${si.label}`,
          severity,
          suggestedSource: 'Client records / Supporting schedules',
        });
      }
    }
  }

  return items;
}

export function buildDisclosurePackage(
  entityProfile: EntityProfile,
  draftFsData: DraftFSData | undefined,
  coaAccounts: CoAAccountData[],
  fsPriorYear: FSPriorYear | undefined,
  trialBalance: TrialBalanceData | undefined,
  clientName: string,
  periodEnd: string,
  engagementId: string,
): DisclosurePackage {
  const applicableNotes = getApplicableNotes(entityProfile);

  const generatedNotes: GeneratedNoteContent[] = applicableNotes.map((note) =>
    generateNoteContent(
      note,
      draftFsData,
      coaAccounts,
      fsPriorYear,
      trialBalance,
      clientName,
      periodEnd,
      entityProfile,
    ),
  );

  const noteIndex: NoteIndexEntry[] = generatedNotes.map((gn) => {
    const { status, completeness } = computeNoteStatus(gn);
    return {
      noteNumber: gn.noteNumber,
      title: gn.title,
      category: gn.category,
      status: gn.isApplicable ? status : 'not_applicable',
      dataCompleteness: completeness,
    };
  });

  const notApplicableNotes = DISCLOSURE_NOTES.filter(
    (dn) => !applicableNotes.some((an) => an.key === dn.key),
  );
  for (const naN of notApplicableNotes) {
    noteIndex.push({
      noteNumber: naN.noteNumber,
      title: naN.title,
      category: naN.category,
      status: 'not_applicable',
      dataCompleteness: 100,
    });
  }

  noteIndex.sort((a, b) => {
    const na = parseInt(a.noteNumber) || 0;
    const nb = parseInt(b.noteNumber) || 0;
    return na - nb;
  });

  const checklist = buildChecklist(applicableNotes, generatedNotes, entityProfile);
  const missingInfo = collectMissingInfo(generatedNotes);

  const completeCount = noteIndex.filter((n) => n.status === 'complete').length;
  const partialCount = noteIndex.filter((n) => n.status === 'partial').length;
  const missingDataCount = noteIndex.filter((n) => n.status === 'missing_data').length;
  const notApplicableCount = noteIndex.filter((n) => n.status === 'not_applicable').length;
  const applicableCount = noteIndex.length - notApplicableCount;
  const criticalMissing = missingInfo.filter((m) => m.severity === 'critical').length;

  const totalCompleteness = applicableCount > 0
    ? noteIndex
        .filter((n) => n.status !== 'not_applicable')
        .reduce((sum, n) => sum + n.dataCompleteness, 0) / applicableCount
    : 100;

  return {
    entityProfile,
    frameworkLabel: getFrameworkLabel(entityProfile.reportingFramework),
    companyTypeLabel: getCompanyTypeLabel(entityProfile.companyType),
    generatedAt: new Date().toISOString(),
    noteIndex,
    notes: generatedNotes,
    checklist,
    missingInfo,
    statistics: {
      totalNotes: noteIndex.length,
      applicableNotes: applicableCount,
      completeNotes: completeCount,
      partialNotes: partialCount,
      missingDataNotes: missingDataCount,
      notApplicableNotes: notApplicableCount,
      overallCompleteness: Math.round(totalCompleteness),
      totalMissingItems: missingInfo.length,
      criticalMissing,
    },
  };
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
