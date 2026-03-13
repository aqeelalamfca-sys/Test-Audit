import { Router, Response } from "express";
import { requireAuth, AuthenticatedRequest } from "./auth";
import { prisma } from "./db";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import ExcelJS from "exceljs";

const router = Router();

const __filename_local = fileURLToPath(import.meta.url);
const __dirname_local = path.dirname(__filename_local);

interface TemplateMeta {
  id: string;
  fileName: string;
  category: string;
  subCategory: string;
  reference: string;
  title: string;
  description: string;
  fileType: string;
  phase: string;
  fsLineItems: string[];
  isaParagraph: string;
  sourceZip: string;
  linkedModule: string;
  prefillCapable: boolean;
  prefillFields: string[];
}

type TemplateEntry = {
  file: string;
  ref: string;
  title: string;
  desc: string;
  fsLines?: string[];
  isa?: string;
  module?: string;
  prefill?: boolean;
  prefillFields?: string[];
  sub?: string;
};

const WORKING_PAPERS_DIR = path.join(__dirname_local, "template-vault", "working-papers");
const ISQM_DIR = path.join(__dirname_local, "template-vault", "isqm");

const WP_SOURCE_ZIP = "Aqeel_Alam_&_Co._-_Model_FS_and_Working_Papers.zip";
const ISQM_SOURCE_ZIP = "ISQM.zip";

function buildEntry(
  t: TemplateEntry,
  category: string,
  subCategory: string,
  phase: string,
  sourceZip: string,
  defaultModule: string,
): TemplateMeta {
  const ext = t.file.split(".").pop() || "xlsx";
  return {
    id: t.ref.toLowerCase().replace(/\./g, "-").replace(/\s/g, ""),
    fileName: t.file,
    category,
    subCategory,
    reference: t.ref,
    title: t.title,
    description: t.desc,
    fileType: ext,
    phase,
    fsLineItems: t.fsLines || [],
    isaParagraph: t.isa || "",
    sourceZip,
    linkedModule: t.module || defaultModule,
    prefillCapable: t.prefill ?? (ext === "xlsx"),
    prefillFields: t.prefillFields || (ext === "xlsx" ? ["firmName", "clientName", "periodEnd", "periodStart"] : []),
  };
}

