// Auto-generated enum definitions from Prisma schema
// Used as fallback when Prisma client generation is incomplete

export const UserRole = {
  STAFF: "STAFF",
  SENIOR: "SENIOR",
  TEAM_LEAD: "TEAM_LEAD",
  MANAGER: "MANAGER",
  MANAGING_PARTNER: "MANAGING_PARTNER",
  PARTNER: "PARTNER",
  EQCR: "EQCR",
  ADMIN: "ADMIN",
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const EngagementStatus = {
  DRAFT: "DRAFT",
  ACTIVE: "ACTIVE",
  ON_HOLD: "ON_HOLD",
  COMPLETED: "COMPLETED",
  ARCHIVED: "ARCHIVED",
} as const;
export type EngagementStatus = (typeof EngagementStatus)[keyof typeof EngagementStatus];

export const PhaseStatus = {
  NOT_STARTED: "NOT_STARTED",
  IN_PROGRESS: "IN_PROGRESS",
  UNDER_REVIEW: "UNDER_REVIEW",
  LOCKED: "LOCKED",
  COMPLETED: "COMPLETED",
} as const;
export type PhaseStatus = (typeof PhaseStatus)[keyof typeof PhaseStatus];

export const ChecklistItemStatus = {
  PENDING: "PENDING",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
  NOT_APPLICABLE: "NOT_APPLICABLE",
} as const;
export type ChecklistItemStatus = (typeof ChecklistItemStatus)[keyof typeof ChecklistItemStatus];

export const ReviewNoteStatus = {
  OPEN: "OPEN",
  ADDRESSED: "ADDRESSED",
  CLEARED: "CLEARED",
} as const;
export type ReviewNoteStatus = (typeof ReviewNoteStatus)[keyof typeof ReviewNoteStatus];

export const ReviewNoteSeverity = {
  INFO: "INFO",
  WARNING: "WARNING",
  CRITICAL: "CRITICAL",
} as const;
export type ReviewNoteSeverity = (typeof ReviewNoteSeverity)[keyof typeof ReviewNoteSeverity];

export const RiskLevel = {
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
} as const;
export type RiskLevel = (typeof RiskLevel)[keyof typeof RiskLevel];

export const AuditPhase = {
  ONBOARDING: "ONBOARDING",
  PRE_PLANNING: "PRE_PLANNING",
  REQUISITION: "REQUISITION",
  PLANNING: "PLANNING",
  EXECUTION: "EXECUTION",
  FINALIZATION: "FINALIZATION",
  REPORTING: "REPORTING",
  EQCR: "EQCR",
  INSPECTION: "INSPECTION",
} as const;
export type AuditPhase = (typeof AuditPhase)[keyof typeof AuditPhase];

export const GLBatchStatus = {
  DRAFT: "DRAFT",
  PENDING_REVIEW: "PENDING_REVIEW",
  REVIEWED: "REVIEWED",
  PENDING_APPROVAL: "PENDING_APPROVAL",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  SUPERSEDED: "SUPERSEDED",
} as const;
export type GLBatchStatus = (typeof GLBatchStatus)[keyof typeof GLBatchStatus];

export const GLValidationErrorType = {
  PERIOD_MISMATCH: "PERIOD_MISMATCH",
  DEBIT_CREDIT_IMBALANCE: "DEBIT_CREDIT_IMBALANCE",
  MISSING_ACCOUNT_CODE: "MISSING_ACCOUNT_CODE",
  INVALID_ACCOUNT_CODE: "INVALID_ACCOUNT_CODE",
  DUPLICATE_ENTRY: "DUPLICATE_ENTRY",
  MISSING_REQUIRED_FIELD: "MISSING_REQUIRED_FIELD",
  INVALID_DATE_FORMAT: "INVALID_DATE_FORMAT",
  INVALID_AMOUNT: "INVALID_AMOUNT",
  BATCH_IMBALANCE: "BATCH_IMBALANCE",
} as const;
export type GLValidationErrorType = (typeof GLValidationErrorType)[keyof typeof GLValidationErrorType];

export const GLClusterStatus = {
  SUGGESTED: "SUGGESTED",
  ACCEPTED: "ACCEPTED",
  REJECTED: "REJECTED",
  MERGED: "MERGED",
} as const;
export type GLClusterStatus = (typeof GLClusterStatus)[keyof typeof GLClusterStatus];

export const ClientRiskCategory = {
  LOW: "LOW",
  NORMAL: "NORMAL",
  HIGH: "HIGH",
  PROHIBITED: "PROHIBITED",
} as const;
export type ClientRiskCategory = (typeof ClientRiskCategory)[keyof typeof ClientRiskCategory];

export const AcceptanceStatus = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
} as const;
export type AcceptanceStatus = (typeof AcceptanceStatus)[keyof typeof AcceptanceStatus];

export const LegalForm = {
  PVT_LTD: "PVT_LTD",
  LISTED: "LISTED",
  SECTION_42: "SECTION_42",
  PARTNERSHIP: "PARTNERSHIP",
  AOP: "AOP",
  SOLE_PROPRIETOR: "SOLE_PROPRIETOR",
  TRUST: "TRUST",
  NPO: "NPO",
  GOVERNMENT: "GOVERNMENT",
  OTHER: "OTHER",
} as const;
export type LegalForm = (typeof LegalForm)[keyof typeof LegalForm];

export const ClientAcceptanceStatus = {
  DRAFT: "DRAFT",
  UNDER_REVIEW: "UNDER_REVIEW",
  ACCEPTED: "ACCEPTED",
  CONDITIONALLY_ACCEPTED: "CONDITIONALLY_ACCEPTED",
  DECLINED: "DECLINED",
} as const;
export type ClientAcceptanceStatus = (typeof ClientAcceptanceStatus)[keyof typeof ClientAcceptanceStatus];

export const OnboardingStep = {
  BASIC_INFO: "BASIC_INFO",
  OWNERSHIP_MANAGEMENT: "OWNERSHIP_MANAGEMENT",
  PRIOR_AUDITOR: "PRIOR_AUDITOR",
  AML_SCREENING: "AML_SCREENING",
  ETHICS_INDEPENDENCE: "ETHICS_INDEPENDENCE",
  REVIEW_SUBMIT: "REVIEW_SUBMIT",
} as const;
export type OnboardingStep = (typeof OnboardingStep)[keyof typeof OnboardingStep];

export const EngagementTypeEnum = {
  STATUTORY_AUDIT: "STATUTORY_AUDIT",
  REVIEW: "REVIEW",
  COMPILATION: "COMPILATION",
  AGREED_UPON_PROCEDURES: "AGREED_UPON_PROCEDURES",
  INTERNAL_AUDIT: "INTERNAL_AUDIT",
  TAX: "TAX",
  ADVISORY: "ADVISORY",
} as const;
export type EngagementTypeEnum = (typeof EngagementTypeEnum)[keyof typeof EngagementTypeEnum];

export const ReportingFramework = {
  IFRS: "IFRS",
  IFRS_SME: "IFRS_SME",
  LOCAL_GAAP: "LOCAL_GAAP",
  OTHER: "OTHER",
} as const;
export type ReportingFramework = (typeof ReportingFramework)[keyof typeof ReportingFramework];

export const AIInteractionAction = {
  ACCEPT: "ACCEPT",
  REJECT: "REJECT",
  EDIT: "EDIT",
  REGENERATE: "REGENERATE",
} as const;
export type AIInteractionAction = (typeof AIInteractionAction)[keyof typeof AIInteractionAction];

export const EnforcementPhase = {
  ADMINISTRATION: "ADMINISTRATION",
  PRE_PLANNING: "PRE_PLANNING",
  PLANNING: "PLANNING",
  EXECUTION: "EXECUTION",
  EVIDENCE: "EVIDENCE",
  FINALIZATION: "FINALIZATION",
  DELIVERABLES: "DELIVERABLES",
  QR_EQCR: "QR_EQCR",
  INSPECTION: "INSPECTION",
} as const;
export type EnforcementPhase = (typeof EnforcementPhase)[keyof typeof EnforcementPhase];

export const SignOffCategory = {
  FINANCIAL_STATEMENTS: "FINANCIAL_STATEMENTS",
  RISK_ASSESSMENT: "RISK_ASSESSMENT",
  PROCEDURE_COMPLETION: "PROCEDURE_COMPLETION",
  ADJUSTMENTS_POSTING: "ADJUSTMENTS_POSTING",
  CONCLUSIONS_OPINION: "CONCLUSIONS_OPINION",
  DELIVERABLES: "DELIVERABLES",
  QR_EQCR: "QR_EQCR",
} as const;
export type SignOffCategory = (typeof SignOffCategory)[keyof typeof SignOffCategory];

export const ThreatCategory = {
  SELF_INTEREST: "SELF_INTEREST",
  SELF_REVIEW: "SELF_REVIEW",
  ADVOCACY: "ADVOCACY",
  FAMILIARITY: "FAMILIARITY",
  INTIMIDATION: "INTIMIDATION",
} as const;
export type ThreatCategory = (typeof ThreatCategory)[keyof typeof ThreatCategory];

export const ThreatStatus = {
  IDENTIFIED: "IDENTIFIED",
  SAFEGUARDED: "SAFEGUARDED",
  UNRESOLVED: "UNRESOLVED",
  ACCEPTED: "ACCEPTED",
  ELIMINATED: "ELIMINATED",
} as const;
export type ThreatStatus = (typeof ThreatStatus)[keyof typeof ThreatStatus];

