import type { ThreatSeverity } from "@/config/constants";

export interface ThreatScoreResult {
  score: number;
  severity: ThreatSeverity;
  reasons: string[];
}

export interface SecurityEventInput {
  guildId: string;
  type: string;
  executorId: string | null;
  targetId: string | null;
  riskScore: number;
  severity: ThreatSeverity;
  action: "LOGGED" | "ALERTED" | "BLOCKED" | "PUNISHED";
  metadata?: Record<string, unknown>;
}

export interface ModuleContext {
  guildId: string;
}

export interface SecurityModule {
  key: string;
  init(ctx: ModuleContext): Promise<void> | void;
}
