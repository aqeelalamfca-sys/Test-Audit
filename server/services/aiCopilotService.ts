import { prisma } from "../db";
import { generateAIContent } from "./aiService";

export interface CopilotContext {
  engagementId: string;
  userId: string;
  userRole: string;
  currentFsHead?: string;
  auditPhase: string;
  riskLevel?: string;
  materialityThreshold?: number;
  performanceMateriality?: number;
}

export interface CopilotObservation {
  id: string;
  type: "warning" | "info" | "critical" | "suggestion";
  category: "missing_procedure" | "unaddressed_risk" | "weak_conclusion" | "insufficient_evidence" | "isa_compliance" | "linkage_gap" | "materiality_breach" | "quality_issue";
  observation: string;
  whyItMatters: string;
  isaReference?: string;
  suggestedAction: string;
  priority: "high" | "medium" | "low";
  fsHead?: string;
  relatedEntityId?: string;
  relatedEntityType?: string;
  timestamp: Date;
  dismissed: boolean;
}

export interface CopilotResponse {
  observations: CopilotObservation[];
  linkageStatus: LinkageStatus;
  qualityScore: number;
  isaComplianceScore: number;
  isaScores?: Record<string, { score: number; weight: number; description: string }>;
  disclaimer: string;
}

export interface LinkageStatus {
  risksWithoutProcedures: number;
  proceduresWithoutEvidence: number;
  fsHeadsWithoutConclusion: number;
  adjustmentsNotPosted: number;
  totalGaps: number;
}

const COPILOT_SYSTEM_PROMPT = `You are an Always-On AI Audit Co-Pilot embedded across the entire audit platform.

ROLE: You operate continuously, context-aware, and non-intrusively. Your purpose is to assist, guide, validate, and flag risks — NEVER to replace professional judgment.

GLOBAL OBJECTIVE:
- Improve audit quality
- Reduce human error  
- Enforce ISA / ISQM-1 compliance
- Save auditor time
- Maintain full audit defensibility

BEHAVIOR RULES:
1. CONTEXT AWARENESS: Never give generic advice — responses must be context-specific to the current FS Head, audit phase, risk level, materiality thresholds, and user role.
2. PROACTIVE ASSISTANCE: Highlight missing procedures, flag unaddressed risks, detect weak conclusions, identify insufficient evidence, warn when ISA requirements are unmet.
3. AI may suggest, never force. All final decisions remain human-controlled.

PROHIBITED ACTIONS (NEVER DO):
- Write or finalize conclusions
- Mark procedures as completed
- Approve or clear risks
- Post adjusting entries
- Override auditor decisions
- Reduce risk ratings without justification

RESPONSE FORMAT: For each observation, provide:
1. AI Observation: [What is observed]
2. Why It Matters: [ISA reference + risk impact]
3. Suggested Action: [What auditor may consider]

Always end with: "AI-assisted — subject to professional judgment"`;

const db = prisma as any;

function generateObservationId(category: string, engagementId: string, fsHead?: string, identifier?: string): string {
  const base = `obs-${category}-${engagementId.slice(0, 8)}`;
  if (fsHead) return `${base}-${fsHead}${identifier ? `-${identifier}` : ""}`;
  return `${base}${identifier ? `-${identifier}` : ""}`;
}

async function getDismissedObservationIds(engagementId: string): Promise<Set<string>> {
  const dismissedLogs = await db.aIAuditLog.findMany({
    where: {
      engagementId,
      action: "COPILOT_DISMISS_OBSERVATION",
    },
  });
  return new Set(dismissedLogs.map((log: any) => log.fieldKey).filter((id: string) => id && id !== "system"));
}

