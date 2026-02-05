import dns from 'dns';

interface CacheEntry {
  result: string[];
  expiresAt: number;
}

export class DNSCache {
  private cache = new Map<string, CacheEntry>();
  private ttlMs: number;

  constructor(ttlMs: number = 300000) {
    // Default 5 minutes TTL
    this.ttlMs = ttlMs;
  }

  async resolveWithCache(
    domain: string,
    resolver?: dns.Resolver,
  ): Promise<string[]> {
    const now = Date.now();
    const cached = this.cache.get(domain);
    if (cached && cached.expiresAt > now) {
      return cached.result;
    }

    // Perform DNS resolution
    const result = await this.performResolve(domain, resolver);
    this.cache.set(domain, { result, expiresAt: now + this.ttlMs });
    return result;
  }

  private async performResolve(
    domain: string,
    resolver?: dns.Resolver,
  ): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const res = resolver || dns;
      res.resolve(domain, (err, addresses) => {
        if (err) reject(err);
        else resolve(addresses || []);
      });
    });
  }

  clear(): void {
    this.cache.clear();
  }
}
