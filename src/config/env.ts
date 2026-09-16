import { z } from "zod";
import fs from "node:fs";
import path from "node:path";

// No dotenv, no .env files — by design. All configuration, including the
// bot token, lives in a plain JSON file at the project root: ayarlar.json
// (or ayarlar.test.json when NODE_ENV=test, so tests never need a real
// token to run — see ayarlar.example.json for the template).
const CONFIG_FILENAME = process.env.NODE_ENV === "test" ? "ayarlar.test.json" : "ayarlar.json";
const CONFIG_PATH = path.resolve(__dirname, "..", "..", CONFIG_FILENAME);

function loadConfigFile(): Record<string, unknown> {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
    return JSON.parse(raw) as Record<string, unknown>;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(
      `❌ Could not read ${CONFIG_FILENAME} at ${CONFIG_PATH}. ` +
        `Copy ayarlar.example.json to ${CONFIG_FILENAME} and fill in your values.`,
      err,
    );
    process.exit(1);
  }
}

const fileConfig = loadConfigFile();

// A handful of deployment-time values (REDIS_URL, MONGODB_URI, NODE_ENV) can
// still be overridden by real process environment variables — e.g. a CI
// service container or a container orchestrator's own env injection. This
// is NOT a .env file: nothing here is loaded from disk by dotenv, and
// ayarlar.json alone is sufficient to run the bot with zero environment
// variables set.
const merged: Record<string, unknown> = {
  DISCORD_TOKEN: process.env.DISCORD_TOKEN ?? fileConfig.DISCORD_TOKEN,
  CLIENT_ID: process.env.CLIENT_ID ?? fileConfig.CLIENT_ID,
  MONGODB_URI: process.env.MONGODB_URI ?? fileConfig.MONGODB_URI,
  REDIS_URL: emptyToUndefined(process.env.REDIS_URL ?? fileConfig.REDIS_URL),
  NODE_ENV: process.env.NODE_ENV ?? fileConfig.NODE_ENV,
  LOG_LEVEL: process.env.LOG_LEVEL ?? fileConfig.LOG_LEVEL,
};

function emptyToUndefined(value: unknown): unknown {
  return value === "" ? undefined : value;
}

const envSchema = z.object({
  DISCORD_TOKEN: z.string().min(1, "DISCORD_TOKEN is required"),
  CLIENT_ID: z.string().min(1, "CLIENT_ID is required"),
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  REDIS_URL: z.string().min(1).optional(),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  LOG_LEVEL: z.string().default("info"),
});

const parsed = envSchema.safeParse(merged);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error(`❌ Invalid configuration in ${CONFIG_FILENAME}:`, parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
