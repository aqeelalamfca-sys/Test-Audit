// Risk → Procedure → Evidence Auto-Mapping Engine (ISA-Compliant)
// Zero orphan items - everything lives inside the FS Head

import { FS_HEAD_TEMPLATES, detectFSHeadType, type ProcedureTemplate, type FSHeadTemplate } from './fsHeadProcedureTemplates';

// =====================================
// TYPES & INTERFACES
// =====================================

export type RiskType = 'INHERENT' | 'CONTROL' | 'FRAUD' | 'ESTIMATION';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';
export type ProcedureType = 'TOC' | 'TOD' | 'ANALYTICS';
export type EvidenceStatus = 'PENDING' | 'UPLOADED' | 'VERIFIED' | 'EXCEPTION_JUSTIFIED';

export interface IdentifiedRisk {
  id: string;
  fsHeadId: string;
  riskType: RiskType;
  riskLevel: RiskLevel;
  description: string;
  assertions: string[];
  isaReference: string;
  isFraudRisk: boolean;
}

export interface MappedProcedure {
  id: string;
  ref: string;
  type: ProcedureType;
  description: string;
  isaReference: string;
  mandatory: boolean;
  locked: boolean;
  linkedRiskIds: string[];
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'BLOCKED';
  evidenceRequired: EvidenceRequirement[];
  conclusion?: string;
}

export interface EvidenceRequirement {
  id: string;
  procedureId: string;
  fsHeadId: string;
  riskId?: string;
  evidenceType: string;
  description: string;
  status: EvidenceStatus;
  uploadedCount: number;
  requiredCount: number;
  justificationIfMissing?: string;
}

export interface RiskCoverageResult {
  totalRisks: number;
  coveredRisks: number;
  coveragePercentage: number;
  uncoveredRisks: { riskId: string; description: string; missingProcedure: string }[];
  isComplete: boolean;
}

export interface FSHeadProcedureMapping {
  fsHeadId: string;
  fsHeadName: string;
  riskLevel: RiskLevel;
  riskLocked: boolean;
  mandatoryProcedures: MappedProcedure[];
  optionalProcedures: MappedProcedure[];
  completedCount: number;
  totalMandatory: number;
  riskCoverage: RiskCoverageResult;
  canComplete: boolean;
  blockers: string[];
}

// =====================================
// EVIDENCE REQUIREMENTS BY PROCEDURE TYPE
// =====================================

const EVIDENCE_REQUIREMENTS: Record<ProcedureType, { type: string; description: string }[]> = {
  TOC: [
    { type: 'PROCESS_DOC', description: 'Process documentation / flowchart' },
    { type: 'CONTROL_MATRIX', description: 'Control matrices / risk-control mapping' },
    { type: 'REPERFORMANCE', description: 'Reperformance screenshots / walkthrough notes' },
  ],
  TOD: [
    { type: 'SOURCE_DOC', description: 'Source documents (invoice, contract, GRN, bank statement)' },
    { type: 'RECALCULATION', description: 'Recalculation workings' },
    { type: 'CONFIRMATION', description: 'External confirmation replies (if applicable)' },
  ],
  ANALYTICS: [
    { type: 'ANALYSIS', description: 'System-generated analysis / data extract' },
    { type: 'EXPECTATION', description: 'Auditor expectation and explanation' },
    { type: 'CONCLUSION_NOTE', description: 'Analytical conclusion note' },
  ]
};

// =====================================
// FRAUD RISK ADDITIONAL PROCEDURES (ISA 240)
// =====================================

