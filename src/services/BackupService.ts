import type { Guild } from "discord.js";
import { ChannelType } from "discord.js";
import { BackupModel, type BackupDoc } from "@/models/Backup";
import { GuildSettingsModel } from "@/models/GuildSettings";
import { isDatabaseAvailable } from "@/database/connection";
import { securityLogger } from "@/utils/logger";

interface SerializedRole {
  id: string;
  name: string;
  color: number;
  hoist: boolean;
  position: number;
  permissions: string;
  mentionable: boolean;
}

interface SerializedChannel {
  id: string;
  name: string;
  type: number;
  parentId: string | null;
  position: number;
  topic?: string | null;
}

interface SerializedCategory {
  id: string;
  name: string;
  position: number;
}

/**
 * Snapshot/restore of a guild's structural configuration. Restore only ever
 * re-creates what Discord's API allows (it cannot restore message history,
 * exact IDs, or anything the bot lacks permission for) — callers must gate
 * restore behind an explicit confirmation button, never fire it straight
 * from a command.
 */
export class BackupService {
  static async create(guild: Guild, name: string, createdBy: string): Promise<BackupDoc | null> {
    if (!isDatabaseAvailable()) {
      securityLogger.warn({ guildId: guild.id }, "DB unavailable — backup not created");
      return null;
    }

    const roles: SerializedRole[] = guild.roles.cache
      .filter((r) => r.id !== guild.id) // skip @everyone
      .map((r) => ({
        id: r.id,
        name: r.name,
        color: r.color,
        hoist: r.hoist,
        position: r.position,
        permissions: r.permissions.bitfield.toString(),
        mentionable: r.mentionable,
      }));

    const categories: SerializedCategory[] = guild.channels.cache
      .filter((c) => c.type === ChannelType.GuildCategory)
      .map((c) => ({ id: c.id, name: c.name, position: c.position }));

    const channels: SerializedChannel[] = guild.channels.cache
      .filter((c) => c.type !== ChannelType.GuildCategory)
      .map((c) => ({
        id: c.id,
        name: c.name,
        type: c.type,
        parentId: c.parentId,
        position: "position" in c ? (c.position as number) : 0,
        topic: "topic" in c ? (c.topic as string | null) : null,
      }));

    const settings = await GuildSettingsModel.findOne({ guildId: guild.id }).lean();

    return BackupModel.create({
      guildId: guild.id,
      name,
      createdBy,
      data: {
        categories,
        channels,
        roles,
        settings: settings ?? {},
      },
    });
  }

  static async list(guildId: string): Promise<BackupDoc[]> {
    if (!isDatabaseAvailable()) return [];
    return BackupModel.find({ guildId }).sort({ createdAt: -1 }).limit(10).lean();
  }

  static async findByName(guildId: string, name: string): Promise<BackupDoc | null> {
    if (!isDatabaseAvailable()) return null;
    return BackupModel.findOne({ guildId, name }).sort({ createdAt: -1 }).lean();
  }

  /**
   * Re-creates roles and categories/channels from a snapshot. Existing
   * items are left untouched — restore is additive, never destructive,
   * so a bad restore can't be used to wipe a server.
   */
  static async restore(guild: Guild, backup: BackupDoc): Promise<{ rolesCreated: number; channelsCreated: number }> {
    let rolesCreated = 0;
    let channelsCreated = 0;

    const roleIdMap = new Map<string, string>();

    for (const role of (backup.data?.roles ?? []) as SerializedRole[]) {
      const exists = guild.roles.cache.some((r) => r.name === role.name);
      if (exists) continue;
      const created = await guild.roles
        .create({
          name: role.name,
          color: role.color,
          hoist: role.hoist,
          mentionable: role.mentionable,
          permissions: BigInt(role.permissions),
          reason: `WnersGuard backup restore: ${backup.name}`,
        })
        .catch((err) => {
          securityLogger.error({ err, role: role.name }, "Failed to restore role");
          return null;
        });
      if (created) {
        roleIdMap.set(role.id, created.id);
        rolesCreated += 1;
      }
    }

    const categoryIdMap = new Map<string, string>();
    for (const category of (backup.data?.categories ?? []) as SerializedCategory[]) {
      const exists = guild.channels.cache.some((c) => c.name === category.name && c.type === ChannelType.GuildCategory);
      if (exists) continue;
      const created = await guild.channels
        .create({ name: category.name, type: ChannelType.GuildCategory, reason: `WnersGuard backup restore: ${backup.name}` })
        .catch(() => null);
      if (created) categoryIdMap.set(category.id, created.id);
    }

    for (const channel of (backup.data?.channels ?? []) as SerializedChannel[]) {
      const exists = guild.channels.cache.some((c) => c.name === channel.name && c.type === channel.type);
      if (exists) continue;
      const parentId = channel.parentId ? categoryIdMap.get(channel.parentId) ?? null : null;
      const created = await guild.channels
        .create({
          name: channel.name,
          type: channel.type,
          parent: parentId ?? undefined,
          topic: channel.topic ?? undefined,
          reason: `WnersGuard backup restore: ${backup.name}`,
        })
        .catch((err) => {
          securityLogger.error({ err, channel: channel.name }, "Failed to restore channel");
          return null;
        });
      if (created) channelsCreated += 1;
    }

    return { rolesCreated, channelsCreated };
  }
}
