import { Router, Response } from "express";
import { prisma } from "./db";
import { requireAuth, type AuthenticatedRequest } from "./auth";

const router = Router();

interface FSLevelRisk {
  id: string;
  description: string;
  source: string;
  severity: 'High' | 'Medium' | 'Low';
  impactedAreas: string[];
  isFraudIndicator: boolean;
}

interface AssertionLevelRisk {
  id: string;
  fsHeadKey: string;
  fsHeadLabel: string;
  assertion: string;
  inherentRisk: 'High' | 'Medium' | 'Low';
  controlRisk: 'High' | 'Medium' | 'Low';
  combinedRisk: 'High' | 'Medium' | 'Low';
  wcgw: string;
}

interface SignificantRisk {
  id: string;
  fsHeadKey: string;
  fsHeadLabel: string;
  assertion: string;
  riskDescription: string;
  rationale: string;
  isPresumedFraudRisk: boolean;
}

interface FraudRisk {
  id: string;
  type: 'Revenue Recognition' | 'Management Override' | 'Misappropriation' | 'Other';
  description: string;
  affectedAreas: string[];
  likelihood: 'High' | 'Medium' | 'Low';
  magnitude: 'High' | 'Medium' | 'Low';
}

interface MaterialityInputs {
  overallMateriality: number;
  performanceMateriality: number;
  trivialThreshold: number;
  fsHeadSpecificThresholds: FSHeadThreshold[];
}

interface FSHeadThreshold {
  fsHeadKey: string;
  fsHeadLabel: string;
  lowerMateriality: number;
  rationale: string;
}

interface StrategyApproach {
  controlsRelianceDecision: 'Full Reliance' | 'Partial Reliance' | 'No Reliance';
  auditApproach: 'Substantive-based' | 'Controls-reliant' | 'Combined';
  areasOfFocus: string[];
  substantiveEmphasis: string[];
  timingDirectives: TimingDirective[];
}

interface TimingDirective {
  fsHeadKey: string;
  timing: 'Interim' | 'Year-End' | 'Both';
  rationale: string;
}

interface SamplingData {
  populations: PopulationDefinition[];
  sampleSizeCalculations: SampleSizeCalculation[];
  stratificationPlans: StratificationPlan[];
  sampleList: SampleItem[];
}

interface PopulationDefinition {
  id: string;
  fsHeadKey: string;
  fsHeadLabel: string;
  assertion: string;
  description: string;
  periodCovered: { start: string; end: string };
  totalValue: number;
  totalTransactionCount: number;
  completenessConfirmed: boolean;
  completenessMethod: string;
  populationType: 'Transactions' | 'Balances' | 'Disclosures';
  sourceData: string;
}

interface SampleSizeCalculation {
  populationId: string;
  confidenceLevel: number;
  tolerableError: number;
  expectedError: number;
  baseSampleSize: number;
  finalSampleSize: number;
  calculationMethod: string;
}

interface StratificationPlan {
  populationId: string;
  isStratified: boolean;
  stratificationRationale: string;
  strata: Stratum[];
}

interface Stratum {
  id: string;
  populationId: string;
  stratumType: 'High-Value' | 'Unusual' | 'Related Party' | 'Manual Journal' | 'Year-End' | 'Post-Closing' | 'Standard';
  description: string;
  totalValue: number;
  transactionCount: number;
  samplingApproach: 'Key Item (100%)' | 'Sample' | 'Exclude';
  sampleSize: number | null;
  rationale: string;
}

interface SampleItem {
  id: string;
  transactionId: string;
  fsHeadKey: string;
  fsHeadLabel: string;
  assertion: string;
  amount: number;
  selectionMethod: string;
  populationReference: string;
  stratumReference: string | null;
  riskReference: string | null;
  testStatus: 'Planned' | 'In Progress' | 'Tested' | 'Exception' | 'N/A';
}

interface CoAMapping {
  fsHeadKey: string;
  fsHeadLabel: string;
  totalBalance: number;
  transactionCount: number;
  isMaterial: boolean;
}

interface ProcedureStep {
  stepNumber: number;
  action: string;
  expectedResult: string;
  evidenceRequired: string;
}

interface ProcedureLibraryItem {
  id: string;
  fsHeadKey: string;
  assertion: string;
  riskDriver: 'Fraud' | 'Judgment' | 'Volume' | 'Complexity' | 'IT' | 'Standard';
  industry: string | null;
  procedureType: 'ToC' | 'ToD' | 'SAP';
  objective: string;
  steps: ProcedureStep[];
  expectedEvidence: string[];
  conclusionCriteria: string;
  isaReference: string;
}

interface LinkedSample {
  sampleItemId: string;
  selectionMethodTag: string;
  stratumTag: string | null;
  testDesignOption: 'Test All' | 'Split by Sub-Assertion' | 'Split by Strata' | 'Manual Add-On' | 'Replacement';
}

interface ExecutionParameter {
  nature: 'ToC' | 'ToD' | 'SAP';
  timing: 'Interim' | 'Year-End' | 'Both';
  extent: number;
  evidenceRequirements: EvidenceRequirement[];
  reviewerLevel: 'Senior' | 'Manager' | 'Partner';
}

interface EvidenceRequirement {
  type: 'Document' | 'Confirmation' | 'Recalculation' | 'Inspection' | 'Inquiry' | 'Observation' | 'Reperformance';
  description: string;
  mandatory: boolean;
}

interface EvidenceSlot {
  slotId: string;
  evidenceType: string;
  status: 'Pending' | 'Uploaded' | 'Reviewed' | 'Approved';
  uploadedBy: string | null;
  uploadedAt: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
}

interface ExceptionLog {
  exceptionId: string;
  description: string;
  amount: number;
  status: 'Open' | 'Resolved' | 'Projected' | 'Waived';
  resolution: string | null;
  projectedMisstatement: number | null;
  createdBy: string;
  createdAt: string;
}

interface SignOffGate {
  level: 'Preparer' | 'Reviewer' | 'Manager' | 'Partner';
  required: boolean;
  signedOffBy: string | null;
  signedOffAt: string | null;
  comments: string | null;
}

interface ProcedurePack {
  id: string;
  fsHeadKey: string;
  fsHeadLabel: string;
  assertion: string;
  linkedRiskIds: string[];
  linkedSignificantRiskIds: string[];
  linkedFraudRiskIds: string[];
  materialityThreshold: number;
  controlsReliance: 'Full Reliance' | 'Partial Reliance' | 'No Reliance';
  procedures: AuditProcedure[];
  samplingStrategy: string;
  createdAt: string;
  updatedAt: string;
}

interface AuditProcedure {
  procedureId: string;
  fsHeadKey: string;
  fsHeadLabel: string;
  assertion: string;
  procedureType: 'ToC' | 'ToD' | 'SAP';
  source: 'Library' | 'AI Recommended' | 'Manual';
  isAIRecommended: boolean;
  aiApprovalStatus: 'Pending' | 'Approved' | 'Rejected' | null;
  aiApprovedBy: string | null;
  aiApprovedAt: string | null;
  objective: string;
  steps: ProcedureStep[];
  expectedEvidence: string[];
  conclusionCriteria: string;
  isaReference: string;
  linkedRiskIds: string[];
  linkedPopulationId: string | null;
  linkedSampleIds: LinkedSample[];
  executionParameters: ExecutionParameter;
  evidenceSlots: EvidenceSlot[];
  exceptionLogs: ExceptionLog[];
  executionStatus: 'Not Started' | 'In Progress' | 'Completed' | 'Blocked';
  preparer: string | null;
  preparerSignedAt: string | null;
  reviewer: string | null;
  reviewerSignedAt: string | null;
  signOffGates: SignOffGate[];
  conclusionTemplate: string;
  actualConclusion: string | null;
  workpaperReference: string | null;
  auditTrail: AuditTrailEntry[];
}

interface AuditTrailEntry {
  timestamp: string;
  userId: string;
  action: 'Created' | 'Updated' | 'Approved' | 'Rejected' | 'Linked' | 'Unlinked' | 'Signed Off' | 'Exception Added';
  details: string;
  previousValue: string | null;
  newValue: string | null;
}

interface ExecutionTask {
  taskId: string;
  procedureId: string;
  fsHeadKey: string;
  fsHeadLabel: string;
  assertion: string;
  sampleItemId: string | null;
  taskDescription: string;
  status: 'Pending' | 'In Progress' | 'Completed' | 'Blocked';
  assignedTo: string | null;
  dueDate: string | null;
  priority: 'High' | 'Medium' | 'Low';
  evidenceRequired: string[];
  createdAt: string;
}

interface QualityGate {
  passed: boolean;
  gate: string;
  message: string;
  isaReference: string;
}

interface QualityGates {
  usingSamplingPageSource: QualityGate;
  noOrphanSamples: QualityGate;
  noOrphanProcedures: QualityGate;
  allProceduresTiedToRisk: QualityGate;
  fullAuditTrail: QualityGate;
  isa330Compliant: QualityGate;
  executionReady: QualityGate;
  overallPassed: boolean;
}

interface DocumentationOutput {
  programScopeSummary: string;
  procedurePacksSummary: string;
  riskResponseSummary: string;
  samplingLinkageSummary: string;
  executionParametersSummary: string;
  qualityGatesSummary: string;
  isaReferences: string[];
}

interface AuditProgramResult {
  engagementId: string;
  analysisTimestamp: string;
  version: number;
  isLocked: boolean;
  lockedBy: string | null;
  lockedAt: string | null;
  step1_lockedInputs: {
    riskAssessment: {
      fsLevelRisks: FSLevelRisk[];
      assertionLevelRisks: AssertionLevelRisk[];
      significantRisks: SignificantRisk[];
      fraudRisks: FraudRisk[];
    };
    materiality: MaterialityInputs;
    strategyApproach: StrategyApproach;
    samplingData: SamplingData;
    coaMappings: CoAMapping[];
  };
  step2_procedurePacks: ProcedurePack[];
  step3_allProcedures: AuditProcedure[];
  step4_aiRecommendedProcedures: AuditProcedure[];
  step5_sampleLinkages: {
    procedureId: string;
    linkedSamples: LinkedSample[];
    validationStatus: 'Valid' | 'Invalid' | 'Pending';
    validationMessage: string;
  }[];
  step6_executionParameters: {
    procedureId: string;
    parameters: ExecutionParameter;
  }[];
  step7_procedureRecords: AuditProcedure[];
  step8_executionTasks: ExecutionTask[];
  step9_documentation: DocumentationOutput;
  qualityGates: QualityGates;
}