function buildWorkingPaperCatalog(): TemplateMeta[] {
  const templates: TemplateMeta[] = [];

  const bsTemplates: TemplateEntry[] = [
    { file: "BS.01. Property, plant and equipment.xlsx", ref: "BS.01", title: "Property, Plant & Equipment", desc: "Working paper for PPE additions, disposals, depreciation, and impairment testing per IAS 16", fsLines: ["BS-NCA-PPE"], isa: "ISA 500, ISA 540", module: "execution-fs-heads" },
    { file: "BS.02. Intangble assets.xlsx", ref: "BS.02", title: "Intangible Assets", desc: "Working paper for intangible assets amortization and impairment per IAS 38", fsLines: ["BS-NCA-INTANG"], isa: "ISA 500, ISA 540", module: "execution-fs-heads" },
    { file: "BS.04. Long term investments.xlsx", ref: "BS.04", title: "Long Term Investments", desc: "Working paper for long-term investments valuation and classification per IFRS 9", fsLines: ["BS-NCA-LTI"], isa: "ISA 500, ISA 540", module: "execution-fs-heads" },
    { file: "BS.05. Long term loans and advances.xlsx", ref: "BS.05", title: "Long Term Loans & Advances", desc: "Working paper for long-term receivables and ECL assessment", fsLines: ["BS-NCA-LTLA"], isa: "ISA 500, ISA 540", module: "execution-fs-heads" },
    { file: "BS.06. Long term deposits.xlsx", ref: "BS.06", title: "Long Term Deposits", desc: "Working paper for long-term deposits and security deposits verification", fsLines: ["BS-NCA-LTD"], isa: "ISA 500", module: "execution-fs-heads" },
    { file: "BS.07. Stores, spares and loose tools.xlsx", ref: "BS.07", title: "Stores, Spares & Loose Tools", desc: "Working paper for stores and spares valuation per IAS 2", fsLines: ["BS-CA-INV"], isa: "ISA 501", module: "execution-fs-heads" },
    { file: "BS.08. Stock in trade.xlsx", ref: "BS.08", title: "Stock in Trade", desc: "Working paper for inventory valuation, NRV testing, and stock take observation per IAS 2", fsLines: ["BS-CA-INV"], isa: "ISA 501", module: "execution-fs-heads" },
    { file: "BS.09. Trade debts (Receivables).xlsx", ref: "BS.09", title: "Trade Debts (Receivables)", desc: "Working paper for trade receivables, aging, and ECL provision per IFRS 9", fsLines: ["BS-CA-AR"], isa: "ISA 500, ISA 505", module: "execution-fs-heads" },
    { file: "BS.10. Short term loans and advances.xlsx", ref: "BS.10", title: "Short Term Loans & Advances", desc: "Working paper for short-term loans, advances to employees and suppliers", fsLines: ["BS-CA-OTH"], isa: "ISA 500", module: "execution-fs-heads" },
    { file: "BS.11. Trade deposits and short term prepayments..xlsx", ref: "BS.11", title: "Trade Deposits & Prepayments", desc: "Working paper for trade deposits and short-term prepayments verification", fsLines: ["BS-CA-OTH"], isa: "ISA 500", module: "execution-fs-heads" },
    { file: "BS.12. Other receivables.xlsx", ref: "BS.12", title: "Other Receivables", desc: "Working paper for other receivables including related party balances", fsLines: ["BS-CA-OTH"], isa: "ISA 500, ISA 550", module: "execution-fs-heads" },
    { file: "BS.13. Other financial assets.xlsx", ref: "BS.13", title: "Other Financial Assets", desc: "Working paper for short-term investments and financial assets per IFRS 9", fsLines: ["BS-CA-OTH"], isa: "ISA 500, ISA 540", module: "execution-fs-heads" },
    { file: "BS.14. Tax refund due from government.xlsx", ref: "BS.14", title: "Tax Refunds Due from Government", desc: "Working paper for income tax, sales tax, and withholding tax refunds", fsLines: ["BS-CA-OTH"], isa: "ISA 500", module: "execution-fs-heads" },
    { file: "BS.15. Cash and bank balance.xlsx", ref: "BS.15", title: "Cash & Bank Balances", desc: "Working paper for cash count, bank reconciliations, and bank confirmations", fsLines: ["BS-CA-CASH"], isa: "ISA 500, ISA 505", module: "execution-fs-heads" },
    { file: "BS.16. Share capital and reserves.xlsx", ref: "BS.16", title: "Share Capital & Reserves", desc: "Working paper for equity, share capital movements, and reserve analysis", fsLines: ["BS-EQ-SC"], isa: "ISA 500", module: "execution-fs-heads" },
    { file: "BS.17. Long term financing - Banking and other financial institutions.xlsx", ref: "BS.17", title: "Long Term Financing (Banks)", desc: "Working paper for bank borrowings, covenants review per IFRS 9", fsLines: ["BS-NCL-LTL"], isa: "ISA 500, ISA 505", module: "execution-fs-heads" },
    { file: "BS.18. Long term financing - Related parties.xlsx", ref: "BS.18", title: "Long Term Financing (Related Parties)", desc: "Working paper for related party financing and IAS 24 disclosures", fsLines: ["BS-NCL-LTL"], isa: "ISA 500, ISA 550", module: "execution-fs-heads" },
    { file: "BS.19. Liabilities against assets subject to finance lease.xlsx", ref: "BS.19", title: "Lease Liabilities", desc: "Working paper for IFRS 16 lease liabilities and right-of-use assets", fsLines: ["BS-NCL-LTL"], isa: "ISA 500, ISA 540", module: "execution-fs-heads" },
    { file: "BS.22. Long term deposits - Liabilities.xlsx", ref: "BS.22", title: "Long Term Deposits (Liabilities)", desc: "Working paper for security deposits received from customers/tenants", fsLines: ["BS-NCL-LTL"], isa: "ISA 500", module: "execution-fs-heads" },
    { file: "BS.23. Staff Retirement Benefits.xlsx", ref: "BS.23", title: "Staff Retirement Benefits", desc: "Working paper for gratuity, pension, and provident fund per IAS 19", fsLines: ["BS-NCL-LTL"], isa: "ISA 500, ISA 540", module: "execution-fs-heads" },
    { file: "BS.24. Deferred Taxation.xlsx", ref: "BS.24", title: "Deferred Taxation", desc: "Working paper for deferred tax asset/liability per IAS 12", fsLines: ["BS-NCL-LTL"], isa: "ISA 500, ISA 540", module: "execution-fs-heads" },
    { file: "BS.25. Trade and other payables.xlsx", ref: "BS.25", title: "Trade & Other Payables", desc: "Working paper for trade payables, accruals, and other creditors", fsLines: ["BS-CL-AP"], isa: "ISA 500, ISA 505", module: "execution-fs-heads" },
    { file: "BS.26. Short term borrowings.xlsx", ref: "BS.26", title: "Short Term Borrowings", desc: "Working paper for running finance, short-term loans, and overdrafts", fsLines: ["BS-CL-STB"], isa: "ISA 500, ISA 505", module: "execution-fs-heads" },
    { file: "BS.27. Assets classified as held for sale.xlsx", ref: "BS.27", title: "Assets Held for Sale", desc: "Working paper for discontinued operations and assets held for sale per IFRS 5", fsLines: ["BS-CA-OTH"], isa: "ISA 500", module: "execution-fs-heads" },
    { file: "BS.28. Contingencies and Commitments.xlsx", ref: "BS.28", title: "Contingencies & Commitments", desc: "Working paper for contingent liabilities and commitments per IAS 37", fsLines: ["BS-CL-AP"], isa: "ISA 500, ISA 501", module: "execution-fs-heads" },
  ];

  const plTemplates: TemplateEntry[] = [
    { file: "PL.01. Sales and services.xlsx", ref: "PL.01", title: "Sales & Services Revenue", desc: "Working paper for revenue recognition testing per IFRS 15", fsLines: ["PL-REV-SALE"], isa: "ISA 500, ISA 520", module: "execution-fs-heads" },
    { file: "PL.02. Cost of sales.xlsx", ref: "PL.02", title: "Cost of Sales", desc: "Working paper for cost of goods sold, manufacturing costs per IAS 2", fsLines: ["PL-EXP-COGS"], isa: "ISA 500", module: "execution-fs-heads" },
    { file: "PL.03. Distribution cost.xlsx", ref: "PL.03", title: "Distribution Cost", desc: "Working paper for selling and distribution expenses testing", fsLines: ["PL-EXP-MKT"], isa: "ISA 500", module: "execution-fs-heads" },
    { file: "PL.04. Administrative expenses.xlsx", ref: "PL.04", title: "Administrative Expenses", desc: "Working paper for admin expenses analytical review and vouching", fsLines: ["PL-EXP-ADMIN"], isa: "ISA 500, ISA 520", module: "execution-fs-heads" },
    { file: "PL.05. Other Operating Expenses.xlsx", ref: "PL.05", title: "Other Operating Expenses", desc: "Working paper for other operating charges and provisions", fsLines: ["PL-EXP-ADMIN"], isa: "ISA 500", module: "execution-fs-heads" },
    { file: "PL.06. Finance cost.xlsx", ref: "PL.06", title: "Finance Cost", desc: "Working paper for interest expense, bank charges, and IFRS 16 interest", fsLines: ["PL-EXP-FIN"], isa: "ISA 500", module: "execution-fs-heads" },
    { file: "PL.07. Other income.xlsx", ref: "PL.07", title: "Other Income", desc: "Working paper for non-operating income, gains on disposal, interest income", fsLines: ["PL-REV-OTH"], isa: "ISA 500", module: "execution-fs-heads" },
    { file: "PL.08. Taxation.xlsx", ref: "PL.08", title: "Taxation", desc: "Working paper for current tax, deferred tax, and tax reconciliation per IAS 12", fsLines: ["PL-TAX"], isa: "ISA 500, ISA 540", module: "execution-fs-heads" },
  ];

  const aeTemplates: TemplateEntry[] = [
    { file: "AE.01. Journal Entry (JE) Testing.xlsx", ref: "AE.01", title: "Journal Entry Testing", desc: "Working paper for fraud-related JE testing per ISA 240", fsLines: [], isa: "ISA 240, ISA 330", module: "execution-substantive" },
    { file: "AE.02. Omitted Liabilities Testing.xlsx", ref: "AE.02", title: "Omitted Liabilities Testing", desc: "Working paper for search for unrecorded liabilities testing", fsLines: [], isa: "ISA 500", module: "execution-substantive" },
    { file: "AE.03. Number of Employees Working.xlsx", ref: "AE.03", title: "Number of Employees", desc: "Working paper for employee count verification and payroll testing", fsLines: [], isa: "ISA 500", module: "execution-substantive" },
    { file: "AE.04. Working Paper for Review of Minutes of Meeting.xlsx", ref: "AE.04", title: "Minutes of Meeting Review", desc: "Working paper for board and shareholder meeting minutes review", fsLines: [], isa: "ISA 500", module: "finalization-completion" },
  ];

  for (const t of bsTemplates) {
    templates.push(buildEntry(t, "WORKING_PAPER", "Balance Sheet", "EXECUTION", WP_SOURCE_ZIP, "execution-fs-heads"));
  }
  for (const t of plTemplates) {
    templates.push(buildEntry(t, "WORKING_PAPER", "Profit & Loss", "EXECUTION", WP_SOURCE_ZIP, "execution-fs-heads"));
  }
  for (const t of aeTemplates) {
    templates.push(buildEntry(t, "WORKING_PAPER", "Audit Evidence", "EXECUTION", WP_SOURCE_ZIP, "execution-substantive"));
  }

  const planningTemplates: TemplateEntry[] = [
    { file: "00. Information and Documents Requisition.xlsx", ref: "PR.00", title: "Information & Documents Requisition", desc: "Standard requisition list for client information requests", module: "data-intake", prefillFields: ["firmName", "clientName", "periodEnd", "periodStart", "engagementPartner"] },
    { file: "01. Main Index.xlsx", ref: "PR.01", title: "Main Index", desc: "Master index of all audit working papers and file sections", module: "evidence-vault", prefillFields: ["firmName", "clientName", "periodEnd"] },
    { file: "02. P.R Audit Planning and Reporting.docx", ref: "PR.02", title: "Audit Planning & Reporting", desc: "Overall audit strategy and planning memorandum per ISA 300", module: "planning", prefill: false },
    { file: "03. P.R. Working for key financial ratios - Annexure-C.xlsx", ref: "PR.03", title: "Key Financial Ratios", desc: "Analytical procedures - key financial ratio calculations per ISA 520", module: "planning-risk", prefillFields: ["firmName", "clientName", "periodEnd", "materiality"] },
    { file: "04. P.R. Audit materiality - Annexure-D.xlsx", ref: "PR.04", title: "Audit Materiality", desc: "Materiality determination and performance materiality per ISA 320", module: "planning-materiality", prefillFields: ["firmName", "clientName", "periodEnd", "materiality", "performanceMateriality"] },
    { file: "05. Internal Controls Evaluation Checklist - Attachment A.docx", ref: "PR.05A", title: "Internal Controls Evaluation (Attachment A)", desc: "Detailed internal controls evaluation questionnaire per ISA 315", module: "planning-risk", prefill: false },
    { file: "05. Internal Controls Evaluation Checklist.xlsx", ref: "PR.05", title: "Internal Controls Evaluation Checklist", desc: "Internal controls testing and evaluation checklist per ISA 315", module: "planning-risk", prefillFields: ["firmName", "clientName", "periodEnd"] },
    { file: "06. Internal Controls Checklist.docx", ref: "PR.06", title: "Internal Controls Checklist", desc: "Summary checklist for internal control assessment", module: "planning-risk", prefill: false },
  ];

  for (const t of planningTemplates) {
    templates.push(buildEntry(t, "PLANNING", "Planning & Risk Assessment", "PLANNING", WP_SOURCE_ZIP, "planning"));
  }

  const reportingTemplates: TemplateEntry[] = [
    { file: "07. Management Letter.docx", ref: "RP.07", title: "Management Letter", desc: "Template for management letter communicating control deficiencies per ISA 265", module: "finalization-reporting", prefill: false },
    { file: "08. Management Representation Letter (MRL).docx", ref: "RP.08", title: "Management Representation Letter", desc: "Written representations from management per ISA 580", module: "finalization-reporting", prefill: false },
    { file: "Engagement Letter (Template).docx", ref: "RP.EL", title: "Engagement Letter", desc: "Standard engagement letter template per ISA 210", module: "engagement-setup", prefill: false },
    { file: "Aqeel Alam & Co. - SSE Model - FS 2023.xlsx", ref: "RP.FS", title: "Model Financial Statements", desc: "Model financial statements template compliant with Companies Act 2017 and IFRS", module: "finalization-reporting", prefillFields: ["firmName", "clientName", "periodEnd", "periodStart"] },
  ];

  for (const t of reportingTemplates) {
    templates.push(buildEntry(t, "REPORTING", "Reports & Letters", "FINALIZATION", WP_SOURCE_ZIP, "finalization-reporting"));
  }

  const confirmationTemplates: TemplateEntry[] = [
    { file: "Bank Confirmation Format (AAC).docx", ref: "CF.BK", title: "Bank Confirmation", desc: "Standard bank balance confirmation format per ISA 505", isa: "ISA 505", module: "execution-confirmations", prefill: false },
    { file: "BS_ Confirmation - Legal Advisor.docx", ref: "CF.LA", title: "Legal Advisor Confirmation", desc: "Confirmation letter for legal advisor regarding litigation and claims", isa: "ISA 505", module: "execution-confirmations", prefill: false },
    { file: "BS_ Confirmation - Tax Advisor.docx", ref: "CF.TA", title: "Tax Advisor Confirmation", desc: "Confirmation letter for tax advisor regarding tax matters", isa: "ISA 505", module: "execution-confirmations", prefill: false },
    { file: "BS_ Other Reserves Confirmations.docx", ref: "CF.OR", title: "Other Reserves Confirmation", desc: "Confirmation letter for other reserves and related party balances", isa: "ISA 505", module: "execution-confirmations", prefill: false },
    { file: "BS_ Payable Confirmations.docx", ref: "CF.AP", title: "Payable Confirmations", desc: "Creditor/vendor balance confirmation letter per ISA 505", isa: "ISA 505", module: "execution-confirmations", prefill: false },
    { file: "BS_ Receivable Confirmations.docx", ref: "CF.AR", title: "Receivable Confirmations", desc: "Debtor balance confirmation letter per ISA 505", isa: "ISA 505", module: "execution-confirmations", prefill: false },
  ];

  for (const t of confirmationTemplates) {
    templates.push(buildEntry(t, "CONFIRMATION", "External Confirmations", "EXECUTION", WP_SOURCE_ZIP, "execution-confirmations"));
  }

  const otherTemplates: TemplateEntry[] = [
    { file: "Certificates (Stock Take & Cash Count).docx", ref: "OT.SC", title: "Stock Take & Cash Count Certificates", desc: "Certificates for physical inventory and cash count observation per ISA 501", module: "execution-substantive", prefill: false },
    { file: "Stock Take and Cash Count Program (Complete).xlsx", ref: "OT.SP", title: "Stock Take & Cash Count Program", desc: "Detailed program for planning and executing inventory observation", module: "execution-substantive", prefillFields: ["firmName", "clientName", "periodEnd"] },
  ];

  for (const t of otherTemplates) {
    templates.push(buildEntry(t, "OTHER", "Other Templates", "EXECUTION", WP_SOURCE_ZIP, "execution-substantive"));
  }

  return templates;
}