export async function analyzeFsHeadContext(
  context: CopilotContext,
  fsHeadKey: string
): Promise<CopilotObservation[]> {
  const observations: CopilotObservation[] = [];
  
  const fsHeadWP = await db.fSHeadWorkingPaper.findFirst({
    where: {
      engagementId: context.engagementId,
      fsHeadKey: fsHeadKey,
    },
    include: {
      procedures: true,
      attachments: true,
      testOfControls: true,
      testOfDetails: true,
      analyticalProcedures: true,
      adjustments: true,
    },
  });

  if (!fsHeadWP) return observations;

  const procedures = fsHeadWP.procedures || [];
  const attachments = fsHeadWP.attachments || [];
  const tocs = (fsHeadWP as any).testOfControls || [];
  const tods = (fsHeadWP as any).testOfDetails || [];
  const adjustments = fsHeadWP.adjustments || [];

  if (procedures.length === 0 && tocs.length === 0 && tods.length === 0) {
    observations.push({
      id: generateObservationId("missing_procedure", context.engagementId, fsHeadKey, "no-procedures"),
      type: "warning",
      category: "missing_procedure",
      observation: `No audit procedures (TOC, TOD, or custom procedures) have been documented for ${fsHeadKey}.`,
      whyItMatters: "ISA 330 requires the auditor to design and perform audit procedures responsive to the assessed risks. Without documented procedures, the audit cannot demonstrate an appropriate response to identified risks.",
      isaReference: "ISA 330.6",
      suggestedAction: "Consider adding Test of Controls (TOC) if relying on controls, or Test of Details (TOD) to obtain sufficient appropriate audit evidence.",
      priority: "high",
      fsHead: fsHeadKey,
      timestamp: new Date(),
      dismissed: false,
    });
  }

  if (attachments.length === 0) {
    observations.push({
      id: generateObservationId("insufficient_evidence", context.engagementId, fsHeadKey, "no-evidence"),
      type: "warning",
      category: "insufficient_evidence",
      observation: `No supporting evidence has been attached for ${fsHeadKey}.`,
      whyItMatters: "ISA 500 requires the auditor to obtain sufficient appropriate audit evidence. Evidence must be documented to support conclusions.",
      isaReference: "ISA 500.6",
      suggestedAction: "Upload relevant supporting documents, confirmations, or other evidence to the Evidence tab.",
      priority: "medium",
      fsHead: fsHeadKey,
      timestamp: new Date(),
      dismissed: false,
    });
  }

  if (!fsHeadWP.conclusion || fsHeadWP.conclusion.trim().length < 50) {
    observations.push({
      id: generateObservationId("weak_conclusion", context.engagementId, fsHeadKey, "incomplete"),
      type: "info",
      category: "weak_conclusion",
      observation: `The conclusion for ${fsHeadKey} appears incomplete or missing.`,
      whyItMatters: "ISA 230 requires documentation to be sufficient to enable an experienced auditor to understand the conclusions reached. Incomplete conclusions may result in inspection findings.",
      isaReference: "ISA 230.8",
      suggestedAction: "Draft a comprehensive conclusion that summarizes the work performed, findings, and overall assessment of the FS Head balance.",
      priority: "medium",
      fsHead: fsHeadKey,
      timestamp: new Date(),
      dismissed: false,
    });
  }

  const completedTocs = tocs.filter((t: any) => t.result && t.result !== "NOT_TESTED" && t.result !== "PENDING");
  const completedTods = tods.filter((t: any) => t.conclusion && t.conclusion.trim().length > 0);
  
  if (tocs.length > 0 && completedTocs.length < tocs.length) {
    observations.push({
      id: generateObservationId("missing_procedure", context.engagementId, fsHeadKey, "incomplete-toc"),
      type: "info",
      category: "missing_procedure",
      observation: `${tocs.length - completedTocs.length} Test of Controls remain untested for ${fsHeadKey}.`,
      whyItMatters: "ISA 330.8 requires testing of controls when the auditor intends to rely on their operating effectiveness.",
      isaReference: "ISA 330.8",
      suggestedAction: "Complete the remaining control tests or document why controls are not being relied upon.",
      priority: "medium",
      fsHead: fsHeadKey,
      timestamp: new Date(),
      dismissed: false,
    });
  }

  if (tods.length > 0 && completedTods.length < tods.length) {
    observations.push({
      id: generateObservationId("missing_procedure", context.engagementId, fsHeadKey, "incomplete-tod"),
      type: "info",
      category: "missing_procedure",
      observation: `${tods.length - completedTods.length} Tests of Details lack conclusions for ${fsHeadKey}.`,
      whyItMatters: "ISA 330.18 requires the auditor to document conclusions on audit procedures performed.",
      isaReference: "ISA 330.18",
      suggestedAction: "Document conclusions for all completed tests of details.",
      priority: "medium",
      fsHead: fsHeadKey,
      timestamp: new Date(),
      dismissed: false,
    });
  }

  const unpostedAdjustments = adjustments.filter((a: any) => !a.isPosted);
  if (unpostedAdjustments.length > 0) {
    const totalAmount = unpostedAdjustments.reduce((sum: number, a: any) => sum + Math.abs(a.debitAmount || 0), 0);
    observations.push({
      id: generateObservationId("quality_issue", context.engagementId, fsHeadKey, "unposted-adj"),
      type: "warning",
      category: "quality_issue",
      observation: `${unpostedAdjustments.length} adjusting entries totaling ${totalAmount.toLocaleString()} remain unposted for ${fsHeadKey}.`,
      whyItMatters: "ISA 450 requires the auditor to accumulate misstatements and evaluate their effect. Unposted adjustments may affect the financial statements.",
      isaReference: "ISA 450.5",
      suggestedAction: "Review pending adjustments and either post or document why they are not being posted.",
      priority: "high",
      fsHead: fsHeadKey,
      timestamp: new Date(),
      dismissed: false,
    });
  }

  return observations;
}

