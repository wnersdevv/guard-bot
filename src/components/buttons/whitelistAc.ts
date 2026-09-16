import type { ButtonInteraction } from "discord.js";
import { buildWhitelistAddModal } from "@/utils/modalBuilders";
import type { ButtonHandler } from "@/services/ComponentRegistry";

export const customId = "whitelist:ac";

export const execute: ButtonHandler["execute"] = async (interaction: ButtonInteraction) => {
  await interaction.showModal(buildWhitelistAddModal());
};
