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

function getKey(req: Request): string {
  const userId = (req as any).user?.id;
  if (userId) return `user:${userId}`;
  return `ip:${req.ip || req.socket.remoteAddress || "unknown"}`;
}

export function rateLimit(options: {
  name: string;
  windowMs: number;
  maxRequests: number;
  message?: string;
}) {
  const { name, windowMs, maxRequests, message } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    const store = getStore(name);
    const key = getKey(req);
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

export const aiRateLimit = rateLimit({
  name: "ai",
  windowMs: 60 * 1000,
  maxRequests: 20,
  message: "AI request limit exceeded. Please wait before making another request.",
});

export const authRateLimit = rateLimit({
  name: "auth",
  windowMs: 15 * 60 * 1000,
  maxRequests: 15,
  message: "Too many login attempts. Please try again in 15 minutes.",
});

export const apiRateLimit = rateLimit({
  name: "api",
  windowMs: 60 * 1000,
  maxRequests: 200,
  message: "API rate limit exceeded. Please slow down.",
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
