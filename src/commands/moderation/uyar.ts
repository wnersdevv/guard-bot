import { SlashCommandBuilder, PermissionFlagsBits, type ChatInputCommandInteraction } from "discord.js";
import { ModerationService } from "@/services/ModerationService";
import { SuccessEmbed, ErrorEmbed } from "@/utils/embeds";
import { t } from "@/localization";
import { resolveLanguages } from "@/services/LanguageService";

export const data = new SlashCommandBuilder()
  .setName("uyar")
  .setDescription("Bir kullanıcıyı uyar")
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .addUserOption((o) => o.setName("kullanici").setDescription("Uyarılacak kullanıcı").setRequired(true))
  .addStringOption((o) => o.setName("sebep").setDescription("Uyarı sebebi").setRequired(true));

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;
  const target = interaction.options.getUser("kullanici", true);
  const reason = interaction.options.getString("sebep", true);
  const { lang, guildLang } = await resolveLanguages(interaction.guild.id, interaction.user.id);

  if (target.id === interaction.user.id) {
    await interaction.reply({
      embeds: [new ErrorEmbed("Hata", t("moderation.warn.selfError", { lang, guildLang }))],
      ephemeral: true,
    });
    return;
  }

  await ModerationService.record({
    guildId: interaction.guild.id,
    type: "WARN",
    targetId: target.id,
    moderatorId: interaction.user.id,
    reason,
  });

  const embed = new SuccessEmbed(
    t("moderation.warn.title", { lang, guildLang }),
    t("moderation.warn.description", { lang, guildLang, vars: { user: `<@${target.id}>` } }),
  ).addFields(
    { name: t("moderation.fields.reason", { lang, guildLang }), value: reason },
    { name: t("moderation.fields.moderator", { lang, guildLang }), value: `<@${interaction.user.id}>` },
  );

  await interaction.reply({ embeds: [embed] });
  await ModerationService.notifyLogChannel(interaction.guild, { embeds: [embed] });
}
