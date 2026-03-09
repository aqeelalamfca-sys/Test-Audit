import type { EngagementSetupData } from "./sections";
import type { EthicsIndependenceData } from "./ethics-kyc-sections";
import type { EngagementTeamData, EngagementLetterData } from "./team-letter-sections";
import type { SignOffGateData, GateCheckItem } from "./signoff-gate-section";
import type {
  AcceptanceDueDiligenceData,
  EntityUnderstandingData,
  RiskAssessmentData,
  MaterialityData,
  AnalyticsOpeningBalancesData,
  AuditStrategyData,
} from "./types";
import {
  Building2,
  ClipboardCheck,
  Shield,
  FileSignature,
  Building,
} from "lucide-react";
import { createElement } from "react";

export type TabStatus = "complete" | "warning" | "incomplete" | "not_started";

export interface TabStatusResult {
  status: TabStatus;
  label: string;
  issues: string[];
}

export type PreplanningTabId =
  | "setup"
  | "acceptance_due_diligence"
  | "ethics"
  | "letter"
  | "entity_understanding"
  | "signoff";

export type PreplanningTabStatuses = Record<PreplanningTabId, TabStatusResult>;

export const ISA_REFERENCES: Record<PreplanningTabId, string> = {
  setup: "ISA 300, ISA 210",
  acceptance_due_diligence: "ISA 210, ISA 220, ISQM 1",
  ethics: "ISA 220, IESBA Code",
  letter: "ISA 210",
  entity_understanding: "ISA 315",
  signoff: "ISA 300, ISQM 1",
};

export const TAB_ORDER: PreplanningTabId[] = [
  "setup",
  "entity_understanding",
  "ethics",
  "acceptance_due_diligence",
  "letter",
  "signoff",
];

export const TAB_DEPENDENCIES: Record<PreplanningTabId, PreplanningTabId[]> = {
  setup: [],
  entity_understanding: ["setup"],
  ethics: ["setup"],
  acceptance_due_diligence: ["setup", "entity_understanding"],
  letter: ["setup", "acceptance_due_diligence"],
  signoff: [
    "setup",
    "entity_understanding",
    "ethics",
    "acceptance_due_diligence",
    "letter",
  ],
};

function computeSetupStatus(data: EngagementSetupData): TabStatusResult {
  const issues: string[] = [];
  const requiredFields: { key: keyof EngagementSetupData; label: string }[] = [
    { key: "clientName", label: "Client Name" },
    { key: "engagementCode", label: "Engagement Code" },
    { key: "fiscalYear", label: "Fiscal Year" },
    { key: "reportingFramework", label: "Reporting Framework" },
    { key: "currency", label: "Currency" },
    { key: "engagementType", label: "Engagement Type" },
  ];

  for (const { key, label } of requiredFields) {
    if (!data[key]) {
      issues.push(`${label} is required`);
    }
  }

  if (issues.length > 0) {
    const allEmpty = requiredFields.every(({ key }) => !data[key]);
    if (allEmpty) {
      return { status: "not_started", label: "Not Started", issues };
    }
    return { status: "incomplete", label: "Incomplete", issues };
  }

  const deadlineFields: { key: keyof EngagementSetupData; label: string }[] = [
    { key: "reportingDeadline", label: "Reporting Deadline" },
    { key: "fieldworkStartDate", label: "Fieldwork Start Date" },
    { key: "fieldworkEndDate", label: "Fieldwork End Date" },
    { key: "planningDeadline", label: "Planning Deadline" },
  ];

  for (const { key, label } of deadlineFields) {
    if (!data[key]) {
      issues.push(`${label} is missing`);
    }
  }

  if (issues.length > 0) {
    return { status: "warning", label: "Dates Missing", issues };
  }

  return { status: "complete", label: "Complete", issues: [] };
}

