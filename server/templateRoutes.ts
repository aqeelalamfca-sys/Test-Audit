import { Router, Request, Response } from "express";
import ExcelJS from "exceljs";
import { generateUploadTemplateBuffer, getTemplateInfo } from "./services/templateGenerator";

async function getDemoData() {
  const mod = await import("./services/demoData");
  return {
    DEMO_TB_DATA: mod.DEMO_TB_DATA,
    DEMO_GL_ENTRIES: mod.DEMO_GL_ENTRIES,
    DEMO_AP_PARTIES: mod.DEMO_AP_PARTIES,
    DEMO_AR_PARTIES: mod.DEMO_AR_PARTIES,
    DEMO_BANK_MASTER: mod.DEMO_BANK_MASTER,
    DEMO_BANK_BALANCES: mod.DEMO_BANK_BALANCES,
  };
}

const router = Router();

router.get("/download/gl-template", async (req, res) => {
  try {
    const { DEMO_GL_ENTRIES } = await getDemoData();
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "AuditWise";
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet("GL");

    worksheet.columns = [
      { header: "Posting_Date", key: "postingDate", width: 14 },
      { header: "Voucher_No", key: "voucherNo", width: 14 },
      { header: "Voucher_Type", key: "voucherType", width: 14 },
      { header: "GL_Code", key: "glCode", width: 10 },
      { header: "GL_Name", key: "glName", width: 30 },
      { header: "Debit", key: "debit", width: 14 },
      { header: "Credit", key: "credit", width: 14 },
      { header: "Party_ID", key: "partyId", width: 12 },
      { header: "Party_Type", key: "partyType", width: 12 },
      { header: "Party_Name", key: "partyName", width: 20 },
      { header: "Document_No", key: "documentNo", width: 14 },
      { header: "Document_Date", key: "documentDate", width: 14 },
      { header: "Invoice_No", key: "invoiceNo", width: 14 },
      { header: "Due_Date", key: "dueDate", width: 14 },
      { header: "Cost_Center", key: "costCenter", width: 14 },
      { header: "Department", key: "department", width: 14 },
      { header: "Project", key: "project", width: 14 },
      { header: "Currency", key: "currency", width: 10 },
      { header: "Description", key: "description", width: 30 },
      { header: "Narration", key: "narration", width: 45 },
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1E40AF" },
    };
    headerRow.alignment = { horizontal: "center", vertical: "middle" };
    headerRow.height = 25;

    const sampleData = DEMO_GL_ENTRIES;

    sampleData.forEach((row, index) => {
      const dataRow = worksheet.addRow(row);
      dataRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: index % 2 === 0 ? "FFF3F4F6" : "FFFFFFFF" },
      };
    });

    ["F", "G"].forEach((col) => {
      for (let i = 2; i <= sampleData.length + 1; i++) {
        const cell = worksheet.getCell(`${col}${i}`);
        cell.numFmt = "#,##0";
      }
    });

    worksheet.eachRow((row: ExcelJS.Row) => {
      row.eachCell((cell: ExcelJS.Cell) => {
        cell.border = {
          top: { style: "thin", color: { argb: "FFE5E7EB" } },
          left: { style: "thin", color: { argb: "FFE5E7EB" } },
          bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
          right: { style: "thin", color: { argb: "FFE5E7EB" } },
        };
      });
    });

    const instructionsSheet = workbook.addWorksheet("Instructions");
    instructionsSheet.columns = [
      { header: "", key: "col1", width: 90 },
    ];

    const instructions = [
      "GENERAL LEDGER (GL) TEMPLATE - INSTRUCTIONS",
      "",
      "This template is designed for uploading detailed General Ledger transaction data to AuditWise.",
      "",
      "COLUMN DEFINITIONS:",
      "1. Posting_Date (Required): Transaction date in MM/DD/YYYY format",
      "2. Voucher_No (Required): Unique voucher identifier (e.g., JV-00001)",
      "3. Voucher_Type: Document type code - JV, BPV, BRV, CPV, CRV, SV, PV",
      "4. GL_Code (Required): Account code matching Trial Balance",
      "5. GL_Name: Descriptive name of the account",
      "6. Debit (Required): Amount debited (integer, leave 0 or blank if credit)",
      "7. Credit (Required): Amount credited (integer, leave 0 or blank if debit)",
      "8. Party_ID: Party identifier (must exist in Parties sheet)",
      "9. Party_Type: CUSTOMER, VENDOR, or OTHER",
      "10. Party_Name: Name of the party",
      "11. Document_No: Reference/document number",
      "12. Document_Date: Date of the source document",
      "13. Invoice_No: Invoice number for cross-referencing",
      "14. Due_Date: Payment due date",
      "15. Cost_Center: Cost center code",
      "16. Department: Department code",
      "17. Project: Project code",
      "18. Currency: Currency code (e.g., PKR, USD)",
      "19. Description: Short description of the transaction",
      "20. Narration: Detailed narrative of the transaction",
      "",
      "DOCUMENT TYPE CODES:",
      "- JV: Journal Voucher",
      "- BPV: Bank Payment Voucher",
      "- BRV: Bank Receipt Voucher",
      "- PV: Payment Voucher",
      "- RV: Receipt Voucher",
      "- INV: Invoice",
      "",
      "IMPORTANT NOTES:",
      "- Each row represents a single side of a journal entry (debit OR credit, not both)",
      "- Account codes must match those in your Trial Balance",
      "- Dates should be within your engagement period",
      "- Remove sample data before uploading your actual data",
      "",
      "After uploading, AuditWise will:",
      "1. Validate all entries against your Trial Balance",
      "2. Perform GL-TB reconciliation",
      "3. Flag any discrepancies for review",
    ];

    instructions.forEach((text, index) => {
      const row = instructionsSheet.addRow([text]);
      if (index === 0) {
        row.font = { bold: true, size: 14 };
      } else if (text.startsWith("COLUMN") || text.startsWith("DOCUMENT TYPE") || text.startsWith("IMPORTANT") || text.startsWith("After")) {
        row.font = { bold: true };
      }
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=AuditWise_GL_Template.xlsx"
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Error generating GL template:", error);
    res.status(500).json({ error: "Failed to generate template" });
  }
});

