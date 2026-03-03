process.on('uncaughtException', (err) => {
  console.error('[CRASH] Uncaught exception:', err);
  if (process.env.NODE_ENV !== "production") {
    process.exit(1);
  }
});
process.on('unhandledRejection', (reason) => {
  console.error('[WARN] Unhandled rejection:', reason);
});

const isProduction = process.env.NODE_ENV === "production";

if (isProduction) {
  const required = ["DATABASE_URL"];
  const missing = required.filter(v => !process.env[v]);
  if (missing.length > 0) {
    console.error(`FATAL: Missing required environment variables: ${missing.join(", ")}`);
    process.exit(1);
  }
  if (!process.env.SESSION_SECRET) {
    const { randomBytes } = require("crypto");
    process.env.SESSION_SECRET = randomBytes(32).toString("hex");
    console.warn("WARNING: SESSION_SECRET not set, using auto-generated value. Sessions will not persist across restarts.");
  }
  if (!process.env.JWT_SECRET) {
    const { randomBytes } = require("crypto");
    process.env.JWT_SECRET = randomBytes(32).toString("hex");
    console.warn("WARNING: JWT_SECRET not set, using auto-generated value. Tokens will not persist across restarts.");
  }
}

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
import tenantRoutes from "./routes/tenantRoutes";
import { globalRateLimit } from "./middleware/rateLimiter";
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
import { prisma, withRetry } from "./db";

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

app.use("/uploads/logos", express.static(path.join(process.cwd(), "uploads", "logos"), {
  setHeaders: (res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'");
  },
}));

app.use(compression());

if (isProduction) {
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
    res.removeHeader("X-Powered-By");
    next();
  });
} else {
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.removeHeader("X-Powered-By");
    next();
  });
}

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

// Health check endpoint - accessible even if app has errors (NO AUTH, NO DB)
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
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      log(`${req.method} ${path} ${res.statusCode} in ${duration}ms`);
    }
  });

  next();
});

import { verifyAccessToken } from "./auth";

const SUPER_ADMIN_ALLOWED_PREFIXES = [
  "/api/platform",
  "/api/auth",
  "/api/health",
  "/__healthz",
  "/health",
  "/uploads",
];

app.use((req: Request, res: Response, next: NextFunction) => {
  if (!req.path.startsWith("/api/") || req.path.startsWith("/api/platform") || req.path.startsWith("/api/auth") || req.path.startsWith("/api/health") || req.path.startsWith("/api/logs")) {
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
  app.use("/api/tenant", tenantRoutes);
  
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = status >= 500 && isProduction
      ? "Internal Server Error"
      : (err.message || "Internal Server Error");

    res.status(status).json({ message });
    if (status >= 500) {
      console.error("[EXPRESS ERROR]", err);
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
    const seedKeepalive = setInterval(async () => {
      try { await prisma.$queryRaw`SELECT 1`; } catch (_) {}
    }, 10000);

    try {
      await seedPermissions();
      console.log("Permissions seeded successfully");
    } catch (err) {
      console.error("Failed to seed permissions:", err);
    }

    try {
      await seedSuperAdmin();
      console.log("SuperAdmin seeded successfully");
    } catch (err) {
      console.error("Failed to seed SuperAdmin:", err);
    }

    try {
      await seedPlans();
      console.log("Plans seeded successfully");
    } catch (err) {
      console.error("Failed to seed plans:", err);
    }

    if (isProduction) {
      try {
        await seedInitialAdmin();
      } catch (err) {
        console.error("Failed to seed initial admin:", err);
      }
    } else {
      try {
        await seedTestUsers();
      } catch (err) {
        console.error("Failed to seed test users:", err);
      }

      try {
        const { seedDemoData } = await import("./seeds/seedDemoData");
        await seedDemoData();
        console.log("Demo data seeded successfully");
      } catch (err) {
        console.error("Failed to seed demo data:", err);
      }
    }

    try {
      await seedTemplates();
      console.log("Standard templates seeded successfully");
    } catch (err) {
      console.error("Failed to seed templates:", err);
    }

    try {
      const rlsResult = await enableRLS();
      console.log(`[RLS] Enabled on ${rlsResult.enabled} tables, skipped ${rlsResult.skipped}`);
      if (rlsResult.errors.length > 0) {
        console.warn(`[RLS] Errors: ${rlsResult.errors.join("; ")}`);
      }
    } catch (err) {
      console.error("[RLS] Failed to enable row-level security:", err);
    }

    clearInterval(seedKeepalive);

    const keepaliveInterval = setInterval(async () => {
      try {
        await withRetry(() => prisma.$queryRaw`SELECT 1`);
      } catch (e) {
        console.error("[KEEPALIVE] DB ping failed:", e);
      }
    }, 30000);

    const { enforceSubscriptionLifecycle, processScheduledInvoices, deleteExpiredTrialFirms } = await import("./services/billingService");
    const runBillingCycle = async () => {
      try {
        const lifecycle = await enforceSubscriptionLifecycle();
        const invoicing = await processScheduledInvoices();
        const trialCleanup = await deleteExpiredTrialFirms();
        if (lifecycle.trialExpired || lifecycle.movedToGrace || lifecycle.suspended || lifecycle.overdueInvoices || invoicing.generated || trialCleanup.deleted) {
          console.log("[Billing]", JSON.stringify({ ...lifecycle, ...invoicing, trialDeleted: trialCleanup.deleted }));
        }
      } catch (err) {
        console.error("[Billing] Cycle error:", err);
      }
    };
    await runBillingCycle();
    const billingInterval = setInterval(runBillingCycle, 60 * 60 * 1000);

    let isShuttingDown = false;
    const shutdown = async (signal: string) => {
      if (isShuttingDown) return;
      isShuttingDown = true;
      console.log(`[SHUTDOWN] Received ${signal}, draining connections...`);
      clearInterval(keepaliveInterval);
      clearInterval(billingInterval);
      
      httpServer.close(async () => {
        console.log("[SHUTDOWN] HTTP server closed, disconnecting database...");
        await prisma.$disconnect();
        console.log("[SHUTDOWN] Clean shutdown complete.");
        process.exit(0);
      });
      
      setTimeout(() => {
        console.error("[SHUTDOWN] Forced exit after 15s drain timeout.");
        process.exit(1);
      }, 15000).unref();
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  })();
})();
