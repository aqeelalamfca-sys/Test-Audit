/**
 * Single-File Import Adapter Layer
 * 
 * This adapter layer provides:
 * 1. Row parsing and normalization utilities
 * 2. Validation rule definitions per record type
 * 3. Helper functions for import processing
 * 
 * The actual database operations are handled in importRoutes.ts
 */

import ExcelJS from 'exceljs';
import { 
  ImportRecordType, 
  getFieldsForRecordType,
  getRequiredFieldsForRecordType,
  resolveFieldAlias,
  VOUCHER_TYPES,
  PARTY_TYPES,
  DRCR_VALUES,
} from './mapping/importAllFieldMap';

export interface ParsedRow {
  rowNo: number;
  sheetName: string;
  recordType: ImportRecordType | null;
  rawData: Record<string, any>;
  normalizedData: Record<string, any>;
  isValid: boolean;
}

export interface ValidationIssue {
  rowNo: number;
  recordType: string;
  severity: 'ERROR' | 'WARN';
  issueCode: string;
  message: string;
  field?: string;
  suggestedFix?: string;
}

export interface ValidationResult {
  isValid: boolean;
  issues: ValidationIssue[];
  errorCount: number;
  warnCount: number;
  stats: {
    totalRows: number;
    validRows: number;
    invalidRows: number;
    byRecordType: Record<string, { total: number; valid: number; invalid: number }>;
  };
}

/**
 * Parse XLSX file buffer to rows with sheet and row tracking
 */
export async function parseXlsxToRows(buffer: Buffer): Promise<ParsedRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const rows: ParsedRow[] = [];
  const validSheets = ['GL_LINE', 'OB_ACCOUNT', 'CB_ACCOUNT', 'OB_PARTY', 'CB_PARTY', 'BANK_MASTER', 'CB_BANK'];

  for (const sheetName of validSheets) {
    const worksheet = workbook.getWorksheet(sheetName);
    if (!worksheet) continue;

    const headers: string[] = [];
    worksheet.getRow(1).eachCell((cell, colNumber) => {
      headers[colNumber - 1] = String(cell.value || '').trim().toLowerCase().replace(/\s+/g, '_');
    });

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;

      const rawData: Record<string, any> = {};
      row.eachCell((cell, colNumber) => {
        const header = headers[colNumber - 1];
        if (header) {
          rawData[header] = cell.value;
        }
      });

      if (Object.values(rawData).every(v => v === null || v === undefined || v === '')) {
        return;
      }

      const normalizedData = normalizeRow(sheetName as ImportRecordType, rawData);
      
      rows.push({
        rowNo: rowNumber,
        sheetName,
        recordType: sheetName as ImportRecordType,
        rawData,
        normalizedData,
        isValid: true,
      });
    });
  }

  return rows;
}

/**
 * Normalize row data - clean strings, parse numbers, parse dates safely
 */
export function normalizeRow(recordType: ImportRecordType, rawData: Record<string, any>): Record<string, any> {
  const fields = getFieldsForRecordType(recordType);
  const normalized: Record<string, any> = { recordType };

  for (const [key, value] of Object.entries(rawData)) {
    const internalKey = resolveFieldAlias(recordType, key) || key;
    const fieldDef = fields.find(f => f.internalKey === internalKey);

    if (!fieldDef) {
      normalized[internalKey] = value;
      continue;
    }

    switch (fieldDef.type) {
      case 'string':
        normalized[internalKey] = value != null ? String(value).trim() : null;
        break;
      case 'number':
        normalized[internalKey] = parseNumber(value);
        break;
      case 'decimal':
        normalized[internalKey] = parseDecimal(value);
        break;
      case 'date':
        normalized[internalKey] = parseDate(value);
        break;
      case 'boolean':
        normalized[internalKey] = parseBoolean(value);
        break;
      default:
        normalized[internalKey] = value;
    }
  }

  return normalized;
}

function parseNumber(value: any): number | null {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return isNaN(num) ? null : num;
}

