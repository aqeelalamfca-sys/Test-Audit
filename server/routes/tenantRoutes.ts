import { Router, type Response } from "express";
import { prisma } from "../db";
import { requireAuth, hashPassword, type AuthenticatedRequest } from "../auth";
import { requireFirmAdmin, requirePlatformOrFirmAdmin } from "../middleware/rbacGuard";
import { enforceFirmScope } from "../middleware/tenantIsolation";
import { logPlatformAction, extractRequestMeta } from "../services/platformAuditService";
import { encryptString, decryptString } from "../services/encryptionService";
import { z } from "zod";

const router = Router();

router.use(requireAuth);
router.use(enforceFirmScope);

// ========== USER MANAGEMENT (FirmAdmin only) ==========

router.get("/users", requirePlatformOrFirmAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(403).json({ error: "No firm context" });

    const { status, search, role } = req.query;
    const where: any = { firmId };
    if (status) where.status = status;
    if (role) where.role = role;
    if (search) {
      where.OR = [
        { fullName: { contains: search as string, mode: "insensitive" } },
        { email: { contains: search as string, mode: "insensitive" } },
        { username: { contains: search as string, mode: "insensitive" } },
      ];
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        username: true,
        fullName: true,
        role: true,
        status: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(users);
  } catch (error) {
    console.error("List users error:", error);
    res.status(500).json({ error: "Failed to list users" });
  }
});

const createUserSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3),
  fullName: z.string().min(2),
  password: z.string().min(8),
  role: z.enum(["STAFF", "SENIOR", "MANAGER", "PARTNER", "EQCR"]),
});

router.post("/users", requirePlatformOrFirmAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = createUserSchema.parse(req.body);
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(403).json({ error: "No firm context" });

    if (req.user!.role === "FIRM_ADMIN" && (data.role === "ADMIN" || data.role === "FIRM_ADMIN")) {
      return res.status(403).json({ error: "Firm Admin cannot create Admin or Firm Admin users" });
    }

    const { ip, userAgent } = extractRequestMeta(req);

    const existing = await prisma.user.findFirst({
      where: { OR: [{ email: data.email }, { username: data.username }] },
    });
    if (existing) {
      return res.status(400).json({
        error: existing.email === data.email ? "Email already registered" : "Username already taken",
      });
    }

    const subscription = await prisma.subscription.findFirst({
      where: { firmId },
      orderBy: { createdAt: "desc" },
      include: { plan: true },
    });
    if (subscription?.plan) {
      const userCount = await prisma.user.count({ where: { firmId, status: "ACTIVE" } });
      if (userCount >= subscription.plan.maxUsers) {
        return res.status(403).json({ error: `User limit reached (${subscription.plan.maxUsers}). Upgrade your plan.` });
      }
    }

    const passwordHash = await hashPassword(data.password);
    const user = await prisma.user.create({
      data: {
        email: data.email,
        username: data.username,
        fullName: data.fullName,
        passwordHash,
        role: data.role,
        firmId,
        status: "ACTIVE",
      },
    });

    await logPlatformAction(req.user!.id, "USER_CREATED", "user", user.id, firmId, ip, userAgent, {
      email: data.email,
      role: data.role,
    });

    const { passwordHash: _, ...safeUser } = user;
    res.status(201).json(safeUser);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request", details: error.errors });
    }
    console.error("Create user error:", error);
    res.status(500).json({ error: "Failed to create user" });
  }
});

router.patch("/users/:id", requirePlatformOrFirmAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(403).json({ error: "No firm context" });

    const targetUser = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!targetUser || targetUser.firmId !== firmId) {
      return res.status(404).json({ error: "User not found" });
    }

    if (targetUser.role === "SUPER_ADMIN") {
      return res.status(403).json({ error: "Cannot modify Super Admin" });
    }

    const updateSchema = z.object({
      fullName: z.string().min(2).optional(),
      email: z.string().email().optional(),
      role: z.enum(["STAFF", "SENIOR", "MANAGER", "PARTNER", "EQCR"]).optional(),
    });
    const data = updateSchema.parse(req.body);

    if (req.user!.role === "FIRM_ADMIN" && data.role && (data.role === "ADMIN" || data.role === "FIRM_ADMIN")) {
      return res.status(403).json({ error: "Firm Admin cannot assign Admin or Firm Admin roles" });
    }

    const { ip, userAgent } = extractRequestMeta(req);

    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data,
    });

    await logPlatformAction(req.user!.id, "USER_UPDATED", "user", updated.id, firmId, ip, userAgent, data);
    const { passwordHash: _, ...safeUser } = updated;
    res.json(safeUser);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request", details: error.errors });
    }
    console.error("Update user error:", error);
    res.status(500).json({ error: "Failed to update user" });
  }
});

