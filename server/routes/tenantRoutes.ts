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

    if (req.user!.role === "FIRM_ADMIN" && (data.role === "FIRM_ADMIN")) {
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

    if (req.user!.role === "FIRM_ADMIN" && data.role && (data.role === "FIRM_ADMIN")) {
      return res.status(403).json({ error: "Firm Admin cannot assign Admin or Firm Admin roles" });
    }

    if (data.email && data.email !== targetUser.email) {
      const emailConflict = await prisma.user.findFirst({
        where: { email: data.email, id: { not: req.params.id } },
      });
      if (emailConflict) {
        return res.status(400).json({ error: "Email already in use by another user" });
      }
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

router.post("/users/:id/set-status", requirePlatformOrFirmAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status } = req.body;
    const validStatuses = ["ACTIVE", "SUSPENDED", "BLOCKED"];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status. Must be ACTIVE, SUSPENDED, or BLOCKED" });
    }

    const firmId = req.user!.firmId;
    if (!firmId) return res.status(403).json({ error: "No firm context" });

    const targetUser = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!targetUser || targetUser.firmId !== firmId) {
      return res.status(404).json({ error: "User not found" });
    }
    if (targetUser.role === "SUPER_ADMIN" || targetUser.role === "FIRM_ADMIN") {
      return res.status(403).json({ error: "Cannot change status of this user" });
    }
    if (req.params.id === req.user!.id) {
      return res.status(400).json({ error: "Cannot change your own status" });
    }

    const isActive = status === "ACTIVE";
    const { ip, userAgent } = extractRequestMeta(req);
    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: { status, isActive },
    });

    if (!isActive) {
      await prisma.session.deleteMany({ where: { userId: req.params.id } });
    }

    await logPlatformAction(req.user!.id, `USER_STATUS_${status}`, "user", updated.id, firmId, ip, userAgent);
    res.json({ success: true, status: updated.status });
  } catch (error) {
    console.error("Set user status error:", error);
    res.status(500).json({ error: "Failed to set user status" });
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

// ========== AI SETTINGS MANAGEMENT ==========

router.get("/ai-settings", requirePlatformOrFirmAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(403).json({ error: "No firm context" });

    const settings = await prisma.aISettings.findUnique({ where: { firmId } });

    if (!settings) {
      return res.json({
        aiEnabled: false,
        preferredProvider: "openai",
        providerPriority: ["openai", "gemini", "deepseek", "anthropic"],
        openaiEnabled: true,
        openaiConfigured: false,
        openaiLastTested: null,
        openaiTestStatus: null,
        geminiEnabled: false,
        geminiConfigured: false,
        geminiLastTested: null,
        geminiTestStatus: null,
        deepseekEnabled: false,
        deepseekConfigured: false,
        deepseekLastTested: null,
        deepseekTestStatus: null,
        anthropicEnabled: false,
        anthropicConfigured: false,
        anthropicLastTested: null,
        anthropicTestStatus: null,
        maxTokensPerResponse: 2000,
        autoSuggestionsEnabled: false,
        manualTriggerOnly: true,
        requestTimeout: 30000,
        platformKeyAvailable: !!(process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY),
      });
    }

    res.json({
      aiEnabled: settings.aiEnabled,
      preferredProvider: settings.preferredProvider,
      providerPriority: settings.providerPriority,
      openaiEnabled: settings.openaiEnabled,
      openaiConfigured: !!settings.openaiApiKey,
      openaiLastTested: settings.openaiLastTested,
      openaiTestStatus: settings.openaiTestStatus,
      geminiEnabled: settings.geminiEnabled,
      geminiConfigured: !!settings.geminiApiKey,
      geminiLastTested: settings.geminiLastTested,
      geminiTestStatus: settings.geminiTestStatus,
      deepseekEnabled: settings.deepseekEnabled,
      deepseekConfigured: !!settings.deepseekApiKey,
      deepseekLastTested: settings.deepseekLastTested,
      deepseekTestStatus: settings.deepseekTestStatus,
      anthropicEnabled: settings.anthropicEnabled,
      anthropicConfigured: !!settings.anthropicApiKey,
      anthropicLastTested: settings.anthropicLastTested,
      anthropicTestStatus: settings.anthropicTestStatus,
      maxTokensPerResponse: settings.maxTokensPerResponse,
      autoSuggestionsEnabled: settings.autoSuggestionsEnabled,
      manualTriggerOnly: settings.manualTriggerOnly,
      requestTimeout: settings.requestTimeout,
      platformKeyAvailable: !!(process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY),
    });
  } catch (error) {
    console.error("Get AI settings error:", error);
    res.status(500).json({ error: "Failed to fetch AI settings" });
  }
});

