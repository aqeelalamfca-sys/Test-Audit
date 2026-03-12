import { Router, Response } from "express";
import { prisma } from "./db";
import { requireAuth, requireMinRole, logAuditTrail, type AuthenticatedRequest } from "./auth";
import { z } from "zod";

const router = Router();

const VALID_CATEGORIES = ["UNMODIFIED", "QUALIFIED", "ADVERSE", "DISCLAIMER"] as const;
const VALID_DECISIONS = ["PENDING", "ACCEPTED", "REVISED", "REJECTED", "OVERRIDDEN"] as const;
const VALID_RELIABILITY = ["HIGH", "MODERATE", "LIMITED", "INSUFFICIENT"] as const;

async function validateEngagementAccess(engagementId: string, userId: string, firmId: string | null | undefined) {
  if (!firmId) return { valid: false as const, error: "User not associated with a firm" };
  const engagement = await prisma.engagement.findFirst({ where: { id: engagementId, firmId } });
  if (!engagement) return { valid: false as const, error: "Engagement not found" };
  return { valid: true as const, engagement };
}

async function getEngine(engagementId: string) {
  return prisma.opinionEngine.findFirst({
    where: { engagementId },
    orderBy: { version: "desc" },
  });
}

async function getEngineWithRelations(engagementId: string) {
  return prisma.opinionEngine.findFirst({
    where: { engagementId },
    include: { findings: { orderBy: { createdAt: "desc" } }, aiRuns: { orderBy: { createdAt: "desc" }, take: 5 } },
    orderBy: { version: "desc" },
  });
}

router.get("/:engagementId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) return res.status(404).json({ error: access.error });

    let engine = await getEngineWithRelations(req.params.engagementId);

    if (!engine) {
      engine = await prisma.opinionEngine.create({
        data: {
          firmId: req.user!.firmId!,
          engagementId: req.params.engagementId,
          createdBy: req.user!.id,
          version: 1,
        },
        include: { findings: true, aiRuns: true },
      });
    }

    res.json(engine);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch opinion engine" });
  }
});

router.put("/:engagementId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) return res.status(404).json({ error: access.error });

    const engine = await getEngine(req.params.engagementId);
    if (!engine) return res.status(404).json({ error: "Opinion engine not found" });
    if (engine.status === "LOCKED") return res.status(403).json({ error: "Opinion engine is locked" });

    const schema = z.object({
      reviewerNotes: z.string().optional(),
      dataReliability: z.enum(VALID_RELIABILITY).optional(),
      reliabilityNotes: z.string().optional(),
      memoData: z.any().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid input", details: parsed.error.issues });

    const { reviewerNotes, dataReliability, reliabilityNotes, memoData } = parsed.data;

    const updated = await prisma.opinionEngine.update({
      where: { id: engine.id },
      data: {
        ...(reviewerNotes !== undefined && { reviewerNotes }),
        ...(dataReliability && { dataReliability }),
        ...(reliabilityNotes !== undefined && { reliabilityNotes }),
        ...(memoData !== undefined && { memoData }),
        updatedBy: req.user!.id,
      },
      include: { findings: { orderBy: { createdAt: "desc" } }, aiRuns: { orderBy: { createdAt: "desc" }, take: 5 } },
    });

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to update opinion engine" });
  }
});

