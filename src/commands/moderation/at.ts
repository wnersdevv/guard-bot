import { SlashCommandBuilder, PermissionFlagsBits, type ChatInputCommandInteraction } from "discord.js";
import { ModerationService } from "@/services/ModerationService";
import { SuccessEmbed, ErrorEmbed } from "@/utils/embeds";
import { t } from "@/localization";
import { resolveLanguages } from "@/services/LanguageService";

export const data = new SlashCommandBuilder()
  .setName("at")
  .setDescription("Bir kullanıcıyı sunucudan at")
  .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
  .addUserOption((o) => o.setName("kullanici").setDescription("Atılacak kullanıcı").setRequired(true))
  .addStringOption((o) => o.setName("sebep").setDescription("Atılma sebebi").setRequired(false));

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;
  const target = interaction.options.getUser("kullanici", true);
  const { lang, guildLang } = await resolveLanguages(interaction.guild.id, interaction.user.id);
  const reason = interaction.options.getString("sebep") ?? t("moderation.reasonNotSpecified", { lang, guildLang });

  const member = await interaction.guild.members.fetch(target.id).catch(() => null);
  if (!member) {
    await interaction.reply({ embeds: [new ErrorEmbed("Hata", t("moderation.kick.notFound", { lang, guildLang }))], ephemeral: true });
    return;
  }
  if (!member.kickable) {
    await interaction.reply({ embeds: [new ErrorEmbed("Hata", t("moderation.kick.notKickable", { lang, guildLang }))], ephemeral: true });
    return;
  }

  await member.kick(reason).catch(async (err) => {
    await interaction.reply({ embeds: [new ErrorEmbed("Hata", t("moderation.kick.failed", { lang, guildLang }))], ephemeral: true });
    throw err;
  });

  await ModerationService.record({
    guildId: interaction.guild.id,
    type: "KICK",
    targetId: target.id,
    moderatorId: interaction.user.id,
    reason,
  });

  const embed = new SuccessEmbed(
    t("moderation.kick.title", { lang, guildLang }),
    t("moderation.kick.description", { lang, guildLang, vars: { user: `<@${target.id}>` } }),
  ).addFields(
    { name: t("moderation.fields.reason", { lang, guildLang }), value: reason },
    { name: t("moderation.fields.moderator", { lang, guildLang }), value: `<@${interaction.user.id}>` },
  );

  await interaction.reply({ embeds: [embed] });
  await ModerationService.notifyLogChannel(interaction.guild, { embeds: [embed] });
}
