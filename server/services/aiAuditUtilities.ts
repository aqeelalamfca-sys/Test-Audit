import { prisma } from "../db";
import { generateAIContent } from "./aiService";

interface AIAnalysisResult {
  analysis: string;
  findings: string[];
  recommendations: string[];
  modelVersion: string;
  disclaimer: string;
  processingTimeMs: number;
}

const AI_DISCLAIMER = "AI-assisted – subject to professional judgment";

async function getAISettings(firmId?: string): Promise<any> {
  if (firmId) {
    const settings = await prisma.aISettings.findUnique({
      where: { firmId }
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

async function callAI(prompt: string, context: string, section: string, firmId?: string): Promise<{ content: string; modelVersion: string; processingTimeMs: number }> {
  const startTime = Date.now();
  const settings = await getAISettings(firmId);
  const result = await generateAIContent(settings, {
    prompt,
    context,
    systemPrompt: `You are an expert statutory auditor. Provide structured, ISA-compliant analysis. 
Your outputs are AI-ASSISTED and SUBJECT TO PROFESSIONAL JUDGMENT.
Format responses with clear sections, bullet points, and ISA references where applicable.
Be specific, factual, and actionable.`,
    maxTokens: 3000,
    temperature: 0.3,
  });

  if (result.error) {
    throw new Error(result.error);
  }

  return {
    content: result.content,
    modelVersion: `${result.provider}`,
    processingTimeMs: Date.now() - startTime,
  };
}

export async function analyzeEvidenceSufficiency(engagementId: string): Promise<AIAnalysisResult> {
  const engagement = await prisma.engagement.findUnique({
    where: { id: engagementId },
    include: {
      client: true,
      riskAssessments: true,
      substantiveTests: true,
      controlTests: true,
      misstatements: true,
    }
  });

  if (!engagement) throw new Error("Engagement not found");

  const riskCount = engagement.riskAssessments?.length || 0;
  const substantiveCount = engagement.substantiveTests?.length || 0;
  const controlTestCount = engagement.controlTests?.length || 0;
  const misstatementsCount = engagement.misstatements?.length || 0;

  const context = `Engagement: ${engagement.engagementCode}
Client: ${engagement.client?.name || "Unknown"}
Risk Assessments: ${riskCount}
Substantive Procedures: ${substantiveCount}
Control Tests: ${controlTestCount}
Misstatements Found: ${misstatementsCount}
Risk Rating: ${engagement.riskRating}
Period: ${engagement.periodStart?.toISOString().split("T")[0]} to ${engagement.periodEnd?.toISOString().split("T")[0]}
Risks: ${engagement.riskAssessments?.map(r => `${r.riskArea || r.description} (${r.riskLevel})`).join("; ") || "None documented"}`;

  const result = await callAI(
    `Analyze the sufficiency and appropriateness of audit evidence for this engagement per ISA 500.
Evaluate:
1. Whether evidence obtained is sufficient for each identified risk area
2. Gaps where additional procedures may be needed
3. Areas where evidence quality (reliability, relevance) may be insufficient
4. Whether the nature, timing, and extent of procedures are appropriate
Provide specific ISA references for each finding.`,
    context,
    "evidence_sufficiency"
  );

  const findings = extractBulletPoints(result.content, "finding");
  const recommendations = extractBulletPoints(result.content, "recommendation");

  return {
    analysis: result.content,
    findings,
    recommendations,
    modelVersion: result.modelVersion,
    disclaimer: AI_DISCLAIMER,
    processingTimeMs: result.processingTimeMs,
  };
}

export async function detectRiskResponseGaps(engagementId: string): Promise<AIAnalysisResult> {
  const engagement = await prisma.engagement.findUnique({
    where: { id: engagementId },
    include: {
      client: true,
      riskAssessments: true,
      substantiveTests: true,
      controlTests: true,
      internalControls: true,
    }
  });

  if (!engagement) throw new Error("Engagement not found");

  const risks = engagement.riskAssessments || [];
  const procedures = [...(engagement.substantiveTests || []), ...(engagement.controlTests || [])];
  const controls = engagement.internalControls || [];

  const context = `Engagement: ${engagement.engagementCode}
Identified Risks (${risks.length}):
${risks.map(r => `- ${r.riskArea || r.description} | Level: ${r.riskLevel} | Significant: ${r.isSignificantRisk || false}`).join("\n")}

Audit Procedures (${procedures.length}):
${procedures.map(p => `- ${(p as any).procedureName || (p as any).description || "Unnamed"} | Status: ${(p as any).status}`).join("\n")}

Internal Controls (${controls.length}):
${controls.map(c => `- ${c.controlName} | Effective: ${c.isEffective || "Not tested"}`).join("\n")}`;

  const result = await callAI(
    `Analyze risk-response linkages for this audit engagement per ISA 330.
Identify:
1. Risks without corresponding audit procedures (unaddressed risks)
2. Significant risks lacking enhanced procedures
3. Procedures that don't clearly respond to identified risks
4. Controls relied upon but not adequately tested
5. Overall assessment of whether responses are proportionate to risk levels
Provide ISA 315/330 references for each gap.`,
    context,
    "risk_response_gaps"
  );

  const findings = extractBulletPoints(result.content, "gap");
  const recommendations = extractBulletPoints(result.content, "recommendation");

  return {
    analysis: result.content,
    findings,
    recommendations,
    modelVersion: result.modelVersion,
    disclaimer: AI_DISCLAIMER,
    processingTimeMs: result.processingTimeMs,
  };
}

export async function checkDocumentationCompleteness(engagementId: string): Promise<AIAnalysisResult> {
  const engagement = await prisma.engagement.findUnique({
    where: { id: engagementId },
    include: {
      client: true,
      phases: true,
      sectionSignOffs: true,
      reviewNotes: true,
    }
  });

  if (!engagement) throw new Error("Engagement not found");

  const phases = engagement.phases || [];
  const signOffs = engagement.sectionSignOffs || [];
  const openNotes = (engagement.reviewNotes || []).filter(n => n.status === "OPEN");
  const completedPhases = phases.filter(p => p.status === "COMPLETED").length;

  const context = `Engagement: ${engagement.engagementCode}
Current Phase: ${engagement.currentPhase}
Status: ${engagement.status}
Phase Progress: ${completedPhases}/${phases.length} phases completed
${phases.map(p => `- ${p.phase}: ${p.status} (${p.completionPercentage || 0}%)`).join("\n")}

Section Sign-offs: ${signOffs.length} total
- Prepared: ${signOffs.filter(s => s.preparedById).length}
- Reviewed: ${signOffs.filter(s => s.reviewedById).length}
- Partner Approved: ${signOffs.filter(s => s.partnerApprovedById).length}

Open Review Notes: ${openNotes.length}
Preconditions Met: ${engagement.preconditionsMet}
Engagement Letter Signed: ${engagement.engagementLetterSigned}
Independence Cleared: ${engagement.independenceCleared}`;

  const result = await callAI(
    `Assess documentation completeness for this audit engagement per ISA 230.
Check:
1. Whether all mandatory ISA documentation requirements are met
2. Missing sign-offs or approvals for completed sections
3. Open review notes that need resolution
4. Phase completion gaps
5. Pre-engagement documentation (letter, independence, preconditions)
6. Whether the audit file would pass an ISQM 1 inspection
Rate overall completeness and identify critical gaps.`,
    context,
    "documentation_completeness"
  );

  const findings = extractBulletPoints(result.content, "gap");
  const recommendations = extractBulletPoints(result.content, "action");

  return {
    analysis: result.content,
    findings,
    recommendations,
    modelVersion: result.modelVersion,
    disclaimer: AI_DISCLAIMER,
    processingTimeMs: result.processingTimeMs,
  };
}

export async function generateDraftMemo(
  engagementId: string,
  memoType: "planning" | "completion" | "going_concern" | "subsequent_events" | "summary"
): Promise<AIAnalysisResult> {
  const engagement = await prisma.engagement.findUnique({
    where: { id: engagementId },
    include: {
      client: true,
      riskAssessments: true,
      materialityCalculations: true,
      misstatements: true,
      phases: true,
    }
  });

  if (!engagement) throw new Error("Engagement not found");

  const materiality = engagement.materialityCalculations?.[0];
  const risks = engagement.riskAssessments || [];
  const misstatements = engagement.misstatements || [];

  const baseContext = `Client: ${engagement.client?.name || "Unknown"}
Engagement: ${engagement.engagementCode}
Period: ${engagement.periodStart?.toISOString().split("T")[0]} to ${engagement.periodEnd?.toISOString().split("T")[0]}
Risk Rating: ${engagement.riskRating}
Materiality: ${materiality ? `Overall: ${materiality.overallMateriality}, Performance: ${materiality.performanceMateriality}` : "Not set"}
Significant Risks: ${risks.filter(r => r.isSignificantRisk).map(r => r.riskArea || r.description).join(", ") || "None"}
Misstatements: ${misstatements.length} identified`;

  const memoPrompts: Record<string, string> = {
    planning: `Draft an ISA 300-compliant planning memo covering:
1. Engagement overview and objectives
2. Understanding of the entity and its environment (ISA 315)
3. Risk assessment summary
4. Materiality determination rationale
5. Overall audit strategy and approach
6. Key areas of focus
7. Resource allocation and timeline
8. Communication plan`,
    completion: `Draft an ISA 700-compliant completion memo covering:
1. Summary of audit work performed
2. Key findings and conclusions
3. Uncorrected misstatements assessment
4. Going concern conclusion
5. Subsequent events review
6. Overall conclusion on financial statements
7. Proposed audit opinion`,
    going_concern: `Draft an ISA 570-compliant going concern assessment memo covering:
1. Indicators evaluated (financial, operating, other)
2. Management's assessment review
3. Future cash flow analysis
4. Mitigating factors considered
5. Conclusion and reporting implications`,
    subsequent_events: `Draft an ISA 560-compliant subsequent events memo covering:
1. Events between period end and audit report date
2. Facts discovered after the audit report date
3. Assessment of each event's impact
4. Required adjustments or disclosures
5. Management representations obtained`,
    summary: `Draft a comprehensive engagement summary covering:
1. Executive summary of the audit
2. Key risks and how they were addressed
3. Significant findings
4. Management communication points
5. Areas for improvement (management letter points)
6. Overall assessment`,
  };

  const result = await callAI(
    memoPrompts[memoType] || memoPrompts.summary,
    baseContext,
    `memo_${memoType}`
  );

  return {
    analysis: result.content,
    findings: [],
    recommendations: [],
    modelVersion: result.modelVersion,
    disclaimer: AI_DISCLAIMER,
    processingTimeMs: result.processingTimeMs,
  };
}

function extractBulletPoints(text: string, type: string): string[] {
  const lines = text.split("\n");
  const points: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ") || /^\d+\.\s/.test(trimmed)) {
      const content = trimmed.replace(/^[-*]\s+/, "").replace(/^\d+\.\s+/, "");
      if (content.length > 10) {
        points.push(content);
      }
    }
  }
  return points.slice(0, 20);
}

export async function logAIOutput(
  firmId: string,
  engagementId: string,
  userId: string,
  section: string,
  action: string,
  aiProvider: string,
  modelVersion: string,
  aiDraftContent: string,
  processingTimeMs: number,
  promptTokens?: number,
  completionTokens?: number
): Promise<void> {
  await prisma.aIUsageLog.create({
    data: {
      firmId,
      engagementId,
      userId,
      section,
      action,
      aiProvider,
      modelVersion,
      aiDraftContent,
      processingTimeMs,
      promptTokens,
      completionTokens,
      isAIGenerated: true,
      disclaimer: AI_DISCLAIMER,
    }
  });
}