function parseDecimal(value: any): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'object' && value.result !== undefined) {
    value = value.result;
  }
  const num = Number(value);
  return isNaN(num) ? null : Math.round(num * 100) / 100;
}

function parseDate(value: any): Date | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return value;
  
  if (typeof value === 'number') {
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + value * 86400000);
    return isNaN(date.getTime()) ? null : date;
  }
  
  const date = new Date(value);
  return isNaN(date.getTime()) ? null : date;
}

function parseBoolean(value: any): boolean | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'boolean') return value;
  const str = String(value).toLowerCase().trim();
  if (['true', 'yes', '1', 'y'].includes(str)) return true;
  if (['false', 'no', '0', 'n'].includes(str)) return false;
  return null;
}

/**
 * Route rows by record type
 */
export function routeRowsByRecordType(rows: ParsedRow[]): Record<ImportRecordType, ParsedRow[]> {
  const routed: Record<ImportRecordType, ParsedRow[]> = {
    GL_LINE: [],
    OB_ACCOUNT: [],
    CB_ACCOUNT: [],
    OB_PARTY: [],
    CB_PARTY: [],
    BANK_MASTER: [],
    CB_BANK: [],
  };

  for (const row of rows) {
    if (row.recordType && routed[row.recordType]) {
      routed[row.recordType].push(row);
    }
  }

  return routed;
}

/**
 * Validate batch with ISA-grade validation rules
 * coaAccountCodes: Set of valid account codes from CoAAccount table
 */
export function validateBatch(
  rows: ParsedRow[],
  coaAccountCodes: Set<string>,
  periodStart?: Date,
  periodEnd?: Date
): ValidationResult {
  const issues: ValidationIssue[] = [];
  const routed = routeRowsByRecordType(rows);

  const bankMasterCodes = new Set<string>();
  for (const row of routed.BANK_MASTER) {
    if (row.normalizedData.bankAccountCode) {
      bankMasterCodes.add(row.normalizedData.bankAccountCode);
    }
  }

  for (const row of rows) {
    if (!row.recordType) {
      issues.push({
        rowNo: row.rowNo,
        recordType: 'UNKNOWN',
        severity: 'ERROR',
        issueCode: 'INVALID_RECORD_TYPE',
        message: `Invalid or missing record type in sheet ${row.sheetName}`,
      });
      row.isValid = false;
      continue;
    }

    const requiredFields = getRequiredFieldsForRecordType(row.recordType);
    for (const field of requiredFields) {
      const value = row.normalizedData[field];
      if (value === null || value === undefined || value === '') {
        issues.push({
          rowNo: row.rowNo,
          recordType: row.recordType,
          severity: 'ERROR',
          issueCode: 'MISSING_REQUIRED_FIELD',
          message: `Missing required field: ${field}`,
          field,
          suggestedFix: `Provide a value for ${field}`,
        });
        row.isValid = false;
      }
    }

    if (row.recordType === 'GL_LINE') {
      validateGLLine(row, coaAccountCodes, issues, periodStart, periodEnd);
    } else if (row.recordType === 'OB_ACCOUNT' || row.recordType === 'CB_ACCOUNT') {
      validateAccountBalance(row, coaAccountCodes, issues, periodStart, periodEnd);
    } else if (row.recordType === 'OB_PARTY' || row.recordType === 'CB_PARTY') {
      validatePartyBalance(row, coaAccountCodes, issues);
    } else if (row.recordType === 'BANK_MASTER') {
      validateBankMaster(row, coaAccountCodes, issues);
    } else if (row.recordType === 'CB_BANK') {
      validateCBBank(row, bankMasterCodes, coaAccountCodes, issues);
    }
  }

  validateJournalBalancing(routed.GL_LINE, issues);

  const stats = {
    totalRows: rows.length,
    validRows: rows.filter(r => r.isValid).length,
    invalidRows: rows.filter(r => !r.isValid).length,
    byRecordType: {} as Record<string, { total: number; valid: number; invalid: number }>,
  };

  for (const [type, typeRows] of Object.entries(routed)) {
    stats.byRecordType[type] = {
      total: typeRows.length,
      valid: typeRows.filter(r => r.isValid).length,
      invalid: typeRows.filter(r => !r.isValid).length,
    };
  }

  const errorCount = issues.filter(i => i.severity === 'ERROR').length;
  const warnCount = issues.filter(i => i.severity === 'WARN').length;

  return {
    isValid: errorCount === 0,
    issues,
    errorCount,
    warnCount,
    stats,
  };
}

