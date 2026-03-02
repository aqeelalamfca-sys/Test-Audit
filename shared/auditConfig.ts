/**
 * Master Configuration Dictionary for ISA-Compliant Audit System
 * Contains all standardized options for FS Heads, Assertions, Risks, Sampling, Procedures, and more
 */

// =============================================================================
// 1. FS HEAD OPTIONS
// =============================================================================

export const FS_HEADS = [
  'Revenue from Operations',
  'Cost of Sales',
  'Gross Profit',
  'Trade Receivables',
  'Inventories',
  'Property, Plant & Equipment',
  'Right-of-Use Assets',
  'Intangible Assets',
  'Investments',
  'Trade & Other Payables',
  'Accrued Liabilities / Provisions',
  'Borrowings',
  'Lease Liabilities',
  'Equity',
  'Cash & Bank Balances',
  'Other Assets / Other Liabilities',
  'Related Party Balances',
  'Income Tax / Deferred Tax',
  'Disclosures'
] as const;

export type FSHead = typeof FS_HEADS[number];

export const FS_HEAD_KEYS: Record<FSHead, string> = {
  'Revenue from Operations': 'REVENUE',
  'Cost of Sales': 'COST_OF_SALES',
  'Gross Profit': 'GROSS_PROFIT',
  'Trade Receivables': 'TRADE_RECEIVABLES',
  'Inventories': 'INVENTORIES',
  'Property, Plant & Equipment': 'PPE',
  'Right-of-Use Assets': 'ROU_ASSETS',
  'Intangible Assets': 'INTANGIBLE_ASSETS',
  'Investments': 'INVESTMENTS',
  'Trade & Other Payables': 'TRADE_PAYABLES',
  'Accrued Liabilities / Provisions': 'ACCRUED_PROVISIONS',
  'Borrowings': 'BORROWINGS',
  'Lease Liabilities': 'LEASE_LIABILITIES',
  'Equity': 'EQUITY',
  'Cash & Bank Balances': 'CASH_BANK',
  'Other Assets / Other Liabilities': 'OTHER_ASSETS_LIABILITIES',
  'Related Party Balances': 'RELATED_PARTY',
  'Income Tax / Deferred Tax': 'TAX',
  'Disclosures': 'DISCLOSURES'
};

// =============================================================================
// 2. ASSERTIONS (Context-Driven)
// =============================================================================

export const TRANSACTION_ASSERTIONS = [
  'Occurrence',
  'Completeness',
  'Accuracy',
  'Cut-off',
  'Classification'
] as const;

export const BALANCE_ASSERTIONS = [
  'Existence',
  'Rights & Obligations',
  'Completeness',
  'Valuation & Allocation',
  'Classification'
] as const;

export const DISCLOSURE_ASSERTIONS = [
  'Occurrence & Rights',
  'Completeness',
  'Accuracy & Valuation',
  'Presentation & Understandability'
] as const;

export type TransactionAssertion = typeof TRANSACTION_ASSERTIONS[number];
export type BalanceAssertion = typeof BALANCE_ASSERTIONS[number];
export type DisclosureAssertion = typeof DISCLOSURE_ASSERTIONS[number];
export type Assertion = TransactionAssertion | BalanceAssertion | DisclosureAssertion;

export type AssertionContext = 'transactions' | 'balances' | 'disclosures';

export const ASSERTIONS_BY_CONTEXT: Record<AssertionContext, readonly string[]> = {
  transactions: TRANSACTION_ASSERTIONS,
  balances: BALANCE_ASSERTIONS,
  disclosures: DISCLOSURE_ASSERTIONS
};

// =============================================================================
// 3. RISK OPTIONS
// =============================================================================

export const RISK_TYPES = [
  'Inherent Risk',
  'Fraud Risk (ISA 240)',
  'Significant Risk (ISA 315)',
  'Control Deficiency-Driven Risk',
  'Estimation Uncertainty Risk'
] as const;

export type RiskType = typeof RISK_TYPES[number];

export const RISK_DRIVERS = [
  'Management override',
  'Complex estimates',
  'High volume transactions',
  'Manual journals',
  'IT system dependency',
  'Related party dominance',
  'Revenue pressure',
  'Regulatory complexity',
  'First-year audit / major change'
] as const;

export type RiskDriver = typeof RISK_DRIVERS[number];

