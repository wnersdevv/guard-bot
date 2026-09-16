import type { Client, GuildChannel } from "discord.js";
import { AntiNukeModule } from "@/security/AntiNuke/AntiNukeModule";
import { AntiRaidModule } from "@/security/AntiRaid/AntiRaidModule";
import { AntiSpamModule } from "@/security/AntiSpam/AntiSpamModule";
import { AntiMentionModule } from "@/security/AntiMention/AntiMentionModule";
import { AntiWebhookModule } from "@/security/AntiWebhook/AntiWebhookModule";
import { AntiBotModule } from "@/security/AntiBot/AntiBotModule";
import { RoleProtectionModule } from "@/security/RoleProtection/RoleProtectionModule";
import { ChannelProtectionModule } from "@/security/ChannelProtection/ChannelProtectionModule";
import { ServerProtectionModule } from "@/security/ServerProtection/ServerProtectionModule";
import { discordLogger } from "@/utils/logger";

/** Wires raw Discord gateway events to the relevant security modules. */
export function registerGuildEvents(client: Client): void {
  client.on("channelDelete", async (channel) => {
    if (!("guild" in channel) || !channel.guild) return;
    await AntiNukeModule.onChannelDelete(channel.guild, channel.id).catch((err) =>
      discordLogger.error({ err }, "onChannelDelete handler failed"),
    );
  });

  client.on("channelCreate", async (channel) => {
    if (!("guild" in channel) || !channel.guild) return;
    await AntiNukeModule.onChannelCreate(channel.guild, channel.id).catch((err) =>
      discordLogger.error({ err }, "onChannelCreate handler failed"),
    );
  });

  client.on("channelUpdate", async (oldChannel, newChannel) => {
    if (!("guild" in newChannel) || !newChannel.guild) return;
    if (!("guild" in oldChannel)) return;
    await ChannelProtectionModule.onChannelUpdate(oldChannel as unknown as GuildChannel, newChannel as unknown as GuildChannel).catch((err) =>
      discordLogger.error({ err }, "onChannelUpdate handler failed"),
    );
  });

  client.on("roleDelete", async (role) => {
    await AntiNukeModule.onRoleDelete(role.guild, role.id).catch((err) =>
      discordLogger.error({ err }, "onRoleDelete handler failed"),
    );
  });

  client.on("roleCreate", async (role) => {
    if (role.permissions.has("Administrator")) {
      await AntiNukeModule.onDangerousRoleCreate(role.guild, role.id, role.permissions.bitfield).catch((err) =>
        discordLogger.error({ err }, "onDangerousRoleCreate handler failed"),
      );
    }
  });

  client.on("roleUpdate", async (oldRole, newRole) => {
    await RoleProtectionModule.onRoleUpdate(oldRole, newRole).catch((err) =>
      discordLogger.error({ err }, "onRoleUpdate handler failed"),
    );
  });

  client.on("guildUpdate", async (oldGuild, newGuild) => {
    await ServerProtectionModule.onGuildUpdate(oldGuild, newGuild).catch((err) =>
      discordLogger.error({ err }, "onGuildUpdate handler failed"),
    );
  });

  client.on("webhooksUpdate", async (channel) => {
    if (!("guild" in channel) || !channel.guild) return;
    await AntiNukeModule.onWebhookCreate(channel.guild, channel.id).catch((err) =>
      discordLogger.error({ err }, "onWebhookCreate handler failed"),
    );
  });

  client.on("guildMemberAdd", async (member) => {
    await AntiRaidModule.onMemberJoin(member.guild, member).catch((err) =>
      discordLogger.error({ err }, "onMemberJoin handler failed"),
    );
    await AntiBotModule.onBotJoin(member.guild, member).catch((err) =>
      discordLogger.error({ err }, "onBotJoin handler failed"),
    );
  });

  client.on("messageCreate", async (message) => {
    if (message.webhookId) {
      await AntiWebhookModule.onWebhookMessage(message).catch((err) =>
        discordLogger.error({ err }, "onWebhookMessage handler failed"),
      );
      return;
    }
    await AntiSpamModule.onMessageCreate(message).catch((err) =>
      discordLogger.error({ err }, "AntiSpam onMessageCreate handler failed"),
    );
    await AntiMentionModule.onMessageCreate(message).catch((err) =>
      discordLogger.error({ err }, "AntiMention onMessageCreate handler failed"),
    );
  });
}
