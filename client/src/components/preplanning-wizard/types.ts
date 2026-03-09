import type { SignOffData } from "@/components/sign-off-bar";
import type { ChecklistSection } from "@/components/compliance-checklist";
import type { EvidenceFile } from "@/components/evidence-uploader";

export interface EntityUnderstandingData {
  engagementId: string;
  entityBackground: {
    nature: string;
    legalStructure: string;
    ownership: string;
    sizeClassification: "small" | "medium" | "large" | "listed" | "";
    dateOfIncorporation: string;
    registeredOffice: string;
  };
  industryEnvironment: {
    industryRisks: string;
    regulatoryEnvironment: string;
    economicFactors: string;
    competitiveLandscape: string;
    technologicalFactors: string;
  };
  businessOperations: {
    revenueStreams: string;
    keyCustomers: string;
    keySuppliers: string;
    seasonalPatterns: string;
    geographicSpread: string;
    significantContracts: string;
  };
  governance: {
    governanceStructure: string;
    tcwgComposition: string;
    managementCompetence: string;
    auditCommitteeExists: boolean;
    auditCommitteeDetails: string;
  };
  internalControlEnvironment: {
    controlEnvironment: string;
    riskAssessmentProcess: string;
    informationSystems: string;
    controlActivities: string;
    monitoringOfControls: string;
    itEnvironment: string;
  };
  itEnvironmentAssessment: {
    itApplications: string;
    itInfrastructure: string;
    itGeneralControls: string;
    automatedControls: string;
    serviceOrganizations: string;
    cybersecurity: string;
    overallItComplexity: "simple" | "moderate" | "complex" | "";
    overallItRiskAssessment: string;
  };
  relatedParties: RelatedParty[];
  reportingFramework: {
    framework: string;
    specificRequirements: string;
    significantAccountingPolicies: string;
  };
  signOff: SignOffData;
}

export interface RelatedParty {
  id: string;
  name: string;
  relationship: string;
  natureOfTransactions: string;
  significanceLevel: "low" | "medium" | "high" | "";
  disclosureRequired: boolean;
}

export interface RiskAssessmentData {
  engagementId: string;
  identifiedRisks: IdentifiedRisk[];
  significantRisks: SignificantRisk[];
  inherentRiskFactors: {
    complexity: "low" | "medium" | "high" | "";
    subjectivity: "low" | "medium" | "high" | "";
    change: "low" | "medium" | "high" | "";
    uncertainty: "low" | "medium" | "high" | "";
    susceptibilityToFraud: "low" | "medium" | "high" | "";
    managementBias: "low" | "medium" | "high" | "";
    overallInherentRisk: string;
  };
  fraudRiskFactors: {
    pressureIndicators: string;
    opportunityIndicators: string;
    rationalizationIndicators: string;
    managementInquiries: string;
    aiSuggestions: string;
  };
  presumedRisks: {
    revenueRecognitionFraudRisk: boolean;
    revenueRecognitionDetails: string;
    revenueRecognitionRebuttal: string;
    managementOverrideRisk: boolean;
    managementOverrideDetails: string;
  };
  goingConcernAssessment: {
    financialIndicators: string;
    operationalIndicators: string;
    otherIndicators: string;
    conclusion: "no_concern" | "material_uncertainty" | "significant_doubt" | "";
    conclusionRationale: string;
  };
  significantAccounts: SignificantAccount[];
  overallRiskAssessment: {
    inherentRiskLevel: "low" | "medium" | "high" | "";
    controlRiskLevel: "low" | "medium" | "high" | "";
    combinedAssessment: "low" | "medium" | "high" | "";
    assessmentRationale: string;
    financialStatementLevelRisks: string;
    assertionLevelRisks: string;
  };
  signOff: SignOffData;
}

export interface SignificantRisk {
  id: string;
  description: string;
  whySignificant: string;
  relatedAssertions: string;
  plannedApproach: string;
  sourceRiskId: string;
  isaReference: string;
}

export interface IdentifiedRisk {
  id: string;
  description: string;
  category: "inherent" | "control" | "fraud" | "significant" | "";
  assertion: "existence" | "completeness" | "accuracy" | "valuation" | "rights" | "presentation" | "occurrence" | "cutoff" | "";
  riskLevel: "low" | "medium" | "high" | "";
  isaReference: string;
  response: string;
}

