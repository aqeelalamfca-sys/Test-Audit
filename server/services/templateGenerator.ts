import ExcelJS from "exceljs";

let DEMO_COA: any[] = [];
let DEMO_TB_DATA: any[] = [];
let DEMO_GL_ENTRIES: any[] = [];
let DEMO_AR_PARTIES: any[] = [];
let DEMO_AP_PARTIES: any[] = [];
let DEMO_BANK_MASTER: any[] = [];
let DEMO_BANK_BALANCES: any[] = [];
let DEMO_OPENING_BALANCES: any[] = [];
let COA_CLASSIFIED: any[] = [];
let _loaded = false;

async function ensureDemoDataLoaded() {
  if (_loaded) return;
  const dd = await import("./demoData");
  DEMO_COA = dd.DEMO_COA;
  DEMO_TB_DATA = dd.DEMO_TB_DATA;
  DEMO_GL_ENTRIES = dd.DEMO_GL_ENTRIES;
  DEMO_AR_PARTIES = dd.DEMO_AR_PARTIES;
  DEMO_AP_PARTIES = dd.DEMO_AP_PARTIES;
  DEMO_BANK_MASTER = dd.DEMO_BANK_MASTER;
  DEMO_BANK_BALANCES = dd.DEMO_BANK_BALANCES;
  DEMO_OPENING_BALANCES = dd.DEMO_OPENING_BALANCES;
  _loaded = true;
}


const HEADER_FILL: ExcelJS.FillPattern = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF1F4E79" },
};

const REQUIRED_HEADER_FILL: ExcelJS.FillPattern = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFFFFDE7" },
};

const AUTO_CALC_HEADER_FILL: ExcelJS.FillPattern = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFE8F5E9" },
};

const HEADER_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  color: { argb: "FFFFFFFF" },
  size: 11,
};

const REQUIRED_HEADER_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  color: { argb: "FF1F4E79" },
  size: 11,
};

const AUTO_CALC_HEADER_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  color: { argb: "FF2E7D32" },
  size: 11,
};

const NUMBER_FORMAT = "#,##0.00";

interface ColumnDef {
  key: string;
  header: string;
  width: number;
  required?: boolean;
  autoCalc?: boolean;
  type?: "string" | "number" | "date";
  numFmt?: string;
  validation?: ExcelJS.DataValidation;
}

function applyHeaderStyle(ws: ExcelJS.Worksheet, columns: ColumnDef[]) {
  const headerRow = ws.getRow(1);
  headerRow.height = 24;
  columns.forEach((col, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = col.header;
    if (col.autoCalc) {
      cell.fill = AUTO_CALC_HEADER_FILL;
      cell.font = AUTO_CALC_HEADER_FONT;
    } else if (col.required) {
      cell.fill = REQUIRED_HEADER_FILL;
      cell.font = REQUIRED_HEADER_FONT;
    } else {
      cell.fill = HEADER_FILL;
      cell.font = HEADER_FONT;
    }
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = {
      top: { style: "thin" },
      bottom: { style: "thin" },
      left: { style: "thin" },
      right: { style: "thin" },
    };
  });
  ws.views = [{ state: "frozen", ySplit: 1, xSplit: 0 }];
}

function setColumnWidths(ws: ExcelJS.Worksheet, columns: ColumnDef[]) {
  columns.forEach((col, idx) => {
    ws.getColumn(idx + 1).width = col.width;
    if (col.numFmt) {
      ws.getColumn(idx + 1).numFmt = col.numFmt;
    }
  });
}

function addDataValidation(ws: ExcelJS.Worksheet, columns: ColumnDef[], rowCount: number) {
  columns.forEach((col, idx) => {
    if (col.validation) {
      const colLetter = String.fromCharCode(65 + idx);
      for (let r = 2; r <= rowCount + 1; r++) {
        ws.getCell(`${colLetter}${r}`).dataValidation = col.validation;
      }
    }
  });
}

function addRows(ws: ExcelJS.Worksheet, columns: ColumnDef[], data: Record<string, any>[]) {
  data.forEach((row, rowIdx) => {
    const wsRow = ws.getRow(rowIdx + 2);
    columns.forEach((col, colIdx) => {
      const cell = wsRow.getCell(colIdx + 1);
      const val = row[col.key];
      if (val !== undefined && val !== null) {
        cell.value = val;
      }
      if (col.numFmt) {
        cell.numFmt = col.numFmt;
      }
      cell.border = {
        top: { style: "thin", color: { argb: "FFE0E0E0" } },
        bottom: { style: "thin", color: { argb: "FFE0E0E0" } },
        left: { style: "thin", color: { argb: "FFE0E0E0" } },
        right: { style: "thin", color: { argb: "FFE0E0E0" } },
      };
    });
  });
}

function parseMMDDYYYY(dateStr: string): Date {
  const [mm, dd, yyyy] = dateStr.split("/");
  return new Date(Number(yyyy), Number(mm) - 1, Number(dd));
}

interface CoaClassification {
  account_class: string;
  account_subclass: string;
  tb_group: string;
  fs_line_item: string;
  notes_disclosure_ref: string;
}

