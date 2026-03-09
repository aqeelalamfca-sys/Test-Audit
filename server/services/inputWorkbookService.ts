import { prisma } from "../db";
import ExcelJS from "exceljs";
import { classifyAccount } from "./accountClassificationService";
import crypto from "crypto";

async function validateGLCodesExist(
  engagementId: string,
  glCodes: string[],
  existingCoaCodes?: Set<string>
): Promise<Set<string>> {
  if (existingCoaCodes) {
    return existingCoaCodes;
  }
  const coaAccounts = await prisma.coAAccount.findMany({
    where: { engagementId },
    select: { accountCode: true }
  });
  return new Set(coaAccounts.map(a => a.accountCode));
}

export interface ParsedSheetData {
  parties: ParsedPartyRow[];
  bankAccounts: ParsedBankAccountRow[];
  trialBalance: ParsedTBRow[];
  generalLedger: ParsedGLRow[];
  openItems: ParsedOpenItemRow[];
  chartOfAccounts?: ParsedCoARow[];
  bankBalances?: ParsedBankBalanceRow[];
  confirmations?: ParsedConfirmationRow[];
}

export interface ParsedCoARow {
  rowNo: number;
  accountCode: string;
  accountName: string;
  category: string;
  subCategory: string;
  fsLineItem: string;
  isControlAccount: boolean;
  normalBalance: string;
  status: string;
}

export interface ParsedBankBalanceRow {
  rowNo: number;
  bankCode: string;
  bankName: string;
  closingBalance: number;
  currency: string;
  lastReconciled: Date | null;
}

export interface ParsedConfirmationRow {
  rowNo: number;
  confirmationId: string;
  partyType: string;
  partyCode: string;
  partyName: string;
  balance: number;
  sentDate: Date | null;
  responseStatus: string;
}

export interface ParsedPartyRow {
  rowNo: number;
  partyCode: string;
  partyName: string;
  partyType: string;
  controlAccountCode: string;
  email?: string;
  address?: string;
  attentionTo?: string;
}

export interface ParsedBankAccountRow {
  rowNo: number;
  bankAccountCode: string;
  bankName: string;
  accountNo: string;
  accountTitle: string;
  branchName?: string;
  branchAddress?: string;
  iban?: string;
  swiftBic?: string;
  relationshipManager?: string;
  bankEmail?: string;
  currency: string;
  glAccountCode?: string;
  partyId?: string;
}

export interface ParsedTBRow {
  rowNo: number;
  accountCode: string;
  accountName: string;
  openingDebit: number;
  openingCredit: number;
  movementDebit: number;
  movementCredit: number;
  closingDebit: number;
  closingCredit: number;
}

export interface ParsedGLRow {
  rowNo: number;
  journalId: string;
  voucherNo: string;
  voucherDate: Date;
  docType: string;
  lineNo: number;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  partyCode?: string;
  partyName?: string;
  partyType?: string;
  partyEmail?: string;
  partyAddress?: string;
  documentNo?: string;
  documentDate?: Date;
  invoiceNo?: string;
  dueDate?: Date;
  costCenter?: string;
  department?: string;
  project?: string;
  location?: string;
  sourceModule?: string;
  currency: string;
  fxRate: number;
  description?: string;
  narration?: string;
}

export interface ParsedOpenItemRow {
  rowNo: number;
  partyCode: string;
  partyType: string;
  glCode?: string;
  glName?: string;
  documentNo: string;
  documentDate: Date;
  dueDate?: Date;
  invoiceNo?: string;
  amount: number;
  balance: number;
  currency: string;
  description?: string;
  includeInConfirm?: boolean;
}

export interface ValidationError {
  dataset: 'TB' | 'GL' | 'AP' | 'AR' | 'BANK' | 'PARTY' | 'RECONCILIATION';
  severity: 'CRITICAL' | 'ERROR' | 'WARNING' | 'INFO';
  ruleCode: string;
  ruleName: string;
  message: string;
  rowReference?: string;
  rowId?: string;
  accountCode?: string;
  expectedValue?: string;
  actualValue?: string;
  difference?: number;
}

export interface ImportResult {
  success: boolean;
  uploadVersionId: string;
  summaryRunId: string;
  counts: {
    tbRows: number;
    glEntries: number;
    apRows: number;
    arRows: number;
    bankRows: number;
    partyCount: number;
  };
  validations: {
    tbArithmeticStatus: 'PASS' | 'FAIL' | 'WARNING' | 'NOT_RUN';
    glDrCrStatus: 'PASS' | 'FAIL' | 'WARNING' | 'NOT_RUN';
    tbGlTieOutStatus: 'PASS' | 'FAIL' | 'WARNING' | 'NOT_RUN';
    overallStatus: 'PASS' | 'FAIL' | 'WARNING' | 'NOT_RUN';
  };
  exceptions: ValidationError[];
  error?: string;
}

const SHEET_NAMES = {
  PARTIES: 'Parties',
  BANK_ACCOUNTS: 'Bank',
  TB: 'Trial Balance',
  GL: 'GL',
  OPEN_ITEMS: 'Open Items',
  CHART_OF_ACCOUNTS: 'Chart_of_Accounts',
  AP_SUBLEDGER: 'AP_Subledger',
  AR_SUBLEDGER: 'AR_Subledger',
  BANK_BALANCES: 'Bank_Balances',
  CONFIRMATIONS: 'Confirmations',
} as const;

const SHEET_NAME_ALIASES: Record<string, string[]> = {
  [SHEET_NAMES.TB]: ['Trial Balance', 'Trial_Balance', 'TrialBalance', 'TB'],
  [SHEET_NAMES.GL]: ['GL', 'GL_Transactions', 'General Ledger', 'GeneralLedger'],
  [SHEET_NAMES.PARTIES]: ['Parties'],
  [SHEET_NAMES.BANK_ACCOUNTS]: ['Bank', 'Bank_Accounts', 'BankAccounts'],
  [SHEET_NAMES.OPEN_ITEMS]: ['Open Items', 'Open_Items', 'OpenItems'],
  [SHEET_NAMES.CHART_OF_ACCOUNTS]: ['Chart_of_Accounts', 'Chart of Accounts', 'ChartOfAccounts', 'COA'],
  [SHEET_NAMES.AP_SUBLEDGER]: ['AP_Subledger', 'AP Subledger', 'APSubledger', 'Accounts Payable', 'Accounts_Payable', 'AccountsPayable'],
  [SHEET_NAMES.AR_SUBLEDGER]: ['AR_Subledger', 'AR Subledger', 'ARSubledger', 'Accounts Receivable', 'Accounts_Receivable', 'AccountsReceivable'],
  [SHEET_NAMES.BANK_BALANCES]: ['Bank_Balances', 'Bank Balances', 'BankBalances'],
  [SHEET_NAMES.CONFIRMATIONS]: ['Confirmations', 'Confirmation'],
};

function findWorksheet(workbook: ExcelJS.Workbook, sheetName: string): ExcelJS.Worksheet | undefined {
  const direct = workbook.getWorksheet(sheetName);
  if (direct) return direct;
  const aliases = SHEET_NAME_ALIASES[sheetName] || [];
  for (const alias of aliases) {
    const ws = workbook.getWorksheet(alias);
    if (ws) return ws;
  }
  return undefined;
}

const REQUIRED_HEADERS = {
  PARTIES: ['Party_ID', 'Party_Type', 'Legal_Name'],
  BANK_ACCOUNTS: ['Bank_Account_ID', 'Party_ID', 'GL_Code', 'Account_Number'],
  TB: ['GL_Code', 'Opening_Balance'],
  GL: ['Posting_Date', 'Voucher_No', 'GL_Code', 'Debit', 'Credit'],
  OPEN_ITEMS: ['Population_Type', 'Party_ID', 'Document_No', 'Outstanding_Amount'],
};

function parseNumber(val: any): number {
  if (val === null || val === undefined || val === "") return 0;
  const num = typeof val === "number" ? val : parseFloat(String(val).replace(/,/g, ""));
  return isNaN(num) ? 0 : num;
}

function hasDecimalPortion(val: any): boolean {
  if (val === null || val === undefined || val === "" || val === 0) return false;
  const num = typeof val === "number" ? val : parseFloat(String(val).replace(/,/g, ""));
  if (isNaN(num)) return false;
  return num !== Math.floor(num);
}


function parseDate(val: any): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;
  const parsed = new Date(val);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function extractBaseHeader(header: string): string {
  const match = header.match(/^([^(]+)/);
  return match ? match[1].trim() : header.trim();
}

function findHeaderIndex(headers: string[], target: string): number {
  const normalizedTarget = normalizeHeader(target);
  let idx = headers.findIndex(h => normalizeHeader(h) === normalizedTarget);
  if (idx !== -1) return idx;
  
  idx = headers.findIndex(h => normalizeHeader(extractBaseHeader(h)) === normalizedTarget);
  if (idx !== -1) return idx;
  
  return headers.findIndex(h => {
    const normalizedHeader = normalizeHeader(h);
    if (normalizedHeader.includes(normalizedTarget) && normalizedTarget.length >= normalizedHeader.length * 0.6) {
      return true;
    }
    if (normalizedTarget.includes(normalizedHeader) && normalizedHeader.length >= normalizedTarget.length * 0.6) {
      return true;
    }
    return false;
  });
}

function getColumnValue(row: ExcelJS.Row, headers: string[], ...headerNames: string[]): any {
  for (const headerName of headerNames) {
    const idx = findHeaderIndex(headers, headerName);
    if (idx !== -1) {
      const cell = row.getCell(idx + 1);
      if (cell.value !== null && cell.value !== undefined) {
        return cell.value;
      }
    }
  }
  return null;
}

function parseDateFlexible(val: any): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;

  const strVal = String(val).trim();
  if (!strVal) return null;

  const isoMatch = strVal.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const d = new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]));
    if (!isNaN(d.getTime())) return d;
  }

  const slashMatch = strVal.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (slashMatch) {
    const a = parseInt(slashMatch[1]);
    const b = parseInt(slashMatch[2]);
    const year = parseInt(slashMatch[3]);

    if (a > 12 && b <= 12) {
      const d = new Date(year, b - 1, a);
      if (!isNaN(d.getTime())) return d;
    }

    const mdyDate = new Date(year, a - 1, b);
    if (!isNaN(mdyDate.getTime()) && mdyDate.getMonth() === a - 1 && mdyDate.getDate() === b) {
      return mdyDate;
    }

    const dmyDate = new Date(year, b - 1, a);
    if (!isNaN(dmyDate.getTime()) && dmyDate.getMonth() === b - 1 && dmyDate.getDate() === a) {
      return dmyDate;
    }
  }

  const parsed = new Date(val);
  return isNaN(parsed.getTime()) ? null : parsed;
}

