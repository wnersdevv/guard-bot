import { PunishmentModel, type PunishmentDoc } from "@/models/Punishment";
import { GuildSettingsModel } from "@/models/GuildSettings";
import { isDatabaseAvailable } from "@/database/connection";
import { securityLogger } from "@/utils/logger";
import type { Guild, MessageCreateOptions } from "discord.js";

export type PunishmentType = PunishmentDoc["type"];

export interface RecordPunishmentInput {
  guildId: string;
  type: PunishmentType;
  targetId: string;
  moderatorId: string;
  reason: string;
  durationMs?: number | null;
}

/**
 * Every moderation command (uyar/sustur/at/yasakla) goes through this so that
 * reason + moderator + target + timestamp is always logged, and the log
 * channel notification is always sent the same way regardless of which
 * command triggered it.
 */
export class ModerationService {
  static async record(input: RecordPunishmentInput): Promise<PunishmentDoc | null> {
    if (!isDatabaseAvailable()) {
      securityLogger.warn({ input }, "DB unavailable — punishment not persisted, action still applied");
      return null;
    }
    return PunishmentModel.create({
      guildId: input.guildId,
      type: input.type,
      targetId: input.targetId,
      moderatorId: input.moderatorId,
      reason: input.reason,
      durationMs: input.durationMs ?? null,
    });
  }

  static async notifyLogChannel(guild: Guild, embed: MessageCreateOptions): Promise<void> {
    if (!isDatabaseAvailable()) return;
    const settings = await GuildSettingsModel.findOne({ guildId: guild.id }).lean();
    if (!settings?.logChannelId) return;

    const channel = await guild.channels.fetch(settings.logChannelId).catch(() => null);
    if (!channel || !channel.isTextBased()) return;

    await channel.send(embed).catch((err) => securityLogger.error({ err }, "Failed to send moderation log"));
  }
}
