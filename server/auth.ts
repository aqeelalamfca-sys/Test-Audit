import { prisma } from "./db";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import type { Request, Response, NextFunction } from "express";
import type { User, UserRole } from "@prisma/client";

const SESSION_DURATION_HOURS = 24;

export interface AuthenticatedRequest extends Request {
  user?: User;
  session?: { id: string; token: string };
  jwtPayload?: { userId: string; email: string; role: string; firmId: string | null };
  activeClientId?: string | null;
  activePeriodId?: string | null;
}

export {
  generateAccessToken,
  generateRefreshToken,
  rotateRefreshToken,
  revokeAllRefreshTokens,
  verifyAccessToken,
  isExpiredJwt,
  jwtAuthMiddleware,
} from "./middleware/jwtAuth";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export async function createSession(userId: string, ipAddress?: string, userAgent?: string) {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_HOURS * 60 * 60 * 1000);

  const session = await prisma.session.create({
    data: {
      userId,
      token,
      expiresAt,
      ipAddress,
      userAgent,
    },
  });

  await prisma.user.update({
    where: { id: userId },
    data: { lastLoginAt: new Date() },
  });

  return session;
}

export async function validateSession(token: string) {
  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { id: session.id } });
    return null;
  }

  return session;
}

export async function invalidateSession(token: string) {
  await prisma.session.delete({ where: { token } }).catch(err => console.error("Session invalidation failed:", err));
}

export async function logAuditTrail(
  userId: string,
  action: string,
  entityType: string,
  entityId?: string,
  beforeValue?: any,
  afterValue?: any,
  engagementId?: string,
  justification?: string,
  ipAddress?: string,
  userAgent?: string
) {
  return prisma.auditTrail.create({
    data: {
      userId,
      action,
      entityType,
      entityId,
      beforeValue,
      afterValue,
      engagementId,
      justification,
      ipAddress,
      userAgent,
    },
  });
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
}

export function requireRoles(...roles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    next();
  };
}

export function requireMinRole(minRole: UserRole) {
  const roleHierarchy: Record<UserRole, number> = {
    STAFF: 1,
    SENIOR: 2,
    MANAGER: 3,
    EQCR: 4,
    PARTNER: 5,
    FIRM_ADMIN: 6,
    SUPER_ADMIN: 99,
  };

  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    if (req.user.role === "FIRM_ADMIN") {
      return next();
    }

    const userLevel = roleHierarchy[req.user.role];
    const requiredLevel = roleHierarchy[minRole];

    if (userLevel < requiredLevel) {
      return res.status(403).json({ error: "Insufficient role level" });
    }
    next();
  };
}

export async function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next();
  }

  const token = authHeader.substring(7);
  const session = await validateSession(token);

  if (session) {
    req.user = session.user;
    req.session = { id: session.id, token: session.token };
  }

  next();
}
