import { describe, it, expect } from "vitest";
import { resolveHandler, type ButtonHandler } from "@/services/ComponentRegistry";

const noop = async () => undefined;

describe("resolveHandler", () => {
  const handlers: ButtonHandler[] = [
    { customId: "guvenlik", isPrefix: true, execute: noop },
    { customId: "whitelist:ac", execute: noop },
    { customId: "yedek:onayla", isPrefix: true, execute: noop },
  ];

  it("matches an exact customId over a prefix", () => {
    const handler = resolveHandler(handlers, "whitelist:ac");
    expect(handler?.customId).toBe("whitelist:ac");
  });

  it("matches a namespaced customId via prefix", () => {
    const handler = resolveHandler(handlers, "guvenlik:koruma");
    expect(handler?.customId).toBe("guvenlik");
  });

  it("matches a dynamic-id prefix (yedek:onayla:<name>)", () => {
    const handler = resolveHandler(handlers, "yedek:onayla:sunucu-2026-01");
    expect(handler?.customId).toBe("yedek:onayla");
  });

  it("returns undefined when nothing matches", () => {
    const handler = resolveHandler(handlers, "bilinmeyen:buton");
    expect(handler).toBeUndefined();
  });

  it("never matches a prefix handler as a bare exact id (no trailing colon)", () => {
    // "guvenlik" alone (no ":<panel>") should not resolve — it's not a real button.
    const handler = resolveHandler(handlers, "guvenlik");
    expect(handler).toBeUndefined();
  });
});
