import { logger } from "./services/logger";

process.on('uncaughtException', (err) => {
  logger.fatal("Uncaught exception", { source: "process", error: err?.message, stack: err?.stack });
  if (process.env.NODE_ENV !== "production") {
    process.exit(1);
  }
});
process.on('unhandledRejection', (reason) => {
  logger.warn("Unhandled rejection", { source: "process", reason: String(reason) });
});

const isProduction = process.env.NODE_ENV === "production";

if (isProduction) {
  const required = ["DATABASE_URL"];
  const missing = required.filter(v => !process.env[v]);
  if (missing.length > 0) {
    logger.fatal("Missing required environment variables", { source: "startup", missing });
    process.exit(1);
  }
  if (!process.env.SESSION_SECRET) {
    const { randomBytes } = require("crypto");
    process.env.SESSION_SECRET = randomBytes(32).toString("hex");
    logger.warn("SESSION_SECRET not set, using auto-generated value. Sessions will not persist across restarts.", { source: "startup" });
  }
  if (!process.env.JWT_SECRET) {
    const { randomBytes } = require("crypto");
    process.env.JWT_SECRET = randomBytes(32).toString("hex");
    logger.warn("JWT_SECRET not set, using auto-generated value. Tokens will not persist across restarts.", { source: "startup" });
  }
}

import { validateDatabaseEnv } from "./db";
const envCheck = validateDatabaseEnv();
if (!envCheck.valid) {
  logger.error("Database configuration error", { source: "startup", errors: envCheck.errors, hint: "DATABASE_URL=postgresql://user:pass@host:5432/dbname" });
  if (isProduction) process.exit(1);
}
envCheck.warnings.forEach(w => logger.warn(w, { source: "env" }));

import express, { type Request, Response, NextFunction } from "express";
import path from "path";
import { registerRoutes } from "./routes";
import { registerDeploymentRoutes } from "./deploymentRoutes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { seedPermissions } from "./seedPermissions";
import { seedTestUsers } from "./seeds/seedUsers";
import { seedInitialAdmin } from "./seeds/seedInitialAdmin";
import { seedTemplates } from "./seeds/seedTemplates";
import { seedSuperAdmin } from "./seeds/seedSuperAdmin";
import { seedPlans } from "./seeds/seedPlans";
import { enableRLS } from "./scripts/enable-rls";
import platformRoutes from "./routes/platformRoutes";
import systemHealthRoutes from "./routes/systemHealthRoutes";
import tenantRoutes from "./routes/tenantRoutes";
import { globalRateLimit } from "./middleware/rateLimiter";
import { superAdminIpGuard } from "./middleware/superAdminIpAllowlist";
import { auditLogMiddleware } from "./services/auditLogService";
import logsRoutes from "./logsRoutes";
import workspaceRoutes from "./workspaceRoutes";
import prePlanningRoutes from "./prePlanningRoutes";
import glRoutes from "./glRoutes";
import tbRoutes from "./tbRoutes";
import fsRoutes from "./fsRoutes";
import materialityRoutes from "./materialityRoutes";
import syncRoutes from "./syncRoutes";
import progressRoutes from "./progressRoutes";
import isaComplianceRoutes from "./routes/isaComplianceRoutes";
import auditHealthRoutes from "./routes/auditHealthRoutes";
import aiCopilotRoutes from "./routes/aiCopilotRoutes";
import templateRoutes from "./templateRoutes";
import importRoutes from "./importRoutes";
import riskProcedureMappingRoutes from "./routes/riskProcedureMappingRoutes";
import auditGovernanceRoutes from "./routes/auditGovernanceRoutes";
import impactRoutes from "./impactRoutes";
import notesRoutes from "./notesRoutes";
import aiRoutes from "./aiRoutes";
import aiSuggestRoutes from "./routes/ai-suggest";
import preplanningAiRoutes from "./routes/preplanning-ai";

import compression from "compression";
import cookieParser from "cookie-parser";
import { prisma, withRetry, getDbStatus, setDbStatus, waitForDatabase } from "./db";

const app = express();
const httpServer = createServer(app);

app.set("trust proxy", 1);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

const AUTH_DEBUG = process.env.AUTH_DEBUG === "true";

app.use(cookieParser());

