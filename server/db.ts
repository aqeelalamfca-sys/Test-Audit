import { PrismaClient } from "@prisma/client";

declare global {
  var __prisma: PrismaClient | undefined;
}

function createPrismaClient() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not defined");
  }
  
  const dbUrl = new URL(process.env.DATABASE_URL);
  
  const isProduction = process.env.NODE_ENV === "production";
  dbUrl.searchParams.set("connection_limit", isProduction ? "15" : "5");
  dbUrl.searchParams.set("pool_timeout", "30");
  dbUrl.searchParams.set("connect_timeout", "15");
  
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

function isRetryableError(error: any): boolean {
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
    message.includes("epipe")
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
