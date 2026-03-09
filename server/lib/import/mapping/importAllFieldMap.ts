/**
 * Single-File Import Field Mapping Configuration
 * Maps template headers to internal normalized keys
 * 
 * SCHEMA MAPPING PLAN:
 * =====================
 * 
 * Template Record Type → Existing/New Tables
 * -------------------------------------------
 * GL_LINE → ImportJournalHeader + ImportJournalLine (new, grouped by journal_id)
 *         → Validates against CoAAccount (existing) for account_code lookup
 *         → Links to GLBatch/GLEntry for reconciliation (existing)
 * 
 * OB_ACCOUNT/CB_ACCOUNT → ImportAccountBalance (new, merged OB+CB per account)
 *                       → Can be compared to TrialBalanceLine.openingBalance/closingBalance (existing)
 *                       → Validates against CoAAccount (existing)
 * 
 * OB_PARTY/CB_PARTY → ImportPartyBalance (new, merged OB+CB per party)
 *                   → Populates ExternalConfirmation (existing) for AR/AP confirmations
 *                   → partyType maps to confirmation type (CUSTOMER→AR, VENDOR→AP)
 * 
 * BANK_MASTER → ImportBankAccount (new)
 *             → Links to CoAAccount via gl_bank_account_code
 * 
 * CB_BANK → ImportBankBalance (new)
 *         → Must have matching BANK_MASTER record
 *         → Populates ExternalConfirmation (existing) for BANK_BALANCE confirmations
 * 
 * MAKER-CHECKER INTEGRATION:
 * Uses existing MakerCheckerWorkflow with entity type "IMPORT_BATCH_SINGLEFILE"
 * 
 * AUDIT TRAIL:
 * Uses ImportAuditLog (new) + links to existing AuditTrail for cross-module visibility
 */

export type ImportRecordType = 
  | 'GL_LINE' 
  | 'OB_ACCOUNT' 
  | 'CB_ACCOUNT' 
  | 'OB_PARTY' 
  | 'CB_PARTY' 
  | 'BANK_MASTER' 
  | 'CB_BANK';

export interface FieldMapping {
  templateHeader: string;
  internalKey: string;
  type: 'string' | 'number' | 'date' | 'boolean' | 'decimal';
  required: boolean;
  aliases?: string[];
  validation?: {
    pattern?: RegExp;
    min?: number;
    max?: number;
    enum?: string[];
  };
}

export interface RecordTypeConfig {
  recordType: ImportRecordType;
  destinationTable: string;
  fields: FieldMapping[];
  requiredFields: string[];
  uniqueKey?: string[];
  groupBy?: string;
}

export const COMMON_FIELDS: FieldMapping[] = [
  { templateHeader: 'record_type', internalKey: 'recordType', type: 'string', required: true },
  { templateHeader: 'engagement_code', internalKey: 'engagementCode', type: 'string', required: false },
  { templateHeader: 'currency_base', internalKey: 'currencyBase', type: 'string', required: false, aliases: ['base_currency', 'currency'] },
  { templateHeader: 'remarks', internalKey: 'remarks', type: 'string', required: false, aliases: ['notes', 'comments'] },
];

