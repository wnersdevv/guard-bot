import { getRedisClient, isRedisAvailable } from "@/database/redis";
import { securityLogger } from "@/utils/logger";

/**
 * Common shape both backends implement, so every call site in the security
 * modules is written once and works identically whether REDIS_URL is set
 * or not.
 */
export interface RateLimiterLike {
  /** Records a hit and returns how many hits occurred within windowMs (inclusive of this one). */
  hit(key: string, windowMs: number): Promise<number>;
  reset(key: string): Promise<void>;
}

interface Bucket {
  timestamps: number[];
}

/**
 * In-memory sliding-window rate limiter. Used directly in single-instance
 * deployments, and as the automatic fallback inside HybridRateLimiter
 * whenever Redis is unset, unreachable, or errors on a given call.
 */
export class MemoryRateLimiter implements RateLimiterLike {
  private buckets = new Map<string, Bucket>();

  async hit(key: string, windowMs: number): Promise<number> {
    const now = Date.now();
    const bucket = this.buckets.get(key) ?? { timestamps: [] };
    bucket.timestamps = bucket.timestamps.filter((t) => now - t <= windowMs);
    bucket.timestamps.push(now);
    this.buckets.set(key, bucket);
    return bucket.timestamps.length;
  }

  async reset(key: string): Promise<void> {
    this.buckets.delete(key);
  }

  /** Periodic cleanup to avoid unbounded memory growth; called on an interval from index.ts. */
  sweep(maxAgeMs: number): void {
    const now = Date.now();
    for (const [key, bucket] of this.buckets.entries()) {
      bucket.timestamps = bucket.timestamps.filter((t) => now - t <= maxAgeMs);
      if (bucket.timestamps.length === 0) this.buckets.delete(key);
    }
  }
}

/**
 * Redis-backed sliding-window rate limiter, for multi-instance deployments
 * (sharded across processes/machines) that need one consistent burst count
 * instead of each process tracking its own. Implemented with a per-key
 * sorted set: ZADD the current timestamp, ZREMRANGEBYSCORE to drop entries
 * older than the window, ZCARD for the count, and a TTL on the key so an
 * abandoned bucket expires on its own instead of needing a manual sweep.
 */
export class RedisRateLimiter implements RateLimiterLike {
  async hit(key: string, windowMs: number): Promise<number> {
    const redis = getRedisClient();
    if (!redis) throw new Error("Redis client unavailable");

    const now = Date.now();
    const redisKey = `wg:rl:${key}`;
    const pipeline = redis.pipeline();
    pipeline.zadd(redisKey, now, `${now}:${Math.random()}`);
    pipeline.zremrangebyscore(redisKey, 0, now - windowMs);
    pipeline.zcard(redisKey);
    pipeline.pexpire(redisKey, windowMs + 5000);
    const results = await pipeline.exec();

    const countResult = results?.[2];
    if (!countResult || countResult[0]) throw new Error("Redis pipeline error while counting hits");
    return countResult[1] as number;
  }

  async reset(key: string): Promise<void> {
    const redis = getRedisClient();
    if (!redis) throw new Error("Redis client unavailable");
    await redis.del(`wg:rl:${key}`);
  }
}

/**
 * The instance every security module actually calls. Tries Redis first
 * when it's configured *and* currently connected; on any error (including
 * "not configured") it transparently falls back to the in-memory limiter
 * for that one call, logging once rather than throwing — a Redis blip must
 * never take down burst detection.
 */
export class HybridRateLimiter implements RateLimiterLike {
  private memory = new MemoryRateLimiter();
  private redis = new RedisRateLimiter();

  async hit(key: string, windowMs: number): Promise<number> {
    if (isRedisAvailable()) {
      try {
        return await this.redis.hit(key, windowMs);
      } catch (err) {
        securityLogger.warn({ err, key }, "Redis rate-limit hit failed — falling back to in-memory for this call");
      }
    }
    return this.memory.hit(key, windowMs);
  }

  async reset(key: string): Promise<void> {
    if (isRedisAvailable()) {
      try {
        await this.redis.reset(key);
        return;
      } catch (err) {
        securityLogger.warn({ err, key }, "Redis rate-limit reset failed — clearing in-memory copy instead");
      }
    }
    await this.memory.reset(key);
  }

  /** In-memory-only cleanup; Redis keys self-expire via TTL and need no sweep. */
  sweep(maxAgeMs: number): void {
    this.memory.sweep(maxAgeMs);
  }
}

export const globalRateLimiter = new HybridRateLimiter();