export async function parseInputWorkbook(buffer: Buffer): Promise<{ data: ParsedSheetData; errors: ValidationError[] }> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  
  const errors: ValidationError[] = [];
  const data: ParsedSheetData = {
    parties: [],
    bankAccounts: [],
    trialBalance: [],
    generalLedger: [],
    openItems: [],
    chartOfAccounts: [],
    bankBalances: [],
    confirmations: [],
  };

  const partiesSheet = findWorksheet(workbook, SHEET_NAMES.PARTIES);
  if (partiesSheet) {
    const result = parsePartiesSheet(partiesSheet);
    data.parties = result.rows;
    errors.push(...result.errors);
  }

  const bankAccountsSheet = findWorksheet(workbook, SHEET_NAMES.BANK_ACCOUNTS);
  if (bankAccountsSheet) {
    const result = parseBankAccountsSheet(bankAccountsSheet);
    data.bankAccounts = result.rows;
    errors.push(...result.errors);
  }

  const tbSheet = findWorksheet(workbook, SHEET_NAMES.TB);
  if (tbSheet) {
    const result = parseTBSheet(tbSheet);
    data.trialBalance = result.rows;
    errors.push(...result.errors);
  } else {
    errors.push({
      dataset: 'TB',
      severity: 'CRITICAL',
      ruleCode: 'TB_SHEET_MISSING',
      ruleName: 'Trial Balance Sheet Missing',
      message: `Required sheet "${SHEET_NAMES.TB}" not found in workbook. Accepted names: ${SHEET_NAME_ALIASES[SHEET_NAMES.TB]?.join(', ')}`,
    });
  }

  const glSheet = findWorksheet(workbook, SHEET_NAMES.GL);
  if (glSheet) {
    const result = parseGLSheet(glSheet);
    data.generalLedger = result.rows;
    errors.push(...result.errors);
  }

  const openItemsSheet = findWorksheet(workbook, SHEET_NAMES.OPEN_ITEMS);
  if (openItemsSheet) {
    const result = parseOpenItemsSheet(openItemsSheet);
    data.openItems = result.rows;
    errors.push(...result.errors);
  }

  const coaSheet = findWorksheet(workbook, SHEET_NAMES.CHART_OF_ACCOUNTS);
  if (coaSheet) {
    const result = parseChartOfAccountsSheet(coaSheet);
    data.chartOfAccounts = result.rows;
    errors.push(...result.errors);
  }

  const apSheet = findWorksheet(workbook, SHEET_NAMES.AP_SUBLEDGER);
  if (apSheet) {
    const result = parseAPSubledgerSheet(apSheet);
    const existingPartyCodes = new Set(data.parties.map(p => p.partyCode));
    data.parties.push(...result.rows.filter(r => !existingPartyCodes.has(r.partyCode)));
    data.openItems.push(...result.openItems);
    errors.push(...result.errors);
  }

  const arSheet = findWorksheet(workbook, SHEET_NAMES.AR_SUBLEDGER);
  if (arSheet) {
    const result = parseARSubledgerSheet(arSheet);
    const existingPartyCodes = new Set(data.parties.map(p => p.partyCode));
    data.parties.push(...result.rows.filter(r => !existingPartyCodes.has(r.partyCode)));
    data.openItems.push(...result.openItems);
    errors.push(...result.errors);
  }

  const bankBalancesSheet = findWorksheet(workbook, SHEET_NAMES.BANK_BALANCES);
  if (bankBalancesSheet) {
    const result = parseBankBalancesSheet(bankBalancesSheet);
    data.bankBalances = result.rows;
    errors.push(...result.errors);
  }

  const confirmationsSheet = findWorksheet(workbook, SHEET_NAMES.CONFIRMATIONS);
  if (confirmationsSheet) {
    const result = parseConfirmationsSheet(confirmationsSheet);
    data.confirmations = result.rows;
    errors.push(...result.errors);
  }

  return { data, errors };
}

function parsePartiesSheet(sheet: ExcelJS.Worksheet): { rows: ParsedPartyRow[]; errors: ValidationError[] } {
  const rows: ParsedPartyRow[] = [];
  const errors: ValidationError[] = [];
  
  const headers: string[] = [];
  sheet.getRow(1).eachCell((cell, colNumber) => {
    headers[colNumber - 1] = String(cell.value || "").trim();
  });

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    
    const partyCode = String(getColumnValue(row, headers, 'Party_ID', 'Party ID', 'PartyID', 'Party Code', 'PartyCode') || '').trim();
    if (!partyCode) return;
    
    const partyTypeRaw = String(getColumnValue(row, headers, 'Party_Type', 'Party Type', 'PartyType') || 'OTHER').trim().toUpperCase();
    let partyType = partyTypeRaw;
    if (partyType === 'NONE') partyType = 'OTHER';
    
    rows.push({
      rowNo: rowNumber,
      partyCode,
      partyName: String(getColumnValue(row, headers, 'Legal_Name', 'Legal Name', 'LegalName', 'Party Name', 'PartyName', 'Name') || '').trim(),
      partyType,
      controlAccountCode: String(getColumnValue(row, headers, 'Control_Account_Code', 'Control Account Code', 'ControlAccountCode', 'GL_Code', 'GL Code', 'GLCode', 'Control Account', 'ControlAccount') || '').trim(),
      email: String(getColumnValue(row, headers, 'Email', 'E-mail', 'EmailAddress') || '').trim() || undefined,
      address: String(getColumnValue(row, headers, 'Address_Line1', 'Address Line1', 'AddressLine1', 'Address', 'AddressLine') || '').trim() || undefined,
      attentionTo: String(getColumnValue(row, headers, 'Attention To', 'AttentionTo', 'Confirmation_Method', 'ConfirmationMethod') || '').trim() || undefined,
    });
  });

  return { rows, errors };
}

function parseBankAccountsSheet(sheet: ExcelJS.Worksheet): { rows: ParsedBankAccountRow[]; errors: ValidationError[] } {
  const rows: ParsedBankAccountRow[] = [];
  const errors: ValidationError[] = [];
  
  const headers: string[] = [];
  sheet.getRow(1).eachCell((cell, colNumber) => {
    headers[colNumber - 1] = String(cell.value || "").trim();
  });

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    
    const bankAccountCode = String(getColumnValue(row, headers, 'Bank_Account_ID', 'Bank Account ID', 'BankAccountID', 'Bank Code', 'BankCode') || '').trim();
    if (!bankAccountCode) return;
    
    const glName = String(getColumnValue(row, headers, 'GL_Name', 'GL Name', 'GLName', 'Account Name') || '').trim();
    
    rows.push({
      rowNo: rowNumber,
      bankAccountCode,
      bankName: glName || String(getColumnValue(row, headers, 'Bank Name', 'BankName') || '').trim(),
      accountNo: String(getColumnValue(row, headers, 'Account_Number', 'Account Number', 'AccountNumber', 'Account No', 'AccountNo') || '').trim(),
      accountTitle: glName || String(getColumnValue(row, headers, 'Account Title', 'AccountTitle') || '').trim(),
      branchName: String(getColumnValue(row, headers, 'Branch', 'BranchName', 'Branch Name') || '').trim() || undefined,
      branchAddress: String(getColumnValue(row, headers, 'Branch Address', 'BranchAddress') || '').trim() || undefined,
      iban: String(getColumnValue(row, headers, 'IBAN') || '').trim() || undefined,
      swiftBic: String(getColumnValue(row, headers, 'SWIFT_BIC', 'SWIFT BIC', 'SWIFTBIC', 'SWIFT', 'BIC') || '').trim() || undefined,
      relationshipManager: String(getColumnValue(row, headers, 'Relationship Manager', 'RelationshipManager') || '').trim() || undefined,
      bankEmail: String(getColumnValue(row, headers, 'Confirmation_Email_or_Address', 'Confirmation Email or Address', 'ConfirmationEmailOrAddress', 'Bank Email', 'BankEmail', 'Email') || '').trim() || undefined,
      currency: String(getColumnValue(row, headers, 'Currency') || 'PKR').trim(),
      glAccountCode: String(getColumnValue(row, headers, 'GL_Code', 'GL Code', 'GLCode', 'GL Account', 'GLAccount') || '').trim() || undefined,
      partyId: String(getColumnValue(row, headers, 'Party_ID', 'Party ID', 'PartyID') || '').trim() || undefined,
    });
  });

  return { rows, errors };
}

function parseTBSheet(sheet: ExcelJS.Worksheet): { rows: ParsedTBRow[]; errors: ValidationError[] } {
  const rows: ParsedTBRow[] = [];
  const errors: ValidationError[] = [];
  
  const headers: string[] = [];
  sheet.getRow(1).eachCell((cell, colNumber) => {
    headers[colNumber - 1] = String(cell.value || "").trim();
  });

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    
    const accountCode = String(getColumnValue(row, headers, 'GL_Code', 'GL Code', 'GLCode', 'Account_Code', 'Account Code', 'AccountCode', 'Code') || '').trim();
    if (!accountCode) return;
    
    const rawOpeningBalance = getColumnValue(row, headers, 'Opening_Balance', 'Opening Balance', 'OpeningBalance', 'OB');
    const rawOpeningDebit = getColumnValue(row, headers, 'Opening_Debit', 'Opening Debit', 'OpeningDebit', 'Op Debit', 'Opening DR');
    const rawOpeningCredit = getColumnValue(row, headers, 'Opening_Credit', 'Opening Credit', 'OpeningCredit', 'Op Credit', 'Opening CR');
    const rawMovementDebit = getColumnValue(row, headers, 'Debit', 'DR', 'Movement_Debit', 'Movement Debit', 'MovementDebit', 'Period Debit', 'Period DR');
    const rawMovementCredit = getColumnValue(row, headers, 'Credit', 'CR', 'Movement_Credit', 'Movement Credit', 'MovementCredit', 'Period Credit', 'Period CR');
    const rawClosingDebit = getColumnValue(row, headers, 'Closing_Debit', 'Closing Debit', 'ClosingDebit', 'Cl Debit', 'Closing DR');
    const rawClosingCredit = getColumnValue(row, headers, 'Closing_Credit', 'Closing Credit', 'ClosingCredit', 'Cl Credit', 'Closing CR');
    const rawClosingBalance = getColumnValue(row, headers, 'Closing_Balance', 'Closing Balance', 'ClosingBalance', 'CB', 'Net_Balance', 'Net Balance');
    
    const decimalFields: string[] = [];
    if (hasDecimalPortion(rawOpeningBalance)) decimalFields.push('Opening Balance');
    if (hasDecimalPortion(rawOpeningDebit)) decimalFields.push('Opening Debit');
    if (hasDecimalPortion(rawOpeningCredit)) decimalFields.push('Opening Credit');
    if (hasDecimalPortion(rawMovementDebit)) decimalFields.push('Debit');
    if (hasDecimalPortion(rawMovementCredit)) decimalFields.push('Credit');
    if (hasDecimalPortion(rawClosingDebit)) decimalFields.push('Closing Debit');
    if (hasDecimalPortion(rawClosingCredit)) decimalFields.push('Closing Credit');
    if (hasDecimalPortion(rawClosingBalance)) decimalFields.push('Closing Balance');
    
    if (decimalFields.length > 0) {
      errors.push({
        dataset: 'TB',
        severity: 'ERROR',
        ruleCode: 'E_DECIMAL_NOT_ALLOWED',
        ruleName: 'Decimal Values Not Allowed',
        message: `Row ${rowNumber} (${accountCode}): Decimal values found in ${decimalFields.join(', ')}. Only whole numbers are allowed. Please remove decimal portions (e.g., use 100000 instead of 100000.50).`,
        rowReference: `Row ${rowNumber}`,
        accountCode,
        expectedValue: 'Whole number (integer)',
        actualValue: `Decimal value in: ${decimalFields.join(', ')}`,
      });
    }
    
    const openingBalance = parseNumber(rawOpeningBalance);
    
    let openingDebit = parseNumber(rawOpeningDebit);
    let openingCredit = parseNumber(rawOpeningCredit);
    
    if (openingDebit === 0 && openingCredit === 0 && openingBalance !== 0) {
      if (openingBalance >= 0) {
        openingDebit = openingBalance;
        openingCredit = 0;
      } else {
        openingDebit = 0;
        openingCredit = Math.abs(openingBalance);
      }
    }
    
    let movementDebit = parseNumber(rawMovementDebit);
    let movementCredit = parseNumber(rawMovementCredit);
    
    let closingDebit = parseNumber(rawClosingDebit);
    let closingCredit = parseNumber(rawClosingCredit);
    
    const closingBalance = parseNumber(rawClosingBalance);
    if (closingDebit === 0 && closingCredit === 0 && closingBalance !== 0) {
      if (closingBalance >= 0) {
        closingDebit = closingBalance;
        closingCredit = 0;
      } else {
        closingDebit = 0;
        closingCredit = Math.abs(closingBalance);
      }
    }
    
    if (closingDebit === 0 && closingCredit === 0) {
      const netOpening = openingDebit - openingCredit;
      const netMovement = movementDebit - movementCredit;
      const netClosing = netOpening + netMovement;
      
      if (netClosing >= 0) {
        closingDebit = netClosing;
        closingCredit = 0;
      } else {
        closingDebit = 0;
        closingCredit = Math.abs(netClosing);
      }
    }
    
    rows.push({
      rowNo: rowNumber,
      accountCode,
      accountName: String(getColumnValue(row, headers, 'GL_Name', 'GL Name', 'GLName', 'Account_Name', 'Account Name', 'AccountName', 'Name') || '').trim(),
      openingDebit: Math.round(openingDebit),
      openingCredit: Math.round(openingCredit),
      movementDebit: Math.round(movementDebit),
      movementCredit: Math.round(movementCredit),
      closingDebit: Math.round(closingDebit),
      closingCredit: Math.round(closingCredit),
    });
  });

  return { rows, errors };
}