export const GL_LINE_FIELDS: FieldMapping[] = [
  ...COMMON_FIELDS,
  { templateHeader: 'journal_id', internalKey: 'journalId', type: 'string', required: true, aliases: ['journal_no', 'je_id'] },
  { templateHeader: 'voucher_no', internalKey: 'voucherNo', type: 'string', required: true, aliases: ['voucher_number', 'document_no'] },
  { templateHeader: 'voucher_type', internalKey: 'voucherType', type: 'string', required: true, aliases: ['doc_type', 'entry_type'], 
    validation: { enum: ['JV', 'BPV', 'BRV', 'CPV', 'CRV', 'PV', 'RV', 'SV', 'INV', 'CN', 'DN', 'ADJ', 'CLO', 'OPN', 'OTH'] } },
  { templateHeader: 'voucher_date', internalKey: 'voucherDate', type: 'date', required: true, aliases: ['transaction_date', 'date'] },
  { templateHeader: 'posting_date', internalKey: 'postingDate', type: 'date', required: false },
  { templateHeader: 'period_key', internalKey: 'periodKey', type: 'string', required: false, aliases: ['period', 'fiscal_period'] },
  { templateHeader: 'source_module', internalKey: 'sourceModule', type: 'string', required: false },
  { templateHeader: 'narration', internalKey: 'narration', type: 'string', required: false, aliases: ['description', 'memo'] },
  { templateHeader: 'line_no', internalKey: 'lineNo', type: 'number', required: true, aliases: ['line_number', 'seq'] },
  { templateHeader: 'account_code', internalKey: 'accountCode', type: 'string', required: true, aliases: ['gl_code', 'account_no'], 
    validation: { pattern: /^\d{5}$/ } },
  { templateHeader: 'account_name', internalKey: 'accountName', type: 'string', required: false },
  { templateHeader: 'debit', internalKey: 'debit', type: 'decimal', required: false, validation: { min: 0 } },
  { templateHeader: 'credit', internalKey: 'credit', type: 'decimal', required: false, validation: { min: 0 } },
  { templateHeader: 'currency', internalKey: 'currency', type: 'string', required: false },
  { templateHeader: 'fx_rate', internalKey: 'fxRate', type: 'decimal', required: false, validation: { min: 0 } },
  { templateHeader: 'party_code', internalKey: 'partyCode', type: 'string', required: false },
  { templateHeader: 'party_name', internalKey: 'partyName', type: 'string', required: false },
  { templateHeader: 'party_type', internalKey: 'partyType', type: 'string', required: false, 
    validation: { enum: ['CUSTOMER', 'VENDOR', 'EMPLOYEE', 'BANK', 'RP', 'OTHER'] } },
  { templateHeader: 'document_no', internalKey: 'documentNo', type: 'string', required: false },
  { templateHeader: 'invoice_no', internalKey: 'invoiceNo', type: 'string', required: false },
  { templateHeader: 'due_date', internalKey: 'dueDate', type: 'date', required: false },
  { templateHeader: 'cost_center', internalKey: 'costCenter', type: 'string', required: false },
  { templateHeader: 'department', internalKey: 'department', type: 'string', required: false },
  { templateHeader: 'project', internalKey: 'project', type: 'string', required: false },
  { templateHeader: 'location', internalKey: 'location', type: 'string', required: false },
  { templateHeader: 'description', internalKey: 'description', type: 'string', required: false, aliases: ['line_description'] },
];

export const ACCOUNT_BALANCE_FIELDS: FieldMapping[] = [
  ...COMMON_FIELDS,
  { templateHeader: 'account_code', internalKey: 'accountCode', type: 'string', required: true, aliases: ['gl_code', 'account_no'], 
    validation: { pattern: /^\d{5}$/ } },
  { templateHeader: 'account_name', internalKey: 'accountName', type: 'string', required: false },
  { templateHeader: 'opening_dr', internalKey: 'openingDr', type: 'decimal', required: false, validation: { min: 0 } },
  { templateHeader: 'opening_cr', internalKey: 'openingCr', type: 'decimal', required: false, validation: { min: 0 } },
  { templateHeader: 'closing_dr', internalKey: 'closingDr', type: 'decimal', required: false, validation: { min: 0 } },
  { templateHeader: 'closing_cr', internalKey: 'closingCr', type: 'decimal', required: false, validation: { min: 0 } },
  { templateHeader: 'opening_balance', internalKey: 'openingBalance', type: 'decimal', required: false },
  { templateHeader: 'opening_drcr', internalKey: 'openingDrCr', type: 'string', required: false, 
    validation: { enum: ['DR', 'CR'] } },
  { templateHeader: 'closing_balance', internalKey: 'closingBalance', type: 'decimal', required: false },
  { templateHeader: 'closing_drcr', internalKey: 'closingDrCr', type: 'string', required: false, 
    validation: { enum: ['DR', 'CR'] } },
  { templateHeader: 'as_of_date', internalKey: 'asOfDate', type: 'date', required: true },
];

