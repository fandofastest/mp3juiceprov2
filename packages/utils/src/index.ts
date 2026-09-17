import Redis from "ioredis";

// Logger Service
export class Logger {
  static info(message: string, ...args: any[]) {
    console.log(`[INFO] ${new Date().toISOString()} - ${message}`, ...args);
  }

  static warn(message: string, ...args: any[]) {
    console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, ...args);
  }

  static error(message: string, ...args: any[]) {
    console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, ...args);
  }
}

// High-performance L1 In-Memory LRU Cache (capped to avoid memory bloat)
const MAX_L1_ENTRIES = 3000;
const l1Cache = new Map<string, { value: any; expiry: number }>();

function setL1(key: string, value: any, ttlSeconds: number) {
  if (l1Cache.size >= MAX_L1_ENTRIES) {
    // Evict oldest 20% entries when capacity is reached
    const keysToDelete = Array.from(l1Cache.keys()).slice(0, Math.floor(MAX_L1_ENTRIES * 0.2));
    for (const k of keysToDelete) {
      l1Cache.delete(k);
    }
  }
  l1Cache.set(key, {
    value,
    expiry: Date.now() + Math.min(ttlSeconds, 600) * 1000,
  });
}

function getL1<T>(key: string): T | null {
  const item = l1Cache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiry) {
    l1Cache.delete(key);
    return null;
  }
  return item.value as T;
}

// Cache Service with 2-Tier Caching (L1 RAM + L2 Redis)
export class CacheService {
  private static redisClient: Redis | null = null;
  private static isConnected = false;

  static initialize(redisUrl?: string) {
    if (this.redisClient) return;

    const url = redisUrl || process.env.REDIS_URL || "redis://localhost:6379";
    try {
      this.redisClient = new Redis(url, {
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
        retryStrategy: (times) => {
          if (times > 3) {
            Logger.warn("Redis connection failed. Falling back to In-Memory cache.");
            this.isConnected = false;
            return null; // stop retrying
          }
          return Math.min(times * 100, 2000);
        },
      });

      this.redisClient.on("connect", () => {
        Logger.info("Redis connected successfully.");
        this.isConnected = true;
      });

      this.redisClient.on("error", (err) => {
        this.isConnected = false;
      });
    } catch (error) {
      this.isConnected = false;
    }
  }

  static getClient(): Redis | null {
    if (!this.redisClient) {
      this.initialize();
    }
    return this.isConnected ? this.redisClient : null;
  }

  static async get<T>(key: string): Promise<T | null> {
    // 1. Fast L1 In-Memory lookup (0 network, 0 JSON.parse, < 0.001ms)
    const memVal = getL1<T>(key);
    if (memVal !== null) {
      return memVal;
    }

    // 2. L2 Redis lookup
    const client = this.getClient();
    if (client && this.isConnected) {
      try {
        const val = await client.get(key);
        if (val) {
          const parsed = JSON.parse(val) as T;
          // Populate L1 cache for subsequent instant hits
          setL1(key, parsed, 120);
          return parsed;
        }
      } catch (err) {
        // Silently proceed on Redis failure
      }
    }

    return null;
  }

  static async set(key: string, value: any, ttlSeconds = 300): Promise<void> {
    // Save to L1 memory cache instantly
    setL1(key, value, ttlSeconds);

    // Save to L2 Redis asynchronously
    const client = this.getClient();
    if (client && this.isConnected) {
      try {
        const serialized = JSON.stringify(value);
        await client.set(key, serialized, "EX", ttlSeconds);
      } catch (err) {
        // Silently proceed
      }
    }
  }

  static async delete(key: string): Promise<void> {
    l1Cache.delete(key);

    const client = this.getClient();
    if (client && this.isConnected) {
      try {
        await client.del(key);
      } catch (err) {}
    }
  }

  static async clearPattern(pattern: string): Promise<void> {
    // Clear L1 memory matching pattern
    const regex = new RegExp(pattern.replace(/\*/g, ".*"));
    for (const key of l1Cache.keys()) {
      if (regex.test(key)) {
        l1Cache.delete(key);
      }
    }

    const client = this.getClient();
    if (client && this.isConnected) {
      try {
        const keys = await client.keys(pattern);
        if (keys.length > 0) {
          await client.del(...keys);
        }
      } catch (err) {}
    }
  }
}

// Input Sanitization Service
export class SanitizeService {
  static sanitizeString(input: string): string {
    if (!input) return "";
    return input
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#x27;")
      .replace(/\//g, "&#x2F;")
      .trim();
  }

  static sanitizeObject<T = any>(obj: T): T {
    if (!obj || typeof obj !== "object") return obj;

    const result: any = Array.isArray(obj) ? [] : {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const value = obj[key];
        if (typeof value === "string") {
          result[key] = this.sanitizeString(value);
        } else if (typeof value === "object") {
          result[key] = this.sanitizeObject(value);
        } else {
          result[key] = value;
        }
      }
    }
    return result as T;
  }
}
