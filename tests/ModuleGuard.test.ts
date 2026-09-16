import { describe, it, expect } from "vitest";
import { isModuleEnabled } from "@/middleware/moduleGuard";

describe("isModuleEnabled", () => {
  it("defaults to enabled when the database is unavailable (fail-safe: stay protected)", async () => {
    // In this test run mongoose was never connected, so isDatabaseAvailable() is false
    // for every module key — the guard must never silently disable protection.
    const result = await isModuleEnabled("guild-without-db", "antiNuke");
    expect(result).toBe(true);
  });
});
