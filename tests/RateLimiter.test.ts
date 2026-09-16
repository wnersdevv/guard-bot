import { describe, it, expect, beforeEach } from "vitest";
import { MemoryRateLimiter } from "@/utils/rateLimiter";

describe("MemoryRateLimiter", () => {
  let limiter: MemoryRateLimiter;
  beforeEach(() => {
    limiter = new MemoryRateLimiter();
  });

  it("counts hits within the window", async () => {
    expect(await limiter.hit("k", 1000)).toBe(1);
    expect(await limiter.hit("k", 1000)).toBe(2);
    expect(await limiter.hit("k", 1000)).toBe(3);
  });

  it("resets a bucket on demand", async () => {
    await limiter.hit("k", 1000);
    await limiter.reset("k");
    expect(await limiter.hit("k", 1000)).toBe(1);
  });

  it("sweep prunes buckets older than maxAgeMs", async () => {
    await limiter.hit("stale-key", 1000);
    limiter.sweep(0); // everything counts as "older than 0ms" immediately
    // after a full sweep the bucket is gone, so the next hit starts fresh at 1
    expect(await limiter.hit("stale-key", 1000)).toBe(1);
  });
});
