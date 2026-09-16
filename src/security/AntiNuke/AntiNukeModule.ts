import { AuditLogEvent, type Guild } from "discord.js";
import { ThreatEngine } from "@/engines/ThreatEngine";
import { ResponseEngine } from "@/engines/ResponseEngine";
import { AuditEngine } from "@/engines/AuditEngine";
import { WhitelistService } from "@/services/WhitelistService";
import { globalRateLimiter } from "@/utils/rateLimiter";
import { DEFAULT_RATE_LIMITS } from "@/config/constants";
import { securityLogger } from "@/utils/logger";
import { isEmergencyMode } from "@/middleware/emergencyGuard";
import { isModuleEnabled } from "@/middleware/moduleGuard";

/**
 * Anti-Nuke: detects and responds to mass-destructive actions
 * (channel/role deletion bursts, dangerous permission grants, webhook abuse).
 *
 * Design: each Discord event handler records a hit against a per-guild,
 * per-executor rate-limit bucket. Crossing the threshold produces threat
 * signals which ThreatEngine scores, then ResponseEngine decides the action.
 * Whitelisted users/roles/bots never trigger a block, only (at most) a log.
 *
 * Double-event safety: Discord/discord.js occasionally re-emits the same
 * gateway event. Every handler resolves an audit-log *entry ID* and skips
 * processing if that exact entry was already handled in the last minute
 * (AuditEngine.isDuplicateEntry) — so a resend never double-counts toward a
 * burst threshold or files two SecurityEvents for one real action.
 */
export class AntiNukeModule {
  static async onChannelDelete(guild: Guild, channelId: string): Promise<void> {
    const { executorId, entryId } = await AuditEngine.findExecutorEntry(guild, AuditLogEvent.ChannelDelete, channelId);
    if (await AuditEngine.isDuplicateEntry(entryId)) return;
    await this.handleBurst(guild, executorId, "channelOperations", "antiNuke.massChannelDelete");
  }

  static async onChannelCreate(guild: Guild, channelId: string): Promise<void> {
    const { executorId, entryId } = await AuditEngine.findExecutorEntry(guild, AuditLogEvent.ChannelCreate, channelId);
    if (await AuditEngine.isDuplicateEntry(entryId)) return;
    await this.handleBurst(guild, executorId, "channelOperations", "antiNuke.massChannelCreate");
  }

  static async onRoleDelete(guild: Guild, roleId: string): Promise<void> {
    const { executorId, entryId } = await AuditEngine.findExecutorEntry(guild, AuditLogEvent.RoleDelete, roleId);
    if (await AuditEngine.isDuplicateEntry(entryId)) return;
    await this.handleBurst(guild, executorId, "roleChanges", "antiNuke.massRoleDelete");
  }

  static async onDangerousRoleCreate(guild: Guild, roleId: string, permissionBits: bigint): Promise<void> {
    if (!(await isModuleEnabled(guild.id, "antiNuke"))) return;
    const { executorId, entryId } = await AuditEngine.findExecutorEntry(guild, AuditLogEvent.RoleCreate, roleId);
    if (await AuditEngine.isDuplicateEntry(entryId)) return;
    if (executorId && (await this.isExecutorSafe(guild, executorId))) return;

    const { score, severity, reasons } = ThreatEngine.score([
      { reason: `High-privilege role created (bits: ${permissionBits.toString()})`, weight: 70 },
    ]);

    securityLogger.warn({ guildId: guild.id, executorId, score }, "Dangerous role creation detected");

    await ResponseEngine.handle(guild, severity, {
      guildId: guild.id,
      type: "antiNuke.dangerousRoleCreate",
      executorId,
      targetId: roleId,
      riskScore: score,
      severity,
      action: "LOGGED", // overwritten by ResponseEngine based on severity
      metadata: { reasons },
    });
  }

  static async onWebhookCreate(guild: Guild, channelId: string): Promise<void> {
    const { executorId, entryId } = await AuditEngine.findExecutorEntry(guild, AuditLogEvent.WebhookCreate, channelId);
    if (await AuditEngine.isDuplicateEntry(entryId)) return;
    await this.handleBurst(guild, executorId, "webhookOperations", "antiNuke.webhookAbuse");
  }

  private static async handleBurst(
    guild: Guild,
    executorId: string | null,
    limitKey: keyof typeof DEFAULT_RATE_LIMITS,
    eventType: string,
  ): Promise<void> {
    if (!(await isModuleEnabled(guild.id, "antiNuke"))) return;
    if (executorId && (await this.isExecutorSafe(guild, executorId))) return;

    const bucketKey = `${guild.id}:${limitKey}:${executorId ?? "unknown"}`;
    const base = DEFAULT_RATE_LIMITS[limitKey];
    const emergency = await isEmergencyMode(guild.id);
    // Emergency Mode halves the burst threshold (min 2) — sensitive operations
    // get flagged sooner while the guild is on high alert.
    const count = emergency ? Math.max(2, Math.floor(base.count / 2)) : base.count;
    const windowMs = base.windowMs;
    const hits = await globalRateLimiter.hit(bucketKey, windowMs);

    if (hits < count) return; // below threshold — no action, just tracked

    const overBy = hits - count;
    const { score, severity, reasons } = ThreatEngine.score([
      { reason: `${hits} operations within ${windowMs}ms (threshold ${count}${emergency ? ", emergency mode" : ""})`, weight: 60 + Math.min(30, overBy * 5) },
    ]);

    await ResponseEngine.handle(guild, severity, {
      guildId: guild.id,
      type: eventType,
      executorId,
      targetId: null,
      riskScore: score,
      severity,
      action: "LOGGED",
      metadata: { reasons, hits, windowMs, emergency },
    });

    await globalRateLimiter.reset(bucketKey);
  }

  private static async isExecutorSafe(guild: Guild, executorId: string): Promise<boolean> {
    if (executorId === guild.ownerId) return true;
    const member = await guild.members.fetch(executorId).catch(() => null);
    const roleIds = member ? [...member.roles.cache.keys()] : [];
    return WhitelistService.isWhitelisted({ guildId: guild.id, userId: executorId, roleIds });
  }
}
