import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from "discord.js";

/** Builds the "Whitelist Kullanıcı Ekle" modal shown from the protection panel. */
export function buildWhitelistAddModal(): ModalBuilder {
  const input = new TextInputBuilder()
    .setCustomId("discordId")
    .setLabel("Discord ID")
    .setPlaceholder("123456789012345678")
    .setStyle(TextInputStyle.Short)
    .setMinLength(17)
    .setMaxLength(20)
    .setRequired(true);

  return new ModalBuilder()
    .setCustomId("whitelist:ekle")
    .setTitle("Whitelist Kullanıcı Ekle")
    .addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
}

/** Builds the "Whitelist Kullanıcı Çıkar" modal. */
export function buildWhitelistRemoveModal(): ModalBuilder {
  const input = new TextInputBuilder()
    .setCustomId("discordId")
    .setLabel("Discord ID")
    .setPlaceholder("123456789012345678")
    .setStyle(TextInputStyle.Short)
    .setMinLength(17)
    .setMaxLength(20)
    .setRequired(true);

  return new ModalBuilder()
    .setCustomId("whitelist:cikar")
    .setTitle("Whitelist Kullanıcı Çıkar")
    .addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
}
