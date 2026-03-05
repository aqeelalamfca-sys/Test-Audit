import type { Request, Response, NextFunction } from "express";

const SQL_INJECTION_PATTERNS = [
  /(\b(union|select|insert|update|delete|drop|alter|create|exec|execute)\b\s+(all\s+)?)/gi,
  /(-{2}|\/\*|\*\/|;--)/g,
  /(\bor\b\s+\d+\s*=\s*\d+)/gi,
  /(\band\b\s+\d+\s*=\s*\d+)/gi,
  /('\s*(or|and)\s+')/gi,
];

const XSS_PATTERNS = [
  /<script\b[^>]*>([\s\S]*?)<\/script>/gi,
  /javascript\s*:/gi,
  /on\w+\s*=\s*["'][^"']*["']/gi,
  /on\w+\s*=\s*[^\s>]+/gi,
  /<iframe\b[^>]*>([\s\S]*?)<\/iframe>/gi,
  /<object\b[^>]*>([\s\S]*?)<\/object>/gi,
  /<embed\b[^>]*>/gi,
  /<link\b[^>]*>/gi,
  /expression\s*\(/gi,
  /url\s*\(\s*["']?\s*javascript/gi,
  /data\s*:\s*text\/html/gi,
  /<svg\b[^>]*onload/gi,
  /<img\b[^>]*onerror/gi,
];

const PATH_TRAVERSAL_PATTERNS = [
  /\.\.\//g,
  /\.\.\\+/g,
  /%2e%2e/gi,
  /%252e%252e/gi,
];

function sanitizeString(value: string, isPasswordField: boolean = false): string {
  if (isPasswordField) {
    return value.replace(/\0/g, "");
  }

  let cleaned = value.replace(/\0/g, "");

  for (const pattern of XSS_PATTERNS) {
    cleaned = cleaned.replace(pattern, "");
  }

  cleaned = cleaned
    .replace(/&(?!amp;|lt;|gt;|quot;|#39;)/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  for (const pattern of PATH_TRAVERSAL_PATTERNS) {
    cleaned = cleaned.replace(pattern, "");
  }

  return cleaned;
}

function detectSqlInjection(value: string): boolean {
  for (const pattern of SQL_INJECTION_PATTERNS) {
    if (pattern.test(value)) {
      pattern.lastIndex = 0;
      return true;
    }
    pattern.lastIndex = 0;
  }
  return false;
}

const PASSWORD_FIELDS = new Set(["password", "currentPassword", "newPassword", "confirmPassword", "passwordHash"]);
const CONTENT_FIELDS = new Set([
  "message", "title", "description", "content", "notes", "comment", "body",
  "youtubeUrl", "imageUrl", "url", "link", "topic", "memo", "narrative",
  "explanation", "recommendation", "finding", "observation", "response",
  "rationale", "conclusion", "summary", "detail", "reason", "text",
  "name", "tradingName", "entityType", "industry", "address", "city",
  "ntn", "strn", "secpNo", "email", "phone", "sizeClassification",
  "ownershipStructure", "regulatoryCategory", "taxProfile", "lifecycleStatus",
  "specialEntityType", "priorAuditor", "priorAuditorEmail", "priorAuditorPhone",
  "priorAuditorAddress", "priorAuditOpinion", "udin", "engagementCode",
  "reportingFramework", "firstName", "lastName", "designation", "label",
  "clientName", "firmName", "companyName", "legalName",
]);

function checkSqlInjectionDeep(value: unknown, key?: string): boolean {
  if (typeof value === "string" && key && !PASSWORD_FIELDS.has(key) && !CONTENT_FIELDS.has(key)) {
    return detectSqlInjection(value);
  }
  if (Array.isArray(value)) {
    return value.some((v) => checkSqlInjectionDeep(v));
  }
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (checkSqlInjectionDeep(v, k)) return true;
    }
  }
  return false;
}

function sanitizeValue(value: unknown, key?: string): unknown {
  if (typeof value === "string") {
    const isPassword = key ? PASSWORD_FIELDS.has(key) : false;
    return sanitizeString(value, isPassword);
  }
  if (Array.isArray(value)) {
    return value.map((v) => sanitizeValue(v));
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
    result[cleanKey] = sanitizeValue(value, key);
  }
  return result;
}

export function inputSanitizer(req: Request, res: Response, next: NextFunction) {
  if (req.body && typeof req.body === "object") {
    const bodyStr = JSON.stringify(req.body);

    if (bodyStr.length > 10 * 1024 * 1024) {
      return res.status(413).json({ error: "Request body too large" });
    }

    if (checkSqlInjectionDeep(req.body)) {
      console.warn(`[SECURITY] Potential SQL injection blocked from IP ${req.ip} on ${req.path}`);
      return res.status(400).json({ error: "Invalid input detected" });
    }

    req.body = sanitizeObject(req.body);
  }

  if (req.query && typeof req.query === "object") {
    for (const key of Object.keys(req.query)) {
      const val = req.query[key];
      if (typeof val === "string") {
        if (detectSqlInjection(val)) {
          console.warn(`[SECURITY] Potential SQL injection in query param blocked from IP ${req.ip}: ${key}`);
          return res.status(400).json({ error: "Invalid input detected" });
        }
        (req.query as any)[key] = sanitizeString(val);
      }
    }
  }

  if (req.params) {
    for (const key of Object.keys(req.params)) {
      const val = req.params[key];
      if (typeof val === "string") {
        for (const pattern of PATH_TRAVERSAL_PATTERNS) {
          if (pattern.test(val)) {
            pattern.lastIndex = 0;
            console.warn(`[SECURITY] Path traversal attempt blocked from IP ${req.ip}: ${key}=${val}`);
            return res.status(400).json({ error: "Invalid input detected" });
          }
          pattern.lastIndex = 0;
        }
      }
    }
  }

  next();
}
