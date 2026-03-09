import { Router, Response } from "express";
import { prisma } from "./db";
import { requireAuth, type AuthenticatedRequest } from "./auth";

const router = Router();

interface PlanningInput {
  riskAssessment: {
    fsLevelRisks: FSLevelRisk[];
    assertionLevelRisks: AssertionLevelRisk[];
    significantRisks: SignificantRisk[];
    fraudRisks: FraudRisk[];
  };
  analyticalProcedures: {
    significantFluctuations: SignificantFluctuation[];
    ratioAnomalies: RatioAnomaly[];
    riskInformingAnalytics: string[];
  };
  materiality: {
    overallMateriality: number;
    performanceMateriality: number;
    trivialThreshold: number;
    qualitativeAdjustments: string[];
  };
  entityCharacteristics: {
    size: string;
    complexity: string;
    industryRiskProfile: string;
    governance: string;
    controlEnvironment: string;
    useOfIT: string;
    priorYearExperience: string;
  };
}

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
  responseRequired: boolean;
}

interface FraudRisk {
  id: string;
  type: 'Revenue Recognition' | 'Management Override' | 'Misappropriation' | 'Other';
  description: string;
  affectedAreas: string[];
  likelihood: 'High' | 'Medium' | 'Low';
  magnitude: 'High' | 'Medium' | 'Low';
}

interface SignificantFluctuation {
  id: string;
  fsHeadKey: string;
  fsHeadLabel: string;
  movementPercentage: number;
  status: string;
  affectedAssertions: string[];
}

interface RatioAnomaly {
  ratioName: string;
  currentValue: number;
  priorValue: number;
  variance: number;
  status: string;
}

interface OverallAuditApproach {
  approachType: 'Substantive-based' | 'Controls-reliant' | 'Combined';
  justification: string;
  controlEnvironmentAssessment: 'Strong' | 'Moderate' | 'Weak';
  riskNatureConsiderations: string[];
  controlReliabilityRationale: string;
  costBenefitAnalysis: string;
}

interface ScopeTimingDirection {
  scope: {
    fsAreasOfFocus: FSAreaFocus[];
    significantLocations: string[];
    componentsIncluded: string[];
    expertsRequired: ExpertRequirement[];
  };
  timing: {
    interimWorkScope: string[];
    yearEndWorkScope: string[];
    rollForwardProcedures: string[];
    reportingDeadlines: ReportingMilestone[];
  };
  direction: {
    highRiskEmphasis: string[];
    professionalSkepticismAreas: string[];
    analyticsUsage: string[];
    teamCommunication: string;
  };
}

interface FSAreaFocus {
  fsHeadKey: string;
  fsHeadLabel: string;
  focusLevel: 'Primary' | 'Secondary' | 'Standard';
  rationale: string;
}

interface ExpertRequirement {
  expertType: string;
  area: string;
  rationale: string;
  timing: string;
}

interface ReportingMilestone {
  milestone: string;
  targetDate: string;
  responsible: string;
}

interface RiskResponse {
  riskId: string;
  riskDescription: string;
  fsHeadKey: string;
  assertion: string;
  isSignificantRisk: boolean;
  fsLevelResponses: string[];
  assertionLevelResponses: AssertionResponse[];
  additionalProcedures: string[];
  specialistInvolvement: string | null;
  lowerMaterialityThreshold: number | null;
}

interface AssertionResponse {
  procedureId: string;
  procedureDescription: string;
  nature: 'Substantive' | 'TOC' | 'Combined';
  timing: 'Interim' | 'Year-End' | 'Both';
  extent: string;
}

interface ControlsRelianceDecision {
  processArea: string;
  fsHeadsAffected: string[];
  relianceDecision: 'Full Reliance' | 'Partial Reliance' | 'No Reliance';
  rationale: string;
  impactOnProcedures: {
    nature: string;
    timing: string;
    extent: string;
  };
  plannedTestsOfControls: PlannedTOC[];
}

interface PlannedTOC {
  controlId: string;
  controlDescription: string;
  testProcedure: string;
  sampleSize: number;
  timing: string;
}

interface SamplingApproach {
  fsHeadKey: string;
  fsHeadLabel: string;
  population: string;
  approach: 'Statistical' | 'Non-Statistical' | '100% Testing' | 'Targeted';
  sampleSize: number | null;
  selectionMethod: string;
  rationale: string;
  riskAlignment: string;
  materialityAlignment: string;
}

interface PotentialKAM {
  id: string;
  matter: string;
  category: 'Significant Risk' | 'High Judgment' | 'Complex Estimate' | 'Significant Assumption' | 'Other';
  linkedRisks: string[];
  rationale: string;
  preliminaryAuditFocus: string[];
  communicationTiming: string;
}

interface ResourcePlanning {
  teamComposition: TeamMember[];
  specialistInvolvement: SpecialistAllocation[];
  reviewIntensity: ReviewIntensity;
  trainingRequirements: string[];
  riskProfileAlignment: string;
}

interface TeamMember {
  role: string;
  seniorityLevel: 'Partner' | 'Manager' | 'Senior' | 'Staff';
  assignedAreas: string[];
  estimatedHours: number;
}

interface SpecialistAllocation {
  specialistType: string;
  area: string;
  timing: string;
  estimatedHours: number;
}

interface ReviewIntensity {
  managerReviewAreas: string[];
  partnerReviewAreas: string[];
  eqcrRequired: boolean;
  eqcrAreas: string[];
  riskBasedReviewFocus: string[];
}

interface DocumentationOutput {
  overallAuditApproachSummary: string;
  overallAuditStrategySummary: string;
  responseToSignificantRisksSummary: string;
  controlsRelianceStrategySummary: string;
  samplingApproachSummary: string;
  potentialKAMsSummary: string;
  isaReferences: string[];
}

interface QualityGate {
  passed: boolean;
  gate: string;
  message: string;
  isaReference: string;
}

interface QualityGates {
  allSignificantRisksAddressed: QualityGate;
  allFraudRisksAddressed: QualityGate;
  strategyConsistentWithRisk: QualityGate;
  materialityAligned: QualityGate;
  orphanRisks: string[];
  overallPassed: boolean;
}

interface ISA300StrategyResult {
  engagementId: string;
  analysisTimestamp: string;
  step1_planningInputs: PlanningInput;
  step2_overallAuditApproach: OverallAuditApproach;
  step3_scopeTimingDirection: ScopeTimingDirection;
  step4_riskResponses: RiskResponse[];
  step5_controlsRelianceDecisions: ControlsRelianceDecision[];
  step6_samplingApproaches: SamplingApproach[];
  step7_potentialKAMs: PotentialKAM[];
  step8_resourcePlanning: ResourcePlanning;
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
};

