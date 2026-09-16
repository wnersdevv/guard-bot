import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ChatInputCommandInteraction,
} from "discord.js";
import { BackupService } from "@/services/BackupService";
import { SuccessEmbed, ErrorEmbed, InfoEmbed } from "@/utils/embeds";
import { isDatabaseAvailable } from "@/database/connection";
import { t } from "@/localization";
import { resolveLanguages } from "@/services/LanguageService";

export const data = new SlashCommandBuilder()
  .setName("yedek")
  .setDescription("Sunucu yedekleme sistemi")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand((sub) =>
    sub
      .setName("olustur")
      .setDescription("Yeni bir yedek oluştur")
      .addStringOption((o) => o.setName("ad").setDescription("Yedek adı").setRequired(true).setMaxLength(50)),
  )
  .addSubcommand((sub) => sub.setName("listele").setDescription("Mevcut yedekleri listele"))
  .addSubcommand((sub) =>
    sub
      .setName("geri-yukle")
      .setDescription("Bir yedeği geri yükle (onay gerektirir)")
      .addStringOption((o) => o.setName("ad").setDescription("Yedek adı").setRequired(true)),
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;
  const { lang, guildLang } = await resolveLanguages(interaction.guild.id, interaction.user.id);

  if (!isDatabaseAvailable()) {
    await interaction.reply({ embeds: [new ErrorEmbed("Hata", t("settings.dbUnavailable", { lang, guildLang }))], ephemeral: true });
    return;
  }

  const sub = interaction.options.getSubcommand();

  if (sub === "olustur") {
    const name = interaction.options.getString("ad", true);
    await interaction.deferReply({ ephemeral: true });
    const backup = await BackupService.create(interaction.guild, name, interaction.user.id);
    if (!backup) {
      await interaction.editReply({ embeds: [new ErrorEmbed("Hata", t("settings.backup.create.failed", { lang, guildLang }))] });
      return;
    }
    await interaction.editReply({
      embeds: [
        new SuccessEmbed(
          t("settings.backup.create.success.title", { lang, guildLang }),
          t("settings.backup.create.success.description", {
            lang,
            guildLang,
            vars: { name, roles: backup.data.roles.length, channels: backup.data.channels.length, categories: backup.data.categories.length },
          }),
        ),
      ],
    });
    return;
  }

  if (sub === "listele") {
    const backups = await BackupService.list(interaction.guild.id);
    const description = backups.length
      ? backups
          .map((b) => `**${b.name}** — <@${b.createdBy}> — <t:${Math.floor(new Date(b.createdAt as unknown as string).getTime() / 1000)}:R>`)
          .join("\n")
      : t("settings.backup.list.empty", { lang, guildLang });
    await interaction.reply({ embeds: [new InfoEmbed(t("settings.backup.list.title", { lang, guildLang }), description)], ephemeral: true });
    return;
  }

  if (sub === "geri-yukle") {
    const name = interaction.options.getString("ad", true);
    const backup = await BackupService.findByName(interaction.guild.id, name);
    if (!backup) {
      await interaction.reply({
        embeds: [new ErrorEmbed("Hata", t("settings.backup.notFound", { lang, guildLang, vars: { name } }))],
        ephemeral: true,
      });
      return;
    }

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`yedek:onayla:${name}`).setLabel("Onayla").setEmoji("⚠️").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId("yedek:iptal").setLabel("İptal").setEmoji("❌").setStyle(ButtonStyle.Secondary),
    );

    await interaction.reply({
      embeds: [
        new InfoEmbed(
          t("settings.backup.confirm.title", { lang, guildLang }),
          t("settings.backup.confirm.description", {
            lang,
            guildLang,
            vars: { name, roles: backup.data.roles.length, channels: backup.data.channels.length },
          }),
        ),
      ],
      components: [row],
      ephemeral: true,
    });
  }
}
