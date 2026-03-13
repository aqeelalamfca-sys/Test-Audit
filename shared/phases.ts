export interface CanonicalPhase {
  key: string;
  label: string;
  description: string;
  routeSlug: string;
  order: number;
  group: "onboarding" | "data" | "planning" | "fieldwork" | "completion" | "quality";
  backendPhase: string;
  prerequisiteKeys: string[];
  requiredInputs: string[];
  completionGates: PhaseGate[];
  rolePermissions: {
    canPrepare: string[];
    canReview: string[];
    canApprove: string[];
    canView: string[];
  };
  aiCapabilities: string[];
  outputArtifacts: string[];
}

export interface PhaseGate {
  id: string;
  label: string;
  type: "hard" | "soft";
  description: string;
  isaReference?: string;
}

export type PhaseStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "NEEDS_REVIEW"
  | "BLOCKED"
  | "COMPLETED"
  | "APPROVED"
  | "LOCKED";

export const PHASE_STATUS_LABELS: Record<PhaseStatus, string> = {
  NOT_STARTED: "Not Started",
  IN_PROGRESS: "In Progress",
  NEEDS_REVIEW: "Needs Review",
  BLOCKED: "Blocked",
  COMPLETED: "Completed",
  APPROVED: "Approved",
  LOCKED: "Locked",
};

export const PHASE_STATUS_ORDER: PhaseStatus[] = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "NEEDS_REVIEW",
  "BLOCKED",
  "COMPLETED",
  "APPROVED",
  "LOCKED",
];

const ALL_ROLES = ["STAFF", "SENIOR", "MANAGER", "EQCR", "PARTNER", "FIRM_ADMIN"];
const SENIOR_UP = ["SENIOR", "MANAGER", "EQCR", "PARTNER", "FIRM_ADMIN"];
const MANAGER_UP = ["MANAGER", "EQCR", "PARTNER", "FIRM_ADMIN"];
const PARTNER_UP = ["PARTNER", "FIRM_ADMIN"];
const EQCR_ONLY = ["EQCR", "FIRM_ADMIN"];

