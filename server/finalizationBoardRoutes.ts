import { Router, Response } from "express";
import { prisma } from "./db";
import { requireAuth, type AuthenticatedRequest } from "./auth";
import OpenAI from "openai";

const router = Router();

function computeRiskScore(data: {
  pendingExecutionItems: number;
  highSeverityIssues: number;
  mediumSeverityIssues: number;
  missingEvidence: number;
  unadjustedMisstatements: number;
  unadjustedTotalAmount: number;
  kamItems: number;
  kamDraftIncomplete: number;
  overallMateriality?: number;
}): { score: number; level: string; drivers: string[]; actions: string[] } {
  let score = 0;
  const drivers: string[] = [];
  const actions: string[] = [];

  const openItemScore = Math.min(30, data.pendingExecutionItems * 2);
  if (openItemScore > 0) {
    score += openItemScore;
    drivers.push(`${data.pendingExecutionItems} open execution items contributing ${openItemScore} points`);
    actions.push("Complete all pending execution procedures before finalization");
  }

  const highScore = Math.min(30, data.highSeverityIssues * 10);
  if (highScore > 0) {
    score += highScore;
    drivers.push(`${data.highSeverityIssues} high severity issues contributing ${highScore} points`);
    actions.push("Resolve all high severity issues immediately");
  }

  const medScore = Math.min(15, data.mediumSeverityIssues * 3);
  if (medScore > 0) {
    score += medScore;
    drivers.push(`${data.mediumSeverityIssues} medium severity issues contributing ${medScore} points`);
    actions.push("Review and address medium severity issues");
  }

  const evidenceScore = Math.min(15, data.missingEvidence * 5);
  if (evidenceScore > 0) {
    score += evidenceScore;
    drivers.push(`${data.missingEvidence} missing evidence flags contributing ${evidenceScore} points`);
    actions.push("Obtain missing audit evidence per ISA 500");
  }

  if (data.overallMateriality && data.unadjustedTotalAmount > 0) {
    const ratio = Number(data.unadjustedTotalAmount) / data.overallMateriality;
    if (ratio > 0.5) {
      score += 10;
      drivers.push("Unadjusted misstatements approaching materiality threshold (ISA 450)");
      actions.push("Assess aggregate effect of unadjusted misstatements on financial statements");
    }
  }

  if (data.kamItems > 0 && data.kamDraftIncomplete > 0) {
    score += 10;
    drivers.push(`${data.kamDraftIncomplete} KAM drafts incomplete out of ${data.kamItems} total (ISA 701)`);
    actions.push("Complete all Key Audit Matters documentation");
  }

  score = Math.min(100, score);
  const level = score < 30 ? "LOW" : score < 60 ? "MEDIUM" : "HIGH";

  const topDrivers = drivers.slice(0, 3);
  const topActions = actions.slice(0, 3);

  return { score, level, drivers: topDrivers, actions: topActions };
}

async function generateAIRiskNarrative(boardData: {
  riskScore: number;
  riskLevel: string;
  drivers: string[];
  actions: string[];
  pendingExecutionItems: number;
  highSeverityIssues: number;
  unadjustedMisstatements: number;
  missingEvidence: number;
  kamItems: number;
}): Promise<{ narrative: string; recommendations: string[] } | null> {
  try {
    const openai = new OpenAI();
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 400,
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content: "You are a statutory audit risk analyst. Provide a concise professional risk narrative and 2-3 specific recommendations for the audit partner. Be direct and ISA-compliant. Respond in JSON: {\"narrative\": \"string\", \"recommendations\": [\"string\"]}",
        },
        {
          role: "user",
          content: `Finalization Board Summary:\n- Risk Score: ${boardData.riskScore}/100 (${boardData.riskLevel})\n- Pending execution items: ${boardData.pendingExecutionItems}\n- High severity issues: ${boardData.highSeverityIssues}\n- Unadjusted misstatements: ${boardData.unadjustedMisstatements}\n- Missing evidence: ${boardData.missingEvidence}\n- KAM items: ${boardData.kamItems}\n\nTop drivers: ${boardData.drivers.join("; ")}\n\nProvide a risk narrative and actionable recommendations.`,
        },
      ],
    });

    const content = completion.choices[0]?.message?.content || "";
    const parsed = JSON.parse(content.replace(/```json\s*|\s*```/g, "").trim());
    return { narrative: parsed.narrative, recommendations: parsed.recommendations || [] };
  } catch {
    return null;
  }
}

