import { Router, type Response } from "express";
import { prisma } from "./db";
import {
  hashPassword,
  verifyPassword,
  createSession,
  invalidateSession,
  logAuditTrail,
  requireAuth,
  generateAccessToken,
  generateRefreshToken,
  rotateRefreshToken,
  revokeAllRefreshTokens,
  verifyAccessToken,
  isExpiredJwt,
  type AuthenticatedRequest,
} from "./auth";
import { z } from "zod";
import { validatePasswordPolicy } from "./utils/passwordPolicy";
import { checkAccountLockout, recordFailedAttempt, clearLockout } from "./middleware/accountLockout";
import { logPlatformAction } from "./services/platformAuditService";
import { loginRateLimit } from "./middleware/rateLimiter";
import { logSecurityEvent } from "./services/auditLogService";
import { generateTwoFactorSecret, generateQRCodeDataURL, verifyTwoFactorToken } from "./services/twoFactorService";
import { checkSuperAdminIpAtLogin } from "./middleware/superAdminIpAllowlist";

const router = Router();

// Quick auth status check with circuit breaker pattern
// GUARANTEED to respond in < 300ms - NO HANGING
// This endpoint is NOT protected by auth middleware
router.get("/ping", async (req: AuthenticatedRequest, res: Response) => {
  const startTime = Date.now();
  
  const respond = (data: any) => {
    const duration = Date.now() - startTime;
    return res.status(200).json({ ...data, responseTime: duration });
  };

  try {
    const authHeader = req.headers.authorization;
    
    // PHASE 1: Check if token exists (< 1ms)
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return respond({
        ok: true,
        authenticated: false,
        reason: "missing_token",
        message: "No authentication token provided",
      });
    }

    const token = authHeader.split(" ")[1];
    
    if (!token || token.length < 10) {
      return respond({
        ok: true,
        authenticated: false,
        reason: "invalid_token_format",
        message: "Token format is invalid",
      });
    }

    const jwtPayload = verifyAccessToken(token);
    if (jwtPayload) {
      return respond({
        ok: true,
        authenticated: true,
        reason: "valid",
        message: "JWT is valid",
        userId: jwtPayload.userId,
        role: jwtPayload.role,
      });
    }

    if (isExpiredJwt(token)) {
      return respond({
        ok: true,
        authenticated: false,
        reason: "token_expired",
        message: "JWT has expired, please refresh",
        needsRefresh: true,
      });
    }

    const DB_TIMEOUT = 2000;
    const dbPromise = prisma.session.findUnique({
      where: { token },
      select: { id: true, expiresAt: true, userId: true, user: { select: { role: true, isActive: true } } },
    });

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("DB_TIMEOUT")), DB_TIMEOUT);
    });

    let session: any;
    try {
      session = await Promise.race([dbPromise, timeoutPromise]);
    } catch (dbError: any) {
      if (dbError.message === "DB_TIMEOUT") {
        return respond({
          ok: false,
          authenticated: false,
          reason: "DB_TIMEOUT",
          message: "Database is temporarily slow. Please retry.",
        });
      }
      throw dbError;
    }

    if (!session) {
      return respond({
        ok: true,
        authenticated: false,
        reason: "session_not_found",
        message: "Invalid token",
      });
    }

    if (session.expiresAt < new Date()) {
      return respond({
        ok: true,
        authenticated: false,
        reason: "session_expired",
        message: "Session has expired",
      });
    }

    if (!session.user?.isActive) {
      return respond({
        ok: true,
        authenticated: false,
        reason: "user_inactive",
        message: "User account is inactive",
      });
    }

    return respond({
      ok: true,
      authenticated: true,
      reason: "valid",
      message: "Session is valid",
      userId: session.userId,
      role: session.user?.role,
    });
  } catch (error: any) {
    console.error("Auth ping error:", error);
    return respond({
      ok: false,
      authenticated: false,
      reason: "error",
      message: error.message || "Unable to verify authentication",
    });
  }
});

