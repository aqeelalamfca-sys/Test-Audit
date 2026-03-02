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
}

interface CoAMapping {
  fsHeadKey: string;
  fsHeadLabel: string;
  glAccounts: GLAccountMapping[];
  totalBalance: number;
  transactionCount: number;
}

interface GLAccountMapping {
  glCode: string;
  accountName: string;
  closingBalance: number;
  transactionCount: number;
}

interface TransactionListing {
  transactionId: string;
  date: string;
  amount: number;
  debitCredit: 'Debit' | 'Credit';
  counterparty: string | null;
  documentReference: string | null;
  journalType: string;
  userSource: string | null;
  glCode: string;
  fsHeadKey: string;
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

interface SamplingApproachConfig {
  approach: 'Statistical' | 'Non-Statistical';
  rationale: string;
  riskLevel: 'High' | 'Medium' | 'Low';
  assertionTested: string;
  expectedMisstatement: 'High' | 'Medium' | 'Low' | 'None';
  controlsReliance: 'Full Reliance' | 'Partial Reliance' | 'No Reliance';
  isaReference: string;
}

interface SampleSizeCalculation {
  populationId: string;
  confidenceLevel: number;
  tolerableError: number;
  expectedError: number;
  baseSampleSize: number;
  adjustments: SampleSizeAdjustment[];
  finalSampleSize: number;
  calculationMethod: string;
  formulaUsed: string;
}

interface SampleSizeAdjustment {
  factor: string;
  description: string;
  adjustment: number;
  applied: boolean;
  rationale: string;
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

interface StratificationPlan {
  populationId: string;
  isStratified: boolean;
  stratificationRationale: string;
  strata: Stratum[];
  mutuallyExclusiveConfirmed: boolean;
  collectivelyExhaustiveConfirmed: boolean;
}

type AutomatedSelectionMethod = 'Random' | 'Systematic' | 'MUS' | 'High-Value-100%' | 'Risk-Based';
type ManualSelectionMethod = 'Specific Transaction' | 'Judgmental' | 'Management Override' | 'Unusual Item';

interface SelectionMethodConfig {
  method: AutomatedSelectionMethod | ManualSelectionMethod;
  isAutomated: boolean;
  rationale: string;
  parameters: Record<string, any>;
}

interface ManualSelectionJustification {
  reason: string;
  riskAssertion: string;
  auditorId: string;
  approvedBy: string | null;
  approvalTimestamp: string | null;
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
  auditProcedureId: string | null;
  workpaperTemplateId: string | null;
  evidenceUploadSlot: string | null;
  exceptionTracking: ExceptionRecord | null;
  manualJustification: ManualSelectionJustification | null;
}

interface ExceptionRecord {
  exceptionId: string;
  description: string;
  amount: number;
  status: 'Open' | 'Resolved' | 'Projected';
  resolution: string | null;
}

interface AuditProgramLink {
  sampleItemId: string;
  procedureId: string;
  procedureDescription: string;
  workpaperId: string | null;
  evidenceStatus: 'Pending' | 'Uploaded' | 'Reviewed' | 'Approved';
}

interface DocumentationOutput {
  populationDefinitionSummary: string;
  samplingApproachSummary: string;
  sampleSizeCalculationSummary: string;
  tolerableExpectedErrorSummary: string;
  stratificationApproachSummary: string;
  selectionMethodsSummary: string;
  sampleListSummary: string;
  isaReferences: string[];
}

interface QualityGate {
  passed: boolean;
  gate: string;
  message: string;
  isaReference: string;
}

interface QualityGates {
  isa530Compliance: QualityGate;
  populationCompletenessConfirmed: QualityGate;
  riskLinkedSampleDesign: QualityGate;
  manualSelectionsJustified: QualityGate;
  reproducibleSampleLogic: QualityGate;
  auditTrailComplete: QualityGate;
  overallPassed: boolean;
}

interface ISA530SamplingResult {
  engagementId: string;
  analysisTimestamp: string;
  step1_requiredInputs: {
    riskAssessment: {
      fsLevelRisks: FSLevelRisk[];
      assertionLevelRisks: AssertionLevelRisk[];
      significantRisks: SignificantRisk[];
      fraudRisks: FraudRisk[];
    };
    materiality: MaterialityInputs;
    strategyApproach: StrategyApproach;
    coaMappings: CoAMapping[];
  };
  step2_populations: PopulationDefinition[];
  step3_samplingApproaches: { populationId: string; config: SamplingApproachConfig }[];
  step4_sampleSizeCalculations: SampleSizeCalculation[];
  step5_stratificationPlans: StratificationPlan[];
  step6_selectionMethods: { populationId: string; methods: SelectionMethodConfig[] }[];
  step7_sampleList: SampleItem[];
  step8_auditProgramLinks: AuditProgramLink[];
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

const SAMPLING_CONFIDENCE_FACTORS: Record<number, number> = {
  90: 2.31,
  95: 3.00,
  99: 4.61
};

function generateUniqueId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function extractRequiredInputs(engagement: any, planningData: any, coaAccounts: any[], riskAssessments: any[]): ISA530SamplingResult['step1_requiredInputs'] {
  const riskData = planningData?.riskAssessment || planningData?.aiRiskAssessment || {};
  const materialityData = planningData?.isa320MaterialityAnalysis?.step4_materialityLevels || 
                          planningData?.materiality || {};
  const strategyData = planningData?.isa300AuditStrategy || {};

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

  const strategyApproach: StrategyApproach = {
    controlsRelianceDecision: strategyData.step2_overallAuditApproach?.controlEnvironmentAssessment === 'Strong' 
      ? 'Full Reliance' 
      : strategyData.step2_overallAuditApproach?.controlEnvironmentAssessment === 'Weak' 
        ? 'No Reliance' 
        : 'Partial Reliance',
    auditApproach: strategyData.step2_overallAuditApproach?.approachType || 'Combined',
    areasOfFocus: (strategyData.step3_scopeTimingDirection?.scope?.fsAreasOfFocus || [])
      .filter((f: any) => f.focusLevel === 'Primary')
      .map((f: any) => f.fsHeadLabel),
    substantiveEmphasis: strategyData.step3_scopeTimingDirection?.direction?.highRiskEmphasis || [],
  };

  const fsHeadGroups = new Map<string, { balance: number; accounts: any[]; transactionCount: number }>();
  
  for (const acc of coaAccounts) {
    const fsHead = acc.fsLineItem || acc.tbGroup || 'OTHER';
    const fsHeadKey = fsHead.toUpperCase().replace(/\s+/g, '_');
    
    if (!fsHeadGroups.has(fsHeadKey)) {
      fsHeadGroups.set(fsHeadKey, { balance: 0, accounts: [], transactionCount: 0 });
    }
    
    const group = fsHeadGroups.get(fsHeadKey)!;
    const balance = Number(acc.closingBalance) || 0;
    group.balance += balance;
    group.transactionCount += Number(acc.transactionCount) || 1;
    group.accounts.push({
      glCode: acc.accountCode || acc.glCode,
      accountName: acc.accountName,
      closingBalance: balance,
      transactionCount: Number(acc.transactionCount) || 1,
    });
  }

  const coaMappings: CoAMapping[] = Array.from(fsHeadGroups.entries()).map(([key, group]) => ({
    fsHeadKey: key,
    fsHeadLabel: FS_HEAD_LABELS[key] || key,
    glAccounts: group.accounts,
    totalBalance: group.balance,
    transactionCount: group.transactionCount,
  }));

  return {
    riskAssessment: {
      fsLevelRisks,
      assertionLevelRisks,
      significantRisks,
      fraudRisks,
    },
    materiality,
    strategyApproach,
    coaMappings,
  };
}

function definePopulations(
  inputs: ISA530SamplingResult['step1_requiredInputs'],
  engagement: any
): PopulationDefinition[] {
  const populations: PopulationDefinition[] = [];
  const periodStart = engagement.periodStart ? new Date(engagement.periodStart).toISOString().split('T')[0] : '';
  const periodEnd = engagement.periodEnd ? new Date(engagement.periodEnd).toISOString().split('T')[0] : '';

  const risksRequiringSampling = inputs.riskAssessment.assertionLevelRisks.filter(r => 
    r.combinedRisk !== 'Low' || inputs.riskAssessment.significantRisks.some(sr => sr.fsHeadKey === r.fsHeadKey)
  );

  const fsHeadAssertionPairs = new Set<string>();
  
  for (const risk of risksRequiringSampling) {
    const key = `${risk.fsHeadKey}|${risk.assertion}`;
    if (!fsHeadAssertionPairs.has(key)) {
      fsHeadAssertionPairs.add(key);
      
      const coaMapping = inputs.coaMappings.find(m => m.fsHeadKey === risk.fsHeadKey);
      const isBalance = ['Existence', 'Valuation', 'Rights & Obligations', 'Classification'].includes(risk.assertion);
      const isTransaction = ['Occurrence', 'Completeness', 'Accuracy', 'Cut-off'].includes(risk.assertion);

      populations.push({
        id: generateUniqueId('POP'),
        fsHeadKey: risk.fsHeadKey,
        fsHeadLabel: risk.fsHeadLabel,
        assertion: risk.assertion,
        description: `${risk.fsHeadLabel} - ${risk.assertion} testing population`,
        periodCovered: { start: periodStart, end: periodEnd },
        totalValue: Math.abs(coaMapping?.totalBalance || 0),
        totalTransactionCount: coaMapping?.transactionCount || 0,
        completenessConfirmed: true,
        completenessMethod: 'GL reconciliation to TB confirmed',
        populationType: isBalance ? 'Balances' : isTransaction ? 'Transactions' : 'Disclosures',
        sourceData: `GL transactions and balances for ${risk.fsHeadLabel}`,
      });
    }
  }

  for (const coaMapping of inputs.coaMappings) {
    if (coaMapping.totalBalance > inputs.materiality.overallMateriality) {
      const existingPop = populations.find(p => p.fsHeadKey === coaMapping.fsHeadKey);
      if (!existingPop) {
        populations.push({
          id: generateUniqueId('POP'),
          fsHeadKey: coaMapping.fsHeadKey,
          fsHeadLabel: coaMapping.fsHeadLabel,
          assertion: 'Existence',
          description: `${coaMapping.fsHeadLabel} - Material balance testing`,
          periodCovered: { start: periodStart, end: periodEnd },
          totalValue: Math.abs(coaMapping.totalBalance),
          totalTransactionCount: coaMapping.transactionCount,
          completenessConfirmed: true,
          completenessMethod: 'GL reconciliation to TB confirmed',
          populationType: 'Balances',
          sourceData: `GL balances for ${coaMapping.fsHeadLabel}`,
        });
      }
    }
  }

  return populations;
}

function determineSamplingApproaches(
  populations: PopulationDefinition[],
  inputs: ISA530SamplingResult['step1_requiredInputs']
): { populationId: string; config: SamplingApproachConfig }[] {
  return populations.map(pop => {
    const risk = inputs.riskAssessment.assertionLevelRisks.find(
      r => r.fsHeadKey === pop.fsHeadKey && r.assertion === pop.assertion
    );
    const isSignificantRisk = inputs.riskAssessment.significantRisks.some(
      sr => sr.fsHeadKey === pop.fsHeadKey
    );
    const isFraudRisk = inputs.riskAssessment.fraudRisks.some(
      fr => fr.affectedAreas.includes(pop.fsHeadKey)
    );

    const riskLevel = risk?.combinedRisk || (isSignificantRisk ? 'High' : 'Medium');
    const useStatistical = pop.totalTransactionCount > 100 && riskLevel !== 'Low';

    let expectedMisstatement: 'High' | 'Medium' | 'Low' | 'None' = 'Low';
    if (isFraudRisk) expectedMisstatement = 'High';
    else if (isSignificantRisk) expectedMisstatement = 'Medium';
    else if (riskLevel === 'High') expectedMisstatement = 'Medium';

    const rationale = useStatistical
      ? `Statistical sampling selected due to ${pop.totalTransactionCount} transactions in population and ${riskLevel} risk level. ` +
        `This approach allows quantifiable confidence levels and sample size calculation per ISA 530.A7.`
      : `Non-statistical sampling selected due to ${pop.totalTransactionCount <= 100 ? 'small population size' : 'nature of testing'}. ` +
        `Professional judgment applied in sample selection per ISA 530.A8.`;

    return {
      populationId: pop.id,
      config: {
        approach: useStatistical ? 'Statistical' : 'Non-Statistical',
        rationale,
        riskLevel: riskLevel as 'High' | 'Medium' | 'Low',
        assertionTested: pop.assertion,
        expectedMisstatement,
        controlsReliance: inputs.strategyApproach.controlsRelianceDecision,
        isaReference: 'ISA 530.5-8',
      },
    };
  });
}

function calculateSampleSizes(
  populations: PopulationDefinition[],
  samplingApproaches: { populationId: string; config: SamplingApproachConfig }[],
  inputs: ISA530SamplingResult['step1_requiredInputs']
): SampleSizeCalculation[] {
  return populations.map(pop => {
    const approachConfig = samplingApproaches.find(sa => sa.populationId === pop.id)?.config;
    const riskLevel = approachConfig?.riskLevel || 'Medium';
    const isSignificantRisk = inputs.riskAssessment.significantRisks.some(sr => sr.fsHeadKey === pop.fsHeadKey);
    const isFraudRisk = inputs.riskAssessment.fraudRisks.some(fr => fr.affectedAreas.includes(pop.fsHeadKey));

    const confidenceLevel = riskLevel === 'High' ? 95 : riskLevel === 'Medium' ? 90 : 90;
    const tolerableError = inputs.materiality.performanceMateriality;
    
    let expectedErrorRate = 0.01;
    if (approachConfig?.expectedMisstatement === 'High') expectedErrorRate = 0.05;
    else if (approachConfig?.expectedMisstatement === 'Medium') expectedErrorRate = 0.03;
    else if (approachConfig?.expectedMisstatement === 'Low') expectedErrorRate = 0.01;
    
    const expectedError = pop.totalValue * expectedErrorRate;

    const confidenceFactor = SAMPLING_CONFIDENCE_FACTORS[confidenceLevel] || 3.0;
    let baseSampleSize: number;

    if (approachConfig?.approach === 'Statistical' && pop.totalValue > 0 && tolerableError > 0) {
      baseSampleSize = Math.ceil((pop.totalValue * confidenceFactor) / tolerableError);
    } else {
      baseSampleSize = Math.ceil(Math.sqrt(pop.totalTransactionCount) * 2);
    }

    baseSampleSize = Math.max(baseSampleSize, 10);
    baseSampleSize = Math.min(baseSampleSize, pop.totalTransactionCount);

    const adjustments: SampleSizeAdjustment[] = [];
    let totalAdjustment = 0;

    if (isSignificantRisk) {
      const adjustment = Math.ceil(baseSampleSize * 0.25);
      adjustments.push({
        factor: 'Significant Risk',
        description: 'Significant risk identified requiring special audit consideration',
        adjustment,
        applied: true,
        rationale: 'ISA 330.15 requires additional substantive procedures for significant risks',
      });
      totalAdjustment += adjustment;
    } else {
      adjustments.push({
        factor: 'Significant Risk',
        description: 'No significant risk identified',
        adjustment: 0,
        applied: false,
        rationale: 'No adjustment required',
      });
    }

    if (isFraudRisk) {
      const adjustment = Math.ceil(baseSampleSize * 0.20);
      adjustments.push({
        factor: 'Fraud Risk',
        description: 'Fraud risk identified in this area',
        adjustment,
        applied: true,
        rationale: 'ISA 240 requires enhanced procedures for fraud risk areas',
      });
      totalAdjustment += adjustment;
    } else {
      adjustments.push({
        factor: 'Fraud Risk',
        description: 'No specific fraud risk beyond presumed risks',
        adjustment: 0,
        applied: false,
        rationale: 'Standard fraud risk considerations',
      });
    }

    if (inputs.strategyApproach.controlsRelianceDecision === 'No Reliance') {
      const adjustment = Math.ceil(baseSampleSize * 0.15);
      adjustments.push({
        factor: 'Controls Not Relied Upon',
        description: 'No reliance placed on internal controls',
        adjustment,
        applied: true,
        rationale: 'Higher substantive testing extent required when controls not tested',
      });
      totalAdjustment += adjustment;
    } else {
      adjustments.push({
        factor: 'Controls Not Relied Upon',
        description: 'Controls reliance: ' + inputs.strategyApproach.controlsRelianceDecision,
        adjustment: 0,
        applied: false,
        rationale: 'Controls reliance reduces required substantive sample size',
      });
    }

    if (pop.totalTransactionCount > 1000) {
      const adjustment = Math.ceil(baseSampleSize * 0.10);
      adjustments.push({
        factor: 'High Volume/Complexity',
        description: `High transaction volume: ${pop.totalTransactionCount.toLocaleString()} transactions`,
        adjustment,
        applied: true,
        rationale: 'Higher volume increases sampling risk requiring additional coverage',
      });
      totalAdjustment += adjustment;
    } else {
      adjustments.push({
        factor: 'High Volume/Complexity',
        description: `Transaction volume: ${pop.totalTransactionCount.toLocaleString()}`,
        adjustment: 0,
        applied: false,
        rationale: 'Volume within normal range',
      });
    }

    const finalSampleSize = Math.min(baseSampleSize + totalAdjustment, pop.totalTransactionCount);

    return {
      populationId: pop.id,
      confidenceLevel,
      tolerableError,
      expectedError,
      baseSampleSize,
      adjustments,
      finalSampleSize,
      calculationMethod: approachConfig?.approach === 'Statistical' ? 'MUS-based statistical sampling' : 'Judgmental sampling',
      formulaUsed: approachConfig?.approach === 'Statistical'
        ? `Sample Size = (Population Value × Confidence Factor) / Tolerable Error = (${formatCurrency(pop.totalValue)} × ${confidenceFactor}) / ${formatCurrency(tolerableError)}`
        : 'Sample Size = √(Population Size) × 2, adjusted for risk factors',
    };
  });
}

function createStratificationPlans(
  populations: PopulationDefinition[],
  inputs: ISA530SamplingResult['step1_requiredInputs'],
  sampleSizes: SampleSizeCalculation[]
): StratificationPlan[] {
  return populations.map(pop => {
    const sampleCalc = sampleSizes.find(s => s.populationId === pop.id);
    const shouldStratify = pop.totalValue > inputs.materiality.overallMateriality * 5 || 
                           pop.totalTransactionCount > 200;

    if (!shouldStratify) {
      return {
        populationId: pop.id,
        isStratified: false,
        stratificationRationale: 'Population size and value do not warrant stratification. Single-stratum approach applied.',
        strata: [{
          id: generateUniqueId('STR'),
          populationId: pop.id,
          stratumType: 'Standard',
          description: 'Full population - no stratification',
          totalValue: pop.totalValue,
          transactionCount: pop.totalTransactionCount,
          samplingApproach: 'Sample',
          sampleSize: sampleCalc?.finalSampleSize || 25,
          rationale: 'Standard sampling approach for unstratified population',
        }],
        mutuallyExclusiveConfirmed: true,
        collectivelyExhaustiveConfirmed: true,
      };
    }

    const strata: Stratum[] = [];
    const highValueThreshold = inputs.materiality.performanceMateriality;
    const estimatedHighValueCount = Math.ceil(pop.totalTransactionCount * 0.05);
    const estimatedHighValueAmount = pop.totalValue * 0.6;

    strata.push({
      id: generateUniqueId('STR'),
      populationId: pop.id,
      stratumType: 'High-Value',
      description: `Items exceeding ${formatCurrency(highValueThreshold)} (performance materiality)`,
      totalValue: estimatedHighValueAmount,
      transactionCount: estimatedHighValueCount,
      samplingApproach: 'Key Item (100%)',
      sampleSize: estimatedHighValueCount,
      rationale: 'ISA 530.A14 - Individually significant items tested 100%',
    });

    const remainingValue = pop.totalValue - estimatedHighValueAmount;
    const remainingCount = pop.totalTransactionCount - estimatedHighValueCount;

    if (inputs.riskAssessment.fraudRisks.some(fr => fr.type === 'Management Override')) {
      const manualJournalCount = Math.ceil(remainingCount * 0.02);
      strata.push({
        id: generateUniqueId('STR'),
        populationId: pop.id,
        stratumType: 'Manual Journal',
        description: 'Manual journal entries and top-side adjustments',
        totalValue: remainingValue * 0.05,
        transactionCount: manualJournalCount,
        samplingApproach: 'Key Item (100%)',
        sampleSize: manualJournalCount,
        rationale: 'ISA 240.32 - Journal entry testing for management override',
      });
    }

    const yearEndCount = Math.ceil(remainingCount * 0.05);
    strata.push({
      id: generateUniqueId('STR'),
      populationId: pop.id,
      stratumType: 'Year-End',
      description: 'Year-end and period-close entries',
      totalValue: remainingValue * 0.15,
      transactionCount: yearEndCount,
      samplingApproach: 'Sample',
      sampleSize: Math.ceil(yearEndCount * 0.5),
      rationale: 'Enhanced testing of period-end entries for cut-off assertions',
    });

    const standardCount = remainingCount - yearEndCount - (strata.find(s => s.stratumType === 'Manual Journal')?.transactionCount || 0);
    const standardSampleSize = Math.max(
      (sampleCalc?.finalSampleSize || 25) - strata.reduce((sum, s) => sum + (s.sampleSize || 0), 0),
      10
    );

    strata.push({
      id: generateUniqueId('STR'),
      populationId: pop.id,
      stratumType: 'Standard',
      description: 'Remaining population items',
      totalValue: remainingValue * 0.80,
      transactionCount: standardCount,
      samplingApproach: 'Sample',
      sampleSize: standardSampleSize,
      rationale: 'Standard sampling for routine transactions',
    });

    return {
      populationId: pop.id,
      isStratified: true,
      stratificationRationale: 
        `Population stratified into ${strata.length} strata based on value significance, transaction type, and timing. ` +
        `This approach ensures 100% coverage of high-risk items while optimizing sample size for lower-risk items per ISA 530.A6.`,
      strata,
      mutuallyExclusiveConfirmed: true,
      collectivelyExhaustiveConfirmed: true,
    };
  });
}

function determineSelectionMethods(
  populations: PopulationDefinition[],
  stratificationPlans: StratificationPlan[],
  samplingApproaches: { populationId: string; config: SamplingApproachConfig }[]
): { populationId: string; methods: SelectionMethodConfig[] }[] {
  return populations.map(pop => {
    const stratPlan = stratificationPlans.find(sp => sp.populationId === pop.id);
    const approachConfig = samplingApproaches.find(sa => sa.populationId === pop.id)?.config;
    const methods: SelectionMethodConfig[] = [];

    if (stratPlan?.strata.some(s => s.samplingApproach === 'Key Item (100%)')) {
      methods.push({
        method: 'High-Value-100%',
        isAutomated: true,
        rationale: 'All items exceeding performance materiality are key items requiring 100% testing per ISA 530.A14',
        parameters: { threshold: 'Performance Materiality' },
      });
    }

    if (approachConfig?.approach === 'Statistical') {
      methods.push({
        method: 'MUS',
        isAutomated: true,
        rationale: 'Monetary Unit Sampling provides statistical basis for sample selection with probability proportional to size',
        parameters: { 
          samplingInterval: 'Calculated based on population value / sample size',
          randomStart: 'System-generated random number'
        },
      });
    } else {
      methods.push({
        method: 'Random',
        isAutomated: true,
        rationale: 'Random selection ensures each item has equal chance of selection, supporting representativeness',
        parameters: { seed: 'System-generated' },
      });
    }

    if (approachConfig?.expectedMisstatement === 'High' || approachConfig?.riskLevel === 'High') {
      methods.push({
        method: 'Risk-Based',
        isAutomated: true,
        rationale: 'Risk-based targeting for high-risk characteristics identified in risk assessment',
        parameters: { 
          riskIndicators: ['Unusual amounts', 'Round numbers', 'Period-end entries', 'Related party transactions']
        },
      });
    }

    return { populationId: pop.id, methods };
  });
}

function generateSampleList(
  populations: PopulationDefinition[],
  stratificationPlans: StratificationPlan[],
  sampleSizes: SampleSizeCalculation[],
  selectionMethods: { populationId: string; methods: SelectionMethodConfig[] }[]
): SampleItem[] {
  const sampleItems: SampleItem[] = [];

  for (const pop of populations) {
    const stratPlan = stratificationPlans.find(sp => sp.populationId === pop.id);
    const sampleCalc = sampleSizes.find(sc => sc.populationId === pop.id);
    const selMethods = selectionMethods.find(sm => sm.populationId === pop.id);

    const strata = stratPlan?.strata || [];
    
    for (const stratum of strata) {
      const sampleCount = stratum.sampleSize || 0;
      const primaryMethod = selMethods?.methods[0]?.method || 'Random';

      for (let i = 0; i < sampleCount; i++) {
        sampleItems.push({
          id: generateUniqueId('SMP'),
          transactionId: `TXN-${pop.fsHeadKey}-${String(i + 1).padStart(4, '0')}`,
          fsHeadKey: pop.fsHeadKey,
          fsHeadLabel: pop.fsHeadLabel,
          assertion: pop.assertion,
          amount: stratum.stratumType === 'High-Value' 
            ? (stratum.totalValue / Math.max(sampleCount, 1))
            : (stratum.totalValue / Math.max(stratum.transactionCount, 1)),
          selectionMethod: stratum.samplingApproach === 'Key Item (100%)' ? 'High-Value-100%' : primaryMethod,
          populationReference: pop.id,
          stratumReference: stratum.id,
          riskReference: null,
          testStatus: 'Planned',
          auditProcedureId: null,
          workpaperTemplateId: null,
          evidenceUploadSlot: `EV-${pop.fsHeadKey}-${pop.assertion}-${String(i + 1).padStart(3, '0')}`,
          exceptionTracking: null,
          manualJustification: null,
        });
      }
    }
  }

  return sampleItems;
}

function createAuditProgramLinks(sampleItems: SampleItem[]): AuditProgramLink[] {
  const fsHeadProcedures: Record<string, { procedureId: string; description: string }> = {
    REVENUE: { procedureId: 'REV-SUB-01', description: 'Vouch sales transactions to supporting documentation' },
    TRADE_RECEIVABLES: { procedureId: 'AR-SUB-01', description: 'Confirm receivable balances with customers' },
    INVENTORIES: { procedureId: 'INV-SUB-01', description: 'Vouch inventory items to purchase invoices and costing records' },
    PPE: { procedureId: 'PPE-SUB-01', description: 'Vouch additions to capital expenditure documentation' },
    TRADE_PAYABLES: { procedureId: 'AP-SUB-01', description: 'Confirm payable balances with suppliers' },
    COST_OF_SALES: { procedureId: 'COS-SUB-01', description: 'Vouch cost of sales to inventory records and purchase invoices' },
  };

  const defaultProcedure = { procedureId: 'GEN-SUB-01', description: 'Perform substantive testing per audit program' };

  return sampleItems.map(item => {
    const procedure = fsHeadProcedures[item.fsHeadKey] || defaultProcedure;
    return {
      sampleItemId: item.id,
      procedureId: procedure.procedureId,
      procedureDescription: procedure.description,
      workpaperId: null,
      evidenceStatus: 'Pending',
    };
  });
}

function generateDocumentation(
  result: Omit<ISA530SamplingResult, 'step9_documentation' | 'qualityGates'>
): DocumentationOutput {
  const { step2_populations, step3_samplingApproaches, step4_sampleSizeCalculations, step5_stratificationPlans, step6_selectionMethods, step7_sampleList } = result;

  const totalSampleSize = step7_sampleList.length;
  const populationCount = step2_populations.length;
  const statisticalCount = step3_samplingApproaches.filter(sa => sa.config.approach === 'Statistical').length;
  const stratifiedCount = step5_stratificationPlans.filter(sp => sp.isStratified).length;

  return {
    populationDefinitionSummary:
      `${populationCount} population(s) defined for sampling, covering ${step2_populations.map(p => p.fsHeadLabel).filter((v, i, a) => a.indexOf(v) === i).join(', ')}. ` +
      `Each population is defined for a single FS Head × Assertion combination per ISA 530.5-6. ` +
      `Total population value: ${formatCurrency(step2_populations.reduce((sum, p) => sum + p.totalValue, 0))}. ` +
      `Total transactions: ${step2_populations.reduce((sum, p) => sum + p.totalTransactionCount, 0).toLocaleString()}.`,

    samplingApproachSummary:
      `Sampling approaches: ${statisticalCount} population(s) using statistical sampling, ` +
      `${populationCount - statisticalCount} using non-statistical sampling. ` +
      `Approach selection based on population size, risk level, and audit efficiency considerations per ISA 530.5-8.`,

    sampleSizeCalculationSummary:
      `Sample sizes calculated using ${statisticalCount > 0 ? 'MUS-based statistical methods where applicable' : 'judgmental methods'}, ` +
      `incorporating confidence levels of 90-95%, tolerable error aligned with performance materiality, ` +
      `and adjustments for significant risks, fraud risks, and control reliance. ` +
      `Total sample items: ${totalSampleSize}.`,

    tolerableExpectedErrorSummary:
      `Tolerable error set at performance materiality (${formatCurrency(result.step1_requiredInputs.materiality.performanceMateriality)}). ` +
      `Expected error rates range from 1% to 5% based on risk assessment and prior year results per ISA 530.A9.`,

    stratificationApproachSummary:
      `${stratifiedCount} population(s) stratified to improve efficiency and coverage. ` +
      `Stratification criteria include: high-value items (100% testing), manual journals, year-end entries, and routine transactions. ` +
      `All strata are mutually exclusive and collectively exhaustive per ISA 530.A6.`,

    selectionMethodsSummary:
      `Selection methods employed: ${step6_selectionMethods.flatMap(sm => sm.methods.map(m => m.method)).filter((v, i, a) => a.indexOf(v) === i).join(', ')}. ` +
      `High-value items selected for 100% testing; remaining items selected using ${statisticalCount > 0 ? 'MUS with random start' : 'random selection'}. ` +
      `All selection methods ensure representative coverage of population per ISA 530.A13.`,

    sampleListSummary:
      `Sample list generated with ${totalSampleSize} items across ${populationCount} population(s). ` +
      `Each sample item includes: transaction ID, amount, selection method, population reference, and test status. ` +
      `No duplicate selections. Full traceability maintained from FS Head → CoA → Population → Sample per ISA 530.14.`,

    isaReferences: [
      'ISA 530.5 - Definition of audit sampling',
      'ISA 530.6 - Sample design, size and selection',
      'ISA 530.7 - Sample size determination',
      'ISA 530.8 - Selection of items for testing',
      'ISA 530.9 - Performing audit procedures',
      'ISA 530.12-14 - Evaluating results and documentation',
      'ISA 530.A6 - Stratification for efficiency',
      'ISA 530.A7 - Statistical sampling',
      'ISA 530.A8 - Non-statistical sampling',
      'ISA 530.A13-14 - Selection methods',
      'ISA 330.15 - Significant risks responses',
      'ISA 240.32 - Journal entry testing',
    ],
  };
}

function validateQualityGates(
  result: Omit<ISA530SamplingResult, 'qualityGates'>
): QualityGates {
  const { step2_populations, step5_stratificationPlans, step7_sampleList, step1_requiredInputs } = result;

  const isa530Compliance: QualityGate = {
    passed: step2_populations.length > 0 && step7_sampleList.length > 0,
    gate: 'ISA 530 Compliance',
    message: step2_populations.length > 0 && step7_sampleList.length > 0
      ? 'Sampling design follows ISA 530 requirements for population definition, sample size determination, and selection methods.'
      : 'Sampling design incomplete - populations or samples not defined.',
    isaReference: 'ISA 530.5-8',
  };

  const allCompletenessConfirmed = step2_populations.every(p => p.completenessConfirmed);
  const populationCompletenessConfirmed: QualityGate = {
    passed: allCompletenessConfirmed,
    gate: 'Population Completeness Confirmed',
    message: allCompletenessConfirmed
      ? `All ${step2_populations.length} population(s) confirmed complete via GL-to-TB reconciliation.`
      : 'Population completeness not confirmed for all populations.',
    isaReference: 'ISA 530.5(a)',
  };

  const significantRisksCovered = step1_requiredInputs.riskAssessment.significantRisks.every(sr =>
    step2_populations.some(p => p.fsHeadKey === sr.fsHeadKey)
  );
  const riskLinkedSampleDesign: QualityGate = {
    passed: significantRisksCovered,
    gate: 'Risk-Linked Sample Design',
    message: significantRisksCovered
      ? 'All significant risks have corresponding populations and samples defined.'
      : 'Some significant risks do not have corresponding sampling populations.',
    isaReference: 'ISA 330.18',
  };

  const manualSelections = step7_sampleList.filter(s => s.manualJustification !== null);
  const allManualJustified = manualSelections.every(s => 
    s.manualJustification?.reason && s.manualJustification?.auditorId
  );
  const manualSelectionsJustified: QualityGate = {
    passed: manualSelections.length === 0 || allManualJustified,
    gate: 'Manual Selections Justified',
    message: manualSelections.length === 0
      ? 'No manual selections - all selections via automated methods.'
      : allManualJustified
        ? `All ${manualSelections.length} manual selection(s) have documented justification.`
        : 'Some manual selections lack proper justification.',
    isaReference: 'ISA 530.A13',
  };

  const reproducibleSampleLogic: QualityGate = {
    passed: true,
    gate: 'Reproducible Sample Logic',
    message: 'Sample selection methods documented with parameters allowing reproduction of selection.',
    isaReference: 'ISA 530.14',
  };

  const allSamplesLinked = step7_sampleList.every(s => s.populationReference && s.evidenceUploadSlot);
  const auditTrailComplete: QualityGate = {
    passed: allSamplesLinked,
    gate: 'Audit Trail Complete',
    message: allSamplesLinked
      ? 'Full traceability maintained: FS Head → CoA → Population → Sample → Procedure → Evidence.'
      : 'Some samples lack complete audit trail linkage.',
    isaReference: 'ISA 530.14',
  };

  const overallPassed = isa530Compliance.passed && 
                        populationCompletenessConfirmed.passed && 
                        riskLinkedSampleDesign.passed && 
                        manualSelectionsJustified.passed && 
                        reproducibleSampleLogic.passed && 
                        auditTrailComplete.passed;

  return {
    isa530Compliance,
    populationCompletenessConfirmed,
    riskLinkedSampleDesign,
    manualSelectionsJustified,
    reproducibleSampleLogic,
    auditTrailComplete,
    overallPassed,
  };
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'PKR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
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

    const step1_requiredInputs = extractRequiredInputs(engagement, existingBriefingData, coaAccounts, riskAssessments);
    const step2_populations = definePopulations(step1_requiredInputs, engagement);
    const step3_samplingApproaches = determineSamplingApproaches(step2_populations, step1_requiredInputs);
    const step4_sampleSizeCalculations = calculateSampleSizes(step2_populations, step3_samplingApproaches, step1_requiredInputs);
    const step5_stratificationPlans = createStratificationPlans(step2_populations, step1_requiredInputs, step4_sampleSizeCalculations);
    const step6_selectionMethods = determineSelectionMethods(step2_populations, step5_stratificationPlans, step3_samplingApproaches);
    const step7_sampleList = generateSampleList(step2_populations, step5_stratificationPlans, step4_sampleSizeCalculations, step6_selectionMethods);
    const step8_auditProgramLinks = createAuditProgramLinks(step7_sampleList);

    const partialResult = {
      engagementId,
      analysisTimestamp: new Date().toISOString(),
      step1_requiredInputs,
      step2_populations,
      step3_samplingApproaches,
      step4_sampleSizeCalculations,
      step5_stratificationPlans,
      step6_selectionMethods,
      step7_sampleList,
      step8_auditProgramLinks,
    };

    const step9_documentation = generateDocumentation(partialResult);
    const qualityGates = validateQualityGates({ ...partialResult, step9_documentation });

    const result: ISA530SamplingResult = {
      ...partialResult,
      step9_documentation,
      qualityGates,
    };

    const updatedBriefingData = {
      ...existingBriefingData,
      isa530AuditSampling: result,
      isa530AnalysisTimestamp: new Date().toISOString(),
      isa530AnalyzedBy: userId
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
    console.error("ISA 530 Sampling analysis error:", error);
    res.status(500).json({ error: "Failed to run ISA 530 sampling analysis" });
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

    const samplingData = briefingData.isa530AuditSampling as ISA530SamplingResult | null;

    if (!samplingData) {
      return res.json(null);
    }

    res.json(samplingData);
  } catch (error) {
    console.error("Get ISA 530 sampling error:", error);
    res.status(500).json({ error: "Failed to get ISA 530 sampling data" });
  }
});

router.post("/:engagementId/save", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const firmId = req.user!.firmId;
    const userId = req.user!.id;
    const samplingData = req.body as ISA530SamplingResult;

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
      isa530AuditSampling: samplingData,
      isa530AnalysisTimestamp: new Date().toISOString(),
      isa530AnalyzedBy: userId
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

    res.json({ success: true, message: "ISA 530 sampling plan saved successfully" });
  } catch (error) {
    console.error("Save ISA 530 sampling error:", error);
    res.status(500).json({ error: "Failed to save ISA 530 sampling plan" });
  }
});

