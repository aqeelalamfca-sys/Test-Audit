import { prisma } from "../db";
import { CANONICAL_PHASES, getPhaseByKey, type CanonicalPhase } from "../../shared/phases";
import { generateAIContent } from "./aiService";

export interface PhaseAICapability {
  id: string;
  label: string;
  description: string;
  promptType: string;
  requiresContext: string[];
  isaReference?: string;
}

export interface PhaseAIConfig {
  phaseKey: string;
  phaseLabel: string;
  capabilities: PhaseAICapability[];
  systemPromptOverride?: string;
  contextFields: string[];
}

export interface AIGenerationRequest {
  engagementId: string;
  phaseKey: string;
  capabilityId: string;
  additionalContext?: Record<string, string>;
  firmId?: string;
}

export interface AIGenerationResult {
  content: string;
  capabilityId: string;
  phaseKey: string;
  provider: string;
  disclaimer: string;
  generatedAt: string;
  contextUsed: string[];
}

const AI_CAPABILITY_REGISTRY: Record<string, PhaseAICapability[]> = {
  "client-summary-draft": [
    {
      id: "client-summary-draft",
      label: "Draft Client Summary",
      description: "Generate a summary of the client profile based on entered data",
      promptType: "client_summary",
      requiresContext: ["client_profile"],
    },
  ],
  "engagement-setup-summary": [
    {
      id: "engagement-setup-summary",
      label: "Engagement Setup Summary",
      description: "Summarize the engagement setup including team, scope, and timeline",
      promptType: "engagement_summary",
      requiresContext: ["engagement_profile", "team_members"],
    },
  ],
  "missing-field-alerts": [
    {
      id: "missing-field-alerts",
      label: "Missing Field Alerts",
      description: "Identify incomplete or missing required fields in the current form and suggest values",
      promptType: "missing_fields",
      requiresContext: ["form_data", "required_fields"],
    },
  ],
  "acceptance-summary-draft": [
    {
      id: "acceptance-summary-draft",
      label: "Draft Acceptance Summary",
      description: "Generate a summary narrative for the acceptance and continuance assessment",
      promptType: "acceptance_summary",
      requiresContext: ["client_profile", "engagement_type", "acceptance_factors"],
      isaReference: "ISA 220",
    },
  ],
  "conclusion-wording": [
    {
      id: "conclusion-wording",
      label: "Conclusion Wording Assistant",
      description: "Draft professional conclusion text based on assessment results and findings",
      promptType: "conclusion_draft",
      requiresContext: ["assessment_results", "findings"],
    },
  ],
  "ethics-warning-alerts": [
    {
      id: "ethics-warning-alerts",
      label: "Ethics Warning Alerts",
      description: "Identify potential ethical conflicts and independence threats requiring attention",
      promptType: "ethics_alerts",
      requiresContext: ["client_profile", "team_members", "declarations"],
      isaReference: "IESBA Code",
    },
  ],
  "missing-declaration-summary": [
    {
      id: "missing-declaration-summary",
      label: "Missing Declaration Summary",
      description: "Summarize outstanding independence declarations and suggest follow-up actions",
      promptType: "declaration_summary",
      requiresContext: ["declarations", "team_members"],
      isaReference: "IESBA Code",
    },
  ],
  "acceptance-checklist-drafting": [
    {
      id: "acceptance-checklist-drafting",
      label: "Draft Acceptance Checklist",
      description: "Generate a pre-filled acceptance and continuance checklist based on client profile and engagement history",
      promptType: "acceptance_checklist",
      requiresContext: ["client_profile", "engagement_type"],
      isaReference: "ISA 220",
    },
  ],
  "ethics-warning-suggestions": [
    {
      id: "ethics-warning-suggestions",
      label: "Ethics & Independence Warnings",
      description: "Identify potential ethics and independence threats based on client relationships and services",
      promptType: "ethics_warnings",
      requiresContext: ["client_profile", "team_members", "non_audit_services"],
      isaReference: "IESBA Code",
    },
  ],
  "upload-template-guidance": [
    {
      id: "upload-template-guidance",
      label: "Upload Template Guidance",
      description: "Explain expected file format, required columns, and common template issues for TB/GL uploads",
      promptType: "template_guidance",
      requiresContext: ["file_type", "template_structure"],
    },
  ],
  "validation-error-explainer": [
    {
      id: "validation-error-explainer",
      label: "Explain Validation Errors",
      description: "Explain validation errors in simple language and help users understand what went wrong",
      promptType: "validation_explainer",
      requiresContext: ["validation_errors", "data_context"],
    },
  ],
  "corrective-action-suggestions": [
    {
      id: "corrective-action-suggestions",
      label: "Suggest Corrective Actions",
      description: "Recommend specific corrective actions to resolve validation blockers and warnings",
      promptType: "corrective_actions",
      requiresContext: ["validation_errors", "data_sample"],
    },
  ],
  "data-quality-summary": [
    {
      id: "data-quality-summary",
      label: "Data Quality Summary",
      description: "Provide an overall data quality assessment summarizing passed checks, warnings, and blockers",
      promptType: "quality_summary",
      requiresContext: ["validation_results", "tb_summary", "gl_summary"],
    },
  ],
  "data-quality-explanations": [
    {
      id: "data-quality-explanations",
      label: "Data Quality Analysis",
      description: "Explain data quality issues found during TB/GL validation and suggest corrections",
      promptType: "data_quality_analysis",
      requiresContext: ["validation_results", "tb_summary"],
    },
  ],
  "coa-mapping-suggestions": [
    {
      id: "coa-mapping-suggestions",
      label: "CoA Mapping Suggestions",
      description: "Suggest FS line item mappings for unmapped chart of accounts entries based on account names, codes, and industry context",
      promptType: "coa_mapping",
      requiresContext: ["unmapped_accounts", "fs_heads", "industry"],
    },
  ],
  "unmapped-account-explainer": [
    {
      id: "unmapped-account-explainer",
      label: "Unmapped Account Explainer",
      description: "Explain why certain accounts remain unmapped, suggest possible FS classifications, and flag accounts that should be parked vs mapped",
      promptType: "unmapped_analysis",
      requiresContext: ["unmapped_accounts", "account_names", "industry"],
    },
  ],
  "mapping-confidence-review": [
    {
      id: "mapping-confidence-review",
      label: "Mapping Confidence Review",
      description: "Review mapping assignments for confidence levels, flag low-confidence or unusual mappings, and suggest corrections based on industry norms",
      promptType: "mapping_review",
      requiresContext: ["mapped_accounts", "fs_heads", "mapping_scores", "industry"],
    },
  ],
  "materiality-narration-drafting": [
    {
      id: "materiality-narration-drafting",
      label: "Draft Materiality Memo",
      description: "Generate materiality determination narrative including benchmark rationale and ISA 320 compliance",
      promptType: "materiality_rationale",
      requiresContext: ["benchmark", "materiality_amounts", "financial_data"],
      isaReference: "ISA 320",
    },
  ],
  "benchmark-recommendation": [
    {
      id: "benchmark-recommendation",
      label: "Benchmark Recommendation",
      description: "Recommend the most appropriate materiality benchmark based on entity type, industry, and financial profile with supporting rationale",
      promptType: "benchmark_analysis",
      requiresContext: ["financial_data", "entity_type", "industry", "prior_year_benchmark"],
      isaReference: "ISA 320",
    },
  ],
  "materiality-linkage-summary": [
    {
      id: "materiality-linkage-summary",
      label: "Materiality Linkage Summary",
      description: "Summarize how materiality connects to FS heads, risk assessment, and planning strategy with downstream impact analysis",
      promptType: "materiality_linkage",
      requiresContext: ["materiality_amounts", "fs_heads", "risk_assessment"],
      isaReference: "ISA 320",
    },
  ],
  "risk-drafting-from-analytics": [
    {
      id: "risk-drafting-from-analytics",
      label: "Draft Risk Descriptions",
      description: "Generate risk descriptions from analytics results and FS movement analysis at entity, FS, and assertion levels",
      promptType: "risk_description",
      requiresContext: ["analytics_results", "fs_movements", "industry_risks", "materiality_thresholds"],
      isaReference: "ISA 315",
    },
  ],
  "fraud-risk-prompts": [
    {
      id: "fraud-risk-prompts",
      label: "Fraud Risk Assessment Prompts",
      description: "Generate fraud risk indicators and prompts based on entity profile, revenue patterns, and management override considerations",
      promptType: "fraud_risk_assessment",
      requiresContext: ["entity_profile", "revenue_data", "journal_entries", "related_parties"],
      isaReference: "ISA 240",
    },
  ],
  "missing-linkage-warnings": [
    {
      id: "missing-linkage-warnings",
      label: "Missing Linkage Warnings",
      description: "Identify gaps in risk-to-assertion linkage, unmapped FS areas, and risks without planned responses",
      promptType: "linkage_analysis",
      requiresContext: ["risk_register", "fs_heads", "assertions", "planned_procedures"],
      isaReference: "ISA 315",
    },
  ],
  "planning-memo-drafting": [
    {
      id: "planning-memo-drafting",
      label: "Draft Planning Memo",
      description: "Generate the audit planning memo covering strategy, scope, team allocation, timing, and key focus areas",
      promptType: "audit_strategy",
      requiresContext: ["risk_assessment", "materiality", "engagement_profile", "team_allocation", "scope_decisions"],
      isaReference: "ISA 300",
    },
  ],
  "procedure-suggestions": [
    {
      id: "procedure-suggestions",
      label: "Suggest Audit Procedures",
      description: "Recommend audit procedures based on identified risks and assertions",
      promptType: "audit_program_text",
      requiresContext: ["risks", "assertions", "fs_heads"],
      isaReference: "ISA 330",
    },
  ],
  "sample-rationale-wording": [
    {
      id: "sample-rationale-wording",
      label: "Draft Sampling Rationale",
      description: "Generate sampling approach documentation and rationale",
      promptType: "sampling_rationale",
      requiresContext: ["population_size", "risk_level", "materiality"],
      isaReference: "ISA 530",
    },
  ],
  "missing-procedure-coverage": [
    {
      id: "missing-procedure-coverage",
      label: "Missing Procedure Coverage Alerts",
      description: "Identify FS areas, assertions, or risks that lack linked procedures and suggest coverage improvements",
      promptType: "audit_program_text",
      requiresContext: ["risks", "assertions", "fs_heads", "procedures", "sampling_plans"],
      isaReference: "ISA 330",
    },
  ],
  "execution-documentation-narration": [
    {
      id: "execution-documentation-narration",
      label: "Draft Workpaper Narration",
      description: "Generate procedure narration and documentation for execution workpapers",
      promptType: "procedure_narrative",
      requiresContext: ["procedure_type", "test_results", "fs_head"],
      isaReference: "ISA 230",
    },
  ],
  "test-result-summary": [
    {
      id: "test-result-summary",
      label: "Summarize Test Results",
      description: "Generate a professional summary of test results for a procedure or FS head, including pass/fail ratios and key observations",
      promptType: "procedure_narrative",
      requiresContext: ["procedure_type", "test_results", "pass_fail_counts", "fs_head"],
      isaReference: "ISA 330",
    },
  ],
  "exception-wording": [
    {
      id: "exception-wording",
      label: "Draft Exception Wording",
      description: "Generate professional exception and misstatement wording for audit findings, including impact assessment and recommended actions",
      promptType: "observation_narrative",
      requiresContext: ["exception_type", "amount", "assertion", "fs_head", "materiality"],
      isaReference: "ISA 450",
    },
  ],
  "conclusion-draft": [
    {
      id: "conclusion-draft",
      label: "Draft Procedure Conclusion",
      description: "Generate a conclusion for a completed audit procedure based on test results, exceptions found, and evidence obtained",
      promptType: "procedure_narrative",
      requiresContext: ["procedure_type", "test_results", "exceptions", "evidence_summary", "fs_head", "risk_level"],
      isaReference: "ISA 230",
    },
  ],
  "evidence-sufficiency-prompts": [
    {
      id: "evidence-sufficiency-prompts",
      label: "Assess Evidence Sufficiency",
      description: "Evaluate whether audit evidence is sufficient and appropriate for the conclusions drawn",
      promptType: "evidence_sufficiency",
      requiresContext: ["workpapers", "linked_evidence", "assertions_covered"],
      isaReference: "ISA 500",
    },
  ],
  "missing-evidence-alerts": [
    {
      id: "missing-evidence-alerts",
      label: "Identify Missing Evidence",
      description: "Analyze procedures and workpapers to identify where supporting evidence is missing or insufficient per ISA 500 requirements",
      promptType: "gap_analysis",
      requiresContext: ["procedures", "linked_evidence", "risk_levels", "assertions"],
      isaReference: "ISA 500",
    },
  ],
  "evidence-description-suggestions": [
    {
      id: "evidence-description-suggestions",
      label: "Suggest Evidence Descriptions",
      description: "Generate appropriate descriptions and categorization for uploaded evidence files based on their content and audit context",
      promptType: "content_suggestion",
      requiresContext: ["file_name", "file_type", "procedure_context", "fs_head"],
      isaReference: "ISA 230",
    },
  ],
  "observation-wording": [
    {
      id: "observation-wording",
      label: "Draft Observation Wording",
      description: "Generate professional wording for audit observations and findings",
      promptType: "observation_narrative",
      requiresContext: ["finding_type", "impact", "management_response"],
    },
  ],
  "management-letter-drafting": [
    {
      id: "management-letter-drafting",
      label: "Draft Management Letter",
      description: "Generate management letter content from accumulated observations",
      promptType: "management_letter",
      requiresContext: ["findings", "recommendations", "management_responses"],
    },
  ],
  "recommendation-wording": [
    {
      id: "recommendation-wording",
      label: "Draft Recommendation",
      description: "Generate professional recommendation wording for audit observations per ISA 265",
      promptType: "recommendation_narrative",
      requiresContext: ["finding_type", "condition", "cause", "risk_implication"],
    },
  ],
  "misstatement-summary-drafting": [
    {
      id: "misstatement-summary-drafting",
      label: "Draft Misstatement Summary",
      description: "Summarize adjusted and unadjusted differences with impact assessment",
      promptType: "misstatement_summary",
      requiresContext: ["adjustments", "materiality", "classification"],
    },
  ],
  "adjustment-narrative": [
    {
      id: "adjustment-narrative",
      label: "Draft Adjustment Narrative",
      description: "Generate narrative description for proposed journal entries explaining the audit impact",
      promptType: "adjustment_narrative",
      requiresContext: ["adjustment_type", "accounts", "amounts", "observation"],
    },
  ],
  "sad-summary-narration": [
    {
      id: "sad-summary-narration",
      label: "Draft SAD Summary Narrative",
      description: "Generate Summary of Audit Differences narrative covering corrected/uncorrected misstatements, cumulative effect, and impact on opinion per ISA 450",
      promptType: "sad_summary",
      requiresContext: ["corrected_total", "uncorrected_total", "materiality", "cumulative_effect"],
    },
  ],
  "completion-memo-drafting": [
    {
      id: "completion-memo-drafting",
      label: "Draft Completion Memo",
      description: "Generate the completion memo summarizing audit results and conclusions",
      promptType: "completion_memo",
      requiresContext: ["findings_summary", "going_concern", "subsequent_events", "overall_conclusion"],
    },
  ],
  "subsequent-events-narration": [
    {
      id: "subsequent-events-narration",
      label: "Narrate Subsequent Events",
      description: "Generate ISA 560-compliant narration for subsequent events review including adjusting and non-adjusting events",
      promptType: "subsequent_events_narration",
      requiresContext: ["events_list", "balance_sheet_date", "report_date"],
      isaReference: "ISA 560",
    },
  ],
  "going-concern-wording": [
    {
      id: "going-concern-wording",
      label: "Draft Going Concern Wording",
      description: "Generate ISA 570-compliant going concern assessment wording based on financial indicators and management plans",
      promptType: "going_concern_wording",
      requiresContext: ["financial_indicators", "management_plans", "mitigating_factors"],
      isaReference: "ISA 570",
    },
  ],
  "unresolved-matters-summary": [
    {
      id: "unresolved-matters-summary",
      label: "Summarize Unresolved Matters",
      description: "Generate a summary of all unresolved audit matters for partner review and completion memo",
      promptType: "unresolved_matters",
      requiresContext: ["open_findings", "uncorrected_misstatements", "pending_responses", "outstanding_items"],
    },
  ],
  "audit-opinion-support-text": [
    {
      id: "audit-opinion-support-text",
      label: "Draft Opinion Support",
      description: "Generate supporting text for the audit opinion determination",
      promptType: "opinion_support",
      requiresContext: ["misstatements", "going_concern", "scope_limitations", "opinion_type"],
      isaReference: "ISA 700",
    },
  ],
  "eqcr-readiness-summary": [
    {
      id: "eqcr-readiness-summary",
      label: "EQCR Readiness Summary",
      description: "Generate a readiness summary for the engagement quality control review",
      promptType: "eqcr_readiness",
      requiresContext: ["report_pack_status", "open_issues", "sign_off_status"],
    },
  ],
};

