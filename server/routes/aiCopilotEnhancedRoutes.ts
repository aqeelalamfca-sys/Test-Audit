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

router.post("/page-assistant", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const input = z.object({
      pageId: z.string(),
      engagementId: z.string().uuid(),
      formData: z.object({
        totalFields: z.number().optional(),
        filledFields: z.number().optional(),
        emptyFields: z.number().optional(),
        completionPercent: z.number().optional(),
        fields: z.array(z.object({
          name: z.string().max(200),
          label: z.string().max(200),
          type: z.string().max(50),
          value: z.string().max(500),
          isEmpty: z.boolean(),
          isNarrative: z.boolean(),
        })).max(50).optional(),
        narrativeFields: z.array(z.object({
          name: z.string().max(200),
          label: z.string().max(200),
          value: z.string().max(500),
          isEmpty: z.boolean(),
        })).max(15).optional(),
        selectedOptions: z.array(z.string().max(200)).max(20).optional(),
        visibleTabs: z.array(z.string().max(100)).max(20).optional(),
        activeTab: z.string().max(100).optional(),
        hasConclusion: z.boolean().optional(),
      }).optional(),
      userRole: z.string().optional(),
    }).parse(req.body);

    const { pageId, engagementId, formData, userRole } = input;
    const profile = getPageProfile(pageId);
    const standards = getStandardsByPage(pageId);

    let engagementContext: Record<string, unknown> = {};
    let engagementContextStr = "";
    try {
      const engagement = await prisma.engagement.findFirst({
        where: { id: engagementId, firmId: req.user!.firmId ?? undefined },
        select: {
          id: true,
          engagementCode: true,
          currentPhase: true,
          fiscalYearEnd: true,
          status: true,
          clientId: true,
        },
      });

      if (engagement) {
        const client = await prisma.client.findUnique({
          where: { id: engagement.clientId },
          select: { name: true, industry: true, entityType: true },
        });
        const [materiality, riskCount, observationCount, adjustmentCount] = await Promise.all([
          prisma.materialityAssessment.findFirst({
            where: { engagementId },
            select: { overallMateriality: true, performanceMateriality: true, benchmark: true, method: true },
            orderBy: { createdAt: "desc" },
          }),
          prisma.riskAssessment.count({ where: { engagementId } }),
          prisma.observation.count({ where: { engagementId } }),
          prisma.auditAdjustment.count({ where: { engagementId } }),
        ]);

        engagementContext = {
          clientName: client?.name || "Unknown",
          industry: client?.industry || "Not specified",
          entityType: client?.entityType || "Not specified",
          engagementCode: engagement.engagementCode,
          phase: engagement.currentPhase,
          status: engagement.status,
          fyEnd: engagement.fiscalYearEnd,
          materiality: materiality ? {
            overall: materiality.overallMateriality,
            performance: materiality.performanceMateriality,
            benchmark: materiality.benchmark,
            method: materiality.method,
          } : null,
          risksIdentified: riskCount,
          observations: observationCount,
          adjustments: adjustmentCount,
        };

        engagementContextStr = Object.entries(engagementContext)
          .filter(([, v]) => v !== null && v !== undefined)
          .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`)
          .join("\n");
      }
    } catch (engErr) {
      console.warn("Page assistant: engagement context error:", engErr instanceof Error ? engErr.message : engErr);
    }

    const standardsSummary = standards.slice(0, 8).map(s => ({
      code: s.code,
      title: s.title,
      summary: s.summary,
      auditImplication: s.auditImplication,
    }));

    const fieldSummary = formData?.fields
      ?.filter(f => !f.isEmpty && f.value.length > 0)
      .slice(0, 30)
      .map(f => `${f.label || f.name}: ${f.value.substring(0, 200)}`)
      .join("\n") || "No form data captured";

    const emptyFieldsList = formData?.fields
      ?.filter(f => f.isEmpty && f.label)
      .map(f => f.label)
      .slice(0, 20) || [];

    const selectedOpts = formData?.selectedOptions?.join(", ") || "";

    const prompt = `You are analyzing the "${profile?.module || pageId}" page of an audit engagement.

PAGE INFORMATION:
- Page: ${profile?.module || pageId}
- Objective: ${profile?.objective || "Complete this section of the audit"}
- Expected Outputs: ${profile?.expectedOutputs?.join(", ") || "Working paper documentation"}
- Phase Group: ${profile?.group || "unknown"}
${formData?.activeTab ? `- Active Tab: ${formData.activeTab}` : ""}
${formData?.visibleTabs?.length ? `- Available Tabs: ${formData.visibleTabs.join(", ")}` : ""}

ENGAGEMENT CONTEXT:
${engagementContextStr || "No engagement data available"}

CURRENT PAGE STATE:
- Fields detected: ${formData?.totalFields || 0}
- Fields filled: ${formData?.filledFields || 0} (${formData?.completionPercent || 0}% complete)
- Empty fields: ${formData?.emptyFields || 0}
${selectedOpts ? `- Selected options: ${selectedOpts}` : ""}
${formData?.hasConclusion ? "- Conclusion section is present on this page" : ""}

FIELD VALUES (current data on page):
${fieldSummary}

${emptyFieldsList.length > 0 ? `EMPTY/MISSING FIELDS:\n${emptyFieldsList.map((f, i) => `${i + 1}. ${f}`).join("\n")}` : "All visible fields appear filled."}

APPLICABLE STANDARDS:
${standardsSummary.map(s => `${s.code}: ${s.title} - ${s.summary}`).join("\n") || "No specific standards mapped"}

${profile?.commonMistakes?.length ? `COMMON MISTAKES ON THIS PAGE:\n${profile.commonMistakes.map(m => `- ${m}`).join("\n")}` : ""}

${profile?.requiredEvidence?.length ? `REQUIRED EVIDENCE:\n${profile.requiredEvidence.map(e => `- ${e}`).join("\n")}` : ""}

Provide your analysis in the following JSON structure (respond ONLY with valid JSON, no markdown):
{
  "pageSummary": "2-3 sentence summary of what this page is for and what stage of audit it relates to",
  "guidance": ["list of 3-5 practical guidance items for completing this page properly"],
  "inputSuggestions": ["list of 2-4 specific suggestions for field values or wording based on the current page data"],
  "missingFields": ["list of missing or incomplete items that need attention, with significance noted"],
  "standardsReferences": [{"code": "ISA XXX", "relevance": "why this standard matters for this specific page and current data"}],
  "procedures": ["list of 3-5 practical audit procedures to perform for this page"],
  "reviewNotes": ["list of 2-3 reviewer-level observations or challenges based on current inputs"],
  "nextActions": ["list of 2-3 next steps after completing this page"]
}`;

    let aiOutput: Record<string, unknown> | null = null;
    let generated = true;

    try {
      const aiSettings = await fetchAISettings(req.user!.firmId!);
      const result = await generateAIContent(aiSettings, {
        prompt,
        context: engagementContextStr,
        systemPrompt: "You are a senior statutory auditor analyzing an audit working paper page. Respond ONLY with valid JSON matching the requested structure. Be specific to the current page data, not generic. Reference specific ISA/ISQM paragraphs. Use professional audit language. Base your analysis on the actual field values provided.",
        maxTokens: 4000,
        temperature: 0.4,
      });

      if (result.content && result.content.trim().length > 10) {
        try {
          const cleaned = result.content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
          aiOutput = JSON.parse(cleaned);
        } catch (_parseErr) {
          aiOutput = { rawContent: result.content };
          generated = true;
        }
      } else {
        throw new Error("Empty AI response");
      }
    } catch (_aiErr) {
      generated = false;
      const moduleName = profile?.module || pageId;
      const objective = profile?.objective || "Complete this section";

      aiOutput = {
        pageSummary: `This is the ${moduleName} page. Objective: ${objective}. ${formData?.completionPercent || 0}% of visible fields are completed.`,
        guidance: [
          ...(profile?.expectedOutputs?.map(o => `Ensure you produce: ${o}`) || []),
          ...(profile?.commonMistakes?.slice(0, 2).map(m => `Avoid: ${m}`) || []),
          "Review all fields for completeness before proceeding",
          "Ensure adequate documentation supports professional judgment",
        ].slice(0, 5),
        inputSuggestions: formData?.narrativeFields?.filter(f => f.isEmpty).slice(0, 3).map(f =>
          `${f.label || f.name}: Draft professional narrative addressing the requirements of this field`
        ) || ["Complete all narrative fields with specific, engagement-relevant content"],
        missingFields: emptyFieldsList.length > 0
          ? emptyFieldsList.slice(0, 8).map(f => `${f} — requires completion`)
          : ["No missing fields detected in visible form"],
        standardsReferences: standardsSummary.slice(0, 4).map(s => ({
          code: s.code,
          relevance: `${s.title}: ${s.auditImplication || s.summary}`,
        })),
        procedures: profile?.requiredEvidence?.slice(0, 4).map(e => `Obtain and document: ${e}`) || [
          "Review documentation for completeness",
          "Verify consistency with engagement strategy",
          "Cross-reference with related working papers",
        ],
        reviewNotes: [
          ...(profile?.reviewRules?.slice(0, 2).map(r => r.message) || []),
          formData?.completionPercent && formData.completionPercent < 80
            ? `Page is ${formData.completionPercent}% complete — several fields require attention before review`
            : "Page completion appears adequate for initial review",
        ].slice(0, 3),
        nextActions: profile?.nextStepGuidance?.slice(0, 3) || [
          "Save current progress",
          "Request manager review when complete",
          "Proceed to the next related working paper",
        ],
      };
    }

    res.json({
      pageId,
      module: profile?.module || pageId,
      objective: profile?.objective || "",
      generated,
      analysis: aiOutput,
      context: {
        totalFields: formData?.totalFields || 0,
        filledFields: formData?.filledFields || 0,
        completionPercent: formData?.completionPercent || 0,
        activeTab: formData?.activeTab || "",
        hasConclusion: formData?.hasConclusion || false,
      },
      standards: standardsSummary,
      disclaimer: "AI-assisted analysis — subject to professional judgment",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request", details: error.errors });
    }
    console.error("Page assistant error:", error);
    res.status(500).json({ error: "Failed to analyze page" });
  }
});

router.post("/seed-conclusion", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { pageId, engagementId, existingText, mode } = z.object({
      pageId: z.string(),
      engagementId: z.string().uuid(),
      existingText: z.string().optional(),
      mode: z.enum(["draft", "summary", "missing-fields", "review-section", "fill-narratives"]).default("draft"),
    }).parse(req.body);

    const profile = getPageProfile(pageId);
    const standards = getStandardsByPage(pageId);

    let engagementContext = "";
    let formDataContext = "";
    try {
      const engagement = await prisma.engagement.findFirst({
        where: { id: engagementId, firmId: req.user!.firmId ?? undefined },
        select: {
          id: true,
          engagementCode: true,
          currentPhase: true,
          fiscalYearEnd: true,
          status: true,
          clientId: true,
        },
      });

      if (engagement) {
        const client = await prisma.client.findUnique({
          where: { id: engagement.clientId },
          select: { name: true, industry: true, entityType: true },
        });
        const [materiality, riskCount, observationCount] = await Promise.all([
          prisma.materialityAssessment.findFirst({
            where: { engagementId },
            select: { overallMateriality: true, performanceMateriality: true, benchmark: true },
            orderBy: { createdAt: "desc" },
          }),
          prisma.riskAssessment.count({ where: { engagementId } }),
          prisma.observation.count({ where: { engagementId } }),
        ]);

        engagementContext = [
          `Client: ${client?.name || "Unknown"}`,
          `Industry: ${client?.industry || "Not specified"}`,
          `Entity Type: ${client?.entityType || "Not specified"}`,
          `Engagement Code: ${engagement.engagementCode}`,
          `Phase: ${engagement.currentPhase}`,
          `Status: ${engagement.status}`,
          `FY End: ${engagement.fiscalYearEnd || "Not set"}`,
          materiality ? `Overall Materiality: ${materiality.overallMateriality} (PM: ${materiality.performanceMateriality}, Benchmark: ${materiality.benchmark})` : "",
          `Risks Identified: ${riskCount}`,
          `Observations: ${observationCount}`,
        ].filter(Boolean).join("\n");

        const existingConclusions = await prisma.$queryRaw<Array<{ status: string; conclusionText: string; userName: string; userRole: string }>>`
          SELECT status, "conclusionText", "userName", "userRole"
          FROM "PageConclusion"
          WHERE "engagementId" = ${engagementId} AND "pageKey" = ${pageId} AND "isSuperseded" = false
          ORDER BY "authorityLevel" DESC
          LIMIT 5
        `;
        if (existingConclusions.length > 0) {
          formDataContext = "\nEXISTING CONCLUSIONS ON THIS PAGE:\n" +
            existingConclusions.map(c => `- ${c.userName} (${c.userRole}): [${c.status}] ${c.conclusionText}`).join("\n");
        }
      }
    } catch (_e) {}

    const standardsContext = standards.slice(0, 5).map(s => `${s.code}: ${s.summary}`).join("\n");

    const modePrompts: Record<string, string> = {
      "draft": `Draft a professional conclusion for the "${profile?.module || pageId}" page. The conclusion should be suitable for a statutory audit file. Include a definitive status assessment (Satisfactory / Unsatisfactory / Satisfactory with Recommendation), reference applicable standards, and state the basis for the conclusion.`,
      "summary": `Draft a comprehensive summary of the work performed on the "${profile?.module || pageId}" page. Include key findings, procedures performed, and overall assessment suitable for an audit working paper.`,
      "missing-fields": `Review the "${profile?.module || pageId}" page context and identify any missing fields, incomplete areas, or documentation gaps. List each item with its significance and the applicable standard reference. Format as a numbered checklist.`,
      "review-section": `Perform a reviewer-level assessment of the "${profile?.module || pageId}" page. Check for completeness, consistency with standards, professional skepticism, and documentation quality. Provide specific recommendations for improvement.`,
      "fill-narratives": `Generate professional narrative text for all empty fields on the "${profile?.module || pageId}" page. For each field, provide a ready-to-use narrative that is specific to this engagement and references applicable standards. Format each with the field name followed by the suggested text.`,
    };

    const prompt = `${modePrompts[mode]}

PAGE CONTEXT:
Module: ${profile?.module || pageId}
Objective: ${profile?.objective || "Complete page documentation"}
Expected Outputs: ${profile?.expectedOutputs?.join(", ") || "Working paper documentation"}

ENGAGEMENT CONTEXT:
${engagementContext || "No engagement context available"}

APPLICABLE STANDARDS:
${standardsContext || "No specific standards mapped"}
${formDataContext}
${existingText ? `\nCURRENT EXISTING TEXT:\n${existingText}` : ""}

REQUIREMENTS:
- Write in professional statutory audit language
- Be specific to this client and engagement context
- Reference specific ISA/ISQM paragraphs where applicable
- Keep the output structured, concise, and ready for use
- Use definitive language appropriate for audit conclusions`;

    let content: string;
    let generated = true;
    try {
      const aiSettings = await fetchAISettings(req.user!.firmId!);
      const result = await generateAIContent(aiSettings, {
        prompt,
        context: engagementContext,
        systemPrompt: "You are a senior statutory auditor drafting professional audit documentation for a Pakistani audit firm under ISA and ICAP standards. Your output must be ready for direct inclusion in an audit file with minimal editing. Do not add disclaimers or meta-commentary about AI assistance.",
        maxTokens: 3000,
        temperature: 0.5,
      });
      if (!result.content || result.content.trim().length === 0) {
        throw new Error("Empty AI response");
      }
      content = result.content;
    } catch (_aiErr) {
      generated = false;
      const moduleName = profile?.module || pageId;
      const objective = profile?.objective || "the applicable audit requirements";
      content = mode === "draft"
        ? `Based on our review of the ${moduleName} documentation and evaluation of ${objective}, the work performed is considered [Satisfactory/Unsatisfactory]. All applicable requirements under ${standards.length > 0 ? standards.map(s => s.code).join(", ") : "relevant ISA standards"} have been addressed. The evidence obtained provides a reasonable basis for this conclusion.\n\nThis conclusion is subject to review by the engagement partner.`
        : mode === "summary"
        ? `SUMMARY — ${moduleName}\n\nWork performed on this section covers ${objective}. Key procedures included [describe procedures]. ${engagementContext ? `\nEngagement context: ${engagementContext.split("\n").slice(0, 3).join("; ")}` : ""}\n\nFindings: [To be documented]\nConclusion: [Pending assessment]`
        : mode === "missing-fields"
        ? `COMPLETENESS CHECK — ${moduleName}\n\n${profile?.requiredEvidence?.map((e, i) => `${i + 1}. ${e} — [Verify completion]`).join("\n") || "1. Review all required fields for completeness\n2. Verify supporting documentation\n3. Confirm standard references"}`
        : `SECTION REVIEW — ${moduleName}\n\nObjective: ${objective}\nStatus: [Requires assessment]\n\nRecommendations:\n1. Verify completeness of documentation\n2. Confirm adherence to applicable standards\n3. Review for consistency with engagement strategy`;
    }

    res.json({
      content,
      mode,
      pageId,
      generated,
      module: profile?.module || pageId,
      disclaimer: "AI-assisted — subject to professional judgment",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request", details: error.errors });
    }
    console.error("Seed conclusion error:", error);
    res.status(500).json({ error: "Failed to generate conclusion content" });
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