export const DeclarationStatus = {
  PENDING: "PENDING",
  CONFIRMED: "CONFIRMED",
  DECLINED: "DECLINED",
} as const;
export type DeclarationStatus = (typeof DeclarationStatus)[keyof typeof DeclarationStatus];

export const EngagementLetterStatus = {
  DRAFT: "DRAFT",
  PENDING_APPROVAL: "PENDING_APPROVAL",
  APPROVED: "APPROVED",
  SENT: "SENT",
  ACCEPTED: "ACCEPTED",
  REJECTED: "REJECTED",
} as const;
export type EngagementLetterStatus = (typeof EngagementLetterStatus)[keyof typeof EngagementLetterStatus];

export const ScreeningType = {
  AML: "AML",
  PEP: "PEP",
  SANCTIONS: "SANCTIONS",
  BLACKLIST: "BLACKLIST",
  DIRECTOR_DISQUALIFICATION: "DIRECTOR_DISQUALIFICATION",
  LITIGATION: "LITIGATION",
} as const;
export type ScreeningType = (typeof ScreeningType)[keyof typeof ScreeningType];

export const ScreeningResult = {
  CLEAR: "CLEAR",
  MATCH_FOUND: "MATCH_FOUND",
  POTENTIAL_MATCH: "POTENTIAL_MATCH",
  PENDING_REVIEW: "PENDING_REVIEW",
  FALSE_POSITIVE: "FALSE_POSITIVE",
  CONFIRMED_MATCH: "CONFIRMED_MATCH",
  NOT_SCREENED: "NOT_SCREENED",
} as const;
export type ScreeningResult = (typeof ScreeningResult)[keyof typeof ScreeningResult];

export const ConflictType = {
  FINANCIAL_INTEREST: "FINANCIAL_INTEREST",
  BUSINESS_RELATIONSHIP: "BUSINESS_RELATIONSHIP",
  FAMILY_RELATIONSHIP: "FAMILY_RELATIONSHIP",
  PRIOR_EMPLOYMENT: "PRIOR_EMPLOYMENT",
  NON_AUDIT_SERVICE: "NON_AUDIT_SERVICE",
  OTHER: "OTHER",
} as const;
export type ConflictType = (typeof ConflictType)[keyof typeof ConflictType];

export const ConflictStatus = {
  IDENTIFIED: "IDENTIFIED",
  UNDER_REVIEW: "UNDER_REVIEW",
  SAFEGUARDED: "SAFEGUARDED",
  ACCEPTED: "ACCEPTED",
  REJECTED: "REJECTED",
} as const;
export type ConflictStatus = (typeof ConflictStatus)[keyof typeof ConflictStatus];

export const MaterialityBenchmark = {
  PBT: "PBT",
  REVENUE: "REVENUE",
  TOTAL_ASSETS: "TOTAL_ASSETS",
  EQUITY: "EQUITY",
  GROSS_PROFIT: "GROSS_PROFIT",
} as const;
export type MaterialityBenchmark = (typeof MaterialityBenchmark)[keyof typeof MaterialityBenchmark];

export const RiskAssessmentLevel = {
  LOW: "LOW",
  MODERATE: "MODERATE",
  HIGH: "HIGH",
  SIGNIFICANT: "SIGNIFICANT",
} as const;
export type RiskAssessmentLevel = (typeof RiskAssessmentLevel)[keyof typeof RiskAssessmentLevel];

export const AssertionType = {
  EXISTENCE: "EXISTENCE",
  COMPLETENESS: "COMPLETENESS",
  ACCURACY: "ACCURACY",
  VALUATION: "VALUATION",
  CUTOFF: "CUTOFF",
  CLASSIFICATION: "CLASSIFICATION",
  OCCURRENCE: "OCCURRENCE",
  RIGHTS_OBLIGATIONS: "RIGHTS_OBLIGATIONS",
  PRESENTATION_DISCLOSURE: "PRESENTATION_DISCLOSURE",
} as const;
export type AssertionType = (typeof AssertionType)[keyof typeof AssertionType];

export const FSArea = {
  REVENUE: "REVENUE",
  COST_OF_SALES: "COST_OF_SALES",
  OPERATING_EXPENSES: "OPERATING_EXPENSES",
  OTHER_INCOME: "OTHER_INCOME",
  FINANCE_COSTS: "FINANCE_COSTS",
  TAXATION: "TAXATION",
  CASH_AND_BANK: "CASH_AND_BANK",
  RECEIVABLES: "RECEIVABLES",
  INVENTORIES: "INVENTORIES",
  INVESTMENTS: "INVESTMENTS",
  FIXED_ASSETS: "FIXED_ASSETS",
  INTANGIBLES: "INTANGIBLES",
  PAYABLES: "PAYABLES",
  BORROWINGS: "BORROWINGS",
  PROVISIONS: "PROVISIONS",
  EQUITY: "EQUITY",
  RELATED_PARTIES: "RELATED_PARTIES",
  CONTINGENCIES: "CONTINGENCIES",
  COMMITMENTS: "COMMITMENTS",
  EVENTS_AFTER_REPORTING: "EVENTS_AFTER_REPORTING",
} as const;
export type FSArea = (typeof FSArea)[keyof typeof FSArea];

export const AuditCycle = {
  REVENUE_CYCLE: "REVENUE_CYCLE",
  PURCHASE_CYCLE: "PURCHASE_CYCLE",
  PAYROLL_CYCLE: "PAYROLL_CYCLE",
  TREASURY_CYCLE: "TREASURY_CYCLE",
  INVENTORY_CYCLE: "INVENTORY_CYCLE",
  FIXED_ASSETS_CYCLE: "FIXED_ASSETS_CYCLE",
  INVESTMENTS_CYCLE: "INVESTMENTS_CYCLE",
  FINANCING_CYCLE: "FINANCING_CYCLE",
  TAX_CYCLE: "TAX_CYCLE",
  PERIOD_END_CYCLE: "PERIOD_END_CYCLE",
} as const;
export type AuditCycle = (typeof AuditCycle)[keyof typeof AuditCycle];

export const FraudRiskType = {
  REVENUE_RECOGNITION: "REVENUE_RECOGNITION",
  MANAGEMENT_OVERRIDE: "MANAGEMENT_OVERRIDE",
  ASSET_MISAPPROPRIATION: "ASSET_MISAPPROPRIATION",
  EXPENSE_MANIPULATION: "EXPENSE_MANIPULATION",
  RELATED_PARTY_ABUSE: "RELATED_PARTY_ABUSE",
  DISCLOSURE_FRAUD: "DISCLOSURE_FRAUD",
  OTHER: "OTHER",
} as const;
export type FraudRiskType = (typeof FraudRiskType)[keyof typeof FraudRiskType];

export const OverrideStatus = {
  PENDING: "PENDING",
  PARTNER_APPROVED: "PARTNER_APPROVED",
  EQCR_APPROVED: "EQCR_APPROVED",
  REJECTED: "REJECTED",
} as const;
export type OverrideStatus = (typeof OverrideStatus)[keyof typeof OverrideStatus];

export const GoingConcernIndicatorType = {
  FINANCIAL: "FINANCIAL",
  OPERATING: "OPERATING",
  OTHER: "OTHER",
} as const;
export type GoingConcernIndicatorType = (typeof GoingConcernIndicatorType)[keyof typeof GoingConcernIndicatorType];

export const ControlCycle = {
  REVENUE: "REVENUE",
  INVENTORY: "INVENTORY",
  PURCHASES: "PURCHASES",
  PAYROLL: "PAYROLL",
  TREASURY: "TREASURY",
  FIXED_ASSETS: "FIXED_ASSETS",
  PERIOD_END: "PERIOD_END",
  FINANCIAL_REPORTING: "FINANCIAL_REPORTING",
} as const;
export type ControlCycle = (typeof ControlCycle)[keyof typeof ControlCycle];

export const ControlFrequency = {
  CONTINUOUS: "CONTINUOUS",
  DAILY: "DAILY",
  WEEKLY: "WEEKLY",
  MONTHLY: "MONTHLY",
  QUARTERLY: "QUARTERLY",
  ANNUALLY: "ANNUALLY",
  AD_HOC: "AD_HOC",
  EACH_OCCURRENCE: "EACH_OCCURRENCE",
} as const;
export type ControlFrequency = (typeof ControlFrequency)[keyof typeof ControlFrequency];

export const ControlType = {
  PREVENTIVE: "PREVENTIVE",
  DETECTIVE: "DETECTIVE",
  CORRECTIVE: "CORRECTIVE",
} as const;
export type ControlType = (typeof ControlType)[keyof typeof ControlType];

export const ControlNature = {
  MANUAL: "MANUAL",
  AUTOMATED: "AUTOMATED",
  IT_DEPENDENT_MANUAL: "IT_DEPENDENT_MANUAL",
  IT_AUTOMATED: "IT_AUTOMATED",
  IT_DEPENDENT: "IT_DEPENDENT",
} as const;
export type ControlNature = (typeof ControlNature)[keyof typeof ControlNature];

