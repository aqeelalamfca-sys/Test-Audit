import { Router, Response } from "express";
import { prisma } from "./db";
import { requireAuth, logAuditTrail, type AuthenticatedRequest } from "./auth";
import { z } from "zod";
import * as XLSX from "xlsx";
import multer from "multer";
import { Decimal } from "@prisma/client/runtime/library";

const router = Router();

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

const FS_STATEMENT_TYPES = ["BALANCE_SHEET", "PROFIT_LOSS"] as const;
const FS_GROUPS = {
  BALANCE_SHEET: {
    "Non-Current Assets": ["Property, Plant & Equipment", "Intangible Assets", "Investment Property", "Long-term Investments", "Deferred Tax Assets", "Other Non-Current Assets"],
    "Current Assets": ["Cash & Bank Balances", "Trade Receivables", "Other Receivables", "Inventories", "Prepayments", "Short-term Investments", "Other Current Assets"],
    "Equity": ["Share Capital", "Share Premium", "Retained Earnings", "Other Reserves", "Non-Controlling Interest"],
    "Non-Current Liabilities": ["Long-term Borrowings", "Deferred Tax Liabilities", "Provisions", "Retirement Benefits", "Other Non-Current Liabilities"],
    "Current Liabilities": ["Trade Payables", "Other Payables", "Short-term Borrowings", "Current Tax Liabilities", "Accruals", "Other Current Liabilities"]
  },
  PROFIT_LOSS: {
    "Revenue": ["Sales Revenue", "Service Revenue", "Other Operating Income"],
    "Cost of Sales": ["Cost of Goods Sold", "Direct Labor", "Manufacturing Overheads"],
    "Operating Expenses": ["Administrative Expenses", "Selling & Distribution", "Research & Development", "Depreciation & Amortization"],
    "Other Income": ["Interest Income", "Dividend Income", "Gain on Disposal", "Other Non-Operating Income"],
    "Finance Costs": ["Interest Expense", "Bank Charges", "Other Finance Costs"],
    "Taxation": ["Current Tax", "Deferred Tax"]
  }
};

const tbMappingSchema = z.object({
  accountCode: z.string().min(1),
  statementType: z.enum(FS_STATEMENT_TYPES),
  fsGroup: z.string().min(1),
  lineItem: z.string().min(1),
  mappingSource: z.enum(["MANUAL", "AI"]).default("MANUAL")
});

router.get("/template/tb", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const format = (req.query.format as string)?.toLowerCase() || "xlsx";
    
    // Format matching user's exact requirements: Code, Account Name, Opening Bal, Debits, Credits, Closing Bal
    const TB_HEADERS = [
      "Code",
      "Account Name",
      "Opening Bal",
      "Debits",
      "Credits",
      "Closing Bal"
    ];
    
    // Sample data with 5-digit codes starting from 10001
    const TB_SAMPLE_DATA = [
      ["10001", "Cash in Hand", 0, 1344490, 0, 1344490],
      ["10002", "Petty Cash", 0, 414397, 0, 414397],
      ["10003", "Cash at Bank", 0, 47750, 0, 47750],
      ["10004", "Bank Account", 0, 250539, 0, 250539],
      ["10005", "Fixed Deposit", 0, 154996, 0, 154996],
      ["11001", "Trade Receivables", 0, 97340, 0, 97340],
      ["11002", "Customer Account", 0, 363458, 0, 363458],
      ["11003", "Debtor Account", 0, 519950, 0, 519950],
      ["11004", "Advances to Suppliers", 0, 125000, 0, 125000],
      ["11005", "Staff Advances", 0, 85000, 0, 85000],
      ["12001", "Raw Materials Inventory", 0, 750000, 0, 750000],
      ["12002", "Work in Progress", 0, 320000, 0, 320000],
      ["12003", "Finished Goods Inventory", 0, 480000, 0, 480000],
      ["12004", "Stores & Spares", 0, 95000, 0, 95000],
      ["13001", "Land", 0, 5000000, 0, 5000000],
      ["13002", "Building", 0, 8500000, 0, 8500000],
      ["13003", "Plant & Machinery", 0, 3200000, 0, 3200000],
      ["13004", "Furniture & Fixtures", 0, 450000, 0, 450000],
      ["13005", "Motor Vehicles", 0, 1200000, 0, 1200000],
      ["13006", "Office Equipment", 0, 280000, 0, 280000],
      ["14001", "Accumulated Depreciation - Building", 0, 0, 850000, 850000],
      ["14002", "Accumulated Depreciation - Machinery", 0, 0, 640000, 640000],
      ["14003", "Accumulated Depreciation - Vehicles", 0, 0, 360000, 360000],
      ["20001", "Trade Payables", 0, 0, 1250000, 1250000],
      ["20002", "Supplier Accounts", 0, 0, 780000, 780000],
      ["20003", "Creditor Accounts", 0, 0, 520000, 520000],
      ["20004", "Accrued Expenses", 0, 0, 185000, 185000],
      ["20005", "Advances from Customers", 0, 0, 320000, 320000],
      ["21001", "Short Term Loan", 0, 0, 500000, 500000],
      ["21002", "Bank Overdraft", 0, 0, 150000, 150000],
      ["22001", "Long Term Loan", 0, 0, 3500000, 3500000],
      ["22002", "Deferred Tax Liability", 0, 0, 420000, 420000],
      ["30001", "Share Capital", 0, 0, 5000000, 5000000],
      ["30002", "Share Premium", 0, 0, 1500000, 1500000],
      ["30003", "Retained Earnings", 0, 0, 2800000, 2800000],
      ["30004", "General Reserve", 0, 0, 750000, 750000],
      ["40001", "Sales Revenue - Local", 0, 0, 15000000, 15000000],
      ["40002", "Sales Revenue - Export", 0, 0, 5000000, 5000000],
      ["40003", "Service Income", 0, 0, 2500000, 2500000],
      ["40004", "Other Income", 0, 0, 350000, 350000],
      ["50001", "Cost of Goods Sold", 0, 12000000, 0, 12000000],
      ["50002", "Direct Labor", 0, 2500000, 0, 2500000],
      ["50003", "Manufacturing Overhead", 0, 1200000, 0, 1200000],
      ["51001", "Salaries & Wages", 0, 3500000, 0, 3500000],
      ["51002", "Employee Benefits", 0, 580000, 0, 580000],
      ["51003", "Staff Welfare", 0, 120000, 0, 120000],
      ["52001", "Rent Expense", 0, 720000, 0, 720000],
      ["52002", "Utilities Expense", 0, 280000, 0, 280000],
      ["52003", "Insurance Expense", 0, 185000, 0, 185000],
      ["52004", "Repairs & Maintenance", 0, 220000, 0, 220000],
      ["53001", "Depreciation Expense", 0, 850000, 0, 850000],
      ["53002", "Amortization Expense", 0, 120000, 0, 120000],
      ["54001", "Professional Fees", 0, 350000, 0, 350000],
      ["54002", "Legal Expenses", 0, 180000, 0, 180000],
      ["54003", "Audit Fees", 0, 250000, 0, 250000],
      ["55001", "Marketing Expense", 0, 480000, 0, 480000],
      ["55002", "Travel & Entertainment", 0, 220000, 0, 220000],
      ["55003", "Communication Expense", 0, 95000, 0, 95000],
      ["56001", "Bank Charges", 0, 45000, 0, 45000],
      ["56002", "Interest Expense", 0, 580000, 0, 580000],
      ["60001", "Interest Income", 0, 0, 85000, 85000],
      ["60002", "Dividend Income", 0, 0, 35000, 35000],
      ["70001", "Income Tax Expense", 0, 780000, 0, 780000]
    ];
    
    if (format === "csv") {
      const csvRows = [TB_HEADERS.join(",")];
      TB_SAMPLE_DATA.forEach(row => {
        csvRows.push(row.map(cell => cell === "" ? "" : String(cell)).join(","));
      });
      
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=tb_template.csv");
      res.send(csvRows.join("\n"));
    } else {
      const wb = XLSX.utils.book_new();
      const templateData = [TB_HEADERS, ...TB_SAMPLE_DATA];
      const ws = XLSX.utils.aoa_to_sheet(templateData);
      
      ws["!cols"] = [
        { wch: 12 },
        { wch: 40 },
        { wch: 15 },
        { wch: 15 },
        { wch: 15 },
        { wch: 15 }
      ];
      
      XLSX.utils.book_append_sheet(wb, ws, "Trial Balance");
      
      const instructionsData = [
        ["TRIAL BALANCE (TB) TEMPLATE INSTRUCTIONS"],
        [""],
        ["Column Definitions:"],
        ["- Code (Required): 5-digit account code (e.g., 10001, 20001, 40001)"],
        ["- Account Name (Required): Descriptive name of the account"],
        ["- Opening Bal: Opening balance for the period"],
        ["- Debits: Total debit movements during the period"],
        ["- Credits: Total credit movements during the period"],
        ["- Closing Bal: Closing balance (Opening + Debits - Credits or Opening - Debits + Credits)"],
        [""],
        ["Account Code Structure:"],
        ["10xxx - Cash & Bank"],
        ["11xxx - Receivables"],
        ["12xxx - Inventory"],
        ["13xxx - Fixed Assets"],
        ["14xxx - Accumulated Depreciation"],
        ["20xxx - Current Liabilities"],
        ["21xxx - Short Term Loans"],
        ["22xxx - Long Term Liabilities"],
        ["30xxx - Equity"],
        ["40xxx - Revenue"],
        ["50xxx - Cost of Sales"],
        ["51xxx - Employee Expenses"],
        ["52xxx - Operating Expenses"],
        ["53xxx - Depreciation & Amortization"],
        ["54xxx - Professional & Legal"],
        ["55xxx - Marketing & Admin"],
        ["56xxx - Finance Costs"],
        ["60xxx - Other Income"],
        ["70xxx - Taxation"],
        [""],
        ["Data Entry Rules:"],
        ["1. Enter one account per row"],
        ["2. Use positive numbers only"],
        ["3. Do not include currency symbols"],
        ["4. Commas are allowed for thousand separators"],
        ["5. Leave blank cells or 0 for zero values"],
        ["6. Do not modify or delete the header row"]
      ];
      
      const wsInstructions = XLSX.utils.aoa_to_sheet(instructionsData);
      wsInstructions["!cols"] = [{ wch: 80 }];
      XLSX.utils.book_append_sheet(wb, wsInstructions, "Instructions");
      
      const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", "attachment; filename=tb_template.xlsx");
      res.send(buffer);
    }
    
  } catch (error) {
    console.error("Error generating TB template:", error);
    res.status(500).json({ error: "Failed to generate TB template" });
  }
});