export const CANONICAL_PHASES: CanonicalPhase[] = [
  {
    key: "client-creation",
    label: "Client Creation",
    description: "Register new audit client with KYC, industry classification, and contact details",
    routeSlug: "client-creation",
    order: 0,
    group: "onboarding",
    backendPhase: "ONBOARDING",
    prerequisiteKeys: [],
    requiredInputs: ["Client name", "Client type", "Industry"],
    completionGates: [
      { id: "client-exists", label: "Client record created", type: "hard", description: "A client entity must be saved" },
    ],
    rolePermissions: { canPrepare: ALL_ROLES, canReview: SENIOR_UP, canApprove: MANAGER_UP, canView: ALL_ROLES },
    aiCapabilities: ["client-summary-draft", "missing-field-alerts"],
    outputArtifacts: ["Client record"],
  },
  {
    key: "engagement-setup",
    label: "Engagement Setup",
    description: "Create the engagement record with period, type, team assignment, and budget",
    routeSlug: "engagement-setup",
    order: 1,
    group: "onboarding",
    backendPhase: "ONBOARDING",
    prerequisiteKeys: ["client-creation"],
    requiredInputs: ["Engagement type", "Period start/end", "Fiscal year end", "Team assignment"],
    completionGates: [
      { id: "engagement-exists", label: "Engagement record created", type: "hard", description: "An engagement entity must be saved" },
      { id: "team-assigned", label: "Engagement team assigned", type: "soft", description: "At least one team member should be assigned" },
    ],
    rolePermissions: { canPrepare: SENIOR_UP, canReview: MANAGER_UP, canApprove: PARTNER_UP, canView: ALL_ROLES },
    aiCapabilities: ["engagement-setup-summary", "missing-field-alerts"],
    outputArtifacts: ["Engagement record"],
  },
  {
    key: "acceptance",
    label: "Acceptance & Continuance",
    description: "Evaluate prospective/recurring client acceptance, management integrity, competence/resources, preconditions, engagement letter readiness, and continuance assessment per ISA 220/210/ISQM 1",
    routeSlug: "acceptance",
    order: 2,
    group: "onboarding",
    backendPhase: "PRE_PLANNING",
    prerequisiteKeys: ["engagement-setup"],
    requiredInputs: [
      "Client type (prospective/recurring)",
      "Acceptance factors checklist",
      "Management integrity assessment",
      "Competence and resources evaluation",
      "Preconditions for audit",
      "Engagement letter",
      "Continuance assessment",
      "Acceptance conclusion with partner approval",
    ],
    completionGates: [
      { id: "acceptance-checklist", label: "Acceptance checklist completed", type: "hard", description: "All mandatory acceptance items must be addressed", isaReference: "ISA 220" },
      { id: "continuance-assessed", label: "Continuance assessment completed", type: "hard", description: "Recurring client continuance must be assessed", isaReference: "ISQM 1.30" },
      { id: "engagement-letter-issued", label: "Engagement letter issued", type: "hard", description: "Engagement letter must be issued or confirmed", isaReference: "ISA 210" },
      { id: "acceptance-approved", label: "Acceptance approved by partner", type: "hard", description: "Partner must approve the acceptance/continuance decision", isaReference: "ISA 220.12" },
    ],
    rolePermissions: { canPrepare: ALL_ROLES, canReview: MANAGER_UP, canApprove: PARTNER_UP, canView: ALL_ROLES },
    aiCapabilities: ["acceptance-summary-draft", "acceptance-checklist-drafting", "missing-field-alerts", "conclusion-wording"],
    outputArtifacts: ["Acceptance checklist", "Continuance assessment", "Engagement letter", "Acceptance decision"],
  },
  {
    key: "independence",
    label: "Independence / Ethics",
    description: "Collect independence confirmations, assess conflicts of interest, evaluate non-audit services, apply safeguards, verify ethics compliance, check restricted relationships, and obtain partner/staff declarations per IESBA Code / ISA 200/220",
    routeSlug: "independence",
    order: 3,
    group: "onboarding",
    backendPhase: "PRE_PLANNING",
    prerequisiteKeys: ["engagement-setup"],
    requiredInputs: [
      "Independence confirmations from all team members",
      "Conflicts of interest assessment",
      "Non-audit services evaluation",
      "Safeguards documentation",
      "Ethics compliance confirmation",
      "Restricted relationships check",
      "Partner/staff declarations",
      "Ethics conclusion with partner approval",
    ],
    completionGates: [
      { id: "independence-confirmed", label: "Independence confirmed", type: "hard", description: "All team members must confirm independence", isaReference: "ISA 200/220" },
      { id: "conflicts-resolved", label: "Conflicts of interest resolved", type: "hard", description: "All identified conflicts must be resolved with safeguards or partner approval", isaReference: "IESBA Code 310" },
      { id: "ethics-declarations", label: "Ethics declarations filed", type: "hard", description: "Ethics and conflict-of-interest forms must be completed", isaReference: "IESBA Code 100" },
      { id: "ethics-approved", label: "Ethics conclusion approved by partner", type: "hard", description: "Partner must approve the ethics and independence conclusion", isaReference: "ISA 220.11" },
    ],
    rolePermissions: { canPrepare: ALL_ROLES, canReview: MANAGER_UP, canApprove: PARTNER_UP, canView: ALL_ROLES },
    aiCapabilities: ["ethics-warning-alerts", "missing-declaration-summary", "conclusion-wording", "ethics-warning-suggestions"],
    outputArtifacts: ["Independence declarations", "Ethics forms", "Threat register", "Safeguards log", "Ethics conclusion"],
  },
  {
    key: "tb-gl-upload",
    label: "TB / GL Upload",
    description: "Upload Trial Balance, General Ledger, sub-ledgers (AR/AP/Bank), and supporting schedules with batch tracking, template checks, and import logs",
    routeSlug: "tb-gl-upload",
    order: 4,
    group: "data",
    backendPhase: "REQUISITION",
    prerequisiteKeys: ["acceptance", "independence"],
    requiredInputs: ["Trial Balance file", "General Ledger file"],
    completionGates: [
      { id: "tb-uploaded", label: "Trial Balance uploaded", type: "hard", description: "At least one TB dataset must be uploaded with a traceable batch ID" },
      { id: "gl-uploaded", label: "General Ledger uploaded", type: "soft", description: "GL data should be uploaded for full analytics" },
      { id: "batch-tracked", label: "Upload batch tracked", type: "hard", description: "Every upload must have a traceable batch ID with source and period tags" },
      { id: "template-checked", label: "Template format verified", type: "soft", description: "Uploaded file should match the expected template structure" },
    ],
    rolePermissions: { canPrepare: ALL_ROLES, canReview: SENIOR_UP, canApprove: MANAGER_UP, canView: ALL_ROLES },
    aiCapabilities: ["upload-template-guidance", "data-quality-explanations"],
    outputArtifacts: ["Imported TB", "Imported GL", "Import log", "Batch manifest"],
  },
  {
    key: "validation",
    label: "Validation & Parsing",
    description: "Validate uploaded data integrity — structural checks, duplicate detection, DR/CR balancing, opening/closing balance verification, account code normalization, and error classification",
    routeSlug: "validation",
    order: 5,
    group: "data",
    backendPhase: "REQUISITION",
    prerequisiteKeys: ["tb-gl-upload"],
    requiredInputs: ["Parsed TB data", "Parsed GL data"],
    completionGates: [
      { id: "tb-validated", label: "TB data validated", type: "hard", description: "Trial Balance must pass all structural and balance checks (DR = CR)" },
      { id: "gl-reconciled", label: "GL reconciled to TB", type: "hard", description: "GL totals must reconcile to TB totals within tolerance" },
      { id: "duplicates-cleared", label: "No duplicate entries", type: "hard", description: "All flagged duplicates must be resolved or acknowledged" },
      { id: "blockers-resolved", label: "All blockers resolved", type: "hard", description: "No unresolved blocker-level validation errors remain" },
    ],
    rolePermissions: { canPrepare: ALL_ROLES, canReview: SENIOR_UP, canApprove: MANAGER_UP, canView: ALL_ROLES },
    aiCapabilities: ["validation-error-explainer", "corrective-action-suggestions", "data-quality-summary"],
    outputArtifacts: ["Validation report", "Reconciliation results", "Parser summary", "Error classification report"],
  },
  {
    key: "coa-mapping",
    label: "CoA / FS Mapping",
    description: "Normalize chart of accounts, map to FS heads, group lead schedules, review unmapped accounts, and compute mapping completeness with prior year reuse",
    routeSlug: "coa-mapping",
    order: 6,
    group: "data",
    backendPhase: "REQUISITION",
    prerequisiteKeys: ["validation"],
    requiredInputs: ["Chart of Accounts", "FS line item mapping", "Prior year mappings"],
    completionGates: [
      { id: "coa-mapped", label: "CoA mapped to FS heads", type: "hard", description: "All TB accounts must be mapped to FS line items or explicitly flagged" },
      { id: "fs-heads-mapped", label: "FS heads assigned", type: "hard", description: "Every mapped account must have an FS head classification" },
      { id: "lead-schedules-grouped", label: "Lead schedules grouped", type: "soft", description: "Accounts should be grouped into lead schedule categories" },
      { id: "unmapped-reviewed", label: "Unmapped accounts reviewed", type: "hard", description: "All accounts must be mapped or explicitly parked/flagged before completion" },
      { id: "mapping-score-met", label: "Mapping completeness threshold met", type: "hard", description: "Mapping completeness score must meet minimum threshold (95%)" },
    ],
    rolePermissions: { canPrepare: ALL_ROLES, canReview: SENIOR_UP, canApprove: MANAGER_UP, canView: ALL_ROLES },
    aiCapabilities: ["coa-mapping-suggestions", "unmapped-account-explainer", "mapping-confidence-review"],
    outputArtifacts: ["CoA mapping", "Lead schedules", "Draft FS", "Unmapped accounts report", "Mapping confidence report"],
  },
  {
    key: "materiality",
    label: "Materiality",
    description: "Select benchmark, calculate overall materiality, performance materiality, and trivial threshold per ISA 320, assess qualitative factors, and obtain partner approval",
    routeSlug: "materiality",
    order: 7,
    group: "planning",
    backendPhase: "PLANNING",
    prerequisiteKeys: ["coa-mapping"],
    requiredInputs: ["Benchmark selection", "Benchmark basis amount", "Percentage", "Materiality calculation", "Qualitative factors"],
    completionGates: [
      { id: "benchmark-selected", label: "Benchmark selected", type: "hard", description: "A materiality benchmark basis must be chosen (Revenue, PBT, Assets, etc.)", isaReference: "ISA 320" },
      { id: "materiality-calculated", label: "Materiality calculated", type: "hard", description: "Overall materiality, PM, and trivial threshold must be set", isaReference: "ISA 320" },
      { id: "qualitative-assessed", label: "Qualitative factors assessed", type: "soft", description: "Qualitative factors affecting materiality should be documented" },
      { id: "materiality-approved", label: "Materiality approved by partner", type: "hard", description: "Partner must approve materiality levels" },
    ],
    rolePermissions: { canPrepare: ALL_ROLES, canReview: MANAGER_UP, canApprove: PARTNER_UP, canView: ALL_ROLES },
    aiCapabilities: ["materiality-narration-drafting", "benchmark-recommendation", "materiality-linkage-summary"],
    outputArtifacts: ["Materiality memo", "Materiality calculation", "Benchmark rationale", "Qualitative factors assessment"],
  },
  {
    key: "risk-assessment",
    label: "Risk Assessment",
    description: "Identify and assess risks of material misstatement at entity, FS, and assertion level per ISA 315, including fraud risk per ISA 240, with linkage to controls and analytics",
    routeSlug: "risk-assessment",
    order: 8,
    group: "planning",
    backendPhase: "PLANNING",
    prerequisiteKeys: ["materiality"],
    requiredInputs: ["Risk register", "Analytics results", "Industry risk factors", "FS heads mapping", "Materiality thresholds"],
    completionGates: [
      { id: "entity-risks-documented", label: "Entity-level risks documented", type: "hard", description: "Entity-level risk factors must be documented", isaReference: "ISA 315" },
      { id: "fs-level-risks-mapped", label: "FS-level risks mapped", type: "hard", description: "Risks mapped to financial statement line items", isaReference: "ISA 315" },
      { id: "assertion-risks-linked", label: "Assertion-level risks linked", type: "hard", description: "Risks must be linked to relevant assertions (existence, completeness, etc.)", isaReference: "ISA 315" },
      { id: "significant-risks-identified", label: "Significant risks identified", type: "hard", description: "Significant risks requiring special audit consideration must be flagged", isaReference: "ISA 315" },
      { id: "fraud-risks-assessed", label: "Fraud risks assessed", type: "hard", description: "Fraud risk assessment including revenue recognition and management override", isaReference: "ISA 240" },
      { id: "risk-register-complete", label: "Risk register complete", type: "soft", description: "Risk register should include all identified risks with responses", isaReference: "ISA 315" },
      { id: "risk-conclusion-documented", label: "Risk conclusion documented", type: "hard", description: "Overall risk assessment conclusion must be documented", isaReference: "ISA 315" },
    ],
    rolePermissions: { canPrepare: ALL_ROLES, canReview: MANAGER_UP, canApprove: PARTNER_UP, canView: ALL_ROLES },
    aiCapabilities: ["risk-drafting-from-analytics", "fraud-risk-prompts", "missing-linkage-warnings"],
    outputArtifacts: ["Risk register", "Risk assessment memo", "Fraud risk assessment"],
  },
  {
    key: "planning-strategy",
    label: "Planning Strategy",
    description: "Document overall audit strategy, scope, team allocation, timing, and detailed audit plan per ISA 300",
    routeSlug: "planning-strategy",
    order: 9,
    group: "planning",
    backendPhase: "PLANNING",
    prerequisiteKeys: ["risk-assessment"],
    requiredInputs: ["Audit strategy", "Risk assessment results", "Team allocation", "Scope decisions", "Planning analytics"],
    completionGates: [
      { id: "strategy-documented", label: "Audit strategy documented", type: "hard", description: "Overall audit strategy must be prepared", isaReference: "ISA 300" },
      { id: "scope-defined", label: "Scope defined", type: "hard", description: "Audit scope and component coverage must be defined", isaReference: "ISA 300" },
      { id: "team-allocated", label: "Team allocated", type: "soft", description: "Team members should be assigned with appropriate expertise", isaReference: "ISA 220" },
      { id: "planning-memo-complete", label: "Planning memo complete", type: "hard", description: "Planning memo must summarize the audit approach and strategy", isaReference: "ISA 300" },
    ],
    rolePermissions: { canPrepare: SENIOR_UP, canReview: MANAGER_UP, canApprove: PARTNER_UP, canView: ALL_ROLES },
    aiCapabilities: ["planning-memo-drafting", "missing-linkage-warnings"],
    outputArtifacts: ["Audit strategy memo", "Planning analytics report", "Team allocation plan"],
  },
  {
    key: "procedures-sampling",
    label: "Procedures & Sampling",
    description: "Design audit procedures linked to risks, FS heads, and assertions; define populations and sampling parameters per ISA 330/530",
    routeSlug: "procedures-sampling",
    order: 10,
    group: "fieldwork",
    backendPhase: "EXECUTION",
    prerequisiteKeys: ["planning-strategy"],
    requiredInputs: ["Risk assessment results", "FS heads mapping", "Materiality thresholds", "Audit strategy", "Assertion linkages"],
    completionGates: [
      { id: "procedures-linked", label: "Procedures linked to risks", type: "hard", description: "At least one procedure must exist and be linked to an assessed risk", isaReference: "ISA 330" },
      { id: "high-risk-procedures-exist", label: "High-risk areas have procedures", type: "hard", description: "All high/significant risk areas must have at least one linked procedure", isaReference: "ISA 330" },
      { id: "assertions-covered", label: "Assertions covered", type: "hard", description: "At least 80% of procedures must have assertion coverage specified", isaReference: "ISA 330" },
      { id: "sampling-populations-defined", label: "Sampling populations defined", type: "hard", description: "All procedures with sample sizes must have population size and sampling method defined", isaReference: "ISA 530" },
      { id: "sampling-rationale-documented", label: "Sampling rationale documented", type: "soft", description: "At least one sampling frame or procedure with sample size should exist", isaReference: "ISA 530" },
      { id: "reviewer-status-clear", label: "Reviewer status clear", type: "soft", description: "At least 50% of procedures should have reviewer assignment", isaReference: "ISA 220" },
    ],
    rolePermissions: { canPrepare: ALL_ROLES, canReview: SENIOR_UP, canApprove: MANAGER_UP, canView: ALL_ROLES },
    aiCapabilities: ["procedure-suggestions", "sample-rationale-wording", "missing-procedure-coverage"],
    outputArtifacts: ["Audit programs", "Sample selections", "Procedure-risk linkage matrix", "Sampling rationale documentation"],
  },
  {
    key: "execution-testing",
    label: "Execution Testing",
    description: "Execute planned audit procedures, document test results and workpapers, perform control and substantive testing, record exceptions, and draft conclusions per ISA 230/330/500/530",
    routeSlug: "execution-testing",
    order: 11,
    group: "fieldwork",
    backendPhase: "EXECUTION",
    prerequisiteKeys: ["procedures-sampling"],
    requiredInputs: ["Assigned procedures", "Sample selections", "Risk-procedure linkage", "FS head mapping"],
    completionGates: [
      { id: "procedures-executed", label: "Procedures executed", type: "hard", description: "All assigned procedures must have status IN_PROGRESS or COMPLETED — none may remain NOT_STARTED", isaReference: "ISA 330" },
      { id: "workpapers-documented", label: "Workpapers documented", type: "hard", description: "At least 80% of procedures must have a workpaper reference", isaReference: "ISA 230" },
      { id: "critical-exceptions-resolved", label: "Critical exceptions resolved", type: "hard", description: "All misstatements exceeding performance materiality must be resolved or reported", isaReference: "ISA 450" },
      { id: "conclusions-documented", label: "Conclusions documented", type: "hard", description: "All completed procedures must have a conclusion recorded", isaReference: "ISA 230" },
      { id: "review-notes-cleared", label: "Review notes cleared", type: "soft", description: "At least 75% of review notes should be resolved", isaReference: "ISA 220" },
      { id: "evidence-attached", label: "Evidence attached", type: "soft", description: "Procedures should have supporting evidence files linked", isaReference: "ISA 500" },
    ],
    rolePermissions: { canPrepare: ALL_ROLES, canReview: SENIOR_UP, canApprove: MANAGER_UP, canView: ALL_ROLES },
    aiCapabilities: ["execution-documentation-narration", "test-result-summary", "exception-wording", "conclusion-draft"],
    outputArtifacts: ["Workpapers", "Test results", "Control test conclusions", "Substantive test conclusions", "Exception reports", "Procedure conclusions"],
  },
  {
    key: "evidence-linking",
    label: "Evidence Linking",
    description: "Link supporting documents and source evidence to workpapers, verify sufficiency and appropriateness per ISA 500",
    routeSlug: "evidence-linking",
    order: 12,
    group: "fieldwork",
    backendPhase: "EXECUTION",
    prerequisiteKeys: ["execution-testing"],
    requiredInputs: ["Supporting documents", "Source references"],
    completionGates: [
      { id: "evidence-linked", label: "Evidence linked to procedures", type: "hard", description: "All executed procedures must have at least one linked evidence file", isaReference: "ISA 500" },
      { id: "evidence-categorized", label: "Evidence categorized", type: "hard", description: "All evidence files must be categorized with source type for reliability assessment", isaReference: "ISA 500" },
      { id: "sufficiency-confirmed", label: "Evidence sufficiency confirmed", type: "hard", description: "All high-risk procedures must have evidence rated Adequate or Strong", isaReference: "ISA 500" },
      { id: "version-history-maintained", label: "Version history maintained", type: "soft", description: "Superseded files should have documented reasons", isaReference: "ISA 230" },
      { id: "reviewer-comments-addressed", label: "Reviewer comments addressed", type: "soft", description: "Evidence reviewer notes should be resolved", isaReference: "ISA 220" },
    ],
    rolePermissions: { canPrepare: ALL_ROLES, canReview: SENIOR_UP, canApprove: MANAGER_UP, canView: ALL_ROLES },
    aiCapabilities: ["evidence-sufficiency-prompts", "missing-evidence-alerts", "evidence-description-suggestions"],
    outputArtifacts: ["Evidence vault", "Linked documents", "Sufficiency assessment", "Traceability matrix"],
  },
  {
    key: "observations",
    label: "Observations / Findings",
    description: "Document audit findings, internal control deficiencies, and management letter points per ISA 265",
    routeSlug: "observations",
    order: 13,
    group: "fieldwork",
    backendPhase: "EXECUTION",
    prerequisiteKeys: ["execution-testing"],
    requiredInputs: ["Exceptions", "Findings", "Review notes"],
    completionGates: [
      { id: "critical-findings-resolved", label: "Critical findings resolved", type: "hard", description: "All critical and high-severity findings must be resolved or escalated" },
      { id: "review-notes-cleared", label: "Review notes cleared", type: "soft", description: "Open review notes should be addressed" },
    ],
    rolePermissions: { canPrepare: ALL_ROLES, canReview: MANAGER_UP, canApprove: PARTNER_UP, canView: ALL_ROLES },
    aiCapabilities: ["observation-wording", "management-letter-drafting"],
    outputArtifacts: ["Findings register", "Management letter draft"],
  },
  {
    key: "adjustments",
    label: "Adjustments / Misstatements",
    description: "Evaluate and classify misstatements, prepare summary of adjusted and unadjusted differences per ISA 450",
    routeSlug: "adjustments",
    order: 14,
    group: "fieldwork",
    backendPhase: "EXECUTION",
    prerequisiteKeys: ["execution-testing"],
    requiredInputs: ["Proposed adjustments", "SAD schedule", "Management responses"],
    completionGates: [
      { id: "adjustments-summarized", label: "Adjustment summary prepared", type: "hard", description: "Summary of adjusted and unadjusted differences must be prepared" },
      { id: "sad-classified", label: "SAD classified", type: "soft", description: "Clearly trivial vs significant misstatements should be classified" },
    ],
    rolePermissions: { canPrepare: ALL_ROLES, canReview: MANAGER_UP, canApprove: PARTNER_UP, canView: ALL_ROLES },
    aiCapabilities: ["misstatement-summary-drafting"],
    outputArtifacts: ["Adjustment schedule", "SAD summary"],
  },
  {
    key: "finalization",
    label: "Finalization",
    description: "Complete subsequent events review, going concern assessment, representation letter, and completion checklist per ISA 560/570/580",
    routeSlug: "finalization",
    order: 15,
    group: "completion",
    backendPhase: "FINALIZATION",
    prerequisiteKeys: ["execution-testing", "evidence-linking", "observations", "adjustments"],
    requiredInputs: ["Completion checklist", "Subsequent events", "Going concern", "Representation letter"],
    completionGates: [
      { id: "completion-checklist", label: "Completion checklist done", type: "hard", description: "All finalization checklist items must be addressed" },
      { id: "subsequent-events", label: "Subsequent events reviewed", type: "hard", description: "Subsequent events must be reviewed up to report date", isaReference: "ISA 560" },
      { id: "going-concern", label: "Going concern assessed", type: "hard", description: "Going concern assessment must be documented", isaReference: "ISA 570" },
      { id: "representation-letter", label: "Representation letter status", type: "soft", description: "Management representation letter should be obtained", isaReference: "ISA 580" },
    ],
    rolePermissions: { canPrepare: SENIOR_UP, canReview: MANAGER_UP, canApprove: PARTNER_UP, canView: ALL_ROLES },
    aiCapabilities: ["completion-memo-drafting"],
    outputArtifacts: ["Completion memo", "Finalization checklist"],
  },
  {
    key: "opinion-reports",
    label: "Opinion / Reports",
    description: "Form audit opinion, generate audit report, management letter, and deliverables pack per ISA 700/705/706",
    routeSlug: "opinion-reports",
    order: 16,
    group: "completion",
    backendPhase: "REPORTING",
    prerequisiteKeys: ["finalization"],
    requiredInputs: ["Opinion type", "Report drafts", "Deliverables"],
    completionGates: [
      { id: "finalization-approved", label: "Finalization approved", type: "hard", description: "Finalization phase must be approved before generating opinion" },
      { id: "opinion-determined", label: "Audit opinion determined", type: "hard", description: "Audit opinion type must be selected and documented", isaReference: "ISA 700" },
      { id: "reports-generated", label: "Reports generated", type: "soft", description: "Final audit report should be generated" },
    ],
    rolePermissions: { canPrepare: MANAGER_UP, canReview: PARTNER_UP, canApprove: PARTNER_UP, canView: ALL_ROLES },
    aiCapabilities: ["audit-opinion-support-text"],
    outputArtifacts: ["Audit report", "Management letter", "Deliverables pack"],
  },
  {
    key: "eqcr",
    label: "EQCR Review",
    description: "Engagement Quality Control Review — independent reviewer evaluates significant judgments and conclusions per ISQM-1",
    routeSlug: "eqcr",
    order: 17,
    group: "quality",
    backendPhase: "EQCR",
    prerequisiteKeys: ["opinion-reports"],
    requiredInputs: ["Report pack", "EQCR checklist"],
    completionGates: [
      { id: "report-pack-frozen", label: "Report pack frozen", type: "hard", description: "Report pack must be frozen before EQCR review" },
      { id: "eqcr-issues-resolved", label: "EQCR issues resolved", type: "hard", description: "All EQCR issues must be resolved or accepted" },
      { id: "eqcr-release", label: "EQCR release signed", type: "hard", description: "EQCR reviewer must sign off on release" },
    ],
    rolePermissions: { canPrepare: EQCR_ONLY, canReview: EQCR_ONLY, canApprove: EQCR_ONLY, canView: MANAGER_UP },
    aiCapabilities: ["eqcr-readiness-summary"],
    outputArtifacts: ["EQCR checklist", "Release clearance"],
  },
  {
    key: "inspection",
    label: "Inspection Archive",
    description: "Create immutable archive snapshot of completed engagement for regulatory inspection and firm quality review",
    routeSlug: "inspection",
    order: 18,
    group: "quality",
    backendPhase: "INSPECTION",
    prerequisiteKeys: ["eqcr"],
    requiredInputs: [],
    completionGates: [
      { id: "eqcr-released", label: "EQCR released", type: "hard", description: "EQCR must be released before archiving" },
      { id: "archive-snapshot", label: "Archive snapshot created", type: "hard", description: "Immutable archive snapshot must be created" },
    ],
    rolePermissions: { canPrepare: PARTNER_UP, canReview: PARTNER_UP, canApprove: PARTNER_UP, canView: MANAGER_UP },
    aiCapabilities: [],
    outputArtifacts: ["Inspection archive pack"],
  },
];