export const ControlAssessmentResult = {
  EFFECTIVE: "EFFECTIVE",
  INEFFECTIVE: "INEFFECTIVE",
  NOT_TESTED: "NOT_TESTED",
  NOT_APPLICABLE: "NOT_APPLICABLE",
} as const;
export type ControlAssessmentResult = (typeof ControlAssessmentResult)[keyof typeof ControlAssessmentResult];

export const DeficiencySeverity = {
  DEFICIENCY: "DEFICIENCY",
  SIGNIFICANT_DEFICIENCY: "SIGNIFICANT_DEFICIENCY",
  MATERIAL_WEAKNESS: "MATERIAL_WEAKNESS",
} as const;
export type DeficiencySeverity = (typeof DeficiencySeverity)[keyof typeof DeficiencySeverity];

export const DeficiencyStatus = {
  OPEN: "OPEN",
  REMEDIATION_IN_PROGRESS: "REMEDIATION_IN_PROGRESS",
  REMEDIATED: "REMEDIATED",
  ACCEPTED: "ACCEPTED",
} as const;
export type DeficiencyStatus = (typeof DeficiencyStatus)[keyof typeof DeficiencyStatus];

export const CommunicationRecipient = {
  MANAGEMENT: "MANAGEMENT",
  TCWG: "TCWG",
  BOTH: "BOTH",
} as const;
export type CommunicationRecipient = (typeof CommunicationRecipient)[keyof typeof CommunicationRecipient];

export const SamplingMethod = {
  STATISTICAL_RANDOM: "STATISTICAL_RANDOM",
  STATISTICAL_SYSTEMATIC: "STATISTICAL_SYSTEMATIC",
  STATISTICAL_STRATIFIED: "STATISTICAL_STRATIFIED",
  MONETARY_UNIT_SAMPLING: "MONETARY_UNIT_SAMPLING",
  NON_STATISTICAL_HAPHAZARD: "NON_STATISTICAL_HAPHAZARD",
  NON_STATISTICAL_JUDGMENTAL: "NON_STATISTICAL_JUDGMENTAL",
  BLOCK_SELECTION: "BLOCK_SELECTION",
  ALL_ITEMS: "ALL_ITEMS",
} as const;
export type SamplingMethod = (typeof SamplingMethod)[keyof typeof SamplingMethod];

export const TestingType = {
  DETAIL: "DETAIL",
  ANALYTICAL: "ANALYTICAL",
  COMBINED: "COMBINED",
} as const;
export type TestingType = (typeof TestingType)[keyof typeof TestingType];

export const MisstatementType = {
  FACTUAL: "FACTUAL",
  JUDGMENTAL: "JUDGMENTAL",
  PROJECTED: "PROJECTED",
} as const;
export type MisstatementType = (typeof MisstatementType)[keyof typeof MisstatementType];

export const MisstatementStatus = {
  IDENTIFIED: "IDENTIFIED",
  ADJUSTED: "ADJUSTED",
  UNADJUSTED: "UNADJUSTED",
  WAIVED: "WAIVED",
} as const;
export type MisstatementStatus = (typeof MisstatementStatus)[keyof typeof MisstatementStatus];

export const AnalyticalType = {
  RATIO_ANALYSIS: "RATIO_ANALYSIS",
  TREND_ANALYSIS: "TREND_ANALYSIS",
  VARIANCE_ANALYSIS: "VARIANCE_ANALYSIS",
  REASONABLENESS_TEST: "REASONABLENESS_TEST",
  REGRESSION_ANALYSIS: "REGRESSION_ANALYSIS",
} as const;
export type AnalyticalType = (typeof AnalyticalType)[keyof typeof AnalyticalType];

export const VarianceStatus = {
  WITHIN_THRESHOLD: "WITHIN_THRESHOLD",
  EXCEEDS_THRESHOLD: "EXCEEDS_THRESHOLD",
  INVESTIGATED: "INVESTIGATED",
  EXPLAINED: "EXPLAINED",
  UNEXPLAINED: "UNEXPLAINED",
  ESCALATED: "ESCALATED",
} as const;
export type VarianceStatus = (typeof VarianceStatus)[keyof typeof VarianceStatus];

export const EvidenceStatus = {
  DRAFT: "DRAFT",
  ACTIVE: "ACTIVE",
  SUPERSEDED: "SUPERSEDED",
  VOIDED: "VOIDED",
} as const;
export type EvidenceStatus = (typeof EvidenceStatus)[keyof typeof EvidenceStatus];

export const SufficiencyRating = {
  INSUFFICIENT: "INSUFFICIENT",
  MARGINAL: "MARGINAL",
  ADEQUATE: "ADEQUATE",
  STRONG: "STRONG",
} as const;
export type SufficiencyRating = (typeof SufficiencyRating)[keyof typeof SufficiencyRating];

export const ReliabilityRating = {
  LOW: "LOW",
  MODERATE: "MODERATE",
  HIGH: "HIGH",
  VERY_HIGH: "VERY_HIGH",
} as const;
export type ReliabilityRating = (typeof ReliabilityRating)[keyof typeof ReliabilityRating];

export const EvidenceSourceType = {
  EXTERNAL_THIRD_PARTY: "EXTERNAL_THIRD_PARTY",
  EXTERNAL_PREPARED_BY_ENTITY: "EXTERNAL_PREPARED_BY_ENTITY",
  INTERNAL_STRONG_CONTROLS: "INTERNAL_STRONG_CONTROLS",
  INTERNAL_WEAK_CONTROLS: "INTERNAL_WEAK_CONTROLS",
  MANAGEMENT_REPRESENTATION: "MANAGEMENT_REPRESENTATION",
  AUDITOR_GENERATED: "AUDITOR_GENERATED",
} as const;
export type EvidenceSourceType = (typeof EvidenceSourceType)[keyof typeof EvidenceSourceType];

export const SubsequentEventType = {
  TYPE_1_ADJUSTING: "TYPE_1_ADJUSTING",
  TYPE_2_NON_ADJUSTING: "TYPE_2_NON_ADJUSTING",
} as const;
export type SubsequentEventType = (typeof SubsequentEventType)[keyof typeof SubsequentEventType];

export const SubsequentEventStatus = {
  IDENTIFIED: "IDENTIFIED",
  EVALUATED: "EVALUATED",
  ADJUSTED: "ADJUSTED",
  DISCLOSED: "DISCLOSED",
  RESOLVED: "RESOLVED",
} as const;
export type SubsequentEventStatus = (typeof SubsequentEventStatus)[keyof typeof SubsequentEventStatus];

export const OpinionType = {
  UNMODIFIED: "UNMODIFIED",
  QUALIFIED: "QUALIFIED",
  ADVERSE: "ADVERSE",
  DISCLAIMER: "DISCLAIMER",
} as const;
export type OpinionType = (typeof OpinionType)[keyof typeof OpinionType];

export const EQCRStatus = {
  NOT_REQUIRED: "NOT_REQUIRED",
  PENDING_ASSIGNMENT: "PENDING_ASSIGNMENT",
  ASSIGNED: "ASSIGNED",
  IN_PROGRESS: "IN_PROGRESS",
  PENDING_CLEARANCE: "PENDING_CLEARANCE",
  CLEARED: "CLEARED",
  REPORT_BLOCKED: "REPORT_BLOCKED",
} as const;
export type EQCRStatus = (typeof EQCRStatus)[keyof typeof EQCRStatus];

export const EQCRChecklistResponse = {
  YES: "YES",
  NO: "NO",
  NOT_SIGNIFICANT: "NOT_SIGNIFICANT",
} as const;
export type EQCRChecklistResponse = (typeof EQCRChecklistResponse)[keyof typeof EQCRChecklistResponse];

export const EQCRClearanceStatus = {
  CLEARED: "CLEARED",
  CLEARED_WITH_CONDITIONS: "CLEARED_WITH_CONDITIONS",
  NOT_CLEARED: "NOT_CLEARED",
} as const;
export type EQCRClearanceStatus = (typeof EQCRClearanceStatus)[keyof typeof EQCRClearanceStatus];

export const ConfirmationType = {
  POSITIVE: "POSITIVE",
  NEGATIVE: "NEGATIVE",
  BLANK: "BLANK",
} as const;
export type ConfirmationType = (typeof ConfirmationType)[keyof typeof ConfirmationType];

export const ConfirmationStatus = {
  DRAFTED: "DRAFTED",
  SENT: "SENT",
  RECEIVED: "RECEIVED",
  CONFIRMED: "CONFIRMED",
  EXCEPTION: "EXCEPTION",
  NON_RESPONSE: "NON_RESPONSE",
  ALTERNATIVE_PROCEDURE: "ALTERNATIVE_PROCEDURE",
  CANCELLED: "CANCELLED",
} as const;
export type ConfirmationStatus = (typeof ConfirmationStatus)[keyof typeof ConfirmationStatus];

export const ValuationMethod = {
  FIFO: "FIFO",
  WEIGHTED_AVERAGE: "WEIGHTED_AVERAGE",
  SPECIFIC_IDENTIFICATION: "SPECIFIC_IDENTIFICATION",
  LIFO: "LIFO",
  STANDARD_COST: "STANDARD_COST",
  RETAIL_METHOD: "RETAIL_METHOD",
} as const;
export type ValuationMethod = (typeof ValuationMethod)[keyof typeof ValuationMethod];

