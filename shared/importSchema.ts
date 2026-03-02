export type SheetKey =
  | 'PARTIES'
  | 'BANK'
  | 'TRIAL_BALANCE'
  | 'GL'
  | 'OPEN_ITEMS'
  | 'CHART_OF_ACCOUNTS'
  | 'AP_SUBLEDGER'
  | 'AR_SUBLEDGER'
  | 'BANK_BALANCES'
  | 'CONFIRMATIONS';

export type ColumnType = 'TEXT' | 'NUMBER' | 'DATE' | 'ENUM' | 'BOOLEAN';

export interface ColumnDef {
  header: string;
  key: string;
  type: ColumnType;
  required: boolean;
  enumValues?: string[];
  wholeNumberOnly?: boolean;
  description?: string;
}

export interface SheetDef {
  key: SheetKey;
  sheetName: string;
  required: boolean;
  columns: ColumnDef[];
  minRows?: number;
  description: string;
}

export const TEMPLATE_SHEETS: Record<SheetKey, SheetDef> = {
  PARTIES: {
    key: 'PARTIES',
    sheetName: 'Parties',
    required: false,
    description: 'Master list of customers, vendors, and other parties',
    columns: [
      { header: 'Party_ID', key: 'partyId', type: 'TEXT', required: true, description: 'Unique party identifier' },
      { header: 'Party_Type', key: 'partyType', type: 'ENUM', required: true, enumValues: ['CUSTOMER', 'VENDOR', 'OTHER'], description: 'CUSTOMER, VENDOR, or OTHER' },
      { header: 'Legal_Name', key: 'legalName', type: 'TEXT', required: true, description: 'Legal entity name' },
      { header: 'GL_Code', key: 'glCode', type: 'TEXT', required: false, description: 'Control account GL code' },
      { header: 'Email', key: 'email', type: 'TEXT', required: false, description: 'Contact email' },
      { header: 'Address_Line1', key: 'addressLine1', type: 'TEXT', required: false, description: 'Primary address' },
      { header: 'Attention_To', key: 'attentionTo', type: 'TEXT', required: false, description: 'Attention to / contact person' },
    ],
  },
  BANK: {
    key: 'BANK',
    sheetName: 'Bank',
    required: false,
    description: 'Bank account details for confirmations and reconciliations',
    columns: [
      { header: 'Bank_Account_ID', key: 'bankAccountId', type: 'TEXT', required: true, description: 'Unique bank account identifier' },
      { header: 'Party_ID', key: 'partyId', type: 'TEXT', required: false, description: 'Reference to Parties sheet' },
      { header: 'GL_Code', key: 'glCode', type: 'TEXT', required: true, description: 'GL code for bank account' },
      { header: 'Account_Number', key: 'accountNumber', type: 'TEXT', required: true, description: 'Bank account number' },
      { header: 'Bank_Name', key: 'bankName', type: 'TEXT', required: false, description: 'Name of the bank' },
      { header: 'Account_Title', key: 'accountTitle', type: 'TEXT', required: false, description: 'Account title at bank' },
      { header: 'Branch', key: 'branch', type: 'TEXT', required: false },
      { header: 'IBAN', key: 'iban', type: 'TEXT', required: false },
      { header: 'SWIFT_BIC', key: 'swiftBic', type: 'TEXT', required: false },
      { header: 'Currency', key: 'currency', type: 'TEXT', required: false },
      { header: 'Confirmation_Email_or_Address', key: 'confirmationEmail', type: 'TEXT', required: false },
      { header: 'Relationship_Manager', key: 'relationshipManager', type: 'TEXT', required: false },
    ],
  },
  TRIAL_BALANCE: {
    key: 'TRIAL_BALANCE',
    sheetName: 'Trial Balance',
    required: true,
    description: 'Opening and closing balances by GL Code (REQUIRED)',
    columns: [
      { header: 'GL_Code', key: 'glCode', type: 'TEXT', required: true, description: 'General Ledger account code' },
      { header: 'GL_Name', key: 'glName', type: 'TEXT', required: false, description: 'Account description' },
      { header: 'Opening_Balance', key: 'openingBalance', type: 'NUMBER', required: true, wholeNumberOnly: true },
      { header: 'Opening_Debit', key: 'openingDebit', type: 'NUMBER', required: false, wholeNumberOnly: true },
      { header: 'Opening_Credit', key: 'openingCredit', type: 'NUMBER', required: false, wholeNumberOnly: true },
      { header: 'Debit', key: 'debit', type: 'NUMBER', required: true, wholeNumberOnly: true, description: 'Period debit movement' },
      { header: 'Credit', key: 'credit', type: 'NUMBER', required: true, wholeNumberOnly: true, description: 'Period credit movement' },
      { header: 'Closing_Debit', key: 'closingDebit', type: 'NUMBER', required: false, wholeNumberOnly: true },
      { header: 'Closing_Credit', key: 'closingCredit', type: 'NUMBER', required: false, wholeNumberOnly: true },
    ],
  },
  GL: {
    key: 'GL',
    sheetName: 'GL',
    required: true,
    description: 'General Ledger transaction details (REQUIRED)',
    columns: [
      { header: 'Posting_Date', key: 'postingDate', type: 'DATE', required: true },
      { header: 'Voucher_No', key: 'voucherNo', type: 'TEXT', required: true },
      { header: 'Voucher_Type', key: 'voucherType', type: 'ENUM', required: false, enumValues: ['JV', 'BPV', 'BRV', 'CPV', 'CRV', 'SV', 'PV'] },
      { header: 'GL_Code', key: 'glCode', type: 'TEXT', required: true, description: 'Must exist in Trial Balance' },
      { header: 'GL_Name', key: 'glName', type: 'TEXT', required: false },
      { header: 'Debit', key: 'debit', type: 'NUMBER', required: true, wholeNumberOnly: true },
      { header: 'Credit', key: 'credit', type: 'NUMBER', required: true, wholeNumberOnly: true },
      { header: 'Party_ID', key: 'partyId', type: 'TEXT', required: false, description: 'Must exist in Parties' },
      { header: 'Party_Type', key: 'partyType', type: 'ENUM', required: false, enumValues: ['CUSTOMER', 'VENDOR', 'OTHER'] },
      { header: 'Party_Name', key: 'partyName', type: 'TEXT', required: false },
      { header: 'Document_No', key: 'documentNo', type: 'TEXT', required: false },
      { header: 'Document_Date', key: 'documentDate', type: 'DATE', required: false },
      { header: 'Invoice_No', key: 'invoiceNo', type: 'TEXT', required: false },
      { header: 'Due_Date', key: 'dueDate', type: 'DATE', required: false },
      { header: 'Cost_Center', key: 'costCenter', type: 'TEXT', required: false },
      { header: 'Department', key: 'department', type: 'TEXT', required: false },
      { header: 'Project', key: 'project', type: 'TEXT', required: false },
      { header: 'Currency', key: 'currency', type: 'TEXT', required: false },
      { header: 'Description', key: 'description', type: 'TEXT', required: false },
      { header: 'Narration', key: 'narration', type: 'TEXT', required: false },
    ],
  },
  OPEN_ITEMS: {
    key: 'OPEN_ITEMS',
    sheetName: 'Open Items',
    required: false,
    description: 'Outstanding AR/AP items for confirmation population',
    columns: [
      { header: 'Population_Type', key: 'populationType', type: 'ENUM', required: true, enumValues: ['AR', 'AP'] },
      { header: 'Party_ID', key: 'partyId', type: 'TEXT', required: true, description: 'Must exist in Parties' },
      { header: 'GL_Code', key: 'glCode', type: 'TEXT', required: false },
      { header: 'GL_Name', key: 'glName', type: 'TEXT', required: false },
      { header: 'Document_No', key: 'documentNo', type: 'TEXT', required: true },
      { header: 'Document_Date', key: 'documentDate', type: 'DATE', required: false },
      { header: 'Due_Date', key: 'dueDate', type: 'DATE', required: false },
      { header: 'Invoice_No', key: 'invoiceNo', type: 'TEXT', required: false },
      { header: 'Outstanding_Amount', key: 'outstandingAmount', type: 'NUMBER', required: true, wholeNumberOnly: true },
      { header: 'Original_Amount', key: 'originalAmount', type: 'NUMBER', required: false, wholeNumberOnly: true },
      { header: 'Currency', key: 'currency', type: 'TEXT', required: false },
      { header: 'Description', key: 'description', type: 'TEXT', required: false },
      { header: 'Include_in_Confirm', key: 'includeInConfirm', type: 'ENUM', required: false, enumValues: ['Y', 'N'] },
    ],
  },
  CHART_OF_ACCOUNTS: {
    key: 'CHART_OF_ACCOUNTS',
    sheetName: 'Chart_of_Accounts',
    required: false,
    description: 'Chart of Accounts for classification',
    columns: [
      { header: 'GL_Code', key: 'glCode', type: 'TEXT', required: true },
      { header: 'GL_Name', key: 'glName', type: 'TEXT', required: true },
      { header: 'Account_Type', key: 'accountType', type: 'TEXT', required: false },
      { header: 'Parent_Code', key: 'parentCode', type: 'TEXT', required: false },
      { header: 'Level', key: 'level', type: 'NUMBER', required: false },
    ],
  },
  AP_SUBLEDGER: {
    key: 'AP_SUBLEDGER',
    sheetName: 'AP_Subledger',
    required: false,
    description: 'Accounts Payable subledger details',
    columns: [
      { header: 'Vendor_ID', key: 'vendorId', type: 'TEXT', required: true },
      { header: 'Vendor_Name', key: 'vendorName', type: 'TEXT', required: true },
      { header: 'GL_Code', key: 'glCode', type: 'TEXT', required: false },
      { header: 'Invoice_No', key: 'invoiceNo', type: 'TEXT', required: true },
      { header: 'Invoice_Date', key: 'invoiceDate', type: 'DATE', required: false },
      { header: 'Due_Date', key: 'dueDate', type: 'DATE', required: false },
      { header: 'Amount', key: 'amount', type: 'NUMBER', required: true, wholeNumberOnly: true },
      { header: 'Balance', key: 'balance', type: 'NUMBER', required: true, wholeNumberOnly: true },
      { header: 'Currency', key: 'currency', type: 'TEXT', required: false },
      { header: 'Email', key: 'email', type: 'TEXT', required: false },
      { header: 'Address', key: 'address', type: 'TEXT', required: false },
    ],
  },
  AR_SUBLEDGER: {
    key: 'AR_SUBLEDGER',
    sheetName: 'AR_Subledger',
    required: false,
    description: 'Accounts Receivable subledger details',
    columns: [
      { header: 'Customer_ID', key: 'customerId', type: 'TEXT', required: true },
      { header: 'Customer_Name', key: 'customerName', type: 'TEXT', required: true },
      { header: 'GL_Code', key: 'glCode', type: 'TEXT', required: false },
      { header: 'Invoice_No', key: 'invoiceNo', type: 'TEXT', required: true },
      { header: 'Invoice_Date', key: 'invoiceDate', type: 'DATE', required: false },
      { header: 'Due_Date', key: 'dueDate', type: 'DATE', required: false },
      { header: 'Amount', key: 'amount', type: 'NUMBER', required: true, wholeNumberOnly: true },
      { header: 'Balance', key: 'balance', type: 'NUMBER', required: true, wholeNumberOnly: true },
      { header: 'Currency', key: 'currency', type: 'TEXT', required: false },
      { header: 'Email', key: 'email', type: 'TEXT', required: false },
      { header: 'Address', key: 'address', type: 'TEXT', required: false },
    ],
  },
  BANK_BALANCES: {
    key: 'BANK_BALANCES',
    sheetName: 'Bank_Balances',
    required: false,
    description: 'Bank closing balance confirmations',
    columns: [
      { header: 'Bank_Account_ID', key: 'bankAccountId', type: 'TEXT', required: true },
      { header: 'Statement_Date', key: 'statementDate', type: 'DATE', required: true },
      { header: 'Closing_Balance', key: 'closingBalance', type: 'NUMBER', required: true, wholeNumberOnly: true },
      { header: 'Currency', key: 'currency', type: 'TEXT', required: false },
    ],
  },
  CONFIRMATIONS: {
    key: 'CONFIRMATIONS',
    sheetName: 'Confirmations',
    required: false,
    description: 'Confirmation tracking',
    columns: [
      { header: 'Confirmation_ID', key: 'confirmationId', type: 'TEXT', required: true },
      { header: 'Type', key: 'type', type: 'ENUM', required: true, enumValues: ['BANK', 'AR', 'AP', 'LEGAL', 'TAX'] },
      { header: 'Party_ID', key: 'partyId', type: 'TEXT', required: true },
      { header: 'Status', key: 'status', type: 'ENUM', required: false, enumValues: ['DRAFT', 'SENT', 'RECEIVED', 'RECONCILED'] },
      { header: 'Amount', key: 'amount', type: 'NUMBER', required: false, wholeNumberOnly: true },
      { header: 'Currency', key: 'currency', type: 'TEXT', required: false },
    ],
  },
};

