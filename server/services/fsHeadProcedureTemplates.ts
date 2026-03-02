// FS Head-Specific Audit Procedure Templates (ISA-Compliant)
// Each head has tailored assertions, risks, and mandatory procedures

export interface ProcedureTemplate {
  ref: string;
  type: 'TOC' | 'TOD' | 'ANALYTICS';
  description: string;
  isaReference: string;
  mandatory: boolean;
  sampleSizeFormula?: string;
}

export interface FSHeadTemplate {
  headType: string;
  displayName: string;
  keyAssertions: string[];
  keyRisks: { description: string; isaReference?: string }[];
  riskLevel: 'LOW' | 'MODERATE' | 'HIGH';
  riskLocked: boolean;
  procedures: ProcedureTemplate[];
  specialEnforcement: string[];
  isa540Triggered: boolean;
  fraudRiskPresumed: boolean;
}

export const FS_HEAD_TEMPLATES: Record<string, FSHeadTemplate> = {
  'CASH': {
    headType: 'CASH',
    displayName: 'Cash & Cash Equivalents',
    keyAssertions: ['Existence', 'Completeness', 'Rights & Obligations', 'Valuation'],
    keyRisks: [
      { description: 'Misappropriation of cash', isaReference: 'ISA 240' },
      { description: 'Unrecorded bank items' },
      { description: 'Restrictions on cash not disclosed' },
      { description: 'FX valuation errors (if applicable)' }
    ],
    riskLevel: 'MODERATE',
    riskLocked: false,
    isa540Triggered: false,
    fraudRiskPresumed: false,
    procedures: [
      { ref: 'CASH-TOC-01', type: 'TOC', description: 'Review authorization over bank reconciliations', isaReference: 'ISA 315', mandatory: true },
      { ref: 'CASH-TOC-02', type: 'TOC', description: 'Review segregation of duties (custody vs recording)', isaReference: 'ISA 315', mandatory: true },
      { ref: 'CASH-TOD-01', type: 'TOD', description: 'Obtain bank confirmations', isaReference: 'ISA 505', mandatory: true },
      { ref: 'CASH-TOD-02', type: 'TOD', description: 'Reperform bank reconciliations', isaReference: 'ISA 500', mandatory: true },
      { ref: 'CASH-TOD-03', type: 'TOD', description: 'Test outstanding reconciling items', isaReference: 'ISA 500', mandatory: true },
      { ref: 'CASH-TOD-04', type: 'TOD', description: 'Perform cut-off testing', isaReference: 'ISA 500', mandatory: true },
      { ref: 'CASH-ANA-01', type: 'ANALYTICS', description: 'Cash turnover analysis', isaReference: 'ISA 520', mandatory: false },
      { ref: 'CASH-ANA-02', type: 'ANALYTICS', description: 'Large/unusual cash movements analysis', isaReference: 'ISA 520', mandatory: false }
    ],
    specialEnforcement: [
      'TOD mandatory if balance > PM',
      'No completion without bank confirmation or alternative procedures'
    ]
  },
  'REVENUE': {
    headType: 'REVENUE',
    displayName: 'Revenue',
    keyAssertions: ['Occurrence', 'Completeness', 'Cut-off', 'Accuracy'],
    keyRisks: [
      { description: 'Revenue overstatement (presumed fraud risk)', isaReference: 'ISA 240' },
      { description: 'Cut-off manipulation' },
      { description: 'Fictitious sales' }
    ],
    riskLevel: 'HIGH',
    riskLocked: true,
    isa540Triggered: false,
    fraudRiskPresumed: true,
    procedures: [
      { ref: 'REV-TOC-01', type: 'TOC', description: 'Review controls over sales authorization & invoicing', isaReference: 'ISA 315', mandatory: true },
      { ref: 'REV-TOD-01', type: 'TOD', description: 'Vouch invoices to contracts & dispatch documents', isaReference: 'ISA 500', mandatory: true },
      { ref: 'REV-TOD-02', type: 'TOD', description: 'Perform detailed cut-off testing', isaReference: 'ISA 500', mandatory: true },
      { ref: 'REV-TOD-03', type: 'TOD', description: 'Test credit notes issued after year-end', isaReference: 'ISA 500', mandatory: true },
      { ref: 'REV-ANA-01', type: 'ANALYTICS', description: 'Monthly revenue trend analysis', isaReference: 'ISA 520', mandatory: true },
      { ref: 'REV-ANA-02', type: 'ANALYTICS', description: 'Gross margin analysis', isaReference: 'ISA 520', mandatory: true }
    ],
    specialEnforcement: [
      'Analytics-only completion NOT allowed',
      'Risk level locked at HIGH (ISA 240 presumed fraud)',
      'TOD procedures are NON-OVERRIDABLE'
    ]
  },
  'INVENTORY': {
    headType: 'INVENTORY',
    displayName: 'Inventory',
    keyAssertions: ['Existence', 'Valuation', 'Completeness'],
    keyRisks: [
      { description: 'Obsolete / slow-moving inventory' },
      { description: 'Incorrect valuation (NRV vs cost)' },
      { description: 'Non-existent stock' }
    ],
    riskLevel: 'MODERATE',
    riskLocked: false,
    isa540Triggered: true,
    fraudRiskPresumed: false,
    procedures: [
      { ref: 'INV-TOC-01', type: 'TOC', description: 'Review controls over inventory counts', isaReference: 'ISA 315', mandatory: true },
      { ref: 'INV-TOD-01', type: 'TOD', description: 'Attend physical stock count', isaReference: 'ISA 501', mandatory: true },
      { ref: 'INV-TOD-02', type: 'TOD', description: 'Test costing method application', isaReference: 'ISA 500', mandatory: true },
      { ref: 'INV-TOD-03', type: 'TOD', description: 'Perform NRV testing', isaReference: 'ISA 540', mandatory: true },
      { ref: 'INV-TOD-04', type: 'TOD', description: 'Review slow-moving inventory analysis', isaReference: 'ISA 500', mandatory: true },
      { ref: 'INV-ANA-01', type: 'ANALYTICS', description: 'Inventory turnover analysis', isaReference: 'ISA 520', mandatory: false },
      { ref: 'INV-ANA-02', type: 'ANALYTICS', description: 'Gross margin consistency analysis', isaReference: 'ISA 520', mandatory: false }
    ],
    specialEnforcement: [
      'Physical verification mandatory if material',
      'Valuation judgment requires ISA 540 procedures'
    ]
  },
  'RECEIVABLES': {
    headType: 'RECEIVABLES',
    displayName: 'Trade Receivables',
    keyAssertions: ['Existence', 'Valuation', 'Rights'],
    keyRisks: [
      { description: 'Doubtful debts / recoverability' },
      { description: 'Fictitious balances' },
      { description: 'Related-party receivables' }
    ],
    riskLevel: 'MODERATE',
    riskLocked: false,
    isa540Triggered: true,
    fraudRiskPresumed: false,
    procedures: [
      { ref: 'REC-TOC-01', type: 'TOC', description: 'Review credit approval controls', isaReference: 'ISA 315', mandatory: true },
      { ref: 'REC-TOD-01', type: 'TOD', description: 'Send external confirmations', isaReference: 'ISA 505', mandatory: true },
      { ref: 'REC-TOD-02', type: 'TOD', description: 'Perform subsequent receipts testing', isaReference: 'ISA 500', mandatory: true },
      { ref: 'REC-TOD-03', type: 'TOD', description: 'Review ageing & ECL assumptions', isaReference: 'ISA 540', mandatory: true },
      { ref: 'REC-ANA-01', type: 'ANALYTICS', description: 'Ageing trend analysis', isaReference: 'ISA 520', mandatory: false },
      { ref: 'REC-ANA-02', type: 'ANALYTICS', description: 'Days sales outstanding (DSO) analysis', isaReference: 'ISA 520', mandatory: false }
    ],
    specialEnforcement: [
      'If confirmations not received, alternative procedures mandatory'
    ]
  },
  'PREPAYMENTS': {
    headType: 'PREPAYMENTS',
    displayName: 'Prepayments & Other Receivables',
    keyAssertions: ['Existence', 'Valuation', 'Cut-off'],
    keyRisks: [
      { description: 'Incorrect capitalization' },
      { description: 'Expense misclassification' }
    ],
    riskLevel: 'LOW',
    riskLocked: false,
    isa540Triggered: false,
    fraudRiskPresumed: false,
    procedures: [
      { ref: 'PRE-TOD-01', type: 'TOD', description: 'Vouch to underlying contracts', isaReference: 'ISA 500', mandatory: true },
      { ref: 'PRE-TOD-02', type: 'TOD', description: 'Test amortization calculations', isaReference: 'ISA 500', mandatory: true },
      { ref: 'PRE-TOD-03', type: 'TOD', description: 'Verify cut-off', isaReference: 'ISA 500', mandatory: true },
      { ref: 'PRE-ANA-01', type: 'ANALYTICS', description: 'Comparison with prior year', isaReference: 'ISA 520', mandatory: false }
    ],
    specialEnforcement: []
  },
  'FIXED_ASSETS': {
    headType: 'FIXED_ASSETS',
    displayName: 'Property, Plant & Equipment',
    keyAssertions: ['Existence', 'Valuation', 'Classification'],
    keyRisks: [
      { description: 'Incorrect capitalization' },
      { description: 'Depreciation errors' },
      { description: 'Impairment indicators' }
    ],
    riskLevel: 'MODERATE',
    riskLocked: false,
    isa540Triggered: true,
    fraudRiskPresumed: false,
    procedures: [
      { ref: 'PPE-TOC-01', type: 'TOC', description: 'Review capitalization approval controls', isaReference: 'ISA 315', mandatory: true },
      { ref: 'PPE-TOD-01', type: 'TOD', description: 'Vouch additions to invoices', isaReference: 'ISA 500', mandatory: true },
      { ref: 'PPE-TOD-02', type: 'TOD', description: 'Recalculate depreciation', isaReference: 'ISA 500', mandatory: true },
      { ref: 'PPE-TOD-03', type: 'TOD', description: 'Review impairment indicators', isaReference: 'ISA 540', mandatory: true },
      { ref: 'PPE-ANA-01', type: 'ANALYTICS', description: 'Depreciation trend analysis', isaReference: 'ISA 520', mandatory: false }
    ],
    specialEnforcement: [
      'Impairment review mandatory per ISA 540'
    ]
  },
  'INTANGIBLES': {
    headType: 'INTANGIBLES',
    displayName: 'Intangible Assets',
    keyAssertions: ['Valuation', 'Rights', 'Presentation'],
    keyRisks: [
      { description: 'Subjective valuation' },
      { description: 'Incorrect useful life estimation' }
    ],
    riskLevel: 'HIGH',
    riskLocked: false,
    isa540Triggered: true,
    fraudRiskPresumed: false,
    procedures: [
      { ref: 'INT-TOD-01', type: 'TOD', description: 'Review valuation methodology', isaReference: 'ISA 540', mandatory: true },
      { ref: 'INT-TOD-02', type: 'TOD', description: 'Test amortization calculations', isaReference: 'ISA 500', mandatory: true },
      { ref: 'INT-TOD-03', type: 'TOD', description: 'Perform impairment assessment', isaReference: 'ISA 540', mandatory: true }
    ],
    specialEnforcement: [
      'ISA 540 always triggered',
      'Risk defaults to HIGH unless justified'
    ]
  },
  'PAYABLES': {
    headType: 'PAYABLES',
    displayName: 'Payables & Accruals',
    keyAssertions: ['Completeness', 'Cut-off'],
    keyRisks: [
      { description: 'Unrecorded liabilities' },
      { description: 'Expense understatement' }
    ],
    riskLevel: 'MODERATE',
    riskLocked: false,
    isa540Triggered: false,
    fraudRiskPresumed: false,
    procedures: [
      { ref: 'PAY-TOD-01', type: 'TOD', description: 'Search for unrecorded liabilities', isaReference: 'ISA 500', mandatory: true },
      { ref: 'PAY-TOD-02', type: 'TOD', description: 'Review post-year-end payments', isaReference: 'ISA 500', mandatory: true },
      { ref: 'PAY-TOD-03', type: 'TOD', description: 'Perform cut-off testing', isaReference: 'ISA 500', mandatory: true },
      { ref: 'PAY-ANA-01', type: 'ANALYTICS', description: 'Expense ratio vs revenue analysis', isaReference: 'ISA 520', mandatory: false }
    ],
    specialEnforcement: []
  },
  'EXPENSES': {
    headType: 'EXPENSES',
    displayName: 'Operating Expenses',
    keyAssertions: ['Accuracy', 'Classification', 'Cut-off'],
    keyRisks: [
      { description: 'Expense overstatement' },
      { description: 'Capital vs revenue misclassification' }
    ],
    riskLevel: 'LOW',
    riskLocked: false,
    isa540Triggered: false,
    fraudRiskPresumed: false,
    procedures: [
      { ref: 'EXP-TOC-01', type: 'TOC', description: 'Review expense approval controls', isaReference: 'ISA 315', mandatory: true },
      { ref: 'EXP-TOD-01', type: 'TOD', description: 'Sample vouching of expenses', isaReference: 'ISA 500', mandatory: true },
      { ref: 'EXP-TOD-02', type: 'TOD', description: 'Perform cut-off testing', isaReference: 'ISA 500', mandatory: true },
      { ref: 'EXP-ANA-01', type: 'ANALYTICS', description: 'Expense trend analysis', isaReference: 'ISA 520', mandatory: false }
    ],
    specialEnforcement: []
  },
  'LOANS': {
    headType: 'LOANS',
    displayName: 'Loans & Borrowings',
    keyAssertions: ['Completeness', 'Valuation', 'Presentation'],
    keyRisks: [
      { description: 'Missing disclosures' },
      { description: 'Incorrect interest calculation' },
      { description: 'Covenant breaches' }
    ],
    riskLevel: 'MODERATE',
    riskLocked: false,
    isa540Triggered: false,
    fraudRiskPresumed: false,
    procedures: [
      { ref: 'LON-TOD-01', type: 'TOD', description: 'Review loan agreements', isaReference: 'ISA 500', mandatory: true },
      { ref: 'LON-TOD-02', type: 'TOD', description: 'Recalculate interest expense', isaReference: 'ISA 500', mandatory: true },
      { ref: 'LON-TOD-03', type: 'TOD', description: 'Verify covenant compliance', isaReference: 'ISA 500', mandatory: true }
    ],
    specialEnforcement: [
      'Covenant compliance review mandatory'
    ]
  },
  'EQUITY': {
    headType: 'EQUITY',
    displayName: 'Share Capital & Reserves',
    keyAssertions: ['Rights', 'Presentation'],
    keyRisks: [
      { description: 'Unauthorized share issuance' },
      { description: 'Incorrect reserves movement' }
    ],
    riskLevel: 'LOW',
    riskLocked: false,
    isa540Triggered: false,
    fraudRiskPresumed: false,
    procedures: [
      { ref: 'EQU-TOD-01', type: 'TOD', description: 'Verify board resolutions', isaReference: 'ISA 500', mandatory: true },
      { ref: 'EQU-TOD-02', type: 'TOD', description: 'Reconcile share capital movements', isaReference: 'ISA 500', mandatory: true },
      { ref: 'EQU-TOD-03', type: 'TOD', description: 'Review dividend declarations', isaReference: 'ISA 500', mandatory: true }
    ],
    specialEnforcement: []
  }
};

