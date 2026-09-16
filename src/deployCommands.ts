import { REST, Routes, Collection } from "discord.js";
import path from "node:path";
import { env } from "@/config/env";
import { loadCommands, type Command } from "@/services/CommandRegistry";
import { discordLogger } from "@/utils/logger";

async function main(): Promise<void> {
  const commands = new Collection<string, Command>();
  loadCommands(path.join(__dirname, "commands"), commands);

  const body = [...commands.values()].map((c) => c.data.toJSON());
  const rest = new REST().setToken(env.DISCORD_TOKEN);

  await rest.put(Routes.applicationCommands(env.CLIENT_ID), { body });
  discordLogger.info({ count: body.length }, "Slash commands deployed");
}

main().catch((err) => {
  discordLogger.error({ err }, "Failed to deploy commands");
  process.exit(1);
});
