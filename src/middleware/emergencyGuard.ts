import { GuildSettingsModel } from "@/models/GuildSettings";
import { isDatabaseAvailable } from "@/database/connection";
import { securityLogger } from "@/utils/logger";

const cache = new Map<string, { value: boolean; at: number }>();
const CACHE_TTL_MS = 5000; // short TTL: emergency mode must react fast to /acil-durum, but this avoids a DB hit on every single gateway event

/**
 * Cheap, cached lookup of a guild's Emergency Mode flag. Security modules
 * consult this to tighten thresholds — it deliberately fails CLOSED
 * (returns false / normal mode) if the database is unavailable, since a
 * DB outage should never silently widen the attack surface further by
 * pretending emergency protections are active when they can't be verified.
 */
export async function isEmergencyMode(guildId: string): Promise<boolean> {
  if (!isDatabaseAvailable()) return false;

  const cached = cache.get(guildId);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value;

  try {
    const settings = await GuildSettingsModel.findOne({ guildId }).select("emergencyMode").lean();
    const value = Boolean(settings?.emergencyMode);
    cache.set(guildId, { value, at: Date.now() });
    return value;
  } catch (err) {
    securityLogger.warn({ err, guildId }, "Emergency mode lookup failed — treating as normal mode");
    return false;
  }
}