export async function analyzeEngagementLinkages(
  engagementId: string
): Promise<LinkageStatus> {
  const risks = await db.riskAssessment.findMany({
    where: { engagementId },
  });

  const risksWithProcedures = await db.riskAssessment.findMany({
    where: { 
      engagementId,
      auditProcedureIds: { isEmpty: false }
    },
  });

  const risksWithoutProcedures = risks.length - risksWithProcedures.length;

  const fsHeads = await db.fSHeadWorkingPaper.findMany({
    where: { engagementId },
    include: { procedures: true },
  });

  let proceduresWithoutEvidence = 0;
  for (const head of fsHeads) {
    for (const proc of (head.procedures || [])) {
      if (!proc.results && !proc.conclusion) {
        proceduresWithoutEvidence++;
      }
    }
  }

  const fsHeadsWithoutConclusion = fsHeads.filter((f: any) => !f.conclusion || f.conclusion.trim().length === 0).length;

  let adjustmentsNotPosted = 0;
  try {
    const adjustments = await db.fSHeadAdjustment.findMany({
      where: {
        workingPaper: { engagementId },
        isPosted: false,
      },
    });
    adjustmentsNotPosted = adjustments.length;
  } catch {
    adjustmentsNotPosted = 0;
  }

  return {
    risksWithoutProcedures,
    proceduresWithoutEvidence,
    fsHeadsWithoutConclusion,
    adjustmentsNotPosted,
    totalGaps: risksWithoutProcedures + proceduresWithoutEvidence + fsHeadsWithoutConclusion + adjustmentsNotPosted,
  };
}

