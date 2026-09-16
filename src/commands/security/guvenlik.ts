import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ChatInputCommandInteraction,
} from "discord.js";
import { SecurityEmbed } from "@/utils/embeds";
import { t } from "@/localization";
import { GuildSettingsModel } from "@/models/GuildSettings";
import { isDatabaseAvailable } from "@/database/connection";
import type { SupportedLanguage } from "@/config/constants";

export const data = new SlashCommandBuilder()
  .setName("guvenlik")
  .setDescription("WnersGuard Security Center")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;

  const settings = isDatabaseAvailable()
    ? await GuildSettingsModel.findOne({ guildId: interaction.guild.id }).lean()
    : null;
  const lang = (settings?.language as SupportedLanguage | undefined) ?? undefined;
  const maintenance = settings?.maintenanceMode ?? false;

  const embed = new SecurityEmbed(t("center.title", { ns: "security", guildLang: lang }))
    .setDescription(
      `🟢 ${t(maintenance ? "center.status.maintenance" : "center.status.active", { ns: "security", guildLang: lang })}\n\n` +
        `🟢 Anti-Nuke\n🟢 Anti-Raid\n🟢 Anti-Spam\n🟢 Audit Protection`,
    );

  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("guvenlik:koruma").setLabel(t("center.buttons.protection", { ns: "security", guildLang: lang })).setEmoji("🛡️").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("guvenlik:tehditler").setLabel(t("center.buttons.threats", { ns: "security", guildLang: lang })).setEmoji("🚨").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("guvenlik:loglar").setLabel(t("center.buttons.logs", { ns: "security", guildLang: lang })).setEmoji("📋").setStyle(ButtonStyle.Secondary),
  );

  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("guvenlik:ayarlar").setLabel(t("center.buttons.settings", { ns: "security", guildLang: lang })).setEmoji("⚙️").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("guvenlik:istatistik").setLabel(t("center.buttons.stats", { ns: "security", guildLang: lang })).setEmoji("📊").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("guvenlik:sistem").setLabel(t("center.buttons.system", { ns: "security", guildLang: lang })).setEmoji("🔧").setStyle(ButtonStyle.Secondary),
  );

  await interaction.reply({ embeds: [embed], components: [row1, row2] });
}