router.get("/template/gl", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const format = (req.query.format as string)?.toLowerCase() || "xlsx";
    
    // Format matching user's exact requirements: Code, Account Name, Voucher #, Date, Debit, Credit, Curr, Doc Type, Ref #, Narrative
    const GL_HEADERS = [
      "Code",
      "Account Name",
      "Voucher #",
      "Date",
      "Debit",
      "Credit",
      "Curr",
      "Doc Type",
      "Ref #",
      "Narrative"
    ];
    
    const GL_SAMPLE_DATA = [
      ["10001", "Cash in Hand", "JV-00001", "12/31/2024", 295987.60, 0, "PKR", "JV", "REF-000001", "Year-end cash adjustment"],
      ["10001", "Cash in Hand", "JV-00002", "09/23/2024", 330631.20, 0, "PKR", "JV", "REF-000002", "Cash deposit from sales"],
      ["10001", "Cash in Hand", "BRV-00001", "07/02/2024", 199711.10, 0, "PKR", "BRV", "REF-000003", "Bank receipt voucher - Customer payment"],
      ["10001", "Cash in Hand", "JV-00003", "05/22/2025", 103975.30, 0, "PKR", "JV", "REF-000004", "Inter-account transfer"],
      ["10001", "Cash in Hand", "BPV-00001", "08/19/2024", 0, 355803.30, "PKR", "BPV", "REF-000005", "Bank payment - Supplier"],
      ["10001", "Cash in Hand", "PV-00001", "08/19/2024", 0, 58381.66, "PKR", "PV", "REF-000006", "Petty cash payment"],
      ["10002", "Petty Cash", "PV-00002", "12/15/2024", 41723.74, 0, "PKR", "PV", "REF-000007", "Petty cash replenishment"],
      ["10002", "Petty Cash", "PV-00003", "10/11/2024", 0, 101978.90, "PKR", "PV", "REF-000008", "Office supplies payment"],
      ["10003", "Cash at Bank", "BRV-00002", "11/05/2024", 850000, 0, "PKR", "BRV", "REF-000009", "Customer receipt - ABC Ltd"],
      ["10003", "Cash at Bank", "BPV-00002", "11/15/2024", 0, 425000, "PKR", "BPV", "REF-000010", "Supplier payment - XYZ Corp"],
      ["11001", "Trade Receivables", "INV-00001", "08/15/2024", 97340, 0, "PKR", "INV", "REF-000011", "Sales invoice - Client A"],
      ["11002", "Customer Account", "INV-00002", "09/20/2024", 363458, 0, "PKR", "INV", "REF-000012", "Sales invoice - Client B"],
      ["20001", "Trade Payables", "BPV-00003", "10/25/2024", 150000, 0, "PKR", "BPV", "REF-000013", "Supplier payment clearance"],
      ["40001", "Sales Revenue - Local", "INV-00003", "07/01/2024", 0, 1250000, "PKR", "INV", "REF-000014", "Monthly sales invoice"],
      ["50001", "Cost of Goods Sold", "JV-00004", "07/31/2024", 875000, 0, "PKR", "JV", "REF-000015", "Cost of sales - July"]
    ];
    
    if (format === "csv") {
      const csvRows = [GL_HEADERS.join(",")];
      GL_SAMPLE_DATA.forEach(row => {
        csvRows.push(row.map(cell => {
          if (cell === "") return "";
          if (typeof cell === "string" && cell.includes(",")) return `"${cell}"`;
          return String(cell);
        }).join(","));
      });
      
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=gl_template.csv");
      res.send(csvRows.join("\n"));
    } else {
      const wb = XLSX.utils.book_new();
      const templateData = [GL_HEADERS, ...GL_SAMPLE_DATA];
      const ws = XLSX.utils.aoa_to_sheet(templateData);
      
      ws["!cols"] = [
        { wch: 10 },  // Code
        { wch: 25 },  // Account Name
        { wch: 12 },  // Voucher #
        { wch: 12 },  // Date
        { wch: 12 },  // Debit
        { wch: 12 },  // Credit
        { wch: 6 },   // Curr
        { wch: 10 },  // Doc Type
        { wch: 12 },  // Ref #
        { wch: 40 }   // Narrative
      ];
      
      XLSX.utils.book_append_sheet(wb, ws, "General Ledger");
      
      const instructionsData = [
        ["GENERAL LEDGER (GL) TEMPLATE INSTRUCTIONS"],
        [""],
        ["Column Definitions:"],
        ["- Code (Required): 5-digit account code matching Trial Balance (e.g., 10001, 20001)"],
        ["- Account Name (Required): Descriptive name of the account"],
        ["- Voucher # (Required): Unique voucher identifier (e.g., JV-00001, BPV-00002)"],
        ["- Date (Required): Transaction date in MM/DD/YYYY format (e.g., 12/31/2024)"],
        ["- Debit: Amount debited to the account (leave 0 if credit)"],
        ["- Credit: Amount credited to the account (leave 0 if debit)"],
        ["- Curr: Currency code (e.g., PKR, USD)"],
        ["- Doc Type: Document type code (JV, BPV, BRV, PV, RV, INV)"],
        ["- Ref #: Reference number for document tracking"],
        ["- Narrative: Detailed description of the transaction"],
        [""],
        ["Document Type Codes:"],
        ["JV  = Journal Voucher"],
        ["BPV = Bank Payment Voucher"],
        ["BRV = Bank Receipt Voucher"],
        ["PV  = Payment Voucher (Cash)"],
        ["RV  = Receipt Voucher (Cash)"],
        ["INV = Invoice"],
        [""],
        ["Data Entry Rules:"],
        ["1. Each row represents one line of a transaction"],
        ["2. Use positive numbers only (no negative amounts)"],
        ["3. Enter date in MM/DD/YYYY format"],
        ["4. Do not include currency symbols in amount fields"],
        ["5. Ensure debit and credit totals balance for each voucher"],
        ["6. Do not modify or delete the header row"]
      ];
      
      const wsInstructions = XLSX.utils.aoa_to_sheet(instructionsData);
      wsInstructions["!cols"] = [{ wch: 80 }];
      XLSX.utils.book_append_sheet(wb, wsInstructions, "Instructions");
      
      const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", "attachment; filename=gl_template.xlsx");
      res.send(buffer);
    }
    
  } catch (error) {
    console.error("Error generating GL template:", error);
    res.status(500).json({ error: "Failed to generate GL template" });
  }
});

router.get("/template/excel", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const wb = XLSX.utils.book_new();
    
    const templateData = [
      ["Account Code", "Account Name / Description", "Debit", "Credit", "Opening Debit", "Opening Credit", "Cost Center / Segment", "Notes"],
      ["1001", "Cash in Hand", 50000, "", 45000, "", "HQ", "Main office petty cash"],
      ["1002", "Bank - Current Account", 1500000, "", 1200000, "", "HQ", "Primary operating account"],
      ["1010", "Trade Receivables", 2500000, "", 2100000, "", "", "Net of allowances"],
      ["1020", "Inventory - Raw Materials", 800000, "", 750000, "", "PROD", ""],
      ["2001", "Trade Payables", "", 1200000, "", 950000, "", ""],
      ["2010", "Bank Loan", "", 5000000, "", 5500000, "", "Long-term facility"],
      ["3001", "Share Capital", "", 2000000, "", 2000000, "", ""],
      ["3002", "Retained Earnings", "", 1500000, "", 1200000, "", ""],
      ["4001", "Sales Revenue", "", 15000000, "", 12000000, "", ""],
      ["5001", "Cost of Goods Sold", 9000000, "", 7200000, "", "", ""],
      ["5010", "Salaries & Wages", 2500000, "", 2200000, "", "", ""],
      ["5020", "Rent Expense", 600000, "", 550000, "", "", ""],
      ["5030", "Utilities", 180000, "", 160000, "", "", ""],
      ["6001", "Interest Income", "", 50000, "", 40000, "", ""],
      ["6010", "Interest Expense", 200000, "", 220000, "", "", ""]
    ];
    
    const ws = XLSX.utils.aoa_to_sheet(templateData);
    
    ws["!cols"] = [
      { wch: 15 },
      { wch: 35 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
      { wch: 20 },
      { wch: 30 }
    ];
    
    XLSX.utils.book_append_sheet(wb, ws, "Trial Balance");
    
    const instructionsData = [
      ["TRIAL BALANCE UPLOAD INSTRUCTIONS"],
      [""],
      ["Column Requirements:"],
      ["- Account Code (Required): Unique identifier for each account"],
      ["- Account Name / Description (Required): Descriptive name of the account"],
      ["- Debit (Numeric): Enter debit balance amount (leave blank if credit balance)"],
      ["- Credit (Numeric): Enter credit balance amount (leave blank if debit balance)"],
      ["- Opening Debit (Optional): Prior period opening debit balance"],
      ["- Opening Credit (Optional): Prior period opening credit balance"],
      ["- Cost Center / Segment (Optional): Department or cost center code"],
      ["- Notes (Optional): Any additional notes or comments"],
      [""],
      ["Data Entry Rules:"],
      ["1. Enter one account per row"],
      ["2. Enter amounts in Debit OR Credit column (not both)"],
      ["3. Use positive numbers only"],
      ["4. Do not include currency symbols (e.g., use 1000 not Rs. 1,000)"],
      ["5. Commas are allowed for thousand separators (e.g., 1,000,000)"],
      ["6. Leave blank cells for zero values"],
      ["7. Do not modify or delete the header row"],
      [""],
      ["After completing entry:"],
      ["1. Save the file as .xlsx or .csv format"],
      ["2. Upload using the Trial Balance Upload section in Planning"],
      ["3. System will validate and show any errors for correction"],
      ["4. Upon successful upload, proceed to TB Review & FS Clubbing"]
    ];
    
    const wsInstructions = XLSX.utils.aoa_to_sheet(instructionsData);
    wsInstructions["!cols"] = [{ wch: 80 }];
    XLSX.utils.book_append_sheet(wb, wsInstructions, "Instructions");
    
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=trial_balance_template.xlsx");
    res.send(buffer);
    
  } catch (error) {
    console.error("Error generating template:", error);
    res.status(500).json({ error: "Failed to generate template" });
  }
});

router.get("/template/csv", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const csvContent = `Account Code,Account Name / Description,Debit,Credit,Opening Debit,Opening Credit,Cost Center / Segment,Notes
1001,Cash in Hand,50000,,45000,,HQ,Main office petty cash
1002,Bank - Current Account,1500000,,1200000,,HQ,Primary operating account
1010,Trade Receivables,2500000,,2100000,,,Net of allowances
1020,Inventory - Raw Materials,800000,,750000,,PROD,
2001,Trade Payables,,1200000,,950000,,
2010,Bank Loan,,5000000,,5500000,,Long-term facility
3001,Share Capital,,2000000,,2000000,,
3002,Retained Earnings,,1500000,,1200000,,
4001,Sales Revenue,,15000000,,12000000,,
5001,Cost of Goods Sold,9000000,,7200000,,,
5010,Salaries & Wages,2500000,,2200000,,,
5020,Rent Expense,600000,,550000,,,
5030,Utilities,180000,,160000,,,
6001,Interest Income,,50000,,40000,,
6010,Interest Expense,200000,,220000,,,`;
    
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=trial_balance_template.csv");
    res.send(csvContent);
    
  } catch (error) {
    console.error("Error generating CSV template:", error);
    res.status(500).json({ error: "Failed to generate template" });
  }
});

const AMOUNT_SCALE_MULTIPLIERS: Record<string, number> = {
  UNITS: 1,
  THOUSANDS: 1000,
  MILLIONS: 1000000,
  BILLIONS: 1000000000
};

