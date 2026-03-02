import { Router, Response } from "express";
import ExcelJS from "exceljs";
import multer from "multer";
import { z } from "zod";
import { requireAuth, type AuthenticatedRequest } from "./auth";
import { prisma } from "./db";
import { generatePhase1Outputs, generateBankConfirmationOutputs } from "./services/outputGenerator";
import { classifyAccount, getDefaultClassificationForCode } from "./services/accountClassificationService";

const VALID_ISO_CURRENCIES = new Set([
  "AED", "AFN", "ALL", "AMD", "ANG", "AOA", "ARS", "AUD", "AWG", "AZN",
  "BAM", "BBD", "BDT", "BGN", "BHD", "BIF", "BMD", "BND", "BOB", "BRL",
  "BSD", "BTN", "BWP", "BYN", "BZD", "CAD", "CDF", "CHF", "CLP", "CNY",
  "COP", "CRC", "CUP", "CVE", "CZK", "DJF", "DKK", "DOP", "DZD", "EGP",
  "ERN", "ETB", "EUR", "FJD", "FKP", "GBP", "GEL", "GHS", "GIP", "GMD",
  "GNF", "GTQ", "GYD", "HKD", "HNL", "HRK", "HTG", "HUF", "IDR", "ILS",
  "INR", "IQD", "IRR", "ISK", "JMD", "JOD", "JPY", "KES", "KGS", "KHR",
  "KMF", "KPW", "KRW", "KWD", "KYD", "KZT", "LAK", "LBP", "LKR", "LRD",
  "LSL", "LYD", "MAD", "MDL", "MGA", "MKD", "MMK", "MNT", "MOP", "MRU",
  "MUR", "MVR", "MWK", "MXN", "MYR", "MZN", "NAD", "NGN", "NIO", "NOK",
  "NPR", "NZD", "OMR", "PAB", "PEN", "PGK", "PHP", "PKR", "PLN", "PYG",
  "QAR", "RON", "RSD", "RUB", "RWF", "SAR", "SBD", "SCR", "SDG", "SEK",
  "SGD", "SHP", "SLL", "SOS", "SRD", "SSP", "STN", "SVC", "SYP", "SZL",
  "THB", "TJS", "TMT", "TND", "TOP", "TRY", "TTD", "TWD", "TZS", "UAH",
  "UGX", "USD", "UYU", "UZS", "VES", "VND", "VUV", "WST", "XAF", "XCD",
  "XOF", "XPF", "YER", "ZAR", "ZMW", "ZWL"
]);

function isValidCurrencyCode(code: string | null | undefined): boolean {
  if (!code) return true;
  return VALID_ISO_CURRENCIES.has(code.toUpperCase().trim());
}

const tbLineUpdateSchema = z.object({
  accountCode: z.string().optional(),
  accountName: z.string().optional(),
  debit: z.union([z.number(), z.string().transform(v => parseFloat(v))]).optional(),
  credit: z.union([z.number(), z.string().transform(v => parseFloat(v))]).optional(),
  openingBalance: z.union([z.number(), z.string().transform(v => parseFloat(v))]).optional(),
  closingBalance: z.union([z.number(), z.string().transform(v => parseFloat(v))]).optional(),
});

const tbLineCreateSchema = z.object({
  accountCode: z.string().min(1, "Account code is required"),
  accountName: z.string().optional(),
  debit: z.union([z.number(), z.string().transform(v => parseFloat(v))]).optional(),
  credit: z.union([z.number(), z.string().transform(v => parseFloat(v))]).optional(),
  openingBalance: z.union([z.number(), z.string().transform(v => parseFloat(v))]).optional(),
  closingBalance: z.union([z.number(), z.string().transform(v => parseFloat(v))]).optional(),
});

const glEntryUpdateSchema = z.object({
  accountCode: z.string().optional(),
  accountName: z.string().optional(),
  debit: z.union([z.number(), z.string().transform(v => parseFloat(v))]).optional(),
  credit: z.union([z.number(), z.string().transform(v => parseFloat(v))]).optional(),
  transactionDate: z.string().optional(),
  voucherNumber: z.string().optional(),
  narrative: z.string().optional(),
});

const glEntryCreateSchema = z.object({
  accountCode: z.string().min(1, "Account code is required"),
  accountName: z.string().optional(),
  debit: z.union([z.number(), z.string().transform(v => parseFloat(v))]).optional(),
  credit: z.union([z.number(), z.string().transform(v => parseFloat(v))]).optional(),
  transactionDate: z.string().optional(),
  voucherNumber: z.string().optional(),
  narrative: z.string().optional(),
});

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

type ValidationSeverity = "ERROR" | "WARNING";

interface ValidationIssue {
  severity: ValidationSeverity;
  sheet: string;
  row: number;
  column: string;
  code: string;
  message: string;
}

interface SheetConfig {
  name: string;
  aliases: string[];
  required: boolean;
  columns: ColumnConfig[];
}

interface ColumnConfig {
  key: string;
  header: string;
  required: boolean;
  width: number;
  type: "string" | "number" | "date" | "enum";
  enumValues?: string[];
}

