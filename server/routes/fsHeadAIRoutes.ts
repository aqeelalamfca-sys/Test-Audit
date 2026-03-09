import { Router, Response } from "express";
import { requireAuth, type AuthenticatedRequest } from "../auth";
import { z } from "zod";
import {
  generateAuditProcedures,
  generateTOCItems,
  generateTODItems,
  generateAnalyticalProcedures,
  generateRiskAreas,
  determineAuditApproach,
  generateWorkspaceContent,
  generateConclusionDraft
} from "../services/fsHeadAIService";
import {
  FS_HEAD_TEMPLATES,
  detectFSHeadType,
  getFSHeadTemplate,
  calculateSampleSize,
  validateFSHeadCompletion
} from "../services/fsHeadProcedureTemplates";
import { prisma } from "../db";

const router = Router();
const db = prisma as any;

router.post("/generate-procedures/:engagementId/:fsHeadKey", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId, fsHeadKey } = req.params;
    const { fsHeadName } = req.body;

    const engagement = await db.engagement.findFirst({
      where: {
        id: engagementId,
        firmId: req.user!.firmId,
      },
    });

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    const procedures = await generateAuditProcedures(engagementId, fsHeadKey, fsHeadName || fsHeadKey);

    res.json({
      success: true,
      procedures,
      message: `Generated ${procedures.length} audit procedures for ${fsHeadName || fsHeadKey}`
    });
  } catch (error) {
    console.error("Generate procedures error:", error);
    res.status(500).json({ error: "Failed to generate audit procedures" });
  }
});

router.post("/generate-toc/:engagementId/:fsHeadKey", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId, fsHeadKey } = req.params;
    const { fsHeadName, saveToDb } = req.body;

    const engagement = await db.engagement.findFirst({
      where: {
        id: engagementId,
        firmId: req.user!.firmId,
      },
    });

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    const tocItems = await generateTOCItems(engagementId, fsHeadKey, fsHeadName || fsHeadKey);

    if (saveToDb) {
      let workingPaper = await db.fSHeadWorkingPaper.findFirst({
        where: { engagementId, fsHeadKey }
      });

      if (!workingPaper) {
        workingPaper = await db.fSHeadWorkingPaper.create({
          data: {
            engagementId,
            fsHeadKey,
            status: "DRAFT"
          }
        });
      }

      for (const toc of tocItems) {
        await db.fSHeadTOC.create({
          data: {
            workingPaperId: workingPaper.id,
            tocRef: toc.tocRef,
            controlDescription: toc.controlDescription,
            controlOwner: toc.controlOwner,
            controlFrequency: toc.controlFrequency,
            controlType: toc.controlType,
            testSteps: toc.testSteps,
            assertions: toc.assertions,
            result: "NOT_TESTED",
            isAISuggested: true
          }
        });
      }
    }

    res.json({
      success: true,
      toc: tocItems,
      message: `Generated ${tocItems.length} Test of Controls for ${fsHeadName || fsHeadKey}`
    });
  } catch (error) {
    console.error("Generate TOC error:", error);
    res.status(500).json({ error: "Failed to generate Test of Controls" });
  }
});

router.post("/generate-tod/:engagementId/:fsHeadKey", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId, fsHeadKey } = req.params;
    const { fsHeadName, saveToDb } = req.body;

    const engagement = await db.engagement.findFirst({
      where: {
        id: engagementId,
        firmId: req.user!.firmId,
      },
    });

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    let workingPaper = await db.fSHeadWorkingPaper.findFirst({
      where: { engagementId, fsHeadKey }
    });

    const todItems = await generateTODItems(
      engagementId,
      fsHeadKey,
      fsHeadName || fsHeadKey,
      workingPaper?.currentYearBalance,
      workingPaper?.priorYearBalance
    );

    if (saveToDb) {
      if (!workingPaper) {
        workingPaper = await db.fSHeadWorkingPaper.create({
          data: {
            engagementId,
            fsHeadKey,
            fsHeadName: fsHeadName || fsHeadKey,
            status: "DRAFT"
          }
        });
      }
      for (const tod of todItems) {
        await db.fSHeadTOD.create({
          data: {
            workingPaperId: workingPaper.id,
            todRef: tod.todRef,
            procedureDescription: tod.procedureDescription,
            assertions: tod.assertions,
            populationDescription: tod.populationDescription,
            sampleSize: tod.sampleSize,
            samplingMethod: tod.samplingMethod,
            result: "NOT_STARTED",
            isAISuggested: true
          }
        });
      }
    }

    res.json({
      success: true,
      tod: todItems,
      message: `Generated ${todItems.length} Test of Details for ${fsHeadName || fsHeadKey}`
    });
  } catch (error) {
    console.error("Generate TOD error:", error);
    res.status(500).json({ error: "Failed to generate Test of Details" });
  }
});