const FRAUD_RISK_PROCEDURES: Record<string, ProcedureTemplate[]> = {
  REVENUE: [
    { ref: 'FRAUD-REV-01', type: 'TOD', description: 'Expanded invoice to contract testing', isaReference: 'ISA 240', mandatory: true },
    { ref: 'FRAUD-REV-02', type: 'TOD', description: 'Revenue cut-off testing (last 5 days)', isaReference: 'ISA 240', mandatory: true },
    { ref: 'FRAUD-REV-03', type: 'TOD', description: 'Credit note review post year-end', isaReference: 'ISA 240', mandatory: true },
    { ref: 'FRAUD-REV-04', type: 'TOD', description: 'Journal entry testing for revenue manipulation', isaReference: 'ISA 240', mandatory: true },
  ],
  CASH: [
    { ref: 'FRAUD-CASH-01', type: 'TOD', description: 'Cash misappropriation testing', isaReference: 'ISA 240', mandatory: true },
    { ref: 'FRAUD-CASH-02', type: 'TOD', description: 'Unusual cash movements investigation', isaReference: 'ISA 240', mandatory: true },
  ],
  INVENTORY: [
    { ref: 'FRAUD-INV-01', type: 'TOD', description: 'Physical count observation with unpredictable elements', isaReference: 'ISA 240', mandatory: true },
    { ref: 'FRAUD-INV-02', type: 'TOD', description: 'Inventory fraud journal entry testing', isaReference: 'ISA 240', mandatory: true },
  ],
  DEFAULT: [
    { ref: 'FRAUD-GEN-01', type: 'TOD', description: 'Journal entry testing for fraud indicators', isaReference: 'ISA 240', mandatory: true },
    { ref: 'FRAUD-GEN-02', type: 'TOD', description: 'Management override of controls testing', isaReference: 'ISA 240', mandatory: true },
  ]
};

// =====================================
// CORE MAPPING LOGIC
// =====================================

export function mapRiskToProcedures(
  risk: IdentifiedRisk,
  fsHeadType: string
): { procedures: ProcedureTemplate[]; reasoning: string } {
  const procedures: ProcedureTemplate[] = [];
  let reasoning = '';

  // Get base template for the FS Head
  const template = FS_HEAD_TEMPLATES[fsHeadType];
  if (!template) {
    return { procedures: [], reasoning: 'No template found for FS Head type' };
  }

  // FRAUD RISK - ISA 240 (Non-overridable)
  if (risk.isFraudRisk || risk.riskType === 'FRAUD') {
    reasoning = 'FRAUD RISK DETECTED (ISA 240): Expanded TOD procedures are mandatory and non-overridable. ';
    
    // Add fraud-specific procedures
    const fraudProcs = FRAUD_RISK_PROCEDURES[fsHeadType] || FRAUD_RISK_PROCEDURES.DEFAULT;
    procedures.push(...fraudProcs);
    
    // Always add base TOD procedures for fraud risks
    const baseTOD = template.procedures.filter(p => p.type === 'TOD' && p.mandatory);
    procedures.push(...baseTOD);
    
    // Add analytics for trend detection
    const analytics = template.procedures.filter(p => p.type === 'ANALYTICS');
    procedures.push(...analytics);
    
    return { procedures, reasoning };
  }

  // HIGH RISK
  if (risk.riskLevel === 'HIGH') {
    reasoning = 'HIGH RISK: Test of Details (MANDATORY), Analytical Procedures, and Test of Controls (if controls exist). ';
    
    // Mandatory TOD
    const tod = template.procedures.filter(p => p.type === 'TOD');
    procedures.push(...tod.map(p => ({ ...p, mandatory: true })));
    
    // Analytics
    const analytics = template.procedures.filter(p => p.type === 'ANALYTICS');
    procedures.push(...analytics);
    
    // TOC if available
    const toc = template.procedures.filter(p => p.type === 'TOC');
    procedures.push(...toc);
    
    return { procedures, reasoning };
  }

  // MEDIUM RISK
  if (risk.riskLevel === 'MEDIUM') {
    reasoning = 'MEDIUM RISK: Test of Details (LIMITED), Analytical Procedures. ';
    
    // Limited TOD (first 2 mandatory TODs)
    const tod = template.procedures.filter(p => p.type === 'TOD' && p.mandatory).slice(0, 2);
    procedures.push(...tod);
    
    // Analytics
    const analytics = template.procedures.filter(p => p.type === 'ANALYTICS');
    procedures.push(...analytics);
    
    return { procedures, reasoning };
  }

  // LOW RISK
  reasoning = 'LOW RISK: Analytical Procedures only (TOD optional with justification). ';
  
  // Analytics mandatory
  const analytics = template.procedures.filter(p => p.type === 'ANALYTICS');
  if (analytics.length > 0) {
    procedures.push(...analytics.map(p => ({ ...p, mandatory: true })));
  } else {
    // If no analytics defined, use basic TOD
    const basicTod = template.procedures.filter(p => p.type === 'TOD').slice(0, 1);
    procedures.push(...basicTod);
  }
  
  return { procedures, reasoning };
}

