import { SlashCommandBuilder, PermissionFlagsBits, type ChatInputCommandInteraction } from "discord.js";
import { ModerationService } from "@/services/ModerationService";
import { SuccessEmbed, ErrorEmbed } from "@/utils/embeds";
import { t } from "@/localization";
import { resolveLanguages } from "@/services/LanguageService";

export const data = new SlashCommandBuilder()
  .setName("yasakla")
  .setDescription("Bir kullanıcıyı sunucudan yasakla")
  .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
  .addUserOption((o) => o.setName("kullanici").setDescription("Yasaklanacak kullanıcı").setRequired(true))
  .addStringOption((o) => o.setName("sebep").setDescription("Yasaklama sebebi").setRequired(false))
  .addIntegerOption((o) =>
    o.setName("mesaj-sil-gun").setDescription("Silinecek mesaj geçmişi (gün, 0-7)").setMinValue(0).setMaxValue(7),
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;
  const target = interaction.options.getUser("kullanici", true);
  const { lang, guildLang } = await resolveLanguages(interaction.guild.id, interaction.user.id);
  const reason = interaction.options.getString("sebep") ?? t("moderation.reasonNotSpecified", { lang, guildLang });
  const deleteDays = interaction.options.getInteger("mesaj-sil-gun") ?? 0;

  const member = await interaction.guild.members.fetch(target.id).catch(() => null);
  if (member && !member.bannable) {
    await interaction.reply({ embeds: [new ErrorEmbed("Hata", t("moderation.ban.notBannable", { lang, guildLang }))], ephemeral: true });
    return;
  }

  await interaction.guild.members
    .ban(target.id, { reason, deleteMessageSeconds: deleteDays * 86_400 })
    .catch(async (err) => {
      await interaction.reply({ embeds: [new ErrorEmbed("Hata", t("moderation.ban.failed", { lang, guildLang }))], ephemeral: true });
      throw err;
    });

  await ModerationService.record({
    guildId: interaction.guild.id,
    type: "BAN",
    targetId: target.id,
    moderatorId: interaction.user.id,
    reason,
  });

  const embed = new SuccessEmbed(
    t("moderation.ban.title", { lang, guildLang }),
    t("moderation.ban.description", { lang, guildLang, vars: { user: `<@${target.id}>` } }),
  ).addFields(
    { name: t("moderation.fields.reason", { lang, guildLang }), value: reason },
    { name: t("moderation.fields.moderator", { lang, guildLang }), value: `<@${interaction.user.id}>` },
  );

  await interaction.reply({ embeds: [embed] });
  await ModerationService.notifyLogChannel(interaction.guild, { embeds: [embed] });
}