router.get("/plans", async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const plans = await prisma.plan.findMany({
      where: { isActive: true, isPublic: true },
      orderBy: { monthlyPrice: "asc" },
      select: {
        id: true,
        code: true,
        name: true,
        maxUsers: true,
        maxEngagements: true,
        maxOffices: true,
        storageGb: true,
        allowCustomAi: true,
        platformAiIncluded: true,
        monthlyPrice: true,
        monthlyDiscount: true,
        yearlyDiscount: true,
        specialOffer: true,
        supportLevel: true,
        featureFlags: true,
      },
    });
    res.json(plans);
  } catch (error) {
    console.error("Plans fetch error:", error);
    res.status(500).json({ error: "Failed to fetch plans" });
  }
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const registerSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3),
  password: z.string().min(10, "Password must be at least 10 characters"),
  fullName: z.string().min(2),
  firmId: z.string().optional(),
});

router.post("/login", loginRateLimit(), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const clientIp = (typeof req.headers["x-forwarded-for"] === "string"
      ? req.headers["x-forwarded-for"].split(",")[0].trim()
      : req.ip) || "unknown";
    const lockoutKey = `${email.toLowerCase()}:${clientIp}`;

    const lockStatus = checkAccountLockout(lockoutKey);
    if (lockStatus.locked) {
      logSecurityEvent("ACCOUNT_LOCKED_ATTEMPT", clientIp, req.get("user-agent"), {
        email: email.toLowerCase(),
        remainingSeconds: lockStatus.remainingSeconds,
      }).catch(err => console.error("Security event logging failed:", err));
      return res.status(429).json({
        error: "Account temporarily locked due to too many failed attempts.",
        code: "ACCOUNT_LOCKED",
        retryAfterSeconds: lockStatus.remainingSeconds,
      });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !user.isActive || user.status === "DELETED") {
      recordFailedAttempt(lockoutKey);
      logSecurityEvent("LOGIN_FAILED_UNKNOWN_USER", clientIp, req.get("user-agent"), {
        email: email.toLowerCase(),
      }).catch(err => console.error("Security event logging failed:", err));
      return res.status(401).json({ error: "Invalid credentials" });
    }

    if (user.status === "SUSPENDED") {
      return res.status(403).json({ error: "Your account has been suspended. Please contact your administrator." });
    }

    if (user.role === "SUPER_ADMIN") {
      const ipCheck = checkSuperAdminIpAtLogin(clientIp);
      if (!ipCheck.allowed) {
        logSecurityEvent("SUPER_ADMIN_IP_BLOCKED", clientIp, req.get("user-agent"), {
          email: email.toLowerCase(),
          reason: ipCheck.reason,
        }).catch(err => console.error("Security event logging failed:", err));
        return res.status(403).json({
          error: ipCheck.reason,
          code: "IP_NOT_ALLOWED",
        });
      }
    }

    if (user.firmId && user.role !== "SUPER_ADMIN") {
      const firm = await prisma.firm.findUnique({ where: { id: user.firmId } });
      if (firm) {
        if (firm.status === "SUSPENDED") {
          return res.status(403).json({
            error: "Your firm account has been suspended. Please contact support.",
            code: "FIRM_SUSPENDED",
          });
        }
        if (firm.status === "TERMINATED") {
          return res.status(403).json({
            error: "Your firm account has been terminated.",
            code: "FIRM_TERMINATED",
          });
        }
        if (firm.status === "DORMANT" && user.role !== "FIRM_ADMIN") {
          return res.status(403).json({
            error: "Your firm's trial has expired. Only firm administrators can access the portal during dormant status.",
            code: "FIRM_DORMANT",
          });
        }
      }
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      const lockResult = recordFailedAttempt(lockoutKey);
      await logAuditTrail(
        user.id,
        "LOGIN_FAILED",
        "user",
        user.id,
        null,
        { reason: "invalid_password", attemptsRemaining: lockResult.attemptsRemaining, locked: lockResult.locked },
        undefined,
        undefined,
        clientIp,
        req.get("user-agent")
      );
      logPlatformAction(
        user.id,
        "LOGIN_FAILED",
        "User",
        user.id,
        user.firmId,
        clientIp,
        req.get("user-agent"),
        { email: user.email, reason: "invalid_password" }
      ).catch(err => console.error("Platform action logging failed:", err));
      if (lockResult.locked) {
        return res.status(429).json({
          error: "Account temporarily locked due to too many failed attempts. Try again in 15 minutes.",
          code: "ACCOUNT_LOCKED",
        });
      }
      return res.status(401).json({ error: "Invalid credentials" });
    }

    clearLockout(lockoutKey);

    if (user.twoFactorEnabled && user.twoFactorSecret) {
      const twoFactorCode = req.body.twoFactorCode;
      if (!twoFactorCode) {
        return res.status(200).json({
          requiresTwoFactor: true,
          userId: user.id,
          message: "Two-factor authentication code required",
        });
      }
      const isValid2FA = await verifyTwoFactorToken(twoFactorCode, user.twoFactorSecret);
      if (!isValid2FA) {
        return res.status(401).json({ error: "Invalid two-factor authentication code" });
      }
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = await generateRefreshToken(user.id);

    await logAuditTrail(
      user.id,
      "LOGIN_SUCCESS",
      "user",
      user.id,
      null,
      { authMethod: user.twoFactorEnabled ? "jwt+2fa" : "jwt" },
      undefined,
      undefined,
      clientIp,
      req.get("user-agent")
    );

    logPlatformAction(
      user.id,
      "LOGIN_SUCCESS",
      "User",
      user.id,
      user.firmId,
      clientIp,
      req.get("user-agent"),
      { email: user.email, role: user.role }
    ).catch(err => console.error("Platform action logging failed:", err));

    const { passwordHash, twoFactorSecret, ...safeUser } = user;

    res.json({
      user: safeUser,
      token: accessToken,
      refreshToken,
      expiresIn: 900,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request", details: error.errors });
    }
    console.error("Login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
});

router.post("/register", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = registerSchema.parse(req.body);

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email: data.email }, { username: data.username }],
      },
    });

    if (existingUser) {
      return res.status(400).json({
        error: existingUser.email === data.email
          ? "Email already registered"
          : "Username already taken",
      });
    }

    const passwordCheck = validatePasswordPolicy(data.password);
    if (!passwordCheck.valid) {
      return res.status(400).json({ error: "Password does not meet requirements", details: passwordCheck.errors });
    }

    const passwordHash = await hashPassword(data.password);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        username: data.username,
        passwordHash,
        fullName: data.fullName,
        firmId: data.firmId,
        role: "STAFF",
      },
    });

    await logAuditTrail(
      user.id,
      "USER_REGISTERED",
      "user",
      user.id,
      null,
      { email: user.email, username: user.username },
      undefined,
      undefined,
      req.ip,
      req.get("user-agent")
    );

    const accessToken = generateAccessToken(user);
    const refreshToken = await generateRefreshToken(user.id);
    const { passwordHash: _, ...safeUser } = user;

    res.status(201).json({
      user: safeUser,
      token: accessToken,
      refreshToken,
      expiresIn: 900,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request", details: error.errors });
    }
    console.error("Register error:", error);
    res.status(500).json({ error: "Registration failed" });
  }
});

