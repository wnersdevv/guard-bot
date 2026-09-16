import { describe, it, expect } from "vitest";
import { AutoProtectionService } from "@/services/AutoProtectionService";

/**
 * Full member.timeout()/member.fetch() flows require a live discord.js Guild,
 * so these tests cover only the cheap, deterministic guard clauses that run
 * before any Discord API call — the conditions that keep this the one place
 * in the codebase allowed to act automatically against a real member.
 */
describe("AutoProtectionService.applyIfWarranted guard clauses", () => {
  const fakeGuild = { ownerId: "owner-1", members: { fetch: async () => null } } as unknown as Parameters<
    typeof AutoProtectionService.applyIfWarranted
  >[0];

  it("returns false when there is no executor/subject to act on", async () => {
    const result = await AutoProtectionService.applyIfWarranted(fakeGuild, null, "test");
    expect(result).toBe(false);
  });

  it("never acts against the guild owner", async () => {
    const result = await AutoProtectionService.applyIfWarranted(fakeGuild, "owner-1", "test");
    expect(result).toBe(false);
  });

  it("returns false when the member can't be fetched (left the server, etc.)", async () => {
    const result = await AutoProtectionService.applyIfWarranted(fakeGuild, "some-other-id", "test");
    expect(result).toBe(false);
  });
});
