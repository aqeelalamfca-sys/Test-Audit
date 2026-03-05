import type { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "../auth";
import { prisma } from "../db";

export async function withTenantContext<T>(
  firmId: string,
  fn: (tx: typeof prisma) => Promise<T>
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SELECT set_config('app.firm_id', $1, true)`,
      firmId
    );
    return fn(tx as unknown as typeof prisma);
  }, { timeout: 30000 });
}

export async function withPlatformContext<T>(
  fn: (tx: typeof prisma) => Promise<T>
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SELECT set_config('app.platform_bypass', 'true', true)`
    );
    try {
      await tx.$executeRawUnsafe(`SET LOCAL row_security = off`);
    } catch (_e) {
    }
    return fn(tx as unknown as typeof prisma);
  }, { timeout: 30000 });
}

export function setTenantDbContext(req: AuthenticatedRequest, res: Response, next: NextFunction) {
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
  (req as any).withTenantDb = async <T>(fn: (tx: typeof prisma) => Promise<T>): Promise<T> => {
    return withTenantContext(req.user!.firmId!, fn);
  };

  next();
}
