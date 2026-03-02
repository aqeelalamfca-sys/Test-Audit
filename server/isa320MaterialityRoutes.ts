import { Router, Response } from "express";
import { prisma } from "./db";
import { requireAuth, type AuthenticatedRequest } from "./auth";
import { Decimal } from "@prisma/client/runtime/library";

const router = Router();

interface BenchmarkConfig {
  type: 'PBT' | 'REVENUE' | 'ASSETS' | 'EQUITY';
  name: string;
  minPercentage: number;
  maxPercentage: number;
  defaultPercentage: number;
  applicableEntityTypes: string[];
  description: string;
}

const BENCHMARK_CONFIGS: BenchmarkConfig[] = [
  {
    type: 'PBT',
    name: 'Profit Before Tax',
    minPercentage: 5,
    maxPercentage: 10,
    defaultPercentage: 7.5,
    applicableEntityTypes: ['PRIVATE', 'PUBLIC'],
    description: 'Commonly used for profit-oriented entities with stable earnings'
  },
  {
    type: 'REVENUE',
    name: 'Total Revenue',
    minPercentage: 0.5,
    maxPercentage: 2,
    defaultPercentage: 1,
    applicableEntityTypes: ['PRIVATE', 'PUBLIC', 'NFP'],
    description: 'Appropriate when profit is volatile or entity is revenue-focused'
  },
  {
    type: 'ASSETS',
    name: 'Total Assets',
    minPercentage: 1,
    maxPercentage: 2,
    defaultPercentage: 1.5,
    applicableEntityTypes: ['PRIVATE', 'PUBLIC', 'NFP', 'FINANCIAL'],
    description: 'Suitable for asset-intensive industries or financial institutions'
  },
  {
    type: 'EQUITY',
    name: 'Total Equity',
    minPercentage: 1,
    maxPercentage: 5,
    defaultPercentage: 2,
    applicableEntityTypes: ['PRIVATE', 'PUBLIC'],
    description: 'Used when equity is a primary focus for stakeholders'
  }
];

const SENSITIVE_INDUSTRIES = [
  'BANKING', 'INSURANCE', 'FINANCIAL_SERVICES', 'HEALTHCARE',
  'PHARMACEUTICALS', 'GOVERNMENT', 'UTILITIES', 'REGULATED'
];

const HIGH_FRAUD_RISK_INDUSTRIES = [
  'CONSTRUCTION', 'REAL_ESTATE', 'RETAIL', 'HOSPITALITY'
];

interface RiskAdjustment {
  factor: string;
  description: string;
  adjustment: number;
  applied: boolean;
  rationale: string;
}

interface QualitativeFactor {
  factor: string;
  present: boolean;
  assessment: string;
  impactLevel: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
}

interface AlternativeBenchmark {
  benchmark: string;
  value: number;
  percentageRange: string;
  reasonNotSelected: string;
}

interface SignificantFSHead {
  accountName: string;
  balance: number;
  percentOfMateriality: number;
  riskRating: string;
}

interface PartnerOverrideStructure {
  overrideEnabled: boolean;
  overrideFields: string[];
  requiredFields: string[];
  currentOverride: {
    reason?: string;
    revisedValue?: number;
    impactAssessment?: string;
    approvalTimestamp?: string;
    approverUserId?: string;
  } | null;
}

interface DocumentationOutput {
  benchmarkSelectionRationale: string;
  selectedBenchmarkAndPercentage: string;
  overallMaterialitySummary: string;
  performanceMaterialitySummary: string;
  trivialThresholdSummary: string;
  qualitativeFactorsConsidered: string[];
  impactOnAuditPlanning: string;
  isaReferences: string[];
}

