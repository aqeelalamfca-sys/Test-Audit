import { Router, Request, Response } from "express";
import { prisma } from "./db";
import { requireAuth, requireMinRole, type AuthenticatedRequest } from "./auth";
import { z } from "zod";
import { 
  generateAIContent, 
  testProviderConnection, 
  buildContextPrompt,
  isAIProhibitedField,
  type AISettings 
} from "./services/aiService";

const db = prisma as any;
const router = Router();

function authHandler(fn: (req: AuthenticatedRequest, res: Response) => Promise<any>): any {
  return (req: Request, res: Response) => fn(req as unknown as AuthenticatedRequest, res);
}

const AI_PROMPTS: Record<string, string> = {
  entity_understanding: `You are an expert statutory auditor. Draft a comprehensive understanding of the entity and its environment based on the provided context. Include:
- Nature of business and operations
- Key accounting policies
- Industry-specific factors
- Regulatory environment
- Internal control environment overview
Format the response professionally for audit documentation.

IMPORTANT: This is AI-ASSISTED content SUBJECT TO PROFESSIONAL JUDGMENT.`,

  risk_description: `You are an expert statutory auditor. Draft a risk description based on the provided context. Include:
- Nature of the risk
- Likelihood and impact assessment
- Relevant assertions affected
- Potential misstatement scenarios
Format for ISA 315 compliance.

IMPORTANT: This is AI-ASSISTED content SUBJECT TO PROFESSIONAL JUDGMENT. Do NOT assign risk ratings.`,

  audit_procedure: `You are an expert statutory auditor. Draft audit procedures based on the provided context. Include:
- Specific steps to perform
- Evidence to obtain
- ISA references
- Assertions addressed
Format professionally with numbered steps.

IMPORTANT: This is AI-ASSISTED content SUBJECT TO PROFESSIONAL JUDGMENT.`,

  observation_wording: `You are an expert statutory auditor. Draft professional observation wording for audit findings. Include:
- Condition (what was found)
- Criteria (what should be)
- Cause (why it occurred)
- Effect (impact on financial statements)
- Recommendation
Format for management letter or audit report inclusion.

IMPORTANT: This is AI-ASSISTED content SUBJECT TO PROFESSIONAL JUDGMENT.`,

  deficiency_narrative: `You are an expert statutory auditor. Draft a control deficiency narrative for ISA 265 communication. Include:
- Description of the deficiency
- Potential consequences
- Classification (significant/material weakness)
- Recommended remediation
Format professionally for governance communication.

IMPORTANT: This is AI-ASSISTED content SUBJECT TO PROFESSIONAL JUDGMENT.`,

  audit_summary: `You are an expert statutory auditor. Draft an audit summary based on the provided context. Include:
- Scope of audit
- Key findings summary
- Significant judgments made
- Areas requiring attention
Note: This is for internal documentation only, NOT for forming audit opinion.

IMPORTANT: This is AI-ASSISTED content SUBJECT TO PROFESSIONAL JUDGMENT.`,

  management_letter_point: `You are an expert statutory auditor. Draft a management letter point based on the provided context. Include:
- Observation
- Implication
- Recommendation
- Management response placeholder
Format professionally for client communication.

IMPORTANT: This is AI-ASSISTED content SUBJECT TO PROFESSIONAL JUDGMENT.`,

  going_concern_rationale: `You are an expert statutory auditor. Draft a going concern assessment rationale based on the provided context. Include:
- Key indicators assessed
- Mitigating factors identified
- Period of assessment
- Conclusion basis
Format for ISA 570 compliance.

IMPORTANT: This is AI-ASSISTED content SUBJECT TO PROFESSIONAL JUDGMENT. Do NOT form conclusions.`,

  materiality_rationale: `You are an expert statutory auditor. Draft a rationale for the materiality determination. Include:
- Benchmark selected and justification
- Percentage applied and reasoning
- User-specific considerations
- Any adjustments made
Format for ISA 320 documentation.

IMPORTANT: This is AI-ASSISTED content SUBJECT TO PROFESSIONAL JUDGMENT. Do NOT calculate amounts.`,

  variance_explanation: `You are an expert statutory auditor. Explain the variance identified based on the provided context. Include:
- Nature of the variance
- Potential causes
- Audit implications
- Additional procedures if needed
Format professionally for audit documentation.

IMPORTANT: This is AI-ASSISTED content SUBJECT TO PROFESSIONAL JUDGMENT.`,

  analytical_commentary: `You are an expert statutory auditor. Provide analytical commentary on the financial data. Include:
- Key trends observed
- Unusual items identified
- Comparison with industry/prior year
- Areas requiring further investigation
Format for ISA 520 compliance.

IMPORTANT: This is AI-ASSISTED content SUBJECT TO PROFESSIONAL JUDGMENT.`,

  eqcr_summary: `You are an expert statutory auditor performing EQCR review. Generate an engagement-wide summary synthesizing:
- Significant judgments made by the engagement team
- Key audit risks and how they were addressed
- Significant matters for partner attention
- Overall assessment of audit quality
- Any consultation matters
This summary is for EQCR documentation purposes.

IMPORTANT: This is a SYSTEM-GENERATED (AI) summary. It DOES NOT REPLACE EQCR JUDGMENT.`,
};

