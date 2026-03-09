import { Router, Request, Response } from "express";
import { glService } from "./services/glService";
import type { UserRole, GLEntry } from "@prisma/client";
import { prisma } from "./db";
import { requireAuth, requireMinRole } from "./auth";
import multer from "multer";
import { parse } from "csv-parse/sync";
import * as XLSX from "xlsx";

const router = Router();
const requireRole = requireMinRole;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      "text/csv",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    ];
    if (allowed.includes(file.mimetype) || file.originalname.endsWith(".csv") || file.originalname.endsWith(".xlsx") || file.originalname.endsWith(".xls")) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only CSV and Excel files are allowed."));
    }
  }
});

function getContext(req: Request) {
  const user = (req as any).user;
  return {
    userId: user?.id || "",
    userRole: user?.role as UserRole || "STAFF",
    userName: user?.fullName,
    ipAddress: req.ip,
    userAgent: req.get("user-agent")
  };
}

function parseDate(value: string): Date | null {
  if (!value) return null;
  
  // Handle DD.MM.YYYY format
  if (value.includes(".")) {
    const parts = value.split(".");
    if (parts.length === 3) {
      const [day, month, year] = parts.map(Number);
      if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
        return new Date(year, month - 1, day);
      }
    }
  }
  
  // Handle YYYY-MM-DD format
  const date = new Date(value);
  if (!isNaN(date.getTime())) {
    return date;
  }
  
  // Handle other separators
  const parts = value.split(/[-/]/);
  if (parts.length === 3) {
    const [year, month, day] = parts.map(Number);
    return new Date(year, month - 1, day);
  }
  return null;
}

function parseNumber(value: string | number): number {
  if (typeof value === "number") return value;
  const cleaned = value?.toString().replace(/[,$\s]/g, "") || "0";
  return parseFloat(cleaned) || 0;
}

function parseGLRow(row: any, rowNumber: number): any {
  // Support both old and new header formats
  const accountCode = row["GL Account Code"] || row["Account Code"] || row["accountCode"] || "";
  const accountName = row["GL Account Name"] || row["Account Name"] || row["accountName"] || "";
  
  // Parse date - support DD.MM.YYYY and other formats
  const dateValue = row["Document Date (DD.MM.YYYY)"] || row["Date (YYYY-MM-DD)"] || row["Date"] || row["transactionDate"] || "";
  const transactionDate = parseDate(dateValue) || new Date();
  
  // Parse amounts
  const debit = parseNumber(row["Debit Amount"] || row["Debit"] || row["debit"] || 0);
  const credit = parseNumber(row["Credit Amount"] || row["Credit"] || row["credit"] || 0);
  
  // Extended fields from new template
  const voucherNumber = row["Voucher Number"] || row["voucherNumber"] || "";
  const documentType = row["Document Type"] || row["documentType"] || "";
  const localCurrency = row["Local Currency"] || row["localCurrency"] || "PKR";
  const referenceNumber = row["Reference Number"] || row["Reference"] || row["reference"] || "";
  const narrative = row["Narrative"] || row["Description"] || row["description"] || "";
  const transactionMonth = parseInt(row["Month"] || row["month"] || "") || null;
  const transactionYear = parseInt(row["Year"] || row["year"] || "") || null;
  
  // Legacy fields
  const costCenter = row["Cost Center (Optional)"] || row["Cost Center"] || row["costCenter"] || "";
  const counterparty = row["Counterparty (Optional)"] || row["Counterparty"] || row["counterparty"] || "";
  
  return {
    accountCode,
    accountName,
    transactionDate,
    debit,
    credit,
    voucherNumber,
    documentType,
    localCurrency,
    referenceNumber,
    narrative,
    transactionMonth,
    transactionYear,
    description: narrative || row["Description"] || row["description"] || "",
    reference: referenceNumber || row["Reference"] || row["reference"] || "",
    costCenter,
    counterparty,
    rowNumber,
    originalRowData: row
  };
}