function parseGLSheet(sheet: ExcelJS.Worksheet): { rows: ParsedGLRow[]; errors: ValidationError[] } {
  const rows: ParsedGLRow[] = [];
  const errors: ValidationError[] = [];
  
  const headers: string[] = [];
  sheet.getRow(1).eachCell((cell, colNumber) => {
    headers[colNumber - 1] = String(cell.value || "").trim();
  });

  let currentJournalId = '';
  let lineNoCounter = 0;

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    
    const voucherNo = String(getColumnValue(row, headers, 'Voucher_No', 'Voucher No', 'VoucherNo', 'Voucher #', 'VoucherNumber') || '').trim();
    const accountCode = String(getColumnValue(row, headers, 'GL_Code', 'GL Code', 'GLCode', 'Account_Code', 'Account Code', 'AccountCode', 'Code') || '').trim();
    
    if (!accountCode) return;
    
    const rawDebit = getColumnValue(row, headers, 'Debit', 'DR');
    const rawCredit = getColumnValue(row, headers, 'Credit', 'CR');
    
    const decimalFields: string[] = [];
    if (hasDecimalPortion(rawDebit)) decimalFields.push('Debit');
    if (hasDecimalPortion(rawCredit)) decimalFields.push('Credit');
    
    if (decimalFields.length > 0) {
      errors.push({
        dataset: 'GL',
        severity: 'ERROR',
        ruleCode: 'E_DECIMAL_NOT_ALLOWED',
        ruleName: 'Decimal Values Not Allowed',
        message: `Row ${rowNumber} (${accountCode}): Decimal values found in ${decimalFields.join(', ')}. Only whole numbers are allowed. Please remove decimal portions.`,
        rowReference: `Row ${rowNumber}`,
        accountCode,
        expectedValue: 'Whole number (integer)',
        actualValue: `Decimal value in: ${decimalFields.join(', ')}`,
      });
    }
    
    const dateVal = getColumnValue(row, headers, 'Posting_Date', 'Posting Date', 'PostingDate', 'Date', 'Voucher Date', 'VoucherDate');
    const voucherDate = parseDateFlexible(dateVal) || new Date();
    
    const dateStr = voucherDate.toISOString().split('T')[0];
    const journalId = voucherNo ? `${voucherNo}-${dateStr}` : `AUTO-${rowNumber}`;
    if (journalId !== currentJournalId) {
      currentJournalId = journalId;
      lineNoCounter = 0;
    }
    lineNoCounter++;
    
    let partyTypeRaw = String(getColumnValue(row, headers, 'Party_Type', 'Party Type', 'PartyType') || '').trim().toUpperCase();
    if (partyTypeRaw === 'NONE') partyTypeRaw = '';
    
    rows.push({
      rowNo: rowNumber,
      journalId,
      voucherNo,
      voucherDate,
      docType: String(getColumnValue(row, headers, 'Voucher_Type', 'Voucher Type', 'VoucherType', 'Doc Type', 'DocType', 'Type') || 'JV').trim(),
      lineNo: lineNoCounter,
      accountCode,
      accountName: String(getColumnValue(row, headers, 'GL_Name', 'GL Name', 'GLName', 'Account_Name', 'Account Name', 'AccountName', 'Name') || '').trim(),
      debit: Math.round(parseNumber(rawDebit)),
      credit: Math.round(parseNumber(rawCredit)),
      partyCode: String(getColumnValue(row, headers, 'Party_ID', 'Party ID', 'PartyID', 'Party Code', 'PartyCode') || '').trim() || undefined,
      partyName: String(getColumnValue(row, headers, 'Party_Name', 'Party Name', 'PartyName') || '').trim() || undefined,
      partyType: partyTypeRaw || undefined,
      partyEmail: String(getColumnValue(row, headers, 'Email', 'E-mail', 'EmailAddress') || '').trim() || undefined,
      partyAddress: String(getColumnValue(row, headers, 'Address_Line1', 'Address Line1', 'AddressLine1', 'Address') || '').trim() || undefined,
      documentNo: String(getColumnValue(row, headers, 'Document_No', 'Document No', 'DocumentNo', 'Doc No', 'DocNo', 'Ref #', 'Ref', 'Reference', 'Reference No') || '').trim() || undefined,
      documentDate: parseDateFlexible(getColumnValue(row, headers, 'Document_Date', 'Document Date', 'DocumentDate', 'Doc Date')) || undefined,
      invoiceNo: String(getColumnValue(row, headers, 'Invoice_No', 'Invoice No', 'InvoiceNo', 'Inv No') || '').trim() || undefined,
      dueDate: parseDateFlexible(getColumnValue(row, headers, 'Due_Date', 'Due Date', 'DueDate')) || undefined,
      costCenter: String(getColumnValue(row, headers, 'Cost_Center', 'Cost Center', 'CostCenter') || '').trim() || undefined,
      department: String(getColumnValue(row, headers, 'Department') || '').trim() || undefined,
      project: String(getColumnValue(row, headers, 'Project') || '').trim() || undefined,
      location: String(getColumnValue(row, headers, 'Location') || '').trim() || undefined,
      sourceModule: String(getColumnValue(row, headers, 'Source_Module', 'Source Module', 'SourceModule') || '').trim() || undefined,
      currency: String(getColumnValue(row, headers, 'Currency') || 'PKR').trim(),
      fxRate: parseNumber(getColumnValue(row, headers, 'Exchange_Rate', 'Exchange Rate', 'ExchangeRate', 'FX Rate', 'FXRate')) || 1,
      description: String(getColumnValue(row, headers, 'Description') || '').trim() || undefined,
      narration: String(getColumnValue(row, headers, 'Narration', 'Narrative') || '').trim() || undefined,
    });
  });

  return { rows, errors };
}

function parseOpenItemsSheet(sheet: ExcelJS.Worksheet): { rows: ParsedOpenItemRow[]; errors: ValidationError[] } {
  const rows: ParsedOpenItemRow[] = [];
  const errors: ValidationError[] = [];
  
  const headers: string[] = [];
  sheet.getRow(1).eachCell((cell, colNumber) => {
    headers[colNumber - 1] = String(cell.value || "").trim();
  });

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    
    const partyCode = String(getColumnValue(row, headers, 'Party_ID', 'Party ID', 'PartyID', 'Party Code', 'PartyCode') || '').trim();
    const documentNo = String(getColumnValue(row, headers, 'Document_No', 'Document No', 'DocumentNo', 'Doc No', 'DocNo') || '').trim();
    
    if (!partyCode || !documentNo) return;
    
    const documentDate = parseDateFlexible(getColumnValue(row, headers, 'Document_Date', 'Document Date', 'DocumentDate', 'Doc Date'));
    
    const populationType = String(getColumnValue(row, headers, 'Population_Type', 'Population Type', 'PopulationType') || '').trim().toUpperCase();
    let partyTypeRaw = String(getColumnValue(row, headers, 'Party_Type', 'Party Type', 'PartyType') || '').trim().toUpperCase();
    
    let partyType: string;
    if (populationType === 'DEBTORS' || populationType === 'AR' || populationType === 'RECEIVABLES') {
      partyType = 'CUSTOMER';
    } else if (populationType === 'CREDITORS' || populationType === 'AP' || populationType === 'PAYABLES') {
      partyType = 'VENDOR';
    } else if (partyTypeRaw && partyTypeRaw !== 'NONE') {
      partyType = partyTypeRaw;
    } else {
      partyType = 'VENDOR';
    }
    
    const rawOutstandingAmount = getColumnValue(row, headers, 'Outstanding_Amount', 'Outstanding Amount', 'OutstandingAmount', 'Outstanding', 'Amount', 'Balance');
    
    if (hasDecimalPortion(rawOutstandingAmount)) {
      const datasetType = partyType === 'CUSTOMER' ? 'AR' : 'AP';
      errors.push({
        dataset: datasetType,
        severity: 'ERROR',
        ruleCode: 'E_DECIMAL_NOT_ALLOWED',
        ruleName: 'Decimal Values Not Allowed',
        message: `Row ${rowNumber} (${partyCode}): Decimal value found in Outstanding Amount. Only whole numbers are allowed. Please remove decimal portions.`,
        rowReference: `Row ${rowNumber}`,
        accountCode: partyCode,
        expectedValue: 'Whole number (integer)',
        actualValue: `${parseNumber(rawOutstandingAmount)}`,
      });
    }
    
    const outstandingAmount = Math.round(parseNumber(rawOutstandingAmount));
    
    const includeRaw = String(getColumnValue(row, headers, 'Include_in_Confirm', 'Include in Confirm', 'IncludeInConfirm', 'Include') || '').trim().toUpperCase();
    const includeInConfirm = includeRaw === 'Y' || includeRaw === 'YES' || includeRaw === 'TRUE' || includeRaw === '1';
    
    rows.push({
      rowNo: rowNumber,
      partyCode,
      partyType,
      glCode: String(getColumnValue(row, headers, 'Control_Account_Code', 'Control Account Code', 'ControlAccountCode', 'GL_Code', 'GL Code', 'GLCode', 'Account Code') || '').trim() || undefined,
      glName: String(getColumnValue(row, headers, 'GL_Name', 'GL Name', 'GLName', 'Account Name') || '').trim() || undefined,
      documentNo,
      documentDate: documentDate || new Date(),
      dueDate: parseDateFlexible(getColumnValue(row, headers, 'Due_Date', 'Due Date', 'DueDate')) || undefined,
      invoiceNo: String(getColumnValue(row, headers, 'Invoice No', 'InvoiceNo', 'Inv No') || '').trim() || undefined,
      amount: outstandingAmount,
      balance: outstandingAmount,
      currency: String(getColumnValue(row, headers, 'Currency') || 'PKR').trim(),
      description: String(getColumnValue(row, headers, 'Notes', 'Description', 'Narration') || '').trim() || undefined,
      includeInConfirm,
    });
  });

  return { rows, errors };
}

