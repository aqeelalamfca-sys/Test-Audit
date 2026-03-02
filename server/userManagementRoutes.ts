import { Router, type Response } from "express";
import { prisma } from "./db";
import { requireAuth, requireRoles, logAuditTrail, type AuthenticatedRequest, hashPassword } from "./auth";
import { z } from "zod";
import type { UserRole } from "@prisma/client";

const router = Router();

const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;

function validatePasswordPolicy(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (password.length < PASSWORD_MIN_LENGTH) {
    errors.push(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`);
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }
  
  if (!/\d/.test(password)) {
    errors.push("Password must contain at least one number");
  }
  
  if (!/[@$!%*?&#^()_+=-]/.test(password)) {
    errors.push("Password must contain at least one special character (@$!%*?&#^()_+=-)");
  }
  
  return { valid: errors.length === 0, errors };
}

const createUserSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(50),
  password: z.string().min(PASSWORD_MIN_LENGTH),
  fullName: z.string().min(2),
  role: z.enum(["STAFF", "SENIOR", "MANAGER", "PARTNER", "EQCR"]),
});

const updateUserSchema = z.object({
  email: z.string().email().optional(),
  fullName: z.string().min(2).optional(),
  role: z.enum(["STAFF", "SENIOR", "MANAGER", "PARTNER", "EQCR", "ADMIN"]).optional(),
  isActive: z.boolean().optional(),
});

router.get("/", requireAuth, requireRoles("ADMIN", "PARTNER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firmId = req.user!.role === "ADMIN" ? (req.query.firmId as string | undefined) : req.user!.firmId;
    
    if (!firmId && req.user!.role !== "ADMIN") {
      return res.status(400).json({ error: "User not associated with a firm" });
    }

    const where = firmId ? { firmId } : {};

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        username: true,
        fullName: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        firmId: true,
        firm: {
          select: { id: true, name: true },
        },
        _count: {
          select: {
            teamAssignments: true,
            checklistsCompleted: true,
          },
        },
      },
      orderBy: [{ role: "desc" }, { fullName: "asc" }],
    });

    res.json(users);
  } catch (error) {
    console.error("Get users error:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

router.get("/:id", requireAuth, requireRoles("ADMIN", "PARTNER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        email: true,
        username: true,
        fullName: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        firmId: true,
        firm: {
          select: { id: true, name: true },
        },
        teamAssignments: {
          include: {
            engagement: {
              select: {
                id: true,
                engagementCode: true,
                client: { select: { name: true } },
                status: true,
              },
            },
          },
        },
        declarationsSubmitted: {
          select: {
            id: true,
            engagementId: true,
            status: true,
            confirmedAtStart: true,
            confirmedAtCompletion: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (req.user!.role !== "ADMIN" && user.firmId !== req.user!.firmId) {
      return res.status(403).json({ error: "Access denied" });
    }

    res.json(user);
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

router.post("/", requireAuth, requireRoles("ADMIN", "PARTNER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = createUserSchema.parse(req.body);

    const passwordValidation = validatePasswordPolicy(data.password);
    if (!passwordValidation.valid) {
      return res.status(400).json({ error: "Password does not meet requirements", details: passwordValidation.errors });
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email: data.email }, { username: data.username }],
      },
    });

    if (existingUser) {
      return res.status(400).json({
        error: existingUser.email === data.email ? "Email already registered" : "Username already taken",
      });
    }

    const firmId = req.user!.role === "ADMIN" 
      ? (req.body.firmId as string | undefined)
      : req.user!.firmId;

    if (!firmId) {
      return res.status(400).json({ error: "Firm ID is required" });
    }

    if (req.user!.role !== "ADMIN") {
      const roleHierarchy: Record<UserRole, number> = {
        STAFF: 1,
        SENIOR: 2,
        TEAM_LEAD: 25,
        MANAGER: 3,
        MANAGING_PARTNER: 90,
        PARTNER: 4,
        EQCR: 5,
        ADMIN: 100,
      };
      if (roleHierarchy[data.role as UserRole] >= roleHierarchy[req.user!.role]) {
        return res.status(403).json({ error: "Cannot create user with equal or higher role than yourself" });
      }
    }

    const passwordHash = await hashPassword(data.password);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        username: data.username,
        passwordHash,
        fullName: data.fullName,
        role: data.role as UserRole,
        firmId,
      },
      select: {
        id: true,
        email: true,
        username: true,
        fullName: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    await logAuditTrail(
      req.user!.id,
      "USER_CREATED_BY_ADMIN",
      "user",
      user.id,
      null,
      { email: user.email, role: user.role },
      undefined,
      `User ${user.fullName} created by administrator`,
      req.ip,
      req.get("user-agent")
    );

    res.status(201).json(user);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    console.error("Create user error:", error);
    res.status(500).json({ error: "Failed to create user" });
  }
});

router.patch("/:id", requireAuth, requireRoles("ADMIN", "PARTNER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const existing = await prisma.user.findUnique({
      where: { id: req.params.id },
    });

    if (!existing) {
      return res.status(404).json({ error: "User not found" });
    }

    if (req.user!.role !== "ADMIN" && existing.firmId !== req.user!.firmId) {
      return res.status(403).json({ error: "Access denied" });
    }

    if (req.user!.role !== "ADMIN") {
      const roleHierarchy: Record<UserRole, number> = {
        STAFF: 1,
        SENIOR: 2,
        TEAM_LEAD: 25,
        MANAGER: 3,
        MANAGING_PARTNER: 90,
        PARTNER: 4,
        EQCR: 5,
        ADMIN: 100,
      };
      if (roleHierarchy[existing.role] >= roleHierarchy[req.user!.role]) {
        return res.status(403).json({ error: "Cannot modify user with equal or higher role" });
      }
    }

    const data = updateUserSchema.parse(req.body);

    if (data.email && data.email !== existing.email) {
      const emailExists = await prisma.user.findUnique({ where: { email: data.email } });
      if (emailExists) {
        return res.status(400).json({ error: "Email already in use" });
      }
    }

    if (data.role && req.user!.role !== "ADMIN") {
      const roleHierarchy: Record<UserRole, number> = {
        STAFF: 1,
        SENIOR: 2,
        TEAM_LEAD: 25,
        MANAGER: 3,
        MANAGING_PARTNER: 90,
        PARTNER: 4,
        EQCR: 5,
        ADMIN: 100,
      };
      if (roleHierarchy[data.role as UserRole] >= roleHierarchy[req.user!.role]) {
        return res.status(403).json({ error: "Cannot assign role equal or higher than your own" });
      }
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data,
      select: {
        id: true,
        email: true,
        username: true,
        fullName: true,
        role: true,
        isActive: true,
        updatedAt: true,
      },
    });

    await logAuditTrail(
      req.user!.id,
      "USER_UPDATED_BY_ADMIN",
      "user",
      user.id,
      { email: existing.email, role: existing.role, isActive: existing.isActive },
      { email: user.email, role: user.role, isActive: user.isActive },
      undefined,
      `User ${user.fullName} updated by administrator`,
      req.ip,
      req.get("user-agent")
    );

    res.json(user);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    console.error("Update user error:", error);
    res.status(500).json({ error: "Failed to update user" });
  }
});

router.post("/:id/reset-password", requireAuth, requireRoles("ADMIN", "PARTNER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const existing = await prisma.user.findUnique({
      where: { id: req.params.id },
    });

    if (!existing) {
      return res.status(404).json({ error: "User not found" });
    }

    if (req.user!.role !== "ADMIN" && existing.firmId !== req.user!.firmId) {
      return res.status(403).json({ error: "Access denied" });
    }

    const { newPassword } = z.object({ newPassword: z.string().min(PASSWORD_MIN_LENGTH) }).parse(req.body);

    const passwordValidation = validatePasswordPolicy(newPassword);
    if (!passwordValidation.valid) {
      return res.status(400).json({ error: "Password does not meet requirements", details: passwordValidation.errors });
    }

    const passwordHash = await hashPassword(newPassword);

    await prisma.user.update({
      where: { id: req.params.id },
      data: { passwordHash },
    });

    await prisma.session.deleteMany({
      where: { userId: req.params.id },
    });

    await logAuditTrail(
      req.user!.id,
      "USER_PASSWORD_RESET_BY_ADMIN",
      "user",
      req.params.id,
      null,
      null,
      undefined,
      `Password reset by administrator for ${existing.fullName}`,
      req.ip,
      req.get("user-agent")
    );

    res.json({ success: true, message: "Password reset successfully. All existing sessions invalidated." });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    console.error("Reset password error:", error);
    res.status(500).json({ error: "Failed to reset password" });
  }
});

router.post("/:id/toggle-status", requireAuth, requireRoles("ADMIN", "PARTNER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const existing = await prisma.user.findUnique({
      where: { id: req.params.id },
    });

    if (!existing) {
      return res.status(404).json({ error: "User not found" });
    }

    if (req.user!.role !== "ADMIN" && existing.firmId !== req.user!.firmId) {
      return res.status(403).json({ error: "Access denied" });
    }

    if (req.params.id === req.user!.id) {
      return res.status(400).json({ error: "Cannot deactivate your own account" });
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { isActive: !existing.isActive },
      select: {
        id: true,
        fullName: true,
        isActive: true,
      },
    });

    if (!user.isActive) {
      await prisma.session.deleteMany({
        where: { userId: req.params.id },
      });
    }

    await logAuditTrail(
      req.user!.id,
      user.isActive ? "USER_ACTIVATED" : "USER_DEACTIVATED",
      "user",
      user.id,
      { isActive: existing.isActive },
      { isActive: user.isActive },
      undefined,
      `User ${user.fullName} ${user.isActive ? "activated" : "deactivated"}`,
      req.ip,
      req.get("user-agent")
    );

    res.json(user);
  } catch (error) {
    console.error("Toggle user status error:", error);
    res.status(500).json({ error: "Failed to toggle user status" });
  }
});

router.get("/:id/activity", requireAuth, requireRoles("ADMIN", "PARTNER", "MANAGER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: { firmId: true, fullName: true },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (req.user!.role !== "ADMIN" && user.firmId !== req.user!.firmId) {
      return res.status(403).json({ error: "Access denied" });
    }

    const [recentActivity, sessionCount, engagementCount] = await Promise.all([
      prisma.auditTrail.findMany({
        where: { userId: req.params.id },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          action: true,
          entityType: true,
          createdAt: true,
          engagement: {
            select: { id: true, engagementCode: true },
          },
        },
      }),
      prisma.session.count({
        where: { userId: req.params.id, expiresAt: { gt: new Date() } },
      }),
      prisma.engagementTeam.count({
        where: { userId: req.params.id },
      }),
    ]);

    res.json({
      userName: user.fullName,
      activeSessions: sessionCount,
      totalEngagements: engagementCount,
      recentActivity,
    });
  } catch (error) {
    console.error("Get user activity error:", error);
    res.status(500).json({ error: "Failed to fetch user activity" });
  }
});

router.get("/password-policy", async (_req, res: Response) => {
  res.json({
    minLength: PASSWORD_MIN_LENGTH,
    requireLowercase: true,
    requireUppercase: true,
    requireNumber: true,
    requireSpecialChar: true,
    specialChars: "@$!%*?&#^()_+=-",
  });
});

export default router;
