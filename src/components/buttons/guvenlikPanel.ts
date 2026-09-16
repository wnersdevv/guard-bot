import type { ButtonInteraction } from "discord.js";
import { StringSelectMenuBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder, PermissionFlagsBits } from "discord.js";
import { InfoEmbed, SecurityEmbed, ErrorEmbed } from "@/utils/embeds";
import { GuildSettingsModel } from "@/models/GuildSettings";
import { SecurityEventModel } from "@/models/SecurityEvent";
import { isDatabaseAvailable } from "@/database/connection";
import { renderSecurityReport } from "@/canvas/SecurityReportCanvas";
import { ThreatEngine } from "@/engines/ThreatEngine";
import type { ButtonHandler } from "@/services/ComponentRegistry";

/**
 * Routes every "guvenlik:<panel>" button from the Security Center to its panel.
 * isPrefix keeps this one file handling all six buttons without six near-duplicate handlers.
 */
export const customId = "guvenlik";
export const isPrefix = true;

export const execute: ButtonHandler["execute"] = async (interaction: ButtonInteraction) => {
  if (!interaction.guild) return;

  // The Security Center message itself is visible to the whole channel — every
  // panel behind it must re-check permission at click time, not just at /guvenlik.
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    await interaction.reply({
      embeds: [new ErrorEmbed("Yetkisiz", "Bu paneli görüntülemek için Sunucuyu Yönet yetkisi gerekir.")],
      ephemeral: true,
    });
    return;
  }

  const panel = interaction.customId.split(":")[1];

  switch (panel) {
    case "koruma":
      return showProtectionPanel(interaction);
    case "tehditler":
      return showThreatsPanel(interaction);
    case "loglar":
      return showLogsPanel(interaction);
    case "ayarlar":
      return showSettingsPanel(interaction);
    case "istatistik":
      return showStatsPanel(interaction);
    case "sistem":
      return showSystemPanel(interaction);
    default:
      await interaction.reply({ content: "Bilinmeyen panel.", ephemeral: true });
  }
};

async function showProtectionPanel(interaction: ButtonInteraction): Promise<void> {
  const settings = isDatabaseAvailable()
    ? await GuildSettingsModel.findOne({ guildId: interaction.guild!.id }).lean()
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
    .setPlaceholder("Bir koruma sistemi seçin")
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

  const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
  const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("whitelist:ac").setLabel("Whitelist Ekle").setEmoji("➕").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("whitelist:cikar:ac").setLabel("Whitelist Çıkar").setEmoji("➖").setStyle(ButtonStyle.Danger),
  );

  await interaction.reply({ embeds: [embed], components: [selectRow, buttonRow], ephemeral: true });
}

async function showThreatsPanel(interaction: ButtonInteraction): Promise<void> {
  if (!isDatabaseAvailable()) {
    await interaction.reply({ embeds: [new InfoEmbed("Tehditler", "Veritabanı şu anda kullanılamıyor.")], ephemeral: true });
    return;
  }

  const recent = await SecurityEventModel.find({ guildId: interaction.guild!.id })
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();

  const description = recent.length
    ? recent
        .map(
          (e) =>
            `**${e.type}** — ${e.severity} (${e.riskScore}/100) — ${e.action} — <t:${Math.floor(new Date(e.createdAt as unknown as string).getTime() / 1000)}:R>`,
        )
        .join("\n")
    : "Henüz kayıtlı tehdit yok.";

  await interaction.reply({ embeds: [new SecurityEmbed("Son Tehditler", description)], ephemeral: true });
}

async function showLogsPanel(interaction: ButtonInteraction): Promise<void> {
  const settings = isDatabaseAvailable()
    ? await GuildSettingsModel.findOne({ guildId: interaction.guild!.id }).lean()
    : null;

  const description = settings?.logChannelId
    ? `Log kanalı: <#${settings.logChannelId}>`
    : "Log kanalı henüz ayarlanmadı. `/ayarlar` komutuyla ayarlayabilirsiniz.";

  await interaction.reply({ embeds: [new InfoEmbed("Loglar", description)], ephemeral: true });
}

async function showSettingsPanel(interaction: ButtonInteraction): Promise<void> {
  await interaction.reply({
    embeds: [new InfoEmbed("Ayarlar", "Detaylı ayarlar için `/ayarlar` komutunu kullanın.")],
    ephemeral: true,
  });
}

async function showStatsPanel(interaction: ButtonInteraction): Promise<void> {
  if (!isDatabaseAvailable()) {
    await interaction.reply({ embeds: [new InfoEmbed("İstatistik", "Veritabanı şu anda kullanılamıyor.")], ephemeral: true });
    return;
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const guildId = interaction.guild!.id;

  const [threatsToday, blocked, raidAttempts, nukeAttempts] = await Promise.all([
    SecurityEventModel.countDocuments({ guildId, createdAt: { $gte: since } }),
    SecurityEventModel.countDocuments({ guildId, createdAt: { $gte: since }, action: { $in: ["BLOCKED", "PUNISHED"] } }),
    SecurityEventModel.countDocuments({ guildId, createdAt: { $gte: since }, type: { $regex: "^antiRaid" } }),
    SecurityEventModel.countDocuments({ guildId, createdAt: { $gte: since }, type: { $regex: "^antiNuke" } }),
  ]);

  const embed = new SecurityEmbed("Security Overview").addFields(
    { name: "Threats Today", value: String(threatsToday), inline: true },
    { name: "Blocked Actions", value: String(blocked), inline: true },
    { name: "Raid Attempts", value: String(raidAttempts), inline: true },
    { name: "Nuke Attempts", value: String(nukeAttempts), inline: true },
  );

  const reportBuffer = renderSecurityReport({
    threatLevel: ThreatEngine.severityFor(threatsToday === 0 ? 0 : Math.min(100, threatsToday * 5)),
    blocked,
    warnings: threatsToday - blocked,
    raidAttempts,
    nukeAttempts,
  });
  const attachment = new AttachmentBuilder(reportBuffer, { name: "security-report.png" });
  embed.setImage("attachment://security-report.png");

  await interaction.reply({ embeds: [embed], files: [attachment], ephemeral: true });
}

async function showSystemPanel(interaction: ButtonInteraction): Promise<void> {
  const dbStatus = isDatabaseAvailable() ? "🟢 Bağlı" : "🔴 Bağlantı Yok";
  const embed = new InfoEmbed("Sistem Durumu").addFields(
    { name: "Veritabanı", value: dbStatus, inline: true },
    { name: "Uptime", value: `<t:${Math.floor((Date.now() - process.uptime() * 1000) / 1000)}:R>`, inline: true },
  );
  await interaction.reply({ embeds: [embed], ephemeral: true });
}
