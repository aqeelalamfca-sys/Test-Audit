import { useState, useEffect } from "react";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { formatAccounting } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { 
  Plus, Wand2, FileText, AlertTriangle, CheckCircle2, Trash2, 
  ChevronDown, Sparkles, Download, Eye, CalendarIcon, Upload, RefreshCw,
  ClipboardList, Target, Shield, BarChart3, Building2, Loader2
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export interface AuditProcedure {
  id: string;
  type: "Control" | "Substantive" | "Analytical";
  description: string;
  isaReference: string;
  status: "not-started" | "in-progress" | "completed" | "na";
  workpaperRef: string;
  performedBy: string;
  performedDate: string;
  reviewedBy: string;
  reviewedDate: string;
  findings: string;
  isCustom: boolean;
}

export interface AccountHeadProgram {
  id: string;
  accountHead: string;
  description?: string;
  amount?: number;
  openingBalance?: number;
  totalDr?: number;
  totalCr?: number;
  closingBalance?: number;
  accountCode?: string;
  tbCoverage: string[];
  materialityStatus: "Material" | "Immaterial";
  riskLevel: "High" | "Medium" | "Low";
  assertions: string[];
  procedures: AuditProcedure[];
  isClubbed: boolean;
  clubbedAccounts?: string[];
  clubbingRationale?: string;
  sampleSize?: number;
  sampleMethod?: string;
}

interface CompanyProfile {
  name?: string;
  country?: string;
  regulatoryFramework?: string;
  fiscalYear?: string;
  listedStatus?: string;
}

interface AuditProgramSectionProps {
  programs: AccountHeadProgram[];
  onProgramsChange: (programs: AccountHeadProgram[]) => void;
  overallMateriality?: number;
  performanceMateriality?: number;
  industryType?: string;
  companyProfile?: CompanyProfile;
  engagementId?: string;
}

// Enhanced Procedure Library with ISA references and comprehensive coverage
interface ProcedureItem {
  description: string;
  isaRef?: string;
  type: "Control" | "Substantive" | "Analytical";
  assertions?: string[];
}

interface ProcedureCategory {
  name: string;
  procedures: ProcedureItem[];
}

interface ProcedureSection {
  title: string;
  categories: ProcedureCategory[];
}

const PROCEDURE_LIBRARY: Record<string, ProcedureSection> = {
  fsLevel: {
    title: "Financial Statement Level Procedures",
    categories: [
      {
        name: "Analytical Review (ISA 520)",
        procedures: [
          { description: "Horizontal and vertical analysis of financial statements", isaRef: "ISA 520.5", type: "Analytical", assertions: ["Valuation/Accuracy", "Completeness"] },
          { description: "Ratio analysis comparing with prior periods, industry benchmarks, and budgets", isaRef: "ISA 520.5", type: "Analytical", assertions: ["Valuation/Accuracy"] },
          { description: "Common-size financial statement analysis", isaRef: "ISA 520.5", type: "Analytical", assertions: ["Presentation & Disclosure"] },
          { description: "Trend analysis for 3-5 year periods with investigation of significant variances", isaRef: "ISA 520.7", type: "Analytical", assertions: ["Completeness", "Existence/Occurrence"] },
          { description: "Segment-wise performance analysis by product line, geography, or business unit", isaRef: "ISA 520.5", type: "Analytical", assertions: ["Valuation/Accuracy"] },
          { description: "Comparison of actual results with budgets and forecasts with variance analysis", isaRef: "ISA 520.5", type: "Analytical", assertions: ["Valuation/Accuracy"] },
          { description: "Industry benchmark comparison for key financial metrics and ratios", isaRef: "ISA 520.5", type: "Analytical", assertions: ["Valuation/Accuracy"] }
        ]
      },
      {
        name: "Going Concern Assessment (ISA 570)",
        procedures: [
          { description: "Review management's going concern assessment and underlying assumptions", isaRef: "ISA 570.12", type: "Substantive", assertions: ["Valuation/Accuracy"] },
          { description: "Analyze cash flow forecasts and budgets for at least 12 months from reporting date", isaRef: "ISA 570.16", type: "Analytical", assertions: ["Valuation/Accuracy"] },
          { description: "Evaluate debt covenants and compliance with lending agreements", isaRef: "ISA 570.16", type: "Substantive", assertions: ["Rights & Obligations"] },
          { description: "Assess availability of financing options and credit facilities", isaRef: "ISA 570.16", type: "Substantive", assertions: ["Valuation/Accuracy"] },
          { description: "Review post-balance sheet events affecting going concern", isaRef: "ISA 570.15", type: "Substantive", assertions: ["Existence/Occurrence"] },
          { description: "Obtain management representations regarding going concern plans", isaRef: "ISA 570.16", type: "Substantive", assertions: ["Completeness"] },
          { description: "Evaluate adequacy of going concern disclosures per IAS 1", isaRef: "ISA 570.20", type: "Substantive", assertions: ["Presentation & Disclosure"] }
        ]
      },
      {
        name: "Fraud Risk Assessment (ISA 240)",
        procedures: [
          { description: "Conduct team brainstorming sessions on fraud risks and susceptibility", isaRef: "ISA 240.15", type: "Control", assertions: ["Existence/Occurrence", "Completeness"] },
          { description: "Evaluate management override of controls through journal entry testing", isaRef: "ISA 240.32", type: "Substantive", assertions: ["Existence/Occurrence", "Valuation/Accuracy"] },
          { description: "Review unusual transactions and related party relationships", isaRef: "ISA 240.32", type: "Substantive", assertions: ["Existence/Occurrence", "Rights & Obligations"] },
          { description: "Assessment of incentive/pressure factors and opportunity for fraud", isaRef: "ISA 240.25", type: "Control", assertions: ["Existence/Occurrence"] },
          { description: "Review of revenue recognition for fraud indicators", isaRef: "ISA 240.26", type: "Substantive", assertions: ["Existence/Occurrence", "Cut-off"] },
          { description: "Test accounting estimates for management bias", isaRef: "ISA 240.32", type: "Substantive", assertions: ["Valuation/Accuracy"] },
          { description: "Evaluate entity's fraud risk assessment and anti-fraud controls", isaRef: "ISA 240.19", type: "Control", assertions: ["Existence/Occurrence"] },
          { description: "Review whistleblower reports and fraud hotline complaints", isaRef: "ISA 240.19", type: "Control", assertions: ["Completeness"] }
        ]
      },
      {
        name: "Related Party Transactions (ISA 550)",
        procedures: [
          { description: "Identification of all related parties and their relationships", isaRef: "ISA 550.13", type: "Substantive", assertions: ["Completeness"] },
          { description: "Review of board and shareholder minutes for related party approvals", isaRef: "ISA 550.22", type: "Control", assertions: ["Existence/Occurrence"] },
          { description: "Testing of arm's length nature of significant transactions", isaRef: "ISA 550.23", type: "Substantive", assertions: ["Valuation/Accuracy"] },
          { description: "Evaluation of disclosure completeness per IAS 24", isaRef: "ISA 550.25", type: "Substantive", assertions: ["Presentation & Disclosure"] },
          { description: "Review of significant transactions outside normal course of business", isaRef: "ISA 550.23", type: "Substantive", assertions: ["Existence/Occurrence"] },
          { description: "Verify related party register is complete and accurate", isaRef: "ISA 550.13", type: "Substantive", assertions: ["Completeness"] },
          { description: "Obtain written representations regarding related parties", isaRef: "ISA 550.26", type: "Substantive", assertions: ["Completeness"] }
        ]
      },
      {
        name: "Subsequent Events Review (ISA 560)",
        procedures: [
          { description: "Review events after reporting date until audit report date", isaRef: "ISA 560.6", type: "Substantive", assertions: ["Existence/Occurrence", "Completeness"] },
          { description: "Evaluate adjusting vs. non-adjusting events per IAS 10", isaRef: "ISA 560.8", type: "Substantive", assertions: ["Valuation/Accuracy"] },
          { description: "Assess impact on financial statements and required adjustments", isaRef: "ISA 560.8", type: "Substantive", assertions: ["Valuation/Accuracy"] },
          { description: "Review minutes of post-year-end board and management meetings", isaRef: "ISA 560.7", type: "Substantive", assertions: ["Completeness"] },
          { description: "Inquire of management regarding subsequent events", isaRef: "ISA 560.7", type: "Substantive", assertions: ["Completeness"] },
          { description: "Review latest interim financial information and management accounts", isaRef: "ISA 560.7", type: "Substantive", assertions: ["Completeness"] },
          { description: "Obtain management representation letter covering subsequent events", isaRef: "ISA 560.9", type: "Substantive", assertions: ["Completeness"] }
        ]
      },
      {
        name: "Group Audit Considerations (ISA 600)",
        procedures: [
          { description: "Understand the group and its components including component auditors", isaRef: "ISA 600.17", type: "Substantive", assertions: ["Completeness"] },
          { description: "Assess significant components and risk of material misstatement", isaRef: "ISA 600.26", type: "Analytical", assertions: ["Valuation/Accuracy"] },
          { description: "Communicate with component auditors regarding scope and timing", isaRef: "ISA 600.40", type: "Control", assertions: ["Completeness"] },
          { description: "Review component auditor work papers and evaluate findings", isaRef: "ISA 600.42", type: "Substantive", assertions: ["Valuation/Accuracy"] },
          { description: "Test consolidation adjustments and intercompany eliminations", isaRef: "ISA 600.34", type: "Substantive", assertions: ["Valuation/Accuracy", "Completeness"] }
        ]
      },
      {
        name: "Accounting Estimates (ISA 540)",
        procedures: [
          { description: "Identify accounting estimates and evaluate their nature and complexity", isaRef: "ISA 540.10", type: "Substantive", assertions: ["Valuation/Accuracy"] },
          { description: "Evaluate estimation uncertainty and risk of material misstatement", isaRef: "ISA 540.15", type: "Substantive", assertions: ["Valuation/Accuracy"] },
          { description: "Test management's process for developing estimates", isaRef: "ISA 540.18", type: "Control", assertions: ["Valuation/Accuracy"] },
          { description: "Develop an independent point estimate or acceptable range", isaRef: "ISA 540.18", type: "Substantive", assertions: ["Valuation/Accuracy"] },
          { description: "Review subsequent events for evidence about estimates", isaRef: "ISA 540.22", type: "Substantive", assertions: ["Valuation/Accuracy"] },
          { description: "Evaluate adequacy of estimate disclosures", isaRef: "ISA 540.23", type: "Substantive", assertions: ["Presentation & Disclosure"] }
        ]
      },
      {
        name: "Laws and Regulations (ISA 250)",
        procedures: [
          { description: "Obtain understanding of legal and regulatory framework", isaRef: "ISA 250.12", type: "Substantive", assertions: ["Completeness"] },
          { description: "Inquire of management about compliance with laws and regulations", isaRef: "ISA 250.14", type: "Substantive", assertions: ["Completeness"] },
          { description: "Inspect correspondence with licensing and regulatory authorities", isaRef: "ISA 250.14", type: "Substantive", assertions: ["Existence/Occurrence"] },
          { description: "Review legal fee accounts and lawyers' letters for indications of litigation", isaRef: "ISA 250.14", type: "Substantive", assertions: ["Completeness"] },
          { description: "Verify compliance with applicable tax laws and regulations", isaRef: "ISA 250.14", type: "Substantive", assertions: ["Completeness"] }
        ]
      }
    ]
  },
  assets: {
    title: "Assets",
    categories: [
      {
        name: "Cash and Cash Equivalents (ISA 500/505)",
        procedures: [
          { description: "Bank confirmation procedures for all material bank accounts", isaRef: "ISA 505.7", type: "Substantive", assertions: ["Existence/Occurrence", "Completeness", "Rights & Obligations"] },
          { description: "Physical cash count and verification at period-end", isaRef: "ISA 500.A14", type: "Substantive", assertions: ["Existence/Occurrence"] },
          { description: "Bank reconciliation review and testing of reconciling items", isaRef: "ISA 500.A5", type: "Substantive", assertions: ["Completeness", "Existence/Occurrence"] },
          { description: "Cut-off bank statement testing for subsequent period deposits/withdrawals", isaRef: "ISA 500.A14", type: "Substantive", assertions: ["Cut-off", "Existence/Occurrence"] },
          { description: "Review of bank guarantees and letters of credit with confirmation", isaRef: "ISA 505.7", type: "Substantive", assertions: ["Completeness", "Rights & Obligations"] },
          { description: "Testing of cash restrictions, pledged deposits, and liens", isaRef: "ISA 500.A14", type: "Substantive", assertions: ["Rights & Obligations", "Presentation & Disclosure"] },
          { description: "Foreign currency translation verification at period-end rates", isaRef: "ISA 500.A5", type: "Substantive", assertions: ["Valuation/Accuracy"] },
          { description: "Test of controls over cash receipts and disbursements", isaRef: "ISA 330.8", type: "Control", assertions: ["Existence/Occurrence", "Completeness"] },
          { description: "Analytical review of interest income on deposits", isaRef: "ISA 520.5", type: "Analytical", assertions: ["Completeness", "Valuation/Accuracy"] }
        ]
      },
      {
        name: "Trade and Other Receivables (ISA 500/505)",
        procedures: [
          { description: "Customer confirmation procedures (positive/negative confirmations)", isaRef: "ISA 505.7", type: "Substantive", assertions: ["Existence/Occurrence", "Rights & Obligations", "Valuation/Accuracy"] },
          { description: "Alternative procedures for non-replies including subsequent receipts testing", isaRef: "ISA 505.12", type: "Substantive", assertions: ["Existence/Occurrence"] },
          { description: "Aging analysis review and assessment of collectibility", isaRef: "ISA 540.18", type: "Substantive", assertions: ["Valuation/Accuracy"] },
          { description: "Testing of Expected Credit Loss allowance per IFRS 9", isaRef: "ISA 540.18", type: "Substantive", assertions: ["Valuation/Accuracy"] },
          { description: "Cut-off testing for sales and cash receipts at period-end", isaRef: "ISA 500.A14", type: "Substantive", assertions: ["Cut-off"] },
          { description: "Review of credit policies, limits, and approval procedures", isaRef: "ISA 330.8", type: "Control", assertions: ["Valuation/Accuracy"] },
          { description: "Testing of write-offs and recoveries during the period", isaRef: "ISA 500.A5", type: "Substantive", assertions: ["Valuation/Accuracy", "Existence/Occurrence"] },
          { description: "Verify receivables pledged as security are properly disclosed", isaRef: "ISA 500.A14", type: "Substantive", assertions: ["Presentation & Disclosure", "Rights & Obligations"] },
          { description: "Test intercompany receivables and reconciliation to related party records", isaRef: "ISA 550.22", type: "Substantive", assertions: ["Existence/Occurrence", "Valuation/Accuracy"] }
        ]
      },
      {
        name: "Inventories (ISA 501)",
        procedures: [
          { description: "Physical inventory count observation at period-end or near period-end", isaRef: "ISA 501.4", type: "Substantive", assertions: ["Existence/Occurrence"] },
          { description: "Perform test counts and reconciliation to final inventory records", isaRef: "ISA 501.4", type: "Substantive", assertions: ["Existence/Occurrence", "Completeness"] },
          { description: "Evaluate adequacy of count procedures and management's instructions", isaRef: "ISA 501.5", type: "Control", assertions: ["Existence/Occurrence", "Completeness"] },
          { description: "Cut-off testing for purchases and sales around period-end", isaRef: "ISA 500.A14", type: "Substantive", assertions: ["Cut-off"] },
          { description: "Testing of inventory costing methods (FIFO, weighted average) for consistency", isaRef: "ISA 500.A5", type: "Substantive", assertions: ["Valuation/Accuracy"] },
          { description: "Review of overhead absorption and standard cost variances", isaRef: "ISA 500.A5", type: "Substantive", assertions: ["Valuation/Accuracy"] },
          { description: "Net Realizable Value (NRV) testing for slow-moving/obsolete items", isaRef: "ISA 501.6", type: "Substantive", assertions: ["Valuation/Accuracy"] },
          { description: "Inventory aging and obsolescence review with provision testing", isaRef: "ISA 540.18", type: "Substantive", assertions: ["Valuation/Accuracy"] },
          { description: "Testing of inventory in transit with supporting documentation", isaRef: "ISA 500.A5", type: "Substantive", assertions: ["Existence/Occurrence", "Rights & Obligations"] },
          { description: "Test of controls over inventory receipts, issues, and adjustments", isaRef: "ISA 330.8", type: "Control", assertions: ["Completeness", "Existence/Occurrence"] },
          { description: "Verify consignment inventory is properly included/excluded", isaRef: "ISA 501.4", type: "Substantive", assertions: ["Rights & Obligations"] }
        ]
      },
      {
        name: "Property, Plant and Equipment (ISA 500/540)",
        procedures: [
          { description: "Physical verification of significant fixed assets", isaRef: "ISA 500.A14", type: "Substantive", assertions: ["Existence/Occurrence"] },
          { description: "Review of title deeds, vehicle registration, and ownership documents", isaRef: "ISA 500.A5", type: "Substantive", assertions: ["Rights & Obligations"] },
          { description: "Testing of additions for proper authorization and capitalization", isaRef: "ISA 500.A5", type: "Substantive", assertions: ["Existence/Occurrence", "Valuation/Accuracy"] },
          { description: "Testing of disposals for authorization, proceeds, and gain/loss calculation", isaRef: "ISA 500.A5", type: "Substantive", assertions: ["Completeness", "Valuation/Accuracy"] },
          { description: "Depreciation calculation testing and useful life assessment", isaRef: "ISA 540.18", type: "Substantive", assertions: ["Valuation/Accuracy"] },
          { description: "Impairment testing and review per IAS 36", isaRef: "ISA 540.18", type: "Substantive", assertions: ["Valuation/Accuracy"] },
          { description: "Capitalization vs. expense analysis for significant repairs", isaRef: "ISA 500.A5", type: "Substantive", assertions: ["Valuation/Accuracy", "Classification"] },
          { description: "Review of lease accounting under IFRS 16 for right-of-use assets", isaRef: "ISA 540.18", type: "Substantive", assertions: ["Valuation/Accuracy", "Presentation & Disclosure"] },
          { description: "Testing of asset revaluations (if revaluation model applied)", isaRef: "ISA 540.18", type: "Substantive", assertions: ["Valuation/Accuracy"] },
          { description: "Verify assets pledged as security are properly disclosed", isaRef: "ISA 500.A5", type: "Substantive", assertions: ["Presentation & Disclosure", "Rights & Obligations"] }
        ]
      },
      {
        name: "Intangible Assets (ISA 500/540)",
        procedures: [
          { description: "Review of legal rights, patents, trademarks, and ownership evidence", isaRef: "ISA 500.A5", type: "Substantive", assertions: ["Rights & Obligations", "Existence/Occurrence"] },
          { description: "Amortization testing against policy and useful lives", isaRef: "ISA 540.18", type: "Substantive", assertions: ["Valuation/Accuracy"] },
          { description: "Annual impairment testing for goodwill and indefinite-life intangibles", isaRef: "ISA 540.18", type: "Substantive", assertions: ["Valuation/Accuracy"] },
          { description: "Review of development costs capitalization criteria per IAS 38", isaRef: "ISA 500.A5", type: "Substantive", assertions: ["Valuation/Accuracy", "Classification"] },
          { description: "Testing of acquisition-related intangibles from business combinations", isaRef: "ISA 540.18", type: "Substantive", assertions: ["Valuation/Accuracy"] },
          { description: "Evaluate management's impairment model assumptions and sensitivity", isaRef: "ISA 540.18", type: "Substantive", assertions: ["Valuation/Accuracy"] }
        ]
      },
      {
        name: "Investments (ISA 500/505/540)",
        procedures: [
          { description: "Confirmation with custodians, brokers, and investment managers", isaRef: "ISA 505.7", type: "Substantive", assertions: ["Existence/Occurrence", "Rights & Obligations"] },
          { description: "Fair value verification using quoted prices or valuation models", isaRef: "ISA 540.18", type: "Substantive", assertions: ["Valuation/Accuracy"] },
          { description: "Dividend and interest income testing and cut-off", isaRef: "ISA 500.A5", type: "Substantive", assertions: ["Completeness", "Cut-off"] },
          { description: "Impairment testing for investments in subsidiaries and associates", isaRef: "ISA 540.18", type: "Substantive", assertions: ["Valuation/Accuracy"] },
          { description: "Classification testing (FVTPL, FVOCI, amortized cost) per IFRS 9", isaRef: "ISA 500.A5", type: "Substantive", assertions: ["Classification", "Presentation & Disclosure"] },
          { description: "Review of investment policies and authorization procedures", isaRef: "ISA 330.8", type: "Control", assertions: ["Existence/Occurrence"] },
          { description: "Equity method accounting verification for associates", isaRef: "ISA 500.A5", type: "Substantive", assertions: ["Valuation/Accuracy"] }
        ]
      },
      {
        name: "Biological Assets (ISA 500/540)",
        procedures: [
          { description: "Physical inspection and verification of biological assets", isaRef: "ISA 500.A14", type: "Substantive", assertions: ["Existence/Occurrence"] },
          { description: "Fair value less costs to sell measurement testing per IAS 41", isaRef: "ISA 540.18", type: "Substantive", assertions: ["Valuation/Accuracy"] },
          { description: "Review of valuation methodology and key assumptions", isaRef: "ISA 540.18", type: "Substantive", assertions: ["Valuation/Accuracy"] },
          { description: "Testing of changes in fair value during the period", isaRef: "ISA 500.A5", type: "Substantive", assertions: ["Valuation/Accuracy"] }
        ]
      }
    ]
  },
  liabilities: {
    title: "Liabilities",
    categories: [
      {
        name: "Trade and Other Payables (ISA 500/505)",
        procedures: [
          { description: "Supplier confirmation procedures for significant balances", isaRef: "ISA 505.7", type: "Substantive", assertions: ["Completeness", "Existence/Occurrence"] },
          { description: "Subsequent payments testing to verify liabilities recorded", isaRef: "ISA 500.A5", type: "Substantive", assertions: ["Completeness"] },
          { description: "Search for unrecorded liabilities through invoice review", isaRef: "ISA 500.A5", type: "Substantive", assertions: ["Completeness"] },
          { description: "Aging analysis review and investigation of old items", isaRef: "ISA 500.A5", type: "Substantive", assertions: ["Completeness", "Valuation/Accuracy"] },
          { description: "Cut-off testing for purchases and receipt of goods/services", isaRef: "ISA 500.A14", type: "Substantive", assertions: ["Cut-off"] },
          { description: "Testing of accrued expenses and completeness of accruals", isaRef: "ISA 540.18", type: "Substantive", assertions: ["Completeness", "Valuation/Accuracy"] },
          { description: "Review of debit balances in accounts payable", isaRef: "ISA 500.A5", type: "Substantive", assertions: ["Classification"] },
          { description: "Test intercompany payables and reconciliation", isaRef: "ISA 550.22", type: "Substantive", assertions: ["Completeness", "Valuation/Accuracy"] },
          { description: "Test of controls over purchase and payment processing", isaRef: "ISA 330.8", type: "Control", assertions: ["Completeness"] }
        ]
      },
      {
        name: "Borrowings and Loans (ISA 500/505)",
        procedures: [
          { description: "Confirmation with lenders for all loan facilities", isaRef: "ISA 505.7", type: "Substantive", assertions: ["Completeness", "Existence/Occurrence", "Rights & Obligations"] },
          { description: "Interest expense recalculation and accrual testing", isaRef: "ISA 500.A5", type: "Substantive", assertions: ["Valuation/Accuracy", "Completeness"] },
          { description: "Covenant compliance review and breach assessment", isaRef: "ISA 500.A5", type: "Substantive", assertions: ["Presentation & Disclosure"] },
          { description: "Debt classification testing (current/non-current) per IAS 1", isaRef: "ISA 500.A5", type: "Substantive", assertions: ["Classification"] },
          { description: "Review of loan agreements and terms including security", isaRef: "ISA 500.A5", type: "Substantive", assertions: ["Rights & Obligations", "Presentation & Disclosure"] },
          { description: "Foreign currency loan translation testing at period-end rates", isaRef: "ISA 500.A5", type: "Substantive", assertions: ["Valuation/Accuracy"] },
          { description: "Testing of new borrowings and repayments during the year", isaRef: "ISA 500.A5", type: "Substantive", assertions: ["Existence/Occurrence", "Completeness"] },
          { description: "Verify security/collateral pledged is properly disclosed", isaRef: "ISA 500.A5", type: "Substantive", assertions: ["Presentation & Disclosure"] }
        ]
      },
      {
        name: "Provisions and Contingencies (ISA 500/540/501)",
        procedures: [
          { description: "Review of basis for provisions and recognition criteria per IAS 37", isaRef: "ISA 540.18", type: "Substantive", assertions: ["Completeness", "Existence/Occurrence"] },
          { description: "Testing of provision calculations and key assumptions", isaRef: "ISA 540.18", type: "Substantive", assertions: ["Valuation/Accuracy"] },
          { description: "Review of legal opinions and litigation matters", isaRef: "ISA 501.9", type: "Substantive", assertions: ["Completeness", "Valuation/Accuracy"] },
          { description: "Lawyer's letter confirmation for legal contingencies", isaRef: "ISA 501.9", type: "Substantive", assertions: ["Completeness"] },
          { description: "Evaluation of timing of recognition and measurement", isaRef: "ISA 540.18", type: "Substantive", assertions: ["Valuation/Accuracy", "Cut-off"] },
          { description: "Testing of changes in estimates and rollforward analysis", isaRef: "ISA 540.18", type: "Substantive", assertions: ["Valuation/Accuracy"] },
          { description: "Review of warranties, guarantees, and onerous contracts", isaRef: "ISA 540.18", type: "Substantive", assertions: ["Completeness", "Valuation/Accuracy"] },
          { description: "Evaluate adequacy of contingent liability disclosures", isaRef: "ISA 501.9", type: "Substantive", assertions: ["Presentation & Disclosure"] }
        ]
      },
      {
        name: "Tax Liabilities (ISA 500/540)",
        procedures: [
          { description: "Current tax computation testing and reconciliation to tax returns", isaRef: "ISA 500.A5", type: "Substantive", assertions: ["Valuation/Accuracy"] },
          { description: "Deferred tax calculation review including temporary differences", isaRef: "ISA 540.18", type: "Substantive", assertions: ["Valuation/Accuracy"] },
          { description: "Tax provision reconciliation (effective tax rate analysis)", isaRef: "ISA 520.5", type: "Analytical", assertions: ["Valuation/Accuracy"] },
          { description: "Review of tax assessments, notices, and appeals", isaRef: "ISA 500.A5", type: "Substantive", assertions: ["Completeness", "Valuation/Accuracy"] },
          { description: "Testing of withholding tax compliance and deposits", isaRef: "ISA 500.A5", type: "Substantive", assertions: ["Completeness"] },
          { description: "Transfer pricing documentation review for related party transactions", isaRef: "ISA 550.23", type: "Substantive", assertions: ["Valuation/Accuracy"] },
          { description: "Verify tax losses carried forward and recoverability assessment", isaRef: "ISA 540.18", type: "Substantive", assertions: ["Valuation/Accuracy"] }
        ]
      },
      {
        name: "Lease Liabilities (ISA 500/540)",
        procedures: [
          { description: "Verify completeness of lease population per IFRS 16", isaRef: "ISA 500.A5", type: "Substantive", assertions: ["Completeness"] },
          { description: "Test lease liability calculation including discount rate", isaRef: "ISA 540.18", type: "Substantive", assertions: ["Valuation/Accuracy"] },
          { description: "Review lease contracts and key terms for proper classification", isaRef: "ISA 500.A5", type: "Substantive", assertions: ["Classification"] },
          { description: "Test lease modifications and remeasurement calculations", isaRef: "ISA 500.A5", type: "Substantive", assertions: ["Valuation/Accuracy"] },
          { description: "Verify current/non-current classification of lease liabilities", isaRef: "ISA 500.A5", type: "Substantive", assertions: ["Classification"] }
        ]
      }
    ]
  },
  equity: {
    title: "Equity and Reserves",
    categories: [
      {
        name: "Share Capital and Reserves (ISA 500)",
        procedures: [
          { description: "Verify share capital against statutory records and share register", isaRef: "ISA 500.A5", type: "Substantive", assertions: ["Existence/Occurrence", "Completeness"] },
          { description: "Test share issuances and buy-backs during the period", isaRef: "ISA 500.A5", type: "Substantive", assertions: ["Existence/Occurrence", "Valuation/Accuracy"] },
          { description: "Verify dividend declarations and payments", isaRef: "ISA 500.A5", type: "Substantive", assertions: ["Existence/Occurrence", "Valuation/Accuracy"] },
          { description: "Review statutory reserve requirements and compliance", isaRef: "ISA 250.14", type: "Substantive", assertions: ["Completeness"] },
          { description: "Test movements in revaluation surplus and other reserves", isaRef: "ISA 500.A5", type: "Substantive", assertions: ["Valuation/Accuracy"] },
          { description: "Verify foreign currency translation reserve movements", isaRef: "ISA 500.A5", type: "Substantive", assertions: ["Valuation/Accuracy"] },
          { description: "Review retained earnings reconciliation and appropriations", isaRef: "ISA 500.A5", type: "Substantive", assertions: ["Valuation/Accuracy"] }
        ]
      },
      {
        name: "Share-Based Payments (ISA 540)",
        procedures: [
          { description: "Obtain share option/RSU scheme documents and understand terms", isaRef: "ISA 500.A5", type: "Substantive", assertions: ["Completeness"] },
          { description: "Test IFRS 2 expense calculation and fair value inputs", isaRef: "ISA 540.18", type: "Substantive", assertions: ["Valuation/Accuracy"] },
          { description: "Verify vesting conditions and forfeiture estimates", isaRef: "ISA 540.18", type: "Substantive", assertions: ["Valuation/Accuracy"] },
          { description: "Review share-based payment disclosures per IFRS 2", isaRef: "ISA 500.A5", type: "Substantive", assertions: ["Presentation & Disclosure"] }
        ]
      }
    ]
  },
  revenue: {
    title: "Revenue and Income",
    categories: [
      {
        name: "Revenue Recognition (ISA 500/540) - IFRS 15",
        procedures: [
          { description: "Understand revenue recognition policies and assess IFRS 15 compliance", isaRef: "ISA 500.A5", type: "Substantive", assertions: ["Valuation/Accuracy", "Classification"] },
          { description: "Identify contracts and performance obligations", isaRef: "ISA 500.A5", type: "Substantive", assertions: ["Existence/Occurrence", "Completeness"] },
          { description: "Test transaction price determination including variable consideration", isaRef: "ISA 540.18", type: "Substantive", assertions: ["Valuation/Accuracy"] },
          { description: "Revenue recognition timing verification and allocation testing", isaRef: "ISA 500.A5", type: "Substantive", assertions: ["Cut-off", "Valuation/Accuracy"] },
          { description: "Test variable consideration estimates and constraints", isaRef: "ISA 540.18", type: "Substantive", assertions: ["Valuation/Accuracy"] },
          { description: "Cut-off testing at period-end for revenue transactions", isaRef: "ISA 500.A14", type: "Substantive", assertions: ["Cut-off"] },
          { description: "Testing of sales returns, rebates, and volume discounts", isaRef: "ISA 540.18", type: "Substantive", assertions: ["Valuation/Accuracy"] },
          { description: "Test of controls over revenue cycle and billing", isaRef: "ISA 330.8", type: "Control", assertions: ["Existence/Occurrence", "Completeness"] },
          { description: "Analytical review of revenue by product/segment/month", isaRef: "ISA 520.5", type: "Analytical", assertions: ["Completeness", "Existence/Occurrence"] },
          { description: "Test contract assets and liabilities (deferred revenue)", isaRef: "ISA 500.A5", type: "Substantive", assertions: ["Valuation/Accuracy", "Completeness"] },
          { description: "Review significant contracts for proper revenue treatment", isaRef: "ISA 500.A5", type: "Substantive", assertions: ["Valuation/Accuracy"] }
        ]
      },
      {
        name: "Other Income (ISA 500)",
        procedures: [
          { description: "Testing of interest income calculation and cut-off", isaRef: "ISA 500.A5", type: "Substantive", assertions: ["Valuation/Accuracy", "Cut-off"] },
          { description: "Dividend income verification with supporting documentation", isaRef: "ISA 500.A5", type: "Substantive", assertions: ["Existence/Occurrence"] },
          { description: "Rental income testing and lease income recognition", isaRef: "ISA 500.A5", type: "Substantive", assertions: ["Completeness", "Valuation/Accuracy"] },
          { description: "Gain/loss on disposal testing and calculation verification", isaRef: "ISA 500.A5", type: "Substantive", assertions: ["Valuation/Accuracy"] },
          { description: "Foreign exchange gain/loss verification and translation testing", isaRef: "ISA 500.A5", type: "Substantive", assertions: ["Valuation/Accuracy"] },
          { description: "Government grant income recognition testing per IAS 20", isaRef: "ISA 500.A5", type: "Substantive", assertions: ["Existence/Occurrence", "Valuation/Accuracy"] }
        ]
      }
    ]
  },
  expenses: {
    title: "Expenses",
    categories: [
      {
        name: "Cost of Sales (ISA 500)",
        procedures: [
          { description: "Costing method testing for consistency with prior year", isaRef: "ISA 500.A5", type: "Substantive", assertions: ["Valuation/Accuracy"] },
          { description: "Inventory to cost of sales reconciliation", isaRef: "ISA 500.A5", type: "Substantive", assertions: ["Valuation/Accuracy", "Completeness"] },
          { description: "Overhead absorption testing and allocation methodology", isaRef: "ISA 500.A5", type: "Substantive", assertions: ["Valuation/Accuracy"] },
          { description: "Direct material and labor cost verification", isaRef: "ISA 500.A5", type: "Substantive", assertions: ["Valuation/Accuracy"] },
          { description: "Standard cost variance analysis and adjustment testing", isaRef: "ISA 520.5", type: "Analytical", assertions: ["Valuation/Accuracy"] },
          { description: "Gross margin analysis by product line/segment", isaRef: "ISA 520.5", type: "Analytical", assertions: ["Valuation/Accuracy"] }
        ]
      },
      {
        name: "Employee Benefits and Payroll (ISA 500/540)",
        procedures: [
          { description: "Payroll testing - verify gross pay, deductions, and net pay", isaRef: "ISA 500.A5", type: "Substantive", assertions: ["Existence/Occurrence", "Valuation/Accuracy"] },
          { description: "Payroll reconciliation to GL and expense accounts", isaRef: "ISA 500.A5", type: "Substantive", assertions: ["Completeness"] },
          { description: "Bonus and commission verification to supporting calculations", isaRef: "ISA 500.A5", type: "Substantive", assertions: ["Valuation/Accuracy"] },
          { description: "Defined benefit obligation testing per IAS 19 (actuarial report review)", isaRef: "ISA 540.18", type: "Substantive", assertions: ["Valuation/Accuracy"] },
          { description: "Leave encashment and other benefit provision testing", isaRef: "ISA 540.18", type: "Substantive", assertions: ["Valuation/Accuracy"] },
          { description: "ESOP/Share-based payment expense testing per IFRS 2", isaRef: "ISA 540.18", type: "Substantive", assertions: ["Valuation/Accuracy"] },
          { description: "Provident/gratuity fund contributions verification", isaRef: "ISA 500.A5", type: "Substantive", assertions: ["Completeness"] },
          { description: "Test of controls over payroll processing and authorization", isaRef: "ISA 330.8", type: "Control", assertions: ["Existence/Occurrence"] }
        ]
      },
      {
        name: "Operating Expenses (ISA 500)",
        procedures: [
          { description: "Sample testing of significant operating expenses", isaRef: "ISA 500.A5", type: "Substantive", assertions: ["Existence/Occurrence", "Valuation/Accuracy"] },
          { description: "Analytical review of expenses by nature/function vs prior year", isaRef: "ISA 520.5", type: "Analytical", assertions: ["Completeness", "Valuation/Accuracy"] },
          { description: "Review of expense authorization and approval controls", isaRef: "ISA 330.8", type: "Control", assertions: ["Existence/Occurrence"] },
          { description: "Testing of prepaid and accrued expenses at period-end", isaRef: "ISA 500.A5", type: "Substantive", assertions: ["Valuation/Accuracy", "Cut-off"] },
          { description: "Depreciation and amortization recalculation testing", isaRef: "ISA 540.18", type: "Substantive", assertions: ["Valuation/Accuracy"] },
          { description: "Rent and lease expense verification (IFRS 16 implications)", isaRef: "ISA 500.A5", type: "Substantive", assertions: ["Valuation/Accuracy"] },
          { description: "Professional fees verification and service confirmation", isaRef: "ISA 500.A5", type: "Substantive", assertions: ["Existence/Occurrence"] },
          { description: "Travel and entertainment expense testing for policy compliance", isaRef: "ISA 500.A5", type: "Substantive", assertions: ["Existence/Occurrence"] },
          { description: "IT and software expense testing including licensing", isaRef: "ISA 500.A5", type: "Substantive", assertions: ["Existence/Occurrence", "Classification"] }
        ]
      },
      {
        name: "Finance Costs (ISA 500)",
        procedures: [
          { description: "Interest expense recalculation and verification to loan records", isaRef: "ISA 500.A5", type: "Substantive", assertions: ["Valuation/Accuracy"] },
          { description: "Bank charges and fees verification", isaRef: "ISA 500.A5", type: "Substantive", assertions: ["Existence/Occurrence"] },
          { description: "Borrowing costs capitalization testing per IAS 23", isaRef: "ISA 500.A5", type: "Substantive", assertions: ["Classification", "Valuation/Accuracy"] },
          { description: "Unwinding of discount on provisions testing", isaRef: "ISA 500.A5", type: "Substantive", assertions: ["Valuation/Accuracy"] },
          { description: "Foreign exchange losses on borrowings verification", isaRef: "ISA 500.A5", type: "Substantive", assertions: ["Valuation/Accuracy"] }
        ]
      }
    ]
  },
  specialIndustry: {
    title: "Industry-Specific Procedures",
    categories: [
      {
        name: "Manufacturing",
        procedures: [
          { description: "Production cost variance analysis and investigation", isaRef: "ISA 520.5", type: "Analytical", assertions: ["Valuation/Accuracy"] },
          { description: "Work-in-progress valuation and stage of completion testing", isaRef: "ISA 501.6", type: "Substantive", assertions: ["Valuation/Accuracy"] },
          { description: "Review of quality control and scrap/waste accounting", isaRef: "ISA 500.A5", type: "Substantive", assertions: ["Valuation/Accuracy"] },
          { description: "Manufacturing overhead allocation testing", isaRef: "ISA 500.A5", type: "Substantive", assertions: ["Valuation/Accuracy"] }
        ]
      },
      {
        name: "Banking and Financial Services",
        procedures: [
          { description: "Loan portfolio review and provisioning testing per IFRS 9 ECL", isaRef: "ISA 540.18", type: "Substantive", assertions: ["Valuation/Accuracy"] },
          { description: "Interest income and expense recalculation (effective interest method)", isaRef: "ISA 500.A5", type: "Substantive", assertions: ["Valuation/Accuracy"] },
          { description: "Securities and derivatives fair value testing", isaRef: "ISA 540.18", type: "Substantive", assertions: ["Valuation/Accuracy"] },
          { description: "Regulatory capital adequacy testing (Basel requirements)", isaRef: "ISA 250.14", type: "Substantive", assertions: ["Completeness"] },
          { description: "Anti-money laundering (AML) compliance review", isaRef: "ISA 250.14", type: "Control", assertions: ["Completeness"] }
        ]
      },
      {
        name: "Construction and Real Estate",
        procedures: [
          { description: "Construction contract revenue recognition per IFRS 15 (over time)", isaRef: "ISA 540.18", type: "Substantive", assertions: ["Valuation/Accuracy", "Cut-off"] },
          { description: "Percentage of completion testing and cost-to-complete estimates", isaRef: "ISA 540.18", type: "Substantive", assertions: ["Valuation/Accuracy"] },
          { description: "Construction in progress physical inspection", isaRef: "ISA 501.4", type: "Substantive", assertions: ["Existence/Occurrence"] },
          { description: "Real estate inventory valuation and NRV testing", isaRef: "ISA 501.6", type: "Substantive", assertions: ["Valuation/Accuracy"] }
        ]
      },
      {
        name: "Technology and Software",
        procedures: [
          { description: "Software revenue recognition testing (SaaS, licenses, services)", isaRef: "ISA 500.A5", type: "Substantive", assertions: ["Valuation/Accuracy", "Cut-off"] },
          { description: "Deferred revenue testing for multi-period arrangements", isaRef: "ISA 500.A5", type: "Substantive", assertions: ["Completeness", "Valuation/Accuracy"] },
          { description: "Development cost capitalization criteria testing per IAS 38", isaRef: "ISA 500.A5", type: "Substantive", assertions: ["Valuation/Accuracy", "Classification"] },
          { description: "Stock-based compensation testing for tech employees", isaRef: "ISA 540.18", type: "Substantive", assertions: ["Valuation/Accuracy"] }
        ]
      },
      {
        name: "Healthcare and Pharmaceutical",
        procedures: [
          { description: "Drug Registration and regulatory compliance verification", isaRef: "ISA 250.14", type: "Control", assertions: ["Completeness"] },
          { description: "R&D expense vs capitalization testing", isaRef: "ISA 500.A5", type: "Substantive", assertions: ["Classification", "Valuation/Accuracy"] },
          { description: "Inventory expiry and obsolescence provision testing", isaRef: "ISA 501.6", type: "Substantive", assertions: ["Valuation/Accuracy"] },
          { description: "Clinical trial accrual and provision testing", isaRef: "ISA 540.18", type: "Substantive", assertions: ["Valuation/Accuracy"] }
        ]
      },
      {
        name: "Retail and Consumer",
        procedures: [
          { description: "Inventory shrinkage and markdown provision testing", isaRef: "ISA 501.6", type: "Substantive", assertions: ["Valuation/Accuracy"] },
          { description: "Loyalty program liability and revenue deferral testing", isaRef: "ISA 540.18", type: "Substantive", assertions: ["Valuation/Accuracy", "Completeness"] },
          { description: "Gift card breakage income testing", isaRef: "ISA 540.18", type: "Substantive", assertions: ["Valuation/Accuracy"] },
          { description: "Franchise revenue and fee testing", isaRef: "ISA 500.A5", type: "Substantive", assertions: ["Valuation/Accuracy"] }
        ]
      },
      {
        name: "Oil & Gas and Mining",
        procedures: [
          { description: "Reserves estimation and depletion calculation testing", isaRef: "ISA 540.18", type: "Substantive", assertions: ["Valuation/Accuracy"] },
          { description: "Exploration and evaluation expenditure capitalization per IFRS 6", isaRef: "ISA 500.A5", type: "Substantive", assertions: ["Classification", "Valuation/Accuracy"] },
          { description: "Asset retirement obligation provision testing", isaRef: "ISA 540.18", type: "Substantive", assertions: ["Valuation/Accuracy"] },
          { description: "Production sharing contract revenue testing", isaRef: "ISA 500.A5", type: "Substantive", assertions: ["Valuation/Accuracy"] }
        ]
      }
    ]
  },
  pakistan: {
    title: "Pakistan-Specific Procedures (ICAP/SECP/FBR)",
    categories: [
      {
        name: "Companies Act 2017 Compliance",
        procedures: [
          { description: "Verify compliance with statutory audit requirements under Companies Act 2017", isaRef: "ISA 250.12", type: "Substantive", assertions: ["Completeness"] },
          { description: "Review Directors' report contents per Fourth Schedule requirements", isaRef: "ISA 720.14", type: "Substantive", assertions: ["Presentation & Disclosure"] },
          { description: "Verify related party disclosures per Companies Act Section 207", isaRef: "ISA 550.25", type: "Substantive", assertions: ["Presentation & Disclosure"] },
          { description: "Test compliance with dividend distribution requirements", isaRef: "ISA 250.14", type: "Substantive", assertions: ["Completeness"] },
          { description: "Verify proper authorization and filing of forms with SECP", isaRef: "ISA 250.14", type: "Control", assertions: ["Completeness"] }
        ]
      },
      {
        name: "SECP Requirements",
        procedures: [
          { description: "Review compliance with Listed Companies Code of Corporate Governance", isaRef: "ISA 250.12", type: "Control", assertions: ["Completeness"] },
          { description: "Verify Audit Committee composition and meeting requirements", isaRef: "ISA 260.A1", type: "Control", assertions: ["Completeness"] },
          { description: "Test compliance with SECP notifications on financial reporting", isaRef: "ISA 250.14", type: "Substantive", assertions: ["Completeness"] },
          { description: "Review PSX listing requirements compliance for listed entities", isaRef: "ISA 250.14", type: "Substantive", assertions: ["Completeness"] }
        ]
      },
      {
        name: "FBR Tax Compliance",
        procedures: [
          { description: "Verify income tax computation and compliance with Income Tax Ordinance 2001", isaRef: "ISA 500.A5", type: "Substantive", assertions: ["Valuation/Accuracy"] },
          { description: "Test withholding tax deductions and deposits per ITO 2001", isaRef: "ISA 500.A5", type: "Substantive", assertions: ["Completeness"] },
          { description: "Review sales tax compliance and return filing", isaRef: "ISA 250.14", type: "Substantive", assertions: ["Completeness"] },
          { description: "Verify minimum tax and final tax regime applicability", isaRef: "ISA 500.A5", type: "Substantive", assertions: ["Valuation/Accuracy"] },
          { description: "Test transfer pricing compliance and documentation (Section 108)", isaRef: "ISA 550.23", type: "Substantive", assertions: ["Valuation/Accuracy"] },
          { description: "Review advance tax and tax credit computations", isaRef: "ISA 500.A5", type: "Substantive", assertions: ["Valuation/Accuracy"] }
        ]
      },
      {
        name: "ICAP Code of Ethics Requirements",
        procedures: [
          { description: "Verify independence requirements per IESBA/ICAP Code", isaRef: "ISQM 1", type: "Control", assertions: ["Completeness"] },
          { description: "Review objectivity and professional skepticism documentation", isaRef: "ISA 200.15", type: "Control", assertions: ["Completeness"] },
          { description: "Verify confidentiality safeguards for client information", isaRef: "IESBA 114", type: "Control", assertions: ["Completeness"] },
          { description: "Test compliance with engagement quality review requirements", isaRef: "ISQM 1.34", type: "Control", assertions: ["Completeness"] }
        ]
      },
      {
        name: "SBP Requirements (Banking)",
        procedures: [
          { description: "Verify compliance with State Bank Prudential Regulations", isaRef: "ISA 250.12", type: "Control", assertions: ["Completeness"] },
          { description: "Test loan classification and provisioning per SBP requirements", isaRef: "ISA 540.18", type: "Substantive", assertions: ["Valuation/Accuracy"] },
          { description: "Review capital adequacy ratio computation per Basel guidelines", isaRef: "ISA 500.A5", type: "Substantive", assertions: ["Valuation/Accuracy"] },
          { description: "Verify compliance with SBP circulars and directives", isaRef: "ISA 250.14", type: "Substantive", assertions: ["Completeness"] }
        ]
      }
    ]
  },
  uk: {
    title: "UK-Specific Procedures (FRC/Companies Act)",
    categories: [
      {
        name: "UK Companies Act 2006 Compliance",
        procedures: [
          { description: "Verify statutory audit requirements under UK Companies Act 2006", isaRef: "ISA 250.12", type: "Substantive", assertions: ["Completeness"] },
          { description: "Review Strategic Report and Directors' Report completeness", isaRef: "ISA 720.14", type: "Substantive", assertions: ["Presentation & Disclosure"] },
          { description: "Test distributable reserves calculation for dividend legality", isaRef: "ISA 500.A5", type: "Substantive", assertions: ["Valuation/Accuracy"] },
          { description: "Verify filing deadlines and Companies House submissions", isaRef: "ISA 250.14", type: "Control", assertions: ["Completeness"] }
        ]
      },
      {
        name: "FRC UK Corporate Governance Code",
        procedures: [
          { description: "Review compliance with UK Corporate Governance Code 2018", isaRef: "ISA 250.12", type: "Control", assertions: ["Completeness"] },
          { description: "Evaluate Board composition and independent director requirements", isaRef: "ISA 260.A1", type: "Control", assertions: ["Completeness"] },
          { description: "Review Audit Committee terms of reference and effectiveness", isaRef: "ISA 260.A1", type: "Control", assertions: ["Completeness"] },
          { description: "Verify viability statement and going concern disclosures", isaRef: "ISA 570.20", type: "Substantive", assertions: ["Presentation & Disclosure"] }
        ]
      },
      {
        name: "HMRC Tax Compliance",
        procedures: [
          { description: "Test corporation tax computation and payment compliance", isaRef: "ISA 500.A5", type: "Substantive", assertions: ["Valuation/Accuracy"] },
          { description: "Verify VAT returns and compliance with HMRC requirements", isaRef: "ISA 250.14", type: "Substantive", assertions: ["Completeness"] },
          { description: "Review PAYE and National Insurance compliance", isaRef: "ISA 500.A5", type: "Substantive", assertions: ["Completeness"] },
          { description: "Test MTD (Making Tax Digital) compliance where applicable", isaRef: "ISA 250.14", type: "Control", assertions: ["Completeness"] }
        ]
      }
    ]
  }
};

const ASSERTIONS = [
  "Existence/Occurrence",
  "Completeness",
  "Rights & Obligations",
  "Valuation/Accuracy",
  "Cut-off",
  "Classification",
  "Presentation & Disclosure"
];

const defaultTeamMembers = [
  { id: "partner", name: "Engagement Partner", role: "Partner" },
  { id: "manager", name: "Audit Manager", role: "Manager" },
  { id: "senior", name: "Senior Auditor", role: "Senior" },
  { id: "staff", name: "Staff Auditor", role: "Staff" },
];

export function AuditProgramSection({ 
  programs, 
  onProgramsChange, 
  overallMateriality = 1000000,
  performanceMateriality = 750000,
  industryType = "Manufacturing",
  companyProfile = {},
  engagementId
}: AuditProgramSectionProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAIGenerating, setIsAIGenerating] = useState(false);
  const [isPushingFromCoA, setIsPushingFromCoA] = useState(false);
  const [selectedLibraryProcedures, setSelectedLibraryProcedures] = useState<ProcedureItem[]>([]);
  const [isAIProcedureDialogOpen, setIsAIProcedureDialogOpen] = useState(false);
  const [aiProgramId, setAIProgramId] = useState<string | null>(null);
  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false);
  const [isProcedureLibraryOpen, setIsProcedureLibraryOpen] = useState(false);
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);
  const [newAccountHead, setNewAccountHead] = useState({
    accountHead: "",
    tbCoverage: "",
    materialityStatus: "Material" as "Material" | "Immaterial",
    riskLevel: "Medium" as "High" | "Medium" | "Low",
    assertions: [] as string[],
    openingBalance: 0,
    totalDr: 0,
    totalCr: 0,
    closingBalance: 0,
    accountCode: ""
  });

  // Push FS Line Items from Chart of Accounts
  const pushFromCoA = async () => {
    if (!engagementId) return;
    setIsPushingFromCoA(true);
    try {
      // Fetch CoA with balances
      const coaResponse = await fetchWithAuth(`/api/trial-balance/coa-with-balances/${engagementId}`);
      const coaData = await coaResponse.json();
      
      // Fetch GL summary for Dr/Cr totals
      const glResponse = await fetchWithAuth(`/api/trial-balance/gl-summary/${engagementId}`);
      const glData = await glResponse.json();
      const glSummary = glData.summary || {};
      
      if (coaData.accounts && coaData.accounts.length > 0) {
        // Filter accounts that have FS line item allocation
        const fsAccounts = coaData.accounts.filter((acc: any) => acc.fsLineItem);
        
        // Group by FS line item and aggregate
        const fsLineItemsMap = new Map<string, {
          accounts: any[];
          openingBalance: number;
          totalDr: number;
          totalCr: number;
          closingBalance: number;
        }>();
        
        fsAccounts.forEach((acc: any) => {
          const fsLine = acc.fsLineItem;
          if (!fsLineItemsMap.has(fsLine)) {
            fsLineItemsMap.set(fsLine, {
              accounts: [],
              openingBalance: 0,
              totalDr: 0,
              totalCr: 0,
              closingBalance: 0
            });
          }
          const item = fsLineItemsMap.get(fsLine)!;
          item.accounts.push(acc);
          
          const opening = parseFloat(acc.openingBalance || '0') || 0;
          const closing = parseFloat(acc.closingBalance || acc.balance || '0') || 0;
          const glEntry = glSummary[acc.accountCode] || { debit: 0, credit: 0 };
          
          item.openingBalance += opening;
          item.totalDr += glEntry.debit || 0;
          item.totalCr += glEntry.credit || 0;
          item.closingBalance += closing;
        });
        
        // Create new programs for FS line items not already present
        const existingHeads = programs.map(p => p.accountHead.toLowerCase());
        const newPrograms: AccountHeadProgram[] = [];
        
        fsLineItemsMap.forEach((data, fsLineItem) => {
          if (!existingHeads.includes(fsLineItem.toLowerCase())) {
            const isMaterial = Math.abs(data.closingBalance) >= performanceMateriality;
            newPrograms.push({
              id: `fs-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              accountHead: fsLineItem,
              description: `Aggregated from ${data.accounts.length} account(s)`,
              amount: data.closingBalance,
              openingBalance: data.openingBalance,
              totalDr: data.totalDr,
              totalCr: data.totalCr,
              closingBalance: data.closingBalance,
              accountCode: data.accounts.map((a: any) => a.accountCode).join(', '),
              tbCoverage: data.accounts.map((a: any) => a.accountName),
              materialityStatus: isMaterial ? "Material" : "Immaterial",
              riskLevel: "Medium",
              assertions: ["Existence", "Completeness", "Valuation/Accuracy"],
              procedures: [],
              isClubbed: data.accounts.length > 1,
              clubbedAccounts: data.accounts.length > 1 ? data.accounts.map((a: any) => a.accountName) : undefined
            });
          }
        });
        
        if (newPrograms.length > 0) {
          onProgramsChange([...programs, ...newPrograms]);
        }
      }
    } catch (error) {
      console.error("Error pushing from CoA:", error);
    } finally {
      setIsPushingFromCoA(false);
    }
  };

  const generateAuditProgram = async () => {
    setIsGenerating(true);
    try {
      const response = await fetchWithAuth("/api/audit-program/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountHeads: programs.map(p => ({
            name: p.accountHead,
            tbCoverage: p.tbCoverage,
            balance: 0,
            materialityStatus: p.materialityStatus,
            riskLevel: p.riskLevel,
            assertions: p.assertions
          })),
          overallMateriality,
          performanceMateriality,
          industryType,
          riskAssessment: "Based on planning phase assessment"
        })
      });
      
      const result = await response.json();
      if (result.success && result.data?.accounts) {
        const updatedPrograms = programs.map(program => {
          const aiProgram = result.data.accounts.find(
            (ap: any) => ap.accountHead.toLowerCase() === program.accountHead.toLowerCase()
          );
          if (aiProgram) {
            const newProcedures: AuditProcedure[] = aiProgram.procedures.map((proc: any, idx: number) => ({
              id: `ai-${program.id}-${idx}`,
              type: proc.type || "Substantive",
              description: proc.description,
              isaReference: proc.isaReference || "",
              status: "not-started",
              workpaperRef: "",
              performedBy: "",
              performedDate: "",
              reviewedBy: "",
              reviewedDate: "",
              findings: "",
              isCustom: false
            }));
            return { ...program, procedures: [...program.procedures, ...newProcedures] };
          }
          return program;
        });
        onProgramsChange(updatedPrograms);
      }
    } catch (error) {
      console.error("Error generating audit program:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const addManualAccountHead = () => {
    const newProgram: AccountHeadProgram = {
      id: `account-${Date.now()}`,
      accountHead: newAccountHead.accountHead,
      tbCoverage: newAccountHead.tbCoverage.split(",").map(s => s.trim()),
      materialityStatus: newAccountHead.materialityStatus,
      riskLevel: newAccountHead.riskLevel,
      assertions: newAccountHead.assertions,
      openingBalance: newAccountHead.openingBalance,
      totalDr: newAccountHead.totalDr,
      totalCr: newAccountHead.totalCr,
      closingBalance: newAccountHead.closingBalance,
      accountCode: newAccountHead.accountCode,
      procedures: [],
      isClubbed: false
    };
    onProgramsChange([...programs, newProgram]);
    setNewAccountHead({
      accountHead: "",
      tbCoverage: "",
      materialityStatus: "Material",
      riskLevel: "Medium",
      assertions: [],
      openingBalance: 0,
      totalDr: 0,
      totalCr: 0,
      closingBalance: 0,
      accountCode: ""
    });
    setIsAddAccountOpen(false);
  };

  const deleteProgram = (programId: string) => {
    onProgramsChange(programs.filter(p => p.id !== programId));
  };

  const addProcedureToProgram = (programId: string, procedure: Partial<AuditProcedure>) => {
    const updatedPrograms = programs.map(p => {
      if (p.id === programId) {
        const newProcedure: AuditProcedure = {
          id: `proc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: procedure.type || "Substantive",
          description: procedure.description || "",
          isaReference: procedure.isaReference || "",
          status: "not-started",
          workpaperRef: "",
          performedBy: "",
          performedDate: "",
          reviewedBy: "",
          reviewedDate: "",
          findings: "",
          isCustom: true
        };
        return { ...p, procedures: [...p.procedures, newProcedure] };
      }
      return p;
    });
    onProgramsChange(updatedPrograms);
  };

  const updateProcedure = (programId: string, procedureId: string, updates: Partial<AuditProcedure>) => {
    const updatedPrograms = programs.map(p => {
      if (p.id === programId) {
        return {
          ...p,
          procedures: p.procedures.map(proc => 
            proc.id === procedureId ? { ...proc, ...updates } : proc
          )
        };
      }
      return p;
    });
    onProgramsChange(updatedPrograms);
  };

  const deleteProcedure = (programId: string, procedureId: string) => {
    const updatedPrograms = programs.map(p => {
      if (p.id === programId) {
        return { ...p, procedures: p.procedures.filter(proc => proc.id !== procedureId) };
      }
      return p;
    });
    onProgramsChange(updatedPrograms);
  };

  const addSelectedLibraryProcedures = () => {
    if (!selectedProgramId || selectedLibraryProcedures.length === 0) return;
    
    selectedLibraryProcedures.forEach(proc => {
      addProcedureToProgram(selectedProgramId, { 
        description: proc.description, 
        type: proc.type,
        isaReference: proc.isaRef || ""
      });
    });
    setSelectedLibraryProcedures([]);
    setIsProcedureLibraryOpen(false);
  };

  // AI Procedure Generation for specific account head
  const generateAIProcedures = async (programId: string) => {
    const program = programs.find(p => p.id === programId);
    if (!program) return;

    setIsAIGenerating(true);
    setAIProgramId(programId);
    
    try {
      const response = await fetchWithAuth("/api/audit-program/generate-ai-procedures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountHead: program.accountHead,
          tbCoverage: program.tbCoverage,
          materialityStatus: program.materialityStatus,
          riskLevel: program.riskLevel,
          assertions: program.assertions,
          industryType,
          overallMateriality,
          performanceMateriality,
          existingProcedures: program.procedures.map(p => p.description),
          companyProfile: companyProfile
        })
      });
      
      const result = await response.json();
      if (result.success && result.data?.procedures) {
        const updatedPrograms = programs.map(p => {
          if (p.id === programId) {
            const newProcedures: AuditProcedure[] = result.data.procedures.map((proc: any, idx: number) => ({
              id: `ai-${programId}-${Date.now()}-${idx}`,
              type: proc.type || "Substantive",
              description: proc.description,
              isaReference: proc.isaReference || "",
              status: "not-started",
              workpaperRef: "",
              performedBy: "",
              performedDate: "",
              reviewedBy: "",
              reviewedDate: "",
              findings: "",
              isCustom: false
            }));
            return { ...p, procedures: [...p.procedures, ...newProcedures] };
          }
          return p;
        });
        onProgramsChange(updatedPrograms);
      }
    } catch (error) {
      console.error("Error generating AI procedures:", error);
    } finally {
      setIsAIGenerating(false);
      setAIProgramId(null);
    }
  };

  // Check if a procedure is selected in library
  const isProcedureSelected = (proc: ProcedureItem) => {
    return selectedLibraryProcedures.some(p => p.description === proc.description);
  };

  const toggleLibraryProcedure = (proc: ProcedureItem) => {
    if (isProcedureSelected(proc)) {
      setSelectedLibraryProcedures(selectedLibraryProcedures.filter(p => p.description !== proc.description));
    } else {
      setSelectedLibraryProcedures([...selectedLibraryProcedures, proc]);
    }
  };

  const completedCount = programs.reduce((acc, p) => 
    acc + p.procedures.filter(proc => proc.status === "completed").length, 0
  );
  const totalProcedures = programs.reduce((acc, p) => acc + p.procedures.length, 0);
  const progressPercent = totalProcedures > 0 ? Math.round((completedCount / totalProcedures) * 100) : 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              <div>
                <CardTitle>Audit Program - AI-Assisted Draft</CardTitle>
                <CardDescription>
                  Draft generated using Trial Balance and risk assessment. Subject to professional judgment.
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>{completedCount}/{totalProcedures} ({progressPercent}%)</span>
              </div>
              {engagementId && (
                <Button 
                  variant="outline" 
                  onClick={pushFromCoA} 
                  disabled={isPushingFromCoA}
                  data-testid="btn-push-from-coa"
                >
                  {isPushingFromCoA ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Push from CoA
                    </>
                  )}
                </Button>
              )}
              <Dialog open={isAddAccountOpen} onOpenChange={setIsAddAccountOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" data-testid="btn-add-line">
                    <Plus className="h-4 w-4 mr-1" />
                    Add Line
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New FS Line Item</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Account Head / FS Line Item</Label>
                      <Input 
                        value={newAccountHead.accountHead}
                        onChange={(e) => setNewAccountHead(prev => ({...prev, accountHead: e.target.value}))}
                        placeholder="e.g., Revenue from Operations, Trade Receivables"
                        data-testid="input-add-account-head"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Opening Balance</Label>
                        <Input 
                          type="number"
                          value={newAccountHead.openingBalance}
                          onChange={(e) => setNewAccountHead(prev => ({...prev, openingBalance: parseFloat(e.target.value) || 0}))}
                          placeholder="0"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Closing Balance</Label>
                        <Input 
                          type="number"
                          value={newAccountHead.closingBalance}
                          onChange={(e) => setNewAccountHead(prev => ({...prev, closingBalance: parseFloat(e.target.value) || 0}))}
                          placeholder="0"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Total Dr.</Label>
                        <Input 
                          type="number"
                          value={newAccountHead.totalDr}
                          onChange={(e) => setNewAccountHead(prev => ({...prev, totalDr: parseFloat(e.target.value) || 0}))}
                          placeholder="0"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Total Cr.</Label>
                        <Input 
                          type="number"
                          value={newAccountHead.totalCr}
                          onChange={(e) => setNewAccountHead(prev => ({...prev, totalCr: parseFloat(e.target.value) || 0}))}
                          placeholder="0"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Materiality</Label>
                        <Select 
                          value={newAccountHead.materialityStatus}
                          onValueChange={(v: "Material" | "Immaterial") => setNewAccountHead(prev => ({...prev, materialityStatus: v}))}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Material">Material</SelectItem>
                            <SelectItem value="Immaterial">Immaterial</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Risk Level</Label>
                        <Select 
                          value={newAccountHead.riskLevel}
                          onValueChange={(v: "High" | "Medium" | "Low") => setNewAccountHead(prev => ({...prev, riskLevel: v}))}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="High">High Risk</SelectItem>
                            <SelectItem value="Medium">Medium Risk</SelectItem>
                            <SelectItem value="Low">Low Risk</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>TB Coverage (Account Names)</Label>
                      <Input 
                        value={newAccountHead.tbCoverage}
                        onChange={(e) => setNewAccountHead(prev => ({...prev, tbCoverage: e.target.value}))}
                        placeholder="Comma-separated account names covered"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="outline">Cancel</Button>
                    </DialogClose>
                    <Button onClick={addManualAccountHead} data-testid="btn-confirm-add-line">Add Line</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Button onClick={generateAuditProgram} disabled={isGenerating}>
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4 mr-2" />
                    AI Generate Procedures
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <Sparkles className="h-5 w-5 text-blue-500" />
            <div className="flex-1">
              <p className="text-sm font-medium">AI-Assisted Audit Program</p>
              <p className="text-xs text-muted-foreground">
                Click "AI Generate Procedures" to automatically generate ISA-compliant audit procedures based on your account heads, 
                materiality levels, and risk assessment. You can also manually add procedures from the library or write custom ones.
              </p>
            </div>
          </div>

          <Accordion type="multiple" className="w-full">
            {programs.map((program) => (
              <AccordionItem key={program.id} value={program.id}>
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center justify-between w-full pr-4">
                    <div className="flex items-center gap-3">
                      <span className="font-medium">{program.accountHead}</span>
                      <Badge variant={program.materialityStatus === "Material" ? "default" : "secondary"}>
                        {program.materialityStatus}
                      </Badge>
                      <Badge variant={
                        program.riskLevel === "High" ? "destructive" : 
                        program.riskLevel === "Medium" ? "outline" : "secondary"
                      }>
                        {program.riskLevel} Risk
                      </Badge>
                      {program.isClubbed && (
                        <Badge variant="outline" className="text-orange-600">Clubbed</Badge>
                      )}
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {program.procedures.filter(p => p.status === "completed").length}/{program.procedures.length} completed
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
                    {/* Balance Summary Row */}
                    {(program.openingBalance !== undefined || program.closingBalance !== undefined) && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 bg-background rounded-md border">
                        <div className="text-center">
                          <Label className="text-xs text-muted-foreground block">Opening Balance</Label>
                          <p className="font-mono font-semibold text-sm">{formatAccounting(program.openingBalance)}</p>
                        </div>
                        <div className="text-center">
                          <Label className="text-xs text-muted-foreground block">Total Dr.</Label>
                          <p className="font-mono font-semibold text-sm text-green-600">{formatAccounting(program.totalDr)}</p>
                        </div>
                        <div className="text-center">
                          <Label className="text-xs text-muted-foreground block">Total Cr.</Label>
                          <p className="font-mono font-semibold text-sm text-red-600">{formatAccounting(program.totalCr)}</p>
                        </div>
                        <div className="text-center">
                          <Label className="text-xs text-muted-foreground block">Closing Balance</Label>
                          <p className="font-mono font-semibold text-sm text-primary">{formatAccounting(program.closingBalance)}</p>
                        </div>
                      </div>
                    )}
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <Label className="text-xs text-muted-foreground">TB Coverage</Label>
                        <p>{program.tbCoverage.join(", ")}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Relevant Assertions</Label>
                        <p>{program.assertions.join(", ")}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Risk Linkage</Label>
                        <p>Inherent Risk: {program.riskLevel}</p>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="font-medium">Audit Procedures</Label>
                        <div className="flex items-center gap-2">
                          <Dialog open={isProcedureLibraryOpen && selectedProgramId === program.id} onOpenChange={(open) => {
                            setIsProcedureLibraryOpen(open);
                            if (open) setSelectedProgramId(program.id);
                          }}>
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm">
                                <FileText className="h-4 w-4 mr-1" />
                                From Library
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-4xl max-h-[80vh]">
                              <DialogHeader>
                                <DialogTitle>Select Procedures from Library</DialogTitle>
                              </DialogHeader>
                              <ScrollArea className="h-[60vh] pr-4">
                                <Accordion type="multiple" className="w-full">
                                  {Object.entries(PROCEDURE_LIBRARY).map(([key, section]) => (
                                    <AccordionItem key={key} value={key}>
                                      <AccordionTrigger className="text-sm font-medium">{section.title}</AccordionTrigger>
                                      <AccordionContent>
                                        {section.categories.map((category, catIdx) => (
                                          <div key={catIdx} className="mb-4">
                                            <Label className="font-medium text-sm text-primary">{category.name}</Label>
                                            <div className="space-y-2 mt-2">
                                              {category.procedures.map((proc, procIdx) => (
                                                <div key={procIdx} className="flex items-start gap-2 p-2 rounded hover:bg-muted/50">
                                                  <Checkbox
                                                    id={`${key}-${catIdx}-${procIdx}`}
                                                    checked={isProcedureSelected(proc)}
                                                    onCheckedChange={() => toggleLibraryProcedure(proc)}
                                                  />
                                                  <label htmlFor={`${key}-${catIdx}-${procIdx}`} className="text-sm cursor-pointer flex-1">
                                                    <div className="flex items-start justify-between gap-2">
                                                      <span>{proc.description}</span>
                                                      <div className="flex items-center gap-1 flex-shrink-0">
                                                        {proc.isaRef && (
                                                          <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 dark:bg-blue-900/30">
                                                            {proc.isaRef}
                                                          </Badge>
                                                        )}
                                                        <Badge variant="secondary" className="text-xs">
                                                          {proc.type}
                                                        </Badge>
                                                      </div>
                                                    </div>
                                                  </label>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        ))}
                                      </AccordionContent>
                                    </AccordionItem>
                                  ))}
                                </Accordion>
                              </ScrollArea>
                              <DialogFooter>
                                <DialogClose asChild>
                                  <Button variant="outline">Cancel</Button>
                                </DialogClose>
                                <Button onClick={addSelectedLibraryProcedures} disabled={selectedLibraryProcedures.length === 0}>
                                  Add {selectedLibraryProcedures.length} Procedures
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                          <Button 
                            variant="default" 
                            size="sm" 
                            onClick={() => generateAIProcedures(program.id)}
                            disabled={isAIGenerating && aiProgramId === program.id}
                            data-testid={`btn-ai-procedures-${program.id}`}
                          >
                            {isAIGenerating && aiProgramId === program.id ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                Generating...
                              </>
                            ) : (
                              <>
                                <Sparkles className="h-4 w-4 mr-1" />
                                AI Procedure
                              </>
                            )}
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => addProcedureToProgram(program.id, {})} data-testid={`btn-add-custom-${program.id}`}>
                            <Plus className="h-4 w-4 mr-1" />
                            Add Custom
                          </Button>
                        </div>
                      </div>

                      {program.procedures.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p>No procedures yet. Add from library or write custom procedures.</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {program.procedures.map((procedure, idx) => (
                            <div key={procedure.id} className="border rounded-lg p-4 space-y-3">
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex items-start gap-3 flex-1">
                                  <span className="text-sm font-mono text-muted-foreground">{idx + 1}.</span>
                                  <div className="flex-1 space-y-2">
                                    <Textarea
                                      value={procedure.description}
                                      onChange={(e) => updateProcedure(program.id, procedure.id, { description: e.target.value })}
                                      placeholder="Describe the audit procedure..."
                                      rows={2}
                                      className="resize-y"
                                    />
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <Badge variant="outline" className="text-xs">
                                        {procedure.type}
                                      </Badge>
                                      {procedure.isaReference && (
                                        <Badge variant="secondary" className="text-xs">
                                          {procedure.isaReference}
                                        </Badge>
                                      )}
                                      {procedure.isCustom && (
                                        <Badge variant="outline" className="text-xs text-purple-600">Custom</Badge>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="text-destructive"
                                  onClick={() => deleteProcedure(program.id, procedure.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>

                              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                <div className="space-y-1">
                                  <Label className="text-xs">Type</Label>
                                  <Select 
                                    value={procedure.type}
                                    onValueChange={(v) => updateProcedure(program.id, procedure.id, { type: v as any })}
                                  >
                                    <SelectTrigger className="h-8 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="Control">Control</SelectItem>
                                      <SelectItem value="Substantive">Substantive</SelectItem>
                                      <SelectItem value="Analytical">Analytical</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Status</Label>
                                  <Select 
                                    value={procedure.status}
                                    onValueChange={(v) => updateProcedure(program.id, procedure.id, { status: v as any })}
                                  >
                                    <SelectTrigger className="h-8 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="not-started">Not Started</SelectItem>
                                      <SelectItem value="in-progress">In Progress</SelectItem>
                                      <SelectItem value="completed">Completed</SelectItem>
                                      <SelectItem value="na">N/A</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">W/P Ref</Label>
                                  <Input 
                                    value={procedure.workpaperRef}
                                    onChange={(e) => updateProcedure(program.id, procedure.id, { workpaperRef: e.target.value })}
                                    placeholder="WP-001"
                                    className="h-8 text-xs"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Performed By</Label>
                                  <Select 
                                    value={procedure.performedBy}
                                    onValueChange={(v) => updateProcedure(program.id, procedure.id, { performedBy: v })}
                                  >
                                    <SelectTrigger className="h-8 text-xs">
                                      <SelectValue placeholder="Select..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {defaultTeamMembers.map(m => (
                                        <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Reviewed By</Label>
                                  <Select 
                                    value={procedure.reviewedBy}
                                    onValueChange={(v) => updateProcedure(program.id, procedure.id, { reviewedBy: v })}
                                  >
                                    <SelectTrigger className="h-8 text-xs">
                                      <SelectValue placeholder="Select..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {defaultTeamMembers.map(m => (
                                        <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>

                              <div className="space-y-1">
                                <Label className="text-xs">Findings / Results</Label>
                                <Textarea
                                  value={procedure.findings}
                                  onChange={(e) => updateProcedure(program.id, procedure.id, { findings: e.target.value })}
                                  placeholder="Document findings and conclusions..."
                                  rows={2}
                                  className="text-sm"
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex justify-end pt-2">
                      <Button variant="destructive" size="sm" onClick={() => deleteProgram(program.id)}>
                        <Trash2 className="h-4 w-4 mr-1" />
                        Remove Account Head
                      </Button>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          <Dialog open={isAddAccountOpen} onOpenChange={setIsAddAccountOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Add Account Head
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Account Head</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Account Head Name <span className="text-destructive">*</span></Label>
                  <Input 
                    value={newAccountHead.accountHead}
                    onChange={(e) => setNewAccountHead({...newAccountHead, accountHead: e.target.value})}
                    placeholder="e.g., Revenue from Operations"
                  />
                </div>
                <div className="space-y-2">
                  <Label>TB Coverage (comma-separated)</Label>
                  <Input 
                    value={newAccountHead.tbCoverage}
                    onChange={(e) => setNewAccountHead({...newAccountHead, tbCoverage: e.target.value})}
                    placeholder="e.g., Sales - Local, Sales - Export, Discounts"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Materiality Status</Label>
                    <Select 
                      value={newAccountHead.materialityStatus}
                      onValueChange={(v) => setNewAccountHead({...newAccountHead, materialityStatus: v as any})}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Material">Material</SelectItem>
                        <SelectItem value="Immaterial">Immaterial</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Risk Level</Label>
                    <Select 
                      value={newAccountHead.riskLevel}
                      onValueChange={(v) => setNewAccountHead({...newAccountHead, riskLevel: v as any})}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="High">High</SelectItem>
                        <SelectItem value="Medium">Medium</SelectItem>
                        <SelectItem value="Low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Relevant Assertions</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {ASSERTIONS.map(assertion => (
                      <div key={assertion} className="flex items-center gap-2">
                        <Checkbox
                          id={`assertion-${assertion}`}
                          checked={newAccountHead.assertions.includes(assertion)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setNewAccountHead({...newAccountHead, assertions: [...newAccountHead.assertions, assertion]});
                            } else {
                              setNewAccountHead({...newAccountHead, assertions: newAccountHead.assertions.filter(a => a !== assertion)});
                            }
                          }}
                        />
                        <label htmlFor={`assertion-${assertion}`} className="text-sm">{assertion}</label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button onClick={addManualAccountHead} disabled={!newAccountHead.accountHead}>Add Account Head</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
}

export function createDefaultAuditPrograms(): AccountHeadProgram[] {
  return [
    {
      id: "revenue-1",
      accountHead: "Revenue from Operations",
      description: "Revenue from core business operations including local and export sales",
      amount: 125000000,
      tbCoverage: ["Sales - Local", "Sales - Export", "Discounts Allowed"],
      materialityStatus: "Material",
      riskLevel: "High",
      assertions: ["Existence/Occurrence", "Completeness", "Cut-off"],
      procedures: [],
      isClubbed: false,
      sampleSize: 25,
      sampleMethod: "Monetary Unit Sampling"
    },
    {
      id: "receivables-1",
      accountHead: "Trade Receivables",
      description: "Amounts due from customers for goods sold on credit",
      amount: 35000000,
      tbCoverage: ["Local Debtors", "Export Debtors"],
      materialityStatus: "Material",
      riskLevel: "Medium",
      assertions: ["Existence/Occurrence", "Valuation/Accuracy", "Rights & Obligations"],
      procedures: [],
      isClubbed: false,
      sampleSize: 15,
      sampleMethod: "Stratified Random Sampling"
    },
    {
      id: "inventory-1",
      accountHead: "Inventories",
      description: "Raw materials, work in progress, and finished goods held for sale",
      amount: 42000000,
      tbCoverage: ["Raw Materials", "Work in Progress", "Finished Goods"],
      materialityStatus: "Material",
      riskLevel: "High",
      assertions: ["Existence/Occurrence", "Valuation/Accuracy", "Completeness"],
      procedures: [],
      isClubbed: false,
      sampleSize: 30,
      sampleMethod: "Stratified Random Sampling"
    },
    {
      id: "ppe-1",
      accountHead: "Property, Plant & Equipment",
      description: "Fixed assets including land, buildings, machinery, and vehicles",
      amount: 85000000,
      tbCoverage: ["Land", "Buildings", "Plant & Machinery", "Vehicles"],
      materialityStatus: "Material",
      riskLevel: "Medium",
      assertions: ["Existence/Occurrence", "Valuation/Accuracy", "Rights & Obligations"],
      procedures: [],
      isClubbed: false,
      sampleSize: 20,
      sampleMethod: "Judgmental Sampling"
    },
    {
      id: "payables-1",
      accountHead: "Trade and Other Payables",
      description: "Amounts owed to suppliers and other creditors",
      amount: 28000000,
      tbCoverage: ["Trade Creditors", "Accrued Expenses", "Other Payables"],
      materialityStatus: "Material",
      riskLevel: "Medium",
      assertions: ["Completeness", "Valuation/Accuracy", "Cut-off"],
      procedures: [],
      isClubbed: false,
      sampleSize: 15,
      sampleMethod: "Stratified Random Sampling"
    },
    {
      id: "admin-expenses-1",
      accountHead: "Administrative & Operating Expenses - Clubbed",
      description: "General administrative and operating costs (clubbed due to immateriality)",
      amount: 4500000,
      tbCoverage: ["Office Expenses", "Printing & Stationery", "Utilities", "Conveyance", "Misc. Expenses"],
      materialityStatus: "Immaterial",
      riskLevel: "Low",
      assertions: ["Existence/Occurrence", "Valuation/Accuracy"],
      procedures: [],
      isClubbed: true,
      clubbedAccounts: ["Office Expenses", "Printing & Stationery", "Utilities", "Conveyance", "Misc. Expenses"],
      clubbingRationale: "Individually immaterial (< Performance Materiality threshold)",
      sampleSize: 10,
      sampleMethod: "Random Sampling"
    }
  ];
}