function buildIsqmCatalog(): TemplateMeta[] {
  const templates: TemplateMeta[] = [];

  const isqmDocs: TemplateEntry[] = [
    { file: "Firm's Policies - ISQM v.8.docx", ref: "ISQM-POL", title: "Firm Quality Management Policies", desc: "Complete ISQM 1 firm-level quality management policies document (Version 8)", sub: "Policies", module: "isqm-governance", prefill: false },
    { file: "ISQM - Forms.xlsx", ref: "ISQM-FRM", title: "ISQM Forms Workbook", desc: "Collection of all ISQM-related forms and checklists for quality management", sub: "Forms", module: "isqm-governance", prefillFields: ["firmName"] },
    { file: "ISQM-13. Trainee Admission Form.docx", ref: "ISQM-13", title: "Trainee Admission Form", desc: "Form for admitting trainees into the firm - HR component of ISQM 1", sub: "HR & Resources", module: "isqm-resources", prefill: false },
    { file: "ISQM-14. Candidate Evaluation form.docx", ref: "ISQM-14", title: "Candidate Evaluation Form", desc: "Form for evaluating candidates during recruitment per ISQM 1 resources component", sub: "HR & Resources", module: "isqm-resources", prefill: false },
    { file: "ISQM-15. Appointment Letter.docx", ref: "ISQM-15", title: "Appointment Letter", desc: "Standard appointment letter template for firm staff per ISQM 1", sub: "HR & Resources", module: "isqm-resources", prefill: false },
    { file: "ISQM-17. Expereince Letter.docx", ref: "ISQM-17", title: "Experience Letter", desc: "Experience/service certificate template for departing staff", sub: "HR & Resources", module: "isqm-resources", prefill: false },
    { file: "ISQM-20. Annual Survey form.docx", ref: "ISQM-20", title: "Annual Survey Form", desc: "Annual quality management survey for staff feedback per ISQM 1", sub: "Monitoring", module: "isqm-monitoring", prefill: false },
    { file: "ISQM-21. Performance Feedback from Leadership.docx", ref: "ISQM-21", title: "Performance Feedback from Leadership", desc: "Leadership performance feedback form for quality management monitoring", sub: "Monitoring", module: "isqm-monitoring", prefill: false },
  ];

  for (const t of isqmDocs) {
    templates.push({
      ...buildEntry(t, "ISQM", t.sub || "General", "FIRM_WIDE", ISQM_SOURCE_ZIP, t.module || "isqm-governance"),
      isaParagraph: "ISQM 1",
    });
  }

  const isqmReference: TemplateEntry[] = [
    { file: "IAASB-Quality-Management-ISQM-1-Quality-Management-for-Firms.pdf", ref: "REF-ISQM1", title: "ISQM 1 Standard (Full Text)", desc: "IAASB ISQM 1 - Quality Management for Firms that Perform Audits", sub: "Standards", module: "isqm-governance" },
    { file: "IAASB-Quality-Management-ISQM-2-Engagement-Quality-Reviews.pdf", ref: "REF-ISQM2", title: "ISQM 2 Standard (Full Text)", desc: "IAASB ISQM 2 - Engagement Quality Reviews", sub: "Standards", module: "isqm-eqcr" },
    { file: "IAASB-ISQM-1-Basis-for-Conclusions.pdf", ref: "REF-BFC1", title: "ISQM 1 Basis for Conclusions", desc: "Basis for conclusions on ISQM 1 quality management standard", sub: "Reference", module: "isqm-governance" },
    { file: "IAASB-Quality-Management-ISQM-2-Basis-for-Conclusions.pdf", ref: "REF-BFC2", title: "ISQM 2 Basis for Conclusions", desc: "Basis for conclusions on ISQM 2 engagement quality reviews", sub: "Reference", module: "isqm-eqcr" },
    { file: "IAASB-ISQM-1-Fact-Sheet.pdf", ref: "REF-FS1", title: "ISQM 1 Fact Sheet", desc: "Quick reference fact sheet for ISQM 1 requirements", sub: "Reference", module: "isqm-governance" },
    { file: "IAASB-ISQM-2-Fact-sheet.pdf", ref: "REF-FS2", title: "ISQM 2 Fact Sheet", desc: "Quick reference fact sheet for ISQM 2 requirements", sub: "Reference", module: "isqm-eqcr" },
    { file: "IAASB-ISQM-1-first-time-implementation-guide-quality-management_0.pdf", ref: "REF-IG1", title: "ISQM 1 Implementation Guide", desc: "First-time implementation guide for ISQM 1 quality management", sub: "Implementation", module: "isqm-governance" },
    { file: "IAASB-ISQM-2-first-time-implementation-guide-quality-management.pdf", ref: "REF-IG2", title: "ISQM 2 Implementation Guide", desc: "First-time implementation guide for ISQM 2 engagement quality reviews", sub: "Implementation", module: "isqm-eqcr" },
    { file: "IAASB-quality-management-conforming-amendments (1).pdf", ref: "REF-CA1", title: "Conforming Amendments (Part 1)", desc: "Conforming and consequential amendments from quality management standards", sub: "Reference", module: "isqm-governance" },
    { file: "IAASB-quality-management-conforming-amendments.pdf", ref: "REF-CA2", title: "Conforming Amendments (Part 2)", desc: "Additional conforming amendments from quality management standards", sub: "Reference", module: "isqm-governance" },
    { file: "ISQM-guide-and-toolkit.pdf", ref: "REF-GTK", title: "ISQM Guide & Toolkit", desc: "Comprehensive guide and toolkit for ISQM implementation", sub: "Implementation", module: "isqm-governance" },
  ];

  for (const t of isqmReference) {
    templates.push({
      ...buildEntry(t, "ISQM_REFERENCE", t.sub || "General", "FIRM_WIDE", ISQM_SOURCE_ZIP, t.module || "isqm-governance"),
      prefillCapable: false,
      prefillFields: [],
    });
  }

  return templates;
}