function parseSubledgerSheet(
  sheet: ExcelJS.Worksheet,
  partyType: 'VENDOR' | 'CUSTOMER'
): { rows: ParsedPartyRow[]; openItems: ParsedOpenItemRow[]; errors: ValidationError[] } {
  const rows: ParsedPartyRow[] = [];
  const openItems: ParsedOpenItemRow[] = [];
  const errors: ValidationError[] = [];
  const seenParties = new Set<string>();

  const headers: string[] = [];
  sheet.getRow(1).eachCell((cell, colNumber) => {
    headers[colNumber - 1] = String(cell.value || "").trim();
  });

  const codeHeaders = partyType === 'VENDOR'
    ? ['Vendor_ID', 'Vendor ID', 'VendorID', 'Vendor_Code', 'Vendor Code', 'VendorCode', 'Party_ID', 'Party Code']
    : ['Customer_ID', 'Customer ID', 'CustomerID', 'Customer_Code', 'Customer Code', 'CustomerCode', 'Party_ID', 'Party Code'];
  const nameHeaders = partyType === 'VENDOR'
    ? ['Vendor_Name', 'Vendor Name', 'VendorName', 'Party Name', 'PartyName']
    : ['Customer_Name', 'Customer Name', 'CustomerName', 'Party Name', 'PartyName'];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const partyCode = String(getColumnValue(row, headers, ...codeHeaders) || '').trim();
    if (!partyCode) return;

    const partyName = String(getColumnValue(row, headers, ...nameHeaders) || '').trim();
    const controlAccountCode = String(getColumnValue(row, headers, 'Control_Account_Code', 'Control Account Code', 'ControlAccountCode', 'GL_Code', 'GL Code', 'GLCode', 'Control Account', 'ControlAccount') || '').trim();
    const invoiceNo = String(getColumnValue(row, headers, 'Invoice_No', 'Invoice No', 'InvoiceNo') || '').trim();
    const invoiceDate = parseDateFlexible(getColumnValue(row, headers, 'Invoice_Date', 'Invoice Date', 'InvoiceDate'));
    const dueDate = parseDateFlexible(getColumnValue(row, headers, 'Due_Date', 'Due Date', 'DueDate'));
    const amount = parseNumber(getColumnValue(row, headers, 'Amount'));
    const balance = parseNumber(getColumnValue(row, headers, 'Balance'));
    const currency = String(getColumnValue(row, headers, 'Currency') || 'PKR').trim();

    const email = String(getColumnValue(row, headers, 'Email', 'E-mail', 'EmailAddress') || '').trim() || undefined;
    const address = String(getColumnValue(row, headers, 'Address', 'Address_Line1', 'Address Line1', 'AddressLine1') || '').trim() || undefined;

    if (!seenParties.has(partyCode)) {
      seenParties.add(partyCode);
      rows.push({
        rowNo: rowNumber,
        partyCode,
        partyName,
        partyType,
        controlAccountCode,
        email,
        address,
      });
    }

    if (invoiceNo) {
      openItems.push({
        rowNo: rowNumber,
        partyCode,
        partyType,
        documentNo: invoiceNo,
        documentDate: invoiceDate || new Date(),
        dueDate: dueDate || undefined,
        invoiceNo,
        amount: Math.round(amount),
        balance: Math.round(balance || amount),
        currency,
      });
    }
  });

  return { rows, openItems, errors };
}

function parseAPSubledgerSheet(sheet: ExcelJS.Worksheet): { rows: ParsedPartyRow[]; openItems: ParsedOpenItemRow[]; errors: ValidationError[] } {
  return parseSubledgerSheet(sheet, 'VENDOR');
}

function parseARSubledgerSheet(sheet: ExcelJS.Worksheet): { rows: ParsedPartyRow[]; openItems: ParsedOpenItemRow[]; errors: ValidationError[] } {
  return parseSubledgerSheet(sheet, 'CUSTOMER');
}

function parseChartOfAccountsSheet(sheet: ExcelJS.Worksheet): { rows: ParsedCoARow[]; errors: ValidationError[] } {
  const rows: ParsedCoARow[] = [];
  const errors: ValidationError[] = [];

  const headers: string[] = [];
  sheet.getRow(1).eachCell((cell, colNumber) => {
    headers[colNumber - 1] = String(cell.value || "").trim();
  });

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const accountCode = String(getColumnValue(row, headers, 'Account_Code', 'Account Code', 'AccountCode', 'GL_Code', 'GL Code') || '').trim();
    if (!accountCode) return;

    const isControlRaw = String(getColumnValue(row, headers, 'Is_Control_Account', 'Is Control Account', 'IsControlAccount') || '').trim().toUpperCase();
    const isControlAccount = isControlRaw === 'Y' || isControlRaw === 'YES' || isControlRaw === 'TRUE' || isControlRaw === '1';

    rows.push({
      rowNo: rowNumber,
      accountCode,
      accountName: String(getColumnValue(row, headers, 'Account_Name', 'Account Name', 'AccountName', 'GL_Name', 'GL Name') || '').trim(),
      category: String(getColumnValue(row, headers, 'Category', 'Account_Class', 'Account Class') || '').trim(),
      subCategory: String(getColumnValue(row, headers, 'Sub_Category', 'Sub Category', 'SubCategory', 'Account_Subclass') || '').trim(),
      fsLineItem: String(getColumnValue(row, headers, 'FS_Line_Item', 'FS Line Item', 'FSLineItem') || '').trim(),
      isControlAccount,
      normalBalance: String(getColumnValue(row, headers, 'Normal_Balance', 'Normal Balance', 'NormalBalance', 'Nature') || 'DR').trim(),
      status: String(getColumnValue(row, headers, 'Status') || 'Active').trim(),
    });
  });

  return { rows, errors };
}

function parseBankBalancesSheet(sheet: ExcelJS.Worksheet): { rows: ParsedBankBalanceRow[]; errors: ValidationError[] } {
  const rows: ParsedBankBalanceRow[] = [];
  const errors: ValidationError[] = [];

  const headers: string[] = [];
  sheet.getRow(1).eachCell((cell, colNumber) => {
    headers[colNumber - 1] = String(cell.value || "").trim();
  });

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const bankCode = String(getColumnValue(row, headers, 'Bank_Code', 'Bank Code', 'BankCode', 'Bank_Account_ID', 'Bank Account ID') || '').trim();
    if (!bankCode) return;

    rows.push({
      rowNo: rowNumber,
      bankCode,
      bankName: String(getColumnValue(row, headers, 'Bank_Name', 'Bank Name', 'BankName') || '').trim(),
      closingBalance: parseNumber(getColumnValue(row, headers, 'Closing_Balance', 'Closing Balance', 'ClosingBalance', 'Balance')),
      currency: String(getColumnValue(row, headers, 'Currency') || 'PKR').trim(),
      lastReconciled: parseDateFlexible(getColumnValue(row, headers, 'Last_Reconciled', 'Last Reconciled', 'LastReconciled')),
    });
  });

  return { rows, errors };
}

function parseConfirmationsSheet(sheet: ExcelJS.Worksheet): { rows: ParsedConfirmationRow[]; errors: ValidationError[] } {
  const rows: ParsedConfirmationRow[] = [];
  const errors: ValidationError[] = [];

  const headers: string[] = [];
  sheet.getRow(1).eachCell((cell, colNumber) => {
    headers[colNumber - 1] = String(cell.value || "").trim();
  });

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const confirmationId = String(getColumnValue(row, headers, 'Confirmation_ID', 'Confirmation ID', 'ConfirmationID') || '').trim();
    if (!confirmationId) return;

    rows.push({
      rowNo: rowNumber,
      confirmationId,
      partyType: String(getColumnValue(row, headers, 'Party_Type', 'Party Type', 'PartyType') || '').trim().toUpperCase(),
      partyCode: String(getColumnValue(row, headers, 'Party_Code', 'Party Code', 'PartyCode') || '').trim(),
      partyName: String(getColumnValue(row, headers, 'Party_Name', 'Party Name', 'PartyName') || '').trim(),
      balance: parseNumber(getColumnValue(row, headers, 'Balance')),
      sentDate: parseDateFlexible(getColumnValue(row, headers, 'Sent_Date', 'Sent Date', 'SentDate')),
      responseStatus: String(getColumnValue(row, headers, 'Response_Status', 'Response Status', 'ResponseStatus') || '').trim(),
    });
  });

  return { rows, errors };
}