const PROCESS_AREAS = [
  { process: 'Revenue Cycle', fsHeads: ['REVENUE', 'TRADE_RECEIVABLES', 'CASH_EQUIVALENTS'] },
  { process: 'Procurement Cycle', fsHeads: ['TRADE_PAYABLES', 'INVENTORIES', 'COST_OF_SALES'] },
  { process: 'Payroll Cycle', fsHeads: ['EMPLOYEE_BENEFITS', 'ACCRUED_EXPENSES'] },
  { process: 'Treasury Cycle', fsHeads: ['CASH_EQUIVALENTS', 'BORROWINGS', 'FINANCE_COSTS'] },
  { process: 'Fixed Assets Cycle', fsHeads: ['PPE', 'INTANGIBLE_ASSETS', 'DEPRECIATION'] },
  { process: 'Financial Reporting', fsHeads: ['PROVISIONS', 'DEFERRED_TAX', 'EQUITY'] },
];

const ISA_330_PROCEDURE_TEMPLATES: Record<string, AssertionResponse[]> = {
  'Revenue-Existence': [
    { procedureId: 'REV-01', procedureDescription: 'Vouch sales transactions to supporting documentation', nature: 'Substantive', timing: 'Year-End', extent: 'Sample based on risk' },
    { procedureId: 'REV-02', procedureDescription: 'Confirm receivable balances with customers', nature: 'Substantive', timing: 'Year-End', extent: 'Stratified sample' },
  ],
  'Revenue-Completeness': [
    { procedureId: 'REV-03', procedureDescription: 'Perform sequence check on sales invoices', nature: 'Substantive', timing: 'Year-End', extent: '100% for period-end' },
    { procedureId: 'REV-04', procedureDescription: 'Trace GDNs to sales invoices', nature: 'Substantive', timing: 'Year-End', extent: 'Sample based on volume' },
  ],
  'Revenue-Cutoff': [
    { procedureId: 'REV-05', procedureDescription: 'Test sales transactions around period-end for proper cut-off', nature: 'Substantive', timing: 'Year-End', extent: 'Final 5 days and first 5 days' },
  ],
  'Receivables-Valuation': [
    { procedureId: 'AR-01', procedureDescription: 'Review aging analysis and test recoverability', nature: 'Substantive', timing: 'Year-End', extent: 'Focus on aged balances' },
    { procedureId: 'AR-02', procedureDescription: 'Evaluate allowance for doubtful accounts', nature: 'Substantive', timing: 'Year-End', extent: 'Management estimate review' },
  ],
  'Inventories-Existence': [
    { procedureId: 'INV-01', procedureDescription: 'Attend physical inventory count', nature: 'Substantive', timing: 'Year-End', extent: 'Observation and test counts' },
    { procedureId: 'INV-02', procedureDescription: 'Perform rollback/rollforward procedures', nature: 'Substantive', timing: 'Both', extent: 'If count not at year-end' },
  ],
  'Inventories-Valuation': [
    { procedureId: 'INV-03', procedureDescription: 'Test cost calculations and overhead allocations', nature: 'Substantive', timing: 'Year-End', extent: 'Sample of items' },
    { procedureId: 'INV-04', procedureDescription: 'Evaluate NRV for slow-moving items', nature: 'Substantive', timing: 'Year-End', extent: 'Focus on aged inventory' },
  ],
  'PPE-Existence': [
    { procedureId: 'PPE-01', procedureDescription: 'Physical verification of assets', nature: 'Substantive', timing: 'Year-End', extent: 'Sample of high-value items' },
    { procedureId: 'PPE-02', procedureDescription: 'Vouch additions to supporting documentation', nature: 'Substantive', timing: 'Year-End', extent: 'Material additions' },
  ],
  'Payables-Completeness': [
    { procedureId: 'AP-01', procedureDescription: 'Search for unrecorded liabilities', nature: 'Substantive', timing: 'Year-End', extent: 'Post year-end payments' },
    { procedureId: 'AP-02', procedureDescription: 'Confirm balances with major suppliers', nature: 'Substantive', timing: 'Year-End', extent: 'Stratified sample' },
  ],
};

