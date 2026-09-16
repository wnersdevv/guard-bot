import { AuditLogEvent, type Guild } from "discord.js";
import { ThreatEngine, type ThreatSignal } from "@/engines/ThreatEngine";
import { ResponseEngine } from "@/engines/ResponseEngine";
import { AuditEngine } from "@/engines/AuditEngine";
import { WhitelistService } from "@/services/WhitelistService";
import { isModuleEnabled } from "@/middleware/moduleGuard";

/**
 * Server Protection: watches guild-level settings that are rarely changed
 * legitimately and are common nuke-attack targets — name, icon, and
 * verification level.
 */
export class ServerProtectionModule {
  static async onGuildUpdate(oldGuild: Guild, newGuild: Guild): Promise<void> {
    if (!(await isModuleEnabled(newGuild.id, "serverProtection"))) return;
    const signals: ThreatSignal[] = [];

    if (oldGuild.name !== newGuild.name) {
      signals.push({ reason: `Server name changed: "${oldGuild.name}" → "${newGuild.name}"`, weight: 35 });
    }

    if (oldGuild.icon !== newGuild.icon) {
      signals.push({ reason: "Server icon changed", weight: 20 });
    }

    if (oldGuild.verificationLevel !== newGuild.verificationLevel) {
      const lowered = newGuild.verificationLevel < oldGuild.verificationLevel;
      signals.push({
        reason: `Verification level ${lowered ? "lowered" : "raised"}: ${oldGuild.verificationLevel} → ${newGuild.verificationLevel}`,
        weight: lowered ? 45 : 5,
      });
    }

    if (signals.length === 0) return;

    const executorId = await AuditEngine.findExecutor(newGuild, AuditLogEvent.GuildUpdate);
    if (executorId && (await this.isExecutorSafe(newGuild, executorId))) return;

    const { score, severity, reasons } = ThreatEngine.score(signals);
    if (severity === "LOW") return;

    await ResponseEngine.handle(newGuild, severity, {
      guildId: newGuild.id,
      type: "serverProtection.settingsChanged",
      executorId,
      targetId: null,
      riskScore: score,
      severity,
      action: "LOGGED",
      metadata: { reasons },
    });
  }

  private static async isExecutorSafe(guild: Guild, executorId: string): Promise<boolean> {
    if (executorId === guild.ownerId) return true;
    const member = await guild.members.fetch(executorId).catch(() => null);
    const roleIds = member ? [...member.roles.cache.keys()] : [];
    return WhitelistService.isWhitelisted({ guildId: guild.id, userId: executorId, roleIds });
  }
}