async function logAIUsage(
  firmId: string,
  userId: string,
  data: {
    engagementId?: string;
    page?: string;
    fieldName?: string;
    section: string;
    action: string;
    aiProvider: string;
    aiDraftContent?: string;
    finalUserContent?: string;
    promptTokens?: number;
    completionTokens?: number;
    isaReferences?: string[];
    contextData?: string;
  }
) {
  return db.aIUsageLog.create({
    data: {
      firmId,
      userId,
      engagementId: data.engagementId,
      page: data.page,
      fieldName: data.fieldName,
      section: data.section,
      action: data.action,
      aiProvider: data.aiProvider,
      aiDraftContent: data.aiDraftContent,
      finalUserContent: data.finalUserContent,
      promptTokens: data.promptTokens,
      completionTokens: data.completionTokens,
      isaReferences: data.isaReferences || [],
      contextData: data.contextData,
      isAIGenerated: true,
      wasEdited: false,
      userConfirmed: false,
    },
  });
}

router.get("/settings", requireAuth, authHandler(async (req, res) => {
  try {
    const firmId = req.user?.firmId;
    if (!firmId) {
      return res.status(400).json({ error: "User not associated with a firm" });
    }

    const settings = await db.aISettings.findUnique({
      where: { firmId },
    });

    if (!settings) {
      return res.json({
        aiEnabled: true,
        preferredProvider: "openai",
        providerPriority: ["openai", "gemini", "deepseek"],
        hasOpenAI: !!(process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY),
        openaiEnabled: true,
        openaiTestStatus: null,
        hasGemini: false,
        geminiEnabled: false,
        geminiTestStatus: null,
        hasDeepseek: false,
        deepseekEnabled: false,
        deepseekTestStatus: null,
        maxTokensPerResponse: 2000,
        autoSuggestionsEnabled: true,
        manualTriggerOnly: false,
        requestTimeout: 30000,
      });
    }

    res.json({
      aiEnabled: settings.aiEnabled,
      preferredProvider: settings.preferredProvider,
      providerPriority: settings.providerPriority || ["openai", "gemini", "deepseek"],
      hasOpenAI: !!settings.openaiApiKey || !!process.env.OPENAI_API_KEY || !!process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      openaiEnabled: settings.openaiEnabled,
      openaiTestStatus: settings.openaiTestStatus,
      openaiLastTested: settings.openaiLastTested,
      hasGemini: !!settings.geminiApiKey,
      geminiEnabled: settings.geminiEnabled,
      geminiTestStatus: settings.geminiTestStatus,
      geminiLastTested: settings.geminiLastTested,
      hasDeepseek: !!settings.deepseekApiKey,
      deepseekEnabled: settings.deepseekEnabled,
      deepseekTestStatus: settings.deepseekTestStatus,
      deepseekLastTested: settings.deepseekLastTested,
      maxTokensPerResponse: settings.maxTokensPerResponse,
      autoSuggestionsEnabled: settings.autoSuggestionsEnabled,
      manualTriggerOnly: settings.manualTriggerOnly,
      requestTimeout: settings.requestTimeout || 30000,
    });
  } catch (error) {
    console.error("Get AI settings error:", error);
    res.status(500).json({ error: "Failed to get AI settings" });
  }
}));