export async function importInputWorkbook(
  engagementId: string,
  userId: string,
  fileName: string,
  buffer: Buffer
): Promise<ImportResult> {
  const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');
  
  const { data, errors: parseErrors } = await parseInputWorkbook(buffer);
  
  if (parseErrors.some(e => e.severity === 'CRITICAL')) {
    return {
      success: false,
      uploadVersionId: '',
      summaryRunId: '',
      counts: { tbRows: 0, glEntries: 0, apRows: 0, arRows: 0, bankRows: 0, partyCount: 0 },
      validations: {
        tbArithmeticStatus: 'NOT_RUN',
        glDrCrStatus: 'NOT_RUN',
        tbGlTieOutStatus: 'NOT_RUN',
        overallStatus: 'FAIL',
      },
      exceptions: parseErrors,
      error: 'Critical parsing errors found',
    };
  }

  const result = await prisma.$transaction(async (tx) => {
    await tx.uploadVersion.updateMany({
      where: { engagementId, status: 'ACTIVE' },
      data: { status: 'SUPERSEDED', supersededAt: new Date(), supersededById: userId },
    });

    const lastVersion = await tx.uploadVersion.findFirst({
      where: { engagementId },
      orderBy: { version: 'desc' },
    });

    const uploadVersion = await tx.uploadVersion.create({
      data: {
        engagementId,
        version: (lastVersion?.version || 0) + 1,
        fileName,
        fileHash,
        fileSize: buffer.length,
        status: 'ACTIVE',
        uploadedById: userId,
      },
    });

    const engagement = await tx.engagement.findUnique({
      where: { id: engagementId },
      select: { periodStart: true, periodEnd: true },
    });

    const periodEnd = engagement?.periodEnd || new Date();
    const periodStart = engagement?.periodStart || new Date(periodEnd.getFullYear() - 1, periodEnd.getMonth(), periodEnd.getDate());

    let batch = await tx.importBatch.findFirst({
      where: { engagementId },
      orderBy: { createdAt: 'desc' },
    });

    if (!batch) {
      batch = await tx.importBatch.create({
        data: {
          engagementId,
          batchNumber: `BATCH-${Date.now()}`,
          uploadedById: userId,
          fileName,
          fileSize: buffer.length,
          status: 'APPROVED',
        },
      });
    }

    await tx.importPartyBalance.deleteMany({ where: { engagementId } });
    await tx.importBankBalance.deleteMany({ where: { engagementId } });
    await tx.importBankAccount.deleteMany({ where: { engagementId } });
    await tx.importAccountBalance.deleteMany({ where: { engagementId } });
    await tx.importJournalLine.deleteMany({
      where: { journalHeader: { engagementId } },
    });
    await tx.importJournalHeader.deleteMany({ where: { engagementId } });

    if (data.parties.length > 0) {
      for (const party of data.parties) {
        const balanceType = 'CB';
        const existingParty = await tx.importPartyBalance.findUnique({
          where: { engagementId_partyCode_balanceType: { engagementId, partyCode: party.partyCode, balanceType } },
        });
        
        if (!existingParty) {
          await tx.importPartyBalance.create({
            data: {
              batchId: batch.id,
              engagementId,
              partyCode: party.partyCode,
              partyName: party.partyName,
              partyType: party.partyType,
              controlAccountCode: party.controlAccountCode,
              balanceType,
              asOfDate: periodEnd,
              balance: 0,
              drcr: 'DR',
              partyEmail: party.email,
              partyAddress: party.address,
              attentionTo: party.attentionTo,
            },
          });
        }
      }
    }

    if (data.bankAccounts.length > 0) {
      for (const bank of data.bankAccounts) {
        await tx.importBankAccount.create({
          data: {
            batchId: batch.id,
            engagementId,
            bankAccountCode: bank.bankAccountCode,
            bankName: bank.bankName,
            accountNo: bank.accountNo,
            accountTitle: bank.accountTitle,
            branchName: bank.branchName,
            branchAddress: bank.branchAddress,
            iban: bank.iban,
            relationshipManager: bank.relationshipManager,
            bankEmail: bank.bankEmail,
            currency: bank.currency,
          },
        });
        
        if (bank.glAccountCode) {
          await tx.importBankBalance.create({
            data: {
              batchId: batch.id,
              engagementId,
              bankAccountCode: bank.bankAccountCode,
              glBankAccountCode: bank.glAccountCode,
              closingBalance: 0,
              drcr: 'DR',
              asOfDate: new Date(),
            },
          });
        }
      }
    }

    if (data.trialBalance.length > 0) {
      for (const tb of data.trialBalance) {
        const classification = classifyAccount(tb.accountCode, tb.accountName);
        
        const existingOB = await tx.importAccountBalance.findUnique({
          where: { engagementId_accountCode_balanceType: { engagementId, accountCode: tb.accountCode, balanceType: 'OB' } },
        });
        
        if (!existingOB) {
          await tx.importAccountBalance.create({
            data: {
              batchId: batch.id,
              engagementId,
              accountCode: tb.accountCode,
              accountName: tb.accountName,
              balanceType: 'OB',
              asOfDate: periodStart,
              debitAmount: tb.openingDebit,
              creditAmount: tb.openingCredit,
              accountClass: classification?.accountClass || null,
              accountSubclass: classification?.accountSubclass || null,
              fsHeadKey: classification?.fsHeadKey || null,
              classificationSource: classification ? 'RULE' : null,
              classificationConfidence: classification?.confidence ? classification.confidence : null,
            },
          });
        }
        
        const existingCB = await tx.importAccountBalance.findUnique({
          where: { engagementId_accountCode_balanceType: { engagementId, accountCode: tb.accountCode, balanceType: 'CB' } },
        });
        
        if (!existingCB) {
          await tx.importAccountBalance.create({
            data: {
              batchId: batch.id,
              engagementId,
              accountCode: tb.accountCode,
              accountName: tb.accountName,
              balanceType: 'CB',
              asOfDate: periodEnd,
              debitAmount: tb.closingDebit,
              creditAmount: tb.closingCredit,
              accountClass: classification?.accountClass || null,
              accountSubclass: classification?.accountSubclass || null,
              fsHeadKey: classification?.fsHeadKey || null,
              classificationSource: classification ? 'RULE' : null,
              classificationConfidence: classification?.confidence ? classification.confidence : null,
            },
          });
        }
      }
    }

    if (data.generalLedger.length > 0) {
      const journalGroups = new Map<string, ParsedGLRow[]>();
      for (const gl of data.generalLedger) {
        if (!journalGroups.has(gl.journalId)) {
          journalGroups.set(gl.journalId, []);
        }
        journalGroups.get(gl.journalId)!.push(gl);
      }

      for (const [journalId, lines] of journalGroups) {
        const firstLine = lines[0];
        const totalDebit = lines.reduce((sum, l) => sum + l.debit, 0);
        const totalCredit = lines.reduce((sum, l) => sum + l.credit, 0);
        
        const year = firstLine.voucherDate.getFullYear();
        const month = firstLine.voucherDate.getMonth() + 1;
        const periodKey = `${year}-${String(month).padStart(2, '0')}`;
        
        const journalHeader = await tx.importJournalHeader.create({
          data: {
            batchId: batch.id,
            engagementId,
            journalId,
            voucherNo: firstLine.voucherNo,
            voucherDate: firstLine.voucherDate,
            voucherType: firstLine.docType,
            periodKey,
            sourceModule: 'IMPORT',
            narration: firstLine.narration,
            lineCount: lines.length,
            totalDebit,
            totalCredit,
          },
        });

        for (const line of lines) {
          await tx.importJournalLine.create({
            data: {
              journalHeaderId: journalHeader.id,
              lineNo: line.lineNo,
              accountCode: line.accountCode,
              accountName: line.accountName,
              debit: line.debit,
              credit: line.credit,
              partyCode: line.partyCode,
              partyName: line.partyName,
              partyType: line.partyType,
              documentNo: line.documentNo,
              invoiceNo: line.invoiceNo,
              dueDate: line.dueDate,
              costCenter: line.costCenter,
              department: line.department,
              project: line.project,
              location: line.location,
              currency: line.currency,
              fxRate: line.fxRate,
              description: line.description,
              narration: line.narration,
            },
          });
        }
      }
    }

    if (data.chartOfAccounts && data.chartOfAccounts.length > 0) {
      for (const coa of data.chartOfAccounts) {
        await tx.coAAccount.upsert({
          where: { engagementId_accountCode: { engagementId, accountCode: coa.accountCode } },
          update: {
            accountName: coa.accountName,
            accountClass: coa.category || null,
            accountSubclass: coa.subCategory || null,
            fsLineItem: coa.fsLineItem || null,
            nature: coa.normalBalance === 'CR' ? 'CR' : 'DR',
          },
          create: {
            engagementId,
            accountCode: coa.accountCode,
            accountName: coa.accountName,
            accountClass: coa.category || null,
            accountSubclass: coa.subCategory || null,
            fsLineItem: coa.fsLineItem || null,
            nature: coa.normalBalance === 'CR' ? 'CR' : 'DR',
          },
        });
      }
    }

    if (data.bankBalances && data.bankBalances.length > 0) {
      for (const bb of data.bankBalances) {
        const existingBankAccount = await tx.importBankAccount.findFirst({
          where: { engagementId, bankAccountCode: bb.bankCode },
        });
        if (existingBankAccount) {
          await tx.importBankBalance.upsert({
            where: { engagementId_bankAccountCode_asOfDate: { engagementId, bankAccountCode: bb.bankCode, asOfDate: periodEnd } },
            update: {
              closingBalance: bb.closingBalance,
              drcr: bb.closingBalance >= 0 ? 'DR' : 'CR',
            },
            create: {
              batchId: batch.id,
              engagementId,
              bankAccountCode: bb.bankCode,
              glBankAccountCode: existingBankAccount.bankAccountCode,
              closingBalance: Math.abs(bb.closingBalance),
              drcr: bb.closingBalance >= 0 ? 'DR' : 'CR',
              asOfDate: periodEnd,
            },
          });
        }
      }
    }

    const apRows = data.openItems.filter(oi => oi.partyType === 'VENDOR' || oi.partyType === 'AP');
    const arRows = data.openItems.filter(oi => oi.partyType === 'CUSTOMER' || oi.partyType === 'AR');

    if (data.openItems.length > 0) {
      const partyTotals = new Map<string, { total: number; controlCode: string; partyType: string }>();
      for (const oi of data.openItems) {
        const key = oi.partyCode;
        const existing = partyTotals.get(key);
        const controlCode = oi.glCode || '';
        const partyType = (oi.partyType === 'AP' || oi.partyType === 'VENDOR') ? 'VENDOR' : 'CUSTOMER';
        if (existing) {
          existing.total += Math.abs(oi.amount || oi.balance || 0);
          if (!existing.controlCode && controlCode) existing.controlCode = controlCode;
        } else {
          partyTotals.set(key, { total: Math.abs(oi.amount || oi.balance || 0), controlCode, partyType });
        }
      }

      for (const [partyCode, info] of partyTotals) {
        const existingParty = await tx.importPartyBalance.findFirst({
          where: { engagementId, partyCode, balanceType: 'CB' },
        });
        if (existingParty) {
          const updateData: any = {};
          if (existingParty.balance === null || Number(existingParty.balance) === 0) {
            updateData.balance = info.total;
          }
          if (info.controlCode && !existingParty.controlAccountCode) {
            updateData.controlAccountCode = info.controlCode;
          }
          if (Object.keys(updateData).length > 0) {
            await tx.importPartyBalance.update({
              where: { id: existingParty.id },
              data: updateData,
            });
          }
        } else {
          await tx.importPartyBalance.create({
            data: {
              batchId: batch.id,
              engagementId,
              partyCode,
              partyName: partyCode,
              partyType: info.partyType,
              controlAccountCode: info.controlCode,
              balanceType: 'CB',
              asOfDate: periodEnd,
              balance: info.total,
              drcr: info.partyType === 'VENDOR' ? 'CR' : 'DR',
            },
          });
        }
      }
    }

    return {
      uploadVersion,
      batch,
      counts: {
        tbRows: data.trialBalance.length,
        glEntries: data.generalLedger.length,
        apRows: apRows.length,
        arRows: arRows.length,
        bankRows: data.bankAccounts.length,
        partyCount: data.parties.length,
      },
    };
  }, {
    maxWait: 60000, // 60 seconds max wait to acquire connection
    timeout: 300000, // 5 minutes for large file processing
  });

  const summaryResult = await runValidationsAndStoreSummary(
    engagementId,
    result.uploadVersion.id,
    userId,
    data,
    parseErrors
  );

  try {
    const { syncImportDataToCore } = await import("./importSyncService");
    await syncImportDataToCore(engagementId, userId);
  } catch (syncError) {
    console.error("Import sync to core tables failed (non-blocking):", syncError);
  }

  return {
    success: true,
    uploadVersionId: result.uploadVersion.id,
    summaryRunId: summaryResult.id,
    counts: result.counts,
    validations: {
      tbArithmeticStatus: summaryResult.tbArithmeticStatus as any,
      glDrCrStatus: summaryResult.glDrCrStatus as any,
      tbGlTieOutStatus: summaryResult.tbGlTieOutStatus as any,
      overallStatus: summaryResult.overallStatus as any,
    },
    exceptions: parseErrors,
  };
}