router.post("/users/:id/suspend", requirePlatformOrFirmAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(403).json({ error: "No firm context" });

    const targetUser = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!targetUser || targetUser.firmId !== firmId) {
      return res.status(404).json({ error: "User not found" });
    }
    if (targetUser.role === "SUPER_ADMIN" || targetUser.role === "FIRM_ADMIN") {
      return res.status(403).json({ error: "Cannot suspend this user" });
    }

    const { ip, userAgent } = extractRequestMeta(req);
    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: { status: "SUSPENDED", isActive: false },
    });

    await logPlatformAction(req.user!.id, "USER_SUSPENDED", "user", updated.id, firmId, ip, userAgent);
    res.json({ success: true });
  } catch (error) {
    console.error("Suspend user error:", error);
    res.status(500).json({ error: "Failed to suspend user" });
  }
});

router.post("/users/:id/activate", requirePlatformOrFirmAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(403).json({ error: "No firm context" });

    const targetUser = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!targetUser || targetUser.firmId !== firmId) {
      return res.status(404).json({ error: "User not found" });
    }

    const { ip, userAgent } = extractRequestMeta(req);
    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: { status: "ACTIVE", isActive: true },
    });

    await logPlatformAction(req.user!.id, "USER_ACTIVATED", "user", updated.id, firmId, ip, userAgent);
    res.json({ success: true });
  } catch (error) {
    console.error("Activate user error:", error);
    res.status(500).json({ error: "Failed to activate user" });
  }
});

// ========== FIRM SETTINGS ==========

router.get("/settings", requirePlatformOrFirmAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(403).json({ error: "No firm context" });

    const settings = await prisma.firmSettings.findUnique({ where: { firmId } });
    if (settings && settings.aiApiKeyEncrypted) {
      return res.json({ ...settings, aiApiKeyEncrypted: "***encrypted***" });
    }
    res.json(settings);
  } catch (error) {
    console.error("Get settings error:", error);
    res.status(500).json({ error: "Failed to get settings" });
  }
});

router.patch("/settings", requirePlatformOrFirmAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(403).json({ error: "No firm context" });

    const { ip, userAgent } = extractRequestMeta(req);
    const allowedFields = [
      "aiEnabled", "aiRequiresHumanApproval", "aiOutputLabel",
      "enforceRBAC", "requireDigitalSignatures", "requirePartnerPIN",
    ];

    const data: any = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) data[field] = req.body[field];
    }

    const settings = await prisma.firmSettings.upsert({
      where: { firmId },
      update: { ...data, updatedById: req.user!.id },
      create: { firmId, ...data, createdById: req.user!.id },
    });

    await logPlatformAction(req.user!.id, "SETTINGS_UPDATED", "firm_settings", settings.id, firmId, ip, userAgent, data);
    res.json(settings);
  } catch (error) {
    console.error("Update settings error:", error);
    res.status(500).json({ error: "Failed to update settings" });
  }
});

router.post("/settings/ai-key", requirePlatformOrFirmAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(403).json({ error: "No firm context" });

    const schema = z.object({
      apiKey: z.string().min(10),
      provider: z.string().optional(),
    });
    const data = schema.parse(req.body);
    const { ip, userAgent } = extractRequestMeta(req);

    const encrypted = encryptString(data.apiKey);

    const settings = await prisma.firmSettings.upsert({
      where: { firmId },
      update: {
        aiOverrideEnabled: true,
        aiApiKeyEncrypted: encrypted,
        aiProviderOverride: data.provider || "openai",
        updatedById: req.user!.id,
      },
      create: {
        firmId,
        aiOverrideEnabled: true,
        aiApiKeyEncrypted: encrypted,
        aiProviderOverride: data.provider || "openai",
        createdById: req.user!.id,
      },
    });

    await logPlatformAction(req.user!.id, "AI_KEY_SET", "firm_settings", settings.id, firmId, ip, userAgent, {
      provider: data.provider || "openai",
    });

    res.json({ success: true, provider: data.provider || "openai" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request", details: error.errors });
    }
    console.error("Set AI key error:", error);
    res.status(500).json({ error: "Failed to set AI key" });
  }
});

// ========== AUDIT LOGS (Firm-scoped) ==========

router.get("/audit-logs", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(403).json({ error: "No firm context" });

    const { action, entity, userId, page = "1", limit = "50", startDate, endDate } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const where: any = { firmId };
    if (action) where.action = { contains: action as string, mode: "insensitive" };
    if (entity) where.entity = entity;
    if (userId) where.userId = userId;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate as string);
      if (endDate) {
        const end = new Date(endDate as string);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    const [logs, total] = await Promise.all([
      prisma.platformAuditLog.findMany({ where, skip, take, orderBy: { createdAt: "desc" } }),
      prisma.platformAuditLog.count({ where }),
    ]);

    const userIds = [...new Set(logs.map((l: any) => l.userId).filter(Boolean))];
    const users = userIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, fullName: true, email: true, role: true },
        })
      : [];
    const userMap = Object.fromEntries(users.map(u => [u.id, u]));

    const enriched = logs.map((log: any) => ({
      ...log,
      userName: userMap[log.userId]?.fullName || null,
      userEmail: userMap[log.userId]?.email || null,
      userRole: userMap[log.userId]?.role || null,
    }));

    res.json({ logs: enriched, total, page: parseInt(page as string), limit: take });
  } catch (error) {
    console.error("Firm audit logs error:", error);
    res.status(500).json({ error: "Failed to get audit logs" });
  }
});