router.put("/ai-settings", requirePlatformOrFirmAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(403).json({ error: "No firm context" });

    const schema = z.object({
      aiEnabled: z.boolean().optional(),
      preferredProvider: z.string().optional(),
      providerPriority: z.array(z.string()).optional(),
      maxTokensPerResponse: z.number().min(100).max(16000).optional(),
      autoSuggestionsEnabled: z.boolean().optional(),
      manualTriggerOnly: z.boolean().optional(),
      requestTimeout: z.number().min(5000).max(120000).optional(),
    });

    const data = schema.parse(req.body);
    const { ip, userAgent } = extractRequestMeta(req);

    const settings = await prisma.aISettings.upsert({
      where: { firmId },
      update: { ...data },
      create: { firmId, ...data },
    });

    await logPlatformAction(req.user!.id, "AI_SETTINGS_UPDATED", "ai_settings", settings.id, firmId, ip, userAgent, data);

    res.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    console.error("Update AI settings error:", error);
    res.status(500).json({ error: "Failed to update AI settings" });
  }
});

router.post("/ai-settings/provider-key", requirePlatformOrFirmAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(403).json({ error: "No firm context" });

    const schema = z.object({
      provider: z.enum(["openai", "gemini", "deepseek", "anthropic"]),
      apiKey: z.string().min(5),
      enabled: z.boolean().optional(),
    });

    const data = schema.parse(req.body);
    const { ip, userAgent } = extractRequestMeta(req);

    const encrypted = encryptString(data.apiKey);

    const updateData: any = {};
    updateData[`${data.provider}ApiKey`] = encrypted;
    if (data.enabled !== undefined) {
      updateData[`${data.provider}Enabled`] = data.enabled;
    }

    const settings = await prisma.aISettings.upsert({
      where: { firmId },
      update: updateData,
      create: { firmId, aiEnabled: true, ...updateData },
    });

    await logPlatformAction(req.user!.id, "AI_PROVIDER_KEY_SET", "ai_settings", settings.id, firmId, ip, userAgent, {
      provider: data.provider,
    });

    res.json({ success: true, provider: data.provider });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    console.error("Set AI provider key error:", error);
    res.status(500).json({ error: "Failed to set provider key" });
  }
});

router.delete("/ai-settings/provider-key/:provider", requirePlatformOrFirmAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(403).json({ error: "No firm context" });

    const provider = req.params.provider;
    if (!["openai", "gemini", "deepseek", "anthropic"].includes(provider)) {
      return res.status(400).json({ error: "Invalid provider" });
    }

    const { ip, userAgent } = extractRequestMeta(req);

    const existing = await prisma.aISettings.findUnique({ where: { firmId } });
    if (!existing) {
      return res.json({ success: true });
    }

    const updateData: any = {};
    updateData[`${provider}ApiKey`] = null;
    updateData[`${provider}Enabled`] = false;
    updateData[`${provider}TestStatus`] = null;
    updateData[`${provider}LastTested`] = null;

    await prisma.aISettings.update({
      where: { firmId },
      data: updateData,
    });

    await logPlatformAction(req.user!.id, "AI_PROVIDER_KEY_REMOVED", "ai_settings", firmId, firmId, ip, userAgent, { provider });

    res.json({ success: true });
  } catch (error) {
    console.error("Delete AI provider key error:", error);
    res.status(500).json({ error: "Failed to remove provider key" });
  }
});