async function runValidationsAndStoreSummary(
  engagementId: string,
  uploadVersionId: string,
  userId: string,
  data: ParsedSheetData,
  existingErrors: ValidationError[]
): Promise<any> {
  const exceptions: ValidationError[] = [...existingErrors];

  let tbOpeningDebitTotal = 0;
  let tbOpeningCreditTotal = 0;
  let tbClosingDebitTotal = 0;
  let tbClosingCreditTotal = 0;
  let tbMovementDebitTotal = 0;
  let tbMovementCreditTotal = 0;

  for (const tb of data.trialBalance) {
    tbOpeningDebitTotal += tb.openingDebit;
    tbOpeningCreditTotal += tb.openingCredit;
    tbClosingDebitTotal += tb.closingDebit;
    tbClosingCreditTotal += tb.closingCredit;
    tbMovementDebitTotal += tb.movementDebit;
    tbMovementCreditTotal += tb.movementCredit;
    
    const expectedClosingDebit = tb.openingDebit + tb.movementDebit;
    const expectedClosingCredit = tb.openingCredit + tb.movementCredit;
    const netExpected = expectedClosingDebit - expectedClosingCredit;
    const netActual = tb.closingDebit - tb.closingCredit;
    
    if (Math.abs(netExpected - netActual) > 0.01) {
      exceptions.push({
        dataset: 'TB',
        severity: 'ERROR',
        ruleCode: 'TB_ARITHMETIC_MISMATCH',
        ruleName: 'TB Arithmetic Check',
        message: `Opening + Movement ≠ Closing for account ${tb.accountCode}`,
        rowReference: `Row ${tb.rowNo}`,
        accountCode: tb.accountCode,
        expectedValue: netExpected.toFixed(2),
        actualValue: netActual.toFixed(2),
        difference: Math.abs(netExpected - netActual),
      });
    }
  }

  const tbArithmeticStatus = data.trialBalance.length === 0 ? 'NOT_RUN' :
    Math.abs(tbOpeningDebitTotal - tbOpeningCreditTotal) < 0.01 &&
    Math.abs(tbClosingDebitTotal - tbClosingCreditTotal) < 0.01 ? 'PASS' : 'FAIL';

  if (tbArithmeticStatus === 'FAIL') {
    exceptions.push({
      dataset: 'TB',
      severity: 'CRITICAL',
      ruleCode: 'TB_BALANCE_MISMATCH',
      ruleName: 'TB Balance Check',
      message: `Trial Balance is not balanced. Opening DR-CR: ${(tbOpeningDebitTotal - tbOpeningCreditTotal).toFixed(2)}, Closing DR-CR: ${(tbClosingDebitTotal - tbClosingCreditTotal).toFixed(2)}`,
      expectedValue: '0.00',
      actualValue: (tbClosingDebitTotal - tbClosingCreditTotal).toFixed(2),
      difference: Math.abs(tbClosingDebitTotal - tbClosingCreditTotal),
    });
  }

  let glDebitTotal = 0;
  let glCreditTotal = 0;
  for (const gl of data.generalLedger) {
    glDebitTotal += gl.debit;
    glCreditTotal += gl.credit;
  }

  const glDrCrStatus = data.generalLedger.length === 0 ? 'NOT_RUN' :
    Math.abs(glDebitTotal - glCreditTotal) < 0.01 ? 'PASS' : 'FAIL';

  if (glDrCrStatus === 'FAIL') {
    exceptions.push({
      dataset: 'GL',
      severity: 'CRITICAL',
      ruleCode: 'GL_DRCR_MISMATCH',
      ruleName: 'GL DR=CR Check',
      message: `General Ledger debits do not equal credits. Difference: ${Math.abs(glDebitTotal - glCreditTotal).toFixed(2)}`,
      expectedValue: glDebitTotal.toFixed(2),
      actualValue: glCreditTotal.toFixed(2),
      difference: Math.abs(glDebitTotal - glCreditTotal),
    });
  }

  const tbNetMovement = tbMovementDebitTotal - tbMovementCreditTotal;
  const glNetMovement = glDebitTotal - glCreditTotal;
  const tbGlDifference = Math.abs(tbNetMovement - glNetMovement);
  
  let tbGlTieOutStatus: 'PASS' | 'FAIL' | 'WARNING' | 'NOT_RUN' = 'NOT_RUN';
  if (data.trialBalance.length > 0 && data.generalLedger.length > 0) {
    tbGlTieOutStatus = tbGlDifference < 0.01 ? 'PASS' : 'FAIL';
    
    if (tbGlTieOutStatus === 'FAIL') {
      exceptions.push({
        dataset: 'RECONCILIATION',
        severity: 'ERROR',
        ruleCode: 'TB_GL_TIEOUT_MISMATCH',
        ruleName: 'TB-GL Movement Tie-out',
        message: `TB movement does not match GL movement. TB: ${tbNetMovement.toFixed(2)}, GL: ${glNetMovement.toFixed(2)}`,
        expectedValue: tbNetMovement.toFixed(2),
        actualValue: glNetMovement.toFixed(2),
        difference: tbGlDifference,
      });
    }
  }

  // TB↔GL Total DR/CR Match validation (ISA completeness check)
  const roundingTolerance = 1; // Default tolerance
  const tbTotalDebit = tbOpeningDebitTotal + tbMovementDebitTotal;
  const tbTotalCredit = tbOpeningCreditTotal + tbMovementCreditTotal;
  const deltaDR = tbTotalDebit - glDebitTotal;
  const deltaCR = tbTotalCredit - glCreditTotal;
  
  let tbGlTotalsStatus: 'PASS' | 'FAIL' | 'WARNING' | 'NOT_RUN' = 'NOT_RUN';
  if (data.trialBalance.length > 0 && data.generalLedger.length > 0) {
    tbGlTotalsStatus = (Math.abs(deltaDR) <= roundingTolerance && Math.abs(deltaCR) <= roundingTolerance) ? 'PASS' : 'FAIL';
    
    if (tbGlTotalsStatus === 'FAIL') {
      exceptions.push({
        dataset: 'RECONCILIATION',
        severity: 'CRITICAL',
        ruleCode: 'TB_GL_TOTALS_MATCH',
        ruleName: 'TB↔GL Total DR/CR Match',
        message: `TB Total DR/CR does not match GL Total DR/CR (Extraction/Completeness risk). ΔDR: ${deltaDR.toFixed(2)}, ΔCR: ${deltaCR.toFixed(2)}`,
        rowReference: 'CONTROL_TOTALS',
        expectedValue: `TB_DR: ${tbTotalDebit.toFixed(2)}, TB_CR: ${tbTotalCredit.toFixed(2)}`,
        actualValue: `GL_DR: ${glDebitTotal.toFixed(2)}, GL_CR: ${glCreditTotal.toFixed(2)}`,
        difference: Math.max(Math.abs(deltaDR), Math.abs(deltaCR)),
      });
    }
  }

  // GL_CODE validation against COA (skip if COA is empty - allows standalone template testing)
  const coaCodes = await validateGLCodesExist(engagementId, []);
  const hasCoa = coaCodes.size > 0;
  
  // Validate TB GL_CODEs against COA (only if COA exists)
  const tbMissingCodes = new Set<string>();
  for (const row of data.trialBalance) {
    const code = row.accountCode?.trim();
    if (!code) {
      exceptions.push({
        dataset: 'TB',
        severity: 'ERROR',
        ruleCode: 'E_GL_CODE_MISSING',
        ruleName: 'GL Code Required',
        message: 'GL_CODE missing (required)',
        rowReference: `Row ${row.rowNo}`,
        accountCode: row.accountCode,
      });
    } else if (hasCoa && !coaCodes.has(code) && !tbMissingCodes.has(code)) {
      tbMissingCodes.add(code);
      exceptions.push({
        dataset: 'TB',
        severity: 'ERROR',
        ruleCode: 'E_GL_CODE_NOT_IN_COA',
        ruleName: 'GL Code Not In COA',
        message: `GL_CODE not found in COA: ${code}`,
        rowReference: `Row ${row.rowNo}`,
        accountCode: code,
      });
    }
  }

  // Validate GL entry GL_CODEs against COA (only if COA exists)
  const glMissingCodes = new Set<string>();
  for (const row of data.generalLedger) {
    const code = row.accountCode?.trim();
    if (!code) {
      exceptions.push({
        dataset: 'GL',
        severity: 'ERROR',
        ruleCode: 'E_GL_CODE_MISSING',
        ruleName: 'GL Code Required',
        message: 'GL_CODE missing (required)',
        rowReference: `Row ${row.rowNo}`,
        accountCode: row.accountCode,
      });
    } else if (hasCoa && !coaCodes.has(code) && !glMissingCodes.has(code)) {
      glMissingCodes.add(code);
      exceptions.push({
        dataset: 'GL',
        severity: 'ERROR',
        ruleCode: 'E_GL_CODE_NOT_IN_COA',
        ruleName: 'GL Code Not In COA',
        message: `GL_CODE not found in COA: ${code}`,
        rowReference: `Row ${row.rowNo}`,
        accountCode: code,
      });
    }
  }

  // Validate Open Items (AR/AP) GL_CODEs against COA (only if COA exists)
  for (const row of data.openItems) {
    const isAR = row.partyType === 'CUSTOMER' || row.partyType === 'AR';
    const isAP = row.partyType === 'VENDOR' || row.partyType === 'AP';
    const controlCode = row.glCode?.trim();
    
    if (isAR) {
      if (!controlCode) {
        exceptions.push({
          dataset: 'AR',
          severity: 'ERROR',
          ruleCode: 'E_CONTROL_GL_MISSING',
          ruleName: 'Control GL Code Missing',
          message: 'AR control GL_CODE missing',
          rowReference: `Row ${row.rowNo}`,
          accountCode: controlCode || undefined,
        });
      } else if (hasCoa && !coaCodes.has(controlCode)) {
        exceptions.push({
          dataset: 'AR',
          severity: 'ERROR',
          ruleCode: 'E_CONTROL_GL_MISSING',
          ruleName: 'Control GL Code Missing',
          message: 'AR control GL_CODE not in COA',
          rowReference: `Row ${row.rowNo}`,
          accountCode: controlCode,
        });
      }
    } else if (isAP) {
      if (!controlCode) {
        exceptions.push({
          dataset: 'AP',
          severity: 'ERROR',
          ruleCode: 'E_CONTROL_GL_MISSING',
          ruleName: 'Control GL Code Missing',
          message: 'AP control GL_CODE missing',
          rowReference: `Row ${row.rowNo}`,
          accountCode: controlCode || undefined,
        });
      } else if (hasCoa && !coaCodes.has(controlCode)) {
        exceptions.push({
          dataset: 'AP',
          severity: 'ERROR',
          ruleCode: 'E_CONTROL_GL_MISSING',
          ruleName: 'Control GL Code Missing',
          message: 'AP control GL_CODE not in COA',
          rowReference: `Row ${row.rowNo}`,
          accountCode: controlCode,
        });
      }
    }
  }

  // Validate Bank Account GL_CODEs against COA (only if COA exists)
  for (const row of data.bankAccounts) {
    const glCode = row.glAccountCode?.trim();
    if (!glCode) {
      exceptions.push({
        dataset: 'BANK',
        severity: 'ERROR',
        ruleCode: 'E_BANK_GL_MISSING',
        ruleName: 'Bank GL Code Missing',
        message: 'Bank account GL_CODE missing',
        rowReference: `Row ${row.rowNo}`,
        accountCode: glCode || undefined,
      });
    } else if (hasCoa && !coaCodes.has(glCode)) {
      exceptions.push({
        dataset: 'BANK',
        severity: 'ERROR',
        ruleCode: 'E_BANK_GL_MISSING',
        ruleName: 'Bank GL Code Missing',
        message: 'Bank account GL_CODE not in COA',
        rowReference: `Row ${row.rowNo}`,
        accountCode: glCode,
      });
    }
  }

  // Validate Party control account codes against COA
  for (const row of data.parties) {
    const controlCode = row.controlAccountCode?.trim();
    const isAR = row.partyType === 'CUSTOMER';
    const isAP = row.partyType === 'VENDOR';
    
    if (isAR && (!controlCode || !coaCodes.has(controlCode))) {
      exceptions.push({
        dataset: 'AR',
        severity: 'ERROR',
        ruleCode: 'E_CONTROL_GL_MISSING',
        ruleName: 'Control GL Code Missing',
        message: 'AR control GL_CODE missing/invalid',
        rowReference: `Row ${row.rowNo}`,
        accountCode: controlCode || undefined,
      });
    } else if (isAP && (!controlCode || !coaCodes.has(controlCode))) {
      exceptions.push({
        dataset: 'AP',
        severity: 'ERROR',
        ruleCode: 'E_CONTROL_GL_MISSING',
        ruleName: 'Control GL Code Missing',
        message: 'AP control GL_CODE missing/invalid',
        rowReference: `Row ${row.rowNo}`,
        accountCode: controlCode || undefined,
      });
    }
  }

  const criticalCount = exceptions.filter(e => e.severity === 'CRITICAL').length;
  const overallStatus = criticalCount > 0 ? 'FAIL' :
    exceptions.filter(e => e.severity === 'ERROR').length > 0 ? 'WARNING' :
    data.trialBalance.length > 0 ? 'PASS' : 'NOT_RUN';

  const apRows = data.openItems.filter(oi => oi.partyType === 'VENDOR' || oi.partyType === 'AP');
  const arRows = data.openItems.filter(oi => oi.partyType === 'CUSTOMER' || oi.partyType === 'AR');

  const lastRun = await prisma.summaryRun.findFirst({
    where: { uploadVersionId },
    orderBy: { runNumber: 'desc' },
  });

  const summaryRun = await prisma.summaryRun.create({
    data: {
      engagementId,
      uploadVersionId,
      runNumber: (lastRun?.runNumber || 0) + 1,
      tbRowCount: data.trialBalance.length,
      glEntryCount: data.generalLedger.length,
      apRowCount: apRows.length,
      arRowCount: arRows.length,
      bankRowCount: data.bankAccounts.length,
      partyCount: data.parties.length,
      tbOpeningDebitTotal,
      tbOpeningCreditTotal,
      tbClosingDebitTotal,
      tbClosingCreditTotal,
      tbMovementDebitTotal,
      tbMovementCreditTotal,
      glDebitTotal,
      glCreditTotal,
      tbArithmeticStatus,
      tbArithmeticMessage: tbArithmeticStatus === 'FAIL' ? 'TB is not balanced' : tbArithmeticStatus === 'PASS' ? 'TB is balanced' : null,
      glDrCrStatus,
      glDrCrMessage: glDrCrStatus === 'FAIL' ? 'GL DR≠CR' : glDrCrStatus === 'PASS' ? 'GL DR=CR' : null,
      tbGlTieOutStatus,
      tbGlTieOutMessage: tbGlTieOutStatus === 'FAIL' ? `Difference: ${tbGlDifference.toFixed(2)}` : tbGlTieOutStatus === 'PASS' ? 'TB-GL matched' : null,
      tbGlMovementDiff: tbGlDifference,
      tbGlTotalsStatus,
      tbGlTotalsMessage: tbGlTotalsStatus === 'FAIL' 
        ? `ΔDR: ${deltaDR.toFixed(2)}, ΔCR: ${deltaCR.toFixed(2)}` 
        : tbGlTotalsStatus === 'PASS' ? 'TB↔GL totals matched' : null,
      tbTotalDebit,
      tbTotalCredit,
      deltaDR,
      deltaCR,
      roundingTolerance,
      overallStatus,
      exceptionCount: exceptions.length,
      criticalExceptionCount: criticalCount,
      createdById: userId,
    },
  });

  if (exceptions.length > 0) {
    await prisma.validationException.createMany({
      data: exceptions.map(e => ({
        summaryRunId: summaryRun.id,
        dataset: e.dataset,
        severity: e.severity,
        ruleCode: e.ruleCode,
        ruleName: e.ruleName,
        message: e.message,
        rowReference: e.rowReference,
        rowId: e.rowId,
        accountCode: e.accountCode,
        expectedValue: e.expectedValue,
        actualValue: e.actualValue,
        difference: e.difference,
      })),
    });
  }

  return summaryRun;
}