export function generateEvidenceSlots(
  procedure: MappedProcedure,
  fsHeadId: string
): EvidenceRequirement[] {
  const requirements = EVIDENCE_REQUIREMENTS[procedure.type] || [];
  
  return requirements.map((req, index) => ({
    id: `${procedure.id}-EV-${index + 1}`,
    procedureId: procedure.id,
    fsHeadId,
    riskId: procedure.linkedRiskIds[0],
    evidenceType: req.type,
    description: req.description,
    status: 'PENDING' as EvidenceStatus,
    uploadedCount: 0,
    requiredCount: 1,
  }));
}

export function calculateRiskCoverage(
  risks: IdentifiedRisk[],
  procedures: MappedProcedure[]
): RiskCoverageResult {
  const uncoveredRisks: { riskId: string; description: string; missingProcedure: string }[] = [];
  let coveredCount = 0;

  for (const risk of risks) {
    const linkedProcedures = procedures.filter(p => p.linkedRiskIds.includes(risk.id));
    
    if (linkedProcedures.length === 0) {
      uncoveredRisks.push({
        riskId: risk.id,
        description: risk.description,
        missingProcedure: 'No procedures linked'
      });
      continue;
    }

    // Check if HIGH/FRAUD risk has TOD
    if ((risk.riskLevel === 'HIGH' || risk.isFraudRisk) && 
        !linkedProcedures.some(p => p.type === 'TOD')) {
      uncoveredRisks.push({
        riskId: risk.id,
        description: risk.description,
        missingProcedure: 'Test of Details required for HIGH/FRAUD risk'
      });
      continue;
    }

    coveredCount++;
  }

  const coveragePercentage = risks.length > 0 ? Math.round((coveredCount / risks.length) * 100) : 100;

  return {
    totalRisks: risks.length,
    coveredRisks: coveredCount,
    coveragePercentage,
    uncoveredRisks,
    isComplete: uncoveredRisks.length === 0
  };
}

// =====================================
// HARD ENFORCEMENT RULES
// =====================================

export interface EnforcementValidation {
  isValid: boolean;
  blockers: string[];
  warnings: string[];
}

export function validateFSHeadEnforcement(
  fsHeadId: string,
  fsHeadType: string,
  riskLevel: RiskLevel,
  risks: IdentifiedRisk[],
  procedures: MappedProcedure[],
  isFraudRiskPresumed: boolean
): EnforcementValidation {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const template = FS_HEAD_TEMPLATES[fsHeadType];

  // Rule 1: Risk without procedure
  const risksWithoutProcedures = risks.filter(r => 
    !procedures.some(p => p.linkedRiskIds.includes(r.id))
  );
  if (risksWithoutProcedures.length > 0) {
    blockers.push(`${risksWithoutProcedures.length} risk(s) have no linked procedures - FS Head blocked`);
  }

  // Rule 2: High risk without TOD
  if (riskLevel === 'HIGH' || isFraudRiskPresumed) {
    const hasTOD = procedures.some(p => p.type === 'TOD');
    if (!hasTOD) {
      blockers.push('HIGH risk / Fraud risk requires Test of Details - FS Head blocked');
    }
  }

  // Rule 3: Procedure without evidence
  const proceduresWithoutEvidence = procedures.filter(p => 
    p.status === 'COMPLETED' && 
    p.evidenceRequired.every(e => e.status === 'PENDING')
  );
  if (proceduresWithoutEvidence.length > 0) {
    blockers.push(`${proceduresWithoutEvidence.length} completed procedure(s) have no evidence - completion blocked`);
  }

  // Rule 4: Analytics used alone for High risk
  if (riskLevel === 'HIGH') {
    const onlyAnalytics = procedures.every(p => p.type === 'ANALYTICS');
    if (onlyAnalytics) {
      blockers.push('Analytics-only completion not allowed for HIGH risk areas');
    }
  }

  // Rule 5: Mandatory procedures not completed
  if (template) {
    const mandatoryProcs = template.procedures.filter(p => p.mandatory);
    for (const mandatory of mandatoryProcs) {
      const completed = procedures.find(p => p.ref === mandatory.ref && p.status === 'COMPLETED');
      if (!completed) {
        warnings.push(`Mandatory procedure not complete: ${mandatory.description}`);
      }
    }
  }

  // Rule 6: Revenue special enforcement
  if (fsHeadType === 'REVENUE') {
    const completedTOD = procedures.filter(p => p.type === 'TOD' && p.status === 'COMPLETED');
    if (completedTOD.length < 2) {
      blockers.push('Revenue requires at least 2 TOD procedures to be completed (ISA 240)');
    }
  }

  return {
    isValid: blockers.length === 0,
    blockers,
    warnings
  };
}