function classifyAccount(code: string, nature: string): CoaClassification {
  const num = parseInt(code, 10);

  if (num >= 10000 && num < 11000) {
    return { account_class: "Asset", account_subclass: "Current", tb_group: "Current Assets", fs_line_item: "BS-CA-CASH", notes_disclosure_ref: "Note 5" };
  }
  if (num >= 11000 && num < 12000) {
    return { account_class: "Asset", account_subclass: "Current", tb_group: "Current Assets", fs_line_item: "BS-CA-AR", notes_disclosure_ref: "Note 6" };
  }
  if (num >= 12000 && num < 13000) {
    return { account_class: "Asset", account_subclass: "Current", tb_group: "Current Assets", fs_line_item: "BS-CA-INV", notes_disclosure_ref: "Note 7" };
  }
  if (num >= 13000 && num < 14000) {
    return { account_class: "Asset", account_subclass: "Non-current", tb_group: "Non-current Assets", fs_line_item: "BS-NCA-PPE", notes_disclosure_ref: "Note 10" };
  }
  if (num >= 14000 && num < 15000) {
    return { account_class: "Asset", account_subclass: "Non-current", tb_group: "Non-current Assets", fs_line_item: "BS-NCA-PPE", notes_disclosure_ref: "Note 10" };
  }
  if (num >= 15000 && num < 20000) {
    return { account_class: "Asset", account_subclass: "Non-current", tb_group: "Non-current Assets", fs_line_item: "BS-NCA-OTH", notes_disclosure_ref: "Note 13" };
  }
  if (num >= 20000 && num < 21000) {
    return { account_class: "Liability", account_subclass: "Current", tb_group: "Current Liabilities", fs_line_item: "BS-CL-AP", notes_disclosure_ref: "Note 14" };
  }
  if (num >= 21000 && num < 22000) {
    return { account_class: "Liability", account_subclass: "Current", tb_group: "Current Liabilities", fs_line_item: "BS-CL-STB", notes_disclosure_ref: "Note 17" };
  }
  if (num >= 22000 && num < 30000) {
    return { account_class: "Liability", account_subclass: "Non-current", tb_group: "Non-current Liabilities", fs_line_item: "BS-NCL-LTL", notes_disclosure_ref: "Note 19" };
  }
  if (num >= 30000 && num < 40000) {
    return { account_class: "Equity", account_subclass: "", tb_group: "Equity", fs_line_item: "BS-EQ-SC", notes_disclosure_ref: "Note 20" };
  }
  if (num >= 40000 && num < 50000) {
    return { account_class: "Revenue", account_subclass: "Operating", tb_group: "Revenue", fs_line_item: "PL-REV-SALE", notes_disclosure_ref: "Note 23" };
  }
  if (num >= 50000 && num < 51000) {
    return { account_class: "Expense", account_subclass: "Operating", tb_group: "Cost of Sales", fs_line_item: "PL-EXP-COGS", notes_disclosure_ref: "Note 25" };
  }
  if (num >= 51000 && num < 52000) {
    return { account_class: "Expense", account_subclass: "Operating", tb_group: "Operating Expenses", fs_line_item: "PL-EXP-ADMIN", notes_disclosure_ref: "Note 26" };
  }
  if (num >= 52000 && num < 53000) {
    return { account_class: "Expense", account_subclass: "Operating", tb_group: "Selling Expenses", fs_line_item: "PL-EXP-MKT", notes_disclosure_ref: "Note 28" };
  }
  if (num >= 53000 && num < 54000) {
    return { account_class: "Expense", account_subclass: "Operating", tb_group: "Operating Expenses", fs_line_item: "PL-EXP-DEP", notes_disclosure_ref: "Note 30" };
  }
  if (num >= 54000 && num < 55000) {
    return { account_class: "Expense", account_subclass: "Operating", tb_group: "Operating Expenses", fs_line_item: "PL-EXP-PROF", notes_disclosure_ref: "Note 26" };
  }
  if (num >= 55000 && num < 56000) {
    return { account_class: "Expense", account_subclass: "Operating", tb_group: "Finance Costs", fs_line_item: "PL-EXP-FIN", notes_disclosure_ref: "Note 29" };
  }
  if (num >= 56000 && num < 57000) {
    return { account_class: "Revenue", account_subclass: "Non-operating", tb_group: "Other Income", fs_line_item: "PL-REV-OTH", notes_disclosure_ref: "Note 24" };
  }
  if (num >= 70000 && num < 80000) {
    return { account_class: "Expense", account_subclass: "Tax", tb_group: "Taxation", fs_line_item: "PL-TAX", notes_disclosure_ref: "Note 31" };
  }

  return { account_class: nature === "DR" ? "Asset" : "Liability", account_subclass: "", tb_group: "Other", fs_line_item: "OTHER", notes_disclosure_ref: "" };
}

function buildCOAClassified(DEMO_COA: any[]) {
  return DEMO_COA.map((a: any) => {
    const cls = classifyAccount(a.code, a.nature);
    return {
      account_code: a.code,
      account_name: a.accountName,
      account_class: cls.account_class,
      account_subclass: cls.account_subclass,
      nature: a.nature,
      tb_group: cls.tb_group,
      fs_line_item: cls.fs_line_item,
      notes_disclosure_ref: cls.notes_disclosure_ref,
    };
  });
}

function assertDataConsistency(DEMO_TB_DATA: any[], DEMO_GL_ENTRIES: any[], DEMO_OPENING_BALANCES: any[]): void {
  let totalClosingDebit = 0, totalClosingCredit = 0;
  for (const row of DEMO_TB_DATA) {
    totalClosingDebit += row.closingDebit;
    totalClosingCredit += row.closingCredit;
  }
  if (Math.abs(totalClosingDebit - totalClosingCredit) > 1)
    throw new Error(`TB Closing imbalance: Dr=${totalClosingDebit} Cr=${totalClosingCredit}`);

  let glDebit = 0, glCredit = 0;
  for (const row of DEMO_GL_ENTRIES) {
    glDebit += row.debit;
    glCredit += row.credit;
  }
  if (Math.abs(glDebit - glCredit) > 1)
    throw new Error(`GL imbalance: Dr=${glDebit} Cr=${glCredit}`);

  const obDebit = DEMO_OPENING_BALANCES.reduce((s: number, r: any) => s + r.openingDebit, 0);
  const obCredit = DEMO_OPENING_BALANCES.reduce((s: number, r: any) => s + r.openingCredit, 0);
  if (Math.abs(obDebit - obCredit) > 1)
    throw new Error(`Opening balances imbalance: Dr=${obDebit} Cr=${obCredit}`);
}