export async function analyzeRiskCoverage(
  engagementId: string
): Promise<CopilotObservation[]> {
  const observations: CopilotObservation[] = [];

  const risks = await db.riskAssessment.findMany({
    where: { engagementId },
  });

  const highRisks = risks.filter((r: any) => r.inherentRisk === "HIGH" || r.riskOfMaterialMisstatement === "HIGH");
  const unaddressedHighRisks = highRisks.filter((r: any) => !r.auditProcedureIds || r.auditProcedureIds.length === 0);

  if (unaddressedHighRisks.length > 0) {
    observations.push({
      id: generateObservationId("unaddressed_risk", engagementId, undefined, "high-risk"),
      type: "critical",
      category: "unaddressed_risk",
      observation: `${unaddressedHighRisks.length} high-risk area(s) have no responsive audit procedures.`,
      whyItMatters: "ISA 330.6 requires the auditor to design audit procedures responsive to assessed risks. High-risk areas without procedures represent significant audit quality gaps.",
      isaReference: "ISA 330.6",
      suggestedAction: "Link or create audit procedures for each high-risk area to ensure appropriate audit coverage.",
      priority: "high",
      relatedEntityType: "risk",
      relatedEntityId: unaddressedHighRisks.map((r: any) => r.id).join(","),
      timestamp: new Date(),
      dismissed: false,
    });
  }

  const fraudRisks = risks.filter((r: any) => r.isFraudRisk || (r.riskDescription && r.riskDescription.toLowerCase().includes("fraud")));
  const unaddressedFraudRisks = fraudRisks.filter((r: any) => !r.auditProcedureIds || r.auditProcedureIds.length === 0);

  if (unaddressedFraudRisks.length > 0) {
    observations.push({
      id: generateObservationId("unaddressed_risk", engagementId, undefined, "fraud-risk"),
      type: "critical",
      category: "unaddressed_risk",
      observation: `${unaddressedFraudRisks.length} fraud risk(s) have no responsive audit procedures.`,
      whyItMatters: "ISA 240 requires specific procedures to address the risk of material misstatement due to fraud. Unaddressed fraud risks are a serious inspection finding.",
      isaReference: "ISA 240.28",
      suggestedAction: "Ensure all fraud risks have specific, targeted audit procedures designed to detect material fraud.",
      priority: "high",
      relatedEntityType: "risk",
      relatedEntityId: unaddressedFraudRisks.map((r: any) => r.id).join(","),
      timestamp: new Date(),
      dismissed: false,
    });
  }

  return observations;
}

const ISA_COMPLIANCE_WEIGHTS = {
  isa315RiskAssessment: { weight: 0.20, description: "ISA 315 - Risk Assessment" },
  isa330Procedures: { weight: 0.25, description: "ISA 330 - Audit Procedures" },
  isa500Evidence: { weight: 0.20, description: "ISA 500 - Audit Evidence" },
  isa230Documentation: { weight: 0.15, description: "ISA 230 - Documentation" },
  isa450Misstatements: { weight: 0.10, description: "ISA 450 - Misstatements" },
  isa240Fraud: { weight: 0.10, description: "ISA 240 - Fraud" },
};