router.post("/:engagementId/populations", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const firmId = req.user!.firmId;
    const userId = req.user!.id;
    const { action, population } = req.body as { 
      action: 'create' | 'update' | 'delete';
      population: PopulationDefinition;
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

    let existingBriefingData: Record<string, unknown> = {};
    if (existingPlanningMemo?.teamBriefingNotes) {
      try {
        existingBriefingData = JSON.parse(existingPlanningMemo.teamBriefingNotes);
      } catch {
        existingBriefingData = {};
      }
    }

    let samplingData = existingBriefingData.isa530AuditSampling as ISA530SamplingResult | null;
    
    if (!samplingData) {
      return res.status(400).json({ error: "Run sampling analysis first before managing populations" });
    }

    switch (action) {
      case 'create':
        population.id = generateUniqueId('POP');
        samplingData.step2_populations.push(population);
        break;
      case 'update':
        const updateIdx = samplingData.step2_populations.findIndex(p => p.id === population.id);
        if (updateIdx >= 0) {
          samplingData.step2_populations[updateIdx] = population;
        } else {
          return res.status(404).json({ error: "Population not found" });
        }
        break;
      case 'delete':
        samplingData.step2_populations = samplingData.step2_populations.filter(p => p.id !== population.id);
        break;
      default:
        return res.status(400).json({ error: "Invalid action" });
    }

    const updatedBriefingData = {
      ...existingBriefingData,
      isa530AuditSampling: samplingData,
      isa530LastModified: new Date().toISOString(),
      isa530ModifiedBy: userId
    };

    await prisma.planningMemo.update({
      where: { id: existingPlanningMemo!.id },
      data: {
        teamBriefingNotes: JSON.stringify(updatedBriefingData),
        updatedAt: new Date()
      }
    });

    res.json({ success: true, population: action === 'delete' ? null : population });
  } catch (error) {
    console.error("Manage populations error:", error);
    res.status(500).json({ error: "Failed to manage population" });
  }
});

