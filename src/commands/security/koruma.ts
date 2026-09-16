import { SlashCommandBuilder, PermissionFlagsBits, type ChatInputCommandInteraction } from "discord.js";
import { GuildSettingsModel } from "@/models/GuildSettings";
import { SecurityEmbed } from "@/utils/embeds";
import { isDatabaseAvailable } from "@/database/connection";
import { ActionRowBuilder, StringSelectMenuBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("koruma")
  .setDescription("Koruma sistemlerini görüntüle ve yönet")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;

  const settings = isDatabaseAvailable()
    ? await GuildSettingsModel.findOne({ guildId: interaction.guild.id }).lean()
    : null;
  const modules = settings?.modules;
  const line = (label: string, on?: boolean): string => `${on ?? true ? "🟢" : "🔴"} ${label}`;

  const embed = new SecurityEmbed("Koruma Sistemleri").setDescription(
    [
      line("Anti-Nuke", modules?.antiNuke),
      line("Anti-Raid", modules?.antiRaid),
      line("Anti-Spam", modules?.antiSpam),
      line("Anti-Webhook", modules?.antiWebhook),
      line("Anti-Bot", modules?.antiBot),
      line("Anti-Mention", modules?.antiMention),
      line("Role Protection", modules?.roleProtection),
      line("Channel Protection", modules?.channelProtection),
      line("Server Protection", modules?.serverProtection),
    ].join("\n"),
  );

  const select = new StringSelectMenuBuilder()
    .setCustomId("koruma:toggle")
    .setPlaceholder("Aç/kapat için bir sistem seçin")
    .addOptions(
      { label: "Anti-Nuke", value: "antiNuke" },
      { label: "Anti-Raid", value: "antiRaid" },
      { label: "Anti-Spam", value: "antiSpam" },
      { label: "Anti-Webhook", value: "antiWebhook" },
      { label: "Anti-Bot", value: "antiBot" },
      { label: "Anti-Mention", value: "antiMention" },
      { label: "Role Protection", value: "roleProtection" },
      { label: "Channel Protection", value: "channelProtection" },
      { label: "Server Protection", value: "serverProtection" },
    );

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
  await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}