router.get("/download/tb-template", async (req, res) => {
  try {
    const { DEMO_TB_DATA } = await getDemoData();
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "AuditWise";
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet("Trial Balance");

    worksheet.columns = [
      { header: "GL_Code", key: "glCode", width: 10 },
      { header: "GL_Name", key: "glName", width: 35 },
      { header: "Opening_Balance", key: "openingBalance", width: 16 },
      { header: "Opening_Debit", key: "openingDebit", width: 16 },
      { header: "Opening_Credit", key: "openingCredit", width: 16 },
      { header: "Debit", key: "debit", width: 16 },
      { header: "Credit", key: "credit", width: 16 },
      { header: "Closing_Debit", key: "closingDebit", width: 16 },
      { header: "Closing_Credit", key: "closingCredit", width: 16 },
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF059669" },
    };
    headerRow.alignment = { horizontal: "center", vertical: "middle" };
    headerRow.height = 25;

    const sampleData = DEMO_TB_DATA;

    sampleData.forEach((row, index) => {
      const openingDebit = row.openingBalance >= 0 ? row.openingBalance : 0;
      const openingCredit = row.openingBalance < 0 ? Math.abs(row.openingBalance) : 0;
      const dataRow = worksheet.addRow({ ...row, openingDebit, openingCredit });
      dataRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: index % 2 === 0 ? "FFF0FDF4" : "FFFFFFFF" },
      };
    });

    const totalRow = worksheet.addRow({
      glCode: "",
      glName: "TOTAL",
      openingBalance: sampleData.reduce((sum, r) => sum + r.openingBalance, 0),
      openingDebit: sampleData.reduce((sum, r) => sum + (r.openingBalance >= 0 ? r.openingBalance : 0), 0),
      openingCredit: sampleData.reduce((sum, r) => sum + (r.openingBalance < 0 ? Math.abs(r.openingBalance) : 0), 0),
      debit: sampleData.reduce((sum, r) => sum + r.debit, 0),
      credit: sampleData.reduce((sum, r) => sum + r.credit, 0),
      closingDebit: sampleData.reduce((sum, r) => sum + r.closingDebit, 0),
      closingCredit: sampleData.reduce((sum, r) => sum + r.closingCredit, 0),
    });
    totalRow.font = { bold: true };
    totalRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFD1FAE5" },
    };

    ["C", "D", "E", "F", "G", "H", "I"].forEach((col) => {
      for (let i = 2; i <= sampleData.length + 2; i++) {
        const cell = worksheet.getCell(`${col}${i}`);
        cell.numFmt = "#,##0";
      }
    });

    worksheet.eachRow((row: ExcelJS.Row) => {
      row.eachCell((cell: ExcelJS.Cell) => {
        cell.border = {
          top: { style: "thin", color: { argb: "FFE5E7EB" } },
          left: { style: "thin", color: { argb: "FFE5E7EB" } },
          bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
          right: { style: "thin", color: { argb: "FFE5E7EB" } },
        };
      });
    });

    const fsLineSheet = workbook.addWorksheet("FS Line Items Reference");
    fsLineSheet.columns = [
      { header: "Category", key: "category", width: 25 },
      { header: "FS Line Item", key: "fsLine", width: 40 },
      { header: "Description", key: "description", width: 50 },
    ];

    const fsLineHeaderRow = fsLineSheet.getRow(1);
    fsLineHeaderRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    fsLineHeaderRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF7C3AED" },
    };

    const fsLines = [
      { category: "Current Assets", fsLine: "Cash and Cash Equivalents", description: "Cash, bank balances, short-term deposits" },
      { category: "Current Assets", fsLine: "Trade and Other Receivables", description: "Amounts due from customers and others" },
      { category: "Current Assets", fsLine: "Inventories", description: "Raw materials, WIP, finished goods" },
      { category: "Current Assets", fsLine: "Other Current Assets", description: "Prepayments, advances, other receivables" },
      { category: "Non-Current Assets", fsLine: "Property, Plant and Equipment", description: "Land, buildings, machinery, vehicles" },
      { category: "Non-Current Assets", fsLine: "Intangible Assets", description: "Software, licenses, goodwill" },
      { category: "Non-Current Assets", fsLine: "Investment Property", description: "Property held for rental/capital appreciation" },
      { category: "Non-Current Assets", fsLine: "Long-term Investments", description: "Investments in subsidiaries, associates" },
      { category: "Current Liabilities", fsLine: "Trade and Other Payables", description: "Amounts due to suppliers and others" },
      { category: "Current Liabilities", fsLine: "Short-term Borrowings", description: "Bank overdrafts, short-term loans" },
      { category: "Current Liabilities", fsLine: "Current Tax Liabilities", description: "Income tax payable" },
      { category: "Current Liabilities", fsLine: "Provisions - Current", description: "Short-term provisions" },
      { category: "Non-Current Liabilities", fsLine: "Long-term Borrowings", description: "Bank loans, bonds payable" },
      { category: "Non-Current Liabilities", fsLine: "Deferred Tax Liabilities", description: "Deferred income tax" },
      { category: "Non-Current Liabilities", fsLine: "Provisions - Non-Current", description: "Long-term provisions" },
      { category: "Equity", fsLine: "Share Capital", description: "Issued and paid-up capital" },
      { category: "Equity", fsLine: "Share Premium", description: "Excess over par value" },
      { category: "Equity", fsLine: "Retained Earnings", description: "Accumulated profits/losses" },
      { category: "Equity", fsLine: "Other Reserves", description: "Revaluation, hedging reserves" },
      { category: "Income", fsLine: "Revenue", description: "Sales of goods/services" },
      { category: "Income", fsLine: "Other Income", description: "Interest, rental, miscellaneous income" },
      { category: "Expenses", fsLine: "Cost of Sales", description: "Direct costs of goods/services sold" },
      { category: "Expenses", fsLine: "Administrative Expenses", description: "Salaries, rent, utilities, depreciation" },
      { category: "Expenses", fsLine: "Selling and Distribution", description: "Marketing, distribution costs" },
      { category: "Expenses", fsLine: "Finance Costs", description: "Interest expense, bank charges" },
      { category: "Expenses", fsLine: "Tax Expense", description: "Income tax expense for the period" },
    ];

    fsLines.forEach((row) => {
      fsLineSheet.addRow(row);
    });

    const instructionsSheet = workbook.addWorksheet("Instructions");
    instructionsSheet.columns = [
      { header: "", key: "col1", width: 90 },
    ];

    const instructions = [
      "TRIAL BALANCE (TB) TEMPLATE - INSTRUCTIONS",
      "",
      "This template is designed for uploading Trial Balance data to AuditWise.",
      "",
      "COLUMN DEFINITIONS:",
      "1. GL_Code (Required): Account code (e.g., 10001, 20001, 40001)",
      "2. GL_Name: Descriptive name of the account",
      "3. Opening_Balance (Required): Net balance at the start of the period (integer)",
      "4. Opening_Debit: Opening debit balance (optional, integer)",
      "5. Opening_Credit: Opening credit balance (optional, integer)",
      "6. Debit (Required): Total debit movements during the period (integer)",
      "7. Credit (Required): Total credit movements during the period (integer)",
      "8. Closing_Debit: Closing debit balance (optional, integer)",
      "9. Closing_Credit: Closing credit balance (optional, integer)",
      "",
      "ACCOUNT CODE STRUCTURE:",
      "- 10xxx: Cash & Bank",
      "- 11xxx: Receivables",
      "- 12xxx: Inventory",
      "- 13xxx: Fixed Assets",
      "- 14xxx: Accumulated Depreciation",
      "- 20xxx: Current Liabilities",
      "- 21xxx: Short Term Loans",
      "- 22xxx: Long Term Liabilities",
      "- 30xxx: Equity",
      "- 40xxx: Revenue",
      "- 50xxx: Cost of Sales",
      "- 51xxx-56xxx: Expenses",
      "- 60xxx: Other Income",
      "- 70xxx: Taxation",
      "",
      "IMPORTANT NOTES:",
      "- Total Debits should equal Total Credits in the period movements",
      "- Each account typically has either a Debit OR Credit closing balance",
      "- Account codes must be unique",
      "- Remove sample data before uploading your actual data",
      "",
      "AFTER UPLOAD:",
      "1. AuditWise will validate the Trial Balance",
      "2. AI will suggest Financial Statement line item mappings",
      "3. You can review and override AI suggestions",
      "4. Generate Financial Statements",
      "5. Partner approval workflow",
    ];

    instructions.forEach((text, index) => {
      const row = instructionsSheet.addRow([text]);
      if (index === 0) {
        row.font = { bold: true, size: 14 };
      } else if (text.startsWith("COLUMN") || text.startsWith("ACCOUNT CODE") || text.startsWith("IMPORTANT") || text.startsWith("AFTER UPLOAD")) {
        row.font = { bold: true };
      }
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=AuditWise_TB_Template.xlsx"
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Error generating TB template:", error);
    res.status(500).json({ error: "Failed to generate template" });
  }
});

