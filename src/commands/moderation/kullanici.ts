import { SlashCommandBuilder, PermissionFlagsBits, type ChatInputCommandInteraction } from "discord.js";
import { InfoEmbed } from "@/utils/embeds";
import { PunishmentModel } from "@/models/Punishment";
import { SecurityEventModel } from "@/models/SecurityEvent";
import { WhitelistModel } from "@/models/Whitelist";
import { isDatabaseAvailable } from "@/database/connection";
import { t } from "@/localization";
import { resolveLanguages } from "@/services/LanguageService";

export const data = new SlashCommandBuilder()
  .setName("kullanici")
  .setDescription("Bir kullanıcının güvenlik profilini görüntüle")
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .addUserOption((o) => o.setName("kullanici").setDescription("İncelenecek kullanıcı").setRequired(true));

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;
  const target = interaction.options.getUser("kullanici", true);
  const member = await interaction.guild.members.fetch(target.id).catch(() => null);
  const { lang, guildLang } = await resolveLanguages(interaction.guild.id, interaction.user.id);

  const embed = new InfoEmbed(t("moderation.profile.title", { lang, guildLang, vars: { tag: target.tag } })).addFields(
    { name: t("moderation.profile.accountAge", { lang, guildLang }), value: `<t:${Math.floor(target.createdTimestamp / 1000)}:R>`, inline: true },
    {
      name: t("moderation.profile.joinedAt", { lang, guildLang }),
      value: member ? `<t:${Math.floor((member.joinedTimestamp ?? Date.now()) / 1000)}:R>` : t("moderation.profile.unknown", { lang, guildLang }),
      inline: true,
    },
  );

  if (!isDatabaseAvailable()) {
    embed.setDescription(t("moderation.profile.dbUnavailableNote", { lang, guildLang }));
    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  const [punishments, threatEvents, whitelisted] = await Promise.all([
    PunishmentModel.find({ guildId: interaction.guild.id, targetId: target.id }).sort({ createdAt: -1 }).limit(5).lean(),
    SecurityEventModel.countDocuments({ guildId: interaction.guild.id, executorId: target.id }),
    WhitelistModel.findOne({ guildId: interaction.guild.id, type: "USER", targetId: target.id }).lean(),
  ]);

  embed.addFields(
    {
      name: t("moderation.profile.whitelist", { lang, guildLang }),
      value: whitelisted ? t("moderation.yes", { lang, guildLang }) : t("moderation.no", { lang, guildLang }),
      inline: true,
    },
    { name: t("moderation.profile.triggeredEvents", { lang, guildLang }), value: String(threatEvents), inline: true },
    {
      name: t("moderation.profile.lastPunishments", { lang, guildLang }),
      value: punishments.length
        ? punishments.map((p) => `**${p.type}** — ${p.reason} — <t:${Math.floor(new Date(p.createdAt as unknown as string).getTime() / 1000)}:R>`).join("\n")
        : t("moderation.profile.noRecords", { lang, guildLang }),
    },
  );

  await interaction.reply({ embeds: [embed], ephemeral: true });
}