router.get("/audit-logs/users", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(403).json({ error: "No firm context" });

    const users = await prisma.user.findMany({
      where: { firmId },
      select: { id: true, fullName: true, email: true, role: true },
      orderBy: { fullName: "asc" },
    });
    res.json(users);
  } catch (error) {
    console.error("Firm audit log users error:", error);
    res.status(500).json({ error: "Failed to get users" });
  }
});

// ========== AI USAGE (Firm-scoped) ==========

router.get("/ai-usage", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(403).json({ error: "No firm context" });

    const { page = "1", limit = "50" } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const [records, total, totalTokensIn, totalTokensOut] = await Promise.all([
      prisma.aIUsageRecord.findMany({
        where: { firmId },
        skip,
        take,
        orderBy: { createdAt: "desc" },
      }),
      prisma.aIUsageRecord.count({ where: { firmId } }),
      prisma.aIUsageRecord.aggregate({ where: { firmId }, _sum: { tokensIn: true } }),
      prisma.aIUsageRecord.aggregate({ where: { firmId }, _sum: { tokensOut: true } }),
    ]);

    res.json({
      records,
      total,
      page: parseInt(page as string),
      limit: take,
      summary: {
        totalTokensIn: totalTokensIn._sum.tokensIn || 0,
        totalTokensOut: totalTokensOut._sum.tokensOut || 0,
      },
    });
  } catch (error) {
    console.error("Firm AI usage error:", error);
    res.status(500).json({ error: "Failed to get AI usage" });
  }
});

// ========== SUBSCRIPTION (Firm-scoped, read-only) ==========

router.get("/subscription", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(403).json({ error: "No firm context" });

    const subscription = await prisma.subscription.findFirst({
      where: { firmId },
      orderBy: { createdAt: "desc" },
      include: { plan: true },
    });

    const firm = await prisma.firm.findUnique({
      where: { id: firmId },
      select: { status: true, name: true },
    });

    res.json({ subscription, firmStatus: firm?.status });
  } catch (error) {
    console.error("Get subscription error:", error);
    res.status(500).json({ error: "Failed to get subscription" });
  }
});

router.post("/activate", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(403).json({ error: "No firm context" });

    if (req.user!.role !== "FIRM_ADMIN") {
      return res.status(403).json({ error: "Only firm administrators can activate subscriptions" });
    }

    const firm = await prisma.firm.findUnique({ where: { id: firmId } });
    if (!firm) return res.status(404).json({ error: "Firm not found" });

    const subscription = await prisma.subscription.findFirst({
      where: { firmId },
      orderBy: { createdAt: "desc" },
      include: { plan: true },
    });

    if (!subscription) {
      return res.status(404).json({ error: "No subscription found" });
    }

    if (subscription.isActivated && subscription.status === "ACTIVE") {
      return res.status(400).json({ error: "Subscription is already active" });
    }

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    await prisma.$transaction(async (tx) => {
      await tx.subscription.update({
        where: { id: subscription.id },
        data: {
          status: "ACTIVE",
          isActivated: true,
          dormantAt: null,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          nextInvoiceAt: periodEnd,
        },
      });

      await tx.firm.update({
        where: { id: firmId },
        data: { status: "ACTIVE" },
      });
    });

    const { logBillingAction } = await import("../services/billingAuditService");
    await logBillingAction({
      actorUserId: req.user!.id,
      firmId,
      subscriptionId: subscription.id,
      action: "SUBSCRIPTION_ACTIVATED",
      beforeState: {
        firmStatus: firm.status,
        subscriptionStatus: subscription.status,
        isActivated: subscription.isActivated,
        dormantAt: subscription.dormantAt,
      },
      afterState: {
        firmStatus: "ACTIVE",
        subscriptionStatus: "ACTIVE",
        isActivated: true,
      },
    });

    res.json({
      success: true,
      message: "Subscription activated successfully. Full access has been restored.",
      subscription: {
        status: "ACTIVE",
        isActivated: true,
        plan: subscription.plan,
      },
    });
  } catch (error) {
    console.error("Activate subscription error:", error);
    res.status(500).json({ error: "Failed to activate subscription" });
  }
});

export default router;