router.get("/download/ap-template", async (req, res) => {
  try {
    const { DEMO_AP_PARTIES } = await getDemoData();
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "AuditWise";
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet("Accounts Payable");

    worksheet.columns = [
      { header: "Vendor_ID", key: "vendorId", width: 14 },
      { header: "Vendor_Name", key: "vendorName", width: 35 },
      { header: "GL_Code", key: "glCode", width: 14 },
      { header: "Invoice_No", key: "invoiceNo", width: 20 },
      { header: "Invoice_Date", key: "invoiceDate", width: 14 },
      { header: "Due_Date", key: "dueDate", width: 14 },
      { header: "Amount", key: "amount", width: 16 },
      { header: "Balance", key: "balance", width: 16 },
      { header: "Currency", key: "currency", width: 10 },
      { header: "Email", key: "email", width: 30 },
      { header: "Address", key: "address", width: 30 },
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFEA580C" },
    };
    headerRow.alignment = { horizontal: "center", vertical: "middle" };
    headerRow.height = 25;

    const sampleData = DEMO_AP_PARTIES;

    sampleData.forEach((row, index) => {
      const dataRow = worksheet.addRow({
        vendorId: row.vendorId,
        vendorName: row.vendorName,
        glCode: row.glCode,
        invoiceNo: `INV-AP-${row.vendorId}`,
        invoiceDate: "12/31/2024",
        dueDate: "12/31/2024",
        amount: row.closingCredit,
        balance: row.closingCredit,
        currency: "PKR",
        email: row.email,
        address: "",
      });
      dataRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: index % 2 === 0 ? "FFFEF3E0" : "FFFFFFFF" },
      };
    });

    ["G", "H"].forEach((col) => {
      for (let i = 2; i <= sampleData.length + 1; i++) {
        const cell = worksheet.getCell(`${col}${i}`);
        cell.numFmt = "#,##0";
      }
    });

    worksheet.eachRow((row: ExcelJS.Row) => {
      row.eachCell((cell: ExcelJS.Cell) => {
        cell.border = {
          top: { style: "thin", color: { argb: "FFE5E7EB" } },
          left: { style: "thin", color: { argb: "FFE5E7EB" } },
          bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
          right: { style: "thin", color: { argb: "FFE5E7EB" } },
        };
      });
    });

    const instructionsSheet = workbook.addWorksheet("Instructions");
    instructionsSheet.columns = [
      { header: "", key: "col1", width: 90 },
    ];

    const instructions = [
      "ACCOUNTS PAYABLE (AP) SUBLEDGER TEMPLATE - INSTRUCTIONS",
      "",
      "This template is designed for uploading Accounts Payable subledger data to AuditWise.",
      "",
      "COLUMN DEFINITIONS:",
      "1. Vendor_ID (Required): Unique identifier for each supplier/creditor (e.g., AP-001)",
      "2. Vendor_Name (Required): Full name of the supplier/creditor",
      "3. GL_Code: GL account code that this vendor maps to (e.g., 20001)",
      "4. Invoice_No (Required): Invoice number",
      "5. Invoice_Date: Date of the invoice",
      "6. Due_Date: Payment due date",
      "7. Amount (Required): Invoice amount (integer)",
      "8. Balance (Required): Outstanding balance (integer)",
      "9. Currency: Currency code (e.g., PKR, USD)",
      "10. Email: Supplier contact email (used for sending AP confirmations)",
      "11. Address: Supplier address",
      "",
      "IMPORTANT NOTES:",
      "- Total of all party balances should match the control account balance in the Trial Balance",
      "- Each party should typically have either a Debit OR Credit balance, not both",
      "- Email and phone are used for automated AP confirmation generation",
      "- Remove sample data before uploading your actual data",
      "",
      "AFTER UPLOAD:",
      "1. AuditWise will validate party balances against the control account",
      "2. AP aging analysis will be generated automatically",
      "3. AP confirmation letters can be generated for selected parties",
      "4. Reconciliation between AP sub-ledger and GL will be performed",
    ];

    instructions.forEach((text, index) => {
      const row = instructionsSheet.addRow([text]);
      if (index === 0) {
        row.font = { bold: true, size: 14 };
      } else if (text.startsWith("COLUMN") || text.startsWith("IMPORTANT") || text.startsWith("AFTER UPLOAD")) {
        row.font = { bold: true };
      }
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=AuditWise_AP_Template.xlsx"
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Error generating AP template:", error);
    res.status(500).json({ error: "Failed to generate template" });
  }
});