// Helper to detect FS Head type from name
export function detectFSHeadType(fsHeadName: string): string {
  const name = fsHeadName.toUpperCase();
  
  if (name.includes('CASH') || name.includes('BANK')) return 'CASH';
  if (name.includes('REVENUE') || name.includes('SALES') || name.includes('INCOME')) return 'REVENUE';
  if (name.includes('INVENTORY') || name.includes('STOCK')) return 'INVENTORY';
  if (name.includes('RECEIVABLE') || name.includes('DEBTOR')) return 'RECEIVABLES';
  if (name.includes('PREPAY') || name.includes('ADVANCE')) return 'PREPAYMENTS';
  if (name.includes('PROPERTY') || name.includes('PLANT') || name.includes('EQUIPMENT') || name.includes('PPE') || name.includes('FIXED ASSET')) return 'FIXED_ASSETS';
  if (name.includes('INTANGIBLE') || name.includes('GOODWILL') || name.includes('SOFTWARE')) return 'INTANGIBLES';
  if (name.includes('PAYABLE') || name.includes('CREDITOR') || name.includes('ACCRUAL')) return 'PAYABLES';
  if (name.includes('EXPENSE') || name.includes('COST')) return 'EXPENSES';
  if (name.includes('LOAN') || name.includes('BORROWING') || name.includes('DEBT')) return 'LOANS';
  if (name.includes('EQUITY') || name.includes('CAPITAL') || name.includes('RESERVE') || name.includes('SHARE')) return 'EQUITY';
  
  return 'EXPENSES'; // Default fallback
}