router.post("/upload/:engagementId", requireAuth, upload.single("file"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const file = req.file;
    const amountScale = (req.body.amount_scale as string)?.toUpperCase() || "UNITS";
    const scaleMultiplier = AMOUNT_SCALE_MULTIPLIERS[amountScale] || 1;
    
    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    
    const engagement = await prisma.engagement.findUnique({
      where: { id: engagementId },
      include: { client: true }
    });
    
    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }
    
    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(file.buffer, { type: "buffer" });
    } catch (e) {
      return res.status(400).json({ error: "Invalid file format. Please upload an Excel (.xlsx) or CSV file." });
    }
    
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rawData: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    if (rawData.length < 2) {
      return res.status(400).json({ error: "File is empty or has no data rows" });
    }
    
    const headers = (rawData[0] as string[]).map(h => String(h).toLowerCase().trim());
    
    const columnMap: Record<string, number> = {};
    const requiredColumns = ["account code", "account name", "description", "account name / description"];
    
    headers.forEach((header, index) => {
      if (header.includes("account") && header.includes("code")) columnMap["accountCode"] = index;
      if ((header.includes("gl") && header.includes("account") && header.includes("name")) || (header.includes("account") && (header.includes("name") || header.includes("description")))) columnMap["accountName"] = index;
      // Support multiple debit column name variations: "debit", "debit balance", "period debit", "closing debit", "movement debit", etc.
      if ((header === "debit" || header.includes("debit balance") || header.includes("period debit") || header.includes("closing debit") || header.includes("debit amount") || (header.includes("debit") && !header.includes("opening"))) && columnMap["debit"] === undefined) {
        columnMap["debit"] = index;
      }
      // Support multiple credit column name variations: "credit", "credit balance", "period credit", "closing credit", "credit amount", etc.
      if ((header === "credit" || header.includes("credit balance") || header.includes("period credit") || header.includes("closing credit") || header.includes("credit amount") || (header.includes("credit") && !header.includes("opening"))) && columnMap["credit"] === undefined) {
        columnMap["credit"] = index;
      }
      if (header.includes("opening") && header.includes("debit")) columnMap["openingDebit"] = index;
      if (header.includes("opening") && header.includes("credit")) columnMap["openingCredit"] = index;
      // Support "movement debit/credit" columns
      if (header.includes("movement") && header.includes("debit")) columnMap["movementDebit"] = index;
      if (header.includes("movement") && header.includes("credit")) columnMap["movementCredit"] = index;
      // Also support "opening balance" as a single column
      if ((header.includes("opening") && header.includes("balance")) && !header.includes("debit") && !header.includes("credit")) {
        columnMap["openingBalance"] = index;
      }
      // Support "closing balance" column
      if (header.includes("closing") && header.includes("balance")) {
        columnMap["closingBalance"] = index;
      }
      if (header.includes("cost") || header.includes("segment")) columnMap["costCenter"] = index;
      if (header === "notes" || header === "note reference" || header.includes("note") || header.includes("narrative")) columnMap["notes"] = index;
    });
    
    if (columnMap["accountCode"] === undefined) {
      return res.status(400).json({ 
        error: "Missing required column: Account Code",
        hint: "Ensure your file has a column header containing 'Account Code'"
      });
    }
    
    if (columnMap["accountName"] === undefined) {
      return res.status(400).json({ 
        error: "Missing required column: Account Name / Description",
        hint: "Ensure your file has a column header containing 'Account Name' or 'Description'"
      });
    }
    
    const errors: Array<{ row: number; column: string; issue: string; fix: string }> = [];
    const validRows: Array<{
      accountCode: string;
      accountName: string;
      debit: number;
      credit: number;
      openingDebit: number;
      openingCredit: number;
      costCenter?: string;
      notes?: string;
    }> = [];
    
    const parseNumber = (value: any): number => {
      if (value === undefined || value === null || value === "") return 0;
      const str = String(value).replace(/,/g, "").trim();
      const num = parseFloat(str);
      const baseValue = isNaN(num) ? 0 : Math.abs(num);
      return baseValue * scaleMultiplier;
    };
    
    for (let i = 1; i < rawData.length; i++) {
      const row = rawData[i] as any[];
      if (!row || row.length === 0 || row.every(cell => cell === undefined || cell === "")) continue;
      
      const rowNum = i + 1;
      
      const accountCode = row[columnMap["accountCode"]];
      const accountName = row[columnMap["accountName"]];
      let debit = parseNumber(row[columnMap["debit"]]);
      let credit = parseNumber(row[columnMap["credit"]]);
      const openingDebit = parseNumber(row[columnMap["openingDebit"]]);
      const openingCredit = parseNumber(row[columnMap["openingCredit"]]);
      const movementDebit = columnMap["movementDebit"] !== undefined ? parseNumber(row[columnMap["movementDebit"]]) : 0;
      const movementCredit = columnMap["movementCredit"] !== undefined ? parseNumber(row[columnMap["movementCredit"]]) : 0;
      const openingBalance = columnMap["openingBalance"] !== undefined ? parseNumber(row[columnMap["openingBalance"]]) : 0;
      const closingBalance = columnMap["closingBalance"] !== undefined ? row[columnMap["closingBalance"]] : undefined;
      const costCenter = row[columnMap["costCenter"]] ? String(row[columnMap["costCenter"]]) : undefined;
      const notes = row[columnMap["notes"]] ? String(row[columnMap["notes"]]) : undefined;
      
      // If closing balance is available but debit/credit are not, derive debit/credit from closing balance
      if (debit === 0 && credit === 0 && closingBalance !== undefined && closingBalance !== "") {
        const closingVal = parseFloat(String(closingBalance).replace(/,/g, "").trim());
        if (!isNaN(closingVal)) {
          if (closingVal >= 0) {
            debit = Math.abs(closingVal) * scaleMultiplier;
          } else {
            credit = Math.abs(closingVal) * scaleMultiplier;
          }
        }
      }
      
      // If movement columns are present, use them for debit/credit if closing is not provided
      if (debit === 0 && credit === 0) {
        if (movementDebit > 0) debit = movementDebit;
        if (movementCredit > 0) credit = movementCredit;
      }
      
      if (!accountCode || String(accountCode).trim() === "") {
        errors.push({ row: rowNum, column: "Account Code", issue: "Missing account code", fix: "Enter a unique account code" });
        continue;
      }
      
      if (!accountName || String(accountName).trim() === "") {
        errors.push({ row: rowNum, column: "Account Name", issue: "Missing account name", fix: "Enter account description" });
        continue;
      }
      
      if (debit > 0 && credit > 0) {
        errors.push({ row: rowNum, column: "Debit/Credit", issue: "Both debit and credit have values", fix: "Enter amount in either Debit OR Credit, not both" });
        continue;
      }
      
      // Allow rows with any balance data: debit, credit, opening balances, or closing balance
      if (debit === 0 && credit === 0 && openingDebit === 0 && openingCredit === 0 && openingBalance === 0) {
        errors.push({ row: rowNum, column: "Amounts", issue: "No balance amounts entered", fix: "Enter at least one balance amount" });
        continue;
      }
      
      validRows.push({
        accountCode: String(accountCode).trim(),
        accountName: String(accountName).trim(),
        debit,
        credit,
        openingDebit,
        openingCredit,
        costCenter,
        notes
      });
    }
    
    if (errors.length > 0 && validRows.length === 0) {
      return res.status(400).json({ 
        error: "No valid rows found in the uploaded file",
        errors: errors.slice(0, 20),
        totalErrors: errors.length
      });
    }
    
    const totalDebit = validRows.reduce((sum, r) => sum + r.debit, 0);
    const totalCredit = validRows.reduce((sum, r) => sum + r.credit, 0);
    const difference = totalDebit - totalCredit;
    
    const trialBalance = await prisma.trialBalance.create({
      data: {
        engagementId,
        periodType: "current",
        periodEnd: engagement.periodEnd || new Date(),
        importedById: req.user!.id,
        sourceFile: file.originalname,
        totalAssets: new Decimal(validRows.filter(r => r.debit > 0 && r.accountCode.startsWith("1")).reduce((s, r) => s + r.debit, 0)),
        totalLiabilities: new Decimal(validRows.filter(r => r.credit > 0 && r.accountCode.startsWith("2")).reduce((s, r) => s + r.credit, 0)),
        totalEquity: new Decimal(validRows.filter(r => r.credit > 0 && r.accountCode.startsWith("3")).reduce((s, r) => s + r.credit, 0)),
        totalRevenue: new Decimal(validRows.filter(r => r.credit > 0 && r.accountCode.startsWith("4")).reduce((s, r) => s + r.credit, 0)),
        totalExpenses: new Decimal(validRows.filter(r => r.debit > 0 && (r.accountCode.startsWith("5") || r.accountCode.startsWith("6"))).reduce((s, r) => s + r.debit, 0)),
        lineItems: {
          create: validRows.map(row => {
            // Opening Balance = +Debit - Credit (positive for debit balances, negative for credit balances)
            const openingBalance = row.openingDebit - row.openingCredit;
            // Closing Balance = Opening Balance + Period Debits - Period Credits
            const closingBalance = openingBalance + row.debit - row.credit;
            return {
              accountCode: row.accountCode,
              accountName: row.accountName,
              debits: new Decimal(row.debit),
              credits: new Decimal(row.credit),
              openingBalance: new Decimal(openingBalance),
              closingBalance: new Decimal(closingBalance)
            };
          })
        }
      },
      include: {
        lineItems: true
      }
    });
    
    await logAuditTrail(
      req.user!.id,
      "TRIAL_BALANCE_UPLOAD",
      `Uploaded Trial Balance for engagement ${engagement.engagementCode}`,
      engagementId,
      { filename: file.originalname, rowCount: validRows.length, totalDebit, totalCredit }
    );
    
    // Auto-populate Chart of Accounts from uploaded TB data
    // Step 1: Deduplicate by accountCode (keep last occurrence for name)
    const uniqueAccountsMap = new Map<string, { accountCode: string; accountName: string }>();
    for (const row of validRows) {
      uniqueAccountsMap.set(row.accountCode, {
        accountCode: row.accountCode,
        accountName: row.accountName
      });
    }
    const uniqueAccounts = Array.from(uniqueAccountsMap.values());
    
    let coaCreatedCount = 0;
    let coaUpdatedCount = 0;
    
    const detectAccountClass = (code: string): string | null => {
      // Validate code starts with a digit
      if (!code || code.length === 0) return null;
      const firstChar = code.charAt(0);
      if (!/^[1-9]$/.test(firstChar)) return null;
      
      switch (firstChar) {
        case '1': return 'Assets';
        case '2': return 'Liabilities';
        case '3': return 'Equity';
        case '4': return 'Revenue';
        case '5': return 'Expenses';
        case '6': return 'Other Expenses';
        case '7': return 'Other Income';
        default: return null;
      }
    };
    
    const detectAccountNature = (code: string): "DR" | "CR" | null => {
      if (!code || code.length === 0) return null;
      const firstChar = code.charAt(0);
      if (!/^[1-9]$/.test(firstChar)) return null;
      
      // Assets (1), Expenses (5, 6) are typically debit nature
      // Liabilities (2), Equity (3), Revenue (4), Other Income (7) are credit nature
      return ['1', '5', '6'].includes(firstChar) ? 'DR' : 'CR';
    };
    
    // Step 2: Use transaction for atomicity
    try {
      await prisma.$transaction(async (tx) => {
        // Get existing accounts in one query
        const existingAccounts = await tx.coAAccount.findMany({
          where: {
            engagementId,
            accountCode: { in: uniqueAccounts.map(a => a.accountCode) }
          },
          select: { id: true, accountCode: true, accountName: true }
        });
        
        const existingMap = new Map(existingAccounts.map(a => [a.accountCode, a]));
        
        // Separate into creates and updates
        const toCreate: Array<{ accountCode: string; accountName: string; accountClass: string | null; nature: "DR" | "CR" }> = [];
        const toUpdate: Array<{ id: string; accountName: string }> = [];
        
        for (const account of uniqueAccounts) {
          const existing = existingMap.get(account.accountCode);
          if (existing) {
            if (existing.accountName !== account.accountName) {
              toUpdate.push({ id: existing.id, accountName: account.accountName });
            }
          } else {
            // For invalid account codes, default to 'DR' as per accounting convention
            const detectedNature = detectAccountNature(account.accountCode);
            toCreate.push({
              accountCode: account.accountCode,
              accountName: account.accountName,
              accountClass: detectAccountClass(account.accountCode),
              nature: detectedNature !== null ? detectedNature : 'DR'
            });
          }
        }
        
        // Batch create new accounts using createMany
        if (toCreate.length > 0) {
          const createResult = await tx.coAAccount.createMany({
            data: toCreate.map(a => ({
              engagementId,
              accountCode: a.accountCode,
              accountName: a.accountName,
              accountClass: a.accountClass,
              nature: a.nature
            })),
            skipDuplicates: true
          });
          coaCreatedCount = createResult.count;
        }
        
        // Sequential updates (can't batch update different values)
        for (const upd of toUpdate) {
          await tx.coAAccount.update({
            where: { id: upd.id },
            data: { accountName: upd.accountName }
          });
        }
        coaUpdatedCount = toUpdate.length;
      });
      
      console.log(`[TB Upload] Auto-populated CoA: ${coaCreatedCount} created, ${coaUpdatedCount} updated`);
    } catch (coaError) {
      // Log error but don't fail the entire upload - TB was already created successfully
      console.error("[TB Upload] Warning: CoA auto-population failed:", coaError);
    }
    
    res.json({
      success: true,
      trialBalanceId: trialBalance.id,
      summary: {
        totalRows: validRows.length,
        totalDebit,
        totalCredit,
        difference,
        isBalanced: Math.abs(difference) < 0.01,
        errors: errors.length > 0 ? errors.slice(0, 10) : [],
        warningCount: errors.length,
        coaAccountsCreated: coaCreatedCount,
        coaAccountsUpdated: coaUpdatedCount
      },
      lineItems: trialBalance.lineItems
    });
    
  } catch (error) {
    console.error("Error uploading trial balance:", error);
    res.status(500).json({ error: "Failed to upload trial balance" });
  }
});

