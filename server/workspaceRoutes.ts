import { Router, Response } from "express";
import { prisma, withRetry } from "./db";
import { requireAuth, type AuthenticatedRequest } from "./auth";

const router = Router();

const PRIVILEGED_ROLES = ["ADMIN", "PARTNER", "MANAGING_PARTNER", "MANAGER", "EQCR"];

router.get("/engagements", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const userRole = req.user!.role?.toUpperCase() || "";
    const firmId = req.user!.firmId;
    
    if (!firmId) {
      return res.status(400).json({ error: "User not associated with a firm" });
    }
    
    const isPrivileged = PRIVILEGED_ROLES.includes(userRole);

    const engagements = await prisma.engagement.findMany({
      where: {
        firmId,
        ...(isPrivileged ? {} : { team: { some: { userId } } }),
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            tradingName: true,
          },
        },
        phases: true,
        team: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                role: true,
              },
            },
          },
        },
      },
      orderBy: { lastActivityAt: "desc" },
    });

    const formatted = engagements.map((e: any) => ({
      engagementId: e.id,
      engagementCode: e.engagementCode,
      engagementType: e.engagementType,
      periodStart: e.periodStart,
      periodEnd: e.periodEnd,
      fiscalYearEnd: e.fiscalYearEnd,
      currentPhase: e.currentPhase,
      status: e.status,
      clientId: e.clientId,
      clientName: e.client?.name || "Unknown",
      clientTradingName: e.client?.tradingName,
      phases: e.phases,
      team: e.team,
    }));

    res.json(formatted);
  } catch (error) {
    console.error("Error fetching workspace engagements:", error);
    res.status(500).json({ error: "Failed to fetch engagements" });
  }
});

router.get("/clients/:clientId/engagements", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { clientId } = req.params;
    const userId = req.user!.id;
    const userRole = req.user!.role?.toUpperCase() || "";
    const firmId = req.user!.firmId;
    
    if (!firmId) {
      return res.status(400).json({ error: "User not associated with a firm" });
    }
    
    const isPrivileged = PRIVILEGED_ROLES.includes(userRole);

    const engagements = await prisma.engagement.findMany({
      where: {
        firmId,
        clientId,
        ...(isPrivileged ? {} : { team: { some: { userId } } }),
      },
      include: {
        phases: true,
        team: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                role: true,
              },
            },
          },
        },
      },
      orderBy: { fiscalYearEnd: "desc" },
    });

    const formatted = engagements.map((e) => ({
      engagementId: e.id,
      engagementCode: e.engagementCode,
      periodStart: e.periodStart,
      periodEnd: e.periodEnd,
      fiscalYearEnd: e.fiscalYearEnd,
      currentPhase: e.currentPhase,
      status: e.status,
    }));

    res.json(formatted);
  } catch (error) {
    console.error("Error fetching client engagements:", error);
    res.status(500).json({ error: "Failed to fetch engagements" });
  }
});

router.get("/engagements/:engagementId/meta", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const userId = req.user!.id;
    const userRole = req.user!.role?.toUpperCase() || "";
    const firmId = req.user!.firmId;
    
    if (!firmId) {
      return res.status(400).json({ error: "User not associated with a firm" });
    }
    
    const isPrivileged = PRIVILEGED_ROLES.includes(userRole);

    const engagement = await prisma.engagement.findFirst({
      where: {
        id: engagementId,
        firmId,
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            tradingName: true,
          },
        },
        phases: true,
        team: {
          select: {
            userId: true,
            role: true,
          },
        },
      },
    }) as any;

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    const isAllocated = engagement.team.some((t: any) => t.userId === userId);
    if (!isPrivileged && !isAllocated) {
      return res.status(403).json({ error: "You don't have access to this engagement" });
    }

    res.json({
      engagementId: engagement.id,
      engagementCode: engagement.engagementCode,
      engagementType: engagement.engagementType,
      periodStart: engagement.periodStart,
      periodEnd: engagement.periodEnd,
      fiscalYearEnd: engagement.fiscalYearEnd,
      currentPhase: engagement.currentPhase,
      status: engagement.status,
      clientId: engagement.clientId,
      clientName: engagement.client?.name || "Unknown",
      phases: engagement.phases,
      isAllocated,
    });
  } catch (error) {
    console.error("Error fetching engagement meta:", error);
    res.status(500).json({ error: "Failed to fetch engagement" });
  }
});