export function getPhaseByKey(key: string): CanonicalPhase | undefined {
  return CANONICAL_PHASES.find(p => p.key === key);
}

export function getPhaseBySlug(slug: string): CanonicalPhase | undefined {
  return CANONICAL_PHASES.find(p => p.routeSlug === slug);
}

export function getPhaseByOrder(order: number): CanonicalPhase | undefined {
  return CANONICAL_PHASES.find(p => p.order === order);
}

export function getNextPhase(currentKey: string): CanonicalPhase | undefined {
  const current = getPhaseByKey(currentKey);
  if (!current) return undefined;
  return getPhaseByOrder(current.order + 1);
}

export function getPreviousPhase(currentKey: string): CanonicalPhase | undefined {
  const current = getPhaseByKey(currentKey);
  if (!current || current.order === 0) return undefined;
  return getPhaseByOrder(current.order - 1);
}

export function getPrerequisitePhases(key: string): CanonicalPhase[] {
  const phase = getPhaseByKey(key);
  if (!phase) return [];
  return phase.prerequisiteKeys.map(k => getPhaseByKey(k)).filter(Boolean) as CanonicalPhase[];
}

export function getWorkspacePhases(): CanonicalPhase[] {
  return CANONICAL_PHASES.filter(p => p.order >= 2);
}