import { randomUUID } from "crypto";
app.use((req: Request, res: Response, next: NextFunction) => {
  const requestId = (req.headers["x-request-id"] as string) || randomUUID();
  res.setHeader("X-Request-Id", requestId);
  (req as any).requestId = requestId;
  next();
});

app.use(
  express.json({
    limit: '50mb',
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false, limit: '50mb' }));

import { inputSanitizer } from "./middleware/inputSanitizer";
app.use(inputSanitizer);

app.use(auditLogMiddleware);

import { useS3, getFile as getStorageFile } from "./services/storageService";

if (useS3()) {
  app.use("/uploads", async (req: Request, res: Response, next: NextFunction) => {
    const s3Key = `uploads${req.path}`;
    try {
      const file = await getStorageFile(s3Key);
      res.setHeader("X-Content-Type-Options", "nosniff");
      if (file.contentType) res.setHeader("Content-Type", file.contentType);
      if (file.contentLength) res.setHeader("Content-Length", file.contentLength.toString());
      res.setHeader("Cache-Control", "public, max-age=86400");
      file.stream.pipe(res);
    } catch {
      next();
    }
  });
} else {
  app.use("/uploads/logos", express.static(path.join(process.cwd(), "uploads", "logos"), {
    setHeaders: (res) => {
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'");
    },
  }));

  app.use("/uploads/notifications", express.static(path.join(process.cwd(), "uploads", "notifications"), {
    setHeaders: (res) => {
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    },
  }));
}

app.use(compression());

app.use((_req: Request, res: Response, next: NextFunction) => {
  res.removeHeader("X-Powered-By");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()");
  res.setHeader("X-DNS-Prefetch-Control", "off");
  res.setHeader("X-Download-Options", "noopen");
  res.setHeader("X-Permitted-Cross-Domain-Policies", "none");
  if (isProduction) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
    res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  }
  next();
});

app.use(superAdminIpGuard);

app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.path.startsWith("/api/")) {
    return globalRateLimit(req, res, next);
  }
  next();
});

app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.method === 'GET' && req.path.startsWith('/api/') && !req.path.includes('/auth/')) {
    res.setHeader('Cache-Control', 'private, max-age=30');
  }
  next();
});

app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin;
  if (origin) {
    const allowedOrigins = process.env.CORS_ORIGINS?.split(",").map(o => o.trim()).filter(Boolean);
    if (!isProduction || (allowedOrigins && allowedOrigins.length > 0 && allowedOrigins.includes(origin))) {
      res.setHeader("Access-Control-Allow-Origin", origin);
    }
  }
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Active-Client-Id, X-Active-Period-Id");
  
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  next();
});

app.get("/__healthz", (_req: Request, res: Response) => {
  res.status(200).send("OK");
});

app.get("/api/health", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    service: "auditwise-api",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
    version: process.env.APP_VERSION || "1.0.0",
    memory: {
      rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
      heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
    },
    node: process.version,
  });
});

app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.version
  });
});

// Full health check with DB ping and diagnostics
app.get("/api/health/full", async (_req: Request, res: Response) => {
  const startTime = Date.now();
  const results: {
    status: string;
    timestamp: string;
    uptime: number;
    memory: NodeJS.MemoryUsage;
    nodeVersion: string;
    checks: {
      database: { status: string; responseTime: number; error?: string };
      env: { status: string; missing: string[] };
    };
  } = {
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    nodeVersion: process.version,
    checks: {
      database: { status: "unknown", responseTime: 0 },
      env: { status: "ok", missing: [] },
    },
  };

  // Check environment variables
  const requiredEnvVars = ["DATABASE_URL"];
  const missingEnv = requiredEnvVars.filter((v) => !process.env[v]);
  if (missingEnv.length > 0) {
    results.checks.env = { status: "warning", missing: missingEnv };
    results.status = "degraded";
  }

  // Check database connection with timeout
  const dbStart = Date.now();
  try {
    const dbPromise = prisma.$queryRaw`SELECT 1 as ping`;
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("DB_TIMEOUT")), 2000)
    );
    await Promise.race([dbPromise, timeoutPromise]);
    results.checks.database = {
      status: "ok",
      responseTime: Date.now() - dbStart,
    };
  } catch (error: any) {
    results.checks.database = {
      status: "error",
      responseTime: Date.now() - dbStart,
      error: error.message === "DB_TIMEOUT" ? "Database timeout (>2s)" : error.message,
    };
    results.status = "unhealthy";
  }

  const totalTime = Date.now() - startTime;
  res.status(results.status === "unhealthy" ? 503 : 200).json({
    ...results,
    totalResponseTime: totalTime,
  });
});

