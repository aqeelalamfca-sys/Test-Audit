import { createClient, type RedisClientType } from "redis";

class PerformanceCache {
  private cache: Map<string, { data: any; expiresAt: number }>;
  private defaultTTL: number;
  private redisClient: RedisClientType | null = null;
  private redisConnected: boolean = false;
  private redisPrefix: string = "auditwise:cache:";

  static keys = {
    taxonomy: (firmId: string) => `taxonomy:${firmId}`,
    assertions: () => 'assertions:global',
    templates: (type: string) => `templates:${type}`,
    fsHeads: (engagementId: string) => `fsHeads:${engagementId}`,
    coaAccounts: (engagementId: string) => `coa:${engagementId}`,
    phaseStatus: (engagementId: string) => `phaseStatus:${engagementId}`,
  };

  constructor(defaultTTLMs: number = 5 * 60 * 1000) {
    this.cache = new Map();
    this.defaultTTL = defaultTTLMs;
    this.initRedis();
  }

  private initRedis(): void {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      console.log("[Cache] Using in-memory cache backend");
      return;
    }

    const useTls = process.env.REDIS_TLS === "true";
    const authToken = process.env.REDIS_AUTH_TOKEN;

    const options: any = { url: redisUrl };

    if (useTls) {
      options.socket = {
        tls: true,
        rejectUnauthorized: process.env.REDIS_REJECT_UNAUTHORIZED !== "false",
      };
    }

    if (authToken) {
      options.password = authToken;
    }

    console.log(`[Cache] Initializing Redis/ElastiCache backend (TLS: ${useTls})`);

    this.redisClient = createClient(options);

    this.redisClient.on("error", (err) => {
      if (this.redisConnected) {
        console.error("[Redis] Connection error, using in-memory fallback:", err.message);
        this.redisConnected = false;
      }
    });

    this.redisClient.on("connect", () => {
      this.redisConnected = true;
      console.log("[Redis] Connected to ElastiCache/Redis");
    });

    this.redisClient.on("reconnecting", () => {
      console.log("[Redis] Reconnecting...");
    });

    this.redisClient.connect().catch((err) => {
      console.error("[Redis] Initial connection failed, using in-memory fallback:", err.message);
      this.redisConnected = false;
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  set<T>(key: string, data: T, ttlMs?: number): void {
    const expiresAt = Date.now() + (ttlMs ?? this.defaultTTL);
    this.cache.set(key, { data, expiresAt });

    if (this.redisClient && this.redisConnected) {
      const ttlSeconds = Math.max(1, Math.ceil((ttlMs ?? this.defaultTTL) / 1000));
      this.redisClient.setEx(
        this.redisPrefix + key,
        ttlSeconds,
        JSON.stringify(data)
      ).catch(() => {});
    }
  }

  invalidate(key: string): void {
    this.cache.delete(key);

    if (this.redisClient && this.redisConnected) {
      this.redisClient.del(this.redisPrefix + key).catch(() => {});
    }
  }

  invalidatePattern(pattern: string): void {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }

    if (this.redisClient && this.redisConnected) {
      this.redisClient.keys(this.redisPrefix + pattern.replace(/\*/g, '*'))
        .then(keys => { if (keys.length > 0) this.redisClient!.del(keys).catch(() => {}); })
        .catch(() => {});
    }
  }

  clear(): void {
    this.cache.clear();

    if (this.redisClient && this.redisConnected) {
      this.redisClient.keys(this.redisPrefix + '*')
        .then(keys => { if (keys.length > 0) this.redisClient!.del(keys).catch(() => {}); })
        .catch(() => {});
    }
  }

  size(): number {
    return this.cache.size;
  }
}

export const performanceCache = new PerformanceCache();
