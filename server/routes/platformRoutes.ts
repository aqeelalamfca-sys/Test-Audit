import { Router, type Response } from "express";
import { prisma } from "../db";
import { requireAuth, hashPassword, type AuthenticatedRequest } from "../auth";
import { requireSuperAdmin } from "../middleware/rbacGuard";
import { logPlatformAction, extractRequestMeta } from "../services/platformAuditService";
import { generateMonthlyInvoice, enforceSubscriptionLifecycle } from "../services/billingService";
import { z } from "zod";
import { randomBytes } from "crypto";
import multer from "multer";
import path from "path";
import fs from "fs/promises";

const router = Router();

router.use(requireAuth);
router.use(requireSuperAdmin);

// ========== FIRM MANAGEMENT ==========

router.get("/firms", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status, search, page = "1", limit = "20" } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const where: any = {};
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: "insensitive" } },
        { email: { contains: search as string, mode: "insensitive" } },
      ];
    }

    const [firms, total] = await Promise.all([
      prisma.firm.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: {
          _count: { select: { users: true, engagements: true } },
          subscriptions: {
            take: 1,
            orderBy: { createdAt: "desc" },
            include: { plan: true },
          },
        },
      }),
      prisma.firm.count({ where }),
    ]);

    res.json({ firms, total, page: parseInt(page as string), limit: take });
  } catch (error) {
    console.error("List firms error:", error);
    res.status(500).json({ error: "Failed to list firms" });
  }
});

const logoStorage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    const dir = path.join(process.cwd(), "uploads", "logos");
    await fs.mkdir(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `firm-${Date.now()}-${randomBytes(4).toString("hex")}${ext}`);
  },
});
const logoUpload = multer({
  storage: logoStorage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [".png", ".jpg", ".jpeg", ".webp"];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
});

router.post("/firms/:id/logo", logoUpload.single("logo"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    if (!req.file) return res.status(400).json({ error: "No logo file provided" });

    const logoUrl = `/uploads/logos/${req.file.filename}`;
    await prisma.firm.update({ where: { id }, data: { logoUrl } });

    const { ip, userAgent } = extractRequestMeta(req);
    await logPlatformAction(req.user!.id, "FIRM_LOGO_UPLOAD", "Firm", id, undefined, ip, userAgent, { logoUrl });

    res.json({ logoUrl });
  } catch (error) {
    console.error("Logo upload error:", error);
    res.status(500).json({ error: "Failed to upload logo" });
  }
});

const createFirmSchema = z.object({
  name: z.string().min(2),
  email: z.string().email().optional(),
  country: z.string().optional(),
  currency: z.string().optional(),
  timezone: z.string().optional(),
  registrationNumber: z.string().optional(),
  headOfficeAddress: z.string().optional(),
  ntn: z.string().optional(),
  branches: z.array(z.object({
    name: z.string(),
    address: z.string(),
  })).optional(),
  planCode: z.string().optional(),
  trialDays: z.number().optional(),
  adminEmail: z.string().email(),
  adminFullName: z.string().min(2),
});

