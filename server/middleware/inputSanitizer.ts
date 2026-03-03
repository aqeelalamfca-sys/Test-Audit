import type { Request, Response, NextFunction } from "express";

function sanitizeString(value: string): string {
  return value
    .replace(/\0/g, "")
    .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gi, "");
}

function sanitizeValue(value: unknown): unknown {
  if (typeof value === "string") {
    return sanitizeString(value);
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (value && typeof value === "object") {
    return sanitizeObject(value as Record<string, unknown>);
  }
  return value;
}

function sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const cleanKey = sanitizeString(key);
    result[cleanKey] = sanitizeValue(value);
  }
  return result;
}

export function inputSanitizer(req: Request, _res: Response, next: NextFunction) {
  if (req.body && typeof req.body === "object") {
    req.body = sanitizeObject(req.body);
  }

  if (req.query && typeof req.query === "object") {
    for (const key of Object.keys(req.query)) {
      const val = req.query[key];
      if (typeof val === "string") {
        (req.query as any)[key] = sanitizeString(val);
      }
    }
  }

  next();
}
