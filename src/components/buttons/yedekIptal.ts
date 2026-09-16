import type { ButtonInteraction } from "discord.js";
import { InfoEmbed } from "@/utils/embeds";
import { t } from "@/localization";
import { resolveLanguages } from "@/services/LanguageService";
import type { ButtonHandler } from "@/services/ComponentRegistry";

export const customId = "yedek:iptal";

export const execute: ButtonHandler["execute"] = async (interaction: ButtonInteraction) => {
  const { lang, guildLang } = interaction.guild
    ? await resolveLanguages(interaction.guild.id, interaction.user.id)
    : {};
  await interaction.update({
    embeds: [new InfoEmbed(t("settings.backup.cancelled.title", { lang, guildLang }), t("settings.backup.cancelled.description", { lang, guildLang }))],
    components: [],
  });
};
