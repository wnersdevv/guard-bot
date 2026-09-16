import type { StringSelectMenuInteraction } from "discord.js";
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from "@/config/constants";
import { UserModel } from "@/models/User";
import { SuccessEmbed, ErrorEmbed } from "@/utils/embeds";
import { isDatabaseAvailable } from "@/database/connection";
import type { SelectMenuHandler } from "@/services/ComponentRegistry";

export const customId = "dil:sec";

export const execute: SelectMenuHandler["execute"] = async (interaction: StringSelectMenuInteraction) => {
  const chosen = interaction.values[0] as SupportedLanguage;

  if (!SUPPORTED_LANGUAGES.includes(chosen)) {
    await interaction.reply({ embeds: [new ErrorEmbed("Hata", "Geçersiz dil.")], ephemeral: true });
    return;
  }

  if (!isDatabaseAvailable()) {
    await interaction.reply({ embeds: [new ErrorEmbed("Hata", "Veritabanı şu anda kullanılamıyor.")], ephemeral: true });
    return;
  }

  await UserModel.findOneAndUpdate(
    { userId: interaction.user.id },
    { $set: { language: chosen } },
    { upsert: true },
  );

  await interaction.reply({
    embeds: [new SuccessEmbed("Dil Güncellendi", `Dil tercihiniz kaydedildi: **${chosen}**`)],
    ephemeral: true,
  });
};