export const DepreciationMethod = {
  STRAIGHT_LINE: "STRAIGHT_LINE",
  DECLINING_BALANCE: "DECLINING_BALANCE",
  UNITS_OF_PRODUCTION: "UNITS_OF_PRODUCTION",
  SUM_OF_YEARS_DIGITS: "SUM_OF_YEARS_DIGITS",
  DOUBLE_DECLINING: "DOUBLE_DECLINING",
} as const;
export type DepreciationMethod = (typeof DepreciationMethod)[keyof typeof DepreciationMethod];

export const EstimateComplexity = {
  SIMPLE: "SIMPLE",
  MODERATE: "MODERATE",
  COMPLEX: "COMPLEX",
} as const;
export type EstimateComplexity = (typeof EstimateComplexity)[keyof typeof EstimateComplexity];

export const AnomalyType = {
  STATISTICAL_OUTLIER: "STATISTICAL_OUTLIER",
  BENFORD_ANOMALY: "BENFORD_ANOMALY",
  DUPLICATE_TRANSACTION: "DUPLICATE_TRANSACTION",
  ROUND_NUMBER_PATTERN: "ROUND_NUMBER_PATTERN",
  UNUSUAL_TIMING: "UNUSUAL_TIMING",
  THRESHOLD_BREACH: "THRESHOLD_BREACH",
  RELATIONSHIP_ANOMALY: "RELATIONSHIP_ANOMALY",
  PREDICTIVE_DEVIATION: "PREDICTIVE_DEVIATION",
} as const;
export type AnomalyType = (typeof AnomalyType)[keyof typeof AnomalyType];

export const AnomalySeverity = {
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  CRITICAL: "CRITICAL",
} as const;
export type AnomalySeverity = (typeof AnomalySeverity)[keyof typeof AnomalySeverity];

export const AffirmationType = {
  ANNUAL: "ANNUAL",
  ONBOARDING: "ONBOARDING",
  SPECIAL: "SPECIAL",
} as const;
export type AffirmationType = (typeof AffirmationType)[keyof typeof AffirmationType];

export const ISQMComponent = {
  GOVERNANCE: "GOVERNANCE",
  ETHICS: "ETHICS",
  CLIENT_ACCEPTANCE: "CLIENT_ACCEPTANCE",
  ENGAGEMENT_PERFORMANCE: "ENGAGEMENT_PERFORMANCE",
  RESOURCES: "RESOURCES",
  INFORMATION_COMMUNICATION: "INFORMATION_COMMUNICATION",
} as const;
export type ISQMComponent = (typeof ISQMComponent)[keyof typeof ISQMComponent];

export const QualityRiskCategory = {
  STRATEGIC: "STRATEGIC",
  OPERATIONAL: "OPERATIONAL",
  COMPLIANCE: "COMPLIANCE",
  FINANCIAL: "FINANCIAL",
} as const;
export type QualityRiskCategory = (typeof QualityRiskCategory)[keyof typeof QualityRiskCategory];

export const RiskLikelihood = {
  RARE: "RARE",
  UNLIKELY: "UNLIKELY",
  POSSIBLE: "POSSIBLE",
  LIKELY: "LIKELY",
  ALMOST_CERTAIN: "ALMOST_CERTAIN",
} as const;
export type RiskLikelihood = (typeof RiskLikelihood)[keyof typeof RiskLikelihood];

export const RiskImpact = {
  INSIGNIFICANT: "INSIGNIFICANT",
  MINOR: "MINOR",
  MODERATE: "MODERATE",
  MAJOR: "MAJOR",
  CATASTROPHIC: "CATASTROPHIC",
} as const;
export type RiskImpact = (typeof RiskImpact)[keyof typeof RiskImpact];

export const DeficiencySource = {
  MONITORING: "MONITORING",
  EQR: "EQR",
  INTERNAL_REVIEW: "INTERNAL_REVIEW",
  EXTERNAL_INSPECTION: "EXTERNAL_INSPECTION",
} as const;
export type DeficiencySource = (typeof DeficiencySource)[keyof typeof DeficiencySource];

export const DeficiencySeverityLevel = {
  SEVERE: "SEVERE",
  SIGNIFICANT: "SIGNIFICANT",
  MINOR_LEVEL: "MINOR_LEVEL",
} as const;
export type DeficiencySeverityLevel = (typeof DeficiencySeverityLevel)[keyof typeof DeficiencySeverityLevel];

export const DeficiencyPervasiveness = {
  PERVASIVE: "PERVASIVE",
  LIMITED: "LIMITED",
} as const;
export type DeficiencyPervasiveness = (typeof DeficiencyPervasiveness)[keyof typeof DeficiencyPervasiveness];

export const ActionTaken = {
  RETAINED: "RETAINED",
  RETURNED: "RETURNED",
  DONATED: "DONATED",
  SHARED: "SHARED",
} as const;
export type ActionTaken = (typeof ActionTaken)[keyof typeof ActionTaken];

export const FinancialInterestType = {
  SHARES: "SHARES",
  DEBENTURES: "DEBENTURES",
  LOANS: "LOANS",
  OTHER: "OTHER",
} as const;
export type FinancialInterestType = (typeof FinancialInterestType)[keyof typeof FinancialInterestType];

export const RelationshipType = {
  DIRECT: "DIRECT",
  INDIRECT: "INDIRECT",
  FAMILY: "FAMILY",
} as const;
export type RelationshipType = (typeof RelationshipType)[keyof typeof RelationshipType];

export const FinancialInterestStatus = {
  ACTIVE: "ACTIVE",
  DISPOSED: "DISPOSED",
  TRANSFERRED: "TRANSFERRED",
} as const;
export type FinancialInterestStatus = (typeof FinancialInterestStatus)[keyof typeof FinancialInterestStatus];

export const TrainingType = {
  TECHNICAL: "TECHNICAL",
  SOFT_SKILLS: "SOFT_SKILLS",
  ETHICS: "ETHICS",
  INDUSTRY_SPECIFIC: "INDUSTRY_SPECIFIC",
} as const;
export type TrainingType = (typeof TrainingType)[keyof typeof TrainingType];

export const CompetencyRating = {
  EXPERT: "EXPERT",
  PROFICIENT: "PROFICIENT",
  COMPETENT: "COMPETENT",
  BASIC: "BASIC",
  NONE: "NONE",
} as const;
export type CompetencyRating = (typeof CompetencyRating)[keyof typeof CompetencyRating];

export const EQRFindingType = {
  OBSERVATION: "OBSERVATION",
  RECOMMENDATION: "RECOMMENDATION",
  DEFICIENCY: "DEFICIENCY",
} as const;
export type EQRFindingType = (typeof EQRFindingType)[keyof typeof EQRFindingType];

export const EQRFindingSeverity = {
  CRITICAL: "CRITICAL",
  MAJOR: "MAJOR",
  MINOR_SEVERITY: "MINOR_SEVERITY",
} as const;
export type EQRFindingSeverity = (typeof EQRFindingSeverity)[keyof typeof EQRFindingSeverity];

export const InspectionRating = {
  SATISFACTORY: "SATISFACTORY",
  NEEDS_IMPROVEMENT: "NEEDS_IMPROVEMENT",
  UNSATISFACTORY: "UNSATISFACTORY",
} as const;
export type InspectionRating = (typeof InspectionRating)[keyof typeof InspectionRating];

export const PermissionCategory = {
  SYSTEM: "SYSTEM",
  ENGAGEMENT: "ENGAGEMENT",
  CLIENT: "CLIENT",
  PLANNING: "PLANNING",
  EXECUTION: "EXECUTION",
  FINALIZATION: "FINALIZATION",
  QUALITY_CONTROL: "QUALITY_CONTROL",
  REPORTING: "REPORTING",
  ADMINISTRATION: "ADMINISTRATION",
} as const;
export type PermissionCategory = (typeof PermissionCategory)[keyof typeof PermissionCategory];

export const ProcedureCategory = {
  PRE_PLANNING: "PRE_PLANNING",
  PLANNING: "PLANNING",
  EXECUTION: "EXECUTION",
  FINALIZATION: "FINALIZATION",
  QUALITY_REVIEW: "QUALITY_REVIEW",
} as const;
export type ProcedureCategory = (typeof ProcedureCategory)[keyof typeof ProcedureCategory];

export const ProcedureType = {
  CHECKLIST: "CHECKLIST",
  TEST_OF_CONTROL: "TEST_OF_CONTROL",
  SUBSTANTIVE_ANALYTICAL: "SUBSTANTIVE_ANALYTICAL",
  TEST_OF_DETAILS: "TEST_OF_DETAILS",
  WALKTHROUGH: "WALKTHROUGH",
  INQUIRY: "INQUIRY",
  OBSERVATION: "OBSERVATION",
  INSPECTION: "INSPECTION",
  CONFIRMATION: "CONFIRMATION",
  RECALCULATION: "RECALCULATION",
  REPERFORMANCE: "REPERFORMANCE",
} as const;
export type ProcedureType = (typeof ProcedureType)[keyof typeof ProcedureType];

export const JournalEntryType = {
  STANDARD: "STANDARD",
  MANUAL: "MANUAL",
  PERIOD_END: "PERIOD_END",
  POST_CLOSING: "POST_CLOSING",
  THIRTEENTH_MONTH: "THIRTEENTH_MONTH",
  REVERSING: "REVERSING",
  ADJUSTMENT: "ADJUSTMENT",
  OVERRIDE: "OVERRIDE",
} as const;
export type JournalEntryType = (typeof JournalEntryType)[keyof typeof JournalEntryType];