async function resolveEngagementId(engagementIdOrCode: string, firmId: string) {
  let engagement = await prisma.engagement.findFirst({
    where: { id: engagementIdOrCode, firmId },
    select: { id: true, firmId: true, engagementCode: true },
  });
  if (!engagement) {
    engagement = await prisma.engagement.findFirst({
      where: { engagementCode: engagementIdOrCode, firmId },
      select: { id: true, firmId: true, engagementCode: true },
    });
  }
  return engagement;
}

router.post("/:engagementId/generate-board", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId: engagementIdParam } = req.params;
    const user = req.user!;
    const userRole = user.role;

    const engagement = await resolveEngagementId(engagementIdParam, user.firmId!);
    if (!engagement) return res.status(404).json({ error: "Engagement not found" });
    const engagementId = engagement.id;

    const isAssociate = ["STAFF", "SENIOR"].includes(userRole);
    const isManager = userRole === "MANAGER";
    const isPartner = ["PARTNER", "FIRM_ADMIN"].includes(userRole);

    const reviewNoteUserFilter = isAssociate ? { authorId: user.id } : {};

    const [
      pendingProcedures,
      openReviewNotes,
      openIssues,
      highSeverityIssues,
      mediumSeverityIssues,
      missingEvidenceCount,
      materialityData,
    ] = await Promise.all([
      prisma.fSHeadProcedure.count({
        where: {
          workingPaper: { engagementId },
          conclusion: null,
        },
      }).catch(() => 0),
      prisma.reviewNote.count({
        where: { engagementId, status: "OPEN", ...reviewNoteUserFilter },
      }).catch(() => 0),
      prisma.reviewNote.count({
        where: { engagementId, status: "OPEN", ...reviewNoteUserFilter },
      }).catch(() => 0),
      prisma.reviewNote.count({
        where: { engagementId, status: "OPEN", severity: "CRITICAL", ...reviewNoteUserFilter },
      }).catch(() => 0),
      prisma.reviewNote.count({
        where: { engagementId, status: "OPEN", severity: "WARNING", ...reviewNoteUserFilter },
      }).catch(() => 0),
      prisma.fSHeadProcedure.count({
        where: {
          workingPaper: { engagementId },
          conclusion: null,
          results: null,
        },
      }).catch(() => 0),
      prisma.materialityCalculation.findFirst({
        where: { engagementId },
        select: { overallMateriality: true },
        orderBy: { createdAt: "desc" },
      }).catch(() => null),
    ]);

    const [misstatementData, kamData] = await Promise.all([
      prisma.misstatement.findMany({
        where: {
          engagementId,
          status: { in: ["IDENTIFIED", "PENDING_REVIEW"] },
        },
        select: { misstatementAmount: true },
      }).catch(() => []),
      prisma.auditReport.findFirst({
        where: { engagementId },
        select: { keyAuditMatters: true },
      }).catch(() => null),
    ]);

    const unadjustedMisstatements = misstatementData.length;
    const unadjustedTotalAmount = misstatementData.reduce(
      (sum, m) => sum + (Number(m.misstatementAmount) || 0), 0
    );
    const kamArray = Array.isArray(kamData?.keyAuditMatters) ? kamData.keyAuditMatters : [];
    const kamItems = kamArray.length;
    const kamDraftIncomplete = 0;

    const riskResult = computeRiskScore({
      pendingExecutionItems: pendingProcedures,
      highSeverityIssues,
      mediumSeverityIssues,
      missingEvidence: missingEvidenceCount,
      unadjustedMisstatements,
      unadjustedTotalAmount,
      kamItems,
      kamDraftIncomplete,
      overallMateriality: materialityData?.overallMateriality ? Number(materialityData.overallMateriality) : undefined,
    });

    const aiNarrative = await generateAIRiskNarrative({
      riskScore: riskResult.score,
      riskLevel: riskResult.level,
      drivers: riskResult.drivers,
      actions: riskResult.actions,
      pendingExecutionItems: pendingProcedures,
      highSeverityIssues,
      unadjustedMisstatements,
      missingEvidence: missingEvidenceCount,
      kamItems,
    });

    const board = await prisma.finalizationBoard.create({
      data: {
        engagementId,
        userId: user.id,
        userRole,
        pendingExecutionItems: pendingProcedures,
        openReviewNotes,
        unresolvedIssues: openIssues,
        unadjustedMisstatements,
        unadjustedTotalAmount,
        kamItems,
        kamDraftIncomplete,
        missingEvidence: missingEvidenceCount,
        highSeverityIssues,
        mediumSeverityIssues,
        staleItemsDays: 0,
        riskScore: riskResult.score,
        riskLevel: riskResult.level,
        riskDrivers: { drivers: riskResult.drivers, actions: riskResult.actions },
        aiRecommendations: aiNarrative ? { narrative: aiNarrative.narrative, recommendations: aiNarrative.recommendations } : null,
        status: "Generated",
      },
    });

    prisma.auditTrail.create({
      data: {
        engagementId,
        userId: user.id,
        userRole: user.role,
        action: "FINALIZATION_BOARD_GENERATED",
        entityType: "FinalizationBoard",
        entityId: board.id,
        module: "FINALIZATION",
        screen: "CONTROL_BOARD",
        afterValue: {
          riskScore: riskResult.score,
          riskLevel: riskResult.level,
          pendingItems: pendingProcedures,
          openNotes: openReviewNotes,
        },
      },
    }).catch(err => console.error("Audit trail error:", err));

    res.json({
      success: true,
      board: {
        ...board,
        riskDrivers: riskResult.drivers,
        riskActions: riskResult.actions,
        unadjustedTotalAmount: Number(board.unadjustedTotalAmount),
        aiNarrative: aiNarrative?.narrative || null,
        aiRecommendations: aiNarrative
          ? { narrative: aiNarrative.narrative, recommendations: aiNarrative.recommendations }
          : board.aiRecommendations,
      },
    });
  } catch (error: any) {
    console.error("Error generating finalization board:", error);
    res.status(500).json({ error: error.message || "Failed to generate finalization board" });
  }
});