router.get("/:engagementId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    
    const trialBalance = await prisma.trialBalance.findFirst({
      where: { engagementId },
      orderBy: { importedDate: "desc" },
      include: {
        lineItems: true,
        importedBy: { select: { id: true, fullName: true, email: true } }
      }
    });
    
    if (!trialBalance) {
      return res.status(404).json({ error: "No trial balance found for this engagement" });
    }
    
    const mappings = await prisma.tBMapping.findMany({
      where: { trialBalanceId: trialBalance.id }
    });
    
    const mappingMap = new Map(mappings.map(m => [m.accountCode, m]));
    
    const lineItemsWithMapping = trialBalance.lineItems.map(item => {
      const openingBal = Number(item.openingBalance);
      const closingBal = Number(item.closingBalance);
      return {
        ...item,
        openingDebit: openingBal >= 0 ? openingBal : 0,
        openingCredit: openingBal < 0 ? Math.abs(openingBal) : 0,
        closingDebit: closingBal >= 0 ? closingBal : 0,
        closingCredit: closingBal < 0 ? Math.abs(closingBal) : 0,
        mapping: mappingMap.get(item.accountCode) || null
      };
    });
    
    const totalDebit = trialBalance.lineItems.reduce((sum, item) => sum + Number(item.debits), 0);
    const totalCredit = trialBalance.lineItems.reduce((sum, item) => sum + Number(item.credits), 0);
    
    res.json({
      ...trialBalance,
      lineItems: lineItemsWithMapping,
      summary: {
        totalDebit,
        totalCredit,
        difference: totalDebit - totalCredit,
        isBalanced: Math.abs(totalDebit - totalCredit) < 0.01,
        mappedCount: mappings.length,
        unmappedCount: trialBalance.lineItems.length - mappings.length
      }
    });
    
  } catch (error) {
    console.error("Error fetching trial balance:", error);
    res.status(500).json({ error: "Failed to fetch trial balance" });
  }
});

router.get("/fs-groups", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  res.json(FS_GROUPS);
});

router.post("/:trialBalanceId/mapping", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { trialBalanceId } = req.params;
    const mappings = z.array(tbMappingSchema).parse(req.body);
    
    const tb = await prisma.trialBalance.findUnique({
      where: { id: trialBalanceId }
    });
    
    if (!tb) {
      return res.status(404).json({ error: "Trial balance not found" });
    }
    
    const results = await Promise.all(mappings.map(async (mapping) => {
      return prisma.tBMapping.upsert({
        where: {
          trialBalanceId_accountCode: {
            trialBalanceId,
            accountCode: mapping.accountCode
          }
        },
        update: {
          statementType: mapping.statementType,
          fsGroup: mapping.fsGroup,
          lineItem: mapping.lineItem,
          mappingSource: mapping.mappingSource,
          mappedById: req.user!.id,
          mappedAt: new Date()
        },
        create: {
          trialBalanceId,
          engagementId: tb.engagementId,
          accountCode: mapping.accountCode,
          statementType: mapping.statementType,
          fsGroup: mapping.fsGroup,
          lineItem: mapping.lineItem,
          mappingSource: mapping.mappingSource,
          mappedById: req.user!.id
        }
      });
    }));
    
    await logAuditTrail(
      req.user!.id,
      "TB_MAPPING_SAVED",
      `Saved ${mappings.length} TB mappings`,
      tb.engagementId,
      { mappingCount: mappings.length }
    );
    
    res.json({ success: true, mappings: results });
    
  } catch (error) {
    console.error("Error saving mappings:", error);
    res.status(500).json({ error: "Failed to save mappings" });
  }
});

router.post("/:trialBalanceId/ai-suggest", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { trialBalanceId } = req.params;
    const { accountCode, accountName } = req.body;
    
    const nameLower = accountName.toLowerCase();
    
    let suggestion: { statementType: string; fsGroup: string; lineItem: string; confidence: number } = {
      statementType: "BALANCE_SHEET",
      fsGroup: "Current Assets",
      lineItem: "Other Current Assets",
      confidence: 0.6
    };
    
    if (nameLower.includes("cash") || nameLower.includes("bank")) {
      suggestion = { statementType: "BALANCE_SHEET", fsGroup: "Current Assets", lineItem: "Cash & Bank Balances", confidence: 0.95 };
    } else if (nameLower.includes("receivable") || nameLower.includes("debtor")) {
      suggestion = { statementType: "BALANCE_SHEET", fsGroup: "Current Assets", lineItem: "Trade Receivables", confidence: 0.9 };
    } else if (nameLower.includes("inventory") || nameLower.includes("stock")) {
      suggestion = { statementType: "BALANCE_SHEET", fsGroup: "Current Assets", lineItem: "Inventories", confidence: 0.9 };
    } else if (nameLower.includes("prepaid") || nameLower.includes("advance")) {
      suggestion = { statementType: "BALANCE_SHEET", fsGroup: "Current Assets", lineItem: "Prepayments", confidence: 0.85 };
    } else if (nameLower.includes("fixed asset") || nameLower.includes("property") || nameLower.includes("plant") || nameLower.includes("equipment") || nameLower.includes("ppe")) {
      suggestion = { statementType: "BALANCE_SHEET", fsGroup: "Non-Current Assets", lineItem: "Property, Plant & Equipment", confidence: 0.9 };
    } else if (nameLower.includes("intangible") || nameLower.includes("goodwill") || nameLower.includes("patent") || nameLower.includes("software")) {
      suggestion = { statementType: "BALANCE_SHEET", fsGroup: "Non-Current Assets", lineItem: "Intangible Assets", confidence: 0.85 };
    } else if (nameLower.includes("payable") || nameLower.includes("creditor")) {
      suggestion = { statementType: "BALANCE_SHEET", fsGroup: "Current Liabilities", lineItem: "Trade Payables", confidence: 0.9 };
    } else if (nameLower.includes("accrual") || nameLower.includes("accrued")) {
      suggestion = { statementType: "BALANCE_SHEET", fsGroup: "Current Liabilities", lineItem: "Accruals", confidence: 0.85 };
    } else if (nameLower.includes("loan") || nameLower.includes("borrowing") || nameLower.includes("debt")) {
      if (nameLower.includes("short") || nameLower.includes("current")) {
        suggestion = { statementType: "BALANCE_SHEET", fsGroup: "Current Liabilities", lineItem: "Short-term Borrowings", confidence: 0.85 };
      } else {
        suggestion = { statementType: "BALANCE_SHEET", fsGroup: "Non-Current Liabilities", lineItem: "Long-term Borrowings", confidence: 0.85 };
      }
    } else if (nameLower.includes("capital") || nameLower.includes("share")) {
      suggestion = { statementType: "BALANCE_SHEET", fsGroup: "Equity", lineItem: "Share Capital", confidence: 0.9 };
    } else if (nameLower.includes("retained") || nameLower.includes("reserve")) {
      suggestion = { statementType: "BALANCE_SHEET", fsGroup: "Equity", lineItem: "Retained Earnings", confidence: 0.85 };
    } else if (nameLower.includes("revenue") || nameLower.includes("sales") || nameLower.includes("income") && !nameLower.includes("expense")) {
      if (nameLower.includes("interest")) {
        suggestion = { statementType: "PROFIT_LOSS", fsGroup: "Other Income", lineItem: "Interest Income", confidence: 0.9 };
      } else if (nameLower.includes("dividend")) {
        suggestion = { statementType: "PROFIT_LOSS", fsGroup: "Other Income", lineItem: "Dividend Income", confidence: 0.9 };
      } else {
        suggestion = { statementType: "PROFIT_LOSS", fsGroup: "Revenue", lineItem: "Sales Revenue", confidence: 0.9 };
      }
    } else if (nameLower.includes("cost of") || nameLower.includes("cogs") || nameLower.includes("direct")) {
      suggestion = { statementType: "PROFIT_LOSS", fsGroup: "Cost of Sales", lineItem: "Cost of Goods Sold", confidence: 0.85 };
    } else if (nameLower.includes("salary") || nameLower.includes("wage") || nameLower.includes("payroll")) {
      suggestion = { statementType: "PROFIT_LOSS", fsGroup: "Operating Expenses", lineItem: "Administrative Expenses", confidence: 0.8 };
    } else if (nameLower.includes("rent") || nameLower.includes("lease")) {
      suggestion = { statementType: "PROFIT_LOSS", fsGroup: "Operating Expenses", lineItem: "Administrative Expenses", confidence: 0.8 };
    } else if (nameLower.includes("depreciation") || nameLower.includes("amortization")) {
      suggestion = { statementType: "PROFIT_LOSS", fsGroup: "Operating Expenses", lineItem: "Depreciation & Amortization", confidence: 0.9 };
    } else if (nameLower.includes("interest expense") || nameLower.includes("finance cost") || nameLower.includes("bank charge")) {
      suggestion = { statementType: "PROFIT_LOSS", fsGroup: "Finance Costs", lineItem: "Interest Expense", confidence: 0.9 };
    } else if (nameLower.includes("tax") && !nameLower.includes("asset") && !nameLower.includes("liability")) {
      suggestion = { statementType: "PROFIT_LOSS", fsGroup: "Taxation", lineItem: "Current Tax", confidence: 0.85 };
    } else if (nameLower.includes("expense") || nameLower.includes("cost")) {
      suggestion = { statementType: "PROFIT_LOSS", fsGroup: "Operating Expenses", lineItem: "Administrative Expenses", confidence: 0.7 };
    }
    
    res.json({ suggestion });
    
  } catch (error) {
    console.error("Error generating AI suggestion:", error);
    res.status(500).json({ error: "Failed to generate suggestion" });
  }
});

router.get("/:engagementId/financial-statements", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    
    const trialBalance = await prisma.trialBalance.findFirst({
      where: { engagementId },
      orderBy: { importedDate: "desc" },
      include: { lineItems: true }
    });
    
    if (!trialBalance) {
      return res.status(404).json({ error: "No trial balance found" });
    }
    
    const mappings = await prisma.tBMapping.findMany({
      where: { trialBalanceId: trialBalance.id }
    });
    
    const balanceSheet: Record<string, Record<string, number>> = {};
    const profitLoss: Record<string, Record<string, number>> = {};
    
    mappings.forEach(mapping => {
      const lineItem = trialBalance.lineItems.find(li => li.accountCode === mapping.accountCode);
      if (!lineItem) return;
      
      const amount = Number(lineItem.closingBalance);
      const target = mapping.statementType === "BALANCE_SHEET" ? balanceSheet : profitLoss;
      
      if (!target[mapping.fsGroup]) {
        target[mapping.fsGroup] = {};
      }
      
      if (!target[mapping.fsGroup][mapping.lineItem]) {
        target[mapping.fsGroup][mapping.lineItem] = 0;
      }
      
      target[mapping.fsGroup][mapping.lineItem] += amount;
    });
    
    const unmappedAccounts = trialBalance.lineItems
      .filter(li => !mappings.find(m => m.accountCode === li.accountCode))
      .map(li => ({
        accountCode: li.accountCode,
        accountName: li.accountName,
        balance: Number(li.closingBalance)
      }));
    
    res.json({
      balanceSheet,
      profitLoss,
      unmappedAccounts,
      summary: {
        totalMapped: mappings.length,
        totalUnmapped: unmappedAccounts.length,
        mappingComplete: unmappedAccounts.length === 0
      }
    });
    
  } catch (error) {
    console.error("Error fetching financial statements:", error);
    res.status(500).json({ error: "Failed to fetch financial statements" });
  }
});

