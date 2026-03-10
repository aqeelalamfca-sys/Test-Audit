import { Router, Response } from "express";
import { requireAuth, AuthenticatedRequest } from "../auth";
import { isaComplianceService } from "../services/isaComplianceService";
import { isaPhaseComplianceService } from "../services/isaPhaseComplianceService";
import { generateAIContent, type AISettings } from "../services/aiService";
import { prisma } from "../db";
import { z } from "zod";

const router = Router();

const engagementIdSchema = z.string().uuid("Invalid engagement ID format");

interface AccessResult {
  valid: boolean;
  error?: string;
  engagement?: {
    id: string;
    engagementName: string | null;
    name: string | null;
    clientName: string | null;
    yearEnd: string | Date | null;
    engagementType: string | null;
    firmId: string;
  };
}

async function validateEngagementAccess(
  engagementId: string,
  userId: string,
  firmId: string | null
): Promise<AccessResult> {
  const idResult = engagementIdSchema.safeParse(engagementId);
  if (!idResult.success) {
    return { valid: false, error: "Invalid engagement ID format" };
  }
  if (!firmId) return { valid: false, error: "User not associated with a firm" };
  const engagement = await prisma.engagement.findFirst({
    where: { id: engagementId, firmId },
  });
  if (!engagement) return { valid: false, error: "Engagement not found or access denied" };
  return { valid: true, engagement: engagement as unknown as AccessResult["engagement"] };
}

interface ApiError {
  success: false;
  error: string;
  details?: unknown;
}

function errorResponse(res: Response, status: number, message: string, details?: unknown): void {
  const body: ApiError = { success: false, error: message };
  if (details) body.details = details;
  res.status(status).json(body);
}

async function fetchAISettings(firmId: string): Promise<AISettings> {
  const settings = await (prisma as any).aISettings?.findUnique({ where: { firmId } });
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

router.get("/engagements/:engagementId/health-check", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) return errorResponse(res, 404, access.error!);

    const result = await isaComplianceService.runHealthCheck(req.params.engagementId);
    res.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("ISA health check error:", error);
    errorResponse(res, 500, message);
  }
});

router.get("/engagements/:engagementId/isa-scores", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) return errorResponse(res, 404, access.error!);

    const result = await isaComplianceService.runHealthCheck(req.params.engagementId);

    const scores = result.isaScores.map((s: { isa: string; area: string; percentage: number; status: string }) => ({
      isa: s.isa,
      area: s.area,
      percentage: s.percentage,
      status: s.status,
    }));

    res.json({
      overallScore: result.overallScore,
      overallStatus: result.overallStatus,
      scores,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("ISA scores error:", error);
    errorResponse(res, 500, message);
  }
});

router.get("/engagements/:engagementId/critical-gaps", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) return errorResponse(res, 404, access.error!);

    const result = await isaComplianceService.runHealthCheck(req.params.engagementId);

    res.json({
      criticalCount: result.criticalGaps.length,
      gaps: result.criticalGaps,
      recommendations: result.recommendations,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("Critical gaps error:", error);
    errorResponse(res, 500, message);
  }
});

router.get("/engagements/:engagementId/phase-compliance", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) return errorResponse(res, 404, access.error!);

    const records = await isaPhaseComplianceService.computeEngagementCompliance(req.params.engagementId);
    res.json({ records });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("Phase compliance error:", error);
    errorResponse(res, 500, message);
  }
});

router.get("/engagements/:engagementId/no-report-blockers", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) return errorResponse(res, 404, access.error!);

    const blockers = await isaPhaseComplianceService.getNoReportBlockers(req.params.engagementId);
    res.json({ blockers, totalGates: blockers.length, passedGates: blockers.filter((b) => b.passed).length });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("No-report blockers error:", error);
    errorResponse(res, 500, message);
  }
});

router.get("/engagements/:engagementId/phase-heatbar", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) return errorResponse(res, 404, access.error!);

    const phases = await isaPhaseComplianceService.getPhaseHeatbar(req.params.engagementId);
    res.json({ phases });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("Phase heatbar error:", error);
    errorResponse(res, 500, message);
  }
});

router.get("/engagements/:engagementId/compliance-summary", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) return errorResponse(res, 404, access.error!);

    const summary = await isaPhaseComplianceService.getComplianceSummary(req.params.engagementId);
    res.json(summary);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("Compliance summary error:", error);
    errorResponse(res, 500, message);
  }
});

