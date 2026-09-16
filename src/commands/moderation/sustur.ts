import { SlashCommandBuilder, PermissionFlagsBits, type ChatInputCommandInteraction } from "discord.js";
import { ModerationService } from "@/services/ModerationService";
import { SuccessEmbed, ErrorEmbed } from "@/utils/embeds";
import { t } from "@/localization";
import { resolveLanguages } from "@/services/LanguageService";

const MAX_TIMEOUT_MS = 28 * 24 * 60 * 60 * 1000; // Discord's timeout cap

export const data = new SlashCommandBuilder()
  .setName("sustur")
  .setDescription("Bir kullanıcıyı sustur (timeout)")
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .addUserOption((o) => o.setName("kullanici").setDescription("Susturulacak kullanıcı").setRequired(true))
  .addIntegerOption((o) => o.setName("dakika").setDescription("Süre (dakika)").setRequired(true).setMinValue(1).setMaxValue(40320))
  .addStringOption((o) => o.setName("sebep").setDescription("Susturma sebebi").setRequired(false));

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;
  const target = interaction.options.getUser("kullanici", true);
  const minutes = interaction.options.getInteger("dakika", true);
  const { lang, guildLang } = await resolveLanguages(interaction.guild.id, interaction.user.id);
  const reason = interaction.options.getString("sebep") ?? t("moderation.reasonNotSpecified", { lang, guildLang });
  const durationMs = Math.min(minutes * 60_000, MAX_TIMEOUT_MS);

  const member = await interaction.guild.members.fetch(target.id).catch(() => null);
  if (!member) {
    await interaction.reply({ embeds: [new ErrorEmbed("Hata", t("moderation.mute.notFound", { lang, guildLang }))], ephemeral: true });
    return;
  }
  if (!member.moderatable) {
    await interaction.reply({ embeds: [new ErrorEmbed("Hata", t("moderation.mute.notModeratable", { lang, guildLang }))], ephemeral: true });
    return;
  }

  await member.timeout(durationMs, reason).catch(async (err) => {
    await interaction.reply({ embeds: [new ErrorEmbed("Hata", t("moderation.mute.failed", { lang, guildLang }))], ephemeral: true });
    throw err;
  });

  await ModerationService.record({
    guildId: interaction.guild.id,
    type: "MUTE",
    targetId: target.id,
    moderatorId: interaction.user.id,
    reason,
    durationMs,
  });

  const embed = new SuccessEmbed(
    t("moderation.mute.title", { lang, guildLang }),
    t("moderation.mute.description", { lang, guildLang, vars: { user: `<@${target.id}>`, minutes } }),
  ).addFields(
    { name: t("moderation.fields.reason", { lang, guildLang }), value: reason },
    { name: t("moderation.fields.moderator", { lang, guildLang }), value: `<@${interaction.user.id}>` },
  );

  await interaction.reply({ embeds: [embed] });
  await ModerationService.notifyLogChannel(interaction.guild, { embeds: [embed] });
}