router.get("/template/csv", (req: Request, res: Response) => {
  const csv = glService.generateCSVTemplate();
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=gl_upload_template.csv");
  res.send(csv);
});

router.get("/template/xlsx", (req: Request, res: Response) => {
  const GL_HEADERS = [
    "GL Account Code",
    "GL Account Name",
    "Voucher Number",
    "Document Date (DD.MM.YYYY)",
    "Debit Amount",
    "Credit Amount",
    "Local Currency",
    "Document Type",
    "Reference Number",
    "Narrative",
    "Month",
    "Year"
  ];

  const GL_SAMPLE_DATA = generateGLSampleData();

  const ws = XLSX.utils.aoa_to_sheet([GL_HEADERS, ...GL_SAMPLE_DATA]);
  ws["!cols"] = [
    { wch: 18 }, { wch: 30 }, { wch: 15 }, { wch: 20 },
    { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 15 },
    { wch: 15 }, { wch: 40 }, { wch: 8 }, { wch: 8 }
  ];
  
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "General Ledger");
  
  const instructionsData = [
    ["GENERAL LEDGER (GL) TEMPLATE INSTRUCTIONS"],
    [""],
    ["Column Definitions:"],
    ["- GL Account Code (Required): Unique identifier matching Trial Balance account codes"],
    ["- GL Account Name (Required): Descriptive name of the account"],
    ["- Voucher Number (Required): Journal entry or voucher reference number"],
    ["- Document Date (Required): Transaction date in DD.MM.YYYY format"],
    ["- Debit Amount: Transaction debit amount (use 0 if credit entry)"],
    ["- Credit Amount: Transaction credit amount (use 0 if debit entry)"],
    ["- Local Currency: Currency code (e.g., PKR, USD, EUR)"],
    ["- Document Type: Type of document (JV, PV, RV, BPV, BRV, etc.)"],
    ["- Reference Number: External document reference"],
    ["- Narrative: Transaction description/narration"],
    ["- Month: Numeric month (1-12)"],
    ["- Year: Four-digit year (e.g., 2025)"],
    [""],
    ["Document Type Codes:"],
    ["- JV: Journal Voucher"],
    ["- PV: Payment Voucher"],
    ["- RV: Receipt Voucher"],
    ["- BPV: Bank Payment Voucher"],
    ["- BRV: Bank Receipt Voucher"],
    ["- SV: Sales Voucher"],
    ["- PUR: Purchase Voucher"],
    [""],
    ["Data Entry Rules:"],
    ["1. Each row represents a single GL entry/line"],
    ["2. Debit and Credit should not both have values in same row"],
    ["3. Use positive numbers only"],
    ["4. Do not include currency symbols in amount fields"],
    ["5. Account codes must match Trial Balance exactly for reconciliation"],
    ["6. Do not modify the header row"],
    [""],
    ["After completing entry:"],
    ["1. Save the file as .xlsx or .csv format"],
    ["2. Upload using the General Ledger Upload section"],
    ["3. System will validate entries against Trial Balance"]
  ];
  
  const wsInstructions = XLSX.utils.aoa_to_sheet(instructionsData);
  wsInstructions["!cols"] = [{ wch: 80 }];
  XLSX.utils.book_append_sheet(wb, wsInstructions, "Instructions");

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", "attachment; filename=gl_template.xlsx");
  res.send(buffer);
});