router.post("/firms", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = createFirmSchema.parse(req.body);
    const { ip, userAgent } = extractRequestMeta(req);

    const firm = await prisma.firm.create({
      data: {
        name: data.name,
        email: data.email,
        country: data.country,
        currency: data.currency,
        timezone: data.timezone,
        registrationNumber: data.registrationNumber,
        headOfficeAddress: data.headOfficeAddress,
        taxId: data.ntn,
        offices: data.branches ? data.branches : undefined,
        status: data.trialDays ? "TRIAL" : "ACTIVE",
        createdById: req.user!.id,
      },
    });

    const tempPassword = randomBytes(8).toString("hex");
    const passwordHash = await hashPassword(tempPassword);
    const adminUsername = data.adminEmail.split("@")[0] + "_admin";

    const firmAdmin = await prisma.user.create({
      data: {
        email: data.adminEmail,
        username: adminUsername,
        passwordHash,
        fullName: data.adminFullName,
        role: "FIRM_ADMIN",
        firmId: firm.id,
        status: "ACTIVE",
      },
    });

    let plan = null;
    if (data.planCode) {
      plan = await prisma.plan.findUnique({ where: { code: data.planCode } });
    }
    if (!plan) {
      plan = await prisma.plan.findFirst({ where: { isActive: true }, orderBy: { monthlyPrice: "asc" } });
    }

    let subscription = null;
    if (plan) {
      const now = new Date();
      subscription = await prisma.subscription.create({
        data: {
          firmId: firm.id,
          planId: plan.id,
          status: data.trialDays ? "TRIAL" : "ACTIVE",
          trialStart: data.trialDays ? now : undefined,
          trialEnd: data.trialDays ? new Date(now.getTime() + data.trialDays * 86400000) : undefined,
          currentPeriodStart: now,
          currentPeriodEnd: new Date(now.getTime() + 30 * 86400000),
        },
      });
    }

    await logPlatformAction(
      req.user!.id, "FIRM_CREATED", "firm", firm.id, firm.id, ip, userAgent,
      { firmName: firm.name, adminEmail: data.adminEmail, plan: plan?.code }
    );

    res.status(201).json({
      firm,
      firmAdmin: { ...firmAdmin, passwordHash: undefined, tempPassword },
      subscription,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request", details: error.errors });
    }
    console.error("Create firm error:", error);
    res.status(500).json({ error: "Failed to create firm" });
  }
});

router.get("/firms/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firm = await prisma.firm.findUnique({
      where: { id: req.params.id },
      include: {
        _count: { select: { users: true, engagements: true, clients: true } },
        subscriptions: {
          take: 1,
          orderBy: { createdAt: "desc" },
          include: { plan: true },
        },
        firmSettings: true,
      },
    });

    if (!firm) return res.status(404).json({ error: "Firm not found" });
    res.json(firm);
  } catch (error) {
    console.error("Get firm error:", error);
    res.status(500).json({ error: "Failed to get firm" });
  }
});

router.patch("/firms/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const updateSchema = z.object({
      name: z.string().min(2).optional(),
      email: z.string().email().optional(),
      country: z.string().optional(),
      currency: z.string().optional(),
      timezone: z.string().optional(),
    });

    const data = updateSchema.parse(req.body);
    const { ip, userAgent } = extractRequestMeta(req);

    const firm = await prisma.firm.update({
      where: { id: req.params.id },
      data,
    });

    await logPlatformAction(req.user!.id, "FIRM_UPDATED", "firm", firm.id, firm.id, ip, userAgent, data);
    res.json(firm);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request", details: error.errors });
    }
    console.error("Update firm error:", error);
    res.status(500).json({ error: "Failed to update firm" });
  }
});

router.post("/firms/:id/suspend", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { ip, userAgent } = extractRequestMeta(req);
    const firm = await prisma.firm.update({
      where: { id: req.params.id },
      data: { status: "SUSPENDED", suspendedAt: new Date() },
    });

    await logPlatformAction(req.user!.id, "FIRM_SUSPENDED", "firm", firm.id, firm.id, ip, userAgent);
    res.json(firm);
  } catch (error) {
    console.error("Suspend firm error:", error);
    res.status(500).json({ error: "Failed to suspend firm" });
  }
});

router.post("/firms/:id/activate", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { ip, userAgent } = extractRequestMeta(req);
    const firm = await prisma.firm.update({
      where: { id: req.params.id },
      data: { status: "ACTIVE", suspendedAt: null },
    });

    await logPlatformAction(req.user!.id, "FIRM_ACTIVATED", "firm", firm.id, firm.id, ip, userAgent);
    res.json(firm);
  } catch (error) {
    console.error("Activate firm error:", error);
    res.status(500).json({ error: "Failed to activate firm" });
  }
});

router.post("/firms/:id/terminate", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { ip, userAgent } = extractRequestMeta(req);
    const firm = await prisma.firm.update({
      where: { id: req.params.id },
      data: { status: "TERMINATED", terminatedAt: new Date() },
    });

    await logPlatformAction(req.user!.id, "FIRM_TERMINATED", "firm", firm.id, firm.id, ip, userAgent);
    res.json(firm);
  } catch (error) {
    console.error("Terminate firm error:", error);
    res.status(500).json({ error: "Failed to terminate firm" });
  }
});

