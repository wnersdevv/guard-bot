import type { StringSelectMenuInteraction } from "discord.js";
import { PermissionFlagsBits } from "discord.js";
import { GuildSettingsModel } from "@/models/GuildSettings";
import { SuccessEmbed, ErrorEmbed } from "@/utils/embeds";
import { isDatabaseAvailable } from "@/database/connection";
import type { SelectMenuHandler } from "@/services/ComponentRegistry";

const TOGGLEABLE = new Set([
  "antiNuke",
  "antiRaid",
  "antiSpam",
  "antiWebhook",
  "antiBot",
  "antiMention",
  "roleProtection",
  "channelProtection",
  "serverProtection",
]);

export const customId = "koruma:toggle";

export const execute: SelectMenuHandler["execute"] = async (interaction: StringSelectMenuInteraction) => {
  if (!interaction.guild || !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    await interaction.reply({ embeds: [new ErrorEmbed("Yetkisiz", "Bu işlem için Sunucuyu Yönet yetkisi gerekir.")], ephemeral: true });
    return;
  }

  const moduleKey = interaction.values[0];
  if (!TOGGLEABLE.has(moduleKey)) {
    await interaction.reply({ embeds: [new ErrorEmbed("Hata", "Geçersiz modül.")], ephemeral: true });
    return;
  }

  if (!isDatabaseAvailable()) {
    await interaction.reply({ embeds: [new ErrorEmbed("Hata", "Veritabanı şu anda kullanılamıyor, ayar değiştirilemedi.")], ephemeral: true });
    return;
  }

  const settings = await GuildSettingsModel.findOneAndUpdate(
    { guildId: interaction.guild.id },
    {},
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  const path = `modules.${moduleKey}` as const;
  const current = (settings.modules as unknown as Record<string, boolean>)[moduleKey] ?? true;
  const next = !current;

  await GuildSettingsModel.updateOne({ guildId: interaction.guild.id }, { $set: { [path]: next } });

  await interaction.reply({
    embeds: [new SuccessEmbed("Güncellendi", `**${moduleKey}** artık ${next ? "🟢 aktif" : "🔴 pasif"}.`)],
    ephemeral: true,
  });
};