const SHEET_CONFIGS: SheetConfig[] = [
  {
    name: "Trial Balance",
    aliases: ["tb", "trial_balance", "trial-balance", "trialbalance", "tb_upload", "trial balance"],
    required: true,
    columns: [
      { key: "gl_code", header: "GL_Code", required: true, width: 15, type: "string" },
      { key: "gl_name", header: "Account_Name", required: true, width: 30, type: "string" },
      { key: "category", header: "Category", required: false, width: 22, type: "string" },
      { key: "fs_line_item", header: "FS_Line_Item", required: false, width: 35, type: "string" },
      { key: "class", header: "Class", required: false, width: 30, type: "string" },
      { key: "opening_debit", header: "Opening_DR", required: false, width: 15, type: "number" },
      { key: "opening_credit", header: "Opening_CR", required: false, width: 15, type: "number" },
      { key: "movement_debit", header: "Movement_DR", required: false, width: 15, type: "number" },
      { key: "movement_credit", header: "Movement_CR", required: false, width: 15, type: "number" },
      { key: "closing_debit", header: "Closing_DR", required: false, width: 15, type: "number" },
      { key: "closing_credit", header: "Closing_CR", required: false, width: 15, type: "number" },
      { key: "currency", header: "Currency (optional)", required: false, width: 18, type: "string" },
    ],
  },
  {
    name: "GL",
    aliases: ["gl", "general_ledger", "general-ledger", "generalledger", "gl_upload"],
    required: true,
    columns: [
      { key: "posting_date", header: "Posting_Date (YYYY-MM-DD)", required: true, width: 22, type: "date" },
      { key: "voucher_no", header: "Voucher_No", required: true, width: 15, type: "string" },
      { key: "voucher_type", header: "Voucher_Type (optional)", required: false, width: 22, type: "string" },
      { key: "gl_code", header: "GL_Code", required: true, width: 15, type: "string" },
      { key: "gl_name", header: "GL_Name (optional)", required: false, width: 30, type: "string" },
      { key: "narration", header: "Narration (optional)", required: false, width: 40, type: "string" },
      { key: "debit", header: "Debit", required: false, width: 15, type: "number" },
      { key: "credit", header: "Credit", required: false, width: 15, type: "number" },
      { key: "currency", header: "Currency (optional)", required: false, width: 18, type: "string" },
      { key: "exchange_rate", header: "Exchange_Rate (optional)", required: false, width: 22, type: "number" },
      { key: "party_id", header: "Party_ID", required: false, width: 15, type: "string" },
      { key: "party_type", header: "Party_Type (Bank/Vendor/Customer/None)", required: false, width: 35, type: "enum", enumValues: ["Bank", "Vendor", "Customer", "None"] },
      { key: "email", header: "Email (for PARTY/GL)", required: false, width: 25, type: "string" },
      { key: "address_line1", header: "Address_Line1 (for PARTY/GL)", required: false, width: 30, type: "string" },
      { key: "document_no", header: "Document_No", required: false, width: 15, type: "string" },
      { key: "document_date", header: "Document_Date (YYYY-MM-DD)", required: false, width: 25, type: "date" },
      { key: "due_date", header: "Due_Date (YYYY-MM-DD)", required: false, width: 22, type: "date" },
      { key: "cost_center", header: "Cost_Center (optional)", required: false, width: 20, type: "string" },
      { key: "project", header: "Project (optional)", required: false, width: 20, type: "string" },
      { key: "source_module", header: "Source_Module (optional)", required: false, width: 22, type: "string" },
    ],
  },
  {
    name: "Parties",
    aliases: ["parties", "master_parties", "party_master", "partymaster"],
    required: false,
    columns: [
      { key: "party_id", header: "Party_ID", required: true, width: 15, type: "string" },
      { key: "party_type", header: "Party_Type (Bank/Vendor/Customer/None)", required: true, width: 35, type: "enum", enumValues: ["Bank", "Vendor", "Customer", "None"] },
      { key: "legal_name", header: "Legal_Name (for PARTY)", required: true, width: 30, type: "string" },
      { key: "email", header: "Email (for PARTY/GL)", required: false, width: 25, type: "string" },
      { key: "address_line1", header: "Address_Line1 (for PARTY/GL)", required: false, width: 30, type: "string" },
      { key: "confirmation_method", header: "Confirmation_Method (Email/Postal/Portal)", required: false, width: 35, type: "enum", enumValues: ["Email", "Postal", "Portal"] },
    ],
  },
  {
    name: "Bank",
    aliases: ["bank_accounts", "master_bank_accounts", "bankaccounts", "banks", "bank"],
    required: false,
    columns: [
      { key: "bank_account_id", header: "Bank_Account_ID (for BANK_ACCOUNT)", required: true, width: 30, type: "string" },
      { key: "party_id", header: "Party_ID", required: true, width: 15, type: "string" },
      { key: "gl_code", header: "GL_Code", required: true, width: 15, type: "string" },
      { key: "gl_name", header: "GL_Name (optional)", required: false, width: 30, type: "string" },
      { key: "account_number", header: "Account_Number (for BANK_ACCOUNT)", required: true, width: 30, type: "string" },
      { key: "currency", header: "Currency (optional)", required: false, width: 18, type: "string" },
      { key: "iban", header: "IBAN (optional)", required: false, width: 30, type: "string" },
      { key: "swift_bic", header: "SWIFT_BIC (optional)", required: false, width: 20, type: "string" },
      { key: "confirmation_email_or_address", header: "Confirmation_Email_or_Address (BANK_ACCOUNT)", required: false, width: 40, type: "string" },
    ],
  },
  {
    name: "Open Items",
    aliases: ["open_items", "openitems", "ar_ap", "receivables_payables", "ar_ap_openitems", "open items"],
    required: false,
    columns: [
      { key: "population_type", header: "Population_Type (Debtors/Creditors)", required: true, width: 30, type: "enum", enumValues: ["Debtors", "Creditors"] },
      { key: "party_id", header: "Party_ID", required: true, width: 15, type: "string" },
      { key: "party_type", header: "Party_Type (Bank/Vendor/Customer/None)", required: false, width: 35, type: "enum", enumValues: ["Bank", "Vendor", "Customer", "None"] },
      { key: "gl_code", header: "GL_Code", required: true, width: 15, type: "string" },
      { key: "gl_name", header: "GL_Name (optional)", required: false, width: 30, type: "string" },
      { key: "currency", header: "Currency (optional)", required: false, width: 18, type: "string" },
      { key: "document_no", header: "Document_No", required: true, width: 15, type: "string" },
      { key: "document_date", header: "Document_Date (YYYY-MM-DD)", required: true, width: 25, type: "date" },
      { key: "due_date", header: "Due_Date (YYYY-MM-DD)", required: false, width: 22, type: "date" },
      { key: "outstanding_amount", header: "Outstanding_Amount", required: true, width: 18, type: "number" },
      { key: "include_in_confirm", header: "Include_in_Confirm (Y/N)", required: true, width: 22, type: "enum", enumValues: ["Y", "N"] },
      { key: "notes", header: "Notes (optional)", required: false, width: 30, type: "string" },
    ],
  },
];

function normalizeSheetName(name: string): string {
  return name.toLowerCase().replace(/[\s\-_]/g, "");
}

function findSheetConfig(sheetName: string): SheetConfig | undefined {
  const normalized = normalizeSheetName(sheetName);
  return SHEET_CONFIGS.find(
    (config) =>
      normalizeSheetName(config.name) === normalized ||
      config.aliases.some((alias) => normalizeSheetName(alias) === normalized)
  );
}

function normalizeColumnHeader(header: string): string {
  return header.toLowerCase().replace(/[\s\-_]/g, "");
}

function findHeaderRow(worksheet: ExcelJS.Worksheet, config: SheetConfig): number {
  const requiredHeaders = config.columns.filter((c) => c.required).map((c) => normalizeColumnHeader(c.header));

  for (let rowNum = 1; rowNum <= Math.min(20, worksheet.rowCount); rowNum++) {
    const row = worksheet.getRow(rowNum);
    const headers: string[] = [];
    row.eachCell((cell) => {
      headers.push(normalizeColumnHeader(String(cell.value || "")));
    });

    const foundCount = requiredHeaders.filter((rh) => headers.some((h) => h === rh)).length;
    if (foundCount >= Math.ceil(requiredHeaders.length / 2)) {
      return rowNum;
    }
  }
  return 1;
}

function mapHeadersToColumns(
  worksheet: ExcelJS.Worksheet,
  headerRow: number,
  config: SheetConfig
): Map<string, number> {
  const mapping = new Map<string, number>();
  const row = worksheet.getRow(headerRow);

  row.eachCell((cell, colNumber) => {
    const headerValue = normalizeColumnHeader(String(cell.value || ""));
    const column = config.columns.find((c) => normalizeColumnHeader(c.header) === headerValue);
    if (column) {
      mapping.set(column.key, colNumber);
    }
  });

  return mapping;
}

function applyHeaderStyle(row: ExcelJS.Row): void {
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E40AF" } };
  row.alignment = { horizontal: "center", vertical: "middle" };
  row.height = 25;
}

function applyDataRowStyle(row: ExcelJS.Row, index: number): void {
  row.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: index % 2 === 0 ? "FFF3F4F6" : "FFFFFFFF" },
  };
}

function addBordersToWorksheet(worksheet: ExcelJS.Worksheet): void {
  worksheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: "thin", color: { argb: "FFE5E7EB" } },
        left: { style: "thin", color: { argb: "FFE5E7EB" } },
        bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
        right: { style: "thin", color: { argb: "FFE5E7EB" } },
      };
    });
  });
}

function generateBlankTemplate(workbook: ExcelJS.Workbook): void {
  addReadmeSheet(workbook);
  
  for (const config of SHEET_CONFIGS) {
    const worksheet = workbook.addWorksheet(config.name);
    worksheet.columns = config.columns.map((col) => ({
      header: col.header,
      key: col.key,
      width: col.width,
    }));
    applyHeaderStyle(worksheet.getRow(1));
    addBordersToWorksheet(worksheet);
  }
}