function buildGeneratedTemplates(): TemplateMeta[] {
  return [
    {
      id: "gen-completion-checklist",
      fileName: "__GENERATED__",
      category: "COMPLETION",
      subCategory: "Audit Completion",
      reference: "CL.01",
      title: "Audit Completion Checklist",
      description: "Comprehensive audit completion checklist covering ISA 220, ISA 450, ISA 560, ISA 570, ISA 580 requirements",
      fileType: "xlsx",
      phase: "FINALIZATION",
      fsLineItems: [],
      isaParagraph: "ISA 220, ISA 450, ISA 560",
      sourceZip: "GENERATED",
      linkedModule: "finalization-completion",
      prefillCapable: true,
      prefillFields: ["firmName", "clientName", "periodEnd", "periodStart", "engagementPartner", "teamMembers", "materiality"],
    },
    {
      id: "gen-sampling-worksheet",
      fileName: "__GENERATED__",
      category: "WORKING_PAPER",
      subCategory: "Audit Evidence",
      reference: "AE.05",
      title: "Audit Sampling Worksheet",
      description: "Statistical and non-statistical sampling worksheet per ISA 530 for substantive and controls testing",
      fileType: "xlsx",
      phase: "EXECUTION",
      fsLineItems: [],
      isaParagraph: "ISA 530",
      sourceZip: "GENERATED",
      linkedModule: "execution-substantive",
      prefillCapable: true,
      prefillFields: ["firmName", "clientName", "periodEnd", "materiality", "performanceMateriality"],
    },
  ];
}

