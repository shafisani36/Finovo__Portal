import api from './api';

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class DataPipelineManager {
  private memCache = new Map<string, CacheEntry<any>>();
  private inFlight = new Map<string, Promise<any>>();
  private listeners = new Map<string, Set<(data: any) => void>>();
  private companyIdCache = new Map<string, number>();

  private defaultTTL = 5 * 60 * 1000; // 5 minutes default TTL

  constructor() {
    // Restore persistent session keys on init
    try {
      const savedCompanyMap = sessionStorage.getItem('finovo_company_slug_map');
      if (savedCompanyMap) {
        const parsed = JSON.parse(savedCompanyMap);
        Object.entries(parsed).forEach(([slug, id]) => {
          this.companyIdCache.set(slug, Number(id));
        });
      }
    } catch {
      // Safe fallback
    }
  }

  /**
   * Retrieves data directly from memory or sessionStorage cache if valid
   */
  get<T>(key: string): T | null {
    // 1. Check memory cache first (fastest)
    const mem = this.memCache.get(key);
    if (mem) {
      if (Date.now() - mem.timestamp < mem.ttl) {
        return mem.data as T;
      }
      this.memCache.delete(key);
    }

    // 2. Fallback to localStorage or sessionStorage
    try {
      const stored = localStorage.getItem(`finovo_cache_${key}`) || sessionStorage.getItem(`finovo_cache_${key}`);
      if (stored) {
        const entry: CacheEntry<T> = JSON.parse(stored);
        if (Date.now() - entry.timestamp < entry.ttl) {
          this.memCache.set(key, entry);
          return entry.data;
        }
        localStorage.removeItem(`finovo_cache_${key}`);
        sessionStorage.removeItem(`finovo_cache_${key}`);
      }
    } catch {
      // Storage quota or parsing error
    }

    return null;
  }

  /**
   * Stores data in memory, localStorage, and sessionStorage cache
   */
  set<T>(key: string, data: T, ttlMs?: number): void {
    const ttl = ttlMs ?? this.defaultTTL;
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
    };

    this.memCache.set(key, entry);

    try {
      localStorage.setItem(`finovo_cache_${key}`, JSON.stringify(entry));
      sessionStorage.setItem(`finovo_cache_${key}`, JSON.stringify(entry));
    } catch {
      // Safe fallback if storage quota exceeded
    }

    // Notify any active UI subscribers
    const subs = this.listeners.get(key);
    if (subs) {
      subs.forEach((cb) => cb(data));
    }
  }

  /**
   * Subscribes to real-time updates for a given cache key
   */
  subscribe<T = any>(key: string, callback: (data: T) => void): () => void {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    const set = this.listeners.get(key)!;
    set.add(callback);
    return () => {
      set.delete(callback);
      if (set.size === 0) {
        this.listeners.delete(key);
      }
    };
  }

  /**
   * Invalidate specific keys or patterns (e.g. after create/update/delete)
   */
  invalidate(keyOrPattern: string | RegExp): void {
    if (typeof keyOrPattern === 'string') {
      this.memCache.delete(keyOrPattern);
      try {
        localStorage.removeItem(`finovo_cache_${keyOrPattern}`);
        sessionStorage.removeItem(`finovo_cache_${keyOrPattern}`);
      } catch {}
      return;
    }

    for (const key of this.memCache.keys()) {
      if (keyOrPattern.test(key)) {
        this.memCache.delete(key);
        try {
          localStorage.removeItem(`finovo_cache_${key}`);
          sessionStorage.removeItem(`finovo_cache_${key}`);
        } catch {}
      }
    }
  }

  /**
   * High-speed deduped fetcher
   */
  async fetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    options?: { ttlMs?: number; forceFresh?: boolean }
  ): Promise<T> {
    if (!options?.forceFresh) {
      const cached = this.get<T>(key);
      if (cached !== null) {
        return cached;
      }
    }

    // Deduplicate in-flight requests for the same key
    if (this.inFlight.has(key)) {
      return this.inFlight.get(key) as Promise<T>;
    }

    const promise = (async () => {
      try {
        const result = await fetcher();
        this.set(key, result, options?.ttlMs);
        return result;
      } finally {
        this.inFlight.delete(key);
      }
    })();

    this.inFlight.set(key, promise);
    return promise;
  }

  /**
   * Stale-While-Revalidate: Returns cached data immediately (0ms) and
   * fetches fresh data in the background, firing onUpdate callback when ready.
   */
  swr<T>(
    key: string,
    fetcher: () => Promise<T>,
    onUpdate?: (freshData: T) => void,
    options?: { ttlMs?: number }
  ): { data: T | null; isCached: boolean; promise: Promise<T> } {
    const cached = this.get<T>(key);
    const hasCache = cached !== null;

    const promise = this.fetch<T>(key, fetcher, {
      ttlMs: options?.ttlMs,
      forceFresh: true,
    }).then((fresh) => {
      if (onUpdate) {
        onUpdate(fresh);
      }
      return fresh;
    });

    return {
      data: cached,
      isCached: hasCache,
      promise,
    };
  }

  /**
   * Fast Company ID resolver: caches companySlug -> companyId mapping
   * to eliminate redundant GET /companies/{slug} roundtrips on every page.
   */
  async getCompanyId(slug: string): Promise<number> {
    if (this.companyIdCache.has(slug)) {
      return this.companyIdCache.get(slug)!;
    }

    // Try resolving synchronously from localStorage cache
    try {
      const storedActive = localStorage.getItem('bitspark_active_membership');
      if (storedActive) {
        const parsed = JSON.parse(storedActive);
        if (parsed.company?.slug === slug && parsed.company?.id) {
          const id = Number(parsed.company.id);
          this.companyIdCache.set(slug, id);
          return id;
        }
      }

      const storedCompanies = localStorage.getItem('bitspark_companies');
      if (storedCompanies) {
        const list = JSON.parse(storedCompanies);
        const match = list.find((m: any) => m.company?.slug === slug);
        if (match?.company?.id) {
          const id = Number(match.company.id);
          this.companyIdCache.set(slug, id);
          return id;
        }
      }
    } catch {}

    const res = await api.get(`/companies/${slug}`);
    const id = Number(res.data.company.id);
    this.companyIdCache.set(slug, id);

    try {
      const obj: Record<string, number> = {};
      this.companyIdCache.forEach((v, k) => {
        obj[k] = v;
      });
      sessionStorage.setItem('finovo_company_slug_map', JSON.stringify(obj));
    } catch {}

    return id;
  }
}

export const dataPipeline = new DataPipelineManager();
