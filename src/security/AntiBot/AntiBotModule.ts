import { AuditLogEvent, type Guild, type GuildMember } from "discord.js";
import { ThreatEngine, type ThreatSignal } from "@/engines/ThreatEngine";
import { ResponseEngine } from "@/engines/ResponseEngine";
import { AuditEngine } from "@/engines/AuditEngine";
import { WhitelistService } from "@/services/WhitelistService";
import { isModuleEnabled } from "@/middleware/moduleGuard";

const NEW_BOT_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const DANGEROUS_PERMISSION_BITS = [
  "Administrator",
  "ManageGuild",
  "ManageRoles",
  "ManageChannels",
  "ManageWebhooks",
  "BanMembers",
  "KickMembers",
] as const;

/**
 * Anti-Bot: analyzes newly-added bots (account age, inviter, granted
 * permissions, role position) rather than reacting to a bot's later
 * actions in isolation — those are already covered by Anti-Nuke/Anti-Raid.
 * This module is specifically about the *addition itself* looking risky.
 */
export class AntiBotModule {
  static async onBotJoin(guild: Guild, member: GuildMember): Promise<void> {
    if (!member.user.bot) return;
    if (!(await isModuleEnabled(guild.id, "antiBot"))) return;
    if (await this.isSafe(guild, member.id)) return;

    const signals: ThreatSignal[] = [];

    const accountAgeMs = Date.now() - member.user.createdTimestamp;
    if (accountAgeMs < NEW_BOT_AGE_MS) {
      signals.push({ reason: "Bot account created within the last 30 days", weight: 25 });
    }

    const dangerousGranted = DANGEROUS_PERMISSION_BITS.filter((perm) => member.permissions.has(perm));
    if (dangerousGranted.length > 0) {
      signals.push({ reason: `Granted dangerous permissions: ${dangerousGranted.join(", ")}`, weight: 20 + dangerousGranted.length * 10 });
    }

    const inviterId = await AuditEngine.findExecutor(guild, AuditLogEvent.BotAdd, member.id);

    if (signals.length === 0) return;

    const { score, severity, reasons } = ThreatEngine.score(signals);
    if (severity === "LOW") return;

    await ResponseEngine.handle(guild, severity, {
      guildId: guild.id,
      type: "antiBot.riskyBotAdded",
      executorId: inviterId,
      targetId: member.id,
      riskScore: score,
      severity,
      action: "LOGGED",
      metadata: { reasons, accountAgeMs, dangerousGranted },
    });
  }

  private static async isSafe(guild: Guild, botId: string): Promise<boolean> {
    return WhitelistService.isBotWhitelisted(guild.id, botId);
  }
}