const signupSchema = z.object({
  firmLegalName: z.string().min(2, "Firm name must be at least 2 characters"),
  firmDisplayName: z.string().optional(),
  firmEmail: z.string().email().optional().or(z.literal("")),
  headOfficeAddress: z.string().min(5, "Head office address is required").optional().or(z.literal("")),
  mobileNumber: z.string().min(7, "Valid mobile number is required").optional().or(z.literal("")),
  ntn: z.string().optional(),
  country: z.string().optional(),
  currency: z.string().optional(),
  branches: z.array(z.object({
    name: z.string(),
    address: z.string(),
  })).optional(),
  adminFullName: z.string().min(2, "Full name must be at least 2 characters"),
  adminEmail: z.string().email("Invalid email address"),
  password: z.string().min(10, "Password must be at least 10 characters"),
  planKey: z.string().min(1, "Plan selection is required"),
  acceptTerms: z.literal(true, { errorMap: () => ({ message: "You must accept the terms" }) }),
});

router.post("/signup", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = signupSchema.parse(req.body);
    const { logBillingAction } = await import("./services/billingAuditService");

    const passwordCheck = validatePasswordPolicy(data.password);
    if (!passwordCheck.valid) {
      return res.status(400).json({ error: "Password does not meet requirements", details: passwordCheck.errors });
    }

    const existingUser = await prisma.user.findUnique({ where: { email: data.adminEmail } });
    if (existingUser) {
      return res.status(400).json({ error: "This email is already registered. Please use a different email or sign in." });
    }

    const plan = await prisma.plan.findFirst({
      where: { code: data.planKey.toUpperCase(), isActive: true, isPublic: true },
    });
    if (!plan) {
      return res.status(400).json({ error: "Selected plan is not available." });
    }

    const now = new Date();
    const trialEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const passwordHash = await hashPassword(data.password);
    const baseUsername = data.adminEmail.split("@")[0].replace(/[^a-zA-Z0-9_.-]/g, "") + "_admin";
    let username = baseUsername;
    const existingUsername = await prisma.user.findUnique({ where: { username } });
    if (existingUsername) {
      username = `${baseUsername}_${Date.now().toString(36)}`;
    }

    const result = await prisma.$transaction(async (tx) => {
      const firm = await tx.firm.create({
        data: {
          name: data.firmLegalName,
          displayName: data.firmDisplayName || null,
          email: data.firmEmail || data.adminEmail,
          headOfficeAddress: data.headOfficeAddress || null,
          phone: data.mobileNumber || null,
          taxId: data.ntn || null,
          country: data.country || "Pakistan",
          currency: data.currency || "PKR",
          offices: data.branches?.filter(b => b.name || b.address) || undefined,
          status: "TRIAL",
        },
      });

      const adminUser = await tx.user.create({
        data: {
          email: data.adminEmail,
          username,
          passwordHash,
          fullName: data.adminFullName,
          role: "FIRM_ADMIN",
          firmId: firm.id,
          isActive: true,
          status: "ACTIVE",
        },
      });

      const priceSnapshot = {
        planCode: plan.code,
        planName: plan.name,
        monthlyPrice: Number(plan.monthlyPrice),
        maxUsers: plan.maxUsers,
        maxEngagements: plan.maxEngagements,
        maxOffices: plan.maxOffices,
        storageGb: plan.storageGb,
        allowCustomAi: plan.allowCustomAi,
        platformAiIncluded: plan.platformAiIncluded,
      };

      const subscription = await tx.subscription.create({
        data: {
          firmId: firm.id,
          planId: plan.id,
          status: "TRIAL",
          trialStart: now,
          trialEnd: trialEnd,
          deleteAt: trialEnd,
          isActivated: false,
          graceDays: 0,
          priceSnapshot,
        },
      });

      await tx.firmSettings.create({
        data: {
          firmId: firm.id,
          aiEnabled: plan.platformAiIncluded,
        },
      });

      return { firm, adminUser, subscription };
    });

    await logBillingAction({
      actorUserId: result.adminUser.id,
      firmId: result.firm.id,
      subscriptionId: result.subscription.id,
      action: "SIGNUP_TRIAL_STARTED",
      afterState: {
        firmName: result.firm.name,
        adminEmail: data.adminEmail,
        planCode: plan.code,
        trialEnd: trialEnd.toISOString(),
        deleteAt: trialEnd.toISOString(),
      },
    });

    await logAuditTrail(
      result.adminUser.id,
      "SIGNUP_TRIAL",
      "firm",
      result.firm.id,
      null,
      { planCode: plan.code, trialDays: 60 },
      undefined,
      undefined,
      req.ip,
      req.get("user-agent")
    );

    const accessToken = generateAccessToken(result.adminUser);
    const refreshToken = await generateRefreshToken(result.adminUser.id);
    const { passwordHash: _, ...safeUser } = result.adminUser;

    res.status(201).json({
      user: safeUser,
      token: accessToken,
      refreshToken,
      expiresIn: 900,
      firm: { id: result.firm.id, name: result.firm.name },
      subscription: {
        id: result.subscription.id,
        status: result.subscription.status,
        trialEnd: result.subscription.trialEnd,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    console.error("Signup error:", error);
    res.status(500).json({ error: "Signup failed. Please try again." });
  }
});

router.post("/logout", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await revokeAllRefreshTokens(req.user!.id);

    if (req.session?.token) {
      await invalidateSession(req.session.token);
    }

    await logAuditTrail(
      req.user!.id,
      "LOGOUT",
      "user",
      req.user!.id,
      null,
      null,
      undefined,
      undefined,
      req.ip,
      req.get("user-agent")
    );

    res.json({ success: true });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ error: "Logout failed" });
  }
});