export const BACKEND_PHASE_MAP: Record<string, string[]> = {};
for (const phase of CANONICAL_PHASES) {
  if (!BACKEND_PHASE_MAP[phase.backendPhase]) {
    BACKEND_PHASE_MAP[phase.backendPhase] = [];
  }
  BACKEND_PHASE_MAP[phase.backendPhase].push(phase.key);
}

export const SLUG_TO_BACKEND_PHASE: Record<string, string> = {};
for (const phase of CANONICAL_PHASES) {
  SLUG_TO_BACKEND_PHASE[phase.routeSlug] = phase.backendPhase;
}

export const OLD_ROUTE_TO_NEW_SLUG: Record<string, string> = {
  "pre-planning": "acceptance",
  "requisition": "tb-gl-upload",
  "planning": "materiality",
  "execution": "execution-testing",
  "fs-heads": "coa-mapping",
  "evidence": "evidence-linking",
  "checklists": "execution-testing",
  "finalization": "finalization",
  "deliverables": "opinion-reports",
  "eqcr": "eqcr",
  "inspection": "inspection",
  "onboarding": "acceptance",
  "control": "acceptance",
  "ethics": "independence",
  "tb-review": "validation",
  "import": "tb-gl-upload",
  "outputs": "opinion-reports",
  "observations": "observations",
  "post-upload-workflow": "validation",
  "audit-health": "execution-testing",
  "workflow-health": "execution-testing",
  "qcr-dashboard": "inspection",
  "standards-matrix": "procedures-sampling",
  "compliance-simulation": "procedures-sampling",
};

export const PHASE_GROUP_LABELS: Record<string, string> = {
  onboarding: "Onboarding",
  data: "Data Import",
  planning: "Planning",
  fieldwork: "Fieldwork",
  completion: "Completion",
  quality: "Quality & Archive",
};

export const PHASE_GROUP_ORDER: string[] = [
  "onboarding",
  "data",
  "planning",
  "fieldwork",
  "completion",
  "quality",
];