function addReadmeSheet(workbook: ExcelJS.Workbook): void {
  const readmeSheet = workbook.addWorksheet("README");
  
  readmeSheet.columns = [
    { header: "Sheet", key: "sheet", width: 25 },
    { header: "Purpose", key: "purpose", width: 45 },
    { header: "Mandatory", key: "mandatory", width: 12 },
    { header: "Key Fields / Notes", key: "notes", width: 80 },
  ];

  const headerRow = readmeSheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E40AF" } };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };

  const readmeData = [
    {
      sheet: "Trial Balance",
      purpose: "Trial Balance data with period-end balances",
      mandatory: "Yes",
      notes: "Reporting_Period_End_Date*, GL_Code*, GL_Name, Opening_Balance, Debit, Credit, Currency",
    },
    {
      sheet: "GL",
      purpose: "General Ledger transactions and journal entries",
      mandatory: "Yes",
      notes: "Posting_Date*, Voucher_No*, GL_Code*, Debit/Credit, Narration, Party_ID, Party_Type, Document_No, Due_Date, Cost_Center, Project",
    },
    {
      sheet: "Parties",
      purpose: "Party master data (Customers, Vendors, Banks)",
      mandatory: "No",
      notes: "Party_ID*, Party_Type*, Legal_Name*, Email, Address_Line1, Confirmation_Method (Email/Postal/Portal)",
    },
    {
      sheet: "Bank",
      purpose: "Bank account details linked to Bank parties",
      mandatory: "No",
      notes: "Bank_Account_ID*, Party_ID*, GL_Code*, Account_Number*, Currency, IBAN, SWIFT_BIC, Confirmation_Email_or_Address",
    },
    {
      sheet: "Open Items",
      purpose: "Open receivables and payables for confirmations",
      mandatory: "No",
      notes: "Population_Type* (Debtors/Creditors), Party_ID*, GL_Code*, Document_No*, Document_Date*, Outstanding_Amount*, Include_in_Confirm* (Y/N)",
    },
  ];

  readmeData.forEach((row, idx) => {
    const dataRow = readmeSheet.addRow(row);
    dataRow.alignment = { vertical: "middle", wrapText: true };
    if (idx % 2 === 0) {
      dataRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } };
    }
  });

  readmeSheet.getColumn("mandatory").alignment = { horizontal: "center", vertical: "middle" };
  
  for (let i = 1; i <= readmeData.length + 1; i++) {
    const row = readmeSheet.getRow(i);
    row.eachCell((cell) => {
      cell.border = {
        top: { style: "thin", color: { argb: "FFD1D5DB" } },
        left: { style: "thin", color: { argb: "FFD1D5DB" } },
        bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
        right: { style: "thin", color: { argb: "FFD1D5DB" } },
      };
    });
  }
}