router.post("/ai-settings/provider-toggle", requirePlatformOrFirmAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(403).json({ error: "No firm context" });

    const schema = z.object({
      provider: z.enum(["openai", "gemini", "deepseek", "anthropic"]),
      enabled: z.boolean(),
    });

    const data = schema.parse(req.body);

    const updateData: any = {};
    updateData[`${data.provider}Enabled`] = data.enabled;

    await prisma.aISettings.upsert({
      where: { firmId },
      update: updateData,
      create: { firmId, ...updateData },
    });

    res.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    console.error("Toggle AI provider error:", error);
    res.status(500).json({ error: "Failed to toggle provider" });
  }
});

router.post("/ai-settings/test-provider", requirePlatformOrFirmAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(403).json({ error: "No firm context" });

    const schema = z.object({
      provider: z.enum(["openai", "gemini", "deepseek", "anthropic"]),
    });

    const { provider } = schema.parse(req.body);

    const settings = await prisma.aISettings.findUnique({ where: { firmId } });
    if (!settings) return res.status(404).json({ error: "AI settings not configured" });

    const keyField = `${provider}ApiKey` as keyof typeof settings;
    const encryptedKey = settings[keyField] as string | null;

    let apiKey: string | undefined;
    if (encryptedKey) {
      try {
        apiKey = decryptString(encryptedKey);
      } catch {
        apiKey = encryptedKey;
      }
    }

    if (!apiKey && provider === "openai") {
      apiKey = process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
    }

    if (!apiKey) {
      const updateData: any = {};
      updateData[`${provider}TestStatus`] = "no_key";
      updateData[`${provider}LastTested`] = new Date();
      await prisma.aISettings.update({ where: { firmId }, data: updateData });
      return res.json({ success: false, status: "no_key", message: "No API key configured for this provider" });
    }

    let testResult = { success: false, message: "" };
    const startTime = Date.now();

    try {
      switch (provider) {
        case "openai": {
          const { default: OpenAI } = await import("openai");
          const openai = new OpenAI({
            apiKey,
            baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
            timeout: 15000,
          });
          const resp = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [{ role: "user", content: "Reply with: OK" }],
            max_tokens: 5,
          });
          testResult = { success: true, message: `Connected. Model: gpt-4o. Response time: ${Date.now() - startTime}ms` };
          break;
        }
        case "gemini": {
          const resp = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ parts: [{ text: "Reply with: OK" }] }],
                generationConfig: { maxOutputTokens: 5 },
              }),
              signal: AbortSignal.timeout(15000),
            }
          );
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          testResult = { success: true, message: `Connected. Model: gemini-1.5-flash. Response time: ${Date.now() - startTime}ms` };
          break;
        }
        case "deepseek": {
          const { default: OpenAI } = await import("openai");
          const deepseek = new OpenAI({ apiKey, baseURL: "https://api.deepseek.com", timeout: 15000 });
          await deepseek.chat.completions.create({
            model: "deepseek-chat",
            messages: [{ role: "user", content: "Reply with: OK" }],
            max_tokens: 5,
          });
          testResult = { success: true, message: `Connected. Model: deepseek-chat. Response time: ${Date.now() - startTime}ms` };
          break;
        }
        case "anthropic": {
          const resp = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": apiKey,
              "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
              model: "claude-sonnet-4-20250514",
              max_tokens: 5,
              messages: [{ role: "user", content: "Reply with: OK" }],
            }),
            signal: AbortSignal.timeout(15000),
          });
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          testResult = { success: true, message: `Connected. Model: claude-sonnet-4-20250514. Response time: ${Date.now() - startTime}ms` };
          break;
        }
      }
    } catch (err: any) {
      testResult = { success: false, message: err.message || "Connection failed" };
    }

    const updateData: any = {};
    updateData[`${provider}TestStatus`] = testResult.success ? "success" : "failed";
    updateData[`${provider}LastTested`] = new Date();
    await prisma.aISettings.update({ where: { firmId }, data: updateData });

    res.json({ success: testResult.success, status: testResult.success ? "success" : "failed", message: testResult.message });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    console.error("Test AI provider error:", error);
    res.status(500).json({ error: "Failed to test provider" });
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
      include: {
        plan: true,
        invoices: {
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            id: true,
            invoiceNo: true,
            amount: true,
            currency: true,
            status: true,
            issuedAt: true,
            dueAt: true,
            paidAt: true,
            createdAt: true,
          },
        },
      },
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
