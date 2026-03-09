export interface FsHeadExpectation {
  fsHeadKey: string;
  fsHeadLabel: string;
  currentYearBalance: number;
  priorYearBalance: number;
  expectedBalance: number;
  expectationBasis: string;
  expectationRationale: string;
}

export interface TrendAnalysisItem {
  id: string;
  fsHeadKey: string;
  fsHeadLabel: string;
  currentYear: number;
  priorYear: number;
  movement: number;
  movementPercentage: number;
  status: 'Expected' | 'Requires Explanation' | 'Risk-Indicative';
  materialityFlag: boolean;
  explanation?: string;
}

export interface RatioAnalysisItem {
  id: string;
  ratioName: string;
  category: 'Liquidity' | 'Profitability' | 'Leverage' | 'Efficiency' | 'Coverage';
  currentYear: number;
  priorYear: number;
  industryAverage: number | null;
  variance: number;
  status: 'Expected' | 'Requires Explanation' | 'Risk-Indicative';
  linkedFsHeads: string[];
  interpretation: string;
}

export interface SignificantFluctuation {
  id: string;
  fsHeadKey: string;
  fsHeadLabel: string;
  natureOfFluctuation: string;
  possibleCauses: string[];
  affectedAssertions: string[];
  riskImpact: 'Confirms Existing Risk' | 'Elevates Risk Rating' | 'Introduces New Risk';
  riskLevel: 'FS Level' | 'Assertion Level';
  fraudConsideration: boolean;
  significantRiskFlag: boolean;
  documentedJustification: string;
}

export interface RiskMatrixUpdate {
  fsHeadKey: string;
  assertion: string;
  previousRiskRating: 'High' | 'Medium' | 'Low';
  updatedRiskRating: 'High' | 'Medium' | 'Low';
  changeReason: string;
  analyticsReference: string;
}

export interface AuditStrategyImpact {
  fsHeadKey: string;
  fsHeadLabel: string;
  impactOnNature: string;
  impactOnTiming: 'Interim' | 'Year-End' | 'Both';
  impactOnExtent: string;
  controlsRelianceImpact: string;
  planningConclusion: string;
}

export interface PlanningAnalyticsResult {
  fsHeadExpectations: FsHeadExpectation[];
  trendAnalysis: TrendAnalysisItem[];
  ratioAnalysis: RatioAnalysisItem[];
  significantFluctuations: SignificantFluctuation[];
  riskMatrixUpdates: RiskMatrixUpdate[];
  auditStrategyImpact: AuditStrategyImpact[];
  analysisDate: string;
  totalFluctuationsIdentified: number;
  riskIndicativeCount: number;
  riskMatrixUpdatesCount: number;
}