function computeAcceptanceDueDiligenceStatus(data: AcceptanceDueDiligenceData): TabStatusResult {
  const issues: string[] = [];

  if (!data.clientIntegrityAssessment) {
    issues.push("Client integrity assessment is required");
  }

  const independence = data.independenceCheck;
  if (independence && !independence.independenceConfirmed) {
    issues.push("Independence confirmation is required");
  }

  const competence = data.competenceAssessment;
  if (competence && !competence.hasCompetence) {
    issues.push("Competence assessment is required");
  }

  const riskGrading = data.engagementRiskGrading;
  if (riskGrading && !riskGrading.overallRiskGrade) {
    issues.push("Engagement risk grade is required");
  }

  if (!data.acceptanceDecision) {
    issues.push("Acceptance decision is required");
  }

  if (!data.dueDiligence.entityIdentity.registrationNumber) {
    issues.push("Registration number is required");
  }

  if (!data.dueDiligence.overallAMLRiskScore) {
    issues.push("Overall AML risk rating is required");
  }

  if (!data.dueDiligence.screeningResults || data.dueDiligence.screeningResults.length === 0) {
    issues.push("At least one screening result is required");
  }

  const allEmpty =
    !data.clientIntegrityAssessment &&
    !data.acceptanceDecision &&
    (!independence || !independence.independenceConfirmed) &&
    (!competence || !competence.hasCompetence) &&
    (!riskGrading || !riskGrading.overallRiskGrade) &&
    !data.dueDiligence.entityIdentity.registrationNumber &&
    !data.dueDiligence.overallAMLRiskScore &&
    (!data.dueDiligence.screeningResults || data.dueDiligence.screeningResults.length === 0);

  if (allEmpty) {
    return { status: "not_started", label: "Not Started", issues };
  }

  if (issues.length > 0) {
    return { status: "incomplete", label: "Incomplete", issues };
  }

  if (data.signOff.status === "DRAFT") {
    issues.push("Sign-off is still in draft");
    return { status: "incomplete", label: "Incomplete", issues };
  }

  if (data.checklistSection?.items) {
    const incomplete = data.checklistSection.items.filter(
      (item: any) => !item.completed && !item.notApplicable
    );
    if (incomplete.length > 0) {
      issues.push(`${incomplete.length} checklist item(s) incomplete`);
      return { status: "warning", label: "Checklist Incomplete", issues };
    }
  }

  const hasHits = data.dueDiligence.screeningResults.some((r) => r.result === "hit");
  if (hasHits) {
    issues.push("Screening results have hits requiring review");
    return { status: "warning", label: "Screening Hits", issues };
  }

  return { status: "complete", label: "Complete", issues: [] };
}

function computeEthicsStatus(data: EthicsIndependenceData): TabStatusResult {
  const issues: string[] = [];

  const hasConfirmedDeclaration = data.teamDeclarations.some(
    (d) => d.declarationConfirmed
  );

  if (!hasConfirmedDeclaration) {
    issues.push("At least one team member must have a confirmed declaration");
  }

  if (!data.overallConclusion) {
    issues.push("Overall conclusion is required");
  }

  if (!hasConfirmedDeclaration && !data.overallConclusion && data.teamDeclarations.length === 0) {
    return { status: "not_started", label: "Not Started", issues };
  }

  if (issues.length > 0) {
    return { status: "incomplete", label: "Incomplete", issues };
  }

  const unresolvedThreats = data.threatsIdentified.filter(
    (t) => t.residualRisk === "unacceptable" || (!t.safeguardApplied && t.description)
  );

  if (unresolvedThreats.length > 0) {
    issues.push(`${unresolvedThreats.length} threat(s) identified but not resolved`);
    return { status: "warning", label: "Threats Unresolved", issues };
  }

  return { status: "complete", label: "Complete", issues: [] };
}

function computeTeamStatus(data: EngagementTeamData): TabStatusResult {
  const issues: string[] = [];

  const validMembers = data.teamMembers.filter((m) => m.name && m.role);

  if (validMembers.length === 0) {
    issues.push("At least one team member with name and role is required");
  }

  if (data.supervisionMilestones.length === 0) {
    issues.push("Supervision plan must have milestones");
  }

  if (validMembers.length === 0 && data.supervisionMilestones.length === 0) {
    return { status: "not_started", label: "Not Started", issues };
  }

  if (issues.length > 0) {
    return { status: "incomplete", label: "Incomplete", issues };
  }

  const unconfirmed = validMembers.filter((m) => !m.competenceConfirmed);
  if (unconfirmed.length > 0) {
    issues.push(`${unconfirmed.length} team member(s) missing competence confirmation`);
    return { status: "warning", label: "Competence Unconfirmed", issues };
  }

  return { status: "complete", label: "Complete", issues: [] };
}