export async function rerunValidations(
  engagementId: string,
  userId: string
): Promise<ImportResult> {
  const activeVersion = await prisma.uploadVersion.findFirst({
    where: { engagementId, status: 'ACTIVE' },
  });

  if (!activeVersion) {
    return {
      success: false,
      uploadVersionId: '',
      summaryRunId: '',
      counts: { tbRows: 0, glEntries: 0, apRows: 0, arRows: 0, bankRows: 0, partyCount: 0 },
      validations: {
        tbArithmeticStatus: 'NOT_RUN',
        glDrCrStatus: 'NOT_RUN',
        tbGlTieOutStatus: 'NOT_RUN',
        overallStatus: 'NOT_RUN',
      },
      exceptions: [],
      error: 'No active upload version found',
    };
  }

  const tbData = await prisma.importAccountBalance.findMany({
    where: { engagementId },
  });

  const obBalances = new Map<string, { debit: number; credit: number; name: string }>();
  const cbBalances = new Map<string, { debit: number; credit: number; name: string }>();
  
  for (const tb of tbData) {
    if (tb.balanceType === 'OB') {
      obBalances.set(tb.accountCode, {
        debit: Number(tb.debitAmount),
        credit: Number(tb.creditAmount),
        name: tb.accountName || '',
      });
    } else {
      cbBalances.set(tb.accountCode, {
        debit: Number(tb.debitAmount),
        credit: Number(tb.creditAmount),
        name: tb.accountName || '',
      });
    }
  }

  // First, fetch GL data to calculate accurate movement values from actual journal entries
  const glData = await prisma.importJournalLine.findMany({
    where: { journalHeader: { engagementId } },
    include: { journalHeader: true },
  });

  // Calculate GROSS movement per account from GL entries
  const glMovementByAccount = new Map<string, { debit: number; credit: number }>();
  for (const gl of glData) {
    const code = gl.accountCode;
    if (!glMovementByAccount.has(code)) {
      glMovementByAccount.set(code, { debit: 0, credit: 0 });
    }
    const movement = glMovementByAccount.get(code)!;
    movement.debit += Number(gl.debit) || 0;
    movement.credit += Number(gl.credit) || 0;
  }

  const trialBalance: ParsedTBRow[] = [];
  const allCodes = new Set([...obBalances.keys(), ...cbBalances.keys()]);
  let rowNo = 2;
  for (const code of allCodes) {
    const ob = obBalances.get(code) || { debit: 0, credit: 0, name: '' };
    const cb = cbBalances.get(code) || { debit: 0, credit: 0, name: '' };
    
    // Use GL movement if available (most accurate for TB↔GL reconciliation)
    // Otherwise, derive from OB/CB (less accurate but valid for arithmetic checks)
    const glMovement = glMovementByAccount.get(code);
    let movementDebit = 0;
    let movementCredit = 0;
    
    if (glMovement) {
      // Use actual movement from GL entries (GROSS movement)
      movementDebit = glMovement.debit;
      movementCredit = glMovement.credit;
    } else if (ob.debit === 0 && ob.credit === 0) {
      // Year 1 scenario with no GL entries: movement = closing
      movementDebit = cb.debit;
      movementCredit = cb.credit;
    } else {
      // Year 2+ scenario with no GL entries: derive from balance change
      movementDebit = Math.max(0, cb.debit - ob.debit);
      movementCredit = Math.max(0, cb.credit - ob.credit);
      if (cb.debit < ob.debit) {
        movementCredit += (ob.debit - cb.debit);
      }
      if (cb.credit < ob.credit) {
        movementDebit += (ob.credit - cb.credit);
      }
    }
    
    trialBalance.push({
      rowNo: rowNo++,
      accountCode: code,
      accountName: ob.name || cb.name,
      openingDebit: ob.debit,
      openingCredit: ob.credit,
      closingDebit: cb.debit,
      closingCredit: cb.credit,
      movementDebit,
      movementCredit,
    });
  }

  // GL data already fetched above, reuse it
  const generalLedger: ParsedGLRow[] = glData.map((gl, idx) => ({
    rowNo: idx + 2,
    journalId: gl.journalHeader.journalId,
    voucherNo: gl.journalHeader.voucherNo || '',
    voucherDate: gl.journalHeader.voucherDate,
    docType: gl.journalHeader.voucherType || 'JV',
    lineNo: gl.lineNo,
    accountCode: gl.accountCode,
    accountName: gl.accountName || '',
    debit: Number(gl.debit),
    credit: Number(gl.credit),
    currency: gl.currency,
    fxRate: Number(gl.fxRate),
  }));

  const partyData = await prisma.importPartyBalance.findMany({
    where: { engagementId },
  });

  const parties: ParsedPartyRow[] = partyData.map((p, idx) => ({
    rowNo: idx + 2,
    partyCode: p.partyCode,
    partyName: p.partyName || '',
    partyType: p.partyType,
    controlAccountCode: p.controlAccountCode,
  }));

  const bankData = await prisma.importBankAccount.findMany({
    where: { engagementId },
  });

  const bankBalanceData = await prisma.importBankBalance.findMany({
    where: { engagementId },
  });
  
  const bankGlCodeMap = new Map<string, string>();
  for (const bb of bankBalanceData) {
    bankGlCodeMap.set(bb.bankAccountCode, bb.glBankAccountCode);
  }

  const bankAccounts: ParsedBankAccountRow[] = bankData.map((b, idx) => ({
    rowNo: idx + 2,
    bankAccountCode: b.bankAccountCode,
    bankName: b.bankName,
    accountNo: b.accountNo,
    accountTitle: b.accountTitle,
    currency: b.currency,
    glAccountCode: bankGlCodeMap.get(b.bankAccountCode),
  }));

  const data: ParsedSheetData = {
    parties,
    bankAccounts,
    trialBalance,
    generalLedger,
    openItems: [],
  };

  const summaryResult = await runValidationsAndStoreSummary(
    engagementId,
    activeVersion.id,
    userId,
    data,
    []
  );

  const exceptions = await prisma.validationException.findMany({
    where: { summaryRunId: summaryResult.id },
  });

  const apRows = partyData.filter(p => p.partyType === 'VENDOR');
  const arRows = partyData.filter(p => p.partyType === 'CUSTOMER');

  return {
    success: true,
    uploadVersionId: activeVersion.id,
    summaryRunId: summaryResult.id,
    counts: {
      tbRows: trialBalance.length,
      glEntries: generalLedger.length,
      apRows: apRows.length,
      arRows: arRows.length,
      bankRows: bankAccounts.length,
      partyCount: parties.length,
    },
    validations: {
      tbArithmeticStatus: summaryResult.tbArithmeticStatus as any,
      glDrCrStatus: summaryResult.glDrCrStatus as any,
      tbGlTieOutStatus: summaryResult.tbGlTieOutStatus as any,
      overallStatus: summaryResult.overallStatus as any,
    },
    exceptions: exceptions.map((e: any) => ({
      dataset: e.dataset as any,
      severity: e.severity as any,
      ruleCode: e.ruleCode,
      ruleName: e.ruleName,
      message: e.message,
      rowReference: e.rowReference || undefined,
      accountCode: e.accountCode || undefined,
      expectedValue: e.expectedValue || undefined,
      actualValue: e.actualValue || undefined,
      difference: e.difference ? Number(e.difference) : undefined,
    })),
  };
}

export type DatasetType = 'tb' | 'gl' | 'ap' | 'ar' | 'bank';

