import { SlashCommandBuilder, PermissionFlagsBits, type ChatInputCommandInteraction } from "discord.js";
import { GuildSettingsModel } from "@/models/GuildSettings";
import { WarningEmbed, SuccessEmbed, ErrorEmbed } from "@/utils/embeds";
import { isDatabaseAvailable } from "@/database/connection";
import { ModerationService } from "@/services/ModerationService";
import { t } from "@/localization";
import { resolveLanguages } from "@/services/LanguageService";

export const data = new SlashCommandBuilder()
  .setName("acil-durum")
  .setDescription("Emergency Mode'u aç/kapat")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addBooleanOption((o) => o.setName("durum").setDescription("true: aç, false: kapat").setRequired(true));

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;
  const { lang, guildLang } = await resolveLanguages(interaction.guild.id, interaction.user.id);

  if (!isDatabaseAvailable()) {
    await interaction.reply({ embeds: [new ErrorEmbed("Hata", t("settings.dbUnavailable", { lang, guildLang }))], ephemeral: true });
    return;
  }

  const enable = interaction.options.getBoolean("durum", true);

  await GuildSettingsModel.findOneAndUpdate(
    { guildId: interaction.guild.id },
    { $set: { emergencyMode: enable } },
    { upsert: true, setDefaultsOnInsert: true },
  );

  if (enable) {
    const embed = new WarningEmbed("WnersGuard Emergency Mode", t("settings.emergency.on.description", { lang, guildLang }));
    await interaction.reply({ embeds: [embed] });
    await ModerationService.notifyLogChannel(interaction.guild, { embeds: [embed] });
  } else {
    const embed = new SuccessEmbed(t("settings.emergency.off.title", { lang, guildLang }), t("settings.emergency.off.description", { lang, guildLang }));
    await interaction.reply({ embeds: [embed] });
    await ModerationService.notifyLogChannel(interaction.guild, { embeds: [embed] });
  }
}