app.get("/api/system/status", (_req: Request, res: Response) => {
  const status = getDbStatus();
  const isReady = status.state === "ready";
  const safeMessages: Record<string, string> = {
    initializing: "System starting up",
    connecting: "Connecting to database",
    ready: "System operational",
    error: "Database connection issue",
    reconnecting: "Attempting to reconnect",
  };
  res.status(isReady ? 200 : 503).json({
    ready: isReady,
    database: {
      state: status.state,
      message: safeMessages[status.state] || "System busy",
      lastCheck: status.lastCheck,
      retryCount: status.retryCount,
    },
    timestamp: new Date().toISOString(),
  });
});

// AUTH DEBUG logging middleware
if (AUTH_DEBUG) {
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path.includes("/auth") || req.path.includes("/access")) {
      const start = Date.now();
      const authHeader = req.headers.authorization;
      const hasCookie = !!req.cookies?.session_token;
      const hasToken = !!authHeader?.startsWith("Bearer ");
      
      console.log(`[AUTH_DEBUG] START ${req.method} ${req.path} | cookie:${hasCookie} token:${hasToken}`);
      
      res.on("finish", () => {
        const duration = Date.now() - start;
        console.log(`[AUTH_DEBUG] END ${req.method} ${req.path} ${res.statusCode} in ${duration}ms`);
      });
    }
    next();
  });
}

export function log(message: string, source = "express") {
  logger.info(message, { source });
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      logger.info("HTTP request", { source: "express", method: req.method, path, statusCode: res.statusCode, durationMs: duration });
    }
  });

  next();
});

import { verifyAccessToken } from "./auth";

const SUPER_ADMIN_ALLOWED_PREFIXES = [
  "/api/platform",
  "/api/auth",
  "/api/health",
  "/api/system",
  "/api/logs",
  "/__healthz",
  "/health",
  "/uploads",
];

app.use((req: Request, res: Response, next: NextFunction) => {
  if (!req.path.startsWith("/api/") || req.path.startsWith("/api/platform") || req.path.startsWith("/api/auth") || req.path.startsWith("/api/health") || req.path.startsWith("/api/logs") || req.path.startsWith("/api/system")) {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next();
  }

  const token = authHeader.split(" ")[1];
  const payload = verifyAccessToken(token);
  if (payload && payload.role === "SUPER_ADMIN") {
    return res.status(403).json({ error: "Platform administrators cannot access tenant data" });
  }

  next();
});

