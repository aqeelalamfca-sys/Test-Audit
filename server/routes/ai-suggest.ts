import { Router, Response } from "express";
import { prisma } from "../db";
import { requireAuth, type AuthenticatedRequest } from "../auth";
import { z } from "zod";
import OpenAI from "openai";

const db = prisma as any;

interface SuggestionRecord {
  id: string;
  fieldKey: string;
  aiValue: string | null;
  userValue: string | null;
  status: string;
  confidence: number;
  rationale: string | null;
  citations: string[];
  isaReference: string | null;
}

const router = Router();

const SYSTEM_PROMPT = `You are an expert statutory auditor in Pakistan with deep knowledge of:
- International Standards on Auditing (ISA)
- ICAP (Institute of Chartered Accountants of Pakistan) requirements
- IESBA Code of Ethics
- Companies Act 2017 (Pakistan)
- SECP regulations
- AML/CFT requirements (FATF guidelines)
- ISQM 1 and ISQM 2

When generating content for audit documentation:
1. Be professional, factual, and consistent with provided client/engagement data
2. Use Pakistan statutory audit context where relevant
3. Use conditional language when data is incomplete: "Based on the information available..." / "Management indicated..."
4. Do NOT change or fabricate names, dates, NTN, registration numbers, or any identifiers
5. Keep responses concise but detailed enough for audit documentation
6. Reference applicable ISA standards where appropriate
7. Maintain an objective, professional tone suitable for audit workpapers`;

const suggestSchema = z.object({
  engagementId: z.string(),
  phase: z.string(),
  section: z.string(),
  fieldKeys: z.array(z.string()),
  currentDataContext: z.record(z.any()).optional(),
  forceRegenerate: z.boolean().optional(),
});

const overrideSchema = z.object({
  engagementId: z.string(),
  phase: z.string(),
  section: z.string(),
  fieldKey: z.string(),
  userValue: z.string(),
  overrideReason: z.string().optional(),
});

const revertSchema = z.object({
  engagementId: z.string(),
  phase: z.string(),
  section: z.string(),
  fieldKey: z.string(),
});

interface FieldSuggestion {
  value: string | null;
  confidence: number;
  rationale: string;
  citations: string[];
  status: "AI_SUGGESTED" | "USER_OVERRIDE" | "MANUAL" | "REVERTED";
  isaReference?: string;
}

async function getEngagementContext(engagementId: string) {
  const engagement = await db.engagement.findUnique({
    where: { id: engagementId },
    include: {
      client: true,
      clientMaster: true,
      firm: true,
      materialityAssessments: { take: 1, orderBy: { createdAt: "desc" } },
      riskAssessments: { take: 5, orderBy: { createdAt: "desc" } },
      trialBalances: { take: 1, orderBy: { createdAt: "desc" } },
    },
  });

  if (!engagement) return null;

  return {
    engagementCode: engagement.engagementCode,
    engagementType: engagement.engagementType,
    periodStart: engagement.periodStart,
    periodEnd: engagement.periodEnd,
    riskRating: engagement.riskRating,
    clientName: engagement.client?.name || engagement.clientMaster?.legalName,
    industry: engagement.client?.industry || engagement.clientMaster?.industry,
    ntn: engagement.client?.ntn || engagement.clientMaster?.ntn,
    shareCapital: engagement.shareCapital,
    numberOfEmployees: engagement.numberOfEmployees,
    lastYearRevenue: engagement.lastYearRevenue,
    materiality: engagement.materialityAssessments?.[0]?.overallMateriality,
    performanceMateriality: engagement.materialityAssessments?.[0]?.performanceMateriality,
    topRisks: engagement.riskAssessments?.map((r: any) => ({
      account: r.accountOrClass,
      level: r.inherentRisk,
      assertion: r.fsArea,
    })),
  };
}