const PHASE_SYSTEM_PROMPTS: Record<string, string> = {
  acceptance: `You are assisting with client acceptance and continuance evaluation.
Focus on ISA 220 requirements, engagement risks, and professional obligations.
Consider prior period issues, ethical considerations, and firm capacity.`,

  independence: `You are assisting with independence and ethics assessment.
Focus on IESBA Code of Ethics, independence threats, and safeguards.
Consider financial interests, non-audit services, and team relationships.`,

  "tb-gl-upload": `You are assisting with trial balance and general ledger data analysis.
Focus on data quality, completeness, and common import issues.
Explain technical data issues in plain audit language.`,

  validation: `You are assisting with data validation and reconciliation.
Focus on TB/GL reconciliation differences, data integrity, and validation rules.
Identify patterns that may indicate data quality problems.`,

  "coa-mapping": `You are assisting with chart of accounts normalization and financial statement mapping.
Focus on proper FS line item classification per the applicable reporting framework, lead schedule grouping, and mapping completeness.
Suggest mappings for unmapped accounts, explain why accounts may be difficult to classify, and flag low-confidence assignments.
Consider industry-specific presentation requirements, prior year mapping patterns, and ISA 315 significant account identification.`,

  materiality: `You are assisting with materiality determination per ISA 320.
Focus on benchmark selection rationale with supporting analysis, percentage justification, performance materiality calculation, and trivial threshold setting.
Draft materiality narration suitable for audit documentation, recommend benchmarks based on entity type and industry, and explain downstream linkage to risk assessment and planning.
Consider entity-specific qualitative factors including fraud risk, going concern, regulatory environment, and stakeholder expectations.`,

  "risk-assessment": `You are assisting with risk assessment per ISA 315 and ISA 240.
Organize risks at three levels: entity-level (going concern, regulatory, industry), financial statement level (pervasive misstatement risks), and assertion-level (existence, completeness, accuracy, valuation, rights, presentation).
Flag significant risks requiring special audit consideration. Address fraud risk including presumed risks (revenue recognition per ISA 240.26, management override per ISA 240.31).
Identify linkages between risks and related controls, and flag unmapped or unlinked risk areas.
Consider analytical triggers, related party indicators, and prior year findings.`,

  "planning-strategy": `You are assisting with overall audit strategy per ISA 300.
Cover: audit approach (substantive vs controls-reliant vs combined), scope decisions and component coverage, team allocation and expertise requirements, timing of procedures, use of experts and specialists, use of analytics, internal control reliance approach, and substantive approach planning.
Ensure the strategy responds to assessed risks from the risk assessment phase.
Flag any risk areas without planned responses or insufficient coverage.`,

  "procedures-sampling": `You are assisting with audit procedure design and sampling per ISA 330/530.
Design procedures linked to specific risks, FS heads, and assertions. For each FS area, ensure coverage of relevant assertions (existence, completeness, accuracy, valuation, rights, presentation).
Distinguish between control testing (tests of controls per ISA 330.8) and substantive testing (tests of details and analytical procedures per ISA 330.18).
For sampling: define populations clearly, select appropriate methods (statistical/non-statistical), determine sample sizes based on risk level and materiality, document selection basis and rationale.
Flag any high-risk areas without procedures, assertions without coverage, and sampling-dependent procedures without defined populations.
Consider the procedure library for standard templates and allow custom procedures for entity-specific needs.`,

  "execution-testing": `You are assisting with audit execution and testing per ISA 230/330/500/530.
Help auditors document procedures performed, test steps executed, results obtained, and conclusions drawn.
For control testing (ISA 330.8): document tests of operating effectiveness, assess design and implementation, record deviations and their impact on planned reliance.
For substantive testing (ISA 330.18): document tests of details, analytical procedures, sample items tested, pass/fail/exception outcomes, and misstatements found.
For workpaper narration: ensure clear, sufficient documentation per ISA 230 supporting the audit evidence chain — who performed, what was done, results, and conclusion.
For exceptions: provide professional wording including nature, amount, assertion affected, impact assessment, and whether the misstatement exceeds performance materiality.
For conclusions: summarize test results, evidence obtained, exceptions found, and the overall conclusion on the procedure objective.
Link every execution item back to: the originating procedure, assessed risk, FS head, and sample item where applicable.`,

  "evidence-linking": `You are assisting with evidence linking and evaluation per ISA 500 (Audit Evidence) and ISA 230 (Audit Documentation).
Focus on sufficiency and appropriateness of audit evidence for each procedure and assertion.
For sufficiency assessment: evaluate quantity of evidence relative to risk level — high-risk areas require more extensive evidence.
For appropriateness assessment: consider source reliability (external > internal), directness (direct > indirect), and form (original > copy).
ISA 500 source hierarchy: External third-party confirmations > External entity-prepared > Internal with strong controls > Internal with weak controls > Management representations.
Identify missing evidence gaps: procedures without linked files, high-risk areas with insufficient coverage, assertions without corroborating evidence.
For evidence descriptions: suggest clear, professional descriptions referencing the procedure, assertion, and FS area the evidence supports.
Link every evidence file back to: the originating procedure, workpaper, sample item, and FS head where applicable.`,

  observations: `You are assisting with audit findings and observations documentation.
Focus on clear articulation of condition, criteria, cause, and effect.
Draft findings suitable for management letters and governance communications.`,

  adjustments: `You are assisting with audit adjustments and misstatement analysis.
Focus on classifying misstatements (clearly trivial, individually significant, aggregated).
Consider the impact on the financial statements and audit opinion.`,

  finalization: `You are assisting with audit finalization and completion procedures. Focus on:
- ISA 560: Subsequent events review (adjusting vs non-adjusting events up to report date)
- ISA 570: Going concern assessment (financial/operating/external indicators, management plans, audit conclusions)
- ISA 580: Written representations (management representation letter completeness and dating)
- ISA 450: Evaluation of misstatements and resolution of findings
- ISA 520: Final analytical procedures (overall reasonableness check)
- ISA 700: Disclosure completeness review
Help the auditor summarize overall audit results, evaluate evidence sufficiency, identify unresolved matters, draft the completion memo, assess partner review readiness, and ensure all completion procedures are properly documented before opinion formation.`,

  "opinion-reports": `You are assisting with audit opinion formation per ISA 700-706.
Focus on the basis for opinion, key audit matters, and report modifications.
Never determine the opinion - only provide supporting analysis for the auditor's judgment.`,

  eqcr: `You are assisting with engagement quality control review.
Focus on identifying unresolved significant matters and completeness of documentation.
Summarize readiness for EQCR reviewer consideration.`,
};

