import type { Guild } from "discord.js";
import { AttachmentBuilder } from "discord.js";
import type { ThreatSeverity } from "@/config/constants";
import { SecurityEventModel } from "@/models/SecurityEvent";
import { GuildSettingsModel } from "@/models/GuildSettings";
import { isDatabaseAvailable } from "@/database/connection";
import { securityBus } from "@/engines/EventBus";
import { securityLogger } from "@/utils/logger";
import { ThreatAlertEmbed } from "@/utils/embeds";
import { renderThreatCard } from "@/canvas/ThreatCardCanvas";
import { isEmergencyMode } from "@/middleware/emergencyGuard";
import { AutoProtectionService } from "@/services/AutoProtectionService";
import type { SecurityEventInput } from "@/types";

/**
 * Turns a threat score into a real action. Deliberately conservative:
 * irreversible moderation actions (bans, mass-role-strips) are never
 * fired purely off a score — they require threshold + grace period +
 * whitelist checks upstream, and this engine only executes what the
 * calling module has already decided is safe to automate.
 *
 * The one exception, and the only place this engine escalates beyond
 * logging/alerting on its own: CRITICAL severity while Emergency Mode is
 * active triggers AutoProtectionService, which applies a short (10 min),
 * reversible timeout to a known non-whitelisted executor. See that
 * service for the full guardrails — this is opt-in by nature of Emergency
 * Mode being an explicit admin action (/acil-durum), never the default.
 */
export class ResponseEngine {
  static async handle(guild: Guild, severity: ThreatSeverity, input: SecurityEventInput): Promise<void> {
    const emergency = isDatabaseAvailable() ? await isEmergencyMode(guild.id) : false;
    const escalated = severity === "MEDIUM" && emergency ? "HIGH" : severity;
    let action = this.actionFor(escalated);

    if (escalated === "CRITICAL" && emergency) {
      // Nuke-type events punish the executor; raid-type events have no executor
      // (nobody "did" anything wrong — the target *is* the suspicious joiner).
      const subjectId = input.executorId ?? (input.type.startsWith("antiRaid") ? input.targetId : null);
      const punished = await AutoProtectionService.applyIfWarranted(guild, subjectId, input.type);
      if (punished) action = "PUNISHED";
    }

    const finalInput: SecurityEventInput = { ...input, severity: escalated, action };

    await this.persist(finalInput);
    securityBus.emit("security.threat", finalInput);

    if (action === "BLOCKED" || action === "PUNISHED") {
      securityBus.emit("security.block", finalInput);
    }

    if (escalated === "HIGH" || escalated === "CRITICAL") {
      await this.alert(guild, finalInput);
    }
  }

  private static actionFor(severity: ThreatSeverity): SecurityEventInput["action"] {
    switch (severity) {
      case "LOW":
        return "LOGGED";
      case "MEDIUM":
        return "ALERTED";
      case "HIGH":
      case "CRITICAL":
        return "BLOCKED";
    }
  }

  private static async persist(input: SecurityEventInput): Promise<void> {
    if (!isDatabaseAvailable()) {
      securityLogger.warn({ input }, "DB unavailable — security event logged to console only");
      return;
    }
    try {
      await SecurityEventModel.create(input);
    } catch (err) {
      securityLogger.error({ err }, "Failed to persist security event");
    }
  }

  private static async alert(guild: Guild, input: SecurityEventInput): Promise<void> {
    try {
      const settings = isDatabaseAvailable()
        ? await GuildSettingsModel.findOne({ guildId: guild.id })
        : null;
      const channelId = settings?.alertChannelId;
      if (!channelId) return;

      const channel = await guild.channels.fetch(channelId).catch(() => null);
      if (!channel || !channel.isTextBased()) return;

      const embed = new ThreatAlertEmbed({
        eventName: input.type,
        riskScore: input.riskScore,
        severity: input.severity,
        action: input.action,
        executor: input.executorId ? `<@${input.executorId}>` : undefined,
      });

      const cardBuffer = renderThreatCard({
        eventName: input.type,
        riskScore: input.riskScore,
        severity: input.severity,
        status: input.action,
      });
      const attachment = new AttachmentBuilder(cardBuffer, { name: "threat-card.png" });
      embed.setImage("attachment://threat-card.png");

      await channel.send({ embeds: [embed], files: [attachment] });
    } catch (err) {
      securityLogger.error({ err }, "Failed to send security alert");
    }
  }
}
