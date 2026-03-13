import { Router, Response } from "express";
import { requireAuth, AuthenticatedRequest } from "./auth";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

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
}

const WORKING_PAPERS_DIR = path.join(__dirname_local, "template-vault", "working-papers");
const ISQM_DIR = path.join(__dirname_local, "template-vault", "isqm");

function buildWorkingPaperCatalog(): TemplateMeta[] {
  const templates: TemplateMeta[] = [];

  const bsTemplates: Array<{ file: string; ref: string; title: string; desc: string; fsLines: string[]; isa: string }> = [
    { file: "BS.01. Property, plant and equipment.xlsx", ref: "BS.01", title: "Property, Plant & Equipment", desc: "Working paper for PPE additions, disposals, depreciation, and impairment testing per IAS 16", fsLines: ["BS-NCA-PPE"], isa: "ISA 500, ISA 540" },
    { file: "BS.02. Intangble assets.xlsx", ref: "BS.02", title: "Intangible Assets", desc: "Working paper for intangible assets amortization and impairment per IAS 38", fsLines: ["BS-NCA-INTANG"], isa: "ISA 500, ISA 540" },
    { file: "BS.04. Long term investments.xlsx", ref: "BS.04", title: "Long Term Investments", desc: "Working paper for long-term investments valuation and classification per IFRS 9", fsLines: ["BS-NCA-LTI"], isa: "ISA 500, ISA 540" },
    { file: "BS.05. Long term loans and advances.xlsx", ref: "BS.05", title: "Long Term Loans & Advances", desc: "Working paper for long-term receivables and ECL assessment", fsLines: ["BS-NCA-LTLA"], isa: "ISA 500, ISA 540" },
    { file: "BS.06. Long term deposits.xlsx", ref: "BS.06", title: "Long Term Deposits", desc: "Working paper for long-term deposits and security deposits verification", fsLines: ["BS-NCA-LTD"], isa: "ISA 500" },
    { file: "BS.07. Stores, spares and loose tools.xlsx", ref: "BS.07", title: "Stores, Spares & Loose Tools", desc: "Working paper for stores and spares valuation per IAS 2", fsLines: ["BS-CA-INV"], isa: "ISA 501" },
    { file: "BS.08. Stock in trade.xlsx", ref: "BS.08", title: "Stock in Trade", desc: "Working paper for inventory valuation, NRV testing, and stock take observation per IAS 2", fsLines: ["BS-CA-INV"], isa: "ISA 501" },
    { file: "BS.09. Trade debts (Receivables).xlsx", ref: "BS.09", title: "Trade Debts (Receivables)", desc: "Working paper for trade receivables, aging, and ECL provision per IFRS 9", fsLines: ["BS-CA-AR"], isa: "ISA 500, ISA 505" },
    { file: "BS.10. Short term loans and advances.xlsx", ref: "BS.10", title: "Short Term Loans & Advances", desc: "Working paper for short-term loans, advances to employees and suppliers", fsLines: ["BS-CA-OTH"], isa: "ISA 500" },
    { file: "BS.11. Trade deposits and short term prepayments..xlsx", ref: "BS.11", title: "Trade Deposits & Prepayments", desc: "Working paper for trade deposits and short-term prepayments verification", fsLines: ["BS-CA-OTH"], isa: "ISA 500" },
    { file: "BS.12. Other receivables.xlsx", ref: "BS.12", title: "Other Receivables", desc: "Working paper for other receivables including related party balances", fsLines: ["BS-CA-OTH"], isa: "ISA 500, ISA 550" },
    { file: "BS.13. Other financial assets.xlsx", ref: "BS.13", title: "Other Financial Assets", desc: "Working paper for short-term investments and financial assets per IFRS 9", fsLines: ["BS-CA-OTH"], isa: "ISA 500, ISA 540" },
    { file: "BS.14. Tax refund due from government.xlsx", ref: "BS.14", title: "Tax Refunds Due from Government", desc: "Working paper for income tax, sales tax, and withholding tax refunds", fsLines: ["BS-CA-OTH"], isa: "ISA 500" },
    { file: "BS.15. Cash and bank balance.xlsx", ref: "BS.15", title: "Cash & Bank Balances", desc: "Working paper for cash count, bank reconciliations, and bank confirmations", fsLines: ["BS-CA-CASH"], isa: "ISA 500, ISA 505" },
    { file: "BS.16. Share capital and reserves.xlsx", ref: "BS.16", title: "Share Capital & Reserves", desc: "Working paper for equity, share capital movements, and reserve analysis", fsLines: ["BS-EQ-SC"], isa: "ISA 500" },
    { file: "BS.17. Long term financing - Banking and other financial institutions.xlsx", ref: "BS.17", title: "Long Term Financing (Banks)", desc: "Working paper for bank borrowings, covenants review per IFRS 9", fsLines: ["BS-NCL-LTL"], isa: "ISA 500, ISA 505" },
    { file: "BS.18. Long term financing - Related parties.xlsx", ref: "BS.18", title: "Long Term Financing (Related Parties)", desc: "Working paper for related party financing and IAS 24 disclosures", fsLines: ["BS-NCL-LTL"], isa: "ISA 500, ISA 550" },
    { file: "BS.19. Liabilities against assets subject to finance lease.xlsx", ref: "BS.19", title: "Lease Liabilities", desc: "Working paper for IFRS 16 lease liabilities and right-of-use assets", fsLines: ["BS-NCL-LTL"], isa: "ISA 500, ISA 540" },
    { file: "BS.22. Long term deposits - Liabilities.xlsx", ref: "BS.22", title: "Long Term Deposits (Liabilities)", desc: "Working paper for security deposits received from customers/tenants", fsLines: ["BS-NCL-LTL"], isa: "ISA 500" },
    { file: "BS.23. Staff Retirement Benefits.xlsx", ref: "BS.23", title: "Staff Retirement Benefits", desc: "Working paper for gratuity, pension, and provident fund per IAS 19", fsLines: ["BS-NCL-LTL"], isa: "ISA 500, ISA 540" },
    { file: "BS.24. Deferred Taxation.xlsx", ref: "BS.24", title: "Deferred Taxation", desc: "Working paper for deferred tax asset/liability per IAS 12", fsLines: ["BS-NCL-LTL"], isa: "ISA 500, ISA 540" },
    { file: "BS.25. Trade and other payables.xlsx", ref: "BS.25", title: "Trade & Other Payables", desc: "Working paper for trade payables, accruals, and other creditors", fsLines: ["BS-CL-AP"], isa: "ISA 500, ISA 505" },
    { file: "BS.26. Short term borrowings.xlsx", ref: "BS.26", title: "Short Term Borrowings", desc: "Working paper for running finance, short-term loans, and overdrafts", fsLines: ["BS-CL-STB"], isa: "ISA 500, ISA 505" },
    { file: "BS.27. Assets classified as held for sale.xlsx", ref: "BS.27", title: "Assets Held for Sale", desc: "Working paper for discontinued operations and assets held for sale per IFRS 5", fsLines: ["BS-CA-OTH"], isa: "ISA 500" },
    { file: "BS.28. Contingencies and Commitments.xlsx", ref: "BS.28", title: "Contingencies & Commitments", desc: "Working paper for contingent liabilities and commitments per IAS 37", fsLines: ["BS-CL-AP"], isa: "ISA 500, ISA 501" },
  ];

  const plTemplates: Array<{ file: string; ref: string; title: string; desc: string; fsLines: string[]; isa: string }> = [
    { file: "PL.01. Sales and services.xlsx", ref: "PL.01", title: "Sales & Services Revenue", desc: "Working paper for revenue recognition testing per IFRS 15", fsLines: ["PL-REV-SALE"], isa: "ISA 500, ISA 520" },
    { file: "PL.02. Cost of sales.xlsx", ref: "PL.02", title: "Cost of Sales", desc: "Working paper for cost of goods sold, manufacturing costs per IAS 2", fsLines: ["PL-EXP-COGS"], isa: "ISA 500" },
    { file: "PL.03. Distribution cost.xlsx", ref: "PL.03", title: "Distribution Cost", desc: "Working paper for selling and distribution expenses testing", fsLines: ["PL-EXP-MKT"], isa: "ISA 500" },
    { file: "PL.04. Administrative expenses.xlsx", ref: "PL.04", title: "Administrative Expenses", desc: "Working paper for admin expenses analytical review and vouching", fsLines: ["PL-EXP-ADMIN"], isa: "ISA 500, ISA 520" },
    { file: "PL.05. Other Operating Expenses.xlsx", ref: "PL.05", title: "Other Operating Expenses", desc: "Working paper for other operating charges and provisions", fsLines: ["PL-EXP-ADMIN"], isa: "ISA 500" },
    { file: "PL.06. Finance cost.xlsx", ref: "PL.06", title: "Finance Cost", desc: "Working paper for interest expense, bank charges, and IFRS 16 interest", fsLines: ["PL-EXP-FIN"], isa: "ISA 500" },
    { file: "PL.07. Other income.xlsx", ref: "PL.07", title: "Other Income", desc: "Working paper for non-operating income, gains on disposal, interest income", fsLines: ["PL-REV-OTH"], isa: "ISA 500" },
    { file: "PL.08. Taxation.xlsx", ref: "PL.08", title: "Taxation", desc: "Working paper for current tax, deferred tax, and tax reconciliation per IAS 12", fsLines: ["PL-TAX"], isa: "ISA 500, ISA 540" },
  ];

  const aeTemplates: Array<{ file: string; ref: string; title: string; desc: string; fsLines: string[]; isa: string }> = [
    { file: "AE.01. Journal Entry (JE) Testing.xlsx", ref: "AE.01", title: "Journal Entry Testing", desc: "Working paper for fraud-related JE testing per ISA 240", fsLines: [], isa: "ISA 240, ISA 330" },
    { file: "AE.02. Omitted Liabilities Testing.xlsx", ref: "AE.02", title: "Omitted Liabilities Testing", desc: "Working paper for search for unrecorded liabilities testing", fsLines: [], isa: "ISA 500" },
    { file: "AE.03. Number of Employees Working.xlsx", ref: "AE.03", title: "Number of Employees", desc: "Working paper for employee count verification and payroll testing", fsLines: [], isa: "ISA 500" },
    { file: "AE.04. Working Paper for Review of Minutes of Meeting.xlsx", ref: "AE.04", title: "Minutes of Meeting Review", desc: "Working paper for board and shareholder meeting minutes review", fsLines: [], isa: "ISA 500" },
  ];

  for (const t of bsTemplates) {
    templates.push({
      id: t.ref.toLowerCase().replace(/\./g, "-"),
      fileName: t.file,
      category: "WORKING_PAPER",
      subCategory: "Balance Sheet",
      reference: t.ref,
      title: t.title,
      description: t.desc,
      fileType: "xlsx",
      phase: "EXECUTION",
      fsLineItems: t.fsLines,
      isaParagraph: t.isa,
    });
  }

  for (const t of plTemplates) {
    templates.push({
      id: t.ref.toLowerCase().replace(/\./g, "-"),
      fileName: t.file,
      category: "WORKING_PAPER",
      subCategory: "Profit & Loss",
      reference: t.ref,
      title: t.title,
      description: t.desc,
      fileType: "xlsx",
      phase: "EXECUTION",
      fsLineItems: t.fsLines,
      isaParagraph: t.isa,
    });
  }

  for (const t of aeTemplates) {
    templates.push({
      id: t.ref.toLowerCase().replace(/\./g, "-"),
      fileName: t.file,
      category: "WORKING_PAPER",
      subCategory: "Audit Evidence",
      reference: t.ref,
      title: t.title,
      description: t.desc,
      fileType: "xlsx",
      phase: "EXECUTION",
      fsLineItems: t.fsLines,
      isaParagraph: t.isa,
    });
  }

  const planningTemplates: Array<{ file: string; ref: string; title: string; desc: string }> = [
    { file: "00. Information and Documents Requisition.xlsx", ref: "PR.00", title: "Information & Documents Requisition", desc: "Standard requisition list for client information requests" },
    { file: "01. Main Index.xlsx", ref: "PR.01", title: "Main Index", desc: "Master index of all audit working papers and file sections" },
    { file: "02. P.R Audit Planning and Reporting.docx", ref: "PR.02", title: "Audit Planning & Reporting", desc: "Overall audit strategy and planning memorandum per ISA 300" },
    { file: "03. P.R. Working for key financial ratios - Annexure-C.xlsx", ref: "PR.03", title: "Key Financial Ratios", desc: "Analytical procedures - key financial ratio calculations per ISA 520" },
    { file: "04. P.R. Audit materiality - Annexure-D.xlsx", ref: "PR.04", title: "Audit Materiality", desc: "Materiality determination and performance materiality per ISA 320" },
    { file: "05. Internal Controls Evaluation Checklist - Attachment A.docx", ref: "PR.05A", title: "Internal Controls Evaluation (Attachment A)", desc: "Detailed internal controls evaluation questionnaire per ISA 315" },
    { file: "05. Internal Controls Evaluation Checklist.xlsx", ref: "PR.05", title: "Internal Controls Evaluation Checklist", desc: "Internal controls testing and evaluation checklist per ISA 315" },
    { file: "06. Internal Controls Checklist.docx", ref: "PR.06", title: "Internal Controls Checklist", desc: "Summary checklist for internal control assessment" },
  ];

  for (const t of planningTemplates) {
    const ext = t.file.split(".").pop() || "xlsx";
    templates.push({
      id: t.ref.toLowerCase().replace(/\./g, "-"),
      fileName: t.file,
      category: "PLANNING",
      subCategory: "Planning & Risk Assessment",
      reference: t.ref,
      title: t.title,
      description: t.desc,
      fileType: ext,
      phase: "PLANNING",
      fsLineItems: [],
      isaParagraph: "",
    });
  }

  const reportingTemplates: Array<{ file: string; ref: string; title: string; desc: string }> = [
    { file: "07. Management Letter.docx", ref: "RP.07", title: "Management Letter", desc: "Template for management letter communicating control deficiencies per ISA 265" },
    { file: "08. Management Representation Letter (MRL).docx", ref: "RP.08", title: "Management Representation Letter", desc: "Written representations from management per ISA 580" },
    { file: "Engagement Letter (Template).docx", ref: "RP.EL", title: "Engagement Letter", desc: "Standard engagement letter template per ISA 210" },
    { file: "Aqeel Alam & Co. - SSE Model - FS 2023.xlsx", ref: "RP.FS", title: "Model Financial Statements", desc: "Model financial statements template compliant with Companies Act 2017 and IFRS" },
  ];

  for (const t of reportingTemplates) {
    const ext = t.file.split(".").pop() || "docx";
    templates.push({
      id: t.ref.toLowerCase().replace(/\./g, "-"),
      fileName: t.file,
      category: "REPORTING",
      subCategory: "Reports & Letters",
      reference: t.ref,
      title: t.title,
      description: t.desc,
      fileType: ext,
      phase: "FINALIZATION",
      fsLineItems: [],
      isaParagraph: "",
    });
  }

  const confirmationTemplates: Array<{ file: string; ref: string; title: string; desc: string }> = [
    { file: "Bank Confirmation Format (AAC).docx", ref: "CF.BK", title: "Bank Confirmation", desc: "Standard bank balance confirmation format per ISA 505" },
    { file: "BS_ Confirmation - Legal Advisor.docx", ref: "CF.LA", title: "Legal Advisor Confirmation", desc: "Confirmation letter for legal advisor regarding litigation and claims" },
    { file: "BS_ Confirmation - Tax Advisor.docx", ref: "CF.TA", title: "Tax Advisor Confirmation", desc: "Confirmation letter for tax advisor regarding tax matters" },
    { file: "BS_ Other Reserves Confirmations.docx", ref: "CF.OR", title: "Other Reserves Confirmation", desc: "Confirmation letter for other reserves and related party balances" },
    { file: "BS_ Payable Confirmations.docx", ref: "CF.AP", title: "Payable Confirmations", desc: "Creditor/vendor balance confirmation letter per ISA 505" },
    { file: "BS_ Receivable Confirmations.docx", ref: "CF.AR", title: "Receivable Confirmations", desc: "Debtor balance confirmation letter per ISA 505" },
  ];

  for (const t of confirmationTemplates) {
    templates.push({
      id: t.ref.toLowerCase().replace(/\./g, "-"),
      fileName: t.file,
      category: "CONFIRMATION",
      subCategory: "External Confirmations",
      reference: t.ref,
      title: t.title,
      description: t.desc,
      fileType: "docx",
      phase: "EXECUTION",
      fsLineItems: [],
      isaParagraph: "ISA 505",
    });
  }

  const otherTemplates: Array<{ file: string; ref: string; title: string; desc: string }> = [
    { file: "Certificates (Stock Take & Cash Count).docx", ref: "OT.SC", title: "Stock Take & Cash Count Certificates", desc: "Certificates for physical inventory and cash count observation per ISA 501" },
    { file: "Stock Take and Cash Count Program (Complete).xlsx", ref: "OT.SP", title: "Stock Take & Cash Count Program", desc: "Detailed program for planning and executing inventory observation" },
  ];

  for (const t of otherTemplates) {
    const ext = t.file.split(".").pop() || "xlsx";
    templates.push({
      id: t.ref.toLowerCase().replace(/\./g, "-"),
      fileName: t.file,
      category: "OTHER",
      subCategory: "Other Templates",
      reference: t.ref,
      title: t.title,
      description: t.desc,
      fileType: ext,
      phase: "EXECUTION",
      fsLineItems: [],
      isaParagraph: "",
    });
  }

  return templates;
}