export async function importSingleDataset(
  engagementId: string,
  userId: string,
  fileName: string,
  buffer: Buffer,
  datasetType: DatasetType
): Promise<{ success: boolean; datasetType: string; counts: { rows: number }; message: string; errors?: ValidationError[]; error?: string }> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const errors: ValidationError[] = [];
  let rowCount = 0;
  let datasetLabel = '';

  const firstSheet = workbook.worksheets[0];

  const preParseErrors: ValidationError[] = [];
  switch (datasetType) {
    case 'tb': {
      const sheet = findWorksheet(workbook, SHEET_NAMES.TB) || firstSheet;
      if (sheet) {
        const parsed = parseTBSheet(sheet);
        preParseErrors.push(...parsed.errors);
      }
      break;
    }
    case 'gl': {
      const sheet = findWorksheet(workbook, SHEET_NAMES.GL) || firstSheet;
      if (sheet) {
        const parsed = parseGLSheet(sheet);
        preParseErrors.push(...parsed.errors);
      }
      break;
    }
    case 'ap': {
      const sheet = findWorksheet(workbook, SHEET_NAMES.AP_SUBLEDGER) || firstSheet;
      if (sheet) {
        const parsed = parseAPSubledgerSheet(sheet);
        preParseErrors.push(...parsed.errors);
      }
      break;
    }
    case 'ar': {
      const sheet = findWorksheet(workbook, SHEET_NAMES.AR_SUBLEDGER) || firstSheet;
      if (sheet) {
        const parsed = parseARSubledgerSheet(sheet);
        preParseErrors.push(...parsed.errors);
      }
      break;
    }
    case 'bank': {
      const sheet = findWorksheet(workbook, SHEET_NAMES.BANK_ACCOUNTS) || firstSheet;
      if (sheet) {
        const parsed = parseBankAccountsSheet(sheet);
        preParseErrors.push(...parsed.errors);
      }
      break;
    }
  }

  if (preParseErrors.some(e => e.severity === 'CRITICAL')) {
    return {
      success: false,
      datasetType,
      counts: { rows: 0 },
      message: 'Import blocked due to critical validation errors',
      errors: preParseErrors,
      error: 'Critical parsing errors found - import blocked',
    };
  }

  const result = await prisma.$transaction(async (tx) => {
    const engagement = await tx.engagement.findUnique({
      where: { id: engagementId },
      select: { periodStart: true, periodEnd: true },
    });

    const periodEnd = engagement?.periodEnd || new Date();
    const periodStart = engagement?.periodStart || new Date(periodEnd.getFullYear() - 1, periodEnd.getMonth(), periodEnd.getDate());

    let batch = await tx.importBatch.findFirst({
      where: { engagementId },
      orderBy: { createdAt: 'desc' },
    });

    if (!batch) {
      batch = await tx.importBatch.create({
        data: {
          engagementId,
          batchNumber: `BATCH-${Date.now()}`,
          uploadedById: userId,
          fileName,
          fileSize: buffer.length,
          status: 'APPROVED',
        },
      });
    }

    switch (datasetType) {
      case 'tb': {
        datasetLabel = 'Trial Balance';
        const sheet = findWorksheet(workbook, SHEET_NAMES.TB) || firstSheet;
        if (!sheet) throw new Error('No matching sheet found in the uploaded file');
        const parsed = parseTBSheet(sheet);
        errors.push(...parsed.errors);
        rowCount = parsed.rows.length;

        if (rowCount === 0) throw new Error('No Trial Balance rows found in the uploaded file');

        await tx.importAccountBalance.deleteMany({ where: { engagementId } });

        for (const tb of parsed.rows) {
          const classification = classifyAccount(tb.accountCode, tb.accountName);

          await tx.importAccountBalance.create({
            data: {
              batchId: batch.id,
              engagementId,
              accountCode: tb.accountCode,
              accountName: tb.accountName,
              balanceType: 'OB',
              asOfDate: periodStart,
              debitAmount: tb.openingDebit,
              creditAmount: tb.openingCredit,
              accountClass: classification?.accountClass || null,
              accountSubclass: classification?.accountSubclass || null,
              fsHeadKey: classification?.fsHeadKey || null,
              classificationSource: classification ? 'RULE' : null,
              classificationConfidence: classification?.confidence ? classification.confidence : null,
            },
          });

          await tx.importAccountBalance.create({
            data: {
              batchId: batch.id,
              engagementId,
              accountCode: tb.accountCode,
              accountName: tb.accountName,
              balanceType: 'CB',
              asOfDate: periodEnd,
              debitAmount: tb.closingDebit,
              creditAmount: tb.closingCredit,
              accountClass: classification?.accountClass || null,
              accountSubclass: classification?.accountSubclass || null,
              fsHeadKey: classification?.fsHeadKey || null,
              classificationSource: classification ? 'RULE' : null,
              classificationConfidence: classification?.confidence ? classification.confidence : null,
            },
          });
        }
        break;
      }

      case 'gl': {
        datasetLabel = 'General Ledger';
        const sheet = findWorksheet(workbook, SHEET_NAMES.GL) || firstSheet;
        if (!sheet) throw new Error('No matching sheet found in the uploaded file');
        const parsed = parseGLSheet(sheet);
        errors.push(...parsed.errors);
        rowCount = parsed.rows.length;

        if (rowCount === 0) throw new Error('No GL rows found in the uploaded file');

        await tx.importJournalLine.deleteMany({
          where: { journalHeader: { engagementId } },
        });
        await tx.importJournalHeader.deleteMany({ where: { engagementId } });

        const journalGroups = new Map<string, ParsedGLRow[]>();
        for (const gl of parsed.rows) {
          if (!journalGroups.has(gl.journalId)) {
            journalGroups.set(gl.journalId, []);
          }
          journalGroups.get(gl.journalId)!.push(gl);
        }

        for (const [journalId, lines] of journalGroups) {
          const firstLine = lines[0];
          const totalDebit = lines.reduce((sum, l) => sum + l.debit, 0);
          const totalCredit = lines.reduce((sum, l) => sum + l.credit, 0);

          const year = firstLine.voucherDate.getFullYear();
          const month = firstLine.voucherDate.getMonth() + 1;
          const periodKey = `${year}-${String(month).padStart(2, '0')}`;

          const journalHeader = await tx.importJournalHeader.create({
            data: {
              batchId: batch.id,
              engagementId,
              journalId,
              voucherNo: firstLine.voucherNo,
              voucherDate: firstLine.voucherDate,
              voucherType: firstLine.docType,
              periodKey,
              sourceModule: 'IMPORT',
              narration: firstLine.narration,
              lineCount: lines.length,
              totalDebit,
              totalCredit,
            },
          });

          for (const line of lines) {
            await tx.importJournalLine.create({
              data: {
                journalHeaderId: journalHeader.id,
                lineNo: line.lineNo,
                accountCode: line.accountCode,
                accountName: line.accountName,
                debit: line.debit,
                credit: line.credit,
                partyCode: line.partyCode,
                partyName: line.partyName,
                partyType: line.partyType,
                documentNo: line.documentNo,
                invoiceNo: line.invoiceNo,
                dueDate: line.dueDate,
                costCenter: line.costCenter,
                department: line.department,
                project: line.project,
                location: line.location,
                currency: line.currency,
                fxRate: line.fxRate,
                description: line.description,
                narration: line.narration,
              },
            });
          }
        }
        break;
      }

      case 'ap': {
        datasetLabel = 'Accounts Payable';
        const apSheet = findWorksheet(workbook, SHEET_NAMES.AP_SUBLEDGER);
        const partiesSheet = findWorksheet(workbook, SHEET_NAMES.PARTIES);
        const sheet = apSheet || firstSheet;
        if (!sheet) throw new Error('No matching sheet found in the uploaded file');

        const parsed = parseAPSubledgerSheet(sheet);
        errors.push(...parsed.errors);

        let partiesData: ParsedPartyRow[] = [];
        if (partiesSheet) {
          const partiesResult = parsePartiesSheet(partiesSheet);
          partiesData = partiesResult.rows;
          errors.push(...partiesResult.errors);
        }

        const allParties = [...partiesData, ...parsed.rows];
        rowCount = allParties.length;

        if (rowCount === 0 && parsed.openItems.length === 0) throw new Error('No AP rows found in the uploaded file');
        if (rowCount === 0) rowCount = parsed.openItems.length;

        await tx.importPartyBalance.deleteMany({
          where: { engagementId, partyType: { in: ['VENDOR', 'AP'] } },
        });

        for (const party of allParties) {
          if (party.partyType !== 'VENDOR' && party.partyType !== 'AP') continue;
          await tx.importPartyBalance.create({
            data: {
              batchId: batch.id,
              engagementId,
              partyCode: party.partyCode,
              partyName: party.partyName,
              partyType: party.partyType,
              controlAccountCode: party.controlAccountCode,
              balanceType: 'CB',
              asOfDate: periodEnd,
              balance: 0,
              drcr: 'CR',
              partyEmail: party.email,
              partyAddress: party.address,
              attentionTo: party.attentionTo,
            },
          });
        }

        if (parsed.openItems.length > 0) {
          const partyTotals = new Map<string, { total: number; controlCode: string }>();
          for (const oi of parsed.openItems) {
            const key = oi.partyCode;
            const existing = partyTotals.get(key);
            if (existing) {
              existing.total += Math.abs(oi.amount || oi.balance || 0);
            } else {
              partyTotals.set(key, { total: Math.abs(oi.amount || oi.balance || 0), controlCode: oi.glCode || '' });
            }
          }

          for (const [partyCode, info] of partyTotals) {
            const existingParty = await tx.importPartyBalance.findFirst({
              where: { engagementId, partyCode, balanceType: 'CB' },
            });
            if (existingParty) {
              await tx.importPartyBalance.update({
                where: { id: existingParty.id },
                data: { balance: info.total },
              });
            }
          }
        }
        break;
      }

      case 'ar': {
        datasetLabel = 'Accounts Receivable';
        const arSheet = findWorksheet(workbook, SHEET_NAMES.AR_SUBLEDGER);
        const partiesSheet = findWorksheet(workbook, SHEET_NAMES.PARTIES);
        const sheet = arSheet || firstSheet;
        if (!sheet) throw new Error('No matching sheet found in the uploaded file');

        const parsed = parseARSubledgerSheet(sheet);
        errors.push(...parsed.errors);

        let partiesData: ParsedPartyRow[] = [];
        if (partiesSheet) {
          const partiesResult = parsePartiesSheet(partiesSheet);
          partiesData = partiesResult.rows;
          errors.push(...partiesResult.errors);
        }

        const allParties = [...partiesData, ...parsed.rows];
        rowCount = allParties.length;

        if (rowCount === 0 && parsed.openItems.length === 0) throw new Error('No AR rows found in the uploaded file');
        if (rowCount === 0) rowCount = parsed.openItems.length;

        await tx.importPartyBalance.deleteMany({
          where: { engagementId, partyType: { in: ['CUSTOMER', 'AR'] } },
        });

        for (const party of allParties) {
          if (party.partyType !== 'CUSTOMER' && party.partyType !== 'AR') continue;
          await tx.importPartyBalance.create({
            data: {
              batchId: batch.id,
              engagementId,
              partyCode: party.partyCode,
              partyName: party.partyName,
              partyType: party.partyType,
              controlAccountCode: party.controlAccountCode,
              balanceType: 'CB',
              asOfDate: periodEnd,
              balance: 0,
              drcr: 'DR',
              partyEmail: party.email,
              partyAddress: party.address,
              attentionTo: party.attentionTo,
            },
          });
        }

        if (parsed.openItems.length > 0) {
          const partyTotals = new Map<string, { total: number; controlCode: string }>();
          for (const oi of parsed.openItems) {
            const key = oi.partyCode;
            const existing = partyTotals.get(key);
            if (existing) {
              existing.total += Math.abs(oi.amount || oi.balance || 0);
            } else {
              partyTotals.set(key, { total: Math.abs(oi.amount || oi.balance || 0), controlCode: oi.glCode || '' });
            }
          }

          for (const [partyCode, info] of partyTotals) {
            const existingParty = await tx.importPartyBalance.findFirst({
              where: { engagementId, partyCode, balanceType: 'CB' },
            });
            if (existingParty) {
              await tx.importPartyBalance.update({
                where: { id: existingParty.id },
                data: { balance: info.total },
              });
            }
          }
        }
        break;
      }

      case 'bank': {
        datasetLabel = 'Bank';
        const bankSheet = findWorksheet(workbook, SHEET_NAMES.BANK_ACCOUNTS) || firstSheet;
        if (!bankSheet) throw new Error('No matching sheet found in the uploaded file');

        const parsed = parseBankAccountsSheet(bankSheet);
        errors.push(...parsed.errors);
        rowCount = parsed.rows.length;

        if (rowCount === 0) throw new Error('No Bank rows found in the uploaded file');

        await tx.importBankBalance.deleteMany({ where: { engagementId } });
        await tx.importBankAccount.deleteMany({ where: { engagementId } });

        for (const bank of parsed.rows) {
          await tx.importBankAccount.create({
            data: {
              batchId: batch.id,
              engagementId,
              bankAccountCode: bank.bankAccountCode,
              bankName: bank.bankName,
              accountNo: bank.accountNo,
              accountTitle: bank.accountTitle,
              branchName: bank.branchName,
              branchAddress: bank.branchAddress,
              iban: bank.iban,
              relationshipManager: bank.relationshipManager,
              bankEmail: bank.bankEmail,
              currency: bank.currency,
            },
          });

          if (bank.glAccountCode) {
            await tx.importBankBalance.create({
              data: {
                batchId: batch.id,
                engagementId,
                bankAccountCode: bank.bankAccountCode,
                glBankAccountCode: bank.glAccountCode,
                closingBalance: 0,
                drcr: 'DR',
                asOfDate: periodEnd,
              },
            });
          }
        }

        const bankBalancesSheet = findWorksheet(workbook, SHEET_NAMES.BANK_BALANCES);
        if (bankBalancesSheet) {
          const bbParsed = parseBankBalancesSheet(bankBalancesSheet);
          errors.push(...bbParsed.errors);

          for (const bb of bbParsed.rows) {
            const existingBankAccount = await tx.importBankAccount.findFirst({
              where: { engagementId, bankAccountCode: bb.bankCode },
            });
            if (existingBankAccount) {
              await tx.importBankBalance.upsert({
                where: { engagementId_bankAccountCode_asOfDate: { engagementId, bankAccountCode: bb.bankCode, asOfDate: periodEnd } },
                update: {
                  closingBalance: bb.closingBalance,
                  drcr: bb.closingBalance >= 0 ? 'DR' : 'CR',
                },
                create: {
                  batchId: batch.id,
                  engagementId,
                  bankAccountCode: bb.bankCode,
                  glBankAccountCode: existingBankAccount.bankAccountCode,
                  closingBalance: Math.abs(bb.closingBalance),
                  drcr: bb.closingBalance >= 0 ? 'DR' : 'CR',
                  asOfDate: periodEnd,
                },
              });
            }
          }
        }
        break;
      }

      default:
        throw new Error(`Invalid dataset type: ${datasetType}`);
    }

    return { rowCount };
  }, {
    maxWait: 60000,
    timeout: 300000,
  });

  try {
    const { syncImportDataToCore } = await import("./importSyncService");
    await syncImportDataToCore(engagementId, userId);
  } catch (syncError) {
    console.error("Import sync to core tables failed (non-blocking):", syncError);
  }

  return {
    success: true,
    datasetType,
    counts: { rows: result.rowCount },
    message: `Successfully imported ${result.rowCount} ${datasetLabel} rows`,
    errors: errors.length > 0 ? errors : undefined,
  };
}

export async function getSummaryRun(engagementId: string): Promise<any> {
  const activeVersion = await prisma.uploadVersion.findFirst({
    where: { engagementId, status: 'ACTIVE' },
    orderBy: { createdAt: 'desc' },
  });

  if (!activeVersion) {
    return null;
  }

  const latestRun = await prisma.summaryRun.findFirst({
    where: { uploadVersionId: activeVersion.id },
    orderBy: { createdAt: 'desc' },
    include: {
      exceptions: true,
      uploadVersion: true,
    },
  });

  return latestRun;
}