router.get("/download/ar-template", async (req, res) => {
  try {
    const { DEMO_AR_PARTIES } = await getDemoData();
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "AuditWise";
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet("Accounts Receivable");

    worksheet.columns = [
      { header: "Customer_ID", key: "customerId", width: 14 },
      { header: "Customer_Name", key: "customerName", width: 35 },
      { header: "GL_Code", key: "glCode", width: 14 },
      { header: "Invoice_No", key: "invoiceNo", width: 20 },
      { header: "Invoice_Date", key: "invoiceDate", width: 14 },
      { header: "Due_Date", key: "dueDate", width: 14 },
      { header: "Amount", key: "amount", width: 16 },
      { header: "Balance", key: "balance", width: 16 },
      { header: "Currency", key: "currency", width: 10 },
      { header: "Email", key: "email", width: 30 },
      { header: "Address", key: "address", width: 30 },
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0D9488" },
    };
    headerRow.alignment = { horizontal: "center", vertical: "middle" };
    headerRow.height = 25;

    const sampleData = DEMO_AR_PARTIES;

    sampleData.forEach((row, index) => {
      const dataRow = worksheet.addRow({
        customerId: row.customerId,
        customerName: row.customerName,
        glCode: row.glCode,
        invoiceNo: `INV-AR-${row.customerId}`,
        invoiceDate: "12/31/2024",
        dueDate: "12/31/2024",
        amount: row.closingDebit,
        balance: row.closingDebit,
        currency: "PKR",
        email: row.email,
        address: "",
      });
      dataRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: index % 2 === 0 ? "FFF0FDFA" : "FFFFFFFF" },
      };
    });

    ["G", "H"].forEach((col) => {
      for (let i = 2; i <= sampleData.length + 1; i++) {
        const cell = worksheet.getCell(`${col}${i}`);
        cell.numFmt = "#,##0";
      }
    });

    worksheet.eachRow((row: ExcelJS.Row) => {
      row.eachCell((cell: ExcelJS.Cell) => {
        cell.border = {
          top: { style: "thin", color: { argb: "FFE5E7EB" } },
          left: { style: "thin", color: { argb: "FFE5E7EB" } },
          bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
          right: { style: "thin", color: { argb: "FFE5E7EB" } },
        };
      });
    });

    const instructionsSheet = workbook.addWorksheet("Instructions");
    instructionsSheet.columns = [
      { header: "", key: "col1", width: 90 },
    ];

    const instructions = [
      "ACCOUNTS RECEIVABLE (AR) SUBLEDGER TEMPLATE - INSTRUCTIONS",
      "",
      "This template is designed for uploading Accounts Receivable subledger data to AuditWise.",
      "",
      "COLUMN DEFINITIONS:",
      "1. Customer_ID (Required): Unique identifier for each customer/debtor (e.g., AR-001)",
      "2. Customer_Name (Required): Full name of the customer/debtor",
      "3. GL_Code: GL account code that this customer maps to (e.g., 11001)",
      "4. Invoice_No (Required): Invoice number",
      "5. Invoice_Date: Date of the invoice",
      "6. Due_Date: Payment due date",
      "7. Amount (Required): Invoice amount (integer)",
      "8. Balance (Required): Outstanding balance (integer)",
      "9. Currency: Currency code (e.g., PKR, USD)",
      "10. Email: Customer contact email (used for sending AR confirmations)",
      "11. Address: Customer address",
      "",
      "IMPORTANT NOTES:",
      "- Total of all party balances should match the control account balance in the Trial Balance",
      "- Each party should typically have either a Debit OR Credit balance, not both",
      "- Email and phone are used for automated AR confirmation generation",
      "- Remove sample data before uploading your actual data",
      "",
      "AFTER UPLOAD:",
      "1. AuditWise will validate party balances against the control account",
      "2. AR aging analysis will be generated automatically",
      "3. AR confirmation letters can be generated for selected parties",
      "4. Reconciliation between AR sub-ledger and GL will be performed",
    ];

    instructions.forEach((text, index) => {
      const row = instructionsSheet.addRow([text]);
      if (index === 0) {
        row.font = { bold: true, size: 14 };
      } else if (text.startsWith("COLUMN") || text.startsWith("IMPORTANT") || text.startsWith("AFTER UPLOAD")) {
        row.font = { bold: true };
      }
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=AuditWise_AR_Template.xlsx"
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Error generating AR template:", error);
    res.status(500).json({ error: "Failed to generate template" });
  }
});