router.post("/:engagementId/run-analysis", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) return res.status(404).json({ error: access.error });

    const engine = await getEngine(req.params.engagementId);
    if (!engine) return res.status(404).json({ error: "Opinion engine not found" });
    if (engine.status === "LOCKED") return res.status(403).json({ error: "Cannot run analysis on locked engine" });
    if (engine.status === "FINALIZED") return res.status(403).json({ error: "Cannot run analysis on finalized engine" });

    const engagement = await prisma.engagement.findUnique({
      where: { id: req.params.engagementId },
      include: {
        client: true,
        materialityAssessments: { orderBy: { createdAt: "desc" }, take: 1 },
        misstatements: true,
        goingConcernAssessment: true,
        riskAssessments: { where: { isSignificantRisk: true } },
        controlDeficiencies: true,
        subsequentEvents: true,
      },
    });

    if (!engagement) return res.status(404).json({ error: "Engagement not found" });

    const materiality = engagement.materialityAssessments?.[0];
    const misstatements = engagement.misstatements || [];
    const goingConcern = engagement.goingConcernAssessment;
    const significantRisks = engagement.riskAssessments || [];
    const controlDeficiencies = engagement.controlDeficiencies || [];
    const subsequentEvents = engagement.subsequentEvents || [];

    const uncorrectedMisstatements = misstatements.filter((m: any) => m.status !== "CORRECTED" && m.status !== "RESOLVED");
    const totalUncorrected = uncorrectedMisstatements.reduce((sum: number, m: any) => sum + (Number(m.amount) || 0), 0);
    const materialityAmount = Number(materiality?.overallMateriality) || 0;

    const findings: any[] = [];
    let score = 100;

    if (totalUncorrected > materialityAmount && materialityAmount > 0) {
      score -= 30;
      findings.push({
        sectionKey: "misstatements",
        auditArea: "Financial Statements",
        narrative: `Aggregate uncorrected misstatements (PKR ${totalUncorrected.toLocaleString()}) exceed overall materiality (PKR ${materialityAmount.toLocaleString()}). This indicates a material misstatement requiring qualification or adverse opinion under ISA 705.`,
        riskLevel: "CRITICAL",
        isaReference: "ISA 450.11, ISA 705",
        materialityImpact: "Exceeds materiality",
        amountInvolved: totalUncorrected,
        suggestedResponse: "Consider qualification or discuss correction with management.",
        assertionAffected: "Accuracy, Valuation",
      });
    } else if (totalUncorrected > materialityAmount * 0.5 && materialityAmount > 0) {
      score -= 10;
      findings.push({
        sectionKey: "misstatements",
        auditArea: "Financial Statements",
        narrative: `Aggregate uncorrected misstatements (PKR ${totalUncorrected.toLocaleString()}) are above 50% of overall materiality. Close to threshold — evaluate individually and in aggregate per ISA 450.`,
        riskLevel: "HIGH",
        isaReference: "ISA 450.11",
        materialityImpact: "Approaching materiality",
        amountInvolved: totalUncorrected,
        suggestedResponse: "Request management correction or assess qualitative significance.",
        assertionAffected: "Accuracy",
      });
    }

    if (goingConcern) {
      const gcData = goingConcern as any;
      if (gcData.conclusion === "MATERIAL_UNCERTAINTY" || gcData.conclusion === "material_uncertainty") {
        score -= 15;
        findings.push({
          sectionKey: "going_concern",
          auditArea: "Going Concern",
          narrative: "Material uncertainty related to going concern identified. Evaluate adequacy of disclosure under ISA 570. If adequate disclosure exists, include Emphasis of Matter paragraph; if inadequate, consider qualification.",
          riskLevel: "HIGH",
          isaReference: "ISA 570.18-19, ISA 706",
          materialityImpact: "Pervasive",
          suggestedResponse: "Include Material Uncertainty Related to Going Concern paragraph per ISA 570.22.",
        });
      }
      if (gcData.conclusion === "INAPPROPRIATE" || gcData.conclusion === "inappropriate_basis") {
        score -= 30;
        findings.push({
          sectionKey: "going_concern",
          auditArea: "Going Concern",
          narrative: "Going concern basis inappropriate but used by management. This requires an adverse opinion per ISA 570.21.",
          riskLevel: "CRITICAL",
          isaReference: "ISA 570.21",
          materialityImpact: "Pervasive",
          suggestedResponse: "Issue adverse opinion.",
        });
      }
    }

    if (significantRisks.length > 0) {
      const unaddressedRisks = significantRisks.filter((r: any) => !r.responseStatus || r.responseStatus === "PENDING");
      if (unaddressedRisks.length > 0) {
        score -= 10 * Math.min(unaddressedRisks.length, 3);
        findings.push({
          sectionKey: "risk_assessment",
          auditArea: "Risk Assessment",
          narrative: `${unaddressedRisks.length} significant risk(s) have not been adequately addressed through audit procedures. Under ISA 330, the auditor must obtain sufficient appropriate audit evidence for all significant risks.`,
          riskLevel: "HIGH",
          isaReference: "ISA 330.18, ISA 315",
          materialityImpact: "Potentially material",
          suggestedResponse: "Complete audit procedures for all significant risks before forming opinion.",
        });
      }
    }

    if (controlDeficiencies.length > 0) {
      const significant = controlDeficiencies.filter((d: any) => d.severity === "SIGNIFICANT" || d.severity === "MATERIAL_WEAKNESS");
      if (significant.length > 0) {
        score -= 5 * Math.min(significant.length, 4);
        findings.push({
          sectionKey: "internal_controls",
          auditArea: "Internal Controls",
          narrative: `${significant.length} significant deficienc${significant.length === 1 ? 'y' : 'ies'} or material weakness(es) identified. These must be communicated to those charged with governance per ISA 265.`,
          riskLevel: significant.some((d: any) => d.severity === "MATERIAL_WEAKNESS") ? "HIGH" : "MEDIUM",
          isaReference: "ISA 265.9",
          materialityImpact: "May affect audit approach",
          suggestedResponse: "Communicate to those charged with governance. Consider impact on audit opinion if controls relied upon.",
        });
      }
    }

    const pendingEvents = subsequentEvents.filter((e: any) => e.status === "PENDING" || e.status === "IDENTIFIED");
    if (pendingEvents.length > 0) {
      score -= 5;
      findings.push({
        sectionKey: "subsequent_events",
        auditArea: "Subsequent Events",
        narrative: `${pendingEvents.length} subsequent event(s) still pending evaluation. All events must be evaluated before issuing opinion per ISA 560.`,
        riskLevel: "MEDIUM",
        isaReference: "ISA 560.10-17",
        materialityImpact: "Unknown until evaluated",
        suggestedResponse: "Complete evaluation of all subsequent events.",
      });
    }

    score = Math.max(0, Math.min(100, score));

    let aiCategory: string = "UNMODIFIED";
    if (score >= 80) aiCategory = "UNMODIFIED";
    else if (score >= 60) aiCategory = "QUALIFIED";
    else if (score >= 30) aiCategory = "ADVERSE";
    else aiCategory = "DISCLAIMER";

    const scoresPayload = {
      misstatementScore: totalUncorrected > materialityAmount && materialityAmount > 0 ? 0 : (totalUncorrected > materialityAmount * 0.5 && materialityAmount > 0 ? 50 : 100),
      goingConcernScore: goingConcern ? (
        (goingConcern as any).conclusion === "INAPPROPRIATE" || (goingConcern as any).conclusion === "inappropriate_basis" ? 0 :
        (goingConcern as any).conclusion === "MATERIAL_UNCERTAINTY" || (goingConcern as any).conclusion === "material_uncertainty" ? 40 : 100
      ) : 100,
      riskCoverageScore: significantRisks.length > 0 ? Math.round(((significantRisks.length - (significantRisks.filter((r: any) => !r.responseStatus || r.responseStatus === "PENDING").length)) / significantRisks.length) * 100) : 100,
      controlScore: controlDeficiencies.length === 0 ? 100 : Math.max(0, 100 - controlDeficiencies.filter((d: any) => d.severity === "SIGNIFICANT" || d.severity === "MATERIAL_WEAKNESS").length * 20),
      subsequentEventsScore: pendingEvents.length === 0 ? 100 : Math.max(0, 100 - pendingEvents.length * 15),
    };

    await prisma.$transaction(async (tx) => {
      await tx.opinionFinding.deleteMany({ where: { opinionEngineId: engine.id } });

      for (const f of findings) {
        await tx.opinionFinding.create({
          data: { opinionEngineId: engine.id, ...f },
        });
      }

      await tx.opinionAiRun.create({
        data: {
          opinionEngineId: engine.id,
          sectionKey: null,
          runType: "full",
          sourcesUsed: [
            "materiality_assessments", "misstatements", "going_concern",
            "significant_risks", "control_deficiencies", "subsequent_events",
          ],
          findingsCount: findings.length,
          initiatedBy: req.user!.id,
          completedAt: new Date(),
        },
      });

      await tx.opinionEngine.update({
        where: { id: engine.id },
        data: {
          overallScore: score,
          aiCategory: aiCategory as any,
          status: engine.status === "DRAFT" ? "IN_PROGRESS" : engine.status,
          lastAiRunAt: new Date(),
          lastAiRunBy: req.user!.id,
          updatedBy: req.user!.id,
          scoresData: scoresPayload,
        },
      });
    });

    const updated = await getEngineWithRelations(req.params.engagementId);

    await logAuditTrail(
      req.user!.id, "OPINION_ENGINE_ANALYSIS", "opinion_engine", engine.id,
      null, { score, aiCategory, findingsCount: findings.length },
      req.params.engagementId,
      `AI opinion analysis completed: ${aiCategory} (score: ${score})`,
      req.ip, req.get("user-agent")
    );

    res.json(updated);
  } catch (error: any) {
    console.error("Opinion engine analysis error:", error);
    res.status(500).json({ error: "Failed to run analysis" });
  }
});

