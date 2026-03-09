import type { Request, Response, NextFunction } from "express";

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const stores: Record<string, Map<string, RateLimitEntry>> = {};

function getStore(name: string): Map<string, RateLimitEntry> {
  if (!stores[name]) {
    stores[name] = new Map();
  }
  return stores[name];
}

function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
  return req.ip || req.socket.remoteAddress || "unknown";
}

function getKey(req: Request, keyStrategy: "ip" | "user-or-ip" = "user-or-ip"): string {
  if (keyStrategy === "user-or-ip") {
    const userId = (req as any).user?.id;
    if (userId) return `user:${userId}`;
  }
  return `ip:${getClientIp(req)}`;
}

export function rateLimit(options: {
  name: string;
  windowMs: number;
  maxRequests: number;
  message?: string;
  keyStrategy?: "ip" | "user-or-ip";
}) {
  const { name, windowMs, maxRequests, message, keyStrategy = "user-or-ip" } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    const store = getStore(name);
    const key = getKey(req, keyStrategy);
    const now = Date.now();

    let entry = store.get(key);

    if (!entry || now > entry.resetTime) {
      entry = { count: 0, resetTime: now + windowMs };
      store.set(key, entry);
    }

    entry.count++;

    res.setHeader("X-RateLimit-Limit", maxRequests.toString());
    res.setHeader("X-RateLimit-Remaining", Math.max(0, maxRequests - entry.count).toString());
    res.setHeader("X-RateLimit-Reset", Math.ceil(entry.resetTime / 1000).toString());

    if (entry.count > maxRequests) {
      const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
      res.setHeader("Retry-After", retryAfter.toString());
      return res.status(429).json({
        error: message || "Too many requests. Please try again later.",
        retryAfterSeconds: retryAfter,
      });
    }

    next();
  };
}

export function loginRateLimit() {
  return rateLimit({
    name: "login",
    windowMs: 15 * 60 * 1000,
    maxRequests: 5,
    message: "Too many login attempts. Account temporarily locked. Try again in 15 minutes.",
    keyStrategy: "ip",
  });
}

export const aiRateLimit = rateLimit({
  name: "ai",
  windowMs: 60 * 1000,
  maxRequests: 20,
  message: "AI request limit exceeded. Please wait before making another request.",
});

export const authRateLimit = rateLimit({
  name: "auth",
  windowMs: 15 * 60 * 1000,
  maxRequests: 30,
  message: "Too many authentication requests. Please try again later.",
  keyStrategy: "ip",
});

export const apiRateLimit = rateLimit({
  name: "api",
  windowMs: 60 * 1000,
  maxRequests: 200,
  message: "API rate limit exceeded. Please slow down.",
});

export const globalRateLimit = rateLimit({
  name: "global",
  windowMs: 60 * 1000,
  maxRequests: 100,
  message: "Rate limit exceeded. Please slow down.",
  keyStrategy: "ip",
});

setInterval(() => {
  const now = Date.now();
  for (const store of Object.values(stores)) {
    for (const [key, entry] of store.entries()) {
      if (now > entry.resetTime) {
        store.delete(key);
      }
    }
  }
}, 60 * 1000);