router.get("/templates/workbook", async (req, res) => {
  try {
    const templateType = (String(req.query.type || "")).toUpperCase() || "TBGL_MULTI";

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "AuditWise";
    workbook.created = new Date();

    generateBlankTemplate(workbook);

    const filename = "AuditWise_TBGL_Template.xlsx";

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=${filename}`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Error generating workbook template:", error);
    res.status(500).json({ error: "Failed to generate workbook template" });
  }
});

function parseNumber(val: any): number | null {
  if (val === null || val === undefined || val === "") return null;
  const num = typeof val === "number" ? val : parseFloat(String(val).replace(/,/g, ""));
  return isNaN(num) ? null : num;
}

function parseDate(val: any): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val === "number") {
    const excelEpoch = new Date(1899, 11, 30);
    return new Date(excelEpoch.getTime() + val * 24 * 60 * 60 * 1000);
  }
  const parsed = new Date(val);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function getCellValue(row: ExcelJS.Row, colNumber: number): any {
  const cell = row.getCell(colNumber);
  if (!cell) return null;
  const value = cell.value;
  if (value && typeof value === "object" && "result" in value) {
    return (value as any).result;
  }
  return value;
}

router.post(
  "/engagements/:engagementId/imports/workbook",
  requireAuth,
  upload.single("file"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { engagementId } = req.params;
      const { periodEndDate, currency, amountScale, mode } = req.body;

      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const importMode = mode?.toUpperCase() === "COMMIT" ? "COMMIT" : "VALIDATE_ONLY";
      const scale = parseFloat(amountScale) || 1;
      const defaultCurrency = currency || "PKR";
      const defaultPeriodEnd = periodEndDate ? new Date(periodEndDate) : new Date();

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(Buffer.from(req.file.buffer));

      const issues: ValidationIssue[] = [];
      const parsedData: Record<string, any[]> = {};
      const detectedSheets: { name: string; config: SheetConfig; worksheet: ExcelJS.Worksheet }[] = [];

      workbook.eachSheet((worksheet) => {
        const config = findSheetConfig(worksheet.name);
        if (config) {
          detectedSheets.push({ name: worksheet.name, config, worksheet });
        }
      });

      for (const requiredConfig of SHEET_CONFIGS.filter((c) => c.required)) {
        const found = detectedSheets.find((d) => d.config.name === requiredConfig.name);
        if (!found) {
          issues.push({
            severity: "ERROR",
            sheet: requiredConfig.name,
            row: 0,
            column: "",
            code: "E_REQUIRED_SHEET_MISSING",
            message: `Required sheet '${requiredConfig.name}' is missing. Acceptable names: ${requiredConfig.aliases.join(", ")}`,
          });
        }
      }

      for (const { name: sheetName, config, worksheet } of detectedSheets) {
        const headerRow = findHeaderRow(worksheet, config);
        const columnMapping = mapHeadersToColumns(worksheet, headerRow, config);

        for (const col of config.columns.filter((c) => c.required)) {
          if (!columnMapping.has(col.key)) {
            issues.push({
              severity: "ERROR",
              sheet: sheetName,
              row: headerRow,
              column: col.header,
              code: "E_REQUIRED_COLUMN_MISSING",
              message: `Required column '${col.header}' is missing in sheet '${sheetName}'`,
            });
          }
        }

        const rows: any[] = [];

        worksheet.eachRow((row, rowNumber) => {
          if (rowNumber <= headerRow) return;

          const rowData: Record<string, any> = {};
          let hasData = false;

          for (const col of config.columns) {
            const colNum = columnMapping.get(col.key);
            if (!colNum) continue;

            const cellValue = getCellValue(row, colNum);
            if (cellValue !== null && cellValue !== undefined && cellValue !== "") {
              hasData = true;
            }

            switch (col.type) {
              case "number":
                const numVal = parseNumber(cellValue);
                rowData[col.key] = numVal !== null ? numVal * scale : null;
                break;
              case "date":
                const dateVal = parseDate(cellValue);
                rowData[col.key] = dateVal;
                if (col.required && cellValue && !dateVal) {
                  issues.push({
                    severity: "ERROR",
                    sheet: sheetName,
                    row: rowNumber,
                    column: col.header,
                    code: "E_DATE_PARSE_FAILED",
                    message: `Invalid date format in column '${col.header}'`,
                  });
                }
                break;
              case "enum":
                const strVal = String(cellValue || "").trim();
                rowData[col.key] = strVal;
                if (col.required && strVal && col.enumValues && !col.enumValues.some((e) => e.toLowerCase() === strVal.toLowerCase())) {
                  issues.push({
                    severity: "WARNING",
                    sheet: sheetName,
                    row: rowNumber,
                    column: col.header,
                    code: "E_INVALID_ENUM_VALUE",
                    message: `Invalid value '${strVal}' for '${col.header}'. Expected: ${col.enumValues.join(", ")}`,
                  });
                }
                break;
              default:
                rowData[col.key] = cellValue !== null && cellValue !== undefined ? String(cellValue).trim() : null;
            }
          }

          if (!hasData) return;

          for (const col of config.columns.filter((c) => c.required)) {
            const val = rowData[col.key];
            if (val === null || val === undefined || val === "") {
              issues.push({
                severity: "ERROR",
                sheet: sheetName,
                row: rowNumber,
                column: col.header,
                code: "E_REQUIRED_FIELD_MISSING",
                message: `Required field '${col.header}' is empty`,
              });
            }
          }

          rowData._rowNumber = rowNumber;
          rows.push(rowData);
        });

        parsedData[config.name] = rows;
      }

      const tbRows = parsedData["Trial Balance"] || [];
      const glCodesSeen = new Set<string>();
      for (const row of tbRows) {
        if (row.gl_code) {
          if (glCodesSeen.has(row.gl_code)) {
            issues.push({
              severity: "ERROR",
              sheet: "Trial Balance",
              row: row._rowNumber,
              column: "GL_Code",
              code: "E_TB_GL_CODE_DUPLICATE",
              message: `Duplicate GL_Code '${row.gl_code}' found`,
            });
          }
          glCodesSeen.add(row.gl_code);
        }

        if (row.opening_balance !== null && row.opening_balance < 0) {
          issues.push({
            severity: "ERROR",
            sheet: "Trial Balance",
            row: row._rowNumber,
            column: "Opening_Balance",
            code: "E_NEGATIVE_AMOUNT",
            message: "Opening_Balance cannot be negative",
          });
        }
        if (row.debit !== null && row.debit < 0) {
          issues.push({
            severity: "ERROR",
            sheet: "Trial Balance",
            row: row._rowNumber,
            column: "Debit",
            code: "E_NEGATIVE_AMOUNT",
            message: "Debit cannot be negative",
          });
        }
        if (row.credit !== null && row.credit < 0) {
          issues.push({
            severity: "ERROR",
            sheet: "Trial Balance",
            row: row._rowNumber,
            column: "Credit",
            code: "E_NEGATIVE_AMOUNT",
            message: "Credit cannot be negative",
          });
        }

        if (row.currency && !isValidCurrencyCode(row.currency)) {
          issues.push({
            severity: "WARNING",
            sheet: "Trial Balance",
            row: row._rowNumber,
            column: "Currency",
            code: "W_INVALID_CURRENCY",
            message: `Invalid currency code '${row.currency}'. Expected 3-letter ISO code (e.g., USD, EUR, PKR)`,
          });
        }

        if (row.reporting_period_end_date) {
          const periodDate = row.reporting_period_end_date;
          const now = new Date();
          const minDate = new Date("1990-01-01");
          const maxDate = new Date(now.getFullYear() + 2, 11, 31);
          if (periodDate < minDate || periodDate > maxDate) {
            issues.push({
              severity: "WARNING",
              sheet: "Trial Balance",
              row: row._rowNumber,
              column: "Reporting_Period_End_Date",
              code: "W_PERIOD_DATE_RANGE",
              message: `Period end date '${periodDate.toISOString().split("T")[0]}' seems unusual (expected 1990-${maxDate.getFullYear()})`,
            });
          }
        }
      }

      const glRows = parsedData["GL"] || [];
      const glVouchersSeen = new Set<string>();
      let glTotalDebit = 0;
      let glTotalCredit = 0;

      for (const row of glRows) {
        const hasDebit = row.debit !== null && row.debit > 0;
        const hasCredit = row.credit !== null && row.credit > 0;

        glTotalDebit += row.debit || 0;
        glTotalCredit += row.credit || 0;

        if (hasDebit && hasCredit) {
          issues.push({
            severity: "ERROR",
            sheet: "GL",
            row: row._rowNumber,
            column: "Debit/Credit",
            code: "E_GL_DRCR_BOTH_PRESENT",
            message: "Cannot have both Debit and Credit on the same line",
          });
        }

        if (!hasDebit && !hasCredit) {
          issues.push({
            severity: "WARNING",
            sheet: "GL",
            row: row._rowNumber,
            column: "Debit/Credit",
            code: "E_GL_ZERO_AMOUNT",
            message: "Neither Debit nor Credit has a value",
          });
        }

        if (row.voucher_no && glVouchersSeen.has(row.voucher_no)) {
          issues.push({
            severity: "WARNING",
            sheet: "GL",
            row: row._rowNumber,
            column: "Voucher_No",
            code: "W_GL_VOUCHER_DUPLICATE",
            message: `Duplicate Voucher_No '${row.voucher_no}' found (may be intentional for multi-line journals)`,
          });
        }
        if (row.voucher_no) {
          glVouchersSeen.add(row.voucher_no);
        }

        if (row.currency && !isValidCurrencyCode(row.currency)) {
          issues.push({
            severity: "WARNING",
            sheet: "GL",
            row: row._rowNumber,
            column: "Currency",
            code: "W_INVALID_CURRENCY",
            message: `Invalid currency code '${row.currency}'. Expected 3-letter ISO code (e.g., USD, EUR, PKR)`,
          });
        }

        if (row.posting_date) {
          const postingDate = row.posting_date;
          const now = new Date();
          const minDate = new Date("1990-01-01");
          const maxDate = new Date(now.getFullYear() + 1, 11, 31);
          if (postingDate < minDate || postingDate > maxDate) {
            issues.push({
              severity: "WARNING",
              sheet: "GL",
              row: row._rowNumber,
              column: "Posting_Date",
              code: "W_POSTING_DATE_RANGE",
              message: `Posting date '${postingDate.toISOString().split("T")[0]}' seems unusual`,
            });
          }
        }
      }

      if (glRows.length > 0) {
        const glBalanceDifference = Math.abs(glTotalDebit - glTotalCredit);
        if (glBalanceDifference > 0.01) {
          issues.push({
            severity: "WARNING",
            sheet: "GL",
            row: 0,
            column: "Debit/Credit",
            code: "W_GL_TOTALS_IMBALANCE",
            message: `GL totals do not balance: Total Debits (${glTotalDebit.toFixed(2)}) != Total Credits (${glTotalCredit.toFixed(2)}). Difference: ${glBalanceDifference.toFixed(2)}`,
          });
        }
      }

      const partyRows = parsedData["Parties"] || [];
      const partyIdsSeen = new Set<string>();
      const bankPartyIds = new Set<string>();

      for (const row of partyRows) {
        if (row.party_id) {
          if (partyIdsSeen.has(row.party_id)) {
            issues.push({
              severity: "ERROR",
              sheet: "Parties",
              row: row._rowNumber,
              column: "Party_ID",
              code: "E_PARTY_ID_DUPLICATE",
              message: `Duplicate Party_ID '${row.party_id}' found`,
            });
          }
          partyIdsSeen.add(row.party_id);

          if (row.party_type?.toLowerCase() === "bank") {
            bankPartyIds.add(row.party_id);
          }
        }
      }

      const bankAccountRows = parsedData["Bank"] || [];
      for (const row of bankAccountRows) {
        if (row.party_id && !bankPartyIds.has(row.party_id) && partyIdsSeen.size > 0) {
          issues.push({
            severity: "ERROR",
            sheet: "Bank",
            row: row._rowNumber,
            column: "Party_ID",
            code: "E_BANK_PARTY_NOT_FOUND",
            message: `Party_ID '${row.party_id}' must reference a Bank party in Parties`,
          });
        }
      }

      const openItemRows = parsedData["Open Items"] || [];
      for (const row of openItemRows) {
        if (row.party_id && !partyIdsSeen.has(row.party_id) && partyIdsSeen.size > 0) {
          issues.push({
            severity: "WARNING",
            sheet: "Open Items",
            row: row._rowNumber,
            column: "Party_ID",
            code: "E_PARTY_NOT_FOUND",
            message: `Party_ID '${row.party_id}' not found in Parties`,
          });
        }

        if (row.outstanding_amount !== null && row.outstanding_amount <= 0) {
          issues.push({
            severity: "ERROR",
            sheet: "Open Items",
            row: row._rowNumber,
            column: "Outstanding_Amount",
            code: "E_OUTSTANDING_AMOUNT_INVALID",
            message: "Outstanding_Amount must be greater than 0",
          });
        }
      }

      const errorCount = issues.filter((i) => i.severity === "ERROR").length;
      const warnCount = issues.filter((i) => i.severity === "WARNING").length;

      const summary = {
        mode: importMode,
        fileName: req.file.originalname,
        sheets: detectedSheets.map((d) => ({
          name: d.name,
          mappedTo: d.config.name,
          rowCount: (parsedData[d.config.name] || []).length,
        })),
        totals: {
          tbRows: tbRows.length,
          glRows: glRows.length,
          partyRows: partyRows.length,
          bankAccountRows: bankAccountRows.length,
          openItemRows: openItemRows.length,
        },
        validation: {
          errorCount,
          warnCount,
          isValid: errorCount === 0,
        },
        issues: issues.slice(0, 500),
      };

      if (importMode === "COMMIT" && errorCount > 0) {
        return res.status(400).json({
          error: "Validation failed. Cannot commit with errors.",
          ...summary,
        });
      }

      // COMMIT mode: persist data to database
      if (importMode === "COMMIT" && errorCount === 0) {
        const importCounts = {
          coaAccounts: 0,
          tbLines: 0,
          glLines: 0,
          parties: 0,
          bankAccounts: 0,
          openItems: 0,
        };

        try {
          // Create ImportBatch for the Import* tables (used by data tabs)
          const batchNumber = `WB-${Date.now()}`;
          const importBatch = await prisma.importBatch.create({
            data: {
              engagementId,
              batchNumber,
              fileName: req.file.originalname,
              fileSize: req.file.size,
              status: "APPROVED",
              totalRows: tbRows.length + glRows.length + partyRows.length + bankAccountRows.length + openItemRows.length,
              processedRows: tbRows.length + glRows.length + partyRows.length + bankAccountRows.length + openItemRows.length,
              obAccountCount: tbRows.filter((r: any) => r.opening_balance).length,
              cbAccountCount: tbRows.length,
              glLineCount: glRows.length,
              obPartyCount: 0,
              cbPartyCount: partyRows.length,
              bankMasterCount: bankAccountRows.length,
              cbBankCount: bankAccountRows.length,
              uploadedById: req.user!.id,
            },
          });

          // 1. Upsert COA accounts from Trial Balance data
          const uniqueGlCodes = new Set<string>();
          for (const row of tbRows) {
            if (row.gl_code && !uniqueGlCodes.has(row.gl_code)) {
              uniqueGlCodes.add(row.gl_code);
              const openingBalance = row.opening_balance || 0;
              const debit = row.debit || 0;
              const credit = row.credit || 0;
              const closingBalance = openingBalance + debit - credit;
              
              await prisma.coAAccount.upsert({
                where: {
                  engagementId_accountCode: {
                    engagementId,
                    accountCode: row.gl_code,
                  },
                },
                update: {
                  openingBalance: openingBalance,
                  periodDr: debit,
                  periodCr: credit,
                  closingBalance: closingBalance,
                  updatedAt: new Date(),
                },
                create: {
                  engagementId,
                  accountCode: row.gl_code,
                  accountName: row.gl_name || `Account ${row.gl_code}`,
                  nature: debit >= credit ? "DR" : "CR",
                  openingBalance: openingBalance,
                  periodDr: debit,
                  periodCr: credit,
                  closingBalance: closingBalance,
                },
              });
              importCounts.coaAccounts++;
            }
          }

          // 2. Create TrialBalance and TrialBalanceLines + ImportAccountBalance
          if (tbRows.length > 0) {
            const existingTB = await prisma.trialBalance.findFirst({
              where: { engagementId },
              orderBy: { createdAt: 'desc' },
            });

            const trialBalance = existingTB || await prisma.trialBalance.create({
              data: {
                engagementId,
                periodEnd: defaultPeriodEnd,
                importedById: req.user!.id,
                sourceFile: req.file.originalname,
              },
            });

            // Delete existing lines and insert new ones
            await prisma.trialBalanceLine.deleteMany({
              where: { trialBalanceId: trialBalance.id },
            });

            // Also delete existing ImportAccountBalance for this engagement
            await prisma.importAccountBalance.deleteMany({
              where: { engagementId },
            });

            for (const row of tbRows) {
              if (row.gl_code) {
                const openingBalance = row.opening_balance || 0;
                const debit = row.debit || 0;
                const credit = row.credit || 0;
                const closingBalance = openingBalance + debit - credit;
                const periodEndDate = row.reporting_period_end_date || defaultPeriodEnd;

                await prisma.trialBalanceLine.create({
                  data: {
                    trialBalanceId: trialBalance.id,
                    accountCode: row.gl_code,
                    accountName: row.gl_name || `Account ${row.gl_code}`,
                    openingBalance: openingBalance,
                    debits: debit,
                    credits: credit,
                    closingBalance: closingBalance,
                  },
                });

                // Also save to ImportAccountBalance (CB record - for data tabs)
                // Auto-classify the account using rules engine
                const classification = classifyAccount(row.gl_code, row.gl_name || '') 
                  || getDefaultClassificationForCode(row.gl_code);
                
                await prisma.importAccountBalance.create({
                  data: {
                    batchId: importBatch.id,
                    engagementId,
                    accountCode: row.gl_code,
                    accountName: row.gl_name || `Account ${row.gl_code}`,
                    accountClass: classification.accountClass,
                    accountSubclass: classification.accountSubclass,
                    fsHeadKey: classification.fsHeadKey,
                    classificationSource: classification.source,
                    classificationConfidence: classification.confidence,
                    balanceType: "CB",
                    asOfDate: periodEndDate,
                    debitAmount: closingBalance >= 0 ? closingBalance : 0,
                    creditAmount: closingBalance < 0 ? Math.abs(closingBalance) : 0,
                  },
                });

                importCounts.tbLines++;
              }
            }
          }

          // 3. Create GLBatch/GLEntries + ImportJournalHeader/ImportJournalLine
          if (glRows.length > 0) {
            const existingBatch = await prisma.gLBatch.findFirst({
              where: { engagementId },
              orderBy: { createdAt: 'desc' },
            });

            const glBatch = existingBatch || await prisma.gLBatch.create({
              data: {
                engagementId,
                firmId: req.user!.firmId || '',
                batchName: `Workbook Import ${new Date().toISOString().split('T')[0]}`,
                batchNumber: Date.now() % 1000000,
                periodStart: new Date(defaultPeriodEnd.getFullYear(), 0, 1),
                periodEnd: defaultPeriodEnd,
                fiscalYear: defaultPeriodEnd.getFullYear(),
                sourceFileName: req.file.originalname,
                uploadedById: req.user!.id,
                totalDebits: 0,
                totalCredits: 0,
                entryCount: 0,
              },
            });

            // Delete existing entries for this batch
            await prisma.gLEntry.deleteMany({
              where: { batchId: glBatch.id },
            });

            // Delete existing ImportJournalHeader/Line for this engagement
            await prisma.importJournalHeader.deleteMany({
              where: { engagementId },
            });

            // Group GL rows by voucher_no to create journal headers
            const voucherGroups = new Map<string, any[]>();
            for (const row of glRows) {
              const voucherNo = row.voucher_no || `JV-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
              if (!voucherGroups.has(voucherNo)) {
                voucherGroups.set(voucherNo, []);
              }
              voucherGroups.get(voucherNo)!.push(row);
            }

            let rowIdx = 0;
            for (const [voucherNo, lines] of voucherGroups) {
              const firstLine = lines[0];
              const postingDate = firstLine.posting_date || defaultPeriodEnd;
              const totalDebit = lines.reduce((sum: number, l: any) => sum + (l.debit || 0), 0);
              const totalCredit = lines.reduce((sum: number, l: any) => sum + (l.credit || 0), 0);

              // Create ImportJournalHeader
              const journalHeader = await prisma.importJournalHeader.create({
                data: {
                  batchId: importBatch.id,
                  engagementId,
                  journalId: voucherNo,
                  voucherNo,
                  voucherType: firstLine.voucher_type || "JV",
                  voucherDate: postingDate,
                  periodKey: `${postingDate.getFullYear()}-${String(postingDate.getMonth() + 1).padStart(2, '0')}`,
                  sourceModule: firstLine.source_module || "WORKBOOK",
                  narration: firstLine.narration,
                  totalDebit,
                  totalCredit,
                  isBalanced: Math.abs(totalDebit - totalCredit) < 0.01,
                  lineCount: lines.length,
                },
              });

              // Create ImportJournalLine and GLEntry for each line
              for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
                const row = lines[lineIdx];
                if (row.gl_code) {
                  await prisma.importJournalLine.create({
                    data: {
                      journalHeaderId: journalHeader.id,
                      lineNo: lineIdx + 1,
                      accountCode: row.gl_code,
                      accountName: row.gl_name,
                      debit: row.debit || 0,
                      credit: row.credit || 0,
                      partyCode: row.party_id,
                      partyType: row.party_type,
                      documentNo: row.document_no,
                      costCenter: row.cost_center,
                      project: row.project,
                      currency: row.currency || defaultCurrency,
                      narration: row.narration,
                    },
                  });

                  await prisma.gLEntry.create({
                    data: {
                      batchId: glBatch.id,
                      engagementId,
                      accountCode: row.gl_code,
                      accountName: row.gl_name || `Account ${row.gl_code}`,
                      transactionDate: row.posting_date || defaultPeriodEnd,
                      debit: row.debit || 0,
                      credit: row.credit || 0,
                      voucherNumber: voucherNo,
                      documentType: row.voucher_type || null,
                      narrative: row.narration || null,
                      referenceNumber: row.document_no || null,
                      localCurrency: row.currency || defaultCurrency,
                      rowNumber: rowIdx + 1,
                      transactionMonth: (row.posting_date || defaultPeriodEnd).getMonth() + 1,
                      transactionYear: (row.posting_date || defaultPeriodEnd).getFullYear(),
                    },
                  });
                  rowIdx++;
                  importCounts.glLines++;
                }
              }
            }

            // Update batch totals
            const totals = await prisma.gLEntry.aggregate({
              where: { batchId: glBatch.id },
              _sum: { debit: true, credit: true },
              _count: true,
            });

            await prisma.gLBatch.update({
              where: { id: glBatch.id },
              data: {
                entryCount: totals._count,
                totalDebits: totals._sum.debit || 0,
                totalCredits: totals._sum.credit || 0,
              },
            });
          }

          // 4. Save Parties to ImportPartyBalance
          if (partyRows.length > 0) {
            await prisma.importPartyBalance.deleteMany({
              where: { engagementId },
            });

            for (const row of partyRows) {
              if (row.party_id) {
                const partyType = (row.party_type || "OTHER").toUpperCase();
                const normalizedType = partyType === "VENDOR" ? "VENDOR" : 
                                       partyType === "CUSTOMER" ? "CUSTOMER" : 
                                       partyType === "BANK" ? "BANK" : "OTHER";

                await prisma.importPartyBalance.create({
                  data: {
                    batchId: importBatch.id,
                    engagementId,
                    partyCode: row.party_id,
                    partyName: row.legal_name,
                    partyType: normalizedType,
                    controlAccountCode: row.gl_code || "",
                    balanceType: "CB",
                    asOfDate: defaultPeriodEnd,
                    balance: 0,
                    drcr: normalizedType === "CUSTOMER" ? "DR" : "CR",
                    partyEmail: row.email,
                    partyAddress: row.address_line1,
                  },
                });
                importCounts.parties++;
              }
            }
          }

          // 5. Save Bank Accounts to ImportBankAccount
          if (bankAccountRows.length > 0) {
            await prisma.importBankAccount.deleteMany({
              where: { engagementId },
            });

            for (const row of bankAccountRows) {
              if (row.bank_account_id) {
                await prisma.importBankAccount.create({
                  data: {
                    batchId: importBatch.id,
                    engagementId,
                    bankAccountCode: row.bank_account_id,
                    bankName: row.gl_name || row.party_id || "Bank",
                    accountNo: row.account_number || "",
                    accountTitle: row.gl_name || row.bank_account_id,
                    iban: row.iban,
                    currency: row.currency || defaultCurrency,
                    bankEmail: row.confirmation_email_or_address,
                  },
                });
                importCounts.bankAccounts++;
              }
            }
          }

          // 6. Aggregate Open Items by party and update ImportPartyBalance with totals
          if (openItemRows.length > 0) {
            // Group open items by party_id
            const partyTotals = new Map<string, { balance: number; isDebtor: boolean; glCode: string; asOfDate: Date }>();
            
            for (const row of openItemRows) {
              if (row.party_id) {
                const isDebtor = (row.population_type || "").toLowerCase() === "debtors";
                const existing = partyTotals.get(row.party_id);
                const amount = row.outstanding_amount || 0;
                
                if (existing) {
                  existing.balance += amount;
                } else {
                  partyTotals.set(row.party_id, {
                    balance: amount,
                    isDebtor,
                    glCode: row.gl_code || "",
                    asOfDate: row.document_date || defaultPeriodEnd,
                  });
                }
                importCounts.openItems++;
              }
            }

            // Update or create party balances with aggregated totals
            for (const [partyId, data] of partyTotals) {
              const partyType = data.isDebtor ? "CUSTOMER" : "VENDOR";
              
              await prisma.importPartyBalance.upsert({
                where: {
                  engagementId_partyCode_balanceType: {
                    engagementId,
                    partyCode: partyId,
                    balanceType: "CB",
                  },
                },
                update: {
                  balance: data.balance,
                  controlAccountCode: data.glCode || undefined,
                },
                create: {
                  batchId: importBatch.id,
                  engagementId,
                  partyCode: partyId,
                  partyName: partyId,
                  partyType,
                  controlAccountCode: data.glCode,
                  balanceType: "CB",
                  asOfDate: data.asOfDate,
                  balance: data.balance,
                  drcr: data.isDebtor ? "DR" : "CR",
                },
              });
            }
          }

          // 7. Auto-generate Phase 1 output records after successful TB/GL import
          let outputGenerationResult = null;
          try {
            if (tbRows.length > 0 || glRows.length > 0) {
              outputGenerationResult = await generatePhase1Outputs(engagementId, req.user!.id);

              // Additionally generate bank-specific confirmations if we have bank account data
              if (bankAccountRows.length > 0) {
                const bankConfirmResult = await generateBankConfirmationOutputs(
                  engagementId,
                  req.user!.id,
                  bankAccountRows.map((row: any) => ({
                    bankAccountId: row.bank_account_id,
                    partyId: row.party_id,
                    bankName: row.gl_name || row.party_id,
                  }))
                );
                if (outputGenerationResult) {
                  outputGenerationResult.outputsCreated += bankConfirmResult.outputsCreated;
                  outputGenerationResult.outputsSkipped += bankConfirmResult.outputsSkipped;
                  outputGenerationResult.details.push(...bankConfirmResult.details);
                }
              }
            }
          } catch (outputError: any) {
            console.error("Error generating Phase 1 outputs:", outputError);
          }

          return res.json({
            ...summary,
            importCounts,
            outputGeneration: outputGenerationResult,
            message: `Successfully imported: ${importCounts.coaAccounts} COA accounts, ${importCounts.tbLines} TB lines, ${importCounts.glLines} GL entries${outputGenerationResult ? `. Created ${outputGenerationResult.outputsCreated} output records.` : ""}`,
          });
        } catch (dbError: any) {
          console.error("Database import error:", dbError);
          return res.status(500).json({
            error: "Database import failed",
            details: dbError.message,
            ...summary,
          });
        }
      }

      res.json(summary);
    } catch (error) {
      console.error("Error processing workbook import:", error);
      res.status(500).json({ error: "Failed to process workbook import" });
    }
  }
);