function computeLetterStatus(data: EngagementLetterData): TabStatusResult {
  const issues: string[] = [];

  const statusOrder = ["", "drafted", "sent", "signed", "filed"];
  const statusIndex = statusOrder.indexOf(data.status);

  if (!data.templateVariables.clientName) {
    issues.push("Client name is required in template variables");
  }

  if (!data.templateVariables.scopeOfAudit) {
    issues.push("Scope of audit is required in template variables");
  }

  if (statusIndex < 2) {
    issues.push("Engagement letter must be at least sent");
  }

  if (!data.status && !data.templateVariables.clientName && !data.templateVariables.scopeOfAudit) {
    return { status: "not_started", label: "Not Started", issues };
  }

  if (issues.length > 0) {
    return { status: "incomplete", label: "Incomplete", issues };
  }

  if (data.status === "sent") {
    issues.push("Engagement letter not yet signed/filed");
    return { status: "warning", label: "Awaiting Signature", issues };
  }

  return { status: "complete", label: "Complete", issues: [] };
}

function computeEntityUnderstandingStatus(data: EntityUnderstandingData): TabStatusResult {
  const issues: string[] = [];

  if (!data.entityBackground.nature) {
    issues.push("Entity nature is required");
  }
  if (!data.entityBackground.legalStructure) {
    issues.push("Legal structure is required");
  }
  if (!data.industryEnvironment.industryRisks) {
    issues.push("Industry risks are required");
  }
  if (!data.industryEnvironment.regulatoryEnvironment) {
    issues.push("Regulatory environment is required");
  }
  if (!data.businessOperations.revenueStreams) {
    issues.push("Revenue streams are required");
  }
  if (!data.internalControlEnvironment.controlEnvironment) {
    issues.push("Control environment assessment is required");
  }
  if (!data.internalControlEnvironment.informationSystems) {
    issues.push("Information systems assessment is required");
  }

  const itEnv = data.itEnvironmentAssessment;
  if (itEnv) {
    if (!itEnv.itApplications) {
      issues.push("IT applications relevant to financial reporting is required");
    }
    if (!itEnv.itGeneralControls) {
      issues.push("IT general controls assessment is required");
    }
    if (!itEnv.overallItComplexity) {
      issues.push("Overall IT complexity assessment is required");
    }
  } else {
    issues.push("IT environment assessment is required");
  }

  if (!data.governance.governanceStructure) {
    issues.push("Governance structure is required");
  }

  const allEmpty =
    !data.entityBackground.nature &&
    !data.entityBackground.legalStructure &&
    !data.industryEnvironment.industryRisks &&
    !data.businessOperations.revenueStreams &&
    !data.internalControlEnvironment.controlEnvironment &&
    !(itEnv && itEnv.itApplications) &&
    data.relatedParties.length === 0;

  if (allEmpty) {
    return { status: "not_started", label: "Not Started", issues };
  }

  if (issues.length > 0) {
    return { status: "incomplete", label: "Incomplete", issues };
  }

  if (data.signOff.status === "DRAFT") {
    issues.push("Sign-off is still in draft");
    return { status: "warning", label: "Awaiting Sign-off", issues };
  }

  return { status: "complete", label: "Complete", issues: [] };
}