// Get template for FS Head
export function getFSHeadTemplate(fsHeadName: string): FSHeadTemplate | null {
  const headType = detectFSHeadType(fsHeadName);
  return FS_HEAD_TEMPLATES[headType] || null;
}

// Calculate sample size based on population and risk
export function calculateSampleSize(population: number, riskLevel: 'LOW' | 'MODERATE' | 'HIGH', materialityThreshold: number): number {
  const riskMultiplier = riskLevel === 'HIGH' ? 0.15 : riskLevel === 'MODERATE' ? 0.10 : 0.05;
  const baseSize = Math.ceil(population * riskMultiplier);
  const minSize = riskLevel === 'HIGH' ? 25 : riskLevel === 'MODERATE' ? 15 : 10;
  const maxSize = riskLevel === 'HIGH' ? 60 : riskLevel === 'MODERATE' ? 40 : 25;
  
  return Math.min(Math.max(baseSize, minSize), maxSize);
}

// Validate completion requirements
export function validateFSHeadCompletion(
  headType: string,
  completedProcedures: { type: string; ref: string }[],
  hasConclusion: boolean
): { canComplete: boolean; blockers: string[] } {
  const template = FS_HEAD_TEMPLATES[headType];
  if (!template) return { canComplete: true, blockers: [] };
  
  const blockers: string[] = [];
  
  // Check mandatory procedures
  const mandatoryProcs = template.procedures.filter(p => p.mandatory);
  for (const proc of mandatoryProcs) {
    const completed = completedProcedures.some(cp => cp.ref === proc.ref);
    if (!completed) {
      blockers.push(`Missing mandatory procedure: ${proc.description} (${proc.ref})`);
    }
  }
  
  // Revenue special check - must have TOD
  if (headType === 'REVENUE') {
    const hasTOD = completedProcedures.some(cp => cp.type === 'TOD');
    if (!hasTOD) {
      blockers.push('Revenue requires at least one TOD procedure (ISA 240 - Fraud Risk)');
    }
  }
  
  // No conclusion
  if (!hasConclusion) {
    blockers.push('Working paper conclusion is required');
  }
  
  return {
    canComplete: blockers.length === 0,
    blockers
  };
}