router.post("/settings", requireAuth, requireMinRole("FIRM_ADMIN"), authHandler(async (req, res) => {
  try {
    const firmId = req.user?.firmId;
    if (!firmId) {
      return res.status(400).json({ error: "User not associated with a firm" });
    }

    const schema = z.object({
      aiEnabled: z.boolean(),
      preferredProvider: z.string().default("openai"),
      providerPriority: z.array(z.string()).default(["openai", "gemini", "deepseek"]),
      openaiApiKey: z.string().optional().nullable(),
      openaiEnabled: z.boolean().default(true),
      geminiApiKey: z.string().optional().nullable(),
      geminiEnabled: z.boolean().default(false),
      deepseekApiKey: z.string().optional().nullable(),
      deepseekEnabled: z.boolean().default(false),
      maxTokensPerResponse: z.number().min(100).max(8000).default(2000),
      autoSuggestionsEnabled: z.boolean().default(false),
      manualTriggerOnly: z.boolean().default(true),
      requestTimeout: z.number().min(5000).max(120000).default(30000),
    });

    const data = schema.parse(req.body);

    const settings = await db.aISettings.upsert({
      where: { firmId },
      create: {
        firmId,
        ...data,
      },
      update: data,
    });

    res.json({
      aiEnabled: settings.aiEnabled,
      preferredProvider: settings.preferredProvider,
      providerPriority: settings.providerPriority,
      hasOpenAI: !!settings.openaiApiKey || !!process.env.OPENAI_API_KEY || !!process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      openaiEnabled: settings.openaiEnabled,
      hasGemini: !!settings.geminiApiKey,
      geminiEnabled: settings.geminiEnabled,
      hasDeepseek: !!settings.deepseekApiKey,
      deepseekEnabled: settings.deepseekEnabled,
      maxTokensPerResponse: settings.maxTokensPerResponse,
      autoSuggestionsEnabled: settings.autoSuggestionsEnabled,
      manualTriggerOnly: settings.manualTriggerOnly,
      requestTimeout: settings.requestTimeout,
    });
  } catch (error) {
    console.error("Update AI settings error:", error);
    res.status(500).json({ error: "Failed to update AI settings" });
  }
}));

router.post("/test-connection", requireAuth, requireMinRole("FIRM_ADMIN"), authHandler(async (req, res) => {
  try {
    const firmId = req.user?.firmId;
    if (!firmId) {
      return res.status(400).json({ error: "User not associated with a firm" });
    }

    const schema = z.object({
      provider: z.enum(["openai", "gemini", "deepseek"]),
      apiKey: z.string().optional(),
    });

    const { provider, apiKey } = schema.parse(req.body);

    let keyToTest = apiKey;
    
    if (!keyToTest) {
      const settings = await db.aISettings.findUnique({
        where: { firmId },
      });
      
      switch (provider) {
        case "openai":
          keyToTest = settings?.openaiApiKey || process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
          break;
        case "gemini":
          keyToTest = settings?.geminiApiKey;
          break;
        case "deepseek":
          keyToTest = settings?.deepseekApiKey;
          break;
      }
    }

    if (!keyToTest) {
      return res.status(400).json({ 
        success: false, 
        message: "No API key configured for this provider" 
      });
    }

    const result = await testProviderConnection(provider, keyToTest);

    const updateField = `${provider}TestStatus` as const;
    const lastTestedField = `${provider}LastTested` as const;
    
    await db.aISettings.upsert({
      where: { firmId },
      create: {
        firmId,
        [updateField]: result.success ? "success" : "failed",
        [lastTestedField]: new Date(),
      },
      update: {
        [updateField]: result.success ? "success" : "failed",
        [lastTestedField]: new Date(),
      },
    });

    res.json(result);
  } catch (error: any) {
    console.error("Test connection error:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message || "Connection test failed" 
    });
  }
}));