const FS_HEAD_LABELS: Record<string, string> = {
  CASH_EQUIVALENTS: "Cash and Cash Equivalents",
  TRADE_RECEIVABLES: "Trade Receivables",
  INVENTORIES: "Inventories",
  PPE: "Property, Plant & Equipment",
  INTANGIBLE_ASSETS: "Intangible Assets",
  TRADE_PAYABLES: "Trade Payables",
  BORROWINGS: "Borrowings",
  REVENUE: "Revenue",
  COST_OF_SALES: "Cost of Sales",
  PROVISIONS: "Provisions",
  SHARE_CAPITAL: "Share Capital",
  RETAINED_EARNINGS: "Retained Earnings",
  OTHER_INCOME: "Other Income",
  OPERATING_EXPENSES: "Operating Expenses",
  FINANCE_COSTS: "Finance Costs",
  TAX_EXPENSE: "Tax Expense",
  INVESTMENT_PROPERTY: "Investment Property",
  ACCRUED_EXPENSES: "Accrued Expenses",
  DEFERRED_TAX: "Deferred Tax",
};

const ASSERTIONS = [
  'Existence',
  'Completeness',
  'Accuracy',
  'Valuation',
  'Cut-off',
  'Classification',
  'Occurrence',
  'Rights & Obligations',
  'Presentation & Disclosure'
];

const PROCEDURE_LIBRARY: ProcedureLibraryItem[] = [
  {
    id: 'LIB-REV-EX-001',
    fsHeadKey: 'REVENUE',
    assertion: 'Existence',
    riskDriver: 'Standard',
    industry: null,
    procedureType: 'ToD',
    objective: 'Verify that recorded revenue transactions occurred and relate to the entity',
    steps: [
      { stepNumber: 1, action: 'Select sample of revenue transactions from sales ledger', expectedResult: 'Sample selected per sampling plan', evidenceRequired: 'Sample selection documentation' },
      { stepNumber: 2, action: 'Vouch to supporting sales invoice', expectedResult: 'Invoice agrees to recorded amount', evidenceRequired: 'Copy of sales invoice' },
      { stepNumber: 3, action: 'Verify delivery documentation (GDN/POD)', expectedResult: 'Goods delivered to customer', evidenceRequired: 'Delivery note/POD signed by customer' },
      { stepNumber: 4, action: 'Trace to customer order/contract', expectedResult: 'Valid customer order exists', evidenceRequired: 'Copy of customer order/contract' },
      { stepNumber: 5, action: 'Verify receipt of payment or AR recording', expectedResult: 'Payment received or valid receivable recorded', evidenceRequired: 'Bank statement or AR subledger' },
    ],
    expectedEvidence: ['Sales invoice', 'Delivery note', 'Customer order', 'Bank statement/AR aging'],
    conclusionCriteria: 'All sampled transactions exist and are supported by valid documentation',
    isaReference: 'ISA 330.18, ISA 500.A14'
  },
  {
    id: 'LIB-REV-COMP-001',
    fsHeadKey: 'REVENUE',
    assertion: 'Completeness',
    riskDriver: 'Standard',
    industry: null,
    procedureType: 'ToD',
    objective: 'Verify that all revenue transactions are recorded',
    steps: [
      { stepNumber: 1, action: 'Obtain sequence of GDNs/shipping documents for period', expectedResult: 'Complete sequence obtained', evidenceRequired: 'GDN register/log' },
      { stepNumber: 2, action: 'Select sample of GDNs near period end', expectedResult: 'Sample selected', evidenceRequired: 'Sample selection documentation' },
      { stepNumber: 3, action: 'Trace to sales invoice and revenue recording', expectedResult: 'Each delivery invoiced and recorded', evidenceRequired: 'Sales invoice and GL posting' },
      { stepNumber: 4, action: 'Verify recording in correct period', expectedResult: 'Revenue recorded in period of delivery', evidenceRequired: 'GL detail for revenue account' },
    ],
    expectedEvidence: ['GDN register', 'Sales invoices', 'GL postings'],
    conclusionCriteria: 'All deliveries have been invoiced and recorded as revenue',
    isaReference: 'ISA 330.18, ISA 500.A15'
  },
  {
    id: 'LIB-REV-CUT-001',
    fsHeadKey: 'REVENUE',
    assertion: 'Cut-off',
    riskDriver: 'Standard',
    industry: null,
    procedureType: 'ToD',
    objective: 'Verify that revenue transactions are recorded in the correct period',
    steps: [
      { stepNumber: 1, action: 'Select sample of sales invoices around period end (5 days before and after)', expectedResult: 'Sample selected spanning period end', evidenceRequired: 'Sales invoice listing with dates' },
      { stepNumber: 2, action: 'Verify delivery date from GDN/shipping documents', expectedResult: 'Delivery date documented', evidenceRequired: 'GDN/shipping document' },
      { stepNumber: 3, action: 'Compare delivery date to revenue recognition date', expectedResult: 'Revenue recognized when delivery occurred', evidenceRequired: 'GL posting date vs delivery date' },
      { stepNumber: 4, action: 'Document any cut-off errors identified', expectedResult: 'Cut-off errors quantified', evidenceRequired: 'Cut-off testing schedule' },
    ],
    expectedEvidence: ['Sales invoices', 'GDNs', 'GL postings', 'Cut-off schedule'],
    conclusionCriteria: 'Revenue is recorded in the period when goods/services are delivered',
    isaReference: 'ISA 330.18, ISA 500.A16'
  },
  {
    id: 'LIB-TR-EX-001',
    fsHeadKey: 'TRADE_RECEIVABLES',
    assertion: 'Existence',
    riskDriver: 'Standard',
    industry: null,
    procedureType: 'ToD',
    objective: 'Verify that trade receivables exist at period end',
    steps: [
      { stepNumber: 1, action: 'Obtain AR aging at period end', expectedResult: 'AR aging reconciles to GL', evidenceRequired: 'AR aging report' },
      { stepNumber: 2, action: 'Select sample for positive confirmation', expectedResult: 'Sample selected per ISA 505', evidenceRequired: 'Sample selection documentation' },
      { stepNumber: 3, action: 'Send confirmation requests to customers', expectedResult: 'Confirmations sent', evidenceRequired: 'Confirmation control log' },
      { stepNumber: 4, action: 'Evaluate responses received', expectedResult: 'Responses match recorded balances', evidenceRequired: 'Confirmation responses' },
      { stepNumber: 5, action: 'Perform alternative procedures for non-responses', expectedResult: 'Balance verified through alternatives', evidenceRequired: 'Subsequent receipts/invoices' },
    ],
    expectedEvidence: ['AR aging', 'Confirmation letters', 'Confirmation responses', 'Subsequent receipt evidence'],
    conclusionCriteria: 'Receivables exist and are owed by customers at period end',
    isaReference: 'ISA 330.18, ISA 505'
  },
  {
    id: 'LIB-TR-VAL-001',
    fsHeadKey: 'TRADE_RECEIVABLES',
    assertion: 'Valuation',
    riskDriver: 'Judgment',
    industry: null,
    procedureType: 'ToD',
    objective: 'Verify that trade receivables are stated at recoverable amount',
    steps: [
      { stepNumber: 1, action: 'Obtain AR aging analysis', expectedResult: 'Aging analysis obtained', evidenceRequired: 'AR aging by aging bucket' },
      { stepNumber: 2, action: 'Review management ECL/provision calculation', expectedResult: 'Calculation methodology understood', evidenceRequired: 'ECL calculation workpaper' },
      { stepNumber: 3, action: 'Test mathematical accuracy of provision', expectedResult: 'Calculation is accurate', evidenceRequired: 'Recalculation workpaper' },
      { stepNumber: 4, action: 'Review historical write-off rates', expectedResult: 'Historical rates support provision', evidenceRequired: 'Historical bad debt analysis' },
      { stepNumber: 5, action: 'Review post-period collections for old balances', expectedResult: 'Recoverability assessed', evidenceRequired: 'Subsequent collection report' },
    ],
    expectedEvidence: ['AR aging', 'ECL calculation', 'Historical write-offs', 'Subsequent collections'],
    conclusionCriteria: 'Provision for doubtful debts is adequate based on recoverability assessment',
    isaReference: 'ISA 330.18, ISA 540'
  },
  {
    id: 'LIB-INV-EX-001',
    fsHeadKey: 'INVENTORIES',
    assertion: 'Existence',
    riskDriver: 'Standard',
    industry: null,
    procedureType: 'ToD',
    objective: 'Verify that inventories exist at period end',
    steps: [
      { stepNumber: 1, action: 'Attend physical inventory count', expectedResult: 'Count attendance completed', evidenceRequired: 'Count attendance memo' },
      { stepNumber: 2, action: 'Perform test counts (floor to sheet and sheet to floor)', expectedResult: 'Test counts agree', evidenceRequired: 'Test count working paper' },
      { stepNumber: 3, action: 'Observe count procedures and controls', expectedResult: 'Procedures are adequate', evidenceRequired: 'Observation notes' },
      { stepNumber: 4, action: 'Document cut-off information', expectedResult: 'Last GRN/GDN noted', evidenceRequired: 'Cut-off information sheet' },
      { stepNumber: 5, action: 'Trace test counts to final inventory listing', expectedResult: 'Counts agree to final listing', evidenceRequired: 'Inventory count reconciliation' },
    ],
    expectedEvidence: ['Count attendance memo', 'Test counts', 'Cut-off information', 'Final inventory listing'],
    conclusionCriteria: 'Physical inventory exists and count procedures are adequate',
    isaReference: 'ISA 330.18, ISA 501'
  },
  {
    id: 'LIB-INV-VAL-001',
    fsHeadKey: 'INVENTORIES',
    assertion: 'Valuation',
    riskDriver: 'Judgment',
    industry: null,
    procedureType: 'ToD',
    objective: 'Verify that inventories are stated at lower of cost and NRV',
    steps: [
      { stepNumber: 1, action: 'Test costing of sample items to purchase invoices/cost records', expectedResult: 'Costs are accurate', evidenceRequired: 'Purchase invoices, cost cards' },
      { stepNumber: 2, action: 'Verify overhead allocation methodology', expectedResult: 'Allocation is appropriate', evidenceRequired: 'Overhead allocation calculation' },
      { stepNumber: 3, action: 'Review slow-moving inventory report', expectedResult: 'Slow-moving items identified', evidenceRequired: 'Inventory aging report' },
      { stepNumber: 4, action: 'Test NRV calculation for selected items', expectedResult: 'NRV exceeds cost or provision exists', evidenceRequired: 'Sales prices, provision calculation' },
      { stepNumber: 5, action: 'Review subsequent sales prices', expectedResult: 'NRV assessment is appropriate', evidenceRequired: 'Post-period sales data' },
    ],
    expectedEvidence: ['Cost records', 'Overhead allocation', 'Slow-moving report', 'NRV testing'],
    conclusionCriteria: 'Inventory is stated at lower of cost and NRV',
    isaReference: 'ISA 330.18, ISA 540'
  },
  {
    id: 'LIB-PPE-EX-001',
    fsHeadKey: 'PPE',
    assertion: 'Existence',
    riskDriver: 'Standard',
    industry: null,
    procedureType: 'ToD',
    objective: 'Verify that property, plant and equipment exist',
    steps: [
      { stepNumber: 1, action: 'Obtain fixed asset register at period end', expectedResult: 'FAR reconciles to GL', evidenceRequired: 'Fixed asset register' },
      { stepNumber: 2, action: 'Select sample of significant additions', expectedResult: 'Sample selected', evidenceRequired: 'Sample selection documentation' },
      { stepNumber: 3, action: 'Physically verify existence of additions', expectedResult: 'Assets physically exist', evidenceRequired: 'Physical verification memo' },
      { stepNumber: 4, action: 'Vouch to purchase documentation', expectedResult: 'Valid purchase exists', evidenceRequired: 'Purchase invoice, GRN' },
      { stepNumber: 5, action: 'Select sample from register and physically verify', expectedResult: 'Register items exist', evidenceRequired: 'Physical verification documentation' },
    ],
    expectedEvidence: ['Fixed asset register', 'Purchase invoices', 'Physical verification memo'],
    conclusionCriteria: 'PPE items recorded exist and are in use',
    isaReference: 'ISA 330.18, ISA 500.A14'
  },
  {
    id: 'LIB-TP-COMP-001',
    fsHeadKey: 'TRADE_PAYABLES',
    assertion: 'Completeness',
    riskDriver: 'Standard',
    industry: null,
    procedureType: 'ToD',
    objective: 'Verify that all trade payables are recorded',
    steps: [
      { stepNumber: 1, action: 'Obtain AP aging at period end', expectedResult: 'AP aging reconciles to GL', evidenceRequired: 'AP aging report' },
      { stepNumber: 2, action: 'Review GRNs near period end for unrecorded liabilities', expectedResult: 'All receipts recorded as payables', evidenceRequired: 'GRN register, unrecorded invoice search' },
      { stepNumber: 3, action: 'Send confirmation requests to key suppliers', expectedResult: 'Confirmations sent', evidenceRequired: 'Confirmation control log' },
      { stepNumber: 4, action: 'Review subsequent payments for unrecorded liabilities', expectedResult: 'No material unrecorded liabilities', evidenceRequired: 'Post-period payment listing' },
      { stepNumber: 5, action: 'Review supplier statements reconciliations', expectedResult: 'Reconciliations support balances', evidenceRequired: 'Supplier statement reconciliations' },
    ],
    expectedEvidence: ['AP aging', 'GRN register', 'Confirmations', 'Subsequent payments', 'Statement reconciliations'],
    conclusionCriteria: 'All liabilities are recorded at period end',
    isaReference: 'ISA 330.18, ISA 505'
  },
  {
    id: 'LIB-TOC-REV-001',
    fsHeadKey: 'REVENUE',
    assertion: 'Occurrence',
    riskDriver: 'Standard',
    industry: null,
    procedureType: 'ToC',
    objective: 'Test operating effectiveness of controls over revenue recognition',
    steps: [
      { stepNumber: 1, action: 'Identify key controls over revenue cycle', expectedResult: 'Controls identified and documented', evidenceRequired: 'Controls matrix' },
      { stepNumber: 2, action: 'Select sample of transactions for control testing', expectedResult: 'Sample selected', evidenceRequired: 'Sample selection documentation' },
      { stepNumber: 3, action: 'Test evidence of control operation', expectedResult: 'Control operated as designed', evidenceRequired: 'Approval signatures, system logs' },
      { stepNumber: 4, action: 'Test segregation of duties', expectedResult: 'Duties are appropriately segregated', evidenceRequired: 'User access listings, org chart' },
      { stepNumber: 5, action: 'Evaluate control deviations if any', expectedResult: 'Deviations evaluated for impact', evidenceRequired: 'Deviation analysis' },
    ],
    expectedEvidence: ['Controls matrix', 'Approval evidence', 'User access', 'Deviation analysis'],
    conclusionCriteria: 'Controls over revenue are operating effectively',
    isaReference: 'ISA 330.8-9, ISA 330.A20'
  },
];