function buildIsqmCatalog(): TemplateMeta[] {
  const templates: TemplateMeta[] = [];

  const isqmDocs: Array<{ file: string; ref: string; title: string; desc: string; sub: string }> = [
    { file: "Firm's Policies - ISQM v.8.docx", ref: "ISQM-POL", title: "Firm Quality Management Policies", desc: "Complete ISQM 1 firm-level quality management policies document (Version 8)", sub: "Policies" },
    { file: "ISQM - Forms.xlsx", ref: "ISQM-FRM", title: "ISQM Forms Workbook", desc: "Collection of all ISQM-related forms and checklists for quality management", sub: "Forms" },
    { file: "ISQM-13. Trainee Admission Form.docx", ref: "ISQM-13", title: "Trainee Admission Form", desc: "Form for admitting trainees into the firm - HR component of ISQM 1", sub: "HR & Resources" },
    { file: "ISQM-14. Candidate Evaluation form.docx", ref: "ISQM-14", title: "Candidate Evaluation Form", desc: "Form for evaluating candidates during recruitment per ISQM 1 resources component", sub: "HR & Resources" },
    { file: "ISQM-15. Appointment Letter.docx", ref: "ISQM-15", title: "Appointment Letter", desc: "Standard appointment letter template for firm staff per ISQM 1", sub: "HR & Resources" },
    { file: "ISQM-17. Expereince Letter.docx", ref: "ISQM-17", title: "Experience Letter", desc: "Experience/service certificate template for departing staff", sub: "HR & Resources" },
    { file: "ISQM-20. Annual Survey form.docx", ref: "ISQM-20", title: "Annual Survey Form", desc: "Annual quality management survey for staff feedback per ISQM 1", sub: "Monitoring" },
    { file: "ISQM-21. Performance Feedback from Leadership.docx", ref: "ISQM-21", title: "Performance Feedback from Leadership", desc: "Leadership performance feedback form for quality management monitoring", sub: "Monitoring" },
  ];

  for (const t of isqmDocs) {
    const ext = t.file.split(".").pop() || "docx";
    templates.push({
      id: t.ref.toLowerCase().replace(/\./g, "-"),
      fileName: t.file,
      category: "ISQM",
      subCategory: t.sub,
      reference: t.ref,
      title: t.title,
      description: t.desc,
      fileType: ext,
      phase: "FIRM_WIDE",
      fsLineItems: [],
      isaParagraph: "ISQM 1",
    });
  }

  const isqmReference: Array<{ file: string; ref: string; title: string; desc: string; sub: string }> = [
    { file: "IAASB-Quality-Management-ISQM-1-Quality-Management-for-Firms.pdf", ref: "REF-ISQM1", title: "ISQM 1 Standard (Full Text)", desc: "IAASB ISQM 1 - Quality Management for Firms that Perform Audits", sub: "Standards" },
    { file: "IAASB-Quality-Management-ISQM-2-Engagement-Quality-Reviews.pdf", ref: "REF-ISQM2", title: "ISQM 2 Standard (Full Text)", desc: "IAASB ISQM 2 - Engagement Quality Reviews", sub: "Standards" },
    { file: "IAASB-ISQM-1-Basis-for-Conclusions.pdf", ref: "REF-BFC1", title: "ISQM 1 Basis for Conclusions", desc: "Basis for conclusions on ISQM 1 quality management standard", sub: "Reference" },
    { file: "IAASB-Quality-Management-ISQM-2-Basis-for-Conclusions.pdf", ref: "REF-BFC2", title: "ISQM 2 Basis for Conclusions", desc: "Basis for conclusions on ISQM 2 engagement quality reviews", sub: "Reference" },
    { file: "IAASB-ISQM-1-Fact-Sheet.pdf", ref: "REF-FS1", title: "ISQM 1 Fact Sheet", desc: "Quick reference fact sheet for ISQM 1 requirements", sub: "Reference" },
    { file: "IAASB-ISQM-2-Fact-sheet.pdf", ref: "REF-FS2", title: "ISQM 2 Fact Sheet", desc: "Quick reference fact sheet for ISQM 2 requirements", sub: "Reference" },
    { file: "IAASB-ISQM-1-first-time-implementation-guide-quality-management_0.pdf", ref: "REF-IG1", title: "ISQM 1 Implementation Guide", desc: "First-time implementation guide for ISQM 1 quality management", sub: "Implementation" },
    { file: "IAASB-ISQM-2-first-time-implementation-guide-quality-management.pdf", ref: "REF-IG2", title: "ISQM 2 Implementation Guide", desc: "First-time implementation guide for ISQM 2 engagement quality reviews", sub: "Implementation" },
    { file: "IAASB-quality-management-conforming-amendments (1).pdf", ref: "REF-CA1", title: "Conforming Amendments (Part 1)", desc: "Conforming and consequential amendments from quality management standards", sub: "Reference" },
    { file: "IAASB-quality-management-conforming-amendments.pdf", ref: "REF-CA2", title: "Conforming Amendments (Part 2)", desc: "Additional conforming amendments from quality management standards", sub: "Reference" },
    { file: "ISQM-guide-and-toolkit.pdf", ref: "REF-GTK", title: "ISQM Guide & Toolkit", desc: "Comprehensive guide and toolkit for ISQM implementation", sub: "Implementation" },
  ];

  for (const t of isqmReference) {
    templates.push({
      id: t.ref.toLowerCase().replace(/\./g, "-"),
      fileName: t.file,
      category: "ISQM_REFERENCE",
      subCategory: t.sub,
      reference: t.ref,
      title: t.title,
      description: t.desc,
      fileType: "pdf",
      phase: "FIRM_WIDE",
      fsLineItems: [],
      isaParagraph: "",
    });
  }

  return templates;
}

