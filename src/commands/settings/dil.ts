import {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import { SUPPORTED_LANGUAGES } from "@/config/constants";

const LANGUAGE_LABELS: Record<(typeof SUPPORTED_LANGUAGES)[number], string> = {
  tr: "🇹🇷 Türkçe",
  en: "🇬🇧 English",
  de: "🇩🇪 Deutsch",
  es: "🇪🇸 Español",
};

export const data = new SlashCommandBuilder().setName("dil").setDescription("Dil tercihinizi ayarlayın / Set your language");

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const menu = new StringSelectMenuBuilder()
    .setCustomId("dil:sec")
    .setPlaceholder("Dil seçin / Select language")
    .addOptions(SUPPORTED_LANGUAGES.map((lang) => ({ label: LANGUAGE_LABELS[lang], value: lang })));

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
  await interaction.reply({ components: [row], ephemeral: true });
}
