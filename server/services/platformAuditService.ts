import { prisma } from "../db";
import type { AuthenticatedRequest } from "../auth";

export async function logPlatformAction(
  userId: string,
  action: string,
  entity: string,
  entityId?: string,
  firmId?: string | null,
  ip?: string,
  userAgent?: string,
  meta?: any
) {
  try {
    await prisma.platformAuditLog.create({
      data: {
        userId,
        action,
        entity,
        entityId,
        firmId: firmId || undefined,
        ip,
        userAgent,
        meta,
      },
    });
  } catch (error) {
    console.error("Failed to log platform action:", error);
  }
}

export function extractRequestMeta(req: AuthenticatedRequest) {
  return {
    ip: req.ip || req.socket?.remoteAddress || "unknown",
    userAgent: req.get("user-agent") || "unknown",
  };
}
