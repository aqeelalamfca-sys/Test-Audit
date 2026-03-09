import type { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "../auth";
import { prisma } from "../db";

export function blockSuperAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  if (req.user.role === "SUPER_ADMIN") {
    return res.status(403).json({ error: "Platform administrators cannot access tenant data" });
  }
  next();
}

export function requireTenantScope(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }

  if (req.user.role === "SUPER_ADMIN") {
    return res.status(403).json({ error: "Platform administrators cannot access tenant data" });
  }

  if (!req.user.firmId) {
    return res.status(403).json({ error: "User not associated with a firm" });
  }

  next();
}

export function enforceFirmScope(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }

  if (req.user.role === "SUPER_ADMIN") {
    return res.status(403).json({ error: "Platform administrators cannot access tenant data" });
  }

  if (!req.user.firmId) {
    return res.status(403).json({ error: "No firm context available" });
  }

  (req as any).firmId = req.user.firmId;
  next();
}

export function getFirmIdFromRequest(req: AuthenticatedRequest): string | null {
  if (req.user?.role === "SUPER_ADMIN") {
    return null;
  }
  return req.user?.firmId || null;
}

export async function validateFirmAccess(req: AuthenticatedRequest, firmId: string): Promise<boolean> {
  if (!req.user) return false;
  if (req.user.role === "SUPER_ADMIN") return false;
  return req.user.firmId === firmId;
}