router.get("/:engagementId/board", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId: engagementIdParam } = req.params;
    const user = req.user!;

    const engagement = await resolveEngagementId(engagementIdParam, user.firmId!);
    if (!engagement) return res.status(404).json({ error: "Engagement not found" });
    const engagementId = engagement.id;

    const isAssociate = ["STAFF", "SENIOR"].includes(user.role);

    const board = await prisma.finalizationBoard.findFirst({
      where: {
        engagementId,
        ...(isAssociate ? { userId: user.id } : {}),
      },
      orderBy: { generatedAt: "desc" },
      include: {
        user: { select: { fullName: true, role: true } },
      },
    });

    if (!board) {
      return res.json({
        board: null,
        engagementCode: engagement.engagementCode,
        message: "No board generated yet. Generate one to see the finalization status.",
      });
    }

    res.json({
      board: {
        ...board,
        unadjustedTotalAmount: Number(board.unadjustedTotalAmount),
        generatedByName: board.user?.fullName,
        generatedByRole: board.user?.role,
      },
      engagementCode: engagement.engagementCode,
    });
  } catch (error: any) {
    console.error("Error fetching finalization board:", error);
    res.status(500).json({ error: error.message || "Failed to fetch finalization board" });
  }
});

router.get("/:engagementId/blockers", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId: engagementIdParam } = req.params;
    const user = req.user!;

    const engagement = await resolveEngagementId(engagementIdParam, user.firmId!);
    if (!engagement) return res.status(404).json({ error: "Engagement not found" });
    const engagementId = engagement.id;

    const board = await prisma.finalizationBoard.findFirst({
      where: { engagementId },
      orderBy: { generatedAt: "desc" },
    });

    const blockers: { code: string; message: string; severity: string }[] = [];

    if (board) {
      if (board.riskLevel === "HIGH" && board.highSeverityIssues > 0) {
        blockers.push({
          code: "HIGH_RISK_UNRESOLVED",
          message: `Risk rating is HIGH with ${board.highSeverityIssues} unresolved high severity issue(s). Resolve before approval.`,
          severity: "CRITICAL",
        });
      }

      if (board.pendingExecutionItems > 0) {
        blockers.push({
          code: "PENDING_EXECUTION",
          message: `${board.pendingExecutionItems} execution procedure(s) still pending completion.`,
          severity: "CRITICAL",
        });
      }

      if (board.unadjustedMisstatements > 0 && board.openReviewNotes > 0) {
        blockers.push({
          code: "ISA450_UNADJUSTED",
          message: `ISA 450: ${board.unadjustedMisstatements} unadjusted misstatement(s) with open review notes requiring documentation.`,
          severity: "WARNING",
        });
      }

      if (board.missingEvidence > 0) {
        blockers.push({
          code: "MISSING_EVIDENCE",
          message: `${board.missingEvidence} procedure(s) missing evidence references (ISA 500).`,
          severity: "WARNING",
        });
      }
    }

    res.json({ blockers, hasBlockers: blockers.some(b => b.severity === "CRITICAL") });
  } catch (error: any) {
    console.error("Error checking finalization blockers:", error);
    res.status(500).json({ error: "Failed to check finalization blockers" });
  }
});

export default router;