function generateGLSampleData(): any[][] {
  const data: any[][] = [];
  const accounts = [
    { code: "1001", name: "Cash in Hand" },
    { code: "1002", name: "Bank - Current Account" },
    { code: "1010", name: "Trade Receivables" },
    { code: "1020", name: "Inventory - Raw Materials" },
    { code: "2001", name: "Trade Payables" },
    { code: "4001", name: "Sales Revenue - Domestic" },
    { code: "4002", name: "Sales Revenue - Export" },
    { code: "5001", name: "Cost of Goods Sold" },
    { code: "5010", name: "Salaries & Wages" },
    { code: "5020", name: "Rent Expense" },
    { code: "5021", name: "Utilities Expense" },
    { code: "6010", name: "Interest Expense" }
  ];
  
  const docTypes = ["JV", "PV", "RV", "BPV", "BRV", "SV", "PUR"];
  const narratives = [
    "Cash sales for the day",
    "Received payment from customer",
    "Paid to supplier",
    "Salary payment",
    "Utility bill payment",
    "Bank charges",
    "Purchase of raw materials",
    "Office supplies purchase",
    "Professional fees paid",
    "Insurance premium payment"
  ];
  
  let voucherNum = 1;
  for (let month = 7; month <= 12; month++) {
    for (let i = 0; i < 80; i++) {
      const account = accounts[Math.floor(Math.random() * accounts.length)];
      const day = Math.floor(Math.random() * 28) + 1;
      const date = `${day.toString().padStart(2, '0')}.${month.toString().padStart(2, '0')}.2024`;
      const isDebit = Math.random() > 0.5;
      const amount = Math.floor(Math.random() * 500000) + 1000;
      const docType = docTypes[Math.floor(Math.random() * docTypes.length)];
      const narrative = narratives[Math.floor(Math.random() * narratives.length)];
      
      data.push([
        account.code,
        account.name,
        `${docType}-2024-${voucherNum.toString().padStart(5, '0')}`,
        date,
        isDebit ? amount : 0,
        isDebit ? 0 : amount,
        "PKR",
        docType,
        `REF-${voucherNum.toString().padStart(6, '0')}`,
        narrative,
        month,
        2024
      ]);
      voucherNum++;
    }
  }
  
  for (let month = 1; month <= 6; month++) {
    for (let i = 0; i < 80; i++) {
      const account = accounts[Math.floor(Math.random() * accounts.length)];
      const day = Math.floor(Math.random() * 28) + 1;
      const date = `${day.toString().padStart(2, '0')}.${month.toString().padStart(2, '0')}.2025`;
      const isDebit = Math.random() > 0.5;
      const amount = Math.floor(Math.random() * 500000) + 1000;
      const docType = docTypes[Math.floor(Math.random() * docTypes.length)];
      const narrative = narratives[Math.floor(Math.random() * narratives.length)];
      
      data.push([
        account.code,
        account.name,
        `${docType}-2025-${voucherNum.toString().padStart(5, '0')}`,
        date,
        isDebit ? amount : 0,
        isDebit ? 0 : amount,
        "PKR",
        docType,
        `REF-${voucherNum.toString().padStart(6, '0')}`,
        narrative,
        month,
        2025
      ]);
      voucherNum++;
    }
  }
  
  return data;
}