router.get("/engagements/:engagementId/access", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const startTime = Date.now();
  const AUTH_DEBUG = process.env.AUTH_DEBUG === "true";
  const DB_TIMEOUT = 3000; // 3 second max for DB

  const respond = (status: number, data: any) => {
    const duration = Date.now() - startTime;
    if (AUTH_DEBUG) {
      console.log(`[ACCESS_CHECK] ${req.params.engagementId} responded in ${duration}ms:`, data.reason);
    }
    return res.status(status).json({ ...data, responseTime: duration });
  };

  try {
    const { engagementId } = req.params;
    const userId = req.user!.id;
    const userRole = req.user!.role?.toUpperCase() || "";
    const firmId = req.user!.firmId;
    
    if (!firmId) {
      return respond(400, { hasAccess: false, reason: "no_firm" });
    }
    
    const isPrivileged = PRIVILEGED_ROLES.includes(userRole);

    // DB lookup with circuit breaker timeout
    const dbPromise = prisma.engagement.findFirst({
      where: {
        id: engagementId,
        firmId,
      },
      include: {
        team: {
          select: {
            userId: true,
            role: true,
          },
        },
      },
    });

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("DB_TIMEOUT")), DB_TIMEOUT);
    });

    let engagement: any;
    try {
      engagement = await Promise.race([dbPromise, timeoutPromise]);
    } catch (dbError: any) {
      if (dbError.message === "DB_TIMEOUT") {
        return respond(503, { hasAccess: false, reason: "DB_TIMEOUT", message: "Database temporarily slow" });
      }
      throw dbError;
    }

    if (!engagement) {
      return respond(404, { hasAccess: false, reason: "not_found" });
    }

    const isAllocated = engagement.team.some((t: any) => t.userId === userId);
    const hasAccess = isPrivileged || isAllocated;

    respond(200, {
      hasAccess,
      reason: hasAccess ? "granted" : "not_allocated",
      isPrivileged,
      isAllocated,
    });
  } catch (error: any) {
    console.error("Error checking engagement access:", error);
    respond(500, { hasAccess: false, reason: "error", message: error.message });
  }
});

// ========================================================
// UNIVERSAL SAVE ENDPOINTS FOR ALL WORKSPACE MODULES
// ========================================================

// Standard response envelope
interface SaveResponse {
  success: boolean;
  data?: any;
  message?: string;
  errors?: Record<string, string>;
  requestId?: string;
}

// Valid page keys for workspace modules
const VALID_PAGE_KEYS = [
  "requisition", "pre-planning", "planning", "execution",
  "controls", "substantive", "analytical", "evidence",
  "finalization", "deliverables", "eqcr", "inspection",
  "trial-balance", "materiality", "risk-assessment", "audit-strategy"
];

// PUT /api/workspace/:engagementId/:pageKey - Save final
router.put("/:engagementId/:pageKey", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { engagementId, pageKey } = req.params;
  const userId = req.user!.id;
  const firmId = req.user!.firmId;
  
  try {
    if (!firmId) {
      return res.status(400).json({ 
        success: false, 
        message: "User not associated with a firm" 
      } as SaveResponse);
    }

    // Verify engagement exists and user has access
    const engagement = await prisma.engagement.findFirst({
      where: { id: engagementId, firmId },
      include: { team: { select: { userId: true } } }
    });

    if (!engagement) {
      return res.status(404).json({ 
        success: false, 
        message: "Engagement not found" 
      } as SaveResponse);
    }

    const userRole = req.user!.role?.toUpperCase() || "";
    const isPrivileged = PRIVILEGED_ROLES.includes(userRole);
    const isAllocated = (engagement.team as any[]).some(t => t.userId === userId);

    if (!isPrivileged && !isAllocated) {
      return res.status(403).json({ 
        success: false, 
        message: "You don't have access to this engagement" 
      } as SaveResponse);
    }

    const { isDraft, entityType, ...moduleData } = req.body;

    const savedData = await withRetry(() => prisma.workspaceModuleData.upsert({
      where: {
        engagementId_pageKey: { engagementId, pageKey }
      },
      create: {
        engagementId,
        pageKey,
        data: moduleData,
        isDraft: false,
        createdById: userId,
        updatedById: userId,
      },
      update: {
        data: moduleData,
        isDraft: false,
        updatedById: userId,
        updatedAt: new Date(),
      }
    }));

    await withRetry(() => prisma.engagement.update({
      where: { id: engagementId },
      data: { lastActivityAt: new Date() }
    }));

    res.json({
      success: true,
      data: savedData,
      message: "Changes saved successfully",
      requestId: `save-${Date.now()}`
    } as SaveResponse);

  } catch (error) {
    console.error(`Error saving ${pageKey} for engagement ${engagementId}:`, error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to save changes",
      errors: { server: "Internal server error" }
    } as SaveResponse);
  }
});

