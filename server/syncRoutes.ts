import { Router, Response } from "express";
import { prisma } from "./db";
import { requireAuth, logAuditTrail, AuthenticatedRequest } from "./auth";
import { validateEngagementAccess } from "./lib/validateEngagementAccess";

const router = Router();

);
    }
    
    const engagementId = req.params.engagementId;
    
    const risks = await prisma.riskAssessment.findMany({
      where: { engagementId },
      select: {
        id: true,
        accountOrClass: true,
        fsArea: true,
        assertion: true,
        riskOfMaterialMisstatement: true,
        isSignificantRisk: true,
        isFraudRisk: true,
        plannedResponse: true,
        natureOfProcedures: true,
        extentOfProcedures: true,
      },
    });

    const existingTests = await prisma.substantiveTest.findMany({
      where: { engagementId },
      select: { riskId: true },
    });
    const linkedRiskIds = new Set(existingTests.map(t => t.riskId).filter(Boolean));

    const materiality = await prisma.materialityCalculation.findFirst({
      where: { engagementId, status: 'APPROVED' },
      select: { overallMateriality: true, performanceMateriality: true },
    });

    const syncPreview = risks.map(risk => ({
      riskId: risk.id,
      accountOrClass: risk.accountOrClass,
      fsArea: risk.fsArea,
      assertion: risk.assertion,
      riskLevel: risk.riskOfMaterialMisstatement,
      isSignificant: risk.isSignificantRisk,
      isFraud: risk.isFraudRisk,
      plannedResponse: risk.plannedResponse,
      alreadySynced: linkedRiskIds.has(risk.id),
      toBeCreated: !linkedRiskIds.has(risk.id),
    }));

    const stats = {
      totalRisks: risks.length,
      alreadySynced: syncPreview.filter(s => s.alreadySynced).length,
      toSync: syncPreview.filter(s => !s.alreadySynced).length,
      highRisks: risks.filter(r => r.riskOfMaterialMisstatement === 'HIGH').length,
      significantRisks: risks.filter(r => r.isSignificantRisk).length,
      fraudRisks: risks.filter(r => r.isFraudRisk).length,
    };

    return res.json({ 
      preview: syncPreview,
      stats,
      materiality: materiality ? {
        overall: Number(materiality.overallMateriality),
        performance: Number(materiality.performanceMateriality),
      } : null,
    });
  } catch (error) {
    console.error("Error generating sync preview:", error);
    return res.status(500).json({ error: "Failed to generate sync preview" });
  }
});

router.post("/:engagementId/planning-to-execution", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) {
      return res.status(access.error === "User not associated with a firm" ? 400 : 404).json({ error: access.error });
    }
    
    const engagementId = req.params.engagementId;
    const userId = req.user!.id;
    const { riskIds } = req.body as { riskIds?: string[] };

    const existingTests = await prisma.substantiveTest.findMany({
      where: { engagementId },
      select: { riskId: true },
    });
    const linkedRiskIds = new Set(existingTests.map(t => t.riskId).filter(Boolean));

    let risksToSync;
    if (riskIds && riskIds.length > 0) {
      risksToSync = await prisma.riskAssessment.findMany({
        where: { 
          engagementId,
          id: { in: riskIds },
        },
      });
    } else {
      risksToSync = await prisma.riskAssessment.findMany({
        where: { engagementId },
      });
    }

    risksToSync = risksToSync.filter(r => !linkedRiskIds.has(r.id));

    if (risksToSync.length === 0) {
      return res.json({ 
        message: "No new risks to sync",
        createdTests: 0,
        tests: [],
      });
    }

    const maxTestNum = await prisma.substantiveTest.count({ where: { engagementId } });
    let testCounter = maxTestNum + 1;

    const createdTests = await Promise.all(
      risksToSync.map(async (risk) => {
        const testRef = `ST-${String(testCounter++).padStart(3, '0')}`;
        
        let testingType: 'DETAIL' | 'ANALYTICAL' | 'COMBINED' = 'DETAIL';
        if (risk.riskOfMaterialMisstatement === 'LOW') {
          testingType = 'ANALYTICAL';
        } else if (risk.isSignificantRisk || risk.isFraudRisk) {
          testingType = 'DETAIL';
        } else {
          testingType = 'COMBINED';
        }

        const test = await prisma.substantiveTest.create({
          data: {
            engagementId,
            testReference: testRef,
            fsArea: risk.fsArea || 'REVENUE',
            accountName: risk.accountOrClass,
            assertion: risk.assertion,
            riskId: risk.id,
            testingType,
            testObjective: risk.plannedResponse || `Address ${risk.riskOfMaterialMisstatement} risk of material misstatement for ${risk.accountOrClass} - ${risk.assertion}`,
            testProcedure: risk.natureOfProcedures || `Perform substantive procedures to test ${risk.assertion} assertion for ${risk.accountOrClass}`,
            performedById: userId,
          },
        });

        return test;
      })
    );

    await logAuditTrail(
      userId,
      'SYNC_PLANNING_TO_EXECUTION',
      'Engagement',
      engagementId,
      null,
      { risksCount: risksToSync.length, testsCreated: createdTests.length },
      engagementId
    );

    return res.json({
      message: `Successfully synced ${createdTests.length} risks to execution`,
      createdTests: createdTests.length,
      tests: createdTests.map(t => ({
        id: t.id,
        testReference: t.testReference,
        riskId: t.riskId,
        fsArea: t.fsArea,
      })),
    });
  } catch (error) {
    console.error("Error syncing planning to execution:", error);
    return res.status(500).json({ error: "Failed to sync planning to execution" });
  }
});

router.get("/:engagementId/sync-status", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) {
      return res.status(access.error === "User not associated with a firm" ? 400 : 404).json({ error: access.error });
    }
    
    const engagementId = req.params.engagementId;
    
    const [risks, tests, materiality] = await Promise.all([
      prisma.riskAssessment.count({ where: { engagementId } }),
      prisma.substantiveTest.count({ where: { engagementId } }),
      prisma.materialityCalculation.findFirst({
        where: { engagementId, status: 'APPROVED' },
        select: { id: true },
      }),
    ]);

    const testsWithRisks = await prisma.substantiveTest.count({
      where: { engagementId, riskId: { not: null } },
    });

    return res.json({
      risksCount: risks,
      testsCount: tests,
      linkedTestsCount: testsWithRisks,
      unlinkedRisks: Math.max(0, risks - testsWithRisks),
      materialityApproved: !!materiality,
      syncCoverage: risks > 0 ? Math.round((testsWithRisks / risks) * 100) : 0,
    });
  } catch (error) {
    console.error("Error getting sync status:", error);
    return res.status(500).json({ error: "Failed to get sync status" });
  }
});

export default router;