// =====================================
// FS HEAD PROCEDURE MAPPING GENERATOR
// =====================================

export function generateFSHeadProcedureMapping(
  fsHeadId: string,
  fsHeadName: string,
  risks: IdentifiedRisk[],
  existingProcedures: MappedProcedure[] = []
): FSHeadProcedureMapping {
  const fsHeadType = detectFSHeadType(fsHeadName);
  const template = FS_HEAD_TEMPLATES[fsHeadType];
  
  if (!template) {
    return {
      fsHeadId,
      fsHeadName,
      riskLevel: 'MEDIUM',
      riskLocked: false,
      mandatoryProcedures: [],
      optionalProcedures: [],
      completedCount: 0,
      totalMandatory: 0,
      riskCoverage: { totalRisks: 0, coveredRisks: 0, coveragePercentage: 100, uncoveredRisks: [], isComplete: true },
      canComplete: false,
      blockers: ['No template found for FS Head type']
    };
  }

  // Determine effective risk level
  const maxRiskLevel = risks.reduce<RiskLevel>((max, r) => {
    if (r.riskLevel === 'HIGH' || r.isFraudRisk) return 'HIGH';
    if (r.riskLevel === 'MEDIUM' && max !== 'HIGH') return 'MEDIUM';
    return max;
  }, template.riskLevel as RiskLevel);

  const effectiveRiskLevel = template.riskLocked ? (template.riskLevel as RiskLevel) : maxRiskLevel;
  
  // Generate mandatory procedures from template
  const mandatoryProcedures: MappedProcedure[] = template.procedures
    .filter(p => p.mandatory)
    .map(p => ({
      id: `${fsHeadId}-${p.ref}`,
      ref: p.ref,
      type: p.type,
      description: p.description,
      isaReference: p.isaReference,
      mandatory: true,
      locked: true,
      linkedRiskIds: risks.map(r => r.id),
      status: existingProcedures.find(ep => ep.ref === p.ref)?.status || 'NOT_STARTED',
      evidenceRequired: generateEvidenceSlots({
        id: `${fsHeadId}-${p.ref}`,
        ref: p.ref,
        type: p.type,
        description: p.description,
        isaReference: p.isaReference,
        mandatory: true,
        locked: true,
        linkedRiskIds: [],
        status: 'NOT_STARTED',
        evidenceRequired: []
      }, fsHeadId)
    }));

  // Add fraud-specific procedures if applicable
  if (template.fraudRiskPresumed || risks.some(r => r.isFraudRisk)) {
    const fraudProcs = FRAUD_RISK_PROCEDURES[fsHeadType] || FRAUD_RISK_PROCEDURES.DEFAULT;
    for (const fp of fraudProcs) {
      if (!mandatoryProcedures.some(mp => mp.ref === fp.ref)) {
        mandatoryProcedures.push({
          id: `${fsHeadId}-${fp.ref}`,
          ref: fp.ref,
          type: fp.type,
          description: fp.description,
          isaReference: fp.isaReference,
          mandatory: true,
          locked: true,
          linkedRiskIds: risks.filter(r => r.isFraudRisk).map(r => r.id),
          status: 'NOT_STARTED',
          evidenceRequired: generateEvidenceSlots({
            id: `${fsHeadId}-${fp.ref}`,
            ref: fp.ref,
            type: fp.type,
            description: fp.description,
            isaReference: fp.isaReference,
            mandatory: true,
            locked: true,
            linkedRiskIds: [],
            status: 'NOT_STARTED',
            evidenceRequired: []
          }, fsHeadId)
        });
      }
    }
  }

  // Generate optional procedures
  const optionalProcedures: MappedProcedure[] = template.procedures
    .filter(p => !p.mandatory)
    .map(p => ({
      id: `${fsHeadId}-${p.ref}`,
      ref: p.ref,
      type: p.type,
      description: p.description,
      isaReference: p.isaReference,
      mandatory: false,
      locked: false,
      linkedRiskIds: [],
      status: existingProcedures.find(ep => ep.ref === p.ref)?.status || 'NOT_STARTED',
      evidenceRequired: []
    }));

  const allProcedures = [...mandatoryProcedures, ...optionalProcedures];
  const riskCoverage = calculateRiskCoverage(risks, allProcedures);
  const enforcement = validateFSHeadEnforcement(
    fsHeadId,
    fsHeadType,
    effectiveRiskLevel,
    risks,
    allProcedures,
    template.fraudRiskPresumed
  );

  const completedCount = mandatoryProcedures.filter(p => p.status === 'COMPLETED').length;

  return {
    fsHeadId,
    fsHeadName,
    riskLevel: effectiveRiskLevel,
    riskLocked: template.riskLocked,
    mandatoryProcedures,
    optionalProcedures,
    completedCount,
    totalMandatory: mandatoryProcedures.length,
    riskCoverage,
    canComplete: enforcement.isValid && riskCoverage.isComplete,
    blockers: [...enforcement.blockers, ...riskCoverage.uncoveredRisks.map(u => `Uncovered risk: ${u.description}`)]
  };
}