export async function calculateISAComplianceScore(
  engagementId: string
): Promise<{ score: number; isaScores: Record<string, { score: number; weight: number; description: string }> }> {
  const isaScores: Record<string, { score: number; weight: number; description: string }> = {};

  const risks = await db.riskAssessment.findMany({ where: { engagementId } });
  const risksWithProcedures = risks.filter((r: any) => r.auditProcedureIds && r.auditProcedureIds.length > 0);
  isaScores.isa315RiskAssessment = {
    score: risks.length > 0 ? (risksWithProcedures.length / risks.length) * 100 : 100,
    weight: ISA_COMPLIANCE_WEIGHTS.isa315RiskAssessment.weight,
    description: ISA_COMPLIANCE_WEIGHTS.isa315RiskAssessment.description,
  };

  const procedures = await db.engagementProcedure.findMany({ where: { engagementId } });
  const completedProcedures = procedures.filter((p: any) => p.status === "COMPLETED" || p.conclusion);
  isaScores.isa330Procedures = {
    score: procedures.length > 0 ? (completedProcedures.length / procedures.length) * 100 : 100,
    weight: ISA_COMPLIANCE_WEIGHTS.isa330Procedures.weight,
    description: ISA_COMPLIANCE_WEIGHTS.isa330Procedures.description,
  };

  const proceduresWithEvidence = procedures.filter((p: any) => p.linkedAccountIds && p.linkedAccountIds.length > 0);
  isaScores.isa500Evidence = {
    score: procedures.length > 0 ? (proceduresWithEvidence.length / procedures.length) * 100 : 100,
    weight: ISA_COMPLIANCE_WEIGHTS.isa500Evidence.weight,
    description: ISA_COMPLIANCE_WEIGHTS.isa500Evidence.description,
  };

  const fsHeads = await db.fSHeadWorkingPaper.findMany({ where: { engagementId } });
  const fsHeadsWithConclusion = fsHeads.filter((f: any) => f.conclusion && f.conclusion.trim().length > 50);
  isaScores.isa230Documentation = {
    score: fsHeads.length > 0 ? (fsHeadsWithConclusion.length / fsHeads.length) * 100 : 100,
    weight: ISA_COMPLIANCE_WEIGHTS.isa230Documentation.weight,
    description: ISA_COMPLIANCE_WEIGHTS.isa230Documentation.description,
  };

  const adjustments = await db.fSHeadAdjustment.findMany({
    where: { workingPaper: { engagementId } },
  });
  const postedAdjustments = adjustments.filter((a: any) => a.isPosted);
  isaScores.isa450Misstatements = {
    score: adjustments.length > 0 ? (postedAdjustments.length / adjustments.length) * 100 : 100,
    weight: ISA_COMPLIANCE_WEIGHTS.isa450Misstatements.weight,
    description: ISA_COMPLIANCE_WEIGHTS.isa450Misstatements.description,
  };

  const fraudRisks = risks.filter((r: any) => r.isFraudRisk || (r.riskDescription && r.riskDescription.toLowerCase().includes("fraud")));
  const addressedFraudRisks = fraudRisks.filter((r: any) => r.auditProcedureIds && r.auditProcedureIds.length > 0);
  isaScores.isa240Fraud = {
    score: fraudRisks.length > 0 ? (addressedFraudRisks.length / fraudRisks.length) * 100 : 100,
    weight: ISA_COMPLIANCE_WEIGHTS.isa240Fraud.weight,
    description: ISA_COMPLIANCE_WEIGHTS.isa240Fraud.description,
  };

  const weightedScore = Object.values(isaScores).reduce((total, item) => {
    return total + (item.score * item.weight);
  }, 0);

  return { score: Math.round(weightedScore), isaScores };
}

export async function calculateQualityScore(
  engagementId: string
): Promise<{ score: number; factors: Record<string, number> }> {
  const factors: Record<string, number> = {};

  const linkages = await analyzeEngagementLinkages(engagementId);
  factors.linkageScore = linkages.totalGaps === 0 ? 100 : Math.max(0, 100 - (linkages.totalGaps * 10));

  const fsHeads = await db.fSHeadWorkingPaper.findMany({
    where: { engagementId },
    include: {
      procedures: true,
      attachments: true,
      testOfControls: true,
      testOfDetails: true,
    },
  });

  const totalFsHeads = fsHeads.length || 1;
  const withProcedures = fsHeads.filter((f: any) => (f.procedures?.length || 0) > 0 || (f.testOfControls?.length || 0) > 0 || (f.testOfDetails?.length || 0) > 0).length;
  const withEvidence = fsHeads.filter((f: any) => (f.attachments?.length || 0) > 0).length;
  const withConclusions = fsHeads.filter((f: any) => f.conclusion && f.conclusion.trim().length > 50).length;

  factors.proceduresCoverage = (withProcedures / totalFsHeads) * 100;
  factors.evidenceCoverage = (withEvidence / totalFsHeads) * 100;
  factors.conclusionsCoverage = (withConclusions / totalFsHeads) * 100;

  const riskObservations = await analyzeRiskCoverage(engagementId);
  const criticalIssues = riskObservations.filter(o => o.type === "critical").length;
  factors.riskResponseScore = criticalIssues === 0 ? 100 : Math.max(0, 100 - (criticalIssues * 25));

  const weights = {
    linkageScore: 0.2,
    proceduresCoverage: 0.25,
    evidenceCoverage: 0.25,
    conclusionsCoverage: 0.15,
    riskResponseScore: 0.15,
  };

  const score = Object.entries(weights).reduce((total, [key, weight]) => {
    return total + ((factors[key] || 0) * weight);
  }, 0);

  return { score: Math.round(score), factors };
}