function computeRiskAssessmentStatus(data: RiskAssessmentData): TabStatusResult {
  const issues: string[] = [];

  if (data.identifiedRisks.length === 0) {
    issues.push("At least one risk must be identified");
  }

  if (!data.overallRiskAssessment.combinedAssessment) {
    issues.push("Overall combined risk assessment is required");
  }

  if (!data.overallRiskAssessment.financialStatementLevelRisks) {
    issues.push("Financial statement level risks are required");
  }

  if (!data.overallRiskAssessment.assertionLevelRisks) {
    issues.push("Assertion level risks are required");
  }

  if (!data.goingConcernAssessment.conclusion) {
    issues.push("Going concern conclusion is required");
  }

  const irf = data.inherentRiskFactors;
  if (irf) {
    const unassessed = ["complexity", "subjectivity", "change", "uncertainty", "susceptibilityToFraud", "managementBias"]
      .filter(k => !(irf as Record<string, string>)[k]);
    if (unassessed.length > 0) {
      issues.push(`${unassessed.length} inherent risk factor(s) not assessed`);
    }
  }

  const allEmpty =
    data.identifiedRisks.length === 0 &&
    !data.overallRiskAssessment.combinedAssessment &&
    !data.goingConcernAssessment.conclusion &&
    !data.fraudRiskFactors.pressureIndicators &&
    !(irf && irf.complexity);

  if (allEmpty) {
    return { status: "not_started", label: "Not Started", issues };
  }

  if (issues.length > 0) {
    return { status: "incomplete", label: "Incomplete", issues };
  }

  const highRisks = data.identifiedRisks.filter((r) => r.riskLevel === "high" && !r.response);
  if (highRisks.length > 0) {
    issues.push(`${highRisks.length} high risk(s) without planned response`);
    return { status: "warning", label: "Risks Need Response", issues };
  }

  const sigRisks = data.significantRisks || [];
  const sigRisksWithoutApproach = sigRisks.filter(r => !r.plannedApproach);
  if (sigRisksWithoutApproach.length > 0) {
    issues.push(`${sigRisksWithoutApproach.length} significant risk(s) without planned approach`);
    return { status: "warning", label: "Significant Risks Need Response", issues };
  }

  if (data.signOff.status === "DRAFT") {
    issues.push("Sign-off is still in draft");
    return { status: "warning", label: "Awaiting Sign-off", issues };
  }

  return { status: "complete", label: "Complete", issues: [] };
}

function computeMaterialityStatus(data: MaterialityData): TabStatusResult {
  const issues: string[] = [];

  if (!data.benchmarkSelection) {
    issues.push("Benchmark selection is required");
  }

  if (!data.benchmarkRationale) {
    issues.push("Benchmark rationale is required");
  }

  if (!data.materialityComputation.overallMateriality) {
    issues.push("Overall materiality must be computed");
  }

  if (!data.materialityComputation.performanceMateriality) {
    issues.push("Performance materiality must be computed");
  }

  if (!data.materialityComputation.percentageApplied || data.materialityComputation.percentageApplied <= 0) {
    issues.push("Percentage applied must be greater than 0");
  }

  if (!data.rationale) {
    issues.push("Materiality rationale is required");
  }

  if (!data.clearlyTrivialThreshold?.basis) {
    issues.push("Clearly trivial threshold basis is required (ISA 450.A2)");
  }

  if (data.componentMateriality?.isGroupAudit && (!data.componentMateriality.components || data.componentMateriality.components.length === 0)) {
    issues.push("Component materiality must have at least one component for group audits");
  }

  const allEmpty =
    !data.benchmarkSelection &&
    !data.benchmarkRationale &&
    !data.materialityComputation.overallMateriality &&
    !data.materialityComputation.performanceMateriality &&
    !data.rationale;

  if (allEmpty) {
    return { status: "not_started", label: "Not Started", issues };
  }

  if (issues.length > 0) {
    return { status: "incomplete", label: "Incomplete", issues };
  }

  if (data.signOff.status === "DRAFT") {
    issues.push("Sign-off is still in draft");
    return { status: "warning", label: "Awaiting Sign-off", issues };
  }

  return { status: "complete", label: "Complete", issues: [] };
}

