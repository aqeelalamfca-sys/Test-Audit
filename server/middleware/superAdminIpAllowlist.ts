import { Request, Response, NextFunction } from "express";

function getAllowedIps(): string[] {
  const raw = process.env.SUPER_ADMIN_ALLOWED_IPS || "";
  return raw
    .split(",")
    .map((ip) => ip.trim())
    .filter(Boolean);
}

function getClientIp(req: Request): string {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  return ip.replace(/^::ffff:/, "");
}

function isIpAllowed(clientIp: string, allowedIps: string[]): boolean {
  const normalized = clientIp.replace(/^::ffff:/, "");
  return allowedIps.some((ip) => {
    return normalized === ip.replace(/^::ffff:/, "").trim();
  });
}

export function superAdminIpGuard(req: Request, res: Response, next: NextFunction) {
  const allowedIps = getAllowedIps();
  if (allowedIps.length === 0) {
    return next();
  }

  let isSuperAdmin = false;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    try {
      const { verifyAccessToken } = require("../auth");
      const token = authHeader.split(" ")[1];
      const payload = verifyAccessToken(token);
      if (payload && payload.role === "SUPER_ADMIN") {
        isSuperAdmin = true;
      }
    } catch {}
  }

  if (!isSuperAdmin && (req as any).session?.passport?.user) {
    try {
      const sessionUser = (req as any).user;
      if (sessionUser && sessionUser.role === "SUPER_ADMIN") {
        isSuperAdmin = true;
      }
    } catch {}
  }

  if (!isSuperAdmin) {
    return next();
  }

  const clientIp = getClientIp(req);
  if (isIpAllowed(clientIp, allowedIps)) {
    return next();
  }

  console.warn(
    `[SECURITY] Super Admin access denied from IP ${clientIp}. Allowed: ${allowedIps.join(", ")}`
  );
  return res.status(403).json({
    error: "Access denied. Super Admin login is restricted to authorized network locations.",
    code: "IP_NOT_ALLOWED",
  });
}

export function checkSuperAdminIpAtLogin(clientIp: string): { allowed: boolean; reason?: string } {
  const allowedIps = getAllowedIps();
  if (allowedIps.length === 0) {
    return { allowed: true };
  }

  if (isIpAllowed(clientIp, allowedIps)) {
    return { allowed: true };
  }

  console.warn(
    `[SECURITY] Super Admin login blocked from IP ${clientIp}. Allowed: ${allowedIps.join(", ")}`
  );
  return {
    allowed: false,
    reason: "Super Admin login is restricted to authorized network locations.",
  };
}