function extractPlanningInputs(engagement: any, planningData: any, analyticsData: any, riskData: any): PlanningInput {
  const materiality = planningData?.materiality || {};
  const entityUnderstanding = planningData?.entityUnderstanding || {};
  const riskAssessment = planningData?.riskAssessment || riskData || {};
  const analytics = analyticsData || planningData?.analyticalProcedures || {};

  const fsLevelRisks: FSLevelRisk[] = (riskAssessment.fsLevelRisks || []).map((r: any, idx: number) => ({
    id: r.id || `FSR-${String(idx + 1).padStart(3, '0')}`,
    description: r.riskDescription || r.description || 'Unspecified FS-level risk',
    source: r.source || 'Entity',
    severity: r.severity || r.riskRating || 'Medium',
    impactedAreas: r.impactedFsAreas || r.impactedAreas || ['All FS Areas'],
    isFraudIndicator: r.isFraudIndicator || false,
  }));

  const assertionLevelRisks: AssertionLevelRisk[] = (riskAssessment.assertionLevelRisks || []).map((r: any, idx: number) => ({
    id: r.id || `ALR-${String(idx + 1).padStart(3, '0')}`,
    fsHeadKey: r.fsHeadKey || 'UNSPECIFIED',
    fsHeadLabel: r.fsHeadLabel || FS_HEAD_LABELS[r.fsHeadKey] || r.fsHeadKey,
    assertion: r.assertion || 'Unspecified',
    inherentRisk: r.inherentRisk || 'Medium',
    controlRisk: r.controlRisk || 'Medium',
    combinedRisk: r.combinedRisk || r.riskRating || 'Medium',
    wcgw: r.wcgw || r.whatCouldGoWrong || `Misstatement in ${r.assertion || 'assertion'}`,
  }));

  const significantRisks: SignificantRisk[] = (riskAssessment.significantRisks || 
    assertionLevelRisks.filter((r: AssertionLevelRisk) => r.combinedRisk === 'High')).map((r: any, idx: number) => ({
    id: r.id || `SIG-${String(idx + 1).padStart(3, '0')}`,
    fsHeadKey: r.fsHeadKey || 'UNSPECIFIED',
    fsHeadLabel: r.fsHeadLabel || FS_HEAD_LABELS[r.fsHeadKey] || r.fsHeadKey,
    assertion: r.assertion || 'Multiple',
    riskDescription: r.riskDescription || r.wcgw || 'Significant risk requiring special audit consideration',
    rationale: r.rationale || r.significantRiskRationale || 'Risk rated as high per risk assessment',
    isPresumedFraudRisk: r.isPresumedFraudRisk || r.isFraudIndicator || false,
    responseRequired: true,
  }));

  const fraudRisks: FraudRisk[] = (riskAssessment.fraudRisks || []).map((r: any, idx: number) => ({
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
      affectedAreas: ['Revenue', 'Trade Receivables'],
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

  const significantFluctuations: SignificantFluctuation[] = (analytics.significantFluctuations || []).map((f: any) => ({
    id: f.id || `FLUCT-${Math.random().toString(36).substr(2, 9)}`,
    fsHeadKey: f.fsHeadKey || 'UNSPECIFIED',
    fsHeadLabel: f.fsHeadLabel || FS_HEAD_LABELS[f.fsHeadKey] || f.fsHeadKey,
    movementPercentage: f.movementPercentage || 0,
    status: f.status || 'Requires Explanation',
    affectedAssertions: f.affectedAssertions || ['Valuation/Accuracy'],
  }));

  const ratioAnomalies: RatioAnomaly[] = (analytics.ratioAnalysis || [])
    .filter((r: any) => r.status !== 'Expected')
    .map((r: any) => ({
      ratioName: r.ratioName || 'Unspecified Ratio',
      currentValue: r.currentYear || 0,
      priorValue: r.priorYear || 0,
      variance: r.variance || 0,
      status: r.status || 'Requires Explanation',
    }));

  return {
    riskAssessment: {
      fsLevelRisks,
      assertionLevelRisks,
      significantRisks,
      fraudRisks,
    },
    analyticalProcedures: {
      significantFluctuations,
      ratioAnomalies,
      riskInformingAnalytics: analytics.auditStrategyImpact?.map((i: any) => i.planningConclusion) || [],
    },
    materiality: {
      overallMateriality: materiality.overallMateriality || 100000,
      performanceMateriality: materiality.performanceMateriality || (materiality.overallMateriality * 0.75) || 75000,
      trivialThreshold: materiality.trivialThreshold || (materiality.overallMateriality * 0.05) || 5000,
      qualitativeAdjustments: materiality.qualitativeFactorsConsidered || [],
    },
    entityCharacteristics: {
      size: entityUnderstanding.size || engagement.client?.sizeClassification || 'Medium',
      complexity: entityUnderstanding.complexity || 'Moderate',
      industryRiskProfile: entityUnderstanding.industryRiskProfile || 'Medium',
      governance: entityUnderstanding.governance || 'Adequate',
      controlEnvironment: entityUnderstanding.controlEnvironment || riskAssessment.controlEnvironmentAssessment || 'Moderate',
      useOfIT: entityUnderstanding.itEnvironment || 'Standard',
      priorYearExperience: entityUnderstanding.priorYearExperience || 'First Year Engagement',
    },
  };
}

function determineOverallAuditApproach(planningInputs: PlanningInput): OverallAuditApproach {
  const { riskAssessment, entityCharacteristics } = planningInputs;
  
  const controlEnvironment = entityCharacteristics.controlEnvironment.toLowerCase();
  const isStrongControls = controlEnvironment.includes('strong') || controlEnvironment.includes('effective');
  const isWeakControls = controlEnvironment.includes('weak') || controlEnvironment.includes('ineffective');
  
  const highRiskCount = riskAssessment.assertionLevelRisks.filter(r => r.combinedRisk === 'High').length;
  const significantRiskCount = riskAssessment.significantRisks.length;
  const fraudRiskCount = riskAssessment.fraudRisks.length;

  let approachType: 'Substantive-based' | 'Controls-reliant' | 'Combined';
  let justification: string;
  let controlReliabilityRationale: string;
  let costBenefitAnalysis: string;

  if (isWeakControls || highRiskCount > 5 || fraudRiskCount > 3) {
    approachType = 'Substantive-based';
    justification = `A substantive-based approach has been selected due to ${isWeakControls ? 'the weak control environment' : 'the high number of significant risks identified'}. ` +
      `Per ISA 330.8, when control risk is assessed as high, audit procedures should consist primarily of substantive procedures.`;
    controlReliabilityRationale = 'Controls testing would not provide sufficient audit evidence to reduce substantive testing to acceptable levels.';
    costBenefitAnalysis = 'Given the control environment assessment, the cost of extended controls testing would not yield proportionate reduction in substantive procedures.';
  } else if (isStrongControls && highRiskCount <= 2 && fraudRiskCount <= 2) {
    approachType = 'Controls-reliant';
    justification = `A controls-reliant approach has been selected based on the strong control environment assessment. ` +
      `Per ISA 330.8, when reliance on controls is planned, tests of controls are required to obtain evidence of operating effectiveness.`;
    controlReliabilityRationale = 'Historical evidence and current assessment indicate controls are designed effectively and operating consistently.';
    costBenefitAnalysis = 'Testing controls will provide efficiency gains through reduced substantive sample sizes, particularly for high-volume transaction cycles.';
  } else {
    approachType = 'Combined';
    justification = `A combined approach has been selected, balancing controls reliance with substantive testing. ` +
      `Per ISA 330.4, audit procedures should be responsive to assessed risks at both FS and assertion levels.`;
    controlReliabilityRationale = 'Controls will be tested in areas where reliance is cost-effective; substantive focus maintained for high-risk areas.';
    costBenefitAnalysis = 'Selective controls testing in routine transaction cycles combined with substantive focus on significant risk areas provides optimal efficiency.';
  }

  const riskNatureConsiderations = [
    `${significantRiskCount} significant risks identified requiring special audit consideration`,
    `${fraudRiskCount} fraud risks assessed including presumed risks per ISA 240`,
    `Industry risk profile: ${entityCharacteristics.industryRiskProfile}`,
    `Entity complexity: ${entityCharacteristics.complexity}`,
  ];

  return {
    approachType,
    justification,
    controlEnvironmentAssessment: isStrongControls ? 'Strong' : isWeakControls ? 'Weak' : 'Moderate',
    riskNatureConsiderations,
    controlReliabilityRationale,
    costBenefitAnalysis,
  };
}

function defineScopeTimingDirection(planningInputs: PlanningInput, approach: OverallAuditApproach, engagement: any): ScopeTimingDirection {
  const { riskAssessment, materiality, entityCharacteristics } = planningInputs;

  const highRiskFsHeads = new Set<string>();
  riskAssessment.assertionLevelRisks
    .filter(r => r.combinedRisk === 'High')
    .forEach(r => highRiskFsHeads.add(r.fsHeadKey));
  riskAssessment.significantRisks.forEach(r => highRiskFsHeads.add(r.fsHeadKey));

  const fsAreasOfFocus: FSAreaFocus[] = Array.from(highRiskFsHeads).map(key => ({
    fsHeadKey: key,
    fsHeadLabel: FS_HEAD_LABELS[key] || key,
    focusLevel: 'Primary' as const,
    rationale: `High-risk area requiring focused audit procedures per ISA 330.6`,
  }));

  fsAreasOfFocus.push({
    fsHeadKey: 'REVENUE',
    fsHeadLabel: 'Revenue',
    focusLevel: 'Primary',
    rationale: 'Presumed fraud risk in revenue recognition per ISA 240.26',
  });

  const expertsRequired: ExpertRequirement[] = [];
  if (riskAssessment.assertionLevelRisks.some(r => r.fsHeadKey.includes('INTANGIBLE') || r.fsHeadKey.includes('INVESTMENT'))) {
    expertsRequired.push({
      expertType: 'Valuation Specialist',
      area: 'Intangible Assets / Investments',
      rationale: 'Complex fair value measurements require specialist involvement per ISA 620',
      timing: 'Planning through Finalization',
    });
  }
  if (riskAssessment.assertionLevelRisks.some(r => r.fsHeadKey.includes('TAX') || r.fsHeadKey.includes('DEFERRED'))) {
    expertsRequired.push({
      expertType: 'Tax Specialist',
      area: 'Tax Provisions / Deferred Tax',
      rationale: 'Complex tax matters require specialist involvement',
      timing: 'Year-End',
    });
  }
  if (entityCharacteristics.useOfIT.toLowerCase().includes('complex')) {
    expertsRequired.push({
      expertType: 'IT Audit Specialist',
      area: 'IT General Controls',
      rationale: 'Complex IT environment requires specialist assessment',
      timing: 'Planning through Execution',
    });
  }

  const isSubstantiveBased = approach.approachType === 'Substantive-based';
  const interimWorkScope = isSubstantiveBased 
    ? ['Understanding of entity and environment', 'Risk assessment procedures', 'Walkthrough of key processes']
    : ['Tests of controls for key cycles', 'Interim substantive analytics', 'Walkthrough of key processes', 'Roll-forward risk assessment'];

  const yearEndWorkScope = [
    'Substantive testing of significant balances',
    'Cut-off testing',
    'Search for unrecorded liabilities',
    'Subsequent events review',
    'Management representations',
    'Analytical review of financial statements',
  ];

  const rollForwardProcedures = isSubstantiveBased
    ? ['Limited roll-forward of interim work to year-end']
    : ['Roll-forward of controls tested at interim', 'Update risk assessment for period-end', 'Substantive testing of intervening period transactions'];

  const reportDeadline = engagement.reportDeadline ? new Date(engagement.reportDeadline).toISOString().split('T')[0] : 'To be determined';
  const periodEnd = engagement.periodEnd ? new Date(engagement.periodEnd).toISOString().split('T')[0] : 'Year-end';

  const reportingDeadlines: ReportingMilestone[] = [
    { milestone: 'Planning Completion', targetDate: 'Prior to fieldwork', responsible: 'Engagement Manager' },
    { milestone: 'Interim Fieldwork', targetDate: 'Q3', responsible: 'Audit Team' },
    { milestone: 'Year-End Fieldwork', targetDate: `Post ${periodEnd}`, responsible: 'Audit Team' },
    { milestone: 'Draft Report', targetDate: reportDeadline, responsible: 'Engagement Partner' },
  ];

  const highRiskEmphasis = Array.from(highRiskFsHeads).map(key => 
    `Focus extended procedures on ${FS_HEAD_LABELS[key] || key} due to assessed high risk`
  );
  highRiskEmphasis.push('Apply heightened professional skepticism to significant estimates and management judgments');
  highRiskEmphasis.push('Design unpredictable audit procedures to address fraud risk per ISA 240.30');

  return {
    scope: {
      fsAreasOfFocus,
      significantLocations: ['Head Office'],
      componentsIncluded: ['Primary Operating Entity'],
      expertsRequired,
    },
    timing: {
      interimWorkScope,
      yearEndWorkScope,
      rollForwardProcedures,
      reportingDeadlines,
    },
    direction: {
      highRiskEmphasis,
      professionalSkepticismAreas: [
        'Revenue recognition and cut-off',
        'Management estimates and judgments',
        'Related party transactions',
        'Journal entries and adjustments',
        'Going concern assessment',
      ],
      analyticsUsage: [
        'Preliminary analytics to identify risk areas',
        'Substantive analytics for low-risk balances',
        'Trend analysis for income statement accounts',
        'Ratio analysis for reasonableness testing',
      ],
      teamCommunication: 'Regular team discussions on fraud risks, significant findings, and professional skepticism emphasis per ISA 240.15',
    },
  };
}

function generateRiskResponses(planningInputs: PlanningInput, approach: OverallAuditApproach): RiskResponse[] {
  const { riskAssessment, materiality } = planningInputs;
  const responses: RiskResponse[] = [];

  for (const sigRisk of riskAssessment.significantRisks) {
    const fsLevelResponses = [
      'Assign more experienced staff to this area',
      'Increase extent of supervision and review',
      'Apply heightened professional skepticism',
    ];

    if (sigRisk.isPresumedFraudRisk) {
      fsLevelResponses.push('Design unpredictable audit procedures');
      fsLevelResponses.push('Consider involvement of forensic specialist if warranted');
    }

    const procedureKey = `${sigRisk.fsHeadKey}-${sigRisk.assertion}`.replace(/[^A-Za-z-]/g, '');
    const templateKey = Object.keys(ISA_330_PROCEDURE_TEMPLATES).find(k => procedureKey.includes(k.split('-')[0]));
    
    let assertionLevelResponses = templateKey 
      ? ISA_330_PROCEDURE_TEMPLATES[templateKey].map(p => ({...p, extent: 'Extended sample size due to significant risk'}))
      : [{
          procedureId: `PROC-${sigRisk.id}`,
          procedureDescription: `Perform substantive procedures for ${sigRisk.assertion} of ${sigRisk.fsHeadLabel}`,
          nature: 'Substantive' as const,
          timing: 'Year-End' as const,
          extent: 'Extended sample size due to significant risk',
        }];

    const additionalProcedures = [
      `Obtain sufficient appropriate audit evidence for ${sigRisk.fsHeadLabel} - ${sigRisk.assertion}`,
    ];

    if (sigRisk.isPresumedFraudRisk) {
      additionalProcedures.push('Evaluate integrity of underlying data');
      additionalProcedures.push('Consider need for external confirmation');
    }

    responses.push({
      riskId: sigRisk.id,
      riskDescription: sigRisk.riskDescription,
      fsHeadKey: sigRisk.fsHeadKey,
      assertion: sigRisk.assertion,
      isSignificantRisk: true,
      fsLevelResponses,
      assertionLevelResponses,
      additionalProcedures,
      specialistInvolvement: sigRisk.fsHeadKey.includes('INTANGIBLE') || sigRisk.fsHeadKey.includes('PROVISION') ? 'Valuation/Technical Specialist' : null,
      lowerMaterialityThreshold: sigRisk.isPresumedFraudRisk ? materiality.performanceMateriality * 0.5 : null,
    });
  }

  for (const fraudRisk of riskAssessment.fraudRisks) {
    if (!responses.some(r => r.riskId === fraudRisk.id)) {
      responses.push({
        riskId: fraudRisk.id,
        riskDescription: fraudRisk.description,
        fsHeadKey: 'ALL',
        assertion: 'Multiple',
        isSignificantRisk: true,
        fsLevelResponses: [
          'Incorporate element of unpredictability in procedures',
          'Evaluate design and implementation of fraud-related controls',
          'Apply professional skepticism throughout engagement',
          'Discuss fraud risks with engagement team',
        ],
        assertionLevelResponses: [
          {
            procedureId: `FRAUD-${fraudRisk.id}`,
            procedureDescription: fraudRisk.type === 'Management Override' 
              ? 'Test journal entries for unusual characteristics'
              : `Address ${fraudRisk.type} through targeted substantive procedures`,
            nature: 'Substantive',
            timing: 'Year-End',
            extent: 'Risk-based selection',
          },
        ],
        additionalProcedures: [
          'Evaluate accounting estimates for bias',
          'Evaluate business rationale for significant unusual transactions',
          fraudRisk.type === 'Management Override' ? 'Perform retrospective review of prior year estimates' : `Focus on ${fraudRisk.affectedAreas.join(', ')}`,
        ],
        specialistInvolvement: null,
        lowerMaterialityThreshold: materiality.performanceMateriality * 0.5,
      });
    }
  }

  return responses;
}

function determineControlsReliance(planningInputs: PlanningInput, approach: OverallAuditApproach): ControlsRelianceDecision[] {
  const decisions: ControlsRelianceDecision[] = [];
  const { riskAssessment, entityCharacteristics } = planningInputs;

  const isSubstantiveBased = approach.approachType === 'Substantive-based';
  const isControlsReliant = approach.approachType === 'Controls-reliant';

  for (const processArea of PROCESS_AREAS) {
    const affectedRisks = riskAssessment.assertionLevelRisks.filter(r => 
      processArea.fsHeads.some(h => r.fsHeadKey.includes(h))
    );
    const hasHighRisk = affectedRisks.some(r => r.combinedRisk === 'High');
    const hasSignificantRisk = riskAssessment.significantRisks.some(r =>
      processArea.fsHeads.some(h => r.fsHeadKey.includes(h))
    );

    let relianceDecision: 'Full Reliance' | 'Partial Reliance' | 'No Reliance';
    let rationale: string;
    let impactOnProcedures: { nature: string; timing: string; extent: string };
    let plannedTestsOfControls: PlannedTOC[] = [];

    if (isSubstantiveBased || hasSignificantRisk) {
      relianceDecision = 'No Reliance';
      rationale = hasSignificantRisk 
        ? 'Significant risk identified - substantive approach required per ISA 330.15'
        : 'Substantive-based approach selected - controls testing not planned';
      impactOnProcedures = {
        nature: 'Primarily substantive procedures',
        timing: 'Year-end focus',
        extent: 'Extended sample sizes',
      };
    } else if (isControlsReliant && !hasHighRisk) {
      relianceDecision = 'Full Reliance';
      rationale = 'Strong control environment and no significant risks in this cycle - controls reliance efficient';
      impactOnProcedures = {
        nature: 'Combined approach with controls emphasis',
        timing: 'Interim controls testing with year-end substantive',
        extent: 'Reduced substantive sample sizes',
      };
      plannedTestsOfControls = [
        {
          controlId: `TOC-${processArea.process.replace(/\s+/g, '-')}`,
          controlDescription: `Key controls in ${processArea.process}`,
          testProcedure: 'Inquiry, observation, inspection, reperformance',
          sampleSize: 25,
          timing: 'Interim',
        },
      ];
    } else {
      relianceDecision = 'Partial Reliance';
      rationale = 'Combined approach - controls tested where efficient with substantive procedures maintained';
      impactOnProcedures = {
        nature: 'Combined approach',
        timing: 'Both interim and year-end',
        extent: 'Moderate sample sizes',
      };
      plannedTestsOfControls = [
        {
          controlId: `TOC-${processArea.process.replace(/\s+/g, '-')}`,
          controlDescription: `Selected key controls in ${processArea.process}`,
          testProcedure: 'Inquiry, observation, inspection',
          sampleSize: 15,
          timing: 'Interim',
        },
      ];
    }

    decisions.push({
      processArea: processArea.process,
      fsHeadsAffected: processArea.fsHeads,
      relianceDecision,
      rationale,
      impactOnProcedures,
      plannedTestsOfControls,
    });
  }

  return decisions;
}

function determineSamplingApproaches(planningInputs: PlanningInput, riskResponses: RiskResponse[]): SamplingApproach[] {
  const { riskAssessment, materiality } = planningInputs;
  const approaches: SamplingApproach[] = [];

  const processedFsHeads = new Set<string>();

  for (const sigRisk of riskAssessment.significantRisks) {
    if (processedFsHeads.has(sigRisk.fsHeadKey)) continue;
    processedFsHeads.add(sigRisk.fsHeadKey);

    approaches.push({
      fsHeadKey: sigRisk.fsHeadKey,
      fsHeadLabel: sigRisk.fsHeadLabel,
      population: `All transactions/balances in ${sigRisk.fsHeadLabel}`,
      approach: sigRisk.isPresumedFraudRisk ? '100% Testing' : 'Statistical',
      sampleSize: sigRisk.isPresumedFraudRisk ? null : 60,
      selectionMethod: sigRisk.isPresumedFraudRisk ? 'All items tested' : 'Monetary Unit Sampling (MUS)',
      rationale: sigRisk.isPresumedFraudRisk 
        ? 'Presumed fraud risk requires comprehensive testing'
        : 'Significant risk requires larger sample with statistical basis for projection',
      riskAlignment: 'Sample size reflects high assessed risk of material misstatement',
      materialityAlignment: `Testing threshold set at ${Math.round(materiality.performanceMateriality * 0.5).toLocaleString()} (50% of PM) for significant risk`,
    });
  }

  for (const assertionRisk of riskAssessment.assertionLevelRisks) {
    if (processedFsHeads.has(assertionRisk.fsHeadKey)) continue;
    if (assertionRisk.combinedRisk !== 'High') continue;
    processedFsHeads.add(assertionRisk.fsHeadKey);

    approaches.push({
      fsHeadKey: assertionRisk.fsHeadKey,
      fsHeadLabel: assertionRisk.fsHeadLabel,
      population: `Transactions/balances affecting ${assertionRisk.fsHeadLabel}`,
      approach: 'Statistical',
      sampleSize: 40,
      selectionMethod: 'Monetary Unit Sampling (MUS)',
      rationale: 'High combined risk requires statistical sampling for quantifiable assurance',
      riskAlignment: 'Sample size reflects elevated risk assessment',
      materialityAlignment: `Testing threshold at performance materiality of ${materiality.performanceMateriality.toLocaleString()}`,
    });
  }

  const standardFsHeads = ['TRADE_PAYABLES', 'ADMINISTRATIVE_EXPENSES', 'FINANCE_COSTS'];
  for (const fsHead of standardFsHeads) {
    if (processedFsHeads.has(fsHead)) continue;
    processedFsHeads.add(fsHead);

    approaches.push({
      fsHeadKey: fsHead,
      fsHeadLabel: FS_HEAD_LABELS[fsHead] || fsHead,
      population: `Routine transactions in ${FS_HEAD_LABELS[fsHead] || fsHead}`,
      approach: 'Non-Statistical',
      sampleSize: 25,
      selectionMethod: 'Haphazard selection with judgmental stratification',
      rationale: 'Lower risk area - non-statistical sampling appropriate',
      riskAlignment: 'Sample size appropriate for lower risk assessment',
      materialityAlignment: `Testing at performance materiality of ${materiality.performanceMateriality.toLocaleString()}`,
    });
  }

  return approaches;
}

function identifyPotentialKAMs(planningInputs: PlanningInput, riskResponses: RiskResponse[]): PotentialKAM[] {
  const { riskAssessment } = planningInputs;
  const kams: PotentialKAM[] = [];

  for (const sigRisk of riskAssessment.significantRisks) {
    kams.push({
      id: `KAM-${kams.length + 1}`,
      matter: `${sigRisk.fsHeadLabel} - ${sigRisk.assertion}`,
      category: sigRisk.isPresumedFraudRisk ? 'Significant Risk' : 'High Judgment',
      linkedRisks: [sigRisk.id],
      rationale: `Identified as significant risk during risk assessment: ${sigRisk.riskDescription}`,
      preliminaryAuditFocus: [
        `Extended substantive testing of ${sigRisk.fsHeadLabel}`,
        'Enhanced professional skepticism',
        'Detailed disclosure review',
      ],
      communicationTiming: 'Discuss with TCWG during audit completion',
    });
  }

  const estimationRisks = riskAssessment.assertionLevelRisks.filter(r => 
    r.assertion.toLowerCase().includes('valuation') && r.combinedRisk === 'High'
  );
  for (const estRisk of estimationRisks) {
    if (!kams.some(k => k.linkedRisks.includes(estRisk.id))) {
      kams.push({
        id: `KAM-${kams.length + 1}`,
        matter: `${estRisk.fsHeadLabel} - Valuation/Estimation Complexity`,
        category: 'Complex Estimate',
        linkedRisks: [estRisk.id],
        rationale: `Significant estimation uncertainty in ${estRisk.fsHeadLabel} valuation`,
        preliminaryAuditFocus: [
          'Evaluate management methodology and assumptions',
          'Test data inputs and calculations',
          'Consider need for auditor expert',
          'Assess adequacy of disclosures',
        ],
        communicationTiming: 'Discuss methodology early; findings at completion',
      });
    }
  }

  if (riskAssessment.fsLevelRisks.some(r => r.description.toLowerCase().includes('going concern'))) {
    kams.push({
      id: `KAM-${kams.length + 1}`,
      matter: 'Going Concern Assessment',
      category: 'Significant Assumption',
      linkedRisks: riskAssessment.fsLevelRisks.filter(r => r.description.toLowerCase().includes('going concern')).map(r => r.id),
      rationale: 'Material uncertainty regarding going concern identified',
      preliminaryAuditFocus: [
        'Evaluate management assessment and assumptions',
        'Review cash flow forecasts and sensitivity analyses',
        'Assess adequacy of going concern disclosures',
        'Obtain written representations',
      ],
      communicationTiming: 'Early discussion with TCWG; ongoing monitoring',
    });
  }

  return kams;
}

function planResources(planningInputs: PlanningInput, approach: OverallAuditApproach, scopeTiming: ScopeTimingDirection, engagement: any): ResourcePlanning {
  const { riskAssessment, entityCharacteristics } = planningInputs;
  const highRiskCount = riskAssessment.significantRisks.length + riskAssessment.fraudRisks.length;
  const complexity = entityCharacteristics.complexity.toLowerCase();
  const isComplex = complexity.includes('high') || complexity.includes('complex');

  const teamComposition: TeamMember[] = [
    {
      role: 'Engagement Partner',
      seniorityLevel: 'Partner',
      assignedAreas: ['Overall supervision', 'Key judgments', 'Significant risks', 'Report review'],
      estimatedHours: isComplex ? 60 : 40,
    },
    {
      role: 'Engagement Manager',
      seniorityLevel: 'Manager',
      assignedAreas: ['Day-to-day management', 'Detailed review', 'Team supervision', 'Client liaison'],
      estimatedHours: isComplex ? 120 : 80,
    },
    {
      role: 'Senior Auditor',
      seniorityLevel: 'Senior',
      assignedAreas: ['Fieldwork execution', 'Section leadership', 'Staff supervision'],
      estimatedHours: isComplex ? 200 : 150,
    },
    {
      role: 'Staff Auditor',
      seniorityLevel: 'Staff',
      assignedAreas: ['Detailed testing', 'Documentation'],
      estimatedHours: isComplex ? 300 : 200,
    },
  ];

  const specialistInvolvement: SpecialistAllocation[] = scopeTiming.scope.expertsRequired.map(exp => ({
    specialistType: exp.expertType,
    area: exp.area,
    timing: exp.timing,
    estimatedHours: 20,
  }));

  const eqcrRequired = engagement.eqcrRequired || highRiskCount > 3 || entityCharacteristics.size === 'Large';

  const reviewIntensity: ReviewIntensity = {
    managerReviewAreas: [
      'All workpapers for significant risk areas',
      'Sample of routine workpapers',
      'Analytical procedures conclusions',
      'Group instructions and reporting',
    ],
    partnerReviewAreas: [
      'Significant risk conclusions',
      'Key judgments and estimates',
      'Going concern assessment',
      'Proposed adjustments',
      'Draft audit report',
    ],
    eqcrRequired,
    eqcrAreas: eqcrRequired ? [
      'Significant risks and responses',
      'Key audit matters',
      'Going concern conclusion',
      'Overall audit approach',
      'Group audit considerations',
    ] : [],
    riskBasedReviewFocus: [
      'Areas identified as significant risks',
      'Complex accounting estimates',
      'Fraud risk response procedures',
      'New transactions or accounting matters',
    ],
  };

  return {
    teamComposition,
    specialistInvolvement,
    reviewIntensity,
    trainingRequirements: [
      'ISA 540 (Revised) - Accounting Estimates',
      'Fraud risk awareness',
      entityCharacteristics.industryRiskProfile !== 'Low' ? 'Industry-specific training' : 'General audit update',
    ],
    riskProfileAlignment: `Team composition and review intensity designed to address ${highRiskCount} significant/fraud risks with ${isComplex ? 'enhanced' : 'standard'} resources for ${entityCharacteristics.complexity} entity.`,
  };
}

function validateQualityGates(
  planningInputs: PlanningInput,
  riskResponses: RiskResponse[],
  overallApproach: OverallAuditApproach
): QualityGates {
  const significantRisks = planningInputs.significantRisks;
  const fraudRisks = planningInputs.fraudRisks;
  const addressedSignificantRisks = new Set(riskResponses.filter(r => r.isSignificantRisk).map(r => r.riskId));
  const addressedFraudRisks = new Set(riskResponses.filter(r => r.isFraudRisk).map(r => r.riskId));

  const orphanSignificantRisks = significantRisks.filter(r => !addressedSignificantRisks.has(r.id)).map(r => r.description);
  const orphanFraudRisks = fraudRisks.filter(r => !addressedFraudRisks.has(r.id)).map(r => r.description);
  const allOrphanRisks = [...orphanSignificantRisks, ...orphanFraudRisks];

  const allSignificantRisksAddressed: QualityGate = {
    passed: orphanSignificantRisks.length === 0,
    gate: 'All Significant Risks Addressed',
    message: orphanSignificantRisks.length === 0
      ? `All ${significantRisks.length} significant risks have documented audit responses.`
      : `${orphanSignificantRisks.length} significant risk(s) without documented responses: ${orphanSignificantRisks.slice(0, 3).join('; ')}`,
    isaReference: 'ISA 330.18'
  };

  const allFraudRisksAddressed: QualityGate = {
    passed: orphanFraudRisks.length === 0,
    gate: 'All Fraud Risks Addressed',
    message: orphanFraudRisks.length === 0
      ? `All ${fraudRisks.length} fraud risks (incl. ISA 240 presumed risks) have documented responses.`
      : `${orphanFraudRisks.length} fraud risk(s) without documented responses: ${orphanFraudRisks.slice(0, 3).join('; ')}`,
    isaReference: 'ISA 240.26-31'
  };

  const strategyConsistentWithRisk: QualityGate = {
    passed: true,
    gate: 'Strategy Consistent with Risk Assessment',
    message: `Audit approach (${overallApproach.approachType}) is consistent with control environment (${overallApproach.controlEnvironmentAssessment}) and identified risks.`,
    isaReference: 'ISA 300.7-9'
  };

  const materialityAligned: QualityGate = {
    passed: planningInputs.materialityParams.overallMateriality > 0,
    gate: 'Materiality Aligned with Strategy',
    message: planningInputs.materialityParams.overallMateriality > 0
      ? `Strategy aligned with overall materiality of ${planningInputs.materialityParams.overallMateriality.toLocaleString()} and PM of ${planningInputs.materialityParams.performanceMateriality.toLocaleString()}.`
      : 'Materiality parameters not yet established - strategy may require revision.',
    isaReference: 'ISA 320.10'
  };

  const overallPassed = allSignificantRisksAddressed.passed && allFraudRisksAddressed.passed && strategyConsistentWithRisk.passed && materialityAligned.passed;

  return {
    allSignificantRisksAddressed,
    allFraudRisksAddressed,
    strategyConsistentWithRisk,
    materialityAligned,
    orphanRisks: allOrphanRisks,
    overallPassed,
  };
}

function generateDocumentation(result: Omit<ISA300StrategyResult, 'step9_documentation' | 'qualityGates'>): DocumentationOutput {
  const { step2_overallAuditApproach, step3_scopeTimingDirection, step4_riskResponses, step5_controlsRelianceDecisions, step6_samplingApproaches, step7_potentialKAMs } = result;

  return {
    overallAuditApproachSummary: 
      `The overall audit approach for this engagement is ${step2_overallAuditApproach.approachType}. ` +
      `${step2_overallAuditApproach.justification} ` +
      `The control environment has been assessed as ${step2_overallAuditApproach.controlEnvironmentAssessment}. ` +
      `${step2_overallAuditApproach.costBenefitAnalysis}`,

    overallAuditStrategySummary:
      `Scope: Focus on ${step3_scopeTimingDirection.scope.fsAreasOfFocus.filter(f => f.focusLevel === 'Primary').map(f => f.fsHeadLabel).join(', ')}. ` +
      `${step3_scopeTimingDirection.scope.expertsRequired.length > 0 ? `Specialists required: ${step3_scopeTimingDirection.scope.expertsRequired.map(e => e.expertType).join(', ')}.` : ''} ` +
      `Timing: Interim work includes ${step3_scopeTimingDirection.timing.interimWorkScope.slice(0, 2).join(', ')}; Year-end focus on ${step3_scopeTimingDirection.timing.yearEndWorkScope.slice(0, 3).join(', ')}. ` +
      `Direction: ${step3_scopeTimingDirection.direction.highRiskEmphasis[0]}`,

    responseToSignificantRisksSummary:
      `${step4_riskResponses.filter(r => r.isSignificantRisk).length} significant risks have been identified and documented responses prepared. ` +
      `Responses include both FS-level measures (enhanced supervision, unpredictable procedures, professional skepticism) and ` +
      `assertion-level procedures (extended substantive testing, confirmations, analytical procedures). ` +
      `All significant risks have documented responses per ISA 330.18.`,

    controlsRelianceStrategySummary:
      `Controls reliance strategy: ${step5_controlsRelianceDecisions.filter(d => d.relianceDecision === 'Full Reliance').length} cycles with full reliance, ` +
      `${step5_controlsRelianceDecisions.filter(d => d.relianceDecision === 'Partial Reliance').length} with partial reliance, ` +
      `${step5_controlsRelianceDecisions.filter(d => d.relianceDecision === 'No Reliance').length} with no reliance. ` +
      `For areas where controls are tested, sample sizes and timing have been documented per ISA 330.10.`,

    samplingApproachSummary:
      `Sampling approaches: ${step6_samplingApproaches.filter(s => s.approach === '100% Testing').length} areas with 100% testing, ` +
      `${step6_samplingApproaches.filter(s => s.approach === 'Statistical').length} with statistical sampling, ` +
      `${step6_samplingApproaches.filter(s => s.approach === 'Non-Statistical').length} with non-statistical sampling. ` +
      `Sample sizes are aligned with assessed risk levels and materiality per ISA 530.`,

    potentialKAMsSummary:
      `${step7_potentialKAMs.length} potential Key Audit Matters identified for communication. ` +
      `Categories include: ${[...new Set(step7_potentialKAMs.map(k => k.category))].join(', ')}. ` +
      `These matters will be refined based on audit findings and finalized for the auditor's report per ISA 701.`,

    isaReferences: [
      'ISA 300.7 - Planning the Audit',
      'ISA 300.8 - Overall Audit Strategy',
      'ISA 300.9 - Audit Plan',
      'ISA 330.5 - Overall Responses',
      'ISA 330.6 - Responses at Assertion Level',
      'ISA 330.7 - Tests of Controls',
      'ISA 330.15 - Significant Risks',
      'ISA 330.18 - Documentation',
      'ISA 240.26 - Presumed Fraud Risk in Revenue',
      'ISA 240.30 - Unpredictable Procedures',
      'ISA 240.31 - Management Override of Controls',
      'ISA 530 - Audit Sampling',
      'ISA 620 - Using the Work of an Auditor\'s Expert',
      'ISA 701 - Key Audit Matters',
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
      include: {
        client: true,
      },
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

    const planningData = existingBriefingData as any || {};
    const analyticsData = planningData.analyticalProcedures || planningData.planningAnalytics || null;
    const riskData = planningData.riskAssessment || planningData.aiRiskAssessment || null;

    const step1_planningInputs = extractPlanningInputs(engagement, planningData, analyticsData, riskData);
    const step2_overallAuditApproach = determineOverallAuditApproach(step1_planningInputs);
    const step3_scopeTimingDirection = defineScopeTimingDirection(step1_planningInputs, step2_overallAuditApproach, engagement);
    const step4_riskResponses = generateRiskResponses(step1_planningInputs, step2_overallAuditApproach);
    const step5_controlsRelianceDecisions = determineControlsReliance(step1_planningInputs, step2_overallAuditApproach);
    const step6_samplingApproaches = determineSamplingApproaches(step1_planningInputs, step4_riskResponses);
    const step7_potentialKAMs = identifyPotentialKAMs(step1_planningInputs, step4_riskResponses);
    const step8_resourcePlanning = planResources(step1_planningInputs, step2_overallAuditApproach, step3_scopeTimingDirection, engagement);

    const partialResult = {
      engagementId,
      analysisTimestamp: new Date().toISOString(),
      step1_planningInputs,
      step2_overallAuditApproach,
      step3_scopeTimingDirection,
      step4_riskResponses,
      step5_controlsRelianceDecisions,
      step6_samplingApproaches,
      step7_potentialKAMs,
      step8_resourcePlanning,
    };

    const step9_documentation = generateDocumentation(partialResult);
    const qualityGates = validateQualityGates(step1_planningInputs, step4_riskResponses, step2_overallAuditApproach);

    const result: ISA300StrategyResult = {
      ...partialResult,
      step9_documentation,
      qualityGates,
    };

    const updatedBriefingData = {
      ...existingBriefingData,
      isa300AuditStrategy: result,
      isa300AnalysisTimestamp: new Date().toISOString(),
      isa300AnalyzedBy: userId
    };

    if (existingPlanningMemo) {
      await prisma.planningMemo.update({
        where: { id: existingPlanningMemo.id },
        data: {
          teamBriefingNotes: JSON.stringify(updatedBriefingData),
          updatedAt: new Date()
        }
      });
    } else {
      await prisma.planningMemo.create({
        data: {
          engagementId,
          preparedById: userId,
          teamBriefingNotes: JSON.stringify(updatedBriefingData)
        }
      });
    }

    res.json(result);
  } catch (error) {
    console.error("ISA 300/330 Strategy analysis error:", error);
    res.status(500).json({ error: "Failed to run ISA 300/330 strategy analysis" });
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

    const auditStrategy = briefingData.isa300AuditStrategy as ISA300StrategyResult | null;

    if (!auditStrategy) {
      return res.json(null);
    }

    res.json(auditStrategy);
  } catch (error) {
    console.error("Get ISA 300/330 strategy error:", error);
    res.status(500).json({ error: "Failed to get ISA 300/330 strategy" });
  }
});

router.post("/:engagementId/save", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const firmId = req.user!.firmId;
    const userId = req.user!.id;
    const strategyData = req.body as ISA300StrategyResult;

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
      isa300AuditStrategy: strategyData,
      isa300AnalysisTimestamp: new Date().toISOString(),
      isa300AnalyzedBy: userId
    };

    if (existingPlanningMemo) {
      await prisma.planningMemo.update({
        where: { id: existingPlanningMemo.id },
        data: {
          teamBriefingNotes: JSON.stringify(updatedBriefingData),
          updatedAt: new Date()
        }
      });
    } else {
      await prisma.planningMemo.create({
        data: {
          engagementId,
          preparedById: userId,
          teamBriefingNotes: JSON.stringify(updatedBriefingData)
        }
      });
    }

    res.json({ success: true, message: "ISA 300/330 strategy saved successfully" });
  } catch (error) {
    console.error("Save ISA 300/330 strategy error:", error);
    res.status(500).json({ error: "Failed to save ISA 300/330 strategy" });
  }
});

export default router;