const ISA_OUTPUT_PROMPTS: Record<string, { systemPrompt: string; userPrompt: string; isaReferences: string[] }> = {
  ISA_260_PLANNING: {
    systemPrompt: "You are an expert statutory auditor drafting a formal communication to Those Charged With Governance (TCWG) at the planning stage per ISA 260.",
    userPrompt: `Draft an ISA 260 Communication to Those Charged With Governance (Planning Stage).

Include the following sections:
1. Purpose of Communication (ISA 260.9)
2. Planned Scope and Timing of the Audit (ISA 260.15)
3. Significant Risks Identified (ISA 260.16(a))
4. Planned Reliance on Internal Controls
5. Materiality Levels Applied (without specific amounts — reference ISA 320)
6. Key Areas of Professional Judgment
7. Expected Form and Timing of Audit Communications
8. Independence Matters (IESBA Code)

Format as a professional letter. Use formal audit language.`,
    isaReferences: ["ISA 260.9", "ISA 260.14-17", "ISA 320.10", "IESBA Code Section 400"],
  },
  ISA_260_FINAL: {
    systemPrompt: "You are an expert statutory auditor drafting a final communication to TCWG per ISA 260 at the conclusion of the audit.",
    userPrompt: `Draft an ISA 260 Communication to Those Charged With Governance (Final/Completion Stage).

Include:
1. Auditor's Views on Significant Qualitative Aspects of Accounting Practices (ISA 260.16(a))
2. Significant Difficulties Encountered During the Audit (ISA 260.16(b))
3. Significant Matters Arising from the Audit Discussed with Management (ISA 260.16(c))
4. Written Representations Requested (ISA 260.16(c)(iii))
5. Other Matters Significant to TCWG (ISA 260.16(d))
6. Independence Confirmation (ISA 260.17)
7. Uncorrected Misstatements Summary (ISA 450.12-13)
8. Modified Opinion Considerations if Any

Format as a professional letter.`,
    isaReferences: ["ISA 260.16-17", "ISA 450.12-13", "ISA 700.10-11"],
  },
  ISA_570: {
    systemPrompt: "You are an expert statutory auditor drafting a Going Concern assessment memo per ISA 570 (Revised).",
    userPrompt: `Draft a Going Concern Assessment Memo per ISA 570 (Revised).

Include:
1. Management's Assessment of Going Concern (ISA 570.10)
2. Period of Assessment (at least 12 months from FS date) (ISA 570.13)
3. Events or Conditions Identified — Financial, Operating, Other Indicators (ISA 570.A3-A4)
4. Evaluation of Management's Plans for Future Actions (ISA 570.16)
5. Additional Audit Procedures Performed (ISA 570.16)
6. Auditor's Conclusion on Appropriateness of Going Concern Basis (ISA 570.17-18)
7. Material Uncertainty Assessment (ISA 570.19-20)
8. Reporting Implications (ISA 570.21-23)

Use professional judgment language. Reference specific ISA 570 paragraphs.`,
    isaReferences: ["ISA 570.10-23", "ISA 570.A2-A7", "ISA 700.28-29"],
  },
  ISA_580: {
    systemPrompt: "You are an expert statutory auditor drafting a Management Representation Letter per ISA 580.",
    userPrompt: `Draft a Management Representation Letter per ISA 580.

Include representations regarding:
1. Management's Responsibility for FS Preparation (ISA 580.10)
2. Internal Controls Over Financial Reporting (ISA 580.11)
3. Completeness of Information Provided (ISA 580.A7)
4. Recognition, Measurement, and Disclosure Assertions
5. Fraud and Non-Compliance with Laws (ISA 580.A12)
6. Related Party Transactions (ISA 550)
7. Subsequent Events (ISA 560)
8. Going Concern (ISA 570)
9. Litigation and Claims
10. Use of the Work of an Expert (if applicable)

Format as a formal letter from management to the auditor. Include date line and signature blocks.`,
    isaReferences: ["ISA 580.10-13", "ISA 580.A7-A15", "ISA 550.26", "ISA 560.9"],
  },
  ISA_700: {
    systemPrompt: "You are an expert statutory auditor drafting an Independent Auditor's Report skeleton per ISA 700 (Revised).",
    userPrompt: `Draft an Independent Auditor's Report Skeleton per ISA 700 (Revised).

Include all required sections:
1. Title (ISA 700.21)
2. Addressee (ISA 700.22)
3. Opinion Section (ISA 700.23-27)
4. Basis for Opinion (ISA 700.28)
5. Going Concern (ISA 570.22 — if applicable)
6. Key Audit Matters (ISA 701 — placeholder)
7. Other Information (ISA 720)
8. Responsibilities of Management and TCWG (ISA 700.33-36)
9. Auditor's Responsibilities for the Audit (ISA 700.37-40)
10. Report on Other Legal and Regulatory Requirements
11. Name of Engagement Partner (ISA 700.46)
12. Signature, Date, Address

Use [PLACEHOLDER] for entity-specific details. Mark sections requiring professional judgment with [JUDGMENT REQUIRED].`,
    isaReferences: ["ISA 700.21-46", "ISA 701.11-13", "ISA 720.22", "ISA 570.22"],
  },
  ISA_701: {
    systemPrompt: "You are an expert statutory auditor drafting Key Audit Matters (KAM) per ISA 701.",
    userPrompt: `Draft Key Audit Matters (KAM) Communication per ISA 701.

For each KAM, include:
1. KAM Title (concise description) (ISA 701.13)
2. Why the Matter Was Considered a KAM (ISA 701.13(a))
3. How the Matter Was Addressed in the Audit (ISA 701.13(b))
4. Reference to Related FS Disclosures (ISA 701.13(c))

Draft 2-3 example KAMs covering common areas:
- Revenue Recognition (ISA 240 presumed risk)
- Significant Accounting Estimates (ISA 540)
- Related Party Transactions (ISA 550) or Impairment of Assets

Each KAM should be 2-3 paragraphs. Use formal audit report language.
Reference specific ISA standards in the "Why" section.`,
    isaReferences: ["ISA 701.9-13", "ISA 701.A26-A45", "ISA 240.26", "ISA 540.11"],
  },
};