let cachedCatalog: TemplateMeta[] | null = null;

function getCatalog(): TemplateMeta[] {
  if (!cachedCatalog) {
    cachedCatalog = [...buildWorkingPaperCatalog(), ...buildIsqmCatalog(), ...buildGeneratedTemplates()];
  }
  return cachedCatalog;
}

router.get("/catalog", requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const catalog = getCatalog();
    const { category, subCategory, phase, search, fileType, linkedModule } = req.query;

    let filtered = catalog;

    if (category && typeof category === "string") {
      filtered = filtered.filter(t => t.category === category);
    }
    if (subCategory && typeof subCategory === "string") {
      filtered = filtered.filter(t => t.subCategory === subCategory);
    }
    if (phase && typeof phase === "string") {
      filtered = filtered.filter(t => t.phase === phase);
    }
    if (fileType && typeof fileType === "string") {
      filtered = filtered.filter(t => t.fileType === fileType);
    }
    if (linkedModule && typeof linkedModule === "string") {
      filtered = filtered.filter(t => t.linkedModule === linkedModule);
    }
    if (search && typeof search === "string") {
      const term = search.toLowerCase();
      filtered = filtered.filter(t =>
        t.title.toLowerCase().includes(term) ||
        t.description.toLowerCase().includes(term) ||
        t.reference.toLowerCase().includes(term)
      );
    }

    const categories = [...new Set(catalog.map(t => t.category))];
    const subCategories = [...new Set(catalog.map(t => t.subCategory))];
    const modules = [...new Set(catalog.map(t => t.linkedModule))];

    res.json({
      templates: filtered,
      meta: {
        totalTemplates: catalog.length,
        filteredCount: filtered.length,
        categories,
        subCategories,
        modules,
      },
    });
  } catch (error) {
    console.error("Template catalog error:", error);
    res.status(500).json({ error: "Failed to load template catalog" });
  }
});

router.get("/by-module/:module", requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const catalog = getCatalog();
    const moduleName = req.params.module;
    const templates = catalog.filter(t => t.linkedModule === moduleName);
    res.json({ module: moduleName, templates, count: templates.length });
  } catch (error) {
    console.error("Module templates error:", error);
    res.status(500).json({ error: "Failed to fetch module templates" });
  }
});

router.get("/by-phase/:phase", requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const catalog = getCatalog();
    const phaseName = req.params.phase;
    const templates = catalog.filter(t => t.phase === phaseName);
    const byModule: Record<string, TemplateMeta[]> = {};
    for (const t of templates) {
      if (!byModule[t.linkedModule]) byModule[t.linkedModule] = [];
      byModule[t.linkedModule].push(t);
    }
    res.json({ phase: phaseName, templates, byModule, count: templates.length });
  } catch (error) {
    console.error("Phase templates error:", error);
    res.status(500).json({ error: "Failed to fetch phase templates" });
  }
});