// POST /api/workspace/:engagementId/:pageKey/draft - Save draft (partial allowed)
router.post("/:engagementId/:pageKey/draft", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { engagementId, pageKey } = req.params;
  const userId = req.user!.id;
  const firmId = req.user!.firmId;
  
  try {
    if (!firmId) {
      return res.status(400).json({ 
        success: false, 
        message: "User not associated with a firm" 
      } as SaveResponse);
    }

    // Verify engagement exists and user has access
    const engagement = await prisma.engagement.findFirst({
      where: { id: engagementId, firmId },
      include: { team: { select: { userId: true } } }
    });

    if (!engagement) {
      return res.status(404).json({ 
        success: false, 
        message: "Engagement not found" 
      } as SaveResponse);
    }

    const userRole = req.user!.role?.toUpperCase() || "";
    const isPrivileged = PRIVILEGED_ROLES.includes(userRole);
    const isAllocated = (engagement.team as any[]).some(t => t.userId === userId);

    if (!isPrivileged && !isAllocated) {
      return res.status(403).json({ 
        success: false, 
        message: "You don't have access to this engagement" 
      } as SaveResponse);
    }

    const { isDraft, entityType, ...moduleData } = req.body;

    const savedData = await withRetry(() => prisma.workspaceModuleData.upsert({
      where: {
        engagementId_pageKey: { engagementId, pageKey }
      },
      create: {
        engagementId,
        pageKey,
        data: moduleData,
        isDraft: true,
        createdById: userId,
        updatedById: userId,
      },
      update: {
        data: moduleData,
        isDraft: true,
        updatedById: userId,
        updatedAt: new Date(),
      }
    }));

    res.json({
      success: true,
      data: savedData,
      message: "Draft saved",
      requestId: `draft-${Date.now()}`
    } as SaveResponse);

  } catch (error) {
    console.error(`Error saving draft ${pageKey} for engagement ${engagementId}:`, error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to save draft"
    } as SaveResponse);
  }
});

// GET /api/workspace/:engagementId/:pageKey - Get module data
router.get("/:engagementId/:pageKey", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { engagementId, pageKey } = req.params;
  const userId = req.user!.id;
  const firmId = req.user!.firmId;
  
  try {
    if (!firmId) {
      return res.status(400).json({ 
        success: false, 
        message: "User not associated with a firm" 
      } as SaveResponse);
    }

    // Verify engagement exists and user has access
    const engagement = await prisma.engagement.findFirst({
      where: { id: engagementId, firmId },
      include: { team: { select: { userId: true } } }
    });

    if (!engagement) {
      return res.status(404).json({ 
        success: false, 
        message: "Engagement not found" 
      } as SaveResponse);
    }

    const userRole = req.user!.role?.toUpperCase() || "";
    const isPrivileged = PRIVILEGED_ROLES.includes(userRole);
    const isAllocated = (engagement.team as any[]).some(t => t.userId === userId);

    if (!isPrivileged && !isAllocated) {
      return res.status(403).json({ 
        success: false, 
        message: "You don't have access to this engagement" 
      } as SaveResponse);
    }

    const moduleData = await prisma.workspaceModuleData.findUnique({
      where: {
        engagementId_pageKey: { engagementId, pageKey }
      }
    });

    res.json({
      success: true,
      data: moduleData?.data || null,
      isDraft: moduleData?.isDraft || false,
      updatedAt: moduleData?.updatedAt || null,
      message: moduleData ? "Data loaded" : "No saved data"
    } as SaveResponse);

  } catch (error) {
    console.error(`Error loading ${pageKey} for engagement ${engagementId}:`, error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to load data"
    } as SaveResponse);
  }
});

router.post("/:engagementId/tb-override-log", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const userId = req.user!.id;
    const userName = req.user!.fullName || req.user!.email;
    const { fieldName, originalValue, newValue, overriddenAt } = req.body;

    console.log(`\n[TB OVERRIDE LOG]`);
    console.log(`  User: ${userName} (${userId})`);
    console.log(`  Engagement: ${engagementId}`);
    console.log(`  Field: ${fieldName}`);
    console.log(`  Original Value: ${originalValue}`);
    console.log(`  New Value: ${newValue}`);
    console.log(`  Timestamp: ${overriddenAt}`);
    console.log(`---`);

    res.json({ success: true, message: "Override logged successfully" });
  } catch (error) {
    console.error("Error logging TB override:", error);
    res.json({ success: true, message: "Override logged to console" });
  }
});

export default router;
