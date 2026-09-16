import type { Guild } from "discord.js";
import { PunishmentModel } from "@/models/Punishment";
import { WhitelistService } from "@/services/WhitelistService";
import { isDatabaseAvailable } from "@/database/connection";
import { securityLogger } from "@/utils/logger";

const EMERGENCY_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes — short and reversible, never a ban/kick

/**
 * The one place in the codebase allowed to take an automated, irreversible-
 * *adjacent* action against a real member, and only under narrow conditions:
 *
 *   CRITICAL severity + Emergency Mode active + known, non-whitelisted executor
 *
 * Deliberately NOT a ban or kick — a short timeout, so a false positive
 * self-corrects in 10 minutes instead of requiring manual intervention.
 * Every application is logged to Punishment and reported to the alert
 * channel by the caller (ResponseEngine), never silent.
 */
export class AutoProtectionService {
  static async applyIfWarranted(guild: Guild, executorId: string | null, reasonSummary: string): Promise<boolean> {
    if (!executorId) return false;
    if (executorId === guild.ownerId) return false;

    const member = await guild.members.fetch(executorId).catch(() => null);
    if (!member || !member.moderatable) return false;

    const roleIds = [...member.roles.cache.keys()];
    const whitelisted = await WhitelistService.isWhitelisted({ guildId: guild.id, userId: executorId, roleIds });
    if (whitelisted) return false;

    const reason = `WnersGuard Emergency Auto-Protection: ${reasonSummary}`;
    const applied = await member.timeout(EMERGENCY_TIMEOUT_MS, reason).catch((err) => {
      securityLogger.error({ err, executorId, guildId: guild.id }, "Emergency auto-protection timeout failed");
      return null;
    });
    if (!applied) return false;

    if (isDatabaseAvailable()) {
      await PunishmentModel.create({
        guildId: guild.id,
        type: "MUTE",
        targetId: executorId,
        moderatorId: guild.client.user?.id ?? "WnersGuard",
        reason,
        durationMs: EMERGENCY_TIMEOUT_MS,
      }).catch((err) => securityLogger.error({ err }, "Failed to persist auto-protection punishment"));
    }

    securityLogger.warn({ guildId: guild.id, executorId }, "Emergency auto-protection timeout applied");
    return true;
  }
}
