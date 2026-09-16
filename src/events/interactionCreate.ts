import type { Client, Collection, Interaction } from "discord.js";
import type { Command } from "@/services/CommandRegistry";
import type { ButtonHandler, SelectMenuHandler, ModalHandler } from "@/services/ComponentRegistry";
import { resolveHandler } from "@/services/ComponentRegistry";
import { ErrorEmbed } from "@/utils/embeds";
import { discordLogger } from "@/utils/logger";

export interface ComponentHandlers {
  buttons: ButtonHandler[];
  selectMenus: SelectMenuHandler[];
  modals: ModalHandler[];
}

async function safeErrorReply(interaction: {
  deferred: boolean;
  replied: boolean;
  reply: (opts: unknown) => Promise<unknown>;
  followUp: (opts: unknown) => Promise<unknown>;
}): Promise<void> {
  const embed = new ErrorEmbed("Hata", "İşlem gerçekleştirilirken bir hata oluştu.");
  if (interaction.deferred || interaction.replied) {
    await interaction.followUp({ embeds: [embed], ephemeral: true }).catch(() => undefined);
  } else {
    await interaction.reply({ embeds: [embed], ephemeral: true }).catch(() => undefined);
  }
}

export function registerInteractionHandler(
  client: Client,
  commands: Collection<string, Command>,
  components: ComponentHandlers,
): void {
  client.on("interactionCreate", async (interaction: Interaction) => {
    try {
      if (interaction.isChatInputCommand()) {
        const command = commands.get(interaction.commandName);
        if (!command) return;
        try {
          await command.execute(interaction);
        } catch (err) {
          discordLogger.error({ err, command: interaction.commandName }, "Command execution failed");
          await safeErrorReply(interaction);
        }
        return;
      }

      if (interaction.isButton()) {
        const handler = resolveHandler(components.buttons, interaction.customId);
        if (!handler) return;
        try {
          await handler.execute(interaction);
        } catch (err) {
          discordLogger.error({ err, customId: interaction.customId }, "Button handler failed");
          await safeErrorReply(interaction);
        }
        return;
      }

      if (interaction.isStringSelectMenu()) {
        const handler = resolveHandler(components.selectMenus, interaction.customId);
        if (!handler) return;
        try {
          await handler.execute(interaction);
        } catch (err) {
          discordLogger.error({ err, customId: interaction.customId }, "Select menu handler failed");
          await safeErrorReply(interaction);
        }
        return;
      }

      if (interaction.isModalSubmit()) {
        const handler = resolveHandler(components.modals, interaction.customId);
        if (!handler) return;
        try {
          await handler.execute(interaction);
        } catch (err) {
          discordLogger.error({ err, customId: interaction.customId }, "Modal handler failed");
          await safeErrorReply(interaction);
        }
        return;
      }
    } catch (err) {
      // Catches things like an expired interaction token blowing up before we even
      // reach a handler-specific try/catch above.
      discordLogger.error({ err }, "Unhandled interaction error");
    }
  });
}