// ============================================================================
// GET - View imported workbook data summary
// ============================================================================
router.get("/engagements/:engagementId/imports/workbook", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;

    // Get Trial Balance data
    const trialBalance = await prisma.trialBalance.findFirst({
      where: { engagementId },
    });

    // Get TB line count and totals directly from database for accuracy
    let tbLineCount = 0;
    let tbTotalDebit = 0;
    let tbTotalCredit = 0;
    
    if (trialBalance) {
      const tbStats = await prisma.trialBalanceLine.aggregate({
        where: { trialBalanceId: trialBalance.id },
        _count: true,
        _sum: { debits: true, credits: true },
      });
      tbLineCount = tbStats._count;
      tbTotalDebit = Number(tbStats._sum.debits || 0);
      tbTotalCredit = Number(tbStats._sum.credits || 0);
    }

    // Get GL Batch data
    const glBatch = await prisma.gLBatch.findFirst({
      where: { engagementId },
    });

    // Get GL entry count and totals directly from database for accuracy
    let glEntryCount = 0;
    let glTotalDebit = 0;
    let glTotalCredit = 0;
    
    if (glBatch) {
      const glStats = await prisma.gLEntry.aggregate({
        where: { batchId: glBatch.id },
        _count: true,
        _sum: { debit: true, credit: true },
      });
      glEntryCount = glStats._count;
      glTotalDebit = Number(glStats._sum.debit || 0);
      glTotalCredit = Number(glStats._sum.credit || 0);
    }

    // Get COA accounts count
    const coaCount = await prisma.coAAccount.count({
      where: { engagementId },
    });

    res.json({
      success: true,
      data: {
        trialBalance: trialBalance ? {
          id: trialBalance.id,
          periodEndDate: trialBalance.periodEnd,
          lineCount: tbLineCount,
          totalDebit: tbTotalDebit,
          totalCredit: tbTotalCredit,
        } : null,
        glBatch: glBatch ? {
          id: glBatch.id,
          entryCount: glEntryCount,
          totalDebit: glTotalDebit,
          totalCredit: glTotalCredit,
        } : null,
        coaAccounts: {
          count: coaCount,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching workbook data:", error);
    res.status(500).json({ error: "Failed to fetch workbook data" });
  }
});

// ============================================================================
// DELETE - Clear all workbook-imported data for an engagement
// ============================================================================
router.delete("/engagements/:engagementId/imports/workbook", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const { target } = req.query; // Optional: 'tb', 'gl', 'coa', 'all'

    const deleteCounts = {
      tbLines: 0,
      glEntries: 0,
      coaAccounts: 0,
    };

    // Delete based on target or all
    if (!target || target === "all" || target === "tb") {
      // Delete Trial Balance and line items
      const trialBalance = await prisma.trialBalance.findFirst({
        where: { engagementId },
      });
      if (trialBalance) {
        const deleted = await prisma.trialBalanceLine.deleteMany({
          where: { trialBalanceId: trialBalance.id },
        });
        deleteCounts.tbLines = deleted.count;
        await prisma.trialBalance.delete({
          where: { id: trialBalance.id },
        });
      }
    }

    if (!target || target === "all" || target === "gl") {
      // Delete GL entries and batch
      const glBatch = await prisma.gLBatch.findFirst({
        where: { engagementId },
      });
      if (glBatch) {
        const deleted = await prisma.gLEntry.deleteMany({
          where: { batchId: glBatch.id },
        });
        deleteCounts.glEntries = deleted.count;
        await prisma.gLBatch.delete({
          where: { id: glBatch.id },
        });
      }
    }

    if (!target || target === "all" || target === "coa") {
      // Delete COA accounts (optional - careful as this affects other modules)
      const deleted = await prisma.coAAccount.deleteMany({
        where: { engagementId },
      });
      deleteCounts.coaAccounts = deleted.count;
    }

    res.json({
      success: true,
      message: "Workbook data deleted successfully",
      deleteCounts,
    });
  } catch (error) {
    console.error("Error deleting workbook data:", error);
    res.status(500).json({ error: "Failed to delete workbook data" });
  }
});

