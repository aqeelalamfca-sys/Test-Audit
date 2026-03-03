import { Router, Request, Response } from "express";
import ExcelJS from "exceljs";
import multer from "multer";
import { prisma } from "./db";
import { z } from "zod";
import { ImportStagingRow } from "@prisma/client";
import { requireAuth, AuthenticatedRequest } from "./auth";
import { classifyAccount, getDefaultClassificationForCode } from "./services/accountClassificationService";
import { generateBankConfirmationLetter, generateARAPConfirmationLetter, generateLegalAdvisorConfirmationLetter, generateTaxAdvisorConfirmationLetter, generateAllConfirmationLetters } from "./services/confirmationLetterService";
import { importInputWorkbook, rerunValidations, getSummaryRun, importSingleDataset } from "./services/inputWorkbookService";
import { syncTbToFsMapping } from "./routes/reviewMappingRoutes";
import { autoFixDeterministic } from "./services/reconIssuesEngine";

async function autoClassifyAndSync(engagementId: string, userId?: string) {
  try {
    const records = await prisma.importAccountBalance.findMany({
      where: { engagementId },
    });

    const updates: Array<{ id: string; accountClass: string; accountSubclass: string; fsHeadKey: string; source: string; confidence: number }> = [];
    for (const record of records) {
      const rec = record as any;
      if (rec.classificationSource === 'MANUAL') continue;

      const classification = classifyAccount(record.accountCode, record.accountName || '')
        || getDefaultClassificationForCode(record.accountCode);

      updates.push({
        id: record.id,
        accountClass: classification.accountClass,
        accountSubclass: classification.accountSubclass,
        fsHeadKey: classification.fsHeadKey,
        source: classification.source,
        confidence: classification.confidence,
      });
    }

    if (updates.length > 0) {
      const BATCH_SIZE = 50;
      for (let i = 0; i < updates.length; i += BATCH_SIZE) {
        const batch = updates.slice(i, i + BATCH_SIZE);
        await prisma.$transaction(
          batch.map(u => prisma.$executeRaw`
            UPDATE "ImportAccountBalance" 
            SET "accountClass" = ${u.accountClass},
                "accountSubclass" = ${u.accountSubclass},
                "fsHeadKey" = ${u.fsHeadKey},
                "classificationSource" = ${u.source},
                "classificationConfidence" = ${u.confidence}
            WHERE id = ${u.id}
          `)
        );
      }
    }

    const syncResult = await syncTbToFsMapping(engagementId, userId);

    const fixResult = await autoFixDeterministic(engagementId, userId || 'system');
  } catch (error) {
    console.error("Auto-classify and sync error (non-blocking):", error);
  }
}
import type { DatasetType } from "./services/inputWorkbookService";
import { validateWorkbookStructure, generateErrorReport } from "./services/importValidationService";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

const ImportRecordType = z.enum([
  "GL_LINE",
  "OB_ACCOUNT",
  "CB_ACCOUNT",
  "OB_PARTY",
  "CB_PARTY",
  "BANK_MASTER",
  "CB_BANK",
]);

type ImportRecordTypeEnum = z.infer<typeof ImportRecordType>;

router.get("/template", async (req: Request, res: Response) => {
  return res.redirect('/api/templates/download/single-file-import-template');
});