(async () => {
  await registerRoutes(httpServer, app);
  registerDeploymentRoutes(app);
  
  // Register logs routes (public access for debugging)
  app.use("/api/logs", logsRoutes);
  
  // Register workspace routes (RBAC-filtered engagement access)
  app.use("/api/workspace", workspaceRoutes);
  
  // Register Pre-Planning routes (engagement setup, acceptance, independence)
  app.use("/api/pre-planning", prePlanningRoutes);
  
  // Register GL routes (general ledger upload and management)
  app.use("/api/gl", glRoutes);
  
  // Register TB routes (trial balance generation, upload, and reconciliation)
  app.use("/api/tb", tbRoutes);
  
  // Register FS routes (financial statement builder with AI-assisted mapping)
  app.use("/api/fs", fsRoutes);
  
  app.use("/api/materiality", materialityRoutes);
  app.use("/api/sync", syncRoutes);
  app.use("/api/progress", progressRoutes);
  app.use("/api/isa-compliance", isaComplianceRoutes);
  app.use("/api/audit-health", auditHealthRoutes);
  app.use("/api/ai/copilot", aiCopilotRoutes);
  app.use("/api/ai", aiRoutes);
  app.use("/api/ai/suggest", aiSuggestRoutes);
  app.use("/api/ai/preplanning", preplanningAiRoutes);

  app.use("/api/templates", templateRoutes);
  app.use("/api/import", importRoutes);
  app.use("/api/risk-procedure", riskProcedureMappingRoutes);
  app.use("/api/governance", auditGovernanceRoutes);
  app.use("/api/impacts", impactRoutes);
  app.use("/api/notes", notesRoutes);

  // Multi-tenant platform & tenant routes
  app.use("/api/platform", platformRoutes);
  app.use("/api/platform", systemHealthRoutes);
  app.use("/api/tenant", tenantRoutes);
  
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const errMsg = String(err.message || "");
    const errCode = String(err.code || err.errorCode || "");
    const errMsgLower = errMsg.toLowerCase();

    const prismaConnCodes = ["P1001", "P1002", "P1008", "P1017"];
    const isDbError =
      prismaConnCodes.some(c => errCode.includes(c) || errMsg.includes(c)) ||
      errMsgLower.includes("can't reach database") ||
      errMsgLower.includes("econnrefused") ||
      errMsgLower.includes("password authentication failed") ||
      errMsgLower.includes("connection refused") ||
      errMsgLower.includes("connection reset") ||
      errMsgLower.includes("connection closed");

    let message: string;
    if (isDbError) {
      message = "Database connection error. The system is attempting to reconnect.";
      logger.error("Database connection error", { source: "express", detail: errMsgLower.substring(0, 200) });
    } else if (status >= 500 && isProduction) {
      message = "Internal Server Error";
    } else {
      message = errMsg || "Internal Server Error";
    }

    res.status(isDbError ? 503 : status).json({
      message,
      ...(isDbError ? { code: "DB_UNAVAILABLE" } : {}),
    });
    if (status >= 500 && !isDbError) {
      logger.error("Express error", { source: "express", error: errMsg, code: errCode });
    }
  });

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  const host = "0.0.0.0";

  httpServer.listen(port, host, () => {
    log(`serving on ${host}:${port}`);
  });

  (async () => {
    const dbReady = await waitForDatabase(90);
    if (!dbReady) {
      logger.error("Database not available. Server is running in degraded mode.", { source: "startup" });
      logger.error("Check DATABASE_URL and ensure PostgreSQL is running.", { source: "startup" });
      logger.error("Seeding and RLS will be skipped. Only health/status endpoints are functional.", { source: "startup" });
      setDbStatus({ state: "error", message: "Database unavailable" });

      const reconnectInterval = setInterval(async () => {
        try {
          await prisma.$queryRaw`SELECT 1`;
          setDbStatus({ state: "ready", message: "Database connection restored", retryCount: 0 });
          logger.info("Database connection restored. Restart the application to complete initialization.", { source: "startup" });
          clearInterval(reconnectInterval);
        } catch (err) { console.error("Database reconnection attempt failed:", err); }
      }, 15000);
      return;
    }

    const seedKeepalive = setInterval(async () => {
      try { await prisma.$queryRaw`SELECT 1`; } catch (err) { console.error("Seed keepalive ping failed:", err); }
    }, 10000);

    try {
      await seedPermissions();
      logger.info("Permissions seeded successfully", { source: "startup" });
    } catch (err) {
      logger.error("Failed to seed permissions", { source: "startup", error: String(err) });
    }

    try {
      await seedSuperAdmin();
      logger.info("SuperAdmin seeded successfully", { source: "startup" });
    } catch (err) {
      logger.error("Failed to seed SuperAdmin", { source: "startup", error: String(err) });
    }

    try {
      const firmsCleaned = await prisma.$executeRawUnsafe(`
        UPDATE "Firm" SET 
          name = REPLACE(REPLACE(REPLACE(name, '&amp;', '&'), '&lt;', '<'), '&gt;', '>'),
          "displayName" = REPLACE(REPLACE(REPLACE(COALESCE("displayName",''), '&amp;', '&'), '&lt;', '<'), '&gt;', '>')
        WHERE name LIKE '%&amp;%' OR name LIKE '%&lt;%' OR name LIKE '%&gt;%'
          OR "displayName" LIKE '%&amp;%' OR "displayName" LIKE '%&lt;%' OR "displayName" LIKE '%&gt;%'
      `);
      const clientsCleaned = await prisma.$executeRawUnsafe(`
        UPDATE "Client" SET 
          name = REPLACE(REPLACE(REPLACE(name, '&amp;', '&'), '&lt;', '<'), '&gt;', '>'),
          "tradingName" = REPLACE(REPLACE(REPLACE(COALESCE("tradingName",''), '&amp;', '&'), '&lt;', '<'), '&gt;', '>')
        WHERE name LIKE '%&amp;%' OR name LIKE '%&lt;%' OR name LIKE '%&gt;%'
          OR "tradingName" LIKE '%&amp;%' OR "tradingName" LIKE '%&lt;%' OR "tradingName" LIKE '%&gt;%'
      `);
      if (firmsCleaned > 0 || clientsCleaned > 0) {
        logger.info("Cleaned HTML entities", { source: "startup", firmsCleaned, clientsCleaned });
      }
    } catch (err) {
      logger.error("Failed to clean HTML entities", { source: "startup", error: String(err) });
    }

    try {
      await seedPlans();
      logger.info("Plans seeded successfully", { source: "startup" });
    } catch (err) {
      logger.error("Failed to seed plans", { source: "startup", error: String(err) });
    }

    if (isProduction) {
      try {
        await seedInitialAdmin();
      } catch (err) {
        logger.error("Failed to seed initial admin", { source: "startup", error: String(err) });
      }
    } else {
      try {
        await seedTestUsers();
      } catch (err) {
        logger.error("Failed to seed test users", { source: "startup", error: String(err) });
      }

      try {
        const { seedDemoData } = await import("./seeds/seedDemoData");
        await seedDemoData();
        logger.info("Demo data seeded successfully", { source: "startup" });
      } catch (err) {
        logger.error("Failed to seed demo data", { source: "startup", error: String(err) });
      }
    }

    try {
      await seedTemplates();
      logger.info("Standard templates seeded successfully", { source: "startup" });
    } catch (err) {
      logger.error("Failed to seed templates", { source: "startup", error: String(err) });
    }

    try {
      const rlsResult = await enableRLS();
      logger.info("RLS enabled", { source: "rls", enabled: rlsResult.enabled, skipped: rlsResult.skipped });
      if (rlsResult.errors.length > 0) {
        logger.warn("RLS errors", { source: "rls", errors: rlsResult.errors });
      }
    } catch (err) {
      logger.error("Failed to enable row-level security", { source: "rls", error: String(err) });
    }

    clearInterval(seedKeepalive);

    const keepaliveInterval = setInterval(async () => {
      try {
        await withRetry(() => prisma.$queryRaw`SELECT 1`);
        const currentStatus = getDbStatus();
        if (currentStatus.state !== "ready") {
          setDbStatus({ state: "ready", message: "Database connection restored", retryCount: 0 });
          logger.info("Database connection restored", { source: "keepalive" });
        }
      } catch (e: any) {
        const currentStatus = getDbStatus();
        if (currentStatus.state === "ready") {
          setDbStatus({ state: "reconnecting", message: "Database connection lost — attempting reconnection" });
          logger.error("DB ping failed, entering reconnection mode", { source: "keepalive", error: e?.message?.substring(0, 100) });
        }
      }
    }, 30000);

    const { enforceSubscriptionLifecycle, processScheduledInvoices, deleteExpiredTrialFirms } = await import("./services/billingService");
    const runBillingCycle = async () => {
      try {
        const lifecycle = await enforceSubscriptionLifecycle();
        const invoicing = await processScheduledInvoices();
        const trialCleanup = await deleteExpiredTrialFirms();
        if (lifecycle.trialExpired || lifecycle.movedToGrace || lifecycle.suspended || lifecycle.overdueInvoices || invoicing.generated || trialCleanup.deleted) {
          logger.info("Billing cycle completed", { source: "billing", ...lifecycle, ...invoicing, trialDeleted: trialCleanup.deleted });
        }
      } catch (err) {
        logger.error("Billing cycle error", { source: "billing", error: String(err) });
      }
    };
    await runBillingCycle();
    const billingInterval = setInterval(runBillingCycle, 60 * 60 * 1000);

    let isShuttingDown = false;
    const shutdown = async (signal: string) => {
      if (isShuttingDown) return;
      isShuttingDown = true;
      logger.info(`Received ${signal}, draining connections...`, { source: "shutdown" });
      clearInterval(keepaliveInterval);
      clearInterval(billingInterval);
      
      httpServer.close(async () => {
        logger.info("HTTP server closed, disconnecting database...", { source: "shutdown" });
        await prisma.$disconnect();
        logger.info("Clean shutdown complete.", { source: "shutdown" });
        process.exit(0);
      });
      
      setTimeout(() => {
        logger.error("Forced exit after 15s drain timeout.", { source: "shutdown" });
        process.exit(1);
      }, 15000).unref();
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  })();
})();