async function generateAISuggestions(
  fieldKeys: string[],
  context: any,
  phase: string,
  section: string
): Promise<Record<string, FieldSuggestion>> {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    const fallback: Record<string, FieldSuggestion> = {};
    for (const key of fieldKeys) {
      fallback[key] = {
        value: null,
        confidence: 0,
        rationale: "AI unavailable - no API key configured",
        citations: [],
        status: "MANUAL",
      };
    }
    return fallback;
  }

  const openai = new OpenAI({ apiKey: openaiKey });

  const contextSummary = JSON.stringify(context, null, 2);
  const fieldsToGenerate = fieldKeys.join(", ");

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Given the following engagement context:
${contextSummary}

Phase: ${phase}
Section: ${section}

Generate professional audit documentation content for these fields: ${fieldsToGenerate}

For each field, provide:
1. value: The suggested content (professional, ISA-compliant)
2. confidence: A number between 0 and 1 indicating confidence
3. rationale: Brief explanation of why this content is appropriate
4. isaReference: Relevant ISA standard if applicable

Return as JSON object with field keys.`,
        },
      ],
      response_format: { type: "json_object" },
    }, { timeout: 30000 });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("No response from AI");

    const parsed = JSON.parse(content);
    const result: Record<string, FieldSuggestion> = {};

    for (const key of fieldKeys) {
      const fieldData = parsed[key] || {};
      result[key] = {
        value: fieldData.value || null,
        confidence: Math.min(1, Math.max(0, fieldData.confidence || 0.75)),
        rationale: fieldData.rationale || "AI-generated suggestion based on engagement context",
        citations: fieldData.citations || [],
        status: "AI_SUGGESTED",
        isaReference: fieldData.isaReference,
      };
    }

    return result;
  } catch (error: any) {
    console.error("AI generation error:", error);
    const fallback: Record<string, FieldSuggestion> = {};
    for (const key of fieldKeys) {
      fallback[key] = {
        value: null,
        confidence: 0,
        rationale: `AI generation failed: ${error.message}`,
        citations: [],
        status: "MANUAL",
      };
    }
    return fallback;
  }
}

router.post("/suggest", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const body = suggestSchema.parse(req.body);
    const { engagementId, phase, section, fieldKeys, currentDataContext, forceRegenerate } = body;

    const existingSuggestions = await db.aISuggestion.findMany({
      where: {
        engagementId,
        phase: phase as any,
        section,
        fieldKey: { in: fieldKeys },
      },
    });

    const existingMap = new Map<string, SuggestionRecord>(
      existingSuggestions.map((s: SuggestionRecord) => [s.fieldKey, s])
    );
    const fieldsToGenerate: string[] = [];
    const result: Record<string, FieldSuggestion> = {};

    for (const key of fieldKeys) {
      const existing: SuggestionRecord | undefined = existingMap.get(key);
      if (existing && !forceRegenerate) {
        if (existing.status === "USER_OVERRIDE") {
          result[key] = {
            value: existing.userValue,
            confidence: 1,
            rationale: "User-provided value (overrides AI)",
            citations: [],
            status: "USER_OVERRIDE",
          };
        } else {
          result[key] = {
            value: existing.aiValue,
            confidence: existing.confidence,
            rationale: existing.rationale || "",
            citations: existing.citations || [],
            status: existing.status as any,
            isaReference: existing.isaReference || undefined,
          };
        }
      } else if (!existing || existing.status !== "USER_OVERRIDE" || forceRegenerate) {
        fieldsToGenerate.push(key);
      }
    }

    if (fieldsToGenerate.length > 0) {
      const context = await getEngagementContext(engagementId);
      const fullContext = { ...context, ...currentDataContext };
      const newSuggestions = await generateAISuggestions(fieldsToGenerate, fullContext, phase, section);

      for (const [key, suggestion] of Object.entries(newSuggestions)) {
        result[key] = suggestion;

        await db.aISuggestion.upsert({
          where: {
            engagementId_phase_section_fieldKey: {
              engagementId,
              phase: phase as any,
              section,
              fieldKey: key,
            },
          },
          create: {
            engagementId,
            phase: phase as any,
            section,
            fieldKey: key,
            aiValue: suggestion.value,
            confidence: suggestion.confidence,
            rationale: suggestion.rationale,
            citations: suggestion.citations,
            isaReference: suggestion.isaReference,
            status: suggestion.status as any,
            modelVersion: "gpt-4o",
            modelProvider: "openai",
            generatedById: req.user?.id,
          },
          update: {
            aiValue: suggestion.value,
            confidence: suggestion.confidence,
            rationale: suggestion.rationale,
            citations: suggestion.citations,
            isaReference: suggestion.isaReference,
            status: existingMap.get(key)?.status === "USER_OVERRIDE" ? "USER_OVERRIDE" : (suggestion.status as any),
            modelVersion: "gpt-4o",
            generatedAt: new Date(),
          },
        });

        await db.aIAuditLog.create({
          data: {
            engagementId,
            phase: phase as any,
            section,
            fieldKey: key,
            action: "AI_GENERATE",
            newValue: suggestion.value,
            newStatus: suggestion.status as any,
            aiConfidence: suggestion.confidence,
            aiRationale: suggestion.rationale,
            userId: req.user!.id,
            userName: req.user?.username,
            userRole: req.user?.role,
          },
        });
      }
    }

    res.json({
      success: true,
      suggestions: result,
      generatedCount: fieldsToGenerate.length,
      cachedCount: fieldKeys.length - fieldsToGenerate.length,
    });
  } catch (error: any) {
    console.error("AI suggest error:", error);
    res.status(500).json({ error: error.message || "Failed to generate suggestions" });
  }
});

router.post("/override", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const body = overrideSchema.parse(req.body);
    const { engagementId, phase, section, fieldKey, userValue, overrideReason } = body;

    const existing = await db.aISuggestion.findUnique({
      where: {
        engagementId_phase_section_fieldKey: {
          engagementId,
          phase: phase as any,
          section,
          fieldKey,
        },
      },
    });

    const previousValue = existing?.aiValue || existing?.userValue;
    const previousStatus = existing?.status;

    const suggestion = await db.aISuggestion.upsert({
      where: {
        engagementId_phase_section_fieldKey: {
          engagementId,
          phase: phase as any,
          section,
          fieldKey,
        },
      },
      create: {
        engagementId,
        phase: phase as any,
        section,
        fieldKey,
        userValue,
        status: "USER_OVERRIDE",
        confidence: 1,
        rationale: overrideReason || "User override",
        overriddenAt: new Date(),
        overriddenById: req.user?.id,
        overrideReason,
      },
      update: {
        userValue,
        status: "USER_OVERRIDE",
        overriddenAt: new Date(),
        overriddenById: req.user?.id,
        overrideReason,
      },
    });

    await db.aIAuditLog.create({
      data: {
        engagementId,
        phase: phase as any,
        section,
        fieldKey,
        action: "USER_OVERRIDE",
        previousValue,
        newValue: userValue,
        previousStatus: previousStatus as any,
        newStatus: "USER_OVERRIDE",
        userId: req.user!.id,
        userName: req.user?.username,
        userRole: req.user?.role,
      },
    });

    res.json({
      success: true,
      suggestion: {
        value: userValue,
        confidence: 1,
        rationale: overrideReason || "User override",
        citations: [],
        status: "USER_OVERRIDE",
      },
    });
  } catch (error: any) {
    console.error("AI override error:", error);
    res.status(500).json({ error: error.message || "Failed to save override" });
  }
});

router.post("/revert", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const body = revertSchema.parse(req.body);
    const { engagementId, phase, section, fieldKey } = body;

    const existing = await db.aISuggestion.findUnique({
      where: {
        engagementId_phase_section_fieldKey: {
          engagementId,
          phase: phase as any,
          section,
          fieldKey,
        },
      },
    });

    if (!existing || !existing.aiValue) {
      return res.status(404).json({ error: "No AI suggestion to revert to" });
    }

    const previousValue = existing.userValue;
    const previousStatus = existing.status;

    await db.aISuggestion.update({
      where: { id: existing.id },
      data: {
        status: "REVERTED",
        userValue: null,
        revertedAt: new Date(),
        revertedById: req.user?.id,
      },
    });

    await db.aIAuditLog.create({
      data: {
        engagementId,
        phase: phase as any,
        section,
        fieldKey,
        action: "REVERT_TO_AI",
        previousValue,
        newValue: existing.aiValue,
        previousStatus: previousStatus as any,
        newStatus: "REVERTED",
        userId: req.user!.id,
        userName: req.user?.username,
        userRole: req.user?.role,
      },
    });

    res.json({
      success: true,
      suggestion: {
        value: existing.aiValue,
        confidence: existing.confidence,
        rationale: existing.rationale,
        citations: existing.citations,
        status: "REVERTED",
        isaReference: existing.isaReference,
      },
    });
  } catch (error: any) {
    console.error("AI revert error:", error);
    res.status(500).json({ error: error.message || "Failed to revert to AI suggestion" });
  }
});

router.get("/suggestions/:engagementId/:phase/:section", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId, phase, section } = req.params;

    const suggestions = await db.aISuggestion.findMany({
      where: {
        engagementId,
        phase: phase as any,
        section,
      },
    });

    const result: Record<string, FieldSuggestion> = {};
    for (const s of suggestions) {
      result[s.fieldKey] = {
        value: s.status === "USER_OVERRIDE" ? s.userValue : s.aiValue,
        confidence: s.confidence,
        rationale: s.rationale || "",
        citations: s.citations || [],
        status: s.status as any,
        isaReference: s.isaReference || undefined,
      };
    }

    res.json({ success: true, suggestions: result });
  } catch (error: any) {
    console.error("AI get suggestions error:", error);
    res.status(500).json({ error: error.message || "Failed to get suggestions" });
  }
});

router.get("/settings/:engagementId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;

    let settings = await db.aIEngagementSettings.findUnique({
      where: { engagementId },
    });

    if (!settings) {
      settings = await db.aIEngagementSettings.create({
        data: {
          engagementId,
          aiAssistEnabled: true,
          autoFillOnLoad: true,
          showConfidence: true,
          showRationale: true,
        },
      });
    }

    res.json({ success: true, settings });
  } catch (error: any) {
    console.error("AI settings error:", error);
    res.status(500).json({ error: error.message || "Failed to get AI settings" });
  }
});

router.put("/settings/:engagementId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const { aiAssistEnabled, autoFillOnLoad, showConfidence, showRationale, professionalJudgmentNotes } = req.body;

    const settings = await db.aIEngagementSettings.upsert({
      where: { engagementId },
      create: {
        engagementId,
        aiAssistEnabled: aiAssistEnabled ?? true,
        autoFillOnLoad: autoFillOnLoad ?? true,
        showConfidence: showConfidence ?? true,
        showRationale: showRationale ?? true,
        professionalJudgmentNotes,
      },
      update: {
        aiAssistEnabled,
        autoFillOnLoad,
        showConfidence,
        showRationale,
        professionalJudgmentNotes,
      },
    });

    res.json({ success: true, settings });
  } catch (error: any) {
    console.error("AI settings update error:", error);
    res.status(500).json({ error: error.message || "Failed to update AI settings" });
  }
});

router.get("/audit-log/:engagementId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const { phase, section, fieldKey, limit = "50" } = req.query;

    const where: any = { engagementId };
    if (phase) where.phase = phase;
    if (section) where.section = section;
    if (fieldKey) where.fieldKey = fieldKey;

    const logs = await db.aIAuditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: parseInt(limit as string),
      include: {
        user: { select: { fullName: true, role: true } },
      },
    });

    res.json({ success: true, logs });
  } catch (error: any) {
    console.error("AI audit log error:", error);
    res.status(500).json({ error: error.message || "Failed to get audit log" });
  }
});

export default router;
