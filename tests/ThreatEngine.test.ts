import { describe, it, expect } from "vitest";
import { ThreatEngine } from "@/engines/ThreatEngine";

describe("ThreatEngine", () => {
  it("clamps score at 100 and reports CRITICAL", () => {
    const result = ThreatEngine.score([
      { reason: "a", weight: 60 },
      { reason: "b", weight: 60 },
    ]);
    expect(result.score).toBe(100);
    expect(result.severity).toBe("CRITICAL");
  });

  it("classifies severity bands correctly", () => {
    expect(ThreatEngine.severityFor(10)).toBe("LOW");
    expect(ThreatEngine.severityFor(45)).toBe("MEDIUM");
    expect(ThreatEngine.severityFor(70)).toBe("HIGH");
    expect(ThreatEngine.severityFor(95)).toBe("CRITICAL");
  });

  it("returns LOW with no signals", () => {
    const result = ThreatEngine.score([]);
    expect(result.score).toBe(0);
    expect(result.severity).toBe("LOW");
  });
});
