import { Client, GatewayIntentBits, Partials, Collection } from "discord.js";
import path from "node:path";
import { env } from "@/config/env";
import { connectDatabase } from "@/database/connection";
import { loadCommands, type Command } from "@/services/CommandRegistry";
import { loadButtonHandlers, loadSelectMenuHandlers, loadModalHandlers } from "@/services/ComponentRegistry";
import { registerInteractionHandler } from "@/events/interactionCreate";
import { registerGuildEvents } from "@/events/guildEvents";
import { discordLogger } from "@/utils/logger";
import { BRAND } from "@/config/constants";
import { globalRateLimiter } from "@/utils/rateLimiter";
import { AuditEngine } from "@/engines/AuditEngine";

const SWEEP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes — keeps in-memory rate-limit/dedupe maps bounded, see SECURITY_AUDIT.md
const RATE_LIMITER_MAX_AGE_MS = 10 * 60 * 1000; // stale buckets older than this are pruned

async function bootstrap(): Promise<void> {
  registerProcessGuards();

  discordLogger.info(`🛡️ ${BRAND.PRODUCT}\n${BRAND.DEVELOPER} Security Systems\nInitializing protection...`);

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildModeration,
      GatewayIntentBits.GuildWebhooks,
      GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Channel, Partials.Message],
  });

  client.on("error", (err) => discordLogger.error({ err }, "Discord client error"));
  client.on("shardError", (err) => discordLogger.error({ err }, "Discord shard error"));
  client.on("warn", (msg) => discordLogger.warn({ msg }, "Discord client warning"));

  const commands = new Collection<string, Command>();
  loadCommands(path.join(__dirname, "commands"), commands);

  const components = {
    buttons: loadButtonHandlers(path.join(__dirname, "components", "buttons")),
    selectMenus: loadSelectMenuHandlers(path.join(__dirname, "components", "selectMenus")),
    modals: loadModalHandlers(path.join(__dirname, "components", "modals")),
  };

  registerInteractionHandler(client, commands, components);
  registerGuildEvents(client);

  await connectDatabase();
  discordLogger.info("✓ Database connected");

  setInterval(() => {
    globalRateLimiter.sweep(RATE_LIMITER_MAX_AGE_MS);
    AuditEngine.sweep();
  }, SWEEP_INTERVAL_MS);

  client.once("clientReady", () => {
    discordLogger.info(
      `✓ Protection systems online\n✓ Database connected\n✓ Threat engine online\n✓ Audit system online`,
    );
  });

  await client.login(env.DISCORD_TOKEN);
}

/**
 * A single unhandled rejection or exception must never take the whole bot
 * down mid-guild-operation (e.g. an expired interaction token deep inside a
 * component handler that slipped past its own try/catch). We log and keep
 * running; genuinely fatal startup errors are still caught by the
 * bootstrap().catch() below since those happen before login.
 */
function registerProcessGuards(): void {
  process.on("unhandledRejection", (reason) => {
    discordLogger.error({ err: reason }, "Unhandled promise rejection — bot continues running");
  });
  process.on("uncaughtException", (err) => {
    discordLogger.error({ err }, "Uncaught exception — bot continues running");
  });
}

bootstrap().catch((err) => {
  discordLogger.error({ err }, "Fatal error during bootstrap");
  process.exit(1);
});