router.post("/generate", requireAuth, authHandler(async (req, res) => {
  try {
    const firmId = req.user?.firmId;
    const userId = req.user?.id;
    
    if (!firmId || !userId) {
      return res.status(400).json({ error: "User not associated with a firm" });
    }

    const schema = z.object({
      section: z.string(),
      context: z.string(),
      promptType: z.string(),
      engagementId: z.string().optional(),
      page: z.string().optional(),
      fieldName: z.string().optional(),
      isaReferences: z.array(z.string()).optional(),
    });

    const data = schema.parse(req.body);

    if (data.fieldName && isAIProhibitedField(data.fieldName)) {
      return res.status(400).json({ 
        error: "AI assistance is not permitted for this field type. Professional judgment is required." 
      });
    }

    const settings = await db.aISettings.findUnique({
      where: { firmId },
    });

    const aiSettings: AISettings = {
      aiEnabled: settings?.aiEnabled ?? true,
      preferredProvider: settings?.preferredProvider ?? "openai",
      providerPriority: settings?.providerPriority ?? ["openai", "gemini", "deepseek"],
      openaiApiKey: settings?.openaiApiKey,
      openaiEnabled: settings?.openaiEnabled ?? true,
      geminiApiKey: settings?.geminiApiKey,
      geminiEnabled: settings?.geminiEnabled ?? false,
      deepseekApiKey: settings?.deepseekApiKey,
      deepseekEnabled: settings?.deepseekEnabled ?? false,
      maxTokensPerResponse: settings?.maxTokensPerResponse ?? 2000,
      requestTimeout: settings?.requestTimeout ?? 30000,
    };

    if (!aiSettings.aiEnabled) {
      return res.status(403).json({ 
        error: "AI assistance unavailable — professional judgment required. Enable AI in Settings." 
      });
    }

    const systemPrompt = AI_PROMPTS[data.promptType] || AI_PROMPTS.entity_understanding;

    const result = await generateAIContent(aiSettings, {
      prompt: systemPrompt,
      context: data.context,
    });

    if (result.error) {
      return res.status(500).json({ error: result.error });
    }

    await logAIUsage(firmId, userId, {
      engagementId: data.engagementId,
      page: data.page,
      fieldName: data.fieldName,
      section: data.section,
      action: "generate",
      aiProvider: result.provider,
      aiDraftContent: result.content,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      isaReferences: data.isaReferences,
      contextData: data.context.substring(0, 1000),
    });

    res.json({
      content: result.content,
      provider: result.provider,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      disclaimer: "AI-Assisted (Subject to Professional Judgment)",
    });
  } catch (error: any) {
    console.error("AI generate error:", error);
    if (error?.status === 429) {
      return res.status(429).json({ 
        error: "API quota exhausted. Please try again later or continue audit normally." 
      });
    }
    res.status(500).json({ 
      error: "AI generation failed. You can continue the audit workflow normally." 
    });
  }
}));