router.get("/download/bank-template", async (req, res) => {
  try {
    const { DEMO_BANK_MASTER, DEMO_BANK_BALANCES } = await getDemoData();
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "AuditWise";
    workbook.created = new Date();

    const bankAccountsSheet = workbook.addWorksheet("Bank");

    bankAccountsSheet.columns = [
      { header: "Bank_Account_ID", key: "bankAccountId", width: 16 },
      { header: "Party_ID", key: "partyId", width: 12 },
      { header: "GL_Code", key: "glCode", width: 12 },
      { header: "Account_Number", key: "accountNumber", width: 22 },
      { header: "Bank_Name", key: "bankName", width: 30 },
      { header: "Account_Title", key: "accountTitle", width: 30 },
      { header: "Branch", key: "branch", width: 25 },
      { header: "IBAN", key: "iban", width: 30 },
      { header: "SWIFT_BIC", key: "swiftBic", width: 14 },
      { header: "Currency", key: "currency", width: 10 },
      { header: "Confirmation_Email_or_Address", key: "confirmationEmail", width: 30 },
      { header: "Relationship_Manager", key: "relationshipManager", width: 25 },
    ];

    const bankAccountsHeader = bankAccountsSheet.getRow(1);
    bankAccountsHeader.font = { bold: true, color: { argb: "FFFFFFFF" } };
    bankAccountsHeader.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0891B2" },
    };
    bankAccountsHeader.alignment = { horizontal: "center", vertical: "middle" };
    bankAccountsHeader.height = 25;

    DEMO_BANK_MASTER.forEach((row, index) => {
      const dataRow = bankAccountsSheet.addRow({
        bankAccountId: row.bankAccountId,
        partyId: "",
        glCode: row.glCode,
        accountNumber: row.accountNumber,
        bankName: row.bankName,
        accountTitle: row.bankName,
        branch: row.branch,
        iban: "",
        swiftBic: "",
        currency: row.currency,
        confirmationEmail: "",
        relationshipManager: "",
      });
      dataRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: index % 2 === 0 ? "FFECFEFF" : "FFFFFFFF" },
      };
    });

    bankAccountsSheet.eachRow((row: ExcelJS.Row) => {
      row.eachCell((cell: ExcelJS.Cell) => {
        cell.border = {
          top: { style: "thin", color: { argb: "FFE5E7EB" } },
          left: { style: "thin", color: { argb: "FFE5E7EB" } },
          bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
          right: { style: "thin", color: { argb: "FFE5E7EB" } },
        };
      });
    });

    const bankBalancesSheet = workbook.addWorksheet("Bank_Balances");

    bankBalancesSheet.columns = [
      { header: "Bank_Account_ID", key: "bankAccountId", width: 16 },
      { header: "Statement_Date", key: "statementDate", width: 14 },
      { header: "Closing_Balance", key: "closingBalance", width: 18 },
      { header: "Currency", key: "currency", width: 10 },
    ];

    const bankBalancesHeader = bankBalancesSheet.getRow(1);
    bankBalancesHeader.font = { bold: true, color: { argb: "FFFFFFFF" } };
    bankBalancesHeader.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF4F46E5" },
    };
    bankBalancesHeader.alignment = { horizontal: "center", vertical: "middle" };
    bankBalancesHeader.height = 25;

    const bankMasterMap = new Map(DEMO_BANK_MASTER.map(m => [m.bankAccountId, m]));
    DEMO_BANK_BALANCES.forEach((row, index) => {
      const master = bankMasterMap.get(row.bankAccountId);
      const dataRow = bankBalancesSheet.addRow({
        bankAccountId: row.bankAccountId,
        statementDate: row.statementDate,
        closingBalance: row.bookBalance,
        currency: master?.currency || "PKR",
      });
      dataRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: index % 2 === 0 ? "FFEEF2FF" : "FFFFFFFF" },
      };
    });

    ["C"].forEach((col) => {
      for (let i = 2; i <= DEMO_BANK_BALANCES.length + 1; i++) {
        const cell = bankBalancesSheet.getCell(`${col}${i}`);
        cell.numFmt = "#,##0";
      }
    });

    bankBalancesSheet.eachRow((row: ExcelJS.Row) => {
      row.eachCell((cell: ExcelJS.Cell) => {
        cell.border = {
          top: { style: "thin", color: { argb: "FFE5E7EB" } },
          left: { style: "thin", color: { argb: "FFE5E7EB" } },
          bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
          right: { style: "thin", color: { argb: "FFE5E7EB" } },
        };
      });
    });

    const instructionsSheet = workbook.addWorksheet("Instructions");
    instructionsSheet.columns = [
      { header: "", key: "col1", width: 90 },
    ];

    const instructions = [
      "BANK TEMPLATE - INSTRUCTIONS",
      "",
      "This template is designed for uploading Bank Account master data and balances to AuditWise.",
      "",
      "SHEET 1: BANK ACCOUNTS",
      "Contains master information about each bank account.",
      "",
      "COLUMN DEFINITIONS - BANK ACCOUNTS:",
      "1. Bank_Account_ID (Required): Unique identifier for each bank account (e.g., HBL-001)",
      "2. Party_ID: Reference to Parties sheet",
      "3. GL_Code (Required): General Ledger account code for this bank account",
      "4. Account_Number (Required): Full bank account number",
      "5. Bank_Name: Name of the bank",
      "6. Account_Title: Account title at bank",
      "7. Branch: Branch name or location",
      "8. IBAN: International Bank Account Number",
      "9. SWIFT_BIC: SWIFT/BIC code",
      "10. Currency: Currency code (e.g., PKR, USD)",
      "11. Confirmation_Email_or_Address: Email or address for bank confirmations",
      "12. Relationship_Manager: Bank relationship manager contact",
      "",
      "SHEET 2: BANK BALANCES",
      "Contains balance information for bank reconciliation.",
      "",
      "COLUMN DEFINITIONS - BANK BALANCES:",
      "1. Bank_Account_ID (Required): Must match a Bank_Account_ID from the Bank sheet",
      "2. Statement_Date (Required): Date of the bank statement (MM/DD/YYYY)",
      "3. Closing_Balance (Required): Closing balance amount (integer)",
      "4. Currency: Currency code (e.g., PKR, USD)",
      "",
      "IMPORTANT NOTES:",
      "- Bank codes must be consistent between the two sheets",
      "- GL Account codes should match your Trial Balance",
      "- Book balance should reconcile with the corresponding GL account closing balance",
      "- Remove sample data before uploading your actual data",
      "",
      "AFTER UPLOAD:",
      "1. AuditWise will validate bank data against your GL balances",
      "2. Bank confirmation letters can be generated for each bank",
      "3. Bank reconciliation status will be tracked",
      "4. Outstanding items can be identified for follow-up",
    ];

    instructions.forEach((text, index) => {
      const row = instructionsSheet.addRow([text]);
      if (index === 0) {
        row.font = { bold: true, size: 14 };
      } else if (text.startsWith("COLUMN") || text.startsWith("SHEET") || text.startsWith("IMPORTANT") || text.startsWith("AFTER UPLOAD")) {
        row.font = { bold: true };
      }
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=AuditWise_Bank_Template.xlsx"
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Error generating Bank template:", error);
    res.status(500).json({ error: "Failed to generate template" });
  }
});

