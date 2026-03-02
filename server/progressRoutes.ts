import { Router, Response } from "express";
import { prisma } from "./db";
import { requireAuth, AuthenticatedRequest } from "./auth";

const router = Router();

async function validateEngagementAccess(engagementId: string, userId: string, firmId: string | null): Promise<{ valid: boolean; engagement?: any; error?: string }> {
  if (!firmId) {
    return { valid: false, error: "User not associated with a firm" };
  }
  
  const engagement = await prisma.engagement.findUnique({
    where: { id: engagementId },
    select: { id: true, firmId: true, currentPhase: true, engagementCode: true },
  });
  
  if (!engagement || engagement.firmId !== firmId) {
    return { valid: false, error: "Engagement not found" };
  }
  
  return { valid: true, engagement };
}

interface MissingItem {
  phase: string;
  category: string;
  description: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  actionRequired: string;
}

router.get("/:engagementId/comprehensive", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) {
      return res.status(access.error === "User not associated with a firm" ? 400 : 404).json({ error: access.error });
    }
    
    const engagementId = req.params.engagementId;

    const [
      engagement,
      phaseProgress,
      risks,
      tests,
      evidenceFiles,
      misstatements,
      materiality,
      checklists,
      independenceDeclarations,
      engagementLetter,
    ] = await Promise.all([
      prisma.engagement.findUnique({
        where: { id: engagementId },
        select: {
          id: true,
          engagementCode: true,
          engagementType: true,
          currentPhase: true,
          status: true,
          periodStart: true,
          periodEnd: true,
        },
      }),
      prisma.phaseProgress.findMany({
        where: { engagementId },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.riskAssessment.count({ where: { engagementId } }),
      prisma.substantiveTest.findMany({
        where: { engagementId },
        select: { id: true, conclusion: true, riskId: true },
      }),
      prisma.evidenceFile.count({ where: { engagementId } }),
      prisma.misstatement.findMany({
        where: { engagementId },
        select: { id: true, status: true, misstatementAmount: true },
      }),
      prisma.materialityCalculation.findFirst({
        where: { engagementId, status: 'APPROVED' },
      }),
      prisma.checklistItem.findMany({
        where: { engagementId },
        select: { id: true, phase: true, status: true },
      }),
      prisma.independenceDeclaration.count({
        where: { engagementId, status: 'CONFIRMED' },
      }),
      prisma.engagementLetter.findFirst({
        where: { engagementId, status: { in: ['ACCEPTED', 'APPROVED'] } },
      }),
    ]);

    const missingItems: MissingItem[] = [];

    if (!engagementLetter) {
      missingItems.push({
        phase: 'PRE_PLANNING',
        category: 'Documentation',
        description: 'Engagement letter not signed',
        priority: 'HIGH',
        actionRequired: 'Complete and sign engagement letter',
      });
    }

    if (independenceDeclarations === 0) {
      missingItems.push({
        phase: 'PRE_PLANNING',
        category: 'Compliance',
        description: 'No independence declarations confirmed',
        priority: 'HIGH',
        actionRequired: 'Confirm independence declarations for all team members',
      });
    }

    if (!materiality) {
      missingItems.push({
        phase: 'PLANNING',
        category: 'Planning',
        description: 'Materiality calculation not approved',
        priority: 'HIGH',
        actionRequired: 'Calculate and approve materiality thresholds',
      });
    }

    if (risks === 0) {
      missingItems.push({
        phase: 'PLANNING',
        category: 'Risk Assessment',
        description: 'No risk assessments documented',
        priority: 'HIGH',
        actionRequired: 'Document risk assessments for significant accounts',
      });
    }

    const testsWithConclusion = tests.filter(t => t.conclusion && t.conclusion.length > 0);
    const testsLinkedToRisks = tests.filter(t => t.riskId);
    
    if (risks > 0 && testsLinkedToRisks.length < risks) {
      missingItems.push({
        phase: 'EXECUTION',
        category: 'Testing',
        description: `${risks - testsLinkedToRisks.length} risks without linked tests`,
        priority: 'MEDIUM',
        actionRequired: 'Sync planning risks to create execution tests',
      });
    }

    if (tests.length > 0 && testsWithConclusion.length < tests.length) {
      const incomplete = tests.length - testsWithConclusion.length;
      missingItems.push({
        phase: 'EXECUTION',
        category: 'Testing',
        description: `${incomplete} substantive tests without conclusions`,
        priority: 'MEDIUM',
        actionRequired: 'Complete test conclusions',
      });
    }

    if (evidenceFiles === 0) {
      missingItems.push({
        phase: 'EVIDENCE',
        category: 'Documentation',
        description: 'No evidence files uploaded',
        priority: 'HIGH',
        actionRequired: 'Upload supporting evidence documents',
      });
    }

    const uncorrectedMisstatements = misstatements.filter(m => m.status !== 'ADJUSTED');
    if (uncorrectedMisstatements.length > 0) {
      const totalAmount = uncorrectedMisstatements.reduce((sum, m) => sum + Number(m.misstatementAmount), 0);
      missingItems.push({
        phase: 'FINALIZATION',
        category: 'Misstatements',
        description: `${uncorrectedMisstatements.length} uncorrected misstatements (PKR ${totalAmount.toLocaleString()})`,
        priority: totalAmount > 0 ? 'HIGH' : 'MEDIUM',
        actionRequired: 'Review and address uncorrected misstatements',
      });
    }

    const checklistsByPhase: Record<string, { total: number; completed: number }> = {};
    checklists.forEach(c => {
      if (!checklistsByPhase[c.phase]) {
        checklistsByPhase[c.phase] = { total: 0, completed: 0 };
      }
      checklistsByPhase[c.phase].total++;
      if (c.status === 'COMPLETED') {
        checklistsByPhase[c.phase].completed++;
      }
    });

    Object.entries(checklistsByPhase).forEach(([phase, data]) => {
      if (data.completed < data.total) {
        const incomplete = data.total - data.completed;
        missingItems.push({
          phase,
          category: 'Checklists',
          description: `${incomplete} incomplete checklist items`,
          priority: 'LOW',
          actionRequired: 'Complete all checklist items',
        });
      }
    });

    const phaseMetrics = phaseProgress.map((p, idx) => ({
      phase: p.phase,
      phaseOrder: idx + 1,
      status: p.status,
      completionPercentage: p.completionPercentage,
      startedAt: p.startedAt,
      completedAt: p.completedAt,
      lockedAt: p.lockedAt,
      isLocked: !!p.lockedAt,
    }));

    const totalCompletion = phaseProgress.length > 0
      ? Math.round(phaseProgress.reduce((sum, p) => sum + p.completionPercentage, 0) / phaseProgress.length)
      : 0;

    const completedPhases = phaseProgress.filter(p => p.status === 'COMPLETED' || p.status === 'LOCKED').length;
    const totalPhases = phaseProgress.length;

    const metrics = {
      risks: {
        total: risks,
        linkedToTests: testsLinkedToRisks.length,
        unlinked: Math.max(0, risks - testsLinkedToRisks.length),
      },
      tests: {
        total: tests.length,
        completed: testsWithConclusion.length,
        pending: tests.length - testsWithConclusion.length,
      },
      evidence: {
        total: evidenceFiles,
      },
      misstatements: {
        total: misstatements.length,
        corrected: misstatements.filter(m => m.status === 'ADJUSTED').length,
        uncorrected: uncorrectedMisstatements.length,
        totalAmount: misstatements.reduce((sum, m) => sum + Number(m.misstatementAmount), 0),
      },
      checklists: {
        total: checklists.length,
        completed: checklists.filter(c => c.status === 'COMPLETED').length,
      },
      materialityApproved: !!materiality,
      engagementLetterSigned: !!engagementLetter,
      independenceConfirmed: independenceDeclarations > 0,
    };

    return res.json({
      engagement: engagement ? {
        id: engagement.id,
        engagementCode: engagement.engagementCode,
        engagementType: engagement.engagementType,
        currentPhase: engagement.currentPhase,
        status: engagement.status,
        periodStart: engagement.periodStart,
        periodEnd: engagement.periodEnd,
      } : null,
      overall: {
        completionPercentage: totalCompletion,
        completedPhases,
        totalPhases,
        currentPhase: engagement?.currentPhase,
      },
      phases: phaseMetrics,
      metrics,
      missingItems: missingItems.sort((a, b) => {
        const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }),
    });
  } catch (error) {
    console.error("Error getting comprehensive progress:", error);
    return res.status(500).json({ error: "Failed to get progress data" });
  }
});

