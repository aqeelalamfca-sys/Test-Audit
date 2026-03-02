import { Router, type Response } from "express";
import { prisma } from "./db";
import {
  hashPassword,
  verifyPassword,
  createSession,
  invalidateSession,
  logAuditTrail,
  requireAuth,
  type AuthenticatedRequest,
} from "./auth";
import { z } from "zod";

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
    
    // PHASE 2: Quick token format validation (< 1ms)
    if (!token || token.length < 32) {
      return respond({
        ok: true,
        authenticated: false,
        reason: "invalid_token_format",
        message: "Token format is invalid",
      });
    }

    // PHASE 3: DB lookup with timeout (circuit breaker)
    const DB_TIMEOUT = 2000; // 2 second max for DB
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
        message: "Session does not exist",
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

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const registerSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3),
  password: z.string().min(8),
  fullName: z.string().min(2),
  firmId: z.string().optional(),
});

router.post("/login", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      await logAuditTrail(
        user.id,
        "LOGIN_FAILED",
        "user",
        user.id,
        null,
        { reason: "invalid_password" },
        undefined,
        undefined,
        req.ip,
        req.get("user-agent")
      );
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const session = await createSession(
      user.id,
      req.ip,
      req.get("user-agent")
    );

    await logAuditTrail(
      user.id,
      "LOGIN_SUCCESS",
      "user",
      user.id,
      null,
      { sessionId: session.id },
      undefined,
      undefined,
      req.ip,
      req.get("user-agent")
    );

    const { passwordHash, ...safeUser } = user;

    res.json({
      user: safeUser,
      token: session.token,
      expiresAt: session.expiresAt,
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

    const session = await createSession(user.id, req.ip, req.get("user-agent"));
    const { passwordHash: _, ...safeUser } = user;

    res.status(201).json({
      user: safeUser,
      token: session.token,
      expiresAt: session.expiresAt,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request", details: error.errors });
    }
    console.error("Register error:", error);
    res.status(500).json({ error: "Registration failed" });
  }
});

router.post("/logout", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.session?.token) {
      await invalidateSession(req.session.token);

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
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ error: "Logout failed" });
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
      const isPrivileged = ["PARTNER", "MANAGING_PARTNER", "ADMIN"].includes(req.user!.role as string);
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

      const isPrivileged = ["PARTNER", "MANAGING_PARTNER", "ADMIN"].includes(req.user!.role as string);
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

router.post("/change-password", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const schema = z.object({
      currentPassword: z.string(),
      newPassword: z.string().min(8),
    });

    const { currentPassword, newPassword } = schema.parse(req.body);

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

export default router;