router.post("/firms/:id/reset-admin", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { ip, userAgent } = extractRequestMeta(req);
    const firmAdmin = await prisma.user.findFirst({
      where: { firmId: req.params.id, role: "FIRM_ADMIN" },
    });

    if (!firmAdmin) return res.status(404).json({ error: "Firm admin not found" });

    const tempPassword = randomBytes(8).toString("hex");
    const passwordHash = await hashPassword(tempPassword);

    await prisma.user.update({
      where: { id: firmAdmin.id },
      data: { passwordHash, status: "ACTIVE" },
    });

    await logPlatformAction(req.user!.id, "FIRM_ADMIN_RESET", "user", firmAdmin.id, req.params.id, ip, userAgent);
    res.json({ email: firmAdmin.email, tempPassword });
  } catch (error) {
    console.error("Reset admin error:", error);
    res.status(500).json({ error: "Failed to reset admin" });
  }
});

// ========== PLAN MANAGEMENT ==========

router.get("/plans", async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const plans = await prisma.plan.findMany({
      orderBy: { monthlyPrice: "asc" },
      include: { _count: { select: { subscriptions: true } } },
    });
    res.json(plans);
  } catch (error) {
    console.error("List plans error:", error);
    res.status(500).json({ error: "Failed to list plans" });
  }
});

const planSchema = z.object({
  code: z.string().min(2),
  name: z.string().min(2),
  maxUsers: z.number().min(1).optional(),
  maxEngagements: z.number().min(1).optional(),
  maxOffices: z.number().min(1).optional(),
  storageGb: z.number().min(1).optional(),
  allowCustomAi: z.boolean().optional(),
  platformAiIncluded: z.boolean().optional(),
  monthlyPrice: z.number().min(0).optional(),
  userOveragePkr: z.number().min(0).optional(),
  officeOveragePkr: z.number().min(0).optional(),
  engagementPackSize: z.number().min(1).optional(),
  engagementPackPkr: z.number().min(0).optional(),
  featureFlags: z.record(z.any()).optional(),
  isPublic: z.boolean().optional(),
  isActive: z.boolean().optional(),
  supportLevel: z.string().optional(),
});

router.post("/plans", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = planSchema.parse(req.body);
    const { ip, userAgent } = extractRequestMeta(req);

    const plan = await prisma.plan.create({ data: data as any });
    await logPlatformAction(req.user!.id, "PLAN_CREATED", "plan", plan.id, null, ip, userAgent, data);
    res.status(201).json(plan);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request", details: error.errors });
    }
    console.error("Create plan error:", error);
    res.status(500).json({ error: "Failed to create plan" });
  }
});

router.patch("/plans/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = planSchema.partial().parse(req.body);
    const { ip, userAgent } = extractRequestMeta(req);

    const plan = await prisma.plan.update({ where: { id: req.params.id }, data: data as any });
    await logPlatformAction(req.user!.id, "PLAN_UPDATED", "plan", plan.id, null, ip, userAgent, data);
    res.json(plan);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request", details: error.errors });
    }
    console.error("Update plan error:", error);
    res.status(500).json({ error: "Failed to update plan" });
  }
});

// ========== SUBSCRIPTION MANAGEMENT ==========