export const REQUIRED_SHEET_KEYS: SheetKey[] = Object.values(TEMPLATE_SHEETS)
  .filter(s => s.required)
  .map(s => s.key);

export const ALL_SHEET_NAMES: string[] = Object.values(TEMPLATE_SHEETS).map(s => s.sheetName);

export type ImportErrorSeverity = 'CRITICAL' | 'ERROR' | 'WARNING' | 'INFO';

export type ImportErrorCategory =
  | 'SHEET_MISSING'
  | 'SHEET_UNKNOWN'
  | 'HEADER_MISSING'
  | 'HEADER_UNKNOWN'
  | 'CELL_REQUIRED'
  | 'CELL_TYPE_MISMATCH'
  | 'CELL_ENUM_INVALID'
  | 'CELL_WHOLE_NUMBER'
  | 'CELL_NEGATIVE'
  | 'REF_INTEGRITY'
  | 'DUPLICATE_KEY'
  | 'ARITHMETIC'
  | 'RECONCILIATION';

export interface ImportValidationError {
  id: string;
  severity: ImportErrorSeverity;
  category: ImportErrorCategory;
  sheet: string;
  row?: number;
  column?: string;
  field?: string;
  message: string;
  expected?: string;
  actual?: string;
  ruleCode: string;
  fixHint?: string;
}

