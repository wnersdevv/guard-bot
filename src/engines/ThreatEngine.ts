import { THREAT_LEVELS, type ThreatSeverity } from "@/config/constants";
import type { ThreatScoreResult } from "@/types";

export interface ThreatSignal {
  /** Human-readable reason contributing to the score, e.g. "5 channels deleted in 8s". */
  reason: string;
  /** Weight this signal contributes, 0-100. Sum is clamped to 100. */
  weight: number;
}

/**
 * Central risk-scoring engine. Every security module feeds it a list of signals
 * instead of making its own block/allow decision — this is what keeps the bot
 * from being a pile of if/else checks per feature.
 *
 * The resulting score is a *signal*, not an absolute verdict — modules combine it
 * with whitelist state, thresholds and grace periods before acting.
 */
export class ThreatEngine {
  static score(signals: ThreatSignal[]): ThreatScoreResult {
    const total = Math.min(
      100,
      signals.reduce((sum, s) => sum + s.weight, 0),
    );

    return {
      score: total,
      severity: this.severityFor(total),
      reasons: signals.map((s) => s.reason),
    };
  }

  static severityFor(score: number): ThreatSeverity {
    if (score >= THREAT_LEVELS.CRITICAL.min) return "CRITICAL";
    if (score >= THREAT_LEVELS.DANGEROUS.min) return "HIGH";
    if (score >= THREAT_LEVELS.SUSPICIOUS.min) return "MEDIUM";
    return "LOW";
  }
}