export const RISK_LEVELS = ['High', 'Medium', 'Low'] as const;
export type RiskLevel = typeof RISK_LEVELS[number];

// =============================================================================
// 4. POPULATION OPTIONS
// =============================================================================

export const POPULATION_SOURCES = [
  'GL Transactions',
  'Sub-ledger (AR/AP/Inventory)',
  'Bank Statements',
  'Manual Journals',
  'System-generated Journals',
  'Adjusting/Closing Entries'
] as const;

export type PopulationSource = typeof POPULATION_SOURCES[number];

export const POPULATION_FILTERS = [
  'Date range',
  'FS Head mapping',
  'CoA group/range',
  'Debit/Credit only',
  'Amount threshold',
  'Counterparty type',
  'Manual vs automated',
  'Related party only',
  'Foreign currency only'
] as const;

export type PopulationFilter = typeof POPULATION_FILTERS[number];

export const COMPLETENESS_CHECKS = [
  'TB tie-out confirmed',
  'FS head total reconciled',
  'Count variance explained'
] as const;

export type CompletenessCheck = typeof COMPLETENESS_CHECKS[number];

export const POPULATION_TYPES = ['Transactions', 'Balances', 'Disclosures'] as const;
export type PopulationType = typeof POPULATION_TYPES[number];

// =============================================================================
// 5. SAMPLING OPTIONS (ISA 530)
// =============================================================================

export const SAMPLING_APPROACHES = ['Statistical', 'Non-Statistical'] as const;
export type SamplingApproach = typeof SAMPLING_APPROACHES[number];

export const CONFIDENCE_LEVELS = [90, 95, 99] as const;
export type ConfidenceLevel = typeof CONFIDENCE_LEVELS[number];

export const CONFIDENCE_FACTORS: Record<ConfidenceLevel, number> = {
  90: 2.31,
  95: 3.00,
  99: 4.61
};

export const AUTO_SELECTION_METHODS = [
  'Random',
  'Systematic',
  'MUS',
  'High-Value Items (100%)',
  'Risk-Based Targeting'
] as const;

export type AutoSelectionMethod = typeof AUTO_SELECTION_METHODS[number];

export const MANUAL_SELECTION_METHODS = [
  'Management override entries',
  'Unusual/one-off transactions',
  'Year-end/post-closing entries',
  'Related party transactions',
  'Complex estimates',
  'User-selected items'
] as const;

export type ManualSelectionMethod = typeof MANUAL_SELECTION_METHODS[number];

export type SelectionMethod = AutoSelectionMethod | ManualSelectionMethod;

export const STRATIFICATION_OPTIONS = [
  'Top X% by value',
  'Above PM',
  'Above tolerable error',
  'Remaining random',
  'Separate related party strata',
  'Separate manual journal strata'
] as const;

export type StratificationOption = typeof STRATIFICATION_OPTIONS[number];

export const STRATUM_TYPES = [
  'High-Value',
  'Unusual',
  'Related Party',
  'Manual Journal',
  'Year-End',
  'Post-Closing',
  'Standard'
] as const;

export type StratumType = typeof STRATUM_TYPES[number];

export const STRATUM_SAMPLING_APPROACHES = [
  'Key Item (100%)',
  'Sample',
  'Exclude'
] as const;

export type StratumSamplingApproach = typeof STRATUM_SAMPLING_APPROACHES[number];

// =============================================================================
// 6. PROCEDURE OPTIONS
// =============================================================================

export const PROCEDURE_CATEGORIES = [
  'Test of Controls (ToC)',
  'Substantive Analytical Procedure (SAP)',
  'Substantive Test of Details (ToD)',
  'Dual-Purpose Test'
] as const;

export type ProcedureCategory = typeof PROCEDURE_CATEGORIES[number];

export const PROCEDURE_CATEGORY_CODES = {
  'Test of Controls (ToC)': 'ToC',
  'Substantive Analytical Procedure (SAP)': 'SAP',
  'Substantive Test of Details (ToD)': 'ToD',
  'Dual-Purpose Test': 'DPT'
} as const;

export type ProcedureCategoryCode = 'ToC' | 'SAP' | 'ToD' | 'DPT';

export const PROCEDURE_SOURCES = [
  'Pre-Defined Library',
  'AI-Recommended',
  'Firm-Specific',
  'User-Defined'
] as const;

