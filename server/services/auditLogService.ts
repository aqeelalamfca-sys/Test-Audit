import { prisma } from "../db";
import type { Request, Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "../auth";

export interface AuditLogEntry {
  userId: string;
  firmId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  meta?: Record<string, unknown> | null;
}

export async function logPlatformAction(entry: AuditLogEntry): Promise<void> {
  try {
    await prisma.platformAuditLog.create({
      data: {
        userId: entry.userId,
        firmId: entry.firmId || null,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId || null,
        ip: entry.ip || null,
        userAgent: entry.userAgent || null,
        meta: entry.meta || {},
      },
    });
  } catch (error) {
    console.error("[AuditLog] Failed to log platform action:", error);
  }
}

export async function logSecurityEvent(
  action: string,
  ip: string,
  userAgent: string | undefined,
  meta: Record<string, unknown>,
  userId?: string,
  firmId?: string
): Promise<void> {
  try {
    await prisma.platformAuditLog.create({
      data: {
        userId: userId || "system",
        firmId: firmId || null,
        action: `SECURITY_${action}`,
        entity: "security",
        entityId: null,
        ip,
        userAgent: userAgent || null,
        meta,
      },
    });
  } catch (error) {
    console.error("[AuditLog] Failed to log security event:", error);
  }
}

function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
  return req.ip || req.socket.remoteAddress || "unknown";
}

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const SKIP_PATHS = [
  "/api/auth/ping",
  "/api/auth/refresh",
  "/health",
];

export function auditLogMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!WRITE_METHODS.has(req.method)) return next();
  if (SKIP_PATHS.some((p) => req.path === p)) return next();
  if (!req.path.startsWith("/api/")) return next();

  res.on("finish", () => {
    const authReq = req as AuthenticatedRequest;
    if (authReq.user && res.statusCode >= 200 && res.statusCode < 300) {
      const action = `${req.method}_${req.path.replace(/\/api\//g, "").replace(/\//g, "_").replace(/[^a-zA-Z0-9_]/g, "")}`.toUpperCase();

      logPlatformAction({
        userId: authReq.user.id,
        firmId: authReq.user.firmId,
        action,
        entity: req.path.split("/")[2] || "unknown",
        entityId: req.params?.id || null,
        ip: getClientIp(req),
        userAgent: req.get("user-agent"),
        meta: {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
        },
      }).catch(() => {});
    }
  });

  next();
}