function generateUniqueId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function extractLockedInputs(engagement: any, planningData: any, coaAccounts: any[], riskAssessments: any[]): AuditProgramResult['step1_lockedInputs'] {
  const riskData = planningData?.aiRiskAssessment || planningData?.riskAssessment || {};
  const materialityData = planningData?.isa320MaterialityAnalysis?.step4_materialityLevels || planningData?.materiality || {};
  const strategyData = planningData?.isa300AuditStrategy || {};
  const samplingData = planningData?.isa530AuditSampling || {};

  const fsLevelRisks: FSLevelRisk[] = (riskData.fsLevelRisks || []).map((r: any, idx: number) => ({
    id: r.id || `FSR-${String(idx + 1).padStart(3, '0')}`,
    description: r.riskDescription || r.description || 'Unspecified FS-level risk',
    source: r.source || 'Entity',
    severity: r.severity || r.riskRating || 'Medium',
    impactedAreas: r.impactedFsAreas || r.impactedAreas || [],
    isFraudIndicator: r.isFraudIndicator || false,
  }));

  const assertionLevelRisks: AssertionLevelRisk[] = (riskData.assertionLevelRisks || riskAssessments || []).map((r: any, idx: number) => ({
    id: r.id || `ALR-${String(idx + 1).padStart(3, '0')}`,
    fsHeadKey: r.fsHeadKey || r.accountOrClass || 'UNSPECIFIED',
    fsHeadLabel: r.fsHeadLabel || FS_HEAD_LABELS[r.fsHeadKey] || r.fsHeadKey,
    assertion: r.assertion || r.affectedAssertion || 'Unspecified',
    inherentRisk: r.inherentRisk || 'Medium',
    controlRisk: r.controlRisk || 'Medium',
    combinedRisk: r.combinedRisk || r.riskRating || 'Medium',
    wcgw: r.wcgw || r.whatCouldGoWrong || `Misstatement in ${r.assertion || 'assertion'}`,
  }));

  const significantRisks: SignificantRisk[] = (riskData.significantRisks ||
    assertionLevelRisks.filter((r: AssertionLevelRisk) => r.combinedRisk === 'High')).map((r: any, idx: number) => ({
    id: r.id || `SIG-${String(idx + 1).padStart(3, '0')}`,
    fsHeadKey: r.fsHeadKey || 'UNSPECIFIED',
    fsHeadLabel: r.fsHeadLabel || FS_HEAD_LABELS[r.fsHeadKey] || r.fsHeadKey,
    assertion: r.assertion || 'Multiple',
    riskDescription: r.riskDescription || r.wcgw || 'Significant risk',
    rationale: r.rationale || 'Risk rated as high per risk assessment',
    isPresumedFraudRisk: r.isPresumedFraudRisk || r.isFraudIndicator || false,
  }));

  const fraudRisks: FraudRisk[] = (riskData.fraudRisks || []).map((r: any, idx: number) => ({
    id: r.id || `FRAUD-${String(idx + 1).padStart(3, '0')}`,
    type: r.type || 'Other',
    description: r.description || r.riskDescription || 'Fraud risk identified',
    affectedAreas: r.affectedAreas || r.impactedFsAreas || ['Revenue', 'Cash'],
    likelihood: r.likelihood || 'Medium',
    magnitude: r.magnitude || 'High',
  }));

  if (fraudRisks.length === 0) {
    fraudRisks.push({
      id: 'FRAUD-001',
      type: 'Revenue Recognition',
      description: 'Presumed fraud risk in revenue recognition per ISA 240.26',
      affectedAreas: ['REVENUE', 'TRADE_RECEIVABLES'],
      likelihood: 'Medium',
      magnitude: 'High',
    });
    fraudRisks.push({
      id: 'FRAUD-002',
      type: 'Management Override',
      description: 'Presumed risk of management override of controls per ISA 240.31',
      affectedAreas: ['All FS Areas'],
      likelihood: 'Medium',
      magnitude: 'High',
    });
  }

  const materiality: MaterialityInputs = {
    overallMateriality: materialityData.overallMateriality || 100000,
    performanceMateriality: materialityData.performanceMateriality || (materialityData.overallMateriality * 0.75) || 75000,
    trivialThreshold: materialityData.trivialThreshold || (materialityData.overallMateriality * 0.05) || 5000,
    fsHeadSpecificThresholds: (materialityData.fsHeadSpecificThresholds || []).map((t: any) => ({
      fsHeadKey: t.fsHeadKey,
      fsHeadLabel: t.fsHeadLabel || FS_HEAD_LABELS[t.fsHeadKey] || t.fsHeadKey,
      lowerMateriality: t.lowerMateriality,
      rationale: t.rationale || 'Specific risk consideration',
    })),
  };

  const controlReliance = strategyData.step2_overallAuditApproach?.controlEnvironmentAssessment === 'Strong'
    ? 'Full Reliance'
    : strategyData.step2_overallAuditApproach?.controlEnvironmentAssessment === 'Weak'
      ? 'No Reliance'
      : 'Partial Reliance';

  const strategyApproach: StrategyApproach = {
    controlsRelianceDecision: controlReliance as 'Full Reliance' | 'Partial Reliance' | 'No Reliance',
    auditApproach: strategyData.step2_overallAuditApproach?.approachType || 'Combined',
    areasOfFocus: (strategyData.step3_scopeTimingDirection?.scope?.fsAreasOfFocus || [])
      .filter((f: any) => f.focusLevel === 'Primary')
      .map((f: any) => f.fsHeadLabel),
    substantiveEmphasis: strategyData.step3_scopeTimingDirection?.direction?.highRiskEmphasis || [],
    timingDirectives: (strategyData.step3_scopeTimingDirection?.timing?.interimWorkScope || []).map((area: string) => ({
      fsHeadKey: area,
      timing: 'Interim' as const,
      rationale: 'Interim work planned per audit strategy',
    })),
  };

  const populations: PopulationDefinition[] = (samplingData.step2_populations || []).map((p: any) => ({
    id: p.id,
    fsHeadKey: p.fsHeadKey,
    fsHeadLabel: p.fsHeadLabel || FS_HEAD_LABELS[p.fsHeadKey] || p.fsHeadKey,
    assertion: p.assertion,
    description: p.description,
    periodCovered: p.periodCovered || { start: '', end: '' },
    totalValue: p.totalValue || 0,
    totalTransactionCount: p.totalTransactionCount || 0,
    completenessConfirmed: p.completenessConfirmed || false,
    completenessMethod: p.completenessMethod || 'GL reconciliation',
    populationType: p.populationType || 'Transactions',
    sourceData: p.sourceData || 'GL data',
  }));

  const sampleSizeCalculations: SampleSizeCalculation[] = (samplingData.step4_sampleSizeCalculations || []).map((c: any) => ({
    populationId: c.populationId,
    confidenceLevel: c.confidenceLevel || 95,
    tolerableError: c.tolerableError || materiality.performanceMateriality,
    expectedError: c.expectedError || 0,
    baseSampleSize: c.baseSampleSize || 25,
    finalSampleSize: c.finalSampleSize || 25,
    calculationMethod: c.calculationMethod || 'Non-Statistical',
  }));

  const stratificationPlans: StratificationPlan[] = (samplingData.step5_stratificationPlans || []).map((p: any) => ({
    populationId: p.populationId,
    isStratified: p.isStratified || false,
    stratificationRationale: p.stratificationRationale || '',
    strata: (p.strata || []).map((s: any) => ({
      id: s.id,
      populationId: s.populationId,
      stratumType: s.stratumType || 'Standard',
      description: s.description || '',
      totalValue: s.totalValue || 0,
      transactionCount: s.transactionCount || 0,
      samplingApproach: s.samplingApproach || 'Sample',
      sampleSize: s.sampleSize,
      rationale: s.rationale || '',
    })),
  }));

  const sampleList: SampleItem[] = (samplingData.step7_sampleList || []).map((s: any) => ({
    id: s.id,
    transactionId: s.transactionId,
    fsHeadKey: s.fsHeadKey,
    fsHeadLabel: s.fsHeadLabel || FS_HEAD_LABELS[s.fsHeadKey] || s.fsHeadKey,
    assertion: s.assertion,
    amount: s.amount || 0,
    selectionMethod: s.selectionMethod || 'Random',
    populationReference: s.populationReference,
    stratumReference: s.stratumReference,
    riskReference: s.riskReference,
    testStatus: s.testStatus || 'Planned',
  }));

  const fsHeadGroups = new Map<string, { balance: number; transactionCount: number }>();
  for (const acc of coaAccounts) {
    const fsHead = acc.fsLineItem || acc.tbGroup || 'OTHER';
    const fsHeadKey = fsHead.toUpperCase().replace(/\s+/g, '_');
    if (!fsHeadGroups.has(fsHeadKey)) {
      fsHeadGroups.set(fsHeadKey, { balance: 0, transactionCount: 0 });
    }
    const group = fsHeadGroups.get(fsHeadKey)!;
    group.balance += Number(acc.closingBalance) || 0;
    group.transactionCount += Number(acc.transactionCount) || 1;
  }

  const coaMappings: CoAMapping[] = Array.from(fsHeadGroups.entries()).map(([key, group]) => ({
    fsHeadKey: key,
    fsHeadLabel: FS_HEAD_LABELS[key] || key,
    totalBalance: group.balance,
    transactionCount: group.transactionCount,
    isMaterial: Math.abs(group.balance) > materiality.overallMateriality,
  }));

  return {
    riskAssessment: { fsLevelRisks, assertionLevelRisks, significantRisks, fraudRisks },
    materiality,
    strategyApproach,
    samplingData: { populations, sampleSizeCalculations, stratificationPlans, sampleList },
    coaMappings,
  };
}