interface ISA320MaterialityResult {
  engagementId: string;
  analysisTimestamp: string;
  step1_dataIngestion: {
    revenue: number;
    totalAssets: number;
    totalEquity: number;
    profitBeforeTax: number;
    priorYearRevenue: number | null;
    priorYearAssets: number | null;
    priorYearPBT: number | null;
    entityType: string | null;
    industry: string | null;
    ownershipStructure: string | null;
    regulatoryEnvironment: string | null;
    fraudRisksIdentified: number;
    significantRisksIdentified: number;
    fsLevelRisks: string[];
  };
  step2_benchmarkSelection: {
    selectedBenchmark: string;
    benchmarkValue: number;
    percentageRange: { min: number; max: number };
    justification: string;
    alternativeBenchmarks: AlternativeBenchmark[];
  };
  step3_riskAdjustedPercentage: {
    basePercentage: number;
    adjustments: RiskAdjustment[];
    finalPercentage: number;
    adjustmentRationale: string;
  };
  step4_materialityLevels: {
    overallMateriality: number;
    performanceMateriality: number;
    performanceMaterialityPercentage: number;
    trivialThreshold: number;
    trivialThresholdPercentage: number;
    calculationFormulas: {
      overall: string;
      performance: string;
      trivial: string;
    };
  };
  step5_qualitativeFactors: {
    factors: QualitativeFactor[];
    impactAssessment: string;
    adjustmentRecommendation: string;
  };
  step6_riskAssessmentLinkage: {
    significantFSHeads: SignificantFSHead[];
    riskRatingsImpact: string;
    analyticalProcedureThresholds: {
      significantVariance: number;
      investigationThreshold: number;
    };
    samplingParameters: {
      suggestedConfidenceLevel: number;
      tolerableMisstatement: number;
      expectedError: number;
    };
  };
  step7_partnerOverride: PartnerOverrideStructure;
  step8_documentation: DocumentationOutput;
}

function calculateTotalsFromCoA(accounts: any[]): {
  revenue: number;
  totalAssets: number;
  totalEquity: number;
  profitBeforeTax: number;
} {
  let revenue = 0;
  let totalAssets = 0;
  let totalEquity = 0;
  let totalIncome = 0;
  let totalExpenses = 0;

  for (const acc of accounts) {
    const balance = Number(acc.closingBalance) || 0;
    const accountClass = (acc.accountClass || '').toUpperCase();
    const tbGroup = (acc.tbGroup || '').toUpperCase();
    const fsLineItem = (acc.fsLineItem || '').toUpperCase();

    if (accountClass.includes('ASSET') || tbGroup.includes('ASSET')) {
      totalAssets += Math.abs(balance);
    }

    if (accountClass.includes('EQUITY') || tbGroup.includes('EQUITY') || 
        fsLineItem.includes('EQUITY') || fsLineItem.includes('CAPITAL')) {
      totalEquity += balance;
    }

    if (accountClass.includes('REVENUE') || accountClass.includes('INCOME') || 
        tbGroup.includes('REVENUE') || tbGroup.includes('INCOME') ||
        fsLineItem.includes('REVENUE') || fsLineItem.includes('SALES')) {
      if (!fsLineItem.includes('EXPENSE') && !fsLineItem.includes('COST')) {
        revenue += Math.abs(balance);
        totalIncome += Math.abs(balance);
      }
    }

    if (accountClass.includes('EXPENSE') || accountClass.includes('COST') ||
        tbGroup.includes('EXPENSE') || tbGroup.includes('COST')) {
      totalExpenses += Math.abs(balance);
    }
  }

  const profitBeforeTax = totalIncome - totalExpenses;

  return { revenue, totalAssets, totalEquity, profitBeforeTax };
}