export type ProcedureSource = typeof PROCEDURE_SOURCES[number];

export const PROCEDURE_NATURES = [
  'Inspection',
  'Observation',
  'Inquiry',
  'Recalculation',
  'Reperformance',
  'Confirmation',
  'Analytical review'
] as const;

export type ProcedureNature = typeof PROCEDURE_NATURES[number];

// =============================================================================
// 7. SAMPLE-TO-PROCEDURE BINDING
// =============================================================================

export const SAMPLE_COVERAGE_OPTIONS = [
  'Test all sampled items',
  'Split by assertion',
  'Split by strata',
  '100% testing'
] as const;

export type SampleCoverageOption = typeof SAMPLE_COVERAGE_OPTIONS[number];

export const SAMPLE_CHANGE_CONTROLS = [
  'Replace sample item',
  'Add manual sample',
  'Lock sample list'
] as const;

export type SampleChangeControl = typeof SAMPLE_CHANGE_CONTROLS[number];

export const TEST_DESIGN_OPTIONS = [
  'Test All',
  'Split by Sub-Assertion',
  'Split by Strata',
  'Manual Add-On',
  'Replacement'
] as const;

export type TestDesignOption = typeof TEST_DESIGN_OPTIONS[number];

// =============================================================================
// 8. EVIDENCE OPTIONS
// =============================================================================

export const EVIDENCE_TYPES = [
  'Invoice',
  'Purchase Order',
  'GRN',
  'Contract/Agreement',
  'Bank Statement',
  'Payment Voucher',
  'Confirmation Reply',
  'System Report',
  'Working Paper/Calculation',
  'Management Representation'
] as const;

export type EvidenceType = typeof EVIDENCE_TYPES[number];

export const EVIDENCE_UPLOAD_MODES = [
  'Manual',
  'Bulk',
  'Auto-match',
  'Email/WhatsApp ingestion'
] as const;

export type EvidenceUploadMode = typeof EVIDENCE_UPLOAD_MODES[number];

export const EVIDENCE_STATUSES = [
  'Not Uploaded',
  'Uploaded - Pending Review',
  'Reviewed - OK',
  'Exception Identified'
] as const;

export type EvidenceStatus = typeof EVIDENCE_STATUSES[number];

export const EVIDENCE_REQUIREMENT_TYPES = [
  'Document',
  'Confirmation',
  'Recalculation',
  'Inspection',
  'Inquiry',
  'Observation',
  'Reperformance'
] as const;

export type EvidenceRequirementType = typeof EVIDENCE_REQUIREMENT_TYPES[number];

// =============================================================================
// 9. EXECUTION & REVIEW OPTIONS
// =============================================================================

export const TEST_RESULTS = [
  'Pass',
  'Fail',
  'Exception - Quantified',
  'Exception - Non-Quantified'
] as const;

export type TestResult = typeof TEST_RESULTS[number];

export const EXCEPTION_SEVERITIES = [
  'Clearly trivial',
  'Below PM',
  'Above PM',
  'Pervasive'
] as const;

export type ExceptionSeverity = typeof EXCEPTION_SEVERITIES[number];

export const REVIEW_LEVELS = [
  'Prepared',
  'Reviewed (Manager)',
  'Reviewed (Partner)',
  'EQCR'
] as const;

export type ReviewLevel = typeof REVIEW_LEVELS[number];

export const EXECUTION_STATUSES = [
  'Not Started',
  'In Progress',
  'Completed',
  'Blocked'
] as const;

export type ExecutionStatus = typeof EXECUTION_STATUSES[number];

export const SAMPLE_TEST_STATUSES = [
  'Planned',
  'In Progress',
  'Tested',
  'Exception',
  'N/A'
] as const;

export type SampleTestStatus = typeof SAMPLE_TEST_STATUSES[number];

export const EXCEPTION_STATUSES = [
  'Open',
  'Resolved',
  'Projected',
  'Waived'
] as const;

export type ExceptionStatus = typeof EXCEPTION_STATUSES[number];

export const SIGN_OFF_LEVELS = [
  'Preparer',
  'Reviewer',
  'Manager',
  'Partner'
] as const;

export type SignOffLevel = typeof SIGN_OFF_LEVELS[number];

// =============================================================================
// 10. LINKAGE STATUS OPTIONS
// =============================================================================