function buildProcedurePacks(
  inputs: AuditProgramResult['step1_lockedInputs']
): ProcedurePack[] {
  const packs: ProcedurePack[] = [];
  const now = new Date().toISOString();

  const materialFsHeads = inputs.coaMappings.filter(m => m.isMaterial);
  const highRiskFsHeads = new Set(
    inputs.riskAssessment.assertionLevelRisks
      .filter(r => r.combinedRisk === 'High')
      .map(r => r.fsHeadKey)
  );
  const significantRiskFsHeads = new Set(inputs.riskAssessment.significantRisks.map(r => r.fsHeadKey));
  const fraudRiskFsHeads = new Set(
    inputs.riskAssessment.fraudRisks.flatMap(f => f.affectedAreas)
  );

  const relevantFsHeads = new Set<string>();
  materialFsHeads.forEach(m => relevantFsHeads.add(m.fsHeadKey));
  highRiskFsHeads.forEach(k => relevantFsHeads.add(k));
  significantRiskFsHeads.forEach(k => relevantFsHeads.add(k));
  fraudRiskFsHeads.forEach(k => {
    if (k !== 'All FS Areas') relevantFsHeads.add(k);
  });

  for (const fsHeadKey of relevantFsHeads) {
    const relevantAssertions = new Set<string>();
    
    inputs.riskAssessment.assertionLevelRisks
      .filter(r => r.fsHeadKey === fsHeadKey && r.combinedRisk !== 'Low')
      .forEach(r => relevantAssertions.add(r.assertion));

    inputs.riskAssessment.significantRisks
      .filter(r => r.fsHeadKey === fsHeadKey)
      .forEach(r => relevantAssertions.add(r.assertion));

    if (relevantAssertions.size === 0) {
      relevantAssertions.add('Existence');
      relevantAssertions.add('Completeness');
      relevantAssertions.add('Accuracy');
    }

    for (const assertion of relevantAssertions) {
      const linkedRisks = inputs.riskAssessment.assertionLevelRisks
        .filter(r => r.fsHeadKey === fsHeadKey && r.assertion === assertion)
        .map(r => r.id);

      const linkedSigRisks = inputs.riskAssessment.significantRisks
        .filter(r => r.fsHeadKey === fsHeadKey && (r.assertion === assertion || r.assertion === 'Multiple'))
        .map(r => r.id);

      const linkedFraudRisks = inputs.riskAssessment.fraudRisks
        .filter(f => f.affectedAreas.includes(fsHeadKey) || f.affectedAreas.includes('All FS Areas'))
        .map(f => f.id);

      const fsHeadThreshold = inputs.materiality.fsHeadSpecificThresholds.find(t => t.fsHeadKey === fsHeadKey);
      const materialityThreshold = fsHeadThreshold?.lowerMateriality || inputs.materiality.performanceMateriality;

      const population = inputs.samplingData.populations.find(
        p => p.fsHeadKey === fsHeadKey && p.assertion === assertion
      );

      const procedures = selectBaseProcedures(fsHeadKey, assertion, inputs.strategyApproach.controlsRelianceDecision);

      packs.push({
        id: generateUniqueId('PACK'),
        fsHeadKey,
        fsHeadLabel: FS_HEAD_LABELS[fsHeadKey] || fsHeadKey,
        assertion,
        linkedRiskIds: linkedRisks,
        linkedSignificantRiskIds: linkedSigRisks,
        linkedFraudRiskIds: linkedFraudRisks,
        materialityThreshold,
        controlsReliance: inputs.strategyApproach.controlsRelianceDecision,
        procedures: procedures.map(p => createProcedureFromLibrary(p, fsHeadKey, assertion, linkedRisks, population?.id || null)),
        samplingStrategy: population ? 'Sample-based testing per ISA 530' : 'Balance testing',
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  return packs;
}

function selectBaseProcedures(
  fsHeadKey: string,
  assertion: string,
  controlsReliance: 'Full Reliance' | 'Partial Reliance' | 'No Reliance'
): ProcedureLibraryItem[] {
  const selected: ProcedureLibraryItem[] = [];

  const matchingProcedures = PROCEDURE_LIBRARY.filter(
    p => p.fsHeadKey === fsHeadKey && p.assertion === assertion
  );

  if (matchingProcedures.length > 0) {
    selected.push(...matchingProcedures);
  } else {
    const generalProcedures = PROCEDURE_LIBRARY.filter(
      p => p.assertion === assertion && p.riskDriver === 'Standard'
    );
    if (generalProcedures.length > 0) {
      selected.push(generalProcedures[0]);
    }
  }

  if (controlsReliance !== 'No Reliance') {
    const tocProcedures = PROCEDURE_LIBRARY.filter(
      p => p.fsHeadKey === fsHeadKey && p.procedureType === 'ToC'
    );
    if (tocProcedures.length > 0) {
      selected.push(tocProcedures[0]);
    }
  }

  return selected;
}

function createProcedureFromLibrary(
  libraryItem: ProcedureLibraryItem,
  fsHeadKey: string,
  assertion: string,
  linkedRiskIds: string[],
  populationId: string | null
): AuditProcedure {
  const now = new Date().toISOString();

  return {
    procedureId: generateUniqueId('PROC'),
    fsHeadKey,
    fsHeadLabel: FS_HEAD_LABELS[fsHeadKey] || fsHeadKey,
    assertion,
    procedureType: libraryItem.procedureType,
    source: 'Library',
    isAIRecommended: false,
    aiApprovalStatus: null,
    aiApprovedBy: null,
    aiApprovedAt: null,
    objective: libraryItem.objective,
    steps: libraryItem.steps,
    expectedEvidence: libraryItem.expectedEvidence,
    conclusionCriteria: libraryItem.conclusionCriteria,
    isaReference: libraryItem.isaReference,
    linkedRiskIds,
    linkedPopulationId: populationId,
    linkedSampleIds: [],
    executionParameters: {
      nature: libraryItem.procedureType,
      timing: 'Year-End',
      extent: 100,
      evidenceRequirements: libraryItem.expectedEvidence.map(e => ({
        type: 'Document' as const,
        description: e,
        mandatory: true,
      })),
      reviewerLevel: linkedRiskIds.length > 0 ? 'Manager' : 'Senior',
    },
    evidenceSlots: libraryItem.expectedEvidence.map((e, idx) => ({
      slotId: generateUniqueId('EV'),
      evidenceType: e,
      status: 'Pending',
      uploadedBy: null,
      uploadedAt: null,
      reviewedBy: null,
      reviewedAt: null,
    })),
    exceptionLogs: [],
    executionStatus: 'Not Started',
    preparer: null,
    preparerSignedAt: null,
    reviewer: null,
    reviewerSignedAt: null,
    signOffGates: [
      { level: 'Preparer', required: true, signedOffBy: null, signedOffAt: null, comments: null },
      { level: 'Reviewer', required: true, signedOffBy: null, signedOffAt: null, comments: null },
      { level: 'Manager', required: linkedRiskIds.length > 0, signedOffBy: null, signedOffAt: null, comments: null },
    ],
    conclusionTemplate: `Based on the procedures performed, [we conclude that / we identified the following exceptions:] ${libraryItem.conclusionCriteria}`,
    actualConclusion: null,
    workpaperReference: null,
    auditTrail: [{
      timestamp: now,
      userId: 'system',
      action: 'Created',
      details: `Procedure created from library item ${libraryItem.id}`,
      previousValue: null,
      newValue: libraryItem.id,
    }],
  };
}

function generateAIRecommendedProcedures(
  inputs: AuditProgramResult['step1_lockedInputs'],
  existingProcedures: AuditProcedure[]
): AuditProcedure[] {
  const aiProcedures: AuditProcedure[] = [];
  const now = new Date().toISOString();

  for (const sigRisk of inputs.riskAssessment.significantRisks) {
    const existingForRisk = existingProcedures.filter(
      p => p.fsHeadKey === sigRisk.fsHeadKey && p.linkedRiskIds.includes(sigRisk.id)
    );

    if (existingForRisk.length < 2) {
      aiProcedures.push({
        procedureId: generateUniqueId('AI-PROC'),
        fsHeadKey: sigRisk.fsHeadKey,
        fsHeadLabel: sigRisk.fsHeadLabel,
        assertion: sigRisk.assertion,
        procedureType: 'ToD',
        source: 'AI Recommended',
        isAIRecommended: true,
        aiApprovalStatus: 'Pending',
        aiApprovedBy: null,
        aiApprovedAt: null,
        objective: `Enhanced substantive testing for significant risk: ${sigRisk.riskDescription}`,
        steps: [
          { stepNumber: 1, action: 'Identify all transactions/balances affected by this significant risk', expectedResult: 'Population identified', evidenceRequired: 'Population listing' },
          { stepNumber: 2, action: 'Perform enhanced analytical procedures to identify anomalies', expectedResult: 'Anomalies identified if any', evidenceRequired: 'Analytical review workpaper' },
          { stepNumber: 3, action: 'Test 100% of high-value items in affected population', expectedResult: 'All high-value items tested', evidenceRequired: 'Detailed testing workpaper' },
          { stepNumber: 4, action: 'Perform extended sample testing for remaining population', expectedResult: 'Extended sample tested', evidenceRequired: 'Sample testing workpaper' },
          { stepNumber: 5, action: 'Evaluate results and conclude on significant risk response', expectedResult: 'Risk response evaluated', evidenceRequired: 'Conclusion memo' },
        ],
        expectedEvidence: ['Population listing', 'Analytical workpaper', 'Testing workpapers', 'Conclusion memo'],
        conclusionCriteria: 'Significant risk has been adequately addressed through enhanced procedures',
        isaReference: 'ISA 330.15, ISA 330.21',
        linkedRiskIds: [sigRisk.id],
        linkedPopulationId: null,
        linkedSampleIds: [],
        executionParameters: {
          nature: 'ToD',
          timing: 'Year-End',
          extent: 100,
          evidenceRequirements: [
            { type: 'Document', description: 'Enhanced testing documentation', mandatory: true },
            { type: 'Recalculation', description: 'Independent recalculation', mandatory: true },
          ],
          reviewerLevel: 'Partner',
        },
        evidenceSlots: [
          { slotId: generateUniqueId('EV'), evidenceType: 'Population listing', status: 'Pending', uploadedBy: null, uploadedAt: null, reviewedBy: null, reviewedAt: null },
          { slotId: generateUniqueId('EV'), evidenceType: 'Testing workpaper', status: 'Pending', uploadedBy: null, uploadedAt: null, reviewedBy: null, reviewedAt: null },
        ],
        exceptionLogs: [],
        executionStatus: 'Not Started',
        preparer: null,
        preparerSignedAt: null,
        reviewer: null,
        reviewerSignedAt: null,
        signOffGates: [
          { level: 'Preparer', required: true, signedOffBy: null, signedOffAt: null, comments: null },
          { level: 'Reviewer', required: true, signedOffBy: null, signedOffAt: null, comments: null },
          { level: 'Manager', required: true, signedOffBy: null, signedOffAt: null, comments: null },
          { level: 'Partner', required: true, signedOffBy: null, signedOffAt: null, comments: null },
        ],
        conclusionTemplate: 'Significant risk response conclusion: [Complete based on testing results]',
        actualConclusion: null,
        workpaperReference: null,
        auditTrail: [{
          timestamp: now,
          userId: 'system',
          action: 'Created',
          details: `AI-recommended procedure for significant risk ${sigRisk.id}`,
          previousValue: null,
          newValue: sigRisk.riskDescription,
        }],
      });
    }
  }

  for (const fraudRisk of inputs.riskAssessment.fraudRisks) {
    aiProcedures.push({
      procedureId: generateUniqueId('AI-FRAUD'),
      fsHeadKey: fraudRisk.affectedAreas[0] || 'REVENUE',
      fsHeadLabel: FS_HEAD_LABELS[fraudRisk.affectedAreas[0]] || fraudRisk.affectedAreas[0],
      assertion: 'Occurrence',
      procedureType: 'ToD',
      source: 'AI Recommended',
      isAIRecommended: true,
      aiApprovalStatus: 'Pending',
      aiApprovedBy: null,
      aiApprovedAt: null,
      objective: `Fraud risk response: ${fraudRisk.description}`,
      steps: [
        { stepNumber: 1, action: 'Review journal entries for unusual characteristics (timing, amounts, accounts)', expectedResult: 'Unusual entries identified', evidenceRequired: 'JE analysis workpaper' },
        { stepNumber: 2, action: 'Test journal entries meeting fraud risk criteria', expectedResult: 'Selected entries tested', evidenceRequired: 'JE testing workpaper' },
        { stepNumber: 3, action: 'Perform unpredictability procedures', expectedResult: 'Unpredictable procedures completed', evidenceRequired: 'Unpredictability memo' },
        { stepNumber: 4, action: 'Interview management regarding fraud prevention', expectedResult: 'Inquiries documented', evidenceRequired: 'Management inquiry memo' },
      ],
      expectedEvidence: ['JE analysis', 'JE testing', 'Unpredictability memo', 'Management inquiries'],
      conclusionCriteria: 'Fraud risk has been adequately addressed per ISA 240',
      isaReference: 'ISA 240.32-33, ISA 330.21',
      linkedRiskIds: [fraudRisk.id],
      linkedPopulationId: null,
      linkedSampleIds: [],
      executionParameters: {
        nature: 'ToD',
        timing: 'Year-End',
        extent: 100,
        evidenceRequirements: [
          { type: 'Document', description: 'Journal entry testing', mandatory: true },
          { type: 'Inquiry', description: 'Management representations', mandatory: true },
        ],
        reviewerLevel: 'Partner',
      },
      evidenceSlots: [
        { slotId: generateUniqueId('EV'), evidenceType: 'JE testing workpaper', status: 'Pending', uploadedBy: null, uploadedAt: null, reviewedBy: null, reviewedAt: null },
      ],
      exceptionLogs: [],
      executionStatus: 'Not Started',
      preparer: null,
      preparerSignedAt: null,
      reviewer: null,
      reviewerSignedAt: null,
      signOffGates: [
        { level: 'Preparer', required: true, signedOffBy: null, signedOffAt: null, comments: null },
        { level: 'Reviewer', required: true, signedOffBy: null, signedOffAt: null, comments: null },
        { level: 'Manager', required: true, signedOffBy: null, signedOffAt: null, comments: null },
        { level: 'Partner', required: true, signedOffBy: null, signedOffAt: null, comments: null },
      ],
      conclusionTemplate: 'Fraud risk response conclusion: [Complete based on testing results]',
      actualConclusion: null,
      workpaperReference: null,
      auditTrail: [{
        timestamp: now,
        userId: 'system',
        action: 'Created',
        details: `AI-recommended fraud response procedure for ${fraudRisk.type}`,
        previousValue: null,
        newValue: fraudRisk.description,
      }],
    });
  }

  return aiProcedures;
}

function linkSamplesToProcedures(
  procedures: AuditProcedure[],
  samplingData: SamplingData
): { procedureId: string; linkedSamples: LinkedSample[]; validationStatus: 'Valid' | 'Invalid' | 'Pending'; validationMessage: string }[] {
  const linkages: ReturnType<typeof linkSamplesToProcedures> = [];

  for (const proc of procedures) {
    if (proc.procedureType === 'ToD' && proc.linkedPopulationId) {
      const relevantSamples = samplingData.sampleList.filter(
        s => s.populationReference === proc.linkedPopulationId ||
             (s.fsHeadKey === proc.fsHeadKey && s.assertion === proc.assertion)
      );

      const linkedSamples: LinkedSample[] = relevantSamples.map(s => ({
        sampleItemId: s.id,
        selectionMethodTag: s.selectionMethod,
        stratumTag: s.stratumReference,
        testDesignOption: 'Test All' as const,
      }));

      const hasOrphans = relevantSamples.some(s => !s.populationReference);
      
      linkages.push({
        procedureId: proc.procedureId,
        linkedSamples,
        validationStatus: hasOrphans ? 'Invalid' : linkedSamples.length > 0 ? 'Valid' : 'Pending',
        validationMessage: hasOrphans 
          ? 'Some samples lack population reference'
          : linkedSamples.length > 0 
            ? `${linkedSamples.length} samples linked successfully`
            : 'No samples linked - manual linking required',
      });

      proc.linkedSampleIds = linkedSamples;
    } else {
      linkages.push({
        procedureId: proc.procedureId,
        linkedSamples: [],
        validationStatus: proc.procedureType === 'ToC' || proc.procedureType === 'SAP' ? 'Valid' : 'Pending',
        validationMessage: proc.procedureType === 'ToD' ? 'ToD procedure requires sample linkage' : 'Non-sample procedure',
      });
    }
  }

  return linkages;
}

function createExecutionTasks(
  procedures: AuditProcedure[],
  samplingData: SamplingData
): ExecutionTask[] {
  const tasks: ExecutionTask[] = [];
  const now = new Date().toISOString();

  for (const proc of procedures) {
    if (proc.linkedSampleIds.length > 0) {
      for (const linkedSample of proc.linkedSampleIds) {
        const sample = samplingData.sampleList.find(s => s.id === linkedSample.sampleItemId);
        tasks.push({
          taskId: generateUniqueId('TASK'),
          procedureId: proc.procedureId,
          fsHeadKey: proc.fsHeadKey,
          fsHeadLabel: proc.fsHeadLabel,
          assertion: proc.assertion,
          sampleItemId: linkedSample.sampleItemId,
          taskDescription: `${proc.objective} - Sample: ${sample?.transactionId || linkedSample.sampleItemId}`,
          status: 'Pending',
          assignedTo: null,
          dueDate: null,
          priority: proc.linkedRiskIds.length > 0 ? 'High' : 'Medium',
          evidenceRequired: proc.expectedEvidence,
          createdAt: now,
        });
      }
    } else {
      tasks.push({
        taskId: generateUniqueId('TASK'),
        procedureId: proc.procedureId,
        fsHeadKey: proc.fsHeadKey,
        fsHeadLabel: proc.fsHeadLabel,
        assertion: proc.assertion,
        sampleItemId: null,
        taskDescription: proc.objective,
        status: 'Pending',
        assignedTo: null,
        dueDate: null,
        priority: proc.linkedRiskIds.length > 0 ? 'High' : 'Medium',
        evidenceRequired: proc.expectedEvidence,
        createdAt: now,
      });
    }
  }

  return tasks;
}

function validateQualityGates(
  result: Omit<AuditProgramResult, 'qualityGates'>
): QualityGates {
  const { step1_lockedInputs, step3_allProcedures, step5_sampleLinkages, step7_procedureRecords } = result;

  const hasSamplingSource = step1_lockedInputs.samplingData.sampleList.length > 0;
  const usingSamplingPageSource: QualityGate = {
    passed: hasSamplingSource,
    gate: 'Using Sampling Page as Source',
    message: hasSamplingSource
      ? `${step1_lockedInputs.samplingData.sampleList.length} samples from ISA 530 sampling page`
      : 'No samples found from sampling page - manual sample linking required',
    isaReference: 'ISA 530, ISA 330.7',
  };

  const allSamplesAssigned = step1_lockedInputs.samplingData.sampleList.every(
    s => step5_sampleLinkages.some(l => l.linkedSamples.some(ls => ls.sampleItemId === s.id))
  );
  const noOrphanSamples: QualityGate = {
    passed: !hasSamplingSource || allSamplesAssigned,
    gate: 'No Orphan Sample Items',
    message: allSamplesAssigned
      ? 'All sample items are linked to procedures'
      : 'Some sample items are not linked to any procedure',
    isaReference: 'ISA 330.18',
  };

  const allProceduresLinked = step3_allProcedures.every(
    p => p.linkedRiskIds.length > 0 || p.procedureType === 'ToC'
  );
  const noOrphanProcedures: QualityGate = {
    passed: allProceduresLinked,
    gate: 'No Orphan Procedures',
    message: allProceduresLinked
      ? 'All procedures are linked to risks'
      : 'Some procedures are not linked to any risk',
    isaReference: 'ISA 330.6',
  };

  const allProceduresTiedToRisk: QualityGate = {
    passed: allProceduresLinked,
    gate: 'All Procedures Tied to FS Head + Assertion + Risk',
    message: allProceduresLinked
      ? 'Every procedure has proper linkage'
      : 'Linkage gaps identified',
    isaReference: 'ISA 330.5-6',
  };

  const hasAuditTrail = step7_procedureRecords.every(p => p.auditTrail.length > 0);
  const fullAuditTrail: QualityGate = {
    passed: hasAuditTrail,
    gate: 'Full Audit Trail',
    message: hasAuditTrail
      ? 'Complete audit trail maintained for all procedures'
      : 'Some procedures lack audit trail entries',
    isaReference: 'ISA 230',
  };

  const significantRisksCovered = step1_lockedInputs.riskAssessment.significantRisks.every(
    sr => step3_allProcedures.some(p => p.linkedRiskIds.includes(sr.id))
  );
  const fraudRisksCovered = step1_lockedInputs.riskAssessment.fraudRisks.every(
    fr => step3_allProcedures.some(p => p.linkedRiskIds.includes(fr.id))
  );
  const isa330Compliant: QualityGate = {
    passed: significantRisksCovered && fraudRisksCovered,
    gate: 'ISA 330/530 Compliant',
    message: significantRisksCovered && fraudRisksCovered
      ? 'All significant and fraud risks have responsive procedures'
      : 'Some risks lack responsive procedures',
    isaReference: 'ISA 330.15, ISA 330.21',
  };

  const hasExecutionParams = step7_procedureRecords.every(p => p.executionParameters);
  const executionReady: QualityGate = {
    passed: hasExecutionParams && allProceduresLinked,
    gate: 'Execution Ready',
    message: hasExecutionParams && allProceduresLinked
      ? 'Audit program is ready for execution'
      : 'Additional configuration required before execution',
    isaReference: 'ISA 330.28',
  };

  return {
    usingSamplingPageSource,
    noOrphanSamples,
    noOrphanProcedures,
    allProceduresTiedToRisk,
    fullAuditTrail,
    isa330Compliant,
    executionReady,
    overallPassed: usingSamplingPageSource.passed && noOrphanSamples.passed && noOrphanProcedures.passed &&
                   allProceduresTiedToRisk.passed && fullAuditTrail.passed && isa330Compliant.passed && executionReady.passed,
  };
}

function generateDocumentation(
  result: Omit<AuditProgramResult, 'step9_documentation' | 'qualityGates'>
): DocumentationOutput {
  const { step1_lockedInputs, step2_procedurePacks, step3_allProcedures, step5_sampleLinkages } = result;

  return {
    programScopeSummary: `Audit program developed for ${step2_procedurePacks.length} procedure packs covering ` +
      `${new Set(step2_procedurePacks.map(p => p.fsHeadKey)).size} FS heads. ` +
      `Total ${step3_allProcedures.length} procedures designed responsive to identified risks.`,

    procedurePacksSummary: step2_procedurePacks.map(p =>
      `${p.fsHeadLabel} - ${p.assertion}: ${p.procedures.length} procedures, ` +
      `${p.linkedSignificantRiskIds.length} significant risks, ${p.linkedFraudRiskIds.length} fraud risks`
    ).join('; '),

    riskResponseSummary: `Significant risks: ${step1_lockedInputs.riskAssessment.significantRisks.length}, ` +
      `Fraud risks: ${step1_lockedInputs.riskAssessment.fraudRisks.length}, ` +
      `All addressed through specific responsive procedures per ISA 330.15 and ISA 330.21.`,

    samplingLinkageSummary: `${step1_lockedInputs.samplingData.sampleList.length} sample items from ISA 530 sampling linked to procedures. ` +
      `${step5_sampleLinkages.filter(l => l.validationStatus === 'Valid').length} linkages validated.`,

    executionParametersSummary: `All procedures configured with nature (ToC/ToD/SAP), timing, extent, and evidence requirements. ` +
      `Reviewer levels assigned based on risk profile.`,

    qualityGatesSummary: 'Quality gates validated for ISA 330/530 compliance, sample traceability, and execution readiness.',

    isaReferences: [
      'ISA 330 - The Auditor\'s Responses to Assessed Risks',
      'ISA 530 - Audit Sampling',
      'ISA 500 - Audit Evidence',
      'ISA 240 - The Auditor\'s Responsibilities Relating to Fraud',
      'ISA 315 - Identifying and Assessing the Risks of Material Misstatement',
      'ISA 230 - Audit Documentation',
    ],
  };
}

router.post("/:engagementId/analyze", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const firmId = req.user!.firmId;
    const userId = req.user!.id;

    if (!firmId) {
      return res.status(400).json({ error: "User not associated with a firm" });
    }

    const engagement = await prisma.engagement.findFirst({
      where: { id: engagementId, firmId },
      include: { client: true },
    });

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    const existingPlanningMemo = await prisma.planningMemo.findFirst({
      where: { engagementId }
    });

    let existingBriefingData: Record<string, unknown> = {};
    if (existingPlanningMemo?.teamBriefingNotes) {
      try {
        existingBriefingData = JSON.parse(existingPlanningMemo.teamBriefingNotes);
      } catch {
        existingBriefingData = {};
      }
    }

    const coaAccounts = await prisma.coAAccount.findMany({
      where: { engagementId }
    });

    const riskAssessments = await prisma.riskAssessment.findMany({
      where: { engagementId }
    });

    const step1_lockedInputs = extractLockedInputs(engagement, existingBriefingData, coaAccounts, riskAssessments);
    const step2_procedurePacks = buildProcedurePacks(step1_lockedInputs);
    const step3_allProcedures = step2_procedurePacks.flatMap(p => p.procedures);
    const step4_aiRecommendedProcedures = generateAIRecommendedProcedures(step1_lockedInputs, step3_allProcedures);
    
    const allProcedures = [...step3_allProcedures, ...step4_aiRecommendedProcedures];
    
    const step5_sampleLinkages = linkSamplesToProcedures(allProcedures, step1_lockedInputs.samplingData);
    const step6_executionParameters = allProcedures.map(p => ({
      procedureId: p.procedureId,
      parameters: p.executionParameters,
    }));
    const step7_procedureRecords = allProcedures;
    const step8_executionTasks = createExecutionTasks(allProcedures, step1_lockedInputs.samplingData);

    const existingProgram = existingBriefingData.auditProgram as AuditProgramResult | null;
    const version = (existingProgram?.version || 0) + 1;

    const partialResult = {
      engagementId,
      analysisTimestamp: new Date().toISOString(),
      version,
      isLocked: false,
      lockedBy: null,
      lockedAt: null,
      step1_lockedInputs,
      step2_procedurePacks,
      step3_allProcedures: allProcedures,
      step4_aiRecommendedProcedures,
      step5_sampleLinkages,
      step6_executionParameters,
      step7_procedureRecords,
      step8_executionTasks,
    };

    const step9_documentation = generateDocumentation(partialResult);
    const qualityGates = validateQualityGates({ ...partialResult, step9_documentation });

    const result: AuditProgramResult = {
      ...partialResult,
      step9_documentation,
      qualityGates,
    };

    const updatedBriefingData = {
      ...existingBriefingData,
      auditProgram: result,
      auditProgramTimestamp: new Date().toISOString(),
      auditProgramAnalyzedBy: userId,
    };

    if (existingPlanningMemo) {
      await prisma.planningMemo.update({
        where: { id: existingPlanningMemo.id },
        data: {
          teamBriefingNotes: JSON.stringify(updatedBriefingData),
          updatedAt: new Date(),
        }
      });
    } else {
      await prisma.planningMemo.create({
        data: {
          engagementId,
          preparedById: userId,
          teamBriefingNotes: JSON.stringify(updatedBriefingData),
        }
      });
    }

    res.json(result);
  } catch (error) {
    console.error("Audit program analysis error:", error);
    res.status(500).json({ error: "Failed to generate audit program" });
  }
});

router.get("/:engagementId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const firmId = req.user!.firmId;

    if (!firmId) {
      return res.status(400).json({ error: "User not associated with a firm" });
    }

    const engagement = await prisma.engagement.findFirst({
      where: { id: engagementId, firmId }
    });

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    const existingPlanningMemo = await prisma.planningMemo.findFirst({
      where: { engagementId }
    });

    if (!existingPlanningMemo?.teamBriefingNotes) {
      return res.json(null);
    }

    let briefingData: Record<string, unknown> = {};
    try {
      briefingData = JSON.parse(existingPlanningMemo.teamBriefingNotes);
    } catch {
      return res.json(null);
    }

    const auditProgram = briefingData.auditProgram as AuditProgramResult | null;
    res.json(auditProgram);
  } catch (error) {
    console.error("Get audit program error:", error);
    res.status(500).json({ error: "Failed to get audit program" });
  }
});