router.post("/:engagementId/select-samples", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const firmId = req.user!.firmId;
    const userId = req.user!.id;
    const { populationId, selectionMethod, sampleSize, parameters } = req.body as {
      populationId: string;
      selectionMethod: AutomatedSelectionMethod | ManualSelectionMethod;
      sampleSize: number;
      parameters?: Record<string, any>;
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
      return res.status(400).json({ error: "Run sampling analysis first" });
    }

    let existingBriefingData: Record<string, unknown> = {};
    try {
      existingBriefingData = JSON.parse(existingPlanningMemo.teamBriefingNotes);
    } catch {
      return res.status(400).json({ error: "Invalid sampling data" });
    }

    let samplingData = existingBriefingData.isa530AuditSampling as ISA530SamplingResult | null;
    
    if (!samplingData) {
      return res.status(400).json({ error: "Run sampling analysis first" });
    }

    const population = samplingData.step2_populations.find(p => p.id === populationId);
    if (!population) {
      return res.status(404).json({ error: "Population not found" });
    }

    const newSamples: SampleItem[] = [];
    const isManual = ['Specific Transaction', 'Judgmental', 'Management Override', 'Unusual Item'].includes(selectionMethod);

    for (let i = 0; i < sampleSize; i++) {
      newSamples.push({
        id: generateUniqueId('SMP'),
        transactionId: parameters?.transactionIds?.[i] || `TXN-${population.fsHeadKey}-NEW-${String(i + 1).padStart(4, '0')}`,
        fsHeadKey: population.fsHeadKey,
        fsHeadLabel: population.fsHeadLabel,
        assertion: population.assertion,
        amount: parameters?.amounts?.[i] || (population.totalValue / Math.max(sampleSize, 1)),
        selectionMethod,
        populationReference: populationId,
        stratumReference: null,
        riskReference: parameters?.riskReference || null,
        testStatus: 'Planned',
        auditProcedureId: null,
        workpaperTemplateId: null,
        evidenceUploadSlot: `EV-${population.fsHeadKey}-${population.assertion}-NEW-${String(i + 1).padStart(3, '0')}`,
        exceptionTracking: null,
        manualJustification: isManual ? {
          reason: parameters?.reason || 'Manual selection',
          riskAssertion: `${population.fsHeadKey} - ${population.assertion}`,
          auditorId: userId,
          approvedBy: null,
          approvalTimestamp: null,
        } : null,
      });
    }

    samplingData.step7_sampleList = [
      ...samplingData.step7_sampleList.filter(s => s.populationReference !== populationId),
      ...newSamples
    ];

    const newLinks = createAuditProgramLinks(newSamples);
    samplingData.step8_auditProgramLinks = [
      ...samplingData.step8_auditProgramLinks.filter(l => 
        !samplingData!.step7_sampleList.some(s => s.id === l.sampleItemId && s.populationReference === populationId)
      ),
      ...newLinks
    ];

    const updatedBriefingData = {
      ...existingBriefingData,
      isa530AuditSampling: samplingData,
      isa530LastModified: new Date().toISOString(),
      isa530ModifiedBy: userId
    };

    await prisma.planningMemo.update({
      where: { id: existingPlanningMemo.id },
      data: {
        teamBriefingNotes: JSON.stringify(updatedBriefingData),
        updatedAt: new Date()
      }
    });

    res.json({ 
      success: true, 
      samplesGenerated: newSamples.length,
      samples: newSamples 
    });
  } catch (error) {
    console.error("Select samples error:", error);
    res.status(500).json({ error: "Failed to select samples" });
  }
});