export const LINKAGE_STATUSES = [
  'OK',
  'BROKEN',
  'AUTO_REPAIRED',
  'NEEDS_REVIEW',
  'LOCKED'
] as const;

export type LinkageStatus = typeof LINKAGE_STATUSES[number];

// =============================================================================
// 11. ADDITIONAL ENUMS FOR COMPLETENESS
// =============================================================================

export const CONTROLS_RELIANCE_OPTIONS = [
  'Full Reliance',
  'Partial Reliance',
  'No Reliance'
] as const;

export type ControlsReliance = typeof CONTROLS_RELIANCE_OPTIONS[number];

export const AUDIT_APPROACHES = [
  'Substantive-based',
  'Controls-reliant',
  'Combined'
] as const;

export type AuditApproach = typeof AUDIT_APPROACHES[number];

export const TIMING_OPTIONS = [
  'Interim',
  'Year-End',
  'Both'
] as const;

export type TimingOption = typeof TIMING_OPTIONS[number];

export const AI_APPROVAL_STATUSES = [
  'Pending',
  'Approved',
  'Rejected'
] as const;

export type AIApprovalStatus = typeof AI_APPROVAL_STATUSES[number];

export const VALIDATION_STATUSES = [
  'Valid',
  'Invalid',
  'Pending'
] as const;

export type ValidationStatus = typeof VALIDATION_STATUSES[number];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get assertions for a specific context (transactions, balances, or disclosures)
 */
export function getAssertionsForContext(context: AssertionContext): readonly string[] {
  return ASSERTIONS_BY_CONTEXT[context];
}

/**
 * Get all assertions across all contexts
 */
export function getAllAssertions(): string[] {
  return [
    ...TRANSACTION_ASSERTIONS,
    ...BALANCE_ASSERTIONS.filter(a => !TRANSACTION_ASSERTIONS.includes(a as any)),
    ...DISCLOSURE_ASSERTIONS.filter(a => 
      !TRANSACTION_ASSERTIONS.includes(a as any) && 
      !BALANCE_ASSERTIONS.includes(a as any)
    )
  ];
}

/**
 * Determine assertion context based on FS Head
 */
export function getContextForFSHead(fsHead: FSHead): AssertionContext {
  const transactionHeads: FSHead[] = [
    'Revenue from Operations',
    'Cost of Sales',
    'Gross Profit'
  ];
  
  const disclosureHeads: FSHead[] = [
    'Disclosures',
    'Related Party Balances'
  ];
  
  if (transactionHeads.includes(fsHead)) {
    return 'transactions';
  }
  if (disclosureHeads.includes(fsHead)) {
    return 'disclosures';
  }
  return 'balances';
}

/**
 * Get procedure packs configuration for a specific FS Head
 */
export function getProcedurePacksForFSHead(fsHead: string): {
  assertions: readonly string[];
  recommendedCategories: ProcedureCategoryCode[];
  commonNatures: ProcedureNature[];
  riskFocus: RiskDriver[];
} {
  const context = getContextForFSHead(fsHead as FSHead);
  const assertions = getAssertionsForContext(context);
  
  const packConfig: Record<string, {
    recommendedCategories: ProcedureCategoryCode[];
    commonNatures: ProcedureNature[];
    riskFocus: RiskDriver[];
  }> = {
    'Revenue from Operations': {
      recommendedCategories: ['ToD', 'SAP', 'ToC'],
      commonNatures: ['Inspection', 'Recalculation', 'Confirmation', 'Analytical review'],
      riskFocus: ['Revenue pressure', 'Complex estimates', 'Management override']
    },
    'Trade Receivables': {
      recommendedCategories: ['ToD', 'SAP'],
      commonNatures: ['Confirmation', 'Inspection', 'Recalculation'],
      riskFocus: ['Complex estimates', 'Revenue pressure']
    },
    'Inventories': {
      recommendedCategories: ['ToD', 'ToC'],
      commonNatures: ['Observation', 'Inspection', 'Recalculation'],
      riskFocus: ['Complex estimates', 'High volume transactions']
    },
    'Property, Plant & Equipment': {
      recommendedCategories: ['ToD', 'SAP'],
      commonNatures: ['Inspection', 'Recalculation', 'Inquiry'],
      riskFocus: ['Complex estimates', 'First-year audit / major change']
    },
    'Cash & Bank Balances': {
      recommendedCategories: ['ToD'],
      commonNatures: ['Confirmation', 'Inspection', 'Recalculation'],
      riskFocus: ['Management override', 'Manual journals']
    },
    'Related Party Balances': {
      recommendedCategories: ['ToD', 'SAP'],
      commonNatures: ['Inspection', 'Inquiry', 'Confirmation'],
      riskFocus: ['Related party dominance', 'Management override']
    }
  };
  
  const defaultConfig = {
    recommendedCategories: ['ToD', 'SAP'] as ProcedureCategoryCode[],
    commonNatures: ['Inspection', 'Recalculation', 'Inquiry'] as ProcedureNature[],
    riskFocus: ['Complex estimates'] as RiskDriver[]
  };
  
  const config = packConfig[fsHead] || defaultConfig;
  
  return {
    assertions,
    ...config
  };
}