router.post("/:engagementId/save", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const firmId = req.user!.firmId;
    const userId = req.user!.id;
    const auditProgramData = req.body as AuditProgramResult;

    if (!firmId) {
      return res.status(400).json({ error: "User not associated with a firm" });
    }

    const engagement = await prisma.engagement.findFirst({
      where: { id: engagementId, firmId }
    });

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    const existingPlanningMemo = await prisma.planningMemo.findFirst({
      where: { engagementId }
    });

    let existingBriefingData: Record<string, unknown> = {};
    if (existingPlanningMemo?.teamBriefingNotes) {
      try {
        existingBriefingData = JSON.parse(existingPlanningMemo.teamBriefingNotes);
      } catch {
        existingBriefingData = {};
      }
    }

    const updatedBriefingData = {
      ...existingBriefingData,
      auditProgram: auditProgramData,
      auditProgramTimestamp: new Date().toISOString(),
      auditProgramModifiedBy: userId,
    };

    if (existingPlanningMemo) {
      await prisma.planningMemo.update({
        where: { id: existingPlanningMemo.id },
        data: {
          teamBriefingNotes: JSON.stringify(updatedBriefingData),
          updatedAt: new Date(),
        }
      });
    } else {
      await prisma.planningMemo.create({
        data: {
          engagementId,
          preparedById: userId,
          teamBriefingNotes: JSON.stringify(updatedBriefingData),
        }
      });
    }

    res.json({ success: true, message: "Audit program saved successfully" });
  } catch (error) {
    console.error("Save audit program error:", error);
    res.status(500).json({ error: "Failed to save audit program" });
  }
});