export interface SignificantAccount {
  id: string;
  accountName: string;
  balance: number;
  exceedsMateriality: boolean;
  qualitativeSignificance: string;
  riskClassification: "significant" | "non_significant" | "";
}

export interface MaterialityData {
  engagementId: string;
  benchmarkSelection: "revenue" | "total_assets" | "pbt" | "equity" | "gross_profit" | "";
  benchmarkRationale: string;
  financialData: {
    revenue: number;
    totalAssets: number;
    profitBeforeTax: number;
    equity: number;
    grossProfit: number;
  };
  materialityComputation: {
    benchmarkAmount: number;
    percentageApplied: number;
    overallMateriality: number;
    performanceMaterialityPercent: number;
    performanceMateriality: number;
    trivialThresholdPercent: number;
    trivialThreshold: number;
  };
  rationale: string;
  componentMateriality: {
    isGroupAudit: boolean;
    components: ComponentMaterialityItem[];
  };
  clearlyTrivialThreshold: {
    threshold: number;
    basis: string;
  };
  signOff: SignOffData;
}

export interface ComponentMaterialityItem {
  id: string;
  componentName: string;
  allocationBasis: string;
  allocatedMateriality: number;
  performanceMateriality: number;
}

export interface AcceptanceDueDiligenceData {
  engagementId: string;
  clientIntegrityAssessment: "pass" | "fail" | "";
  clientIntegrityRationale: string;
  independenceCheck: {
    independenceConfirmed: "yes" | "no" | "";
    conflictsIdentified: boolean;
    conflictDetails: string;
    safeguardsApplied: string;
    independenceRationale: string;
  };
  competenceAssessment: {
    hasCompetence: "yes" | "no" | "";
    competenceDetails: string;
    resourcesAvailable: "yes" | "no" | "";
    resourceDetails: string;
    specialistRequired: boolean;
    specialistDetails: string;
  };
  engagementRiskGrading: {
    overallRiskGrade: "low" | "medium" | "high" | "";
    riskGradeRationale: string;
    riskFactors: {
      clientType: "low" | "medium" | "high" | "";
      geographicRisk: "low" | "medium" | "high" | "";
      industryRisk: "low" | "medium" | "high" | "";
      transactionRisk: "low" | "medium" | "high" | "";
    };
  };
  predecessorAuditorStatus: "communicated" | "pending" | "not_applicable" | "";
  predecessorAuditorRemarks: string;
  predecessorAuditorFindings: string;
  dueDiligence: {
    entityIdentity: {
      registrationNumber: string;
      secpNtn: string;
      incorporationDate: string;
      registeredAddress: string;
      natureOfBusiness: string;
      principalActivities: string;
      sourceOfFunds: string;
      expectedTransactionVolume: string;
    };
    directorsAndOwners: DirectorBeneficialOwnerEntry[];
    screeningResults: ScreeningResultEntry[];
    overallAMLRiskScore: "low" | "medium" | "high" | "";
    riskScoreRationale: string;
  };
  scopeLimitations: string;
  hasConditions: boolean;
  conditionsDescription: string;
  acceptanceDecision: "accept" | "decline" | "accept_with_conditions" | "";
  declineReason: string;
  checklistSection: ChecklistSection;
  signOff: SignOffData;
}

export interface DirectorBeneficialOwnerEntry {
  id: string;
  name: string;
  role: "director" | "beneficial_owner" | "shareholder" | "";
  cnicPassport: string;
  nationality: string;
  ownershipPercentage: number;
  isPEP: boolean;
  pepDetails: string;
  verified: boolean;
}

export interface ScreeningResultEntry {
  id: string;
  checkType: "pep" | "sanctions" | "adverse_media" | "high_risk_jurisdiction" | "";
  result: "clear" | "hit" | "pending" | "";
  details: string;
  evidenceId: string;
  checkedDate: string;
  checkedBy: string;
}

