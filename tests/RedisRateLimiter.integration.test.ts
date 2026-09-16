import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RedisRateLimiter } from "@/utils/rateLimiter";
import { AuditEngine } from "@/engines/AuditEngine";
import { getRedisClient } from "@/database/redis";

/**
 * Integration test for the Redis-backed path specifically — everything
 * else in this suite exercises the in-memory fallback because CI and this
 * development sandbox have no Redis available. Run this one against a
 * real Redis (see docker-compose.yml):
 *
 *   docker compose up -d redis
 *   REDIS_URL=redis://localhost:6379 npm test
 *
 * it.skipIf means this file is a no-op (reports as skipped, not failed)
 * whenever REDIS_URL isn't set — so `npm test` stays green in CI without
 * Redis, while still giving this path real coverage wherever Redis exists.
 */
const hasRedis = Boolean(process.env.REDIS_URL);

describe.skipIf(!hasRedis)("RedisRateLimiter (live Redis required)", () => {
  const limiter = new RedisRateLimiter();
  const testKey = `test:${Date.now()}:${Math.random()}`;

  beforeAll(async () => {
    // Wait for the connection to actually be up (ioredis queues commands
    // issued before "ready", but we want isRedisAvailable() — checked by
    // AuditEngine below — to be true by the time these tests run, not just
    // "eventually queued".
    await getRedisClient()?.ping();
  });

  afterAll(async () => {
    await limiter.reset(testKey).catch(() => undefined);
    const redis = getRedisClient();
    await redis?.quit();
  });

  it("counts hits within the window against real Redis", async () => {
    expect(await limiter.hit(testKey, 5000)).toBe(1);
    expect(await limiter.hit(testKey, 5000)).toBe(2);
    expect(await limiter.hit(testKey, 5000)).toBe(3);
  });

  it("resets a bucket on demand", async () => {
    await limiter.reset(testKey);
    expect(await limiter.hit(testKey, 5000)).toBe(1);
  });
});

describe.skipIf(!hasRedis)("AuditEngine.isDuplicateEntry (live Redis required)", () => {
  it("dedupes an entry ID against real Redis", async () => {
    const entryId = `test-entry-${Date.now()}`;
    expect(await AuditEngine.isDuplicateEntry(entryId)).toBe(false);
    expect(await AuditEngine.isDuplicateEntry(entryId)).toBe(true);
  });
});
