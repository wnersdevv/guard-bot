import { describe, it, expect } from "vitest";
import { AuditEngine } from "@/engines/AuditEngine";

describe("AuditEngine.isDuplicateEntry", () => {
  // No REDIS_URL is set in ayarlar.test.json, so isRedisAvailable() is false and
  // every call here exercises the in-memory fallback path directly.

  it("returns false the first time an entry ID is seen", async () => {
    expect(await AuditEngine.isDuplicateEntry("entry-1")).toBe(false);
  });

  it("returns true for the same entry ID seen again", async () => {
    await AuditEngine.isDuplicateEntry("entry-2");
    expect(await AuditEngine.isDuplicateEntry("entry-2")).toBe(true);
  });

  it("treats null entry IDs as never-duplicate (nothing to dedupe on)", async () => {
    expect(await AuditEngine.isDuplicateEntry(null)).toBe(false);
    expect(await AuditEngine.isDuplicateEntry(null)).toBe(false);
  });

  it("distinguishes different entry IDs", async () => {
    await AuditEngine.isDuplicateEntry("entry-3");
    expect(await AuditEngine.isDuplicateEntry("entry-4")).toBe(false);
  });
});