router.get("/preview/:templateId", requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const catalog = getCatalog();
    const template = catalog.find(t => t.id === req.params.templateId);
    if (!template) {
      return res.status(404).json({ error: "Template not found" });
    }

    if (template.fileName === "__GENERATED__") {
      return res.json({
        template,
        preview: {
          type: "generated",
          description: template.description,
          sheets: template.id === "gen-completion-checklist"
            ? ["Completion Checklist", "Partner Review", "Filing Checklist"]
            : ["Sampling Plan", "Sample Selection", "Results Evaluation"],
          prefillFields: template.prefillFields,
        },
      });
    }

    const isIsqm = template.category === "ISQM" || template.category === "ISQM_REFERENCE";
    const dir = isIsqm ? ISQM_DIR : WORKING_PAPERS_DIR;
    const filePath = path.resolve(dir, template.fileName);

    if (!filePath.startsWith(path.resolve(dir))) {
      return res.status(403).json({ error: "Access denied" });
    }

    const stat = fs.existsSync(filePath) ? fs.statSync(filePath) : null;

    res.json({
      template,
      preview: {
        type: "file",
        fileSize: stat ? stat.size : 0,
        lastModified: stat ? stat.mtime.toISOString() : null,
        prefillFields: template.prefillFields,
        prefillCapable: template.prefillCapable,
        linkedModule: template.linkedModule,
        sourceZip: template.sourceZip,
      },
    });
  } catch (error) {
    console.error("Template preview error:", error);
    res.status(500).json({ error: "Failed to preview template" });
  }
});

async function generateCompletionChecklist(prefillData: Record<string, string>): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "AuditWise";
  wb.created = new Date();

  const ws = wb.addWorksheet("Completion Checklist", { properties: { tabColor: { argb: "FF1E40AF" } } });

  ws.getColumn(1).width = 8;
  ws.getColumn(2).width = 60;
  ws.getColumn(3).width = 15;
  ws.getColumn(4).width = 15;
  ws.getColumn(5).width = 30;

  let row = 1;
  ws.getCell(`A${row}`).value = prefillData.firmName || "Firm Name";
  ws.getCell(`A${row}`).font = { bold: true, size: 14, color: { argb: "FF1E40AF" } };
  ws.mergeCells(`A${row}:E${row}`);
  row++;
  ws.getCell(`A${row}`).value = `Audit Completion Checklist - ${prefillData.clientName || "Client Name"}`;
  ws.getCell(`A${row}`).font = { bold: true, size: 12 };
  ws.mergeCells(`A${row}:E${row}`);
  row++;
  ws.getCell(`A${row}`).value = `Period Ending: ${prefillData.periodEnd || "____"}`;
  ws.getCell(`A${row}`).font = { size: 11 };
  ws.mergeCells(`A${row}:E${row}`);
  row += 2;

  const headerRow = ws.getRow(row);
  ["Sr.", "Description / Requirement", "Done (Y/N)", "Initials", "Remarks"].forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E40AF" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
  });
  row++;

  const checklistItems = [
    "All working papers have been completed and cross-referenced (ISA 230)",
    "Uncorrected misstatements summarized and evaluated (ISA 450)",
    "All review notes cleared by engagement team",
    "Going concern assessment completed (ISA 570)",
    "Subsequent events review performed up to report date (ISA 560)",
    "Management representation letter obtained (ISA 580)",
    "Related party transactions identified and disclosed (ISA 550)",
    "Analytical procedures performed at overall conclusion stage (ISA 520)",
    "Engagement quality control review completed (ISQM 2)",
    "Audit opinion formed and draft report prepared (ISA 700/705/706)",
    "Communication with those charged with governance completed (ISA 260)",
    "Internal control deficiencies communicated (ISA 265)",
    "Independence confirmed throughout engagement",
    "Engagement file assembled within 60 days (ISA 230)",
    "All regulatory filings and deadlines verified",
    "Partner sign-off obtained on final audit file",
  ];

  checklistItems.forEach((item, idx) => {
    const dataRow = ws.getRow(row);
    dataRow.getCell(1).value = idx + 1;
    dataRow.getCell(2).value = item;
    dataRow.getCell(3).value = "";
    dataRow.getCell(4).value = "";
    dataRow.getCell(5).value = "";
    for (let c = 1; c <= 5; c++) {
      dataRow.getCell(c).border = { top: { style: "thin", color: { argb: "FFE0E0E0" } }, bottom: { style: "thin", color: { argb: "FFE0E0E0" } }, left: { style: "thin", color: { argb: "FFE0E0E0" } }, right: { style: "thin", color: { argb: "FFE0E0E0" } } };
    }
    row++;
  });

  const partnerWs = wb.addWorksheet("Partner Review", { properties: { tabColor: { argb: "FF7C3AED" } } });
  partnerWs.getColumn(1).width = 8;
  partnerWs.getColumn(2).width = 50;
  partnerWs.getColumn(3).width = 20;
  partnerWs.getColumn(4).width = 30;

  partnerWs.getCell("A1").value = "Partner Review Sign-Off";
  partnerWs.getCell("A1").font = { bold: true, size: 14 };
  partnerWs.mergeCells("A1:D1");

  partnerWs.getCell("A3").value = `Client: ${prefillData.clientName || "____"}`;
  partnerWs.getCell("A4").value = `Period: ${prefillData.periodEnd || "____"}`;
  partnerWs.getCell("A5").value = `Partner: ${prefillData.engagementPartner || "____"}`;
  partnerWs.getCell("A6").value = `Materiality: ${prefillData.materiality || "____"}`;

  const filingWs = wb.addWorksheet("Filing Checklist", { properties: { tabColor: { argb: "FF059669" } } });
  filingWs.getColumn(1).width = 8;
  filingWs.getColumn(2).width = 50;
  filingWs.getColumn(3).width = 15;
  filingWs.getColumn(4).width = 20;

  filingWs.getCell("A1").value = "Audit File Assembly & Filing Checklist";
  filingWs.getCell("A1").font = { bold: true, size: 14 };
  filingWs.mergeCells("A1:D1");

  const arrayBuffer = await wb.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