// ============================================================================
// GET - List TB line items with pagination
// ============================================================================
router.get("/engagements/:engagementId/imports/tb-lines", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const skip = (page - 1) * limit;

    const trialBalance = await prisma.trialBalance.findFirst({
      where: { engagementId },
    });

    if (!trialBalance) {
      return res.json({ items: [], total: 0, page, limit });
    }

    const [items, total] = await Promise.all([
      prisma.trialBalanceLine.findMany({
        where: { trialBalanceId: trialBalance.id },
        skip,
        take: limit,
        orderBy: { accountCode: "asc" },
      }),
      prisma.trialBalanceLine.count({
        where: { trialBalanceId: trialBalance.id },
      }),
    ]);

    res.json({ items, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    console.error("Error fetching TB lines:", error);
    res.status(500).json({ error: "Failed to fetch TB lines" });
  }
});

// ============================================================================
// GET - List GL entries with pagination
// ============================================================================
router.get("/engagements/:engagementId/imports/gl-entries", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const skip = (page - 1) * limit;

    const glBatch = await prisma.gLBatch.findFirst({
      where: { engagementId },
    });

    if (!glBatch) {
      return res.json({ items: [], total: 0, page, limit });
    }

    const [items, total] = await Promise.all([
      prisma.gLEntry.findMany({
        where: { batchId: glBatch.id },
        skip,
        take: limit,
        orderBy: { transactionDate: "desc" },
      }),
      prisma.gLEntry.count({
        where: { batchId: glBatch.id },
      }),
    ]);

    res.json({ items, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    console.error("Error fetching GL entries:", error);
    res.status(500).json({ error: "Failed to fetch GL entries" });
  }
});