export const JournalTestStatus = {
  PENDING: "PENDING",
  IN_PROGRESS: "IN_PROGRESS",
  TESTED_SATISFACTORY: "TESTED_SATISFACTORY",
  TESTED_EXCEPTION: "TESTED_EXCEPTION",
  REVIEWED: "REVIEWED",
  APPROVED: "APPROVED",
} as const;
export type JournalTestStatus = (typeof JournalTestStatus)[keyof typeof JournalTestStatus];

export const AdjustmentType = {
  CORRECTED: "CORRECTED",
  UNCORRECTED: "UNCORRECTED",
  RECLASSIFICATION: "RECLASSIFICATION",
  DISCLOSURE: "DISCLOSURE",
} as const;
export type AdjustmentType = (typeof AdjustmentType)[keyof typeof AdjustmentType];

export const AdjustmentStatus = {
  IDENTIFIED: "IDENTIFIED",
  PROPOSED: "PROPOSED",
  AGREED_POSTED: "AGREED_POSTED",
  AGREED_NOT_POSTED: "AGREED_NOT_POSTED",
  DISPUTED: "DISPUTED",
  WAIVED: "WAIVED",
} as const;
export type AdjustmentStatus = (typeof AdjustmentStatus)[keyof typeof AdjustmentStatus];

export const DeliverableType = {
  AUDIT_REPORT: "AUDIT_REPORT",
  MANAGEMENT_LETTER: "MANAGEMENT_LETTER",
  ENGAGEMENT_SUMMARY: "ENGAGEMENT_SUMMARY",
  TIME_SUMMARY: "TIME_SUMMARY",
  OTHER: "OTHER",
} as const;
export type DeliverableType = (typeof DeliverableType)[keyof typeof DeliverableType];

export const DeliverableOpinionType = {
  UNMODIFIED: "UNMODIFIED",
  QUALIFIED: "QUALIFIED",
  ADVERSE: "ADVERSE",
  DISCLAIMER: "DISCLAIMER",
  NOT_APPLICABLE: "NOT_APPLICABLE",
} as const;
export type DeliverableOpinionType = (typeof DeliverableOpinionType)[keyof typeof DeliverableOpinionType];

export const DeliverableStatus = {
  DRAFT: "DRAFT",
  FINAL: "FINAL",
  ISSUED: "ISSUED",
} as const;
export type DeliverableStatus = (typeof DeliverableStatus)[keyof typeof DeliverableStatus];

export const SignOffType = {
  ENGAGEMENT_ACCEPTANCE: "ENGAGEMENT_ACCEPTANCE",
  ENGAGEMENT_CONTINUANCE: "ENGAGEMENT_CONTINUANCE",
  INDEPENDENCE_CLEARANCE: "INDEPENDENCE_CLEARANCE",
  ENGAGEMENT_LETTER_APPROVAL: "ENGAGEMENT_LETTER_APPROVAL",
  PLANNING_APPROVAL: "PLANNING_APPROVAL",
  RISK_ASSESSMENT_APPROVAL: "RISK_ASSESSMENT_APPROVAL",
  MATERIALITY_APPROVAL: "MATERIALITY_APPROVAL",
  AUDIT_STRATEGY_APPROVAL: "AUDIT_STRATEGY_APPROVAL",
  EXECUTION_APPROVAL: "EXECUTION_APPROVAL",
  CONTROLS_TESTING_APPROVAL: "CONTROLS_TESTING_APPROVAL",
  SUBSTANTIVE_TESTING_APPROVAL: "SUBSTANTIVE_TESTING_APPROVAL",
  FINALIZATION_APPROVAL: "FINALIZATION_APPROVAL",
  GOING_CONCERN_APPROVAL: "GOING_CONCERN_APPROVAL",
  SUBSEQUENT_EVENTS_CLEARANCE: "SUBSEQUENT_EVENTS_CLEARANCE",
  WRITTEN_REPRESENTATIONS_APPROVAL: "WRITTEN_REPRESENTATIONS_APPROVAL",
  EQCR_CLEARANCE: "EQCR_CLEARANCE",
  REPORT_APPROVAL: "REPORT_APPROVAL",
  REPORT_ISSUANCE: "REPORT_ISSUANCE",
  FILE_ASSEMBLY_APPROVAL: "FILE_ASSEMBLY_APPROVAL",
  ARCHIVAL_APPROVAL: "ARCHIVAL_APPROVAL",
} as const;
export type SignOffType = (typeof SignOffType)[keyof typeof SignOffType];

export const SignOffStatus = {
  REQUIRED: "REQUIRED",
  PENDING_REVIEW: "PENDING_REVIEW",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  WAIVED: "WAIVED",
} as const;
export type SignOffStatus = (typeof SignOffStatus)[keyof typeof SignOffStatus];

export const PDFType = {
  WITH_ATTACHMENTS: "WITH_ATTACHMENTS",
  WITHOUT_ATTACHMENTS: "WITHOUT_ATTACHMENTS",
} as const;
export type PDFType = (typeof PDFType)[keyof typeof PDFType];

export const ContactType = {
  PRIMARY: "PRIMARY",
  FINANCIAL: "FINANCIAL",
  ACCOUNTANT: "ACCOUNTANT",
  DIRECTOR: "DIRECTOR",
  GENERAL: "GENERAL",
} as const;
export type ContactType = (typeof ContactType)[keyof typeof ContactType];

export const InformationRequestStatus = {
  PENDING: "PENDING",
  IN_PROGRESS: "IN_PROGRESS",
  SUBMITTED: "SUBMITTED",
  UNDER_REVIEW: "UNDER_REVIEW",
  COMPLETED: "COMPLETED",
  REJECTED: "REJECTED",
} as const;
export type InformationRequestStatus = (typeof InformationRequestStatus)[keyof typeof InformationRequestStatus];

export const ProvidedStatus = {
  YES: "YES",
  NO: "NO",
} as const;
export type ProvidedStatus = (typeof ProvidedStatus)[keyof typeof ProvidedStatus];

export const RequestPriority = {
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  URGENT: "URGENT",
} as const;
export type RequestPriority = (typeof RequestPriority)[keyof typeof RequestPriority];

export const HeadOfAccounts = {
  CORPORATE_DOCUMENTS: "CORPORATE_DOCUMENTS",
  FINANCIAL_STATEMENTS: "FINANCIAL_STATEMENTS",
  BANK_INFORMATION: "BANK_INFORMATION",
  FIXED_ASSETS: "FIXED_ASSETS",
  INVENTORY: "INVENTORY",
  RECEIVABLES: "RECEIVABLES",
  PAYABLES: "PAYABLES",
  LOANS_BORROWINGS: "LOANS_BORROWINGS",
  EQUITY: "EQUITY",
  REVENUE: "REVENUE",
  COST_OF_SALES: "COST_OF_SALES",
  OPERATING_EXPENSES: "OPERATING_EXPENSES",
  TAXATION: "TAXATION",
  PAYROLL: "PAYROLL",
  RELATED_PARTY: "RELATED_PARTY",
  LEGAL_MATTERS: "LEGAL_MATTERS",
  INSURANCE: "INSURANCE",
  LEASES: "LEASES",
  INVESTMENTS: "INVESTMENTS",
  OTHER: "OTHER",
} as const;
export type HeadOfAccounts = (typeof HeadOfAccounts)[keyof typeof HeadOfAccounts];

export const FinancialStatementCategory = {
  BALANCE_SHEET: "BALANCE_SHEET",
  INCOME_STATEMENT: "INCOME_STATEMENT",
  CASH_FLOW: "CASH_FLOW",
  EQUITY_CHANGES: "EQUITY_CHANGES",
  NOTES: "NOTES",
  OTHER: "OTHER",
} as const;
export type FinancialStatementCategory = (typeof FinancialStatementCategory)[keyof typeof FinancialStatementCategory];

export const AuditAssertion = {
  EXISTENCE: "EXISTENCE",
  COMPLETENESS: "COMPLETENESS",
  VALUATION: "VALUATION",
  RIGHTS_OBLIGATIONS: "RIGHTS_OBLIGATIONS",
  PRESENTATION: "PRESENTATION",
  ACCURACY: "ACCURACY",
  CUTOFF: "CUTOFF",
  CLASSIFICATION: "CLASSIFICATION",
} as const;
export type AuditAssertion = (typeof AuditAssertion)[keyof typeof AuditAssertion];

export const AIAssistanceType = {
  GUIDANCE: "GUIDANCE",
  COMPLETENESS_CHECK: "COMPLETENESS_CHECK",
  FORMAT_VALIDATION: "FORMAT_VALIDATION",
  DOCUMENT_ANALYSIS: "DOCUMENT_ANALYSIS",
  RESPONSE_SUGGESTION: "RESPONSE_SUGGESTION",
} as const;
export type AIAssistanceType = (typeof AIAssistanceType)[keyof typeof AIAssistanceType];

export const SettingScope = {
  FIRM: "FIRM",
  ENGAGEMENT: "ENGAGEMENT",
  USER: "USER",
} as const;
export type SettingScope = (typeof SettingScope)[keyof typeof SettingScope];

export const MakerCheckerMode = {
  DISABLED: "DISABLED",
  TWO_TIER: "TWO_TIER",
  THREE_TIER: "THREE_TIER",
  CUSTOM: "CUSTOM",
} as const;
export type MakerCheckerMode = (typeof MakerCheckerMode)[keyof typeof MakerCheckerMode];