router.get("/template-legacy-unused", async (req: Request, res: Response) => {
  try {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'AuditWise';
    workbook.created = new Date();

    const headerStyle: Partial<ExcelJS.Style> = {
      font: { bold: true, color: { argb: 'FFFFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } },
      alignment: { horizontal: 'center', vertical: 'middle' },
      border: {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      },
    };

    // Add Template Guidelines sheet as the first sheet
    const guidelinesSheet = workbook.addWorksheet('Template');
    guidelinesSheet.columns = [
      { header: '', key: 'col1', width: 25 },
      { header: '', key: 'col2', width: 80 },
    ];

    const titleStyle: Partial<ExcelJS.Style> = {
      font: { bold: true, size: 16, color: { argb: 'FF1F4E79' } },
      alignment: { horizontal: 'left', vertical: 'middle' },
    };
    const sectionStyle: Partial<ExcelJS.Style> = {
      font: { bold: true, size: 12, color: { argb: 'FFFFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E75B6' } },
      alignment: { horizontal: 'left', vertical: 'middle' },
    };
    const subHeaderStyle: Partial<ExcelJS.Style> = {
      font: { bold: true, size: 11, color: { argb: 'FF1F4E79' } },
      alignment: { horizontal: 'left', vertical: 'middle' },
    };
    const textStyle: Partial<ExcelJS.Style> = {
      font: { size: 10 },
      alignment: { horizontal: 'left', vertical: 'top', wrapText: true },
    };

    const guidelines = [
      { col1: 'AuditWise Input Workbook Template', col2: '', style: 'title' },
      { col1: '', col2: '' },
      { col1: 'PURPOSE', col2: '', style: 'section' },
      { col1: 'This template is designed to import audit data into AuditWise with zero errors.', col2: '' },
      { col1: 'Follow these guidelines carefully to ensure successful data import.', col2: '' },
      { col1: '', col2: '' },
      { col1: 'SHEET OVERVIEW', col2: '', style: 'section' },
      { col1: 'Sheet Name', col2: 'Description', style: 'subheader' },
      { col1: 'Parties', col2: 'Master list of customers, vendors, and other parties for confirmations' },
      { col1: 'Bank', col2: 'Bank account details for bank confirmations and reconciliations' },
      { col1: 'Trial Balance', col2: 'Opening and closing balances by GL Code (required)' },
      { col1: 'GL', col2: 'General Ledger transaction details (required)' },
      { col1: 'Open Items', col2: 'Outstanding AR/AP items with Control_Account_Code for reconciliation' },
      { col1: '', col2: '' },
      { col1: 'CRITICAL RULES FOR ZERO ERRORS', col2: '', style: 'section' },
      { col1: '', col2: '' },
      { col1: '1. GL_Code Consistency', col2: '', style: 'subheader' },
      { col1: '   - Every GL_Code in GL sheet MUST exist in Trial Balance sheet', col2: '' },
      { col1: '   - GL_Codes are case-sensitive (1101 is different from 1101a)', col2: '' },
      { col1: '   - No spaces or special characters in GL_Code', col2: '' },
      { col1: '', col2: '' },
      { col1: '2. Party_ID Consistency', col2: '', style: 'subheader' },
      { col1: '   - Every Party_ID in GL/Open Items MUST exist in Parties sheet', col2: '' },
      { col1: '   - Bank accounts must reference valid Party_IDs from Parties sheet', col2: '' },
      { col1: '   - Party_IDs are case-sensitive', col2: '' },
      { col1: '', col2: '' },
      { col1: '3. Amount Fields (Whole Numbers Only)', col2: '', style: 'subheader' },
      { col1: '   - All monetary amounts must be whole numbers (no decimals)', col2: '' },
      { col1: '   - Example: Use 1500000 not 1500000.50', col2: '' },
      { col1: '   - Debit/Credit columns must contain positive numbers or zero', col2: '' },
      { col1: '', col2: '' },
      { col1: '4. Date Formats', col2: '', style: 'subheader' },
      { col1: '   - Use YYYY-MM-DD format (e.g., 2025-01-15)', col2: '' },
      { col1: '   - Or use Excel date format (dates will auto-convert)', col2: '' },
      { col1: '   - Do not leave required date fields empty', col2: '' },
      { col1: '', col2: '' },
      { col1: '5. GL_Code (Control Account for AR/AP)', col2: '', style: 'subheader' },
      { col1: '   - Every CUSTOMER party must have a GL_Code (e.g., 1301)', col2: '' },
      { col1: '   - Every VENDOR party must have a GL_Code (e.g., 2101)', col2: '' },
      { col1: '   - The GL_Code must exist in the Trial Balance sheet', col2: '' },
      { col1: '   - This enables AP/AR vs Control Account reconciliation', col2: '' },
      { col1: '', col2: '' },
      { col1: '6. Dropdown Values', col2: '', style: 'subheader' },
      { col1: '   - Party_Type: CUSTOMER, VENDOR, or OTHER', col2: '' },
      { col1: '   - Voucher_Type: JV, BPV, BRV, CPV, CRV, SV, PV', col2: '' },
      { col1: '   - Population_Type: AR or AP', col2: '' },
      { col1: '   - Include_in_Confirm: Y or N', col2: '' },
      { col1: '', col2: '' },
      { col1: '7. Trial Balance Arithmetic', col2: '', style: 'subheader' },
      { col1: '   - Opening + Debit - Credit = Closing (must balance)', col2: '' },
      { col1: '   - Total Debits must equal Total Credits across all entries', col2: '' },
      { col1: '', col2: '' },
      { col1: '8. GL to TB Reconciliation', col2: '', style: 'subheader' },
      { col1: '   - Sum of GL movements per GL_Code should match TB movements', col2: '' },
      { col1: '   - TB Movement = Debit - Credit columns', col2: '' },
      { col1: '   - GL Movement = Sum(Debit) - Sum(Credit) per GL_Code', col2: '' },
      { col1: '', col2: '' },
      { col1: 'IMPORT ORDER', col2: '', style: 'section' },
      { col1: 'Data is processed in this order:', col2: '' },
      { col1: '   1. Parties (master data for references)', col2: '' },
      { col1: '   2. Bank (references Parties)', col2: '' },
      { col1: '   3. Trial Balance (defines all GL Codes)', col2: '' },
      { col1: '   4. GL (references TB GL Codes and Parties)', col2: '' },
      { col1: '   5. Open Items (references Parties and GL Codes)', col2: '' },
      { col1: '', col2: '' },
      { col1: 'TIPS FOR SUCCESS', col2: '', style: 'section' },
      { col1: '   - Fill Parties and Trial Balance sheets first', col2: '' },
      { col1: '   - Use Copy/Paste Values to avoid formula errors', col2: '' },
      { col1: '   - Remove sample data rows before uploading', col2: '' },
      { col1: '   - Check for hidden rows/columns with data', col2: '' },
      { col1: '   - Verify GL_Codes match exactly between sheets', col2: '' },
      { col1: '', col2: '' },
      { col1: 'SAMPLE DATA', col2: '', style: 'section' },
      { col1: 'Each sheet contains sample rows to demonstrate the expected format.', col2: '' },
      { col1: 'DELETE the sample data before uploading your actual data.', col2: '' },
    ];

    guidelines.forEach((row, idx) => {
      const dataRow = guidelinesSheet.addRow({ col1: row.col1, col2: row.col2 });
      if (row.style === 'title') {
        dataRow.getCell(1).style = titleStyle;
        guidelinesSheet.mergeCells(`A${dataRow.number}:B${dataRow.number}`);
      } else if (row.style === 'section') {
        dataRow.getCell(1).style = sectionStyle;
        guidelinesSheet.mergeCells(`A${dataRow.number}:B${dataRow.number}`);
        dataRow.height = 22;
      } else if (row.style === 'subheader') {
        dataRow.getCell(1).style = subHeaderStyle;
      } else {
        dataRow.getCell(1).style = textStyle;
        dataRow.getCell(2).style = textStyle;
      }
    });

    const partiesSheet = workbook.addWorksheet('Parties');
    partiesSheet.columns = [
      { header: 'Party_ID', key: 'Party_ID', width: 15 },
      { header: 'Party_Type', key: 'Party_Type', width: 15 },
      { header: 'Legal_Name', key: 'Legal_Name', width: 30 },
      { header: 'GL_Code', key: 'GL_Code', width: 22 },
      { header: 'Email', key: 'Email', width: 30 },
      { header: 'Address_Line1', key: 'Address_Line1', width: 40 },
      { header: 'Attention_To', key: 'Attention_To', width: 25 },
    ];
    partiesSheet.getRow(1).eachCell((cell) => { cell.style = headerStyle; });
    partiesSheet.addRows([
      { Party_ID: 'CUST-001', Party_Type: 'CUSTOMER', Legal_Name: 'Alpha Traders Pvt Ltd', GL_Code: '1301', Email: 'accounts@alphatraders.com', Address_Line1: '123 Main Boulevard, Karachi', Attention_To: 'Mr. Ahmed Khan' },
      { Party_ID: 'CUST-002', Party_Type: 'CUSTOMER', Legal_Name: 'Beta Enterprises', GL_Code: '1301', Email: 'finance@betaent.com', Address_Line1: '456 Commercial Area, Lahore', Attention_To: 'Ms. Fatima Zaidi' },
      { Party_ID: 'CUST-003', Party_Type: 'CUSTOMER', Legal_Name: 'Gamma Industries Ltd', GL_Code: '1301', Email: 'ar@gammaindustries.pk', Address_Line1: '789 Industrial Zone, Faisalabad', Attention_To: 'Mr. Usman Ali' },
      { Party_ID: 'CUST-004', Party_Type: 'CUSTOMER', Legal_Name: 'Delta Corporation', GL_Code: '1301', Email: 'payments@deltacorp.com', Address_Line1: '101 Business Park, Islamabad', Attention_To: 'Finance Manager' },
      { Party_ID: 'CUST-005', Party_Type: 'CUSTOMER', Legal_Name: 'Epsilon Solutions', GL_Code: '1301', Email: 'billing@epsilon.pk', Address_Line1: '202 Tech Hub, Rawalpindi', Attention_To: 'Ms. Sara Malik' },
      { Party_ID: 'VEND-001', Party_Type: 'VENDOR', Legal_Name: 'Prime Suppliers Co', GL_Code: '2101', Email: 'ap@primesuppliers.com', Address_Line1: '303 Wholesale Market, Karachi', Attention_To: 'Mr. Hassan Raza' },
      { Party_ID: 'VEND-002', Party_Type: 'VENDOR', Legal_Name: 'Quality Materials Ltd', GL_Code: '2101', Email: 'accounts@qualitymaterials.pk', Address_Line1: '404 Factory Road, Sialkot', Attention_To: 'Accounts Department' },
      { Party_ID: 'VEND-003', Party_Type: 'VENDOR', Legal_Name: 'Standard Parts Inc', GL_Code: '2101', Email: 'invoices@standardparts.com', Address_Line1: '505 Manufacturing Zone, Gujranwala', Attention_To: 'Mr. Imran Sheikh' },
      { Party_ID: 'VEND-004', Party_Type: 'VENDOR', Legal_Name: 'Reliable Services', GL_Code: '2101', Email: 'billing@reliableservices.pk', Address_Line1: '606 Service Center, Multan', Attention_To: 'Ms. Ayesha Noor' },
      { Party_ID: 'VEND-005', Party_Type: 'VENDOR', Legal_Name: 'National Trading House', GL_Code: '2101', Email: 'ap@nationaltrading.com', Address_Line1: '707 Trade Avenue, Peshawar', Attention_To: 'Finance Team' },
    ]);
    // Data validation for Party_Type column (B2:B1000)
    for (let i = 2; i <= 100; i++) {
      const cell = partiesSheet.getCell(`B${i}`);
      cell.dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"CUSTOMER,VENDOR,OTHER"'],
        showErrorMessage: true,
        errorTitle: 'Invalid Party Type',
        error: 'Please select CUSTOMER, VENDOR, or OTHER',
      };
    }

    const bankSheet = workbook.addWorksheet('Bank');
    bankSheet.columns = [
      { header: 'Bank_Account_ID', key: 'Bank_Account_ID', width: 18 },
      { header: 'Party_ID', key: 'Party_ID', width: 15 },
      { header: 'GL_Code', key: 'GL_Code', width: 12 },
      { header: 'Account_Number', key: 'Account_Number', width: 20 },
      { header: 'Bank_Name', key: 'Bank_Name', width: 25 },
      { header: 'Account_Title', key: 'Account_Title', width: 25 },
      { header: 'Branch', key: 'Branch', width: 20 },
      { header: 'IBAN', key: 'IBAN', width: 30 },
      { header: 'SWIFT_BIC', key: 'SWIFT_BIC', width: 15 },
      { header: 'Currency', key: 'Currency', width: 10 },
      { header: 'Confirmation_Email_or_Address', key: 'Confirmation_Email_or_Address', width: 35 },
      { header: 'Relationship_Manager', key: 'Relationship_Manager', width: 25 },
    ];
    bankSheet.getRow(1).eachCell((cell) => { cell.style = headerStyle; });
    bankSheet.addRows([
      { Bank_Account_ID: 'BANK-001', Party_ID: '', GL_Code: '1101', Account_Number: '1234567890123', Bank_Name: 'Habib Bank Limited', Account_Title: 'Company Current Account', Branch: 'Main Branch Karachi', IBAN: 'PK36HABB0000001234567890', SWIFT_BIC: 'HABORPK', Currency: 'PKR', Confirmation_Email_or_Address: 'confirmations@hbl.com', Relationship_Manager: 'Mr. Ali Raza' },
      { Bank_Account_ID: 'BANK-002', Party_ID: '', GL_Code: '1102', Account_Number: '9876543210987', Bank_Name: 'United Bank Limited', Account_Title: 'Company Savings Account', Branch: 'Gulberg Branch Lahore', IBAN: 'PK12UBLD0000009876543210', SWIFT_BIC: 'UBLOPK', Currency: 'PKR', Confirmation_Email_or_Address: 'ops@ubl.com.pk', Relationship_Manager: 'Ms. Sana Ahmed' },
      { Bank_Account_ID: 'BANK-003', Party_ID: '', GL_Code: '1103', Account_Number: '5555666677778888', Bank_Name: 'MCB Bank Limited', Account_Title: 'Company USD Account', Branch: 'F-7 Branch Islamabad', IBAN: 'PK99MCBL0000005555666677', SWIFT_BIC: 'MCBLPK', Currency: 'USD', Confirmation_Email_or_Address: 'treasury@mcb.com.pk', Relationship_Manager: 'Mr. Hassan Sheikh' },
      { Bank_Account_ID: 'BANK-004', Party_ID: '', GL_Code: '1104', Account_Number: '2468101214161', Bank_Name: 'Allied Bank Limited', Account_Title: 'Payroll Account', Branch: 'Blue Area Islamabad', IBAN: 'PK45ABLL0000002468101214', SWIFT_BIC: 'ABLLPK', Currency: 'PKR', Confirmation_Email_or_Address: 'corporate@abl.com', Relationship_Manager: 'Mr. Bilal Khan' },
      { Bank_Account_ID: 'BANK-005', Party_ID: '', GL_Code: '1105', Account_Number: '1357924680135', Bank_Name: 'Bank Alfalah Limited', Account_Title: 'Collection Account', Branch: 'Clifton Branch Karachi', IBAN: 'PK78BALF0000001357924680', SWIFT_BIC: 'BALFPK', Currency: 'PKR', Confirmation_Email_or_Address: 'ops@bankalfalah.com', Relationship_Manager: 'Ms. Amna Tariq' },
    ]);

    const tbSheet = workbook.addWorksheet('Trial Balance');
    tbSheet.columns = [
      { header: 'GL_Code', key: 'GL_Code', width: 12 },
      { header: 'GL_Name', key: 'GL_Name', width: 35 },
      { header: 'Opening_Balance', key: 'Opening_Balance', width: 18 },
      { header: 'Opening_Debit', key: 'Opening_Debit', width: 15 },
      { header: 'Opening_Credit', key: 'Opening_Credit', width: 15 },
      { header: 'Debit', key: 'Debit', width: 15 },
      { header: 'Credit', key: 'Credit', width: 15 },
      { header: 'Closing_Debit', key: 'Closing_Debit', width: 15 },
      { header: 'Closing_Credit', key: 'Closing_Credit', width: 15 },
    ];
    tbSheet.getRow(1).eachCell((cell) => { cell.style = headerStyle; });
    // TB Movement values must match GL totals for zero-error validation
    // GL totals per account: 1101(DR:10.1M,CR:5M), 1301(DR:8.7M,CR:7.6M), 2101(DR:5M,CR:5.5M), 3101(DR:0,CR:2.5M), 4101(DR:0,CR:8.7M), 5101(DR:5.5M,CR:0)
    tbSheet.addRows([
      { GL_Code: '1101', GL_Name: 'Cash at Bank - HBL', Opening_Balance: 0, Opening_Debit: 0, Opening_Credit: 0, Debit: 10100000, Credit: 5000000, Closing_Debit: 5100000, Closing_Credit: 0 },
      { GL_Code: '1102', GL_Name: 'Cash at Bank - UBL', Opening_Balance: 0, Opening_Debit: 0, Opening_Credit: 0, Debit: 0, Credit: 0, Closing_Debit: 0, Closing_Credit: 0 },
      { GL_Code: '1103', GL_Name: 'Cash at Bank - MCB (USD)', Opening_Balance: 0, Opening_Debit: 0, Opening_Credit: 0, Debit: 0, Credit: 0, Closing_Debit: 0, Closing_Credit: 0 },
      { GL_Code: '1104', GL_Name: 'Cash at Bank - ABL', Opening_Balance: 0, Opening_Debit: 0, Opening_Credit: 0, Debit: 0, Credit: 0, Closing_Debit: 0, Closing_Credit: 0 },
      { GL_Code: '1105', GL_Name: 'Cash at Bank - Alfalah', Opening_Balance: 0, Opening_Debit: 0, Opening_Credit: 0, Debit: 0, Credit: 0, Closing_Debit: 0, Closing_Credit: 0 },
      { GL_Code: '1301', GL_Name: 'Trade Receivables', Opening_Balance: 0, Opening_Debit: 0, Opening_Credit: 0, Debit: 8700000, Credit: 7600000, Closing_Debit: 1100000, Closing_Credit: 0 },
      { GL_Code: '2101', GL_Name: 'Trade Payables', Opening_Balance: 0, Opening_Debit: 0, Opening_Credit: 0, Debit: 5000000, Credit: 5500000, Closing_Debit: 0, Closing_Credit: 500000 },
      { GL_Code: '3101', GL_Name: 'Share Capital', Opening_Balance: 0, Opening_Debit: 0, Opening_Credit: 0, Debit: 0, Credit: 2500000, Closing_Debit: 0, Closing_Credit: 2500000 },
      { GL_Code: '4101', GL_Name: 'Sales Revenue', Opening_Balance: 0, Opening_Debit: 0, Opening_Credit: 0, Debit: 0, Credit: 8700000, Closing_Debit: 0, Closing_Credit: 8700000 },
      { GL_Code: '5101', GL_Name: 'Cost of Goods Sold', Opening_Balance: 0, Opening_Debit: 0, Opening_Credit: 0, Debit: 5500000, Credit: 0, Closing_Debit: 5500000, Closing_Credit: 0 },
    ]);
    ['C', 'D', 'E', 'F', 'G', 'H', 'I'].forEach(col => {
      tbSheet.getColumn(col).numFmt = '#,##0';
    });

    const glSheet = workbook.addWorksheet('GL');
    glSheet.columns = [
      { header: 'Posting_Date', key: 'Posting_Date', width: 12 },
      { header: 'Voucher_No', key: 'Voucher_No', width: 15 },
      { header: 'Voucher_Type', key: 'Voucher_Type', width: 12 },
      { header: 'GL_Code', key: 'GL_Code', width: 12 },
      { header: 'GL_Name', key: 'GL_Name', width: 30 },
      { header: 'Debit', key: 'Debit', width: 15 },
      { header: 'Credit', key: 'Credit', width: 15 },
      { header: 'Party_ID', key: 'Party_ID', width: 15 },
      { header: 'Party_Type', key: 'Party_Type', width: 12 },
      { header: 'Party_Name', key: 'Party_Name', width: 25 },
      { header: 'Document_No', key: 'Document_No', width: 15 },
      { header: 'Document_Date', key: 'Document_Date', width: 12 },
      { header: 'Invoice_No', key: 'Invoice_No', width: 15 },
      { header: 'Due_Date', key: 'Due_Date', width: 12 },
      { header: 'Cost_Center', key: 'Cost_Center', width: 15 },
      { header: 'Department', key: 'Department', width: 15 },
      { header: 'Project', key: 'Project', width: 15 },
      { header: 'Currency', key: 'Currency', width: 10 },
      { header: 'Description', key: 'Description', width: 30 },
      { header: 'Narration', key: 'Narration', width: 40 },
    ];
    glSheet.getRow(1).eachCell((cell) => { cell.style = headerStyle; });
    const glSampleData = [
      { Posting_Date: new Date('2025-01-02'), Voucher_No: 'JV-001', Voucher_Type: 'JV', GL_Code: '1101', GL_Name: 'Cash at Bank - HBL', Debit: 2500000, Credit: 0, Party_ID: '', Party_Type: '', Party_Name: '', Document_No: 'CAP-001', Document_Date: new Date('2025-01-02'), Invoice_No: '', Due_Date: null, Cost_Center: '', Department: 'Finance', Project: '', Currency: 'PKR', Description: 'Share capital injection', Narration: 'Initial capital contribution by shareholders' },
      { Posting_Date: new Date('2025-01-02'), Voucher_No: 'JV-001', Voucher_Type: 'JV', GL_Code: '3101', GL_Name: 'Share Capital', Debit: 0, Credit: 2500000, Party_ID: '', Party_Type: '', Party_Name: '', Document_No: 'CAP-001', Document_Date: new Date('2025-01-02'), Invoice_No: '', Due_Date: null, Cost_Center: '', Department: 'Finance', Project: '', Currency: 'PKR', Description: 'Share capital', Narration: 'Initial capital contribution by shareholders' },
      { Posting_Date: new Date('2025-01-05'), Voucher_No: 'SV-001', Voucher_Type: 'SV', GL_Code: '1301', GL_Name: 'Trade Receivables', Debit: 800000, Credit: 0, Party_ID: 'CUST-001', Party_Type: 'CUSTOMER', Party_Name: 'Alpha Traders Pvt Ltd', Document_No: 'INV-001', Document_Date: new Date('2025-01-05'), Invoice_No: 'INV-001', Due_Date: new Date('2025-02-04'), Cost_Center: 'CC-01', Department: 'Sales', Project: '', Currency: 'PKR', Description: 'Sales to Alpha Traders', Narration: 'Sales invoice for January' },
      { Posting_Date: new Date('2025-01-05'), Voucher_No: 'SV-001', Voucher_Type: 'SV', GL_Code: '4101', GL_Name: 'Sales Revenue', Debit: 0, Credit: 800000, Party_ID: '', Party_Type: '', Party_Name: '', Document_No: '', Document_Date: null, Invoice_No: '', Due_Date: null, Cost_Center: 'CC-01', Department: 'Sales', Project: '', Currency: 'PKR', Description: 'Sales revenue', Narration: 'Sales invoice for January' },
      { Posting_Date: new Date('2025-01-08'), Voucher_No: 'SV-002', Voucher_Type: 'SV', GL_Code: '1301', GL_Name: 'Trade Receivables', Debit: 900000, Credit: 0, Party_ID: 'CUST-002', Party_Type: 'CUSTOMER', Party_Name: 'Beta Enterprises', Document_No: 'INV-002', Document_Date: new Date('2025-01-08'), Invoice_No: 'INV-002', Due_Date: new Date('2025-02-07'), Cost_Center: 'CC-01', Department: 'Sales', Project: '', Currency: 'PKR', Description: 'Sales to Beta Enterprises', Narration: 'Sales invoice for January' },
      { Posting_Date: new Date('2025-01-08'), Voucher_No: 'SV-002', Voucher_Type: 'SV', GL_Code: '4101', GL_Name: 'Sales Revenue', Debit: 0, Credit: 900000, Party_ID: '', Party_Type: '', Party_Name: '', Document_No: '', Document_Date: null, Invoice_No: '', Due_Date: null, Cost_Center: 'CC-01', Department: 'Sales', Project: '', Currency: 'PKR', Description: 'Sales revenue', Narration: 'Sales invoice for January' },
      { Posting_Date: new Date('2025-01-10'), Voucher_No: 'PV-001', Voucher_Type: 'PV', GL_Code: '5101', GL_Name: 'Cost of Goods Sold', Debit: 550000, Credit: 0, Party_ID: '', Party_Type: '', Party_Name: '', Document_No: 'GRN-001', Document_Date: new Date('2025-01-10'), Invoice_No: '', Due_Date: null, Cost_Center: 'CC-02', Department: 'Procurement', Project: '', Currency: 'PKR', Description: 'Cost of goods purchased', Narration: 'Purchase from Prime Suppliers' },
      { Posting_Date: new Date('2025-01-10'), Voucher_No: 'PV-001', Voucher_Type: 'PV', GL_Code: '2101', GL_Name: 'Trade Payables', Debit: 0, Credit: 550000, Party_ID: 'VEND-001', Party_Type: 'VENDOR', Party_Name: 'Prime Suppliers Co', Document_No: 'PINV-001', Document_Date: new Date('2025-01-10'), Invoice_No: 'PINV-001', Due_Date: new Date('2025-02-09'), Cost_Center: 'CC-02', Department: 'Procurement', Project: '', Currency: 'PKR', Description: 'Vendor invoice', Narration: 'Purchase from Prime Suppliers' },
      { Posting_Date: new Date('2025-01-12'), Voucher_No: 'SV-003', Voucher_Type: 'SV', GL_Code: '1301', GL_Name: 'Trade Receivables', Debit: 750000, Credit: 0, Party_ID: 'CUST-003', Party_Type: 'CUSTOMER', Party_Name: 'Gamma Industries Ltd', Document_No: 'INV-003', Document_Date: new Date('2025-01-12'), Invoice_No: 'INV-003', Due_Date: new Date('2025-02-11'), Cost_Center: 'CC-01', Department: 'Sales', Project: '', Currency: 'PKR', Description: 'Sales to Gamma Industries', Narration: 'Sales invoice for January' },
      { Posting_Date: new Date('2025-01-12'), Voucher_No: 'SV-003', Voucher_Type: 'SV', GL_Code: '4101', GL_Name: 'Sales Revenue', Debit: 0, Credit: 750000, Party_ID: '', Party_Type: '', Party_Name: '', Document_No: '', Document_Date: null, Invoice_No: '', Due_Date: null, Cost_Center: 'CC-01', Department: 'Sales', Project: '', Currency: 'PKR', Description: 'Sales revenue', Narration: 'Sales invoice for January' },
      { Posting_Date: new Date('2025-01-15'), Voucher_No: 'BRV-001', Voucher_Type: 'BRV', GL_Code: '1101', GL_Name: 'Cash at Bank - HBL', Debit: 750000, Credit: 0, Party_ID: '', Party_Type: '', Party_Name: '', Document_No: 'REC-001', Document_Date: new Date('2025-01-15'), Invoice_No: '', Due_Date: null, Cost_Center: '', Department: 'Finance', Project: '', Currency: 'PKR', Description: 'Receipt from Alpha Traders', Narration: 'Collection against INV-001' },
      { Posting_Date: new Date('2025-01-15'), Voucher_No: 'BRV-001', Voucher_Type: 'BRV', GL_Code: '1301', GL_Name: 'Trade Receivables', Debit: 0, Credit: 750000, Party_ID: 'CUST-001', Party_Type: 'CUSTOMER', Party_Name: 'Alpha Traders Pvt Ltd', Document_No: 'REC-001', Document_Date: new Date('2025-01-15'), Invoice_No: 'INV-001', Due_Date: null, Cost_Center: '', Department: 'Finance', Project: '', Currency: 'PKR', Description: 'Receipt from Alpha Traders', Narration: 'Collection against INV-001' },
      { Posting_Date: new Date('2025-01-16'), Voucher_No: 'PV-002', Voucher_Type: 'PV', GL_Code: '5101', GL_Name: 'Cost of Goods Sold', Debit: 550000, Credit: 0, Party_ID: '', Party_Type: '', Party_Name: '', Document_No: 'GRN-002', Document_Date: new Date('2025-01-16'), Invoice_No: '', Due_Date: null, Cost_Center: 'CC-02', Department: 'Procurement', Project: '', Currency: 'PKR', Description: 'Cost of goods purchased', Narration: 'Purchase from Quality Materials' },
      { Posting_Date: new Date('2025-01-16'), Voucher_No: 'PV-002', Voucher_Type: 'PV', GL_Code: '2101', GL_Name: 'Trade Payables', Debit: 0, Credit: 550000, Party_ID: 'VEND-002', Party_Type: 'VENDOR', Party_Name: 'Quality Materials Ltd', Document_No: 'QINV-002', Document_Date: new Date('2025-01-16'), Invoice_No: 'QINV-002', Due_Date: new Date('2025-02-15'), Cost_Center: 'CC-02', Department: 'Procurement', Project: '', Currency: 'PKR', Description: 'Vendor invoice', Narration: 'Purchase from Quality Materials' },
      { Posting_Date: new Date('2025-01-18'), Voucher_No: 'SV-004', Voucher_Type: 'SV', GL_Code: '1301', GL_Name: 'Trade Receivables', Debit: 650000, Credit: 0, Party_ID: 'CUST-004', Party_Type: 'CUSTOMER', Party_Name: 'Delta Corporation', Document_No: 'INV-004', Document_Date: new Date('2025-01-18'), Invoice_No: 'INV-004', Due_Date: new Date('2025-02-17'), Cost_Center: 'CC-01', Department: 'Sales', Project: '', Currency: 'PKR', Description: 'Sales to Delta Corporation', Narration: 'Sales invoice for January' },
      { Posting_Date: new Date('2025-01-18'), Voucher_No: 'SV-004', Voucher_Type: 'SV', GL_Code: '4101', GL_Name: 'Sales Revenue', Debit: 0, Credit: 650000, Party_ID: '', Party_Type: '', Party_Name: '', Document_No: '', Document_Date: null, Invoice_No: '', Due_Date: null, Cost_Center: 'CC-01', Department: 'Sales', Project: '', Currency: 'PKR', Description: 'Sales revenue', Narration: 'Sales invoice for January' },
      { Posting_Date: new Date('2025-01-20'), Voucher_No: 'BPV-001', Voucher_Type: 'BPV', GL_Code: '2101', GL_Name: 'Trade Payables', Debit: 500000, Credit: 0, Party_ID: 'VEND-001', Party_Type: 'VENDOR', Party_Name: 'Prime Suppliers Co', Document_No: 'PAY-001', Document_Date: new Date('2025-01-20'), Invoice_No: 'PINV-001', Due_Date: null, Cost_Center: '', Department: 'Finance', Project: '', Currency: 'PKR', Description: 'Payment to Prime Suppliers', Narration: 'Payment against PINV-001' },
      { Posting_Date: new Date('2025-01-20'), Voucher_No: 'BPV-001', Voucher_Type: 'BPV', GL_Code: '1101', GL_Name: 'Cash at Bank - HBL', Debit: 0, Credit: 500000, Party_ID: '', Party_Type: '', Party_Name: '', Document_No: 'PAY-001', Document_Date: new Date('2025-01-20'), Invoice_No: '', Due_Date: null, Cost_Center: '', Department: 'Finance', Project: '', Currency: 'PKR', Description: 'Payment to Prime Suppliers', Narration: 'Payment against PINV-001' },
      { Posting_Date: new Date('2025-01-22'), Voucher_No: 'BRV-002', Voucher_Type: 'BRV', GL_Code: '1101', GL_Name: 'Cash at Bank - HBL', Debit: 850000, Credit: 0, Party_ID: '', Party_Type: '', Party_Name: '', Document_No: 'REC-002', Document_Date: new Date('2025-01-22'), Invoice_No: '', Due_Date: null, Cost_Center: '', Department: 'Finance', Project: '', Currency: 'PKR', Description: 'Receipt from Beta Enterprises', Narration: 'Collection against INV-002' },
      { Posting_Date: new Date('2025-01-22'), Voucher_No: 'BRV-002', Voucher_Type: 'BRV', GL_Code: '1301', GL_Name: 'Trade Receivables', Debit: 0, Credit: 850000, Party_ID: 'CUST-002', Party_Type: 'CUSTOMER', Party_Name: 'Beta Enterprises', Document_No: 'REC-002', Document_Date: new Date('2025-01-22'), Invoice_No: 'INV-002', Due_Date: null, Cost_Center: '', Department: 'Finance', Project: '', Currency: 'PKR', Description: 'Receipt from Beta Enterprises', Narration: 'Collection against INV-002' },
      { Posting_Date: new Date('2025-01-23'), Voucher_No: 'PV-003', Voucher_Type: 'PV', GL_Code: '5101', GL_Name: 'Cost of Goods Sold', Debit: 550000, Credit: 0, Party_ID: '', Party_Type: '', Party_Name: '', Document_No: 'GRN-003', Document_Date: new Date('2025-01-23'), Invoice_No: '', Due_Date: null, Cost_Center: 'CC-02', Department: 'Procurement', Project: '', Currency: 'PKR', Description: 'Cost of goods purchased', Narration: 'Purchase from Standard Parts' },
      { Posting_Date: new Date('2025-01-23'), Voucher_No: 'PV-003', Voucher_Type: 'PV', GL_Code: '2101', GL_Name: 'Trade Payables', Debit: 0, Credit: 550000, Party_ID: 'VEND-003', Party_Type: 'VENDOR', Party_Name: 'Standard Parts Inc', Document_No: 'SINV-003', Document_Date: new Date('2025-01-23'), Invoice_No: 'SINV-003', Due_Date: new Date('2025-02-22'), Cost_Center: 'CC-02', Department: 'Procurement', Project: '', Currency: 'PKR', Description: 'Vendor invoice', Narration: 'Purchase from Standard Parts' },
      { Posting_Date: new Date('2025-01-25'), Voucher_No: 'SV-005', Voucher_Type: 'SV', GL_Code: '1301', GL_Name: 'Trade Receivables', Debit: 600000, Credit: 0, Party_ID: 'CUST-005', Party_Type: 'CUSTOMER', Party_Name: 'Epsilon Solutions', Document_No: 'INV-005', Document_Date: new Date('2025-01-25'), Invoice_No: 'INV-005', Due_Date: new Date('2025-02-24'), Cost_Center: 'CC-01', Department: 'Sales', Project: '', Currency: 'PKR', Description: 'Sales to Epsilon Solutions', Narration: 'Sales invoice for January' },
      { Posting_Date: new Date('2025-01-25'), Voucher_No: 'SV-005', Voucher_Type: 'SV', GL_Code: '4101', GL_Name: 'Sales Revenue', Debit: 0, Credit: 600000, Party_ID: '', Party_Type: '', Party_Name: '', Document_No: '', Document_Date: null, Invoice_No: '', Due_Date: null, Cost_Center: 'CC-01', Department: 'Sales', Project: '', Currency: 'PKR', Description: 'Sales revenue', Narration: 'Sales invoice for January' },
      { Posting_Date: new Date('2025-01-28'), Voucher_No: 'BPV-002', Voucher_Type: 'BPV', GL_Code: '2101', GL_Name: 'Trade Payables', Debit: 500000, Credit: 0, Party_ID: 'VEND-002', Party_Type: 'VENDOR', Party_Name: 'Quality Materials Ltd', Document_No: 'PAY-002', Document_Date: new Date('2025-01-28'), Invoice_No: 'QINV-002', Due_Date: null, Cost_Center: '', Department: 'Finance', Project: '', Currency: 'PKR', Description: 'Payment to Quality Materials', Narration: 'Payment against QINV-002' },
      { Posting_Date: new Date('2025-01-28'), Voucher_No: 'BPV-002', Voucher_Type: 'BPV', GL_Code: '1101', GL_Name: 'Cash at Bank - HBL', Debit: 0, Credit: 500000, Party_ID: '', Party_Type: '', Party_Name: '', Document_No: 'PAY-002', Document_Date: new Date('2025-01-28'), Invoice_No: '', Due_Date: null, Cost_Center: '', Department: 'Finance', Project: '', Currency: 'PKR', Description: 'Payment to Quality Materials', Narration: 'Payment against QINV-002' },
      { Posting_Date: new Date('2025-01-30'), Voucher_No: 'BRV-003', Voucher_Type: 'BRV', GL_Code: '1101', GL_Name: 'Cash at Bank - HBL', Debit: 700000, Credit: 0, Party_ID: '', Party_Type: '', Party_Name: '', Document_No: 'REC-003', Document_Date: new Date('2025-01-30'), Invoice_No: '', Due_Date: null, Cost_Center: '', Department: 'Finance', Project: '', Currency: 'PKR', Description: 'Receipt from Gamma Industries', Narration: 'Collection against INV-003' },
      { Posting_Date: new Date('2025-01-30'), Voucher_No: 'BRV-003', Voucher_Type: 'BRV', GL_Code: '1301', GL_Name: 'Trade Receivables', Debit: 0, Credit: 700000, Party_ID: 'CUST-003', Party_Type: 'CUSTOMER', Party_Name: 'Gamma Industries Ltd', Document_No: 'REC-003', Document_Date: new Date('2025-01-30'), Invoice_No: 'INV-003', Due_Date: null, Cost_Center: '', Department: 'Finance', Project: '', Currency: 'PKR', Description: 'Receipt from Gamma Industries', Narration: 'Collection against INV-003' },
      { Posting_Date: new Date('2025-02-02'), Voucher_No: 'SV-006', Voucher_Type: 'SV', GL_Code: '1301', GL_Name: 'Trade Receivables', Debit: 700000, Credit: 0, Party_ID: 'CUST-001', Party_Type: 'CUSTOMER', Party_Name: 'Alpha Traders Pvt Ltd', Document_No: 'INV-006', Document_Date: new Date('2025-02-02'), Invoice_No: 'INV-006', Due_Date: new Date('2025-03-04'), Cost_Center: 'CC-01', Department: 'Sales', Project: '', Currency: 'PKR', Description: 'Sales to Alpha Traders', Narration: 'Sales invoice for February' },
      { Posting_Date: new Date('2025-02-02'), Voucher_No: 'SV-006', Voucher_Type: 'SV', GL_Code: '4101', GL_Name: 'Sales Revenue', Debit: 0, Credit: 700000, Party_ID: '', Party_Type: '', Party_Name: '', Document_No: '', Document_Date: null, Invoice_No: '', Due_Date: null, Cost_Center: 'CC-01', Department: 'Sales', Project: '', Currency: 'PKR', Description: 'Sales revenue', Narration: 'Sales invoice for February' },
      { Posting_Date: new Date('2025-02-05'), Voucher_No: 'PV-004', Voucher_Type: 'PV', GL_Code: '5101', GL_Name: 'Cost of Goods Sold', Debit: 550000, Credit: 0, Party_ID: '', Party_Type: '', Party_Name: '', Document_No: 'GRN-004', Document_Date: new Date('2025-02-05'), Invoice_No: '', Due_Date: null, Cost_Center: 'CC-02', Department: 'Procurement', Project: '', Currency: 'PKR', Description: 'Cost of goods purchased', Narration: 'Purchase from Reliable Services' },
      { Posting_Date: new Date('2025-02-05'), Voucher_No: 'PV-004', Voucher_Type: 'PV', GL_Code: '2101', GL_Name: 'Trade Payables', Debit: 0, Credit: 550000, Party_ID: 'VEND-004', Party_Type: 'VENDOR', Party_Name: 'Reliable Services', Document_No: 'RINV-004', Document_Date: new Date('2025-02-05'), Invoice_No: 'RINV-004', Due_Date: new Date('2025-03-07'), Cost_Center: 'CC-02', Department: 'Procurement', Project: '', Currency: 'PKR', Description: 'Vendor invoice', Narration: 'Purchase from Reliable Services' },
      { Posting_Date: new Date('2025-02-08'), Voucher_No: 'BRV-004', Voucher_Type: 'BRV', GL_Code: '1101', GL_Name: 'Cash at Bank - HBL', Debit: 600000, Credit: 0, Party_ID: '', Party_Type: '', Party_Name: '', Document_No: 'REC-004', Document_Date: new Date('2025-02-08'), Invoice_No: '', Due_Date: null, Cost_Center: '', Department: 'Finance', Project: '', Currency: 'PKR', Description: 'Receipt from Delta Corp', Narration: 'Collection against INV-004' },
      { Posting_Date: new Date('2025-02-08'), Voucher_No: 'BRV-004', Voucher_Type: 'BRV', GL_Code: '1301', GL_Name: 'Trade Receivables', Debit: 0, Credit: 600000, Party_ID: 'CUST-004', Party_Type: 'CUSTOMER', Party_Name: 'Delta Corporation', Document_No: 'REC-004', Document_Date: new Date('2025-02-08'), Invoice_No: 'INV-004', Due_Date: null, Cost_Center: '', Department: 'Finance', Project: '', Currency: 'PKR', Description: 'Receipt from Delta Corp', Narration: 'Collection against INV-004' },
      { Posting_Date: new Date('2025-02-10'), Voucher_No: 'SV-007', Voucher_Type: 'SV', GL_Code: '1301', GL_Name: 'Trade Receivables', Debit: 700000, Credit: 0, Party_ID: 'CUST-002', Party_Type: 'CUSTOMER', Party_Name: 'Beta Enterprises', Document_No: 'INV-007', Document_Date: new Date('2025-02-10'), Invoice_No: 'INV-007', Due_Date: new Date('2025-03-12'), Cost_Center: 'CC-01', Department: 'Sales', Project: '', Currency: 'PKR', Description: 'Sales to Beta Enterprises', Narration: 'Sales invoice for February' },
      { Posting_Date: new Date('2025-02-10'), Voucher_No: 'SV-007', Voucher_Type: 'SV', GL_Code: '4101', GL_Name: 'Sales Revenue', Debit: 0, Credit: 700000, Party_ID: '', Party_Type: '', Party_Name: '', Document_No: '', Document_Date: null, Invoice_No: '', Due_Date: null, Cost_Center: 'CC-01', Department: 'Sales', Project: '', Currency: 'PKR', Description: 'Sales revenue', Narration: 'Sales invoice for February' },
      { Posting_Date: new Date('2025-02-12'), Voucher_No: 'BPV-003', Voucher_Type: 'BPV', GL_Code: '2101', GL_Name: 'Trade Payables', Debit: 500000, Credit: 0, Party_ID: 'VEND-003', Party_Type: 'VENDOR', Party_Name: 'Standard Parts Inc', Document_No: 'PAY-003', Document_Date: new Date('2025-02-12'), Invoice_No: 'SINV-003', Due_Date: null, Cost_Center: '', Department: 'Finance', Project: '', Currency: 'PKR', Description: 'Payment to Standard Parts', Narration: 'Payment against SINV-003' },
      { Posting_Date: new Date('2025-02-12'), Voucher_No: 'BPV-003', Voucher_Type: 'BPV', GL_Code: '1101', GL_Name: 'Cash at Bank - HBL', Debit: 0, Credit: 500000, Party_ID: '', Party_Type: '', Party_Name: '', Document_No: 'PAY-003', Document_Date: new Date('2025-02-12'), Invoice_No: '', Due_Date: null, Cost_Center: '', Department: 'Finance', Project: '', Currency: 'PKR', Description: 'Payment to Standard Parts', Narration: 'Payment against SINV-003' },
      { Posting_Date: new Date('2025-02-15'), Voucher_No: 'PV-005', Voucher_Type: 'PV', GL_Code: '5101', GL_Name: 'Cost of Goods Sold', Debit: 550000, Credit: 0, Party_ID: '', Party_Type: '', Party_Name: '', Document_No: 'GRN-005', Document_Date: new Date('2025-02-15'), Invoice_No: '', Due_Date: null, Cost_Center: 'CC-02', Department: 'Procurement', Project: '', Currency: 'PKR', Description: 'Cost of goods purchased', Narration: 'Purchase from National Trading' },
      { Posting_Date: new Date('2025-02-15'), Voucher_No: 'PV-005', Voucher_Type: 'PV', GL_Code: '2101', GL_Name: 'Trade Payables', Debit: 0, Credit: 550000, Party_ID: 'VEND-005', Party_Type: 'VENDOR', Party_Name: 'National Trading House', Document_No: 'NINV-005', Document_Date: new Date('2025-02-15'), Invoice_No: 'NINV-005', Due_Date: new Date('2025-03-17'), Cost_Center: 'CC-02', Department: 'Procurement', Project: '', Currency: 'PKR', Description: 'Vendor invoice', Narration: 'Purchase from National Trading' },
      { Posting_Date: new Date('2025-02-18'), Voucher_No: 'BRV-005', Voucher_Type: 'BRV', GL_Code: '1101', GL_Name: 'Cash at Bank - HBL', Debit: 550000, Credit: 0, Party_ID: '', Party_Type: '', Party_Name: '', Document_No: 'REC-005', Document_Date: new Date('2025-02-18'), Invoice_No: '', Due_Date: null, Cost_Center: '', Department: 'Finance', Project: '', Currency: 'PKR', Description: 'Receipt from Epsilon', Narration: 'Collection against INV-005' },
      { Posting_Date: new Date('2025-02-18'), Voucher_No: 'BRV-005', Voucher_Type: 'BRV', GL_Code: '1301', GL_Name: 'Trade Receivables', Debit: 0, Credit: 550000, Party_ID: 'CUST-005', Party_Type: 'CUSTOMER', Party_Name: 'Epsilon Solutions', Document_No: 'REC-005', Document_Date: new Date('2025-02-18'), Invoice_No: 'INV-005', Due_Date: null, Cost_Center: '', Department: 'Finance', Project: '', Currency: 'PKR', Description: 'Receipt from Epsilon', Narration: 'Collection against INV-005' },
      { Posting_Date: new Date('2025-02-20'), Voucher_No: 'SV-008', Voucher_Type: 'SV', GL_Code: '1301', GL_Name: 'Trade Receivables', Debit: 600000, Credit: 0, Party_ID: 'CUST-003', Party_Type: 'CUSTOMER', Party_Name: 'Gamma Industries Ltd', Document_No: 'INV-008', Document_Date: new Date('2025-02-20'), Invoice_No: 'INV-008', Due_Date: new Date('2025-03-22'), Cost_Center: 'CC-01', Department: 'Sales', Project: '', Currency: 'PKR', Description: 'Sales to Gamma Industries', Narration: 'Sales invoice for February' },
      { Posting_Date: new Date('2025-02-20'), Voucher_No: 'SV-008', Voucher_Type: 'SV', GL_Code: '4101', GL_Name: 'Sales Revenue', Debit: 0, Credit: 600000, Party_ID: '', Party_Type: '', Party_Name: '', Document_No: '', Document_Date: null, Invoice_No: '', Due_Date: null, Cost_Center: 'CC-01', Department: 'Sales', Project: '', Currency: 'PKR', Description: 'Sales revenue', Narration: 'Sales invoice for February' },
      { Posting_Date: new Date('2025-02-22'), Voucher_No: 'BPV-004', Voucher_Type: 'BPV', GL_Code: '2101', GL_Name: 'Trade Payables', Debit: 500000, Credit: 0, Party_ID: 'VEND-004', Party_Type: 'VENDOR', Party_Name: 'Reliable Services', Document_No: 'PAY-004', Document_Date: new Date('2025-02-22'), Invoice_No: 'RINV-004', Due_Date: null, Cost_Center: '', Department: 'Finance', Project: '', Currency: 'PKR', Description: 'Payment to Reliable Services', Narration: 'Payment against RINV-004' },
      { Posting_Date: new Date('2025-02-22'), Voucher_No: 'BPV-004', Voucher_Type: 'BPV', GL_Code: '1101', GL_Name: 'Cash at Bank - HBL', Debit: 0, Credit: 500000, Party_ID: '', Party_Type: '', Party_Name: '', Document_No: 'PAY-004', Document_Date: new Date('2025-02-22'), Invoice_No: '', Due_Date: null, Cost_Center: '', Department: 'Finance', Project: '', Currency: 'PKR', Description: 'Payment to Reliable Services', Narration: 'Payment against RINV-004' },
      { Posting_Date: new Date('2025-02-25'), Voucher_No: 'BRV-006', Voucher_Type: 'BRV', GL_Code: '1101', GL_Name: 'Cash at Bank - HBL', Debit: 650000, Credit: 0, Party_ID: '', Party_Type: '', Party_Name: '', Document_No: 'REC-006', Document_Date: new Date('2025-02-25'), Invoice_No: '', Due_Date: null, Cost_Center: '', Department: 'Finance', Project: '', Currency: 'PKR', Description: 'Receipt from Alpha Traders', Narration: 'Collection against INV-006' },
      { Posting_Date: new Date('2025-02-25'), Voucher_No: 'BRV-006', Voucher_Type: 'BRV', GL_Code: '1301', GL_Name: 'Trade Receivables', Debit: 0, Credit: 650000, Party_ID: 'CUST-001', Party_Type: 'CUSTOMER', Party_Name: 'Alpha Traders Pvt Ltd', Document_No: 'REC-006', Document_Date: new Date('2025-02-25'), Invoice_No: 'INV-006', Due_Date: null, Cost_Center: '', Department: 'Finance', Project: '', Currency: 'PKR', Description: 'Receipt from Alpha Traders', Narration: 'Collection against INV-006' },
      { Posting_Date: new Date('2025-02-28'), Voucher_No: 'PV-006', Voucher_Type: 'PV', GL_Code: '5101', GL_Name: 'Cost of Goods Sold', Debit: 550000, Credit: 0, Party_ID: '', Party_Type: '', Party_Name: '', Document_No: 'GRN-006', Document_Date: new Date('2025-02-28'), Invoice_No: '', Due_Date: null, Cost_Center: 'CC-02', Department: 'Procurement', Project: '', Currency: 'PKR', Description: 'Cost of goods purchased', Narration: 'Purchase from Prime Suppliers' },
      { Posting_Date: new Date('2025-02-28'), Voucher_No: 'PV-006', Voucher_Type: 'PV', GL_Code: '2101', GL_Name: 'Trade Payables', Debit: 0, Credit: 550000, Party_ID: 'VEND-001', Party_Type: 'VENDOR', Party_Name: 'Prime Suppliers Co', Document_No: 'PINV-006', Document_Date: new Date('2025-02-28'), Invoice_No: 'PINV-006', Due_Date: new Date('2025-03-30'), Cost_Center: 'CC-02', Department: 'Procurement', Project: '', Currency: 'PKR', Description: 'Vendor invoice', Narration: 'Purchase from Prime Suppliers' },
      { Posting_Date: new Date('2025-03-02'), Voucher_No: 'SV-009', Voucher_Type: 'SV', GL_Code: '1301', GL_Name: 'Trade Receivables', Debit: 650000, Credit: 0, Party_ID: 'CUST-004', Party_Type: 'CUSTOMER', Party_Name: 'Delta Corporation', Document_No: 'INV-009', Document_Date: new Date('2025-03-02'), Invoice_No: 'INV-009', Due_Date: new Date('2025-04-01'), Cost_Center: 'CC-01', Department: 'Sales', Project: '', Currency: 'PKR', Description: 'Sales to Delta Corporation', Narration: 'Sales invoice for March' },
      { Posting_Date: new Date('2025-03-02'), Voucher_No: 'SV-009', Voucher_Type: 'SV', GL_Code: '4101', GL_Name: 'Sales Revenue', Debit: 0, Credit: 650000, Party_ID: '', Party_Type: '', Party_Name: '', Document_No: '', Document_Date: null, Invoice_No: '', Due_Date: null, Cost_Center: 'CC-01', Department: 'Sales', Project: '', Currency: 'PKR', Description: 'Sales revenue', Narration: 'Sales invoice for March' },
      { Posting_Date: new Date('2025-03-05'), Voucher_No: 'BPV-005', Voucher_Type: 'BPV', GL_Code: '2101', GL_Name: 'Trade Payables', Debit: 500000, Credit: 0, Party_ID: 'VEND-005', Party_Type: 'VENDOR', Party_Name: 'National Trading House', Document_No: 'PAY-005', Document_Date: new Date('2025-03-05'), Invoice_No: 'NINV-005', Due_Date: null, Cost_Center: '', Department: 'Finance', Project: '', Currency: 'PKR', Description: 'Payment to National Trading', Narration: 'Payment against NINV-005' },
      { Posting_Date: new Date('2025-03-05'), Voucher_No: 'BPV-005', Voucher_Type: 'BPV', GL_Code: '1101', GL_Name: 'Cash at Bank - HBL', Debit: 0, Credit: 500000, Party_ID: '', Party_Type: '', Party_Name: '', Document_No: 'PAY-005', Document_Date: new Date('2025-03-05'), Invoice_No: '', Due_Date: null, Cost_Center: '', Department: 'Finance', Project: '', Currency: 'PKR', Description: 'Payment to National Trading', Narration: 'Payment against NINV-005' },
      { Posting_Date: new Date('2025-03-08'), Voucher_No: 'BRV-007', Voucher_Type: 'BRV', GL_Code: '1101', GL_Name: 'Cash at Bank - HBL', Debit: 650000, Credit: 0, Party_ID: '', Party_Type: '', Party_Name: '', Document_No: 'REC-007', Document_Date: new Date('2025-03-08'), Invoice_No: '', Due_Date: null, Cost_Center: '', Department: 'Finance', Project: '', Currency: 'PKR', Description: 'Receipt from Beta Enterprises', Narration: 'Collection against INV-007' },
      { Posting_Date: new Date('2025-03-08'), Voucher_No: 'BRV-007', Voucher_Type: 'BRV', GL_Code: '1301', GL_Name: 'Trade Receivables', Debit: 0, Credit: 650000, Party_ID: 'CUST-002', Party_Type: 'CUSTOMER', Party_Name: 'Beta Enterprises', Document_No: 'REC-007', Document_Date: new Date('2025-03-08'), Invoice_No: 'INV-007', Due_Date: null, Cost_Center: '', Department: 'Finance', Project: '', Currency: 'PKR', Description: 'Receipt from Beta Enterprises', Narration: 'Collection against INV-007' },
      { Posting_Date: new Date('2025-03-10'), Voucher_No: 'PV-007', Voucher_Type: 'PV', GL_Code: '5101', GL_Name: 'Cost of Goods Sold', Debit: 550000, Credit: 0, Party_ID: '', Party_Type: '', Party_Name: '', Document_No: 'GRN-007', Document_Date: new Date('2025-03-10'), Invoice_No: '', Due_Date: null, Cost_Center: 'CC-02', Department: 'Procurement', Project: '', Currency: 'PKR', Description: 'Cost of goods purchased', Narration: 'Purchase from Quality Materials' },
      { Posting_Date: new Date('2025-03-10'), Voucher_No: 'PV-007', Voucher_Type: 'PV', GL_Code: '2101', GL_Name: 'Trade Payables', Debit: 0, Credit: 550000, Party_ID: 'VEND-002', Party_Type: 'VENDOR', Party_Name: 'Quality Materials Ltd', Document_No: 'QINV-007', Document_Date: new Date('2025-03-10'), Invoice_No: 'QINV-007', Due_Date: new Date('2025-04-09'), Cost_Center: 'CC-02', Department: 'Procurement', Project: '', Currency: 'PKR', Description: 'Vendor invoice', Narration: 'Purchase from Quality Materials' },
      { Posting_Date: new Date('2025-03-12'), Voucher_No: 'SV-010', Voucher_Type: 'SV', GL_Code: '1301', GL_Name: 'Trade Receivables', Debit: 650000, Credit: 0, Party_ID: 'CUST-005', Party_Type: 'CUSTOMER', Party_Name: 'Epsilon Solutions', Document_No: 'INV-010', Document_Date: new Date('2025-03-12'), Invoice_No: 'INV-010', Due_Date: new Date('2025-04-11'), Cost_Center: 'CC-01', Department: 'Sales', Project: '', Currency: 'PKR', Description: 'Sales to Epsilon Solutions', Narration: 'Sales invoice for March' },
      { Posting_Date: new Date('2025-03-12'), Voucher_No: 'SV-010', Voucher_Type: 'SV', GL_Code: '4101', GL_Name: 'Sales Revenue', Debit: 0, Credit: 650000, Party_ID: '', Party_Type: '', Party_Name: '', Document_No: '', Document_Date: null, Invoice_No: '', Due_Date: null, Cost_Center: 'CC-01', Department: 'Sales', Project: '', Currency: 'PKR', Description: 'Sales revenue', Narration: 'Sales invoice for March' },
      { Posting_Date: new Date('2025-03-15'), Voucher_No: 'BPV-006', Voucher_Type: 'BPV', GL_Code: '2101', GL_Name: 'Trade Payables', Debit: 500000, Credit: 0, Party_ID: 'VEND-001', Party_Type: 'VENDOR', Party_Name: 'Prime Suppliers Co', Document_No: 'PAY-006', Document_Date: new Date('2025-03-15'), Invoice_No: 'PINV-006', Due_Date: null, Cost_Center: '', Department: 'Finance', Project: '', Currency: 'PKR', Description: 'Payment to Prime Suppliers', Narration: 'Payment against PINV-006' },
      { Posting_Date: new Date('2025-03-15'), Voucher_No: 'BPV-006', Voucher_Type: 'BPV', GL_Code: '1101', GL_Name: 'Cash at Bank - HBL', Debit: 0, Credit: 500000, Party_ID: '', Party_Type: '', Party_Name: '', Document_No: 'PAY-006', Document_Date: new Date('2025-03-15'), Invoice_No: '', Due_Date: null, Cost_Center: '', Department: 'Finance', Project: '', Currency: 'PKR', Description: 'Payment to Prime Suppliers', Narration: 'Payment against PINV-006' },
      { Posting_Date: new Date('2025-03-18'), Voucher_No: 'BRV-008', Voucher_Type: 'BRV', GL_Code: '1101', GL_Name: 'Cash at Bank - HBL', Debit: 550000, Credit: 0, Party_ID: '', Party_Type: '', Party_Name: '', Document_No: 'REC-008', Document_Date: new Date('2025-03-18'), Invoice_No: '', Due_Date: null, Cost_Center: '', Department: 'Finance', Project: '', Currency: 'PKR', Description: 'Receipt from Gamma Industries', Narration: 'Collection against INV-008' },
      { Posting_Date: new Date('2025-03-18'), Voucher_No: 'BRV-008', Voucher_Type: 'BRV', GL_Code: '1301', GL_Name: 'Trade Receivables', Debit: 0, Credit: 550000, Party_ID: 'CUST-003', Party_Type: 'CUSTOMER', Party_Name: 'Gamma Industries Ltd', Document_No: 'REC-008', Document_Date: new Date('2025-03-18'), Invoice_No: 'INV-008', Due_Date: null, Cost_Center: '', Department: 'Finance', Project: '', Currency: 'PKR', Description: 'Receipt from Gamma Industries', Narration: 'Collection against INV-008' },
      { Posting_Date: new Date('2025-03-20'), Voucher_No: 'SV-011', Voucher_Type: 'SV', GL_Code: '1301', GL_Name: 'Trade Receivables', Debit: 600000, Credit: 0, Party_ID: 'CUST-001', Party_Type: 'CUSTOMER', Party_Name: 'Alpha Traders Pvt Ltd', Document_No: 'INV-011', Document_Date: new Date('2025-03-20'), Invoice_No: 'INV-011', Due_Date: new Date('2025-04-19'), Cost_Center: 'CC-01', Department: 'Sales', Project: '', Currency: 'PKR', Description: 'Sales to Alpha Traders', Narration: 'Sales invoice for March' },
      { Posting_Date: new Date('2025-03-20'), Voucher_No: 'SV-011', Voucher_Type: 'SV', GL_Code: '4101', GL_Name: 'Sales Revenue', Debit: 0, Credit: 600000, Party_ID: '', Party_Type: '', Party_Name: '', Document_No: '', Document_Date: null, Invoice_No: '', Due_Date: null, Cost_Center: 'CC-01', Department: 'Sales', Project: '', Currency: 'PKR', Description: 'Sales revenue', Narration: 'Sales invoice for March' },
      { Posting_Date: new Date('2025-03-22'), Voucher_No: 'PV-008', Voucher_Type: 'PV', GL_Code: '5101', GL_Name: 'Cost of Goods Sold', Debit: 550000, Credit: 0, Party_ID: '', Party_Type: '', Party_Name: '', Document_No: 'GRN-008', Document_Date: new Date('2025-03-22'), Invoice_No: '', Due_Date: null, Cost_Center: 'CC-02', Department: 'Procurement', Project: '', Currency: 'PKR', Description: 'Cost of goods purchased', Narration: 'Purchase from Standard Parts' },
      { Posting_Date: new Date('2025-03-22'), Voucher_No: 'PV-008', Voucher_Type: 'PV', GL_Code: '2101', GL_Name: 'Trade Payables', Debit: 0, Credit: 550000, Party_ID: 'VEND-003', Party_Type: 'VENDOR', Party_Name: 'Standard Parts Inc', Document_No: 'SINV-008', Document_Date: new Date('2025-03-22'), Invoice_No: 'SINV-008', Due_Date: new Date('2025-04-21'), Cost_Center: 'CC-02', Department: 'Procurement', Project: '', Currency: 'PKR', Description: 'Vendor invoice', Narration: 'Purchase from Standard Parts' },
      { Posting_Date: new Date('2025-03-25'), Voucher_No: 'BRV-009', Voucher_Type: 'BRV', GL_Code: '1101', GL_Name: 'Cash at Bank - HBL', Debit: 600000, Credit: 0, Party_ID: '', Party_Type: '', Party_Name: '', Document_No: 'REC-009', Document_Date: new Date('2025-03-25'), Invoice_No: '', Due_Date: null, Cost_Center: '', Department: 'Finance', Project: '', Currency: 'PKR', Description: 'Receipt from Delta Corp', Narration: 'Collection against INV-009' },
      { Posting_Date: new Date('2025-03-25'), Voucher_No: 'BRV-009', Voucher_Type: 'BRV', GL_Code: '1301', GL_Name: 'Trade Receivables', Debit: 0, Credit: 600000, Party_ID: 'CUST-004', Party_Type: 'CUSTOMER', Party_Name: 'Delta Corporation', Document_No: 'REC-009', Document_Date: new Date('2025-03-25'), Invoice_No: 'INV-009', Due_Date: null, Cost_Center: '', Department: 'Finance', Project: '', Currency: 'PKR', Description: 'Receipt from Delta Corp', Narration: 'Collection against INV-009' },
      { Posting_Date: new Date('2025-03-28'), Voucher_No: 'BPV-007', Voucher_Type: 'BPV', GL_Code: '2101', GL_Name: 'Trade Payables', Debit: 500000, Credit: 0, Party_ID: 'VEND-002', Party_Type: 'VENDOR', Party_Name: 'Quality Materials Ltd', Document_No: 'PAY-007', Document_Date: new Date('2025-03-28'), Invoice_No: 'QINV-007', Due_Date: null, Cost_Center: '', Department: 'Finance', Project: '', Currency: 'PKR', Description: 'Payment to Quality Materials', Narration: 'Payment against QINV-007' },
      { Posting_Date: new Date('2025-03-28'), Voucher_No: 'BPV-007', Voucher_Type: 'BPV', GL_Code: '1101', GL_Name: 'Cash at Bank - HBL', Debit: 0, Credit: 500000, Party_ID: '', Party_Type: '', Party_Name: '', Document_No: 'PAY-007', Document_Date: new Date('2025-03-28'), Invoice_No: '', Due_Date: null, Cost_Center: '', Department: 'Finance', Project: '', Currency: 'PKR', Description: 'Payment to Quality Materials', Narration: 'Payment against QINV-007' },
      { Posting_Date: new Date('2025-03-30'), Voucher_No: 'SV-012', Voucher_Type: 'SV', GL_Code: '1301', GL_Name: 'Trade Receivables', Debit: 600000, Credit: 0, Party_ID: 'CUST-002', Party_Type: 'CUSTOMER', Party_Name: 'Beta Enterprises', Document_No: 'INV-012', Document_Date: new Date('2025-03-30'), Invoice_No: 'INV-012', Due_Date: new Date('2025-04-29'), Cost_Center: 'CC-01', Department: 'Sales', Project: '', Currency: 'PKR', Description: 'Sales to Beta Enterprises', Narration: 'Sales invoice for March' },
      { Posting_Date: new Date('2025-03-30'), Voucher_No: 'SV-012', Voucher_Type: 'SV', GL_Code: '4101', GL_Name: 'Sales Revenue', Debit: 0, Credit: 600000, Party_ID: '', Party_Type: '', Party_Name: '', Document_No: '', Document_Date: null, Invoice_No: '', Due_Date: null, Cost_Center: 'CC-01', Department: 'Sales', Project: '', Currency: 'PKR', Description: 'Sales revenue', Narration: 'Sales invoice for March' },
      { Posting_Date: new Date('2025-04-02'), Voucher_No: 'PV-009', Voucher_Type: 'PV', GL_Code: '5101', GL_Name: 'Cost of Goods Sold', Debit: 550000, Credit: 0, Party_ID: '', Party_Type: '', Party_Name: '', Document_No: 'GRN-009', Document_Date: new Date('2025-04-02'), Invoice_No: '', Due_Date: null, Cost_Center: 'CC-02', Department: 'Procurement', Project: '', Currency: 'PKR', Description: 'Cost of goods purchased', Narration: 'Purchase from Reliable Services' },
      { Posting_Date: new Date('2025-04-02'), Voucher_No: 'PV-009', Voucher_Type: 'PV', GL_Code: '2101', GL_Name: 'Trade Payables', Debit: 0, Credit: 550000, Party_ID: 'VEND-004', Party_Type: 'VENDOR', Party_Name: 'Reliable Services', Document_No: 'RINV-009', Document_Date: new Date('2025-04-02'), Invoice_No: 'RINV-009', Due_Date: new Date('2025-05-02'), Cost_Center: 'CC-02', Department: 'Procurement', Project: '', Currency: 'PKR', Description: 'Vendor invoice', Narration: 'Purchase from Reliable Services' },
      { Posting_Date: new Date('2025-04-05'), Voucher_No: 'BRV-010', Voucher_Type: 'BRV', GL_Code: '1101', GL_Name: 'Cash at Bank - HBL', Debit: 600000, Credit: 0, Party_ID: '', Party_Type: '', Party_Name: '', Document_No: 'REC-010', Document_Date: new Date('2025-04-05'), Invoice_No: '', Due_Date: null, Cost_Center: '', Department: 'Finance', Project: '', Currency: 'PKR', Description: 'Receipt from Epsilon', Narration: 'Collection INV-010' },
      { Posting_Date: new Date('2025-04-05'), Voucher_No: 'BRV-010', Voucher_Type: 'BRV', GL_Code: '1301', GL_Name: 'Trade Receivables', Debit: 0, Credit: 600000, Party_ID: 'CUST-005', Party_Type: 'CUSTOMER', Party_Name: 'Epsilon Solutions', Document_No: 'REC-010', Document_Date: new Date('2025-04-05'), Invoice_No: 'INV-010', Due_Date: null, Cost_Center: '', Department: 'Finance', Project: '', Currency: 'PKR', Description: 'Receipt from Epsilon', Narration: 'Collection INV-010' },
      { Posting_Date: new Date('2025-04-08'), Voucher_No: 'BPV-008', Voucher_Type: 'BPV', GL_Code: '2101', GL_Name: 'Trade Payables', Debit: 500000, Credit: 0, Party_ID: 'VEND-003', Party_Type: 'VENDOR', Party_Name: 'Standard Parts Inc', Document_No: 'PAY-008', Document_Date: new Date('2025-04-08'), Invoice_No: 'SINV-008', Due_Date: null, Cost_Center: '', Department: 'Finance', Project: '', Currency: 'PKR', Description: 'Payment to Standard Parts', Narration: 'Payment against SINV-008' },
      { Posting_Date: new Date('2025-04-08'), Voucher_No: 'BPV-008', Voucher_Type: 'BPV', GL_Code: '1101', GL_Name: 'Cash at Bank - HBL', Debit: 0, Credit: 500000, Party_ID: '', Party_Type: '', Party_Name: '', Document_No: 'PAY-008', Document_Date: new Date('2025-04-08'), Invoice_No: '', Due_Date: null, Cost_Center: '', Department: 'Finance', Project: '', Currency: 'PKR', Description: 'Payment to Standard Parts', Narration: 'Payment against SINV-008' },
      { Posting_Date: new Date('2025-04-10'), Voucher_No: 'SV-013', Voucher_Type: 'SV', GL_Code: '1301', GL_Name: 'Trade Receivables', Debit: 500000, Credit: 0, Party_ID: 'CUST-003', Party_Type: 'CUSTOMER', Party_Name: 'Gamma Industries Ltd', Document_No: 'INV-013', Document_Date: new Date('2025-04-10'), Invoice_No: 'INV-013', Due_Date: new Date('2025-05-10'), Cost_Center: 'CC-01', Department: 'Sales', Project: '', Currency: 'PKR', Description: 'Sales to Gamma Industries', Narration: 'Sales invoice for April' },
      { Posting_Date: new Date('2025-04-10'), Voucher_No: 'SV-013', Voucher_Type: 'SV', GL_Code: '4101', GL_Name: 'Sales Revenue', Debit: 0, Credit: 500000, Party_ID: '', Party_Type: '', Party_Name: '', Document_No: '', Document_Date: null, Invoice_No: '', Due_Date: null, Cost_Center: 'CC-01', Department: 'Sales', Project: '', Currency: 'PKR', Description: 'Sales revenue', Narration: 'Sales invoice for April' },
      { Posting_Date: new Date('2025-04-12'), Voucher_No: 'BRV-011', Voucher_Type: 'BRV', GL_Code: '1101', GL_Name: 'Cash at Bank - HBL', Debit: 550000, Credit: 0, Party_ID: '', Party_Type: '', Party_Name: '', Document_No: 'REC-011', Document_Date: new Date('2025-04-12'), Invoice_No: '', Due_Date: null, Cost_Center: '', Department: 'Finance', Project: '', Currency: 'PKR', Description: 'Receipt from Alpha Traders', Narration: 'Collection against INV-011' },
      { Posting_Date: new Date('2025-04-12'), Voucher_No: 'BRV-011', Voucher_Type: 'BRV', GL_Code: '1301', GL_Name: 'Trade Receivables', Debit: 0, Credit: 550000, Party_ID: 'CUST-001', Party_Type: 'CUSTOMER', Party_Name: 'Alpha Traders Pvt Ltd', Document_No: 'REC-011', Document_Date: new Date('2025-04-12'), Invoice_No: 'INV-011', Due_Date: null, Cost_Center: '', Department: 'Finance', Project: '', Currency: 'PKR', Description: 'Receipt from Alpha Traders', Narration: 'Collection against INV-011' },
      { Posting_Date: new Date('2025-04-15'), Voucher_No: 'PV-010', Voucher_Type: 'PV', GL_Code: '5101', GL_Name: 'Cost of Goods Sold', Debit: 550000, Credit: 0, Party_ID: '', Party_Type: '', Party_Name: '', Document_No: 'GRN-010', Document_Date: new Date('2025-04-15'), Invoice_No: '', Due_Date: null, Cost_Center: 'CC-02', Department: 'Procurement', Project: '', Currency: 'PKR', Description: 'Cost of goods purchased', Narration: 'Purchase from National Trading' },
      { Posting_Date: new Date('2025-04-15'), Voucher_No: 'PV-010', Voucher_Type: 'PV', GL_Code: '2101', GL_Name: 'Trade Payables', Debit: 0, Credit: 550000, Party_ID: 'VEND-005', Party_Type: 'VENDOR', Party_Name: 'National Trading House', Document_No: 'NINV-010', Document_Date: new Date('2025-04-15'), Invoice_No: 'NINV-010', Due_Date: new Date('2025-05-15'), Cost_Center: 'CC-02', Department: 'Procurement', Project: '', Currency: 'PKR', Description: 'Vendor invoice', Narration: 'Purchase from National Trading' },
      { Posting_Date: new Date('2025-04-18'), Voucher_No: 'BPV-009', Voucher_Type: 'BPV', GL_Code: '2101', GL_Name: 'Trade Payables', Debit: 500000, Credit: 0, Party_ID: 'VEND-004', Party_Type: 'VENDOR', Party_Name: 'Reliable Services', Document_No: 'PAY-009', Document_Date: new Date('2025-04-18'), Invoice_No: 'RINV-009', Due_Date: null, Cost_Center: '', Department: 'Finance', Project: '', Currency: 'PKR', Description: 'Payment to Reliable Services', Narration: 'Payment against RINV-009' },
      { Posting_Date: new Date('2025-04-18'), Voucher_No: 'BPV-009', Voucher_Type: 'BPV', GL_Code: '1101', GL_Name: 'Cash at Bank - HBL', Debit: 0, Credit: 500000, Party_ID: '', Party_Type: '', Party_Name: '', Document_No: 'PAY-009', Document_Date: new Date('2025-04-18'), Invoice_No: '', Due_Date: null, Cost_Center: '', Department: 'Finance', Project: '', Currency: 'PKR', Description: 'Payment to Reliable Services', Narration: 'Payment against RINV-009' },
      { Posting_Date: new Date('2025-04-20'), Voucher_No: 'BRV-012', Voucher_Type: 'BRV', GL_Code: '1101', GL_Name: 'Cash at Bank - HBL', Debit: 550000, Credit: 0, Party_ID: '', Party_Type: '', Party_Name: '', Document_No: 'REC-012', Document_Date: new Date('2025-04-20'), Invoice_No: '', Due_Date: null, Cost_Center: '', Department: 'Finance', Project: '', Currency: 'PKR', Description: 'Receipt from Beta Enterprises', Narration: 'Collection INV-012' },
      { Posting_Date: new Date('2025-04-20'), Voucher_No: 'BRV-012', Voucher_Type: 'BRV', GL_Code: '1301', GL_Name: 'Trade Receivables', Debit: 0, Credit: 550000, Party_ID: 'CUST-002', Party_Type: 'CUSTOMER', Party_Name: 'Beta Enterprises', Document_No: 'REC-012', Document_Date: new Date('2025-04-20'), Invoice_No: 'INV-012', Due_Date: null, Cost_Center: '', Department: 'Finance', Project: '', Currency: 'PKR', Description: 'Receipt from Beta Enterprises', Narration: 'Collection INV-012' },
      { Posting_Date: new Date('2025-04-22'), Voucher_No: 'BPV-010', Voucher_Type: 'BPV', GL_Code: '2101', GL_Name: 'Trade Payables', Debit: 500000, Credit: 0, Party_ID: 'VEND-005', Party_Type: 'VENDOR', Party_Name: 'National Trading House', Document_No: 'PAY-010', Document_Date: new Date('2025-04-22'), Invoice_No: 'NINV-010', Due_Date: null, Cost_Center: '', Department: 'Finance', Project: '', Currency: 'PKR', Description: 'Payment to National Trading', Narration: 'Payment against NINV-010' },
      { Posting_Date: new Date('2025-04-22'), Voucher_No: 'BPV-010', Voucher_Type: 'BPV', GL_Code: '1101', GL_Name: 'Cash at Bank - HBL', Debit: 0, Credit: 500000, Party_ID: '', Party_Type: '', Party_Name: '', Document_No: 'PAY-010', Document_Date: new Date('2025-04-22'), Invoice_No: '', Due_Date: null, Cost_Center: '', Department: 'Finance', Project: '', Currency: 'PKR', Description: 'Payment to National Trading', Narration: 'Payment against NINV-010' },
    ];
    glSheet.addRows(glSampleData);
    // Data validation for Voucher_Type (C) and Party_Type (I) columns
    for (let i = 2; i <= 100; i++) {
      glSheet.getCell(`C${i}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"JV,BPV,BRV,CPV,CRV,SV,PV"'],
        showErrorMessage: true,
        errorTitle: 'Invalid Voucher Type',
        error: 'Please select a valid voucher type',
      };
      glSheet.getCell(`I${i}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"CUSTOMER,VENDOR,OTHER"'],
        showErrorMessage: true,
        errorTitle: 'Invalid Party Type',
        error: 'Please select CUSTOMER, VENDOR, or OTHER',
      };
    }
    glSheet.getColumn('F').numFmt = '#,##0';
    glSheet.getColumn('G').numFmt = '#,##0';

    const openItemsSheet = workbook.addWorksheet('Open Items');
    openItemsSheet.columns = [
      { header: 'Population_Type', key: 'Population_Type', width: 15 },
      { header: 'Party_ID', key: 'Party_ID', width: 15 },
      { header: 'GL_Code', key: 'GL_Code', width: 15 },
      { header: 'GL_Name', key: 'GL_Name', width: 25 },
      { header: 'Document_No', key: 'Document_No', width: 18 },
      { header: 'Document_Date', key: 'Document_Date', width: 14 },
      { header: 'Due_Date', key: 'Due_Date', width: 14 },
      { header: 'Invoice_No', key: 'Invoice_No', width: 18 },
      { header: 'Outstanding_Amount', key: 'Outstanding_Amount', width: 18 },
      { header: 'Currency', key: 'Currency', width: 10 },
      { header: 'Description', key: 'Description', width: 30 },
      { header: 'Include_in_Confirm', key: 'Include_in_Confirm', width: 18 },
    ];
    openItemsSheet.getRow(1).eachCell((cell) => { cell.style = headerStyle; });
    openItemsSheet.addRows([
      { Population_Type: 'AR', Party_ID: 'CUST-001', GL_Code: '1301', GL_Name: 'Trade Receivables', Document_No: 'INV-011', Document_Date: new Date('2025-03-20'), Due_Date: new Date('2025-04-19'), Invoice_No: 'INV-011', Outstanding_Amount: 250000, Currency: 'PKR', Description: 'Outstanding from Alpha Traders', Include_in_Confirm: 'Y' },
      { Population_Type: 'AR', Party_ID: 'CUST-002', GL_Code: '1301', GL_Name: 'Trade Receivables', Document_No: 'INV-012', Document_Date: new Date('2025-03-30'), Due_Date: new Date('2025-04-29'), Invoice_No: 'INV-012', Outstanding_Amount: 200000, Currency: 'PKR', Description: 'Outstanding from Beta Enterprises', Include_in_Confirm: 'Y' },
      { Population_Type: 'AR', Party_ID: 'CUST-003', GL_Code: '1301', GL_Name: 'Trade Receivables', Document_No: 'INV-013', Document_Date: new Date('2025-04-10'), Due_Date: new Date('2025-05-10'), Invoice_No: 'INV-013', Outstanding_Amount: 300000, Currency: 'PKR', Description: 'Outstanding from Gamma Industries', Include_in_Confirm: 'Y' },
      { Population_Type: 'AR', Party_ID: 'CUST-004', GL_Code: '1301', GL_Name: 'Trade Receivables', Document_No: 'INV-009', Document_Date: new Date('2025-03-02'), Due_Date: new Date('2025-04-01'), Invoice_No: 'INV-009', Outstanding_Amount: 200000, Currency: 'PKR', Description: 'Outstanding from Delta Corp', Include_in_Confirm: 'Y' },
      { Population_Type: 'AR', Party_ID: 'CUST-005', GL_Code: '1301', GL_Name: 'Trade Receivables', Document_No: 'INV-010', Document_Date: new Date('2025-03-12'), Due_Date: new Date('2025-04-11'), Invoice_No: 'INV-010', Outstanding_Amount: 150000, Currency: 'PKR', Description: 'Outstanding from Epsilon Solutions', Include_in_Confirm: 'Y' },
      { Population_Type: 'AP', Party_ID: 'VEND-001', GL_Code: '2101', GL_Name: 'Trade Payables', Document_No: 'PINV-006', Document_Date: new Date('2025-02-28'), Due_Date: new Date('2025-03-30'), Invoice_No: 'PINV-006', Outstanding_Amount: 100000, Currency: 'PKR', Description: 'Outstanding to Prime Suppliers', Include_in_Confirm: 'Y' },
      { Population_Type: 'AP', Party_ID: 'VEND-002', GL_Code: '2101', GL_Name: 'Trade Payables', Document_No: 'QINV-007', Document_Date: new Date('2025-03-10'), Due_Date: new Date('2025-04-09'), Invoice_No: 'QINV-007', Outstanding_Amount: 100000, Currency: 'PKR', Description: 'Outstanding to Quality Materials', Include_in_Confirm: 'Y' },
      { Population_Type: 'AP', Party_ID: 'VEND-003', GL_Code: '2101', GL_Name: 'Trade Payables', Document_No: 'SINV-008', Document_Date: new Date('2025-03-22'), Due_Date: new Date('2025-04-21'), Invoice_No: 'SINV-008', Outstanding_Amount: 100000, Currency: 'PKR', Description: 'Outstanding to Standard Parts', Include_in_Confirm: 'Y' },
      { Population_Type: 'AP', Party_ID: 'VEND-004', GL_Code: '2101', GL_Name: 'Trade Payables', Document_No: 'RINV-009', Document_Date: new Date('2025-04-02'), Due_Date: new Date('2025-05-02'), Invoice_No: 'RINV-009', Outstanding_Amount: 100000, Currency: 'PKR', Description: 'Outstanding to Reliable Services', Include_in_Confirm: 'Y' },
      { Population_Type: 'AP', Party_ID: 'VEND-005', GL_Code: '2101', GL_Name: 'Trade Payables', Document_No: 'NINV-010', Document_Date: new Date('2025-04-15'), Due_Date: new Date('2025-05-15'), Invoice_No: 'NINV-010', Outstanding_Amount: 100000, Currency: 'PKR', Description: 'Outstanding to National Trading', Include_in_Confirm: 'Y' },
    ]);
    for (let i = 2; i <= 100; i++) {
      openItemsSheet.getCell(`A${i}`).dataValidation = {
        type: 'list',
        allowBlank: false,
        formulae: ['"AR,AP"'],
        showErrorMessage: true,
        errorTitle: 'Invalid Population Type',
        error: 'Please select AR or AP',
      };
      openItemsSheet.getCell(`L${i}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"Y,N"'],
        showErrorMessage: true,
        errorTitle: 'Invalid Value',
        error: 'Please select Y or N',
      };
    }
    openItemsSheet.getColumn('I').numFmt = '#,##0';

    const buffer = await workbook.xlsx.writeBuffer();

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="AuditWise_Input_Template.xlsx"');
    res.send(buffer);
  } catch (error) {
    console.error("Error generating template:", error);
    res.status(500).json({ error: "Failed to generate template" });
  }
});

router.get("/template/:datasetType", async (req: Request, res: Response) => {
  const { datasetType } = req.params;
  const redirectMap: Record<string, string> = {
    tb: '/api/templates/download/tb-template',
    gl: '/api/templates/download/gl-template',
    ap: '/api/templates/download/ap-template',
    ar: '/api/templates/download/ar-template',
    bank: '/api/templates/download/bank-template',
  };
  const target = redirectMap[datasetType];
  if (target) {
    return res.redirect(target);
  }
  return res.status(400).json({ error: 'Unknown dataset type' });
});

router.get("/:engagementId/batches", async (req: Request, res: Response) => {
  try {
    const { engagementId } = req.params;
    
    const batches = await prisma.importBatch.findMany({
      where: { engagementId },
      orderBy: { createdAt: "desc" },
      include: {
        uploadedBy: { select: { id: true, fullName: true, username: true } },
        validatedBy: { select: { id: true, fullName: true, username: true } },
        approvedBy: { select: { id: true, fullName: true, username: true } },
        postedBy: { select: { id: true, fullName: true, username: true } },
        stagingRows: { select: { recordType: true, hasError: true } },
        issues: { select: { severity: true } },
      },
    });

    const batchesWithStats = batches.map((batch) => {
      const recordTypeCounts = batch.stagingRows.reduce((acc: Record<string, number>, row) => {
        const recordType = row.recordType || 'UNKNOWN';
        acc[recordType] = (acc[recordType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const validRows = batch.stagingRows.filter((r) => !r.hasError).length;
      const errorCount = batch.issues.filter((i) => i.severity === "ERROR").length;
      const warningCount = batch.issues.filter((i) => i.severity === "WARN").length;

      return {
        ...batch,
        stagingRows: undefined,
        issues: undefined,
        stats: {
          totalRows: batch.stagingRows.length,
          validRows,
          invalidRows: batch.stagingRows.length - validRows,
          errorCount,
          warningCount,
          recordTypeCounts,
        },
      };
    });

    res.json(batchesWithStats);
  } catch (error) {
    console.error("Error fetching import batches:", error);
    res.status(500).json({ error: "Failed to fetch import batches" });
  }
});

router.get("/:engagementId/batches/:batchId", async (req: Request, res: Response) => {
  try {
    const { engagementId, batchId } = req.params;

    const batch = await prisma.importBatch.findFirst({
      where: { id: batchId, engagementId },
      include: {
        uploadedBy: { select: { id: true, fullName: true, username: true } },
        validatedBy: { select: { id: true, fullName: true, username: true } },
        submittedBy: { select: { id: true, fullName: true, username: true } },
        approvedBy: { select: { id: true, fullName: true, username: true } },
        postedBy: { select: { id: true, fullName: true, username: true } },
        stagingRows: {
          orderBy: [{ recordType: "asc" }, { rowNo: "asc" }],
        },
        issues: {
          orderBy: [{ severity: "asc" }, { rowNo: "asc" }],
        },
      },
    });

    if (!batch) {
      return res.status(404).json({ error: "Batch not found" });
    }

    res.json(batch);
  } catch (error) {
    console.error("Error fetching import batch:", error);
    res.status(500).json({ error: "Failed to fetch import batch" });
  }
});

router.post("/:engagementId/upload", upload.single("file"), async (req: Request, res: Response) => {
  try {
    const { engagementId } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const engagement = await prisma.engagement.findUnique({
      where: { id: engagementId },
      select: { id: true, engagementCode: true, periodStart: true, periodEnd: true },
    });

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);

    const batch = await prisma.importBatch.create({
      data: {
        engagementId,
        batchNumber: `BATCH-${Date.now()}`,
        uploadedById: userId,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        status: "UPLOADED",
      },
    });

    const stagingRows: {
      batchId: string;
      recordType: "GL_LINE" | "OB_ACCOUNT" | "CB_ACCOUNT" | "OB_PARTY" | "CB_PARTY" | "BANK_MASTER" | "CB_BANK";
      rowNo: number;
      payload: any;
      hasError: boolean;
    }[] = [];

    const recordTypeSheetMap: Record<string, ImportRecordTypeEnum> = {
      GL_LINE: "GL_LINE",
      OB_ACCOUNT: "OB_ACCOUNT",
      CB_ACCOUNT: "CB_ACCOUNT",
      OB_PARTY: "OB_PARTY",
      CB_PARTY: "CB_PARTY",
      BANK_MASTER: "BANK_MASTER",
      CB_BANK: "CB_BANK",
    };

    for (const sheetName of Object.keys(recordTypeSheetMap)) {
      const worksheet = workbook.getWorksheet(sheetName);
      if (!worksheet) continue;

      const headers: string[] = [];
      worksheet.getRow(1).eachCell((cell, colNumber) => {
        headers[colNumber - 1] = String(cell.value || "").trim();
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

        if (Object.values(rawData).every((v) => v === null || v === undefined || v === "")) {
          return;
        }

        const parsedData = parseRowData(sheetName as ImportRecordTypeEnum, rawData);

        stagingRows.push({
          batchId: batch.id,
          recordType: sheetName as ImportRecordTypeEnum,
          rowNo: rowNumber,
          payload: { raw: rawData, parsed: parsedData },
          hasError: false,
        });
      });
    }

    if (stagingRows.length > 0) {
      await prisma.importStagingRow.createMany({
        data: stagingRows,
      });
    }

    await prisma.importBatch.update({
      where: { id: batch.id },
      data: {
        totalRows: stagingRows.length,
        status: "VALIDATING",
      },
    });

    await prisma.importAuditLog.create({
      data: {
        batchId: batch.id,
        action: "UPLOAD",
        userId: userId,
        details: {
          fileName: req.file.originalname,
          totalRows: stagingRows.length,
          recordTypeCounts: stagingRows.reduce((acc: Record<string, number>, r) => {
            acc[r.recordType] = (acc[r.recordType] || 0) + 1;
            return acc;
          }, {} as Record<string, number>),
        },
      },
    });

    res.json({
      batchId: batch.id,
      fileName: req.file.originalname,
      totalRows: stagingRows.length,
      recordTypeCounts: stagingRows.reduce((acc: Record<string, number>, r) => {
        acc[r.recordType] = (acc[r.recordType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      status: "VALIDATING",
    });
  } catch (error) {
    console.error("Error uploading import file:", error);
    res.status(500).json({ error: "Failed to upload import file" });
  }
});

function parseRowData(recordType: ImportRecordTypeEnum, rawData: Record<string, any>): Record<string, any> {
  const parseNumber = (val: any): number | null => {
    if (val === null || val === undefined || val === "") return null;
    const num = typeof val === "number" ? val : parseFloat(String(val).replace(/,/g, ""));
    return isNaN(num) ? null : num;
  };

  const parseDate = (val: any): string | null => {
    if (!val) return null;
    if (val instanceof Date) {
      return val.toISOString().split("T")[0];
    }
    return String(val);
  };

  switch (recordType) {
    case "GL_LINE":
      return {
        code: String(rawData["Code"] || "").trim(),
        accountName: String(rawData["Account Name"] || "").trim(),
        voucherNo: String(rawData["Voucher #"] || "").trim(),
        date: parseDate(rawData["Date"]),
        debit: parseNumber(rawData["Debit"]) || 0,
        credit: parseNumber(rawData["Credit"]) || 0,
        currency: String(rawData["Currency"] || "PKR").trim(),
        docType: String(rawData["Doc Type"] || "").trim(),
        refNumber: String(rawData["Ref #"] || "").trim(),
        narrative: String(rawData["Narrative"] || "").trim(),
      };

    case "OB_ACCOUNT":
      return {
        code: String(rawData["Code"] || "").trim(),
        accountName: String(rawData["Account Name"] || "").trim(),
        openingDebit: parseNumber(rawData["Opening Debit"]) || 0,
        openingCredit: parseNumber(rawData["Opening Credit"]) || 0,
      };

    case "CB_ACCOUNT":
      return {
        code: String(rawData["Code"] || "").trim(),
        accountName: String(rawData["Account Name"] || "").trim(),
        closingDebit: parseNumber(rawData["Closing Debit"]) || 0,
        closingCredit: parseNumber(rawData["Closing Credit"]) || 0,
      };

    case "OB_PARTY":
      return {
        partyType: String(rawData["Party Type"] || "").trim().toUpperCase(),
        partyCode: String(rawData["Party Code"] || "").trim(),
        partyName: String(rawData["Party Name"] || "").trim(),
        openingDebit: parseNumber(rawData["Opening Debit"]) || 0,
        openingCredit: parseNumber(rawData["Opening Credit"]) || 0,
        controlAccountCode: String(rawData["Control Account"] || "").trim(),
      };

    case "CB_PARTY":
      return {
        partyType: String(rawData["Party Type"] || "").trim().toUpperCase(),
        partyCode: String(rawData["Party Code"] || "").trim(),
        partyName: String(rawData["Party Name"] || "").trim(),
        closingDebit: parseNumber(rawData["Closing Debit"]) || 0,
        closingCredit: parseNumber(rawData["Closing Credit"]) || 0,
        controlAccountCode: String(rawData["Control Account"] || "").trim(),
        email: String(rawData["Email"] || "").trim(),
        phone: String(rawData["Phone"] || "").trim(),
      };

    case "BANK_MASTER":
      return {
        bankAccountCode: String(rawData["Bank Code"] || "").trim(),
        bankName: String(rawData["Bank Name"] || "").trim(),
        branchName: String(rawData["Branch"] || "").trim(),
        accountNo: String(rawData["Account Number"] || "").trim(),
        accountTitle: String(rawData["Account Type"] || "").trim(),
        currency: String(rawData["Currency"] || "PKR").trim(),
        glAccount: String(rawData["GL Account"] || "").trim(),
      };

    case "CB_BANK":
      return {
        bankAccountCode: String(rawData["Bank Code"] || "").trim(),
        statementDate: parseDate(rawData["Statement Date"]),
        bookBalance: parseNumber(rawData["Book Balance"]) || 0,
        statementBalance: parseNumber(rawData["Statement Balance"]) || 0,
        reconciled: String(rawData["Reconciled"] || "NO").trim().toUpperCase() === "YES",
      };

    default:
      return rawData;
  }
}

router.post("/:engagementId/batches/:batchId/validate", async (req: Request, res: Response) => {
  try {
    const { engagementId, batchId } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const batch = await prisma.importBatch.findFirst({
      where: { id: batchId, engagementId },
      include: {
        stagingRows: true,
      },
    });

    if (!batch) {
      return res.status(404).json({ error: "Batch not found" });
    }

    if (!["UPLOADED", "VALIDATING"].includes(batch.status)) {
      return res.status(400).json({ error: `Cannot validate batch in ${batch.status} status` });
    }

    await prisma.importIssue.deleteMany({ where: { batchId } });

    const issues: {
      batchId: string;
      rowNo?: number;
      recordType?: "GL_LINE" | "OB_ACCOUNT" | "CB_ACCOUNT" | "OB_PARTY" | "CB_PARTY" | "BANK_MASTER" | "CB_BANK";
      field?: string;
      severity: "ERROR" | "WARN" | "INFO";
      issueCode: string;
      issueMessage: string;
    }[] = [];

    const engagement = await prisma.engagement.findUnique({
      where: { id: engagementId },
      select: { periodStart: true, periodEnd: true },
    });

    const coaAccounts = await prisma.coAAccount.findMany({
      where: { engagementId },
      select: { accountCode: true, accountName: true },
    });
    const validCodes = new Set(coaAccounts.map((a) => a.accountCode));

    for (const row of batch.stagingRows) {
      const payload = row.payload as { raw?: any; parsed?: any };
      const data = payload.parsed || payload.raw || {};
      const rowIssues = validateRow(row.recordType as ImportRecordTypeEnum, data, row.rowNo, validCodes, engagement);
      
      for (const issue of rowIssues) {
        issues.push({
          batchId,
          rowNo: row.rowNo,
          recordType: row.recordType as ImportRecordTypeEnum,
          field: issue.field,
          severity: issue.severity,
          issueCode: issue.code,
          issueMessage: issue.message,
        });
      }

      const hasError = rowIssues.some((i) => i.severity === "ERROR");
      if (hasError !== row.hasError) {
        await prisma.importStagingRow.update({
          where: { id: row.id },
          data: { hasError },
        });
      }
    }

    const glRows = batch.stagingRows.filter(r => r.recordType === 'GL_LINE');
    const voucherTotals = new Map<string, { debit: number; credit: number; rows: typeof glRows }>();
    
    for (const row of glRows) {
      const payload = row.payload as { raw?: any; parsed?: any };
      const data = payload.parsed || payload.raw || {};
      const voucherNum = data.voucherNo;
      if (!voucherNum) continue;
      
      const current = voucherTotals.get(voucherNum) || { debit: 0, credit: 0, rows: [] };
      current.debit += data.debit || 0;
      current.credit += data.credit || 0;
      current.rows.push(row);
      voucherTotals.set(voucherNum, current);
    }
    
    for (const [voucherNum, totals] of voucherTotals) {
      const diff = Math.abs(totals.debit - totals.credit);
      if (diff > 0.01) {
        const firstRow = totals.rows[0];
        issues.push({
          batchId,
          rowNo: firstRow.rowNo,
          recordType: 'GL_LINE',
          field: 'voucherNo',
          severity: 'ERROR',
          issueCode: 'JOURNAL_IMBALANCE',
          issueMessage: `Voucher ${voucherNum} is unbalanced: Dr ${totals.debit.toFixed(2)} ≠ Cr ${totals.credit.toFixed(2)} (diff: ${diff.toFixed(2)})`,
        });
        
        for (const row of totals.rows) {
          await prisma.importStagingRow.update({
            where: { id: row.id },
            data: { hasError: true },
          });
        }
      }
    }

    const bankMasterRows = batch.stagingRows.filter(r => r.recordType === 'BANK_MASTER');
    const bankMasterCodes = new Set(bankMasterRows.map(r => {
      const payload = r.payload as { raw?: any; parsed?: any };
      return (payload.parsed || payload.raw || {}).bankAccountCode;
    }));
    
    const cbBankRows = batch.stagingRows.filter(r => r.recordType === 'CB_BANK');
    for (const row of cbBankRows) {
      const payload = row.payload as { raw?: any; parsed?: any };
      const data = payload.parsed || payload.raw || {};
      if (data.bankAccountCode && !bankMasterCodes.has(data.bankAccountCode)) {
        issues.push({
          batchId,
          rowNo: row.rowNo,
          recordType: 'CB_BANK',
          field: 'bankAccountCode',
          severity: 'ERROR',
          issueCode: 'MISSING_BANK_MASTER',
          issueMessage: `Bank code ${data.bankAccountCode} not found in BANK_MASTER sheet`,
        });
        await prisma.importStagingRow.update({
          where: { id: row.id },
          data: { hasError: true },
        });
      }
    }

    if (issues.length > 0) {
      await prisma.importIssue.createMany({ data: issues });
    }

    const errorCount = issues.filter((i) => i.severity === "ERROR").length;
    const warningCount = issues.filter((i) => i.severity === "WARN").length;
    const validRowCount = batch.stagingRows.length - new Set(issues.filter((i) => i.severity === "ERROR").map((i) => i.rowNo)).size;

    await prisma.importBatch.update({
      where: { id: batchId },
      data: {
        status: errorCount === 0 ? "READY" : "VALIDATING",
        validatedAt: new Date(),
        validatedById: userId,
        errorCount,
        warningCount,
      },
    });

    await prisma.importAuditLog.create({
      data: {
        batchId,
        action: "VALIDATE",
        userId: userId,
        details: {
          totalRows: batch.stagingRows.length,
          validRows: validRowCount,
          errorCount,
          warningCount,
        },
      },
    });

    res.json({
      status: errorCount === 0 ? "READY" : "VALIDATING",
      totalRows: batch.stagingRows.length,
      validRows: validRowCount,
      errorCount,
      warningCount,
      issues: issues.slice(0, 100),
    });
  } catch (error) {
    console.error("Error validating import batch:", error);
    res.status(500).json({ error: "Failed to validate import batch" });
  }
});

function validateRow(
  recordType: ImportRecordTypeEnum,
  data: Record<string, any>,
  rowNo: number,
  validCodes: Set<string>,
  engagement: { periodStart: Date | null; periodEnd: Date | null } | null
): { field: string; severity: "ERROR" | "WARN" | "INFO"; code: string; message: string }[] {
  const issues: { field: string; severity: "ERROR" | "WARN" | "INFO"; code: string; message: string }[] = [];

  switch (recordType) {
    case "GL_LINE":
      if (!data.code) {
        issues.push({ field: "code", severity: "ERROR", code: "REQUIRED", message: "Account code is required" });
      } else if (!/^\d{5}$/.test(data.code)) {
        issues.push({ field: "code", severity: "ERROR", code: "INVALID_FORMAT", message: "Account code must be 5 digits" });
      } else if (validCodes.size > 0 && !validCodes.has(data.code)) {
        issues.push({ field: "code", severity: "WARN", code: "NOT_IN_COA", message: `Account code ${data.code} not found in Chart of Accounts` });
      }

      if (!data.voucherNo) {
        issues.push({ field: "voucherNo", severity: "ERROR", code: "REQUIRED", message: "Voucher number is required" });
      }

      if (!data.date) {
        issues.push({ field: "date", severity: "ERROR", code: "REQUIRED", message: "Date is required" });
      } else if (engagement?.periodStart && engagement?.periodEnd) {
        const txDate = new Date(data.date);
        if (txDate < engagement.periodStart || txDate > engagement.periodEnd) {
          issues.push({ field: "date", severity: "WARN", code: "OUT_OF_PERIOD", message: "Transaction date is outside engagement period" });
        }
      }

      if (data.debit === 0 && data.credit === 0) {
        issues.push({ field: "debit", severity: "ERROR", code: "ZERO_AMOUNT", message: "Either Debit or Credit must have a value" });
      }

      if (data.debit > 0 && data.credit > 0) {
        issues.push({ field: "debit", severity: "ERROR", code: "BOTH_SIDES", message: "Cannot have both Debit and Credit on same line" });
      }
      break;

    case "OB_ACCOUNT":
    case "CB_ACCOUNT":
      if (!data.code) {
        issues.push({ field: "code", severity: "ERROR", code: "REQUIRED", message: "Account code is required" });
      } else if (!/^\d{5}$/.test(data.code)) {
        issues.push({ field: "code", severity: "ERROR", code: "INVALID_FORMAT", message: "Account code must be 5 digits" });
      }

      if (!data.accountName) {
        issues.push({ field: "accountName", severity: "ERROR", code: "REQUIRED", message: "Account name is required" });
      }

      const debitField = recordType === "OB_ACCOUNT" ? "openingDebit" : "closingDebit";
      const creditField = recordType === "OB_ACCOUNT" ? "openingCredit" : "closingCredit";

      if (data[debitField] > 0 && data[creditField] > 0) {
        issues.push({ field: debitField, severity: "ERROR", code: "BOTH_SIDES", message: "Cannot have both Debit and Credit balance" });
      }
      break;

    case "OB_PARTY":
    case "CB_PARTY":
      if (!data.partyType || !["DEBTOR", "CREDITOR", "CUSTOMER", "VENDOR"].includes(data.partyType)) {
        issues.push({ field: "partyType", severity: "ERROR", code: "INVALID_VALUE", message: "Party type must be DEBTOR, CREDITOR, CUSTOMER, or VENDOR" });
      }

      if (!data.partyCode) {
        issues.push({ field: "partyCode", severity: "ERROR", code: "REQUIRED", message: "Party code is required" });
      }

      if (!data.partyName) {
        issues.push({ field: "partyName", severity: "ERROR", code: "REQUIRED", message: "Party name is required" });
      }

      if (recordType === "CB_PARTY" && data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
        issues.push({ field: "email", severity: "WARN", code: "INVALID_EMAIL", message: "Invalid email format" });
      }
      break;

    case "BANK_MASTER":
      if (!data.bankAccountCode) {
        issues.push({ field: "bankAccountCode", severity: "ERROR", code: "REQUIRED", message: "Bank code is required" });
      }

      if (!data.bankName) {
        issues.push({ field: "bankName", severity: "ERROR", code: "REQUIRED", message: "Bank name is required" });
      }

      if (!data.accountNo) {
        issues.push({ field: "accountNo", severity: "ERROR", code: "REQUIRED", message: "Account number is required" });
      }
      break;

    case "CB_BANK":
      if (!data.bankAccountCode) {
        issues.push({ field: "bankAccountCode", severity: "ERROR", code: "REQUIRED", message: "Bank code is required" });
      }

      if (!data.statementDate) {
        issues.push({ field: "statementDate", severity: "ERROR", code: "REQUIRED", message: "Statement date is required" });
      }

      if (data.bookBalance !== data.statementBalance && !data.reconciled) {
        issues.push({ field: "statementBalance", severity: "INFO", code: "UNRECONCILED", message: `Book balance (${data.bookBalance}) differs from statement balance (${data.statementBalance})` });
      }
      break;
  }

  return issues;
}

router.post("/:engagementId/batches/:batchId/submit", async (req: Request, res: Response) => {
  try {
    const { engagementId, batchId } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const batch = await prisma.importBatch.findFirst({
      where: { id: batchId, engagementId },
    });

    if (!batch) {
      return res.status(404).json({ error: "Batch not found" });
    }

    if (batch.status !== "READY") {
      return res.status(400).json({ error: `Cannot submit batch in ${batch.status} status. Must be in READY status.` });
    }

    await prisma.importBatch.update({
      where: { id: batchId },
      data: {
        status: "SUBMITTED",
        submittedAt: new Date(),
        submittedById: userId,
      },
    });

    await prisma.importAuditLog.create({
      data: {
        batchId,
        action: "SUBMIT",
        userId: userId,
        details: { submittedAt: new Date().toISOString() },
      },
    });

    res.json({ status: "SUBMITTED", message: "Batch submitted for approval" });
  } catch (error) {
    console.error("Error submitting import batch:", error);
    res.status(500).json({ error: "Failed to submit import batch" });
  }
});

router.post("/:engagementId/batches/:batchId/approve", async (req: Request, res: Response) => {
  try {
    const { engagementId, batchId } = req.params;
    const { comments } = req.body;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const batch = await prisma.importBatch.findFirst({
      where: { id: batchId, engagementId },
    });

    if (!batch) {
      return res.status(404).json({ error: "Batch not found" });
    }

    if (batch.status !== "SUBMITTED") {
      return res.status(400).json({ error: `Cannot approve batch in ${batch.status} status. Must be in SUBMITTED status.` });
    }

    await prisma.importBatch.update({
      where: { id: batchId },
      data: {
        status: "APPROVED",
        approvedAt: new Date(),
        approvedById: userId,
        approverComments: comments,
      },
    });

    await prisma.importAuditLog.create({
      data: {
        batchId,
        action: "APPROVE",
        userId: userId,
        details: { approvedAt: new Date().toISOString(), comments },
      },
    });

    res.json({ status: "APPROVED", message: "Batch approved" });
  } catch (error) {
    console.error("Error approving import batch:", error);
    res.status(500).json({ error: "Failed to approve import batch" });
  }
});

router.post("/:engagementId/batches/:batchId/reject", async (req: Request, res: Response) => {
  try {
    const { engagementId, batchId } = req.params;
    const { comments } = req.body;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const batch = await prisma.importBatch.findFirst({
      where: { id: batchId, engagementId },
    });

    if (!batch) {
      return res.status(404).json({ error: "Batch not found" });
    }

    if (batch.status !== "SUBMITTED") {
      return res.status(400).json({ error: `Cannot reject batch in ${batch.status} status. Must be in SUBMITTED status.` });
    }

    await prisma.importBatch.update({
      where: { id: batchId },
      data: {
        status: "VALIDATING",
        approverComments: comments,
      },
    });

    await prisma.importAuditLog.create({
      data: {
        batchId,
        action: "REJECT",
        userId: userId,
        details: { rejectedAt: new Date().toISOString(), comments },
      },
    });

    res.json({ status: "VALIDATING", message: "Batch rejected and returned for corrections" });
  } catch (error) {
    console.error("Error rejecting import batch:", error);
    res.status(500).json({ error: "Failed to reject import batch" });
  }
});

router.post("/:engagementId/batches/:batchId/post", async (req: Request, res: Response) => {
  try {
    const { engagementId, batchId } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const batch = await prisma.importBatch.findFirst({
      where: { id: batchId, engagementId },
      include: { stagingRows: true },
    });

    if (!batch) {
      return res.status(404).json({ error: "Batch not found" });
    }

    if (batch.status !== "APPROVED") {
      return res.status(400).json({ error: `Cannot post batch in ${batch.status} status. Must be in APPROVED status.` });
    }

    const glRows = batch.stagingRows.filter(r => r.recordType === 'GL_LINE' && !r.hasError);
    const obAccountRows = batch.stagingRows.filter(r => r.recordType === 'OB_ACCOUNT' && !r.hasError);
    const cbAccountRows = batch.stagingRows.filter(r => r.recordType === 'CB_ACCOUNT' && !r.hasError);
    const obPartyRows = batch.stagingRows.filter(r => r.recordType === 'OB_PARTY' && !r.hasError);
    const cbPartyRows = batch.stagingRows.filter(r => r.recordType === 'CB_PARTY' && !r.hasError);
    const bankMasterRows = batch.stagingRows.filter(r => r.recordType === 'BANK_MASTER' && !r.hasError);
    const cbBankRows = batch.stagingRows.filter(r => r.recordType === 'CB_BANK' && !r.hasError);

    const postedCounts = {
      glLines: 0,
      obAccounts: 0,
      cbAccounts: 0,
      obParties: 0,
      cbParties: 0,
      bankMasters: 0,
      cbBanks: 0,
    };

    if (glRows.length > 0) {
      const voucherMap = new Map<string, any[]>();
      for (const row of glRows) {
        const payload = row.payload as { raw?: any; parsed?: any };
        const data = payload.parsed || payload.raw || {};
        const key = data.voucherNo;
        if (!voucherMap.has(key)) {
          voucherMap.set(key, []);
        }
        voucherMap.get(key)!.push({ ...data, rowNo: row.rowNo });
      }

      for (const [voucherNo, lines] of voucherMap) {
        const firstLine = lines[0];
        const journalId = `${engagementId}-${voucherNo}`;
        
        const totalDebit = lines.reduce((sum: number, l: any) => sum + (l.debit || 0), 0);
        const totalCredit = lines.reduce((sum: number, l: any) => sum + (l.credit || 0), 0);

        const header = await prisma.importJournalHeader.upsert({
          where: { engagementId_journalId: { engagementId, journalId } },
          create: {
            batchId: batch.id,
            engagementId,
            journalId,
            voucherNo,
            voucherType: firstLine.docType || 'JV',
            voucherDate: new Date(firstLine.date),
            periodKey: new Date(firstLine.date).toISOString().substring(0, 7),
            sourceModule: 'IMPORT',
            narration: firstLine.narrative,
            totalDebit,
            totalCredit,
            isBalanced: Math.abs(totalDebit - totalCredit) < 0.01,
            lineCount: lines.length,
          },
          update: {
            voucherType: firstLine.docType || 'JV',
            voucherDate: new Date(firstLine.date),
            narration: firstLine.narrative,
            totalDebit,
            totalCredit,
            isBalanced: Math.abs(totalDebit - totalCredit) < 0.01,
            lineCount: lines.length,
          },
        });

        await prisma.importJournalLine.deleteMany({
          where: { journalHeaderId: header.id },
        });

        await prisma.importJournalLine.createMany({
          data: lines.map((l: any, idx: number) => ({
            journalHeaderId: header.id,
            lineNo: idx + 1,
            accountCode: l.code,
            accountName: l.accountName,
            debit: l.debit || 0,
            credit: l.credit || 0,
            documentNo: l.refNumber,
            narration: l.narrative,
            currency: l.currency || 'PKR',
          })),
        });

        postedCounts.glLines += lines.length;
      }
    }

    for (const row of obAccountRows) {
      const payload = row.payload as { raw?: any; parsed?: any };
      const data = payload.parsed || payload.raw || {};
      const debitAmount = data.openingDebit || 0;
      const creditAmount = data.openingCredit || 0;
      
      await prisma.importAccountBalance.upsert({
        where: { engagementId_accountCode_balanceType: { engagementId, accountCode: data.code, balanceType: 'OB' } },
        create: {
          batchId: batch.id,
          engagementId,
          accountCode: data.code,
          accountName: data.accountName,
          balanceType: 'OB',
          asOfDate: new Date(),
          debitAmount,
          creditAmount,
        },
        update: {
          accountName: data.accountName,
          debitAmount,
          creditAmount,
        },
      });
      postedCounts.obAccounts++;
    }

    for (const row of cbAccountRows) {
      const payload = row.payload as { raw?: any; parsed?: any };
      const data = payload.parsed || payload.raw || {};
      const debitAmount = data.closingDebit || 0;
      const creditAmount = data.closingCredit || 0;
      
      await prisma.importAccountBalance.upsert({
        where: { engagementId_accountCode_balanceType: { engagementId, accountCode: data.code, balanceType: 'CB' } },
        create: {
          batchId: batch.id,
          engagementId,
          accountCode: data.code,
          accountName: data.accountName,
          balanceType: 'CB',
          asOfDate: new Date(),
          debitAmount,
          creditAmount,
        },
        update: {
          accountName: data.accountName,
          debitAmount,
          creditAmount,
        },
      });
      postedCounts.cbAccounts++;
    }

    for (const row of obPartyRows) {
      const payload = row.payload as { raw?: any; parsed?: any };
      const data = payload.parsed || payload.raw || {};
      const balance = (data.openingDebit || 0) - (data.openingCredit || 0);
      const drcr = balance >= 0 ? 'DR' : 'CR';
      
      await prisma.importPartyBalance.upsert({
        where: { engagementId_partyCode_balanceType: { engagementId, partyCode: data.partyCode, balanceType: 'OB' } },
        create: {
          batchId: batch.id,
          engagementId,
          partyCode: data.partyCode,
          partyName: data.partyName,
          partyType: mapPartyType(data.partyType),
          controlAccountCode: data.controlAccountCode,
          balanceType: 'OB',
          asOfDate: new Date(),
          balance: Math.abs(balance),
          drcr,
        },
        update: {
          partyName: data.partyName,
          partyType: mapPartyType(data.partyType),
          controlAccountCode: data.controlAccountCode,
          balance: Math.abs(balance),
          drcr,
        },
      });
      postedCounts.obParties++;
    }

    for (const row of cbPartyRows) {
      const payload = row.payload as { raw?: any; parsed?: any };
      const data = payload.parsed || payload.raw || {};
      const balance = (data.closingDebit || 0) - (data.closingCredit || 0);
      const drcr = balance >= 0 ? 'DR' : 'CR';
      
      await prisma.importPartyBalance.upsert({
        where: { engagementId_partyCode_balanceType: { engagementId, partyCode: data.partyCode, balanceType: 'CB' } },
        create: {
          batchId: batch.id,
          engagementId,
          partyCode: data.partyCode,
          partyName: data.partyName,
          partyType: mapPartyType(data.partyType),
          controlAccountCode: data.controlAccountCode,
          balanceType: 'CB',
          asOfDate: new Date(),
          balance: Math.abs(balance),
          drcr,
          partyEmail: data.email,
        },
        update: {
          partyName: data.partyName,
          partyType: mapPartyType(data.partyType),
          controlAccountCode: data.controlAccountCode,
          balance: Math.abs(balance),
          drcr,
          partyEmail: data.email,
        },
      });
      postedCounts.cbParties++;
    }

    for (const row of bankMasterRows) {
      const payload = row.payload as { raw?: any; parsed?: any };
      const data = payload.parsed || payload.raw || {};
      
      await prisma.importBankAccount.upsert({
        where: { engagementId_bankAccountCode: { engagementId, bankAccountCode: data.bankAccountCode } },
        create: {
          batchId: batch.id,
          engagementId,
          bankAccountCode: data.bankAccountCode,
          bankName: data.bankName,
          accountNo: data.accountNo,
          accountTitle: data.accountTitle || data.bankName,
          branchName: data.branchName,
          currency: data.currency || 'PKR',
        },
        update: {
          bankName: data.bankName,
          accountNo: data.accountNo,
          accountTitle: data.accountTitle || data.bankName,
          branchName: data.branchName,
          currency: data.currency || 'PKR',
        },
      });
      postedCounts.bankMasters++;
    }

    for (const row of cbBankRows) {
      const payload = row.payload as { raw?: any; parsed?: any };
      const data = payload.parsed || payload.raw || {};
      const asOfDate = new Date(data.statementDate);
      const closingBalance = data.statementBalance || data.bookBalance || 0;
      const drcr = closingBalance >= 0 ? 'DR' : 'CR';

      const bankAccount = await prisma.importBankAccount.findUnique({
        where: { engagementId_bankAccountCode: { engagementId, bankAccountCode: data.bankAccountCode } },
      });
      
      if (bankAccount) {
        await prisma.importBankBalance.upsert({
          where: { engagementId_bankAccountCode_asOfDate: { engagementId, bankAccountCode: data.bankAccountCode, asOfDate } },
          create: {
            batchId: batch.id,
            engagementId,
            bankAccountCode: data.bankAccountCode,
            glBankAccountCode: data.bankAccountCode,
            closingBalance: Math.abs(closingBalance),
            drcr,
            asOfDate,
          },
          update: {
            closingBalance: Math.abs(closingBalance),
            drcr,
          },
        });
        postedCounts.cbBanks++;
      }
    }

    await prisma.importBatch.update({
      where: { id: batchId },
      data: {
        status: "POSTED",
        postedAt: new Date(),
        postedById: userId,
        processedRows: batch.stagingRows.filter(r => !r.hasError).length,
      },
    });

    await prisma.importAuditLog.create({
      data: {
        batchId,
        action: "POST",
        userId: userId,
        details: { 
          postedAt: new Date().toISOString(),
          postedCounts,
        },
      },
    });

    res.json({ 
      status: "POSTED", 
      message: "Batch posted successfully",
      postedCounts,
    });
  } catch (error) {
    console.error("Error posting import batch:", error);
    res.status(500).json({ error: "Failed to post import batch" });
  }
});

function mapPartyType(partyType: string): string {
  const type = (partyType || '').toUpperCase();
  if (['DEBTOR', 'CUSTOMER', 'AR'].includes(type)) return 'CUSTOMER';
  if (['CREDITOR', 'VENDOR', 'SUPPLIER', 'AP'].includes(type)) return 'VENDOR';
  return type || 'OTHER';
}

router.post("/:engagementId/batches/:batchId/lock", async (req: Request, res: Response) => {
  try {
    const { engagementId, batchId } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const batch = await prisma.importBatch.findFirst({
      where: { id: batchId, engagementId },
    });

    if (!batch) {
      return res.status(404).json({ error: "Batch not found" });
    }

    if (batch.status !== "POSTED") {
      return res.status(400).json({ error: `Cannot lock batch in ${batch.status} status. Must be in POSTED status.` });
    }

    await prisma.importBatch.update({
      where: { id: batchId },
      data: { 
        status: "LOCKED",
        lockedAt: new Date(),
      },
    });

    await prisma.importAuditLog.create({
      data: {
        batchId,
        action: "LOCK",
        userId: userId,
        details: { lockedAt: new Date().toISOString() },
      },
    });

    res.json({ status: "LOCKED", message: "Batch locked" });
  } catch (error) {
    console.error("Error locking import batch:", error);
    res.status(500).json({ error: "Failed to lock import batch" });
  }
});

router.delete("/:engagementId/batches/:batchId", async (req: Request, res: Response) => {
  try {
    const { engagementId, batchId } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const batch = await prisma.importBatch.findFirst({
      where: { id: batchId, engagementId },
    });

    if (!batch) {
      return res.status(404).json({ error: "Batch not found" });
    }

    if (["POSTED", "LOCKED"].includes(batch.status)) {
      return res.status(400).json({ error: `Cannot delete batch in ${batch.status} status` });
    }

    await prisma.importAuditLog.deleteMany({ where: { batchId } });
    await prisma.importIssue.deleteMany({ where: { batchId } });
    await prisma.importStagingRow.deleteMany({ where: { batchId } });
    await prisma.importBatch.delete({ where: { id: batchId } });

    res.json({ message: "Batch deleted successfully" });
  } catch (error) {
    console.error("Error deleting import batch:", error);
    res.status(500).json({ error: "Failed to delete import batch" });
  }
});

router.get("/:engagementId/batches/:batchId/audit-log", async (req: Request, res: Response) => {
  try {
    const { engagementId, batchId } = req.params;

    const batch = await prisma.importBatch.findFirst({
      where: { id: batchId, engagementId },
    });

    if (!batch) {
      return res.status(404).json({ error: "Batch not found" });
    }

    const logs = await prisma.importAuditLog.findMany({
      where: { batchId },
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, fullName: true, username: true } },
      },
    });

    res.json(logs);
  } catch (error) {
    console.error("Error fetching import audit log:", error);
    res.status(500).json({ error: "Failed to fetch import audit log" });
  }
});

router.post("/:engagementId/batches/:batchId/issues/:issueId/resolve", async (req: Request, res: Response) => {
  try {
    const { engagementId, batchId, issueId } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const issue = await prisma.importIssue.findFirst({
      where: { id: issueId, batchId },
      include: { batch: true },
    });

    if (!issue) {
      return res.status(404).json({ error: "Issue not found" });
    }

    if (issue.batch.engagementId !== engagementId) {
      return res.status(404).json({ error: "Issue not found" });
    }

    await prisma.importIssue.delete({
      where: { id: issueId },
    });

    res.json({ message: "Issue resolved" });
  } catch (error) {
    console.error("Error resolving import issue:", error);
    res.status(500).json({ error: "Failed to resolve import issue" });
  }
});

router.get("/:engagementId/batches/:batchId/confirmation-candidates", async (req: Request, res: Response) => {
  try {
    const { engagementId, batchId } = req.params;

    const batch = await prisma.importBatch.findFirst({
      where: { id: batchId, engagementId },
      include: {
        stagingRows: {
          where: {
            recordType: { in: ['CB_PARTY', 'BANK_MASTER'] },
            hasError: false,
          },
        },
      },
    });

    if (!batch) {
      return res.status(404).json({ error: "Batch not found" });
    }

    const partyConfirmations = batch.stagingRows
      .filter((row: ImportStagingRow) => row.recordType === 'CB_PARTY')
      .map((row: ImportStagingRow) => {
        const payload = row.payload as { raw?: any; parsed?: any };
        const data = payload.parsed || payload.raw || {};
        return {
          id: row.id,
          type: mapPartyTypeToConfirmationType(data.partyType),
          partyCode: data.partyCode,
          partyName: data.partyName,
          partyType: data.partyType,
          email: data.email,
          phone: data.phone,
          controlAccountCode: data.controlAccountCode,
          closingDebit: data.closingDebit || 0,
          closingCredit: data.closingCredit || 0,
          balance: (data.closingDebit || 0) - (data.closingCredit || 0),
          hasContactInfo: !!(data.email || data.phone),
        };
      });

    const bankConfirmations = batch.stagingRows
      .filter((row: ImportStagingRow) => row.recordType === 'BANK_MASTER')
      .map((row: ImportStagingRow) => {
        const payload = row.payload as { raw?: any; parsed?: any };
        const data = payload.parsed || payload.raw || {};
        return {
          id: row.id,
          type: 'BANK_BALANCE',
          bankAccountCode: data.bankAccountCode,
          bankName: data.bankName,
          branchName: data.branchName,
          accountNo: data.accountNo,
          accountTitle: data.accountTitle,
          currency: data.currency,
          hasContactInfo: false,
        };
      });

    const summary = {
      arConfirmations: partyConfirmations.filter((p: any) => p.type === 'ACCOUNTS_RECEIVABLE').length,
      apConfirmations: partyConfirmations.filter((p: any) => p.type === 'ACCOUNTS_PAYABLE').length,
      bankConfirmations: bankConfirmations.length,
      totalConfirmations: partyConfirmations.length + bankConfirmations.length,
      withContactInfo: partyConfirmations.filter((p: any) => p.hasContactInfo).length,
      missingContactInfo: partyConfirmations.filter((p: any) => !p.hasContactInfo).length,
    };

    res.json({
      partyConfirmations,
      bankConfirmations,
      summary,
    });
  } catch (error) {
    console.error("Error fetching confirmation candidates:", error);
    res.status(500).json({ error: "Failed to fetch confirmation candidates" });
  }
});

function mapPartyTypeToConfirmationType(partyType: string): string {
  switch (partyType?.toUpperCase()) {
    case 'CUSTOMER':
    case 'DEBTOR':
    case 'AR':
      return 'ACCOUNTS_RECEIVABLE';
    case 'VENDOR':
    case 'SUPPLIER':
    case 'CREDITOR':
    case 'AP':
      return 'ACCOUNTS_PAYABLE';
    default:
      return 'OTHER';
  }
}

router.get("/:engagementId/data/tb", async (req: Request, res: Response) => {
  try {
    const { engagementId } = req.params;
    const { page = "1", pageSize = "20", search = "" } = req.query;
    const pageNum = parseInt(page as string, 10);
    const pageSizeNum = parseInt(pageSize as string, 10);

    const where: any = { engagementId };
    if (search) {
      where.OR = [
        { accountCode: { contains: search as string, mode: "insensitive" } },
        { accountName: { contains: search as string, mode: "insensitive" } },
      ];
    }

    const allRecords = await prisma.importAccountBalance.findMany({
      where,
      orderBy: { accountCode: "asc" },
    });

    const mergedMap = new Map<string, any>();
    for (const d of allRecords) {
      const key = d.accountCode;
      if (!mergedMap.has(key)) {
        mergedMap.set(key, {
          id: d.id,
          engagementId: d.engagementId,
          batchId: d.batchId,
          glCode: d.accountCode,
          glName: d.accountName,
          accountClass: (d as any).accountClass || null,
          accountSubclass: (d as any).accountSubclass || null,
          fsHeadKey: (d as any).fsHeadKey || null,
          openingDebit: 0,
          openingCredit: 0,
          debit: 0,
          credit: 0,
          closingDebit: 0,
          closingCredit: 0,
        });
      }
      const row = mergedMap.get(key)!;
      if (d.balanceType === 'OB') {
        row.openingDebit = Number(d.debitAmount) || 0;
        row.openingCredit = Number(d.creditAmount) || 0;
      } else if (d.balanceType === 'CB') {
        row.id = d.id;
        row.closingDebit = Number(d.debitAmount) || 0;
        row.closingCredit = Number(d.creditAmount) || 0;
        if ((d as any).accountClass) row.accountClass = (d as any).accountClass;
        if ((d as any).accountSubclass) row.accountSubclass = (d as any).accountSubclass;
        if ((d as any).fsHeadKey) row.fsHeadKey = (d as any).fsHeadKey;
      }
    }

    for (const row of mergedMap.values()) {
      const openingNet = row.openingDebit - row.openingCredit;
      const closingNet = row.closingDebit - row.closingCredit;
      const movement = closingNet - openingNet;
      row.debit = movement > 0 ? movement : 0;
      row.credit = movement < 0 ? Math.abs(movement) : 0;
    }

    const mergedRows = Array.from(mergedMap.values()).sort((a, b) =>
      (a.glCode || '').localeCompare(b.glCode || '')
    );
    const totalCount = mergedRows.length;
    const totalPages = Math.ceil(totalCount / pageSizeNum);
    const skip = (pageNum - 1) * pageSizeNum;
    const pagedRows = mergedRows.slice(skip, skip + pageSizeNum);

    res.json({
      data: pagedRows,
      meta: {
        page: pageNum,
        pageSize: pageSizeNum,
        totalCount,
        totalPages,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
      },
    });
  } catch (error) {
    console.error("Error fetching TB data:", error);
    res.status(500).json({ error: "Failed to fetch trial balance data" });
  }
});

router.get("/:engagementId/data/tb/summary", async (req: Request, res: Response) => {
  try {
    const { engagementId } = req.params;
    const allRecords = await prisma.importAccountBalance.findMany({
      where: { engagementId },
    });

    const mergedMap = new Map<string, any>();
    for (const d of allRecords) {
      const key = d.accountCode;
      if (!mergedMap.has(key)) {
        mergedMap.set(key, { openingDebit: 0, openingCredit: 0, closingDebit: 0, closingCredit: 0 });
      }
      const row = mergedMap.get(key)!;
      if (d.balanceType === 'OB') {
        row.openingDebit = Number(d.debitAmount) || 0;
        row.openingCredit = Number(d.creditAmount) || 0;
      } else if (d.balanceType === 'CB') {
        row.closingDebit = Number(d.debitAmount) || 0;
        row.closingCredit = Number(d.creditAmount) || 0;
      }
    }

    let totalOpeningDebit = 0, totalOpeningCredit = 0;
    let totalMovementDebit = 0, totalMovementCredit = 0;
    let totalClosingDebit = 0, totalClosingCredit = 0;

    for (const row of mergedMap.values()) {
      totalOpeningDebit += row.openingDebit;
      totalOpeningCredit += row.openingCredit;
      totalClosingDebit += row.closingDebit;
      totalClosingCredit += row.closingCredit;
      const openingNet = row.openingDebit - row.openingCredit;
      const closingNet = row.closingDebit - row.closingCredit;
      const movement = closingNet - openingNet;
      totalMovementDebit += movement > 0 ? movement : 0;
      totalMovementCredit += movement < 0 ? Math.abs(movement) : 0;
    }

    res.json({
      accountCount: mergedMap.size,
      totalOpeningDebit,
      totalOpeningCredit,
      totalDebit: totalMovementDebit,
      totalCredit: totalMovementCredit,
      totalMovementDebit,
      totalMovementCredit,
      totalClosingDebit,
      totalClosingCredit,
    });
  } catch (error) {
    console.error("Error fetching TB summary:", error);
    res.status(500).json({ error: "Failed to fetch trial balance summary" });
  }
});

router.post("/:engagementId/data/tb", async (req: Request, res: Response) => {
  try {
    const { engagementId } = req.params;
    const data = req.body;

    const latestBatch = await prisma.importBatch.findFirst({
      where: { engagementId },
      orderBy: { createdAt: 'desc' },
    });

    if (!latestBatch) {
      return res.status(400).json({ error: "No import batch found for this engagement" });
    }

    const debitAmount = parseFloat(data.openingDebit || data.closingDebit) || 0;
    const creditAmount = parseFloat(data.openingCredit || data.closingCredit) || 0;
    const balanceType = data.openingDebit !== undefined || data.openingCredit !== undefined ? 'OB' : 'CB';

    const resolvedAccountCode = data.glCode || data.accountCode;
    const resolvedAccountName = data.glName || data.accountName || "";

    let classificationData = {
      accountClass: data.accountClass as string | undefined,
      accountSubclass: data.accountSubclass as string | undefined,
      fsHeadKey: data.fsHeadKey as string | undefined,
      source: 'MANUAL' as string,
      confidence: 100 as number,
    };
    
    if (!data.accountClass || !data.accountSubclass || !data.fsHeadKey) {
      const autoClassification = classifyAccount(resolvedAccountCode, resolvedAccountName) 
        || getDefaultClassificationForCode(resolvedAccountCode);
      classificationData = {
        accountClass: data.accountClass || autoClassification.accountClass,
        accountSubclass: data.accountSubclass || autoClassification.accountSubclass,
        fsHeadKey: data.fsHeadKey || autoClassification.fsHeadKey,
        source: autoClassification.source,
        confidence: autoClassification.confidence,
      };
    }

    const record = await prisma.importAccountBalance.create({
      data: {
        batchId: latestBatch.id,
        engagementId,
        accountCode: resolvedAccountCode,
        accountName: resolvedAccountName,
        balanceType,
        asOfDate: new Date(),
        debitAmount,
        creditAmount,
      },
    });
    
    // Update classification fields separately using raw SQL (Prisma client may not have latest schema)
    await prisma.$executeRaw`
      UPDATE "ImportAccountBalance" 
      SET "accountClass" = ${classificationData.accountClass},
          "accountSubclass" = ${classificationData.accountSubclass},
          "fsHeadKey" = ${classificationData.fsHeadKey},
          "classificationSource" = ${classificationData.source},
          "classificationConfidence" = ${classificationData.confidence}
      WHERE id = ${record.id}
    `;

    autoClassifyAndSync(engagementId).catch(() => {});

    res.status(201).json(record);
  } catch (error) {
    console.error("Error creating TB record:", error);
    res.status(500).json({ error: "Failed to create trial balance record" });
  }
});

router.patch("/:engagementId/data/tb/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId, id } = req.params;
    const data = req.body;
    const userId = req.user?.id;

    const primaryRecord = await prisma.importAccountBalance.findUnique({ where: { id } });
    if (!primaryRecord) {
      return res.status(404).json({ error: "Record not found" });
    }

    const siblingRecords = await prisma.importAccountBalance.findMany({
      where: {
        engagementId,
        accountCode: primaryRecord.accountCode,
        id: { not: id },
      },
    });
    const obRecord = primaryRecord.balanceType === 'OB' ? primaryRecord : siblingRecords.find(r => r.balanceType === 'OB');
    const cbRecord = primaryRecord.balanceType === 'CB' ? primaryRecord : siblingRecords.find(r => r.balanceType === 'CB');

    const sharedUpdate: any = {};
    if (data.glCode !== undefined || data.accountCode !== undefined) sharedUpdate.accountCode = data.glCode || data.accountCode;
    if (data.glName !== undefined || data.accountName !== undefined) sharedUpdate.accountName = data.glName || data.accountName;
    if (data.accountClass !== undefined) {
      sharedUpdate.accountClass = data.accountClass;
      sharedUpdate.classificationSource = 'MANUAL';
      sharedUpdate.classificationConfidence = 100;
    }
    if (data.accountSubclass !== undefined) {
      sharedUpdate.accountSubclass = data.accountSubclass;
      sharedUpdate.classificationSource = 'MANUAL';
      sharedUpdate.classificationConfidence = 100;
    }
    if (data.fsHeadKey !== undefined) {
      sharedUpdate.fsHeadKey = data.fsHeadKey;
      sharedUpdate.classificationSource = 'MANUAL';
      sharedUpdate.classificationConfidence = 100;
    }

    const obUpdate: any = { ...sharedUpdate };
    if (data.openingDebit !== undefined) obUpdate.debitAmount = parseFloat(data.openingDebit) || 0;
    if (data.openingCredit !== undefined) obUpdate.creditAmount = parseFloat(data.openingCredit) || 0;

    const cbUpdate: any = { ...sharedUpdate };
    if (data.closingDebit !== undefined) cbUpdate.debitAmount = parseFloat(data.closingDebit) || 0;
    if (data.closingCredit !== undefined) cbUpdate.creditAmount = parseFloat(data.closingCredit) || 0;

    const updates: Promise<any>[] = [];
    if (obRecord && Object.keys(obUpdate).length > 0) {
      updates.push(prisma.importAccountBalance.update({ where: { id: obRecord.id }, data: obUpdate }));
    }
    if (cbRecord && Object.keys(cbUpdate).length > 0) {
      updates.push(prisma.importAccountBalance.update({ where: { id: cbRecord.id }, data: cbUpdate }));
    }
    if (updates.length === 0 && Object.keys(sharedUpdate).length > 0) {
      updates.push(prisma.importAccountBalance.update({ where: { id }, data: sharedUpdate }));
    }

    const results = await Promise.all(updates);

    await prisma.dataEdit.create({
      data: {
        engagementId,
        batchId: primaryRecord.batchId,
        dataset: 'TB',
        operation: 'UPDATE',
        rowId: id,
        field: null,
        oldValue: JSON.stringify(primaryRecord),
        newValue: JSON.stringify(results[0] || primaryRecord),
        fullRowJson: results[0] || primaryRecord,
        editedById: userId!,
        notes: obRecord && cbRecord ? 'Dual OB/CB update' : null,
      }
    });

    autoClassifyAndSync(engagementId, userId).catch(() => {});

    res.json(results[0] || primaryRecord);
  } catch (error) {
    console.error("Error updating TB record:", error);
    res.status(500).json({ error: "Failed to update trial balance record" });
  }
});

router.delete("/:engagementId/data/tb/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId, id } = req.params;
    const userId = req.user?.id;

    const oldRecord = await prisma.importAccountBalance.findUnique({ where: { id } });
    if (!oldRecord) {
      return res.status(404).json({ error: "Record not found" });
    }

    await prisma.importAccountBalance.delete({ where: { id } });

    await prisma.dataEdit.create({
      data: {
        engagementId,
        batchId: oldRecord.batchId,
        dataset: 'TB',
        operation: 'DELETE',
        rowId: id,
        field: null,
        oldValue: JSON.stringify(oldRecord),
        newValue: null,
        fullRowJson: oldRecord,
        editedById: userId!,
        notes: null,
      }
    });

    autoClassifyAndSync(engagementId, userId).catch(() => {});

    res.json({ message: "Record deleted" });
  } catch (error) {
    console.error("Error deleting TB record:", error);
    res.status(500).json({ error: "Failed to delete trial balance record" });
  }
});

// Auto-classify all TB records using rule-based classification
router.post("/:engagementId/data/tb/auto-classify", async (req: Request, res: Response) => {
  try {
    const { engagementId } = req.params;
    const { overwriteManual = false } = req.body;

    // Get all TB records for this engagement
    const records = await prisma.importAccountBalance.findMany({
      where: { engagementId },
    });

    let classifiedCount = 0;
    let skippedCount = 0;

    const updates: Array<{ id: string; accountClass: string; accountSubclass: string; fsHeadKey: string; source: string; confidence: number }> = [];
    for (const record of records) {
      const rec = record as any;
      if (!overwriteManual && rec.classificationSource === 'MANUAL') {
        skippedCount++;
        continue;
      }

      const classification = classifyAccount(record.accountCode, record.accountName || '') 
        || getDefaultClassificationForCode(record.accountCode);

      updates.push({
        id: record.id,
        accountClass: classification.accountClass,
        accountSubclass: classification.accountSubclass,
        fsHeadKey: classification.fsHeadKey,
        source: classification.source,
        confidence: classification.confidence,
      });
      classifiedCount++;
    }

    if (updates.length > 0) {
      const BATCH_SIZE = 50;
      for (let i = 0; i < updates.length; i += BATCH_SIZE) {
        const batch = updates.slice(i, i + BATCH_SIZE);
        await prisma.$transaction(
          batch.map(u => prisma.$executeRaw`
            UPDATE "ImportAccountBalance" 
            SET "accountClass" = ${u.accountClass},
                "accountSubclass" = ${u.accountSubclass},
                "fsHeadKey" = ${u.fsHeadKey},
                "classificationSource" = ${u.source},
                "classificationConfidence" = ${u.confidence}
            WHERE id = ${u.id}
          `)
        );
      }
    }

    const syncResult = await syncTbToFsMapping(engagementId);

    res.json({ 
      message: `Successfully classified ${classifiedCount} accounts`,
      classifiedCount,
      skippedCount,
      totalCount: records.length,
      syncCompleted: syncResult.success,
    });
  } catch (error) {
    console.error("Error auto-classifying TB records:", error);
    res.status(500).json({ error: "Failed to auto-classify accounts" });
  }
});

router.get("/:engagementId/data/gl", async (req: Request, res: Response) => {
  try {
    const { engagementId } = req.params;
    const { page = "1", pageSize = "20", search = "", accountCode } = req.query;
    const pageNum = parseInt(page as string, 10);
    const pageSizeNum = parseInt(pageSize as string, 10);
    const skip = (pageNum - 1) * pageSizeNum;

    const headers = await prisma.importJournalHeader.findMany({
      where: { engagementId },
      select: { id: true },
    });
    const headerIds = headers.map(h => h.id);

    const where: any = { journalHeaderId: { in: headerIds } };
    
    // Filter by specific account code for drilldown
    if (accountCode) {
      where.accountCode = accountCode as string;
    }
    
    if (search) {
      where.OR = [
        { accountCode: { contains: search as string, mode: "insensitive" } },
        { accountName: { contains: search as string, mode: "insensitive" } },
        { narration: { contains: search as string, mode: "insensitive" } },
      ];
    }

    const [lines, totalCount] = await Promise.all([
      prisma.importJournalLine.findMany({
        where,
        include: { journalHeader: { select: { voucherNo: true, voucherDate: true, voucherType: true } } },
        orderBy: [{ journalHeader: { voucherDate: "desc" } }, { lineNo: "asc" }],
        skip,
        take: pageSizeNum,
      }),
      prisma.importJournalLine.count({ where }),
    ]);

    const data = lines.map(line => ({
      id: line.id,
      glCode: line.accountCode,
      glName: line.accountName,
      postingDate: line.journalHeader.voucherDate,
      voucherNo: line.journalHeader.voucherNo,
      voucherType: line.journalHeader.voucherType,
      description: line.narration || line.accountName,
      documentNo: line.documentNo,
      debit: line.debit,
      credit: line.credit,
      narration: line.narration,
      currency: line.currency,
    }));

    const totalPages = Math.ceil(totalCount / pageSizeNum);

    res.json({
      data,
      meta: {
        page: pageNum,
        pageSize: pageSizeNum,
        totalCount,
        totalPages,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
      },
    });
  } catch (error) {
    console.error("Error fetching GL data:", error);
    res.status(500).json({ error: "Failed to fetch general ledger data" });
  }
});

router.get("/:engagementId/data/gl/summary", async (req: Request, res: Response) => {
  try {
    const { engagementId } = req.params;
    const headers = await prisma.importJournalHeader.findMany({
      where: { engagementId },
      select: { id: true },
    });
    const headerIds = headers.map(h => h.id);

    const lines = await prisma.importJournalLine.findMany({
      where: { journalHeaderId: { in: headerIds } },
      select: { debit: true, credit: true },
    });

    let totalDebit = 0;
    let totalCredit = 0;
    for (const line of lines) {
      totalDebit += Number(line.debit) || 0;
      totalCredit += Number(line.credit) || 0;
    }

    res.json({
      entryCount: lines.length,
      totalDebit,
      totalCredit,
    });
  } catch (error) {
    console.error("Error fetching GL summary:", error);
    res.status(500).json({ error: "Failed to fetch GL summary" });
  }
});

// GET GL transaction counts grouped by account code (for population/transaction count)
router.get("/:engagementId/data/gl/counts", async (req: Request, res: Response) => {
  try {
    const { engagementId } = req.params;

    const headers = await prisma.importJournalHeader.findMany({
      where: { engagementId },
      select: { id: true },
    });
    const headerIds = headers.map(h => h.id);

    if (headerIds.length === 0) {
      return res.json({ data: [] });
    }

    // Group by account code and count transactions
    const counts = await prisma.importJournalLine.groupBy({
      by: ['accountCode'],
      where: { journalHeaderId: { in: headerIds } },
      _count: { id: true },
    });

    res.json({
      data: counts.map(c => ({
        glCode: c.accountCode,
        transactionCount: c._count.id,
      })),
    });
  } catch (error) {
    console.error("Error fetching GL transaction counts:", error);
    res.status(500).json({ error: "Failed to fetch transaction counts" });
  }
});

// PATCH endpoint for updating GL entries (drilldown editing)
router.patch("/:engagementId/data/gl/:id", async (req: Request, res: Response) => {
  try {
    const { engagementId, id } = req.params;
    const updateData = req.body;
    
    // Remove fields that shouldn't be updated
    const { id: _, journalHeaderId, journalHeader, ...safeUpdateData } = updateData;
    
    // Find the line first to verify it belongs to this engagement
    const existingLine = await prisma.importJournalLine.findFirst({
      where: { 
        id,
        journalHeader: { engagementId }
      },
      include: { journalHeader: true }
    });
    
    if (!existingLine) {
      return res.status(404).json({ error: "GL entry not found" });
    }
    
    const resolvedGlCode = safeUpdateData.glCode || safeUpdateData.accountCode;
    const resolvedGlName = safeUpdateData.glName !== undefined ? safeUpdateData.glName : safeUpdateData.accountName;
    const resolvedDocNo = safeUpdateData.documentNo !== undefined ? safeUpdateData.documentNo : safeUpdateData.reference;

    const updated = await prisma.importJournalLine.update({
      where: { id },
      data: {
        ...(resolvedGlCode && { accountCode: resolvedGlCode }),
        ...(resolvedGlName !== undefined && { accountName: resolvedGlName }),
        ...(safeUpdateData.debit !== undefined && { debit: parseFloat(safeUpdateData.debit) || 0 }),
        ...(safeUpdateData.credit !== undefined && { credit: parseFloat(safeUpdateData.credit) || 0 }),
        ...(safeUpdateData.narration !== undefined && { narration: safeUpdateData.narration }),
        ...(safeUpdateData.description !== undefined && { narration: safeUpdateData.description }),
        ...(resolvedDocNo !== undefined && { documentNo: resolvedDocNo }),
      },
      include: { journalHeader: { select: { voucherNo: true, voucherDate: true, voucherType: true } } },
    });
    
    // Log the data edit
    await prisma.dataEdit.create({
      data: {
        engagementId,
        dataset: 'GL',
        operation: 'UPDATE',
        rowId: id,
        field: 'multiple',
        oldValue: JSON.stringify(existingLine),
        newValue: JSON.stringify(updated),
        notes: "Drilldown edit from Trial Balance",
        editedById: (req as any).user?.id || 'system',
      },
    });
    
    res.json({
      id: updated.id,
      glCode: updated.accountCode,
      glName: updated.accountName,
      postingDate: updated.journalHeader.voucherDate,
      voucherNo: updated.journalHeader.voucherNo,
      voucherType: updated.journalHeader.voucherType,
      description: updated.narration || updated.accountName,
      documentNo: updated.documentNo,
      debit: updated.debit,
      credit: updated.credit,
      narration: updated.narration,
    });
  } catch (error) {
    console.error("Error updating GL entry:", error);
    res.status(500).json({ error: "Failed to update GL entry" });
  }
});

router.get("/:engagementId/data/party", async (req: Request, res: Response) => {
  try {
    const { engagementId } = req.params;
    const { page = "1", pageSize = "20", search = "", partyType = "" } = req.query;
    const pageNum = parseInt(page as string, 10);
    const pageSizeNum = parseInt(pageSize as string, 10);

    const where: any = { engagementId };
    if (partyType) {
      where.partyType = partyType as string;
    }
    if (search) {
      where.OR = [
        { partyCode: { contains: search as string, mode: "insensitive" } },
        { partyName: { contains: search as string, mode: "insensitive" } },
      ];
    }

    const allRecords = await prisma.importPartyBalance.findMany({
      where,
      orderBy: { partyCode: "asc" },
    });

    const mergedMap = new Map<string, any>();
    for (const d of allRecords) {
      const key = `${d.partyCode}_${d.partyType}`;
      const balanceValue = Number(d.balance) || 0;
      const signedBalance = d.drcr === 'CR' ? -balanceValue : balanceValue;

      if (!mergedMap.has(key)) {
        mergedMap.set(key, {
          id: d.id,
          engagementId: d.engagementId,
          batchId: d.batchId,
          partyCode: d.partyCode,
          partyName: d.partyName,
          partyType: d.partyType,
          glCode: d.controlAccountCode,
          email: d.partyEmail || '',
          address: d.partyAddress || '',
          attentionTo: d.attentionTo || '',
          openingBalance: 0,
          balance: 0,
          balanceType: 'DEBIT',
        });
      }
      const row = mergedMap.get(key)!;
      if (d.balanceType === 'OB') {
        row.openingBalance = signedBalance;
      } else if (d.balanceType === 'CB') {
        row.id = d.id;
        row.balance = signedBalance;
        if (d.partyEmail) row.email = d.partyEmail;
        if (d.partyAddress) row.address = d.partyAddress;
        if (d.attentionTo) row.attentionTo = d.attentionTo;
      }
      const netBalance = row.balance || row.openingBalance;
      row.balanceType = netBalance >= 0 ? 'DEBIT' : 'CREDIT';
    }

    const mergedRows = Array.from(mergedMap.values()).sort((a, b) =>
      (a.partyCode || '').localeCompare(b.partyCode || '')
    );
    const totalCount = mergedRows.length;
    const totalPages = Math.ceil(totalCount / pageSizeNum);
    const skip = (pageNum - 1) * pageSizeNum;
    const pagedRows = mergedRows.slice(skip, skip + pageSizeNum);

    res.json({
      data: pagedRows,
      meta: {
        page: pageNum,
        pageSize: pageSizeNum,
        totalCount,
        totalPages,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
      },
    });
  } catch (error) {
    console.error("Error fetching party data:", error);
    res.status(500).json({ error: "Failed to fetch party balance data" });
  }
});

router.get("/:engagementId/data/party/summary", async (req: Request, res: Response) => {
  try {
    const { engagementId } = req.params;
    const { partyType = "VENDOR" } = req.query;

    const allRecords = await prisma.importPartyBalance.findMany({
      where: { engagementId, partyType: partyType as string },
    });

    const mergedMap = new Map<string, { openingBalance: number; closingBalance: number; glCode: string }>();
    for (const d of allRecords) {
      const key = d.partyCode;
      const balanceValue = Number(d.balance) || 0;
      const signedBalance = d.drcr === 'CR' ? -balanceValue : balanceValue;
      if (!mergedMap.has(key)) {
        mergedMap.set(key, { openingBalance: 0, closingBalance: 0, glCode: d.controlAccountCode || '' });
      }
      const row = mergedMap.get(key)!;
      if (d.balanceType === 'OB') row.openingBalance = signedBalance;
      else if (d.balanceType === 'CB') {
        row.closingBalance = signedBalance;
        if (d.controlAccountCode) row.glCode = d.controlAccountCode;
      }
    }

    let totalApBalance = 0;
    const controlCodes = new Set<string>();
    for (const row of mergedMap.values()) {
      totalApBalance += row.closingBalance;
      if (row.glCode) controlCodes.add(row.glCode);
    }

    const uniqueControlCodes = Array.from(controlCodes);

    const isAR = partyType === 'CUSTOMER';
    let apBalancePerTb = 0;
    if (uniqueControlCodes.length > 0) {
      const tbRecords = await prisma.importAccountBalance.findMany({
        where: { engagementId, accountCode: { in: uniqueControlCodes }, balanceType: 'CB' },
      });
      for (const tb of tbRecords) {
        const debit = Number(tb.debitAmount) || 0;
        const credit = Number(tb.creditAmount) || 0;
        apBalancePerTb += isAR ? (debit - credit) : (credit - debit);
      }
    }

    let apBalancePerGl = 0;
    if (uniqueControlCodes.length > 0) {
      const headers = await prisma.importJournalHeader.findMany({
        where: { engagementId },
        select: { id: true },
      });
      const headerIds = headers.map(h => h.id);
      if (headerIds.length > 0) {
        const glLines = await prisma.importJournalLine.findMany({
          where: { journalHeaderId: { in: headerIds }, accountCode: { in: uniqueControlCodes } },
          select: { debit: true, credit: true },
        });
        for (const line of glLines) {
          apBalancePerGl += isAR ? ((Number(line.debit) || 0) - (Number(line.credit) || 0)) : ((Number(line.credit) || 0) - (Number(line.debit) || 0));
        }
      }
    }

    res.json({
      partyCount: mergedMap.size,
      totalApBalance,
      apBalancePerTb,
      apBalancePerGl,
      uniqueControlCodes,
    });
  } catch (error) {
    console.error("Error fetching party summary:", error);
    res.status(500).json({ error: "Failed to fetch party summary" });
  }
});

router.post("/:engagementId/data/party", async (req: Request, res: Response) => {
  try {
    const { engagementId } = req.params;
    const data = req.body;

    const latestBatch = await prisma.importBatch.findFirst({
      where: { engagementId },
      orderBy: { createdAt: 'desc' },
    });

    if (!latestBatch) {
      return res.status(400).json({ error: "No import batch found for this engagement" });
    }

    const balanceValue = parseFloat(data.openingBalance || data.closingBalance) || 0;
    const balanceType = data.openingBalance !== undefined ? 'OB' : 'CB';

    const record = await prisma.importPartyBalance.create({
      data: {
        batchId: latestBatch.id,
        engagementId,
        partyType: data.partyType || "OTHER",
        partyCode: data.partyCode,
        partyName: data.partyName || "",
        controlAccountCode: data.glCode || data.controlAccountCode || data.controlAccount || '',
        balanceType,
        asOfDate: new Date(),
        balance: Math.abs(balanceValue),
        drcr: balanceValue >= 0 ? 'DR' : 'CR',
      },
    });

    res.status(201).json(record);
  } catch (error) {
    console.error("Error creating party record:", error);
    res.status(500).json({ error: "Failed to create party balance record" });
  }
});

router.patch("/:engagementId/data/party/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId, id } = req.params;
    const data = req.body;
    const userId = req.user?.id;

    const primaryRecord = await prisma.importPartyBalance.findUnique({ where: { id } });
    if (!primaryRecord) {
      return res.status(404).json({ error: "Record not found" });
    }

    const siblingRecords = await prisma.importPartyBalance.findMany({
      where: {
        engagementId,
        partyCode: primaryRecord.partyCode,
        partyType: primaryRecord.partyType,
        id: { not: id },
      },
    });
    const obRecord = primaryRecord.balanceType === 'OB' ? primaryRecord : siblingRecords.find(r => r.balanceType === 'OB');
    const cbRecord = primaryRecord.balanceType === 'CB' ? primaryRecord : siblingRecords.find(r => r.balanceType === 'CB');

    const sharedUpdate: any = {};
    if (data.partyCode !== undefined) sharedUpdate.partyCode = data.partyCode;
    if (data.partyName !== undefined) sharedUpdate.partyName = data.partyName;
    if (data.partyType !== undefined) sharedUpdate.partyType = data.partyType;
    if (data.glCode !== undefined || data.controlAccountCode !== undefined || data.controlAccount !== undefined) {
      sharedUpdate.controlAccountCode = data.glCode || data.controlAccountCode || data.controlAccount;
    }
    if (data.email !== undefined || data.partyEmail !== undefined) sharedUpdate.partyEmail = data.email || data.partyEmail;
    if (data.address !== undefined || data.partyAddress !== undefined) sharedUpdate.partyAddress = data.address || data.partyAddress;
    if (data.attentionTo !== undefined) sharedUpdate.attentionTo = data.attentionTo;

    const updates: Promise<any>[] = [];
    if (data.openingBalance !== undefined && obRecord) {
      const val = parseFloat(data.openingBalance) || 0;
      updates.push(prisma.importPartyBalance.update({
        where: { id: obRecord.id },
        data: { ...sharedUpdate, balance: Math.abs(val), drcr: val >= 0 ? 'DR' : 'CR' },
      }));
    }
    const closingBalVal = data.balance !== undefined ? data.balance : data.closingBalance;
    if (closingBalVal !== undefined && cbRecord) {
      const val = parseFloat(closingBalVal) || 0;
      updates.push(prisma.importPartyBalance.update({
        where: { id: cbRecord.id },
        data: { ...sharedUpdate, balance: Math.abs(val), drcr: val >= 0 ? 'DR' : 'CR' },
      }));
    }
    if (updates.length === 0 && Object.keys(sharedUpdate).length > 0) {
      if (cbRecord) {
        updates.push(prisma.importPartyBalance.update({ where: { id: cbRecord.id }, data: sharedUpdate }));
      }
      if (obRecord && obRecord.id !== cbRecord?.id) {
        updates.push(prisma.importPartyBalance.update({ where: { id: obRecord.id }, data: sharedUpdate }));
      }
      if (updates.length === 0) {
        updates.push(prisma.importPartyBalance.update({ where: { id }, data: sharedUpdate }));
      }
    }

    const results = await Promise.all(updates);

    await prisma.dataEdit.create({
      data: {
        engagementId,
        batchId: primaryRecord.batchId,
        dataset: 'PARTY',
        operation: 'UPDATE',
        rowId: id,
        field: null,
        oldValue: JSON.stringify(primaryRecord),
        newValue: JSON.stringify(results[0] || primaryRecord),
        fullRowJson: results[0] || primaryRecord,
        editedById: userId!,
        notes: obRecord && cbRecord ? 'Dual OB/CB update' : null,
      }
    });

    res.json(results[0] || primaryRecord);
  } catch (error) {
    console.error("Error updating party record:", error);
    res.status(500).json({ error: "Failed to update party balance record" });
  }
});

router.delete("/:engagementId/data/party/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId, id } = req.params;
    const userId = req.user?.id;

    const oldRecord = await prisma.importPartyBalance.findUnique({ where: { id } });
    if (!oldRecord) {
      return res.status(404).json({ error: "Record not found" });
    }

    await prisma.importPartyBalance.delete({ where: { id } });

    await prisma.dataEdit.create({
      data: {
        engagementId,
        batchId: oldRecord.batchId,
        dataset: 'PARTY',
        operation: 'DELETE',
        rowId: id,
        field: null,
        oldValue: JSON.stringify(oldRecord),
        newValue: null,
        fullRowJson: oldRecord,
        editedById: userId!,
        notes: null,
      }
    });

    res.json({ message: "Record deleted" });
  } catch (error) {
    console.error("Error deleting party record:", error);
    res.status(500).json({ error: "Failed to delete party balance record" });
  }
});

router.get("/:engagementId/data/bank", async (req: Request, res: Response) => {
  try {
    const { engagementId } = req.params;
    const { page = "1", pageSize = "20", search = "" } = req.query;
    const pageNum = parseInt(page as string, 10);
    const pageSizeNum = parseInt(pageSize as string, 10);
    const skip = (pageNum - 1) * pageSizeNum;

    const where: any = { engagementId };
    if (search) {
      where.OR = [
        { bankAccountCode: { contains: search as string, mode: "insensitive" } },
        { bankName: { contains: search as string, mode: "insensitive" } },
        { accountNo: { contains: search as string, mode: "insensitive" } },
      ];
    }

    const [data, totalCount] = await Promise.all([
      prisma.importBankAccount.findMany({
        where,
        include: {
          balances: {
            orderBy: { asOfDate: "desc" },
            take: 1,
          },
        },
        orderBy: { bankName: "asc" },
        skip,
        take: pageSizeNum,
      }),
      prisma.importBankAccount.count({ where }),
    ]);

    const totalPages = Math.ceil(totalCount / pageSizeNum);

    res.json({
      data: data.map(d => ({
        id: d.id,
        bankAccountId: d.bankAccountCode,
        bankName: d.bankName,
        branch: d.branchName,
        accountNumber: d.accountNo,
        accountTitle: d.accountTitle,
        currency: d.currency,
        closingBalance: d.balances[0] ? Number(d.balances[0].closingBalance) : 0,
      })),
      meta: {
        page: pageNum,
        pageSize: pageSizeNum,
        totalCount,
        totalPages,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
      },
    });
  } catch (error) {
    console.error("Error fetching bank data:", error);
    res.status(500).json({ error: "Failed to fetch bank account data" });
  }
});

router.get("/:engagementId/data/bank/summary", async (req: Request, res: Response) => {
  try {
    const { engagementId } = req.params;

    const bankAccounts = await prisma.importBankAccount.findMany({
      where: { engagementId },
      include: { balances: { orderBy: { asOfDate: "desc" }, take: 1 } },
    });

    let totalBookBalance = 0;
    const controlCodes = new Set<string>();
    const currencyTotals: Record<string, number> = {};

    for (const acct of bankAccounts) {
      const bal = acct.balances[0] ? Number(acct.balances[0].closingBalance) || 0 : 0;
      totalBookBalance += bal;
      controlCodes.add(acct.bankAccountCode);
      const ccy = acct.currency || 'PKR';
      currencyTotals[ccy] = (currencyTotals[ccy] || 0) + bal;
    }

    const uniqueControlCodes = Array.from(controlCodes);

    let bankBalancePerTb = 0;
    if (uniqueControlCodes.length > 0) {
      const tbRecords = await prisma.importAccountBalance.findMany({
        where: { engagementId, accountCode: { in: uniqueControlCodes }, balanceType: 'CB' },
      });
      for (const tb of tbRecords) {
        const debit = Number(tb.debitAmount) || 0;
        const credit = Number(tb.creditAmount) || 0;
        bankBalancePerTb += debit - credit;
      }
    }

    let bankBalancePerGl = 0;
    if (uniqueControlCodes.length > 0) {
      const headers = await prisma.importJournalHeader.findMany({
        where: { engagementId },
        select: { id: true },
      });
      const headerIds = headers.map(h => h.id);
      if (headerIds.length > 0) {
        const glLines = await prisma.importJournalLine.findMany({
          where: { journalHeaderId: { in: headerIds }, accountCode: { in: uniqueControlCodes } },
          select: { debit: true, credit: true },
        });
        for (const line of glLines) {
          bankBalancePerGl += (Number(line.debit) || 0) - (Number(line.credit) || 0);
        }
      }
    }

    res.json({
      accountCount: bankAccounts.length,
      totalClosingBalance: totalBookBalance,
      totalBookBalance,
      bankBalancePerTb,
      bankBalancePerGl,
      uniqueControlCodes,
      currencyBreakdown: Object.entries(currencyTotals).map(([currency, total]) => ({ currency, total })),
    });
  } catch (error) {
    console.error("Error fetching bank summary:", error);
    res.status(500).json({ error: "Failed to fetch bank summary" });
  }
});

router.post("/:engagementId/data/bank", async (req: Request, res: Response) => {
  try {
    const { engagementId } = req.params;
    const data = req.body;

    const latestBatch = await prisma.importBatch.findFirst({
      where: { engagementId },
      orderBy: { createdAt: 'desc' },
    });

    if (!latestBatch) {
      return res.status(400).json({ error: "No import batch found for this engagement" });
    }

    const record = await prisma.importBankAccount.create({
      data: {
        batchId: latestBatch.id,
        engagementId,
        bankAccountCode: data.bankAccountId || data.bankCode || data.bankAccountCode,
        bankName: data.bankName || "",
        branchName: data.branch || data.branchName,
        accountNo: data.accountNumber || data.accountNo,
        accountTitle: data.accountTitle || data.accountType || data.bankName,
        currency: data.currency || "PKR",
      },
    });

    res.status(201).json(record);
  } catch (error) {
    console.error("Error creating bank record:", error);
    res.status(500).json({ error: "Failed to create bank account record" });
  }
});

router.patch("/:engagementId/data/bank/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId, id } = req.params;
    const data = req.body;
    const userId = req.user?.id;

    const oldRecord = await prisma.importBankAccount.findUnique({ where: { id } });
    if (!oldRecord) {
      return res.status(404).json({ error: "Record not found" });
    }

    const record = await prisma.importBankAccount.update({
      where: { id },
      data: {
        bankAccountCode: data.bankAccountId || data.bankCode || data.bankAccountCode,
        bankName: data.bankName,
        branchName: data.branch || data.branchName,
        accountNo: data.accountNumber || data.accountNo,
        accountTitle: data.accountTitle || data.accountType,
        currency: data.currency,
      },
    });

    await prisma.dataEdit.create({
      data: {
        engagementId,
        batchId: oldRecord.batchId,
        dataset: 'BANK',
        operation: 'UPDATE',
        rowId: id,
        field: null,
        oldValue: JSON.stringify(oldRecord),
        newValue: JSON.stringify(record),
        fullRowJson: record,
        editedById: userId!,
        notes: null,
      }
    });

    res.json(record);
  } catch (error) {
    console.error("Error updating bank record:", error);
    res.status(500).json({ error: "Failed to update bank account record" });
  }
});

router.delete("/:engagementId/data/bank/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId, id } = req.params;
    const userId = req.user?.id;

    const oldRecord = await prisma.importBankAccount.findUnique({ where: { id } });
    if (!oldRecord) {
      return res.status(404).json({ error: "Record not found" });
    }

    await prisma.importBankAccount.delete({ where: { id } });

    await prisma.dataEdit.create({
      data: {
        engagementId,
        batchId: oldRecord.batchId,
        dataset: 'BANK',
        operation: 'DELETE',
        rowId: id,
        field: null,
        oldValue: JSON.stringify(oldRecord),
        newValue: null,
        fullRowJson: oldRecord,
        editedById: userId!,
        notes: null,
      }
    });

    res.json({ message: "Record deleted" });
  } catch (error) {
    console.error("Error deleting bank record:", error);
    res.status(500).json({ error: "Failed to delete bank account record" });
  }
});

// Confirmation Letter Download - Single Letter
router.post("/:engagementId/confirmation-letter", async (req: Request, res: Response) => {
  try {
    const { engagementId } = req.params;
    const { type, partyCode, partyName, contactEmail, balance, currency } = req.body;

    const engagement = await prisma.engagement.findUnique({
      where: { id: engagementId },
      include: {
        client: true,
        firm: true,
      },
    });

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    const clientInfo = {
      clientName: engagement.client?.name || "Client Company",
      fiscalYearEnd: engagement.fiscalYearEnd?.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }) || new Date().toLocaleDateString("en-GB"),
      auditorFirmName: engagement.firm?.name || "Audit Firm",
      auditorAddress: engagement.firm?.address || "Audit Firm Address",
      logoUrl: engagement.firm?.logoUrl || null,
    };

    const confirmationData = {
      type: type as "AR" | "AP" | "BANK" | "LEGAL" | "TAX",
      partyCode,
      partyName,
      contactEmail,
      balance: parseFloat(balance) || 0,
      currency: currency || "PKR",
      partyAddress: req.body.partyAddress,
      partyCity: req.body.partyCity,
      contactPerson: req.body.contactPerson,
    };

    let buffer: Buffer;
    let filename: string;

    if (type === "BANK") {
      buffer = await generateBankConfirmationLetter(confirmationData, clientInfo);
      filename = `Bank_Confirmation_${partyName.replace(/[^a-zA-Z0-9]/g, "_")}.docx`;
    } else if (type === "LEGAL") {
      buffer = await generateLegalAdvisorConfirmationLetter(confirmationData, clientInfo);
      filename = `Legal_Advisor_Confirmation_${partyName.replace(/[^a-zA-Z0-9]/g, "_")}.docx`;
    } else if (type === "TAX") {
      buffer = await generateTaxAdvisorConfirmationLetter(confirmationData, clientInfo);
      filename = `Tax_Advisor_Confirmation_${partyName.replace(/[^a-zA-Z0-9]/g, "_")}.docx`;
    } else {
      buffer = await generateARAPConfirmationLetter(confirmationData, clientInfo);
      filename = `${type}_Confirmation_${partyName.replace(/[^a-zA-Z0-9]/g, "_")}.docx`;
    }

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    console.error("Error generating confirmation letter:", error);
    res.status(500).json({ error: "Failed to generate confirmation letter" });
  }
});

// Confirmation Letter Download - All Letters in one document
router.post("/:engagementId/confirmation-letters-all", async (req: Request, res: Response) => {
  try {
    const { engagementId } = req.params;
    const { confirmations } = req.body;

    if (!confirmations || !Array.isArray(confirmations) || confirmations.length === 0) {
      return res.status(400).json({ error: "No confirmations provided" });
    }

    const engagement = await prisma.engagement.findUnique({
      where: { id: engagementId },
      include: {
        client: true,
        firm: true,
      },
    });

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    const clientInfo = {
      clientName: engagement.client?.name || "Client Company",
      fiscalYearEnd: engagement.fiscalYearEnd?.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }) || new Date().toLocaleDateString("en-GB"),
      auditorFirmName: engagement.firm?.name || "Audit Firm",
      auditorAddress: engagement.firm?.address || "Audit Firm Address",
      logoUrl: engagement.firm?.logoUrl || null,
    };

    const confirmationData = confirmations.map((c: any) => ({
      type: c.type as "AR" | "AP" | "BANK" | "LEGAL" | "TAX",
      partyCode: c.partyCode,
      partyName: c.partyName,
      contactEmail: c.contactEmail,
      balance: parseFloat(c.balance) || 0,
      currency: c.currency || "PKR",
      partyAddress: c.partyAddress,
      partyCity: c.partyCity,
      contactPerson: c.contactPerson,
    }));

    const buffer = await generateAllConfirmationLetters(confirmationData, clientInfo);
    const filename = `All_Confirmation_Letters_${new Date().toISOString().split("T")[0]}.docx`;

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    console.error("Error generating confirmation letters:", error);
    res.status(500).json({ error: "Failed to generate confirmation letters" });
  }
});

// ============================================================================
// PER-DATASET UPLOAD - Upload individual dataset files (TB, GL, AP, AR, Bank)
// ============================================================================

const VALID_DATASET_TYPES = ['tb', 'gl', 'ap', 'ar', 'bank'] as const;

router.post("/:engagementId/upload-dataset/:datasetType", requireAuth, upload.single("file"), async (req: Request, res: Response) => {
  try {
    const { engagementId, datasetType } = req.params;
    const userId = (req as AuthenticatedRequest).user!.id;

    if (!VALID_DATASET_TYPES.includes(datasetType as any)) {
      return res.status(400).json({
        success: false,
        error: `Invalid dataset type: ${datasetType}. Must be one of: ${VALID_DATASET_TYPES.join(', ')}`,
      });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, error: "No file uploaded" });
    }

    const engagement = await prisma.engagement.findUnique({
      where: { id: engagementId },
      select: { id: true, engagementCode: true },
    });

    if (!engagement) {
      return res.status(404).json({ success: false, error: "Engagement not found" });
    }

    const result = await importSingleDataset(
      engagementId,
      userId,
      req.file.originalname,
      req.file.buffer,
      datasetType as DatasetType
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

    if (datasetType === 'tb') {
      autoClassifyAndSync(engagementId, userId).catch(() => {});
    }

    res.json(result);
  } catch (error: any) {
    console.error("Error uploading dataset:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to upload dataset",
    });
  }
});

// ============================================================================
// COMBINED INPUT WORKBOOK UPLOAD - Single file upload with validation pipeline
// ============================================================================

router.post("/:engagementId/input-workbook", requireAuth, upload.single("file"), async (req: Request, res: Response) => {
  try {
    const { engagementId } = req.params;
    const userId = (req as AuthenticatedRequest).user!.id;

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const engagement = await prisma.engagement.findUnique({
      where: { id: engagementId },
      select: { id: true, engagementCode: true },
    });

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    const skipValidation = req.query.skipValidation === 'true';

    if (!skipValidation) {
      const validationResult = await validateWorkbookStructure(req.file.buffer);

      if (!validationResult.valid) {
        return res.status(400).json({
          success: false,
          blocked: true,
          error: `Import blocked: ${validationResult.criticalCount} critical and ${validationResult.errorCount} error issues found. Fix all CRITICAL and ERROR issues before importing.`,
          validation: {
            valid: false,
            criticalCount: validationResult.criticalCount,
            errorCount: validationResult.errorCount,
            warningCount: validationResult.warningCount,
            sheetsFound: validationResult.sheetsFound,
            sheetsMissing: validationResult.sheetsMissing,
            rowCounts: validationResult.rowCounts,
          },
          errors: validationResult.errors,
          canDownloadReport: true,
        });
      }
    }

    const result = await importInputWorkbook(
      engagementId,
      userId,
      req.file.originalname,
      req.file.buffer
    );

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
        exceptions: result.exceptions,
      });
    }

    autoClassifyAndSync(engagementId, userId).catch(() => {});

    res.json(result);
  } catch (error) {
    console.error("Error uploading input workbook:", error);
    res.status(500).json({ error: "Failed to upload input workbook" });
  }
});

router.post("/:engagementId/rerun-validations", requireAuth, async (req: Request, res: Response) => {
  try {
    const { engagementId } = req.params;
    const userId = (req as AuthenticatedRequest).user!.id;

    const result = await rerunValidations(engagementId, userId);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
      });
    }

    res.json(result);
  } catch (error) {
    console.error("Error rerunning validations:", error);
    res.status(500).json({ error: "Failed to rerun validations" });
  }
});

router.get("/:engagementId/summary-run", requireAuth, async (req: Request, res: Response) => {
  try {
    const { engagementId } = req.params;

    const summaryRun = await getSummaryRun(engagementId);

    if (!summaryRun) {
      return res.json({
        hasSummary: false,
        message: "No input workbook has been uploaded yet",
      });
    }

    res.json({
      hasSummary: true,
      ...summaryRun,
    });
  } catch (error) {
    console.error("Error fetching summary run:", error);
    res.status(500).json({ error: "Failed to fetch summary run" });
  }
});

router.get("/:engagementId/summary/export", requireAuth, async (req: Request, res: Response) => {
  try {
    const { engagementId } = req.params;

    const summaryRun = await getSummaryRun(engagementId);

    if (!summaryRun) {
      return res.status(404).json({ error: "No summary data available" });
    }

    const workbook = new ExcelJS.Workbook();
    
    const summarySheet = workbook.addWorksheet("Summary");
    summarySheet.columns = [
      { header: "Metric", key: "metric", width: 30 },
      { header: "Value", key: "value", width: 20 },
      { header: "Status", key: "status", width: 15 },
    ];
    
    summarySheet.addRows([
      { metric: "Upload Version", value: summaryRun.uploadVersion?.version || 1, status: summaryRun.uploadVersion?.status || 'ACTIVE' },
      { metric: "File Name", value: summaryRun.uploadVersion?.fileName || '', status: '' },
      { metric: "Upload Date", value: summaryRun.createdAt?.toISOString() || '', status: '' },
      { metric: "", value: "", status: "" },
      { metric: "TB Rows", value: summaryRun.tbRowCount, status: "" },
      { metric: "GL Entries", value: summaryRun.glEntryCount, status: "" },
      { metric: "AP Rows", value: summaryRun.apRowCount, status: "" },
      { metric: "AR Rows", value: summaryRun.arRowCount, status: "" },
      { metric: "Bank Accounts", value: summaryRun.bankRowCount, status: "" },
      { metric: "Parties", value: summaryRun.partyCount, status: "" },
      { metric: "", value: "", status: "" },
      { metric: "TB Opening Debit", value: Number(summaryRun.tbOpeningDebitTotal).toFixed(2), status: "" },
      { metric: "TB Opening Credit", value: Number(summaryRun.tbOpeningCreditTotal).toFixed(2), status: "" },
      { metric: "TB Closing Debit", value: Number(summaryRun.tbClosingDebitTotal).toFixed(2), status: "" },
      { metric: "TB Closing Credit", value: Number(summaryRun.tbClosingCreditTotal).toFixed(2), status: "" },
      { metric: "GL Debit Total", value: Number(summaryRun.glDebitTotal).toFixed(2), status: "" },
      { metric: "GL Credit Total", value: Number(summaryRun.glCreditTotal).toFixed(2), status: "" },
      { metric: "", value: "", status: "" },
      { metric: "TB Arithmetic Check", value: summaryRun.tbArithmeticMessage || '', status: summaryRun.tbArithmeticStatus },
      { metric: "GL DR=CR Check", value: summaryRun.glDrCrMessage || '', status: summaryRun.glDrCrStatus },
      { metric: "TB-GL Tie-out", value: summaryRun.tbGlTieOutMessage || '', status: summaryRun.tbGlTieOutStatus },
      { metric: "", value: "", status: "" },
      { metric: "Overall Status", value: "", status: summaryRun.overallStatus },
      { metric: "Exception Count", value: summaryRun.exceptionCount, status: "" },
      { metric: "Critical Exceptions", value: summaryRun.criticalExceptionCount, status: "" },
    ]);

    if (summaryRun.exceptions && summaryRun.exceptions.length > 0) {
      const exceptionsSheet = workbook.addWorksheet("Exceptions");
      exceptionsSheet.columns = [
        { header: "Dataset", key: "dataset", width: 15 },
        { header: "Severity", key: "severity", width: 12 },
        { header: "Rule Code", key: "ruleCode", width: 25 },
        { header: "Rule Name", key: "ruleName", width: 30 },
        { header: "Message", key: "message", width: 50 },
        { header: "Row Reference", key: "rowReference", width: 15 },
        { header: "Account Code", key: "accountCode", width: 15 },
        { header: "Expected", key: "expectedValue", width: 15 },
        { header: "Actual", key: "actualValue", width: 15 },
        { header: "Difference", key: "difference", width: 15 },
      ];
      
      for (const exc of summaryRun.exceptions) {
        exceptionsSheet.addRow({
          dataset: exc.dataset,
          severity: exc.severity,
          ruleCode: exc.ruleCode,
          ruleName: exc.ruleName,
          message: exc.message,
          rowReference: exc.rowReference || '',
          accountCode: exc.accountCode || '',
          expectedValue: exc.expectedValue || '',
          actualValue: exc.actualValue || '',
          difference: exc.difference ? Number(exc.difference).toFixed(2) : '',
        });
      }
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const filename = `Output_Summary_${new Date().toISOString().split("T")[0]}.xlsx`;

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    console.error("Error exporting summary:", error);
    res.status(500).json({ error: "Failed to export summary" });
  }
});

router.post("/:engagementId/validate-workbook", requireAuth, upload.single("file"), async (req: Request, res: Response) => {
  try {
    const { engagementId } = req.params;

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const engagement = await prisma.engagement.findUnique({
      where: { id: engagementId },
      select: { id: true },
    });

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    const result = await validateWorkbookStructure(req.file.buffer);

    res.json({
      valid: result.valid,
      criticalCount: result.criticalCount,
      errorCount: result.errorCount,
      warningCount: result.warningCount,
      infoCount: result.infoCount,
      sheetsFound: result.sheetsFound,
      sheetsMissing: result.sheetsMissing,
      sheetsUnknown: result.sheetsUnknown,
      rowCounts: result.rowCounts,
      errors: result.errors,
      canImport: result.valid,
    });
  } catch (error) {
    console.error("Error validating workbook:", error);
    res.status(500).json({ error: "Failed to validate workbook" });
  }
});

router.post("/:engagementId/error-report", requireAuth, upload.single("file"), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const result = await validateWorkbookStructure(req.file.buffer);

    if (result.errors.length === 0) {
      return res.status(200).json({ message: "No errors found. The workbook is valid." });
    }

    const reportBuffer = await generateErrorReport(result.errors);
    const filename = `Import_Error_Report_${new Date().toISOString().split("T")[0]}.xlsx`;

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(reportBuffer);
  } catch (error) {
    console.error("Error generating error report:", error);
    res.status(500).json({ error: "Failed to generate error report" });
  }
});

export default router;