router.post("/firms/:id/trial", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const schema = z.object({
      trialDays: z.number().min(1).max(365),
      planCode: z.string().optional(),
    });
    const data = schema.parse(req.body);
    const { ip, userAgent } = extractRequestMeta(req);

    let plan = data.planCode
      ? await prisma.plan.findUnique({ where: { code: data.planCode } })
      : await prisma.plan.findFirst({ where: { isActive: true }, orderBy: { monthlyPrice: "asc" } });

    if (!plan) return res.status(400).json({ error: "No plan available" });

    const now = new Date();
    const existingSub = await prisma.subscription.findFirst({
      where: { firmId: req.params.id },
      orderBy: { createdAt: "desc" },
    });

    if (existingSub) {
      const updated = await prisma.subscription.update({
        where: { id: existingSub.id },
        data: {
          status: "TRIAL",
          trialStart: now,
          trialEnd: new Date(now.getTime() + data.trialDays * 86400000),
          planId: plan.id,
        },
      });

      await prisma.firm.update({
        where: { id: req.params.id },
        data: { status: "TRIAL" },
      });

      await logPlatformAction(req.user!.id, "TRIAL_EXTENDED", "subscription", updated.id, req.params.id, ip, userAgent, data);
      return res.json(updated);
    }

    const subscription = await prisma.subscription.create({
      data: {
        firmId: req.params.id,
        planId: plan.id,
        status: "TRIAL",
        trialStart: now,
        trialEnd: new Date(now.getTime() + data.trialDays * 86400000),
        currentPeriodStart: now,
        currentPeriodEnd: new Date(now.getTime() + data.trialDays * 86400000),
      },
    });

    await prisma.firm.update({
      where: { id: req.params.id },
      data: { status: "TRIAL" },
    });

    await logPlatformAction(req.user!.id, "TRIAL_ASSIGNED", "subscription", subscription.id, req.params.id, ip, userAgent, data);
    res.status(201).json(subscription);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request", details: error.errors });
    }
    console.error("Assign trial error:", error);
    res.status(500).json({ error: "Failed to assign trial" });
  }
});

router.patch("/subscriptions/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const schema = z.object({
      status: z.enum(["TRIAL", "ACTIVE", "PAST_DUE", "SUSPENDED", "CANCELED"]).optional(),
      planId: z.string().uuid().optional(),
    });
    const data = schema.parse(req.body);
    const { ip, userAgent } = extractRequestMeta(req);

    const subscription = await prisma.subscription.update({
      where: { id: req.params.id },
      data,
    });

    await logPlatformAction(req.user!.id, "SUBSCRIPTION_UPDATED", "subscription", subscription.id, subscription.firmId, ip, userAgent, data);
    res.json(subscription);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request", details: error.errors });
    }
    console.error("Update subscription error:", error);
    res.status(500).json({ error: "Failed to update subscription" });
  }
});

// ========== NOTIFICATIONS ==========

router.get("/notifications", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { scope, firmId } = req.query;
    const where: any = {};
    if (scope) where.scope = scope;
    if (firmId) where.firmId = firmId;

    const notifications = await prisma.platformNotification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    res.json(notifications);
  } catch (error) {
    console.error("List notifications error:", error);
    res.status(500).json({ error: "Failed to list notifications" });
  }
});

const notificationSchema = z.object({
  title: z.string().min(1),
  message: z.string().min(1),
  scope: z.enum(["GLOBAL", "FIRM", "ENGAGEMENT"]),
  firmId: z.string().uuid().optional(),
  engagementId: z.string().uuid().optional(),
  type: z.enum(["POPUP", "BANNER", "EMAIL"]).optional(),
  priority: z.number().optional(),
  startAt: z.string().optional(),
  endAt: z.string().optional(),
});

router.post("/notifications", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = notificationSchema.parse(req.body);
    const { ip, userAgent } = extractRequestMeta(req);

    const notification = await prisma.platformNotification.create({
      data: {
        ...data,
        startAt: data.startAt ? new Date(data.startAt) : new Date(),
        endAt: data.endAt ? new Date(data.endAt) : undefined,
        createdById: req.user!.id,
      },
    });

    await logPlatformAction(req.user!.id, "NOTIFICATION_CREATED", "notification", notification.id, data.firmId || null, ip, userAgent);
    res.status(201).json(notification);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request", details: error.errors });
    }
    console.error("Create notification error:", error);
    res.status(500).json({ error: "Failed to create notification" });
  }
});

