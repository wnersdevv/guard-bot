import type { ModalSubmitInteraction } from "discord.js";
import { z } from "zod";
import { WhitelistModel } from "@/models/Whitelist";
import { SuccessEmbed, ErrorEmbed } from "@/utils/embeds";
import { isDatabaseAvailable } from "@/database/connection";
import type { ModalHandler } from "@/services/ComponentRegistry";

const discordIdSchema = z.string().regex(/^\d{17,20}$/, "Geçerli bir Discord ID giriniz");

export const customId = "whitelist:cikar";

export const execute: ModalHandler["execute"] = async (interaction: ModalSubmitInteraction) => {
  if (!interaction.guild) return;

  const rawId = interaction.fields.getTextInputValue("discordId");
  const parsed = discordIdSchema.safeParse(rawId.trim());

  if (!parsed.success) {
    await interaction.reply({ embeds: [new ErrorEmbed("Geçersiz Girdi", parsed.error.issues[0]?.message ?? "Geçersiz Discord ID")], ephemeral: true });
    return;
  }

  if (!isDatabaseAvailable()) {
    await interaction.reply({ embeds: [new ErrorEmbed("Hata", "Veritabanı şu anda kullanılamıyor.")], ephemeral: true });
    return;
  }

  const result = await WhitelistModel.deleteOne({ guildId: interaction.guild.id, type: "USER", targetId: parsed.data });

  if (result.deletedCount === 0) {
    await interaction.reply({ embeds: [new ErrorEmbed("Bulunamadı", `<@${parsed.data}> whitelist'te değil.`)], ephemeral: true });
    return;
  }

  await interaction.reply({
    embeds: [new SuccessEmbed("Whitelist'ten Çıkarıldı", `<@${parsed.data}> whitelist'ten çıkarıldı.`)],
    ephemeral: true,
  });
};