// =====================================
// AI ASSISTANCE (NON-DESTRUCTIVE)
// =====================================

export interface AISuggestion {
  type: 'RISK_LEVEL' | 'ADDITIONAL_PROCEDURE' | 'MISSING_MAPPING' | 'EVIDENCE_GAP';
  message: string;
  recommendation: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  isaReference?: string;
  aiConfidence: number;
}

export function generateAISuggestions(
  mapping: FSHeadProcedureMapping,
  risks: IdentifiedRisk[]
): AISuggestion[] {
  const suggestions: AISuggestion[] = [];

  // Suggest risk level adjustments
  if (!mapping.riskLocked && mapping.riskLevel === 'LOW') {
    const hasHighValueItems = mapping.fsHeadName.toLowerCase().includes('significant') ||
      mapping.fsHeadName.toLowerCase().includes('material');
    if (hasHighValueItems) {
      suggestions.push({
        type: 'RISK_LEVEL',
        message: 'Consider elevating risk level',
        recommendation: 'This FS Head may warrant MEDIUM or HIGH risk based on materiality indicators',
        severity: 'INFO',
        aiConfidence: 0.72
      });
    }
  }

  // Suggest additional procedures
  if (mapping.riskLevel === 'HIGH' && mapping.mandatoryProcedures.filter(p => p.type === 'TOD').length < 3) {
    suggestions.push({
      type: 'ADDITIONAL_PROCEDURE',
      message: 'Consider additional TOD procedures',
      recommendation: 'HIGH risk areas typically benefit from 3+ substantive tests',
      severity: 'INFO',
      isaReference: 'ISA 330',
      aiConfidence: 0.68
    });
  }

  // Highlight missing mappings
  for (const uncovered of mapping.riskCoverage.uncoveredRisks) {
    suggestions.push({
      type: 'MISSING_MAPPING',
      message: `Risk not covered: ${uncovered.description}`,
      recommendation: `Add procedures to address: ${uncovered.missingProcedure}`,
      severity: 'CRITICAL',
      aiConfidence: 0.95
    });
  }

  // Check evidence gaps
  const proceduresWithMissingEvidence = mapping.mandatoryProcedures.filter(p =>
    p.status === 'IN_PROGRESS' && 
    p.evidenceRequired.every(e => e.status === 'PENDING')
  );
  if (proceduresWithMissingEvidence.length > 0) {
    suggestions.push({
      type: 'EVIDENCE_GAP',
      message: `${proceduresWithMissingEvidence.length} procedure(s) in progress without evidence`,
      recommendation: 'Upload supporting documentation before marking procedures complete',
      severity: 'WARNING',
      isaReference: 'ISA 500',
      aiConfidence: 0.88
    });
  }

  return suggestions;
}