function selectBestBenchmark(
  data: { revenue: number; totalAssets: number; totalEquity: number; profitBeforeTax: number },
  entityType: string | null,
  industry: string | null,
  priorYearPBT: number | null
): { selected: BenchmarkConfig; value: number; justification: string; alternatives: AlternativeBenchmark[] } {
  const alternatives: AlternativeBenchmark[] = [];
  let selected: BenchmarkConfig = BENCHMARK_CONFIGS[0];
  let selectedValue = data.profitBeforeTax;
  let justification = '';

  const pbtVolatility = priorYearPBT !== null && priorYearPBT !== 0
    ? Math.abs((data.profitBeforeTax - priorYearPBT) / priorYearPBT)
    : 0;

  const isFinancialInstitution = industry && 
    ['BANKING', 'INSURANCE', 'FINANCIAL_SERVICES'].includes(industry.toUpperCase());

  const isProfitMakingEntity = data.profitBeforeTax > 0;
  const isPBTStable = pbtVolatility < 0.5;

  if (isProfitMakingEntity && isPBTStable && !isFinancialInstitution) {
    selected = BENCHMARK_CONFIGS.find(b => b.type === 'PBT')!;
    selectedValue = data.profitBeforeTax;
    justification = `Profit Before Tax selected as the entity is profit-making with stable earnings (volatility: ${(pbtVolatility * 100).toFixed(1)}%). ` +
      `PBT of ${formatCurrency(data.profitBeforeTax)} represents a reliable and commonly accepted benchmark per ISA 320.A4. ` +
      `Users of financial statements typically focus on profitability measures.`;
  } else if (isFinancialInstitution) {
    selected = BENCHMARK_CONFIGS.find(b => b.type === 'ASSETS')!;
    selectedValue = data.totalAssets;
    justification = `Total Assets selected as the entity operates in the financial services industry. ` +
      `For financial institutions, total assets of ${formatCurrency(data.totalAssets)} provides a more stable and relevant benchmark ` +
      `as users focus on the asset base rather than volatile profit margins.`;
  } else if (!isProfitMakingEntity || pbtVolatility > 0.5) {
    selected = BENCHMARK_CONFIGS.find(b => b.type === 'REVENUE')!;
    selectedValue = data.revenue;
    justification = isProfitMakingEntity 
      ? `Revenue selected due to significant PBT volatility (${(pbtVolatility * 100).toFixed(1)}%). ` +
        `Revenue of ${formatCurrency(data.revenue)} provides a more stable benchmark when earnings fluctuate significantly.`
      : `Revenue selected as the entity is not profit-making or has minimal profit. ` +
        `Revenue of ${formatCurrency(data.revenue)} provides a meaningful benchmark for loss-making or break-even entities.`;
  }

  for (const config of BENCHMARK_CONFIGS) {
    if (config.type !== selected.type) {
      let value = 0;
      let reason = '';

      switch (config.type) {
        case 'PBT':
          value = data.profitBeforeTax;
          if (!isProfitMakingEntity) {
            reason = 'Entity is not profit-making; PBT would not be a meaningful benchmark';
          } else if (!isPBTStable) {
            reason = `PBT volatility of ${(pbtVolatility * 100).toFixed(1)}% exceeds acceptable threshold; unstable benchmark`;
          } else if (isFinancialInstitution) {
            reason = 'For financial institutions, total assets is more appropriate than profit-based measures';
          }
          break;
        case 'REVENUE':
          value = data.revenue;
          reason = isProfitMakingEntity && isPBTStable 
            ? 'PBT is available and stable; provides more direct relevance to users' 
            : 'Revenue could be considered but current selection is more appropriate';
          break;
        case 'ASSETS':
          value = data.totalAssets;
          reason = !isFinancialInstitution 
            ? 'Entity is not a financial institution; asset-based benchmark less relevant' 
            : 'Assets could be considered but current selection is more appropriate';
          break;
        case 'EQUITY':
          value = data.totalEquity;
          reason = 'Equity benchmark typically used only when equity is primary stakeholder focus; other benchmarks more relevant';
          break;
      }

      alternatives.push({
        benchmark: config.name,
        value,
        percentageRange: `${config.minPercentage}% - ${config.maxPercentage}%`,
        reasonNotSelected: reason || 'Selected benchmark deemed more appropriate for current circumstances'
      });
    }
  }

  return { selected, value: selectedValue, justification, alternatives };
}