export interface ImportValidationResult {
  valid: boolean;
  criticalCount: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  errors: ImportValidationError[];
  sheetsFound: string[];
  sheetsMissing: string[];
  sheetsUnknown: string[];
  rowCounts: Record<string, number>;
}

export type TabStatusValue = 'NOT_STARTED' | 'BLOCKED' | 'READY' | 'IN_PROGRESS' | 'COMPLETED' | 'NEEDS_REVIEW';

export interface TabStatusInfo {
  tabKey: string;
  status: TabStatusValue;
  label: string;
  blockedBy?: string[];
  lastUpdated?: string;
  version?: number;
  editCount?: number;
}

export type AIProposalStatus = 'PROPOSED' | 'REVIEWED' | 'APPROVED' | 'APPLIED' | 'REJECTED';

export interface AIProposalSummary {
  id: string;
  tabKey: string;
  field?: string;
  rowId?: string;
  proposedValue: string;
  currentValue?: string;
  reasoning: string;
  confidence: number;
  status: AIProposalStatus;
  proposedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  appliedAt?: string;
}

export interface DataHealthCheck {
  checkId: string;
  name: string;
  category: 'TB_BALANCE' | 'GL_BALANCE' | 'TB_GL_RECON' | 'AP_CONTROL' | 'AR_CONTROL' | 'BANK_RECON';
  status: 'PASS' | 'FAIL' | 'WARNING' | 'NOT_RUN';
  message: string;
  details?: Record<string, unknown>;
  isaRef?: string;
  blocking: boolean;
}

export interface DataHealthSummary {
  overallStatus: 'PASS' | 'FAIL' | 'WARNING' | 'NOT_RUN';
  passCount: number;
  failCount: number;
  warningCount: number;
  notRunCount: number;
  checks: DataHealthCheck[];
  lastRunAt?: string;
}
