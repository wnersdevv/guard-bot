import { SlashCommandBuilder, PermissionFlagsBits, type ChatInputCommandInteraction } from "discord.js";
import { SecurityEmbed, ErrorEmbed } from "@/utils/embeds";
import { SecurityEventModel } from "@/models/SecurityEvent";
import { isDatabaseAvailable } from "@/database/connection";
import { t } from "@/localization";
import { resolveLanguages } from "@/services/LanguageService";

export const data = new SlashCommandBuilder()
  .setName("loglar")
  .setDescription("Son güvenlik olaylarını göster")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addIntegerOption((o) => o.setName("adet").setDescription("Gösterilecek kayıt sayısı (1-20)").setMinValue(1).setMaxValue(20));

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;
  const { lang, guildLang } = await resolveLanguages(interaction.guild.id, interaction.user.id);

  if (!isDatabaseAvailable()) {
    await interaction.reply({ embeds: [new ErrorEmbed("Hata", t("moderation.dbUnavailable", { lang, guildLang }))], ephemeral: true });
    return;
  }

  const limit = interaction.options.getInteger("adet") ?? 10;
  const events = await SecurityEventModel.find({ guildId: interaction.guild.id })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  const description = events.length
    ? events
        .map(
          (e) =>
            `**${e.type}** — ${e.severity} (${e.riskScore}/100) — ${e.action}${e.executorId ? ` — <@${e.executorId}>` : ""} — <t:${Math.floor(new Date(e.createdAt as unknown as string).getTime() / 1000)}:R>`,
        )
        .join("\n")
    : t("moderation.logs.empty", { lang, guildLang });

  await interaction.reply({
    embeds: [new SecurityEmbed(t("moderation.logs.title", { lang, guildLang, vars: { count: events.length } }), description)],
    ephemeral: true,
  });
}