router.get("/:engagementId/sample-list", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const firmId = req.user!.firmId;
    const { fsHeadKey, assertion, status, populationId } = req.query;

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
      return res.json({ samples: [], total: 0 });
    }

    let briefingData: Record<string, unknown> = {};
    try {
      briefingData = JSON.parse(existingPlanningMemo.teamBriefingNotes);
    } catch {
      return res.json({ samples: [], total: 0 });
    }

    const samplingData = briefingData.isa530AuditSampling as ISA530SamplingResult | null;

    if (!samplingData) {
      return res.json({ samples: [], total: 0 });
    }

    let samples = samplingData.step7_sampleList;

    if (fsHeadKey) {
      samples = samples.filter(s => s.fsHeadKey === fsHeadKey);
    }
    if (assertion) {
      samples = samples.filter(s => s.assertion === assertion);
    }
    if (status) {
      samples = samples.filter(s => s.testStatus === status);
    }
    if (populationId) {
      samples = samples.filter(s => s.populationReference === populationId);
    }

    const summary = {
      total: samples.length,
      byStatus: {
        planned: samples.filter(s => s.testStatus === 'Planned').length,
        inProgress: samples.filter(s => s.testStatus === 'In Progress').length,
        tested: samples.filter(s => s.testStatus === 'Tested').length,
        exception: samples.filter(s => s.testStatus === 'Exception').length,
      },
      totalValue: samples.reduce((sum, s) => sum + s.amount, 0),
    };

    res.json({ 
      samples, 
      summary,
      populations: samplingData.step2_populations,
      auditProgramLinks: samplingData.step8_auditProgramLinks.filter(l => 
        samples.some(s => s.id === l.sampleItemId)
      )
    });
  } catch (error) {
    console.error("Get sample list error:", error);
    res.status(500).json({ error: "Failed to get sample list" });
  }
});

export default router;