router.put("/:engagementId/findings/:findingId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) return res.status(404).json({ error: access.error });

    const engine = await getEngine(req.params.engagementId);
    if (!engine) return res.status(404).json({ error: "Opinion engine not found" });
    if (engine.status === "LOCKED") return res.status(403).json({ error: "Opinion engine is locked" });

    const finding = await prisma.opinionFinding.findFirst({
      where: { id: req.params.findingId, opinionEngineId: engine.id },
    });
    if (!finding) return res.status(404).json({ error: "Finding not found" });

    const schema = z.object({
      reviewerNote: z.string().optional(),
      reviewerDecision: z.enum(VALID_DECISIONS).optional(),
      finalStatus: z.string().max(50).optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

    const { reviewerNote, reviewerDecision, finalStatus } = parsed.data;

    const updated = await prisma.opinionFinding.update({
      where: { id: req.params.findingId },
      data: {
        ...(reviewerNote !== undefined && { reviewerNote }),
        ...(reviewerDecision && { reviewerDecision }),
        ...(finalStatus && { finalStatus }),
        reviewerBy: req.user!.id,
        reviewerAt: new Date(),
      },
    });

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to update finding" });
  }
});

router.delete("/:engagementId/findings/:findingId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) return res.status(404).json({ error: access.error });

    const engine = await getEngine(req.params.engagementId);
    if (!engine) return res.status(404).json({ error: "Opinion engine not found" });
    if (engine.status === "LOCKED") return res.status(403).json({ error: "Opinion engine is locked" });

    const finding = await prisma.opinionFinding.findFirst({
      where: { id: req.params.findingId, opinionEngineId: engine.id },
    });
    if (!finding) return res.status(404).json({ error: "Finding not found" });

    await prisma.opinionFinding.delete({ where: { id: req.params.findingId } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to delete finding" });
  }
});