function validateGLLine(
  row: ParsedRow,
  coaCodeSet: Set<string>,
  issues: ValidationIssue[],
  periodStart?: Date,
  periodEnd?: Date
): void {
  const data = row.normalizedData;

  if (data.accountCode && !coaCodeSet.has(data.accountCode)) {
    issues.push({
      rowNo: row.rowNo,
      recordType: 'GL_LINE',
      severity: 'ERROR',
      issueCode: 'INVALID_ACCOUNT_CODE',
      message: `Account code ${data.accountCode} does not exist in Chart of Accounts`,
      field: 'accountCode',
      suggestedFix: 'Verify account code or add it to CoA first',
    });
    row.isValid = false;
  }

  const debit = data.debit || 0;
  const credit = data.credit || 0;
  
  if (debit < 0 || credit < 0) {
    issues.push({
      rowNo: row.rowNo,
      recordType: 'GL_LINE',
      severity: 'ERROR',
      issueCode: 'NEGATIVE_AMOUNT',
      message: 'Debit and credit amounts cannot be negative',
      field: debit < 0 ? 'debit' : 'credit',
    });
    row.isValid = false;
  }

  if (debit > 0 && credit > 0) {
    issues.push({
      rowNo: row.rowNo,
      recordType: 'GL_LINE',
      severity: 'ERROR',
      issueCode: 'DEBIT_CREDIT_BOTH',
      message: 'A line cannot have both debit and credit amounts',
      suggestedFix: 'Use separate lines for debit and credit entries',
    });
    row.isValid = false;
  }

  if (debit === 0 && credit === 0) {
    issues.push({
      rowNo: row.rowNo,
      recordType: 'GL_LINE',
      severity: 'ERROR',
      issueCode: 'ZERO_AMOUNT',
      message: 'At least one of debit or credit must be greater than zero',
    });
    row.isValid = false;
  }

  if (data.voucherType && !VOUCHER_TYPES.includes(data.voucherType.toUpperCase())) {
    issues.push({
      rowNo: row.rowNo,
      recordType: 'GL_LINE',
      severity: 'WARN',
      issueCode: 'UNKNOWN_VOUCHER_TYPE',
      message: `Unknown voucher type: ${data.voucherType}`,
      field: 'voucherType',
      suggestedFix: `Valid types: ${VOUCHER_TYPES.join(', ')}`,
    });
  }

  if (data.voucherDate && periodStart && periodEnd) {
    const voucherDate = new Date(data.voucherDate);
    if (voucherDate < periodStart || voucherDate > periodEnd) {
      issues.push({
        rowNo: row.rowNo,
        recordType: 'GL_LINE',
        severity: 'ERROR',
        issueCode: 'DATE_OUTSIDE_PERIOD',
        message: `Voucher date ${voucherDate.toISOString().split('T')[0]} is outside engagement period`,
        field: 'voucherDate',
        suggestedFix: `Date must be between ${periodStart.toISOString().split('T')[0]} and ${periodEnd.toISOString().split('T')[0]}`,
      });
      row.isValid = false;
    }
  }

  if (data.partyType && !PARTY_TYPES.includes(data.partyType.toUpperCase())) {
    issues.push({
      rowNo: row.rowNo,
      recordType: 'GL_LINE',
      severity: 'WARN',
      issueCode: 'UNKNOWN_PARTY_TYPE',
      message: `Unknown party type: ${data.partyType}`,
      field: 'partyType',
    });
  }
}

