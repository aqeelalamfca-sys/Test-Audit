class PerformanceCache {
  private cache: Map<string, { data: any; expiresAt: number }>;
  private defaultTTL: number;

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
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }

  invalidatePattern(pattern: string): void {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

export const performanceCache = new PerformanceCache();