export interface AnalyticsOpeningBalancesData {
  engagementId: string;
  openingBalancesReview: {
    checklist: ChecklistSection;
    priorYearOpinion: {
      opinionType: "unmodified" | "qualified" | "adverse" | "disclaimer" | "not_applicable" | "";
      priorAuditorFirm: string;
      priorPeriodEnd: string;
      keyAuditMatters: string;
      modificationsOrEmphasis: string;
      impactOnCurrentPeriod: string;
    };
    rollForwardStrategy: {
      approach: "full_rollforward" | "selective_rollforward" | "fresh_start" | "";
      areasForRollForward: string;
      adjustmentsRequired: string;
      accountingPolicyChanges: string;
      closingToOpeningReconciled: "yes" | "no" | "in_progress" | "";
      reconciliationNotes: string;
    };
    firstYearProcedures: {
      isFirstYearEngagement: boolean;
      predecessorAccess: "full_access" | "limited_access" | "no_access" | "not_applicable" | "";
      predecessorCommunication: string;
      alternativeProcedures: string;
      sufficientEvidenceObtained: "yes" | "no" | "in_progress" | "";
      reportImpact: string;
    };
    priorAuditorReview: string;
    openingTBReconciliationStatus: "reconciled" | "unreconciled" | "not_applicable" | "";
    reconciliationNotes: string;
    evidenceFiles: EvidenceFile[];
  };
  trendAnalysis: {
    items: TrendAnalysisEntry[];
    trendConclusion: string;
  };
  ratioAnalysis: {
    standardRatios: {
      currentRatio: number | null;
      debtToEquity: number | null;
      grossMargin: number | null;
      revenueGrowth: number | null;
      returnOnAssets: number | null;
    };
    customRatios: CustomRatio[];
    ratioConclusion: string;
  };
  budgetVsActual: {
    items: BudgetVsActualEntry[];
    budgetConclusion: string;
  };
  unusualFluctuations: {
    items: UnusualFluctuationEntry[];
    fluctuationThreshold: string;
    overallAssessment: string;
  };
  analyticalProcedures: AnalyticalProcedureEntry[];
  dataSources: string;
  overallConclusion: string;
  signOff: SignOffData;
}

export interface TrendAnalysisEntry {
  id: string;
  lineItem: string;
  currentYear: number | null;
  priorYear: number | null;
  changeAmount: number | null;
  changePercent: number | null;
  significanceFlag: boolean;
  explanation: string;
}

export interface BudgetVsActualEntry {
  id: string;
  lineItem: string;
  budgetAmount: number | null;
  actualAmount: number | null;
  varianceAmount: number | null;
  variancePercent: number | null;
  significanceFlag: boolean;
  explanation: string;
}

export interface UnusualFluctuationEntry {
  id: string;
  account: string;
  description: string;
  amount: number | null;
  percentChange: number | null;
  riskImplication: "low" | "medium" | "high" | "";
  investigationStatus: "pending" | "investigated" | "resolved" | "";
  investigationNotes: string;
}

export interface AnalyticalProcedureEntry {
  id: string;
  area: string;
  expectation: string;
  threshold: string;
  actualResult: string;
  variance: string;
  anomalyFlag: boolean;
  investigationNotes: string;
  conclusion: "no_issues" | "further_investigation" | "potential_risk" | "";
}

export interface CustomRatio {
  id: string;
  name: string;
  value: number | null;
  priorYear: number | null;
  industryBenchmark: number | null;
}

export interface AuditStrategyData {
  engagementId: string;
  overallStrategy: {
    scope: string;
    timing: string;
    direction: string;
    auditApproach: "substantive" | "combined" | "";
    approachRationale: string;
  };
  keyAreasOfFocus: KeyFocusArea[];
  resourceTimingPlan: {
    plannedHoursByPhase: PhasePlan[];
    keyDates: KeyDate[];
    specialistNeeds: string;
  };
  tcwgIdentification: TCWGMember[];
  tcwgCommunication: {
    checklist: ChecklistSection;
    plannedScopeTiming: string;
    identifiedSignificantRisks: string;
    independenceConfirmation: {
      confirmed: boolean;
      independenceStatement: string;
      threatsIdentified: string;
      safeguardsApplied: string;
    };
    materialityLevels: string;
    significantFindingsApproach: string;
    communicationSchedule: string;
    requiredEvidence: string[];
  };
  plannedCommunications: {
    scopeTimingCommunication: string;
    significantFindingsApproach: string;
    communicationSchedule: string;
  };
  planningMemoSummary: string;
  signOff: SignOffData;
}

export interface KeyFocusArea {
  id: string;
  area: string;
  riskLevel: "low" | "medium" | "high" | "";
  sourceRiskId: string;
  plannedResponse: string;
}

export interface PhasePlan {
  id: string;
  phase: string;
  plannedHours: number;
  startDate: string;
  endDate: string;
}

export interface KeyDate {
  id: string;
  description: string;
  date: string;
  responsible: string;
}

export interface TCWGMember {
  id: string;
  name: string;
  role: string;
  contact: string;
}