router.post("/rephrase", requireAuth, authHandler(async (req, res) => {
  try {
    const firmId = req.user?.firmId;
    const userId = req.user?.id;
    
    if (!firmId || !userId) {
      return res.status(400).json({ error: "User not associated with a firm" });
    }

    const schema = z.object({
      content: z.string().min(1),
      context: z.string().optional(),
      engagementId: z.string().optional(),
      page: z.string().optional(),
      fieldName: z.string().optional(),
    });

    const data = schema.parse(req.body);

    const settings = await db.aISettings.findUnique({
      where: { firmId },
    });

    const aiSettings: AISettings = {
      aiEnabled: settings?.aiEnabled ?? true,
      preferredProvider: settings?.preferredProvider ?? "openai",
      providerPriority: settings?.providerPriority ?? ["openai", "gemini", "deepseek"],
      openaiApiKey: settings?.openaiApiKey,
      openaiEnabled: settings?.openaiEnabled ?? true,
      geminiApiKey: settings?.geminiApiKey,
      geminiEnabled: settings?.geminiEnabled ?? false,
      deepseekApiKey: settings?.deepseekApiKey,
      deepseekEnabled: settings?.deepseekEnabled ?? false,
      maxTokensPerResponse: settings?.maxTokensPerResponse ?? 2000,
      requestTimeout: settings?.requestTimeout ?? 30000,
    };

    if (!aiSettings.aiEnabled) {
      return res.status(403).json({ 
        error: "AI assistance unavailable — professional judgment required. Enable AI in Settings." 
      });
    }

    const rephrasePrompt = `Rephrase and improve the following text while maintaining its meaning and professional tone suitable for audit documentation:

Original text:
${data.content}

Requirements:
- Maintain factual accuracy
- Improve professional tone and structure
- Keep ISA-compliant language
- Target length: 6-12 lines

IMPORTANT: This is AI-ASSISTED content SUBJECT TO PROFESSIONAL JUDGMENT.`;

    const result = await generateAIContent(aiSettings, {
      prompt: rephrasePrompt,
      context: data.context || "",
    });

    if (result.error) {
      return res.status(500).json({ error: result.error });
    }

    await logAIUsage(firmId, userId, {
      engagementId: data.engagementId,
      page: data.page,
      fieldName: data.fieldName,
      section: "rephrase",
      action: "rephrase",
      aiProvider: result.provider,
      aiDraftContent: result.content,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
    });

    res.json({
      content: result.content,
      provider: result.provider,
      disclaimer: "AI-Assisted (Subject to Professional Judgment)",
    });
  } catch (error: any) {
    console.error("AI rephrase error:", error);
    res.status(500).json({ 
      error: "AI rephrase failed. You can continue editing manually." 
    });
  }
}));

router.post("/log-usage", requireAuth, authHandler(async (req, res) => {
  try {
    const firmId = req.user?.firmId;
    const userId = req.user?.id;

    if (!firmId || !userId) {
      return res.status(400).json({ error: "User not properly authenticated" });
    }

    const schema = z.object({
      section: z.string(),
      action: z.string(),
      engagementId: z.string().optional(),
      page: z.string().optional(),
      fieldName: z.string().optional(),
      aiDraftContent: z.string().optional(),
      finalUserContent: z.string().optional(),
      userConfirmed: z.boolean().default(false),
      wasEdited: z.boolean().default(false),
      promptTokens: z.number().optional(),
      completionTokens: z.number().optional(),
      isaReferences: z.array(z.string()).optional(),
    });

    const data = schema.parse(req.body);

    const log = await db.aIUsageLog.create({
      data: {
        firmId,
        userId,
        engagementId: data.engagementId,
        page: data.page,
        fieldName: data.fieldName,
        section: data.section,
        action: data.action,
        aiProvider: "openai",
        aiDraftContent: data.aiDraftContent,
        finalUserContent: data.finalUserContent,
        userConfirmed: data.userConfirmed,
        confirmedAt: data.userConfirmed ? new Date() : null,
        wasEdited: data.wasEdited,
        editedAt: data.wasEdited ? new Date() : null,
        promptTokens: data.promptTokens,
        completionTokens: data.completionTokens,
        isaReferences: data.isaReferences || [],
      },
    });

    res.json(log);
  } catch (error) {
    console.error("Log AI usage error:", error);
    res.status(500).json({ error: "Failed to log AI usage" });
  }
}));