function validateAccountBalance(
  row: ParsedRow,
  coaCodeSet: Set<string>,
  issues: ValidationIssue[],
  periodStart?: Date,
  periodEnd?: Date
): void {
  const data = row.normalizedData;

  if (data.accountCode && !coaCodeSet.has(data.accountCode)) {
    issues.push({
      rowNo: row.rowNo,
      recordType: row.recordType!,
      severity: 'ERROR',
      issueCode: 'INVALID_ACCOUNT_CODE',
      message: `Account code ${data.accountCode} does not exist in Chart of Accounts`,
      field: 'accountCode',
    });
    row.isValid = false;
  }

  if (data.asOfDate && periodStart && periodEnd) {
    const asOfDate = new Date(data.asOfDate);
    const expectedDate = row.recordType === 'OB_ACCOUNT' ? periodStart : periodEnd;
    const daysDiff = Math.abs((asOfDate.getTime() - expectedDate.getTime()) / 86400000);
    
    if (daysDiff > 1) {
      issues.push({
        rowNo: row.rowNo,
        recordType: row.recordType!,
        severity: 'WARN',
        issueCode: 'AS_OF_DATE_MISMATCH',
        message: `As-of date ${asOfDate.toISOString().split('T')[0]} differs from expected ${expectedDate.toISOString().split('T')[0]}`,
        field: 'asOfDate',
      });
    }
  }

  if (data.openingDrCr && !DRCR_VALUES.includes(data.openingDrCr.toUpperCase())) {
    issues.push({
      rowNo: row.rowNo,
      recordType: row.recordType!,
      severity: 'ERROR',
      issueCode: 'INVALID_DRCR',
      message: `Invalid DR/CR indicator: ${data.openingDrCr}`,
      field: 'openingDrCr',
    });
    row.isValid = false;
  }

  if (data.closingDrCr && !DRCR_VALUES.includes(data.closingDrCr.toUpperCase())) {
    issues.push({
      rowNo: row.rowNo,
      recordType: row.recordType!,
      severity: 'ERROR',
      issueCode: 'INVALID_DRCR',
      message: `Invalid DR/CR indicator: ${data.closingDrCr}`,
      field: 'closingDrCr',
    });
    row.isValid = false;
  }
}

function validatePartyBalance(
  row: ParsedRow,
  coaCodeSet: Set<string>,
  issues: ValidationIssue[]
): void {
  const data = row.normalizedData;

  if (!PARTY_TYPES.includes(data.partyType?.toUpperCase())) {
    issues.push({
      rowNo: row.rowNo,
      recordType: row.recordType!,
      severity: 'ERROR',
      issueCode: 'INVALID_PARTY_TYPE',
      message: `Invalid party type: ${data.partyType}`,
      field: 'partyType',
      suggestedFix: `Valid types: ${PARTY_TYPES.join(', ')}`,
    });
    row.isValid = false;
  }

  if (data.controlAccountCode && !coaCodeSet.has(data.controlAccountCode)) {
    issues.push({
      rowNo: row.rowNo,
      recordType: row.recordType!,
      severity: 'ERROR',
      issueCode: 'INVALID_CONTROL_ACCOUNT',
      message: `Control account ${data.controlAccountCode} does not exist in CoA`,
      field: 'controlAccountCode',
    });
    row.isValid = false;
  }

  if (row.recordType === 'CB_PARTY') {
    if (!data.partyEmail && !data.partyAddress) {
      issues.push({
        rowNo: row.rowNo,
        recordType: row.recordType!,
        severity: 'WARN',
        issueCode: 'MISSING_CONTACT_INFO',
        message: 'No email or address provided for confirmation',
        suggestedFix: 'Add party email or address for external confirmation',
      });
    }

    if (data.partyEmail) {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(data.partyEmail)) {
        issues.push({
          rowNo: row.rowNo,
          recordType: row.recordType!,
          severity: 'WARN',
          issueCode: 'INVALID_EMAIL_FORMAT',
          message: `Invalid email format: ${data.partyEmail}`,
          field: 'partyEmail',
        });
      }
    }
  }
}