/**
 * Get default stratification plan based on population value and performance materiality
 */
export function getDefaultStratification(
  populationValue: number,
  materialityPM: number
): {
  strata: {
    type: StratumType;
    threshold: number;
    approach: StratumSamplingApproach;
    description: string;
  }[];
  isStratified: boolean;
  rationale: string;
} {
  const tolerableError = materialityPM * 0.5;
  const topPercentageThreshold = populationValue * 0.2;
  
  const strata: {
    type: StratumType;
    threshold: number;
    approach: StratumSamplingApproach;
    description: string;
  }[] = [];
  
  strata.push({
    type: 'High-Value',
    threshold: materialityPM,
    approach: 'Key Item (100%)',
    description: `Items above PM (${formatCurrency(materialityPM)}) - 100% testing`
  });
  
  strata.push({
    type: 'High-Value',
    threshold: tolerableError,
    approach: 'Key Item (100%)',
    description: `Items above tolerable error (${formatCurrency(tolerableError)}) - 100% testing`
  });
  
  strata.push({
    type: 'Related Party',
    threshold: 0,
    approach: 'Key Item (100%)',
    description: 'All related party transactions - 100% testing'
  });
  
  strata.push({
    type: 'Manual Journal',
    threshold: 0,
    approach: 'Sample',
    description: 'Manual journal entries - targeted sampling'
  });
  
  strata.push({
    type: 'Standard',
    threshold: 0,
    approach: 'Sample',
    description: 'Remaining population - random sampling'
  });
  
  const isStratified = populationValue > materialityPM * 10;
  
  return {
    strata,
    isStratified,
    rationale: isStratified
      ? `Population value (${formatCurrency(populationValue)}) exceeds 10x PM (${formatCurrency(materialityPM * 10)}), stratification recommended per ISA 530.A11`
      : `Population value (${formatCurrency(populationValue)}) is relatively homogeneous, basic stratification applied`
  };
}

/**
 * Calculate sample size based on ISA 530 parameters
 */
export function calculateSampleSize(params: {
  populationValue: number;
  populationCount: number;
  confidenceLevel: ConfidenceLevel;
  tolerableError: number;
  expectedError: number;
  riskLevel: RiskLevel;
}): {
  baseSampleSize: number;
  adjustedSampleSize: number;
  adjustments: { factor: string; adjustment: number; rationale: string }[];
  method: string;
} {
  const { populationValue, populationCount, confidenceLevel, tolerableError, expectedError, riskLevel } = params;
  
  const confidenceFactor = CONFIDENCE_FACTORS[confidenceLevel];
  
  let baseSampleSize = Math.ceil(
    (confidenceFactor * populationValue) / tolerableError
  );
  
  baseSampleSize = Math.min(baseSampleSize, populationCount);
  
  const adjustments: { factor: string; adjustment: number; rationale: string }[] = [];
  let adjustedSampleSize = baseSampleSize;
  
  if (riskLevel === 'High') {
    const riskAdjustment = Math.ceil(baseSampleSize * 0.25);
    adjustments.push({
      factor: 'High Risk Assessment',
      adjustment: riskAdjustment,
      rationale: 'Increased sample for high-risk area per ISA 530.A7'
    });
    adjustedSampleSize += riskAdjustment;
  }
  
  if (expectedError > 0) {
    const errorAdjustment = Math.ceil((expectedError / tolerableError) * baseSampleSize * 0.5);
    adjustments.push({
      factor: 'Expected Error Adjustment',
      adjustment: errorAdjustment,
      rationale: `Expected error of ${formatCurrency(expectedError)} requires larger sample per ISA 530.A8`
    });
    adjustedSampleSize += errorAdjustment;
  }
  
  adjustedSampleSize = Math.min(adjustedSampleSize, populationCount);
  adjustedSampleSize = Math.max(adjustedSampleSize, 25);
  
  return {
    baseSampleSize,
    adjustedSampleSize,
    adjustments,
    method: 'MUS-based calculation per ISA 530'
  };
}

