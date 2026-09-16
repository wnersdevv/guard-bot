import type { ButtonInteraction } from "discord.js";
import { buildWhitelistRemoveModal } from "@/utils/modalBuilders";
import type { ButtonHandler } from "@/services/ComponentRegistry";

export const customId = "whitelist:cikar:ac";

export const execute: ButtonHandler["execute"] = async (interaction: ButtonInteraction) => {
  await interaction.showModal(buildWhitelistRemoveModal());
};