function validateBankMaster(
  row: ParsedRow,
  coaCodeSet: Set<string>,
  issues: ValidationIssue[]
): void {
  const data = row.normalizedData;

  if (data.glBankAccountCode && !coaCodeSet.has(data.glBankAccountCode)) {
    issues.push({
      rowNo: row.rowNo,
      recordType: 'BANK_MASTER',
      severity: 'ERROR',
      issueCode: 'INVALID_GL_BANK_ACCOUNT',
      message: `GL bank account ${data.glBankAccountCode} does not exist in CoA`,
      field: 'glBankAccountCode',
    });
    row.isValid = false;
  }

  if (!data.bankEmail) {
    issues.push({
      rowNo: row.rowNo,
      recordType: 'BANK_MASTER',
      severity: 'WARN',
      issueCode: 'MISSING_BANK_EMAIL',
      message: 'No bank email provided for confirmation',
      suggestedFix: 'Add bank email for external confirmation',
    });
  } else {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(data.bankEmail)) {
      issues.push({
        rowNo: row.rowNo,
        recordType: 'BANK_MASTER',
        severity: 'WARN',
        issueCode: 'INVALID_EMAIL_FORMAT',
        message: `Invalid email format: ${data.bankEmail}`,
        field: 'bankEmail',
      });
    }
  }
}

function validateCBBank(
  row: ParsedRow,
  bankMasterCodes: Set<string>,
  coaCodeSet: Set<string>,
  issues: ValidationIssue[]
): void {
  const data = row.normalizedData;

  if (data.bankAccountCode && !bankMasterCodes.has(data.bankAccountCode)) {
    issues.push({
      rowNo: row.rowNo,
      recordType: 'CB_BANK',
      severity: 'ERROR',
      issueCode: 'MISSING_BANK_MASTER',
      message: `Bank account ${data.bankAccountCode} not found in BANK_MASTER sheet`,
      field: 'bankAccountCode',
      suggestedFix: 'Add corresponding BANK_MASTER record first',
    });
    row.isValid = false;
  }

  if (data.glBankAccountCode && !coaCodeSet.has(data.glBankAccountCode)) {
    issues.push({
      rowNo: row.rowNo,
      recordType: 'CB_BANK',
      severity: 'ERROR',
      issueCode: 'INVALID_GL_BANK_ACCOUNT',
      message: `GL bank account ${data.glBankAccountCode} does not exist in CoA`,
      field: 'glBankAccountCode',
    });
    row.isValid = false;
  }
}

function validateJournalBalancing(rows: ParsedRow[], issues: ValidationIssue[]): void {
  const journalTotals: Map<string, { debit: number; credit: number; rows: number[] }> = new Map();

  for (const row of rows) {
    if (!row.isValid) continue;
    
    const journalId = row.normalizedData.journalId;
    if (!journalId) continue;

    const current = journalTotals.get(journalId) || { debit: 0, credit: 0, rows: [] };
    current.debit += row.normalizedData.debit || 0;
    current.credit += row.normalizedData.credit || 0;
    current.rows.push(row.rowNo);
    journalTotals.set(journalId, current);
  }

  for (const [journalId, totals] of journalTotals) {
    const diff = Math.abs(totals.debit - totals.credit);
    if (diff > 0.01) {
      for (const row of rows.filter(r => r.normalizedData.journalId === journalId)) {
        row.isValid = false;
      }
      issues.push({
        rowNo: totals.rows[0],
        recordType: 'GL_LINE',
        severity: 'ERROR',
        issueCode: 'JOURNAL_IMBALANCE',
        message: `Journal ${journalId} is unbalanced: Dr ${totals.debit.toFixed(2)} ≠ Cr ${totals.credit.toFixed(2)} (diff: ${diff.toFixed(2)})`,
        field: 'journalId',
        suggestedFix: `Check all lines for journal ${journalId} (rows: ${totals.rows.join(', ')})`,
      });
    }
  }
}

export { ImportRecordType };