export function getPhaseAIConfig(phaseKey: string): PhaseAIConfig | null {
  const phase = getPhaseByKey(phaseKey);
  if (!phase) return null;

  const capabilities: PhaseAICapability[] = [];
  for (const capKey of phase.aiCapabilities) {
    const caps = AI_CAPABILITY_REGISTRY[capKey];
    if (caps) {
      capabilities.push(...caps);
    }
  }

  return {
    phaseKey: phase.key,
    phaseLabel: phase.label,
    capabilities,
    systemPromptOverride: PHASE_SYSTEM_PROMPTS[phase.routeSlug],
    contextFields: capabilities.flatMap(c => c.requiresContext).filter((v, i, a) => a.indexOf(v) === i),
  };
}

export function getAllPhaseAIConfigs(): PhaseAIConfig[] {
  return CANONICAL_PHASES
    .filter(p => p.aiCapabilities.length > 0)
    .map(p => getPhaseAIConfig(p.key)!)
    .filter(Boolean);
}

async function gatherPhaseContext(
  engagementId: string,
  phaseKey: string,
  contextFields: string[]
): Promise<Record<string, string>> {
  const context: Record<string, string> = {};

  const engagement = await prisma.engagement.findUnique({
    where: { id: engagementId },
    include: { client: true },
  });

  if (!engagement) return context;

  context.engagement_type = engagement.engagementType || "statutory audit";
  context.period = `${engagement.periodStart?.toISOString().split("T")[0] || "N/A"} to ${engagement.periodEnd?.toISOString().split("T")[0] || "N/A"}`;
  context.client_name = engagement.client?.name || "Unknown";
  context.industry = engagement.client?.industry || "General";

  if (contextFields.includes("client_profile")) {
    context.client_profile = JSON.stringify({
      name: engagement.client?.name,
      industry: engagement.client?.industry,
      type: engagement.client?.entityType,
      registrationNumber: engagement.client?.registrationNumber,
    });
  }

  if (contextFields.includes("tb_summary") || contextFields.includes("financial_data")) {
    const tbLines = await prisma.trialBalanceLine.findMany({
      where: { engagementId },
      select: { accountName: true, debit: true, credit: true },
      take: 50,
    });
    if (tbLines.length > 0) {
      const totalDebit = tbLines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
      const totalCredit = tbLines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
      context.financial_data = `TB: ${tbLines.length} accounts, Total DR: ${totalDebit.toLocaleString()}, Total CR: ${totalCredit.toLocaleString()}`;
      context.tb_summary = context.financial_data;
    }
  }

  if (contextFields.includes("materiality") || contextFields.includes("materiality_amounts")) {
    const mat = await prisma.materialityCalculation.findFirst({
      where: { engagementId },
      orderBy: { createdAt: "desc" },
    });
    if (mat) {
      context.materiality = `Overall: ${mat.overallMateriality}, PM: ${mat.performanceMateriality}, Trivial: ${mat.trivialThreshold || "N/A"}, Benchmark: ${mat.benchmark}`;
      context.materiality_amounts = context.materiality;
    }
  }

  if (contextFields.includes("risks") || contextFields.includes("risk_assessment")) {
    const risks = await prisma.riskAssessment.findMany({
      where: { engagementId },
      select: { riskTitle: true, riskLevel: true, riskCategory: true, assertion: true },
      take: 20,
    });
    if (risks.length > 0) {
      context.risks = JSON.stringify(risks);
      context.risk_assessment = `${risks.length} risks identified: ${risks.map(r => `${r.riskTitle} (${r.riskLevel})`).join("; ")}`;
    }
  }

  if (contextFields.includes("findings") || contextFields.includes("findings_summary")) {
    const observations = await prisma.observation.findMany({
      where: { engagementId },
      select: { title: true, severity: true, status: true },
    });
    if (observations.length > 0) {
      context.findings = JSON.stringify(observations);
      context.findings_summary = `${observations.length} findings: ${observations.filter(o => o.severity === "HIGH" || o.severity === "CRITICAL").length} high/critical`;
    }
  }

  if (contextFields.includes("adjustments")) {
    const adjustments = await prisma.auditAdjustment.findMany({
      where: { engagementId },
      select: { description: true, adjustmentType: true, amount: true, status: true },
    });
    if (adjustments.length > 0) {
      context.adjustments = JSON.stringify(adjustments);
    }
  }

  if (contextFields.includes("unmapped_accounts")) {
    const unmapped = await prisma.coAAccount.findMany({
      where: { engagementId, fsLineItem: null },
      select: { accountCode: true, accountName: true },
      take: 30,
    });
    if (unmapped.length > 0) {
      context.unmapped_accounts = JSON.stringify(unmapped);
    }
  }

  if (contextFields.includes("fs_heads")) {
    const fsHeads = await prisma.fSHead.findMany({
      where: { engagementId },
      select: { name: true, category: true },
    });
    if (fsHeads.length > 0) {
      context.fs_heads = JSON.stringify(fsHeads);
    }
  }

  return context;
}

