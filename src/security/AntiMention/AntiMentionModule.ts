import type { Guild, Message } from "discord.js";
import { ThreatEngine, type ThreatSignal } from "@/engines/ThreatEngine";
import { ResponseEngine } from "@/engines/ResponseEngine";
import { WhitelistService } from "@/services/WhitelistService";
import { isModuleEnabled } from "@/middleware/moduleGuard";

const EVERYONE_HERE_WEIGHT = 45;
const MASS_MENTION_THRESHOLD = 6; // distinct user/role mentions in a single message
const MASS_MENTION_WEIGHT = 30;

/**
 * Anti-Mention: @everyone / @here abuse and mass user/role mention spam
 * within a single message. Kept separate from AntiSpamModule so a guild
 * can tune mention limits independently of general message-flood limits.
 */
export class AntiMentionModule {
  static async onMessageCreate(message: Message): Promise<void> {
    if (!message.guild || message.author.bot) return;
    const guild = message.guild;
    if (!(await isModuleEnabled(guild.id, "antiMention"))) return;
    const authorId = message.author.id;

    if (await this.isSafe(guild, authorId)) return;

    const signals: ThreatSignal[] = [];

    if (message.mentions.everyone) {
      signals.push({ reason: "@everyone/@here mention", weight: EVERYONE_HERE_WEIGHT });
    }

    const distinctMentions = message.mentions.users.size + message.mentions.roles.size;
    if (distinctMentions >= MASS_MENTION_THRESHOLD) {
      signals.push({ reason: `${distinctMentions} distinct mentions in one message`, weight: MASS_MENTION_WEIGHT });
    }

    if (signals.length === 0) return;

    const { score, severity, reasons } = ThreatEngine.score(signals);
    if (severity === "LOW") return;

    await ResponseEngine.handle(guild, severity, {
      guildId: guild.id,
      type: "antiMention.abuse",
      executorId: authorId,
      targetId: message.channelId,
      riskScore: score,
      severity,
      action: "LOGGED",
      metadata: { reasons, distinctMentions },
    });

    if (severity === "HIGH" || severity === "CRITICAL") {
      await message.delete().catch(() => undefined);
    }
  }

  private static async isSafe(guild: Guild, userId: string): Promise<boolean> {
    if (userId === guild.ownerId) return true;
    const member = await guild.members.fetch(userId).catch(() => null);
    const roleIds = member ? [...member.roles.cache.keys()] : [];
    return WhitelistService.isWhitelisted({ guildId: guild.id, userId, roleIds });
  }
}
