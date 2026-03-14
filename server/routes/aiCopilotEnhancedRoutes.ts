import { Router, Response } from "express";
import { requireAuth, type AuthenticatedRequest } from "../auth";
import { z } from "zod";
import { prisma } from "../db";
import { getPageProfile } from "../services/pageProfiles";
import { getStandardsByPage, getStandardByCode, searchStandards } from "../services/standardsLibrary";
import { generateAIContent, type AISettings } from "../services/aiService";

const router = Router();

async function fetchAISettings(firmId: string): Promise<AISettings> {
  const settings = await (prisma as unknown as Record<string, any>).aISettings?.findUnique({ where: { firmId } });
  return {
    aiEnabled: settings?.aiEnabled ?? true,
    preferredProvider: settings?.preferredProvider ?? "openai",
    providerPriority: settings?.providerPriority ?? ["openai", "gemini", "deepseek", "anthropic"],
    openaiApiKey: settings?.openaiApiKey,
    openaiEnabled: settings?.openaiEnabled ?? true,
    geminiApiKey: settings?.geminiApiKey,
    geminiEnabled: settings?.geminiEnabled ?? false,
    deepseekApiKey: settings?.deepseekApiKey,
    deepseekEnabled: settings?.deepseekEnabled ?? false,
    anthropicApiKey: settings?.anthropicApiKey,
    anthropicEnabled: settings?.anthropicEnabled ?? false,
    maxTokensPerResponse: settings?.maxTokensPerResponse ?? 3000,
    requestTimeout: settings?.requestTimeout ?? 60000,
  };
}

router.post("/page-context", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { pageId, engagementId } = z.object({
      pageId: z.string(),
      engagementId: z.string().uuid().optional(),
    }).parse(req.body);

    const profile = getPageProfile(pageId);
    if (!profile) {
      return res.json({
        pageId,
        profile: null,
        standards: [],
        engagementSnapshot: null,
        message: "No AI profile configured for this page",
      });
    }

    const standards = getStandardsByPage(pageId);

    let engagementSnapshot: Record<string, unknown> | null = null;
    if (engagementId) {
      try {
        const engagement = await prisma.engagement.findFirst({
          where: { id: engagementId, firmId: req.user!.firmId ?? undefined },
          select: {
            id: true,
            engagementCode: true,
            status: true,
            currentPhase: true,
            fiscalYearEnd: true,
            client: { select: { name: true, industry: true, entityType: true } },
          },
        });
        if (engagement) {
          const [materialityData, riskCount, observationCount, adjustmentCount] = await Promise.all([
            prisma.materialityAssessment.findFirst({
              where: { engagementId },
              select: { overallMateriality: true, performanceMateriality: true, benchmark: true },
              orderBy: { createdAt: "desc" },
            }),
            prisma.riskAssessment.count({ where: { engagementId } }),
            prisma.observation.count({ where: { engagementId } }),
            prisma.auditAdjustment.count({ where: { engagementId } }),
          ]);

          engagementSnapshot = {
            ...engagement,
            materiality: materialityData,
            riskCount,
            observationCount,
            adjustmentCount,
          };
        }
      } catch (_e) {
      }
    }

    res.json({
      pageId,
      profile: {
        module: profile.module,
        group: profile.group,
        objective: profile.objective,
        expectedOutputs: profile.expectedOutputs,
        commonMistakes: profile.commonMistakes,
        requiredEvidence: profile.requiredEvidence,
        reviewRules: profile.reviewRules,
        nextStepGuidance: profile.nextStepGuidance,
        fieldHints: profile.fieldHints,
        suggestionTemplates: profile.suggestionTemplates.map(t => ({
          id: t.id,
          label: t.label,
          type: t.type,
          targetField: t.targetField,
        })),
      },
      standards: standards.map(s => ({
        code: s.code,
        title: s.title,
        summary: s.summary,
        auditImplication: s.auditImplication,
        category: s.category,
        keyParagraphs: s.keyParagraphs,
      })),
      engagementSnapshot,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request", details: error.errors });
    }
    console.error("Page context error:", error);
    res.status(500).json({ error: "Failed to get page context" });
  }
});