export const DataHubEntityType = {
  LEDGER: "LEDGER",
  TRIAL_BALANCE: "TRIAL_BALANCE",
  FINANCIAL_STATEMENTS: "FINANCIAL_STATEMENTS",
  RISK_ASSESSMENT: "RISK_ASSESSMENT",
  AUDIT_PROCEDURE: "AUDIT_PROCEDURE",
  ADJUSTMENT: "ADJUSTMENT",
  EVIDENCE: "EVIDENCE",
  SIGNOFF: "SIGNOFF",
  PDF_PACK: "PDF_PACK",
} as const;
export type DataHubEntityType = (typeof DataHubEntityType)[keyof typeof DataHubEntityType];

export const DataHubVersionStatus = {
  DRAFT: "DRAFT",
  PENDING_REVIEW: "PENDING_REVIEW",
  PENDING_APPROVAL: "PENDING_APPROVAL",
  APPROVED: "APPROVED",
  SUPERSEDED: "SUPERSEDED",
  REJECTED: "REJECTED",
} as const;
export type DataHubVersionStatus = (typeof DataHubVersionStatus)[keyof typeof DataHubVersionStatus];

export const PrePlanningGateType = {
  CLIENT_ACCEPTANCE: "CLIENT_ACCEPTANCE",
  CLIENT_CONTINUANCE: "CLIENT_CONTINUANCE",
  INDEPENDENCE_CONFIRMATION: "INDEPENDENCE_CONFIRMATION",
  ETHICS_COMPLIANCE: "ETHICS_COMPLIANCE",
  ENGAGEMENT_LETTER: "ENGAGEMENT_LETTER",
  TEAM_ALLOCATION: "TEAM_ALLOCATION",
  PARTNER_SIGNOFF: "PARTNER_SIGNOFF",
  MANAGER_REVIEW: "MANAGER_REVIEW",
} as const;
export type PrePlanningGateType = (typeof PrePlanningGateType)[keyof typeof PrePlanningGateType];

export const PrePlanningGateStatus = {
  NOT_STARTED: "NOT_STARTED",
  IN_PROGRESS: "IN_PROGRESS",
  PENDING_REVIEW: "PENDING_REVIEW",
  PENDING_SIGNOFF: "PENDING_SIGNOFF",
  COMPLETED: "COMPLETED",
  BLOCKED: "BLOCKED",
} as const;
export type PrePlanningGateStatus = (typeof PrePlanningGateStatus)[keyof typeof PrePlanningGateStatus];

export const SamplingRunStatus = {
  DRAFT: "DRAFT",
  COMPLETED: "COMPLETED",
  ARCHIVED: "ARCHIVED",
} as const;
export type SamplingRunStatus = (typeof SamplingRunStatus)[keyof typeof SamplingRunStatus];

export const CoAMapStatus = {
  AUTO: "AUTO",
  OVERRIDDEN: "OVERRIDDEN",
  UNMAPPED: "UNMAPPED",
  CONFIRMED: "CONFIRMED",
} as const;
export type CoAMapStatus = (typeof CoAMapStatus)[keyof typeof CoAMapStatus];

export const StatementType = {
  BS: "BS",
  PL: "PL",
  CF: "CF",
  SOCE: "SOCE",
} as const;
export type StatementType = (typeof StatementType)[keyof typeof StatementType];

export const CoAAccountNature = {
  DR: "DR",
  CR: "CR",
} as const;
export type CoAAccountNature = (typeof CoAAccountNature)[keyof typeof CoAAccountNature];

export const MappingSessionStatus = {
  DRAFT: "DRAFT",
  IN_PROGRESS: "IN_PROGRESS",
  BALANCED: "BALANCED",
  DIFFERENCES_ACKNOWLEDGED: "DIFFERENCES_ACKNOWLEDGED",
  PENDING_REVIEW: "PENDING_REVIEW",
  REVIEWED: "REVIEWED",
  PENDING_APPROVAL: "PENDING_APPROVAL",
  APPROVED: "APPROVED",
  LOCKED: "LOCKED",
} as const;
export type MappingSessionStatus = (typeof MappingSessionStatus)[keyof typeof MappingSessionStatus];

export const ReconciliationMatchStatus = {
  MATCHED: "MATCHED",
  DIFFERENCE: "DIFFERENCE",
  MISSING_IN_GL: "MISSING_IN_GL",
  MISSING_IN_TB: "MISSING_IN_TB",
  MANUAL_MATCH: "MANUAL_MATCH",
  EXCLUDED: "EXCLUDED",
} as const;
export type ReconciliationMatchStatus = (typeof ReconciliationMatchStatus)[keyof typeof ReconciliationMatchStatus];

export const FSGenerationStatus = {
  DRAFT: "DRAFT",
  PENDING_REVIEW: "PENDING_REVIEW",
  REVIEWED: "REVIEWED",
  APPROVED: "APPROVED",
  LOCKED: "LOCKED",
} as const;
export type FSGenerationStatus = (typeof FSGenerationStatus)[keyof typeof FSGenerationStatus];

export const TBSourceType = {
  DERIVED_FROM_GL: "DERIVED_FROM_GL",
  CLIENT_PROVIDED: "CLIENT_PROVIDED",
} as const;
export type TBSourceType = (typeof TBSourceType)[keyof typeof TBSourceType];

export const TBBatchStatus = {
  DRAFT: "DRAFT",
  PENDING_REVIEW: "PENDING_REVIEW",
  REVIEWED: "REVIEWED",
  PENDING_APPROVAL: "PENDING_APPROVAL",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  SUPERSEDED: "SUPERSEDED",
} as const;
export type TBBatchStatus = (typeof TBBatchStatus)[keyof typeof TBBatchStatus];

export const TBReconciliationStatus = {
  NOT_REQUIRED: "NOT_REQUIRED",
  PENDING: "PENDING",
  IN_PROGRESS: "IN_PROGRESS",
  VARIANCE_FLAGGED: "VARIANCE_FLAGGED",
  RECONCILED: "RECONCILED",
  APPROVED: "APPROVED",
} as const;
export type TBReconciliationStatus = (typeof TBReconciliationStatus)[keyof typeof TBReconciliationStatus];

export const FSType = {
  BALANCE_SHEET: "BALANCE_SHEET",
  INCOME_STATEMENT: "INCOME_STATEMENT",
  CASH_FLOW: "CASH_FLOW",
  EQUITY_CHANGES: "EQUITY_CHANGES",
  NOTES: "NOTES",
} as const;
export type FSType = (typeof FSType)[keyof typeof FSType];

export const FSCaptionType = {
  HEADING: "HEADING",
  SUB_HEADING: "SUB_HEADING",
  LINE_ITEM: "LINE_ITEM",
  SUB_TOTAL: "SUB_TOTAL",
  TOTAL: "TOTAL",
  GRAND_TOTAL: "GRAND_TOTAL",
} as const;
export type FSCaptionType = (typeof FSCaptionType)[keyof typeof FSCaptionType];

export const FSMappingStatus = {
  DRAFT: "DRAFT",
  PENDING_REVIEW: "PENDING_REVIEW",
  REVIEWED: "REVIEWED",
  PENDING_APPROVAL: "PENDING_APPROVAL",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
} as const;
export type FSMappingStatus = (typeof FSMappingStatus)[keyof typeof FSMappingStatus];

export const FSMappingDecisionType = {
  ACCEPT: "ACCEPT",
  MODIFY: "MODIFY",
  REJECT: "REJECT",
  SPLIT: "SPLIT",
  REGROUP: "REGROUP",
} as const;
export type FSMappingDecisionType = (typeof FSMappingDecisionType)[keyof typeof FSMappingDecisionType];

export const FSSnapshotStatus = {
  DRAFT: "DRAFT",
  LOCKED: "LOCKED",
  SUPERSEDED: "SUPERSEDED",
} as const;
export type FSSnapshotStatus = (typeof FSSnapshotStatus)[keyof typeof FSSnapshotStatus];

export const MaterialityBenchmarkType = {
  REVENUE: "REVENUE",
  TOTAL_ASSETS: "TOTAL_ASSETS",
  PROFIT_BEFORE_TAX: "PROFIT_BEFORE_TAX",
  GROSS_PROFIT: "GROSS_PROFIT",
  TOTAL_EQUITY: "TOTAL_EQUITY",
  TOTAL_EXPENSES: "TOTAL_EXPENSES",
  CUSTOM: "CUSTOM",
} as const;
export type MaterialityBenchmarkType = (typeof MaterialityBenchmarkType)[keyof typeof MaterialityBenchmarkType];

export const MaterialityStatus = {
  DRAFT: "DRAFT",
  PENDING_REVIEW: "PENDING_REVIEW",
  REVIEWED: "REVIEWED",
  PENDING_APPROVAL: "PENDING_APPROVAL",
  APPROVED: "APPROVED",
  SUPERSEDED: "SUPERSEDED",
} as const;
export type MaterialityStatus = (typeof MaterialityStatus)[keyof typeof MaterialityStatus];

export const QCRStandardSource = {
  ISA: "ISA",
  ISQM_1: "ISQM_1",
  ICAP: "ICAP",
  AOB: "AOB",
  SECP: "SECP",
} as const;
export type QCRStandardSource = (typeof QCRStandardSource)[keyof typeof QCRStandardSource];

