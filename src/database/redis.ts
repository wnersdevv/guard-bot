import Redis from "ioredis";
import { env } from "@/config/env";
import { databaseLogger } from "@/utils/logger";

let client: Redis | null = null;
let connected = false;

/**
 * Lazily creates and connects a Redis client if REDIS_URL is configured.
 * Returns null (never throws) when Redis isn't configured or isn't
 * reachable — every caller in utils/distributedStore.ts treats a null/
 * unavailable client as "fall back to in-memory," never as a fatal error.
 * Multi-instance consistency is a nice-to-have this bot degrades
 * gracefully without.
 */
export function getRedisClient(): Redis | null {
  if (!env.REDIS_URL) return null;
  if (client) return client;

  client = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 2,
    lazyConnect: false,
    retryStrategy: (times) => Math.min(times * 500, 5000),
  });

  client.on("connect", () => {
    connected = true;
    databaseLogger.info("Redis connected — rate limiting and dedupe are now cluster-wide");
  });
  client.on("error", (err) => {
    databaseLogger.warn({ err }, "Redis error — falling back to in-memory for affected calls");
    connected = false;
  });
  client.on("close", () => {
    connected = false;
  });

  return client;
}

export function isRedisAvailable(): boolean {
  return connected;
}