router.post("/field-suggestions", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { pageId, engagementId, fieldKey, currentValue, formData } = z.object({
      pageId: z.string(),
      engagementId: z.string().uuid(),
      fieldKey: z.string(),
      currentValue: z.string().optional(),
      formData: z.record(z.unknown()).optional(),
    }).parse(req.body);

    const profile = getPageProfile(pageId);
    const fieldHint = profile?.fieldHints[fieldKey];
    const standards = getStandardsByPage(pageId);

    let engagement: Record<string, unknown> | null = null;
    try {
      engagement = await prisma.engagement.findFirst({
        where: { id: engagementId, firmId: req.user!.firmId ?? undefined },
        select: {
          id: true,
          engagementCode: true,
          currentPhase: true,
          client: { select: { name: true, industry: true, entityType: true } },
        },
      }) as unknown as Record<string, unknown>;
    } catch (_e) {}

    const contextParts = [
      `Page: ${profile?.module || pageId} - ${profile?.objective || ""}`,
      `Field: ${fieldKey}${fieldHint ? ` (${fieldHint.label}: ${fieldHint.guidance})` : ""}`,
      currentValue ? `Current value: ${currentValue}` : "Field is currently empty",
      engagement ? `Client: ${(engagement.client as Record<string, unknown>)?.name}, Industry: ${(engagement.client as Record<string, unknown>)?.industry}, Phase: ${engagement.currentPhase}` : "",
      formData ? `Form context: ${JSON.stringify(formData).substring(0, 1000)}` : "",
      fieldHint?.standardRef ? `Relevant standard: ${fieldHint.standardRef}` : "",
      fieldHint?.exampleValues ? `Example values: ${fieldHint.exampleValues.join(", ")}` : "",
    ].filter(Boolean).join("\n");

    const prompt = `Based on the following audit context, suggest an appropriate value or improvement for the field.

${contextParts}

Provide:
1. SUGGESTED VALUE: A specific suggested value or text
2. RATIONALE: Why this value is appropriate (1-2 sentences)
3. STANDARD REF: The applicable standard reference if any
4. CONFIDENCE: HIGH, MEDIUM, or LOW

Keep suggestions professional, audit-specific, and concise.`;

    let suggestion;
    try {
      const aiSettings = await fetchAISettings(req.user!.firmId!);
      const aiResponse = await generateAIContent(aiSettings, {
        prompt,
        context: contextParts,
        systemPrompt: "You are an expert audit assistant helping auditors fill in working papers. Provide specific, professional suggestions based on the context.",
        maxTokens: 1500,
        temperature: 0.5,
      });
      suggestion = {
        value: aiResponse.content,
        fieldKey,
        fieldLabel: fieldHint?.label || fieldKey,
        standardRef: fieldHint?.standardRef,
        generated: true,
      };
    } catch (_e) {
      suggestion = {
        value: fieldHint?.guidance || "No AI suggestion available. Please fill this field based on your professional judgment.",
        fieldKey,
        fieldLabel: fieldHint?.label || fieldKey,
        standardRef: fieldHint?.standardRef,
        exampleValues: fieldHint?.exampleValues,
        generated: false,
        hint: fieldHint?.guidance,
      };
    }

    res.json({
      suggestion,
      disclaimer: "AI-assisted — subject to professional judgment",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request", details: error.errors });
    }
    console.error("Field suggestion error:", error);
    res.status(500).json({ error: "Failed to generate suggestion" });
  }
});

router.post("/section-draft", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { pageId, engagementId, templateId, additionalContext } = z.object({
      pageId: z.string(),
      engagementId: z.string().uuid(),
      templateId: z.string(),
      additionalContext: z.record(z.string()).optional(),
    }).parse(req.body);

    const profile = getPageProfile(pageId);
    const template = profile?.suggestionTemplates.find(t => t.id === templateId);
    if (!template) {
      return res.status(404).json({ error: "Suggestion template not found" });
    }

    let engagementContext = "";
    try {
      const engagement = await prisma.engagement.findFirst({
        where: { id: engagementId, firmId: req.user!.firmId ?? undefined },
        select: {
          id: true,
          engagementCode: true,
          currentPhase: true,
          fiscalYearEnd: true,
          clientId: true,
        },
      });

      if (engagement) {
        const client = await prisma.client.findUnique({
          where: { id: engagement.clientId },
          select: { name: true, industry: true, entityType: true },
        });
        const [materiality, riskCount, observations] = await Promise.all([
          prisma.materialityAssessment.findFirst({
            where: { engagementId },
            select: { overallMateriality: true, performanceMateriality: true, benchmark: true },
            orderBy: { createdAt: "desc" },
          }),
          prisma.riskAssessment.count({ where: { engagementId } }),
          prisma.observation.count({ where: { engagementId } }),
        ]);

        engagementContext = [
          `Client: ${client?.name}`,
          `Industry: ${client?.industry || "Not specified"}`,
          `Entity Type: ${client?.entityType || "Not specified"}`,
          `Engagement Phase: ${engagement.currentPhase}`,
          `FY End: ${engagement.fiscalYearEnd}`,
          materiality ? `Materiality: ${materiality.overallMateriality} (PM: ${materiality.performanceMateriality}, Benchmark: ${materiality.benchmark})` : "",
          `Risks Identified: ${riskCount}`,
          `Observations: ${observations}`,
        ].filter(Boolean).join("\n");
      }
    } catch (_e) {}

    const standards = getStandardsByPage(pageId);
    const standardsContext = standards.map(s => `${s.code}: ${s.summary}`).join("\n");

    const fullPrompt = `${template.prompt}

ENGAGEMENT CONTEXT:
${engagementContext}

APPLICABLE STANDARDS:
${standardsContext}

${additionalContext ? `ADDITIONAL CONTEXT:\n${Object.entries(additionalContext).map(([k, v]) => `${k}: ${v}`).join("\n")}` : ""}

REQUIREMENTS:
- Write in professional audit language
- Reference specific ISA/ISQM standards where relevant
- Be specific to this client and engagement, not generic
- Keep the output structured and concise
- Include "AI-assisted — subject to professional judgment" disclaimer`;

    const aiSettings = await fetchAISettings(req.user!.firmId!);
    const result = await generateAIContent(aiSettings, {
      prompt: fullPrompt,
      context: engagementContext,
      systemPrompt: "You are a senior statutory auditor drafting professional audit documentation. Your output should be ready for inclusion in an audit file with minimal editing.",
      maxTokens: 3000,
      temperature: 0.6,
    });

    res.json({
      content: result.content,
      templateId,
      templateLabel: template.label,
      type: template.type,
      targetField: template.targetField,
      disclaimer: "AI-assisted — subject to professional judgment",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request", details: error.errors });
    }
    console.error("Section draft error:", error);
    res.status(500).json({ error: "Failed to generate draft" });
  }
});