export const QCRInspectionType = {
  INTERNAL: "INTERNAL",
  ICAP_QCR: "ICAP_QCR",
  AOB_INSPECTION: "AOB_INSPECTION",
  SECP_REVIEW: "SECP_REVIEW",
} as const;
export type QCRInspectionType = (typeof QCRInspectionType)[keyof typeof QCRInspectionType];

export const QCRVerdict = {
  PASS: "PASS",
  CONDITIONAL: "CONDITIONAL",
  FAIL: "FAIL",
} as const;
export type QCRVerdict = (typeof QCRVerdict)[keyof typeof QCRVerdict];

export const QCRComplianceStatus = {
  COMPLIANT: "COMPLIANT",
  NON_COMPLIANT: "NON_COMPLIANT",
  PARTIAL: "PARTIAL",
  NOT_APPLICABLE: "NOT_APPLICABLE",
  PENDING: "PENDING",
} as const;
export type QCRComplianceStatus = (typeof QCRComplianceStatus)[keyof typeof QCRComplianceStatus];

export const QCRSeverity = {
  CRITICAL: "CRITICAL",
  HIGH: "HIGH",
  MEDIUM: "MEDIUM",
  LOW: "LOW",
} as const;
export type QCRSeverity = (typeof QCRSeverity)[keyof typeof QCRSeverity];

export const QCRRemediationType = {
  WORKING_PAPER: "WORKING_PAPER",
  PROCESS: "PROCESS",
  TRAINING: "TRAINING",
  SYSTEM: "SYSTEM",
  POLICY: "POLICY",
} as const;
export type QCRRemediationType = (typeof QCRRemediationType)[keyof typeof QCRRemediationType];

export const QCRRemediationStatus = {
  OPEN: "OPEN",
  IN_PROGRESS: "IN_PROGRESS",
  FIXED: "FIXED",
  VERIFIED: "VERIFIED",
  OVERDUE: "OVERDUE",
} as const;
export type QCRRemediationStatus = (typeof QCRRemediationStatus)[keyof typeof QCRRemediationStatus];

export const QCRRootCause = {
  DESIGN: "DESIGN",
  EXECUTION: "EXECUTION",
  REVIEW: "REVIEW",
  RESOURCE: "RESOURCE",
  TRAINING: "TRAINING",
  SYSTEM: "SYSTEM",
} as const;
export type QCRRootCause = (typeof QCRRootCause)[keyof typeof QCRRootCause];

export const AISuggestionStatus = {
  AI_SUGGESTED: "AI_SUGGESTED",
  USER_OVERRIDE: "USER_OVERRIDE",
  MANUAL: "MANUAL",
  REVERTED: "REVERTED",
} as const;
export type AISuggestionStatus = (typeof AISuggestionStatus)[keyof typeof AISuggestionStatus];

export const WorkingPaperStatus = {
  DRAFT: "DRAFT",
  IN_PROGRESS: "IN_PROGRESS",
  PREPARED: "PREPARED",
  REVIEWED: "REVIEWED",
  APPROVED: "APPROVED",
  LOCKED: "LOCKED",
} as const;
export type WorkingPaperStatus = (typeof WorkingPaperStatus)[keyof typeof WorkingPaperStatus];

export const FieldInstanceStatus = {
  MISSING: "MISSING",
  POPULATED: "POPULATED",
  OVERRIDDEN: "OVERRIDDEN",
  LOCKED: "LOCKED",
  NOT_APPLICABLE: "NOT_APPLICABLE",
} as const;
export type FieldInstanceStatus = (typeof FieldInstanceStatus)[keyof typeof FieldInstanceStatus];

export const FieldDataSource = {
  SYSTEM: "SYSTEM",
  TB_UPLOAD: "TB_UPLOAD",
  GL_UPLOAD: "GL_UPLOAD",
  MAPPING: "MAPPING",
  USER_INPUT: "USER_INPUT",
  PUSH_ROUTER: "PUSH_ROUTER",
} as const;
export type FieldDataSource = (typeof FieldDataSource)[keyof typeof FieldDataSource];

export const SignOffLevel = {
  NONE: "NONE",
  PREPARED: "PREPARED",
  REVIEWED: "REVIEWED",
  APPROVED: "APPROVED",
} as const;
export type SignOffLevel = (typeof SignOffLevel)[keyof typeof SignOffLevel];

export const FieldScopeType = {
  ENGAGEMENT: "ENGAGEMENT",
  FS_HEAD: "FS_HEAD",
  PROCEDURE: "PROCEDURE",
  CONFIRMATION: "CONFIRMATION",
} as const;
export type FieldScopeType = (typeof FieldScopeType)[keyof typeof FieldScopeType];

export const FetchRuleSourceType = {
  SQL: "SQL",
  SERVICE: "SERVICE",
  COMPUTED: "COMPUTED",
} as const;
export type FetchRuleSourceType = (typeof FetchRuleSourceType)[keyof typeof FetchRuleSourceType];

export const FetchRefreshPolicy = {
  ON_IMPORT: "ON_IMPORT",
  ON_OPEN: "ON_OPEN",
  MANUAL: "MANUAL",
  SCHEDULED: "SCHEDULED",
} as const;
export type FetchRefreshPolicy = (typeof FetchRefreshPolicy)[keyof typeof FetchRefreshPolicy];

export const ImportBatchStatus = {
  UPLOADED: "UPLOADED",
  VALIDATING: "VALIDATING",
  FAILED: "FAILED",
  READY: "READY",
  SUBMITTED: "SUBMITTED",
  APPROVED: "APPROVED",
  POSTED: "POSTED",
  LOCKED: "LOCKED",
} as const;
export type ImportBatchStatus = (typeof ImportBatchStatus)[keyof typeof ImportBatchStatus];

export const ImportIssueSeverity = {
  ERROR: "ERROR",
  WARN: "WARN",
  INFO: "INFO",
} as const;
export type ImportIssueSeverity = (typeof ImportIssueSeverity)[keyof typeof ImportIssueSeverity];

export const ImportRecordType = {
  GL_LINE: "GL_LINE",
  OB_ACCOUNT: "OB_ACCOUNT",
  CB_ACCOUNT: "CB_ACCOUNT",
  OB_PARTY: "OB_PARTY",
  CB_PARTY: "CB_PARTY",
  BANK_MASTER: "BANK_MASTER",
  CB_BANK: "CB_BANK",
} as const;
export type ImportRecordType = (typeof ImportRecordType)[keyof typeof ImportRecordType];

export const UploadVersionStatus = {
  ACTIVE: "ACTIVE",
  SUPERSEDED: "SUPERSEDED",
  DELETED: "DELETED",
} as const;
export type UploadVersionStatus = (typeof UploadVersionStatus)[keyof typeof UploadVersionStatus];

export const ValidationStatus = {
  PASS: "PASS",
  FAIL: "FAIL",
  WARNING: "WARNING",
  NOT_RUN: "NOT_RUN",
} as const;
export type ValidationStatus = (typeof ValidationStatus)[keyof typeof ValidationStatus];

export const ExceptionSeverity = {
  CRITICAL: "CRITICAL",
  ERROR: "ERROR",
  WARNING: "WARNING",
  INFO: "INFO",
} as const;
export type ExceptionSeverity = (typeof ExceptionSeverity)[keyof typeof ExceptionSeverity];

export const ExceptionDataset = {
  TB: "TB",
  GL: "GL",
  AP: "AP",
  AR: "AR",
  BANK: "BANK",
  PARTY: "PARTY",
  RECONCILIATION: "RECONCILIATION",
} as const;
export type ExceptionDataset = (typeof ExceptionDataset)[keyof typeof ExceptionDataset];

export const DataEditDataset = {
  TB: "TB",
  GL: "GL",
  AP: "AP",
  AR: "AR",
  BANK: "BANK",
  PARTY: "PARTY",
  OPEN_ITEM: "OPEN_ITEM",
  OTHER: "OTHER",
} as const;
export type DataEditDataset = (typeof DataEditDataset)[keyof typeof DataEditDataset];

export const DataEditOperation = {
  UPDATE: "UPDATE",
  INSERT: "INSERT",
  DELETE: "DELETE",
} as const;
export type DataEditOperation = (typeof DataEditOperation)[keyof typeof DataEditOperation];

export const PopulationSourceType = {
  GL_JOURNAL: "GL_JOURNAL",
  TB_LINE: "TB_LINE",
  SUBLEDGER: "SUBLEDGER",
  CONFIRMATION_AR: "CONFIRMATION_AR",
  CONFIRMATION_AP: "CONFIRMATION_AP",
  CONFIRMATION_BANK: "CONFIRMATION_BANK",
  PARTY_BALANCE: "PARTY_BALANCE",
  BANK_BALANCE: "BANK_BALANCE",
  CUSTOM: "CUSTOM",
} as const;
export type PopulationSourceType = (typeof PopulationSourceType)[keyof typeof PopulationSourceType];

export const PopulationStatus = {
  DRAFT: "DRAFT",
  BUILT: "BUILT",
  VALIDATED: "VALIDATED",
  SAMPLED: "SAMPLED",
  COMPLETED: "COMPLETED",
} as const;
export type PopulationStatus = (typeof PopulationStatus)[keyof typeof PopulationStatus];