router.post("/refresh", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { refreshToken } = z.object({ refreshToken: z.string() }).parse(req.body);

    const result = await rotateRefreshToken(refreshToken);
    if (!result) {
      return res.status(401).json({ error: "Invalid or expired refresh token" });
    }

    res.json({
      token: result.accessToken,
      refreshToken: result.refreshToken,
      expiresIn: 900,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request" });
    }
    console.error("Token refresh error:", error);
    res.status(500).json({ error: "Token refresh failed" });
  }
});

router.get("/me", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Re-query user to pick up persisted preferences (activeClientId/activePeriodId)
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });

    const firm = req.user!.firmId
      ? await prisma.firm.findUnique({ where: { id: req.user!.firmId } })
      : null;

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      user,
      firm,
    });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ error: "Failed to get user" });
  }
});

// Get saved workspace context for current user
router.get("/me/context", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    res.json({ activeClientId: (user as any)?.activeClientId || null, activePeriodId: (user as any)?.activePeriodId || null });
  } catch (error) {
    console.error("Get context error:", error);
    res.status(500).json({ error: "Failed to get context" });
  }
});

// Update saved workspace context for current user
router.patch("/me/context", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const schema = z.object({
      activeClientId: z.string().uuid().nullable().optional(),
      activePeriodId: z.string().uuid().nullable().optional(),
    });

    const data = schema.parse(req.body);

    // Validate client authorization if provided
    if (data.activeClientId) {
      const client = await prisma.client.findUnique({ where: { id: data.activeClientId } });
      if (!client || client.firmId !== req.user!.firmId) {
        return res.status(403).json({ error: "Unauthorized client selection" });
      }

      // Ensure user is assigned to at least one engagement for this client or is privileged
      const isPrivileged = ["PARTNER", "FIRM_ADMIN"].includes(req.user!.role as string);
      if (!isPrivileged) {
        const hasAssignment = await prisma.engagementTeam.findFirst({
          where: { userId: req.user!.id, engagement: { clientId: data.activeClientId } },
        });
        if (!hasAssignment) {
          return res.status(403).json({ error: "Unauthorized client selection" });
        }
      }
    }

    // Validate period (engagement) if provided
    if (data.activePeriodId) {
      const eng = await prisma.engagement.findUnique({ where: { id: data.activePeriodId } });
      if (!eng || eng.firmId !== req.user!.firmId) {
        return res.status(403).json({ error: "Unauthorized period selection" });
      }

      const isPrivileged = ["PARTNER", "FIRM_ADMIN"].includes(req.user!.role as string);
      if (!isPrivileged) {
        const teamMember = await prisma.engagementTeam.findFirst({ where: { userId: req.user!.id, engagementId: data.activePeriodId } });
        if (!teamMember) {
          return res.status(403).json({ error: "Unauthorized period selection" });
        }
      }
    }

    const payload: any = {};
    if (data.activeClientId !== undefined) payload.activeClientId = data.activeClientId;
    if (data.activePeriodId !== undefined) payload.activePeriodId = data.activePeriodId;

    const updated = await prisma.user.update({ where: { id: req.user!.id }, data: payload as any });

    await logAuditTrail(req.user!.id, "USER_CONTEXT_UPDATED", "user", req.user!.id, null, { updated }, undefined, "Updated workspace context", req.ip, req.get("user-agent"));

    res.json({ activeClientId: (updated as any).activeClientId || null, activePeriodId: (updated as any).activePeriodId || null });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request", details: error.errors });
    }
    console.error("Update context error:", error);
    res.status(500).json({ error: "Failed to update context" });
  }
});

