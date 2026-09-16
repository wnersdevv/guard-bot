import type { ButtonInteraction } from "discord.js";
import { PermissionFlagsBits } from "discord.js";
import { BackupService } from "@/services/BackupService";
import { SuccessEmbed, ErrorEmbed } from "@/utils/embeds";
import { t } from "@/localization";
import { resolveLanguages } from "@/services/LanguageService";
import type { ButtonHandler } from "@/services/ComponentRegistry";

export const customId = "yedek:onayla";
export const isPrefix = true;

export const execute: ButtonHandler["execute"] = async (interaction: ButtonInteraction) => {
  if (!interaction.guild) return;
  const { lang, guildLang } = await resolveLanguages(interaction.guild.id, interaction.user.id);

  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ embeds: [new ErrorEmbed("Yetkisiz", "Bu işlem için Administrator yetkisi gerekir.")], ephemeral: true });
    return;
  }

  const name = interaction.customId.split(":").slice(2).join(":");
  const backup = await BackupService.findByName(interaction.guild.id, name);

  if (!backup) {
    await interaction.update({ embeds: [new ErrorEmbed("Hata", t("settings.backup.notFound", { lang, guildLang, vars: { name } }))], components: [] });
    return;
  }

  await interaction.update({ embeds: [new SuccessEmbed(t("settings.backup.restored.title", { lang, guildLang }), t("settings.backup.restoring", { lang, guildLang }))], components: [] });

  const result = await BackupService.restore(interaction.guild, backup);

  await interaction.followUp({
    embeds: [
      new SuccessEmbed(
        t("settings.backup.restored.title", { lang, guildLang }),
        t("settings.backup.restored.description", { lang, guildLang, vars: { name, roles: result.rolesCreated, channels: result.channelsCreated } }),
      ),
    ],
    ephemeral: true,
  });
};