router.post("/page-review", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { pageId, engagementId, formData } = z.object({
      pageId: z.string(),
      engagementId: z.string().uuid(),
      formData: z.record(z.unknown()).optional(),
    }).parse(req.body);

    const profile = getPageProfile(pageId);
    if (!profile) {
      return res.json({ flags: [], score: 100, message: "No review rules configured for this page" });
    }

    const flags: Array<{
      id: string;
      severity: "info" | "warning" | "critical";
      message: string;
      standardRef?: string;
      category: string;
    }> = [];

    for (const rule of profile.reviewRules) {
      flags.push({
        id: rule.id,
        severity: rule.severity,
        message: rule.message,
        standardRef: rule.standardRef,
        category: "review_rule",
      });
    }

    for (const mistake of profile.commonMistakes) {
      flags.push({
        id: `mistake-${profile.pageId}-${profile.commonMistakes.indexOf(mistake)}`,
        severity: "info",
        message: `Common pitfall: ${mistake}`,
        category: "common_mistake",
      });
    }

    const criticalCount = flags.filter(f => f.severity === "critical").length;
    const warningCount = flags.filter(f => f.severity === "warning").length;
    const score = Math.max(0, 100 - (criticalCount * 25) - (warningCount * 10));

    res.json({
      flags,
      score,
      totalFlags: flags.length,
      criticalCount,
      warningCount,
      pageObjective: profile.objective,
      requiredEvidence: profile.requiredEvidence,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request", details: error.errors });
    }
    console.error("Page review error:", error);
    res.status(500).json({ error: "Failed to run page review" });
  }
});

router.get("/standards/search/:query", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const results = searchStandards(req.params.query);
    res.json({ results, count: results.length });
  } catch (error) {
    console.error("Standards search error:", error);
    res.status(500).json({ error: "Failed to search standards" });
  }
});

router.get("/standards/:code", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const code = req.params.code;
    const standard = getStandardByCode(code) || getStandardByCode(code.replace(/\s+/g, "_"));
    if (!standard) {
      return res.status(404).json({ error: "Standard not found" });
    }
    res.json(standard);
  } catch (error) {
    console.error("Standards lookup error:", error);
    res.status(500).json({ error: "Failed to look up standard" });
  }
});

router.post("/next-steps", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { pageId, engagementId } = z.object({
      pageId: z.string(),
      engagementId: z.string().uuid().optional(),
    }).parse(req.body);

    const profile = getPageProfile(pageId);
    if (!profile) {
      return res.json({ steps: [], message: "No guidance configured for this page" });
    }

    let phaseProgress: Record<string, string> | null = null;
    if (engagementId) {
      try {
        const engagement = await prisma.engagement.findFirst({
          where: { id: engagementId, firmId: req.user!.firmId ?? undefined },
          select: { currentPhase: true, status: true },
        });
        if (engagement) {
          phaseProgress = {
            currentPhase: engagement.currentPhase,
            currentStatus: engagement.status,
          };
        }
      } catch (_e) {}
    }

    res.json({
      steps: profile.nextStepGuidance,
      currentPage: {
        pageId: profile.pageId,
        module: profile.module,
        objective: profile.objective,
        expectedOutputs: profile.expectedOutputs,
      },
      phaseProgress,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request", details: error.errors });
    }
    console.error("Next steps error:", error);
    res.status(500).json({ error: "Failed to get next steps" });
  }
});

export default router;