router.get("/download/fs-template", async (req, res) => {
  try {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "AuditWise";
    workbook.created = new Date();

    const bsSheet = workbook.addWorksheet("Balance Sheet");
    bsSheet.columns = [
      { header: "Line Item", key: "lineItem", width: 45 },
      { header: "Note", key: "note", width: 10 },
      { header: "Current Year", key: "currentYear", width: 18 },
      { header: "Prior Year", key: "priorYear", width: 18 },
    ];

    const bsHeaderRow = bsSheet.getRow(1);
    bsHeaderRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    bsHeaderRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1E40AF" },
    };

    const balanceSheetItems = [
      { lineItem: "ASSETS", note: "", currentYear: "", priorYear: "", isHeader: true },
      { lineItem: "Non-Current Assets", note: "", currentYear: "", priorYear: "", isSubHeader: true },
      { lineItem: "Property, Plant and Equipment", note: "9", currentYear: 1350000, priorYear: 1200000 },
      { lineItem: "Intangible Assets", note: "10", currentYear: 0, priorYear: 0 },
      { lineItem: "Long-term Investments", note: "11", currentYear: 0, priorYear: 0 },
      { lineItem: "Total Non-Current Assets", note: "", currentYear: 1350000, priorYear: 1200000, isTotal: true },
      { lineItem: "", note: "", currentYear: "", priorYear: "" },
      { lineItem: "Current Assets", note: "", currentYear: "", priorYear: "", isSubHeader: true },
      { lineItem: "Inventories", note: "7", currentYear: 430000, priorYear: 350000 },
      { lineItem: "Trade and Other Receivables", note: "6", currentYear: 475000, priorYear: 380000 },
      { lineItem: "Cash and Cash Equivalents", note: "5", currentYear: 880000, priorYear: 550000 },
      { lineItem: "Other Current Assets", note: "8", currentYear: 30000, priorYear: 25000 },
      { lineItem: "Total Current Assets", note: "", currentYear: 1815000, priorYear: 1305000, isTotal: true },
      { lineItem: "", note: "", currentYear: "", priorYear: "" },
      { lineItem: "TOTAL ASSETS", note: "", currentYear: 3165000, priorYear: 2505000, isGrandTotal: true },
      { lineItem: "", note: "", currentYear: "", priorYear: "" },
      { lineItem: "EQUITY AND LIABILITIES", note: "", currentYear: "", priorYear: "", isHeader: true },
      { lineItem: "Equity", note: "", currentYear: "", priorYear: "", isSubHeader: true },
      { lineItem: "Share Capital", note: "12", currentYear: 1000000, priorYear: 1000000 },
      { lineItem: "Retained Earnings", note: "13", currentYear: 985000, priorYear: 500000 },
      { lineItem: "Total Equity", note: "", currentYear: 1985000, priorYear: 1500000, isTotal: true },
      { lineItem: "", note: "", currentYear: "", priorYear: "" },
      { lineItem: "Non-Current Liabilities", note: "", currentYear: "", priorYear: "", isSubHeader: true },
      { lineItem: "Long-term Borrowings", note: "14", currentYear: 500000, priorYear: 600000 },
      { lineItem: "Deferred Tax Liabilities", note: "15", currentYear: 0, priorYear: 0 },
      { lineItem: "Total Non-Current Liabilities", note: "", currentYear: 500000, priorYear: 600000, isTotal: true },
      { lineItem: "", note: "", currentYear: "", priorYear: "" },
      { lineItem: "Current Liabilities", note: "", currentYear: "", priorYear: "", isSubHeader: true },
      { lineItem: "Trade and Other Payables", note: "10", currentYear: 490000, priorYear: 325000 },
      { lineItem: "Short-term Borrowings", note: "16", currentYear: 100000, priorYear: 0 },
      { lineItem: "Current Tax Liabilities", note: "11", currentYear: 75000, priorYear: 65000 },
      { lineItem: "Provisions", note: "17", currentYear: 15000, priorYear: 15000 },
      { lineItem: "Total Current Liabilities", note: "", currentYear: 680000, priorYear: 405000, isTotal: true },
      { lineItem: "", note: "", currentYear: "", priorYear: "" },
      { lineItem: "TOTAL EQUITY AND LIABILITIES", note: "", currentYear: 3165000, priorYear: 2505000, isGrandTotal: true },
    ];

    balanceSheetItems.forEach((item: any) => {
      const row = bsSheet.addRow({
        lineItem: item.lineItem,
        note: item.note,
        currentYear: item.currentYear,
        priorYear: item.priorYear,
      });

      if (item.isHeader || item.isGrandTotal) {
        row.font = { bold: true };
        row.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFDBEAFE" },
        };
      } else if (item.isSubHeader) {
        row.font = { bold: true, italic: true };
      } else if (item.isTotal) {
        row.font = { bold: true };
        row.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF3F4F6" },
        };
      }
    });

    const plSheet = workbook.addWorksheet("Profit & Loss");
    plSheet.columns = [
      { header: "Line Item", key: "lineItem", width: 45 },
      { header: "Note", key: "note", width: 10 },
      { header: "Current Year", key: "currentYear", width: 18 },
      { header: "Prior Year", key: "priorYear", width: 18 },
    ];

    const plHeaderRow = plSheet.getRow(1);
    plHeaderRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    plHeaderRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF059669" },
    };

    const plItems = [
      { lineItem: "Revenue", note: "14", currentYear: 3500000, priorYear: 2800000 },
      { lineItem: "Cost of Sales", note: "16", currentYear: -2100000, priorYear: -1680000 },
      { lineItem: "Gross Profit", note: "", currentYear: 1400000, priorYear: 1120000, isTotal: true },
      { lineItem: "", note: "", currentYear: "", priorYear: "" },
      { lineItem: "Other Income", note: "15", currentYear: 50000, priorYear: 30000 },
      { lineItem: "Administrative Expenses", note: "17", currentYear: -915000, priorYear: -750000 },
      { lineItem: "Selling and Distribution Expenses", note: "18", currentYear: 0, priorYear: 0 },
      { lineItem: "Operating Profit", note: "", currentYear: 535000, priorYear: 400000, isTotal: true },
      { lineItem: "", note: "", currentYear: "", priorYear: "" },
      { lineItem: "Finance Costs", note: "19", currentYear: -50000, priorYear: -60000 },
      { lineItem: "Profit Before Tax", note: "", currentYear: 485000, priorYear: 340000, isTotal: true },
      { lineItem: "", note: "", currentYear: "", priorYear: "" },
      { lineItem: "Tax Expense", note: "20", currentYear: 0, priorYear: 0 },
      { lineItem: "Profit for the Year", note: "", currentYear: 485000, priorYear: 340000, isGrandTotal: true },
    ];

    plItems.forEach((item: any) => {
      const row = plSheet.addRow({
        lineItem: item.lineItem,
        note: item.note,
        currentYear: item.currentYear,
        priorYear: item.priorYear,
      });

      if (item.isGrandTotal) {
        row.font = { bold: true };
        row.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFD1FAE5" },
        };
      } else if (item.isTotal) {
        row.font = { bold: true };
        row.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF0FDF4" },
        };
      }
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=AuditWise_FS_Template.xlsx"
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Error generating FS template:", error);
    res.status(500).json({ error: "Failed to generate template" });
  }
});