const aiDraftSchema = z.object({
  outputType: z.enum(["ISA_260_PLANNING", "ISA_260_FINAL", "ISA_570", "ISA_580", "ISA_700", "ISA_701"]),
});

const gapResolutionSchema = z.object({
  isaId: z.string().min(1, "ISA ID is required"),
  isaName: z.string().min(1, "ISA name is required"),
  phase: z.string().min(1, "Phase is required"),
  gapDescription: z.string().min(1, "Gap description is required"),
  severity: z.enum(["Red", "Orange", "Amber", "Green", "Grey"]),
});

router.post("/engagements/:engagementId/ai-draft", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) return errorResponse(res, 404, access.error!);

    const bodyResult = aiDraftSchema.safeParse(req.body);
    if (!bodyResult.success) {
      return errorResponse(res, 400, "Invalid request body", bodyResult.error.errors);
    }

    const promptConfig = ISA_OUTPUT_PROMPTS[bodyResult.data.outputType];
    if (!promptConfig) return errorResponse(res, 400, "Invalid output type");

    const aiSettings = await fetchAISettings(req.user!.firmId!);

    const engagement = access.engagement!;
    const contextParts = [
      `Engagement: ${engagement.engagementName || engagement.name || "N/A"}`,
      `Client: ${engagement.clientName || "N/A"}`,
      `Year End: ${engagement.yearEnd || "N/A"}`,
      `Engagement Type: ${engagement.engagementType || "Statutory Audit"}`,
    ];

    const result = await generateAIContent(aiSettings, {
      prompt: promptConfig.userPrompt,
      context: contextParts.join("\n"),
      systemPrompt: promptConfig.systemPrompt,
      maxTokens: 3000,
      temperature: 0.6,
    });

    if (result.error) {
      return errorResponse(res, 500, result.error);
    }

    res.json({
      content: result.content,
      provider: result.provider,
      outputType: bodyResult.data.outputType,
      isaReferences: promptConfig.isaReferences,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "AI draft generation failed";
    console.error("AI draft error:", error);
    errorResponse(res, 500, message);
  }
});

router.post("/engagements/:engagementId/ai-gap-resolution", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) return errorResponse(res, 404, access.error!);

    const bodyResult = gapResolutionSchema.safeParse(req.body);
    if (!bodyResult.success) {
      return errorResponse(res, 400, "Invalid request body", bodyResult.error.errors);
    }

    const body = bodyResult.data;
    const aiSettings = await fetchAISettings(req.user!.firmId!);

    const result = await generateAIContent(aiSettings, {
      prompt: `You are an ISA compliance expert. A compliance gap has been detected in an audit engagement. Provide a detailed, actionable resolution plan.

Gap Details:
- ISA Standard: ${body.isaName} (${body.isaId})
- Audit Phase: ${body.phase}
- Gap Description: ${body.gapDescription}
- Severity: ${body.severity}

Provide:
1. Root Cause Analysis (why this gap typically occurs)
2. Step-by-Step Resolution Plan (3-5 specific actions)
3. Required Documentation to close the gap
4. ISA Paragraph References for each action
5. Estimated Effort (Low/Medium/High)
6. Priority Timeline (Immediate/This Week/Before Phase Lock)

Be specific and actionable. Reference exact ISA paragraph numbers.`,
      context: `Engagement ID: ${req.params.engagementId}`,
      maxTokens: 1500,
      temperature: 0.5,
    });

    if (result.error) {
      return errorResponse(res, 500, result.error);
    }

    res.json({
      resolution: result.content,
      provider: result.provider,
      gap: body,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "AI gap resolution failed";
    console.error("AI gap resolution error:", error);
    errorResponse(res, 500, message);
  }
});

export default router;