router.delete("/notifications/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { ip, userAgent } = extractRequestMeta(req);
    await prisma.platformNotification.delete({ where: { id: req.params.id } });
    await logPlatformAction(req.user!.id, "NOTIFICATION_DELETED", "notification", req.params.id, null, ip, userAgent);
    res.json({ success: true });
  } catch (error) {
    console.error("Delete notification error:", error);
    res.status(500).json({ error: "Failed to delete notification" });
  }
});

// ========== AUDIT LOGS ==========

router.get("/audit-logs", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { firmId, userId, action, entity, page = "1", limit = "50", startDate, endDate } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const where: any = {};
    if (firmId) where.firmId = firmId;
    if (userId) where.userId = userId;
    if (action) where.action = { contains: action as string, mode: "insensitive" };
    if (entity) where.entity = entity;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate as string);
      if (endDate) where.createdAt.lte = new Date(endDate as string);
    }

    const [logs, total] = await Promise.all([
      prisma.platformAuditLog.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
      }),
      prisma.platformAuditLog.count({ where }),
    ]);

    res.json({ logs, total, page: parseInt(page as string), limit: take });
  } catch (error) {
    console.error("List audit logs error:", error);
    res.status(500).json({ error: "Failed to list audit logs" });
  }
});

// ========== AI CONFIG ==========

router.get("/ai-config", async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const config = await prisma.platformAIConfig.findFirst({ where: { isActive: true } });
    if (config) {
      const masked = { ...config, defaultApiKey: config.defaultApiKey.substring(0, 8) + "..." };
      return res.json(masked);
    }
    res.json(null);
  } catch (error) {
    console.error("Get AI config error:", error);
    res.status(500).json({ error: "Failed to get AI config" });
  }
});

const aiConfigSchema = z.object({
  defaultApiKey: z.string().min(10),
  provider: z.string().optional(),
  modelName: z.string().optional(),
  tokenLimit: z.number().optional(),
  costPerToken: z.number().optional(),
});

router.post("/ai-config", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = aiConfigSchema.parse(req.body);
    const { ip, userAgent } = extractRequestMeta(req);

    await prisma.platformAIConfig.updateMany({ data: { isActive: false } });

    const config = await prisma.platformAIConfig.create({
      data: { ...data, isActive: true } as any,
    });

    await logPlatformAction(req.user!.id, "AI_CONFIG_UPDATED", "ai_config", config.id, null, ip, userAgent);
    res.json({ ...config, defaultApiKey: config.defaultApiKey.substring(0, 8) + "..." });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request", details: error.errors });
    }
    console.error("Update AI config error:", error);
    res.status(500).json({ error: "Failed to update AI config" });
  }
});

// ========== INVOICES & BILLING ==========

router.get("/invoices", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { firmId, status, page = "1", limit = "20" } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const where: any = {};
    if (firmId) where.subscription = { firmId: firmId as string };
    if (status) where.status = status;

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        skip,
        take,
        orderBy: { issuedAt: "desc" },
        include: {
          lines: true,
          subscription: {
            include: {
              firm: { select: { id: true, name: true } },
              plan: { select: { code: true, name: true } },
            },
          },
        },
      }),
      prisma.invoice.count({ where }),
    ]);

    res.json({ invoices, total, page: parseInt(page as string), limit: take });
  } catch (error) {
    console.error("Invoice list error:", error);
    res.status(500).json({ error: "Failed to list invoices" });
  }
});

router.get("/invoices/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id },
      include: {
        lines: true,
        subscription: {
          include: {
            firm: { select: { id: true, name: true, email: true } },
            plan: { select: { code: true, name: true } },
          },
        },
      },
    });

    if (!invoice) return res.status(404).json({ error: "Invoice not found" });
    res.json(invoice);
  } catch (error) {
    console.error("Invoice detail error:", error);
    res.status(500).json({ error: "Failed to get invoice" });
  }
});

router.post("/invoices/generate/:subscriptionId", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const invoice = await generateMonthlyInvoice(req.params.subscriptionId);
    if (!invoice) return res.status(404).json({ error: "Subscription not found" });

    const { ip, userAgent } = extractRequestMeta(req);
    await logPlatformAction(req.user!.id, "GENERATE_INVOICE", "Invoice", invoice.id, undefined, ip, userAgent, {
      invoiceNo: invoice.invoiceNo,
      amount: invoice.amount,
    });

    res.json(invoice);
  } catch (error) {
    console.error("Invoice generation error:", error);
    res.status(500).json({ error: "Failed to generate invoice" });
  }
});