router.get("/download/single-file-import-template", async (req, res) => {
  try {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "AuditWise";
    workbook.created = new Date();

    const styleHeader = (row: ExcelJS.Row, color: string) => {
      row.font = { bold: true, color: { argb: "FFFFFFFF" } };
      row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: color } };
      row.alignment = { horizontal: "center", vertical: "middle" };
      row.height = 25;
    };

    const addBorders = (worksheet: ExcelJS.Worksheet) => {
      worksheet.eachRow((row: ExcelJS.Row) => {
        row.eachCell((cell: ExcelJS.Cell) => {
          cell.border = {
            top: { style: "thin", color: { argb: "FFE5E7EB" } },
            left: { style: "thin", color: { argb: "FFE5E7EB" } },
            bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
            right: { style: "thin", color: { argb: "FFE5E7EB" } },
          };
        });
      });
    };

    const glSheet = workbook.addWorksheet("GL_LINE");
    glSheet.columns = [
      { header: "Record Type", key: "recordType", width: 12 },
      { header: "Code", key: "code", width: 10 },
      { header: "Account Name", key: "accountName", width: 30 },
      { header: "Voucher #", key: "voucherNumber", width: 14 },
      { header: "Date", key: "date", width: 12 },
      { header: "Debit", key: "debit", width: 14 },
      { header: "Credit", key: "credit", width: 14 },
      { header: "Currency", key: "currency", width: 8 },
      { header: "Doc Type", key: "docType", width: 10 },
      { header: "Ref #", key: "refNumber", width: 14 },
      { header: "Narrative", key: "narrative", width: 45 },
    ];
    styleHeader(glSheet.getRow(1), "FF1E40AF");
    
    const glSamples = [
      { recordType: "GL_LINE", code: "10001", accountName: "Cash in Hand", voucherNumber: "JV-00001", date: "12/31/2024", debit: 295987.60, credit: 0, currency: "PKR", docType: "JV", refNumber: "REF-000001", narrative: "Year-end cash adjustment" },
      { recordType: "GL_LINE", code: "10003", accountName: "Cash at Bank", voucherNumber: "BRV-00001", date: "11/05/2024", debit: 850000, credit: 0, currency: "PKR", docType: "BRV", refNumber: "REF-000002", narrative: "Customer receipt - ABC Ltd" },
      { recordType: "GL_LINE", code: "40001", accountName: "Sales Revenue", voucherNumber: "INV-00001", date: "07/01/2024", debit: 0, credit: 1250000, currency: "PKR", docType: "INV", refNumber: "REF-000003", narrative: "Monthly sales invoice" },
    ];
    glSamples.forEach((row, i) => {
      const dataRow = glSheet.addRow(row);
      dataRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: i % 2 === 0 ? "FFF3F4F6" : "FFFFFFFF" } };
    });
    addBorders(glSheet);

    const obAccountSheet = workbook.addWorksheet("OB_ACCOUNT");
    obAccountSheet.columns = [
      { header: "Record Type", key: "recordType", width: 14 },
      { header: "Code", key: "code", width: 10 },
      { header: "Account Name", key: "accountName", width: 35 },
      { header: "Opening Debit", key: "openingDebit", width: 16 },
      { header: "Opening Credit", key: "openingCredit", width: 16 },
    ];
    styleHeader(obAccountSheet.getRow(1), "FF059669");
    
    const obAccountSamples = [
      { recordType: "OB_ACCOUNT", code: "10001", accountName: "Cash in Hand", openingDebit: 500000, openingCredit: 0 },
      { recordType: "OB_ACCOUNT", code: "10003", accountName: "Cash at Bank", openingDebit: 1200000, openingCredit: 0 },
      { recordType: "OB_ACCOUNT", code: "20001", accountName: "Trade Payables", openingDebit: 0, openingCredit: 850000 },
    ];
    obAccountSamples.forEach((row, i) => {
      const dataRow = obAccountSheet.addRow(row);
      dataRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: i % 2 === 0 ? "FFF0FDF4" : "FFFFFFFF" } };
    });
    addBorders(obAccountSheet);

    const cbAccountSheet = workbook.addWorksheet("CB_ACCOUNT");
    cbAccountSheet.columns = [
      { header: "Record Type", key: "recordType", width: 14 },
      { header: "Code", key: "code", width: 10 },
      { header: "Account Name", key: "accountName", width: 35 },
      { header: "Closing Debit", key: "closingDebit", width: 16 },
      { header: "Closing Credit", key: "closingCredit", width: 16 },
    ];
    styleHeader(cbAccountSheet.getRow(1), "FF7C3AED");
    
    const cbAccountSamples = [
      { recordType: "CB_ACCOUNT", code: "10001", accountName: "Cash in Hand", closingDebit: 750000, closingCredit: 0 },
      { recordType: "CB_ACCOUNT", code: "10003", accountName: "Cash at Bank", closingDebit: 1450000, closingCredit: 0 },
      { recordType: "CB_ACCOUNT", code: "20001", accountName: "Trade Payables", closingDebit: 0, closingCredit: 1100000 },
    ];
    cbAccountSamples.forEach((row, i) => {
      const dataRow = cbAccountSheet.addRow(row);
      dataRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: i % 2 === 0 ? "FFF5F3FF" : "FFFFFFFF" } };
    });
    addBorders(cbAccountSheet);

    const obPartySheet = workbook.addWorksheet("OB_PARTY");
    obPartySheet.columns = [
      { header: "Record Type", key: "recordType", width: 12 },
      { header: "Party Type", key: "partyType", width: 12 },
      { header: "Party Code", key: "partyCode", width: 12 },
      { header: "Party Name", key: "partyName", width: 35 },
      { header: "Opening Debit", key: "openingDebit", width: 16 },
      { header: "Opening Credit", key: "openingCredit", width: 16 },
      { header: "Control Account", key: "controlAccount", width: 12 },
    ];
    styleHeader(obPartySheet.getRow(1), "FFDC2626");
    
    const obPartySamples = [
      { recordType: "OB_PARTY", partyType: "DEBTOR", partyCode: "C001", partyName: "ABC Trading Ltd", openingDebit: 250000, openingCredit: 0, controlAccount: "11001" },
      { recordType: "OB_PARTY", partyType: "CREDITOR", partyCode: "S001", partyName: "XYZ Suppliers", openingDebit: 0, openingCredit: 180000, controlAccount: "20001" },
    ];
    obPartySamples.forEach((row, i) => {
      const dataRow = obPartySheet.addRow(row);
      dataRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: i % 2 === 0 ? "FFFEF2F2" : "FFFFFFFF" } };
    });
    addBorders(obPartySheet);

    const cbPartySheet = workbook.addWorksheet("CB_PARTY");
    cbPartySheet.columns = [
      { header: "Record Type", key: "recordType", width: 12 },
      { header: "Party Type", key: "partyType", width: 12 },
      { header: "Party Code", key: "partyCode", width: 12 },
      { header: "Party Name", key: "partyName", width: 35 },
      { header: "Closing Debit", key: "closingDebit", width: 16 },
      { header: "Closing Credit", key: "closingCredit", width: 16 },
      { header: "Control Account", key: "controlAccount", width: 12 },
      { header: "Email", key: "email", width: 25 },
      { header: "Phone", key: "phone", width: 15 },
    ];
    styleHeader(cbPartySheet.getRow(1), "FFEA580C");
    
    const cbPartySamples = [
      { recordType: "CB_PARTY", partyType: "DEBTOR", partyCode: "C001", partyName: "ABC Trading Ltd", closingDebit: 320000, closingCredit: 0, controlAccount: "11001", email: "accounts@abctrading.com", phone: "+92-300-1234567" },
      { recordType: "CB_PARTY", partyType: "CREDITOR", partyCode: "S001", partyName: "XYZ Suppliers", closingDebit: 0, closingCredit: 225000, controlAccount: "20001", email: "ar@xyzsuppliers.com", phone: "+92-321-9876543" },
    ];
    cbPartySamples.forEach((row, i) => {
      const dataRow = cbPartySheet.addRow(row);
      dataRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: i % 2 === 0 ? "FFFEF3E0" : "FFFFFFFF" } };
    });
    addBorders(cbPartySheet);

    const bankMasterSheet = workbook.addWorksheet("BANK_MASTER");
    bankMasterSheet.columns = [
      { header: "Record Type", key: "recordType", width: 14 },
      { header: "Bank Code", key: "bankCode", width: 12 },
      { header: "Bank Name", key: "bankName", width: 30 },
      { header: "Branch", key: "branch", width: 20 },
      { header: "Account Number", key: "accountNumber", width: 20 },
      { header: "Account Type", key: "accountType", width: 15 },
      { header: "Currency", key: "currency", width: 10 },
      { header: "GL Account", key: "glAccount", width: 12 },
    ];
    styleHeader(bankMasterSheet.getRow(1), "FF0891B2");
    
    const bankMasterSamples = [
      { recordType: "BANK_MASTER", bankCode: "HBL01", bankName: "Habib Bank Limited", branch: "Islamabad Main", accountNumber: "0001-1234567890", accountType: "Current", currency: "PKR", glAccount: "10003" },
      { recordType: "BANK_MASTER", bankCode: "MCB01", bankName: "MCB Bank Limited", branch: "Blue Area", accountNumber: "0002-9876543210", accountType: "Savings", currency: "PKR", glAccount: "10004" },
    ];
    bankMasterSamples.forEach((row, i) => {
      const dataRow = bankMasterSheet.addRow(row);
      dataRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: i % 2 === 0 ? "FFECFEFF" : "FFFFFFFF" } };
    });
    addBorders(bankMasterSheet);

    const cbBankSheet = workbook.addWorksheet("CB_BANK");
    cbBankSheet.columns = [
      { header: "Record Type", key: "recordType", width: 12 },
      { header: "Bank Code", key: "bankCode", width: 12 },
      { header: "Statement Date", key: "statementDate", width: 14 },
      { header: "Book Balance", key: "bookBalance", width: 16 },
      { header: "Statement Balance", key: "statementBalance", width: 18 },
      { header: "Reconciled", key: "reconciled", width: 12 },
    ];
    styleHeader(cbBankSheet.getRow(1), "FF4F46E5");
    
    const cbBankSamples = [
      { recordType: "CB_BANK", bankCode: "HBL01", statementDate: "06/30/2025", bookBalance: 1450000, statementBalance: 1465000, reconciled: "NO" },
      { recordType: "CB_BANK", bankCode: "MCB01", statementDate: "06/30/2025", bookBalance: 580000, statementBalance: 580000, reconciled: "YES" },
    ];
    cbBankSamples.forEach((row, i) => {
      const dataRow = cbBankSheet.addRow(row);
      dataRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: i % 2 === 0 ? "FFEEF2FF" : "FFFFFFFF" } };
    });
    addBorders(cbBankSheet);

    const instructionsSheet = workbook.addWorksheet("Instructions");
    instructionsSheet.columns = [{ header: "", key: "col1", width: 100 }];

    const instructions = [
      "SINGLE-FILE EXCEL IMPORT TEMPLATE - INSTRUCTIONS",
      "",
      "This template allows you to import multiple data types in a single Excel upload. Each sheet corresponds to a specific record type.",
      "",
      "SHEET DESCRIPTIONS:",
      "",
      "1. GL_LINE - General Ledger Journal Lines",
      "   Import individual journal entry lines (debits and credits)",
      "   Required: Record Type, Code, Voucher #, Date, Debit/Credit",
      "",
      "2. OB_ACCOUNT - Opening Account Balances",
      "   Import opening balances for accounts at period start",
      "   Required: Record Type, Code, Account Name, Opening Debit/Credit",
      "",
      "3. CB_ACCOUNT - Closing Account Balances",
      "   Import closing balances for accounts at period end (Trial Balance)",
      "   Required: Record Type, Code, Account Name, Closing Debit/Credit",
      "",
      "4. OB_PARTY - Opening Party Balances",
      "   Import opening balances for debtors/creditors (for AR/AP confirmations)",
      "   Required: Record Type, Party Type (DEBTOR/CREDITOR), Party Code, Party Name, Opening Debit/Credit",
      "",
      "5. CB_PARTY - Closing Party Balances",
      "   Import closing balances for debtors/creditors with contact details",
      "   Required: Record Type, Party Type, Party Code, Party Name, Closing Debit/Credit",
      "   Optional: Control Account, Email, Phone (for sending confirmations)",
      "",
      "6. BANK_MASTER - Bank Account Master Data",
      "   Import bank account information for bank confirmations",
      "   Required: Record Type, Bank Code, Bank Name, Account Number",
      "",
      "7. CB_BANK - Closing Bank Balances",
      "   Import bank balances for reconciliation and confirmation",
      "   Required: Record Type, Bank Code, Statement Date, Book Balance, Statement Balance",
      "",
      "PARTY TYPES:",
      "- DEBTOR: Customers with amounts receivable",
      "- CREDITOR: Suppliers with amounts payable",
      "",
      "DOCUMENT TYPE CODES (for GL_LINE):",
      "- JV: Journal Voucher",
      "- BPV: Bank Payment Voucher",
      "- BRV: Bank Receipt Voucher",
      "- PV: Payment Voucher",
      "- RV: Receipt Voucher",
      "- INV: Invoice",
      "",
      "MAKER-CHECKER WORKFLOW:",
      "1. UPLOAD: Import the file (Uploader role)",
      "2. VALIDATE: System validates all records against rules",
      "3. REVIEW: Manager reviews validation issues",
      "4. SUBMIT: Submit for approval",
      "5. APPROVE: Partner approves the batch",
      "6. POST: Data is posted to the audit workspace",
      "",
      "IMPORTANT NOTES:",
      "- Each row MUST have the correct Record Type in the first column",
      "- Account codes (Code) must be 5-digit codes matching your Chart of Accounts",
      "- Dates should be in MM/DD/YYYY format within your engagement period",
      "- Amounts should be positive numbers (system determines sign from Debit/Credit columns)",
      "- Remove sample data before uploading your actual data",
      "- You can leave sheets empty if you don't need to import that data type",
    ];

    instructions.forEach((text, index) => {
      const row = instructionsSheet.addRow([text]);
      if (index === 0) {
        row.font = { bold: true, size: 14 };
      } else if (text.match(/^[0-9]+\.\s/) || text.startsWith("SHEET") || text.startsWith("PARTY TYPES") || text.startsWith("DOCUMENT TYPE") || text.startsWith("MAKER-CHECKER") || text.startsWith("IMPORTANT")) {
        row.font = { bold: true };
      }
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=AuditWise_SingleFile_Import_Template.xlsx"
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Error generating Single-File Import template:", error);
    res.status(500).json({ error: "Failed to generate template" });
  }
});

router.get("/upload-template/download", async (_req: Request, res: Response) => {
  try {
    const buffer = await generateUploadTemplateBuffer();
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="AuditWise_Upload_Template.xlsx"'
    );
    res.setHeader("Content-Length", buffer.length.toString());
    res.send(buffer);
  } catch (error) {
    console.error("Error generating upload template:", error);
    res.status(500).json({ error: "Failed to generate upload template" });
  }
});

router.get("/upload-template/info", async (_req: Request, res: Response) => {
  try {
    const info = await getTemplateInfo();
    res.json(info);
  } catch (error) {
    console.error("Error fetching template info:", error);
    res.status(500).json({ error: "Failed to fetch template info" });
  }
});

export default router;