router.get("/:engagementId/procedure-library", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { fsHeadKey, assertion, riskDriver, industry } = req.query;

    let filteredLibrary = [...PROCEDURE_LIBRARY];

    if (fsHeadKey) {
      filteredLibrary = filteredLibrary.filter(p => p.fsHeadKey === fsHeadKey);
    }
    if (assertion) {
      filteredLibrary = filteredLibrary.filter(p => p.assertion === assertion);
    }
    if (riskDriver) {
      filteredLibrary = filteredLibrary.filter(p => p.riskDriver === riskDriver);
    }
    if (industry) {
      filteredLibrary = filteredLibrary.filter(p => p.industry === industry || p.industry === null);
    }

    res.json({
      procedures: filteredLibrary,
      total: filteredLibrary.length,
      fsHeadOptions: Object.keys(FS_HEAD_LABELS),
      assertionOptions: ASSERTIONS,
      riskDriverOptions: ['Fraud', 'Judgment', 'Volume', 'Complexity', 'IT', 'Standard'],
    });
  } catch (error) {
    console.error("Get procedure library error:", error);
    res.status(500).json({ error: "Failed to get procedure library" });
  }
});

router.post("/:engagementId/link-samples", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const firmId = req.user!.firmId;
    const userId = req.user!.id;
    const { procedureId, sampleIds, testDesignOption } = req.body as {
      procedureId: string;
      sampleIds: string[];
      testDesignOption: 'Test All' | 'Split by Sub-Assertion' | 'Split by Strata' | 'Manual Add-On' | 'Replacement';
    };

    if (!firmId) {
      return res.status(400).json({ error: "User not associated with a firm" });
    }

    const engagement = await prisma.engagement.findFirst({
      where: { id: engagementId, firmId }
    });

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    const existingPlanningMemo = await prisma.planningMemo.findFirst({
      where: { engagementId }
    });

    if (!existingPlanningMemo?.teamBriefingNotes) {
      return res.status(400).json({ error: "Run audit program analysis first" });
    }

    let existingBriefingData: Record<string, unknown> = {};
    try {
      existingBriefingData = JSON.parse(existingPlanningMemo.teamBriefingNotes);
    } catch {
      return res.status(400).json({ error: "Invalid audit program data" });
    }

    const auditProgram = existingBriefingData.auditProgram as AuditProgramResult | null;
    if (!auditProgram) {
      return res.status(400).json({ error: "Run audit program analysis first" });
    }

    if (auditProgram.isLocked) {
      return res.status(400).json({ error: "Audit program is locked - cannot modify" });
    }

    const procedure = auditProgram.step7_procedureRecords.find(p => p.procedureId === procedureId);
    if (!procedure) {
      return res.status(404).json({ error: "Procedure not found" });
    }

    const samplingData = auditProgram.step1_lockedInputs.samplingData;
    const linkedSamples: LinkedSample[] = sampleIds.map(sampleId => {
      const sample = samplingData.sampleList.find(s => s.id === sampleId);
      return {
        sampleItemId: sampleId,
        selectionMethodTag: sample?.selectionMethod || 'Manual',
        stratumTag: sample?.stratumReference || null,
        testDesignOption,
      };
    });

    procedure.linkedSampleIds = linkedSamples;
    procedure.auditTrail.push({
      timestamp: new Date().toISOString(),
      userId,
      action: 'Linked',
      details: `Linked ${sampleIds.length} samples to procedure`,
      previousValue: null,
      newValue: JSON.stringify(sampleIds),
    });

    const linkageIdx = auditProgram.step5_sampleLinkages.findIndex(l => l.procedureId === procedureId);
    if (linkageIdx >= 0) {
      auditProgram.step5_sampleLinkages[linkageIdx] = {
        procedureId,
        linkedSamples,
        validationStatus: 'Valid',
        validationMessage: `${linkedSamples.length} samples linked successfully`,
      };
    }

    auditProgram.qualityGates = validateQualityGates(auditProgram);

    const updatedBriefingData = {
      ...existingBriefingData,
      auditProgram,
      auditProgramTimestamp: new Date().toISOString(),
      auditProgramModifiedBy: userId,
    };

    await prisma.planningMemo.update({
      where: { id: existingPlanningMemo.id },
      data: {
        teamBriefingNotes: JSON.stringify(updatedBriefingData),
        updatedAt: new Date(),
      }
    });

    res.json({
      success: true,
      linkedSamples: linkedSamples.length,
      procedure: procedure,
    });
  } catch (error) {
    console.error("Link samples error:", error);
    res.status(500).json({ error: "Failed to link samples" });
  }
});