export async function generateUploadTemplate(): Promise<ExcelJS.Workbook> {
  await ensureDemoDataLoaded();
  COA_CLASSIFIED = buildCOAClassified(DEMO_COA);
  assertDataConsistency(DEMO_TB_DATA, DEMO_GL_ENTRIES, DEMO_OPENING_BALANCES);

  const wb = new ExcelJS.Workbook();
  wb.creator = "AuditWise";
  wb.created = new Date();

  buildReadmeSheet(wb);
  buildCoASheet(wb);
  buildTrialBalanceSheet(wb);
  buildGLSheet(wb);
  buildAPSheet(wb);
  buildARSheet(wb);
  buildBankBalancesSheet(wb);
  buildBankAccountsSheet(wb);
  buildOpeningBalancesSheet(wb);
  buildPriorYearSheet(wb);
  buildFSMappingSheet(wb);
  buildConfirmationsSheet(wb);
  buildValidationSummarySheet(wb);

  return wb;
}

export async function generateUploadTemplateBuffer(): Promise<Buffer> {
  const wb = await generateUploadTemplate();
  const arrayBuffer = await wb.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

function buildReadmeSheet(wb: ExcelJS.Workbook) {
  const ws = wb.addWorksheet("README", { properties: { tabColor: { argb: "FF4CAF50" } } });
  ws.getColumn(1).width = 5;
  ws.getColumn(2).width = 40;
  ws.getColumn(3).width = 15;
  ws.getColumn(4).width = 15;
  ws.getColumn(5).width = 40;
  ws.getColumn(6).width = 30;
  ws.getColumn(7).width = 30;

  let row = 1;
  const titleCell = ws.getCell(`B${row}`);
  titleCell.value = "AuditWise - Upload Template";
  titleCell.font = { bold: true, size: 18, color: { argb: "FF1F4E79" } };
  row += 1;
  ws.getCell(`B${row}`).value = "ABC Manufacturing Ltd - Fiscal Year 2024";
  ws.getCell(`B${row}`).font = { size: 14, color: { argb: "FF666666" } };
  row += 2;

  ws.getCell(`B${row}`).value = "OVERVIEW";
  ws.getCell(`B${row}`).font = { bold: true, size: 13, color: { argb: "FF1F4E79" } };
  row += 1;
  const overviewLines = [
    "This workbook contains all the sheets needed to upload financial data into AuditWise.",
    "Fill in each sheet according to the field definitions below, then upload the entire workbook.",
    "Sample data for ABC Manufacturing Ltd (FY2024) is pre-filled for reference.",
    "All amounts are in Pakistani Rupees (PKR).",
  ];
  overviewLines.forEach(line => {
    ws.getCell(`B${row}`).value = line;
    ws.getCell(`B${row}`).font = { size: 11 };
    row++;
  });
  row++;

  ws.getCell(`B${row}`).value = "STEP-BY-STEP UPLOAD INSTRUCTIONS";
  ws.getCell(`B${row}`).font = { bold: true, size: 13, color: { argb: "FF1F4E79" } };
  row++;
  const steps = [
    "1. Review the Chart_of_Accounts sheet and update with your company's GL codes.",
    "2. Fill in the Trial Balance sheet with opening and closing balances.",
    "3. Enter GL transactions for the audit period.",
    "4. Complete Accounts Payable and Accounts Receivable sheets with party balances.",
    "5. Enter Bank_Balances and Bank details.",
    "6. Fill Opening_Balances and Prior_Year_Comparatives for comparative analysis.",
    "7. Complete FS_Mapping to link accounts to financial statement heads.",
    "8. Add Confirmations data for third-party balance confirmations.",
    "9. Check the Validation_Summary sheet - all checks should show PASS.",
    "10. Save the file and upload it through the AuditWise Data Intake page.",
  ];
  steps.forEach(step => {
    ws.getCell(`B${row}`).value = step;
    ws.getCell(`B${row}`).font = { size: 11 };
    row++;
  });
  row++;

  ws.getCell(`B${row}`).value = "COLOR LEGEND";
  ws.getCell(`B${row}`).font = { bold: true, size: 13, color: { argb: "FF1F4E79" } };
  row++;

  const legendRow1 = ws.getRow(row);
  legendRow1.getCell(2).value = "Yellow Header";
  legendRow1.getCell(2).fill = REQUIRED_HEADER_FILL;
  legendRow1.getCell(2).font = { bold: true };
  legendRow1.getCell(3).value = "= Required field";
  row++;
  const legendRow2 = ws.getRow(row);
  legendRow2.getCell(2).value = "Dark Blue Header";
  legendRow2.getCell(2).fill = HEADER_FILL;
  legendRow2.getCell(2).font = { bold: true, color: { argb: "FFFFFFFF" } };
  legendRow2.getCell(3).value = "= Optional field";
  row++;
  const legendRow3 = ws.getRow(row);
  legendRow3.getCell(2).value = "Green Header";
  legendRow3.getCell(2).fill = AUTO_CALC_HEADER_FILL;
  legendRow3.getCell(2).font = { bold: true, color: { argb: "FF2E7D32" } };
  legendRow3.getCell(3).value = "= Auto-calculated field";
  row += 2;

  ws.getCell(`B${row}`).value = "IMPORTANT RECONCILIATION REQUIREMENTS";
  ws.getCell(`B${row}`).font = { bold: true, size: 13, color: { argb: "FFC62828" } };
  row++;
  const reqs = [
    "- TB Total Debits MUST equal Total Credits (opening, movement, and closing).",
    "- GL Transaction Debits MUST equal Credits for each voucher.",
    "- AP Subledger balances MUST sum to the AP Control Account closing balance.",
    "- AR Subledger balances MUST sum to the AR Control Account closing balance.",
    "- Bank Balances MUST match the corresponding GL bank accounts.",
    "- All account codes used in TB, GL, AP, AR, and Bank sheets MUST exist in Chart_of_Accounts.",
    "- Opening Balances closing amounts MUST match Trial Balance opening amounts.",
  ];
  reqs.forEach(req => {
    ws.getCell(`B${row}`).value = req;
    ws.getCell(`B${row}`).font = { size: 11, color: { argb: "FFC62828" } };
    row++;
  });
  row++;

  ws.getCell(`B${row}`).value = "SHEETS IN THIS WORKBOOK";
  ws.getCell(`B${row}`).font = { bold: true, size: 13, color: { argb: "FF1F4E79" } };
  row++;
  const sheets = [
    ["Chart_of_Accounts", "Chart of Accounts master list (GL codes)"],
    ["Trial Balance", "Opening and closing trial balance"],
    ["GL", "General ledger transaction detail"],
    ["Accounts Payable", "Accounts Payable subledger"],
    ["Accounts Receivable", "Accounts Receivable subledger"],
    ["Bank_Balances", "Bank account closing balances"],
    ["Bank", "Bank account master details"],
    ["Opening_Balances", "Prior year closing / CY opening balances"],
    ["Prior_Year_Comparatives", "Prior year comparative figures"],
    ["FS_Mapping", "Financial statement head mapping"],
    ["Confirmations", "Third-party balance confirmation tracking"],
    ["Validation_Summary", "Auto-validation checks (PASS/FAIL)"],
  ];
  sheets.forEach(([name, desc]) => {
    ws.getCell(`B${row}`).value = name;
    ws.getCell(`B${row}`).font = { bold: true, size: 11 };
    ws.getCell(`C${row}`).value = desc;
    row++;
  });
}

function buildCoASheet(wb: ExcelJS.Workbook) {
  const ws = wb.addWorksheet("Chart_of_Accounts", { properties: { tabColor: { argb: "FF1565C0" } } });
  const columns: ColumnDef[] = [
    { key: "account_code", header: "account_code*", width: 15, required: true },
    { key: "account_name", header: "account_name*", width: 35, required: true },
    { key: "account_class", header: "account_class*", width: 15, required: true, validation: { type: "list", allowBlank: false, formulae: ['"Asset,Liability,Equity,Revenue,Expense"'] } },
    { key: "account_subclass", header: "account_subclass", width: 18 },
    { key: "nature", header: "nature*", width: 10, required: true, validation: { type: "list", allowBlank: false, formulae: ['"DR,CR"'] } },
    { key: "tb_group", header: "tb_group", width: 22 },
    { key: "fs_line_item", header: "fs_line_item", width: 20 },
    { key: "notes_disclosure_ref", header: "notes_disclosure_ref", width: 20 },
  ];
  setColumnWidths(ws, columns);
  applyHeaderStyle(ws, columns);
  addRows(ws, columns, COA_CLASSIFIED);
  addDataValidation(ws, columns, COA_CLASSIFIED.length + 500);
}

function buildTrialBalanceSheet(wb: ExcelJS.Workbook) {
  const ws = wb.addWorksheet("Trial Balance", { properties: { tabColor: { argb: "FF2E7D32" } } });
  const columns: ColumnDef[] = [
    { key: "glCode", header: "GL_Code", width: 15, required: true },
    { key: "glName", header: "GL_Name", width: 35 },
    { key: "openingBalance", header: "Opening_Balance", width: 18, required: true, type: "number", numFmt: "#,##0" },
    { key: "openingDebit", header: "Opening_Debit", width: 18, type: "number", numFmt: "#,##0" },
    { key: "openingCredit", header: "Opening_Credit", width: 18, type: "number", numFmt: "#,##0" },
    { key: "debit", header: "Debit", width: 18, required: true, type: "number", numFmt: "#,##0" },
    { key: "credit", header: "Credit", width: 18, required: true, type: "number", numFmt: "#,##0" },
    { key: "closingDebit", header: "Closing_Debit", width: 18, type: "number", numFmt: "#,##0" },
    { key: "closingCredit", header: "Closing_Credit", width: 18, type: "number", numFmt: "#,##0" },
  ];
  setColumnWidths(ws, columns);
  applyHeaderStyle(ws, columns);

  const tbDataMapped = DEMO_TB_DATA.map(tb => ({
    glCode: tb.glCode,
    glName: tb.glName,
    openingBalance: tb.openingBalance,
    openingDebit: tb.openingBalance > 0 ? tb.openingBalance : 0,
    openingCredit: tb.openingBalance < 0 ? Math.abs(tb.openingBalance) : 0,
    debit: tb.debit,
    credit: tb.credit,
    closingDebit: tb.closingDebit,
    closingCredit: tb.closingCredit,
  }));
  addRows(ws, columns, tbDataMapped);
}

function buildGLSheet(wb: ExcelJS.Workbook) {
  const ws = wb.addWorksheet("GL", { properties: { tabColor: { argb: "FFFF8F00" } } });
  const columns: ColumnDef[] = [
    { key: "postingDate", header: "Posting_Date", width: 16, required: true, type: "date" },
    { key: "voucherNo", header: "Voucher_No", width: 20, required: true },
    { key: "voucherType", header: "Voucher_Type", width: 14, validation: { type: "list", allowBlank: true, formulae: ['"JV,BPV,BRV,CPV,CRV,SV,PV,INV,CN,DN,RV"'] } },
    { key: "glCode", header: "GL_Code", width: 15, required: true },
    { key: "glName", header: "GL_Name", width: 35 },
    { key: "debit", header: "Debit", width: 18, required: true, type: "number", numFmt: "#,##0" },
    { key: "credit", header: "Credit", width: 18, required: true, type: "number", numFmt: "#,##0" },
    { key: "partyId", header: "Party_ID", width: 15 },
    { key: "partyType", header: "Party_Type", width: 14, validation: { type: "list", allowBlank: true, formulae: ['"CUSTOMER,VENDOR,OTHER"'] } },
    { key: "partyName", header: "Party_Name", width: 22 },
    { key: "documentNo", header: "Document_No", width: 18 },
    { key: "documentDate", header: "Document_Date", width: 16, type: "date" },
    { key: "invoiceNo", header: "Invoice_No", width: 18 },
    { key: "dueDate", header: "Due_Date", width: 16, type: "date" },
    { key: "costCenter", header: "Cost_Center", width: 18 },
    { key: "department", header: "Department", width: 18 },
    { key: "project", header: "Project", width: 18 },
    { key: "currency", header: "Currency", width: 10 },
    { key: "description", header: "Description", width: 40 },
    { key: "narration", header: "Narration", width: 40 },
  ];
  setColumnWidths(ws, columns);
  applyHeaderStyle(ws, columns);

  const glData = DEMO_GL_ENTRIES.map(tx => ({
    postingDate: parseMMDDYYYY(tx.postingDate),
    voucherNo: tx.voucherNo,
    voucherType: tx.voucherType,
    glCode: tx.glCode,
    glName: tx.glName,
    debit: tx.debit,
    credit: tx.credit,
    partyId: "",
    partyType: "",
    partyName: "",
    documentNo: tx.documentNo,
    documentDate: "",
    invoiceNo: "",
    dueDate: "",
    costCenter: "",
    department: "",
    project: "",
    currency: tx.currency,
    description: tx.narration,
    narration: tx.narration,
  }));
  addRows(ws, columns, glData);
  addDataValidation(ws, columns, glData.length + 500);
}

function buildAPSheet(wb: ExcelJS.Workbook) {
  const ws = wb.addWorksheet("Accounts Payable", { properties: { tabColor: { argb: "FFE53935" } } });
  const columns: ColumnDef[] = [
    { key: "vendorId", header: "Vendor_ID", width: 15, required: true },
    { key: "vendorName", header: "Vendor_Name", width: 30, required: true },
    { key: "glCode", header: "GL_Code", width: 14 },
    { key: "invoiceNo", header: "Invoice_No", width: 20, required: true },
    { key: "invoiceDate", header: "Invoice_Date", width: 16, type: "date" },
    { key: "dueDate", header: "Due_Date", width: 16, type: "date" },
    { key: "amount", header: "Amount", width: 18, required: true, type: "number", numFmt: "#,##0" },
    { key: "balance", header: "Balance", width: 18, required: true, type: "number", numFmt: "#,##0" },
    { key: "currency", header: "Currency", width: 10 },
    { key: "email", header: "Email", width: 28 },
    { key: "address", header: "Address", width: 35 },
  ];
  setColumnWidths(ws, columns);
  applyHeaderStyle(ws, columns);
  const apDataMapped = DEMO_AP_PARTIES.map(p => ({
    vendorId: p.vendorId,
    vendorName: p.vendorName,
    glCode: p.glCode,
    invoiceNo: `INV-AP-${p.vendorId}`,
    invoiceDate: new Date("2024-12-31"),
    dueDate: new Date("2024-12-31"),
    amount: p.closingCredit,
    balance: p.closingCredit,
    currency: "PKR",
    email: p.email,
    address: "",
  }));
  addRows(ws, columns, apDataMapped);
}

function buildARSheet(wb: ExcelJS.Workbook) {
  const ws = wb.addWorksheet("Accounts Receivable", { properties: { tabColor: { argb: "FF7B1FA2" } } });
  const columns: ColumnDef[] = [
    { key: "customerId", header: "Customer_ID", width: 15, required: true },
    { key: "customerName", header: "Customer_Name", width: 30, required: true },
    { key: "glCode", header: "GL_Code", width: 14 },
    { key: "invoiceNo", header: "Invoice_No", width: 20, required: true },
    { key: "invoiceDate", header: "Invoice_Date", width: 16, type: "date" },
    { key: "dueDate", header: "Due_Date", width: 16, type: "date" },
    { key: "amount", header: "Amount", width: 18, required: true, type: "number", numFmt: "#,##0" },
    { key: "balance", header: "Balance", width: 18, required: true, type: "number", numFmt: "#,##0" },
    { key: "currency", header: "Currency", width: 10 },
    { key: "email", header: "Email", width: 28 },
    { key: "address", header: "Address", width: 35 },
  ];
  setColumnWidths(ws, columns);
  applyHeaderStyle(ws, columns);
  const arDataMapped = DEMO_AR_PARTIES.map(p => ({
    customerId: p.customerId,
    customerName: p.customerName,
    glCode: p.glCode,
    invoiceNo: `INV-AR-${p.customerId}`,
    invoiceDate: new Date("2024-12-31"),
    dueDate: new Date("2024-12-31"),
    amount: p.closingDebit,
    balance: p.closingDebit,
    currency: "PKR",
    email: p.email,
    address: "",
  }));
  addRows(ws, columns, arDataMapped);
}

function buildBankBalancesSheet(wb: ExcelJS.Workbook) {
  const ws = wb.addWorksheet("Bank_Balances", { properties: { tabColor: { argb: "FF00838F" } } });
  const columns: ColumnDef[] = [
    { key: "bankAccountId", header: "Bank_Account_ID", width: 22, required: true },
    { key: "statementDate", header: "Statement_Date", width: 16, required: true, type: "date" },
    { key: "closingBalance", header: "Closing_Balance", width: 18, required: true, type: "number", numFmt: "#,##0" },
    { key: "currency", header: "Currency", width: 10 },
  ];
  setColumnWidths(ws, columns);
  applyHeaderStyle(ws, columns);
  const bankBalMapped = DEMO_BANK_BALANCES.map(bb => ({
    bankAccountId: bb.bankAccountId,
    statementDate: parseMMDDYYYY(bb.statementDate),
    closingBalance: bb.bookBalance,
    currency: "PKR",
  }));
  addRows(ws, columns, bankBalMapped);
}

function buildBankAccountsSheet(wb: ExcelJS.Workbook) {
  const ws = wb.addWorksheet("Bank", { properties: { tabColor: { argb: "FF00838F" } } });
  const columns: ColumnDef[] = [
    { key: "bankAccountId", header: "Bank_Account_ID", width: 22, required: true },
    { key: "partyId", header: "Party_ID", width: 15 },
    { key: "glCode", header: "GL_Code", width: 14, required: true },
    { key: "accountNumber", header: "Account_Number", width: 22, required: true },
    { key: "bankName", header: "Bank_Name", width: 30 },
    { key: "accountTitle", header: "Account_Title", width: 40 },
    { key: "branch", header: "Branch", width: 30 },
    { key: "iban", header: "IBAN", width: 30 },
    { key: "swiftBic", header: "SWIFT_BIC", width: 14 },
    { key: "currency", header: "Currency", width: 10 },
    { key: "confirmationEmail", header: "Confirmation_Email_or_Address", width: 30 },
    { key: "relationshipManager", header: "Relationship_Manager", width: 22 },
  ];
  setColumnWidths(ws, columns);
  applyHeaderStyle(ws, columns);
  const bankAcctMapped = DEMO_BANK_MASTER.map(ba => ({
    bankAccountId: ba.bankAccountId,
    partyId: "",
    glCode: ba.glCode,
    accountNumber: ba.accountNumber,
    bankName: ba.bankName,
    accountTitle: `ABC Manufacturing Ltd - ${ba.accountType} Account`,
    branch: ba.branch,
    iban: "",
    swiftBic: "",
    currency: ba.currency,
    confirmationEmail: "",
    relationshipManager: "",
  }));
  addRows(ws, columns, bankAcctMapped);
}

function buildOpeningBalancesSheet(wb: ExcelJS.Workbook) {
  const ws = wb.addWorksheet("Opening_Balances", { properties: { tabColor: { argb: "FF5D4037" } } });
  const columns: ColumnDef[] = [
    { key: "account_code", header: "account_code*", width: 15, required: true },
    { key: "account_name", header: "account_name*", width: 35, required: true },
    { key: "fiscal_year", header: "fiscal_year*", width: 14, required: true },
    { key: "opening_debit", header: "opening_debit", width: 18, type: "number", numFmt: NUMBER_FORMAT },
    { key: "opening_credit", header: "opening_credit", width: 18, type: "number", numFmt: NUMBER_FORMAT },
    { key: "closing_debit", header: "closing_debit", width: 18, type: "number", numFmt: NUMBER_FORMAT },
    { key: "closing_credit", header: "closing_credit", width: 18, type: "number", numFmt: NUMBER_FORMAT },
    { key: "balance", header: "balance", width: 18, type: "number", numFmt: NUMBER_FORMAT },
  ];
  setColumnWidths(ws, columns);
  applyHeaderStyle(ws, columns);
  const obData = DEMO_OPENING_BALANCES.map(ob => ({
    account_code: ob.code,
    account_name: ob.accountName,
    fiscal_year: 2023,
    opening_debit: 0,
    opening_credit: 0,
    closing_debit: ob.openingDebit,
    closing_credit: ob.openingCredit,
    balance: ob.openingDebit - ob.openingCredit,
  }));
  addRows(ws, columns, obData);
}

function buildPriorYearSheet(wb: ExcelJS.Workbook) {
  const ws = wb.addWorksheet("Prior_Year_Comparatives", { properties: { tabColor: { argb: "FF5D4037" } } });
  const columns: ColumnDef[] = [
    { key: "account_code", header: "account_code*", width: 15, required: true },
    { key: "account_name", header: "account_name*", width: 35, required: true },
    { key: "fiscal_year", header: "fiscal_year*", width: 14, required: true },
    { key: "py_closing_debit", header: "py_closing_debit", width: 18, type: "number", numFmt: NUMBER_FORMAT },
    { key: "py_closing_credit", header: "py_closing_credit", width: 18, type: "number", numFmt: NUMBER_FORMAT },
    { key: "py_closing_balance", header: "py_closing_balance", width: 20, type: "number", numFmt: NUMBER_FORMAT },
  ];
  setColumnWidths(ws, columns);
  applyHeaderStyle(ws, columns);
  const pyData = DEMO_OPENING_BALANCES.map(ob => ({
    account_code: ob.code,
    account_name: ob.accountName,
    fiscal_year: 2023,
    py_closing_debit: ob.openingDebit,
    py_closing_credit: ob.openingCredit,
    py_closing_balance: ob.openingDebit - ob.openingCredit,
  }));
  addRows(ws, columns, pyData);
}

function buildFSMappingSheet(wb: ExcelJS.Workbook) {
  const ws = wb.addWorksheet("FS_Mapping", { properties: { tabColor: { argb: "FF6A1B9A" } } });
  const columns: ColumnDef[] = [
    { key: "account_code", header: "account_code*", width: 15, required: true },
    { key: "account_name", header: "account_name*", width: 35, required: true },
    { key: "fs_head_code", header: "fs_head_code*", width: 18, required: true },
    { key: "fs_head_name", header: "fs_head_name*", width: 35, required: true },
    { key: "statement_type", header: "statement_type*", width: 16, required: true, validation: { type: "list", allowBlank: false, formulae: ['"BS,PL"'] } },
  ];
  setColumnWidths(ws, columns);
  applyHeaderStyle(ws, columns);
  const fsData = COA_CLASSIFIED.map(coa => {
    const isBS = ["Asset", "Liability", "Equity"].includes(coa.account_class);
    return {
      account_code: coa.account_code,
      account_name: coa.account_name,
      fs_head_code: coa.fs_line_item,
      fs_head_name: coa.account_name,
      statement_type: isBS ? "BS" : "PL",
    };
  });
  addRows(ws, columns, fsData);
  addDataValidation(ws, columns, fsData.length + 200);
}

function buildConfirmationsSheet(wb: ExcelJS.Workbook) {
  const ws = wb.addWorksheet("Confirmations", { properties: { tabColor: { argb: "FFEF6C00" } } });
  const columns: ColumnDef[] = [
    { key: "confirmation_id", header: "confirmation_id*", width: 20, required: true },
    { key: "party_code", header: "party_code*", width: 15, required: true },
    { key: "party_name", header: "party_name*", width: 30, required: true },
    { key: "party_type", header: "party_type*", width: 14, required: true, validation: { type: "list", allowBlank: false, formulae: ['"CUSTOMER,VENDOR"'] } },
    { key: "balance_confirmed", header: "balance_confirmed", width: 18, type: "number", numFmt: NUMBER_FORMAT },
    { key: "confirmation_date", header: "confirmation_date", width: 16, type: "date" },
    { key: "response_status", header: "response_status", width: 16, validation: { type: "list", allowBlank: true, formulae: ['"NOT_SENT,SENT,RECEIVED,AGREED,DISAGREED"'] } },
  ];
  setColumnWidths(ws, columns);
  applyHeaderStyle(ws, columns);

  const confirmations: Record<string, any>[] = [];
  DEMO_AR_PARTIES.forEach((p, i) => {
    confirmations.push({
      confirmation_id: `CONF-AR-${String(i + 1).padStart(3, "0")}`,
      party_code: p.customerId,
      party_name: p.customerName,
      party_type: "CUSTOMER",
      balance_confirmed: p.closingDebit,
      confirmation_date: new Date("2024-12-31"),
      response_status: i < 3 ? "AGREED" : "SENT",
    });
  });
  DEMO_AP_PARTIES.forEach((p, i) => {
    confirmations.push({
      confirmation_id: `CONF-AP-${String(i + 1).padStart(3, "0")}`,
      party_code: p.vendorId,
      party_name: p.vendorName,
      party_type: "VENDOR",
      balance_confirmed: p.closingCredit,
      confirmation_date: new Date("2024-12-31"),
      response_status: i < 2 ? "AGREED" : "SENT",
    });
  });

  addRows(ws, columns, confirmations);
  addDataValidation(ws, columns, confirmations.length + 200);
}

function buildValidationSummarySheet(wb: ExcelJS.Workbook) {
  const ws = wb.addWorksheet("Validation_Summary", { properties: { tabColor: { argb: "FFC62828" } } });
  ws.getColumn(1).width = 5;
  ws.getColumn(2).width = 45;
  ws.getColumn(3).width = 22;
  ws.getColumn(4).width = 22;
  ws.getColumn(5).width = 15;
  ws.getColumn(6).width = 40;

  const titleCell = ws.getCell("B1");
  titleCell.value = "Validation Summary";
  titleCell.font = { bold: true, size: 16, color: { argb: "FF1F4E79" } };

  const headerRow = ws.getRow(3);
  const headers = ["", "Validation Check", "Source Value", "Target Value", "Status", "Notes"];
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
  });
  ws.views = [{ state: "frozen", ySplit: 3, xSplit: 0 }];

  const tbLen = DEMO_TB_DATA.length;
  const lastTBRow = tbLen + 1;
  const coaLen = COA_CLASSIFIED.length;
  const apLen = DEMO_AP_PARTIES.length;
  const arLen = DEMO_AR_PARTIES.length;
  const bankLen = DEMO_BANK_BALANCES.length;
  const obLen = DEMO_OPENING_BALANCES.length;

  const bankGlCodes = DEMO_BANK_MASTER.map(b => b.glCode);
  const bankGlFormulaParts = bankGlCodes.map(code =>
    `SUMPRODUCT(('Trial Balance'!A2:A${lastTBRow}="${code}")*('Trial Balance'!H2:H${lastTBRow}))`
  ).join("+");

  const apControlCode = DEMO_AP_PARTIES.length > 0 ? DEMO_AP_PARTIES[0].glCode : "20001";
  const arControlCode = DEMO_AR_PARTIES.length > 0 ? DEMO_AR_PARTIES[0].glCode : "11001";

  const checks = [
    {
      check: "TB Total Opening Debits = Total Opening Credits",
      sourceFormula: `=SUMPRODUCT('Trial Balance'!D2:D${lastTBRow})`,
      targetFormula: `=SUMPRODUCT('Trial Balance'!E2:E${lastTBRow})`,
      exact: false,
      notes: "Opening trial balance must balance",
    },
    {
      check: "TB Total Movement Debits = Total Movement Credits",
      sourceFormula: `=SUMPRODUCT('Trial Balance'!F2:F${lastTBRow})`,
      targetFormula: `=SUMPRODUCT('Trial Balance'!G2:G${lastTBRow})`,
      exact: false,
      notes: "Movement debits and credits must balance",
    },
    {
      check: "TB Total Closing Debits = Total Closing Credits",
      sourceFormula: `=SUMPRODUCT('Trial Balance'!H2:H${lastTBRow})`,
      targetFormula: `=SUMPRODUCT('Trial Balance'!I2:I${lastTBRow})`,
      exact: false,
      notes: "Closing trial balance must balance",
    },
    {
      check: "GL Total Debits = Total Credits",
      sourceFormula: `=SUM(GL!F:F)`,
      targetFormula: `=SUM(GL!G:G)`,
      exact: false,
      notes: "Total GL debits must equal total GL credits",
    },
    {
      check: "TB Movement Debits = GL Total Debits",
      sourceFormula: `=SUMPRODUCT('Trial Balance'!F2:F${lastTBRow})`,
      targetFormula: `=SUM(GL!F:F)`,
      exact: false,
      notes: "TB period movements must match GL totals",
    },
    {
      check: "AP Subledger Total Balance",
      sourceFormula: `=SUMPRODUCT('Accounts Payable'!H2:H${apLen + 1})`,
      targetFormula: `=SUMPRODUCT(('Trial Balance'!A2:A${lastTBRow}="${apControlCode}")*('Trial Balance'!I2:I${lastTBRow}))`,
      exact: false,
      notes: "AP sub-ledger must tie to AP control",
    },
    {
      check: "AR Subledger Total Balance",
      sourceFormula: `=SUMPRODUCT('Accounts Receivable'!H2:H${arLen + 1})`,
      targetFormula: `=SUMPRODUCT(('Trial Balance'!A2:A${lastTBRow}="${arControlCode}")*('Trial Balance'!H2:H${lastTBRow}))`,
      exact: false,
      notes: "AR sub-ledger must tie to AR control",
    },
    {
      check: "Bank Balances match Cash GL Accounts",
      sourceFormula: `=SUM(Bank_Balances!C2:C${bankLen + 1})`,
      targetFormula: `=${bankGlFormulaParts}`,
      exact: false,
      notes: "Bank statement balances must match GL",
    },
    {
      check: "Opening Balances Match TB Openings",
      sourceFormula: `=SUM(Opening_Balances!F2:F${obLen + 1})`,
      targetFormula: `=SUM('Trial Balance'!D2:D${lastTBRow})`,
      exact: false,
      notes: "PY closing must equal CY opening",
    },
    {
      check: "All GL Codes exist in Chart of Accounts",
      sourceFormula: `=COUNTA('Trial Balance'!A2:A${lastTBRow})`,
      targetFormula: `=SUMPRODUCT(COUNTIF(Chart_of_Accounts!A2:A${coaLen + 1},'Trial Balance'!A2:A${lastTBRow}))`,
      exact: true,
      notes: "Every TB code must be in CoA",
    },
  ];

  checks.forEach((check, i) => {
    const r = i + 4;
    const row = ws.getRow(r);
    row.getCell(2).value = check.check;
    row.getCell(2).font = { bold: true, size: 11 };
    row.getCell(3).value = { formula: check.sourceFormula };
    row.getCell(3).numFmt = NUMBER_FORMAT;
    row.getCell(4).value = { formula: check.targetFormula };
    row.getCell(4).numFmt = NUMBER_FORMAT;
    const statusFormula = check.exact
      ? `=IF(C${r}=D${r},"PASS","FAIL")`
      : `=IF(ABS(C${r}-D${r})<0.01,"PASS","FAIL")`;
    row.getCell(5).value = { formula: statusFormula };
    row.getCell(6).value = check.notes;
    row.getCell(6).font = { size: 10, color: { argb: "FF666666" } };

    for (let c = 2; c <= 6; c++) {
      row.getCell(c).border = {
        top: { style: "thin" },
        bottom: { style: "thin" },
        left: { style: "thin" },
        right: { style: "thin" },
      };
    }
  });
}

