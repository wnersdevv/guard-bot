import { AuditLogEvent, type Guild, type GuildAuditLogsEntry } from "discord.js";
import { securityLogger } from "@/utils/logger";
import { getRedisClient, isRedisAvailable } from "@/database/redis";

export interface AuditLookupResult {
  executorId: string | null;
  /** Audit log entry ID, when found — used by callers to dedupe double-fired gateway events. */
  entryId: string | null;
}

const PROCESSED_ENTRY_TTL_MS = 60_000;
const processedEntries = new Map<string, number>();

function sweepProcessedEntries(): void {
  const now = Date.now();
  for (const [id, seenAt] of processedEntries) {
    if (now - seenAt > PROCESSED_ENTRY_TTL_MS) processedEntries.delete(id);
  }
}

/** In-memory dedupe check — the default, and the automatic fallback if Redis errors. */
function isDuplicateInMemory(entryId: string): boolean {
  sweepProcessedEntries();
  if (processedEntries.has(entryId)) return true;
  processedEntries.set(entryId, Date.now());
  return false;
}

/**
 * Wraps Discord's audit log API to resolve the real executor behind an event.
 * If the executor cannot be determined with confidence, callers MUST treat it
 * as unknown rather than guessing — never blame a user without audit-log proof.
 */
export class AuditEngine {
  static async findExecutor(guild: Guild, action: AuditLogEvent, targetId?: string, withinMs = 5000): Promise<string | null> {
    return (await this.findExecutorEntry(guild, action, targetId, withinMs)).executorId;
  }

  /**
   * Same lookup as findExecutor, but also returns the audit log entry ID so
   * callers can dedupe a gateway event that fires twice for the same
   * underlying action (a known Discord/library quirk) — see isDuplicateEntry.
   */
  static async findExecutorEntry(
    guild: Guild,
    action: AuditLogEvent,
    targetId?: string,
    withinMs = 5000,
  ): Promise<AuditLookupResult> {
    try {
      const logs = await guild.fetchAuditLogs({ type: action, limit: 5 });
      const now = Date.now();

      const entry = logs.entries.find((e: GuildAuditLogsEntry) => {
        const recent = now - e.createdTimestamp <= withinMs;
        const matchesTarget = !targetId || e.target?.id === targetId;
        return recent && matchesTarget;
      });

      return { executorId: entry?.executor?.id ?? null, entryId: entry?.id ?? null };
    } catch (err) {
      securityLogger.warn({ err, action }, "Audit log lookup failed — executor unknown");
      return { executorId: null, entryId: null };
    }
  }

  /**
   * Marks an audit log entry ID as processed and reports whether it was
   * already seen within the TTL — first call for a given entry ID always
   * returns false. Uses Redis (`SET key val EX 60 NX`) when configured and
   * connected, so multiple bot instances share one dedupe view instead of
   * each instance separately re-processing the same resent gateway event;
   * falls back to the in-memory map on any Redis error or when Redis isn't
   * configured at all.
   */
  static async isDuplicateEntry(entryId: string | null): Promise<boolean> {
    if (!entryId) return false; // no entry ID to dedupe on — treat as not-a-duplicate, never silently drop

    if (isRedisAvailable()) {
      try {
        const redis = getRedisClient();
        if (!redis) throw new Error("Redis client unavailable");
        const result = await redis.set(`wg:dedupe:${entryId}`, "1", "EX", PROCESSED_ENTRY_TTL_MS / 1000, "NX");
        return result === null; // null means the key already existed — a duplicate
      } catch (err) {
        securityLogger.warn({ err, entryId }, "Redis dedupe check failed — falling back to in-memory");
      }
    }

    return isDuplicateInMemory(entryId);
  }

  /** In-memory-only cleanup; Redis dedupe keys self-expire via TTL and need no sweep. */
  static sweep(): void {
    sweepProcessedEntries();
  }
}