// ============================================================================
// PATCH - Update a single TB line item
// ============================================================================
router.patch("/engagements/:engagementId/imports/tb-lines/:lineId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { lineId } = req.params;
    
    const parseResult = tbLineUpdateSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: "Validation failed", details: parseResult.error.errors });
    }
    
    const { accountCode, accountName, debit, credit, openingBalance, closingBalance } = parseResult.data;

    const updated = await prisma.trialBalanceLine.update({
      where: { id: lineId },
      data: {
        ...(accountCode !== undefined && { accountCode }),
        ...(accountName !== undefined && { accountName }),
        ...(debit !== undefined && { debits: debit }),
        ...(credit !== undefined && { credits: credit }),
        ...(openingBalance !== undefined && { openingBalance }),
        ...(closingBalance !== undefined && { closingBalance }),
      },
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error("Error updating TB line:", error);
    res.status(500).json({ error: "Failed to update TB line" });
  }
});

// ============================================================================
// DELETE - Delete a single TB line item
// ============================================================================
router.delete("/engagements/:engagementId/imports/tb-lines/:lineId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { lineId } = req.params;

    await prisma.trialBalanceLine.delete({
      where: { id: lineId },
    });

    res.json({ success: true, message: "TB line deleted" });
  } catch (error) {
    console.error("Error deleting TB line:", error);
    res.status(500).json({ error: "Failed to delete TB line" });
  }
});

// ============================================================================
// PATCH - Update a single GL entry
// ============================================================================
router.patch("/engagements/:engagementId/imports/gl-entries/:entryId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { entryId } = req.params;
    
    const parseResult = glEntryUpdateSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: "Validation failed", details: parseResult.error.errors });
    }
    
    const { accountCode, accountName, debit, credit, transactionDate, voucherNumber, narrative } = parseResult.data;

    const updated = await prisma.gLEntry.update({
      where: { id: entryId },
      data: {
        ...(accountCode !== undefined && { accountCode }),
        ...(accountName !== undefined && { accountName }),
        ...(debit !== undefined && { debit }),
        ...(credit !== undefined && { credit }),
        ...(transactionDate !== undefined && { transactionDate: new Date(transactionDate) }),
        ...(voucherNumber !== undefined && { voucherNumber }),
        ...(narrative !== undefined && { narrative }),
      },
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error("Error updating GL entry:", error);
    res.status(500).json({ error: "Failed to update GL entry" });
  }
});

// ============================================================================
// DELETE - Delete a single GL entry
// ============================================================================
router.delete("/engagements/:engagementId/imports/gl-entries/:entryId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { entryId } = req.params;

    await prisma.gLEntry.delete({
      where: { id: entryId },
    });

    res.json({ success: true, message: "GL entry deleted" });
  } catch (error) {
    console.error("Error deleting GL entry:", error);
    res.status(500).json({ error: "Failed to delete GL entry" });
  }
});

