import type { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "../auth";
import type { UserRole } from "@prisma/client";

const ROLE_HIERARCHY: Record<string, number> = {
  STAFF: 1,
  SENIOR: 2,
  TEAM_LEAD: 3,
  MANAGER: 4,
  PARTNER: 5,
  MANAGING_PARTNER: 5,
  EQCR: 6,
  ADMIN: 7,
  FIRM_ADMIN: 8,
  SUPER_ADMIN: 99,
};

export function requireSuperAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  if (req.user.role !== "SUPER_ADMIN") {
    return res.status(403).json({ error: "Super Admin access required" });
  }
  next();
}

export function requireFirmAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  if (req.user.role === "SUPER_ADMIN") {
    return res.status(403).json({ error: "Platform administrators cannot access tenant resources" });
  }
  if (req.user.role !== "FIRM_ADMIN") {
    return res.status(403).json({ error: "Firm Admin access required" });
  }
  next();
}

export function requirePlatformOrFirmAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  if (req.user.role === "SUPER_ADMIN") {
    return res.status(403).json({ error: "Platform administrators cannot access tenant resources" });
  }
  const allowedRoles = ["FIRM_ADMIN", "ADMIN"];
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

export function requireMinRoleLevel(minRole: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (req.user.role === "SUPER_ADMIN") {
      return res.status(403).json({ error: "Platform administrators cannot access tenant resources" });
    }

    const userLevel = ROLE_HIERARCHY[req.user.role] || 0;
    const requiredLevel = ROLE_HIERARCHY[minRole] || 0;

    if (userLevel < requiredLevel) {
      return res.status(403).json({ error: "Insufficient role level" });
    }
    next();
  };
}

export function getRoleLevel(role: string): number {
  return ROLE_HIERARCHY[role] || 0;
}

export function isSuperAdmin(role: string): boolean {
  return role === "SUPER_ADMIN";
}

export function isFirmAdmin(role: string): boolean {
  return role === "FIRM_ADMIN";
}