/**
 * Get ISA reference for a specific audit area
 */
export function getISAReference(area: string): string {
  const references: Record<string, string> = {
    'risk_assessment': 'ISA 315 (Revised 2019)',
    'fraud_risk': 'ISA 240',
    'materiality': 'ISA 320, ISA 450',
    'sampling': 'ISA 530',
    'audit_evidence': 'ISA 500',
    'audit_procedures': 'ISA 330',
    'significant_risk': 'ISA 315.28',
    'controls': 'ISA 315.26, ISA 330.8',
    'analytical_procedures': 'ISA 520',
    'confirmations': 'ISA 505',
    'related_parties': 'ISA 550',
    'estimates': 'ISA 540 (Revised)',
    'opening_balances': 'ISA 510',
    'subsequent_events': 'ISA 560',
    'going_concern': 'ISA 570 (Revised)',
    'management_representations': 'ISA 580',
    'documentation': 'ISA 230',
    'quality_control': 'ISQM 1, ISQM 2'
  };
  
  return references[area.toLowerCase()] || 'ISA Standards';
}

/**
 * Format currency for display
 */
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
}

/**
 * Validate linkage between components
 */
export function validateLinkage(params: {
  sourceType: 'risk' | 'sample' | 'procedure' | 'evidence';
  sourceId: string;
  targetType: 'risk' | 'sample' | 'procedure' | 'evidence';
  targetId: string;
}): { status: LinkageStatus; message: string } {
  const { sourceType, sourceId, targetType, targetId } = params;
  
  if (!sourceId || !targetId) {
    return { status: 'BROKEN', message: 'Missing source or target ID' };
  }
  
  const validLinkages: Record<string, string[]> = {
    'risk': ['sample', 'procedure'],
    'sample': ['procedure', 'evidence'],
    'procedure': ['evidence'],
    'evidence': []
  };
  
  if (!validLinkages[sourceType]?.includes(targetType)) {
    return { status: 'NEEDS_REVIEW', message: `Unusual linkage: ${sourceType} -> ${targetType}` };
  }
  
  return { status: 'OK', message: 'Linkage validated' };
}

// =============================================================================
// TYPE INTERFACES FOR COMPLEX STRUCTURES
// =============================================================================

export interface ProcedureStep {
  stepNumber: number;
  action: string;
  expectedResult: string;
  evidenceRequired: string;
}

export interface AuditProcedureConfig {
  procedureId: string;
  fsHead: FSHead;
  assertion: Assertion;
  category: ProcedureCategoryCode;
  source: ProcedureSource;
  nature: ProcedureNature[];
  objective: string;
  steps: ProcedureStep[];
  expectedEvidence: EvidenceType[];
  isaReference: string;
  timing: TimingOption;
  executionStatus: ExecutionStatus;
}

export interface SampleConfig {
  populationSource: PopulationSource;
  filters: PopulationFilter[];
  approach: SamplingApproach;
  selectionMethod: SelectionMethod;
  confidenceLevel: ConfidenceLevel;
  stratification: StratificationOption[];
}

export interface RiskAssessmentConfig {
  riskType: RiskType;
  riskLevel: RiskLevel;
  riskDrivers: RiskDriver[];
  fsHeadsAffected: FSHead[];
  assertionsAffected: Assertion[];
  isaReference: string;
}

export interface EvidenceConfig {
  evidenceType: EvidenceType;
  uploadMode: EvidenceUploadMode;
  status: EvidenceStatus;
  linkedProcedureId: string;
  linkedSampleId?: string;
}

export interface ReviewConfig {
  level: ReviewLevel;
  testResult: TestResult;
  exceptionSeverity?: ExceptionSeverity;
  signOffLevel: SignOffLevel;
}