router.post("/:engagementId/push-to-execution", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const firmId = req.user!.firmId;
    const userId = req.user!.id;

    if (!firmId) {
      return res.status(400).json({ error: "User not associated with a firm" });
    }

    const engagement = await prisma.engagement.findFirst({
      where: { id: engagementId, firmId }
    });

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    const existingPlanningMemo = await prisma.planningMemo.findFirst({
      where: { engagementId }
    });

    if (!existingPlanningMemo?.teamBriefingNotes) {
      return res.status(400).json({ error: "Run audit program analysis first" });
    }

    let existingBriefingData: Record<string, unknown> = {};
    try {
      existingBriefingData = JSON.parse(existingPlanningMemo.teamBriefingNotes);
    } catch {
      return res.status(400).json({ error: "Invalid audit program data" });
    }

    const auditProgram = existingBriefingData.auditProgram as AuditProgramResult | null;
    if (!auditProgram) {
      return res.status(400).json({ error: "Run audit program analysis first" });
    }

    if (!auditProgram.qualityGates.overallPassed) {
      return res.status(400).json({ 
        error: "Quality gates not passed - cannot push to execution",
        qualityGates: auditProgram.qualityGates,
      });
    }

    const pendingAIProcedures = auditProgram.step4_aiRecommendedProcedures.filter(
      p => p.aiApprovalStatus === 'Pending'
    );
    if (pendingAIProcedures.length > 0) {
      return res.status(400).json({
        error: `${pendingAIProcedures.length} AI-recommended procedures pending approval`,
        pendingProcedures: pendingAIProcedures.map(p => ({ id: p.procedureId, objective: p.objective })),
      });
    }

    auditProgram.isLocked = true;
    auditProgram.lockedBy = userId;
    auditProgram.lockedAt = new Date().toISOString();

    for (const proc of auditProgram.step7_procedureRecords) {
      proc.auditTrail.push({
        timestamp: new Date().toISOString(),
        userId,
        action: 'Approved',
        details: 'Program locked and pushed to execution',
        previousValue: 'Draft',
        newValue: 'Locked',
      });
    }

    const executionTasks = createExecutionTasks(
      auditProgram.step7_procedureRecords,
      auditProgram.step1_lockedInputs.samplingData
    );
    auditProgram.step8_executionTasks = executionTasks;

    const updatedBriefingData = {
      ...existingBriefingData,
      auditProgram,
      auditProgramLockedAt: new Date().toISOString(),
      auditProgramLockedBy: userId,
      executionTasks,
    };

    await prisma.planningMemo.update({
      where: { id: existingPlanningMemo.id },
      data: {
        teamBriefingNotes: JSON.stringify(updatedBriefingData),
        updatedAt: new Date(),
      }
    });

    res.json({
      success: true,
      message: "Audit program locked and pushed to execution",
      version: auditProgram.version,
      lockedAt: auditProgram.lockedAt,
      executionTasksCreated: executionTasks.length,
      summary: {
        totalProcedures: auditProgram.step7_procedureRecords.length,
        totalTasks: executionTasks.length,
        byFsHead: [...new Set(executionTasks.map(t => t.fsHeadKey))].map(fh => ({
          fsHead: fh,
          taskCount: executionTasks.filter(t => t.fsHeadKey === fh).length,
        })),
      },
    });
  } catch (error) {
    console.error("Push to execution error:", error);
    res.status(500).json({ error: "Failed to push to execution" });
  }
});

