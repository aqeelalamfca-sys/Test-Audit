import { Router, Request, Response } from "express";
import { prisma } from "../db";
import {
  validateFSHeadCompletion,
  validateEngagementCompletion,
  checkEQCRRequired,
} from "../services/fsHeadEnforcement";
import {
  canSignOff,
  getPartnerReviewData,
  type SignOffType,
} from "../services/rbacPolicy";
import {
  logAIInteraction,
  getAIDisclaimer,
  type AIInteractionLogParams,
} from "../services/aiGovernance";

const router = Router();

router.get("/fs-head/:id/validate", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ error: "FS Head ID is required" });
    }
    
    const result = await validateFSHeadCompletion(id);
    return res.json(result);
  } catch (error: any) {
    console.error("[Governance] FS Head validate error:", error);
    return res.status(500).json({
      error: "Failed to validate FS Head completion",
      message: error.message,
    });
  }
});

router.get("/engagement/:id/validate", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ error: "Engagement ID is required" });
    }
    
    const result = await validateEngagementCompletion(id);
    return res.json(result);
  } catch (error: any) {
    console.error("[Governance] Engagement validate error:", error);
    return res.status(500).json({
      error: "Failed to validate engagement completion",
      message: error.message,
    });
  }
});

router.get("/engagement/:id/eqcr-required", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ error: "Engagement ID is required" });
    }
    
    const isRequired = await checkEQCRRequired(id);
    return res.json({ engagementId: id, eqcrRequired: isRequired });
  } catch (error: any) {
    console.error("[Governance] EQCR required check error:", error);
    return res.status(500).json({
      error: "Failed to check EQCR requirement",
      message: error.message,
    });
  }
});

router.get("/engagement/:id/partner-review", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ error: "Engagement ID is required" });
    }
    
    const reviewData = await getPartnerReviewData(id);
    return res.json({
      engagementId: reviewData.engagementId,
      engagementName: reviewData.engagementName,
      clientName: reviewData.clientName,
      periodEnd: reviewData.periodEnd,
      overallStatus: reviewData.overallStatus,
      signOffStatus: reviewData.signOffStatus,
      blockers: reviewData.blockers,
      materialityThreshold: reviewData.materialityThreshold,
      totalMisstatements: reviewData.totalMisstatements,
      riskAssessmentComplete: reviewData.riskAssessmentComplete,
      fsHeadCount: reviewData.fsHeads.length,
    });
  } catch (error: any) {
    console.error("[Governance] Partner review data error:", error);
    return res.status(500).json({
      error: "Failed to get partner review data",
      message: error.message,
    });
  }
});

router.post("/fs-head/:id/sign-off", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { userId, signOffType } = req.body as { userId: string; signOffType: SignOffType };
    
    if (!id) {
      return res.status(400).json({ error: "FS Head ID is required" });
    }
    
    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }
    
    if (!signOffType || !["PREPARED", "REVIEWED", "APPROVED"].includes(signOffType)) {
      return res.status(400).json({
        error: "Invalid sign-off type",
        message: "signOffType must be one of: PREPARED, REVIEWED, APPROVED",
      });
    }
    
    const allowed = await canSignOff(userId, id, signOffType);
    
    if (!allowed) {
      return res.status(403).json({
        error: "Sign-off not permitted",
        message: `User does not have permission to perform ${signOffType} sign-off`,
        signOffType,
      });
    }
    
    // Validate enforcement rules before allowing APPROVED sign-off
    if (signOffType === "APPROVED") {
      const validation = await validateFSHeadCompletion(id);
      if (!validation.canComplete) {
        return res.status(400).json({
          error: "Cannot approve - blockers exist",
          message: "FS Head cannot be approved due to outstanding blockers",
          blockers: validation.blockers,
        });
      }
    }
    
    const updateData: Record<string, any> = {};
    const now = new Date();
    
    if (signOffType === "PREPARED") {
      updateData.preparedById = userId;
      updateData.preparedAt = now;
    } else if (signOffType === "REVIEWED") {
      updateData.reviewedById = userId;
      updateData.reviewedAt = now;
    } else if (signOffType === "APPROVED") {
      updateData.approvedById = userId;
      updateData.approvedAt = now;
    }
    
    const updated = await prisma.fSHeadWorkingPaper.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        fsHeadName: true,
        preparedById: true,
        preparedAt: true,
        reviewedById: true,
        reviewedAt: true,
        approvedById: true,
        approvedAt: true,
      },
    });
    
    return res.json({
      success: true,
      signOffType,
      fsHead: updated,
      timestamp: now,
    });
  } catch (error: any) {
    console.error("[Governance] Sign-off error:", error);
    return res.status(500).json({
      error: "Failed to process sign-off",
      message: error.message,
    });
  }
});

router.post("/ai/log-interaction", async (req: Request, res: Response) => {
  try {
    const params = req.body as AIInteractionLogParams;
    
    if (!params.userId) {
      return res.status(400).json({ error: "userId is required" });
    }
    
    if (!params.userRole) {
      return res.status(400).json({ error: "userRole is required" });
    }
    
    if (!params.promptText) {
      return res.status(400).json({ error: "promptText is required" });
    }
    
    if (!params.outputText) {
      return res.status(400).json({ error: "outputText is required" });
    }
    
    if (!params.action) {
      return res.status(400).json({ error: "action is required" });
    }
    
    const ipAddress = req.ip || req.headers["x-forwarded-for"]?.toString() || undefined;
    const userAgent = req.headers["user-agent"] || undefined;
    
    const outputId = await logAIInteraction({
      ...params,
      ipAddress,
      userAgent,
    });
    
    return res.json({
      success: true,
      outputId,
      timestamp: new Date(),
    });
  } catch (error: any) {
    console.error("[Governance] AI log interaction error:", error);
    return res.status(500).json({
      error: "Failed to log AI interaction",
      message: error.message,
    });
  }
});

router.get("/ai/disclaimer", async (_req: Request, res: Response) => {
  try {
    const disclaimer = getAIDisclaimer();
    return res.json({
      disclaimer,
      isAIGenerated: true,
      requiresHumanApproval: true,
    });
  } catch (error: any) {
    console.error("[Governance] AI disclaimer error:", error);
    return res.status(500).json({
      error: "Failed to get AI disclaimer",
      message: error.message,
    });
  }
});

export default router;