function computeAnalyticsOpeningStatus(data: AnalyticsOpeningBalancesData): TabStatusResult {
  const issues: string[] = [];

  const trendAnalysis = data.trendAnalysis || { items: [], trendConclusion: "" };
  const ratioAnalysis = data.ratioAnalysis || { standardRatios: {}, customRatios: [], ratioConclusion: "" };
  const budgetVsActual = data.budgetVsActual || { items: [], budgetConclusion: "" };
  const unusualFluctuations = data.unusualFluctuations || { items: [], fluctuationThreshold: "10", overallAssessment: "" };
  const priorYearOpinion = data.openingBalancesReview.priorYearOpinion || { opinionType: "" };
  const rollForwardStrategy = data.openingBalancesReview.rollForwardStrategy || { approach: "", closingToOpeningReconciled: "" };

  if (!priorYearOpinion.opinionType) {
    issues.push("Prior year opinion type must be selected (ISA 510)");
  }

  if (!rollForwardStrategy.approach) {
    issues.push("Roll-forward approach must be selected");
  }

  if (!rollForwardStrategy.closingToOpeningReconciled) {
    issues.push("Closing-to-opening reconciliation status is required");
  }

  if (!data.dataSources) {
    issues.push("Data sources must be specified");
  }

  if (!data.openingBalancesReview.openingTBReconciliationStatus) {
    issues.push("Opening TB reconciliation status is required");
  }

  const hasTrendEntries = trendAnalysis.items.length > 0;
  const hasTrendConclusion = !!trendAnalysis.trendConclusion;
  if (!hasTrendEntries && !hasTrendConclusion) {
    issues.push("At least one trend analysis line item or a trend conclusion is required");
  }

  if (!data.overallConclusion) {
    issues.push("Overall conclusion is required");
  }

  const hasNoAnalytics =
    trendAnalysis.items.length === 0 &&
    !trendAnalysis.trendConclusion &&
    budgetVsActual.items.length === 0 &&
    unusualFluctuations.items.length === 0 &&
    !data.dataSources &&
    !priorYearOpinion.opinionType &&
    !rollForwardStrategy.approach &&
    !data.openingBalancesReview.openingTBReconciliationStatus &&
    !data.openingBalancesReview.priorAuditorReview &&
    !data.overallConclusion;

  if (hasNoAnalytics) {
    return { status: "not_started", label: "Not Started", issues };
  }

  if (issues.length > 0) {
    return { status: "incomplete", label: "Incomplete", issues };
  }

  const unresolvedFluctuations = unusualFluctuations.items.filter(
    (f) => f.riskImplication === "high" && f.investigationStatus !== "resolved"
  );

  if (unresolvedFluctuations.length > 0) {
    issues.push(`${unresolvedFluctuations.length} high-risk fluctuation(s) unresolved`);
    return { status: "warning", label: "Unresolved Fluctuations", issues };
  }

  const significantTrendsNoExplanation = trendAnalysis.items.filter(
    (t) => t.significanceFlag && !t.explanation
  );

  if (significantTrendsNoExplanation.length > 0) {
    issues.push(`${significantTrendsNoExplanation.length} significant trend(s) without explanation`);
    return { status: "warning", label: "Trends Need Explanation", issues };
  }

  if (data.signOff.status === "DRAFT") {
    issues.push("Sign-off is still in draft");
    return { status: "warning", label: "Awaiting Sign-off", issues };
  }

  return { status: "complete", label: "Complete", issues: [] };
}

function computeStrategyTCWGStatus(data: AuditStrategyData): TabStatusResult {
  const issues: string[] = [];

  const tcwgComm = data.tcwgCommunication || { plannedScopeTiming: "", identifiedSignificantRisks: "", independenceConfirmation: { confirmed: false }, materialityLevels: "" };
  const independenceConf = tcwgComm.independenceConfirmation || { confirmed: false };
  const resourcePlan = data.resourceTimingPlan || { plannedHoursByPhase: [], keyDates: [], specialistNeeds: "" };
  const plannedComm = data.plannedCommunications || { scopeTimingCommunication: "", significantFindingsApproach: "", communicationSchedule: "" };

  if (!data.overallStrategy.scope) {
    issues.push("Audit scope is required");
  }

  if (!data.overallStrategy.auditApproach) {
    issues.push("Audit approach must be selected");
  }

  if (data.tcwgIdentification.length === 0) {
    issues.push("At least one TCWG member must be identified (ISA 260.11)");
  }

  if (!tcwgComm.plannedScopeTiming) {
    issues.push("Planned scope & timing communication is required (ISA 260.15)");
  }

  if (!tcwgComm.materialityLevels) {
    issues.push("Materiality levels communication is required (ISA 260.A21)");
  }

  const hasPhaseWithHours = resourcePlan.plannedHoursByPhase.some(p => p.plannedHours > 0);
  if (!hasPhaseWithHours) {
    issues.push("At least one phase with planned hours is required in resource/timing plan");
  }

  if (resourcePlan.keyDates.length === 0) {
    issues.push("At least one key date must be defined in the resource/timing plan");
  }

  if (!independenceConf.confirmed) {
    issues.push("Independence confirmation to TCWG is required (ISA 260.17)");
  }

  if (!plannedComm.communicationSchedule) {
    issues.push("Communication schedule must be defined");
  }

  const hasAnyPhaseHours = resourcePlan.plannedHoursByPhase.some(p => p.plannedHours > 0);
  const allEmpty =
    !data.overallStrategy.scope &&
    !data.overallStrategy.auditApproach &&
    data.tcwgIdentification.length === 0 &&
    data.keyAreasOfFocus.length === 0 &&
    !tcwgComm.plannedScopeTiming &&
    !tcwgComm.identifiedSignificantRisks &&
    !hasAnyPhaseHours &&
    resourcePlan.keyDates.length === 0;

  if (allEmpty) {
    return { status: "not_started", label: "Not Started", issues };
  }

  if (issues.length > 0) {
    return { status: "incomplete", label: "Incomplete", issues };
  }

  if (!tcwgComm.identifiedSignificantRisks) {
    issues.push("Significant risks communication to TCWG is recommended");
    return { status: "warning", label: "Risks Not Communicated", issues };
  }

  if (data.signOff.status === "DRAFT") {
    issues.push("Sign-off is still in draft");
    return { status: "warning", label: "Awaiting Sign-off", issues };
  }

  return { status: "complete", label: "Complete", issues: [] };
}