async function generateSamplingWorksheet(prefillData: Record<string, string>): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "AuditWise";
  wb.created = new Date();

  const ws = wb.addWorksheet("Sampling Plan", { properties: { tabColor: { argb: "FFEA580C" } } });

  ws.getColumn(1).width = 25;
  ws.getColumn(2).width = 40;
  ws.getColumn(3).width = 20;

  ws.getCell("A1").value = prefillData.firmName || "Firm Name";
  ws.getCell("A1").font = { bold: true, size: 14, color: { argb: "FF1E40AF" } };
  ws.mergeCells("A1:C1");

  ws.getCell("A2").value = `Audit Sampling Worksheet - ${prefillData.clientName || "Client Name"}`;
  ws.getCell("A2").font = { bold: true, size: 12 };
  ws.mergeCells("A2:C2");

  ws.getCell("A3").value = `Period Ending: ${prefillData.periodEnd || "____"}`;
  ws.mergeCells("A3:C3");

  const fields = [
    ["Objective of Test", ""],
    ["Population Description", ""],
    ["Population Size (N)", ""],
    ["Population Value", ""],
    ["Sampling Method", "Statistical / Non-Statistical"],
    ["Materiality", prefillData.materiality || ""],
    ["Performance Materiality", prefillData.performanceMateriality || ""],
    ["Tolerable Misstatement", ""],
    ["Expected Misstatement", ""],
    ["Confidence Level", ""],
    ["Sample Size (n)", ""],
    ["Selection Method", "Random / Systematic / MUS"],
    ["Prepared By", ""],
    ["Reviewed By", ""],
    ["Date", ""],
  ];

  let row = 5;
  fields.forEach(([label, val]) => {
    ws.getCell(`A${row}`).value = label;
    ws.getCell(`A${row}`).font = { bold: true };
    ws.getCell(`B${row}`).value = val;
    for (let c = 1; c <= 2; c++) {
      ws.getCell(`${String.fromCharCode(64 + c)}${row}`).border = {
        top: { style: "thin", color: { argb: "FFE0E0E0" } },
        bottom: { style: "thin", color: { argb: "FFE0E0E0" } },
        left: { style: "thin", color: { argb: "FFE0E0E0" } },
        right: { style: "thin", color: { argb: "FFE0E0E0" } },
      };
    }
    row++;
  });

  const selWs = wb.addWorksheet("Sample Selection", { properties: { tabColor: { argb: "FF059669" } } });
  selWs.getColumn(1).width = 8;
  selWs.getColumn(2).width = 20;
  selWs.getColumn(3).width = 30;
  selWs.getColumn(4).width = 20;
  selWs.getColumn(5).width = 20;
  selWs.getColumn(6).width = 30;

  const selHeader = selWs.getRow(1);
  ["Sr.", "Item Reference", "Description", "Amount", "Audited Amount", "Result / Remarks"].forEach((h, i) => {
    const cell = selHeader.getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF059669" } };
    cell.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
  });

  const evalWs = wb.addWorksheet("Results Evaluation", { properties: { tabColor: { argb: "FF7C3AED" } } });
  evalWs.getColumn(1).width = 30;
  evalWs.getColumn(2).width = 50;

  evalWs.getCell("A1").value = "Sampling Results Evaluation";
  evalWs.getCell("A1").font = { bold: true, size: 14 };
  evalWs.mergeCells("A1:B1");

  const evalFields = [
    "Total Misstatements Found",
    "Total Misstatement Amount",
    "Projected Misstatement",
    "Is Projected Misstatement < Tolerable?",
    "Conclusion",
    "Additional Procedures Required?",
  ];
  evalFields.forEach((f, i) => {
    evalWs.getCell(`A${i + 3}`).value = f;
    evalWs.getCell(`A${i + 3}`).font = { bold: true };
  });

  const arrayBuffer = await wb.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

router.get("/download/:templateId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const catalog = getCatalog();
    const template = catalog.find(t => t.id === req.params.templateId);
    if (!template) {
      return res.status(404).json({ error: "Template not found" });
    }

    if (template.fileName === "__GENERATED__") {
      const prefillData: Record<string, string> = {};
      if (req.query.firmName) prefillData.firmName = String(req.query.firmName);
      if (req.query.clientName) prefillData.clientName = String(req.query.clientName);
      if (req.query.periodEnd) prefillData.periodEnd = String(req.query.periodEnd);
      if (req.query.periodStart) prefillData.periodStart = String(req.query.periodStart);
      if (req.query.engagementPartner) prefillData.engagementPartner = String(req.query.engagementPartner);
      if (req.query.materiality) prefillData.materiality = String(req.query.materiality);
      if (req.query.performanceMateriality) prefillData.performanceMateriality = String(req.query.performanceMateriality);

      let buffer: Buffer;
      let fileName: string;
      if (template.id === "gen-completion-checklist") {
        buffer = await generateCompletionChecklist(prefillData);
        fileName = "AuditWise_Completion_Checklist.xlsx";
      } else {
        buffer = await generateSamplingWorksheet(prefillData);
        fileName = "AuditWise_Sampling_Worksheet.xlsx";
      }

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
      res.setHeader("Content-Length", buffer.length);
      res.send(buffer);
      return;
    }

    const isIsqm = template.category === "ISQM" || template.category === "ISQM_REFERENCE";
    const dir = isIsqm ? ISQM_DIR : WORKING_PAPERS_DIR;
    const filePath = path.resolve(dir, template.fileName);

    if (!filePath.startsWith(path.resolve(dir))) {
      return res.status(403).json({ error: "Access denied" });
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Template file not found on disk" });
    }

    const mimeTypes: Record<string, string> = {
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      pdf: "application/pdf",
    };

    const mime = mimeTypes[template.fileType] || "application/octet-stream";
    const stat = fs.statSync(filePath);

    res.setHeader("Content-Type", mime);
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(template.fileName)}"`);
    res.setHeader("Content-Length", stat.size);

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  } catch (error) {
    console.error("Template download error:", error);
    res.status(500).json({ error: "Failed to download template" });
  }
});

