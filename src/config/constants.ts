export const BRAND = {
  DEVELOPER: "WNERSDEV",
  PRODUCT: "WnersGuard",
  TAGLINE: "Secure. Detect. Protect.",
  FOOTER: "WNERSDEV • WnersGuard",
} as const;

export const SUPPORTED_LANGUAGES = ["tr", "en", "de", "es"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
export const DEFAULT_LANGUAGE: SupportedLanguage = "tr";

export const THREAT_LEVELS = {
  NORMAL: { min: 0, max: 30, label: "NORMAL" },
  SUSPICIOUS: { min: 31, max: 60, label: "SUSPICIOUS" },
  DANGEROUS: { min: 61, max: 80, label: "DANGEROUS" },
  CRITICAL: { min: 81, max: 100, label: "CRITICAL" },
} as const;

export type ThreatSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export const COLORS = {
  primary: 0x5865f2,
  success: 0x57f287,
  warning: 0xfee75c,
  danger: 0xed4245,
  critical: 0x8b0000,
  info: 0x3498db,
} as const;

export const DEFAULT_RATE_LIMITS = {
  roleChanges: { count: 5, windowMs: 10_000 },
  channelOperations: { count: 10, windowMs: 10_000 },
  messages: { count: 15, windowMs: 5_000 },
  webhookOperations: { count: 3, windowMs: 10_000 },
} as const;
