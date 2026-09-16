import { GuildSettingsModel } from "@/models/GuildSettings";
import { isDatabaseAvailable } from "@/database/connection";
import { securityLogger } from "@/utils/logger";

export type ModuleKey =
  | "antiNuke"
  | "antiRaid"
  | "antiSpam"
  | "antiWebhook"
  | "antiBot"
  | "antiMention"
  | "roleProtection"
  | "channelProtection"
  | "serverProtection";

const cache = new Map<string, { modules: Partial<Record<ModuleKey, boolean>>; at: number }>();
const CACHE_TTL_MS = 5000;

/**
 * Cheap, cached check for whether a protection module is enabled for a
 * guild — this is what makes the `/koruma` toggle select menu actually do
 * something. Defaults to enabled (true) when unset, unavailable, or on a
 * cache/DB miss, so a fresh guild or a DB outage never silently disables
 * protection — the fail-safe direction here is "stay protected", unlike
 * emergencyGuard's fail-closed "stay in normal mode".
 */
export async function isModuleEnabled(guildId: string, moduleKey: ModuleKey): Promise<boolean> {
  if (!isDatabaseAvailable()) return true;

  const cached = cache.get(guildId);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.modules[moduleKey] ?? true;
  }

  try {
    const settings = await GuildSettingsModel.findOne({ guildId }).select("modules").lean();
    const modules = (settings?.modules ?? {}) as Partial<Record<ModuleKey, boolean>>;
    cache.set(guildId, { modules, at: Date.now() });
    return modules[moduleKey] ?? true;
  } catch (err) {
    securityLogger.warn({ err, guildId, moduleKey }, "Module-enabled lookup failed — defaulting to enabled");
    return true;
  }
}