// ============================================================================
// POST - Add new TB line item
// ============================================================================
router.post("/engagements/:engagementId/imports/tb-lines", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    
    const parseResult = tbLineCreateSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: "Validation failed", details: parseResult.error.errors });
    }
    
    const { accountCode, accountName, debit, credit, openingBalance, closingBalance } = parseResult.data;

    // Fetch engagement to get firmId and fiscalYearEnd
    const engagement = await prisma.engagement.findUnique({
      where: { id: engagementId },
      select: { firmId: true, fiscalYearEnd: true },
    });
    
    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }
    
    const periodEnd = engagement.fiscalYearEnd || new Date();

    // Find or create trial balance
    let trialBalance = await prisma.trialBalance.findFirst({
      where: { engagementId },
    });

    if (!trialBalance) {
      trialBalance = await prisma.trialBalance.create({
        data: {
          engagementId,
          periodEnd,
          importedById: req.user!.id,
        },
      });
    }

    const created = await prisma.trialBalanceLine.create({
      data: {
        trialBalanceId: trialBalance.id,
        accountCode,
        accountName: accountName || `Account ${accountCode}`,
        debits: debit || 0,
        credits: credit || 0,
        openingBalance: openingBalance || 0,
        closingBalance: closingBalance || 0,
      },
    });

    res.json({ success: true, data: created });
  } catch (error) {
    console.error("Error creating TB line:", error);
    res.status(500).json({ error: "Failed to create TB line" });
  }
});

// ============================================================================
// POST - Add new GL entry
// ============================================================================
router.post("/engagements/:engagementId/imports/gl-entries", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    
    const parseResult = glEntryCreateSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: "Validation failed", details: parseResult.error.errors });
    }
    
    const { accountCode, accountName, debit, credit, transactionDate, voucherNumber, narrative } = parseResult.data;

    // Fetch engagement to get firmId and fiscalYearEnd
    const engagement = await prisma.engagement.findUnique({
      where: { id: engagementId },
      select: { firmId: true, fiscalYearEnd: true },
    });
    
    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }
    
    const periodEnd = engagement.fiscalYearEnd || new Date();
    const fiscalYear = periodEnd.getFullYear();

    // Find or create GL batch
    let glBatch = await prisma.gLBatch.findFirst({
      where: { engagementId },
    });

    if (!glBatch) {
      glBatch = await prisma.gLBatch.create({
        data: {
          engagementId,
          batchName: `Workbook Import - ${new Date().toISOString().split("T")[0]}`,
          batchNumber: Date.now() % 1000000,
          uploadedById: req.user!.id,
          firmId: engagement.firmId,
          periodStart: new Date(periodEnd.getFullYear(), 0, 1),
          periodEnd,
          fiscalYear,
          status: "APPROVED",
          entryCount: 0,
          totalDebits: 0,
          totalCredits: 0,
        },
      });
    }

    const txDate = transactionDate ? new Date(transactionDate) : new Date();
    
    const created = await prisma.gLEntry.create({
      data: {
        batchId: glBatch.id,
        engagementId,
        accountCode,
        accountName: accountName || `Account ${accountCode}`,
        transactionDate: txDate,
        debit: debit || 0,
        credit: credit || 0,
        voucherNumber: voucherNumber || null,
        narrative: narrative || null,
        localCurrency: "PKR",
        rowNumber: 0,
        transactionMonth: txDate.getMonth() + 1,
        transactionYear: txDate.getFullYear(),
      },
    });

    // Update batch totals
    await prisma.gLBatch.update({
      where: { id: glBatch.id },
      data: {
        entryCount: { increment: 1 },
        totalDebits: { increment: debit || 0 },
        totalCredits: { increment: credit || 0 },
      },
    });

    res.json({ success: true, data: created });
  } catch (error) {
    console.error("Error creating GL entry:", error);
    res.status(500).json({ error: "Failed to create GL entry" });
  }
});

// ============================================================================
// GET - Fetch imported parties data
// ============================================================================
router.get("/parties/:engagementId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;

    const parties = await prisma.importPartyBalance.findMany({
      where: { engagementId },
      orderBy: { partyName: 'asc' },
    });

    const formattedParties = parties.map(p => ({
      id: p.id,
      partyCode: p.partyCode,
      partyName: p.partyName,
      partyType: p.partyType,
      controlAccountCode: p.controlAccountCode,
      balanceType: p.balanceType,
      asOfDate: p.asOfDate,
      balance: Number(p.balance),
      drcr: p.drcr,
      openingBalance: p.balanceType === 'OB' ? Number(p.balance) : 0,
      currentBalance: p.balanceType === 'CB' ? Number(p.balance) : 0,
      email: p.partyEmail,
      address: p.partyAddress,
      contact: p.attentionTo,
      confirmationStatus: p.confirmationStatus,
    }));

    res.json(formattedParties);
  } catch (error) {
    console.error("Error fetching parties:", error);
    res.status(500).json({ error: "Failed to fetch parties" });
  }
});

// ============================================================================
// GET - Fetch imported bank accounts data
// ============================================================================
router.get("/bank-accounts/:engagementId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;

    const banks = await prisma.importBankAccount.findMany({
      where: { engagementId },
      include: {
        balances: true,
      },
      orderBy: { bankName: 'asc' },
    });

    const formattedBanks = banks.map(b => {
      const latestBalance = b.balances.length > 0 
        ? b.balances.sort((a, c) => c.asOfDate.getTime() - a.asOfDate.getTime())[0]
        : null;
      
      return {
        id: b.id,
        bankAccountCode: b.bankAccountCode,
        bankName: b.bankName,
        accountNo: b.accountNo,
        accountTitle: b.accountTitle,
        branchName: b.branchName,
        branchAddress: b.branchAddress,
        iban: b.iban,
        relationshipManager: b.relationshipManager,
        bankEmail: b.bankEmail,
        currency: b.currency,
        closingBalance: latestBalance ? Number(latestBalance.closingBalance) : 0,
        confirmationStatus: b.confirmationStatus,
      };
    });

    res.json(formattedBanks);
  } catch (error) {
    console.error("Error fetching bank accounts:", error);
    res.status(500).json({ error: "Failed to fetch bank accounts" });
  }
});

// ============================================================================
// GET - Fetch imported open items data
// ============================================================================
router.get("/open-items/:engagementId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;

    // Check if OpenItem model exists, otherwise return empty array
    // Open items might be stored in a different table or as part of party balances
    const parties = await prisma.importPartyBalance.findMany({
      where: { 
        engagementId,
        balanceType: 'CB',
      },
      orderBy: { partyName: 'asc' },
    });

    // Format as open items (outstanding balances)
    const openItems = parties.map(p => ({
      id: p.id,
      partyCode: p.partyCode,
      partyName: p.partyName,
      partyType: p.partyType,
      accountCode: p.controlAccountCode,
      balance: Number(p.balance),
      drcr: p.drcr,
      asOfDate: p.asOfDate,
    }));

    res.json(openItems);
  } catch (error) {
    console.error("Error fetching open items:", error);
    res.status(500).json({ error: "Failed to fetch open items" });
  }
});

// ============================================================================
// POST - Sync import data to core audit tables (TBEntry, GLEntry, CoAAccount)
// ============================================================================
router.post("/engagements/:engagementId/imports/sync", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const userId = req.user!.id;
    const firmId = req.user!.firmId;

    if (!firmId) {
      return res.status(403).json({ error: "User not associated with a firm" });
    }

    const engagement = await prisma.engagement.findUnique({
      where: { id: engagementId },
      select: { id: true, firmId: true },
    });

    if (!engagement || engagement.firmId !== firmId) {
      return res.status(404).json({ error: "Engagement not found or access denied" });
    }

    const { syncImportDataToCore } = await import("./services/importSyncService");
    const result = await syncImportDataToCore(engagementId, userId);

    if (!result.success) {
      return res.status(400).json({ 
        error: result.error || "Sync failed",
        counts: result.counts,
      });
    }

    res.json({
      success: true,
      message: "Import data synced to core tables successfully",
      uploadVersionId: result.uploadVersionId,
      counts: result.counts,
    });
  } catch (error) {
    console.error("Error syncing import data:", error);
    res.status(500).json({ error: "Failed to sync import data to core tables" });
  }
});

export default router;