router.post("/upload/:engagementId", requireAuth, upload.single("file"), async (req: Request, res: Response) => {
  try {
    const { engagementId } = req.params;
    const { periodStart, periodEnd, fiscalYear } = req.body;
    const ctx = getContext(req);
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    if (!periodStart || !periodEnd || !fiscalYear) {
      return res.status(400).json({ error: "Period start, period end, and fiscal year are required" });
    }

    let entries: any[] = [];

    if (file.originalname.endsWith(".csv")) {
      const content = file.buffer.toString("utf-8");
      const records = parse(content, { columns: true, skip_empty_lines: true, trim: true });
      
      entries = records.map((row: any, index: number) => parseGLRow(row, index + 2));
    } else {
      const workbook = XLSX.read(file.buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

      entries = jsonData.map((row: any, index: number) => parseGLRow(row, index + 2));
    }

    if (entries.length === 0) {
      return res.status(400).json({ error: "No entries found in the uploaded file" });
    }

    const firmId = (req as any).user?.firmId;
    if (!firmId) {
      return res.status(400).json({ error: "Firm ID not found" });
    }

    const result = await glService.uploadGeneralLedger(
      engagementId,
      firmId,
      entries,
      new Date(periodStart),
      new Date(periodEnd),
      parseInt(fiscalYear),
      file.originalname,
      file.mimetype,
      ctx
    );

    res.json(result);
  } catch (error: any) {
    console.error("GL upload error:", error);
    res.status(500).json({ error: error.message || "Failed to upload GL" });
  }
});

router.get("/batches/:engagementId", async (req: Request, res: Response) => {
  try {
    const { engagementId } = req.params;
    const { includeSuperseded } = req.query;
    
    const batches = await glService.getBatchesForEngagement(
      engagementId,
      includeSuperseded === "true"
    );
    
    res.json(batches);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/batch/:batchId", async (req: Request, res: Response) => {
  try {
    const { batchId } = req.params;
    const ctx = getContext(req);
    
    const batch = await glService.getBatch(batchId, ctx);
    
    if (!batch) {
      return res.status(404).json({ error: "Batch not found" });
    }
    
    res.json(batch);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/batch/:batchId/errors", async (req: Request, res: Response) => {
  try {
    const { batchId } = req.params;
    const errors = await glService.getValidationErrors(batchId);
    res.json(errors);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/batch/:batchId/submit-for-review", requireAuth, async (req: Request, res: Response) => {
  try {
    const { batchId } = req.params;
    const ctx = getContext(req);
    
    const result = await glService.submitForReview(batchId, ctx);
    
    if (!result.success) {
      return res.status(400).json({ error: result.error, isaReference: "ISA 230 - Audit Documentation" });
    }
    
    res.json({ success: true, message: "Batch submitted for review", isaReference: "ISA 230" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/batch/:batchId/review", requireAuth, requireRole("SENIOR"), async (req: Request, res: Response) => {
  try {
    const { batchId } = req.params;
    const { approved, comments } = req.body;
    const ctx = getContext(req);
    
    const result = await glService.reviewBatch(batchId, approved, comments, ctx);
    
    if (!result.success) {
      return res.status(400).json({ error: result.error, isaReference: "ISA 220 - Quality Control" });
    }
    
    res.json({ 
      success: true, 
      message: approved ? "Batch reviewed" : "Batch review rejected",
      isaReference: "ISA 220, ISA 230"
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/batch/:batchId/submit-for-approval", requireAuth, requireRole("SENIOR"), async (req: Request, res: Response) => {
  try {
    const { batchId } = req.params;
    const ctx = getContext(req);
    
    const result = await glService.submitForApproval(batchId, ctx);
    
    if (!result.success) {
      return res.status(400).json({ error: result.error, isaReference: "ISA 220 - Quality Control" });
    }
    
    res.json({ success: true, message: "Batch submitted for partner approval", isaReference: "ISA 220" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/batch/:batchId/approve", requireAuth, requireRole("PARTNER"), async (req: Request, res: Response) => {
  try {
    const { batchId } = req.params;
    const { partnerPin, comments } = req.body;
    const ctx = getContext(req);
    
    const result = await glService.approveBatch(batchId, partnerPin, comments, ctx);
    
    if (!result.success) {
      return res.status(400).json({ 
        error: result.error,
        isaReference: "ISA 220 - Quality Control, ISA 500 - Audit Evidence"
      });
    }
    
    res.json({ 
      success: true, 
      message: "Batch approved and locked",
      isaReference: "ISA 220, ISA 500, ISA 230"
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/batch/:batchId/reject", requireAuth, requireRole("PARTNER"), async (req: Request, res: Response) => {
  try {
    const { batchId } = req.params;
    const { comments } = req.body;
    const ctx = getContext(req);
    
    if (!comments) {
      return res.status(400).json({ error: "Comments are required for rejection", isaReference: "ISA 230" });
    }
    
    const result = await glService.rejectApproval(batchId, comments, ctx);
    
    if (!result.success) {
      return res.status(400).json({ error: result.error, isaReference: "ISA 220" });
    }
    
    res.json({ success: true, message: "Batch rejected", isaReference: "ISA 220, ISA 230" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/batch/:batchId/change-request", requireAuth, requireRole("MANAGER"), async (req: Request, res: Response) => {
  try {
    const { batchId } = req.params;
    const { reason } = req.body;
    const ctx = getContext(req);
    
    if (!reason) {
      return res.status(400).json({ error: "Reason is required for change request", isaReference: "ISA 230" });
    }
    
    const result = await glService.requestChangeToApprovedBatch(batchId, reason, ctx);
    
    if (!result.success) {
      return res.status(400).json({ error: result.error, isaReference: "ISA 230" });
    }
    
    res.json({ 
      success: true, 
      newBatchId: result.newBatchId, 
      message: "Change request created",
      isaReference: "ISA 230 - Audit Documentation"
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/batch/:batchId/detect-duplicates", async (req: Request, res: Response) => {
  try {
    const { batchId } = req.params;
    const ctx = getContext(req);
    
    const duplicates = await glService.detectDuplicates(batchId, ctx);
    
    res.json({ duplicates, count: duplicates.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/entry/:entryId/override-duplicate", async (req: Request, res: Response) => {
  try {
    const { entryId } = req.params;
    const { reason } = req.body;
    const ctx = getContext(req);
    
    if (!reason) {
      return res.status(400).json({ error: "Reason is required for duplicate override" });
    }
    
    const result = await glService.overrideDuplicate(entryId, reason, ctx);
    
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    
    res.json({ success: true, message: "Duplicate override applied" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/batch/:batchId/generate-clusters", async (req: Request, res: Response) => {
  try {
    const { batchId } = req.params;
    const ctx = getContext(req);
    
    const clusters = await glService.generateClusterSuggestions(batchId, ctx);
    
    res.json({ clusters, count: clusters.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/batch/:batchId/clusters", async (req: Request, res: Response) => {
  try {
    const { batchId } = req.params;
    const clusters = await glService.getClusterPreview(batchId);
    res.json(clusters);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/cluster/:clusterId/review", async (req: Request, res: Response) => {
  try {
    const { clusterId } = req.params;
    const { action, notes } = req.body;
    const ctx = getContext(req);
    
    if (!["ACCEPT", "REJECT", "MERGE"].includes(action)) {
      return res.status(400).json({ error: "Invalid action. Must be ACCEPT, REJECT, or MERGE" });
    }
    
    const result = await glService.reviewCluster(clusterId, action, notes, ctx);
    
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    
    res.json({ success: true, message: `Cluster ${action.toLowerCase()}ed` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/error/:errorId/resolve", async (req: Request, res: Response) => {
  try {
    const { errorId } = req.params;
    const { notes } = req.body;
    const ctx = getContext(req);
    
    if (!notes) {
      return res.status(400).json({ error: "Resolution notes are required" });
    }
    
    const result = await glService.resolveValidationError(errorId, notes, ctx);
    
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    
    res.json({ success: true, message: "Validation error resolved" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/batch/:batchId/audit-log", async (req: Request, res: Response) => {
  try {
    const { batchId } = req.params;
    const logs = await glService.getAuditLog(batchId);
    res.json(logs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/parse/:engagementId", requireAuth, upload.single("file"), async (req: Request, res: Response) => {
  try {
    const file = req.file;
    
    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    
    let columns: string[] = [];
    let sampleData: Record<string, string>[] = [];
    let rowCount = 0;
    
    if (file.originalname.endsWith(".csv")) {
      const content = file.buffer.toString("utf-8");
      const records = parse(content, { columns: true, skip_empty_lines: true, trim: true }) as Record<string, string>[];
      
      if (records.length > 0) {
        columns = Object.keys(records[0] as object);
        rowCount = records.length;
        sampleData = records.slice(0, 5).map((row: any) => {
          const sample: Record<string, string> = {};
          columns.forEach(col => {
            sample[col] = String(row[col] || "");
          });
          return sample;
        });
      }
    } else {
      const workbook = XLSX.read(file.buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
      
      if (jsonData.length > 0) {
        columns = Object.keys(jsonData[0] as object);
        rowCount = jsonData.length;
        sampleData = jsonData.slice(0, 5).map((row: any) => {
          const sample: Record<string, string> = {};
          columns.forEach(col => {
            sample[col] = String(row[col] || "");
          });
          return sample;
        });
      }
    }
    
    const suggestedMappings: Record<string, string> = {};
    columns.forEach(col => {
      const lower = col.toLowerCase();
      if (lower.includes("account") && lower.includes("code")) suggestedMappings[col] = "accountCode";
      else if (lower.includes("account") && (lower.includes("name") || lower.includes("desc"))) suggestedMappings[col] = "accountName";
      else if (lower.includes("debit")) suggestedMappings[col] = "debit";
      else if (lower.includes("credit")) suggestedMappings[col] = "credit";
      else if (lower.includes("balance")) suggestedMappings[col] = "balance";
      else if (lower.includes("opening")) suggestedMappings[col] = "openingBalance";
      else if (lower.includes("closing")) suggestedMappings[col] = "closingBalance";
      else if (lower.includes("cost") && lower.includes("center")) suggestedMappings[col] = "costCenter";
      else if (lower.includes("department")) suggestedMappings[col] = "department";
      else if (lower.includes("currency")) suggestedMappings[col] = "currency";
    });
    
    res.json({
      columns,
      sampleData,
      rowCount,
      suggestedMappings,
      fileName: file.originalname
    });
  } catch (error: any) {
    console.error("Error parsing file:", error);
    res.status(500).json({ error: error.message || "Failed to parse file" });
  }
});

router.post("/coa-mapping/:engagementId", requireAuth, async (req: Request, res: Response) => {
  try {
    const { engagementId } = req.params;
    const { columnMappings, fileInfo } = req.body;
    const ctx = getContext(req);
    
    const fsLinePatterns: Record<string, { pattern: RegExp; fsLine: string; confidence: number }[]> = {
      assets_cash: [
        { pattern: /cash|bank|petty\s*cash/i, fsLine: "ASSETS_CURRENT_CASH", confidence: 0.95 },
      ],
      assets_receivables: [
        { pattern: /receivable|trade\s*debtor|account\s*receivable|ar\b/i, fsLine: "ASSETS_CURRENT_RECEIVABLES", confidence: 0.92 },
      ],
      assets_inventory: [
        { pattern: /inventory|stock|raw\s*material|finished\s*good|work\s*in\s*progress|wip/i, fsLine: "ASSETS_CURRENT_INVENTORY", confidence: 0.90 },
      ],
      assets_prepaid: [
        { pattern: /prepaid|advance|deposit/i, fsLine: "ASSETS_CURRENT_PREPAID", confidence: 0.85 },
      ],
      assets_ppe: [
        { pattern: /property|plant|equipment|machinery|building|land|furniture|fixture|vehicle|motor/i, fsLine: "ASSETS_NONCURRENT_PPE", confidence: 0.90 },
      ],
      assets_intangible: [
        { pattern: /intangible|goodwill|patent|trademark|license|software/i, fsLine: "ASSETS_NONCURRENT_INTANGIBLE", confidence: 0.88 },
      ],
      assets_investment: [
        { pattern: /investment|shares|securities|subsidiary|associate/i, fsLine: "ASSETS_NONCURRENT_INVESTMENT", confidence: 0.87 },
      ],
      liab_payables: [
        { pattern: /payable|trade\s*creditor|account\s*payable|ap\b|supplier/i, fsLine: "LIAB_CURRENT_PAYABLES", confidence: 0.93 },
      ],
      liab_accrued: [
        { pattern: /accrued|accrual|provision\s*for/i, fsLine: "LIAB_CURRENT_ACCRUED", confidence: 0.87 },
      ],
      liab_shortterm_debt: [
        { pattern: /short\s*term\s*(loan|debt|borrowing)|overdraft|running\s*finance/i, fsLine: "LIAB_CURRENT_SHORTTERM_DEBT", confidence: 0.85 },
      ],
      liab_tax: [
        { pattern: /tax\s*payable|income\s*tax\s*liab|provision\s*for\s*tax/i, fsLine: "LIAB_CURRENT_TAX", confidence: 0.90 },
      ],
      liab_longterm_debt: [
        { pattern: /long\s*term\s*(loan|debt|borrowing)|term\s*finance/i, fsLine: "LIAB_NONCURRENT_LONGTERM_DEBT", confidence: 0.91 },
      ],
      liab_deferred_tax: [
        { pattern: /deferred\s*tax/i, fsLine: "LIAB_NONCURRENT_DEFERRED_TAX", confidence: 0.93 },
      ],
      equity_share: [
        { pattern: /share\s*capital|ordinary\s*share|common\s*stock|paid\s*up\s*capital/i, fsLine: "EQUITY_SHARE_CAPITAL", confidence: 0.96 },
      ],
      equity_retained: [
        { pattern: /retained\s*earning|accumulated\s*(profit|deficit)/i, fsLine: "EQUITY_RETAINED_EARNINGS", confidence: 0.94 },
      ],
      equity_reserves: [
        { pattern: /reserve|surplus|premium/i, fsLine: "EQUITY_RESERVES", confidence: 0.85 },
      ],
      revenue_operating: [
        { pattern: /revenue|sales|turnover|income\s*from\s*operations/i, fsLine: "REVENUE_OPERATING", confidence: 0.95 },
      ],
      revenue_other: [
        { pattern: /other\s*income|interest\s*income|dividend\s*income|gain\s*on/i, fsLine: "REVENUE_OTHER", confidence: 0.88 },
      ],
      expense_cogs: [
        { pattern: /cost\s*of\s*(goods\s*sold|sales)|cogs|direct\s*cost|purchase/i, fsLine: "EXPENSE_COGS", confidence: 0.94 },
      ],
      expense_employee: [
        { pattern: /salary|wage|payroll|staff\s*cost|employee\s*benefit|bonus|pension/i, fsLine: "EXPENSE_EMPLOYEE", confidence: 0.92 },
      ],
      expense_depreciation: [
        { pattern: /depreciation|amortization|amortisation/i, fsLine: "EXPENSE_DEPRECIATION", confidence: 0.97 },
      ],
      expense_finance: [
        { pattern: /interest\s*expense|finance\s*cost|bank\s*charge|financial\s*charge/i, fsLine: "EXPENSE_FINANCE", confidence: 0.93 },
      ],
      expense_tax: [
        { pattern: /income\s*tax\s*expense|tax\s*expense|taxation/i, fsLine: "EXPENSE_TAX", confidence: 0.95 },
      ],
      expense_other: [
        { pattern: /expense|cost|charge|utility|rent|insurance|repair|maintenance|travel|professional\s*fee/i, fsLine: "EXPENSE_OTHER", confidence: 0.70 },
      ],
    };
    
    const uniqueAccounts = new Map<string, { code: string; name: string }>();
    if (fileInfo?.sampleData) {
      const codeCol = columnMappings?.find((m: any) => m.targetField === "accountCode")?.sourceColumn;
      const nameCol = columnMappings?.find((m: any) => m.targetField === "accountName")?.sourceColumn;
      
      fileInfo.sampleData.forEach((row: Record<string, string>) => {
        const code = codeCol ? row[codeCol] : "";
        const name = nameCol ? row[nameCol] : "";
        if (code && !uniqueAccounts.has(code)) {
          uniqueAccounts.set(code, { code, name });
        }
      });
    }
    
    if (uniqueAccounts.size === 0) {
      return res.status(404).json({ error: "No GL accounts found. Please upload GL data first." });
    }
    
    const mappings = Array.from(uniqueAccounts.values()).map(account => {
      let bestMatch = { fsLine: "EXPENSE_OTHER", confidence: 0.5 };
      
      for (const [, patterns] of Object.entries(fsLinePatterns)) {
        for (const p of patterns) {
          if (p.pattern.test(account.name)) {
            if (p.confidence > bestMatch.confidence) {
              bestMatch = { fsLine: p.fsLine, confidence: p.confidence };
            }
            break;
          }
        }
      }
      
      const codePrefix = account.code.charAt(0);
      if (bestMatch.confidence < 0.7) {
        if (codePrefix === "1") bestMatch = { fsLine: "ASSETS_CURRENT_OTHER", confidence: 0.65 };
        else if (codePrefix === "2") bestMatch = { fsLine: "LIAB_CURRENT_OTHER", confidence: 0.65 };
        else if (codePrefix === "3") bestMatch = { fsLine: "EQUITY_OTHER", confidence: 0.65 };
        else if (codePrefix === "4") bestMatch = { fsLine: "REVENUE_OPERATING", confidence: 0.65 };
        else if (codePrefix === "5" || codePrefix === "6" || codePrefix === "7") bestMatch = { fsLine: "EXPENSE_OTHER", confidence: 0.60 };
      }
      
      return {
        accountCode: account.code,
        accountName: account.name,
        suggestedFSLine: bestMatch.fsLine,
        confidence: bestMatch.confidence,
        userOverride: null,
        notes: ""
      };
    });
    
    res.json({ mappings });
  } catch (error: any) {
    console.error("Error generating CoA mappings:", error);
    res.status(500).json({ error: error.message || "Failed to generate CoA mappings" });
  }
});

router.post("/complete/:engagementId", requireAuth, requireRole("SENIOR"), async (req: Request, res: Response) => {
  try {
    const { engagementId } = req.params;
    const { coaMappings, glEntries, professionalNotes, approvalStatus, glBatchId } = req.body;
    const ctx = getContext(req);
    const firmId = (req as any).user?.firmId;
    
    if (!firmId) {
      return res.status(400).json({ error: "Firm ID not found" });
    }
    
    const result = await glService.completeGLWorkflow(
      engagementId,
      firmId,
      {
        coaMappings: coaMappings || [],
        glEntries: glEntries || [],
        professionalNotes: professionalNotes || "",
        approvalStatus: approvalStatus || {},
        glBatchId: glBatchId || null
      },
      ctx
    );
    
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    
    res.json({
      success: true,
      message: "GL workflow completed successfully",
      engagementId,
      tbGenerated: result.tbGenerated || false,
      fsGenerated: result.fsGenerated || false,
      tbBatchId: result.tbBatchId,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error("Error completing GL workflow:", error);
    res.status(500).json({ error: error.message || "Failed to complete GL workflow" });
  }
});

router.get("/source/:engagementId/:accountCode", requireAuth, async (req: Request, res: Response) => {
  try {
    const { engagementId, accountCode } = req.params;
    const ctx = getContext(req);
    const user = (req as any).user;
    
    const engagement = await prisma.engagement.findFirst({
      where: { 
        id: engagementId,
        firmId: user.firmId
      }
    });
    
    if (!engagement) {
      return res.status(403).json({ 
        error: "Access denied. You do not have access to this engagement.",
        entries: [],
        count: 0
      });
    }
    
    const glEntries = await prisma.gLEntry.findMany({
      where: { 
        engagementId,
        accountCode 
      },
      orderBy: { transactionDate: 'asc' },
      take: 100
    });
    
    const formattedEntries = glEntries.map((entry: GLEntry) => ({
      id: entry.id,
      date: entry.transactionDate ? new Date(entry.transactionDate).toISOString().split('T')[0] : '',
      journalRef: entry.reference || `JE-${entry.id.slice(0, 6)}`,
      description: entry.description || entry.accountName || 'Transaction',
      debit: Number(entry.debit) || 0,
      credit: Number(entry.credit) || 0,
      accountCode: entry.accountCode,
      accountName: entry.accountName || ''
    }));
    
    res.json({
      success: true,
      entries: formattedEntries,
      count: formattedEntries.length,
      accountCode
    });
  } catch (error: any) {
    console.error("Error fetching GL source entries:", error);
    res.status(500).json({ error: error.message || "Failed to fetch GL source entries" });
  }
});

export default router;
