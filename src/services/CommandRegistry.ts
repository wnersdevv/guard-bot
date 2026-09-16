import fs from "node:fs";
import path from "node:path";
import type { Collection, SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { discordLogger } from "@/utils/logger";

export interface Command {
  data: SlashCommandBuilder | { name: string; toJSON: () => unknown };
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

/**
 * Loads every command module under src/commands/** at startup so a command
 * file's handler is never orphaned from its registration — if you add a
 * command file, it is picked up automatically on next boot.
 */
export function loadCommands(commandsDir: string, target: Collection<string, Command>): void {
  const categories = fs.readdirSync(commandsDir, { withFileTypes: true }).filter((d) => d.isDirectory());

  for (const category of categories) {
    const categoryPath = path.join(commandsDir, category.name);
    const files = fs.readdirSync(categoryPath).filter((f) => f.endsWith(".ts") || f.endsWith(".js"));

    for (const file of files) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const command = require(path.join(categoryPath, file)) as Command;
      if (!command.data || !command.execute) {
        discordLogger.warn({ file }, "Skipped invalid command module (missing data/execute)");
        continue;
      }
      target.set(command.data.name, command);
      discordLogger.info({ command: command.data.name }, "Command loaded");
    }
  }
}