router.patch("/me", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const updateSchema = z.object({
      fullName: z.string().min(2).optional(),
      email: z.string().email().optional(),
    });

    const data = updateSchema.parse(req.body);

    if (data.email && data.email !== req.user!.email) {
      const existing = await prisma.user.findUnique({ where: { email: data.email } });
      if (existing) {
        return res.status(400).json({ error: "Email already in use" });
      }
    }

    const beforeValue = { fullName: req.user!.fullName, email: req.user!.email };

    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data,
    });

    await logAuditTrail(
      req.user!.id,
      "USER_UPDATED",
      "user",
      req.user!.id,
      beforeValue,
      data,
      undefined,
      undefined,
      req.ip,
      req.get("user-agent")
    );

    const { passwordHash, ...safeUser } = user;
    res.json({ user: safeUser });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request", details: error.errors });
    }
    console.error("Update user error:", error);
    res.status(500).json({ error: "Failed to update user" });
  }
});

// ========== INVITE-BASED ONBOARDING (Public) ==========

router.get("/invite/:token", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const invite = await prisma.firmInvite.findUnique({
      where: { token: req.params.token },
      include: {
        firm: { select: { id: true, name: true, logoUrl: true } },
      },
    });

    if (!invite) {
      return res.status(404).json({ error: "Invite not found" });
    }

    if (invite.revokedAt) {
      return res.status(410).json({ error: "This invite has been revoked" });
    }

    if (invite.acceptedAt) {
      return res.status(410).json({ error: "This invite has already been used" });
    }

    if (invite.expiresAt < new Date()) {
      return res.status(410).json({ error: "This invite has expired" });
    }

    res.json({
      email: invite.email,
      role: invite.role,
      firm: invite.firm,
      expiresAt: invite.expiresAt,
    });
  } catch (error) {
    console.error("Validate invite error:", error);
    res.status(500).json({ error: "Failed to validate invite" });
  }
});