router.get("/:engagementId/sign-off-summary", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) {
      return res.status(access.error === "User not associated with a firm" ? 400 : 404).json({ error: access.error });
    }
    
    const engagementId = req.params.engagementId;

    const signOffs = await (prisma as any).signOffRegister?.findMany?.({
      where: { engagementId },
      include: {
        preparedBy: { select: { id: true, fullName: true } },
        reviewedBy: { select: { id: true, fullName: true } },
        approvedBy: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 1,
    }) || [];

    if (signOffs.length === 0) {
      return res.json(null);
    }

    const latest = signOffs[0];
    return res.json({
      preparedAt: latest.preparedAt,
      preparedBy: latest.preparedBy,
      reviewedAt: latest.reviewedAt,
      reviewedBy: latest.reviewedBy,
      approvedAt: latest.approvedAt,
      approvedBy: latest.approvedBy,
    });
  } catch (error) {
    console.error("Error getting sign-off summary:", error);
    return res.status(500).json({ error: "Failed to get sign-off summary" });
  }
});

router.get("/:engagementId/missing-items", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) {
      return res.status(access.error === "User not associated with a firm" ? 400 : 404).json({ error: access.error });
    }
    
    const engagementId = req.params.engagementId;

    const [
      engagementLetter,
      materiality,
      independenceDeclarations,
      checklists,
      signOffs,
    ] = await Promise.all([
      prisma.engagementLetter.findFirst({
        where: { engagementId, status: { in: ['ACCEPTED', 'APPROVED'] } },
      }),
      prisma.materialityCalculation.findFirst({
        where: { engagementId, status: 'APPROVED' },
      }),
      prisma.independenceDeclaration.count({
        where: { engagementId, status: 'CONFIRMED' },
      }),
      prisma.checklistItem.findMany({
        where: { engagementId, status: { not: 'COMPLETED' } },
        select: { id: true, title: true, phase: true },
        take: 10,
      }),
      (prisma as any).signOffRegister?.findMany?.({
        where: { engagementId, approvedAt: null },
        select: { id: true, signOffType: true, phase: true },
        take: 5,
      }) || [],
    ]);

    interface FormattedMissingItem {
      id: string;
      label: string;
      type: 'field' | 'attachment' | 'signoff';
      link?: string;
    }

    const items: FormattedMissingItem[] = [];

    if (!engagementLetter) {
      items.push({
        id: 'engagement-letter',
        label: 'Engagement letter not signed',
        type: 'field',
      });
    }

    if (!materiality) {
      items.push({
        id: 'materiality',
        label: 'Materiality not approved',
        type: 'field',
      });
    }

    if (independenceDeclarations === 0) {
      items.push({
        id: 'independence',
        label: 'Independence declarations missing',
        type: 'field',
      });
    }

    checklists.forEach((c: { id: string; title: string; phase: string }) => {
      items.push({
        id: `checklist-${c.id}`,
        label: `Checklist: ${c.title}`,
        type: 'field',
      });
    });

    signOffs.forEach((s: { id: string; signOffType: string; phase: string }) => {
      items.push({
        id: `signoff-${s.id}`,
        label: `Sign-off pending: ${s.signOffType}`,
        type: 'signoff',
      });
    });

    return res.json(items);
  } catch (error) {
    console.error("Error getting missing items:", error);
    return res.status(500).json({ error: "Failed to get missing items" });
  }
});

export default router;