router.post("/generate-analytics/:engagementId/:fsHeadKey", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId, fsHeadKey } = req.params;
    const { fsHeadName, saveToDb } = req.body;

    const engagement = await db.engagement.findFirst({
      where: {
        id: engagementId,
        firmId: req.user!.firmId,
      },
    });

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    let workingPaper = await db.fSHeadWorkingPaper.findFirst({
      where: { engagementId, fsHeadKey }
    });

    const analytics = await generateAnalyticalProcedures(
      engagementId,
      fsHeadKey,
      fsHeadName || fsHeadKey,
      workingPaper?.currentYearBalance,
      workingPaper?.priorYearBalance
    );

    if (saveToDb) {
      if (!workingPaper) {
        workingPaper = await db.fSHeadWorkingPaper.create({
          data: {
            engagementId,
            fsHeadKey,
            fsHeadName: fsHeadName || fsHeadKey,
            status: "DRAFT"
          }
        });
      }
      for (const ana of analytics) {
        await db.fSHeadAnalyticalProcedure.create({
          data: {
            workingPaperId: workingPaper.id,
            procedureRef: ana.procedureRef,
            analyticalType: ana.analyticalType,
            description: ana.description,
            thresholdPercentage: ana.thresholdPercentage,
            currentYearValue: workingPaper.currentYearBalance,
            priorYearValue: workingPaper.priorYearBalance,
            varianceAmount: workingPaper.movement,
            variancePercentage: workingPaper.priorYearBalance
              ? ((workingPaper.movement || 0) / workingPaper.priorYearBalance) * 100
              : null,
            isAISuggested: true
          }
        });
      }
    }

    res.json({
      success: true,
      analytics,
      message: `Generated ${analytics.length} analytical procedures for ${fsHeadName || fsHeadKey}`
    });
  } catch (error) {
    console.error("Generate analytics error:", error);
    res.status(500).json({ error: "Failed to generate analytical procedures" });
  }
});

router.post("/generate-risks/:engagementId/:fsHeadKey", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId, fsHeadKey } = req.params;
    const { fsHeadName } = req.body;

    const engagement = await db.engagement.findFirst({
      where: {
        id: engagementId,
        firmId: req.user!.firmId,
      },
    });

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    const risks = await generateRiskAreas(engagementId, fsHeadKey, fsHeadName || fsHeadKey);

    res.json({
      success: true,
      risks,
      message: `Generated ${risks.length} risk areas for ${fsHeadName || fsHeadKey}`
    });
  } catch (error) {
    console.error("Generate risks error:", error);
    res.status(500).json({ error: "Failed to generate risk areas" });
  }
});

router.post("/generate-workspace/:engagementId/:fsHeadKey", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId, fsHeadKey } = req.params;
    const { fsHeadName } = req.body;

    const engagement = await db.engagement.findFirst({
      where: {
        id: engagementId,
        firmId: req.user!.firmId,
      },
    });

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    const workspace = await generateWorkspaceContent(engagementId, fsHeadKey, fsHeadName || fsHeadKey);

    res.json({
      success: true,
      ...workspace,
      message: "Generated complete workspace content"
    });
  } catch (error) {
    console.error("Generate workspace error:", error);
    res.status(500).json({ error: "Failed to generate workspace content" });
  }
});

router.post("/generate-conclusion/:engagementId/:fsHeadKey", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId, fsHeadKey } = req.params;
    const { fsHeadName, saveToDb } = req.body;

    const engagement = await db.engagement.findFirst({
      where: {
        id: engagementId,
        firmId: req.user!.firmId,
      },
    });

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    const conclusion = await generateConclusionDraft(engagementId, fsHeadKey, fsHeadName || fsHeadKey);

    if (saveToDb) {
      await db.fSHeadWorkingPaper.updateMany({
        where: { engagementId, fsHeadKey },
        data: { conclusion }
      });
    }

    res.json({
      success: true,
      conclusion,
      message: "Generated conclusion draft"
    });
  } catch (error) {
    console.error("Generate conclusion error:", error);
    res.status(500).json({ error: "Failed to generate conclusion" });
  }
});