export const PARTY_BALANCE_FIELDS: FieldMapping[] = [
  ...COMMON_FIELDS,
  { templateHeader: 'party_code', internalKey: 'partyCode', type: 'string', required: true },
  { templateHeader: 'party_name', internalKey: 'partyName', type: 'string', required: true },
  { templateHeader: 'party_type', internalKey: 'partyType', type: 'string', required: true, 
    validation: { enum: ['CUSTOMER', 'VENDOR', 'EMPLOYEE', 'BANK', 'RP', 'OTHER'] } },
  { templateHeader: 'control_account_code', internalKey: 'controlAccountCode', type: 'string', required: true, 
    validation: { pattern: /^\d{5}$/ } },
  { templateHeader: 'opening_balance', internalKey: 'openingBalance', type: 'decimal', required: false },
  { templateHeader: 'opening_drcr', internalKey: 'openingDrCr', type: 'string', required: false, 
    validation: { enum: ['DR', 'CR'] } },
  { templateHeader: 'closing_balance', internalKey: 'closingBalance', type: 'decimal', required: false },
  { templateHeader: 'closing_drcr', internalKey: 'closingDrCr', type: 'string', required: false, 
    validation: { enum: ['DR', 'CR'] } },
  { templateHeader: 'as_of_date', internalKey: 'asOfDate', type: 'date', required: true },
  { templateHeader: 'party_email', internalKey: 'partyEmail', type: 'string', required: false, 
    validation: { pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ } },
  { templateHeader: 'party_address', internalKey: 'partyAddress', type: 'string', required: false },
  { templateHeader: 'attention_to', internalKey: 'attentionTo', type: 'string', required: false },
];

export const BANK_MASTER_FIELDS: FieldMapping[] = [
  ...COMMON_FIELDS,
  { templateHeader: 'bank_account_code', internalKey: 'bankAccountCode', type: 'string', required: true },
  { templateHeader: 'bank_name', internalKey: 'bankName', type: 'string', required: true },
  { templateHeader: 'branch_name', internalKey: 'branchName', type: 'string', required: false },
  { templateHeader: 'branch_address', internalKey: 'branchAddress', type: 'string', required: false },
  { templateHeader: 'iban', internalKey: 'iban', type: 'string', required: false },
  { templateHeader: 'account_no', internalKey: 'accountNo', type: 'string', required: true },
  { templateHeader: 'account_title', internalKey: 'accountTitle', type: 'string', required: true },
  { templateHeader: 'relationship_manager', internalKey: 'relationshipManager', type: 'string', required: false },
  { templateHeader: 'bank_email', internalKey: 'bankEmail', type: 'string', required: false, 
    validation: { pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ } },
  { templateHeader: 'gl_bank_account_code', internalKey: 'glBankAccountCode', type: 'string', required: true, 
    validation: { pattern: /^\d{5}$/ } },
];

export const CB_BANK_FIELDS: FieldMapping[] = [
  ...COMMON_FIELDS,
  { templateHeader: 'bank_account_code', internalKey: 'bankAccountCode', type: 'string', required: true },
  { templateHeader: 'gl_bank_account_code', internalKey: 'glBankAccountCode', type: 'string', required: true, 
    validation: { pattern: /^\d{5}$/ } },
  { templateHeader: 'closing_balance', internalKey: 'closingBalance', type: 'decimal', required: true },
  { templateHeader: 'as_of_date', internalKey: 'asOfDate', type: 'date', required: true },
];

