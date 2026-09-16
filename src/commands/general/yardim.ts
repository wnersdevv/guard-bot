import { SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import { InfoEmbed } from "@/utils/embeds";
import { t } from "@/localization";
import { resolveLanguages } from "@/services/LanguageService";
import { BRAND } from "@/config/constants";

export const data = new SlashCommandBuilder().setName("yardim").setDescription("WnersGuard komutlarını listele");

const SECURITY_COMMANDS = ["/guvenlik", "/koruma", "/loglar", "/acil-durum", "/yedek"];
const MODERATION_COMMANDS = ["/uyar", "/sustur", "/at", "/yasakla", "/kullanici"];
const SETTINGS_COMMANDS = ["/ayarlar", "/dil"];

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guild?.id;
  const { lang, guildLang } = guildId ? await resolveLanguages(guildId, interaction.user.id) : {};

  const embed = new InfoEmbed(
    `🛡️ ${BRAND.PRODUCT} — ${t("general.help.title", { lang, guildLang })}`,
    t("general.help.intro", { lang, guildLang }),
  ).addFields(
    { name: t("general.help.section.security", { lang, guildLang }), value: SECURITY_COMMANDS.join(", ") },
    { name: t("general.help.section.moderation", { lang, guildLang }), value: MODERATION_COMMANDS.join(", ") },
    { name: t("general.help.section.settings", { lang, guildLang }), value: SETTINGS_COMMANDS.join(", ") },
    { name: "ℹ️", value: t("general.help.footer", { lang, guildLang }) },
  );

  await interaction.reply({ embeds: [embed], ephemeral: true });
}