function tabStatusToGateStatus(status: TabStatus): "passed" | "failed" | "pending" {
  switch (status) {
    case "complete":
      return "passed";
    case "warning":
      return "pending";
    case "incomplete":
    case "not_started":
      return "failed";
  }
}

export function computeGateChecksFromStatuses(
  statuses: Omit<PreplanningTabStatuses, "signoff">
): GateCheckItem[] {
  const gateDefinitions: {
    id: string;
    label: string;
    description: string;
    tabKey: keyof Omit<PreplanningTabStatuses, "signoff">;
    isBlocking: boolean;
    icon: React.ReactNode;
  }[] = [
    {
      id: "setup",
      label: "Engagement Setup Complete",
      description: "All engagement identification fields are filled",
      tabKey: "setup",
      isBlocking: true,
      icon: createElement(Building2, { className: "h-4 w-4" }),
    },
    {
      id: "acceptance",
      label: "Acceptance & Due Diligence Approved",
      description: "Client acceptance and KYC/AML due diligence completed and signed off",
      tabKey: "acceptance_due_diligence",
      isBlocking: true,
      icon: createElement(ClipboardCheck, { className: "h-4 w-4" }),
    },
    {
      id: "independence",
      label: "Independence Confirmed",
      description: "Ethics and independence declarations completed",
      tabKey: "ethics",
      isBlocking: true,
      icon: createElement(Shield, { className: "h-4 w-4" }),
    },
    {
      id: "engagement-letter",
      label: "Engagement Letter Signed & Filed",
      description: "Engagement letter has been signed and filed",
      tabKey: "letter",
      isBlocking: true,
      icon: createElement(FileSignature, { className: "h-4 w-4" }),
    },
    {
      id: "entity-understanding",
      label: "Entity Understanding Documented",
      description: "ISA 315 entity understanding including controls environment",
      tabKey: "entity_understanding",
      isBlocking: true,
      icon: createElement(Building, { className: "h-4 w-4" }),
    },
  ];

  return gateDefinitions.map((def) => ({
    id: def.id,
    label: def.label,
    description: def.description,
    status: tabStatusToGateStatus(statuses[def.tabKey].status),
    isBlocking: def.isBlocking,
    icon: def.icon,
  }));
}

