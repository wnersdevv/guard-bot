import { GuildSettingsModel } from "@/models/GuildSettings";
import { UserModel } from "@/models/User";
import { isDatabaseAvailable } from "@/database/connection";
import type { SupportedLanguage } from "@/config/constants";

/**
 * Resolves the effective language pair (user override + guild default) for
 * a single command execution, so every command can call t() with the same
 * two lines instead of duplicating two DB lookups everywhere.
 */
export async function resolveLanguages(
  guildId: string,
  userId: string,
): Promise<{ lang?: SupportedLanguage; guildLang?: SupportedLanguage }> {
  if (!isDatabaseAvailable()) return {};

  const [user, settings] = await Promise.all([
    UserModel.findOne({ userId }).select("language").lean(),
    GuildSettingsModel.findOne({ guildId }).select("language").lean(),
  ]);

  return {
    lang: (user?.language as SupportedLanguage | undefined) ?? undefined,
    guildLang: (settings?.language as SupportedLanguage | undefined) ?? undefined,
  };
}