const acceptInviteSchema = z.object({
  fullName: z.string().min(2),
  password: z.string().min(10, "Password must be at least 10 characters"),
  username: z.string().min(3).optional(),
});

router.post("/invite/:token/accept", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = acceptInviteSchema.parse(req.body);

    const passwordCheck = validatePasswordPolicy(data.password);
    if (!passwordCheck.valid) {
      return res.status(400).json({ error: "Password does not meet requirements", details: passwordCheck.errors });
    }

    const invite = await prisma.firmInvite.findUnique({
      where: { token: req.params.token },
      include: { firm: true },
    });

    if (!invite) {
      return res.status(404).json({ error: "Invite not found" });
    }

    if (invite.revokedAt) {
      return res.status(410).json({ error: "This invite has been revoked" });
    }

    if (invite.acceptedAt) {
      return res.status(410).json({ error: "This invite has already been used" });
    }

    if (invite.expiresAt < new Date()) {
      return res.status(410).json({ error: "This invite has expired" });
    }

    const existingUser = await prisma.user.findUnique({ where: { email: invite.email } });
    if (existingUser) {
      return res.status(400).json({ error: "A user with this email already exists" });
    }

    const baseInviteUsername = (data.username || invite.email.split("@")[0]).replace(/[^a-zA-Z0-9_.-]/g, "");
    let username = baseInviteUsername;
    const existingInviteUsername = await prisma.user.findUnique({ where: { username } });
    if (existingInviteUsername) {
      username = `${baseInviteUsername}_${Date.now().toString(36)}`;
    }

    const passwordHash = await hashPassword(data.password);

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: invite.email,
          username,
          passwordHash,
          fullName: data.fullName,
          role: invite.role as any,
          firmId: invite.firmId,
          status: "ACTIVE",
          isActive: true,
        },
      });

      await tx.firmInvite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      });

      return user;
    });

    await logAuditTrail(
      result.id,
      "INVITE_ACCEPTED",
      "user",
      result.id,
      null,
      { inviteId: invite.id, firmId: invite.firmId, role: invite.role },
      undefined,
      undefined,
      req.ip,
      req.get("user-agent")
    );

    const accessToken = generateAccessToken(result);
    const refreshToken = await generateRefreshToken(result.id);
    const { passwordHash: _, ...safeUser } = result;

    res.status(201).json({
      user: safeUser,
      token: accessToken,
      refreshToken,
      expiresIn: 900,
      firm: { id: invite.firmId, name: invite.firm.name },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request", details: error.errors });
    }
    console.error("Accept invite error:", error);
    res.status(500).json({ error: "Failed to accept invite" });
  }
});

