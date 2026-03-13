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
      description: "Suggest FS line item mappings for unmapped chart of accounts entries",
      promptType: "coa_mapping",
      requiresContext: ["unmapped_accounts", "fs_heads", "industry"],
    },
  ],
  "materiality-narration-drafting": [
    {
      id: "materiality-narration-drafting",
      label: "Draft Materiality Memo",
      description: "Generate materiality determination narrative including benchmark rationale",
      promptType: "materiality_rationale",
      requiresContext: ["benchmark", "materiality_amounts", "financial_data"],
      isaReference: "ISA 320",
    },
  ],
  "risk-drafting-from-analytics": [
    {
      id: "risk-drafting-from-analytics",
      label: "Draft Risk Descriptions",
      description: "Generate risk descriptions from analytics results and FS movement analysis",
      promptType: "risk_description",
      requiresContext: ["analytics_results", "fs_movements", "industry_risks"],
      isaReference: "ISA 315",
    },
  ],
  "planning-memo-drafting": [
    {
      id: "planning-memo-drafting",
      label: "Draft Planning Memo",
      description: "Generate the audit planning memo covering strategy, approach, and key focus areas",
      promptType: "audit_strategy",
      requiresContext: ["risk_assessment", "materiality", "engagement_profile"],
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
  "misstatement-summary-drafting": [
    {
      id: "misstatement-summary-drafting",
      label: "Draft Misstatement Summary",
      description: "Summarize adjusted and unadjusted differences with impact assessment",
      promptType: "misstatement_summary",
      requiresContext: ["adjustments", "materiality", "classification"],
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

  "coa-mapping": `You are assisting with chart of accounts and financial statement mapping.
Focus on proper FS line item classification per applicable framework.
Consider industry-specific presentation requirements.`,

  materiality: `You are assisting with materiality determination per ISA 320.
Focus on benchmark selection rationale, percentage justification, and performance materiality.
Consider entity-specific qualitative factors.`,

  "risk-assessment": `You are assisting with risk assessment per ISA 315 and ISA 240.
Focus on inherent risk, control risk, and significant risks including fraud.
Consider industry risks, entity-specific factors, and FS assertion-level risks.`,

  "planning-strategy": `You are assisting with overall audit strategy per ISA 300.
Focus on audit approach, resource allocation, and key areas of focus.
Consider timing, scope, and nature of planned procedures.`,

  "procedures-sampling": `You are assisting with audit procedure design and sampling per ISA 330/530.
Focus on linking procedures to assessed risks and determining sample sizes.
Consider the appropriateness of testing approaches for each assertion.`,

  "execution-testing": `You are assisting with audit execution documentation per ISA 230.
Focus on clear documentation of procedures performed, results obtained, and conclusions drawn.
Ensure workpaper narration supports the audit evidence chain.`,

  "evidence-linking": `You are assisting with evidence evaluation per ISA 500.
Focus on sufficiency and appropriateness of audit evidence.
Consider whether evidence supports the conclusions at assertion level.`,

  observations: `You are assisting with audit findings and observations documentation.
Focus on clear articulation of condition, criteria, cause, and effect.
Draft findings suitable for management letters and governance communications.`,

  adjustments: `You are assisting with audit adjustments and misstatement analysis.
Focus on classifying misstatements (clearly trivial, individually significant, aggregated).
Consider the impact on the financial statements and audit opinion.`,

  finalization: `You are assisting with audit completion per ISA 560, 570, and 580.
Focus on subsequent events, going concern assessment, and representation letters.
Ensure all completion procedures are properly documented.`,

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