router.post("/:engagementId/approve-ai-procedure", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const firmId = req.user!.firmId;
    const userId = req.user!.id;
    const { procedureId, approved, comments } = req.body as {
      procedureId: string;
      approved: boolean;
      comments?: string;
    };

    if (!firmId) {
      return res.status(400).json({ error: "User not associated with a firm" });
    }

    const engagement = await prisma.engagement.findFirst({
      where: { id: engagementId, firmId }
    });

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    const existingPlanningMemo = await prisma.planningMemo.findFirst({
      where: { engagementId }
    });

    if (!existingPlanningMemo?.teamBriefingNotes) {
      return res.status(400).json({ error: "Run audit program analysis first" });
    }

    let existingBriefingData: Record<string, unknown> = {};
    try {
      existingBriefingData = JSON.parse(existingPlanningMemo.teamBriefingNotes);
    } catch {
      return res.status(400).json({ error: "Invalid audit program data" });
    }

    const auditProgram = existingBriefingData.auditProgram as AuditProgramResult | null;
    if (!auditProgram) {
      return res.status(400).json({ error: "Run audit program analysis first" });
    }

    const procedure = auditProgram.step4_aiRecommendedProcedures.find(p => p.procedureId === procedureId);
    if (!procedure) {
      return res.status(404).json({ error: "AI procedure not found" });
    }

    procedure.aiApprovalStatus = approved ? 'Approved' : 'Rejected';
    procedure.aiApprovedBy = userId;
    procedure.aiApprovedAt = new Date().toISOString();
    procedure.auditTrail.push({
      timestamp: new Date().toISOString(),
      userId,
      action: approved ? 'Approved' : 'Rejected',
      details: comments || (approved ? 'AI procedure approved' : 'AI procedure rejected'),
      previousValue: 'Pending',
      newValue: approved ? 'Approved' : 'Rejected',
    });

    const procedureInRecords = auditProgram.step7_procedureRecords.find(p => p.procedureId === procedureId);
    if (procedureInRecords) {
      procedureInRecords.aiApprovalStatus = procedure.aiApprovalStatus;
      procedureInRecords.aiApprovedBy = procedure.aiApprovedBy;
      procedureInRecords.aiApprovedAt = procedure.aiApprovedAt;
      procedureInRecords.auditTrail = procedure.auditTrail;
    }

    const updatedBriefingData = {
      ...existingBriefingData,
      auditProgram,
      auditProgramTimestamp: new Date().toISOString(),
    };

    await prisma.planningMemo.update({
      where: { id: existingPlanningMemo.id },
      data: {
        teamBriefingNotes: JSON.stringify(updatedBriefingData),
        updatedAt: new Date(),
      }
    });

    res.json({
      success: true,
      procedure: procedure,
      message: approved ? 'AI procedure approved' : 'AI procedure rejected',
    });
  } catch (error) {
    console.error("Approve AI procedure error:", error);
    res.status(500).json({ error: "Failed to approve/reject AI procedure" });
  }
});

router.post("/:engagementId/procedures", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const firmId = req.user!.firmId;
    const userId = req.user!.id;
    const { action, procedure } = req.body as {
      action: 'create' | 'update' | 'delete';
      procedure: Partial<AuditProcedure>;
    };

    if (!firmId) {
      return res.status(400).json({ error: "User not associated with a firm" });
    }

    const engagement = await prisma.engagement.findFirst({
      where: { id: engagementId, firmId }
    });

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    const existingPlanningMemo = await prisma.planningMemo.findFirst({
      where: { engagementId }
    });

    if (!existingPlanningMemo?.teamBriefingNotes) {
      return res.status(400).json({ error: "Run audit program analysis first" });
    }

    let existingBriefingData: Record<string, unknown> = {};
    try {
      existingBriefingData = JSON.parse(existingPlanningMemo.teamBriefingNotes);
    } catch {
      return res.status(400).json({ error: "Invalid audit program data" });
    }

    const auditProgram = existingBriefingData.auditProgram as AuditProgramResult | null;
    if (!auditProgram) {
      return res.status(400).json({ error: "Run audit program analysis first" });
    }

    if (auditProgram.isLocked) {
      return res.status(400).json({ error: "Audit program is locked - cannot modify" });
    }

    const now = new Date().toISOString();

    switch (action) {
      case 'create': {
        const newProcedure: AuditProcedure = {
          procedureId: generateUniqueId('PROC'),
          fsHeadKey: procedure.fsHeadKey || 'OTHER',
          fsHeadLabel: procedure.fsHeadLabel || FS_HEAD_LABELS[procedure.fsHeadKey || ''] || 'Other',
          assertion: procedure.assertion || 'Existence',
          procedureType: procedure.procedureType || 'ToD',
          source: 'Manual',
          isAIRecommended: false,
          aiApprovalStatus: null,
          aiApprovedBy: null,
          aiApprovedAt: null,
          objective: procedure.objective || '',
          steps: procedure.steps || [],
          expectedEvidence: procedure.expectedEvidence || [],
          conclusionCriteria: procedure.conclusionCriteria || '',
          isaReference: procedure.isaReference || 'ISA 330',
          linkedRiskIds: procedure.linkedRiskIds || [],
          linkedPopulationId: procedure.linkedPopulationId || null,
          linkedSampleIds: [],
          executionParameters: procedure.executionParameters || {
            nature: 'ToD',
            timing: 'Year-End',
            extent: 100,
            evidenceRequirements: [],
            reviewerLevel: 'Senior',
          },
          evidenceSlots: [],
          exceptionLogs: [],
          executionStatus: 'Not Started',
          preparer: null,
          preparerSignedAt: null,
          reviewer: null,
          reviewerSignedAt: null,
          signOffGates: [
            { level: 'Preparer', required: true, signedOffBy: null, signedOffAt: null, comments: null },
            { level: 'Reviewer', required: true, signedOffBy: null, signedOffAt: null, comments: null },
          ],
          conclusionTemplate: '',
          actualConclusion: null,
          workpaperReference: null,
          auditTrail: [{
            timestamp: now,
            userId,
            action: 'Created',
            details: 'Manual procedure created',
            previousValue: null,
            newValue: procedure.objective || '',
          }],
        };
        auditProgram.step3_allProcedures.push(newProcedure);
        auditProgram.step7_procedureRecords.push(newProcedure);
        break;
      }
      case 'update': {
        const idx = auditProgram.step7_procedureRecords.findIndex(p => p.procedureId === procedure.procedureId);
        if (idx < 0) {
          return res.status(404).json({ error: "Procedure not found" });
        }
        const existing = auditProgram.step7_procedureRecords[idx];
        const updated = { ...existing, ...procedure };
        updated.auditTrail.push({
          timestamp: now,
          userId,
          action: 'Updated',
          details: 'Procedure updated',
          previousValue: JSON.stringify(existing),
          newValue: JSON.stringify(procedure),
        });
        auditProgram.step7_procedureRecords[idx] = updated as AuditProcedure;
        
        const idx2 = auditProgram.step3_allProcedures.findIndex(p => p.procedureId === procedure.procedureId);
        if (idx2 >= 0) {
          auditProgram.step3_allProcedures[idx2] = updated as AuditProcedure;
        }
        break;
      }
      case 'delete': {
        const deleteIdx = auditProgram.step7_procedureRecords.findIndex(p => p.procedureId === procedure.procedureId);
        if (deleteIdx < 0) {
          return res.status(404).json({ error: "Procedure not found" });
        }
        auditProgram.step7_procedureRecords.splice(deleteIdx, 1);
        
        const deleteIdx2 = auditProgram.step3_allProcedures.findIndex(p => p.procedureId === procedure.procedureId);
        if (deleteIdx2 >= 0) {
          auditProgram.step3_allProcedures.splice(deleteIdx2, 1);
        }
        break;
      }
      default:
        return res.status(400).json({ error: "Invalid action" });
    }

    auditProgram.qualityGates = validateQualityGates(auditProgram);

    const updatedBriefingData = {
      ...existingBriefingData,
      auditProgram,
      auditProgramTimestamp: now,
      auditProgramModifiedBy: userId,
    };

    await prisma.planningMemo.update({
      where: { id: existingPlanningMemo.id },
      data: {
        teamBriefingNotes: JSON.stringify(updatedBriefingData),
        updatedAt: new Date(),
      }
    });

    res.json({ success: true, action, procedureId: procedure.procedureId });
  } catch (error) {
    console.error("Manage procedures error:", error);
    res.status(500).json({ error: "Failed to manage procedure" });
  }
});

export default router;
