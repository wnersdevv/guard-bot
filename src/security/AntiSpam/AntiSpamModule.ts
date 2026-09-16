import type { Guild, Message } from "discord.js";
import { ThreatEngine, type ThreatSignal } from "@/engines/ThreatEngine";
import { ResponseEngine } from "@/engines/ResponseEngine";
import { globalRateLimiter } from "@/utils/rateLimiter";
import { DEFAULT_RATE_LIMITS } from "@/config/constants";
import { WhitelistService } from "@/services/WhitelistService";
import { isModuleEnabled } from "@/middleware/moduleGuard";

const DUPLICATE_WINDOW_MS = 15_000;
const DUPLICATE_THRESHOLD = 3;
const INVITE_REGEX = /discord(?:\.gg|app\.com\/invite|\.com\/invite)\/[a-zA-Z0-9-]+/i;
const CAPS_MIN_LENGTH = 12;
const CAPS_RATIO_THRESHOLD = 0.7;

// last message content per user, for cheap duplicate-burst detection without a DB round-trip
const lastMessages = new Map<string, { content: string; count: number }>();

/**
 * Anti-Spam: message burst, duplicate messages, invite spam, excessive caps.
 * Mass @everyone/@here/role-mention spam is handled by AntiMentionModule —
 * kept separate so guilds can tune/disable mention protection independently
 * of general message-spam protection.
 */
export class AntiSpamModule {
  static async onMessageCreate(message: Message): Promise<void> {
    if (!message.guild || message.author.bot) return;
    const guild = message.guild;
    if (!(await isModuleEnabled(guild.id, "antiSpam"))) return;
    const authorId = message.author.id;

    if (await this.isSafe(guild, authorId)) return;

    const signals: ThreatSignal[] = [];

    const bucketKey = `${guild.id}:messages:${authorId}`;
    const { count, windowMs } = DEFAULT_RATE_LIMITS.messages;
    const hits = await globalRateLimiter.hit(bucketKey, windowMs);
    if (hits >= count) {
      signals.push({ reason: `${hits} messages within ${windowMs}ms (threshold ${count})`, weight: 35 });
    }

    const dupeKey = `${guild.id}:${authorId}`;
    const last = lastMessages.get(dupeKey);
    if (last && last.content === message.content && message.content.length > 0) {
      last.count += 1;
      if (last.count >= DUPLICATE_THRESHOLD) {
        signals.push({ reason: `Same message repeated ${last.count} times`, weight: 30 });
      }
    } else {
      lastMessages.set(dupeKey, { content: message.content, count: 1 });
    }
    setTimeout(() => {
      const entry = lastMessages.get(dupeKey);
      if (entry && entry.content === message.content) lastMessages.delete(dupeKey);
    }, DUPLICATE_WINDOW_MS);

    if (INVITE_REGEX.test(message.content)) {
      signals.push({ reason: "Unsolicited Discord invite link", weight: 20 });
    }

    if (message.content.length >= CAPS_MIN_LENGTH) {
      const letters = message.content.replace(/[^a-zA-Z]/g, "");
      const caps = message.content.replace(/[^A-Z]/g, "");
      if (letters.length > 0 && caps.length / letters.length >= CAPS_RATIO_THRESHOLD) {
        signals.push({ reason: "Excessive capitalization", weight: 10 });
      }
    }

    if (signals.length === 0) return;

    const { score, severity, reasons } = ThreatEngine.score(signals);
    if (severity === "LOW") return;

    await ResponseEngine.handle(guild, severity, {
      guildId: guild.id,
      type: "antiSpam.messageAbuse",
      executorId: authorId,
      targetId: message.channelId,
      riskScore: score,
      severity,
      action: "LOGGED",
      metadata: { reasons, channelId: message.channelId },
    });

    if (severity === "HIGH" || severity === "CRITICAL") {
      await message.delete().catch(() => undefined);
      await globalRateLimiter.reset(bucketKey);
    }
  }

  private static async isSafe(guild: Guild, userId: string): Promise<boolean> {
    if (userId === guild.ownerId) return true;
    const member = await guild.members.fetch(userId).catch(() => null);
    const roleIds = member ? [...member.roles.cache.keys()] : [];
    return WhitelistService.isWhitelisted({ guildId: guild.id, userId, roleIds });
  }
}