function calculateRiskAdjustments(
  basePercentage: number,
  fraudRisksCount: number,
  significantRisksCount: number,
  entityType: string | null,
  industry: string | null,
  controlsRating: string | null
): { adjustments: RiskAdjustment[]; finalPercentage: number; rationale: string } {
  const adjustments: RiskAdjustment[] = [];
  let totalAdjustment = 0;

  if (fraudRisksCount > 0) {
    const adjustment = -0.5 * Math.min(fraudRisksCount, 3);
    adjustments.push({
      factor: 'Fraud Risk Presence',
      description: `${fraudRisksCount} fraud risk(s) identified in risk assessment`,
      adjustment,
      applied: true,
      rationale: 'ISA 240 requires heightened professional skepticism; lower materiality ensures more rigorous testing'
    });
    totalAdjustment += adjustment;
  } else {
    adjustments.push({
      factor: 'Fraud Risk Presence',
      description: 'No specific fraud risks identified beyond presumed risks',
      adjustment: 0,
      applied: false,
      rationale: 'No adjustment required for standard fraud risk considerations'
    });
  }

  if (significantRisksCount > 2) {
    const adjustment = -0.3 * Math.min(significantRisksCount - 2, 3);
    adjustments.push({
      factor: 'Significant Judgment Areas',
      description: `${significantRisksCount} significant risks requiring special audit consideration`,
      adjustment,
      applied: true,
      rationale: 'High number of significant risks indicates areas requiring extensive judgment; lower materiality prudent'
    });
    totalAdjustment += adjustment;
  } else {
    adjustments.push({
      factor: 'Significant Judgment Areas',
      description: `${significantRisksCount} significant risks identified`,
      adjustment: 0,
      applied: false,
      rationale: 'Number of significant risks within normal range'
    });
  }

  const isPublicEntity = entityType?.toUpperCase() === 'PUBLIC';
  if (isPublicEntity) {
    adjustments.push({
      factor: 'Public Interest Entity',
      description: 'Entity is a public interest entity with wider stakeholder base',
      adjustment: -0.5,
      applied: true,
      rationale: 'Public entities require lower materiality due to wider user base and regulatory scrutiny'
    });
    totalAdjustment += -0.5;
  } else {
    adjustments.push({
      factor: 'Public Interest Entity',
      description: 'Private entity with limited stakeholder base',
      adjustment: 0,
      applied: false,
      rationale: 'No adjustment required for non-public entities'
    });
  }

  const isSensitiveIndustry = industry && SENSITIVE_INDUSTRIES.includes(industry.toUpperCase());
  if (isSensitiveIndustry) {
    adjustments.push({
      factor: 'Regulatory Sensitivity',
      description: `Entity operates in regulated industry: ${industry}`,
      adjustment: -0.3,
      applied: true,
      rationale: 'Regulated industries face heightened scrutiny; conservative materiality approach required'
    });
    totalAdjustment += -0.3;
  } else {
    adjustments.push({
      factor: 'Regulatory Sensitivity',
      description: 'Entity operates in non-regulated industry',
      adjustment: 0,
      applied: false,
      rationale: 'No additional regulatory sensitivity considerations'
    });
  }

  const weakControls = controlsRating?.toUpperCase() === 'WEAK' || controlsRating?.toUpperCase() === 'INEFFECTIVE';
  if (weakControls) {
    adjustments.push({
      factor: 'Control Environment',
      description: 'Internal control environment assessed as weak or ineffective',
      adjustment: -0.5,
      applied: true,
      rationale: 'Weak controls increase risk of material misstatement; compensating with lower materiality'
    });
    totalAdjustment += -0.5;
  } else {
    adjustments.push({
      factor: 'Control Environment',
      description: 'Internal control environment adequate',
      adjustment: 0,
      applied: false,
      rationale: 'No adjustment required for adequate control environment'
    });
  }

  const finalPercentage = Math.max(basePercentage + totalAdjustment, basePercentage * 0.5);
  const appliedAdjustments = adjustments.filter(a => a.applied);

  const rationale = appliedAdjustments.length > 0
    ? `Base percentage of ${basePercentage}% adjusted by ${totalAdjustment.toFixed(2)}% due to: ${appliedAdjustments.map(a => a.factor).join(', ')}. ` +
      `Final percentage of ${finalPercentage.toFixed(2)}% reflects a risk-adjusted approach per ISA 320.`
    : `Base percentage of ${basePercentage}% maintained as no significant risk adjustments required.`;

  return { adjustments, finalPercentage, rationale };
}