export const ObservationType = {
  MISSTATEMENT: "MISSTATEMENT",
  CONTROL_DEFICIENCY: "CONTROL_DEFICIENCY",
  MATERIAL_WEAKNESS: "MATERIAL_WEAKNESS",
  SIGNIFICANT_DEFICIENCY: "SIGNIFICANT_DEFICIENCY",
  OTHER: "OTHER",
} as const;
export type ObservationType = (typeof ObservationType)[keyof typeof ObservationType];

export const ObservationStatus = {
  OPEN: "OPEN",
  UNDER_REVIEW: "UNDER_REVIEW",
  PENDING_CLEARANCE: "PENDING_CLEARANCE",
  CLEARED: "CLEARED",
  WAIVED: "WAIVED",
  CLOSED: "CLOSED",
} as const;
export type ObservationStatus = (typeof ObservationStatus)[keyof typeof ObservationStatus];

export const ObservationSeverity = {
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  CRITICAL: "CRITICAL",
} as const;
export type ObservationSeverity = (typeof ObservationSeverity)[keyof typeof ObservationSeverity];

export const MappingVersionStatus = {
  DRAFT: "DRAFT",
  SUBMITTED: "SUBMITTED",
  UNDER_REVIEW: "UNDER_REVIEW",
  APPROVED: "APPROVED",
  LOCKED: "LOCKED",
  SUPERSEDED: "SUPERSEDED",
} as const;
export type MappingVersionStatus = (typeof MappingVersionStatus)[keyof typeof MappingVersionStatus];

export const ImpactSeverity = {
  INFO: "INFO",
  WARNING: "WARNING",
  CRITICAL: "CRITICAL",
} as const;
export type ImpactSeverity = (typeof ImpactSeverity)[keyof typeof ImpactSeverity];

export const ImpactStatus = {
  PENDING: "PENDING",
  ACKNOWLEDGED: "ACKNOWLEDGED",
  RECOMPUTED: "RECOMPUTED",
  IGNORED: "IGNORED",
} as const;
export type ImpactStatus = (typeof ImpactStatus)[keyof typeof ImpactStatus];

export const MaterialitySetStatus = {
  DRAFT: "DRAFT",
  PENDING_REVIEW: "PENDING_REVIEW",
  PENDING_APPROVAL: "PENDING_APPROVAL",
  APPROVED: "APPROVED",
  LOCKED: "LOCKED",
  SUPERSEDED: "SUPERSEDED",
} as const;
export type MaterialitySetStatus = (typeof MaterialitySetStatus)[keyof typeof MaterialitySetStatus];

export const AuditApproachType = {
  SUBSTANTIVE_ONLY: "SUBSTANTIVE_ONLY",
  CONTROLS_AND_SUBSTANTIVE: "CONTROLS_AND_SUBSTANTIVE",
  COMBINED: "COMBINED",
} as const;
export type AuditApproachType = (typeof AuditApproachType)[keyof typeof AuditApproachType];

export const AuditTimingType = {
  INTERIM: "INTERIM",
  FINAL: "FINAL",
  BOTH: "BOTH",
} as const;
export type AuditTimingType = (typeof AuditTimingType)[keyof typeof AuditTimingType];

export const AuditPlanStatus = {
  DRAFT: "DRAFT",
  PENDING_REVIEW: "PENDING_REVIEW",
  PENDING_APPROVAL: "PENDING_APPROVAL",
  APPROVED: "APPROVED",
  LOCKED: "LOCKED",
} as const;
export type AuditPlanStatus = (typeof AuditPlanStatus)[keyof typeof AuditPlanStatus];

export const MatrixProcedureType = {
  TEST_OF_DETAILS: "TEST_OF_DETAILS",
  TEST_OF_CONTROLS: "TEST_OF_CONTROLS",
  ANALYTICAL_PROCEDURE: "ANALYTICAL_PROCEDURE",
  INQUIRY: "INQUIRY",
  OBSERVATION: "OBSERVATION",
  INSPECTION: "INSPECTION",
  RECALCULATION: "RECALCULATION",
  REPERFORMANCE: "REPERFORMANCE",
  CONFIRMATION: "CONFIRMATION",
} as const;
export type MatrixProcedureType = (typeof MatrixProcedureType)[keyof typeof MatrixProcedureType];

export const ProcedureStatus = {
  PLANNED: "PLANNED",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
  REVIEWED: "REVIEWED",
  APPROVED: "APPROVED",
  NOT_APPLICABLE: "NOT_APPLICABLE",
} as const;
export type ProcedureStatus = (typeof ProcedureStatus)[keyof typeof ProcedureStatus];

export const SamplingFrameStatus = {
  CREATED: "CREATED",
  POPULATION_LOADED: "POPULATION_LOADED",
  STRATIFIED: "STRATIFIED",
  SAMPLED: "SAMPLED",
  TESTING_IN_PROGRESS: "TESTING_IN_PROGRESS",
  COMPLETED: "COMPLETED",
  REVIEWED: "REVIEWED",
} as const;
export type SamplingFrameStatus = (typeof SamplingFrameStatus)[keyof typeof SamplingFrameStatus];

export const ExecutionResultStatus = {
  PENDING: "PENDING",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
  EXCEPTION_FOUND: "EXCEPTION_FOUND",
  REVIEWED: "REVIEWED",
  APPROVED: "APPROVED",
} as const;
export type ExecutionResultStatus = (typeof ExecutionResultStatus)[keyof typeof ExecutionResultStatus];

export const ExecutionResultType = {
  TEST_OF_DETAILS: "TEST_OF_DETAILS",
  TEST_OF_CONTROLS: "TEST_OF_CONTROLS",
  JOURNAL_ENTRY_TESTING: "JOURNAL_ENTRY_TESTING",
  ANALYTICAL_FOLLOWUP: "ANALYTICAL_FOLLOWUP",
  CONFIRMATION: "CONFIRMATION",
  SUBSTANTIVE_PROCEDURE: "SUBSTANTIVE_PROCEDURE",
  INQUIRY: "INQUIRY",
  OBSERVATION: "OBSERVATION",
} as const;
export type ExecutionResultType = (typeof ExecutionResultType)[keyof typeof ExecutionResultType];

export const LockGateStatus = {
  PENDING: "PENDING",
  GATES_CHECKING: "GATES_CHECKING",
  GATES_PASSED: "GATES_PASSED",
  GATES_FAILED: "GATES_FAILED",
  OVERRIDE_REQUESTED: "OVERRIDE_REQUESTED",
  OVERRIDE_APPROVED: "OVERRIDE_APPROVED",
  LOCKED: "LOCKED",
  ARCHIVED: "ARCHIVED",
} as const;
export type LockGateStatus = (typeof LockGateStatus)[keyof typeof LockGateStatus];

export const ReconIssueSeverity = {
  HIGH: "HIGH",
  MEDIUM: "MEDIUM",
  LOW: "LOW",
} as const;
export type ReconIssueSeverity = (typeof ReconIssueSeverity)[keyof typeof ReconIssueSeverity];

export const ReconIssueStatus = {
  OPEN: "OPEN",
  NEEDS_REVIEW: "NEEDS_REVIEW",
  FIXED: "FIXED",
  SUPPRESSED: "SUPPRESSED",
} as const;
export type ReconIssueStatus = (typeof ReconIssueStatus)[keyof typeof ReconIssueStatus];

export const ReconIssueTab = {
  SUMMARY: "SUMMARY",
  TB: "TB",
  GL: "GL",
  AP: "AP",
  AR: "AR",
  BANK: "BANK",
  CONFIRMATIONS: "CONFIRMATIONS",
  MAPPING: "MAPPING",
  DRAFT_FS: "DRAFT_FS",
} as const;
export type ReconIssueTab = (typeof ReconIssueTab)[keyof typeof ReconIssueTab];

export const DraftFSStatus = {
  GENERATING: "GENERATING",
  GENERATED: "GENERATED",
  FAILED: "FAILED",
  SUPERSEDED: "SUPERSEDED",
} as const;
export type DraftFSStatus = (typeof DraftFSStatus)[keyof typeof DraftFSStatus];

export const WorkflowPhase = {
  UPLOAD_PROFILE: "UPLOAD_PROFILE",
  DATA_QUALITY: "DATA_QUALITY",
  TB_GL_RECON: "TB_GL_RECON",
  FS_MAPPING: "FS_MAPPING",
  PLANNING_ANALYTICS: "PLANNING_ANALYTICS",
  SAMPLING: "SAMPLING",
  EXECUTION_WP: "EXECUTION_WP",
  COMPLETION: "COMPLETION",
} as const;
export type WorkflowPhase = (typeof WorkflowPhase)[keyof typeof WorkflowPhase];

export const GateStatus = {
  NOT_STARTED: "NOT_STARTED",
  IN_PROGRESS: "IN_PROGRESS",
  BLOCKED: "BLOCKED",
  PASSED: "PASSED",
  APPROVED: "APPROVED",
} as const;
export type GateStatus = (typeof GateStatus)[keyof typeof GateStatus];

export const ExceptionTaxonomy = {
  S1_BLOCKER: "S1_BLOCKER",
  S2_HIGH: "S2_HIGH",
  S3_MEDIUM: "S3_MEDIUM",
  S4_LOW: "S4_LOW",
} as const;
export type ExceptionTaxonomy = (typeof ExceptionTaxonomy)[keyof typeof ExceptionTaxonomy];

