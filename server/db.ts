import { PrismaClient } from "@prisma/client";

declare global {
  var __prisma: PrismaClient | undefined;
  var __dbStatus: DatabaseStatus;
}

export interface DatabaseStatus {
  state: "initializing" | "connecting" | "ready" | "error" | "reconnecting";
  message: string;
  lastCheck: string;
  retryCount: number;
  startedAt: string;
}

function getDefaultStatus(): DatabaseStatus {
  return {
    state: "initializing",
    message: "System starting up",
    lastCheck: new Date().toISOString(),
    retryCount: 0,
    startedAt: new Date().toISOString(),
  };
}

if (!globalThis.__dbStatus) {
  globalThis.__dbStatus = getDefaultStatus();
}

export function getDbStatus(): DatabaseStatus {
  return { ...globalThis.__dbStatus };
}

export function setDbStatus(update: Partial<DatabaseStatus>) {
  globalThis.__dbStatus = {
    ...globalThis.__dbStatus,
    ...update,
    lastCheck: new Date().toISOString(),
  };
}

export interface EnvValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateDatabaseEnv(): EnvValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!process.env.DATABASE_URL) {
    errors.push("DATABASE_URL is not defined. Database cannot connect.");
  } else {
    try {
      const url = new URL(process.env.DATABASE_URL);
      if (!url.hostname) errors.push("DATABASE_URL has no hostname.");
      if (!url.pathname || url.pathname === "/") warnings.push("DATABASE_URL has no database name specified.");
      if (!url.username) warnings.push("DATABASE_URL has no username — may fail authentication.");
    } catch {
      errors.push("DATABASE_URL is not a valid connection string.");
    }
  }

  const isProduction = process.env.NODE_ENV === "production";
  if (isProduction) {
    if (!process.env.DATABASE_SSL || process.env.DATABASE_SSL !== "true") {
      warnings.push("DATABASE_SSL is not enabled — recommended for RDS/production databases.");
    }
    if (process.env.DB_PASSWORD === "changeme") {
      warnings.push("DB_PASSWORD is set to default 'changeme' — change for production.");
    }
    if (process.env.POSTGRES_PASSWORD && process.env.DATABASE_URL) {
      try {
        const url = new URL(process.env.DATABASE_URL);
        const urlPassword = decodeURIComponent(url.password);
        if (urlPassword && process.env.POSTGRES_PASSWORD && urlPassword !== process.env.POSTGRES_PASSWORD) {
          warnings.push("DATABASE_URL password does not match POSTGRES_PASSWORD — possible credential mismatch between app and PostgreSQL container.");
        }
      } catch {}
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

function createPrismaClient() {
  const validation = validateDatabaseEnv();

  if (!validation.valid) {
    const msg = `Database configuration invalid:\n  ${validation.errors.join("\n  ")}`;
    console.error(`[DB] FATAL: ${msg}`);
    setDbStatus({ state: "error", message: validation.errors[0] });
    throw new Error(msg);
  }

  if (validation.warnings.length > 0) {
    validation.warnings.forEach(w => console.warn(`[DB] WARNING: ${w}`));
  }

  const dbUrl = new URL(process.env.DATABASE_URL!);

  const isProduction = process.env.NODE_ENV === "production";
  dbUrl.searchParams.set("connection_limit", isProduction ? "15" : "5");
  dbUrl.searchParams.set("pool_timeout", "30");
  dbUrl.searchParams.set("connect_timeout", "15");

  const sslEnabled = process.env.DATABASE_SSL === "true";
  if (sslEnabled) {
    if (process.env.DATABASE_SSL_CA) {
      dbUrl.searchParams.set("sslmode", "verify-ca");
      dbUrl.searchParams.set("sslrootcert", process.env.DATABASE_SSL_CA);
    } else {
      dbUrl.searchParams.set("sslmode", "require");
    }
    console.log("[DB] SSL/TLS enabled for database connection (RDS compatible)");
  }

  const client = new PrismaClient({
    log: isProduction ? ["error"] : ["error", "warn"],
    datasources: {
      db: { url: dbUrl.toString() },
    },
  });

  return client;
}

export const prisma = globalThis.__prisma || createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma = prisma;
}

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 200;

export function isRetryableError(error: any): boolean {
  const message = String(error?.message || error || "").toLowerCase();
  return (
    message.includes("terminating connection") ||
    message.includes("connection reset") ||
    message.includes("connection refused") ||
    message.includes("connection closed") ||
    message.includes("server closed the connection") ||
    message.includes("57p01") ||
    message.includes("can't reach database") ||
    message.includes("timed out") ||
    message.includes("econnreset") ||
    message.includes("epipe") ||
    message.includes("authentication failed") ||
    message.includes("password authentication failed") ||
    message.includes("28p01")
  );
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  retries: number = MAX_RETRIES
): Promise<T> {
  let lastError: any;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt < retries - 1 && isRetryableError(error)) {
        const delay = RETRY_DELAY_MS * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

export async function waitForDatabase(maxWaitSeconds: number = 90): Promise<boolean> {
  const maxAttempts = 20;
  const baseDelay = 1000;

  setDbStatus({ state: "connecting", message: "Waiting for database..." });
  console.log(`[DB] Checking database readiness (max ${maxWaitSeconds}s)...`);

  const deadline = Date.now() + maxWaitSeconds * 1000;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (Date.now() >= deadline) break;

    try {
      await prisma.$queryRaw`SELECT 1 AS ping`;
      setDbStatus({ state: "ready", message: "Database connected", retryCount: attempt - 1 });
      console.log(`[DB] Database ready after ${attempt} attempt(s).`);
      return true;
    } catch (error: any) {
      const msg = String(error?.message || "Unknown error").replace(/\n/g, " ").substring(0, 200);
      const isAuth = msg.toLowerCase().includes("authentication") || msg.toLowerCase().includes("28p01") || msg.toLowerCase().includes("password");
      const isRefused = msg.toLowerCase().includes("refused") || msg.toLowerCase().includes("econnrefused");

      setDbStatus({
        state: "connecting",
        message: isAuth
          ? "Database authentication failed — check credentials"
          : isRefused
            ? `Database not reachable (attempt ${attempt}/${maxAttempts})`
            : `Connection attempt ${attempt}/${maxAttempts}: ${msg.substring(0, 80)}`,
        retryCount: attempt,
      });

      if (isAuth) {
        console.error(`[DB] Authentication failed (attempt ${attempt}): ${msg}`);
        console.error("[DB] Check that DATABASE_URL credentials match PostgreSQL user/password.");
      } else {
        console.warn(`[DB] Connection attempt ${attempt}/${maxAttempts} failed: ${msg}`);
      }

      if (attempt < maxAttempts && Date.now() < deadline) {
        const delay = Math.min(baseDelay * Math.pow(1.5, attempt - 1), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  setDbStatus({ state: "error", message: "Database connection failed after all retry attempts" });
  console.error(`[DB] FATAL: Could not connect to database within ${maxWaitSeconds}s.`);
  return false;
}