router.post("/:engagementId/partner-sign", requireAuth, requireMinRole("PARTNER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) return res.status(404).json({ error: access.error });

    const engine = await getEngine(req.params.engagementId);
    if (!engine) return res.status(404).json({ error: "Opinion engine not found" });
    if (engine.status === "LOCKED") return res.status(403).json({ error: "Cannot sign a locked engine" });

    const schema = z.object({
      partnerCategory: z.enum(VALID_CATEGORIES),
      partnerConclusion: z.string().max(5000).optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

    const { partnerCategory, partnerConclusion } = parsed.data;

    const updated = await prisma.opinionEngine.update({
      where: { id: engine.id },
      data: {
        partnerCategory,
        partnerConclusion: partnerConclusion || null,
        partnerSignedAt: new Date(),
        partnerSignedBy: req.user!.id,
        status: "FINALIZED",
        updatedBy: req.user!.id,
      },
      include: { findings: { orderBy: { createdAt: "desc" } }, aiRuns: { orderBy: { createdAt: "desc" }, take: 5 } },
    });

    await logAuditTrail(
      req.user!.id, "OPINION_ENGINE_PARTNER_SIGN", "opinion_engine", engine.id,
      null, { partnerCategory, partnerConclusion },
      req.params.engagementId,
      `Partner signed opinion: ${partnerCategory}`,
      req.ip, req.get("user-agent")
    );

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to sign opinion" });
  }
});

router.post("/:engagementId/lock", requireAuth, requireMinRole("PARTNER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) return res.status(404).json({ error: access.error });

    const engine = await getEngine(req.params.engagementId);
    if (!engine) return res.status(404).json({ error: "Opinion engine not found" });
    if (engine.status === "LOCKED") return res.status(400).json({ error: "Already locked" });
    if (!engine.partnerSignedAt) return res.status(400).json({ error: "Partner must sign before locking" });

    const updated = await prisma.opinionEngine.update({
      where: { id: engine.id },
      data: {
        status: "LOCKED",
        lockedAt: new Date(),
        lockedBy: req.user!.id,
        updatedBy: req.user!.id,
      },
      include: { findings: { orderBy: { createdAt: "desc" } }, aiRuns: { orderBy: { createdAt: "desc" }, take: 5 } },
    });

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to lock opinion engine" });
  }
});