router.post("/invoices/:id/mark-paid", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id } });
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });
    if (invoice.status === "PAID") return res.status(400).json({ error: "Invoice already paid" });

    const updated = await prisma.invoice.update({
      where: { id: req.params.id },
      data: { status: "PAID", paidAt: new Date() },
      include: { lines: true },
    });

    if (invoice.subscriptionId) {
      await prisma.subscription.update({
        where: { id: invoice.subscriptionId },
        data: { status: "ACTIVE" },
      });
    }

    const { ip, userAgent } = extractRequestMeta(req);
    await logPlatformAction(req.user!.id, "MARK_INVOICE_PAID", "Invoice", invoice.id, undefined, ip, userAgent, {
      invoiceNo: invoice.invoiceNo,
      amount: invoice.amount,
    });

    res.json(updated);
  } catch (error) {
    console.error("Mark paid error:", error);
    res.status(500).json({ error: "Failed to mark invoice as paid" });
  }
});

router.post("/invoices/:id/void", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id } });
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });
    if (invoice.status === "PAID") return res.status(400).json({ error: "Cannot void a paid invoice" });

    const updated = await prisma.invoice.update({
      where: { id: req.params.id },
      data: { status: "VOID" },
      include: { lines: true },
    });

    const { ip, userAgent } = extractRequestMeta(req);
    await logPlatformAction(req.user!.id, "VOID_INVOICE", "Invoice", invoice.id, undefined, ip, userAgent, {
      invoiceNo: invoice.invoiceNo,
    });

    res.json(updated);
  } catch (error) {
    console.error("Void invoice error:", error);
    res.status(500).json({ error: "Failed to void invoice" });
  }
});

router.post("/billing/enforce-lifecycle", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await enforceSubscriptionLifecycle();

    const { ip, userAgent } = extractRequestMeta(req);
    await logPlatformAction(req.user!.id, "ENFORCE_LIFECYCLE", "Billing", undefined, undefined, ip, userAgent, result);

    res.json({ message: "Lifecycle enforcement completed", ...result });
  } catch (error) {
    console.error("Lifecycle enforcement error:", error);
    res.status(500).json({ error: "Failed to enforce lifecycle" });
  }
});

// ========== ANALYTICS ==========

router.get("/analytics", async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const [
      totalFirms,
      activeFirms,
      trialFirms,
      suspendedFirms,
      totalUsers,
      totalEngagements,
      aiUsageThisMonth,
    ] = await Promise.all([
      prisma.firm.count(),
      prisma.firm.count({ where: { status: "ACTIVE" } }),
      prisma.firm.count({ where: { status: "TRIAL" } }),
      prisma.firm.count({ where: { status: "SUSPENDED" } }),
      prisma.user.count({ where: { status: "ACTIVE" } }),
      prisma.engagement.count(),
      prisma.aIUsageRecord.count({
        where: {
          createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
        },
      }),
    ]);

    res.json({
      totalFirms,
      activeFirms,
      trialFirms,
      suspendedFirms,
      totalUsers,
      totalEngagements,
      aiUsageThisMonth,
    });
  } catch (error) {
    console.error("Analytics error:", error);
    res.status(500).json({ error: "Failed to get analytics" });
  }
});

// ========== AI USAGE ==========

router.get("/ai-usage", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { firmId, page = "1", limit = "50" } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const where: any = {};
    if (firmId) where.firmId = firmId;

    const [records, total] = await Promise.all([
      prisma.aIUsageRecord.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
      }),
      prisma.aIUsageRecord.count({ where }),
    ]);

    res.json({ records, total, page: parseInt(page as string), limit: take });
  } catch (error) {
    console.error("AI usage error:", error);
    res.status(500).json({ error: "Failed to get AI usage" });
  }
});

export default router;