router.post("/change-password", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const schema = z.object({
      currentPassword: z.string(),
      newPassword: z.string().min(10, "Password must be at least 10 characters"),
    });

    const { currentPassword, newPassword } = schema.parse(req.body);

    const passwordCheck = validatePasswordPolicy(newPassword);
    if (!passwordCheck.valid) {
      return res.status(400).json({ error: "Password does not meet requirements", details: passwordCheck.errors });
    }

    const isValid = await verifyPassword(currentPassword, req.user!.passwordHash);
    if (!isValid) {
      return res.status(400).json({ error: "Current password is incorrect" });
    }

    const newHash = await hashPassword(newPassword);

    await prisma.user.update({
      where: { id: req.user!.id },
      data: { passwordHash: newHash },
    });

    await logAuditTrail(
      req.user!.id,
      "PASSWORD_CHANGED",
      "user",
      req.user!.id,
      null,
      null,
      undefined,
      undefined,
      req.ip,
      req.get("user-agent")
    );

    res.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request", details: error.errors });
    }
    console.error("Change password error:", error);
    res.status(500).json({ error: "Failed to change password" });
  }
});

router.post("/2fa/setup", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    if (user.twoFactorEnabled) {
      return res.status(400).json({ error: "Two-factor authentication is already enabled" });
    }
    const { secret, otpauthUrl } = generateTwoFactorSecret(user.email);
    const qrCodeDataURL = await generateQRCodeDataURL(otpauthUrl);

    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorSecret: secret },
    });

    res.json({ secret, qrCode: qrCodeDataURL });
  } catch (error) {
    console.error("2FA setup error:", error);
    res.status(500).json({ error: "Failed to set up two-factor authentication" });
  }
});

router.post("/2fa/verify", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { code } = z.object({ code: z.string().length(6) }).parse(req.body);
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user || !user.twoFactorSecret) {
      return res.status(400).json({ error: "Two-factor setup not initiated" });
    }
    const isValid = await verifyTwoFactorToken(code, user.twoFactorSecret);
    if (!isValid) {
      return res.status(400).json({ error: "Invalid verification code. Please try again." });
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorEnabled: true },
    });
    await logAuditTrail(user.id, "2FA_ENABLED", "user", user.id, null, null, undefined, undefined, req.ip, req.get("user-agent"));
    res.json({ success: true, message: "Two-factor authentication enabled successfully" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid code format" });
    }
    console.error("2FA verify error:", error);
    res.status(500).json({ error: "Failed to verify two-factor code" });
  }
});

router.post("/2fa/disable", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { password } = z.object({ password: z.string() }).parse(req.body);
    const user = req.user!;
    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return res.status(400).json({ error: "Incorrect password" });
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorEnabled: false, twoFactorSecret: null },
    });
    await logAuditTrail(user.id, "2FA_DISABLED", "user", user.id, null, null, undefined, undefined, req.ip, req.get("user-agent"));
    res.json({ success: true, message: "Two-factor authentication disabled" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Password is required" });
    }
    console.error("2FA disable error:", error);
    res.status(500).json({ error: "Failed to disable two-factor authentication" });
  }
});

router.get("/2fa/status", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  res.json({ enabled: req.user!.twoFactorEnabled || false });
});

export default router;