router.get("/:engagementId/export/mapping", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    
    const trialBalance = await prisma.trialBalance.findFirst({
      where: { engagementId },
      orderBy: { importedDate: "desc" },
      include: { lineItems: true }
    });
    
    if (!trialBalance) {
      return res.status(404).json({ error: "No trial balance found" });
    }
    
    const mappings = await prisma.tBMapping.findMany({
      where: { trialBalanceId: trialBalance.id },
      include: { mappedBy: { select: { fullName: true } } }
    });
    
    const exportData = trialBalance.lineItems.map(li => {
      const mapping = mappings.find(m => m.accountCode === li.accountCode);
      return {
        "Account Code": li.accountCode,
        "Account Name": li.accountName,
        "Debit": Number(li.debits),
        "Credit": Number(li.credits),
        "Net Balance": Number(li.closingBalance),
        "Statement Type": mapping?.statementType || "UNMAPPED",
        "FS Group": mapping?.fsGroup || "",
        "Line Item": mapping?.lineItem || "",
        "Mapping Source": mapping?.mappingSource || "",
        "Mapped By": mapping?.mappedBy?.fullName || "",
        "Mapped At": mapping?.mappedAt?.toISOString() || ""
      };
    });
    
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);
    XLSX.utils.book_append_sheet(wb, ws, "TB Mapping");
    
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=tb_mapping_${engagementId}.xlsx`);
    res.send(buffer);
    
  } catch (error) {
    console.error("Error exporting mapping:", error);
    res.status(500).json({ error: "Failed to export mapping" });
  }
});

router.post("/:engagementId/summary", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const { totalAssets, totalLiabilities, totalEquity, totalRevenue, totalExpenses, netIncome, profitBeforeTax } = req.body;
    
    let trialBalance = await prisma.trialBalance.findFirst({
      where: { engagementId },
      orderBy: { importedDate: "desc" }
    });
    
    if (!trialBalance) {
      trialBalance = await prisma.trialBalance.create({
        data: {
          engagementId,
          periodEnd: new Date(),
          importedById: req.user!.id,
          totalAssets: totalAssets || null,
          totalLiabilities: totalLiabilities || null,
          totalEquity: totalEquity || null,
          totalRevenue: totalRevenue || null,
          totalExpenses: totalExpenses || null,
          netIncome: netIncome || profitBeforeTax || null,
        }
      });
    } else {
      trialBalance = await prisma.trialBalance.update({
        where: { id: trialBalance.id },
        data: {
          totalAssets: totalAssets || trialBalance.totalAssets,
          totalLiabilities: totalLiabilities || trialBalance.totalLiabilities,
          totalEquity: totalEquity || trialBalance.totalEquity,
          totalRevenue: totalRevenue || trialBalance.totalRevenue,
          totalExpenses: totalExpenses || trialBalance.totalExpenses,
          netIncome: netIncome || profitBeforeTax || trialBalance.netIncome,
        }
      });
    }
    
    await logAuditTrail(
      req.user!.id,
      "TB_SUMMARY_UPDATED",
      "trial_balance",
      trialBalance.id,
      null,
      { totalAssets, totalEquity, totalRevenue, profitBeforeTax },
      engagementId,
      "Trial Balance summary values updated from TB push",
      req.ip,
      req.get("user-agent")
    );
    
    res.json({ 
      success: true, 
      summary: {
        totalAssets: trialBalance.totalAssets,
        totalLiabilities: trialBalance.totalLiabilities,
        totalEquity: trialBalance.totalEquity,
        totalRevenue: trialBalance.totalRevenue,
        totalExpenses: trialBalance.totalExpenses,
        netIncome: trialBalance.netIncome,
      }
    });
    
  } catch (error) {
    console.error("Error updating TB summary:", error);
    res.status(500).json({ error: "Failed to update trial balance summary" });
  }
});

router.get("/:engagementId/summary", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    
    const trialBalance = await prisma.trialBalance.findFirst({
      where: { engagementId },
      orderBy: { importedDate: "desc" },
      select: {
        id: true,
        totalAssets: true,
        totalLiabilities: true,
        totalEquity: true,
        totalRevenue: true,
        totalExpenses: true,
        netIncome: true,
        isFinalized: true,
      }
    });
    
    if (!trialBalance) {
      return res.json({ 
        totalAssets: null,
        totalLiabilities: null,
        totalEquity: null,
        totalRevenue: null,
        totalExpenses: null,
        netIncome: null,
        populated: false
      });
    }
    
    res.json({
      totalAssets: trialBalance.totalAssets ? Number(trialBalance.totalAssets) : null,
      totalLiabilities: trialBalance.totalLiabilities ? Number(trialBalance.totalLiabilities) : null,
      totalEquity: trialBalance.totalEquity ? Number(trialBalance.totalEquity) : null,
      totalRevenue: trialBalance.totalRevenue ? Number(trialBalance.totalRevenue) : null,
      totalExpenses: trialBalance.totalExpenses ? Number(trialBalance.totalExpenses) : null,
      netIncome: trialBalance.netIncome ? Number(trialBalance.netIncome) : null,
      populated: true
    });
    
  } catch (error) {
    console.error("Error fetching TB summary:", error);
    res.status(500).json({ error: "Failed to fetch trial balance summary" });
  }
});

// GL/TB Reconciliation Validation
// Validates: 1) TB arithmetic (opening + movements = closing)
// 2) GL movements match TB movements per account
// 3) Identifies discrepancies by account code
router.get("/:engagementId/validate", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    
    // Get latest Trial Balance with line items
    const trialBalance = await prisma.trialBalance.findFirst({
      where: { engagementId },
      orderBy: { importedDate: "desc" },
      include: {
        lineItems: true
      }
    });
    
    if (!trialBalance) {
      return res.status(404).json({ error: "No trial balance found for this engagement" });
    }
    
    // Get all GL entries for this engagement (from all batches)
    const glEntries = await prisma.gLEntry.findMany({
      where: { 
        engagementId,
        isDuplicate: false // Exclude duplicates
      },
      select: {
        accountCode: true,
        accountName: true,
        debit: true,
        credit: true,
        transactionDate: true,
        description: true,
        rowNumber: true
      }
    });
    
    interface ValidationError {
      accountCode: string;
      accountName: string;
      errorType: "TB_ARITHMETIC" | "GL_TB_MISMATCH" | "GL_IMBALANCED" | "MISSING_IN_GL" | "MISSING_IN_TB";
      severity: "ERROR" | "WARNING";
      message: string;
      details: {
        expectedValue?: number;
        actualValue?: number;
        difference?: number;
        glTotal?: { debit: number; credit: number; net: number };
        tbMovement?: { debit: number; credit: number; net: number };
      };
    }
    
    interface AccountSummary {
      accountCode: string;
      accountName: string;
      tbOpening: number;
      tbDebit: number;
      tbCredit: number;
      tbClosing: number;
      tbCalculatedClosing: number;
      glDebit: number;
      glCredit: number;
      glNet: number;
      tbNet: number;
      hasErrors: boolean;
      errors: ValidationError[];
    }
    
    const errors: ValidationError[] = [];
    const accountSummaries: AccountSummary[] = [];
    
    // Build GL summary by account code
    const glByAccount = new Map<string, { debit: number; credit: number; name: string }>();
    for (const entry of glEntries) {
      const code = entry.accountCode;
      const existing = glByAccount.get(code) || { debit: 0, credit: 0, name: entry.accountName };
      existing.debit += Number(entry.debit);
      existing.credit += Number(entry.credit);
      glByAccount.set(code, existing);
    }
    
    // Validate each TB line
    for (const line of trialBalance.lineItems) {
      const tbOpening = Number(line.openingBalance);
      const tbDebit = Number(line.debits);
      const tbCredit = Number(line.credits);
      const tbClosing = Number(line.closingBalance);
      
      // Calculate expected closing balance
      // For debit accounts: opening + debits - credits = closing
      // For credit accounts: opening - debits + credits = closing
      // General formula: closing = opening + debits - credits (net movement)
      const tbNet = tbDebit - tbCredit;
      const calculatedClosing = tbOpening + tbNet;
      
      const glData = glByAccount.get(line.accountCode);
      const glDebit = glData?.debit || 0;
      const glCredit = glData?.credit || 0;
      const glNet = glDebit - glCredit;
      
      const accountErrors: ValidationError[] = [];
      
      // Check 1: TB Arithmetic - Opening + Net Movement = Closing
      const arithmeticDiff = Math.abs(calculatedClosing - tbClosing);
      if (arithmeticDiff > 0.01) {
        accountErrors.push({
          accountCode: line.accountCode,
          accountName: line.accountName,
          errorType: "TB_ARITHMETIC",
          severity: "ERROR",
          message: `TB arithmetic error: Opening (${tbOpening.toLocaleString()}) + Movement (${tbNet.toLocaleString()}) ≠ Closing (${tbClosing.toLocaleString()})`,
          details: {
            expectedValue: calculatedClosing,
            actualValue: tbClosing,
            difference: arithmeticDiff
          }
        });
      }
      
      // Check 2: GL Movement matches TB Movement (only if GL data exists)
      if (glData) {
        const movementDiff = Math.abs(glNet - tbNet);
        if (movementDiff > 0.01) {
          accountErrors.push({
            accountCode: line.accountCode,
            accountName: line.accountName,
            errorType: "GL_TB_MISMATCH",
            severity: "ERROR",
            message: `GL/TB movement mismatch: GL net (${glNet.toLocaleString()}) ≠ TB net (${tbNet.toLocaleString()})`,
            details: {
              expectedValue: tbNet,
              actualValue: glNet,
              difference: movementDiff,
              glTotal: { debit: glDebit, credit: glCredit, net: glNet },
              tbMovement: { debit: tbDebit, credit: tbCredit, net: tbNet }
            }
          });
        }
        // Remove from map to track which GL accounts are unmatched
        glByAccount.delete(line.accountCode);
      } else if (tbDebit > 0 || tbCredit > 0) {
        // TB has movements but no GL data - warning only if there are movements
        accountErrors.push({
          accountCode: line.accountCode,
          accountName: line.accountName,
          errorType: "MISSING_IN_GL",
          severity: "WARNING",
          message: `Account has TB movements but no GL entries found`,
          details: {
            tbMovement: { debit: tbDebit, credit: tbCredit, net: tbNet }
          }
        });
      }
      
      accountSummaries.push({
        accountCode: line.accountCode,
        accountName: line.accountName,
        tbOpening,
        tbDebit,
        tbCredit,
        tbClosing,
        tbCalculatedClosing: calculatedClosing,
        glDebit,
        glCredit,
        glNet,
        tbNet,
        hasErrors: accountErrors.length > 0,
        errors: accountErrors
      });
      
      errors.push(...accountErrors);
    }
    
    // Check for GL accounts not in TB
    for (const [code, data] of glByAccount.entries()) {
      errors.push({
        accountCode: code,
        accountName: data.name,
        errorType: "MISSING_IN_TB",
        severity: "WARNING",
        message: `GL account not found in Trial Balance`,
        details: {
          glTotal: { debit: data.debit, credit: data.credit, net: data.debit - data.credit }
        }
      });
    }
    
    // Calculate overall TB totals
    const tbTotalDebit = trialBalance.lineItems.reduce((sum, l) => sum + Number(l.debits), 0);
    const tbTotalCredit = trialBalance.lineItems.reduce((sum, l) => sum + Number(l.credits), 0);
    const tbDifference = Math.abs(tbTotalDebit - tbTotalCredit);
    const tbIsBalanced = tbDifference < 0.01;
    
    // Calculate GL totals
    const glTotalDebit = glEntries.reduce((sum, e) => sum + Number(e.debit), 0);
    const glTotalCredit = glEntries.reduce((sum, e) => sum + Number(e.credit), 0);
    const glDifference = Math.abs(glTotalDebit - glTotalCredit);
    const glIsBalanced = glDifference < 0.01;
    
    // Add GL imbalance error if applicable
    if (!glIsBalanced && glEntries.length > 0) {
      errors.unshift({
        accountCode: "TOTAL",
        accountName: "GL Total",
        errorType: "GL_IMBALANCED",
        severity: "ERROR",
        message: `GL is not balanced: Total Debit (${glTotalDebit.toLocaleString()}) ≠ Total Credit (${glTotalCredit.toLocaleString()})`,
        details: {
          expectedValue: glTotalDebit,
          actualValue: glTotalCredit,
          difference: glDifference
        }
      });
    }
    
    // Sort errors by severity then account code
    const sortedErrors = errors.sort((a, b) => {
      if (a.severity !== b.severity) return a.severity === "ERROR" ? -1 : 1;
      return a.accountCode.localeCompare(b.accountCode);
    });
    
    res.json({
      success: true,
      trialBalanceId: trialBalance.id,
      summary: {
        tbAccountCount: trialBalance.lineItems.length,
        glEntryCount: glEntries.length,
        glAccountCount: new Set(glEntries.map(e => e.accountCode)).size,
        tbTotalDebit,
        tbTotalCredit,
        tbDifference,
        tbIsBalanced,
        glTotalDebit,
        glTotalCredit,
        glDifference,
        glIsBalanced,
        errorCount: errors.filter(e => e.severity === "ERROR").length,
        warningCount: errors.filter(e => e.severity === "WARNING").length,
        accountsWithErrors: accountSummaries.filter(a => a.hasErrors).length
      },
      validation: {
        arithmeticCheck: {
          passed: errors.filter(e => e.errorType === "TB_ARITHMETIC").length === 0,
          errors: errors.filter(e => e.errorType === "TB_ARITHMETIC").length
        },
        glTbReconciliation: {
          passed: errors.filter(e => e.errorType === "GL_TB_MISMATCH").length === 0,
          errors: errors.filter(e => e.errorType === "GL_TB_MISMATCH").length
        },
        completenessCheck: {
          passed: errors.filter(e => e.errorType === "MISSING_IN_GL" || e.errorType === "MISSING_IN_TB").length === 0,
          warnings: errors.filter(e => e.errorType === "MISSING_IN_GL" || e.errorType === "MISSING_IN_TB").length
        }
      },
      errors: sortedErrors,
      accountSummaries: accountSummaries.filter(a => a.hasErrors)
    });
    
  } catch (error) {
    console.error("Error validating TB:", error);
    res.status(500).json({ error: "Failed to validate trial balance" });
  }
});

// Bulk GL entries upload endpoint
router.post("/gl-entries/:engagementId/bulk", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const { entries } = req.body;
    
    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ error: "No entries provided" });
    }
    
    const engagement = await prisma.engagement.findUnique({
      where: { id: engagementId },
      include: { client: true },
    });
    
    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }
    
    // Calculate totals from entries
    let totalDebits = 0;
    let totalCredits = 0;
    for (const entry of entries) {
      totalDebits += parseFloat(entry.debit) || 0;
      totalCredits += parseFloat(entry.credit) || 0;
    }
    
    // Get the next batch number for this engagement
    const existingBatches = await prisma.gLBatch.count({
      where: { engagementId },
    });
    
    // Create a GLBatch first (required by foreign key constraint)
    const glBatch = await prisma.gLBatch.create({
      data: {
        engagementId,
        firmId: engagement.client.firmId,
        batchNumber: existingBatches + 1,
        batchName: `GL Batch ${Date.now()}`,
        periodStart: new Date(engagement.periodStart || new Date()),
        periodEnd: new Date(engagement.periodEnd || new Date()),
        fiscalYear: new Date(engagement.periodEnd || new Date()).getFullYear(),
        uploadedById: req.user!.id,
        totalDebits,
        totalCredits,
        entryCount: entries.length,
        isBalanced: Math.abs(totalDebits - totalCredits) < 0.01,
      },
    });
    
    const glEntries = entries.map((entry: any, index: number) => ({
      batchId: glBatch.id,
      engagementId,
      accountCode: entry.accountCode,
      accountName: entry.accountName,
      transactionDate: new Date(entry.transactionDate),
      description: entry.description || null,
      debit: entry.debit || 0,
      credit: entry.credit || 0,
      rowNumber: index + 1,
    }));
    
    await prisma.gLEntry.createMany({
      data: glEntries,
      skipDuplicates: true,
    });
    
    await logAuditTrail(
      req.user!.id,
      "GL_ENTRIES_BULK_UPLOAD",
      "GLEntry",
      glBatch.id,
      null,
      { entryCount: entries.length },
      engagementId
    );
    
    res.json({ 
      success: true, 
      count: entries.length,
      batchId: glBatch.id 
    });
    
  } catch (error) {
    console.error("Error uploading GL entries:", error);
    res.status(500).json({ error: "Failed to upload GL entries" });
  }
});

// Get all GL entries for GL Complete view (transaction-wise)
router.get("/gl-entries/:engagementId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    
    const glEntries = await prisma.gLEntry.findMany({
      where: { engagementId },
      select: {
        id: true,
        accountCode: true,
        accountName: true,
        transactionDate: true,
        description: true,
        debit: true,
        credit: true,
        reference: true,
      },
      orderBy: [
        { accountCode: 'asc' },
        { transactionDate: 'asc' },
      ],
    });
    
    // Map to frontend-friendly format
    const entries = glEntries.map(entry => ({
      id: entry.id,
      accountCode: entry.accountCode,
      accountName: entry.accountName,
      date: entry.transactionDate,
      description: entry.description || '',
      debit: entry.debit,
      credit: entry.credit,
      reference: entry.reference || '',
    }));
    
    res.json({ 
      entries,
      totalCount: entries.length,
    });
    
  } catch (error) {
    console.error("Error fetching GL entries:", error);
    res.status(500).json({ error: "Failed to fetch GL entries" });
  }
});

// Get GL summary by account code for reconciliation
router.get("/gl-summary/:engagementId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    
    const glEntries = await prisma.gLEntry.findMany({
      where: { engagementId },
      select: {
        accountCode: true,
        debit: true,
        credit: true,
        description: true,
      },
    });
    
    // Aggregate by account code with descriptions
    const summary: Record<string, { debit: number; credit: number; descriptions: string[]; entryCount: number }> = {};
    
    for (const entry of glEntries) {
      if (!summary[entry.accountCode]) {
        summary[entry.accountCode] = { debit: 0, credit: 0, descriptions: [], entryCount: 0 };
      }
      summary[entry.accountCode].debit += Number(entry.debit) || 0;
      summary[entry.accountCode].credit += Number(entry.credit) || 0;
      summary[entry.accountCode].entryCount += 1;
      
      // Collect unique descriptions (limit to first 5 to avoid too much data)
      if (entry.description && summary[entry.accountCode].descriptions.length < 5) {
        const desc = entry.description.trim();
        if (desc && !summary[entry.accountCode].descriptions.includes(desc)) {
          summary[entry.accountCode].descriptions.push(desc);
        }
      }
    }
    
    res.json({ 
      summary,
      totalEntries: glEntries.length,
      accountCount: Object.keys(summary).length
    });
    
  } catch (error) {
    console.error("Error fetching GL summary:", error);
    res.status(500).json({ error: "Failed to fetch GL summary" });
  }
});

// Get period detail drilldown for a specific account (DR or CR side)
router.get("/coa/:engagementId/account/:accountCode/period-detail", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId, accountCode } = req.params;
    const { 
      side = 'DR', 
      page = '1', 
      pageSize = '20', 
      from, 
      to, 
      search, 
      docType 
    } = req.query;
    
    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(pageSize as string) || 20));
    const offset = (pageNum - 1) * limit;
    
    // Build where clause
    const whereClause: any = {
      engagementId,
      accountCode,
    };
    
    // Filter by side (DR = debit > 0, CR = credit > 0)
    if (side === 'DR') {
      whereClause.debit = { gt: 0 };
    } else if (side === 'CR') {
      whereClause.credit = { gt: 0 };
    }
    
    // Date range filter
    if (from || to) {
      whereClause.transactionDate = {};
      if (from) whereClause.transactionDate.gte = new Date(from as string);
      if (to) whereClause.transactionDate.lte = new Date(to as string);
    }
    
    // Document type filter
    if (docType && docType !== 'ALL') {
      whereClause.documentType = docType;
    }
    
    // Search filter (voucher number or narrative)
    if (search) {
      whereClause.OR = [
        { voucherNumber: { contains: search as string, mode: 'insensitive' } },
        { narrative: { contains: search as string, mode: 'insensitive' } },
        { referenceNumber: { contains: search as string, mode: 'insensitive' } },
      ];
    }
    
    // Get total count
    const totalCount = await prisma.gLEntry.count({ where: whereClause });
    
    // Get paginated entries
    const entries = await prisma.gLEntry.findMany({
      where: whereClause,
      orderBy: { transactionDate: 'asc' },
      skip: offset,
      take: limit,
      select: {
        id: true,
        voucherNumber: true,
        transactionDate: true,
        documentType: true,
        referenceNumber: true,
        narrative: true,
        description: true,
        debit: true,
        credit: true,
      }
    });
    
    // Get totals for the full dataset (not paginated)
    const totals = await prisma.gLEntry.aggregate({
      where: whereClause,
      _sum: {
        debit: true,
        credit: true,
      },
      _count: true,
    });
    
    // Get date range
    const dateRange = await prisma.gLEntry.aggregate({
      where: { engagementId, accountCode },
      _min: { transactionDate: true },
      _max: { transactionDate: true },
    });
    
    // Get distinct document types for filter dropdown
    const docTypes = await prisma.gLEntry.groupBy({
      by: ['documentType'],
      where: { engagementId, accountCode },
      _count: true,
    });
    
    // Log audit trail
    await logAuditTrail(
      req.user!.id,
      "COA_PERIOD_DRILLDOWN_VIEWED",
      "GLEntry",
      accountCode,
      null,
      { side, page: pageNum, filters: { from, to, docType, search } },
      engagementId
    );
    
    res.json({
      success: true,
      totals: {
        count: totals._count || 0,
        totalDr: Number(totals._sum?.debit) || 0,
        totalCr: Number(totals._sum?.credit) || 0,
        totalAmountRequested: side === 'DR' ? Number(totals._sum?.debit) || 0 : Number(totals._sum?.credit) || 0,
      },
      dateRange: {
        from: dateRange._min?.transactionDate,
        to: dateRange._max?.transactionDate,
      },
      documentTypes: docTypes.map(dt => ({ 
        type: dt.documentType || 'UNKNOWN', 
        count: dt._count 
      })),
      rows: entries.map(e => ({
        id: e.id,
        voucherNo: e.voucherNumber || '-',
        date: e.transactionDate,
        docType: e.documentType || '-',
        ref: e.referenceNumber || '-',
        narrative: e.narrative || e.description || '-',
        debit: Number(e.debit) || 0,
        credit: Number(e.credit) || 0,
      })),
      meta: {
        page: pageNum,
        pageSize: limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasNextPage: pageNum * limit < totalCount,
        hasPrevPage: pageNum > 1,
      }
    });
    
  } catch (error) {
    console.error("Error fetching period detail:", error);
    res.status(500).json({ error: "Failed to fetch period detail" });
  }
});

// Get CoA with balance data from TB and GL
router.get("/coa-with-balances/:engagementId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    
    // Get all TB line items for this engagement (through TrialBalance)
    const tbData = await prisma.trialBalanceLine.findMany({
      where: { 
        trialBalance: {
          engagementId
        }
      },
      select: {
        accountCode: true,
        accountName: true,
        openingBalance: true,
        debits: true,
        credits: true,
        closingBalance: true,
      }
    });
    
    // Get GL summary
    const glEntries = await prisma.gLEntry.findMany({
      where: { engagementId },
      select: {
        accountCode: true,
        debit: true,
        credit: true,
      }
    });
    
    // Aggregate GL by account
    const glSummary: Record<string, { periodDr: number; periodCr: number; hasGl: boolean }> = {};
    for (const entry of glEntries) {
      if (!glSummary[entry.accountCode]) {
        glSummary[entry.accountCode] = { periodDr: 0, periodCr: 0, hasGl: true };
      }
      glSummary[entry.accountCode].periodDr += Number(entry.debit) || 0;
      glSummary[entry.accountCode].periodCr += Number(entry.credit) || 0;
    }
    
    // Build balance data per account
    const balances: Record<string, {
      openingBalance: number;
      periodDr: number;
      periodCr: number;
      closingBalance: number;
      tbMovementDr: number;
      tbMovementCr: number;
      hasGl: boolean;
    }> = {};
    
    for (const tb of tbData) {
      const openingBalance = Number(tb.openingBalance) || 0;
      const closingBalance = Number(tb.closingBalance) || 0;
      const tbDr = Number(tb.debits) || 0;
      const tbCr = Number(tb.credits) || 0;
      
      const gl = glSummary[tb.accountCode] || { periodDr: 0, periodCr: 0, hasGl: false };
      
      balances[tb.accountCode] = {
        openingBalance,
        periodDr: gl.hasGl ? gl.periodDr : tbDr,
        periodCr: gl.hasGl ? gl.periodCr : tbCr,
        closingBalance,
        tbMovementDr: tbDr,
        tbMovementCr: tbCr,
        hasGl: gl.hasGl,
      };
    }
    
    res.json({
      success: true,
      balances,
      hasGlData: Object.values(glSummary).some(g => g.hasGl),
    });
    
  } catch (error) {
    console.error("Error fetching CoA balances:", error);
    res.status(500).json({ error: "Failed to fetch CoA balances" });
  }
});

// ==========================================
// RECONCILIATION SUMMARY API ENDPOINTS
// ==========================================

interface ReconMismatch {
  accountCode: string;
  accountName: string;
  tbMovement: number;
  glMovement: number;
  difference: number;
  percentVariance: number;
}

interface ReconResult {
  lastRunAt: string | null;
  runBy: string | null;
  tolerance: number;
  tbTotals: {
    count: number;
    totalPeriodDr: number;
    totalPeriodCr: number;
    difference: number;
    isBalanced: boolean;
  };
  glTotals: {
    count: number;
    totalDr: number;
    totalCr: number;
    difference: number;
    isBalanced: boolean;
  };
  tbGlRecon: {
    totalMismatchAmount: number;
    mismatchCount: number;
    matchedCount: number;
    topMismatches: ReconMismatch[];
    isReconciled: boolean;
  };
  controlAccounts: {
    arOpenItems: number;
    arControl: number;
    arDifference: number;
    arReconciled: boolean;
    apOpenItems: number;
    apControl: number;
    apDifference: number;
    apReconciled: boolean;
    bankOpenItems: number;
    bankControl: number;
    bankDifference: number;
    bankReconciled: boolean;
  };
  dataQuality: {
    missingMandatory: number;
    invalidDates: number;
    invalidAmounts: number;
    duplicateKeys: number;
    totalIssues: number;
    score: number;
  };
  fsMapping: {
    totalAccounts: number;
    mappedAccounts: number;
    unmappedAmount: number;
    percentMapped: number;
  };
  hasTbData: boolean;
  hasGlData: boolean;
}

// GET /api/trial-balance/recon-summary/:engagementId - Get reconciliation summary
router.get("/recon-summary/:engagementId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const toleranceParam = req.query.tolerance;
    const tolerance = toleranceParam ? parseFloat(toleranceParam as string) : 0;

    const importBalancesCB = await prisma.importAccountBalance.findMany({
      where: { engagementId, balanceType: 'CB' },
      select: { accountCode: true, accountName: true, debitAmount: true, creditAmount: true }
    });

    let tbLines: any[] = [];
    let hasTbData = false;

    if (importBalancesCB.length > 0) {
      hasTbData = true;
      const importBalancesOB = await prisma.importAccountBalance.findMany({
        where: { engagementId, balanceType: 'OB' },
        select: { accountCode: true, debitAmount: true, creditAmount: true }
      });
      const obMap: Record<string, number> = {};
      for (const ob of importBalancesOB) {
        obMap[ob.accountCode] = Number(ob.debitAmount || 0) - Number(ob.creditAmount || 0);
      }
      for (const ib of importBalancesCB) {
        const closingBalance = Number(ib.debitAmount || 0) - Number(ib.creditAmount || 0);
        const openingBalance = obMap[ib.accountCode] || 0;
        tbLines.push({
          accountCode: ib.accountCode,
          accountName: ib.accountName,
          openingBalance,
          debits: Number(ib.debitAmount || 0),
          credits: Number(ib.creditAmount || 0),
          closingBalance,
        });
      }
    } else {
      tbLines = await prisma.trialBalanceLine.findMany({
        where: { trialBalance: { engagementId } },
        select: {
          accountCode: true,
          accountName: true,
          openingBalance: true,
          debits: true,
          credits: true,
          closingBalance: true,
        }
      });
      hasTbData = tbLines.length > 0;
    }

    let glEntries: any[] = await prisma.gLEntry.findMany({
      where: { engagementId },
      select: {
        accountCode: true,
        accountName: true,
        debit: true,
        credit: true,
        transactionDate: true,
        voucherNumber: true,
      }
    });

    let hasGlData = glEntries.length > 0;

    if (!hasGlData) {
      const importGlLines = await prisma.importJournalLine.findMany({
        where: {
          journalHeader: {
            batch: { engagementId }
          }
        },
        select: {
          accountCode: true,
          accountName: true,
          debit: true,
          credit: true,
          journalHeader: {
            select: {
              voucherNo: true,
              voucherDate: true,
            }
          }
        }
      });
      if (importGlLines.length > 0) {
        hasGlData = true;
        glEntries = importGlLines.map((gl: any) => ({
          accountCode: gl.accountCode,
          accountName: gl.accountName,
          debit: gl.debit,
          credit: gl.credit,
          transactionDate: gl.journalHeader?.voucherDate || null,
          voucherNumber: gl.journalHeader?.voucherNo || null,
        }));
      }
    }

    // Get parties for AR/AP open items from ImportPartyBalance
    const parties = await prisma.importPartyBalance.findMany({
      where: { engagementId },
      select: {
        partyCode: true,
        partyName: true,
        partyType: true,
        balance: true,
        balanceType: true,
      }
    });

    // Get bank accounts from ImportBankAccount
    const bankAccounts = await prisma.importBankAccount.findMany({
      where: { engagementId },
      select: {
        bankAccountCode: true,
        bankName: true,
        accountNo: true,
        accountTitle: true,
      }
    });
    
    // Get bank balances from ImportBankBalance
    const bankBalances = await prisma.importBankBalance.findMany({
      where: { engagementId },
      select: {
        bankAccountCode: true,
        closingBalance: true,
      }
    });


    // Compute TB totals
    let tbTotalDr = 0;
    let tbTotalCr = 0;
    for (const tb of tbLines) {
      tbTotalDr += Number(tb.debits) || 0;
      tbTotalCr += Number(tb.credits) || 0;
    }
    const tbDiff = Math.abs(tbTotalDr - tbTotalCr);
    const tbIsBalanced = tbDiff <= tolerance;

    // Compute GL totals
    let glTotalDr = 0;
    let glTotalCr = 0;
    for (const gl of glEntries) {
      glTotalDr += Number(gl.debit) || 0;
      glTotalCr += Number(gl.credit) || 0;
    }
    const glDiff = Math.abs(glTotalDr - glTotalCr);
    const glIsBalanced = glDiff <= tolerance;

    // Aggregate GL by account for TB↔GL reconciliation
    const glByAccount: Record<string, { dr: number; cr: number }> = {};
    for (const gl of glEntries) {
      if (!glByAccount[gl.accountCode]) {
        glByAccount[gl.accountCode] = { dr: 0, cr: 0 };
      }
      glByAccount[gl.accountCode].dr += Number(gl.debit) || 0;
      glByAccount[gl.accountCode].cr += Number(gl.credit) || 0;
    }

    const mismatches: ReconMismatch[] = [];
    let totalMismatchAmount = 0;
    let matchedCount = 0;

    for (const tb of tbLines) {
      const tbClosing = (Number(tb.debits) || 0) - (Number(tb.credits) || 0);
      const tbOpening = Number(tb.openingBalance) || 0;
      const tbMovement = tbClosing - tbOpening;
      const glData = glByAccount[tb.accountCode] || { dr: 0, cr: 0 };
      const glMovement = glData.dr - glData.cr;
      const diff = tbMovement - glMovement;

      if (Math.abs(diff) > tolerance) {
        totalMismatchAmount += Math.abs(diff);
        const percentVar = tbMovement !== 0 ? (diff / Math.abs(tbMovement)) * 100 : (diff !== 0 ? 100 : 0);
        mismatches.push({
          accountCode: tb.accountCode,
          accountName: tb.accountName || '',
          tbMovement,
          glMovement,
          difference: diff,
          percentVariance: Math.round(percentVar * 100) / 100,
        });
      } else {
        matchedCount++;
      }
    }

    // Sort by absolute difference descending, take top 10
    mismatches.sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));
    const topMismatches = mismatches.slice(0, 10);

    // Control accounts reconciliation
    // AR: Customers/Debtors (use closing balances from ImportPartyBalance)
    const arOpenItems = parties
      .filter((p: { partyType: string; balance: any; balanceType: string }) => 
        ['CUSTOMER', 'DEBTOR'].includes(p.partyType || '') && p.balanceType === 'CB')
      .reduce((sum: number, p: { balance: any }) => sum + (Number(p.balance) || 0), 0);

    // AP: Vendors/Suppliers/Creditors
    const apOpenItems = parties
      .filter((p: { partyType: string; balance: any; balanceType: string }) => 
        ['VENDOR', 'SUPPLIER', 'CREDITOR'].includes(p.partyType || '') && p.balanceType === 'CB')
      .reduce((sum: number, p: { balance: any }) => sum + (Number(p.balance) || 0), 0);

    // Bank totals (from bank balances)
    const bankTotal = bankBalances
      .reduce((sum: number, b) => sum + (Number(b.closingBalance) || 0), 0);

    // Get control account balances from TB (heuristic: account codes starting with common patterns)
    const arControlAccounts = tbLines.filter(tb => 
      tb.accountName?.toLowerCase().includes('receivable') ||
      tb.accountName?.toLowerCase().includes('debtor') ||
      tb.accountCode?.startsWith('11')
    );
    const arControl = arControlAccounts.reduce((sum, tb) => sum + (Number(tb.closingBalance) || 0), 0);

    const apControlAccounts = tbLines.filter(tb =>
      tb.accountName?.toLowerCase().includes('payable') ||
      tb.accountName?.toLowerCase().includes('creditor') ||
      tb.accountCode?.startsWith('20')
    );
    const apControl = apControlAccounts.reduce((sum, tb) => sum + (Number(tb.closingBalance) || 0), 0);

    const bankControlAccounts = tbLines.filter(tb =>
      tb.accountName?.toLowerCase().includes('bank') ||
      tb.accountName?.toLowerCase().includes('cash') ||
      tb.accountCode?.startsWith('10')
    );
    const bankControl = bankControlAccounts.reduce((sum, tb) => sum + (Number(tb.closingBalance) || 0), 0);

    // Data quality checks
    let missingMandatory = 0;
    let invalidDates = 0;
    let invalidAmounts = 0;
    const seenVouchers = new Set<string>();
    let duplicateKeys = 0;

    for (const tb of tbLines) {
      if (!tb.accountCode) missingMandatory++;
      if (!tb.accountName) missingMandatory++;
    }

    for (const gl of glEntries) {
      if (!gl.accountCode) missingMandatory++;
      if (!gl.voucherNumber) missingMandatory++;
      if (gl.transactionDate && isNaN(new Date(gl.transactionDate as any).getTime())) invalidDates++;
      const debit = Number(gl.debit) || 0;
      const credit = Number(gl.credit) || 0;
      if (debit < 0 || credit < 0) invalidAmounts++;

      const key = `${gl.voucherNumber || ''}-${gl.accountCode}-${Number(gl.debit) || 0}-${Number(gl.credit) || 0}`;
      if (seenVouchers.has(key)) {
        duplicateKeys++;
      } else {
        seenVouchers.add(key);
      }
    }

    const totalIssues = missingMandatory + invalidDates + invalidAmounts + duplicateKeys;
    const totalRecords = tbLines.length + glEntries.length;
    const dataQualityScore = totalRecords > 0 ? Math.max(0, Math.round((1 - totalIssues / totalRecords) * 100)) : 100;

    const mappingAllocations = await prisma.mappingAllocation.findMany({
      where: { engagementId },
      select: { accountCode: true, fsHeadId: true }
    });
    const mappedAccounts = mappingAllocations.filter((a: any) => a.fsHeadId).length;

    let totalAccountsForMapping = tbLines.length;
    if (totalAccountsForMapping === 0) {
      const importBalanceCount = await prisma.importAccountBalance.count({
        where: { engagementId, balanceType: 'CB' }
      });
      totalAccountsForMapping = importBalanceCount;
    }

    const mappedAccountCodes = new Set(mappingAllocations.filter((a: any) => a.fsHeadId).map((a: any) => a.accountCode));
    const unmappedAmount = tbLines
      .filter((tb: any) => !mappedAccountCodes.has(tb.accountCode))
      .reduce((sum: number, tb: any) => sum + Math.abs(Number(tb.closingBalance) || 0), 0);

    const result: ReconResult = {
      lastRunAt: new Date().toISOString(),
      runBy: req.user?.fullName || req.user?.email || null,
      tolerance,
      tbTotals: {
        count: tbLines.length,
        totalPeriodDr: tbTotalDr,
        totalPeriodCr: tbTotalCr,
        difference: tbDiff,
        isBalanced: tbIsBalanced,
      },
      glTotals: {
        count: glEntries.length,
        totalDr: glTotalDr,
        totalCr: glTotalCr,
        difference: glDiff,
        isBalanced: glIsBalanced,
      },
      tbGlRecon: {
        totalMismatchAmount,
        mismatchCount: mismatches.length,
        matchedCount,
        topMismatches,
        isReconciled: mismatches.length === 0,
      },
      controlAccounts: {
        arOpenItems,
        arControl,
        arDifference: Math.abs(arOpenItems - arControl),
        arReconciled: Math.abs(arOpenItems - arControl) <= tolerance,
        apOpenItems,
        apControl,
        apDifference: Math.abs(apOpenItems - apControl),
        apReconciled: Math.abs(apOpenItems - apControl) <= tolerance,
        bankOpenItems: bankTotal,
        bankControl,
        bankDifference: Math.abs(bankTotal - bankControl),
        bankReconciled: Math.abs(bankTotal - bankControl) <= tolerance,
      },
      dataQuality: {
        missingMandatory,
        invalidDates,
        invalidAmounts,
        duplicateKeys,
        totalIssues,
        score: dataQualityScore,
      },
      fsMapping: {
        totalAccounts: totalAccountsForMapping,
        mappedAccounts,
        unmappedAmount,
        percentMapped: totalAccountsForMapping > 0 ? Math.round((mappedAccounts / totalAccountsForMapping) * 100) : 0,
      },
      hasTbData,
      hasGlData,
    };

    res.json({ success: true, data: result });

  } catch (error) {
    console.error("Error fetching reconciliation summary:", error);
    res.status(500).json({ error: "Failed to fetch reconciliation summary" });
  }
});

// POST /api/trial-balance/recon-summary/:engagementId/run - Force recompute
router.post("/recon-summary/:engagementId/run", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const { tolerance = 0 } = req.body;

    // Log the recompute action
    await logAuditTrail(
      req.user!.id,
      "RECON_SUMMARY_RECOMPUTE",
      "ENGAGEMENT",
      engagementId,
      null,
      JSON.stringify({ tolerance }),
      engagementId,
      undefined,
      req.ip || undefined,
      req.get("User-Agent") || undefined
    );

    // Redirect to GET with tolerance parameter
    res.redirect(307, `/api/trial-balance/recon-summary/${engagementId}?tolerance=${tolerance}`);

  } catch (error) {
    console.error("Error running reconciliation:", error);
    res.status(500).json({ error: "Failed to run reconciliation" });
  }
});

// GET /api/trial-balance/recon-summary/:engagementId/export - Export CSV
router.get("/recon-summary/:engagementId/export", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const exportType = (req.query.type as string) || 'recon';
    const toleranceParam = req.query.tolerance;
    const tolerance = toleranceParam ? parseFloat(toleranceParam as string) : 0;

    const importBalancesCB = await prisma.importAccountBalance.findMany({
      where: { engagementId, balanceType: 'CB' },
      select: { accountCode: true, accountName: true, debitAmount: true, creditAmount: true }
    });

    let tbLines: any[] = [];

    if (importBalancesCB.length > 0) {
      const importBalancesOB = await prisma.importAccountBalance.findMany({
        where: { engagementId, balanceType: 'OB' },
        select: { accountCode: true, debitAmount: true, creditAmount: true }
      });
      const obMap: Record<string, number> = {};
      for (const ob of importBalancesOB) {
        obMap[ob.accountCode] = Number(ob.debitAmount || 0) - Number(ob.creditAmount || 0);
      }
      for (const ib of importBalancesCB) {
        const closingBalance = Number(ib.debitAmount || 0) - Number(ib.creditAmount || 0);
        const openingBalance = obMap[ib.accountCode] || 0;
        tbLines.push({
          accountCode: ib.accountCode,
          accountName: ib.accountName,
          openingBalance,
          debits: Number(ib.debitAmount || 0),
          credits: Number(ib.creditAmount || 0),
          closingBalance,
        });
      }
    } else {
      tbLines = await prisma.trialBalanceLine.findMany({
        where: { trialBalance: { engagementId } },
        select: {
          accountCode: true,
          accountName: true,
          openingBalance: true,
          debits: true,
          credits: true,
          closingBalance: true,
        }
      });
    }

    let glEntries: any[] = await prisma.gLEntry.findMany({
      where: { engagementId },
      select: {
        accountCode: true,
        debit: true,
        credit: true,
      }
    });

    if (glEntries.length === 0) {
      const importGlLines = await prisma.importJournalLine.findMany({
        where: {
          journalHeader: {
            batch: { engagementId }
          }
        },
        select: {
          accountCode: true,
          debit: true,
          credit: true,
        }
      });
      if (importGlLines.length > 0) {
        glEntries = importGlLines.map((gl: any) => ({
          accountCode: gl.accountCode,
          debit: gl.debit,
          credit: gl.credit,
        }));
      }
    }

    const glByAccount: Record<string, { dr: number; cr: number }> = {};
    for (const gl of glEntries) {
      if (!glByAccount[gl.accountCode]) {
        glByAccount[gl.accountCode] = { dr: 0, cr: 0 };
      }
      glByAccount[gl.accountCode].dr += Number(gl.debit) || 0;
      glByAccount[gl.accountCode].cr += Number(gl.credit) || 0;
    }

    let firmName = "AuditWise";
    if (req.user?.firmId) {
      const userFirm = await prisma.firm.findUnique({ where: { id: req.user.firmId }, select: { displayName: true, name: true } });
      if (userFirm) firmName = userFirm.displayName || userFirm.name;
    }

    if (exportType === 'exceptions') {
      const rows: string[] = [
        `"${firmName}"`,
        `"Reconciliation Exceptions Report"`,
        `"Generated: ${new Date().toLocaleDateString()}"`,
        '',
        'Account Code,Account Name,TB Movement,GL Movement,Difference,Status'
      ];
      
      for (const tb of tbLines) {
        const tbClosing = (Number(tb.debits) || 0) - (Number(tb.credits) || 0);
        const tbOpening = Number(tb.openingBalance) || 0;
        const tbMovement = tbClosing - tbOpening;
        const glData = glByAccount[tb.accountCode] || { dr: 0, cr: 0 };
        const glMovement = glData.dr - glData.cr;
        const diff = tbMovement - glMovement;

        if (Math.abs(diff) > tolerance) {
          rows.push(`"${tb.accountCode}","${tb.accountName || ''}",${tbMovement},${glMovement},${diff},MISMATCH`);
        }
      }

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${firmName.replace(/\s+/g, '_')}_recon_exceptions_${engagementId}.csv"`);
      res.send(rows.join('\n'));

    } else {
      const rows: string[] = [
        `"${firmName}"`,
        `"TB-GL Reconciliation Report"`,
        `"Generated: ${new Date().toLocaleDateString()}"`,
        '',
        'Account Code,Account Name,Opening Balance,TB Period Dr,TB Period Cr,Closing Balance,GL Total Dr,GL Total Cr,TB Movement,GL Movement,Difference,Status'
      ];
      
      for (const tb of tbLines) {
        const tbDr = Number(tb.debits) || 0;
        const tbCr = Number(tb.credits) || 0;
        const tbClosing = tbDr - tbCr;
        const tbOpening = Number(tb.openingBalance) || 0;
        const tbMovement = tbClosing - tbOpening;
        const glData = glByAccount[tb.accountCode] || { dr: 0, cr: 0 };
        const glMovement = glData.dr - glData.cr;
        const diff = tbMovement - glMovement;
        const status = Math.abs(diff) <= tolerance ? 'MATCHED' : 'MISMATCH';

        rows.push(`"${tb.accountCode}","${tb.accountName || ''}",${tbOpening},${tbDr},${tbCr},${Number(tb.closingBalance) || 0},${glData.dr},${glData.cr},${tbMovement},${glMovement},${diff},${status}`);
      }

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${firmName.replace(/\s+/g, '_')}_recon_report_${engagementId}.csv"`);
      res.send(rows.join('\n'));
    }

  } catch (error) {
    console.error("Error exporting reconciliation:", error);
    res.status(500).json({ error: "Failed to export reconciliation data" });
  }
});

