import type { Guild, Message } from "discord.js";
import { ThreatEngine } from "@/engines/ThreatEngine";
import { ResponseEngine } from "@/engines/ResponseEngine";
import { globalRateLimiter } from "@/utils/rateLimiter";
import { isModuleEnabled } from "@/middleware/moduleGuard";

const WEBHOOK_MESSAGE_WINDOW_MS = 10_000;
const WEBHOOK_MESSAGE_THRESHOLD = 8;

/**
 * Anti-Webhook (message-abuse half): webhook *creation* bursts are handled
 * by AntiNukeModule.onWebhookCreate — this module covers the other half,
 * a compromised or malicious webhook being used to flood a channel with
 * messages after the fact. There's no "executor" here (a webhook message
 * has no member behind it in the gateway payload) — the webhook ID itself
 * is the target.
 */
export class AntiWebhookModule {
  static async onWebhookMessage(message: Message): Promise<void> {
    if (!message.guild || !message.webhookId) return;
    const guild = message.guild;
    if (!(await isModuleEnabled(guild.id, "antiWebhook"))) return;

    const bucketKey = `${guild.id}:webhookMessages:${message.webhookId}`;
    const hits = await globalRateLimiter.hit(bucketKey, WEBHOOK_MESSAGE_WINDOW_MS);
    if (hits < WEBHOOK_MESSAGE_THRESHOLD) return;

    const { score, severity, reasons } = ThreatEngine.score([
      {
        reason: `${hits} messages from webhook ${message.webhookId} within ${WEBHOOK_MESSAGE_WINDOW_MS}ms`,
        weight: 55,
      },
    ]);

    await this.reportAndMaybeDelete(guild, message, score, severity, reasons);
    await globalRateLimiter.reset(bucketKey);
  }

  private static async reportAndMaybeDelete(
    guild: Guild,
    message: Message,
    score: number,
    severity: ReturnType<typeof ThreatEngine.score>["severity"],
    reasons: string[],
  ): Promise<void> {
    await ResponseEngine.handle(guild, severity, {
      guildId: guild.id,
      type: "antiWebhook.messageAbuse",
      executorId: null,
      targetId: message.webhookId ?? null,
      riskScore: score,
      severity,
      action: "LOGGED",
      metadata: { reasons, channelId: message.channelId },
    });

    if (severity === "HIGH" || severity === "CRITICAL") {
      await message.delete().catch(() => undefined);
    }
  }
}
