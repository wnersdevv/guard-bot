import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  type ChatInputCommandInteraction,
} from "discord.js";
import { GuildSettingsModel } from "@/models/GuildSettings";
import { SuccessEmbed, ErrorEmbed, InfoEmbed } from "@/utils/embeds";
import { isDatabaseAvailable } from "@/database/connection";
import { t } from "@/localization";
import { resolveLanguages } from "@/services/LanguageService";

export const data = new SlashCommandBuilder()
  .setName("ayarlar")
  .setDescription("WnersGuard ayarlarını yapılandır")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand((sub) =>
    sub
      .setName("log-kanali")
      .setDescription("Güvenlik log kanalını ayarla")
      .addChannelOption((opt) =>
        opt.setName("kanal").setDescription("Log kanalı").addChannelTypes(ChannelType.GuildText).setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("alert-kanali")
      .setDescription("Güvenlik uyarı kanalını ayarla")
      .addChannelOption((opt) =>
        opt.setName("kanal").setDescription("Alert kanalı").addChannelTypes(ChannelType.GuildText).setRequired(true),
      ),
  )
  .addSubcommand((sub) => sub.setName("goster").setDescription("Mevcut ayarları göster"));

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;
  const { lang, guildLang } = await resolveLanguages(interaction.guild.id, interaction.user.id);

  if (!isDatabaseAvailable()) {
    await interaction.reply({ embeds: [new ErrorEmbed("Hata", t("settings.dbUnavailable", { lang, guildLang }))], ephemeral: true });
    return;
  }

  const sub = interaction.options.getSubcommand();
  const guildId = interaction.guild.id;

  if (sub === "log-kanali") {
    const channel = interaction.options.getChannel("kanal", true);
    await GuildSettingsModel.findOneAndUpdate(
      { guildId },
      { $set: { logChannelId: channel.id } },
      { upsert: true, setDefaultsOnInsert: true },
    );
    await interaction.reply({
      embeds: [
        new SuccessEmbed(
          t("settings.logChannel.set.title", { lang, guildLang }),
          t("settings.logChannel.set.description", { lang, guildLang, vars: { channel: `<#${channel.id}>` } }),
        ),
      ],
      ephemeral: true,
    });
    return;
  }

  if (sub === "alert-kanali") {
    const channel = interaction.options.getChannel("kanal", true);
    await GuildSettingsModel.findOneAndUpdate(
      { guildId },
      { $set: { alertChannelId: channel.id } },
      { upsert: true, setDefaultsOnInsert: true },
    );
    await interaction.reply({
      embeds: [
        new SuccessEmbed(
          t("settings.alertChannel.set.title", { lang, guildLang }),
          t("settings.alertChannel.set.description", { lang, guildLang, vars: { channel: `<#${channel.id}>` } }),
        ),
      ],
      ephemeral: true,
    });
    return;
  }

  if (sub === "goster") {
    const settings = await GuildSettingsModel.findOne({ guildId }).lean();
    const notSet = t("settings.show.notSet", { lang, guildLang });
    const embed = new InfoEmbed(t("settings.show.title", { lang, guildLang })).addFields(
      { name: t("settings.show.language", { lang, guildLang }), value: settings?.language ?? "tr", inline: true },
      { name: t("settings.show.logChannel", { lang, guildLang }), value: settings?.logChannelId ? `<#${settings.logChannelId}>` : notSet, inline: true },
      { name: t("settings.show.alertChannel", { lang, guildLang }), value: settings?.alertChannelId ? `<#${settings.alertChannelId}>` : notSet, inline: true },
      {
        name: t("settings.show.maintenance", { lang, guildLang }),
        value: settings?.maintenanceMode ? t("settings.show.on", { lang, guildLang }) : t("settings.show.off", { lang, guildLang }),
        inline: true,
      },
    );
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
}