router.get("/download-prefilled/:templateId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const catalog = getCatalog();
    const template = catalog.find(t => t.id === req.params.templateId);
    if (!template) {
      return res.status(404).json({ error: "Template not found" });
    }

    if (!template.prefillCapable) {
      return res.status(400).json({ error: "Template does not support prefill" });
    }

    const engagementId = req.query.engagementId as string | undefined;

    let prefillData: Record<string, string> = {};

    if (engagementId) {
      const engagement = await prisma.engagement.findFirst({
        where: { id: engagementId, firmId: req.user!.firmId },
        include: {
          client: { select: { legalName: true } },
          firm: { select: { firmName: true } },
        },
      });

      if (engagement) {
        prefillData.firmName = engagement.firm?.firmName || "";
        prefillData.clientName = engagement.client?.legalName || "";
        prefillData.periodEnd = engagement.periodEnd ? new Date(engagement.periodEnd).toLocaleDateString("en-GB") : "";
        prefillData.periodStart = engagement.periodStart ? new Date(engagement.periodStart).toLocaleDateString("en-GB") : "";

        if (engagement.engagementPartnerId) {
          const partner = await prisma.user.findUnique({
            where: { id: engagement.engagementPartnerId },
            select: { fullName: true },
          });
          prefillData.engagementPartner = partner?.fullName || "";
        }

        const materiality = await prisma.materialityCalculation.findFirst({
          where: { engagementId },
          orderBy: { createdAt: "desc" },
        });
        if (materiality) {
          prefillData.materiality = String(materiality.overallMateriality || "");
          prefillData.performanceMateriality = String(materiality.performanceMateriality || "");
        }
      }
    }

    for (const key of Object.keys(req.query)) {
      if (key !== "engagementId" && typeof req.query[key] === "string") {
        prefillData[key] = req.query[key] as string;
      }
    }

    if (template.fileName === "__GENERATED__") {
      let buffer: Buffer;
      let fileName: string;
      if (template.id === "gen-completion-checklist") {
        buffer = await generateCompletionChecklist(prefillData);
        fileName = `Completion_Checklist_${prefillData.clientName || "Template"}.xlsx`;
      } else {
        buffer = await generateSamplingWorksheet(prefillData);
        fileName = `Sampling_Worksheet_${prefillData.clientName || "Template"}.xlsx`;
      }

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(fileName)}"`);
      res.setHeader("Content-Length", buffer.length);
      res.send(buffer);
      return;
    }

    const isIsqm = template.category === "ISQM" || template.category === "ISQM_REFERENCE";
    const dir = isIsqm ? ISQM_DIR : WORKING_PAPERS_DIR;
    const filePath = path.resolve(dir, template.fileName);

    if (!filePath.startsWith(path.resolve(dir))) {
      return res.status(403).json({ error: "Access denied" });
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Template file not found on disk" });
    }

    if (template.fileType === "xlsx" && Object.keys(prefillData).length > 0) {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.readFile(filePath);

      wb.eachSheet((sheet) => {
        sheet.eachRow((row) => {
          row.eachCell((cell) => {
            if (typeof cell.value === "string") {
              let val = cell.value;
              for (const [key, replacement] of Object.entries(prefillData)) {
                val = val.replace(new RegExp(`\\{\\{${key}\\}\\}`, "gi"), replacement);
                val = val.replace(new RegExp(`\\$\\{${key}\\}`, "gi"), replacement);
              }
              if (val !== cell.value) {
                cell.value = val;
              }
            }
          });
        });
      });

      const arrayBuffer = await wb.xlsx.writeBuffer();
      const buffer = Buffer.from(arrayBuffer);

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      const pfName = prefillData.clientName
        ? `${template.reference}_${prefillData.clientName}.xlsx`
        : template.fileName;
      res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(pfName)}"`);
      res.setHeader("Content-Length", buffer.length);
      res.send(buffer);
      return;
    }

    const stat = fs.statSync(filePath);
    const mimeTypes: Record<string, string> = {
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      pdf: "application/pdf",
    };
    const mime = mimeTypes[template.fileType] || "application/octet-stream";
    res.setHeader("Content-Type", mime);
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(template.fileName)}"`);
    res.setHeader("Content-Length", stat.size);
    fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    console.error("Prefill download error:", error);
    res.status(500).json({ error: "Failed to download prefilled template" });
  }
});

router.get("/register", requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const catalog = getCatalog();

    const register = catalog.map(t => ({
      id: t.id,
      fileName: t.fileName,
      reference: t.reference,
      title: t.title,
      description: t.description,
      category: t.category,
      subCategory: t.subCategory,
      phase: t.phase,
      fileType: t.fileType,
      sourceZip: t.sourceZip,
      linkedModule: t.linkedModule,
      prefillCapable: t.prefillCapable,
      prefillFields: t.prefillFields,
      fsLineItems: t.fsLineItems,
      isaParagraph: t.isaParagraph,
      isGenerated: t.fileName === "__GENERATED__",
    }));

    const byModule: Record<string, number> = {};
    const byPhase: Record<string, number> = {};
    const bySource: Record<string, number> = {};
    for (const t of register) {
      byModule[t.linkedModule] = (byModule[t.linkedModule] || 0) + 1;
      byPhase[t.phase] = (byPhase[t.phase] || 0) + 1;
      bySource[t.sourceZip] = (bySource[t.sourceZip] || 0) + 1;
    }

    res.json({
      register,
      summary: {
        total: register.length,
        prefillCapable: register.filter(r => r.prefillCapable).length,
        generated: register.filter(r => r.isGenerated).length,
        fromZip: register.filter(r => !r.isGenerated).length,
        byModule,
        byPhase,
        bySource,
      },
    });
  } catch (error) {
    console.error("Template register error:", error);
    res.status(500).json({ error: "Failed to load template register" });
  }
});

router.get("/stats", requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const catalog = getCatalog();

    const byCategory: Record<string, number> = {};
    const byPhase: Record<string, number> = {};
    const byFileType: Record<string, number> = {};
    const byModule: Record<string, number> = {};

    for (const t of catalog) {
      byCategory[t.category] = (byCategory[t.category] || 0) + 1;
      byPhase[t.phase] = (byPhase[t.phase] || 0) + 1;
      byFileType[t.fileType] = (byFileType[t.fileType] || 0) + 1;
      byModule[t.linkedModule] = (byModule[t.linkedModule] || 0) + 1;
    }

    res.json({
      total: catalog.length,
      byCategory,
      byPhase,
      byFileType,
      byModule,
      prefillCapable: catalog.filter(t => t.prefillCapable).length,
      extractionNotes: {
        workingPapersExtracted: 57,
        isqmExtracted: 19,
        generated: 2,
        missingFromSequence: ["BS.03 (Right-of-Use Assets)", "BS.20 (Deferred Revenue)", "BS.21 (Provisions)"],
        missingReason: "Not present in source ZIP - firm-specific template set does not include these BS references",
      },
    });
  } catch (error) {
    console.error("Template stats error:", error);
    res.status(500).json({ error: "Failed to load template stats" });
  }
});

export default router;