router.get("/audit-approach/:engagementId/:fsHeadKey", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId, fsHeadKey } = req.params;

    const engagement = await db.engagement.findFirst({
      where: {
        id: engagementId,
        firmId: req.user!.firmId,
      },
    });

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    const workingPaper = await db.fSHeadWorkingPaper.findFirst({
      where: { engagementId, fsHeadKey }
    });

    const approach = await determineAuditApproach(engagementId, fsHeadKey, workingPaper?.riskLevel);

    res.json({
      success: true,
      approach
    });
  } catch (error) {
    console.error("Get audit approach error:", error);
    res.status(500).json({ error: "Failed to determine audit approach" });
  }
});

// Get FS Head procedure template
router.get("/template/:fsHeadName", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { fsHeadName } = req.params;
    const template = getFSHeadTemplate(decodeURIComponent(fsHeadName));
    
    if (!template) {
      return res.status(404).json({ error: "Template not found for this FS Head type" });
    }

    res.json({
      success: true,
      template,
      detectedType: detectFSHeadType(decodeURIComponent(fsHeadName))
    });
  } catch (error) {
    console.error("Get template error:", error);
    res.status(500).json({ error: "Failed to get procedure template" });
  }
});

// Get all available templates
router.get("/templates", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    res.json({
      success: true,
      templates: FS_HEAD_TEMPLATES
    });
  } catch (error) {
    console.error("Get templates error:", error);
    res.status(500).json({ error: "Failed to get templates" });
  }
});

// Calculate sample size
router.post("/sample-size", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { population, riskLevel, materialityThreshold } = req.body;
    
    const sampleSize = calculateSampleSize(
      population || 100,
      riskLevel || 'MODERATE',
      materialityThreshold || 0
    );

    res.json({
      success: true,
      sampleSize,
      population,
      riskLevel
    });
  } catch (error) {
    console.error("Calculate sample size error:", error);
    res.status(500).json({ error: "Failed to calculate sample size" });
  }
});

// Validate FS Head completion
router.post("/validate-completion/:engagementId/:fsHeadKey", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId, fsHeadKey } = req.params;
    const { fsHeadName } = req.body;

    const engagement = await db.engagement.findFirst({
      where: {
        id: engagementId,
        firmId: req.user!.firmId,
      },
    });

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    const workingPaper = await db.fSHeadWorkingPaper.findFirst({
      where: { engagementId, fsHeadKey },
      include: {
        testOfControls: true,
        testOfDetails: true,
        analyticalProcedures: true
      }
    });

    const headType = detectFSHeadType(fsHeadName || fsHeadKey);
    const completedProcedures: { type: string; ref: string }[] = [];

    if (workingPaper) {
      ((workingPaper as any).testOfControls || []).forEach((toc: any) => {
        if (toc.result && toc.result !== 'NOT_TESTED') {
          completedProcedures.push({ type: 'TOC', ref: toc.tocRef });
        }
      });

      ((workingPaper as any).testOfDetails || []).forEach((tod: any) => {
        if (tod.result && tod.result !== 'NOT_TESTED') {
          completedProcedures.push({ type: 'TOD', ref: tod.todRef });
        }
      });

      // Collect completed Analytics
      (workingPaper.analyticalProcedures || []).forEach((ana: any) => {
        if (ana.conclusion) {
          completedProcedures.push({ type: 'ANALYTICS', ref: ana.procedureRef });
        }
      });
    }

    const hasConclusion = workingPaper?.conclusion && workingPaper.conclusion.length > 0;
    const validation = validateFSHeadCompletion(headType, completedProcedures, hasConclusion);
    const template = FS_HEAD_TEMPLATES[headType];

    res.json({
      success: true,
      ...validation,
      headType,
      template: template ? {
        displayName: template.displayName,
        riskLevel: template.riskLevel,
        riskLocked: template.riskLocked,
        fraudRiskPresumed: template.fraudRiskPresumed,
        isa540Triggered: template.isa540Triggered,
        specialEnforcement: template.specialEnforcement
      } : null,
      completedCount: completedProcedures.length,
      totalMandatory: template ? template.procedures.filter(p => p.mandatory).length : 0
    });
  } catch (error) {
    console.error("Validate completion error:", error);
    res.status(500).json({ error: "Failed to validate completion" });
  }
});

export default router;