export async function getCopilotAnalysis(
  context: CopilotContext,
  focusArea?: string
): Promise<CopilotResponse> {
  let observations: CopilotObservation[] = [];

  if (focusArea) {
    const fsHeadObs = await analyzeFsHeadContext(context, focusArea);
    observations.push(...fsHeadObs);
  }

  const riskObs = await analyzeRiskCoverage(context.engagementId);
  observations.push(...riskObs);

  const dismissedIds = await getDismissedObservationIds(context.engagementId);
  observations = observations.map(obs => ({
    ...obs,
    dismissed: dismissedIds.has(obs.id),
  }));

  const linkageStatus = await analyzeEngagementLinkages(context.engagementId);
  const { score: qualityScore } = await calculateQualityScore(context.engagementId);
  const { score: isaComplianceScore, isaScores } = await calculateISAComplianceScore(context.engagementId);

  observations.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    if (a.dismissed !== b.dismissed) return a.dismissed ? 1 : -1;
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  return {
    observations,
    linkageStatus,
    qualityScore,
    isaComplianceScore,
    isaScores,
    disclaimer: "AI-assisted — subject to professional judgment",
  };
}

export async function generateAICopilotSuggestion(
  context: CopilotContext,
  observationType: string,
  additionalContext: string
): Promise<string> {
  const engagement = await db.engagement.findUnique({
    where: { id: context.engagementId },
    include: {
      client: true,
    },
  });

  if (!engagement) {
    throw new Error("Engagement not found");
  }

  const settings = await db.aISettings.findFirst({
    where: { firmId: engagement.firmId },
  });

  const aiSettings = {
    aiEnabled: settings?.aiEnabled ?? true,
    preferredProvider: settings?.preferredProvider ?? "openai",
    providerPriority: settings?.providerPriority ?? ["openai", "gemini", "deepseek"],
    openaiApiKey: settings?.openaiApiKey || process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
    openaiEnabled: settings?.openaiEnabled ?? true,
    geminiApiKey: settings?.geminiApiKey,
    geminiEnabled: settings?.geminiEnabled ?? false,
    deepseekApiKey: settings?.deepseekApiKey,
    deepseekEnabled: settings?.deepseekEnabled ?? false,
    maxTokensPerResponse: settings?.maxTokensPerResponse ?? 2000,
    requestTimeout: settings?.requestTimeout ?? 30000,
  };

  const contextPrompt = `
Current Context:
- Engagement: ${engagement.engagementCode}
- Client: ${engagement.client?.name || "N/A"}
- Fiscal Year End: ${engagement.fiscalYearEnd}
- Audit Phase: ${context.auditPhase}
- FS Head: ${context.currentFsHead || "N/A"}
- Risk Level: ${context.riskLevel || "N/A"}
- User Role: ${context.userRole}
${context.materialityThreshold ? `- Materiality: ${context.materialityThreshold}` : ""}
${context.performanceMateriality ? `- Performance Materiality: ${context.performanceMateriality}` : ""}

Observation Type: ${observationType}
Additional Context: ${additionalContext}
`;

  const result = await generateAIContent(aiSettings, {
    prompt: `Based on the audit context, provide specific guidance for addressing this ${observationType}. Be concise and actionable.`,
    context: contextPrompt,
    systemPrompt: COPILOT_SYSTEM_PROMPT,
    maxTokens: 500,
    temperature: 0.5,
  });

  return result.content;
}

export async function logCopilotInteraction(
  engagementId: string,
  userId: string,
  action: string,
  observationId?: string,
  details?: Record<string, unknown>
): Promise<void> {
  try {
    await db.aIAuditLog.create({
      data: {
        engagementId,
        userId,
        action: `COPILOT_${action}`,
        phase: ((details?.phase as string) || "EXECUTION").toUpperCase(),
        section: "copilot",
        fieldKey: observationId || "system",
        aiRationale: JSON.stringify(details || {}),
      },
    });
  } catch {
  }
}