export async function generatePhaseAIContent(
  request: AIGenerationRequest
): Promise<AIGenerationResult> {
  const config = getPhaseAIConfig(request.phaseKey);
  if (!config) {
    throw new Error(`No AI configuration found for phase: ${request.phaseKey}`);
  }

  const capability = config.capabilities.find(c => c.id === request.capabilityId);
  if (!capability) {
    throw new Error(`AI capability '${request.capabilityId}' not available for phase '${request.phaseKey}'`);
  }

  const context = await gatherPhaseContext(
    request.engagementId,
    request.phaseKey,
    capability.requiresContext
  );

  if (request.additionalContext) {
    Object.assign(context, request.additionalContext);
  }

  const contextString = Object.entries(context)
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");

  const systemPrompt = config.systemPromptOverride
    ? `${config.systemPromptOverride}\n\nIMPORTANT: Your output is AI-ASSISTED and SUBJECT TO PROFESSIONAL JUDGMENT. You do NOT replace auditor judgment, decisions, approvals, or conclusions.`
    : `You are an expert statutory auditor. Provide structured, ISA-compliant content.\nIMPORTANT: Your output is AI-ASSISTED and SUBJECT TO PROFESSIONAL JUDGMENT.`;

  async function getAISettings(firmId?: string): Promise<Record<string, unknown>> {
    if (firmId) {
      const settings = await prisma.aISettings.findUnique({
        where: { firmId },
      }).catch(() => null);
      if (settings?.aiEnabled) {
        return {
          aiEnabled: settings.aiEnabled,
          preferredProvider: settings.preferredProvider,
          providerPriority: settings.providerPriority,
          openaiApiKey: settings.openaiApiKey || process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
          openaiEnabled: settings.openaiEnabled,
          geminiApiKey: settings.geminiApiKey,
          geminiEnabled: settings.geminiEnabled,
          deepseekApiKey: settings.deepseekApiKey,
          deepseekEnabled: settings.deepseekEnabled,
          maxTokensPerResponse: settings.maxTokensPerResponse,
          requestTimeout: settings.requestTimeout,
        };
      }
    }
    return {
      aiEnabled: true,
      preferredProvider: "openai",
      providerPriority: ["openai"],
      openaiApiKey: process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      openaiEnabled: true,
      geminiEnabled: false,
      deepseekEnabled: false,
      maxTokensPerResponse: 3000,
      requestTimeout: 60000,
    };
  }

  const settings = await getAISettings(request.firmId);
  const result = await generateAIContent(settings as unknown as Parameters<typeof generateAIContent>[0], {
    prompt: `${capability.description}\n\nCapability: ${capability.label}\nPhase: ${config.phaseLabel}${capability.isaReference ? `\nISA Reference: ${capability.isaReference}` : ""}`,
    context: contextString,
    systemPrompt,
    maxTokens: 3000,
    temperature: 0.3,
  });

  if (result.error) {
    throw new Error(`AI generation failed: ${result.error}`);
  }

  return {
    content: result.content,
    capabilityId: request.capabilityId,
    phaseKey: request.phaseKey,
    provider: result.provider,
    disclaimer: "AI-assisted — subject to professional judgment",
    generatedAt: new Date().toISOString(),
    contextUsed: Object.keys(context),
  };
}