function computeSignoffStatus(
  data: SignOffGateData,
  otherStatuses: Omit<PreplanningTabStatuses, "signoff">
): TabStatusResult {
  const issues: string[] = [];
  const gateChecks = computeGateChecksFromStatuses(otherStatuses);

  const failedBlocking = gateChecks.filter(
    (g) => g.isBlocking && g.status !== "passed"
  );
  const pendingNonBlocking = gateChecks.filter(
    (g) => !g.isBlocking && g.status !== "passed"
  );

  if (failedBlocking.length > 0) {
    for (const gate of failedBlocking) {
      issues.push(`${gate.label}: ${gate.status}`);
    }
  }

  if (pendingNonBlocking.length > 0) {
    for (const gate of pendingNonBlocking) {
      issues.push(`${gate.label}: ${gate.status}`);
    }
  }

  const checklist = data.completionChecklist;
  if (checklist && checklist.items) {
    const incomplete = checklist.items.filter(i => i.status !== "yes" && i.status !== "na");
    if (incomplete.length > 0) {
      issues.push(`Completion checklist: ${incomplete.length} item(s) not addressed`);
    }
  }

  if (!data.riskAssessmentFinalized) {
    issues.push("Risk assessment not finalized");
  }
  if (!data.materialityApproved) {
    issues.push("Materiality not approved");
  }

  const strategy = data.auditStrategyApproval;
  if (strategy) {
    if (!strategy.natureTimingExtent?.trim()) {
      issues.push("Nature, timing & extent of procedures not documented");
    }
    if (!strategy.controlRelianceStrategy?.trim()) {
      issues.push("Control reliance strategy not documented");
    }
    if (strategy.approvalStatus !== "approved") {
      issues.push("Audit strategy not yet approved by partner");
    }
  }

  const eqcr = data.eqcrClearance;
  if (eqcr && eqcr.eqcrRequired) {
    if (eqcr.eqcrStatus !== "cleared" && eqcr.eqcrStatus !== "not_required") {
      issues.push("EQCR clearance pending");
    }
    if (!eqcr.eqcrConcurrence) {
      issues.push("EQCR reviewer concurrence not obtained");
    }
  }

  const ps = data.partnerSignOff;
  const partnerConfirmed = (ps && ps.confirmed) || data.partnerConfirmation;
  if (!partnerConfirmed) {
    issues.push("Partner sign-off confirmation is required");
  }
  if (ps && !ps.partnerName?.trim()) {
    issues.push("Engagement partner name not provided");
  }
  if (ps && !ps.signOffDate?.trim()) {
    issues.push("Sign-off date not provided");
  }

  if (failedBlocking.length > 0) {
    return { status: "incomplete", label: "Blocking Items Failed", issues };
  }

  if (!partnerConfirmed) {
    return { status: "incomplete", label: "Awaiting Partner Sign-off", issues };
  }

  const hasStrategyIssues = strategy && (
    !strategy.natureTimingExtent?.trim() ||
    !strategy.controlRelianceStrategy?.trim() ||
    strategy.approvalStatus !== "approved"
  );
  if (hasStrategyIssues) {
    return { status: "incomplete", label: "Strategy Approval Pending", issues };
  }

  if (pendingNonBlocking.length > 0) {
    return { status: "warning", label: "Non-Blocking Items Pending", issues };
  }

  const checklistIncomplete = checklist?.items?.some(i => i.status !== "yes" && i.status !== "na");
  if (checklistIncomplete || !data.riskAssessmentFinalized || !data.materialityApproved) {
    return { status: "warning", label: "Confirmations Pending", issues };
  }

  return { status: "complete", label: "Complete", issues: [] };
}

export function computePreplanningStatuses(
  setup: EngagementSetupData,
  acceptanceDueDiligence: AcceptanceDueDiligenceData,
  ethics: EthicsIndependenceData,
  _team: EngagementTeamData,
  letter: EngagementLetterData,
  entityUnderstanding: EntityUnderstandingData,
  _riskAssessment: RiskAssessmentData,
  _materiality: MaterialityData,
  _analyticsOpening: AnalyticsOpeningBalancesData,
  _strategyTcwg: AuditStrategyData,
  signoff: SignOffGateData
): PreplanningTabStatuses {
  const setupStatus = computeSetupStatus(setup);
  const acceptanceStatus = computeAcceptanceDueDiligenceStatus(acceptanceDueDiligence);
  const ethicsStatus = computeEthicsStatus(ethics);
  const letterStatus = computeLetterStatus(letter);
  const entityUnderstandingStatus = computeEntityUnderstandingStatus(entityUnderstanding);

  const otherStatuses = {
    setup: setupStatus,
    acceptance_due_diligence: acceptanceStatus,
    ethics: ethicsStatus,
    letter: letterStatus,
    entity_understanding: entityUnderstandingStatus,
  };

  const signoffStatus = computeSignoffStatus(signoff, otherStatuses);

  return {
    setup: setupStatus,
    acceptance_due_diligence: acceptanceStatus,
    ethics: ethicsStatus,
    letter: letterStatus,
    entity_understanding: entityUnderstandingStatus,
    signoff: signoffStatus,
  };
}