router.get("/:engagementId/data-sources", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) return res.status(404).json({ error: access.error });

    const [materiality, misstatements, goingConcern, risks, deficiencies, events] = await Promise.all([
      prisma.materialityAssessment.findFirst({ where: { engagementId: req.params.engagementId }, orderBy: { createdAt: "desc" } }),
      prisma.misstatement.findMany({ where: { engagementId: req.params.engagementId } }),
      prisma.goingConcernAssessment.findFirst({ where: { engagementId: req.params.engagementId } }),
      prisma.riskAssessment.findMany({ where: { engagementId: req.params.engagementId, isSignificantRisk: true } }),
      prisma.controlDeficiency.findMany({ where: { engagementId: req.params.engagementId } }),
      prisma.subsequentEvent.findMany({ where: { engagementId: req.params.engagementId } }),
    ]);

    res.json({
      materiality: { available: !!materiality, overallMateriality: materiality?.overallMateriality, performanceMateriality: materiality?.performanceMateriality },
      misstatements: { available: misstatements.length > 0, count: misstatements.length, uncorrectedCount: misstatements.filter((m: any) => m.status !== "CORRECTED" && m.status !== "RESOLVED").length },
      goingConcern: { available: !!goingConcern, conclusion: (goingConcern as any)?.conclusion },
      significantRisks: { available: risks.length > 0, count: risks.length },
      controlDeficiencies: { available: deficiencies.length > 0, count: deficiencies.length, significantCount: deficiencies.filter((d: any) => d.severity === "SIGNIFICANT" || d.severity === "MATERIAL_WEAKNESS").length },
      subsequentEvents: { available: events.length > 0, count: events.length, pendingCount: events.filter((e: any) => e.status === "PENDING" || e.status === "IDENTIFIED").length },
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch data sources" });
  }
});

export default router;
