import { AuditLogEvent, type GuildChannel } from "discord.js";
import { ThreatEngine, type ThreatSignal } from "@/engines/ThreatEngine";
import { ResponseEngine } from "@/engines/ResponseEngine";
import { AuditEngine } from "@/engines/AuditEngine";
import { WhitelistService } from "@/services/WhitelistService";
import { isModuleEnabled } from "@/middleware/moduleGuard";

/**
 * Channel Protection: watches rename and permission-overwrite changes on
 * existing channels (creation/deletion bursts are Anti-Nuke's job — this
 * module is about quiet, one-off tampering with a channel that already
 * existed, e.g. a mod-only channel getting @everyone read access added).
 */
export class ChannelProtectionModule {
  static async onChannelUpdate(oldChannel: GuildChannel, newChannel: GuildChannel): Promise<void> {
    if (!(await isModuleEnabled(newChannel.guild.id, "channelProtection"))) return;
    const signals: ThreatSignal[] = [];

    if (oldChannel.name !== newChannel.name) {
      signals.push({ reason: `Channel renamed: "${oldChannel.name}" → "${newChannel.name}"`, weight: 15 });
    }

    const everyoneOld = oldChannel.permissionOverwrites.cache.get(oldChannel.guild.id);
    const everyoneNew = newChannel.permissionOverwrites.cache.get(newChannel.guild.id);
    const oldAllow = everyoneOld?.allow.bitfield ?? 0n;
    const newAllow = everyoneNew?.allow.bitfield ?? 0n;
    if (newAllow !== oldAllow && (newAllow & ~oldAllow) !== 0n) {
      signals.push({ reason: "@everyone permission overwrite widened on this channel", weight: 40 });
    }

    if (signals.length === 0) return;

    const executorId = await AuditEngine.findExecutor(newChannel.guild, AuditLogEvent.ChannelUpdate, newChannel.id);
    if (executorId && (await this.isExecutorSafe(newChannel, executorId))) return;

    const { score, severity, reasons } = ThreatEngine.score(signals);
    if (severity === "LOW") return;

    await ResponseEngine.handle(newChannel.guild, severity, {
      guildId: newChannel.guild.id,
      type: "channelProtection.tampering",
      executorId,
      targetId: newChannel.id,
      riskScore: score,
      severity,
      action: "LOGGED",
      metadata: { reasons },
    });
  }

  private static async isExecutorSafe(channel: GuildChannel, executorId: string): Promise<boolean> {
    if (executorId === channel.guild.ownerId) return true;
    const member = await channel.guild.members.fetch(executorId).catch(() => null);
    const roleIds = member ? [...member.roles.cache.keys()] : [];
    return WhitelistService.isWhitelisted({ guildId: channel.guild.id, userId: executorId, roleIds });
  }
}