export async function getTemplateInfo() {
  await ensureDemoDataLoaded();
  if (COA_CLASSIFIED.length === 0) COA_CLASSIFIED = buildCOAClassified(DEMO_COA);
  const confirmationsCount = DEMO_AR_PARTIES.length + DEMO_AP_PARTIES.length;
  return {
    name: "AuditWise Upload Template",
    version: "1.0",
    description: "Comprehensive multi-sheet Excel template for uploading financial data to AuditWise audit portal.",
    company: "ABC Manufacturing Ltd (Sample)",
    fiscalYear: 2024,
    sheets: [
      { name: "README", description: "Instructions and field definitions", fieldCount: 0 },
      { name: "Chart_of_Accounts", description: "Chart of Accounts master", fieldCount: 8, sampleRows: COA_CLASSIFIED.length },
      { name: "Trial Balance", description: "Trial Balance with opening/closing", fieldCount: 9, sampleRows: DEMO_TB_DATA.length },
      { name: "GL", description: "General Ledger transaction detail", fieldCount: 20, sampleRows: DEMO_GL_ENTRIES.length },
      { name: "Accounts Payable", description: "Accounts Payable subledger", fieldCount: 11, sampleRows: DEMO_AP_PARTIES.length },
      { name: "Accounts Receivable", description: "Accounts Receivable subledger", fieldCount: 11, sampleRows: DEMO_AR_PARTIES.length },
      { name: "Bank_Balances", description: "Bank account closing balances", fieldCount: 4, sampleRows: DEMO_BANK_BALANCES.length },
      { name: "Bank", description: "Bank account master details", fieldCount: 12, sampleRows: DEMO_BANK_MASTER.length },
      { name: "Opening_Balances", description: "Prior year closing balances", fieldCount: 8, sampleRows: DEMO_OPENING_BALANCES.length },
      { name: "Prior_Year_Comparatives", description: "Prior year comparative figures", fieldCount: 6, sampleRows: DEMO_OPENING_BALANCES.length },
      { name: "FS_Mapping", description: "Financial statement head mapping", fieldCount: 5, sampleRows: COA_CLASSIFIED.length },
      { name: "Confirmations", description: "Balance confirmation tracking", fieldCount: 7, sampleRows: confirmationsCount },
      { name: "Validation_Summary", description: "Auto-validation checks", fieldCount: 0, validationChecks: 10 },
    ],
    totalSheets: 13,
  };
}