// GET /api/trial-balance/recon-summary/:engagementId/mismatches - Get all mismatches for drilldown
router.get("/recon-summary/:engagementId/mismatches", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const toleranceParam = req.query.tolerance;
    const tolerance = toleranceParam ? parseFloat(toleranceParam as string) : 0;

    const importBalancesCB = await prisma.importAccountBalance.findMany({
      where: { engagementId, balanceType: 'CB' },
      select: { accountCode: true, accountName: true, debitAmount: true, creditAmount: true }
    });

    let tbLines: any[] = [];

    if (importBalancesCB.length > 0) {
      const importBalancesOB = await prisma.importAccountBalance.findMany({
        where: { engagementId, balanceType: 'OB' },
        select: { accountCode: true, debitAmount: true, creditAmount: true }
      });
      const obMap: Record<string, number> = {};
      for (const ob of importBalancesOB) {
        obMap[ob.accountCode] = Number(ob.debitAmount || 0) - Number(ob.creditAmount || 0);
      }
      for (const ib of importBalancesCB) {
        const closingBalance = Number(ib.debitAmount || 0) - Number(ib.creditAmount || 0);
        const openingBalance = obMap[ib.accountCode] || 0;
        tbLines.push({
          accountCode: ib.accountCode,
          accountName: ib.accountName,
          openingBalance,
          debits: Number(ib.debitAmount || 0),
          credits: Number(ib.creditAmount || 0),
          closingBalance,
        });
      }
    } else {
      tbLines = await prisma.trialBalanceLine.findMany({
        where: { trialBalance: { engagementId } },
        select: {
          accountCode: true,
          accountName: true,
          openingBalance: true,
          debits: true,
          credits: true,
          closingBalance: true,
        }
      });
    }

    let glEntries: any[] = await prisma.gLEntry.findMany({
      where: { engagementId },
      select: {
        accountCode: true,
        debit: true,
        credit: true,
      }
    });

    if (glEntries.length === 0) {
      const importGlLines = await prisma.importJournalLine.findMany({
        where: {
          journalHeader: {
            batch: { engagementId }
          }
        },
        select: {
          accountCode: true,
          debit: true,
          credit: true,
        }
      });
      if (importGlLines.length > 0) {
        glEntries = importGlLines.map((gl: any) => ({
          accountCode: gl.accountCode,
          debit: gl.debit,
          credit: gl.credit,
        }));
      }
    }

    const glByAccount: Record<string, { dr: number; cr: number }> = {};
    for (const gl of glEntries) {
      if (!glByAccount[gl.accountCode]) {
        glByAccount[gl.accountCode] = { dr: 0, cr: 0 };
      }
      glByAccount[gl.accountCode].dr += Number(gl.debit) || 0;
      glByAccount[gl.accountCode].cr += Number(gl.credit) || 0;
    }

    const mismatches: ReconMismatch[] = [];

    for (const tb of tbLines) {
      const tbClosing = (Number(tb.debits) || 0) - (Number(tb.credits) || 0);
      const tbOpening = Number(tb.openingBalance) || 0;
      const tbMovement = tbClosing - tbOpening;
      const glData = glByAccount[tb.accountCode] || { dr: 0, cr: 0 };
      const glMovement = glData.dr - glData.cr;
      const diff = tbMovement - glMovement;

      if (Math.abs(diff) > tolerance) {
        const percentVar = tbMovement !== 0 ? (diff / Math.abs(tbMovement)) * 100 : (diff !== 0 ? 100 : 0);
        mismatches.push({
          accountCode: tb.accountCode,
          accountName: tb.accountName || '',
          tbMovement,
          glMovement,
          difference: diff,
          percentVariance: Math.round(percentVar * 100) / 100,
        });
      }
    }

    mismatches.sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));

    res.json({ success: true, data: mismatches });

  } catch (error) {
    console.error("Error fetching mismatches:", error);
    res.status(500).json({ error: "Failed to fetch mismatches" });
  }
});

export default router;