export const RECORD_TYPE_CONFIGS: Record<ImportRecordType, RecordTypeConfig> = {
  GL_LINE: {
    recordType: 'GL_LINE',
    destinationTable: 'ImportJournalHeader + ImportJournalLine',
    fields: GL_LINE_FIELDS,
    requiredFields: ['journalId', 'voucherNo', 'voucherType', 'voucherDate', 'lineNo', 'accountCode'],
    groupBy: 'journalId',
  },
  OB_ACCOUNT: {
    recordType: 'OB_ACCOUNT',
    destinationTable: 'ImportAccountBalance (balanceType=OB)',
    fields: ACCOUNT_BALANCE_FIELDS,
    requiredFields: ['accountCode', 'asOfDate'],
    uniqueKey: ['accountCode', 'balanceType'],
  },
  CB_ACCOUNT: {
    recordType: 'CB_ACCOUNT',
    destinationTable: 'ImportAccountBalance (balanceType=CB)',
    fields: ACCOUNT_BALANCE_FIELDS,
    requiredFields: ['accountCode', 'asOfDate'],
    uniqueKey: ['accountCode', 'balanceType'],
  },
  OB_PARTY: {
    recordType: 'OB_PARTY',
    destinationTable: 'ImportPartyBalance (balanceType=OB)',
    fields: PARTY_BALANCE_FIELDS,
    requiredFields: ['partyCode', 'partyName', 'partyType', 'controlAccountCode', 'asOfDate'],
    uniqueKey: ['partyCode', 'balanceType'],
  },
  CB_PARTY: {
    recordType: 'CB_PARTY',
    destinationTable: 'ImportPartyBalance (balanceType=CB) → ExternalConfirmation population',
    fields: PARTY_BALANCE_FIELDS,
    requiredFields: ['partyCode', 'partyName', 'partyType', 'controlAccountCode', 'asOfDate'],
    uniqueKey: ['partyCode', 'balanceType'],
  },
  BANK_MASTER: {
    recordType: 'BANK_MASTER',
    destinationTable: 'ImportBankAccount',
    fields: BANK_MASTER_FIELDS,
    requiredFields: ['bankAccountCode', 'bankName', 'accountNo', 'accountTitle', 'glBankAccountCode'],
    uniqueKey: ['bankAccountCode'],
  },
  CB_BANK: {
    recordType: 'CB_BANK',
    destinationTable: 'ImportBankBalance → ExternalConfirmation population',
    fields: CB_BANK_FIELDS,
    requiredFields: ['bankAccountCode', 'glBankAccountCode', 'closingBalance', 'asOfDate'],
    uniqueKey: ['bankAccountCode', 'asOfDate'],
  },
};

export function getFieldsForRecordType(recordType: ImportRecordType): FieldMapping[] {
  return RECORD_TYPE_CONFIGS[recordType]?.fields || [];
}

export function getRequiredFieldsForRecordType(recordType: ImportRecordType): string[] {
  return RECORD_TYPE_CONFIGS[recordType]?.requiredFields || [];
}

export function resolveFieldAlias(recordType: ImportRecordType, header: string): string | null {
  const fields = getFieldsForRecordType(recordType);
  const normalizedHeader = header.toLowerCase().trim().replace(/\s+/g, '_');
  
  for (const field of fields) {
    if (field.templateHeader === normalizedHeader) {
      return field.internalKey;
    }
    if (field.aliases?.some(alias => alias.toLowerCase() === normalizedHeader)) {
      return field.internalKey;
    }
  }
  return null;
}

export const VOUCHER_TYPES = ['JV', 'BPV', 'BRV', 'CPV', 'CRV', 'PV', 'RV', 'SV', 'INV', 'CN', 'DN', 'ADJ', 'CLO', 'OPN', 'OTH'];
export const PARTY_TYPES = ['CUSTOMER', 'VENDOR', 'EMPLOYEE', 'BANK', 'RP', 'OTHER'];
export const DRCR_VALUES = ['DR', 'CR'];

export function mapPartyTypeToConfirmationType(partyType: string): 'AR' | 'AP' | 'BANK_BALANCE' | null {
  switch (partyType.toUpperCase()) {
    case 'CUSTOMER':
      return 'AR';
    case 'VENDOR':
      return 'AP';
    case 'BANK':
      return 'BANK_BALANCE';
    default:
      return null;
  }
}
