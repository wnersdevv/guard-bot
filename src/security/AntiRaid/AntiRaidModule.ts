import type { Guild, GuildMember } from "discord.js";
import { ThreatEngine, type ThreatSignal } from "@/engines/ThreatEngine";
import { ResponseEngine } from "@/engines/ResponseEngine";
import { globalRateLimiter } from "@/utils/rateLimiter";
import { isEmergencyMode } from "@/middleware/emergencyGuard";
import { isModuleEnabled } from "@/middleware/moduleGuard";

const JOIN_WINDOW_MS = 10_000;
const JOIN_BURST_THRESHOLD = 8;
const NEW_ACCOUNT_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Anti-Raid: watches join velocity plus account-age / avatar signals to score
 * whether a wave of joins looks like a coordinated raid, rather than reacting
 * to a single join in isolation. In Emergency Mode the join-burst threshold
 * is halved, so a smaller wave is enough to trigger a response.
 */
export class AntiRaidModule {
  static async onMemberJoin(guild: Guild, member: GuildMember): Promise<void> {
    if (!(await isModuleEnabled(guild.id, "antiRaid"))) return;
    const bucketKey = `${guild.id}:joins`;
    const hits = await globalRateLimiter.hit(bucketKey, JOIN_WINDOW_MS);
    const emergency = await isEmergencyMode(guild.id);
    const burstThreshold = emergency ? Math.max(3, Math.floor(JOIN_BURST_THRESHOLD / 2)) : JOIN_BURST_THRESHOLD;

    const signals: ThreatSignal[] = [];

    if (hits >= burstThreshold) {
      signals.push({ reason: `${hits} joins within ${JOIN_WINDOW_MS}ms (threshold ${burstThreshold})`, weight: 40 });
    }

    const accountAgeMs = Date.now() - member.user.createdTimestamp;
    if (accountAgeMs < NEW_ACCOUNT_AGE_MS) {
      signals.push({ reason: "Account created within the last 7 days", weight: emergency ? 35 : 25 });
    }

    if (!member.user.avatar) {
      signals.push({ reason: "Default avatar (no custom avatar set)", weight: 10 });
    }

    if (signals.length === 0) return;

    const { score, severity, reasons } = ThreatEngine.score(signals);
    if (severity === "LOW") return; // not worth logging every ordinary join

    await ResponseEngine.handle(guild, severity, {
      guildId: guild.id,
      type: "antiRaid.joinBurst",
      executorId: null,
      targetId: member.id,
      riskScore: score,
      severity,
      action: "LOGGED",
      metadata: { reasons, accountAgeMs, emergency },
    });
  }
}