let cachedCatalog: TemplateMeta[] | null = null;

function getCatalog(): TemplateMeta[] {
  if (!cachedCatalog) {
    cachedCatalog = [...buildWorkingPaperCatalog(), ...buildIsqmCatalog()];
  }
  return cachedCatalog;
}

router.get("/catalog", requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const catalog = getCatalog();
    const { category, subCategory, phase, search, fileType } = req.query;

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

    res.json({
      templates: filtered,
      meta: {
        totalTemplates: catalog.length,
        filteredCount: filtered.length,
        categories,
        subCategories,
      },
    });
  } catch (error) {
    console.error("Template catalog error:", error);
    res.status(500).json({ error: "Failed to load template catalog" });
  }
});

router.get("/download/:templateId", requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const catalog = getCatalog();
    const template = catalog.find(t => t.id === req.params.templateId);
    if (!template) {
      return res.status(404).json({ error: "Template not found" });
    }

    const isIsqm = template.category === "ISQM" || template.category === "ISQM_REFERENCE";
    const dir = isIsqm ? ISQM_DIR : WORKING_PAPERS_DIR;
    const filePath = path.join(dir, template.fileName);

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

router.get("/stats", requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const catalog = getCatalog();

    const byCategory: Record<string, number> = {};
    const byPhase: Record<string, number> = {};
    const byFileType: Record<string, number> = {};

    for (const t of catalog) {
      byCategory[t.category] = (byCategory[t.category] || 0) + 1;
      byPhase[t.phase] = (byPhase[t.phase] || 0) + 1;
      byFileType[t.fileType] = (byFileType[t.fileType] || 0) + 1;
    }

    res.json({
      total: catalog.length,
      byCategory,
      byPhase,
      byFileType,
    });
  } catch (error) {
    console.error("Template stats error:", error);
    res.status(500).json({ error: "Failed to load template stats" });
  }
});

export default router;