router.post("/log-confirm", requireAuth, authHandler(async (req, res) => {
  try {
    const firmId = req.user?.firmId;
    const userId = req.user?.id;

    if (!firmId || !userId) {
      return res.status(400).json({ error: "User not properly authenticated" });
    }

    const schema = z.object({
      logId: z.string(),
      action: z.enum(["accept", "edit", "reject"]),
      finalUserContent: z.string().optional(),
    });

    const { logId, action, finalUserContent } = schema.parse(req.body);

    const existingLog = await db.aIUsageLog.findFirst({
      where: { id: logId, firmId },
    });

    if (!existingLog) {
      return res.status(404).json({ error: "AI log not found" });
    }

    const updateData: any = {};

    if (action === "accept") {
      updateData.userConfirmed = true;
      updateData.confirmedAt = new Date();
      updateData.wasEdited = false;
      updateData.finalUserContent = existingLog.aiDraftContent;
    } else if (action === "edit") {
      updateData.userConfirmed = true;
      updateData.confirmedAt = new Date();
      updateData.wasEdited = true;
      updateData.editedAt = new Date();
      updateData.finalUserContent = finalUserContent || existingLog.aiDraftContent;
    } else if (action === "reject") {
      updateData.userConfirmed = false;
      updateData.wasEdited = false;
      updateData.finalUserContent = null;
    }

    const log = await db.aIUsageLog.update({
      where: { id: logId },
      data: updateData,
    });

    res.json({ success: true, action, log });
  } catch (error) {
    console.error("Log confirm error:", error);
    res.status(500).json({ error: "Failed to confirm AI content" });
  }
}));

router.post("/log-edit", requireAuth, authHandler(async (req, res) => {
  try {
    const firmId = req.user?.firmId;
    const userId = req.user?.id;

    if (!firmId || !userId) {
      return res.status(400).json({ error: "User not properly authenticated" });
    }

    const schema = z.object({
      logId: z.string(),
      finalUserContent: z.string(),
    });

    const { logId, finalUserContent } = schema.parse(req.body);

    const log = await db.aIUsageLog.update({
      where: { id: logId },
      data: {
        finalUserContent,
        wasEdited: true,
        editedAt: new Date(),
        userConfirmed: true,
        confirmedAt: new Date(),
      },
    });

    res.json(log);
  } catch (error) {
    console.error("Log edit error:", error);
    res.status(500).json({ error: "Failed to log edit" });
  }
}));

router.get("/usage-logs", requireAuth, authHandler(async (req, res) => {
  try {
    const firmId = req.user?.firmId;
    if (!firmId) {
      return res.status(400).json({ error: "User not associated with a firm" });
    }

    const { engagementId, section, userId, page, limit = "50" } = req.query;

    const where: any = { firmId };
    if (engagementId) where.engagementId = engagementId;
    if (section) where.section = section;
    if (userId) where.userId = userId;
    if (page) where.page = page;

    const logs = await db.aIUsageLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: parseInt(limit as string),
      include: {
        user: {
          select: { id: true, fullName: true, role: true },
        },
      },
    });

    res.json(logs);
  } catch (error) {
    console.error("Get AI usage logs error:", error);
    res.status(500).json({ error: "Failed to get AI usage logs" });
  }
}));

router.get("/usage-stats", requireAuth, authHandler(async (req, res) => {
  try {
    const firmId = req.user?.firmId;
    if (!firmId) {
      return res.status(400).json({ error: "User not associated with a firm" });
    }

    const { engagementId } = req.query;

    const where: any = { firmId };
    if (engagementId) where.engagementId = engagementId;

    const [totalLogs, editedLogs, confirmedLogs] = await Promise.all([
      db.aIUsageLog.count({ where }),
      db.aIUsageLog.count({ where: { ...where, wasEdited: true } }),
      db.aIUsageLog.count({ where: { ...where, userConfirmed: true } }),
    ]);

    const byProvider = await db.aIUsageLog.groupBy({
      by: ["aiProvider"],
      where,
      _count: true,
    });

    const byPage = await db.aIUsageLog.groupBy({
      by: ["page"],
      where,
      _count: true,
    });

    res.json({
      total: totalLogs,
      edited: editedLogs,
      confirmed: confirmedLogs,
      editRate: totalLogs > 0 ? ((editedLogs / totalLogs) * 100).toFixed(1) : 0,
      byProvider,
      byPage,
    });
  } catch (error) {
    console.error("Get AI usage stats error:", error);
    res.status(500).json({ error: "Failed to get AI usage stats" });
  }
}));

export default router;