function assessQualitativeFactors(
  fraudRisksCount: number,
  industry: string | null,
  entityType: string | null,
  fsLevelRisks: string[]
): { factors: QualitativeFactor[]; impactAssessment: string; adjustmentRecommendation: string } {
  const factors: QualitativeFactor[] = [];

  factors.push({
    factor: 'fraudRiskPresent',
    present: fraudRisksCount > 0,
    assessment: fraudRisksCount > 0
      ? `${fraudRisksCount} fraud risk(s) identified requiring enhanced audit procedures per ISA 240`
      : 'Standard fraud risk considerations apply; no specific fraud risks identified beyond presumed risks',
    impactLevel: fraudRisksCount > 2 ? 'HIGH' : fraudRisksCount > 0 ? 'MEDIUM' : 'LOW'
  });

  const hasGCRisk = fsLevelRisks.some(r => 
    r.toLowerCase().includes('going concern') || r.toLowerCase().includes('liquidity')
  );
  factors.push({
    factor: 'goingConcernUncertainty',
    present: hasGCRisk,
    assessment: hasGCRisk
      ? 'Going concern indicators or uncertainties identified; requires disclosure evaluation per ISA 570'
      : 'No material going concern uncertainties identified based on current risk assessment',
    impactLevel: hasGCRisk ? 'HIGH' : 'NONE'
  });

  const isRegulated = !!(industry && SENSITIVE_INDUSTRIES.includes(industry.toUpperCase()));
  factors.push({
    factor: 'regulatorySensitivity',
    present: isRegulated,
    assessment: isRegulated
      ? `Entity operates in regulated industry (${industry}); enhanced scrutiny by regulators expected`
      : 'Entity not subject to specific industry regulation affecting materiality',
    impactLevel: isRegulated ? 'MEDIUM' : 'NONE'
  });

  const hasDebtCovenant = fsLevelRisks.some(r => 
    r.toLowerCase().includes('covenant') || r.toLowerCase().includes('debt') || r.toLowerCase().includes('borrowing')
  );
  factors.push({
    factor: 'debtCovenantCompliance',
    present: hasDebtCovenant,
    assessment: hasDebtCovenant
      ? 'Debt covenant compliance is a sensitive matter; users may focus on specific thresholds'
      : 'No specific debt covenant concerns identified affecting materiality considerations',
    impactLevel: hasDebtCovenant ? 'MEDIUM' : 'NONE'
  });

  const hasRelatedParty = fsLevelRisks.some(r => r.toLowerCase().includes('related party'));
  factors.push({
    factor: 'relatedPartyDominance',
    present: hasRelatedParty,
    assessment: hasRelatedParty
      ? 'Significant related party relationships identified; enhanced disclosure testing required per ISA 550'
      : 'No dominant related party relationships affecting materiality considerations',
    impactLevel: hasRelatedParty ? 'MEDIUM' : 'NONE'
  });

  const isHighRiskIndustry = !!(industry && HIGH_FRAUD_RISK_INDUSTRIES.includes(industry.toUpperCase()));
  factors.push({
    factor: 'industrySpecificSensitivity',
    present: isHighRiskIndustry,
    assessment: isHighRiskIndustry
      ? `Industry (${industry}) has elevated inherent risk characteristics`
      : 'Industry does not present specific sensitivity concerns',
    impactLevel: isHighRiskIndustry ? 'MEDIUM' : 'NONE'
  });

  const isPublic = entityType?.toUpperCase() === 'PUBLIC';
  factors.push({
    factor: 'publicInterestConsiderations',
    present: isPublic,
    assessment: isPublic
      ? 'Public entity with diverse stakeholder base requiring conservative materiality approach'
      : 'Private entity; public interest considerations limited to standard requirements',
    impactLevel: isPublic ? 'HIGH' : 'NONE'
  });

  const highImpactFactors = factors.filter(f => f.impactLevel === 'HIGH').length;
  const mediumImpactFactors = factors.filter(f => f.impactLevel === 'MEDIUM').length;

  const impactAssessment = highImpactFactors > 0
    ? `${highImpactFactors} high-impact and ${mediumImpactFactors} medium-impact qualitative factors identified. ` +
      `These factors suggest a conservative approach to materiality is warranted.`
    : mediumImpactFactors > 0
    ? `${mediumImpactFactors} medium-impact qualitative factors identified. ` +
      `Standard materiality approach is appropriate with heightened awareness of identified factors.`
    : 'No significant qualitative factors identified that would require adjustment to calculated materiality.';

  const adjustmentRecommendation = highImpactFactors > 1
    ? 'Consider reducing overall materiality by 10-20% or using lower end of percentage range'
    : highImpactFactors === 1 || mediumImpactFactors > 2
    ? 'Consider using lower end of percentage range for selected benchmark'
    : 'Calculated materiality levels appear appropriate based on qualitative assessment';

  return { factors, impactAssessment, adjustmentRecommendation };
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'PKR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

function generateDocumentation(
  result: Omit<ISA320MaterialityResult, 'step8_documentation'>
): DocumentationOutput {
  const { step2_benchmarkSelection, step3_riskAdjustedPercentage, step4_materialityLevels, step5_qualitativeFactors } = result;

  return {
    benchmarkSelectionRationale: 
      `In determining materiality for the audit of the financial statements, we evaluated the available benchmarks ` +
      `in accordance with ISA 320. ${step2_benchmarkSelection.justification} ` +
      `Alternative benchmarks considered were: ${step2_benchmarkSelection.alternativeBenchmarks.map(a => 
        `${a.benchmark} (${formatCurrency(a.value)}) - not selected because: ${a.reasonNotSelected}`
      ).join('; ')}.`,

    selectedBenchmarkAndPercentage:
      `${step2_benchmarkSelection.selectedBenchmark} of ${formatCurrency(step2_benchmarkSelection.benchmarkValue)} ` +
      `at ${step3_riskAdjustedPercentage.finalPercentage.toFixed(2)}% ` +
      `(acceptable range: ${step2_benchmarkSelection.percentageRange.min}% - ${step2_benchmarkSelection.percentageRange.max}%)`,

    overallMaterialitySummary:
      `Overall materiality has been set at ${formatCurrency(step4_materialityLevels.overallMateriality)} ` +
      `(${step3_riskAdjustedPercentage.finalPercentage.toFixed(2)}% of ${step2_benchmarkSelection.selectedBenchmark}). ` +
      `This amount represents our judgment of the maximum misstatement that could exist without affecting ` +
      `the economic decisions of users taken on the basis of the financial statements.`,

    performanceMaterialitySummary:
      `Performance materiality has been set at ${formatCurrency(step4_materialityLevels.performanceMateriality)} ` +
      `(${step4_materialityLevels.performanceMaterialityPercentage}% of overall materiality). ` +
      `This level has been determined considering the assessed risks of material misstatement and our understanding ` +
      `of the entity, including results of audit procedures performed in prior periods.`,

    trivialThresholdSummary:
      `The threshold below which misstatements are considered clearly trivial has been set at ` +
      `${formatCurrency(step4_materialityLevels.trivialThreshold)} ` +
      `(${step4_materialityLevels.trivialThresholdPercentage}% of performance materiality). ` +
      `Misstatements below this threshold will not be accumulated unless they indicate potential fraud or ` +
      `systematic error per ISA 450.`,

    qualitativeFactorsConsidered: step5_qualitativeFactors.factors
      .filter(f => f.present)
      .map(f => `${f.factor}: ${f.assessment}`),

    impactOnAuditPlanning:
      `The determined materiality levels will inform: (1) Risk assessment - accounts with balances exceeding ` +
      `${formatCurrency(step4_materialityLevels.overallMateriality)} require detailed testing; ` +
      `(2) Sampling - sample sizes calibrated using tolerable misstatement of ` +
      `${formatCurrency(step4_materialityLevels.performanceMateriality)}; ` +
      `(3) Analytical procedures - variances exceeding ${formatCurrency(step4_materialityLevels.performanceMateriality * 0.5)} ` +
      `require investigation; (4) Evaluation - accumulated misstatements approaching ` +
      `${formatCurrency(step4_materialityLevels.overallMateriality)} require management adjustment or audit report modification.`,

    isaReferences: [
      'ISA 320.10 - Materiality in planning and performing an audit',
      'ISA 320.11 - Performance materiality for risk assessment',
      'ISA 320.A3 - Benchmarks for determining materiality',
      'ISA 320.A4 - Percentage ranges for benchmarks',
      'ISA 450.A2 - Clearly trivial threshold',
      'ISA 450.5 - Accumulating identified misstatements'
    ]
  };
}

router.post("/:engagementId/analyze", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const userId = req.user!.id;
    const firmId = req.user!.firmId;

    if (!firmId) {
      return res.status(400).json({ error: "User not associated with a firm" });
    }

    const engagement = await prisma.engagement.findFirst({
      where: { id: engagementId, firmId },
      include: {
        client: true
      }
    });

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    const coaAccounts = await prisma.coAAccount.findMany({
      where: { engagementId }
    });

    const riskAssessments = await prisma.riskAssessment.findMany({
      where: { engagementId }
    });

    const financialTotals = calculateTotalsFromCoA(coaAccounts);

    const priorYearRevenue = engagement.previousYearRevenue || null;
    const priorYearAssets: number | null = null;
    const priorYearPBT: number | null = null;

    const entityType = engagement.client?.entityType || null;
    const industry = engagement.client?.industry || null;
    const ownershipStructure = engagement.client?.ownershipStructure || null;
    const regulatoryCategory = engagement.client?.regulatoryCategory || null;

    const fraudRisks = riskAssessments.filter(r => r.isFraudRisk);
    const significantRisks = riskAssessments.filter(r => r.isSignificantRisk);
    const fsLevelRisks = [...new Set(riskAssessments.map(r => r.accountOrClass))];

    const step1_dataIngestion = {
      revenue: financialTotals.revenue,
      totalAssets: financialTotals.totalAssets,
      totalEquity: financialTotals.totalEquity,
      profitBeforeTax: financialTotals.profitBeforeTax,
      priorYearRevenue,
      priorYearAssets,
      priorYearPBT,
      entityType,
      industry,
      ownershipStructure,
      regulatoryEnvironment: regulatoryCategory,
      fraudRisksIdentified: fraudRisks.length,
      significantRisksIdentified: significantRisks.length,
      fsLevelRisks
    };

    const benchmarkResult = selectBestBenchmark(
      financialTotals,
      entityType,
      industry,
      priorYearPBT
    );

    const step2_benchmarkSelection = {
      selectedBenchmark: benchmarkResult.selected.name,
      benchmarkValue: benchmarkResult.value,
      percentageRange: {
        min: benchmarkResult.selected.minPercentage,
        max: benchmarkResult.selected.maxPercentage
      },
      justification: benchmarkResult.justification,
      alternativeBenchmarks: benchmarkResult.alternatives
    };

    const controlsRating: string | null = null;
    const riskAdjustmentResult = calculateRiskAdjustments(
      benchmarkResult.selected.defaultPercentage,
      fraudRisks.length,
      significantRisks.length,
      entityType,
      industry,
      controlsRating
    );

    const step3_riskAdjustedPercentage = {
      basePercentage: benchmarkResult.selected.defaultPercentage,
      adjustments: riskAdjustmentResult.adjustments,
      finalPercentage: riskAdjustmentResult.finalPercentage,
      adjustmentRationale: riskAdjustmentResult.rationale
    };

    const overallMateriality = benchmarkResult.value * (riskAdjustmentResult.finalPercentage / 100);
    const hasHighRisk = fraudRisks.length > 0 || significantRisks.length > 3;
    const pmPercentage = hasHighRisk ? 65 : 75;
    const performanceMateriality = overallMateriality * (pmPercentage / 100);
    const trivialPercentage = hasHighRisk ? 3 : 5;
    const trivialThreshold = performanceMateriality * (trivialPercentage / 100);

    const step4_materialityLevels = {
      overallMateriality: Math.round(overallMateriality),
      performanceMateriality: Math.round(performanceMateriality),
      performanceMaterialityPercentage: pmPercentage,
      trivialThreshold: Math.round(trivialThreshold),
      trivialThresholdPercentage: trivialPercentage,
      calculationFormulas: {
        overall: `${formatCurrency(benchmarkResult.value)} × ${riskAdjustmentResult.finalPercentage.toFixed(2)}% = ${formatCurrency(Math.round(overallMateriality))}`,
        performance: `${formatCurrency(Math.round(overallMateriality))} × ${pmPercentage}% = ${formatCurrency(Math.round(performanceMateriality))}`,
        trivial: `${formatCurrency(Math.round(performanceMateriality))} × ${trivialPercentage}% = ${formatCurrency(Math.round(trivialThreshold))}`
      }
    };

    const qualitativeResult = assessQualitativeFactors(
      fraudRisks.length,
      industry,
      entityType,
      fsLevelRisks
    );

    const step5_qualitativeFactors = qualitativeResult;

    const significantFSHeads: SignificantFSHead[] = coaAccounts
      .filter(acc => Math.abs(Number(acc.closingBalance)) > overallMateriality)
      .map(acc => ({
        accountName: acc.accountName,
        balance: Number(acc.closingBalance),
        percentOfMateriality: Math.round((Math.abs(Number(acc.closingBalance)) / overallMateriality) * 100),
        riskRating: Math.abs(Number(acc.closingBalance)) > overallMateriality * 2 ? 'HIGH' : 'MEDIUM'
      }))
      .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance))
      .slice(0, 20);

    const step6_riskAssessmentLinkage = {
      significantFSHeads,
      riskRatingsImpact: 
        `Materiality of ${formatCurrency(Math.round(overallMateriality))} identifies ${significantFSHeads.length} significant account(s) ` +
        `requiring detailed substantive testing. These accounts collectively warrant enhanced risk assessment focus.`,
      analyticalProcedureThresholds: {
        significantVariance: Math.round(performanceMateriality * 0.5),
        investigationThreshold: Math.round(performanceMateriality * 0.25)
      },
      samplingParameters: {
        suggestedConfidenceLevel: hasHighRisk ? 95 : 90,
        tolerableMisstatement: Math.round(performanceMateriality),
        expectedError: Math.round(performanceMateriality * 0.1)
      }
    };

    const step7_partnerOverride: PartnerOverrideStructure = {
      overrideEnabled: true,
      overrideFields: [
        'overallMateriality',
        'performanceMateriality',
        'trivialThreshold',
        'benchmark',
        'percentage'
      ],
      requiredFields: [
        'reason',
        'revisedValue',
        'impactAssessment',
        'approvalTimestamp',
        'approverUserId'
      ],
      currentOverride: null
    };

    const partialResult = {
      engagementId,
      analysisTimestamp: new Date().toISOString(),
      step1_dataIngestion,
      step2_benchmarkSelection,
      step3_riskAdjustedPercentage,
      step4_materialityLevels,
      step5_qualitativeFactors,
      step6_riskAssessmentLinkage,
      step7_partnerOverride
    };

    const step8_documentation = generateDocumentation(partialResult);

    const result: ISA320MaterialityResult = {
      ...partialResult,
      step8_documentation
    };

    res.json(result);
  } catch (error) {
    console.error("ISA 320 Materiality Analysis Error:", error);
    res.status(500).json({
      error: "Failed to perform materiality analysis",
      details: error instanceof Error ? error.message : "Unknown error"
    });
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

    const materialityAssessments = await prisma.materialityAssessment.findMany({
      where: { engagementId },
      include: {
        approvedBy: { select: { id: true, fullName: true, role: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    const planningMemo = await prisma.planningMemo.findFirst({
      where: { engagementId }
    });

    let isa320Analysis = null;
    if (planningMemo?.teamBriefingNotes) {
      try {
        const briefingData = JSON.parse(planningMemo.teamBriefingNotes);
        if (briefingData.isa320MaterialityAnalysis) {
          isa320Analysis = briefingData.isa320MaterialityAnalysis;
        }
      } catch {
        // Not JSON or doesn't contain ISA 320 data
      }
    }

    res.json({
      materialityAssessments,
      isa320Analysis,
      hasAnalysis: isa320Analysis !== null
    });
  } catch (error) {
    console.error("Get ISA 320 Materiality Error:", error);
    res.status(500).json({
      error: "Failed to retrieve materiality data",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

router.post("/:engagementId/save", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const { analysisResult, applyToMaterialityAssessment } = req.body;
    const userId = req.user!.id;
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

    if (!analysisResult) {
      return res.status(400).json({ error: "Analysis result is required" });
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
      isa320MaterialityAnalysis: analysisResult,
      isa320AnalysisTimestamp: new Date().toISOString(),
      isa320AnalyzedBy: userId
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

    if (applyToMaterialityAssessment && analysisResult.step4_materialityLevels) {
      const levels = analysisResult.step4_materialityLevels;
      const benchmarkSelection = analysisResult.step2_benchmarkSelection;
      const riskAdjusted = analysisResult.step3_riskAdjustedPercentage;

      let benchmarkEnum: 'PBT' | 'REVENUE' | 'TOTAL_ASSETS' | 'EQUITY' | 'GROSS_PROFIT' = 'PBT';
      if (benchmarkSelection.selectedBenchmark.includes('Revenue')) benchmarkEnum = 'REVENUE';
      else if (benchmarkSelection.selectedBenchmark.includes('Assets')) benchmarkEnum = 'TOTAL_ASSETS';
      else if (benchmarkSelection.selectedBenchmark.includes('Equity')) benchmarkEnum = 'EQUITY';

      await prisma.materialityAssessment.create({
        data: {
          engagementId,
          benchmark: benchmarkEnum,
          benchmarkAmount: benchmarkSelection.benchmarkValue,
          benchmarkPercentage: riskAdjusted.finalPercentage,
          overallMateriality: levels.overallMateriality,
          performanceMateriality: levels.performanceMateriality,
          performanceMatPercentage: levels.performanceMaterialityPercentage,
          amptThreshold: levels.trivialThreshold,
          amptPercentage: levels.trivialThresholdPercentage,
          justification: analysisResult.step8_documentation?.benchmarkSelectionRationale || 'Generated by ISA 320 AI Analysis',
          isaReference: 'ISA 320'
        }
      });
    }

    res.json({
      success: true,
      message: "ISA 320 materiality analysis saved successfully",
      savedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error("Save ISA 320 Materiality Error:", error);
    res.status(500).json({
      error: "Failed to save materiality analysis",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

export default router;
